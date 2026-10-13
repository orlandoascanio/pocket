import PocketCore
import SwiftUI

// Same colors as the web app: warm off-white / near-black, pocket green.
enum Palette {
    private static func adaptive(light: NSColor, dark: NSColor) -> Color {
        Color(nsColor: NSColor(name: nil) { $0.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? dark : light })
    }
    static let bg = adaptive(light: NSColor(red: 0.965, green: 0.961, blue: 0.949, alpha: 1),
                             dark: NSColor(red: 0.11, green: 0.11, blue: 0.11, alpha: 1))
    static let surface = adaptive(light: .white, dark: NSColor(red: 0.16, green: 0.16, blue: 0.16, alpha: 1))
    static let chip = adaptive(light: NSColor(red: 0.925, green: 0.922, blue: 0.902, alpha: 1),
                               dark: NSColor(red: 0.15, green: 0.15, blue: 0.15, alpha: 1))
    static let line = adaptive(light: NSColor(red: 0.894, green: 0.886, blue: 0.863, alpha: 1),
                               dark: NSColor(red: 0.173, green: 0.173, blue: 0.169, alpha: 1))
    static let accent = adaptive(light: NSColor(red: 0.114, green: 0.42, blue: 0.278, alpha: 1),
                                 dark: NSColor(red: 0.298, green: 0.788, blue: 0.561, alpha: 1))
    static let negative = adaptive(light: NSColor(red: 0.76, green: 0.21, blue: 0.17, alpha: 1),
                                   dark: NSColor(red: 1, green: 0.42, blue: 0.37, alpha: 1))
}

extension Font {
    /// Display face for big numbers and headings.
    static func display(_ size: CGFloat, _ weight: Font.Weight = .bold) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }
}

enum Face: String {
    case happy, worried, joy, oof, hope, sleep
}

/// The gold coin from the app icon.
struct CoinView: View {
    var size: CGFloat = 38

    private let ink = Color(red: 0.66, green: 0.42, blue: 0.09)

    var body: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(
                    colors: [Color(red: 1, green: 0.96, blue: 0.77), Color(red: 1, green: 0.85, blue: 0.4),
                             Color(red: 0.92, green: 0.66, blue: 0.23)],
                    center: UnitPoint(x: 0.34, y: 0.28), startRadius: 1, endRadius: size * 0.62))
            Circle().strokeBorder(ink.opacity(0.4), lineWidth: max(1.5, size * 0.055))
            Text("$").font(.system(size: size * 0.55, weight: .heavy, design: .rounded)).foregroundStyle(ink)
        }
        .frame(width: size, height: size)
    }
}

/// The pocket's front panel and face, drawn in the icon's 560×430 coordinate space.
struct PocketFront: View {
    var face: Face
    var blink: Bool

    private let ink = Color(red: 0.23, green: 0.165, blue: 0.10)

