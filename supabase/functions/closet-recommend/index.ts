import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
// Deliberately disabled scaffolding. No model request or private photo transfer occurs.
Deno.serve(async (request: Request) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://avicados14.github.io',
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const { data, error } = await client.auth.getUser()
  if (error || !data.user)
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers })
  // A future implementation must use this user-scoped query, validate weather/occasion/note,
  // and validate structured model output IDs against this exact clean-item set.
  const clean = await client
    .from('wardrobe_items')
    .select('id,garment_number,name,category,primary_color')
    .eq('user_id', data.user.id)
    .eq('laundry_status', 'clean')
  if (clean.error) return new Response(JSON.stringify({ error: 'Closet unavailable' }), { status: 403, headers })
  return new Response(
    JSON.stringify({
      enabled: false,
      code: 'AI_NOT_CONFIGURED',
      message: 'Use the built-in rule-based planner. Server-side OpenAI recommendations are not enabled.',
    }),
    { status: 503, headers },
  )
})
