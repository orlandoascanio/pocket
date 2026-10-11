import AppKit
import ServiceManagement
import SwiftUI

enum Config {
    static let supabaseURL = URL(string: "https://upmymrrfpwnqmnaclpyt.supabase.co")!
    // Publishable key: safe to ship. On its own it can only call the key-gated pocket_* functions.
    static let publishableKey = "__SUPABASE_PUBLISHABLE_KEY__"
    static let webURL = URL(string: "https://orlandoascanio.github.io/pocket/")!
    static let refreshEvery: TimeInterval = 60
}

enum Fmt {
    private static let currency: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale(identifier: "en_US")
        return f
    }()
    private static let iso: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()
    private static let short: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        f.locale = Locale(identifier: "en_US")
        return f
    }()
    static func money(_ v: Double) -> String { currency.string(from: NSNumber(value: v)) ?? "\(v)" }
    static func signed(_ v: Double) -> String { (v > 0 ? "+" : "") + money(v) }
    static func iso(_ d: Date) -> String { iso.string(from: d) }
    static func today() -> String { iso(Date()) }
    static func shortDay(_ isoDay: String) -> String { iso.date(from: isoDay).map(short.string) ?? isoDay }
}

enum Cadence: String, CaseIterable, Identifiable {
    case once, weekly, biweekly, monthly, yearly
    var id: String { rawValue }
    var name: String {
        switch self {
        case .once: "Once"
        case .weekly: "Weekly"
        case .biweekly: "Every 2 weeks"
        case .monthly: "Monthly"
        case .yearly: "Yearly"
        }
    }
}

// Menubar glyph: the pocket-and-coin from the app icon, drawn as a template image.
enum Glyph {
    static let image: NSImage = {
        let svg = """
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18">
          <circle cx="10.4" cy="4.6" r="3.1" fill="black"/>
          <path d="M2.5 8.4 H15.5 V12.3 Q15.5 12.9 15 13.2 L9.5 16.1 Q9 16.35 8.5 16.1 L3 13.2 Q2.5 12.9 2.5 12.3 Z" fill="black"/>
        </svg>
        """
        let img = NSImage(data: Data(svg.utf8)) ?? NSImage(systemSymbolName: "dollarsign.circle", accessibilityDescription: "Pocket")!
        img.size = NSSize(width: 18, height: 18)
        img.isTemplate = true
        return img
    }()
}

struct Tx: Decodable, Identifiable {
    let id: String
    let amount: Double
    let label: String
    let occurred_on: String
    let recurring_id: String?
}

struct Rule: Decodable, Identifiable {
    let id: String
    let amount: Double
    let label: String
    let cadence: String
    let next_on: String
    let remaining: Int?
    let once: Bool?
}

struct Upcoming: Decodable, Identifiable {
    let recurring_id: String
    let label: String
    let amount: Double
    let due_on: String
    var id: String { recurring_id + due_on }
}

struct PocketState: Decodable {
    let transactions: [Tx]
    let recurring: [Rule]
    let upcoming: [Upcoming]
}

struct APIError: Error {
    let badKey: Bool
    let message: String
}

enum SyncState: Equatable {
    case idle, ok(Date), offline, badKey, noKey
}

@MainActor
final class Store: ObservableObject {
    @Published private(set) var txs: [Tx] = []
    @Published private(set) var rules: [Rule] = []
    @Published private(set) var upcoming: [Upcoming] = []
    @Published private(set) var balance: Double?
    @Published private(set) var state: SyncState = .idle
    @Published private(set) var syncing = false

    private let defaults = UserDefaults.standard
    private var timer: Timer?

    var key: String? {
        get { defaults.string(forKey: "key").flatMap { $0.isEmpty ? nil : $0 } }
        set {
            defaults.set(newValue, forKey: "key")
            objectWillChange.send()
        }
    }

