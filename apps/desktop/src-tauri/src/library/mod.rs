use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::error::AppError;
use crate::folder::file_version;
use crate::models::{
    CategoryConfigDto, CategoryDto, IconDto, IconSource, ImportFailure, ImportReport, LibraryDto,
};
use crate::paths::validate_folder_name;
use crate::text::localized_compare;

pub mod config;

/// 根目录散图归入的分类名，也是首次运行时预建的分类名。
/// 它没有任何特权：排序、删除与普通分类完全一致。
pub const DEFAULT_CATEGORY: &str = "default";
const ALLOWED_EXTENSIONS: [&str; 3] = ["png", "jpg", "jpeg"];

pub fn is_supported_image(path: &Path) -> bool {
    path.extension()
        .map(|ext| ext.to_string_lossy().to_lowercase())
        .map(|ext| ALLOWED_EXTENSIONS.contains(&ext.as_str()))
        .unwrap_or(false)
}

#[derive(Debug, Default)]
struct CategoryContent {
    icons: Vec<IconDto>,
    config: CategoryConfigDto,
}

/// 扫描系统预设与自定义两个根目录，产出 UI 可直接消费的快照。
pub fn scan_library(bundled_root: Option<&Path>, custom_root: &Path) -> LibraryDto {
    LibraryDto {
        bundled: scan_root(bundled_root, IconSource::Bundled),
        custom: scan_root(Some(custom_root), IconSource::Custom),
    }
}

fn scan_root(root: Option<&Path>, source: IconSource) -> Vec<CategoryDto> {
    let Some(root) = root else {
        return Vec::new();
    };
    let Ok(entries) = std::fs::read_dir(root) else {
        return Vec::new();
    };

    let mut buckets: BTreeMap<String, CategoryContent> = BTreeMap::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        let Ok(metadata) = std::fs::metadata(&path) else {
            continue;
        };
        if metadata.is_dir() {
            let config = config::load(&path);
            let icons = images_in(&path, source);
            // 子文件夹可能与根目录散图撞名（例如名为 default 的子目录）：
            // 图标合并，配置以子文件夹的 config.json 为准
            let bucket = buckets.entry(name).or_default();
            bucket.icons.extend(icons);
            bucket.config = config;
        } else if is_supported_image(&path) {
            let bucket = buckets.entry(DEFAULT_CATEGORY.to_string()).or_default();
            bucket.icons.push(icon_dto(&path, source));
        }
    }

    let mut categories: Vec<CategoryDto> = buckets
        .into_iter()
        .map(|(name, mut content)| {
            content
                .icons
                .sort_by(|a, b| localized_compare(file_name_of(&a.path), file_name_of(&b.path)));
            CategoryDto {
                name,
                icons: content.icons,
                config: content.config,
            }
        })
        .collect();

    categories.sort_by(|a, b| {
        if a.config.priority != b.config.priority {
            b.config.priority.cmp(&a.config.priority)
        } else {
            localized_compare(&a.name, &b.name)
        }
    });
    categories
}

fn file_name_of(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}

fn images_in(dir: &Path, source: IconSource) -> Vec<IconDto> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter(|entry| !entry.file_name().to_string_lossy().starts_with('.'))
        .map(|entry| entry.path())
        .filter(|path| path.is_file() && is_supported_image(path))
        .map(|path| icon_dto(&path, source))
        .collect()
}

pub fn icon_dto(path: &Path, source: IconSource) -> IconDto {
    let name = path
        .file_stem()
        .map(|stem| stem.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned());
    IconDto {
        path: path.to_string_lossy().into_owned(),
        name,
        source,
        modified: file_version(path),
    }
}

/// 首次运行（自定义图标目录还不存在）时预建一个 default 分类，
/// 给用户一个起点。目录一旦存在就不再干预。
pub fn bootstrap_custom_dir(custom_root: &Path) -> Result<(), AppError> {
    if custom_root.exists() {
        return Ok(());
    }
    std::fs::create_dir_all(custom_root.join(DEFAULT_CATEGORY))
        .map_err(|error| AppError::io("无法创建自定义贴纸目录", error))
}

