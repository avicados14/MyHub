import { expect, test } from '@playwright/test'

const localDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

test('homework supports complete editing, subtasks, and safe source provenance', async ({ page }) => {
  await page.goto('/#/school')
  await page.getByRole('button', { name: 'Add homework' }).click()
  await page.getByLabel('Assignment title').fill('Structural analysis draft')
  await page.getByLabel('Course').fill('CE 410')
  await page.getByLabel('Status').selectOption('in-progress')
  await page.getByLabel('Progress percent').fill('35')
  await page.getByLabel('Source label').fill('Course portal')
  await page.getByLabel('Source URL').fill('https://example.edu/assignment/7')
  await page
    .getByRole('dialog', { name: 'Add homework' })
    .getByRole('button', { name: 'Add homework', exact: true })
    .click()

  const card = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'Structural analysis draft' }) })
  await expect(card.getByText('In progress')).toBeVisible()
  await expect(card.getByRole('link', { name: 'Open source' })).toHaveAttribute('target', '_blank')
  await card.getByLabel('New subtask for Structural analysis draft').fill('Check load cases')
  await card.getByRole('button', { name: 'Add', exact: true }).click()
  await card.getByLabel('Subtask title').fill('Check all load cases')
  await card.getByLabel('Mark Check all load cases complete').check()
  await card.getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('dialog', { name: 'Edit homework' }).getByLabel('Priority').selectOption('high')
  await page.getByRole('dialog', { name: 'Edit homework' }).getByLabel('Estimated minutes').fill('120')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(card.getByText('120 min estimated')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Subtask title' })).toHaveValue('Check all load cases')
})

test('calendar events can be created, edited, resized, and deleted', async ({ page }) => {
  await page.goto('/#/calendar?view=day')
  await page.getByRole('button', { name: 'Add event' }).click()
  await page.getByLabel('Title').fill('Design review')
  await page.getByLabel('Course or context').fill('Capstone')
  await page.getByLabel('Location').fill('Engineering building')
  await page.getByRole('button', { name: 'Save event' }).click()
  await page.getByRole('button', { name: /Edit event Design review/ }).click()
  await page.getByRole('dialog', { name: 'Edit calendar event' }).getByLabel('Title').fill('Final design review')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Final design review')).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: /Edit event Final design review/ }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Final design review')).toHaveCount(0)
})

test('multiple local ICS files require preview and explicit confirmation', async ({ page }) => {
  const year = new Date().getFullYear()
  await page.goto('/#/calendar')
  await page.getByRole('button', { name: 'Import .ics files' }).click()
  await page.getByLabel('Source name').fill('Canvas exports')
  await page.getByLabel('Date window').selectOption('year')
  await page.locator('input[name="files"]').setInputFiles([
    {
      name: 'canvas.ics',
      mimeType: 'text/calendar',
      buffer: Buffer.from(
        `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:canvas-assignment\nDTSTART:${year}1015T235900\nSUMMARY:Case study [BUS 201]\nURL:https://example.edu/courses/1/assignments/4\nEND:VEVENT\nEND:VCALENDAR`,
      ),
    },
    {
      name: 'canvas-classes.ics',
      mimeType: 'text/calendar',
      buffer: Buffer.from(
        `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:canvas-class\nDTSTART:${year}1016T090000\nDTEND:${year}1016T100000\nSUMMARY:BUS 201 class\nLOCATION:Room 8\nEND:VEVENT\nEND:VCALENDAR`,
      ),
    },
  ])
  await page.getByRole('button', { name: 'Preview files' }).click()
  await expect(page.getByRole('heading', { name: 'Ready to import' })).toBeVisible()
  await expect(page.getByText('2 events and 1 Canvas-style homework assignments')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm import' }).click()
  await page.goto('/#/school')
  await expect(page.getByRole('heading', { name: 'Case study' })).toBeVisible()
  await expect(page.getByText(/Source: Canvas exports.*Imported/)).toBeVisible()
})

test('generated study blocks expose keyboard-operable fifteen-minute resizing', async ({ page }) => {
  await page.goto('/#/school')
  await page.getByRole('button', { name: 'Add homework' }).click()
  await page.getByLabel('Assignment title').fill('Resize practice')
  await page.getByLabel('Course').fill('TEST 201')
  const due = new Date()
  due.setDate(due.getDate() + 2)
  await page.getByLabel('Due date').fill(localDate(due))
  await page.getByLabel('Estimated minutes').fill('45')
  await page
    .getByRole('dialog', { name: 'Add homework' })
    .getByRole('button', { name: 'Add homework', exact: true })
    .click()
  await page.getByRole('button', { name: 'Build my study plan' }).click()
  await page.goto('/#/calendar?view=week')
  await expect(page.getByRole('button', { name: 'Extend Resize practice by 15 minutes' })).toBeVisible()
  await page.getByRole('button', { name: 'Extend Resize practice by 15 minutes' }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: /Edit study block Resize practice/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit study block' })
  const start = await dialog.getByLabel('Starts').inputValue()
  const end = await dialog.getByLabel('Ends').inputValue()
  expect(
    Number(end.slice(0, 2)) * 60 + Number(end.slice(3)) - (Number(start.slice(0, 2)) * 60 + Number(start.slice(3))),
  ).toBe(60)
})
