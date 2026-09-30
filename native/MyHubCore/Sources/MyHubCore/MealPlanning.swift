import Foundation

public enum MealPlanError: Error { case invalidPlan, occupiedSlot, staleSource, protectedMeal }
public enum MealPlanSource: Equatable {
    case recipe(Recipe)
    case packaged(PackagedFood)
}

extension FoodCommands {
    public static func canEditPlan(_ meal: MealEntry, in data: AppData) -> Bool {
        meal.preparedServings == 0 && meal.consumedServings == 0 && meal.leftoverId == nil &&
        meal.autoPlannedFromMealId == nil &&
        !data.meals.contains { $0.autoPlannedFromMealId == meal.id } &&
        !data.leftovers.contains { $0.sourceMealId == meal.id } &&
        !data.foodLog.contains { $0.sourceSnapshot.sourceId == "meal:\(meal.id)" }
    }

    /// Planning never prepares food or writes nutrition logs. Existing snapshots are immutable.
    public static func savePlan(original: MealEntry? = nil, source: MealPlanSource? = nil,
        date: String, slot: String, servings: Decimal, in data: AppData, now: Date = Date()) throws -> AppData {
        _ = try LocalDate(date)
        guard ["breakfast", "lunch", "dinner", "snack"].contains(slot), !servings.isNaN, servings > 0 else {
            throw MealPlanError.invalidPlan
        }
        let stamp = ISO8601DateFormatter().string(from: now)
        var meal: MealEntry
        if let original {
            guard data.meals.first(where: { $0.id == original.id }) == original else { throw FoodError.staleDraft }
            guard canEditPlan(original, in: data) else { throw MealPlanError.protectedMeal }
            meal = original
            meal.date = date; meal.slot = slot; meal.servings = servings; meal.updatedAt = stamp
        } else {
            let snapshot: MealSourceSnapshot
            var recipeID: String?, packagedID: String?
            switch source {
            case .some(.recipe(let recipe)):
                guard data.recipes.first(where: { $0.id == recipe.id }) == recipe else { throw MealPlanError.staleSource }
                recipeID = recipe.id
                snapshot = MealSourceSnapshot(sourceType: "recipe", sourceId: recipe.id, name: recipe.name,
                    image: recipe.image, nutritionPerServing: recipe.nutritionPerServing,
                    nutritionProvenance: recipe.nutritionProvenance, capturedAt: stamp)
            case .some(.packaged(let food)):
                guard data.packagedFoods.first(where: { $0.id == food.id }) == food else { throw MealPlanError.staleSource }
                packagedID = food.id
                snapshot = MealSourceSnapshot(sourceType: "packaged", sourceId: food.id, name: food.name,
                    image: food.image, nutritionPerServing: food.nutritionPerServing,
                    nutritionProvenance: food.nutritionProvenance, capturedAt: stamp)
            case nil: throw MealPlanError.invalidPlan
            }
            meal = MealEntry(date: date, slot: slot, recipeId: recipeID, packagedFoodId: packagedID,
                servings: servings, preparedServings: 0, consumedServings: 0, sourceSnapshot: snapshot,
                id: "meal-" + UUID().uuidString, createdAt: stamp, updatedAt: stamp, source: "manual")
        }
        guard !data.meals.contains(where: { $0.id != meal.id && $0.date == date && $0.slot == slot }) else {
            throw MealPlanError.occupiedSlot
        }
        var result = data
        if let index = result.meals.firstIndex(where: { $0.id == meal.id }) { result.meals[index] = meal }
        else { result.meals.append(meal) }
        return result
    }

    public static func deletePlan(_ original: MealEntry, in data: AppData) throws -> AppData {
        guard data.meals.first(where: { $0.id == original.id }) == original else { throw FoodError.staleDraft }
        guard canEditPlan(original, in: data) else { throw MealPlanError.protectedMeal }
        var result = data
        result.meals.removeAll { $0.id == original.id }
        return result
    }
}
