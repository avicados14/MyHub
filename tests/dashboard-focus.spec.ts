import { expect, test } from '@playwright/test'
import { createCrosscutFixtureData, seedAppData } from './crosscut-helpers'

test('focus uses the calendar date, excludes historical work, and advances at midnight', async ({ page }) => {
  // UTC is already October 19, but Denver is still October 18.
  await page.clock.install({ time: new Date('2026-10-19T05:59:45Z') })
  await page.goto('/')
  const data = createCrosscutFixtureData(new Date('2026-10-18T12:00:00Z'))
  data.settings.calendarTimeZone = 'America/Denver'
  const template = data.assignments[0]!
  data.settings.calendarFeeds = [
    { id: 'hidden-feed', name: 'Hidden course', kind: 'canvas', enabled: false, status: 'connected' },
  ]
  data.assignments = [
    { ...template, id: 'old', title: 'Week 1 historical work', dueDate: '2026-08-24' },
    { ...template, id: 'yesterday', title: 'Yesterday work', dueDate: '2026-10-17' },
    { ...template, id: 'later', title: 'Later deadline', dueDate: '2026-10-21' },
    { ...template, id: 'tomorrow', title: 'Tomorrow deadline', dueDate: '2026-10-19', dueTime: '09:00' },
    { ...template, id: 'today', title: 'Today deadline', dueDate: '2026-10-18', dueTime: '08:00' },
    { ...template, id: 'next', title: 'Next deadline', dueDate: '2026-10-20' },
    { ...template, id: 'done', title: 'Completed work', dueDate: '2026-10-18', status: 'complete' },
    { ...template, id: 'hidden', title: 'Hidden work', dueDate: '2026-10-18', sourceFeedId: 'hidden-feed' },
  ]
  await seedAppData(page, data)
  await page.goto('/')
  const rows = page.locator('.assignment-row')
  await expect(rows.locator('strong')).toHaveText(['Today deadline', 'Tomorrow deadline', 'Next deadline'])
  await expect(rows.nth(0)).toContainText('Today at')
  await expect(rows.nth(1)).toContainText('Tomorrow at')

  await page.clock.fastForward(30_000)
  await expect(rows.locator('strong')).toHaveText(['Tomorrow deadline', 'Next deadline', 'Later deadline'])
  await expect(rows.nth(0)).toContainText('Today at')

  // Filtering the dashboard must not delete or complete historical assignments.
  await rows.first().click()
  await expect(page.getByText('Week 1 historical work', { exact: true })).toBeVisible()

  data.assignments = data.assignments.filter((assignment) => assignment.id === 'old')
  await seedAppData(page, data)
  await page.goto('/')
  await expect(page.locator('.focus-card__empty')).toHaveText(
    'No upcoming assignments. Past-due work is available in School.',
  )
})
