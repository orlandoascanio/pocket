import Foundation

/// Formats and parses amounts in the person's chosen currency.
public struct Money: Sendable {
    public let currency: String
    public let locale: Locale

    public init(currency: String, locale: Locale = .current) {
        self.currency = currency
        self.locale = locale
    }

    private var formatter: NumberFormatter {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = currency
        f.locale = locale
        return f
    }

    /// Digits after the decimal point for this currency (2 for USD, 0 for JPY).
    public var fractionDigits: Int { formatter.maximumFractionDigits }

    /// "$", "€", "¥": shown beside an amount while it's typed.
    public var symbol: String { formatter.currencySymbol ?? currency }

    /// What an empty amount field shows: "0.00", or "0" for currencies without cents.
    public var placeholder: String { fractionDigits == 0 ? "0" : "0." + String(repeating: "0", count: fractionDigits) }

    public func string(_ cents: Cents, signed: Bool = false) -> String {
        let value = Double(cents) / 100
        let s = formatter.string(from: NSNumber(value: value)) ?? "\(value)"
        return signed && cents > 0 ? "+" + s : s
    }

    /// "$1.2K" style, for chart axes.
    public func compact(_ cents: Cents) -> String {
        let value = Double(cents) / 100
        let mag = abs(value)
        let f = formatter
        f.maximumFractionDigits = 1
        f.minimumFractionDigits = 0
        let (n, suffix) = mag >= 1_000_000 ? (value / 1_000_000, "M") : mag >= 1_000 ? (value / 1_000, "K") : (value, "")
        if suffix.isEmpty { f.maximumFractionDigits = 0 }
        return (f.string(from: NSNumber(value: n)) ?? "\(n)") + suffix
    }

    /// Whole units only ("$750"), for rough monthly totals.
    public func whole(_ cents: Cents) -> String {
        let f = formatter
        f.maximumFractionDigits = 0
        f.minimumFractionDigits = 0
        return f.string(from: NSNumber(value: (Double(cents) / 100).rounded())) ?? "\(cents / 100)"
    }

    /// Reads what someone typed ("9.99", "9,99", "$9.99", "1,234.50") as a positive amount in cents.
    public static func parse(_ text: String) -> Cents? {
        var s = text.trimmingCharacters(in: .whitespaces).filter { "0123456789.,-".contains($0) }
        s = s.replacingOccurrences(of: "-", with: "")
        guard !s.isEmpty else { return nil }
        // The last separator is the decimal one when it has 1–2 digits after it.
        if let last = s.lastIndex(where: { $0 == "." || $0 == "," }) {
            let decimals = s[s.index(after: last)...]
            let whole = s[..<last].filter(\.isNumber)
            s = decimals.count <= 2 ? whole + "." + decimals : whole + decimals
        }
        guard let v = Double(s), v > 0, v < 1_000_000_000 else { return nil }
        return Int((v * 100).rounded())
    }

    /// Cents as an editable string ("9.99").
    public static func edit(_ cents: Cents) -> String { String(format: "%.2f", Double(abs(cents)) / 100) }
}
