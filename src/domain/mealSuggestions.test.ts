import { describe, expect, it } from 'vitest'
import { createTestFixtureData } from '../test/fixtures'
import { createMealSuggestions } from './mealSuggestions'

describe('smart meal suggestions', () => {
  it('is deterministic for the same saved data and target slots', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    const targets = [
      { date: '2026-09-28', slot: 'dinner' as const },
      { date: '2026-09-29', slot: 'lunch' as const },
    ]
    expect(createMealSuggestions(data, targets)).toEqual(createMealSuggestions(data, targets))
  })

  it('falls back to review-marked recipes when the whole imported cookbook needs review', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    data.meals = []
    data.recipes = data.recipes.map((recipe) => ({ ...recipe, needsReview: true }))

    const suggestion = createMealSuggestions(data, [{ date: '2026-09-28', slot: 'dinner' }])[0]

    expect(suggestion).toBeDefined()
    expect(suggestion?.reasons).toContain('Recipe details are marked for review')
  })

  it('moves most target calories and protein to dinner and snack when late-day timing is enabled', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    data.meals = []
    data.foodLog = []
    data.settings.mealPlanning.favorAvailablePantry = false
    data.settings.mealPlanning.lateDayNutritionBias = true
    const light = { ...structuredClone(data.recipes[0]!), id: 'recipe-light', category: 'Any' }
    light.nutritionPerServing = { ...light.nutritionPerServing, calories: 150, protein: 9 }
    const substantial = { ...structuredClone(data.recipes[1]!), id: 'recipe-substantial', category: 'Any' }
    substantial.nutritionPerServing = { ...substantial.nutritionPerServing, calories: 900, protein: 55 }
    data.recipes = [light, substantial]

    expect(createMealSuggestions(data, [{ date: '2026-09-28', slot: 'breakfast' }])[0]?.sourceId).toBe('recipe-light')
    expect(createMealSuggestions(data, [{ date: '2026-09-28', slot: 'dinner' }])[0]?.sourceId).toBe(
      'recipe-substantial',
    )
  })

  it('prefers available leftovers in favor-leftovers mode', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    data.settings.mealPlanning.mode = 'favor-leftovers'
    data.leftovers = [
      {
        id: 'leftover-1',
        createdAt: data.initializedAt,
        updatedAt: data.initializedAt,
        source: 'generated',
        sourceMealId: 'meal-week',
        sourceSnapshot: data.meals[0]!.sourceSnapshot,
        preparedOn: '2026-09-22',
        servingsRemaining: 2,
        storageLocation: 'Refrigerator',
      },
    ]
    const suggestion = createMealSuggestions(data, [{ date: '2026-09-28', slot: 'dinner' }])[0]
    expect(suggestion).toEqual(expect.objectContaining({ sourceType: 'leftover', sourceId: 'leftover-1' }))
  })

  it('explains slot, remaining nutrition, busy schedule, favorites, prep time, and enabled pantry scoring', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    data.meals = []
    data.foodLog = [
      {
        ...data.foodLog[0]!,
        date: '2026-09-28',
        nutritionSnapshot: { calories: 1400, protein: 70, carbs: 150, fat: 45, fiber: 16, sodium: 1000 },
      },
    ]
    data.events = [{ ...data.events[0]!, date: '2026-09-28', startTime: '08:00', endTime: '12:00' }]
    data.pantry = [
      { ...data.pantry[0]!, name: 'Steak', canonicalName: 'steak' },
      { ...data.pantry[0]!, id: 'pantry-jasmine', name: 'Jasmine rice', canonicalName: 'jasmine rice' },
    ]

    const suggestion = createMealSuggestions(data, [{ date: '2026-09-28', slot: 'dinner' }])[0]!
    expect(suggestion.name).toBe('Teriyaki Steak Bowls')
    expect(suggestion.reasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/fit remaining targets/),
        'Matches dinner',
        'Saved as a favorite',
        '100% of ingredients tracked in pantry',
        '45 min on a busy calendar day',
      ]),
    )

    data.settings.mealPlanning.favorAvailablePantry = false
    const withoutPantry = createMealSuggestions(data, [{ date: '2026-09-28', slot: 'dinner' }])[0]!
    expect(withoutPantry.reasons.some((reason) => reason.includes('tracked in pantry'))).toBe(false)
  })

  it('minimizes unique ingredients by reusing overlap across suggested slots', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    data.meals = []
    data.foodLog = []
    data.settings.mealPlanning.mode = 'minimize-unique-ingredients'
    data.settings.mealPlanning.favorAvailablePantry = false
    const first = data.recipes[0]!
    const overlap = structuredClone(data.recipes[1]!)
    overlap.id = 'recipe-overlap'
    overlap.name = 'Steak rice lunch'
    overlap.category = 'Lunch'
    overlap.favorite = false
    overlap.ingredients = [first.ingredients[0]!, first.ingredients[1]!]
    data.recipes = [first, overlap]

    const suggestions = createMealSuggestions(data, [
      { date: '2026-09-28', slot: 'dinner' },
      { date: '2026-09-28', slot: 'lunch' },
    ])
    expect(suggestions[1]?.sourceId).toBe('recipe-overlap')
    expect(suggestions[1]?.reasons).toContain('Reuses 2 ingredients across suggested slots')
  })

  it('changes an unlocked slot with its generation offset while locked keys are omitted', () => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    data.meals = []
    const target = { date: '2026-09-28', slot: 'dinner' as const }
    const initial = createMealSuggestions(data, [target])[0]
    const replaced = createMealSuggestions(data, [target], new Set(), 0, new Map([['2026-09-28:dinner', 1]]))[0]
    expect(replaced?.sourceId).not.toBe(initial?.sourceId)
    expect(createMealSuggestions(data, [target], new Set(['2026-09-28:dinner']))).toEqual([])
  })
})
