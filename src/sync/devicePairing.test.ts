import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDevicePairing, normalizePairingCode, redeemDevicePairing } from './devicePairing'
import { decryptJson, sha256Digest } from './crypto'

describe('device pairing', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('normalizes human formatting and rejects short, ambiguous, or malformed codes before a request', async () => {
    expect(normalizePairingCode('abcd-efgh jkmn-pqrs')).toBe('ABCDEFGHJKMNPQRS')
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(redeemDevicePairing('123456')).rejects.toThrow('16-character')
    await expect(redeemDevicePairing('OOOO-OOOO-OOOO-OOOO')).rejects.toThrow('16-character')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('encrypts the access capability and sends only the code hash', async () => {
    let body: Record<string, string> = {}
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        body = JSON.parse(init.body)
        return new Response(JSON.stringify({ expiresAt: '2030-01-01T00:10:00Z' }))
      }),
    )
    const key = 'synthetic-capability'.padEnd(43, 'x')
    const result = await createDevicePairing('synthetic-id', key)
    const code = normalizePairingCode(result.code)
    expect(code).toHaveLength(16)
    expect(body.codeHash).toBe(await sha256Digest(code))
    expect(body.encryptedPayload).not.toContain(key)
    expect(JSON.stringify(body)).not.toContain(code)
    expect(await decryptJson(body.encryptedPayload, code)).toEqual({ id: 'synthetic-id', key })
    await expect(decryptJson(body.encryptedPayload, 'wrong-code')).rejects.toThrow()
  })
  it('reports expired, reused, and unavailable codes without leaking a capability', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404 })),
    )
    await expect(redeemDevicePairing('ABCD-EFGH-JKMN-PQRS')).rejects.toThrow('expired, was already used')
  })
})
