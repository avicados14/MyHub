export type EntitySource = 'demo' | 'manual' | 'imported' | 'generated'
export type Priority = 'low' | 'medium' | 'high'
export type AssignmentStatus = 'not-started' | 'in-progress' | 'complete'
export type CalendarKind = 'event' | 'study' | 'meal-prep'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type StorageLocation = 'Pantry' | 'Refrigerator' | 'Freezer'
export type BuiltInGroceryCategory =
  | 'Produce'
  | 'Meat & Seafood'
  | 'Dairy'
  | 'Bakery'
  | 'Frozen'
  | 'Pantry'
  | 'Snacks'
  | 'Household'
  | 'Other'

export type GroceryCategory = BuiltInGroceryCategory | (string & {})

export interface EntityBase {
  id: string
  createdAt: string
  updatedAt: string
  source: EntitySource
}

export interface CalendarEvent extends EntityBase {
  title: string
  date: string
  startTime: string
  endTime: string
  kind: CalendarKind
  course?: string
  assignmentId?: string
  locked?: boolean
  userAdjusted?: boolean
  completed?: boolean
  sourceLabel?: string
}

export interface CalendarFeed {
  id: string
  name: string
  kind: 'canvas' | 'ics'
  url: string
  enabled: boolean
  status: 'not-configured' | 'connected' | 'error'
  lastRefresh?: string
}

export interface HomeworkSubtask {
  id: string
  title: string
  completed: boolean
}

export interface HomeworkAssignment extends EntityBase {
  title: string
  course: string
  dueDate: string
  dueTime: string
  priority: Priority
  estimatedMinutes: number
  progress: number
  status: AssignmentStatus
  notes: string
  subtasks: HomeworkSubtask[]
  sourceLabel?: string
  sourceUrl?: string
}

export interface Nutrition {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
}

export interface NutritionProvenance {
  kind: 'manual' | 'nutrition-label' | 'database' | 'recipe-calculation' | 'estimated' | 'unknown'
  capturedAt: string
  estimated: boolean
  sourceLabel?: string
  sourceUrl?: string
}

export interface RecipeIngredient {
  id: string
  name: string
  canonicalName: string
  quantity: number | null
  unit: string
  category: GroceryCategory
  note?: string
}

export interface RecipeStep {
  id: string
  text: string
}

export interface Recipe extends EntityBase {
  name: string
  description: string
  image: string
  category: string
  tags: string[]
  favorite: boolean
  originalYield: number
  prepMinutes: number
  cookMinutes: number
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
  nutritionPerServing: Nutrition
  nutritionProvenance: NutritionProvenance
  sourceLabel: string
  sourceUrl?: string
  needsReview?: boolean
}

export interface PackagedFood extends EntityBase {
  name: string
  brand?: string
  barcode?: string
  servingSize: { quantity: number; unit: string }
  servingsPerContainer?: number
  nutritionPerServing: Nutrition
  nutritionProvenance: NutritionProvenance
  image?: string
  notes?: string
}

export interface MealSourceSnapshot {
  sourceType: 'recipe' | 'packaged' | 'custom' | 'leftover'
  sourceId?: string
  name: string
  image?: string
  nutritionPerServing: Nutrition
  nutritionProvenance: NutritionProvenance
  capturedAt: string
}

export interface MealEntry extends EntityBase {
  date: string
  slot: MealSlot
  recipeId?: string
  packagedFoodId?: string
  leftoverId?: string
  customName?: string
  servings: number
  preparedServings: number
  consumedServings: number
  sourceSnapshot: MealSourceSnapshot
}

export interface Leftover extends EntityBase {
  sourceMealId: string
  sourceSnapshot: MealSourceSnapshot
  preparedOn: string
  servingsRemaining: number
  storageLocation: Extract<StorageLocation, 'Refrigerator' | 'Freezer'>
  useByDate?: string
  notes?: string
}

export interface FoodLogEntry extends EntityBase {
  date: string
  name: string
  servings: number
  nutritionSnapshot: Nutrition
  provenanceSnapshot: NutritionProvenance
  sourceSnapshot: MealSourceSnapshot
  origin: 'recipe' | 'packaged' | 'custom' | 'leftover'
}

export interface PantryItem extends EntityBase {
  name: string
  canonicalName: string
  quantity: number
  unit: string
  category: GroceryCategory
  location: StorageLocation
  expirationDate?: string
  notes?: string
}

export interface GroceryItem extends EntityBase {
  name: string
  canonicalName: string
  quantity: number
  unit: string
  category: GroceryCategory
  checked: boolean
  note?: string
  sourceRecipeIds: string[]
  pantryQuantity: number
  pantryDecision: 'unreviewed' | 'none' | 'saved' | 'enough' | 'custom'
  pantryCustomQuantity?: number
  needsReview?: boolean
  reviewReason?: string
}

export interface GroceryList extends EntityBase {
  name: string
  items: GroceryItem[]
  status: 'draft' | 'shopping' | 'completed'
  completedAt?: string
}

export interface GroceryHistoryEntry extends EntityBase {
  name: string
  completedAt: string
  items: GroceryItem[]
}

export interface AvoidTimeRange {
  id: string
  label: string
  days: number[]
  startTime: string
  endTime: string
}

export interface StudySettings {
  earliestTime: string
  latestTime: string
  defaultBlockMinutes: number
  breakMinutes: number
  maxBlockMinutes: number
  avoidTimes: AvoidTimeRange[]
}

export type MealPlanningMode =
  | 'balanced'
  | 'variety'
  | 'meal-prep'
  | 'favor-leftovers'
  | 'minimize-waste'
  | 'minimize-unique-ingredients'

export interface MealPlanningPreferences {
  mode: MealPlanningMode
  preferredSlots: MealSlot[]
  targetPrepServings: number
  favorAvailablePantry: boolean
}

export interface GroceryCategorySetting {
  id: string
  name: GroceryCategory
  sortOrder: number
  enabled: boolean
}

export interface GroceryStaple {
  id: string
  name: string
  canonicalName: string
  quantity: number
  unit: string
  category: GroceryCategory
  enabled: boolean
}

export interface UserSettings {
  name: string
  measurementSystem: 'us' | 'metric'
  appearance: 'light' | 'dark' | 'system'
  nutritionTargets: Nutrition
  study: StudySettings
  mealPlanning: MealPlanningPreferences
  groceryCategories: GroceryCategorySetting[]
  groceryStaples: GroceryStaple[]
  calendarFeeds: CalendarFeed[]
}

export interface AppData {
  schemaVersion: 2
  initializedAt: string
  events: CalendarEvent[]
  assignments: HomeworkAssignment[]
  recipes: Recipe[]
  packagedFoods: PackagedFood[]
  meals: MealEntry[]
  leftovers: Leftover[]
  foodLog: FoodLogEntry[]
  pantry: PantryItem[]
  activeGroceryList: GroceryList | null
  groceryHistory: GroceryHistoryEntry[]
  settings: UserSettings
}

export interface MyHubBackup {
  format: 'myhub-backup'
  formatVersion: 2
  appVersion: string
  exportedAt: string
  data: AppData
}

export interface MyHubBackupV1 {
  format: 'myhub-backup'
  formatVersion: 1
  appVersion: string
  exportedAt: string
  data: unknown
}
