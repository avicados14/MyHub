import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const GITHUB_REPOSITORY = 'avicados14/MyHub-Data'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const PRODUCTION_ORIGIN = 'https://avicados14.github.io'
const encoder = new TextEncoder()

const corsOrigin = (request: Request): string => {
  const origin = request.headers.get('origin') ?? ''
  if (
    origin === PRODUCTION_ORIGIN ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.startsWith('http://localhost:')
  ) {
    return origin
  }
  return PRODUCTION_ORIGIN
}

const response = (request: Request, body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin(request),
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
      'Referrer-Policy': 'no-referrer',
      Vary: 'Origin',
    },
  })

const isEncryptedEnvelope = (value: unknown, maximum: number): value is string => {
  if (typeof value !== 'string' || value.length < 100 || value.length > maximum) return false
  try {
    return (JSON.parse(value) as { format?: unknown }).format === 'myhub-encrypted'
  } catch {
    return false
  }
}

const hashWriteToken = async (token: string): Promise<string> => {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token)))
  let binary = ''
  for (const byte of digest) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

const safeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

const verifyGitHubToken = async (token: unknown): Promise<boolean> => {
  if (typeof token !== 'string' || token.length < 20 || token.length > 1_000) return false
  const githubResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'MyHub-private-access-broker',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!githubResponse.ok) return false
  const repository = (await githubResponse.json()) as {
    full_name?: string
    private?: boolean
    permissions?: { pull?: boolean; push?: boolean }
  }
  return (
    repository.full_name === GITHUB_REPOSITORY &&
    repository.private === true &&
    repository.permissions?.pull === true &&
    repository.permissions?.push === true
  )
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return response(request, {}, 204)
  if (request.method !== 'POST') return response(request, { error: 'Method not allowed.' }, 405)

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return response(request, { error: 'Invalid JSON request.' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return response(request, { error: 'Broker configuration is unavailable.' }, 503)
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (body.action === 'resolve') {
    if (typeof body.id !== 'string' || !UUID_PATTERN.test(body.id)) {
      return response(request, { error: 'This private access link is invalid.' }, 400)
    }
    const { data, error } = await supabase
      .from('myhub_private_access')
      .select('encrypted_payload, encrypted_data, data_version, data_updated_at')
      .eq('id', body.id)
      .is('revoked_at', null)
      .maybeSingle()
    if (error) return response(request, { error: 'Private access is temporarily unavailable.' }, 503)
    if (!data) return response(request, { error: 'This private access link was revoked or does not exist.' }, 404)
    await supabase.from('myhub_private_access').update({ last_resolved_at: new Date().toISOString() }).eq('id', body.id)
    return response(request, {
      encryptedPayload: data.encrypted_payload,
      encryptedData: data.encrypted_data,
      version: data.data_version,
      updatedAt: data.data_updated_at,
    })
  }

  if (body.action === 'push') {
    if (
      typeof body.id !== 'string' ||
      !UUID_PATTERN.test(body.id) ||
      typeof body.writeToken !== 'string' ||
      body.writeToken.length < 32 ||
      body.writeToken.length > 200 ||
      !isEncryptedEnvelope(body.encryptedData, 10_000_000) ||
      !Number.isSafeInteger(body.expectedVersion) ||
      Number(body.expectedVersion) < 1
    ) {
      return response(request, { error: 'The encrypted data update is invalid.' }, 400)
    }
    const { data: current, error: readError } = await supabase
      .from('myhub_private_access')
      .select('write_token_hash, data_version')
      .eq('id', body.id)
      .is('revoked_at', null)
      .maybeSingle()
    if (readError) return response(request, { error: 'Private data is temporarily unavailable.' }, 503)
    if (!current) return response(request, { error: 'This private access link was revoked or does not exist.' }, 404)
    if (!current.write_token_hash || !safeEqual(current.write_token_hash, await hashWriteToken(body.writeToken))) {
      return response(request, { error: 'This device cannot update the private MyHub record.' }, 403)
    }
    if (current.data_version !== body.expectedVersion) {
      return response(request, { error: 'A newer Supabase copy exists.', currentVersion: current.data_version }, 409)
    }
    const nextVersion = current.data_version + 1
    const updatedAt = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from('myhub_private_access')
      .update({ encrypted_data: body.encryptedData, data_version: nextVersion, data_updated_at: updatedAt })
      .eq('id', body.id)
      .eq('data_version', current.data_version)
      .is('revoked_at', null)
      .select('data_version, data_updated_at')
      .maybeSingle()
    if (updateError) return response(request, { error: 'Private data could not be updated.' }, 503)
    if (!updated)
      return response(request, { error: 'A newer Supabase copy exists.', currentVersion: current.data_version }, 409)
    return response(request, { version: updated.data_version, updatedAt: updated.data_updated_at })
  }

  if (body.action !== 'create' && body.action !== 'revoke') {
    return response(request, { error: 'Unsupported broker action.' }, 400)
  }
  if (!(await verifyGitHubToken(body.githubToken))) {
    return response(request, { error: 'The GitHub credential cannot manage the private MyHub data repository.' }, 403)
  }

  const now = new Date().toISOString()
  const { error: revokeError } = await supabase
    .from('myhub_private_access')
    .update({ revoked_at: now })
    .is('revoked_at', null)
  if (revokeError) return response(request, { error: 'Existing private links could not be revoked.' }, 503)
  if (body.action === 'revoke') return response(request, { revoked: true })

  if (
    !isEncryptedEnvelope(body.encryptedPayload, 16_000) ||
    !isEncryptedEnvelope(body.encryptedData, 10_000_000) ||
    typeof body.writeToken !== 'string' ||
    body.writeToken.length < 32 ||
    body.writeToken.length > 200
  ) {
    return response(request, { error: 'The encrypted private access package is invalid.' }, 400)
  }

  const { data, error } = await supabase
    .from('myhub_private_access')
    .insert({
      encrypted_payload: body.encryptedPayload,
      encrypted_data: body.encryptedData,
      write_token_hash: await hashWriteToken(body.writeToken),
    })
    .select('id, data_version, data_updated_at')
    .single()
  if (error || !data) return response(request, { error: 'A private access link could not be created.' }, 503)
  return response(request, { id: data.id, version: data.data_version, updatedAt: data.data_updated_at }, 201)
})