    var body: some View {
        Canvas { ctx, size in
            let s = size.width / 560
            ctx.scaleBy(x: s, y: s)

            var outline = Path()
            outline.move(to: .init(x: 0, y: 0))
            outline.addLine(to: .init(x: 560, y: 0))
            outline.addLine(to: .init(x: 560, y: 256))
            outline.addQuadCurve(to: .init(x: 528, y: 308), control: .init(x: 560, y: 292))
            outline.addLine(to: .init(x: 308, y: 416))
            outline.addQuadCurve(to: .init(x: 252, y: 416), control: .init(x: 280, y: 430))
            outline.addLine(to: .init(x: 32, y: 308))
            outline.addQuadCurve(to: .init(x: 0, y: 256), control: .init(x: 0, y: 292))
            outline.closeSubpath()
            ctx.fill(outline, with: .linearGradient(
                Gradient(colors: [Color(red: 1, green: 0.992, blue: 0.969), Color(red: 0.922, green: 0.878, blue: 0.784)]),
                startPoint: .zero, endPoint: .init(x: 0, y: 430)))
            ctx.fill(Path(CGRect(x: 0, y: 0, width: 560, height: 14)), with: .color(.black.opacity(0.08)))

            var stitch = Path()
            stitch.move(to: .init(x: 42, y: 48))
            stitch.addLine(to: .init(x: 518, y: 48))
            stitch.addLine(to: .init(x: 518, y: 242))
            stitch.addQuadCurve(to: .init(x: 495, y: 280), control: .init(x: 518, y: 268))
            stitch.addLine(to: .init(x: 294, y: 378))
            stitch.addQuadCurve(to: .init(x: 266, y: 378), control: .init(x: 280, y: 385))
            stitch.addLine(to: .init(x: 65, y: 280))
            stitch.addQuadCurve(to: .init(x: 42, y: 242), control: .init(x: 42, y: 268))
            stitch.closeSubpath()
            ctx.stroke(stitch, with: .color(Color(red: 0.80, green: 0.71, blue: 0.55)),
                       style: StrokeStyle(lineWidth: 10, lineCap: .round, dash: [26, 18]))

            // blush
            for x in [160.0, 400.0] {
                ctx.fill(Path(ellipseIn: CGRect(x: x - 32, y: 220, width: 64, height: 32)),
                         with: .color(Color(red: 0.96, green: 0.65, blue: 0.63).opacity(0.55)))
            }

            let stroke = StrokeStyle(lineWidth: 13, lineCap: .round, lineJoin: .round)
            func line(_ build: (inout Path) -> Void, width: CGFloat = 13) {
                var p = Path()
                build(&p)
                ctx.stroke(p, with: .color(ink), style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round))
            }

            // eyes (blinking squashes them vertically)
            var eyes = ctx
            eyes.translateBy(x: 0, y: 172)
            eyes.scaleBy(x: 1, y: blink ? 0.1 : 1)
            eyes.translateBy(x: 0, y: -172)
            switch face {
            case .happy, .worried:
                for x in [210.0, 350.0] {
                    eyes.fill(Path(ellipseIn: CGRect(x: x - 25, y: 147, width: 50, height: 50)), with: .color(ink))
                    eyes.fill(Path(ellipseIn: CGRect(x: x + 1, y: 155, width: 16, height: 16)), with: .color(.white))
                }
            case .joy:
                for x in [210.0, 350.0] {
                    var p = Path()
                    p.move(to: .init(x: x - 26, y: 184))
                    p.addQuadCurve(to: .init(x: x + 26, y: 184), control: .init(x: x, y: 148))
                    eyes.stroke(p, with: .color(ink), style: stroke)
                }
            case .oof:
                var p = Path()
                p.move(to: .init(x: 190, y: 152)); p.addLine(to: .init(x: 230, y: 172)); p.addLine(to: .init(x: 190, y: 192))
                p.move(to: .init(x: 370, y: 152)); p.addLine(to: .init(x: 330, y: 172)); p.addLine(to: .init(x: 370, y: 192))
                eyes.stroke(p, with: .color(ink), style: stroke)
            case .hope:
                for x in [210.0, 350.0] {
                    var p = Path()
                    p.move(to: .init(x: x, y: 138))
                    p.addQuadCurve(to: .init(x: x + 34, y: 172), control: .init(x: x + 6, y: 166))
                    p.addQuadCurve(to: .init(x: x, y: 206), control: .init(x: x + 6, y: 178))
                    p.addQuadCurve(to: .init(x: x - 34, y: 172), control: .init(x: x - 6, y: 178))
                    p.addQuadCurve(to: .init(x: x, y: 138), control: .init(x: x - 6, y: 166))
                    eyes.fill(p, with: .color(ink))
                }
            case .sleep:
                for x in [210.0, 350.0] {
                    var p = Path()
                    p.move(to: .init(x: x - 24, y: 170))
                    p.addQuadCurve(to: .init(x: x + 24, y: 170), control: .init(x: x, y: 192))
                    eyes.stroke(p, with: .color(ink), style: StrokeStyle(lineWidth: 12, lineCap: .round))
                }
            }

            // brows + sweat when worried
            if face == .worried {
                line { $0.move(to: .init(x: 178, y: 136)); $0.addLine(to: .init(x: 232, y: 116)) }
                line { $0.move(to: .init(x: 382, y: 136)); $0.addLine(to: .init(x: 328, y: 116)) }
                var drop = Path()
                drop.move(to: .init(x: 446, y: 92))
                drop.addQuadCurve(to: .init(x: 459, y: 140), control: .init(x: 466, y: 124))
                drop.addQuadCurve(to: .init(x: 437, y: 152), control: .init(x: 452, y: 156))
                drop.addQuadCurve(to: .init(x: 428, y: 128), control: .init(x: 422, y: 146))
                drop.addQuadCurve(to: .init(x: 446, y: 92), control: .init(x: 434, y: 110))
                ctx.fill(drop, with: .color(Color(red: 0.56, green: 0.82, blue: 0.96)))
            }

            // mouth
            switch face {
            case .happy, .hope:
                line { $0.move(to: .init(x: 248, y: 234)); $0.addQuadCurve(to: .init(x: 312, y: 234), control: .init(x: 280, y: 266)) }
            case .joy:
                var m = Path()
                m.move(to: .init(x: 238, y: 228))
                m.addQuadCurve(to: .init(x: 322, y: 228), control: .init(x: 280, y: 232))
                m.addQuadCurve(to: .init(x: 280, y: 286), control: .init(x: 318, y: 284))
                m.addQuadCurve(to: .init(x: 238, y: 228), control: .init(x: 242, y: 284))
                ctx.fill(m, with: .color(ink))
                var t = Path()
                t.move(to: .init(x: 256, y: 266))
                t.addQuadCurve(to: .init(x: 304, y: 266), control: .init(x: 280, y: 250))
                t.addQuadCurve(to: .init(x: 280, y: 285), control: .init(x: 298, y: 284))
                t.addQuadCurve(to: .init(x: 256, y: 266), control: .init(x: 262, y: 284))
                ctx.fill(t, with: .color(Color(red: 0.94, green: 0.49, blue: 0.49)))
            case .worried:
                line {
                    $0.move(to: .init(x: 244, y: 254))
                    $0.addQuadCurve(to: .init(x: 280, y: 254), control: .init(x: 262, y: 236))
                    $0.addQuadCurve(to: .init(x: 316, y: 254), control: .init(x: 298, y: 272))
                }
            case .oof:
                ctx.fill(Path(ellipseIn: CGRect(x: 263, y: 231, width: 34, height: 42)), with: .color(ink))
            case .sleep:
                line({ $0.move(to: .init(x: 264, y: 248)); $0.addQuadCurve(to: .init(x: 296, y: 248), control: .init(x: 280, y: 258)) }, width: 11)
            }
        }
        .aspectRatio(560.0 / 430.0, contentMode: .fit)
    }
}

