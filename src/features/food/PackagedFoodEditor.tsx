import { AlertTriangle, Barcode, CheckCircle2, ImagePlus, ScanText } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Field, Modal, SegmentedControl, StatusBadge } from '../../components/ui'
import type { Nutrition, NutritionProvenance, PackagedFood } from '../../domain/types'
import { makeId } from '../../utilities/date'
import { formatFileSize, IMAGE_LIMIT_BYTES, readFileAsDataUrl, validateImageFile } from './fileImages'
import { extractNutritionLabel } from './nutritionLabel'
import { recognizeImageText } from './ocrService'
import { lookupOpenFoodFacts } from './openFoodFacts'

interface PackagedFoodEditorProps {
  open: boolean
  food?: PackagedFood
  onClose: () => void
  onSave: (food: PackagedFood) => void
}

type PackageMode = 'manual' | 'barcode' | 'label'
const ZERO_NUTRITION: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }

const blankFood = (): PackagedFood => {
  const timestamp = new Date().toISOString()
  return {
    id: makeId('packaged'), createdAt: timestamp, updatedAt: timestamp, source: 'manual',
    name: '', brand: '', barcode: '', servingSize: { quantity: 1, unit: 'serving' },
    nutritionPerServing: { ...ZERO_NUTRITION },
    nutritionProvenance: { kind: 'manual', capturedAt: timestamp, estimated: false, sourceLabel: 'Manual package entry' },
    image: '', notes: '', needsReview: false,
  }
}

