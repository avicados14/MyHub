import Foundation

public enum DomainError: Error { case invalidYield, invalidSchedule }

/// Calculation layer only: never mutates imported records or their historical snapshots.
public enum Domain {
    public static func scaledIngredients(_ recipe: Recipe, servings: Decimal) throws -> [RecipeIngredient] {
        guard recipe.originalYield > 0, servings >= 0 else { throw DomainError.invalidYield }
        return recipe.ingredients.map { original in
            var item = original
            if let override = original.scaledOverride, abs(override.yield - servings) < Decimal(string: "0.0001")! {
                item.quantity = override.quantity
                item.unit = override.unit
            } else { item.quantity = original.quantity.map { $0 * servings / recipe.originalYield } }
            return item
        }
    }

    public static func formatQuantity(_ quantity: Decimal) -> String {
        let value = NSDecimalNumber(decimal: quantity).doubleValue
        guard value.isFinite else { return "—" }
        guard abs(value) < Double(Int.max) / 2 else { return NSDecimalNumber(decimal: quantity).stringValue }
        let whole = floor(value + 0.00000001), remainder = value - whole
        if remainder < 0.04 { return String(Int(whole)) }
        let fractions: [(Double, String)] = [(0.125,"⅛"),(0.25,"¼"),(0.333,"⅓"),(0.375,"⅜"),(0.5,"½"),(0.625,"⅝"),(0.667,"⅔"),(0.75,"¾"),(0.875,"⅞")]
        let closest = fractions.dropFirst().reduce(fractions[0]) { best, candidate in
            abs(candidate.0 - remainder) < abs(best.0 - remainder) ? candidate : best
        }
        if abs(closest.0 - remainder) <= 0.045 { return (whole == 0 ? "" : String(Int(whole))) + closest.1 }
        let formatter = NumberFormatter()
        formatter.maximumFractionDigits = 2
        formatter.numberStyle = .decimal
        return formatter.string(from: NSDecimalNumber(decimal: quantity)) ?? "—"
    }

    public static func nutritionForDate(_ data: AppData, date: String) -> Nutrition {
        var total = Nutrition(calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, saturatedFat: 0, fiber: 0, sodium: 0)
        for entry in data.foodLog where entry.date == date {
            let n = entry.nutritionSnapshot
            total.calories += n.calories; total.protein += n.protein; total.carbs += n.carbs; total.fat += n.fat
            total.sugar = (total.sugar ?? 0) + (n.sugar ?? 0)
            total.saturatedFat = (total.saturatedFat ?? 0) + (n.saturatedFat ?? 0)
            total.fiber += n.fiber; total.sodium += n.sodium
        }
        return total
    }

    public static func visibleAssignments(_ data: AppData) -> [HomeworkAssignment] {
        let enabled = Set(data.settings.calendarFeeds.filter(\.enabled).map(\.id))
        return data.assignments.filter { $0.sourceFeedId.map(enabled.contains) ?? true }
    }
    public static func visibleEvents(_ data: AppData) -> [CalendarEvent] {
        let enabled = Set(data.settings.calendarFeeds.filter(\.enabled).map(\.id))
        return data.events.filter { $0.sourceFeedId.map(enabled.contains) ?? true }
    }
    public static func rankAssignments(_ assignments: [HomeworkAssignment]) -> [HomeworkAssignment] {
        let priority = ["high": 0, "medium": 1, "low": 2]
        return assignments.filter { $0.status != "complete" }.sorted { a, b in
            if a.dueDate != b.dueDate { return a.dueDate < b.dueDate }
            if a.dueTime != b.dueTime { return a.dueTime < b.dueTime }
            if a.priority != b.priority { return (priority[a.priority] ?? 1) < (priority[b.priority] ?? 1) }
            return a.id.compare(b.id, locale: Locale(identifier: "en_US")) == .orderedAscending
        }
    }

