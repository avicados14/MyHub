import { describe, expect, it } from 'vitest'
import { createDemoData } from './seed'
import { formatQuantity, remainingPreparedServings, scaledIngredients, sumNutrition } from './recipe'

describe('recipe calculations', () => {
  it('scales a four-serving recipe to six without changing the base recipe', () => {
    const recipe = createDemoData(new Date(2026, 8, 22)).recipes.find((item) => item.id === 'recipe-burrito')!
    const scaled = scaledIngredients(recipe, 6)
    expect(scaled.find((item) => item.name === 'chicken breast')?.quantity).toBe(1.5)
    expect(scaled.find((item) => item.name === 'rice')?.quantity).toBe(3)
    expect(scaled.find((item) => item.name === 'salt')?.quantity).toBeNull()
    expect(recipe.ingredients.find((item) => item.name === 'rice')?.quantity).toBe(2)
  })

  it('formats common cooking fractions cleanly', () => {
    expect(formatQuantity(1.5)).toBe('1½')
    expect(formatQuantity(0.25)).toBe('¼')
    expect(formatQuantity(2)).toBe('2')
  })

  it('sums nutrition snapshots and never returns negative leftovers', () => {
    expect(sumNutrition([
      { calories: 100, protein: 10, carbs: 8, fat: 2, fiber: 1, sodium: 50 },
      { calories: 250, protein: 20, carbs: 30, fat: 8, fiber: 4, sodium: 250 },
    ])).toEqual({ calories: 350, protein: 30, carbs: 38, fat: 10, fiber: 5, sodium: 300 })
    expect(remainingPreparedServings({ preparedServings: 2, consumedServings: 3 })).toBe(0)
  })
})
