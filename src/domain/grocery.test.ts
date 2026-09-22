import { describe, expect, it } from 'vitest'
import { aggregateGroceryItems, purchaseQuantity } from './grocery'
import type { MealEntry, Recipe } from './types'

const base = { createdAt: '2026-09-22T00:00:00.000Z', updatedAt: '2026-09-22T00:00:00.000Z', source: 'demo' as const }
const recipe = (id: string, amount: number, unit: string): Recipe => ({
  ...base, id, name: id, description: '', image: '', category: 'Dinner', tags: [], favorite: false,
  originalYield: 1, prepMinutes: 0, cookMinutes: 0,
  ingredients: [{ id: `${id}-ingredient`, name: 'chicken', canonicalName: 'chicken', quantity: amount, unit, category: 'Meat & Seafood' }],
  steps: [], nutritionPerServing: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }, sourceLabel: 'test',
})
const meal = (id: string, recipeId: string): MealEntry => ({ ...base, id, date: '2026-09-22', slot: 'dinner', recipeId, servings: 1, preparedServings: 0, consumedServings: 0 })

describe('grocery calculations', () => {
  it('combines 8 oz and 1 lb into 1.5 lb', () => {
    const items = aggregateGroceryItems([meal('m1', 'r1'), meal('m2', 'r2')], [recipe('r1', 8, 'oz'), recipe('r2', 1, 'lb')])
    expect(items).toHaveLength(1)
    expect(items[0]?.quantity).toBe(1.5)
    expect(items[0]?.unit).toBe('lb')
  })

  it('subtracts only inventory the user elects to use', () => {
    const item = aggregateGroceryItems([meal('m1', 'r1')], [recipe('r1', 2, 'lb')], [{ ...base, id: 'p1', name: 'Chicken', canonicalName: 'chicken', quantity: 0.75, unit: 'lb', category: 'Meat & Seafood', location: 'Freezer' }])[0]!
    expect(purchaseQuantity({ ...item, pantryDecision: 'none' })).toBe(2)
    expect(purchaseQuantity({ ...item, pantryDecision: 'saved' })).toBe(1.25)
    expect(purchaseQuantity({ ...item, pantryDecision: 'enough' })).toBe(0)
  })
})
