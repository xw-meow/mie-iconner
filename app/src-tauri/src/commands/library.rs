use tauri::State;

use super::blocking;
use crate::error::AppError;
use crate::library;
use crate::models::{ImportReport, LibraryDto};
use crate::state::AppState;

#[tauri::command]
pub async fn list_library(state: State<'_, AppState>) -> Result<LibraryDto, AppError> {
    let bundled = state.bundled_root.clone();
    let custom = state.custom_root.clone();
    blocking(move || Ok(library::scan_library(bundled.as_deref(), &custom))).await
}

#[tauri::command]
pub async fn import_icons(
    state: State<'_, AppState>,
    paths: Vec<String>,
    category: String,
) -> Result<ImportReport, AppError> {
    let custom = state.custom_root.clone();
    blocking(move || library::import_icons(&custom, &paths, &category)).await
}

#[tauri::command]
pub async fn create_category(state: State<'_, AppState>, name: String) -> Result<String, AppError> {
    let custom = state.custom_root.clone();
    blocking(move || library::create_category(&custom, &name)).await
}

#[tauri::command]
pub async fn delete_icon(state: State<'_, AppState>, path: String) -> Result<(), AppError> {
    let custom = state.custom_root.clone();
    blocking(move || library::delete_icon(&custom, std::path::Path::new(&path))).await
}

#[tauri::command]
pub async fn delete_category(state: State<'_, AppState>, name: String) -> Result<(), AppError> {
    let custom = state.custom_root.clone();
    blocking(move || library::delete_category(&custom, &name)).await
}
