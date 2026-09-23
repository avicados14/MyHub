import { multiplyNutrition, remainingPreparedServings } from './recipe'
import type { AppData, FoodLogEntry, Leftover, MealEntry, MealSlot } from './types'

export const syncLeftoverForMeal = (data: AppData, meal: MealEntry, timestamp: string): AppData => {
  const remaining = remainingPreparedServings(meal)
  const current = data.leftovers.find((leftover) => leftover.sourceMealId === meal.id)
  let leftovers: Leftover[]
  if (remaining <= 0) {
    leftovers = data.leftovers.filter((leftover) => leftover.sourceMealId !== meal.id)
  } else if (current) {
    leftovers = data.leftovers.map((leftover) =>
      leftover.id === current.id
        ? {
            ...leftover,
            updatedAt: timestamp,
            servingsRemaining: remaining,
            sourceSnapshot: { ...meal.sourceSnapshot },
          }
        : leftover,
    )
  } else {
    leftovers = [
      ...data.leftovers,
      {
        id: `leftover-${meal.id}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        source: 'generated',
        sourceMealId: meal.id,
        sourceSnapshot: { ...meal.sourceSnapshot },
        preparedOn: meal.date,
        servingsRemaining: remaining,
        storageLocation: 'Refrigerator',
      },
    ]
  }
  return { ...data, leftovers }
}

export const upsertMealWithLeftover = (data: AppData, meal: MealEntry, timestamp: string): AppData => {
  const displaced = data.meals.find((item) => item.id !== meal.id && item.date === meal.date && item.slot === meal.slot)
  const meals = data.meals.some((item) => item.id === meal.id)
    ? data.meals.map((item) => (item.id === meal.id ? meal : item))
    : [...data.meals.filter((item) => !(item.date === meal.date && item.slot === meal.slot)), meal]
  const withoutDisplaced = displaced
    ? {
        ...data,
        meals,
        leftovers: data.leftovers.filter((leftover) => leftover.sourceMealId !== displaced.id),
        foodLog: data.foodLog.filter((entry) => entry.sourceSnapshot.sourceId !== `meal:${displaced.id}`),
      }
    : { ...data, meals }
  return syncLeftoverForMeal(withoutDisplaced, meal, timestamp)
}

export const logMealConsumption = (
  data: AppData,
  mealId: string,
  consumedServings: number,
  timestamp: string,
): AppData => {
  const meal = data.meals.find((item) => item.id === mealId)
  if (!meal) return data
  const safeServings = Math.max(0, consumedServings)
  const consumptionDelta = safeServings - meal.consumedServings
  const updatedMeal: MealEntry = { ...meal, updatedAt: timestamp, consumedServings: safeServings }
  const withoutPrevious = data.foodLog.filter((entry) => entry.sourceSnapshot.sourceId !== `meal:${meal.id}`)
  const entry: FoodLogEntry | null =
    safeServings <= 0
      ? null
      : {
          id: `food-log-meal-${meal.id}`,
          createdAt: timestamp,
          updatedAt: timestamp,
          source: 'generated',
          date: meal.date,
          name: meal.sourceSnapshot.name,
          servings: safeServings,
          nutritionSnapshot: multiplyNutrition(meal.sourceSnapshot.nutritionPerServing, safeServings),
          provenanceSnapshot: { ...meal.sourceSnapshot.nutritionProvenance },
          sourceSnapshot: { ...meal.sourceSnapshot, sourceId: `meal:${meal.id}`, capturedAt: timestamp },
          origin: meal.sourceSnapshot.sourceType,
        }
  const withMeal = {
    ...data,
    meals: data.meals.map((item) => (item.id === meal.id ? updatedMeal : item)),
    foodLog: entry ? [...withoutPrevious, entry] : withoutPrevious,
    leftovers: meal.leftoverId
      ? data.leftovers.flatMap((leftover) => {
          if (leftover.id !== meal.leftoverId) return [leftover]
          const remaining = Math.max(0, leftover.servingsRemaining - consumptionDelta)
          return remaining > 0 ? [{ ...leftover, servingsRemaining: remaining, updatedAt: timestamp }] : []
        })
      : data.leftovers,
  }
  if (meal.leftoverId) return withMeal
  return syncLeftoverForMeal(withMeal, updatedMeal, timestamp)
}

export const moveOrCopyMeal = (
  data: AppData,
  mealId: string,
  target: { date: string; slot: MealSlot },
  mode: 'move' | 'copy',
  timestamp: string,
  copyId: string,
): AppData => {
  const meal = data.meals.find((item) => item.id === mealId)
  if (!meal) return data
  const withoutTarget = data.meals.filter(
    (item) => !(item.date === target.date && item.slot === target.slot) && (mode === 'copy' || item.id !== mealId),
  )
  const next: MealEntry =
    mode === 'move'
      ? { ...meal, updatedAt: timestamp, ...target }
      : { ...meal, id: copyId, createdAt: timestamp, updatedAt: timestamp, ...target, consumedServings: 0 }
  return { ...data, meals: [...withoutTarget, next] }
}

export const consumeLeftover = (
  data: AppData,
  leftoverId: string,
  servings: number,
  timestamp: string,
  date: string,
): AppData => {
  const leftover = data.leftovers.find((item) => item.id === leftoverId)
  if (!leftover || servings <= 0) return data
  const used = Math.min(servings, leftover.servingsRemaining)
  const entry: FoodLogEntry = {
    id: `food-log-leftover-${leftover.id}-${timestamp}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    source: 'manual',
    date,
    name: leftover.sourceSnapshot.name,
    servings: used,
    nutritionSnapshot: multiplyNutrition(leftover.sourceSnapshot.nutritionPerServing, used),
    provenanceSnapshot: { ...leftover.sourceSnapshot.nutritionProvenance },
    sourceSnapshot: {
      ...leftover.sourceSnapshot,
      sourceType: 'leftover',
      sourceId: leftover.id,
      capturedAt: timestamp,
    },
    origin: 'leftover',
  }
  return {
    ...data,
    foodLog: [...data.foodLog, entry],
    leftovers: data.leftovers.flatMap((item) =>
      item.id !== leftover.id
        ? [item]
        : item.servingsRemaining - used > 0
          ? [{ ...item, updatedAt: timestamp, servingsRemaining: item.servingsRemaining - used }]
          : [],
    ),
  }
}
