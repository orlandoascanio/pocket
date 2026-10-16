/** Money is stored in cents (whole numbers) so sums never drift. */
export type Cents = number;

const formatters = new Map<string, Intl.NumberFormat>();
function formatter(currency: string, opts: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = currency + JSON.stringify(opts);
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, { style: "currency", currency, ...opts });
    } catch {
      f = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", ...opts });
    }
    formatters.set(key, f);
  }
  return f;
}

/** Formats and parses amounts in the person's chosen currency. */
export class Money {
  constructor(readonly currency: string) {}

  /** "$", "€", "¥": shown beside an amount while it's typed. */
  get symbol(): string {
    // Hermes has no formatToParts: format zero and keep what isn't the number.
    const s = formatter(this.currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(0);
    return s.replace(/[0-9\s  .,'-]/g, "") || this.currency;
  }

  string(cents: Cents, signed = false): string {
    const whole = formatter(this.currency).resolvedOptions().maximumFractionDigits === 0;
    // Keep a fractional recorded amount visible even for a whole-unit currency.
    const f = whole && cents % 100 !== 0
      ? formatter(this.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : formatter(this.currency);
    const s = f.format(cents / 100);
    return signed && cents > 0 ? "+" + s : s;
  }

  /** "$1.2K" style, for chart axes. */
  compact(cents: Cents): string {
    const value = cents / 100;
    const mag = Math.abs(value);
    const [n, suffix] = mag >= 1_000_000 ? [value / 1_000_000, "M"] : mag >= 1_000 ? [value / 1_000, "K"] : [value, ""];
    const f = formatter(this.currency, { minimumFractionDigits: 0, maximumFractionDigits: suffix ? 1 : 0 });
    return f.format(n) + suffix;
  }

  /** Whole units only ("$750"), for rough monthly totals. */
  whole(cents: Cents): string {
    return formatter(this.currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(cents / 100));
  }
}

const DIGITS = /^[0-9]+$/;

function validGroupedInteger(text: string, sep: string): boolean {
  const parts = text.split(sep);
  return parts[0].length >= 1 && parts[0].length <= 3 && parts.every((p) => DIGITS.test(p)) && parts.slice(1).every((p) => p.length === 3);
}

/** Reads what someone typed ("9.99", "9,99", "$9.99", "1,234.50") as a positive amount in cents. */
export function parseMoney(text: string, allowZero = false): Cents | null {
  let s = text.trim();
  // Accept a pasted currency symbol, but never silently discard arbitrary text or digits.
  s = s.replace(/^\p{Sc}\s*/u, "").replace(/\s*\p{Sc}$/u, "");
  if (s.startsWith("+") || s.startsWith("-")) s = s.slice(1);
  if (!/[0-9]/.test(s) || !/^[0-9.,]+$/.test(s)) return null;
  let integer: string;
  let fraction: string;
  if (s.includes(".") && s.includes(",")) {
    const decimal = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
    const grouping = s[decimal] === "." ? "," : ".";
    const whole = s.slice(0, decimal);
    if (!validGroupedInteger(whole, grouping)) return null;
    integer = whole.split(grouping).join("");
    fraction = s.slice(decimal + 1);
    if (fraction.length < 1 || fraction.length > 2 || !DIGITS.test(fraction)) return null;
  } else if (s.includes(".") || s.includes(",")) {
    const sep = s.includes(".") ? "." : ",";
    const parts = s.split(sep);
    if (parts.length === 2 && parts[1].length <= 2) {
      integer = parts[0] === "" ? "0" : parts[0];
      fraction = parts[1];
    } else {
      if (!validGroupedInteger(s, sep)) return null;
      integer = parts.join("");
      fraction = "";
    }
  } else {
    integer = s;
    fraction = "";
  }
  if (!DIGITS.test(integer)) return null;
  const units = Number(integer);
  if (!Number.isSafeInteger(units) || units >= 1_000_000_000) return null;
  const cents = units * 100 + Number(fraction.padEnd(2, "0") || "0");
  return cents > 0 || allowZero ? cents : null;
}

/** What an amount field keeps of typed or pasted text: digits and separators only. */
export const amountInput = (text: string) => text.replace(/[^0-9.,]/g, "");

/** Cents as an editable string ("9.99"). */
export function editString(cents: Cents): string {
  return (Math.abs(cents) / 100).toFixed(2);
}

export const CURRENCIES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "NZD", "JPY", "CNY", "INR", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK",
  "HUF", "MXN", "BRL", "ARS", "CLP", "COP", "PEN", "ZAR", "NGN", "KES", "EGP", "TRY", "ILS", "AED", "SAR",
  "SGD", "HKD", "TWD", "KRW", "THB", "MYR", "IDR", "PHP", "VND", "PKR", "BDT", "UAH", "RON",
];
