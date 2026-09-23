import { expect, test, type Page } from '@playwright/test'
import { createTestFixtureData } from '../src/test/fixtures'
import type { AppData, GroceryItem } from '../src/domain/types'

const seedAppData = async (page: Page, data: AppData, route: string) => {
  await page.goto(route)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: route.includes('pantry') ? 'Pantry' : 'Grocery', exact: true })).toBeVisible()
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
}

const readAppData = async (page: Page): Promise<AppData> => page.evaluate(async () => {
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

const waitForStored = async (page: Page, predicate: (data: AppData) => boolean) => {
  await expect.poll(async () => predicate(await readAppData(page))).toBe(true)
}

const groceryItem = (id: string, name: string, change: Partial<GroceryItem> = {}): GroceryItem => {
  const timestamp = '2026-09-22T00:00:00.000Z'
  return {
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
    source: 'manual',
    name,
    canonicalName: name.toLowerCase(),
    quantity: 1,
    unit: 'each',
    category: 'Other',
    checked: false,
    sourceRecipeIds: [],
    pantryQuantity: 0,
    pantryDecision: 'none',
    ...change,
  }
}

test('pantry supports validated full-field CRUD and safe quantity controls', async ({ page }) => {
  await seedAppData(page, createTestFixtureData(), '/#/pantry')
  await expect(page.getByText('Rice', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Edit Rice' }).click()
  const editDialog = page.getByRole('dialog', { name: 'Edit pantry item' })
  await editDialog.getByLabel('Item name').fill('Brown rice')
  await editDialog.getByLabel('Quantity').fill('-1')
  await editDialog.getByLabel('Unit').selectOption('kg')
  await editDialog.getByLabel('Location').selectOption('Freezer')
  await editDialog.getByLabel('Category').selectOption('Frozen')
  await editDialog.getByLabel('Expiration date (optional)').fill('2026-12-31')
  await editDialog.getByLabel('Notes').fill('Sealed container')
  await editDialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(editDialog).toBeVisible()

  await editDialog.getByLabel('Quantity').fill('2')
  await editDialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Brown rice', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Decrease Brown rice' }).locator('xpath=ancestor::article')).toContainText('Freezer')
  await expect(page.getByText(/Sealed container/)).toBeVisible()

  await page.getByRole('button', { name: 'Decrease Brown rice' }).click()
  await page.getByRole('button', { name: 'Decrease Brown rice' }).click()
  await expect(page.getByRole('article').filter({ has: page.getByText('Brown rice', { exact: true }) }).locator('.quantity-adjuster > span')).toHaveText('0 kg')
  await expect(page.getByRole('button', { name: 'Decrease Brown rice' })).toBeDisabled()
  await page.getByRole('button', { name: 'Increase Brown rice' }).click()
  await waitForStored(page, (data) => data.pantry[0]?.quantity === 1 && data.pantry[0]?.notes === 'Sealed container')

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Remove Brown rice' }).click()
  await expect(page.getByRole('heading', { name: 'Your pantry is empty' })).toBeVisible()
  await waitForStored(page, (data) => data.pantry.length === 0)

  await page.getByRole('button', { name: 'Add your first item' }).click()
  const addDialog = page.getByRole('dialog', { name: 'Add pantry item' })
  await addDialog.getByLabel('Item name').fill('Apples')
  await addDialog.getByLabel('Quantity').fill('4')
  await addDialog.getByLabel('Unit').selectOption('each')
  await addDialog.getByLabel('Location').selectOption('Refrigerator')
  await addDialog.getByLabel('Category').selectOption('Produce')
  await addDialog.getByRole('button', { name: 'Add item' }).click()
  await expect(page.getByText('Apples', { exact: true })).toBeVisible()
  await waitForStored(page, (data) => data.pantry.some((item) => item.name === 'Apples' && item.quantity === 4 && item.location === 'Refrigerator'))
  await page.reload()
  await expect(page.getByText('Apples', { exact: true })).toBeVisible()
})

test('pantry check requires decisions, confirms staples, and supports full shopping-list editing', async ({ page }) => {
  const data = createTestFixtureData()
  data.settings.groceryCategories.push({ id: 'category-bulk', name: 'Bulk', sortOrder: 2.5, enabled: true })
  data.settings.groceryStaples = [
    { id: 'staple-soap', name: 'Dish soap', canonicalName: 'dish soap', quantity: 1, unit: 'each', category: 'Household', enabled: true },
    { id: 'staple-hidden', name: 'Hidden staple', canonicalName: 'hidden staple', quantity: 1, unit: 'each', category: 'Other', enabled: false },
  ]
  await seedAppData(page, data, '/#/grocery')
  await page.getByRole('button', { name: 'Generate from meal plan' }).click()

  await expect(page.getByRole('heading', { name: 'Suggested staples' })).toBeVisible()
  await expect(page.getByText('Hidden staple')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Build shopping list/ })).toBeDisabled()
  await page.getByRole('checkbox', { name: /Dish soap/ }).check()
  await page.getByRole('button', { name: 'Add 1 selected' }).click()
  await expect(page.getByRole('heading', { name: 'Dish soap', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Build shopping list/ })).toBeDisabled()
  const dishSoap = page.getByRole('heading', { name: 'Dish soap', exact: true }).locator('..').locator('..')
  await dishSoap.getByText('None', { exact: true }).click()

  const chicken = page.getByRole('heading', { name: 'chicken breast', exact: true }).locator('..').locator('..')
  await chicken.getByText('Enter amount', { exact: true }).click()
  await chicken.getByLabel('Amount on hand for chicken breast').fill('1')
  const rice = page.getByRole('heading', { name: 'rice', exact: true }).locator('..').locator('..')
  await rice.getByText('Use saved amount', { exact: true }).click()
  const beans = page.getByRole('heading', { name: 'black beans', exact: true }).locator('..').locator('..')
  await beans.getByText('I have enough', { exact: true }).click()
  for (const itemName of ['rolled oats', 'Greek yogurt']) {
    const item = page.getByRole('heading', { name: itemName, exact: true }).locator('..').locator('..')
    await item.getByText('None', { exact: true }).click()
  }
  await expect(page.getByRole('button', { name: /Build shopping list/ })).toBeEnabled()
  await page.getByRole('button', { name: /Build shopping list/ }).click()

  await expect(page.getByText('3 oz', { exact: true })).toBeVisible()
  await expect(page.getByText('black beans', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit rice' }).click()
  const editDialog = page.getByRole('dialog', { name: 'Edit rice' })
  await editDialog.getByLabel('Quantity').fill('2')
  await editDialog.getByLabel('Unit').selectOption('cup')
  await editDialog.getByLabel('Category').selectOption('Bulk')
  await editDialog.getByLabel('Note').fill('Brown rice if available')
  await editDialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('2 cup · Brown rice if available')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Bulk/ })).toBeVisible()

  await page.getByRole('button', { name: 'Add item' }).click()
  const addDialog = page.getByRole('dialog', { name: 'Add custom grocery item' })
  await addDialog.getByLabel('Item name').fill('Apples')
  await addDialog.getByLabel('Quantity').fill('4')
  await addDialog.getByLabel('Unit').selectOption('each')
  await addDialog.getByLabel('Category').selectOption('Produce')
  await addDialog.getByLabel('Note').fill('Honeycrisp')
  await addDialog.getByRole('button', { name: 'Add item' }).click()
  await expect(page.getByText('4 each · Honeycrisp')).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete Dish soap' }).click()
  await expect(page.getByText('Dish soap', { exact: true })).toHaveCount(0)
  const chickenPurchase = page.getByLabel('Mark chicken breast purchased')
  await chickenPurchase.focus()
  await chickenPurchase.press('Space')
  await expect(chickenPurchase).toBeChecked()
  const applesPurchase = page.getByLabel('Mark Apples purchased')
  await applesPurchase.focus()
  await applesPurchase.press('Space')
  await expect(applesPurchase).toBeChecked()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Clear completed' }).click()
  await expect(page.getByText('chicken breast', { exact: true })).toBeVisible()
  await waitForStored(page, (stored) => stored.activeGroceryList?.items.some((item) => item.note === 'Brown rice if available') === true)
})

