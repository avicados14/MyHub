import { createEmptyData } from '../domain/defaults'
import { isCurrentAppData, migrateAppData } from '../domain/migrations'
import type { AppData, MyHubBackup } from '../domain/types'

const DB_NAME = 'myhub-local'
const APPLICATION_STORE = 'application'
const CREDENTIAL_STORE = 'credentials'
const STATE_KEY = 'state'
const GITHUB_CREDENTIAL_KEY = 'github-sync'
const DB_VERSION = 2

export interface StoredGitHubCredential {
  version: 1
  repository: { owner: string; repo: string; path: string }
  tokenEnvelope: string
  paused: boolean
  currentSha?: string
  lastSyncedDigest?: string
  lastSyncedAt?: string
}

const requestResult = <T,>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'))
  })

const openDatabase = async (): Promise<IDBDatabase> => {
  const request = indexedDB.open(DB_NAME, DB_VERSION)
  request.onupgradeneeded = () => {
    const database = request.result
    if (!database.objectStoreNames.contains(APPLICATION_STORE)) database.createObjectStore(APPLICATION_STORE)
    if (!database.objectStoreNames.contains(CREDENTIAL_STORE)) database.createObjectStore(CREDENTIAL_STORE)
  }
  return requestResult(request)
}

export const loadAppData = async (): Promise<AppData> => {
  const database = await openDatabase()
  const transaction = database.transaction(APPLICATION_STORE, 'readonly')
  const value: unknown = await requestResult(transaction.objectStore(APPLICATION_STORE).get(STATE_KEY))
  database.close()
  if (value === undefined) return createEmptyData()
  return migrateAppData(value)
}

export const saveAppData = async (data: AppData): Promise<void> => {
  const database = await openDatabase()
  const transaction = database.transaction(APPLICATION_STORE, 'readwrite')
  transaction.objectStore(APPLICATION_STORE).put(data, STATE_KEY)
  await transactionDone(transaction)
  database.close()
}

export const clearAppData = async (): Promise<void> => {
  const database = await openDatabase()
  const transaction = database.transaction(APPLICATION_STORE, 'readwrite')
  transaction.objectStore(APPLICATION_STORE).delete(STATE_KEY)
  await transactionDone(transaction)
  database.close()
}

export const loadGitHubCredential = async (): Promise<StoredGitHubCredential | null> => {
  const database = await openDatabase()
  const transaction = database.transaction(CREDENTIAL_STORE, 'readonly')
  const value: unknown = await requestResult(transaction.objectStore(CREDENTIAL_STORE).get(GITHUB_CREDENTIAL_KEY))
  database.close()
  return isStoredGitHubCredential(value) ? value : null
}

export const saveGitHubCredential = async (credential: StoredGitHubCredential): Promise<void> => {
  const database = await openDatabase()
  const transaction = database.transaction(CREDENTIAL_STORE, 'readwrite')
  transaction.objectStore(CREDENTIAL_STORE).put(credential, GITHUB_CREDENTIAL_KEY)
  await transactionDone(transaction)
  database.close()
}

export const clearGitHubCredential = async (): Promise<void> => {
  const database = await openDatabase()
  const transaction = database.transaction(CREDENTIAL_STORE, 'readwrite')
  transaction.objectStore(CREDENTIAL_STORE).delete(GITHUB_CREDENTIAL_KEY)
  await transactionDone(transaction)
  database.close()
}

export const createBackup = (data: AppData): MyHubBackup => ({
  format: 'myhub-backup',
  formatVersion: 2,
  appVersion: '0.2.0',
  exportedAt: new Date().toISOString(),
  data,
})

export const parseBackup = (text: string): MyHubBackup => {
  const value: unknown = JSON.parse(text)
  if (!isRecord(value) || value.format !== 'myhub-backup' || (value.formatVersion !== 1 && value.formatVersion !== 2)) {
    throw new Error('This file is not a supported MyHub backup. Choose a MyHub JSON export.')
  }
  const data = migrateAppData(value.data)
  if (!isCurrentAppData(data)) throw new Error('The backup data is incomplete or unsupported.')
  return {
    format: 'myhub-backup',
    formatVersion: 2,
    appVersion: typeof value.appVersion === 'string' ? value.appVersion : 'unknown',
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date().toISOString(),
    data,
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isStoredGitHubCredential = (value: unknown): value is StoredGitHubCredential => {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.repository)) return false
  return typeof value.repository.owner === 'string'
    && typeof value.repository.repo === 'string'
    && typeof value.repository.path === 'string'
    && typeof value.tokenEnvelope === 'string'
    && typeof value.paused === 'boolean'
}

export { isCurrentAppData as isAppData }
