import XCTest
@testable import MyHubCore

final class DomainTests: XCTestCase {
    struct Expected: Decodable {
        struct Scaling: Decodable { var servings: Decimal; var quantities: [Decimal?]; var formatted: [String] }
        var scaling: Scaling
        var nutrition: Nutrition
        var assignmentOrder: [String]
        var study: StudyPreview
    }
    func load() throws -> (AppData, Expected) {
        let backup = try Backup.decode(Data(contentsOf: Bundle.module.url(forResource: "backup", withExtension: "json")!))
        let expected = try JSONDecoder().decode(Expected.self, from: Data(contentsOf: Bundle.module.url(forResource: "expected", withExtension: "json")!))
        return (backup.data, expected)
    }
    func testScalingAndFractionsMatchWebGolden() throws {
        let (data, expected) = try load()
        let ingredients = try Domain.scaledIngredients(data.recipes[0], servings: expected.scaling.servings)
        XCTAssertEqual(ingredients.map(\.quantity), expected.scaling.quantities)
        XCTAssertEqual(ingredients.prefix(2).map { Domain.formatQuantity($0.quantity!) }, expected.scaling.formatted)
        XCTAssertNil(ingredients[2].quantity)
        XCTAssertEqual(data.recipes[0].ingredients[0].quantity, 1)
        var invalid = data.recipes[0]; invalid.originalYield = 0
        XCTAssertThrowsError(try Domain.scaledIngredients(invalid, servings: 4))
    }
    func testNutritionUsesImmutableConsumptionOnly() throws {
        var (data, expected) = try load()
        data.recipes[0].nutritionPerServing.calories = 9999
        data.meals[0].servings = 99
        XCTAssertEqual(Domain.nutritionForDate(data, date: "2026-01-05"), expected.nutrition)
    }
    func testPriorityAndStudyMatchWebGolden() throws {
        let (data, expected) = try load()
        XCTAssertEqual(Domain.rankAssignments(data.assignments).map(\.id), expected.assignmentOrder)
        XCTAssertEqual(try Domain.studyPreview(data, startDate: "2026-01-05"), expected.study)
    }
    func testStudyPreservesLockedBlocksAndRejectsInvalidDuration() throws {
        var (data, _) = try load()
        data.events[0].kind = "study"
        data.events[0].locked = true
        data.events[0].assignmentId = "task-high"
        let preview = try Domain.studyPreview(data, startDate: "2026-01-05")
        XCTAssertFalse(preview.blocks.contains { $0.assignmentId == "task-high" })
        XCTAssertEqual(data.events[0].startTime, "08:00")
        data.settings.study.defaultBlockMinutes = 0
        XCTAssertThrowsError(try Domain.studyPreview(data, startDate: "2026-01-05"))
    }
    func testDisabledSourceIsHiddenWithoutDeletingRecords() throws {
        var (data, _) = try load()
        data.events[0].sourceFeedId = "disabled-feed"
        data.assignments[0].sourceFeedId = "disabled-feed"
        XCTAssertTrue(Domain.visibleEvents(data).isEmpty)
        XCTAssertEqual(Domain.visibleAssignments(data).count, 1)
        XCTAssertEqual(data.events.count, 1)
        XCTAssertEqual(data.assignments.count, 2)
    }
    func testStudyKeepsLocalDatesAcrossDaylightSavingBoundary() throws {
        var (data, _) = try load()
        data.settings.calendarTimeZone = "America/Denver"
        data.events[0].date = "2026-03-08"
        data.events[0].allDay = true
        for index in data.assignments.indices { data.assignments[index].dueDate = "2026-03-09" }
        let result = try Domain.studyPreview(data, startDate: "2026-03-08")
        XCTAssertEqual(result.blocks.map(\.date), ["2026-03-09", "2026-03-09"])
        XCTAssertEqual(result.blocks.first?.startTime, "08:00")
        XCTAssertEqual(result.unscheduledMinutes, 0)
    }

}
