import { sumNutrition } from './recipe'
import type { AppData, CalendarEvent, MealPlanningMode, MealSlot, Nutrition, Recipe } from './types'

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

interface SuggestionContext {
  data: AppData
  date: string
  slot: MealSlot
  mode: MealPlanningMode
  available: Set<string>
  usedRecipeIds: Set<string>
  usedIngredients: Set<string>
  consumed: Nutrition
}

const SLOT_CALORIE_SHARE: Record<MealSlot, number> = { breakfast: 0.22, lunch: 0.3, dinner: 0.38, snack: 0.1 }
const LATE_DAY_SLOT_SHARE: Record<MealSlot, number> = { breakfast: 0.06, lunch: 0.07, dinner: 0.6, snack: 0.27 }
const SLOT_CATEGORY: Record<MealSlot, string[]> = {
  breakfast: ['breakfast'],
  lunch: ['lunch'],
  dinner: ['dinner'],
  snack: ['snack', 'dessert'],
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

const eventMinutes = (event: CalendarEvent): number => {
  if (event.allDay) return 120
  const [startHour = 0, startMinute = 0] = event.startTime.split(':').map(Number)
  const [endHour = 0, endMinute = 0] = event.endTime.split(':').map(Number)
  return Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute))
}

const scheduleLoad = (data: AppData, date: string): { minutes: number; count: number } => {
  const events = data.events.filter((event) => event.date === date && !event.completed)
  return { minutes: events.reduce((total, event) => total + eventMinutes(event), 0), count: events.length }
}

const nutritionFit = (
  recipe: Recipe,
  targets: Nutrition,
  consumed: Nutrition,
  slot: MealSlot,
  lateDayNutritionBias: boolean,
): { score: number; reason: string } => {
  const slotShare = lateDayNutritionBias ? LATE_DAY_SLOT_SHARE[slot] : SLOT_CALORIE_SHARE[slot]
  const remainingCalories = Math.max(0, targets.calories - consumed.calories)
  const intendedCalories = Math.min(remainingCalories || targets.calories, targets.calories * slotShare)
  if (intendedCalories <= 0) return { score: 0, reason: 'Nutrition target already met' }
  const calorieFit = Math.max(
    0,
    1 - Math.abs(recipe.nutritionPerServing.calories - intendedCalories) / intendedCalories,
  )
  const proteinRemaining = Math.max(0, targets.protein - consumed.protein)
  const intendedProtein = Math.max(1, proteinRemaining * slotShare)
  const proteinFit = Math.max(0, 1 - Math.abs(recipe.nutritionPerServing.protein - intendedProtein) / intendedProtein)
  const score = calorieFit * 18 + proteinFit * 8
  return {
    score,
    reason: `${Math.round(recipe.nutritionPerServing.calories)} kcal and ${Math.round(recipe.nutritionPerServing.protein)} g protein fit remaining targets`,
  }
}

const slotFit = (recipe: Recipe, slot: MealSlot): boolean =>
  SLOT_CATEGORY[slot].some((category) => recipe.category.toLowerCase().includes(category))

const scoreRecipe = (recipe: Recipe, context: SuggestionContext): { score: number; reasons: string[] } => {
  let score = 0
  const reasons: string[] = []
  const coverage = pantryCoverage(recipe, context.available)
  const load = scheduleLoad(context.data, context.date)
  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes
  const nutrition = nutritionFit(
    recipe,
    context.data.settings.nutritionTargets,
    context.consumed,
    context.slot,
    context.data.settings.mealPlanning.lateDayNutritionBias === true,
  )
  score += nutrition.score
  reasons.push(nutrition.reason)

  if (recipe.needsReview) {
    score -= 4
    reasons.push('Recipe details are marked for review')
  }

  if (slotFit(recipe, context.slot)) {
    score += 16
    reasons.push(`Matches ${context.slot}`)
  }
  if (recipe.favorite) {
    score += 8
    reasons.push('Saved as a favorite')
  }
  if (context.data.settings.mealPlanning.favorAvailablePantry && coverage > 0) {
    score += coverage * 25
    reasons.push(`${Math.round(coverage * 100)}% of ingredients tracked in pantry`)
  }
  if (load.minutes >= 180 || load.count >= 3) {
    const quickBonus = Math.max(0, 18 - totalMinutes / 5)
    score += quickBonus
    reasons.push(`${totalMinutes} min on a busy calendar day`)
  } else {
    score += Math.max(0, 8 - totalMinutes / 15)
    reasons.push(`${totalMinutes} min total prep and cook time`)
  }
  if (context.mode === 'variety' && !context.usedRecipeIds.has(recipe.id)) {
    score += 18
    reasons.push('Adds variety')
  }
  if (context.mode === 'meal-prep' && recipe.originalYield >= context.data.settings.mealPlanning.targetPrepServings) {
    score += 16
    reasons.push(`Makes ${recipe.originalYield} servings for meal prep`)
  }
  if (context.mode === 'minimize-waste' && coverage > 0) {
    score += coverage * 22
    reasons.push('Uses available pantry inventory')
  }
  if (context.mode === 'minimize-unique-ingredients') {
    const ingredientNames = recipe.ingredients.map((ingredient) => ingredient.canonicalName).filter(Boolean)
    const overlap = ingredientNames.filter((ingredient) => context.usedIngredients.has(ingredient)).length
    if (overlap > 0) {
      score += (overlap / Math.max(1, ingredientNames.length)) * 30
      reasons.push(`Reuses ${overlap} ingredient${overlap === 1 ? '' : 's'} across suggested slots`)
    } else if (context.usedIngredients.size) {
      score -= Math.min(12, ingredientNames.length * 2)
      reasons.push('Introduces new ingredients')
    }
  }
  return { score, reasons }
}

