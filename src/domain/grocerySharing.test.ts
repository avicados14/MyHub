import { describe, expect, it } from 'vitest'
import { groceryShareText } from './grocerySharing'
import type { GroceryList } from './types'

const list: GroceryList = {
  id: 'list',
  createdAt: '',
  updatedAt: '',
  source: 'manual',
  name: 'Weekly groceries',
  status: 'draft',
  items: [
    {
      id: 'rice',
      createdAt: '',
      updatedAt: '',
      source: 'manual',
      name: 'Rice',
      canonicalName: 'rice',
      quantity: 5,
      unit: 'cup',
      category: 'Pantry',
      checked: false,
      sourceRecipeIds: [],
      pantryQuantity: 2,
      pantryDecision: 'saved',
    },
  ],
}

describe('grocery sharing', () => {
  it('subtracts pantry quantities only for draft lists', () => {
    expect(groceryShareText(list)).toContain('Rice — 3 cup')
    expect(groceryShareText({ ...list, status: 'shopping' })).toContain('Rice — 5 cup')
  })
  it('omits purchased and fully covered items by default', () => {
    const purchased = { ...list, items: list.items.map((item) => ({ ...item, checked: true })) }
    expect(groceryShareText(purchased)).toContain('No items left to buy.')
    expect(groceryShareText(purchased, true)).toContain('[x] Rice')
    expect(
      groceryShareText({ ...list, items: list.items.map((item) => ({ ...item, pantryDecision: 'enough' })) }),
    ).not.toContain('Rice')
  })
  it('keeps categories and dates without private source metadata', () => {
    const text = groceryShareText({
      ...list,
      sourceStartDate: '2026-10-12',
      sourceEndDate: '2026-10-18',
      sourceMealIds: ['private-id'],
    })
    expect(text).toContain('2026-10-12 to 2026-10-18')
    expect(text).toContain('Pantry\n[ ] Rice')
    expect(text).not.toContain('private-id')
  })
})
