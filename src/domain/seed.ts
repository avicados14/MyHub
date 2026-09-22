import type { AppData, GroceryCategory, Nutrition, Recipe, RecipeIngredient } from './types'
import { addDays, startOfWeek, toLocalDate } from '../utilities/date'

const nowIso = () => new Date().toISOString()
const demoBase = (id: string) => ({ id, createdAt: nowIso(), updatedAt: nowIso(), source: 'demo' as const })
const ingredient = (
  id: string,
  name: string,
  quantity: number | null,
  unit: string,
  category: GroceryCategory,
  note?: string,
): RecipeIngredient => ({ id, name, canonicalName: name.toLowerCase(), quantity, unit, category, note })

const nutrition = (calories: number, protein: number, carbs: number, fat: number, fiber: number, sodium: number): Nutrition => ({
  calories,
  protein,
  carbs,
  fat,
  fiber,
  sodium,
})

const recipes: Recipe[] = [
  {
    ...demoBase('recipe-teriyaki'),
    name: 'Teriyaki Steak Bowls',
    description: 'Seared steak, crisp vegetables, and ginger teriyaki over rice.',
    image: 'recipes/teriyaki-steak-bowls.jpg',
    category: 'Dinner',
    tags: ['High Protein', 'Meal Prep'],
    favorite: true,
    originalYield: 4,
    prepMinutes: 20,
    cookMinutes: 25,
    ingredients: [
      ingredient('i-ts-1', 'steak', 1.5, 'lb', 'Meat & Seafood'),
      ingredient('i-ts-2', 'jasmine rice', 2, 'cup', 'Pantry'),
      ingredient('i-ts-3', 'broccoli', 3, 'cup', 'Produce'),
      ingredient('i-ts-4', 'teriyaki sauce', 0.5, 'cup', 'Pantry'),
    ],
    steps: [
      { id: 's-ts-1', text: 'Cook the rice and steam the broccoli until bright green.' },
      { id: 's-ts-2', text: 'Sear sliced steak, add sauce, and simmer until glossy.' },
      { id: 's-ts-3', text: 'Divide into bowls and finish with scallions and sesame.' },
    ],
    nutritionPerServing: nutrition(610, 42, 66, 19, 6, 740),
    sourceLabel: 'MyHub demo recipe',
  },
  {
    ...demoBase('recipe-burrito'),
    name: 'Chicken Burrito Bowls',
    description: 'A colorful prep-friendly bowl with chicken, rice, beans, corn, and avocado.',
    image: 'recipes/chicken-burrito-bowls.jpg',
    category: 'Lunch',
    tags: ['High Protein', 'Meal Prep'],
    favorite: true,
    originalYield: 4,
    prepMinutes: 15,
    cookMinutes: 30,
    ingredients: [
      ingredient('i-cb-1', 'chicken breast', 1, 'lb', 'Meat & Seafood'),
      ingredient('i-cb-2', 'rice', 2, 'cup', 'Pantry'),
      ingredient('i-cb-3', 'black beans', 15, 'oz', 'Pantry'),
      ingredient('i-cb-4', 'corn', 1, 'cup', 'Frozen'),
      ingredient('i-cb-5', 'avocado', 2, 'each', 'Produce'),
      ingredient('i-cb-6', 'salt', null, '', 'Pantry', 'to taste'),
    ],
    steps: [
      { id: 's-cb-1', text: 'Season and cook the chicken, then rest and slice.' },
      { id: 's-cb-2', text: 'Warm the rice, beans, and corn.' },
      { id: 's-cb-3', text: 'Build the bowls and add avocado just before serving.' },
    ],
    nutritionPerServing: nutrition(560, 44, 65, 14, 12, 610),
    sourceLabel: 'MyHub demo recipe',
  },
  {
    ...demoBase('recipe-oats'),
    name: 'High-Protein Overnight Oats',
    description: 'Creamy oats with Greek yogurt, berries, chia, and a touch of maple.',
    image: 'recipes/overnight-oats.jpg',
    category: 'Breakfast',
    tags: ['Quick', 'High Protein'],
    favorite: false,
    originalYield: 2,
    prepMinutes: 10,
    cookMinutes: 0,
    ingredients: [
      ingredient('i-oo-1', 'rolled oats', 1, 'cup', 'Pantry'),
      ingredient('i-oo-2', 'Greek yogurt', 1, 'cup', 'Dairy'),
      ingredient('i-oo-3', 'milk', 1, 'cup', 'Dairy'),
      ingredient('i-oo-4', 'blueberries', 1, 'cup', 'Produce'),
    ],
    steps: [
      { id: 's-oo-1', text: 'Stir oats, yogurt, milk, and chia together.' },
      { id: 's-oo-2', text: 'Chill overnight and top with berries in the morning.' },
    ],
    nutritionPerServing: nutrition(420, 29, 57, 9, 9, 180),
    sourceLabel: 'MyHub demo recipe',
  },
  {
    ...demoBase('recipe-pasta'),
    name: 'Weeknight Tomato Pasta',
    description: 'Rigatoni in a quick tomato-basil sauce with parmesan.',
    image: 'recipes/weekday-pasta.jpg',
    category: 'Dinner',
    tags: ['Quick'],
    favorite: false,
    originalYield: 4,
    prepMinutes: 10,
    cookMinutes: 20,
    ingredients: [
      ingredient('i-wp-1', 'rigatoni', 1, 'lb', 'Pantry'),
      ingredient('i-wp-2', 'tomato sauce', 24, 'oz', 'Pantry'),
      ingredient('i-wp-3', 'parmesan', 0.5, 'cup', 'Dairy'),
      ingredient('i-wp-4', 'fresh basil', 0.5, 'cup', 'Produce'),
    ],
    steps: [
      { id: 's-wp-1', text: 'Boil the pasta until al dente and reserve pasta water.' },
      { id: 's-wp-2', text: 'Simmer the sauce, toss with pasta, and finish with parmesan.' },
    ],
    nutritionPerServing: nutrition(510, 19, 82, 11, 7, 590),
    sourceLabel: 'MyHub demo recipe',
  },
  {
    ...demoBase('recipe-sandwich'),
    name: 'Breakfast Sandwich',
    description: 'Egg, turkey sausage, cheddar, and spinach on a toasted English muffin.',
    image: 'recipes/breakfast-sandwich.jpg',
    category: 'Breakfast',
    tags: ['Quick', 'High Protein'],
    favorite: true,
    originalYield: 1,
    prepMinutes: 5,
    cookMinutes: 10,
    ingredients: [
      ingredient('i-bs-1', 'English muffin', 1, 'each', 'Bakery'),
      ingredient('i-bs-2', 'egg', 1, 'each', 'Dairy'),
      ingredient('i-bs-3', 'turkey sausage', 1, 'each', 'Meat & Seafood'),
      ingredient('i-bs-4', 'cheddar', 1, 'oz', 'Dairy'),
      ingredient('i-bs-5', 'spinach', 1, 'cup', 'Produce'),
    ],
    steps: [
      { id: 's-bs-1', text: 'Toast the muffin and cook the sausage.' },
      { id: 's-bs-2', text: 'Cook the egg with spinach, add cheddar, and assemble.' },
    ],
    nutritionPerServing: nutrition(430, 31, 29, 21, 4, 690),
    sourceLabel: 'MyHub demo recipe',
  },
]

