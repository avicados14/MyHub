import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyData } from '../domain/defaults'
import { createTestFixtureData } from '../test/fixtures'
import {
  createBackup,
  loadAppData,
  loadGitHubCredential,
  parseBackup,
  saveAppData,
  saveGitHubCredential,
} from './database'

beforeEach(async () => {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('myhub-local')
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
})

describe('local persistence', () => {
  it('starts a fresh install with empty user collections', async () => {
    const data = await loadAppData()
    expect(data.schemaVersion).toBe(2)
    expect(data.events).toEqual([])
    expect(data.assignments).toEqual([])
    expect(data.recipes).toEqual([])
    expect(data.meals).toEqual([])
    expect(data.foodLog).toEqual([])
    expect(data.pantry).toEqual([])
    expect(data.groceryHistory).toEqual([])
    expect(data.packagedFoods).toEqual([])
    expect(data.leftovers).toEqual([])
    expect(data.activeGroceryList).toBeNull()
    expect(data.settings.name).toBe('')
  })

  it('persists app data across a database reopen', async () => {
    const data = createEmptyData(new Date(2026, 8, 22))
    data.settings.name = 'Persistence Test'
    await saveAppData(data)
    expect((await loadAppData()).settings.name).toBe('Persistence Test')
  })

  it('round trips a valid backup and rejects unsupported data', () => {
    const backup = createBackup(createTestFixtureData(new Date(2026, 8, 22)))
    expect(parseBackup(JSON.stringify(backup)).data.recipes).toHaveLength(5)
    expect(() => parseBackup('{"format":"other"}')).toThrow(/not a supported MyHub backup/)
  })

  it('keeps the encrypted GitHub token outside AppData and plaintext backups', async () => {
    const credential = {
      version: 1 as const,
      repository: { owner: 'avicados14', repo: 'MyHub-Data', path: 'myhub-data/v1/snapshot.enc' },
      tokenEnvelope: '{"ciphertext":"encrypted-token-only"}',
      paused: false,
    }
    await saveGitHubCredential(credential)
    const stored = await loadGitHubCredential()
    const appData = await loadAppData()
    const backupText = JSON.stringify(createBackup(appData))
    expect(stored).toEqual(credential)
    expect(backupText).not.toContain('encrypted-token-only')
    expect(backupText).not.toContain('tokenEnvelope')
  })
})