    var spentThisMonth: Double {
        let month = String(Fmt.today().prefix(7))
        return txs.filter { $0.occurred_on.hasPrefix(month) && $0.amount < 0 }.reduce(0) { $0 - $1.amount }
    }

    /// Balance after everything scheduled in the next 30 days.
    var forecast: Double? {
        guard let balance, !upcoming.isEmpty else { return nil }
        return balance + upcoming.reduce(0) { $0 + $1.amount }
    }

    var menuTitle: String {
        guard let balance else { return "" }
        let warn = (state == .offline || state == .badKey) ? " ⚠︎" : ""
        return " " + Fmt.money(balance) + warn
    }

    init() {
        // Show the last known balance instantly at login, before the network answers.
        if defaults.object(forKey: "lastBalance") != nil {
            balance = defaults.double(forKey: "lastBalance")
        }
        if !defaults.bool(forKey: "loginConfigured") {
            try? SMAppService.mainApp.register()
            defaults.set(true, forKey: "loginConfigured")
        }
        timer = Timer.scheduledTimer(withTimeInterval: Config.refreshEvery, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.refresh() }
        }
        NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didWakeNotification, object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in await self?.refresh() }
        }
        Task { await refresh() }
    }

    func refresh() async {
        guard key != nil else { state = .noKey; return }
        guard !syncing else { return }
        syncing = true
        defer { syncing = false }
        do {
            let data = try await rpc("pocket_state", ["p_today": Fmt.today()])
            let s = try JSONDecoder().decode(PocketState.self, from: data)
            txs = s.transactions
            rules = s.recurring
            upcoming = s.upcoming
            let total = (txs.reduce(0) { $0 + $1.amount } * 100).rounded() / 100
            balance = total
            defaults.set(total, forKey: "lastBalance")
            state = .ok(Date())
        } catch let e as APIError where e.badKey {
            state = .badKey
        } catch {
            state = .offline
        }
    }

    /// `times`: number of payments for repeating entries (nil = never ends).
    /// A one-time entry dated in the future becomes a single scheduled payment,
    /// so it only counts once its day arrives.
    func add(amount: Double, label: String, spent: Bool, cadence: Cadence, on day: Date, times: Int?) async throws {
        let signedAmount = spent ? -amount : amount
        let start = Fmt.iso(day)
        if cadence == .once && start <= Fmt.today() {
            _ = try await rpc("pocket_add", ["p_amount": signedAmount, "p_label": label, "p_on": start])
        } else {
            let once = cadence == .once
            var args: [String: Any] = [
                "p_amount": signedAmount, "p_label": label,
                "p_cadence": once ? Cadence.monthly.rawValue : cadence.rawValue,
                "p_start": start, "p_today": Fmt.today(),
            ]
            if let n = once ? 1 : times { args["p_times"] = n }
            _ = try await rpc("pocket_recurring_add", args)
        }
        await refresh()
    }

    func setKey(_ k: String) async {
        key = k.trimmingCharacters(in: .whitespacesAndNewlines)
        await refresh()
    }

    private func rpc(_ fn: String, _ args: [String: Any] = [:]) async throws -> Data {
        guard let key else { throw APIError(badKey: true, message: "No key") }
        var req = URLRequest(url: Config.supabaseURL.appendingPathComponent("rest/v1/rpc/\(fn)"))
        req.httpMethod = "POST"
        req.timeoutInterval = 15
        req.setValue(Config.publishableKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var body = args
        body["k"] = key
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else {
            let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            throw APIError(badKey: obj?["code"] as? String == "28000",
                           message: obj?["message"] as? String ?? "HTTP \(code)")
        }
        return data
    }
}

struct PopoverView: View {
    @EnvironmentObject var store: Store

    @State private var spent = true
    @State private var cadence: Cadence = .once
    @State private var day = Date()
    @State private var amount = ""
    @State private var times = ""
    @State private var label = ""
    @State private var saving = false
    @State private var formError: String?
    @State private var keyDraft = ""
    @State private var copied = false
    @State private var launchAtLogin = SMAppService.mainApp.status == .enabled
    @FocusState private var focus: Field?

