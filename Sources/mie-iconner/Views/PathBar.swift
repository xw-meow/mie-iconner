import SwiftUI
import AppKit
import MieIconnerCore

/// 路径无效时的水平抖动
struct ShakeEffect: GeometryEffect {
    var shakes: CGFloat

    var animatableData: CGFloat {
        get { shakes }
        set { shakes = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(
            translationX: 8 * sin(shakes * .pi * 3), y: 0))
    }
}

struct PathBar: View {
    let browser: FolderBrowserViewModel
    /// 刷新按钮回调:重扫目录 + 强刷桌面图标 + 清理失效选中
    let onRefresh: () -> Void

    @State private var pathText = ""
    @State private var isInvalid = false
    @State private var shakeTrigger: CGFloat = 0
    @State private var isHoveringOmnibox = false
    @State private var isHoveringBack = false
    @State private var isHoveringRefresh = false
    @State private var eventMonitor: Any?
    @State private var selectAllPending = false
    @State private var isFullScreen = false
    /// 下拉建议列表
    @State private var suggestions: [PathSuggestion] = []
    /// 高亮建议下标;nil 表示无高亮(输入态)
    @State private var highlightedIndex: Int?
    /// 键盘进入高亮循环前的用户原文,回到输入态时还原
    @State private var typedText: String?
    /// 程序化改写 pathText(导航同步/高亮替换)时置位,抑制建议重算
    @State private var suppressSuggestions = false
    /// 下拉面板在窗口坐标系中的 frame,供点击命中判定
    @State private var panelFrame: CGRect = .zero
    @FocusState private var isFocused: Bool

    private var panelVisible: Bool { isFocused && !suggestions.isEmpty }

    var body: some View {
        HStack(spacing: DesignTokens.spacingS) {
            backButton
            refreshButton
            omnibox
        }
        // 隐藏标题栏后,红黄绿按钮悬浮在左上角,让出它们的区域;
        // 全屏时按钮自动隐藏,地址栏填满整行,不留空白
        .padding(.leading, isFullScreen ? DesignTokens.spacingM : 78)
        .padding(.trailing, DesignTokens.spacingM)
        .padding(.vertical, DesignTokens.spacingS)
        .background(WindowDragArea())
        // 不用全局动画:退出全屏(缩小)时按钮立即出现,padding
        // 若渐变会与之重叠,必须瞬移;进入全屏(放大)则用动画过渡
        .onReceive(NotificationCenter.default.publisher(
            for: NSWindow.didEnterFullScreenNotification)) { _ in
            withAnimation(DesignTokens.animationMedium) {
                isFullScreen = true
            }
        }
        // willExit 提前让位,赶在按钮可见之前;didExit 兜底
        .onReceive(NotificationCenter.default.publisher(
            for: NSWindow.willExitFullScreenNotification)) { _ in
            isFullScreen = false
        }
        .onReceive(NotificationCenter.default.publisher(
            for: NSWindow.didExitFullScreenNotification)) { _ in
            isFullScreen = false
        }
        .onAppear {
            syncPath()
            installEventMonitor()
        }
        .onDisappear {
            if let monitor = eventMonitor {
                NSEvent.removeMonitor(monitor)
                eventMonitor = nil
            }
        }
        .onChange(of: browser.currentURL) {
            syncPath()
            closePanel()
        }
        .onChange(of: pathText) {
            if suppressSuggestions {
                suppressSuggestions = false
            } else {
                updateSuggestions()
            }
        }
        // 聚焦即全选,像 Chrome 一样方便直接覆盖输入。
        // 点击触发的聚焦除外:此时由 mouseUp 监听延迟执行全选,
        // 否则 mouseUp 会按点击位置重新定位光标,全选被立刻取消,看起来在闪
        .onChange(of: isFocused) {
            if isFocused {
                updateSuggestions()
                guard !selectAllPending else { return }
                DispatchQueue.main.async {
                    (NSApp.keyWindow?.firstResponder as? NSTextView)?.selectAll(nil)
                }
            } else {
                // 失焦即关面板,并把文本还原为当前路径:
                // 高亮替换/未提交的输入都不残留,像 Chrome 一样
                closePanel()
                syncPath()
            }
        }
        .animation(DesignTokens.animationQuick, value: isFocused)
        .animation(DesignTokens.animationQuick, value: isHoveringOmnibox)
        .animation(DesignTokens.animationQuick, value: isHoveringBack)
        .animation(DesignTokens.animationQuick, value: isHoveringRefresh)
    }

