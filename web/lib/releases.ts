export type Release = {
  version: string;
  date: string;
  title: string;
  summary: string;
  theme: "sync" | "launch" | "findable" | "update";
  highlights: { title: string; description: string }[];
  detailsTitle: string;
  details: string[];
  source: string;
};

// Curated from the published GitHub releases. Add a new entry here when shipping,
// and update VERSION in site.ts. Dates are publication dates, not commit dates.
export const RELEASES: Release[] = [
  {
    version: "1.2.3",
    date: "2026-10-13",
    title: "Know when there's a new Pocket.",
    summary: "Check for updates from inside Pocket, see which version you have in a proper About window, and install from a cleaner download.",
    theme: "update",
    highlights: [
      { title: "Check for Updates", description: "Choose Check for Updates… from the Pocket menu, the ⋯ menu in the menu bar panel, or Settings → About. If there's a newer version, Download gets it in one click." },
      { title: "About Pocket", description: "The standard Mac About window shows your version, with links to pocketleft.app and the source code." },
      { title: "A clearer install", description: "The download opens to a Pocket window that shows exactly where to drag the app." },
    ],
    detailsTitle: "How the check works",
    details: [
      "Pocket asks GitHub for the latest release only when you click Check for Updates. It never checks in the background.",
      "Nothing about your money is sent. Your data stays where it is when you install the new version.",
    ],
    source: "https://github.com/orlandoascanio/pocketleft/releases/tag/v1.2.3",
  },
  {
    version: "1.2.0",
    date: "2026-10-13",
    title: "Everything in reach.",
    summary: "The things Pocket could already do are now where you'd look for them: money you're waiting for, quick-add buttons, and your daily backups.",
    theme: "findable",
    highlights: [
      { title: "Got it, right there", description: "Payments you're waiting for sit in Overview with Got it and Skip buttons. Mark money someone already owes you as still waiting, and your balance only moves once it arrives." },
      { title: "Buttons from what you buy", description: "Choose Save as Button after adding an entry. The new Quick Add menu gives ⌘1 to ⌘9 on every page of the window." },
      { title: "Restore a daily backup", description: "Settings → Daily backups restores any of the last seven days. A file Pocket can't open is kept, never overwritten." },
    ],
    detailsTitle: "Also in this release",
    details: [
      "A ⋯ button on every planned payment in Plan to skip the next one, pause it or stop it.",
      "Categories shows where your money came from, not just where it went.",
      "No instant reminder for a payment added after its reminder time.",
      "The sidebar's keyboard focus follows the page you're on.",
    ],
    source: "https://github.com/orlandoascanio/pocketleft/releases/tag/v1.2.0",
  },
  {
    version: "1.1.0",
    date: "2026-10-12",
    title: "Your balance, on your phone too.",
    summary: "Optional sync joins Pocket. Keep using it entirely on your Mac, or connect your own server to take your balance with you.",
    theme: "sync",
    highlights: [
      { title: "Connect your own server", description: "Use a free Supabase project. Connect it in Settings → Sync, then move the money already on your Mac over with Set Up This Server." },
      { title: "Pair your phone", description: "Choose Pair in Settings → Sync. The link opens the Pocket web app with your server and pairing code ready to go." },
      { title: "Keep going offline", description: "Your Mac keeps a full copy and sends changes in order when you’re back online. Uncertain requests wait for review, so a payment isn’t added twice." },
    ],
    detailsTitle: "A cleaner Pocket for Mac",
    details: [
      "A bigger amount field comes first. Date, category and repeat options open in a separate sheet.",
      "Categories have their own colors. Red now means below zero.",
      "A simpler menu bar panel shows a one-line notice when payments are waiting for you.",
      "History includes day totals, alongside a native sidebar and tidier Plan, Insights and Settings.",
    ],
    source: "https://github.com/orlandoascanio/pocketleft/releases/tag/v1.1.0",
  },
  {
    version: "1.0.0",
    date: "2026-10-11",
    title: "Hello, Pocket.",
    summary: "The first release for Mac. A balance in your menu bar, a plan for what’s ahead, and your money stored on your own computer.",
    theme: "launch",
    highlights: [
      { title: "Know what’s left", description: "Your balance lives in the menu bar, with quick adds and recent entries one click away. Customize quick-add buttons and use ⌘1 through ⌘9." },
      { title: "See what’s ahead", description: "Schedule bills, subscriptions and paychecks. Plan forecasts the next 1, 3, 6 or 12 months, including when your balance runs out or comes back above zero." },
      { title: "Confirm money when it arrives", description: "Freelance pay and refunds can wait for confirmation. Got it records the actual amount and date, with a reminder on the day it’s due." },
    ],
    detailsTitle: "More in the first release",
    details: [
      "Weekly, every two weeks, monthly and yearly repeating payments, with an optional end.",
      "Categories and a monthly breakdown of spending in Insights.",
      "One local data file, seven daily backups, and export, import and erase controls.",
      "A pocket character that reacts to your money.",
      "Free, signed and notarized for macOS 14 or later, on Apple Silicon and Intel.",
    ],
    source: "https://github.com/orlandoascanio/pocketleft/releases/tag/v1.0.0",
  },
];

export const releaseId = (version: string) => `v${version.replaceAll(".", "-")}`;
export const releaseDate = (date: string) => new Intl.DateTimeFormat("en", {
  month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
}).format(new Date(`${date}T12:00:00Z`));
