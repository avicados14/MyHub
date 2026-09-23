import type { AppData, GroceryCategory, GroceryCategorySetting, Nutrition, NutritionProvenance } from './types'

export const DEFAULT_NUTRITION_TARGETS: Nutrition = {
  calories: 2000,
  protein: 100,
  carbs: 250,
  fat: 70,
  sugar: 50,
  saturatedFat: 20,
  fiber: 28,
  sodium: 2300,
}

const CATEGORY_NAMES: GroceryCategory[] = [
  'Produce',
  'Meat & Seafood',
  'Dairy',
  'Bakery',
  'Frozen',
  'Pantry',
  'Snacks',
  'Household',
  'Other',
]

export const createDefaultGroceryCategories = (): GroceryCategorySetting[] =>
  CATEGORY_NAMES.map((name, sortOrder) => ({
    id: `category-${name.toLowerCase().replaceAll(/[^a-z]+/g, '-')}`,
    name,
    sortOrder,
    enabled: true,
  }))

export const createUnknownNutritionProvenance = (
  capturedAt = new Date().toISOString(),
  sourceLabel?: string,
): NutritionProvenance => ({
  kind: 'unknown',
  capturedAt,
  estimated: false,
  ...(sourceLabel ? { sourceLabel } : {}),
})

export const createEmptyData = (now = new Date()): AppData => ({
  schemaVersion: 2,
  initializedAt: now.toISOString(),
  events: [],
  assignments: [],
  recipes: [],
  packagedFoods: [],
  meals: [],
  leftovers: [],
  foodLog: [],
  pantry: [],
  activeGroceryList: null,
  groceryHistory: [],
  settings: {
    name: '',
    measurementSystem: 'us',
    appearance: 'system',
    calendarTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    nutritionTargets: { ...DEFAULT_NUTRITION_TARGETS },
    study: {
      earliestTime: '08:00',
      latestTime: '21:00',
      defaultBlockMinutes: 45,
      breakMinutes: 15,
      maxBlockMinutes: 60,
      avoidTimes: [],
    },
    mealPlanning: {
      mode: 'balanced',
      preferredSlots: ['breakfast', 'lunch', 'dinner'],
      targetPrepServings: 4,
      favorAvailablePantry: true,
      lateDayNutritionBias: false,
    },
    groceryCategories: createDefaultGroceryCategories(),
    groceryStaples: [],
    calendarFeeds: [],
  },
})

export const isAppDataEmpty = (data: AppData): boolean =>
  data.events.length === 0 &&
  data.assignments.length === 0 &&
  data.recipes.length === 0 &&
  data.packagedFoods.length === 0 &&
  data.meals.length === 0 &&
  data.leftovers.length === 0 &&
  data.foodLog.length === 0 &&
  data.pantry.length === 0 &&
  data.activeGroceryList === null &&
  data.groceryHistory.length === 0
