import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { brokerResponse as response } from '../myhub-private-access/http.ts'

const hash = async (token: string) => {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}
const equal = (a: string, b: string) => {
  let diff = a.length ^ b.length
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return response(request, {}, 204)
  if (request.method !== 'POST') return response(request, { error: 'Method not allowed' }, 405)
  try {
    const raw = await request.text()
    if (raw.length > 1024) return response(request, { error: 'Request too large' }, 413)
    const body = JSON.parse(raw)
    if (
      typeof body.id !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(body.id) ||
      typeof body.writeToken !== 'string' ||
      body.writeToken.length < 32 ||
      body.writeToken.length > 200
    )
      return response(request, { error: 'Invalid device credential' }, 400)
    const url = Deno.env.get('SUPABASE_URL')!,
      key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: access, error } = await admin
      .from('myhub_private_access')
      .select('write_token_hash')
      .eq('id', body.id)
      .is('revoked_at', null)
      .maybeSingle()
    if (error) throw error
    if (!access?.write_token_hash || !equal(access.write_token_hash, await hash(body.writeToken)))
      return response(request, { error: 'Open an active MyHub private link to access your closet.' }, 403)
    const identity = await admin.rpc('closet_identity_record').single()
    if (identity.error) throw identity.error
    const record = identity.data as { email: string; user_id: string | null }
    let userId = record.user_id
    if (!userId) {
      // Provision the reserved service-owned identity without sending email.
      const provisioned = await admin.auth.admin.generateLink({ type: 'magiclink', email: record.email })
      if (provisioned.error) throw provisioned.error
      userId = provisioned.data.user.id
      const mapped = await admin.rpc('closet_identity_record', { new_user_id: userId })
      if (mapped.error) throw mapped.error
    }
    // Generate a fresh login token; generateLink never sends email.
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: record.email })
    if (link.error) throw link.error
    const verificationType = link.data.properties.verification_type
    if (verificationType !== 'magiclink' && verificationType !== 'signup') throw new Error('Unexpected OTP type')
    const verifier = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const verified = await verifier.auth.verifyOtp({
      token_hash: link.data.properties.hashed_token,
      type: verificationType,
    })
    if (verified.error || !verified.data.session || verified.data.user?.id !== userId)
      throw verified.error ?? new Error('Session identity mismatch')
    // Recheck revocation after session issuance. RLS independently checks it on every request.
    const active = await admin
      .from('myhub_private_access')
      .select('id')
      .eq('id', body.id)
      .is('revoked_at', null)
      .maybeSingle()
    if (active.error || !active.data) return response(request, { error: 'Private link revoked' }, 403)
    const session = verified.data.session
    // verifyOtp issued this trusted JWT. Bind its immutable session ID before exposing tokens.
    const payload = session.access_token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')))
    if (typeof claims.session_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(claims.session_id))
      throw new Error('Missing Auth session')
    const bound = await admin.rpc('closet_bind_session', {
      new_session_id: claims.session_id,
      new_user_id: userId,
      new_access_id: body.id,
    })
    if (bound.error) throw bound.error
    return response(request, {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user_id: userId,
    })
  } catch {
    return response(request, { error: 'Closet sign-in is temporarily unavailable. Retry in a moment.' }, 503)
  }
})
