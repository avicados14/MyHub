import { expect, test } from '@playwright/test'

const waitForStoredCollectionSize = async (page: import('@playwright/test').Page, key: string, size: number) => {
  await expect.poll(() => page.evaluate(async ({ key, size }) => {
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
  }, { key, size })).toBe(true)
}

test('fresh install opens with empty personal collections', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)\./ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Today’s schedule' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your day is open' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No meals planned' })).toBeVisible()
  await expect(page.getByText('0 open assignments')).toBeVisible()
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
  await page.getByRole('dialog', { name: 'Add homework' }).getByRole('button', { name: 'Add homework', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Materials quiz review' })).toBeVisible()
  await page.getByRole('button', { name: 'Build my study plan' }).click()
  await expect(page.getByRole('heading', { name: 'Your study plan' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Materials quiz review' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Materials quiz review' })).toBeVisible()
})

test('user creates a recipe from an empty library', async ({ page }) => {
  await page.goto('/#/food')
  await expect(page.getByRole('heading', { name: 'No matching recipes' })).toBeVisible()
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
  await page.getByRole('dialog', { name: 'Add homework' }).getByRole('button', { name: 'Add homework', exact: true }).click()
  await page.goto('/#/settings')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Clear all data' }).click()
  await waitForStoredCollectionSize(page, 'assignments', 0)
  await page.goto('/#/school')
  await expect(page.getByRole('heading', { name: 'Temporary assignment' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Homework is clear' })).toBeVisible()
})
