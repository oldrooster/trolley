import { useEffect, useState } from 'react'
import { Sparkles, Plus, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../lib/api'
import type { Product } from '../lib/types'

interface Props {
  onAddItem: (product: Product) => Promise<void>
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

const MINIMISED_KEY = 'trolley_suggestions_minimised'

export default function SuggestionsBanner({ onAddItem, refreshKey }: Props) {
  const [data, setData] = useState<SuggestionsData | null>(null)
  const [minimised, setMinimised] = useState(() => {
    try { return localStorage.getItem(MINIMISED_KEY) === '1' } catch { return false }
  })
  const [expanded, setExpanded] = useState(false)
  const [adding, setAdding] = useState<number | null>(null)
  const [added, setAdded] = useState<Set<number>>(new Set())

  useEffect(() => {
    api.insights.suggestions()
      .then(d => setData(d as SuggestionsData))
      .catch(() => {})
  }, [refreshKey])

  if (!data || data.source === 'none' || data.items.length === 0) return null

  function toggleMinimised() {
    const next = !minimised
    setMinimised(next)
    try { localStorage.setItem(MINIMISED_KEY, next ? '1' : '0') } catch {}
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
      {/* Header — always visible */}
      <button
        onClick={toggleMinimised}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-brand-100 transition-colors text-left"
      >
        <Sparkles className="w-4 h-4 text-brand-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-brand-800">Do you need any of these?</p>
          {!minimised && <p className="text-xs text-brand-500">{SOURCE_COPY[data.source]}</p>}
        </div>
        {minimised
          ? <ChevronDown className="w-4 h-4 text-brand-400 shrink-0" />
          : <ChevronUp className="w-4 h-4 text-brand-400 shrink-0" />
        }
      </button>

      {/* Items — hidden when minimised */}
      {!minimised && (
        <>
          <div className="divide-y divide-brand-100 border-t border-brand-100">
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
        </>
      )}
    </div>
  )
}
