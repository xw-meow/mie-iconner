import SwiftUI
import UniformTypeIdentifiers
import MieIconnerCore

struct IconLibraryView: View {
    let store: IconLibraryStore
    @Binding var selectedIcon: IconItem?
    /// 点空白处清除两侧所有选中(图标 + 文件夹)
    let clearSelection: () -> Void

    enum LibraryTab: String, CaseIterable, Identifiable {
        case system = "系统预设"
        case custom = "自定义"
        var id: String { rawValue }
    }

    @State private var tab: LibraryTab = .system
    @State private var showImportSheet = false
    @State private var showFileImporter = false
    @State private var importCategory = IconLibraryStore.defaultCategoryName
    @State private var dropTargetCategory: String?
    @State private var errorMessage: String?
    @State private var categoryPendingDeletion: String?
    /// 折叠状态持久化:字典里有记录 = 用户手动选择过,以其为准;
    /// 没记录 = 用该分类 config.json 的 defaultExpanded(缺省折叠)。
    /// 旧的 Set 存储首次启动时迁移进来(全部视为折叠)
    @State private var collapsedOverrides: [String: Bool] = {
        var dict = UserDefaults.standard.dictionary(forKey: collapsedDefaultsKey)
            as? [String: Bool] ?? [:]
        if let legacy = UserDefaults.standard.stringArray(forKey: legacyCollapsedKey) {
            for name in legacy { dict[name] = true }
            UserDefaults.standard.removeObject(forKey: legacyCollapsedKey)
            UserDefaults.standard.set(dict, forKey: collapsedDefaultsKey)
        }
        return dict
    }()

    private static let collapsedDefaultsKey = "iconCategoryCollapsed"
    private static let legacyCollapsedKey = "collapsedIconCategories"

    /// 某分类当前是否折叠:用户选择优先,否则 config 决定
    private func isCollapsed(_ category: IconCategory) -> Bool {
        collapsedOverrides[category.name] ?? !category.config.defaultExpanded
    }