    // MARK: - 返回按钮(圆形悬停按钮)

    private var backButton: some View {
        Button {
            browser.goUp()
        } label: {
            Image(systemName: "chevron.left")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(browser.canGoUp ? Color.primary
                                                 : Color.secondary.opacity(0.5))
                .frame(width: 26, height: 26)
                .background {
                    Circle().fill(isHoveringBack && browser.canGoUp
                                  ? DesignTokens.hoverFill : .clear)
                }
        }
        .buttonStyle(.plain)
        .disabled(!browser.canGoUp)
        .hoverCursor(.pointingHand)
        .onHover { isHoveringBack = $0 }
        .help("返回上一级")
    }

    // MARK: - 刷新按钮(重扫目录 + 强刷桌面图标)

    private var refreshButton: some View {
        Button {
            onRefresh()
        } label: {
            Image(systemName: "arrow.clockwise")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.primary)
                .frame(width: 26, height: 26)
                .background {
                    Circle().fill(isHoveringRefresh
                                  ? DesignTokens.hoverFill : .clear)
                }
        }
        .buttonStyle(.plain)
        .hoverCursor(.pointingHand)
        .onHover { isHoveringRefresh = $0 }
        .help("刷新当前目录与桌面图标")
    }

    // MARK: - 地址栏(omnibox 胶囊)

    private var omnibox: some View {
        HStack(spacing: DesignTokens.spacingS) {
            Image(systemName: "folder.fill")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)

            TextField("输入路径,回车直达", text: $pathText)
                .textFieldStyle(.plain)
                .font(.system(size: 13))
                .focused($isFocused)
                .onSubmit {
                    if browser.goTo(pathText) {
                        isInvalid = false
                        closePanel()
                    } else {
                        isInvalid = true
                        withAnimation(DesignTokens.animationMedium) {
                            shakeTrigger += 1
                        }
                    }
                }

            if !pathText.isEmpty {
                Button {
                    pathText = ""
                    closePanel()
                    isFocused = true
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(.tertiary)
                }
                .buttonStyle(.plain)
                .hoverCursor(.pointingHand)
                .help("清除输入")
                .transition(.opacity)
            }
        }
        .padding(.horizontal, DesignTokens.spacingM)
        .frame(height: 30)
        .background { Capsule().fill(.white) }
        .overlay {
            Capsule().strokeBorder(
                isFocused || isInvalid ? ringColor
                                       : DesignTokens.cardBorder,
                lineWidth: 1)
        }
        .shadow(color: isFocused ? DesignTokens.brand.opacity(0.25)
                                 : DesignTokens.cardShadow,
                radius: isFocused ? 8 : 4, y: 2)
        .modifier(ShakeEffect(shakes: shakeTrigger))
        .contentShape(Capsule())
        .onHover { isHoveringOmnibox = $0 }
        .onTapGesture { isFocused = true }
        .animation(DesignTokens.animationQuick, value: pathText.isEmpty)
        // 下拉建议面板:悬浮在胶囊正下方、同宽;挂在最后,
        // 保证面板行的点击命中优先于上面的胶囊手势
        .overlay(alignment: .top) {
            if panelVisible {
                suggestionPanel
                    .offset(y: 36)
                    .transition(.opacity)
            }
        }
        .animation(DesignTokens.animationQuick, value: panelVisible)
    }

    // MARK: - 下拉建议面板

    private var suggestionPanel: some View {
        VStack(alignment: .leading, spacing: 2) {
            ForEach(Array(suggestions.enumerated()), id: \.element.id) { index, suggestion in
                HStack(spacing: DesignTokens.spacingS) {
                    Image(systemName: "folder.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                    Text(suggestion.name)
                        .font(.system(size: 13))
                        .lineLimit(1)
                    Spacer(minLength: DesignTokens.spacingM)
                    Text(suggestion.displayPath)
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                .padding(.horizontal, 10)
                .frame(height: 28)
                .background {
                    RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusSmall)
                        .fill(index == highlightedIndex
                              ? DesignTokens.selectionFill : .clear)
                }
                .contentShape(Rectangle())
                .onTapGesture { accept(suggestion) }
                .onHover { hovering in
                    if hovering { highlightedIndex = index }
                }
                .hoverCursor(.pointingHand)
            }
        }
        .padding(DesignTokens.spacingXS)
        .frame(maxWidth: .infinity)
        .background {
            RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusLarge,
                             style: .continuous)
                .fill(.white)
        }
        .overlay {
            RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusLarge,
                             style: .continuous)
                .strokeBorder(DesignTokens.cardBorder, lineWidth: 1)
        }
        .shadow(color: DesignTokens.stickerShadow, radius: 16, y: 6)
        // 上报面板在窗口中的 frame,点击面板时事件监听保持焦点
        .background(WindowFrameReporter(frame: $panelFrame))
    }

    /// 描边:错误红环优先,其次聚焦主题色环
    private var ringColor: Color {
        if isInvalid { return DesignTokens.errorStroke }
        return isFocused ? DesignTokens.brand : .clear
    }

    // MARK: - 建议状态管理

    private func updateSuggestions() {
        suggestions = PathSuggester.suggestions(for: pathText)
        highlightedIndex = nil
        typedText = nil
    }

    private func closePanel() {
        suggestions = []
        highlightedIndex = nil
        typedText = nil
    }

    /// ↑/↓ 在建议间移动高亮,越界回到输入态(恢复用户原文),像 Chrome 一样循环
    private func moveHighlight(_ delta: Int) {
        guard !suggestions.isEmpty else { return }
        if typedText == nil { typedText = pathText }
        let count = suggestions.count
        let next: Int?
        if let current = highlightedIndex {
            let value = current + delta
            next = (value < 0 || value >= count) ? nil : value
        } else {
            next = delta > 0 ? 0 : count - 1
        }
        highlightedIndex = next
        suppressSuggestions = true
        if let next {
            pathText = suggestions[next].displayPath
        } else {
            pathText = typedText ?? ""
            typedText = nil
        }
    }

    private func accept(_ suggestion: PathSuggestion) {
        closePanel()
        browser.goTo(suggestion.url.path)
        isFocused = false
    }

    private func syncPath() {
        let text = PathResolver.displayPath(for: browser.currentURL)
        // 文本没变就别动 suppress:否则抑制标记会 stuck,
        // 吞掉用户下一次输入触发的建议刷新
        if text != pathText {
            suppressSuggestions = true
            pathText = text
        }
        isInvalid = false
    }

    // MARK: - 事件监听(点击失焦/全选 + 键盘导航)

    /// macOS 点空白区域不会自动取消文本框焦点,这里点击落在
    /// 胶囊以外的地方时主动失焦,还原三态样式。判定方法:
    /// 聚焦时窗口第一响应者就是输入框的 field editor,
    /// 用它自身的坐标转换把胶囊区域(输入框向外扩一圈,
    /// 覆盖图标/留白/清除按钮)纳入"内部",避免手算窗口坐标;
    /// 下拉面板区域由 WindowFrameReporter 上报,同样算"内部"。
    ///
    /// 同时负责两件事:
    /// - "点击聚焦后全选":mouseDown 时若尚未聚焦则打标记,mouseUp
    ///   之后再执行全选——若在聚焦瞬间(mouseDown)就全选,mouseUp
    ///   会按点击位置重新定位光标,把全选取消掉,看起来在闪。
    /// - 键盘导航:↑/↓ 移动高亮、回车直达高亮项、Esc 关面板/失焦。
    ///   走 NSEvent 而不是 onKeyPress,规避 TextField 对这些键的
    ///   吞键不确定性;IME 组合中(hasMarkedText)全部放行。
    private func installEventMonitor() {
        eventMonitor = NSEvent.addLocalMonitorForEvents(
            matching: [.leftMouseDown, .leftMouseUp, .keyDown]
        ) { event in
            if event.type == .keyDown {
                return handleKeyDown(event)
            }

            if event.type == .leftMouseUp {
                if selectAllPending {
                    selectAllPending = false
                    DispatchQueue.main.async {
                        (NSApp.keyWindow?.firstResponder as? NSTextView)?
                            .selectAll(nil)
                    }
                }
                return event
            }

            // leftMouseDown
            if isFocused {
                guard let window = event.window,
                      let editor = window.firstResponder as? NSTextView
                else { return event }

                let point = editor.convert(event.locationInWindow, from: nil)
                let capsuleZone = editor.bounds.insetBy(dx: -40, dy: -8)
                if capsuleZone.contains(point) { return event }
                // 点击落在下拉面板内:保持焦点,交给建议项的点击手势
                if panelVisible, panelFrame.contains(event.locationInWindow) {
                    return event
                }
                isFocused = false
            } else {
                // 未聚焦时的任何点击都可能让输入框聚焦;
                // 若最终没有聚焦(firstResponder 非文本),mouseUp 的全选自然落空
                selectAllPending = true
            }
            return event
        }
    }

    private func handleKeyDown(_ event: NSEvent) -> NSEvent? {
        guard isFocused else { return event }
        // IME 组合中(中文输入法选词等)不拦截任何键
        if let editor = NSApp.keyWindow?.firstResponder as? NSTextView,
           editor.hasMarkedText() {
            return event
        }
        switch event.keyCode {
        case 125 where panelVisible: // ↓
            moveHighlight(1)
            return nil
        case 126 where panelVisible: // ↑
            moveHighlight(-1)
            return nil
        case 53: // Esc:面板开则关面板并还原输入,否则失焦
            if panelVisible {
                if let typed = typedText {
                    suppressSuggestions = true
                    pathText = typed
                }
                closePanel()
            } else {
                isFocused = false
            }
            return nil
        case 36, 76: // Return / 小键盘 Enter:有高亮直达,否则交给 onSubmit
            if let index = highlightedIndex, suggestions.indices.contains(index) {
                accept(suggestions[index])
                return nil
            }
            return event
        default:
            return event
        }
    }
}

