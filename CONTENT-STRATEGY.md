# Pocket content strategy

Prepared October 13, 2026, America/Caracas. Goal: help Mac users discover Pocket, understand its recorded balance and reach the download. Strategy and audience assumptions are provisional; there are no customer interviews, search-volume exports or measured post results available here.

## Current evidence

- The live homepage at [pocketleft.app](https://pocketleft.app/) has a feature tour, FAQ, changelog, real app media and a GitHub self-hosting link. Its main navigation has no guides section. The repository has no dedicated guides routes before this change.
- The local public-post archive has no Pocket records. The owner reports no social posts. This is not an account-wide social-history audit.
- Current source includes optional self-hosted sync. Older product-context notes describe a strictly local app; this strategy follows the current README, website and native source instead.
- Existing assets: Overview and Plan screenshots, and October 12 quick-add and category recordings. No customer results or testimonials are established.

## Three pillars

| Pillar | Topics | Why Pocket can cover it | Product connection |
| --- | --- | --- | --- |
| Know today's recorded balance | Starting amount, first entry, fixed versus variable quick-add, correcting duplicate entries, categories | The owner's stated purpose is to always know how much money is left. The app has a continuously visible balance and specific keyboard workflows. | Overview, menu bar, quick-add, Insights |
| Keep upcoming money visible | Recurring bills, expected income, late payments, actual versus expected amount, forecast assumptions | The waiting-payment workflow gives a concrete way to explain uncertain income without counting it as received. Freelancers are a use-case hypothesis, not a validated primary customer segment. | Plan, confirmation, Got it, pause/skip/stop |
| Keep a usable copy of your data | Local storage, JSON export, seven daily backups, moving Macs, optional self-hosting | Data location and import behavior can be demonstrated from source instead of making broad privacy claims. | Settings, export/import, local and sync modes |

## First priorities

Search targets below are intent hypotheses. Volume, difficulty and ranking potential have not been measured. Priority reflects product usefulness and available evidence, not invented research scores.

| Priority | Piece | Role and format | Target query | Stage | Evidence and added value |
| --- | --- | --- | --- | --- | --- |
| 1 | Get started with Pocket for Mac | Searchable; product setup guide | how to use Pocket for Mac | Implementation | Real first-run labels and a worked balance example. Addresses the owner's observed absence of guides. |
| 2 | Track everyday spending with quick-add buttons | Both; tutorial and native video | Mac expense tracker keyboard shortcuts | Implementation | Existing app recording; fixed versus variable amount and double-entry pitfalls shown directly. |
| 3 | Track expected income before it arrives | Both; use-case guide | track expected income on Mac | Awareness / implementation | Source-backed confirmation behavior, with a $300 expected / $280 received example. Audience interest is suggested by public freelance discussion, not customer interviews. |
| 4 | Back up Pocket and move to a new Mac | Searchable; support guide | back up Pocket for Mac | Implementation | Exact storage path, export/import steps and local-versus-sync distinction. |
| 5 | Introducing Pocket for Mac | Shareable; visual product introduction | Branded discovery | Awareness | Maker voice, real screenshot, direct download destination. Drafts prepared for X and LinkedIn. |
| 6 | How Pocket separates recorded and expected money | Searchable and shareable; technical article | Swift money tracker integer cents | Awareness among developers | Original open-source implementation and a small, exact Swift excerpt. DEV.to draft prepared. |
| 7 | Record a month of subscriptions in Pocket | Both; tutorial | recurring bill tracker for Mac | Consideration / implementation | Future piece: use an illustrative ledger, recurring schedules and the Plan chart. Build after observing setup questions. |
| 8 | Pair Pocket with your phone using your own server | Searchable; technical setup guide | self hosted money tracker Mac phone | Implementation | Existing SELF-HOSTING.md is the source. Future on-site adaptation should preserve claim/setup/keys and timeout semantics. |

## Research and information gain

Queries checked October 13: Mac menu bar money tracker manual balance spending app guide; track expected income; manual expense tracker starting balance; Mac expense tracking keyboard shortcuts; Pocket for Mac backup. Public search is a small qualitative sample, not an SEO ranking report.

| Source read | Observation | What our piece adds |
| --- | --- | --- |
| [Money Pro guide](https://money.pro/guide/) | A broad manual organized around accounts, budgets, bills and reports. | A shorter Pocket-specific route from today's amount to a visible menu bar number. |
| [MoneyPeas manual tracking guide](https://www.moneypeas.app/articles/how-to-track-your-expenses-manually-step-by-step-guide-for-2026) and [Skwad manual accounts](https://skwad.app/book/docs/accounts/manual-accounts) | Explain manual entries and starting balance. | Exact Pocket controls, a running USD example and protection against entering a purchase twice. |
| [Apple keyboard shortcut reference](https://support.apple.com/guide/mac-help/keyboard-shortcuts-mchlgtd_kbd01/mac) | Describes Mac keyboard conventions, rather than a Pocket spending workflow. | An actual Pocket quick-add recording and the distinction between fixed and blank saved amounts. |
| [Invoices Customers cash-flow guide](https://www.invoicesandcustomers.com/blog/freelancer-cash-flow-management) | Discusses freelancers' payment timing. | A source-backed confirmation example showing the actual ledger result when the payment arrives late and smaller. |
| [Freelancer discussion](https://www.reddit.com/r/Freelancers/comments/1tk8vyr/how_do_freelancers_in_the_us_actually_track_their/) | Shows a question about schedule, income and unpaid invoices. | A bounded workflow for expected versus received money. One discussion does not validate market size or customer prevalence. |

The backup query did not establish a strong existing Pocket-specific guide. Our added value is the actual data-file location, replacement behavior and sync-mode limitation. All guide instructions come from Pocket's own implementation; external research supplies topic context, not copied prose.

## Content map

```text
Homepage
└── /guides/ (index)
    ├── /guides/getting-started/
    │   ├── quick-add-spending
    │   ├── expected-income
    │   └── back-up-your-data
    ├── /guides/quick-add-spending/ → setup and expected-income
    ├── /guides/expected-income/ → setup and quick-add
    └── /guides/back-up-your-data/ → setup and GitHub self-hosting

Social demo or example → matching guide → Download for Mac
DEV.to article → source + expected-income guide + homepage
Product Hunt listing → homepage + real app media
```

Every guide has related reading, a working download CTA, a canonical URL, share metadata and sitemap inclusion. `/app/` remains outside the public content sitemap.

## A manageable first two weeks

This is a sequence after website deployment, not a schedule already submitted to a service. Use America/Caracas when a launch date is chosen. Choose posting times when the maker can reply; no best-time claim is supported by account analytics.

| Window | Owned content | Distribution | Asset |
| --- | --- | --- | --- |
| Before first post | Deploy and verify guide routes, media, download and sitemap | Review exact saved copy and the current release | Existing screenshots and recordings |
| Days 1–2 | Setup guide | X introduction, LinkedIn introduction | Overview screenshot |
| Days 3–4 | Quick-add guide | X quick-add post | October 12 quick-add recording |
| Days 5–7 | Expected-income guide | X and LinkedIn worked example | Capture the waiting-payment and confirmation UI before posting |
| Week 2 | Four-guide index and technical explanation | DEV.to article; one Reddit community showcase after checking its current rules | Source excerpt and actual app capture |
| Separate launch decision | Homepage and guides in place | Product Hunt listing and maker comment | Icon, Overview, Plan and quick-add media |

Reddit drafts must disclose the maker relationship and follow the destination community's current promotion rules. Start with the prepared r/SideProject draft. Do not copy the same announcement into many communities. Product Hunt stays a draft until its listing, assets and launch date are ready.

For subsequent content, use roughly 60% searchable help, 30% shareable examples and 10% experiments. Start with one useful guide and two adaptations per week, then change cadence using measured responses. The first kit is deliberately weighted toward explaining the product.

## Draft inventory and publication workflow

Exact text lives in `/Users/orlando/Desktop/Me/posts/drafts/` under the `2026-10-13-*-pocket-*.md` filenames:

- Four website article drafts matching the on-site guide source.
- Three X posts: introduction, quick-add and expected income.
- Two LinkedIn posts: introduction and expected income.
- One Reddit post intended for r/SideProject.
- One DEV.to technical article.
- Product Hunt listing and separate maker-comment drafts.

All records have `status: draft`, `url: null` and empty metrics. Nothing has been posted or scheduled. Posts linking to new guide routes wait until those pages are live. Follow [the archive README](/Users/orlando/Desktop/Me/posts/README.md): update exact draft text before any external editor, verify publication and its URL, then move only that published record out of drafts.

## Measure before expanding

- Record the verified URL and publication date for each piece. Add observed platform metrics with an `as_of` date after 48 hours and seven days. Unknown metrics remain empty.
- Check Search Console for guide impressions, queries and clicks after data is available. Candidate keywords are not guaranteed traffic sources.
- Existing consenting website analytics records public page views and `download_clicked`. Compare guide-page sessions and download intent when dashboards have usable data. A click is not an installation.
- Campaign query parameters are intentionally omitted by the current analytics contract. Do not promise per-post attribution from UTM links. Use observed platform outbound clicks and guide-page results; exact post-to-install conversion is not established.
- Record setup questions in the strategy working notes, then make the next guide answer a real repeated question. Do not invent testimonials, adoption counts or money-saved claims.

## DEV.to headline exploration

Before drafting, considered these ten titles:

1. How Pocket separates recorded and expected money in Swift (selected)
2. Building a Mac money tracker around one visible balance
3. A Swift ledger for money that has arrived and money that has not
4. Keeping a Mac menu bar balance honest
5. Recording late payments in a Swift money tracker
6. Integer cents and planned payments in Pocket for Mac
7. From expected payment to recorded entry in Swift
8. Inside Pocket's local money ledger
9. Why Pocket's forecast and balance use different inputs
10. A small Swift engine behind a Mac money tracker

The selected title names the exact mechanism the article can demonstrate. Editing passes cover structure, product accuracy, example arithmetic, plain language and title/link review.

## Local validation

- `npm run check` passed TypeScript and the existing analytics-consent/Sentry-redaction checks. `npm run build` generated the guide index and all four articles as static pages.
- Guide routes returned HTTP 200; an unknown guide returned 404. Media URLs responded successfully, guide URLs appeared in the sitemap, and `/app/` retained its `noindex` header.
- Browser checks found no document overflow at 320, 390, 820, 1024 and 1440 pixels across the five guide pages. A 320px navigation overflow was corrected. The mobile menu linked to the guide index and closed after navigation.
- The quick-add video has controls, no autoplay and `preload="none"`. Guide download navigation opened the install dialog with its fallback link; completed file transfer and installation were not verified.
- Browser screenshot capture timed out, so screenshot-based visual review remains unverified. DOM layout and interaction checks completed.
- Website draft paragraphs and media captions match the guide source. X drafts fit the standard 280-character budget with URL lengths accounted for. All thirteen archive records remain drafts.
- No changes were deployed, committed or pushed, and no external posts or schedules were created during this task.
