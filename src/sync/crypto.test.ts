import { describe, expect, it } from 'vitest'
import { decryptJson, encryptJson, MINIMUM_PBKDF2_ITERATIONS } from './crypto'

describe('encrypted envelopes', () => {
  it('round trips JSON with PBKDF2-SHA-256 and AES-256-GCM', async () => {
    const encrypted = await encryptJson({ private: 'academic and food data' }, 'correct horse battery staple')
    const envelope = JSON.parse(encrypted) as {
      kdf: { iterations: number; hash: string }
      cipher: { name: string; keyLength: number }
    }
    expect(envelope.kdf.iterations).toBeGreaterThanOrEqual(MINIMUM_PBKDF2_ITERATIONS)
    expect(envelope.kdf.hash).toBe('SHA-256')
    expect(envelope.cipher).toEqual(expect.objectContaining({ name: 'AES-GCM', keyLength: 256 }))
    await expect(decryptJson(encrypted, 'correct horse battery staple')).resolves.toEqual({
      private: 'academic and food data',
    })
  })

  it('rejects ciphertext tampering', async () => {
    const encrypted = await encryptJson({ value: 42 }, 'correct horse battery staple')
    const envelope = JSON.parse(encrypted) as { ciphertext: string }
    envelope.ciphertext = `${envelope.ciphertext.slice(0, -2)}AA`
    await expect(decryptJson(JSON.stringify(envelope), 'correct horse battery staple')).rejects.toThrow(
      /incorrect|changed/,
    )
  })

  it('rejects a wrong passphrase', async () => {
    const encrypted = await encryptJson({ value: 42 }, 'correct horse battery staple')
    await expect(decryptJson(encrypted, 'totally wrong passphrase')).rejects.toThrow(/incorrect|changed/)
  })
})
