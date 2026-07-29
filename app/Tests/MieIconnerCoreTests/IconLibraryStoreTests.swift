import XCTest
import AppKit
@testable import MieIconnerCore

final class IconLibraryStoreTests: XCTestCase {

    private var bundled: URL!
    private var custom: URL!

    override func setUpWithError() throws {
        let base = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
        bundled = base.appendingPathComponent("bundled")
        custom = base.appendingPathComponent("custom")
        let fm = FileManager.default
        // bundled 根目录:两张 png(应归入 default)+ 一个应被过滤的 txt
        try fm.createDirectory(at: bundled, withIntermediateDirectories: true)
        try Self.makePNG().write(to: bundled.appendingPathComponent("b.png"))
        try Self.makePNG().write(to: bundled.appendingPathComponent("a.png"))
        try "text".write(to: bundled.appendingPathComponent("note.txt"),
                         atomically: true, encoding: .utf8)
        // bundled 子文件夹:成为一个分类
        let animals = bundled.appendingPathComponent("动物")
        try fm.createDirectory(at: animals, withIntermediateDirectories: true)
        try Self.makePNG().write(to: animals.appendingPathComponent("c.png"))
        try fm.createDirectory(at: custom, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: bundled.deletingLastPathComponent())
    }

    /// 生成 4x4 纯蓝 PNG 数据
    static func makePNG() -> Data {
        let rep = NSBitmapImageRep(
            bitmapDataPlanes: nil, pixelsWide: 4, pixelsHigh: 4,
            bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
            colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
        NSColor.systemBlue.setFill()
        NSRect(x: 0, y: 0, width: 4, height: 4).fill()
        NSGraphicsContext.restoreGraphicsState()
        return rep.representation(using: .png, properties: [:])!
    }

    private func makeStore() -> IconLibraryStore {
        IconLibraryStore(bundledIconsURL: bundled, customIconsURL: custom)
    }

    private func bundledCategory(_ store: IconLibraryStore, _ name: String) -> IconCategory? {
        store.bundledCategories.first { $0.name == name }
    }

    private func customCategory(_ store: IconLibraryStore, _ name: String) -> IconCategory? {
        store.customCategories.first { $0.name == name }
    }

    // MARK: - 扫描与分类

    func test_bundled_rootImages_groupedIntoDefault_filtersNonImages_sortedByName() {
        let store = makeStore()
        let def = bundledCategory(store, "default")
        XCTAssertEqual(def?.icons.map(\.name), ["a", "b"])
        XCTAssertTrue(def?.icons.allSatisfy { $0.source == .bundled } ?? false)
    }

    func test_bundled_subdirectory_becomesCategory() {
        let store = makeStore()
        XCTAssertEqual(bundledCategory(store, "动物")?.icons.map(\.name), ["c"])
    }

    func test_categoryOrder_nameAscending() throws {
        let work = custom.appendingPathComponent("工作")
        try FileManager.default.createDirectory(at: work, withIntermediateDirectories: true)
        try Self.makePNG().write(to: work.appendingPathComponent("d.png"))
        let store = makeStore()
        // 无 config 时纯按 localizedStandardCompare 排序;根目录散图归入的
        // default 也只是普通分类,没有特权位。注意排序结果随系统 locale
        // 变化(中文 collation 汉字在前,英文在后),不能写死顺序,
        // 用同一比较器算期望值——既 locale 无关,又正好验证"无特权":
        // 一旦 default 被置顶/置底,就会与纯排序结果不符
        let expected = ["动物", "default"].sorted {
            $0.localizedStandardCompare($1) == .orderedAscending
        }
        XCTAssertEqual(store.bundledCategories.map(\.name), expected)
        XCTAssertEqual(store.customCategories.map(\.name), ["工作"])
    }

    func test_bundledAndCustom_sameNameCategory_notMerged() throws {
        let animals = custom.appendingPathComponent("动物")
        try FileManager.default.createDirectory(at: animals, withIntermediateDirectories: true)
        try Self.makePNG().write(to: animals.appendingPathComponent("d.png"))
        let store = makeStore()
        // 两个来源各自成组,互不混入
        XCTAssertEqual(bundledCategory(store, "动物")?.icons.map(\.name), ["c"])
        XCTAssertEqual(customCategory(store, "动物")?.icons.map(\.name), ["d"])
    }

    func test_emptyCustomSubdirectory_showsAsEmptyCategory() throws {
        try FileManager.default.createDirectory(
            at: custom.appendingPathComponent("空分类"), withIntermediateDirectories: true)
        let store = makeStore()
        XCTAssertEqual(customCategory(store, "空分类")?.icons.count, 0)
    }

    func test_firstRun_bootstrapCreatesDefaultFolder() throws {
        let freshCustom = bundled.deletingLastPathComponent().appendingPathComponent("fresh")
        let store = IconLibraryStore(bundledIconsURL: bundled, customIconsURL: freshCustom)
        // 自定义目录不存在(首次运行):预建 default 文件夹作为起点
        var isDirectory: ObjCBool = false
        XCTAssertTrue(FileManager.default.fileExists(
            atPath: freshCustom.appendingPathComponent("default").path,
            isDirectory: &isDirectory))
        XCTAssertTrue(isDirectory.boolValue)
        XCTAssertEqual(store.customCategories.map(\.name), ["default"])
    }

    func test_existingEmptyCustomDir_noBootstrapNoForcedDefault() throws {
        // 目录已存在但为空:不预建、也不强造 default 分类
        let store = makeStore()
        XCTAssertTrue(store.customCategories.isEmpty)
        XCTAssertFalse(FileManager.default.fileExists(
            atPath: custom.appendingPathComponent("default").path))
    }

    func test_customDefaultSubdirectory_mergedWithRootImages() throws {
        try Self.makePNG().write(to: custom.appendingPathComponent("x.png"))
        let def = custom.appendingPathComponent("default")
        try FileManager.default.createDirectory(at: def, withIntermediateDirectories: true)
        try Self.makePNG().write(to: def.appendingPathComponent("z.png"))
        let store = makeStore()
        XCTAssertEqual(customCategory(store, "default")?.icons.map(\.name), ["x", "z"])
    }

    func test_missingCustomDir_bootstrappedAndTolerated() {
        let absent = custom.appendingPathComponent("nope")
        let store = IconLibraryStore(bundledIconsURL: bundled, customIconsURL: absent)
        XCTAssertEqual(bundledCategory(store, "default")?.icons.map(\.name), ["a", "b"])
        XCTAssertEqual(bundledCategory(store, "动物")?.icons.map(\.name), ["c"])
        // 目录不存在等同首次运行,会预建 default
        XCTAssertEqual(store.customCategories.map(\.name), ["default"])
    }

    // MARK: - addIcon

    func test_addIcon_defaultCategory_copiesIntoDefaultSubdir() throws {
        let source = bundled.appendingPathComponent("a.png")
        let store = makeStore()
        let result = store.addIcon(from: source)
        guard case .success(let item) = result else {
            return XCTFail("addIcon 应成功,得到 \(result)")
        }
        XCTAssertEqual(item.source, .custom)
        XCTAssertEqual(item.url.deletingLastPathComponent().lastPathComponent, "default")
        XCTAssertTrue(FileManager.default.fileExists(atPath: item.url.path))
        // 注意:不能按 URL 相等断言——临时目录 /var 是软链,扫描结果
        // 会被解析成 /private/var,与构造的 URL 字符串不等
        let icons = customCategory(store, "default")?.icons ?? []
        XCTAssertTrue(icons.contains { $0.name == "a" && $0.source == .custom })
    }

    func test_addIcon_specificCategory_createsSubdirAndCategory() throws {
        let source = bundled.appendingPathComponent("a.png")
        let store = makeStore()
        let result = store.addIcon(from: source, category: "图标")
        guard case .success(let item) = result else {
            return XCTFail("addIcon 应成功,得到 \(result)")
        }
        XCTAssertEqual(item.url.deletingLastPathComponent().lastPathComponent, "图标")
        XCTAssertEqual(customCategory(store, "图标")?.icons.map(\.name), ["a"])
    }

    func test_addIcon_rejectsUnsupportedType() throws {
        let txt = bundled.appendingPathComponent("note.txt")
        let store = makeStore()
        XCTAssertEqual(store.addIcon(from: txt), .failure(.unsupportedType))
        // 失败不应创建任何分类子目录
        XCTAssertFalse(FileManager.default.fileExists(
            atPath: custom.appendingPathComponent("default").path))
    }

    func test_addIcon_sameNameTwice_overwrites() {
        let source = bundled.appendingPathComponent("a.png")
        let store = makeStore()
        _ = store.addIcon(from: source, category: "图标")
        _ = store.addIcon(from: source, category: "图标")
        XCTAssertEqual(customCategory(store, "图标")?.icons.count, 1)
    }

    // MARK: - 删除

    func test_deleteIcon_removesCustomIcon() throws {
        let source = bundled.appendingPathComponent("a.png")
        let store = makeStore()
        guard case .success(let item) = store.addIcon(from: source) else {
            return XCTFail("addIcon 应成功")
        }
        XCTAssertTrue(store.deleteIcon(item))
        XCTAssertFalse(FileManager.default.fileExists(atPath: item.url.path))
        XCTAssertFalse(customCategory(store, "default")?.icons.contains {
            $0.name == "a" && $0.source == .custom
        } ?? true)
    }

    func test_deleteIcon_rejectsBundledIcon() throws {
        let store = makeStore()
        let bundledIcon = try XCTUnwrap(bundledCategory(store, "default")?.icons.first)
        XCTAssertFalse(store.deleteIcon(bundledIcon))
        XCTAssertTrue(FileManager.default.fileExists(atPath: bundledIcon.url.path))
    }

    func test_deleteCategory_removesFolderAndIcons() throws {
        let source = bundled.appendingPathComponent("a.png")
        let store = makeStore()
        guard case .success = store.addIcon(from: source, category: "图标") else {
            return XCTFail("addIcon 应成功")
        }
        XCTAssertTrue(store.deleteCategory(named: "图标"))
        XCTAssertFalse(FileManager.default.fileExists(
            atPath: custom.appendingPathComponent("图标").path))
        XCTAssertNil(customCategory(store, "图标"))
    }

    func test_deleteCategory_anyCustomCategory_includingDefault() throws {
        let source = bundled.appendingPathComponent("a.png")
        let store = makeStore()
        guard case .success = store.addIcon(from: source) else {
            return XCTFail("addIcon 应成功")
        }
        // default 没有特权,和其他分类一样可删
        XCTAssertTrue(store.deleteCategory(named: "default"))
        XCTAssertNil(customCategory(store, "default"))
    }

    func test_deleteCategory_unknownName_returnsFalse() {
        let store = makeStore()
        XCTAssertFalse(store.deleteCategory(named: "不存在"))
    }

    // MARK: - config.json

    private func writeConfig(_ json: String, to categoryDir: URL) throws {
        try json.write(to: categoryDir.appendingPathComponent("config.json"),
                       atomically: true, encoding: .utf8)
    }

    func test_configJson_parsed_allFields() throws {
        try writeConfig("""
            {
              "priority": 10,
              "author": "美少女壮士a",
              "author_url": "https://example.com/u/a",
              "brandName": "旺财",
              "brandColor": "#ff4d4f",
              "defaultExpanded": true
            }
            """, to: bundled.appendingPathComponent("动物"))
        let store = makeStore()
        let config = try XCTUnwrap(bundledCategory(store, "动物")?.config)
        XCTAssertEqual(config.priority, 10)
        XCTAssertEqual(config.author, "美少女壮士a")
        XCTAssertEqual(config.authorURL?.absoluteString, "https://example.com/u/a")
        XCTAssertEqual(config.brandName, "旺财")
        XCTAssertEqual(config.brandColor, "#ff4d4f")
        XCTAssertTrue(config.defaultExpanded)
    }

    func test_configJson_missing_returnsDefaults() {
        let store = makeStore()
        let config = bundledCategory(store, "动物")?.config
        XCTAssertEqual(config?.priority, 0)
        XCTAssertNil(config?.author)
        XCTAssertNil(config?.authorURL)
        XCTAssertNil(config?.brandName)
        XCTAssertNil(config?.brandColor)
        // 未配置时默认折叠
        XCTAssertEqual(config?.defaultExpanded, false)
    }

    func test_configJson_malformed_returnsDefaults() throws {
        try writeConfig("{ 这不是合法 JSON", to: bundled.appendingPathComponent("动物"))
        let store = makeStore()
        XCTAssertEqual(bundledCategory(store, "动物")?.config.priority, 0)
        XCTAssertNil(bundledCategory(store, "动物")?.config.brandName)
    }

    func test_configJson_partialFields_restDefault() throws {
        try writeConfig(#"{"brandName": "热门"}"#,
                        to: bundled.appendingPathComponent("动物"))
        let store = makeStore()
        let config = bundledCategory(store, "动物")?.config
        XCTAssertEqual(config?.priority, 0)
        XCTAssertEqual(config?.brandName, "热门")
        XCTAssertNil(config?.author)
    }

    func test_categoryOrder_priorityDesc_thenNameAsc() throws {
        let fm = FileManager.default
        for (name, priority) in [("b", 5), ("a", 10), ("c", 10)] {
            let dir = custom.appendingPathComponent(name)
            try fm.createDirectory(at: dir, withIntermediateDirectories: true)
            try writeConfig("{\"priority\": \(priority)}", to: dir)
        }
        let store = makeStore()
        // default 无特权;同优先级(a、c)按名称升序
        XCTAssertEqual(store.customCategories.map(\.name),
                       ["a", "c", "b"])
    }

    func test_defaultSubdirectory_configAppliesToDefaultBucket() throws {
        let def = custom.appendingPathComponent("default")
        try FileManager.default.createDirectory(at: def, withIntermediateDirectories: true)
        try writeConfig(#"{"author": "作者", "brandName": "官方"}"#, to: def)
        let store = makeStore()
        let config = customCategory(store, "default")?.config
        XCTAssertEqual(config?.author, "作者")
        XCTAssertEqual(config?.brandName, "官方")
    }
}
