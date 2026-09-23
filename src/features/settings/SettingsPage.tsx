import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Cloud,
  CloudOff,
  Copy,
  Database,
  Download,
  KeyRound,
  Link2Off,
  LockKeyhole,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { Card, Field, Modal, PageHeader, StatusBadge } from '../../components/ui'
import { parseIcsResult, replaceImportedFeedAssignments, replaceImportedFeedEvents } from '../../domain/ics'
import { NUTRITION_FIELDS } from '../../domain/nutrition'
import type {
  AvoidTimeRange,
  CalendarFeed,
  GroceryCategory,
  GroceryStaple,
  MealPlanningMode,
  MealSlot,
  Nutrition,
  StudySettings,
  UserSettings,
} from '../../domain/types'
import '../../styles/crosscut-v2.css'
import { createBackup, parseBackup } from '../../storage/database'
import { useGitHubSync, type GitHubSyncStatus } from '../../sync/GitHubSyncContext'
import { makeId } from '../../utilities/date'

const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack / coffee / treat',
}

const SETTINGS_SECTIONS = [
  ['general', 'General'],
  ['study', 'Study planner'],
  ['meals', 'Meal planning'],
  ['grocery-settings', 'Grocery'],
  ['calendars', 'Calendars'],
  ['nutrition', 'Nutrition'],
  ['github-sync', 'GitHub Sync'],
  ['data', 'Data & privacy'],
] as const

const CALENDAR_TIME_ZONES = [
  ['America/Denver', 'Mountain Time — Denver'],
  ['America/Los_Angeles', 'Pacific Time — Los Angeles'],
  ['America/Phoenix', 'Mountain Standard Time — Phoenix'],
  ['America/Chicago', 'Central Time — Chicago'],
  ['America/New_York', 'Eastern Time — New York'],
  ['America/Anchorage', 'Alaska Time — Anchorage'],
  ['Pacific/Honolulu', 'Hawaii Time — Honolulu'],
  ['UTC', 'Coordinated Universal Time'],
] as const

const MODE_OPTIONS: Array<{ value: MealPlanningMode; label: string; detail: string }> = [
  { value: 'balanced', label: 'Balanced', detail: 'Balance effort, nutrition, and variety.' },
  { value: 'variety', label: 'More variety', detail: 'Repeat fewer meals through the week.' },
  { value: 'meal-prep', label: 'Meal prep', detail: 'Favor recipes that make several servings.' },
  { value: 'favor-leftovers', label: 'Favor leftovers', detail: 'Use prepared food before cooking again.' },
  { value: 'minimize-waste', label: 'Minimize waste', detail: 'Prefer ingredients already available.' },
  {
    value: 'minimize-unique-ingredients',
    label: 'Fewer unique ingredients',
    detail: 'Reuse ingredients across planned meals.',
  },
]

const feedStatusTone = (status: CalendarFeed['status']): 'neutral' | 'danger' | 'success' => {
  if (status === 'connected') return 'success'
  if (status === 'error') return 'danger'
  return 'neutral'
}

const syncTone = (status: GitHubSyncStatus): 'neutral' | 'danger' | 'attention' | 'success' => {
  if (status === 'current') return 'success'
  if (status === 'conflict' || status === 'locked') return 'attention'
  if (status === 'error' || status === 'offline') return 'danger'
  return 'neutral'
}

