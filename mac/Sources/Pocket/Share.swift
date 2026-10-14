import AppKit

/// The macOS share sheet for telling someone about Pocket. The message is fixed text and a link:
/// it never includes a balance, entry or anything else from the ledger.
enum SharePocket {
    static let message = "I use Pocket to keep my balance in the Mac menu bar. It's free, open source, and your data stays on your Mac."
    /// A separate page so the website can count visits that came from a share (its analytics drop query strings).
    static let link = URL(string: "https://pocketleft.app/share/")!

    static func show() {
        NSApp.activate(ignoringOtherApps: true)
        guard let view = (NSApp.keyWindow ?? NSApp.windows.first { $0.isVisible && $0.canBecomeKey })?.contentView else {
            // No window to anchor the sheet to: copy the message so the action still does something useful.
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString("\(message) \(link.absoluteString)", forType: .string)
            return
        }
        let picker = NSSharingServicePicker(items: [message, link])
        picker.show(relativeTo: NSRect(x: view.bounds.midX, y: view.bounds.maxY - 1, width: 1, height: 1), of: view, preferredEdge: .minY)
    }
}
