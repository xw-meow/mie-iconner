use std::path::Path;
use std::process::Command;
use std::time::Duration;

use objc2::AnyThread;
use tauri::AppHandle;

use super::run_on_main;
use super::xattr;
use crate::error::AppError;

const FINDER_INFO: &str = "com.apple.FinderInfo";
const RESOURCE_FORK: &str = "com.apple.ResourceFork";

/// FinderInfo 第 8 字节（大端标志位高字节）的 0x04 位 = kHasCustomIcon。
/// 没置位时即使存在 Icon\r，访达也不显示自定义图标，app 保持一致。
pub fn has_custom_icon(folder: &Path) -> bool {
    let Some(info) = xattr::read(folder, FINDER_INFO) else {
        return false;
    };
    info.len() >= 9 && info[8] & 0x04 != 0
}

/// 读取文件夹自定义图标里的 icns，并挑出像素最大的 PNG 元素。
/// 直接解析磁盘上的 Icon\r 资源叉，绕开 iconservices 缓存，
/// 保证 app 内看到的和桌面一致。
pub fn custom_icon_png(folder: &Path) -> Option<Vec<u8>> {
    if !has_custom_icon(folder) {
        return None;
    }
    let icon_file = folder.join("Icon\r");
    let fork = xattr::read(&icon_file, RESOURCE_FORK)?;
    let icns = extract_icns(&fork)?;
    largest_png_element(&icns)
}

/// 资源叉布局：头部 16 字节（数据区/映射区偏移）→ 映射区 24 字节处
/// 是类型表偏移 → 类型表中找 'icns' 条目，其引用项给出数据区偏移；
/// 数据区每项为 4 字节长度 + 内容。
pub fn extract_icns(rsrc: &[u8]) -> Option<Vec<u8>> {
    let data_area = be32(rsrc, 0)?;
    let map_area = be32(rsrc, 4)?;
    let type_list_offset = be16(rsrc, map_area + 24)?;
    let type_list = map_area + type_list_offset;
    let type_count = be16(rsrc, type_list)?.checked_add(1)?;

    for index in 0..type_count {
        let entry = type_list + 2 + index * 8;
        if entry + 8 > rsrc.len() || &rsrc[entry..entry + 4] != b"icns" {
            continue;
        }
        let ref_offset = be16(rsrc, entry + 6)?;
        let reference = type_list + ref_offset;
        // 引用项：ID(2) 名称(2) 属性(1) 数据偏移(3) 保留(4)
        let raw_offset = be32(rsrc, reference + 4)?;
        let data_offset = data_area + (raw_offset & 0x00FF_FFFF);
        let length = be32(rsrc, data_offset)?;
        let start = data_offset + 4;
        let end = start.checked_add(length)?;
        if end > rsrc.len() {
            return None;
        }
        return Some(rsrc[start..end].to_vec());
    }
    None
}

/// icns 各尺寸变体内容可能不同（历史 bug 曾造成 128px 是贴纸、
/// 1024px 是默认文件夹图的混装文件），按像素宽度挑最大的，与
/// Finder 的渲染选择一致。
pub fn largest_png_element(icns: &[u8]) -> Option<Vec<u8>> {
    if icns.len() < 8 || &icns[0..4] != b"icns" {
        return None;
    }
    let mut offset = 8usize;
    let mut best: Option<(usize, Vec<u8>)> = None;
    while offset + 8 <= icns.len() {
        let element_length = be32(icns, offset + 4)?;
        if element_length < 8 || offset + element_length > icns.len() {
            break;
        }
        let payload = &icns[offset + 8..offset + element_length];
        if payload.len() >= 24
            && payload[0..8] == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
            && &payload[12..16] == b"IHDR"
        {
            if let Some(width) = be32(payload, 16) {
                if width > best.as_ref().map(|(width, _)| *width).unwrap_or(0) {
                    best = Some((width, payload.to_vec()));
                }
            }
        }
        offset += element_length;
    }
    best.map(|(_, payload)| payload)
}

