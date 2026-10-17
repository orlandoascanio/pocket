import { RELEASES } from "@/lib/releases";
import { DMG_SIZE, DOWNLOAD_URL, REPO_URL, VERSION } from "@/lib/site";

// The plain facts about Pocket, shared by /about/ and /llms.txt so they can't disagree.
// Values can link with [label](url), like guide text.
export type Fact = { label: string; value: string };

export const FACTS: Fact[] = [
  { label: "Price", value: "Free. Every feature, with no account and no trial." },
  { label: "Platform", value: "macOS 14 Sonoma or later, Apple Silicon and Intel. Signed and notarized by Apple." },
  { label: "Latest version", value: `${VERSION} (${RELEASES[0].date}). [Download the ${DMG_SIZE} .dmg](${DOWNLOAD_URL})` },
  { label: "How it works", value: "You record money in and out by hand. Pocket does not connect to banks." },
  {
    label: "Data",
    value: "One local file (~/Library/Application Support/Pocket/ledger.json) with seven daily backups, JSON export/import and CSV export. No account or server by default.",
  },
  {
    label: "Optional sync",
    value: "Connect a free Supabase project you run to see your balance on a phone through the Pocket web app.",
  },
  { label: "Currencies", value: "Any standard currency, one per ledger. Changing it relabels amounts; it does not convert them." },
  {
    label: "Not available",
    value: "Native Windows or iPhone apps (the Pocket web app works in any browser once sync is set up), bank connections, currency conversion.",
  },
  { label: "Made by", value: "[Orlando Ascanio](https://www.orlandoascanio.com), an independent developer." },
  { label: "Source code", value: `[github.com/orlandoascanio/pocketleft](${REPO_URL})` },
];

// Answer-first summary for /about/: the passage an answer engine is most likely to quote.
export const AT_A_GLANCE =
  "Pocket for Mac is a free menu bar app that shows how much money you have left. You record spending and income by hand. Pocket keeps the balance next to the clock and forecasts when it may run out. No bank login, any currency, and your data stays on your Mac.";
