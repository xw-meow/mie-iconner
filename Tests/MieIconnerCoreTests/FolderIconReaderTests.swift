import XCTest
@testable import MieIconnerCore

final class FolderIconReaderTests: XCTestCase {

    /// 手工构造最小资源叉:头部 + 数据区(长度+icns 内容)
    /// + 映射区(类型表含一个 icns 条目),验证解析出原始内容
    func test_extractICNS_returnsEmbeddedData() {
        let payload = Data("icns-fake-content".utf8)

        var rsrc = Data(count: 256)
        let dataArea = 16
        let mapArea = 16 + 4 + payload.count
        // 头部:数据区/映射区偏移与长度
        rsrc.replaceSubrange(0..<4, with: be32(dataArea))
        rsrc.replaceSubrange(4..<8, with: be32(mapArea))
        rsrc.replaceSubrange(8..<12, with: be32(4 + payload.count))
        rsrc.replaceSubrange(12..<16, with: be32(128))
        // 数据区:4 字节长度 + 内容
        rsrc.replaceSubrange(dataArea..<dataArea + 4,
                             with: be32(payload.count))
        rsrc.replaceSubrange((dataArea + 4)..<(dataArea + 4 + payload.count),
                             with: payload)
        // 映射区:偏移 24 处是类型表偏移(相对映射区起点)
        rsrc.replaceSubrange((mapArea + 24)..<(mapArea + 26),
                             with: be16(28))
        let typeList = mapArea + 28
        // 类型表:数量-1 = 0(一个类型)
        rsrc.replaceSubrange(typeList..<(typeList + 2), with: be16(0))
        // 类型条目:'icns',数量-1=0,引用表偏移 = 2+8=10
        rsrc.replaceSubrange((typeList + 2)..<(typeList + 6),
                             with: Data("icns".utf8))
        rsrc.replaceSubrange((typeList + 6)..<(typeList + 8), with: be16(0))
        rsrc.replaceSubrange((typeList + 8)..<(typeList + 10), with: be16(10))
        // 引用项:ID(2) 名称(2) 属性(1) 数据偏移(3) 保留(4)
        let ref = typeList + 10
        rsrc.replaceSubrange(ref..<(ref + 4), with: be16(128) + be16(0xFFFF))
        rsrc.replaceSubrange((ref + 4)..<(ref + 8),
                             with: Data([0x00, 0x00, 0x00, 0x00]))

        XCTAssertEqual(FolderIconReader.extractICNS(from: rsrc), payload)
    }

    func test_extractICNS_rejectsGarbage() {
        XCTAssertNil(FolderIconReader.extractICNS(from: Data()))
        XCTAssertNil(FolderIconReader.extractICNS(
            from: Data(repeating: 0xFF, count: 64)))
    }

    /// icns 各尺寸变体可能内容不同,应挑像素最大的 PNG 元素
    func test_largestPNGElement_picksBiggest() {
        func pngElement(_ type: String, _ width: Int) -> Data {
            var payload = Data([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
            payload.append(be32(13))          // IHDR 长度
            payload.append(Data("IHDR".utf8))
            payload.append(be32(width))       // 宽度
            payload.append(Data(repeating: 0, count: 9))
            var element = Data(type.utf8)
            element.append(be32(payload.count + 8))
            element.append(payload)
            return element
        }
        var icns = Data("icns".utf8)
        let small = pngElement("ic07", 128)
        let large = pngElement("ic10", 1024)
        icns.append(be32(8 + small.count + large.count))
        icns.append(small)
        icns.append(large)

        let picked = FolderIconReader.largestPNGElement(from: icns)
        XCTAssertNotNil(picked)
        guard let picked else { return }
        // 宽度字段在 PNG 数据偏移 16-19;1024 = 00 00 04 00
        let widthIndex = picked.index(picked.startIndex, offsetBy: 18)
        XCTAssertEqual(Int(picked[widthIndex]), 4)
        XCTAssertEqual(picked.count, large.count - 8)
    }

    /// 真实路径:先 setIcon 再读回,图标数据能被解析成图片
    func test_customIcon_roundTripsRealFolder() throws {
        let folder = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder,
                                                withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }

        let image = NSImage(size: NSSize(width: 32, height: 32))
        image.lockFocus()
        NSColor.red.set()
        NSRect(x: 0, y: 0, width: 32, height: 32).fill()
        image.unlockFocus()

        XCTAssertTrue(NSWorkspace.shared.setIcon(image,
                                                 forFile: folder.path,
                                                 options: []))
        let read = FolderIconReader.customIcon(for: folder)
        XCTAssertNotNil(read)
        XCTAssertGreaterThan(read?.size.width ?? 0, 0)

        // 还原后应读不到自定义图标
        XCTAssertTrue(NSWorkspace.shared.setIcon(nil,
                                                 forFile: folder.path,
                                                 options: []))
        XCTAssertNil(FolderIconReader.customIcon(for: folder))
    }

    private func be32(_ value: Int) -> Data {
        Data([UInt8((value >> 24) & 0xFF), UInt8((value >> 16) & 0xFF),
              UInt8((value >> 8) & 0xFF), UInt8(value & 0xFF)])
    }

    private func be16(_ value: Int) -> Data {
        Data([UInt8((value >> 8) & 0xFF), UInt8(value & 0xFF)])
    }
}
