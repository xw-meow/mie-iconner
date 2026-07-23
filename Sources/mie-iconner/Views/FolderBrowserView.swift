import SwiftUI
import AppKit
import MieIconnerCore

struct FolderBrowserView: View {
    let browser: FolderBrowserViewModel
    @Binding var selectedFolder: FolderItem?
    let lastAppliedFolderURL: URL?
    /// 点空白处清除两侧所有选中(图标 + 文件夹)
    let clearSelection: () -> Void

    private let columns = [GridItem(.adaptive(minimum: 96, maximum: 120),
                                    spacing: DesignTokens.spacingM)]

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                ZStack(alignment: .top) {
                    // 空白点击取消选中:垫在内容最底层并撑满可视高度。
                    // 卡片在前景遮挡,点卡片不会触发这里;
                    // 挂在容器上会和卡片手势双触发,挂在 ScrollView
                    // 背后又会被滚动视图本身挡住,都不成立
                    Color.clear
                        .contentShape(Rectangle())
                        .onTapGesture { clearSelection() }

                    if browser.folders.isEmpty {
                        ContentUnavailableView("此目录没有子文件夹",
                                               systemImage: "folder")
                            .padding(.top, 80)
                    } else {
                        LazyVGrid(columns: columns, spacing: DesignTokens.spacingM) {
                            ForEach(browser.folders) { folder in
                                FolderCard(
                                    folder: folder,
                                    isSelected: selectedFolder == folder,
                                    pulse: lastAppliedFolderURL == folder.url,
                                    refreshToken: browser.refreshToken
                                )
                                // 单击立即选中;双击用手势并行识别,不让单击等双击判定窗口(~400ms)
                                .onTapGesture(count: 1) {
                                    selectedFolder = folder
                                }
                                .simultaneousGesture(
                                    TapGesture(count: 2).onEnded {
                                        browser.goInto(folder)
                                        selectedFolder = nil
                                    }
                                )
                            }
                        }
                        .padding(DesignTokens.spacingL)
                    }
                }
                .frame(minHeight: geo.size.height, alignment: .top)
            }
            // 隐藏系统深色粗滚动条,保持纸卡面板干净
            .scrollIndicators(.hidden)
        }
        .containerCursor(.arrow)
    }
}

struct FolderCard: View {
    let folder: FolderItem
    let isSelected: Bool
    let pulse: Bool
    /// 手动刷新代际:变化时重新取图标(同一 URL 不会触发 onChange(of: folder.url))
    let refreshToken: Int

    @State private var isHovered = false
    // 图标缓存:NSWorkspace.icon(forFile:) 每次渲染都调用会在重绘时闪
    @State private var folderIcon: NSImage?

    var body: some View {
        VStack(spacing: DesignTokens.spacingXS) {
            Group {
                if let folderIcon {
                    Image(nsImage: folderIcon)
                        .resizable()
                        .frame(width: 56, height: 56)
                } else {
                    Image(systemName: "folder")
                        .font(.system(size: 40))
                        .frame(width: 56, height: 56)
                }
            }
            // hover 暖调投影、选中橙色投影:沿图标透明轮廓走,
            // 像被拈离桌面一点
            .shadow(color: isSelected
                    ? DesignTokens.brand.opacity(0.35)
                    : (isHovered ? DesignTokens.stickerShadow : .clear),
                    radius: isSelected ? 8 : 6, y: 3)
            Text(folder.name)
                .font(.system(size: 12))
                .lineLimit(2)
                .truncationMode(.middle)
                .multilineTextAlignment(.center)
        }
        .padding(DesignTokens.spacingS)
        .frame(width: 96)
        // 桌面式:不用贴纸白卡。透明底 + hover 淡暖底,
        // 选中橙晕描边,像 Finder 桌面图标的选中态
        .background {
            RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusSmall)
                .fill(isSelected
                      ? DesignTokens.selectionFill
                      : (isHovered ? DesignTokens.hoverFill : .clear))
        }
        .overlay {
            RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusSmall)
                .strokeBorder(isSelected ? DesignTokens.selectionStroke : .clear,
                              lineWidth: 1.5)
        }
        .scaleEffect(pulse ? 1.08 : 1)
        .contentShape(RoundedRectangle(cornerRadius: DesignTokens.cornerRadiusSmall))
        .animation(DesignTokens.animationQuick, value: isHovered)
        .animation(DesignTokens.animationQuick, value: isSelected)
        .animation(DesignTokens.animationMedium, value: pulse)
        .onHover { isHovered = $0 }
        .hoverCursor(.pointingHand)
        .onAppear { reloadIcon() }
        .onChange(of: folder.url) { reloadIcon() }
        // 应用/还原成功后 pulse 触发,此时重新取一次图标
        .onChange(of: pulse) { if pulse { reloadIcon() } }
        // 手动刷新:重新取图标(可能中途被别的程序改过)
        .onChange(of: refreshToken) { reloadIcon() }
    }

    private func reloadIcon() {
        // 直接从磁盘读自定义图标,与桌面同一数据源;
        // icon(forFile:) 走 iconservices 缓存,磁盘变更后可能
        // 仍返回旧图标(app 显示与桌面不同步的根因)。
        // 无自定义图标时才回退系统 API(默认文件夹图不会变)
        folderIcon = FolderIconReader.customIcon(for: folder.url)
            ?? NSWorkspace.shared.icon(forFile: folder.url.path)
    }
}
