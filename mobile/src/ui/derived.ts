import { useMemo } from "react";
import { shortDay, yearMonth } from "../core/day";
import { everydaySpending, monthsLeft, project, runway, runwayWarns, spentIn, type EverydaySpending, type Projection, type Runway } from "../core/engine";
import type { Money } from "../core/money";
import { usePocket, type Range } from "../data/store";

export const RANGE_NAME: Record<Range, string> = { 30: "month", 91: "3 months", 182: "6 months", 365: "year" };
export const RANGE_SHORT: Record<Range, string> = { 30: "1M", 91: "3M", 182: "6M", 365: "1Y" };

/** What's usually spent on unscheduled things, from recent weeks of history. */
export function useEveryday(): EverydaySpending | null {
  const entries = usePocket((s) => s.entries);
  const today = usePocket((s) => s.today);
  return useMemo(() => everydaySpending(entries, today), [entries, today]);
}

/** Everyday spending the forecast counts, in cents a day. */
export function useForecastEveryday(): number {
  const e = useEveryday();
  const include = usePocket((s) => s.includeEveryday);
  return include && e ? e.perDay : 0;
}

export function useProjection(range?: Range): Projection {
  const s = usePocket();
  const everyday = useForecastEveryday();
  const days = range ?? s.range;
  return useMemo(() => project(s.balance, s.upcoming, s.today, days, everyday), [s.balance, s.upcoming, s.today, days, everyday]);
}

/** Roughly how many months the money lasts at the usual pace. */
export function useMonthsLeft(): number | null {
  const s = usePocket();
  const everyday = useForecastEveryday();
  return useMemo(
    () => monthsLeft(s.balance, everyday, s.rules.filter((r) => r.active && !r.once)),
    [s.balance, s.rules, everyday],
  );
}

/** "About 7 months of money at your usual pace." */
export function monthsLeftText(months: number): string {
  const pace = "of money at your usual pace";
  if (months < 1) return `Less than a month ${pace}`;
  if (months < 24) { const n = Math.round(months); return `About ${n} month${n === 1 ? "" : "s"} ${pace}`; }
  return `About ${Math.floor(months / 12)} years ${pace}`;
}

export function runwayText(r: Runway, money: Money, range: Range): { lead: string; strong: string; warn: boolean } {
  const zero = money.whole(0);
  switch (r.kind) {
    case "backAboveOnce": return { lead: `Back above ${zero} once`, strong: `${r.label} pays`, warn: false };
    case "backAboveOn": return { lead: `Back above ${zero} on`, strong: shortDay(r.day), warn: false };
    case "belowForWholeRange": return { lead: `Below ${zero} for the next`, strong: RANGE_NAME[range], warn: true };
    case "runsOut": return { lead: "Runs out on", strong: shortDay(r.day), warn: true };
    case "lastsPast": return { lead: "Lasts past", strong: shortDay(r.day), warn: false };
  }
}

export function useRunway(money: Money) {
  const range = usePocket((s) => s.range);
  const p = useProjection();
  const r = runway(p);
  return { ...runwayText(r, money, range), warn: runwayWarns(r), projection: p };
}

export function useSpentThisMonth(): number {
  const entries = usePocket((s) => s.entries);
  const today = usePocket((s) => s.today);
  return useMemo(() => spentIn(entries, yearMonth(today)), [entries, today]);
}
