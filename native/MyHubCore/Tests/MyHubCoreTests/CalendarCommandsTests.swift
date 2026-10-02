import XCTest
@testable import MyHubCore

final class CalendarCommandsTests: XCTestCase {
    func fixture() throws -> AppData {
        try Backup.decode(Data(contentsOf: Bundle.module.url(forResource: "backup", withExtension: "json")!)).data
    }
    func testMoveStudyBlockPreservesIdentityAndRegenerationProtection() throws {
        let base = try fixture()
        let preview = try Domain.studyPreview(base, startDate: "2026-01-05")
        let data = try SchoolCommands.apply(preview, startDate: "2026-01-05", to: base)
        let event = try XCTUnwrap(data.events.first { $0.kind == "study" })
        var draft = EventDraft(event: event, date: event.date)
        draft.startTime = "15:00"; draft.endTime = "15:30"
        let changed = try CalendarCommands.save(draft, original: event, in: data)
        let moved = try XCTUnwrap(changed.events.first { $0.id == event.id })
        XCTAssertEqual(moved.createdAt, event.createdAt); XCTAssertEqual(moved.assignmentId, event.assignmentId)
        XCTAssertEqual(moved.source, event.source); XCTAssertEqual(moved.userAdjusted, true)
        let next = try Domain.studyPreview(changed, startDate: "2026-01-05")
        let regenerated = try SchoolCommands.apply(next, startDate: "2026-01-05", to: changed)
        XCTAssertEqual(regenerated.events.first { $0.id == moved.id }, moved)
        XCTAssertEqual(regenerated.foodLog, base.foodLog); XCTAssertEqual(regenerated.groceryHistory, base.groceryHistory)
    }
    func testCompletionAndReopeningLockWithoutChangingHomework() throws {
        let base = try fixture()
        let data = try SchoolCommands.apply(Domain.studyPreview(base, startDate: "2026-01-05"), startDate: "2026-01-05", to: base)
        let event = try XCTUnwrap(data.events.first { $0.kind == "study" })
        let completed = try CalendarCommands.setStudyState(event, completed: true, in: data)
        let done = try XCTUnwrap(completed.events.first { $0.id == event.id })
        XCTAssertEqual(done.completed, true); XCTAssertEqual(done.locked, true)
        let reopened = try CalendarCommands.setStudyState(done, completed: false, in: completed)
        let open = try XCTUnwrap(reopened.events.first { $0.id == event.id })
        XCTAssertEqual(open.completed, false); XCTAssertEqual(open.locked, true)
        XCTAssertEqual(reopened.assignments, base.assignments)
        XCTAssertThrowsError(try CalendarCommands.setStudyState(event, locked: false, in: completed))
    }
    func testOverlapsRequireReviewAndMalformedOrStaleEditsFail() throws {
        let data = try fixture()
        let event = data.events[0]
        var draft = EventDraft(date: event.date); draft.title = "Synthetic overlap"
        draft.startTime = event.startTime; draft.endTime = event.endTime
        XCTAssertThrowsError(try CalendarCommands.save(draft, original: nil, in: data)) { error in
            guard case CalendarEditError.overlapNeedsConfirmation = error else { return XCTFail("Wrong validation error") }
        }
        let added = try CalendarCommands.save(draft, original: nil, in: data, allowOverlap: true)
        XCTAssertEqual(added.events.count, data.events.count + 1)
        draft.endTime = draft.startTime
        XCTAssertThrowsError(try CalendarCommands.save(draft, original: nil, in: data, allowOverlap: true))
        draft.endTime = "25:00"
        XCTAssertThrowsError(try CalendarCommands.save(draft, original: nil, in: data))
        var stale = data; stale.events[0].title = "Newer title"
        XCTAssertThrowsError(try CalendarCommands.delete(event, in: stale))
        XCTAssertEqual(stale.events[0].title, "Newer title")
    }
    func testImportedBoundsAndProvenanceSurviveEditing() throws {
        var data = try fixture()
        data.events[0].startTime = "22:00"; data.events[0].endTime = "07:00"
        data.events[0].endDate = "2026-01-07"; data.events[0].uid = "synthetic-uid"
        let event = data.events[0]
        var draft = EventDraft(event: event, date: event.date); draft.title = "Updated example"
        let changed = try CalendarCommands.save(draft, original: event, in: data)
        XCTAssertEqual(changed.events[0].uid, event.uid); XCTAssertEqual(changed.events[0].endDate, event.endDate)
        draft.date = "2026-01-06"
        XCTAssertThrowsError(try CalendarCommands.save(draft, original: event, in: data))
        data.events[0].startTime = "08:00"; data.events[0].endTime = "09:00"
        data.events[0].endDate = data.events[0].date
        let single = data.events[0]
        draft = EventDraft(event: single, date: single.date); draft.date = "2026-01-08"
        let moved = try CalendarCommands.save(draft, original: single, in: data)
        XCTAssertEqual(moved.events[0].endDate, "2026-01-08")
    }
    func testStudySettingsChangeNextPreviewAndRejectInvalidOrStaleRules() throws {
        let data = try fixture()
        var settings = data.settings.study
        settings.earliestTime = "14:00"; settings.latestTime = "18:00"
        var range = CalendarCommands.newAvoidRange(); range.startTime = "14:00"; range.endTime = "15:00"
        settings.avoidTimes = [range]
        let changed = try CalendarCommands.saveSettings(settings, original: data.settings.study, in: data)
        XCTAssertEqual(changed.events, data.events)
        let preview = try Domain.studyPreview(changed, startDate: "2026-01-05")
        XCTAssertTrue(preview.blocks.allSatisfy { $0.startTime >= "15:00" })
        XCTAssertThrowsError(try CalendarCommands.saveSettings(settings, original: data.settings.study, in: changed))
        settings.defaultBlockMinutes = 0
        XCTAssertThrowsError(try CalendarCommands.saveSettings(settings, original: data.settings.study, in: data))
        settings.defaultBlockMinutes = 30; settings.avoidTimes[0].days = [7]
        XCTAssertThrowsError(try CalendarCommands.saveSettings(settings, original: data.settings.study, in: data))
    }
}
