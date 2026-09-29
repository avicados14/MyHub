import { describe, expect, it } from 'vitest'
import legacy from '../../contracts/v1/fixtures/legacy-backup.json'
import migrated from '../../contracts/v1/fixtures/migrated-backup.json'
import current from '../../contracts/v2/fixtures/backup.json'
import { createBackup, parseBackup } from '../storage/database'

describe('synthetic legacy migration bridge', () => {
  it('matches the complete reviewed v2 migration fixture used by native import tests', () => {
    expect(parseBackup(JSON.stringify(legacy))).toEqual(migrated)
  })
  it('removes only marked demo records and their linked generated records', () => {
    const data = parseBackup(JSON.stringify(legacy)).data
    expect(data.recipes.map((item) => item.id)).toEqual(current.data.recipes.map((item) => item.id))
    expect(data.assignments).toEqual(current.data.assignments)
    expect(data.events).toEqual(current.data.events)
    expect(data.meals.map((item) => item.id)).toEqual(current.data.meals.map((item) => item.id))
    expect(data.groceryHistory).toEqual(current.data.groceryHistory)
  })
  it('preserves dates and consumption while supplying explicit unknown provenance', () => {
    const data = parseBackup(JSON.stringify(legacy)).data
    expect(data.initializedAt).toBe(current.data.initializedAt)
    expect(data.settings.calendarTimeZone).toBe(current.data.settings.calendarTimeZone)
    expect(data.settings.groceryStaples[0]?.name).toBe('Synthetic oats')
    expect(data.recipes[0]?.nutritionPerServing.sugar).toBe(0)
    expect(data.recipes[0]?.nutritionPerServing.saturatedFat).toBe(0)
    expect(
      data.meals.map(({ date, preparedServings, consumedServings }) => ({ date, preparedServings, consumedServings })),
    ).toEqual(
      current.data.meals.map(({ date, preparedServings, consumedServings }) => ({
        date,
        preparedServings,
        consumedServings,
      })),
    )
    expect(data.foodLog[0]?.nutritionSnapshot).toEqual(current.data.foodLog[0]?.nutritionSnapshot)
    expect(data.recipes[0]?.nutritionProvenance.kind).toBe('unknown')
    expect(parseBackup(JSON.stringify(createBackup(data))).data).toEqual(data)
  })
})
