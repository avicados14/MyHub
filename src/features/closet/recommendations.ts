import type { ClothingTemperatureBand } from '../../domain/types'
import { type Garment, type GarmentType, type Occasion } from './types'

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
export interface SuggestionOptions {
  warmer?: boolean
  jacket?: boolean
  includeAvoid?: boolean
  variant?: number
  keptIds?: string[]
  previousIds?: string[]
  usage?: Record<string, number>
}
export function planOutfit(
  items: Garment[],
  low: number | null,
  occasion: Occasion,
  bands: ClothingTemperatureBand[] = [],
  options: SuggestionOptions = {},
): OutfitSuggestion {
  const messages: string[] = []
  if (bands.length && (low === null || !Number.isFinite(low) || low < -150 || low > 150))
    return {
      items: [],
      messages: ['Enter a feels-like low or wait for weather before suggesting an outfit.'],
      needsTank: false,
    }
  const band = bands.length ? temperatureBand(bands, low!, options.warmer) : undefined
  if (bands.length && !band)
    return {
      items: [],
      messages: ['Temperature bands are invalid or do not cover this temperature. Review Clothing profile.'],
      needsTank: false,
    }
  if (!bands.length) messages.push('No active temperature bands configured. Add them in Clothing profile.')
  const clean = items.filter((i) => i.laundry_status === 'clean' && (options.includeAvoid || i.preference !== 'avoid'))
  const keptIds = new Set(options.keptIds ?? [])
  const kept = clean.filter((i) => keptIds.has(i.id))
  const pools: Record<string, Garment[]> = {
    top: clean.filter((i) => (band ? typeOf(i) === band.top : i.category === 'tops')),
    bottom: clean.filter((i) => (band ? typeOf(i) === band.bottom : i.category === 'bottoms')),
    shoes: clean.filter((i) => (band ? typeOf(i) === 'shoes' : i.category === 'shoes')),
    tank: band?.tank ? clean.filter((i) => typeOf(i) === 'tank') : [],
    jacket:
      options.jacket || (!band && low !== null && low < 62)
        ? clean.filter((i) => (band ? typeOf(i) === 'jacket' : i.category === 'outerwear'))
        : [],
    one: !band ? clean.filter((i) => i.category === 'one-piece') : [],
  }
  if (
    kept.length !== keptIds.size ||
    kept.some((i) => !Object.values(pools).some((pool) => pool.some((p) => p.id === i.id))) ||
    Object.values(pools).some((pool) => pool.filter((i) => keptIds.has(i.id)).length > 1)
  )
    return {
      items: [],
      band,
      messages: ['A kept garment is no longer clean or does not fit these settings. Release it and suggest again.'],
      needsTank: false,
    }
  const pool = (role: string) => {
    const choices = pools[role]!
    const fixed = choices.filter((i) => keptIds.has(i.id))
    return fixed.length ? fixed : choices
  }
  const previous = new Set(options.previousIds ?? [])
  const score = (outfit: Garment[]) =>
    outfit.reduce((sum, item, index) => {
      const preference = item.preference === 'preferred' ? 10 : item.preference === 'avoid' ? -10 : 0
      const occasionScore =
        ['Office', 'Date night'].includes(occasion) && /shirt|blouse|dress|chino|loafer/.test(item.name.toLowerCase())
          ? 2
          : 0
      return (
        sum +
        preference +
        occasionScore +
        outfit.slice(index + 1).reduce((total, other) => total + colorScore(item.primary_color, other.primary_color), 0)
      )
    }, 0)
  const choose = (choices: Garment[][], anchors: Garment[]) => {
    const candidates = choices.map((choice) => {
      const all = [...new Map([...choice, ...anchors].map((i) => [i.id, i])).values()]
      return {
        choice,
        compatible: all.every((i, n) =>
          all.slice(n + 1).every((other) => colorScore(i.primary_color, other.primary_color) >= 0),
        ),
        score: score(all),
        repeats: choice.filter((i) => !keptIds.has(i.id) && previous.has(i.id)).length,
        usage: choice.reduce((sum, i) => sum + (keptIds.has(i.id) ? 0 : (options.usage?.[i.id] ?? 0)), 0),
      }
    })
    const compatible = candidates.filter((c) => c.compatible)
    // If nothing coordinates, retain only the best available color/preference match.
    const bestScore = candidates.reduce((best, c) => Math.max(best, c.score), -Infinity)
    const eligible = compatible.length ? compatible : candidates.filter((c) => c.score === bestScore)
    eligible.sort(
      (a, b) =>
        a.repeats - b.repeats ||
        a.usage - b.usage ||
        b.score - a.score ||
        a.choice
          .map((i) => i.garment_number)
          .join(',')
          .localeCompare(b.choice.map((i) => i.garment_number).join(','), undefined, { numeric: true }),
    )
    const best = eligible[0]
    if (!best) return undefined
    const ties = eligible.filter((c) => c.repeats === best.repeats && c.usage === best.usage && c.score === best.score)
    const variant = Number.isFinite(options.variant) ? Math.max(0, Math.floor(options.variant!)) : 0
    if (!compatible.length)
      messages.push('No fully color-compatible alternative is available; showing the closest available match.')
    return ties[variant % ties.length]!.choice
  }
  const base =
    pool('top').length && pool('bottom').length && !pool('one').some((i) => keptIds.has(i.id))
      ? pool('top').flatMap((top) => pool('bottom').map((bottom) => [top, bottom]))
      : pool('one').map((one) => [one])
  const selected = choose(base, kept)
  if (
    !selected ||
    kept.some(
      (i) => (pools.top!.includes(i) || pools.bottom!.includes(i) || pools.one!.includes(i)) && !selected.includes(i),
    )
  )
    return {
      items: [],
      band,
      messages: [
        `No clean ${band ? `${band.top} and ${band.bottom}` : 'top and bottom or one-piece'} combination is available. Run laundry or review clothing settings.`,
      ],
      needsTank: Boolean(band?.tank),
    }
  for (const role of ['shoes', 'tank', 'jacket']) {
    const next = choose(
      pool(role).map((i) => [i]),
      [...selected, ...kept],
    )?.[0]
    if (next) selected.push(next)
    else if (role === 'shoes') messages.push('No clean shoes are available in the wardrobe.')
    else if (role === 'tank' && band?.tank)
      messages.push(
        'This band requires a tank undershirt. Tank quantities are not tracked; confirm you have a clean tank.',
      )
    else if (role === 'jacket' && options.jacket)
      messages.push('No clean preferred/regular jacket is available. Less-preferred jackets require opting in.')
  }
  if (selected.every((i) => keptIds.has(i.id)))
    messages.push('All suggested items are kept. Uncheck Keep this item to change part of the outfit.')
  else if (selected.some((i) => previous.has(i.id) && !keptIds.has(i.id)))
    messages.push('Some unkept items repeated because the available clean, color-compatible combinations are limited.')
  return {
    items: selected,
    band,
    messages: [...new Set(messages)],
    needsTank: Boolean(band?.tank && !selected.some((i) => typeOf(i) === 'tank')),
  }
}
