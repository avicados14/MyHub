import { CloudOff, Database, Download, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../app/AppContext'
import { Card, Field, PageHeader, StatusBadge } from '../../components/ui'
import { parseIcs } from '../../domain/ics'
import type { Nutrition, StudySettings, UserSettings } from '../../domain/types'
import { createBackup, parseBackup } from '../../storage/database'

export default function SettingsPage() {
  const { data, updateData, replaceData, resetDemoData, announce } = useApp()
  const importInput = useRef<HTMLInputElement>(null)
  const icsInput = useRef<HTMLInputElement>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const preferred = data.settings.appearance === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : data.settings.appearance
    document.documentElement.dataset.theme = preferred
    document.documentElement.style.colorScheme = preferred
  }, [data.settings.appearance])

  const updateSettings = (change: Partial<UserSettings>, message = 'Settings saved.') => updateData((previous) => ({ ...previous, settings: { ...previous.settings, ...change } }), message)
  const updateStudy = (change: Partial<StudySettings>) => updateSettings({ study: { ...data.settings.study, ...change } })
  const updateNutrition = (change: Partial<Nutrition>) => updateSettings({ nutritionTargets: { ...data.settings.nutritionTargets, ...change } })

  const exportData = () => {
    const blob = new Blob([JSON.stringify(createBackup(data), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `myhub-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    announce('MyHub backup downloaded.')
  }

  const importData = async (file?: File) => {
    if (!file) return
    try {
      const backup = parseBackup(await file.text())
      if (!window.confirm(`Replace current local data with the backup from ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(backup.exportedAt))}? Export first if you need a copy.`)) return
      replaceData(backup.data)
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The backup could not be imported.')
    } finally {
      if (importInput.current) importInput.current.value = ''
    }
  }

  const importIcs = async (file?: File) => {
    if (!file) return
    try {
      const events = parseIcs(await file.text(), 'Canvas ICS file')
      updateData((previous) => ({ ...previous, events: [...previous.events.filter((item) => !events.some((incoming) => incoming.id === item.id)), ...events], settings: { ...previous.settings, canvas: { ...previous.settings.canvas, status: 'connected', lastRefresh: new Date().toISOString() } } }), `Imported ${events.length} calendar events from ${file.name}.`)
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The calendar file could not be imported.')
    } finally {
      if (icsInput.current) icsInput.current.value = ''
    }
  }

  const refreshCanvas = async () => {
    const url = data.settings.canvas.feedUrl.trim()
    if (!url) { announce('Add your Canvas ICS feed URL first, or import an ICS file.'); return }
    setRefreshing(true)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Canvas returned ${response.status}.`)
      const events = parseIcs(await response.text(), 'Canvas ICS feed')
      updateData((previous) => ({ ...previous, events: [...previous.events.filter((item) => item.sourceLabel !== 'Canvas ICS feed'), ...events], settings: { ...previous.settings, canvas: { ...previous.settings.canvas, status: 'connected', lastRefresh: new Date().toISOString() } } }), `Canvas refreshed with ${events.length} events.`)
    } catch {
      updateData((previous) => ({ ...previous, settings: { ...previous.settings, canvas: { ...previous.settings.canvas, status: 'error' } } }), 'The browser could not refresh that feed. Canvas often blocks direct browser requests; download the ICS file and use Import ICS instead.')
    } finally { setRefreshing(false) }
  }

  return <>
    <PageHeader title="Settings" description="Tune your planning rules and keep control of your local data." />
    <div className="settings-layout">
      <div className="settings-nav" aria-label="Settings sections"><a href="#general">General</a><a href="#study">Study planner</a><a href="#canvas">Canvas</a><a href="#nutrition">Nutrition</a><a href="#data">Data & privacy</a></div>
      <div className="settings-content">
        <Card className="settings-card" as="section"><div className="settings-card__header" id="general"><h2>General</h2><p>Choose display and measurement preferences.</p></div><div className="settings-fields"><Field label="Your name"><input name="name" autoComplete="name" value={data.settings.name} onChange={(event) => updateSettings({ name: event.target.value })} /></Field><Field label="Appearance"><select name="appearance" value={data.settings.appearance} onChange={(event) => updateSettings({ appearance: event.target.value as UserSettings['appearance'] })}><option value="light">Light</option><option value="dark">Dark</option><option value="system">Use device setting</option></select></Field><Field label="Measurement system"><select name="measurementSystem" value={data.settings.measurementSystem} onChange={(event) => updateSettings({ measurementSystem: event.target.value as UserSettings['measurementSystem'] })}><option value="us">US customary</option><option value="metric">Metric</option></select></Field></div></Card>
        <Card className="settings-card" as="section"><div className="settings-card__header" id="study"><h2>Study planner</h2><p>MyHub schedules only inside this daily window.</p></div><div className="settings-fields settings-fields--grid"><Field label="Earliest study time"><input name="earliestTime" type="time" value={data.settings.study.earliestTime} onChange={(event) => updateStudy({ earliestTime: event.target.value })} /></Field><Field label="Latest study time"><input name="latestTime" type="time" value={data.settings.study.latestTime} onChange={(event) => updateStudy({ latestTime: event.target.value })} /></Field><Field label="Default block (minutes)"><input name="defaultBlockMinutes" type="number" min="15" step="5" value={data.settings.study.defaultBlockMinutes} onChange={(event) => updateStudy({ defaultBlockMinutes: Number(event.target.value) })} /></Field><Field label="Break (minutes)"><input name="breakMinutes" type="number" min="0" step="5" value={data.settings.study.breakMinutes} onChange={(event) => updateStudy({ breakMinutes: Number(event.target.value) })} /></Field><Field label="Maximum block (minutes)"><input name="maxBlockMinutes" type="number" min="15" step="5" value={data.settings.study.maxBlockMinutes} onChange={(event) => updateStudy({ maxBlockMinutes: Number(event.target.value) })} /></Field></div></Card>
        <Card className="settings-card" as="section"><div className="settings-card__header" id="canvas"><div><h2>Canvas calendar</h2><p>Use the ICS feed fields Canvas actually provides. No Canvas password is needed.</p></div><StatusBadge tone={data.settings.canvas.status === 'connected' ? 'success' : data.settings.canvas.status === 'error' ? 'danger' : 'neutral'}>{data.settings.canvas.status.replace('-', ' ')}</StatusBadge></div><div className="settings-fields"><Field label="Canvas ICS feed URL" hint="Saved only in this browser. Direct refresh depends on the feed’s CORS policy."><input name="canvasUrl" type="url" autoComplete="off" spellCheck={false} placeholder="https://canvas.example.edu/feeds/calendars/…" value={data.settings.canvas.feedUrl} onChange={(event) => updateSettings({ canvas: { ...data.settings.canvas, feedUrl: event.target.value, status: 'not-configured' } })} /></Field><div className="button-row"><button className="button button--secondary" type="button" disabled={refreshing} onClick={() => void refreshCanvas()}><RefreshCw aria-hidden="true" /> {refreshing ? 'Refreshing…' : 'Refresh feed'}</button><button className="button button--quiet" type="button" onClick={() => icsInput.current?.click()}><Upload aria-hidden="true" /> Import ICS file</button><input ref={icsInput} className="sr-only" type="file" accept=".ics,text/calendar" aria-label="Import Canvas ICS file" onChange={(event) => void importIcs(event.target.files?.[0])} /></div>{data.settings.canvas.status === 'error' ? <div className="inline-alert"><CloudOff aria-hidden="true" /><span><strong>Direct refresh was blocked.</strong> Download the calendar file from Canvas and import it here instead.</span></div> : null}{data.settings.canvas.lastRefresh ? <p>Last refreshed {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.settings.canvas.lastRefresh))}</p> : null}</div></Card>
        <Card className="settings-card" as="section"><div className="settings-card__header" id="nutrition"><h2>Nutrition targets</h2><p>These targets power dashboard and food progress indicators.</p></div><div className="settings-fields settings-fields--grid">{(['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium'] as const).map((key) => <Field key={key} label={`${key[0]?.toUpperCase()}${key.slice(1)}`}><input name={key} type="number" min="0" value={data.settings.nutritionTargets[key]} onChange={(event) => updateNutrition({ [key]: Number(event.target.value) })} /></Field>)}</div></Card>
        <Card className="settings-card settings-card--data" as="section"><div className="settings-card__header" id="data"><div><h2>Data & privacy</h2><p>Your academic and food records stay in this browser unless you export them.</p></div><span className="section-icon section-icon--mint"><ShieldCheck aria-hidden="true" /></span></div><div className="data-actions"><div><Database aria-hidden="true" /><span><strong>Local IndexedDB</strong><small>No account, analytics, ads, or cloud sync.</small></span></div><div className="button-row"><button className="button button--secondary" type="button" onClick={exportData}><Download aria-hidden="true" /> Export data</button><button className="button button--quiet" type="button" onClick={() => importInput.current?.click()}><Upload aria-hidden="true" /> Import data</button><input ref={importInput} className="sr-only" type="file" accept="application/json,.json" aria-label="Import MyHub JSON backup" onChange={(event) => void importData(event.target.files?.[0])} /></div></div><div className="danger-zone"><div><strong>Reset demo data</strong><span>Replace this browser’s current MyHub data with the original sample records.</span></div><button className="button button--danger" type="button" onClick={() => { if (window.confirm('Reset all local MyHub data? Export first if you need a copy. This cannot be undone.')) resetDemoData() }}>Reset demo data</button></div></Card>
      </div>
    </div>
  </>
}
