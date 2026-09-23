import { createHash, randomBytes } from 'node:crypto'
import type { Page } from '@playwright/test'
import { createEmptyData, createUnknownNutritionProvenance } from '../src/domain/defaults'
import type { AppData, GroceryHistoryEntry, MealSourceSnapshot, Recipe } from '../src/domain/types'
import { createTestFixtureData } from '../src/test/fixtures'
import { addDays, toLocalDate } from '../src/utilities/date'

const timestamp = '2026-09-22T12:00:00.000Z'
const entity = (id: string) => ({ id, createdAt: timestamp, updatedAt: timestamp, source: 'manual' as const })
const nutrition = { calories: 320, protein: 18, carbs: 42, fat: 9, fiber: 7, sodium: 410 }
const provenance = createUnknownNutritionProvenance(timestamp, 'Playwright fixture')

export const createCrosscutFixtureData = (today = new Date()): AppData => {
  const data = createTestFixtureData(today)
  const date = toLocalDate(today)
  const tomorrow = toLocalDate(addDays(today, 1))
  const twoDays = toLocalDate(addDays(today, 2))
  const threeDays = toLocalDate(addDays(today, 3))
  const sourceSnapshot: MealSourceSnapshot = {
    sourceType: 'custom',
    name: 'Night Shift Noodles',
    nutritionPerServing: nutrition,
    nutritionProvenance: provenance,
    capturedAt: timestamp,
  }
  const groceryHistory: GroceryHistoryEntry = {
    ...entity('history-campus-market'),
    name: 'Campus Market Run',
    completedAt: timestamp,
    items: [
      {
        ...entity('history-item-pistachios'),
        name: 'Pistachios',
        canonicalName: 'pistachios',
        quantity: 1,
        unit: 'bag',
        category: 'Snacks',
        checked: true,
        sourceRecipeIds: [],
        pantryQuantity: 0,
        pantryDecision: 'none',
      },
    ],
  }

  return {
    ...data,
    events: [
      {
        ...entity('event-afternoon'),
        title: 'Afternoon Seminar',
        course: 'CROSS 303',
        date,
        startTime: '14:00',
        endTime: '15:00',
        kind: 'event',
      },
      {
        ...entity('study-late'),
        title: 'Second Study Block',
        course: 'CROSS 202',
        date,
        startTime: '13:00',
        endTime: '13:45',
        kind: 'study',
      },
      {
        ...entity('event-morning'),
        title: 'Morning Studio',
        course: 'CROSS 101',
        date,
        startTime: '08:00',
        endTime: '08:45',
        kind: 'event',
      },
      {
        ...entity('study-early'),
        title: 'First Study Block',
        course: 'CROSS 101',
        date,
        startTime: '10:30',
        endTime: '11:15',
        kind: 'study',
        locked: true,
      },
    ],
    assignments: [
      {
        ...entity('assignment-third'),
        title: 'Third Deadline',
        course: 'CROSS 303',
        dueDate: threeDays,
        dueTime: '10:00',
        priority: 'high',
        estimatedMinutes: 60,
        progress: 0,
        status: 'not-started',
        notes: 'Quantum rubric',
        subtasks: [],
      },
      {
        ...entity('assignment-first'),
        title: 'First Deadline',
        course: 'CROSS 101',
        dueDate: tomorrow,
        dueTime: '08:00',
        priority: 'low',
        estimatedMinutes: 30,
        progress: 10,
        status: 'in-progress',
        notes: '',
        subtasks: [],
      },
      {
        ...entity('assignment-second'),
        title: 'Quantum Methods Review',
        course: 'CROSS 202',
        dueDate: twoDays,
        dueTime: '09:00',
        priority: 'medium',
        estimatedMinutes: 45,
        progress: 0,
        status: 'not-started',
        notes: '',
        subtasks: [],
      },
    ],
    packagedFoods: [
      {
        ...entity('packaged-trail-mix'),
        name: 'Trail Mix Packet',
        brand: 'Summit Foods',
        barcode: '000111222333',
        servingSize: { quantity: 1, unit: 'packet' },
        nutritionPerServing: nutrition,
        nutritionProvenance: provenance,
      },
    ],
    meals: [
      ...data.meals,
      {
        ...entity('meal-night-shift'),
        date: tomorrow,
        slot: 'dinner',
        customName: sourceSnapshot.name,
        servings: 1,
        preparedServings: 1,
        consumedServings: 0,
        sourceSnapshot,
      },
    ],
    activeGroceryList: {
      ...entity('grocery-active'),
      name: 'Weekly groceries',
      status: 'shopping',
      items: [
        {
          ...entity('grocery-rice'),
          name: 'Rice',
          canonicalName: 'rice',
          quantity: 2,
          unit: 'lb',
          category: 'Pantry',
          checked: true,
          sourceRecipeIds: [],
          pantryQuantity: 1,
          pantryDecision: 'saved',
        },
        {
          ...entity('grocery-spinach'),
          name: 'Spinach',
          canonicalName: 'spinach',
          quantity: 1,
          unit: 'bag',
          category: 'Produce',
          checked: false,
          sourceRecipeIds: [],
          pantryQuantity: 0,
          pantryDecision: 'none',
        },
      ],
    },
    groceryHistory: [groceryHistory],
    settings: { ...data.settings, name: 'Crosscut User', appearance: 'light' },
  }
}

