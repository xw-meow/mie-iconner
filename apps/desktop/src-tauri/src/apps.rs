use std::collections::HashSet;
use std::ffi::CString;
use std::os::unix::ffi::OsStrExt;
use std::path::{Path, PathBuf};

use plist::Value;

use crate::error::AppError;
use crate::folder::file_version;
use crate::macos::icons;
use crate::models::AppDto;
use crate::text::localized_compare;

/// 可修改的应用根目录。`/System/Applications` 下的系统应用受 SIP
/// 保护，即使 root 也无法写入，因此不进入列表，避免给用户无效入口。
pub fn roots(home: &Path) -> Vec<PathBuf> {
    vec![PathBuf::from("/Applications"), home.join("Applications")]
}

/// 扫描所有已安装的 .app。`/Applications/Utilities` 这类一层子目录
/// 也会进入；不深入 .app 内部，避免把插件/Resources 当成应用。
pub fn list_apps(home: &Path) -> Result<Vec<AppDto>, AppError> {
    list_apps_in(&roots(home))
}

fn list_apps_in(roots: &[PathBuf]) -> Result<Vec<AppDto>, AppError> {
    let mut apps = Vec::new();
    let mut seen = HashSet::new();
    for root in roots {
        scan_dir(root, 0, &mut apps, &mut seen);
    }
    apps.sort_by(|a, b| localized_compare(&a.name, &b.name));
    Ok(apps)
}

fn scan_dir(directory: &Path, depth: usize, apps: &mut Vec<AppDto>, seen: &mut HashSet<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let Ok(metadata) = std::fs::metadata(&path) else {
            continue;
        };
        if !metadata.is_dir() {
            continue;
        }

        if name.to_ascii_lowercase().ends_with(".app") {
            let Ok(canonical) = std::fs::canonicalize(&path) else {
                continue;
            };
            if seen.insert(canonical.clone()) && !is_system_app(&canonical) {
                apps.push(app_dto(&canonical));
            }
            continue;
        }

        if depth < 2 {
            scan_dir(&path, depth + 1, apps, seen);
        }
    }
}

fn app_dto(app: &Path) -> AppDto {
    let info = bundle_info(app);
    let name = info
        .as_ref()
        .and_then(|info| {
            info.get("CFBundleDisplayName")
                .or_else(|| info.get("CFBundleName"))
                .and_then(Value::as_string)
        })
        .filter(|name| !name.trim().is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| {
            app.file_stem()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_else(|| "未命名应用".to_string())
        });
    let bundle_id = info
        .as_ref()
        .and_then(|info| info.get("CFBundleIdentifier").and_then(Value::as_string))
        .map(str::to_owned);
    let has_custom_icon = icons::has_custom_icon(app);
    let icon_modified = if has_custom_icon {
        file_version(&app.join("Icon\r"))
    } else {
        file_version(app)
    };
    let system = is_system_app(app);

    AppDto {
        path: app.to_string_lossy().into_owned(),
        name,
        bundle_id,
        has_custom_icon,
        icon_modified,
        modifiable: !system && is_writable(app),
        system,
    }
}

fn bundle_info(app: &Path) -> Option<plist::Dictionary> {
    Value::from_file(app.join("Contents/Info.plist"))
        .ok()?
        .into_dictionary()
}

/// 默认图标：优先读取 Info.plist 指向的 icns，再退回 Resources 里
/// 体积最大的 icns。现代 Asset Catalog-only 的 App 会返回 None，
/// 前端用通用 App 图标兜底。
pub fn app_icon_png(app: &Path) -> Option<Vec<u8>> {
    if icons::has_custom_icon(app) {
        if let Some(png) = icons::custom_icon_png(app) {
            return Some(png);
        }
    }
    default_icon_png(app)
}

fn default_icon_png(app: &Path) -> Option<Vec<u8>> {
    let resources = app.join("Contents").join("Resources");
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Some(info) = bundle_info(app) {
        if let Some(icon_file) = info.get("CFBundleIconFile").and_then(Value::as_string) {
            let file_name = if icon_file.to_ascii_lowercase().ends_with(".icns") {
                icon_file.to_string()
            } else {
                format!("{icon_file}.icns")
            };
            let path = resources.join(file_name);
            if path.is_file() {
                candidates.push(path);
            }
        }
    }

    let mut fallback = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&resources) {
        for entry in entries.flatten() {
            let path = entry.path();
            let is_icns = path
                .extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| extension.eq_ignore_ascii_case("icns"))
                .unwrap_or(false);
            if !is_icns || !path.is_file() {
                continue;
            }
            let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            fallback.push((size, path));
        }
    }
    fallback.sort_by_key(|(size, _)| std::cmp::Reverse(*size));
    for (_, path) in fallback {
        if !candidates.contains(&path) {
            candidates.push(path);
        }
    }

    for path in candidates {
        let Ok(bytes) = std::fs::read(&path) else {
            continue;
        };
        if let Some(png) = icons::largest_png_element(&bytes) {
            return Some(png);
        }
    }
    None
}

