import AppKit

/// 直接从磁盘读取文件夹的自定义图标:
/// 解析文件夹内 Icon\r 的资源叉,取出 icns 数据。
///
/// 为什么不走 NSWorkspace.icon(forFile:):它经 iconservices
/// 缓存,磁盘上的自定义图标被删除或重写后,缓存仍可能
/// 返回旧图标,导致 app 里显示的与桌面(从磁盘读)不一致。
/// 这里与 Finder 读同一份数据,app 与桌面永远同步。
public enum FolderIconReader {
    /// 读取文件夹的自定义图标;无自定义图标(或数据损坏)返回 nil
    public static func customIcon(for folder: URL) -> NSImage? {
        // FinderInfo 的 kHasCustomIcon 位未设置时,即使有
        // Icon\r 文件 Finder 也不显示自定义图标,保持一致
        guard hasCustomIconBit(folder.path),
              let resourceFork = readXattr(
                  named: "com.apple.ResourceFork",
                  atPath: folder.appendingPathComponent("Icon\r").path),
              let icns = extractICNS(from: resourceFork),
              let largest = largestPNGElement(from: icns) else { return nil }
        return NSImage(data: largest)
    }

    /// 从 icns 中挑像素最大的 PNG 元素——与 Finder 的渲染
    /// 选择一致。icns 的各尺寸变体内容可能不同(历史 bug 曾
    /// 造成 128px 是贴纸、1024px 是默认文件夹图的混装文件),
    /// 交给 NSImage 按绘制尺寸自选会与桌面显示不一致
    static func largestPNGElement(from icns: Data) -> Data? {
        func be32(_ offset: Int) -> Int? {
            guard offset >= 0, offset + 4 <= icns.count else { return nil }
            return Int(icns[offset]) << 24 | Int(icns[offset + 1]) << 16
                | Int(icns[offset + 2]) << 8 | Int(icns[offset + 3])
        }
        // icns 头:magic(4) + 总长度(4),随后是若干 类型(4)+长度(4)+数据
        guard icns.count >= 8,
              icns[icns.startIndex..<icns.index(icns.startIndex, offsetBy: 4)]
                  == Data("icns".utf8) else { return nil }
        var best: (width: Int, payload: Data)?
        var offset = 8
        while offset + 8 <= icns.count {
            guard let elementLength = be32(offset + 4), elementLength >= 8,
                  offset + elementLength <= icns.count else { break }
            let payload = icns[(offset + 8)..<(offset + elementLength)]
            // PNG:8 字节签名 + 4 字节长度 + 'IHDR' + 4 字节宽度
            if payload.count >= 24,
               payload[payload.startIndex] == 0x89,
               payload[payload.index(payload.startIndex, offsetBy: 1)] == 0x50, // P
               payload[payload.index(payload.startIndex, offsetBy: 12)]
                   == 0x49, // I (IHDR)
               let width = be32(offset + 8 + 16) {
                if width > (best?.width ?? 0) {
                    best = (width, Data(payload))
                }
            }
            offset += elementLength
        }
        return best?.payload
    }

    /// com.apple.FinderInfo 第 8 字节(大端标志位高字节)的
    /// 0x04 位 = kHasCustomIcon
    static func hasCustomIconBit(_ path: String) -> Bool {
        guard let info = readXattr(named: "com.apple.FinderInfo",
                                   atPath: path),
              info.count >= 9 else { return false }
        return info[8] & 0x04 != 0
    }

    static func readXattr(named name: String, atPath path: String) -> Data? {
        let size = getxattr(path, name, nil, 0, 0, 0)
        guard size > 0 else { return nil }
        var data = Data(count: size)
        let read = data.withUnsafeMutableBytes { buffer in
            getxattr(path, name, buffer.baseAddress, size, 0, 0)
        }
        guard read == size else { return nil }
        return data
    }

    /// 解析资源叉,取出 icns 资源数据。
    /// 布局:头部 16 字节(数据区/映射区偏移与长度,大端)→
    /// 映射区 24 字节处是类型表偏移;类型表中找 'icns' 条目,
    /// 其引用项给出数据区偏移;数据区每项为 4 字节长度 + 内容
    static func extractICNS(from rsrc: Data) -> Data? {
        func be16(_ offset: Int) -> Int? {
            guard offset >= 0, offset + 2 <= rsrc.count else { return nil }
            return Int(rsrc[offset]) << 8 | Int(rsrc[offset + 1])
        }
        func be32(_ offset: Int) -> Int? {
            guard offset >= 0, offset + 4 <= rsrc.count else { return nil }
            return Int(rsrc[offset]) << 24 | Int(rsrc[offset + 1]) << 16
                | Int(rsrc[offset + 2]) << 8 | Int(rsrc[offset + 3])
        }
        guard let dataArea = be32(0), let mapArea = be32(4),
              let typeListOffset = be16(mapArea + 24) else { return nil }
        let typeList = mapArea + typeListOffset
        guard let typeCount = be16(typeList).map({ $0 + 1 }) else { return nil }
        for index in 0..<typeCount {
            let entry = typeList + 2 + index * 8
            guard entry + 8 <= rsrc.count else { return nil }
            guard rsrc[entry..<(entry + 4)] == Data("icns".utf8),
                  let refOffset = be16(entry + 6) else { continue }
            // 引用项:ID(2) 名称(2) 属性(1) 数据偏移(3) 保留(4);
            // 取属性起 4 字节再掩掉属性字节,即 3 字节数据偏移
            let ref = typeList + refOffset
            guard let rawOffset = be32(ref + 4) else { return nil }
            let dataOffset = dataArea + (rawOffset & 0xFF_FFFF)
            guard let length = be32(dataOffset),
                  dataOffset + 4 + length <= rsrc.count else { return nil }
            // 拷贝为全新 Data:切片与原 Data 共享索引空间,
            // 下游按 0 基索引会读错位
            return Data(rsrc[(dataOffset + 4)..<(dataOffset + 4 + length)])
        }
        return nil
    }
}
