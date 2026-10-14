# pocketleft.app homepage copy rewrite

Drafted October 13, 2026 for `web/app/page.tsx`, `web/app/layout.tsx` and `web/lib/site.ts`.
Sources: `PRODUCT.md`, `CONTENT-STRATEGY.md`, `lib/releases.ts`, `lib/faq.ts`. Every claim below comes from the current source. There are no testimonials or usage numbers, and none are invented.

**Primary action:** Download for Mac.
**Reader:** A Mac user who wants to know how much money they have left, and who is fine entering it by hand.
**Voice:** Plain, warm and specific. Short sentences. Name the real controls (Got it, Save as Button, ⌘1).

## What changes and why

| Section | Current | Problem |
| --- | --- | --- |
| Hero H1 | Your money left, in your Mac menu bar. | "Your money left" reads awkwardly, and the line describes where the number is shown without saying what you get from it. |
| Hero lead | Enter your starting balance… see what's left in your menu bar. | Repeats "menu bar" from the H1 and reads like setup steps. |
| Announce bar | Free money tracker for your Mac. | Links to the changelog but doesn't say what's new. |
| Tour H2 | Inside Pocket. | Would work on any product page. |
| Plan | Plan for upcoming bills. / "A projected runway" | Generic headline. "Runway" is startup jargon. |
| Private H2 | Free. Every feature in it. No account, and Pocket is yours. | Four fragments in a row, and "Pocket is yours" is vague. |
| Guides H2 | A few useful things to start with. | Soft and wordy. |
| OG description | Your balance in the menubar, and how long it will last. | "menubar" is spelled differently from the rest of the site, and "how long it will last" promises more than the forecast does. |

These sections are already doing their job, so they stay or get light edits: the waiting-payments headline, the quick-add body, the FAQ and the meta list under the hero.

---

## Page copy

### Announce bar

> **New** · Pocket 1.2.3 · Check for updates from inside Pocket ↗

*Says what this release adds (from `RELEASES[0]`), which gives returning visitors a reason to click.*

### Hero

**H1**
> How much money you have left, always in your menu bar.

**Lead**
> Type in what you have today, then log what you spend and what comes in. Pocket keeps the number up to date at the top of your screen.

**CTAs:** `Download for Mac` (primary, unchanged) · `Take the tour` (secondary)

**Meta row:** unchanged (Free · No account · macOS 14+ · Apple Silicon & Intel · Developer signed · Apple notarized · v1.2.3)