    private var activeCategories: [IconCategory] {
        tab == .system ? store.bundledCategories : store.customCategories
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PaperTabPicker(selection: $tab)
                .padding(.horizontal, DesignTokens.spacingM)
                .padding(.vertical, DesignTokens.spacingS)

            if tab == .custom {
                Button { showImportSheet = true } label: {
                    Label("导入素材", systemImage: "square.and.arrow.down")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.capsule)
                .padding(.horizontal, DesignTokens.spacingM)
                .padding(.bottom, DesignTokens.spacingS)
            }

            GeometryReader { geo in
                ScrollView {
                    ZStack(alignment: .top) {
                        // 空白点击取消选中:垫在内容最底层并撑满可视
                        // 高度,卡片在前景遮挡,点卡片不会触发
                        Color.clear
                            .contentShape(Rectangle())
                            .onTapGesture { clearSelection() }

                        VStack(alignment: .leading, spacing: DesignTokens.spacingS) {
                            ForEach(activeCategories) { category in
                                IconCategorySection(
                                    category: category,
                                    isCollapsed: isCollapsed(category),
                                    isDropTargeted: dropTargetCategory == category.name,
                                    // 系统预设只读;自定义可增删
                                    isEditable: tab == .custom,
                                    selectedIcon: $selectedIcon,
                                    onToggle: { toggleCategory(category) },
                                    onAdd: {
                                        importCategory = category.name
                                        showFileImporter = true
                                    },
                                    onDeleteIcon: { deleteIcon($0) },
                                    onDeleteCategory: {
                                        categoryPendingDeletion = category.name
                                    },
                                    onDrop: { urls in handleDrop(urls, into: category.name) },
                                    onDropTargetedChange: { targeted in
                                        if targeted {
                                            dropTargetCategory = category.name
                                        } else if dropTargetCategory == category.name {
                                            dropTargetCategory = nil
                                        }
                                    }
                                )
                            }

                            if activeCategories.isEmpty {
                                if tab == .system {
                                    ContentUnavailableView("暂无系统预设图标",
                                                           systemImage: "photo.on.rectangle")
                                        .padding(.top, 60)
                                } else {
                                    ContentUnavailableView("暂无自定义分类",
                                                           systemImage: "photo.on.rectangle",
                                                           description: Text("点上方「导入素材」新建分类并添加图片"))
                                        .padding(.top, 60)
                                }
                            }
                        }
                        .padding(DesignTokens.spacingM)
                    }
                    .frame(minHeight: geo.size.height, alignment: .top)
                }
                // 极简纸面风下系统深色粗滚动条很扎眼,隐藏
                .scrollIndicators(.hidden)
            }
        }
        .frame(maxHeight: .infinity)
        .containerCursor(.arrow)
        .onChange(of: tab) { dropTargetCategory = nil }
        .sheet(isPresented: $showImportSheet) {
            ImportIconSheet(
                categories: store.customCategories.map(\.name),
                onImport: { category in
                    importCategory = category
                    showImportSheet = false
                    // 等 sheet 关闭动画结束再弹文件选择,避免两个面板抢窗
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        showFileImporter = true
                    }
                },
                onCancel: { showImportSheet = false }
            )
        }
        .fileImporter(isPresented: $showFileImporter,
                      allowedContentTypes: [.png, .jpeg],
                      allowsMultipleSelection: true) { result in
            if case .success(let urls) = result {
                importFiles(urls)
            }
        }
        .alert("添加图标失败", isPresented: .constant(errorMessage != nil)) {
            Button("好") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
        .alert("删除分类", isPresented: Binding(
            get: { categoryPendingDeletion != nil },
            set: { if !$0 { categoryPendingDeletion = nil } })
        ) {
            Button("取消", role: .cancel) { categoryPendingDeletion = nil }
            Button("删除", role: .destructive) { confirmDeleteCategory() }
        } message: {
            Text("「\(categoryPendingDeletion ?? "")」及其中的图标将被移到废纸篓。")
        }
    }

    private func toggleCategory(_ category: IconCategory) {
        // 动画必须包在状态变更处:这样被点分区的高度变化和相邻
        // 分区的让位移动处于同一个动画事务,严格同步。若改用分区
        // 自己的 .animation(value: isCollapsed),相邻分区因值没变
        // 会瞬移到最终位置,穿过正在收缩的网格,造成重叠闪烁
        //
        // 时长随内容高度分档:4 个图标位移 ~88pt,64 个图标位移
        // ~1900pt,同样 0.15s 内跑完后者必然又冲又卡;大位移给
        // 更长时长,速度才一致
        let itemCount = category.icons.count + (tab == .custom ? 1 : 0)
        let rows = (itemCount + 2) / 3
        let duration = rows > 6 ? 0.32 : 0.15
        // easeOut:起步快、减速收尾。easeInOut 的慢启动+中段猛冲
        // 在大位移下会有明显"前慢后快"的弹射感
        withAnimation(.easeOut(duration: duration)) {
            collapsedOverrides[category.name] = !isCollapsed(category)
        }
        // 动画期间冻结一切光标更新:布局每帧重建光标矩形,
        // 重建空窗期系统回落箭头造成闪烁。时长覆盖动画加收尾余量
        CursorGate.suspend(for: duration + 0.1)
        UserDefaults.standard.set(collapsedOverrides,
                                  forKey: Self.collapsedDefaultsKey)
    }

    private func importFiles(_ urls: [URL]) {
        var firstError: AddIconError?
        for url in urls {
            if case .failure(let error) = store.addIcon(from: url, category: importCategory),
               firstError == nil {
                firstError = error
            }
        }
        switch firstError {
        case .none: break
        case .unsupportedType:
            errorMessage = "部分文件未导入:仅支持 PNG/JPG 图片"
        case .copyFailed:
            errorMessage = "部分文件拷贝失败,请重试"
        }
    }

    private func handleDrop(_ urls: [URL], into category: String) -> Bool {
        importCategory = category
        var handled = false
        for url in urls {
            if case .success = store.addIcon(from: url, category: category) {
                handled = true
            } else {
                errorMessage = "仅支持 PNG/JPG 图片"
            }
        }
        return handled
    }

    private func deleteIcon(_ icon: IconItem) {
        if store.deleteIcon(icon), selectedIcon == icon {
            selectedIcon = nil
        }
    }

    private func confirmDeleteCategory() {
        guard let name = categoryPendingDeletion else { return }
        // 选中图标属于该分类时一并清掉选中
        if let selected = selectedIcon, selected.source == .custom,
           selected.url.deletingLastPathComponent().lastPathComponent == name {
            selectedIcon = nil
        }
        _ = store.deleteCategory(named: name)
        categoryPendingDeletion = nil
    }
}

