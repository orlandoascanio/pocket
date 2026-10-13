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
        // Pressing again mid-glide pages on from where the row is headed, not from where it is.
        let from = scrollView.restingOffset
        scrollView.glide(to: from + direction * max(80, scrollView.contentSize.width * 0.8))
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

/// Lets the row sit past either end while it's being pulled or bouncing back, which a plain clip
/// view would clamp away.
final class ElasticClipView: NSClipView {
    var allowsOvershoot = false

    override func constrainBoundsRect(_ proposedBounds: NSRect) -> NSRect {
        allowsOvershoot ? proposedBounds : super.constrainBoundsRect(proposedBounds)
    }
}

/// How far a pull past the end actually moves the row: it follows less the further it goes, so the
/// edge reads as soft resistance rather than a wall.
func rubberband(_ overshoot: CGFloat, dimension: CGFloat, constant: CGFloat = 0.55) -> CGFloat {
    guard dimension > 0 else { return 0 }
    let pull = abs(overshoot)
    return (pull * dimension * constant / (dimension + constant * pull)) * (overshoot < 0 ? -1 : 1)
}

/// The inverse of `rubberband`, so grabbing a row mid-bounce picks up exactly where it is drawn.
func unrubberband(_ shown: CGFloat, dimension: CGFloat, constant: CGFloat = 0.55) -> CGFloat {
    guard dimension > 0 else { return 0 }
    // The pull can never be drawn a full `dimension` past the end, so cap just short of it.
    let s = min(abs(shown), dimension * 0.999)
    return (s * dimension / (constant * (dimension - s))) * (shown < 0 ? -1 : 1)
}

/// Where a throw at `velocity` (points per second) comes to rest, decelerating like a scroll view.
func projectedDistance(_ velocity: CGFloat, decelerationRate: CGFloat = 0.998) -> CGFloat {
    velocity / 1000 * decelerationRate / (1 - decelerationRate)
}

/// Native wheel scrolling plus click-drag, including macOS's accessibility three-finger drag.
/// Delaying primary-button events lets the pan cancel a button press before it records money.
///
/// A drag tracks the pointer one to one and resists past either end. Letting go hands the pointer's
/// velocity to a glide that decelerates toward where the throw would land, and a throw past an end
/// bounces back with a critically damped spring. Anything moving can be grabbed again mid-flight;
/// a click on a moving row just stops it, without pressing the button under the pointer.
final class PresetScrollView: NSScrollView, NSGestureRecognizerDelegate {
    weak var state: PresetScrollState?
    private var dragOrigin: CGFloat?
    private lazy var pan = NSPanGestureRecognizer(target: self, action: #selector(panChanged(_:)))
    private let clip = ElasticClipView()

    private enum Motion { case decay, spring(target: CGFloat) }
    private var motion: Motion?
    private var velocity: CGFloat = 0
    /// The glide's own position. The clip view rounds its origin to whole pixels, so reading it back
    /// each frame would stall a spring a pixel short of home.
    private var position: CGFloat = 0
    private var link: CADisplayLink?
    private var lastTick: CFTimeInterval?
    /// Critically damped (no overshoot of its own), settling in about 0.4 s.
    private let springResponse: CGFloat = 0.4
    private let decelerationRate: CGFloat = 0.998

    var maximumOffset: CGFloat { max(0, (documentView?.frame.width ?? 0) - contentSize.width) }
    private var offset: CGFloat { motion == nil ? contentView.bounds.minX : position }
    var isMoving: Bool { motion != nil }
    private var reduceMotion: Bool { NSWorkspace.shared.accessibilityDisplayShouldReduceMotion }

    /// Where the row will come to rest if nothing else touches it.
    var restingOffset: CGFloat {
        switch motion {
        case .spring(let target): target
        case .decay: clamp(offset + projectedDistance(velocity, decelerationRate: decelerationRate))
        case nil: clamp(offset)
        }
    }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        contentView = clip
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
        // Layout runs on every SwiftUI update; it mustn't snap a pull or a bounce back into range.
        if dragOrigin == nil, motion == nil { scrollHorizontally(to: offset) }
    }

    /// Jumps straight to an offset, stopping any glide.
    func scrollHorizontally(to offset: CGFloat) {
        stop()
        show(clamp(offset))
    }

    /// Glides to an offset, carrying whatever velocity the row already has.
    func glide(to target: CGFloat) {
        let target = clamp(target)
        guard !reduceMotion, window != nil else { return scrollHorizontally(to: target) }
        start(.spring(target: target))
    }

    /// Finishes any motion at once (tests, and anything that needs the final position now).
    func settle() {
        guard let motion else { return }
        switch motion {
        case .spring(let target): show(target)
        case .decay: show(restingOffset)
        }
        stop()
    }

