import { eventTimesOnDate } from './calendar'
import type { CalendarEvent } from './types'
import { minutesFromTime, toLocalDate } from '../utilities/date'

export interface TimedScheduleItem {
  event: CalendarEvent
  startTime: string
  endTime: string
}

export interface DashboardScheduleWindow {
  previous?: TimedScheduleItem
  current: TimedScheduleItem[]
  next?: TimedScheduleItem
  allDayCount: number
}

export const dashboardScheduleWindow = (
  events: CalendarEvent[],
  now = new Date(),
  date = toLocalDate(now),
  time?: string,
): DashboardScheduleWindow => {
  const nowMinutes = time ? minutesFromTime(time) : now.getHours() * 60 + now.getMinutes()
  const allDayCount = events.filter((event) => event.allDay).length
  const timed = events
    .filter((event) => !event.allDay)
    .flatMap((event): TimedScheduleItem[] => {
      const times = eventTimesOnDate(event, date)
      return times ? [{ event, ...times }] : []
    })
    .toSorted((first, second) => first.startTime.localeCompare(second.startTime))

  const current = timed.filter(
    (item) => minutesFromTime(item.startTime) <= nowMinutes && minutesFromTime(item.endTime) > nowMinutes,
  )
  const previous = timed.filter((item) => minutesFromTime(item.endTime) <= nowMinutes).at(-1)
  const next = timed.find((item) => minutesFromTime(item.startTime) > nowMinutes)

  return { previous, current, next, allDayCount }
}
