import type { AppData, MealPlanningMode, MealSlot, Recipe } from './types'

export interface MealSuggestion {
  id: string
  date: string
  slot: MealSlot
  sourceType: 'recipe' | 'leftover'
  sourceId: string
  name: string
  score: number
  reasons: string[]
}

const pantryNames = (data: AppData): Set<string> =>
  new Set(data.pantry.filter((item) => item.quantity > 0).map((item) => item.canonicalName))

const pantryCoverage = (recipe: Recipe, available: Set<string>): number => {
  if (!recipe.ingredients.length) return 0
  return (
    recipe.ingredients.filter((ingredient) => available.has(ingredient.canonicalName)).length /
    recipe.ingredients.length
  )
}

const scoreRecipe = (
  recipe: Recipe,
  mode: MealPlanningMode,
  used: Set<string>,
  available: Set<string>,
): { score: number; reasons: string[] } => {
  let score = recipe.favorite ? 8 : 0
  const reasons: string[] = []
  const coverage = pantryCoverage(recipe, available)
  if (coverage > 0) {
    score += coverage * 25
    reasons.push(`${Math.round(coverage * 100)}% of ingredients tracked in pantry`)
  }
  if (recipe.favorite) reasons.push('Saved as a favorite')
  if (mode === 'variety' && !used.has(recipe.id)) {
    score += 18
    reasons.push('Adds variety')
  }
  if (mode === 'meal-prep' && recipe.originalYield >= 4) {
    score += 14
    reasons.push('Good batch size')
  }
  if (mode === 'minimize-unique-ingredients') {
    score += coverage * 18
    reasons.push('Reuses available ingredients')
  }
  if (mode === 'minimize-waste' && coverage > 0) {
    score += coverage * 22
    reasons.push('Uses pantry inventory')
  }
  score -= (recipe.prepMinutes + recipe.cookMinutes) / 30
  return { score, reasons: reasons.length ? reasons : ['Balanced saved-recipe rotation'] }
}

export const createMealSuggestions = (
  data: AppData,
  targets: Array<{ date: string; slot: MealSlot }>,
  lockedKeys: Set<string> = new Set(),
  generation = 0,
): MealSuggestion[] => {
  const available = pantryNames(data)
  const used = new Set(data.meals.flatMap((meal) => (meal.recipeId ? [meal.recipeId] : [])))
  const recipes = data.recipes.filter((recipe) => !recipe.needsReview)
  const leftovers = data.leftovers.filter((leftover) => leftover.servingsRemaining > 0)
  return targets.flatMap((target, targetIndex) => {
    const key = `${target.date}:${target.slot}`
    if (lockedKeys.has(key) || data.meals.some((meal) => meal.date === target.date && meal.slot === target.slot))
      return []
    if (
      (data.settings.mealPlanning.mode === 'favor-leftovers' || data.settings.mealPlanning.mode === 'minimize-waste') &&
      leftovers.length
    ) {
      const leftover = leftovers[(targetIndex + generation) % leftovers.length]!
      return [
        {
          id: `suggestion-${key}`,
          date: target.date,
          slot: target.slot,
          sourceType: 'leftover' as const,
          sourceId: leftover.id,
          name: leftover.sourceSnapshot.name,
          score: 100,
          reasons: ['Uses prepared food before planning something new'],
        },
      ]
    }
    if (!recipes.length) return []
    const ranked = recipes
      .map((recipe) => ({ recipe, ...scoreRecipe(recipe, data.settings.mealPlanning.mode, used, available) }))
      .toSorted((a, b) => b.score - a.score || a.recipe.id.localeCompare(b.recipe.id))
    const chosen = ranked[(targetIndex + generation) % ranked.length]!
    used.add(chosen.recipe.id)
    return [
      {
        id: `suggestion-${key}`,
        date: target.date,
        slot: target.slot,
        sourceType: 'recipe' as const,
        sourceId: chosen.recipe.id,
        name: chosen.recipe.name,
        score: chosen.score,
        reasons: chosen.reasons,
      },
    ]
  })
}
