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
