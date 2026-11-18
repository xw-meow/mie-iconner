use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum IconSource {
    Bundled,
    Custom,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IconDto {
    /// 绝对路径，同时作为前端列表与选中态的唯一 id
    pub path: String,
    /// 不含扩展名的显示名
    pub name: String,
    pub source: IconSource,
    /// 文件 mtime（毫秒）。前端把它编进缩略图 query key，
    /// 图片被覆盖后缓存会自动失效
    pub modified: u64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryConfigDto {
    pub priority: i64,
    pub author: Option<String>,
    pub author_url: Option<String>,
    pub brand_name: Option<String>,
    pub brand_color: Option<String>,
    pub default_expanded: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryDto {
    pub name: String,
    pub icons: Vec<IconDto>,
    pub config: CategoryConfigDto,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryDto {
    pub bundled: Vec<CategoryDto>,
    pub custom: Vec<CategoryDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderDto {
    pub path: String,
    pub name: String,
    /// 是否带 Finder 自定义图标（FinderInfo 的 kHasCustomIcon 位）
    pub has_custom_icon: bool,
    /// Icon\r 的版本号；用作前端缩略图 query key，应用图标后自动失效
    pub icon_modified: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathSuggestionDto {
    pub path: String,
    pub name: String,
    /// 家目录缩写为 ~ 的展示路径
    pub display: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedPathDto {
    pub path: String,
    pub name: String,
    pub display: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvDto {
    pub home: String,
    pub desktop: String,
    pub version: String,
    pub custom_icons_dir: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportFailure {
    pub path: String,
    /// 稳定错误码，前端负责翻译
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub imported: Vec<IconDto>,
    pub failed: Vec<ImportFailure>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppDto {
    pub path: String,
    pub name: String,
    pub bundle_id: Option<String>,
    /// Finder 自定义图标（和应用本身自带的图标区分）
    pub has_custom_icon: bool,
    /// 用作前端缩略图缓存 key；默认图标取 .app 的版本，自定义图标取 Icon\r 的版本
    pub icon_modified: u64,
    /// 当前用户是否能写入这个 .app（系统应用通常为 false）
    pub modifiable: bool,
    /// 位于 /System 下，界面显示为受系统保护
    pub system: bool,
}
