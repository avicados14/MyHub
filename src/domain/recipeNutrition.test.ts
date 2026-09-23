import { describe, expect, it } from 'vitest'
import { createTestFixtureData } from '../test/fixtures'
import type { PackagedFood } from './types'
import { defaultIngredientMappings, estimateRecipeNutrition } from './recipeNutrition'

const sourceFood = (name: string, servingQuantity = 1, servingUnit = 'cup'): PackagedFood => ({
  id: `food-${name}`,
  createdAt: '2026-09-22T00:00:00.000Z',
  updatedAt: '2026-09-22T00:00:00.000Z',
  source: 'imported',
  name,
  servingSize: { quantity: servingQuantity, unit: servingUnit },
  nutritionPerServing: {
    calories: 100,
    protein: 5,
    carbs: 12,
    fat: 3,
    sugar: 2,
    saturatedFat: 1,
    fiber: 2,
    sodium: 40,
  },
  nutritionProvenance: {
    kind: 'database',
    capturedAt: '2026-09-22T00:00:00.000Z',
    estimated: true,
    sourceLabel: 'Open Food Facts (read-only import)',
  },
})

describe('recipe nutrition estimation', () => {
  it('only totals explicitly mapped source servings and keeps unresolved ingredients visible', () => {
    const recipe = createTestFixtureData().recipes.find((item) => item.id === 'recipe-burrito')!
    const rice = sourceFood('rice')
    const estimate = estimateRecipeNutrition(
      recipe,
      [rice],
      [{ ingredientId: 'i-cb-2', sourceFoodId: rice.id, sourceServings: 2 }],
    )

    expect(estimate.perRecipe).toEqual({
      calories: 200,
      protein: 10,
      carbs: 24,
      fat: 6,
      sugar: 4,
      saturatedFat: 2,
      fiber: 4,
      sodium: 80,
    })
    expect(estimate.perServing.calories).toBe(50)
    expect(estimate.unresolvedIngredientIds).toEqual(['i-cb-1', 'i-cb-3', 'i-cb-4'])
    expect(estimate.ingredients.find((item) => item.ingredient.id === 'i-cb-4')?.reason).toBe('Quantity is unresolved.')
    expect(estimate.sourceLabels).toEqual(['Open Food Facts (read-only import)'])
  })

  it('auto-maps only exact compatible units and never guesses a conversion', () => {
    const recipe = createTestFixtureData().recipes.find((item) => item.id === 'recipe-burrito')!
    const compatible = sourceFood('rice')
    const incompatible = sourceFood('black beans', 100, 'g')
    expect(defaultIngredientMappings(recipe.ingredients, [compatible, incompatible])).toEqual([
      { ingredientId: 'i-cb-2', sourceFoodId: compatible.id, sourceServings: 2 },
    ])
  })
})
