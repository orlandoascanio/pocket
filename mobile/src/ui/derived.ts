import { useMemo } from "react";
import { shortDay, yearMonth } from "../core/day";
import { project, runway, runwayWarns, spentIn, type Projection, type Runway } from "../core/engine";
import type { Money } from "../core/money";
import { usePocket, type Range } from "../data/store";

export const RANGE_NAME: Record<Range, string> = { 30: "month", 91: "3 months", 182: "6 months", 365: "year" };
export const RANGE_SHORT: Record<Range, string> = { 30: "1M", 91: "3M", 182: "6M", 365: "1Y" };

export function useProjection(range?: Range): Projection {
  const s = usePocket();
  const days = range ?? s.range;
  return useMemo(() => project(s.balance, s.upcoming, s.today, days), [s.balance, s.upcoming, s.today, days]);
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
