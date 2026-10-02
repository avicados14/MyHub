import XCTest
@testable import MyHubCore

final class SchoolCommandsTests: XCTestCase {
    func fixture() throws -> Backup {
        try Backup.decode(Data(contentsOf: Bundle.module.url(forResource: "backup", withExtension: "json")!))
    }
    let now = Date(timeIntervalSince1970: 1_800_000_000)

    func testHomeworkCreateEditPreservesProvenanceAndPersists() throws {
        var backup = try fixture()
        let before = backup.data
        var draft = HomeworkDraft(dueDate: "2026-01-09")
        draft.title = "  Synthetic lab  "; draft.course = "Example course"
        draft.addSubtask(title: " Review diagram ")
        draft.progress = 25
        backup.data = try SchoolCommands.save(draft, original: nil, in: backup.data, now: now)
        var created = try XCTUnwrap(backup.data.assignments.last)
        XCTAssertEqual(created.title, "Synthetic lab")
        XCTAssertEqual(created.status, "in-progress")
        XCTAssertEqual(created.source, "manual")
        XCTAssertEqual(created.subtasks.first?.title, "Review diagram")
        // Imported metadata must survive editing; synthetic values only.
        created.source = "imported"; created.externalId = "example-external"
        created.sourceFeedId = "example-feed"; created.sourceType = "canvas"
        created.importedAt = "2026-01-01T12:00:00Z"
        backup.data.assignments[backup.data.assignments.count - 1] = created
        draft = HomeworkDraft(assignment: created, dueDate: created.dueDate)
        draft.status = "complete"; draft.notes = "Reviewed"
        backup.data = try SchoolCommands.save(draft, original: created, in: backup.data, now: now)
        let edited = try XCTUnwrap(backup.data.assignments.last)
        XCTAssertEqual(edited.id, created.id); XCTAssertEqual(edited.createdAt, created.createdAt)
        XCTAssertEqual(edited.source, created.source); XCTAssertEqual(edited.externalId, created.externalId)
        XCTAssertEqual(edited.sourceFeedId, created.sourceFeedId); XCTAssertEqual(edited.sourceType, created.sourceType)
        XCTAssertEqual(edited.importedAt, created.importedAt); XCTAssertEqual(edited.subtasks, created.subtasks)
        XCTAssertEqual(edited.progress, 100); XCTAssertEqual(edited.status, "complete")
        XCTAssertEqual(backup.data.foodLog, before.foodLog); XCTAssertEqual(backup.data.groceryHistory, before.groceryHistory)
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = LocalStore(url: directory.appendingPathComponent("data.json"))
        try store.save(backup)
        XCTAssertEqual(try store.load(), backup)
    }

    func testRejectsInvalidAndStaleHomeworkDrafts() throws {
        var data = try fixture().data
        let original = data.assignments[0]
        var draft = HomeworkDraft(assignment: original, dueDate: original.dueDate)
        draft.dueDate = "2026-02-30"
        XCTAssertThrowsError(try SchoolCommands.save(draft, original: original, in: data))
        draft.dueDate = original.dueDate; draft.dueTime = "25:00"
        XCTAssertThrowsError(try SchoolCommands.save(draft, original: original, in: data))
        draft.dueTime = original.dueTime; draft.progress = 101
        XCTAssertThrowsError(try SchoolCommands.save(draft, original: original, in: data))
        draft.progress = 20; draft.estimatedMinutes = 0
        XCTAssertThrowsError(try SchoolCommands.save(draft, original: original, in: data))
        draft.estimatedMinutes = 60; data.assignments[0].notes = "Newer edit"
        XCTAssertThrowsError(try SchoolCommands.save(draft, original: original, in: data))
        XCTAssertThrowsError(try SchoolCommands.delete(original, in: data))
        XCTAssertEqual(data.assignments[0].notes, "Newer edit")
    }

    func testApplyReplacesOnlyUnprotectedStudyBlocksAndRejectsChangedPreview() throws {
        var backup = try fixture()
        let original = backup.data.events[0]
        for (index, protection) in ["locked", "completed", "adjusted", "none"].enumerated() {
            var event = original
            event.id = "study-existing-\(index)"; event.kind = "study"
            event.date = "2026-01-04"; event.assignmentId = nil
            event.locked = protection == "locked"; event.completed = protection == "completed"
            event.userAdjusted = protection == "adjusted"
            backup.data.events.append(event)
        }
        let preview = try Domain.studyPreview(backup.data, startDate: "2026-01-05")
        let result = try SchoolCommands.apply(preview, startDate: "2026-01-05", to: backup.data, now: now)
        XCTAssertEqual(result.events.filter { $0.id.hasPrefix("study-existing-") }.map(\.id), ["study-existing-0", "study-existing-1", "study-existing-2"])
        XCTAssertEqual(result.events.first, original)
        XCTAssertEqual(result.assignments, backup.data.assignments)
        XCTAssertEqual(result.foodLog, backup.data.foodLog)
        let generated = result.events.filter { $0.source == "generated" && $0.assignmentId != nil }
        XCTAssertEqual(generated.count, preview.blocks.count)
        XCTAssertEqual(Set(generated.map(\.id)).count, generated.count)
        XCTAssertTrue(generated.allSatisfy { $0.sourceLabel == "Generated study plan" })
        let again = try SchoolCommands.apply(preview, startDate: "2026-01-05", to: result, now: now)
        XCTAssertEqual(again.events.count, result.events.count)
        backup.data.assignments[0].estimatedMinutes += 30
        XCTAssertThrowsError(try SchoolCommands.apply(preview, startDate: "2026-01-05", to: backup.data))
    }

    func testDeleteRemovesLinkedEventsButRetainsUnrelatedHistory() throws {
        let data = try fixture().data
        let preview = try Domain.studyPreview(data, startDate: "2026-01-05")
        let scheduled = try SchoolCommands.apply(preview, startDate: "2026-01-05", to: data, now: now)
        let target = data.assignments[0]
        let result = try SchoolCommands.delete(target, in: scheduled)
        XCTAssertFalse(result.assignments.contains { $0.id == target.id })
        XCTAssertFalse(result.events.contains { $0.assignmentId == target.id })
        XCTAssertEqual(result.events.filter { $0.assignmentId != target.id }, scheduled.events.filter { $0.assignmentId != target.id })
        XCTAssertEqual(result.foodLog, data.foodLog); XCTAssertEqual(result.groceryHistory, data.groceryHistory)
    }
}
