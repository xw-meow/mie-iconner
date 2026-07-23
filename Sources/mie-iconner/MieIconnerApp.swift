import SwiftUI
import AppKit

/// 裸可执行文件(非 .app bundle)默认不是前台应用,macOS 不为其创建可见窗口。
/// 启动时把激活策略设为 .regular 并主动激活,窗口才会出现。
final class AppDelegate: NSObject, NSApplicationDelegate {
    /// 悬浮红黄绿按钮的目标垂直中心(距窗口顶部),与地址栏胶囊对齐:
    /// 顶部 padding 8 + 胶囊高 30/2 = 23
    private static let trafficLightTargetCenter: CGFloat = 23

    /// WindowGroup 的 window delegate 由 SwiftUI 占用,用代理转发
    /// 的方式只拦截 zoom 相关方法,其余调用原样转给原代理
    private var delegateProxies: [ObjectIdentifier: ZoomFillDelegateProxy] = [:]

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
        for window in NSApplication.shared.windows {
            window.makeKeyAndOrderFront(nil)
            installZoomFillProxy(for: window)
        }
        // 进出全屏会重置按钮位置,需要重新对齐
        for name in [NSWindow.didEnterFullScreenNotification,
                     NSWindow.willExitFullScreenNotification,
                     NSWindow.didExitFullScreenNotification] {
            NotificationCenter.default.addObserver(
                self, selector: #selector(realignTrafficLights(_:)),
                name: name, object: nil)
        }
        // 全屏过渡动画期间系统会逐帧把按钮重置回默认位置,
        // 在每次 resize 时同步对齐(幂等),让按钮全程钉在目标位,
        // 否则过渡中按钮偏上、结束瞬间跳下来,看着像抖动
        NotificationCenter.default.addObserver(
            self, selector: #selector(alignOnResize(_:)),
            name: NSWindow.didResizeNotification, object: nil)
        // 滚动期间挂起光标系统:滚动每帧都改变卡片 NSView 位置,
        // 触发全窗口光标矩形重建(O(卡片数)/帧),是滚动卡顿的
        // 主因。滚轮事件连续到达会不断刷新挂起窗口,停滚 0.2s
        // 后统一恢复重注册
        NSEvent.addLocalMonitorForEvents(matching: .scrollWheel) { event in
            CursorGate.suspend(for: 0.2)
            return event
        }
        // 光标兜底解析:ApplyBar 按钮等层级里光标矩形/tracking
        // area 均不生效,按各 CursorRectView 的真实 frame 手动判定
        NSEvent.addLocalMonitorForEvents(matching: .mouseMoved) { event in
            CursorRegionResolver.resolve(in: event.window,
                                         point: event.locationInWindow)
            return event
        }
        // 布局可能尚未完成,对齐是幂等的,立即 + 延迟各执行一次
        DispatchQueue.main.async { self.alignAllWindows() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.alignAllWindows()
        }
    }

    /// zoom(绿键)默认不撑满屏幕,因为 SwiftUI 没把屏幕可见区域
    /// 作为标准帧。安装代理让 zoom 直接使用屏幕可见区域。
    private func installZoomFillProxy(for window: NSWindow) {
        let proxy = ZoomFillDelegateProxy(original: window.delegate)
        window.delegate = proxy
        delegateProxies[ObjectIdentifier(window)] = proxy
    }

    @objc private func realignTrafficLights(_ note: Notification) {
        guard let window = note.object as? NSWindow else { return }
        // 同步执行一次,避免按钮在可见时仍停在系统默认位置;
        // 异步再兜底一次(退出全屏的布局可能在通知后才稳定)
        Self.alignTrafficLights(in: window)
        DispatchQueue.main.async { Self.alignTrafficLights(in: window) }
    }

    @objc private func alignOnResize(_ note: Notification) {
        guard let window = note.object as? NSWindow else { return }
        Self.alignTrafficLights(in: window)
    }

    private func alignAllWindows() {
        for window in NSApplication.shared.windows {
            Self.alignTrafficLights(in: window)
        }
    }

    /// 把红黄绿按钮垂直移动到与地址栏行居中。
    /// 先测出按钮中心距窗口顶部的当前值,与目标值求差后换算到
    /// 按钮父视图的坐标系方向(是否 flipped)再平移,全程用
    /// AppKit 自身坐标转换,不手算标题栏偏移。
    static func alignTrafficLights(in window: NSWindow) {
        let types: [NSWindow.ButtonType] = [.closeButton,
                                            .miniaturizeButton, .zoomButton]
        for type in types {
            guard let button = window.standardWindowButton(type),
                  let superview = button.superview else { continue }
            let rectInWindow = button.convert(button.bounds, to: nil)
            let centerFromTop = window.frame.height - rectInWindow.midY
            let delta = centerFromTop - trafficLightTargetCenter
            // 非 flipped 父视图(原点左下):delta<0 表示按钮偏高,
            // 下移要减 y,即 += delta;flipped 父视图方向相反
            button.frame.origin.y += superview.isFlipped ? -delta : delta
        }
    }
}

@main
struct MieIconnerApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    init() {
        // 尽早声明为常规前台应用,晚于启动完成再设置可能来不及
        NSApplication.shared.setActivationPolicy(.regular)
        // 裸可执行文件没有 .app bundle 的本地化声明,系统面板
        // (文件选择器/权限弹窗等)会回落英文。把进程语言对齐到
        // 系统偏好语言列表,系统 UI 跟随系统语言
        UserDefaults.standard.register(defaults: [
            "AppleLanguages": Locale.preferredLanguages
        ])
    }

    var body: some Scene {
        WindowGroup("小羊贴纸铺") {
            // 忽略顶部 safe area,让地址栏延伸到悬浮按钮同一行,
            // 否则按钮独占一条空白横带,地址栏被推到下面
            ContentView()
                .ignoresSafeArea()
        }
        // 隐藏标题栏,红黄绿按钮悬浮在内容区左上角,界面更紧凑现代
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 960, height: 640)
    }
}

/// zoom(绿键/双击标题区)时让窗口使用屏幕可见区域,撑满整个屏幕。
/// 只拦截 windowWillUseStandardFrame,其余 delegate 调用全部
/// 转发给 SwiftUI 的原代理,不影响 WindowGroup 内部行为。
final class ZoomFillDelegateProxy: NSObject, NSWindowDelegate {
    private weak var original: NSWindowDelegate?

    init(original: NSWindowDelegate?) {
        self.original = original
    }

    func windowWillUseStandardFrame(_ window: NSWindow,
                                    defaultFrame newFrame: NSRect) -> NSRect {
        window.screen?.visibleFrame ?? newFrame
    }

    override func responds(to aSelector: Selector!) -> Bool {
        if aSelector == #selector(windowWillUseStandardFrame(_:defaultFrame:)) {
            return true
        }
        return original?.responds(to: aSelector) ?? false
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        original
    }
}
