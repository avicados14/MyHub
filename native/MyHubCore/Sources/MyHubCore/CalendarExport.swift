import Foundation

public enum CalendarExportError: Error {
    case invalidTimeZone, invalidDate, invalidRange, missingTitle
}

/// A one-time copy for the system calendar editor. No source identifiers or URLs leave MyHub.
public struct CalendarExport: Equatable {
    public let title: String
    public let start: Date
    public let end: Date
    public let allDay: Bool
    public let timeZone: TimeZone
    public let location: String?
    public let notes: String?

    public init(event: CalendarEvent, timeZone identifier: String, deviceTimeZone: TimeZone = .current) throws {
        guard let zone = TimeZone(identifier: identifier) else { throw CalendarExportError.invalidTimeZone }
        let title = event.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { throw CalendarExportError.missingTitle }
        let allDay = event.allDay == true
        // Floating all-day dates use the device zone; timed records use MyHub's configured zone.
        let exportZone = allDay ? deviceTimeZone : zone
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = exportZone
        let start = try Self.instant(event.date, time: allDay ? "00:00" : event.startTime, calendar: calendar)
        let last = try Self.instant(event.endDate ?? event.date, time: allDay ? "00:00" : event.endTime, calendar: calendar)
        let end: Date
        if allDay {
            // MyHub stores the inclusive final day; EventKit uses an exclusive end.
            guard last >= start, let next = calendar.date(byAdding: .day, value: 1, to: last) else {
                throw CalendarExportError.invalidRange
            }
            end = next
        } else {
            end = last
        }
        guard end > start else { throw CalendarExportError.invalidRange }
        self.title = title; self.start = start; self.end = end
        self.allDay = allDay; self.timeZone = exportZone
        self.location = event.location
        self.notes = event.description
    }

    private static func instant(_ day: String, time: String, calendar: Calendar) throws -> Date {
        guard day.count == 10, time.count == 5,
              day.range(of: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$", options: .regularExpression) != nil,
              time.range(of: "^[0-9]{2}:[0-9]{2}$", options: .regularExpression) != nil else {
            throw CalendarExportError.invalidDate
        }
        let dateParts = day.split(separator: "-").compactMap { Int($0) }
        let timeParts = time.split(separator: ":").compactMap { Int($0) }
        guard dateParts.count == 3, timeParts.count == 2,
              (1...9999).contains(dateParts[0]), (1...12).contains(dateParts[1]), (1...31).contains(dateParts[2]),
              (0...23).contains(timeParts[0]), (0...59).contains(timeParts[1]) else { throw CalendarExportError.invalidDate }
        let parts = DateComponents(year: dateParts[0], month: dateParts[1], day: dateParts[2],
                                   hour: timeParts[0], minute: timeParts[1], second: 0)
        guard let candidate = calendar.date(from: parts) else { throw CalendarExportError.invalidDate }
        let candidateParts = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: candidate)
        guard candidateParts.year == parts.year, candidateParts.month == parts.month, candidateParts.day == parts.day,
              candidateParts.hour == parts.hour, candidateParts.minute == parts.minute else { throw CalendarExportError.invalidDate }
        // Choose the first occurrence of a repeated fall-back time; reject missing spring-forward times.
        let anchor = calendar.startOfDay(for: candidate).addingTimeInterval(-1)
        guard let result = calendar.nextDate(after: anchor, matching: parts, matchingPolicy: .strict,
                                            repeatedTimePolicy: .first, direction: .forward) else {
            throw CalendarExportError.invalidDate
        }
        let actual = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: result)
        guard actual.year == parts.year, actual.month == parts.month, actual.day == parts.day,
              actual.hour == parts.hour, actual.minute == parts.minute else { throw CalendarExportError.invalidDate }
        return result
    }
}
