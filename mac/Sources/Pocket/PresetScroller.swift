import AppKit
import PocketCore
import SwiftUI

/// Keeps paging controls in sync with native scrolling without owning the scroll view.
@MainActor
final class PresetScrollState: ObservableObject {
    @Published private(set) var canScrollBack = false
    @Published private(set) var canScrollForward = false
    var suppressActivation = false
    var overflows: Bool { canScrollBack || canScrollForward }
    weak var scrollView: PresetScrollView?

    func page(_ direction: CGFloat) {
        guard let scrollView else { return }
        scrollView.scrollHorizontally(to: scrollView.contentView.bounds.minX + direction * max(80, scrollView.contentSize.width * 0.8))
    }

    func refresh() {
        guard let scrollView else { return }
        let offset = scrollView.contentView.bounds.minX
        let back = offset > 1
        let forward = offset < scrollView.maximumOffset - 1
        if canScrollBack != back { canScrollBack = back }
        if canScrollForward != forward { canScrollForward = forward }
    }
}

/// Native wheel scrolling plus click-drag, including macOS's accessibility three-finger drag.
/// Delaying primary-button events lets the pan cancel a button press before it records money.
final class PresetScrollView: NSScrollView, NSGestureRecognizerDelegate {
    weak var state: PresetScrollState?
    private var dragOrigin: CGFloat?
    private lazy var pan = NSPanGestureRecognizer(target: self, action: #selector(panChanged(_:)))

    var maximumOffset: CGFloat { max(0, (documentView?.frame.width ?? 0) - contentSize.width) }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        drawsBackground = false
        hasHorizontalScroller = false
        hasVerticalScroller = false
        horizontalScrollElasticity = .none
        verticalScrollElasticity = .none
        pan.delegate = self
        pan.delaysPrimaryMouseButtonEvents = true
        addGestureRecognizer(pan)
        contentView.postsBoundsChangedNotifications = true
        NotificationCenter.default.addObserver(self, selector: #selector(boundsChanged), name: NSView.boundsDidChangeNotification, object: contentView)
        setAccessibilityLabel("Quick-add buttons")
        setAccessibilityHelp("Scroll sideways or drag to see more buttons. Previous and next buttons are available when the row overflows.")
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    deinit { NotificationCenter.default.removeObserver(self) }

    override func layout() {
        super.layout()
        guard let documentView else { return }
        let width = max(contentSize.width, documentView.fittingSize.width)
        let size = NSSize(width: width, height: max(34, contentSize.height))
        if documentView.frame.size != size { documentView.setFrameSize(size) }
        pan.isEnabled = maximumOffset > 1
        scrollHorizontally(to: contentView.bounds.minX)
    }

    func scrollHorizontally(to offset: CGFloat) {
        contentView.scroll(to: NSPoint(x: min(maximumOffset, max(0, offset)), y: 0))
        reflectScrolledClipView(contentView)
        updateControls()
    }

    func gestureRecognizerShouldBegin(_ gestureRecognizer: NSGestureRecognizer) -> Bool {
        guard gestureRecognizer === pan, maximumOffset > 1 else { return false }
        let translation = pan.translation(in: self)
        // AppKit may ask before it has supplied the initial translation.
        return translation == .zero || abs(translation.x) > abs(translation.y)
    }

    func gestureRecognizer(_ gestureRecognizer: NSGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: NSGestureRecognizer) -> Bool {
        gestureRecognizer === pan
    }

    @objc private func panChanged(_ recognizer: NSPanGestureRecognizer) {
        switch recognizer.state {
        case .began:
            dragOrigin = contentView.bounds.minX
            state?.suppressActivation = true
            fallthrough
        case .changed, .ended:
            if let origin = dragOrigin { scrollHorizontally(to: origin - recognizer.translation(in: self).x) }
            if recognizer.state == .ended { finishDrag() }
        case .cancelled, .failed:
            finishDrag()
        default: break
        }
    }

    private func finishDrag() {
        dragOrigin = nil
        // A SwiftUI button can receive the same mouse-up. Ignore that activation, then allow the next click.
        DispatchQueue.main.async { [weak self] in self?.state?.suppressActivation = false }
    }

    @objc private func boundsChanged() { updateControls() }

    private func updateControls() {
        // Layout can run during a SwiftUI update; publish after that transaction finishes.
        DispatchQueue.main.async { [weak self] in self?.state?.refresh() }
    }
}

/// Keep the buttons native inside the native scroller, including their accessibility and shortcuts.
struct PresetScroller: NSViewRepresentable {
    let state: PresetScrollState
    let presets: [Preset]
    let money: Money
    let onUse: (Preset) -> Void
    @Environment(\.isEnabled) private var enabled

    func makeNSView(context: Context) -> PresetScrollView {
        let scrollView = PresetScrollView()
        let stack = NSStackView(frame: NSRect(x: 0, y: 0, width: 340, height: 34))
        stack.orientation = .horizontal
        stack.spacing = 6
        stack.alignment = .centerY
        stack.edgeInsets = NSEdgeInsets(top: 0, left: 1, bottom: 0, right: 1)
        scrollView.documentView = stack
        scrollView.state = state
        state.scrollView = scrollView
        return scrollView
    }

    func updateNSView(_ scrollView: PresetScrollView, context: Context) {
        guard let stack = scrollView.documentView as? NSStackView else { return }
        let buttons = stack.arrangedSubviews.compactMap { $0 as? PresetButton }
        if buttons.map(\.presetID) != presets.map(\.id) {
            for view in stack.arrangedSubviews { stack.removeArrangedSubview(view); view.removeFromSuperview() }
            for preset in presets { stack.addArrangedSubview(PresetButton(presetID: preset.id)) }
        }
        for (index, preset) in presets.enumerated() {
            guard let button = stack.arrangedSubviews[index] as? PresetButton else { continue }
            let title = NSMutableAttributedString(string: preset.label, attributes: [
                .font: NSFont.systemFont(ofSize: 12, weight: .medium), .foregroundColor: NSColor.labelColor
            ])
            if let cents = preset.cents {
                title.append(NSAttributedString(string: "  " + money.string(preset.sign * cents, signed: preset.sign > 0), attributes: [
                    .font: NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .regular), .foregroundColor: NSColor.secondaryLabelColor
                ]))
            }
            button.attributedTitle = title
            let configuration = NSImage.SymbolConfiguration(pointSize: 11, weight: .semibold)
                .applying(NSImage.SymbolConfiguration(paletteColors: [NSColor(Categories.tint(preset.category, cents: preset.sign))]))
            button.image = NSImage(systemSymbolName: Categories.symbol(preset.category, cents: preset.sign), accessibilityDescription: nil)?
                .withSymbolConfiguration(configuration)
            button.image?.isTemplate = false
            button.isEnabled = enabled
            button.keyEquivalent = index < 9 ? String(index + 1) : ""
            button.keyEquivalentModifierMask = .command
            button.toolTip = index < 9 ? "\(preset.label) (⌘\(index + 1))" : preset.label
            button.setAccessibilityLabel(title.string)
            button.onPress = { if !state.suppressActivation { onUse(preset) } }
            button.invalidateIntrinsicContentSize()
        }
        stack.setFrameSize(NSSize(width: max(scrollView.contentSize.width, stack.fittingSize.width), height: 34))
        scrollView.needsLayout = true
    }
}

final class PresetButton: NSButton {
    let presetID: UUID
    var onPress: (() -> Void)?

    init(presetID: UUID) {
        self.presetID = presetID
        super.init(frame: .zero)
        isBordered = false
        bezelStyle = .inline
        imagePosition = .imageLeft
        imageHugsTitle = true
        imageScaling = .scaleNone
        focusRingType = .exterior
        setButtonType(.momentaryPushIn)
        target = self
        action = #selector(pressed)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override var intrinsicContentSize: NSSize {
        NSSize(width: super.intrinsicContentSize.width + 16, height: 32)
    }

    override func draw(_ dirtyRect: NSRect) {
        let capsule = NSBezierPath(roundedRect: bounds.insetBy(dx: 1, dy: 2), xRadius: 14, yRadius: 14)
        NSColor(Palette.surface).setFill()
        capsule.fill()
        NSColor(Palette.line).setStroke()
        capsule.lineWidth = 1
        capsule.stroke()
        if isHighlighted { NSColor.labelColor.withAlphaComponent(0.06).setFill(); capsule.fill() }
        super.draw(dirtyRect)
    }

    @objc private func pressed() { onPress?() }
}
