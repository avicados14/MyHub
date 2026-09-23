import { describe, expect, it } from 'vitest'
import { dashboardScheduleWindow } from './dashboardSchedule'
import type { CalendarEvent } from './types'

const event = (id: string, startTime: string, endTime: string, allDay = false): CalendarEvent => ({
  id,
  createdAt: '2026-09-23T00:00:00.000Z',
  updatedAt: '2026-09-23T00:00:00.000Z',
  source: 'manual',
  title: id,
  date: '2026-09-23',
  startTime,
  endTime,
  allDay,
  kind: 'event',
})

describe('dashboard schedule window', () => {
  it('centers the compact view on the current time', () => {
    const result = dashboardScheduleWindow(
      [
        event('finished', '08:00', '09:00'),
        event('current', '10:00', '11:00'),
        event('overlapping', '10:15', '10:45'),
        event('next', '13:00', '14:00'),
      ],
      new Date(2026, 8, 23, 10, 30),
      '2026-09-23',
    )

    expect(result.previous?.event.id).toBe('finished')
    expect(result.current.map((item) => item.event.id)).toEqual(['current', 'overlapping'])
    expect(result.next?.event.id).toBe('next')
  })

  it('does not treat all-day items as timed commitments', () => {
    const result = dashboardScheduleWindow(
      [event('all-day', '00:00', '23:59', true), event('later', '16:00', '17:00')],
      new Date(2026, 8, 23, 9, 0),
      '2026-09-23',
    )

    expect(result.allDayCount).toBe(1)
    expect(result.previous).toBeUndefined()
    expect(result.current).toEqual([])
    expect(result.next?.event.id).toBe('later')
  })
})
