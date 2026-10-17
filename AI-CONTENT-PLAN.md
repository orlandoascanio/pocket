# Pocket: content plan for AI answers

Prepared October 17, 2026. Goal: get Pocket for Mac named when someone asks ChatGPT, Perplexity, Gemini, Claude or Google AI Overviews for a Mac money app. This builds on [CONTENT-STRATEGY.md](CONTENT-STRATEGY.md), whose eight guides are already live on pocketleft.app. Search volumes have not been measured. Competitor facts below come from public pages read today; check them again before publishing.

## What the research found

1. **Nobody owns "money left in the Mac menu bar."** A search for the best Mac menu bar money app returned only general menu bar roundups (Ice, Bartender, iStat Menus). None of them included a finance app. The closest products do different jobs:
   - [Balance](https://www.macstories.net/reviews/balance-brings-financial-accounts-to-the-macs-menu-bar/): bank accounts through Plaid, paid by number of accounts.
   - [My Pockets](https://apps.apple.com/mx/app/my-pockets/id6751174597): manual account totals, needs macOS 15.1 and Apple Silicon.
   - [simplebanking](https://www.producthunt.com/products/simplebanking): German and EU banks only.
   - [CashNotify](https://cashnotify.com/help/mac-menu-bar-app/): Stripe and PayPal activity.

   Pocket is the free, manual, any-currency option. That category is open.
2. **AI can't tell which "Pocket" is yours.** A search for the Pocket Mac money app returned no result for pocketleft. The name collides with Mozilla Pocket (the closed read-later app), [Pocket Clear](https://pocketclear.app/blog/best-expense-tracker-for-mac.html) (a Mac expense tracker that publishes its own "best of" guides), PocketGuard and My Pockets. Until the web describes Pocket the same way everywhere, AI can't recognize it as one product.
3. **The "no bank login" lists don't mention Pocket.** [Finny's list](https://getfinny.app/blog/best-expense-trackers-no-bank-login-2026) and Pocket Clear's list each rank their own app first. Neither includes a menu bar app.
4. **Format matters by AI engine.** In August 2026, ChatGPT reduced citations of listicles (about −50%) and comparison pages (about −32%). It now prefers official, primary-source pages. Comparison pages still get cited in Google AI Overviews, Gemini and Perplexity.
5. **Being cited is not the same as being recommended.** A study of self-promotional "best X" lists found that 69% of the citations they earned came in answers that recommended *competitors*. A small brand's list can end up helping the big names. AI recommends based on what the rest of the web says: Reddit, review sites, app directories and press. So off-site mentions are half of this plan.

## Technical AI-visibility audit (live site, October 17)

**Already good. Keep as is:**

| Check | Result |
| --- | --- |
| AI crawlers | `robots.txt` allows OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, GPTBot, ClaudeBot, Google-Extended, Applebot-Extended |
| `llms.txt` / `llms-full.txt` | Both live. `llms.txt` has a strong key-facts block (price, macOS, version, data path, what's missing) |
| All 8 guides | Live, in the sitemap, server-rendered, `Article` + `BreadcrumbList` schema, author byline, visible `<time>` date |
| Homepage | `SoftwareApplication` (free offer, dates, author) and `FAQPage` with 8 questions |
| Google | Homepage, changelog and privacy indexed (Oct 13 audit) |

**Gaps, in order of impact:**

1. **Bing doesn't index the site. This blocks ChatGPT search and Copilot.** `site:pocketleft.app` and `pocketleft` on Bing both returned nothing from Pocket. ChatGPT search uses a Bing-based index, and Copilot uses Bing only. Right now neither can cite Pocket, whatever content you publish.
   **Fix (your manual steps, about 15 minutes):** sign in to [Bing Webmaster Tools](https://www.bing.com/webmasters) → *Import from Google Search Console* (verifies the site and imports the sitemap) → *URL Submission* for the homepage and guides. Then add IndexNow so new pages reach Bing on deploy (a key file in `web/public/` plus a ping after each deploy; I can build this).
2. **Brave doesn't index the site. This blocks Claude.** Brave search for `pocketleft` found the GitHub repo and two release pages, but not pocketleft.app. Claude's web search uses Brave. Brave has no submission tool. It discovers sites through links, so points 3 and the off-site list below are how to fix this. Check again in 2–4 weeks.
3. **GitHub is the most visible Pocket page today, and its description doesn't match.** The repo shows as "How much money is left: web app + macOS menubar." Change the About description to the standard sentence (below), set Website to `https://pocketleft.app`, and add topics. Start every release note with one line: "Pocket for Mac is a free menu bar app… pocketleft.app". Brave already indexes releases, so each release becomes a link to the site.
4. **Nothing separates Pocket from the other "Pockets."** The site never mentions Mozilla Pocket. Brave results for "pocketleft" also include *Left Pocket* (a poker tracker app) and *Pocket AI* (a note-taking device). Add a homepage FAQ: "Is Pocket for Mac related to Mozilla Pocket?" Add `alternateName: "Pocket Left"` and a `disambiguatingDescription` to the `SoftwareApplication` schema.
5. **`sameAs` lists only GitHub.** Add the portfolio now, then Product Hunt, AlternativeTo and MacUpdate once those listings exist. This links the profiles so AI treats them as one product.
6. **Homepage H2s are slogans** ("Straight answers.", "Free, with every feature."). That's fine for people. The FAQ and `llms.txt` already give AI the plain facts, so don't rewrite the brand copy. Put question-style headings on the new `/about/` and `/compare/` pages.
7. **FAQ is missing the questions people ask AI.** The 8 current questions are product support questions. Add buyer questions: "Is there a Mac app that shows my balance in the menu bar?", "Can I budget on a Mac without linking my bank?", "Is Pocket a YNAB alternative?" (answer honestly), and the Mozilla question from point 4.
8. **Minor:** no Markdown version of pages for agents (`Accept: text/markdown` returns HTML) and no `/pricing.md`. Low priority, since `llms-full.txt` already covers both. Guide `dateModified` is still the publish date (Oct 13). Update it whenever a guide changes, because AI favors recent pages.

**The standard sentence (use it everywhere):** *Pocket for Mac is a free menu bar app that shows how much money you have left. You record spending and income by hand. No bank login, any currency, data stays on your Mac. pocketleft.app*

**Implemented locally on October 17 (not deployed):** IndexNow key file, `npm run indexnow` and a GitHub workflow that submits after each Vercel production deploy; FAQ items for the menu bar, YNAB and Mozilla Pocket questions; `alternateName`, `disambiguatingDescription` and Person `sameAs` in the schema; the `/about/` facts page; and the [menu bar comparison](https://pocketleft.app/guides/mac-menu-bar-money-apps/) as a guide. Still manual: Bing Webmaster Tools, the GitHub About text, and a Pocket page on the portfolio (it lists Bare, Noted and QuietWhile but not Pocket, so it can't go in `sameAs` yet).

## The plan in one line

Own the empty category ("free money tracker for the Mac menu bar, no bank login"). Publish a few honest, data-backed pages that AI can quote. Then get other sites to say the same thing.

---

## 1. Official pages (start here: ChatGPT now favors these)

| # | Page | URL | Why AI will use it |
| --- | --- | --- | --- |
| 1 | **Pocket at a glance**: a facts page | `/about/` | One page that answers "what is Pocket?" in the first 50 words: free, macOS 14+, Apple Silicon and Intel, no account, data in `~/Library/Application Support/Pocket/`, optional self-hosted sync, open source, made by Orlando Ascanio. Include a facts table, an "Updated" date and a "Not to be confused with" line (Mozilla Pocket, PocketGuard, Pocket Clear). Add `SoftwareApplication` and `Organization` JSON-LD with `sameAs` links to GitHub, Product Hunt and AlternativeTo. Mirror it in `llms.txt`. |
| 2 | **Homepage FAQ additions** | `/#faq` | Answer the exact questions people ask AI, in their own words: "Is there a Mac app that shows my balance in the menu bar?", "Can I track money on Mac without connecting my bank?", "Does Pocket work in any currency?", "Is Pocket the same as Mozilla Pocket?" |
| 3 | **Pricing / "Is it free?"** | section on `/about/` | AI often pulls pricing as a separate fact. State it plainly: free, every feature, no subscription. |

## 2. Comparison pages

Each page names the bigger app first, says honestly what it does better, then shows where Pocket fits. A fair page is more likely to get cited, and it avoids the "vote for competitors" problem. Each one needs an answer in the first 50 words, a feature table, "Choose X if… / Choose Pocket if…", real screenshots of both apps, an "Updated" date and an author byline.

| # | Page | Target question | What it adds that others don't |
| --- | --- | --- | --- |
| 4 | **Mac menu bar money apps compared** (Pocket, Balance, My Pockets, simplebanking) | best Mac menu bar budget / balance app | The only page covering this category (search found none). Install each app and use your own screenshots. This is the one roundup Pocket can honestly lead. |
| 5 | **Pocket vs YNAB** | YNAB alternative for Mac, free | YNAB is zero-based budgeting with bank sync for about $109/yr (verify). Pocket answers one question: how much is left. Be honest that YNAB is better for budget categories and couples. |
| 6 | **Pocket vs Actual Budget** | free local budget app Mac, self-hosted | The closest match on philosophy: both are free, local-first and self-hostable. Compare setup time, method, menu bar and phone pairing. |
| 7 | **Pocket vs a spreadsheet (Numbers / Google Sheets)** | track spending in Numbers vs an app | Many manual trackers use spreadsheets. Show the same month of entries in both, and what a running balance and forecast cost in each. |
| 8 | **Free YNAB alternatives for Mac without a bank login** | free YNAB alternatives Mac no bank | A fair roundup: Actual, Money Manager Ex, Moneydance (paid), Pocket. Put the leader first and keep Pocket's entry honest. Expect citations more than recommendations. |

Later, if Search Console shows demand: Pocket vs Copilot Money, Pocket vs Money Pro, Pocket vs MoneyWiz.

URLs: `/compare/` hub, `/compare/mac-menu-bar-money-apps/`, `/compare/pocket-vs-ynab/` and so on. This replaces the "not yet" note in SITE-ARCHITECTURE.md now that there is competitor research.

## 3. Use-case pages ([who] + [job])

Some guides already cover this (`freelance-income`, `manual-vs-bank-sync`, `menu-bar-balance`). Add these three:

| # | Page | Why |
| --- | --- | --- |
| 9 | **Track money on Mac when your bank isn't supported** | Plaid-based apps mostly cover the US, Canada and Europe. Pocket works with any currency and no bank connection. Nobody else targets this international angle, and you can write it from experience in Venezuela. |
| 10 | **A money tracker for people paid irregularly** | Turn the `freelance-income` guide into a short landing page that links to it. "Expected vs received" is Pocket's clearest difference. |
| 11 | **Budget without linking your bank account (privacy)** | Finny's and Pocket Clear's lists rank for this. Add the facts they skip: the exact file path, the 7 daily backups, and what the app sends over the network (nothing, unless you set up sync). |

## 4. Definitions and data (cheap, and the formats that earn the most links)

| # | Piece | Format | Notes |
| --- | --- | --- | --- |
| 12 | **"How long will my money last?" calculator** | Free tool at `/tools/money-runway/` | Pocket already calculates "months of money left." Put the same calculation on the web: balance, monthly spending, upcoming bills → months left. Tools earn about 1.4× their share of links, and this one leads straight to the product. |
| 13 | **Short definition pages**: running balance, safe-to-spend, expected vs received income, manual budgeting, personal cash-flow forecast | `/learn/<term>/`, 300–500 words each | Definition pages earn about 1.5× their share of links, and AI quotes definitions word for word. Start each with a one-sentence definition, then a worked example with Pocket's $300 → $280 numbers. |
| 14 | **Bank-sync and money-app privacy statistics (2026)** | Curated stats page with sources | Stats roundups earn about 4× their share of links. Collect sourced facts on aggregator breaches, Plaid coverage and app pricing. Date it and refresh it every quarter. Only cite real sources. |

## 5. Blog posts (the 30% shareable part)

Founder voice, dated and signed. These are what Reddit, Hacker News and DEV.to share. The comments they get become the third-party signal AI relies on.

- **Why I built a money app that never asks for your bank login** (the story, Caracas context, the one-number idea)
- **How Pocket separates recorded and expected money in Swift** (already drafted for DEV.to)
- **Pocket 1.x: what changed and why** (changelog stories; AI reads them as signs the product is maintained)
- Later, once you have real data: "What 3 months of tracking every coffee showed me." Use your own numbers only, never invented ones.

## 6. Off-site (this is what gets you *recommended*)

AI builds its shortlist from what other sites say. Without these, the pages above get Pocket cited but rarely recommended.

1. **AlternativeTo**: list Pocket as an alternative to YNAB, Dime, Money Pro, Actual Budget and Pocket Clear. It showed up repeatedly in today's searches.
2. **r/macapps** and **r/SideProject**: one honest maker post each, following the rules. r/macapps is a common source when AI recommends Mac apps.
3. **Pitch the "best Mac menu bar apps" roundups**: [SupaSidebar](https://supasidebar.com/blog/best-mac-menu-bar-apps-2026), [Timing](https://timingapp.com/blog/best-mac-menu-bar-apps/), [macos-tahoe.com](https://macos-tahoe.com/blog/best-mac-menu-bar-apps-2025-complete-guide/) and [Badgeify](https://badgeify.app/7-best-mac-menu-bar-apps-for-ultimate-productivity-in-2025/). None of them has a finance entry, so it's an easy, specific pitch.
4. **Product Hunt** (draft exists), **Show HN**, **MacUpdate**, and **GitHub topics** on the repo (`macos`, `menu-bar`, `budget`, `personal-finance`, `swiftui`).
5. **Use the same description everywhere**: "Pocket for Mac: a free menu bar app that shows how much money you have left. Manual entry, no bank login, any currency. pocketleft.app." The same sentence on every site helps AI connect them.
6. Consider a **Mac App Store** listing later. App stores are review sources AI trusts, but this is a separate product decision.

## How every page should be built

- Answer the question in the first 40–60 words. AI often quotes only that part.
- One H1 that matches the question. H2s phrased the way people ask.
- At least one table on comparison and facts pages.
- Exact numbers: price, macOS version, file path, number of backups.
- A visible "Updated [date]", an author byline linking to the portfolio, and `Article` or `SoftwareApplication` schema.
- Add each page to the sitemap and `llms.txt`/`llms-full.txt`. Link it from at least two existing pages.
- Never invent ratings, reviews, user counts or money-saved claims (same rule as SEO-SETUP.md).

## Priority order

Scores out of 10 using the content-strategy weights (customer impact 40%, product fit 30%, search potential 20%, effort 10%). Search potential is a judgment, not measured volume.

| Rank | Piece | Impact | Fit | Search | Effort | Total |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `/about/` facts page + FAQ additions | 9 | 10 | 6 | 10 | **8.8** |
| 2 | Mac menu bar money apps compared | 8 | 10 | 7 | 6 | **8.2** |
| 3 | AlternativeTo + r/macapps + roundup pitches | 9 | 8 | 6 | 8 | **8.0** |
| 4 | Pocket vs YNAB | 7 | 8 | 9 | 7 | **7.7** |
| 5 | Pocket vs Actual Budget | 7 | 9 | 6 | 7 | **7.4** |
| 6 | Bank not supported (international) | 7 | 9 | 5 | 8 | **7.3** |
| 7 | Money-runway calculator | 6 | 9 | 7 | 5 | **7.0** |
| 8 | Pocket vs spreadsheet | 6 | 7 | 6 | 8 | **6.5** |
| 9 | Definition pages (5) | 5 | 7 | 6 | 9 | **6.2** |
| 10 | Privacy stats roundup | 5 | 6 | 6 | 5 | **5.5** |

## First six weeks

| Week | Ship | Off-site |
| --- | --- | --- |
| 1 | Bing Webmaster Tools + IndexNow. `/about/` facts page, FAQ additions (incl. Mozilla Pocket), schema `alternateName`/`sameAs`, updated `llms.txt` | GitHub About + topics + release-note line, AlternativeTo listing, same description everywhere |
| 2 | Mac menu bar money apps compared + `/compare/` hub | Pitch the 4 menu bar roundups |
| 3 | Pocket vs YNAB | r/macapps maker post |
| 4 | Pocket vs Actual Budget, bank-not-supported page | Founder blog post → DEV.to, LinkedIn |
| 5 | Money-runway calculator | Show HN or Product Hunt (pick one) |
| 6 | First 3 definition pages | Review the AI prompt check below and adjust |

## Measuring it

Once a month, ask these prompts in ChatGPT, Perplexity, Gemini, Claude and Google, and note whether Pocket is cited, mentioned, recommended or absent:

1. Best Mac app to see my balance in the menu bar
2. Free budget app for Mac without bank login
3. YNAB alternative for Mac that's free
4. Simple money tracker for Mac, manual entry
5. How can I track expected freelance income on Mac?
6. Expense tracker for Mac that works in any currency
7. Local-only personal finance app for macOS
8. What is Pocket for Mac? (checks whether AI gets the name right)
9. Pocket vs Actual Budget
10. How long will my money last calculator

Also watch Search Console for impressions on `/compare/` and `/about/`, branded searches for "pocketleft", and AI referrals in GA4 (chatgpt.com, perplexity.ai). AI referral traffic undercounts the real effect. A rise in branded searches is often the better signal.