fn be16(data: &[u8], offset: usize) -> Option<usize> {
    let bytes = data.get(offset..offset + 2)?;
    Some(usize::from(u16::from_be_bytes([bytes[0], bytes[1]])))
}

fn be32(data: &[u8], offset: usize) -> Option<usize> {
    let bytes = data.get(offset..offset + 4)?;
    Some(u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as usize)
}

/// 写入自定义图标。两步写：先删再写——已有自定义图标时覆盖写不会被
/// Finder 桌面采纳（实测旧图标可停留一小时以上），先 setIcon(nil)
/// 强制系统注销旧图标，间隔 0.3s 再写入才是全新注册。
pub async fn apply_icon(app: &AppHandle, icon_path: &Path, folder: &Path) -> Result<(), AppError> {
    // 先确认图片可解码，避免删掉旧图标后才发现文件损坏
    image::ImageReader::open(icon_path)
        .map_err(|error| AppError::io("无法读取贴纸图片", error))?
        .with_guessed_format()
        .map_err(|error| AppError::new("unsupported_type", error.to_string()))?
        .into_dimensions()
        .map_err(|error| AppError::new("unsupported_type", format!("无法识别图片格式：{error}")))?;

    let folder_path = folder.to_string_lossy().into_owned();
    let icon_bytes =
        std::fs::read(icon_path).map_err(|error| AppError::io("无法读取贴纸图片", error))?;

    run_on_main(app, {
        let folder = folder_path.clone();
        move || -> bool {
            let workspace = objc2_app_kit::NSWorkspace::sharedWorkspace();
            let path = objc2_foundation::NSString::from_str(&folder);
            workspace.setIcon_forFile_options(
                None,
                &path,
                objc2_app_kit::NSWorkspaceIconCreationOptions::empty(),
            )
        }
    })
    .await?;

    tokio::time::sleep(Duration::from_millis(300)).await;

    let written = run_on_main(app, {
        let folder = folder_path.clone();
        let bytes = icon_bytes.clone();
        move || -> bool {
            let workspace = objc2_app_kit::NSWorkspace::sharedWorkspace();
            let folder_ns = objc2_foundation::NSString::from_str(&folder);
            let data = objc2_foundation::NSData::from_vec(bytes);
            let Some(image) =
                objc2_app_kit::NSImage::initWithData(objc2_app_kit::NSImage::alloc(), &data)
            else {
                return false;
            };
            let ok = workspace.setIcon_forFile_options(
                Some(&image),
                &folder_ns,
                objc2_app_kit::NSWorkspaceIconCreationOptions::empty(),
            );
            if ok {
                notify_workspace(&folder);
            }
            ok
        }
    })
    .await?;

    if written {
        Ok(())
    } else {
        Err(AppError::new(
            "apply_failed",
            "写入图标失败，请检查该文件夹的访问权限",
        ))
    }
}

/// 还原系统默认图标（清空自定义图标）。
pub async fn restore_icon(app: &AppHandle, folder: &Path) -> Result<(), AppError> {
    let folder_path = folder.to_string_lossy().into_owned();
    let cleared = run_on_main(app, {
        let folder = folder_path.clone();
        move || -> bool {
            let workspace = objc2_app_kit::NSWorkspace::sharedWorkspace();
            let path = objc2_foundation::NSString::from_str(&folder);
            let ok = workspace.setIcon_forFile_options(
                None,
                &path,
                objc2_app_kit::NSWorkspaceIconCreationOptions::empty(),
            );
            if ok {
                notify_workspace(&folder);
            }
            ok
        }
    })
    .await?;

    if cleared {
        Ok(())
    } else {
        Err(AppError::new(
            "restore_failed",
            "还原失败，请检查该文件夹的访问权限",
        ))
    }
}

