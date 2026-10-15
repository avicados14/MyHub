import { describe, expect, it, vi, afterEach } from 'vitest'
import { colorScore, planOutfit, temperatureBand, validBands } from './recommendations'
import type { Garment, GarmentType } from './types'
import type { ClothingTemperatureBand } from '../../domain/types'
import { weather } from './api'
import { defaults } from './import'

const bands: ClothingTemperatureBand[] = [
  { minF: 68, top: 'short-sleeve', bottom: 'shorts', tank: false },
  { minF: 48, top: 'long-sleeve', bottom: 'pants', tank: true },
  { minF: -150, top: 'sweatshirt', bottom: 'pants', tank: true },
]
const garment = (number: number, type: GarmentType, color = 'gray', patch: Partial<Garment> = {}): Garment => ({
  id: `fixture-${number}`,
  user_id: 'fixture',
  garment_number: number,
  name: `Fixture ${type}`,
  category: type === 'pants' || type === 'shorts' ? 'bottoms' : 'tops',
  garment_type: type,
  preference: 'normal',
  primary_color: color,
  image_path: null,
  content_hash: null,
  dhash: null,
  import_key: `fixture-${number}`,
  created_at: '',
  updated_at: '',
  laundry_status: 'clean',
  ...patch,
})
afterEach(() => vi.unstubAllGlobals())
describe('active personal wardrobe rules', () => {
  it('does not confuse short sleeves, sweatshirts, and shorts on import', () => {
    expect(defaults('tan-short-sleeve-shirt.jpg').category).toBe('tops')
    expect(defaults('orange-hoodie.jpg').category).toBe('tops')
    expect(defaults('white-sweatshirt.jpg').category).toBe('tops')
    expect(defaults('white-sweats.jpg').category).toBe('bottoms')
    expect(defaults('mesh-shorts.jpg').category).toBe('bottoms')
    expect(defaults('tan-short-sleeve-shirt.jpg').color).toBe('tan')
  })
  it('uses inclusive boundaries without rounding and one warmer band', () => {
    expect(temperatureBand(bands, 68)?.top).toBe('short-sleeve')
    expect(temperatureBand(bands, 67.99)?.top).toBe('long-sleeve')
    expect(temperatureBand(bands, 48)?.top).toBe('long-sleeve')
    expect(temperatureBand(bands, 47.99)?.top).toBe('sweatshirt')
    expect(temperatureBand(bands, 68, true)?.top).toBe('long-sleeve')
    expect(temperatureBand(bands, -20, true)?.top).toBe('sweatshirt')
    expect(validBands([...bands, bands[0]!])).toBe(false)
    expect(temperatureBand(bands, NaN)).toBeUndefined()
  })
  it('uses photo-free items, matches colors, and excludes dirty or wrong-temperature items', () => {
    const items = [
      garment(1, 'long-sleeve', 'purple'),
      garment(2, 'pants', 'orange'),
      garment(3, 'pants', 'gray'),
      garment(4, 'shorts'),
      garment(5, 'short-sleeve'),
      garment(6, 'pants', 'white', { laundry_status: 'dirty' }),
    ]
    const result = planOutfit(items, 55, 'School', bands)
    expect(result.items.map((i) => i.garment_number)).toEqual([1, 3])
    expect(result.needsTank).toBe(true)
    expect(colorScore('purple', 'gray')).toBeGreaterThan(colorScore('purple', 'orange'))
    items[2]!.laundry_status = 'dirty'
    expect(planOutfit(items, 55, 'School', bands).items.map((i) => i.garment_number)).toEqual([1, 2])
    items[2]!.laundry_status = 'clean'
    expect(planOutfit(items, 55, 'School', bands).items.map((i) => i.garment_number)).toEqual([1, 3])
  })
  it('does not silently substitute a dirty or less-preferred item or omit the tank requirement', () => {
    const items = [
      garment(1, 'sweatshirt'),
      garment(2, 'pants', 'gray', { preference: 'avoid' }),
      garment(3, 'tank', 'white', { laundry_status: 'dirty' }),
    ]
    expect(planOutfit(items, 20, 'Travel', bands).items).toEqual([])
    expect(planOutfit(items, 20, 'Travel', bands, { includeAvoid: true }).needsTank).toBe(true)
    items[2]!.laundry_status = 'clean'
    const result = planOutfit(items, 20, 'Travel', bands, { includeAvoid: true })
    expect(result.items.map((i) => i.garment_number)).toEqual([1, 2, 3])
    expect(result.needsTank).toBe(false)
  })
  it('selects preferred jackets only when requested and fails safely without weather', () => {
    const items = [
      garment(1, 'short-sleeve'),
      garment(2, 'shorts'),
      garment(3, 'jacket', 'black', { preference: 'preferred' }),
      garment(4, 'jacket', 'gray', { preference: 'avoid' }),
    ]
    expect(planOutfit(items, 75, 'Everyday', bands).items).toHaveLength(2)
    expect(planOutfit(items, 75, 'Everyday', bands, { jacket: true }).items.map((i) => i.garment_number)).toEqual([
      1, 2, 3,
    ])
    expect(planOutfit(items, null, 'Everyday', bands).items).toEqual([])
  })
  it('uses the selected date daily apparent low, preserves precision, and rejects missing forecasts', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current: { temperature_2m: 90 },
        daily: { time: ['2026-06-01', '2026-06-02'], apparent_temperature_min: [67.99, 42] },
      }),
    })
    vi.stubGlobal('fetch', fetch)
    expect(await weather('2026-06-01')).toBe(67.99)
    expect(await weather('2026-06-02')).toBe(42)
    expect(fetch.mock.calls[0]![0]).toContain('daily=apparent_temperature_min')
    expect(fetch.mock.calls[0]![0]).toContain('temperature_unit=fahrenheit')
    await expect(weather('2026-07-01')).rejects.toThrow('No feels-like forecast')
  })
})