/// 纸质分段控件:暖灰凹槽 + 滑动白色选中胶囊,比原生 segmented 更轻。
struct PaperTabPicker<T: Hashable & RawRepresentable & CaseIterable & Identifiable>: View
    where T.RawValue == String, T.AllCases: RandomAccessCollection {
    @Binding var selection: T
    @Namespace private var indicator

    var body: some View {
        HStack(spacing: 2) {
            ForEach(T.allCases) { item in
                Button {
                    withAnimation(DesignTokens.animationQuick) {
                        selection = item
                    }
                } label: {
                    Text(item.rawValue)
                        .font(.mieRounded(12, .medium))
                        .foregroundStyle(selection == item ? .primary : .secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 5)
                        .background {
                            if selection == item {
                                Capsule()
                                    .fill(.white)
                                    .shadow(color: DesignTokens.cardShadow,
                                            radius: 3, y: 1)
                                    .matchedGeometryEffect(id: "tab", in: indicator)
                            }
                        }
                        // 透明区域默认不参与命中测试,不补的话只有
                        // 点到文字上才响应;contentShape 让整个
                        // 胶囊区域都可点
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .hoverCursor(.pointingHand)
            }
        }
        .padding(3)
        .background {
            Capsule().fill(DesignTokens.slotFill)
        }
    }
}

/// 一个图标分类分区:可折叠的头部 + 图标网格。
/// isEditable 时(自定义 tab)提供添加卡片、拖放导入、
/// 图标右键删除、分类右键删除;系统预设为只读展示。
struct IconCategorySection: View {
    let category: IconCategory
    let isCollapsed: Bool
    let isDropTargeted: Bool
    let isEditable: Bool
    @Binding var selectedIcon: IconItem?
    let onToggle: () -> Void
    let onAdd: () -> Void
    let onDeleteIcon: (IconItem) -> Void
    /// nil 时不提供"删除分类"右键菜单
    let onDeleteCategory: (() -> Void)?
    let onDrop: ([URL]) -> Bool
    let onDropTargetedChange: (Bool) -> Void

    @State private var isHeaderHovered = false

    // 固定一行 3 列 80pt 卡片,网格总宽恒定 256,左对齐;
    // 侧栏面板宽度按这个网格宽反推(288),不随窗口变化
    private static let cardSize: CGFloat = 80
    private static let gridSpacing = DesignTokens.spacingS
    private static let columnCount = 3
    static let gridWidth = cardSize * CGFloat(columnCount)
        + gridSpacing * CGFloat(columnCount - 1)
    private let columns = Array(
        repeating: GridItem(.fixed(Self.cardSize), spacing: Self.gridSpacing),
        count: Self.columnCount)

    /// 网格完整高度。用公式精确计算而不是 GeometryReader 测量:
    /// 测量要给网格加 fixedSize,会强制 LazyVGrid 把屏幕外的行
    /// 也全部布局,图标一多渲染就垮
    private var gridHeight: CGFloat {
        let itemCount = category.icons.count + (isEditable ? 1 : 0)
        guard itemCount > 0 else { return 0 }
        let rows = (itemCount + Self.columnCount - 1) / Self.columnCount
        return CGFloat(rows) * Self.cardSize + CGFloat(rows - 1) * Self.gridSpacing
    }

    var body: some View {
        Group {
            if isEditable {
                content
                    .dropDestination(for: URL.self) { urls, _ in onDrop(urls) }
                             isTargeted: { onDropTargetedChange($0) }
            } else {
                content
            }
        }
        // 折叠/展开的动画由 toggleCategory 处的 withAnimation 统一
        // 驱动(整列分区同步);此处不再挂 value 动画,避免相邻分区
        // 因自身值未变而瞬移、穿过正在收缩的网格
        .animation(DesignTokens.animationQuick, value: isDropTargeted)
    }

    private var content: some View {
        // 折叠时可折叠区高度归 0,连 header 与内容的间距也一并收掉
        VStack(alignment: .leading,
               spacing: isCollapsed ? 0 : DesignTokens.spacingXS) {
            header
            VStack(alignment: .leading, spacing: DesignTokens.spacingXS) {
                // config.json 的 author/author_url:展开后首行展示
                if hasAuthorInfo {
                    authorRow
                }
                grid
            }
            // 不要加 drawingGroup:Metal 离屏渲染会把卡片里的
            // Image(nsImage:) 渲染成黄底红圈的损坏占位图。
            // 高度从 0 长到完整,把下方内容推开;而不是插入时
            // 透明度渐变——那种写法会让网格直接出现在最终位置,
            // 和滑动让位的下方分区互相穿过,看起来就是闪烁。
            // 高度是精确值,不限制 LazyVGrid 的懒加载:屏幕外
            // 的行不会被实例化
            //
            // 投影缓冲:选中卡的橙色投影(radius 8)和 1.04 缩放
            // 会探出网格约 14pt,而裁切框恰好贴着网格四边,探出
            // 部分被齐边切断(选中态"超框"硬边)。四向先垫 14pt
            // 再裁切,裁的是透明缓冲带;外层负 padding 抵消布局
            // 占位,对齐关系不变
            .padding(14)
            .frame(height: isCollapsed ? 0 : collapsibleHeight + 28,
                   alignment: .top)
            .clipped()
            .padding(-14)
        }
        .padding(DesignTokens.spacingXS)
        .overlay {
            RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusSmall)
                .stroke(isDropTargeted ? DesignTokens.selectionStroke : .clear,
                        style: StrokeStyle(lineWidth: 2, dash: [6]))
        }
        .background {
            RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusSmall)
                .fill(isDropTargeted ? DesignTokens.selectionFill : .clear)
        }
    }

    /// 作者行固定高度,保证可折叠区总高可精确计算
    private static let authorRowHeight: CGFloat = 16

    private var hasAuthorInfo: Bool {
        category.config.author != nil || category.config.authorURL != nil
    }

    /// 可折叠区总高 = 作者行(若有,含与网格的间距) + 网格高
    private var collapsibleHeight: CGFloat {
        let authorPart = hasAuthorInfo
            ? Self.authorRowHeight + DesignTokens.spacingXS : 0
        return authorPart + gridHeight
    }

    private var authorRow: some View {
        HStack(spacing: 4) {
            Image(systemName: "person")
                .font(.system(size: 9))
                .foregroundStyle(.tertiary)
            if let url = category.config.authorURL {
                // 有作者地址时名称变为链接,点击打开主页
                Link(category.config.author ?? url.host ?? url.absoluteString,
                     destination: url)
                    .font(.system(size: 11))
            } else {
                Text(category.config.author ?? "")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(.horizontal, 6)
        .frame(height: Self.authorRowHeight, alignment: .center)
    }

    private var grid: some View {
        LazyVGrid(columns: columns, alignment: .leading,
                  spacing: DesignTokens.spacingS) {
            ForEach(category.icons) { icon in
                IconCard(
                    icon: icon,
                    isSelected: selectedIcon == icon,
                    onDelete: isEditable ? { onDeleteIcon(icon) } : nil
                )
                .onTapGesture { selectedIcon = icon }
            }
            if isEditable {
                AddIconCard(action: onAdd)
            }
        }
        // 固定网格宽,左对齐;不框宽的话 LazyVGrid 会把
        // 固定列散布在整个可用宽度里,看起来是"居中/分散"
        .frame(width: Self.gridWidth, alignment: .leading)
    }

    private var header: some View {
        HStack(spacing: 6) {
            Image(systemName: "chevron.right")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(.secondary)
                .rotationEffect(.degrees(isCollapsed ? 0 : 90))
            Text(category.name)
                .font(.mieRounded(13))
                // 分类名可能很长(文件夹名),截断而不是换行撑高头部
                .lineLimit(1)
                .truncationMode(.middle)
            // config.json 的 brandName:antd Tag 风格小徽标
            if let brandName = category.config.brandName, !brandName.isEmpty {
                BrandBadge(name: brandName,
                           colorHex: category.config.brandColor)
            }
            Text("\(category.icons.count)")
                .font(.system(size: 11))
                .foregroundStyle(.tertiary)
            Spacer()
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .background {
            RoundedRectangle(cornerRadius: 6)
                .fill(isHeaderHovered ? DesignTokens.hoverFill : .clear)
        }
        .onHover { isHeaderHovered = $0 }
        .onTapGesture { onToggle() }
        .hoverCursor(.pointingHand)
        .help(isCollapsed ? "展开分类" : "折叠分类")
        .contextMenu {
            if let onDeleteCategory {
                Button("删除分类…", role: .destructive, action: onDeleteCategory)
            }
        }
    }
}

/// antd Tag 风格的小徽标:纯色圆角底 + 白色文字。
/// 背景色来自 config.json 的 brandColor,缺省 #0958d9
struct BrandBadge: View {
    let name: String
    /// 十六进制色值;nil 或非法时用默认色
    let colorHex: String?

    static let defaultColor = Color(hex: "#0958d9")!

    var body: some View {
        Text(name)
            .font(.system(size: 9, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 5)
            .padding(.vertical, 1.5)
            .background {
                RoundedRectangle(cornerRadius: 4)
                    .fill(colorHex.flatMap(Color.init(hex:)) ?? Self.defaultColor)
            }
            .fixedSize()
    }
}

struct IconCard: View {
    let icon: IconItem
    let isSelected: Bool
    /// 非 nil 时提供右键"删除"菜单(仅自定义图标)
    var onDelete: (() -> Void)?

    @State private var isHovered = false
    // 卡片重建(折叠展开/tab 切换)时 @State 会清空;真正的
    // 图片缓存在 IconItem 进程级缓存里,这里只是本卡片的展示态
    @State private var image: NSImage?

    var body: some View {
        VStack(spacing: 2) {
            if let image {
                Image(nsImage: image)
                    .resizable()
                    .frame(width: 48, height: 48)
            } else {
                Image(systemName: "questionmark.square.dashed")
                    .font(.system(size: 32))
                    .frame(width: 48, height: 48)
            }
            Text(icon.name)
                .font(.system(size: 10))
                .lineLimit(1)
                .truncationMode(.middle)
        }
        .padding(DesignTokens.spacingS)
        // 固定方形,不随文字多少变成竖长矩形
        .frame(width: 80, height: 80)
        .background {
            // 贴纸本体:始终是张白卡,靠描边立在面板上
            RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusSmall)
                .fill(isSelected ? DesignTokens.selectionFill : .white)
        }
        .overlay {
            // strokeBorder 完全画在边界内;stroke 是骑线描边,
            // 会有 0.75pt 探出卡片,被网格的 clipped() 裁掉一线
            RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusSmall)
                .strokeBorder(isSelected ? DesignTokens.selectionStroke
                                         : DesignTokens.cardBorder,
                              lineWidth: isSelected ? 1.5 : 1)
        }
        // 投影只在 hover/选中时出现:几十张贴纸常亮投影会拖垮滚动
        .shadow(color: isSelected
                ? DesignTokens.brand.opacity(0.35)
                : (isHovered ? DesignTokens.stickerShadow : .clear),
                radius: isSelected ? 8 : 6, y: isSelected ? 3 : 2)
        // 颜色与缩放分开驱动:spring 过冲若传染给填充/描边/投影,
        // 选中瞬间会冲过目标值再回落,体感像"先变亮闪一下";
        // 就近的 value 动画管各自属性——颜色快速 easeOut,缩放保留回弹
        .animation(DesignTokens.animationQuick, value: isSelected)
        // hover 上浮:贴纸被拈起来一点;offset 不参与布局,不推挤邻居
        .offset(y: isHovered && !isSelected ? -2 : 0)
        // 选中回弹:过冲再坐稳,"啪"地贴住
        .scaleEffect(isSelected ? 1.04 : 1)
        .contentShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusSmall))
        .animation(DesignTokens.animationQuick, value: isHovered)
        .animation(DesignTokens.stickerSpring, value: isSelected)
        .onHover { isHovered = $0 }
        .hoverCursor(.pointingHand)
        .onAppear {
            // 缓存命中:同步上屏,不闪占位符;未命中:后台读盘
            // + 解码,不阻塞主线程(折叠展开频繁重建卡片的关键路径)
            if let cached = icon.cachedImage {
                image = cached
            } else {
                Task {
                    image = await Task.detached(priority: .userInitiated) {
                        icon.loadImage()
                    }.value
                }
            }
        }
        .help(icon.name)
        .contextMenu {
            if let onDelete {
                Button("删除", role: .destructive, action: onDelete)
            }
        }
    }
}

