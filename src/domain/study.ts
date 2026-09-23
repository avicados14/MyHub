import type { CalendarEvent, HomeworkAssignment, StudySettings } from './types'
import { dateFromLocal, makeId, minutesFromTime, timeFromMinutes, toLocalDate } from '../utilities/date'

const priorityScore = { high: 0, medium: 1, low: 2 }

export const rankAssignments = (assignments: HomeworkAssignment[]): HomeworkAssignment[] =>
  assignments
    .filter((assignment) => assignment.status !== 'complete')
    .toSorted((a, b) => {
      const due = dateFromLocal(a.dueDate, a.dueTime).getTime() - dateFromLocal(b.dueDate, b.dueTime).getTime()
      if (due !== 0) return due
      const priority = priorityScore[a.priority] - priorityScore[b.priority]
      if (priority !== 0) return priority
      return a.id.localeCompare(b.id)
    })

const overlaps = (start: number, end: number, event: CalendarEvent): boolean => {
  const eventStart = minutesFromTime(event.startTime)
  const eventEnd = minutesFromTime(event.endTime)
  return start < eventEnd && end > eventStart
}

const MAX_PLANNING_DAYS = 366 * 5

export interface StudyBlockValidation {
  valid: boolean
  warning?: string
}

export const validateStudyBlock = (
  candidate: Pick<CalendarEvent, 'id' | 'date' | 'startTime' | 'endTime'>,
  existingEvents: CalendarEvent[],
): StudyBlockValidation => {
  const start = minutesFromTime(candidate.startTime)
  const end = minutesFromTime(candidate.endTime)
  if (end <= start) return { valid: false, warning: 'End time must be after start time.' }
  const conflict = existingEvents.find(
    (event) => event.id !== candidate.id && event.date === candidate.date && overlaps(start, end, event),
  )
  return conflict
    ? { valid: true, warning: `This overlaps “${conflict.title}” from ${conflict.startTime} to ${conflict.endTime}.` }
    : { valid: true }
}

export interface StudyPlanResult {
  blocks: CalendarEvent[]
  unscheduledMinutes: number
  explanation: string
}

export const generateStudyPlan = (
  assignments: HomeworkAssignment[],
  existingEvents: CalendarEvent[],
  settings: StudySettings,
  today = new Date(),
): StudyPlanResult => {
  const blocks: CalendarEvent[] = []
  let unscheduledMinutes = 0
  const startDay = new Date(today)
  startDay.setHours(0, 0, 0, 0)

  for (const assignment of rankAssignments(assignments)) {
    let remaining = Math.max(0, Math.round(assignment.estimatedMinutes * (1 - assignment.progress / 100)))
    const alreadyScheduled = existingEvents
      .filter((event) => event.kind === 'study' && event.assignmentId === assignment.id && !event.completed)
      .reduce((sum, event) => sum + minutesFromTime(event.endTime) - minutesFromTime(event.startTime), 0)
    remaining = Math.max(0, remaining - alreadyScheduled)

    const due = dateFromLocal(assignment.dueDate, assignment.dueTime)
    const deadlineDays = Math.max(0, Math.ceil((due.getTime() - startDay.getTime()) / 86_400_000))
    const finalOffset = Math.min(deadlineDays, MAX_PLANNING_DAYS)
    for (let offset = 0; remaining > 0 && offset <= finalOffset; offset += 1) {
      const day = new Date(startDay)
      day.setDate(day.getDate() + offset)
      if (day.getTime() > due.getTime()) break
      const date = toLocalDate(day)
      const avoided: CalendarEvent[] = settings.avoidTimes
        .filter((range) => range.days.includes(day.getDay()))
        .map((range) => ({
          id: `avoid-${range.id}-${date}`,
          createdAt: '',
          updatedAt: '',
          source: 'generated',
          kind: 'event',
          title: range.label || 'Avoid time',
          date,
          startTime: range.startTime,
          endTime: range.endTime,
        }))
      const dayEvents = [...existingEvents, ...blocks, ...avoided].filter((event) => event.date === date)
      let cursor = minutesFromTime(settings.earliestTime)
      const limit = minutesFromTime(settings.latestTime)

      while (remaining > 0 && cursor < limit) {
        const duration = Math.min(settings.defaultBlockMinutes, settings.maxBlockMinutes, remaining)
        const end = cursor + duration
        const conflict = dayEvents.find((event) => overlaps(cursor, end, event))
        if (conflict) {
          cursor = minutesFromTime(conflict.endTime) + settings.breakMinutes
          continue
        }
        if (end > limit || dateFromLocal(date, timeFromMinutes(end)).getTime() > due.getTime()) break
        const timestamp = new Date().toISOString()
        const block: CalendarEvent = {
          id: makeId('study'),
          createdAt: timestamp,
          updatedAt: timestamp,
          source: 'generated',
          title: assignment.title,
          course: assignment.course,
          assignmentId: assignment.id,
          date,
          startTime: timeFromMinutes(cursor),
          endTime: timeFromMinutes(end),
          kind: 'study',
          locked: false,
          userAdjusted: false,
          completed: false,
          sourceLabel: 'Generated study plan',
        }
        blocks.push(block)
        dayEvents.push(block)
        remaining -= duration
        cursor = end + settings.breakMinutes
      }
    }
    unscheduledMinutes += remaining
  }

  return {
    blocks,
    unscheduledMinutes,
    explanation:
      unscheduledMinutes > 0
        ? `${unscheduledMinutes} minutes could not fit before the current deadlines.`
        : blocks.length > 0
          ? `Created ${blocks.length} conflict-free study blocks.`
          : 'Everything is already scheduled.',
  }
}
