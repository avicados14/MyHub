import type { AppData, MyHubBackup } from '../domain/types'
import { createDemoData } from '../domain/seed'

const DB_NAME = 'myhub-local'
const STORE_NAME = 'application'
const STATE_KEY = 'state'
const DB_VERSION = 1

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
    if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME)
  }
  return requestResult(request)
}

export const loadAppData = async (): Promise<AppData> => {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readonly')
  const data = await requestResult(transaction.objectStore(STORE_NAME).get(STATE_KEY))
  database.close()
  return isAppData(data) ? data : createDemoData()
}

export const saveAppData = async (data: AppData): Promise<void> => {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).put(data, STATE_KEY)
  await transactionDone(transaction)
  database.close()
}

export const clearAppData = async (): Promise<void> => {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).delete(STATE_KEY)
  await transactionDone(transaction)
  database.close()
}

export const createBackup = (data: AppData): MyHubBackup => ({
  format: 'myhub-backup',
  formatVersion: 1,
  appVersion: '0.1.0',
  exportedAt: new Date().toISOString(),
  data,
})

export const parseBackup = (text: string): MyHubBackup => {
  const value: unknown = JSON.parse(text)
  if (!isRecord(value) || value.format !== 'myhub-backup' || value.formatVersion !== 1 || !isAppData(value.data)) {
    throw new Error('This file is not a supported MyHub backup. Choose a MyHub JSON export created by version 0.1.x.')
  }
  return value as unknown as MyHubBackup
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

export const isAppData = (value: unknown): value is AppData => {
  if (!isRecord(value) || value.schemaVersion !== 1) return false
  const arrays = ['events', 'assignments', 'recipes', 'meals', 'foodLog', 'pantry', 'groceryHistory']
  return arrays.every((key) => Array.isArray(value[key])) && isRecord(value.settings)
}
