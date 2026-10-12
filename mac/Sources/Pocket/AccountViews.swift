import AppKit
import PocketCore
import SwiftUI

/// Settings → Sync: connect this Mac to a Pocket account, or see how syncing is going.
struct SyncSection: View {
    @EnvironmentObject var store: Store
    @State private var connecting = false
    @State private var pairing = false
    @State private var confirmDisconnect = false
    @State private var devices: DevicesResponse?
    @State private var removing: Device?
    @State private var error: String?

    var body: some View {
        if store.connected { connected } else { local }
    }

    private var local: some View {
        Section {
            LabeledContent {
                Button("Connect…") { connecting = true }
            } label: {
                Text("Use Pocket on your phone too")
                Text("Your entries sync with the Pocket web app. This Mac keeps a full copy and works offline.")
            }
        } header: {
            Text("Sync")
        }
        .sheet(isPresented: $connecting) { ConnectSheet() }
    }

    @ViewBuilder private var connected: some View {
        Section {
            LabeledContent("Status") { SyncStatusLabel() }
            LabeledContent("Server", value: store.server == .original ? "Pocket" : store.server.host)
            LabeledContent("Phone and web") {
                Link("Open Web App", destination: store.server.webLink(code: nil))
            }
            ForEach(store.outbox) { op in
                LabeledContent {
                    HStack {
                        if op.needsReview { Button("Retry…") { store.retry(op.id) } }
                        Button("Discard") { store.discard(op.id) }
                    }
                } label: {
                    Label {
                        Text(op.label)
                        Text(op.needsReview ? (op.message ?? "Check before retrying.") : "Waiting to sync")
                    } icon: {
                        Image(systemName: op.needsReview ? "exclamationmark.triangle" : "icloud.and.arrow.up")
                            .foregroundStyle(op.needsReview ? Color.orange : Color.secondary)
                    }
                }
            }
        } header: {
            HStack {
                Text("Sync")
                Spacer()
                Button { Task { await store.syncNow() } } label: { Image(systemName: "arrow.clockwise") }
                    .buttonStyle(.borderless).help("Sync now")
            }
        } footer: {
            Text(store.outbox.isEmpty
                 ? "Your account is the main copy; this Mac keeps a full copy in Application Support and works offline."
                 : "Sending what's on this Mac to your account. It keeps going after a lost connection.")
        }
        Section {
            if devices == nil { HStack { ProgressView().controlSize(.small); Text("Loading devices…").foregroundStyle(.secondary) } }
            if devices?.master == true {
                LabeledContent { EmptyView() } label: { Label("Main key", systemImage: "key") }
            }
            ForEach(devices?.devices ?? []) { d in
                LabeledContent {
                    Button("Remove…") { removing = d }
                } label: {
                    Label {
                        Text((d.name ?? "Device") + (d.this ? " (this Mac)" : ""))
                        if let seen = d.last_seen.flatMap(Self.date) { Text("Active \(seen.formatted(.relative(presentation: .named)))") }
                    } icon: {
                        Image(systemName: (d.name ?? "").range(of: "phone|ipad|android", options: [.regularExpression, .caseInsensitive]) != nil ? "iphone" : "laptopcomputer")
                    }
                }
            }
            LabeledContent("Add another device") { Button("Pair…") { pairing = true } }
            LabeledContent("This Mac") { Button("Disconnect…", role: .destructive) { confirmDisconnect = true } }
        } header: {
            Text("Devices")
        } footer: {
            if let error { Text(error).foregroundStyle(Palette.negative) }
            else { Text("A removed device is locked out until you pair it again.") }
        }
        .task { await loadDevices() }
        .sheet(isPresented: $pairing) { PairSheet() }
        .confirmationDialog("Disconnect this Mac?", isPresented: $confirmDisconnect) {
            Button("Disconnect", role: .destructive) { store.disconnect() }
        } message: {
            Text(store.outbox.isEmpty
                 ? "Your entries stay on this Mac as a local copy, but stop syncing with your phone."
                 : "Your entries stay on this Mac, but \(store.outbox.count) change\(store.outbox.count == 1 ? "" : "s") not synced yet will be dropped.")
        }
        .alert("Remove this device?", isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } })) {
            Button("Remove", role: .destructive) {
                guard let d = removing else { return }
                removing = nil
                Task {
                    do { try await store.removeDevice(d); if !d.this { await loadDevices() } }
                    catch { self.error = "Couldn't remove the device. Check your connection." }
                }
            }
            Button("Cancel", role: .cancel) { removing = nil }
        } message: { Text(removing?.this == true ? "This Mac stops syncing and keeps a local copy." : "It will need a new pairing code to reconnect.") }
    }

    private static func date(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: s) ?? ISO8601DateFormatter().date(from: s.replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression))
    }

    private func loadDevices() async {
        do { devices = try await store.devices(); error = nil }
        catch { self.error = "Couldn't load devices. Check your connection." }
    }
}

/// "Synced 3:17 PM", "Offline · 2 waiting", "Syncing…": a dot and a few words.
struct SyncStatusLabel: View {
    @EnvironmentObject var store: Store
    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(text).monospacedDigit()
        }
        .foregroundStyle(.secondary)
        .accessibilityElement(children: .combine)
    }
    private var waiting: Int { store.outbox.count }
    private var color: Color {
        switch store.syncState {
        case .ok: waiting == 0 ? Palette.accent : .orange
        case .syncing: .secondary
        case .offline, .badKey: .orange
        }
    }
    private var text: String {
        switch store.syncState {
        case .badKey: return "Access removed"
        case .syncing: return "Syncing…"
        case .offline: return waiting == 0 ? "Offline" : "Offline · \(waiting) waiting"
        case .ok(let d): return waiting == 0 ? "Synced \(d.formatted(date: .omitted, time: .shortened))" : "\(waiting) waiting to sync"
        }
    }
}

