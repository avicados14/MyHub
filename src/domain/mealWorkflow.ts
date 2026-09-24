import { multiplyNutrition, remainingPreparedServings } from './recipe'
import type { AppData, FoodLogEntry, Leftover, MealEntry, MealSlot } from './types'
import { addDays, dateFromLocal, makeId, toLocalDate } from '../utilities/date'

const roundServings = (value: number): number => Math.round(value * 1000) / 1000

const sameMealSource = (first: MealEntry['sourceSnapshot'], second: MealEntry['sourceSnapshot']): boolean =>
  first.sourceType === second.sourceType && Boolean(first.sourceId) && first.sourceId === second.sourceId

const sameLegacyCarryForwardSource = (
  first: MealEntry['sourceSnapshot'],
  second: MealEntry['sourceSnapshot'],
): boolean =>
  sameMealSource(first, second) ||
  (second.sourceType === 'leftover' && first.name.trim().toLocaleLowerCase() === second.name.trim().toLocaleLowerCase())

const repairCarriedForwardBatches = (data: AppData, timestamp: string): AppData => {
  let meals = data.meals
  let leftovers = data.leftovers
  let changed = false

  for (const leftover of data.leftovers) {
    const continuationIndex = meals.findIndex((meal) => meal.id === leftover.sourceMealId)
    const continuation = meals[continuationIndex]
    if (
      !continuation ||
      continuation.autoPlannedFromMealId ||
      (continuation.leftoverId && continuation.leftoverId !== leftover.id)
    )
      continue
    const continuationSource =
      continuation.leftoverId === leftover.id ? leftover.sourceSnapshot : continuation.sourceSnapshot

    const previousSource = meals
      .filter(
        (meal) =>
          meal.id !== continuation.id &&
          meal.date < continuation.date &&
          meal.slot === continuation.slot &&
          !meal.leftoverId &&
          !meal.autoPlannedFromMealId &&
          sameLegacyCarryForwardSource(meal.sourceSnapshot, continuationSource) &&
          roundServings(meal.preparedServings - meal.consumedServings) === roundServings(continuation.preparedServings),
      )
      .sort((first, second) => second.date.localeCompare(first.date))[0]
    if (!previousSource) continue

    changed = true
    meals = meals.map((meal) =>
      meal.id === continuation.id
        ? {
            ...meal,
            updatedAt: timestamp,
            recipeId: undefined,
            packagedFoodId: undefined,
            customName: undefined,
            leftoverId: leftover.id,
            sourceSnapshot: {
              ...previousSource.sourceSnapshot,
              sourceType: 'leftover',
              sourceId: leftover.id,
              capturedAt: timestamp,
            },
          }
        : meal,
    )
    leftovers = leftovers.map((item) =>
      item.id === leftover.id
        ? {
            ...item,
            updatedAt: timestamp,
            sourceMealId: previousSource.id,
            sourceSnapshot: { ...previousSource.sourceSnapshot },
            preparedOn: previousSource.date,
          }
        : item,
    )
  }

  return changed ? { ...data, meals, leftovers } : data
}

const batchLeftoverId = (data: AppData, sourceMeal: MealEntry): string =>
  data.leftovers.find((leftover) => leftover.sourceMealId === sourceMeal.id)?.id ??
  data.meals.find((meal) => meal.autoPlannedFromMealId === sourceMeal.id)?.leftoverId ??
  `leftover-${sourceMeal.id}`

const batchConsumedServings = (data: AppData, sourceMeal: MealEntry): number => {
  const leftoverId = batchLeftoverId(data, sourceMeal)
  const mealServings = data.meals.reduce(
    (total, meal) =>
      meal.id === sourceMeal.id || meal.autoPlannedFromMealId === sourceMeal.id || meal.leftoverId === leftoverId
        ? total + meal.consumedServings
        : total,
    0,
  )
  const directlyLoggedServings = data.foodLog.reduce(
    (total, entry) => (entry.sourceSnapshot.sourceId === leftoverId ? total + entry.servings : total),
    0,
  )
  return mealServings + directlyLoggedServings
}

const remainingBatchServings = (data: AppData, sourceMeal: MealEntry): number =>
  Math.max(0, roundServings(sourceMeal.preparedServings - batchConsumedServings(data, sourceMeal)))

export const remainingServingsForLeftover = (data: AppData, leftover: Leftover): number => {
  const sourceMeal = data.meals.find((meal) => meal.id === leftover.sourceMealId)
  return sourceMeal ? remainingBatchServings(data, sourceMeal) : leftover.servingsRemaining
}