/// The pocket character: a coin tucked into a pocket with a face that reacts to money.
/// Drives its own animations from the store's balance changes and speech.
struct PocketStage: View {
    @EnvironmentObject var store: Store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var width: CGFloat = 104
    /// Fixed face (onboarding, empty states); nil = react to the balance.
    var fixedFace: Face?

    @State private var transient: Face?
    @State private var bubble: String?
    @State private var blink = false
    @State private var drops = 0
    @State private var pops = 0
    @State private var squishes = 0
    @State private var flips = 0
    @State private var floatText: String?
    @State private var floatPositive = true
    @State private var bubbleTask: Task<Void, Never>?
    @State private var faceTask: Task<Void, Never>?

    private var base: Face { store.balance < 0 ? .worried : .happy }
    private var face: Face { fixedFace ?? transient ?? base }
    private var unit: CGFloat { width / 104 }

    var body: some View {
        ZStack(alignment: .topLeading) {
            // coin resting on the pocket's rim
            CoinView(size: 50 * unit)
                .keyframeAnimator(initialValue: CoinMotion(), trigger: flips) { content, v in
                    content.rotation3DEffect(.degrees(v.spin), axis: (x: 0, y: 1, z: 0), perspective: 0.5).offset(y: v.y)
                } keyframes: { _ in
                    KeyframeTrack(\.spin) { CubicKeyframe(720, duration: 0.8) }
                    KeyframeTrack(\.y) {
                        CubicKeyframe(-24 * unit, duration: 0.35)
                        SpringKeyframe(0, duration: 0.45, spring: .bouncy)
                    }
                }
                .offset(x: 41 * unit, y: 2 * unit)

            // a coin falling in (money in)
            CoinView(size: 50 * unit)
                .keyframeAnimator(initialValue: CoinMotion(opacity: 0), trigger: drops) { content, v in
                    content.rotation3DEffect(.degrees(v.spin), axis: (x: 0, y: 1, z: 0), perspective: 0.5)
                        .offset(y: v.y).opacity(v.opacity)
                } keyframes: { _ in
                    KeyframeTrack(\.y) {
                        LinearKeyframe(-120 * unit, duration: 0.001)
                        CubicKeyframe(44 * unit, duration: 0.62)
                    }
                    KeyframeTrack(\.spin) { LinearKeyframe(0, duration: 0.001); CubicKeyframe(720, duration: 0.62) }
                    KeyframeTrack(\.opacity) {
                        LinearKeyframe(0, duration: 0.001)
                        LinearKeyframe(1, duration: 0.12)
                        LinearKeyframe(1, duration: 0.5)
                        LinearKeyframe(0, duration: 0.01)
                    }
                }
                .offset(x: 41 * unit, y: 2 * unit)

            // a coin popping out (money out)
            CoinView(size: 50 * unit)
                .keyframeAnimator(initialValue: CoinMotion(opacity: 0), trigger: pops) { content, v in
                    content.rotation3DEffect(.degrees(v.spin), axis: (x: 0, y: 1, z: 0), perspective: 0.5)
                        .offset(x: v.x, y: v.y).opacity(v.opacity).blur(radius: v.blur)
                } keyframes: { _ in
                    KeyframeTrack(\.y) {
                        LinearKeyframe(40 * unit, duration: 0.001)
                        CubicKeyframe(-70 * unit, duration: 0.4)
                        CubicKeyframe(10 * unit, duration: 0.42)
                    }
                    KeyframeTrack(\.x) { LinearKeyframe(0, duration: 0.001); LinearKeyframe(-64 * unit, duration: 0.82) }
                    KeyframeTrack(\.spin) { LinearKeyframe(0, duration: 0.001); LinearKeyframe(760, duration: 0.82) }
                    KeyframeTrack(\.opacity) {
                        LinearKeyframe(1, duration: 0.001)
                        LinearKeyframe(1, duration: 0.5)
                        LinearKeyframe(0, duration: 0.32)
                    }
                    KeyframeTrack(\.blur) { LinearKeyframe(0, duration: 0.5); LinearKeyframe(2, duration: 0.32) }
                }
                .offset(x: 41 * unit, y: 2 * unit)

            PocketFront(face: face, blink: blink)
                .frame(width: 96 * unit)
                .keyframeAnimator(initialValue: 1.0, trigger: squishes) { content, s in
                    content.scaleEffect(x: 2 - s, y: s, anchor: .bottom)
                } keyframes: { _ in
                    CubicKeyframe(0.9, duration: 0.12)
                    SpringKeyframe(1, duration: 0.35, spring: .bouncy)
                }
                .shadow(color: .black.opacity(0.13), radius: 6 * unit, y: 5 * unit)
                .offset(x: 4 * unit, y: 38 * unit)

            if let floatText {
                Text(floatText)
                    .font(.display(13 * max(unit, 0.85), .heavy))
                    .foregroundStyle(floatPositive ? Palette.accent : Palette.negative)
                    .fixedSize()
                    .offset(x: -8 * unit, y: 34 * unit)
                    .transition(.asymmetric(insertion: .opacity.combined(with: .offset(y: 8)),
                                            removal: .opacity.combined(with: .offset(y: -28))))
            }
        }
        .frame(width: width, height: 112 * unit, alignment: .topLeading)
        .overlay(alignment: .topTrailing) {
            if let bubble {
                Text(bubble)
                    .font(.system(size: 12, weight: .semibold))
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(Palette.surface, in: Capsule())
                    .overlay(Capsule().strokeBorder(Palette.line))
                    .shadow(color: .black.opacity(0.12), radius: 8, y: 4)
                    .fixedSize()
                    .offset(x: 2, y: -26)
                    .transition(reduceMotion ? .opacity : .scale(scale: 0.6, anchor: .bottomTrailing).combined(with: .opacity))
                    .zIndex(2)
            }
        }
        .animation(.easeOut(duration: 0.15), value: face)
        .contentShape(Rectangle())
        .onTapGesture { if fixedFace == nil { poke() } }
        .help("Poke your pocket")
        .accessibilityHidden(true)
        .onChange(of: store.change) { _, c in if let c, fixedFace == nil { react(c) } }
        .onChange(of: store.speech) { _, s in if let s, fixedFace == nil { setFace(s.face, for: 1.6); say(s.text) } }
        .task(id: reduceMotion) { await blinkLoop() }
    }

