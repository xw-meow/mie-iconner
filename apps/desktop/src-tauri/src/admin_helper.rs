use std::path::Path;

use serde::Deserialize;

use crate::apps;
use crate::macos::icons;

#[derive(Debug, Deserialize)]
struct Payload {
    action: String,
    app: String,
    icon: Option<String>,
    home: String,
}

/// 主程序入口最早处调用。只有带 `--admin-helper` 时才进入本流程，
/// 避免 root 启动 Tauri/GUI；正常启动返回 false。
pub fn run_if_requested() -> bool {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) != Some("--admin-helper") {
        return false;
    }

    let result = args
        .get(2)
        .ok_or_else(|| "缺少管理员 helper 参数".to_string())
        .and_then(|encoded| run_encoded(encoded));

    match result {
        Ok(()) => println!("ok"),
        Err(message) => {
            eprintln!("{message}");
            std::process::exit(1);
        }
    }
    true
}

fn run_encoded(encoded: &str) -> Result<(), String> {
    let bytes = decode_hex(encoded).ok_or_else(|| "管理员 helper 参数无效".to_string())?;
    let payload: Payload =
        serde_json::from_slice(&bytes).map_err(|error| format!("无法解析 helper 参数：{error}"))?;
    run_payload(payload)
}

fn run_payload(payload: Payload) -> Result<(), String> {
    let app =
        std::fs::canonicalize(&payload.app).map_err(|error| format!("找不到这个 App：{error}"))?;
    if !apps::is_app_path(&app, Path::new(&payload.home)) {
        return Err("目标不在标准应用目录中".to_string());
    }
    if apps::is_system_app(&app) {
        return Err("系统应用受 SIP 保护，无法修改".to_string());
    }

    match payload.action.as_str() {
        "apply" => {
            let icon = payload.icon.ok_or_else(|| "缺少贴纸路径".to_string())?;
            let icon =
                std::fs::canonicalize(&icon).map_err(|error| format!("找不到贴纸文件：{error}"))?;
            if !icon.is_file() {
                return Err("贴纸路径不是文件".to_string());
            }
            let result = icons::apply_icon_sync(&icon, &app).map_err(|error| error.message);
            cleanup_staged_icon(&icon);
            result
        }
        "restore" => icons::restore_icon_sync(&app).map_err(|error| error.message),
        _ => Err("未知的 helper 操作".to_string()),
    }
}

fn cleanup_staged_icon(icon: &Path) {
    let staged = icon
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.starts_with("mie-iconner-admin-"))
        .unwrap_or(false);
    if staged {
        let _ = std::fs::remove_file(icon);
    }
}

fn decode_hex(encoded: &str) -> Option<Vec<u8>> {
    if !encoded.len().is_multiple_of(2) {
        return None;
    }
    let mut bytes = Vec::with_capacity(encoded.len() / 2);
    for pair in encoded.as_bytes().chunks_exact(2) {
        let high = (pair[0] as char).to_digit(16)?;
        let low = (pair[1] as char).to_digit(16)?;
        bytes.push(((high << 4) | low) as u8);
    }
    Some(bytes)
}

/// 供调用方复用，保证 helper 参数格式一致。
pub fn encode_payload(app: &Path, icon: Option<&Path>, home: &Path, action: &str) -> String {
    use serde::Serialize;

    #[derive(Serialize)]
    struct PayloadRef<'a> {
        action: &'a str,
        app: String,
        icon: Option<String>,
        home: String,
    }

    let payload = PayloadRef {
        action,
        app: app.to_string_lossy().into_owned(),
        icon: icon.map(|path| path.to_string_lossy().into_owned()),
        home: home.to_string_lossy().into_owned(),
    };
    let bytes = serde_json::to_vec(&payload).expect("helper payload should serialize");
    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write;
        let _ = write!(encoded, "{byte:02x}");
    }
    encoded
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_roundtrip() {
        let encoded = encode_payload(
            Path::new("/Applications/Demo.app"),
            Some(Path::new("/tmp/icon.png")),
            Path::new("/Users/me"),
            "apply",
        );
        let bytes = decode_hex(&encoded).unwrap();
        let payload: Payload = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(payload.action, "apply");
        assert_eq!(payload.app, "/Applications/Demo.app");
        assert_eq!(payload.icon.as_deref(), Some("/tmp/icon.png"));
        assert_eq!(payload.home, "/Users/me");
    }
}