export const remainingBatchServingsForMeal = (data: AppData, meal: MealEntry): number | null => {
  const sourceMealId = meal.autoPlannedFromMealId ?? meal.id
  const leftover = meal.leftoverId
    ? data.leftovers.find((item) => item.id === meal.leftoverId)
    : data.leftovers.find((item) => item.sourceMealId === sourceMealId)
  return leftover ? remainingServingsForLeftover(data, leftover) : null
}

export const reconcileMealBatchBalances = (data: AppData, timestamp = new Date().toISOString()): AppData => {
  const repaired = repairCarriedForwardBatches(data, timestamp)
  let changed = false
  const leftovers = repaired.leftovers.map((leftover) => {
    const remaining = remainingServingsForLeftover(repaired, leftover)
    if (remaining === leftover.servingsRemaining) return leftover
    changed = true
    return { ...leftover, servingsRemaining: remaining, updatedAt: timestamp }
  })
  return changed ? { ...repaired, leftovers } : repaired
}

export const syncLeftoverForMeal = (data: AppData, meal: MealEntry, timestamp: string): AppData => {
  const remaining = meal.autoPlannedFromMealId
    ? 0
    : meal.leftoverId
      ? remainingPreparedServings(meal)
      : remainingBatchServings(data, meal)
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

const removeMealAndBatch = (data: AppData, mealId: string): AppData => {
  const removedIds = new Set(
    data.meals.filter((meal) => meal.id === mealId || meal.autoPlannedFromMealId === mealId).map((meal) => meal.id),
  )
  const removedLeftoverIds = new Set(
    data.leftovers.filter((leftover) => removedIds.has(leftover.sourceMealId)).map((leftover) => leftover.id),
  )
  for (const meal of data.meals) {
    if (meal.leftoverId && removedLeftoverIds.has(meal.leftoverId)) removedIds.add(meal.id)
  }
  return {
    ...data,
    meals: data.meals.filter((meal) => !removedIds.has(meal.id)),
    leftovers: data.leftovers.filter((leftover) => !removedIds.has(leftover.sourceMealId)),
    foodLog: data.foodLog.filter((entry) => {
      const sourceId = entry.sourceSnapshot.sourceId
      return !sourceId?.startsWith('meal:') || !removedIds.has(sourceId.slice('meal:'.length))
    }),
  }
}

export interface BatchPlanningOptions {
  autoPlanExtraServings?: boolean
  createMealId?: (sequence: number) => string
  maxLookaheadDays?: number
}

export const planExtraPreparedServings = (
  data: AppData,
  sourceMealId: string,
  timestamp: string,
  options: BatchPlanningOptions = {},
): AppData => {
  const sourceMeal = data.meals.find((meal) => meal.id === sourceMealId)
  if (!sourceMeal || sourceMeal.leftoverId || sourceMeal.autoPlannedFromMealId) return data
  const preservedAllocations = data.meals.filter(
    (meal) => meal.autoPlannedFromMealId === sourceMeal.id && meal.consumedServings > 0,
  )
  const mealsWithoutPreviousAllocations = data.meals.filter(
    (meal) => meal.autoPlannedFromMealId !== sourceMeal.id || meal.consumedServings > 0,
  )
  const extraPrepared = roundServings(Math.max(0, sourceMeal.preparedServings - sourceMeal.servings))
  if (extraPrepared <= 0) return { ...data, meals: mealsWithoutPreviousAllocations }
  const leftover = data.leftovers.find((item) => item.sourceMealId === sourceMeal.id)
  if (!leftover) return { ...data, meals: mealsWithoutPreviousAllocations }

  const occupiedSlots = new Set(mealsWithoutPreviousAllocations.map((meal) => `${meal.date}:${meal.slot}`))
  const createMealId = options.createMealId ?? (() => makeId('meal'))
  const maxLookaheadDays = Math.max(1, options.maxLookaheadDays ?? 365)
  const servingPerMeal = Math.max(0.25, sourceMeal.servings)
  const allocations: MealEntry[] = []
  let remaining = roundServings(
    Math.max(0, extraPrepared - preservedAllocations.reduce((total, meal) => total + meal.servings, 0)),
  )

  for (let dayOffset = 1; dayOffset <= maxLookaheadDays && remaining > 0; dayOffset += 1) {
    const date = toLocalDate(addDays(dateFromLocal(sourceMeal.date, '12:00'), dayOffset))
    if (occupiedSlots.has(`${date}:${sourceMeal.slot}`)) continue
    const servings = roundServings(Math.min(servingPerMeal, remaining))
    const sequence = allocations.length
    allocations.push({
      id: createMealId(sequence),
      createdAt: timestamp,
      updatedAt: timestamp,
      source: 'generated',
      date,
      slot: sourceMeal.slot,
      leftoverId: leftover.id,
      autoPlannedFromMealId: sourceMeal.id,
      servings,
      preparedServings: servings,
      consumedServings: 0,
      sourceSnapshot: {
        ...sourceMeal.sourceSnapshot,
        sourceType: 'leftover',
        sourceId: leftover.id,
        capturedAt: timestamp,
      },
    })
    occupiedSlots.add(`${date}:${sourceMeal.slot}`)
    remaining = roundServings(remaining - servings)
  }

  return { ...data, meals: [...mealsWithoutPreviousAllocations, ...allocations] }
}

export const upsertMealWithLeftover = (
  data: AppData,
  meal: MealEntry,
  timestamp: string,
  options: BatchPlanningOptions = {},
): AppData => {
  const availableBatch =
    !meal.leftoverId && !meal.autoPlannedFromMealId && !options.autoPlanExtraServings
      ? data.leftovers.find((leftover) => {
          const sourceMeal = data.meals.find((item) => item.id === leftover.sourceMealId)
          return (
            sourceMeal &&
            sourceMeal.id !== meal.id &&
            sourceMeal.date < meal.date &&
            sameMealSource(sourceMeal.sourceSnapshot, meal.sourceSnapshot) &&
            meal.preparedServings <= meal.servings &&
            meal.servings <= remainingServingsForLeftover(data, leftover)
          )
        })
      : undefined
  const normalizedMeal: MealEntry = availableBatch
    ? {
        ...meal,
        recipeId: undefined,
        packagedFoodId: undefined,
        customName: undefined,
        leftoverId: availableBatch.id,
        preparedServings: meal.servings,
        sourceSnapshot: {
          ...availableBatch.sourceSnapshot,
          sourceType: 'leftover',
          sourceId: availableBatch.id,
          capturedAt: timestamp,
        },
      }
    : meal
  const displaced = data.meals.find(
    (item) => item.id !== normalizedMeal.id && item.date === normalizedMeal.date && item.slot === normalizedMeal.slot,
  )
  const withoutDisplaced = displaced ? removeMealAndBatch(data, displaced.id) : data
  const meals = withoutDisplaced.meals.some((item) => item.id === normalizedMeal.id)
    ? withoutDisplaced.meals.map((item) => (item.id === normalizedMeal.id ? normalizedMeal : item))
    : [...withoutDisplaced.meals, normalizedMeal]
  const withMeal = { ...withoutDisplaced, meals }
  if (normalizedMeal.leftoverId) return reconcileMealBatchBalances(withMeal, timestamp)
  const withLeftover = syncLeftoverForMeal(withMeal, normalizedMeal, timestamp)
  if (options.autoPlanExtraServings)
    return planExtraPreparedServings(withLeftover, normalizedMeal.id, timestamp, options)
  return {
    ...withLeftover,
    meals: withLeftover.meals.filter(
      (item) => item.autoPlannedFromMealId !== normalizedMeal.id || item.consumedServings > 0,
    ),
  }
}

export const removeMealWithBatch = (data: AppData, mealId: string): AppData =>
  reconcileMealBatchBalances(removeMealAndBatch(data, mealId))

export const logMealConsumption = (
  data: AppData,
  mealId: string,
  consumedServings: number,
  timestamp: string,
): AppData => {
  const meal = data.meals.find((item) => item.id === mealId)
  if (!meal) return data
  const safeServings = Math.max(0, consumedServings)
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
    leftovers: data.leftovers,
  }
  const sourceMealId =
    meal.autoPlannedFromMealId ??
    (!meal.leftoverId ? meal.id : data.leftovers.find((leftover) => leftover.id === meal.leftoverId)?.sourceMealId)
  if (!sourceMealId) return withMeal
  const sourceMeal = withMeal.meals.find((item) => item.id === sourceMealId)
  return sourceMeal ? syncLeftoverForMeal(withMeal, sourceMeal, timestamp) : withMeal
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
      : {
          ...meal,
          id: copyId,
          createdAt: timestamp,
          updatedAt: timestamp,
          ...target,
          consumedServings: 0,
          autoPlannedFromMealId: undefined,
        }
  return reconcileMealBatchBalances({ ...data, meals: [...withoutTarget, next] }, timestamp)
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
