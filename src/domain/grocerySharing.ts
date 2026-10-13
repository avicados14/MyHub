import { purchaseQuantity } from './grocery'
import { formatQuantity } from './recipe'
import type { GroceryList } from './types'

/** Share only shopping content, never connection URLs or application credentials. */
export function groceryShareText(list: GroceryList, includePurchased = false): string {
  const groups = new Map<string, string[]>()
  for (const item of list.items) {
    const quantity = list.status === 'draft' ? purchaseQuantity(item) : item.quantity
    if ((!includePurchased && item.checked) || quantity <= 0) continue
    const lines = groups.get(item.category) ?? []
    lines.push(`${item.checked ? '[x]' : '[ ]'} ${item.name} — ${formatQuantity(quantity)} ${item.unit}`)
    groups.set(item.category, lines)
  }
  return [
    list.name,
    list.sourceStartDate && list.sourceEndDate ? `${list.sourceStartDate} to ${list.sourceEndDate}` : '',
    list.status === 'draft' ? 'Draft — review pantry amounts before shopping.' : '',
    ...Array.from(groups, ([category, lines]) => `${category}\n${lines.join('\n')}`),
    groups.size ? '' : 'No items left to buy.',
  ]
    .filter(Boolean)
    .join('\n\n')
}
