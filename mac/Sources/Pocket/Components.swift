import PocketCore
import SwiftUI

/// A row in History, Coming up or Repeating.
struct MoneyRow: View {
    var symbol: String
    var title: String
    var tag: String? = nil
    var note: String
    var cents: Cents
    var rightNote: String? = nil
    var rightNegative = false
    var selected = false
    var dimmed = false
    @EnvironmentObject var store: Store
    @State private var hovering = false

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .semibold))
                .frame(width: 34, height: 34)
                .foregroundStyle(cents > 0 ? Palette.accent : Palette.negative)
                .background((cents > 0 ? Palette.accent : Palette.negative).opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(title).lineLimit(1)
                    if let tag {
                        Text(tag).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(Palette.line))
                    }
                }
                if !note.isEmpty { Text(note).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
            }
            .opacity(dimmed ? 0.55 : 1)
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                Text(store.money.string(cents, signed: true))
                    .fontWeight(.semibold).monospacedDigit()
                    .foregroundStyle(cents > 0 ? Palette.accent : Color.primary)
                if let rightNote {
                    Text(rightNote).font(.caption).monospacedDigit()
                        .foregroundStyle(rightNegative ? Palette.negative : .secondary)
                }
            }
            .opacity(dimmed ? 0.55 : 1)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(selected ? Palette.accent.opacity(0.14) : hovering ? Color.primary.opacity(0.05) : .clear)
        )
        .contentShape(Rectangle())
        .onHover { hovering = $0 }
    }
}

/// A rounded card like the web app's.
struct Card<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content }
            .padding(6)
            .background(Palette.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Palette.line))
    }
}

struct SectionTitle: View {
    var title: String
    var meta: String? = nil
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(.secondary).kerning(0.6)
            Spacer()
            if let meta { Text(meta).font(.caption).foregroundStyle(.secondary) }
        }
        .padding(.horizontal, 4)
    }
}

/// A selectable capsule (frequency, category).
struct Chip: View {
    var title: String
    var symbol: String? = nil
    var on: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if let symbol { Image(systemName: symbol).font(.system(size: 11, weight: .semibold)) }
                Text(title)
            }
            .font(.callout)
            .padding(.horizontal, 11).padding(.vertical, 5)
            .foregroundStyle(on ? Palette.bg : Color.primary)
            .background(on ? Color.primary : Palette.chip, in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.15), value: on)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// ⌘1 … ⌘9 for the first nine quick-add buttons.
struct NumberShortcut: ViewModifier {
    let index: Int
    func body(content: Content) -> some View {
        if index < 9 {
            content.keyboardShortcut(KeyEquivalent(Character(String(index + 1))), modifiers: .command)
        } else {
            content
        }
    }
}

/// The row of quick-add buttons.
struct QuickBar: View {
    @EnvironmentObject var store: Store
    var onAsk: (Preset) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(Array(store.ledger.presets.enumerated()), id: \.element.id) { i, p in
                    Button { use(p) } label: {
                        HStack(spacing: 6) {
                            Image(systemName: Categories.symbol(p.category, cents: p.sign))
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(p.sign > 0 ? Palette.accent : Color.secondary)
                            Text(p.label)
                            if let c = p.cents {
                                Text(store.money.string(p.sign * c, signed: p.sign > 0)).foregroundStyle(.secondary).monospacedDigit()
                            }
                        }
                        .font(.callout.weight(.medium))
                        .padding(.horizontal, 11).padding(.vertical, 6)
                        .background(Palette.surface, in: Capsule())
                        .overlay(Capsule().strokeBorder(Palette.line))
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .modifier(NumberShortcut(index: i))
                    .help(i < 9 ? "\(p.label) (⌘\(i + 1))" : p.label)
                }
            }
            .padding(.vertical, 1)
        }
    }

    private func use(_ p: Preset) {
        guard let c = p.cents else { onAsk(p); return }
        store.addEntry(cents: p.sign * c, label: p.label, day: store.today, category: p.category)
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