    private func clamp(_ x: CGFloat) -> CGFloat { min(maximumOffset, max(0, x)) }

    private func show(_ x: CGFloat) {
        position = x
        clip.allowsOvershoot = x < 0 || x > maximumOffset
        clip.setBoundsOrigin(NSPoint(x: x, y: 0))
        reflectScrolledClipView(clip)
        updateControls()
    }

    private func start(_ next: Motion) {
        if motion == nil { position = contentView.bounds.minX }
        motion = next
        guard link == nil else { return }
        lastTick = nil
        let link = displayLink(target: self, selector: #selector(tick(_:)))
        link.add(to: .main, forMode: .common)
        self.link = link
    }

    private func stop() {
        motion = nil
        velocity = 0
        link?.invalidate()
        link = nil
        clip.allowsOvershoot = false
    }

    @objc private func tick(_ link: CADisplayLink) {
        let now = link.targetTimestamp
        let dt = min(1.0 / 30, max(0, now - (lastTick ?? link.timestamp)))
        lastTick = now
        guard let motion, dt > 0 else { return }
        var x = offset
        switch motion {
        case .decay:
            // Exponential decay, the same curve `projectedDistance` sums up.
            let k = pow(decelerationRate, CGFloat(dt) * 1000)
            x += velocity * (k - 1) / (1000 * log(decelerationRate))
            velocity *= k
            if x < 0 || x > maximumOffset {
                // Ran off an end: keep the speed and let a spring bring it back.
                if reduceMotion { show(clamp(x)); return stop() }
                self.motion = .spring(target: clamp(x))
            } else if abs(velocity) < 8 {
                show(x)
                return stop()
            }
        case .spring(let target):
            // Exact critically damped step, so a large frame gap can't make it overshoot or blow up.
            let w = 2 * .pi / springResponse
            let e = x - target
            let decay = exp(-w * CGFloat(dt))
            let c = velocity + w * e
            x = target + (e + c * CGFloat(dt)) * decay
            velocity = (velocity - w * c * CGFloat(dt)) * decay
            if abs(x - target) < 0.5, abs(velocity) < 8 {
                show(target)
                return stop()
            }
        }
        show(x)
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window == nil { settle() }
    }

    override func scrollWheel(with event: NSEvent) {
        // Two-finger scrolling takes over from any glide, from wherever the row is in range.
        if isMoving { scrollHorizontally(to: offset) }
        super.scrollWheel(with: event)
    }

    override func hitTest(_ point: NSPoint) -> NSView? {
        // While the row moves, a click belongs to the row: it stops it rather than pressing a button.
        if isMoving, frame.contains(point) { return self }
        return super.hitTest(point)
    }

    override func mouseDown(with event: NSEvent) {
        guard isMoving else { return super.mouseDown(with: event) }
        if offset < 0 || offset > maximumOffset { glide(to: offset) } else { scrollHorizontally(to: offset) }
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
            // Grabbed mid-glide or mid-bounce: carry on from exactly where it's drawn.
            stop()
            let x = offset
            if x < 0 { dragOrigin = unrubberband(x, dimension: contentSize.width) }
            else if x > maximumOffset { dragOrigin = maximumOffset + unrubberband(x - maximumOffset, dimension: contentSize.width) }
            else { dragOrigin = x }
            state?.suppressActivation = true
            fallthrough
        case .changed:
            guard let origin = dragOrigin else { return }
            show(tracked(origin - recognizer.translation(in: self).x))
        case .ended:
            guard let origin = dragOrigin else { return finishDrag() }
            show(tracked(origin - recognizer.translation(in: self).x))
            release(velocity: -recognizer.velocity(in: self).x)
            finishDrag()
        case .cancelled, .failed:
            if dragOrigin != nil { release(velocity: 0) }
            finishDrag()
        default: break
        }
    }

    /// The pointer's position mapped to the row: one to one in range, resisting past either end.
    private func tracked(_ raw: CGFloat) -> CGFloat {
        if reduceMotion { return clamp(raw) }
        if raw < 0 { return rubberband(raw, dimension: contentSize.width) }
        if raw > maximumOffset { return maximumOffset + rubberband(raw - maximumOffset, dimension: contentSize.width) }
        return raw
    }

    /// Letting go: a pull past an end springs back; a throw glides on at the pointer's speed.
    private func release(velocity v: CGFloat) {
        guard window != nil else { return scrollHorizontally(to: offset) }
        velocity = v
        if offset < 0 || offset > maximumOffset {
            start(.spring(target: clamp(offset)))
        } else if abs(v) > 40 {
            start(.decay)
        } else {
            stop()
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
