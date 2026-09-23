import { AlertTriangle, Barcode, Plus, ScanText } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Field, Modal, SegmentedControl, StatusBadge } from '../../components/ui'
import { createUnknownNutritionProvenance } from '../../domain/defaults'
import { multiplyNutrition } from '../../domain/recipe'
import type { AppData, FoodLogEntry, Nutrition, NutritionProvenance } from '../../domain/types'
import { makeId, toLocalDate } from '../../utilities/date'
import { validateImageFile } from './fileImages'
import { extractNutritionLabel } from './nutritionLabel'
import { recognizeImageText } from './ocrService'
import { lookupOpenFoodFacts } from './openFoodFacts'

interface FoodLogEditorProps {
  open: boolean
  data: AppData
  onClose: () => void
  onSave: (entry: FoodLogEntry, leftoverUse?: { id: string; servings: number }) => void
  onCreatePackage: () => void
}

type LogSource = 'recipe' | 'packaged' | 'barcode' | 'label' | 'custom' | 'leftover'
const ZERO_NUTRITION: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }

export default function FoodLogEditor({ open, data, onClose, onSave, onCreatePackage }: FoodLogEditorProps) {
  const [source, setSource] = useState<LogSource>('recipe')
  const [sourceId, setSourceId] = useState('')
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [barcode, setBarcode] = useState('')
  const [nutrition, setNutrition] = useState<Nutrition>({ ...ZERO_NUTRITION })
  const [provenance, setProvenance] = useState<NutritionProvenance>(() => createUnknownNutritionProvenance())
  const [date, setDate] = useState(toLocalDate(new Date()))
  const [servings, setServings] = useState(1)
  const [busy, setBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(true)
  const [error, setError] = useState('')
  const labelId = useId()

  useEffect(() => {
    if (!open) return
    const initial = data.recipes.length ? 'recipe' : data.packagedFoods.length ? 'packaged' : data.leftovers.length ? 'leftover' : 'custom'
    setSource(initial)
    setSourceId(initial === 'recipe' ? data.recipes[0]?.id ?? '' : initial === 'packaged' ? data.packagedFoods[0]?.id ?? '' : initial === 'leftover' ? data.leftovers[0]?.id ?? '' : '')
    setQuery(''); setName(''); setBarcode(''); setNutrition({ ...ZERO_NUTRITION }); setProvenance(createUnknownNutritionProvenance()); setDate(toLocalDate(new Date())); setServings(1); setBusy(false); setConfirmed(true); setError('')
  }, [data.leftovers, data.packagedFoods, data.recipes, open])

  const changeSource = (value: LogSource) => {
    setSource(value); setError(''); setConfirmed(value !== 'barcode' && value !== 'label')
    setSourceId(value === 'recipe' ? data.recipes[0]?.id ?? '' : value === 'packaged' ? data.packagedFoods[0]?.id ?? '' : value === 'leftover' ? data.leftovers[0]?.id ?? '' : '')
  }

  const lookup = async () => {
    setBusy(true); setError('')
    try {
      const result = await lookupOpenFoodFacts(barcode)
      setName(result.name); setNutrition(result.nutrition); setProvenance(result.provenance); setConfirmed(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Barcode lookup failed. Use custom food or add a packaged food manually.') }
    finally { setBusy(false) }
  }

  const scan = async (file: File | undefined) => {
    if (!file) return
    const validation = validateImageFile(file)
    if (validation) { setError(validation); return }
    setBusy(true); setError('')
    try {
      const result = await recognizeImageText(file)
      const label = extractNutritionLabel(result.text)
      setNutrition(label.nutrition); setProvenance({ kind: 'nutrition-label', capturedAt: new Date().toISOString(), estimated: true, sourceLabel: 'Browser OCR from nutrition label' }); setConfirmed(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The label could not be read. Enter a custom food manually.') }
    finally { setBusy(false) }
  }

  const save = () => {
    const timestamp = new Date().toISOString()
    let entry: FoodLogEntry | null = null
    if (source === 'recipe') {
      const recipe = data.recipes.find((item) => item.id === sourceId)
      if (recipe) entry = { id: makeId('food-log'), createdAt: timestamp, updatedAt: timestamp, source: 'manual', date, name: recipe.name, servings, nutritionSnapshot: multiplyNutrition(recipe.nutritionPerServing, servings), provenanceSnapshot: { ...recipe.nutritionProvenance }, sourceSnapshot: { sourceType: 'recipe', sourceId: recipe.id, name: recipe.name, image: recipe.image, nutritionPerServing: { ...recipe.nutritionPerServing }, nutritionProvenance: { ...recipe.nutritionProvenance }, capturedAt: timestamp }, origin: 'recipe' }
    } else if (source === 'packaged') {
      const packaged = data.packagedFoods.find((item) => item.id === sourceId)
      if (packaged) entry = { id: makeId('food-log'), createdAt: timestamp, updatedAt: timestamp, source: 'manual', date, name: packaged.name, servings, nutritionSnapshot: multiplyNutrition(packaged.nutritionPerServing, servings), provenanceSnapshot: { ...packaged.nutritionProvenance }, sourceSnapshot: { sourceType: 'packaged', sourceId: packaged.id, name: packaged.name, image: packaged.image, nutritionPerServing: { ...packaged.nutritionPerServing }, nutritionProvenance: { ...packaged.nutritionProvenance }, capturedAt: timestamp }, origin: 'packaged' }
    } else if (source === 'leftover') {
      const leftover = data.leftovers.find((item) => item.id === sourceId)
      if (leftover) entry = { id: makeId('food-log'), createdAt: timestamp, updatedAt: timestamp, source: 'manual', date, name: leftover.sourceSnapshot.name, servings: Math.min(servings, leftover.servingsRemaining), nutritionSnapshot: multiplyNutrition(leftover.sourceSnapshot.nutritionPerServing, Math.min(servings, leftover.servingsRemaining)), provenanceSnapshot: { ...leftover.sourceSnapshot.nutritionProvenance }, sourceSnapshot: { ...leftover.sourceSnapshot, sourceType: 'leftover', sourceId: leftover.id, capturedAt: timestamp }, origin: 'leftover' }
    } else if (name.trim()) {
      const origin = source === 'barcode' ? 'packaged' : 'custom'
      entry = { id: makeId('food-log'), createdAt: timestamp, updatedAt: timestamp, source: source === 'custom' ? 'manual' : 'imported', date, name: name.trim(), servings, nutritionSnapshot: multiplyNutrition(nutrition, servings), provenanceSnapshot: { ...provenance, capturedAt: timestamp }, sourceSnapshot: { sourceType: origin, name: name.trim(), nutritionPerServing: { ...nutrition }, nutritionProvenance: { ...provenance, capturedAt: timestamp }, capturedAt: timestamp }, origin }
    }
    if (!entry) { setError('Choose or name a food before logging it.'); return }
    if ((source === 'barcode' || source === 'label') && !confirmed) { setError('Confirm the imported or OCR nutrition values before logging.'); return }
    onSave(entry, source === 'leftover' ? { id: sourceId, servings: entry.servings } : undefined)
  }

  const packageResults = data.packagedFoods.filter((item) => `${item.name} ${item.brand ?? ''} ${item.barcode ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  const showManualNutrition = source === 'custom' || source === 'barcode' || source === 'label'

  return <Modal open={open} title="Log food" description="Logged nutrition is an immutable snapshot. Planned meals do not count until consumption is recorded." onClose={onClose}><div className="food-log-editor"><SegmentedControl label="Food log source" value={source} onChange={(value) => changeSource(value as LogSource)} options={[{ value: 'recipe', label: 'Saved Recipe' }, { value: 'packaged', label: 'Packaged Food' }, { value: 'barcode', label: 'Barcode/Search' }, { value: 'label', label: 'Nutrition Label' }, { value: 'custom', label: 'Custom Food' }, { value: 'leftover', label: 'Leftovers' }]} />
    {source === 'recipe' ? <Field label="Saved recipe"><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Choose a recipe</option>{data.recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select></Field> : null}
    {source === 'packaged' ? <><Field label="Search saved packages"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, brand, or barcode" /></Field><Field label="Packaged food"><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Choose packaged food</option>{packageResults.map((item) => <option key={item.id} value={item.id}>{item.name}{item.brand ? ` — ${item.brand}` : ''}</option>)}</select></Field><button className="button button--secondary" type="button" onClick={onCreatePackage}><Plus aria-hidden="true" /> Add packaged food</button></> : null}
    {source === 'barcode' ? <section className="log-source-panel"><Field label="UPC or EAN"><input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value)} /></Field><button className="button button--secondary" type="button" disabled={busy} onClick={() => void lookup()}><Barcode aria-hidden="true" /> {busy ? 'Looking up…' : 'Search Open Food Facts'}</button><p>Read-only lookup. Failure falls back to the editable fields below.</p></section> : null}
    {source === 'label' ? <section className="log-source-panel"><label className="file-drop" htmlFor={labelId}><ScanText aria-hidden="true" /><strong>Choose nutrition label image</strong><small>OCR runs locally; review every field.</small></label><input id={labelId} className="sr-only" type="file" accept="image/*" onChange={(event) => void scan(event.target.files?.[0])} /></section> : null}
    {source === 'leftover' ? <Field label="Available leftovers"><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Choose leftovers</option>{data.leftovers.filter((item) => item.servingsRemaining > 0).map((item) => <option key={item.id} value={item.id}>{item.sourceSnapshot.name} — {item.servingsRemaining} servings</option>)}</select></Field> : null}
    {showManualNutrition ? <><Field label="Food name"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Food or meal name" /></Field><div className="nutrition-editor-grid">{(['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium'] as const).map((key) => <Field key={key} label={`${key[0]?.toUpperCase()}${key.slice(1)} per serving`}><input type="number" min="0" step="any" value={nutrition[key]} onChange={(event) => setNutrition({ ...nutrition, [key]: Number(event.target.value) })} /></Field>)}</div><div className="provenance-strip"><StatusBadge tone={provenance.estimated ? 'attention' : 'neutral'}>{provenance.estimated ? 'Imported / estimated' : provenance.kind}</StatusBadge><span>{provenance.sourceLabel ?? 'No source recorded'}</span></div>{source !== 'custom' ? <label className="confirmation-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><strong>I reviewed the values.</strong><small>Required before imported nutrition enters the log.</small></span></label> : null}</> : null}
    <div className="form-grid__split"><Field label="Date"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field><Field label="Servings consumed"><input type="number" min="0.25" step="0.25" value={servings} onChange={(event) => setServings(Number(event.target.value))} /></Field></div>
    {error ? <div className="inline-alert" role="alert"><AlertTriangle aria-hidden="true" /><span>{error}</span></div> : null}<div className="modal__actions"><button className="button button--quiet" type="button" onClick={onClose}>Cancel</button><button className="button button--primary" type="button" onClick={save}>Log consumed food</button></div></div></Modal>
}
