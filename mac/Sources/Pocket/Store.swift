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
    case newEntry(EntryDraft)
    case waiting
    case history
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

struct EntryReceipt {
    let text: String
    let target: WindowRequest
}

/// Owns the ledger. Without an account everything lives in one JSON file on this Mac.
/// With an account, this Mac keeps a full copy in its own file and syncs it (see AccountSync.swift).
@MainActor
final class Store: ObservableObject {
    @Published private(set) var ledger: Ledger
    @Published private(set) var today = Day.today
    @Published private(set) var change: BalanceChange?
    @Published private(set) var speech: Speech?
    @Published var windowRequest: WindowRequest?
    @Published private(set) var saveError: String?
    @Published private(set) var receipt: EntryReceipt?
    @Published var onboarded: Bool { didSet { defaults.set(onboarded, forKey: "onboarded") } }
    @Published var range: Int { didSet { defaults.set(range, forKey: "range") } }
    @Published var reminders: Bool {
        didSet {
            defaults.set(reminders, forKey: "reminders")
            if reminders { requestNotificationPermission() }
            scheduleReminders()
        }
    }

    /// The ledger file in use: the local one, or this Mac's copy of the account.
    var fileURL: URL { accountKey == nil ? localURL : accountURL }
    private let localURL: URL
    private let accountURL: URL
    private let journalURL: URL
    private let defaults: UserDefaults
    private let servicesEnabled: Bool
    private var timer: Timer?
    private var syncTimer: Timer?

    // MARK: account state
    private let keyStore: AccountKeyStore
    private let session: URLSession
    /// The server this Mac syncs with (or last used, so reconnecting starts there).
    @Published private(set) var server: Server
    private var client: AccountClient { AccountClient(session: session, server: server) }
    @Published private(set) var accountKey: String?
    @Published private(set) var syncState: SyncState = .offline
    @Published private(set) var journal = SyncJournal()
    private var syncInFlight = false
    private var syncAgain = false
    var connected: Bool { accountKey != nil }
    /// Changes still on their way to the account, and ones that need a look before retrying.
    var outbox: [PendingOp] { journal.outbox }

    var money: Money { Money(currency: ledger.currency) }
    var balance: Cents { ledger.balance }
    var waiting: [Occurrence] { ledger.waiting(today: today) }
    var projection: Projection { ledger.project(today: today, days: range) }
    var menuTitle: String {
        guard onboarded else { return "Pocket" }
        return money.string(balance) + (syncState == .badKey ? " ⚠︎" : "")
    }

    var spentThisMonth: Cents { ledger.summary(today.yearMonth).spent }

    var runway: Projection.Runway? {
        let p = ledger.project(today: today, days: 91)
        if p.steps.isEmpty && balance >= 0 { return nil }
        return p.runway
    }