/// 把承载视图在窗口坐标系中的 frame 持续上报,供 NSEvent 监听做
/// 命中判定。仅在 frame 变化时异步写回,避免布局环与视图更新期改状态。
private struct WindowFrameReporter: NSViewRepresentable {
    @Binding var frame: CGRect

    func makeNSView(context: Context) -> WindowFrameReporterView {
        WindowFrameReporterView { frame = $0 }
    }

    func updateNSView(_ nsView: WindowFrameReporterView, context: Context) {
        nsView.onFrameChange = { frame = $0 }
    }
}

private final class WindowFrameReporterView: NSView {
    var onFrameChange: (CGRect) -> Void
    private var lastReported: CGRect = .zero

    init(onFrameChange: @escaping (CGRect) -> Void) {
        self.onFrameChange = onFrameChange
        super.init(frame: .zero)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        reportFrame()
    }

    override func layout() {
        super.layout()
        reportFrame()
    }

    private func reportFrame() {
        guard window != nil else { return }
        let frame = convert(bounds, to: nil)
        guard frame != lastReported else { return }
        lastReported = frame
        let onFrameChange = onFrameChange
        DispatchQueue.main.async { onFrameChange(frame) }
    }
}

#Preview {
    PathBar(browser: FolderBrowserViewModel(
        startURL: FileManager.default.homeDirectoryForCurrentUser),
            onRefresh: {})
}