export default function SettingsPage() {
  const { data, updateData, replaceData, clearAllData, announce } = useApp()
  const github = useGitHubSync()
  const [searchParams] = useSearchParams()
  const selectedSection = searchParams.get('section')
  const importInput = useRef<HTMLInputElement>(null)
  const icsInput = useRef<HTMLInputElement>(null)
  const [icsTargetId, setIcsTargetId] = useState<string | null>(null)
  const [refreshingFeedId, setRefreshingFeedId] = useState<string | null>(null)
  const [newStaple, setNewStaple] = useState({
    name: '',
    quantity: 1,
    unit: 'each',
    category: 'Other' as GroceryCategory,
  })
  const [owner, setOwner] = useState(github.target.owner)
  const [repo, setRepo] = useState(github.target.repo)
  const [path, setPath] = useState(github.target.path)
  const [token, setToken] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [syncBusy, setSyncBusy] = useState(false)
  const [privateLinkOpen, setPrivateLinkOpen] = useState(false)
  const [privateLinkError, setPrivateLinkError] = useState('')
  const [privateAccessUrl, setPrivateAccessUrl] = useState('')

  useEffect(() => {
    const preferred =
      data.settings.appearance === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : data.settings.appearance
    document.documentElement.dataset.theme = preferred
    document.documentElement.style.colorScheme = preferred
  }, [data.settings.appearance])

  useEffect(() => {
    setOwner(github.target.owner)
    setRepo(github.target.repo)
    setPath(github.target.path)
  }, [github.target.owner, github.target.path, github.target.repo])

  const updateSettings = (change: Partial<UserSettings>, message = 'Settings saved.') =>
    updateData((previous) => ({ ...previous, settings: { ...previous.settings, ...change } }), message)
  const updateStudy = (change: Partial<StudySettings>) =>
    updateSettings({ study: { ...data.settings.study, ...change } })
  const updateNutrition = (change: Partial<Nutrition>) =>
    updateSettings({ nutritionTargets: { ...data.settings.nutritionTargets, ...change } })

  const addAvoidTime = () => {
    const range: AvoidTimeRange = {
      id: makeId('avoid-time'),
      label: 'Unavailable',
      days: [1, 2, 3, 4, 5],
      startTime: '12:00',
      endTime: '13:00',
    }
    updateStudy({ avoidTimes: [...data.settings.study.avoidTimes, range] })
  }

  const updateAvoidTime = (id: string, change: Partial<AvoidTimeRange>) =>
    updateStudy({
      avoidTimes: data.settings.study.avoidTimes.map((range) => (range.id === id ? { ...range, ...change } : range)),
    })

  const removeAvoidTime = (id: string) =>
    updateStudy({ avoidTimes: data.settings.study.avoidTimes.filter((range) => range.id !== id) })

  const updateStaple = (id: string, change: Partial<GroceryStaple>) =>
    updateSettings({
      groceryStaples: data.settings.groceryStaples.map((staple) =>
        staple.id === id ? { ...staple, ...change } : staple,
      ),
    })

  const addStaple = () => {
    const name = newStaple.name.trim()
    if (!name) {
      announce('Enter a staple name first.')
      return
    }
    const staple: GroceryStaple = {
      id: makeId('staple'),
      name,
      canonicalName: name.toLowerCase(),
      quantity: newStaple.quantity,
      unit: newStaple.unit.trim() || 'each',
      category: newStaple.category,
      enabled: true,
    }
    updateSettings({ groceryStaples: [...data.settings.groceryStaples, staple] }, `${name} added to staples.`)
    setNewStaple({ name: '', quantity: 1, unit: 'each', category: 'Other' })
  }

  const moveCategory = (id: string, direction: -1 | 1) => {
    const ordered = data.settings.groceryCategories.toSorted((a, b) => a.sortOrder - b.sortOrder)
    const index = ordered.findIndex((category) => category.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ordered.length) return
    const next = [...ordered]
    const current = next[index]
    const swap = next[target]
    if (!current || !swap) return
    next[index] = swap
    next[target] = current
    updateSettings({ groceryCategories: next.map((category, sortOrder) => ({ ...category, sortOrder })) })
  }

  const addCalendarFeed = () => {
    const feed: CalendarFeed = {
      id: makeId('calendar-feed'),
      name: 'New calendar',
      kind: 'ics',
      url: '',
      enabled: true,
      status: 'not-configured',
    }
    updateSettings({ calendarFeeds: [...data.settings.calendarFeeds, feed] })
  }

  const updateCalendarFeed = (id: string, change: Partial<CalendarFeed>) =>
    updateSettings({
      calendarFeeds: data.settings.calendarFeeds.map((feed) => (feed.id === id ? { ...feed, ...change } : feed)),
    })

  const removeCalendarFeed = (id: string) =>
    updateSettings({ calendarFeeds: data.settings.calendarFeeds.filter((feed) => feed.id !== id) })

  const importIcs = async (file?: File) => {
    if (!file) return
    const feed = data.settings.calendarFeeds.find((item) => item.id === icsTargetId)
    if (!feed) {
      announce('Choose a saved calendar feed before importing a file.')
      return
    }
    try {
      const importedAt = new Date().toISOString()
      const sourceLabel = feed.name.trim() || file.name
      const parsed = parseIcsResult(await file.text(), {
        sourceLabel,
        sourceFeedId: feed.id,
        sourceType: feed.kind,
        importedAt,
        timeZone: data.settings.calendarTimeZone,
      })
      updateData(
        (previous) => ({
          ...previous,
          events: replaceImportedFeedEvents(previous.events, feed.id, parsed.events),
          assignments: replaceImportedFeedAssignments(previous.assignments, feed.id, parsed.assignments),
          settings: {
            ...previous.settings,
            calendarFeeds: previous.settings.calendarFeeds.map((item) =>
              item.id === feed.id
                ? {
                    ...item,
                    importMode: 'file',
                    status: 'connected',
                    lastRefresh: importedAt,
                    lastImportCount: parsed.events.length,
                    lastAssignmentCount: parsed.assignments.length,
                  }
                : item,
            ),
          },
        }),
        `Imported ${parsed.events.length} calendar events and ${parsed.assignments.length} homework assignments from ${file.name}.`,
      )
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The calendar file could not be imported.')
    } finally {
      if (icsInput.current) icsInput.current.value = ''
      setIcsTargetId(null)
    }
  }

  const refreshFeed = async (feed: CalendarFeed) => {
    const url = feed.url.trim()
    if (!url) {
      announce('Add a calendar feed URL first, or import an ICS file.')
      return
    }
    setRefreshingFeedId(feed.id)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Calendar feed returned ${response.status}.`)
      const importedAt = new Date().toISOString()
      const sourceLabel = feed.name.trim() || 'Calendar feed'
      const parsed = parseIcsResult(await response.text(), {
        sourceLabel,
        sourceFeedId: feed.id,
        sourceType: feed.kind,
        sourceUrl: url,
        importedAt,
        timeZone: data.settings.calendarTimeZone,
      })
      updateData(
        (previous) => ({
          ...previous,
          events: replaceImportedFeedEvents(previous.events, feed.id, parsed.events),
          assignments: replaceImportedFeedAssignments(previous.assignments, feed.id, parsed.assignments),
          settings: {
            ...previous.settings,
            calendarFeeds: previous.settings.calendarFeeds.map((item) =>
              item.id === feed.id
                ? {
                    ...item,
                    importMode: 'url',
                    status: 'connected',
                    lastRefresh: importedAt,
                    lastImportCount: parsed.events.length,
                    lastAssignmentCount: parsed.assignments.length,
                  }
                : item,
            ),
          },
        }),
        `${sourceLabel} refreshed with ${parsed.events.length} events and ${parsed.assignments.length} homework assignments.`,
      )
    } catch {
      updateCalendarFeed(feed.id, { status: 'error' })
      announce('The browser could not refresh that feed. Download the ICS file and import it here instead.')
    } finally {
      setRefreshingFeedId(null)
    }
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(createBackup(data), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `myhub-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    announce('Plaintext MyHub backup downloaded.')
  }

  const importData = async (file?: File) => {
    if (!file) return
    try {
      const backup = parseBackup(await file.text())
      if (
        !window.confirm(
          `Replace current local data with the backup from ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(backup.exportedAt))}? Export first if you need a copy.`,
        )
      )
        return
      replaceData(backup.data)
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The backup could not be imported.')
    } finally {
      if (importInput.current) importInput.current.value = ''
    }
  }

  const connectOrUnlock = async () => {
    setSyncBusy(true)
    try {
      if (github.status === 'locked' || (github.status === 'error' && !token)) await github.unlock(passphrase)
      else await github.connect({ owner, repo, path, token, passphrase })
      setToken('')
      setPassphrase('')
    } catch {
      // The provider exposes a safe, token-free error message in the UI.
    } finally {
      setSyncBusy(false)
    }
  }

  const runSyncAction = async (action: () => Promise<void>) => {
    setSyncBusy(true)
    try {
      await action()
    } catch {
      // The provider exposes a safe error message.
    } finally {
      setSyncBusy(false)
    }
  }

  const closePrivateLink = () => {
    setPrivateLinkOpen(false)
    setPrivateAccessUrl('')
    setPrivateLinkError('')
  }

  const createPrivateLink = async () => {
    setPrivateLinkOpen(true)
    setPrivateAccessUrl('')
    setPrivateLinkError('')
    setSyncBusy(true)
    try {
      const link = await github.createPrivateAccessLink(window.location.href)
      setPrivateAccessUrl(link.url)
    } catch (error) {
      setPrivateLinkError(error instanceof Error ? error.message : 'A private access link could not be created.')
    } finally {
      setSyncBusy(false)
    }
  }

  const copyPrivateLink = async () => {
    try {
      await navigator.clipboard.writeText(privateAccessUrl)
      announce('Private MyHub access link copied.')
    } catch {
      announce('Clipboard access was blocked. Select and copy the private link from the dialog.')
    }
  }

  const isConfigured = github.configured
  const needsUnlock = isConfigured && (github.status === 'locked' || github.status === 'error')
  const orderedCategories = data.settings.groceryCategories.toSorted((a, b) => a.sortOrder - b.sortOrder)

  useEffect(() => {
    if (!selectedSection || !SETTINGS_SECTIONS.some(([sectionId]) => sectionId === selectedSection)) return
    const frame = requestAnimationFrame(() =>
      document.getElementById(selectedSection)?.scrollIntoView({ block: 'start' }),
    )
    return () => cancelAnimationFrame(frame)
  }, [selectedSection])

  return (
    <>
      <PageHeader
        title="Settings"
        description="Tune planning rules, connected calendars, encrypted sync, and data controls."
      />
      <div className="settings-layout settings-layout--v2">
        <nav className="settings-nav" aria-label="Settings sections">
          {SETTINGS_SECTIONS.map(([sectionId, label]) => (
            <Link key={sectionId} to={`/settings?section=${sectionId}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="settings-content">
          <Card className="settings-card" as="section">
            <div className="settings-card__header" id="general">
              <h2>General</h2>
              <p>Choose display and measurement preferences.</p>
            </div>
            <div className="settings-fields">
              <Field label="Your name">
                <input
                  name="name"
                  autoComplete="name"
                  placeholder="Optional…"
                  value={data.settings.name}
                  onChange={(event) => updateSettings({ name: event.target.value })}
                />
              </Field>
              <Field label="Appearance">
                <select
                  name="appearance"
                  value={data.settings.appearance}
                  onChange={(event) => updateSettings({ appearance: event.target.value as UserSettings['appearance'] })}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">Use device setting</option>
                </select>
              </Field>
              <Field label="Measurement system">
                <select
                  name="measurementSystem"
                  value={data.settings.measurementSystem}
                  onChange={(event) =>
                    updateSettings({ measurementSystem: event.target.value as UserSettings['measurementSystem'] })
                  }
                >
                  <option value="us">US customary</option>
                  <option value="metric">Metric</option>
                </select>
              </Field>
            </div>
          </Card>

          <Card className="settings-card" as="section">
            <div className="settings-card__header" id="study">
              <div>
                <h2>Study planner</h2>
                <p>Set the planning window, session length, breaks, and recurring times to avoid.</p>
              </div>
            </div>
            <div className="settings-fields">
              <div className="settings-fields settings-fields--grid settings-fields--nested">
                <Field label="Earliest study time">
                  <input
                    name="earliestTime"
                    type="time"
                    value={data.settings.study.earliestTime}
                    onChange={(event) => updateStudy({ earliestTime: event.target.value })}
                  />
                </Field>
                <Field label="Latest study time">
                  <input
                    name="latestTime"
                    type="time"
                    value={data.settings.study.latestTime}
                    onChange={(event) => updateStudy({ latestTime: event.target.value })}
                  />
                </Field>
                <Field label="Default block (minutes)">
                  <input
                    name="defaultBlockMinutes"
                    type="number"
                    min="15"
                    step="5"
                    value={data.settings.study.defaultBlockMinutes}
                    onChange={(event) => updateStudy({ defaultBlockMinutes: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Break (minutes)">
                  <input
                    name="breakMinutes"
                    type="number"
                    min="0"
                    step="5"
                    value={data.settings.study.breakMinutes}
                    onChange={(event) => updateStudy({ breakMinutes: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Maximum block (minutes)">
                  <input
                    name="maxBlockMinutes"
                    type="number"
                    min="15"
                    step="5"
                    value={data.settings.study.maxBlockMinutes}
                    onChange={(event) => updateStudy({ maxBlockMinutes: Number(event.target.value) })}
                  />
                </Field>
              </div>
              <div className="settings-subsection-heading">
                <div>
                  <h3>Times to avoid</h3>
                  <p>Keep recurring commitments outside generated study sessions.</p>
                </div>
                <button className="button button--secondary" type="button" onClick={addAvoidTime}>
                  <Plus aria-hidden="true" /> Add time range
                </button>
              </div>
              <div className="settings-record-list">
                {data.settings.study.avoidTimes.map((range) => (
                  <article className="settings-record" key={range.id}>
                    <div className="settings-record__grid settings-record__grid--avoid">
                      <Field label="Label">
                        <input
                          value={range.label}
                          onChange={(event) => updateAvoidTime(range.id, { label: event.target.value })}
                        />
                      </Field>
                      <Field label="Starts">
                        <input
                          type="time"
                          value={range.startTime}
                          onChange={(event) => updateAvoidTime(range.id, { startTime: event.target.value })}
                        />
                      </Field>
                      <Field label="Ends">
                        <input
                          type="time"
                          value={range.endTime}
                          onChange={(event) => updateAvoidTime(range.id, { endTime: event.target.value })}
                        />
                      </Field>
                      <button
                        className="icon-button icon-button--danger settings-record__delete"
                        type="button"
                        aria-label={`Delete avoid time ${range.label}`}
                        onClick={() => removeAvoidTime(range.id)}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                    <fieldset className="day-picker">
                      <legend>Days</legend>
                      {WEEKDAYS.map((day) => (
                        <label key={day.value}>
                          <input
                            type="checkbox"
                            checked={range.days.includes(day.value)}
                            onChange={(event) =>
                              updateAvoidTime(range.id, {
                                days: event.target.checked
                                  ? [...range.days, day.value].toSorted((a, b) => a - b)
                                  : range.days.filter((value) => value !== day.value),
                              })
                            }
                          />
                          <span>{day.label}</span>
                        </label>
                      ))}
                    </fieldset>
                  </article>
                ))}
                {!data.settings.study.avoidTimes.length ? (
                  <p className="settings-empty-copy">No recurring avoid-times configured.</p>
                ) : null}
              </div>
            </div>
          </Card>

          <Card className="settings-card" as="section">
            <div className="settings-card__header" id="meals">
              <div>
                <h2>Meal planning</h2>
                <p>Choose how future meal suggestions should balance variety, prep, leftovers, and pantry use.</p>
              </div>
            </div>
            <div className="settings-fields">
              <Field label="Planning mode">
                <select
                  name="mealPlanningMode"
                  value={data.settings.mealPlanning.mode}
                  onChange={(event) =>
                    updateSettings({
                      mealPlanning: {
                        ...data.settings.mealPlanning,
                        mode: event.target.value as MealPlanningMode,
                      },
                    })
                  }
                >
                  {MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} — {option.detail}
                    </option>
                  ))}
                </select>
              </Field>
              <fieldset className="settings-check-group">
                <legend>Preferred meal slots</legend>
                {MEAL_SLOTS.map((slot) => (
                  <label key={slot}>
                    <input
                      type="checkbox"
                      checked={data.settings.mealPlanning.preferredSlots.includes(slot)}
                      onChange={(event) =>
                        updateSettings({
                          mealPlanning: {
                            ...data.settings.mealPlanning,
                            preferredSlots: event.target.checked
                              ? [...data.settings.mealPlanning.preferredSlots, slot]
                              : data.settings.mealPlanning.preferredSlots.filter((value) => value !== slot),
                          },
                        })
                      }
                    />
                    <span>{MEAL_SLOT_LABELS[slot]}</span>
                  </label>
                ))}
              </fieldset>
              <div className="settings-fields settings-fields--grid settings-fields--nested">
                <Field label="Target prep servings">
                  <input
                    name="targetPrepServings"
                    type="number"
                    min="1"
                    step="1"
                    value={data.settings.mealPlanning.targetPrepServings}
                    onChange={(event) =>
                      updateSettings({
                        mealPlanning: {
                          ...data.settings.mealPlanning,
                          targetPrepServings: Number(event.target.value),
                        },
                      })
                    }
                  />
                </Field>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={data.settings.mealPlanning.favorAvailablePantry}
                    onChange={(event) =>
                      updateSettings({
                        mealPlanning: {
                          ...data.settings.mealPlanning,
                          favorAvailablePantry: event.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <strong>Favor available pantry items</strong>
                    <small>Prefer ingredients already tracked at home.</small>
                  </span>
                </label>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={data.settings.mealPlanning.lateDayNutritionBias === true}
                    onChange={(event) =>
                      updateSettings({
                        mealPlanning: {
                          ...data.settings.mealPlanning,
                          lateDayNutritionBias: event.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <strong>Concentrate nutrition later in the day</strong>
                    <small>
                      Favor lighter breakfast and lunch options, then more calories and protein at dinner and snack.
                    </small>
                  </span>
                </label>
              </div>
            </div>
          </Card>

          <Card className="settings-card" as="section">
            <div className="settings-card__header" id="grocery-settings">
              <div>
                <h2>Grocery setup</h2>
                <p>Maintain recurring staples and the enabled order of shopping categories.</p>
              </div>
            </div>
            <div className="settings-fields">
              <div className="settings-subsection-heading">
                <div>
                  <h3>Staples</h3>
                  <p>These records are preferences only; they are never silently added to a list.</p>
                </div>
              </div>
              <div className="staple-add-row">
                <Field label="Staple name">
                  <input
                    value={newStaple.name}
                    placeholder="Olive oil…"
                    onChange={(event) => setNewStaple((value) => ({ ...value, name: event.target.value }))}
                  />
                </Field>
                <Field label="Quantity">
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={newStaple.quantity}
                    onChange={(event) => setNewStaple((value) => ({ ...value, quantity: Number(event.target.value) }))}
                  />
                </Field>
                <Field label="Unit">
                  <input
                    value={newStaple.unit}
                    onChange={(event) => setNewStaple((value) => ({ ...value, unit: event.target.value }))}
                  />
                </Field>
                <Field label="Category">
                  <select
                    value={newStaple.category}
                    onChange={(event) =>
                      setNewStaple((value) => ({ ...value, category: event.target.value as GroceryCategory }))
                    }
                  >
                    {orderedCategories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <button className="button button--primary staple-add-row__button" type="button" onClick={addStaple}>
                  <Plus aria-hidden="true" /> Add staple
                </button>
              </div>
              <div className="settings-record-list">
                {data.settings.groceryStaples.map((staple) => (
                  <article className="settings-record staple-record" key={staple.id}>
                    <label className="settings-toggle settings-toggle--compact">
                      <input
                        type="checkbox"
                        checked={staple.enabled}
                        onChange={(event) => updateStaple(staple.id, { enabled: event.target.checked })}
                      />
                      <span className="sr-only">Enable {staple.name}</span>
                    </label>
                    <Field label="Name">
                      <input
                        value={staple.name}
                        onChange={(event) =>
                          updateStaple(staple.id, {
                            name: event.target.value,
                            canonicalName: event.target.value.trim().toLowerCase(),
                          })
                        }
                      />
                    </Field>
                    <Field label="Quantity">
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={staple.quantity}
                        onChange={(event) => updateStaple(staple.id, { quantity: Number(event.target.value) })}
                      />
                    </Field>
                    <Field label="Unit">
                      <input
                        value={staple.unit}
                        onChange={(event) => updateStaple(staple.id, { unit: event.target.value })}
                      />
                    </Field>
                    <Field label="Category">
                      <select
                        value={staple.category}
                        onChange={(event) =>
                          updateStaple(staple.id, { category: event.target.value as GroceryCategory })
                        }
                      >
                        {orderedCategories.map((category) => (
                          <option key={category.id} value={category.name}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <button
                      className="icon-button icon-button--danger settings-record__delete"
                      type="button"
                      aria-label={`Delete staple ${staple.name}`}
                      onClick={() =>
                        updateSettings({
                          groceryStaples: data.settings.groceryStaples.filter((item) => item.id !== staple.id),
                        })
                      }
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </article>
                ))}
                {!data.settings.groceryStaples.length ? (
                  <p className="settings-empty-copy">No grocery staples configured.</p>
                ) : null}
              </div>
              <div className="settings-subsection-heading settings-subsection-heading--bordered">
                <div>
                  <h3>Category order</h3>
                  <p>Disable categories you do not use and arrange the rest to match your store.</p>
                </div>
              </div>
              <ol className="category-settings-list">
                {orderedCategories.map((category, index) => (
                  <li key={category.id}>
                    <label className="settings-toggle settings-toggle--compact">
                      <input
                        type="checkbox"
                        checked={category.enabled}
                        onChange={(event) =>
                          updateSettings({
                            groceryCategories: data.settings.groceryCategories.map((item) =>
                              item.id === category.id ? { ...item, enabled: event.target.checked } : item,
                            ),
                          })
                        }
                      />
                      <span>
                        <strong>{category.name}</strong>
                        <small>{category.enabled ? 'Enabled' : 'Disabled'}</small>
                      </span>
                    </label>
                    <div className="category-settings-list__actions">
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Move ${category.name} up`}
                        disabled={index === 0}
                        onClick={() => moveCategory(category.id, -1)}
                      >
                        <ArrowUp aria-hidden="true" />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Move ${category.name} down`}
                        disabled={index === orderedCategories.length - 1}
                        onClick={() => moveCategory(category.id, 1)}
                      >
                        <ArrowDown aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Card>

          <Card className="settings-card" as="section">
            <div className="settings-card__header" id="calendars">
              <div>
                <h2>Calendar feeds</h2>
                <p>Add separate Canvas, Google Calendar, or generic ICS records. Feed URLs stay only in your data.</p>
              </div>
              <button className="button button--secondary" type="button" onClick={addCalendarFeed}>
                <Plus aria-hidden="true" /> Add feed
              </button>
            </div>
            <div className="settings-fields">
              <Field
                label="Calendar time zone"
                hint="UTC and source-zone timestamps are converted to this zone before dates and times are saved."
              >
                <select
                  name="calendarTimeZone"
                  value={data.settings.calendarTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
                  onChange={(event) => updateSettings({ calendarTimeZone: event.target.value })}
                >
                  {!CALENDAR_TIME_ZONES.some(([value]) => value === data.settings.calendarTimeZone) &&
                  data.settings.calendarTimeZone ? (
                    <option value={data.settings.calendarTimeZone}>{data.settings.calendarTimeZone}</option>
                  ) : null}
                  {CALENDAR_TIME_ZONES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <input
                ref={icsInput}
                className="sr-only"
                type="file"
                accept=".ics,text/calendar"
                aria-label="Import local ICS file"
                onChange={(event) => void importIcs(event.target.files?.[0])}
              />
              <div className="settings-record-list calendar-feed-list">
                {data.settings.calendarFeeds.map((feed) => (
                  <article
                    className={`settings-record calendar-feed-record${feed.enabled ? '' : ' is-disabled'}`}
                    key={feed.id}
                  >
                    <div className="calendar-feed-record__heading">
                      <label className="settings-toggle settings-toggle--compact">
                        <input
                          type="checkbox"
                          checked={feed.enabled}
                          onChange={(event) => updateCalendarFeed(feed.id, { enabled: event.target.checked })}
                        />
                        <span>
                          <strong>{feed.name || 'Unnamed calendar'}</strong>
                          <small>{feed.enabled ? 'Enabled' : 'Disabled'}</small>
                        </span>
                      </label>
                      <StatusBadge tone={feedStatusTone(feed.status)}>{feed.status.replace('-', ' ')}</StatusBadge>
                    </div>
                    <div className="settings-record__grid settings-record__grid--feeds">
                      <Field label="Feed name">
                        <input
                          value={feed.name}
                          onChange={(event) => updateCalendarFeed(feed.id, { name: event.target.value })}
                        />
                      </Field>
                      <Field label="Provider">
                        <select
                          value={feed.kind}
                          onChange={(event) =>
                            updateCalendarFeed(feed.id, {
                              kind: event.target.value as CalendarFeed['kind'],
                              status: 'not-configured',
                            })
                          }
                        >
                          <option value="canvas">Canvas</option>
                          <option value="google">Google Calendar</option>
                          <option value="ics">Generic ICS</option>
                        </select>
                      </Field>
                      <Field
                        label="Feed URL"
                        hint="Private URLs are sensitive. MyHub never includes one in defaults, source, or test fixtures."
                      >
                        <input
                          type="url"
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="https://calendar.example/your-private-feed.ics…"
                          value={feed.url}
                          onChange={(event) =>
                            updateCalendarFeed(feed.id, { url: event.target.value, status: 'not-configured' })
                          }
                        />
                      </Field>
                    </div>
                    <div className="calendar-feed-record__footer">
                      <div className="button-row">
                        <button
                          className="button button--secondary"
                          type="button"
                          disabled={refreshingFeedId === feed.id || !feed.enabled}
                          onClick={() => void refreshFeed(feed)}
                        >
                          <RefreshCw aria-hidden="true" />
                          {refreshingFeedId === feed.id ? 'Refreshing…' : 'Refresh feed'}
                        </button>
                        <button
                          className="button button--quiet"
                          type="button"
                          onClick={() => {
                            setIcsTargetId(feed.id)
                            icsInput.current?.click()
                          }}
                        >
                          <Upload aria-hidden="true" /> Import local ICS
                        </button>
                        <button
                          className="button button--danger"
                          type="button"
                          onClick={() => removeCalendarFeed(feed.id)}
                        >
                          <Trash2 aria-hidden="true" /> Delete feed
                        </button>
                      </div>
                      <small>
                        Last refresh:{' '}
                        {feed.lastRefresh
                          ? new Intl.DateTimeFormat(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }).format(new Date(feed.lastRefresh))
                          : 'Never'}
                        {' · '}
                        {feed.lastImportCount ?? 0} events · {feed.lastAssignmentCount ?? 0} homework
                      </small>
                    </div>
                    {!feed.enabled ? (
                      <p className="calendar-feed-record__disabled-note" role="status">
                        Disabled records stay safely stored but are hidden from Calendar, Home, School, search, and
                        study-plan conflicts. Re-enable this feed to restore them instantly.
                      </p>
                    ) : null}
                    {feed.status === 'error' ? (
                      <div className="inline-alert">
                        <CloudOff aria-hidden="true" />
                        <span>
                          <strong>Direct refresh was blocked.</strong>Download the calendar as an ICS file and import it
                          locally instead.
                        </span>
                      </div>
                    ) : null}
                  </article>
                ))}
                {!data.settings.calendarFeeds.length ? (
                  <div className="calendar-feed-empty">
                    <p>No calendar feeds configured. Add a record or keep using local ICS import from Calendar.</p>
                    <button className="button button--primary" type="button" onClick={addCalendarFeed}>
                      <Plus aria-hidden="true" /> Add calendar feed
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>

          <Card className="settings-card" as="section">
            <div className="settings-card__header" id="nutrition">
              <h2>Nutrition targets</h2>
              <p>Daily targets and limits power dashboard and food progress indicators.</p>
            </div>
            <div className="settings-fields settings-fields--grid">
              {NUTRITION_FIELDS.map(({ key, label, kind }) => (
                <Field key={key} label={`${label}${kind === 'limit' ? ' limit' : ''}`}>
                  <input
                    name={key}
                    type="number"
                    min="0"
                    value={data.settings.nutritionTargets[key] ?? 0}
                    onChange={(event) => updateNutrition({ [key]: Number(event.target.value) })}
                  />
                </Field>
              ))}
            </div>
          </Card>

          <Card className="settings-card settings-card--sync" as="section">
            <div className="settings-card__header" id="github-sync">
              <div>
                <h2>Supabase sync + GitHub backup</h2>
                <p>End-to-end encrypted cross-device data with a versioned repository backup.</p>
              </div>
              <StatusBadge tone={syncTone(github.status)}>{github.paused ? 'paused' : github.status}</StatusBadge>
            </div>
            <div className="settings-fields">
              <div className="sync-intro">
                <span className="section-icon section-icon--blue">
                  <Database aria-hidden="true" />
                </span>
                <div>
                  <strong>Private, encrypted, and cross-device</strong>
                  <p>
                    IndexedDB is the immediate offline cache. Supabase is the live encrypted document, and GitHub keeps
                    an encrypted backup history. Both services receive ciphertext only.
                  </p>
                </div>
              </div>
              {!needsUnlock && !isConfigured ? (
                <>
                  <div className="phone-sync-guide">
                    <KeyRound aria-hidden="true" />
                    <div>
                      <strong>Opening MyHub on another device?</strong>
                      <p>
                        Open your private MyHub access link to load the encrypted Supabase document automatically.
                        Manual GitHub credentials remain below as a recovery path.
                      </p>
                    </div>
                  </div>
                  <div className="settings-fields settings-fields--grid sync-grid">
                    <Field label="Repository owner">
                      <input
                        name="githubOwner"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={owner}
                        onChange={(event) => setOwner(event.target.value)}
                      />
                    </Field>
                    <Field label="Repository name">
                      <input
                        name="githubRepo"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={repo}
                        onChange={(event) => setRepo(event.target.value)}
                      />
                    </Field>
                    <Field label="Snapshot path">
                      <input
                        name="githubPath"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={path}
                        onChange={(event) => setPath(event.target.value)}
                      />
                    </Field>
                    <Field
                      label="Fine-grained token"
                      hint="Limit it to MyHub-Data with Contents read/write only. Do not grant workflows, administration, or a classic PAT."
                    >
                      <input
                        name="githubToken"
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        value={token}
                        onChange={(event) => setToken(event.target.value)}
                      />
                    </Field>
                    <Field
                      label="Encryption passphrase"
                      hint="At least 12 characters. It stays only in memory and cannot be recovered by MyHub."
                    >
                      <input
                        name="githubPassphrase"
                        type="password"
                        autoComplete="off"
                        value={passphrase}
                        onChange={(event) => setPassphrase(event.target.value)}
                      />
                    </Field>
                  </div>
                </>
              ) : null}
              {needsUnlock ? (
                <div className="unlock-panel">
                  <LockKeyhole aria-hidden="true" />
                  <Field
                    label="Encryption passphrase"
                    hint="Unlocks the separately encrypted token and remote snapshot for this tab only."
                  >
                    <input
                      name="githubUnlockPassphrase"
                      type="password"
                      autoComplete="off"
                      value={passphrase}
                      onChange={(event) => setPassphrase(event.target.value)}
                    />
                  </Field>
                </div>
              ) : null}
              {!isConfigured || needsUnlock ? (
                <button
                  className="button button--primary"
                  type="button"
                  disabled={syncBusy || !passphrase}
                  onClick={() => void connectOrUnlock()}
                >
                  <KeyRound aria-hidden="true" />{' '}
                  {syncBusy || github.status === 'connecting'
                    ? 'Connecting…'
                    : needsUnlock
                      ? 'Unlock sync'
                      : 'Connect and sync'}
                </button>
              ) : null}
              {isConfigured && !needsUnlock ? (
                <div className="sync-status" role="status">
                  <Cloud aria-hidden="true" />
                  <div>
                    <strong>
                      {github.target.owner}/{github.target.repo}
                    </strong>
                    <span>{github.target.path}</span>
                    {github.lastSyncedAt ? (
                      <small>
                        GitHub backup{' '}
                        {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
                          new Date(github.lastSyncedAt),
                        )}
                      </small>
                    ) : null}
                    {github.privateAccessActive && github.lastSupabaseSyncedAt ? (
                      <small>
                        Supabase primary{' '}
                        {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
                          new Date(github.lastSupabaseSyncedAt),
                        )}
                      </small>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {github.errorMessage ? (
                <div className="inline-alert">
                  <AlertTriangle aria-hidden="true" />
                  <span>
                    <strong>Cross-device sync needs attention.</strong>
                    {github.errorMessage}
                  </span>
                </div>
              ) : null}
              {github.status === 'conflict' ? (
                <div className="conflict-actions" aria-labelledby="sync-conflict-heading">
                  <div>
                    <strong id="sync-conflict-heading">Choose the copy to keep</strong>
                    <p>Neither copy will be discarded until you choose.</p>
                  </div>
                  <div className="button-row">
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={syncBusy}
                      onClick={() => void runSyncAction(github.resolveUseDevice)}
                    >
                      Use this device
                    </button>
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={syncBusy}
                      onClick={() => void runSyncAction(github.resolveUseGitHub)}
                    >
                      Use GitHub
                    </button>
                  </div>
                </div>
              ) : null}
              {isConfigured && !needsUnlock ? (
                <div className="button-row">
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={syncBusy || github.paused}
                    onClick={() => void runSyncAction(github.syncNow)}
                  >
                    <RefreshCw aria-hidden="true" /> Sync now
                  </button>
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={syncBusy || github.paused || github.status !== 'current'}
                    onClick={() => void createPrivateLink()}
                  >
                    <KeyRound aria-hidden="true" /> Create private access link
                  </button>
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={syncBusy}
                    onClick={() => void runSyncAction(() => github.setPaused(!github.paused))}
                  >
                    {github.paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}{' '}
                    {github.paused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={syncBusy}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Unlink Supabase and GitHub backup on this device? Remote encrypted data and the private link will remain.',
                        )
                      )
                        void runSyncAction(github.unlink)
                    }}
                  >
                    <Link2Off aria-hidden="true" /> Unlink
                  </button>
                </div>
              ) : null}
              {isConfigured && !needsUnlock ? (
                <div className="remote-delete">
                  <div>
                    <strong>Delete latest remote snapshot</strong>
                    <span>
                      This removes the current file and pauses sync. GitHub commit history, forks, caches, or retention
                      may still contain earlier encrypted versions; MyHub cannot guarantee historical erasure.
                    </span>
                  </div>
                  <button
                    className="button button--danger"
                    type="button"
                    disabled={syncBusy}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Delete the latest encrypted snapshot from GitHub and pause sync? GitHub history may retain earlier versions.',
                        )
                      )
                        void runSyncAction(github.clearRemoteSnapshot)
                    }}
                  >
                    <Trash2 aria-hidden="true" /> Delete remote snapshot
                  </button>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="settings-card settings-card--data" as="section">
            <div className="settings-card__header" id="data">
              <div>
                <h2>Data & privacy</h2>
                <p>Your records use local IndexedDB, encrypted Supabase sync, and encrypted GitHub backup.</p>
              </div>
              <span className="section-icon section-icon--mint">
                <ShieldCheck aria-hidden="true" />
              </span>
            </div>
            <div className="data-actions">
              <div>
                <Database aria-hidden="true" />
                <span>
                  <strong>Local IndexedDB</strong>
                  <small>
                    No ads or analytics. Sync credentials are stored separately from AppData, and cloud copies are
                    encrypted in this browser.
                  </small>
                </span>
              </div>
              <div className="button-row">
                <button className="button button--secondary" type="button" onClick={exportData}>
                  <Download aria-hidden="true" /> Export data
                </button>
                <button className="button button--quiet" type="button" onClick={() => importInput.current?.click()}>
                  <Upload aria-hidden="true" /> Import data
                </button>
                <input
                  ref={importInput}
                  className="sr-only"
                  type="file"
                  accept="application/json,.json"
                  aria-label="Import MyHub JSON backup"
                  onChange={(event) => void importData(event.target.files?.[0])}
                />
              </div>
            </div>
            <div className="plaintext-warning">
              <AlertTriangle aria-hidden="true" />
              <p>
                <strong>JSON exports are plaintext.</strong> They may contain private academic and food records. Store
                them securely and never commit them to a repository.
              </p>
            </div>
            <div className="danger-zone">
              <div>
                <strong>Clear all data</strong>
                <span>
                  Erase events, assignments, recipes, meals, logs, packaged foods, leftovers, pantry, and grocery
                  records. Connected Supabase and GitHub copies will receive the empty state. Non-personal defaults and
                  connection settings remain.
                </span>
              </div>
              <button
                className="button button--danger"
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      'Clear all MyHub records on this device and propagate the empty state to connected Supabase and GitHub copies? Export first if you need a copy. This cannot be undone.',
                    )
                  )
                    clearAllData()
                }}
              >
                Clear all data
              </button>
            </div>
          </Card>
        </div>
      </div>
      <Modal
        open={privateLinkOpen}
        title="Private MyHub access link"
        description="Open this one link on your phone or another device to load MyHub automatically."
        onClose={closePrivateLink}
      >
        <div className="pairing-dialog" aria-live="polite">
          {syncBusy && !privateAccessUrl && !privateLinkError ? (
            <p className="settings-empty-copy">Creating a revocable encrypted access link…</p>
          ) : null}
          {privateLinkError ? (
            <div className="inline-alert" role="alert">
              <AlertTriangle aria-hidden="true" />
              <span>
                <strong>A private link could not be created.</strong>
                {privateLinkError}
              </span>
            </div>
          ) : null}
          {privateAccessUrl ? (
            <>
              <div className="pairing-dialog__security">
                <AlertTriangle aria-hidden="true" />
                <p>
                  <strong>This link is a password.</strong> Anyone who gets it can read and change your MyHub data while
                  it remains active. Supabase stores only ciphertext; the link supplies its browser-only decryption and
                  write capability. Creating a replacement link revokes the previous one.
                </p>
              </div>
              <Field label="Private MyHub access link" hint="Bookmark it privately on devices you trust.">
                <textarea
                  name="privateAccessLink"
                  rows={4}
                  readOnly
                  autoComplete="off"
                  spellCheck={false}
                  value={privateAccessUrl}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </Field>
              <div className="button-row">
                <button className="button button--secondary" type="button" onClick={() => void copyPrivateLink()}>
                  <Copy aria-hidden="true" /> Copy private link
                </button>
                <button className="button button--primary" type="button" onClick={closePrivateLink}>
                  Done
                </button>
              </div>
            </>
          ) : null}
        </div>
      </Modal>
    </>
  )
}
