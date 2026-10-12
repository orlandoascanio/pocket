import PocketCore
import SwiftUI

enum Frequency: String, CaseIterable, Identifiable {
    case once, weekly, biweekly, monthly, yearly
    var id: String { rawValue }
    var cadence: Cadence? { Cadence(rawValue: rawValue) }
    var name: String { self == .once ? "Once" : self == .biweekly ? "2 weeks" : cadence!.name }
}

struct EntryDraft: Equatable {
    var spent: Bool
    var amount: String
    var label: String
    var category: String?
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
    @Published var showDetails = false

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
        showDetails = false
    }

    func load(_ e: Entry) {
        reset()
        showDetails = true
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
        showDetails = true
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

    var draft: EntryDraft { EntryDraft(spent: spent, amount: amount, label: label, category: category) }

    func load(_ draft: EntryDraft) {
        reset()
        spent = draft.spent
        amount = draft.amount
        label = draft.label
        category = draft.category
        categoryTouched = draft.category != nil
        showDetails = true
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
        let success: Bool
        switch mode {
        case .entry(var e):
            e.cents = signed
            e.label = l
            e.day = day
            e.category = category
            success = store.updateEntry(e)
        case .rule(let r):
            success = store.updateRule(r.id, cents: signed, label: l, cadence: frequency.cadence ?? .monthly, next: day,
                             left: frequency == .once ? 1 : count, category: category, auto: !confirm)
        case .new:
            if isPlanned {
                // A one-time entry in the future is a rule with a single payment, so it counts on its day.
                success = store.addRule(Rule(cents: signed, label: l, cadence: frequency.cadence ?? .monthly, anchor: day,
                                   total: frequency == .once ? 1 : count, auto: !confirm, category: category))
            } else {
                let preset = savePreset ? Preset(label: l, cents: cents, sign: spent ? -1 : 1, category: category) : nil
                success = store.addEntry(cents: signed, label: l, day: day, category: category, preset: preset) != nil
            }
        }
        guard success else {
            error = "Couldn't save. Your entry is still here; try again."
            return false
        }
        reset()
        saved += 1
        focusAmount += 1
        return true
    }
}

/// The full add / edit form, shown as a sheet: what, when, how often, and whether to confirm.
struct EntryEditor: View {
    @EnvironmentObject var store: Store
    @ObservedObject var state: EditorState
    var onClose: (() -> Void)? = nil

    @FocusState private var focus: Field?
    @State private var confirmDelete = false
    enum Field { case amount, label }

    private var categories: [PocketCore.Category] { state.spent ? Categories.spending : Categories.income }

    var body: some View {
        VStack(spacing: 0) {
            Text(title).font(.headline).padding(.top, 18)
            Form {
                Section {
                    Picker("Type", selection: $state.spent) {
                        Text("Spent").tag(true)
                        Text("Got money").tag(false)
                    }
                    .pickerStyle(.segmented)
                    TextField("Amount", text: $state.amount, prompt: Text(store.money.placeholder))
                        .monospacedDigit()
                        .focused($focus, equals: .amount)
                        .onSubmit { focus = .label }
                    TextField("Description", text: $state.label, prompt: Text(placeholder))
                        .focused($focus, equals: .label)
                        .onSubmit { state.save() }
                }
                Section {
                    DatePicker(dateCaption, selection: $state.date, displayedComponents: .date)
                    Picker("Category", selection: Binding(get: { state.category }, set: {
                        state.category = $0
                        state.categoryTouched = true
                    })) {
                        Text("None").tag(String?.none)
                        Divider()
                        ForEach(categories) { Label($0.name, systemImage: $0.symbol).tag(Optional($0.id)) }
                    }
                    if !state.editingEntry {
                        Picker("Repeat", selection: $state.frequency) {
                            ForEach(Frequency.allCases) { Text($0 == .biweekly ? "Every 2 weeks" : $0.name).tag($0) }
                        }
                        if state.frequency != .once {
                            TextField(state.editingRule != nil ? "Payments left" : "Number of payments", text: $state.times, prompt: Text("No end"))
                                .monospacedDigit()
                        }
                    }
                } footer: {
                    if let hint { Text(hint).font(.caption).foregroundStyle(.secondary) }
                }
                if state.isPlanned && !state.editingEntry {
                    Section {
                        Toggle(state.spent ? "Confirm each payment" : "Confirm when money arrives",
                               isOn: Binding(get: { state.confirm }, set: { state.confirm = $0; state.confirmTouched = true }))
                    } footer: {
                        Text(state.confirm ? "Waits in Overview until you confirm the real amount and date." : "Counts automatically on its date.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                if state.mode == .new && !state.isPlanned {
                    Section {
                        Toggle("Save as a quick-add button", isOn: $state.savePreset)
                    } footer: {
                        Text("Quick-add buttons sit above the entry field. ⌘1 to ⌘9 use the first nine.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .formStyle(.grouped)
            .scrollDisabled(true)
            if let error = state.error {
                Text(error).font(.callout).foregroundStyle(Palette.negative)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20)
            }
            HStack(spacing: 8) {
                if state.mode != .new {
                    Button("\(deleteTitle)…", role: .destructive) { confirmDelete = true }
                    if let rule = state.editingRule, !rule.isOnce {
                        Button(rule.active ? "Pause" : "Resume") {
                            guard store.setActive(rule.id, !rule.active) else { return }
                            state.reset()
                            onClose?()
                        }
                    }
                }
                Spacer()
                Button("Cancel") { state.reset(); onClose?() }.keyboardShortcut(.cancelAction)
                Button(buttonTitle) { state.save() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(Money.parse(state.amount) == nil)
            }
            .padding(.horizontal, 20).padding(.bottom, 18).padding(.top, 4)
        }
        .confirmationDialog(deleteQuestion, isPresented: $confirmDelete) {
            Button(deleteTitle, role: .destructive) { performDelete() }
        } message: { Text(deleteMessage) }
        .onChange(of: state.focusAmount) { _, _ in focus = .amount }
        .onAppear { state.store = store; if state.mode == .new { focus = .amount } }
    }

    private var title: String {
        switch state.mode {
        case .new:
            if state.frequency != .once { return state.spent ? "New Subscription or Bill" : "New Repeating Income" }
            if state.isFuture { return state.spent ? "New Planned Payment" : "New Expected Money" }
            return "New Entry"
        case .entry: return "Edit Entry"
        case .rule(let r): return r.isOnce ? "Edit Expected Payment" : "Edit Repeating Payment"
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
        if state.frequency != .once { return "Add Repeating" }
        return state.isFuture ? (state.spent ? "Add Planned" : "Add Expected") : (state.spent ? "Add Spending" : "Add Money In")
    }

    private var hint: String? {
        guard state.mode == .new else { return nil }
        if state.frequency != .once { return "Leave the number of payments empty if it never ends." }
        if state.isFuture { return "Shows in Plan until its date." }
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
        case .entry(let e): guard store.deleteEntry(e.id) else { return }
        case .rule(let r): guard store.removeRule(r.id) else { return }
        case .new: break
        }
        state.reset()
        onClose?()
    }
}
