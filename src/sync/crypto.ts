const ENVELOPE_FORMAT = 'myhub-encrypted'
const ENVELOPE_VERSION = 1 as const
const PBKDF2_ITERATIONS = 310_000
const SALT_BYTES = 16
const IV_BYTES = 12

export interface EncryptedEnvelope {
  format: typeof ENVELOPE_FORMAT
  version: typeof ENVELOPE_VERSION
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    salt: string
  }
  cipher: {
    name: 'AES-GCM'
    keyLength: 256
    iv: string
  }
  ciphertext: string
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const base64ToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

const importPassphrase = (passphrase: string): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey'])

const deriveKey = async (passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> => {
  const keyMaterial = await importPassphrase(passphrase)
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

const authenticatedMetadata = (envelope: Omit<EncryptedEnvelope, 'ciphertext'>): Uint8Array<ArrayBuffer> =>
  encoder.encode(JSON.stringify(envelope))

const parseEnvelope = (serialized: string): EncryptedEnvelope => {
  let value: unknown
  try {
    value = JSON.parse(serialized)
  } catch {
    throw new Error('The encrypted snapshot is not valid JSON.')
  }
  if (typeof value !== 'object' || value === null) throw new Error('The encrypted snapshot is invalid.')
  const envelope = value as Partial<EncryptedEnvelope>
  if (
    envelope.format !== ENVELOPE_FORMAT ||
    envelope.version !== ENVELOPE_VERSION ||
    envelope.kdf?.name !== 'PBKDF2' ||
    envelope.kdf.hash !== 'SHA-256' ||
    envelope.kdf.iterations < PBKDF2_ITERATIONS ||
    envelope.cipher?.name !== 'AES-GCM' ||
    envelope.cipher.keyLength !== 256 ||
    typeof envelope.kdf.salt !== 'string' ||
    typeof envelope.cipher.iv !== 'string' ||
    typeof envelope.ciphertext !== 'string'
  ) {
    throw new Error('This encrypted snapshot version or algorithm is not supported.')
  }
  return envelope as EncryptedEnvelope
}

export const encryptText = async (plaintext: string, passphrase: string): Promise<string> => {
  if (!passphrase) throw new Error('Enter an encryption passphrase.')
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES)) as Uint8Array<ArrayBuffer>
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES)) as Uint8Array<ArrayBuffer>
  const metadata: Omit<EncryptedEnvelope, 'ciphertext'> = {
    format: ENVELOPE_FORMAT,
    version: ENVELOPE_VERSION,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: bytesToBase64(salt) },
    cipher: { name: 'AES-GCM', keyLength: 256, iv: bytesToBase64(iv) },
  }
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: authenticatedMetadata(metadata), tagLength: 128 },
    key,
    encoder.encode(plaintext),
  )
  return JSON.stringify({
    ...metadata,
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  } satisfies EncryptedEnvelope)
}

export const decryptText = async (serialized: string, passphrase: string): Promise<string> => {
  const envelope = parseEnvelope(serialized)
  const { ciphertext, ...metadata } = envelope
  try {
    const key = await deriveKey(passphrase, base64ToBytes(envelope.kdf.salt), envelope.kdf.iterations)
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64ToBytes(envelope.cipher.iv),
        additionalData: authenticatedMetadata(metadata),
        tagLength: 128,
      },
      key,
      base64ToBytes(ciphertext),
    )
    return decoder.decode(plaintext)
  } catch {
    throw new Error('The passphrase is incorrect or the encrypted snapshot was changed.')
  }
}

export const encryptJson = async <T>(value: T, passphrase: string): Promise<string> =>
  encryptText(JSON.stringify(value), passphrase)

export const decryptJson = async <T>(serialized: string, passphrase: string): Promise<T> =>
  JSON.parse(await decryptText(serialized, passphrase)) as T

export const sha256Digest = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return bytesToBase64(new Uint8Array(digest))
}

export const APP_DATA_ENVELOPE_VERSION = ENVELOPE_VERSION
export const MINIMUM_PBKDF2_ITERATIONS = PBKDF2_ITERATIONS
