use std::path::{Path, PathBuf};

use crate::error::AppError;
use crate::models::ResolvedPathDto;

/// 展开开头的 `~`。只处理当前用户的家目录写法，`~other` 原样保留。
pub fn expand_tilde(input: &str, home: &Path) -> PathBuf {
    if input == "~" {
        return home.to_path_buf();
    }
    if let Some(rest) = input.strip_prefix("~/") {
        return home.join(rest);
    }
    PathBuf::from(input)
}

/// 家目录缩写为 `~`，用于地址栏与面包屑展示。
pub fn display_path(path: &Path, home: &Path) -> String {
    if path == home {
        return "~".to_string();
    }
    match path.strip_prefix(home) {
        Ok(rest) => {
            let mut text = String::from("~");
            for component in rest.components() {
                text.push('/');
                text.push_str(&component.as_os_str().to_string_lossy());
            }
            text
        }
        Err(_) => path.to_string_lossy().into_owned(),
    }
}

/// 校验输入确实是存在的目录，返回 canonical path。
/// canonicalize 同时消掉 `..`、软链与 `/var` → `/private/var` 的差异，
/// 让列表、选中和比较始终使用同一形态的路径。
pub fn resolve_directory(input: &str, home: &Path) -> Option<PathBuf> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return None;
    }
    let expanded = expand_tilde(trimmed, home);
    if !expanded.is_absolute() {
        return None;
    }
    let canonical = std::fs::canonicalize(expanded).ok()?;
    if canonical.is_dir() {
        Some(canonical)
    } else {
        None
    }
}

pub fn resolved_dto(path: PathBuf, home: &Path) -> ResolvedPathDto {
    ResolvedPathDto {
        display: display_path(&path, home),
        name: path_name(&path),
        path: path.to_string_lossy().into_owned(),
    }
}

/// 路径的展示名：根目录显示 `/`，其余显示最后一段。
pub fn path_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "/".to_string())
}

/// 规范化家目录；取不到时回退到 `/`（正常 macOS 用户不会走到这里）。
pub fn home_dir() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .filter(|path| path.is_dir())
        .unwrap_or_else(|| PathBuf::from("/"))
}

/// 目录是否位于给定根目录之下（都先 canonicalize）。
pub fn is_within_roots(path: &Path, roots: &[&Path]) -> bool {
    let Ok(canonical) = std::fs::canonicalize(path) else {
        return false;
    };
    roots.iter().any(|root| {
        std::fs::canonicalize(root)
            .map(|root| canonical.starts_with(root))
            .unwrap_or(false)
    })
}

/// 删除/重命名分类时的名称校验：只允许一个普通文件夹名。
pub fn validate_folder_name(raw: &str) -> Result<String, AppError> {
    let name = raw.trim().to_string();
    if name.is_empty() {
        return Err(AppError::new("invalid_category", "分类名称不能为空"));
    }
    if name == "." || name == ".." || name.starts_with('.') {
        return Err(AppError::new(
            "invalid_category",
            "分类名称不能以点开头，也不能是 . 或 ..",
        ));
    }
    if name
        .chars()
        .any(|c| c == '/' || c == '\\' || c == ':' || c == '\0' || c.is_control())
    {
        return Err(AppError::new(
            "invalid_category",
            "分类名称不能包含 / \\ : 等特殊字符",
        ));
    }
    if name.len() > 200 {
        return Err(AppError::new("invalid_category", "分类名称过长"));
    }
    Ok(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expand_tilde_only_for_current_user() {
        let home = Path::new("/Users/me");
        assert_eq!(expand_tilde("~", home), PathBuf::from("/Users/me"));
        assert_eq!(
            expand_tilde("~/Desktop", home),
            PathBuf::from("/Users/me/Desktop")
        );
        assert_eq!(expand_tilde("~other/x", home), PathBuf::from("~other/x"));
        assert_eq!(expand_tilde("/tmp", home), PathBuf::from("/tmp"));
    }

    #[test]
    fn display_path_shortens_home() {
        let home = Path::new("/Users/me");
        assert_eq!(display_path(Path::new("/Users/me"), home), "~");
        assert_eq!(
            display_path(Path::new("/Users/me/Library/Desktop"), home),
            "~/Library/Desktop"
        );
        assert_eq!(display_path(Path::new("/usr/local"), home), "/usr/local");
    }

    #[test]
    fn path_name_handles_root() {
        assert_eq!(path_name(Path::new("/")), "/");
        assert_eq!(path_name(Path::new("/Users/me/Desktop")), "Desktop");
    }

    #[test]
    fn validate_folder_name_rejects_traversal() {
        assert!(validate_folder_name("../evil").is_err());
        assert!(validate_folder_name("a/b").is_err());
        assert!(validate_folder_name(".hidden").is_err());
        assert!(validate_folder_name("  ").is_err());
        assert_eq!(validate_folder_name(" 工作 ").unwrap(), "工作");
        assert_eq!(validate_folder_name("动物系列").unwrap(), "动物系列");
    }
}
