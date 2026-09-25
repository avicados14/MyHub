import { describe, expect, it } from 'vitest'
import { mergeImportedAssignments, mergeImportedEvents, parseIcs, parseIcsResult } from './ics'

describe('ICS import', () => {
  it('imports timed Canvas-compatible events with stable source data', () => {
    const text = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:course-1\nDTSTART:20260922T090000\nDTEND:20260922T095000\nSUMMARY:Fluid Mechanics\nCATEGORIES:ME EN 321\nEND:VEVENT\nEND:VCALENDAR`
    const events = parseIcs(text, 'Canvas ICS')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      title: 'Fluid Mechanics',
      date: '2026-09-22',
      startTime: '09:00',
      endTime: '09:50',
      source: 'imported',
      sourceLabel: 'Canvas ICS',
    })
    expect(parseIcs(text, 'Canvas ICS')[0]?.id).toBe(events[0]?.id)
  })

  it('unfolds RFC lines and retains all-day URL, description, location, categories, UID, and feed provenance', () => {
    const result = parseIcsResult(
      `BEGIN:VCALENDAR\r\nX-WR-CALNAME:University Calendar\r\nBEGIN:VEVENT\r\nUID:multi-day@example.edu\r\nDTSTART;VALUE=DATE:20261002\r\nDTEND;VALUE=DATE:20261004\r\nSUMMARY:Fall\r\n  Break\r\nDESCRIPTION:No classes\\nCampus closed\r\nLOCATION:Main Campus\r\nCATEGORIES:Academic,Holiday\r\nURL:https://example.edu/calendar/item\r\nEND:VEVENT\r\nEND:VCALENDAR`,
      {
        sourceLabel: 'Google school calendar',
        sourceFeedId: 'google-upload-1',
        sourceType: 'google',
        importedAt: '2026-09-22T12:00:00.000Z',
      },
    )
    expect(result.calendarName).toBe('University Calendar')
    expect(result.events[0]).toMatchObject({
      title: 'Fall Break',
      date: '2026-10-02',
      endDate: '2026-10-03',
      allDay: true,
      startTime: '00:00',
      endTime: '23:59',
      description: 'No classes\nCampus closed',
      location: 'Main Campus',
      categories: ['Academic', 'Holiday'],
      uid: 'multi-day@example.edu',
      sourceFeedId: 'google-upload-1',
      sourceUrl: 'https://example.edu/calendar/item',
    })
  })

  it('uses common TZIDs and UTC timestamps when practical', () => {
    const result = parseIcsResult(
      `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:zoned\nDTSTART;TZID=America/Denver:20260922T090000\nDTEND;TZID=America/Denver:20260922T100000\nSUMMARY:Class\nEND:VEVENT\nEND:VCALENDAR`,
      { timeZone: 'America/Denver' },
    )
    expect(result.events[0]).toMatchObject({ date: '2026-09-22', startTime: '09:00', endTime: '10:00' })
  })

  it('converts UTC and foreign-zone timestamps to Mountain Time across date boundaries', () => {
    const result = parseIcsResult(
      `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:utc-evening
DTSTART:20260923T010000Z
DTEND:20260923T023000Z
SUMMARY:UTC evening
END:VEVENT
BEGIN:VEVENT
UID:chicago-evening
DTSTART;TZID=America/Chicago:20260922T210000
DTEND;TZID=America/Chicago:20260922T220000
SUMMARY:Chicago evening
END:VEVENT
END:VCALENDAR`,
      { timeZone: 'America/Denver' },
    )
    expect(result.events.map((event) => [event.date, event.startTime, event.endTime])).toEqual([
      ['2026-09-22', '19:00', '20:30'],
      ['2026-09-22', '20:00', '21:00'],
    ])
  })

  it('keeps UTC recurrences tied to UTC through the Mountain Time daylight-saving transition', () => {
    const result = parseIcsResult(
      `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:utc-daily
DTSTART:20261101T070000Z
DTEND:20261101T080000Z
RRULE:FREQ=DAILY;COUNT=2
SUMMARY:UTC recurring event
END:VEVENT
END:VCALENDAR`,
      {
        timeZone: 'America/Denver',
        importedAt: '2026-10-31T12:00:00.000Z',
        windowStart: '2026-11-01',
        windowEnd: '2026-11-02',
      },
    )
    expect(result.events.map((event) => [event.date, event.startTime, event.endTime])).toEqual([
      ['2026-11-01', '01:00', '01:00'],
      ['2026-11-02', '00:00', '01:00'],
    ])
  })

  it('classifies Canvas assignment URLs, maps homework, and dedupes without replacing user progress', () => {
    const result = parseIcsResult(
      `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:assignment-42\nDTSTART:20260925T235900\nSUMMARY:Problem Set 4 [MATH 221]\nDESCRIPTION:Complete questions 1–12\nURL:https://canvas.example/courses/7/assignments/42\nEND:VEVENT\nEND:VCALENDAR`,
      {
        sourceLabel: 'Canvas file',
        sourceFeedId: 'canvas-file-1',
        sourceType: 'canvas',
        importedAt: '2026-09-22T12:00:00.000Z',
      },
    )
    expect(result.assignments).toHaveLength(1)
    expect(result.assignments[0]).toMatchObject({
      title: 'Problem Set 4',
      course: 'MATH 221',
      dueDate: '2026-09-25',
      dueTime: '23:59',
      source: 'imported',
      sourceLabel: 'Canvas file',
      sourceFeedId: 'canvas-file-1',
      externalId: 'assignment-42',
      sourceUrl: 'https://canvas.example/courses/7/assignments/42',
    })
    const edited = {
      ...result.assignments[0]!,
      progress: 50,
      status: 'in-progress' as const,
      subtasks: [{ id: 'subtask-1', title: 'Outline', completed: true }],
    }
    expect(mergeImportedAssignments([edited], result.assignments)[0]).toMatchObject({
      progress: 50,
      status: 'in-progress',
      subtasks: edited.subtasks,
    })
    expect(mergeImportedEvents(result.events, result.events)).toHaveLength(1)
  })

  it('classifies canonical Canvas assignment UIDs when every item uses the generic calendar URL', () => {
    const result = parseIcsResult(
      `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:event-assignment-42
DTSTART;VALUE=DATE:20260925
SUMMARY:Problem Set 4 [MATH 221]
URL:https://canvas.example/calendar
END:VEVENT
BEGIN:VEVENT
UID:event-assignment-override-43
DTSTART:20260926T180000
SUMMARY:Lab report [CHEM 101]
URL:https://canvas.example/calendar
END:VEVENT
BEGIN:VEVENT
UID:event-calendar-44
DTSTART:20260927T090000
SUMMARY:Office hours [MATH 221]
URL:https://canvas.example/calendar
END:VEVENT
END:VCALENDAR`,
      {
        sourceLabel: 'Canvas feed',
        sourceFeedId: 'canvas-live-shape',
        sourceType: 'canvas',
        importedAt: '2026-09-24T12:00:00.000Z',
      },
    )

    expect(result.events).toHaveLength(3)
    expect(result.assignments).toHaveLength(2)
    expect(result.assignments.map((assignment) => [assignment.title, assignment.dueDate, assignment.dueTime])).toEqual([
      ['Problem Set 4', '2026-09-25', '23:59'],
      ['Lab report', '2026-09-26', '18:00'],
    ])
    expect(result.assignments.every((assignment) => assignment.sourceUrl === 'https://canvas.example/calendar')).toBe(
      true,
    )
  })

  it('expands common recurrence rules inside explicit bounds with stable occurrence IDs', () => {
    const text = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:weekly-class\nDTSTART:20260901T090000\nDTEND:20260901T100000\nRRULE:FREQ=WEEKLY;BYDAY=TU,TH;COUNT=8\nSUMMARY:Structures\nEND:VEVENT\nEND:VCALENDAR`
    const options = {
      sourceLabel: 'Google classes',
      sourceFeedId: 'google-classes',
      sourceType: 'google' as const,
      sourceUrl: 'https://calendar.example/private.ics',
      importedAt: '2026-09-01T00:00:00.000Z',
      windowStart: '2026-09-07',
      windowEnd: '2026-09-18',
    }
    const result = parseIcsResult(text, options)
    expect(result.events.map((event) => event.date)).toEqual(['2026-09-08', '2026-09-10', '2026-09-15', '2026-09-17'])
    expect(result.events[0]).toMatchObject({
      sourceFeedId: 'google-classes',
      sourceType: 'google',
      importedAt: '2026-09-01T00:00:00.000Z',
      sourceUrl: 'https://calendar.example/private.ics',
    })
    expect(parseIcsResult(text, options).events.map((event) => event.id)).toEqual(
      result.events.map((event) => event.id),
    )
  })

  it('applies EXDATE and RECURRENCE-ID overrides without duplicating original instances', () => {
    const result = parseIcsResult(
      `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:office-hours
DTSTART:20260901T090000
DTEND:20260901T100000
RRULE:FREQ=WEEKLY;COUNT=4
EXDATE:20260908T090000
SUMMARY:Office hours
END:VEVENT
BEGIN:VEVENT
UID:office-hours
RECURRENCE-ID:20260915T090000
DTSTART:20260915T130000
DTEND:20260915T140000
SUMMARY:Moved office hours
END:VEVENT
BEGIN:VEVENT
UID:office-hours
RECURRENCE-ID:20260922T090000
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`,
      {
        sourceFeedId: 'course-feed',
        importedAt: '2026-09-01T00:00:00.000Z',
        windowStart: '2026-09-01',
        windowEnd: '2026-09-30',
      },
    )
    expect(result.events.map((event) => `${event.date} ${event.startTime} ${event.title}`)).toEqual([
      '2026-09-01 09:00 Office hours',
      '2026-09-15 13:00 Moved office hours',
    ])
    expect(new Set(result.events.map((event) => event.id)).size).toBe(result.events.length)
  })

  it('uses a conservative default window for unbounded recurrence', () => {
    const result = parseIcsResult(
      `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:daily\nDTSTART:20200101T090000\nRRULE:FREQ=DAILY\nSUMMARY:Daily item\nEND:VEVENT\nEND:VCALENDAR`,
      { importedAt: '2026-09-22T12:00:00.000Z' },
    )
    expect(result.events.length).toBeGreaterThan(700)
    expect(result.events.length).toBeLessThanOrEqual(1_000)
    expect(result.events.every((event) => event.date >= '2025-09-21' && event.date <= '2028-09-21')).toBe(true)
  })

  it('rejects files that are not iCalendar data', () => {
    expect(() => parseIcs('not a calendar')).toThrow(/valid iCalendar/)
  })
})
