export type EntitySource = 'demo' | 'manual' | 'imported' | 'generated'
export type Priority = 'low' | 'medium' | 'high'
export type AssignmentStatus = 'not-started' | 'in-progress' | 'complete'
export type CalendarKind = 'event' | 'study' | 'meal-prep'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type StorageLocation = 'Pantry' | 'Refrigerator' | 'Freezer'
export type GroceryCategory =
  | 'Produce'
  | 'Meat & Seafood'
  | 'Dairy'
  | 'Bakery'
  | 'Frozen'
  | 'Pantry'
  | 'Snacks'
  | 'Household'
  | 'Other'

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
  sourceLabel: string
  sourceUrl?: string
  needsReview?: boolean
}

export interface MealEntry extends EntityBase {
  date: string
  slot: MealSlot
  recipeId?: string
  customName?: string
  servings: number
  preparedServings: number
  consumedServings: number
}

export interface FoodLogEntry extends EntityBase {
  date: string
  name: string
  servings: number
  nutritionSnapshot: Nutrition
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

export interface StudySettings {
  earliestTime: string
  latestTime: string
  defaultBlockMinutes: number
  breakMinutes: number
  maxBlockMinutes: number
}

export interface UserSettings {
  name: string
  measurementSystem: 'us' | 'metric'
  appearance: 'light' | 'dark' | 'system'
  nutritionTargets: Nutrition
  study: StudySettings
  groceryStaples: string[]
  canvas: {
    feedUrl: string
    status: 'not-configured' | 'connected' | 'error'
    lastRefresh?: string
  }
}

export interface AppData {
  schemaVersion: 1
  seededAt: string
  events: CalendarEvent[]
  assignments: HomeworkAssignment[]
  recipes: Recipe[]
  meals: MealEntry[]
  foodLog: FoodLogEntry[]
  pantry: PantryItem[]
  activeGroceryList: GroceryList | null
  groceryHistory: GroceryHistoryEntry[]
  settings: UserSettings
}

export interface MyHubBackup {
  format: 'myhub-backup'
  formatVersion: 1
  appVersion: string
  exportedAt: string
  data: AppData
}
