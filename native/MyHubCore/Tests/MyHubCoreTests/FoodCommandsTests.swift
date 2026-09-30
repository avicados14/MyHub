import XCTest
@testable import MyHubCore

final class FoodCommandsTests: XCTestCase {
    func fixture() throws -> Backup {
        try Backup.decode(Data(contentsOf: Bundle.module.url(forResource: "backup", withExtension: "json")!))
    }
    func testSharedBalanceMatchesGoldenAndConsumptionUsesSnapshot() throws {
        var backup = try fixture()
        let before = backup.data
        let golden = try JSONSerialization.jsonObject(with: Data(contentsOf: Bundle.module.url(forResource: "expected", withExtension: "json")!)) as! [String: Any]
        XCTAssertEqual(FoodCommands.remaining(before.leftovers[0], in: before), (golden["batchRemaining"] as! NSNumber).decimalValue)
        backup.data.recipes[0].nutritionPerServing.calories = 9999
        let meal = before.meals[0]
        backup.data = try FoodCommands.consume(meal, servings: 3, in: backup.data)
        let log = try XCTUnwrap(backup.data.foodLog.first { $0.sourceSnapshot.sourceId == "meal:\(meal.id)" })
        XCTAssertEqual(log.nutritionSnapshot.calories, meal.sourceSnapshot.nutritionPerServing.calories * 3)
        XCTAssertEqual(backup.data.meals[0].preparedServings, meal.preparedServings)
        XCTAssertEqual(backup.data.meals[0].servings, meal.servings)
        XCTAssertEqual(backup.data.groceryHistory, before.groceryHistory)
        XCTAssertEqual(backup.data.events, before.events)
        XCTAssertEqual(try Backup.decode(backup.encoded()), backup)
    }
    func testReplacingClearingAndStaleDraftPreserveUnrelatedHistory() throws {
        let data = try fixture().data
        let meal = data.meals[0]
        let first = try FoodCommands.consume(meal, servings: 3, in: data)
        XCTAssertThrowsError(try FoodCommands.consume(meal, servings: 4, in: first))
        let second = try FoodCommands.consume(first.meals[0], servings: 1, in: first)
        XCTAssertEqual(second.foodLog.filter { $0.sourceSnapshot.sourceId == "meal:\(meal.id)" }.count, 1)
        let cleared = try FoodCommands.consume(second.meals[0], servings: 0, in: second)
        XCTAssertEqual(cleared.foodLog, data.foodLog.filter { $0.sourceSnapshot.sourceId != "meal:\(meal.id)" })
        XCTAssertThrowsError(try FoodCommands.consume(meal, servings: -1, in: data))
        XCTAssertThrowsError(try FoodCommands.consume(meal, servings: .nan, in: data))
        XCTAssertEqual(cleared.groceryHistory, data.groceryHistory)
    }
    func testFullConsumptionAndUndoRestoreSharedBatch() throws {
        let data = try fixture().data
        let source = data.meals[0]
        let eatenElsewhere = data.meals.dropFirst().reduce(Decimal(0)) { $0 + $1.consumedServings }
        let full = try FoodCommands.consume(source, servings: source.preparedServings - eatenElsewhere, in: data)
        XCTAssertEqual(full.leftovers.first { $0.sourceMealId == source.id }?.servingsRemaining, 0)
        let undo = try FoodCommands.consume(full.meals[0], servings: 0, in: full)
        XCTAssertEqual(undo.leftovers.first { $0.sourceMealId == source.id }?.servingsRemaining, source.preparedServings - eatenElsewhere)
    }
}
