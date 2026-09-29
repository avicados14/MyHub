import { describe, expect, it } from 'vitest'
import fixture from '../../contracts/v2/fixtures/backup.json'
import golden from '../../contracts/v2/fixtures/expected.json'
import { createBackup, parseBackup } from '../storage/database'
import { scaledIngredients, formatQuantity } from './recipe'
import { aggregateGroceryItems, copyHistoryEntryToList } from './grocery'
import { nutritionForDate } from './selectors'
import { reconcileMealBatchBalances, remainingBatchServingsForMeal } from './mealWorkflow'
import { generateStudyPlan, rankAssignments } from './study'
import { dateFromLocal } from '../utilities/date'

const load = () => parseBackup(JSON.stringify(fixture)).data

describe('portable contract v2 golden fixtures (synthetic only)', () => {
  it('round trips every record, local date, provenance and historical snapshot', () => {
    const data = load()
    expect(parseBackup(JSON.stringify(createBackup(data))).data).toEqual(fixture.data)
  })
  it('scales from original yield, preserves unknown quantities and formats fractions', () => {
    const scaled = scaledIngredients(load().recipes[0]!, golden.scaling.servings)
    expect(scaled.map((item) => item.quantity)).toEqual(golden.scaling.quantities)
    expect(scaled.slice(0, 2).map((item) => formatQuantity(item.quantity!))).toEqual(golden.scaling.formatted)
  })
  it('aggregates compatible mass units without guessing an unknown quantity', () => {
    const data = load()
    const meals = [{ ...data.meals[0]!, servings: 4, preparedServings: 4 }]
    expect(
      aggregateGroceryItems(meals, data.recipes, [], fixture.exportedAt).map(({ canonicalName, quantity, unit }) => ({
        canonicalName,
        quantity,
        unit,
      })),
    ).toEqual(golden.grocery)
  })
  it('totals all eight nutrition fields from immutable logs only', () => {
    const data = load()
    data.recipes[0]!.nutritionPerServing.calories = 9999
    data.meals[0]!.servings = 99
    expect(nutritionForDate(data, '2026-01-05')).toEqual(golden.nutrition)
  })
  it('shares one balance across prepared and consumed days', () => {
    const data = reconcileMealBatchBalances(load(), fixture.exportedAt)
    for (const meal of data.meals) expect(remainingBatchServingsForMeal(data, meal)).toBe(golden.batchRemaining)
    expect(data.leftovers[0]!.servingsRemaining).toBe(golden.batchRemaining)
  })
  it('ranks homework and schedules around occupied time with deterministic breaks', () => {
    const data = load()
    expect(rankAssignments(data.assignments).map((item) => item.id)).toEqual(golden.assignmentOrder)
    const result = generateStudyPlan(data.assignments, data.events, data.settings.study, dateFromLocal('2026-01-05'))
    expect(
      result.blocks.map(({ assignmentId, date, startTime, endTime }) => ({ assignmentId, date, startTime, endTime })),
    ).toEqual(golden.study.blocks)
    expect(result.unscheduledMinutes).toBe(golden.study.unscheduledMinutes)
  })
  it('copies completed trips without aliasing immutable history', () => {
    const history = load().groceryHistory[0]!
    const copy = copyHistoryEntryToList(history, fixture.exportedAt)
    copy.items[0]!.quantity = 999
    copy.sourceMealIds!.push('synthetic-other')
    expect(history).toEqual(golden.history)
  })
})
