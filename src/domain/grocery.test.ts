import { describe, expect, it } from 'vitest'
import {
  aggregateGroceryItems,
  canonicalizeIngredientName,
  convertGroceryQuantity,
  copyHistoryEntryToList,
  groceryItemFromStaple,
  groceryMealsForWindow,
  groceryUnitFamily,
  normalizeGroceryUnit,
  purchaseQuantity,
} from './grocery'
import type { GroceryHistoryEntry, GroceryItem, MealEntry, PantryItem, Recipe, RecipeIngredient } from './types'

const NOW = '2026-09-22T00:00:00.000Z'
const base = { createdAt: NOW, updatedAt: NOW, source: 'demo' as const }
const ingredient = (id: string, name: string, amount: number, unit: string): RecipeIngredient => ({
  id,
  name,
  canonicalName: name.toLowerCase(),
  quantity: amount,
  unit,
  category: 'Pantry',
})
const recipe = (id: string, ingredients: RecipeIngredient[]): Recipe => ({
  ...base,
  id,
  name: id,
  description: '',
  image: '',
  category: 'Dinner',
  tags: [],
  favorite: false,
  originalYield: 1,
  prepMinutes: 0,
  cookMinutes: 0,
  ingredients,
  steps: [],
  nutritionPerServing: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 },
  nutritionProvenance: { kind: 'unknown', capturedAt: NOW, estimated: false, sourceLabel: 'test' },
  sourceLabel: 'test',
})
const meal = (id: string, recipeId: string): MealEntry => ({
  ...base,
  id,
  date: '2026-09-22',
  slot: 'dinner',
  recipeId,
  servings: 1,
  preparedServings: 0,
  consumedServings: 0,
  sourceSnapshot: {
    sourceType: 'recipe',
    sourceId: recipeId,
    name: recipeId,
    nutritionPerServing: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 },
    nutritionProvenance: { kind: 'unknown', capturedAt: NOW, estimated: false },
    capturedAt: NOW,
  },
})
const pantry = (name: string, quantity: number, unit: string): PantryItem => ({
  ...base,
  id: `pantry-${name}-${unit}`,
  name,
  canonicalName: canonicalizeIngredientName(name),
  quantity,
  unit,
  category: 'Pantry',
  location: 'Pantry',
})
const groceryItem = (change: Partial<GroceryItem> = {}): GroceryItem => ({
  ...base,
  id: 'grocery-1',
  name: 'Chicken',
  canonicalName: 'chicken',
  quantity: 2,
  unit: 'lb',
  category: 'Meat & Seafood',
  checked: false,
  sourceRecipeIds: [],
  pantryQuantity: 0.75,
  pantryDecision: 'unreviewed',
  ...change,
})

describe('grocery unit normalization', () => {
  it.each([
    ['ounces', 'oz', 'mass'],
    ['pounds', 'lb', 'mass'],
    ['grams', 'g', 'mass'],
    ['kilograms', 'kg', 'mass'],
    ['teaspoons', 'tsp', 'volume'],
    ['tablespoons', 'tbsp', 'volume'],
    ['cups', 'cup', 'volume'],
    ['fluid ounces', 'fl oz', 'volume'],
    ['millilitres', 'mL', 'volume'],
    ['liters', 'L', 'volume'],
    ['pieces', 'each', 'count'],
  ])('normalizes %s to %s in the %s family', (source, expected, family) => {
    expect(normalizeGroceryUnit(source)).toBe(expected)
    expect(groceryUnitFamily(source)).toBe(family)
  })

  it('converts within mass, volume, and count families', () => {
    expect(convertGroceryQuantity(1, 'lb', 'oz')).toBe(16)
    expect(convertGroceryQuantity(1, 'kg', 'g')).toBe(1000)
    expect(convertGroceryQuantity(1, 'cup', 'tbsp')).toBe(16)
    expect(convertGroceryQuantity(1, 'L', 'mL')).toBe(1000)
    expect(convertGroceryQuantity(3, 'pieces', 'each')).toBe(3)
  })

  it('never converts incompatible or unrelated custom units', () => {
    expect(convertGroceryQuantity(1, 'cup', 'g')).toBeNull()
    expect(convertGroceryQuantity(2, 'clove', 'each')).toBeNull()
    expect(convertGroceryQuantity(2, 'clove', 'clove')).toBe(2)
  })
})

