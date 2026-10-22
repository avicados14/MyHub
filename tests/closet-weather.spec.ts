import { expect, test } from '@playwright/test'
import { createEmptyData } from '../src/domain/defaults'
import { seedAppData } from './crosscut-helpers'

test('calendar walks drive Smart Suggest and remain usable on mobile and after reload', async ({ page }) => {
  const userId = '11111111-1111-4111-8111-111111111111'
  const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`
  const items = ['long-sleeve', 'pants', 'shoes'].map((type, i) => ({
    id: `item-${i}`,
    name: type,
    garment_type: type,
    category: i === 0 ? 'tops' : type,
    primary_color: 'white',
    laundry_status: 'clean',
    preference: 'normal',
    image_path: null,
    garment_number: i + 1,
  }))
  let smart: { low: number; note: string } | null = null
  await page.route('https://vlsxvwqmzcriarcctubr.supabase.co/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/myhub-closet-session'))
      return route.fulfill({
        json: {
          access_token: jwt,
          refresh_token: 'fixture',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user_id: userId,
        },
      })
    if (path.endsWith('/auth/v1/user'))
      return route.fulfill({
        json: {
          id: userId,
          aud: 'authenticated',
          role: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      })
    if (path.endsWith('/closet-recommend')) {
      smart = route.request().postDataJSON()
      return route.fulfill({ json: { ids: items.map((i) => i.id), explanation: 'Layers for the morning walk.' } })
    }
    if (path.endsWith('/wardrobe_items')) return route.fulfill({ json: items })
    if (path.endsWith('/outfit_plans')) return route.fulfill({ json: [] })
    return route.fulfill({ status: 404, json: { error: 'No fixture sync data' } })
  })
  await page.route('**/api.open-meteo.com/**', (route) => {
    const url = new URL(route.request().url())
    expect(url.searchParams.get('timezone')).toBe('America/Denver')
    return route.fulfill({
      json: {
        daily: { time: ['2026-10-21'], apparent_temperature_min: [20] },
        hourly: {
          time: Array.from({ length: 24 }, (_, h) => `2026-10-21T${String(h).padStart(2, '0')}:00`),
          apparent_temperature: Array.from({ length: 24 }, (_, h) => (h < 7 ? 20 : 55)),
          precipitation_probability: Array(24).fill(35),
          wind_speed_10m: Array(24).fill(12),
        },
      },
    })
  })
  const data = createEmptyData()
  data.settings.calendarTimeZone = 'America/Denver'
  data.settings.clothingTemperatureBands = [{ minF: -150, top: 'long-sleeve', bottom: 'pants', tank: false }]
  data.events = [
    {
      id: 'first',
      title: 'PRIVATE TA class',
      location: 'Mines campus',
      date: '2026-10-21',
      startTime: '08:00',
      endTime: '09:00',
      kind: 'event',
      source: 'manual',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'second',
      title: 'PRIVATE lab',
      location: 'Mines campus',
      date: '2026-10-21',
      startTime: '09:10',
      endTime: '10:00',
      kind: 'event',
      source: 'manual',
      createdAt: '',
      updatedAt: '',
    },
  ]
  await seedAppData(page, data)
  await page.evaluate(async () => {
    const request = indexedDB.open('myhub-local', 2)
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const tx = db.transaction('credentials', 'readwrite')
    tx.objectStore('credentials').put(
      { version: 1, id: '22222222-2222-4222-8222-222222222222', key: 'fixture-key-'.repeat(4) },
      'private-access',
    )
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve()
    })
    db.close()
  })
  await page.goto(new URL('#/closet', page.url()).href)
  await page.getByLabel('Planned date', { exact: true }).fill('2026-10-21')
  await expect(page.getByLabel('Feels-like low °F', { exact: true })).toHaveValue('55')
  await page.getByText('Review outdoor times (3)').click()
  await expect(page.getByText('Estimated outdoor times: 07:45–08:00, 09:00–09:10, 10:00–10:15')).toBeVisible()
  await page.getByRole('button', { name: 'Smart Suggest', exact: true }).click()
  await expect.poll(() => smart?.low).toBe(55)
  expect((smart as { note: string } | null)?.note).toContain('rain 35%')
  expect(JSON.stringify(smart)).not.toContain('PRIVATE')
  expect(JSON.stringify(smart)).not.toContain('Mines')
  await page.getByLabel('Weather planning mode').selectOption('daily')
  await expect(page.getByLabel('Feels-like low °F', { exact: true })).toHaveValue('20')
  await page.getByLabel('Feels-like low °F', { exact: true }).fill('72')
  await expect(page.getByLabel('Weather planning mode')).toHaveValue('manual')
  await page.getByLabel('Weather planning mode').selectOption('calendar')
  await expect(page.getByLabel('Feels-like low °F', { exact: true })).toHaveValue('55')
  await page.screenshot({ path: `test-results/calendar-weather-${test.info().project.name}.png`, fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.reload()
  await page.getByLabel('Planned date', { exact: true }).fill('2026-10-21')
  await expect(page.getByLabel('Feels-like low °F', { exact: true })).toHaveValue('55')
})
