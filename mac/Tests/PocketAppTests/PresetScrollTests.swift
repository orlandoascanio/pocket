import AppKit
import PocketCore
import SwiftUI
import XCTest
@testable import Pocket

@MainActor
final class PresetScrollTests: XCTestCase {
    private func mountRow(count: Int = 12) throws -> (NSWindow, Store, PresetScrollView) {
        _ = NSApplication.shared
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("pocket-scroll-\(UUID())")
        let suite = "pocket-scroll-tests-\(UUID())"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defaults.set(false, forKey: "reminders")
        let store = Store(directory: directory, defaults: defaults, servicesEnabled: false)
        XCTAssertTrue(store.start(currency: "USD", cents: 10000, openAtLogin: false))
        for index in 0..<count {
            store.savePreset(Preset(label: "Button \(index + 1)", cents: 100 + index, sign: -1, category: "food"))
        }
        let host = NSHostingView(rootView: QuickBar(onAsk: { _ in }).environmentObject(store).frame(width: 340, height: 40))
        let window = NSWindow(contentRect: NSRect(x: 80, y: 80, width: 340, height: 40), styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = host
        window.makeKeyAndOrderFront(nil)
        RunLoop.main.run(until: Date().addingTimeInterval(0.15))
        host.layoutSubtreeIfNeeded()
        func find(_ view: NSView) -> PresetScrollView? {
            if let scroll = view as? PresetScrollView { return scroll }
            return view.subviews.lazy.compactMap(find).first
        }
        let scroll = try XCTUnwrap(find(host))
        addTeardownBlock {
            await MainActor.run { window.orderOut(nil) }
            try? FileManager.default.removeItem(at: directory)
            UserDefaults.standard.removePersistentDomain(forName: suite)
        }
        return (window, store, scroll)
    }

    func testPagingReachesHiddenButtonsAndClampsAtBothEnds() throws {
        let (_, store, scroll) = try mountRow()
        let state = try XCTUnwrap(scroll.state)
        XCTAssertGreaterThan(scroll.maximumOffset, 500)
        state.refresh()
        XCTAssertTrue(state.canScrollForward)
        XCTAssertFalse(state.canScrollBack)
        state.page(1)
        XCTAssertGreaterThan(scroll.contentView.bounds.minX, 0)
        scroll.scrollHorizontally(to: .greatestFiniteMagnitude)
        state.refresh()
        XCTAssertEqual(scroll.contentView.bounds.minX, scroll.maximumOffset, accuracy: 1)
        XCTAssertTrue(state.canScrollBack)
        XCTAssertFalse(state.canScrollForward)
        state.page(-1)
        XCTAssertLessThan(scroll.contentView.bounds.minX, scroll.maximumOffset)
        scroll.scrollHorizontally(to: -1000)
        state.refresh()
        XCTAssertEqual(scroll.contentView.bounds.minX, 0, accuracy: 1)
        XCTAssertFalse(state.canScrollBack)
        XCTAssertEqual(store.balance, 10000, "browsing quick-add buttons must never record an entry")
    }

    func testShortRowDoesNotShowPagingControls() throws {
        let (_, _, scroll) = try mountRow(count: 1)
        let state = try XCTUnwrap(scroll.state)
        state.refresh()
        XCTAssertFalse(state.overflows)
        XCTAssertEqual(scroll.maximumOffset, 0, accuracy: 1)
    }

    func testNativeDragScrollsWithoutActivatingAPreset() throws {
        let (window, store, scroll) = try mountRow()
        let start = scroll.convert(NSPoint(x: 140, y: 17), to: nil)
        for (index, type) in [NSEvent.EventType.leftMouseDown, .leftMouseDragged, .leftMouseDragged, .leftMouseUp].enumerated() {
            let x = start.x - CGFloat(index) * 30
            let event = try XCTUnwrap(NSEvent.mouseEvent(with: type, location: NSPoint(x: x, y: start.y), modifierFlags: [],
                timestamp: ProcessInfo.processInfo.systemUptime + Double(index) * 0.03, windowNumber: window.windowNumber,
                context: nil, eventNumber: index, clickCount: 1, pressure: type == .leftMouseUp ? 0 : 1))
            window.sendEvent(event)
            RunLoop.main.run(until: Date().addingTimeInterval(0.03))
        }
        XCTAssertGreaterThan(scroll.contentView.bounds.minX, 20)
        XCTAssertEqual(store.balance, 10000)
        XCTAssertEqual(store.ledger.entries.count, 1)
        let click = scroll.convert(NSPoint(x: 20, y: 17), to: nil)
        for (index, type) in [NSEvent.EventType.leftMouseDown, .leftMouseUp].enumerated() {
            let event = try XCTUnwrap(NSEvent.mouseEvent(with: type, location: click, modifierFlags: [],
                timestamp: ProcessInfo.processInfo.systemUptime + Double(index) * 0.03, windowNumber: window.windowNumber,
                context: nil, eventNumber: index + 10, clickCount: 1, pressure: type == .leftMouseUp ? 0 : 1))
            window.sendEvent(event)
            RunLoop.main.run(until: Date().addingTimeInterval(0.03))
        }
        XCTAssertEqual(store.ledger.entries.count, 2, "the next ordinary click must still add exactly once")
    }

    func testNumberShortcutStillUsesAButtonOutsideTheVisibleRow() throws {
        let (window, store, _) = try mountRow()
        let event = try XCTUnwrap(NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: .command,
            timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil,
            characters: "9", charactersIgnoringModifiers: "9", isARepeat: false, keyCode: 25))
        XCTAssertTrue(window.performKeyEquivalent(with: event))
        RunLoop.main.run(until: Date().addingTimeInterval(0.03))
        XCTAssertEqual(store.balance, 9892)
        XCTAssertEqual(store.ledger.entries.count, 2)
    }

    func testPresetButtonsRemainExposedToAccessibility() throws {
        let (_, _, scroll) = try mountRow()
        func buttons(in object: Any, depth: Int = 0) -> Int {
            guard depth < 12, let element = object as? NSAccessibilityProtocol else { return 0 }
            let own = element.accessibilityRole() == .button ? 1 : 0
            return own + (element.accessibilityChildren() ?? []).reduce(0) { $0 + buttons(in: $1, depth: depth + 1) }
        }
        XCTAssertGreaterThan(buttons(in: scroll), 0, "the native bridge must expose its hosted preset buttons")
    }
}
