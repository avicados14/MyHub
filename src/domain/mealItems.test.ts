import { describe, expect, it } from 'vitest'
import { createTestFixtureData } from '../test/fixtures'
import { logMealConsumption, moveOrCopyMeal, removeMealWithBatch, upsertMealWithLeftover } from './mealWorkflow'

const stamp = '2026-10-19T12:00:00Z'
describe('multiple items per meal', () => {
  it('keeps independent consumption, logs and batches when adding, editing and removing a drink', () => {
    let data = createTestFixtureData()
    const main = data.meals[0]!
    const drink = {
      ...main,
      id: 'drink',
      preparedServings: 1,
      consumedServings: 0,
      recipeId: undefined,
      customName: 'Milk',
      sourceSnapshot: {
        ...main.sourceSnapshot,
        sourceType: 'custom' as const,
        sourceId: undefined,
        name: 'Milk',
        nutritionPerServing: { calories: 120, protein: 8, carbs: 12, fat: 5, fiber: 0, sodium: 100 },
      },
    }
    data = logMealConsumption(data, main.id, 1, stamp)
    const mainLog = data.foodLog.find((log) => log.id === `food-log-meal-${main.id}`)
    data = upsertMealWithLeftover(data, drink, stamp)
    data = logMealConsumption(data, drink.id, 2, stamp)
    expect(data.meals.filter((item) => item.date === main.date && item.slot === main.slot)).toHaveLength(2)
    expect(data.foodLog.find((log) => log.id === 'food-log-meal-drink')?.nutritionSnapshot.calories).toBe(240)
    expect(data.foodLog.find((log) => log.id === `food-log-meal-${main.id}`)).toEqual(mainLog)
    data = upsertMealWithLeftover(data, { ...data.meals.find((m) => m.id === 'drink')!, servings: 2 }, stamp)
    expect(data.meals.filter((item) => item.id === 'drink')).toHaveLength(1)
    data = removeMealWithBatch(data, 'drink')
    expect(data.meals.find((item) => item.id === main.id)).toBeDefined()
    expect(data.foodLog.find((log) => log.id === `food-log-meal-${main.id}`)).toEqual(mainLog)
  })
  it('moves and copies into occupied meal groups without deleting other items', () => {
    const data = createTestFixtureData()
    const [first, second] = data.meals
    for (const mode of ['move', 'copy'] as const) {
      const updated = moveOrCopyMeal(data, first!.id, { date: second!.date, slot: second!.slot }, mode, stamp, 'copy')
      expect(updated.meals.find((item) => item.id === second!.id)).toEqual(second)
      expect(updated.meals.filter((item) => item.date === second!.date && item.slot === second!.slot)).toHaveLength(2)
    }
  })
})
