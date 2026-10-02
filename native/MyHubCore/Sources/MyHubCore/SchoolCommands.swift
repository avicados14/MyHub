import Foundation

public enum SchoolError: Error { case invalidHomework, staleDraft }

/// Editable fields only. Imported identity and provenance stay on the original record.
public struct HomeworkDraft {
    public var title: String
    public var course: String
    public var dueDate: String
    public var dueTime: String
    public var priority: String
    public var estimatedMinutes: Decimal
    public var progress: Decimal
    public var status: String
    public var notes: String
    public var sourceLabel: String
    public var sourceUrl: String
    public var subtasks: [HomeworkSubtask]

    public init(assignment: HomeworkAssignment? = nil, dueDate: String) {
        title = assignment?.title ?? ""; course = assignment?.course ?? ""
        self.dueDate = assignment?.dueDate ?? dueDate; dueTime = assignment?.dueTime ?? "23:59"
        priority = assignment?.priority ?? "medium"; estimatedMinutes = assignment?.estimatedMinutes ?? 60
        progress = assignment?.progress ?? 0; status = assignment?.status ?? "not-started"
        notes = assignment?.notes ?? ""; sourceLabel = assignment?.sourceLabel ?? "Manual assignment"
        sourceUrl = assignment?.sourceUrl ?? ""; subtasks = assignment?.subtasks ?? []
    }
    public mutating func addSubtask(title: String) {
        let title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        subtasks.append(HomeworkSubtask(id: "subtask-" + UUID().uuidString, title: title, completed: false))
    }
}

public enum SchoolCommands {
    public static func save(_ draft: HomeworkDraft, original: HomeworkAssignment?, in data: AppData, now: Date = Date()) throws -> AppData {
        let title = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let course = draft.course.trimmingCharacters(in: .whitespacesAndNewlines)
        _ = try LocalDate(draft.dueDate)
        let time = draft.dueTime.split(separator: ":", omittingEmptySubsequences: false)
        guard !title.isEmpty, !course.isEmpty, time.count == 2,
              time[0].count == 2, time[1].count == 2,
              let hour = Int(time[0]), let minute = Int(time[1]), (0...23).contains(hour), (0...59).contains(minute),
              ["low", "medium", "high"].contains(draft.priority),
              ["not-started", "in-progress", "complete"].contains(draft.status),
              draft.estimatedMinutes >= 15, draft.estimatedMinutes <= Decimal(Int32.max),
              draft.progress >= 0, draft.progress <= 100,
              draft.subtasks.allSatisfy({ !$0.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) else { throw SchoolError.invalidHomework }
        if let original, data.assignments.first(where: { $0.id == original.id }) != original { throw SchoolError.staleDraft }
        let timestamp = ISO8601DateFormatter().string(from: now)
        var item = original ?? HomeworkAssignment(title: title, course: course, dueDate: draft.dueDate, dueTime: draft.dueTime,
            priority: draft.priority, estimatedMinutes: draft.estimatedMinutes, progress: 0, status: "not-started",
            notes: "", subtasks: [], id: "assignment-" + UUID().uuidString, createdAt: timestamp, updatedAt: timestamp, source: "manual")
        item.title = title; item.course = course; item.dueDate = draft.dueDate; item.dueTime = draft.dueTime
        item.priority = draft.priority; item.estimatedMinutes = draft.estimatedMinutes
        item.progress = draft.status == "complete" ? 100 : draft.progress
        item.status = item.progress >= 100 ? "complete" : (item.progress > 0 ? "in-progress" : draft.status)
        item.notes = draft.notes.trimmingCharacters(in: .whitespacesAndNewlines)
        let label = draft.sourceLabel.trimmingCharacters(in: .whitespacesAndNewlines)
        let url = draft.sourceUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        item.sourceLabel = label.isEmpty ? nil : label; item.sourceUrl = url.isEmpty ? nil : url
        item.subtasks = draft.subtasks; item.updatedAt = timestamp
        var result = data
        if let index = result.assignments.firstIndex(where: { $0.id == item.id }) { result.assignments[index] = item }
        else { result.assignments.append(item) }
        return result
    }

    public static func delete(_ original: HomeworkAssignment, in data: AppData) throws -> AppData {
        guard data.assignments.first(where: { $0.id == original.id }) == original else { throw SchoolError.staleDraft }
        var result = data
        result.assignments.removeAll { $0.id == original.id }
        result.events.removeAll { $0.assignmentId == original.id }
        return result
    }

    /// Recompute before applying so a changed assignment/calendar cannot apply an obsolete preview.
    public static func apply(_ preview: StudyPreview, startDate: String, to data: AppData, now: Date = Date()) throws -> AppData {
        guard try Domain.studyPreview(data, startDate: startDate) == preview else { throw SchoolError.staleDraft }
        let timestamp = ISO8601DateFormatter().string(from: now)
        var result = data
        result.events.removeAll { $0.kind == "study" && $0.locked != true && $0.completed != true && $0.userAdjusted != true }
        for block in preview.blocks {
            guard let assignment = data.assignments.first(where: { $0.id == block.assignmentId }) else { throw SchoolError.staleDraft }
            result.events.append(CalendarEvent(title: assignment.title, date: block.date, startTime: block.startTime,
                endTime: block.endTime, kind: "study", course: assignment.course, assignmentId: assignment.id,
                locked: false, userAdjusted: false, completed: false, sourceLabel: "Generated study plan",
                id: "study-" + UUID().uuidString, createdAt: timestamp, updatedAt: timestamp, source: "generated"))
        }
        return result
    }
}
