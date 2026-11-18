use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, State};

use super::blocking;
use crate::apps;
use crate::error::AppError;
use crate::macos::icons;
use crate::paths;
use crate::state::AppState;
use crate::thumbnails::{self, ThumbKind};

#[tauri::command]
pub async fn apply_icon(
    app: AppHandle,
    icon_path: String,
    folder_path: String,
) -> Result<(), AppError> {
    let (icon, folder) = {
        let state = app.state::<AppState>();
        let home = app.path().home_dir().unwrap_or_else(|_| paths::home_dir());
        let folder = paths::resolve_directory(&folder_path, &home)
            .ok_or_else(|| AppError::new("not_directory", "目标文件夹不存在或不是文件夹"))?;
        let icon = std::fs::canonicalize(&icon_path)
            .map_err(|error| AppError::io("贴纸文件不存在，可能已被移动或删除", error))?;
        if !icon.is_file() {
            return Err(AppError::new("invalid_path", "贴纸路径不是文件"));
        }
        if !paths::is_within_roots(&icon, &state.icon_roots()) {
            return Err(AppError::new("invalid_path", "只能使用贴纸库里的图片"));
        }
        (icon, folder)
    };

    icons::apply_icon(&app, &icon, &folder).await
}

#[tauri::command]
pub async fn restore_icon(app: AppHandle, folder_path: String) -> Result<(), AppError> {
    let folder = {
        let home = app.path().home_dir().unwrap_or_else(|_| paths::home_dir());
        paths::resolve_directory(&folder_path, &home)
            .ok_or_else(|| AppError::new("not_directory", "目标文件夹不存在或不是文件夹"))?
    };
    icons::restore_icon(&app, &folder).await
}

/// 返回缩略图缓存文件的绝对路径，前端用 convertFileSrc 加载。
#[tauri::command]
pub async fn thumbnail(
    state: State<'_, AppState>,
    path: String,
    kind: ThumbKind,
    version: u64,
) -> Result<String, AppError> {
    let cache = state.cache_root.clone();
    let roots: Vec<PathBuf> = state
        .icon_roots()
        .into_iter()
        .map(Path::to_path_buf)
        .collect();
    let source = PathBuf::from(&path);

    if matches!(kind, ThumbKind::Image)
        && !paths::is_within_roots(
            &source,
            &roots.iter().map(PathBuf::as_path).collect::<Vec<_>>(),
        )
    {
        return Err(AppError::new("invalid_path", "缩略图路径不在贴纸库中"));
    }
    if matches!(kind, ThumbKind::App) && !apps::is_app_path(&source, &paths::home_dir()) {
        return Err(AppError::new("invalid_path", "缩略图路径不是已安装的 App"));
    }

    blocking(move || thumbnails::thumbnail_path(&cache, &source, kind, version)).await
}
