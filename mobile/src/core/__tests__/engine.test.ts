// Ported from Pocket for Mac's EngineTests.swift so both apps agree on the money logic.
import { CATEGORY_START } from "../categories";
import { addMonths, daysBetween, isDay } from "../day";
import * as engine from "../engine";
import { lineForChange } from "../lines";
import { ruleFinished, ruleNext, step, type Entry, type Ledger, type Preset, type Rule } from "../models";
import { Money, parseMoney } from "../money";

let n = 0;
const id = () => `ID-${++n}`;
const ledger = (currency = "USD"): Ledger => ({ version: 1, currency, entries: [], rules: [], presets: [] });
const entry = (cents: number, label: string, day: string, category?: string): Entry =>
  ({ id: id(), cents, label, day, ...(category ? { category } : {}), created: "2026-10-11T12:00:00Z" });
const rule = (r: Partial<Rule> & Pick<Rule, "cents" | "label" | "cadence" | "anchor">): Rule =>
  ({ id: id(), posted: 0, active: true, auto: true, created: "2026-10-11T12:00:00Z", ...r });
const addRule = (l: Ledger, r: Rule, today: string) => { l.rules.push(r); engine.postDue(l, today, id); };
const balance = (l: Ledger) => engine.balanceOf(l.entries);

test("day math clamps month ends", () => {
  expect(step("monthly", "2026-01-31", 1)).toBe("2026-02-28");
  expect(step("monthly", "2026-01-31", 2)).toBe("2026-03-31");
  expect(step("yearly", "2028-02-29", 1)).toBe("2029-02-28");
  expect(step("biweekly", "2026-10-17", 1)).toBe("2026-10-31");
  expect(daysBetween("2026-10-11", "2026-10-20")).toBe(9);
  expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
});

test("balance and entries", () => {
  const l = ledger();
  l.entries.push(entry(24_100, "Start", "2026-10-01", CATEGORY_START), entry(-999, "Game", "2026-10-02", "games"));
  expect(balance(l)).toBe(23_101);
  l.entries = l.entries.filter((e) => e.label !== "Game");
  expect(balance(l)).toBe(24_100);
});

test("automatic rule logs due dates and stops after its total", () => {
  const l = ledger();
  addRule(l, rule({ cents: -500, label: "Month end", cadence: "monthly", anchor: "2026-01-31", total: 3, category: "bills" }), "2026-04-15");
  expect(l.entries.map((e) => e.day).sort()).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  engine.postDue(l, "2026-12-31", id);
  expect(l.entries).toHaveLength(3);
  expect(ruleFinished(l.rules[0])).toBe(true);
  expect(l.entries[0].category).toBe("bills");
});

test("income that waits for confirmation", () => {
  const l = ledger();
  addRule(l, rule({ cents: 75_000, label: "Client", cadence: "monthly", anchor: "2026-10-05", auto: false }), "2026-10-11");
  expect(l.entries).toHaveLength(0);
  const waiting = engine.waiting(engine.upcoming(l.rules, "2026-10-11", 366), "2026-10-11");
  expect(waiting).toHaveLength(1);
  expect(waiting[0].overdue).toBe(true);

  const rid = l.rules[0].id;
  engine.settle(l, rid, 70_000, "2026-10-09", "2026-10-11", id);
  expect(balance(l)).toBe(70_000);
  expect(l.entries[0].day).toBe("2026-10-09");
  expect(l.rules[0].cents).toBe(75_000);
  expect(ruleNext(l.rules[0])).toBe("2026-11-05");
  expect(engine.waiting(engine.upcoming(l.rules, "2026-10-11", 366), "2026-10-11")).toHaveLength(0);

  engine.skip(l, rid);
  expect(ruleNext(l.rules[0])).toBe("2026-12-05");
  expect(l.entries).toHaveLength(1);
});

test("pause doesn't log, and resume doesn't back-log", () => {
  const l = ledger();
  addRule(l, rule({ cents: -2_000, label: "Sub", cadence: "monthly", anchor: "2026-10-01" }), "2026-10-11");
  const rid = l.rules[0].id;
  engine.setActive(l, rid, false, "2026-10-11", id);
  engine.postDue(l, "2027-01-15", id);
  expect(l.entries).toHaveLength(1);
  engine.setActive(l, rid, true, "2027-01-15", id);
  expect(l.entries).toHaveLength(1);
  expect(ruleNext(l.rules[0])).toBe("2027-02-01");
});

