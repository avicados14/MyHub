import type { GroceryItem, MealEntry, PantryItem, Recipe } from './types'
import { makeId } from '../utilities/date'

const MASS_TO_OUNCES: Record<string, number> = { oz: 1, lb: 16 }

const normalize = (quantity: number, unit: string): { quantity: number; unit: string } => {
  if (unit in MASS_TO_OUNCES) return { quantity: quantity * (MASS_TO_OUNCES[unit] ?? 1), unit: 'oz' }
  return { quantity, unit }
}

const displayMass = (quantity: number, unit: string): { quantity: number; unit: string } => {
  if (unit === 'oz' && quantity >= 16) return { quantity: quantity / 16, unit: 'lb' }
  return { quantity, unit }
}

export const aggregateGroceryItems = (
  meals: MealEntry[],
  recipes: Recipe[],
  pantry: PantryItem[] = [],
  now = new Date().toISOString(),
): GroceryItem[] => {
  const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  const totals = new Map<string, Omit<GroceryItem, 'id' | 'createdAt' | 'updatedAt' | 'source'>>()

  for (const meal of meals) {
    if (!meal.recipeId) continue
    const recipe = recipeMap.get(meal.recipeId)
    if (!recipe) continue
    const factor = meal.servings / recipe.originalYield
    for (const ingredient of recipe.ingredients) {
      if (ingredient.quantity === null) continue
      const value = normalize(ingredient.quantity * factor, ingredient.unit)
      const key = `${ingredient.canonicalName}|${value.unit}`
      const existing = totals.get(key)
      if (existing) {
        existing.quantity += value.quantity
        if (!existing.sourceRecipeIds.includes(recipe.id)) existing.sourceRecipeIds.push(recipe.id)
      } else {
        const saved = pantry
          .filter((item) => item.canonicalName === ingredient.canonicalName)
          .reduce((sum, item) => {
            const normalized = normalize(item.quantity, item.unit)
            return normalized.unit === value.unit ? sum + normalized.quantity : sum
          }, 0)
        totals.set(key, {
          name: ingredient.name,
          canonicalName: ingredient.canonicalName,
          quantity: value.quantity,
          unit: value.unit,
          category: ingredient.category,
          checked: false,
          sourceRecipeIds: [recipe.id],
          pantryQuantity: saved,
          pantryDecision: 'unreviewed',
        })
      }
    }
  }

  return Array.from(totals.values()).map((item) => {
    const display = displayMass(item.quantity, item.unit)
    const pantryQuantity = item.unit === 'oz' && display.unit === 'lb' ? item.pantryQuantity / 16 : item.pantryQuantity
    return {
      ...item,
      ...display,
      pantryQuantity,
      id: makeId('grocery'),
      createdAt: now,
      updatedAt: now,
      source: 'generated' as const,
    }
  })
}

export const purchaseQuantity = (item: GroceryItem): number => {
  if (item.pantryDecision === 'enough') return 0
  if (item.pantryDecision === 'saved') return Math.max(0, item.quantity - item.pantryQuantity)
  return Math.max(0, item.quantity)
}
