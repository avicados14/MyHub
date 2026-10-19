export interface SmartItem {
  id: string
  name: string
  garment_type?: string
  category: string
  primary_color: string
  preference?: string
  laundry_status: string
}
export interface SmartInput {
  low: number
  occasion: string
  note: string
  band: { top: string; bottom: string; tank: boolean }
  jacket: boolean
  includeAvoid: boolean
  keptIds: string[]
  previousIds: string[]
}
export function parseInput(value: unknown): SmartInput {
  if (!value || typeof value !== 'object') throw new Error('Invalid planning settings')
  const v = value as SmartInput
  const ids = (list: unknown): list is string[] =>
    Array.isArray(list) &&
    list.length <= 20 &&
    list.every((i) => typeof i === 'string' && i.length <= 80) &&
    new Set(list).size === list.length
  if (
    !Number.isFinite(v.low) ||
    v.low < -150 ||
    v.low > 150 ||
    !['Everyday', 'School', 'Office', 'Date night', 'Weekend', 'Travel'].includes(v.occasion) ||
    typeof v.note !== 'string' ||
    v.note.length > 1000 ||
    !v.band ||
    !['short-sleeve', 'long-sleeve', 'sweatshirt'].includes(v.band.top) ||
    !['shorts', 'pants'].includes(v.band.bottom) ||
    typeof v.band.tank !== 'boolean' ||
    typeof v.jacket !== 'boolean' ||
    typeof v.includeAvoid !== 'boolean' ||
    !ids(v.keptIds) ||
    !ids(v.previousIds)
  )
    throw new Error('Invalid planning settings')
  return v
}
export function smartPools(items: SmartItem[], input: SmartInput) {
  const types = [
    input.band.top,
    input.band.bottom,
    'shoes',
    ...(input.band.tank ? ['tank'] : []),
    ...(input.jacket ? ['jacket'] : []),
  ]
  const pools = types.map((type) => ({
    type,
    items: items.filter(
      (i) =>
        i.laundry_status === 'clean' && (input.includeAvoid || i.preference !== 'avoid') && i.garment_type === type,
    ),
  }))
  if (!pools[0]?.items.length || !pools[1]?.items.length) throw new Error('No clean clothes match the temperature band')
  const eligible = pools.flatMap((p) => p.items)
  if (
    input.keptIds.some((id) => !eligible.some((i) => i.id === id)) ||
    pools.some((p) => p.items.filter((i) => input.keptIds.includes(i.id)).length > 1)
  )
    throw new Error('Release kept items that no longer match')
  return pools.filter((p) => p.items.length)
}
export function validateSmartOutput(value: unknown, items: SmartItem[], input: SmartInput) {
  const pools = smartPools(items, input)
  const v = value as { ids?: unknown; explanation?: unknown } | null
  const ids = Array.isArray(v?.ids) ? v.ids : []
  if (
    !v ||
    !Array.isArray(v.ids) ||
    v.ids.length !== pools.length ||
    new Set(v.ids).size !== v.ids.length ||
    !v.ids.every((id) => typeof id === 'string') ||
    input.keptIds.some((id) => !ids.includes(id)) ||
    pools.some((pool) => pool.items.filter((i) => ids.includes(i.id)).length !== 1) ||
    typeof v.explanation !== 'string' ||
    !v.explanation.trim() ||
    v.explanation.length > 1200
  )
    throw new Error('Invalid AI outfit')
  return { ids: v.ids as string[], explanation: v.explanation }
}
