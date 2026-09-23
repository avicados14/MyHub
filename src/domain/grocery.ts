import type {
  GroceryHistoryEntry,
  GroceryItem,
  GroceryList,
  GroceryStaple,
  MealEntry,
  PantryItem,
  Recipe,
  UserSettings,
} from './types'
import { makeId } from '../utilities/date'

type MeasurementSystem = UserSettings['measurementSystem']
type UnitFamily = 'mass' | 'volume' | 'count' | 'other'

interface UnitDefinition {
  family: Exclude<UnitFamily, 'other'>
  baseFactor: number
  display: string
}

interface CanonicalQuantity {
  quantity: number
  unit: string
  family: UnitFamily
}

const UNIT_ALIASES: Record<string, UnitDefinition> = {
  oz: { family: 'mass', baseFactor: 28.349523125, display: 'oz' },
  ounce: { family: 'mass', baseFactor: 28.349523125, display: 'oz' },
  ounces: { family: 'mass', baseFactor: 28.349523125, display: 'oz' },
  lb: { family: 'mass', baseFactor: 453.59237, display: 'lb' },
  lbs: { family: 'mass', baseFactor: 453.59237, display: 'lb' },
  pound: { family: 'mass', baseFactor: 453.59237, display: 'lb' },
  pounds: { family: 'mass', baseFactor: 453.59237, display: 'lb' },
  g: { family: 'mass', baseFactor: 1, display: 'g' },
  gram: { family: 'mass', baseFactor: 1, display: 'g' },
  grams: { family: 'mass', baseFactor: 1, display: 'g' },
  kg: { family: 'mass', baseFactor: 1000, display: 'kg' },
  kilogram: { family: 'mass', baseFactor: 1000, display: 'kg' },
  kilograms: { family: 'mass', baseFactor: 1000, display: 'kg' },
  tsp: { family: 'volume', baseFactor: 4.92892159375, display: 'tsp' },
  teaspoon: { family: 'volume', baseFactor: 4.92892159375, display: 'tsp' },
  teaspoons: { family: 'volume', baseFactor: 4.92892159375, display: 'tsp' },
  tbsp: { family: 'volume', baseFactor: 14.78676478125, display: 'tbsp' },
  tablespoon: { family: 'volume', baseFactor: 14.78676478125, display: 'tbsp' },
  tablespoons: { family: 'volume', baseFactor: 14.78676478125, display: 'tbsp' },
  cup: { family: 'volume', baseFactor: 236.5882365, display: 'cup' },
  cups: { family: 'volume', baseFactor: 236.5882365, display: 'cup' },
  'fl oz': { family: 'volume', baseFactor: 29.5735295625, display: 'fl oz' },
  'fluid ounce': { family: 'volume', baseFactor: 29.5735295625, display: 'fl oz' },
  'fluid ounces': { family: 'volume', baseFactor: 29.5735295625, display: 'fl oz' },
  ml: { family: 'volume', baseFactor: 1, display: 'mL' },
  milliliter: { family: 'volume', baseFactor: 1, display: 'mL' },
  milliliters: { family: 'volume', baseFactor: 1, display: 'mL' },
  millilitre: { family: 'volume', baseFactor: 1, display: 'mL' },
  millilitres: { family: 'volume', baseFactor: 1, display: 'mL' },
  l: { family: 'volume', baseFactor: 1000, display: 'L' },
  liter: { family: 'volume', baseFactor: 1000, display: 'L' },
  liters: { family: 'volume', baseFactor: 1000, display: 'L' },
  litre: { family: 'volume', baseFactor: 1000, display: 'L' },
  litres: { family: 'volume', baseFactor: 1000, display: 'L' },
  each: { family: 'count', baseFactor: 1, display: 'each' },
  ea: { family: 'count', baseFactor: 1, display: 'each' },
  count: { family: 'count', baseFactor: 1, display: 'each' },
  item: { family: 'count', baseFactor: 1, display: 'each' },
  items: { family: 'count', baseFactor: 1, display: 'each' },
  piece: { family: 'count', baseFactor: 1, display: 'each' },
  pieces: { family: 'count', baseFactor: 1, display: 'each' },
  pc: { family: 'count', baseFactor: 1, display: 'each' },
  pcs: { family: 'count', baseFactor: 1, display: 'each' },
  unit: { family: 'count', baseFactor: 1, display: 'each' },
  units: { family: 'count', baseFactor: 1, display: 'each' },
}

const SAFE_SINGULARS: Record<string, string> = {
  apples: 'apple',
  avocados: 'avocado',
  bananas: 'banana',
  carrots: 'carrot',
  eggs: 'egg',
  lemons: 'lemon',
  limes: 'lime',
  onions: 'onion',
  potatoes: 'potato',
  tomatoes: 'tomato',
}

const PREPARATION_WORDS = new Set([
  'boneless',
  'chopped',
  'diced',
  'fresh',
  'frozen',
  'grated',
  'minced',
  'shredded',
  'skinless',
  'sliced',
])

const normalizedUnitKey = (unit: string): string => unit.trim().toLowerCase().replaceAll(/\s+/g, ' ')

