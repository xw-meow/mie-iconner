use std::path::Path;

use serde::Deserialize;

use crate::models::CategoryConfigDto;

/// config.json 的文件格式：字段全部可选，缺失或格式非法时整体回落默认值。
#[derive(Debug, Default, Deserialize)]
struct RawConfig {
    #[serde(default)]
    priority: i64,
    author: Option<String>,
    #[serde(rename = "author_url")]
    author_url: Option<String>,
    #[serde(rename = "brandName")]
    brand_name: Option<String>,
    #[serde(rename = "brandColor")]
    brand_color: Option<String>,
    #[serde(rename = "defaultExpanded")]
    default_expanded: Option<bool>,
}

pub fn parse(data: &[u8]) -> CategoryConfigDto {
    let Ok(raw) = serde_json::from_slice::<RawConfig>(data) else {
        return CategoryConfigDto::default();
    };
    CategoryConfigDto {
        priority: raw.priority,
        author: clean(raw.author),
        author_url: raw
            .author_url
            .map(|url| url.trim().to_string())
            .filter(|url| url.starts_with("https://") || url.starts_with("http://")),
        brand_name: clean(raw.brand_name),
        brand_color: raw
            .brand_color
            .map(|color| color.trim().to_string())
            .filter(|color| is_hex_color(color)),
        default_expanded: raw.default_expanded.unwrap_or(false),
    }
}

/// 读取分类文件夹下的 config.json；不存在或解析失败返回默认值。
pub fn load(category_dir: &Path) -> CategoryConfigDto {
    std::fs::read(category_dir.join("config.json"))
        .map(|data| parse(&data))
        .unwrap_or_default()
}

fn clean(value: Option<String>) -> Option<String> {
    value
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

fn is_hex_color(text: &str) -> bool {
    let hex = text.strip_prefix('#').unwrap_or(text);
    matches!(hex.len(), 3 | 6) && hex.chars().all(|c| c.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_all_fields() {
        let config = parse(
            r##"{
              "priority": 10,
              "author": "美少女壮士a",
              "author_url": "https://example.com/u/a",
              "brandName": "旺财",
              "brandColor": "#ff4d4f",
              "defaultExpanded": true
            }"##
            .as_bytes(),
        );
        assert_eq!(config.priority, 10);
        assert_eq!(config.author.as_deref(), Some("美少女壮士a"));
        assert_eq!(
            config.author_url.as_deref(),
            Some("https://example.com/u/a")
        );
        assert_eq!(config.brand_name.as_deref(), Some("旺财"));
        assert_eq!(config.brand_color.as_deref(), Some("#ff4d4f"));
        assert!(config.default_expanded);
    }

    #[test]
    fn missing_or_malformed_returns_defaults() {
        let config = parse(b"{ this is not json");
        assert_eq!(config.priority, 0);
        assert!(config.author.is_none());
        assert!(config.brand_name.is_none());
        assert!(!config.default_expanded);
    }

    #[test]
    fn partial_fields_keep_defaults() {
        let config = parse(r#"{"brandName":"热门"}"#.as_bytes());
        assert_eq!(config.priority, 0);
        assert_eq!(config.brand_name.as_deref(), Some("热门"));
        assert!(config.author.is_none());
        assert!(!config.default_expanded);
    }

    #[test]
    fn unsafe_author_url_and_bad_color_are_dropped() {
        let config = parse(r#"{"author_url":"javascript:alert(1)","brandColor":"red"}"#.as_bytes());
        assert!(config.author_url.is_none());
        assert!(config.brand_color.is_none());
    }

    #[test]
    fn blank_strings_become_none() {
        let config = parse(r#"{"author":"  ","brandName":""}"#.as_bytes());
        assert!(config.author.is_none());
        assert!(config.brand_name.is_none());
    }
}
