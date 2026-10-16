import type { RuleView } from "../models";
import { REMINDER_HOUR, reminderPlans } from "../reminders";

const rule = (r: Partial<RuleView>): RuleView => ({
  id: "R", cents: 75_000, label: "Client", cadence: "monthly", next: "2026-10-20", once: false, active: true, auto: false, ...r,
});
const at = (day: string, hour: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, hour);
};

test("reminds at 10 AM on the due day, only for money that waits for confirmation", () => {
  const plans = reminderPlans([
    rule({ id: "A" }),
    rule({ id: "B", auto: true }),
    rule({ id: "C", active: false }),
    rule({ id: "D", remaining: 0 }),
    rule({ id: "E", cents: -145_000, label: "Rent", next: "2026-10-18" }),
  ], at("2026-10-16", 9));
  expect(plans.map((p) => p.ruleID)).toEqual(["E", "A"]);
  expect(plans[0].date).toEqual(at("2026-10-18", REMINDER_HOUR));
  expect(plans[0].title).toBe("Was Rent paid?");
  expect(plans[1].title).toBe("Did Client pay?");
  expect(plans[1].identifier).toBe("pocket.A.2026-10-20");
});

test("doesn't catch up on reminders whose time already passed", () => {
  expect(reminderPlans([rule({ next: "2026-10-16" })], at("2026-10-16", 9))).toHaveLength(1);
  expect(reminderPlans([rule({ next: "2026-10-16" })], at("2026-10-16", 11))).toHaveLength(0);
  expect(reminderPlans([rule({ next: "2026-10-10" })], at("2026-10-16", 9))).toHaveLength(0);
});

test("a new due date means a new reminder", () => {
  const before = reminderPlans([rule({ next: "2026-10-20" })], at("2026-10-16", 9))[0];
  const after = reminderPlans([rule({ next: "2026-11-20" })], at("2026-10-16", 9))[0];
  expect(before.identifier).not.toBe(after.identifier);
});
