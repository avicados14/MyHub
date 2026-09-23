import { createEmptyData, createUnknownNutritionProvenance } from '../domain/defaults'
import type { AppData, GroceryCategory, Nutrition, Recipe, RecipeIngredient } from '../domain/types'
import { addDays, startOfWeek, toLocalDate } from '../utilities/date'

const nowIso = () => new Date().toISOString()
const fixtureBase = (id: string) => ({ id, createdAt: nowIso(), updatedAt: nowIso(), source: 'demo' as const })
const ingredient = (
  id: string,
  name: string,
  quantity: number | null,
  unit: string,
  category: GroceryCategory,
  note?: string,
): RecipeIngredient => ({ id, name, canonicalName: name.toLowerCase(), quantity, unit, category, note })
const nutrition = (calories: number, protein: number, carbs: number, fat: number, fiber: number, sodium: number): Nutrition => ({ calories, protein, carbs, fat, fiber, sodium })

const recipes: Recipe[] = [
  {
    ...fixtureBase('recipe-teriyaki'), name: 'Teriyaki Steak Bowls', description: 'Seared steak, vegetables, and teriyaki over rice.', image: 'recipes/teriyaki-steak-bowls.jpg', category: 'Dinner', tags: ['High Protein'], favorite: true, originalYield: 4, prepMinutes: 20, cookMinutes: 25,
    ingredients: [ingredient('i-ts-1', 'steak', 1.5, 'lb', 'Meat & Seafood'), ingredient('i-ts-2', 'jasmine rice', 2, 'cup', 'Pantry')],
    steps: [{ id: 's-ts-1', text: 'Cook, assemble, and serve.' }], nutritionPerServing: nutrition(610, 42, 66, 19, 6, 740), nutritionProvenance: createUnknownNutritionProvenance(nowIso(), 'Test fixture'), sourceLabel: 'Test fixture',
  },
  {
    ...fixtureBase('recipe-burrito'), name: 'Chicken Burrito Bowls', description: 'Chicken, rice, beans, corn, and avocado.', image: 'recipes/chicken-burrito-bowls.jpg', category: 'Lunch', tags: ['Meal Prep'], favorite: true, originalYield: 4, prepMinutes: 15, cookMinutes: 30,
    ingredients: [ingredient('i-cb-1', 'chicken breast', 1, 'lb', 'Meat & Seafood'), ingredient('i-cb-2', 'rice', 2, 'cup', 'Pantry'), ingredient('i-cb-3', 'black beans', 15, 'oz', 'Pantry'), ingredient('i-cb-4', 'salt', null, '', 'Pantry', 'to taste')],
    steps: [{ id: 's-cb-1', text: 'Cook and assemble.' }], nutritionPerServing: nutrition(560, 44, 65, 14, 12, 610), nutritionProvenance: createUnknownNutritionProvenance(nowIso(), 'Test fixture'), sourceLabel: 'Test fixture',
  },
  {
    ...fixtureBase('recipe-oats'), name: 'High-Protein Overnight Oats', description: 'Oats with yogurt and berries.', image: 'recipes/overnight-oats.jpg', category: 'Breakfast', tags: ['Quick'], favorite: false, originalYield: 2, prepMinutes: 10, cookMinutes: 0,
    ingredients: [ingredient('i-oo-1', 'rolled oats', 1, 'cup', 'Pantry'), ingredient('i-oo-2', 'Greek yogurt', 1, 'cup', 'Dairy')],
    steps: [{ id: 's-oo-1', text: 'Mix and chill.' }], nutritionPerServing: nutrition(420, 29, 57, 9, 9, 180), nutritionProvenance: createUnknownNutritionProvenance(nowIso(), 'Test fixture'), sourceLabel: 'Test fixture',
  },
  {
    ...fixtureBase('recipe-pasta'), name: 'Weeknight Tomato Pasta', description: 'Pasta with tomato and basil.', image: 'recipes/weekday-pasta.jpg', category: 'Dinner', tags: ['Quick'], favorite: false, originalYield: 4, prepMinutes: 10, cookMinutes: 20,
    ingredients: [ingredient('i-wp-1', 'rigatoni', 1, 'lb', 'Pantry')], steps: [{ id: 's-wp-1', text: 'Boil and toss.' }], nutritionPerServing: nutrition(510, 19, 82, 11, 7, 590), nutritionProvenance: createUnknownNutritionProvenance(nowIso(), 'Test fixture'), sourceLabel: 'Test fixture',
  },
  {
    ...fixtureBase('recipe-sandwich'), name: 'Breakfast Sandwich', description: 'Egg and cheese on a muffin.', image: 'recipes/breakfast-sandwich.jpg', category: 'Breakfast', tags: ['Quick'], favorite: true, originalYield: 1, prepMinutes: 5, cookMinutes: 10,
    ingredients: [ingredient('i-bs-1', 'English muffin', 1, 'each', 'Bakery')], steps: [{ id: 's-bs-1', text: 'Cook and assemble.' }], nutritionPerServing: nutrition(430, 31, 29, 21, 4, 690), nutritionProvenance: createUnknownNutritionProvenance(nowIso(), 'Test fixture'), sourceLabel: 'Test fixture',
  },
]

const recipeSnapshot = (recipe: Recipe) => ({
  sourceType: 'recipe' as const,
  sourceId: recipe.id,
  name: recipe.name,
  image: recipe.image,
  nutritionPerServing: { ...recipe.nutritionPerServing },
  nutritionProvenance: { ...recipe.nutritionProvenance },
  capturedAt: nowIso(),
})

export const createTestFixtureData = (today = new Date()): AppData => {
  const data = createEmptyData(today)
  const week = startOfWeek(today)
  const todayDate = toLocalDate(today)
  const tomorrow = toLocalDate(addDays(today, 1))
  const burrito = recipes[1]!
  const oats = recipes[2]!
  return {
    ...data,
    events: [{ ...fixtureBase('event-fluid'), title: 'Fluid Mechanics', course: 'ME EN 321', date: todayDate, startTime: '09:00', endTime: '09:50', kind: 'event', sourceLabel: 'Test fixture' }],
    assignments: [{ ...fixtureBase('assignment-lab'), title: 'Lab Report', course: 'CE EN 482', dueDate: tomorrow, dueTime: '23:59', priority: 'high', estimatedMinutes: 120, progress: 20, status: 'in-progress', notes: '', subtasks: [] }],
    recipes: recipes.map((recipe) => structuredClone(recipe)),
    meals: [{ ...fixtureBase('meal-breakfast'), date: todayDate, slot: 'breakfast', recipeId: oats.id, servings: 1, preparedServings: 2, consumedServings: 1, sourceSnapshot: recipeSnapshot(oats) }, { ...fixtureBase('meal-week'), date: toLocalDate(addDays(week, 4)), slot: 'dinner', recipeId: burrito.id, servings: 1, preparedServings: 4, consumedServings: 0, sourceSnapshot: recipeSnapshot(burrito) }],
    foodLog: [{ ...fixtureBase('log-oats'), date: todayDate, name: oats.name, servings: 1, nutritionSnapshot: { ...oats.nutritionPerServing }, provenanceSnapshot: { ...oats.nutritionProvenance }, sourceSnapshot: recipeSnapshot(oats), origin: 'recipe' }],
    pantry: [{ ...fixtureBase('pantry-rice'), name: 'Rice', canonicalName: 'rice', quantity: 1.5, unit: 'lb', category: 'Pantry', location: 'Pantry' }],
    settings: { ...data.settings, name: 'Test User', appearance: 'light' },
  }
}
