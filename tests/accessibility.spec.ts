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
] as const

test('primary routes have no automatically detectable WCAG A or AA violations', async ({ page }) => {
  for (const [name, route] of routes) {
    await page.goto(route)
    await page.waitForLoadState('networkidle')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations, `${name} accessibility violations:\n${results.violations.map((violation) => `${violation.id}: ${violation.description}`).join('\n')}`).toEqual([])
  }
})

test('dark appearance has no automatically detectable WCAG A or AA violations', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByLabel('Appearance').selectOption('dark')
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(results.violations, `Dark appearance accessibility violations:\n${results.violations.map((violation) => `${violation.id}: ${violation.description}`).join('\n')}`).toEqual([])
})
