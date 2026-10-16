// Which reminders to schedule, the same way Pocket for Mac does (PaymentReminders.swift): one per payment that
// waits for confirmation, at 10 AM on its due day.
import { dayOf, parts, type Day } from "./day";
import type { RuleView } from "./models";

export const REMINDER_HOUR = 10;
export const REMINDER_PREFIX = "pocket.";

export interface ReminderPlan {
  /** Changes when the next due date does, so a settled or skipped payment's reminder is replaced. */
  identifier: string;
  ruleID: string;
  day: Day;
  date: Date;
  title: string;
  body: string;
}

export const reminderTitle = (r: Pick<RuleView, "cents" | "label">) => (r.cents > 0 ? `Did ${r.label} pay?` : `Was ${r.label} paid?`);
export const REMINDER_BODY = "Open Pocket to log it, with the real amount if it changed.";

/** Reminders still ahead of `now`. Times already passed aren't caught up: Overview shows those as waiting. */
export function reminderPlans(rules: RuleView[], now: Date): ReminderPlan[] {
  const today = dayOf(now);
  return rules
    .filter((r) => r.active && !r.auto && r.remaining !== 0 && r.next >= today)
    .map((r) => {
      const [y, m, d] = parts(r.next);
      return {
        identifier: `${REMINDER_PREFIX}${r.id}.${r.next}`,
        ruleID: r.id,
        day: r.next,
        date: new Date(y, m - 1, d, REMINDER_HOUR),
        title: reminderTitle(r),
        body: REMINDER_BODY,
      };
    })
    .filter((p) => p.date > now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
