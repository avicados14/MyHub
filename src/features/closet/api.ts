import { createClient } from '@supabase/supabase-js'
import { loadPrivateAccessCredential } from '../../storage/database'
import type { Incoming } from './import'
import type { Garment, OutfitPlan, Occasion } from './types'
// Publishable keys are public identifiers. All access is enforced by Auth + RLS.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://vlsxvwqmzcriarcctubr.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_D4-6zCDhSxJW0hqTT9cPfw_-nNjIFwj'
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
let current: { id: string; userId: string; expires: number } | null = null
let connecting: Promise<string> | null = null
export async function authenticate(): Promise<string> {
  const credential = await loadPrivateAccessCredential()
  if (!credential) {
    current = null
    await client.auth.signOut({ scope: 'local' })
    throw new Error('Open your MyHub private link first, or connect a device in Settings.')
  }
  if (current?.id === credential.id && current.expires > Date.now() + 60_000) return current.userId
  if (connecting) return connecting
  connecting = (async () => {
    const response = await fetch(`${url}/functions/v1/myhub-closet-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: credential.id, writeToken: `myhub-write-${credential.key}` }),
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Could not open your private closet.')
    const session = await client.auth.setSession(result)
    if (session.error) throw session.error
    current = { id: credential.id, userId: result.user_id, expires: result.expires_at * 1000 }
    return result.user_id as string
  })().finally(() => {
    connecting = null
  })
  return connecting
}
async function allRows<T>(table: string, order: string): Promise<T[]> {
  const rows: T[] = []
  for (let start = 0; ; start += 500) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .order(order)
      .range(start, start + 499)
    if (error) throw error
    rows.push(...(data as T[]))
    if (data.length < 500) return rows
  }
}
export async function loadCloset() {
  await authenticate()
  const [items, plans] = await Promise.all([
    allRows<Garment>('wardrobe_items', 'garment_number'),
    allRows<OutfitPlan>('outfit_plans', 'planned_date'),
  ])
  return { items, plans: plans.reverse() }
}
export async function imageUrl(path: string) {
  await authenticate()
  const { data, error } = await client.storage.from('wardrobe').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}
export async function editGarment(
  id: string,
  patch: Pick<Garment, 'name' | 'category' | 'primary_color' | 'laundry_status'>,
) {
  await authenticate()
  const { data, error } = await client.from('wardrobe_items').update(patch).eq('id', id).select('id').single()
  if (error || !data) throw error ?? new Error('Garment no longer exists')
}
// Preserve objects referenced by immutable historical snapshots.
async function removeIfUnused(path: string) {
  const { data: items, error } = await client.from('wardrobe_items').select('id').eq('image_path', path)
  if (error) throw error
  const plans = await allRows<OutfitPlan>('outfit_plans', 'planned_date')
  if (!items.length && !plans.some((plan) => plan.garment_snapshot.some((item) => item.image_path === path))) {
    const removed = await client.storage.from('wardrobe').remove([path])
    if (removed.error)
      throw new Error('Saved successfully, but an unused image could not be removed. Retry cleanup later.')
  }
}
export async function deleteGarment(item: Garment) {
  await authenticate()
  const { error } = await client.from('wardrobe_items').delete().eq('id', item.id)
  if (error) throw error
  await removeIfUnused(item.image_path)
}
export async function saveIncoming(row: Incoming) {
  const userId = await authenticate(),
    path = `${userId}/${row.id}`
  const existing = await client
    .from('wardrobe_items')
    .select('*')
    .eq(row.choice === 'replace' ? 'id' : 'import_key', row.choice === 'replace' ? row.replaceId! : row.id)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data?.image_path === path) return
  if (row.choice === 'replace' && !existing.data)
    throw new Error('The garment to replace no longer exists. Review this file again.')
  const upload = await client.storage
    .from('wardrobe')
    .upload(path, row.file, { contentType: row.file.type, upsert: false })
  if (upload.error) {
    // A previous attempt may have uploaded successfully before its response was lost.
    const prior = await client.storage.from('wardrobe').download(path)
    if (prior.error) throw upload.error
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await prior.data.arrayBuffer())))
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
    if (hash !== row.hash) throw new Error('Retry image does not match the original upload.')
  }
  const metadata = {
    name: row.name,
    category: row.category,
    primary_color: row.color,
    image_path: path,
    content_hash: row.hash,
    dhash: row.dhash,
  }
  const result =
    row.choice === 'replace'
      ? await client.from('wardrobe_items').update(metadata).eq('id', row.replaceId!).select('id').single()
      : await client
          .from('wardrobe_items')
          .insert({ ...metadata, id: row.id, user_id: userId, import_key: row.id })
          .select('id')
          .single()
  if (result.error) {
    // Confirm absence before cleanup. If the outcome is unknown, retain the staged object for retry.
    const check = await client.from('wardrobe_items').select('id').eq('image_path', path)
    if (!check.error && check.data.length) return
    if (!check.error) await client.storage.from('wardrobe').remove([path])
    throw new Error(`Could not save ${row.file.name}. Retry is safe.`)
  }
  if (existing.data?.image_path) await removeIfUnused(existing.data.image_path)
}
export async function savePlan(
  id: string,
  date: string,
  occasion: Occasion,
  title: string,
  note: string,
  items: Garment[],
) {
  await authenticate()
  const { error } = await client.rpc('closet_save_plan', {
    plan_id: id,
    plan_date: date,
    plan_occasion: occasion,
    plan_title: title,
    plan_note: note,
    item_ids: items.map((item) => item.id),
  })
  if (error) throw error
}
export async function runLaundry() {
  const userId = await authenticate()
  const { error } = await client
    .from('wardrobe_items')
    .update({ laundry_status: 'clean' })
    .eq('user_id', userId)
    .eq('laundry_status', 'dirty')
  if (error) throw error
}
export async function weather(latitude = 39.7555, longitude = -105.2211) {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&temperature_unit=fahrenheit`,
    { signal: AbortSignal.timeout(12000) },
  )
  if (!response.ok) throw new Error('Weather unavailable')
  const result = await response.json()
  if (!Number.isFinite(result.current?.temperature_2m)) throw new Error('Weather unavailable')
  return Math.round(result.current.temperature_2m) as number
}
