export const toLocalDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const addDays = (date: Date, amount: number): Date => {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export const startOfWeek = (date: Date): Date => {
  const next = new Date(date)
  const day = next.getDay()
  next.setDate(next.getDate() - day)
  next.setHours(0, 0, 0, 0)
  return next
}

export const dateFromLocal = (date: string, time = '00:00'): Date => {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number)
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute)
}

export const formatDate = (date: string, options?: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat(undefined, options ?? { weekday: 'short', month: 'short', day: 'numeric' }).format(
    dateFromLocal(date),
  )

export const formatTime = (time: string): string => {
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(2000, 0, 1, hour, minute),
  )
}

export const minutesFromTime = (time: string): number => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export const timeFromMinutes = (minutes: number): string => {
  const safe = Math.max(0, Math.min(23 * 60 + 59, minutes))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export const relativeDueLabel = (dueDate: string, today = new Date()): string => {
  const todayStart = dateFromLocal(toLocalDate(today))
  const due = dateFromLocal(dueDate)
  const days = Math.round((due.getTime() - todayStart.getTime()) / 86_400_000)
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return formatDate(dueDate, { weekday: 'long' })
  return formatDate(dueDate)
}

export const makeId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`
