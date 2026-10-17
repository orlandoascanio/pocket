import AppKit
import Foundation
import SwiftUI

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

    nonisolated static var currentVersion: String {
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

    // MARK: installing

    /// What the progress window shows while an update downloads and installs.
    @Published private(set) var installStatus: String?
    @Published private(set) var installProgress: Double?
    private var installTask: Task<Void, Never>?
    private var progressPanel: NSPanel?

    /// Checks and reports the result in an alert. When a newer version exists, Pocket downloads and installs it itself.
    func checkAndReport() {
        guard !checking, installTask == nil else { progressPanel?.makeKeyAndOrderFront(nil); return }
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
                    let inPlace = UpdateInstaller.canReplace(Bundle.main.bundleURL)
                    alert.messageText = "Pocket \(version) is available"
                    alert.informativeText = inPlace
                        ? "You have \(current). Pocket downloads the new version, replaces this one and opens again. Your data stays where it is."
                        : "You have \(current). Pocket downloads the new version and opens it, so you can drag Pocket into Applications. Your data stays where it is."
                    alert.addButton(withTitle: inPlace ? "Install and Relaunch" : "Download")
                    alert.addButton(withTitle: "Release Notes")
                    alert.addButton(withTitle: "Later")
                    switch present(alert) {
                    case .alertFirstButtonReturn: install(version: version, from: download, inPlace: inPlace)
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

    /// Downloads the disk image, checks it's Pocket signed by its developer, then replaces this copy and relaunches.
    /// When this copy can't be replaced (it runs from Downloads or the disk image), it opens the disk image instead.
    private func install(version: String, from download: URL, inPlace: Bool) {
        // A release without a disk image only has a web page.
        guard download.pathExtension.lowercased() == "dmg" else { NSWorkspace.shared.open(download); return }
        installProgress = 0
        installStatus = "Downloading Pocket \(version)…"
        showProgress()
        installTask = Task {
            var dmg: URL?
            defer {
                installTask = nil
                installStatus = nil
                installProgress = nil
                progressPanel?.close()
                progressPanel = nil
            }
            do {
                let file = try await UpdateInstaller.download(download, session: session) { p in
                    Task { @MainActor in self.installProgress = p }
                }
                dmg = file
                guard inPlace else {
                    NSWorkspace.shared.open(file)
                    return
                }
                installProgress = nil
                installStatus = "Installing Pocket \(version)…"
                let current = Bundle.main.bundleURL
                try await Task.detached { try UpdateInstaller.installApp(from: file, version: version, replacing: current) }.value
                try? FileManager.default.removeItem(at: file)
                UpdateInstaller.relaunch(current)
            } catch is CancellationError {
                if let dmg { try? FileManager.default.removeItem(at: dmg) }
            } catch {
                let alert = NSAlert()
                alert.alertStyle = .warning
                alert.messageText = "Couldn't install Pocket \(version)"
                alert.informativeText = "\(error.localizedDescription) This copy of Pocket wasn't changed."
                alert.addButton(withTitle: dmg == nil ? "OK" : "Open Disk Image")
                if dmg != nil { alert.addButton(withTitle: "Cancel") }
                if present(alert) == .alertFirstButtonReturn, let dmg { NSWorkspace.shared.open(dmg) }
            }
        }
    }

    private func showProgress() {
        let panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 340, height: 110), styleMask: [.titled, .fullSizeContentView],
                            backing: .buffered, defer: false)
        panel.title = "Updating Pocket"
        panel.titlebarAppearsTransparent = true
        panel.isReleasedWhenClosed = false
        panel.level = .floating
        panel.contentView = NSHostingView(rootView: UpdateProgressView(updates: self, cancel: { [weak self] in self?.installTask?.cancel() }))
        panel.center()
        NSApp.activate(ignoringOtherApps: true)
        panel.makeKeyAndOrderFront(nil)
        progressPanel = panel
    }

    @discardableResult
    private func present(_ alert: NSAlert) -> NSApplication.ModalResponse {
        NSApp.activate(ignoringOtherApps: true)
        return alert.runModal()
    }
}

/// The small window shown while an update downloads and installs.
struct UpdateProgressView: View {
    @ObservedObject var updates: UpdateChecker
    var cancel: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(updates.installStatus ?? "Updating Pocket…").font(.headline)
            if let p = updates.installProgress {
                ProgressView(value: p)
            } else {
                ProgressView().progressViewStyle(.linear)
            }
            HStack {
                Spacer()
                Button("Cancel", action: cancel).disabled(updates.installProgress == nil)
            }
        }
        .padding(20)
        .frame(width: 340)
    }
}

/// Downloads, checks and swaps in a new Pocket.app. Nothing is replaced unless the new app is Pocket,
/// signed with Pocket's Developer ID, and the version that was offered.
enum UpdateInstaller {
    static let bundleID = "com.orlandoascanio.pocket.mac"
    static let teamID = "VW98Z8698B"
    /// Apple-issued Developer ID certificate for Pocket's team, and Pocket's bundle identifier.
    static let requirement = "anchor apple generic and identifier \"\(bundleID)\" and certificate leaf[subject.OU] = \"\(teamID)\""

    struct Failure: LocalizedError {
        let errorDescription: String?
        init(_ message: String) { errorDescription = message }
    }

    /// Whether Pocket can replace the copy at `app` in place: a writable folder, and not a quarantine
    /// copy macOS made to run it from Downloads or a disk image.
    static func canReplace(_ app: URL) -> Bool {
        let path = app.path
        guard app.pathExtension == "app", !path.contains("/AppTranslocation/"), !path.hasPrefix("/Volumes/") else { return false }
        return FileManager.default.isWritableFile(atPath: app.deletingLastPathComponent().path)
            && FileManager.default.isWritableFile(atPath: path)
    }

