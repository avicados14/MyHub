import type { Nutrition, NutritionProvenance, PackagedFood } from '../../domain/types'

const OPEN_FOOD_FACTS_FIELDS = [
  'code',
  'product_name',
  'brands',
  'serving_size',
  'serving_quantity',
  'nutriments',
  'image_front_url',
].join(',')

interface OffProduct {
  code?: string
  product_name?: string
  brands?: string
  serving_size?: string
  serving_quantity?: number
  image_front_url?: string
  nutriments?: Record<string, unknown>
}

interface OffResponse {
  status?: number | string
  result?: { id?: string }
  status_verbose?: string
  product?: OffProduct
}

interface OffSearchResponse {
  products?: OffProduct[]
}

export interface OpenFoodFactsDraft {
  name: string
  brand: string
  barcode: string
  servingQuantity: number
  servingUnit: string
  nutrition: Nutrition
  image?: string
  provenance: NutritionProvenance
  warnings: string[]
}

export interface OpenFoodFactsSearchResult extends OpenFoodFactsDraft {
  resultId: string
}

const numeric = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const nutriment = (values: Record<string, unknown>, key: string, servingGrams: number | null): number | null => {
  const perServing = numeric(values[`${key}_serving`])
  if (perServing !== null) return perServing
  const per100g = numeric(values[`${key}_100g`])
  return per100g !== null && servingGrams !== null ? (per100g * servingGrams) / 100 : null
}

const parseServing = (label: string | undefined, quantity: number | undefined): { quantity: number; unit: string } => {
  const match = label?.match(/([\d.]+)\s*([a-zA-Z]+)/)
  if (match?.[1] && match[2]) return { quantity: Number(match[1]), unit: match[2] }
  return { quantity: quantity && quantity > 0 ? quantity : 100, unit: 'g' }
}

const draftFromProduct = (product: OffProduct, fallbackBarcode: string): OpenFoodFactsDraft => {
  const values = product.nutriments ?? {}
  const serving = parseServing(product.serving_size, product.serving_quantity)
  const usedServingValues = Object.keys(values).some((key) => key.endsWith('_serving'))
  const servingGrams = serving.unit.toLowerCase() === 'g' ? serving.quantity : null
  const warnings: string[] = []
  if (!product.product_name) warnings.push('Product name is missing.')
  if (!usedServingValues)
    warnings.push(
      'Per-serving values were unavailable; displayed values use the database per-100 g fields and need confirmation.',
    )
  const nutrition: Nutrition = {
    calories: nutriment(values, 'energy-kcal', servingGrams) ?? 0,
    protein: nutriment(values, 'proteins', servingGrams) ?? 0,
    carbs: nutriment(values, 'carbohydrates', servingGrams) ?? 0,
    fat: nutriment(values, 'fat', servingGrams) ?? 0,
    sugar: nutriment(values, 'sugars', servingGrams) ?? 0,
    saturatedFat: nutriment(values, 'saturated-fat', servingGrams) ?? 0,
    fiber: nutriment(values, 'fiber', servingGrams) ?? 0,
    sodium: (() => {
      const sodium = nutriment(values, 'sodium', servingGrams)
      return sodium === null ? 0 : sodium * 1000
    })(),
  }
  if (Object.values(nutrition).every((value) => value === 0))
    warnings.push('Nutrition values are missing. Check the package label before saving.')
  const barcode = product.code ?? fallbackBarcode
  return {
    name: product.product_name?.trim() || 'Unnamed packaged food',
    brand: product.brands?.trim() || '',
    barcode,
    servingQuantity: serving.quantity,
    servingUnit: serving.unit,
    nutrition,
    ...(product.image_front_url ? { image: product.image_front_url } : {}),
    provenance: {
      kind: 'database',
      capturedAt: new Date().toISOString(),
      estimated: true,
      sourceLabel: 'Open Food Facts (read-only import)',
      sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`,
    },
    warnings,
  }
}

const requestHeaders = {
  Accept: 'application/json',
  'X-User-Agent': 'MyHub/0.1 (https://github.com/avicados14/MyHub)',
}

const networkError = (action: string, cause: unknown): Error => {
  if (cause instanceof DOMException && cause.name === 'AbortError') return cause
  return new Error(
    `${action} could not reach Open Food Facts. Your browser, network, or the public service may be blocking the request; enter the package manually instead.`,
  )
}

export const lookupOpenFoodFacts = async (barcode: string, signal?: AbortSignal): Promise<OpenFoodFactsDraft> => {
  const normalized = barcode.replace(/\D/g, '')
  if (normalized.length < 8 || normalized.length > 14) throw new Error('Enter an 8–14 digit UPC or EAN barcode.')
  const endpoint = `https://world.openfoodfacts.org/api/v3.6/product/${normalized}.json?fields=${encodeURIComponent(OPEN_FOOD_FACTS_FIELDS)}`
  try {
    const response = await fetch(endpoint, { signal, headers: requestHeaders })
    if (!response.ok)
      throw new Error(`Open Food Facts returned ${response.status}. Enter the product manually instead.`)
    const body = (await response.json()) as OffResponse
    if ((body.status !== 'success' && body.status !== 1) || !body.product)
      throw new Error('No Open Food Facts product was found. Enter the label manually instead.')
    return draftFromProduct(body.product, normalized)
  } catch (cause) {
    if (cause instanceof Error && /Open Food Facts returned|No Open Food Facts product/.test(cause.message)) throw cause
    throw networkError('Barcode lookup', cause)
  }
}

export const searchOpenFoodFacts = async (
  query: string,
  signal?: AbortSignal,
): Promise<OpenFoodFactsSearchResult[]> => {
  const normalized = query.trim().replaceAll(/\s+/g, ' ')
  if (normalized.length < 2) throw new Error('Enter at least two characters to search.')
  const parameters = new URLSearchParams({
    search_terms: normalized,
    search_simple: '1',
    action: 'process',
    json: '1',
    page: '1',
    page_size: '8',
    fields: OPEN_FOOD_FACTS_FIELDS,
  })
  try {
    // This is Open Food Facts' documented full-text endpoint. Search runs only on submit,
    // never on each keystroke, to respect the public search rate limit.
    const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${parameters}`, {
      signal,
      headers: requestHeaders,
    })
    if (!response.ok)
      throw new Error(`Open Food Facts search returned ${response.status}. Try again or enter it manually.`)
    const body = (await response.json()) as OffSearchResponse
    return (body.products ?? [])
      .filter((product) => Boolean(product.code && product.product_name))
      .slice(0, 8)
      .map((product) => {
        const draft = draftFromProduct(product, product.code ?? '')
        return { ...draft, resultId: `${draft.barcode}:${draft.name}` }
      })
  } catch (cause) {
    if (cause instanceof Error && /Open Food Facts search returned/.test(cause.message)) throw cause
    throw networkError('Text search', cause)
  }
}

export const packagedFoodFromDraft = (
  draft: OpenFoodFactsDraft,
  base: Pick<PackagedFood, 'id' | 'createdAt' | 'updatedAt' | 'source'>,
): PackagedFood => ({
  ...base,
  name: draft.name,
  ...(draft.brand ? { brand: draft.brand } : {}),
  barcode: draft.barcode,
  servingSize: { quantity: draft.servingQuantity, unit: draft.servingUnit },
  nutritionPerServing: { ...draft.nutrition },
  nutritionProvenance: { ...draft.provenance },
  ...(draft.image ? { image: draft.image } : {}),
  needsReview: true,
})
