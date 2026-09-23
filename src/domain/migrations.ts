import { createDefaultGroceryCategories, createEmptyData, createUnknownNutritionProvenance } from './defaults'
import type {
  AppData,
  CalendarFeed,
  FoodLogEntry,
  GroceryStaple,
  MealEntry,
  MealSourceSnapshot,
  Nutrition,
  NutritionProvenance,
  Recipe,
} from './types'

export const CURRENT_SCHEMA_VERSION = 2 as const

const ZERO_NUTRITION: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null
const isString = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const recordArray = (value: unknown): UnknownRecord[] => Array.isArray(value) ? value.filter(isRecord) : []

const asNutrition = (value: unknown): Nutrition => {
  if (!isRecord(value)) return { ...ZERO_NUTRITION }
  return {
    calories: isNumber(value.calories) ? value.calories : 0,
    protein: isNumber(value.protein) ? value.protein : 0,
    carbs: isNumber(value.carbs) ? value.carbs : 0,
    fat: isNumber(value.fat) ? value.fat : 0,
    fiber: isNumber(value.fiber) ? value.fiber : 0,
    sodium: isNumber(value.sodium) ? value.sodium : 0,
  }
}

const provenanceFor = (source: UnknownRecord, capturedAt: string, fallbackLabel: string): NutritionProvenance => {
  const current = source.nutritionProvenance ?? source.provenanceSnapshot
  if (isRecord(current) && isString(current.kind) && isString(current.capturedAt)) {
    return current as unknown as NutritionProvenance
  }
  return createUnknownNutritionProvenance(capturedAt, fallbackLabel)
}

const snapshotForRecipe = (recipe: UnknownRecord, capturedAt: string): MealSourceSnapshot => ({
  sourceType: 'recipe',
  sourceId: isString(recipe.id) ? recipe.id : undefined,
  name: isString(recipe.name) ? recipe.name : 'Recipe',
  image: isString(recipe.image) ? recipe.image : undefined,
  nutritionPerServing: asNutrition(recipe.nutritionPerServing),
  nutritionProvenance: provenanceFor(recipe, capturedAt, isString(recipe.sourceLabel) ? recipe.sourceLabel : 'Migrated recipe'),
  capturedAt,
})

const snapshotForLog = (entry: UnknownRecord, capturedAt: string): MealSourceSnapshot => ({
  sourceType: entry.origin === 'packaged' || entry.origin === 'leftover' || entry.origin === 'custom' ? entry.origin : 'recipe',
  name: isString(entry.name) ? entry.name : 'Food log item',
  nutritionPerServing: asNutrition(entry.nutritionSnapshot),
  nutritionProvenance: provenanceFor(entry, capturedAt, 'Migrated food log'),
  capturedAt,
})

const migrateRecipe = (recipe: UnknownRecord): Recipe => {
  const capturedAt = isString(recipe.updatedAt) ? recipe.updatedAt : new Date().toISOString()
  return {
    ...(recipe as unknown as Omit<Recipe, 'nutritionProvenance'>),
    nutritionPerServing: asNutrition(recipe.nutritionPerServing),
    nutritionProvenance: provenanceFor(recipe, capturedAt, isString(recipe.sourceLabel) ? recipe.sourceLabel : 'Migrated recipe'),
  }
}

const migrateMeal = (meal: UnknownRecord, recipes: Map<string, UnknownRecord>): MealEntry => {
  const capturedAt = isString(meal.updatedAt) ? meal.updatedAt : new Date().toISOString()
  const recipe = isString(meal.recipeId) ? recipes.get(meal.recipeId) : undefined
  const sourceSnapshot = isRecord(meal.sourceSnapshot)
    ? meal.sourceSnapshot as unknown as MealSourceSnapshot
    : recipe
      ? snapshotForRecipe(recipe, capturedAt)
      : {
          sourceType: 'custom' as const,
          name: isString(meal.customName) ? meal.customName : 'Custom meal',
          nutritionPerServing: { ...ZERO_NUTRITION },
          nutritionProvenance: createUnknownNutritionProvenance(capturedAt, 'Migrated meal'),
          capturedAt,
        }
  return { ...(meal as unknown as Omit<MealEntry, 'sourceSnapshot'>), sourceSnapshot }
}

const migrateFoodLog = (entry: UnknownRecord): FoodLogEntry => {
  const capturedAt = isString(entry.updatedAt) ? entry.updatedAt : new Date().toISOString()
  const sourceSnapshot = isRecord(entry.sourceSnapshot)
    ? entry.sourceSnapshot as unknown as MealSourceSnapshot
    : snapshotForLog(entry, capturedAt)
  const provenanceSnapshot = isRecord(entry.provenanceSnapshot)
    ? entry.provenanceSnapshot as unknown as NutritionProvenance
    : sourceSnapshot.nutritionProvenance
  return {
    ...(entry as unknown as Omit<FoodLogEntry, 'sourceSnapshot' | 'provenanceSnapshot'>),
    nutritionSnapshot: asNutrition(entry.nutritionSnapshot),
    provenanceSnapshot,
    sourceSnapshot,
  }
}

