import { CalendarPlus, ChevronLeft, ChevronRight, Lock, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { Card, Field, Modal, PageHeader, SegmentedControl, StatusBadge } from '../../components/ui'
import type { CalendarEvent } from '../../domain/types'
import { addDays, formatDate, formatTime, makeId, startOfWeek, toLocalDate } from '../../utilities/date'

const views = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

export default function CalendarPage() {
  const { data, updateData } = useApp()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') ?? 'week'
  const [anchor, setAnchor] = useState(() => new Date())
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const weekStart = startOfWeek(anchor)
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  const today = toLocalDate(new Date())

  const eventsByDate = new Map(days.map((day) => {
    const date = toLocalDate(day)
    return [date, data.events.filter((event) => event.date === date).toSorted((a, b) => a.startTime.localeCompare(b.startTime))]
  }))

  const navigate = (direction: number) => {
    const next = new Date(anchor)
    if (view === 'day') next.setDate(next.getDate() + direction)
    else if (view === 'month') next.setMonth(next.getMonth() + direction)
    else next.setDate(next.getDate() + direction * 7)
    setAnchor(next)
  }

  const addEvent = (form: HTMLFormElement) => {
    const values = new FormData(form)
    const timestamp = new Date().toISOString()
    const event: CalendarEvent = {
      id: makeId('event'), createdAt: timestamp, updatedAt: timestamp, source: 'manual', kind: 'event',
      title: String(values.get('title')), date: String(values.get('date')), startTime: String(values.get('startTime')),
      endTime: String(values.get('endTime')), course: String(values.get('course') || ''), sourceLabel: 'Manual event',
    }
    updateData((previous) => ({ ...previous, events: [...previous.events, event] }), 'Event added to your calendar.')
    setAddOpen(false)
  }

  const saveStudyBlock = (form: HTMLFormElement) => {
    if (!editing) return
    const values = new FormData(form)
    updateData((previous) => ({
      ...previous,
      events: previous.events.map((event) => event.id === editing.id ? {
        ...event,
        date: String(values.get('date')),
        startTime: String(values.get('startTime')),
        endTime: String(values.get('endTime')),
        locked: values.get('locked') === 'on',
        userAdjusted: true,
        updatedAt: new Date().toISOString(),
      } : event),
    }), 'Study block updated. Future plans will respect your change.')
    setEditing(null)
  }

  const displayEvents = view === 'day'
    ? data.events.filter((event) => event.date === toLocalDate(anchor)).toSorted((a, b) => a.startTime.localeCompare(b.startTime))
    : data.events

  return (
    <>
      <PageHeader title="Calendar" description="Classes, commitments, and study time share one trustworthy schedule." action={<button className="button button--primary" type="button" onClick={() => setAddOpen(true)}><CalendarPlus aria-hidden="true" /> Add event</button>} />
      <Card className="calendar-shell">
        <div className="calendar-toolbar">
          <div className="calendar-toolbar__nav">
            <button className="icon-button" type="button" aria-label="Previous period" onClick={() => navigate(-1)}><ChevronLeft aria-hidden="true" /></button>
            <button className="button button--quiet" type="button" onClick={() => setAnchor(new Date())}>Today</button>
            <button className="icon-button" type="button" aria-label="Next period" onClick={() => navigate(1)}><ChevronRight aria-hidden="true" /></button>
            <h2>{view === 'month' ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(anchor) : `${formatDate(toLocalDate(view === 'day' ? anchor : weekStart), { month: 'long', day: 'numeric' })}${view === 'week' ? ` – ${formatDate(toLocalDate(days[6] ?? weekStart), { month: 'short', day: 'numeric' })}` : ''}`}</h2>
          </div>
          <SegmentedControl label="Calendar view" options={views} value={view} onChange={(next) => setParams({ view: next })} />
        </div>

        <div className="calendar-legend"><span><i className="legend-dot legend-dot--event" /> Calendar event</span><span><i className="legend-dot legend-dot--study" /> <Sparkles aria-hidden="true" /> Study block</span></div>

        {view === 'week' ? (
          <div className="week-grid">
            {days.map((day) => {
              const date = toLocalDate(day)
              const dayEvents = eventsByDate.get(date) ?? []
              return (
                <section key={date} className={date === today ? 'week-day is-today' : 'week-day'} aria-label={formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}>
                  <header><span>{formatDate(date, { weekday: 'short' })}</span><strong>{day.getDate()}</strong></header>
                  <div className="week-day__events">
                    {dayEvents.map((event) => <EventBlock key={event.id} event={event} onEdit={() => event.kind === 'study' && setEditing(event)} />)}
                    {!dayEvents.length ? <span className="week-day__empty">Open</span> : null}
                  </div>
                </section>
              )
            })}
          </div>
        ) : null}

        {view === 'day' ? (
          <div className="agenda-list">
            {displayEvents.map((event) => <EventBlock key={event.id} event={event} onEdit={() => event.kind === 'study' && setEditing(event)} />)}
            {!displayEvents.length ? <p className="calendar-empty">No events yet. This day is open.</p> : null}
          </div>
        ) : null}

        {view === 'month' ? <MonthGrid anchor={anchor} events={data.events} onSelect={(event) => event.kind === 'study' && setEditing(event)} /> : null}
      </Card>

      <Modal open={addOpen} title="Add calendar event" description="Events block time when MyHub builds a study plan." onClose={() => setAddOpen(false)}>
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); addEvent(event.currentTarget) }}>
          <Field label="Title"><input name="title" required autoComplete="off" placeholder="Capstone meeting…" /></Field>
          <Field label="Course or context"><input name="course" autoComplete="off" placeholder="CE EN 482…" /></Field>
          <Field label="Date"><input name="date" type="date" required defaultValue={toLocalDate(anchor)} /></Field>
          <div className="form-grid__split"><Field label="Starts"><input name="startTime" type="time" required defaultValue="09:00" /></Field><Field label="Ends"><input name="endTime" type="time" required defaultValue="10:00" /></Field></div>
          <div className="modal__actions"><button className="button button--quiet" type="button" onClick={() => setAddOpen(false)}>Cancel</button><button className="button button--primary" type="submit">Add event</button></div>
        </form>
      </Modal>

      <Modal open={Boolean(editing)} title="Move study block" description="Manual changes are preserved when you regenerate your plan." onClose={() => setEditing(null)}>
        {editing ? <form className="form-grid" onSubmit={(event) => { event.preventDefault(); saveStudyBlock(event.currentTarget) }}>
          <div className="inline-context"><Sparkles aria-hidden="true" /><span><strong>{editing.title}</strong><small>{editing.course}</small></span></div>
          <Field label="Date"><input name="date" type="date" required defaultValue={editing.date} /></Field>
          <div className="form-grid__split"><Field label="Starts"><input name="startTime" type="time" required defaultValue={editing.startTime} /></Field><Field label="Ends"><input name="endTime" type="time" required defaultValue={editing.endTime} /></Field></div>
          <label className="check-control"><input name="locked" type="checkbox" defaultChecked={editing.locked} /><span><Lock aria-hidden="true" /> Lock this time</span></label>
          <div className="modal__actions"><button className="button button--quiet" type="button" onClick={() => setEditing(null)}>Cancel</button><button className="button button--primary" type="submit">Save block</button></div>
        </form> : null}
      </Modal>
    </>
  )
}

