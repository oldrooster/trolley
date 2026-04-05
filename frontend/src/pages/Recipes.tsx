import { useEffect, useState, useCallback } from 'react'
import {
  BookOpen, Search, X, Clock, Users, Pencil, Trash2,
  Link, Sparkles, ChevronLeft, Upload, CheckCircle, Package
} from 'lucide-react'
import { api } from '../lib/api'
import type { Recipe, Product, Category, RecipeDifficulty, RecipeNutrition } from '../lib/types'

// ── Difficulty + nutrition config ─────────────────────────────────────────────

export const DIFFICULTY_OPTIONS: { value: RecipeDifficulty; label: string; emoji: string; color: string }[] = [
  { value: 'everyone',    label: 'Everyone',     emoji: '👨‍👩‍👧', color: 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-700' },
  { value: 'kid_friendly',label: 'Kid friendly', emoji: '🧒',    color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700' },
  { value: 'teen',        label: 'Teen+',        emoji: '👦',    color: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-700' },
  { value: 'adult',       label: 'Adults',       emoji: '🧑',    color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700' },
]

export const NUTRITION_OPTIONS: { value: RecipeNutrition; label: string; emoji: string; color: string }[] = [
  { value: 'very_healthy', label: 'Very healthy', emoji: '🥗', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700' },
  { value: 'healthy',      label: 'Healthy',      emoji: '🥦', color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700' },
  { value: 'moderate',     label: 'Balanced',     emoji: '⚖️', color: 'bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-700' },
  { value: 'indulgent',    label: 'Treat',        emoji: '🍕', color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700' },
]

export function DifficultyBadge({ value }: { value: RecipeDifficulty }) {
  const opt = DIFFICULTY_OPTIONS.find(o => o.value === value)
  if (!opt) return null
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${opt.color}`}>
      {opt.emoji} {opt.label}
    </span>
  )
}

export function NutritionBadge({ value }: { value: RecipeNutrition }) {
  const opt = NUTRITION_OPTIONS.find(o => o.value === value)
  if (!opt) return null
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${opt.color}`}>
      {opt.emoji} {opt.label}
    </span>
  )
}

export function QuickBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-700">
      ⚡ Quick
    </span>
  )
}
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

  function preparePayload(data: RecipeFormData) {
    return {
      ...data,
      ingredients: data.ingredients.map(({ guessed_category_id, new_base_name, new_variant_name, ...ing }) => ({
        ...ing,
        category_id: guessed_category_id ?? undefined,
        new_base_name: new_base_name || undefined,
        new_variant_name: new_variant_name || undefined,
      })),
    }
  }

  async function handleSave(data: RecipeFormData, editingId?: number) {
    const payload = preparePayload(data)
    if (editingId) {
      const updated = await api.recipes.update(editingId, payload) as Recipe
      setRecipes(prev => prev.map(r => r.id === editingId ? updated : r))
      setSelected(updated)
      setView('detail')
      success('Recipe saved')
    } else {
      const created = await api.recipes.create(payload) as Recipe
      setRecipes(prev => [...prev, created])
      setSelected(created)
      setView('detail')
      success('Recipe added')
    }
    // Reload products so any newly created catalogue entries are available next edit
    api.catalogue.list().then(d => setProducts(d as Product[])).catch(() => {})
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

  async function handleGenerateImage(recipeId: number) {
    const updated = await api.recipes.generateImage(recipeId) as Recipe
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
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-stone-100 dark:hover:bg-stone-700">
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
        onGenerateImage={() => handleGenerateImage(selected.id)}
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
        <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 group-hover:text-brand-600 transition-colors">{recipe.name}</p>
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
        {(recipe.difficulty || recipe.nutrition || recipe.is_quick) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {recipe.is_quick && <QuickBadge />}
            {recipe.difficulty && <DifficultyBadge value={recipe.difficulty} />}
            {recipe.nutrition && <NutritionBadge value={recipe.nutrition} />}
          </div>
        )}
      </div>
    </button>
  )
}

// ── Recipe detail ─────────────────────────────────────────────────────────────

function RecipeDetail({
  recipe, onBack, onEdit, onDelete, onImageUpload, onGenerateImage
}: {
  recipe: Recipe
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onImageUpload: (f: File) => void
  onGenerateImage: () => Promise<void>
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)

  async function handleGenerateImage() {
    setGeneratingImage(true)
    try { await onGenerateImage() } finally { setGeneratingImage(false) }
  }
  const time = (recipe.prep_time_mins ?? 0) + (recipe.cook_time_mins ?? 0)

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors">
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
          <div className="w-full h-64 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-800/20 rounded-xl flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-brand-300" />
          </div>
        )}
        {/* Hover overlay: upload always available; generate only when no image */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-xl">
          <label className="cursor-pointer bg-white/90 dark:bg-stone-800/90 rounded-lg px-3 py-2 flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-700">
            <Upload className="w-4 h-4" /> {recipe.image_path ? 'Change' : 'Upload'}
            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onImageUpload(e.target.files[0])} />
          </label>
          {!recipe.image_path && (
            <button
              type="button"
              onClick={handleGenerateImage}
              disabled={generatingImage}
              className="bg-brand-600/90 hover:bg-brand-600 rounded-lg px-3 py-2 flex items-center gap-2 text-sm font-medium text-white disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              {generatingImage ? 'Generating…' : 'Generate'}
            </button>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-4">
        {recipe.prep_time_mins && (
          <div className="text-center">
            <p className="label">Prep</p>
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">{recipe.prep_time_mins} min</p>
          </div>
        )}
        {recipe.cook_time_mins && (
          <div className="text-center">
            <p className="label">Cook</p>
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">{recipe.cook_time_mins} min</p>
          </div>
        )}
        {time > 0 && (
          <div className="text-center">
            <p className="label">Total</p>
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">{time} min</p>
          </div>
        )}
        {recipe.servings && (
          <div className="text-center">
            <p className="label">Serves</p>
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">{recipe.servings}</p>
          </div>
        )}
      </div>

      {(recipe.difficulty || recipe.nutrition || recipe.is_quick) && (
        <div className="flex flex-wrap gap-2">
          {recipe.is_quick && <QuickBadge />}
          {recipe.difficulty && <DifficultyBadge value={recipe.difficulty} />}
          {recipe.nutrition && <NutritionBadge value={recipe.nutrition} />}
        </div>
      )}

      {recipe.description && (
        <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">{recipe.description}</p>
      )}

      {/* Ingredients */}
      {recipe.ingredients?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-200 mb-2">Ingredients</h2>
          <div className="card divide-y divide-stone-100 dark:divide-stone-800">
            {recipe.ingredients.map(ing => (
              <div key={ing.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
                <span className="text-sm text-stone-700 dark:text-stone-300 flex-1">{ing.ingredient_name}</span>
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
          <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-200 mb-2">Method</h2>
          <div className="card p-4 text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">
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
          <div className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">Delete recipe?</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">"{recipe.name}" will be permanently removed.</p>
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
  guessed_category_id?: number  // category from auto-match, preserved for new-product creation
  new_base_name?: string       // user-declared base name for new catalogue product
  new_variant_name?: string    // user-declared variant name for new catalogue product
}

interface RecipeFormData {
  name: string
  description?: string
  method?: string
  source_url?: string
  servings?: number
  prep_time_mins?: number
  cook_time_mins?: number
  difficulty?: RecipeDifficulty
  nutrition?: RecipeNutrition
  is_quick: boolean
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
      return { ...i, product_id: match?.id, guessed_category_id: match?.category_id ?? undefined }
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
    difficulty: initial?.difficulty ?? undefined,
    nutrition: initial?.nutrition ?? undefined,
    is_quick: initial?.is_quick ?? false,
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
  const [overrideIdx, setOverrideIdx] = useState<number | null>(null)
  const [overrideSearch, setOverrideSearch] = useState('')
  const [overrideResults, setOverrideResults] = useState<Product[]>([])
  // Products found via search that may not be in the base (limited) products list
  const [extraProducts, setExtraProducts] = useState<Map<number, Product>>(new Map())

  // On mount, fetch any ingredient products that aren't in the base list
  useEffect(() => {
    const missingIds = form.ingredients
      .map(i => i.product_id)
      .filter((id): id is number => id != null && !products.find(p => p.id === id))
    if (missingIds.length === 0) return
    Promise.all(missingIds.map(id => api.catalogue.get(id) as Promise<Product>))
      .then(fetched => {
        setExtraProducts(prev => {
          const next = new Map(prev)
          fetched.forEach(p => next.set(p.id, p))
          return next
        })
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [editIngIdx, setEditIngIdx] = useState<number | null>(null)
  const [editIngName, setEditIngName] = useState('')
  const [editIngQty, setEditIngQty] = useState('')
  const [editIngUnit, setEditIngUnit] = useState('')

  function findProduct(id: number): Product | undefined {
    return products.find(p => p.id === id) ?? extraProducts.get(id)
  }

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
        guessed_category_id: match?.category_id ?? undefined,
      }]
    }))
    setIngInput('')
    setIngQty('')
    setIngUnit('')
  }

  function removeIngredient(idx: number) {
    setForm(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== idx) }))
  }

  function startEditIng(idx: number) {
    const ing = form.ingredients[idx]
    setEditIngIdx(idx)
    setEditIngName(ing.ingredient_name)
    setEditIngQty(ing.quantity != null ? String(ing.quantity) : '')
    setEditIngUnit(ing.unit ?? '')
  }

  function commitEditIng(idx: number) {
    if (!editIngName.trim()) { setEditIngIdx(null); return }
    const newName = editIngName.trim()
    const newQty = editIngQty ? parseFloat(editIngQty) : undefined
    const newUnit = editIngUnit.trim() || undefined
    // Re-match only if name changed
    const ing = form.ingredients[idx]
    const nameChanged = newName !== ing.ingredient_name
    const newMatch = nameChanged ? fuzzyMatchProduct(newName, products) : null
    updateIngredient(idx, {
      ingredient_name: newName,
      quantity: newQty,
      unit: newUnit,
      ...(nameChanged && { product_id: newMatch?.id, guessed_category_id: newMatch?.category_id ?? undefined }),
    })
    setEditIngIdx(null)
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
        <button type="button" onClick={onCancel} className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700">
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

        {/* Quick meal toggle */}
        <button
          type="button"
          onClick={() => setField('is_quick', !form.is_quick)}
          className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 text-left transition-colors ${
            form.is_quick
              ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/20'
              : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600'
          }`}
        >
          <span className="text-xl">⚡</span>
          <div className="flex-1">
            <p className={`text-sm font-medium ${form.is_quick ? 'text-rose-700 dark:text-rose-300' : 'text-stone-700 dark:text-stone-300'}`}>
              Quick meal
            </p>
            <p className={`text-xs mt-0.5 ${form.is_quick ? 'text-rose-500 dark:text-rose-400' : 'text-stone-400'}`}>
              Ready in a flash — minimal prep, great for busy nights
            </p>
          </div>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            form.is_quick ? 'bg-rose-500 border-rose-500' : 'border-stone-300 dark:border-stone-600'
          }`}>
            {form.is_quick && <span className="text-white text-[10px]">✓</span>}
          </div>
        </button>

        {/* Difficulty */}
        <div>
          <label className="label block mb-1.5">Who's it for?</label>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setField('difficulty', form.difficulty === opt.value ? undefined : opt.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  form.difficulty === opt.value
                    ? opt.color
                    : 'border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'
                }`}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Nutrition */}
        <div>
          <label className="label block mb-1.5">Nutrition</label>
          <div className="flex flex-wrap gap-2">
            {NUTRITION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setField('nutrition', form.nutrition === opt.value ? undefined : opt.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  form.nutrition === opt.value
                    ? opt.color
                    : 'border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'
                }`}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Ingredients</h2>
        <div className="divide-y divide-stone-100 dark:divide-stone-800 -mx-5">
          {form.ingredients.map((ing, i) => {
            const matched = ing.product_id != null ? findProduct(ing.product_id) : undefined
            return (
              <div key={i} className="px-5 py-2.5 space-y-1.5">
                {editIngIdx === i ? (
                  /* ── Inline edit mode ── */
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      className="input flex-1 text-sm py-1"
                      value={editIngName}
                      onChange={e => setEditIngName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commitEditIng(i) }
                        if (e.key === 'Escape') setEditIngIdx(null)
                      }}
                      placeholder="Ingredient name"
                    />
                    <input
                      className="input w-16 text-center text-sm py-1"
                      value={editIngQty}
                      onChange={e => setEditIngQty(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commitEditIng(i) }
                        if (e.key === 'Escape') setEditIngIdx(null)
                      }}
                      placeholder="Qty"
                      type="number"
                      min={0}
                      step="any"
                    />
                    <input
                      className="input w-16 text-sm py-1"
                      value={editIngUnit}
                      onChange={e => setEditIngUnit(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commitEditIng(i) }
                        if (e.key === 'Escape') setEditIngIdx(null)
                      }}
                      placeholder="Unit"
                    />
                    <button type="button" onClick={() => commitEditIng(i)} className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/30 hover:bg-brand-100 shrink-0">
                      <CheckCircle className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                    </button>
                    <button type="button" onClick={() => setEditIngIdx(null)} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 shrink-0">
                      <X className="w-3.5 h-3.5 text-stone-400" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    {/* Name */}
                    <span className="flex-1 text-sm font-medium text-stone-800 dark:text-stone-100">{ing.ingredient_name}</span>
                    {/* Qty + unit */}
                    <span className="text-xs text-stone-400 shrink-0">
                      {ing.quantity != null ? ing.quantity : ''}
                      {ing.unit ? ` ${ing.unit}` : ''}
                    </span>
                    <button type="button" onClick={() => startEditIng(i)} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Pencil className="w-3 h-3 text-stone-400" />
                    </button>
                    <button type="button" onClick={() => removeIngredient(i)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0">
                      <X className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                )}
                {/* Match status */}
                <div className="flex items-center gap-2 flex-wrap">
                  {matched && overrideIdx !== i ? (
                    <div className="flex items-center gap-1">
                      <span className="flex items-center gap-1.5 text-xs text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded-md">
                        <CheckCircle className="w-3 h-3 shrink-0" />
                        {matched.category?.icon && <span>{matched.category.icon}</span>}
                        <span>{matched.base_name}</span>
                        {matched.variant_name && <span className="opacity-75">· {matched.variant_name}</span>}
                        {matched.brand_name && <span className="opacity-60 font-normal">({matched.brand_name})</span>}
                      </span>
                      <button
                        type="button"
                        title="Change match"
                        onClick={() => { setOverrideIdx(i); setOverrideSearch(''); setOverrideResults([]) }}
                        className="p-0.5 rounded hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        title="Clear match"
                        onClick={() => updateIngredient(i, { product_id: undefined, guessed_category_id: matched?.category_id ?? undefined })}
                        className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-stone-400 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : overrideIdx === i ? (
                    <div className="relative flex-1 min-w-0">
                      <input
                        autoFocus
                        className="input w-full text-xs py-1"
                        value={overrideSearch}
                        onChange={e => {
                          const q = e.target.value
                          setOverrideSearch(q)
                          if (q.trim().length >= 2) {
                            api.catalogue.search(q.trim()).then(r => setOverrideResults(r as Product[])).catch(() => {})
                          } else {
                            setOverrideResults([])
                          }
                        }}
                        onKeyDown={e => { if (e.key === 'Escape') setOverrideIdx(null) }}
                        placeholder="Search catalogue…"
                      />
                      {overrideSearch.trim().length >= 2 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
                          {overrideResults.length > 0 ? overrideResults.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-brand-50 dark:hover:bg-brand-900/20 text-stone-700 dark:text-stone-300"
                                onMouseDown={() => {
                                  updateIngredient(i, {
                                    product_id: p.id,
                                    guessed_category_id: p.category_id ?? ing.guessed_category_id,
                                  })
                                  setExtraProducts(prev => new Map(prev).set(p.id, p))
                                  setOverrideIdx(null)
                                  setOverrideResults([])
                                }}
                              >
                                <span className="flex items-center gap-1.5 flex-wrap">
                                  {p.category?.icon && <span>{p.category.icon}</span>}
                                  <span>{p.base_name}</span>
                                  {p.variant_name && <span className="opacity-75">· {p.variant_name}</span>}
                                  {p.brand_name && <span className="opacity-60">({p.brand_name})</span>}
                                </span>
                              </button>
                            )) : (
                            <div className="px-3 py-2 text-xs text-stone-400">No matches found</div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="flex items-center gap-1.5 text-xs text-stone-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ing.create_product ?? false}
                            onChange={e => updateIngredient(i, {
                              create_product: e.target.checked,
                              new_base_name: e.target.checked ? (ing.new_base_name || ing.ingredient_name) : undefined,
                              new_variant_name: e.target.checked ? ing.new_variant_name : undefined,
                            })}
                            className="rounded text-brand-500"
                          />
                          <Package className="w-3 h-3" />
                          <span>No match — add new</span>
                        </label>
                        <span className="text-xs text-stone-300 dark:text-stone-600">or</span>
                        <button
                          type="button"
                          onClick={() => { setOverrideIdx(i); setOverrideSearch(''); setOverrideResults([]) }}
                          className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
                        >
                          <Search className="w-3 h-3" /> search catalogue
                        </button>
                      </div>
                      {ing.create_product && (
                        <div className="flex gap-2 pl-5">
                          <div className="flex-1">
                            <input
                              className="input text-xs py-1 w-full"
                              value={ing.new_base_name ?? ''}
                              onChange={e => updateIngredient(i, { new_base_name: e.target.value })}
                              placeholder="Base name (e.g. Tomatoes)"
                            />
                          </div>
                          <div className="flex-1">
                            <input
                              className="input text-xs py-1 w-full"
                              value={ing.new_variant_name ?? ''}
                              onChange={e => updateIngredient(i, { new_variant_name: e.target.value })}
                              placeholder="Variant (e.g. Canned) — optional"
                            />
                          </div>
                        </div>
                      )}
                    </div>
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
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700">
          <ChevronLeft className="w-4 h-4 text-stone-600" />
        </button>
        <h1 className="page-header">Add recipe from URL</h1>
      </div>
      <div className="card p-5 space-y-4">
        <p className="text-sm text-stone-500 dark:text-stone-400">
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
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700">
          <ChevronLeft className="w-4 h-4 text-stone-600" />
        </button>
        <h1 className="page-header">Generate recipe with AI</h1>
      </div>
      <div className="card p-5 space-y-4">
        <p className="text-sm text-stone-500 dark:text-stone-400">
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
