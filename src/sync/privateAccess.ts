import { decryptJson, encryptJson } from './crypto'
import type { AppData } from '../domain/types'
import type { GitHubRepositoryTarget } from './githubClient'

export const PRIVATE_ACCESS_BROKER_URL = 'https://vlsxvwqmzcriarcctubr.supabase.co/functions/v1/myhub-private-access'
export const PRIVATE_ACCESS_ID_PARAMETER = 'id'
export const PRIVATE_ACCESS_KEY_PARAMETER = 'key'

export interface PrivateAccessMaterial {
  repository: GitHubRepositoryTarget
  token: string
  passphrase: string
}

export interface PrivateAccessLink {
  id: string
  url: string
  key: string
  version: number
  updatedAt: string
}

export interface ResolvedPrivateAccess extends PrivateAccessLink {
  material: PrivateAccessMaterial
  data: AppData
  writeToken: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isNonEmptyString = (value: unknown, maximum: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= maximum

const validateMaterial = (value: unknown): PrivateAccessMaterial => {
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
    throw new Error('This private access package is invalid.')
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

const randomCapability = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

const writeTokenForKey = (key: string): string => `myhub-write-${key}`

const brokerRequest = async (body: Record<string, unknown>, brokerUrl: string): Promise<Record<string, unknown>> => {
  const response = await fetch(brokerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  })
  let result: unknown
  try {
    result = await response.json()
  } catch {
    throw new Error('Private access returned an unreadable response.')
  }
  if (!response.ok) {
    const error = new Error(
      isRecord(result) && typeof result.error === 'string' ? result.error : 'Private access failed.',
    ) as Error & { status?: number; currentVersion?: number }
    error.status = response.status
    if (isRecord(result) && typeof result.currentVersion === 'number') error.currentVersion = result.currentVersion
    throw error
  }
  if (!isRecord(result)) throw new Error('Private access returned an invalid response.')
  return result
}

const numberField = (record: Record<string, unknown>, key: string): number => {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error('Private access returned an invalid data version.')
  }
  return value
}

const stringField = (record: Record<string, unknown>, key: string, maximum: number): string => {
  const value = record[key]
  if (!isNonEmptyString(value, maximum)) throw new Error('Private access returned invalid data.')
  return value
}

export const createPrivateAccessUrl = async (
  material: PrivateAccessMaterial,
  data: AppData,
  baseUrl = window.location.href,
  brokerUrl = PRIVATE_ACCESS_BROKER_URL,
): Promise<PrivateAccessLink> => {
  const key = randomCapability()
  const validatedMaterial = validateMaterial(material)
  const encryptedPayload = await encryptJson(validatedMaterial, key)
  const encryptedData = await encryptJson(data, key)
  const result = await brokerRequest(
    {
      action: 'create',
      githubToken: material.token,
      encryptedPayload,
      encryptedData,
      writeToken: writeTokenForKey(key),
    },
    brokerUrl,
  )
  const id = stringField(result, 'id', 100)
  const version = numberField(result, 'version')
  const updatedAt = stringField(result, 'updatedAt', 100)

  const url = new URL(baseUrl)
  url.search = ''
  url.hash = `/access?${PRIVATE_ACCESS_ID_PARAMETER}=${encodeURIComponent(id)}&${PRIVATE_ACCESS_KEY_PARAMETER}=${encodeURIComponent(key)}`
  return { id, key, url: url.toString(), version, updatedAt }
}

export const resolvePrivateAccess = async (
  id: string,
  key: string,
  brokerUrl = PRIVATE_ACCESS_BROKER_URL,
): Promise<ResolvedPrivateAccess> => {
  if (!isNonEmptyString(id, 100) || !isNonEmptyString(key, 100)) {
    throw new Error('This private access link is incomplete.')
  }
  const result = await brokerRequest({ action: 'resolve', id }, brokerUrl)
  const encryptedPayload = stringField(result, 'encryptedPayload', 16_000)
  const encryptedData = stringField(result, 'encryptedData', 10_000_000)
  try {
    return {
      id,
      key,
      url: '',
      version: numberField(result, 'version'),
      updatedAt: stringField(result, 'updatedAt', 100),
      writeToken: writeTokenForKey(key),
      material: validateMaterial(await decryptJson(encryptedPayload, key)),
      data: await decryptJson<AppData>(encryptedData, key),
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'This private access package is invalid.') throw error
    throw new Error('This private access link is invalid or has been changed.')
  }
}

export const pushPrivateAppData = async (
  id: string,
  key: string,
  data: AppData,
  expectedVersion: number,
  brokerUrl = PRIVATE_ACCESS_BROKER_URL,
): Promise<{ version: number; updatedAt: string }> => {
  const result = await brokerRequest(
    {
      action: 'push',
      id,
      writeToken: writeTokenForKey(key),
      encryptedData: await encryptJson(data, key),
      expectedVersion,
    },
    brokerUrl,
  )
  return { version: numberField(result, 'version'), updatedAt: stringField(result, 'updatedAt', 100) }
}