describe('grocery canonical names', () => {
  it('normalizes whitespace, punctuation, case, and a conservative singular allow-list', () => {
    expect(canonicalizeIngredientName('  Tomatoes (fresh) ')).toBe('tomatoes fresh')
    expect(canonicalizeIngredientName('APPLES')).toBe('apple')
    expect(canonicalizeIngredientName('Baker’s yeast')).toBe('bakers yeast')
  })

  it('does not apply unsafe generic stemming', () => {
    expect(canonicalizeIngredientName('glass')).toBe('glass')
    expect(canonicalizeIngredientName('rice')).toBe('rice')
  })
})

describe('grocery aggregation', () => {
  it('selects only meals inside the requested planning window', () => {
    const meals = [
      { ...meal('past', 'r1'), date: '2026-09-20' },
      { ...meal('current', 'r1'), date: '2026-09-23' },
      { ...meal('future', 'r1'), date: '2026-09-27' },
    ]
    expect(groceryMealsForWindow(meals, '2026-09-22', '2026-09-26').map((entry) => entry.id)).toEqual(['current'])
  })

  it('uses prepared servings and saved ingredient overrides for shopping quantities', () => {
    const overridden = ingredient('i1', 'rice', 1, 'cup')
    overridden.scaledOverride = { yield: 4, quantity: 3, unit: 'cup' }
    const planned = { ...meal('m1', 'r1'), servings: 1, preparedServings: 8 }
    const items = aggregateGroceryItems([planned], [recipe('r1', [overridden])], [], NOW, 'us')
    expect(items[0]).toMatchObject({ canonicalName: 'rice', quantity: 6, unit: 'cup' })
  })

  it('combines compatible oz and lb using deliberate US display units', () => {
    const items = aggregateGroceryItems(
      [meal('m1', 'r1'), meal('m2', 'r2')],
      [recipe('r1', [ingredient('i1', 'chicken', 8, 'oz')]), recipe('r2', [ingredient('i2', 'chicken', 1, 'lb')])],
      [],
      NOW,
      'us',
    )
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ quantity: 1.5, unit: 'lb', canonicalName: 'chicken' })
  })

  it('combines g and kg and displays metric deliberately', () => {
    const items = aggregateGroceryItems(
      [meal('m1', 'r1'), meal('m2', 'r2')],
      [recipe('r1', [ingredient('i1', 'flour', 500, 'g')]), recipe('r2', [ingredient('i2', 'flour', 1, 'kg')])],
      [],
      NOW,
      'metric',
    )
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ quantity: 1.5, unit: 'kg' })
  })

  it('combines tsp, tbsp, cup, fl oz, mL, and L without mixing mass', () => {
    const recipes = [
      recipe('r1', [ingredient('i1', 'stock', 3, 'tsp')]),
      recipe('r2', [ingredient('i2', 'stock', 1, 'tbsp')]),
      recipe('r3', [ingredient('i3', 'stock', 1, 'cup')]),
      recipe('r4', [ingredient('i4', 'stock', 8, 'fl oz')]),
      recipe('r5', [ingredient('i5', 'stock', 500, 'mL')]),
      recipe('r6', [ingredient('i6', 'stock', 1, 'L')]),
      recipe('r7', [ingredient('i7', 'stock', 100, 'g')]),
    ]
    const items = aggregateGroceryItems(
      recipes.map((entry, index) => meal(`m${index}`, entry.id)),
      recipes,
      [],
      NOW,
      'metric',
    )
    const volume = items.find((item) => groceryUnitFamily(item.unit) === 'volume')
    const mass = items.find((item) => groceryUnitFamily(item.unit) === 'mass')
    expect(items).toHaveLength(2)
    expect(volume?.unit).toBe('L')
    expect(volume?.quantity).toBeCloseTo(2, 1)
    expect(mass).toMatchObject({ quantity: 100, unit: 'g' })
    expect(volume?.needsReview).toBe(true)
    expect(mass?.needsReview).toBe(true)
  })

  it('combines count aliases but leaves custom units separate', () => {
    const recipes = [
      recipe('r1', [ingredient('i1', 'apple', 2, 'each')]),
      recipe('r2', [ingredient('i2', 'apples', 3, 'pieces')]),
      recipe('r3', [ingredient('i3', 'apple', 1, 'bag')]),
    ]
    const items = aggregateGroceryItems(
      recipes.map((entry, index) => meal(`m${index}`, entry.id)),
      recipes,
      [],
      NOW,
    )
    expect(items).toHaveLength(2)
    expect(items.find((item) => item.unit === 'each')?.quantity).toBe(5)
    expect(items.find((item) => item.unit === 'bag')?.quantity).toBe(1)
  })

  it('converts compatible pantry inventory into the grocery display unit', () => {
    const items = aggregateGroceryItems(
      [meal('m1', 'r1')],
      [recipe('r1', [ingredient('i1', 'chicken', 2, 'lb')])],
      [pantry('Chicken', 12, 'oz'), pantry('Chicken', 100, 'g')],
      NOW,
      'us',
    )
    expect(items[0]?.pantryQuantity).toBeCloseTo(0.97, 2)
  })

  it('does not subtract incompatible pantry inventory and surfaces review', () => {
    const [item] = aggregateGroceryItems(
      [meal('m1', 'r1')],
      [recipe('r1', [ingredient('i1', 'flour', 2, 'cup')])],
      [pantry('Flour', 500, 'g')],
      NOW,
      'us',
    )
    expect(item?.pantryQuantity).toBe(0)
    expect(item?.needsReview).toBe(true)
    expect(item?.reviewReason).toContain('incompatible unit')
  })

  it('surfaces possible prepared-name equivalence without silently combining', () => {
    const items = aggregateGroceryItems(
      [meal('m1', 'r1'), meal('m2', 'r2')],
      [
        recipe('r1', [ingredient('i1', 'onion', 1, 'each')]),
        recipe('r2', [ingredient('i2', 'diced onions', 2, 'each')]),
      ],
      [],
      NOW,
    )
    expect(items).toHaveLength(2)
    expect(items.every((item) => item.needsReview)).toBe(true)
    expect(items[0]?.reviewReason).toContain('remain separate')
  })
})