*The H1 states the outcome first ("how much money you have left", the product's stated purpose), then the differentiator ("always in your menu bar"). It passes the "Now you can" test: now you can always see how much money you have left. The lead shows the whole loop in two sentences and leaves "menu bar" to the H1.*

**H1 alternatives**
- A (recommended): *How much money you have left, always in your menu bar.* Outcome and mechanism in one line. A competitor couldn't use it without the menu bar.
- B: *Always know how much money you have left.* Shortest and clearest, but it fails the swap test without the lead.
- C: *Your balance, one glance away on your Mac.* Visual, but "balance" sounds like a bank feed, and Pocket doesn't connect to one.

**Secondary CTA alternatives:** *Take the tour* (recommended, matches the tabbed tour it scrolls to) · *See Pocket in action* (current) · *See how it works*

### Tour (`#tour`)

**H2**
> Everything happens in one small window.

**Lead**
> Your balance sits in the menu bar. Open the window to add entries, confirm payments and look ahead.

**Under the tour, next to the download button**
> Free, and no account needed. Your money data stays on your Mac unless you set up sync.

*"Unless you set up sync" is more accurate than "by default" and tells the reader what would change it.*

### Plan (`#plan`)

**H2**
> See your balance after rent, before rent is due.

**Body**
> Add your bills, subscriptions and expected pay once. Pocket shows what your balance will be after each one, up to 12 months ahead.

**Bullets**
- A chart of where your balance is heading, 1 to 12 months out
- Every upcoming payment, with your balance right after it
- Pause, skip or stop anything that repeats

*Rent is a bill everyone recognizes, so the headline shows what forecasting is for. "Up to 12 months" is the real limit (1, 3, 6 or 12 in the schema feature list). "Runway" is gone.*

**H2 alternatives:** *Know what's left after rent, before rent is due.* · *Plan for upcoming bills.* (current, safe but generic)

### Waiting payments (`#waiting`)

**H2** (unchanged)
> Made for money that doesn't arrive on schedule.

**Body**
> Freelance pay, a refund, the $40 a friend owes you. Mark it as waiting, and when it lands, click Got it and enter what actually arrived, even if it came late or short.

**Bullets**
- Waiting payments sit in Overview until you click Got it or Skip
- Your balance moves only when you confirm
- A reminder on the day it's due

*"The $40 a friend owes you" is more concrete than "the friend who owes you." "Short" is the everyday word for a payment that came in under the amount.*

### Quick-add (`#quick-add`)

**H2**
> Log your usual coffee in one keystroke.

**Body**
> Add a coffee once and choose Save as Button. After that it's one click, or ⌘1 to ⌘9 from the menu bar panel or the Pocket window, and your balance updates right away.

*The headline promises the exact result the video shows, where the current one only names the feature.*

**H2 alternatives:** *Your usual purchases, one keystroke each.* · *Quick-add for everyday spending.* (current)

### Categories (`#categories`)

**H2**
> See where each month went.

**Body**
> Pocket totals your spending by category and shows where your income came from. Switch between Month and All time, or click a category to see every entry in it.

### Free and local (`#private`)

**H2 (two-tone)**
> Free, with every feature.
> Your data lives in one file on your Mac.

**Card heading:** On your Mac (unchanged)

**Card body**
> Download Pocket, type in today's balance, and add your first entry. Everything runs on your Mac.

**Checks**
- One file on your Mac holds all your money data
- Works offline
- Seven daily backups you can restore
- Export, import or erase any time

**Sync disclosure summary**
> Want your balance on your phone too?

**Sync body**
> Connect Pocket to your own free Supabase project, then pair your phone with a 6-digit code. Your Mac keeps a full copy and keeps working offline.

*The two-tone H2 now makes two concrete claims instead of four fragments. The sync summary is phrased as the reader's own question, which is the actual reason anyone would open it.*

### Guides (`#guides`)

**H2**
> Learn Pocket in three short guides.

*Changed from "Start here." on review: the first guide card is already labeled "Start here."*

**Lead**
> Set your starting balance, turn your usual purchases into one-keystroke buttons, and track money you're still waiting for.

*Each item in the lead matches one of the three guide cards, in the order they appear.*

### FAQ (`#faq`)

**H2:** Straight answers. (unchanged). The FAQ answers are accurate and already plain, so they stay as they are.

### Closing

**H2**
> Know what's left before you spend it.

**Sub**
> Free for macOS 14 or later, on Apple Silicon and Intel. A 3.5 MB download.

**CTAs:** `Download for Mac` · `View the source` (unchanged)

*The closing gives the reason to check Pocket before buying something. The file size (`DMG_SIZE`) makes downloading feel small.*

**H2 alternatives:** *Ready to know what's left?* (current, fine but generic) · *See what's left, starting today.*

---

## Meta content

**Page title** (`layout.tsx`)
> Pocket for Mac: Free Menu Bar Money Tracker

*Uses a colon in place of the em dash. The keywords stay the same.*

**Meta description** (`DESCRIPTION` in `lib/site.ts`, 141 characters)
> Free Mac menu bar app that shows how much money you have left. Log spending and income, plan upcoming bills, and keep your data on your Mac.

*Puts the outcome first, which matters most in search results. Optional sync is covered on the page and in the FAQ, so it's dropped here to keep the description short.*

**Open Graph description**
> See how much money you have left, right in your Mac menu bar. Free, and your data stays on your Mac.

---

## Self-check

- Searched the draft for contrast reveals, negation lists, colon reveals, stock openers and em dashes in headlines. None remain. The em dash in the page title was replaced.
- At most one fragment and one list of three per section.
- Every number is from source: ⌘1–⌘9, 1–12 months, seven backups, 6-digit code, 3.5 MB, macOS 14.
- Proof gap: `[NEED: real user quote or usage evidence]` before adding any social-proof section. `CONTENT-STRATEGY.md` already says to keep testimonials out until real ones exist.
- One wording to check in the app: the lead says the number appears "at the top of your screen." That's true for any menu bar item, but if you'd rather say "next to your clock," check how it looks on a crowded menu bar first.
