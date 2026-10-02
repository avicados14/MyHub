import Foundation

public enum FoodError: Error { case invalidServings, staleDraft }

public enum FoodCommands {
    private static func rounded(_ value: Decimal) -> Decimal {
        var input = value, result = Decimal()
        NSDecimalRound(&result, &input, 3, .plain)
        return result
    }
    private static func batchID(_ source: MealEntry, in data: AppData) -> String {
        data.leftovers.first { $0.sourceMealId == source.id }?.id
            ?? data.meals.first { $0.autoPlannedFromMealId == source.id }?.leftoverId
            ?? "leftover-\(source.id)"
    }
    public static func remaining(_ leftover: Leftover, in data: AppData) -> Decimal {
        guard let source = data.meals.first(where: { $0.id == leftover.sourceMealId }) else { return leftover.servingsRemaining }
        let id = batchID(source, in: data)
        let eaten = data.meals.filter { $0.id == source.id || $0.autoPlannedFromMealId == source.id || $0.leftoverId == id }
            .reduce(Decimal(0)) { $0 + $1.consumedServings }
        let direct = data.foodLog.filter { $0.sourceSnapshot.sourceId == id }.reduce(Decimal(0)) { $0 + $1.servings }
        return max(0, rounded(source.preparedServings - eaten - direct))
    }
    /// Matches web logMealConsumption: replaces this meal's log, never the recipe or unrelated history.
    public static func consume(_ original: MealEntry, servings: Decimal, in data: AppData, now: Date = Date()) throws -> AppData {
        guard !servings.isNaN, servings >= 0 else { throw FoodError.invalidServings }
        guard let index = data.meals.firstIndex(where: { $0.id == original.id }), data.meals[index] == original else {
            throw FoodError.staleDraft
        }
        let stamp = ISO8601DateFormatter().string(from: now)
        var result = data
        result.meals[index].consumedServings = servings
        result.meals[index].updatedAt = stamp
        let logSource = "meal:\(original.id)"
        result.foodLog.removeAll { $0.sourceSnapshot.sourceId == logSource }
        if servings > 0 {
            let n = original.sourceSnapshot.nutritionPerServing
            let nutrition = Nutrition(calories: n.calories * servings, protein: n.protein * servings,
                carbs: n.carbs * servings, fat: n.fat * servings, sugar: (n.sugar ?? 0) * servings,
                saturatedFat: (n.saturatedFat ?? 0) * servings, fiber: n.fiber * servings, sodium: n.sodium * servings)
            var snapshot = original.sourceSnapshot
            snapshot.sourceId = logSource; snapshot.capturedAt = stamp
            result.foodLog.append(FoodLogEntry(date: original.date, name: snapshot.name, servings: servings,
                nutritionSnapshot: nutrition, provenanceSnapshot: snapshot.nutritionProvenance,
                sourceSnapshot: snapshot, origin: snapshot.sourceType, id: "food-log-meal-\(original.id)",
                createdAt: stamp, updatedAt: stamp, source: "generated"))
        }
        let sourceID = original.autoPlannedFromMealId ?? (original.leftoverId == nil ? original.id :
            data.leftovers.first { $0.id == original.leftoverId }?.sourceMealId)
        guard let sourceID, let source = result.meals.first(where: { $0.id == sourceID }) else { return result }
        let existing = result.leftovers.first { $0.sourceMealId == source.id }
        var candidate = existing ?? Leftover(sourceMealId: source.id, sourceSnapshot: source.sourceSnapshot,
            preparedOn: source.date, servingsRemaining: 0, storageLocation: "Refrigerator", id: "leftover-\(source.id)",
            createdAt: stamp, updatedAt: stamp, source: "generated")
        let balance: Decimal = source.autoPlannedFromMealId != nil ? 0 : source.leftoverId != nil
            ? max(0, source.preparedServings - source.consumedServings) : remaining(candidate, in: result)
        result.leftovers.removeAll { $0.sourceMealId == source.id }
        if balance > 0 || existing != nil {
            candidate.servingsRemaining = balance; candidate.updatedAt = stamp
            candidate.sourceSnapshot = source.sourceSnapshot
            result.leftovers.append(candidate)
        }
        return result
    }
}
