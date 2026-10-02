import Foundation

public struct DailySummary {
    public var date: String
    public var events: [CalendarEvent]
    public var assignments: [HomeworkAssignment]
    public var meals: [MealEntry]
    public var nutrition: Nutrition
}

extension Domain {
    /// Inject the clock so midnight and DST behavior can be verified without personal records.
    public static func dailySummary(_ data: AppData, now: Date) throws -> DailySummary {
        guard let zone = TimeZone(identifier: data.settings.calendarTimeZone ?? "UTC") else {
            throw DomainError.invalidSchedule
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = zone
        formatter.dateFormat = "yyyy-MM-dd"
        let date = formatter.string(from: now)
        let events = visibleEvents(data).filter { $0.date <= date && ($0.endDate ?? $0.date) >= date }
            .sorted { $0.startTime < $1.startTime }
        // Preserve source order for equal due times, matching the web dashboard selector.
        let assignments = visibleAssignments(data).enumerated().filter { $0.element.status != "complete" }
            .sorted { a, b in
                let x = a.element, y = b.element
                if x.dueDate != y.dueDate { return x.dueDate < y.dueDate }
                if x.dueTime != y.dueTime { return x.dueTime < y.dueTime }
                return a.offset < b.offset
            }.prefix(3).map(\.element)
        return DailySummary(date: date, events: events, assignments: assignments,
                            meals: data.meals.filter { $0.date == date }, nutrition: nutritionForDate(data, date: date))
    }
}
