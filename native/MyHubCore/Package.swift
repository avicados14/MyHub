// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MyHubCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "MyHubCore", targets: ["MyHubCore"])],
    targets: [
        .target(name: "MyHubCore", resources: [.process("Resources")]),
        .testTarget(name: "MyHubCoreTests", dependencies: ["MyHubCore"], resources: [.process("Fixtures")])
    ]
)
