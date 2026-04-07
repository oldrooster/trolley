import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Category, Product } from '../lib/types'

interface Props {
  product?: Product | null
  prefillProduct?: Product | null   // base product to copy name/category/unit from when adding a variant
  categories: Category[]
  existingBaseNames?: string[]
  onSave: (data: ProductPayload) => Promise<void>
  onClose: () => void
}

export interface ProductPayload {
  category_id: number | null
  base_name: string
  variant_name: string | null
  full_name: string | null
  unit: string
}

const UNITS = ['each', 'kg', 'g', 'L', 'mL', 'dozen', 'bunch', 'bag', 'box', 'pack']

export default function ProductModal({ product, prefillProduct, categories, existingBaseNames = [], onSave, onClose }: Props) {
  const [form, setForm] = useState<ProductPayload>({
    category_id: product?.category_id ?? prefillProduct?.category_id ?? null,
    base_name: product?.base_name ?? prefillProduct?.base_name ?? '',
    variant_name: product?.variant_name ?? null,
    full_name: product?.full_name ?? null,
    unit: product?.unit ?? prefillProduct?.unit ?? 'each',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [baseNameSuggestions, setBaseNameSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const baseInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Auto-focus variant field when base name is pre-filled (adding a variant)
  useEffect(() => {
    if (prefillProduct) {
      const variantInput = document.getElementById('variant-input')
      variantInput?.focus()
    }
  }, [prefillProduct])

  function set(field: keyof ProductPayload, value: string | number | null) {
    setForm(prev => ({ ...prev, [field]: value === '' ? null : value }))
  }

  function handleBaseNameChange(value: string) {
    set('base_name', value)
    if (value.trim().length >= 1) {
      const matches = existingBaseNames.filter(n =>
        n.toLowerCase().includes(value.toLowerCase()) && n.toLowerCase() !== value.toLowerCase()
      )
      setBaseNameSuggestions(matches.slice(0, 6))
      setShowSuggestions(matches.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  function selectBaseName(name: string) {
    set('base_name', name)
    setShowSuggestions(false)
    document.getElementById('variant-input')?.focus()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.base_name.trim()) { setError('Base name is required'); return }
    setSaving(true)
    setError(null)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100 dark:border-stone-800">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            {product ? 'Edit Product' : prefillProduct ? `Add variant of ${prefillProduct.base_name}` : 'Add Product'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors">
            <X className="w-4 h-4 text-stone-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Base name with autocomplete */}
          <div className="relative">
            <label className="label block mb-1">Base name <span className="text-red-400">*</span></label>
            <input
              ref={baseInputRef}
              className="input"
              value={form.base_name}
              onChange={e => handleBaseNameChange(e.target.value)}
              onFocus={() => baseNameSuggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="e.g. Chips, Milk, Broccoli"
              autoFocus={!prefillProduct}
              autoComplete="off"
            />
            <p className="text-xs text-stone-400 mt-1">The generic product name — shared across variants</p>

            {showSuggestions && (
              <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg overflow-hidden">
                {baseNameSuggestions.map(name => (
                  <button
                    key={name}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                    onMouseDown={() => selectBaseName(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label block mb-1">Variant <span className="text-stone-300 dark:text-stone-600">(optional)</span></label>
            <input
              id="variant-input"
              className="input"
              value={form.variant_name ?? ''}
              onChange={e => set('variant_name', e.target.value)}
              placeholder="e.g. Salt & Vinegar, Plain, Wholemeal"
            />
            <p className="text-xs text-stone-400 mt-1">Leave blank for a generic "any variety" entry</p>
          </div>

          <div>
            <label className="label block mb-1">Full Name <span className="text-stone-300 dark:text-stone-600">(optional)</span></label>
            <input
              className="input"
              value={form.full_name ?? ''}
              onChange={e => set('full_name', e.target.value)}
              placeholder="e.g. Bluebird Salt & Vinegar 150g"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1">Category</label>
              <select
                className="input"
                value={form.category_id ?? ''}
                onChange={e => set('category_id', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Uncategorised</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label block mb-1">Unit</label>
              <select
                className="input"
                value={form.unit}
                onChange={e => set('unit', e.target.value)}
              >
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Saving…' : (product ? 'Save changes' : 'Add product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
