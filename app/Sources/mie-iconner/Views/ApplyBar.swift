import SwiftUI
import MieIconnerCore

struct ApplyBar: View {
    let selectedIcon: IconItem?
    let selectedFolder: FolderItem?
    /// 应用/还原成功后回调(刷新列表 + 触发脉冲动画)
    let onApplied: () -> Void
    /// (消息, 是否错误)
    let onToast: (String, Bool) -> Void

    private var canApply: Bool { selectedIcon != nil && selectedFolder != nil }

    var body: some View {
        HStack(spacing: DesignTokens.spacingM) {
            summary
            Spacer()
            Button { restore() } label: {
                Label("还原", systemImage: "arrow.uturn.backward")
            }
            .buttonStyle(.capsule)
            .disabled(selectedFolder == nil)
            .help("恢复系统默认文件夹图标")
            Button { apply() } label: {
                Label("应用", systemImage: "checkmark")
            }
            .buttonStyle(.capsuleProminent)
            .disabled(!canApply)
            .keyboardShortcut(.return, modifiers: .command)
            .help("将选中图标应用到文件夹 (⌘↩)")
        }
        .padding(.horizontal, DesignTokens.spacingL)
        .padding(.vertical, DesignTokens.spacingS)
    }

    @ViewBuilder
    private var summary: some View {
        HStack(spacing: DesignTokens.spacingS) {
            if let icon = selectedIcon, let image = icon.image {
                Image(nsImage: image)
                    .resizable()
                    .frame(width: 24, height: 24)
            } else {
                Text("未选图标")
                    .foregroundStyle(.secondary)
            }
            Image(systemName: "arrow.right")
                .foregroundStyle(.secondary)
                .font(.system(size: 11))
            if let folder = selectedFolder {
                Label(folder.name, systemImage: "folder.fill")
            } else {
                Text("未选文件夹")
                    .foregroundStyle(.secondary)
            }
        }
        .font(.system(size: 13))
    }

    private func apply() {
        guard let icon = selectedIcon,
              let folder = selectedFolder,
              // 写入文件夹的必须是全尺寸原图,不是卡片缩略图
              let image = icon.loadFullImage() else { return }
        switch IconApplier.apply(image, to: folder.url) {
        case .success:
            onToast("已将「\(icon.name)」应用到「\(folder.name)」", false)
        case .failure(.folderNotFound):
            onToast("文件夹不存在,可能已被移动或删除", true)
        case .failure(.applyFailed):
            onToast("应用失败,请检查该位置的访问权限", true)
        }
        onApplied()
    }

    private func restore() {
        guard let folder = selectedFolder else { return }
        switch IconApplier.restore(folder.url) {
        case .success:
            onToast("已还原「\(folder.name)」的默认图标", false)
        case .failure(.folderNotFound):
            onToast("文件夹不存在,可能已被移动或删除", true)
        case .failure(.applyFailed):
            onToast("还原失败,请检查该位置的访问权限", true)
        }
        onApplied()
    }
}
