import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClockArrowDown,
  ClockArrowUp,
  ExternalLink,
  FileUp,
  Lock,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { Card, Field, Modal, PageHeader, SegmentedControl, StatusBadge } from '../../components/ui'
import { calendarEventOccurrenceKey, eventCoversDate, visibleCalendarEvents } from '../../domain/calendar'
import { mergeImportedAssignments, mergeImportedEvents, parseIcsResult, type IcsSourceType } from '../../domain/ics'
import { validateStudyBlock } from '../../domain/study'
import type { CalendarEvent, CalendarFeed, HomeworkAssignment } from '../../domain/types'
import { consumePrivateCalendarSnapshot } from '../../sync/calendarSnapshot'
import { useGitHubSync } from '../../sync/GitHubSyncContext'
import {
  addDays,
  dateFromLocal,
  dateTimeInZone,
  formatDate,
  formatTime,
  makeId,
  minutesFromTime,
  startOfWeek,
  timeFromMinutes,
  toLocalDate,
} from '../../utilities/date'
import '../../styles/school-v2.css'

const views = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

type DateWindow = 'term' | 'year' | 'all'

interface ImportFeedPreview {
  feed: CalendarFeed
  events: CalendarEvent[]
  assignments: HomeworkAssignment[]
  totalEvents: number
  totalAssignments: number
}

interface ImportPreview {
  feeds: ImportFeedPreview[]
  rangeLabel: string
}

const safeExternalUrl = (value?: string): string | null => {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

const stableLocalFeedId = (value: string): string => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `calendar-feed-${(hash >>> 0).toString(36)}`
}

const boundsForWindow = (window: DateWindow, today = new Date()): { start?: string; end?: string; label: string } => {
  const year = today.getFullYear()
  if (window === 'all') return { label: 'all history' }
  if (window === 'year') return { start: `${year}-01-01`, end: `${year}-12-31`, label: `${year}` }
  const month = today.getMonth()
  const [startMonth, endMonth] = month <= 4 ? [1, 5] : month <= 7 ? [6, 8] : [9, 12]
  return {
    start: `${year}-${String(startMonth).padStart(2, '0')}-01`,
    end: `${year}-${String(endMonth).padStart(2, '0')}-31`,
    label: month <= 4 ? `spring term ${year}` : month <= 7 ? `summer term ${year}` : `fall term ${year}`,
  }
}

const inBounds = (date: string, bounds: ReturnType<typeof boundsForWindow>): boolean =>
  (!bounds.start || date >= bounds.start) && (!bounds.end || date <= bounds.end)

const SNAP_MINUTES = 15
const POINTER_PIXELS_PER_SNAP = 8

const upsertFeeds = (existing: CalendarFeed[], incoming: CalendarFeed[]): CalendarFeed[] => {
  const feeds = new Map(existing.map((feed) => [feed.id, feed]))
  for (const feed of incoming) feeds.set(feed.id, { ...feeds.get(feed.id), ...feed })
  return [...feeds.values()]
}

