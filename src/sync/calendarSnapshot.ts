import type { CalendarEvent, HomeworkAssignment } from '../domain/types'
import type { IcsImportOptions } from '../domain/ics'
import { parseIcsResult } from '../domain/ics'

export const PRIVATE_CALENDAR_SNAPSHOT_PATH = 'myhub-data/v1/calendars.enc'

export interface CalendarSnapshotContent {
  content: string
  sha: string
}

export interface PrivateCalendarAccessProvider {
  available: boolean
  reason?: string
  fetchEncryptedCalendarSnapshot: () => Promise<CalendarSnapshotContent | null>
  decryptCalendarSnapshot: (encrypted: string) => Promise<string>
}

export interface CalendarSnapshotPayload {
  format: 'myhub-calendar-snapshot'
  version: 1
  generatedAt?: string
  calendars: Array<{
    id: string
    name: string
    type: 'canvas' | 'google' | 'ics'
    ics: string
  }>
}

export interface ParsedCalendarSnapshot {
  events: CalendarEvent[]
  assignments: HomeworkAssignment[]
  feeds: Array<{ id: string; name: string; type: 'canvas' | 'google' | 'ics'; eventCount: number; assignmentCount: number }>
}

const isSnapshotPayload = (value: unknown): value is CalendarSnapshotPayload => {
  if (typeof value !== 'object' || value === null) return false
  const payload = value as Partial<CalendarSnapshotPayload>
  return payload.format === 'myhub-calendar-snapshot'
    && payload.version === 1
    && Array.isArray(payload.calendars)
    && payload.calendars.every((calendar) => typeof calendar === 'object' && calendar !== null
      && typeof calendar.id === 'string' && typeof calendar.name === 'string' && typeof calendar.ics === 'string'
      && (calendar.type === 'canvas' || calendar.type === 'google' || calendar.type === 'ics'))
}

export const parsePrivateCalendarSnapshot = (plaintext: string, importedAt = new Date().toISOString()): ParsedCalendarSnapshot => {
  let value: unknown
  try {
    value = JSON.parse(plaintext)
  } catch {
    throw new Error('The private calendar snapshot is not valid JSON.')
  }
  if (!isSnapshotPayload(value)) throw new Error('The private calendar snapshot format is unsupported.')
  const events: CalendarEvent[] = []
  const assignments: HomeworkAssignment[] = []
  const feeds: ParsedCalendarSnapshot['feeds'] = []
  for (const calendar of value.calendars) {
    const options: IcsImportOptions = {
      sourceLabel: calendar.name,
      sourceFeedId: calendar.id,
      sourceType: calendar.type,
      importedAt,
    }
    const parsed = parseIcsResult(calendar.ics, options)
    events.push(...parsed.events)
    assignments.push(...parsed.assignments)
    feeds.push({ id: calendar.id, name: calendar.name, type: calendar.type, eventCount: parsed.events.length, assignmentCount: parsed.assignments.length })
  }
  return { events, assignments, feeds }
}

export const consumePrivateCalendarSnapshot = async (provider: PrivateCalendarAccessProvider): Promise<ParsedCalendarSnapshot | null> => {
  if (!provider.available) throw new Error(provider.reason ?? 'Unlock GitHub Sync to import the private calendar snapshot.')
  const remote = await provider.fetchEncryptedCalendarSnapshot()
  if (!remote) return null
  const plaintext = await provider.decryptCalendarSnapshot(remote.content)
  return parsePrivateCalendarSnapshot(plaintext)
}
