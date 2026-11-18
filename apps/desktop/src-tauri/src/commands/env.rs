use std::path::PathBuf;

use tauri::{AppHandle, Manager, State};

use super::blocking;
use crate::error::AppError;
use crate::models::{EnvDto, PathSuggestionDto, ResolvedPathDto};
use crate::paths;
use crate::state::AppState;
use crate::suggest;

fn home_of(app: &AppHandle) -> PathBuf {
    app.path().home_dir().unwrap_or_else(|_| paths::home_dir())
}

#[tauri::command]
pub fn get_env(app: AppHandle, state: State<'_, AppState>) -> EnvDto {
    let home = home_of(&app);
    let desktop = app
        .path()
        .desktop_dir()
        .ok()
        .filter(|path| path.is_dir())
        .unwrap_or_else(|| home.clone());
    EnvDto {
        home: home.to_string_lossy().into_owned(),
        desktop: desktop.to_string_lossy().into_owned(),
        version: state.version.clone(),
        custom_icons_dir: state.custom_root.to_string_lossy().into_owned(),
    }
}

/// 校验地址栏输入；无效时返回 null，由前端做抖动与错误态。
#[tauri::command]
pub fn resolve_path(app: AppHandle, input: String) -> Option<ResolvedPathDto> {
    let home = home_of(&app);
    paths::resolve_directory(&input, &home).map(|path| paths::resolved_dto(path, &home))
}

#[tauri::command]
pub async fn suggest_paths(
    app: AppHandle,
    input: String,
    limit: Option<usize>,
) -> Result<Vec<PathSuggestionDto>, AppError> {
    let home = home_of(&app);
    blocking(move || Ok(suggest::suggestions_in(&input, &home, limit.unwrap_or(8)))).await
}
