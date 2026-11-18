use std::io::Cursor;
use std::path::Path;

use image::ImageFormat;
use serde::Deserialize;

use crate::apps;
use crate::error::AppError;
use crate::macos::icons;

/// 缩略图最大边长（像素）。卡片展示 48~64pt，@2x 屏 128px；
/// 留到 192 兼顾应用栏预览与更高分辨率屏幕。
const THUMB_MAX_PX: u32 = 192;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThumbKind {
    /// 贴纸库里的普通图片文件
    Image,
    /// 文件夹的自定义图标（Icon\r 资源叉里的 icns）
    Folder,
    /// 已安装 App 的图标：优先自定义图标，否则读 bundle 里的 icns
    App,
}

impl ThumbKind {
    fn key(self) -> &'static str {
        match self {
            Self::Image => "image",
            Self::Folder => "folder",
            Self::App => "app",
        }
    }
}

/// 生成（或命中）一张缩略图，返回缓存文件的绝对路径。
/// 前端用 convertFileSrc 把它变成 asset:// URL，交给 WKWebView 缓存解码。
/// 缓存 key 含文件版本，原图被覆盖后天然失效，不需要手动清缓存。
pub fn thumbnail_path(
    cache_root: &Path,
    source: &Path,
    kind: ThumbKind,
    version: u64,
) -> Result<String, AppError> {
    let key = format!(
        "{}|{}|{}|{}",
        kind.key(),
        source.to_string_lossy(),
        version,
        THUMB_MAX_PX
    );
    let digest = blake3::hash(key.as_bytes()).to_hex().to_string();
    let directory = cache_root.join("thumbs");
    let target = directory.join(format!("{digest}.png"));
    if target.is_file() {
        return Ok(target.to_string_lossy().into_owned());
    }
    std::fs::create_dir_all(&directory)
        .map_err(|error| AppError::io("无法创建缩略图缓存目录", error))?;

    let image = match kind {
        ThumbKind::Image => load_image_file(source)?,
        ThumbKind::Folder => {
            let png = icons::custom_icon_png(source)
                .ok_or_else(|| AppError::new("no_custom_icon", "这个文件夹没有自定义图标"))?;
            image::load_from_memory_with_format(&png, ImageFormat::Png).map_err(|error| {
                AppError::new("decode_failed", format!("无法解压自定义图标：{error}"))
            })?
        }
        ThumbKind::App => {
            let png = apps::app_icon_png(source)
                .ok_or_else(|| AppError::new("no_app_icon", "这个 App 没有可读取的图标"))?;
            image::load_from_memory_with_format(&png, ImageFormat::Png).map_err(|error| {
                AppError::new("decode_failed", format!("无法解压 App 图标：{error}"))
            })?
        }
    };

    let thumbnail = image.resize(
        THUMB_MAX_PX,
        THUMB_MAX_PX,
        image::imageops::FilterType::Lanczos3,
    );
    let mut bytes = Vec::new();
    thumbnail
        .write_to(&mut Cursor::new(&mut bytes), ImageFormat::Png)
        .map_err(|error| AppError::new("encode_failed", format!("无法生成缩略图：{error}")))?;

    // 先写临时文件再原子重命名，避免并发读到写了一半的 PNG
    let temp = directory.join(format!(".{digest}.{}.tmp", std::process::id()));
    std::fs::write(&temp, &bytes).map_err(|error| AppError::io("无法写入缩略图", error))?;
    std::fs::rename(&temp, &target).map_err(|error| AppError::io("无法保存缩略图", error))?;
    Ok(target.to_string_lossy().into_owned())
}

fn load_image_file(path: &Path) -> Result<image::DynamicImage, AppError> {
    let reader = image::ImageReader::open(path)
        .map_err(|error| AppError::io("无法读取图片", error))?
        .with_guessed_format()
        .map_err(|error| AppError::new("decode_failed", error.to_string()))?;
    reader
        .decode()
        .map_err(|error| AppError::new("decode_failed", format!("无法解码图片：{error}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_png(path: &Path) {
        let image = image::RgbaImage::from_pixel(64, 64, image::Rgba([255, 92, 56, 255]));
        image.save_with_format(path, ImageFormat::Png).unwrap();
    }

    #[test]
    fn generates_and_reuses_cached_thumbnail() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("sticker.png");
        write_png(&source);
        let cache = temp.path().join("cache");

        let first = thumbnail_path(&cache, &source, ThumbKind::Image, 1).unwrap();
        assert!(Path::new(&first).is_file());
        let bytes = std::fs::read(&first).unwrap();
        let decoded = image::load_from_memory(&bytes).unwrap();
        assert!(decoded.width() <= THUMB_MAX_PX);

        // 同一版本再次请求命中缓存（文件内容不变，路径一致）
        let second = thumbnail_path(&cache, &source, ThumbKind::Image, 1).unwrap();
        assert_eq!(first, second);
    }

    #[test]
    fn folder_without_custom_icon_errors() {
        let temp = tempfile::tempdir().unwrap();
        let folder = temp.path().join("Folder");
        std::fs::create_dir(&folder).unwrap();
        let error = thumbnail_path(temp.path(), &folder, ThumbKind::Folder, 0).unwrap_err();
        assert_eq!(error.code, "no_custom_icon");
    }
}
