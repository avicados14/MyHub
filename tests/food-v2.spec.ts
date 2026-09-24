import { expect, test, type Page } from '@playwright/test'
import { createTestFixtureData } from '../src/test/fixtures'
import type { AppData, PackagedFood } from '../src/domain/types'

const seedAppData = async (page: Page, data: AppData, route: string) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.evaluate(async (state) => {
    const request = indexedDB.open('myhub-local', 2)
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onupgradeneeded = () => {
        const next = request.result
        if (!next.objectStoreNames.contains('application')) next.createObjectStore('application')
        if (!next.objectStoreNames.contains('credentials')) next.createObjectStore('credentials')
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('application', 'readwrite')
      transaction.objectStore('application').put(state, 'state')
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  }, data)
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.goto(route)
  await page.waitForLoadState('networkidle')
}

const readAppData = async (page: Page): Promise<AppData> =>
  page.evaluate(async () => {
    const request = indexedDB.open('myhub-local', 2)
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const state = await new Promise<AppData>((resolve, reject) => {
      const get = database.transaction('application', 'readonly').objectStore('application').get('state')
      get.onsuccess = () => resolve(get.result as AppData)
      get.onerror = () => reject(get.error)
    })
    database.close()
    return state
  })

const riceSource = (timestamp: string): PackagedFood => ({
  id: 'package-rice',
  createdAt: timestamp,
  updatedAt: timestamp,
  source: 'imported',
  name: 'rice',
  brand: 'Test source',
  barcode: '12345678',
  servingSize: { quantity: 1, unit: 'cup' },
  nutritionPerServing: { calories: 100, protein: 4, carbs: 20, fat: 1, fiber: 2, sodium: 10 },
  nutritionProvenance: {
    kind: 'database',
    capturedAt: timestamp,
    estimated: true,
    sourceLabel: 'Open Food Facts (read-only import)',
  },
})

