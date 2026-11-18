use std::path::Path;
use std::time::UNIX_EPOCH;

use crate::error::AppError;
use crate::macos::icons;
use crate::models::FolderDto;
use crate::text::localized_compare;

/// 文件版本：mtime 毫秒 + 长度的混合，用作前端缩略图缓存 key。
/// 毫秒级 mtime 在同一秒内覆盖时可能不变，混入长度能进一步降低碰撞。
pub fn file_version(path: &Path) -> u64 {
    let Ok(metadata) = std::fs::metadata(path) else {
        return 0;
    };
    let millis = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);
    millis
        .rotate_left(17)
        .wrapping_add(metadata.len().rotate_left(1))
        .wrapping_add(0x9E37_79B9_7F4A_7C15)
}

/// 列出目录下可见的子文件夹。跳过隐藏项与普通文件，
/// 自定义图标走 FinderInfo 位判断，和访达实际渲染保持一致。
pub fn list_folders(path: &Path) -> Result<Vec<FolderDto>, AppError> {
    let canonical =
        std::fs::canonicalize(path).map_err(|error| AppError::io("无法访问该文件夹", error))?;
    if !canonical.is_dir() {
        return Err(AppError::new("not_directory", "这个路径不是文件夹"));
    }

    let entries =
        std::fs::read_dir(&canonical).map_err(|error| AppError::io("无法读取该文件夹", error))?;

    let mut folders = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let child = entry.path();
        let Ok(metadata) = std::fs::metadata(&child) else {
            continue;
        };
        if !metadata.is_dir() {
            continue;
        }
        let has_custom_icon = icons::has_custom_icon(&child);
        let icon_modified = has_custom_icon.then(|| file_version(&child.join("Icon\r")));
        folders.push(FolderDto {
            path: child.to_string_lossy().into_owned(),
            name,
            has_custom_icon,
            icon_modified,
        });
    }

    folders.sort_by(|a, b| localized_compare(&a.name, &b.name));
    Ok(folders)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    #[test]
    fn lists_only_visible_directories_sorted() {
        let temp = tempfile::tempdir().unwrap();
        for dir in ["b_dir", "a_dir", ".hidden_dir", "c_dir/inner"] {
            fs::create_dir_all(temp.path().join(dir)).unwrap();
        }
        fs::write(temp.path().join("file.txt"), "x").unwrap();
        fs::write(temp.path().join(".hidden_file"), "x").unwrap();

        let folders = list_folders(temp.path()).unwrap();
        let names: Vec<&str> = folders.iter().map(|f| f.name.as_str()).collect();
        assert_eq!(names, vec!["a_dir", "b_dir", "c_dir"]);
        assert!(folders.iter().all(|f| !f.has_custom_icon));
    }

    #[test]
    fn missing_directory_returns_error() {
        let temp = tempfile::tempdir().unwrap();
        let result = list_folders(&temp.path().join("nope"));
        assert!(result.is_err());
    }

    #[test]
    fn file_path_is_not_a_directory() {
        let temp = tempfile::tempdir().unwrap();
        let file = temp.path().join("note.txt");
        fs::write(&file, "x").unwrap();
        let error = list_folders(&file).unwrap_err();
        assert_eq!(error.code, "not_directory");
    }
}
