import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const routes = [
  ['Home', '/'],
  ['Calendar', '/#/calendar'],
  ['School', '/#/school'],
  ['Food', '/#/food'],
  ['Pantry', '/#/pantry'],
  ['Grocery', '/#/grocery'],
  ['Settings', '/#/settings'],
  ['Private access', '/#/access'],
] as const

test.beforeEach(async ({ page }) => {
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
})

test('primary routes have no automatically detectable WCAG A or AA violations', async ({ page }) => {
  for (const [name, route] of routes) {
    await page.goto(route)
    await page.waitForLoadState('networkidle')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(
      results.violations,
      `${name} accessibility violations:\n${results.violations.map((violation) => `${violation.id}: ${violation.description}`).join('\n')}`,
    ).toEqual([])
  }
})

test('dark appearance has no automatically detectable WCAG A or AA violations', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByLabel('Appearance').selectOption('dark')
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(
    results.violations,
    `Dark appearance accessibility violations:\n${results.violations.map((violation) => `${violation.id}: ${violation.description}`).join('\n')}`,
  ).toEqual([])
})

test('universal search opens from the keyboard, traps focus, escapes, and restores focus', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Search MyHub' })
  await trigger.focus()
  await page.keyboard.press('Control+K')

  const dialog = page.getByRole('dialog', { name: 'Search MyHub' })
  const input = page.getByRole('searchbox', { name: 'Search MyHub' })
  await expect(dialog).toBeVisible()
  await expect(input).toBeFocused()

  await page.keyboard.press('Control+K')
  await expect(input).toBeFocused()

  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Close search' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(input).toBeFocused()

  const results = await new AxeBuilder({ page })
    .include('.command-dialog')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(
    results.violations,
    `Open search accessibility violations:\n${results.violations.map((violation) => `${violation.id}: ${violation.description}`).join('\n')}`,
  ).toEqual([])

  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
})
