#!/bin/zsh
# Builds Pocket.app (Apple Silicon + Intel) and signs it with your Developer ID.
#
#   ./build.sh             build + sign            -> dist/Pocket.app
#   ./build.sh --release   also notarize + staple  -> dist/Pocket-<version>.dmg
#
# --release needs NOTARY_PROFILE: the keychain profile you created with
#   xcrun notarytool store-credentials <name> --apple-id <you> --team-id VW98Z8698B
set -euo pipefail
cd "${0:A:h}"

VERSION=${VERSION:-1.0.0}
BUILD_NUMBER=${BUILD_NUMBER:-1}
IDENTITY=${IDENTITY:-"Developer ID Application: Manuel Cabeza (VW98Z8698B)"}
BUNDLE_ID=${BUNDLE_ID:-com.orlandoascanio.pocket.mac}
APP=dist/Pocket.app

echo "› Building"
swift build -c release --arch arm64 --arch x86_64
BIN="$(swift build -c release --arch arm64 --arch x86_64 --show-bin-path)/Pocket"

rm -rf dist
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/Pocket"
iconutil -c icns ../menubar/AppIcon.iconset -o "$APP/Contents/Resources/AppIcon.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Pocket</string>
  <key>CFBundleDisplayName</key><string>Pocket</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleExecutable</key><string>Pocket</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$BUILD_NUMBER</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.finance</string>
  <key>LSUIElement</key><true/>
  <key>NSHumanReadableCopyright</key><string>Your money stays on your Mac.</string>
</dict>
</plist>
PLIST

echo "› Signing with $IDENTITY"
codesign --force --options runtime --timestamp --sign "$IDENTITY" "$APP"
codesign --verify --strict --verbose=2 "$APP"

if [[ "${1:-}" != "--release" ]]; then
  echo "✓ Built $APP (signed, not notarized). Run with: open $APP"
  exit 0
fi

: "${NOTARY_PROFILE:?Set NOTARY_PROFILE to your notarytool keychain profile name}"

echo "› Notarizing the app"
ditto -c -k --keepParent "$APP" dist/Pocket.zip
xcrun notarytool submit dist/Pocket.zip --keychain-profile "$NOTARY_PROFILE" --wait
xcrun stapler staple "$APP"

echo "› Making the disk image"
DMG="dist/Pocket-$VERSION.dmg"
mkdir -p dist/dmg
cp -R "$APP" dist/dmg/
ln -s /Applications dist/dmg/Applications
hdiutil create -volname "Pocket" -srcfolder dist/dmg -ov -format UDZO "$DMG" >/dev/null
codesign --force --timestamp --sign "$IDENTITY" "$DMG"

echo "› Notarizing the disk image"
xcrun notarytool submit "$DMG" --keychain-profile "$NOTARY_PROFILE" --wait
xcrun stapler staple "$DMG"

echo "› Checking with Gatekeeper"
spctl --assess --type execute --verbose "$APP"
spctl --assess --type open --context context:primary-signature --verbose "$DMG"
rm -rf dist/dmg dist/Pocket.zip
echo "✓ $DMG is signed, notarized and stapled."
