import { expect, test as base } from '@playwright/test'
import { preview } from 'vite'

const test = base.extend<{ stopOrigin: () => Promise<void> }>({
  stopOrigin: async ({ baseURL }, use) => {
    const origin = new URL(baseURL!)
    const server = await preview({ preview: { host: origin.hostname, port: Number(origin.port), strictPort: true } })
    let stopped = false
    const stop = async () => {
      if (stopped) return
      stopped = true
      await new Promise<void>((resolve, reject) => {
        server.httpServer.close((error) => (error ? reject(error) : resolve()))
        if ('closeAllConnections' in server.httpServer) server.httpServer.closeAllConnections()
      })
    }
    try {
      await use(stop)
    } finally {
      await stop()
    }
  },
})

test('production phone app installs its shell and opens existing routes offline', async ({
  page,
  context,
  browserName,
  stopOrigin,
}) => {
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
  // WebKit offline emulation blocks service workers (Playwright #42775).
  // Stop the real origin in both engines and prove uncached HTTP cannot succeed.
  await stopOrigin()
  await expect(page.request.get('./offline-negative-control', { timeout: 3000 })).rejects.toThrow()
  if (browserName === 'chromium') await context.setOffline(true)
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