const migrateStaples = (value: unknown): GroceryStaple[] => {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (typeof item === 'string') {
      return [{
        id: `staple-migrated-${index}`,
        name: item,
        canonicalName: item.toLowerCase(),
        quantity: 1,
        unit: 'each',
        category: 'Other' as const,
        enabled: true,
      }]
    }
    return isRecord(item) ? [item as unknown as GroceryStaple] : []
  })
}

const migrateCalendarFeeds = (settings: UnknownRecord): CalendarFeed[] => {
  if (Array.isArray(settings.calendarFeeds)) return settings.calendarFeeds.filter(isRecord) as unknown as CalendarFeed[]
  if (!isRecord(settings.canvas)) return []
  const canvas = settings.canvas
  const feedUrl = isString(canvas.feedUrl) ? canvas.feedUrl : ''
  if (!feedUrl && canvas.status === 'not-configured') return []
  return [{
    id: 'calendar-feed-canvas-migrated',
    name: 'Canvas',
    kind: 'canvas',
    url: feedUrl,
    enabled: true,
    status: canvas.status === 'connected' || canvas.status === 'error' ? canvas.status : 'not-configured',
    ...(isString(canvas.lastRefresh) ? { lastRefresh: canvas.lastRefresh } : {}),
  }]
}

export const migrateV1ToV2 = (value: UnknownRecord): AppData => {
  const settings = isRecord(value.settings) ? value.settings : {}
  const recipes = recordArray(value.recipes)
  const recipeMap = new Map(recipes.flatMap((recipe) => isString(recipe.id) ? [[recipe.id, recipe] as const] : []))
  const defaults = createEmptyData(new Date(isString(value.seededAt) ? value.seededAt : Date.now()))
  const study = isRecord(settings.study) ? settings.study : {}

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    initializedAt: isString(value.initializedAt) ? value.initializedAt : isString(value.seededAt) ? value.seededAt : defaults.initializedAt,
    events: recordArray(value.events) as unknown as AppData['events'],
    assignments: recordArray(value.assignments) as unknown as AppData['assignments'],
    recipes: recipes.map(migrateRecipe),
    packagedFoods: recordArray(value.packagedFoods) as unknown as AppData['packagedFoods'],
    meals: recordArray(value.meals).map((meal) => migrateMeal(meal, recipeMap)),
    leftovers: recordArray(value.leftovers) as unknown as AppData['leftovers'],
    foodLog: recordArray(value.foodLog).map(migrateFoodLog),
    pantry: recordArray(value.pantry) as unknown as AppData['pantry'],
    activeGroceryList: isRecord(value.activeGroceryList) ? value.activeGroceryList as unknown as AppData['activeGroceryList'] : null,
    groceryHistory: recordArray(value.groceryHistory) as unknown as AppData['groceryHistory'],
    settings: {
      name: isString(settings.name) ? settings.name : defaults.settings.name,
      measurementSystem: settings.measurementSystem === 'metric' ? 'metric' : 'us',
      appearance: settings.appearance === 'light' || settings.appearance === 'dark' ? settings.appearance : 'system',
      nutritionTargets: asNutrition(settings.nutritionTargets),
      study: {
        earliestTime: isString(study.earliestTime) ? study.earliestTime : defaults.settings.study.earliestTime,
        latestTime: isString(study.latestTime) ? study.latestTime : defaults.settings.study.latestTime,
        defaultBlockMinutes: isNumber(study.defaultBlockMinutes) ? study.defaultBlockMinutes : defaults.settings.study.defaultBlockMinutes,
        breakMinutes: isNumber(study.breakMinutes) ? study.breakMinutes : defaults.settings.study.breakMinutes,
        maxBlockMinutes: isNumber(study.maxBlockMinutes) ? study.maxBlockMinutes : defaults.settings.study.maxBlockMinutes,
        avoidTimes: recordArray(study.avoidTimes) as unknown as AppData['settings']['study']['avoidTimes'],
      },
      mealPlanning: isRecord(settings.mealPlanning)
        ? settings.mealPlanning as unknown as AppData['settings']['mealPlanning']
        : defaults.settings.mealPlanning,
      groceryCategories: Array.isArray(settings.groceryCategories)
        ? settings.groceryCategories.filter(isRecord) as unknown as AppData['settings']['groceryCategories']
        : createDefaultGroceryCategories(),
      groceryStaples: migrateStaples(settings.groceryStaples),
      calendarFeeds: migrateCalendarFeeds(settings),
    },
  }
}

export const migrateAppData = (value: unknown): AppData => {
  if (!isRecord(value)) throw new Error('MyHub data must be a JSON object.')
  if (value.schemaVersion === 1) return migrateV1ToV2(value)
  if (value.schemaVersion === CURRENT_SCHEMA_VERSION) return value as unknown as AppData
  throw new Error(`Unsupported MyHub schema version: ${String(value.schemaVersion)}.`)
}

export const isCurrentAppData = (value: unknown): value is AppData => {
  if (!isRecord(value) || value.schemaVersion !== CURRENT_SCHEMA_VERSION || !isRecord(value.settings)) return false
  const arrays = ['events', 'assignments', 'recipes', 'packagedFoods', 'meals', 'leftovers', 'foodLog', 'pantry', 'groceryHistory']
  return arrays.every((key) => Array.isArray(value[key]))
    && typeof value.initializedAt === 'string'
    && (value.activeGroceryList === null || isRecord(value.activeGroceryList))
}
