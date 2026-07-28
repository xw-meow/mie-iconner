import AppKit

/// 强刷桌面/Finder 的图标显示。
/// 做法只有一个:重启 Finder。它由 launchd 自动拉起,
/// 重绘时从磁盘重新读取图标,缓存随之彻底失效。
/// 磁盘上的图标数据全程不碰——不删、不写、无重注册。
/// 代价:已打开的 Finder 窗口会被关闭,桌面闪烁重绘一次;
/// 所以只用于用户手动触发,不挂在应用/还原路径上。
public enum FinderRefresh {
    /// 手动刷新按钮:重启 Finder 强刷桌面
    public static func refreshDesktop(in directory: URL) {
        NSWorkspace.shared.noteFileSystemChanged(directory.path)
        restartFinder()
    }

    /// 应用/还原单个图标后:软刷(轻量文件系统通知)。
    /// 两步写保证磁盘正确;桌面多数情况会跟上,
    /// 不跟随时由用户点刷新按钮重启 Finder 强刷
    public static func refreshIcon(of folder: URL) {
        NSWorkspace.shared.noteFileSystemChanged(folder.path)
        NSWorkspace.shared.noteFileSystemChanged(
            folder.deletingLastPathComponent().path)
    }

    /// 重启 Finder 强刷桌面;未运行也无妨
    public static func restartFinder() {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/killall")
        process.arguments = ["Finder"]
        try? process.run()
    }
}
