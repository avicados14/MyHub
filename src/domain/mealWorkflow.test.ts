import { describe, expect, it } from 'vitest'
import { createTestFixtureData } from '../test/fixtures'
import { logMealConsumption, moveOrCopyMeal, upsertMealWithLeftover } from './mealWorkflow'

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
    const copied = moveOrCopyMeal(
      data,
      meal.id,
      { date: '2026-09-24', slot: 'lunch' },
      'copy',
      '2026-09-22T12:00:00.000Z',
      'meal-copy',
    )
    expect(copied.meals).toHaveLength(data.meals.length + 1)
    expect(copied.meals.find((item) => item.id === 'meal-copy')).toEqual(
      expect.objectContaining({ date: '2026-09-24', slot: 'lunch', consumedServings: 0 }),
    )
    expect(meal.date).not.toBe('2026-09-24')
  })

  it('upserts a detail-page meal and synchronizes prepared minus consumed leftovers', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    const displaced = data.meals[0]!
    const replacement = {
      ...data.meals[1]!,
      id: 'meal-detail',
      date: displaced.date,
      slot: displaced.slot,
      preparedServings: 5,
      consumedServings: 2,
    }
    data.leftovers.push({
      id: 'old-leftover',
      createdAt: data.initializedAt,
      updatedAt: data.initializedAt,
      source: 'generated',
      sourceMealId: displaced.id,
      sourceSnapshot: displaced.sourceSnapshot,
      preparedOn: displaced.date,
      servingsRemaining: 1,
      storageLocation: 'Refrigerator',
    })

    const updated = upsertMealWithLeftover(data, replacement, '2026-09-22T12:00:00.000Z')
    expect(updated.meals.find((meal) => meal.id === displaced.id)).toBeUndefined()
    expect(updated.leftovers.find((leftover) => leftover.sourceMealId === displaced.id)).toBeUndefined()
    expect(updated.leftovers.find((leftover) => leftover.sourceMealId === replacement.id)?.servingsRemaining).toBe(3)
  })
})
