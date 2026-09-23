import { describe, expect, it } from 'vitest'
import { mergeImportedAssignments, mergeImportedEvents, parseIcs, parseIcsResult } from './ics'

describe('ICS import', () => {
  it('imports timed Canvas-compatible events with stable source data', () => {
    const text = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:course-1\nDTSTART:20260922T090000\nDTEND:20260922T095000\nSUMMARY:Fluid Mechanics\nCATEGORIES:ME EN 321\nEND:VEVENT\nEND:VCALENDAR`
    const events = parseIcs(text, 'Canvas ICS')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ title: 'Fluid Mechanics', date: '2026-09-22', startTime: '09:00', endTime: '09:50', source: 'imported', sourceLabel: 'Canvas ICS' })
    expect(parseIcs(text, 'Canvas ICS')[0]?.id).toBe(events[0]?.id)
  })

  it('unfolds RFC lines and retains all-day URL, description, location, categories, UID, and feed provenance', () => {
    const result = parseIcsResult(`BEGIN:VCALENDAR\r\nX-WR-CALNAME:University Calendar\r\nBEGIN:VEVENT\r\nUID:multi-day@example.edu\r\nDTSTART;VALUE=DATE:20261002\r\nDTEND;VALUE=DATE:20261004\r\nSUMMARY:Fall\r\n  Break\r\nDESCRIPTION:No classes\\nCampus closed\r\nLOCATION:Main Campus\r\nCATEGORIES:Academic,Holiday\r\nURL:https://example.edu/calendar/item\r\nEND:VEVENT\r\nEND:VCALENDAR`, {
      sourceLabel: 'Google school calendar', sourceFeedId: 'google-upload-1', sourceType: 'google', importedAt: '2026-09-22T12:00:00.000Z',
    })
    expect(result.calendarName).toBe('University Calendar')
    expect(result.events[0]).toMatchObject({
      title: 'Fall Break', date: '2026-10-02', endDate: '2026-10-03', allDay: true,
      startTime: '00:00', endTime: '23:59', description: 'No classes\nCampus closed',
      location: 'Main Campus', categories: ['Academic', 'Holiday'], uid: 'multi-day@example.edu',
      sourceFeedId: 'google-upload-1', sourceUrl: 'https://example.edu/calendar/item',
    })
  })

  it('uses common TZIDs and UTC timestamps when practical', () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const expected = new Date(Date.UTC(2026, 8, 22, 15, 0))
    const result = parseIcsResult(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:zoned\nDTSTART;TZID=America/Denver:20260922T090000\nDTEND;TZID=America/Denver:20260922T100000\nSUMMARY:Class\nEND:VEVENT\nEND:VCALENDAR`)
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    expect(result.events[0]?.startTime).toBe(formatter.format(expected))
  })

  it('classifies Canvas assignment URLs, maps homework, and dedupes without replacing user progress', () => {
    const result = parseIcsResult(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:assignment-42\nDTSTART:20260925T235900\nSUMMARY:Problem Set 4 [MATH 221]\nDESCRIPTION:Complete questions 1–12\nURL:https://canvas.example/courses/7/assignments/42\nEND:VEVENT\nEND:VCALENDAR`, {
      sourceLabel: 'Canvas file', sourceFeedId: 'canvas-file-1', sourceType: 'canvas', importedAt: '2026-09-22T12:00:00.000Z',
    })
    expect(result.assignments).toHaveLength(1)
    expect(result.assignments[0]).toMatchObject({
      title: 'Problem Set 4', course: 'MATH 221', dueDate: '2026-09-25', dueTime: '23:59',
      source: 'imported', sourceLabel: 'Canvas file', sourceFeedId: 'canvas-file-1', externalId: 'assignment-42',
      sourceUrl: 'https://canvas.example/courses/7/assignments/42',
    })
    const edited = { ...result.assignments[0]!, progress: 50, status: 'in-progress' as const, subtasks: [{ id: 'subtask-1', title: 'Outline', completed: true }] }
    expect(mergeImportedAssignments([edited], result.assignments)[0]).toMatchObject({ progress: 50, status: 'in-progress', subtasks: edited.subtasks })
    expect(mergeImportedEvents(result.events, result.events)).toHaveLength(1)
  })

  it('rejects files that are not iCalendar data', () => {
    expect(() => parseIcs('not a calendar')).toThrow(/valid iCalendar/)
  })
})
