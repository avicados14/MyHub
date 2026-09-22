import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoData } from '../domain/seed'
import { createBackup, loadAppData, parseBackup, saveAppData } from './database'

beforeEach(async () => {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('myhub-local')
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
})

describe('local persistence', () => {
  it('persists app data across a database reopen', async () => {
    const data = createDemoData(new Date(2026, 8, 22))
    data.settings.name = 'Persistence Test'
    await saveAppData(data)
    expect((await loadAppData()).settings.name).toBe('Persistence Test')
  })

  it('round trips a valid backup and rejects unsupported data', () => {
    const backup = createBackup(createDemoData(new Date(2026, 8, 22)))
    expect(parseBackup(JSON.stringify(backup)).data.recipes).toHaveLength(5)
    expect(() => parseBackup('{"format":"other"}')).toThrow(/not a supported MyHub backup/)
  })
})
