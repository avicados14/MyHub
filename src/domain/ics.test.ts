import { describe, expect, it } from 'vitest'
import { parseIcs } from './ics'

describe('ICS import', () => {
  it('imports timed Canvas-compatible events with stable source data', () => {
    const events = parseIcs(`BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:course-1\nDTSTART:20260922T090000\nDTEND:20260922T095000\nSUMMARY:Fluid Mechanics\nCATEGORIES:ME EN 321\nEND:VEVENT\nEND:VCALENDAR`, 'Canvas ICS')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ title: 'Fluid Mechanics', date: '2026-09-22', startTime: '09:00', endTime: '09:50', source: 'imported', sourceLabel: 'Canvas ICS' })
  })

  it('rejects files that are not iCalendar data', () => {
    expect(() => parseIcs('not a calendar')).toThrow(/valid iCalendar/)
  })
})
