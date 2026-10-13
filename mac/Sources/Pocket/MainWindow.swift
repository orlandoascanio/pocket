import AppKit
import PocketCore
import SwiftUI

struct EditTarget: Identifiable {
    /// An existing entry or plan, or a new entry (optionally carrying what was typed in the menu).
    enum Kind { case entry(Entry), rule(Rule), new(EntryDraft?) }
    let kind: Kind
    let id = UUID()
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
    @State private var waitingExpanded = false
    @State private var scrollTarget: String?
    @State private var hoveredSection: AppSection?
    @FocusState private var focusedSection: AppSection?
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        NavigationSplitView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(spacing: 4) {
                    ForEach([AppSection.overview, .plan, .insights]) { s in
                        sidebarRow(s)
                    }
                }
                sidebarRow(.settings)
            }
            .padding(12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(Palette.bg)
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Sidebar")
            .focusSection()
            .onMoveCommand { direction in
                let step: Int
                switch direction {
                case .up: step = -1
                case .down: step = 1
                default: return
                }
                let sections = AppSection.allCases
                guard let current = sections.firstIndex(of: focusedSection ?? section),
                      sections.indices.contains(current + step) else { return }
                section = sections[current + step]
                focusedSection = section
            }
            .navigationSplitViewColumnWidth(min: 180, ideal: 200)
        } detail: {
            Group {
                if store.loadError != nil && section != .settings {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Your balance is unavailable").font(.title2.weight(.semibold))
                        SaveFailureView()
                        Button("Open Settings to Restore a Backup") { section = .settings }
                    }
                    .padding(32)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                } else {
                switch section {
                case .overview: OverviewView(editor: editor, filter: $filter, waitingExpanded: $waitingExpanded, scrollTarget: $scrollTarget, onEdit: { editTarget = $0 })
                case .plan: PlanView(onEdit: { editTarget = $0 })
                case .insights: InsightsView(onShow: { cat, month in
                        filter = HistoryFilter(category: cat, month: month)
                        withAnimation(reduceMotion ? nil : .snappy) { section = .overview }
                    })
                case .settings: SettingsView()
                }
                }
            }
            .background(Palette.bg)
            .tint(Palette.accent)
            .navigationTitle(section.title)
        }
        .tint(Palette.accent)
        .toolbarBackground(Palette.bg, for: .windowToolbar)
        .toolbarBackground(.visible, for: .windowToolbar)
        .toolbar {
            Button { editTarget = EditTarget(kind: .new(nil)) } label: { Label("New Entry", systemImage: "plus") }
                .keyboardShortcut("n", modifiers: .command)
                .help("New entry with date, category and repeat · ⌘N")
                .disabled(store.loadError != nil)
        }
        .sheet(item: $editTarget) { EditSheet(target: $0) }
        .onAppear {
            editor.store = store
            NSApp.setActivationPolicy(.regular)
            NSApp.activate(ignoringOtherApps: true)
            handle(store.windowRequest)
        }
        .onDisappear { NSApp.setActivationPolicy(.accessory) }
        .onChange(of: store.windowRequest) { _, r in handle(r) }
        // Focus entering the sidebar lands on the selected page, as in a native sidebar, and navigation
        // from the menu, a link or Categories moves it along with the selection.
        .onChange(of: focusedSection) { old, new in
            if old == nil, let new, new != section { focusedSection = section }
        }
        .onChange(of: section) { _, s in if focusedSection != nil { focusedSection = s } }
    }

    private func sidebarRow(_ item: AppSection) -> some View {
        let selected = section == item
        let foreground = selected ? (colorScheme == .dark ? Color.black : Color.white)
                                  : (colorScheme == .dark ? Color.white : Color.black)
        return Button {
            section = item
            focusedSection = item
        } label: {
            HStack(spacing: 10) {
                Image(systemName: item.symbol).font(.system(size: 15, weight: .medium)).frame(width: 20)
                    .symbolRenderingMode(.monochrome).foregroundStyle(foreground)
                Text(item.title).font(.system(size: 14, weight: selected ? .semibold : .regular)).lineLimit(1)
                    .foregroundStyle(foreground)
                Spacer(minLength: 4)
                if item == .overview && !store.waiting.isEmpty {
                    Text("\(store.waiting.count)")
                        .font(.caption.weight(.semibold)).monospacedDigit()
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(foreground.opacity(selected ? 0.16 : 0.08), in: Capsule())
                }
            }
            .padding(.horizontal, 10).padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .foregroundStyle(foreground)
            .background(RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(selected ? Palette.accent : hoveredSection == item ? Color.primary.opacity(0.05) : .clear))
            .contentShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .focusable()
        .focusEffectDisabled()
        .focused($focusedSection, equals: item)
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
            .strokeBorder(Palette.accent, lineWidth: focusedSection == item ? 2 : 0)
            .padding(-3))
        .onHover { hoveredSection = $0 ? item : nil }
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func handle(_ r: WindowRequest?) {
        guard let r else { return }
        store.windowRequest = nil
        switch r {
        case .section(let s): section = s
        case .newEntry(let draft):
            editTarget = EditTarget(kind: .new(draft))
        case .firstEntry:
            section = .overview
            filter = nil
            scrollTarget = "entry"
            DispatchQueue.main.async {
                editor.reset()
                editor.focusAmount += 1
            }
        case .quickAdd(let preset):
            section = .overview
            scrollTarget = "entry"
            // After the switch, so the Overview's amount field exists to take focus.
            DispatchQueue.main.async { editor.start(from: preset) }
        case .waiting:
            section = .overview
            waitingExpanded = true
            scrollTarget = "waiting"
        case .history:
            section = .overview
            filter = nil
            scrollTarget = "history"
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
        VStack(alignment: .leading, spacing: 0) {
            SaveFailureView().padding(.horizontal, 20).padding(.top, 16)
            EntryEditor(state: state, onClose: { dismiss() })
        }
            .frame(width: 440)
            .fixedSize(horizontal: false, vertical: true)
            .tint(Palette.accent)
            .onAppear {
                state.store = store
                switch target.kind {
                case .entry(let e): state.load(e)
                case .rule(let r): state.load(r)
                case .new(let draft?): state.load(draft)
                case .new(nil): state.showDetails = true; state.focusAmount += 1
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
    @Binding var waitingExpanded: Bool
    @Binding var scrollTarget: String?
    var onEdit: (EditTarget) -> Void
    @State private var pendingDelete: Entry?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 18) {
                    hero
                    if store.saveError != nil { SaveFailureView() }
                    VStack(alignment: .leading, spacing: 10) {
                        if !store.hasRecordedEntries {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Keep your balance current").font(.headline)
                                Text("Add an expense or money you received. Your balance updates when you save.")
                                    .font(.callout).foregroundStyle(.secondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        if !store.ledger.presets.isEmpty { QuickBar(onAsk: { editor.start(from: $0) }) }
                        Composer(state: editor, amountSize: 30, showSaveTitle: !store.hasRecordedEntries, onMore: {
                            let draft = editor.draft
                            editor.reset()
                            onEdit(EditTarget(kind: .new(draft)))
                        })
                        if let error = editor.error {
                            Text(error).font(.callout).foregroundStyle(Palette.negative).padding(.horizontal, 4)
                        }
                        if store.receipt != nil { EntryReceiptView { store.windowRequest = $0 }.padding(.horizontal, 4) }
                    }
                    .frame(maxWidth: 520, alignment: .leading)
                    .id("entry")
                    if !store.waiting.isEmpty { waiting.id("waiting") }
                    history.id("history")
                }
                .frame(maxWidth: 700)
                .padding(.horizontal, 32).padding(.vertical, 24)
                .frame(maxWidth: .infinity)
            }
            .onChange(of: scrollTarget) { _, target in
                guard let target else { return }
                withAnimation(reduceMotion ? nil : .easeOut(duration: 0.18)) { proxy.scrollTo(target, anchor: .top) }
                scrollTarget = nil
            }
            .onAppear {
                if let target = scrollTarget { proxy.scrollTo(target, anchor: .top); scrollTarget = nil }
            }
        }
        .confirmationDialog("Delete “\(pendingDelete?.label ?? "")”?", isPresented: Binding(
            get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }), presenting: pendingDelete) { e in
            Button("Delete", role: .destructive) { store.deleteEntry(e.id) }
        } message: { e in
            Text("\(store.money.string(e.cents, signed: true)) on \(e.day.localDate.formatted(date: .abbreviated, time: .omitted)). This can't be undone.")
        }
    }

    private var hero: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Money left").font(.title3).foregroundStyle(.secondary)
                Text(store.loadError == nil ? store.money.string(store.balance) : "—")
                    .font(.display(60, .bold)).tracking(-1.2)
                    .monospacedDigit()
                    .lineLimit(1).minimumScaleFactor(0.45)
                    .accessibilityLabel("Money left")
                    .accessibilityValue(store.loadError == nil ? store.money.string(store.balance) : "Unavailable until your saved data can be opened")
                    .contentTransition(.numericText(value: Double(store.balance)))
                    .foregroundStyle(store.balance < 0 ? Palette.negative : Color.primary)
                    .animation(reduceMotion ? nil : .spring(duration: 0.4, bounce: 0), value: store.balance)
                if store.loadError == nil {
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 14) { balanceContext }
                        VStack(alignment: .leading, spacing: 6) { balanceContext }
                    }
                    .padding(.top, 2)
                }
            }
            .layoutPriority(1)
            Spacer(minLength: 12)
            PocketStage(width: 96)
        }
        .padding(.top, 4)
    }

    @ViewBuilder
    private var balanceContext: some View {
        Text("\(store.money.string(store.spentThisMonth)) spent this month")
            .foregroundStyle(.secondary).monospacedDigit().fixedSize()
        if let runway = store.runway {
            Button { store.windowRequest = .section(.plan) } label: {
                HStack(spacing: 4) {
                    RunwayLine(runway: runway, range: store.range)
                    Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("Open Plan to see the forecast")
        }
    }

    /// Money that was due and needs a "Got it" or a "Skip". A long list shows the oldest few first.
    private var waiting: some View {
        let all = store.waiting
        let shown = waitingExpanded ? all : Array(all.prefix(3))
        return VStack(alignment: .leading, spacing: 8) {
            SectionTitle(title: "Waiting for you", meta: all.count == 1 ? "Did it arrive?" : "\(all.count) payments")
            ForEach(shown) { WaitingCard(occurrence: $0) }
            if all.count > 3 {
                Button(waitingExpanded ? "Show less" : "Show all \(all.count)") {
                    withAnimation(reduceMotion ? nil : .snappy) { waitingExpanded.toggle() }
                }
                .buttonStyle(.plain).foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 4)
            }
        }
        .padding(.top, 6)
    }

    private var shownEntries: [Entry] {
        let all = store.ledger.sortedEntries
        guard let f = filter else { return all }
        return all.filter { Categories.key($0.category, cents: $0.cents) == f.category && (f.month?.contains($0.day) ?? true) }
    }

    private var history: some View {
        let all = store.ledger.sortedEntries
        var after: [UUID: Cents] = [:]
        var run: Cents = 0
        for e in all.reversed() { run += e.cents; after[e.id] = run }
        let groups = Dictionary(grouping: shownEntries, by: \.day).sorted { $0.key > $1.key }

        return VStack(alignment: .leading, spacing: 10) {
            SectionTitle(title: "History").padding(.top, 6)
            if let f = filter {
                HStack(spacing: 6) {
                    Text("\(Categories.name(f.category)) · \(f.month.map { $0.first.localDate.formatted(.dateTime.month(.wide)) } ?? "all time")")
                    Button { withAnimation { filter = nil } } label: { Image(systemName: "xmark") }
                        .buttonStyle(.plain)
                        .help("Show everything").accessibilityLabel("Clear history filter")
                }
                .font(.callout.weight(.semibold))
                .accessibilityLabel("Active history filter")
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
                    HStack(alignment: .firstTextBaseline) {
                        Text(day == store.today ? "Today" : day == store.today.adding(days: -1) ? "Yesterday"
                             : day.localDate.formatted(.dateTime.weekday(.wide).month(.abbreviated).day()))
                            .font(.callout.weight(.semibold)).foregroundStyle(.secondary)
                        Spacer()
                        let net = entries.reduce(0) { $0 + $1.cents }
                        Text(store.money.string(net, signed: true))
                            .font(.callout).monospacedDigit()
                            .foregroundStyle(net > 0 ? Palette.accent : Color.secondary)
                    }
                    .padding(.horizontal, 6)
                    Card {
                        ForEach(entries) { e in
                            let left = after[e.id] ?? 0
                            Button { onEdit(EditTarget(kind: .entry(e))) } label: {
                            MoneyRow(category: e.category, title: e.label,
                                     note: [e.category.map(Categories.name), e.ruleID != nil ? "Scheduled payment" : nil]
                                        .compactMap { $0 }.joined(separator: " · "),
                                     cents: e.cents, rightNote: "left \(store.money.string(left))", rightNegative: left < 0)
                            }
                                .buttonStyle(.plain)
                                .help("Edit \(e.label)")
                                .accessibilityHint("Open to edit this entry")
                                .contextMenu {
                                    Button("Edit…") { onEdit(EditTarget(kind: .entry(e))) }
                                    if store.canSaveAsPreset(e) {
                                        Button("Save as Quick-Add Button") { store.saveAsPreset(e.id) }
                                    }
                                    Divider()
                                    Button("Delete…", role: .destructive) { pendingDelete = e }
                                }
                                .transition(.asymmetric(insertion: .move(edge: .top).combined(with: .opacity), removal: .opacity))
                        }
                    }
                }
            }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.18), value: store.ledger.entries.count)
    }
}

