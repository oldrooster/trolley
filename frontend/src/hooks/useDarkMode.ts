import { useEffect, useState } from 'react'

const KEY = 'trolley_dark_mode'

function getInitial(): boolean {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored !== null) return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

export function useDarkMode() {
  const [dark, setDark] = useState(getInitial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem(KEY, String(dark)) } catch {}
  }, [dark])

  return { dark, toggle: () => setDark(d => !d), setDark }
}
