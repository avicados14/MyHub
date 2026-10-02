import XCTest
@testable import MyHubCore

final class DashboardTests: XCTestCase {
    func testLocalMidnightAndConsumptionSnapshot() throws {
        var (data, expected) = try DomainTests().load()
        data.settings.calendarTimeZone = "America/Denver"
        let clock = ISO8601DateFormatter()
        let before = try Domain.dailySummary(data, now: clock.date(from: "2026-01-06T06:59:00Z")!)
        XCTAssertEqual(before.date, "2026-01-05")
        XCTAssertEqual(before.nutrition, expected.nutrition)
        XCTAssertEqual(before.meals.count, data.meals.filter { $0.date == before.date }.count)
        let after = try Domain.dailySummary(data, now: clock.date(from: "2026-01-06T07:00:00Z")!)
        XCTAssertEqual(after.date, "2026-01-06")
        XCTAssertEqual(after.nutrition.calories, 0)
    }
    func testVisibilityMultidayAndCompletedHomework() throws {
        var (data, _) = try DomainTests().load()
        data.events[0].date = "2026-01-04"
        data.events[0].endDate = "2026-01-06"
        data.assignments[0].status = "complete"
        let now = ISO8601DateFormatter().date(from: "2026-01-05T18:00:00Z")!
        XCTAssertEqual(try Domain.dailySummary(data, now: now).events.count, 1)
        XCTAssertEqual(try Domain.dailySummary(data, now: now).assignments.count, 1)
        data.events[0].sourceFeedId = "disabled-feed"
        data.assignments[1].sourceFeedId = "disabled-feed"
        let summary = try Domain.dailySummary(data, now: now)
        XCTAssertTrue(summary.events.isEmpty)
        XCTAssertTrue(summary.assignments.isEmpty)
        XCTAssertEqual(data.events.count, 1)
        data.settings.calendarTimeZone = "Invalid/Zone"
        XCTAssertThrowsError(try Domain.dailySummary(data, now: now))
    }
}
