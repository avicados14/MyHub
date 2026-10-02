import contract from '../../contracts/v2/app-data.schema.json'

// Deliberately implements only the subset emitted by generate-contract.mjs.
// Errors never contain record values or unknown property names.
interface Shape {
  $ref?: string
  anyOf?: Shape[]
  const?: unknown
  type?: string
  items?: Shape
  properties?: Record<string, Shape>
  required?: string[]
  additionalProperties?: boolean
}
const definitions: Record<string, Shape> = contract.$defs
const matches = (value: unknown, shape: Shape): boolean => {
  if (shape.$ref) return matches(value, definitions[shape.$ref.replace('#/$defs/', '')]!)
  if (shape.anyOf) return shape.anyOf.some((candidate) => matches(value, candidate))
  if ('const' in shape) return value === shape.const
  if (shape.type === 'null') return value === null
  if (shape.type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (shape.type === 'string' || shape.type === 'boolean') return typeof value === shape.type
  if (shape.type === 'array') return Array.isArray(value) && value.every((item) => matches(item, shape.items!))
  if (shape.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const record = value as Record<string, unknown>
    return (
      (shape.required ?? []).every((key) => Object.hasOwn(record, key)) &&
      Object.entries(record).every(
        ([key, item]) => Object.hasOwn(shape.properties ?? {}, key) && matches(item, shape.properties![key]!),
      )
    )
  }
  return false
}

export const validatePortableData = (value: unknown): void => {
  if (!matches(value, contract)) {
    throw new Error('The backup contains incomplete, unsupported, or invalid records. No data was imported.')
  }
}
