import { useEffect, useRef, useState, useCallback } from 'react'
import {
  ShoppingCart, Plus, Check, Trash2, Archive, ChevronDown, ChevronUp, X
} from 'lucide-react'
import { api } from '../lib/api'
import type { ShoppingList, ShoppingListItem, Product } from '../lib/types'
import { useDebounce } from '../hooks/useDebounce'
import SuggestionsBanner from '../components/SuggestionsBanner'
import { ListSkeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AddItemPayload {
  product_id?: number
  custom_name?: string
  quantity: number
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ShoppingListPage() {
  const [list, setList] = useState<ShoppingList | null>(null)
  const [loading, setLoading] = useState(true)
  const [archiving, setArchiving] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showChecked, setShowChecked] = useState(true)
  const [suggestionRefresh, setSuggestionRefresh] = useState(0)
  const { success, error } = useToast()

  const loadList = useCallback(async () => {
    try {
      const data = await api.list.active() as ShoppingList
      setList(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadList() }, [loadList])

  async function handleAddItem(payload: AddItemPayload) {
    const item = await api.list.addItem(payload) as ShoppingListItem
    setList(prev => prev ? { ...prev, items: [...prev.items, item] } : prev)
    setSuggestionRefresh(n => n + 1)
  }

  async function handleAddSuggestion(product: Product) {
    await handleAddItem({ product_id: product.id, quantity: 1 })
  }

  async function handleToggle(item: ShoppingListItem) {
    const updated = await api.list.updateItem(item.id, { checked: !item.checked }) as ShoppingListItem
    setList(prev => prev ? {
      ...prev,
      items: prev.items.map(i => i.id === updated.id ? updated : i)
    } : prev)
  }

  async function handleQtyChange(item: ShoppingListItem, qty: number) {
    if (qty < 0.5) return
    const updated = await api.list.updateItem(item.id, { quantity: qty }) as ShoppingListItem
    setList(prev => prev ? {
      ...prev,
      items: prev.items.map(i => i.id === updated.id ? updated : i)
    } : prev)
  }

  async function handleDelete(itemId: number) {
    await api.list.deleteItem(itemId)
    setList(prev => prev ? {
      ...prev,
      items: prev.items.filter(i => i.id !== itemId)
    } : prev)
  }

  async function handleArchive() {
    setArchiving(true)
    try {
      const newList = await api.list.archive() as ShoppingList
      setList(newList)
      setShowArchiveConfirm(false)
      success('Shop completed and archived!')
    } catch {
      error('Failed to archive list')
    } finally {
      setArchiving(false)
    }
  }

  if (loading) return <ListSkeleton />

  const unchecked = list?.items.filter(i => !i.checked) ?? []
  const checked = list?.items.filter(i => i.checked) ?? []

  // Group unchecked by category
  const grouped = groupByCategory(unchecked)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="page-header">Shopping List</h1>
        {(list?.items.length ?? 0) > 0 && (
          <button
            onClick={() => setShowArchiveConfirm(true)}
            className="btn-ghost flex items-center gap-2 text-stone-500"
          >
            <Archive className="w-4 h-4" />
            <span className="hidden sm:inline">Complete shop</span>
          </button>
        )}
      </div>

      {/* Progress bar */}
      {(list?.items.length ?? 0) > 0 && (
        <ProgressBar total={list!.items.length} checked={checked.length} />
      )}

      {/* Smart suggestions */}
      <SuggestionsBanner
        onAddItem={handleAddSuggestion}
        refreshKey={suggestionRefresh}
      />

      {/* Add item */}
      <AddItemRow onAdd={handleAddItem} />

      {/* Empty state */}
      {list?.items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mb-4">
            <ShoppingCart className="w-7 h-7 text-brand-400" />
          </div>
          <p className="text-stone-500 text-sm">Your list is empty.</p>
          <p className="text-stone-400 text-xs mt-1">Start typing above to add items.</p>
        </div>
      )}

      {/* Unchecked items — grouped by category */}
      {grouped.map(({ label, icon, items }) => (
        <div key={label}>
          {grouped.length > 1 && (
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <span>{icon}</span>{label}
            </h2>
          )}
          <div className="card divide-y divide-stone-100">
            {items.map(item => (
              <ListItemRow
                key={item.id}
                item={item}
                onToggle={handleToggle}
                onQtyChange={handleQtyChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Checked items */}
      {checked.length > 0 && (
        <div>
          <button
            onClick={() => setShowChecked(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2 hover:text-stone-600 transition-colors"
          >
            {showChecked ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            In trolley ({checked.length})
          </button>
          {showChecked && (
            <div className="card divide-y divide-stone-100 opacity-60">
              {checked.map(item => (
                <ListItemRow
                  key={item.id}
                  item={item}
                  onToggle={handleToggle}
                  onQtyChange={handleQtyChange}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Archive confirmation */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-stone-900">Complete shop?</h2>
              <p className="text-sm text-stone-500 mt-1">
                This list will be archived and a fresh one started.
                {checked.length < (list?.items.length ?? 0) && (
                  <span className="block mt-1 text-amber-600">
                    {(list?.items.length ?? 0) - checked.length} item{(list?.items.length ?? 0) - checked.length !== 1 ? 's' : ''} still unchecked.
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowArchiveConfirm(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handleArchive} disabled={archiving} className="btn-primary flex-1">
                {archiving ? 'Archiving…' : 'Complete shop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Add item row ──────────────────────────────────────────────────────────────

function AddItemRow({ onAdd }: { onAdd: (p: AddItemPayload) => Promise<void> }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [adding, setAdding] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useDebounce(query, 180)

  // Fetch suggestions
  useEffect(() => {
    if (debouncedQuery.trim().length < 1) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }
    api.catalogue.search(debouncedQuery)
      .then(data => {
        setSuggestions(data as Product[])
        setShowDropdown(true)
        setSelectedIndex(-1)
      })
      .catch(console.error)
  }, [debouncedQuery])

  async function addItem(product?: Product) {
    if (adding) return
    const name = query.trim()
    if (!name && !product) return
    setAdding(true)
    try {
      await onAdd(
        product
          ? { product_id: product.id, quantity: 1 }
          : { custom_name: name, quantity: 1 }
      )
      setQuery('')
      setSuggestions([])
      setShowDropdown(false)
      inputRef.current?.focus()
    } finally {
      setAdding(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        addItem(suggestions[selectedIndex])
      } else {
        addItem()
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setSelectedIndex(-1)
    }
  }

  return (
    <div className="relative">
      <div className="card flex items-center gap-2 p-2">
        <input
          ref={inputRef}
          className="flex-1 px-2 py-1.5 text-sm focus:outline-none placeholder:text-stone-400 bg-transparent"
          placeholder="Add an item… chips, milk, whitakers blondie"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          autoComplete="off"
        />
        {query && (
          <button onClick={() => { setQuery(''); setSuggestions([]); setShowDropdown(false) }}
            className="p-1 rounded hover:bg-stone-100">
            <X className="w-3.5 h-3.5 text-stone-400" />
          </button>
        )}
        <button
          onClick={() => addItem()}
          disabled={!query.trim() || adding}
          className="btn-primary flex items-center gap-1.5 py-1.5 px-3 disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {/* Autocomplete dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 card shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((product, idx) => (
            <button
              key={product.id}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${
                idx === selectedIndex ? 'bg-brand-50 text-brand-700' : 'hover:bg-stone-50'
              }`}
              onMouseDown={() => addItem(product)}
            >
              <span>
                <span className="font-medium">{product.display_name ?? product.base_name}</span>
                {product.variant_name && product.base_name !== product.display_name && (
                  <span className="text-stone-400 ml-2 text-xs">{product.base_name}</span>
                )}
              </span>
              {product.category && (
                <span className="text-xs text-stone-400 shrink-0 ml-3">
                  {product.category.icon} {product.category.name}
                </span>
              )}
            </button>
          ))}
          {/* Add as custom option */}
          <button
            className="w-full text-left px-4 py-2.5 text-sm text-stone-500 hover:bg-stone-50 border-t border-stone-100 flex items-center gap-2"
            onMouseDown={() => addItem()}
          >
            <Plus className="w-3.5 h-3.5" />
            Add "{query}" as custom item
          </button>
        </div>
      )}
    </div>
  )
}

// ── List item row ─────────────────────────────────────────────────────────────

function ListItemRow({
  item,
  onToggle,
  onQtyChange,
  onDelete,
}: {
  item: ShoppingListItem
  onToggle: (item: ShoppingListItem) => void
  onQtyChange: (item: ShoppingListItem, qty: number) => void
  onDelete: (id: number) => void
}) {
  const name = item.product?.display_name
    ?? item.product?.base_name
    ?? item.custom_name
    ?? 'Unknown item'

  return (
    <div className={`flex items-center gap-3 px-4 py-3 group transition-colors ${item.checked ? 'bg-stone-50/50' : ''}`}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(item)}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors touch-manipulation ${
          item.checked
            ? 'bg-brand-500 border-brand-500'
            : 'border-stone-300 hover:border-brand-400'
        }`}
      >
        {item.checked && <Check className="w-3 h-3 text-white" />}
      </button>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate transition-colors ${
          item.checked ? 'line-through text-stone-400' : 'text-stone-800'
        }`}>
          {name}
        </p>
        {item.product?.category && !item.checked && (
          <p className="text-xs text-stone-400 truncate">
            {item.product.category.icon} {item.product.category.name}
          </p>
        )}
      </div>

      {/* Qty stepper */}
      {!item.checked && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onQtyChange(item, item.quantity - 1)}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 text-sm font-medium flex items-center justify-center transition-colors touch-manipulation"
          >
            −
          </button>
          <span className="text-sm font-medium text-stone-700 w-8 text-center">
            {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)}
            {item.unit && item.unit !== 'each' ? <span className="text-xs text-stone-400 ml-0.5">{item.unit}</span> : ''}
          </span>
          <button
            onClick={() => onQtyChange(item, item.quantity + 1)}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 text-sm font-medium flex items-center justify-center transition-colors touch-manipulation"
          >
            +
          </button>
        </div>
      )}

      {/* Delete */}
      <button
        onClick={() => onDelete(item.id)}
        className="p-2 rounded-lg opacity-30 group-hover:opacity-100 hover:bg-red-50 transition-all touch-manipulation"
      >
        <Trash2 className="w-4 h-4 text-red-400" />
      </button>
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ total, checked }: { total: number; checked: number }) {
  const pct = total === 0 ? 0 : Math.round((checked / total) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-stone-400">{checked} of {total} in trolley</span>
        <span className="text-xs font-medium text-brand-600">{pct}%</span>
      </div>
      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Grouping helper ───────────────────────────────────────────────────────────

function groupByCategory(items: ShoppingListItem[]) {
  const groups: Record<string, { label: string; icon: string; items: ShoppingListItem[] }> = {}

  for (const item of items) {
    const cat = item.product?.category
    const key = cat ? String(cat.id) : '__none__'
    const label = cat?.name ?? 'Other'
    const icon = cat?.icon ?? ''
    if (!groups[key]) groups[key] = { label, icon, items: [] }
    groups[key].items.push(item)
  }

  return Object.values(groups).sort((a, b) => a.label.localeCompare(b.label))
}