    /// Poke it: the coin flips and it giggles.
    private func poke() {
        if !reduceMotion { flips += 1; squishes += 1 }
        setFace(.joy, for: 1.1)
        say(Lines.shared.line("poke"))
    }

    private func react(_ c: BalanceChange) {
        if !reduceMotion {
            if c.diff > 0 {
                drops += 1
                Task { try? await Task.sleep(for: .milliseconds(600)); squishes += 1 }
            } else {
                squishes += 1
                pops += 1
            }
            showFloat(store.money.string(c.diff, signed: true), positive: c.diff > 0)
        }
        if c.deleted { setFace(c.diff > 0 ? .joy : .oof, for: 1.2); say(Lines.shared.line("deleted")) }
        else if c.outOfRed { setFace(.joy, for: 2.6); say("We're out of the red!") }
        else if c.intoRed { setFace(.oof, for: 1.4); say("Uh oh, we're in the red") }
        else { setFace(c.diff > 0 ? .joy : .oof, for: 1.5); say(Lines.shared.forChange(c.diff, category: c.category)) }
    }

    private func showFloat(_ text: String, positive: Bool) {
        floatPositive = positive
        withAnimation(.easeOut(duration: 0.25)) { floatText = text }
        Task {
            try? await Task.sleep(for: .milliseconds(1100))
            withAnimation(.easeIn(duration: 0.5)) { floatText = nil }
        }
    }

