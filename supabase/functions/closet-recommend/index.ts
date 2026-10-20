import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { geminiRequest, geminiOutput } from './gemini.ts'
import { parseInput, smartPools, validateSmartOutput } from './logic.ts'

Deno.serve(async (request: Request) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://avicados14.github.io',
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  }
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return reply(405, { error: 'POST required' })
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    })
    const { data, error } = await client.auth.getUser()
    if (error || !data.user) return reply(401, { error: 'Authentication required' })
    const key = Deno.env.get('GEMINI_API_KEY')
    const configuredModel = Deno.env.get('CLOSET_AI_MODEL') || Deno.env.get('CLOST_AI_MODEL')
    const model = configuredModel?.startsWith('gemini-') ? configuredModel : 'gemini-3.5-flash-lite'
    if (!key || !model || Deno.env.get('CLOSET_AI_ENABLED') !== 'true')
      return reply(503, {
        code: 'AI_NOT_CONFIGURED',
        error: 'Smart Suggest is not configured. Use the regular suggester.',
      })
    const text = await request.text()
    if (text.length > 16000) return reply(413, { error: 'Request too large' })
    let input
    try {
      input = parseInput(JSON.parse(text))
    } catch {
      return reply(400, { error: 'Invalid planning settings' })
    }
    // User JWT + ownership filter + existing active-session RLS. No service-role client.
    const clean = await client
      .from('wardrobe_items')
      .select('id,name,category,garment_type,primary_color,preference,laundry_status')
      .eq('user_id', data.user.id)
      .eq('laundry_status', 'clean')
      .limit(501)
    if (clean.error) return reply(403, { error: 'Closet unavailable' })
    if (clean.data.length > 500) return reply(422, { error: 'Use the regular suggester for this wardrobe size' })
    let pools
    try {
      pools = smartPools(clean.data, input)
    } catch {
      return reply(422, { error: 'Review your clean clothes and kept items' })
    }
    if (!/^gemini-[a-z0-9.-]*flash[a-z0-9.-]*$/.test(model))
      return reply(503, { code: 'AI_NOT_CONFIGURED', error: 'Configure a Gemini Flash model.' })
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify(geminiRequest(input, pools)),
    })
    if (!response.ok)
      return reply(response.status === 429 ? 429 : 502, {
        error:
          response.status === 429
            ? 'Gemini quota or rate limit reached. Use the regular suggester.'
            : 'Gemini Smart Suggest is temporarily unavailable.',
      })
    const output = geminiOutput(await response.json())
    const validated = validateSmartOutput(output, clean.data, input)
    // Recheck ownership/cleanliness after the model call; saving still uses the atomic clean-only RPC.
    const fresh = await client
      .from('wardrobe_items')
      .select('id')
      .eq('user_id', data.user.id)
      .eq('laundry_status', 'clean')
      .in('id', validated.ids)
    if (fresh.error || fresh.data.length !== validated.ids.length)
      return reply(409, { error: 'Wardrobe changed; refresh and try again' })
    return reply(200, { ...validated, source: 'ai' })
  } catch {
    // Never log credentials, wardrobe metadata, prompts, or provider response bodies.
    return reply(502, { error: 'Smart Suggest could not produce a valid outfit. Use the regular suggester.' })
  }
})