struct AddIconCard: View {
    let action: () -> Void
    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            Image(systemName: "plus")
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(.secondary)
                // 与图标卡片一致的方形尺寸
                .frame(width: 80, height: 80)
                .background {
                    RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusSmall)
                        .fill(isHovered ? DesignTokens.hoverFill : .clear)
                }
                .overlay {
                    RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusSmall)
                        .strokeBorder(Color.secondary.opacity(0.4),
                                      style: StrokeStyle(lineWidth: 1, dash: [4]))
                }
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .hoverCursor(.pointingHand)
        .help("添加图标到当前分类(PNG/JPG),也可以直接把图片拖到某个分类上")
    }
}

/// 导入素材弹窗:选择已有的自定义分类,或新建一个分类。
/// 系统预设分类不可选(列表只传自定义分类)。
struct ImportIconSheet: View {
    let categories: [String]
    /// 确认回调,参数为最终分类名(新建时为输入的名称)
    let onImport: (String) -> Void
    let onCancel: () -> Void

    /// Picker 中"新建分类"项的占位值(用控制字符避免与真实分类名撞车)
    private static let newSentinel = "\u{1}newCategory"

    @State private var selection: String
    @State private var newName = ""

    init(categories: [String],
         onImport: @escaping (String) -> Void,
         onCancel: @escaping () -> Void) {
        self.categories = categories
        self.onImport = onImport
        self.onCancel = onCancel
        // 默认选中第一个已有分类;一个都没有时直接进入新建态
        _selection = State(initialValue: categories.first ?? Self.newSentinel)
    }

