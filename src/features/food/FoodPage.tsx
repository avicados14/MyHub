import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  ChefHat,
  ClipboardList,
  Copy,
  Heart,
  Import,
  Lock,
  LockOpen,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { Card, EmptyState, PageHeader, ProgressBar, SegmentedControl, StatusBadge } from '../../components/ui'
import { createMealSuggestions, type MealSuggestion } from '../../domain/mealSuggestions'
import { logMealConsumption, moveOrCopyMeal, syncLeftoverForMeal } from '../../domain/mealWorkflow'
import { sumNutrition } from '../../domain/recipe'
import type { AppData, FoodLogEntry, MealEntry, MealSlot, PackagedFood, Recipe } from '../../domain/types'
import { addDays, formatDate, makeId, startOfWeek, toLocalDate } from '../../utilities/date'
import FoodLogEditor from './FoodLogEditor'
import MealEditor from './MealEditor'
import PackagedFoodEditor from './PackagedFoodEditor'
import RecipeEditor from './RecipeEditor'
import RecipeImporter from './RecipeImporter'
import { resolveFoodImage } from './fileImages'
import '../../styles/food-v2.css'

const mealSlots: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
const nutritionMetrics = [
  { key: 'calories' as const, label: 'Calories', unit: 'kcal', tone: 'pink' as const },
  { key: 'protein' as const, label: 'Protein', unit: 'g', tone: 'blue' as const },
  { key: 'carbs' as const, label: 'Carbs', unit: 'g', tone: 'yellow' as const },
  { key: 'fat' as const, label: 'Fat', unit: 'g', tone: 'mint' as const },
  { key: 'fiber' as const, label: 'Fiber', unit: 'g', tone: 'mint' as const },
  { key: 'sodium' as const, label: 'Sodium', unit: 'mg', tone: 'blue' as const },
]

