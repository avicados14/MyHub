import { describe, expect, it } from 'vitest'
import { migrateAppData } from './migrations'

const base = {
  id: 'record-1',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
  source: 'manual',
}
const nutrition = { calories: 400, protein: 20, carbs: 50, fat: 10, fiber: 8, sodium: 500 }

const v1Data = {
  schemaVersion: 1,
  seededAt: '2025-01-01T00:00:00.000Z',
  events: [{ ...base, title: 'Keep me', date: '2025-01-01', startTime: '09:00', endTime: '10:00', kind: 'event' }],
  assignments: [],
  recipes: [
    {
      ...base,
      id: 'recipe-1',
      name: 'Legacy recipe',
      description: '',
      image: '',
      category: 'Dinner',
      tags: [],
      favorite: false,
      originalYield: 2,
      prepMinutes: 10,
      cookMinutes: 20,
      ingredients: [],
      steps: [],
      nutritionPerServing: nutrition,
      sourceLabel: 'Manual recipe',
    },
  ],
  meals: [
    {
      ...base,
      id: 'meal-1',
      date: '2025-01-01',
      slot: 'dinner',
      recipeId: 'recipe-1',
      servings: 1,
      preparedServings: 2,
      consumedServings: 1,
    },
  ],
  foodLog: [
    {
      ...base,
      id: 'log-1',
      date: '2025-01-01',
      name: 'Legacy recipe',
      servings: 1,
      nutritionSnapshot: nutrition,
      origin: 'recipe',
    },
  ],
  pantry: [],
  activeGroceryList: null,
  groceryHistory: [],
  settings: {
    name: 'Legacy User',
    measurementSystem: 'metric',
    appearance: 'dark',
    nutritionTargets: nutrition,
    study: {
      earliestTime: '10:00',
      latestTime: '22:00',
      defaultBlockMinutes: 30,
      breakMinutes: 5,
      maxBlockMinutes: 90,
    },
    groceryStaples: ['Milk', 'Coffee'],
    canvas: {
      feedUrl: 'https://canvas.example/feed.ics',
      status: 'connected',
      lastRefresh: '2025-01-03T00:00:00.000Z',
    },
  },
}

describe('AppData migration', () => {
  it('migrates v1 data without dropping legacy records', () => {
    const migrated = migrateAppData(v1Data)
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.events[0]?.title).toBe('Keep me')
    expect(migrated.recipes[0]?.nutritionProvenance.sourceLabel).toBe('Manual recipe')
    expect(migrated.meals[0]?.sourceSnapshot).toEqual(
      expect.objectContaining({ sourceId: 'recipe-1', name: 'Legacy recipe', nutritionPerServing: nutrition }),
    )
    expect(migrated.foodLog[0]?.provenanceSnapshot).toBeDefined()
    expect(migrated.settings.groceryStaples.map((item) => item.name)).toEqual(['Milk', 'Coffee'])
    expect(migrated.settings.calendarFeeds[0]).toEqual(
      expect.objectContaining({ kind: 'canvas', url: 'https://canvas.example/feed.ics' }),
    )
    expect(migrated.packagedFoods).toEqual([])
    expect(migrated.leftovers).toEqual([])
    expect(migrated.settings.study.avoidTimes).toEqual([])
  })
})
