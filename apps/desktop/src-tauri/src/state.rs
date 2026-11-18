use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::error::AppError;
use crate::library;

/// 应用级只读路径与版本信息。所有命令都从这里取根目录，
/// 不在各处重复拼路径。
pub struct AppState {
    pub bundled_root: Option<PathBuf>,
    pub custom_root: PathBuf,
    pub cache_root: PathBuf,
    pub version: String,
}

impl AppState {
    pub fn create(app: &AppHandle) -> Result<Self, AppError> {
        let bundled_root = bundled_root(app);
        let data_dir = app
            .path()
            .data_dir()
            .map_err(|error| AppError::new("path_error", error.to_string()))?;
        // 与旧版 Swift 应用保持同一位置，老用户的自定义贴纸无缝迁移
        let custom_root = data_dir.join("mie-iconner").join("CustomIcons");
        let cache_root = app
            .path()
            .app_cache_dir()
            .map_err(|error| AppError::new("path_error", error.to_string()))?;

        Ok(Self {
            bundled_root,
            custom_root,
            cache_root,
            version: app.package_info().version.to_string(),
        })
    }

    pub fn ensure_directories(&self) {
        if let Err(error) = library::bootstrap_custom_dir(&self.custom_root) {
            eprintln!("初始化自定义贴纸目录失败：{error}");
        }
        if let Err(error) = std::fs::create_dir_all(&self.cache_root) {
            eprintln!("初始化缓存目录失败：{error}");
        }
    }

    /// 允许读取/写入贴纸的根目录，用于命令层的路径边界校验。
    pub fn icon_roots(&self) -> Vec<&Path> {
        let mut roots = Vec::with_capacity(2);
        if let Some(bundled) = self.bundled_root.as_deref() {
            roots.push(bundled);
        }
        roots.push(self.custom_root.as_path());
        roots
    }
}

fn bundled_root(app: &AppHandle) -> Option<PathBuf> {
    if cfg!(debug_assertions) {
        let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("bundled-icons");
        if dev.is_dir() {
            return Some(dev);
        }
    }
    let bundled = app.path().resource_dir().ok()?.join("bundled-icons");
    bundled.is_dir().then_some(bundled)
}
