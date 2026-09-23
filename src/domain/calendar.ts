import type { AppData, CalendarEvent, HomeworkAssignment } from './types'

export const enabledCalendarFeedIds = (data: Pick<AppData, 'settings'>): Set<string> =>
  new Set(data.settings.calendarFeeds.filter((feed) => feed.enabled).map((feed) => feed.id))

const sourceIsVisible = (sourceFeedId: string | undefined, enabledIds: Set<string>): boolean =>
  !sourceFeedId || enabledIds.has(sourceFeedId)

export const visibleCalendarEvents = (data: Pick<AppData, 'events' | 'settings'>): CalendarEvent[] => {
  const enabledIds = enabledCalendarFeedIds(data)
  return data.events.filter((event) => sourceIsVisible(event.sourceFeedId, enabledIds))
}

export const visibleAssignments = (data: Pick<AppData, 'assignments' | 'settings'>): HomeworkAssignment[] => {
  const enabledIds = enabledCalendarFeedIds(data)
  return data.assignments.filter((assignment) => sourceIsVisible(assignment.sourceFeedId, enabledIds))
}

export const eventCoversDate = (event: Pick<CalendarEvent, 'date' | 'endDate'>, date: string): boolean =>
  event.date <= date && (event.endDate ?? event.date) >= date

export const eventTimesOnDate = (
  event: Pick<CalendarEvent, 'date' | 'endDate' | 'startTime' | 'endTime' | 'allDay'>,
  date: string,
): { startTime: string; endTime: string } | null => {
  if (!eventCoversDate(event, date)) return null
  const firstDay = event.date === date
  const lastDay = (event.endDate ?? event.date) === date
  return {
    startTime: firstDay && !event.allDay ? event.startTime : '00:00',
    endTime: lastDay && !event.allDay ? event.endTime : '23:59',
  }
}

export const calendarEventOccurrenceKey = (event: CalendarEvent, date: string): string => `${event.id}-${date}`
