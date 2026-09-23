import { describe, expect, it } from 'vitest'
import { areUnitsCompatible, convertForSystem, convertMeasurement, formatTemperature, normalizeMeasurementUnit, splitQuantityAndUnit } from './measurements'

describe('measurement conversions', () => {
  it('converts only compatible volume and mass units', () => {
    expect(convertMeasurement(1, 'cup', 'mL')?.value).toBeCloseTo(236.588, 3)
    expect(convertMeasurement(1, 'lb', 'g')?.value).toBeCloseTo(453.592, 3)
    expect(areUnitsCompatible('tbsp', 'L')).toBe(true)
    expect(areUnitsCompatible('oz', 'cup')).toBe(false)
    expect(convertMeasurement(2, 'oz', 'mL')).toBeNull()
  })

  it('chooses a safe unit for the requested display system', () => {
    expect(convertForSystem(1, 'cup', 'metric')).toEqual(expect.objectContaining({ unit: 'mL' }))
    expect(convertForSystem(1000, 'g', 'us')).toEqual(expect.objectContaining({ unit: 'lb' }))
    expect(normalizeMeasurementUnit('tablespoons')).toBe('tbsp')
  })

  it('formats temperature and parses mixed cooking quantities', () => {
    expect(formatTemperature(350, '°F', 'metric')).toBe('177°C')
    expect(formatTemperature(180, 'celsius', 'us')).toBe('356°F')
    expect(splitQuantityAndUnit('1 1/2 cups flour')).toEqual({ quantity: 1.5, unit: 'cup', remainder: 'flour' })
    expect(splitQuantityAndUnit('salt to taste')).toEqual({ quantity: null, unit: '', remainder: 'salt to taste' })
  })
})
