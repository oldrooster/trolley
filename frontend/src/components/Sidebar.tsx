import { NavLink } from 'react-router-dom'
import { ShoppingCart, Calendar, BookOpen, Package, Receipt, Settings, Moon, Sun } from 'lucide-react'
import { useDarkMode } from '../hooks/useDarkMode'

const nav = [
  { to: '/list',      icon: ShoppingCart, label: 'Shopping List', shortcut: '1' },
  { to: '/planner',  icon: Calendar,     label: 'Meal Planner',  shortcut: '2' },
  { to: '/recipes',  icon: BookOpen,     label: 'Recipes',       shortcut: '3' },
  { to: '/catalogue',icon: Package,      label: 'Catalogue',     shortcut: '4' },
  { to: '/receipts', icon: Receipt,      label: 'Receipts',      shortcut: '5' },
  { to: '/settings', icon: Settings,     label: 'Settings',      shortcut: ',' },
]

export default function Sidebar() {
  const { dark, toggle } = useDarkMode()

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 h-screen sticky top-0
                      bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 px-3 py-5">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 mb-6">
        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
          <ShoppingCart className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-semibold text-stone-900 dark:text-white tracking-tight">Trolley</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {nav.map(({ to, icon: Icon, label, shortcut }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `nav-item group ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{label}</span>
            <kbd className={`text-[10px] px-1.5 py-0.5 rounded border font-mono opacity-0 group-hover:opacity-60 transition-opacity
              border-stone-200 dark:border-stone-700 text-stone-400`}>
              {shortcut}
            </kbd>
          </NavLink>
        ))}
      </nav>

      {/* Footer — dark mode + version */}
      <div className="flex items-center justify-between px-3">
        <p className="text-xs text-stone-400">Trolley v0.1</p>
        <button
          onClick={toggle}
          className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark
            ? <Sun  className="w-4 h-4 text-stone-400 hover:text-amber-400 transition-colors" />
            : <Moon className="w-4 h-4 text-stone-400 hover:text-brand-500 transition-colors" />
          }
        </button>
      </div>
    </aside>
  )
}
