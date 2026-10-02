import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { expect, it } from 'vitest'

it('rejects malformed creation before revoking the current access link', async () => {
  const source = readFileSync('supabase/functions/myhub-private-access/index.ts', 'utf8').replace(/^import .*\n/gm, '')
  let handler: (request: Request) => Promise<Response> = () => Promise.reject(new Error('Handler missing'))
  let mutations = 0
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(compiled, {
    TextEncoder,
    crypto,
    Response,
    Deno: { env: { get: () => 'synthetic-test-config' }, serve: (value: typeof handler) => (handler = value) },
    response: (_request: Request, body: unknown, status = 200) => Response.json(body, { status }),
    fetch: async () =>
      Response.json({ full_name: 'avicados14/MyHub-Data', private: true, permissions: { pull: true, push: true } }),
    createClient: () => ({
      from: () => ({
        update: () => {
          mutations += 1
          return { is: async () => ({ error: null }) }
        },
      }),
    }),
  })
  const response = await handler(
    new Request('https://example.invalid/broker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', githubToken: 'synthetic-token-for-mocked-verification' }),
    }),
  )
  expect(response.status).toBe(400)
  expect(mutations).toBe(0)
})

it.each([false, true])('uses one atomic replacement call (database failure: %s)', async (fails) => {
  const source = readFileSync('supabase/functions/myhub-private-access/index.ts', 'utf8').replace(/^import .*\n/gm, '')
  let handler: (request: Request) => Promise<Response> = () => Promise.reject(new Error('Handler missing'))
  let calls = 0
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(compiled, {
    TextEncoder,
    crypto,
    Response,
    btoa,
    Deno: { env: { get: () => 'synthetic-test-config' }, serve: (value: typeof handler) => (handler = value) },
    response: (_request: Request, body: unknown, status = 200) => Response.json(body, { status }),
    fetch: async () =>
      Response.json({ full_name: 'avicados14/MyHub-Data', private: true, permissions: { pull: true, push: true } }),
    createClient: () => ({
      from: () => {
        throw new Error('Creation must not perform standalone mutations')
      },
      rpc: (name: string, args: Record<string, string>) => {
        calls += 1
        expect(name).toBe('replace_myhub_private_access')
        expect(args.new_write_token_hash).toMatch(/^[A-Za-z0-9_-]{43}$/u)
        expect(args.new_write_token_hash).not.toBe('x'.repeat(40))
        return {
          single: async () =>
            fails
              ? { data: null, error: { message: 'synthetic insertion failure' } }
              : { data: { id: 'synthetic-id', data_version: 1, data_updated_at: '2026-10-01T00:00:00Z' }, error: null },
        }
      },
    }),
  })
  const envelope = JSON.stringify({ format: 'myhub-encrypted', ciphertext: 'x'.repeat(100) })
  const result = await handler(
    new Request('https://example.invalid/broker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        githubToken: 'synthetic-token-for-mocked-verification',
        encryptedPayload: envelope,
        encryptedData: envelope,
        writeToken: 'x'.repeat(40),
      }),
    }),
  )
  expect(calls).toBe(1)
  expect(result.status).toBe(fails ? 503 : 201)
  expect(await result.json()).toEqual(
    fails
      ? { error: 'A private access link could not be created.' }
      : { id: 'synthetic-id', version: 1, updatedAt: '2026-10-01T00:00:00Z' },
  )
})

it.each([null, [], 'invalid', { action: 'pair-redeem', codeHash: '123456' }, { action: 'pair-create' }])(
  'rejects malformed device requests before database mutation: %j',
  async (body) => {
    const source = readFileSync('supabase/functions/myhub-private-access/index.ts', 'utf8').replace(
      /^import .*\n/gm,
      '',
    )
    let handler: (request: Request) => Promise<Response> = () => Promise.reject(new Error('Handler missing'))
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
    vm.runInNewContext(compiled, {
      TextEncoder,
      crypto,
      Response,
      btoa,
      Deno: { env: { get: () => 'synthetic-test-config' }, serve: (value: typeof handler) => (handler = value) },
      response: (_request: Request, value: unknown, status = 200) => Response.json(value, { status }),
      createClient: () => ({
        rpc: () => {
          throw new Error('Malformed request reached database')
        },
      }),
    })
    const result = await handler(
      new Request('https://example.invalid/broker', { method: 'POST', body: JSON.stringify(body) }),
    )
    expect(result.status).toBe(400)
  },
)
