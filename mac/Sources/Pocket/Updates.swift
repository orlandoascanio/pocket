import AppKit
import Foundation

/// A dotted version like "1.2.0" (a leading "v" is ignored), compared part by part.
struct AppVersion: Comparable, CustomStringConvertible {
    let parts: [Int]

    init?(_ string: String) {
        let trimmed = string.trimmingCharacters(in: .whitespaces)
        let core = trimmed.hasPrefix("v") || trimmed.hasPrefix("V") ? String(trimmed.dropFirst()) : trimmed
        let parts = core.split(separator: ".").map { Int($0) }
        guard !parts.isEmpty, parts.allSatisfy({ $0 != nil }) else { return nil }
        self.parts = parts.compactMap { $0 }
    }

    var description: String { parts.map(String.init).joined(separator: ".") }

    /// "1.2" and "1.2.0" are the same version.
    static func == (a: AppVersion, b: AppVersion) -> Bool { !(a < b) && !(b < a) }

    static func < (a: AppVersion, b: AppVersion) -> Bool {
        for i in 0..<max(a.parts.count, b.parts.count) {
            let x = i < a.parts.count ? a.parts[i] : 0, y = i < b.parts.count ? b.parts[i] : 0
            if x != y { return x < y }
        }
        return false
    }
}

/// Asks GitHub for the latest published release, only when the person chooses Check for Updates.
@MainActor
final class UpdateChecker: ObservableObject {
    static let shared = UpdateChecker()
    static let latestRelease = URL(string: "https://api.github.com/repos/orlandoascanio/pocketleft/releases/latest")!
    static let releasesPage = URL(string: "https://github.com/orlandoascanio/pocketleft/releases")!

    enum Outcome: Equatable {
        case upToDate(current: String)
        case available(version: String, current: String, notes: URL, download: URL)
    }

    @Published private(set) var checking = false
    private let session: URLSession

    init(session: URLSession = .shared) { self.session = session }

    static var currentVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "dev"
    }

    /// Reads GitHub's "latest release" response and compares it with the running version.
    nonisolated static func evaluate(_ data: Data, current: String) throws -> Outcome {
        struct Asset: Decodable { let name: String; let browser_download_url: URL }
        struct Release: Decodable { let tag_name: String; let html_url: URL; let assets: [Asset] }
        let release = try JSONDecoder().decode(Release.self, from: data)
        guard let latest = AppVersion(release.tag_name) else { throw URLError(.cannotParseResponse) }
        // A development build has no version; any release counts as newer.
        if let mine = AppVersion(current), latest <= mine { return .upToDate(current: current) }
        let dmg = release.assets.first { $0.name == "Pocket.dmg" }?.browser_download_url
            ?? release.assets.first { $0.name.hasSuffix(".dmg") }?.browser_download_url
            ?? release.html_url
        return .available(version: latest.description, current: current, notes: release.html_url, download: dmg)
    }

    func check() async throws -> Outcome {
        var request = URLRequest(url: Self.latestRelease, timeoutInterval: 15)
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        request.setValue("Pocket-for-Mac/\(Self.currentVersion)", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await session.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        return try Self.evaluate(data, current: Self.currentVersion)
    }

    /// Checks and reports the result in an alert, with Download when a newer version exists.
    func checkAndReport() {
        guard !checking else { return }
        checking = true
        Task {
            defer { checking = false }
            let alert = NSAlert()
            do {
                switch try await check() {
                case .upToDate(let current):
                    alert.messageText = "You're up to date"
                    alert.informativeText = "Pocket \(current) is the newest version."
                    alert.addButton(withTitle: "OK")
                    present(alert)
                case .available(let version, let current, let notes, let download):
                    alert.messageText = "Pocket \(version) is available"
                    alert.informativeText = "You have \(current). Download the new version, open it and drag Pocket into Applications to replace this one. Your data stays where it is."
                    alert.addButton(withTitle: "Download")
                    alert.addButton(withTitle: "Release Notes")
                    alert.addButton(withTitle: "Later")
                    switch present(alert) {
                    case .alertFirstButtonReturn: NSWorkspace.shared.open(download)
                    case .alertSecondButtonReturn: NSWorkspace.shared.open(notes)
                    default: break
                    }
                }
            } catch {
                alert.alertStyle = .warning
                alert.messageText = "Couldn't check for updates"
                alert.informativeText = "Check your internet connection and try again, or see the releases on GitHub."
                alert.addButton(withTitle: "OK")
                alert.addButton(withTitle: "Open GitHub")
                if present(alert) == .alertSecondButtonReturn { NSWorkspace.shared.open(Self.releasesPage) }
            }
        }
    }

    @discardableResult
    private func present(_ alert: NSAlert) -> NSApplication.ModalResponse {
        NSApp.activate(ignoringOtherApps: true)
        return alert.runModal()
    }
}

enum AboutPanel {
    /// The standard About window, with what Pocket is and where it comes from.
    static func show() {
        let credits = NSMutableAttributedString(
            string: "Your balance in the menu bar, and how long it will last.\n",
            attributes: [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: NSColor.secondaryLabelColor])
        for (title, link) in [("pocketleft.app", "https://pocketleft.app"), ("Source code", "https://github.com/orlandoascanio/pocketleft")] {
            credits.append(NSAttributedString(string: title, attributes: [.font: NSFont.systemFont(ofSize: 11), .link: URL(string: link)!]))
            credits.append(NSAttributedString(string: title == "pocketleft.app" ? " · " : ""))
        }
        let centered = NSMutableParagraphStyle()
        centered.alignment = .center
        credits.addAttribute(.paragraphStyle, value: centered, range: NSRange(location: 0, length: credits.length))
        NSApp.activate(ignoringOtherApps: true)
        NSApp.orderFrontStandardAboutPanel(options: [
            .applicationName: "Pocket",
            .credits: credits,
            NSApplication.AboutPanelOptionKey(rawValue: "Copyright"): "Made by Orlando Ascanio. Free and open source.",
        ])
    }
}
