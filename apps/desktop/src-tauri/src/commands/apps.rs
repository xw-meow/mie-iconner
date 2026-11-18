use std::io::Write;
use std::os::unix::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

use super::blocking;
use crate::apps;
use crate::error::AppError;
use crate::macos::{icons, privileged};
use crate::models::AppDto;
use crate::paths;
use crate::state::AppState;

fn home_of(app: &AppHandle) -> PathBuf {
    app.path().home_dir().unwrap_or_else(|_| paths::home_dir())
}

/// 列出 /Applications、/System/Applications 与 ~/Applications 下的 .app。
#[tauri::command]
pub async fn list_apps(app: AppHandle) -> Result<Vec<AppDto>, AppError> {
    let home = home_of(&app);
    blocking(move || apps::list_apps(&home)).await
}

/// 把贴纸库里的图片写成 .app 的 Finder 自定义图标。
#[tauri::command]
pub async fn apply_app_icon(
    app: AppHandle,
    icon_path: String,
    app_path: String,
    admin: Option<bool>,
) -> Result<(), AppError> {
    let admin = admin.unwrap_or(false);
    let (icon, target, home) = {
        let state = app.state::<AppState>();
        let home = home_of(&app);
        let target = std::fs::canonicalize(&app_path)
            .map_err(|error| AppError::io("找不到这个 App", error))?;
        if !apps::is_app_path(&target, &home) {
            return Err(AppError::new("invalid_path", "这个路径不是已安装的 App"));
        }
        if apps::is_system_app(&target) {
            return Err(AppError::new(
                "permission_denied",
                "系统应用受 SIP 保护，无法修改",
            ));
        }
        if !admin && !apps::is_writable(&target) {
            return Err(AppError::new(
                "permission_denied",
                "这个 App 需要管理员权限，请使用管理员授权",
            ));
        }

        let icon = std::fs::canonicalize(&icon_path)
            .map_err(|error| AppError::io("贴纸文件不存在，可能已被移动或删除", error))?;
        if !icon.is_file() {
            return Err(AppError::new("invalid_path", "贴纸路径不是文件"));
        }
        if !paths::is_within_roots(&icon, &state.icon_roots()) {
            return Err(AppError::new("invalid_path", "只能使用贴纸库里的图片"));
        }
        (icon, target, home)
    };

    if admin {
        // 管理员 helper 由 osascript 以 root 启动，无法继承当前用户对
        // Desktop / Library 等受 TCC 保护目录的读取权限。先把图片复制到
        // /tmp 的 0600 临时文件，让 root helper 只读这个临时文件。
        let temp_icon = stage_admin_icon(&icon)?;
        let cleanup = temp_icon.clone();
        let result = blocking(move || privileged::apply_app_icon(&target, &temp_icon, &home)).await;
        let _ = std::fs::remove_file(&cleanup);
        result
    } else {
        icons::apply_icon(&app, &icon, &target).await
    }
}

/// 把贴纸复制到 root 可读的 /tmp 临时文件。文件名带 pid/时间戳，
/// 用 create_new + 0600 避免覆盖和他人读取。
fn stage_admin_icon(icon: &Path) -> Result<PathBuf, AppError> {
    let bytes = std::fs::read(icon).map_err(|error| AppError::io("无法读取贴纸图片", error))?;
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);

    for attempt in 0..8u32 {
        let path = PathBuf::from("/tmp").join(format!(
            "mie-iconner-admin-{}-{nanos}-{attempt}.img",
            std::process::id()
        ));
        match std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&path)
        {
            Ok(mut file) => {
                if let Err(error) = file.write_all(&bytes) {
                    let _ = std::fs::remove_file(&path);
                    return Err(AppError::io("无法准备管理员临时图片", error));
                }
                return Ok(path);
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(AppError::io("无法准备管理员临时图片", error));
            }
        }
    }
    Err(AppError::new(
        "temp_file_failed",
        "无法创建管理员临时图片，请重试",
    ))
}

/// 清空 App 的 Finder 自定义图标，恢复系统默认。
#[tauri::command]
pub async fn restore_app_icon(
    app: AppHandle,
    app_path: String,
    admin: Option<bool>,
) -> Result<(), AppError> {
    let admin = admin.unwrap_or(false);
    let home = home_of(&app);
    let target =
        std::fs::canonicalize(&app_path).map_err(|error| AppError::io("找不到这个 App", error))?;
    if !apps::is_app_path(&target, &home) {
        return Err(AppError::new("invalid_path", "这个路径不是已安装的 App"));
    }
    if apps::is_system_app(&target) {
        return Err(AppError::new(
            "permission_denied",
            "系统应用受 SIP 保护，无法修改",
        ));
    }
    if !admin && !apps::is_writable(&target) {
        return Err(AppError::new(
            "permission_denied",
            "这个 App 需要管理员权限，请使用管理员授权",
        ));
    }

    if admin {
        let target = target.clone();
        blocking(move || privileged::restore_app_icon(&target, &home)).await
    } else {
        icons::restore_icon(&app, &target).await
    }
}
