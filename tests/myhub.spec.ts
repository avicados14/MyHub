import { expect, test } from '@playwright/test'

test('dashboard renders connected school and food data', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Avi/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Today’s schedule' })).toBeVisible()
  await expect(page.getByText('Fluid Mechanics')).toBeVisible()
  await expect(page.getByText('Chicken Burrito Bowls').first()).toBeVisible()
})

test('user adds homework and generates study sessions', async ({ page }) => {
  await page.goto('/#/school')
  await page.getByRole('button', { name: 'Add homework' }).click()
  await page.getByLabel('Assignment title').fill('Materials quiz review')
  await page.getByLabel('Course').fill('CE EN 350')
  const due = new Date()
  due.setDate(due.getDate() + 3)
  await page.getByLabel('Due date').fill(due.toISOString().slice(0, 10))
  await page.getByLabel('Estimated minutes').fill('45')
  await page.getByRole('dialog', { name: 'Add homework' }).getByRole('button', { name: 'Add homework', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Materials quiz review' })).toBeVisible()
  await page.getByRole('button', { name: 'Build my study plan' }).click()
  await expect(page.getByRole('heading', { name: 'Your study plan' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Materials quiz review' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Materials quiz review' })).toBeVisible()
})

test('recipe yield scaling updates ingredient quantities', async ({ page }) => {
  await page.goto('/#/food/recipes/recipe-burrito')
  await expect(page.getByRole('heading', { name: 'Chicken Burrito Bowls' })).toBeVisible()
  await page.getByRole('button', { name: 'Increase servings' }).click()
  await page.getByRole('button', { name: 'Increase servings' }).click()
  await expect(page.getByText('1½ lb')).toBeVisible()
  await expect(page.getByText('3 cup')).toBeVisible()
})

test('grocery flow reaches mobile-friendly shopping list', async ({ page }) => {
  await page.goto('/#/grocery')
  await page.getByRole('button', { name: 'Generate from meal plan', exact: true }).click()
  await expect(page.getByRole('heading', { name: /check what you already have/i })).toBeVisible()
  await page.getByRole('button', { name: 'Build shopping list' }).click()
  await expect(page.getByRole('heading', { name: 'Weekly groceries' })).toBeVisible()
  const firstItem = page.locator('.grocery-check').first()
  await firstItem.click()
  await expect(firstItem).toHaveClass(/is-checked/)
})
