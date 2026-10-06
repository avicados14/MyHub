import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { zipSync } from 'fflate'
import type { Garment, OutfitPlan } from '../src/features/closet/types'

// Deterministic browser contract test. Live ownership/transaction tests are supabase/tests/closet_rls.sql.
test('MyHub sign-in bridge → ZIP import → plan → dirty → laundry → available', async ({ page }, testInfo) => {
  const userId = '11111111-1111-4111-8111-111111111111'
  const user = {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'fixture@test.invalid',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  }
  const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`
  const storedImages = new Map<string, Buffer>()
  const items: Garment[] = [],
    plans: OutfitPlan[] = []
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  )
  let bridgeCalls = 0
  let rejectFirstPantsInsert = true
  await page.route('**/api.open-meteo.com/**', (route) => route.fulfill({ json: { current: { temperature_2m: 70 } } }))
  await page.route('https://vlsxvwqmzcriarcctubr.supabase.co/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname,
      method = request.method()
    if (path.endsWith('/myhub-closet-session')) {
      bridgeCalls++
      return route.fulfill({
        json: {
          access_token: jwt,
          refresh_token: 'test-refresh-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user_id: userId,
        },
      })
    }
    if (path.endsWith('/auth/v1/user')) return route.fulfill({ json: user })
    if (path.includes('/functions/'))
      return route.fulfill({ status: 404, json: { error: 'No fixture encrypted data' } })
    if (path.includes('/storage/v1/object/sign/') && method === 'POST')
      return route.fulfill({ json: { signedURL: path.replace('/storage/v1', '') } })
    if (path.includes('/storage/') && method === 'GET')
      return route.fulfill({ contentType: 'image/png', body: storedImages.get(path.split('/wardrobe/')[1]!) ?? png })
    if (path.includes('/storage/')) {
      if (method === 'POST' && path.includes('/object/wardrobe/')) {
        const form = await new Response(new Uint8Array(request.postDataBuffer()!), {
          headers: { 'content-type': request.headers()['content-type']! },
        }).formData()
        const file = [...form.values()].find((value) => typeof value !== 'string')
        if (file && typeof file !== 'string')
          storedImages.set(path.split('/wardrobe/')[1]!, Buffer.from(await file.arrayBuffer()))
      }
      return route.fulfill({ json: { Key: 'fixture' } })
    }
    if (path.endsWith('/wardrobe_items')) {
      const matches = (item: Garment) =>
        ['id', 'import_key', 'image_path', 'laundry_status', 'user_id'].every((key) => {
          const filter = url.searchParams.get(key)
          return !filter || filter === `eq.${item[key as keyof Garment]}`
        })
      if (method === 'GET') {
        const found = items.filter(matches)
        return route.fulfill({ json: request.headers().accept?.includes('object') ? (found[0] ?? null) : found })
      }
      if (method === 'POST') {
        if (request.postDataJSON().name === 'black pants' && rejectFirstPantsInsert) {
          rejectFirstPantsInsert = false
          return route.fulfill({ status: 503, json: { message: 'Simulated transient database failure' } })
        }
        const row = {
          ...request.postDataJSON(),
          garment_number: items.length + 1,
          laundry_status: 'clean',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Garment
        items.push(row)
        return route.fulfill({ status: 201, json: row })
      }
      if (method === 'PATCH') {
        const selected = items.filter(matches)
        selected.forEach((item) => Object.assign(item, request.postDataJSON()))
        return route.fulfill({ json: request.headers().accept?.includes('object') ? selected[0] : selected })
      }
    }
    if (path.endsWith('/outfit_plans')) return route.fulfill({ json: plans })
    if (path.endsWith('/rpc/closet_save_plan')) {
      const body = request.postDataJSON()
      const picked = items.filter((item) => body.item_ids.includes(item.id))
      plans.push({
        id: body.plan_id,
        planned_date: body.plan_date,
        occasion: body.plan_occasion,
        title: body.plan_title,
        note: body.plan_note,
        garment_snapshot: structuredClone(picked),
        created_at: new Date().toISOString(),
      })
      picked.forEach((item) => (item.laundry_status = 'dirty'))
      return route.fulfill({ json: plans[0] })
    }
    return route.fulfill({ status: 400, json: { error: `Unhandled fixture path ${path}` } })
  })
  await page.goto('/')
  await page
    .getByRole('heading', { name: /good|home|today/i })
    .first()
    .waitFor()
    .catch(() => undefined)
  await page.evaluate(async () => {
    const request = indexedDB.open('myhub-local', 2)
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('credentials', 'readwrite')
      transaction
        .objectStore('credentials')
        .put(
          { version: 1, id: '22222222-2222-4222-8222-222222222222', key: 'fixture-key-'.repeat(4) },
          'private-access',
        )
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  })
  await page.goto('/#/closet')
  await expect(page.getByRole('heading', { name: 'Your wardrobe' })).toBeVisible()
  expect(bridgeCalls).toBe(1)
  const images = await page.evaluate(() =>
    [false, true].map((reverse) => {
      const c = document.createElement('canvas')
      c.width = 40
      c.height = 40
      const ctx = c.getContext('2d')!
      const gradient = ctx.createLinearGradient(0, 0, 40, 0)
      gradient.addColorStop(0, reverse ? 'white' : 'black')
      gradient.addColorStop(1, reverse ? 'black' : 'white')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 40, 40)
      return c.toDataURL('image/png').split(',')[1]!
    }),
  )
  const archive = zipSync({
    'blue-tee.png': Buffer.from(images[0]!, 'base64'),
    'black-pants.png': Buffer.from(images[1]!, 'base64'),
    '.hidden.png': png,
    'notes.txt': new TextEncoder().encode('ignored'),
  })
  await page
    .getByLabel('Import closet ZIP', { exact: true })
    .setInputFiles({ name: 'closet.zip', mimeType: 'application/zip', buffer: Buffer.from(archive) })
  await expect(page.getByRole('heading', { name: 'Review import' })).toBeVisible()
  await expect(page.getByLabel('Name for blue-tee.png')).toHaveValue('blue tee')
  await page.getByRole('button', { name: 'Import accepted / retry failed' }).click()
  await expect(page.getByText('1 garments · 0 in laundry')).toBeVisible()
  await expect(page.getByText('Could not save black-pants.png. Retry is safe.')).toBeVisible()
  await page.getByRole('button', { name: 'Import accepted / retry failed' }).click()
  await expect(page.getByText('2 garments · 0 in laundry')).toBeVisible()
  await page.getByRole('button', { name: 'Close review' }).click()
  await expect
    .poll(() =>
      page
        .getByRole('img', { name: 'blue tee', exact: true })
        .first()
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBe(40)
  await page.getByLabel('Occasion', { exact: true }).selectOption('School')
  await page.getByLabel('Styling note (saved with plan)').fill('Walking to class')
  await page.getByRole('button', { name: 'Suggest outfit' }).click()
  await page.getByRole('button', { name: 'Save outfit & mark dirty' }).click()
  await expect(page.getByText('2 garments · 2 in laundry')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'School outfit' })).toBeVisible()
  await page.getByRole('button', { name: 'Suggest outfit' }).click()
  await expect(page.getByRole('button', { name: 'Save outfit & mark dirty' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Run laundry' }).click()
  await expect(page.getByText('2 garments · 0 in laundry')).toBeVisible()
  await page.getByRole('button', { name: 'Suggest outfit' }).click()
  await expect(page.getByRole('button', { name: 'Save outfit & mark dirty' })).toBeVisible()
  await page
    .getByLabel('Import closet ZIP', { exact: true })
    .setInputFiles({ name: 'repeat.zip', mimeType: 'application/zip', buffer: Buffer.from(archive) })
  await expect(page.getByLabel('Import choice for blue-tee.png')).toHaveValue('skip')
  await expect(page.getByText(/Exact duplicate: garment #1/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Import accepted / retry failed' })).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(accessibility.violations).toEqual([])
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('closet.png'), fullPage: true })
  const snapshotPath = plans[0]!.garment_snapshot[0]!.image_path
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByLabel('Import choice for blue-tee.png').selectOption('replace')
  await page.getByRole('button', { name: 'Import accepted / retry failed' }).click()
  await expect(page.getByText('2 garments · 0 in laundry')).toBeVisible()
  expect(items[0]!.garment_number).toBe(1)
  await expect.poll(() => items[0]!.image_path).not.toBe(snapshotPath)
  expect(plans[0]!.garment_snapshot[0]!.image_path).toBe(snapshotPath)
  const badZip = zipSync({
    'broken.png': new TextEncoder().encode('not an image'),
    'too-large.png': new Uint8Array(8 * 1024 * 1024 + 1),
  })
  await page
    .getByLabel('Import closet ZIP', { exact: true })
    .setInputFiles({ name: 'invalid.zip', mimeType: 'application/zip', buffer: Buffer.from(badZip) })
  await expect(page.getByText('broken.png: Image signature is invalid or unsupported.')).toBeVisible()
  await expect(page.getByText('too-large.png: exceeds 8 MB')).toBeVisible()
})
