import { useEffect, useMemo, useState } from 'react'
import { Card, Field } from '../../components/ui'
import { visibleCalendarEvents } from '../../domain/calendar'
import type { AppData } from '../../domain/types'
import { estimateOutdoorWindows, outdoorWeather, type OutdoorWindow } from './scheduleWeather'
import { fetchForecast, type Forecast } from './forecast'

export interface WeatherSelection {
  temperature: number | null
  context: string
  signature: string
}
const clock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
const minute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))

export function CalendarWeather({
  data,
  date,
  onChange,
}: {
  data: AppData
  date: string
  onChange: (value: WeatherSelection) => void
}) {
  const [mode, setMode] = useState<'calendar' | 'daily' | 'manual'>('calendar')
  const [manual, setManual] = useState<number | null>(null)
  const [duration, setDuration] = useState(15)
  const [excludedIds, setExcludedIds] = useState<string[]>([])
  const [custom, setCustom] = useState<OutdoorWindow[]>([])
  const [start, setStart] = useState('12:00'),
    [end, setEnd] = useState('12:15')
  const [coords, setCoords] = useState({ latitude: 39.7555, longitude: -105.2211, label: 'Golden, Colorado' })
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [forecast, setForecast] = useState<{ key: string; value: Forecast } | null>(null)
  const timezone = data.settings.calendarTimeZone || 'America/Denver'
  const key = JSON.stringify([date, coords.latitude, coords.longitude, timezone, revision])
  const events = useMemo(
    () =>
      visibleCalendarEvents(data).filter(
        (e) => e.date <= date && (e.endDate ?? e.date) >= date && e.kind === 'event' && !e.allDay && !e.assignmentId,
      ),
    [data, date],
  )
  const windows = useMemo(
    () => estimateOutdoorWindows(events, date, { minutes: duration, excludedIds, custom }),
    [events, date, duration, excludedIds, custom],
  )
  useEffect(() => {
    if (mode === 'manual') return
    const controller = new AbortController()
    setError('')
    void fetchForecast(date, coords.latitude, coords.longitude, timezone, controller.signal, revision > 0)
      .then((value) => {
        if (!controller.signal.aborted) setForecast({ key, value })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setForecast({ key, value: { hourly: [], dailyLowF: null } })
          setError('Forecast unavailable. Enter a feels-like low manually or refresh to retry.')
        }
      })
    return () => controller.abort()
  }, [date, coords.latitude, coords.longitude, timezone, key, revision, mode])
  const current = forecast?.key === key ? forecast.value : null
  const result = outdoorWeather(
    date,
    mode === 'calendar' ? windows : [],
    current?.hourly ?? [],
    current?.dailyLowF ?? null,
  )
  const temperature = mode === 'manual' ? manual : result.lowF
  const context =
    mode === 'calendar' && result.source === 'schedule'
      ? `Outdoor feels-like ${result.lowF} to ${result.highF} F; rain ${result.rainPercent ?? 'unknown'}%; wind ${result.windMph ?? 'unknown'} mph. Estimated walks include gaps under 30 minutes. Garment weather protection is unknown.`
      : ''
  const signature = JSON.stringify([key, mode, duration, excludedIds, custom, windows, temperature, context])
  useEffect(() => {
    onChange({ temperature, context, signature })
  }, [temperature, context, signature, onChange])
  return (
    <Card>
      <h2>Weather for {date}</h2>
      <p className="closet-temperature">{temperature === null ? '—' : `${Math.round(temperature * 10) / 10}°F`}</p>
      <p>
        {coords.label} · Calendar time zone: {timezone}
      </p>
      <Field label="Weather planning mode">
        <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
          <option value="calendar">My outdoor times</option>
          <option value="daily">Daily low</option>
          <option value="manual">Manual temperature</option>
        </select>
      </Field>
      {mode !== 'manual' && (
        <p role="status">
          {error ||
            (!current
              ? 'Loading feels-like forecast…'
              : mode === 'calendar'
                ? result.reason
                : result.lowF === null
                  ? 'No forecast for this date. Enter a temperature manually.'
                  : 'Using the daily feels-like low.')}
        </p>
      )}
      {mode === 'calendar' && (
        <>
          {result.source === 'schedule' && (
            <p>
              Outside: {result.lowF}–{result.highF}°F feels-like. Rain chance:{' '}
              {result.rainPercent === null ? 'unknown' : `${result.rainPercent}%`}. Wind:{' '}
              {result.windMph === null ? 'unknown' : `${result.windMph} mph`}. Consider a removable jacket for changing
              conditions.
            </p>
          )}
          <details>
            <summary>Review outdoor times ({windows.length})</summary>
            <p>
              Gaps under 30 minutes between events count as walks, including on the Mines campus. Other arrivals and
              departures use the estimate below. Online and all-day events are skipped. Adjustments apply to this date
              until you leave the planner.
            </p>
            <Field label="Arrival/departure estimate (minutes)">
              <input
                type="number"
                min={0}
                max={120}
                value={duration}
                onChange={(e) => setDuration(Math.max(0, Math.min(120, Math.round(Number(e.target.value) || 0))))}
              />
            </Field>
            <p className="muted">Use 0 to disable automatic walks. Add any outdoor time manually below.</p>
            {events.map((event) => (
              <label key={event.id} className="calendar-weather-event">
                <input
                  type="checkbox"
                  checked={!excludedIds.includes(event.id)}
                  onChange={(e) =>
                    setExcludedIds((ids) =>
                      e.target.checked ? ids.filter((id) => id !== event.id) : [...ids, event.id],
                    )
                  }
                />{' '}
                {event.startTime}–{event.endTime} {event.title}
                {event.location ? ` · ${event.location}` : ''}
              </label>
            ))}
            {!events.length && <p>No timed calendar events for this date.</p>}
            <div className="form-grid">
              <Field label="Outdoor start">
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label="Outdoor end">
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>
            <button
              className="button button--secondary"
              disabled={!start || !end || minute(end) <= minute(start) || custom.length >= 24}
              onClick={() => setCustom((w) => [...w, { start: minute(start), end: minute(end) }])}
            >
              Add outdoor time
            </button>
            {custom.map((w, i) => (
              <p key={i}>
                {clock(w.start)}–{clock(w.end)}{' '}
                <button
                  className="button button--quiet"
                  onClick={() => setCustom((ws) => ws.filter((_, index) => i !== index))}
                >
                  Remove outdoor time {i + 1}
                </button>
              </p>
            ))}
            <p>
              Estimated outdoor times:{' '}
              {windows.length ? windows.map((w) => `${clock(w.start)}–${clock(w.end)}`).join(', ') : 'none'}
            </p>
          </details>
        </>
      )}
      <Field label="Feels-like low °F" hint="Enter a value to switch to manual temperature.">
        <input
          type="number"
          min={-150}
          max={150}
          step="0.1"
          value={temperature ?? ''}
          onChange={(e) => {
            setMode('manual')
            const n = e.target.value === '' ? null : Number(e.target.value)
            setManual(n !== null && Number.isFinite(n) && n >= -150 && n <= 150 ? n : null)
          }}
        />
      </Field>
      <div className="closet-toolbar">
        <button
          className="button button--quiet"
          onClick={() => {
            setMode('calendar')
            setRevision((n) => n + 1)
          }}
        >
          Refresh forecast
        </button>
        <button
          className="button button--secondary"
          onClick={() => {
            if (!navigator.geolocation) {
              setError('Location is unavailable on this device.')
              return
            }
            navigator.geolocation.getCurrentPosition(
              (p) => {
                setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude, label: 'Your device location' })
                setMode('calendar')
              },
              () => setError('Device location unavailable. Keeping the selected location.'),
              { timeout: 10000 },
            )
          }}
        >
          Use device location
        </button>
        <button
          className="button button--quiet"
          onClick={() => {
            setCoords({ latitude: 39.7555, longitude: -105.2211, label: 'Golden, Colorado' })
            setMode('calendar')
          }}
        >
          Use Golden
        </button>
      </div>
      <p className="muted">
        Weather by Open-Meteo. Calendar details stay in MyHub; Smart Suggest receives only a weather summary.
      </p>
    </Card>
  )
}
