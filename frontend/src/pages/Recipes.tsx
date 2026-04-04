import { useEffect, useState, useCallback } from 'react'
import {
  BookOpen, Search, X, Clock, Users, Pencil, Trash2,
  Link, Sparkles, ChevronLeft, Upload, CheckCircle, Package
} from 'lucide-react'
import { api } from '../lib/api'
import type { Recipe, Product, Category } from '../lib/types'
import { CardGridSkeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'

function fuzzyMatchProduct(name: string, products: Product[]): Product | null {
  const lower = name.toLowerCase()
  let best: Product | null = null
  let bestScore = 0
  for (const p of products) {
    for (const field of [p.base_name, p.variant_name, p.brand_name]) {
      if (!field) continue
      const fl = field.toLowerCase()
      if (lower.includes(fl) || fl.includes(lower)) {
        const score = fl.length
        if (score > bestScore) { bestScore = score; best = p }
      }
    }
  }
  return bestScore >= 3 ? best : null
}

type View = 'list' | 'detail' | 'edit' | 'add-url' | 'add-ai'

// ── Main component ────────────────────────────────────────────────────────────

export default function Recipes() {
  const [view, setView] = useState<View>('list')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const { success } = useToast()

  const loadRecipes = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.recipes.list(query || undefined) as Recipe[]
      setRecipes(data)
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => { loadRecipes() }, [loadRecipes])

  useEffect(() => {
    Promise.all([
      api.catalogue.categories().then(d => setCategories(d as Category[])),
      api.catalogue.list().then(d => setProducts(d as Product[])),
    ]).catch(console.error)
  }, [])

  async function openRecipe(recipe: Recipe) {
    const full = await api.recipes.get(recipe.id) as Recipe
    setSelected(full)
    setView('detail')
  }

  async function handleSave(data: RecipeFormData, editingId?: number) {
    if (editingId) {
      const updated = await api.recipes.update(editingId, data) as Recipe
      setRecipes(prev => prev.map(r => r.id === editingId ? updated : r))
      setSelected(updated)
      setView('detail')
      success('Recipe saved')
    } else {
      const created = await api.recipes.create(data) as Recipe
      setRecipes(prev => [...prev, created])
      setSelected(created)
      setView('detail')
      success('Recipe added')
    }
  }

  async function handleDelete(recipe: Recipe) {
    await api.recipes.delete(recipe.id)
    setRecipes(prev => prev.filter(r => r.id !== recipe.id))
    setView('list')
    setSelected(null)
    success(`"${recipe.name}" deleted`)
  }

  async function handleImageUpload(recipeId: number, file: File) {
    const updated = await api.recipes.uploadImage(recipeId, file) as Recipe
    setSelected(updated)
    setRecipes(prev => prev.map(r => r.id === recipeId ? updated : r))
  }

  // ── List view
  if (view === 'list') {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="page-header">Recipes</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setView('add-url')} className="btn-secondary flex items-center gap-2">
              <Link className="w-4 h-4" /> URL
            </button>
            <button onClick={() => setView('add-ai')} className="btn-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> AI Generate
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            className="input pl-9"
            placeholder="Search your recipes…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-stone-100">
              <X className="w-3.5 h-3.5 text-stone-400" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recipes.length === 0 ? (
          <EmptyState onUrl={() => setView('add-url')} onAI={() => setView('add-ai')} />
        ) : loading ? (
          <CardGridSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recipes.map(r => (
              <RecipeCard key={r.id} recipe={r} onClick={() => openRecipe(r)} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Detail view
  if (view === 'detail' && selected) {
    return (
      <RecipeDetail
        recipe={selected}
        onBack={() => setView('list')}
        onEdit={() => setView('edit')}
        onDelete={() => handleDelete(selected)}
        onImageUpload={(f) => handleImageUpload(selected.id, f)}
      />
    )
  }

  // ── Edit view
  if (view === 'edit' && selected) {
    return (
      <RecipeForm
        initial={selected}
        categories={categories}
        products={products}
        onSave={(data) => handleSave(data, selected.id)}
        onCancel={() => setView('detail')}
      />
    )
  }

  // ── Add via URL
  if (view === 'add-url') {
    return (
      <AddViaUrl
        onSave={async (url) => {
          const draft = await api.recipes.parseUrl(url) as Recipe
          setSelected(draft)
          setView('edit')
        }}
        onCancel={() => setView('list')}
      />
    )
  }

  // ── Add via AI
  if (view === 'add-ai') {
    return (
      <AddViaAI
        onSave={async (desc) => {
          const draft = await api.recipes.generate(desc) as Recipe
          setSelected(draft)
          setView('edit')
        }}
        onCancel={() => setView('list')}
      />
    )
  }

  return null
}

// ── Recipe card ───────────────────────────────────────────────────────────────

function RecipeCard({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  const time = (recipe.prep_time_mins ?? 0) + (recipe.cook_time_mins ?? 0)
  return (
    <button
      onClick={onClick}
      className="card text-left overflow-hidden hover:shadow-md transition-shadow group"
    >
      {recipe.image_path ? (
        <img src={recipe.image_path} alt={recipe.name} className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center">
          <BookOpen className="w-10 h-10 text-brand-300" />
        </div>
      )}
      <div className="p-4">
        <p className="text-sm font-semibold text-stone-800 group-hover:text-brand-600 transition-colors">{recipe.name}</p>
        {recipe.description && (
          <p className="text-xs text-stone-400 mt-0.5 line-clamp-2">{recipe.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2">
          {time > 0 && (
            <span className="flex items-center gap-1 text-xs text-stone-400">
              <Clock className="w-3 h-3" /> {time} min
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1 text-xs text-stone-400">
              <Users className="w-3 h-3" /> {recipe.servings}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Recipe detail ─────────────────────────────────────────────────────────────

function RecipeDetail({
  recipe, onBack, onEdit, onDelete, onImageUpload
}: {
  recipe: Recipe
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onImageUpload: (f: File) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const time = (recipe.prep_time_mins ?? 0) + (recipe.cook_time_mins ?? 0)

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
          <ChevronLeft className="w-4 h-4 text-stone-600" />
        </button>
        <h1 className="page-header flex-1 truncate">{recipe.name}</h1>
        <button onClick={onEdit} className="btn-ghost flex items-center gap-2">
          <Pencil className="w-4 h-4" /> Edit
        </button>
        <button onClick={() => setConfirmDelete(true)} className="btn-ghost text-red-400 hover:text-red-600 hover:bg-red-50">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Image */}
      <div className="relative group">
        {recipe.image_path ? (
          <img src={recipe.image_path} alt={recipe.name} className="w-full h-64 object-cover rounded-xl" />
        ) : (
          <div className="w-full h-64 bg-gradient-to-br from-brand-50 to-brand-100 rounded-xl flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-brand-300" />
          </div>
        )}
        <label className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-black/20 rounded-xl">
          <div className="bg-white/90 rounded-lg px-3 py-2 flex items-center gap-2 text-sm font-medium text-stone-700">
            <Upload className="w-4 h-4" /> Change image
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onImageUpload(e.target.files[0])} />
        </label>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-4">
        {recipe.prep_time_mins && (
          <div className="text-center">
            <p className="label">Prep</p>
            <p className="text-sm font-medium text-stone-700">{recipe.prep_time_mins} min</p>
          </div>
        )}
        {recipe.cook_time_mins && (
          <div className="text-center">
            <p className="label">Cook</p>
            <p className="text-sm font-medium text-stone-700">{recipe.cook_time_mins} min</p>
          </div>
        )}
        {time > 0 && (
          <div className="text-center">
            <p className="label">Total</p>
            <p className="text-sm font-medium text-stone-700">{time} min</p>
          </div>
        )}
        {recipe.servings && (
          <div className="text-center">
            <p className="label">Serves</p>
            <p className="text-sm font-medium text-stone-700">{recipe.servings}</p>
          </div>
        )}
      </div>

      {recipe.description && (
        <p className="text-sm text-stone-600 leading-relaxed">{recipe.description}</p>
      )}

      {/* Ingredients */}
      {recipe.ingredients?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-stone-800 mb-2">Ingredients</h2>
          <div className="card divide-y divide-stone-100">
            {recipe.ingredients.map(ing => (
              <div key={ing.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
                <span className="text-sm text-stone-700 flex-1">{ing.ingredient_name}</span>
                {(ing.quantity || ing.unit) && (
                  <span className="text-xs text-stone-400">
                    {ing.quantity}{ing.unit ? ` ${ing.unit}` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Method */}
      {recipe.method && (
        <div>
          <h2 className="text-sm font-semibold text-stone-800 mb-2">Method</h2>
          <div className="card p-4 text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
            {recipe.method}
          </div>
        </div>
      )}

      {recipe.source_url && (
        <a href={recipe.source_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-brand-600 hover:text-brand-700">
          <Link className="w-3.5 h-3.5" /> Original source
        </a>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-stone-900">Delete recipe?</h2>
              <p className="text-sm text-stone-500 mt-1">"{recipe.name}" will be permanently removed.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={onDelete} className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Recipe form ───────────────────────────────────────────────────────────────

interface RecipeIngredientDraft {
  ingredient_name: string
  quantity?: number
  unit?: string
  notes?: string
  product_id?: number
  create_product?: boolean  // add to catalogue if no match
}

interface RecipeFormData {
  name: string
  description?: string
  method?: string
  source_url?: string
  servings?: number
  prep_time_mins?: number
  cook_time_mins?: number
  ingredients: RecipeIngredientDraft[]
}

function RecipeForm({
  initial, categories: _categories, products, onSave, onCancel
}: {
  initial?: Recipe
  categories: Category[]
  products: Product[]
  onSave: (data: RecipeFormData) => Promise<void>
  onCancel: () => void
}) {
  function autoMatch(ings: RecipeIngredientDraft[]): RecipeIngredientDraft[] {
    return ings.map(i => {
      if (i.product_id) return i
      const match = fuzzyMatchProduct(i.ingredient_name, products)
      return { ...i, product_id: match?.id }
    })
  }

  const [form, setForm] = useState<RecipeFormData>(() => ({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    method: initial?.method ?? '',
    source_url: initial?.source_url ?? '',
    servings: initial?.servings ?? undefined,
    prep_time_mins: initial?.prep_time_mins ?? undefined,
    cook_time_mins: initial?.cook_time_mins ?? undefined,
    ingredients: autoMatch(initial?.ingredients?.map(i => ({
      ingredient_name: i.ingredient_name,
      quantity: i.quantity ?? undefined,
      unit: i.unit ?? undefined,
      notes: i.notes ?? undefined,
      product_id: i.product_id ?? undefined,
    })) ?? []),
  }))
  const [saving, setSaving] = useState(false)
  const [ingInput, setIngInput] = useState('')
  const [ingQty, setIngQty] = useState('')
  const [ingUnit, setIngUnit] = useState('')

  function setField<K extends keyof RecipeFormData>(k: K, v: RecipeFormData[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function updateIngredient(idx: number, patch: Partial<RecipeIngredientDraft>) {
    setForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) => i === idx ? { ...ing, ...patch } : ing)
    }))
  }

  function addIngredient() {
    if (!ingInput.trim()) return
    const match = fuzzyMatchProduct(ingInput.trim(), products)
    setForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, {
        ingredient_name: ingInput.trim(),
        quantity: ingQty ? parseFloat(ingQty) : undefined,
        unit: ingUnit || undefined,
        product_id: match?.id,
      }]
    }))
    setIngInput('')
    setIngQty('')
    setIngUnit('')
  }

  function removeIngredient(idx: number) {
    setForm(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== idx) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onCancel} className="p-2 rounded-lg hover:bg-stone-100">
          <ChevronLeft className="w-4 h-4 text-stone-600" />
        </button>
        <h1 className="page-header flex-1">{initial ? 'Edit Recipe' : 'New Recipe'}</h1>
        <button type="submit" disabled={saving || !form.name.trim()} className="btn-primary">
          {saving ? 'Saving…' : 'Save recipe'}
        </button>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <label className="label block mb-1">Name <span className="text-red-400">*</span></label>
          <input className="input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Recipe name" autoFocus />
        </div>
        <div>
          <label className="label block mb-1">Description</label>
          <textarea className="input resize-none" rows={2} value={form.description ?? ''} onChange={e => setField('description', e.target.value)} placeholder="A short description…" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label block mb-1">Prep (min)</label>
            <input type="number" className="input" min={0} value={form.prep_time_mins ?? ''} onChange={e => setField('prep_time_mins', e.target.value ? Number(e.target.value) : undefined)} />
          </div>
          <div>
            <label className="label block mb-1">Cook (min)</label>
            <input type="number" className="input" min={0} value={form.cook_time_mins ?? ''} onChange={e => setField('cook_time_mins', e.target.value ? Number(e.target.value) : undefined)} />
          </div>
          <div>
            <label className="label block mb-1">Serves</label>
            <input type="number" className="input" min={1} value={form.servings ?? ''} onChange={e => setField('servings', e.target.value ? Number(e.target.value) : undefined)} />
          </div>
        </div>
        <div>
          <label className="label block mb-1">Source URL</label>
          <input className="input" type="url" value={form.source_url ?? ''} onChange={e => setField('source_url', e.target.value)} placeholder="https://…" />
        </div>
      </div>

      {/* Ingredients */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-stone-800">Ingredients</h2>
        <div className="divide-y divide-stone-100 -mx-5">
          {form.ingredients.map((ing, i) => {
            const matched = products.find(p => p.id === ing.product_id)
            return (
              <div key={i} className="px-5 py-2.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  {/* Name */}
                  <span className="flex-1 text-sm font-medium text-stone-800">{ing.ingredient_name}</span>
                  {/* Qty + unit */}
                  <span className="text-xs text-stone-400 shrink-0">
                    {ing.quantity != null ? ing.quantity : ''}
                    {ing.unit ? ` ${ing.unit}` : ''}
                  </span>
                  <button type="button" onClick={() => removeIngredient(i)} className="p-1.5 rounded-lg hover:bg-red-50 shrink-0">
                    <X className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
                {/* Match status */}
                <div className="flex items-center gap-2 flex-wrap">
                  {matched ? (
                    <span className="flex items-center gap-1 text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                      <CheckCircle className="w-3 h-3" />
                      {matched.display_name ?? matched.base_name}
                    </span>
                  ) : (
                    <label className="flex items-center gap-1.5 text-xs text-stone-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ing.create_product ?? false}
                        onChange={e => updateIngredient(i, { create_product: e.target.checked })}
                        className="rounded text-brand-500"
                      />
                      <Package className="w-3 h-3" />
                      <span className="text-stone-400">No catalogue match — add?</span>
                    </label>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {/* Add row */}
        <div className="flex gap-2 pt-1">
          <input
            className="input flex-1"
            value={ingInput}
            onChange={e => setIngInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIngredient() } }}
            placeholder="Ingredient name…"
          />
          <input
            className="input w-16 text-center"
            value={ingQty}
            onChange={e => setIngQty(e.target.value)}
            placeholder="Qty"
            type="number"
            min={0}
            step="any"
          />
          <input
            className="input w-16"
            value={ingUnit}
            onChange={e => setIngUnit(e.target.value)}
            placeholder="Unit"
          />
          <button type="button" onClick={addIngredient} className="btn-secondary shrink-0">Add</button>
        </div>
      </div>

      {/* Method */}
      <div className="card p-5">
        <label className="label block mb-2">Method</label>
        <textarea
          className="input resize-none w-full"
          rows={10}
          value={form.method ?? ''}
          onChange={e => setField('method', e.target.value)}
          placeholder="Step 1: …&#10;Step 2: …"
        />
      </div>
    </form>
  )
}

// ── Add via URL ───────────────────────────────────────────────────────────────

function AddViaUrl({ onSave, onCancel }: { onSave: (url: string) => Promise<void>; onCancel: () => void }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    try {
      await onSave(url.trim())
    } catch {
      setError('Could not parse that URL. You can still fill in the recipe manually.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-stone-100">
          <ChevronLeft className="w-4 h-4 text-stone-600" />
        </button>
        <h1 className="page-header">Add recipe from URL</h1>
      </div>
      <div className="card p-5 space-y-4">
        <p className="text-sm text-stone-500">
          Paste a link to a recipe page. The AI will extract the name, ingredients and method.
          You can review and adjust before saving.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="input"
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.recipepage.com/pasta-bake"
            autoFocus
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={!url.trim() || loading} className="btn-primary flex-1">
              {loading ? 'Fetching…' : 'Import recipe'}
            </button>
          </div>
        </form>
      </div>
      <p className="text-xs text-stone-400 text-center">
        AI recipe parsing requires the AI provider to be configured in Settings.
      </p>
    </div>
  )
}

// ── Add via AI ────────────────────────────────────────────────────────────────

function AddViaAI({ onSave, onCancel }: { onSave: (desc: string) => Promise<void>; onCancel: () => void }) {
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!desc.trim()) return
    setLoading(true)
    try { await onSave(desc.trim()) } finally { setLoading(false) }
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-stone-100">
          <ChevronLeft className="w-4 h-4 text-stone-600" />
        </button>
        <h1 className="page-header">Generate recipe with AI</h1>
      </div>
      <div className="card p-5 space-y-4">
        <p className="text-sm text-stone-500">
          Describe a meal and the AI will generate a full recipe with ingredients and method.
          You can review and adjust before saving.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            className="input resize-none"
            rows={4}
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="e.g. A creamy mushroom pasta for 4 people, quick weeknight meal"
            autoFocus
          />
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={!desc.trim() || loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              {loading ? 'Generating…' : 'Generate recipe'}
            </button>
          </div>
        </form>
      </div>
      <p className="text-xs text-stone-400 text-center">
        AI recipe generation requires the AI provider to be configured in Settings.
      </p>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onUrl, onAI }: { onUrl: () => void; onAI: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mb-4">
        <BookOpen className="w-7 h-7 text-brand-400" />
      </div>
      <p className="text-stone-500 text-sm">No recipes saved yet.</p>
      <p className="text-stone-400 text-xs mt-1 mb-5">Add one by pasting a URL or asking AI.</p>
      <div className="flex gap-3">
        <button onClick={onUrl} className="btn-secondary flex items-center gap-2">
          <Link className="w-4 h-4" /> From URL
        </button>
        <button onClick={onAI} className="btn-primary flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> AI Generate
        </button>
      </div>
    </div>
  )
}
