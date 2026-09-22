import type { CalendarEvent } from './types'

const unfoldLines = (text: string): string[] => text.replace(/\r\n[ \t]/g, '').split(/\r?\n/)
const valueOf = (lines: string[], key: string): string | undefined => lines.find((line) => line.startsWith(`${key}:`) || line.startsWith(`${key};`))?.split(':').slice(1).join(':')
const unescapeText = (value: string): string => value.replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')

const parseDateTime = (value: string): { date: string; time: string } => {
  const clean = value.replace(/Z$/, '')
  const date = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  if (clean.length <= 8) return { date, time: '00:00' }
  return { date, time: `${clean.slice(9, 11)}:${clean.slice(11, 13)}` }
}

export const parseIcs = (text: string, sourceLabel = 'Imported ICS'): CalendarEvent[] => {
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('This file does not contain a valid iCalendar calendar.')
  const lines = unfoldLines(text)
  const groups: string[][] = []
  let current: string[] | null = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') current = []
    else if (line === 'END:VEVENT' && current) { groups.push(current); current = null }
    else if (current) current.push(line)
  }
  const importedAt = new Date().toISOString()
  return groups.flatMap((group, index) => {
    const summary = valueOf(group, 'SUMMARY')
    const start = valueOf(group, 'DTSTART')
    if (!summary || !start) return []
    const end = valueOf(group, 'DTEND')
    const uid = valueOf(group, 'UID') ?? `${index}-${summary}`
    const parsedStart = parseDateTime(start)
    const parsedEnd = end ? parseDateTime(end) : { date: parsedStart.date, time: parsedStart.time === '00:00' ? '23:59' : parsedStart.time }
    return [{
      id: `ics-${uid.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)}`,
      createdAt: importedAt,
      updatedAt: importedAt,
      source: 'imported' as const,
      title: unescapeText(summary),
      date: parsedStart.date,
      startTime: parsedStart.time,
      endTime: parsedEnd.time,
      kind: 'event' as const,
      course: valueOf(group, 'CATEGORIES') ? unescapeText(valueOf(group, 'CATEGORIES') ?? '') : undefined,
      sourceLabel,
    }]
  })
}
