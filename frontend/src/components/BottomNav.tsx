import { NavLink } from 'react-router-dom'
import { ShoppingCart, Calendar, BookOpen, Package, Receipt, Settings } from 'lucide-react'

const nav = [
  { to: '/list',      icon: ShoppingCart, label: 'List'      },
  { to: '/planner',  icon: Calendar,     label: 'Planner'   },
  { to: '/recipes',  icon: BookOpen,     label: 'Recipes'   },
  { to: '/catalogue',icon: Package,      label: 'Catalogue' },
  { to: '/receipts', icon: Receipt,      label: 'Receipts'  },
  { to: '/settings', icon: Settings,     label: 'Settings'  },
]

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-stone-900
                    border-t border-stone-200 dark:border-stone-800 flex z-10
                    safe-bottom">
      {nav.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors
             ${isActive
               ? 'text-brand-500 dark:text-brand-400'
               : 'text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300'}`
          }
        >
          <Icon className="w-5 h-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
