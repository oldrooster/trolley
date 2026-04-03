import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-stone-50 dark:bg-stone-950">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-screen pb-16 md:pb-0">
        <div className="flex-1 p-4 md:p-8 max-w-4xl w-full mx-auto">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
