import SwiftUI
import AppKit

/// 布局动画(如分类折叠/展开)与滚动期间冻结一切光标更新。
/// 动画/滚动的每一帧都有大量 NSView 尺寸位置变化,触发光标
/// 矩形"失效→重建";一是重建空窗期 AppKit 找不到光标矩形会
/// 回落到箭头,下一帧手型矩形重建又跳回手型——光标以帧率
/// 闪动;二是全窗口矩形重建本身是每帧 O(全部卡片)的 AppKit
/// 调用,滚动时就是卡顿。挂起期间:不注册矩形、不失效、
/// tracking 事件不 set,光标保持之前的状态;结束后统一失效
/// 重注册,按鼠标当前位置重新解析
enum CursorGate {
    private(set) static var isSuspended = false
    /// 代际计数:连续挂起请求(如滚动期间每帧的滚轮事件)
    /// 会刷新截止时间,旧请求的定时器到期不解除新挂起
    private static var generation = 0

    static func suspend(for duration: TimeInterval) {
        isSuspended = true
        generation += 1
        let ticket = generation
        DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
            // 期间又有新的挂起请求,本次到期作废
            guard ticket == generation else { return }
            isSuspended = false
            // 统一失效重注册,系统按鼠标当前位置重新解析光标
            for view in CursorRectView.liveInstances.allObjects {
                view.window?.invalidateCursorRects(for: view)
            }
            for view in ContainerCursorView.liveInstances.allObjects {
                view.window?.invalidateCursorRects(for: view)
            }
        }
    }
}

/// 声明式光标修饰器,双保险:
/// 1. addCursorRect 注册光标矩形(macOS 标准机制,跨鼠标移动持续生效)
/// 2. tracking area 在 mouseEntered/mouseMoved 时无条件 set 光标,
///    对抗某些上下文下光标矩形被系统重置的情况
private final class CursorRectView: NSView {
    /// 所有存活实例的弱引用表,供容器级光标判定"鼠标是否处于
    /// 某个深层光标区域(如卡片手型)之上",是则让位不抢光标
    static let liveInstances = NSHashTable<CursorRectView>(options: .weakMemory)

    var cursor: NSCursor = .pointingHand {
        didSet { window?.invalidateCursorRects(for: self) }
    }

    override func resetCursorRects() {
        super.resetCursorRects()
        // 挂起期间不注册,防止矩形重建空窗期系统回落箭头造成闪烁
        guard !CursorGate.isSuspended else { return }
        addCursorRect(visibleRect, cursor: cursor)
    }

    override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        // 挂起期间不失效:动画每帧的尺寸变化都会触发失效→重建,
        // 这正是光标闪动的根源
        guard !CursorGate.isSuspended else { return }
        window?.invalidateCursorRects(for: self)
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window != nil {
            Self.liveInstances.add(self)
        } else {
            Self.liveInstances.remove(self)
        }
        window?.invalidateCursorRects(for: self)
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        for area in trackingAreas { removeTrackingArea(area) }
        addTrackingArea(NSTrackingArea(
            rect: bounds,
            options: [.mouseEnteredAndExited, .mouseMoved, .activeAlways, .inVisibleRect],
            owner: self,
            userInfo: nil
        ))
    }

    override func mouseEntered(with event: NSEvent) {
        guard !CursorGate.isSuspended else { return }
        cursor.set()
    }

    override func mouseMoved(with event: NSEvent) {
        guard !CursorGate.isSuspended else { return }
        cursor.set()
    }
}

private struct CursorRepresentable: NSViewRepresentable {
    let cursor: NSCursor

    func makeNSView(context: Context) -> CursorRectView {
        let view = CursorRectView()
        view.cursor = cursor
        return view
    }

    func updateNSView(_ nsView: CursorRectView, context: Context) {
        nsView.cursor = cursor
    }
}

extension View {
    /// 鼠标悬停在此视图上时显示指定光标(如 .pointingHand)。
    func hoverCursor(_ cursor: NSCursor) -> some View {
        background(CursorRepresentable(cursor: cursor))
    }
}

