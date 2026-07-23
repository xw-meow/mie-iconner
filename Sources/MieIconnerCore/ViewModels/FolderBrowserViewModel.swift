import Foundation

@Observable
public final class FolderBrowserViewModel {
    public private(set) var currentURL: URL
    public private(set) var folders: [FolderItem] = []
    /// 刷新代际:同一路径手动刷新时文件夹 URL 不变,卡片靠
    /// 监听它的变化重新取图标(NSWorkspace 的图标缓存也需要绕过)
    public private(set) var refreshToken = 0
    public var canGoUp: Bool { currentURL.path != "/" }

    public init(startURL: URL) {
        self.currentURL = startURL.standardizedFileURL
        refresh()
    }

    public func goInto(_ folder: FolderItem) {
        currentURL = folder.url.standardizedFileURL
        refresh()
    }

    public func goUp() {
        guard canGoUp else { return }
        currentURL = currentURL.deletingLastPathComponent()
        refresh()
    }

    /// 导航到输入路径;无效(不存在/非目录)返回 false 且保持原位。
    @discardableResult
    public func goTo(_ input: String) -> Bool {
        guard let url = PathResolver.resolve(input) else { return false }
        currentURL = url
        refresh()
        return true
    }

    public func refresh() {
        let keys: [URLResourceKey] = [.isDirectoryKey, .isHiddenKey]
        let contents = (try? FileManager.default.contentsOfDirectory(
            at: currentURL, includingPropertiesForKeys: keys)) ?? []
        folders = contents.compactMap { url in
            guard let values = try? url.resourceValues(forKeys: Set(keys)),
                  values.isDirectory == true,
                  values.isHidden != true else { return nil }
            // 统一为标准化路径:FileManager 返回的子项会解析 /var→/private/var,
            // 与 standardizedFileURL 的 canonical 形态(/var)保持一致,避免 URL 比较不一致。
            return FolderItem(url: url.standardizedFileURL)
        }.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
        refreshToken &+= 1
    }
}
