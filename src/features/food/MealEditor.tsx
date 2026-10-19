import { AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Field, Modal, SegmentedControl } from '../../components/ui'
import { estimateContainerPortion } from '../../domain/containerPortion'
import { createUnknownNutritionProvenance } from '../../domain/defaults'
import { remainingServingsForLeftover } from '../../domain/mealWorkflow'
import { createZeroNutrition, NUTRITION_FIELDS } from '../../domain/nutrition'
import type { AppData, MealEntry, MealSlot, Nutrition } from '../../domain/types'
import { formatDate, makeId } from '../../utilities/date'

interface MealEditorProps {
  open: boolean
  data: AppData
  target: { date: string; slot: MealSlot }
  meal?: MealEntry
  initialSource?: { type: MealSourceType; id: string }
  onClose: () => void
  onSave: (meal: MealEntry, options: { autoPlanExtraServings: boolean }) => void
}

type MealSourceType = 'recipe' | 'packaged' | 'custom' | 'leftover'
const ZERO_NUTRITION: Nutrition = createZeroNutrition()

export default function MealEditor({ open, data, target, meal, initialSource, onClose, onSave }: MealEditorProps) {
  const [sourceType, setSourceType] = useState<MealSourceType>('recipe')
  const [sourceId, setSourceId] = useState('')
  const [customName, setCustomName] = useState('')
  const [nutrition, setNutrition] = useState<Nutrition>({ ...ZERO_NUTRITION })
  const [servings, setServings] = useState(1)
  const [prepared, setPrepared] = useState(1)
  const [autoPlanExtra, setAutoPlanExtra] = useState(true)
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
          : data.leftovers.some((item) => item.servingsRemaining > 0)
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
              ? data.leftovers.find((item) => item.servingsRemaining > 0)?.id
              : '') ??
        '',
    )
    setCustomName(meal?.customName ?? '')
    setNutrition(meal ? { ...meal.sourceSnapshot.nutritionPerServing } : { ...ZERO_NUTRITION })
    setServings(meal?.servings ?? 1)
    setPrepared(meal?.preparedServings ?? 1)
    setAutoPlanExtra(meal ? data.meals.some((item) => item.autoPlannedFromMealId === meal.id) : true)
    setError('')
  }, [data.leftovers, data.meals, data.packagedFoods, data.recipes, initialSource, meal, open])

  const changeType = (type: MealSourceType) => {
    setSourceType(type)
    setSourceId(
      type === 'recipe'
        ? (data.recipes[0]?.id ?? '')
        : type === 'packaged'
          ? (data.packagedFoods[0]?.id ?? '')
          : type === 'leftover'
            ? (data.leftovers.find((item) => item.servingsRemaining > 0)?.id ?? '')
            : '',
    )
  }

  const selectedRecipe = sourceType === 'recipe' ? data.recipes.find((item) => item.id === sourceId) : undefined
  const containerEstimate = selectedRecipe ? estimateContainerPortion(selectedRecipe) : null

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
      autoPlannedFromMealId: meal?.autoPlannedFromMealId,
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
      const remaining = leftover ? remainingServingsForLeftover(data, leftover) : 0
      if (leftover)
        next = {
          ...base,
          leftoverId: leftover.id,
          preparedServings: Math.min(prepared, remaining),
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
    if (!Number.isFinite(servings) || servings <= 0 || !Number.isFinite(prepared) || prepared < 0) {
      setError('Enter a positive planned serving amount and a nonnegative prepared amount.')
      return
    }
    onSave(next, {
      autoPlanExtraServings: sourceType !== 'leftover' && autoPlanExtra && prepared > servings,
    })
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
                .filter((item) => remainingServingsForLeftover(data, item) > 0)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sourceSnapshot.name} — {remainingServingsForLeftover(data, item)} left
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
                placeholder="Drink, snack, dessert, or another food"
              />
            </Field>
            <div className="nutrition-editor-grid">
              {NUTRITION_FIELDS.map(({ key, label }) => (
                <Field key={key} label={`${label} per serving`}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={nutrition[key] ?? 0}
                    onChange={(event) => setNutrition({ ...nutrition, [key]: Number(event.target.value) })}
                  />
                </Field>
              ))}
            </div>
          </>
        ) : null}
        {selectedRecipe ? (
          <section className="container-estimate" aria-label="30 oz container estimate">
            <strong>No portion measured? Estimate a 30 oz container</strong>
            {containerEstimate ? (
              <>
                <p>
                  About {containerEstimate.servings} recipe servings per container (rough range{' '}
                  {containerEstimate.servingRange[0]}–{containerEstimate.servingRange[1]}). A recipe serving is 1/
                  {selectedRecipe.originalYield} of the batch.
                </p>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => {
                    setServings(containerEstimate.servings)
                  }}
                >
                  Use container estimate
                </button>
                <details>
                  <summary>How this is estimated</summary>
                  {containerEstimate.assumptions.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </details>
              </>
            ) : (
              <p>
                A 30 US fl oz container holds about 3.75 cups to the rim; aim for about 3.2 cups with lid space. This
                recipe needs a measured portion or cooked batch volume to convert that to servings reliably.
              </p>
            )}
            <p>
              Your entered serving amount takes priority. This estimate never changes the recipe’s yield or nutrition
              per serving.
            </p>
          </section>
        ) : null}
        <div className="form-grid__split">
          <Field label="Servings planned">
            <input
              type="number"
              min="0.01"
              step="any"
              value={servings}
              onChange={(event) => setServings(Number(event.target.value))}
            />
          </Field>
          <Field label="Servings prepared">
            <input
              type="number"
              min="0"
              step="any"
              value={prepared}
              onChange={(event) => setPrepared(Number(event.target.value))}
            />
          </Field>
        </div>
        {sourceType !== 'leftover' && prepared > servings ? (
          <label className="meal-batch-option">
            <input
              type="checkbox"
              checked={autoPlanExtra}
              onChange={(event) => setAutoPlanExtra(event.target.checked)}
            />
            <span>
              <strong>Plan extra portions on future days</strong>
              <small>
                MyHub will add {prepared - servings} extra servings to the next open {target.slot} slots. Recording a
                serving as consumed updates the amount left on every linked day.
              </small>
            </span>
          </label>
        ) : null}
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
