import { useEffect, useState, useCallback } from 'react'
import { Package, Plus, Search, Pencil, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react'
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
  const [prefillBase, setPrefillBase] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { success, error } = useToast()

  const debouncedQuery = useDebounce(query, 250)

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
      // Optimistic update — remove from local state without reloading (avoids scroll jump)
      setProducts(prev => prev.filter(p => p.id !== deleteTarget.id))
      setDeleteTarget(null)
      success('Product deleted')
    } catch {
      error('Failed to delete product')
    } finally {
      setDeleting(false)
    }
  }

  function openEdit(product: Product) {
    setEditing(product)
    setPrefillBase(null)
    setModal('edit')
  }

  function openAddVariant(baseProduct: Product) {
    setEditing(null)
    setPrefillBase(baseProduct)
    setModal('add')
  }

  function openAdd() {
    setEditing(null)
    setPrefillBase(null)
    setModal('add')
  }

  // Group products by base_name within each category
  function groupByBase(prods: Product[]): Record<string, Product[]> {
    return prods.reduce<Record<string, Product[]>>((acc, p) => {
      const key = p.base_name.trim().toLowerCase()
      if (!acc[key]) acc[key] = []
      acc[key].push(p)
      return acc
    }, {})
  }

  const grouped = debouncedQuery.trim()
    ? null
    : categories.reduce<Record<number, { category: Category; products: Product[] }>>((acc, cat) => {
        const catProducts = products.filter(p => p.category_id === cat.id)
        if (catProducts.length > 0) acc[cat.id] = { category: cat, products: catProducts }
        return acc
      }, {})

  const uncategorised = products.filter(p => !p.category_id)

  // All base names for autocomplete in modal
  const existingBaseNames = [...new Set(products.map(p => p.base_name))]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="page-header">Product Catalogue</h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
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
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-stone-100 dark:hover:bg-stone-700"
          >
            <X className="w-3.5 h-3.5 text-stone-400" />
          </button>
        )}
      </div>

      {/* Category filter pills */}
      {!debouncedQuery && (
        <div className="flex gap-2 flex-wrap">
          <CategoryPill label="All" active={selectedCategory === null} onClick={() => setSelectedCategory(null)} />
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
        <EmptyState query={debouncedQuery} onAdd={openAdd} />
      ) : debouncedQuery.trim() ? (
        /* Search results — wrapped in card, grouped by base_name */
        <div className="card divide-y divide-stone-100">
          {Object.entries(groupByBase(products)).map(([, group]) => (
            <BaseGroup
              key={group[0].base_name}
              products={group}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onAddVariant={openAddVariant}
            />
          ))}
        </div>
      ) : (
        /* Grouped by category, then by base_name */
        <div className="space-y-6">
          {grouped && Object.values(grouped).map(({ category, products: catProducts }) => (
            <div key={category.id}>
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <span>{category.icon}</span>{category.name}
                <span className="font-normal text-stone-300">({catProducts.length})</span>
              </h2>
              <div className="card divide-y divide-stone-100">
                {Object.entries(groupByBase(catProducts)).map(([, group]) => (
                  <BaseGroup
                    key={group[0].base_name}
                    products={group}
                    onEdit={openEdit}
                    onDelete={setDeleteTarget}
                    onAddVariant={openAddVariant}
                  />
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
                {Object.entries(groupByBase(uncategorised)).map(([, group]) => (
                  <BaseGroup
                    key={group[0].base_name}
                    products={group}
                    onEdit={openEdit}
                    onDelete={setDeleteTarget}
                    onAddVariant={openAddVariant}
                  />
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
          prefillProduct={prefillBase}
          categories={categories}
          existingBaseNames={existingBaseNames}
          onSave={handleSave}
          onClose={() => { setModal(null); setEditing(null); setPrefillBase(null) }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">Delete product?</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                <span className="font-medium text-stone-700 dark:text-stone-300">{deleteTarget.display_name ?? deleteTarget.base_name}</span> will be permanently removed from the catalogue.
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

// ── BaseGroup — collapses variants under a base name ──────────────────────────

function BaseGroup({
  products,
  onEdit,
  onDelete,
  onAddVariant,
}: {
  products: Product[]
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
  onAddVariant: (baseProduct: Product) => void
}) {
  const baseProduct = products.find(p => !p.variant_name && !p.brand_name) ?? products[0]
  const baseName = baseProduct.base_name
  const hasVariants = products.length > 1 || products[0].variant_name || products[0].brand_name
  const [open, setOpen] = useState(true)

  if (!hasVariants) {
    // Single generic product — render flat with Add variant button
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 group">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">{baseName}</p>
        </div>
        <span className="text-xs text-stone-400 shrink-0">{baseProduct.unit}</span>
        <button
          onClick={() => onAddVariant(baseProduct)}
          className="p-1.5 rounded-lg text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors opacity-0 group-hover:opacity-100 touch-manipulation shrink-0"
          title="Add variant"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-1 opacity-30 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(baseProduct)} className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors touch-manipulation" title="Edit">
            <Pencil className="w-4 h-4 text-stone-500" />
          </button>
          <button onClick={() => onDelete(baseProduct)} className="p-2 rounded-lg hover:bg-red-50 transition-colors touch-manipulation" title="Delete">
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Base header row */}
      <div className="flex items-center gap-2 px-4 py-2.5 group">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {open
            ? <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          }
          <span className="text-sm font-semibold text-stone-700 dark:text-stone-300">{baseName}</span>
          <span className="text-xs text-stone-400">({products.length} variant{products.length !== 1 ? 's' : ''})</span>
        </button>
        <button
          onClick={() => onAddVariant(baseProduct)}
          className="p-1.5 rounded-lg text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors opacity-0 group-hover:opacity-100 touch-manipulation shrink-0"
          title="Add variant"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Variants */}
      {open && (
        <div className="border-t border-stone-50 dark:border-stone-800">
          {products.map(p => (
            <ProductRow
              key={p.id}
              product={p}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddVariant={onAddVariant}
              indent
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── ProductRow ────────────────────────────────────────────────────────────────

function ProductRow({
  product,
  onEdit,
  onDelete,
  indent = false,
}: {
  product: Product
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
  onAddVariant?: (baseProduct: Product) => void
  indent?: boolean
}) {
  const displayName = product.variant_name ?? product.brand_name ?? product.base_name
  const subtitle = product.brand_name && product.variant_name ? product.brand_name : null

  return (
    <div className={`flex items-center gap-3 py-2.5 group ${indent ? 'pl-9 pr-4' : 'px-4'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">{displayName}</p>
        {subtitle && <p className="text-xs text-stone-400 truncate">{subtitle}</p>}
      </div>
      <span className="text-xs text-stone-400 shrink-0">{product.unit}</span>
      <div className="flex items-center gap-1 opacity-30 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(product)}
          className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors touch-manipulation"
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

// ── CategoryPill ──────────────────────────────────────────────────────────────

function CategoryPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-brand-500 text-white border-brand-500'
          : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-brand-400 hover:text-brand-600'
      }`}
    >
      {label}
    </button>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────

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
