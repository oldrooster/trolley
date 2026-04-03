import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import ShoppingList from './pages/ShoppingList'
import MealPlanner from './pages/MealPlanner'
import Recipes from './pages/Recipes'
import Catalogue from './pages/Catalogue'
import Receipts from './pages/Receipts'
import Settings from './pages/Settings'
import { ToastProvider } from './components/Toast'
import { useDarkMode } from './hooks/useDarkMode'

// ── Global keyboard shortcuts ─────────────────────────────────────────────────

function KeyboardShortcuts() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Skip if typing in an input, textarea or select
      const tag = (e.target as HTMLElement).tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case '/':
          e.preventDefault()
          // Focus any visible search input
          const search = document.querySelector<HTMLInputElement>('input[placeholder*="Search"], input[placeholder*="Add an"]')
          search?.focus()
          break
        case '1': navigate('/list');      break
        case '2': navigate('/planner');   break
        case '3': navigate('/recipes');   break
        case '4': navigate('/catalogue'); break
        case '5': navigate('/receipts');  break
        case ',': navigate('/settings');  break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, location])

  return null
}

// ── Root ──────────────────────────────────────────────────────────────────────

function AppRoot() {
  // Initialise dark mode on mount (reads localStorage / system preference)
  useDarkMode()

  return (
    <BrowserRouter>
      <KeyboardShortcuts />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/list" replace />} />
          <Route path="list"      element={<ShoppingList />} />
          <Route path="planner"   element={<MealPlanner />} />
          <Route path="recipes"   element={<Recipes />} />
          <Route path="catalogue" element={<Catalogue />} />
          <Route path="receipts"  element={<Receipts />} />
          <Route path="settings"  element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppRoot />
    </ToastProvider>
  )
}
