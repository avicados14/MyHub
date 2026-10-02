import Foundation

public enum CalendarEditError: Error { case invalid, stale, overlapNeedsConfirmation }

public struct EventDraft {
    public var title: String
    public var date: String
    public var startTime: String
    public var endTime: String
    public var allDay: Bool
    public var course: String
    public var description: String
    public var location: String
    public var locked: Bool
    public init(event: CalendarEvent? = nil, date: String) {
        title = event?.title ?? ""; self.date = event?.date ?? date
        startTime = event?.startTime ?? "09:00"; endTime = event?.endTime ?? "10:00"
        allDay = event?.allDay ?? false; course = event?.course ?? ""
        description = event?.description ?? ""; location = event?.location ?? ""
        locked = event?.locked ?? false
    }
}

public enum CalendarCommands {
    static func minutes(_ value: String) throws -> Int {
        let parts = value.split(separator: ":", omittingEmptySubsequences: false)
        guard parts.count == 2, parts[0].count == 2, parts[1].count == 2,
              let h = Int(parts[0]), let m = Int(parts[1]), (0...23).contains(h), (0...59).contains(m) else { throw CalendarEditError.invalid }
        return h * 60 + m
    }
    public static func save(_ draft: EventDraft, original: CalendarEvent?, in data: AppData, allowOverlap: Bool = false, now: Date = Date()) throws -> AppData {
        _ = try LocalDate(draft.date)
        let title = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let start = draft.allDay ? 0 : try minutes(draft.startTime)
        let end = draft.allDay ? 1439 : try minutes(draft.endTime)
        guard !title.isEmpty else { throw CalendarEditError.invalid }
        if let original {
            guard data.events.first(where: { $0.id == original.id }) == original else { throw CalendarEditError.stale }
            // Keep imported multi-day bounds intact. A separate range editor is required to move them.
            if let endDate = original.endDate, endDate != original.date, draft.date != original.date { throw CalendarEditError.invalid }
        }
        let lastDate = original?.endDate == original?.date ? draft.date : (original?.endDate ?? draft.date)
        _ = try LocalDate(lastDate)
        guard lastDate > draft.date || (lastDate == draft.date && end > start) else { throw CalendarEditError.invalid }
        let conflict = try data.events.contains { other in
            guard other.id != original?.id, other.date <= lastDate, (other.endDate ?? other.date) >= draft.date else { return false }
            let otherStart = other.allDay == true ? 0 : try minutes(other.startTime)
            let otherEnd = other.allDay == true ? 1439 : try minutes(other.endTime)
            let candidateStart = draft.date + String(format: "-%04d", start)
            let candidateEnd = lastDate + String(format: "-%04d", end)
            return candidateStart < (other.endDate ?? other.date) + String(format: "-%04d", otherEnd)
                && candidateEnd > other.date + String(format: "-%04d", otherStart)
        }
        if conflict && !allowOverlap { throw CalendarEditError.overlapNeedsConfirmation }
        let timestamp = ISO8601DateFormatter().string(from: now)
        var item = original ?? CalendarEvent(title: title, date: draft.date, startTime: draft.startTime, endTime: draft.endTime,
            kind: "event", id: "event-" + UUID().uuidString, createdAt: timestamp, updatedAt: timestamp, source: "manual")
        if original?.endDate != nil { item.endDate = lastDate }
        item.title = title; item.date = draft.date; item.startTime = draft.allDay ? "00:00" : draft.startTime
        item.endTime = draft.allDay ? "23:59" : draft.endTime; item.allDay = draft.allDay
        item.course = draft.course; item.description = draft.description; item.location = draft.location; item.updatedAt = timestamp
        if item.kind == "study" { item.userAdjusted = true; item.locked = draft.locked }
        var result = data
        if let index = result.events.firstIndex(where: { $0.id == item.id }) { result.events[index] = item }
        else { result.events.append(item) }
        return result
    }
    public static func delete(_ event: CalendarEvent, in data: AppData) throws -> AppData {
        guard data.events.first(where: { $0.id == event.id }) == event else { throw CalendarEditError.stale }
        var result = data; result.events.removeAll { $0.id == event.id }; return result
    }
    public static func setStudyState(_ event: CalendarEvent, locked: Bool? = nil, completed: Bool? = nil, in data: AppData) throws -> AppData {
        guard event.kind == "study", let index = data.events.firstIndex(where: { $0.id == event.id }), data.events[index] == event else { throw CalendarEditError.stale }
        var result = data
        if let locked { result.events[index].locked = locked }
        if let completed { result.events[index].completed = completed; result.events[index].locked = true }
        result.events[index].updatedAt = ISO8601DateFormatter().string(from: Date())
        return result
    }
    public static func newAvoidRange() -> AvoidTimeRange {
        AvoidTimeRange(id: "avoid-" + UUID().uuidString, label: "Avoid time", days: [0,1,2,3,4,5,6], startTime: "12:00", endTime: "13:00")
    }
    public static func saveSettings(_ settings: StudySettings, original: StudySettings, in data: AppData) throws -> AppData {
        guard data.settings.study == original else { throw CalendarEditError.stale }
        guard try minutes(settings.earliestTime) < minutes(settings.latestTime),
              settings.defaultBlockMinutes > 0, settings.defaultBlockMinutes <= 1440,
              settings.maxBlockMinutes > 0, settings.maxBlockMinutes <= 1440,
              settings.breakMinutes >= 0, settings.breakMinutes <= 1440,
              [settings.defaultBlockMinutes, settings.maxBlockMinutes, settings.breakMinutes].allSatisfy({ NSDecimalNumber(decimal: $0).doubleValue.truncatingRemainder(dividingBy: 1) == 0 }) else { throw CalendarEditError.invalid }
        for range in settings.avoidTimes {
            guard try minutes(range.startTime) < minutes(range.endTime),
                  !range.days.isEmpty, range.days.allSatisfy({ [Decimal(0),1,2,3,4,5,6].contains($0) }) else { throw CalendarEditError.invalid }
        }
        var result = data; result.settings.study = settings; return result
    }
}
