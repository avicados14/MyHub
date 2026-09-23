import { AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Field, Modal, SegmentedControl } from '../../components/ui'
import { createUnknownNutritionProvenance } from '../../domain/defaults'
import type { AppData, MealEntry, MealSlot, Nutrition } from '../../domain/types'
import { formatDate, makeId } from '../../utilities/date'

interface MealEditorProps {
  open: boolean
  data: AppData
  target: { date: string; slot: MealSlot }
  meal?: MealEntry
  initialSource?: { type: MealSourceType; id: string }
  onClose: () => void
  onSave: (meal: MealEntry) => void
}

type MealSourceType = 'recipe' | 'packaged' | 'custom' | 'leftover'
const ZERO_NUTRITION: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }

export default function MealEditor({ open, data, target, meal, initialSource, onClose, onSave }: MealEditorProps) {
  const [sourceType, setSourceType] = useState<MealSourceType>('recipe')
  const [sourceId, setSourceId] = useState('')
  const [customName, setCustomName] = useState('')
  const [nutrition, setNutrition] = useState<Nutrition>({ ...ZERO_NUTRITION })
  const [servings, setServings] = useState(1)
  const [prepared, setPrepared] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const initialType =
      meal?.sourceSnapshot.sourceType ??
      initialSource?.type ??
      (data.recipes.length
        ? 'recipe'
        : data.packagedFoods.length
          ? 'packaged'
          : data.leftovers.length
            ? 'leftover'
            : 'custom')
    setSourceType(initialType)
    setSourceId(
      meal?.recipeId ??
        meal?.packagedFoodId ??
        meal?.leftoverId ??
        initialSource?.id ??
        (initialType === 'recipe'
          ? data.recipes[0]?.id
          : initialType === 'packaged'
            ? data.packagedFoods[0]?.id
            : initialType === 'leftover'
              ? data.leftovers[0]?.id
              : '') ??
        '',
    )
    setCustomName(meal?.customName ?? '')
    setNutrition(meal ? { ...meal.sourceSnapshot.nutritionPerServing } : { ...ZERO_NUTRITION })
    setServings(meal?.servings ?? 1)
    setPrepared(meal?.preparedServings ?? 1)
    setError('')
  }, [data.leftovers, data.packagedFoods, data.recipes, initialSource, meal, open])

  const changeType = (type: MealSourceType) => {
    setSourceType(type)
    setSourceId(
      type === 'recipe'
        ? (data.recipes[0]?.id ?? '')
        : type === 'packaged'
          ? (data.packagedFoods[0]?.id ?? '')
          : type === 'leftover'
            ? (data.leftovers[0]?.id ?? '')
            : '',
    )
  }

  const save = () => {
    const timestamp = new Date().toISOString()
    const base = {
      id: meal?.id ?? makeId('meal'),
      createdAt: meal?.createdAt ?? timestamp,
      updatedAt: timestamp,
      source: meal?.source ?? ('manual' as const),
      date: target.date,
      slot: target.slot,
      servings,
      preparedServings: prepared,
      consumedServings: meal?.consumedServings ?? 0,
    }
    let next: MealEntry | null = null
    if (sourceType === 'recipe') {
      const recipe = data.recipes.find((item) => item.id === sourceId)
      if (recipe)
        next = {
          ...base,
          recipeId: recipe.id,
          sourceSnapshot: {
            sourceType: 'recipe',
            sourceId: recipe.id,
            name: recipe.name,
            image: recipe.image,
            nutritionPerServing: { ...recipe.nutritionPerServing },
            nutritionProvenance: { ...recipe.nutritionProvenance },
            capturedAt: timestamp,
          },
        }
    } else if (sourceType === 'packaged') {
      const packaged = data.packagedFoods.find((item) => item.id === sourceId)
      if (packaged)
        next = {
          ...base,
          packagedFoodId: packaged.id,
          sourceSnapshot: {
            sourceType: 'packaged',
            sourceId: packaged.id,
            name: packaged.name,
            image: packaged.image,
            nutritionPerServing: { ...packaged.nutritionPerServing },
            nutritionProvenance: { ...packaged.nutritionProvenance },
            capturedAt: timestamp,
          },
        }
    } else if (sourceType === 'leftover') {
      const leftover = data.leftovers.find((item) => item.id === sourceId)
      if (leftover)
        next = {
          ...base,
          leftoverId: leftover.id,
          preparedServings: Math.min(prepared, leftover.servingsRemaining),
          sourceSnapshot: {
            ...leftover.sourceSnapshot,
            sourceType: 'leftover',
            sourceId: leftover.id,
            capturedAt: timestamp,
          },
        }
    } else if (customName.trim()) {
      next = {
        ...base,
        customName: customName.trim(),
        sourceSnapshot: {
          sourceType: 'custom',
          name: customName.trim(),
          nutritionPerServing: { ...nutrition },
          nutritionProvenance: createUnknownNutritionProvenance(timestamp, 'Custom meal nutrition'),
          capturedAt: timestamp,
        },
      }
    }
    if (!next) {
      setError(`Choose a ${sourceType === 'custom' ? 'custom food name' : `${sourceType} item`} before saving.`)
      return
    }
    if (servings < 0 || prepared < 0) {
      setError('Serving counts cannot be negative.')
      return
    }
    onSave(next)
  }

  return (
    <Modal
      open={open}
      title={meal ? `Edit ${target.slot}` : `Plan ${target.slot}`}
      description={formatDate(target.date, { weekday: 'long', month: 'long', day: 'numeric' })}
      onClose={onClose}
    >
      <div className="meal-editor">
        <SegmentedControl
          label="Meal source"
          value={sourceType}
          onChange={(value) => changeType(value as MealSourceType)}
          options={[
            { value: 'recipe', label: 'Recipe' },
            { value: 'packaged', label: 'Packaged' },
            { value: 'custom', label: 'Custom' },
            { value: 'leftover', label: 'Leftover' },
          ]}
        />
        {sourceType === 'recipe' ? (
          <Field label="Saved recipe">
            <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
              <option value="">Choose a recipe</option>
              {data.recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                  {recipe.needsReview ? ' — Needs Review' : ''}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {sourceType === 'packaged' ? (
          <Field label="Packaged food">
            <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
              <option value="">Choose packaged food</option>
              {data.packagedFoods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {sourceType === 'leftover' ? (
          <Field label="Available leftovers">
            <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
              <option value="">Choose a leftover</option>
              {data.leftovers
                .filter((item) => item.servingsRemaining > 0)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sourceSnapshot.name} — {item.servingsRemaining} left
                  </option>
                ))}
            </select>
          </Field>
        ) : null}
        {sourceType === 'custom' ? (
          <>
            <Field label="Custom food name">
              <input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="Cafe soup and bread"
              />
            </Field>
            <div className="nutrition-editor-grid">
              {(['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium'] as const).map((key) => (
                <Field key={key} label={`${key[0]?.toUpperCase()}${key.slice(1)} per serving`}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={nutrition[key]}
                    onChange={(event) => setNutrition({ ...nutrition, [key]: Number(event.target.value) })}
                  />
                </Field>
              ))}
            </div>
          </>
        ) : null}
        <div className="form-grid__split">
          <Field label="Servings planned">
            <input
              type="number"
              min="0.25"
              step="0.25"
              value={servings}
              onChange={(event) => setServings(Number(event.target.value))}
            />
          </Field>
          <Field label="Servings prepared">
            <input
              type="number"
              min="0"
              step="0.25"
              value={prepared}
              onChange={(event) => setPrepared(Number(event.target.value))}
            />
          </Field>
        </div>
        {error ? (
          <div className="inline-alert" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}
        <div className="modal__actions">
          <button className="button button--quiet" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button button--primary" type="button" onClick={save}>
            {meal ? 'Save meal' : 'Plan meal'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
