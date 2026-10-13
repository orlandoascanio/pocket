import AppKit
import PocketCore
import SwiftUI
@preconcurrency import UserNotifications

extension Notification.Name {
    static let pocketReminderOpened = Notification.Name("PocketReminderOpened")
}

final class PocketNotificationDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        UNUserNotificationCenter.current().delegate = self
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let id = response.notification.request.identifier
        if response.actionIdentifier == UNNotificationDefaultActionIdentifier,
           id.hasPrefix("pocket.") || id == PaymentReminders.testIdentifier {
            DispatchQueue.main.async { NotificationCenter.default.post(name: .pocketReminderOpened, object: nil) }
        }
        completionHandler()
    }
}

@main
struct PocketApp: App {
    @NSApplicationDelegateAdaptor(PocketNotificationDelegate.self) private var notificationDelegate
    @StateObject private var store = Store()

    var body: some Scene {
        MenuBarExtra {
            MenuPanel().environmentObject(store)
        } label: {
            MenuLabel().environmentObject(store)
        }
        .menuBarExtraStyle(.window)

        Window("Pocket", id: "main") {
            MainWindow()
                .environmentObject(store)
                .frame(minWidth: 780, minHeight: 560)
        }
        .defaultSize(width: 1000, height: 780)
        .commands {
            CommandGroup(replacing: .appInfo) {
                Button("About Pocket") { AboutPanel.show() }
                Button("Check for Updates…") { UpdateChecker.shared.checkAndReport() }
            }
            QuickAddCommands(store: store)
        }

        Window("Welcome to Pocket", id: "welcome") {
            Onboarding().environmentObject(store)
        }
        .windowResizability(.contentSize)
        .defaultPosition(.center)
    }
}

/// The Quick Add menu: the buttons with ⌘1 to ⌘9 on every page of the window, not only next to the row.
struct QuickAddCommands: Commands {
    @ObservedObject var store: Store

    var body: some Commands {
        CommandMenu("Quick Add") {
            let presets = store.ledger.presets
            if presets.isEmpty {
                Text("No quick-add buttons yet")
            }
            ForEach(Array(presets.enumerated()), id: \.element.id) { i, p in
                let title = p.cents.map { "\(p.label)  \(store.money.string(p.sign * $0, signed: p.sign > 0))" } ?? "\(p.label)…"
                if i < 9 {
                    Button(title) { store.useQuickAdd(p) }
                        .keyboardShortcut(KeyEquivalent(Character(String(i + 1))), modifiers: .command)
                } else {
                    Button(title) { store.useQuickAdd(p) }
                }
            }
            .disabled(store.loadError != nil)
            Divider()
            Button("Edit Quick-Add Buttons…") { store.windowRequest = .section(.settings) }
        }
    }
}

/// The menubar shows just the balance.
struct MenuLabel: View {
    @EnvironmentObject var store: Store
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Text(store.menuTitle)
            .monospacedDigit()
            .onReceive(NotificationCenter.default.publisher(for: .pocketReminderOpened)) { _ in
                store.windowRequest = .waiting
                openWindow(id: "main")
                NSApp.activate(ignoringOtherApps: true)
            }
            .task {
                try? await Task.sleep(for: .milliseconds(400))
                // POCKET_OPEN / POCKET_SECTION (development only) open a window at launch, for screenshots.
                let env = ProcessInfo.processInfo.environment
                if let s = env["POCKET_SECTION"].flatMap(AppSection.init(rawValue:)) { store.windowRequest = .section(s) }
                if let id = env["POCKET_OPEN"] {
                    openWindow(id: id)
                } else if !store.onboarded {
                    openWindow(id: "welcome")
                } else {
                    return
                }
                NSApp.activate(ignoringOtherApps: true)
            }
    }
}

