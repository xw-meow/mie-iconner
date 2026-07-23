import SwiftUI

/// 胶囊按钮样式:与地址栏 omnibox 同一套视觉语言。
/// prominent = 主按钮(柿子橙渐变),否则为次级按钮
/// (白底 + 暖灰发丝描边,与纸卡一致)。
/// 不带投影:按钮总是落在已用投影抬升过的容器卡上,
/// 再叠一层高度会视觉疲劳,靠填充和描边立住即可。
/// 自带三态:悬停提亮/加深、按下下沉缩放、主按钮禁用降为 40% 透明。
struct CapsuleButtonStyle: ButtonStyle {
    var prominent = false

    func makeBody(configuration: Configuration) -> Body {
        Body(prominent: prominent, configuration: configuration)
    }

    struct Body: View {
        let prominent: Bool
        let configuration: Configuration
        @State private var isHovering = false
        @Environment(\.isEnabled) private var isEnabled

        var body: some View {
            configuration.label
                .font(.mieRounded(13))
                .foregroundStyle(foreground)
                .padding(.horizontal, 14)
                .frame(height: 28)
                .background { Capsule().fill(fill) }
                .overlay {
                    if !prominent {
                        Capsule().strokeBorder(
                            isHovering ? DesignTokens.cardBorderStrong
                                       : DesignTokens.cardBorder,
                            lineWidth: 1)
                    }
                }
                .brightness(brightness)
                .opacity(isEnabled ? 1 : (prominent ? 0.4 : 1))
                .scaleEffect(configuration.isPressed ? 0.96 : 1)
                .onHover { isHovering = $0 }
                // 手型收进样式里:所有胶囊按钮统一,调用处不用再挂
                .hoverCursor(.pointingHand)
                .animation(DesignTokens.animationQuick, value: isHovering)
                .animation(.easeInOut(duration: 0.1),
                           value: configuration.isPressed)
        }

        private var fill: AnyShapeStyle {
            if !isEnabled {
                return AnyShapeStyle(Color.primary.opacity(0.08))
            }
            if prominent {
                // 顶部主题色 → 底部深色端,垂直微渐变增加立体感
                return AnyShapeStyle(LinearGradient(
                    colors: [DesignTokens.brand, DesignTokens.brandDark],
                    startPoint: .top, endPoint: .bottom))
            }
            // 次级按钮:白底,与纸卡同一语言。
            // hover 不下沉提亮——白上提亮等于没变,和容器融为一体;
            // 改为沉到暖灰凹槽色,与描边加深一起给出辨识
            return AnyShapeStyle(isHovering ? DesignTokens.slotFill
                                            : Color.white)
        }

        private var foreground: Color {
            if !isEnabled { return Color.secondary.opacity(0.7) }
            return prominent ? .white : .primary
        }

        private var brightness: Double {
            guard isEnabled else { return 0 }
            if configuration.isPressed { return -0.06 }
            // 提亮只对主按钮有效;次级按钮的 hover 反馈走填充下沉
            return prominent && isHovering ? 0.07 : 0
        }
    }
}

extension ButtonStyle where Self == CapsuleButtonStyle {
    /// 次级胶囊按钮
    static var capsule: CapsuleButtonStyle { CapsuleButtonStyle() }
    /// 主胶囊按钮(品牌色)
    static var capsuleProminent: CapsuleButtonStyle {
        CapsuleButtonStyle(prominent: true)
    }
}
