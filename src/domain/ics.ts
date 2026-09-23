import type { CalendarEvent, HomeworkAssignment } from './types'
import { addDays, timeFromMinutes, toLocalDate } from '../utilities/date'

export type IcsSourceType = 'canvas' | 'google' | 'ics'

export interface IcsImportOptions {
  sourceLabel?: string
  sourceFeedId?: string
  sourceType?: IcsSourceType
  importedAt?: string
}

export interface IcsParseResult {
  events: CalendarEvent[]
  assignments: HomeworkAssignment[]
  calendarName?: string
  skippedEvents: number
}

interface ContentLine {
  name: string
  params: Record<string, string>
  value: string
}

interface ParsedDateTime {
  date: string
  time: string
  allDay: boolean
}

const unfoldLines = (text: string): string[] => text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)

const parseContentLine = (line: string): ContentLine | null => {
  const separator = line.indexOf(':')
  if (separator < 1) return null
  const [rawName = '', ...rawParams] = line.slice(0, separator).split(';')
  const params: Record<string, string> = {}
  for (const rawParam of rawParams) {
    const equals = rawParam.indexOf('=')
    if (equals > 0) params[rawParam.slice(0, equals).toUpperCase()] = rawParam.slice(equals + 1).replace(/^"|"$/g, '')
  }
  return { name: rawName.toUpperCase(), params, value: line.slice(separator + 1) }
}

const unescapeText = (value: string): string =>
  value
    .replace(/\\[nN]/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')

const firstProperty = (lines: ContentLine[], name: string): ContentLine | undefined =>
  lines.find((line) => line.name === name)

const compactParts = (
  value: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } | null => {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?Z?$/.exec(value)
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? 0),
    minute: Number(match[5] ?? 0),
    second: Number(match[6] ?? 0),
  }
}

const partsInZone = (date: Date, timeZone: string): Record<string, number> => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
  )
}

const dateFromZonedParts = (parts: NonNullable<ReturnType<typeof compactParts>>, timeZone: string): Date => {
  const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  let candidate = wallAsUtc
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const zoned = partsInZone(new Date(candidate), timeZone)
    const represented = Date.UTC(
      zoned.year ?? parts.year,
      (zoned.month ?? parts.month) - 1,
      zoned.day ?? parts.day,
      zoned.hour ?? 0,
      zoned.minute ?? 0,
      zoned.second ?? 0,
    )
    candidate += wallAsUtc - represented
  }
  return new Date(candidate)
}

const localDateTime = (date: Date): ParsedDateTime => ({
  date: toLocalDate(date),
  time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  allDay: false,
})

const parseDateTime = (property: ContentLine): ParsedDateTime | null => {
  const parts = compactParts(property.value.trim())
  if (!parts) return null
  const allDay = property.params.VALUE?.toUpperCase() === 'DATE' || !property.value.includes('T')
  if (allDay) {
    return {
      date: `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
      time: '00:00',
      allDay: true,
    }
  }
  if (property.value.endsWith('Z')) {
    return localDateTime(
      new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)),
    )
  }
  const timeZone = property.params.TZID
  if (timeZone) {
    try {
      return localDateTime(dateFromZonedParts(parts, timeZone))
    } catch {
      // Unknown TZIDs are treated as floating local time instead of dropping private data.
    }
  }
  return {
    date: `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    time: `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`,
    allDay: false,
  }
}

const stableHash = (value: string): string => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

const stableEventId = (feedId: string, uid: string, recurrence: string, fallback: string): string => {
  const readable = uid
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48)
  return `ics-${stableHash(feedId)}-${readable || stableHash(fallback)}${recurrence ? `-${stableHash(recurrence)}` : ''}`
}

const categoriesOf = (lines: ContentLine[]): string[] => {
  const values = lines.filter((line) => line.name === 'CATEGORIES').flatMap((line) => line.value.split(/(?<!\\),/))
  return [
    ...new Set(
      values
        .map(unescapeText)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ]
}

const courseAndTitle = (summary: string, categories: string[]): { title: string; course: string } => {
  const bracket = /^(.*?)\s*\[([^\]]+)]\s*$/.exec(summary)
  return {
    title: bracket?.[1]?.trim() || summary,
    course: categories[0] ?? bracket?.[2]?.trim() ?? '',
  }
}

const isCanvasAssignment = (lines: ContentLine[], sourceType: IcsSourceType, summary: string): boolean => {
  const url = firstProperty(lines, 'URL')?.value ?? ''
  const description = firstProperty(lines, 'DESCRIPTION')?.value ?? ''
  if (/\/assignments(?:\/|\?|$)/i.test(url)) return true
  if (sourceType !== 'canvas') return false
  return /(?:assignment|quiz|discussion)\s+(?:due|deadline)/i.test(`${summary} ${description}`)
}

const assignmentFromEvent = (event: CalendarEvent, course: string, importedAt: string): HomeworkAssignment => ({
  id: `homework-${event.id}`,
  createdAt: importedAt,
  updatedAt: importedAt,
  source: 'imported',
  title: event.title,
  course: course || 'Canvas',
  dueDate: event.date,
  dueTime: event.allDay ? '23:59' : event.startTime,
  priority: 'medium',
  estimatedMinutes: 60,
  progress: 0,
  status: 'not-started',
  notes: event.description ?? '',
  subtasks: [],
  sourceLabel: event.sourceLabel,
  sourceUrl: event.sourceUrl,
  sourceFeedId: event.sourceFeedId,
  externalId: event.uid,
  importedAt,
})

