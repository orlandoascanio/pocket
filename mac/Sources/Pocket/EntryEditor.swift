import PocketCore
import SwiftUI

enum Frequency: String, CaseIterable, Identifiable {
    case once, weekly, biweekly, monthly, yearly
    var id: String { rawValue }
    var cadence: Cadence? { Cadence(rawValue: rawValue) }
    var name: String { self == .once ? "Once" : self == .biweekly ? "2 weeks" : cadence!.name }
}

/// Form state for adding or editing an entry or a repeating payment.
@MainActor
final class EditorState: ObservableObject {
    enum Mode: Equatable {
        case new
        case entry(Entry)
        case rule(Rule)
    }

    @Published var mode: Mode = .new
    @Published var spent = true {
        didSet {
            let allowed = (spent ? Categories.spending : Categories.income).map(\.id)
            if let c = category, !allowed.contains(c) { category = nil }
            if mode == .new && !confirmTouched { confirm = !spent }
        }
    }
    @Published var frequency: Frequency = .once
    @Published var amount = ""
    @Published var label = "" {
        didSet {
            guard !categoryTouched, mode == .new, let store else { return }
            if let c = store.ledger.guessCategory(for: label, income: !spent) { category = c }
        }
    }
    @Published var category: String?
    @Published var categoryTouched = false
    @Published var date = Date()
    @Published var times = ""
    @Published var confirm = false
    @Published var confirmTouched = false
    @Published var savePreset = false
    @Published var error: String?
    @Published var saved = 0
    @Published var focusAmount = 0

    weak var store: Store?

    var day: Day { Day(date) }
    var isFuture: Bool { day > Day.today }
    var isPlanned: Bool { frequency != .once || isFuture }
    var editingEntry: Bool { if case .entry = mode { return true } else { return false } }
    var editingRule: Rule? { if case .rule(let r) = mode { return r } else { return nil } }

    func reset() {
        mode = .new
        spent = true
        frequency = .once
        amount = ""
        label = ""
        category = nil
        categoryTouched = false
        date = Date()
        times = ""
        confirm = false
        confirmTouched = false
        savePreset = false
        error = nil
    }

    func load(_ e: Entry) {
        reset()
        mode = .entry(e)
        spent = e.cents < 0
        amount = Money.edit(e.cents)
        label = e.label
        category = e.category == Categories.start ? nil : e.category
        categoryTouched = true
        date = e.day.localDate
    }

    func load(_ r: Rule) {
        reset()
        mode = .rule(r)
        spent = r.cents < 0
        frequency = r.isOnce ? .once : Frequency(rawValue: r.cadence.rawValue) ?? .monthly
        amount = Money.edit(r.cents)
        label = r.label
        category = r.category
        categoryTouched = true
        date = r.next.localDate
        times = r.isOnce ? "" : r.remaining.map(String.init) ?? ""
        confirm = !r.auto
        confirmTouched = true
    }

    /// Fill the form from a quick-add button that asks for the amount each time.
    func start(from p: Preset) {
        reset()
        spent = p.sign < 0
        label = p.label
        category = p.category
        categoryTouched = true
        focusAmount += 1
    }

    @discardableResult
    func save() -> Bool {
        guard let store else { return false }
        guard let cents = Money.parse(amount) else { error = "Enter an amount, like 9.99"; return false }
        let l = label.trimmed
        guard !l.isEmpty else { error = "Say what it was"; return false }
        let t = times.trimmed
        let count = t.isEmpty ? nil : Int(t)
        if frequency != .once && !t.isEmpty && (count ?? 0) < 1 {
            error = "Payments must be a whole number, like 3"
            return false
        }
        let signed = spent ? -cents : cents
        switch mode {
        case .entry(var e):
            e.cents = signed
            e.label = l
            e.day = day
            e.category = category
            store.updateEntry(e)
        case .rule(let r):
            store.updateRule(r.id, cents: signed, label: l, cadence: frequency.cadence ?? .monthly, next: day,
                             left: frequency == .once ? 1 : count, category: category, auto: !confirm)
        case .new:
            if isPlanned {
                // A one-time entry in the future is a rule with a single payment, so it counts on its day.
                store.addRule(Rule(cents: signed, label: l, cadence: frequency.cadence ?? .monthly, anchor: day,
                                   total: frequency == .once ? 1 : count, auto: !confirm, category: category))
            } else {
                store.addEntry(cents: signed, label: l, day: day, category: category)
                if savePreset {
                    store.savePreset(Preset(label: l, cents: cents, sign: spent ? -1 : 1, category: category))
                }
            }
        }
        reset()
        saved += 1
        focusAmount += 1
        return true
    }
}

/// The add / edit form.
struct EntryEditor: View {
    @EnvironmentObject var store: Store
    @ObservedObject var state: EditorState
    var onClose: (() -> Void)? = nil

    @FocusState private var focus: Field?
    @State private var confirmDelete = false
    enum Field { case amount, label }

