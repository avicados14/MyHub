import { visibleCalendarEvents } from '../../domain/calendar'
import type { AppData, CalendarEvent } from '../../domain/types'

/** Minutes on a calendar day, in the same explicit timezone as the hourly forecast. */
export interface OutdoorWindow {
  start: number
  end: number
}
export interface HourlyConditions {
  /** Local ISO hour, e.g. 2026-10-21T08:00, in the requested calendar timezone. */
  time: string
  feelsLikeF: number | null
  rainPercent: number | null
  windMph: number | null
}
export interface OutdoorWeather {
  source: 'schedule' | 'daily' | 'unavailable'
  lowF: number | null
  highF: number | null
  rainPercent: number | null
  windMph: number | null
  reason: string
}
const minutes = (time: string): number | null => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
}
const validWindow = (w: OutdoorWindow) =>
  Number.isInteger(w.start) && Number.isInteger(w.end) && w.start >= 0 && w.end <= 1440 && w.end > w.start

export function mergeOutdoorWindows(windows: readonly OutdoorWindow[]): OutdoorWindow[] {
  const sorted = windows
    .filter(validWindow)
    .map((w) => ({ ...w }))
    .sort((a, b) => a.start - b.start)
  const merged: OutdoorWindow[] = []
  for (const window of sorted) {
    const previous = merged.at(-1)
    if (previous && window.start <= previous.end) previous.end = Math.max(previous.end, window.end)
    else merged.push(window)
  }
  return merged
}

/** Pass visibleCalendarEvents(data), not the homework list (TA classes still require travel). */
export function estimateOutdoorWindows(
  events: readonly CalendarEvent[],
  date: string,
  options: { minutes?: number; excludedIds?: readonly string[]; custom?: readonly OutdoorWindow[] } = {},
): OutdoorWindow[] {
  const duration = options.minutes ?? 15
  if (!Number.isInteger(duration) || duration < 0 || duration > 120)
    throw new Error('Outdoor estimate must be 0–120 minutes.')
  const windows: OutdoorWindow[] = [...(options.custom ?? [])]
  const timed: { start: number; end: number }[] = []
  for (const event of events) {
    if (event.allDay || event.kind !== 'event' || event.assignmentId || options.excludedIds?.includes(event.id))
      continue
    // Only explicit location signals; a title such as "Online safety lab" is not evidence of a remote event.
    if (
      /\b(online|virtual|remote|zoom|microsoft teams|google meet)\b|meet\.google\.com|zoom\.us/i.test(
        event.location ?? '',
      )
    )
      continue
    const start = minutes(event.startTime)
    const end = minutes(event.endTime)
    const endDate = event.endDate ?? event.date
    if (start === null || end === null || endDate < event.date || (endDate === event.date && end <= start)) continue
    if (event.date <= date && endDate >= date)
      timed.push({ start: event.date === date ? start : 0, end: endDate === date ? end : 1440 })
    if (event.date === date) windows.push({ start: Math.max(0, start - duration), end: start })
    if (endDate === date) windows.push({ start: end, end: Math.min(1440, end + duration) })
  }
  // Treat short gaps between consecutive event blocks as walking time, including
  // Mines campus events even when a location is absent or only a room code.
  // Merge overlapping events first so conflicting entries cannot create a fake gap.
  const blocks = mergeOutdoorWindows(timed)
  if (duration > 0)
    for (let i = 1; i < blocks.length; i++) {
      const previous = blocks[i - 1]!
      const next = blocks[i]!
      if (next.start - previous.end < 30) windows.push({ start: previous.end, end: next.start })
    }
  // Arrival/departure buffers must not turn time inside another class into walking.
  let outside = mergeOutdoorWindows(windows)
  for (const block of blocks)
    outside = outside.flatMap((w) => {
      if (w.end <= block.start || w.start >= block.end) return [w]
      return [
        { start: w.start, end: Math.min(w.end, block.start) },
        { start: Math.max(w.start, block.end), end: w.end },
      ].filter(validWindow)
    })
  return mergeOutdoorWindows([...outside, ...(options.custom ?? [])])
}

const finite = (value: number | null, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

/** No event text or locations enter the result that can later be passed to Smart Suggest. */
export function outdoorWeather(
  date: string,
  windows: readonly OutdoorWindow[],
  hourly: readonly HourlyConditions[],
  dailyLowF: number | null,
): OutdoorWeather {
  const fallback = (reason: string): OutdoorWeather => ({
    source: finite(dailyLowF, -150, 150) ? 'daily' : 'unavailable',
    lowF: finite(dailyLowF, -150, 150) ? dailyLowF : null,
    highF: null,
    rainPercent: null,
    windMph: null,
    reason,
  })
  if (windows.some((w) => !validWindow(w))) return fallback('An outdoor window is invalid; review your times.')
  const merged = mergeOutdoorWindows(windows)
  if (!merged.length) return fallback('No estimated outdoor times; using the daily low when available.')
  const required = new Set<number>()
  for (const w of merged)
    for (let hour = Math.floor(w.start / 60); hour < Math.ceil(w.end / 60); hour++) required.add(hour)
  const samples: HourlyConditions[] = []
  for (const hour of required) {
    const key = `${date}T${String(hour).padStart(2, '0')}:00`
    const matches = hourly.filter((sample) => sample.time === key)
    // Duplicate local hours (fall-back DST) are ambiguous without UTC event timestamps.
    if (matches.length !== 1 || !finite(matches[0]!.feelsLikeF, -150, 150))
      return fallback(
        'Hourly forecast is missing or ambiguous for an outdoor time; using the daily low when available.',
      )
    samples.push(matches[0]!)
  }
  const maxIfComplete = (field: 'rainPercent' | 'windMph', max: number) =>
    samples.every((s) => finite(s[field], 0, max)) ? Math.max(...samples.map((s) => s[field] as number)) : null
  return {
    source: 'schedule',
    lowF: Math.min(...samples.map((s) => s.feelsLikeF as number)),
    highF: Math.max(...samples.map((s) => s.feelsLikeF as number)),
    rainPercent: maxIfComplete('rainPercent', 100),
    windMph: maxIfComplete('windMph', 300),
    reason: 'Weather during estimated outdoor times; review the walking assumptions.',
  }
}

/** Public entry point honors disabled calendar feeds without excluding TA classes. */
export function calendarOutdoorWindows(
  data: Pick<AppData, 'events' | 'settings'>,
  date: string,
  options: Parameters<typeof estimateOutdoorWindows>[2] = {},
) {
  return estimateOutdoorWindows(visibleCalendarEvents(data), date, options)
}