/// 把图片拷贝进自定义根目录下的分类子目录。同名覆盖，
/// 分类不存在时自动创建；返回逐个文件的结果，允许部分成功。
pub fn import_icons(
    custom_root: &Path,
    source_paths: &[String],
    category: &str,
) -> Result<ImportReport, AppError> {
    let category = if category.trim().is_empty() {
        DEFAULT_CATEGORY.to_string()
    } else {
        validate_folder_name(category)?
    };
    let directory = custom_root.join(&category);
    std::fs::create_dir_all(&directory).map_err(|error| AppError::io("无法创建分类目录", error))?;

    let mut imported = Vec::new();
    let mut failed = Vec::new();
    for raw in source_paths {
        let source = PathBuf::from(raw);
        let fail = |reason: &str| ImportFailure {
            path: raw.clone(),
            reason: reason.to_string(),
        };
        let file_name = source
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default();
        if file_name.is_empty() || file_name.starts_with('.') {
            failed.push(fail("invalid_name"));
            continue;
        }
        if !is_supported_image(&source) {
            failed.push(fail("unsupported_type"));
            continue;
        }
        if !source.is_file() {
            failed.push(fail("not_found"));
            continue;
        }
        let destination = directory.join(&file_name);
        let same_file = std::fs::canonicalize(&source).ok()
            == std::fs::canonicalize(&destination).ok()
            && source.exists();
        if !same_file {
            if destination.exists() {
                if let Err(error) = std::fs::remove_file(&destination) {
                    eprintln!("覆盖已有贴纸失败: {error}");
                    failed.push(fail("overwrite_failed"));
                    continue;
                }
            }
            if let Err(error) = std::fs::copy(&source, &destination) {
                eprintln!("拷贝贴纸失败: {error}");
                failed.push(fail("copy_failed"));
                continue;
            }
        }
        imported.push(icon_dto(&destination, IconSource::Custom));
    }

    Ok(ImportReport { imported, failed })
}

/// 把一个自定义分类目录（连同里面的图标）移入废纸篓。
pub fn delete_category(custom_root: &Path, name: &str) -> Result<(), AppError> {
    let name = validate_folder_name(name)?;
    let root = std::fs::canonicalize(custom_root)
        .map_err(|error| AppError::io("自定义贴纸目录不存在", error))?;
    let target = root.join(&name);
    let canonical =
        std::fs::canonicalize(&target).map_err(|error| AppError::io("分类不存在", error))?;
    if canonical.parent() != Some(root.as_path()) || !canonical.is_dir() {
        return Err(AppError::new("invalid_category", "分类路径不合法"));
    }
    trash::delete(&canonical).map_err(|error| AppError::new("trash_failed", error.to_string()))
}

/// 删除单个自定义图标（移入废纸篓，可恢复）。
pub fn delete_icon(custom_root: &Path, path: &Path) -> Result<(), AppError> {
    let root = std::fs::canonicalize(custom_root)
        .map_err(|error| AppError::io("自定义贴纸目录不存在", error))?;
    let canonical =
        std::fs::canonicalize(path).map_err(|error| AppError::io("图标不存在", error))?;
    let parent = canonical.parent();
    let direct_child = parent
        .and_then(|dir| dir.parent())
        .map(|dir| dir == root)
        .unwrap_or(false);
    if !direct_child || !canonical.is_file() || !is_supported_image(&canonical) {
        return Err(AppError::new("invalid_path", "只能删除自定义分类里的图片"));
    }
    trash::delete(&canonical).map_err(|error| AppError::new("trash_failed", error.to_string()))
}

