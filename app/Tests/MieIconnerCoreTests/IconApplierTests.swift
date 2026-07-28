import XCTest
import AppKit
@testable import MieIconnerCore

final class IconApplierTests: XCTestCase {

    private var folder: URL!
    private var iconFile: URL { folder.appendingPathComponent("Icon\r") }

    override func setUpWithError() throws {
        folder = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        // 还原图标,避免在临时目录遗留资源
        _ = IconApplier.restore(folder)
        try? FileManager.default.removeItem(at: folder)
    }

    private func makeImage() -> NSImage {
        let image = NSImage(size: NSSize(width: 512, height: 512))
        image.lockFocus()
        NSColor.systemBlue.setFill()
        NSBezierPath(roundedRect: NSRect(x: 0, y: 0, width: 512, height: 512),
                     xRadius: 80, yRadius: 80).fill()
        image.unlockFocus()
        return image
    }

    func test_apply_setsCustomIcon() {
        let result = IconApplier.apply(makeImage(), to: folder)
        guard case .success = result else {
            return XCTFail("apply 应成功,得到 \(result)")
        }
        XCTAssertTrue(FileManager.default.fileExists(atPath: iconFile.path),
                      "应用后目录内应存在 Icon\\r 文件")
    }

    func test_restore_removesCustomIcon() {
        _ = IconApplier.apply(makeImage(), to: folder)
        let result = IconApplier.restore(folder)
        guard case .success = result else {
            return XCTFail("restore 应成功,得到 \(result)")
        }
        XCTAssertFalse(FileManager.default.fileExists(atPath: iconFile.path),
                       "还原后 Icon\\r 文件应被移除")
    }

    func test_apply_missingFolder_returnsFolderNotFound() {
        let missing = folder.appendingPathComponent("nope")
        // Result<Void, _> 无法满足 Equatable(Void 不能遵循协议),改用模式匹配断言
        guard case .failure(.folderNotFound) = IconApplier.apply(makeImage(), to: missing) else {
            return XCTFail("缺失目录 apply 应返回 .failure(.folderNotFound)")
        }
    }

    func test_restore_missingFolder_returnsFolderNotFound() {
        let missing = folder.appendingPathComponent("nope")
        guard case .failure(.folderNotFound) = IconApplier.restore(missing) else {
            return XCTFail("缺失目录 restore 应返回 .failure(.folderNotFound)")
        }
    }
}