    /// Saves the disk image to a temporary file, reporting progress from 0 to 1.
    static func download(_ url: URL, session: URLSession, progress: @escaping @Sendable (Double) -> Void) async throws -> URL {
        var request = URLRequest(url: url, timeoutInterval: 60)
        request.setValue("Pocket-for-Mac/\(UpdateChecker.currentVersion)", forHTTPHeaderField: "User-Agent")
        let (bytes, response) = try await session.bytes(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw Failure("The download didn't start.") }
        let total = response.expectedContentLength
        let file = FileManager.default.temporaryDirectory.appendingPathComponent("Pocket-update-\(UUID().uuidString).dmg")
        FileManager.default.createFile(atPath: file.path, contents: nil)
        let handle = try FileHandle(forWritingTo: file)
        defer { try? handle.close() }
        var buffer = Data()
        buffer.reserveCapacity(1 << 16)
        var written: Int64 = 0
        do {
            for try await byte in bytes {
                buffer.append(byte)
                if buffer.count >= 1 << 16 {
                    try Task.checkCancellation()
                    try handle.write(contentsOf: buffer)
                    written += Int64(buffer.count)
                    buffer.removeAll(keepingCapacity: true)
                    if total > 0 { progress(min(1, Double(written) / Double(total))) }
                }
            }
            try handle.write(contentsOf: buffer)
        } catch {
            try? FileManager.default.removeItem(at: file)
            throw error
        }
        progress(1)
        return file
    }

    /// Opens the disk image, checks the Pocket.app inside, and puts it where `current` is.
    static func installApp(from dmg: URL, version: String, replacing current: URL) throws {
        let mount = FileManager.default.temporaryDirectory.appendingPathComponent("Pocket-update-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: mount, withIntermediateDirectories: true)
        try run("/usr/bin/hdiutil", ["attach", dmg.path, "-nobrowse", "-readonly", "-noautoopen", "-mountpoint", mount.path])
        defer {
            _ = try? run("/usr/bin/hdiutil", ["detach", mount.path, "-force"])
            try? FileManager.default.removeItem(at: mount)
        }
        let app = mount.appendingPathComponent("Pocket.app")
        guard FileManager.default.fileExists(atPath: app.path) else { throw Failure("The download doesn't contain Pocket.") }
        // The disk image layout leaves Finder info on the app, so its copy there gets the strict check after copying.
        try verify(app, version: version, strict: false)
        // Copy next to the current app first (same disk), without extended attributes, check the copy, then swap it in.
        let staged = current.deletingLastPathComponent().appendingPathComponent(".Pocket-update-\(UUID().uuidString).app")
        try run("/usr/bin/ditto", ["--norsrc", "--noextattr", "--noqtn", app.path, staged.path])
        do {
            try verify(staged, version: version)
            _ = try FileManager.default.replaceItemAt(current, withItemAt: staged)
        } catch {
            try? FileManager.default.removeItem(at: staged)
            throw error
        }
    }

    /// Throws unless `app` is a valid, untampered Pocket signed by Pocket's developer, at `version`.
    static func verify(_ app: URL, version: String?, strict: Bool = true) throws {
        // Apple's codesign in a fresh process, so no signature check cached in this one can answer for a changed file.
        do {
            try run("/usr/bin/codesign", ["--verify", "--deep"] + (strict ? ["--strict"] : []) + ["-R", "=" + requirement, app.path])
        } catch {
            throw Failure("The download isn't signed by Pocket's developer.")
        }
        if let version {
            let info = NSDictionary(contentsOf: app.appendingPathComponent("Contents/Info.plist"))
            guard let found = (info?["CFBundleShortVersionString"] as? String).flatMap(AppVersion.init),
                  let wanted = AppVersion(version), found == wanted else {
                throw Failure("The download isn't Pocket \(version).")
            }
        }
    }

    /// Opens the new Pocket once this one has quit.
    @MainActor
    static func relaunch(_ app: URL) {
        let script = "while /bin/kill -0 \(ProcessInfo.processInfo.processIdentifier) 2>/dev/null; do /bin/sleep 0.2; done; /usr/bin/open \"$0\""
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/sh")
        p.arguments = ["-c", script, app.path]
        try? p.run()
        NSApp.terminate(nil)
    }

    @discardableResult
    private static func run(_ tool: String, _ args: [String]) throws -> String {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: tool)
        p.arguments = args
        let out = Pipe()
        p.standardOutput = out
        p.standardError = out
        try p.run()
        let data = out.fileHandleForReading.readDataToEndOfFile()
        p.waitUntilExit()
        guard p.terminationStatus == 0 else {
            throw Failure("\(URL(fileURLWithPath: tool).lastPathComponent) failed: \(String(decoding: data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines))")
        }
        return String(decoding: data, as: UTF8.self)
    }
}

enum AboutPanel {
    /// The standard About window, with what Pocket is and where it comes from.
    static func show() {
        let credits = NSMutableAttributedString(
            string: "Your balance in the menu bar, and how long it will last.\n",
            attributes: [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: NSColor.secondaryLabelColor])
        let links = [("pocketleft.app", "https://pocketleft.app"), ("Source code", "https://github.com/orlandoascanio/pocketleft"),
                     ("Star on GitHub", "https://github.com/orlandoascanio/pocketleft")]
        for (i, (title, link)) in links.enumerated() {
            credits.append(NSAttributedString(string: title, attributes: [.font: NSFont.systemFont(ofSize: 11), .link: URL(string: link)!]))
            if i < links.count - 1 { credits.append(NSAttributedString(string: " · ", attributes: [.font: NSFont.systemFont(ofSize: 11)])) }
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
