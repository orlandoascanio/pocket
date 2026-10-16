import { addDays, addMonths, addYears, type Day } from "./day";
import type { Cents } from "./money";

export type Cadence = "weekly" | "biweekly" | "monthly" | "yearly";

export const CADENCES: Record<Cadence, { name: string; unit: string; perMonth: number }> = {
  weekly: { name: "Weekly", unit: "week", perMonth: 52 / 12 },
  biweekly: { name: "Every 2 weeks", unit: "2 weeks", perMonth: 26 / 12 },
  monthly: { name: "Monthly", unit: "month", perMonth: 1 },
  yearly: { name: "Yearly", unit: "year", perMonth: 1 / 12 },
};

/** Occurrence n is always counted from the anchor, so month ends don't drift (Jan 31 → Feb 28 → Mar 31). */
export function step(cadence: Cadence, anchor: Day, n: number): Day {
  switch (cadence) {
    case "weekly": return addDays(anchor, 7 * n);
    case "biweekly": return addDays(anchor, 14 * n);
    case "monthly": return addMonths(anchor, n);
    case "yearly": return addYears(anchor, n);
  }
}

/** Something that already happened: money in (positive) or out (negative). */
export interface Entry {
  id: string;
  cents: Cents;
  label: string;
  day: Day;
  category?: string;
  /** Set when a repeating payment logged it. */
  ruleID?: string;
  /** ISO 8601 timestamp. */
  created: string;
}

/** Money that repeats (a subscription, a paycheck), or one expected payment (total == 1). */
export interface Rule {
  id: string;
  cents: Cents;
  label: string;
  cadence: Cadence;
  /** The first payment; occurrence n is `step(cadence, anchor, n)`. */
  anchor: Day;
  /** Occurrences already logged (or skipped). */
  posted: number;
  /** Missing = keeps going forever. */
  total?: number;
  active: boolean;
  /** false = don't log it by itself; wait until the person confirms it arrived. */
  auto: boolean;
  category?: string;
  created: string;
}

/** A quick-add button. Missing `cents` means "ask for the amount each time". */
export interface Preset {
  id: string;
  label: string;
  cents?: Cents;
  /** -1 spending, +1 money in. */
  sign: 1 | -1;
  category?: string;
}

/** Everything a person has. The same shape as Pocket for Mac's ledger.json. */
export interface Ledger {
  version: 1;
  currency: string;
  entries: Entry[];
  rules: Rule[];
  presets: Preset[];
}

/** A future (or overdue) payment of a rule. */
export interface Occurrence {
  ruleID: string;
  label: string;
  cents: Cents;
  category?: string;
  day: Day;
  /** Due on or before today but not logged yet (only rules that wait for confirmation). */
  overdue: boolean;
  /** The next payment of its rule (the one "Got it" / "Skip" act on). */
  isNext: boolean;
}

/** What the screens show about a rule, whether it lives on this phone or on a server. */
export interface RuleView {
  id: string;
  cents: Cents;
  label: string;
  cadence: Cadence;
  next: Day;
  /** Payments still to come, including the next one. Missing = no end. */
  remaining?: number;
  once: boolean;
  active: boolean;
  auto: boolean;
  category?: string;
}

export const occurrenceKey = (o: Occurrence) => o.ruleID + "@" + o.day;

export const ruleIsOnce = (r: Rule) => r.total === 1;
export const ruleFinished = (r: Rule) => r.total !== undefined && r.posted >= r.total;
export const ruleNext = (r: Rule) => step(r.cadence, r.anchor, r.posted);

export function ruleView(r: Rule): RuleView {
  return {
    id: r.id, cents: r.cents, label: r.label, cadence: r.cadence, next: ruleNext(r),
    remaining: r.total === undefined ? undefined : Math.max(0, r.total - r.posted),
    once: ruleIsOnce(r), active: r.active, auto: r.auto, category: r.category,
  };
}
