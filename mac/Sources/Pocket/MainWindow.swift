import AppKit
import PocketCore
import SwiftUI

struct EditTarget: Identifiable {
    enum Kind { case entry(Entry), rule(Rule) }
    let kind: Kind
    var id: String {
        switch kind {
        case .entry(let e): "e" + e.id.uuidString
        case .rule(let r): "r" + r.id.uuidString
        }
    }
}

struct HistoryFilter: Equatable {
    var category: String
    var month: YearMonth?
}

extension Projection.Runway {
    func text(_ range: Int) -> (lead: String, strong: String) {
        let d = { (day: Day) in day.localDate.formatted(.dateTime.month(.abbreviated).day()) }
        switch self {
        case .backAboveOnce(let label): return ("Back above zero once", "\(label) pays")
        case .backAboveOn(let day): return ("Back above zero on", d(day))
        case .belowForWholeRange: return ("Below zero for the next", rangeName(range))
        case .runsOut(let day): return ("Runs out on", d(day))
        case .lastsPast(let day): return ("Lasts past", d(day))
        }
    }
}

func rangeName(_ days: Int) -> String {
    switch days {
    case ...31: "month"
    case ...92: "3 months"
    case ...183: "6 months"
    default: "year"
    }
}

struct RunwayLine: View {
    var runway: Projection.Runway
    var range = 91
    var body: some View {
        let t = runway.text(range)
        HStack(spacing: 5) {
            Image(systemName: runway.warn ? "chart.line.downtrend.xyaxis" : "chart.line.uptrend.xyaxis")
                .foregroundStyle(.secondary)
            Text(t.lead)
            Text(t.strong).fontWeight(.semibold).foregroundStyle(runway.warn ? Palette.negative : Color.primary)
        }
    }
}

struct MainWindow: View {
    @EnvironmentObject var store: Store
    @State private var section: AppSection = .overview
    @StateObject private var editor = EditorState()
    @State private var editTarget: EditTarget?
    @State private var filter: HistoryFilter?

    var body: some View {
        NavigationSplitView {
            List(AppSection.allCases, selection: Binding(get: { section }, set: { if let s = $0 { section = s } })) { s in
                Label(s.rawValue, systemImage: s.symbol).tag(s)
                    .badge(s == .overview ? store.waiting.count : 0)
            }
            .navigationSplitViewColumnWidth(min: 170, ideal: 190)
        } detail: {
            Group {
                switch section {
                case .overview: OverviewView(editor: editor, filter: $filter, onEdit: { editTarget = $0 })
                case .plan: PlanView(onEdit: { editTarget = $0 })
                case .insights: InsightsView(onShow: { cat, month in
                        filter = HistoryFilter(category: cat, month: month)
                        withAnimation(.snappy) { section = .overview }
                    })
                case .settings: SettingsView()
                }
            }
            .background(Palette.bg)
        }
        .tint(Palette.accent)
        .sheet(item: $editTarget) { EditSheet(target: $0) }
        .onAppear {
            editor.store = store
            NSApp.setActivationPolicy(.regular)
            NSApp.activate(ignoringOtherApps: true)
            handle(store.windowRequest)
        }
        .onDisappear { NSApp.setActivationPolicy(.accessory) }
        .onChange(of: store.windowRequest) { _, r in handle(r) }
    }

    private func handle(_ r: WindowRequest?) {
        guard let r else { return }
        store.windowRequest = nil
        switch r {
        case .section(let s): section = s
        case .editEntry(let id):
            if let e = store.ledger.entries.first(where: { $0.id == id }) { editTarget = EditTarget(kind: .entry(e)) }
        case .editRule(let id):
            if let rule = store.ledger.rules.first(where: { $0.id == id }) { editTarget = EditTarget(kind: .rule(rule)) }
        }
    }
}

struct EditSheet: View {
    let target: EditTarget
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss
    @StateObject private var state = EditorState()

    var body: some View {
        EntryEditor(state: state, onClose: { dismiss() })
            .padding(22)
            .frame(width: 560)
            .background(Palette.bg)
            .onAppear {
                state.store = store
                switch target.kind {
                case .entry(let e): state.load(e)
                case .rule(let r): state.load(r)
                }
            }
            .onChange(of: state.saved) { _, _ in dismiss() }
    }
}

// MARK: - Overview

