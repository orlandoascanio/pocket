# Pocket

<img src="design/icon-mac-preview.png" width="96" align="right" alt="">

How much money is left, everywhere.

## Pocket for Mac (public)

`mac/` is the version anyone can download. Each person's money stays on their own Mac in one JSON file
(`~/Library/Application Support/Pocket/ledger.json`, with 7 daily backups). There's no account and no server.

- Menubar balance, plus a window with Overview, Plan (forecast chart), Insights and Settings.
- Repeating money that can wait for confirmation, quick-add buttons (⌘1–⌘9), categories, reminders when money is due.
- `swift test` runs the money-logic tests (`mac/Tests`).
- `./mac/build.sh` builds a universal app signed with Developer ID; `NOTARY_PROFILE=<name> ./mac/build.sh --release`
  also notarizes, staples and makes `dist/Pocket-<version>.dmg`.
- Development only: `open mac/dist/Pocket.app --env POCKET_DATA_DIR=/tmp/demo --env POCKET_OPEN=main --env POCKET_SECTION=Plan`
  runs against a separate data folder and opens a window at launch.

### Releasing a new version

One-time setup: save your notarization login in the keychain (needs an app-specific password from account.apple.com):

```bash
xcrun notarytool store-credentials "pocket-notary" --apple-id YOUR_APPLE_ID_EMAIL --team-id VW98Z8698B
```

Then, for each release:

1. Bump the version and build. This builds, signs, notarizes and staples the app and the DMG, then checks both with Gatekeeper:

   ```bash
   NOTARY_PROFILE=pocket-notary VERSION=1.0.1 ./mac/build.sh --release
   ```

2. Publish it. The asset must be named `Pocket.dmg` so the download page's "latest" link keeps working:

   ```bash
   cp mac/dist/Pocket-1.0.1.dmg /tmp/Pocket.dmg
   gh release create v1.0.1 /tmp/Pocket.dmg --repo orlandoascanio/pocket --title "Pocket for Mac 1.0.1" --notes "What changed…" --latest
   ```

3. Check it: `https://github.com/orlandoascanio/pocket/releases/latest/download/Pocket.dmg` should download the new version.

## Pocket (personal, synced)

The rest of this repo is the original synced version: a PWA plus a menubar app backed by Supabase.

- `docs/`: the web app (GitHub Pages). Works on phone and any computer. Add it to your home screen.
- `menubar/`: a native macOS menubar app that shows the balance all day. Build it with `./menubar/build.sh`.
- `supabase/migrations/`: the database. Tables are locked; everything goes through key-gated `pocket_*` functions.
- `supabase/tests/`: database tests. Run `./supabase/tests/run.sh` (everything is rolled back).
- `design/`: the icon source. `swift design/make-icons.swift` regenerates every icon.

What it does:
- One-time spending and income on any date; future dates count when the day arrives.
- Repeating bills, subscriptions and income (weekly, every 2 weeks, monthly, yearly), with or without an end.
  Income can wait for you to confirm it arrived, then "Got it" logs the real amount and date. Pause, skip, or stop any of them.
- Categories, a monthly breakdown, and a forecast (1, 3, 6 or 12 months) of when the money runs out.
- Quick-add buttons (keys 1–9 on the web, ⌘1–⌘9 on the Mac) and keyboard shortcuts (press ? on the web).
- New entries made offline wait on the device and sync when it's back online.
- Devices pair with a 6-digit code from one that's already set up, and can be removed from Settings.
- A daily GitHub Action pings the database so the free Supabase project never pauses.

The secret key is never stored in this repo.
