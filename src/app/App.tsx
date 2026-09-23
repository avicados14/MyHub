import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { useApp } from './AppContext'

const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'))
const CalendarPage = lazy(() => import('../features/calendar/CalendarPage'))
const SchoolPage = lazy(() => import('../features/school/SchoolPage'))
const FoodPage = lazy(() => import('../features/food/FoodPage'))
const RecipePage = lazy(() => import('../features/food/RecipePage'))
const PantryPage = lazy(() => import('../features/pantry/PantryPage'))
const GroceryPage = lazy(() => import('../features/grocery/GroceryPage'))
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'))

export default function App() {
  const { ready } = useApp()

  return (
    <AppShell>
      {!ready ? (
        <div className="route-loading" role="status">
          Opening your local hub…
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="route-loading" role="status">
              Loading view…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/school" element={<SchoolPage />} />
            <Route path="/food" element={<FoodPage />} />
            <Route path="/food/recipes/:recipeId" element={<RecipePage />} />
            <Route path="/pantry" element={<PantryPage />} />
            <Route path="/grocery" element={<GroceryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate replace to="/" />} />
          </Routes>
        </Suspense>
      )}
    </AppShell>
  )
}
