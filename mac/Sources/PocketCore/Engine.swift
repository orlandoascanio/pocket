import Foundation

// The money logic. Every function is pure over `Ledger`, so it's easy to test.

extension Ledger {
    public var balance: Cents { entries.reduce(0) { $0 + $1.cents } }

    /// Newest first (by day, then by when it was entered).
    public var sortedEntries: [Entry] {
        entries.sorted { ($0.day, $0.created) > ($1.day, $1.created) }
    }

    /// The month of the oldest entry (where Insights starts).
    public var firstMonth: YearMonth { entries.map(\.day).min()?.yearMonth ?? Day.today.yearMonth }

    // MARK: entries

    public mutating func add(_ e: Entry) { entries.append(e) }

    public mutating func update(_ e: Entry) {
        guard let i = entries.firstIndex(where: { $0.id == e.id }) else { return }
        entries[i] = e
    }

    public mutating func removeEntry(_ id: UUID) { entries.removeAll { $0.id == id } }

    // MARK: repeating money

    /// Logs every automatic payment that is due on or before `today`. Returns what it logged.
    @discardableResult
    public mutating func postDue(today: Day) -> [Entry] {
        var logged: [Entry] = []
        for i in rules.indices where rules[i].active && rules[i].auto {
            var guardCount = 0
            while !rules[i].finished, rules[i].next <= today, guardCount < 400 {
                let r = rules[i]
                let e = Entry(cents: r.cents, label: r.label, day: r.next, category: r.category, ruleID: r.id)
                entries.append(e)
                logged.append(e)
                rules[i].posted += 1
                guardCount += 1
            }
        }
        return logged
    }

    public mutating func addRule(_ r: Rule, today: Day) {
        rules.append(r)
        postDue(today: today)
    }

    /// Edit a rule. Changing how often or the next date restarts the schedule from `next`;
    /// `left` counts the payments still to come, including the next one (nil = no end).
    public mutating func updateRule(_ id: UUID, cents: Cents, label: String, cadence: Cadence, next: Day,
                                    left: Int?, category: String?, auto: Bool, today: Day) {
        guard let i = rules.firstIndex(where: { $0.id == id }) else { return }
        if cadence != rules[i].cadence || next != rules[i].next {
            rules[i].anchor = next
            rules[i].posted = 0
            rules[i].cadence = cadence
            rules[i].total = left
        } else {
            rules[i].total = left.map { rules[i].posted + $0 }
        }
        rules[i].cents = cents
        rules[i].label = label
        rules[i].category = category
        rules[i].auto = auto
        postDue(today: today)
    }

    /// Stops a rule. Payments already logged stay in history.
    public mutating func removeRule(_ id: UUID) {
        rules.removeAll { $0.id == id }
        for i in entries.indices where entries[i].ruleID == id { entries[i].ruleID = nil }
    }

    /// "Got it": log the next payment now with the real amount and date (early, late, or different).
    @discardableResult
    public mutating func settle(_ id: UUID, cents: Cents? = nil, on day: Day, today: Day) -> Entry? {
        guard let i = rules.firstIndex(where: { $0.id == id }), !rules[i].finished else { return nil }
        let r = rules[i]
        let e = Entry(cents: cents ?? r.cents, label: r.label, day: day, category: r.category, ruleID: r.id)
        entries.append(e)
        rules[i].posted += 1
        postDue(today: today)
        return e
    }

    /// "Skip this one": the next payment won't happen.
    public mutating func skip(_ id: UUID) {
        guard let i = rules.firstIndex(where: { $0.id == id }), !rules[i].finished else { return }
        rules[i].posted += 1
    }

    /// Pause or resume. Resuming doesn't back-log what was missed while paused.
    public mutating func setActive(_ id: UUID, _ active: Bool, today: Day) {
        guard let i = rules.firstIndex(where: { $0.id == id }) else { return }
        if active && !rules[i].active {
            var guardCount = 0
            while !rules[i].finished, rules[i].next < today, guardCount < 400 {
                rules[i].posted += 1
                guardCount += 1
            }
        }
        rules[i].active = active
        postDue(today: today)
    }

    /// Rules still going (finished ones drop out), active first, soonest first.
    public var liveRules: [Rule] {
        rules.filter { !$0.finished }.sorted { ($0.active ? 0 : 1, $0.next, $0.label) < ($1.active ? 0 : 1, $1.next, $1.label) }
    }

    /// Every active payment from now until `today + days`, including overdue ones still waiting.
    public func upcoming(today: Day, days: Int) -> [Occurrence] {
        let horizon = today.adding(days: days)
        var out: [Occurrence] = []
        for r in rules where r.active && !r.finished {
            for g in 0..<400 {
                if let t = r.total, r.posted + g >= t { break }
                let d = r.occurrence(r.posted + g)
                if d > horizon { break }
                out.append(Occurrence(ruleID: r.id, label: r.label, cents: r.cents, category: r.category,
                                      day: d, overdue: d <= today, isNext: g == 0))
            }
        }
        return out.sorted { ($0.day, $0.label) < ($1.day, $1.label) }
    }