export const parseIcsResult = (text: string, options: IcsImportOptions = {}): IcsParseResult => {
  if (!/(?:^|\r?\n)BEGIN:VCALENDAR(?:\r?\n|$)/.test(text))
    throw new Error('This file does not contain a valid iCalendar calendar.')
  const sourceLabel = options.sourceLabel?.trim() || 'Imported ICS'
  const sourceFeedId = options.sourceFeedId?.trim() || `feed-${stableHash(sourceLabel)}`
  const sourceType = options.sourceType ?? 'ics'
  const importedAt = options.importedAt ?? new Date().toISOString()
  const rawLines = unfoldLines(text)
  const calendarLines = rawLines.map(parseContentLine).filter((line): line is ContentLine => line !== null)
  const calendarName = firstProperty(calendarLines, 'X-WR-CALNAME')?.value
  const groups: ContentLine[][] = []
  let current: ContentLine[] | null = null
  for (const rawLine of rawLines) {
    if (rawLine === 'BEGIN:VEVENT') current = []
    else if (rawLine === 'END:VEVENT' && current) {
      groups.push(current)
      current = null
    } else if (current) {
      const line = parseContentLine(rawLine)
      if (line) current.push(line)
    }
  }

  let skippedEvents = 0
  const assignments: HomeworkAssignment[] = []
  const events = groups.flatMap((group, index) => {
    const rawSummary = firstProperty(group, 'SUMMARY')?.value
    const startProperty = firstProperty(group, 'DTSTART')
    if (!rawSummary || !startProperty) {
      skippedEvents += 1
      return []
    }
    const start = parseDateTime(startProperty)
    if (!start) {
      skippedEvents += 1
      return []
    }
    const endProperty = firstProperty(group, 'DTEND')
    const parsedEnd = endProperty ? parseDateTime(endProperty) : null
    const summary = unescapeText(rawSummary).trim()
    const categories = categoriesOf(group)
    const { title, course } = courseAndTitle(summary, categories)
    const uid = unescapeText(firstProperty(group, 'UID')?.value ?? '')
    const recurrence = firstProperty(group, 'RECURRENCE-ID')?.value ?? ''
    const fallback = `${index}|${summary}|${startProperty.value}|${endProperty?.value ?? ''}`
    const allDay = start.allDay
    const allDayEnd = parsedEnd?.allDay ? toLocalDate(addDays(new Date(`${parsedEnd.date}T12:00:00`), -1)) : start.date
    const defaultEnd = allDay
      ? '23:59'
      : timeFromMinutes(
          Math.min(23 * 60 + 59, Number(start.time.slice(0, 2)) * 60 + Number(start.time.slice(3, 5)) + 60),
        )
    const event: CalendarEvent = {
      id: stableEventId(sourceFeedId, uid, recurrence, fallback),
      createdAt: importedAt,
      updatedAt: importedAt,
      source: 'imported',
      title,
      date: start.date,
      startTime: allDay ? '00:00' : start.time,
      endTime: allDay ? '23:59' : (parsedEnd?.time ?? defaultEnd),
      ...(parsedEnd?.date !== start.date || (allDay && allDayEnd !== start.date)
        ? { endDate: allDay ? allDayEnd : parsedEnd?.date }
        : {}),
      allDay,
      kind: 'event',
      ...(course ? { course } : {}),
      ...(firstProperty(group, 'DESCRIPTION')
        ? { description: unescapeText(firstProperty(group, 'DESCRIPTION')?.value ?? '') }
        : {}),
      ...(firstProperty(group, 'LOCATION')
        ? { location: unescapeText(firstProperty(group, 'LOCATION')?.value ?? '') }
        : {}),
      ...(categories.length ? { categories } : {}),
      ...(firstProperty(group, 'URL') ? { sourceUrl: unescapeText(firstProperty(group, 'URL')?.value ?? '') } : {}),
      ...(uid ? { uid } : {}),
      sourceFeedId,
      importedAt,
      sourceLabel,
    }
    if (isCanvasAssignment(group, sourceType, summary)) assignments.push(assignmentFromEvent(event, course, importedAt))
    return [event]
  })

  return {
    events: dedupeById(events),
    assignments: dedupeById(assignments),
    ...(calendarName ? { calendarName: unescapeText(calendarName) } : {}),
    skippedEvents,
  }
}

const dedupeById = <T extends { id: string }>(items: T[]): T[] => [
  ...new Map(items.map((item) => [item.id, item])).values(),
]

export const mergeImportedEvents = (existing: CalendarEvent[], imported: CalendarEvent[]): CalendarEvent[] => {
  const byId = new Map(existing.map((event) => [event.id, event]))
  for (const event of imported) {
    const previous = byId.get(event.id)
    byId.set(event.id, previous ? { ...event, createdAt: previous.createdAt } : event)
  }
  return [...byId.values()]
}

export const mergeImportedAssignments = (
  existing: HomeworkAssignment[],
  imported: HomeworkAssignment[],
): HomeworkAssignment[] => {
  const byId = new Map(existing.map((assignment) => [assignment.id, assignment]))
  for (const assignment of imported) {
    const previous = byId.get(assignment.id)
    if (!previous) byId.set(assignment.id, assignment)
    else if (previous.source === 'imported') {
      byId.set(assignment.id, {
        ...assignment,
        createdAt: previous.createdAt,
        progress: previous.progress,
        status: previous.status,
        subtasks: previous.subtasks,
      })
    }
  }
  return [...byId.values()]
}

export const parseIcs = (text: string, sourceLabel = 'Imported ICS'): CalendarEvent[] =>
  parseIcsResult(text, { sourceLabel }).events
