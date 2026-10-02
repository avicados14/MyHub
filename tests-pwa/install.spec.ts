import { expect, test } from '@playwright/test'

test('production phone app installs its shell and opens existing routes offline', async ({ page, context }) => {
  const browserErrors: string[] = []
  page.on('requestfailed', (request) => console.error('PWA failed resource:', new URL(request.url()).pathname))
  page.on('pageerror', (error) => {
    browserErrors.push(error.message)
    console.error('PWA runtime error:', error.message)
  })
  await page.goto('./')
  await expect(
    page.getByRole('heading', { name: /Good (morning|afternoon|evening)/u }),
    `Online startup errors: ${browserErrors.join('; ')}`,
  ).toBeVisible()
  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifest).toBe('/MyHub/manifest.webmanifest')
  const response = await page.request.get(manifest!)
  expect(await response.json()).toMatchObject({ display: 'standalone', start_url: './#/' })
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: /Good (morning|afternoon|evening)/u }),
    `Offline startup errors: ${browserErrors.join('; ')}`,
  ).toBeVisible()
  for (const route of ['calendar', 'school', 'food', 'pantry', 'grocery', 'settings', 'devices']) {
    await page.goto(`./#/${route}`)
    await expect(page.locator('main')).toBeVisible()
    await expect(page.getByText('Loading view…')).toHaveCount(0)
  }
})
