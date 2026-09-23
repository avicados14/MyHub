import { describe, expect, it } from 'vitest'
import { createEmptyData } from './defaults'
import { eventCoversDate, eventTimesOnDate, visibleAssignments, visibleCalendarEvents } from './calendar'
import type { CalendarEvent, HomeworkAssignment } from './types'

const timestamp = '2026-09-22T00:00:00.000Z'
const importedEvent: CalendarEvent = {
  id: 'event-feed',
  createdAt: timestamp,
  updatedAt: timestamp,
  source: 'imported',
  title: 'Imported class',
  date: '2026-09-22',
  startTime: '09:00',
  endTime: '10:00',
  kind: 'event',
  sourceFeedId: 'feed-1',
}
const assignment: HomeworkAssignment = {
  id: 'assignment-feed',
  createdAt: timestamp,
  updatedAt: timestamp,
  source: 'imported',
  title: 'Imported homework',
  course: 'TEST',
  dueDate: '2026-09-23',
  dueTime: '23:59',
  priority: 'medium',
  estimatedMinutes: 60,
  progress: 0,
  status: 'not-started',
  notes: '',
  subtasks: [],
  sourceFeedId: 'feed-1',
}

describe('calendar visibility and coverage', () => {
  it('hides disabled-feed records without deleting them and restores them on enable', () => {
    const data = createEmptyData(new Date(2026, 8, 22))
    data.events = [importedEvent]
    data.assignments = [assignment]
    data.settings.calendarFeeds = [
      { id: 'feed-1', name: 'Course feed', kind: 'canvas', enabled: false, status: 'connected' },
    ]
    expect(visibleCalendarEvents(data)).toEqual([])
    expect(visibleAssignments(data)).toEqual([])
    expect(data.events).toHaveLength(1)
    expect(data.assignments).toHaveLength(1)

    data.settings.calendarFeeds[0]!.enabled = true
    expect(visibleCalendarEvents(data)).toEqual([importedEvent])
    expect(visibleAssignments(data)).toEqual([assignment])
  })

  it('returns full-day conflict spans for middle days of multi-day timed and all-day events', () => {
    const multiDay: CalendarEvent = {
      ...importedEvent,
      date: '2026-09-22',
      endDate: '2026-09-24',
      startTime: '20:00',
      endTime: '08:00',
    }
    expect(eventCoversDate(multiDay, '2026-09-23')).toBe(true)
    expect(eventTimesOnDate(multiDay, '2026-09-22')).toEqual({ startTime: '20:00', endTime: '23:59' })
    expect(eventTimesOnDate(multiDay, '2026-09-23')).toEqual({ startTime: '00:00', endTime: '23:59' })
    expect(eventTimesOnDate(multiDay, '2026-09-24')).toEqual({ startTime: '00:00', endTime: '08:00' })
  })
})