test.describe('food v2 workflows', () => {
  test('creates and edits a structured recipe with a visible review workflow', async ({ page }) => {
    await page.goto('/#/food')
    await expect(page.getByRole('heading', { name: 'Your recipe shelf is ready' })).toBeVisible()
    await page.getByRole('button', { name: 'Add recipe' }).first().click()
    await page.getByLabel('Recipe name').fill('Lemon chickpea bowls')
    await page.getByLabel('Description').fill('A quick weeknight bowl.')
    await page.getByLabel('Source label', { exact: true }).fill('Family notebook')
    await page.getByLabel('Tags').fill('Quick, Vegetarian')
    await page.getByLabel('Ingredients', { exact: true }).fill('2 cup chickpeas\n1 cup rice\nsalt to taste')
    await page.getByLabel('Steps', { exact: true }).fill('Cook the rice.\nAssemble the bowls.')
    await page.getByRole('button', { name: 'Save recipe' }).click()
    await expect(page.getByRole('heading', { name: 'Lemon chickpea bowls' })).toBeVisible()
    await page.getByRole('button', { name: 'Edit' }).click()
    const editor = page.getByRole('dialog', { name: 'Edit Lemon chickpea bowls' })
    await expect(editor).toBeVisible()
    await editor.getByLabel('Notes', { exact: true }).fill('Finish with lemon zest.')
    await editor.getByRole('button', { name: 'Save changes' }).click()
    await page.getByRole('heading', { name: 'Lemon chickpea bowls' }).click()
    await expect(page.getByRole('heading', { name: 'Lemon chickpea bowls' })).toBeVisible()
    await expect(page.locator('.recipe-notes p')).toHaveText('Finish with lemon zest.')
  })

  test('pasted import becomes a Needs Review draft and can be corrected', async ({ page }) => {
    await page.goto('/#/food')
    await page.getByRole('button', { name: 'Import recipe' }).click()
    await page.getByText('Paste', { exact: true }).click()
    await page
      .getByLabel('JSON-LD, HTML, text, or caption')
      .fill('Toast and eggs\nIngredients\n2 each eggs\nsalt to taste\nInstructions\nToast bread.\nCook eggs.')
    await page.getByRole('button', { name: 'Parse pasted content' }).click()
    await expect(page.getByText('Needs Review', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Open review draft' }).click()
    const editor = page.getByRole('dialog', { name: 'Edit Toast and eggs' })
    await expect(editor.getByText('Needs review', { exact: true })).toBeVisible()
    await editor.getByRole('button', { name: 'Mark reviewed' }).click()
    await editor.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { name: 'Toast and eggs' })).toBeVisible()
  })

  test('planned nutrition is excluded until consumed servings are entered', async ({ page }) => {
    await page.goto('/#/food')
    await page.getByRole('button', { name: 'Add recipe' }).first().click()
    const recipeEditor = page.getByRole('dialog', { name: 'Create a recipe' })
    await recipeEditor.getByLabel('Recipe name').fill('Protein toast')
    await recipeEditor.getByLabel('Ingredients', { exact: true }).fill('2 each eggs')
    await recipeEditor.getByLabel('Steps', { exact: true }).fill('Cook and serve.')
    await recipeEditor.getByLabel('Calories (kcal)').fill('400')
    await recipeEditor.getByLabel('Protein (g)').fill('24')
    await recipeEditor.getByRole('button', { name: 'Save recipe' }).click()
    await page.getByText('Meal planner', { exact: true }).click()
    await page.locator('.meal-day.is-today').getByRole('button', { name: 'Add', exact: true }).first().click()
    const mealEditor = page.getByRole('dialog', { name: 'Plan breakfast' })
    await mealEditor.getByLabel('Saved recipe').selectOption({ label: 'Protein toast' })
    await mealEditor.getByLabel('Servings prepared').fill('3')
    await mealEditor.getByRole('button', { name: 'Plan meal' }).click()
    await page.getByText('Nutrition', { exact: true }).click()
    const consumedSummary = page.locator('.nutrition-summary__lead')
    await expect(consumedSummary.getByText('0 kcal')).toBeVisible()
    await page.getByText('Meal planner', { exact: true }).click()
    await page.locator('.meal-day.is-today').getByLabel('Consumed servings for Protein toast').fill('1.5')
    await page.getByText('Nutrition', { exact: true }).click()
    await expect(consumedSummary.getByText('600 kcal')).toBeVisible()
    await page.getByText('Meal planner', { exact: true }).click()
    await expect(page.getByText(/1.5 batch servings left/u)).toHaveCount(3)
    await expect(page.getByRole('heading', { name: 'Leftovers' })).toBeVisible()
  })

  test('searches Open Food Facts text without live network and reuses explicit package confirmation', async ({
    page,
  }) => {
    await page.route('https://world.openfoodfacts.org/cgi/search.pl?**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          products: [
            {
              code: '12345678',
              product_name: 'Crunchy peanut butter',
              brands: 'Example Foods',
              serving_size: '32 g',
              nutriments: {
                'energy-kcal_serving': 190,
                proteins_serving: 7,
                carbohydrates_serving: 8,
                fat_serving: 16,
                fiber_serving: 2,
                sodium_serving: 0.14,
              },
            },
          ],
        }),
      })
    })
    await page.goto('/#/food?view=packages')
    await page.getByRole('button', { name: 'Add packaged food' }).first().click()
    const editor = page.getByRole('dialog', { name: 'Add packaged food' })
    await editor.getByText('Text search', { exact: true }).click()
    await expect(editor.getByText(/public, volunteer database/)).toBeVisible()
    await editor.getByLabel('Product or brand').fill('peanut butter')
    await editor.getByRole('button', { name: 'Search products' }).click()
    await expect(editor.getByText('Crunchy peanut butter', { exact: true })).toBeVisible()
    expect((await readAppData(page)).packagedFoods).toEqual([])
    await editor.getByRole('button', { name: 'Review this result' }).click()
    await expect(editor.getByLabel('Product name')).toHaveValue('Crunchy peanut butter')
    await editor.getByRole('button', { name: 'Save packaged food' }).click()
    await expect(editor.getByRole('alert')).toContainText('Confirm that you reviewed')
    await editor.getByText('I compared the imported values with the package label.').click()
    await editor.getByRole('button', { name: 'Save packaged food' }).click()
    await expect(page.getByRole('heading', { name: 'Crunchy peanut butter' })).toBeVisible()

    await page.getByText('Nutrition', { exact: true }).click()
    await page.getByRole('button', { name: 'Log food' }).click()
    const logEditor = page.getByRole('dialog', { name: 'Log food' })
    await logEditor.getByText('Barcode/Search', { exact: true }).click()
    await logEditor.getByLabel('Barcode or food name').fill('peanut butter')
    await logEditor.getByRole('button', { name: 'Search Open Food Facts' }).click()
    await logEditor.getByRole('button', { name: /Crunchy peanut butter/ }).click()
    await expect(logEditor.getByLabel('Food name', { exact: true })).toHaveValue('Crunchy peanut butter')
    await logEditor.getByText('I reviewed the values.').click()
    await logEditor.getByRole('button', { name: 'Log consumed food', exact: true }).click()
    await expect.poll(async () => (await readAppData(page)).foodLog.at(-1)?.name).toBe('Crunchy peanut butter')
  })

  test('reviews transparent ingredient nutrition estimation, keeps unresolved items, and permits correction', async ({
    page,
  }) => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    data.packagedFoods = [riceSource(data.initializedAt)]
    await seedAppData(page, data, '/#/food/recipes/recipe-burrito')
    await page.getByRole('button', { name: 'Edit recipe' }).click()
    const editor = page.getByRole('dialog', { name: 'Edit Chicken Burrito Bowls' })
    await editor.getByRole('button', { name: 'Estimate from ingredients' }).click()
    await expect(editor.getByText('3 unresolved · 1 source labels')).toBeVisible()
    await expect(editor.getByText('Quantity is unresolved.')).toBeVisible()
    await expect(editor.getByText('Estimated per serving: 50 kcal')).toBeVisible()
    await editor.getByText('I reviewed these source mappings and serving amounts.').click()
    await editor.getByRole('button', { name: 'Apply reviewed estimate' }).click()
    await expect(editor.getByText('Needs review', { exact: true })).toBeVisible()
    await editor.getByLabel('Calories (kcal)').fill('55')
    await editor.getByRole('button', { name: 'Mark reviewed' }).click()
    await editor.getByLabel('Original yield').fill('4')
    await editor.getByLabel('Current yield').fill('4')
    await editor.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('55 kcal', { exact: true })).toBeVisible()
    const stored = await readAppData(page)
    const recipe = stored.recipes.find((item) => item.id === 'recipe-burrito')
    expect(recipe?.nutritionPerServing.calories).toBe(55)
    expect(recipe?.nutritionProvenance).toEqual(
      expect.objectContaining({
        kind: 'estimated',
        estimated: true,
        sourceLabel: expect.stringContaining('Open Food Facts'),
      }),
    )
  })

  test('prepared batches populate future days and decrease together as servings are eaten', async ({ page }) => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    data.meals = []
    data.leftovers = []
    data.foodLog = []
    await seedAppData(page, data, '/#/food/recipes/recipe-burrito')
    await page.getByRole('button', { name: 'Add to meal plan' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add to meal plan' })
    await dialog.getByLabel('Date').fill('2026-09-22')
    await dialog.getByLabel('Planned servings', { exact: true }).fill('1')
    await dialog.getByLabel('Prepared servings', { exact: true }).fill('4')
    await expect(dialog.getByText('Plan extra portions on future days')).toBeVisible()
    await dialog.getByRole('button', { name: 'Add to plan' }).click()
    await expect
      .poll(async () => {
        const stored = await readAppData(page)
        const meal = stored.meals.find((item) => item.date === '2026-09-22' && item.slot === 'dinner')
        const leftover = stored.leftovers.find((item) => item.sourceMealId === meal?.id)
        const futureDates = stored.meals
          .filter((item) => item.autoPlannedFromMealId === meal?.id)
          .map((item) => item.date)
          .sort()
        return { consumed: meal?.consumedServings, remaining: leftover?.servingsRemaining, futureDates }
      })
      .toEqual({ consumed: 0, remaining: 4, futureDates: ['2026-09-23', '2026-09-24', '2026-09-25'] })

    await page.goto('/#/food?view=planner')
    await expect(page.getByText(/4 batch servings left/u)).toHaveCount(4)
    const tuesday = page.locator('.meal-day').filter({ has: page.getByText('Tue', { exact: true }) })
    await tuesday.getByLabel('Consumed servings for Chicken Burrito Bowls').fill('1')
    await expect(page.getByText(/3 batch servings left/u)).toHaveCount(4)
    const wednesday = page.locator('.meal-day').filter({ has: page.getByText('Wed', { exact: true }) })
    await wednesday.getByLabel('Consumed servings for Chicken Burrito Bowls').fill('1')
    await expect(page.getByText(/2 batch servings left/u)).toHaveCount(4)
    await expect(page.getByText(/2 servings left · 2 future days linked/u)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next week' })).toBeVisible()
  })

  test('planner meal editor schedules extra prepared portions by default', async ({ page }) => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    data.meals = []
    data.leftovers = []
    data.foodLog = []
    await seedAppData(page, data, '/#/food?view=planner')

    const tuesday = page.locator('.meal-day').filter({ has: page.getByText('Tue', { exact: true }) })
    const dinner = tuesday.locator('.meal-slot').filter({ has: page.getByText('dinner', { exact: true }) })
    await dinner.getByRole('button', { name: 'Add' }).click()
    const editor = page.getByRole('dialog', { name: 'Plan dinner' })
    await editor.getByLabel('Saved recipe').selectOption('recipe-burrito')
    await editor.getByLabel('Servings planned').fill('1')
    await editor.getByLabel('Servings prepared').fill('3')
    await expect(editor.getByRole('checkbox', { name: /Plan extra portions on future days/u })).toBeChecked()
    await editor.getByRole('button', { name: 'Plan meal' }).click()

    await expect(page.getByText(/3 batch servings left/u)).toHaveCount(3)
    await expect
      .poll(async () => {
        const stored = await readAppData(page)
        const source = stored.meals.find((meal) => meal.date === '2026-09-22' && meal.slot === 'dinner')
        return stored.meals.filter((meal) => meal.autoPlannedFromMealId === source?.id).map((meal) => meal.date)
      })
      .toEqual(['2026-09-23', '2026-09-24'])
  })

  test('manually added batch days repair and display one shared remaining balance', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 8, 24, 12))
    const data = createTestFixtureData(new Date(2026, 8, 24, 12))
    const source = {
      ...data.meals[0]!,
      id: 'meal-source',
      date: '2026-09-21',
      slot: 'breakfast' as const,
      servings: 12,
      preparedServings: 12,
      consumedServings: 2,
    }
    const secondDay = {
      ...source,
      id: 'meal-second-day',
      date: '2026-09-22',
      servings: 2,
      preparedServings: 10,
      consumedServings: 2,
    }
    const leftover = {
      id: 'leftover-second-day',
      createdAt: data.initializedAt,
      updatedAt: data.initializedAt,
      source: 'generated' as const,
      sourceMealId: secondDay.id,
      sourceSnapshot: secondDay.sourceSnapshot,
      preparedOn: secondDay.date,
      servingsRemaining: 10,
      storageLocation: 'Refrigerator' as const,
    }
    const selfLinkedSecondDay = {
      ...secondDay,
      recipeId: undefined,
      leftoverId: leftover.id,
      sourceSnapshot: {
        ...leftover.sourceSnapshot,
        sourceType: 'leftover' as const,
        sourceId: leftover.id,
      },
    }
    data.meals = [source, selfLinkedSecondDay]
    data.leftovers = [leftover]
    data.foodLog = []
    await seedAppData(page, data, '/#/food?view=planner')

    await expect(page.getByText(/8 batch servings left/u)).toHaveCount(2)
    await expect(page.getByText(/8 servings left · 0 future days linked/u)).toBeVisible()
    await expect
      .poll(async () => {
        const stored = await readAppData(page)
        const storedSecondDay = stored.meals.find((meal) => meal.id === secondDay.id)
        const storedLeftover = stored.leftovers.find((item) => item.id === leftover.id)
        return {
          remaining: storedLeftover?.servingsRemaining,
          sourceMealId: storedLeftover?.sourceMealId,
          preparedOn: storedLeftover?.preparedOn,
          secondDayLeftoverId: storedSecondDay?.leftoverId,
          secondDayRecipeId: storedSecondDay?.recipeId,
        }
      })
      .toEqual({
        remaining: 8,
        sourceMealId: source.id,
        preparedOn: source.date,
        secondDayLeftoverId: leftover.id,
        secondDayRecipeId: undefined,
      })
  })

  test('regenerates slots, days, and weeks while preserving temporary suggestion locks', async ({ page }) => {
    const data = createTestFixtureData(new Date(2026, 8, 22))
    data.meals = []
    data.foodLog = []
    data.recipes = data.recipes.map((recipe) => ({ ...recipe, needsReview: true }))
    await seedAppData(page, data, '/#/food?view=planner')
    const suggestion = page.locator('.suggestion-list article').first()
    await expect(suggestion.getByText('Recipe details are marked for review')).toBeVisible()
    const initial = await suggestion.locator('strong').innerText()
    await suggestion.getByRole('button', { name: /Lock suggestion/ }).click()
    await page.getByRole('button', { name: 'Regenerate week' }).click()
    await expect(suggestion.locator('strong')).toHaveText(initial)
    await suggestion.getByRole('button', { name: /Unlock suggestion/ }).click()
    await suggestion.getByRole('button', { name: 'Replace slot' }).click()
    await expect(suggestion.locator('strong')).not.toHaveText(initial)
    await expect(suggestion.getByRole('button', { name: 'Regenerate day' })).toBeVisible()
  })
})