    init(directory: URL? = nil, defaults suppliedDefaults: UserDefaults? = nil, servicesEnabled: Bool = true,
         session: URLSession = .shared, keyStore: AccountKeyStore? = nil) {
        // POCKET_DATA_DIR (development only) points the app at a separate folder, e.g. demo data.
        let env = ProcessInfo.processInfo.environment
        self.servicesEnabled = servicesEnabled && directory == nil && env["POCKET_DATA_DIR"] == nil
        self.defaults = suppliedDefaults ?? env["POCKET_DATA_DIR"].flatMap { UserDefaults(suiteName: "com.orlandoascanio.pocket.preview." + URL(fileURLWithPath: $0).lastPathComponent) } ?? .standard
        let dir = directory ?? env["POCKET_DATA_DIR"].map { URL(fileURLWithPath: $0, isDirectory: true) }
            ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
                .appendingPathComponent("Pocket", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        localURL = dir.appendingPathComponent("ledger.json")
        accountURL = dir.appendingPathComponent("account-ledger.json")
        journalURL = dir.appendingPathComponent("account-sync.json")
        // The real Keychain only for the installed app; tests and demo folders keep keys in memory.
        self.keyStore = keyStore ?? (directory == nil && env["POCKET_DATA_DIR"] == nil ? .keychain : .memory())
        self.session = session
        server = self.defaults.data(forKey: "accountServer").flatMap { try? JSONDecoder().decode(Server.self, from: $0) } ?? .original
        let key = self.keyStore.load()
        accountKey = key
        let fresh = Ledger(currency: Locale.current.currency?.identifier ?? "USD")
        let loaded = Store.read(key == nil ? localURL : accountURL) ?? fresh
        ledger = loaded
        if key != nil {
            journal = (try? Data(contentsOf: journalURL)).flatMap { try? Store.decoder().decode(SyncJournal.self, from: $0) } ?? SyncJournal()
        }
        let hasDemoData = env["POCKET_DATA_DIR"] != nil && !loaded.entries.isEmpty
        let wasOnboarded = defaults.bool(forKey: "onboarded")
        onboarded = wasOnboarded || hasDemoData || key != nil
        let r = defaults.integer(forKey: "range")
        range = [30, 91, 182, 365].contains(r) ? r : 91
        reminders = defaults.object(forKey: "reminders") as? Bool ?? true

        if self.servicesEnabled && env["POCKET_LOGIN"] == "off" { try? SMAppService.mainApp.unregister() }
        // Repeating money is logged on its day even if the app just sits in the menubar.
        if self.servicesEnabled {
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
            NotificationCenter.default.addObserver(forName: NSApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in await self?.syncNow() }
            }
            // Changes made on the phone show up here within half a minute.
            syncTimer = Timer.scheduledTimer(withTimeInterval: AccountConfig.syncEvery, repeats: true) { [weak self] _ in
                Task { @MainActor in await self?.syncNow() }
            }
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

    private func persist(_ candidate: Ledger) -> Bool {
        do {
            backupOncePerDay()
            try Store.encoder().encode(candidate).write(to: fileURL, options: .atomic)
            saveError = nil
            return true
        } catch {
            saveError = "Couldn't save: \(error.localizedDescription)"
            return false
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
        var candidate = ledger
        let logged = candidate.postDue(today: today)
        if !logged.isEmpty {
            let before = ledger.balance
            if persist(candidate) {
                ledger = candidate
                announce(diff: ledger.balance - before, before: before, category: logged.last?.category, deleted: false)
            }
        }
        scheduleReminders()
        if connected { Task { await syncNow() } }
    }

    @discardableResult
    private func mutate(deleted: Bool = false, category: String? = nil, _ body: (inout Ledger) -> Void) -> Bool {
        receipt = nil
        let before = ledger.balance
        var candidate = ledger
        body(&candidate)
        candidate.postDue(today: today)
        guard persist(candidate) else { return false }
        ledger = candidate
        let diff = ledger.balance - before
        if diff != 0 { announce(diff: diff, before: before, category: category, deleted: deleted) }
        scheduleReminders()
        return true
    }

    private func announce(diff: Cents, before: Cents, category: String?, deleted: Bool) {
        let after = before + diff
        change = BalanceChange(diff: diff, outOfRed: before < 0 && after >= 0, intoRed: before >= 0 && after < 0,
                               category: category, deleted: deleted)
    }

    func say(_ text: String, face: Face) { speech = Speech(text: text, face: face) }

    // MARK: actions

    @discardableResult
    func addEntry(cents: Cents, label: String, day: Day, category: String?, preset: Preset? = nil) -> UUID? {
        let entry = Entry(cents: cents, label: label, day: day, category: category)
        guard mutate(category: category, {
            $0.add(entry)
            if let preset { $0.presets.append(preset) }
        }) else { return nil }
        send("pocket_add", ["p_amount": dollars(cents), "p_label": label, "p_on": day.iso, "p_category": category ?? NSNull()],
             label: label, localID: entry.id)
        if let preset {
            send("pocket_preset_save", ["p_label": preset.label, "p_sign": preset.sign, "p_amount": preset.cents.map(dollars) ?? NSNull(),
                                        "p_category": preset.category ?? ""], label: preset.label, localID: preset.id)
        }
        receipt = EntryReceipt(text: "Added \(money.string(cents, signed: true)) · \(label)", target: .editEntry(entry.id))
        return entry.id
    }

    @discardableResult
    func updateEntry(_ entry: Entry) -> Bool {
        guard mutate(category: entry.category, { $0.update(entry) }) else { return false }
        send("pocket_update", ["p_id": entry.id.uuidString, "p_amount": dollars(entry.cents), "p_label": entry.label,
                               "p_on": entry.day.iso, "p_category": entry.category ?? ""], label: entry.label)
        return true
    }

    @discardableResult
    func deleteEntry(_ id: UUID) -> Bool {
        let label = ledger.entries.first { $0.id == id }?.label ?? "Entry"
        guard mutate(deleted: true, { $0.removeEntry(id) }) else { return false }
        send("pocket_delete", ["p_id": id.uuidString], label: label)
        return true
    }

    @discardableResult
    func addRule(_ rule: Rule) -> Bool {
        let before = ledger.balance
        guard mutate(category: rule.category, { $0.addRule(rule, today: today) }) else { return false }
        var args: [String: Any] = ["p_amount": dollars(rule.cents), "p_label": rule.label, "p_cadence": rule.cadence.rawValue,
                                   "p_start": rule.anchor.iso, "p_today": today.iso, "p_category": rule.category ?? NSNull(), "p_auto": rule.auto]
        if let total = rule.total { args["p_times"] = total }
        send("pocket_recurring_add", args, label: rule.label, localID: rule.id)
        receipt = EntryReceipt(text: "Scheduled \(money.string(rule.cents, signed: true)) · \(rule.label)", target: .editRule(rule.id))
        if ledger.balance == before {
            say(Lines.shared.line(rule.cents > 0 ? "waiting" : "planned"), face: rule.cents > 0 ? .hope : .happy)
        }
        if !rule.auto { requestNotificationPermission() }
        return true
    }

    @discardableResult
    func updateRule(_ id: UUID, cents: Cents, label: String, cadence: Cadence, next: Day, left: Int?,
                    category: String?, auto: Bool) -> Bool {
        guard mutate(category: category, {
            $0.updateRule(id, cents: cents, label: label, cadence: cadence, next: next, left: left,
                          category: category, auto: auto, today: today)
        }) else { return false }
        var args: [String: Any] = ["p_id": id.uuidString, "p_amount": dollars(cents), "p_label": label, "p_cadence": cadence.rawValue,
                                   "p_next": next.iso, "p_today": today.iso, "p_category": category ?? "", "p_auto": auto]
        if let left { args["p_left"] = left }
        send("pocket_recurring_update", args, label: label)
        return true
    }

    @discardableResult
    func removeRule(_ id: UUID) -> Bool {
        let label = ledger.rules.first { $0.id == id }?.label ?? "Payment"
        guard mutate({ $0.removeRule(id) }) else { return false }
        send("pocket_recurring_delete", ["p_id": id.uuidString], label: label)
        say(Lines.shared.line("deleted"), face: .oof)
        return true
    }

    @discardableResult
    func settle(_ occurrence: Occurrence, cents: Cents, on day: Day) -> Bool {
        guard let rule = ledger.rules.first(where: { $0.id == occurrence.ruleID }),
              occurrence.isNext, !rule.finished, rule.next == occurrence.day else { return false }
        guard mutate(category: occurrence.category, { $0.settle(occurrence.ruleID, cents: cents, on: day, today: today) }) else { return false }
        send("pocket_recurring_settle", ["p_id": occurrence.ruleID.uuidString, "p_amount": dollars(cents), "p_on": day.iso,
                                         "p_today": today.iso], label: occurrence.label)
        return true
    }

    @discardableResult
    func skip(_ occurrence: Occurrence) -> Bool {
        guard let rule = ledger.rules.first(where: { $0.id == occurrence.ruleID }),
              occurrence.isNext, !rule.finished, rule.next == occurrence.day else { return false }
        guard mutate({ $0.skip(occurrence.ruleID) }) else { return false }
        send("pocket_recurring_skip", ["p_id": occurrence.ruleID.uuidString], label: occurrence.label)
        say(Lines.shared.line("skip"), face: .oof)
        return true
    }

    @discardableResult
    func setActive(_ id: UUID, _ active: Bool) -> Bool {
        guard mutate({ $0.setActive(id, active, today: today) }) else { return false }
        send("pocket_recurring_set_active", ["p_id": id.uuidString, "p_active": active, "p_today": today.iso],
             label: ledger.rules.first { $0.id == id }?.label ?? "Payment")
        say(Lines.shared.line(active ? "resumed" : "paused"), face: active ? .joy : .sleep)
        return true
    }

    func savePreset(_ preset: Preset) {
        let exists = ledger.presets.contains { $0.id == preset.id }
        guard mutate({
            if let i = $0.presets.firstIndex(where: { $0.id == preset.id }) { $0.presets[i] = preset } else { $0.presets.append(preset) }
        }) else { return }
        var args: [String: Any] = ["p_label": preset.label, "p_sign": preset.sign, "p_amount": preset.cents.map(dollars) ?? NSNull(),
                                   "p_category": preset.category ?? ""]
        if exists { args["p_id"] = preset.id.uuidString }
        send("pocket_preset_save", args, label: preset.label, localID: exists ? nil : preset.id)
    }

    func deletePreset(_ id: UUID) {
        let label = ledger.presets.first { $0.id == id }?.label ?? "Button"
        guard mutate({ $0.presets.removeAll { $0.id == id } }) else { return }
        send("pocket_preset_delete", ["p_id": id.uuidString], label: label)
    }
    func movePresets(from: IndexSet, to: Int) { mutate { $0.presets.move(fromOffsets: from, toOffset: to) } }
    func setCurrency(_ code: String) { mutate { $0.currency = code } }

    @discardableResult
    func start(currency: String, cents: Cents, openAtLogin: Bool) -> Bool {
        guard mutate({
            $0.currency = currency
            if cents != 0 { $0.add(Entry(cents: cents, label: "Starting balance", day: today, category: Categories.start)) }
        }) else { return false }
        if openAtLogin && servicesEnabled { try? SMAppService.mainApp.register() }
        onboarded = true
        return true
    }

    // MARK: data

    func export(to url: URL) throws {
        try Store.encoder().encode(ledger).write(to: url, options: .atomic)
    }

    func importFile(_ url: URL) throws {
        guard !connected else { throw CocoaError(.featureUnsupported) }
        let data = try Data(contentsOf: url)
        let l = try Store.decoder().decode(Ledger.self, from: data)
        guard mutate({ $0 = l }) else { throw CocoaError(.fileWriteUnknown) }
        onboarded = true
    }

    func eraseEverything() {
        guard !connected else { return }
        let currency = ledger.currency
        guard mutate({ $0 = Ledger(currency: currency) }) else { return }
        onboarded = false
    }

    // MARK: account

    private func dollars(_ cents: Cents) -> Double { Double(cents) / 100 }

    /// Queues a change for the account (only while connected) and starts sending it.
    private func send(_ fn: String, _ args: [String: Any], label: String, localID: UUID? = nil, start: Bool = true) {
        guard connected, let data = try? JSONSerialization.data(withJSONObject: args) else { return }
        journal.outbox.append(PendingOp(function: fn, arguments: data, label: label, localID: localID))
        saveJournal()
        if start { Task { await syncNow() } }
    }

    private func saveJournal() {
        guard connected else { return }
        try? Store.encoder().encode(journal).write(to: journalURL, options: .atomic)
    }

    /// Sends what's waiting, in order, then replaces this Mac's copy with the account's.
    /// While anything can still be retried, the copy here (with those changes in it) is kept instead.
    func syncNow() async {
        guard let key = accountKey else { return }
        if syncInFlight { syncAgain = true; return }
        syncInFlight = true
        defer { syncInFlight = false }
        repeat {
            syncAgain = false
            if case .ok = syncState {} else { syncState = .syncing }
            do {
                try await flush(key)
                guard key == accountKey else { return }
                guard !journal.outbox.contains(where: { !$0.needsReview }) else { syncState = .offline; return }
                let data = try await client.rpc("pocket_state", ["p_today": Day.today.iso, "p_days": 1], key: key)
                let state = try Store.decoder().decode(ServerState.self, from: data)
                guard key == accountKey else { return }
                // A change made while the request was out goes first; the next round picks up the result.
                if journal.outbox.contains(where: { !$0.needsReview }) { syncAgain = true; continue }
                adopt(state.ledger(currency: ledger.currency))
                journal.lastSync = Date()
                if journal.outbox.isEmpty { journal.ids = [:] }
                saveJournal()
                syncState = .ok(Date())
            } catch let e as APIError where e.badKey {
                if key == accountKey { syncState = .badKey }
                return
            } catch {
                if key == accountKey { syncState = .offline }
                return
            }
        } while syncAgain
    }

    /// Takes the account's ledger as this Mac's copy, so edits from the phone show up (and the pocket reacts).
    private func adopt(_ next: Ledger) {
        let before = ledger.balance
        guard next != ledger else { return }
        if let r = receipt {
            switch r.target {
            case .editEntry(let id): if let mapped = journal.ids[id] { receipt = EntryReceipt(text: r.text, target: .editEntry(mapped)) }
            case .editRule(let id): if let mapped = journal.ids[id] { receipt = EntryReceipt(text: r.text, target: .editRule(mapped)) }
            default: break
            }
        }
        guard persist(next) else { return }
        ledger = next
        if next.balance != before {
            announce(diff: next.balance - before, before: before, category: nil, deleted: false)
        }
        scheduleReminders()
    }

    private func flush(_ key: String) async throws {
        while let op = journal.outbox.first(where: { !$0.needsReview }) {
            var args = (try JSONSerialization.jsonObject(with: op.arguments)) as? [String: Any] ?? [:]
            // Something added on this Mac moments ago is known to the account by the account's id.
            if let id = (args["p_id"] as? String).flatMap(UUID.init(uuidString:)), let mapped = journal.ids[id] {
                args["p_id"] = mapped.uuidString
            }
            do {
                let data = try await client.rpc(op.function, args, key: key)
                guard key == accountKey else { return }
                if let local = op.localID,
                   let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
                   let remote = (obj["id"] as? String).flatMap(UUID.init(uuidString:)) {
                    journal.ids[local] = remote
                }
                journal.outbox.removeAll { $0.id == op.id }
                saveJournal()
            } catch let e as URLError {
                if !AccountClient.safeToRetry.contains(e.code), let i = journal.outbox.firstIndex(where: { $0.id == op.id }) {
                    journal.outbox[i].needsReview = true
                    journal.outbox[i].message = "It may have reached your account. Check before retrying."
                    saveJournal()
                }
                throw e
            } catch let e as APIError where !e.badKey {
                if let i = journal.outbox.firstIndex(where: { $0.id == op.id }) {
                    journal.outbox[i].needsReview = true
                    journal.outbox[i].message = e.message
                    saveJournal()
                }
            }
        }
    }

    /// Joins an account with a 6-digit code made on a device that's already connected.
    func connect(code: String, server target: Server? = nil) async throws {
        let target = target ?? server
        let data = try await AccountClient(session: session, server: target)
            .rpc("pocket_pair_finish", ["p_code": code, "p_name": AccountConfig.deviceName], key: nil)
        let result = (try JSONSerialization.jsonObject(with: data)) as? [String: Any]
        guard let token = result?["token"] as? String else {
            switch result?["error"] as? String {
            case "expired": throw APIError(badKey: false, message: "That code expired or was already used. Make a new one.")
            case "too_many": throw APIError(badKey: false, message: "Too many tries. Make a new code on the other device.")
            default: throw APIError(badKey: false, message: "That code didn't match. Check it and try again.")
            }
        }
        try await connect(key: token, server: target)
    }

    /// Uses an access key (from pairing, or the Pocket Sync app on this Mac). Checks it before switching.
    func connect(key raw: String, server target: Server? = nil) async throws {
        let target = target ?? server
        let key = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let data: Data
        do { data = try await AccountClient(session: session, server: target).rpc("pocket_state", ["p_today": Day.today.iso, "p_days": 1], key: key) }
        catch let e as APIError where e.badKey { throw APIError(badKey: true, message: "That access was removed. Make a pairing code instead.") }
        catch is URLError { throw APIError(badKey: false, message: "Couldn't reach your account. Check your connection.") }
        let state = try Store.decoder().decode(ServerState.self, from: data)
        let copy = state.ledger(currency: ledger.currency)
        do {
            try Store.encoder().encode(copy).write(to: accountURL, options: .atomic)
        } catch {
            throw APIError(badKey: false, message: "Couldn't save the copy on this Mac: \(error.localizedDescription)")
        }
        keyStore.save(key)
        use(target)
        accountKey = key
        journal = SyncJournal(lastSync: Date())
        saveJournal()
        receipt = nil
        ledger = copy
        syncState = .ok(Date())
        onboarded = true
        scheduleReminders()
    }

    private func use(_ target: Server) {
        server = target
        defaults.set(try? JSONEncoder().encode(target), forKey: "accountServer")
    }

    /// Claims a brand-new server (your own Supabase project with Pocket's SQL loaded) and moves what's on
    /// this Mac into it. The upload goes through the outbox, so it survives a dropped connection.
    func setUp(_ target: Server) async throws {
        guard !connected else { return }
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            throw APIError(badKey: false, message: "Couldn't make a secure key.")
        }
        let key = bytes.map { String(format: "%02x", $0) }.joined()
        let data: Data
        do { data = try await AccountClient(session: session, server: target).rpc("pocket_setup", ["p_key": key], key: nil) }
        catch let e as APIError where e.message.hasPrefix("HTTP 404") || e.message.contains("pocket_setup") {
            throw APIError(badKey: false, message: "Pocket's SQL isn't loaded on that server yet. Follow the self-hosting guide, then try again.")
        }
        catch is URLError { throw APIError(badKey: false, message: "Couldn't reach that server. Check the address and your connection.") }
        let result = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        guard result?["ok"] as? Bool == true else {
            throw APIError(badKey: false, message: result?["error"] as? String == "already_set_up"
                ? "That server already has a Pocket. Join it with a pairing code from one of its devices."
                : "Couldn't set up that server.")
        }
        let local = ledger
        keyStore.save(key)
        use(target)
        accountKey = key
        journal = SyncJournal()
        guard persist(local) else { throw APIError(badKey: false, message: saveError ?? "Couldn't save on this Mac.") }
        // Oldest first, so the account lists them in the same order.
        for e in local.entries.sorted(by: { ($0.day, $0.created) < ($1.day, $1.created) }) where e.cents != 0 {
            send("pocket_add", ["p_amount": dollars(e.cents), "p_label": String(e.label.prefix(120)), "p_on": e.day.iso,
                                "p_category": e.category ?? NSNull()], label: e.label, localID: e.id, start: false)
        }
        for r in local.rules where !r.finished {
            var args: [String: Any] = ["p_amount": dollars(r.cents), "p_label": String(r.label.prefix(120)), "p_cadence": r.cadence.rawValue,
                                       "p_start": r.next.iso, "p_today": today.iso, "p_category": r.category ?? NSNull(), "p_auto": r.auto]
            if let left = r.remaining { args["p_times"] = left }
            send("pocket_recurring_add", args, label: r.label, localID: r.id, start: false)
            if !r.active {
                send("pocket_recurring_set_active", ["p_id": r.id.uuidString, "p_active": false, "p_today": today.iso], label: r.label, start: false)
            }
        }
        for p in local.presets {
            send("pocket_preset_save", ["p_label": p.label, "p_sign": p.sign, "p_amount": p.cents.map(dollars) ?? NSNull(),
                                        "p_category": p.category ?? ""], label: p.label, localID: p.id, start: false)
        }
        syncState = .syncing
        onboarded = true
        await syncNow()
    }

    /// Stops syncing. This Mac keeps everything as its local ledger; changes not yet sent are dropped.
    func disconnect() {
        guard connected else { return }
        let copy = ledger
        if FileManager.default.fileExists(atPath: localURL.path) {
            let backups = localURL.deletingLastPathComponent().appendingPathComponent("Backups", isDirectory: true)
            try? FileManager.default.createDirectory(at: backups, withIntermediateDirectories: true)
            try? FileManager.default.copyItem(at: localURL, to: backups.appendingPathComponent("ledger-before-disconnect-\(Int(Date().timeIntervalSince1970)).json"))
        }
        keyStore.save(nil)
        accountKey = nil
        journal = SyncJournal()
        try? FileManager.default.removeItem(at: journalURL)
        syncState = .offline
        receipt = nil
        _ = persist(copy)
        ledger = copy
    }

    func retry(_ id: UUID) {
        guard let i = journal.outbox.firstIndex(where: { $0.id == id }) else { return }
        journal.outbox[i].needsReview = false
        journal.outbox[i].message = nil
        saveJournal()
        Task { await syncNow() }
    }

    /// Drops a change that didn't sync. The account's version comes back on the next sync.
    func discard(_ id: UUID) {
        journal.outbox.removeAll { $0.id == id }
        saveJournal()
        Task { await syncNow() }
    }

    func pairStart() async throws -> (code: String, expires: Date) {
        let data = try await client.rpc("pocket_pair_start", key: accountKey)
        let obj = (try JSONSerialization.jsonObject(with: data)) as? [String: Any]
        guard let code = obj?["code"] as? String, code.count == 6, code.allSatisfy(\.isNumber) else {
            throw APIError(badKey: false, message: "Couldn't make a code.")
        }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let expires = (obj?["expires_at"] as? String).flatMap { f.date(from: $0) ?? ISO8601DateFormatter().date(from: $0) }
        return (code, expires ?? Date().addingTimeInterval(600))
    }

    func devices() async throws -> DevicesResponse {
        try JSONDecoder().decode(DevicesResponse.self, from: await client.rpc("pocket_devices", key: accountKey))
    }

    func removeDevice(_ device: Device) async throws {
        _ = try await client.rpc("pocket_device_remove", ["p_id": device.id], key: accountKey)
        if device.this { disconnect() }
    }

    // MARK: reminders

    private func requestNotificationPermission() {
        guard servicesEnabled && reminders else { return }
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in
            Task { @MainActor in self.scheduleReminders() }
        }
    }

    /// One reminder per payment that waits for confirmation: "Did Client pay?" at 10:00 on its day.
    private func scheduleReminders() {
        guard servicesEnabled else { return }
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