    public static func studyPreview(_ data: AppData, startDate: String) throws -> StudyPreview {
        _ = try LocalDate(startDate)
        let settings = data.settings.study
        let earliest = try minutes(settings.earliestTime), latest = try minutes(settings.latestTime)
        let duration = min(settings.defaultBlockMinutes, settings.maxBlockMinutes)
        guard duration > 0, duration <= 1440, settings.breakMinutes >= 0,
              settings.breakMinutes <= 1440, earliest < latest else { throw DomainError.invalidSchedule }
        var calendar = Calendar(identifier: .gregorian)
        guard let zone = TimeZone(identifier: data.settings.calendarTimeZone ?? "UTC") else { throw DomainError.invalidSchedule }
        calendar.timeZone = zone
        let formatter = DateFormatter()
        formatter.calendar = calendar; formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = zone; formatter.dateFormat = "yyyy-MM-dd"
        guard let start = formatter.date(from: startDate) else { throw DomainError.invalidSchedule }
        // Regeneration retains explicitly preserved study blocks, as SchoolPage does.
        let existing = visibleEvents(data).filter { $0.kind != "study" || $0.locked == true || $0.completed == true || $0.userAdjusted == true }
        var result = StudyPreview(blocks: [], unscheduledMinutes: 0)
        let blockLimit = Int(NSDecimalNumber(decimal: duration).doubleValue)
        let rest = Int(NSDecimalNumber(decimal: settings.breakMinutes).doubleValue)
        guard blockLimit > 0 else { throw DomainError.invalidSchedule }
        for assignment in rankAssignments(visibleAssignments(data)) {
            _ = try LocalDate(assignment.dueDate)
            let dueMinutes = try minutes(assignment.dueTime)
            let raw = NSDecimalNumber(decimal: assignment.estimatedMinutes * (1 - assignment.progress / 100)).doubleValue
            guard raw.isFinite, raw >= 0, raw <= Double(Int32.max) else { throw DomainError.invalidSchedule }
            var remaining = max(0, Int(raw.rounded()))
            for event in existing where event.kind == "study" && event.assignmentId == assignment.id && event.completed != true {
                remaining = max(0, remaining - (try minutes(event.endTime) - minutes(event.startTime)))
            }
            for offset in 0...(366 * 5) where remaining > 0 {
                guard let day = calendar.date(byAdding: .day, value: offset, to: start) else { throw DomainError.invalidSchedule }
                let date = formatter.string(from: day)
                if date > assignment.dueDate { break }
                var occupied: [(Int, Int)] = []
                for event in existing where event.date <= date && (event.endDate ?? event.date) >= date {
                    let a = event.date == date && event.allDay != true ? try minutes(event.startTime) : 0
                    let b = (event.endDate ?? event.date) == date && event.allDay != true ? try minutes(event.endTime) : 1439
                    occupied.append((a, b))
                }
                for block in result.blocks where block.date == date { occupied.append((try minutes(block.startTime), try minutes(block.endTime))) }
                let weekday = Decimal(calendar.component(.weekday, from: day) - 1)
                for avoid in settings.avoidTimes where avoid.days.contains(weekday) { occupied.append((try minutes(avoid.startTime), try minutes(avoid.endTime))) }
                guard occupied.allSatisfy({ $0.0 < $0.1 }) else { throw DomainError.invalidSchedule }
                var cursor = earliest
                while remaining > 0 && cursor < latest {
                    let length = min(blockLimit, remaining), end = cursor + length
                    if let conflict = occupied.first(where: { cursor < $0.1 && end > $0.0 }) { cursor = conflict.1 + rest; continue }
                    if end > latest || (date == assignment.dueDate && end > dueMinutes) { break }
                    result.blocks.append(StudyPreviewBlock(assignmentId: assignment.id, date: date, startTime: time(cursor), endTime: time(end)))
                    occupied.append((cursor, end)); remaining -= length; cursor = end + rest
                }
            }
            result.unscheduledMinutes += remaining
        }
        return result
    }
    private static func minutes(_ time: String) throws -> Int {
        let parts = time.split(separator: ":")
        guard parts.count == 2, parts[0].count == 2, parts[1].count == 2,
              let h = Int(parts[0]), let m = Int(parts[1]), (0...23).contains(h), (0...59).contains(m) else { throw DomainError.invalidSchedule }
        return h * 60 + m
    }
    private static func time(_ minutes: Int) -> String { String(format: "%02d:%02d", minutes / 60, minutes % 60) }
}

public struct StudyPreviewBlock: Codable, Equatable {
    public var assignmentId: String
    public var date: String
    public var startTime: String
    public var endTime: String
}
public struct StudyPreview: Codable, Equatable {
    public var blocks: [StudyPreviewBlock]
    public var unscheduledMinutes: Int
}
