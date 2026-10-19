import { describe, expect, it } from 'vitest'
import { createTestFixtureData } from '../test/fixtures'
import { CONTAINER_FILL_ML, CONTAINER_ML, estimateContainerPortion } from './containerPortion'

describe('container portions', () => {
  it('uses volume capacity with headroom, not 30 ounces of food mass', () => {
    expect(CONTAINER_ML).toBeCloseTo(887.206, 2)
    expect(CONTAINER_FILL_ML).toBeCloseTo(754.125, 2)
    const recipe = createTestFixtureData().recipes[0]!
    const before = structuredClone(recipe)
    const estimate = estimateContainerPortion(recipe)!
    expect(estimate.servings).toBeGreaterThan(1)
    expect(estimate.servings).toBeLessThan(1.5)
    expect(estimate.servingRange[0]).toBeLessThan(estimate.servings)
    expect(estimate.servingRange[1]).toBeGreaterThan(estimate.servings)
    expect(recipe).toEqual(before)
  })
  it('distinguishes dry rice from cooked rice and does not add absorption water twice', () => {
    const recipe = createTestFixtureData().recipes[0]!
    recipe.ingredients = [{ ...recipe.ingredients[1]!, quantity: 1 }]
    const dry = estimateContainerPortion(recipe)!
    recipe.ingredients.push({ ...recipe.ingredients[0]!, name: 'water', quantity: 2, unit: 'cup' })
    expect(estimateContainerPortion(recipe)!.batchMl).toBe(dry.batchMl)
    recipe.ingredients = [{ ...recipe.ingredients[0]!, name: 'Cooked rice', quantity: 1, unit: 'cup' }]
    expect(estimateContainerPortion(recipe)!.batchMl).toBeCloseTo(236.588, 2)
    expect(dry.batchMl).toBeGreaterThan(3 * 236.588)
  })
  it('declines missing main ingredient weights, non-bowl foods and invalid yields', () => {
    const recipe = createTestFixtureData().recipes[0]!
    recipe.ingredients[0]!.quantity = null
    expect(estimateContainerPortion(recipe)).toBeNull()
    recipe.ingredients[0]!.quantity = 1
    recipe.ingredients[0]!.unit = 'each'
    expect(estimateContainerPortion(recipe)).toBeNull()
    recipe.name = 'Protein pancakes'
    expect(estimateContainerPortion(recipe)).toBeNull()
    recipe.originalYield = 0
    expect(estimateContainerPortion(recipe)).toBeNull()
  })
})
