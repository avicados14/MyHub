import { describe, expect, it } from 'vitest'
import {
  createDevicePairingLink,
  DEVICE_PAIRING_LIFETIME_MS,
  inspectDevicePairingParameter,
  unlockDevicePairingParameter,
} from './devicePairing'

const now = Date.UTC(2026, 8, 23, 16, 45)
const material = {
  repository: { owner: 'private-owner', repo: 'private-data', path: 'myhub-data/v1/snapshot.enc' },
  token: 'github-token-visible-only-after-local-decode',
  passphrase: 'correct horse battery staple',
}

describe('device pairing', () => {
  it('round-trips an encrypted setup package whose URL does not contain either secret or the pairing code', async () => {
    const result = await createDevicePairingLink(material, 'https://example.com/MyHub/?release=current#/', now)
    const url = new URL(result.url)
    const parameter = new URLSearchParams(url.hash.split('?')[1]).get('pair') ?? ''

    expect(url.origin + url.pathname + url.search).toBe('https://example.com/MyHub/')
    expect(result.url).not.toContain(material.token)
    expect(result.url).not.toContain(material.passphrase)
    expect(result.url).not.toContain(result.pairingCode)
    expect(result.pairingCode).toMatch(/^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/u)
    expect(result.expiresAt).toBe(now + DEVICE_PAIRING_LIFETIME_MS)
    expect(inspectDevicePairingParameter(parameter, now + 1_000)).toEqual({ expiresAt: result.expiresAt })
    await expect(unlockDevicePairingParameter(parameter, result.pairingCode, now + 1_000)).resolves.toEqual(material)
  })

  it('rejects expired, malformed, incomplete, and incorrectly unlocked setup packages', async () => {
    const result = await createDevicePairingLink(material, 'https://example.com/MyHub/', now)
    const parameter = new URLSearchParams(new URL(result.url).hash.split('?')[1]).get('pair') ?? ''

    expect(() => inspectDevicePairingParameter(parameter, now + DEVICE_PAIRING_LIFETIME_MS + 1)).toThrow(
      'This device setup link expired.',
    )
    expect(() => inspectDevicePairingParameter('not-a-payload', now)).toThrow('This device setup link is invalid.')
    await expect(unlockDevicePairingParameter(parameter, 'TOO-SHORT', now)).rejects.toThrow('16-character')
    await expect(unlockDevicePairingParameter(parameter, 'AAAA-BBBB-CCCC-DDDD', now)).rejects.toThrow(
      'pairing code is incorrect',
    )
  })
})