/// First run: meet the pocket, say how much you have, done.
struct Onboarding: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismissWindow) private var dismissWindow
    @Environment(\.openWindow) private var openWindow

    @State private var step = 0
    @State private var currency = Locale.current.currency?.identifier ?? "USD"
    @State private var amount = ""
    @State private var inTheRed = false
    @State private var openAtLogin = true
    @State private var connecting = false
    @State private var amountError: String?
    @FocusState private var focused: Bool

    static func currencies(including current: String) -> [String] {
        let common = ["USD", "EUR", "GBP", "CAD", "AUD", "MXN", "COP", "ARS", "BRL", "CLP", "PEN", "JPY", "CHF", "INR"]
        return common.contains(current) ? common : [current] + common
    }

    private var face: Face {
        if step == 1 { return .joy }
        if amount.isEmpty { return focused ? .happy : .sleep }
        return inTheRed ? .worried : .hope
    }

    var body: some View {
        VStack(spacing: 18) {
            PocketStage(width: 150, fixedFace: face)
                .padding(.top, 12)
                .animation(.easeOut(duration: 0.2), value: face)
            if step == 0 { first; SaveFailureView() } else { done }
        }
        .padding(36)
        .frame(width: 470)
        .background(Palette.bg)
        .tint(Palette.accent)
        .onAppear { focused = true }
        .sheet(isPresented: $connecting) { ConnectSheet() }
        .onChange(of: store.connected) { _, on in if on { withAnimation(.snappy) { step = 1 } } }
    }

    private var first: some View {
        VStack(spacing: 16) {
            VStack(spacing: 6) {
                Text("Hi! I'm your Pocket").font(.display(28, .heavy))
                Text("I keep your recorded balance in the menu bar. Your data stays on this Mac unless you choose to connect an account.")
                    .multilineTextAlignment(.center).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("How much money do you have right now?").font(.headline)
                Picker("", selection: $inTheRed) {
                    Text("I have").tag(false)
                    Text("I'm below zero by").tag(true)
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                HStack {
                    TextField("Starting balance", text: $amount, prompt: Text(store.money.placeholder))
                        .textFieldStyle(.roundedBorder)
                        .controlSize(.large)
                        .focused($focused)
                        .onSubmit(start)
                        .onChange(of: amount) { _, _ in amountError = nil }
                    Picker("Currency", selection: $currency) {
                        ForEach(Self.currencies(including: currency), id: \.self) { Text($0).tag($0) }
                    }
                    .labelsHidden()
                    .frame(width: 90)
                }
                Text("You can add bills, subscriptions and paychecks right after.")
                    .font(.caption).foregroundStyle(.secondary)
                Text("Leave the amount empty to start at zero.").font(.caption).foregroundStyle(.secondary)
                if let amountError { Text(amountError).font(.caption).foregroundStyle(Palette.negative) }
            }
            Toggle("Open Pocket when I log in, so my balance is always in the menubar", isOn: $openAtLogin)
                .toggleStyle(.checkbox)
                .font(.callout)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: start) { Text("Start").frame(maxWidth: .infinity) }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .keyboardShortcut(.defaultAction)
            Button(AccountKeyStore.pocketSyncKey() != nil ? "Use your Pocket Sync account instead" : "Already use Pocket on your phone? Connect") {
                connecting = true
            }
            .buttonStyle(.link).font(.callout)
        }
    }

    private var done: some View {
        VStack(spacing: 14) {
            Text("All set!").font(.display(28, .heavy))
            Text("Your balance now lives in the menubar at the top of your screen. Click it any time to add something.")
                .multilineTextAlignment(.center).foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            HStack {
                Button("Done") { dismissWindow(id: "welcome") }.controlSize(.large)
                Button("Open Pocket") {
                    dismissWindow(id: "welcome")
                    openWindow(id: "main")
                    NSApp.activate(ignoringOtherApps: true)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .keyboardShortcut(.defaultAction)
            }
        }
    }

    private func start() {
        guard let cents = amount.trimmed.isEmpty ? 0 : Money.parse(amount, allowZero: true) else {
            amountError = "Enter a valid amount, like 125.50, or leave it empty for zero."
            focused = true
            return
        }
        guard store.start(currency: currency, cents: inTheRed ? -cents : cents, openAtLogin: openAtLogin) else { return }
        withAnimation(.snappy) { step = 1 }
    }
}
