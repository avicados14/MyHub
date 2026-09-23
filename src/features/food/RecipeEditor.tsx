import { AlertTriangle, CheckCircle2, ImagePlus, Plus, Trash2 } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Field, Modal, StatusBadge } from '../../components/ui'
import { createUnknownNutritionProvenance } from '../../domain/defaults'
import { splitQuantityAndUnit } from '../../domain/measurements'
import type { GroceryCategory, Nutrition, NutritionProvenance, Recipe, RecipeIngredient, RecipeStep } from '../../domain/types'
import { makeId } from '../../utilities/date'
import { formatFileSize, IMAGE_LIMIT_BYTES, IMAGE_WARNING_BYTES, readFileAsDataUrl, validateImageFile } from './fileImages'

const CATEGORIES: GroceryCategory[] = ['Produce', 'Meat & Seafood', 'Dairy', 'Bakery', 'Frozen', 'Pantry', 'Snacks', 'Household', 'Other']
const EMPTY_NUTRITION: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }

interface RecipeEditorProps {
  open: boolean
  recipe?: Recipe
  onClose: () => void
  onSave: (recipe: Recipe) => void
}

const newIngredient = (): RecipeIngredient => ({ id: makeId('ingredient'), name: '', canonicalName: '', quantity: null, unit: '', category: 'Other' })
const newStep = (): RecipeStep => ({ id: makeId('step'), text: '' })

const blankRecipe = (): Recipe => {
  const timestamp = new Date().toISOString()
  return {
    id: makeId('recipe'), createdAt: timestamp, updatedAt: timestamp, source: 'manual',
    name: '', description: '', notes: '', image: '', category: 'Dinner', tags: [], favorite: false,
    originalYield: 4, currentYield: 4, prepMinutes: 0, cookMinutes: 0,
    ingredients: [newIngredient()], steps: [newStep()], nutritionPerServing: { ...EMPTY_NUTRITION },
    nutritionProvenance: createUnknownNutritionProvenance(timestamp, 'Manual recipe'),
    sourceLabel: 'Manual recipe', needsReview: false, reviewNotes: '',
  }
}

const cloneRecipe = (recipe: Recipe): Recipe => structuredClone(recipe)
const parseNullableNumber = (value: string): number | null => value.trim() === '' ? null : Number(value)
const ingredientToLine = (ingredient: RecipeIngredient): string =>
  [ingredient.quantity ?? '', ingredient.unit, ingredient.name].filter((value) => value !== '').join(' ')
const ingredientsFromLines = (value: string): RecipeIngredient[] => value.split('\n').filter((line) => line.trim()).map((line, index) => {
  const parsed = splitQuantityAndUnit(line)
  const name = parsed.remainder || line.trim()
  return { id: `quick-ingredient-${index}-${name}`, name, canonicalName: name.toLowerCase(), quantity: parsed.quantity, unit: parsed.unit, category: 'Other' }
})

