// Draws the disk image window background: `swift design/make-dmg-background.swift`
// Writes mac/dmg/background.png (1x) and background@2x.png; build.sh combines them.
// Layout must match mac/dmg/settings.py: a 640 × 400 window, icons centered at (170, 196) and (470, 196).
import AppKit

let size = NSSize(width: 640, height: 400)
let bg = NSColor(srgbRed: 0xF6/255, green: 0xF5/255, blue: 0xF2/255, alpha: 1)
let ink = NSColor(srgbRed: 0x1B/255, green: 0x1B/255, blue: 0x1A/255, alpha: 1)
let muted = NSColor(srgbRed: 0x6A/255, green: 0x68/255, blue: 0x62/255, alpha: 1)
let line = NSColor(srgbRed: 0xE4/255, green: 0xE2/255, blue: 0xDC/255, alpha: 1)
let accent = NSColor(srgbRed: 0x1D/255, green: 0x6B/255, blue: 0x47/255, alpha: 1)

func rounded(_ size: CGFloat, _ weight: NSFont.Weight) -> NSFont {
    let base = NSFont.systemFont(ofSize: size, weight: weight)
    return NSFont(descriptor: base.fontDescriptor.withDesign(.rounded) ?? base.fontDescriptor, size: size) ?? base
}

func centered(_ text: String, font: NSFont, color: NSColor, y: CGFloat, kern: CGFloat = 0) {
    let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .kern: kern]
    let s = NSAttributedString(string: text, attributes: attrs)
    let w = s.size().width
    s.draw(at: NSPoint(x: (size.width - w) / 2, y: size.height - y - s.size().height))
}

func render(scale: CGFloat, to path: String) {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(size.width * scale), pixelsHigh: Int(size.height * scale),
                               bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                               colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    rep.size = size
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    bg.setFill(); NSRect(origin: .zero, size: size).fill()

    centered("Drag Pocket into Applications", font: rounded(22, .bold), color: ink, y: 46, kern: -0.3)
    centered("Then open it from Applications. Your balance appears in the menu bar.", font: .systemFont(ofSize: 12.5), color: muted, y: 80)

    // Soft wells behind the two icons.
    for x in [170.0, 470.0] {
        // Tall enough for the icon and the name Finder draws under it.
        let well = NSBezierPath(roundedRect: NSRect(x: x - 84, y: size.height - 300, width: 168, height: 192), xRadius: 32, yRadius: 32)
        NSColor.white.withAlphaComponent(0.75).setFill(); well.fill()
        line.setStroke(); well.lineWidth = 1; well.stroke()
    }

    // A dashed arrow from Pocket to Applications.
    let y = size.height - 196
    let arrow = NSBezierPath()
    arrow.move(to: NSPoint(x: 262, y: y)); arrow.line(to: NSPoint(x: 370, y: y))
    arrow.lineWidth = 3; arrow.lineCapStyle = .round
    arrow.setLineDash([2, 9], count: 2, phase: 0)
    accent.setStroke(); arrow.stroke()
    let head = NSBezierPath()
    head.move(to: NSPoint(x: 366, y: y + 10)); head.line(to: NSPoint(x: 378, y: y)); head.line(to: NSPoint(x: 366, y: y - 10))
    head.lineWidth = 3; head.lineCapStyle = .round; head.lineJoinStyle = .round
    head.stroke()

    // Nothing below y ≈ 330: Finder's path and status bars, when someone has them on, cover the bottom.
    NSGraphicsContext.restoreGraphicsState()
    try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}

let dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("mac/dmg").path
render(scale: 1, to: dir + "/background.png")
render(scale: 2, to: dir + "/background@2x.png")
print("Wrote \(dir)/background.png and background@2x.png")
