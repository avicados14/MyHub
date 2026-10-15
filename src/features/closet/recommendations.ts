import type { ClothingTemperatureBand } from '../../domain/types'
import { recommend, type Garment, type GarmentType, type Occasion } from './types'

export function inferType(name: string, category: string): GarmentType {
  const text = name.toLowerCase()
  if (category === 'shoes') return 'shoes'
  if (category === 'accessories') return 'accessory'
  if (category === 'one-piece') return 'one-piece'
  if (category === 'outerwear') return 'jacket'
  if (category === 'bottoms')
    return /shorts/.test(text) ? 'shorts' : /pants|sweats|jeans|trousers/.test(text) ? 'pants' : 'unknown'
  if (category === 'tops') {
    if (/tank/.test(text)) return 'tank'
    if (/hoodie|sweatshirt/.test(text)) return 'sweatshirt'
    if (/long[ -]sleeve|flannel/.test(text)) return 'long-sleeve'
    if (/short[ -]sleeve|t-shirt|tee/.test(text)) return 'short-sleeve'
  }
  return 'unknown'
}
export const typeOf = (item: Garment) =>
  item.garment_type && item.garment_type !== 'unknown' ? item.garment_type : inferType(item.name, item.category)
export function validBands(bands: ClothingTemperatureBand[]) {
  return (
    bands.length > 0 &&
    bands.length <= 12 &&
    new Set(bands.map((b) => b.minF)).size === bands.length &&
    bands.every(
      (b) =>
        Number.isFinite(b.minF) &&
        b.minF >= -150 &&
        b.minF <= 150 &&
        ['short-sleeve', 'long-sleeve', 'sweatshirt'].includes(b.top) &&
        ['shorts', 'pants'].includes(b.bottom) &&
        typeof b.tank === 'boolean',
    )
  )
}
export function temperatureBand(bands: ClothingTemperatureBand[], low: number, warmer = false) {
  if (!validBands(bands) || !Number.isFinite(low)) return undefined
  const sorted = [...bands].sort((a, b) => b.minF - a.minF)
  const index = sorted.findIndex((b) => low >= b.minF)
  if (index < 0) return undefined
  return sorted[Math.min(index + (warmer ? 1 : 0), sorted.length - 1)]
}
// Deterministic color heuristics, not a classifier. Multi-color metadata is supported.
function colors(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/navy|blueish|bluish/g, 'blue')
      .replace(/grey/g, 'gray')
      .replace(/cream/g, 'beige')
      .replace(/olive/g, 'green')
      .replace(/coral/g, 'pink')
      .match(/black|white|gray|beige|tan|brown|blue|green|red|pink|purple|orange|yellow/g) ?? []
  )
}
export function colorScore(a: string, b: string) {
  const left = colors(a),
    right = colors(b)
  if (!left.length || !right.length) return 0
  const neutrals = ['black', 'white', 'gray', 'beige', 'tan', 'brown']
  if (left.some((c) => neutrals.includes(c)) || right.some((c) => neutrals.includes(c))) return 4
  if (left.some((c) => right.includes(c))) return 2
  if (left.includes('blue') || right.includes('blue')) return 3
  return -2
}
export interface OutfitSuggestion {
  items: Garment[]
  messages: string[]
  band?: ClothingTemperatureBand
  needsTank: boolean
}
export function planOutfit(
  items: Garment[],
  low: number | null,
  occasion: Occasion,
  bands: ClothingTemperatureBand[] = [],
  options: { warmer?: boolean; jacket?: boolean; includeAvoid?: boolean; variant?: number } = {},
): OutfitSuggestion {
  if (!bands.length)
    return {
      items: recommend(items, low, occasion),
      messages: ['No active temperature bands configured. Add them in Clothing profile.'],
      needsTank: false,
    }
  if (low === null || !Number.isFinite(low) || low < -150 || low > 150)
    return {
      items: [],
      messages: ['Enter a feels-like low or wait for weather before suggesting an outfit.'],
      needsTank: false,
    }
  const band = temperatureBand(bands, low, options.warmer)
  if (!band)
    return {
      items: [],
      messages: ['Temperature bands are invalid or do not cover this temperature. Review Clothing profile.'],
      needsTank: false,
    }
  const clean = items.filter((i) => i.laundry_status === 'clean' && (options.includeAvoid || i.preference !== 'avoid'))
  const preference = (i: Garment) => (i.preference === 'preferred' ? 10 : i.preference === 'avoid' ? -10 : 0)
  const pickType = (type: GarmentType) =>
    clean
      .filter((i) => typeOf(i) === type)
      .sort((a, b) => preference(b) - preference(a) || a.garment_number - b.garment_number)
  const pairs = pickType(band.top)
    .slice(0, 100)
    .flatMap((top) =>
      pickType(band.bottom)
        .slice(0, 100)
        .map((bottom) => ({
          top,
          bottom,
          score: preference(top) + preference(bottom) + colorScore(top.primary_color, bottom.primary_color),
        })),
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.top.garment_number - b.top.garment_number ||
        a.bottom.garment_number - b.bottom.garment_number,
    )
  const compatible = pairs.filter((pair) => pair.score >= (pairs[0]?.score ?? 0) - 1)
  const pair = compatible[Math.max(0, options.variant ?? 0) % Math.min(compatible.length, 8)]
  if (!pair)
    return {
      items: [],
      band,
      messages: [
        `No clean ${band.top} and ${band.bottom} combination is available. Run laundry, edit clothing types, or explicitly include less-preferred items.`,
      ],
      needsTank: band.tank,
    }
  const selected = [pair.top, pair.bottom],
    messages: string[] = []
  const coordinate = (type: GarmentType) =>
    pickType(type).sort(
      (a, b) =>
        preference(b) +
          colorScore(pair.top.primary_color, b.primary_color) +
          colorScore(pair.bottom.primary_color, b.primary_color) -
          (preference(a) +
            colorScore(pair.top.primary_color, a.primary_color) +
            colorScore(pair.bottom.primary_color, a.primary_color)) || a.garment_number - b.garment_number,
    )[0]
  const shoes = coordinate('shoes')
  if (shoes) selected.push(shoes)
  else messages.push('No clean shoes are available in the wardrobe.')
  const tank = band.tank ? coordinate('tank') : undefined
  if (tank) selected.push(tank)
  if (band.tank && !tank)
    messages.push(
      'This band requires a tank undershirt. Tank quantities are not tracked; confirm you have a clean tank.',
    )
  if (options.jacket) {
    const jacket = coordinate('jacket')
    if (jacket) selected.push(jacket)
    else messages.push('No clean preferred/regular jacket is available. Less-preferred jackets require opting in.')
  }
  return { items: selected, band, messages, needsTank: band.tank && !tank }
}
