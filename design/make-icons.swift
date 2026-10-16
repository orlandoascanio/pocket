// Renders design/icon.svg into every icon the apps need.
// Usage: swift design/make-icons.swift   (run from the repo root)
import AppKit

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let svg = try! Data(contentsOf: root.appendingPathComponent("design/icon.svg"))
let art = NSImage(data: svg)!

func render(_ px: Int, draw: (NSRect) -> Void) -> Data {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8,
                               samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                               colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    rep.size = NSSize(width: px, height: px)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    NSGraphicsContext.current?.imageInterpolation = .high
    draw(NSRect(x: 0, y: 0, width: px, height: px))
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}

// Full-bleed square: iOS / Android mask it themselves.
func fullBleed(_ px: Int) -> Data { render(px) { art.draw(in: $0) } }

// macOS: rounded square on the 1024 grid (824 body, 100 margin) with a soft shadow.
func macIcon(_ px: Int) -> Data {
    render(px) { r in
        let s = CGFloat(px) / 1024
        let body = NSRect(x: 100 * s, y: 100 * s, width: 824 * s, height: 824 * s)
        let path = NSBezierPath(roundedRect: body, xRadius: 185 * s, yRadius: 185 * s)
        NSGraphicsContext.saveGraphicsState()
        let shadow = NSShadow()
        shadow.shadowColor = NSColor.black.withAlphaComponent(0.3)
        shadow.shadowBlurRadius = 20 * s
        shadow.shadowOffset = NSSize(width: 0, height: -10 * s)
        shadow.set()
        NSColor(red: 0.08, green: 0.32, blue: 0.21, alpha: 1).setFill()
        path.fill()
        NSGraphicsContext.restoreGraphicsState()
        NSGraphicsContext.saveGraphicsState()
        path.addClip()
        art.draw(in: body)
        NSGraphicsContext.restoreGraphicsState()
    }
}

func write(_ data: Data, _ rel: String) {
    let url = root.appendingPathComponent(rel)
    try! FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    try! data.write(to: url)
}

write(fullBleed(180), "docs/apple-touch-icon.png")
write(fullBleed(192), "docs/icon-192.png")
write(fullBleed(512), "docs/icon-512.png")
try? FileManager.default.removeItem(at: root.appendingPathComponent("docs/icon.svg"))
try! FileManager.default.copyItem(at: root.appendingPathComponent("design/icon.svg"),
                                  to: root.appendingPathComponent("docs/icon.svg"))

let iconset = "mac/AppIcon.iconset"
try? FileManager.default.removeItem(at: root.appendingPathComponent(iconset))
for s in [16, 32, 128, 256, 512] {
    write(macIcon(s), "\(iconset)/icon_\(s)x\(s).png")
    write(macIcon(s * 2), "\(iconset)/icon_\(s)x\(s)@2x.png")
}
write(macIcon(1024), "design/icon-mac-preview.png")

// Pocket for iPhone and Android (mobile/, an Expo app). iOS masks the full-bleed square itself; Android's
// adaptive icon gets the same art as its foreground (the coin and pocket sit inside the safe zone) on a green
// background. The splash screen shows the pocket and coin alone.
let mark = NSImage(data: String(decoding: svg, as: UTF8.self)
    .replacingOccurrences(of: #"<rect width="1024" height="1024" fill="url(#bg)"/>"#, with: "")
    .data(using: .utf8)!)!
write(fullBleed(1024), "mobile/assets/icon.png")
write(fullBleed(1024), "mobile/assets/android-icon-foreground.png")
write(render(1024) { r in NSColor(red: 0.08, green: 0.32, blue: 0.21, alpha: 1).setFill(); r.fill() },
      "mobile/assets/android-icon-background.png")
write(render(1024) { mark.draw(in: $0) }, "mobile/assets/splash-icon.png")
write(fullBleed(48), "mobile/assets/favicon.png")
print("icons written")