describe('pantry decisions', () => {
  it('supports none, saved amount, enough, and exact custom amount', () => {
    const item = groceryItem()
    expect(purchaseQuantity({ ...item, pantryDecision: 'none' })).toBe(2)
    expect(purchaseQuantity({ ...item, pantryDecision: 'saved' })).toBe(1.25)
    expect(purchaseQuantity({ ...item, pantryDecision: 'enough' })).toBe(0)
    expect(purchaseQuantity({ ...item, pantryDecision: 'custom', pantryCustomQuantity: 0.625 })).toBe(1.375)
  })

  it('never returns a negative or non-finite purchase quantity', () => {
    expect(purchaseQuantity(groceryItem({ pantryDecision: 'custom', pantryCustomQuantity: 50 }))).toBe(0)
    expect(purchaseQuantity(groceryItem({ pantryDecision: 'custom', pantryCustomQuantity: Number.NaN }))).toBe(2)
    expect(purchaseQuantity(groceryItem({ quantity: -2, pantryDecision: 'none' }))).toBe(0)
  })
})

describe('staples and history', () => {
  it('creates a grocery item only when the caller explicitly chooses a staple', () => {
    const item = groceryItemFromStaple(
      {
        id: 'staple-1',
        name: 'Dish soap',
        canonicalName: 'dish soap',
        quantity: 1,
        unit: 'item',
        category: 'Cleaning',
        enabled: true,
      },
      NOW,
    )
    expect(item).toMatchObject({
      name: 'Dish soap',
      unit: 'each',
      category: 'Cleaning',
      pantryDecision: 'unreviewed',
      checked: false,
    })
  })

  it('copies history into new editable entities without mutating the immutable snapshot', () => {
    const entry: GroceryHistoryEntry = {
      ...base,
      id: 'history-1',
      name: 'Campus market',
      completedAt: NOW,
      items: [groceryItem({ checked: true, note: 'Original note' })],
    }
    const original = structuredClone(entry)
    const copy = copyHistoryEntryToList(entry, '2026-09-23T00:00:00.000Z')
    copy.items[0]!.note = 'Changed in new list'
    expect(copy.status).toBe('shopping')
    expect(copy.items[0]?.checked).toBe(false)
    expect(copy.items[0]?.id).not.toBe(entry.items[0]?.id)
    expect(entry).toEqual(original)
  })
})
