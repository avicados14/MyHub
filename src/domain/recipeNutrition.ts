import { multiplyNutrition, sumNutrition } from './recipe'
import { createZeroNutrition, nutritionValue } from './nutrition'
import type { Nutrition, PackagedFood, Recipe, RecipeIngredient } from './types'

const EMPTY_NUTRITION: Nutrition = createZeroNutrition()

export interface IngredientNutritionMapping {
  ingredientId: string
  sourceFoodId: string
  sourceServings: number
}

export interface IngredientNutritionEstimate {
  ingredient: RecipeIngredient
  mapping?: IngredientNutritionMapping
  source?: PackagedFood
  nutrition: Nutrition
  resolved: boolean
  reason?: string
}

export interface RecipeNutritionEstimate {
  perRecipe: Nutrition
  perServing: Nutrition
  ingredients: IngredientNutritionEstimate[]
  sourceLabels: string[]
  unresolvedIngredientIds: string[]
}

const divideNutrition = (nutrition: Nutrition, divisor: number): Nutrition =>
  divisor > 0
    ? {
        calories: nutrition.calories / divisor,
        protein: nutrition.protein / divisor,
        carbs: nutrition.carbs / divisor,
        fat: nutrition.fat / divisor,
        sugar: nutritionValue(nutrition, 'sugar') / divisor,
        saturatedFat: nutritionValue(nutrition, 'saturatedFat') / divisor,
        fiber: nutrition.fiber / divisor,
        sodium: nutrition.sodium / divisor,
      }
    : { ...EMPTY_NUTRITION }

export const matchingPackagedFood = (ingredient: RecipeIngredient, foods: PackagedFood[]): PackagedFood | undefined => {
  const canonical = ingredient.canonicalName.trim().toLowerCase()
  if (!canonical) return undefined
  return foods.find((food) => {
    const candidate = food.name.trim().toLowerCase()
    return candidate === canonical || candidate.includes(canonical) || canonical.includes(candidate)
  })
}

export const defaultIngredientMappings = (
  ingredients: RecipeIngredient[],
  foods: PackagedFood[],
): IngredientNutritionMapping[] =>
  ingredients.flatMap((ingredient) => {
    const source = matchingPackagedFood(ingredient, foods)
    if (!source || ingredient.quantity === null) return []
    const ingredientUnit = ingredient.unit.trim().toLowerCase()
    const sourceUnit = source.servingSize.unit.trim().toLowerCase()
    if (!ingredientUnit || ingredientUnit !== sourceUnit || source.servingSize.quantity <= 0) return []
    return [
      {
        ingredientId: ingredient.id,
        sourceFoodId: source.id,
        sourceServings: ingredient.quantity / source.servingSize.quantity,
      },
    ]
  })

export const estimateRecipeNutrition = (
  recipe: Pick<Recipe, 'ingredients' | 'originalYield'>,
  foods: PackagedFood[],
  mappings: IngredientNutritionMapping[],
): RecipeNutritionEstimate => {
  const byIngredient = new Map(mappings.map((mapping) => [mapping.ingredientId, mapping]))
  const ingredients = recipe.ingredients.map<IngredientNutritionEstimate>((ingredient) => {
    const mapping = byIngredient.get(ingredient.id)
    if (!mapping)
      return {
        ingredient,
        nutrition: { ...EMPTY_NUTRITION },
        resolved: false,
        reason: ingredient.quantity === null ? 'Quantity is unresolved.' : 'Choose a saved or searched source.',
      }
    const source = foods.find((food) => food.id === mapping.sourceFoodId)
    if (!source)
      return {
        ingredient,
        mapping,
        nutrition: { ...EMPTY_NUTRITION },
        resolved: false,
        reason: 'The selected source is unavailable.',
      }
    if (!Number.isFinite(mapping.sourceServings) || mapping.sourceServings <= 0)
      return {
        ingredient,
        mapping,
        source,
        nutrition: { ...EMPTY_NUTRITION },
        resolved: false,
        reason: 'Enter how many source servings the recipe uses.',
      }
    return {
      ingredient,
      mapping,
      source,
      nutrition: multiplyNutrition(source.nutritionPerServing, mapping.sourceServings),
      resolved: true,
    }
  })
  const perRecipe = sumNutrition(ingredients.map((item) => item.nutrition))
  return {
    perRecipe,
    perServing: divideNutrition(perRecipe, recipe.originalYield),
    ingredients,
    sourceLabels: [
      ...new Set(
        ingredients.flatMap((item) =>
          item.resolved && item.source ? [item.source.nutritionProvenance.sourceLabel || item.source.name] : [],
        ),
      ),
    ],
    unresolvedIngredientIds: ingredients.filter((item) => !item.resolved).map((item) => item.ingredient.id),
  }
}
