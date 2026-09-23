import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchRecipeDraft, parseRecipeInput } from './recipeImport'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Lemon Pasta',
  description: 'Bright weeknight pasta.',
  recipeYield: '4 servings',
  prepTime: 'PT10M',
  cookTime: 'PT20M',
  recipeIngredient: ['8 oz spaghetti', 'salt to taste'],
  recipeInstructions: [{ '@type': 'HowToStep', text: 'Boil the pasta.' }, { '@type': 'HowToStep', text: 'Toss with lemon.' }],
  nutrition: { calories: '410 calories', proteinContent: '14 g', sodiumContent: '600 mg' },
}

afterEach(() => vi.restoreAllMocks())

describe('recipe imports', () => {
  it('parses Schema.org Recipe JSON-LD deterministically', () => {
    const draft = parseRecipeInput(JSON.stringify(jsonLd), 'json-ld')
    expect(draft.name).toBe('Lemon Pasta')
    expect(draft.originalYield).toBe(4)
    expect(draft.prepMinutes).toBe(10)
    expect(draft.ingredients[0]).toEqual(expect.objectContaining({ quantity: 8, unit: 'oz', name: 'spaghetti' }))
    expect(draft.ingredients[1]).toEqual(expect.objectContaining({ quantity: null, name: 'salt to taste' }))
    expect(draft.warnings.join(' ')).toContain('not present')
  })

  it('keeps unknown quantities blank when parsing pasted text', () => {
    const draft = parseRecipeInput('Toast and eggs\nIngredients\n2 each eggs\nsalt to taste\nInstructions\nToast bread.\nCook eggs.', 'caption')
    expect(draft.ingredients.map((item) => item.quantity)).toEqual([2, null])
    expect(draft.steps).toHaveLength(2)
    expect(draft.sourceLabel).toBe('Pasted social caption')
  })

  it('shows an explicit manual fallback for CORS-style URL failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(fetchRecipeDraft('https://recipes.example/test')).rejects.toThrow(/Paste its JSON-LD, page text, caption, or an image/)
  })

  it('extracts Recipe JSON-LD from fetched HTML', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(`<html><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></html>`, { status: 200 }))
    const draft = await fetchRecipeDraft('https://recipes.example/lemon')
    expect(draft.name).toBe('Lemon Pasta')
    expect(draft.importKind).toBe('url')
    expect(draft.sourceUrl).toBe('https://recipes.example/lemon')
  })
})
