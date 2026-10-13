import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { Card, Field } from '../../components/ui'
import { convertForSystem } from '../../domain/measurements'
import { formatQuantity, scaledIngredients } from '../../domain/recipe'
import type { Recipe } from '../../domain/types'
import { useCookingWakeLock } from './hooks/useCookingWakeLock'
import '../../styles/cooking.css'

export default function CookingPage() {
  const { recipeId } = useParams()
  const [params] = useSearchParams()
  const { data } = useApp()
  const recipe = data.recipes.find((item) => item.id === recipeId)
  if (!recipe)
    return (
      <Card>
        <h1>Recipe unavailable</h1>
        <p>This recipe may have been removed. Choose another recipe to cook.</p>
        <Link to="/food">Back to Food</Link>
      </Card>
    )
  const requested = Number(params.get('servings'))
  const initialServings =
    Number.isFinite(requested) && requested >= 0.25 && requested <= 1000
      ? requested
      : (recipe.currentYield ?? recipe.originalYield)
  return <CookingSession key={`${recipe.id}:${initialServings}`} recipe={recipe} initialServings={initialServings} />
}

function CookingSession({ recipe, initialServings }: { recipe: Recipe; initialServings: number }) {
  const { data } = useApp()
  const [servings, setServings] = useState(initialServings)
  const [step, setStep] = useState(0)
  const [checked, setChecked] = useState<string[]>([])
  const [awake, setAwake] = useState(false)
  const wakeStatus = useCookingWakeLock(awake)
  const ingredients = scaledIngredients(recipe, servings)
  const currentStep = Math.min(step, Math.max(0, recipe.steps.length - 1))
  return (
    <div className="cooking-mode">
      <header className="cooking-toolbar">
        <Link className="button button--secondary" to={`/food/recipes/${recipe.id}`}>
          Exit cooking mode
        </Link>
        <label>
          <input type="checkbox" checked={awake} onChange={(event) => setAwake(event.target.checked)} /> Keep screen
          awake
        </label>
        <p role="status">{wakeStatus}</p>
      </header>
      <h1>{recipe.name}</h1>
      <p>
        {recipe.prepMinutes} min prep · {recipe.cookMinutes} min cook. Cooking progress is temporary and does not mark
        meals as eaten.
      </p>
      {recipe.needsReview ? (
        <p role="note">
          Needs review: {recipe.reviewNotes || 'Check imported quantities and instructions before cooking.'}
        </p>
      ) : null}
      <Field label="Cooking servings">
        <input
          type="number"
          min="0.25"
          max="1000"
          step="0.25"
          value={servings}
          onChange={(event) => {
            const value = event.target.valueAsNumber
            if (Number.isFinite(value) && value >= 0.25 && value <= 1000) {
              setServings(value)
              setChecked([])
            }
          }}
        />
      </Field>
      <div className="cooking-grid">
        <Card>
          <h2>Ingredients</h2>
          <p>Check off ingredients as you use them.</p>
          {ingredients.length ? (
            <ul className="cooking-ingredients">
              {ingredients.map((item) => {
                const converted =
                  item.quantity === null
                    ? null
                    : convertForSystem(item.quantity, item.unit, data.settings.measurementSystem)
                return (
                  <li key={item.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={checked.includes(item.id)}
                        onChange={(event) =>
                          setChecked(
                            event.target.checked ? [...checked, item.id] : checked.filter((id) => id !== item.id),
                          )
                        }
                      />
                      <span>
                        <strong>{item.name}</strong> —{' '}
                        {item.quantity === null
                          ? 'Quantity not provided'
                          : `${formatQuantity(converted?.value ?? item.quantity)} ${converted?.unit ?? item.unit}`}
                        {item.note ? ` · ${item.note}` : ''}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p>No ingredients saved. Add them in Edit recipe.</p>
          )}
        </Card>
        <Card>
          <h2>Method</h2>
          {recipe.steps.length ? (
            <>
              <div aria-live="polite" aria-atomic="true">
                <h3>
                  Step {currentStep + 1} of {recipe.steps.length}
                </h3>
                <p className="cooking-instruction">{recipe.steps[currentStep]?.text}</p>
              </div>
              <div className="cooking-navigation">
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={currentStep === 0}
                  onClick={() => setStep(currentStep - 1)}
                >
                  Previous step
                </button>
                <button
                  type="button"
                  className="button button--primary"
                  disabled={currentStep === recipe.steps.length - 1}
                  onClick={() => setStep(currentStep + 1)}
                >
                  Next step
                </button>
              </div>
              {currentStep === recipe.steps.length - 1 ? (
                <p>Last step — enjoy your meal! Log it in your meal plan when you eat.</p>
              ) : null}
              <details>
                <summary>Show all steps</summary>
                <ol>
                  {recipe.steps.map((item) => (
                    <li key={item.id}>{item.text}</li>
                  ))}
                </ol>
              </details>
            </>
          ) : (
            <p>No instructions saved. Add them in Edit recipe before cooking.</p>
          )}
        </Card>
      </div>
      {recipe.notes ? (
        <Card>
          <h2>Recipe notes</h2>
          <p className="cooking-notes">{recipe.notes}</p>
        </Card>
      ) : null}
    </div>
  )
}