    private var isNew: Bool { selection == Self.newSentinel }
    private var trimmedName: String {
        newName.trimmingCharacters(in: .whitespaces)
    }
    private var isValid: Bool {
        guard isNew else {
            // 分类可能被删完,旧选中已失效时不放行
            return categories.contains(selection)
        }
        // 名称要能成为合法的文件夹名
        return !trimmedName.isEmpty
            && !trimmedName.contains("/")
            && trimmedName != "." && trimmedName != ".."
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.spacingM) {
            Text("导入素材")
                .font(.headline)

            Picker("目标分类", selection: $selection) {
                ForEach(categories, id: \.self) { name in
                    Text(name).tag(name)
                }
                Divider()
                Text("新建分类…").tag(Self.newSentinel)
            }

            if isNew {
                TextField("分类名称", text: $newName)
                    .textFieldStyle(.roundedBorder)
            }

            HStack(spacing: DesignTokens.spacingS) {
                Spacer()
                Button("取消", action: onCancel)
                    .buttonStyle(.capsule)
                    .keyboardShortcut(.cancelAction)
                Button("选择图片…") {
                    onImport(isNew ? trimmedName : selection)
                }
                .buttonStyle(.capsuleProminent)
                .keyboardShortcut(.defaultAction)
                .disabled(!isValid)
            }
        }
        .padding(DesignTokens.spacingL)
        .frame(width: 300)
    }
}
