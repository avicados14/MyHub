import { ArrowLeft, CalendarPlus, Clock3, Minus, Plus, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { Card, Field, Modal, StatusBadge } from '../../components/ui'
import { formatQuantity, scaledIngredients } from '../../domain/recipe'
import type { MealEntry, MealSlot } from '../../domain/types'
import { makeId, toLocalDate } from '../../utilities/date'
import { assetUrl } from '../../utilities/assets'

export default function RecipePage() {
  const { recipeId } = useParams()
  const { data, updateData } = useApp()
  const recipe = data.recipes.find((item) => item.id === recipeId)
  const [servings, setServings] = useState(recipe?.originalYield ?? 1)
  const [planOpen, setPlanOpen] = useState(false)
  if (!recipe) return <Navigate replace to="/food" />
  const ingredients = scaledIngredients(recipe, servings)

  const addToPlan = (form: HTMLFormElement) => {
    const values = new FormData(form)
    const timestamp = new Date().toISOString()
    const entry: MealEntry = { id: makeId('meal'), createdAt: timestamp, updatedAt: timestamp, source: 'manual', date: String(values.get('date')), slot: String(values.get('slot')) as MealSlot, recipeId: recipe.id, servings: Number(values.get('servings')), preparedServings: Number(values.get('preparedServings')), consumedServings: 0 }
    updateData((previous) => ({ ...previous, meals: [...previous.meals.filter((meal) => !(meal.date === entry.date && meal.slot === entry.slot)), entry] }), `${recipe.name} added to your meal plan.`)
    setPlanOpen(false)
  }

  return <>
    <Link className="back-link" to="/food"><ArrowLeft aria-hidden="true" /> Back to recipes</Link>
    <div className="recipe-hero"><img src={assetUrl(recipe.image)} alt={`${recipe.name} plated and ready to serve`} width="920" height="613" fetchPriority="high" /><div className="recipe-hero__content"><div className="badge-row"><StatusBadge tone="food">{recipe.category}</StatusBadge>{recipe.tags.map((tag) => <StatusBadge key={tag}>{tag}</StatusBadge>)}</div><h1>{recipe.name}</h1><p>{recipe.description}</p><div className="recipe-facts"><span><Clock3 aria-hidden="true" /><strong>{recipe.prepMinutes + recipe.cookMinutes} min</strong><small>Total time</small></span><span><ShieldCheck aria-hidden="true" /><strong>{recipe.nutritionPerServing.protein} g</strong><small>Protein / serving</small></span></div><button className="button button--primary" type="button" onClick={() => setPlanOpen(true)}><CalendarPlus aria-hidden="true" /> Add to meal plan</button></div></div>
    <div className="recipe-detail-grid"><Card className="ingredient-card"><div className="ingredient-card__header"><div><h2>Ingredients</h2><p>Quantities scale from the original {recipe.originalYield}-serving recipe.</p></div><div className="yield-stepper" aria-label="Recipe servings"><button type="button" aria-label="Decrease servings" onClick={() => setServings((value) => Math.max(1, value - 1))}><Minus aria-hidden="true" /></button><span><strong>{servings}</strong><small>servings</small></span><button type="button" aria-label="Increase servings" onClick={() => setServings((value) => value + 1)}><Plus aria-hidden="true" /></button></div></div><ul className="ingredient-list">{ingredients.map((ingredient) => <li key={ingredient.id}><span>{ingredient.quantity === null ? '' : formatQuantity(ingredient.quantity)} {ingredient.unit}</span><strong>{ingredient.name}</strong>{ingredient.note ? <small>{ingredient.note}</small> : null}</li>)}</ul></Card><Card className="steps-card"><h2>Method</h2><ol>{recipe.steps.map((step, index) => <li key={step.id}><span>{index + 1}</span><p>{step.text}</p></li>)}</ol></Card></div>
    <Modal open={planOpen} title="Add to meal plan" description={`Plan ${recipe.name} and preserve the intended serving count.`} onClose={() => setPlanOpen(false)}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); addToPlan(event.currentTarget) }}><Field label="Date"><input name="date" type="date" defaultValue={toLocalDate(new Date())} required /></Field><Field label="Meal"><select name="slot" defaultValue="dinner"><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></Field><div className="form-grid__split"><Field label="Servings to eat"><input name="servings" type="number" min="0.25" step="0.25" defaultValue={servings} required /></Field><Field label="Prepared servings"><input name="preparedServings" type="number" min="0" step="1" defaultValue={servings} required /></Field></div><div className="modal__actions"><button className="button button--quiet" type="button" onClick={() => setPlanOpen(false)}>Cancel</button><button className="button button--primary" type="submit">Add to plan</button></div></form></Modal>
  </>
}
