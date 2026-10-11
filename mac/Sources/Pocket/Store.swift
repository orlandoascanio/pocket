import AppKit
import PocketCore
import ServiceManagement
import SwiftUI
@preconcurrency import UserNotifications

/// A change in the balance, so the pocket can react to it.
struct BalanceChange: Equatable {
    let id = UUID()
    let diff: Cents
    let outOfRed: Bool
    let intoRed: Bool
    let category: String?
    let deleted: Bool
}

/// Something the pocket should say that didn't move the balance (a plan, a skip, a pause).
struct Speech: Equatable {
    let id = UUID()
    let text: String
    let face: Face
}

/// Where a menubar click asks the main window to go.
enum WindowRequest: Equatable {
    case editEntry(UUID)
    case editRule(UUID)
    case section(AppSection)
}

enum AppSection: String, CaseIterable, Identifiable, Hashable {
    case overview = "Overview", plan = "Plan", insights = "Insights", settings = "Settings"
    var id: String { rawValue }
    var symbol: String {
        switch self {
        case .overview: "house"
        case .plan: "chart.line.uptrend.xyaxis"
        case .insights: "chart.bar.xaxis"
        case .settings: "gearshape"
        }
    }
}

/// Owns the ledger: everything lives in one JSON file on this Mac. No server, no account.
@MainActor
final class Store: ObservableObject {
    @Published private(set) var ledger: Ledger
    @Published private(set) var today = Day.today
    @Published private(set) var change: BalanceChange?
    @Published private(set) var speech: Speech?
    @Published var windowRequest: WindowRequest?
    @Published private(set) var saveError: String?
    @Published var onboarded: Bool { didSet { defaults.set(onboarded, forKey: "onboarded") } }
    @Published var range: Int { didSet { defaults.set(range, forKey: "range") } }
    @Published var reminders: Bool {
        didSet {
            defaults.set(reminders, forKey: "reminders")
            if reminders { requestNotificationPermission() }
            scheduleReminders()
        }
    }

    let fileURL: URL
    private let defaults = UserDefaults.standard
    private var timer: Timer?

    var money: Money { Money(currency: ledger.currency) }
    var balance: Cents { ledger.balance }
    var waiting: [Occurrence] { ledger.waiting(today: today) }
    var projection: Projection { ledger.project(today: today, days: range) }
    var menuTitle: String { onboarded ? money.string(balance) : "Pocket" }

    var spentThisMonth: Cents { ledger.summary(today.yearMonth).spent }

    var runway: Projection.Runway? {
        let p = ledger.project(today: today, days: 91)
        if p.steps.isEmpty && balance >= 0 { return nil }
        return p.runway
    }