/// 防止 thumbnail 命令被随意传入任意文件：只接受真实的 .app，
/// 且必须位于标准应用目录下。
pub fn is_app_path(path: &Path, home: &Path) -> bool {
    let Ok(canonical) = std::fs::canonicalize(path) else {
        return false;
    };
    let is_bundle = canonical.is_dir()
        && canonical
            .extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.eq_ignore_ascii_case("app"))
            .unwrap_or(false);
    if !is_bundle {
        return false;
    }
    roots(home).iter().any(|root| {
        std::fs::canonicalize(root)
            .map(|root| canonical.starts_with(root))
            .unwrap_or(false)
    })
}

pub fn is_system_app(app: &Path) -> bool {
    app.starts_with("/System/")
}

pub fn is_writable(app: &Path) -> bool {
    let Ok(path) = CString::new(app.as_os_str().as_bytes()) else {
        return false;
    };
    // SAFETY: path 是有效的 NUL 结尾 C 字符串，access 只读取它。
    unsafe { libc::access(path.as_ptr(), libc::W_OK) == 0 }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_png_icns(path: &Path) {
        let image = image::RgbaImage::from_pixel(32, 32, image::Rgba([255, 92, 56, 255]));
        let mut png = Vec::new();
        image
            .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
            .unwrap();
        let element_len = png.len() + 8;
        let mut icns = b"icns".to_vec();
        icns.extend_from_slice(&((element_len + 8) as u32).to_be_bytes());
        icns.extend_from_slice(b"ic09");
        icns.extend_from_slice(&(element_len as u32).to_be_bytes());
        icns.extend_from_slice(&png);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, icns).unwrap();
    }

    #[test]
    fn roots_exclude_system_applications() {
        let roots = roots(Path::new("/Users/me"));
        assert!(!roots.iter().any(|root| root.starts_with("/System")));
    }

    #[test]
    fn lists_apps_and_keeps_bundles_out_of_recursion() {
        let temp = tempfile::tempdir().unwrap();
        let apps = temp.path().join("Applications");
        let nested = apps.join("Utilities");
        let app = apps.join("Alpha.app");
        let deeper = nested.join("Beta.app");
        let inner = app.join("Contents/Helpers/Nested.app");
        std::fs::create_dir_all(&app).unwrap();
        std::fs::create_dir_all(&deeper).unwrap();
        std::fs::create_dir_all(&inner).unwrap();
        std::fs::write(app.join("Icon\r"), "x").unwrap();

        let list = list_apps_in(std::slice::from_ref(&apps)).unwrap();
        let names: Vec<&str> = list.iter().map(|app| app.name.as_str()).collect();
        assert_eq!(names, vec!["Alpha", "Beta"]);
        assert!(list.iter().all(|app| !app.has_custom_icon));
    }

    #[test]
    fn extracts_info_plist_icon() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("Demo.app");
        let resources = app.join("Contents/Resources");
        std::fs::create_dir_all(&resources).unwrap();
        std::fs::write(
            app.join("Contents/Info.plist"),
            r#"<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>CFBundleIconFile</key><string>DemoIcon</string></dict></plist>"#,
        )
        .unwrap();
        write_png_icns(&resources.join("DemoIcon.icns"));

        let png = app_icon_png(&app).expect("icon should decode");
        assert!(png.starts_with(&[0x89, 0x50, 0x4E, 0x47]));
    }

    #[test]
    fn app_path_validation_only_accepts_standard_roots() {
        let temp = tempfile::tempdir().unwrap();
        let apps = temp.path().join("Applications");
        let valid = apps.join("Demo.app");
        let loose = temp.path().join("Loose.app");
        std::fs::create_dir_all(&valid).unwrap();
        std::fs::create_dir_all(&loose).unwrap();

        assert!(is_app_path(&valid, temp.path()));
        assert!(!is_app_path(&loose, temp.path()));
        let not_app = apps.join("NotAnApp");
        std::fs::create_dir_all(&not_app).unwrap();
        assert!(!is_app_path(&not_app, temp.path()));
    }
}