export const createNamedFixtureData = (name: string, recipeName: string): AppData => {
  const data = createEmptyData()
  const recipe: Recipe = {
    ...entity(`recipe-${name.toLowerCase().replaceAll(' ', '-')}`),
    name: recipeName,
    description: 'Synthetic browser-test record.',
    image: '',
    category: 'Test',
    tags: ['Synthetic'],
    favorite: false,
    originalYield: 1,
    prepMinutes: 0,
    cookMinutes: 0,
    ingredients: [],
    steps: [],
    nutritionPerServing: nutrition,
    nutritionProvenance: provenance,
    sourceLabel: 'Playwright fixture',
  }
  return { ...data, recipes: [recipe], settings: { ...data.settings, name, appearance: 'light' } }
}

export const seedAppData = async (page: Page, data: AppData, preserveCredentials = false) => {
  if (page.url() === 'about:blank') await page.goto('/')
  await page.locator('.route-loading').waitFor({ state: 'hidden' })
  await page.evaluate(
    async ({ data, preserveCredentials }) => {
      const request = indexedDB.open('myhub-local', 2)
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('application')) request.result.createObjectStore('application')
          if (!request.result.objectStoreNames.contains('credentials')) request.result.createObjectStore('credentials')
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const stores = preserveCredentials ? ['application'] : ['application', 'credentials']
      const transaction = database.transaction(stores, 'readwrite')
      transaction.objectStore('application').put(data, 'state')
      if (!preserveCredentials) transaction.objectStore('credentials').delete('github-sync')
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      })
      database.close()
    },
    { data, preserveCredentials },
  )
  await page.reload()
  await page.waitForLoadState('networkidle')
}

export const readSyncCredential = async (page: Page) =>
  page.evaluate(async () => {
    const request = indexedDB.open('myhub-local', 2)
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const get = database.transaction('credentials', 'readonly').objectStore('credentials').get('github-sync')
    const value = await new Promise<unknown>((resolve, reject) => {
      get.onsuccess = () => resolve(get.result)
      get.onerror = () => reject(get.error)
    })
    database.close()
    return value
  })

export const appDataDigest = (data: AppData) => createHash('sha256').update(JSON.stringify(data)).digest('base64')

export const createTestKeyMaterial = () => randomBytes(24).toString('base64url')

export const encryptAppDataInBrowser = async (page: Page, data: AppData, keyMaterial: string) =>
  page.evaluate(
    async ({ data, keyMaterial }) => {
      const encoder = new TextEncoder()
      const bytesToBase64 = (bytes: Uint8Array) => {
        let binary = ''
        for (const byte of bytes) binary += String.fromCharCode(byte)
        return btoa(binary)
      }
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const metadata = {
        format: 'myhub-encrypted',
        version: 1,
        kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 310_000, salt: bytesToBase64(salt) },
        cipher: { name: 'AES-GCM', keyLength: 256, iv: bytesToBase64(iv) },
      }
      const imported = await crypto.subtle.importKey('raw', encoder.encode(keyMaterial), 'PBKDF2', false, ['deriveKey'])
      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: metadata.kdf.iterations, hash: 'SHA-256' },
        imported,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt'],
      )
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: encoder.encode(JSON.stringify(metadata)), tagLength: 128 },
        key,
        encoder.encode(JSON.stringify(data)),
      )
      return JSON.stringify({ ...metadata, ciphertext: bytesToBase64(new Uint8Array(ciphertext)) })
    },
    { data, keyMaterial },
  )

export const createBackupFile = (data: AppData, exportedAt = timestamp) => ({
  name: 'myhub-test-backup.json',
  mimeType: 'application/json',
  buffer: Buffer.from(
    JSON.stringify({ format: 'myhub-backup', formatVersion: 2, appVersion: '0.2.0-test', exportedAt, data }),
  ),
})
