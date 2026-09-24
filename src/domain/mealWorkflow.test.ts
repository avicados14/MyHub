import { describe, expect, it } from 'vitest'
import { createTestFixtureData } from '../test/fixtures'
import {
  consumeLeftover,
  logMealConsumption,
  moveOrCopyMeal,
  reconcileMealBatchBalances,
  remainingBatchServingsForMeal,
  removeMealWithBatch,
  upsertMealWithLeftover,
} from './mealWorkflow'

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

  it('plans extra prepared servings on future open days and skips occupied slots', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    const sourceMeal = {
      ...data.meals[0]!,
      id: 'meal-batch',
      date: '2026-09-22',
      slot: 'dinner' as const,
      servings: 1,
      preparedServings: 4,
      consumedServings: 0,
    }
    const occupiedMeal = {
      ...data.meals[1]!,
      id: 'meal-occupied',
      date: '2026-09-23',
      slot: 'dinner' as const,
    }
    data.meals = [occupiedMeal]
    data.leftovers = []

    const updated = upsertMealWithLeftover(data, sourceMeal, '2026-09-22T12:00:00.000Z', {
      autoPlanExtraServings: true,
      createMealId: (sequence) => `meal-batch-${sequence + 1}`,
    })

    expect(updated.meals.filter((meal) => meal.autoPlannedFromMealId === sourceMeal.id)).toEqual([
      expect.objectContaining({
        id: 'meal-batch-1',
        date: '2026-09-24',
        servings: 1,
        leftoverId: 'leftover-meal-batch',
      }),
      expect.objectContaining({
        id: 'meal-batch-2',
        date: '2026-09-25',
        servings: 1,
        leftoverId: 'leftover-meal-batch',
      }),
      expect.objectContaining({
        id: 'meal-batch-3',
        date: '2026-09-26',
        servings: 1,
        leftoverId: 'leftover-meal-batch',
      }),
    ])
    expect(updated.leftovers.find((leftover) => leftover.sourceMealId === sourceMeal.id)?.servingsRemaining).toBe(4)
  })

  it('decreases one shared batch balance as servings are eaten on different days and restores it when undone', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    const sourceMeal = {
      ...data.meals[0]!,
      id: 'meal-batch',
      date: '2026-09-22',
      slot: 'dinner' as const,
      servings: 1,
      preparedServings: 4,
      consumedServings: 0,
    }
    data.meals = []
    data.leftovers = []
    const planned = upsertMealWithLeftover(data, sourceMeal, '2026-09-22T12:00:00.000Z', {
      autoPlanExtraServings: true,
      createMealId: (sequence) => `meal-batch-${sequence + 1}`,
    })
    const afterFirstDay = logMealConsumption(planned, sourceMeal.id, 1, '2026-09-22T18:00:00.000Z')
    const afterSecondDay = logMealConsumption(afterFirstDay, 'meal-batch-1', 1, '2026-09-24T18:00:00.000Z')
    const afterUndo = logMealConsumption(afterSecondDay, 'meal-batch-1', 0, '2026-09-24T18:05:00.000Z')

    expect(afterFirstDay.leftovers[0]?.servingsRemaining).toBe(3)
    expect(afterSecondDay.leftovers[0]?.servingsRemaining).toBe(2)
    expect(afterUndo.leftovers[0]?.servingsRemaining).toBe(3)
    expect(afterSecondDay.foodLog.filter((entry) => entry.sourceSnapshot.sourceId?.startsWith('meal:'))).toHaveLength(2)
  })

  it('removes generated future portions and their logs when the source batch is deleted', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    const sourceMeal = {
      ...data.meals[0]!,
      id: 'meal-batch',
      date: '2026-09-22',
      slot: 'dinner' as const,
      servings: 1,
      preparedServings: 3,
      consumedServings: 0,
    }
    data.meals = []
    data.leftovers = []
    const planned = upsertMealWithLeftover(data, sourceMeal, '2026-09-22T12:00:00.000Z', {
      autoPlanExtraServings: true,
      createMealId: (sequence) => `meal-batch-${sequence + 1}`,
    })
    const consumed = logMealConsumption(planned, 'meal-batch-1', 1, '2026-09-23T18:00:00.000Z')
    const removed = removeMealWithBatch(consumed, sourceMeal.id)

    expect(
      removed.meals.some((meal) => meal.id === sourceMeal.id || meal.autoPlannedFromMealId === sourceMeal.id),
    ).toBe(false)
    expect(removed.leftovers.some((leftover) => leftover.sourceMealId === sourceMeal.id)).toBe(false)
    expect(removed.foodLog.some((entry) => entry.sourceSnapshot.sourceId === 'meal:meal-batch-1')).toBe(false)
  })

  it('does not create a second leftover record when a leftover meal is planned', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    const sourceMeal = data.meals[0]!
    const withLeftover = upsertMealWithLeftover(data, sourceMeal, '2026-09-22T12:00:00.000Z')
    const leftover = withLeftover.leftovers.find((item) => item.sourceMealId === sourceMeal.id)!
    const leftoverMeal = {
      ...sourceMeal,
      id: 'meal-leftover-day',
      date: '2026-09-24',
      leftoverId: leftover.id,
      recipeId: undefined,
      preparedServings: 1,
      consumedServings: 0,
      sourceSnapshot: { ...leftover.sourceSnapshot, sourceType: 'leftover' as const, sourceId: leftover.id },
    }
    const updated = upsertMealWithLeftover(withLeftover, leftoverMeal, '2026-09-22T12:00:00.000Z')

    expect(updated.leftovers).toHaveLength(withLeftover.leftovers.length)
    expect(updated.leftovers.some((item) => item.sourceMealId === leftoverMeal.id)).toBe(false)
  })

  it('keeps direct logs and manually planned leftovers in the same automatically scheduled batch balance', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    const sourceMeal = {
      ...data.meals[0]!,
      id: 'meal-batch',
      date: '2026-09-22',
      slot: 'dinner' as const,
      servings: 1,
      preparedServings: 4,
      consumedServings: 0,
    }
    data.meals = []
    data.leftovers = []
    data.foodLog = []
    const planned = upsertMealWithLeftover(data, sourceMeal, '2026-09-22T12:00:00.000Z', {
      autoPlanExtraServings: true,
      createMealId: (sequence) => `meal-batch-${sequence + 1}`,
    })
    const leftover = planned.leftovers[0]!
    const afterDirectLog = consumeLeftover(planned, leftover.id, 1, '2026-09-22T18:00:00.000Z', '2026-09-22')
    const afterAutomaticDay = logMealConsumption(afterDirectLog, 'meal-batch-1', 1, '2026-09-23T18:00:00.000Z')
    const manualMeal = {
      ...planned.meals.find((meal) => meal.id === 'meal-batch-2')!,
      id: 'meal-manual-leftover',
      date: '2026-09-30',
      autoPlannedFromMealId: undefined,
    }
    const withManualDay = upsertMealWithLeftover(afterAutomaticDay, manualMeal, '2026-09-24T12:00:00.000Z')
    const afterManualDay = logMealConsumption(withManualDay, manualMeal.id, 1, '2026-09-30T18:00:00.000Z')

    expect(afterDirectLog.leftovers[0]?.servingsRemaining).toBe(3)
    expect(afterAutomaticDay.leftovers[0]?.servingsRemaining).toBe(2)
    expect(afterManualDay.leftovers[0]?.servingsRemaining).toBe(1)
  })

  it('repairs a stale 10-serving record to 8 after a manually added day records two servings', () => {
    const data = createTestFixtureData(new Date(2026, 8, 24))
    const sourceMeal = {
      ...data.meals[0]!,
      id: 'meal-source',
      date: '2026-09-21',
      slot: 'breakfast' as const,
      servings: 12,
      preparedServings: 12,
      consumedServings: 2,
    }
    const leftover = {
      id: 'leftover-source',
      createdAt: data.initializedAt,
      updatedAt: data.initializedAt,
      source: 'generated' as const,
      sourceMealId: sourceMeal.id,
      sourceSnapshot: sourceMeal.sourceSnapshot,
      preparedOn: sourceMeal.date,
      servingsRemaining: 10,
      storageLocation: 'Refrigerator' as const,
    }
    const manualDay = {
      ...sourceMeal,
      id: 'meal-manual-day',
      date: '2026-09-22',
      recipeId: undefined,
      leftoverId: leftover.id,
      servings: 2,
      preparedServings: 10,
      consumedServings: 2,
      sourceSnapshot: { ...leftover.sourceSnapshot, sourceType: 'leftover' as const, sourceId: leftover.id },
    }
    const stale = { ...data, meals: [sourceMeal, manualDay], leftovers: [leftover], foodLog: [] }
    const repaired = reconcileMealBatchBalances(stale, '2026-09-24T12:00:00.000Z')

    expect(repaired.leftovers[0]?.servingsRemaining).toBe(8)
    expect(remainingBatchServingsForMeal(repaired, sourceMeal)).toBe(8)
    expect(remainingBatchServingsForMeal(repaired, manualDay)).toBe(8)
  })

  it('repairs a carried-forward recipe meal that was saved as a second batch source', () => {
    const data = createTestFixtureData(new Date(2026, 8, 24))
    const firstDay = {
      ...data.meals[0]!,
      id: 'meal-first-day',
      date: '2026-09-21',
      slot: 'breakfast' as const,
      servings: 12,
      preparedServings: 12,
      consumedServings: 2,
    }
    const secondDay = {
      ...firstDay,
      id: 'meal-second-day',
      date: '2026-09-22',
      servings: 2,
      preparedServings: 10,
      consumedServings: 2,
    }
    const staleLeftover = {
      id: 'leftover-second-day',
      createdAt: data.initializedAt,
      updatedAt: data.initializedAt,
      source: 'generated' as const,
      sourceMealId: secondDay.id,
      sourceSnapshot: secondDay.sourceSnapshot,
      preparedOn: secondDay.date,
      servingsRemaining: 10,
      storageLocation: 'Refrigerator' as const,
    }
    const selfLinkedSecondDay = {
      ...secondDay,
      recipeId: undefined,
      leftoverId: staleLeftover.id,
      sourceSnapshot: {
        ...staleLeftover.sourceSnapshot,
        sourceType: 'leftover' as const,
        sourceId: staleLeftover.id,
      },
    }
    const repaired = reconcileMealBatchBalances(
      { ...data, meals: [firstDay, selfLinkedSecondDay], leftovers: [staleLeftover], foodLog: [] },
      '2026-09-24T12:00:00.000Z',
    )
    const repairedSecondDay = repaired.meals.find((meal) => meal.id === secondDay.id)!

    expect(repairedSecondDay.leftoverId).toBe(staleLeftover.id)
    expect(repairedSecondDay.recipeId).toBeUndefined()
    expect(repaired.leftovers[0]).toEqual(
      expect.objectContaining({ sourceMealId: firstDay.id, preparedOn: firstDay.date, servingsRemaining: 8 }),
    )
    expect(remainingBatchServingsForMeal(repaired, firstDay)).toBe(8)
    expect(remainingBatchServingsForMeal(repaired, repairedSecondDay)).toBe(8)
  })

  it('uses an available earlier same-recipe batch when another day is added as a recipe', () => {
    const data = createTestFixtureData(new Date(2026, 8, 24))
    const firstDay = {
      ...data.meals[0]!,
      id: 'meal-first-day',
      date: '2026-09-21',
      slot: 'breakfast' as const,
      servings: 2,
      preparedServings: 10,
      consumedServings: 2,
    }
    data.meals = []
    data.leftovers = []
    const withBatch = upsertMealWithLeftover(data, firstDay, '2026-09-21T12:00:00.000Z')
    const nextDayRecipe = {
      ...firstDay,
      id: 'meal-next-day',
      date: '2026-09-22',
      preparedServings: 2,
      consumedServings: 0,
    }
    const continued = upsertMealWithLeftover(withBatch, nextDayRecipe, '2026-09-22T12:00:00.000Z')
    const nextDay = continued.meals.find((meal) => meal.id === nextDayRecipe.id)!

    expect(nextDay.leftoverId).toBe(continued.leftovers[0]?.id)
    expect(nextDay.recipeId).toBeUndefined()
    expect(remainingBatchServingsForMeal(continued, nextDay)).toBe(8)
  })
})
