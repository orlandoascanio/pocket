// Searching History and exporting it as a spreadsheet, ported from PocketCore/History.swift.
import { CATEGORY_START, categoryKey, categoryName } from "./categories";
import { addDays, makeDay, parts, shiftMonth, yearMonth, type Day, type YearMonth } from "./day";
import { sortEntries } from "./engine";
import type { Entry } from "./models";
import { editString, type Cents } from "./money";

export type EntryKind = "all" | "spending" | "income";
export const KIND_NAME: Record<EntryKind, string> = { all: "In and out", spending: "Spending", income: "Money in" };

/** Quick date ranges, counted from today. */
export type Period = "thisMonth" | "lastMonth" | "last3Months" | "thisYear";
export const PERIODS: Period[] = ["thisMonth", "lastMonth", "last3Months", "thisYear"];
export const PERIOD_NAME: Record<Period, string> = {
  thisMonth: "This month", lastMonth: "Last month", last3Months: "Last 3 months", thisYear: "This year",
};

export function periodRange(p: Period, today: Day): { from: Day; to: Day } {
  const first = (ym: YearMonth) => ym + "-01";
  const ym = yearMonth(today);
  switch (p) {
    case "thisMonth": return { from: first(ym), to: today };
    case "lastMonth": return { from: first(shiftMonth(ym, -1)), to: addDays(first(ym), -1) };
    case "last3Months": return { from: first(shiftMonth(ym, -2)), to: today };
    case "thisYear": return { from: makeDay(parts(today)[0], 1, 1), to: today };
  }
}

/** What History shows: words to look for, money in or out, a category and a date range. */
export interface EntryQuery {
  text: string;
  kind: EntryKind;
  /** A category key (see `categoryKey`), so uncategorized money matches Other. */
  category?: string;
  from?: Day;
  to?: Day;
}

export const EMPTY_QUERY: EntryQuery = { text: "", kind: "all" };

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const words = (q: EntryQuery) => fold(q.text).split(/\s+/).filter(Boolean);

export const queryIsEmpty = (q: EntryQuery) =>
  words(q).length === 0 && q.kind === "all" && q.category === undefined && q.from === undefined && q.to === undefined;

/** The quick range this matches exactly, if any. */
export function queryPeriod(q: EntryQuery, today: Day): Period | undefined {
  return PERIODS.find((p) => { const r = periodRange(p, today); return r.from === q.from && r.to === q.to; });
}

/** Every word has to appear in the label, the category's name or the amount ("9.99"). */
export function matches(q: EntryQuery, e: Entry): boolean {
  if (q.from !== undefined && e.day < q.from) return false;
  if (q.to !== undefined && e.day > q.to) return false;
  if (q.kind === "spending" && (e.cents >= 0 || e.category === CATEGORY_START)) return false;
  if (q.kind === "income" && (e.cents <= 0 || e.category === CATEGORY_START)) return false;
  if (q.category !== undefined && categoryKey(e.category, e.cents) !== q.category) return false;
  const ws = words(q);
  if (!ws.length) return true;
  const haystack = fold([e.label, e.category ? categoryName(e.category) : "", editString(e.cents)].join(" "));
  return ws.every((w) => haystack.includes(w));
}

/** History that matches, newest first. */
export const search = (entries: Entry[], q: EntryQuery) => sortEntries(entries).filter((e) => matches(q, e));

// ---------- spreadsheet ----------

const amount = (cents: Cents) =>
  (cents < 0 ? "-" : "") + Math.floor(Math.abs(cents) / 100) + "." + String(Math.abs(cents) % 100).padStart(2, "0");

/** Quotes a value when it needs it, and keeps spreadsheets from running text as a formula. */
function text(value: string): string {
  let s = value;
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Oldest first, one row per entry. Amounts are plain numbers (negative = spent) so spreadsheets can add them up. */
export function entriesCSV(entries: Entry[], currency: string): string {
  const rows = ["Date,Description,Category,Amount,Currency,Type,Scheduled"];
  const oldestFirst = [...entries].sort((a, b) => (a.day === b.day ? (a.created < b.created ? -1 : a.created > b.created ? 1 : 0) : a.day < b.day ? -1 : 1));
  for (const e of oldestFirst) {
    const type = e.category === CATEGORY_START ? "Starting balance" : e.cents < 0 ? "Spent" : "Money in";
    rows.push([e.day, text(e.label), text(e.category ? categoryName(e.category) : ""), amount(e.cents), currency, type, e.ruleID ? "Yes" : "No"].join(","));
  }
  // The byte order mark tells Excel the file is UTF-8, so names with accents open correctly.
  return "﻿" + rows.join("\r\n") + "\r\n";
}
