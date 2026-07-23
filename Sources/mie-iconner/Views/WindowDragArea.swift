import SwiftUI
import AppKit

/// 窗口拖拽区域:隐藏标题栏后,顶部工具条上没有交互元素的
/// 空白处需要能拖动窗口。作为 background 铺在工具条后面,
/// 交互控件(输入框、按钮)命中的区域不受影响。
struct WindowDragArea: NSViewRepresentable {
    final class DragView: NSView {
        override var mouseDownCanMoveWindow: Bool { true }
    }

    func makeNSView(context: Context) -> DragView {
        DragView()
    }

    func updateNSView(_ nsView: DragView, context: Context) {}
}
