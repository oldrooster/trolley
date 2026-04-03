import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Category, Product } from '../lib/types'

interface Props {
  product?: Product | null
  categories: Category[]
  onSave: (data: ProductPayload) => Promise<void>
  onClose: () => void
}

export interface ProductPayload {
  category_id: number | null
  base_name: string
  variant_name: string | null
  brand_name: string | null
  unit: string
}

const UNITS = ['each', 'kg', 'g', 'L', 'mL', 'dozen', 'bunch', 'bag', 'box', 'pack']

export default function ProductModal({ product, categories, onSave, onClose }: Props) {
  const [form, setForm] = useState<ProductPayload>({
    category_id: product?.category_id ?? null,
    base_name: product?.base_name ?? '',
    variant_name: product?.variant_name ?? null,
    brand_name: product?.brand_name ?? null,
    unit: product?.unit ?? 'each',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function set(field: keyof ProductPayload, value: string | number | null) {
    setForm(prev => ({ ...prev, [field]: value === '' ? null : value }))
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
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-900">
            {product ? 'Edit Product' : 'Add Product'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <X className="w-4 h-4 text-stone-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label block mb-1">Base name <span className="text-red-400">*</span></label>
            <input
              className="input"
              value={form.base_name}
              onChange={e => set('base_name', e.target.value)}
              placeholder="e.g. Chips, Milk, Broccoli"
              autoFocus
            />
            <p className="text-xs text-stone-400 mt-1">The generic product name</p>
          </div>

          <div>
            <label className="label block mb-1">Variant <span className="text-stone-300">(optional)</span></label>
            <input
              className="input"
              value={form.variant_name ?? ''}
              onChange={e => set('variant_name', e.target.value)}
              placeholder="e.g. Salt & Vinegar, Low Fat"
            />
          </div>

          <div>
            <label className="label block mb-1">Brand / Full product name <span className="text-stone-300">(optional)</span></label>
            <input
              className="input"
              value={form.brand_name ?? ''}
              onChange={e => set('brand_name', e.target.value)}
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
