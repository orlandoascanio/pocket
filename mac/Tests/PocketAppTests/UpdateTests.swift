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
}
