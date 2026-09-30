// Generate the portable shape from the existing TypeScript source of truth.
import ts from 'typescript'
import { readFile, writeFile } from 'node:fs/promises'
import { format, resolveConfig } from 'prettier'
const program = ts.createProgram(['src/domain/types.ts'], { strict: true, target: ts.ScriptTarget.ESNext })
const checker = program.getTypeChecker()
const source = program.getSourceFile('src/domain/types.ts')
const definitions = {}
function schema(type) {
  if (type.flags & ts.TypeFlags.StringLiteral) return { const: type.value }
  if (type.flags & ts.TypeFlags.NumberLiteral) return { const: type.value }
  if (type.flags & ts.TypeFlags.BooleanLiteral) return { const: type.intrinsicName === 'true' }
  if (type.flags & ts.TypeFlags.Null) return { type: 'null' }
  if (type.isUnion()) return { anyOf: type.types.filter((t) => !(t.flags & ts.TypeFlags.Undefined)).map(schema) }
  if (
    type.flags & ts.TypeFlags.StringLike ||
    (type.isIntersection() && type.types.some((t) => t.flags & ts.TypeFlags.String))
  )
    return { type: 'string' }
  if (type.flags & ts.TypeFlags.NumberLike) return { type: 'number' }
  if (type.flags & ts.TypeFlags.BooleanLike) return { type: 'boolean' }
  if (checker.isArrayType(type)) return { type: 'array', items: schema(checker.getTypeArguments(type)[0]) }
  const name = type.symbol?.name
  if (name && name !== '__type') {
    if (!definitions[name]) {
      definitions[name] = {}
      definitions[name] = object(type)
    }
    return { $ref: `#/$defs/${name}` }
  }
  if (type.flags & ts.TypeFlags.Object) return object(type)
  throw new Error(`Unsupported contract type: ${checker.typeToString(type)}`)
}
function object(type) {
  const properties = {},
    required = []
  for (const property of checker.getPropertiesOfType(type)) {
    properties[property.name] = schema(checker.getTypeOfSymbolAtLocation(property, property.valueDeclaration))
    if (!(property.flags & ts.SymbolFlags.Optional)) required.push(property.name)
  }
  return { type: 'object', properties, required, additionalProperties: false }
}
const declaration = source.statements.find((node) => node.name?.text === 'AppData')
const root = schema(checker.getTypeAtLocation(declaration))
const result = await format(
  JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'MyHub AppData v2',
    ...root,
    $defs: definitions,
  }),
  { ...(await resolveConfig('contracts/v2/app-data.schema.json')), parser: 'json' },
)
const path = 'contracts/v2/app-data.schema.json'
if (process.argv.includes('--check')) {
  if ((await readFile(path, 'utf8')) !== result)
    throw new Error('Contract drift: run npm run contract:generate and review the diff.')
} else await writeFile(path, result)
