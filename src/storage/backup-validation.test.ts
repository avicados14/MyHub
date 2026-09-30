import { expect, it } from 'vitest'
import { createEmptyData } from '../domain/defaults'
import { createBackup, parseBackup } from './database'

it('rejects a v2 backup with malformed nested records before replacing local data', () => {
  const backup = createBackup(createEmptyData(new Date('2026-01-05T12:00:00Z')))
  const malformed = { ...backup, data: { ...backup.data, recipes: [{}] } }
  expect(() => parseBackup(JSON.stringify(malformed))).toThrow()
})

it.each([
  ['future envelope', (backup: Record<string, unknown>) => ({ ...backup, formatVersion: 3 })],
  [
    'future schema',
    (backup: Record<string, unknown>) => ({ ...backup, data: { ...(backup.data as object), schemaVersion: 3 } }),
  ],
  [
    'unknown nested field',
    (backup: Record<string, unknown>) => ({ ...backup, data: { ...(backup.data as object), unsupportedField: true } }),
  ],
])('rejects %s without exposing input values', (_label, change) => {
  const backup = createBackup(createEmptyData(new Date('2026-01-05T12:00:00Z')))
  expect(() => parseBackup(JSON.stringify(change({ ...backup })))).toThrow()
})
