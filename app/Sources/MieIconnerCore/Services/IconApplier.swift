import AppKit

public enum IconApplierError: Error, Equatable {
    case folderNotFound
    case applyFailed
}

public enum IconApplier {
    /// 设置文件夹自定义图标。
    @discardableResult
    public static func apply(_ image: NSImage, to folder: URL) -> Result<Void, IconApplierError> {
        guard isExistingDirectory(folder) else { return .failure(.folderNotFound) }
        // 两步写:先删再写。已有自定义图标时覆盖写不会被
        // Finder 桌面采纳(实测旧图标停留一小时以上,通知/
        // 重启 iconservicesagent/触碰 mtime 均无效);先 setIcon(nil)
        // 强制系统注销旧图标,再写入才是全新注册。间隔 0.3s
        // 让删除落地,与验证过的命令行节奏一致
        NSWorkspace.shared.setIcon(nil, forFile: folder.path, options: [])
        Thread.sleep(forTimeInterval: 0.3)
        let ok = NSWorkspace.shared.setIcon(image, forFile: folder.path, options: [])
        guard ok else { return .failure(.applyFailed) }
        notifyFinder(folder)
        return .success(())
    }

    /// 还原系统默认图标。
    @discardableResult
    public static func restore(_ folder: URL) -> Result<Void, IconApplierError> {
        guard isExistingDirectory(folder) else { return .failure(.folderNotFound) }
        let ok = NSWorkspace.shared.setIcon(nil, forFile: folder.path, options: [])
        guard ok else { return .failure(.applyFailed) }
        notifyFinder(folder)
        return .success(())
    }

    /// setIcon 写入后 Finder 桌面/窗口视图有缓存,显式通知刷新,
    /// 否则桌面上的图标可能一直显示旧样式。
    private static func notifyFinder(_ folder: URL) {
        FinderRefresh.refreshIcon(of: folder)
    }

    private static func isExistingDirectory(_ url: URL) -> Bool {
        var isDirectory: ObjCBool = false
        return FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory)
            && isDirectory.boolValue
    }
}
