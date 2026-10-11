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
    private static let day: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()
    static func money(_ v: Double) -> String { currency.string(from: NSNumber(value: v)) ?? "\(v)" }
    static func today() -> String { day.string(from: Date()) }
}

struct Tx: Decodable, Identifiable {
    let id: String
    let amount: Double
    let label: String
    let occurred_on: String
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
            let data = try await rpc("pocket_list")
            txs = try JSONDecoder().decode([Tx].self, from: data)
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

    func add(amount: Double, label: String, spent: Bool) async throws {
        _ = try await rpc("pocket_add", [
            "p_amount": spent ? -amount : amount,
            "p_label": label,
            "p_on": Fmt.today(),
        ])
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
    @State private var amount = ""
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
                recent
            }
            Divider()
            footer
        }
        .padding(16)
        .frame(width: 320)
        .onAppear {
            launchAtLogin = SMAppService.mainApp.status == .enabled
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
            Picker("", selection: $spent) {
                Text("Spent").tag(true)
                Text("Got money").tag(false)
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            HStack(spacing: 6) {
                TextField("0.00", text: $amount)
                    .frame(width: 72)
                    .focused($focus, equals: .amount)
                    .onSubmit { focus = .label }
                TextField("What was it?", text: $label)
                    .focused($focus, equals: .label)
                    .onSubmit(submit)
                Button("Add", action: submit)
                    .keyboardShortcut(.defaultAction)
                    .disabled(saving)
            }
            .textFieldStyle(.roundedBorder)
            if let formError {
                Text(formError).font(.caption).foregroundStyle(.red)
            }
        }
    }

    private var recent: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("RECENT").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
            if store.txs.isEmpty {
                Text("Nothing yet").font(.callout).foregroundStyle(.secondary)
            }
            ForEach(store.txs.prefix(6)) { t in
                HStack {
                    Text(t.label).lineLimit(1)
                    Spacer()
                    Text((t.amount > 0 ? "+" : "") + Fmt.money(t.amount))
                        .monospacedDigit()
                        .foregroundStyle(t.amount > 0 ? Color.green : Color.primary)
                }
                .font(.callout)
            }
            Text("Edit or delete entries in the web app.")
                .font(.caption).foregroundStyle(.tertiary)
        }
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
        saving = true
        formError = nil
        Task {
            do {
                try await store.add(amount: (n * 100).rounded() / 100, label: l, spent: spent)
                amount = ""
                label = ""
                spent = true
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