export const normalizeGroceryUnit = (unit: string): string => {
  const key = normalizedUnitKey(unit)
  return UNIT_ALIASES[key]?.display ?? unit.trim().replaceAll(/\s+/g, ' ')
}

export const groceryUnitFamily = (unit: string): UnitFamily => UNIT_ALIASES[normalizedUnitKey(unit)]?.family ?? 'other'

export const canonicalizeIngredientName = (name: string): string => {
  const normalized = name
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll(/[’']/g, '')
    .replaceAll(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replaceAll(/[-\s]+/g, ' ')
    .trim()
  return SAFE_SINGULARS[normalized] ?? normalized
}

const possibleEquivalenceKey = (name: string): string => {
  const prepared = canonicalizeIngredientName(name)
    .split(' ')
    .filter((part) => !PREPARATION_WORDS.has(part))
    .join(' ')
  return SAFE_SINGULARS[prepared] ?? prepared
}

const toCanonicalQuantity = (quantity: number, unit: string): CanonicalQuantity => {
  const key = normalizedUnitKey(unit)
  const definition = UNIT_ALIASES[key]
  if (!definition) return { quantity, unit: normalizeGroceryUnit(unit), family: 'other' }
  const baseUnit = definition.family === 'mass' ? 'g' : definition.family === 'volume' ? 'mL' : 'each'
  return { quantity: quantity * definition.baseFactor, unit: baseUnit, family: definition.family }
}

const roundQuantity = (quantity: number): number => Math.round((quantity + Number.EPSILON) * 10000) / 10000

export const convertGroceryQuantity = (quantity: number, fromUnit: string, toUnit: string): number | null => {
  const source = toCanonicalQuantity(quantity, fromUnit)
  const targetDefinition = UNIT_ALIASES[normalizedUnitKey(toUnit)]
  if (!targetDefinition) {
    return source.family === 'other' && normalizedUnitKey(source.unit) === normalizedUnitKey(toUnit) ? quantity : null
  }
  if (source.family !== targetDefinition.family) return null
  return roundQuantity(source.quantity / targetDefinition.baseFactor)
}

const displayQuantity = (canonical: CanonicalQuantity, measurementSystem: MeasurementSystem): { quantity: number; unit: string } => {
  if (canonical.family === 'mass') {
    if (measurementSystem === 'metric') {
      return canonical.quantity >= 1000
        ? { quantity: canonical.quantity / 1000, unit: 'kg' }
        : { quantity: canonical.quantity, unit: 'g' }
    }
    return canonical.quantity >= 453.59237
      ? { quantity: canonical.quantity / 453.59237, unit: 'lb' }
      : { quantity: canonical.quantity / 28.349523125, unit: 'oz' }
  }
  if (canonical.family === 'volume') {
    if (measurementSystem === 'metric') {
      return canonical.quantity >= 1000
        ? { quantity: canonical.quantity / 1000, unit: 'L' }
        : { quantity: canonical.quantity, unit: 'mL' }
    }
    if (canonical.quantity >= 236.5882365) return { quantity: canonical.quantity / 236.5882365, unit: 'cup' }
    if (canonical.quantity >= 29.5735295625) return { quantity: canonical.quantity / 29.5735295625, unit: 'fl oz' }
    if (canonical.quantity >= 14.78676478125) return { quantity: canonical.quantity / 14.78676478125, unit: 'tbsp' }
    return { quantity: canonical.quantity / 4.92892159375, unit: 'tsp' }
  }
  return { quantity: canonical.quantity, unit: canonical.unit }
}

const addReview = (item: Omit<GroceryItem, 'id' | 'createdAt' | 'updatedAt' | 'source'>, reason: string): void => {
  item.needsReview = true
  item.reviewReason = item.reviewReason ? `${item.reviewReason} ${reason}` : reason
}

export const aggregateGroceryItems = (
  meals: MealEntry[],
  recipes: Recipe[],
  pantry: PantryItem[] = [],
  now = new Date().toISOString(),
  measurementSystem: MeasurementSystem = 'us',
): GroceryItem[] => {
  const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  const totals = new Map<string, Omit<GroceryItem, 'id' | 'createdAt' | 'updatedAt' | 'source'>>()

  for (const meal of meals) {
    if (!meal.recipeId) continue
    const recipe = recipeMap.get(meal.recipeId)
    if (!recipe || !Number.isFinite(recipe.originalYield) || recipe.originalYield <= 0) continue
    const factor = meal.servings / recipe.originalYield
    for (const ingredient of recipe.ingredients) {
      if (ingredient.quantity === null || !Number.isFinite(ingredient.quantity) || ingredient.quantity < 0) continue
      const canonicalName = canonicalizeIngredientName(ingredient.canonicalName || ingredient.name)
      if (!canonicalName) continue
      const value = toCanonicalQuantity(ingredient.quantity * factor, ingredient.unit)
      const unitKey = value.family === 'other' ? normalizedUnitKey(value.unit) : value.family
      const key = `${canonicalName}|${unitKey}`
      const existing = totals.get(key)
      if (existing) {
        existing.quantity += value.quantity
        if (!existing.sourceRecipeIds.includes(recipe.id)) existing.sourceRecipeIds.push(recipe.id)
        if (canonicalizeIngredientName(existing.name) !== canonicalizeIngredientName(ingredient.name)) {
          addReview(existing, `“${existing.name}” and “${ingredient.name}” share a saved name; confirm they are equivalent.`)
        }
      } else {
        let saved = 0
        let incompatiblePantryMatch = false
        for (const item of pantry) {
          if (canonicalizeIngredientName(item.canonicalName || item.name) !== canonicalName) continue
          const normalized = toCanonicalQuantity(item.quantity, item.unit)
          if (normalized.family === value.family && normalized.unit === value.unit) saved += normalized.quantity
          else incompatiblePantryMatch = true
        }
        const next = {
          name: ingredient.name.trim(),
          canonicalName,
          quantity: value.quantity,
          unit: value.unit,
          category: ingredient.category,
          checked: false,
          sourceRecipeIds: [recipe.id],
          pantryQuantity: saved,
          pantryDecision: 'unreviewed' as const,
        }
        if (incompatiblePantryMatch) {
          addReview(next, 'A pantry item with this name uses an incompatible unit and was not subtracted.')
        }
        totals.set(key, next)
      }
    }
  }

  const pending = Array.from(totals.values())
  for (let index = 0; index < pending.length; index += 1) {
    const item = pending[index]
    if (!item) continue
    for (let comparisonIndex = index + 1; comparisonIndex < pending.length; comparisonIndex += 1) {
      const comparison = pending[comparisonIndex]
      if (!comparison || possibleEquivalenceKey(item.name) !== possibleEquivalenceKey(comparison.name)) continue
      if (item.canonicalName === comparison.canonicalName && item.unit !== comparison.unit) {
        addReview(item, 'This ingredient appears with incompatible units and remains separate.')
        addReview(comparison, 'This ingredient appears with incompatible units and remains separate.')
      } else if (item.canonicalName !== comparison.canonicalName) {
        addReview(item, `It may overlap with “${comparison.name}”; the items remain separate.`)
        addReview(comparison, `It may overlap with “${item.name}”; the items remain separate.`)
      }
    }
  }

  return pending.map((item) => {
    const display = displayQuantity({ quantity: item.quantity, unit: item.unit, family: groceryUnitFamily(item.unit) }, measurementSystem)
    const pantryDisplay = convertGroceryQuantity(item.pantryQuantity, item.unit, display.unit) ?? item.pantryQuantity
    return {
      ...item,
      quantity: roundQuantity(display.quantity),
      unit: display.unit,
      pantryQuantity: roundQuantity(pantryDisplay),
      id: makeId('grocery'),
      createdAt: now,
      updatedAt: now,
      source: 'generated' as const,
    }
  })
}

export const purchaseQuantity = (item: GroceryItem): number => {
  if (item.pantryDecision === 'enough') return 0
  if (item.pantryDecision === 'saved') return roundQuantity(Math.max(0, item.quantity - item.pantryQuantity))
  if (item.pantryDecision === 'custom') {
    const custom = Number.isFinite(item.pantryCustomQuantity) ? Math.max(0, item.pantryCustomQuantity ?? 0) : 0
    return roundQuantity(Math.max(0, item.quantity - custom))
  }
  return roundQuantity(Math.max(0, item.quantity))
}

export const groceryItemFromStaple = (staple: GroceryStaple, now = new Date().toISOString()): GroceryItem => ({
  id: makeId('grocery'),
  createdAt: now,
  updatedAt: now,
  source: 'generated',
  name: staple.name.trim(),
  canonicalName: canonicalizeIngredientName(staple.canonicalName || staple.name),
  quantity: Math.max(0, staple.quantity),
  unit: normalizeGroceryUnit(staple.unit),
  category: staple.category,
  checked: false,
  sourceRecipeIds: [],
  pantryQuantity: 0,
  pantryDecision: 'unreviewed',
})

export const copyHistoryEntryToList = (entry: GroceryHistoryEntry, now = new Date().toISOString()): GroceryList => ({
  id: makeId('grocery-list'),
  createdAt: now,
  updatedAt: now,
  source: 'manual',
  name: `${entry.name} copy`,
  status: 'shopping',
  items: entry.items.map((item) => ({
    ...structuredClone(item),
    id: makeId('grocery'),
    createdAt: now,
    updatedAt: now,
    source: 'manual',
    checked: false,
  })),
})

export const isValidGroceryQuantity = (value: number): boolean => Number.isFinite(value) && value >= 0

export const GROCERY_UNIT_OPTIONS = ['each', 'oz', 'lb', 'g', 'kg', 'tsp', 'tbsp', 'cup', 'fl oz', 'mL', 'L'] as const

export const defaultPantryLocation = (category: string): PantryItem['location'] => {
  if (category === 'Frozen') return 'Freezer'
  if (['Produce', 'Dairy', 'Meat & Seafood'].includes(category)) return 'Refrigerator'
  return 'Pantry'
}
