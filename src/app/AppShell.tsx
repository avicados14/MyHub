import {
  CalendarDays,
  ChefHat,
  GraduationCap,
  Home,
  Menu,
  PackageOpen,
  Search,
  Settings,
  ShoppingBasket,
  Sparkles,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import '../styles/crosscut-v2.css'
import { useApp } from './AppContext'

const navigation = [
  { to: '/', label: 'Home', icon: Home, section: 'main' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, section: 'main' },
  { to: '/school', label: 'School', icon: GraduationCap, section: 'main' },
  { to: '/food', label: 'Food', icon: ChefHat, section: 'main' },
  { to: '/grocery', label: 'Grocery', icon: ShoppingBasket, section: 'main' },
  { to: '/pantry', label: 'Pantry', icon: PackageOpen, section: 'main' },
  { to: '/settings', label: 'Settings', icon: Settings, section: 'utility' },
]

interface SearchResult {
  id: string
  label: string
  meta: string
  to: string
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchDialog = useRef<HTMLDialogElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const restoreFocusTo = useRef<HTMLElement | null>(null)

  const openSearch = useCallback(() => {
    if (searchOpen) return
    restoreFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSearchOpen(true)
  }, [searchOpen])

  const finishClosingSearch = useCallback(() => {
    setSearchOpen(false)
    setQuery('')
    window.requestAnimationFrame(() => restoreFocusTo.current?.focus())
  }, [])

  const closeSearch = useCallback(() => {
    const dialog = searchDialog.current
    if (dialog?.open) dialog.close()
    else finishClosingSearch()
  }, [finishClosingSearch])

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openSearch()
      }
    }
    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [openSearch])

  useEffect(() => {
    const dialog = searchDialog.current
    if (!dialog || !searchOpen || dialog.open) return
    dialog.showModal()
    window.requestAnimationFrame(() => searchInput.current?.focus())
  }, [searchOpen])

  const results = useMemo<SearchResult[]>(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []
    const encodedTerm = encodeURIComponent(query.trim())

    const recipes = data.recipes
      .filter((recipe) => `${recipe.name} ${recipe.description} ${recipe.tags.join(' ')}`.toLowerCase().includes(term))
      .map((recipe) => ({
        id: recipe.id,
        label: recipe.name,
        meta: 'Recipe',
        to: `/food/recipes/${recipe.id}`,
      }))
    const assignments = data.assignments
      .filter((assignment) =>
        `${assignment.title} ${assignment.course} ${assignment.notes}`.toLowerCase().includes(term),
      )
      .map((assignment) => ({
        id: assignment.id,
        label: assignment.title,
        meta: `Homework · ${assignment.course}`,
        to: `/school?view=homework&query=${encodedTerm}`,
      }))
    const pantry = data.pantry
      .filter((item) => `${item.name} ${item.category} ${item.location}`.toLowerCase().includes(term))
      .map((item) => ({
        id: item.id,
        label: item.name,
        meta: `Pantry · ${item.location} · ${item.quantity} ${item.unit}`,
        to: `/pantry?query=${encodedTerm}`,
      }))
    const packagedFoods = data.packagedFoods
      .filter((item) => `${item.name} ${item.brand ?? ''} ${item.barcode ?? ''}`.toLowerCase().includes(term))
      .map((item) => ({
        id: item.id,
        label: item.name,
        meta: item.brand ? `Packaged food · ${item.brand}` : 'Packaged food',
        to: `/food?view=nutrition&query=${encodedTerm}`,
      }))
    const groceryHistory = data.groceryHistory
      .filter((entry) => `${entry.name} ${entry.items.map((item) => item.name).join(' ')}`.toLowerCase().includes(term))
      .map((entry) => ({
        id: entry.id,
        label: entry.name,
        meta: `Grocery history · ${entry.items.length} items`,
        to: `/grocery?history=${encodeURIComponent(entry.id)}`,
      }))
    const mealPlans = data.meals
      .filter((meal) => `${meal.sourceSnapshot.name} ${meal.slot} ${meal.date}`.toLowerCase().includes(term))
      .map((meal) => ({
        id: meal.id,
        label: meal.sourceSnapshot.name,
        meta: `Meal plan · ${meal.slot} · ${meal.date}`,
        to: `/food?view=planner&date=${encodeURIComponent(meal.date)}`,
      }))

    return [...recipes, ...assignments, ...pantry, ...packagedFoods, ...groceryHistory, ...mealPlans].slice(0, 12)
  }, [data, query])

  const closeNavigation = () => setMenuOpen(false)
  const displayName = data.settings.name.trim()

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`} aria-label="Primary navigation">
        <div className="brand-row">
          <Link className="brand" to="/" onClick={closeNavigation} aria-label="MyHub home">
            <span className="brand__mark">
              <Sparkles aria-hidden="true" />
            </span>
            <span>MyHub</span>
          </Link>
          <button
            className="icon-button sidebar__close"
            type="button"
            aria-label="Close navigation"
            onClick={closeNavigation}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <nav>
          {navigation
            .filter((item) => item.section === 'main')
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={closeNavigation}
                className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
              >
                <item.icon aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            ))}
        </nav>
        <div className="sidebar__footer">
          <NavLink
            to="/settings"
            onClick={closeNavigation}
            className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
          >
            <Settings aria-hidden="true" />
            <span>Settings</span>
          </NavLink>
          <div className="privacy-note">
            <span aria-hidden="true" />
            Local first · encrypted sync optional
          </div>
        </div>
      </aside>
      {menuOpen ? (
        <button className="scrim" type="button" aria-label="Close navigation" onClick={closeNavigation} />
      ) : null}

      <div className="app-main">
        <header className="topbar">
          <button
            className="icon-button topbar__menu"
            type="button"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            <Menu aria-hidden="true" />
          </button>
          <button className="search-trigger" type="button" onClick={openSearch} aria-label="Search MyHub">
            <Search aria-hidden="true" />
            <span>Search homework, food, plans, pantry…</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="topbar__identity">
            <span className="topbar__date">
              {new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(
                new Date(),
              )}
            </span>
            <span className="avatar" aria-hidden="true">
              {displayName.slice(0, 1).toUpperCase() || 'M'}
            </span>
          </div>
        </header>
        <main id="main-content" className="page" tabIndex={-1}>
          {children}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => (isActive ? 'is-active' : '')}
          >
            <item.icon aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <dialog
        ref={searchDialog}
        className="command-dialog"
        aria-label="Search MyHub"
        onClose={finishClosingSearch}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return
          const focusable = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), a[href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          )
          const first = focusable[0]
          const last = focusable.at(-1)
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeSearch()
        }}
      >
        <section className="command-palette">
          <div className="command-palette__input">
            <Search aria-hidden="true" />
            <label className="sr-only" htmlFor="global-search">
              Search MyHub
            </label>
            <input
              ref={searchInput}
              id="global-search"
              name="global-search"
              type="search"
              autoComplete="off"
              placeholder="Search MyHub…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="icon-button" type="button" aria-label="Close search" onClick={closeSearch}>
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="command-palette__results" aria-live="polite">
            {query && results.length === 0 ? (
              <p>No matches yet. Try a title, course, ingredient, brand, or meal.</p>
            ) : null}
            {results.map((result) => (
              <Link key={`${result.meta}-${result.id}`} to={result.to} onClick={closeSearch}>
                <span>{result.label}</span>
                <small>{result.meta}</small>
              </Link>
            ))}
            {!query ? <p>Search recipes, homework, pantry, packaged foods, grocery history, and meal plans.</p> : null}
          </div>
        </section>
      </dialog>
    </div>
  )
}