    init() {
        // POCKET_DATA_DIR (development only) points the app at a separate folder, e.g. demo data.
        let env = ProcessInfo.processInfo.environment
        let dir = env["POCKET_DATA_DIR"].map { URL(fileURLWithPath: $0, isDirectory: true) }
            ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
                .appendingPathComponent("Pocket", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        fileURL = dir.appendingPathComponent("ledger.json")
        let loaded = Store.read(fileURL) ?? Ledger(currency: Locale.current.currency?.identifier ?? "USD")
        ledger = loaded
        let hasDemoData = env["POCKET_DATA_DIR"] != nil && !loaded.entries.isEmpty
        let wasOnboarded = UserDefaults.standard.bool(forKey: "onboarded")
        onboarded = wasOnboarded || hasDemoData
        let r = defaults.integer(forKey: "range")
        range = [30, 91, 182, 365].contains(r) ? r : 91
        reminders = defaults.object(forKey: "reminders") as? Bool ?? true

        if env["POCKET_LOGIN"] == "off" { try? SMAppService.mainApp.unregister() }
        // Repeating money is logged on its day even if the app just sits in the menubar.
        timer = Timer.scheduledTimer(withTimeInterval: 15 * 60, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        let nc = NSWorkspace.shared.notificationCenter
        nc.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        NotificationCenter.default.addObserver(forName: .NSCalendarDayChanged, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        tick()
    }

    // MARK: storage

    private static func decoder() -> JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }

    private static func encoder() -> JSONEncoder {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        e.outputFormatting = [.prettyPrinted, .sortedKeys]
        return e
    }

    private static func read(_ url: URL) -> Ledger? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? decoder().decode(Ledger.self, from: data)
    }

    private func persist() {
        do {
            backupOncePerDay()
            try Store.encoder().encode(ledger).write(to: fileURL, options: .atomic)
            saveError = nil
        } catch {
            saveError = "Couldn't save: \(error.localizedDescription)"
        }
    }

    /// Keeps a copy per day for the last 7 days, next to the data file.
    private func backupOncePerDay() {
        let fm = FileManager.default
        guard fm.fileExists(atPath: fileURL.path) else { return }
        let dir = fileURL.deletingLastPathComponent().appendingPathComponent("Backups", isDirectory: true)
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        let target = dir.appendingPathComponent("ledger-\(Day.today.iso).json")
        guard !fm.fileExists(atPath: target.path) else { return }
        try? fm.copyItem(at: fileURL, to: target)
        let old = (try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
        for url in old.sorted(by: { $0.lastPathComponent > $1.lastPathComponent }).dropFirst(7) {
            try? fm.removeItem(at: url)
        }
    }

    // MARK: changes

    /// Logs anything that came due (new day, wake from sleep, every 15 minutes).
    func tick() {
        today = .today
        let before = ledger.balance
        let logged = ledger.postDue(today: today)
        if !logged.isEmpty {
            persist()
            announce(diff: ledger.balance - before, before: before, category: logged.last?.category, deleted: false)
        }
        scheduleReminders()
    }

    private func mutate(deleted: Bool = false, category: String? = nil, _ body: (inout Ledger) -> Void) {
        let before = ledger.balance
        var l = ledger
        body(&l)
        l.postDue(today: today)
        ledger = l
        persist()
        let diff = ledger.balance - before
        if diff != 0 { announce(diff: diff, before: before, category: category, deleted: deleted) }
        scheduleReminders()
    }

    private func announce(diff: Cents, before: Cents, category: String?, deleted: Bool) {
        let after = before + diff
        change = BalanceChange(diff: diff, outOfRed: before < 0 && after >= 0, intoRed: before >= 0 && after < 0,
                               category: category, deleted: deleted)
    }

    func say(_ text: String, face: Face) { speech = Speech(text: text, face: face) }

    // MARK: actions

    @discardableResult
    func addEntry(cents: Cents, label: String, day: Day, category: String?) -> UUID {
        let e = Entry(cents: cents, label: label, day: day, category: category)
        mutate(category: category) { $0.add(e) }
        return e.id
    }

    func updateEntry(_ e: Entry) { mutate(category: e.category) { $0.update(e) } }

    func deleteEntry(_ id: UUID) { mutate(deleted: true) { $0.removeEntry(id) } }

    func addRule(_ r: Rule) {
        let before = ledger.balance
        mutate(category: r.category) { $0.addRule(r, today: today) }
        if ledger.balance == before {
            // Nothing logged yet: it's planned, so the pocket looks forward to it.
            say(Lines.shared.line(r.cents > 0 ? "waiting" : "planned"), face: r.cents > 0 ? .hope : .happy)
        }
        if !r.auto { requestNotificationPermission() }
    }

    func updateRule(_ id: UUID, cents: Cents, label: String, cadence: Cadence, next: Day, left: Int?,
                    category: String?, auto: Bool) {
        mutate(category: category) {
            $0.updateRule(id, cents: cents, label: label, cadence: cadence, next: next, left: left,
                          category: category, auto: auto, today: today)
        }
    }

    func removeRule(_ id: UUID) {
        mutate { $0.removeRule(id) }
        say(Lines.shared.line("deleted"), face: .oof)
    }

    func settle(_ o: Occurrence, cents: Cents, on day: Day) {
        mutate(category: o.category) { $0.settle(o.ruleID, cents: cents, on: day, today: today) }
    }

    func skip(_ o: Occurrence) {
        mutate { $0.skip(o.ruleID) }
        say(Lines.shared.line("skip"), face: .oof)
    }

    func setActive(_ id: UUID, _ active: Bool) {
        mutate { $0.setActive(id, active, today: today) }
        say(Lines.shared.line(active ? "resumed" : "paused"), face: active ? .joy : .sleep)
    }

    func savePreset(_ p: Preset) {
        mutate {
            if let i = $0.presets.firstIndex(where: { $0.id == p.id }) { $0.presets[i] = p } else { $0.presets.append(p) }
        }
    }

    func deletePreset(_ id: UUID) { mutate { $0.presets.removeAll { $0.id == id } } }

    func movePresets(from: IndexSet, to: Int) { mutate { $0.presets.move(fromOffsets: from, toOffset: to) } }

    func setCurrency(_ code: String) { mutate { $0.currency = code } }

    /// First run: the money you have right now becomes the starting balance.
    func start(currency: String, cents: Cents, openAtLogin: Bool) {
        if openAtLogin { try? SMAppService.mainApp.register() }
        mutate {
            $0.currency = currency
            if cents != 0 {
                $0.add(Entry(cents: cents, label: "Starting balance", day: today, category: Categories.start))
            }
        }
        onboarded = true
    }

    // MARK: data

    func export(to url: URL) throws {
        try Store.encoder().encode(ledger).write(to: url, options: .atomic)
    }

    func importFile(_ url: URL) throws {
        let data = try Data(contentsOf: url)
        let l = try Store.decoder().decode(Ledger.self, from: data)
        mutate { $0 = l }
        onboarded = true
    }

    func eraseEverything() {
        let currency = ledger.currency
        mutate { $0 = Ledger(currency: currency) }
        onboarded = false
    }

    // MARK: reminders

    private func requestNotificationPermission() {
        guard reminders else { return }
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in
            Task { @MainActor in self.scheduleReminders() }
        }
    }

    /// One reminder per payment that waits for confirmation: "Did Client pay?" at 10:00 on its day.
    private func scheduleReminders() {
        let center = UNUserNotificationCenter.current()
        let rules = ledger.liveRules.filter { $0.active && !$0.auto }
        let enabled = reminders
        let today = self.today
        center.getPendingNotificationRequests { pending in
            let ours = pending.map(\.identifier).filter { $0.hasPrefix("pocket.") }
            center.removePendingNotificationRequests(withIdentifiers: ours)
            guard enabled else { return }
            for r in rules where r.next > today {
                let content = UNMutableNotificationContent()
                content.title = r.cents > 0 ? "Did \(r.label) pay?" : "Was \(r.label) paid?"
                content.body = "Open Pocket to log it, with the real amount if it changed."
                content.sound = .default
                var when = DateComponents(year: r.next.year, month: r.next.month, day: r.next.day)
                when.hour = 10
                let trigger = UNCalendarNotificationTrigger(dateMatching: when, repeats: false)
                center.add(UNNotificationRequest(identifier: "pocket.\(r.id.uuidString)", content: content, trigger: trigger))
            }
        }
    }
}