export default function RecipeEditor({ open, recipe, onClose, onSave }: RecipeEditorProps) {
  const [draft, setDraft] = useState<Recipe>(() => recipe ? cloneRecipe(recipe) : blankRecipe())
  const [imageMessage, setImageMessage] = useState('')
  const [error, setError] = useState('')
  const imageInputId = useId()

  useEffect(() => {
    if (open) {
      setDraft(recipe ? cloneRecipe(recipe) : blankRecipe())
      setImageMessage('')
      setError('')
    }
  }, [open, recipe])

  const updateIngredient = (id: string, patch: Partial<RecipeIngredient>) => {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient) => ingredient.id === id
        ? { ...ingredient, ...patch, ...(patch.name !== undefined ? { canonicalName: patch.name.toLowerCase().trim() } : {}) }
        : ingredient),
    }))
  }

  const updateStep = (id: string, text: string) => {
    setDraft((current) => ({ ...current, steps: current.steps.map((step) => step.id === id ? { ...step, text } : step) }))
  }

  const updateNutrition = (key: keyof Nutrition, value: string) => {
    setDraft((current) => ({ ...current, nutritionPerServing: { ...current.nutritionPerServing, [key]: Number(value) } }))
  }

  const updateProvenance = (patch: Partial<NutritionProvenance>) => {
    setDraft((current) => ({ ...current, nutritionProvenance: { ...current.nutritionProvenance, ...patch } }))
  }

  const uploadImage = async (file: File | undefined) => {
    if (!file) return
    const validation = validateImageFile(file)
    if (validation) { setImageMessage(validation); return }
    if (file.size > IMAGE_WARNING_BYTES) setImageMessage(`${formatFileSize(file.size)} will be stored inside your local MyHub data. The limit is ${formatFileSize(IMAGE_LIMIT_BYTES)}.`)
    else setImageMessage(`${formatFileSize(file.size)} image ready and stored locally as a data URL.`)
    const image = await readFileAsDataUrl(file)
    setDraft((current) => ({ ...current, image }))
  }

  const submit = () => {
    const ingredients = draft.ingredients.filter((ingredient) => ingredient.name.trim()).map((ingredient) => ({ ...ingredient, name: ingredient.name.trim(), canonicalName: ingredient.name.trim().toLowerCase() }))
    const steps = draft.steps.filter((step) => step.text.trim()).map((step) => ({ ...step, text: step.text.trim() }))
    if (!draft.name.trim()) { setError('Add a recipe name before saving.'); return }
    if (!ingredients.length) { setError('Add at least one ingredient before saving.'); return }
    if (!steps.length) { setError('Add at least one method step before saving.'); return }
    if (draft.originalYield <= 0 || (draft.currentYield ?? 0) <= 0) { setError('Original and current yields must be greater than zero.'); return }
    const timestamp = new Date().toISOString()
    onSave({
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
      notes: draft.notes?.trim(),
      image: draft.image.trim(),
      category: draft.category.trim() || 'Uncategorized',
      tags: draft.tags.map((tag) => tag.trim()).filter(Boolean),
      sourceLabel: draft.sourceLabel.trim() || 'Manual recipe',
      sourceUrl: draft.sourceUrl?.trim() || undefined,
      ingredients,
      steps,
      updatedAt: timestamp,
      nutritionProvenance: { ...draft.nutritionProvenance, capturedAt: timestamp },
      ...(draft.needsReview ? { reviewedAt: undefined } : { reviewedAt: draft.reviewedAt ?? timestamp }),
    })
  }

  return (
    <Modal open={open} title={recipe ? `Edit ${recipe.name}` : 'Create a recipe'} description="Structured fields keep scaling, groceries, nutrition, and review status dependable." onClose={onClose}>
      <div className="recipe-editor">
        {draft.needsReview ? (
          <section className="review-banner" aria-label="Recipe needs review">
            <AlertTriangle aria-hidden="true" />
            <div><strong>Needs review</strong><p>Correct the imported fields below. Missing quantities stay blank until you enter them.</p></div>
            <button className="button button--secondary" type="button" onClick={() => setDraft((current) => ({ ...current, needsReview: false, reviewNotes: '', reviewedAt: new Date().toISOString() }))}><CheckCircle2 aria-hidden="true" /> Mark reviewed</button>
          </section>
        ) : <div className="review-complete"><CheckCircle2 aria-hidden="true" /> Review complete. Saving will preserve this verified state.</div>}

        <section className="editor-section">
          <div className="editor-section__heading"><div><h3>Recipe details</h3><p>Source, identity, timing, and the version you cook now.</p></div><StatusBadge tone={draft.favorite ? 'danger' : 'neutral'}>{draft.favorite ? 'Favorite' : 'Standard'}</StatusBadge></div>
          <div className="form-grid">
            <div className="form-grid__split"><Field label="Recipe name"><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required autoComplete="off" /></Field><Field label="Category"><input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} list="recipe-categories" /><datalist id="recipe-categories"><option value="Breakfast" /><option value="Lunch" /><option value="Dinner" /><option value="Snack" /><option value="Dessert" /></datalist></Field></div>
            <Field label="Description"><textarea rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field>
            <Field label="Notes" hint="Private corrections, substitutions, or cooking reminders."><textarea rows={3} value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field>
            <div className="form-grid__split"><Field label="Source label"><input value={draft.sourceLabel} onChange={(event) => setDraft({ ...draft, sourceLabel: event.target.value })} placeholder="Family recipe, cookbook, website…" /></Field><Field label="Source URL"><input type="url" value={draft.sourceUrl ?? ''} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} placeholder="https://…" /></Field></div>
            <div className="form-grid__split"><Field label="Tags" hint="Comma separated"><input value={draft.tags.join(', ')} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(',') })} placeholder="Quick, Meal prep" /></Field><label className="check-control"><input type="checkbox" checked={draft.favorite} onChange={(event) => setDraft({ ...draft, favorite: event.target.checked })} /><span>Favorite recipe</span></label></div>
            <div className="editor-image-row"><Field label="Image URL"><input type="url" value={draft.image.startsWith('data:') ? '' : draft.image} onChange={(event) => setDraft({ ...draft, image: event.target.value })} placeholder="https://…" /></Field><div><label className="button button--secondary" htmlFor={imageInputId}><ImagePlus aria-hidden="true" /> Upload image</label><input className="sr-only" id={imageInputId} type="file" accept="image/*" onChange={(event) => void uploadImage(event.target.files?.[0])} /><small>{imageMessage || `Images over ${formatFileSize(IMAGE_WARNING_BYTES)} show a storage warning; maximum ${formatFileSize(IMAGE_LIMIT_BYTES)}.`}</small></div></div>
            <div className="form-grid__split"><Field label="Original yield"><input type="number" min="0.25" step="0.25" value={draft.originalYield} onChange={(event) => setDraft({ ...draft, originalYield: Number(event.target.value) })} /></Field><Field label="Current yield"><input type="number" min="0.25" step="0.25" value={draft.currentYield ?? draft.originalYield} onChange={(event) => setDraft({ ...draft, currentYield: Number(event.target.value) })} /></Field></div>
            <div className="form-grid__split"><Field label="Prep minutes"><input type="number" min="0" value={draft.prepMinutes} onChange={(event) => setDraft({ ...draft, prepMinutes: Number(event.target.value) })} /></Field><Field label="Cook minutes"><input type="number" min="0" value={draft.cookMinutes} onChange={(event) => setDraft({ ...draft, cookMinutes: Number(event.target.value) })} /></Field></div>
          </div>
        </section>

        <section className="editor-section">
          <div className="editor-section__heading"><div><h3>Ingredients</h3><p>Leave source quantities blank when unknown. Overrides apply only at the current yield.</p></div><button className="button button--secondary" type="button" onClick={() => setDraft((current) => ({ ...current, ingredients: [...current.ingredients, newIngredient()] }))}><Plus aria-hidden="true" /> Ingredient</button></div>
          <Field label="Ingredients" hint="Quick entry: one ingredient per line. Editing this replaces the structured rows below."><textarea aria-label="Ingredients" rows={4} value={draft.ingredients.map(ingredientToLine).join('\n')} onChange={(event) => setDraft((current) => ({ ...current, ingredients: ingredientsFromLines(event.target.value) }))} placeholder={'2 cup chickpeas\n1 cup rice\nsalt to taste'} /></Field>
          <div className="ingredient-editor-list">
            {draft.ingredients.map((ingredient, index) => <article key={ingredient.id} className="ingredient-editor-row"><span className="row-index">{index + 1}</span><Field label="Ingredient"><input value={ingredient.name} onChange={(event) => updateIngredient(ingredient.id, { name: event.target.value })} placeholder="Chicken breast" /></Field><Field label="Quantity"><input type="number" min="0" step="any" value={ingredient.quantity ?? ''} onChange={(event) => updateIngredient(ingredient.id, { quantity: parseNullableNumber(event.target.value) })} placeholder="Unknown" /></Field><Field label="Unit"><input value={ingredient.unit} onChange={(event) => updateIngredient(ingredient.id, { unit: event.target.value })} placeholder="cup" /></Field><Field label="Grocery category"><select value={ingredient.category} onChange={(event) => updateIngredient(ingredient.id, { category: event.target.value as GroceryCategory })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></Field><Field label="Note"><input value={ingredient.note ?? ''} onChange={(event) => updateIngredient(ingredient.id, { note: event.target.value })} placeholder="divided" /></Field><div className="override-fields"><Field label={`Override at ${draft.currentYield ?? draft.originalYield} servings`}><input type="number" min="0" step="any" value={ingredient.scaledOverride?.quantity ?? ''} onChange={(event) => updateIngredient(ingredient.id, { scaledOverride: { yield: draft.currentYield ?? draft.originalYield, quantity: parseNullableNumber(event.target.value), unit: ingredient.scaledOverride?.unit ?? ingredient.unit } })} placeholder="Auto" /></Field><Field label="Override unit"><input value={ingredient.scaledOverride?.unit ?? ingredient.unit} onChange={(event) => updateIngredient(ingredient.id, { scaledOverride: { yield: draft.currentYield ?? draft.originalYield, quantity: ingredient.scaledOverride?.quantity ?? null, unit: event.target.value } })} /></Field></div><button className="icon-button icon-button--danger" type="button" aria-label={`Remove ingredient ${index + 1}`} onClick={() => setDraft((current) => ({ ...current, ingredients: current.ingredients.filter((item) => item.id !== ingredient.id) }))}><Trash2 aria-hidden="true" /></button></article>)}
          </div>
        </section>

        <section className="editor-section">
          <div className="editor-section__heading"><div><h3>Method</h3><p>Use one clear action per step.</p></div><button className="button button--secondary" type="button" onClick={() => setDraft((current) => ({ ...current, steps: [...current.steps, newStep()] }))}><Plus aria-hidden="true" /> Step</button></div>
          <Field label="Steps" hint="Quick entry: one instruction per line. Editing this replaces the structured steps below."><textarea aria-label="Steps" rows={4} value={draft.steps.map((step) => step.text).join('\n')} onChange={(event) => setDraft((current) => ({ ...current, steps: event.target.value.split('\n').filter((line) => line.trim()).map((text, index) => ({ id: `quick-step-${index}-${text}`, text })) }))} placeholder={'Cook the rice.\nAssemble the bowls.'} /></Field>
          <div className="step-editor-list">{draft.steps.map((step, index) => <div key={step.id} className="step-editor-row"><span>{index + 1}</span><Field label={`Step ${index + 1}`}><textarea rows={2} value={step.text} onChange={(event) => updateStep(step.id, event.target.value)} /></Field><button className="icon-button icon-button--danger" type="button" aria-label={`Remove step ${index + 1}`} onClick={() => setDraft((current) => ({ ...current, steps: current.steps.filter((item) => item.id !== step.id) }))}><Trash2 aria-hidden="true" /></button></div>)}</div>
        </section>

        <section className="editor-section">
          <div className="editor-section__heading"><div><h3>Nutrition per serving</h3><p>Record the source and flag estimates; zero means unknown, not nutritionally free.</p></div><StatusBadge tone={draft.nutritionProvenance.estimated ? 'attention' : 'food'}>{draft.nutritionProvenance.estimated ? 'Estimated' : draft.nutritionProvenance.kind}</StatusBadge></div>
          <div className="nutrition-editor-grid">{(['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium'] as const).map((key) => <Field key={key} label={`${key[0]?.toUpperCase()}${key.slice(1)} ${key === 'calories' ? '(kcal)' : key === 'sodium' ? '(mg)' : '(g)'}`}><input type="number" min="0" step="any" value={draft.nutritionPerServing[key]} onChange={(event) => updateNutrition(key, event.target.value)} /></Field>)}</div>
          <div className="form-grid__split"><Field label="Nutrition source"><select value={draft.nutritionProvenance.kind} onChange={(event) => updateProvenance({ kind: event.target.value as NutritionProvenance['kind'] })}><option value="manual">Manual</option><option value="nutrition-label">Nutrition label</option><option value="database">Database</option><option value="recipe-calculation">Recipe calculation</option><option value="estimated">Estimated</option><option value="unknown">Unknown</option></select></Field><label className="check-control"><input type="checkbox" checked={draft.nutritionProvenance.estimated} onChange={(event) => updateProvenance({ estimated: event.target.checked })} /><span>Mark nutrition as estimated</span></label></div>
          <div className="form-grid__split"><Field label="Nutrition source label"><input value={draft.nutritionProvenance.sourceLabel ?? ''} onChange={(event) => updateProvenance({ sourceLabel: event.target.value })} /></Field><Field label="Nutrition source URL"><input type="url" value={draft.nutritionProvenance.sourceUrl ?? ''} onChange={(event) => updateProvenance({ sourceUrl: event.target.value || undefined })} /></Field></div>
          {draft.needsReview ? <Field label="Review notes"><textarea rows={2} value={draft.reviewNotes ?? ''} onChange={(event) => setDraft({ ...draft, reviewNotes: event.target.value })} placeholder="What still needs correction?" /></Field> : null}
        </section>

        {error ? <div className="inline-alert" role="alert"><AlertTriangle aria-hidden="true" /><span>{error}</span></div> : null}
        <div className="modal__actions editor-actions"><button className="button button--quiet" type="button" onClick={onClose}>Cancel</button><button className="button button--primary" type="button" onClick={submit}>{recipe ? 'Save changes' : 'Save recipe'}</button></div>
      </div>
    </Modal>
  )
}