test('completion adds only explicit selections, preserves history, and repeats into a new list', async ({ page }) => {
  const data = createTestFixtureData()
  data.activeGroceryList = {
    id: 'list-shopping',
    createdAt: '2026-09-22T00:00:00.000Z',
    updatedAt: '2026-09-22T00:00:00.000Z',
    source: 'manual',
    name: 'Campus market',
    status: 'shopping',
    items: [
      groceryItem('grocery-apples', 'Apples', { quantity: 4, category: 'Produce', checked: true }),
      groceryItem('grocery-milk', 'Milk', { quantity: 1, unit: 'L', category: 'Dairy', checked: false }),
      groceryItem('grocery-towels', 'Paper towels', { quantity: 2, category: 'Household', checked: false, note: 'Recycled' }),
    ],
  }
  await seedAppData(page, data, '/#/grocery')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Complete trip' }).click()
  await expect(page.getByRole('dialog', { name: 'Add purchases to Pantry?' })).toBeVisible()
  await page.getByRole('button', { name: 'Select items' }).click()

  await expect(page.getByLabel('Pantry quantity for Apples')).toBeEnabled()
  await page.getByRole('checkbox', { name: /Milk Not marked purchased/ }).check()
  await page.getByLabel('Pantry quantity for Milk').fill('2')
  await page.getByLabel('Pantry location for Milk').selectOption('Freezer')
  await page.getByRole('checkbox', { name: /Apples Marked purchased/ }).uncheck()
  await page.getByRole('button', { name: 'Add 1 selected' }).click()

  await expect(page.getByRole('heading', { name: 'No active grocery list' })).toBeVisible()
  await waitForStored(page, (stored) => {
    const milk = stored.pantry.find((item) => item.name === 'Milk')
    return milk?.quantity === 2
      && milk.location === 'Freezer'
      && !stored.pantry.some((item) => item.name === 'Apples')
      && !stored.pantry.some((item) => item.name === 'Paper towels')
      && stored.groceryHistory[0]?.items.length === 3
  })

  await page.getByRole('button', { name: /View Campus market completed/ }).click()
  const historyDialog = page.getByRole('dialog', { name: 'Campus market' })
  await expect(historyDialog.getByText('Recycled')).toBeVisible()
  await historyDialog.getByRole('button', { name: 'Copy to new list' }).click()
  await expect(page.getByRole('heading', { name: 'Campus market copy' })).toBeVisible()
  await expect(page.getByLabel('Mark Apples purchased')).not.toBeChecked()
  await page.getByRole('button', { name: 'Edit Paper towels' }).click()
  const editDialog = page.getByRole('dialog', { name: 'Edit Paper towels' })
  await editDialog.getByLabel('Note').fill('Changed only in repeat')
  await editDialog.getByRole('button', { name: 'Save changes' }).click()
  await waitForStored(page, (stored) => stored.groceryHistory[0]?.items.find((item) => item.name === 'Paper towels')?.note === 'Recycled')
})
