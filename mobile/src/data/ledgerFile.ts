// The ledger is one JSON file, the same format as Pocket for Mac's ledger.json, with 7 daily backups.
// The web build (used for quick previews) keeps it in browser storage instead.
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import type { Ledger } from "../core/models";
import { validateLedger } from "../core/engine";
import { KEYS, getItem, setItem } from "./storage";

const native = Platform.OS !== "web";
const KEEP_BACKUPS = 7;

function dir(): Directory {
  const d = new Directory(Paths.document, "Pocket");
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

function backupsDir(): Directory {
  const d = new Directory(dir(), "Backups");
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

const ledgerFile = () => new File(dir(), "ledger.json");

/** Swift's encoder sorts keys; doing the same keeps exports diff-friendly between the apps. */
export function encodeLedger(l: Ledger): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sort)
      : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])]))
        : v;
  return JSON.stringify(sort(l), null, 2);
}

export class UnreadableLedger extends Error {}

/** null = nothing saved yet. Throws UnreadableLedger when a file exists but can't be read. */
export async function readLedger(): Promise<Ledger | null> {
  let raw: string | null;
  if (native) {
    const f = ledgerFile();
    raw = f.exists ? await f.text() : null;
  } else {
    raw = await getItem(KEYS.ledger);
  }
  if (raw == null) return null;
  try {
    return validateLedger(JSON.parse(raw));
  } catch (e) {
    throw new UnreadableLedger(e instanceof Error ? e.message : "Your saved data couldn't be read.");
  }
}

export async function writeLedger(l: Ledger, day: string): Promise<void> {
  const text = encodeLedger(l);
  if (!native) return setItem(KEYS.ledger, text);
  const f = ledgerFile();
  if (f.exists) backupOncePerDay(f, day);
  // Write beside it, then swap, so a crash mid-write never leaves half a file.
  const tmp = new File(dir(), "ledger.json.tmp");
  if (tmp.exists) tmp.delete();
  tmp.create();
  await tmp.write(text);
  if (f.exists) f.delete();
  tmp.move(f);
}

/** An unreadable file is set aside rather than overwritten. */
export function setAsideUnreadable(): void {
  if (!native) return;
  const f = ledgerFile();
  if (f.exists) f.move(new File(dir(), `ledger-unreadable-${Date.now()}.json`));
}

function backupOncePerDay(current: File, day: string) {
  try {
    const b = backupsDir();
    const target = new File(b, `ledger-${day}.json`);
    if (target.exists) return;
    current.copy(target);
    const old = b.list()
      .filter((x): x is File => x instanceof File && /^ledger-\d{4}-\d{2}-\d{2}\.json$/.test(x.name))
      .sort((a, c) => (a.name < c.name ? 1 : -1))
      .slice(KEEP_BACKUPS);
    for (const x of old) x.delete();
  } catch {
    // A missed backup must never block saving.
  }
}

/** Writes a CSV spreadsheet to a temporary file to hand to the share sheet. */
export async function exportCSVFile(csv: string, name: string): Promise<File> {
  const f = new File(Paths.cache, `${name}.csv`);
  if (f.exists) f.delete();
  f.create();
  await f.write(csv);
  return f;
}

/** Writes the ledger to a temporary file to hand to the share sheet. */
export async function exportFile(l: Ledger, day: string): Promise<File> {
  const f = new File(Paths.cache, `Pocket ${day}.json`);
  if (f.exists) f.delete();
  f.create();
  await f.write(encodeLedger(l));
  return f;
}
