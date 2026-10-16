// Payment reminders: local notifications for money that waits for confirmation (see core/reminders.ts).
// Off until the person turns them on in Settings, which is also when Pocket asks for permission.
import * as Notifications from "expo-notifications";
import { AndroidImportance, IosAuthorizationStatus } from "expo-notifications";
import { useSyncExternalStore } from "react";
import { Linking, Platform } from "react-native";
import { REMINDER_BODY, REMINDER_PREFIX, reminderPlans } from "../core/reminders";
import { store } from "./store";
import { getItem, setItem } from "./storage";

const ENABLED_KEY = "pocket.reminders";
const CHANNEL = "reminders";
const supported = Platform.OS !== "web";

export interface ReminderState {
  enabled: boolean;
  /** Notifications are blocked for Pocket in the system settings. */
  blocked: boolean;
}

let state: ReminderState = { enabled: false, blocked: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<ReminderState>) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};

export function useReminders(): ReminderState {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    () => state,
    () => state,
  );
}

async function allowed(ask: boolean): Promise<boolean> {
  if (Platform.OS === "android") {
    // Android 13+ only shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Payment reminders",
      importance: AndroidImportance.DEFAULT,
    });
  }
  let p = await Notifications.getPermissionsAsync();
  if (!p.granted && p.canAskAgain && ask) p = await Notifications.requestPermissionsAsync();
  const ok = p.granted || p.ios?.status === IosAuthorizationStatus.PROVISIONAL;
  set({ blocked: !ok });
  return ok;
}

let running: Promise<void> | null = null;
let again = false;

/** Make the scheduled reminders match the money right now. Safe to call often. */
export function syncReminders(): Promise<void> {
  if (!supported) return Promise.resolve();
  if (running) { again = true; return running; }
  running = (async () => {
    do {
      again = false;
      try {
        await syncOnce();
      } catch {
        // A failed schedule must never get in the way of the money; the next change tries again.
      }
    } while (again);
  })().finally(() => { running = null; });
  return running;
}

async function syncOnce() {
  const scheduled = (await Notifications.getAllScheduledNotificationsAsync())
    .filter((n) => n.identifier.startsWith(REMINDER_PREFIX));
  const s = store.get();
  const wanted = state.enabled && s.ready && s.onboarded && (await allowed(false)) ? reminderPlans(s.rules, new Date()) : [];
  const keep = new Set(wanted.map((p) => p.identifier));
  for (const n of scheduled) {
    if (!keep.has(n.identifier)) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
  const have = new Set(scheduled.map((n) => n.identifier));
  // iOS keeps at most 64 pending notifications per app; the soonest matter most.
  for (const p of wanted.slice(0, 60)) {
    if (have.has(p.identifier)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: p.identifier,
      content: { title: p.title, body: p.body, sound: true, data: { url: `/settle?id=${p.ruleID}` } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date, channelId: CHANNEL },
    });
  }
}

/** Turn reminders on or off. Turning them on asks for permission; false = the system said no. */
export async function setRemindersEnabled(on: boolean): Promise<boolean> {
  if (on && !(await allowed(true))) {
    set({ enabled: false });
    await setItem(ENABLED_KEY, null);
    return false;
  }
  set({ enabled: on });
  await setItem(ENABLED_KEY, on ? "1" : null);
  await syncReminders();
  return true;
}

/** A reminder in five seconds, to check that notifications reach this phone. */
export async function sendTestReminder(): Promise<boolean> {
  if (!(await allowed(true))) return false;
  // Uses a real payment you're waiting for when there is one, so tapping it opens "Got it" like a real reminder.
  const next = reminderPlans(store.get().rules, new Date(0))[0];
  await Notifications.scheduleNotificationAsync({
    identifier: "pocket-test-reminder",
    content: next
      ? { title: next.title, body: REMINDER_BODY, sound: true, data: { url: `/settle?id=${next.ruleID}` } }
      : { title: "Was Rent paid?", body: REMINDER_BODY, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
  return true;
}

export const openSystemSettings = () => Linking.openSettings();

/** Start once at launch: show reminders that arrive while Pocket is open, and keep the schedule current. */
export async function startReminders(): Promise<() => void> {
  if (!supported) return () => {};
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  set({ enabled: (await getItem(ENABLED_KEY)) === "1" });
  let last = "";
  const unsubscribe = store.subscribe(() => {
    const s = store.get();
    // Only what decides the schedule; most changes (a coffee) don't touch it.
    const sig = JSON.stringify([s.ready, s.onboarded, s.today, s.rules.map((r) => [r.id, r.next, r.auto, r.active, r.remaining, r.label, r.cents])]);
    if (sig === last) return;
    last = sig;
    void syncReminders();
  });
  void syncReminders();
  return unsubscribe;
}
