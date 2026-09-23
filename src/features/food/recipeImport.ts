import { createUnknownNutritionProvenance } from '../../domain/defaults'
import { splitQuantityAndUnit } from '../../domain/measurements'
import type { GroceryCategory, Nutrition, Recipe, RecipeIngredient, RecipeStep } from '../../domain/types'

export type RecipeImportKind = 'url' | 'json-ld' | 'html' | 'text' | 'caption' | 'image-ocr' | 'video-ocr' | 'social'

export interface RecipeDraft {
  name: string
  description: string
  image: string
  category: string
  tags: string[]
  originalYield: number
  prepMinutes: number
  cookMinutes: number
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
  nutritionPerServing: Nutrition
  sourceLabel: string
  sourceUrl?: string
  importKind: RecipeImportKind
  warnings: string[]
  rawText?: string
}

const ZERO_NUTRITION: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }
const JSON_LD_PATTERN = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
const HEADING_PATTERN = /^(ingredients?|instructions?|directions?|method|steps?)\s*:?$/i

const asString = (value: unknown): string => typeof value === 'string' ? value.trim() : ''
const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap((item) => typeof item === 'string' ? [item.trim()] : []).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean)
  return []
}

const record = (value: unknown): Record<string, unknown> | null => typeof value === 'object' && value !== null ? value as Record<string, unknown> : null

const recipeNode = (value: unknown): Record<string, unknown> | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = recipeNode(item)
      if (found) return found
    }
    return null
  }
  const item = record(value)
  if (!item) return null
  const type = item['@type']
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) return item
  return recipeNode(item['@graph'])
}

const durationMinutes = (value: unknown): number => {
  const text = asString(value)
  if (!text) return 0
  const iso = text.match(/^P(?:([\d.]+)D)?(?:T(?:([\d.]+)H)?(?:([\d.]+)M)?)?$/i)
  if (iso) return Math.round(Number(iso[1] ?? 0) * 1440 + Number(iso[2] ?? 0) * 60 + Number(iso[3] ?? 0))
  const hours = text.match(/([\d.]+)\s*h(?:our)?/i)
  const minutes = text.match(/([\d.]+)\s*m(?:in(?:ute)?)?/i)
  return Math.round(Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0))
}

const numericText = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const match = asString(value).match(/[\d.]+/)
  return match ? Number(match[0]) : null
}

export const parseYield = (value: unknown): number => Math.max(1, Math.round(numericText(value) ?? 1))

export const parseIngredientLine = (line: string, index: number): RecipeIngredient => {
  const { quantity, unit, remainder } = splitQuantityAndUnit(line.replace(/^[-•*]\s*/, ''))
  const name = remainder || line.replace(/^[-•*]\s*/, '').trim()
  return {
    id: `import-ingredient-${index}`,
    name,
    canonicalName: name.toLowerCase(),
    quantity,
    unit,
    category: 'Other' as GroceryCategory,
  }
}

const parseInstructions = (value: unknown): string[] => {
  if (typeof value === 'string') return value.split(/\n+/).map((item) => item.trim()).filter(Boolean)
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'string') return [item.trim()]
    const object = record(item)
    if (!object) return []
    if (Array.isArray(object.itemListElement)) return parseInstructions(object.itemListElement)
    const text = asString(object.text) || asString(object.name)
    return text ? [text] : []
  }).filter(Boolean)
}

const nutritionFromNode = (value: unknown): Nutrition => {
  const data = record(value) ?? {}
  return {
    calories: numericText(data.calories) ?? 0,
    protein: numericText(data.proteinContent) ?? 0,
    carbs: numericText(data.carbohydrateContent) ?? 0,
    fat: numericText(data.fatContent) ?? 0,
    fiber: numericText(data.fiberContent) ?? 0,
    sodium: numericText(data.sodiumContent) ?? 0,
  }
}

const imageFromNode = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return imageFromNode(value[0])
  const object = record(value)
  return asString(object?.url)
}

export const parseRecipeJsonLd = (value: unknown, sourceUrl?: string): RecipeDraft | null => {
  const node = recipeNode(value)
  if (!node) return null
  const ingredients = asStringArray(node.recipeIngredient).map(parseIngredientLine)
  const steps = parseInstructions(node.recipeInstructions).map((text, index): RecipeStep => ({ id: `import-step-${index}`, text }))
  const tags = [...asStringArray(node.keywords), ...asStringArray(node.recipeCuisine)].filter((tag, index, all) => all.indexOf(tag) === index)
  const category = asString(node.recipeCategory) || 'Uncategorized'
  const author = typeof node.author === 'string' ? node.author : asString(record(node.author)?.name)
  const warnings = []
  if (!ingredients.length) warnings.push('No ingredients were found. Add them before marking the draft reviewed.')
  if (!steps.length) warnings.push('No method steps were found. Add them before marking the draft reviewed.')
  if (ingredients.some((item) => item.quantity === null)) warnings.push('One or more ingredient quantities were not present in the source.')
  return {
    name: asString(node.name) || 'Imported recipe draft',
    description: asString(node.description),
    image: imageFromNode(node.image),
    category,
    tags,
    originalYield: parseYield(node.recipeYield),
    prepMinutes: durationMinutes(node.prepTime),
    cookMinutes: durationMinutes(node.cookTime),
    ingredients,
    steps,
    nutritionPerServing: nutritionFromNode(node.nutrition),
    sourceLabel: author ? `Schema.org recipe by ${author}` : 'Schema.org Recipe import',
    ...(sourceUrl ? { sourceUrl } : {}),
    importKind: sourceUrl ? 'url' : 'json-ld',
    warnings,
  }
}

