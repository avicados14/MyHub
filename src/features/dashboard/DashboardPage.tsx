import { ArrowUpRight, BookOpenCheck, CalendarClock, ChefHat, CircleAlert, ShoppingBasket } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { Card, EmptyState, ProgressBar, StatusBadge } from '../../components/ui'
import { dueAssignments, eventsForDate, greeting, mealsForDate, nutritionForDate } from '../../domain/selectors'
import { formatDate, formatTime, relativeDueLabel, toLocalDate } from '../../utilities/date'
import { assetUrl } from '../../utilities/assets'

export default function DashboardPage() {
  const { data } = useApp()
  const today = toLocalDate(new Date())
  const events = eventsForDate(data, today)
  const assignments = dueAssignments(data).slice(0, 3)
  const meals = mealsForDate(data, today)
  const nutrition = nutritionForDate(data, today)
  const recipeMap = new Map(data.recipes.map((recipe) => [recipe.id, recipe]))
  const completedGroceries = data.activeGroceryList?.items.filter((item) => item.checked).length ?? 0
  const groceryTotal = data.activeGroceryList?.items.length ?? 0

  return (
    <div className="dashboard-page">
      <header className="dashboard-welcome">
        <div>
          <p className="date-kicker">{formatDate(today, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1>{greeting()}, {data.settings.name}.</h1>
          <p>Your day is mapped. Here’s where your attention matters next.</p>
        </div>
        <Link className="button button--primary" to="/school">Plan study time <ArrowUpRight aria-hidden="true" /></Link>
      </header>

      <div className="dashboard-lead">
        <Card className="schedule-card">
          <div className="section-heading">
            <div><span className="section-icon section-icon--blue"><CalendarClock aria-hidden="true" /></span><div><h2>Today’s schedule</h2><p>{events.length} commitments on your calendar</p></div></div>
            <Link to="/calendar">Open calendar</Link>
          </div>
          {events.length ? (
            <ol className="timeline">
              {events.map((event) => (
                <li key={event.id} className={`timeline__item timeline__item--${event.kind}`}>
                  <time>{formatTime(event.startTime)}</time>
                  <span className="timeline__line" aria-hidden="true" />
                  <div>
                    <div className="timeline__title"><strong>{event.title}</strong>{event.kind === 'study' ? <StatusBadge tone="study">Study block</StatusBadge> : null}</div>
                    <p>{event.course ?? event.sourceLabel} · until {formatTime(event.endTime)}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : <EmptyState title="Your day is open" detail="Add an event or generate a study plan to shape it." />}
        </Card>

        <Card className="focus-card">
          <div className="focus-card__intro">
            <span className="section-icon section-icon--yellow"><CircleAlert aria-hidden="true" /></span>
            <div><h2>Focus next</h2><p>Due soon, in priority order</p></div>
          </div>
          <div className="assignment-stack">
            {assignments.map((assignment, index) => (
              <Link className="assignment-row" key={assignment.id} to="/school">
                <span className="assignment-row__index">0{index + 1}</span>
                <span className="assignment-row__content"><strong>{assignment.title}</strong><small>{assignment.course} · {relativeDueLabel(assignment.dueDate)} at {formatTime(assignment.dueTime)}</small></span>
                <StatusBadge tone={assignment.priority === 'high' ? 'danger' : 'attention'}>{assignment.priority}</StatusBadge>
              </Link>
            ))}
          </div>
          <div className="focus-card__footer"><BookOpenCheck aria-hidden="true" /><span><strong>{data.events.filter((event) => event.kind === 'study' && event.date === today).length}</strong> study blocks planned today</span></div>
        </Card>
      </div>

      <section className="dashboard-section" aria-labelledby="meals-heading">
        <div className="section-heading section-heading--outside">
          <div><span className="section-icon section-icon--mint"><ChefHat aria-hidden="true" /></span><div><h2 id="meals-heading">Today’s meals</h2><p>Your plan, prep balance, and nutrition in one view</p></div></div>
          <Link to="/food?view=planner">Open meal plan</Link>
        </div>
        <div className="meal-strip">
          {meals.map((meal) => {
            const recipe = meal.recipeId ? recipeMap.get(meal.recipeId) : undefined
            return (
              <Link className="meal-card" key={meal.id} to={recipe ? `/food/recipes/${recipe.id}` : '/food'}>
                {recipe ? <img src={assetUrl(recipe.image)} alt="" width="420" height="280" loading="lazy" /> : <div className="meal-card__placeholder" />}
                <div className="meal-card__body"><span>{meal.slot}</span><strong>{recipe?.name ?? meal.customName ?? 'Custom meal'}</strong><small>{meal.servings} serving · {Math.max(0, meal.preparedServings - meal.consumedServings)} leftover</small></div>
              </Link>
            )
          })}
          {!meals.length ? <EmptyState title="No meals planned" detail="Choose breakfast, lunch, or dinner from your recipe library." action={<Link className="button button--secondary" to="/food?view=planner">Plan a meal</Link>} /> : null}
        </div>
      </section>

      <div className="dashboard-lower">
        <Card className="nutrition-card">
          <div className="section-heading"><div><h2>Daily nutrition</h2><p>From foods logged today</p></div><Link to="/food?view=nutrition">View details</Link></div>
          <div className="calorie-readout"><strong>{Math.round(nutrition.calories).toLocaleString()}</strong><span>of {data.settings.nutritionTargets.calories.toLocaleString()} kcal</span></div>
          <ProgressBar value={nutrition.calories} max={data.settings.nutritionTargets.calories} label={`${nutrition.calories} of ${data.settings.nutritionTargets.calories} calories`} tone="pink" />
          <div className="macro-grid">
            {(['protein', 'carbs', 'fat', 'fiber'] as const).map((key) => (
              <div key={key}><span className="macro-grid__label">{key === 'carbs' ? 'Carbs' : `${key[0]?.toUpperCase()}${key.slice(1)}`}</span><strong className="macro-grid__value">{Math.round(nutrition[key])}<span>g</span></strong><ProgressBar value={nutrition[key]} max={data.settings.nutritionTargets[key]} label={`${key} progress`} tone={key === 'protein' ? 'blue' : key === 'carbs' ? 'yellow' : 'mint'} /></div>
            ))}
          </div>
        </Card>

        <Card className="week-card">
          <div className="section-heading"><div><h2>Week ahead</h2><p>A quick readiness check</p></div></div>
          <ul className="readiness-list">
            <li><span className="readiness-list__icon readiness-list__icon--study"><BookOpenCheck aria-hidden="true" /></span><div><strong>{data.assignments.filter((assignment) => assignment.status !== 'complete').length} open assignments</strong><small>{data.events.filter((event) => event.kind === 'study').length} study blocks scheduled</small></div><Link to="/school" aria-label="Open school planner"><ArrowUpRight aria-hidden="true" /></Link></li>
            <li><span className="readiness-list__icon readiness-list__icon--food"><ChefHat aria-hidden="true" /></span><div><strong>{data.meals.length} meals planned</strong><small>{data.recipes.length} recipes in your library</small></div><Link to="/food" aria-label="Open food planning"><ArrowUpRight aria-hidden="true" /></Link></li>
            <li><span className="readiness-list__icon readiness-list__icon--grocery"><ShoppingBasket aria-hidden="true" /></span><div><strong>{groceryTotal ? `${completedGroceries} of ${groceryTotal} groceries` : 'Grocery list ready to build'}</strong><small>{data.pantry.length} ingredients tracked at home</small></div><Link to="/grocery" aria-label="Open grocery list"><ArrowUpRight aria-hidden="true" /></Link></li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