pub fn create_category(custom_root: &Path, name: &str) -> Result<String, AppError> {
    let name = validate_folder_name(name)?;
    std::fs::create_dir_all(custom_root.join(&name))
        .map_err(|error| AppError::io("无法创建分类", error))?;
    Ok(name)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    struct Fixture {
        _temp: tempfile::TempDir,
        bundled: PathBuf,
        custom: PathBuf,
    }

    impl Fixture {
        fn new() -> Self {
            let temp = tempfile::tempdir().unwrap();
            let bundled = temp.path().join("bundled");
            let custom = temp.path().join("custom");
            fs::create_dir_all(&bundled).unwrap();
            fs::create_dir_all(&custom).unwrap();
            let fixture = Self {
                _temp: temp,
                bundled,
                custom,
            };
            fixture.write(&fixture.bundled.join("b.png"));
            fixture.write(&fixture.bundled.join("a.png"));
            fixture.write_text(&fixture.bundled.join("note.txt"));
            fs::create_dir_all(fixture.bundled.join("动物")).unwrap();
            fixture.write(&fixture.bundled.join("动物/c.png"));
            fixture
        }

        fn write(&self, path: &Path) {
            fs::write(path, b"not-a-real-png").unwrap();
        }

        fn write_text(&self, path: &Path) {
            fs::write(path, b"text").unwrap();
        }

        fn write_config(&self, dir: &Path, json: &str) {
            fs::create_dir_all(dir).unwrap();
            fs::write(dir.join("config.json"), json).unwrap();
        }

        fn library(&self) -> LibraryDto {
            scan_library(Some(&self.bundled), &self.custom)
        }

        fn bundled_category(&self, name: &str) -> Option<CategoryDto> {
            self.library().bundled.into_iter().find(|c| c.name == name)
        }

        fn custom_category(&self, name: &str) -> Option<CategoryDto> {
            self.library().custom.into_iter().find(|c| c.name == name)
        }
    }

    #[test]
    fn root_images_grouped_into_default_and_non_images_filtered() {
        let fixture = Fixture::new();
        let default = fixture.bundled_category("default").unwrap();
        let names: Vec<&str> = default.icons.iter().map(|i| i.name.as_str()).collect();
        assert_eq!(names, vec!["a", "b"]);
        assert!(default
            .icons
            .iter()
            .all(|i| i.source == IconSource::Bundled));
    }

    #[test]
    fn subdirectory_becomes_category() {
        let fixture = Fixture::new();
        let animals = fixture.bundled_category("动物").unwrap();
        assert_eq!(animals.icons.len(), 1);
        assert_eq!(animals.icons[0].name, "c");
    }

    #[test]
    fn category_order_priority_desc_then_name() {
        let fixture = Fixture::new();
        for (name, priority) in [("b", 5), ("a", 10), ("c", 10)] {
            let dir = fixture.custom.join(name);
            fixture.write_config(&dir, &format!("{{\"priority\": {priority}}}"));
        }
        let names: Vec<String> = fixture
            .library()
            .custom
            .into_iter()
            .map(|c| c.name)
            .collect();
        assert_eq!(names, vec!["a", "c", "b"]);
    }

    #[test]
    fn default_has_no_privilege() {
        let fixture = Fixture::new();
        // 无 config 时纯按本地化名称排序；default 只是普通分类
        let mut expected = vec!["动物".to_string(), DEFAULT_CATEGORY.to_string()];
        expected.sort_by(|a, b| localized_compare(a, b));
        let names: Vec<String> = fixture
            .library()
            .bundled
            .into_iter()
            .map(|c| c.name)
            .collect();
        assert_eq!(names, expected);
    }

    #[test]
    fn custom_default_subdirectory_merges_root_images_and_config() {
        let fixture = Fixture::new();
        fixture.write(&fixture.custom.join("x.png"));
        let dir = fixture.custom.join("default");
        fixture.write_config(&dir, r#"{"author":"作者","brandName":"官方"}"#);
        fixture.write(&dir.join("z.png"));
        let default = fixture.custom_category("default").unwrap();
        let names: Vec<&str> = default.icons.iter().map(|i| i.name.as_str()).collect();
        assert_eq!(names, vec!["x", "z"]);
        assert_eq!(default.config.author.as_deref(), Some("作者"));
        assert_eq!(default.config.brand_name.as_deref(), Some("官方"));
    }

    #[test]
    fn empty_custom_subdirectory_is_preserved() {
        let fixture = Fixture::new();
        fs::create_dir_all(fixture.custom.join("空分类")).unwrap();
        assert_eq!(fixture.custom_category("空分类").unwrap().icons.len(), 0);
    }

    #[test]
    fn bootstrap_creates_default_only_when_missing() {
        let temp = tempfile::tempdir().unwrap();
        let custom = temp.path().join("fresh");
        bootstrap_custom_dir(&custom).unwrap();
        assert!(custom.join("default").is_dir());
    }

    #[test]
    fn existing_empty_custom_dir_is_left_alone() {
        let fixture = Fixture::new();
        bootstrap_custom_dir(&fixture.custom).unwrap();
        assert!(fixture.library().custom.is_empty());
        assert!(!fixture.custom.join("default").exists());
    }

    #[test]
    fn import_creates_category_and_overwrites_same_name() {
        let fixture = Fixture::new();
        let source = fixture.bundled.join("a.png");
        let report = import_icons(
            &fixture.custom,
            &[source.to_string_lossy().into_owned()],
            "图标",
        )
        .unwrap();
        assert_eq!(report.imported.len(), 1);
        assert!(report.failed.is_empty());
        assert!(fixture.custom.join("图标/a.png").is_file());

        let report = import_icons(
            &fixture.custom,
            &[source.to_string_lossy().into_owned()],
            "图标",
        )
        .unwrap();
        assert_eq!(report.imported.len(), 1);
        assert_eq!(fixture.custom_category("图标").unwrap().icons.len(), 1);
    }

    #[test]
    fn import_reports_partial_failures() {
        let fixture = Fixture::new();
        let txt = fixture.bundled.join("note.txt");
        let png = fixture.bundled.join("a.png");
        let report = import_icons(
            &fixture.custom,
            &[
                txt.to_string_lossy().into_owned(),
                png.to_string_lossy().into_owned(),
            ],
            "图标",
        )
        .unwrap();
        assert_eq!(report.imported.len(), 1);
        assert_eq!(report.failed.len(), 1);
        assert_eq!(report.failed[0].reason, "unsupported_type");
    }

    #[test]
    fn import_rejects_bad_category_name() {
        let fixture = Fixture::new();
        let error = import_icons(&fixture.custom, &[], "../evil").unwrap_err();
        assert_eq!(error.code, "invalid_category");
    }

    #[test]
    fn delete_unknown_category_fails() {
        let fixture = Fixture::new();
        let error = delete_category(&fixture.custom, "不存在").unwrap_err();
        assert_eq!(error.code, "not_found");
    }

    #[test]
    fn create_category_is_idempotent() {
        let fixture = Fixture::new();
        assert_eq!(create_category(&fixture.custom, "旅行").unwrap(), "旅行");
        assert_eq!(create_category(&fixture.custom, "旅行").unwrap(), "旅行");
        assert!(fixture.custom.join("旅行").is_dir());
    }
}
