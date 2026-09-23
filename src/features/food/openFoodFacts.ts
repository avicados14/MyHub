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

interface OffResponse {
  status?: number
  status_verbose?: string
  product?: {
    code?: string
    product_name?: string
    brands?: string
    serving_size?: string
    serving_quantity?: number
    image_front_url?: string
    nutriments?: Record<string, unknown>
  }
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

export const lookupOpenFoodFacts = async (barcode: string, signal?: AbortSignal): Promise<OpenFoodFactsDraft> => {
  const normalized = barcode.replace(/\D/g, '')
  if (normalized.length < 8 || normalized.length > 14) throw new Error('Enter an 8–14 digit UPC or EAN barcode.')
  const endpoint = `https://world.openfoodfacts.org/api/v2/product/${normalized}.json?fields=${encodeURIComponent(OPEN_FOOD_FACTS_FIELDS)}`
  const response = await fetch(endpoint, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Open Food Facts returned ${response.status}. Enter the product manually instead.`)
  const body = (await response.json()) as OffResponse
  if (body.status !== 1 || !body.product)
    throw new Error('No Open Food Facts product was found. Enter the label manually instead.')
  const product = body.product
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
    fiber: nutriment(values, 'fiber', servingGrams) ?? 0,
    sodium: (() => {
      const sodium = nutriment(values, 'sodium', servingGrams)
      return sodium === null ? 0 : sodium * 1000
    })(),
  }
  if (Object.values(nutrition).every((value) => value === 0))
    warnings.push('Nutrition values are missing. Check the package label before saving.')
  return {
    name: product.product_name?.trim() || 'Unnamed packaged food',
    brand: product.brands?.trim() || '',
    barcode: product.code ?? normalized,
    servingQuantity: serving.quantity,
    servingUnit: serving.unit,
    nutrition,
    ...(product.image_front_url ? { image: product.image_front_url } : {}),
    provenance: {
      kind: 'database',
      capturedAt: new Date().toISOString(),
      estimated: true,
      sourceLabel: 'Open Food Facts (read-only import)',
      sourceUrl: `https://world.openfoodfacts.org/product/${normalized}`,
    },
    warnings,
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
