import { describe, expect, it } from 'vitest'
import { createTestFixtureData } from '../test/fixtures'
import { logMealConsumption, moveOrCopyMeal } from './mealWorkflow'

describe('meal lifecycle', () => {
  it('logs consumed nutrition and derives leftovers from prepared minus consumed servings', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    const meal = data.meals.find((item) => item.id === 'meal-week')!
    const updated = logMealConsumption(data, meal.id, 1.5, '2026-09-22T12:00:00.000Z')
    const log = updated.foodLog.find((entry) => entry.sourceSnapshot.sourceId === `meal:${meal.id}`)!
    expect(log.nutritionSnapshot.calories).toBe(meal.sourceSnapshot.nutritionPerServing.calories * 1.5)
    expect(updated.leftovers.find((item) => item.sourceMealId === meal.id)?.servingsRemaining).toBe(2.5)
    expect(log.sourceSnapshot.nutritionPerServing).toEqual(meal.sourceSnapshot.nutritionPerServing)
  })

  it('moves or copies meals without mutating source snapshots', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    const meal = data.meals[0]!
    const copied = moveOrCopyMeal(data, meal.id, { date: '2026-09-24', slot: 'lunch' }, 'copy', '2026-09-22T12:00:00.000Z', 'meal-copy')
    expect(copied.meals).toHaveLength(data.meals.length + 1)
    expect(copied.meals.find((item) => item.id === 'meal-copy')).toEqual(expect.objectContaining({ date: '2026-09-24', slot: 'lunch', consumedServings: 0 }))
    expect(meal.date).not.toBe('2026-09-24')
  })
})