const leftoverSuggestion = (
  data: AppData,
  target: { date: string; slot: MealSlot },
  generation: number,
): MealSuggestion | undefined => {
  const leftovers = data.leftovers.filter((leftover) => leftover.servingsRemaining > 0)
  if (!leftovers.length) return undefined
  const shouldFavor =
    data.settings.mealPlanning.mode === 'favor-leftovers' || data.settings.mealPlanning.mode === 'minimize-waste'
  if (!shouldFavor) return undefined
  const leftover = leftovers[generation % leftovers.length]!
  const load = scheduleLoad(data, target.date)
  return {
    id: `suggestion-${target.date}:${target.slot}`,
    date: target.date,
    slot: target.slot,
    sourceType: 'leftover',
    sourceId: leftover.id,
    name: leftover.sourceSnapshot.name,
    score: 120 + (load.count ? 8 : 0),
    reasons: [
      'Uses prepared food before planning something new',
      ...(load.count ? ['No prep needed on a scheduled day'] : []),
    ],
  }
}

export const createMealSuggestions = (
  data: AppData,
  targets: Array<{ date: string; slot: MealSlot }>,
  lockedKeys: Set<string> = new Set(),
  generation = 0,
  generationByKey: ReadonlyMap<string, number> = new Map(),
): MealSuggestion[] => {
  const available = pantryNames(data)
  const usedRecipeIds = new Set(data.meals.flatMap((meal) => (meal.recipeId ? [meal.recipeId] : [])))
  const usedIngredients = new Set(
    data.meals.flatMap((meal) => {
      const recipe = data.recipes.find((item) => item.id === meal.recipeId)
      return recipe?.ingredients.map((ingredient) => ingredient.canonicalName) ?? []
    }),
  )
  const reviewedRecipes = data.recipes.filter((recipe) => !recipe.needsReview)
  const recipes = reviewedRecipes.length ? reviewedRecipes : data.recipes
  const consumed = sumNutrition(
    data.foodLog.filter((entry) => entry.date === targets[0]?.date).map((entry) => entry.nutritionSnapshot),
  )
  return targets.flatMap((target, targetIndex) => {
    const key = `${target.date}:${target.slot}`
    if (lockedKeys.has(key) || data.meals.some((meal) => meal.date === target.date && meal.slot === target.slot))
      return []
    const targetGeneration = generation + (generationByKey.get(key) ?? 0)
    const leftover = leftoverSuggestion(data, target, targetIndex + targetGeneration)
    if (leftover) return [leftover]
    if (!recipes.length) return []
    const ranked = recipes
      .map((recipe) => ({
        recipe,
        ...scoreRecipe(recipe, {
          data,
          date: target.date,
          slot: target.slot,
          mode: data.settings.mealPlanning.mode,
          available,
          usedRecipeIds,
          usedIngredients,
          consumed:
            target.date === targets[0]?.date
              ? consumed
              : sumNutrition(
                  data.foodLog.filter((entry) => entry.date === target.date).map((entry) => entry.nutritionSnapshot),
                ),
        }),
      }))
      .toSorted((a, b) => b.score - a.score || a.recipe.id.localeCompare(b.recipe.id))
    const chosen = ranked[targetGeneration % ranked.length]!
    usedRecipeIds.add(chosen.recipe.id)
    chosen.recipe.ingredients.forEach((ingredient) => usedIngredients.add(ingredient.canonicalName))
    return [
      {
        id: `suggestion-${key}`,
        date: target.date,
        slot: target.slot,
        sourceType: 'recipe' as const,
        sourceId: chosen.recipe.id,
        name: chosen.recipe.name,
        score: Math.round(chosen.score * 10) / 10,
        reasons: chosen.reasons,
      },
    ]
  })
}
