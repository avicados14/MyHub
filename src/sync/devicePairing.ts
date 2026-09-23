import { decryptJson, encryptJson } from './crypto'
import type { GitHubRepositoryTarget } from './githubClient'

const PAIRING_FORMAT = 'myhub-device-pairing'
const PAIRING_VERSION = 1 as const
const PAIRING_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PAIRING_CODE_LENGTH = 16
export const DEVICE_PAIRING_LIFETIME_MS = 5 * 60 * 1000

export interface DevicePairingMaterial {
  repository: GitHubRepositoryTarget
  token: string
  passphrase: string
}

interface DevicePairingPackage {
  format: typeof PAIRING_FORMAT
  version: typeof PAIRING_VERSION
  createdAt: number
  expiresAt: number
  encryptedMaterial: string
}

export interface DevicePairingLink {
  url: string
  pairingCode: string
  expiresAt: number
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

const base64UrlToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error('This device setup link is invalid.')
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    throw new Error('This device setup link is invalid.')
  }
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isNonEmptyString = (value: unknown, maximum: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= maximum

const normalizePairingCode = (value: string): string => value.toUpperCase().replace(/[^A-Z2-9]/gu, '')

const createPairingCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(PAIRING_CODE_LENGTH))
  let code = ''
  for (const byte of bytes) code += PAIRING_CODE_ALPHABET[byte % PAIRING_CODE_ALPHABET.length]
  return code.match(/.{1,4}/gu)?.join('-') ?? code
}

const parsePackage = (parameter: string, now: number): DevicePairingPackage => {
  if (!parameter || parameter.length > 16_000) throw new Error('This device setup link is invalid.')
  let value: unknown
  try {
    value = JSON.parse(decoder.decode(base64UrlToBytes(parameter)))
  } catch (error) {
    if (error instanceof Error && error.message === 'This device setup link is invalid.') throw error
    throw new Error('This device setup link is invalid.')
  }
  if (
    !isRecord(value) ||
    value.format !== PAIRING_FORMAT ||
    value.version !== PAIRING_VERSION ||
    typeof value.createdAt !== 'number' ||
    typeof value.expiresAt !== 'number' ||
    !isNonEmptyString(value.encryptedMaterial, 12_000) ||
    value.expiresAt <= value.createdAt ||
    value.expiresAt - value.createdAt > DEVICE_PAIRING_LIFETIME_MS
  ) {
    throw new Error('This device setup link is invalid.')
  }
  if (now > value.expiresAt) throw new Error('This device setup link expired. Create a new code on a connected device.')
  return value as unknown as DevicePairingPackage
}

const validateMaterial = (value: unknown): DevicePairingMaterial => {
  if (
    !isRecord(value) ||
    !isRecord(value.repository) ||
    !isNonEmptyString(value.repository.owner, 100) ||
    !isNonEmptyString(value.repository.repo, 100) ||
    !isNonEmptyString(value.repository.path, 500) ||
    !isNonEmptyString(value.token, 1_000) ||
    !isNonEmptyString(value.passphrase, 1_000) ||
    value.passphrase.length < 12
  ) {
    throw new Error('This device setup package is invalid.')
  }
  return {
    repository: {
      owner: value.repository.owner,
      repo: value.repository.repo,
      path: value.repository.path,
    },
    token: value.token,
    passphrase: value.passphrase,
  }
}

export const createDevicePairingLink = async (
  material: DevicePairingMaterial,
  baseUrl: string,
  now = Date.now(),
): Promise<DevicePairingLink> => {
  const pairingCode = createPairingCode()
  const expiresAt = now + DEVICE_PAIRING_LIFETIME_MS
  const payload: DevicePairingPackage = {
    format: PAIRING_FORMAT,
    version: PAIRING_VERSION,
    createdAt: now,
    expiresAt,
    encryptedMaterial: await encryptJson(material, normalizePairingCode(pairingCode)),
  }
  const parameter = bytesToBase64Url(encoder.encode(JSON.stringify(payload)))
  const url = new URL(baseUrl)
  url.search = ''
  url.hash = `/settings/device?pair=${encodeURIComponent(parameter)}`
  return { url: url.toString(), pairingCode, expiresAt }
}

export const inspectDevicePairingParameter = (parameter: string, now = Date.now()): { expiresAt: number } => ({
  expiresAt: parsePackage(parameter, now).expiresAt,
})

export const unlockDevicePairingParameter = async (
  parameter: string,
  pairingCode: string,
  now = Date.now(),
): Promise<DevicePairingMaterial> => {
  const normalizedCode = normalizePairingCode(pairingCode)
  if (normalizedCode.length !== PAIRING_CODE_LENGTH) {
    throw new Error('Enter the 16-character pairing code shown on the connected device.')
  }
  const payload = parsePackage(parameter, now)
  try {
    return validateMaterial(await decryptJson(payload.encryptedMaterial, normalizedCode))
  } catch (error) {
    if (error instanceof Error && error.message === 'This device setup package is invalid.') throw error
    throw new Error('The pairing code is incorrect or the setup link was changed.')
  }
}
