import AppKit
import PocketCore
import SwiftUI

@main
struct PocketApp: App {
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

        Window("Welcome to Pocket", id: "welcome") {
            Onboarding().environmentObject(store)
        }
        .windowResizability(.contentSize)
        .defaultPosition(.center)
    }
}

/// The menubar shows just the balance.
struct MenuLabel: View {
    @EnvironmentObject var store: Store
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Text(store.menuTitle)
            .monospacedDigit()
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
            if step == 0 { first } else { done }
        }
        .padding(36)
        .frame(width: 470)
        .background(Palette.bg)
        .tint(Palette.accent)
        .onAppear { focused = true }
    }

    private var first: some View {
        VStack(spacing: 16) {
            VStack(spacing: 6) {
                Text("Hi! I'm your Pocket").font(.display(28, .heavy))
                Text("I keep an eye on how much money you have left. Everything stays on this Mac. There's no account and nothing is sent anywhere.")
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
                    TextField("0.00", text: $amount)
                        .textFieldStyle(.roundedBorder)
                        .controlSize(.large)
                        .focused($focused)
                        .onSubmit(start)
                    Picker("", selection: $currency) {
                        ForEach(Self.currencies(including: currency), id: \.self) { Text($0).tag($0) }
                    }
                    .labelsHidden()
                    .frame(width: 90)
                }
                Text("You can add bills, subscriptions and paychecks right after.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Toggle("Open Pocket when I log in, so my balance is always in the menubar", isOn: $openAtLogin)
                .toggleStyle(.checkbox)
                .font(.callout)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: start) { Text("Start").frame(maxWidth: .infinity) }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .keyboardShortcut(.defaultAction)
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
        let cents = Money.parse(amount) ?? 0
        store.start(currency: currency, cents: inTheRed ? -cents : cents, openAtLogin: openAtLogin)
        withAnimation(.snappy) { step = 1 }
    }
}
