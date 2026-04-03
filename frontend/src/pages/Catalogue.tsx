import { useEffect, useState, useCallback } from 'react'
import { Package, Plus, Search, Pencil, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import type { Category, Product } from '../lib/types'
import { useDebounce } from '../hooks/useDebounce'
import ProductModal, { type ProductPayload } from '../components/ProductModal'
import { CatalogueSkeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'

export default function Catalogue() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { success, error } = useToast()

  const debouncedQuery = useDebounce(query, 250)

  // Load categories once
  useEffect(() => {
    api.catalogue.categories().then(data => setCategories(data as Category[])).catch(console.error)
  }, [])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      let data: Product[]
      if (debouncedQuery.trim().length >= 1) {
        data = (await api.catalogue.search(debouncedQuery)) as Product[]
      } else {
        data = (await api.catalogue.list(
          selectedCategory ? { category_id: selectedCategory } : undefined
        )) as Product[]
      }
      setProducts(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, selectedCategory])

  useEffect(() => { loadProducts() }, [loadProducts])

  async function handleSave(payload: ProductPayload) {
    if (modal === 'edit' && editing) {
      await api.catalogue.update(editing.id, payload)
      success('Product updated')
    } else {
      await api.catalogue.create(payload)
      success('Product added to catalogue')
    }
    await loadProducts()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.catalogue.delete(deleteTarget.id)
      setDeleteTarget(null)
      success('Product deleted')
      await loadProducts()
    } catch {
      error('Failed to delete product')
    } finally {
      setDeleting(false)
    }
  }

  function openEdit(product: Product) {
    setEditing(product)
    setModal('edit')
  }

  // Group products by category when not searching
  const grouped = debouncedQuery.trim()
    ? null
    : categories.reduce<Record<number, { category: Category; products: Product[] }>>((acc, cat) => {
        const catProducts = products.filter(p => p.category_id === cat.id)
        if (catProducts.length > 0) acc[cat.id] = { category: cat, products: catProducts }
        return acc
      }, {})

  const uncategorised = products.filter(p => !p.category_id)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="page-header">Product Catalogue</h1>
        <button
          onClick={() => { setEditing(null); setModal('add') }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
        <input
          className="input pl-9"
          placeholder="Search products… (chips, milk, bluebird)"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-stone-100"
          >
            <X className="w-3.5 h-3.5 text-stone-400" />
          </button>
        )}
      </div>

      {/* Category filter pills — hidden while searching */}
      {!debouncedQuery && (
        <div className="flex gap-2 flex-wrap">
          <CategoryPill
            label="All"
            active={selectedCategory === null}
            onClick={() => setSelectedCategory(null)}
          />
          {categories.map(cat => (
            <CategoryPill
              key={cat.id}
              label={`${cat.icon ?? ''} ${cat.name}`}
              active={selectedCategory === cat.id}
              onClick={() => setSelectedCategory(cat.id)}
            />
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <CatalogueSkeleton />
      ) : products.length === 0 ? (
        <EmptyState query={debouncedQuery} onAdd={() => { setEditing(null); setModal('add') }} />
      ) : debouncedQuery.trim() ? (
        /* Flat search results */
        <div className="card divide-y divide-stone-100">
          {products.map(p => (
            <ProductRow key={p.id} product={p} onEdit={openEdit} onDelete={setDeleteTarget} />
          ))}
        </div>
      ) : (
        /* Grouped by category */
        <div className="space-y-6">
          {grouped && Object.values(grouped).map(({ category, products: catProducts }) => (
            <div key={category.id}>
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <span>{category.icon}</span>{category.name}
                <span className="font-normal text-stone-300">({catProducts.length})</span>
              </h2>
              <div className="card divide-y divide-stone-100">
                {catProducts.map(p => (
                  <ProductRow key={p.id} product={p} onEdit={openEdit} onDelete={setDeleteTarget} />
                ))}
              </div>
            </div>
          ))}
          {uncategorised.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                Uncategorised <span className="font-normal text-stone-300">({uncategorised.length})</span>
              </h2>
              <div className="card divide-y divide-stone-100">
                {uncategorised.map(p => (
                  <ProductRow key={p.id} product={p} onEdit={openEdit} onDelete={setDeleteTarget} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit modal */}
      {modal && (
        <ProductModal
          product={modal === 'edit' ? editing : null}
          categories={categories}
          onSave={handleSave}
          onClose={() => { setModal(null); setEditing(null) }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-stone-900">Delete product?</h2>
              <p className="text-sm text-stone-500 mt-1">
                <span className="font-medium text-stone-700">{deleteTarget.display_name ?? deleteTarget.base_name}</span> will be permanently removed from the catalogue.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CategoryPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-brand-500 text-white border-brand-500'
          : 'bg-white text-stone-600 border-stone-200 hover:border-brand-400 hover:text-brand-600'
      }`}
    >
      {label}
    </button>
  )
}

function ProductRow({
  product,
  onEdit,
  onDelete,
}: {
  product: Product
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
}) {
  const displayName = product.display_name ?? product.base_name

  return (
    <div className="flex items-center gap-3 px-4 py-3 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 truncate">{displayName}</p>
        {(product.variant_name || product.brand_name) && (
          <p className="text-xs text-stone-400 truncate">
            {product.base_name}{product.variant_name ? ` · ${product.variant_name}` : ''}
          </p>
        )}
      </div>
      <span className="text-xs text-stone-400 shrink-0">{product.unit}</span>
      <div className="flex items-center gap-1 opacity-30 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(product)}
          className="p-2 rounded-lg hover:bg-stone-100 transition-colors touch-manipulation"
          title="Edit"
        >
          <Pencil className="w-4 h-4 text-stone-500" />
        </button>
        <button
          onClick={() => onDelete(product)}
          className="p-2 rounded-lg hover:bg-red-50 transition-colors touch-manipulation"
          title="Delete"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>
      </div>
    </div>
  )
}

function EmptyState({ query, onAdd }: { query: string; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mb-4">
        <Package className="w-7 h-7 text-brand-400" />
      </div>
      {query ? (
        <>
          <p className="text-stone-500 text-sm">No products match "{query}"</p>
          <button onClick={onAdd} className="btn-primary mt-4">Add "{query}" to catalogue</button>
        </>
      ) : (
        <>
          <p className="text-stone-500 text-sm">No products in this category.</p>
          <button onClick={onAdd} className="btn-primary mt-4">Add a product</button>
        </>
      )}
    </div>
  )
}
