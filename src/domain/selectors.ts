import type { AppData, CalendarEvent, HomeworkAssignment, MealEntry, Nutrition } from './types'
import { eventCoversDate, visibleAssignments, visibleCalendarEvents } from './calendar'
import { sumNutrition } from './recipe'
import { dateFromLocal, toLocalDate } from '../utilities/date'

export const eventsForDate = (data: AppData, date = toLocalDate(new Date())): CalendarEvent[] =>
  visibleCalendarEvents(data)
    .filter((event) => eventCoversDate(event, date))
    .toSorted((a, b) => a.startTime.localeCompare(b.startTime))

export const dueAssignments = (data: AppData): HomeworkAssignment[] =>
  visibleAssignments(data)
    .filter((assignment) => assignment.status !== 'complete')
    .toSorted((a, b) => dateFromLocal(a.dueDate, a.dueTime).getTime() - dateFromLocal(b.dueDate, b.dueTime).getTime())

export const mealsForDate = (data: AppData, date = toLocalDate(new Date())): MealEntry[] =>
  data.meals.filter((meal) => meal.date === date)

export const nutritionForDate = (data: AppData, date = toLocalDate(new Date())): Nutrition =>
  sumNutrition(data.foodLog.filter((entry) => entry.date === date).map((entry) => entry.nutritionSnapshot))

export const greeting = (date = new Date()): string => {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
