import type { MealEntry, Nutrition, Recipe, RecipeIngredient } from './types'
import { createZeroNutrition, nutritionValue } from './nutrition'

const FRACTIONS: Array<[number, string]> = [
  [0.125, '⅛'],
  [0.25, '¼'],
  [0.333, '⅓'],
  [0.375, '⅜'],
  [0.5, '½'],
  [0.625, '⅝'],
  [0.667, '⅔'],
  [0.75, '¾'],
  [0.875, '⅞'],
]

export const formatQuantity = (value: number): string => {
  if (!Number.isFinite(value)) return '—'
  const whole = Math.floor(value + 1e-8)
  const remainder = value - whole
  if (remainder < 0.04) return String(whole)
  const fraction = FRACTIONS.reduce((closest, candidate) =>
    Math.abs(candidate[0] - remainder) < Math.abs(closest[0] - remainder) ? candidate : closest,
  )
  if (Math.abs(fraction[0] - remainder) <= 0.045) return `${whole || ''}${fraction[1]}`
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
}

export const scaleIngredient = (ingredient: RecipeIngredient, factor: number): RecipeIngredient => ({
  ...ingredient,
  quantity: ingredient.quantity === null ? null : ingredient.quantity * factor,
})

export const scaledIngredients = (recipe: Recipe, servings: number): RecipeIngredient[] => {
  const factor = servings / recipe.originalYield
  return recipe.ingredients.map((item) => {
    if (item.scaledOverride && Math.abs(item.scaledOverride.yield - servings) < 0.0001) {
      return { ...item, quantity: item.scaledOverride.quantity, unit: item.scaledOverride.unit }
    }
    return scaleIngredient(item, factor)
  })
}

export const multiplyNutrition = (nutrition: Nutrition, servings: number): Nutrition => ({
  calories: nutrition.calories * servings,
  protein: nutrition.protein * servings,
  carbs: nutrition.carbs * servings,
  fat: nutrition.fat * servings,
  sugar: nutritionValue(nutrition, 'sugar') * servings,
  saturatedFat: nutritionValue(nutrition, 'saturatedFat') * servings,
  fiber: nutrition.fiber * servings,
  sodium: nutrition.sodium * servings,
})

export const sumNutrition = (values: Nutrition[]): Nutrition =>
  values.reduce<Nutrition>(
    (total, value) => ({
      calories: total.calories + value.calories,
      protein: total.protein + value.protein,
      carbs: total.carbs + value.carbs,
      fat: total.fat + value.fat,
      sugar: nutritionValue(total, 'sugar') + nutritionValue(value, 'sugar'),
      saturatedFat: nutritionValue(total, 'saturatedFat') + nutritionValue(value, 'saturatedFat'),
      fiber: total.fiber + value.fiber,
      sodium: total.sodium + value.sodium,
    }),
    createZeroNutrition(),
  )

export const remainingPreparedServings = (meal: Pick<MealEntry, 'preparedServings' | 'consumedServings'>): number =>
  Math.max(0, meal.preparedServings - meal.consumedServings)
