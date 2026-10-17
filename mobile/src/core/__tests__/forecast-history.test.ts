// Mirrors Pocket for Mac's ForecastAndHistoryTests.swift, so both apps agree.
import { CATEGORY_START } from "../categories";
import * as engine from "../engine";
import { entriesCSV, periodRange, queryIsEmpty, queryPeriod, search, EMPTY_QUERY, type EntryQuery } from "../history";
import { step, type Entry, type Ledger, type Rule } from "../models";

let n = 0;
const id = () => `ID-${++n}`;
const ledger = (): Ledger => ({ version: 1, currency: "USD", entries: [], rules: [], presets: [] });
const entry = (cents: number, label: string, day: string, extra: Partial<Entry> = {}): Entry =>
  ({ id: id(), cents, label, day, created: "2026-10-11T12:00:00Z", ...extra });
const rule = (r: Partial<Rule> & Pick<Rule, "cents" | "label" | "cadence" | "anchor">): Rule =>
  ({ id: id(), posted: 0, active: true, auto: true, created: "2026-10-11T12:00:00Z", ...r });

test("quarterly counts three months from the anchor", () => {
  expect(step("quarterly", "2025-11-30", 1)).toBe("2026-02-28");
  expect(step("quarterly", "2025-11-30", 2)).toBe("2026-05-30");
  expect(step("quarterly", "2025-11-30", 4)).toBe("2026-11-30");
  const l = ledger();
  l.rules.push(rule({ cents: -3_000, label: "Insurance", cadence: "quarterly", anchor: "2025-11-30" }));
  engine.postDue(l, "2026-06-01", id);
  expect(l.entries.map((e) => e.day).sort()).toEqual(["2025-11-30", "2026-02-28", "2026-05-30"]);
  expect(engine.validateLedger(JSON.parse(JSON.stringify(l))).rules[0].cadence).toBe("quarterly");
  expect(() => engine.validateLedger({ ...l, rules: [{ ...l.rules[0], cadence: "toString" }] })).toThrow();
});

test("everyday spending is the median week of unscheduled spending", () => {
  const l = ledger();
  l.entries.push(entry(100_000, "Starting balance", "2026-09-01", { category: CATEGORY_START }));
  l.entries.push(entry(-10_000, "Before the window", "2026-09-02"));
  for (const [cents, d] of [[-2_000, "2026-10-14"], [-1_500, "2026-10-10"], [-3_000, "2026-10-03"], [-150_000, "2026-09-25"],
    [-4_000, "2026-09-20"], [-2_500, "2026-09-12"], [-3_200, "2026-09-05"]] as const) {
    l.entries.push(entry(cents, "Spent", d, { category: "food" }));
  }
  l.entries.push(entry(-9_000, "Rent", "2026-09-28", { ruleID: "R" }));
  l.entries.push(entry(50_000, "Pay", "2026-10-01", { category: "pay" }));
  l.entries.push(entry(-700, "Today", "2026-10-15"));
  expect(engine.everydaySpending(l.entries, "2026-10-15")).toEqual({ weekly: 3_350, weeks: 6, perDay: 479 });
  expect(engine.everydaySpending([entry(-500, "Snack", "2026-10-05")], "2026-10-15")).toBeNull();
});

test("everyday spending slopes the forecast and moves the runway", () => {
  const l = ledger();
  l.entries.push(entry(10_000, "Cash", "2026-10-01"));
  l.rules.push(rule({ cents: -5_000, label: "Bill", cadence: "monthly", anchor: "2026-10-05" }));
  engine.postDue(l, "2026-10-01", id);
  const list = engine.upcoming(l.rules, "2026-10-01", 366);

  const plain = engine.project(10_000, list, "2026-10-01", 30);
  expect(plain.endBalance).toBe(5_000);
  expect(engine.runway(plain)).toEqual({ kind: "lastsPast", day: "2026-10-31" });

  const p = engine.project(10_000, list, "2026-10-01", 30, 1_000);
  expect(p.everyday).toBe(1_000);
  expect(p.points.length).toBe(2);
  expect(p.points[1].before).toBe(6_000);
  expect(p.points[1].balance).toBe(1_000);
  expect(p.steps[0].after).toBe(1_000);
  expect(p.endBalance).toBe(-25_000);
  expect(engine.runway(p)).toEqual({ kind: "runsOut", day: "2026-10-07" });
  expect(p.lowBalance).toBe(-25_000);
  expect(p.lowDay).toBe("2026-10-31");
});

