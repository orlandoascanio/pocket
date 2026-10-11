import AppKit
import ServiceManagement
import SwiftUI

enum Config {
    static let supabaseURL = URL(string: "https://upmymrrfpwnqmnaclpyt.supabase.co")!
    // Publishable key: safe to ship. On its own it can only call the key-gated pocket_* functions.
    static let publishableKey = "__SUPABASE_PUBLISHABLE_KEY__"
    static let webURL = URL(string: "https://orlandoascanio.github.io/pocket/")!
    static let refreshEvery: TimeInterval = 60
    static let forecastDays = 91
}

enum Fmt {
    private static let currency: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale(identifier: "en_US")
        return f
    }()
    private static let isoF: DateFormatter = {
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
    static func iso(_ d: Date) -> String { isoF.string(from: d) }
    static func date(_ isoDay: String) -> Date? { isoF.date(from: isoDay) }
    static func today() -> String { iso(Date()) }
    static func shortDay(_ isoDay: String) -> String { date(isoDay).map(short.string) ?? isoDay }
    static func parseAmount(_ s: String) -> Double? {
        let cleaned = s.replacingOccurrences(of: "$", with: "").replacingOccurrences(of: ",", with: ".")
            .trimmingCharacters(in: .whitespaces)
        guard let n = Double(cleaned).map(abs), n > 0 else { return nil }
        return (n * 100).rounded() / 100
    }
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

struct Category: Identifiable, Hashable {
    let id: String
    let name: String
    let symbol: String
}

enum Categories {
    static let spend: [Category] = [
        .init(id: "games", name: "Games", symbol: "gamecontroller"),
        .init(id: "subscriptions", name: "Subscriptions", symbol: "repeat"),
        .init(id: "bills", name: "Bills", symbol: "bolt"),
        .init(id: "apps", name: "Apps", symbol: "square.grid.2x2"),
        .init(id: "food", name: "Food", symbol: "cup.and.saucer"),
        .init(id: "shopping", name: "Shopping", symbol: "bag"),
        .init(id: "fun", name: "Fun", symbol: "sparkles"),
        .init(id: "transport", name: "Transport", symbol: "bus"),
        .init(id: "other", name: "Other", symbol: "ellipsis.circle"),
    ]
    static let income: [Category] = [
        .init(id: "pay", name: "Pay", symbol: "banknote"),
        .init(id: "gift", name: "Gift", symbol: "gift"),
        .init(id: "refund", name: "Refund", symbol: "arrow.uturn.backward"),
        .init(id: "otherin", name: "Other", symbol: "arrow.down.left"),
    ]
    static let all = spend + income + [.init(id: "start", name: "Starting balance", symbol: "banknote")]
    static func find(_ id: String?) -> Category? { all.first { $0.id == id } }
    static func symbol(_ id: String?, amount: Double) -> String {
        find(id)?.symbol ?? (amount > 0 ? "arrow.down.left" : "arrow.up.right")
    }
}

// Same colors as the web app: warm off-white / near-black, pocket green.
enum Palette {
    private static func adaptive(light: NSColor, dark: NSColor) -> Color {
        Color(nsColor: NSColor(name: nil) { $0.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? dark : light })
    }
    static let bg = adaptive(light: NSColor(red: 0.965, green: 0.961, blue: 0.949, alpha: 1),
                             dark: NSColor(red: 0.11, green: 0.11, blue: 0.11, alpha: 1))
    static let surface = adaptive(light: .white, dark: NSColor(red: 0.16, green: 0.16, blue: 0.16, alpha: 1))
    static let accent = adaptive(light: NSColor(red: 0.114, green: 0.42, blue: 0.278, alpha: 1),
                                 dark: NSColor(red: 0.298, green: 0.788, blue: 0.561, alpha: 1))
}

/// What the pocket says. Each pool is dealt like a shuffled deck so lines don't repeat until it runs out.
@MainActor
enum Lines {
    static let pools: [String: [String]] = [
        "in": ["Yum!", "Ooh, shiny!", "Thank you!", "Mmm, coins", "More, please", "Cha-ching!", "Feeling richer", "Into the pocket!", "Coin acquired"],
        "inBig": ["Payday!", "Big money!", "Whoa, nice!", "We're rich! (ish)", "So heavy now"],
        "gift": ["A gift? How lovely", "Someone likes you", "Free money!"],
        "refund": ["Money back!", "Refund secured", "It came back home"],
        "out": ["Oof", "Bye-bye, coin", "There it goes", "Spent!", "Hope it was worth it", "Lighter pocket", "And it's gone"],
        "outBig": ["Whoa, big one", "That was a lot of coins", "Ouch", "My pocket felt that"],
        "outSmall": ["Just a tiny one", "Pocket change", "Barely felt it"],
        "games": ["Another game? Have fun", "Game on!", "GG", "Add it to the backlog", "Just one more game…"],
        "subscriptions": ["Another subscription…", "Monthly friend added", "Subscribed!"],
        "bills": ["Adulting", "Bills, bills, bills", "Lights stay on"],
        "apps": ["New app, new me", "Installed!"],
        "food": ["Bon appétit", "Snack time"],
        "shopping": ["Ooh, what did you get?", "Retail therapy"],
        "fun": ["Have fun!", "Treat yourself"],
        "transport": ["Safe travels", "Vroom"],
        "waiting": ["Can't wait!", "Counting the days", "I'll keep an eye out"],
        "planned": ["I'll remember it", "Noted", "On the calendar"],
        "poke": ["Hehe", "That tickles!", "Still here!", "Boop", "Careful, I'm full of coins", "*jingle*", "You found me"],
        "skip": ["Skipped!", "Maybe next time", "Okay, not this one"],
    ]
    private static var decks: [String: [String]] = [:]

    static func line(_ pool: String) -> String {
        if decks[pool]?.isEmpty ?? true { decks[pool] = (pools[pool] ?? ["Hi"]).shuffled() }
        return decks[pool]!.removeLast()
    }

    static func forChange(_ diff: Double, category: String?) -> String {
        if diff > 0 {
            if category == "gift" || category == "refund" { return line(category!) }
            return line(diff >= 200 ? "inBig" : "in")
        }
        if let c = category, pools[c] != nil, Double.random(in: 0...1) < 0.6 { return line(c) }
        return line(-diff >= 50 ? "outBig" : -diff < 2 ? "outSmall" : "out")
    }
}

struct Tx: Decodable, Identifiable, Equatable {
    let id: String
    let amount: Double
    let label: String
    let occurred_on: String
    let recurring_id: String?
    let category: String?
}

struct Rule: Decodable, Identifiable, Equatable {
    let id: String
    let amount: Double
    let label: String
    let cadence: String
    let next_on: String
    let remaining: Int?
    let once: Bool?
    let active: Bool?
    let auto: Bool?
    let category: String?
}

struct Upcoming: Decodable, Identifiable, Equatable {
    let recurring_id: String
    let label: String
    let amount: Double
    let due_on: String
    let overdue: Bool?
    let category: String?
    var id: String { recurring_id + due_on }
}

struct Preset: Decodable, Identifiable, Equatable {
    let id: String
    let label: String
    let amount: Double?
    let sign: Int
    let category: String?
}

struct PocketState: Decodable {
    let transactions: [Tx]
    let recurring: [Rule]
    let upcoming: [Upcoming]
    let presets: [Preset]?
}

struct BalanceChange: Equatable {
    let id = UUID()
    let diff: Double
    let outOfRed: Bool
    let intoRed: Bool
    let category: String?
}

struct Runway {
    let lead: String
    let strong: String
    let warn: Bool
}

/// The gold coin from the app icon, spun in 3D when money moves.
struct CoinView: View {
    var spin: Double
    var hop: CGFloat

    private let gold = Color(red: 0.92, green: 0.66, blue: 0.23)
    private let ink = Color(red: 0.66, green: 0.42, blue: 0.09)

    var body: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(
                    colors: [Color(red: 1, green: 0.96, blue: 0.77), Color(red: 1, green: 0.85, blue: 0.4), gold],
                    center: UnitPoint(x: 0.34, y: 0.28), startRadius: 1, endRadius: 24))
            Circle().strokeBorder(ink.opacity(0.4), lineWidth: 2)
            Text("$").font(.system(size: 21, weight: .heavy, design: .rounded)).foregroundStyle(ink)
        }
        .frame(width: 38, height: 38)
        .rotation3DEffect(.degrees(spin), axis: (x: 0, y: 1, z: 0), perspective: 0.6)
        .offset(y: hop)
        .shadow(color: .black.opacity(0.18), radius: 4, y: 3)
    }
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
    @Published private(set) var presets: [Preset] = []
    @Published private(set) var balance: Double?
    @Published private(set) var state: SyncState = .idle
    @Published private(set) var syncing = false
    /// Set on every balance change seen while running.
    @Published private(set) var change: BalanceChange?

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

    /// Money that was due but hasn't been confirmed yet: the next one per repeating payment.
    var waiting: [Upcoming] {
        var seen = Set<String>()
        return upcoming.filter { $0.overdue == true && seen.insert($0.recurring_id).inserted }
    }

    var comingUp: [Upcoming] { upcoming.filter { $0.overdue != true } }

    /// When the money runs out (or comes back above zero) within the forecast window.
    var runway: Runway? {
        guard let balance else { return nil }
        if upcoming.isEmpty && balance >= 0 { return nil }
        let today = Fmt.today()
        let end = Fmt.iso(Calendar.current.date(byAdding: .day, value: Config.forecastDays, to: Date())!)
        let events = upcoming
            .map { (date: $0.overdue == true ? today : $0.due_on, u: $0) }
            .filter { $0.date <= end }
            .sorted { $0.date < $1.date }
        var bal = balance
        var hitZero: String?
        var backAbove: (date: String, u: Upcoming)?
        for e in events {
            let before = bal
            bal += e.u.amount
            if before >= 0 && bal < 0 && hitZero == nil { hitZero = e.date }
            if before < 0 && bal >= 0 && backAbove == nil { backAbove = e }
        }
        if balance < 0 {
            if let b = backAbove {
                return b.u.overdue == true
                    ? Runway(lead: "Back above $0 once", strong: "\(b.u.label) pays", warn: false)
                    : Runway(lead: "Back above $0 on", strong: Fmt.shortDay(b.date), warn: false)
            }
            return Runway(lead: "Below $0 for the next", strong: "3 months", warn: true)
        }
        if let hitZero { return Runway(lead: "Runs out on", strong: Fmt.shortDay(hitZero), warn: true) }
        return Runway(lead: "Lasts past", strong: Fmt.shortDay(end), warn: false)
    }

    var menuTitle: String {
        guard let balance else { return "Pocket" }
        let warn = (state == .offline || state == .badKey) ? " ⚠︎" : ""
        return Fmt.money(balance) + warn
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
            let data = try await rpc("pocket_state", ["p_today": Fmt.today(), "p_days": Config.forecastDays])
            let s = try JSONDecoder().decode(PocketState.self, from: data)
            let known = Set(txs.map(\.id))
            txs = s.transactions
            rules = s.recurring
            upcoming = s.upcoming
            presets = s.presets ?? []
            let total = (txs.reduce(0) { $0 + $1.amount } * 100).rounded() / 100
            if let prev = balance, prev != total, state != .idle {
                let newest = txs.first { !known.contains($0.id) }
                change = BalanceChange(diff: total - prev, outOfRed: prev < 0 && total >= 0,
                                       intoRed: prev >= 0 && total < 0, category: newest?.category)
            }
            balance = total
            defaults.set(total, forKey: "lastBalance")
            state = .ok(Date())
        } catch let e as APIError where e.badKey {
            state = .badKey
        } catch {
            state = .offline
        }
    }

    // MARK: writes (each one syncs right after, so every device sees it)

    /// A one-time entry dated in the future becomes a single scheduled payment, so it only counts on its day.
    func add(amount: Double, label: String, cadence: Cadence, on day: Date, times: Int?,
             category: String?, auto: Bool) async throws {
        let start = Fmt.iso(day)
        if cadence == .once && start <= Fmt.today() {
            _ = try await rpc("pocket_add", ["p_amount": amount, "p_label": label, "p_on": start,
                                             "p_category": category ?? NSNull()])
        } else {
            let once = cadence == .once
            var args: [String: Any] = [
                "p_amount": amount, "p_label": label,
                "p_cadence": once ? Cadence.monthly.rawValue : cadence.rawValue,
                "p_start": start, "p_today": Fmt.today(),
                "p_category": category ?? NSNull(), "p_auto": auto,
            ]
            if let n = once ? 1 : times { args["p_times"] = n }
            _ = try await rpc("pocket_recurring_add", args)
        }
        await refresh()
    }

    func updateTx(_ id: String, amount: Double, label: String, on day: Date, category: String?) async throws {
        _ = try await rpc("pocket_update", ["p_id": id, "p_amount": amount, "p_label": label,
                                            "p_on": Fmt.iso(day), "p_category": category ?? ""])
        await refresh()
    }

    func deleteTx(_ id: String) async throws {
        _ = try await rpc("pocket_delete", ["p_id": id])
        await refresh()
    }

    func updateRule(_ id: String, amount: Double, label: String, cadence: Cadence, next: Date, left: Int?,
                    category: String?, auto: Bool) async throws {
        let once = cadence == .once
        var args: [String: Any] = [
            "p_id": id, "p_amount": amount, "p_label": label,
            "p_cadence": once ? Cadence.monthly.rawValue : cadence.rawValue,
            "p_next": Fmt.iso(next), "p_today": Fmt.today(), "p_category": category ?? "", "p_auto": auto,
        ]
        if let n = once ? 1 : left { args["p_left"] = n }
        _ = try await rpc("pocket_recurring_update", args)
        await refresh()
    }

    func deleteRule(_ id: String) async throws {
        _ = try await rpc("pocket_recurring_delete", ["p_id": id])
        await refresh()
    }

    func setActive(_ id: String, _ active: Bool) async throws {
        _ = try await rpc("pocket_recurring_set_active", ["p_id": id, "p_active": active, "p_today": Fmt.today()])
        await refresh()
    }

    func settle(_ u: Upcoming, amount: Double) async throws {
        _ = try await rpc("pocket_recurring_settle", ["p_id": u.recurring_id, "p_amount": amount,
                                                      "p_on": Fmt.today(), "p_today": Fmt.today()])
        await refresh()
    }

    func skip(_ u: Upcoming) async throws {
        _ = try await rpc("pocket_recurring_skip", ["p_id": u.recurring_id])
        await refresh()
    }

    func use(_ p: Preset) async throws {
        guard let a = p.amount else { return }
        _ = try await rpc("pocket_add", ["p_amount": Double(p.sign) * a, "p_label": p.label,
                                         "p_on": Fmt.today(), "p_category": p.category ?? NSNull()])
        await refresh()
    }

    func pairStart() async throws -> (code: String, expires: Date) {
        let data = try await rpc("pocket_pair_start")
        let obj = (try JSONSerialization.jsonObject(with: data)) as? [String: Any]
        let code = obj?["code"] as? String ?? "------"
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let expires = (obj?["expires_at"] as? String).flatMap { f.date(from: $0) } ?? Date().addingTimeInterval(600)
        return (code, expires)
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

/// ⌘1 … ⌘9 for the first nine quick-add buttons.
struct NumberShortcut: ViewModifier {
    let index: Int
    func body(content: Content) -> some View {
        if index < 9 {
            content.keyboardShortcut(KeyEquivalent(Character(String(index + 1))), modifiers: .command)
        } else {
            content
        }
    }
}

enum Editing: Equatable {
    case tx(Tx)
    case rule(Rule)
}

enum ListTab: String, CaseIterable, Identifiable {
    case recent = "Recent", repeating = "Repeating", coming = "Coming up"
    var id: String { rawValue }
}

struct PopoverView: View {
    @EnvironmentObject var store: Store

    @State private var spent = true
    @State private var cadence: Cadence = .once
    @State private var day = Date()
    @State private var amount = ""
    @State private var times = ""
    @State private var label = ""
    @State private var category: String?
    @State private var categoryTouched = false
    @State private var confirm = false
    @State private var confirmTouched = false
    @State private var editing: Editing?
    @State private var listTab: ListTab = .recent
    @State private var hovered: String?
    @State private var settleDrafts: [String: String] = [:]
    @State private var pairing: (code: String, expires: Date)?
    @State private var saving = false
    @State private var saved = 0
    @State private var spin = 0.0
    @State private var hop: CGFloat = 0
    @State private var bubble: String?
    @State private var bubbleTask: Task<Void, Never>?
    @State private var formError: String?
    @State private var keyDraft = ""
    @State private var launchAtLogin = SMAppService.mainApp.status == .enabled
    @FocusState private var focus: Field?

    enum Field { case amount, label }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if store.key == nil || store.state == .badKey {
                keyEntry
            } else if let pairing {
                pairingView(pairing)
            } else {
                header
                if !store.presets.isEmpty && editing == nil { quickBar }
                addForm
                if !store.waiting.isEmpty && editing == nil { waitingSection }
                listSection
            }
            Divider()
            footer
        }
        .padding(16)
        .frame(width: 360)
        .background(Palette.bg)
        .tint(Palette.accent)
        .onAppear {
            launchAtLogin = SMAppService.mainApp.status == .enabled
            if editing == nil { day = Date() }
            Task { await store.refresh() }
        }
        .onChange(of: store.change) { _, c in if let c { react(to: c) } }
    }

    // MARK: header

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text("Money left").foregroundStyle(.secondary)
                Spacer()
                statusText.font(.caption).foregroundStyle(.secondary)
            }
            HStack(alignment: .center) {
                Text(store.balance.map(Fmt.money) ?? "—")
                    .font(.system(size: 38, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .contentTransition(.numericText(value: store.balance ?? 0))
                    .foregroundStyle((store.balance ?? 0) < 0 ? Color.red : Color.primary)
                    .animation(.snappy(duration: 0.6), value: store.balance)
                Spacer()
                ZStack(alignment: .bottomTrailing) {
                    CoinView(spin: spin, hop: hop)
                        .onTapGesture { poke() }
                        .help("Poke your pocket")
                    if let bubble {
                        Text(bubble)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(Palette.surface, in: Capsule())
                            .overlay(Capsule().strokeBorder(.primary.opacity(0.1)))
                            .shadow(color: .black.opacity(0.12), radius: 6, y: 3)
                            .fixedSize()
                            .offset(x: 4, y: -40)
                            .transition(.scale(scale: 0.6, anchor: .bottomTrailing).combined(with: .opacity))
                    }
                }
            }
            Text("Spent this month: \(Fmt.money(store.spentThisMonth))")
                .font(.caption).foregroundStyle(.secondary).monospacedDigit()
            if let r = store.runway {
                HStack(spacing: 4) {
                    Image(systemName: r.warn ? "chart.line.downtrend.xyaxis" : "chart.line.uptrend.xyaxis")
                        .foregroundStyle(.secondary)
                    Text(r.lead)
                    Text(r.strong).bold().foregroundStyle(r.warn ? Color.red : Color.primary)
                }
                .font(.callout)
                .padding(.top, 4)
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

    // MARK: quick add

    private var quickBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(Array(store.presets.enumerated()), id: \.element.id) { i, p in
                    Button { usePreset(p) } label: {
                        HStack(spacing: 5) {
                            Image(systemName: Categories.symbol(p.category, amount: Double(p.sign)))
                                .foregroundStyle(p.sign > 0 ? Palette.accent : Color.secondary)
                            Text(p.label)
                            if let a = p.amount {
                                Text((p.sign > 0 ? "+" : "") + Fmt.money(a)).foregroundStyle(.secondary).monospacedDigit()
                            }
                        }
                        .font(.callout.weight(.medium))
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(Palette.surface, in: Capsule())
                        .overlay(Capsule().strokeBorder(.primary.opacity(0.12)))
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .modifier(NumberShortcut(index: i))
                    .help(i < 9 ? "⌘\(i + 1)" : p.label)
                }
            }
        }
    }

    // MARK: form

    private var isFuture: Bool { Fmt.iso(day) > Fmt.today() }
    private var isPlanned: Bool { cadence != .once || isFuture }
    private var editingTx: Bool { if case .tx = editing { return true } else { return false } }
    private var editingRule: Rule? { if case .rule(let r) = editing { return r } else { return nil } }
    private var categories: [Category] { spent ? Categories.spend : Categories.income }

    private var addForm: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let editing {
                HStack {
                    Text(editingTitle(editing)).font(.headline)
                    Spacer()
                    Button("Cancel", action: resetForm).buttonStyle(.link).keyboardShortcut(.cancelAction)
                }
            }
            HStack(spacing: 8) {
                Picker("", selection: $spent) {
                    Text("Spent").tag(true)
                    Text("Got money").tag(false)
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                if !editingTx {
                    Picker("", selection: $cadence) {
                        ForEach(Cadence.allCases) { Text($0.name).tag($0) }
                    }
                    .labelsHidden()
                    .fixedSize()
                }
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
            HStack(spacing: 6) {
                Menu {
                    ForEach(categories) { c in
                        Button { category = c.id; categoryTouched = true } label: { Label(c.name, systemImage: c.symbol) }
                    }
                    Divider()
                    Button("No category") { category = nil; categoryTouched = true }
                } label: {
                    Label(Categories.find(category)?.name ?? "Category",
                          systemImage: Categories.find(category)?.symbol ?? "tag")
                }
                .menuStyle(.borderlessButton)
                .fixedSize()
                Spacer()
                if cadence != .once && !editingTx {
                    Text(editingRule != nil ? "Payments left" : "Payments").font(.caption).foregroundStyle(.secondary)
                    TextField("No end", text: $times)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 64)
                }
            }
            HStack(spacing: 6) {
                Text(dateCaption).font(.caption).foregroundStyle(.secondary)
                DatePicker("", selection: $day, displayedComponents: .date)
                    .labelsHidden()
                    .datePickerStyle(.field)
                Spacer()
                if saved > 0 {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .symbolEffect(.bounce, value: saved)
                        .transition(.scale.combined(with: .opacity))
                }
                Button(buttonTitle, action: submit)
                    .buttonStyle(.borderedProminent)
                    .keyboardShortcut(.defaultAction)
                    .disabled(saving)
            }
            if isPlanned && !editingTx {
                Toggle("Wait for me to confirm each payment arrived", isOn: $confirm)
                    .toggleStyle(.checkbox)
                    .font(.caption)
                    .onChange(of: confirm) { _, _ in confirmTouched = true }
            }
            if editing != nil {
                HStack(spacing: 8) {
                    Button(role: .destructive, action: deleteEditing) {
                        Text(editingRule == nil ? "Delete" : (editingRule?.once == true ? "Remove" : "Stop repeating"))
                    }
                    if let r = editingRule, r.once != true {
                        Button((r.active ?? true) ? "Pause" : "Resume") { togglePause(r) }
                    }
                }
                .controlSize(.small)
            }
            if let formError {
                Text(formError).font(.caption).foregroundStyle(.red)
            }
        }
        .onChange(of: spent) { _, s in
            if !categories.contains(where: { $0.id == category }) { category = nil }
            if !confirmTouched && editing == nil { confirm = !s }
        }
        .onChange(of: label) { _, l in guessCategory(l) }
    }

    private func editingTitle(_ e: Editing) -> String {
        switch e {
        case .tx(let t): "Editing “\(t.label)”"
        case .rule(let r): r.once == true ? "Editing expected “\(r.label)”" : "Editing repeating “\(r.label)”"
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

    private var dateCaption: String {
        if editingRule != nil { return cadence == .once ? "Expected on" : "Next payment" }
        if cadence == .once { return isFuture ? (spent ? "Planned for" : "Expected on") : "Date" }
        return spent ? "First payment" : "First payday"
    }

    private var buttonTitle: String {
        if editing != nil { return "Save" }
        if cadence != .once { return "Add repeating" }
        return isFuture ? (spent ? "Add planned" : "Add expected") : "Add"
    }

    // MARK: waiting for confirmation

    private var waitingSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("WAITING FOR YOU").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
            ForEach(store.waiting) { u in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Image(systemName: "clock").foregroundStyle(Palette.accent)
                        Text(u.label).fontWeight(.medium).lineLimit(1)
                        Spacer()
                        amountText(u.amount)
                    }
                    HStack(spacing: 6) {
                        Text("Was due \(Fmt.shortDay(u.due_on))").font(.caption).foregroundStyle(.secondary)
                        Spacer()
                        TextField("", text: Binding(
                            get: { settleDrafts[u.id] ?? String(format: "%.2f", abs(u.amount)) },
                            set: { settleDrafts[u.id] = $0 }))
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 72)
                            .monospacedDigit()
                        Button(u.amount > 0 ? "Got it" : "Paid") { settle(u) }
                            .buttonStyle(.borderedProminent)
                        Button("Skip") { skip(u) }
                    }
                    .controlSize(.small)
                }
                .padding(10)
                .background(Palette.surface, in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    // MARK: lists

    private var listSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Picker("", selection: $listTab) {
                ForEach(ListTab.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            Group {
                switch listTab {
                case .recent: recentList
                case .repeating: rulesList
                case .coming: comingList
                }
            }
            .animation(.snappy, value: store.txs.map(\.id))
        }
    }

    private var recentList: some View {
        VStack(spacing: 0) {
            if store.txs.isEmpty { emptyText("Nothing yet") }
            ForEach(Array(store.txs.prefix(7))) { t in
                listRow(id: t.id, symbol: Categories.symbol(t.category, amount: t.amount), title: t.label,
                        note: [Categories.find(t.category)?.name, t.recurring_id != nil ? "Automatic" : nil,
                               Fmt.shortDay(t.occurred_on)].compactMap { $0 }.joined(separator: " · "),
                        amount: t.amount, selected: editing == .tx(t))
                    .onTapGesture { startEdit(.tx(t)) }
                    .contextMenu {
                        Button("Edit") { startEdit(.tx(t)) }
                        Button("Delete", role: .destructive) { Task { try? await store.deleteTx(t.id); say("Poof!") } }
                    }
                    .transition(.asymmetric(insertion: .move(edge: .top).combined(with: .opacity), removal: .opacity))
            }
            hintText("Click an entry to edit it. Right-click to delete.")
        }
    }

    private var rulesList: some View {
        VStack(spacing: 0) {
            if store.rules.isEmpty { emptyText("Nothing repeating yet") }
            ForEach(store.rules) { r in
                let when = r.once == true ? "One time · \(Fmt.shortDay(r.next_on))"
                    : "\(Cadence(rawValue: r.cadence)?.name ?? r.cadence) · next \(Fmt.shortDay(r.next_on))"
                        + (r.remaining.map { $0 == 1 ? " · last one" : " · \($0) left" } ?? "")
                let tag = (r.active ?? true) == false ? " · paused" : r.auto == false ? " · you confirm" : ""
                listRow(id: r.id, symbol: r.once == true ? "clock" : "repeat", title: r.label, note: when + tag,
                        amount: r.amount, selected: editing == .rule(r))
                    .opacity((r.active ?? true) ? 1 : 0.55)
                    .onTapGesture { startEdit(.rule(r)) }
                    .contextMenu {
                        Button("Edit") { startEdit(.rule(r)) }
                        if r.once != true { Button((r.active ?? true) ? "Pause" : "Resume") { togglePause(r) } }
                        Button(r.once == true ? "Remove" : "Stop repeating", role: .destructive) {
                            Task { try? await store.deleteRule(r.id); say("Poof!") }
                        }
                    }
            }
        }
    }

    private var comingList: some View {
        VStack(spacing: 0) {
            if store.comingUp.isEmpty { emptyText("Nothing planned in the next 3 months") }
            ForEach(Array(store.comingUp.prefix(7))) { u in
                listRow(id: u.id, symbol: Categories.symbol(u.category, amount: u.amount), title: u.label,
                        note: Fmt.shortDay(u.due_on), amount: u.amount, selected: false)
            }
        }
    }

    private func listRow(id: String, symbol: String, title: String, note: String, amount: Double, selected: Bool) -> some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 12, weight: .medium))
                .frame(width: 26, height: 26)
                .foregroundStyle(amount > 0 ? Palette.accent : Color.secondary)
                .background((amount > 0 ? Palette.accent : Color.secondary).opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 1) {
                Text(title).lineLimit(1)
                Text(note).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            amountText(amount)
        }
        .font(.callout)
        .padding(.vertical, 5)
        .padding(.horizontal, 6)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(selected ? Palette.accent.opacity(0.14) : hovered == id ? Color.primary.opacity(0.05) : .clear)
        )
        .contentShape(Rectangle())
        .onHover { hovered = $0 ? id : (hovered == id ? nil : hovered) }
    }

    private func emptyText(_ s: String) -> some View {
        Text(s).font(.callout).foregroundStyle(.secondary).padding(.vertical, 6)
    }

    private func hintText(_ s: String) -> some View {
        Text(s).font(.caption).foregroundStyle(.tertiary).frame(maxWidth: .infinity, alignment: .leading).padding(.top, 4)
    }

    private func amountText(_ v: Double) -> some View {
        Text(Fmt.signed(v)).monospacedDigit().foregroundStyle(v > 0 ? Color.green : Color.primary)
    }

    // MARK: pairing

    private func pairingView(_ p: (code: String, expires: Date)) -> some View {
        VStack(spacing: 10) {
            Text("Pair a device").font(.headline)
            Text("On your phone or another computer, open the web app and type this code.")
                .font(.callout).foregroundStyle(.secondary).multilineTextAlignment(.center)
            Text("\(p.code.prefix(3)) \(p.code.suffix(3))")
                .font(.system(size: 44, weight: .bold, design: .rounded))
                .monospacedDigit()
                .textSelection(.enabled)
            TimelineView(.periodic(from: .now, by: 1)) { ctx in
                let left = max(0, Int(p.expires.timeIntervalSince(ctx.date)))
                Text(left > 0 ? "Expires in \(left / 60):\(String(format: "%02d", left % 60))" : "Expired. Make a new code.")
                    .font(.caption).foregroundStyle(.secondary).monospacedDigit()
            }
            Text("orlandoascanio.github.io/pocket").font(.caption).foregroundStyle(.secondary).textSelection(.enabled)
            HStack {
                Button("New code") { startPairing() }
                Button("Done") { withAnimation(.snappy) { pairing = nil } }.buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    // MARK: key + footer

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
                Button("Pair a device") { startPairing() }.disabled(store.key == nil)
                Spacer()
                Button("Quit") { NSApp.terminate(nil) }
            }
            .buttonStyle(.link)
            .foregroundStyle(Palette.accent)
            .font(.callout)
        }
    }

    // MARK: reactions

    private func say(_ text: String) {
        bubbleTask?.cancel()
        withAnimation(.spring(duration: 0.35, bounce: 0.35)) { bubble = text }
        bubbleTask = Task {
            try? await Task.sleep(for: .seconds(1.8))
            guard !Task.isCancelled else { return }
            withAnimation(.easeOut(duration: 0.25)) { bubble = nil }
        }
    }

    private func flip(by degrees: Double, hopHeight: CGFloat) {
        withAnimation(.spring(duration: 0.9, bounce: 0.25)) { spin += degrees }
        withAnimation(.easeOut(duration: 0.22)) { hop = -hopHeight }
        Task {
            try? await Task.sleep(for: .milliseconds(220))
            withAnimation(.spring(duration: 0.45, bounce: 0.5)) { hop = 0 }
        }
    }

    private func react(to c: BalanceChange) {
        if c.diff > 0 { flip(by: 360, hopHeight: 8) } else { flip(by: -360, hopHeight: 14) }
        if c.outOfRed { say("We're out of the red!") }
        else if c.intoRed { say("Uh oh, we're in the red") }
        else { say(Lines.forChange(c.diff, category: c.category)) }
    }

    private func poke() {
        flip(by: 720, hopHeight: 16)
        say(Lines.line("poke"))
    }

    // MARK: actions

    private func guessCategory(_ l: String) {
        guard !categoryTouched, editing == nil else { return }
        let q = l.trimmingCharacters(in: .whitespaces).lowercased()
        guard q.count >= 3 else { return }
        let ids = Set(categories.map(\.id))
        if let hit = store.presets.first(where: { ($0.category.map(ids.contains) ?? false) && $0.label.lowercased().hasPrefix(q) })?.category
            ?? store.txs.first(where: { ($0.category.map(ids.contains) ?? false) && $0.label.lowercased().hasPrefix(q) })?.category {
            category = hit
        }
    }

    private func usePreset(_ p: Preset) {
        if p.amount == nil {
            // Different price every time: fill the form and ask for the amount.
            resetForm()
            spent = p.sign < 0
            category = p.category
            categoryTouched = true
            label = p.label
            focus = .amount
            say("How much?")
            return
        }
        Task {
            do { try await store.use(p) } catch { say("Couldn't add that") }
        }
    }

    private func startEdit(_ e: Editing) {
        formError = nil
        editing = e
        categoryTouched = true
        confirmTouched = true
        switch e {
        case .tx(let t):
            spent = t.amount < 0
            cadence = .once
            amount = String(format: "%.2f", abs(t.amount))
            label = t.label
            category = t.category == "start" ? nil : t.category
            day = Fmt.date(t.occurred_on) ?? Date()
            times = ""
        case .rule(let r):
            spent = r.amount < 0
            cadence = r.once == true ? .once : Cadence(rawValue: r.cadence) ?? .monthly
            amount = String(format: "%.2f", abs(r.amount))
            label = r.label
            category = r.category
            day = Fmt.date(r.next_on) ?? Date()
            times = r.once == true ? "" : r.remaining.map(String.init) ?? ""
            confirm = r.auto == false
        }
        focus = .amount
    }

    private func resetForm() {
        editing = nil
        amount = ""
        label = ""
        times = ""
        spent = true
        cadence = .once
        category = nil
        categoryTouched = false
        confirm = false
        confirmTouched = false
        day = Date()
        formError = nil
    }

    private func deleteEditing() {
        guard let editing else { return }
        Task {
            do {
                switch editing {
                case .tx(let t): try await store.deleteTx(t.id)
                case .rule(let r): try await store.deleteRule(r.id)
                }
                resetForm()
                say("Poof!")
            } catch {
                formError = "Couldn't do that. Check your connection."
            }
        }
    }

    private func togglePause(_ r: Rule) {
        let active = r.active ?? true
        Task {
            do {
                try await store.setActive(r.id, !active)
                say(active ? "Taking a nap" : "Back at it!")
                if editingRule?.id == r.id { resetForm() }
            } catch {
                formError = "Couldn't do that. Check your connection."
            }
        }
    }

    private func settle(_ u: Upcoming) {
        guard let n = Fmt.parseAmount(settleDrafts[u.id] ?? String(format: "%.2f", abs(u.amount))) else { return }
        Task {
            do {
                try await store.settle(u, amount: u.amount < 0 ? -n : n)
                settleDrafts[u.id] = nil
            } catch {
                say("Couldn't save that")
            }
        }
    }

    private func skip(_ u: Upcoming) {
        Task {
            do { try await store.skip(u); say(Lines.line("skip")) } catch { say("Couldn't skip it") }
        }
    }

    private func startPairing() {
        Task {
            do {
                let p = try await store.pairStart()
                withAnimation(.snappy) { pairing = p }
            } catch {
                say("Couldn't make a code")
            }
        }
    }

    private func saveKey() {
        let k = keyDraft
        keyDraft = ""
        Task { await store.setKey(k) }
    }

    private func submit() {
        guard let n = Fmt.parseAmount(amount) else {
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
        let signedAmount = spent ? -n : n
        let wasEditing = editing
        let planned = isPlanned
        saving = true
        formError = nil
        Task {
            do {
                switch wasEditing {
                case .tx(let tx):
                    try await store.updateTx(tx.id, amount: signedAmount, label: l, on: day, category: category)
                case .rule(let r):
                    try await store.updateRule(r.id, amount: signedAmount, label: l, cadence: cadence, next: day,
                                               left: count, category: category, auto: !confirm)
                case nil:
                    try await store.add(amount: signedAmount, label: l, cadence: cadence, on: day, times: count,
                                        category: category, auto: !confirm)
                    if planned { say(Lines.line(spent ? "planned" : "waiting")) }
                }
                resetForm()
                withAnimation(.snappy) { saved += 1 }
                Task {
                    try? await Task.sleep(for: .seconds(1.4))
                    withAnimation(.easeOut) { saved = 0 }
                }
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
            Text(store.menuTitle).monospacedDigit()
        }
        .menuBarExtraStyle(.window)
    }
}