test("editing a rule re-anchors only when the schedule changes", () => {
  const l = ledger();
  addRule(l, rule({ cents: 75_000, label: "Client", cadence: "monthly", anchor: "2026-09-20", total: 3 }), "2026-10-11");
  expect(l.entries).toHaveLength(1);
  const rid = l.rules[0].id;
  engine.updateRule(l, rid, { cents: 80_000, label: "Client A", cadence: "monthly", next: "2026-10-20", left: 1, category: "pay", auto: true }, "2026-10-11", id);
  expect(l.rules[0].total! - l.rules[0].posted).toBe(1);
  expect(ruleNext(l.rules[0])).toBe("2026-10-20");
  engine.updateRule(l, rid, { cents: 80_000, label: "Client A", cadence: "monthly", next: "2026-10-25", left: 2, category: "pay", auto: true }, "2026-10-11", id);
  expect(ruleNext(l.rules[0])).toBe("2026-10-25");
  expect(l.rules[0].total! - l.rules[0].posted).toBe(2);
});

test("upcoming respects limits and the horizon", () => {
  const l = ledger();
  addRule(l, rule({ cents: 75_000, label: "Freelance", cadence: "monthly", anchor: "2026-09-20", total: 3 }), "2026-10-11");
  addRule(l, rule({ cents: 30_000, label: "Expected", cadence: "monthly", anchor: "2026-10-18", total: 1 }), "2026-10-11");
  const up = engine.upcoming(l.rules, "2026-10-11", 120);
  expect(up.map((o) => o.label)).toEqual(["Expected", "Freelance", "Freelance"]);
  expect(up.filter((o) => o.isNext)).toHaveLength(2);
  expect(balance(l)).toBe(75_000);
});

test("runway", () => {
  const l = ledger();
  l.entries.push(entry(-5_908, "Spent", "2026-10-01"));
  addRule(l, rule({ cents: 75_000, label: "Client", cadence: "monthly", anchor: "2026-10-05", auto: false }), "2026-10-11");
  const p1 = engine.project(balance(l), engine.upcoming(l.rules, "2026-10-11", 366), "2026-10-11", 91);
  expect(engine.runway(p1)).toEqual({ kind: "backAboveOnce", label: "Client" });

  const m = ledger();
  m.entries.push(entry(5_000, "Cash", "2026-10-01"));
  addRule(m, rule({ cents: -2_000, label: "Sub", cadence: "monthly", anchor: "2026-10-20" }), "2026-10-11");
  const p2 = engine.project(balance(m), engine.upcoming(m.rules, "2026-10-11", 366), "2026-10-11", 91);
  expect(engine.runway(p2)).toEqual({ kind: "runsOut", day: "2026-12-20" });
  expect(p2.endBalance).toBe(5_000 - 3 * 2_000);
  expect(engine.runwayWarns(engine.runway(p2))).toBe(true);

  const p3 = engine.project(5_000, [], "2026-10-11", 30);
  expect(engine.runway(p3)).toEqual({ kind: "lastsPast", day: "2026-11-10" });
});

test("summary leaves out the starting balance", () => {
  const entries = [
    entry(24_100, "Start", "2026-10-01", CATEGORY_START),
    entry(-1_499, "DST", "2026-10-02", "games"),
    entry(-999, "Valorant", "2026-10-03", "games"),
    entry(-4_000, "Internet", "2026-10-04", "bills"),
    entry(-2_000, "Old", "2026-09-04", "subscriptions"),
    entry(10_000, "Gift", "2026-10-05", "gift"),
  ];
  const oct = engine.summary(entries, "2026-10");
  expect(oct.spent).toBe(6_498);
  expect(oct.income).toBe(10_000);
  expect(oct.byCategory.map((r) => r.category)).toEqual(["bills", "games"]);
  expect(oct.byCategory[1].count).toBe(2);
  expect(engine.summary(entries, null).spent).toBe(8_498);
});

test("guesses a category from the start of a label", () => {
  const entries = [entry(-999, "Valorant", "2026-10-03", "games")];
  const presets: Preset[] = [];
  expect(engine.guessCategory("valo", false, entries, presets)).toBe("games");
  expect(engine.guessCategory("va", false, entries, presets)).toBeUndefined();
  expect(engine.guessCategory("valo", true, entries, presets)).toBeUndefined();
});