    private var categories: [PocketCore.Category] { state.spent ? Categories.spending : Categories.income }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title).font(.display(15, .semibold))
                Spacer()
                if state.mode != .new || onClose != nil {
                    Button("Cancel") { state.reset(); onClose?() }
                        .buttonStyle(.link)
                        .keyboardShortcut(.cancelAction)
                }
            }

            Picker("Type", selection: $state.spent) {
                Label("Spent", systemImage: "minus").tag(true)
                Label("Got money", systemImage: "plus").tag(false)
            }
            .pickerStyle(.segmented)
            .labelsHidden()

            if !state.editingEntry {
                HStack(spacing: 6) {
                    ForEach(Frequency.allCases) { f in
                        Chip(title: f.name, on: state.frequency == f) { state.frequency = f }
                    }
                }
            }

            HStack(spacing: 8) {
                TextField("0.00", text: $state.amount)
                    .frame(width: 110)
                    .focused($focus, equals: .amount)
                    .onSubmit { focus = .label }
                TextField(placeholder, text: $state.label)
                    .focused($focus, equals: .label)
                    .onSubmit { state.save() }
            }
            .textFieldStyle(.roundedBorder)
            .controlSize(.large)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(categories) { c in
                        Chip(title: c.name, symbol: c.symbol, on: state.category == c.id) {
                            state.category = state.category == c.id ? nil : c.id
                            state.categoryTouched = true
                        }
                    }
                }
                .padding(.vertical, 1)
            }

            if state.frequency != .once && !state.editingEntry {
                HStack(spacing: 8) {
                    Text(state.editingRule != nil ? "Payments left (including the next one)" : "How many payments?")
                        .font(.caption).foregroundStyle(.secondary)
                    TextField("No end", text: $state.times)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 80)
                    Text("Leave empty if it never ends").font(.caption).foregroundStyle(.tertiary)
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            HStack(spacing: 8) {
                Text(dateCaption).font(.caption).foregroundStyle(.secondary)
                DatePicker("", selection: $state.date, displayedComponents: .date)
                    .labelsHidden()
                    .datePickerStyle(.field)
                Spacer()
                if state.saved > 0 {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Palette.accent)
                        .symbolEffect(.bounce, value: state.saved)
                }
                Button(buttonTitle) { state.save() }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .keyboardShortcut(.defaultAction)
            }

            if state.isPlanned && !state.editingEntry {
                Toggle("Wait for me to confirm each payment arrived", isOn: Binding(
                    get: { state.confirm }, set: { state.confirm = $0; state.confirmTouched = true }))
                    .toggleStyle(.checkbox)
            }
            if state.mode == .new && !state.isPlanned {
                Toggle("Also save as a quick-add button", isOn: $state.savePreset).toggleStyle(.checkbox)
            }
            if let hint {
                Text(hint).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }

            if state.mode != .new {
                HStack(spacing: 8) {
                    Button(role: .destructive) { confirmDelete = true } label: { Text(deleteTitle) }
                    if let r = state.editingRule, !r.isOnce {
                        Button(r.active ? "Pause" : "Resume") {
                            store.setActive(r.id, !r.active)
                            state.reset()
                            onClose?()
                        }
                    }
                }
                .confirmationDialog(deleteQuestion, isPresented: $confirmDelete) {
                    Button(deleteTitle, role: .destructive) { performDelete() }
                } message: {
                    Text(deleteMessage)
                }
            }

            if let e = state.error {
                Text(e).font(.callout).foregroundStyle(Palette.negative)
            }
        }
        .animation(.snappy(duration: 0.25), value: state.frequency)
        .animation(.snappy(duration: 0.25), value: state.isPlanned)
        .onChange(of: state.focusAmount) { _, _ in focus = .amount }
        .onAppear { state.store = store }
    }

    private var title: String {
        switch state.mode {
        case .new:
            if state.frequency != .once { return state.spent ? "New subscription or bill" : "New repeating income" }
            if state.isFuture { return state.spent ? "Planned payment" : "Expected money" }
            return "New entry"
        case .entry: return "Edit entry"
        case .rule(let r): return r.isOnce ? "Edit expected payment" : "Edit repeating"
        }
    }

    private var placeholder: String {
        if state.frequency != .once { return state.spent ? "e.g. Netflix, rent" : "e.g. Paycheck" }
        return state.spent ? "What was it?" : "Where's it from?"
    }

    private var dateCaption: String {
        if state.editingRule != nil { return state.frequency == .once ? "Expected on" : "Next payment" }
        if state.frequency == .once { return state.isFuture ? (state.spent ? "Planned for" : "Expected on") : "Date" }
        return state.spent ? "First payment" : "First payday"
    }

    private var buttonTitle: String {
        if state.mode != .new { return "Save" }
        if state.frequency != .once { return "Add repeating" }
        return state.isFuture ? (state.spent ? "Add planned" : "Add expected") : "Add"
    }

    private var hint: String? {
        guard state.mode == .new else { return nil }
        if state.frequency != .once {
            let unit = state.frequency.cadence!.unit
            return state.confirm
                ? "Each \(unit) it waits in Overview until you click “Got it”, so late or smaller payments are easy to log."
                : "Logged automatically every \(unit) from this date."
        }
        if state.isFuture {
            return "This is in the future. It shows in Plan until then"
                + (state.confirm ? ", then waits for you to confirm it arrived." : ", then counts automatically.")
        }
        return nil
    }

    private var deleteTitle: String {
        switch state.mode {
        case .rule(let r): r.isOnce ? "Remove" : "Stop repeating"
        default: "Delete"
        }
    }

    private var deleteQuestion: String {
        switch state.mode {
        case .entry(let e): "Delete “\(e.label)”?"
        case .rule(let r): r.isOnce ? "Remove expected “\(r.label)”?" : "Stop “\(r.label)”?"
        case .new: ""
        }
    }

    private var deleteMessage: String {
        switch state.mode {
        case .entry(let e): "\(store.money.string(e.cents, signed: true)) on \(e.day.localDate.formatted(date: .abbreviated, time: .omitted)). This can't be undone."
        case .rule: "Payments already logged stay in your history."
        case .new: ""
        }
    }

    private func performDelete() {
        switch state.mode {
        case .entry(let e): store.deleteEntry(e.id)
        case .rule(let r): store.removeRule(r.id)
        case .new: break
        }
        state.reset()
        onClose?()
    }
}
