import XCTest
@testable import MieIconnerCore

final class PathSuggesterTests: XCTestCase {

    private var root: URL!

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
        // 结构:
        //   root/Apple  root/apricot  root/grape  root/Banana
        //   root/.hidden  root/Apple/note.txt
        for name in ["Apple", "apricot", "grape", "Banana", ".hidden", "Apple/Sub"] {
            try FileManager.default.createDirectory(
                at: root.appendingPathComponent(name),
                withIntermediateDirectories: true)
        }
        try "hi".write(to: root.appendingPathComponent("Apple/note.txt"),
                       atomically: true, encoding: .utf8)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: root)
    }

    private func names(_ input: String, limit: Int = 8) -> [String] {
        PathSuggester.suggestions(for: input, limit: limit).map(\.name)
    }

    func test_emptyInput_returnsEmpty() {
        XCTAssertEqual(PathSuggester.suggestions(for: "  "), [])
    }

    func test_relativePath_returnsEmpty() {
        XCTAssertEqual(PathSuggester.suggestions(for: "aa/bb"), [])
    }

    func test_prefixMatchesRankBeforeContains() {
        // "ap":Apple/apricot 前缀命中,grape 仅包含命中
        XCTAssertEqual(names(root.path + "/ap"), ["Apple", "apricot", "grape"])
    }

    func test_matchingIsCaseInsensitive() {
        XCTAssertEqual(names(root.path + "/AP"), ["Apple", "apricot", "grape"])
        XCTAssertEqual(names(root.path + "/banana"), ["Banana"])
    }

    func test_trailingSlash_emptyQueryListsAllSorted() {
        XCTAssertEqual(names(root.path + "/"), ["Apple", "apricot", "Banana", "grape"])
    }

    func test_hiddenFoldersExcluded() {
        XCTAssertFalse(names(root.path + "/").contains(".hidden"))
        XCTAssertEqual(names(root.path + "/.h"), [])
    }

    func test_limitTruncates() {
        XCTAssertEqual(names(root.path + "/", limit: 2).count, 2)
    }

    func test_nonexistentDirectory_returnsEmpty() {
        XCTAssertEqual(PathSuggester.suggestions(
            for: root.path + "/nope/anything"), [])
    }

    func test_fileAsDirectory_returnsEmpty() {
        let file = root.path + "/Apple/note.txt"
        XCTAssertEqual(PathSuggester.suggestions(for: file + "/x"), [])
    }

    func test_exactMatchStillOffered() {
        // 输入精确指向某文件夹时,它自身应作为建议出现(回车即进入)
        XCTAssertEqual(names(root.path + "/Apple"), ["Apple"])
    }

    func test_nestedDirectoryQueried() {
        XCTAssertEqual(names(root.path + "/Apple/su"), ["Sub"])
    }

    func test_displayPathUsesTilde() {
        for s in PathSuggester.suggestions(for: "~/") {
            XCTAssertTrue(s.displayPath.hasPrefix("~/"),
                          "\(s.displayPath) 应以 ~/ 开头")
        }
    }

    func test_urlPointsInsideDirectory() {
        // standardizedFileURL 会解析 /var→/private/var,与实现侧对齐再比较
        let stdRoot = root.standardizedFileURL
        let s = PathSuggester.suggestions(for: root.path + "/Ban")
        XCTAssertEqual(s.first?.url.path, stdRoot.path + "/Banana")
    }
}
