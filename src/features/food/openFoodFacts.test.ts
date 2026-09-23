import { afterEach, describe, expect, it, vi } from 'vitest'
import { lookupOpenFoodFacts } from './openFoodFacts'

afterEach(() => vi.restoreAllMocks())

describe('Open Food Facts lookup', () => {
  it('uses limited v2 product fields and marks imported values estimated', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 1,
          product: {
            code: '12345678',
            product_name: 'Test Bar',
            brands: 'Acme',
            serving_size: '40 g',
            nutriments: {
              'energy-kcal_serving': 180,
              proteins_serving: 6,
              carbohydrates_serving: 20,
              fat_serving: 8,
              fiber_serving: 3,
              sodium_serving: 0.2,
            },
          },
        }),
        { status: 200 },
      ),
    )
    const draft = await lookupOpenFoodFacts('12345678')
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/v2/product/12345678.json?fields=')
    expect(draft.nutrition).toEqual({ calories: 180, protein: 6, carbs: 20, fat: 8, fiber: 3, sodium: 200 })
    expect(draft.provenance).toEqual(expect.objectContaining({ kind: 'database', estimated: true }))
  })

  it('fails explicitly for a missing product', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: 0 }), { status: 200 }))
    await expect(lookupOpenFoodFacts('12345678')).rejects.toThrow(/Enter the label manually/)
  })
})
