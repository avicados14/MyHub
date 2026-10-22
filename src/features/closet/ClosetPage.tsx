import { Download } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState, Field, Modal, PageHeader, ProgressBar, StatusBadge } from '../../components/ui'
import { dateTimeInZone } from '../../utilities/date'
import {
  categories,
  occasions,
  garmentTypes,
  isLaundryExempt,
  type Garment,
  type Occasion,
  type OutfitPlan,
} from './types'
import { extractZip, importBatch, inspectImage, isDuplicate, type Incoming } from './import'
import * as api from './api'
import './closet.css'
import { useApp } from '../../app/AppContext'
import { planOutfit, typeOf, type OutfitSuggestion } from './recommendations'
import { validateSmartOutput } from '../../../supabase/functions/closet-recommend/logic'
import { ClothingProfile } from './ClothingProfile'
import { CalendarWeather, type WeatherSelection } from './CalendarWeather'

function Photo({ path, name }: { path: string | null; name: string }) {
  const [url, setUrl] = useState(''),
    [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!path) return
    setUrl('')
    let active = true
    const load = () =>
      void api
        .imageUrl(path)
        .then((value) => {
          if (active) {
            setUrl(value)
            setFailed(false)
          }
        })
        .catch(() => {
          if (active) setFailed(true)
        })
    load()
    const timer = setInterval(load, 240000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [path])
  if (!path)
    return (
      <div className="closet-photo closet-placeholder" aria-label={`${name}: photo not added`}>
        Photo not added
      </div>
    )
  return url && !failed ? (
    <img className="closet-photo" src={url} alt={name} loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <div className="closet-photo closet-placeholder">{failed ? 'Photo unavailable' : 'Loading photo…'}</div>
  )
}
function IncomingPhoto({ file }: { file: File }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return <img className="closet-photo" src={url} alt={`Incoming ${file.name}`} />
}
export default function ClosetPage() {
  const { data: appData } = useApp()
  const bands = appData.settings.clothingTemperatureBands
  const requestVersion = useRef(0)
  const [keptIds, setKeptIds] = useState<string[]>([])
  const [suggestionUsage, setSuggestionUsage] = useState<Record<string, number>>({})
  const [manualOutfit, setManualOutfit] = useState(false)
  const [outfitCategory, setOutfitCategory] = useState('all')
  const [outfitTitle, setOutfitTitle] = useState('')
  const [newText, setNewText] = useState(false)
  const [markingDirty, setMarkingDirty] = useState<string | null>(null)
  const [warmer, setWarmer] = useState(false),
    [jacket, setJacket] = useState(false),
    [includeAvoid, setIncludeAvoid] = useState(false)
  const [suggestion, setSuggestion] = useState<OutfitSuggestion | null>(null),
    [tankConfirmed, setTankConfirmed] = useState(false),
    [variant, setVariant] = useState(0)
  const [weatherSelection, setWeatherSelection] = useState<WeatherSelection>({
    temperature: null,
    context: '',
    signature: '',
  })
  const temperature = weatherSelection.temperature
  const [items, setItems] = useState<Garment[]>([]),
    [plans, setPlans] = useState<OutfitPlan[]>([]),
    [ready, setReady] = useState(false)
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false)
  const [category, setCategory] = useState('all'),
    [status, setStatus] = useState('all'),
    [editing, setEditing] = useState<Garment | null>(null)
  const [incoming, setIncoming] = useState<Incoming[]>([]),
    [importErrors, setImportErrors] = useState<string[]>([]),
    [progress, setProgress] = useState({ done: 0, total: 0 })
  const [occasion, setOccasion] = useState<Occasion>('Everyday'),
    [note, setNote] = useState(''),
    [date, setDate] = useState(() => dateTimeInZone(new Date(), appData.settings.calendarTimeZone).date)
  const [picks, setPicks] = useState<Garment[]>([]),
    [planId, setPlanId] = useState(() => crypto.randomUUID())
  const refresh = useCallback(async () => {
    const data = await api.loadCloset()
    setItems(data.items)
    setPlans(data.plans)
    setReady(true)
  }, [])
  useEffect(() => {
    let active = true
    void refresh().catch((e) => {
      if (active) setError(e.message)
    })
    const focus = () => {
      void refresh().catch(() => undefined)
    }
    window.addEventListener('focus', focus)
    return () => {
      active = false
      window.removeEventListener('focus', focus)
    }
  }, [refresh])
  useEffect(() => {
    setKeptIds([])
    if (manualOutfit) return
    setPicks([])
    setSuggestion(null)
    setTankConfirmed(false)
  }, [
    date,
    temperature,
    weatherSelection.signature,
    occasion,
    bands,
    warmer,
    jacket,
    includeAvoid,
    items,
    manualOutfit,
  ])
  useEffect(() => {
    if (manualOutfit)
      setPicks((previous) =>
        previous.flatMap((picked) => {
          const current = items.find((item) => item.id === picked.id && item.laundry_status === 'clean')
          return current ? [current] : []
        }),
      )
  }, [items, manualOutfit])
  useEffect(() => {
    setPlanId(crypto.randomUUID())
  }, [date, occasion, note, outfitTitle])
  const act = async (task: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await task()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please retry.')
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    requestVersion.current += 1
  }, [
    items,
    date,
    temperature,
    weatherSelection.signature,
    occasion,
    bands,
    warmer,
    jacket,
    includeAvoid,
    manualOutfit,
    note,
  ])
  const suggest = async (smart = false) => {
    const version = requestVersion.current
    const next = planOutfit(items, temperature, occasion, bands, {
      warmer,
      jacket,
      includeAvoid,
      variant,
      keptIds,
      previousIds: picks.map((item) => item.id),
      usage: suggestionUsage,
    })
    if (smart && next.items.length && next.band && temperature !== null) {
      setNotice('Finding a smart outfit…')
      const input = {
        low: temperature,
        occasion,
        note: [note, weatherSelection.context].filter(Boolean).join('\n').slice(0, 1000),
        band: next.band,
        jacket,
        includeAvoid,
        keptIds,
        previousIds: picks.map((item) => item.id),
      }
      try {
        const result = validateSmartOutput(await api.smartSuggest(input), items, input)
        next.items = result.ids.map((id) => items.find((item) => item.id === id)!)
        next.messages = [
          'Smart Suggest: ' + result.explanation,
          ...next.messages.filter((message) => message.includes('tank') || message.includes('No clean')),
        ]
      } catch {
        next.messages.unshift('Smart Suggest is unavailable or not configured. Showing a regular suggestion instead.')
      }
    } else if (smart)
      next.messages.unshift('Smart Suggest needs an active temperature band and suitable clean garments.')
    if (version !== requestVersion.current) {
      setNotice('Planning settings changed. Suggest again using your current settings.')
      return
    }
    setSuggestion(next)
    setPicks(next.items)
    setSuggestionUsage((previous) => {
      const counts = { ...previous }
      for (const item of next.items) counts[item.id] = (counts[item.id] ?? 0) + 1
      return counts
    })
    setTankConfirmed(false)
    setVariant((value) => value + 1)
    setPlanId(crypto.randomUUID())
    setNotice(next.messages.join(' '))
  }
  const review = async (file: File, zip: boolean) =>
    act(async () => {
      setIncoming([])
      setImportErrors([])
      setProgress({ done: 0, total: 0 })
      setNotice('Inspecting images…')
      const extracted = zip ? await extractZip(file, setNotice) : { files: [file], errors: [] }
      const rows: Incoming[] = [],
        errors = [...extracted.errors]
      for (const [index, image] of extracted.files.entries()) {
        try {
          const row = await inspectImage(image)
          for (const item of items) {
            const match = isDuplicate(row, { hash: item.content_hash, dhash: item.dhash })
            if (match) {
              row.duplicate = `${match}: garment #${item.garment_number} (${item.name})`
              row.replaceId = item.id
              row.choice = 'skip'
              break
            }
          }
          if (!row.duplicate)
            for (const prior of rows) {
              const match = isDuplicate(row, prior)
              if (match) {
                row.duplicate = `${match}: incoming ${prior.file.name}`
                row.choice = 'skip'
                break
              }
            }
          rows.push(row)
        } catch (e) {
          errors.push(`${image.name}: ${e instanceof Error ? e.message : 'Unreadable image'}`)
        }
        setProgress({ done: index + 1, total: extracted.files.length })
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      setIncoming(rows)
      setImportErrors(errors)
      setNotice(
        rows.length
          ? `${rows.length} images ready for review. Filename-based metadata is editable; no AI classification is used.`
          : 'No supported readable images found.',
      )
    })
  const updateIncoming = (id: string, patch: Partial<Incoming>) =>
    setIncoming((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  const upload = () =>
    act(async () => {
      const replacements = incoming.filter((row) => row.choice === 'replace' && !row.done)
      if (new Set(replacements.map((row) => row.replaceId)).size !== replacements.length)
        throw new Error('Match only one incoming photo to each existing garment per import.')
      if (
        replacements.length &&
        !window.confirm(
          `Replace images for ${replacements.length} existing garments? Their numerical IDs stay the same. Historical photos are retained.`,
        )
      )
        return
      const result = await importBatch(incoming, api.saveIncoming, (done, total) => setProgress({ done, total }))
      setIncoming(result)
      await refresh()
      setNotice(
        `${result.filter((row) => row.done).length} imported; ${result.filter((row) => row.error).length} failed. Retry failed imports using the same review list.`,
      )
    })
  const exportData = () => {
    const blob = new Blob(
      [JSON.stringify({ format: 'myhub-closet-v1', exported_at: new Date().toISOString(), items, plans }, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'myhub-closet.json'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="closet-page">
      <details>
        <summary>My clothing profile and temperature rules</summary>
        <ClothingProfile />
      </details>
      <PageHeader
        title="Closet Planner"
        description="Your private wardrobe, ready for the day."
        action={
          ready ? (
            <button className="button button--secondary" onClick={exportData}>
              <Download aria-hidden="true" />
              Export JSON
            </button>
          ) : undefined
        }
      />
      {error ? (
        <div role="alert" className="closet-notice">
          {error}{' '}
          {!ready ? (
            <>
              <Link to="/settings">Open Settings</Link>{' '}
              <button className="button button--primary" onClick={() => void act(refresh)}>
                Retry connection
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      {!ready ? (
        <EmptyState
          title="Connect your MyHub device"
          detail="Your closet opens with your existing private MyHub connection. No additional login is needed."
        />
      ) : (
        <>
          <div className="closet-overview">
            <CalendarWeather key={date} data={appData} date={date} onChange={setWeatherSelection} />
            <Card>
              <h2>Plan an outfit</h2>
              <p>
                Suggestions use clean garments, your active temperature bands, clothing preferences, and color matching.
                Smart Suggest requires server-side setup; the regular planner always remains available.
              </p>
              <div className="closet-toolbar" role="group" aria-label="Outfit planning mode">
                <button
                  className="button button--secondary"
                  disabled={busy}
                  aria-pressed={!manualOutfit}
                  onClick={() => {
                    setManualOutfit(false)
                    setPicks([])
                    setSuggestion(null)
                    setTankConfirmed(false)
                    setPlanId(crypto.randomUUID())
                  }}
                >
                  Get suggestions
                </button>
                <button
                  className="button button--secondary"
                  disabled={busy}
                  aria-pressed={manualOutfit}
                  onClick={() => {
                    setManualOutfit(true)
                    setSuggestion(null)
                    setTankConfirmed(false)
                    setPlanId(crypto.randomUUID())
                  }}
                >
                  Build my own outfit
                </button>
              </div>
              <div className="form-grid">
                <Field label="Outfit name (optional)">
                  <input
                    value={outfitTitle}
                    maxLength={160}
                    onChange={(e) => setOutfitTitle(e.target.value)}
                    placeholder={`${occasion} outfit`}
                  />
                </Field>
                <Field label="Occasion">
                  <select
                    value={occasion}
                    onChange={(e) => {
                      setOccasion(e.target.value as Occasion)
                      if (!manualOutfit) setPicks([])
                    }}
                  >
                    {occasions.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Planned date">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value)
                      setWeatherSelection({ temperature: null, context: '', signature: '' })
                    }}
                  />
                </Field>
                <Field label="Styling note (saved with plan)">
                  <input
                    maxLength={750}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Lots of walking, a light layer…"
                  />
                </Field>
              </div>
              {manualOutfit ? (
                <section aria-label="Choose outfit garments">
                  <p>
                    Choose up to 20 clean items in any combination. Weather and temperature rules do not restrict your
                    own outfits. Saving marks selected clothing dirty; shoes and jackets stay available.
                  </p>
                  <Field label="Outfit category filter">
                    <select value={outfitCategory} onChange={(e) => setOutfitCategory(e.target.value)}>
                      <option value="all">All categories</option>
                      {categories.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </Field>
                  <p role="status">{picks.length} of 20 items selected</p>
                  <div className="closet-manual-items">
                    {items
                      .filter(
                        (item) =>
                          item.laundry_status === 'clean' &&
                          (outfitCategory === 'all' || item.category === outfitCategory),
                      )
                      .map((item) => {
                        const checked = picks.some((picked) => picked.id === item.id)
                        return (
                          <label key={item.id} className="closet-manual-choice">
                            <input
                              type="checkbox"
                              aria-label={`Select garment #${item.garment_number}: ${item.name}`}
                              checked={checked}
                              disabled={busy || (!checked && picks.length >= 20)}
                              onChange={(e) => {
                                setPicks((previous) =>
                                  e.target.checked
                                    ? [...previous, item]
                                    : previous.filter((picked) => picked.id !== item.id),
                                )
                                setPlanId(crypto.randomUUID())
                              }}
                            />
                            <span>
                              #{item.garment_number} · {item.name}
                              <small>
                                {item.category} · {item.primary_color}
                              </small>
                            </span>
                          </label>
                        )
                      })}
                  </div>
                  {!items.some(
                    (item) =>
                      item.laundry_status === 'clean' && (outfitCategory === 'all' || item.category === outfitCategory),
                  ) ? (
                    <p>No clean garments match this category. Change the filter or run laundry.</p>
                  ) : null}
                  <button
                    className="button button--quiet"
                    disabled={busy || !picks.length}
                    onClick={() => {
                      setPicks([])
                      setPlanId(crypto.randomUUID())
                    }}
                  >
                    Clear selection
                  </button>
                </section>
              ) : (
                <>
                  <div className="closet-toolbar">
                    <label>
                      <input type="checkbox" checked={warmer} onChange={(e) => setWarmer(e.target.checked)} /> Use one
                      warmer clothing band
                    </label>
                    <label>
                      <input type="checkbox" checked={jacket} onChange={(e) => setJacket(e.target.checked)} /> Add a
                      jacket
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={includeAvoid}
                        onChange={(e) => setIncludeAvoid(e.target.checked)}
                      />{' '}
                      Include less-preferred clothes
                    </label>
                  </div>
                  <button className="button button--primary" disabled={busy} onClick={() => void act(() => suggest())}>
                    {keptIds.length ? 'Regenerate around kept items' : 'Suggest outfit'}
                  </button>
                  <button className="button" disabled={busy} onClick={() => void act(() => suggest(true))}>
                    Smart Suggest
                  </button>
                  <p className="muted">
                    Smart Suggest uses your clothing descriptions and styling note with Google Gemini when configured.
                    Photos are not sent. If unavailable, the regular suggester is used.
                  </p>
                  {keptIds.length > 0 && (
                    <button className="button" disabled={busy} onClick={() => setKeptIds([])}>
                      Release kept items
                    </button>
                  )}
                  <p className="muted">
                    Keep any suggested items you like, then regenerate the rest. Alternatives favor clean,
                    color-compatible clothes you have seen less often. Keeps reset when the date, weather, wardrobe, or
                    planning settings change.
                  </p>
                </>
              )}
              {suggestion?.band ? (
                <p>
                  Using {suggestion.band.top} + {suggestion.band.bottom}
                  {suggestion.band.tank ? ' + tank undershirt' : '; no undershirt'}.
                </p>
              ) : null}
              {suggestion?.needsTank && picks.length ? (
                <label>
                  <input type="checkbox" checked={tankConfirmed} onChange={(e) => setTankConfirmed(e.target.checked)} />{' '}
                  I have a clean tank undershirt for this outfit
                </label>
              ) : null}
              {picks.length ? (
                <>
                  <div className="closet-picks">
                    {picks.map((item) => (
                      <div key={item.id}>
                        <Photo path={item.image_path} name={item.name} />
                        <p>
                          #{item.garment_number} · {item.name}
                        </p>
                        {!manualOutfit ? (
                          <label>
                            <input
                              type="checkbox"
                              checked={keptIds.includes(item.id)}
                              disabled={busy}
                              aria-label={`Keep garment #${item.garment_number}: ${item.name}`}
                              onChange={(e) =>
                                setKeptIds((previous) =>
                                  e.target.checked ? [...previous, item.id] : previous.filter((id) => id !== item.id),
                                )
                              }
                            />{' '}
                            Keep this item
                          </label>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <button
                    className="button button--primary"
                    disabled={busy || !date || Boolean(suggestion?.needsTank && !tankConfirmed)}
                    onClick={() =>
                      void act(async () => {
                        await api.savePlan(
                          planId,
                          date,
                          occasion,
                          outfitTitle.trim() || `${occasion} outfit`,
                          [
                            note,
                            manualOutfit ? 'Manually selected outfit.' : '',
                            suggestion?.band
                              ? `Feels-like low ${temperature}°F; ${suggestion.band.top}, ${suggestion.band.bottom}${suggestion.band.tank ? ', tank undershirt' : ', no undershirt'}${warmer ? '; one warmer band' : ''}${jacket ? '; jacket requested' : ''}.`
                              : '',
                          ]
                            .filter(Boolean)
                            .join('\n'),
                          picks,
                        )
                        setPicks([])
                        await refresh()
                        setNotice('Outfit saved. Selected clothing is now dirty; shoes and jackets stay available.')
                      })
                    }
                  >
                    Save outfit
                  </button>
                </>
              ) : null}
            </Card>
          </div>
          <Card>
            <div className="closet-toolbar">
              <div>
                <h2>Your wardrobe</h2>
                <p>
                  {items.length} garments · {items.filter((item) => item.laundry_status === 'dirty').length} in laundry
                </p>
              </div>
              <button
                className="button button--secondary"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await api.runLaundry()
                    await refresh()
                    setNotice('Laundry complete. All garments are clean.')
                  })
                }
              >
                Run laundry
              </button>
            </div>
            <div className="closet-toolbar">
              <Field label="Import closet ZIP">
                <input
                  type="file"
                  accept=".zip,application/zip"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) void review(file, true)
                  }}
                />
              </Field>
              <Field label="Add garment photo">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) void review(file, false)
                  }}
                />
              </Field>
            </div>
            <p>Up to 250 images, 8 MB per image, 100 MB per ZIP and expanded import. JPG, PNG, WEBP, GIF.</p>
            {progress.total > 0 ? (
              <ProgressBar value={progress.done} max={progress.total} label="Closet import progress" />
            ) : null}
            {importErrors.length ? (
              <details open>
                <summary>Files that could not be imported ({importErrors.length})</summary>
                <ul>
                  {importErrors.map((message, i) => (
                    <li key={i}>{message}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            {incoming.length ? (
              <section aria-label="Review closet import">
                <h3>Review import</h3>
                <div className="closet-grid">
                  {incoming.map((row) => (
                    <article className="closet-import" key={row.id}>
                      <IncomingPhoto file={row.file} />
                      <p>{row.file.name}</p>
                      {row.duplicate ? <p className="closet-notice">{row.duplicate}</p> : null}
                      {row.replaceId && row.duplicate ? (
                        <Photo
                          path={items.find((item) => item.id === row.replaceId)?.image_path ?? ''}
                          name="Existing duplicate"
                        />
                      ) : null}
                      <Field label={`Name for ${row.file.name}`}>
                        <input
                          value={row.name}
                          disabled={row.done || busy}
                          maxLength={120}
                          onChange={(e) => updateIncoming(row.id, { name: e.target.value })}
                        />
                      </Field>
                      <Field label={`Category for ${row.file.name}`}>
                        <select
                          value={row.category}
                          disabled={row.done || busy}
                          onChange={(e) => updateIncoming(row.id, { category: e.target.value as Garment['category'] })}
                        >
                          {categories.map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label={`Color for ${row.file.name}`}>
                        <input
                          value={row.color}
                          disabled={row.done || busy}
                          maxLength={60}
                          onChange={(e) => updateIncoming(row.id, { color: e.target.value })}
                        />
                      </Field>
                      <Field
                        label={`Match existing garment for ${row.file.name}`}
                        hint="Attach this photo to a listed garment to keep its number and history."
                      >
                        <select
                          value={row.replaceId ?? ''}
                          disabled={row.done || busy}
                          onChange={(e) => {
                            const item = items.find((i) => i.id === e.target.value)
                            updateIncoming(
                              row.id,
                              item
                                ? {
                                    replaceId: item.id,
                                    choice: 'replace',
                                    name: item.name,
                                    category: item.category,
                                    color: item.primary_color,
                                  }
                                : { replaceId: undefined, choice: 'keep' },
                            )
                          }}
                        >
                          <option value="">New garment</option>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              #{item.garment_number} · {item.name}
                              {item.image_path ? '' : ' (no photo)'}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={`Import choice for ${row.file.name}`}>
                        <select
                          value={row.choice}
                          disabled={row.done || busy}
                          onChange={(e) => updateIncoming(row.id, { choice: e.target.value as Incoming['choice'] })}
                        >
                          <option value="keep">{row.duplicate ? 'Keep both' : 'Import'}</option>
                          <option value="skip">Skip incoming image</option>
                          {row.replaceId ? (
                            <option value="replace">Replace existing image (confirm on import)</option>
                          ) : null}
                        </select>
                      </Field>
                      {row.done ? <StatusBadge tone="success">Imported</StatusBadge> : null}
                      {row.error ? <p role="alert">{row.error}</p> : null}
                    </article>
                  ))}
                </div>
                <div className="closet-toolbar">
                  <button
                    className="button button--primary"
                    disabled={busy || !incoming.some((row) => !row.done && row.choice !== 'skip')}
                    onClick={() => void upload()}
                  >
                    Import accepted / retry failed
                  </button>
                  <button className="button button--secondary" disabled={busy} onClick={() => setIncoming([])}>
                    Close review
                  </button>
                </div>
              </section>
            ) : null}
            <button
              className="button button--secondary"
              disabled={busy}
              onClick={() => {
                const id = crypto.randomUUID()
                setNewText(true)
                setEditing({
                  id,
                  import_key: id,
                  user_id: '',
                  garment_number: 0,
                  name: '',
                  category: 'tops',
                  primary_color: 'Unknown',
                  garment_type: 'unknown',
                  preference: 'normal',
                  laundry_status: 'clean',
                  image_path: null,
                  content_hash: null,
                  dhash: null,
                  created_at: '',
                  updated_at: '',
                })
              }}
            >
              Add garment without photo
            </button>
            <div className="closet-toolbar">
              <Field label="Category filter">
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="all">All categories</option>
                  {categories.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
              <Field label="Laundry filter">
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="all">All garments</option>
                  <option value="clean">Clean</option>
                  <option value="dirty">Dirty</option>
                </select>
              </Field>
            </div>
            <div className="closet-grid">
              {items
                .filter(
                  (item) =>
                    (category === 'all' || item.category === category) &&
                    (status === 'all' || item.laundry_status === status),
                )
                .map((item) => (
                  <article key={item.id} className="closet-garment">
                    <Photo path={item.image_path} name={item.name} />
                    <h3>
                      #{item.garment_number} · {item.name}
                    </h3>
                    <p>
                      {item.category} · {item.primary_color}
                    </p>
                    <StatusBadge tone={item.laundry_status === 'clean' ? 'success' : 'attention'}>
                      {isLaundryExempt(item) ? 'Available' : item.laundry_status}
                    </StatusBadge>
                    <div className="closet-toolbar">
                      {!isLaundryExempt(item) && item.laundry_status === 'clean' ? (
                        <button
                          className="button button--secondary"
                          disabled={busy}
                          aria-label={`Mark garment #${item.garment_number} dirty`}
                          aria-busy={markingDirty === item.id}
                          onClick={() => {
                            setMarkingDirty(item.id)
                            void act(async () => {
                              await api.editGarment(item.id, { laundry_status: 'dirty' })
                              setItems((previous) =>
                                previous.map((row) => (row.id === item.id ? { ...row, laundry_status: 'dirty' } : row)),
                              )
                              setNotice(`Garment #${item.garment_number} marked dirty.`)
                            }).finally(() => setMarkingDirty(null))
                          }}
                        >
                          {markingDirty === item.id ? 'Saving…' : 'Mark dirty'}
                        </button>
                      ) : null}
                      <button
                        className="button button--secondary"
                        disabled={busy}
                        onClick={() => {
                          setNewText(false)
                          setEditing({ ...item })
                        }}
                      >
                        Edit #{item.garment_number}
                      </button>
                      <button
                        className="button button--secondary"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete garment #${item.garment_number} (${item.name})? Historical plans will keep their snapshots.`,
                            )
                          )
                            void act(async () => {
                              await api.deleteGarment(item)
                              setPicks([])
                              await refresh()
                            })
                        }}
                      >
                        Delete #{item.garment_number}
                      </button>
                    </div>
                  </article>
                ))}
            </div>
            {!items.length ? (
              <EmptyState
                title="Start with your closet"
                detail="Import a ZIP or add a photo. Your images stay in private storage."
              />
            ) : null}
          </Card>
          <Card>
            <h2>Outfit history</h2>
            {plans.length ? (
              plans.map((plan) => (
                <article key={plan.id} className="closet-history">
                  <h3>{plan.title}</h3>
                  <p>
                    {plan.planned_date} · {plan.occasion}
                  </p>
                  {plan.note ? <p>{plan.note}</p> : null}
                  <div className="closet-picks">
                    {plan.garment_snapshot.map((item) => (
                      <div key={item.id}>
                        <Photo path={item.image_path} name={item.name} />
                        <p>
                          #{item.garment_number} · {item.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <p>Saved plans will appear here with their original garment snapshots.</p>
            )}
          </Card>
        </>
      )}
      <Modal
        open={Boolean(editing)}
        title="Edit garment"
        onClose={() => {
          if (!busy) setEditing(null)
        }}
      >
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void act(async () => {
                if (newText) await api.createTextGarment(editing)
                else
                  await api.editGarment(editing.id, {
                    name: editing.name,
                    category: editing.category,
                    primary_color: editing.primary_color,
                    laundry_status: isLaundryExempt(editing) ? 'clean' : editing.laundry_status,
                    garment_type: editing.garment_type ?? typeOf(editing),
                    preference: editing.preference ?? 'normal',
                  })
                setEditing(null)
                setPicks([])
                await refresh()
              })
            }}
          >
            <Field label="Garment name">
              <input
                required
                maxLength={120}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>
            <Field label="Garment category">
              <select
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value as Garment['category'] })}
              >
                {categories.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="Primary color">
              <input
                required
                maxLength={60}
                value={editing.primary_color}
                onChange={(e) => setEditing({ ...editing, primary_color: e.target.value })}
              />
            </Field>
            <Field label="Clothing type" hint="Temperature suggestions require the correct sleeve and bottom type.">
              <select
                value={editing.garment_type ?? typeOf(editing)}
                onChange={(e) => setEditing({ ...editing, garment_type: e.target.value as Garment['garment_type'] })}
              >
                {garmentTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </Field>
            <Field label="Clothing preference">
              <select
                value={editing.preference ?? 'normal'}
                onChange={(e) => setEditing({ ...editing, preference: e.target.value as Garment['preference'] })}
              >
                <option value="preferred">Preferred</option>
                <option value="normal">Normal</option>
                <option value="avoid">Less preferred (opt in)</option>
              </select>
            </Field>
            {!newText ? (
              <Field
                label="Attach or replace garment photo"
                hint="Review and confirm the image; this keeps the existing garment number and laundry status."
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    void act(async () => {
                      const row = await inspectImage(file)
                      row.name = editing.name
                      row.category = editing.category
                      row.color = editing.primary_color
                      row.replaceId = editing.id
                      row.choice = 'replace'
                      row.duplicate = `Attach to #${editing.garment_number}: ${editing.name}`
                      setIncoming([row])
                      setEditing(null)
                      setNotice(
                        'Review the photo attachment and confirm import. Existing metadata, ID and laundry status are preserved.',
                      )
                    })
                  }}
                />
              </Field>
            ) : null}
            {isLaundryExempt(editing) ? (
              <p>Shoes and jackets stay available and are not included in laundry.</p>
            ) : (
              <Field label="Laundry status">
                <select
                  value={editing.laundry_status}
                  onChange={(e) =>
                    setEditing({ ...editing, laundry_status: e.target.value as Garment['laundry_status'] })
                  }
                >
                  <option value="clean">Clean</option>
                  <option value="dirty">Dirty</option>
                </select>
              </Field>
            )}
            <button className="button button--primary" disabled={busy} type="submit">
              Save garment
            </button>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}