    /// Money that was due but hasn't been confirmed (the next one per rule).
    public func waiting(today: Day) -> [Occurrence] {
        upcoming(today: today, days: 0).filter { $0.overdue && $0.isNext }
    }

    // MARK: forecast

    public func project(today: Day, days: Int) -> Projection {
        let end = today.adding(days: days)
        let events = upcoming(today: today, days: days)
            .map { o -> Occurrence in var o = o; if o.overdue { o.day = today }; return o }
            .sorted { ($0.day, $0.label) < ($1.day, $1.label) }
        let start = balance
        var bal = start
        var points = [Projection.Point(day: today, balance: start, events: [])]
        var steps: [Projection.Step] = []
        var hitZero: Day?
        var backAbove: Occurrence?
        var low = (day: today, balance: start)
        for e in events {
            let before = bal
            bal += e.cents
            steps.append(.init(occurrence: e, after: bal))
            if points.count > 1, points[points.count - 1].day == e.day {
                points[points.count - 1].balance = bal
                points[points.count - 1].events.append(e)
            } else {
                points.append(.init(day: e.day, balance: bal, events: [e]))
            }
            if before >= 0 && bal < 0 && hitZero == nil { hitZero = e.day }
            if before < 0 && bal >= 0 && backAbove == nil { backAbove = e }
            if bal < low.balance { low = (e.day, bal) }
        }
        return Projection(today: today, end: end, days: days, start: start, endBalance: bal, points: points,
                          steps: steps, hitZero: hitZero, backAbove: backAbove, lowDay: low.day, lowBalance: low.balance)
    }

    // MARK: insights

    /// Spending and money in for a month (or all time when nil). The starting balance isn't income.
    public func summary(_ month: YearMonth?) -> Summary {
        var spent: Cents = 0
        var income: Cents = 0
        var by: [String: (Cents, Int)] = [:]
        for e in entries where e.category != Categories.start && (month?.contains(e.day) ?? true) {
            if e.cents > 0 { income += e.cents; continue }
            spent -= e.cents
            let c = e.category ?? "other"
            let cur = by[c] ?? (0, 0)
            by[c] = (cur.0 - e.cents, cur.1 + 1)
        }
        let rows = by.map { CategoryTotal(category: $0.key, cents: $0.value.0, count: $0.value.1) }
            .sorted { ($0.cents, $1.category) > ($1.cents, $0.category) }
        return Summary(spent: spent, income: income, byCategory: rows)
    }

    /// The category most often used with labels starting like `prefix` (so "valo" picks Games).
    public func guessCategory(for prefix: String, income: Bool) -> String? {
        let q = prefix.trimmingCharacters(in: .whitespaces).lowercased()
        guard q.count >= 3 else { return nil }
        let allowed = Set((income ? Categories.income : Categories.spending).map(\.id))
        let fromPresets = presets.first { ($0.category.map(allowed.contains) ?? false) && $0.label.lowercased().hasPrefix(q) }
        if let c = fromPresets?.category { return c }
        return sortedEntries.first { ($0.category.map(allowed.contains) ?? false) && $0.label.lowercased().hasPrefix(q) }?.category
    }
}

public struct Projection: Sendable {
    public struct Point: Identifiable, Sendable {
        public var day: Day
        public var balance: Cents
        public var events: [Occurrence]
        public var id: String { day.iso + "\(events.count)" }
    }

    public struct Step: Identifiable, Sendable {
        public var occurrence: Occurrence
        public var after: Cents
        public var id: String { occurrence.id }
    }

    public var today: Day
    public var end: Day
    public var days: Int
    public var start: Cents
    public var endBalance: Cents
    public var points: [Point]
    public var steps: [Step]
    public var hitZero: Day?
    public var backAbove: Occurrence?
    public var lowDay: Day
    public var lowBalance: Cents

    public enum Runway: Equatable, Sendable {
        case backAboveOnce(String)
        case backAboveOn(Day)
        case belowForWholeRange
        case runsOut(Day)
        case lastsPast(Day)

        public var warn: Bool {
            switch self {
            case .belowForWholeRange, .runsOut: true
            default: false
            }
        }
    }

    public var runway: Runway {
        if start < 0 {
            if let b = backAbove { return b.overdue ? .backAboveOnce(b.label) : .backAboveOn(b.day) }
            return .belowForWholeRange
        }
        if let hitZero { return .runsOut(hitZero) }
        return .lastsPast(end)
    }
}

public struct CategoryTotal: Identifiable, Equatable, Sendable {
    public var category: String
    public var cents: Cents
    public var count: Int
    public var id: String { category }
}

public struct Summary: Equatable, Sendable {
    public var spent: Cents
    public var income: Cents
    public var byCategory: [CategoryTotal]
    public var net: Cents { income - spent }
}
