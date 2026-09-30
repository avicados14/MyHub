import { expect, it } from 'vitest'
import fixture from '../../contracts/v2/fixtures/backup.json'
import { parseBackup } from '../storage/database'
import { logMealConsumption, remainingServingsForLeftover } from './mealWorkflow'

it('keeps a custom shared batch identity through depletion and correction', () => {
  const data = parseBackup(JSON.stringify(fixture)).data
  const source = data.meals[0]!
  const timestamp = '2026-01-06T12:00:00.000Z'
  const depleted = logMealConsumption(data, source.id, 10, timestamp)
  const corrected = logMealConsumption(depleted, source.id, 0, timestamp)
  const batch = corrected.leftovers.find((item) => item.sourceMealId === source.id)!
  expect(batch.id).toBe(data.leftovers[0]!.id)
  expect(remainingServingsForLeftover(corrected, batch)).toBe(10)
  expect(corrected.groceryHistory).toEqual(data.groceryHistory)
})
