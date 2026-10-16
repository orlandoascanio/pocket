// Everything the screens read and every change they make goes through here.
//
// Two places the money can live:
// - "local": one JSON ledger on this phone (the default; no account, no server), like Pocket for Mac.
// - "server": a Pocket server shared with the Mac and the web app, joined with a 6-digit pairing code.
//   The server is the main copy; new entries made offline wait here and go out once back online.
import { useSyncExternalStore } from "react";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Localization from "expo-localization";
import { CATEGORY_START } from "../core/categories";
import { today as todayDay, type Day } from "../core/day";
import * as engine from "../core/engine";
import {
  ruleFinished, ruleNext, ruleView,
  type Cadence, type Entry, type Ledger, type Occurrence, type Preset, type RuleView,
} from "../core/models";
import { CURRENCIES, Money, type Cents } from "../core/money";
import { exportFile, readLedger, setAsideUnreadable, UnreadableLedger, writeLedger } from "./ledgerFile";
import {
  DEFAULT_SERVER, ServerError, cleanServer, convertState, rpc, toAmount,
  type Device as PairedDevice, type Server, type ServerState,
} from "./server";
import { KEYS, getItem, getJSON, getSecret, setItem, setJSON, setSecret } from "./storage";

export type Mode = "local" | "server";
export type Range = 30 | 91 | 182 | 365;
export const RANGES: Range[] = [30, 91, 182, 365];
const HORIZON = 366;
const POLL_MS = 15_000;

export interface SyncStatus {
  state: "idle" | "busy" | "ok" | "offline";
  waiting: number;
  at?: string;
}

export interface State {
  ready: boolean;
  onboarded: boolean;
  mode: Mode;
  currency: string;
  today: Day;
  entries: Entry[];
  rules: RuleView[];
  upcoming: Occurrence[];
  presets: Preset[];
  balance: Cents;
  range: Range;
  server: Server;
  sync: SyncStatus;
  /** Set when saved data couldn't be read; nothing is written until it's resolved. */
  loadError?: string;
  /** Set when a paired device lost access (removed from another device). */
  locked?: string;
}

/** What the pocket character reacts to. */
export interface Change {
  diff: Cents;
  category?: string;
  reason: "add" | "delete" | "undo" | "sync" | "settle" | "planned" | "skip" | "paused" | "resumed";
  amount?: Cents;
}

export interface EntryInput { cents: Cents; label: string; day: Day; category?: string }
export interface RuleInput extends EntryInput { cadence: Cadence; times?: number; auto: boolean }

const newID = () => Crypto.randomUUID().toUpperCase();

function emptyLedger(currency: string): Ledger {
  return { version: 1, currency, entries: [], rules: [], presets: [] };
}

function defaultCurrency(): string {
  try {
    const c = Localization.getLocales()[0]?.currencyCode;
    return c && CURRENCIES.includes(c) ? c : "USD";
  } catch {
    return "USD";
  }
}

class PocketStore {
  private state: State = {
    ready: false, onboarded: false, mode: "local", currency: "USD", today: todayDay(),
    entries: [], rules: [], upcoming: [], presets: [], balance: 0, range: 91,
    server: DEFAULT_SERVER, sync: { state: "idle", waiting: 0 },
  };
  private listeners = new Set<() => void>();
  private changeListeners = new Set<(c: Change) => void>();
  private ledger: Ledger = emptyLedger("USD");
  private accessKey: string | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastSig = "";
  private loading: Promise<void> | null = null;

