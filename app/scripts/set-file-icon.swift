import AppKit

// 给文件本身贴自定义图标(Finder 中显示)
// 用法: swift set-file-icon.swift <图标图片> <目标文件>
//
// 原理:NSWorkspace.setIcon 会把图标写进文件的资源叉并置
// custom icon 标志位。注意:资源叉在浏览器下载场景会被剥掉,
// 所以对分发出去的 DMG 而言这只是本地/压缩包分发时的装饰。
guard CommandLine.arguments.count == 3 else {
    print("usage: set-file-icon.swift <icon-image> <target-file>")
    exit(1)
}
let (iconPath, targetPath) = (CommandLine.arguments[1], CommandLine.arguments[2])
guard let image = NSImage(contentsOfFile: iconPath) else {
    FileHandle.standardError.write("无法读取图标: \(iconPath)\n".data(using: .utf8)!)
    exit(1)
}
guard NSWorkspace.shared.setIcon(image, forFile: targetPath) else {
    FileHandle.standardError.write("设置图标失败: \(targetPath)\n".data(using: .utf8)!)
    exit(1)
}