export const createDemoData = (today = new Date()): AppData => {
  const week = startOfWeek(today)
  const todayDate = toLocalDate(today)
  const tomorrow = toLocalDate(addDays(today, 1))
  const friday = toLocalDate(addDays(today, ((5 - today.getDay() + 7) % 7) || 7))

  return {
    schemaVersion: 1,
    seededAt: nowIso(),
    events: [
      { ...demoBase('event-fluid'), title: 'Fluid Mechanics', course: 'ME EN 321', date: todayDate, startTime: '09:00', endTime: '09:50', kind: 'event', sourceLabel: 'Sample schedule' },
      { ...demoBase('event-ceen'), title: 'CEEN 482', course: 'CE EN 482', date: todayDate, startTime: '11:00', endTime: '12:15', kind: 'event', sourceLabel: 'Sample schedule' },
      { ...demoBase('event-capstone'), title: 'Capstone Meeting', course: 'CAPSTONE', date: todayDate, startTime: '14:00', endTime: '15:00', kind: 'event', sourceLabel: 'Sample schedule' },
    ],
    assignments: [
      {
        ...demoBase('assignment-lab'), title: 'CEEN 482 Lab Report', course: 'CE EN 482', dueDate: tomorrow, dueTime: '23:59', priority: 'high', estimatedMinutes: 120, progress: 20, status: 'in-progress', notes: 'Finish figures, discussion, and final formatting.', sourceLabel: 'Sample data', subtasks: [
          { id: 'sub-lab-1', title: 'Finish figures', completed: true },
          { id: 'sub-lab-2', title: 'Write discussion', completed: false },
          { id: 'sub-lab-3', title: 'Proofread', completed: false },
        ],
      },
      {
        ...demoBase('assignment-thermo'), title: 'Thermodynamics Problem Set', course: 'ME EN 330', dueDate: friday, dueTime: '17:00', priority: 'medium', estimatedMinutes: 90, progress: 0, status: 'not-started', notes: 'Problems 4.18–4.26.', sourceLabel: 'Sample data', subtasks: [],
      },
    ],
    recipes,
    meals: [
      { ...demoBase('meal-breakfast'), date: todayDate, slot: 'breakfast', recipeId: 'recipe-oats', servings: 1, preparedServings: 2, consumedServings: 1 },
      { ...demoBase('meal-lunch'), date: todayDate, slot: 'lunch', recipeId: 'recipe-burrito', servings: 1, preparedServings: 4, consumedServings: 1 },
      { ...demoBase('meal-dinner'), date: todayDate, slot: 'dinner', recipeId: 'recipe-teriyaki', servings: 1, preparedServings: 4, consumedServings: 0 },
      { ...demoBase('meal-tomorrow-lunch'), date: toLocalDate(addDays(today, 1)), slot: 'lunch', recipeId: 'recipe-burrito', servings: 1, preparedServings: 0, consumedServings: 0 },
      { ...demoBase('meal-week-pasta'), date: toLocalDate(addDays(week, 4)), slot: 'dinner', recipeId: 'recipe-pasta', servings: 1, preparedServings: 0, consumedServings: 0 },
    ],
    foodLog: [
      { ...demoBase('log-oats'), date: todayDate, name: 'High-Protein Overnight Oats', servings: 1, nutritionSnapshot: nutrition(420, 29, 57, 9, 9, 180), origin: 'recipe' },
      { ...demoBase('log-yogurt'), date: todayDate, name: 'Greek yogurt', servings: 1, nutritionSnapshot: nutrition(130, 18, 8, 2, 0, 70), origin: 'packaged' },
    ],
    pantry: [
      { ...demoBase('pantry-rice'), name: 'Rice', canonicalName: 'rice', quantity: 1.5, unit: 'lb', category: 'Pantry', location: 'Pantry' },
      { ...demoBase('pantry-beans'), name: 'Black beans', canonicalName: 'black beans', quantity: 15, unit: 'oz', category: 'Pantry', location: 'Pantry' },
      { ...demoBase('pantry-yogurt'), name: 'Greek yogurt', canonicalName: 'greek yogurt', quantity: 2, unit: 'cup', category: 'Dairy', location: 'Refrigerator', expirationDate: toLocalDate(addDays(today, 7)) },
      { ...demoBase('pantry-spinach'), name: 'Spinach', canonicalName: 'spinach', quantity: 3, unit: 'cup', category: 'Produce', location: 'Refrigerator', expirationDate: toLocalDate(addDays(today, 4)) },
    ],
    activeGroceryList: null,
    groceryHistory: [],
    settings: {
      name: 'Avi',
      measurementSystem: 'us',
      appearance: 'light',
      nutritionTargets: nutrition(2400, 170, 280, 75, 30, 2300),
      study: { earliestTime: '15:30', latestTime: '21:30', defaultBlockMinutes: 45, breakMinutes: 15, maxBlockMinutes: 60 },
      groceryStaples: ['Milk', 'Eggs', 'Bread', 'Coffee', 'Fruit'],
      canvas: { feedUrl: '', status: 'not-configured' },
    },
  }
}