function EventBlock({ event, onEdit }: { event: CalendarEvent; onEdit: () => void }) {
  const content = <><span className="event-block__time">{formatTime(event.startTime)}</span><strong>{event.title}</strong><small>{event.course ?? event.sourceLabel}</small>{event.kind === 'study' ? <StatusBadge tone="study">Study</StatusBadge> : null}</>
  return event.kind === 'study' ? <button type="button" className="event-block event-block--study" onClick={onEdit} aria-label={`Edit study block ${event.title} at ${formatTime(event.startTime)}`}>{content}</button> : <article className="event-block event-block--event">{content}</article>
}

function MonthGrid({ anchor, events, onSelect }: { anchor: Date; events: CalendarEvent[]; onSelect: (event: CalendarEvent) => void }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const gridStart = startOfWeek(first)
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  return <div className="month-grid">{days.map((day) => {
    const date = toLocalDate(day)
    const daily = events.filter((event) => event.date === date)
    return <section key={date} className={day.getMonth() === anchor.getMonth() ? 'month-day' : 'month-day is-outside'}><span>{day.getDate()}</span>{daily.slice(0, 3).map((event) => event.kind === 'study' ? <button type="button" onClick={() => onSelect(event)} key={event.id} className="month-event month-event--study">{event.title}</button> : <div key={event.id} className="month-event">{event.title}</div>)}{daily.length > 3 ? <small>+{daily.length - 3} more</small> : null}</section>
  })}</div>
}
