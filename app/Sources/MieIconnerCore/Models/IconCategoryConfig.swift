import Foundation

/// 分类文件夹下 config.json 的内容。该文件非必须存在;
/// 缺失或格式非法时全部取默认值。
public struct IconCategoryConfig: Hashable, Sendable {
    /// 排序优先级,越大分类越靠前;同优先级按名称排序
    public let priority: Int
    /// 作者名称
    public let author: String?
    /// 作者主页(config.json 中的 author_url)
    public let authorURL: URL?
    /// 徽标文字(antd Tag 效果,展示在分类名后)
    public let brandName: String?
    /// 徽标背景色十六进制(#RRGGBB);UI 层解析,
    /// 有 brandName 无 brandColor 时用默认 #0958d9
    public let brandColor: String?
    /// 是否默认展开。仅决定用户从未手动折叠/展开过的初始
    /// 状态;用户操作过以后以用户选择为准。缺省 false(折叠)
    public let defaultExpanded: Bool

    public static let `default` = IconCategoryConfig()

    public init(priority: Int = 0,
                author: String? = nil,
                authorURL: URL? = nil,
                brandName: String? = nil,
                brandColor: String? = nil,
                defaultExpanded: Bool = false) {
        self.priority = priority
        self.author = author
        self.authorURL = authorURL
        self.brandName = brandName
        self.brandColor = brandColor
        self.defaultExpanded = defaultExpanded
    }

    /// config.json 的文件格式;字段全部可选
    private struct ConfigFile: Decodable {
        let priority: Int?
        let author: String?
        let author_url: String?
        let brandName: String?
        let brandColor: String?
        let defaultExpanded: Bool?
    }

    /// 读取分类文件夹下的 config.json;不存在或解析失败返回默认值
    static func load(fromCategoryDirectory directory: URL) -> IconCategoryConfig {
        let file = directory.appendingPathComponent("config.json")
        guard let data = try? Data(contentsOf: file),
              let parsed = try? JSONDecoder().decode(ConfigFile.self, from: data) else {
            return .default
        }
        return IconCategoryConfig(
            priority: parsed.priority ?? 0,
            author: parsed.author,
            authorURL: parsed.author_url.flatMap { URL(string: $0) },
            brandName: parsed.brandName,
            brandColor: parsed.brandColor,
            defaultExpanded: parsed.defaultExpanded ?? false
        )
    }
}
