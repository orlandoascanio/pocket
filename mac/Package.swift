// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "Pocket",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "Pocket", targets: ["Pocket"])],
    targets: [
        // Pure money logic: no UI, no storage. Everything here is unit-tested.
        .target(name: "PocketCore"),
        .executableTarget(name: "Pocket", dependencies: ["PocketCore"]),
        .testTarget(name: "PocketCoreTests", dependencies: ["PocketCore"]),
    ]
)
