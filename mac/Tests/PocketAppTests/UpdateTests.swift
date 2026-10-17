import Foundation
import XCTest
@testable import Pocket

final class UpdateTests: XCTestCase {
    private func release(_ tag: String, assets: [String] = ["Pocket.dmg"]) -> Data {
        let list = assets.map { #"{"name":"\#($0)","browser_download_url":"https://example.com/\#($0)"}"# }.joined(separator: ",")
        return Data(#"{"tag_name":"\#(tag)","html_url":"https://example.com/notes","assets":[\#(list)]}"#.utf8)
    }

    func testVersionsCompareNumerically() {
        XCTAssertLessThan(AppVersion("1.2.0")!, AppVersion("v1.10.0")!)
        XCTAssertEqual(AppVersion("1.2"), AppVersion("1.2.0"))
        XCTAssertNil(AppVersion("dev"))
    }

    func testNewerReleaseOffersItsDiskImage() throws {
        let outcome = try UpdateChecker.evaluate(release("v1.3.0", assets: ["notes.txt", "Pocket.dmg"]), current: "1.2.0")
        XCTAssertEqual(outcome, .available(version: "1.3.0", current: "1.2.0",
                                           notes: URL(string: "https://example.com/notes")!,
                                           download: URL(string: "https://example.com/Pocket.dmg")!))
    }

    func testSameOrOlderReleaseIsUpToDate() throws {
        XCTAssertEqual(try UpdateChecker.evaluate(release("v1.2.0"), current: "1.2.0"), .upToDate(current: "1.2.0"))
        XCTAssertEqual(try UpdateChecker.evaluate(release("v1.1.0"), current: "1.2.0"), .upToDate(current: "1.2.0"))
    }

    func testReleaseWithoutDiskImageFallsBackToItsPage() throws {
        guard case .available(_, _, _, let download) = try UpdateChecker.evaluate(release("v2.0.0", assets: []), current: "1.2.0")
        else { return XCTFail("Expected an update") }
        XCTAssertEqual(download, URL(string: "https://example.com/notes")!)
    }

    // MARK: installing

    /// The notarized disk image from the last release build (mac/dist), if there is one.
    private func releaseDMG() throws -> (dmg: URL, version: String) {
        let dist = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("../../dist").standardized
        let dmg = try FileManager.default.contentsOfDirectory(at: dist, includingPropertiesForKeys: nil)
            .filter { $0.lastPathComponent.hasPrefix("Pocket-") && $0.pathExtension == "dmg" && !$0.lastPathComponent.contains("preview") }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }.last
        guard let dmg else { throw XCTSkip("Run ./build.sh --release to test installing a real update") }
        let version = String(dmg.deletingPathExtension().lastPathComponent.dropFirst("Pocket-".count))
        return (dmg, version)
    }

    private func tempFolder() throws -> URL {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("pocket-update-test-\(UUID())", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        addTeardownBlock { try? FileManager.default.removeItem(at: dir) }
        return dir
    }

    func testInstallsTheSignedReleaseInPlace() throws {
        let (dmg, version) = try releaseDMG()
        let folder = try tempFolder()
        let current = folder.appendingPathComponent("Pocket.app")
        try FileManager.default.createDirectory(at: current.appendingPathComponent("Contents"), withIntermediateDirectories: true)
        XCTAssertTrue(UpdateInstaller.canReplace(current))

        try UpdateInstaller.installApp(from: dmg, version: version, replacing: current)
        XCTAssertNoThrow(try UpdateInstaller.verify(current, version: version))
        let leftovers = try FileManager.default.contentsOfDirectory(atPath: folder.path)
        XCTAssertEqual(leftovers, ["Pocket.app"], "the staged copy is gone")
    }

    func testRefusesAnUnexpectedVersion() throws {
        let (dmg, _) = try releaseDMG()
        let folder = try tempFolder()
        let current = folder.appendingPathComponent("Pocket.app")
        try FileManager.default.createDirectory(at: current, withIntermediateDirectories: true)
        XCTAssertThrowsError(try UpdateInstaller.installApp(from: dmg, version: "99.0.0", replacing: current))
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: current.path), [], "the current app is untouched")
    }

    func testRefusesAnAppSignedBySomeoneElse() throws {
        let (dmg, version) = try releaseDMG()
        let folder = try tempFolder()
        let current = folder.appendingPathComponent("Pocket.app")
        try FileManager.default.createDirectory(at: current, withIntermediateDirectories: true)
        try UpdateInstaller.installApp(from: dmg, version: version, replacing: current)
        let resign = Process()
        resign.executableURL = URL(fileURLWithPath: "/usr/bin/codesign")
        resign.arguments = ["--force", "--sign", "-", current.path]
        try resign.run()
        resign.waitUntilExit()
        XCTAssertThrowsError(try UpdateInstaller.verify(current, version: version))
    }

    func testOnlyReplacesCopiesItCanWrite() {
        XCTAssertFalse(UpdateInstaller.canReplace(URL(fileURLWithPath: "/Volumes/Pocket/Pocket.app")))
        XCTAssertFalse(UpdateInstaller.canReplace(URL(fileURLWithPath: "/private/var/folders/x/AppTranslocation/ABC/d/Pocket.app")))
        XCTAssertFalse(UpdateInstaller.canReplace(URL(fileURLWithPath: "/usr/bin/Pocket.app")))
        XCTAssertFalse(UpdateInstaller.canReplace(URL(fileURLWithPath: "/tmp/Pocket")))
    }
}
