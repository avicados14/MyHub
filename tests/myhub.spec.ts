import { expect, test } from '@playwright/test'

const resetIndexedDb = async (page: import('@playwright/test').Page) => {
  await page.goto('/')
  await page.evaluate(() => {
    const request = indexedDB.open('myhub-local', 2)
    return new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction(['application', 'credentials'], 'readwrite')
        transaction.objectStore('application').clear()
        transaction.objectStore('credentials').clear()
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
        transaction.onerror = () => reject(transaction.error)
      }
      request.onerror = () => reject(request.error)
    })
  })
  await page.reload()
  await page.waitForLoadState('networkidle')
}

test.beforeEach(async ({ page }) => {
  await resetIndexedDb(page)
})

const waitForStoredCollectionSize = async (page: import('@playwright/test').Page, key: string, size: number) => {
  await expect
    .poll(() =>
      page.evaluate(
        async ({ key, size }) => {
          const request = indexedDB.open('myhub-local', 2)
          const database = await new Promise<IDBDatabase>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })
          const transaction = database.transaction('application', 'readonly')
          const get = transaction.objectStore('application').get('state')
          const state = await new Promise<Record<string, unknown>>((resolve, reject) => {
            get.onsuccess = () => resolve(get.result as Record<string, unknown>)
            get.onerror = () => reject(get.error)
          })
          database.close()
          return Array.isArray(state?.[key]) ? state[key].length === size : false
        },
        { key, size },
      ),
    )
    .toBe(true)
}

const waitForStoredRecord = async (
  page: import('@playwright/test').Page,
  collection: string,
  fields: Record<string, string | number | boolean>,
) => {
  await expect
    .poll(() =>
      page.evaluate(
        async ({ collection, fields }) => {
          const request = indexedDB.open('myhub-local', 2)
          const database = await new Promise<IDBDatabase>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })
          const transaction = database.transaction('application', 'readonly')
          const get = transaction.objectStore('application').get('state')
          const state = await new Promise<Record<string, unknown>>((resolve, reject) => {
            get.onsuccess = () => resolve(get.result as Record<string, unknown>)
            get.onerror = () => reject(get.error)
          })
          database.close()
          const records = state?.[collection]
          return (
            Array.isArray(records) &&
            records.some(
              (record) =>
                typeof record === 'object' &&
                record !== null &&
                Object.entries(fields).every(([key, value]) => (record as Record<string, unknown>)[key] === value),
            )
          )
        },
        { collection, fields },
      ),
    )
    .toBe(true)
}

const waitForStoredStaple = async (page: import('@playwright/test').Page, name: string, enabled: boolean) => {
  await expect
    .poll(() =>
      page.evaluate(
        async ({ name, enabled }) => {
          const request = indexedDB.open('myhub-local', 2)
          const database = await new Promise<IDBDatabase>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })
          const transaction = database.transaction('application', 'readonly')
          const get = transaction.objectStore('application').get('state')
          const state = await new Promise<{
            settings?: { groceryStaples?: Array<{ name: string; enabled: boolean }> }
          }>((resolve, reject) => {
            get.onsuccess = () => resolve(get.result)
            get.onerror = () => reject(get.error)
          })
          database.close()
          return (
            state.settings?.groceryStaples?.some((staple) => staple.name === name && staple.enabled === enabled) ??
            false
          )
        },
        { name, enabled },
      ),
    )
    .toBe(true)
}

test('fresh install opens with empty personal collections', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)\./ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Today’s schedule' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your day is open' })).toBeVisible()
  for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
    await expect(page.getByRole('link', { name: `Plan ${slot}` })).toBeVisible()
  }
  await expect(page.getByText('0 assignments due')).toBeVisible()
  await expect(page.getByText('0 ingredients tracked at home')).toBeVisible()
})

