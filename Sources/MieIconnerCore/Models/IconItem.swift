import AppKit
import ImageIO

public struct IconItem: Identifiable, Hashable, Sendable {
    public enum Source: Hashable, Sendable {
        case bundled
        case custom
    }

    public let url: URL
    public let source: Source
    public var id: URL { url }
    public var name: String { url.deletingPathExtension().lastPathComponent }

    /// 进程级缩略图缓存:同一张图只解码一次。折叠展开、tab
    /// 切换都会销毁并重建卡片,没有缓存时每次重建都先闪占位符、
    /// 再同步读盘卡主线程
    private static let imageCache = NSCache<NSURL, NSImage>()

    /// 缩略图最大边长(像素)。卡片展示 48pt,@2x 屏为 96px,
    /// 留到 128 兼顾更高分辨率与 ApplyBar 预览
    private static let thumbnailMaxPixelSize = 128

    /// 仅查缓存,不读盘;命中时可以同步上屏,无占位符闪烁
    public var cachedImage: NSImage? {
        Self.imageCache.object(forKey: url as NSURL)
    }

    /// 读盘解码缩略图并写入缓存。NSCache 线程安全,可在后台
    /// 线程调用(预热用)
    public func loadImage() -> NSImage? {
        if let cached = cachedImage { return cached }
        // ImageIO 按显示尺寸直接解码缩略图,而不是解码 512×512
        // 原图再缩小:原图解码每张约 1MB 内存,几百张会把内存
        // 顶爆;缩略图内存只占零头,解码也快一个量级
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                  kCGImageSourceCreateThumbnailFromImageAlways: true,
                  kCGImageSourceShouldCacheImmediately: true,
                  kCGImageSourceCreateThumbnailWithTransform: true,
                  kCGImageSourceThumbnailMaxPixelSize: Self.thumbnailMaxPixelSize
              ] as CFDictionary) else { return nil }
        let image = NSImage(cgImage: cgImage,
                            size: NSSize(width: cgImage.width, height: cgImage.height))
        Self.imageCache.setObject(image, forKey: url as NSURL)
        return image
    }

    /// 同步加载(先查缓存,未命中读盘)
    public var image: NSImage? { loadImage() }

    /// 全尺寸原图,仅"应用图标到文件夹"使用:写入系统的
    /// 图标必须是全分辨率,128px 缩略图在 Retina 桌面会模糊。
    /// 不进缩略图缓存,调用方自行承担一次性解码成本
    public func loadFullImage() -> NSImage? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let cgImage = CGImageSourceCreateImageAtIndex(source, 0, [
                  kCGImageSourceShouldCacheImmediately: true
              ] as CFDictionary) else { return nil }
        return NSImage(cgImage: cgImage,
                       size: NSSize(width: cgImage.width,
                                    height: cgImage.height))
    }

    public init(url: URL, source: Source) {
        self.url = url
        self.source = source
    }
}
