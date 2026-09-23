import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  Clock3,
  Edit3,
  ExternalLink,
  Minus,
  Plus,
  Scale,
  ShieldCheck,
  StickyNote,
} from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { Card, Field, Modal, StatusBadge } from '../../components/ui'
import { upsertMealWithLeftover } from '../../domain/mealWorkflow'
import { convertForSystem } from '../../domain/measurements'
import { formatQuantity, scaledIngredients } from '../../domain/recipe'
import type { MealEntry, MealSlot, Recipe } from '../../domain/types'
import { makeId, toLocalDate } from '../../utilities/date'
import RecipeEditor from './RecipeEditor'
import { resolveFoodImage } from './fileImages'
import '../../styles/food-v2.css'

export default function RecipePage() {
  const { recipeId } = useParams()
  const { data, updateData } = useApp()
  const recipe = data.recipes.find((item) => item.id === recipeId)
  const [servings, setServings] = useState(recipe?.currentYield ?? recipe?.originalYield ?? 1)
  const [planOpen, setPlanOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  if (!recipe) return <Navigate replace to="/food" />
  const ingredients = scaledIngredients(recipe, servings)

  const setCurrentYield = (value: number) => {
    const safe = Math.max(0.25, value)
    setServings(safe)
    updateData((previous) => ({
      ...previous,
      recipes: previous.recipes.map((item) =>
        item.id === recipe.id ? { ...item, currentYield: safe, updatedAt: new Date().toISOString() } : item,
      ),
    }))
  }

  const saveRecipe = (next: Recipe) => {
    updateData(
      (previous) => ({ ...previous, recipes: previous.recipes.map((item) => (item.id === next.id ? next : item)) }),
      next.needsReview
        ? 'Recipe corrections saved; this draft still needs review.'
        : 'Recipe corrections saved and review status confirmed.',
    )
    setServings(next.currentYield ?? next.originalYield)
    setEditOpen(false)
  }

  const addToPlan = (form: HTMLFormElement) => {
    const values = new FormData(form)
    const timestamp = new Date().toISOString()
    const plannedServings = Number(values.get('servings'))
    const preparedServings = Number(values.get('preparedServings'))
    const entry: MealEntry = {
      id: makeId('meal'),
      createdAt: timestamp,
      updatedAt: timestamp,
      source: 'manual',
      date: String(values.get('date')),
      slot: String(values.get('slot')) as MealSlot,
      recipeId: recipe.id,
      servings: plannedServings,
      preparedServings,
      consumedServings: Math.min(plannedServings, preparedServings),
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
    updateData(
      (previous) => upsertMealWithLeftover(previous, entry, timestamp),
      `${recipe.name} added to your meal plan.`,
    )
    setPlanOpen(false)
  }

  return (
    <>
      <div className="recipe-detail-toolbar">
        <Link className="back-link" to="/food">
          <ArrowLeft aria-hidden="true" /> Back to recipes
        </Link>
        <button className="button button--secondary" type="button" onClick={() => setEditOpen(true)}>
          <Edit3 aria-hidden="true" /> Edit recipe
        </button>
      </div>
      {recipe.needsReview ? (
        <section className="review-banner recipe-review-banner" aria-label="Recipe needs review">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Needs Review</strong>
            <p>
              {recipe.reviewNotes ||
                'Check imported ingredients, quantities, steps, yield, and nutrition before using this recipe as a trusted source.'}
            </p>
          </div>
          <button className="button button--secondary" type="button" onClick={() => setEditOpen(true)}>
            Correct draft
          </button>
        </section>
      ) : null}
      <div className={`recipe-hero ${resolveFoodImage(recipe.image) ? '' : 'recipe-hero--no-image'}`}>
        {resolveFoodImage(recipe.image) ? (
          <img src={resolveFoodImage(recipe.image)} alt="" width="920" height="613" fetchPriority="high" />
        ) : null}
        <div className="recipe-hero__content">
          <div className="badge-row">
            <StatusBadge tone="food">{recipe.category}</StatusBadge>
            {recipe.tags.map((tag) => (
              <StatusBadge key={tag}>{tag}</StatusBadge>
            ))}
            {recipe.nutritionProvenance.estimated ? (
              <StatusBadge tone="attention">Estimated nutrition</StatusBadge>
            ) : null}
          </div>
          <h1>{recipe.name}</h1>
          <p>{recipe.description || 'No recipe description has been added yet.'}</p>
          <div className="recipe-facts">
            <span>
              <Clock3 aria-hidden="true" />
              <strong>{recipe.prepMinutes + recipe.cookMinutes} min</strong>
              <small>
                {recipe.prepMinutes} prep · {recipe.cookMinutes} cook
              </small>
            </span>
            <span>
              <ShieldCheck aria-hidden="true" />
              <strong>{recipe.nutritionPerServing.protein} g</strong>
              <small>Protein / serving</small>
            </span>
            <span>
              <Scale aria-hidden="true" />
              <strong>{recipe.originalYield}</strong>
              <small>Original yield</small>
            </span>
          </div>
          <div className="recipe-hero__actions">
            <button className="button button--primary" type="button" onClick={() => setPlanOpen(true)}>
              <CalendarPlus aria-hidden="true" /> Add to meal plan
            </button>
            {recipe.sourceUrl ? (
              <a className="button recipe-source-link" href={recipe.sourceUrl} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" /> View source
              </a>
            ) : null}
          </div>
          <small className="recipe-source-label">Source: {recipe.sourceLabel}</small>
        </div>
      </div>
      <div className="recipe-detail-grid">
        <Card className="ingredient-card">
          <div className="ingredient-card__header">
            <div>
              <h2>Ingredients</h2>
              <p>
                Displaying {data.settings.measurementSystem === 'metric' ? 'metric' : 'US'} units where a safe
                compatible conversion exists. Manual overrides apply at exactly {servings} servings.
              </p>
            </div>
            <div className="yield-stepper" aria-label="Recipe servings">
              <button type="button" aria-label="Decrease servings" onClick={() => setCurrentYield(servings - 1)}>
                <Minus aria-hidden="true" />
              </button>
              <span>
                <strong>{servings}</strong>
                <small>current yield</small>
              </span>
              <button type="button" aria-label="Increase servings" onClick={() => setCurrentYield(servings + 1)}>
                <Plus aria-hidden="true" />
              </button>
            </div>
          </div>
          <ul className="ingredient-list">
            {ingredients.map((ingredient) => {
              const converted =
                ingredient.quantity === null
                  ? null
                  : convertForSystem(ingredient.quantity, ingredient.unit, data.settings.measurementSystem)
              const display =
                converted ??
                (ingredient.quantity === null ? null : { value: ingredient.quantity, unit: ingredient.unit })
              const overridden =
                ingredient.scaledOverride && Math.abs(ingredient.scaledOverride.yield - servings) < 0.0001
              return (
                <li key={ingredient.id}>
                  <span>{display ? `${formatQuantity(display.value)} ${display.unit}` : 'Quantity not provided'}</span>
                  <strong>{ingredient.name}</strong>
                  <small>
                    {[ingredient.note, overridden ? 'Manual scaled override' : ''].filter(Boolean).join(' · ')}
                  </small>
                </li>
              )
            })}
          </ul>
        </Card>
        <Card className="steps-card">
          <h2>Method</h2>
          <ol>
            {recipe.steps.map((step, index) => (
              <li key={step.id}>
                <span>{index + 1}</span>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
      {recipe.notes ? (
        <Card className="recipe-notes">
          <span className="section-icon section-icon--yellow">
            <StickyNote aria-hidden="true" />
          </span>
          <div>
            <h2>Notes</h2>
            <p>{recipe.notes}</p>
          </div>
        </Card>
      ) : null}
      <Card className="recipe-nutrition-detail">
        <div className="library-intro">
          <div>
            <h2>Nutrition per serving</h2>
            <p>
              {recipe.nutritionProvenance.sourceLabel || recipe.nutritionProvenance.kind} · captured{' '}
              {new Date(recipe.nutritionProvenance.capturedAt).toLocaleDateString()}
            </p>
          </div>
          <StatusBadge tone={recipe.nutritionProvenance.estimated ? 'attention' : 'success'}>
            {recipe.nutritionProvenance.estimated ? 'Estimated' : 'Recorded'}
          </StatusBadge>
        </div>
        <dl>
          {Object.entries(recipe.nutritionPerServing).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>
                {value} {key === 'calories' ? 'kcal' : key === 'sodium' ? 'mg' : 'g'}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
      <Modal
        open={planOpen}
        title="Add to meal plan"
        description={`Plan ${recipe.name} and preserve the intended serving count.`}
        onClose={() => setPlanOpen(false)}
      >
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault()
            addToPlan(event.currentTarget)
          }}
        >
          <Field label="Date">
            <input name="date" type="date" defaultValue={toLocalDate(new Date())} required />
          </Field>
          <Field label="Meal">
            <select name="slot" defaultValue="dinner">
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </Field>
          <div className="form-grid__split">
            <Field label="Servings to eat">
              <input name="servings" type="number" min="0.25" step="0.25" defaultValue={servings} required />
            </Field>
            <Field label="Prepared servings">
              <input name="preparedServings" type="number" min="0" step="0.25" defaultValue={servings} required />
            </Field>
          </div>
          <div className="modal__actions">
            <button className="button button--quiet" type="button" onClick={() => setPlanOpen(false)}>
              Cancel
            </button>
            <button className="button button--primary" type="submit">
              Add to plan
            </button>
          </div>
        </form>
      </Modal>
      <RecipeEditor
        open={editOpen}
        recipe={recipe}
        packagedFoods={data.packagedFoods}
        onClose={() => setEditOpen(false)}
        onSave={saveRecipe}
      />
    </>
  )
}