export default function FoodPage() {
  const { data, updateData } = useApp()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') ?? 'recipes'
  const [query, setQuery] = useState('')
  const [recipeOpen, setRecipeOpen] = useState(false)
  const [recipeImportOpen, setRecipeImportOpen] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | undefined>()
  const [packageOpen, setPackageOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<PackagedFood | undefined>()
  const [mealOpen, setMealOpen] = useState(false)
  const [editingMeal, setEditingMeal] = useState<MealEntry | undefined>()
  const [initialMealSource, setInitialMealSource] = useState<{ type: 'leftover'; id: string } | undefined>()
  const [foodOpen, setFoodOpen] = useState(false)
  const [mealTarget, setMealTarget] = useState<{ date: string; slot: MealSlot }>({
    date: toLocalDate(new Date()),
    slot: 'dinner',
  })
  const weekStart = startOfWeek(new Date())
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const filteredRecipes = data.recipes.filter((recipe) =>
    `${recipe.name} ${recipe.category} ${recipe.tags.join(' ')} ${recipe.sourceLabel}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  const saveRecipe = (recipe: Recipe) => {
    updateData(
      (previous) => ({
        ...previous,
        recipes: previous.recipes.some((item) => item.id === recipe.id)
          ? previous.recipes.map((item) => (item.id === recipe.id ? recipe : item))
          : [...previous.recipes, recipe],
      }),
      recipe.needsReview ? 'Recipe draft saved. Review and correct it before relying on quantities.' : 'Recipe saved.',
    )
    setRecipeOpen(false)
    setEditingRecipe(undefined)
  }

  const openImportedDraft = (recipe: Recipe) => {
    updateData(
      (previous) => ({ ...previous, recipes: [...previous.recipes, recipe] }),
      'Import saved as a Needs Review draft.',
    )
    setRecipeImportOpen(false)
    setEditingRecipe(recipe)
    setRecipeOpen(true)
  }

  const savePackage = (food: PackagedFood) => {
    updateData(
      (previous) => ({
        ...previous,
        packagedFoods: previous.packagedFoods.some((item) => item.id === food.id)
          ? previous.packagedFoods.map((item) => (item.id === food.id ? food : item))
          : [...previous.packagedFoods, food],
      }),
      'Packaged food saved locally. No data was written to Open Food Facts.',
    )
    setPackageOpen(false)
    setEditingPackage(undefined)
  }

  const saveMeal = (meal: MealEntry) => {
    updateData((previous) => {
      const meals = previous.meals.some((item) => item.id === meal.id)
        ? previous.meals.map((item) => (item.id === meal.id ? meal : item))
        : [...previous.meals.filter((item) => !(item.date === meal.date && item.slot === meal.slot)), meal]
      return syncLeftoverForMeal({ ...previous, meals }, meal, new Date().toISOString())
    }, `${meal.sourceSnapshot.name} planned. Nutrition will count only when consumed servings are recorded.`)
    setMealOpen(false)
    setEditingMeal(undefined)
  }

  const saveLog = (entry: FoodLogEntry, leftoverUse?: { id: string; servings: number }) => {
    updateData(
      (previous) => ({
        ...previous,
        foodLog: [...previous.foodLog, entry],
        leftovers: leftoverUse
          ? previous.leftovers.flatMap((leftover) =>
              leftover.id !== leftoverUse.id
                ? [leftover]
                : leftover.servingsRemaining > leftoverUse.servings
                  ? [
                      {
                        ...leftover,
                        servingsRemaining: leftover.servingsRemaining - leftoverUse.servings,
                        updatedAt: entry.updatedAt,
                      },
                    ]
                  : [],
            )
          : previous.leftovers,
      }),
      `${entry.name} logged as consumed nutrition.`,
    )
    setFoodOpen(false)
  }

  const openMeal = (date: string, slot: MealSlot, meal?: MealEntry) => {
    setMealTarget({ date, slot })
    setEditingMeal(meal)
    setInitialMealSource(undefined)
    setMealOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Food"
        description="Build trustworthy recipes, plan what you will prepare, and log only what you actually consume."
        action={
          <div className="page-action-group">
            <button className="button button--secondary" type="button" onClick={() => setRecipeImportOpen(true)}>
              <Import aria-hidden="true" /> Import recipe
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={() => {
                setEditingRecipe(undefined)
                setRecipeOpen(true)
              }}
            >
              <Plus aria-hidden="true" /> Add recipe
            </button>
          </div>
        }
      />
      <div className="subnav-row food-subnav">
        <SegmentedControl
          label="Food view"
          options={[
            { value: 'recipes', label: 'Recipes' },
            { value: 'planner', label: 'Meal planner' },
            { value: 'packages', label: 'Packaged foods' },
            { value: 'nutrition', label: 'Nutrition' },
          ]}
          value={view}
          onChange={(value) => setParams({ view: value })}
        />
        {view === 'nutrition' ? (
          <button className="button button--accent" type="button" onClick={() => setFoodOpen(true)}>
            <Plus aria-hidden="true" /> Log food
          </button>
        ) : null}
        {view === 'packages' ? (
          <button
            className="button button--accent"
            type="button"
            onClick={() => {
              setEditingPackage(undefined)
              setPackageOpen(true)
            }}
          >
            <Plus aria-hidden="true" /> Add packaged food
          </button>
        ) : null}
      </div>

      {view === 'recipes' ? (
        <RecipesView
          recipes={filteredRecipes}
          query={query}
          setQuery={setQuery}
          data={data}
          updateData={updateData}
          onAdd={() => {
            setEditingRecipe(undefined)
            setRecipeOpen(true)
          }}
          onImport={() => setRecipeImportOpen(true)}
          onEdit={(recipe) => {
            setEditingRecipe(recipe)
            setRecipeOpen(true)
          }}
        />
      ) : null}
      {view === 'planner' ? (
        <PlannerView
          days={weekDays}
          data={data}
          onAdd={openMeal}
          onPlanLeftover={(id, target) => {
            setMealTarget(target)
            setEditingMeal(undefined)
            setInitialMealSource({ type: 'leftover', id })
            setMealOpen(true)
          }}
          updateData={updateData}
        />
      ) : null}
      {view === 'packages' ? (
        <PackagesView
          data={data}
          onAdd={() => {
            setEditingPackage(undefined)
            setPackageOpen(true)
          }}
          onEdit={(food) => {
            setEditingPackage(food)
            setPackageOpen(true)
          }}
        />
      ) : null}
      {view === 'nutrition' ? <NutritionView data={data} onLog={() => setFoodOpen(true)} /> : null}

      <RecipeEditor
        open={recipeOpen}
        recipe={editingRecipe}
        onClose={() => {
          setRecipeOpen(false)
          setEditingRecipe(undefined)
        }}
        onSave={saveRecipe}
      />
      <RecipeImporter open={recipeImportOpen} onClose={() => setRecipeImportOpen(false)} onDraft={openImportedDraft} />
      <PackagedFoodEditor
        open={packageOpen}
        food={editingPackage}
        onClose={() => {
          setPackageOpen(false)
          setEditingPackage(undefined)
        }}
        onSave={savePackage}
      />
      <MealEditor
        open={mealOpen}
        data={data}
        target={mealTarget}
        meal={editingMeal}
        initialSource={initialMealSource}
        onClose={() => {
          setMealOpen(false)
          setEditingMeal(undefined)
          setInitialMealSource(undefined)
        }}
        onSave={saveMeal}
      />
      <FoodLogEditor
        open={foodOpen}
        data={data}
        onClose={() => setFoodOpen(false)}
        onSave={saveLog}
        onCreatePackage={() => {
          setFoodOpen(false)
          setPackageOpen(true)
        }}
      />
    </>
  )
}

function RecipesView({
  recipes,
  query,
  setQuery,
  data,
  updateData,
  onAdd,
  onImport,
  onEdit,
}: {
  recipes: Recipe[]
  query: string
  setQuery: (value: string) => void
  data: AppData
  updateData: ReturnType<typeof useApp>['updateData']
  onAdd: () => void
  onImport: () => void
  onEdit: (recipe: Recipe) => void
}) {
  return (
    <>
      <div className="filter-bar">
        <Search aria-hidden="true" />
        <label className="sr-only" htmlFor="recipe-search">
          Search recipes
        </label>
        <input
          id="recipe-search"
          type="search"
          autoComplete="off"
          placeholder="Search recipes, sources, or tags…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span>{recipes.length} recipes</span>
      </div>
      <div className="recipe-grid">
        {recipes.map((recipe) => (
          <article className="recipe-card" key={recipe.id}>
            {resolveFoodImage(recipe.image) ? (
              <Link to={`/food/recipes/${recipe.id}`} className="recipe-card__image">
                <img src={resolveFoodImage(recipe.image)} alt="" width="460" height="307" loading="lazy" />
              </Link>
            ) : (
              <Link to={`/food/recipes/${recipe.id}`} className="recipe-card__image recipe-card__placeholder">
                <ChefHat aria-hidden="true" />
              </Link>
            )}
            <div className="recipe-card__body">
              <div className="recipe-card__meta">
                <div className="badge-row">
                  <StatusBadge tone="food">{recipe.category}</StatusBadge>
                  {recipe.needsReview ? <StatusBadge tone="attention">Needs Review</StatusBadge> : null}
                </div>
                <button
                  className={recipe.favorite ? 'icon-button is-favorite' : 'icon-button'}
                  type="button"
                  aria-label={`${recipe.favorite ? 'Remove' : 'Add'} ${recipe.name} ${recipe.favorite ? 'from' : 'to'} favorites`}
                  onClick={() =>
                    updateData(
                      {
                        ...data,
                        recipes: data.recipes.map((item) =>
                          item.id === recipe.id ? { ...item, favorite: !item.favorite } : item,
                        ),
                      },
                      recipe.favorite ? 'Removed from favorites.' : 'Added to favorites.',
                    )
                  }
                >
                  <Heart aria-hidden="true" fill={recipe.favorite ? 'currentColor' : 'none'} />
                </button>
              </div>
              <Link to={`/food/recipes/${recipe.id}`}>
                <h2>{recipe.name}</h2>
              </Link>
              <p>{recipe.description || 'No description yet. Open the recipe to add context and notes.'}</p>
              <div className="recipe-card__footer">
                <span>{recipe.prepMinutes + recipe.cookMinutes} min</span>
                <span>{recipe.currentYield ?? recipe.originalYield} servings</span>
                <button type="button" onClick={() => onEdit(recipe)}>
                  Edit
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!recipes.length ? (
        <EmptyState
          title={query ? 'No matching recipes' : 'Your recipe shelf is ready'}
          detail={
            query
              ? 'Try another search or clear the filter.'
              : 'Create a structured recipe or bring in a reviewable draft from a URL, paste, screenshot, caption, or local video frame.'
          }
          action={
            !query ? (
              <div className="empty-actions">
                <button className="button button--primary" type="button" onClick={onAdd}>
                  <Plus aria-hidden="true" /> Create recipe
                </button>
                <button className="button button--secondary" type="button" onClick={onImport}>
                  <Import aria-hidden="true" /> Import draft
                </button>
              </div>
            ) : undefined
          }
        />
      ) : null}
    </>
  )
}

function PackagesView({
  data,
  onAdd,
  onEdit,
}: {
  data: AppData
  onAdd: () => void
  onEdit: (food: PackagedFood) => void
}) {
  return (
    <div className="package-library">
      <div className="library-intro">
        <div>
          <h2>Packaged food library</h2>
          <p>
            Manual packages and confirmed read-only imports can be planned or logged without changing their original
            nutrition snapshot.
          </p>
        </div>
        <StatusBadge tone="lilac">{data.packagedFoods.length} saved</StatusBadge>
      </div>
      {data.packagedFoods.length ? (
        <div className="package-grid">
          {data.packagedFoods.map((food) => (
            <Card className="package-card" as="article" key={food.id}>
              {resolveFoodImage(food.image) ? (
                <img src={resolveFoodImage(food.image)} alt="" />
              ) : (
                <span className="package-card__icon">
                  <Box aria-hidden="true" />
                </span>
              )}
              <div>
                <div className="badge-row">
                  <StatusBadge tone={food.nutritionProvenance.estimated ? 'attention' : 'food'}>
                    {food.nutritionProvenance.estimated ? 'Imported / estimated' : food.nutritionProvenance.kind}
                  </StatusBadge>
                </div>
                <h3>{food.name}</h3>
                <p>
                  {food.brand || 'Brand not recorded'} · {food.servingSize.quantity} {food.servingSize.unit}
                </p>
                <dl>
                  <div>
                    <dt>Calories</dt>
                    <dd>{food.nutritionPerServing.calories}</dd>
                  </div>
                  <div>
                    <dt>Protein</dt>
                    <dd>{food.nutritionPerServing.protein} g</dd>
                  </div>
                  <div>
                    <dt>Sodium</dt>
                    <dd>{food.nutritionPerServing.sodium} mg</dd>
                  </div>
                </dl>
                <button className="button button--secondary button--full" type="button" onClick={() => onEdit(food)}>
                  Edit package
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No packaged foods saved"
          detail="Enter a package manually, use a read-only Open Food Facts barcode lookup, or scan a label locally and confirm every value."
          action={
            <button className="button button--primary" type="button" onClick={onAdd}>
              <PackageSearch aria-hidden="true" /> Add packaged food
            </button>
          }
        />
      )}
    </div>
  )
}

function PlannerView({
  days,
  data,
  onAdd,
  onPlanLeftover,
  updateData,
}: {
  days: Date[]
  data: AppData
  onAdd: (date: string, slot: MealSlot, meal?: MealEntry) => void
  onPlanLeftover: (id: string, target: { date: string; slot: MealSlot }) => void
  updateData: ReturnType<typeof useApp>['updateData']
}) {
  const [generation, setGeneration] = useState(0)
  const [locked, setLocked] = useState<Set<string>>(() => new Set())
  const targets = useMemo(
    () =>
      days.flatMap((day) =>
        data.settings.mealPlanning.preferredSlots.map((slot) => ({ date: toLocalDate(day), slot })),
      ),
    [data.settings.mealPlanning.preferredSlots, days],
  )
  const suggestions = useMemo(
    () => createMealSuggestions(data, targets, locked, generation),
    [data, generation, locked, targets],
  )

  const acceptSuggestion = (suggestion: MealSuggestion) => {
    const timestamp = new Date().toISOString()
    const base = {
      id: makeId('meal'),
      createdAt: timestamp,
      updatedAt: timestamp,
      source: 'generated' as const,
      date: suggestion.date,
      slot: suggestion.slot,
      servings: 1,
      preparedServings: data.settings.mealPlanning.targetPrepServings,
      consumedServings: 0,
    }
    let meal: MealEntry | undefined
    if (suggestion.sourceType === 'recipe') {
      const recipe = data.recipes.find((item) => item.id === suggestion.sourceId)
      if (recipe)
        meal = {
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
    } else {
      const leftover = data.leftovers.find((item) => item.id === suggestion.sourceId)
      if (leftover)
        meal = {
          ...base,
          leftoverId: leftover.id,
          preparedServings: Math.min(1, leftover.servingsRemaining),
          sourceSnapshot: {
            ...leftover.sourceSnapshot,
            sourceType: 'leftover',
            sourceId: leftover.id,
            capturedAt: timestamp,
          },
        }
    }
    if (meal)
      updateData(
        (previous) => ({
          ...previous,
          meals: [...previous.meals.filter((item) => !(item.date === meal.date && item.slot === meal.slot)), meal],
        }),
        `${meal.sourceSnapshot.name} accepted from Smart suggestions.`,
      )
  }

  const shiftMeal = (meal: MealEntry, daysDelta: number, mode: 'move' | 'copy') =>
    updateData(
      (previous) =>
        moveOrCopyMeal(
          previous,
          meal.id,
          { date: toLocalDate(addDays(new Date(`${meal.date}T12:00:00`), daysDelta)), slot: meal.slot },
          mode,
          new Date().toISOString(),
          makeId('meal'),
        ),
      `${mode === 'move' ? 'Moved' : 'Copied'} ${meal.sourceSnapshot.name} ${daysDelta < 0 ? 'back' : 'forward'} one day.`,
    )

  return (
    <div className="planner-stack">
      <Card className="smart-suggestions">
        <div className="smart-suggestions__header">
          <div>
            <span className="suggestion-mark">
              <Sparkles aria-hidden="true" />
            </span>
            <div>
              <h2>Smart suggestions</h2>
              <p>
                Deterministic scoring from saved recipes, pantry, leftovers, and your{' '}
                {data.settings.mealPlanning.mode.replaceAll('-', ' ')} mode. No remote AI is used.
              </p>
            </div>
          </div>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setGeneration((value) => value + 1)}
          >
            <RefreshCw aria-hidden="true" /> Regenerate
          </button>
        </div>
        {suggestions.length ? (
          <div className="suggestion-list">
            {suggestions.slice(0, 5).map((suggestion) => {
              const key = `${suggestion.date}:${suggestion.slot}`
              const isLocked = locked.has(key)
              return (
                <article key={suggestion.id}>
                  <div>
                    <span>
                      {formatDate(suggestion.date, { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
                      {suggestion.slot}
                    </span>
                    <strong>{suggestion.name}</strong>
                    <small>{suggestion.reasons.join(' · ')}</small>
                  </div>
                  <div>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`${isLocked ? 'Unlock' : 'Lock'} suggestion for ${suggestion.date} ${suggestion.slot}`}
                      onClick={() =>
                        setLocked((current) => {
                          const next = new Set(current)
                          if (next.has(key)) next.delete(key)
                          else next.add(key)
                          return next
                        })
                      }
                    >
                      {isLocked ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
                    </button>
                    <button
                      className="button button--quiet"
                      type="button"
                      disabled={isLocked}
                      onClick={() => setGeneration((value) => value + 1)}
                    >
                      Replace
                    </button>
                    <button
                      className="button button--primary"
                      type="button"
                      onClick={() => acceptSuggestion(suggestion)}
                    >
                      <Check aria-hidden="true" /> Accept
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="suggestion-empty">
            Add a reviewed recipe or available leftover to receive a deterministic proposal.
          </p>
        )}
      </Card>
      <div className="meal-planner">
        <div className="meal-planner__header">
          <div>
            <h2>Week of {formatDate(toLocalDate(days[0] ?? new Date()), { month: 'long', day: 'numeric' })}</h2>
            <p>Planned is not consumed. Record eaten servings below each meal to update nutrition.</p>
          </div>
          <StatusBadge tone="food">{data.meals.length} meals planned</StatusBadge>
        </div>
        <div className="meal-week">
          {days.map((day) => {
            const date = toLocalDate(day)
            return (
              <section key={date} className={date === toLocalDate(new Date()) ? 'meal-day is-today' : 'meal-day'}>
                <header>
                  <span>{formatDate(date, { weekday: 'short' })}</span>
                  <strong>{day.getDate()}</strong>
                </header>
                {mealSlots.map((slot) => {
                  const meal = data.meals.find((entry) => entry.date === date && entry.slot === slot)
                  return (
                    <div className="meal-slot" key={slot}>
                      <span>{slot}</span>
                      {meal ? (
                        <div className="meal-slot__planned">
                          <button type="button" onClick={() => onAdd(date, slot, meal)}>
                            <strong>{meal.sourceSnapshot.name}</strong>
                            <small>
                              {meal.servings} planned · {Math.max(0, meal.preparedServings - meal.consumedServings)}{' '}
                              left
                            </small>
                          </button>
                          <button
                            className="meal-slot__remove"
                            type="button"
                            aria-label={`Remove ${slot} on ${formatDate(date)}`}
                            onClick={() =>
                              updateData(
                                (previous) => ({
                                  ...previous,
                                  meals: previous.meals.filter((entry) => entry.id !== meal.id),
                                  leftovers: previous.leftovers.filter((entry) => entry.sourceMealId !== meal.id),
                                  foodLog: previous.foodLog.filter(
                                    (entry) => entry.sourceSnapshot.sourceId !== `meal:${meal.id}`,
                                  ),
                                }),
                                'Meal removed from the plan.',
                              )
                            }
                          >
                            ×
                          </button>
                          <div className="meal-slot__controls">
                            <button
                              type="button"
                              aria-label={`Move ${meal.sourceSnapshot.name} to previous day`}
                              onClick={() => shiftMeal(meal, -1, 'move')}
                            >
                              <ArrowLeft aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Copy ${meal.sourceSnapshot.name} to next day`}
                              onClick={() => shiftMeal(meal, 1, 'copy')}
                            >
                              <Copy aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move ${meal.sourceSnapshot.name} to next day`}
                              onClick={() => shiftMeal(meal, 1, 'move')}
                            >
                              <ArrowRight aria-hidden="true" />
                            </button>
                          </div>
                          <label className="consumed-control">
                            <span>Consumed</span>
                            <input
                              aria-label={`Consumed servings for ${meal.sourceSnapshot.name}`}
                              type="number"
                              min="0"
                              step="0.25"
                              value={meal.consumedServings}
                              onChange={(event) =>
                                updateData(
                                  (previous) =>
                                    logMealConsumption(
                                      previous,
                                      meal.id,
                                      Number(event.target.value),
                                      new Date().toISOString(),
                                    ),
                                  'Consumed servings updated; nutrition and leftovers recalculated.',
                                )
                              }
                            />
                          </label>
                        </div>
                      ) : (
                        <button className="meal-slot__add" type="button" onClick={() => onAdd(date, slot)}>
                          <Plus aria-hidden="true" /> Add
                        </button>
                      )}
                    </div>
                  )
                })}
              </section>
            )
          })}
        </div>
      </div>
      <Leftovers
        data={data}
        onPlan={(leftoverId) => {
          const target = targets.find(
            (item) => !data.meals.some((meal) => meal.date === item.date && meal.slot === item.slot),
          ) ?? { date: toLocalDate(days[days.length - 1] ?? new Date()), slot: 'dinner' as const }
          onPlanLeftover(leftoverId, target)
        }}
        updateData={updateData}
      />
    </div>
  )
}

function Leftovers({
  data,
  onPlan,
  updateData,
}: {
  data: AppData
  onPlan: (id: string) => void
  updateData: ReturnType<typeof useApp>['updateData']
}) {
  return (
    <Card className="leftover-card">
      <div className="library-intro">
        <div>
          <h2>Leftovers</h2>
          <p>Derived from prepared minus consumed servings. Choose Leftover when adding a later meal.</p>
        </div>
        <StatusBadge tone="lilac">{data.leftovers.length} available</StatusBadge>
      </div>
      {data.leftovers.length ? (
        <div className="leftover-list">
          {data.leftovers.map((leftover) => (
            <article key={leftover.id}>
              <span className="section-icon section-icon--lilac">
                <Archive aria-hidden="true" />
              </span>
              <div>
                <strong>{leftover.sourceSnapshot.name}</strong>
                <small>
                  {leftover.servingsRemaining} servings · {leftover.storageLocation} · prepared{' '}
                  {formatDate(leftover.preparedOn)}
                </small>
              </div>
              <button className="button button--secondary" type="button" onClick={() => onPlan(leftover.id)}>
                Plan later
              </button>
              <button
                className="icon-button icon-button--danger"
                type="button"
                aria-label={`Discard ${leftover.sourceSnapshot.name} leftovers`}
                onClick={() =>
                  updateData(
                    (previous) => ({
                      ...previous,
                      leftovers: previous.leftovers.filter((item) => item.id !== leftover.id),
                    }),
                    'Leftover removed.',
                  )
                }
              >
                <Trash2 aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No leftovers waiting"
          detail="When prepared servings exceed consumed servings, MyHub creates or updates a leftover record here."
        />
      )}
    </Card>
  )
}

function NutritionView({ data, onLog }: { data: AppData; onLog: () => void }) {
  const today = toLocalDate(new Date())
  const entries = data.foodLog.filter((entry) => entry.date === today)
  const total = sumNutrition(entries.map((entry) => entry.nutritionSnapshot))
  return (
    <div className="nutrition-layout">
      <Card className="nutrition-summary">
        <div className="nutrition-summary__lead">
          <UtensilsCrossed aria-hidden="true" />
          <div>
            <span>Consumed today</span>
            <strong>
              {Math.round(total.calories).toLocaleString()} <small>kcal</small>
            </strong>
            <p>Only consumed meals and food-log entries contribute.</p>
          </div>
        </div>
        <div className="nutrition-metrics">
          {nutritionMetrics.map((metric) => {
            const goal = data.settings.nutritionTargets[metric.key]
            const remaining = Math.max(0, goal - total[metric.key])
            return (
              <div key={metric.key} className="nutrition-metric">
                <div>
                  <span>{metric.label}</span>
                  <strong>
                    {Math.round(total[metric.key])} <small>{metric.unit}</small>
                  </strong>
                </div>
                <ProgressBar
                  value={total[metric.key]}
                  max={goal}
                  label={`${metric.label} progress`}
                  tone={metric.tone}
                />
                <dl>
                  <div>
                    <dt>Consumed</dt>
                    <dd>{Math.round(total[metric.key])}</dd>
                  </div>
                  <div>
                    <dt>Goal</dt>
                    <dd>{goal}</dd>
                  </div>
                  <div>
                    <dt>Remaining</dt>
                    <dd>{Math.round(remaining)}</dd>
                  </div>
                </dl>
              </div>
            )
          })}
        </div>
      </Card>
      <Card className="food-log-card">
        <div className="section-heading">
          <div>
            <span className="section-icon section-icon--mint">
              <ClipboardList aria-hidden="true" />
            </span>
            <div>
              <h2>Food log</h2>
              <p>Immutable nutrition and provenance snapshots</p>
            </div>
          </div>
        </div>
        <ul className="food-log-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <span className="section-icon section-icon--mint">
                <ChefHat aria-hidden="true" />
              </span>
              <div>
                <strong>{entry.name}</strong>
                <small>
                  {entry.servings} serving ·{' '}
                  {entry.provenanceSnapshot.estimated ? 'imported / estimated' : entry.provenanceSnapshot.kind}
                </small>
              </div>
              <span>{Math.round(entry.nutritionSnapshot.calories)} kcal</span>
            </li>
          ))}
        </ul>
        {!entries.length ? (
          <EmptyState
            title="Nothing consumed is logged today"
            detail="Log a saved recipe, packaged food, barcode search, nutrition label, custom food, or leftover. Planned meals stay out of nutrition until consumed."
            action={
              <button className="button button--primary" type="button" onClick={onLog}>
                <Plus aria-hidden="true" /> Log consumed food
              </button>
            }
          />
        ) : null}
      </Card>
    </div>
  )
}
