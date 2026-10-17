import { SELF_HOSTING_GUIDE_URL } from "@/lib/site";

export type FaqItem = { q: string; a: string; link?: { href: string; label: string } };

// Shared by the homepage, its FAQPage schema, and /llms.txt.
export const FAQ: FaqItem[] = [
  { q: "Is Pocket free?", a: "Yes. Every feature, with no account and no trial. The source code is on GitHub." },
  {
    q: "Does Pocket connect to my bank?",
    a: "No. You add what comes in and what goes out, and Pocket keeps the balance you've recorded. Repeating payments log themselves on their day, and quick-add buttons (⌘1 to ⌘9) add the things you buy often in one keystroke.",
    link: { href: "/guides/manual-vs-bank-sync/", label: "Compare manual tracking with bank sync" },
  },
  {
    q: "Where is my money data stored?",
    a: "In one file on your Mac (~/Library/Application Support/Pocket/ledger.json), with seven daily backups. From Settings you can restore one of those backups, export your data as JSON or as a CSV spreadsheet, import it again, or erase it.",
  },
  {
    q: "Can I see my balance on my phone?",
    a: "Yes, if you want to. Connect Pocket to a server you run (a free Supabase project), then pair your phone from Settings → Sync. Your phone uses the Pocket web app, and your Mac keeps a full copy that works offline.",
    link: { href: SELF_HOSTING_GUIDE_URL, label: "Read the self-hosting guide" },
  },
  {
    q: "Which currencies does it support?",
    a: "Any standard currency. Each ledger uses one. Changing it relabels your amounts; it doesn't convert them.",
  },
  {
    q: "Which Macs does it run on?",
    a: "macOS 14 Sonoma or later, on Apple Silicon and Intel. The app is signed and notarized by Apple. To update, choose Check for Updates… from the Pocket menu or Settings → About.",
  },
  {
    q: "How do I move Pocket to a new Mac?",
    a: "Export your data from Settings on the old Mac, then import that file on the new one.",
    link: { href: "/guides/back-up-your-data/", label: "Read the backup and move guide" },
  },
  {
    q: "Is there a Windows or iPhone app?",
    a: "Not a native one. With sync set up, the Pocket web app works in any browser, and you can add it to your home screen.",
  },
];