export default function CalendarPage() {
  const { data, updateData, announce } = useApp()
  const { calendarAccess } = useGitHubSync()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') ?? 'week'
  const today = dateTimeInZone(new Date(), data.settings.calendarTimeZone).date
  const [anchor, setAnchor] = useState(() => dateFromLocal(today))
  const [eventModal, setEventModal] = useState<'add' | CalendarEvent | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importError, setImportError] = useState('')
  const [privateStatus, setPrivateStatus] = useState('')
  const [privateBusy, setPrivateBusy] = useState(false)
  const weekStart = startOfWeek(anchor)
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  const visibleEvents = useMemo(() => visibleCalendarEvents(data), [data])

  const eventsByDate = useMemo(
    () =>
      new Map(
        days.map((day) => {
          const date = toLocalDate(day)
          return [
            date,
            visibleEvents
              .filter((event) => eventCoversDate(event, date))
              .toSorted((a, b) => a.startTime.localeCompare(b.startTime)),
          ]
        }),
      ),
    [days, visibleEvents],
  )

  const navigate = (direction: number) => {
    const next = new Date(anchor)
    if (view === 'day') next.setDate(next.getDate() + direction)
    else if (view === 'month') next.setMonth(next.getMonth() + direction)
    else next.setDate(next.getDate() + direction * 7)
    setAnchor(next)
  }

  const saveEvent = (form: HTMLFormElement) => {
    const values = new FormData(form)
    const current = eventModal === 'add' ? null : eventModal
    const allDay = values.get('allDay') === 'on'
    const candidate = {
      id: current?.id ?? '',
      date: String(values.get('date')),
      startTime: allDay ? '00:00' : String(values.get('startTime')),
      endTime: allDay ? '23:59' : String(values.get('endTime')),
    }
    const validation = validateStudyBlock(candidate, data.events)
    if (!validation.valid) {
      announce(validation.warning ?? 'Check the event times.')
      return
    }
    const timestamp = new Date().toISOString()
    const sourceLabel = String(values.get('sourceLabel') || '').trim()
    const sourceUrl = String(values.get('sourceUrl') || '').trim()
    const saved: CalendarEvent = {
      ...(current ?? {
        id: makeId('event'),
        createdAt: timestamp,
        source: 'manual' as const,
        kind: 'event' as const,
      }),
      updatedAt: timestamp,
      title: String(values.get('title')).trim(),
      date: candidate.date,
      startTime: candidate.startTime,
      endTime: candidate.endTime,
      allDay,
      course: String(values.get('course') || '').trim(),
      description: String(values.get('description') || '').trim(),
      location: String(values.get('location') || '').trim(),
      ...(sourceLabel ? { sourceLabel } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(current?.kind === 'study' ? { userAdjusted: true, locked: values.get('locked') === 'on' } : {}),
    }
    updateData(
      (previous) => ({
        ...previous,
        events: current
          ? previous.events.map((event) => (event.id === current.id ? saved : event))
          : [...previous.events, saved],
      }),
      `${current?.kind === 'study' ? 'Study block' : 'Event'} ${current ? 'updated' : 'added'}.${validation.warning ? ` Warning: ${validation.warning}` : ''}`,
    )
    setEventModal(null)
  }

  const deleteEvent = (event: CalendarEvent) => {
    if (!window.confirm(`Delete “${event.title}”?`)) return
    updateData(
      (previous) => ({ ...previous, events: previous.events.filter((item) => item.id !== event.id) }),
      `${event.kind === 'study' ? 'Study block' : 'Event'} deleted.`,
    )
    setEventModal(null)
  }

  const updateStudyBlock = (
    event: CalendarEvent,
    change: Pick<CalendarEvent, 'date' | 'startTime' | 'endTime'>,
    message: string,
  ) => {
    const validation = validateStudyBlock({ id: event.id, ...change }, data.events)
    if (!validation.valid) {
      announce(validation.warning ?? 'That study block time is invalid.')
      return
    }
    updateData(
      (previous) => ({
        ...previous,
        events: previous.events.map((item) =>
          item.id === event.id ? { ...item, ...change, userAdjusted: true, updatedAt: new Date().toISOString() } : item,
        ),
      }),
      `${message}${validation.warning ? ` Warning: ${validation.warning}` : ''}`,
    )
  }

  const moveStudyBlock = (event: CalendarEvent, date: string) =>
    updateStudyBlock(
      event,
      { date, startTime: event.startTime, endTime: event.endTime },
      `Study block moved to ${formatDate(date)}.`,
    )

  const moveStudyBlockByPointer = (event: CalendarEvent, date: string, minuteDelta: number) => {
    const duration = minutesFromTime(event.endTime) - minutesFromTime(event.startTime)
    const nextStart = Math.max(0, Math.min(23 * 60 + 59 - duration, minutesFromTime(event.startTime) + minuteDelta))
    updateStudyBlock(
      event,
      { date, startTime: timeFromMinutes(nextStart), endTime: timeFromMinutes(nextStart + duration) },
      `Study block moved to ${formatDate(date)} at ${formatTime(timeFromMinutes(nextStart))}.`,
    )
  }

  const resizeStudyBlock = (event: CalendarEvent, minutes: number) => {
    const nextEnd = minutesFromTime(event.endTime) + minutes
    if (nextEnd <= minutesFromTime(event.startTime) || nextEnd > 23 * 60 + 59) {
      announce('A study block must end after it starts and before midnight.')
      return
    }
    updateStudyBlock(
      event,
      { date: event.date, startTime: event.startTime, endTime: timeFromMinutes(nextEnd) },
      `Study block ${minutes > 0 ? 'extended' : 'shortened'} by 15 minutes.`,
    )
  }

  const resizeStudyBlockByPointer = (event: CalendarEvent, edge: 'start' | 'end', minutes: number) => {
    const nextStart = minutesFromTime(event.startTime) + (edge === 'start' ? minutes : 0)
    const nextEnd = minutesFromTime(event.endTime) + (edge === 'end' ? minutes : 0)
    if (nextStart < 0 || nextEnd > 23 * 60 + 59 || nextEnd - nextStart < SNAP_MINUTES) {
      announce('A study block must remain at least 15 minutes and stay within one day.')
      return
    }
    updateStudyBlock(
      event,
      { date: event.date, startTime: timeFromMinutes(nextStart), endTime: timeFromMinutes(nextEnd) },
      `Study block ${edge === 'start' ? 'start' : 'end'} resized by ${Math.abs(minutes)} minutes.`,
    )
  }

  const previewFiles = async (form: HTMLFormElement) => {
    setImportError('')
    setImportPreview(null)
    const values = new FormData(form)
    const files = Array.from((form.elements.namedItem('files') as HTMLInputElement).files ?? [])
    const sourceName = String(values.get('sourceName') || '').trim()
    const sourceType = String(values.get('sourceType')) as IcsSourceType
    const dateWindow = String(values.get('dateWindow')) as DateWindow
    if (!files.length) {
      setImportError('Choose at least one .ics file.')
      return
    }
    const bounds = boundsForWindow(dateWindow, dateFromLocal(today))
    try {
      const importedAt = new Date().toISOString()
      const previews = await Promise.all(
        files.map(async (file) => {
          const feedName = files.length === 1 ? sourceName : `${sourceName} — ${file.name.replace(/\.ics$/i, '')}`
          const feedId = stableLocalFeedId(`${sourceType}|${sourceName.toLowerCase()}|${file.name.toLowerCase()}`)
          const parsed = parseIcsResult(await file.text(), {
            sourceLabel: feedName,
            sourceFeedId: feedId,
            sourceType,
            importedAt,
            windowStart: bounds.start,
            windowEnd: bounds.end,
            timeZone: data.settings.calendarTimeZone,
          })
          const events = parsed.events.filter((event) => inBounds(event.date, bounds))
          const assignments = parsed.assignments.filter((assignment) => inBounds(assignment.dueDate, bounds))
          const feed: CalendarFeed = {
            id: feedId,
            name: feedName,
            kind: sourceType,
            importMode: 'file',
            enabled: true,
            status: 'connected',
            lastRefresh: importedAt,
            lastImportCount: events.length,
            lastAssignmentCount: assignments.length,
          }
          return {
            feed,
            events,
            assignments,
            totalEvents: parsed.events.length,
            totalAssignments: parsed.assignments.length,
          }
        }),
      )
      setImportPreview({ feeds: previews, rangeLabel: bounds.label })
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'The calendar files could not be read.')
    }
  }

  const confirmFileImport = () => {
    if (!importPreview) return
    const events = importPreview.feeds.flatMap((preview) => preview.events)
    const assignments = importPreview.feeds.flatMap((preview) => preview.assignments)
    const feeds = importPreview.feeds.map((preview) => preview.feed)
    updateData(
      (previous) => ({
        ...previous,
        events: mergeImportedEvents(previous.events, events),
        assignments: mergeImportedAssignments(previous.assignments, assignments),
        settings: { ...previous.settings, calendarFeeds: upsertFeeds(previous.settings.calendarFeeds, feeds) },
      }),
      `Imported ${events.length} calendar events and ${assignments.length} homework assignments from ${feeds.length} source${feeds.length === 1 ? '' : 's'}.`,
    )
    setImportOpen(false)
    setImportPreview(null)
  }

  const importPrivateSnapshot = useCallback(
    async (silent = false) => {
      if (!calendarAccess.available) {
        if (!silent)
          setPrivateStatus(calendarAccess.reason ?? 'Unlock GitHub Sync to check the private calendar snapshot.')
        return
      }
      setPrivateBusy(true)
      if (!silent) setPrivateStatus('Checking the encrypted private calendar snapshot…')
      try {
        const parsed = await consumePrivateCalendarSnapshot(calendarAccess, data.settings.calendarTimeZone)
        if (!parsed) {
          setPrivateStatus('No encrypted calendar snapshot exists at myhub-data/v1/calendars.enc yet.')
          return
        }
        const checkedAt = new Date().toISOString()
        updateData((previous) => ({
          ...previous,
          events: mergeImportedEvents(previous.events, parsed.events),
          assignments: mergeImportedAssignments(previous.assignments, parsed.assignments),
          settings: {
            ...previous.settings,
            calendarFeeds: upsertFeeds(
              previous.settings.calendarFeeds,
              parsed.feeds.map((feed) => ({
                id: feed.id,
                name: feed.name,
                kind: feed.type,
                importMode: 'private-snapshot' as const,
                enabled: previous.settings.calendarFeeds.find((item) => item.id === feed.id)?.enabled ?? true,
                status: 'connected' as const,
                lastRefresh: checkedAt,
                lastImportCount: feed.eventCount,
                lastAssignmentCount: feed.assignmentCount,
              })),
            ),
          },
        }))
        setPrivateStatus(
          `Private snapshot current: ${parsed.events.length} events and ${parsed.assignments.length} assignments checked ${new Date(checkedAt).toLocaleTimeString()}.`,
        )
      } catch (error) {
        setPrivateStatus(
          error instanceof Error ? error.message : 'The encrypted private calendar snapshot could not be imported.',
        )
      } finally {
        setPrivateBusy(false)
      }
    },
    [calendarAccess, data.settings.calendarTimeZone, updateData],
  )

  useEffect(() => {
    if (!calendarAccess.available) return
    void importPrivateSnapshot(true)
    const interval = window.setInterval(
      () => {
        void importPrivateSnapshot(true)
      },
      15 * 60 * 1000,
    )
    return () => window.clearInterval(interval)
  }, [calendarAccess.available, importPrivateSnapshot])

  const displayEvents =
    view === 'day'
      ? visibleEvents
          .filter((event) => eventCoversDate(event, toLocalDate(anchor)))
          .toSorted((a, b) => a.startTime.localeCompare(b.startTime))
      : visibleEvents

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Classes, imported calendars, and study time share one trustworthy schedule."
        action={
          <button className="button button--primary" type="button" onClick={() => setEventModal('add')}>
            <CalendarPlus aria-hidden="true" /> Add event
          </button>
        }
      />
      <Card className="calendar-import-bar">
        <div>
          <FileUp aria-hidden="true" />
          <span>
            <strong>Calendar sources</strong>
            <small>
              {data.settings.calendarFeeds.filter((feed) => feed.enabled).length} enabled ·{' '}
              {data.settings.calendarFeeds.length - data.settings.calendarFeeds.filter((feed) => feed.enabled).length}{' '}
              hidden · records remain stored on this device
            </small>
          </span>
        </div>
        <div className="calendar-import-bar__actions">
          <button className="button button--secondary" type="button" onClick={() => setImportOpen(true)}>
            <FileUp aria-hidden="true" /> Import .ics files
          </button>
          <button
            className="button button--quiet"
            type="button"
            disabled={privateBusy}
            onClick={() => void importPrivateSnapshot()}
          >
            <RefreshCw aria-hidden="true" /> Check private snapshot
          </button>
        </div>
        <p className="calendar-private-status" role="status">
          {privateStatus ||
            (calendarAccess.available
              ? 'Encrypted snapshot checks run on open and every 15 minutes while this calendar is open.'
              : calendarAccess.reason)}
        </p>
      </Card>
      <Card className="calendar-shell">
        <div className="calendar-toolbar">
          <div className="calendar-toolbar__nav">
            <button className="icon-button" type="button" aria-label="Previous period" onClick={() => navigate(-1)}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <button className="button button--quiet" type="button" onClick={() => setAnchor(dateFromLocal(today))}>
              Today
            </button>
            <button className="icon-button" type="button" aria-label="Next period" onClick={() => navigate(1)}>
              <ChevronRight aria-hidden="true" />
            </button>
            <h2>
              {view === 'month'
                ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(anchor)
                : `${formatDate(toLocalDate(view === 'day' ? anchor : weekStart), { month: 'long', day: 'numeric' })}${view === 'week' ? ` – ${formatDate(toLocalDate(days[6] ?? weekStart), { month: 'short', day: 'numeric' })}` : ''}`}
            </h2>
          </div>
          <SegmentedControl
            label="Calendar view"
            options={views}
            value={view}
            onChange={(next) => setParams({ view: next })}
          />
        </div>

        <div className="calendar-legend">
          <span>
            <i className="legend-dot legend-dot--manual" /> Manual
          </span>
          <span>
            <i className="legend-dot legend-dot--imported" /> Imported source
          </span>
          <span>
            <i className="legend-dot legend-dot--study" /> <Sparkles aria-hidden="true" /> Study block
          </span>
        </div>

        {view === 'week' ? (
          <div className="week-grid" role="region" aria-label="Weekly calendar" tabIndex={0}>
            {days.map((day) => {
              const date = toLocalDate(day)
              const dayEvents = eventsByDate.get(date) ?? []
              return (
                <section
                  key={date}
                  className={date === today ? 'week-day is-today' : 'week-day'}
                  data-calendar-date={date}
                  aria-label={formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}
                  onDragOver={(event) => {
                    if (event.dataTransfer.types.includes('application/x-myhub-study')) event.preventDefault()
                  }}
                  onDrop={(dropEvent) => {
                    dropEvent.preventDefault()
                    const id = dropEvent.dataTransfer.getData('application/x-myhub-study')
                    const block = data.events.find((event) => event.id === id && event.kind === 'study')
                    if (block) moveStudyBlock(block, date)
                  }}
                >
                  <header>
                    <span>{formatDate(date, { weekday: 'short' })}</span>
                    <strong>{day.getDate()}</strong>
                  </header>
                  <div className="week-day__events">
                    {dayEvents.map((event) => (
                      <EventBlock
                        key={calendarEventOccurrenceKey(event, date)}
                        event={event}
                        occurrenceDate={date}
                        onEdit={() => setEventModal(event)}
                        onResize={(minutes) => resizeStudyBlock(event, minutes)}
                        onPointerMove={(targetDate, minutes) => moveStudyBlockByPointer(event, targetDate, minutes)}
                        onPointerResize={(edge, minutes) => resizeStudyBlockByPointer(event, edge, minutes)}
                      />
                    ))}
                    {!dayEvents.length ? <span className="week-day__empty">Drop a study block here</span> : null}
                  </div>
                </section>
              )
            })}
          </div>
        ) : null}

        {view === 'day' ? (
          <div className="agenda-list">
            {displayEvents.map((event) => (
              <EventBlock
                key={event.id}
                event={event}
                occurrenceDate={toLocalDate(anchor)}
                onEdit={() => setEventModal(event)}
                onResize={(minutes) => resizeStudyBlock(event, minutes)}
                onPointerMove={(targetDate, minutes) => moveStudyBlockByPointer(event, targetDate, minutes)}
                onPointerResize={(edge, minutes) => resizeStudyBlockByPointer(event, edge, minutes)}
              />
            ))}
            {!displayEvents.length ? <p className="calendar-empty">No events yet. This day is open.</p> : null}
          </div>
        ) : null}

        {view === 'month' ? <MonthGrid anchor={anchor} events={visibleEvents} onSelect={setEventModal} /> : null}
      </Card>

      <Modal
        open={eventModal !== null}
        title={
          eventModal === 'add'
            ? 'Add calendar event'
            : eventModal?.kind === 'study'
              ? 'Edit study block'
              : 'Edit calendar event'
        }
        description={
          eventModal !== 'add' && eventModal?.kind === 'study'
            ? 'Manual changes are preserved when you regenerate your plan.'
            : 'Events block time when MyHub builds a study plan.'
        }
        onClose={() => setEventModal(null)}
      >
        {eventModal ? (
          <EventForm
            key={eventModal === 'add' ? 'add' : eventModal.id}
            event={eventModal === 'add' ? undefined : eventModal}
            existingEvents={data.events}
            anchor={anchor}
            onSubmit={saveEvent}
            onCancel={() => setEventModal(null)}
            onDelete={eventModal === 'add' ? undefined : () => deleteEvent(eventModal)}
          />
        ) : null}
      </Modal>

      <Modal
        open={importOpen}
        title="Import calendar files"
        description="Preview one or more local Canvas, Google, or standard .ics exports before anything is saved."
        onClose={() => {
          setImportOpen(false)
          setImportPreview(null)
          setImportError('')
        }}
      >
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault()
            void previewFiles(event.currentTarget)
          }}
        >
          <Field label="Source name" hint="Use a recognizable label such as Canvas or University Google Calendar.">
            <input name="sourceName" required autoComplete="off" defaultValue="Canvas" />
          </Field>
          <div className="form-grid__split">
            <Field label="Source type">
              <select name="sourceType" defaultValue="canvas">
                <option value="canvas">Canvas</option>
                <option value="google">Google Calendar</option>
                <option value="ics">Other ICS</option>
              </select>
            </Field>
            <Field label="Date window">
              <select name="dateWindow" defaultValue="term">
                <option value="term">Current term</option>
                <option value="year">Current year</option>
                <option value="all">All dated items (recurrences use a safe window)</option>
              </select>
            </Field>
          </div>
          <Field
            label="Calendar files"
            hint="Select both exports together only if they share the source type; otherwise preview each source separately."
          >
            <input name="files" type="file" accept=".ics,text/calendar" multiple required />
          </Field>
          {importError ? (
            <p className="inline-alert" role="alert">
              {importError}
            </p>
          ) : null}
          {importPreview ? <ImportPreviewPanel preview={importPreview} /> : null}
          <div className="modal__actions">
            <button className="button button--quiet" type="button" onClick={() => setImportOpen(false)}>
              Cancel
            </button>
            <button className="button button--secondary" type="submit">
              Preview files
            </button>
            {importPreview ? (
              <button className="button button--primary" type="button" onClick={confirmFileImport}>
                Confirm import
              </button>
            ) : null}
          </div>
        </form>
      </Modal>
    </>
  )
}

