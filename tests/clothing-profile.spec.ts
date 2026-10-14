import { expect, test } from '@playwright/test'

test('clothing profile persists and is shared by Settings and Closet', async ({ page }) => {
  await page.goto('./#/settings?section=clothing-profile')
  await page
    .getByLabel('Clothing inventory and preferences', { exact: true })
    .fill('Synthetic coral tee; charcoal pants.')
  await page
    .getByLabel('Temperature and layering rules', { exact: true })
    .fill('Use the feels-like low in Fahrenheit. Tanks underneath.')
  // Wait for the existing asynchronous IndexedDB save before simulating a reload.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<string>((resolve, reject) => {
            const open = indexedDB.open('myhub-local')
            open.onerror = () => reject(new Error('Cannot read saved profile'))
            open.onsuccess = () => {
              const db = open.result
              const read = db.transaction('application').objectStore('application').get('state')
              read.onsuccess = () => {
                resolve(read.result?.settings?.clothingTemperatureRules ?? '')
                db.close()
              }
              read.onerror = () => {
                db.close()
                reject(new Error('Cannot read saved profile'))
              }
            }
          }),
      ),
    )
    .toBe('Use the feels-like low in Fahrenheit. Tanks underneath.')
  await page.reload()
  await expect(page.getByLabel('Clothing inventory and preferences', { exact: true })).toHaveValue(
    'Synthetic coral tee; charcoal pants.',
  )
  await page.goto(new URL('#/closet', page.url()).href)
  await page.getByText('My clothing profile and temperature rules', { exact: true }).click()
  await expect(page.getByLabel('Temperature and layering rules', { exact: true })).toHaveValue(
    'Use the feels-like low in Fahrenheit. Tanks underneath.',
  )
  await expect(page.getByLabel('Clothing inventory and preferences', { exact: true })).toHaveValue(
    'Synthetic coral tee; charcoal pants.',
  )
})