test('user adds homework and generates study sessions', async ({ page }) => {
  await page.goto('/#/school')
  await page.getByRole('button', { name: 'Add homework' }).click()
  await page.getByLabel('Assignment title').fill('Materials quiz review')
  await page.getByLabel('Course').fill('CE EN 350')
  const due = new Date()
  due.setDate(due.getDate() + 3)
  await page.getByLabel('Due date').fill(due.toISOString().slice(0, 10))
  await page.getByLabel('Estimated minutes').fill('45')
  await page
    .getByRole('dialog', { name: 'Add homework' })
    .getByRole('button', { name: 'Add homework', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Materials quiz review' })).toBeVisible()
  await page.getByRole('button', { name: 'Build my study plan' }).click()
  await expect(page.getByRole('heading', { name: 'Your study plan' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Materials quiz review' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Materials quiz review' })).toBeVisible()
})

test('user creates a recipe from an empty library', async ({ page }) => {
  await page.goto('/#/food')
  await expect(page.getByRole('heading', { name: 'Your recipe shelf is ready' })).toBeVisible()
  await page.getByRole('button', { name: 'Add recipe' }).click()
  await page.getByLabel('Recipe name').fill('Lemon chickpea bowls')
  await page.getByLabel('Description').fill('A quick weeknight bowl.')
  await page.getByLabel('Ingredients').fill('2 cup chickpeas\n1 cup rice')
  await page.getByLabel('Steps').fill('Cook the rice.\nAssemble the bowls.')
  await page.getByRole('button', { name: 'Save recipe' }).click()
  await expect(page.getByRole('heading', { name: 'Lemon chickpea bowls' })).toBeVisible()
  await waitForStoredCollectionSize(page, 'recipes', 1)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Lemon chickpea bowls' })).toBeVisible()
})

test('clear all data requires confirmation and restores an empty install', async ({ page }) => {
  await page.goto('/#/school')
  await page.getByRole('button', { name: 'Add homework' }).click()
  await page.getByLabel('Assignment title').fill('Temporary assignment')
  await page.getByLabel('Course').fill('TEST 101')
  await page
    .getByRole('dialog', { name: 'Add homework' })
    .getByRole('button', { name: 'Add homework', exact: true })
    .click()
  await page.goto('/#/settings')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Clear all data' }).click()
  await waitForStoredCollectionSize(page, 'assignments', 0)
  await page.goto('/#/school')
  await expect(page.getByRole('heading', { name: 'Temporary assignment' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Homework is clear' })).toBeVisible()
})

test('settings controls are labeled and persist configuration changes', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByLabel('Appearance').selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.getByRole('button', { name: 'Add time range' }).click()
  const avoidTime = page
    .getByRole('article')
    .filter({ has: page.getByLabel('Label') })
    .last()
  await avoidTime.getByLabel('Label').fill('Lab')
  await avoidTime.getByLabel('Starts').fill('14:00')
  await avoidTime.getByLabel('Ends').fill('16:00')

  await page.getByLabel('Staple name').fill('Tahini')
  await page.getByRole('button', { name: 'Add staple' }).click()
  await expect(page.getByLabel('Enable Tahini')).toBeChecked()
  await page.getByLabel('Enable Tahini').uncheck()

  await waitForStoredStaple(page, 'Tahini', false)
  await page.reload()
  await expect(page.getByLabel('Appearance')).toHaveValue('dark')
  await expect(page.getByLabel('Label')).toHaveValue('Lab')
  await expect(page.getByLabel('Starts')).toHaveValue('14:00')
  await expect(page.getByLabel('Enable Tahini')).not.toBeChecked()
})

test('connected empty-to-history journey persists across reload', async ({ page }) => {
  const assignmentTitle = 'Connected systems review'
  const recipeName = 'Chickpea rice bowls'
  const due = new Date()
  due.setDate(due.getDate() + 3)

  await page.goto('/#/school')
  await page.getByRole('button', { name: 'Add homework' }).click()
  await page.getByLabel('Assignment title').fill(assignmentTitle)
  await page.getByLabel('Course').fill('MYHUB 201')
  await page.getByLabel('Due date').fill(due.toISOString().slice(0, 10))
  await page.getByLabel('Estimated minutes').fill('45')
  await page
    .getByRole('dialog', { name: 'Add homework' })
    .getByRole('button', { name: 'Add homework', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: assignmentTitle })).toBeVisible()

  await page.getByRole('button', { name: 'Build my study plan' }).click()
  await expect(page.getByRole('heading', { name: 'Your study plan' })).toBeVisible()
  await expect(page.getByRole('heading', { name: assignmentTitle })).toBeVisible()
  await waitForStoredRecord(page, 'events', { title: assignmentTitle, kind: 'study' })

  await page.goto('/#/calendar?view=week')
  await page
    .getByRole('button', { name: new RegExp(`Edit study block ${assignmentTitle}`) })
    .first()
    .click()
  const moveDialog = page.getByRole('dialog', { name: 'Edit study block' })
  await moveDialog.getByLabel('Starts').fill('10:00')
  await moveDialog.getByLabel('Ends').fill('10:45')
  await moveDialog.getByLabel('Lock this time').check()
  await moveDialog.getByRole('button', { name: 'Save changes' }).click()
  await waitForStoredRecord(page, 'events', { title: assignmentTitle, kind: 'study', userAdjusted: true, locked: true })
  await page.goto('/#/school?view=planner')
  await expect(page.getByText('MYHUB 201 · Manually adjusted')).toBeVisible()

  await page.goto('/#/food')
  await page.getByRole('button', { name: 'Add recipe' }).click()
  await page.getByLabel('Recipe name').fill(recipeName)
  await page.getByLabel('Description').fill('A complete acceptance-flow dinner.')
  await page.getByLabel('Ingredients').fill('2 cup chickpeas\n1 cup rice')
  await page.getByLabel('Steps').fill('Cook the rice.\nAssemble the bowls.')
  await page.getByRole('button', { name: 'Save recipe' }).click()
  await page.getByRole('heading', { name: recipeName }).click()

  const servingControl = page.getByLabel('Recipe servings')
  await expect(servingControl.getByText('4', { exact: true })).toBeVisible()
  await servingControl.getByRole('button', { name: 'Increase servings' }).click()
  await expect(servingControl.getByText('5', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Add to meal plan' }).click()
  const planDialog = page.getByRole('dialog', { name: 'Add to meal plan' })
  await planDialog.getByRole('combobox', { name: 'Meal', exact: true }).selectOption('dinner')
  await planDialog.getByRole('spinbutton', { name: 'Servings to eat', exact: true }).fill('2')
  await planDialog.getByRole('spinbutton', { name: 'Prepared servings', exact: true }).fill('5')
  await planDialog.getByRole('button', { name: 'Add to plan' }).click()

  await waitForStoredCollectionSize(page, 'meals', 1)
  await page.goto('/')
  const dashboardMeal = page.locator('.meal-card').filter({ hasText: recipeName })
  await expect(dashboardMeal).toBeVisible()
  await expect(dashboardMeal.locator('img')).toHaveCount(0)
  await expect(dashboardMeal.locator('.meal-card__placeholder')).toBeVisible()

  await page.goto('/#/food?view=nutrition')
  await page.getByRole('button', { name: 'Log food' }).click()
  const logDialog = page.getByRole('dialog', { name: 'Log food' })
  await logDialog.getByRole('combobox', { name: 'Saved recipe', exact: true }).selectOption({ label: recipeName })
  await logDialog.getByRole('spinbutton', { name: 'Servings consumed', exact: true }).fill('1')
  await logDialog.getByRole('button', { name: 'Log consumed food', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Food log' })).toBeVisible()
  await expect(page.locator('.food-log-list').getByText(recipeName)).toBeVisible()

  await page.goto('/#/grocery')
  await page.getByRole('button', { name: 'Generate from meal plan' }).click()
  await expect(page.getByRole('heading', { name: 'Check pantry amounts and staples.' })).toBeVisible()
  const pantryRows = page.locator('.pantry-check-row')
  await expect(pantryRows).toHaveCount(2)
  for (const row of await pantryRows.all()) await row.getByLabel(/None/).check()
  await page.getByRole('button', { name: 'Build shopping list' }).click()

  const groceryChecks = page.locator('.grocery-check')
  await expect(groceryChecks).toHaveCount(2)
  for (const row of await groceryChecks.all()) await row.click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Complete trip' }).click()

  const pantryDialog = page.getByRole('dialog', { name: 'Add purchases to Pantry?' })
  await expect(pantryDialog).toBeVisible()
  await pantryDialog.getByRole('button', { name: /Skip/ }).click()
  await expect(page.getByRole('heading', { name: 'Grocery history' })).toBeVisible()
  await expect(page.getByText('Weekly groceries')).toBeVisible()
  await expect(page.getByText('Completed', { exact: true })).toBeVisible()

  await waitForStoredCollectionSize(page, 'assignments', 1)
  await waitForStoredCollectionSize(page, 'recipes', 1)
  await waitForStoredCollectionSize(page, 'meals', 1)
  await waitForStoredCollectionSize(page, 'foodLog', 1)
  await waitForStoredCollectionSize(page, 'groceryHistory', 1)
  await page.reload()
  await expect(page.getByText('Weekly groceries')).toBeVisible()
  await page.goto('/#/school?view=planner')
  await expect(page.getByText('MYHUB 201 · Manually adjusted')).toBeVisible()
  await page.goto('/#/food?view=nutrition')
  await expect(page.locator('.food-log-list').getByText(recipeName)).toBeVisible()
})
