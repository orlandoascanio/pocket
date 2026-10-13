import Foundation
import PocketCore
@preconcurrency import UserNotifications

struct PaymentReminder {
    let identifier: String
    let day: Day
    let date: Date
    let title: String
    let body = "Open Pocket to log it, with the real amount if it changed."

    var content: UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        return content
    }
}

enum PaymentReminders {
    static let testIdentifier = "pocket-test-reminder"

    static func plans(for rules: [Rule], now: Date, calendar: Calendar = .current) -> [PaymentReminder] {
        let today = Day(now, calendar: calendar)
        return rules.filter { $0.active && !$0.auto && !$0.finished && $0.next >= today }.compactMap { rule in
            let day = rule.next
            var components = DateComponents(year: day.year, month: day.month, day: day.day, hour: 10)
            components.timeZone = calendar.timeZone
            guard let date = calendar.date(from: components) else { return nil }
            return PaymentReminder(identifier: "pocket.\(rule.id.uuidString).\(rule.posted).\(day.iso)",
                                   day: day, date: date,
                                   title: rule.cents > 0 ? "Did \(rule.label) pay?" : "Was \(rule.label) paid?")
        }.sorted { $0.date < $1.date }
    }

    static func calendarTrigger(for reminder: PaymentReminder, calendar: Calendar = .current) -> UNCalendarNotificationTrigger {
        var components = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: reminder.date)
        components.timeZone = calendar.timeZone
        return UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
    }
}

/// The scheduler uses the same interface for macOS delivery and deterministic regression tests.
@MainActor
struct ReminderClient {
    var authorization: () async -> UNAuthorizationStatus
    var requestAuthorization: () async throws -> Bool
    var pending: () async -> [UNNotificationRequest]
    var add: (UNNotificationRequest) async throws -> Void
    var remove: ([String]) -> Void

    static var system: Self {
        let center = UNUserNotificationCenter.current()
        return Self(
            authorization: {
                await withCheckedContinuation { continuation in
                    center.getNotificationSettings { continuation.resume(returning: $0.authorizationStatus) }
                }
            },
            requestAuthorization: {
                try await withCheckedThrowingContinuation { continuation in
                    center.requestAuthorization(options: [.alert, .sound]) { granted, error in
                        if let error { continuation.resume(throwing: error) }
                        else { continuation.resume(returning: granted) }
                    }
                }
            },
            pending: {
                await withCheckedContinuation { continuation in
                    center.getPendingNotificationRequests { continuation.resume(returning: $0) }
                }
            },
            add: { request in
                try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                    center.add(request) { error in
                        if let error { continuation.resume(throwing: error) }
                        else { continuation.resume() }
                    }
                }
            },
            remove: { center.removePendingNotificationRequests(withIdentifiers: $0) }
        )
    }
}
