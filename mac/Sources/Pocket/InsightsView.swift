import PocketCore
import SwiftUI

struct InsightsView: View {
    @EnvironmentObject var store: Store
    var onShow: (String, YearMonth?) -> Void
    @State private var allTime = false
    @State private var month = Day.today.yearMonth
    @State private var grown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let first = store.ledger.firstMonth
        let last = store.today.yearMonth
        let s = store.ledger.summary(allTime ? nil : month)

        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    HStack(spacing: 4) {
                        Button { month = month.adding(-1); regrow() } label: { Image(systemName: "chevron.left") }
                            .disabled(allTime || month <= first)
                            .accessibilityLabel("Previous month")
                        Text(allTime ? "Since \(first.first.localDate.formatted(.dateTime.month(.wide).year()))"
                                     : month.first.localDate.formatted(.dateTime.month(.wide).year()))
                            .font(.display(20, .semibold))
                            .frame(minWidth: 180)
                        Button { month = month.adding(1); regrow() } label: { Image(systemName: "chevron.right") }
                            .disabled(allTime || month >= last)
                            .accessibilityLabel("Next month")
                    }
                    .buttonStyle(.borderless)
                    Spacer()
                    Picker("Period", selection: $allTime) {
                        Text("Month").tag(false)
                        Text("All time").tag(true)
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                    .frame(width: 180)
                    .onChange(of: allTime) { _, _ in regrow() }
                }

                HStack(spacing: 10) {
                    stat("Spent", store.money.string(s.spent))
                    stat("Money in", store.money.string(s.income))
                    stat("Net", store.money.string(s.net, signed: true), negative: s.net < 0)
                }

                if !allTime, month > first {
                    let prev = store.ledger.summary(month.adding(-1))
                    let diff = s.spent - prev.spent
                    let name = month.adding(-1).first.localDate.formatted(.dateTime.month(.wide))
                    Label(diff == 0 ? "Same spending as \(name)"
                          : "\(store.money.string(abs(diff))) \(diff > 0 ? "more" : "less") than \(name) (\(store.money.string(prev.spent)))",
                          systemImage: diff > 0 ? "chart.line.uptrend.xyaxis" : "chart.line.downtrend.xyaxis")
                        .foregroundStyle(.secondary)
                }

                breakdown(title: "Where it went", rows: s.byCategory, total: s.spent, income: false,
                          empty: allTime ? "No spending yet." : "No spending this month.")
                if !s.incomeByCategory.isEmpty {
                    breakdown(title: "Where it came from", rows: s.incomeByCategory, total: s.income, income: true, empty: "")
                }
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, 32).padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
        .onAppear { regrow() }
    }

    private func breakdown(title: String, rows: [CategoryTotal], total: Cents, income: Bool, empty: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionTitle(title: title, meta: rows.isEmpty ? nil : "Click one to see its \(income ? "payments" : "purchases")")
            if rows.isEmpty {
                Text(empty).foregroundStyle(.secondary).padding(.vertical, 16)
            } else {
                Card {
                    let top = max(rows.first?.cents ?? 1, 1)
                    ForEach(Array(rows.enumerated()), id: \.element.id) { i, c in
                        Button { onShow(c.category, allTime ? nil : month) } label: {
                            CategoryBar(total: c, share: Double(c.cents) / Double(top), percent: Int((Double(c.cents) / Double(max(total, 1)) * 100).rounded()),
                                        income: income, grown: grown, delay: Double(min(i, 8)) * 0.05)
                        }
                        .buttonStyle(.plain)
                        .help("Show these in History")
                    }
                }
            }
        }
    }

    private func regrow() {
        if reduceMotion { grown = true; return }
        grown = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { grown = true }
    }

    private func stat(_ k: String, _ v: String, negative: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(k).font(.caption).foregroundStyle(.secondary)
            Text(v).font(.display(22, .bold)).monospacedDigit()
                .foregroundStyle(negative ? Palette.negative : Color.primary)
                .lineLimit(1).minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Palette.surface, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Palette.line))
    }
}

struct CategoryBar: View {
    @EnvironmentObject var store: Store
    let total: CategoryTotal
    let share: Double
    let percent: Int
    var income = false
    let grown: Bool
    let delay: Double
    @State private var hovering = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let sign: Cents = income ? 1 : -1
        let noun = income ? (total.count == 1 ? "payment" : "payments") : (total.count == 1 ? "purchase" : "purchases")
        let tint = Categories.tint(total.category, cents: sign)
        HStack(spacing: 12) {
            CategoryIcon(category: total.category, cents: sign)
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text(Categories.name(total.category)).fontWeight(.medium)
                    Text("\(percent)% · \(total.count) \(noun)")
                        .font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Text(store.money.string(total.cents)).fontWeight(.medium).monospacedDigit()
                }
                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Capsule().fill(tint.opacity(0.12))
                        Capsule().fill(tint)
                            .frame(width: max(6, g.size.width * share * (grown ? 1 : 0)))
                            .animation(reduceMotion ? nil : .spring(duration: 0.7, bounce: 0).delay(delay), value: grown)
                    }
                }
                .frame(height: 6)
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 9)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(hovering ? Color.primary.opacity(0.05) : .clear))
        .contentShape(Rectangle())
        .onHover { hovering = $0 }
        .accessibilityLabel("\(Categories.name(total.category)): \(store.money.string(total.cents)), \(percent)% of \(income ? "money in" : "spending")")
    }
}
