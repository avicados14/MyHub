import { describe, expect, it } from 'vitest'
import { extractNutritionLabel } from './nutritionLabel'

describe('nutrition label extraction', () => {
  it('extracts the requested serving and six nutrition metrics', () => {
    const draft = extractNutritionLabel(`Nutrition Facts\nServing size 28 g\nCalories 140\nTotal Fat 7 g\nTotal Carbohydrate 18 g\nDietary Fiber 3 g\nProtein 4 g\nSodium 210 mg`)
    expect(draft.servingQuantity).toBe(28)
    expect(draft.servingUnit).toBe('g')
    expect(draft.nutrition).toEqual({ calories: 140, protein: 4, carbs: 18, fat: 7, fiber: 3, sodium: 210 })
    expect(draft.warnings[0]).toMatch(/estimates/)
  })

  it('leaves undetected values at zero and warns rather than inventing data', () => {
    const draft = extractNutritionLabel('Calories 90\nProtein 2 g')
    expect(draft.nutrition.carbs).toBe(0)
    expect(draft.detected).toEqual(['calories', 'protein'])
    expect(draft.warnings).toHaveLength(2)
  })
})
