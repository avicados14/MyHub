import { expect, test } from '@playwright/test'
import { createBackupFile, createCrosscutFixtureData, createNamedFixtureData, seedAppData } from './crosscut-helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await seedAppData(page, createCrosscutFixtureData())
})

test('populated dashboard renders current AppData in chronological and deadline order', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Crosscut User\./ })).toBeVisible()
  await expect(page.getByText('2 calendar commitments')).toBeVisible()
  await expect(page.locator('.timeline__title strong')).toHaveText(['Morning Studio', 'Afternoon Seminar'])
  await expect(page.locator('.study-plan-list strong')).toHaveText(['First Study Block', 'Second Study Block'])
  await expect(page.locator('.assignment-row strong')).toHaveText([
    'First Deadline',
    'Quantum Methods Review',
    'Third Deadline',
  ])

  await expect(page.locator('.meal-card').filter({ hasText: 'High-Protein Overnight Oats' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Plan lunch' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Plan dinner' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Plan snack' })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: /Calories: 420 consumed/ })).toBeVisible()
  await expect(page.getByText('1 of 2 groceries checked')).toBeVisible()
  await expect(page.getByText('1 ingredients tracked at home')).toBeVisible()
})

test('universal search matches every supported collection and navigates to its destination', async ({ page }) => {
  const cases = [
    {
      query: 'Quantum',
      label: 'Quantum Methods Review',
      meta: 'Homework · CROSS 202',
      url: /#\/school\?view=homework&query=Quantum$/,
    },
    { query: 'Teriyaki', label: 'Teriyaki Steak Bowls', meta: 'Recipe', url: /#\/food\/recipes\/recipe-teriyaki$/ },
    { query: 'Rice', label: 'Rice', meta: 'Pantry · Pantry · 1.5 lb', url: /#\/pantry\?query=Rice$/ },
    {
      query: 'Summit',
      label: 'Trail Mix Packet',
      meta: 'Packaged food · Summit Foods',
      url: /#\/food\?view=nutrition&query=Summit$/,
    },
    {
      query: 'Pistachios',
      label: 'Campus Market Run',
      meta: 'Grocery history · 1 items',
      url: /#\/grocery\?history=history-campus-market$/,
    },
    {
      query: 'Night Shift',
      label: 'Night Shift Noodles',
      meta: /Meal plan · dinner/,
      url: /#\/food\?view=planner&date=/,
    },
  ]

  for (const entry of cases) {
    await page.getByRole('button', { name: 'Search MyHub' }).click()
    const dialog = page.getByRole('dialog', { name: 'Search MyHub' })
    await expect(dialog).toBeVisible()
    const input = dialog.getByRole('searchbox', { name: 'Search MyHub' })
    await expect(input).toBeFocused()
    await input.fill(entry.query)
    const result = dialog.getByRole('link', { name: new RegExp(entry.label) })
    await expect(result).toContainText(entry.meta)
    await result.click()
    await expect(page).toHaveURL(entry.url)
  }
})

test('universal search reports no results and supports keyboard open, focus trap, escape, and focus restoration', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Search MyHub' })
  await trigger.focus()
  await page.keyboard.press('ControlOrMeta+k')

  const dialog = page.getByRole('dialog', { name: 'Search MyHub' })
  const input = dialog.getByRole('searchbox', { name: 'Search MyHub' })
  const close = dialog.getByRole('button', { name: 'Close search' })
  await expect(input).toBeFocused()
  await input.fill('record-that-does-not-exist')
  await expect(dialog.getByText('No matches yet. Try a title, course, ingredient, brand, or meal.')).toBeVisible()

  await input.press('Shift+Tab')
  await expect(close).toBeFocused()
  await close.press('Tab')
  await expect(input).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
})

test('Settings warns that exports are plaintext and downloads the current validated backup', async ({ page }) => {
  await page.goto('/#/settings')
  await expect(page.getByText('JSON exports are plaintext.')).toBeVisible()
  await expect(page.getByText(/private academic and food records/)).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export data' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^myhub-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const backup = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
    format: string
    formatVersion: number
    data: { settings: { name: string }; recipes: Array<{ name: string }> }
  }
  expect(backup.format).toBe('myhub-backup')
  expect(backup.formatVersion).toBe(2)
  expect(backup.data.settings.name).toBe('Crosscut User')
  expect(backup.data.recipes.some((recipe) => recipe.name === 'Teriyaki Steak Bowls')).toBe(true)
  await expect(page.getByRole('status')).toContainText('Plaintext MyHub backup downloaded.')
})

test('Settings rejects invalid backups and imports valid data only after confirmation', async ({ page }) => {
  await page.goto('/#/settings')
  const input = page.getByLabel('Import MyHub JSON backup')

  await input.setInputFiles({
    name: 'not-a-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'other', data: {} })),
  })
  await expect(page.getByRole('status')).toContainText('This file is not a supported MyHub backup.')
  await expect(page.getByLabel('Your name')).toHaveValue('Crosscut User')

  const imported = createNamedFixtureData('Imported User', 'Imported Recovery Recipe')
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Replace current local data with the backup')
    await dialog.dismiss()
  })
  await input.setInputFiles(createBackupFile(imported))
  await expect(page.getByLabel('Your name')).toHaveValue('Crosscut User')

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Export first if you need a copy.')
    await dialog.accept()
  })
  await input.setInputFiles(createBackupFile(imported, '2026-09-22T12:01:00.000Z'))
  await expect(page.getByRole('status')).toContainText('Data imported successfully.')
  await expect(page.getByLabel('Your name')).toHaveValue('Imported User')
  await page.reload()
  await expect(page.getByLabel('Your name')).toHaveValue('Imported User')
  await page.goto('/#/food')
  await expect(page.getByRole('heading', { name: 'Imported Recovery Recipe' })).toBeVisible()
})
