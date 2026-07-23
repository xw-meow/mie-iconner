import Foundation

/// 地址栏下拉建议项:一个匹配的子文件夹。
public struct PathSuggestion: Equatable, Identifiable {
    /// 文件夹的绝对路径 URL(已标准化)。
    public let url: URL
    /// 文件夹名,如 "Documents"。
    public let name: String
    /// ~ 缩写的完整路径,如 "~/Documents"。
    public let displayPath: String

    public var id: URL { url }
}

/// Chrome 式路径补全:以输入最后一个 `/` 为界,前半截为目录、最后一段为
/// 查询词,匹配该目录下名字包含查询词的非隐藏子文件夹。前缀命中排前、
/// 包含命中次之,大小写不敏感。
public enum PathSuggester {
    public static func suggestions(for input: String, limit: Int = 8) -> [PathSuggestion] {
        let trimmed = input.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return [] }
        // expandingTildeInPath 会顺带剥掉尾斜杠,必须先记下来:
        // 以 / 结尾意味着"列出该目录全部子文件夹"(查询词为空)
        let endsWithSlash = trimmed.hasSuffix("/")
        let expanded = (trimmed as NSString).expandingTildeInPath
        guard expanded.hasPrefix("/") else { return [] }

        // 拆成 目录部分 + 查询词
        let dirPath: String
        let query: String
        if expanded == "/" {
            dirPath = "/"
            query = ""
        } else if endsWithSlash {
            dirPath = expanded
            query = ""
        } else {
            dirPath = (expanded as NSString).deletingLastPathComponent
            query = (expanded as NSString).lastPathComponent
        }

        let dirURL = URL(fileURLWithPath: dirPath.isEmpty ? "/" : dirPath)
            .standardizedFileURL
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(
            atPath: dirURL.path, isDirectory: &isDirectory),
              isDirectory.boolValue else { return [] }

        let keys: [URLResourceKey] = [.isDirectoryKey, .isHiddenKey]
        let children = (try? FileManager.default.contentsOfDirectory(
            at: dirURL, includingPropertiesForKeys: keys)) ?? []

        let folders: [URL] = children.compactMap { url in
            guard let values = try? url.resourceValues(forKeys: Set(keys)),
                  values.isDirectory == true,
                  values.isHidden != true else { return nil }
            return url.standardizedFileURL
        }

        let byName = { (a: URL, b: URL) in
            a.lastPathComponent.localizedStandardCompare(b.lastPathComponent) == .orderedAscending
        }
        let ranked: [URL]
        if query.isEmpty {
            ranked = folders.sorted(by: byName)
        } else {
            let prefix = folders.filter {
                $0.lastPathComponent.range(
                    of: query, options: [.caseInsensitive, .anchored]) != nil
            }.sorted(by: byName)
            let contains = folders.filter {
                $0.lastPathComponent.range(of: query, options: .caseInsensitive) != nil
                    && $0.lastPathComponent.range(
                        of: query, options: [.caseInsensitive, .anchored]) == nil
            }.sorted(by: byName)
            ranked = prefix + contains
        }

        return ranked.prefix(limit).map {
            PathSuggestion(url: $0,
                           name: $0.lastPathComponent,
                           displayPath: PathResolver.displayPath(for: $0))
        }
    }
}
