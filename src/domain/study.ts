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
    for (let offset = 0; remaining > 0 && offset <= 14; offset += 1) {
      const day = new Date(startDay)
      day.setDate(day.getDate() + offset)
      if (day.getTime() > due.getTime()) break
      const date = toLocalDate(day)
      const dayEvents = [...existingEvents, ...blocks].filter((event) => event.date === date)
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
