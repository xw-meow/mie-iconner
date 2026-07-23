import XCTest
@testable import MieIconnerCore

final class FolderBrowserViewModelTests: XCTestCase {

    private var root: URL!

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
        let fm = FileManager.default
        // 目录结构: root/{b_dir, a_dir, .hidden_dir, c_dir/inner, file.txt, .hidden_file}
        for name in ["b_dir", "a_dir", ".hidden_dir", "c_dir/inner"] {
            try fm.createDirectory(at: root.appendingPathComponent(name),
                                   withIntermediateDirectories: true)
        }
        try "x".write(to: root.appendingPathComponent("file.txt"),
                      atomically: true, encoding: .utf8)
        try "x".write(to: root.appendingPathComponent(".hidden_file"),
                      atomically: true, encoding: .utf8)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: root)
    }

    func test_listsOnlyVisibleDirectories_sortedByName() {
        let vm = FolderBrowserViewModel(startURL: root)
        XCTAssertEqual(vm.folders.map(\.name), ["a_dir", "b_dir", "c_dir"])
    }

    func test_goInto_changesCurrentAndRefreshes() {
        let vm = FolderBrowserViewModel(startURL: root)
        let c = vm.folders.first { $0.name == "c_dir" }!
        vm.goInto(c)
        XCTAssertEqual(vm.currentURL, c.url)
        XCTAssertEqual(vm.folders.map(\.name), ["inner"])
    }

    func test_goUp_returnsToParent() {
        let vm = FolderBrowserViewModel(startURL: root)
        vm.goInto(vm.folders.first { $0.name == "c_dir" }!)
        vm.goUp()
        XCTAssertEqual(vm.currentURL.standardizedFileURL, root.standardizedFileURL)
    }

    func test_goUp_atFilesystemRoot_disabled() {
        let vm = FolderBrowserViewModel(startURL: URL(fileURLWithPath: "/"))
        XCTAssertFalse(vm.canGoUp)
        vm.goUp()
        XCTAssertEqual(vm.currentURL.path, "/")
    }

    func test_goTo_validPath_navigates() {
        let vm = FolderBrowserViewModel(startURL: root)
        let target = root.appendingPathComponent("a_dir")
        XCTAssertTrue(vm.goTo(target.path))
        XCTAssertEqual(vm.currentURL.standardizedFileURL, target.standardizedFileURL)
    }

    func test_goTo_invalidPath_returnsFalseAndStays() {
        let vm = FolderBrowserViewModel(startURL: root)
        XCTAssertFalse(vm.goTo("/no/such/\(UUID().uuidString)"))
        XCTAssertEqual(vm.currentURL.standardizedFileURL, root.standardizedFileURL)
    }
}
