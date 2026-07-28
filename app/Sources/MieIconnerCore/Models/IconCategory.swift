import Foundation

/// 图标分类,对应图标目录下的一个子文件夹,名称即文件夹名。
/// 根目录下的散图归入 default 分类。
public struct IconCategory: Identifiable, Hashable {
    public let name: String
    public let icons: [IconItem]
    /// 分类文件夹下 config.json 的内容;无配置时为默认值
    public let config: IconCategoryConfig
    public var id: String { name }

    public init(name: String, icons: [IconItem],
                config: IconCategoryConfig = .default) {
        self.name = name
        self.icons = icons
        self.config = config
    }
}
