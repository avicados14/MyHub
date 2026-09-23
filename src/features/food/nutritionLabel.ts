import type { Nutrition } from '../../domain/types'

export interface NutritionLabelDraft {
  servingQuantity: number | null
  servingUnit: string
  nutrition: Nutrition
  detected: Array<keyof Nutrition | 'servingSize'>
  warnings: string[]
  rawText: string
}

const valueFor = (text: string, patterns: RegExp[]): number | null => {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return Number(match[1].replace(',', ''))
  }
  return null
}

export const extractNutritionLabel = (rawText: string): NutritionLabelDraft => {
  const text = rawText.replace(/\r/g, '\n')
  const serving = text.match(/serving\s+size[^\d]*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/i)
  const calories = valueFor(text, [/calories?[^\d]*(\d+(?:\.\d+)?)/i])
  const protein = valueFor(text, [/protein[^\d]*(\d+(?:\.\d+)?)\s*g/i])
  const carbs = valueFor(text, [
    /(?:total\s+)?carbohydrate[^\d]*(\d+(?:\.\d+)?)\s*g/i,
    /carbs?[^\d]*(\d+(?:\.\d+)?)\s*g/i,
  ])
  const fat = valueFor(text, [/(?:^|\n)\s*(?:total\s+)?fat[^\d]*(\d+(?:\.\d+)?)\s*g/im])
  const sugar = valueFor(text, [/(?:total\s+)?sugars?[^\d]*(\d+(?:\.\d+)?)\s*g/i])
  const saturatedFat = valueFor(text, [/saturated\s+fat[^\d]*(\d+(?:\.\d+)?)\s*g/i])
  const fiber = valueFor(text, [/(?:dietary\s+)?fiber[^\d]*(\d+(?:\.\d+)?)\s*g/i])
  const sodium = valueFor(text, [/sodium[^\d]*(\d+(?:\.\d+)?)\s*mg/i])
  const values = { calories, protein, carbs, fat, sugar, saturatedFat, fiber, sodium }
  const detected = (Object.keys(values) as Array<keyof Nutrition>).filter((key) => values[key] !== null)
  if (serving) detected.push('servingSize')
  const warnings: string[] = ['OCR values are estimates. Compare every field with the physical label before saving.']
  if (detected.length < 4) warnings.push('Only a few fields were detected. Enter the missing values manually.')
  return {
    servingQuantity: serving?.[1] ? Number(serving[1]) : null,
    servingUnit: serving?.[2] ?? '',
    nutrition: {
      calories: calories ?? 0,
      protein: protein ?? 0,
      carbs: carbs ?? 0,
      fat: fat ?? 0,
      sugar: sugar ?? 0,
      saturatedFat: saturatedFat ?? 0,
      fiber: fiber ?? 0,
      sodium: sodium ?? 0,
    },
    detected,
    warnings,
    rawText,
  }
}