    enum Field { case amount, label }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if store.key == nil || store.state == .badKey {
                keyEntry
            } else {
                header
                addForm
                if !store.upcoming.isEmpty { comingUp }
                recent
            }
            Divider()
            footer
        }
        .padding(16)
        .frame(width: 340)
        .onAppear {
            launchAtLogin = SMAppService.mainApp.status == .enabled
            day = Date()
            Task { await store.refresh() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text("Money left").foregroundStyle(.secondary)
                Spacer()
                statusText.font(.caption).foregroundStyle(.secondary)
            }
            Text(store.balance.map(Fmt.money) ?? "—")
                .font(.system(size: 38, weight: .bold))
                .monospacedDigit()
                .foregroundStyle((store.balance ?? 0) < 0 ? Color.red : Color.primary)
            Text("Spent this month: \(Fmt.money(store.spentThisMonth))")
                .font(.caption).foregroundStyle(.secondary).monospacedDigit()
            if let f = store.forecast {
                Text("In 30 days: \(Text(Fmt.money(f)).bold().foregroundColor(f < 0 ? .red : .primary))")
                    .font(.callout).monospacedDigit().padding(.top, 4)
            }
        }
    }

    @ViewBuilder private var statusText: some View {
        switch store.state {
        case .ok(let d) where !store.syncing: Text("Synced \(d.formatted(date: .omitted, time: .shortened))")
        case .offline: Text("Offline")
        default: Text("Syncing…")
        }
    }

    private var addForm: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Picker("", selection: $spent) {
                    Text("Spent").tag(true)
                    Text("Got money").tag(false)
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                Picker("", selection: $cadence) {
                    ForEach(Cadence.allCases) { Text($0.name).tag($0) }
                }
                .labelsHidden()
                .fixedSize()
            }
            HStack(spacing: 6) {
                TextField("0.00", text: $amount)
                    .frame(width: 72)
                    .focused($focus, equals: .amount)
                    .onSubmit { focus = .label }
                TextField(placeholder, text: $label)
                    .focused($focus, equals: .label)
                    .onSubmit(submit)
            }
            .textFieldStyle(.roundedBorder)
            if cadence != .once {
                HStack(spacing: 6) {
                    Text("Payments").font(.caption).foregroundStyle(.secondary)
                    TextField("No end", text: $times)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 72)
                    Text("Empty = keeps going").font(.caption).foregroundStyle(.tertiary)
                }
            }
            HStack(spacing: 6) {
                Text(dateCaption).font(.caption).foregroundStyle(.secondary)
                DatePicker("", selection: $day, displayedComponents: .date)
                    .labelsHidden()
                    .datePickerStyle(.field)
                Spacer()
                Button(buttonTitle, action: submit)
                    .keyboardShortcut(.defaultAction)
                    .disabled(saving)
            }
            if let formError {
                Text(formError).font(.caption).foregroundStyle(.red)
            }
        }
    }

    private var placeholder: String {
        switch (cadence == .once, spent) {
        case (true, true): "What was it?"
        case (true, false): "Where's it from?"
        case (false, true): "e.g. Netflix, rent"
        case (false, false): "e.g. Paycheck"
        }
    }

    private var isFuture: Bool { Fmt.iso(day) > Fmt.today() }

    private var dateCaption: String {
        cadence == .once ? (isFuture ? (spent ? "Planned for" : "Expected on") : "Date") : (spent ? "First payment" : "First payday")
    }

    private var buttonTitle: String {
        if cadence != .once { return "Add repeating" }
        return isFuture ? (spent ? "Add planned" : "Add expected") : "Add"
    }

    private var comingUp: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("COMING UP").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
            ForEach(store.upcoming.prefix(3)) { u in
                HStack {
                    Text(Fmt.shortDay(u.due_on)).foregroundStyle(.secondary).frame(width: 48, alignment: .leading)
                    Text(u.label).lineLimit(1)
                    Spacer()
                    amountText(u.amount)
                }
                .font(.callout)
            }
        }
    }

    private var recent: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("RECENT").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
            if store.txs.isEmpty {
                Text("Nothing yet").font(.callout).foregroundStyle(.secondary)
            }
            ForEach(store.txs.prefix(5)) { t in
                HStack(spacing: 4) {
                    Text(t.label).lineLimit(1)
                    if t.recurring_id != nil {
                        Image(systemName: "repeat").font(.caption2).foregroundStyle(.secondary)
                    }
                    Spacer()
                    amountText(t.amount)
                }
                .font(.callout)
            }
            Text("Edit, delete, or stop repeating entries in the web app.")
                .font(.caption).foregroundStyle(.tertiary)
        }
    }

    private func amountText(_ v: Double) -> some View {
        Text(Fmt.signed(v)).monospacedDigit().foregroundStyle(v > 0 ? Color.green : Color.primary)
    }

    private var keyEntry: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Unlock Pocket").font(.headline)
            Text(store.state == .badKey ? "That key didn't work. Paste it again." : "Paste your key to connect.")
                .font(.callout).foregroundStyle(.secondary)
            HStack {
                SecureField("Key", text: $keyDraft).textFieldStyle(.roundedBorder).onSubmit(saveKey)
                Button("Save", action: saveKey).disabled(keyDraft.isEmpty)
            }
        }
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 10) {
            Toggle("Open at login", isOn: $launchAtLogin)
                .toggleStyle(.checkbox)
                .onChange(of: launchAtLogin) { _, on in
                    do {
                        if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
                    } catch {
                        launchAtLogin = SMAppService.mainApp.status == .enabled
                    }
                }
            HStack(spacing: 14) {
                Button("Open web app") { NSWorkspace.shared.open(Config.webURL) }
                Button(copied ? "Copied" : "Copy key for phone") {
                    guard let k = store.key else { return }
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(k, forType: .string)
                    copied = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { copied = false }
                }
                .disabled(store.key == nil)
                Spacer()
                Button("Quit") { NSApp.terminate(nil) }
            }
            .buttonStyle(.link)
            .font(.callout)
        }
    }

    private func saveKey() {
        let k = keyDraft
        keyDraft = ""
        Task { await store.setKey(k) }
    }

    private func submit() {
        let cleaned = amount
            .replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: ",", with: ".")
            .trimmingCharacters(in: .whitespaces)
        guard let n = Double(cleaned).map(abs), n > 0 else {
            formError = "Enter an amount, like 9.99"
            focus = .amount
            return
        }
        let l = label.trimmingCharacters(in: .whitespaces)
        guard !l.isEmpty else {
            formError = "Say what it was"
            focus = .label
            return
        }
        let t = times.trimmingCharacters(in: .whitespaces)
        let count = t.isEmpty ? nil : Int(t)
        if cadence != .once && !t.isEmpty && (count ?? 0) < 1 {
            formError = "Payments must be a whole number, like 3"
            return
        }
        saving = true
        formError = nil
        Task {
            do {
                try await store.add(amount: (n * 100).rounded() / 100, label: l, spent: spent,
                                     cadence: cadence, on: day, times: count)
                amount = ""
                times = ""
                label = ""
                spent = true
                cadence = .once
                day = Date()
                focus = .amount
            } catch {
                formError = "Couldn't save. Check your connection."
            }
            saving = false
        }
    }
}

@main
struct PocketApp: App {
    @StateObject private var store = Store()

    var body: some Scene {
        MenuBarExtra {
            PopoverView().environmentObject(store)
        } label: {
            HStack(spacing: 4) {
                Image(nsImage: Glyph.image)
                Text(store.menuTitle).monospacedDigit()
            }
        }
        .menuBarExtraStyle(.window)
    }
}
