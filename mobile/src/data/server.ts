// A Pocket server: a Supabase project running this repo's SQL (see SELF-HOSTING.md).
// Every call goes through a key-gated `pocket_*` function, exactly like the web app and Pocket for Mac.
import type { Cadence, Entry, Occurrence, Preset, RuleView } from "../core/models";
import { sortOccurrences } from "../core/engine";

export interface Server {
  url: string;
  key: string;
}

/** The original Pocket server. Anyone can point Pocket at their own. */
export const DEFAULT_SERVER: Server = {
  url: "https://upmymrrfpwnqmnaclpyt.supabase.co",
  key: "sb_publishable_0QeYqlwAKI0Eit1nTB5vFw_PK1fxCaB",
};

export const isDefaultServer = (s: Server) => s.url === DEFAULT_SERVER.url;

export function cleanServer(url: string, key: string): Server | null {
  let u = String(url || "").trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//.test(u)) u = "https://" + u;
  try {
    const p = new URL(u);
    if (!/^https?:$/.test(p.protocol) || !p.host) return null;
    u = `${p.protocol}//${p.host}`;
  } catch {
    return null;
  }
  const k = String(key || "").trim();
  return k.length >= 20 ? { url: u, key: k } : null;
}

export class ServerError extends Error {
  constructor(message: string, readonly badKey = false, readonly network = false) {
    super(message);
  }
}

const TIMEOUT_MS = 15_000;

export async function rpc<T = unknown>(server: Server, fn: string, args: Record<string, unknown> = {}, accessKey?: string | null): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${server.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: server.key, "Content-Type": "application/json" },
      body: JSON.stringify(accessKey === undefined ? args : { k: accessKey, ...args }),
      signal: controller.signal,
    });
  } catch {
    throw new ServerError("Couldn't reach the server.", false, true);
  } finally {
    clearTimeout(timer);
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ServerError(body?.message || `HTTP ${res.status}`, body?.code === "28000");
  }
  return body as T;
}

// ---------- what pocket_state returns ----------

interface ServerTx {
  id: string; amount: number | string; label: string; occurred_on: string; created_at: string;
  recurring_id: string | null; category: string | null;
}
interface ServerRule {
  id: string; amount: number | string; label: string; cadence: Cadence; active: boolean; auto: boolean;
  category: string | null; next_on: string; remaining: number | null; once: boolean;
}
interface ServerUpcoming {
  recurring_id: string; label: string; amount: number | string; category: string | null; due_on: string; overdue: boolean;
}
interface ServerPreset { id: string; label: string; amount: number | string | null; sign: number; category: string | null }

export interface ServerState { transactions: ServerTx[]; recurring: ServerRule[]; upcoming: ServerUpcoming[]; presets: ServerPreset[] }

/** Server amounts are dollars with two decimals; Pocket works in whole cents. */
export const toCents = (amount: number | string) => Math.round(Number(amount) * 100);
export const toAmount = (cents: number) => Math.round(cents) / 100;
const opt = <T,>(v: T | null | undefined) => (v == null ? undefined : v);

export function convertState(s: ServerState) {
  const entries: Entry[] = s.transactions.map((t) => ({
    id: t.id, cents: toCents(t.amount), label: t.label, day: t.occurred_on,
    category: opt(t.category), ruleID: opt(t.recurring_id), created: t.created_at,
  }));
  const rules: RuleView[] = s.recurring.map((r) => ({
    id: r.id, cents: toCents(r.amount), label: r.label, cadence: r.cadence, next: r.next_on,
    remaining: opt(r.remaining), once: !!r.once, active: r.active, auto: r.auto, category: opt(r.category),
  }));
  // The next payment of each rule is the one "Got it" and "Skip" act on.
  const upcoming: Occurrence[] = sortOccurrences(s.upcoming.map((u) => ({
    ruleID: u.recurring_id, label: u.label, cents: toCents(u.amount), category: opt(u.category),
    day: u.due_on, overdue: u.overdue, isNext: rules.some((r) => r.id === u.recurring_id && r.next === u.due_on),
  })));
  const presets: Preset[] = s.presets.map((p) => ({
    id: p.id, label: p.label, cents: p.amount == null ? undefined : toCents(p.amount), sign: p.sign > 0 ? 1 : -1, category: opt(p.category),
  }));
  return { entries, rules, upcoming, presets };
}

export interface Device { id: string; name: string; created_at: string; last_seen: string; this: boolean }
