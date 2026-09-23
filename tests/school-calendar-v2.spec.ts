import { expect, test } from '@playwright/test'

const localDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const compactDate = (date: Date): string => localDate(date).replaceAll('-', '')

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

test('direct Canvas refresh imports homework and disabled feeds hide without deleting it', async ({ page }) => {
  const due = new Date()
  due.setDate(due.getDate() + 3)
  await page.route('https://calendar.example/canvas.ics', async (route) => {
    await route.fulfill({
      contentType: 'text/calendar',
      body: `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:direct-canvas-assignment\nDTSTART:${compactDate(due)}T235900\nSUMMARY:Direct feed assignment [TEST 301]\nURL:https://example.edu/courses/1/assignments/9\nEND:VEVENT\nEND:VCALENDAR`,
    })
  })

  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'Add feed' }).click()
  const feed = page.locator('.calendar-feed-record').last()
  await feed.getByLabel('Feed name').fill('Canvas direct')
  await feed.getByLabel('Provider').selectOption('canvas')
  await feed.getByLabel('Feed URL').fill('https://calendar.example/canvas.ics')
  await feed.getByRole('button', { name: 'Refresh feed' }).click()
  await expect(feed.getByText('1 events · 1 homework')).toBeVisible()

  await page.goto('/#/school')
  await expect(page.getByRole('heading', { name: 'Direct feed assignment' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open source' })).toHaveAttribute(
    'href',
    'https://example.edu/courses/1/assignments/9',
  )

  await page.goto('/#/settings')
  const savedFeed = page.locator('.calendar-feed-record').filter({ hasText: 'Canvas direct' })
  await savedFeed.getByRole('checkbox').uncheck()
  await expect(savedFeed.getByText(/hidden from Calendar, Home, School, search/)).toBeVisible()
  await page.goto('/#/school')
  await expect(page.getByRole('heading', { name: 'Direct feed assignment' })).toHaveCount(0)
  await page.goto('/#/settings')
  await page.locator('.calendar-feed-record').filter({ hasText: 'Canvas direct' }).getByRole('checkbox').check()
  await page.goto('/#/school')
  await expect(page.getByRole('heading', { name: 'Direct feed assignment' })).toBeVisible()
})

test('recurrences, exclusions, overrides, and multi-day spans render without duplicates', async ({ page }) => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  await page.goto('/#/calendar?view=month')
  await page.getByRole('button', { name: 'Import .ics files' }).click()
  await page.getByLabel('Source name').fill('Recurring calendar')
  await page.getByLabel('Source type').selectOption('google')
  await page.getByLabel('Date window').selectOption('year')
  await page.locator('input[name="files"]').setInputFiles({
    name: 'recurring.ics',
    mimeType: 'text/calendar',
    buffer: Buffer.from(
      `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:recurring-1\nDTSTART:${year}${month}15T090000\nDTEND:${year}${month}15T100000\nRRULE:FREQ=DAILY;COUNT=3\nEXDATE:${year}${month}16T090000\nSUMMARY:Recurring seminar\nEND:VEVENT\nBEGIN:VEVENT\nUID:recurring-1\nRECURRENCE-ID:${year}${month}17T090000\nDTSTART:${year}${month}17T110000\nDTEND:${year}${month}17T120000\nSUMMARY:Rescheduled seminar\nEND:VEVENT\nBEGIN:VEVENT\nUID:multi-day-1\nDTSTART:${year}${month}10T120000\nDTEND:${year}${month}12T120000\nSUMMARY:Three-day conference\nEND:VEVENT\nEND:VCALENDAR`,
    ),
  })
  await page.getByRole('button', { name: 'Preview files' }).click()
  await page.getByRole('button', { name: 'Confirm import' }).click()
  await expect(page.getByRole('button', { name: 'Recurring seminar' })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Rescheduled seminar' })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Three-day conference' })).toHaveCount(3)
})

