use std::path::Path;
use std::process::Command;

use crate::admin_helper::encode_payload;
use crate::error::AppError;

const ADMIN_SCRIPT: &str = r#"on run argv
  do shell script quoted form of (item 1 of argv) & " --admin-helper " & quoted form of (item 2 of argv) with administrator privileges with prompt "小羊贴纸铺需要管理员权限来修改这个 App 的图标。"
end run"#;

pub fn apply_app_icon(app: &Path, icon: &Path, home: &Path) -> Result<(), AppError> {
    run_helper(&encode_payload(app, Some(icon), home, "apply"))
}

pub fn restore_app_icon(app: &Path, home: &Path) -> Result<(), AppError> {
    run_helper(&encode_payload(app, None, home, "restore"))
}

fn run_helper(encoded: &str) -> Result<(), AppError> {
    let executable =
        std::env::current_exe().map_err(|error| AppError::io("无法定位应用可执行文件", error))?;
    let output = Command::new("/usr/bin/osascript")
        .current_dir("/")
        .arg("-e")
        .arg(ADMIN_SCRIPT)
        .arg(executable)
        .arg(encoded)
        .output()
        .map_err(|error| AppError::io("无法启动管理员授权", error))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let normalized = stderr.to_lowercase();
    if normalized.contains("-128") || normalized.contains("cancel") || normalized.contains("取消")
    {
        return Err(AppError::new("authorization_cancelled", "已取消管理员授权"));
    }

    let message = stderr.trim();
    Err(AppError::new(
        "admin_helper_failed",
        if message.is_empty() {
            "管理员权限执行失败".to_string()
        } else {
            format!("管理员权限执行失败：{message}")
        },
    ))
}
