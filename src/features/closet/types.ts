export const categories = [
  'tops',
  'bottoms',
  'outerwear',
  'shoes',
  'accessories',
  'one-piece',
  'activewear',
  'other',
] as const
export const occasions = ['Everyday', 'School', 'Office', 'Date night', 'Weekend', 'Travel'] as const
export type Category = (typeof categories)[number]
export type Occasion = (typeof occasions)[number]
export interface Garment {
  id: string
  user_id: string
  garment_number: number
  name: string
  category: Category
  primary_color: string
  image_path: string
  laundry_status: 'clean' | 'dirty'
  content_hash: string
  dhash: string | null
  import_key: string
  created_at: string
  updated_at: string
}
export interface OutfitPlan {
  id: string
  planned_date: string
  occasion: Occasion
  title: string
  note: string | null
  garment_snapshot: Garment[]
  created_at: string
}
export function recommend(items: Garment[], temperature: number | null, occasion: Occasion): Garment[] {
  const clean = items.filter((item) => item.laundry_status === 'clean')
  const score = (item: Garment) => {
    const text = item.name.toLowerCase()
    return (
      (['Office', 'Date night'].includes(occasion) && /shirt|blouse|dress|chino|loafer/.test(text) ? 2 : 0) +
      (['School', 'Travel', 'Weekend'].includes(occasion) && /tee|sneaker|jean|hoodie/.test(text) ? 2 : 0)
    )
  }
  const pick = (category: Category) =>
    clean
      .filter((item) => item.category === category)
      .sort((a, b) => score(b) - score(a) || a.garment_number - b.garment_number)[0]
  const top = pick('tops'),
    bottom = pick('bottoms'),
    one = pick('one-piece')
  const base = top && bottom ? [top, bottom] : one ? [one] : []
  if (!base.length) return []
  return [...base, ...(temperature !== null && temperature < 62 ? [pick('outerwear')] : []), pick('shoes')].filter(
    (item): item is Garment => Boolean(item),
  )
}
