export type MeasurementDimension = 'volume' | 'mass' | 'temperature' | 'count' | 'other'
export type MeasurementSystem = 'us' | 'metric'

export interface MeasurementUnit {
  key: string
  label: string
  dimension: MeasurementDimension
  system: MeasurementSystem | 'neutral'
  toBase?: number
  aliases: string[]
}

export interface ConvertedMeasurement {
  value: number
  unit: string
}

export const MEASUREMENT_UNITS: MeasurementUnit[] = [
  {
    key: 'tsp',
    label: 'tsp',
    dimension: 'volume',
    system: 'us',
    toBase: 4.92892159375,
    aliases: ['tsp', 'teaspoon', 'teaspoons'],
  },
  {
    key: 'tbsp',
    label: 'tbsp',
    dimension: 'volume',
    system: 'us',
    toBase: 14.78676478125,
    aliases: ['tbsp', 'tablespoon', 'tablespoons'],
  },
  { key: 'cup', label: 'cup', dimension: 'volume', system: 'us', toBase: 236.5882365, aliases: ['cup', 'cups'] },
  {
    key: 'fl oz',
    label: 'fl oz',
    dimension: 'volume',
    system: 'us',
    toBase: 29.5735295625,
    aliases: ['fl oz', 'floz', 'fluid ounce', 'fluid ounces'],
  },
  {
    key: 'mL',
    label: 'mL',
    dimension: 'volume',
    system: 'metric',
    toBase: 1,
    aliases: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'],
  },
  {
    key: 'L',
    label: 'L',
    dimension: 'volume',
    system: 'metric',
    toBase: 1000,
    aliases: ['l', 'liter', 'liters', 'litre', 'litres'],
  },
  { key: 'oz', label: 'oz', dimension: 'mass', system: 'us', toBase: 28.349523125, aliases: ['oz', 'ounce', 'ounces'] },
  {
    key: 'lb',
    label: 'lb',
    dimension: 'mass',
    system: 'us',
    toBase: 453.59237,
    aliases: ['lb', 'lbs', 'pound', 'pounds'],
  },
  { key: 'g', label: 'g', dimension: 'mass', system: 'metric', toBase: 1, aliases: ['g', 'gram', 'grams'] },
  {
    key: 'kg',
    label: 'kg',
    dimension: 'mass',
    system: 'metric',
    toBase: 1000,
    aliases: ['kg', 'kilogram', 'kilograms'],
  },
  { key: '°F', label: '°F', dimension: 'temperature', system: 'us', aliases: ['f', '°f', 'fahrenheit'] },
  { key: '°C', label: '°C', dimension: 'temperature', system: 'metric', aliases: ['c', '°c', 'celsius'] },
  {
    key: 'each',
    label: 'each',
    dimension: 'count',
    system: 'neutral',
    toBase: 1,
    aliases: ['each', 'item', 'items', 'whole'],
  },
]

const NORMALIZED_UNITS = new Map(
  MEASUREMENT_UNITS.flatMap((unit) => unit.aliases.map((alias) => [alias.toLowerCase(), unit] as const)),
)

export const findMeasurementUnit = (unit: string): MeasurementUnit | undefined =>
  NORMALIZED_UNITS.get(unit.trim().toLowerCase())

export const normalizeMeasurementUnit = (unit: string): string => findMeasurementUnit(unit)?.key ?? unit.trim()

export const areUnitsCompatible = (from: string, to: string): boolean => {
  const source = findMeasurementUnit(from)
  const target = findMeasurementUnit(to)
  return Boolean(source && target && source.dimension === target.dimension && source.dimension !== 'other')
}

export const convertMeasurement = (value: number, from: string, to: string): ConvertedMeasurement | null => {
  if (!Number.isFinite(value)) return null
  const source = findMeasurementUnit(from)
  const target = findMeasurementUnit(to)
  if (!source || !target || source.dimension !== target.dimension) return null
  if (source.dimension === 'temperature') {
    if (source.key === target.key) return { value, unit: target.key }
    if (source.key === '°F' && target.key === '°C') return { value: ((value - 32) * 5) / 9, unit: target.key }
    if (source.key === '°C' && target.key === '°F') return { value: (value * 9) / 5 + 32, unit: target.key }
    return null
  }
  if (source.toBase === undefined || target.toBase === undefined) return null
  return { value: (value * source.toBase) / target.toBase, unit: target.key }
}

const chooseDisplayUnit = (
  baseValue: number,
  dimension: 'volume' | 'mass',
  system: MeasurementSystem,
): MeasurementUnit => {
  const units = MEASUREMENT_UNITS.filter(
    (unit) => unit.dimension === dimension && unit.system === system && unit.toBase !== undefined,
  )
  const suitable = units
    .map((unit) => ({ unit, value: baseValue / (unit.toBase ?? 1) }))
    .filter(({ value }) => value >= 1)
    .toSorted((a, b) => a.value - b.value)
  return suitable[0]?.unit ?? units.toSorted((a, b) => (a.toBase ?? 1) - (b.toBase ?? 1))[0]!
}

export const convertForSystem = (
  value: number,
  unit: string,
  system: MeasurementSystem,
): ConvertedMeasurement | null => {
  const source = findMeasurementUnit(unit)
  if (!source) return null
  if (source.dimension === 'temperature')
    return convertMeasurement(value, source.key, system === 'metric' ? '°C' : '°F')
  if (source.dimension !== 'volume' && source.dimension !== 'mass') return { value, unit: source.key }
  if (source.toBase === undefined) return null
  const baseValue = value * source.toBase
  const target = chooseDisplayUnit(baseValue, source.dimension, system)
  return { value: baseValue / (target.toBase ?? 1), unit: target.key }
}

export const formatTemperature = (value: number, unit: string, system: MeasurementSystem): string => {
  const converted = convertForSystem(value, unit, system)
  if (!converted || findMeasurementUnit(converted.unit)?.dimension !== 'temperature')
    return `${Math.round(value)}${unit}`
  return `${Math.round(converted.value)}${converted.unit}`
}

export const compatibleUnitOptions = (unit: string): MeasurementUnit[] => {
  const source = findMeasurementUnit(unit)
  if (!source) return []
  return MEASUREMENT_UNITS.filter((candidate) => candidate.dimension === source.dimension)
}

export const splitQuantityAndUnit = (input: string): { quantity: number | null; unit: string; remainder: string } => {
  const trimmed = input.trim()
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)\s*(.*)$/)
  const fraction = trimmed.match(/^(\d+)\/(\d+)\s*(.*)$/)
  const decimal = trimmed.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
  let quantity: number | null = null
  let rest = trimmed
  if (mixed) {
    const denominator = Number(mixed[3])
    quantity = denominator ? Number(mixed[1]) + Number(mixed[2]) / denominator : null
    rest = mixed[4] ?? ''
  } else if (fraction) {
    const denominator = Number(fraction[2])
    quantity = denominator ? Number(fraction[1]) / denominator : null
    rest = fraction[3] ?? ''
  } else if (decimal) {
    quantity = Number(decimal[1])
    rest = decimal[2] ?? ''
  }
  const unit = MEASUREMENT_UNITS.flatMap((item) => item.aliases.map((alias) => ({ alias, key: item.key })))
    .toSorted((a, b) => b.alias.length - a.alias.length)
    .find(({ alias }) => rest.toLowerCase() === alias || rest.toLowerCase().startsWith(`${alias} `))
  if (!unit) return { quantity, unit: '', remainder: rest.trim() }
  return { quantity, unit: unit.key, remainder: rest.slice(unit.alias.length).trim() }
}
