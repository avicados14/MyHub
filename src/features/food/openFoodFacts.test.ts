import { afterEach, describe, expect, it, vi } from 'vitest'
import { lookupOpenFoodFacts, searchOpenFoodFacts } from './openFoodFacts'

afterEach(() => vi.restoreAllMocks())

const product = (code = '12345678', name = 'Test Bar') => ({
  code,
  product_name: name,
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
})

describe('Open Food Facts lookup', () => {
  it('uses limited current product fields and marks imported values estimated', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'success', result: { id: 'product_found' }, product: product() }), {
        status: 200,
      }),
    )
    const draft = await lookupOpenFoodFacts('12345678')
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/v3.6/product/12345678.json?fields=')
    expect(draft.nutrition).toEqual({ calories: 180, protein: 6, carbs: 20, fat: 8, fiber: 3, sodium: 200 })
    expect(draft.provenance).toEqual(expect.objectContaining({ kind: 'database', estimated: true }))
  })

  it('fails explicitly for a missing product', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'failure', result: { id: 'product_not_found' } }), { status: 200 }),
    )
    await expect(lookupOpenFoodFacts('12345678')).rejects.toThrow(/Enter the label manually/)
  })

  it('uses submit-only bounded text search fields and does not retain incomplete results', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ products: [product(), { code: '87654321' }, product('11223344', 'Second Bar')] }),
          { status: 200 },
        ),
      )
    const results = await searchOpenFoodFacts(' test   bar ')
    const endpoint = String(fetchMock.mock.calls[0]?.[0])
    expect(endpoint).toContain('/cgi/search.pl?')
    expect(endpoint).toContain('search_terms=test+bar')
    expect(endpoint).toContain('page_size=8')
    expect(results.map((item) => item.name)).toEqual(['Test Bar', 'Second Bar'])
    expect(results[0]?.provenance.sourceLabel).toBe('Open Food Facts (read-only import)')
  })

  it('reports browser/network failure with a manual fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(searchOpenFoodFacts('oats')).rejects.toThrow(/browser, network, or the public service/)
  })
})
