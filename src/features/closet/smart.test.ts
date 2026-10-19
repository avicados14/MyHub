import { describe, expect, it } from 'vitest'
import {
  parseInput,
  smartPools,
  validateSmartOutput,
  type SmartItem,
} from '../../../supabase/functions/closet-recommend/logic'
const input = {
  low: 75,
  occasion: 'School',
  note: '',
  band: { top: 'short-sleeve', bottom: 'shorts', tank: false },
  jacket: false,
  includeAvoid: false,
  keptIds: ['a'],
  previousIds: [],
}
const items: SmartItem[] = [
  {
    id: 'a',
    name: 'Synthetic tee',
    category: 'tops',
    garment_type: 'short-sleeve',
    primary_color: 'white',
    laundry_status: 'clean',
  },
  {
    id: 'b',
    name: 'Synthetic shorts',
    category: 'bottoms',
    garment_type: 'shorts',
    primary_color: 'blue',
    laundry_status: 'clean',
  },
  {
    id: 'c',
    name: 'Other tee',
    category: 'tops',
    garment_type: 'short-sleeve',
    primary_color: 'gray',
    laundry_status: 'clean',
  },
]
describe('Smart Suggest constraints', () => {
  it('accepts a complete outfit with every kept item', () => {
    expect(
      validateSmartOutput({ ids: ['a', 'b'], explanation: 'Neutral top and blue shorts.' }, items, parseInput(input))
        .ids,
    ).toEqual(['a', 'b'])
  })
  it('rejects foreign IDs, missing locks, duplicates, wrong roles, and malformed explanations', () => {
    for (const ids of [['foreign', 'b'], ['c', 'b'], ['a', 'a'], ['a', 'c'], ['a'], ['a', 'b', 'c']])
      expect(() => validateSmartOutput({ ids, explanation: 'test' }, items, input)).toThrow()
    expect(() => validateSmartOutput({ ids: ['a', 'b'], explanation: '' }, items, input)).toThrow()
  })
  it('rejects dirty garments and less-preferred garments unless opted in', () => {
    expect(() =>
      smartPools(
        items.map((i) => (i.id === 'a' ? { ...i, laundry_status: 'dirty' } : i)),
        input,
      ),
    ).toThrow()
    const avoided = items.map((i) => (i.id === 'b' ? { ...i, preference: 'avoid' } : i))
    expect(() => smartPools(avoided, input)).toThrow()
    expect(smartPools(avoided, { ...input, includeAvoid: true })).toHaveLength(2)
  })
  it('validates request boundaries and required tank/shoe/jacket slots', () => {
    for (const patch of [
      { low: NaN },
      { note: 'a'.repeat(1001) },
      { occasion: 'invalid' },
      { keptIds: ['a', 'a'] },
      { band: {} },
    ])
      expect(() => parseInput({ ...input, ...patch })).toThrow()
    const extra = { ...items[0]!, id: 'tank', garment_type: 'tank' }
    expect(() =>
      validateSmartOutput({ ids: ['a', 'b'], explanation: 'test' }, [...items, extra], {
        ...input,
        band: { ...input.band, tank: true },
      }),
    ).toThrow()
  })
})
