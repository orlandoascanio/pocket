---
version: 1
slug: "pocket-mac-sources-pocket-mainwindow-swift"
primary_target: "pocket/mac/Sources/Pocket/MainWindow.swift"
related_targets: ["pocket/mac/Sources/Pocket/MenuPanel.swift","pocket/mac/Sources/Pocket/EntryEditor.swift"]
---

# Pocket daily money flow

Mode: Operate. Audience: Mac users who want to always know how much money they have left.

Approved scope: Overview, menu panel, entry controls, waiting payment confirmation, save feedback. Keep the current character, warm neutral palette, green accent, sidebar, ledger format, and calculation rules. No accounts or synced-version work. Native macOS code-first; the image-first preference covers marketing surfaces.

## Direction contract

THESIS: See the balance, record a change, understand the result. Keep daily entry compact and reveal scheduling details inline.

OWN-WORLD: Existing warm neutral and near-black surfaces, Pocket green, red negative amounts, system typography and rounded balance numerals, native controls, the existing pocket-and-coin character.

STORY: Current recorded money comes first; forecasts remain conditional on plans. Entries and confirmations update the balance only after disk persistence succeeds. Failed actions keep their input.

FIRST VIEWPORT: Overview has the balance and forecast, a compact waiting summary, presets and a short entry form, then history. Menu has balance, quick entry, two waiting previews, three recent rows, and a fixed footer; excess content scrolls.

FORM: Local refinements of established screens approved through shape. No concept seed applies to this precisely scoped existing-surface refinement. Edits are native buttons, options use disclosures, menu drafts transfer into Overview.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Verification

Native light/dark captures at 1000 × 780 and 780 × 560, menu at 380px, options, long descriptions, 12 waiting payments, large negative balances, and write failure. Isolated tests verify atomic saves, retained drafts, no duplicate payment posting, and draft handoff. Live accessibility and native clicks must be reported at their actual tested scope. This refinement reuses the visual system; no new shipping raster is created.
