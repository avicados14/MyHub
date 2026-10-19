import { scaledIngredients } from './recipe'
import type { Recipe, RecipeIngredient } from './types'

// NIST US fluid-ounce conversion. Container ounces describe volume, never food weight.
export const CONTAINER_ML = 30 * 29.5735295625
export const CONTAINER_FILL_ML = CONTAINER_ML * 0.85
const CUP = 8 * 29.5735295625

export interface ContainerPortionEstimate {
  servings: number
  servingRange: [number, number]
  batchMl: number
  assumptions: string[]
}

const volume = (quantity: number, unit: string): number | null => {
  const factors: Record<string, number> = {
    cup: CUP,
    cups: CUP,
    tbsp: CUP / 16,
    tablespoon: CUP / 16,
    tsp: CUP / 48,
    teaspoon: CUP / 48,
    ml: 1,
    l: 1000,
    'fl oz': CUP / 8,
  }
  return unit in factors ? quantity * factors[unit]! : null
}
const weight = (quantity: number, unit: string): number | null => {
  const factors: Record<string, number> = { g: 1, gram: 1, grams: 1, kg: 1000, oz: 28.3495, lb: 453.592, lbs: 453.592 }
  return unit in factors ? quantity * factors[unit]! : null
}

function ingredientMl(item: RecipeIngredient, grainAbsorbsLiquid: boolean): number | null {
  const name = item.name.toLowerCase()
  const text = `${item.name} ${item.unit} ${item.note ?? ''}`.toLowerCase()
  // Optional additions and tiny seasonings do not determine container capacity.
  if (
    /optional|to taste|pinch|garnish|\bsalt\b|black pepper|white pepper|pepper flakes|chili flakes|garlic powder|onion powder|italian seasoning|oregano|basil|cumin|turmeric|paprika|cilantro|cinnamon/.test(
      name,
    )
  )
    return 0
  if (/water|broth|stock/.test(text) && grainAbsorbsLiquid) return 0
  if (/juice of 1 (lemon|lime)/.test(text)) return 45
  if (item.quantity === null || !Number.isFinite(item.quantity) || item.quantity < 0) return null
  const q = item.quantity
  const unit = item.unit.toLowerCase().trim()
  const ml = volume(q, unit)
  const grams = weight(q, unit)
  if (/broth|stock|water/.test(text)) return ml ?? grams
  if (/vinegar|sauce|paste|juice/.test(text)) return ml ?? grams
  if (/garlic|ginger/.test(text) && !/cheese|boursin|chicken/.test(text)) return 0
  if (/rice|pasta|penne|macaroni|orzo|noodles/.test(text)) {
    const rice = /rice/.test(text)
    const cooked = /\bcooked\b/.test(text) && !/uncooked/.test(text)
    if (cooked && ml !== null) return ml
    // USDA household portions; cooked yield multipliers are rough kitchen assumptions.
    const gramsPerDryCup = rice ? 185 : /orzo/.test(text) ? 168 : /macaroni/.test(text) ? 122 : 100
    const g = grams ?? (ml !== null ? (ml / CUP) * gramsPerDryCup : null)
    if (g === null) return null
    return ((g * (cooked ? 1 : rice ? 3 : 2.4)) / (rice ? 158 : 140)) * CUP
  }
  if (/chicken|beef|steak|turkey|pork|salmon|sausage|chorizo/.test(text)) {
    if (grams === null) return ml // A thigh without a weight is too uncertain.
    if (/bone-in|bone -in/.test(text)) return null
    const cooked = /cooked|rotisserie/.test(text)
    return ((grams * (cooked ? 1 : 0.75)) / 140) * CUP
  }
  if (/spinach/.test(text)) {
    const frozen = /frozen|cooked/.test(text)
    return ml !== null ? ml * (frozen ? 1 : 0.2) : grams !== null ? (grams / (frozen ? 156 : 150)) * CUP : null
  }
  if (/onion|carrot|broccoli|peas|bell pepper|tomato/.test(text)) {
    if (ml !== null) return ml * 0.8
    if (grams !== null) return (grams / 160) * CUP * 0.8
    if (/onion/.test(text)) return ((q * (/small/.test(text) ? 70 : 110)) / 160) * CUP * 0.8
    if (/carrot/.test(text)) return ((q * 61) / 160) * CUP * 0.8
    if (/bell|pepper/.test(text)) return ((q * 119) / 160) * CUP * 0.8
    return null
  }
  if (/cheese|parmesan|cheddar|feta|boursin/.test(text)) {
    if (ml !== null) return ml * 0.65 // Melting and mixing reduces loose shredded volume.
    if (grams !== null) return grams // Approximate melted cheese volume.
    return null
  }
  if (/beans|chickpeas|corn/.test(text)) return ml ?? (grams !== null ? (grams / 170) * CUP : null)
  if (/egg/.test(text)) return grams ?? ml ?? q * 50
  if (/milk|cream|yogurt|sauce|butter|oil|honey|paste|water|broth|stock|juice/.test(text)) return ml ?? grams
  return null
}

/** A capacity estimate, not a serving recommendation or a nutrition-density calculation. */
export function estimateContainerPortion(recipe: Recipe): ContainerPortionEstimate | null {
  if (!Number.isFinite(recipe.originalYield) || recipe.originalYield <= 0) return null
  // Individual baked foods, sandwiches and loose salads need measured portions/packing, not a bowl model.
  if (!/rice|pasta|penne|orzo|bowl|curry|stew|soup|mac.*cheese/i.test(recipe.name)) return null
  const ingredients = scaledIngredients(recipe, recipe.originalYield)
  const grainAbsorbsLiquid = ingredients.some(
    (item) =>
      /rice|pasta|penne|macaroni|orzo/.test(item.name.toLowerCase()) &&
      !/vinegar|sauce|paste/.test(item.name.toLowerCase()) &&
      !/\bcooked\b/.test(item.name.toLowerCase()),
  )
  // Brothy grain soups retain liquid beyond absorption; require measured cooked volume.
  if (grainAbsorbsLiquid && /soup|stew/i.test(recipe.name)) return null
  const volumes = ingredients.map((item) => ingredientMl(item, grainAbsorbsLiquid))
  // Do not silently omit an unrecognized main ingredient and inflate the serving estimate.
  if (!volumes.length || volumes.some((ml) => ml === null)) return null
  const batchMl = volumes.reduce<number>((sum, ml) => sum + (ml ?? 0), 0)
  if (batchMl < 100) return null
  const servingMl = batchMl / recipe.originalYield
  const servings = Math.round((CONTAINER_FILL_ML / servingMl) * 100) / 100
  if (!Number.isFinite(servings) || servings < 0.05) return null
  return {
    servings,
    servingRange: [Math.round((servings / 1.25) * 100) / 100, Math.round((servings / 0.75) * 100) / 100],
    batchMl,
    assumptions: [
      '30 US fl oz ≈ 887 mL; fill estimate uses 85% (about 754 mL / 3.2 cups), leaving space below the lid.',
      'Cooked rice/pasta expansion, 25% raw meat weight loss, and vegetable/cheese settling are rough assumptions. Packing and cooking can change volume by 25% or more.',
      grainAbsorbsLiquid
        ? 'Cooking water/broth is excluded separately to avoid counting liquid absorbed by grains twice.'
        : 'Quantified liquid is included.',
      'Assumes this food fills the container alone. Reduce the amount when packing sides in the same container. Weighing the cooked batch and your portion is more accurate.',
    ],
  }
}
