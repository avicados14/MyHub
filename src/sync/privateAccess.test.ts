import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyData } from '../domain/defaults'
import {
  createPrivateAccessUrl,
  PRIVATE_ACCESS_ID_PARAMETER,
  PRIVATE_ACCESS_KEY_PARAMETER,
  pushPrivateAppData,
  resolvePrivateAccess,
  type PrivateAccessMaterial,
} from './privateAccess'

const material: PrivateAccessMaterial = {
  repository: {
    owner: 'private-owner',
    repo: 'private-data',
    path: 'myhub-data/v1/snapshot.enc',
  },
  token: 'github-token-for-private-data',
  passphrase: 'correct horse battery staple',
}

const data = { ...createEmptyData(), settings: { ...createEmptyData().settings, name: 'Private Link User' } }
const brokerUrl = 'https://broker.example.test/functions/v1/myhub-private-access'
const linkId = '11111111-1111-4111-8111-111111111111'
const updatedAt = '2026-09-23T18:00:00.000Z'

describe('private access links', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('stores client-encrypted credentials and AppData, then opens both without a setup form', async () => {
    let encryptedPayload = ''
    let encryptedData = ''
    const request = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      if (body.action === 'create') {
        encryptedPayload = String(body.encryptedPayload)
        encryptedData = String(body.encryptedData)
        expect(body.githubToken).toBe(material.token)
        expect(body.writeToken).toEqual(expect.stringMatching(/^myhub-write-/u))
        return new Response(JSON.stringify({ id: linkId, version: 1, updatedAt }), { status: 201 })
      }
      expect(body).toEqual({ action: 'resolve', id: linkId })
      return new Response(JSON.stringify({ encryptedPayload, encryptedData, version: 1, updatedAt }), { status: 200 })
    })
    vi.stubGlobal('fetch', request)

    const link = await createPrivateAccessUrl(material, data, 'https://example.test/MyHub/#/settings', brokerUrl)
    const parsed = new URL(link.url)
    const hashQuery = new URLSearchParams(parsed.hash.split('?')[1])
    const key = hashQuery.get(PRIVATE_ACCESS_KEY_PARAMETER) ?? ''

    expect(parsed.search).toBe('')
    expect(parsed.hash.startsWith('#/access?')).toBe(true)
    expect(hashQuery.get(PRIVATE_ACCESS_ID_PARAMETER)).toBe(linkId)
    expect(link.url).not.toContain(material.token)
    expect(link.url).not.toContain(material.passphrase)
    expect(encryptedPayload).not.toContain(material.token)
    expect(encryptedPayload).not.toContain(material.passphrase)
    expect(encryptedData).not.toContain('Private Link User')
    await expect(resolvePrivateAccess(linkId, key, brokerUrl)).resolves.toEqual(
      expect.objectContaining({ material, data, id: linkId, key, version: 1, updatedAt }),
    )
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('pushes an encrypted AppData revision with the expected version', async () => {
    let requestBody: Record<string, unknown> = {}
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
        return new Response(JSON.stringify({ version: 4, updatedAt }), { status: 200 })
      }),
    )

    await expect(pushPrivateAppData(linkId, 'private-link-key', data, 3, brokerUrl)).resolves.toEqual({
      version: 4,
      updatedAt,
    })
    expect(requestBody).toEqual(
      expect.objectContaining({
        action: 'push',
        id: linkId,
        expectedVersion: 3,
        writeToken: 'myhub-write-private-link-key',
        encryptedData: expect.any(String),
      }),
    )
    expect(String(requestBody.encryptedData)).not.toContain('Private Link User')
  })

  it('surfaces revoked and conflicting broker responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'This private access link was revoked or does not exist.' }), {
            status: 404,
          }),
      ),
    )
    await expect(resolvePrivateAccess(linkId, 'valid-private-link-key', brokerUrl)).rejects.toThrow('revoked')
    await expect(resolvePrivateAccess('', '', brokerUrl)).rejects.toThrow('incomplete')

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'A newer Supabase copy exists.', currentVersion: 7 }), { status: 409 }),
      ),
    )
    const conflict = await pushPrivateAppData(linkId, 'valid-private-link-key', data, 6, brokerUrl).catch(
      (error: Error & { status?: number; currentVersion?: number }) => error,
    )
    expect(conflict).toEqual(expect.objectContaining({ status: 409, currentVersion: 7 }))
  })
})
