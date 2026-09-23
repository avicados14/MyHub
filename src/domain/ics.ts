import { RRule } from 'rrule'
import type { CalendarEvent, HomeworkAssignment } from './types'
import { addDays, dateFromLocal, timeFromMinutes, toLocalDate } from '../utilities/date'

export type IcsSourceType = 'canvas' | 'google' | 'ics'

export interface IcsImportOptions {
  sourceLabel?: string
  sourceFeedId?: string
  sourceType?: IcsSourceType
  sourceUrl?: string
  importedAt?: string
  windowStart?: string
  windowEnd?: string
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

interface ParsedComponent {
  group: ContentLine[]
  index: number
  summary: string
  start: ParsedDateTime
  startProperty: ContentLine
  end?: ParsedDateTime
  uid: string
  recurrenceKey: string
}

const MAX_OCCURRENCES_PER_EVENT = 1_000
const DEFAULT_RECURRENCE_PAST_DAYS = 366
const DEFAULT_RECURRENCE_FUTURE_DAYS = 366 * 2

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
  sourceType: event.sourceType,
  externalId: event.uid,
  importedAt,
})

const recurrenceKeyOf = (value: ParsedDateTime): string =>
  value.allDay ? value.date : `${value.date}T${value.time.replace(':', '')}`

const pseudoUtcDate = (value: ParsedDateTime): Date => {
  const [year = 1970, month = 1, day = 1] = value.date.split('-').map(Number)
  const [hour = 0, minute = 0] = value.time.split(':').map(Number)
  return new Date(Date.UTC(year, month - 1, day, hour, minute))
}

const parsedFromPseudoUtc = (date: Date, allDay: boolean): ParsedDateTime => ({
  date: `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`,
  time: allDay
    ? '00:00'
    : `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`,
  allDay,
})

const recurrenceBounds = (options: IcsImportOptions): { start: Date; end: Date } => {
  const imported = new Date(options.importedAt ?? Date.now())
  const base = Number.isNaN(imported.getTime()) ? new Date() : imported
  const defaultStart = addDays(base, -DEFAULT_RECURRENCE_PAST_DAYS)
  const defaultEnd = addDays(base, DEFAULT_RECURRENCE_FUTURE_DAYS)
  const start = options.windowStart ? dateFromLocal(options.windowStart) : defaultStart
  const end = options.windowEnd ? dateFromLocal(options.windowEnd, '23:59') : defaultEnd
  return {
    start: new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0)),
    end: new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59)),
  }
}

const explicitWindowContains = (event: CalendarEvent, options: IcsImportOptions): boolean =>
  (!options.windowStart || (event.endDate ?? event.date) >= options.windowStart) &&
  (!options.windowEnd || event.date <= options.windowEnd)

const exdateKeys = (group: ContentLine[]): Set<string> => {
  const keys = new Set<string>()
  for (const property of group.filter((line) => line.name === 'EXDATE')) {
    for (const value of property.value.split(',')) {
      const parsed = parseDateTime({ ...property, value })
      if (parsed) keys.add(recurrenceKeyOf(parsed))
    }
  }
  return keys
}

const recurrenceStarts = (
  component: ParsedComponent,
  options: IcsImportOptions,
  skippedKeys: Set<string>,
): Array<{ start: ParsedDateTime; key: string }> => {
  const property = firstProperty(component.group, 'RRULE')
  if (!property) return [{ start: component.start, key: '' }]
  try {
    const parsed = RRule.parseString(property.value)
    // Sub-hourly feeds can explode even inside a finite date window and are not normal school-calendar forms.
    if (parsed.freq === RRule.HOURLY || parsed.freq === RRule.MINUTELY || parsed.freq === RRule.SECONDLY) {
      return [{ start: component.start, key: recurrenceKeyOf(component.start) }]
    }
    const rule = new RRule({ ...parsed, dtstart: pseudoUtcDate(component.start) })
    const bounds = recurrenceBounds(options)
    const starts = rule.between(bounds.start, bounds.end, true).slice(0, MAX_OCCURRENCES_PER_EVENT)
    return starts.flatMap((date) => {
      const start = parsedFromPseudoUtc(date, component.start.allDay)
      const key = recurrenceKeyOf(start)
      return skippedKeys.has(key) ? [] : [{ start, key }]
    })
  } catch {
    return [{ start: component.start, key: recurrenceKeyOf(component.start) }]
  }
}

