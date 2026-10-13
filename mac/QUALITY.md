# Pocket for Mac quality review

Reviewed October 12, 2026. Scope: the native Mac app in this checkout, including local persistence and the existing account-sync client. The checkout was clean before the review. No installed app or published release was replaced.

## Changes

| Area | Problem corrected | Result |
| --- | --- | --- |
| Amount input | Arbitrary text and malformed separators could be discarded and interpreted as money. Onboarding treated invalid input as zero. | Parsing validates the complete input and calculates integer cents directly. Onboarding accepts an explicit zero or a blank starting amount and explains invalid input. |
| Starting balance | Editing the starting balance cleared its category, so Insights counted it as income. | The starting-balance category survives editing, including a correction to zero. |
| Quick-add settings | Every keystroke wrote to disk and could enqueue a sync request. Invalid amounts silently became “ask each time.” | A testable editor holds a draft, validates it, and saves the complete button once. Failed saves retain the draft. Save and Revert appear when needed; unchanged fields preserve updates received elsewhere. |
| Saved data | An unreadable ledger was replaced in memory with an empty one that could then overwrite the file. Imports had no semantic validation. | A recovery state preserves the unreadable file and blocks ordinary writes. Imports and initial reads validate versions, dates, identifiers, amounts, presets, schedules, and safe totals. Recovery offers Finder, retry, and Settings access. |
| Payment actions | A previously displayed occurrence could still be confirmed after its rule was paused. | Confirmation and skipping require a current, active occurrence. Existing duplicate-post and failed-write protections remain covered. |
| Account persistence | A failed account-copy save could report a successful sync; disconnect cleared credentials before the local copy was saved. | Failed adoption retains the balance and last-sync time. Disconnect retains account access until the local copy is saved. |
| Navigation and layout | Sidebar labels had contrast problems; Plan rows used pointer-only gestures; balance context could crowd at minimum width. | Explicit sidebar foregrounds, native Edit buttons, accessible month controls, and layouts that adapt to available width. The entry sheet is height-bounded and its form can scroll. |
| Entry options and motion | Date and repetition were buried in the category menu; several controls ignored Reduce Motion. | A visible options button sits beside the amount. Shared button styles and chart/period transitions honor Reduce Motion. Typed signs use one editor-state implementation across forms. |

The established Pocket character, palette, rounded surfaces, monospaced amounts, sidebar destinations, and balance-first information hierarchy are preserved. Currency settings now explain that changing the identifier does not convert recorded money. Onboarding describes optional account connection accurately.

## Verification

- Final `swift test`: 41 behavioral tests passed with no failures; the separate opt-in native-render test was skipped in this final run.
- The native-render test passed earlier in this review. Two bounded render-review rounds covered light/dark Overview, menu, Plan, Insights, Settings, and entry sheets, including 780 × 560 windows, long descriptions, 12 waiting payments, a zero balance, a large negative balance, and failed writes. Additional captures cover minimum-width Plan/Settings and onboarding. Captures are synthetic app renders, not published product screenshots.
- Render evidence: `/tmp/pocket-review-before/` and `/tmp/pocket-review-after/`. The second round prompted the final explicit sidebar foreground and chart-axis anchor corrections; those final corrections were build-checked rather than given an additional visual review round.
- `./mac/build.sh` builds and signs the universal app. `codesign --verify --strict` verifies its signature; `xcrun vtool -show-build` verifies arm64 and x86_64 slices with minimum macOS 14.0.
- `git diff --check` passes.

The initial native UI automation returned `timeoutReached`, so the initial review did not establish live keyboard/mouse traversal, full VoiceOver behavior, OS notification delivery, or login-item behavior. Account tests use a mocked server and do not establish production sync or backend availability. Notarization, installation, and publication are outside this validation.

The result is a locally built and tested improvement with explicit verification boundaries; it is not a claim that every release or production path has been exercised.

## Follow-up: quick-add scrolling

The reported three-finger gesture could not move the horizontal row because the original SwiftUI ScrollView supported wheel scrolling but did not pan on a drag. The shared row now uses a native horizontal scroll view with an AppKit pan recognizer. It supports pointer dragging, including mouse events produced by macOS's enabled three-finger drag setting. Previous/next controls appear for overflow; ordinary two-finger scrolling remains native. A recognized drag suppresses the corresponding button activation so browsing does not record money.

Latest full test run: 46 tests passed, with the opt-in full-screen render test skipped. Five new tests mount the real row inside an AppKit window and verify paging bounds, the short-row state, synthesized native dragging without adding an entry, a normal click immediately afterward, the Command-9 shortcut for a hidden preset, and accessible button exposure. The capsules are native AppKit buttons using the existing palette and SF Symbols. These are synthesized mouse events; a physical three-finger trackpad gesture remains untested.

The running development build was reloaded on its original data directory. Native UI access worked in this follow-up: the finished row's appearance and accessible preset labels were inspected. Its recorded balance remained unchanged during the reload and inspection. The installed `/Applications/Pocket.app` was not replaced.