  // ---------- subscription ----------

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };
  get = () => this.state;
  onChange(fn: (c: Change) => void) {
    this.changeListeners.add(fn);
    return () => { this.changeListeners.delete(fn); };
  }
  private set(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }
  private emit(c: Change) {
    for (const fn of this.changeListeners) fn(c);
  }

  get money() { return new Money(this.state.currency); }

  // ---------- start-up ----------

  load(): Promise<void> {
    this.loading ??= this.doLoad();
    return this.loading;
  }

  private async doLoad() {
    const [mode, onboarded, range, server, displayCurrency, key] = await Promise.all([
      getItem(KEYS.mode), getItem(KEYS.onboarded), getItem(KEYS.range), getJSON<Server>(KEYS.server),
      getItem(KEYS.displayCurrency), getSecret(KEYS.accessKey),
    ]);
    const r = Number(range) as Range;
    this.set({ range: RANGES.includes(r) ? r : 91, server: (server && cleanServer(server.url, server.key)) || DEFAULT_SERVER });

    let saved: Ledger | null = null;
    let loadError: string | undefined;
    try {
      saved = await readLedger();
    } catch (e) {
      loadError = e instanceof UnreadableLedger ? e.message : "Your saved data couldn't be read.";
    }
    this.ledger = saved ?? emptyLedger(defaultCurrency());

    if (mode === "server" && key) {
      this.accessKey = key;
      this.set({ mode: "server", onboarded: true, currency: displayCurrency || this.ledger.currency, ready: true });
      await this.refresh();
      this.startPolling();
      return;
    }
    this.set({ mode: "local", onboarded: onboarded === "1" || saved !== null || !!loadError, currency: this.ledger.currency, loadError });
    if (!loadError) {
      const logged = engine.postDue(this.ledger, this.state.today, newID);
      if (logged.length) await this.persist();
    }
    this.deriveLocal();
    this.set({ ready: true });
  }

  /** Call when the app comes back to the foreground: the day may have changed, and the server may have news. */
  async wake() {
    if (!this.state.ready) return;
    const t = todayDay();
    if (t !== this.state.today) this.set({ today: t });
    if (this.state.mode === "server") {
      await this.refresh();
      this.startPolling();
    } else if (!this.state.loadError) {
      const before = this.state.balance;
      const logged = engine.postDue(this.ledger, t, newID);
      if (logged.length) {
        await this.persist();
        this.deriveLocal();
        this.emit({ diff: this.state.balance - before, category: logged[logged.length - 1].category, reason: "sync" });
      } else {
        this.deriveLocal();
      }
    }
  }

  sleep() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private startPolling() {
    this.sleep();
    this.pollTimer = setInterval(() => { void this.refresh({ quiet: true }); }, POLL_MS);
  }

  // ---------- local ledger ----------

  private deriveLocal() {
    const l = this.ledger;
    const live = l.rules
      .filter((r) => !ruleFinished(r))
      .sort((a, b) => (a.active === b.active ? (ruleNext(a) === ruleNext(b) ? a.label.localeCompare(b.label) : ruleNext(a) < ruleNext(b) ? -1 : 1) : a.active ? -1 : 1));
    this.set({
      currency: l.currency,
      entries: engine.sortEntries(l.entries),
      rules: live.map(ruleView),
      upcoming: engine.upcoming(l.rules, this.state.today, HORIZON),
      presets: [...l.presets],
      balance: engine.balanceOf(l.entries),
    });
  }

  private async persist() {
    if (this.state.loadError) throw new Error("Saved data couldn't be read, so nothing new is saved. Import a backup or start fresh in Settings.");
    await writeLedger(this.ledger, this.state.today);
  }

  /** Apply a change to a copy of the ledger, save it, then show it. Nothing changes if saving fails. */
  private async mutate(fn: (l: Ledger) => void, change?: Omit<Change, "diff">) {
    const before = this.state.balance;
    const draft: Ledger = JSON.parse(JSON.stringify(this.ledger));
    fn(draft);
    const previous = this.ledger;
    this.ledger = draft;
    try {
      await this.persist();
    } catch (e) {
      this.ledger = previous;
      throw e;
    }
    this.deriveLocal();
    if (change) this.emit({ ...change, diff: this.state.balance - before });
  }

  // ---------- server ----------

  private async call<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    try {
      return await rpc<T>(this.state.server, fn, args, this.accessKey);
    } catch (e) {
      if (e instanceof ServerError && e.badKey) this.lockOut();
      throw e;
    }
  }

  /** New entries survive being offline: they wait here and go out on the next sync. */
  private async callOrQueue<T>(fn: string, args: Record<string, unknown>): Promise<T | { queued: true }> {
    try {
      return await this.call<T>(fn, args);
    } catch (e) {
      if (!(e instanceof ServerError && e.network)) throw e;
      const q = (await getJSON<{ fn: string; args: Record<string, unknown> }[]>(KEYS.queue)) ?? [];
      q.push({ fn, args });
      await setJSON(KEYS.queue, q);
      this.set({ sync: { ...this.state.sync, state: "offline", waiting: q.length } });
      return { queued: true };
    }
  }

  private async flushQueue() {
    const q = (await getJSON<{ fn: string; args: Record<string, unknown> }[]>(KEYS.queue)) ?? [];
    while (q.length) {
      try {
        await this.call(q[0].fn, q[0].args);
        q.shift();
      } catch (e) {
        if (e instanceof ServerError && (e.network || e.badKey)) {
          await setJSON(KEYS.queue, q.length ? q : null);
          throw e;
        }
        q.shift(); // the server refused it for good; don't retry forever
      }
    }
    await setJSON(KEYS.queue, null);
  }

  async refresh({ quiet = false, reason = "sync" as Change["reason"] } = {}) {
    if (this.state.mode !== "server" || !this.accessKey) return;
    if (!quiet) this.set({ sync: { ...this.state.sync, state: "busy" } });
    const before = this.state.balance;
    const hadData = this.lastSig !== "";
    try {
      await this.flushQueue();
      const s = await this.call<ServerState>("pocket_state", { p_today: this.state.today, p_days: HORIZON });
      const sig = JSON.stringify(s);
      if (sig !== this.lastSig) {
        this.lastSig = sig;
        const known = new Set(this.state.entries.map((e) => e.id));
        const c = convertState(s);
        this.set({ ...c, balance: engine.balanceOf(c.entries) });
        const diff = this.state.balance - before;
        if (hadData && diff !== 0) {
          const newest = c.entries.find((e) => !known.has(e.id));
          this.emit({ diff, category: newest?.category, reason });
        }
      }
      const waiting = ((await getJSON<unknown[]>(KEYS.queue)) ?? []).length;
      this.set({ sync: { state: waiting ? "offline" : "ok", waiting, at: new Date().toISOString() } });
    } catch (e) {
      if (e instanceof ServerError && e.badKey) return;
      const waiting = ((await getJSON<unknown[]>(KEYS.queue)) ?? []).length;
      this.set({ sync: { ...this.state.sync, state: "offline", waiting } });
    }
  }

  private lockOut() {
    this.accessKey = null;
    this.sleep();
    void setSecret(KEYS.accessKey, null);
    void setItem(KEYS.mode, null);
    void setJSON(KEYS.queue, null);
    this.lastSig = "";
    this.set({ mode: "local", locked: "This phone was removed from your Pocket, or its access changed. Pair it again to keep syncing." });
    this.deriveLocal();
  }

  dismissLocked() { this.set({ locked: undefined }); }

  // ---------- onboarding ----------

  async start(currency: string, cents: Cents) {
    this.ledger = emptyLedger(currency);
    this.set({ loadError: undefined });
    await this.mutate((l) => {
      if (cents !== 0) l.entries.push({ id: newID(), cents, label: "Starting balance", day: this.state.today, category: CATEGORY_START, created: engine.nowStamp() });
    });
    await setItem(KEYS.onboarded, "1");
    this.set({ onboarded: true });
  }

  // ---------- entries ----------

  /** Returns the new entry's id, or null when it's waiting offline. */
  async addEntry(e: EntryInput): Promise<string | null> {
    if (this.state.mode === "server") {
      const res = await this.callOrQueue<{ id: string }>("pocket_add", { p_amount: toAmount(e.cents), p_label: e.label, p_on: e.day, p_category: e.category ?? null });
      if ("queued" in res) return null;
      await this.refresh({ quiet: true, reason: "add" });
      return res.id;
    }
    const id = newID();
    await this.mutate((l) => { l.entries.push({ id, ...e, created: engine.nowStamp() }); }, { category: e.category, reason: "add", amount: e.cents });
    return id;
  }

  async updateEntry(id: string, e: EntryInput) {
    if (this.state.mode === "server") {
      await this.call("pocket_update", { p_id: id, p_amount: toAmount(e.cents), p_label: e.label, p_on: e.day, p_category: e.category ?? "" });
      return this.refresh({ quiet: true, reason: "add" });
    }
    await this.mutate((l) => {
      const x = l.entries.find((y) => y.id === id);
      if (x) Object.assign(x, e, { category: e.category });
      if (x && e.category === undefined) delete x.category;
    }, { category: e.category, reason: "add" });
  }

  async deleteEntry(id: string, reason: "delete" | "undo" = "delete") {
    if (this.state.mode === "server") {
      await this.call("pocket_delete", { p_id: id });
      return this.refresh({ quiet: true, reason });
    }
    await this.mutate((l) => { l.entries = l.entries.filter((x) => x.id !== id); }, { reason });
  }

  // ---------- repeating and planned money ----------

  /** A one-time entry dated in the future is a rule with a single payment, so it only counts once its day arrives. */
  async addRule(r: RuleInput): Promise<boolean> {
    if (this.state.mode === "server") {
      const res = await this.callOrQueue("pocket_recurring_add", {
        p_amount: toAmount(r.cents), p_label: r.label, p_cadence: r.cadence, p_start: r.day,
        p_today: this.state.today, p_times: r.times ?? null, p_category: r.category ?? null, p_auto: r.auto,
      });
      if (res && typeof res === "object" && "queued" in res) return false;
      await this.refresh({ quiet: true, reason: "planned" });
      this.emit({ diff: 0, reason: "planned", amount: r.cents });
      return true;
    }
    await this.mutate((l) => {
      l.rules.push({
        id: newID(), cents: r.cents, label: r.label, cadence: r.cadence, anchor: r.day, posted: 0,
        ...(r.times !== undefined ? { total: r.times } : {}), active: true, auto: r.auto,
        ...(r.category ? { category: r.category } : {}), created: engine.nowStamp(),
      });
      engine.postDue(l, this.state.today, newID);
    }, { category: r.category, reason: "planned", amount: r.cents });
    return true;
  }

  async updateRule(id: string, r: RuleInput) {
    if (this.state.mode === "server") {
      await this.call("pocket_recurring_update", {
        p_id: id, p_amount: toAmount(r.cents), p_label: r.label, p_cadence: r.cadence, p_next: r.day,
        p_today: this.state.today, p_left: r.times ?? null, p_category: r.category ?? "", p_auto: r.auto,
      });
      return this.refresh({ quiet: true, reason: "add" });
    }
    await this.mutate((l) => engine.updateRule(l, id, {
      cents: r.cents, label: r.label, cadence: r.cadence, next: r.day, left: r.times, category: r.category, auto: r.auto,
    }, this.state.today, newID), { category: r.category, reason: "add" });
  }

  async deleteRule(id: string) {
    if (this.state.mode === "server") {
      await this.call("pocket_recurring_delete", { p_id: id });
      return this.refresh({ quiet: true, reason: "delete" });
    }
    await this.mutate((l) => engine.removeRule(l, id), { reason: "delete" });
  }

  async settle(id: string, cents: Cents, day: Day) {
    const category = this.state.rules.find((r) => r.id === id)?.category;
    if (this.state.mode === "server") {
      await this.call("pocket_recurring_settle", { p_id: id, p_amount: toAmount(cents), p_on: day, p_today: this.state.today });
      return this.refresh({ quiet: true, reason: "settle" });
    }
    await this.mutate((l) => { engine.settle(l, id, cents, day, this.state.today, newID); }, { category, reason: "settle" });
  }

  async skip(id: string) {
    if (this.state.mode === "server") {
      await this.call("pocket_recurring_skip", { p_id: id });
      await this.refresh({ quiet: true, reason: "skip" });
    } else {
      await this.mutate((l) => engine.skip(l, id));
    }
    this.emit({ diff: 0, reason: "skip" });
  }

  async setActive(id: string, active: boolean) {
    if (this.state.mode === "server") {
      await this.call("pocket_recurring_set_active", { p_id: id, p_active: active, p_today: this.state.today });
      await this.refresh({ quiet: true });
    } else {
      await this.mutate((l) => engine.setActive(l, id, active, this.state.today, newID));
    }
    this.emit({ diff: 0, reason: active ? "resumed" : "paused" });
  }

  // ---------- quick-add buttons ----------

  async savePreset(p: Omit<Preset, "id"> & { id?: string }) {
    if (this.state.mode === "server") {
      const res = await this.callOrQueue("pocket_preset_save", {
        p_id: p.id ?? null, p_label: p.label, p_sign: p.sign, p_amount: p.cents == null ? null : toAmount(p.cents), p_category: p.category ?? "",
      });
      if (!(res && typeof res === "object" && "queued" in res)) await this.refresh({ quiet: true });
      return;
    }
    await this.mutate((l) => {
      const clean: Preset = { id: p.id ?? newID(), label: p.label, sign: p.sign, ...(p.cents != null ? { cents: p.cents } : {}), ...(p.category ? { category: p.category } : {}) };
      const i = l.presets.findIndex((x) => x.id === clean.id);
      if (i >= 0) l.presets[i] = clean; else l.presets.push(clean);
    });
  }

  async deletePreset(id: string) {
    if (this.state.mode === "server") {
      await this.call("pocket_preset_delete", { p_id: id });
      return this.refresh({ quiet: true });
    }
    await this.mutate((l) => { l.presets = l.presets.filter((x) => x.id !== id); });
  }

  /** Local only: the server keeps buttons in the order they were made. */
  async movePreset(id: string, by: -1 | 1) {
    if (this.state.mode === "server") return;
    await this.mutate((l) => {
      const i = l.presets.findIndex((x) => x.id === id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= l.presets.length) return;
      [l.presets[i], l.presets[j]] = [l.presets[j], l.presets[i]];
    });
  }

  // ---------- settings ----------

  async setCurrency(currency: string) {
    if (this.state.mode === "server") {
      await setItem(KEYS.displayCurrency, currency);
      this.set({ currency });
      return;
    }
    await this.mutate((l) => { l.currency = currency; });
  }

  async setRange(range: Range) {
    this.set({ range });
    await setItem(KEYS.range, String(range));
  }

  /** The ledger as a file to share (local mode). */
  async exportLedger() {
    return exportFile(this.ledger, this.state.today);
  }

  async importLedger(text: string) {
    if (this.state.mode === "server") throw new Error("Disconnect from your server before importing a file.");
    let candidate: Ledger;
    try {
      candidate = engine.validateLedger(JSON.parse(text));
    } catch (e) {
      throw new Error(e instanceof SyntaxError ? "This isn't a Pocket file." : (e as Error).message);
    }
    engine.postDue(candidate, this.state.today, newID);
    if (this.state.loadError) setAsideUnreadable();
    const previous = this.ledger;
    this.ledger = candidate;
    this.set({ loadError: undefined });
    try {
      await this.persist();
    } catch (e) {
      this.ledger = previous;
      throw e;
    }
    await setItem(KEYS.onboarded, "1");
    this.set({ onboarded: true });
    this.deriveLocal();
  }

  async eraseEverything() {
    if (this.state.mode === "server") return;
    if (this.state.loadError) setAsideUnreadable();
    this.ledger = emptyLedger(this.ledger.currency);
    this.set({ loadError: undefined });
    await this.persist();
    await setItem(KEYS.onboarded, null);
    this.deriveLocal();
    this.set({ onboarded: false });
  }

  // ---------- pairing ----------

  private deviceName(): string {
    const name = Device.deviceName || Device.modelName || (Device.osName === "Android" ? "Android phone" : "iPhone");
    return `${name} (Pocket app)`.slice(0, 60);
  }

  /** Join a Pocket with a 6-digit code made on a device that's already set up. */
  async pair(server: Server, code: string): Promise<{ error?: string }> {
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) return { error: "The code has 6 digits." };
    let res: { token?: string; error?: string };
    try {
      res = await rpc(server, "pocket_pair_finish", { p_code: digits, p_name: this.deviceName() });
    } catch {
      return { error: "Couldn't reach the server. Check your connection." };
    }
    if (!res?.token) {
      return {
        error: {
          wrong: "That code didn't match. Check it and try again.",
          expired: "That code expired or was already used. Make a new one on your Mac.",
          too_many: "Too many tries. Make a new code on your Mac.",
        }[res?.error ?? ""] ?? "Couldn't pair. Try again.",
      };
    }
    await this.useAccessKey(server, res.token);
    return {};
  }

  /** Connect with the server's secret key or a device token directly. */
  async connectWithKey(server: Server, key: string): Promise<{ error?: string }> {
    try {
      await rpc(server, "pocket_state", { p_today: this.state.today, p_days: 1 }, key.trim());
    } catch (e) {
      return { error: e instanceof ServerError && e.badKey ? "That key didn't work." : "Couldn't reach the server. Check your connection." };
    }
    await this.useAccessKey(server, key.trim());
    return {};
  }

  private async useAccessKey(server: Server, key: string) {
    await setSecret(KEYS.accessKey, key);
    await setJSON(KEYS.server, server.url === DEFAULT_SERVER.url ? null : server);
    await setItem(KEYS.mode, "server");
    await setItem(KEYS.displayCurrency, this.state.currency);
    this.accessKey = key;
    this.lastSig = "";
    this.set({ mode: "server", server, onboarded: true, locked: undefined, entries: [], rules: [], upcoming: [], presets: [], balance: 0 });
    await this.refresh();
    this.startPolling();
  }

  /** Stop syncing. The money on the server stays there; this phone goes back to its own ledger. */
  async disconnect() {
    this.sleep();
    this.accessKey = null;
    this.lastSig = "";
    await setSecret(KEYS.accessKey, null);
    await setItem(KEYS.mode, null);
    await setJSON(KEYS.queue, null);
    const hasLocal = this.ledger.entries.length > 0 || this.ledger.rules.length > 0;
    this.set({ mode: "local", sync: { state: "idle", waiting: 0 }, onboarded: hasLocal || (await getItem(KEYS.onboarded)) === "1" });
    this.deriveLocal();
  }

  async startPairing() {
    return this.call<{ code: string; expires_at: string }>("pocket_pair_start");
  }

  async devices() {
    return this.call<{ master: boolean; devices: PairedDevice[] }>("pocket_devices");
  }

  async removeDevice(id: string) {
    await this.call("pocket_device_remove", { p_id: id });
  }
}

export const store = new PocketStore();

export function usePocket(): State;
export function usePocket<T>(select: (s: State) => T): T;
export function usePocket<T>(select?: (s: State) => T) {
  const s = useSyncExternalStore(store.subscribe, store.get, store.get);
  return select ? select(s) : s;
}

export function useMoney(): Money {
  const currency = usePocket((s) => s.currency);
  return new Money(currency);
}
