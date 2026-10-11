import AppKit
import PocketCore
import SwiftUI

/// What opens from the menubar: a glance, a quick add, and what's waiting.
struct MenuPanel: View {
    @EnvironmentObject var store: Store
    @Environment(\.openWindow) private var openWindow
    @StateObject private var quick = EditorState()
    @FocusState private var focus: Field?
    enum Field { case amount, label }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !store.onboarded {
                setup
            } else {
                header
                if !store.ledger.presets.isEmpty { QuickBar(onAsk: { quick.start(from: $0) }) }
                quickAdd
                if !store.waiting.isEmpty {
                    ForEach(store.waiting) { WaitingCard(occurrence: $0, compact: true) }
                }
                recent
            }
            Divider()
            footer
        }
        .padding(16)
        .frame(width: 360)
        .background(Palette.bg)
        .tint(Palette.accent)
        .onAppear {
            quick.store = store
            store.tick()
        }
        .onChange(of: quick.focusAmount) { _, _ in focus = .amount }
    }

    private var setup: some View {
        VStack(spacing: 10) {
            PocketStage(width: 96, fixedFace: .sleep)
            Text("Pocket isn't set up yet").font(.headline)
            Button("Set up Pocket") { open("welcome") }.buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity)
    }

    private var header: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Money left").foregroundStyle(.secondary)
                Text(store.money.string(store.balance))
                    .font(.display(34, .heavy))
                    .monospacedDigit()
                    .contentTransition(.numericText(value: Double(store.balance)))
                    .foregroundStyle(store.balance < 0 ? Palette.negative : Color.primary)
                    .animation(.snappy(duration: 0.6), value: store.balance)
                    .lineLimit(1).minimumScaleFactor(0.6)
                Text("This month: \(store.money.string(store.spentThisMonth)) spent")
                    .font(.caption).foregroundStyle(.secondary).monospacedDigit()
                if let r = store.runway { RunwayLine(runway: r).font(.callout) }
            }
            Spacer()
            PocketStage(width: 86)
        }
    }

    private var quickAdd: some View {
        VStack(alignment: .leading, spacing: 8) {
            Picker("Type", selection: $quick.spent) {
                Text("Spent").tag(true)
                Text("Got money").tag(false)
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            HStack(spacing: 6) {
                TextField("0.00", text: $quick.amount)
                    .frame(width: 78)
                    .focused($focus, equals: .amount)
                    .onSubmit { focus = .label }
                TextField(quick.spent ? "What was it?" : "Where's it from?", text: $quick.label)
                    .focused($focus, equals: .label)
                    .onSubmit { quick.save() }
                Button("Add") { quick.save() }
                    .buttonStyle(.borderedProminent)
                    .keyboardShortcut(.defaultAction)
            }
            .textFieldStyle(.roundedBorder)
            HStack(spacing: 6) {
                if let c = quick.category {
                    Label(Categories.name(c), systemImage: Categories.symbol(c, cents: quick.spent ? -1 : 1))
                        .font(.caption).foregroundStyle(.secondary)
                }
                if let e = quick.error { Text(e).font(.caption).foregroundStyle(Palette.negative) }
                Spacer()
                if quick.saved > 0 {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(Palette.accent)
                        .symbolEffect(.bounce, value: quick.saved)
                }
                Button("More options…") { open("main") }
                    .buttonStyle(.link)
                    .font(.caption)
            }
        }
    }

    private var recent: some View {
        VStack(alignment: .leading, spacing: 4) {
            SectionTitle(title: "Recent")
            if store.ledger.entries.isEmpty {
                Text("Nothing yet").font(.callout).foregroundStyle(.secondary).padding(.vertical, 6)
            }
            ForEach(Array(store.ledger.sortedEntries.prefix(5))) { e in
                MoneyRow(symbol: Categories.symbol(e.category, cents: e.cents), title: e.label,
                         note: [e.category.map(Categories.name), e.day == store.today ? "Today"
                                : e.day.localDate.formatted(.dateTime.month(.abbreviated).day())]
                            .compactMap { $0 }.joined(separator: " · "),
                         cents: e.cents)
                    .onTapGesture {
                        store.windowRequest = .editEntry(e.id)
                        open("main")
                    }
                    .help("Click to edit")
                    .transition(.asymmetric(insertion: .move(edge: .top).combined(with: .opacity), removal: .opacity))
            }
        }
        .animation(.snappy, value: store.ledger.entries.count)
    }

    private var footer: some View {
        HStack(spacing: 14) {
            Button("Open Pocket") { open("main") }.keyboardShortcut("o")
            Button("Settings") {
                store.windowRequest = .section(.settings)
                open("main")
            }
            .keyboardShortcut(",")
            Spacer()
            Button("Quit") { NSApp.terminate(nil) }.keyboardShortcut("q")
        }
        .buttonStyle(.link)
        .foregroundStyle(Palette.accent)
        .font(.callout)
    }

    private func open(_ id: String) {
        openWindow(id: id)
        NSApp.activate(ignoringOtherApps: true)
    }
}
