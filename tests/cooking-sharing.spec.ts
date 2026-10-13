import { expect, test, type Page } from '@playwright/test'
import { createTestFixtureData } from '../src/test/fixtures'
import type { AppData } from '../src/domain/types'

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

test('cooking mode scales ingredients, navigates steps and leaves recipe data unchanged', async ({ page }) => {
  const data = createTestFixtureData()
  data.recipes[0]!.steps = [
    { id: 'one', text: 'Prepare the rice.' },
    { id: 'two', text: 'Cook the steak.' },
  ]
  await seedAppData(page, data, '/#/food/recipes/recipe-teriyaki/cook?servings=8')
  await expect(page.getByRole('heading', { name: 'Teriyaki Steak Bowls' })).toBeVisible()
  await expect(page.getByLabel('Cooking servings')).toHaveValue('8')
  await expect(page.locator('.cooking-ingredients')).toContainText('steak — 3 lb')
  await page.locator('.cooking-ingredients input').first().check()
  await page.getByRole('button', { name: 'Next step' }).click()
  await expect(page.locator('.cooking-instruction')).toHaveText('Cook the steak.')
  await expect(page.getByRole('button', { name: 'Next step' })).toBeDisabled()
  await page.getByRole('button', { name: 'Previous step' }).click()
  await expect(page.locator('.cooking-instruction')).toHaveText('Prepare the rice.')
  await page.getByRole('link', { name: 'Exit cooking mode' }).click()
  await expect(page.locator('.yield-stepper strong')).toHaveText('4')
  await page.getByRole('link', { name: 'Start cooking' }).click()
  await expect(page.locator('.cooking-ingredients input').first()).not.toBeChecked()
})

test('grocery sharing previews purchase quantities and prepares encoded drafts', async ({ page }) => {
  const data = createTestFixtureData()
  data.activeGroceryList = {
    id: 'share-list',
    createdAt: '',
    updatedAt: '',
    source: 'manual',
    name: 'Meals & groceries',
    status: 'shopping',
    items: [
      {
        id: 'rice',
        createdAt: '',
        updatedAt: '',
        source: 'manual',
        name: 'Rice & beans',
        canonicalName: 'rice',
        quantity: 3,
        unit: 'cup',
        category: 'Pantry',
        checked: false,
        sourceRecipeIds: [],
        pantryQuantity: 0,
        pantryDecision: 'none',
      },
      {
        id: 'milk',
        createdAt: '',
        updatedAt: '',
        source: 'manual',
        name: 'Milk',
        canonicalName: 'milk',
        quantity: 1,
        unit: 'cup',
        category: 'Dairy',
        checked: true,
        sourceRecipeIds: [],
        pantryQuantity: 0,
        pantryDecision: 'none',
      },
    ],
  }
  await seedAppData(page, data, '/#/grocery')
  await page.getByRole('button', { name: 'Share grocery list' }).click()
  const preview = page.getByLabel('Grocery list preview')
  await expect(preview).toHaveValue(/Rice & beans — 3 cup/)
  await expect(preview).not.toHaveValue(/Milk/)
  const email = await page.getByRole('link', { name: 'Email list' }).getAttribute('href')
  expect(new URL(email!).searchParams.get('body')).toBe(await preview.inputValue())
  await expect(page.getByRole('link', { name: 'Text list' })).toHaveAttribute('href', /^sms:/)
  await page.getByLabel('Include purchased items').check()
  await expect(preview).toHaveValue(/\[x\] Milk/)
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    }),
  )
  await page.getByRole('button', { name: 'Copy list' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Copy is unavailable' })).toBeVisible()
})