/// Joins an account: a code from a connected device, the Pocket Sync app's access on this Mac,
/// or a brand-new server of your own.
struct ConnectSheet: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss
    @State private var code = ""
    @State private var serverURL = ""
    @State private var serverKey = ""
    @State private var showServer = false
    @State private var busy = false
    @State private var error: String?
    private let syncKey = AccountKeyStore.pocketSyncKey()

    private var chosen: Server? { Server(url: serverURL, apiKey: serverKey) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Connect to Your Pocket").font(.headline).frame(maxWidth: .infinity)
            if syncKey != nil {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Pocket Sync is set up on this Mac", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(Palette.accent).font(.callout.weight(.medium))
                    Text("Use the same account here. Your balance and history come over as they are.")
                        .font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                    Button { run { try await store.connect(key: syncKey!, server: .original) } } label: {
                        Text("Use Pocket Sync's Account").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                }
                .padding(14)
                .background(Palette.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("Join with a pairing code").font(.callout.weight(.semibold))
                HStack {
                    TextField("000 000", text: $code)
                        .textFieldStyle(.roundedBorder).controlSize(.large)
                        .font(.system(size: 20, weight: .semibold, design: .rounded).monospacedDigit())
                        .onChange(of: code) { _, v in code = String(v.filter(\.isNumber).prefix(6)) }
                        .onSubmit(pair)
                    Button("Connect", action: pair).controlSize(.large)
                        .disabled(code.count != 6 || chosen == nil || busy)
                }
                Text("On a device that's already connected, open Settings and choose Pair a new device.")
                    .font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            DisclosureGroup(isExpanded: $showServer) {
                VStack(alignment: .leading, spacing: 8) {
                    TextField("Server address", text: $serverURL, prompt: Text("https://your-project.supabase.co"))
                        .textFieldStyle(.roundedBorder)
                    TextField("Publishable key", text: $serverKey, prompt: Text("sb_publishable_…"))
                        .textFieldStyle(.roundedBorder)
                    HStack(alignment: .firstTextBaseline) {
                        Button("Set Up This Server") { if let s = chosen { run { try await store.setUp(s) } } }
                            .disabled(chosen == nil || busy)
                        Spacer()
                        Link("How to make one", destination: AccountConfig.selfHostGuide).font(.callout)
                    }
                    Text("For a new, empty server: creates your Pocket there and moves everything on this Mac into it. Then pair your phone from Settings.")
                        .font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 8)
            } label: {
                HStack {
                    Text("Server").font(.callout.weight(.semibold))
                    Spacer()
                    Text(chosen.map { $0 == .original ? "Pocket" : $0.host } ?? "Not set").font(.callout).foregroundStyle(.secondary)
                }
            }
            if let error { Text(error).font(.callout).foregroundStyle(Palette.negative).fixedSize(horizontal: false, vertical: true) }
            HStack {
                if busy { ProgressView().controlSize(.small) }
                Spacer()
                Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction)
            }
        }
        .padding(22)
        .frame(width: 420)
        .tint(Palette.accent)
        .disabled(busy)
        .onAppear {
            serverURL = store.server.url.absoluteString
            serverKey = store.server.apiKey
        }
    }

    private func pair() {
        guard code.count == 6, let s = chosen else { return }
        run { try await store.connect(code: code, server: s) }
    }

    private func run(_ action: @escaping () async throws -> Void) {
        busy = true; error = nil
        Task {
            do { try await action(); dismiss() }
            catch { self.error = (error as? APIError)?.message ?? "Couldn't connect. Check your connection." }
            busy = false
        }
    }
}

/// Shows a code another device types in to join the same account.
struct PairSheet: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss
    @State private var pairing: (code: String, expires: Date)?
    @State private var copied = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 12) {
            Text("Pair a Device").font(.headline)
            Text("On your phone or another computer, open this link, or open Pocket and enter the code.")
                .font(.callout).foregroundStyle(.secondary).multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Link(store.server == .original ? "pocketleft.app/app" : "Open Pocket for this server",
                 destination: store.server.webLink(code: pairing?.code)).font(.callout)
            if let p = pairing {
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    let left = max(0, Int(p.expires.timeIntervalSince(ctx.date)))
                    VStack(spacing: 8) {
                        Text("\(p.code.prefix(3)) \(p.code.suffix(3))")
                            .font(.system(size: 44, weight: .bold, design: .rounded)).tracking(1).monospacedDigit()
                            .textSelection(.enabled)
                        Text(left > 0 ? "Enter this code there. Expires in \(left / 60):\(String(format: "%02d", left % 60))" : "Expired. Make a new code.")
                            .font(.caption).foregroundStyle(.secondary).monospacedDigit()
                        Button {
                            NSPasteboard.general.clearContents()
                            copied = NSPasteboard.general.setString(p.code, forType: .string)
                        } label: { Label(copied ? "Copied" : "Copy Code", systemImage: copied ? "checkmark" : "doc.on.doc") }
                            .disabled(left == 0)
                    }
                }
            } else if let error {
                Text(error).font(.callout).foregroundStyle(Palette.negative)
            } else {
                ProgressView().controlSize(.small).frame(height: 80)
            }
            HStack {
                Button("New Code", action: start)
                Spacer()
                Button("Done") { dismiss() }.keyboardShortcut(.defaultAction)
            }
            .padding(.top, 6)
        }
        .padding(24)
        .frame(width: 360)
        .tint(Palette.accent)
        .task { start() }
    }

    private func start() {
        error = nil
        Task {
            do { pairing = try await store.pairStart(); copied = false }
            catch { self.error = "Couldn't make a code. Check your connection." }
        }
    }
}
