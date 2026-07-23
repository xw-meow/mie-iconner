import Foundation

public struct FolderItem: Identifiable, Hashable {
    public let url: URL
    public var name: String { url.lastPathComponent }
    public var id: URL { url }
    public init(url: URL) { self.url = url }
}
