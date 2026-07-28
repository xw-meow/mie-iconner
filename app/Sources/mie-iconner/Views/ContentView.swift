import SwiftUI
import MieIconnerCore

struct ToastMessage: Equatable {
    let text: String
    let isError: Bool
}

struct ContentView: View {
    // 预置图标资源包的位置因运行方式而异:
    // - swift run / 裸二进制: 与可执行文件同目录(SPM 标准布局)
    // - .app: Contents/Resources(标准位置,放 .app 根会让 codesign 失败)
    // 注意两点:
    // - 不能用 Bundle.module:找不到包时它直接 fatalError
    // - 必须通过 Bundle.resourceURL 取资源目录:release 构建的 .bundle
    //   是标准 bundle 结构(资源在 Contents/Resources 下),而 debug
    //   构建是扁平目录,手动拼路径只对一边成立
    private static func bundledIconsURL() -> URL? {
        let bundleName = "mie-iconner_mie-iconner.bundle"
        let candidates = [
            Bundle.main.resourceURL, // .app → Contents/Resources
            Bundle.main.bundleURL,   // 裸二进制 → 可执行文件所在目录
        ]
        for base in candidates {
            guard let bundleURL = base?.appendingPathComponent(bundleName),
                  let bundle = Bundle(url: bundleURL),
                  let resourceURL = bundle.resourceURL else { continue }
            let dir = resourceURL.appendingPathComponent("BundledIcons")
            if FileManager.default.fileExists(atPath: dir.path) {
                return dir
            }
        }
        return nil
    }

    @State private var browser = FolderBrowserViewModel(
        startURL: FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Desktop")
    )
    @State private var iconStore = IconLibraryStore(
        bundledIconsURL: bundledIconsURL(),
        customIconsURL: FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("mie-iconner/CustomIcons")
    )
    @State private var selectedIcon: IconItem?
    @State private var selectedFolder: FolderItem?
    @State private var toast: ToastMessage?
    @State private var lastAppliedFolderURL: URL?

    var body: some View {
        VStack(spacing: DesignTokens.spacingS) {
            PathBar(browser: browser, onRefresh: manualRefresh)
                // 地址栏的建议面板会向下悬浮,必须压在下方内容之上
                .zIndex(1)
            HStack(spacing: DesignTokens.spacingM) {
                IconLibraryView(
                    store: iconStore,
                    selectedIcon: $selectedIcon,
                    clearSelection: clearSelection
                )
                    // 宽度 = 网格 256(3×80+2×8) + 内容边距 24 + 分区内边距 8
                    .frame(width: 288)
                    .paperCard()
                FolderBrowserView(
                    browser: browser,
                    selectedFolder: $selectedFolder,
                    lastAppliedFolderURL: lastAppliedFolderURL,
                    clearSelection: clearSelection
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .paperCard()
            }
            .padding(.horizontal, DesignTokens.spacingM)
            ApplyBar(
                selectedIcon: selectedIcon,
                selectedFolder: selectedFolder,
                onApplied: {
                    lastAppliedFolderURL = selectedFolder?.url
                    browser.refresh()
                    // 目标文件夹已被删除时清空选中
                    if let folder = selectedFolder,
                       !FileManager.default.fileExists(atPath: folder.url.path) {
                        selectedFolder = nil
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                        lastAppliedFolderURL = nil
                    }
                },
                onToast: { message, isError in
                    showToast(message, isError: isError)
                }
            )
            // paperCard 要在 padding 之前:否则白卡背景会把水平边距
            // 也包进卡片里,底栏左右贴到窗口边缘
            .paperCard()
            .padding(.horizontal, DesignTokens.spacingM)
        }
        .padding(.bottom, DesignTokens.spacingM)
        .frame(minWidth: 800, minHeight: 520)
        // 暖纸渐变画布:衬出所有悬浮白卡
        .background {
            LinearGradient(colors: [DesignTokens.canvasTop,
                                    DesignTokens.canvasBottom],
                           startPoint: .topLeading,
                           endPoint: .bottomTrailing)
                .ignoresSafeArea()
        }
        // 定制主题色接管链接/聚焦环等系统着色
        .tint(DesignTokens.brand)
        // 只做精致浅色:锁定外观,不跟随系统深色
        .preferredColorScheme(.light)
        .overlay(alignment: .bottom) {
            if let toast {
                Text(toast.text)
                    .font(.system(size: 13))
                    .padding(.horizontal, DesignTokens.spacingL)
                    .padding(.vertical, DesignTokens.spacingS)
                    .background {
                        Capsule()
                            .fill(toast.isError
                                  ? DesignTokens.errorStroke
                                  : DesignTokens.inkCapsule)
                            .shadow(radius: 8)
                    }
                    .foregroundStyle(.white)
                    .padding(.bottom, 56)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(DesignTokens.animationMedium, value: toast)
    }

    func showToast(_ text: String, isError: Bool) {
        toast = ToastMessage(text: text, isError: isError)
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(2.5))
            if toast?.text == text { toast = nil }
        }
    }

    /// 点任意一侧面板空白处,同时清除两侧选中
    func clearSelection() {
        selectedIcon = nil
        selectedFolder = nil
    }

    /// 手动刷新:重扫当前目录(同步中途的文件增删)、
    /// 重启 Finder 强刷桌面缓存、清理已失效的文件夹选中
    func manualRefresh() {
        browser.refresh()
        if let folder = selectedFolder,
           !FileManager.default.fileExists(atPath: folder.url.path) {
            selectedFolder = nil
        }
        FinderRefresh.refreshDesktop(in: browser.currentURL)
        showToast("已刷新目录,桌面正在重绘", isError: false)
    }
}

#Preview {
    ContentView()
}
