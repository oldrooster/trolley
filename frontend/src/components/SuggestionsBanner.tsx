import { useEffect, useState } from 'react'
import { Sparkles, Plus, X, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../lib/api'
import type { Product } from '../lib/types'

interface Props {
  /** Called when the user clicks + on a suggestion — add it to the list */
  onAddItem: (product: Product) => Promise<void>
  /** Re-fetch suggestions when this changes (e.g. list item count) */
  refreshKey?: number
}

interface SuggestionsData {
  source: 'history' | 'staples' | 'mixed' | 'none'
  items: Product[]
}

const SOURCE_COPY: Record<string, string> = {
  history: 'Based on your shopping history',
  staples: 'Everyday essentials to consider',
  mixed:   'Based on your history & essentials',
}

const DISMISS_KEY = 'trolley_suggestions_dismissed'
const DISMISS_TTL_MS = 12 * 60 * 60 * 1000  // 12 hours

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    return Date.now() - parseInt(raw, 10) < DISMISS_TTL_MS
  } catch {
    return false
  }
}

function dismiss() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
}

export default function SuggestionsBanner({ onAddItem, refreshKey }: Props) {
  const [data, setData] = useState<SuggestionsData | null>(null)
  const [dismissed, setDismissed] = useState(isDismissed)
  const [expanded, setExpanded] = useState(false)
  const [adding, setAdding] = useState<number | null>(null)
  const [added, setAdded] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (dismissed) return
    api.insights.suggestions()
      .then(d => setData(d as SuggestionsData))
      .catch(() => {})
  }, [refreshKey, dismissed])

  if (dismissed || !data || data.source === 'none' || data.items.length === 0) {
    return null
  }

  function handleDismiss() {
    dismiss()
    setDismissed(true)
  }

  async function handleAdd(product: Product) {
    if (adding) return
    setAdding(product.id)
    try {
      await onAddItem(product)
      setAdded(prev => new Set([...prev, product.id]))
    } finally {
      setAdding(null)
    }
  }

  const visible = expanded ? data.items : data.items.slice(0, 5)
  const hasMore = data.items.length > 5

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-brand-100">
        <Sparkles className="w-4 h-4 text-brand-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-brand-800">Do you need any of these?</p>
          <p className="text-xs text-brand-500">{SOURCE_COPY[data.source]}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-lg hover:bg-brand-100 transition-colors"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5 text-brand-400" />
        </button>
      </div>

      {/* Items */}
      <div className="divide-y divide-brand-100">
        {visible.map(product => {
          const isAdded = added.has(product.id)
          const isAdding = adding === product.id
          const name = product.display_name ?? product.base_name

          return (
            <div key={product.id} className="flex items-center gap-3 px-4 py-2.5">
              <ShoppingCart className="w-3.5 h-3.5 text-brand-400 shrink-0" />
              <span className="flex-1 text-sm text-brand-900 truncate">{name}</span>
              {product.category && (
                <span className="text-[10px] text-brand-400 shrink-0 hidden sm:block">
                  {product.category.icon} {product.category.name}
                </span>
              )}
              <button
                onClick={() => !isAdded && handleAdd(product)}
                disabled={isAdding || isAdded}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                  isAdded
                    ? 'bg-brand-200 text-brand-700 cursor-default'
                    : 'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700'
                }`}
              >
                {isAdded ? (
                  '✓ Added'
                ) : isAdding ? (
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  <><Plus className="w-3 h-3" /> Add</>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Show more / less */}
      {hasMore && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-brand-600 hover:bg-brand-100 transition-colors border-t border-brand-100"
        >
          {expanded ? (
            <><ChevronUp className="w-3 h-3" /> Show fewer</>
          ) : (
            <><ChevronDown className="w-3 h-3" /> Show {data.items.length - 5} more</>
          )}
        </button>
      )}
    </div>
  )
}
