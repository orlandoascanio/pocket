#!/bin/zsh
# Builds Pocket Sync.app (the personal, synced menubar app) and installs it into /Applications.
# Usage: ./build.sh            (reads SUPABASE_PUBLISHABLE_KEY from ../.secrets.env if present)
set -euo pipefail
cd "${0:A:h}"

[[ -f ../.secrets.env ]] && source ../.secrets.env
: "${SUPABASE_PUBLISHABLE_KEY:?set SUPABASE_PUBLISHABLE_KEY}"

BUILD=build
APP="$BUILD/Pocket Sync.app"
rm -rf "$BUILD"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

sed "s|__SUPABASE_PUBLISHABLE_KEY__|$SUPABASE_PUBLISHABLE_KEY|" Pocket.swift > "$BUILD/Pocket.swift"
swiftc -O -parse-as-library -swift-version 5 \
  -target "$(uname -m)-apple-macos14" \
  "$BUILD/Pocket.swift" -o "$APP/Contents/MacOS/Pocket"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Pocket Sync</string>
  <key>CFBundleDisplayName</key><string>Pocket Sync</string>
  <key>CFBundleIdentifier</key><string>com.orlandoascanio.pocket</string>
  <key>CFBundleExecutable</key><string>Pocket</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
PLIST

# App icon (generate the iconset with: swift design/make-icons.swift)
if [[ -d AppIcon.iconset ]]; then
  iconutil -c icns AppIcon.iconset -o "$APP/Contents/Resources/AppIcon.icns"
fi

codesign --force --sign - "$APP"

pkill -f "/Applications/Pocket Sync.app/Contents/MacOS/Pocket" 2>/dev/null || true
rm -rf "/Applications/Pocket Sync.app"
cp -R "$APP" /Applications/
open "/Applications/Pocket Sync.app"
echo "Installed /Applications/Pocket Sync.app"