test("parses and formats money", () => {
  expect(parseMoney("9.99")).toBe(999);
  expect(parseMoney("9,99")).toBe(999);
  expect(parseMoney("$1,234.50")).toBe(123_450);
  expect(parseMoney("1.234,50")).toBe(123_450);
  expect(parseMoney("750")).toBe(75_000);
  expect(parseMoney("0")).toBeNull();
  expect(parseMoney("abc")).toBeNull();
  const usd = new Money("USD");
  expect(usd.string(-5_908)).toMatch(/^-\$59\.08$/);
  expect(usd.string(75_000, true)).toBe("+$750.00");
  expect(usd.whole(75_049)).toBe("$750");
});

test("rejects malformed amounts instead of changing their meaning", () => {
  for (const text of ["abc12", "12abc", "1$2", "1-2", "--12", "9..99", "1,23,456", "12.3456", ".", ",", "1000000000"]) {
    expect([text, parseMoney(text, true)]).toEqual([text, null]);
  }
  expect(parseMoney(".05")).toBe(5);
  expect(parseMoney("+12.50")).toBe(1250);
  expect(parseMoney("1,234,567.89")).toBe(123456789);
  expect(parseMoney("1.234.567,89")).toBe(123456789);
  expect(parseMoney("999999999.99")).toBe(99999999999);
  expect(parseMoney("0.00", true)).toBe(0);
  expect(parseMoney("0.00")).toBeNull();
  expect(new Money("JPY").string(12345)).toContain("123.45");
});

test("rejects days that don't exist", () => {
  for (const d of ["2026-02-29", "2026-04-31", "2026-00-01", "2026--10-01", "2026-1-01", "0000-01-01", "2026-10-01-extra"]) {
    expect([d, isDay(d)]).toEqual([d, false]);
  }
  expect(isDay("2028-02-29")).toBe(true);
});

test("checks outside data before it can replace the ledger", () => {
  const e = entry(1000, "Start", "2026-10-12");
  const base = ledger();
  expect(() => engine.validateLedger({ ...base, entries: [e, e] })).toThrow();
  expect(() => engine.validateLedger({ ...base, entries: [{ ...e, cents: Number.MIN_SAFE_INTEGER }] })).toThrow();
  expect(() => engine.validateLedger({ ...base, entries: [{ ...e, day: "2026-02-30" }] })).toThrow();
  expect(() => engine.validateLedger({ ...base, rules: [rule({ cents: 100, label: "x", cadence: "monthly", anchor: e.day, posted: -1 })] })).toThrow();
  expect(() => engine.validateLedger({ ...base, presets: [{ id: "p", label: "x", cents: -100, sign: -1 }] })).toThrow();
  expect(() => engine.validateLedger({ ...base, version: 2 })).toThrow();
  expect(() => engine.validateLedger({ ...base, entries: [e] })).not.toThrow();
});

test("reads a ledger written by Pocket for Mac (nil keys left out, uppercase UUIDs)", () => {
  const mac = {
    currency: "EUR", version: 1,
    entries: [{ cents: -999, category: "games", created: "2026-10-11T09:30:00Z", day: "2026-10-03", id: "6F1C9A0E-0B4B-4B3E-9C59-3A3F2B1D6E01", label: "Game" }],
    presets: [{ cents: 999, category: "games", id: "6F1C9A0E-0B4B-4B3E-9C59-3A3F2B1D6E02", label: "Valorant", sign: -1 }],
    rules: [{ active: true, anchor: "2026-11-05", auto: false, cadence: "monthly", cents: 75000, created: "2026-10-11T09:30:00Z", id: "6F1C9A0E-0B4B-4B3E-9C59-3A3F2B1D6E03", label: "Client", posted: 0 }],
  };
  const l = engine.validateLedger(JSON.parse(JSON.stringify(mac)));
  expect(l.currency).toBe("EUR");
  expect(l.rules[0].total).toBeUndefined();
  expect(engine.upcoming(l.rules, "2026-10-11", 60).map((o) => o.day)).toEqual(["2026-11-05", "2026-12-05"]);
});

test("the pocket's lines fit the change", () => {
  expect(typeof lineForChange(20_000)).toBe("string");
  expect(["Money back!", "Refund secured", "It came back home"]).toContain(lineForChange(500, "refund"));
});
