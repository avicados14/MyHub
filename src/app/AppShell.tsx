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
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
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

export function AppShell({ children }: { children: ReactNode }) {
  const { data } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [])

  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []
    const recipes = data.recipes
      .filter((recipe) => recipe.name.toLowerCase().includes(term))
      .map((recipe) => ({ id: recipe.id, label: recipe.name, meta: 'Recipe', to: `/food/recipes/${recipe.id}` }))
    const assignments = data.assignments
      .filter((assignment) => `${assignment.title} ${assignment.course}`.toLowerCase().includes(term))
      .map((assignment) => ({ id: assignment.id, label: assignment.title, meta: assignment.course, to: '/school' }))
    const pantry = data.pantry
      .filter((item) => item.name.toLowerCase().includes(term))
      .map((item) => ({ id: item.id, label: item.name, meta: `${item.location} · ${item.quantity} ${item.unit}`, to: '/pantry' }))
    return [...recipes, ...assignments, ...pantry].slice(0, 8)
  }, [data, query])

  const closeNavigation = () => setMenuOpen(false)

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`} aria-label="Primary navigation">
        <div className="brand-row">
          <Link className="brand" to="/" onClick={closeNavigation} aria-label="MyHub home">
            <span className="brand__mark"><Sparkles aria-hidden="true" /></span>
            <span>MyHub</span>
          </Link>
          <button className="icon-button sidebar__close" type="button" aria-label="Close navigation" onClick={closeNavigation}>
            <X aria-hidden="true" />
          </button>
        </div>
        <nav>
          {navigation.filter((item) => item.section === 'main').map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={closeNavigation} className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}>
              <item.icon aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          <NavLink to="/settings" onClick={closeNavigation} className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}>
            <Settings aria-hidden="true" />
            <span>Settings</span>
          </NavLink>
          <div className="privacy-note"><span aria-hidden="true" />Stored only in this browser</div>
        </div>
      </aside>
      {menuOpen ? <button className="scrim" type="button" aria-label="Close navigation" onClick={closeNavigation} /> : null}

      <div className="app-main">
        <header className="topbar">
          <button className="icon-button topbar__menu" type="button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
            <Menu aria-hidden="true" />
          </button>
          <button className="search-trigger" type="button" onClick={() => setSearchOpen(true)} aria-label="Search MyHub">
            <Search aria-hidden="true" />
            <span>Search homework, recipes, pantry…</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="topbar__identity">
            <span className="topbar__date">{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span>
            <span className="avatar" aria-hidden="true">{data.settings.name.slice(0, 1).toUpperCase()}</span>
          </div>
        </header>
        <main id="main-content" className="page" tabIndex={-1}>{children}</main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.slice(0, 5).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => (isActive ? 'is-active' : '')}>
            <item.icon aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {searchOpen ? (
        <div className="command-overlay" role="dialog" aria-modal="true" aria-label="Search MyHub">
          <button className="command-overlay__scrim" type="button" aria-label="Close search" onClick={() => setSearchOpen(false)} />
          <section className="command-palette">
            <div className="command-palette__input">
              <Search aria-hidden="true" />
              <label className="sr-only" htmlFor="global-search">Search MyHub</label>
              <input id="global-search" name="global-search" type="search" autoComplete="off" autoFocus={window.matchMedia('(min-width: 768px)').matches} placeholder="Search MyHub…" value={query} onChange={(event) => setQuery(event.target.value)} />
              <button className="icon-button" type="button" aria-label="Close search" onClick={() => setSearchOpen(false)}><X aria-hidden="true" /></button>
            </div>
            <div className="command-palette__results">
              {query && results.length === 0 ? <p>No matches yet. Try a course, recipe, or ingredient.</p> : null}
              {results.map((result) => (
                <Link key={`${result.meta}-${result.id}`} to={result.to} onClick={() => { setSearchOpen(false); setQuery('') }}>
                  <span>{result.label}</span><small>{result.meta}</small>
                </Link>
              ))}
              {!query ? <p>Search across recipes, homework, and your pantry.</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