struct OverviewView: View {
    @EnvironmentObject var store: Store
    @ObservedObject var editor: EditorState
    @Binding var filter: HistoryFilter?
    var onEdit: (EditTarget) -> Void
    @State private var pendingDelete: Entry?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 22) {
                hero
                if !store.ledger.presets.isEmpty { QuickBar(onAsk: { editor.start(from: $0) }) }
                Card { EntryEditor(state: editor).padding(14) }
                if !store.waiting.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionTitle(title: "Waiting for you", meta: "did it arrive?")
                        ForEach(store.waiting) { WaitingCard(occurrence: $0) }
                    }
                }
                history
            }
            .frame(maxWidth: 700)
            .padding(28)
            .frame(maxWidth: .infinity)
        }
        .confirmationDialog("Delete “\(pendingDelete?.label ?? "")”?", isPresented: Binding(
            get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }), presenting: pendingDelete) { e in
            Button("Delete", role: .destructive) { store.deleteEntry(e.id) }
        } message: { e in
            Text("\(store.money.string(e.cents, signed: true)) on \(e.day.localDate.formatted(date: .abbreviated, time: .omitted)). This can't be undone.")
        }
    }

    private var hero: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Money left").foregroundStyle(.secondary)
                Text(store.money.string(store.balance))
                    .font(.display(64, .heavy))
                    .monospacedDigit()
                    .contentTransition(.numericText(value: Double(store.balance)))
                    .foregroundStyle(store.balance < 0 ? Palette.negative : Color.primary)
                    .animation(.snappy(duration: 0.7), value: store.balance)
                Text("This month: \(store.money.string(store.spentThisMonth)) spent")
                    .foregroundStyle(.secondary).monospacedDigit()
                if let r = store.runway { RunwayLine(runway: r) }
            }
            Spacer()
            PocketStage(width: 132)
        }
        .padding(.top, 12)
    }

    private var shownEntries: [Entry] {
        let all = store.ledger.sortedEntries
        guard let f = filter else { return all }
        return all.filter { ($0.category ?? "other") == f.category && (f.month?.contains($0.day) ?? true) }
    }

    private var history: some View {
        let all = store.ledger.sortedEntries
        var after: [UUID: Cents] = [:]
        var run: Cents = 0
        for e in all.reversed() { run += e.cents; after[e.id] = run }
        let groups = Dictionary(grouping: shownEntries, by: \.day).sorted { $0.key > $1.key }

        return VStack(alignment: .leading, spacing: 10) {
            SectionTitle(title: "History")
            if let f = filter {
                HStack(spacing: 6) {
                    Text("\(Categories.name(f.category)) · \(f.month.map { $0.first.localDate.formatted(.dateTime.month(.wide)) } ?? "all time")")
                    Button { withAnimation { filter = nil } } label: { Image(systemName: "xmark") }
                        .buttonStyle(.plain)
                        .help("Show everything")
                }
                .font(.callout.weight(.semibold))
                .padding(.horizontal, 12).padding(.vertical, 5)
                .foregroundStyle(Palette.bg)
                .background(Color.primary, in: Capsule())
            }
            if groups.isEmpty {
                Text(filter == nil ? "Nothing here yet. Add your first entry above." : "Nothing here for that filter.")
                    .foregroundStyle(.secondary).padding(.vertical, 20).frame(maxWidth: .infinity)
            }
            ForEach(groups, id: \.key) { day, entries in
                VStack(alignment: .leading, spacing: 6) {
                    Text(day == store.today ? "Today" : day.localDate.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))
                        .font(.callout.weight(.semibold))
                        .padding(.horizontal, 4)
                    Card {
                        ForEach(entries) { e in
                            let left = after[e.id] ?? 0
                            MoneyRow(symbol: Categories.symbol(e.category, cents: e.cents), title: e.label,
                                     note: [e.category.map(Categories.name), e.ruleID != nil ? "Automatic" : nil]
                                        .compactMap { $0 }.joined(separator: " · "),
                                     cents: e.cents, rightNote: "left \(store.money.string(left))", rightNegative: left < 0)
                                .onTapGesture { onEdit(EditTarget(kind: .entry(e))) }
                                .contextMenu {
                                    Button("Edit…") { onEdit(EditTarget(kind: .entry(e))) }
                                    Button("Delete…", role: .destructive) { pendingDelete = e }
                                }
                                .transition(.asymmetric(insertion: .move(edge: .top).combined(with: .opacity), removal: .opacity))
                        }
                    }
                }
            }
        }
        .animation(.snappy, value: store.ledger.entries.count)
    }
}

/// A payment that was due but hasn't been confirmed: log it (with the real amount) or skip it.
struct WaitingCard: View {
    @EnvironmentObject var store: Store
    let occurrence: Occurrence
    var compact = false
    @State private var amount = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "clock").foregroundStyle(Palette.accent)
                Text(occurrence.label).fontWeight(.medium).lineLimit(1)
                Spacer()
                Text(store.money.string(occurrence.cents, signed: true)).monospacedDigit()
                    .foregroundStyle(occurrence.cents > 0 ? Palette.accent : Color.primary)
            }
            HStack(spacing: 8) {
                Text("Was due \(occurrence.day.localDate.formatted(.dateTime.month(.abbreviated).day()))")
                    .font(.caption).foregroundStyle(.secondary)
                Spacer()
                TextField("", text: $amount)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: compact ? 70 : 90)
                    .monospacedDigit()
                    .help("The real amount, if it was different")
                Button(occurrence.cents > 0 ? "Got it" : "Paid") {
                    let c = Money.parse(amount) ?? abs(occurrence.cents)
                    store.settle(occurrence, cents: occurrence.cents < 0 ? -c : c, on: store.today)
                }
                .buttonStyle(.borderedProminent)
                Button("Skip") { store.skip(occurrence) }
            }
            .controlSize(compact ? .small : .regular)
        }
        .padding(12)
        .background(Palette.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Palette.line))
        .onAppear { amount = Money.edit(occurrence.cents) }
    }
}
