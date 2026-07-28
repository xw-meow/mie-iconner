import Foundation

public enum AddIconError: Error, Equatable {
    case unsupportedType
    case copyFailed
}

@Observable
public final class IconLibraryStore {
    /// 根目录散图归入的分类名,也是首次运行时预建的分类名。
    /// 该名称没有任何特权:排序、删除等行为一律由 config.json
    /// 与统一规则决定
    public static let defaultCategoryName = "default"

    /// 系统预设分类(只读,不可增删)
    public private(set) var bundledCategories: [IconCategory] = []
    /// 用户自定义分类
    public private(set) var customCategories: [IconCategory] = []
    public let customIconsURL: URL
    private let bundledIconsURL: URL?
    /// 缩略图预热任务;reload 时取消重来
    @ObservationIgnored private var preheatTask: Task<Void, Never>?

    private static let allowedExtensions: Set<String> = ["png", "jpg", "jpeg"]

    public init(bundledIconsURL: URL?, customIconsURL: URL) {
        self.bundledIconsURL = bundledIconsURL
        self.customIconsURL = customIconsURL
        Self.bootstrapCustomDirectoryIfNeeded(customIconsURL)
        reload()
    }

    /// 首次运行(自定义图标目录还不存在)时预建一个 default
    /// 分类文件夹,给用户一个起点。目录一旦存在就不再干预——
    /// 用户之后删掉所有分类是其自主选择,不做复活
    private static func bootstrapCustomDirectoryIfNeeded(_ url: URL) {
        let fm = FileManager.default
        guard !fm.fileExists(atPath: url.path) else { return }
        try? fm.createDirectory(
            at: url.appendingPathComponent(defaultCategoryName),
            withIntermediateDirectories: true)
    }

    public func reload() {
        bundledCategories = Self.makeCategories(
            from: Self.scan(directory: bundledIconsURL, source: .bundled))
        customCategories = Self.makeCategories(
            from: Self.scan(directory: customIconsURL, source: .custom))
        preheatThumbnails()
    }

    /// 后台线程预热全部缩略图缓存。缩略图解码很便宜,预热后
    /// 首次展示、滚动、折叠展开都不会再边解码边渲染
    private func preheatThumbnails() {
        preheatTask?.cancel()
        let icons = (bundledCategories + customCategories).flatMap(\.icons)
        preheatTask = Task.detached(priority: .utility) {
            for icon in icons {
                if Task.isCancelled { return }
                _ = icon.loadImage()
            }
        }
    }

    /// 校验扩展名并拷贝进自定义图标目录下的分类子目录;同名覆盖。
    /// 分类子目录不存在时自动创建,即添加图标也能建立新分类。
    @discardableResult
    public func addIcon(from sourceURL: URL,
                        category: String = IconLibraryStore.defaultCategoryName) -> Result<IconItem, AddIconError> {
        guard Self.allowedExtensions.contains(sourceURL.pathExtension.lowercased()) else {
            return .failure(.unsupportedType)
        }
        do {
            let fm = FileManager.default
            let directory = customIconsURL.appendingPathComponent(category)
            try fm.createDirectory(at: directory, withIntermediateDirectories: true)
            let destination = directory.appendingPathComponent(sourceURL.lastPathComponent)
            if fm.fileExists(atPath: destination.path) {
                try fm.removeItem(at: destination)
            }
            try fm.copyItem(at: sourceURL, to: destination)
            let item = IconItem(url: destination, source: .custom)
            reload()
            return .success(item)
        } catch {
            return .failure(.copyFailed)
        }
    }

    /// 删除一个自定义图标(移入废纸篓,可恢复)。系统预设图标拒绝删除。
    @discardableResult
    public func deleteIcon(_ icon: IconItem) -> Bool {
        guard icon.source == .custom else { return false }
        do {
            try FileManager.default.trashItem(at: icon.url, resultingItemURL: nil)
            reload()
            return true
        } catch {
            return false
        }
    }

    /// 删除一个自定义分类及其全部图标(整个文件夹移入废纸篓)。
    /// 任何自定义分类都可删除,没有例外
    @discardableResult
    public func deleteCategory(named name: String) -> Bool {
        let directory = customIconsURL.appendingPathComponent(name)
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: directory.path, isDirectory: &isDirectory),
              isDirectory.boolValue else { return false }
        do {
            try FileManager.default.trashItem(at: directory, resultingItemURL: nil)
            reload()
            return true
        } catch {
            return false
        }
    }

    /// 一个分类的扫描结果:图标列表 + config.json 配置
    private struct CategoryContent {
        var icons: [IconItem] = []
        var config: IconCategoryConfig = .default
    }

    /// 扫描结果字典 → 排序后的分类数组:优先级降序,同优先级
    /// 按名称排序。没有特权分类,一切由 config.json 决定
    private static func makeCategories(from map: [String: CategoryContent]) -> [IconCategory] {
        map.keys
            .sorted { lhs, rhs in
                let lp = map[lhs]?.config.priority ?? 0
                let rp = map[rhs]?.config.priority ?? 0
                if lp != rp { return lp > rp }
                return lhs.localizedStandardCompare(rhs) == .orderedAscending
            }
            .map {
                IconCategory(name: $0,
                             icons: map[$0]?.icons ?? [],
                             config: map[$0]?.config ?? .default)
            }
    }

    /// 扫描一个图标根目录:根下的图片归入 default,每个子文件夹
    /// 成为以其命名的分类(空文件夹也保留,方便先建分类再添图)。
    /// 分类的 config.json 从对应子文件夹读取;default 桶若存在
    /// default 子文件夹则沿用其配置。
    private static func scan(directory: URL?, source: IconItem.Source) -> [String: CategoryContent] {
        guard let directory else { return [:] }
        let fm = FileManager.default
        let urls = (try? fm.contentsOfDirectory(
            at: directory, includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles])) ?? []
        var result: [String: CategoryContent] = [:]
        for url in urls {
            let isDirectory = (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory ?? false
            if isDirectory {
                // 子文件夹可能与根目录散图撞名(如 default 子目录),图标合并;
                // 配置以子文件夹的 config.json 为准
                result[url.lastPathComponent, default: CategoryContent()]
                    .icons += images(in: url, source: source)
                result[url.lastPathComponent]?.config =
                    IconCategoryConfig.load(fromCategoryDirectory: url)
            } else if allowedExtensions.contains(url.pathExtension.lowercased()) {
                result[defaultCategoryName, default: CategoryContent()]
                    .icons.append(IconItem(url: url, source: source))
            }
        }
        for name in result.keys {
            result[name]?.icons.sort {
                $0.url.lastPathComponent.localizedStandardCompare($1.url.lastPathComponent) == .orderedAscending
            }
        }
        return result
    }

    private static func images(in directory: URL, source: IconItem.Source) -> [IconItem] {
        let urls = (try? FileManager.default.contentsOfDirectory(
            at: directory, includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles])) ?? []
        return urls
            .filter { allowedExtensions.contains($0.pathExtension.lowercased()) }
            .map { IconItem(url: $0, source: source) }
    }
}