const shiftedEnd = (component: ParsedComponent, occurrenceStart: ParsedDateTime): ParsedDateTime | undefined => {
  if (!component.end) return undefined
  const sourceStart = pseudoUtcDate(component.start)
  const sourceEnd = pseudoUtcDate(component.end)
  const duration = Math.max(0, sourceEnd.getTime() - sourceStart.getTime())
  return parsedFromPseudoUtc(new Date(pseudoUtcDate(occurrenceStart).getTime() + duration), component.end.allDay)
}

const buildEvent = (
  component: ParsedComponent,
  occurrenceStart: ParsedDateTime,
  occurrenceKey: string,
  options: Required<Pick<IcsImportOptions, 'sourceLabel' | 'sourceFeedId' | 'sourceType' | 'importedAt'>> &
    Pick<IcsImportOptions, 'sourceUrl'>,
): CalendarEvent => {
  const { group, index, summary, uid } = component
  const categories = categoriesOf(group)
  const { title, course } = courseAndTitle(summary, categories)
  const occurrenceEnd = shiftedEnd(component, occurrenceStart)
  const allDay = occurrenceStart.allDay
  const allDayEnd = occurrenceEnd?.allDay
    ? toLocalDate(addDays(new Date(`${occurrenceEnd.date}T12:00:00`), -1))
    : occurrenceStart.date
  const defaultEnd = allDay
    ? '23:59'
    : timeFromMinutes(
        Math.min(
          23 * 60 + 59,
          Number(occurrenceStart.time.slice(0, 2)) * 60 + Number(occurrenceStart.time.slice(3, 5)) + 60,
        ),
      )
  const fallback = `${index}|${summary}|${component.startProperty.value}|${firstProperty(group, 'DTEND')?.value ?? ''}`
  const itemUrl = firstProperty(group, 'URL')?.value
  return {
    id: stableEventId(options.sourceFeedId, uid, occurrenceKey, fallback),
    createdAt: options.importedAt,
    updatedAt: options.importedAt,
    source: 'imported',
    title,
    date: occurrenceStart.date,
    startTime: allDay ? '00:00' : occurrenceStart.time,
    endTime: allDay ? '23:59' : (occurrenceEnd?.time ?? defaultEnd),
    ...(occurrenceEnd?.date !== occurrenceStart.date || (allDay && allDayEnd !== occurrenceStart.date)
      ? { endDate: allDay ? allDayEnd : occurrenceEnd?.date }
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
    ...(itemUrl || options.sourceUrl ? { sourceUrl: unescapeText(itemUrl ?? options.sourceUrl ?? '') } : {}),
    ...(uid ? { uid } : {}),
    sourceFeedId: options.sourceFeedId,
    sourceType: options.sourceType,
    importedAt: options.importedAt,
    sourceLabel: options.sourceLabel,
  }
}

const dedupeById = <T extends { id: string }>(items: T[]): T[] => [
  ...new Map(items.map((item) => [item.id, item])).values(),
]

export const parseIcsResult = (text: string, options: IcsImportOptions = {}): IcsParseResult => {
  if (!/(?:^|\r?\n)BEGIN:VCALENDAR(?:\r?\n|$)/.test(text))
    throw new Error('This file does not contain a valid iCalendar calendar.')
  const normalizedOptions = {
    sourceLabel: options.sourceLabel?.trim() || 'Imported ICS',
    sourceFeedId: options.sourceFeedId?.trim() || `feed-${stableHash(options.sourceLabel?.trim() || 'Imported ICS')}`,
    sourceType: options.sourceType ?? 'ics',
    importedAt: options.importedAt ?? new Date().toISOString(),
    ...(options.sourceUrl ? { sourceUrl: options.sourceUrl } : {}),
  }
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
  const components = groups.flatMap((group, index): ParsedComponent[] => {
    const rawSummary = firstProperty(group, 'SUMMARY')?.value
    const startProperty = firstProperty(group, 'DTSTART')
    const recurrenceProperty = firstProperty(group, 'RECURRENCE-ID')
    const recurrence = recurrenceProperty ? parseDateTime(recurrenceProperty) : null
    const cancelled = firstProperty(group, 'STATUS')?.value.toUpperCase() === 'CANCELLED'
    if ((!rawSummary && !cancelled) || (!startProperty && !recurrence)) {
      skippedEvents += 1
      return []
    }
    const effectiveStartProperty = startProperty ?? recurrenceProperty!
    const start = parseDateTime(effectiveStartProperty)
    if (!start) {
      skippedEvents += 1
      return []
    }
    return [
      {
        group,
        index,
        summary: unescapeText(rawSummary ?? 'Cancelled occurrence').trim(),
        start,
        startProperty: effectiveStartProperty,
        end: firstProperty(group, 'DTEND') ? (parseDateTime(firstProperty(group, 'DTEND')!) ?? undefined) : undefined,
        uid: unescapeText(firstProperty(group, 'UID')?.value ?? ''),
        recurrenceKey: recurrence ? recurrenceKeyOf(recurrence) : '',
      },
    ]
  })

  const bySeries = new Map<string, ParsedComponent[]>()
  for (const component of components) {
    const key = component.uid || `__component-${component.index}`
    bySeries.set(key, [...(bySeries.get(key) ?? []), component])
  }

  const events: CalendarEvent[] = []
  const assignments: HomeworkAssignment[] = []
  for (const series of bySeries.values()) {
    const overrides = series.filter((component) => component.recurrenceKey)
    const overrideKeys = new Set(overrides.map((component) => component.recurrenceKey))
    const masters = series.filter((component) => !component.recurrenceKey)

    for (const master of masters) {
      const excluded = new Set([...exdateKeys(master.group), ...overrideKeys])
      for (const occurrence of recurrenceStarts(master, options, excluded)) {
        const event = buildEvent(master, occurrence.start, occurrence.key, normalizedOptions)
        if (!explicitWindowContains(event, options)) continue
        events.push(event)
        if (isCanvasAssignment(master.group, normalizedOptions.sourceType, master.summary)) {
          assignments.push(
            assignmentFromEvent(
              event,
              courseAndTitle(master.summary, categoriesOf(master.group)).course,
              normalizedOptions.importedAt,
            ),
          )
        }
      }
    }

    for (const override of overrides) {
      if (firstProperty(override.group, 'STATUS')?.value.toUpperCase() === 'CANCELLED') continue
      const event = buildEvent(override, override.start, override.recurrenceKey, normalizedOptions)
      if (!explicitWindowContains(event, options)) continue
      events.push(event)
      if (isCanvasAssignment(override.group, normalizedOptions.sourceType, override.summary)) {
        assignments.push(
          assignmentFromEvent(
            event,
            courseAndTitle(override.summary, categoriesOf(override.group)).course,
            normalizedOptions.importedAt,
          ),
        )
      }
    }
  }

  return {
    events: dedupeById(events),
    assignments: dedupeById(assignments),
    ...(calendarName ? { calendarName: unescapeText(calendarName) } : {}),
    skippedEvents,
  }
}

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

export const replaceImportedFeedEvents = (
  existing: CalendarEvent[],
  sourceFeedId: string,
  imported: CalendarEvent[],
): CalendarEvent[] => {
  const importedIds = new Set(imported.map((event) => event.id))
  return mergeImportedEvents(existing, imported).filter(
    (event) => event.sourceFeedId !== sourceFeedId || importedIds.has(event.id),
  )
}

export const replaceImportedFeedAssignments = (
  existing: HomeworkAssignment[],
  sourceFeedId: string,
  imported: HomeworkAssignment[],
): HomeworkAssignment[] => {
  const importedIds = new Set(imported.map((assignment) => assignment.id))
  return mergeImportedAssignments(existing, imported).filter(
    (assignment) => assignment.sourceFeedId !== sourceFeedId || importedIds.has(assignment.id),
  )
}

export const parseIcs = (text: string, sourceLabel = 'Imported ICS'): CalendarEvent[] =>
  parseIcsResult(text, { sourceLabel }).events
