import XCTest
@testable import MyHubCore

final class CalendarExportTests: XCTestCase {
    private func event() throws -> CalendarEvent {
        var value = try Backup.decode(Data(contentsOf: Bundle.module.url(forResource: "backup", withExtension: "json")!)).data.events[0]
        value.date = "2026-01-05"; value.endDate = nil; value.allDay = false
        value.startTime = "09:00"; value.endTime = "10:00"
        return value
    }
    private func utc(_ value: String) -> Date { ISO8601DateFormatter().date(from: value)! }

    func testTimedExportUsesConfiguredZoneAndPreservesSource() throws {
        var value = try event()
        value.description = "Synthetic notes"; value.location = "Synthetic room"
        value.sourceUrl = "https://example.invalid/private-source"; value.uid = "synthetic-source"
        let original = value
        let draft = try CalendarExport(event: value, timeZone: "America/Denver")
        XCTAssertEqual(draft.start, utc("2026-01-05T16:00:00Z"))
        XCTAssertEqual(draft.end, utc("2026-01-05T17:00:00Z"))
        XCTAssertEqual(draft.notes, "Synthetic notes"); XCTAssertEqual(draft.location, "Synthetic room")
        XCTAssertEqual(value, original)
    }
    func testOvernightEventUsesExplicitEndDate() throws {
        var value = try event()
        value.startTime = "23:30"; value.endTime = "01:00"; value.endDate = "2026-01-06"
        let draft = try CalendarExport(event: value, timeZone: "UTC")
        XCTAssertEqual(draft.end.timeIntervalSince(draft.start), 90 * 60)
        value.endDate = nil
        XCTAssertThrowsError(try CalendarExport(event: value, timeZone: "UTC"))
    }
    func testAllDayInclusiveRangeBecomesExclusiveAndFloatsOnDevice() throws {
        var value = try event()
        value.allDay = true; value.endDate = "2026-01-07"
        let tokyo = TimeZone(identifier: "Asia/Tokyo")!
        let draft = try CalendarExport(event: value, timeZone: "America/Denver", deviceTimeZone: tokyo)
        XCTAssertEqual(draft.start, utc("2026-01-04T15:00:00Z"))
        XCTAssertEqual(draft.end, utc("2026-01-07T15:00:00Z"))
        XCTAssertEqual(draft.timeZone, tokyo); XCTAssertTrue(draft.allDay)
    }
    func testAllDayUsesCalendarDaysAcrossSpringTransition() throws {
        var value = try event()
        value.date = "2026-03-08"; value.allDay = true
        let draft = try CalendarExport(event: value, timeZone: "America/Denver", deviceTimeZone: TimeZone(identifier: "America/Denver")!)
        XCTAssertEqual(draft.start, utc("2026-03-08T07:00:00Z"))
        XCTAssertEqual(draft.end, utc("2026-03-09T06:00:00Z"))
        XCTAssertEqual(draft.end.timeIntervalSince(draft.start), 23 * 60 * 60)
    }
    func testMissingSpringTimeIsRejected() throws {
        var value = try event()
        value.date = "2026-03-08"; value.startTime = "02:30"; value.endTime = "03:30"
        XCTAssertThrowsError(try CalendarExport(event: value, timeZone: "America/Denver"))
    }
    func testRepeatedFallTimeUsesFirstOccurrence() throws {
        var value = try event()
        value.date = "2026-11-01"; value.startTime = "01:30"; value.endTime = "02:30"
        let draft = try CalendarExport(event: value, timeZone: "America/Denver")
        XCTAssertEqual(draft.start, utc("2026-11-01T07:30:00Z"))
        XCTAssertEqual(draft.end, utc("2026-11-01T09:30:00Z"))
    }
    func testInvalidInputsDoNotProduceAnExport() throws {
        let original = try event()
        XCTAssertThrowsError(try CalendarExport(event: original, timeZone: "Invalid/Zone"))
        for day in ["2026-02-30", "2026-13-01", "2026-1-05", "2026-01-05\n", "0000-01-01"] {
            var value = original; value.date = day
            XCTAssertThrowsError(try CalendarExport(event: value, timeZone: "UTC"))
        }
        for time in ["24:00", "09:60", "9:00", "09:00\n"] {
            var value = original; value.startTime = time
            XCTAssertThrowsError(try CalendarExport(event: value, timeZone: "UTC"))
        }
        var value = original; value.title = "  "
        XCTAssertThrowsError(try CalendarExport(event: value, timeZone: "UTC"))
        value = original; value.allDay = true; value.endDate = "2026-01-04"
        XCTAssertThrowsError(try CalendarExport(event: value, timeZone: "UTC"))
    }
}
