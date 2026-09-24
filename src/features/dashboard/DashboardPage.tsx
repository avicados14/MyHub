import { ArrowUpRight, BookOpenCheck, CalendarClock, ChefHat, CircleAlert, ShoppingBasket } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { Card, EmptyState, ProgressBar, StatusBadge } from '../../components/ui'
import { visibleAssignments, visibleCalendarEvents } from '../../domain/calendar'
import { dashboardScheduleWindow, type TimedScheduleItem } from '../../domain/dashboardSchedule'
import { remainingBatchServingsForMeal } from '../../domain/mealWorkflow'
import { dueAssignments, eventsForDate, greeting, mealsForDate, nutritionForDate } from '../../domain/selectors'
import type { MealSlot, Nutrition } from '../../domain/types'
import '../../styles/crosscut-v2.css'
import { assetUrl } from '../../utilities/assets'
import { addDays, dateTimeInZone, formatDate, formatTime, relativeDueLabel } from '../../utilities/date'

const mealSlots: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

const useMinuteClock = (): Date => {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

const scheduleItem = (item: TimedScheduleItem, state: 'previous' | 'current' | 'next') => (
  <li className={`schedule-compact__item schedule-compact__item--${state}`} key={`${state}-${item.event.id}`}>
    <span className="schedule-compact__state">
      {state === 'current' ? 'Happening now' : state === 'previous' ? 'Just finished' : 'Up next'}
    </span>
    <div className="schedule-compact__title">
      <strong>{item.event.title}</strong>
      <small>{item.event.course || item.event.sourceLabel || 'Calendar event'}</small>
    </div>
    <time dateTime={`${item.event.date}T${item.startTime}`}>
      {formatTime(item.startTime)}–{formatTime(item.endTime)}
    </time>
  </li>
)

const nutritionMetrics: Array<{
  key: keyof Nutrition
  label: string
  unit: 'kcal' | 'g' | 'mg'
  tone: 'blue' | 'mint' | 'yellow' | 'pink'
  limit?: boolean
}> = [
  { key: 'calories', label: 'Calories', unit: 'kcal', tone: 'pink' },
  { key: 'protein', label: 'Protein', unit: 'g', tone: 'blue' },
  { key: 'carbs', label: 'Carbs', unit: 'g', tone: 'yellow' },
  { key: 'fat', label: 'Fat', unit: 'g', tone: 'mint' },
  { key: 'sugar', label: 'Sugar', unit: 'g', tone: 'pink', limit: true },
  { key: 'saturatedFat', label: 'Saturated fat', unit: 'g', tone: 'yellow', limit: true },
  { key: 'fiber', label: 'Fiber', unit: 'g', tone: 'mint' },
  { key: 'sodium', label: 'Sodium', unit: 'mg', tone: 'blue', limit: true },
]

export default function DashboardPage() {
  const { data } = useApp()
  const todayDate = useMinuteClock()
  const zonedNow = dateTimeInZone(todayDate, data.settings.calendarTimeZone)
  const today = zonedNow.date
  const weekEnd = dateTimeInZone(addDays(todayDate, 6), data.settings.calendarTimeZone).date
  const events = eventsForDate(data, today)
  const studyBlocks = events.filter((event) => event.kind === 'study')
  const commitments = events.filter((event) => event.kind !== 'study')
  const nowTime = zonedNow.time
  const schedule = dashboardScheduleWindow(commitments, todayDate, today, nowTime)
  const assignments = dueAssignments(data).slice(0, 3)
  const meals = mealsForDate(data, today)
  const nutrition = nutritionForDate(data, today)
  const recipeMap = new Map(data.recipes.map((recipe) => [recipe.id, recipe]))
  const completedGroceries = data.activeGroceryList?.items.filter((item) => item.checked).length ?? 0
  const groceryTotal = data.activeGroceryList?.items.length ?? 0
  const displayName = data.settings.name.trim()
  const greetingText = displayName
    ? `${greeting(todayDate, data.settings.calendarTimeZone)}, ${displayName}.`
    : `${greeting(todayDate, data.settings.calendarTimeZone)}.`
  const weekAssignments = visibleAssignments(data).filter(
    (assignment) => assignment.status !== 'complete' && assignment.dueDate >= today && assignment.dueDate <= weekEnd,
  ).length
  const weekStudyBlocks = visibleCalendarEvents(data).filter(
    (event) => event.kind === 'study' && event.date >= today && event.date <= weekEnd,
  ).length
  const weekMeals = data.meals.filter((meal) => meal.date >= today && meal.date <= weekEnd).length

  return (
    <div className="dashboard-page dashboard-page--v2">
      <header className="dashboard-welcome">
        <div>
          <p className="date-kicker">{formatDate(today, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1>{greetingText}</h1>
          <p>Your schedule, study plan, meals, and daily targets are together below.</p>
        </div>
        <Link className="button button--primary" to="/school?view=planner">
          Plan study time <ArrowUpRight aria-hidden="true" />
        </Link>
      </header>

      <div className="dashboard-lead">
        <Card className="schedule-card">
          <div className="section-heading">
            <div>
              <span className="section-icon section-icon--blue">
                <CalendarClock aria-hidden="true" />
              </span>
              <div>
                <h2>Today’s schedule</h2>
                <p>
                  {commitments.length} calendar {commitments.length === 1 ? 'commitment' : 'commitments'}
                </p>
              </div>
            </div>
            <Link to="/calendar">Open calendar</Link>
          </div>
          {commitments.length ? (
            <div className="schedule-compact">
              {schedule.previous ? <ol>{scheduleItem(schedule.previous, 'previous')}</ol> : <div aria-hidden="true" />}
              <div className="schedule-compact__now" role="group" aria-label={`Current time ${formatTime(nowTime)}`}>
                <span>Now</span>
                <time dateTime={todayDate.toISOString()}>{formatTime(nowTime)}</time>
              </div>
              <div className="schedule-compact__after">
                <ol>
                  {schedule.current.slice(0, 2).map((item) => scheduleItem(item, 'current'))}
                  {schedule.current.length < 2 && schedule.next ? scheduleItem(schedule.next, 'next') : null}
                </ol>
                {!schedule.current.length && !schedule.next ? (
                  <p className="schedule-compact__open">Nothing else is scheduled today.</p>
                ) : null}
                {schedule.allDayCount ? (
                  <p className="schedule-compact__all-day">
                    {schedule.allDayCount} all-day {schedule.allDayCount === 1 ? 'item' : 'items'} also on today’s
                    calendar
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <EmptyState title="Your day is open" detail="Add a calendar event to reserve time." />
          )}
        </Card>

        <Card className="focus-card">
          <div className="focus-card__intro">
            <span className="section-icon section-icon--yellow">
              <CircleAlert aria-hidden="true" />
            </span>
            <div>
              <h2>Focus next</h2>
              <p>Due soon, in priority order</p>
            </div>
          </div>
          <div className="assignment-stack">
            {assignments.map((assignment, index) => (
              <Link className="assignment-row" key={assignment.id} to="/school?view=homework">
                <span className="assignment-row__index">{String(index + 1).padStart(2, '0')}</span>
                <span className="assignment-row__content">
                  <strong>{assignment.title}</strong>
                  <small>
                    {assignment.course} · {relativeDueLabel(assignment.dueDate)} at {formatTime(assignment.dueTime)}
                  </small>
                </span>
                <StatusBadge tone={assignment.priority === 'high' ? 'danger' : 'attention'}>
                  {assignment.priority}
                </StatusBadge>
              </Link>
            ))}
            {!assignments.length ? (
              <p className="focus-card__empty">No open assignments. Add homework when it arrives.</p>
            ) : null}
          </div>
          <div className="focus-card__footer">
            <BookOpenCheck aria-hidden="true" />
            <span>
              <strong>{studyBlocks.length}</strong> study {studyBlocks.length === 1 ? 'block' : 'blocks'} planned today
            </span>
          </div>
        </Card>
      </div>

      <section className="dashboard-section" aria-labelledby="study-plan-heading">
        <div className="section-heading section-heading--outside">
          <div>
            <span className="section-icon section-icon--lilac">
              <BookOpenCheck aria-hidden="true" />
            </span>
            <div>
              <h2 id="study-plan-heading">Today’s Study Plan</h2>
              <p>A focused view of generated work blocks</p>
            </div>
          </div>
          <Link to="/school?view=planner">Open study planner</Link>
        </div>
        <Card className="study-plan-card">
          {studyBlocks.length ? (
            <ol className="study-plan-list">
              {studyBlocks.map((block) => (
                <li key={block.id}>
                  <time>
                    {formatTime(block.startTime)}–{formatTime(block.endTime)}
                  </time>
                  <span>
                    <strong>{block.title}</strong>
                    <small>{block.course || 'Study block'}</small>
                  </span>
                  <StatusBadge tone={block.completed ? 'success' : 'study'}>
                    {block.completed ? 'Complete' : block.locked ? 'Locked' : 'Planned'}
                  </StatusBadge>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title="No study blocks today"
              detail="Build a study plan and MyHub will reserve open time before your deadlines."
              action={
                <Link className="button button--secondary" to="/school?view=planner">
                  Build study plan
                </Link>
              }
            />
          )}
        </Card>
      </section>

      <section className="dashboard-section" aria-labelledby="meals-heading">
        <div className="section-heading section-heading--outside">
          <div>
            <span className="section-icon section-icon--mint">
              <ChefHat aria-hidden="true" />
            </span>
            <div>
              <h2 id="meals-heading">Today’s meals</h2>
              <p>Every meal slot stays visible, planned or open</p>
            </div>
          </div>
          <Link to="/food?view=planner">Open meal plan</Link>
        </div>
        <div className="meal-strip meal-strip--four">
          {mealSlots.map((slot) => {
            const meal = meals.find((entry) => entry.slot === slot)
            const recipe = meal?.recipeId ? recipeMap.get(meal.recipeId) : undefined
            const name = recipe?.name ?? meal?.customName ?? meal?.sourceSnapshot.name
            const batchRemaining = meal ? remainingBatchServingsForMeal(data, meal) : null

            return meal ? (
              <Link className="meal-card" key={slot} to={recipe ? `/food/recipes/${recipe.id}` : '/food?view=planner'}>
                {recipe?.image ? (
                  <img src={assetUrl(recipe.image)} alt="" width="420" height="280" loading="lazy" />
                ) : (
                  <div className="meal-card__placeholder" />
                )}
                <div className="meal-card__body">
                  <span>{slot}</span>
                  <strong>{name || 'Custom meal'}</strong>
                  <small>
                    {meal.servings} serving ·{' '}
                    {batchRemaining !== null
                      ? `${batchRemaining} batch servings left`
                      : `${Math.max(0, meal.preparedServings - meal.consumedServings)} left`}
                  </small>
                </div>
              </Link>
            ) : (
              <Link
                className="meal-card meal-card--empty"
                key={slot}
                to="/food?view=planner"
                aria-label={`Plan ${slot}`}
              >
                <ChefHat aria-hidden="true" />
                <span>{slot}</span>
                <strong>Open slot</strong>
                <small>Plan {slot}</small>
              </Link>
            )
          })}
        </div>
      </section>

      <div className="dashboard-lower dashboard-lower--v2">
        <Card className="nutrition-card">
          <div className="section-heading">
            <div>
              <h2>Daily nutrition</h2>
              <p>Consumed, daily target or limit, and remaining from foods logged today</p>
            </div>
            <Link to="/food?view=nutrition">View details</Link>
          </div>
          <div className="nutrition-dashboard-grid">
            {nutritionMetrics.map((metric) => {
              const consumed = Math.round(nutrition[metric.key] ?? 0)
              const goal = Math.round(data.settings.nutritionTargets[metric.key] ?? 0)
              const remaining = Math.max(0, goal - consumed)
              return (
                <div className="nutrition-dashboard-metric" key={metric.key}>
                  <div className="nutrition-dashboard-metric__heading">
                    <span>{metric.label}</span>
                    <strong>
                      {consumed.toLocaleString()} <small>{metric.unit}</small>
                    </strong>
                  </div>
                  <ProgressBar
                    value={consumed}
                    max={goal}
                    label={`${metric.label}: ${consumed} consumed of ${goal} ${metric.limit ? 'limit' : 'target'}, ${remaining} remaining`}
                    tone={metric.tone}
                  />
                  <dl>
                    <div>
                      <dt>Consumed</dt>
                      <dd>
                        {consumed.toLocaleString()} {metric.unit}
                      </dd>
                    </div>
                    <div>
                      <dt>{metric.limit ? 'Limit' : 'Goal'}</dt>
                      <dd>
                        {goal.toLocaleString()} {metric.unit}
                      </dd>
                    </div>
                    <div>
                      <dt>{metric.limit ? 'Before limit' : 'Remaining'}</dt>
                      <dd>
                        {remaining.toLocaleString()} {metric.unit}
                      </dd>
                    </div>
                  </dl>
                </div>
              )
            })}
          </div>
        </Card>

        <Card className="week-card week-card--compact">
          <div className="section-heading">
            <div>
              <h2>Week ahead</h2>
              <p>Today through {formatDate(weekEnd, { month: 'short', day: 'numeric' })}</p>
            </div>
          </div>
          <ul className="readiness-list">
            <li>
              <span className="readiness-list__icon readiness-list__icon--study">
                <BookOpenCheck aria-hidden="true" />
              </span>
              <div>
                <strong>{weekAssignments} assignments due</strong>
                <small>{weekStudyBlocks} study blocks scheduled</small>
              </div>
              <Link to="/school" aria-label="Open school planner">
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </li>
            <li>
              <span className="readiness-list__icon readiness-list__icon--food">
                <ChefHat aria-hidden="true" />
              </span>
              <div>
                <strong>{weekMeals} meals planned</strong>
                <small>{data.recipes.length} recipes available</small>
              </div>
              <Link to="/food?view=planner" aria-label="Open food planning">
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </li>
            <li>
              <span className="readiness-list__icon readiness-list__icon--grocery">
                <ShoppingBasket aria-hidden="true" />
              </span>
              <div>
                <strong>
                  {groceryTotal
                    ? `${completedGroceries} of ${groceryTotal} groceries checked`
                    : 'No active grocery list'}
                </strong>
                <small>{data.pantry.length} ingredients tracked at home</small>
              </div>
              <Link to="/grocery" aria-label="Open grocery list">
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
