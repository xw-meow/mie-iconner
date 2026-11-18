use std::path::Path;

use crate::error::AppError;
use crate::folder;
use crate::macos::icons;
use crate::models::FolderDto;

use super::blocking;

#[tauri::command]
pub async fn list_folders(path: String) -> Result<Vec<FolderDto>, AppError> {
    blocking(move || folder::list_folders(Path::new(&path))).await
}

/// 重启 Finder 强刷桌面图标缓存。由前端二次确认后调用。
#[tauri::command]
pub async fn restart_finder() -> Result<(), AppError> {
    blocking(icons::restart_finder).await
}
