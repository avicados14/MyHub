import { describe, expect, it } from 'vitest'
import { consumePrivateCalendarSnapshot, parsePrivateCalendarSnapshot } from './calendarSnapshot'

describe('private calendar snapshot adapter', () => {
  const payload = JSON.stringify({
    format: 'myhub-calendar-snapshot', version: 1, generatedAt: '2026-09-22T12:00:00.000Z',
    calendars: [{
      id: 'canvas-private', name: 'Canvas private snapshot', type: 'canvas',
      ics: 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:a1\nDTSTART:20260924T235900\nSUMMARY:Essay [ENG 101]\nURL:https://canvas.example/courses/1/assignments/1\nEND:VEVENT\nEND:VCALENDAR',
    }],
  })

  it('maps each private calendar without exposing credentials to the parser', () => {
    const parsed = parsePrivateCalendarSnapshot(payload, '2026-09-22T12:00:00.000Z')
    expect(parsed.events).toHaveLength(1)
    expect(parsed.assignments).toHaveLength(1)
    expect(parsed.feeds[0]).toMatchObject({ id: 'canvas-private', eventCount: 1, assignmentCount: 1 })
  })

  it('uses only provider capabilities and fails clearly while locked', async () => {
    const locked = { available: false, reason: 'Unlock first.', fetchEncryptedCalendarSnapshot: async () => null, decryptCalendarSnapshot: async () => '' }
    await expect(consumePrivateCalendarSnapshot(locked)).rejects.toThrow('Unlock first.')
    const provider = { available: true, fetchEncryptedCalendarSnapshot: async () => ({ sha: 'sha', content: 'encrypted' }), decryptCalendarSnapshot: async () => payload }
    await expect(consumePrivateCalendarSnapshot(provider)).resolves.toMatchObject({ events: [{ sourceFeedId: 'canvas-private' }] })
  })
})