test('study blocks support pointer date-time moves and pointer edge resizing', async ({ page }, testInfo) => {
  await page.goto('/#/school')
  await page.getByRole('button', { name: 'Add homework' }).click()
  await page.getByLabel('Assignment title').fill('Pointer practice')
  await page.getByLabel('Course').fill('TEST 302')
  const due = new Date()
  due.setDate(due.getDate() + 4)
  await page.getByLabel('Due date').fill(localDate(due))
  await page.getByLabel('Estimated minutes').fill('45')
  await page
    .getByRole('dialog', { name: 'Add homework' })
    .getByRole('button', { name: 'Add homework', exact: true })
    .click()
  await page.getByRole('button', { name: 'Build my study plan' }).click()
  await page.goto('/#/calendar?view=week')

  const blockButton = page.getByRole('button', { name: /Edit study block Pointer practice/ })
  await blockButton.click()
  const originalStart = await page.getByRole('dialog', { name: 'Edit study block' }).getByLabel('Starts').inputValue()
  await page.getByRole('dialog', { name: 'Edit study block' }).getByRole('button', { name: 'Cancel' }).click()
  const originalDate = await blockButton
    .locator('xpath=ancestor::section[@data-calendar-date]')
    .getAttribute('data-calendar-date')
  expect(originalDate).not.toBeNull()
  const nextDay = new Date(`${originalDate}T12:00:00`)
  nextDay.setDate(nextDay.getDate() + 1)
  const targetDate = localDate(nextDay)
  const targetDay = page.locator(`[data-calendar-date="${targetDate}"]`)
  const blockBox = await blockButton.boundingBox()
  const targetBox = await targetDay.boundingBox()
  expect(blockBox).not.toBeNull()
  expect(targetBox).not.toBeNull()
  await page.mouse.move(blockBox!.x + blockBox!.width / 2, blockBox!.y + blockBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, blockBox!.y + blockBox!.height / 2 + 16, { steps: 4 })
  await page.mouse.up()

  const moved = page.getByRole('button', { name: /Edit study block Pointer practice/ })
  await expect(moved.locator('xpath=ancestor::section[@data-calendar-date]')).toHaveAttribute(
    'data-calendar-date',
    targetDate,
  )
  await moved.click()
  const dialog = page.getByRole('dialog', { name: 'Edit study block' })
  const movedStart = await dialog.getByLabel('Starts').inputValue()
  const movedEnd = await dialog.getByLabel('Ends').inputValue()
  expect(movedStart).not.toBe(originalStart)
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  const endHandle = page
    .locator('.event-block')
    .filter({ hasText: 'Pointer practice' })
    .locator('.event-block__pointer-handle--end')
  await endHandle.scrollIntoViewIfNeeded()
  const handleBox = await endHandle.boundingBox()
  expect(handleBox).not.toBeNull()
  if (testInfo.project.name === 'mobile') {
    await endHandle.evaluate((node) => {
      Object.defineProperty(node, 'setPointerCapture', { value: () => undefined })
      Object.defineProperty(node, 'hasPointerCapture', { value: () => false })
      node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientY: 100, pointerId: 1 }))
      node.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientY: 108, pointerId: 1 }))
    })
  } else {
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2 + 8)
    await page.mouse.up()
  }
  await page.getByRole('button', { name: /Edit study block Pointer practice/ }).click()
  const resizedDialog = page.getByRole('dialog', { name: 'Edit study block' })
  expect(await resizedDialog.getByLabel('Starts').inputValue()).toBe(movedStart)
  const resizedEnd = await resizedDialog.getByLabel('Ends').inputValue()
  const duration =
    Number(resizedEnd.slice(0, 2)) * 60 +
    Number(resizedEnd.slice(3)) -
    (Number(movedEnd.slice(0, 2)) * 60 + Number(movedEnd.slice(3)))
  expect(duration).toBe(15)
})