    private func setFace(_ f: Face, for seconds: Double) {
        faceTask?.cancel()
        transient = f
        faceTask = Task {
            try? await Task.sleep(for: .seconds(seconds))
            guard !Task.isCancelled else { return }
            transient = nil
        }
    }

    private func say(_ text: String) {
        bubbleTask?.cancel()
        // The pop has a little bounce, it's the pocket talking; with Reduce Motion it just fades in.
        withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.35, bounce: 0.35)) { bubble = text }
        bubbleTask = Task {
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
            withAnimation(.easeOut(duration: 0.25)) { bubble = nil }
        }
    }

    private func blinkLoop() async {
        guard !reduceMotion else { return }
        while !Task.isCancelled {
            try? await Task.sleep(for: .milliseconds(Int.random(in: 2400...5800)))
            guard [.happy, .worried, .hope].contains(face) else { continue }
            withAnimation(.easeInOut(duration: 0.07)) { blink = true }
            try? await Task.sleep(for: .milliseconds(90))
            withAnimation(.easeInOut(duration: 0.07)) { blink = false }
        }
    }
}

struct CoinMotion {
    var x: CGFloat = 0
    var y: CGFloat = 0
    var spin: Double = 0
    var opacity: Double = 1
    var blur: CGFloat = 0
}