function EventForm({
  event,
  existingEvents,
  anchor,
  onSubmit,
  onCancel,
  onDelete,
}: {
  event?: CalendarEvent
  existingEvents: CalendarEvent[]
  anchor: Date
  onSubmit: (form: HTMLFormElement) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [date, setDate] = useState(event?.date ?? toLocalDate(anchor))
  const [startTime, setStartTime] = useState(event?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(event?.endTime ?? '10:00')
  const [allDay, setAllDay] = useState(event?.allDay ?? false)
  const validation = validateStudyBlock(
    { id: event?.id ?? '', date, startTime: allDay ? '00:00' : startTime, endTime: allDay ? '23:59' : endTime },
    existingEvents,
  )
  return (
    <form
      className="form-grid"
      onSubmit={(formEvent) => {
        formEvent.preventDefault()
        onSubmit(formEvent.currentTarget)
      }}
    >
      {event?.kind === 'study' ? (
        <div className="inline-context">
          <Sparkles aria-hidden="true" />
          <span>
            <strong>{event.title}</strong>
            <small>{event.course}</small>
          </span>
        </div>
      ) : (
        <Field label="Title">
          <input name="title" required autoComplete="off" defaultValue={event?.title} placeholder="Capstone meeting…" />
        </Field>
      )}
      {event?.kind === 'study' ? <input type="hidden" name="title" value={event.title} /> : null}
      <Field label="Course or context">
        <input name="course" autoComplete="off" defaultValue={event?.course} placeholder="CE EN 482…" />
      </Field>
      <Field label="Date">
        <input
          name="date"
          type="date"
          required
          value={date}
          onChange={(changeEvent) => setDate(changeEvent.target.value)}
        />
      </Field>
      <label className="check-control">
        <input
          name="allDay"
          type="checkbox"
          checked={allDay}
          onChange={(changeEvent) => setAllDay(changeEvent.target.checked)}
          disabled={event?.kind === 'study'}
        />
        <span>All-day event</span>
      </label>
      <div className="form-grid__split">
        <Field label="Starts">
          <input
            name="startTime"
            type="time"
            required={!allDay}
            value={startTime}
            disabled={allDay}
            onChange={(changeEvent) => setStartTime(changeEvent.target.value)}
          />
        </Field>
        <Field label="Ends">
          <input
            name="endTime"
            type="time"
            required={!allDay}
            value={endTime}
            disabled={allDay}
            onChange={(changeEvent) => setEndTime(changeEvent.target.value)}
          />
        </Field>
      </div>
      {validation.warning ? (
        <p className={validation.valid ? 'conflict-warning' : 'inline-alert'} role="status">
          {validation.warning}
        </p>
      ) : null}
      {event?.kind !== 'study' ? (
        <>
          <Field label="Description">
            <textarea name="description" rows={3} defaultValue={event?.description} />
          </Field>
          <div className="form-grid__split">
            <Field label="Location">
              <input name="location" defaultValue={event?.location} />
            </Field>
            <Field label="Source label">
              <input name="sourceLabel" defaultValue={event?.sourceLabel ?? 'Manual event'} />
            </Field>
          </div>
          <Field label="Source URL">
            <input
              name="sourceUrl"
              type="url"
              inputMode="url"
              defaultValue={event?.sourceUrl}
              placeholder="https://…"
            />
          </Field>
        </>
      ) : (
        <>
          <input type="hidden" name="description" value={event.description ?? ''} />
          <input type="hidden" name="location" value={event.location ?? ''} />
          <input type="hidden" name="sourceLabel" value={event.sourceLabel ?? ''} />
          <input type="hidden" name="sourceUrl" value={event.sourceUrl ?? ''} />
          <label className="check-control">
            <input name="locked" type="checkbox" defaultChecked={event.locked} />
            <span>
              <Lock aria-hidden="true" /> Lock this time
            </span>
          </label>
        </>
      )}
      <div className="modal__actions modal__actions--spread">
        {onDelete ? (
          <button className="button button--danger" type="button" onClick={onDelete}>
            <Trash2 aria-hidden="true" /> Delete
          </button>
        ) : (
          <span />
        )}
        <div>
          <button className="button button--quiet" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="button button--primary" type="submit" disabled={!validation.valid}>
            Save {event ? 'changes' : 'event'}
          </button>
        </div>
      </div>
    </form>
  )
}

function ImportPreviewPanel({ preview }: { preview: ImportPreview }) {
  const events = preview.feeds.reduce((sum, item) => sum + item.events.length, 0)
  const assignments = preview.feeds.reduce((sum, item) => sum + item.assignments.length, 0)
  return (
    <section className="import-preview" aria-labelledby="import-preview-title">
      <h3 id="import-preview-title">Ready to import</h3>
      <p>
        {events} events and {assignments} Canvas-style homework assignments in {preview.rangeLabel}. Nothing is saved
        until you confirm.
      </p>
      <ul>
        {preview.feeds.map((item) => (
          <li key={item.feed.id}>
            <span>
              <strong>{item.feed.name}</strong>
              <small>{item.feed.kind}</small>
            </span>
            <span>
              {item.events.length}/{item.totalEvents} events · {item.assignments.length}/{item.totalAssignments}{' '}
              homework
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function EventBlock({
  event,
  occurrenceDate,
  onEdit,
  onResize,
  onPointerMove,
  onPointerResize,
}: {
  event: CalendarEvent
  occurrenceDate: string
  onEdit: () => void
  onResize: (minutes: number) => void
  onPointerMove: (date: string, minutes: number) => void
  onPointerResize: (edge: 'start' | 'end', minutes: number) => void
}) {
  const [pointerActive, setPointerActive] = useState(false)
  const sourceUrl = safeExternalUrl(event.sourceUrl)
  const sourceName =
    event.kind === 'study' ? 'Study' : event.sourceLabel || (event.source === 'imported' ? 'Imported' : 'Manual')
  const sourceClass = event.kind === 'study' ? 'study' : event.source === 'imported' ? 'imported' : 'manual'
  return (
    <article
      className={`event-block event-block--${sourceClass}${pointerActive ? ' is-pointer-active' : ''}`}
      data-study-block-id={event.kind === 'study' ? event.id : undefined}
      draggable={event.kind === 'study' && !pointerActive}
      onDragStart={(dragEvent) => {
        if (event.kind === 'study') {
          dragEvent.dataTransfer.setData('application/x-myhub-study', event.id)
          dragEvent.dataTransfer.effectAllowed = 'move'
        }
      }}
    >
      {event.kind === 'study' ? (
        <PointerHandle
          className="event-block__pointer-handle event-block__pointer-handle--start"
          onActiveChange={setPointerActive}
          onCommit={(minuteDelta) => onPointerResize('start', minuteDelta)}
        />
      ) : null}
      <button
        type="button"
        className="event-block__main"
        onClick={onEdit}
        onPointerDown={(pointerEvent) => {
          if (event.kind !== 'study' || pointerEvent.button !== 0) return
          const target = pointerEvent.currentTarget
          const originX = pointerEvent.clientX
          const originY = pointerEvent.clientY
          let dragged = false
          target.setPointerCapture(pointerEvent.pointerId)
          setPointerActive(true)
          const move = (moveEvent: PointerEvent) => {
            if (Math.abs(moveEvent.clientX - originX) + Math.abs(moveEvent.clientY - originY) >= 5) dragged = true
          }
          const cancel = () => {
            target.removeEventListener('pointermove', move)
            target.removeEventListener('pointerup', finish)
            target.removeEventListener('pointercancel', cancel)
            setPointerActive(false)
          }
          const finish = (endEvent: PointerEvent) => {
            target.removeEventListener('pointermove', move)
            target.removeEventListener('pointerup', finish)
            target.removeEventListener('pointercancel', cancel)
            if (target.hasPointerCapture(endEvent.pointerId)) target.releasePointerCapture(endEvent.pointerId)
            setPointerActive(false)
            if (!dragged) return
            const day = document
              .elementFromPoint(endEvent.clientX, endEvent.clientY)
              ?.closest<HTMLElement>('[data-calendar-date]')
            const date = day?.dataset.calendarDate ?? occurrenceDate
            const minuteDelta = Math.round((endEvent.clientY - originY) / POINTER_PIXELS_PER_SNAP) * SNAP_MINUTES
            onPointerMove(date, minuteDelta)
          }
          target.addEventListener('pointermove', move)
          target.addEventListener('pointerup', finish)
          target.addEventListener('pointercancel', cancel)
        }}
        aria-label={`Edit ${event.kind === 'study' ? 'study block' : 'event'} ${event.title} at ${event.allDay ? 'all day' : formatTime(event.startTime)}`}
      >
        <span className="event-block__time">{event.allDay ? 'All day' : formatTime(event.startTime)}</span>
        <strong>{event.title}</strong>
        <small>{event.course || event.location || sourceName}</small>
        <StatusBadge tone={event.kind === 'study' ? 'study' : event.source === 'imported' ? 'lilac' : 'food'}>
          {sourceName}
        </StatusBadge>
      </button>
      {event.kind === 'study' ? (
        <>
          <div className="event-block__resize" aria-label={`Resize ${event.title}`}>
            <button type="button" aria-label={`Shorten ${event.title} by 15 minutes`} onClick={() => onResize(-15)}>
              <ClockArrowUp aria-hidden="true" /> −15
            </button>
            <button type="button" aria-label={`Extend ${event.title} by 15 minutes`} onClick={() => onResize(15)}>
              <ClockArrowDown aria-hidden="true" /> +15
            </button>
          </div>
          <PointerHandle
            className="event-block__pointer-handle event-block__pointer-handle--end"
            onActiveChange={setPointerActive}
            onCommit={(minuteDelta) => onPointerResize('end', minuteDelta)}
          />
        </>
      ) : sourceUrl ? (
        <a
          className="event-block__source"
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open source for ${event.title}`}
        >
          <ExternalLink aria-hidden="true" />
        </a>
      ) : null}
    </article>
  )
}

function PointerHandle({
  className,
  onActiveChange,
  onCommit,
}: {
  className: string
  onActiveChange: (active: boolean) => void
  onCommit: (minutes: number) => void
}) {
  return (
    <span
      className={className}
      aria-hidden="true"
      onPointerDown={(pointerEvent) => {
        if (pointerEvent.button !== 0) return
        pointerEvent.preventDefault()
        pointerEvent.stopPropagation()
        const target = pointerEvent.currentTarget
        const originY = pointerEvent.clientY
        target.setPointerCapture(pointerEvent.pointerId)
        onActiveChange(true)
        const cancel = () => {
          target.removeEventListener('pointerup', finish)
          target.removeEventListener('pointercancel', cancel)
          onActiveChange(false)
        }
        const finish = (endEvent: PointerEvent) => {
          target.removeEventListener('pointerup', finish)
          target.removeEventListener('pointercancel', cancel)
          if (target.hasPointerCapture(endEvent.pointerId)) target.releasePointerCapture(endEvent.pointerId)
          onActiveChange(false)
          const minuteDelta = Math.round((endEvent.clientY - originY) / POINTER_PIXELS_PER_SNAP) * SNAP_MINUTES
          if (minuteDelta) onCommit(minuteDelta)
        }
        target.addEventListener('pointerup', finish)
        target.addEventListener('pointercancel', cancel)
      }}
    />
  )
}

function MonthGrid({
  anchor,
  events,
  onSelect,
}: {
  anchor: Date
  events: CalendarEvent[]
  onSelect: (event: CalendarEvent) => void
}) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const gridStart = startOfWeek(first)
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  return (
    <div className="month-grid">
      {days.map((day) => {
        const date = toLocalDate(day)
        const daily = events.filter((event) => eventCoversDate(event, date))
        return (
          <section key={date} className={day.getMonth() === anchor.getMonth() ? 'month-day' : 'month-day is-outside'}>
            <span>{day.getDate()}</span>
            {daily.slice(0, 3).map((event) => (
              <button
                type="button"
                onClick={() => onSelect(event)}
                key={calendarEventOccurrenceKey(event, date)}
                className={`month-event month-event--${event.kind === 'study' ? 'study' : event.source === 'imported' ? 'imported' : 'manual'}`}
              >
                {event.title}
              </button>
            ))}
            {daily.length > 3 ? <small>+{daily.length - 3} more</small> : null}
          </section>
        )
      })}
    </div>
  )
}
