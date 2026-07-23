import SwiftUI

/// 集中管理视觉常量,类似前端设计系统的 theme tokens。
/// 主题方向:「暖纸贴纸册」——米白纸底衬托纯白厚卡,
/// 图标当作贴纸呈现;柿子橙作唯一强调色,标题用圆体。
enum DesignTokens {
    static let cornerRadiusSmall: CGFloat = 8
    static let cornerRadiusLarge: CGFloat = 14

    static let spacingXS: CGFloat = 4
    static let spacingS: CGFloat = 8
    static let spacingM: CGFloat = 12
    static let spacingL: CGFloat = 16

    static let animationQuick = Animation.easeOut(duration: 0.15)
    static let animationMedium = Animation.easeOut(duration: 0.25)
    /// 贴纸选中回弹:过冲一点再坐稳,"啪"地贴上去的感觉
    static let stickerSpring = Animation.spring(response: 0.3,
                                                dampingFraction: 0.55)

    /// 定制主题色:柿子橙。选中态、主按钮、聚焦环统一用它
    static let brand = Color(hex: "#FF5C38")!
    /// 主题色深色端,主按钮垂直渐变的底部色
    static let brandDark = Color(hex: "#E84A1F")!

    static let selectionStroke = brand
    static let selectionFill = brand.opacity(0.10)
    static let errorStroke = Color(hex: "#D9381E")!

    /// 窗口渐变画布:暖米白纸,只负责把白色面板衬出来
    static let canvasTop = Color(hex: "#FAF7F2")!
    static let canvasBottom = Color(hex: "#F1EBE0")!

    /// 白卡的发丝描边(暖灰)
    static let cardBorder = Color(hex: "#E8E2D5")!
    /// hover/按下时深一档的描边
    static let cardBorderStrong = Color(hex: "#D8D0C0")!
    /// 卡片/面板的投影(暖棕调,冷灰黑会脏)
    static let cardShadow = Color(hex: "#7A5C3E")!.opacity(0.10)
    /// 贴纸卡 hover/选中时更明显的投影
    static let stickerShadow = Color(hex: "#7A5C3E")!.opacity(0.18)

    /// Tab 轨道、悬停填充等凹槽色
    static let slotFill = Color(hex: "#ECE6DA")!
    /// 列表行/分类头悬停填充
    static let hoverFill = Color(hex: "#F3EDE2")!

    /// 成功 toast 的墨黑胶囊(暖调近黑)
    static let inkCapsule = Color(hex: "#2E2820")!.opacity(0.92)
}

/// 悬浮纸卡:纯白底 + 暖灰发丝描边 + 暖调软投影。
/// 应用里所有面板(图标库/文件夹区/底部栏)统一用它承载。
struct PaperCard: ViewModifier {
    var cornerRadius: CGFloat = DesignTokens.cornerRadiusLarge

    func body(content: Content) -> some View {
        content
            .background {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(.white)
            }
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(DesignTokens.cardBorder, lineWidth: 1)
            }
            .shadow(color: DesignTokens.cardShadow, radius: 12, y: 3)
    }
}

extension View {
    func paperCard(cornerRadius: CGFloat = DesignTokens.cornerRadiusLarge) -> some View {
        modifier(PaperCard(cornerRadius: cornerRadius))
    }
}

extension Font {
    /// 标题/按钮/Tab 用圆体,呼应贴纸册的亲和感;正文仍用标准体保证可读性
    static func mieRounded(_ size: CGFloat,
                           _ weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }
}

extension Color {
    /// 从十六进制字符串解析颜色,支持 "#RGB"/"#RRGGBB"/"RRGGBB";
    /// 非法输入返回 nil
    init?(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        guard let value = UInt64(s, radix: 16) else { return nil }
        let r, g, b: Double
        switch s.count {
        case 3:
            r = Double((value >> 8) & 0xF) / 15
            g = Double((value >> 4) & 0xF) / 15
            b = Double(value & 0xF) / 15
        case 6:
            r = Double((value >> 16) & 0xFF) / 255
            g = Double((value >> 8) & 0xFF) / 255
            b = Double(value & 0xFF) / 255
        default:
            return nil
        }
        self.init(red: r, green: g, blue: b)
    }
}
