import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

let nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = nextId++
    setToasts(prev => [...prev.slice(-4), { id, type, message, duration }])
  }, [])

  const success = useCallback((msg: string) => toast(msg, 'success'), [toast])
  const error   = useCallback((msg: string) => toast(msg, 'error', 5000), [toast])
  const warning = useCallback((msg: string) => toast(msg, 'warning'), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  )
}

// ── Container ─────────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-20 md:bottom-5 right-4 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  )
}

// ── Item ──────────────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />,
  error:   <XCircle    className="w-4 h-4 text-red-500   shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
  info:    <Info       className="w-4 h-4 text-brand-500 shrink-0" />,
}

const BG: Record<ToastType, string> = {
  success: 'bg-white border-green-200 dark:bg-stone-800 dark:border-green-700',
  error:   'bg-white border-red-200   dark:bg-stone-800 dark:border-red-700',
  warning: 'bg-white border-amber-200 dark:bg-stone-800 dark:border-amber-700',
  info:    'bg-white border-stone-200 dark:bg-stone-800 dark:border-stone-600',
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true))
    // Auto-dismiss
    timerRef.current = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onRemove(toast.id), 300)
    }, toast.duration ?? 3500)
    return () => clearTimeout(timerRef.current)
  }, [toast.id, toast.duration, onRemove])

  function handleDismiss() {
    clearTimeout(timerRef.current)
    setVisible(false)
    setTimeout(() => onRemove(toast.id), 300)
  }

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg
        max-w-xs w-full transition-all duration-300
        ${BG[toast.type]}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      {ICONS[toast.type]}
      <p className="text-sm text-stone-800 dark:text-stone-100 flex-1 leading-snug">{toast.message}</p>
      <button onClick={handleDismiss} className="p-0.5 rounded hover:bg-stone-100 dark:hover:bg-stone-700">
        <X className="w-3.5 h-3.5 text-stone-400" />
      </button>
    </div>
  )
}