/// 轻量文件系统通知：大多数情况下访达会自己跟上；
/// 极端情况下用「刷新桌面」重启 Finder 强刷。
fn notify_workspace(folder: &str) {
    let workspace = objc2_app_kit::NSWorkspace::sharedWorkspace();
    workspace.noteFileSystemChanged_(&objc2_foundation::NSString::from_str(folder));
    if let Some(parent) = Path::new(folder).parent() {
        let parent = parent.to_string_lossy();
        workspace.noteFileSystemChanged_(&objc2_foundation::NSString::from_str(&parent));
    }
}

/// 重启 Finder 强刷桌面图标缓存。由 launchd 自动拉起，重绘时
/// 从磁盘重新读取图标；代价是已打开的 Finder 窗口会关闭。
pub fn restart_finder() -> Result<(), AppError> {
    Command::new("/usr/bin/killall")
        .arg("Finder")
        .status()
        .map_err(|error| AppError::io("无法重启 Finder", error))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn png_element(kind: &str, width: u32) -> Vec<u8> {
        let mut payload = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        payload.extend_from_slice(&13u32.to_be_bytes());
        payload.extend_from_slice(b"IHDR");
        payload.extend_from_slice(&width.to_be_bytes());
        payload.extend_from_slice(&[0; 9]);
        let mut element = kind.as_bytes().to_vec();
        element.extend_from_slice(&((payload.len() + 8) as u32).to_be_bytes());
        element.extend_from_slice(&payload);
        element
    }

    fn icns_with(elements: &[Vec<u8>]) -> Vec<u8> {
        let total: usize = 8 + elements.iter().map(Vec::len).sum::<usize>();
        let mut icns = b"icns".to_vec();
        icns.extend_from_slice(&(total as u32).to_be_bytes());
        for element in elements {
            icns.extend_from_slice(element);
        }
        icns
    }

    fn resource_fork_with(payload: &[u8]) -> Vec<u8> {
        let mut rsrc = vec![0u8; 256];
        let data_area = 16usize;
        let map_area = data_area + 4 + payload.len();
        let put32 = |buf: &mut Vec<u8>, offset: usize, value: usize| {
            buf[offset..offset + 4].copy_from_slice(&(value as u32).to_be_bytes());
        };
        let put16 = |buf: &mut Vec<u8>, offset: usize, value: usize| {
            buf[offset..offset + 2].copy_from_slice(&(value as u16).to_be_bytes());
        };
        put32(&mut rsrc, 0, data_area);
        put32(&mut rsrc, 4, map_area);
        put32(&mut rsrc, 8, 4 + payload.len());
        put32(&mut rsrc, 12, 128);
        put32(&mut rsrc, data_area, payload.len());
        rsrc[data_area + 4..data_area + 4 + payload.len()].copy_from_slice(payload);
        put16(&mut rsrc, map_area + 24, 28);
        let type_list = map_area + 28;
        put16(&mut rsrc, type_list, 0);
        rsrc[type_list + 2..type_list + 6].copy_from_slice(b"icns");
        put16(&mut rsrc, type_list + 6, 0);
        put16(&mut rsrc, type_list + 8, 10);
        let reference = type_list + 10;
        put16(&mut rsrc, reference, 128);
        put16(&mut rsrc, reference + 2, 0xFFFF);
        rsrc[reference + 4..reference + 8].copy_from_slice(&[0, 0, 0, 0]);
        rsrc
    }

    #[test]
    fn extract_icns_returns_embedded_data() {
        let payload = b"icns-fake-content".to_vec();
        let rsrc = resource_fork_with(&payload);
        assert_eq!(extract_icns(&rsrc).unwrap(), payload);
    }

    #[test]
    fn extract_icns_rejects_garbage() {
        assert!(extract_icns(&[]).is_none());
        assert!(extract_icns(&[0xFF; 64]).is_none());
    }

    #[test]
    fn largest_png_element_picks_biggest() {
        let small = png_element("ic07", 128);
        let large = png_element("ic10", 1024);
        let icns = icns_with(&[small, large]);
        let picked = largest_png_element(&icns).unwrap();
        let width = u32::from_be_bytes([picked[16], picked[17], picked[18], picked[19]]);
        assert_eq!(width, 1024);
    }

    #[test]
    fn largest_png_element_ignores_non_png() {
        let mut element = b"icnV".to_vec();
        element.extend_from_slice(&16u32.to_be_bytes());
        element.extend_from_slice(&[0; 8]);
        let icns = icns_with(&[element]);
        assert!(largest_png_element(&icns).is_none());
    }

    #[test]
    fn finder_info_custom_icon_bit() {
        let temp = tempfile::tempdir().unwrap();
        let folder = temp.path().join("Folder");
        std::fs::create_dir(&folder).unwrap();
        assert!(!has_custom_icon(&folder));

        let mut info = vec![0u8; 32];
        info[8] = 0x04;
        assert!(xattr::write(&folder, FINDER_INFO, &info));
        assert!(has_custom_icon(&folder));

        info[8] = 0;
        assert!(xattr::write(&folder, FINDER_INFO, &info));
        assert!(!has_custom_icon(&folder));
    }

    /// 真实写入一次 NSWorkspace 图标再读回，手工验证 apply 链路。
    /// 不在 CI 跑（需要 AppKit 主线程环境，且会碰临时目录的 Finder 元数据）。
    #[test]
    #[ignore]
    fn real_apply_and_restore_roundtrip() {
        use objc2::AnyThread;

        let temp = tempfile::tempdir().unwrap();
        let folder = temp.path().join("Folder");
        std::fs::create_dir(&folder).unwrap();
        let icon_path =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/bundled-icons/默认/狐狸秘书.png");
        let bytes = std::fs::read(icon_path).unwrap();

        objc2::rc::autoreleasepool(|_| {
            let workspace = objc2_app_kit::NSWorkspace::sharedWorkspace();
            let folder_ns = objc2_foundation::NSString::from_str(&folder.to_string_lossy());
            let data = objc2_foundation::NSData::from_vec(bytes);
            let image =
                objc2_app_kit::NSImage::initWithData(objc2_app_kit::NSImage::alloc(), &data)
                    .expect("icon should decode");

            assert!(workspace.setIcon_forFile_options(
                None,
                &folder_ns,
                objc2_app_kit::NSWorkspaceIconCreationOptions::empty()
            ));
            std::thread::sleep(Duration::from_millis(320));
            assert!(workspace.setIcon_forFile_options(
                Some(&image),
                &folder_ns,
                objc2_app_kit::NSWorkspaceIconCreationOptions::empty()
            ));
            std::thread::sleep(Duration::from_millis(320));

            assert!(has_custom_icon(&folder));
            assert!(custom_icon_png(&folder).is_some());

            assert!(workspace.setIcon_forFile_options(
                None,
                &folder_ns,
                objc2_app_kit::NSWorkspaceIconCreationOptions::empty()
            ));
            std::thread::sleep(Duration::from_millis(320));
            assert!(!has_custom_icon(&folder));
        });
    }

    #[test]
    fn custom_icon_png_reads_icon_resource_fork() {
        let temp = tempfile::tempdir().unwrap();
        let folder = temp.path().join("Folder");
        std::fs::create_dir(&folder).unwrap();

        let png = png_element("ic07", 32);
        let icns = icns_with(std::slice::from_ref(&png));
        let rsrc = resource_fork_with(&icns);
        let icon_file = folder.join("Icon\r");
        std::fs::write(&icon_file, b"").unwrap();
        assert!(xattr::write(&icon_file, RESOURCE_FORK, &rsrc));
        let mut info = vec![0u8; 32];
        info[8] = 0x04;
        assert!(xattr::write(&folder, FINDER_INFO, &info));

        assert_eq!(custom_icon_png(&folder).unwrap(), png[8..].to_vec());
    }
}
