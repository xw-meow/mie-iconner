use std::path::{Path, PathBuf};

use crate::models::PathSuggestionDto;
use crate::paths::{display_path, expand_tilde};
use crate::text::localized_compare;

/// Chrome 式路径补全：以输入最后一个 `/` 为界，前半截是目录，
/// 最后一段是查询词；匹配该目录下名字包含查询词的非隐藏子文件夹。
/// 前缀命中排前、包含命中次之，组内按 Finder 的自然序。
pub fn suggestions_in(input: &str, home: &Path, limit: usize) -> Vec<PathSuggestionDto> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    // 路径统一成 canonical 形态（临时目录 /var → /private/var），
    // 否则 ~ 缩写与建议项的绝对路径前缀对不上
    let home = std::fs::canonicalize(home).unwrap_or_else(|_| home.to_path_buf());
    let home = home.as_path();
    let is_tilde_root = trimmed == "~";
    let ends_with_slash = trimmed.ends_with('/');
    if !(trimmed.starts_with('/') || trimmed.starts_with("~/") || is_tilde_root) {
        return Vec::new();
    }

    let expanded = expand_tilde(trimmed, home);
    let expanded_text = expanded.to_string_lossy();
    let (dir_path, query) = if is_tilde_root {
        // "~" 本身：列出家目录的父级里匹配家目录名的那一项
        let parent = home.parent().unwrap_or(Path::new("/"));
        (
            parent.to_path_buf(),
            home.file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default(),
        )
    } else if ends_with_slash {
        let mut dir_text = expanded_text.trim_end_matches('/').to_string();
        if dir_text.is_empty() {
            dir_text.push('/');
        }
        (PathBuf::from(dir_text), String::new())
    } else {
        let dir = expanded.parent().unwrap_or(Path::new("/")).to_path_buf();
        let query = expanded
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default();
        (dir, query)
    };

    let canonical_dir = std::fs::canonicalize(&dir_path).ok();
    let Some(dir) = canonical_dir.filter(|path| path.is_dir()) else {
        return Vec::new();
    };

    let mut folders: Vec<(String, PathBuf)> = std::fs::read_dir(&dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') {
                return None;
            }
            let path = entry.path();
            // 跟随软链判断目录，与访达的显示一致
            let metadata = std::fs::metadata(&path).ok()?;
            metadata.is_dir().then_some((name, path))
        })
        .collect();

    let folded = query.to_lowercase();
    let ranked = if folded.is_empty() {
        folders.sort_by(|a, b| localized_compare(&a.0, &b.0));
        folders
    } else {
        let mut prefix: Vec<(String, PathBuf)> = Vec::new();
        let mut contains: Vec<(String, PathBuf)> = Vec::new();
        for item in folders.drain(..) {
            let name = item.0.to_lowercase();
            if name.starts_with(&folded) {
                prefix.push(item);
            } else if name.contains(&folded) {
                contains.push(item);
            }
        }
        prefix.sort_by(|a, b| localized_compare(&a.0, &b.0));
        contains.sort_by(|a, b| localized_compare(&a.0, &b.0));
        prefix.extend(contains);
        prefix
    };

    ranked
        .into_iter()
        .take(limit.clamp(1, 20))
        .map(|(name, path)| PathSuggestionDto {
            display: display_path(&path, home),
            path: path.to_string_lossy().into_owned(),
            name,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    struct Fixture {
        _temp: tempfile::TempDir,
        root: PathBuf,
        home: PathBuf,
    }

    fn fixture() -> Fixture {
        let temp = tempfile::tempdir().unwrap();
        let home = temp.path().join("home");
        let root = home.join("Desktop");
        for dir in [
            "Apple",
            "apricot",
            "grape",
            "Banana",
            ".hidden",
            "Apple/Sub",
            "Documents",
        ] {
            fs::create_dir_all(root.join(dir)).unwrap();
        }
        fs::write(root.join("Apple/note.txt"), "hi").unwrap();
        Fixture {
            _temp: temp,
            root,
            home,
        }
    }

    #[test]
    fn empty_or_relative_input_returns_empty() {
        let temp = tempfile::tempdir().unwrap();
        let home = temp.path();
        assert!(suggestions_in("  ", home, 8).is_empty());
        assert!(suggestions_in("aa/bb", home, 8).is_empty());
    }

    #[test]
    fn prefix_matches_rank_before_contains() {
        let fixture = fixture();
        let input = format!("{}/ap", fixture.root.display());
        let got: Vec<String> = suggestions_in(&input, &fixture.home, 8)
            .into_iter()
            .map(|s| s.name)
            .collect();
        assert_eq!(got, vec!["Apple", "apricot", "grape"]);
    }

    #[test]
    fn matching_is_case_insensitive() {
        let fixture = fixture();
        let input = format!("{}/AP", fixture.root.display());
        let got: Vec<String> = suggestions_in(&input, &fixture.home, 8)
            .into_iter()
            .map(|s| s.name)
            .collect();
        assert_eq!(got, vec!["Apple", "apricot", "grape"]);
        let input = format!("{}/banana", fixture.root.display());
        let got: Vec<String> = suggestions_in(&input, &fixture.home, 8)
            .into_iter()
            .map(|s| s.name)
            .collect();
        assert_eq!(got, vec!["Banana"]);
    }

    #[test]
    fn trailing_slash_lists_all_sorted_and_skips_hidden() {
        let fixture = fixture();
        let input = format!("{}/", fixture.root.display());
        let got: Vec<String> = suggestions_in(&input, &fixture.home, 8)
            .into_iter()
            .map(|s| s.name)
            .collect();
        assert_eq!(
            got,
            vec!["Apple", "apricot", "Banana", "Documents", "grape"]
        );
        assert!(!got.contains(&".hidden".to_string()));
    }

    #[test]
    fn limit_truncates() {
        let fixture = fixture();
        let input = format!("{}/", fixture.root.display());
        assert_eq!(suggestions_in(&input, &fixture.home, 2).len(), 2);
    }

    #[test]
    fn nonexistent_or_file_directory_returns_empty() {
        let fixture = fixture();
        assert!(suggestions_in(
            &format!("{}/nope/anything", fixture.root.display()),
            &fixture.home,
            8
        )
        .is_empty());
        assert!(suggestions_in(
            &format!("{}/Apple/note.txt/x", fixture.root.display()),
            &fixture.home,
            8
        )
        .is_empty());
    }

    #[test]
    fn exact_match_is_offered() {
        let fixture = fixture();
        let input = format!("{}/Apple", fixture.root.display());
        let got: Vec<String> = suggestions_in(&input, &fixture.home, 8)
            .into_iter()
            .map(|s| s.name)
            .collect();
        assert_eq!(got, vec!["Apple"]);
    }

    #[test]
    fn nested_directory_is_queried() {
        let fixture = fixture();
        let input = format!("{}/Apple/su", fixture.root.display());
        let got: Vec<String> = suggestions_in(&input, &fixture.home, 8)
            .into_iter()
            .map(|s| s.name)
            .collect();
        assert_eq!(got, vec!["Sub"]);
    }

    #[test]
    fn display_path_uses_tilde_for_home() {
        let fixture = fixture();
        let input = format!("{}/", fixture.home.display());
        let all = suggestions_in(&input, &fixture.home, 8);
        assert!(all.iter().all(|s| s.display.starts_with("~/")));
    }

    #[test]
    fn tilde_input_expands() {
        let fixture = fixture();
        let got: Vec<String> = suggestions_in("~/Desktop/", &fixture.home, 8)
            .into_iter()
            .map(|s| s.name)
            .collect();
        assert_eq!(got.first().map(String::as_str), Some("Apple"));
    }
}