const decodeHtml = (input: string): string => {
  if (typeof DOMParser === 'undefined') return input.replace(/<[^>]+>/g, ' ')
  return new DOMParser().parseFromString(input, 'text/html').documentElement.textContent ?? ''
}

export const extractRecipeJsonLd = (htmlOrJson: string): unknown[] => {
  const trimmed = htmlOrJson.trim()
  const values: unknown[] = []
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { values.push(JSON.parse(trimmed)) } catch { /* fall through to text parsing */ }
  }
  for (const match of htmlOrJson.matchAll(JSON_LD_PATTERN)) {
    try { values.push(JSON.parse(match[1] ?? '')) } catch { /* malformed blocks remain reviewable as text */ }
  }
  return values
}

const meaningfulLines = (text: string): string[] => decodeHtml(text)
  .split(/\r?\n/)
  .map((line) => line.replace(/^[#>]+\s*/, '').trim())
  .filter(Boolean)

export const parseRecipeText = (text: string, kind: RecipeImportKind = 'text', sourceUrl?: string): RecipeDraft => {
  const lines = meaningfulLines(text)
  let section: 'overview' | 'ingredients' | 'steps' = 'overview'
  const overview: string[] = []
  const ingredientLines: string[] = []
  const stepLines: string[] = []
  for (const line of lines) {
    if (/^ingredients?\s*:?$/i.test(line)) { section = 'ingredients'; continue }
    if (/^(instructions?|directions?|method|steps?)\s*:?$/i.test(line)) { section = 'steps'; continue }
    if (HEADING_PATTERN.test(line)) continue
    if (section === 'ingredients') ingredientLines.push(line)
    else if (section === 'steps') stepLines.push(line.replace(/^\d+[.)]\s*/, ''))
    else overview.push(line)
  }
  if (!ingredientLines.length && !stepLines.length) {
    const probableIngredients = lines.filter((line) => /^(?:[-•*]\s*)?(?:\d|½|¼|¾|⅓|⅔)/.test(line))
    ingredientLines.push(...probableIngredients)
    stepLines.push(...lines.filter((line) => !probableIngredients.includes(line)).slice(1))
  }
  const ingredients = ingredientLines.map(parseIngredientLine)
  const warnings = ['Pasted or recognized text needs review because layout and sections may be ambiguous.']
  if (ingredients.some((item) => item.quantity === null)) warnings.push('Missing quantities were left blank; none were invented.')
  return {
    name: overview[0]?.slice(0, 120) || 'Imported recipe draft',
    description: overview.slice(1, 3).join(' '),
    image: '',
    category: 'Uncategorized',
    tags: [],
    originalYield: 1,
    prepMinutes: 0,
    cookMinutes: 0,
    ingredients,
    steps: stepLines.map((line, index) => ({ id: `import-step-${index}`, text: line })),
    nutritionPerServing: { ...ZERO_NUTRITION },
    sourceLabel: kind === 'caption' || kind === 'social' ? 'Pasted social caption' : kind.includes('ocr') ? 'Browser OCR import' : 'Pasted recipe text',
    ...(sourceUrl ? { sourceUrl } : {}),
    importKind: kind,
    warnings,
    rawText: text,
  }
}

export const parseRecipeInput = (input: string, kind: RecipeImportKind = 'text', sourceUrl?: string): RecipeDraft => {
  for (const value of extractRecipeJsonLd(input)) {
    const draft = parseRecipeJsonLd(value, sourceUrl)
    if (draft) return { ...draft, importKind: kind === 'social' ? 'social' : sourceUrl ? 'url' : 'json-ld' }
  }
  return parseRecipeText(input, kind, sourceUrl)
}

export const fetchRecipeDraft = async (url: string, signal?: AbortSignal): Promise<RecipeDraft> => {
  let parsed: URL
  try { parsed = new URL(url) } catch { throw new Error('Enter a complete recipe URL beginning with http:// or https://.') }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http and https recipe URLs can be fetched.')
  let response: Response
  try {
    response = await fetch(parsed.toString(), { signal, headers: { Accept: 'text/html,application/ld+json,application/json' } })
  } catch {
    throw new Error('This site could not be fetched in the browser, usually because it blocks cross-origin requests. Paste its JSON-LD, page text, caption, or an image instead.')
  }
  if (!response.ok) throw new Error(`The site returned ${response.status}. Paste its JSON-LD, page text, caption, or an image instead.`)
  const text = await response.text()
  const draft = parseRecipeInput(text, 'url', parsed.toString())
  if (draft.importKind !== 'url' || draft.sourceLabel === 'Pasted recipe text') {
    throw new Error('No Schema.org Recipe JSON-LD was found. Paste the recipe text or JSON-LD so it can be reviewed locally.')
  }
  return draft
}

export const recipeFromDraft = (
  draft: RecipeDraft,
  timestamp: string,
  id: string,
): Recipe => ({
  id,
  createdAt: timestamp,
  updatedAt: timestamp,
  source: 'imported',
  name: draft.name,
  description: draft.description,
  notes: draft.rawText ? `Original imported text retained for review:\n${draft.rawText}` : '',
  image: draft.image,
  category: draft.category,
  tags: draft.tags,
  favorite: false,
  originalYield: draft.originalYield,
  currentYield: draft.originalYield,
  prepMinutes: draft.prepMinutes,
  cookMinutes: draft.cookMinutes,
  ingredients: draft.ingredients,
  steps: draft.steps,
  nutritionPerServing: draft.nutritionPerServing,
  nutritionProvenance: createUnknownNutritionProvenance(timestamp, draft.sourceLabel),
  sourceLabel: draft.sourceLabel,
  ...(draft.sourceUrl ? { sourceUrl: draft.sourceUrl } : {}),
  needsReview: true,
  reviewNotes: draft.warnings.join(' '),
})
