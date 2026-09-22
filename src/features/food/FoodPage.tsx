import { ChefHat, Heart, Plus, Search, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { Card, EmptyState, Field, Modal, PageHeader, ProgressBar, SegmentedControl, StatusBadge } from '../../components/ui'
import { multiplyNutrition, sumNutrition } from '../../domain/recipe'
import type { FoodLogEntry, GroceryCategory, MealEntry, MealSlot, Recipe } from '../../domain/types'
import { addDays, formatDate, makeId, startOfWeek, toLocalDate } from '../../utilities/date'
import { assetUrl } from '../../utilities/assets'

const mealSlots: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

export default function FoodPage() {
  const { data, updateData } = useApp()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') ?? 'recipes'
  const [query, setQuery] = useState('')
  const [recipeOpen, setRecipeOpen] = useState(false)
  const [mealOpen, setMealOpen] = useState(false)
  const [foodOpen, setFoodOpen] = useState(false)
  const [mealTarget, setMealTarget] = useState<{ date: string; slot: MealSlot }>({ date: toLocalDate(new Date()), slot: 'dinner' })
  const weekStart = startOfWeek(new Date())
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const filteredRecipes = data.recipes.filter((recipe) => `${recipe.name} ${recipe.category} ${recipe.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()))

  const addRecipe = (form: HTMLFormElement) => {
    const values = new FormData(form)
    const timestamp = new Date().toISOString()
    const ingredients = String(values.get('ingredients')).split('\n').map((line, index) => {
      const match = line.trim().match(/^([\d.]+)?\s*([a-zA-Z]+)?\s*(.+)$/)
      const name = match?.[3]?.trim() || line.trim()
      return { id: makeId(`ingredient-${index}`), name, canonicalName: name.toLowerCase(), quantity: match?.[1] ? Number(match[1]) : null, unit: match?.[2] ?? '', category: 'Other' as GroceryCategory }
    }).filter((ingredient) => ingredient.name)
    const recipe: Recipe = {
      id: makeId('recipe'), createdAt: timestamp, updatedAt: timestamp, source: 'manual', name: String(values.get('name')),
      description: String(values.get('description')), image: 'recipes/weekday-pasta.jpg', category: String(values.get('category')),
      tags: ['Personal'], favorite: false, originalYield: Number(values.get('yield')), prepMinutes: Number(values.get('prepMinutes')),
      cookMinutes: Number(values.get('cookMinutes')), ingredients,
      steps: String(values.get('steps')).split('\n').filter(Boolean).map((text, index) => ({ id: makeId(`step-${index}`), text })),
      nutritionPerServing: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 },
      sourceLabel: 'Manual recipe', needsReview: ingredients.some((item) => item.quantity === null),
    }
    updateData((previous) => ({ ...previous, recipes: [...previous.recipes, recipe] }), 'Recipe saved. Review any unquantified ingredients before grocery generation.')
    setRecipeOpen(false)
  }

  const addMeal = (form: HTMLFormElement) => {
    const values = new FormData(form)
    const timestamp = new Date().toISOString()
    const recipeId = String(values.get('recipeId'))
    const entry: MealEntry = {
      id: makeId('meal'), createdAt: timestamp, updatedAt: timestamp, source: 'manual', date: mealTarget.date,
      slot: mealTarget.slot, recipeId, servings: Number(values.get('servings')), preparedServings: Number(values.get('preparedServings')), consumedServings: 0,
    }
    updateData((previous) => ({ ...previous, meals: [...previous.meals.filter((meal) => !(meal.date === entry.date && meal.slot === entry.slot)), entry] }), `${mealTarget.slot[0]?.toUpperCase()}${mealTarget.slot.slice(1)} planned.`)
    setMealOpen(false)
  }

  const logFood = (form: HTMLFormElement) => {
    const values = new FormData(form)
    const recipe = data.recipes.find((item) => item.id === values.get('recipeId'))
    const servings = Number(values.get('servings'))
    if (!recipe) return
    const timestamp = new Date().toISOString()
    const entry: FoodLogEntry = { id: makeId('food-log'), createdAt: timestamp, updatedAt: timestamp, source: 'manual', date: String(values.get('date')), name: recipe.name, servings, nutritionSnapshot: multiplyNutrition(recipe.nutritionPerServing, servings), origin: 'recipe' }
    updateData((previous) => ({ ...previous, foodLog: [...previous.foodLog, entry] }), `${recipe.name} added to today’s nutrition.`)
    setFoodOpen(false)
  }

  return (
    <>
      <PageHeader title="Food" description="Plan meals once, then carry servings through nutrition, pantry checks, and groceries." action={<button className="button button--primary" type="button" onClick={() => setRecipeOpen(true)}><Plus aria-hidden="true" /> Add recipe</button>} />
      <div className="subnav-row">
        <SegmentedControl label="Food view" options={[{ value: 'recipes', label: 'Recipes' }, { value: 'planner', label: 'Meal planner' }, { value: 'nutrition', label: 'Nutrition' }]} value={view} onChange={(value) => setParams({ view: value })} />
        {view === 'nutrition' ? <button className="button button--accent" type="button" onClick={() => setFoodOpen(true)}><Plus aria-hidden="true" /> Log food</button> : null}
      </div>

      {view === 'recipes' ? <RecipesView recipes={filteredRecipes} query={query} setQuery={setQuery} data={data} updateData={updateData} /> : null}
      {view === 'planner' ? <PlannerView days={weekDays} data={data} onAdd={(date, slot) => { setMealTarget({ date, slot }); setMealOpen(true) }} updateData={updateData} /> : null}
      {view === 'nutrition' ? <NutritionView data={data} /> : null}

      <Modal open={recipeOpen} title="Add a recipe" description="Enter one ingredient or instruction per line. MyHub never invents missing quantities." onClose={() => setRecipeOpen(false)}>
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); addRecipe(event.currentTarget) }}>
          <Field label="Recipe name"><input name="name" required autoComplete="off" placeholder="Lemon chicken orzo…" /></Field>
          <Field label="Description"><textarea name="description" rows={2} required placeholder="A quick weeknight dinner…" /></Field>
          <div className="form-grid__split"><Field label="Category"><select name="category" defaultValue="Dinner"><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option><option>Dessert</option></select></Field><Field label="Servings"><input name="yield" type="number" min="1" inputMode="numeric" defaultValue="4" required /></Field></div>
          <div className="form-grid__split"><Field label="Prep minutes"><input name="prepMinutes" type="number" min="0" inputMode="numeric" defaultValue="15" required /></Field><Field label="Cook minutes"><input name="cookMinutes" type="number" min="0" inputMode="numeric" defaultValue="30" required /></Field></div>
          <Field label="Ingredients" hint="Example: 1 lb chicken breast"><textarea name="ingredients" rows={5} required placeholder={'1 lb chicken breast…\n2 cup rice…'} /></Field>
          <Field label="Steps"><textarea name="steps" rows={5} required placeholder={'Season the chicken…\nCook until golden…'} /></Field>
          <div className="modal__actions"><button className="button button--quiet" type="button" onClick={() => setRecipeOpen(false)}>Cancel</button><button className="button button--primary" type="submit">Save recipe</button></div>
        </form>
      </Modal>

      <Modal open={mealOpen} title={`Plan ${mealTarget.slot}`} description={formatDate(mealTarget.date, { weekday: 'long', month: 'long', day: 'numeric' })} onClose={() => setMealOpen(false)}>
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); addMeal(event.currentTarget) }}>
          <Field label="Recipe"><select name="recipeId" defaultValue={data.recipes[0]?.id}>{data.recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select></Field>
          <div className="form-grid__split"><Field label="Servings to eat"><input name="servings" type="number" min="0.25" step="0.25" defaultValue="1" required /></Field><Field label="Servings prepared"><input name="preparedServings" type="number" min="0" step="1" defaultValue="4" required /></Field></div>
          <div className="modal__actions"><button className="button button--quiet" type="button" onClick={() => setMealOpen(false)}>Cancel</button><button className="button button--primary" type="submit">Plan meal</button></div>
        </form>
      </Modal>

      <Modal open={foodOpen} title="Log food" description="Nutrition is saved as a snapshot, so history stays stable if a recipe changes." onClose={() => setFoodOpen(false)}>
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); logFood(event.currentTarget) }}>
          <Field label="Saved recipe"><select name="recipeId" defaultValue={data.recipes[0]?.id}>{data.recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select></Field>
          <div className="form-grid__split"><Field label="Date"><input name="date" type="date" defaultValue={toLocalDate(new Date())} required /></Field><Field label="Servings"><input name="servings" type="number" min="0.25" step="0.25" defaultValue="1" required /></Field></div>
          <div className="modal__actions"><button className="button button--quiet" type="button" onClick={() => setFoodOpen(false)}>Cancel</button><button className="button button--primary" type="submit">Log food</button></div>
        </form>
      </Modal>
    </>
  )
}

function RecipesView({ recipes, query, setQuery, data, updateData }: { recipes: Recipe[]; query: string; setQuery: (value: string) => void; data: ReturnType<typeof useApp>['data']; updateData: ReturnType<typeof useApp>['updateData'] }) {
  return <><div className="filter-bar"><Search aria-hidden="true" /><label className="sr-only" htmlFor="recipe-search">Search recipes</label><input id="recipe-search" name="recipe-search" type="search" autoComplete="off" placeholder="Search recipes or tags…" value={query} onChange={(event) => setQuery(event.target.value)} /><span>{recipes.length} recipes</span></div><div className="recipe-grid">{recipes.map((recipe) => <article className="recipe-card" key={recipe.id}><Link to={`/food/recipes/${recipe.id}`} className="recipe-card__image"><img src={assetUrl(recipe.image)} alt={`${recipe.name} plated in a bowl`} width="460" height="307" loading="lazy" /></Link><div className="recipe-card__body"><div className="recipe-card__meta"><StatusBadge tone="food">{recipe.category}</StatusBadge><button className={recipe.favorite ? 'icon-button is-favorite' : 'icon-button'} type="button" aria-label={`${recipe.favorite ? 'Remove' : 'Add'} ${recipe.name} ${recipe.favorite ? 'from' : 'to'} favorites`} onClick={() => updateData({ ...data, recipes: data.recipes.map((item) => item.id === recipe.id ? { ...item, favorite: !item.favorite } : item) }, recipe.favorite ? 'Removed from favorites.' : 'Added to favorites.')}><Heart aria-hidden="true" fill={recipe.favorite ? 'currentColor' : 'none'} /></button></div><Link to={`/food/recipes/${recipe.id}`}><h2>{recipe.name}</h2></Link><p>{recipe.description}</p><div className="recipe-card__footer"><span>{recipe.prepMinutes + recipe.cookMinutes} min</span><span>{recipe.nutritionPerServing.protein} g protein</span></div></div></article>)}</div>{!recipes.length ? <EmptyState title="No matching recipes" detail="Try another search or add a recipe of your own." /> : null}</>
}

function PlannerView({ days, data, onAdd, updateData }: { days: Date[]; data: ReturnType<typeof useApp>['data']; onAdd: (date: string, slot: MealSlot) => void; updateData: ReturnType<typeof useApp>['updateData'] }) {
  const recipeMap = new Map(data.recipes.map((recipe) => [recipe.id, recipe]))
  return <div className="meal-planner"><div className="meal-planner__header"><div><h2>Week of {formatDate(toLocalDate(days[0] ?? new Date()), { month: 'long', day: 'numeric' })}</h2><p>Plan servings now; use leftovers later.</p></div><StatusBadge tone="food">{data.meals.length} meals planned</StatusBadge></div><div className="meal-week">{days.map((day) => { const date = toLocalDate(day); return <section key={date} className={date === toLocalDate(new Date()) ? 'meal-day is-today' : 'meal-day'}><header><span>{formatDate(date, { weekday: 'short' })}</span><strong>{day.getDate()}</strong></header>{mealSlots.map((slot) => { const meal = data.meals.find((entry) => entry.date === date && entry.slot === slot); const recipe = meal?.recipeId ? recipeMap.get(meal.recipeId) : undefined; return <div className="meal-slot" key={slot}><span>{slot}</span>{meal ? <div className="meal-slot__planned"><button type="button" onClick={() => onAdd(date, slot)}><strong>{recipe?.name ?? meal.customName}</strong><small>{meal.servings} serving · {Math.max(0, meal.preparedServings - meal.consumedServings)} left</small></button><button className="meal-slot__remove" type="button" aria-label={`Remove ${slot} on ${formatDate(date)}`} onClick={() => updateData((previous) => ({ ...previous, meals: previous.meals.filter((entry) => entry.id !== meal.id) }), 'Meal removed from the plan.')}>×</button></div> : <button className="meal-slot__add" type="button" onClick={() => onAdd(date, slot)}><Plus aria-hidden="true" /> Add</button>}</div>})}</section>})}</div></div>
}

function NutritionView({ data }: { data: ReturnType<typeof useApp>['data'] }) {
  const today = toLocalDate(new Date())
  const entries = data.foodLog.filter((entry) => entry.date === today)
  const total = sumNutrition(entries.map((entry) => entry.nutritionSnapshot))
  const metrics = [{ key: 'calories' as const, label: 'Calories', unit: 'kcal', tone: 'pink' as const }, { key: 'protein' as const, label: 'Protein', unit: 'g', tone: 'blue' as const }, { key: 'carbs' as const, label: 'Carbs', unit: 'g', tone: 'yellow' as const }, { key: 'fat' as const, label: 'Fat', unit: 'g', tone: 'mint' as const }, { key: 'fiber' as const, label: 'Fiber', unit: 'g', tone: 'mint' as const }, { key: 'sodium' as const, label: 'Sodium', unit: 'mg', tone: 'blue' as const }]
  return <div className="nutrition-layout"><Card className="nutrition-summary"><div className="nutrition-summary__lead"><UtensilsCrossed aria-hidden="true" /><div><span>Consumed today</span><strong>{Math.round(total.calories).toLocaleString()} <small>kcal</small></strong><p>{Math.max(0, data.settings.nutritionTargets.calories - total.calories).toLocaleString()} remaining</p></div></div><div className="nutrition-metrics">{metrics.map((metric) => <div key={metric.key}><div><span>{metric.label}</span><strong>{Math.round(total[metric.key])} <small>/ {data.settings.nutritionTargets[metric.key]} {metric.unit}</small></strong></div><ProgressBar value={total[metric.key]} max={data.settings.nutritionTargets[metric.key]} label={`${metric.label} progress`} tone={metric.tone} /></div>)}</div></Card><Card className="food-log-card"><div className="section-heading"><div><h2>Food log</h2><p>Snapshot values from today</p></div></div><ul className="food-log-list">{entries.map((entry) => <li key={entry.id}><span className="section-icon section-icon--mint"><ChefHat aria-hidden="true" /></span><div><strong>{entry.name}</strong><small>{entry.servings} serving · {entry.nutritionSnapshot.protein} g protein</small></div><span>{entry.nutritionSnapshot.calories} kcal</span></li>)}</ul>{!entries.length ? <EmptyState title="Nothing logged today" detail="Log a saved recipe, packaged food, or custom food." /> : null}</Card></div>
}
