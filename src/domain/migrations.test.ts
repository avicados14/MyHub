import { describe, expect, it } from 'vitest'
import { createEmptyData } from './defaults'
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

  it('removes legacy sample data and linked generated records without touching personal imports', () => {
    const current = createEmptyData(new Date('2026-09-23T00:00:00.000Z'))
    const cleaned = migrateAppData({
      ...current,
      assignments: [
        { id: 'assignment-lab', source: 'demo', sourceLabel: 'Sample data', title: 'CEEN 482 Lab Report' },
        { id: 'assignment-personal', source: 'manual', sourceLabel: 'My class', title: 'Keep this assignment' },
      ],
      events: [
        { id: 'event-fluid', source: 'demo', sourceLabel: 'Sample schedule', title: 'Fluid Mechanics' },
        {
          id: 'event-generated-demo',
          source: 'generated',
          assignmentId: 'assignment-lab',
          title: 'CEEN 482 Lab Report',
        },
        { id: 'event-imported', source: 'imported', sourceLabel: 'Google Calendar', title: 'Keep this event' },
      ],
      recipes: [
        { id: 'recipe-teriyaki', source: 'demo', sourceLabel: 'MyHub demo recipe', name: 'Teriyaki Steak Bowls' },
        {
          id: 'recipe-cookbook',
          source: 'imported',
          sourceLabel: "Avi's Personal Cookbook (uploaded PDF)",
          name: 'Keep this recipe',
        },
      ],
      meals: [
        { id: 'meal-from-demo', source: 'generated', recipeId: 'recipe-teriyaki' },
        { id: 'meal-personal', source: 'manual', recipeId: 'recipe-cookbook' },
      ],
      activeGroceryList: {
        id: 'grocery-personal',
        source: 'generated',
        items: [
          { id: 'item-demo', source: 'generated', sourceRecipeIds: ['recipe-teriyaki'] },
          { id: 'item-personal', source: 'manual', sourceRecipeIds: [] },
        ],
      },
      settings: {
        ...current.settings,
        groceryStaples: [
          { id: 'staple-migrated-0', name: 'Milk', enabled: true },
          { id: 'staple-personal', name: 'Rice', enabled: true },
        ],
      },
    })

    expect(cleaned.assignments.map((record) => record.id)).toEqual(['assignment-personal'])
    expect(cleaned.events.map((record) => record.id)).toEqual(['event-imported'])
    expect(cleaned.recipes.map((record) => record.id)).toEqual(['recipe-cookbook'])
    expect(cleaned.meals.map((record) => record.id)).toEqual(['meal-personal'])
    expect(cleaned.activeGroceryList?.items.map((record) => record.id)).toEqual(['item-personal'])
    expect(cleaned.settings.groceryStaples.map((record) => record.name)).toEqual(['Rice'])
  })
})
