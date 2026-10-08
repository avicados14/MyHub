import { Download } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState, Field, Modal, PageHeader, ProgressBar, StatusBadge } from '../../components/ui'
import { categories, occasions, recommend, type Garment, type Occasion, type OutfitPlan } from './types'
import { extractZip, importBatch, inspectImage, isDuplicate, type Incoming } from './import'
import * as api from './api'
import './closet.css'

function Photo({ path, name }: { path: string; name: string }) {
  const [url, setUrl] = useState(''),
    [failed, setFailed] = useState(false)
  useEffect(() => {
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
    [date, setDate] = useState(() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
  const [picks, setPicks] = useState<Garment[]>([]),
    [planId, setPlanId] = useState(() => crypto.randomUUID())
  const [temperature, setTemperature] = useState<number | null>(null),
    [place, setPlace] = useState('Golden, Colorado'),
    [weatherError, setWeatherError] = useState('')
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
    void api
      .weather()
      .then((t) => {
        if (active) setTemperature(t)
      })
      .catch(() => {
        if (active) setWeatherError('Weather unavailable; recommendations use no temperature assumption.')
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
            <Card>
              <h2>Today's weather</h2>
              <p className="closet-temperature">{temperature === null ? '—' : `${temperature}°F`}</p>
              <p>{place}</p>
              {weatherError ? <p role="status">{weatherError}</p> : null}
              <button
                className="button button--secondary"
                disabled={busy}
                onClick={() => {
                  if (!navigator.geolocation) {
                    setWeatherError('Location is unavailable on this device.')
                    return
                  }
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      void api
                        .weather(position.coords.latitude, position.coords.longitude)
                        .then((t) => {
                          setTemperature(t)
                          setPlace('Your device location')
                          setWeatherError('')
                        })
                        .catch(() => setWeatherError('Could not update weather; showing the previous location.'))
                    },
                    () => setWeatherError('Location permission was denied or unavailable. Golden remains the default.'),
                    { timeout: 10000 },
                  )
                }}
              >
                Use device location
              </button>
              <p className="muted">Weather by Open-Meteo. Location is requested only when you choose it.</p>
            </Card>
            <Card>
              <h2>Plan an outfit</h2>
              <p>
                Rule-based suggestions use clean garments, the occasion, and available weather. AI recommendations are
                not enabled.
              </p>
              <div className="form-grid">
                <Field label="Occasion">
                  <select
                    value={occasion}
                    onChange={(e) => {
                      setOccasion(e.target.value as Occasion)
                      setPicks([])
                    }}
                  >
                    {occasions.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Planned date">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field label="Styling note (saved with plan)">
                  <input
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Lots of walking, a light layer…"
                  />
                </Field>
              </div>
              <button
                className="button button--primary"
                disabled={busy}
                onClick={() => {
                  const next = recommend(items, temperature, occasion)
                  setPicks(next)
                  setPlanId(crypto.randomUUID())
                  if (!next.length) setNotice('Add clean tops and bottoms, or a one-piece garment, to build an outfit.')
                }}
              >
                Suggest outfit
              </button>
              {picks.length ? (
                <>
                  <div className="closet-picks">
                    {picks.map((item) => (
                      <div key={item.id}>
                        <Photo path={item.image_path} name={item.name} />
                        <p>
                          #{item.garment_number} · {item.name}
                        </p>
                      </div>
                    ))}
                  </div>
                  <button
                    className="button button--primary"
                    disabled={busy || !date}
                    onClick={() =>
                      void act(async () => {
                        await api.savePlan(planId, date, occasion, `${occasion} outfit`, note, picks)
                        setPicks([])
                        await refresh()
                        setNotice('Outfit saved. Selected garments are now dirty.')
                      })
                    }
                  >
                    Save outfit &amp; mark dirty
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
                      {item.laundry_status}
                    </StatusBadge>
                    <div className="closet-toolbar">
                      <button
                        className="button button--secondary"
                        disabled={busy}
                        onClick={() => setEditing({ ...item })}
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
                await api.editGarment(editing.id, {
                  name: editing.name,
                  category: editing.category,
                  primary_color: editing.primary_color,
                  laundry_status: editing.laundry_status,
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
            <button className="button button--primary" disabled={busy} type="submit">
              Save garment
            </button>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}
