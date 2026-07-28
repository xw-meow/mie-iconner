import XCTest
@testable import MieIconnerCore

final class PathResolverTests: XCTestCase {

    func test_resolve_expandsTilde() {
        let home = FileManager.default.homeDirectoryForCurrentUser
        XCTAssertEqual(PathResolver.resolve("~")?.path, home.path)
    }

    func test_resolve_existingDirectory() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        XCTAssertEqual(PathResolver.resolve(dir.path)?.path, dir.path)
    }

    func test_resolve_nonexistentPath_returnsNil() {
        XCTAssertNil(PathResolver.resolve("/definitely/not/exist/\(UUID().uuidString)"))
    }

    func test_resolve_fileNotDirectory_returnsNil() throws {
        let file = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).txt")
        try "hi".write(to: file, atomically: true, encoding: .utf8)
        defer { try? FileManager.default.removeItem(at: file) }
        XCTAssertNil(PathResolver.resolve(file.path))
    }

    func test_resolve_emptyInput_returnsNil() {
        XCTAssertNil(PathResolver.resolve("   "))
    }

    func test_displayPath_shortensHome() {
        let home = FileManager.default.homeDirectoryForCurrentUser
        XCTAssertEqual(PathResolver.displayPath(for: home), "~")
        XCTAssertEqual(
            PathResolver.displayPath(for: home.appendingPathComponent("Desktop")),
            "~/Desktop"
        )
    }

    func test_displayPath_outsideHome_unchanged() {
        XCTAssertEqual(PathResolver.displayPath(for: URL(fileURLWithPath: "/usr/local")), "/usr/local")
    }
}
