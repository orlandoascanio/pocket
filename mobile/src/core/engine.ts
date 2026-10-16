// The money logic, ported from Pocket for Mac (PocketCore/Engine.swift) so both apps agree to the cent.
// Ledger functions mutate the ledger they're given; callers pass a copy.
import { CATEGORY_START, INCOME, SPENDING, categoryKey } from "./categories";
import { addDays, isDay, monthContains, type Day, type YearMonth } from "./day";
import type { Cents } from "./money";
import {
  ruleFinished, ruleNext, step,
  type Cadence, type Entry, type Ledger, type Occurrence, type Rule,
} from "./models";

const GUARD = 400;

export const balanceOf = (entries: Entry[]): Cents => entries.reduce((sum, e) => sum + e.cents, 0);

/** Newest first (by day, then by when it was entered). */
export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => (a.day === b.day ? (a.created < b.created ? 1 : a.created > b.created ? -1 : 0) : a.day < b.day ? 1 : -1));
}

export function nowStamp(): string {
  // Second precision: Pocket for Mac reads ISO 8601 without fractional seconds.
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ---------- repeating money ----------

/** Logs every automatic payment that is due on or before `today`. Returns what it logged. */
export function postDue(l: Ledger, today: Day, newID: () => string): Entry[] {
  const logged: Entry[] = [];
  for (const r of l.rules) {
    if (!r.active || !r.auto) continue;
    let guard = 0;
    while (!ruleFinished(r) && ruleNext(r) <= today && guard < GUARD) {
      const e: Entry = { id: newID(), cents: r.cents, label: r.label, day: ruleNext(r), category: r.category, ruleID: r.id, created: nowStamp() };
      l.entries.push(e);
      logged.push(e);
      r.posted += 1;
      guard += 1;
    }
  }
  return logged;
}

/**
 * Edit a rule. Changing how often or the next date restarts the schedule from `next`;
 * `left` counts the payments still to come, including the next one (undefined = no end).
 */
export function updateRule(
  l: Ledger, id: string,
  edit: { cents: Cents; label: string; cadence: Cadence; next: Day; left?: number; category?: string; auto: boolean },
  today: Day, newID: () => string,
) {
  const r = l.rules.find((x) => x.id === id);
  if (!r) return;
  if (edit.cadence !== r.cadence || edit.next !== ruleNext(r)) {
    r.anchor = edit.next;
    r.posted = 0;
    r.cadence = edit.cadence;
    r.total = edit.left;
  } else {
    r.total = edit.left === undefined ? undefined : r.posted + edit.left;
  }
  r.cents = edit.cents;
  r.label = edit.label;
  r.category = edit.category;
  r.auto = edit.auto;
  postDue(l, today, newID);
}

/** Stops a rule. Payments already logged stay in history. */
export function removeRule(l: Ledger, id: string) {
  l.rules = l.rules.filter((r) => r.id !== id);
  for (const e of l.entries) if (e.ruleID === id) delete e.ruleID;
}

/** "Got it": log the next payment now with the real amount and date (early, late, or different). */
export function settle(l: Ledger, id: string, cents: Cents | undefined, day: Day, today: Day, newID: () => string): Entry | null {
  const r = l.rules.find((x) => x.id === id);
  if (!r || ruleFinished(r)) return null;
  const e: Entry = { id: newID(), cents: cents ?? r.cents, label: r.label, day, category: r.category, ruleID: r.id, created: nowStamp() };
  l.entries.push(e);
  r.posted += 1;
  postDue(l, today, newID);
  return e;
}

/** "Skip this one": the next payment won't happen. */
export function skip(l: Ledger, id: string) {
  const r = l.rules.find((x) => x.id === id);
  if (r && !ruleFinished(r)) r.posted += 1;
}

/** Pause or resume. Resuming doesn't back-log what was missed while paused. */
export function setActive(l: Ledger, id: string, active: boolean, today: Day, newID: () => string) {
  const r = l.rules.find((x) => x.id === id);
  if (!r) return;
  if (active && !r.active) {
    let guard = 0;
    while (!ruleFinished(r) && ruleNext(r) < today && guard < GUARD) {
      r.posted += 1;
      guard += 1;
    }
  }
  r.active = active;
  postDue(l, today, newID);
}

/** Every active payment from now until `today + days`, including overdue ones still waiting. */
export function upcoming(rules: Rule[], today: Day, days: number): Occurrence[] {
  const horizon = addDays(today, days);
  const out: Occurrence[] = [];
  for (const r of rules) {
    if (!r.active || ruleFinished(r)) continue;
    for (let g = 0; g < GUARD; g++) {
      if (r.total !== undefined && r.posted + g >= r.total) break;
      const d = step(r.cadence, r.anchor, r.posted + g);
      if (d > horizon) break;
      out.push({ ruleID: r.id, label: r.label, cents: r.cents, category: r.category, day: d, overdue: d <= today, isNext: g === 0 });
    }
  }
  return sortOccurrences(out);
}

export function sortOccurrences(list: Occurrence[]): Occurrence[] {
  return list.sort((a, b) => (a.day === b.day ? a.label.localeCompare(b.label) : a.day < b.day ? -1 : 1));
}

/** Money that was due but hasn't been confirmed (the next one per rule). */
export const waiting = (list: Occurrence[], today: Day) => list.filter((o) => o.isNext && o.day <= today);

// ---------- forecast ----------

export interface Projection {
  today: Day;
  end: Day;
  days: number;
  start: Cents;
  endBalance: Cents;
  points: { day: Day; balance: Cents; events: Occurrence[] }[];
  steps: { occurrence: Occurrence; after: Cents }[];
  hitZero?: Day;
  backAbove?: Occurrence;
  lowDay: Day;
  lowBalance: Cents;
}

export function project(balance: Cents, list: Occurrence[], today: Day, days: number): Projection {
  const end = addDays(today, days);
  const events = sortOccurrences(list.filter((o) => o.day <= end).map((o) => (o.overdue ? { ...o, day: today } : o)));
  let bal = balance;
  const points: Projection["points"] = [{ day: today, balance: balance, events: [] }];
  const steps: Projection["steps"] = [];
  let hitZero: Day | undefined;
  let backAbove: Occurrence | undefined;
  let low = { day: today, balance };
  for (const e of events) {
    const before = bal;
    bal += e.cents;
    steps.push({ occurrence: e, after: bal });
    const last = points[points.length - 1];
    if (points.length > 1 && last.day === e.day) {
      last.balance = bal;
      last.events.push(e);
    } else {
      points.push({ day: e.day, balance: bal, events: [e] });
    }
    if (before >= 0 && bal < 0 && !hitZero) hitZero = e.day;
    if (before < 0 && bal >= 0 && !backAbove) backAbove = e;
    if (bal < low.balance) low = { day: e.day, balance: bal };
  }
  return { today, end, days, start: balance, endBalance: bal, points, steps, hitZero, backAbove, lowDay: low.day, lowBalance: low.balance };
}

export type Runway =
  | { kind: "backAboveOnce"; label: string }
  | { kind: "backAboveOn"; day: Day }
  | { kind: "belowForWholeRange" }
  | { kind: "runsOut"; day: Day }
  | { kind: "lastsPast"; day: Day };

export function runway(p: Projection): Runway {
  if (p.start < 0) {
    if (p.backAbove) return p.backAbove.overdue ? { kind: "backAboveOnce", label: p.backAbove.label } : { kind: "backAboveOn", day: p.backAbove.day };
    return { kind: "belowForWholeRange" };
  }
  if (p.hitZero) return { kind: "runsOut", day: p.hitZero };
  return { kind: "lastsPast", day: p.end };
}

export const runwayWarns = (r: Runway) => r.kind === "belowForWholeRange" || r.kind === "runsOut";

// ---------- insights ----------

export interface CategoryTotal { category: string; cents: Cents; count: number }
export interface Summary { spent: Cents; income: Cents; byCategory: CategoryTotal[]; incomeByCategory: CategoryTotal[] }

/** Spending and money in for a month (or all time when null). The starting balance isn't income. */
export function summary(entries: Entry[], month: YearMonth | null): Summary {
  let spent = 0;
  let income = 0;
  const out = new Map<string, [Cents, number]>();
  const into = new Map<string, [Cents, number]>();
  for (const e of entries) {
    if (e.category === CATEGORY_START || (month && !monthContains(month, e.day))) continue;
    const c = categoryKey(e.category, e.cents);
    if (e.cents > 0) {
      income += e.cents;
      const cur = into.get(c) ?? [0, 0];
      into.set(c, [cur[0] + e.cents, cur[1] + 1]);
    } else {
      spent -= e.cents;
      const cur = out.get(c) ?? [0, 0];
      out.set(c, [cur[0] - e.cents, cur[1] + 1]);
    }
  }
  const rows = (by: Map<string, [Cents, number]>) =>
    [...by].map(([category, [cents, count]]) => ({ category, cents, count }))
      .sort((a, b) => b.cents - a.cents || a.category.localeCompare(b.category));
  return { spent, income, byCategory: rows(out), incomeByCategory: rows(into) };
}

/** Spending this month, for the line under the balance. */
export const spentIn = (entries: Entry[], month: YearMonth) => summary(entries, month).spent;

/** The category most often used with labels starting like `prefix` (so "valo" picks Games). */
export function guessCategory(prefix: string, income: boolean, entries: Entry[], presets: { label: string; category?: string }[]): string | undefined {
  const q = prefix.trim().toLowerCase();
  if (q.length < 3) return undefined;
  const allowed = new Set((income ? INCOME : SPENDING).map((c) => c.id));
  const ok = (c?: string) => c !== undefined && allowed.has(c);
  const fromPreset = presets.find((p) => ok(p.category) && p.label.toLowerCase().startsWith(q));
  if (fromPreset) return fromPreset.category;
  return sortEntries(entries).find((e) => ok(e.category) && e.label.toLowerCase().startsWith(q))?.category;
}

// ---------- checking outside data ----------

const ISO_CURRENCY = /^[A-Z]{3}$/;

/** Check external data (an imported file) before it can replace the saved ledger. */
export function validateLedger(raw: unknown): Ledger {
  const fail = (m: string): never => { throw new Error(m); };
  if (!raw || typeof raw !== "object") fail("This isn't a Pocket file.");
  const l = raw as Ledger;
  if (l.version !== 1) fail("This file uses an unsupported Pocket version.");
  if (typeof l.currency !== "string" || !ISO_CURRENCY.test(l.currency)) fail("This file has an unrecognized currency.");
  if (!Array.isArray(l.entries) || !Array.isArray(l.rules) || !Array.isArray(l.presets)) fail("This isn't a Pocket file.");
  const unique = (xs: { id: string }[]) => new Set(xs.map((x) => x.id)).size === xs.length;
  if (!unique(l.entries) || !unique(l.rules) || !unique(l.presets)) fail("This file contains duplicate identifiers.");
  const amount = (c: unknown) => Number.isInteger(c) && Math.abs(c as number) <= 99_999_999_999;
  for (const e of l.entries) {
    if (typeof e.id !== "string" || !amount(e.cents) || typeof e.label !== "string" || !isDay(e.day)) fail("This file contains an amount or date Pocket can't read.");
  }
  for (const r of l.rules) {
    if (typeof r.id !== "string" || !amount(r.cents) || !isDay(r.anchor) || !["weekly", "biweekly", "monthly", "yearly"].includes(r.cadence)) {
      fail("This file contains an invalid payment schedule.");
    }
    const count = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 1_000_000;
    if (!count(r.posted) || (r.total != null && (!count(r.total) || r.posted > r.total))) {
      fail("This file contains an invalid payment schedule.");
    }
  }
  for (const p of l.presets) {
    if (p.sign !== 1 && p.sign !== -1) fail("This file contains an invalid quick-add direction.");
    if (p.cents != null && !(amount(p.cents) && p.cents > 0)) fail("This file contains an invalid quick-add amount.");
  }
  // Swift writes no key for nil; JSON from elsewhere may carry nulls. Normalize to missing.
  const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null)) as T;
  return {
    version: 1,
    currency: l.currency,
    entries: l.entries.map(clean),
    rules: l.rules.map((r) => clean({ ...r, active: r.active !== false, auto: r.auto !== false })),
    presets: l.presets.map(clean),
  };
}
