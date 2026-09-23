import type { Nutrition } from './types'

export const NUTRITION_FIELDS = [
  { key: 'calories', label: 'Calories', unit: 'kcal', kind: 'target' },
  { key: 'protein', label: 'Protein', unit: 'g', kind: 'target' },
  { key: 'carbs', label: 'Carbs', unit: 'g', kind: 'target' },
  { key: 'fat', label: 'Fat', unit: 'g', kind: 'target' },
  { key: 'sugar', label: 'Sugar', unit: 'g', kind: 'limit' },
  { key: 'saturatedFat', label: 'Saturated fat', unit: 'g', kind: 'limit' },
  { key: 'fiber', label: 'Fiber', unit: 'g', kind: 'target' },
  { key: 'sodium', label: 'Sodium', unit: 'mg', kind: 'limit' },
] as const satisfies ReadonlyArray<{
  key: keyof Nutrition
  label: string
  unit: 'kcal' | 'g' | 'mg'
  kind: 'target' | 'limit'
}>

export type NutritionKey = (typeof NUTRITION_FIELDS)[number]['key']

export const nutritionValue = (nutrition: Nutrition, key: NutritionKey): number => nutrition[key] ?? 0

export const createZeroNutrition = (): Nutrition => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  sugar: 0,
  saturatedFat: 0,
  fiber: 0,
  sodium: 0,
})