export default function PackagedFoodEditor({ open, food, onClose, onSave }: PackagedFoodEditorProps) {
  const [mode, setMode] = useState<PackageMode>('manual')
  const [draft, setDraft] = useState<PackagedFood>(() => food ? structuredClone(food) : blankFood())
  const [barcode, setBarcode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(true)
  const packageImageId = useId()
  const labelImageId = useId()

  useEffect(() => {
    if (!open) return
    setMode('manual')
    setDraft(food ? structuredClone(food) : blankFood())
    setBarcode(food?.barcode ?? '')
    setBusy(false)
    setMessage('')
    setError('')
    setConfirmed(!food?.needsReview)
  }, [food, open])

  const updateNutrition = (key: keyof Nutrition, value: string) => setDraft((current) => ({ ...current, nutritionPerServing: { ...current.nutritionPerServing, [key]: Number(value) } }))
  const updateProvenance = (patch: Partial<NutritionProvenance>) => setDraft((current) => ({ ...current, nutritionProvenance: { ...current.nutritionProvenance, ...patch } }))

  const lookUpBarcode = async () => {
    setBusy(true); setError(''); setMessage('Looking up limited product fields from Open Food Facts…')
    try {
      const imported = await lookupOpenFoodFacts(barcode)
      setDraft((current) => ({
        ...current, source: 'imported', name: imported.name, brand: imported.brand, barcode: imported.barcode,
        servingSize: { quantity: imported.servingQuantity, unit: imported.servingUnit },
        nutritionPerServing: imported.nutrition, nutritionProvenance: imported.provenance,
        image: imported.image ?? current.image, notes: imported.warnings.join(' '), needsReview: true,
      }))
      setConfirmed(false)
      setMessage(`Read-only database import completed. ${imported.warnings.join(' ') || 'Review the package before saving.'}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Lookup failed. Enter the package manually or scan its nutrition label.'); setMode('manual') }
    finally { setBusy(false) }
  }

  const uploadPackage = async (file: File | undefined) => {
    if (!file) return
    const validation = validateImageFile(file)
    if (validation) { setError(validation); return }
    const image = await readFileAsDataUrl(file)
    setDraft((current) => ({ ...current, image }))
    setMessage(`${formatFileSize(file.size)} package image stored locally. Maximum ${formatFileSize(IMAGE_LIMIT_BYTES)}.`)
  }

  const scanLabel = async (file: File | undefined) => {
    if (!file) return
    const validation = validateImageFile(file)
    if (validation) { setError(validation); return }
    setBusy(true); setError(''); setMessage('Loading browser OCR for this label only…')
    try {
      const result = await recognizeImageText(file, ({ status, progress }) => setMessage(`${status} · ${Math.round(progress * 100)}%`))
      const label = extractNutritionLabel(result.text)
      setDraft((current) => ({
        ...current,
        servingSize: label.servingQuantity ? { quantity: label.servingQuantity, unit: label.servingUnit || current.servingSize.unit } : current.servingSize,
        nutritionPerServing: label.nutrition,
        nutritionProvenance: { kind: 'nutrition-label', capturedAt: new Date().toISOString(), estimated: true, sourceLabel: 'Browser OCR from uploaded nutrition label' },
        notes: [current.notes, ...label.warnings, `OCR confidence ${Math.round(result.confidence)}%.`].filter(Boolean).join(' '),
        needsReview: true,
      }))
      setConfirmed(false)
      setMessage(`OCR found ${label.detected.length} fields. Compare every value with the label before saving.`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The label could not be read. Enter the values manually.') }
    finally { setBusy(false) }
  }

  const save = () => {
    if (!draft.name.trim()) { setError('Enter the package name before saving.'); return }
    if (draft.servingSize.quantity <= 0) { setError('Serving quantity must be greater than zero.'); return }
    if (draft.needsReview && !confirmed) { setError('Confirm that you reviewed imported or OCR values against the package before saving.'); return }
    const timestamp = new Date().toISOString()
    onSave({ ...draft, name: draft.name.trim(), brand: draft.brand?.trim(), barcode: draft.barcode?.trim(), updatedAt: timestamp, nutritionProvenance: { ...draft.nutritionProvenance, capturedAt: timestamp }, needsReview: false, reviewedAt: timestamp })
  }

  return (
    <Modal open={open} title={food ? `Edit ${food.name}` : 'Add packaged food'} description="Use manual entry, a read-only Open Food Facts lookup, or local label OCR. All imported values require confirmation." onClose={onClose}>
      <div className="package-editor">
        <SegmentedControl label="Package entry method" value={mode} onChange={(value) => { setMode(value as PackageMode); setError('') }} options={[{ value: 'manual', label: 'Manual' }, { value: 'barcode', label: 'Barcode' }, { value: 'label', label: 'Label image' }]} />

        {mode === 'barcode' ? <section className="import-panel"><span className="import-panel__icon"><Barcode aria-hidden="true" /></span><div><h3>Open Food Facts lookup</h3><p>Uses the official v2 product endpoint with limited fields. MyHub reads only and never writes back.</p></div><Field label="UPC or EAN barcode"><input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="737628064502" /></Field><button className="button button--primary" type="button" disabled={busy} onClick={() => void lookUpBarcode()}>{busy ? 'Looking up…' : 'Look up barcode'}</button><p className="source-disclosure">Database records can be incomplete or incorrect. Imported values are marked estimated until you confirm them.</p></section> : null}
        {mode === 'label' ? <section className="import-panel"><span className="import-panel__icon"><ScanText aria-hidden="true" /></span><div><h3>Nutrition label OCR</h3><p>Upload a clear label image. Tesseract loads lazily and recognition runs in your browser.</p></div><label className="file-drop" htmlFor={labelImageId}><ImagePlus aria-hidden="true" /><strong>Choose a nutrition label image</strong><small>Review serving size and all six metrics below before save.</small></label><input id={labelImageId} className="sr-only" type="file" accept="image/*" onChange={(event) => void scanLabel(event.target.files?.[0])} /></section> : null}

        <section className="editor-section">
          <div className="editor-section__heading"><div><h3>Package details</h3><p>Manual fallback is always available.</p></div><StatusBadge tone={draft.nutritionProvenance.estimated ? 'attention' : 'food'}>{draft.nutritionProvenance.estimated ? 'Imported / estimated' : 'Manual'}</StatusBadge></div>
          <div className="form-grid"><div className="form-grid__split"><Field label="Product name"><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field><Field label="Brand"><input value={draft.brand ?? ''} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} /></Field></div><div className="form-grid__split"><Field label="Barcode"><input inputMode="numeric" value={draft.barcode ?? ''} onChange={(event) => setDraft({ ...draft, barcode: event.target.value })} /></Field><Field label="Servings per container"><input type="number" min="0" step="any" value={draft.servingsPerContainer ?? ''} onChange={(event) => setDraft({ ...draft, servingsPerContainer: event.target.value ? Number(event.target.value) : undefined })} /></Field></div><div className="form-grid__split"><Field label="Serving quantity"><input type="number" min="0.01" step="any" value={draft.servingSize.quantity} onChange={(event) => setDraft({ ...draft, servingSize: { ...draft.servingSize, quantity: Number(event.target.value) } })} /></Field><Field label="Serving unit"><input value={draft.servingSize.unit} onChange={(event) => setDraft({ ...draft, servingSize: { ...draft.servingSize, unit: event.target.value } })} /></Field></div><div className="editor-image-row"><Field label="Package image URL"><input type="url" value={draft.image?.startsWith('data:') ? '' : draft.image ?? ''} onChange={(event) => setDraft({ ...draft, image: event.target.value })} /></Field><div><label className="button button--secondary" htmlFor={packageImageId}><ImagePlus aria-hidden="true" /> Upload package image</label><input id={packageImageId} className="sr-only" type="file" accept="image/*" onChange={(event) => void uploadPackage(event.target.files?.[0])} /></div></div><Field label="Notes"><textarea rows={3} value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field></div>
        </section>

        <section className="editor-section"><div className="editor-section__heading"><div><h3>Nutrition per serving</h3><p>Calories are kcal, sodium is mg, and other nutrients are grams.</p></div><StatusBadge tone={draft.needsReview ? 'attention' : 'success'}>{draft.needsReview ? 'Needs confirmation' : 'Confirmed'}</StatusBadge></div><div className="nutrition-editor-grid">{(['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium'] as const).map((key) => <Field key={key} label={`${key[0]?.toUpperCase()}${key.slice(1)} ${key === 'calories' ? '(kcal)' : key === 'sodium' ? '(mg)' : '(g)'}`}><input type="number" min="0" step="any" value={draft.nutritionPerServing[key]} onChange={(event) => updateNutrition(key, event.target.value)} /></Field>)}</div><div className="form-grid__split"><Field label="Provenance"><select value={draft.nutritionProvenance.kind} onChange={(event) => updateProvenance({ kind: event.target.value as NutritionProvenance['kind'] })}><option value="manual">Manual</option><option value="nutrition-label">Nutrition label</option><option value="database">Database</option><option value="estimated">Estimated</option><option value="unknown">Unknown</option></select></Field><label className="check-control"><input type="checkbox" checked={draft.nutritionProvenance.estimated} onChange={(event) => updateProvenance({ estimated: event.target.checked })} /><span>Values are estimated/imported</span></label></div>{draft.needsReview ? <label className="confirmation-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><CheckCircle2 aria-hidden="true" /><strong>I compared the imported values with the package label.</strong><small>This confirmation is required before save.</small></span></label> : null}</section>

        {message ? <p className="import-status" role="status">{message}</p> : null}
        {error ? <div className="inline-alert" role="alert"><AlertTriangle aria-hidden="true" /><span>{error}</span></div> : null}
        <div className="modal__actions editor-actions"><button className="button button--quiet" type="button" onClick={onClose}>Cancel</button><button className="button button--primary" type="button" onClick={save}>Save packaged food</button></div>
      </div>
    </Modal>
  )
}
