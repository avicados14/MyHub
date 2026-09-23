import { describe, expect, it } from 'vitest'
import { createTestFixtureData } from '../test/fixtures'
import { createMealSuggestions } from './mealSuggestions'

describe('smart meal suggestions', () => {
  it('is deterministic for the same saved data and target slots', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    const targets = [{ date: '2026-09-28', slot: 'dinner' as const }, { date: '2026-09-29', slot: 'lunch' as const }]
    expect(createMealSuggestions(data, targets)).toEqual(createMealSuggestions(data, targets))
  })

  it('prefers available leftovers in favor-leftovers mode', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    data.settings.mealPlanning.mode = 'favor-leftovers'
    data.leftovers = [{ id: 'leftover-1', createdAt: data.initializedAt, updatedAt: data.initializedAt, source: 'generated', sourceMealId: 'meal-week', sourceSnapshot: data.meals[0]!.sourceSnapshot, preparedOn: '2026-09-22', servingsRemaining: 2, storageLocation: 'Refrigerator' }]
    const suggestion = createMealSuggestions(data, [{ date: '2026-09-28', slot: 'dinner' }])[0]
    expect(suggestion).toEqual(expect.objectContaining({ sourceType: 'leftover', sourceId: 'leftover-1' }))
  })
})
