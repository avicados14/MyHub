import { decryptJson, encryptJson, sha256Digest } from './crypto'
import { PRIVATE_ACCESS_BROKER_URL, resolvePrivateAccess } from './privateAccess'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const normalizePairingCode = (value: string): string => {
  const code = value.toUpperCase().replace(/[\s-]/gu, '')
  if (code.length !== 16 || [...code].some((letter) => !alphabet.includes(letter))) {
    throw new Error('Enter the 16-character code shown on your connected device.')
  }
  return code
}
const request = async (body: Record<string, unknown>, url: string): Promise<Record<string, unknown>> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  })
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? 'This code expired, was already used, or is unavailable. Generate a new code on your connected device.'
        : 'Device sign-in is unavailable. Check your connection and try again.',
    )
  const result: unknown = await response.json()
  if (!result || typeof result !== 'object') throw new Error('Device sign-in returned an invalid response.')
  return result as Record<string, unknown>
}
export const createDevicePairing = async (id: string, key: string, url = PRIVATE_ACCESS_BROKER_URL) => {
  // 80 random bits: a short numeric PIN would be guessable without a separate approval channel.
  const code = [...crypto.getRandomValues(new Uint8Array(16))].map((byte) => alphabet[byte & 31]).join('')
  const encryptedPayload = await encryptJson({ id, key }, code)
  const result = await request(
    {
      action: 'pair-create',
      id,
      writeToken: `myhub-write-${key}`,
      codeHash: await sha256Digest(code),
      encryptedPayload,
    },
    url,
  )
  if (typeof result.expiresAt !== 'string' || !Number.isFinite(Date.parse(result.expiresAt))) {
    throw new Error('Device sign-in returned an invalid expiry.')
  }
  return { code: code.match(/.{4}/gu)!.join('-'), expiresAt: result.expiresAt }
}
export const cancelDevicePairing = async (id: string, key: string, url = PRIVATE_ACCESS_BROKER_URL) => {
  await request({ action: 'pair-cancel', id, writeToken: `myhub-write-${key}` }, url)
}
export const redeemDevicePairing = async (input: string, url = PRIVATE_ACCESS_BROKER_URL) => {
  const code = normalizePairingCode(input)
  const result = await request({ action: 'pair-redeem', codeHash: await sha256Digest(code) }, url)
  if (typeof result.encryptedPayload !== 'string') throw new Error('Invalid device sign-in package.')
  const access = await decryptJson<{ id: string; key: string }>(result.encryptedPayload, code)
  if (!access || typeof access.id !== 'string' || typeof access.key !== 'string' || access.key.length !== 43) {
    throw new Error('Invalid device sign-in package. Generate a new code.')
  }
  return resolvePrivateAccess(access.id, access.key, url)
}
