use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use image::ImageFormat;
use tauri::{AppHandle, Manager};

use super::blocking;
use crate::error::AppError;
use crate::macos::icons;
use crate::paths;
use crate::state::AppState;

/// 设计画布里的素材最长边。源贴纸多为 300~512px，
/// 压到 1024 既保留放大余量，也避免把整张原图塞进 IPC。
const ASSET_MAX_PX: u32 = 1024;
/// 1024×1024 PNG 通常不到 4MB；24MB 足够，同时挡住异常的超大 payload。
const MAX_DESIGN_DATA: usize = 24 * 1024 * 1024;
const DATA_URL_PREFIX: &str = "data:image/png;base64,";

/// 把贴纸库图片读成 canvas 可以直接使用的 PNG data URL。
/// 走 Rust 而不是 asset:// 是为了避免 WKWebView 的跨源限制污染画布。
#[tauri::command]
pub async fn design_asset(app: AppHandle, icon_path: String) -> Result<String, AppError> {
    let source = {
        let state = app.state::<AppState>();
        let icon = std::fs::canonicalize(&icon_path)
            .map_err(|error| AppError::io("贴纸文件不存在，可能已被移动或删除", error))?;
        if !icon.is_file() {
            return Err(AppError::new("invalid_path", "贴纸路径不是文件"));
        }
        if !paths::is_within_roots(&icon, &state.icon_roots()) {
            return Err(AppError::new("invalid_path", "只能使用贴纸库里的图片"));
        }
        icon
    };

    blocking(move || design_asset_data_url(&source)).await
}

/// 把设计画布导出的 PNG 写进缓存并设为文件夹图标。
/// 缓存按内容哈希命名，重复应用同一份设计不会堆积文件。
#[tauri::command]
pub async fn apply_design(
    app: AppHandle,
    png_data: String,
    folder_path: String,
) -> Result<(), AppError> {
    let (folder, cache_root) = {
        let state = app.state::<AppState>();
        let home = app.path().home_dir().unwrap_or_else(|_| paths::home_dir());
        let folder = paths::resolve_directory(&folder_path, &home)
            .ok_or_else(|| AppError::new("not_directory", "目标文件夹不存在或不是文件夹"))?;
        (folder, state.cache_root.clone())
    };

    let target = blocking(move || {
        let bytes = decode_design_png(&png_data)?;
        save_design_png(&cache_root, &bytes)
    })
    .await?;

    icons::apply_icon(&app, &target, &folder).await
}

fn design_asset_data_url(path: &Path) -> Result<String, AppError> {
    let image = image::ImageReader::open(path)
        .map_err(|error| AppError::io("无法读取贴纸图片", error))?
        .with_guessed_format()
        .map_err(|error| AppError::new("decode_failed", error.to_string()))?
        .decode()
        .map_err(|error| AppError::new("decode_failed", format!("无法解码贴纸图片：{error}")))?;

    let image = if image.width() > ASSET_MAX_PX || image.height() > ASSET_MAX_PX {
        image.thumbnail(ASSET_MAX_PX, ASSET_MAX_PX)
    } else {
        image
    };

    let mut png = Vec::new();
    image
        .write_to(&mut std::io::Cursor::new(&mut png), ImageFormat::Png)
        .map_err(|error| AppError::new("encode_failed", format!("无法编码贴纸图片：{error}")))?;

    Ok(format!("{DATA_URL_PREFIX}{}", BASE64.encode(png)))
}

fn decode_design_png(data: &str) -> Result<Vec<u8>, AppError> {
    if data.len() > MAX_DESIGN_DATA {
        return Err(AppError::new("design_too_large", "设计图文件过大"));
    }
    let raw = data.strip_prefix(DATA_URL_PREFIX).unwrap_or(data);
    if raw.is_empty() {
        return Err(AppError::new("invalid_design", "设计图为空"));
    }
    let bytes = BASE64
        .decode(raw)
        .map_err(|_| AppError::new("invalid_design", "设计图数据不完整"))?;
    if bytes.is_empty() {
        return Err(AppError::new("invalid_design", "设计图为空"));
    }
    let image = image::load_from_memory_with_format(&bytes, ImageFormat::Png)
        .map_err(|_| AppError::new("invalid_design", "设计图不是有效的 PNG"))?;
    if image.width() < 64 || image.height() < 64 {
        return Err(AppError::new("invalid_design", "设计图画布太小"));
    }
    Ok(bytes)
}

fn save_design_png(cache_root: &Path, bytes: &[u8]) -> Result<PathBuf, AppError> {
    let directory = cache_root.join("designs");
    std::fs::create_dir_all(&directory)
        .map_err(|error| AppError::io("无法创建设计缓存目录", error))?;
    let digest = blake3::hash(bytes).to_hex().to_string();
    let target = directory.join(format!("{digest}.png"));
    if target.is_file() {
        return Ok(target);
    }

    // 先写临时文件再原子重命名，避免并发读到半截 PNG
    let temp = directory.join(format!(".{digest}.{}.tmp", std::process::id()));
    std::fs::write(&temp, bytes).map_err(|error| AppError::io("无法写入设计图", error))?;
    std::fs::rename(&temp, &target).map_err(|error| AppError::io("无法保存设计图", error))?;
    Ok(target)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_png() -> Vec<u8> {
        let image = image::RgbaImage::from_pixel(128, 128, image::Rgba([255, 92, 56, 255]));
        let mut bytes = Vec::new();
        image
            .write_to(&mut std::io::Cursor::new(&mut bytes), ImageFormat::Png)
            .unwrap();
        bytes
    }

    #[test]
    fn design_asset_encodes_png_data_url() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("sticker.png");
        std::fs::write(&source, sample_png()).unwrap();

        let data_url = design_asset_data_url(&source).unwrap();
        assert!(data_url.starts_with(DATA_URL_PREFIX));
        assert!(decode_design_png(&data_url).unwrap().len() > 100);
    }

    #[test]
    fn decode_accepts_raw_base64_and_rejects_garbage() {
        let raw = BASE64.encode(sample_png());
        assert_eq!(decode_design_png(&raw).unwrap(), sample_png());
        assert_eq!(
            decode_design_png("data:image/png;base64,not-png")
                .unwrap_err()
                .code,
            "invalid_design"
        );
        assert_eq!(decode_design_png("").unwrap_err().code, "invalid_design");
    }

    #[test]
    fn saves_design_content_addressed() {
        let temp = tempfile::tempdir().unwrap();
        let bytes = sample_png();
        let first = save_design_png(temp.path(), &bytes).unwrap();
        let second = save_design_png(temp.path(), &bytes).unwrap();
        assert_eq!(first, second);
        assert!(first.is_file());
        assert_eq!(std::fs::read(&first).unwrap(), bytes);
    }
}
