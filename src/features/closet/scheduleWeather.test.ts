import { describe, expect, it } from 'vitest'
import type { AppData, CalendarEvent } from '../../domain/types'
import {
  calendarOutdoorWindows,
  estimateOutdoorWindows,
  mergeOutdoorWindows,
  outdoorWeather,
  type HourlyConditions,
} from './scheduleWeather'

const date = '2026-10-21'
const event = (patch: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'class',
  title: 'CSCI128 TA class',
  source: 'imported',
  createdAt: '',
  updatedAt: '',
  date,
  startTime: '08:00',
  endTime: '09:00',
  kind: 'event',
  ...patch,
})
const hour = (h: number, temp: number | null = 55): HourlyConditions => ({
  time: `${date}T${String(h).padStart(2, '0')}:00`,
  feelsLikeF: temp,
  rainPercent: 20,
  windMph: 8,
})
describe('calendar outdoor estimates', () => {
  it('assumes the full gap under 30 minutes is walking, including Mines campus locations', () => {
    for (const location of ['Colorado School of Mines campus', undefined]) {
      const events = [event({ location }), event({ id: 'next', startTime: '09:29', endTime: '10:00', location })]
      expect(estimateOutdoorWindows(events, date, { minutes: 5 })).toEqual([
        { start: 475, end: 480 },
        { start: 540, end: 569 },
        { start: 600, end: 605 },
      ])
      expect(estimateOutdoorWindows(events, date, { minutes: 0 })).toEqual([])
    }
  })
  it('does not extend the walking assumption to gaps of exactly 30 minutes', () => {
    expect(
      estimateOutdoorWindows([event(), event({ id: 'next', startTime: '09:30', endTime: '10:00' })], date, {
        minutes: 5,
      }),
    ).toEqual([
      { start: 475, end: 480 },
      { start: 540, end: 545 },
      { start: 565, end: 570 },
      { start: 600, end: 605 },
    ])
  })
  it('clips short-gap buffers to class boundaries and avoids overlapping or back-to-back class time', () => {
    expect(
      estimateOutdoorWindows([event(), event({ id: 'next', startTime: '09:05', endTime: '10:00' })], date),
    ).toEqual([
      { start: 465, end: 480 },
      { start: 540, end: 545 },
      { start: 600, end: 615 },
    ])
    for (const startTime of ['08:50', '09:00'])
      expect(estimateOutdoorWindows([event(), event({ id: 'next', startTime, endTime: '10:00' })], date)).toEqual([
        { start: 465, end: 480 },
        { start: 600, end: 615 },
      ])
  })
  it('honors hidden feeds while retaining TA calendar events', () => {
    const data = {
      events: [event({ sourceFeedId: 'hidden' }), event({ id: 'ta', startTime: '10:00', endTime: '11:00' })],
      settings: { calendarFeeds: [{ id: 'hidden', enabled: false }] },
    } as Pick<AppData, 'events' | 'settings'>
    expect(calendarOutdoorWindows(data, date)).toEqual([
      { start: 585, end: 600 },
      { start: 660, end: 675 },
    ])
  })

  it('estimates travel around classes without treating class time as outdoors', () => {
    expect(estimateOutdoorWindows([event()], date)).toEqual([
      { start: 465, end: 480 },
      { start: 540, end: 555 },
    ])
  })
  it('excludes all-day, online, homework and non-event blocks', () => {
    expect(
      estimateOutdoorWindows(
        [
          event({ allDay: true }),
          event({ location: 'Zoom' }),
          event({ assignmentId: 'hw' }),
          event({ kind: 'study' }),
          event({ kind: 'meal-prep' }),
          event({ id: 'skip' }),
        ],
        date,
        { excludedIds: ['skip'] },
      ),
    ).toEqual([])
    expect(estimateOutdoorWindows([event({ title: 'Online safety lab', location: 'Lab 1' })], date)).toHaveLength(2)
  })
  it('supports adjustments and custom windows without mutating input', () => {
    const windows = [
      { start: 550, end: 580 },
      { start: 540, end: 560 },
      { start: 580, end: 590 },
    ]
    const copy = structuredClone(windows)
    expect(mergeOutdoorWindows(windows)).toEqual([{ start: 540, end: 590 }])
    expect(windows).toEqual(copy)
    expect(estimateOutdoorWindows([event()], date, { minutes: 0, custom: windows })).toEqual([{ start: 540, end: 590 }])
    expect(() => estimateOutdoorWindows([], date, { minutes: -1 })).toThrow()
  })
  it('does not invent travel on interior days of multi-day events', () => {
    expect(estimateOutdoorWindows([event({ date: '2026-10-20', endDate: '2026-10-22' })], date)).toEqual([])
    expect(estimateOutdoorWindows([event({ startTime: '00:05', endTime: '23:55' })], date)).toEqual([
      { start: 0, end: 5 },
      { start: 1435, end: 1440 },
    ])
    expect(estimateOutdoorWindows([event({ endTime: 'bad' }), event({ endTime: '07:00' })], date)).toEqual([])
  })
})
describe('hourly outdoor weather', () => {
  it('ignores the overnight low and uses only outdoor hours', () => {
    const result = outdoorWeather(
      date,
      estimateOutdoorWindows([event()], date),
      [hour(3, 20), hour(7, 50), hour(9, 65)],
      20,
    )
    expect(result).toMatchObject({ source: 'schedule', lowF: 50, highF: 65, rainPercent: 20, windMph: 8 })
    expect(JSON.stringify(result)).not.toContain('CSCI')
  })
  it('covers both hours crossed by a walk and uses a half-open end', () => {
    expect(outdoorWeather(date, [{ start: 475, end: 485 }], [hour(7, 60), hour(8, 40)], 10).lowF).toBe(40)
    expect(outdoorWeather(date, [{ start: 475, end: 480 }], [hour(7, 60)], 10).lowF).toBe(60)
  })
  it('falls back for missing, null, wrong-day and ambiguous DST hours', () => {
    const windows = [{ start: 475, end: 485 }]
    for (const samples of [[hour(7)], [hour(7), hour(8, null)], [hour(7), hour(8), hour(8)]])
      expect(outdoorWeather(date, windows, samples, 30)).toMatchObject({ source: 'daily', lowF: 30 })
    expect(outdoorWeather('2026-10-22', windows, [hour(7), hour(8)], null).source).toBe('unavailable')
    expect(outdoorWeather(date, [], [], 30).source).toBe('daily')
    expect(outdoorWeather(date, [{ start: -1, end: 30 }], [], 30).source).toBe('daily')
  })
  it('keeps missing rain/wind unknown without discarding valid temperature', () => {
    expect(
      outdoorWeather(date, [{ start: 420, end: 450 }], [{ ...hour(7), rainPercent: null, windMph: null }], 10),
    ).toMatchObject({ source: 'schedule', lowF: 55, rainPercent: null, windMph: null })
  })
})