/// A payment that was due but hasn't been confirmed. "Got it" (or "Paid") asks what actually
/// happened, prefilled with what was expected; "Skip" drops this one.
struct WaitingCard: View {
    @EnvironmentObject var store: Store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let occurrence: Occurrence
    var compact = false
    @State private var confirming = false
    @State private var amount = ""
    @State private var date = Date()
    @State private var error: String?
    @FocusState private var amountFocused: Bool

    init(occurrence: Occurrence, compact: Bool = false, initiallyExpanded: Bool = false, initialError: String? = nil) {
        self.occurrence = occurrence
        self.compact = compact
        _confirming = State(initialValue: initiallyExpanded)
        _error = State(initialValue: initialError)
    }

    private var income: Bool { occurrence.cents > 0 }
    private var confirmTitle: String { income ? "Got it" : "Paid" }

    private var due: String {
        let d = occurrence.day.localDate.formatted(.dateTime.month(.abbreviated).day())
        if occurrence.day == store.today { return "Due today" }
        return "Was due \(d)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                CategoryIcon(category: occurrence.category, cents: occurrence.cents, size: 32,
                             symbol: occurrence.category == nil ? "clock" : nil)
                VStack(alignment: .leading, spacing: 2) {
                    Text(occurrence.label).fontWeight(.medium).lineLimit(2)
                    Text(due).font(.caption).foregroundStyle(.secondary)
                }
                .layoutPriority(1)
                Spacer(minLength: 8)
                Text(store.money.string(occurrence.cents, signed: true))
                    .fontWeight(.medium).monospacedDigit().lineLimit(1).minimumScaleFactor(0.65)
                    .foregroundStyle(income ? Palette.accent : Color.primary)
                if !confirming {
                    Button("Skip", action: skip)
                        .help("Skip this payment. It won't count.")
                        .accessibilityLabel("Skip \(occurrence.label)")
                    Button(confirmTitle) { withAnimation(reduceMotion ? nil : .easeOut(duration: 0.18)) { confirming = true } }
                        .buttonStyle(.borderedProminent)
                        .help(income ? "Log it with the amount and date it actually arrived" : "Log it with the amount and date you actually paid")
                        .accessibilityLabel("\(confirmTitle): \(occurrence.label)")
                }
            }
            if confirming {
                HStack(spacing: 8) {
                    Text(income ? "Arrived" : "Paid").foregroundStyle(.secondary)
                    TextField("Amount", text: $amount, prompt: Text(store.money.placeholder))
                        .textFieldStyle(.roundedBorder).frame(width: 110).monospacedDigit()
                        .focused($amountFocused)
                        .accessibilityLabel(income ? "Amount that arrived" : "Amount paid")
                        .onSubmit(confirm)
                    Text("on").foregroundStyle(.secondary)
                    DatePicker("Date", selection: $date, in: ...Date(), displayedComponents: .date)
                        .labelsHidden().accessibilityLabel(income ? "Date it arrived" : "Date paid")
                    Spacer(minLength: 4)
                    Button("Cancel") {
                        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.18)) { confirming = false }
                        error = nil
                    }
                    Button("Log It", action: confirm).buttonStyle(.borderedProminent)
                }
                .controlSize(.regular)
                .transition(.opacity)
                .onAppear { amountFocused = true }
            }
            if let error { Text(error).font(.caption).foregroundStyle(Palette.negative) }
        }
        .padding(compact ? 10 : 12)
        .background(Palette.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Palette.line))
        .accessibilityElement(children: .contain)
        .onAppear { amount = Money.edit(occurrence.cents) }
    }

    private func skip() {
        if !store.skip(occurrence) { error = "Couldn't skip this payment. Try again." }
    }

    private func confirm() {
        guard let cents = Money.parse(amount) else {
            error = "Enter the actual amount, like 9.99."
            return
        }
        guard store.settle(occurrence, cents: occurrence.cents < 0 ? -cents : cents, on: Day(date)) else {
            error = "Couldn't save this payment. Try again."
            return
        }
        error = nil
    }
}
