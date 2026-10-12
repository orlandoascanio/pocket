import AppKit
import PocketCore
import ServiceManagement
import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @EnvironmentObject var store: Store
    @State private var launchAtLogin = SMAppService.mainApp.status == .enabled
    @State private var confirmErase = false
    @State private var pendingImport: URL?
    @State private var message: String?

    private static let currencies: [String] = {
        let common = ["USD", "EUR", "GBP", "CAD", "AUD", "MXN", "COP", "ARS", "BRL", "CLP", "PEN", "JPY", "KRW", "CHF", "INR"]
        let rest = Locale.commonISOCurrencyCodes.filter { !common.contains($0) }.sorted()
        return common + rest
    }()

    var body: some View {
        Form {
            SyncSection()

            Section("Money") {
                Picker("Currency", selection: Binding(get: { store.ledger.currency }, set: { store.setCurrency($0) })) {
                    ForEach(Self.currencies, id: \.self) { code in
                        Text("\(code) · \(Locale.current.localizedString(forCurrencyCode: code) ?? code)").tag(code)
                    }
                }
            }

            Section {
                ForEach(store.ledger.presets) { p in PresetRow(preset: p) }
                    .onMove(perform: store.connected ? nil : { store.movePresets(from: $0, to: $1) })
                HStack {
                    Spacer()
                    Menu("Add Button") {
                        Button("Spending") { store.savePreset(Preset(label: "New button", cents: nil, sign: -1, category: nil)) }
                        Button("Money In") { store.savePreset(Preset(label: "Got paid", cents: nil, sign: 1, category: "pay")) }
                    }
                    .fixedSize()
                }
            } header: {
                Text("Quick-add buttons")
            } footer: {
                Text("⌘1 to ⌘9 use the first nine. Leave the amount empty for things that cost something different each time."
                     + (store.connected ? "" : " Drag to reorder."))
            }

            Section("General") {
                Toggle("Remind me when a payment I'm waiting for is due", isOn: $store.reminders)
                Toggle("Open at login", isOn: $launchAtLogin)
                    .onChange(of: launchAtLogin) { _, on in
                        do {
                            if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
                        } catch {
                            launchAtLogin = SMAppService.mainApp.status == .enabled
                        }
                    }
            }

            Section {
                LabeledContent("Backup") {
                    HStack {
                        Button("Export…", action: export)
                        if !store.connected { Button("Import…", action: chooseImport) }
                    }
                }
                LabeledContent("Data file") {
                    Button("Show in Finder") { NSWorkspace.shared.activateFileViewerSelecting([store.fileURL]) }
                }
                if !store.connected {
                    LabeledContent("Start over") {
                        Button("Erase Everything…", role: .destructive) { confirmErase = true }
                    }
                }
                if let message { Text(message).foregroundStyle(.secondary) }
                SaveFailureView()
            } header: {
                Text("Your data")
            } footer: {
                Text(store.connected
                     ? "Synced with your account. This Mac keeps its own copy, with a daily backup for the last 7 days."
                     : "Everything stays on this Mac in one file, with a daily backup for the last 7 days. Nothing is sent anywhere.")
            }

            Section("About") {
                LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "dev")
            }
        }
        .formStyle(.grouped)
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
        .confirmationDialog("Erase everything?", isPresented: $confirmErase) {
            Button("Erase everything", role: .destructive) {
                store.eraseEverything()
                message = store.saveError == nil ? "Everything was erased." : "Couldn't erase your data. Try again."
            }
        } message: {
            Text("All entries, repeating payments and buttons are deleted from this Mac. Export first if you want a copy.")
        }
        .confirmationDialog("Replace your data with this file?", isPresented: Binding(
            get: { pendingImport != nil }, set: { if !$0 { pendingImport = nil } }), presenting: pendingImport) { url in
            Button("Replace") { runImport(url) }
        } message: { _ in
            Text("What's in Pocket now is replaced by the file. Export first if you want to keep it.")
        }
    }

    private func export() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        panel.nameFieldStringValue = "Pocket \(Day.today.iso).json"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            try store.export(to: url)
            message = "Exported to \(url.lastPathComponent)."
        } catch {
            message = "Couldn't export: \(error.localizedDescription)"
        }
    }

    private func chooseImport() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json]
        panel.allowsMultipleSelection = false
        guard panel.runModal() == .OK, let url = panel.url else { return }
        pendingImport = url
    }

    private func runImport(_ url: URL) {
        do {
            try store.importFile(url)
            message = "Imported \(url.lastPathComponent)."
        } catch {
            message = "That file isn't a Pocket export, so nothing changed."
        }
    }
}

struct PresetRow: View {
    @EnvironmentObject var store: Store
    let preset: Preset
    @State private var label = ""
    @State private var amount = ""

    var body: some View {
        HStack(spacing: 10) {
            CategoryIcon(category: preset.category, cents: preset.sign, size: 24)
            TextField("", text: $label, prompt: Text("Name"))
                .textFieldStyle(.roundedBorder)
                .onSubmit(save)
            TextField("", text: $amount, prompt: Text("Ask each time"))
                .textFieldStyle(.roundedBorder)
                .frame(width: 110)
                .monospacedDigit()
                .onSubmit(save)
            Picker("", selection: Binding(get: { preset.category ?? "" }, set: { c in
                var p = preset; p.category = c.isEmpty ? nil : c; store.savePreset(p)
            })) {
                Text("No category").tag("")
                ForEach(preset.sign > 0 ? Categories.income : Categories.spending) { Text($0.name).tag($0.id) }
            }
            .labelsHidden()
            .frame(width: 140)
            Button(role: .destructive) { store.deletePreset(preset.id) } label: { Image(systemName: "trash") }
                .buttonStyle(.borderless)
                .help("Delete this button")
        }
        .labelsHidden()
        .onAppear {
            label = preset.label
            amount = preset.cents.map(Money.edit) ?? ""
        }
        .onChange(of: label) { _, _ in save() }
        .onChange(of: amount) { _, _ in save() }
    }

    private func save() {
        let l = label.trimmed
        guard !l.isEmpty else { return }
        let c = amount.trimmed.isEmpty ? nil : Money.parse(amount)
        guard l != preset.label || c != preset.cents else { return }
        var p = preset
        p.label = l
        p.cents = c
        store.savePreset(p)
    }
}
