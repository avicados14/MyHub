import { AlertTriangle, FileText, ImagePlus, Instagram, Link2, ScanText, Upload, Video } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Field, Modal, SegmentedControl, StatusBadge } from '../../components/ui'
import type { Recipe } from '../../domain/types'
import { makeId } from '../../utilities/date'
import {
  formatFileSize,
  IMAGE_LIMIT_BYTES,
  readFileAsDataUrl,
  validateImageFile,
  validateVideoFile,
} from './fileImages'
import { extractVideoFrame, recognizeImageText } from './ocrService'
import {
  fetchRecipeDraft,
  parseRecipeInput,
  recipeFromDraft,
  type RecipeDraft,
  type RecipeImportKind,
} from './recipeImport'

interface RecipeImporterProps {
  open: boolean
  onClose: () => void
  onDraft: (recipe: Recipe) => void
}

type ImportMode = 'url' | 'paste' | 'image' | 'social'

const draftSummary = (draft: RecipeDraft) =>
  `${draft.ingredients.length} ingredients · ${draft.steps.length} steps · ${draft.warnings.length} review note${draft.warnings.length === 1 ? '' : 's'}`

export default function RecipeImporter({ open, onClose, onDraft }: RecipeImporterProps) {
  const [mode, setMode] = useState<ImportMode>('url')
  const [url, setUrl] = useState('')
  const [paste, setPaste] = useState('')
  const [socialUrl, setSocialUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [draft, setDraft] = useState<RecipeDraft | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [videoTime, setVideoTime] = useState(0)
  const imageId = useId()
  const socialImageId = useId()
  const videoId = useId()

  useEffect(() => {
    if (!open) return
    setMode('url')
    setUrl('')
    setPaste('')
    setSocialUrl('')
    setCaption('')
    setDraft(null)
    setStatus('')
    setError('')
    setBusy(false)
  }, [open])

  const useDraft = (next: RecipeDraft) => {
    setDraft(next)
    setError('')
    setStatus(`Draft extracted: ${draftSummary(next)}. Nothing is saved until you open and correct it.`)
  }

  const importUrl = async () => {
    setBusy(true)
    setError('')
    setStatus('Fetching public page in your browser…')
    try {
      useDraft(await fetchRecipeDraft(url))
    } catch (cause) {
      setDraft(null)
      setError(
        cause instanceof Error
          ? cause.message
          : 'The recipe page could not be fetched. Paste its content or upload an image instead.',
      )
    } finally {
      setBusy(false)
    }
  }

  const importPaste = (kind: RecipeImportKind = 'text') => {
    if (!paste.trim() && kind !== 'social') {
      setError('Paste JSON-LD, HTML, recipe text, or a caption first.')
      return
    }
    const text = kind === 'social' ? caption : paste
    if (!text.trim()) {
      setError('Paste the caption or copied recipe text. Social sites are not bypassed or scraped.')
      return
    }
    useDraft(parseRecipeInput(text, kind, kind === 'social' ? socialUrl || undefined : undefined))
  }

  const ocrImage = async (file: File | undefined, kind: 'image-ocr' | 'social' = 'image-ocr') => {
    if (!file) return
    const validation = validateImageFile(file)
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    setError('')
    setStatus('Loading browser OCR only for this image…')
    try {
      const result = await recognizeImageText(file, ({ status: phase, progress }) =>
        setStatus(`${phase} · ${Math.round(progress * 100)}%`),
      )
      const image = await readFileAsDataUrl(file)
      const parsed = parseRecipeInput(result.text, kind, kind === 'social' ? socialUrl || undefined : undefined)
      useDraft({
        ...parsed,
        image,
        warnings: [
          ...parsed.warnings,
          `OCR confidence ${Math.round(result.confidence)}%. Verify against the original image.`,
        ],
      })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Browser OCR could not read this image. Paste the visible text manually.',
      )
    } finally {
      setBusy(false)
    }
  }

  const ocrVideo = async (file: File | undefined) => {
    if (!file) return
    const validation = validateVideoFile(file)
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    setError('')
    setStatus('Extracting the selected frame locally. The video is not uploaded.')
    try {
      const frame = await extractVideoFrame(file, videoTime)
      const result = await recognizeImageText(frame, ({ status: phase, progress }) =>
        setStatus(`${phase} · ${Math.round(progress * 100)}%`),
      )
      const image = await readFileAsDataUrl(frame)
      const parsed = parseRecipeInput(result.text, 'video-ocr', socialUrl || undefined)
      useDraft({
        ...parsed,
        image,
        warnings: [
          ...parsed.warnings,
          `Text came from a local video frame at ${videoTime} seconds. Check the video and correct omissions.`,
        ],
      })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The local video frame could not be read. Try a screenshot or paste the caption.',
      )
    } finally {
      setBusy(false)
    }
  }

  const createReviewDraft = () => {
    if (!draft) return
    const timestamp = new Date().toISOString()
    onDraft(recipeFromDraft(draft, timestamp, makeId('recipe')))
  }

  return (
    <Modal
      open={open}
      title="Import a recipe"
      description="Every import becomes a Needs Review draft. MyHub never invents a missing quantity."
      onClose={onClose}
    >
      <div className="import-workflow">
        <SegmentedControl
          label="Import source"
          value={mode}
          onChange={(value) => {
            setMode(value as ImportMode)
            setDraft(null)
            setError('')
          }}
          options={[
            { value: 'url', label: 'URL' },
            { value: 'paste', label: 'Paste' },
            { value: 'image', label: 'Image' },
            { value: 'social', label: 'Social' },
          ]}
        />

        {mode === 'url' ? (
          <section className="import-panel">
            <span className="import-panel__icon">
              <Link2 aria-hidden="true" />
            </span>
            <div>
              <h3>Recipe page URL</h3>
              <p>
                MyHub requests the page directly and reads Schema.org Recipe JSON-LD only when the site permits browser
                CORS.
              </p>
            </div>
            <Field label="Recipe URL">
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/recipe"
              />
            </Field>
            <button className="button button--primary" type="button" disabled={busy} onClick={() => void importUrl()}>
              {busy ? 'Fetching…' : 'Fetch recipe'}
            </button>
            <div className="import-fallback">
              <AlertTriangle aria-hidden="true" />
              <p>
                If the site blocks browser access, copy its recipe text or JSON-LD, or upload a screenshot. MyHub does
                not use a proxy to evade restrictions.
              </p>
            </div>
          </section>
        ) : null}

        {mode === 'paste' ? (
          <section className="import-panel">
            <span className="import-panel__icon">
              <FileText aria-hidden="true" />
            </span>
            <div>
              <h3>Paste source content</h3>
              <p>
                Accepts Schema.org JSON-LD, HTML, plain recipe text, or a copied caption. Parsing is deterministic and
                local.
              </p>
            </div>
            <Field label="JSON-LD, HTML, text, or caption">
              <textarea
                rows={12}
                value={paste}
                onChange={(event) => setPaste(event.target.value)}
                placeholder={'Lemon pasta\n\nIngredients\n2 cups pasta\nsalt to taste\n\nInstructions\nBoil the pasta…'}
              />
            </Field>
            <button className="button button--primary" type="button" onClick={() => importPaste('text')}>
              <ScanText aria-hidden="true" /> Parse pasted content
            </button>
          </section>
        ) : null}

        {mode === 'image' ? (
          <section className="import-panel">
            <span className="import-panel__icon">
              <ImagePlus aria-hidden="true" />
            </span>
            <div>
              <h3>Recipe image or screenshot</h3>
              <p>
                The OCR library loads only after you select an image. Images stay in this browser and imports remain
                reviewable.
              </p>
            </div>
            <label className="file-drop" htmlFor={imageId}>
              <Upload aria-hidden="true" />
              <strong>Choose an image for OCR</strong>
              <small>JPG, PNG, or other browser image up to {formatFileSize(IMAGE_LIMIT_BYTES)}</small>
            </label>
            <input
              id={imageId}
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={(event) => void ocrImage(event.target.files?.[0])}
            />
          </section>
        ) : null}

        {mode === 'social' ? (
          <section className="import-panel">
            <span className="import-panel__icon">
              <Instagram aria-hidden="true" />
            </span>
            <div>
              <h3>Social or Instagram intake</h3>
              <p>
                Paste the public URL for provenance, then supply the caption, screenshot, or video you are allowed to
                access. MyHub does not log in, scrape, or bypass platform restrictions.
              </p>
            </div>
            <Field label="Social post URL">
              <input
                type="url"
                value={socialUrl}
                onChange={(event) => setSocialUrl(event.target.value)}
                placeholder="https://www.instagram.com/…"
              />
            </Field>
            <Field label="Pasted caption or copied text">
              <textarea
                rows={7}
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Paste the caption or visible recipe text…"
              />
            </Field>
            <button className="button button--secondary" type="button" onClick={() => importPaste('social')}>
              <FileText aria-hidden="true" /> Parse caption
            </button>
            <div className="social-upload-row">
              <div>
                <label className="button button--secondary" htmlFor={socialImageId}>
                  <ImagePlus aria-hidden="true" /> OCR screenshot
                </label>
                <input
                  id={socialImageId}
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={(event) => void ocrImage(event.target.files?.[0], 'social')}
                />
              </div>
              <div>
                <Field label="Video frame time (seconds)">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={videoTime}
                    onChange={(event) => setVideoTime(Number(event.target.value))}
                  />
                </Field>
                <label className="button button--secondary" htmlFor={videoId}>
                  <Video aria-hidden="true" /> OCR video frame
                </label>
                <input
                  id={videoId}
                  className="sr-only"
                  type="file"
                  accept="video/*"
                  onChange={(event) => void ocrVideo(event.target.files?.[0])}
                />
              </div>
            </div>
          </section>
        ) : null}

        {status ? (
          <p className="import-status" role="status">
            {status}
          </p>
        ) : null}
        {error ? (
          <div className="inline-alert" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>
              <strong>Import needs another route</strong>
              {error}
            </span>
          </div>
        ) : null}
        {draft ? (
          <section className="import-preview">
            <div className="editor-section__heading">
              <div>
                <h3>{draft.name}</h3>
                <p>{draftSummary(draft)}</p>
              </div>
              <StatusBadge tone="attention">Needs Review</StatusBadge>
            </div>
            {draft.image ? (
              <img src={draft.image} alt="Imported recipe source preview" width="640" height="426" />
            ) : null}
            <dl>
              <div>
                <dt>Source</dt>
                <dd>{draft.sourceLabel}</dd>
              </div>
              <div>
                <dt>Yield</dt>
                <dd>{draft.originalYield}</dd>
              </div>
              <div>
                <dt>Times</dt>
                <dd>
                  {draft.prepMinutes} prep · {draft.cookMinutes} cook
                </dd>
              </div>
            </dl>
            <ul>
              {draft.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            <button className="button button--primary button--full" type="button" onClick={createReviewDraft}>
              Open review draft
            </button>
          </section>
        ) : null}
      </div>
    </Modal>
  )
}
