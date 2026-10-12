# Pocket for Mac: incumbent system comparison

Reviewed 2026-10-12 against the approved daily-money surface contract, PRODUCT.md, representative SwiftUI source, HEAD comparison, and the supplied synthetic native captures. This is a scoped extension of the existing macOS 14+ application.

## Preserved visual system

`PocketCharacter.swift` has no diff: its adaptive warm off-white / near-black palette, Pocket green, negative red, rounded system display font, and pocket-and-coin drawing remain the incumbent source. `Components.swift` retains its existing rounded cards, capsule quick-add controls, SF Symbols, money-row layout and monospaced digits. Overview continues to lead with recorded money, the forecast beneath it, and the same sidebar destinations. PocketCore calculation source has no diff in this review.

The light/dark Overview and menu captures retain those surfaces and the character. The extension changes density and operation: a short entry row replaces the always-expanded details; a native disclosure reveals category, date and repetition; waiting payments collapse to a summary in Overview. The menu source limits waiting previews to two and recent rows to three, scrolls excess body content and keeps the footer outside the scroll view. Long descriptions truncate in the menu while amounts remain visible in the supplied captures.

## Local component extensions

Native buttons now expose history editing, receipt Edit, forecast navigation and menu destinations. Waiting cards reveal actual amount/date and separate confirmation from Skip. Receipt text distinguishes Added from Scheduled. The existing green and red roles carry success and write-failure feedback; no new palette, typography family or raster identity is introduced. Store source commits the candidate ledger only after atomic disk persistence succeeds; editor input remains after a failed save. These changes implement the surface contract without establishing additional permanent product decisions.

## Evidence and limits

The implementation owner reports 20 tests passed and exercised the real app's keyboard add, saved-receipt Edit, and invalid/valid actual-payment confirmation. This documenter inspected source and captures and did not independently rerun tests or builds. Synthetic captures cover both appearances, options and failed Skip feedback; they are review evidence rather than public-release screenshots.

The initial selected-row contrast concern is resolved in the regenerated `overview-light.png` and `overview-dark.png`, both inspected here: selected Overview text and count are now readable in white against the native selection, with the count in a translucent capsule. The incumbent palette and sidebar identity remain intact. The implementation owner also reports the native render test passed; this capture check does not add a live accessibility claim.

Full VoiceOver traversal, the OS Reduce Motion setting, native menu clicks, installation and public release were not verified. Source includes accessibility labels and Reduce Motion checks for several new interactions, which does not establish complete accessibility behavior.

No shipping raster assets were created. No DESIGN.md or design.json was created: this ordinary refinement preserves the incumbent design files and records its comparison here. Unrelated checkout changes were excluded from the design verdict.
