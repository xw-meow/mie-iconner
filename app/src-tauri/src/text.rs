use std::cmp::Ordering;

/// Finder 风格的本地化自然排序（"2" 排在 "10" 前，中文按系统 locale 排序）。
/// 直接用 Foundation 的 localizedStandardCompare，和访达里看到的一致；
/// 纯 Rust 排序在中文下会变成 Unicode 码位序，不符合用户直觉。
#[cfg(target_os = "macos")]
pub fn localized_compare(a: &str, b: &str) -> Ordering {
    use objc2::rc::autoreleasepool;
    use objc2_foundation::{NSComparisonResult, NSString};

    autoreleasepool(|_| {
        let left = NSString::from_str(a);
        let right = NSString::from_str(b);
        match left.localizedStandardCompare(&right) {
            NSComparisonResult::Ascending => Ordering::Less,
            NSComparisonResult::Descending => Ordering::Greater,
            NSComparisonResult::Same => Ordering::Equal,
        }
    })
}

#[cfg(not(target_os = "macos"))]
pub fn localized_compare(a: &str, b: &str) -> Ordering {
    a.to_lowercase().cmp(&b.to_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sorts_case_insensitively_and_numerically() {
        assert_eq!(localized_compare("apple", "Banana"), Ordering::Less);
        assert_eq!(localized_compare("item2", "item10"), Ordering::Less);
        assert_eq!(localized_compare("same", "same"), Ordering::Equal);
    }
}
