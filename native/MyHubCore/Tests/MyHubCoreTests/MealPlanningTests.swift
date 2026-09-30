import XCTest
@testable import MyHubCore

final class MealPlanningTests: XCTestCase {
    func fixture() throws -> Backup {
        try Backup.decode(Data(contentsOf: Bundle.module.url(forResource: "backup", withExtension: "json")!))
    }
    func testPlanningSnapshotsDoesNotPrepareOrConsume() throws {
        var backup = try fixture()
        let before = backup.data, recipe = before.recipes[0]
        backup.data = try FoodCommands.savePlan(source: .recipe(recipe), date: "2026-03-08", slot: "lunch", servings: 2, in: before)
        let meal = try XCTUnwrap(backup.data.meals.last)
        XCTAssertEqual(meal.date, "2026-03-08")
        XCTAssertEqual(meal.preparedServings, 0); XCTAssertEqual(meal.consumedServings, 0)
        XCTAssertEqual(meal.sourceSnapshot.nutritionPerServing, recipe.nutritionPerServing)
        XCTAssertEqual(meal.sourceSnapshot.nutritionProvenance, recipe.nutritionProvenance)
        backup.data.recipes[0].nutritionPerServing.calories = 9999
        XCTAssertEqual(backup.data.meals.last?.sourceSnapshot.nutritionPerServing, recipe.nutritionPerServing)
        XCTAssertEqual(backup.data.foodLog, before.foodLog); XCTAssertEqual(backup.data.leftovers, before.leftovers)
        XCTAssertEqual(backup.data.groceryHistory, before.groceryHistory)
        XCTAssertEqual(try Backup.decode(backup.encoded()), backup)
    }
    func testPackagedFoodPlan() throws {
        var data = try fixture().data
        let recipe = data.recipes[0]
        let food = PackagedFood(name: "Synthetic beans", servingSize: PackagedFoodServingSize(quantity: 1, unit: "cup"),
            nutritionPerServing: recipe.nutritionPerServing, nutritionProvenance: recipe.nutritionProvenance,
            id: "synthetic-packaged", createdAt: recipe.createdAt, updatedAt: recipe.updatedAt, source: "manual")
        data.packagedFoods.append(food)
        let planned = try FoodCommands.savePlan(source: .packaged(food), date: "2026-01-08", slot: "snack", servings: 1, in: data)
        XCTAssertEqual(planned.meals.last?.packagedFoodId, food.id)
        XCTAssertNil(planned.meals.last?.recipeId)
        XCTAssertEqual(planned.meals.last?.sourceSnapshot.sourceType, "packaged")
        data.packagedFoods[0].name = "Changed"
        XCTAssertThrowsError(try FoodCommands.savePlan(source: .packaged(food), date: "2026-01-08", slot: "snack", servings: 1, in: data))
    }
    func testOccupiedInvalidAndStalePlansAreRejected() throws {
        var data = try fixture().data
        let recipe = data.recipes[0], occupied = data.meals[0]
        XCTAssertThrowsError(try FoodCommands.savePlan(source: .recipe(recipe), date: occupied.date, slot: occupied.slot, servings: 1, in: data))
        for servings in [Decimal(0), Decimal(-1), Decimal.nan] {
            XCTAssertThrowsError(try FoodCommands.savePlan(source: .recipe(recipe), date: "2026-01-08", slot: "lunch", servings: servings, in: data))
        }
        XCTAssertThrowsError(try FoodCommands.savePlan(source: .recipe(recipe), date: "2026-02-30", slot: "lunch", servings: 1, in: data))
        data.recipes[0].name = "Changed"
        XCTAssertThrowsError(try FoodCommands.savePlan(source: .recipe(recipe), date: "2026-01-08", slot: "lunch", servings: 1, in: data))
    }
    func testUntouchedPlanEditsPreserveSnapshotAndDeletionPreservesHistory() throws {
        let before = try fixture().data
        let added = try FoodCommands.savePlan(source: .recipe(before.recipes[0]), date: "2026-01-08", slot: "lunch", servings: 1, in: before)
        let original = try XCTUnwrap(added.meals.last)
        let changed = try FoodCommands.savePlan(original: original, date: "2026-01-09", slot: "dinner", servings: 3, in: added)
        let edited = try XCTUnwrap(changed.meals.last)
        XCTAssertEqual(edited.id, original.id); XCTAssertEqual(edited.createdAt, original.createdAt)
        XCTAssertEqual(edited.sourceSnapshot, original.sourceSnapshot)
        XCTAssertThrowsError(try FoodCommands.deletePlan(original, in: changed))
        XCTAssertEqual(try FoodCommands.deletePlan(edited, in: changed), before)
        XCTAssertThrowsError(try FoodCommands.deletePlan(before.meals[0], in: before))
        let consumed = try FoodCommands.consume(edited, servings: 1, in: changed)
        XCTAssertThrowsError(try FoodCommands.deletePlan(consumed.meals.last!, in: consumed))
    }
}
