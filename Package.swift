// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "mie-iconner",
    platforms: [.macOS(.v14)],
    targets: [
        .target(
            name: "MieIconnerCore",
            path: "Sources/MieIconnerCore"
        ),
        .executableTarget(
            name: "mie-iconner",
            dependencies: ["MieIconnerCore"],
            path: "Sources/mie-iconner",
            // Info.plist 不进源码编译,由链接器嵌进二进制
            // __TEXT/__info_plist 段,让裸可执行文件拥有 bundle
            // 本地化声明(系统菜单/文件面板才能跟随系统语言)
            exclude: ["Info.plist"],
            resources: [.copy("Resources/BundledIcons")],
            // 相对路径基于包根目录(swift build 的工作目录)
            linkerSettings: [.unsafeFlags([
                "-Xlinker", "-sectcreate",
                "-Xlinker", "__TEXT",
                "-Xlinker", "__info_plist",
                "-Xlinker", "Sources/mie-iconner/Info.plist"
            ])]
        ),
        .testTarget(
            name: "MieIconnerCoreTests",
            dependencies: ["MieIconnerCore"],
            path: "Tests/MieIconnerCoreTests"
        )
    ]
)