test("months left at the usual pace", () => {
  expect(engine.monthsLeft(10_000, 0, [{ cents: -5_000, cadence: "monthly" }, { cents: 2_000, cadence: "monthly" }])).toBeCloseTo(10 / 3, 4);
  expect(engine.monthsLeft(10_000, 100, [{ cents: -3_000, cadence: "quarterly" }])).toBeCloseTo(10_000 / ((100 * 365.25) / 12 + 1_000), 4);
  expect(engine.monthsLeft(10_000, 0, [{ cents: -1_000, cadence: "monthly" }, { cents: 2_000, cadence: "monthly" }])).toBeNull();
  expect(engine.monthsLeft(0, 500, [])).toBeNull();
});

const searchEntries = (): Entry[] => [
  entry(5_000, "Starting balance", "2026-09-01", { category: CATEGORY_START }),
  entry(-380, "Café Olé", "2026-09-20", { category: "food" }),
  entry(200_000, "Paycheck", "2026-10-01", { category: "pay" }),
  entry(-999, "Valorant points", "2026-10-02", { category: "games" }),
  entry(-1_234, "Thing", "2026-10-05"),
  entry(-450, "Coffee", "2026-10-10", { category: "food" }),
];

test("search matches labels, categories and amounts", () => {
  const all = searchEntries();
  const labels = (q: Partial<EntryQuery>) => search(all, { ...EMPTY_QUERY, ...q }).map((e) => e.label);
  expect(labels({ text: "cafe" })).toEqual(["Café Olé"]);
  expect(labels({ text: "food 4" })).toEqual(["Coffee"]);
  expect(labels({ text: "12.34" })).toEqual(["Thing"]);
  expect(labels({ kind: "income" })).toEqual(["Paycheck"]);
  expect(labels({ kind: "spending" })).toEqual(["Coffee", "Thing", "Valorant points", "Café Olé"]);
  expect(labels({ category: "other" })).toEqual(["Thing"]);
  expect(labels({ from: "2026-10-01", to: "2026-10-31" }).length).toBe(4);
  expect(queryIsEmpty({ ...EMPTY_QUERY, text: "  " })).toBe(true);
});

test("quick date ranges", () => {
  const today = "2026-03-15";
  expect(periodRange("lastMonth", today)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  expect(periodRange("last3Months", today)).toEqual({ from: "2026-01-01", to: today });
  expect(periodRange("thisYear", today)).toEqual({ from: "2026-01-01", to: today });
  expect(queryPeriod({ ...EMPTY_QUERY, ...periodRange("lastMonth", today) }, today)).toBe("lastMonth");
});

test("CSV quotes text and keeps formulas out", () => {
  const entries = [
    entry(300, "=SUM(A1)", "2026-09-03", { ruleID: "R" }),
    entry(5_000, "Starting balance", "2026-09-01", { category: CATEGORY_START }),
    entry(-1_250, 'Lunch, with "Sam"', "2026-09-02", { category: "food" }),
  ];
  expect(entriesCSV(entries, "USD")).toBe(
    "﻿Date,Description,Category,Amount,Currency,Type,Scheduled\r\n"
    + "2026-09-01,Starting balance,Starting balance,50.00,USD,Starting balance,No\r\n"
    + '2026-09-02,"Lunch, with ""Sam""",Food,-12.50,USD,Spent,No\r\n'
    + "2026-09-03,'=SUM(A1),,3.00,USD,Money in,Yes\r\n",
  );
});
