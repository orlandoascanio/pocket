# Pocket referral and word-of-mouth strategy

Prepared October 13, 2026. Scope: public Pocket for Mac and pocketleft.app. Recommendations are provisional. There are no customer interviews, referral data or measured share rates yet.

## Current evidence

- **Price and economics:** Pocket is free, with every feature (`web/app/page.tsx`). It has no revenue, so LTV and CAC are both $0. There is nothing to fund a cash or discount reward.
- **No accounts or backend:** The public app stores its ledger locally. It has no user identity to attach a referral code to, and nowhere to credit a reward. Adding either would be a product decision under `PRODUCT.md` → Open decisions.
- **Distribution:** GitHub releases. On October 13 the GitHub API reported **0 stars, 0 forks**, and DMG `download_count` of 10 (1.1.0), 1 (1.0), 1 (1.2.0) and 5 (1.2.3), about 17 in total. Some of these downloads are probably the owner's own.
- **Existing outbound links:** The About panel (`mac/Sources/Pocket/Updates.swift`, `AboutPanel`) links to pocketleft.app and the source code. The app has no share action.
- **Website measurement:** Opt-in Google Analytics tracks page visits and download clicks. **It omits URL query strings** (`web/app/privacy/page.tsx`), so `?ref=` or UTM links cannot attribute shares. Attribution needs a dedicated path instead.

## Diagnosis

| Question | Answer | Consequence |
| --- | --- | --- |
| Reward-based referral program? | No. There is no money for rewards and no identity to credit them to. | Skip incentives entirely. |
| Affiliate program? | No. A $0 product cannot pay commission. | Skip it. Creator outreach without payment belongs in `influencer-marketing`. |
| Natural viral potential? | **Limited.** Personal finance is private. Pocket creates no output that non-users see, and people don't share their balance. | Don't force exposure loops. Never put a balance in share text. |
| What can work? | Word-of-mouth from people who value a free, private, open-source tool, plus open-source social proof (stars). | Make sharing easy at the right moment, and make the result measurable. |
| Is now the time? | Referrals multiply an existing user base, and Pocket's base is still very small. | Build the cheap mechanics now. Spend most acquisition effort on content and directories (`CONTENT-STRATEGY.md`) until there are users to refer. |

## Recommendations

### 1. Add a "Share Pocket…" action (always available)

- Add it to the app menu next to "Check for Updates…" and to the About panel.
- Use `NSSharingServicePicker` (the macOS share sheet: Messages, Mail, AirDrop, Copy Link).
- Pre-written text, with no money data in it:
  > I use Pocket to keep my balance in the Mac menu bar. It's free, open source, and your data stays on your Mac: https://pocketleft.app/share/
- Effort: small. It doesn't need a backend and doesn't change any data behavior.

### 2. Ask once, at a moment of value

Trigger a single, quiet, non-modal suggestion ("Know someone who'd like Pocket?" with **Share…** and **Not now**) at the first of these moments:

- The user clicks **Got it** on a waiting payment for the first time. This is the expected-versus-received moment that the product is built around.
- Or the ledger reaches about 30 entries over at least 14 days, which suggests the habit has formed.

Rules:

- Show it once. **Not now** dismisses it permanently, and the menu action stays available.
- Never show it during first run or in the middle of entering an amount.
- Store the dismissal flag in `UserDefaults`, not in the ledger, so exports stay clean.

### 3. Create a share landing path: `pocketleft.app/share/`

- This path exists for attribution. GA drops query strings but keeps paths, so visits and download clicks from `/share/` can be counted separately.
- Content: the homepage hero plus one line of social framing, such as "A friend thought you'd like this." Keep the same download button and the free/no-account/local-data facts.
- Set `noindex` so it doesn't compete with the homepage, and canonicalize it to `/`.

### 4. Ask for GitHub stars where developers already look

- The repo has 0 stars, and stars are the open-source equivalent of reviews.
- Add a "Star on GitHub" link in the About panel, the release notes and the site footer. Don't add a prompt for it inside the app.
- Stars may also matter later for a Homebrew cask, which would make the share instruction a one-line `brew install`. Check Homebrew's current notability rules before planning around this.

### 5. Directories and reviews (handled separately)

Product Hunt, AlternativeTo, MacUpdate and the r/macapps-style communities are where people find free Mac utilities. Use the `directory-submissions` skill for those. They're acquisition channels, not referral mechanics. Before offering anything in exchange for reviews, check `review-platform-rules`.

## Not recommended

- Cash, gift card or "unlock" rewards: there's nothing to unlock, and every feature is already free.
- Referral codes or in-app tracking of who invited whom: this needs an identity and a backend, and it conflicts with the local-first positioning.
- Telemetry from the app to measure share clicks. Measure on the website instead.
- Any share content that includes balances, categories or screenshots of real data.

## Measurement

| Metric | Source | Note |
| --- | --- | --- |
| Visits and download clicks on `/share/` | GA (opt-in only, so it undercounts) | The main referral signal. Report it as a floor, not a total. |
| DMG downloads per release | GitHub API `download_count` | The only download count that doesn't depend on consent. Compare the 30 days before and after shipping 1 + 2. |
| GitHub stars | GitHub API | Social proof trend. |
| `/share/` share of all download clicks | GA | Shows whether word-of-mouth is a real channel yet. |

Review this 30 and 60 days after shipping. With volumes this small, look at direction, not rates.

## Revisit when

- Pocket adds paid features, a paid tier or accounts. At that point a double-sided reward becomes possible and the program-design guidance applies.
- Downloads reach a level where the share/download ratio is meaningful (hundreds a month, not tens).
