import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyData } from '../domain/defaults'
import { createTestFixtureData } from '../test/fixtures'
import {
  clearPrivateAccessCredential,
  createBackup,
  loadAppData,
  loadGitHubCredential,
  loadPrivateAccessCredential,
  parseBackup,
  saveAppData,
  saveGitHubCredential,
  savePrivateAccessCredential,
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

  it('sanitizes stale prototype assignments when an existing browser reloads', async () => {
    const data = createEmptyData(new Date(2026, 8, 22))
    const timestamps = { createdAt: '2026-09-22T00:00:00.000Z', updatedAt: '2026-09-22T00:00:00.000Z' }
    data.assignments = [
      {
        ...timestamps,
        id: 'assignment-lab',
        source: 'demo',
        title: 'CEEN 482 Lab Report',
        course: 'CE EN 482',
        dueDate: '2026-09-23',
        dueTime: '23:59',
        priority: 'high',
        estimatedMinutes: 120,
        progress: 20,
        status: 'in-progress',
        notes: 'Sample',
        subtasks: [],
        sourceLabel: 'Sample data',
      },
      {
        ...timestamps,
        id: 'assignment-personal',
        source: 'manual',
        title: 'Keep this homework',
        course: 'REAL 101',
        dueDate: '2026-09-24',
        dueTime: '17:00',
        priority: 'medium',
        estimatedMinutes: 45,
        progress: 0,
        status: 'not-started',
        notes: '',
        subtasks: [],
        sourceLabel: 'Manual homework',
      },
    ]
    data.events = [
      {
        ...timestamps,
        id: 'event-generated-demo',
        source: 'generated',
        title: 'CEEN 482 Lab Report',
        date: '2026-09-22',
        startTime: '16:00',
        endTime: '16:45',
        kind: 'study',
        assignmentId: 'assignment-lab',
      },
    ]

    await saveAppData(data)
    const reloaded = await loadAppData()

    expect(reloaded.assignments.map((assignment) => assignment.title)).toEqual(['Keep this homework'])
    expect(reloaded.events).toEqual([])
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

  it('keeps the Supabase private-link capability outside AppData and supports local unlink', async () => {
    const credential = {
      version: 1 as const,
      id: '11111111-1111-4111-8111-111111111111',
      key: 'private-link-key-with-at-least-thirty-two-characters',
    }
    await savePrivateAccessCredential(credential)
    expect(await loadPrivateAccessCredential()).toEqual(credential)
    expect(JSON.stringify(createBackup(await loadAppData()))).not.toContain(credential.key)
    await clearPrivateAccessCredential()
    expect(await loadPrivateAccessCredential()).toBeNull()
  })
})