/// 容器级兜底光标,用于面板空白区域(如图标库空白处)。
/// 与 hoverCursor 的区别:鼠标处于任何深层 CursorRectView
/// (如卡片的手型区域)之上时主动让位,不与子视图抢光标。
private final class ContainerCursorView: NSView {
    var cursor: NSCursor = .arrow

    /// 所有存活实例的弱引用表,供动画挂起结束后统一失效重注册
    static let liveInstances = NSHashTable<ContainerCursorView>(options: .weakMemory)

    override func resetCursorRects() {
        super.resetCursorRects()
        // 挂起期间不注册容器箭头矩形,避免与卡片手型交替生效
        guard !CursorGate.isSuspended else { return }
        addCursorRect(visibleRect, cursor: cursor)
    }

    override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        guard !CursorGate.isSuspended else { return }
        window?.invalidateCursorRects(for: self)
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window != nil {
            Self.liveInstances.add(self)
        } else {
            Self.liveInstances.remove(self)
        }
        window?.invalidateCursorRects(for: self)
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        for area in trackingAreas { removeTrackingArea(area) }
        addTrackingArea(NSTrackingArea(
            rect: bounds,
            options: [.mouseEnteredAndExited, .mouseMoved, .activeAlways, .inVisibleRect],
            owner: self,
            userInfo: nil
        ))
    }

    override func mouseEntered(with event: NSEvent) {
        setUnlessOverOwnedRegion(event)
    }

    override func mouseMoved(with event: NSEvent) {
        setUnlessOverOwnedRegion(event)
    }

    private func setUnlessOverOwnedRegion(_ event: NSEvent) {
        // 挂起期间不抢光标
        guard !CursorGate.isSuspended else { return }
        let point = event.locationInWindow
        let overOwnedRegion = CursorRectView.liveInstances.allObjects.contains { view in
            view.window === window && view.convert(view.bounds, to: nil).contains(point)
        }
        if !overOwnedRegion {
            cursor.set()
        }
    }
}

private struct ContainerCursorRepresentable: NSViewRepresentable {
    let cursor: NSCursor

    func makeNSView(context: Context) -> ContainerCursorView {
        let view = ContainerCursorView()
        view.cursor = cursor
        return view
    }

    func updateNSView(_ nsView: ContainerCursorView, context: Context) {
        nsView.cursor = cursor
    }
}

/// 窗口级光标兜底解析。某些层级(如 ApplyBar 的自定义样式按钮)
/// 里 AppKit 的光标矩形和 tracking area 都不生效,hover 永远
/// 是箭头;这里不再依赖那两套机制,由 mouseMoved 监视器按各
/// CursorRectView 的真实 frame 手动判定。
///
/// 监视器在事件分发前运行,只在我们强制设置过光标后才于离开
/// 区域时复位箭头;系统随后仍会按原生光标矩形解析当前位置
/// (文本框 I 型等),互不踩踏。
enum CursorRegionResolver {
    /// 上一次光标是否由本解析器强制设置
    private static var didForce = false

    static func resolve(in window: NSWindow?, point: NSPoint) {
        guard !CursorGate.isSuspended, let window else { return }
        // 重叠区域取最深的那个(子视图盖过父视图)
        let hit = CursorRectView.liveInstances.allObjects
            .filter { $0.window === window && !$0.isHidden }
            .filter { $0.convert($0.bounds, to: nil).contains(point) }
            .max(by: { depth(of: $0) < depth(of: $1) })
        if let hit {
            hit.cursor.set()
            didForce = true
        } else if didForce {
            NSCursor.arrow.set()
            didForce = false
        }
    }

    private static func depth(of view: NSView) -> Int {
        var depth = 0
        var superview = view.superview
        while let current = superview {
            depth += 1
            superview = current.superview
        }
        return depth
    }
}

extension View {
    /// 容器空白区域的兜底光标(让位于内部已注册光标的子视图)。
    func containerCursor(_ cursor: NSCursor) -> some View {
        background(ContainerCursorRepresentable(cursor: cursor))
    }
}
