import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Utensils, ShoppingCart, History } from 'lucide-react'
import { api } from '../lib/api'
import type { WeeklyPlan, WeeklyPlanMeal, Recipe, FamilyMember } from '../lib/types'
import { PlannerSkeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { DifficultyBadge, NutritionBadge, QuickBadge } from './Recipes'

// ── Meal history panel ────────────────────────────────────────────────────────

interface MealHistoryData {
  week_start: string
  meals: { name: string; meal_type: string; day_hint: string | null }[]
}

function MealHistoryPanel({
  weekStart,
  onUseMeal,
}: {
  weekStart: Date
  onUseMeal: (name: string, type: string) => void
}) {
  const [history, setHistory] = useState<MealHistoryData | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setHistory(null)
    setOpen(false)
    api.insights.mealHistory(isoDate(weekStart))
      .then(d => setHistory(d as MealHistoryData | null))
      .catch(() => {})
  }, [weekStart])

  if (!history || history.meals.length === 0) return null

  const dinners = history.meals.filter(m => m.meal_type === 'dinner')
  const preview = dinners.slice(0, 3).map(m => m.name).join(', ')

  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 overflow-hidden">
      <button
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <History className="w-4 h-4 text-stone-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Last week you had…</p>
          {!open && <p className="text-xs text-stone-400 truncate">{preview}</p>}
        </div>
        <ChevronRight className={`w-4 h-4 text-stone-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-stone-200 dark:border-stone-700 divide-y divide-stone-100 dark:divide-stone-800">
          {history.meals.map((meal, i) => (
            <div
              key={i}
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('application/x-meal', JSON.stringify({ name: meal.name, meal_type: meal.meal_type }))
                e.dataTransfer.effectAllowed = 'copy'
              }}
              className="flex items-center gap-3 px-4 py-2.5 group cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-stone-700 dark:text-stone-300 truncate">{meal.name}</p>
                <p className="text-xs text-stone-400 capitalize">
                  {meal.meal_type}{meal.day_hint ? ` · ${meal.day_hint}` : ''}
                </p>
              </div>
              <span className="text-stone-300 dark:text-stone-600 text-xs shrink-0 opacity-0 group-hover:opacity-100">drag or</span>
              <button
                onClick={() => onUseMeal(meal.name, meal.meal_type)}
                className="opacity-0 group-hover:opacity-100 text-xs text-brand-600 font-medium px-2 py-1 rounded hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all shrink-0"
              >
                add
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
type Day = typeof DAYS[number]

const DAY_LABELS: Record<Day, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun'
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const
type MealType = typeof MEAL_TYPES[number]

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner'
}

const MEAL_COLORS: Record<MealType, string> = {
  breakfast: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300',
  lunch: 'bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-700 text-sky-800 dark:text-sky-300',
  dinner: 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-700 text-brand-800 dark:text-brand-300',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMonday(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function weekLabel(mon: Date): string {
  const sun = addDays(mon, 6)
  const now = toMonday(new Date())
  if (isoDate(mon) === isoDate(now)) return 'This week'
  if (isoDate(mon) === isoDate(addDays(now, 7))) return 'Next week'
  if (isoDate(mon) === isoDate(addDays(now, -7))) return 'Last week'
  return `${mon.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}`
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MealPlanner() {
  const [weekStart, setWeekStart] = useState<Date>(toMonday(new Date()))
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ day: Day; type: MealType; meal?: WeeklyPlanMeal } | null>(null)
  const [addingToList, setAddingToList] = useState(false)
  const [addedToList, setAddedToList] = useState(false)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const { success, error } = useToast()

  useEffect(() => {
    api.family.list().then(d => setMembers(d as FamilyMember[])).catch(console.error)
  }, [])

  const loadPlan = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.plans.get(isoDate(weekStart)) as WeeklyPlan
      setPlan(data)
    } catch {
      error('Failed to load meal plan')
    } finally {
      setLoading(false)
    }
  }, [weekStart, error])

  useEffect(() => {
    setAddedToList(false)
    loadPlan()
  }, [loadPlan])

  function getMeals(day: Day, type: MealType): WeeklyPlanMeal[] {
    if (!plan) return []
    return plan.meals.filter(m => m.day_hint === day && m.meal_type === type)
  }

  function getGeneralMeals(): WeeklyPlanMeal[] {
    if (!plan) return []
    return plan.meals.filter(m => !m.day_hint)
  }

  async function handleSaveMeal(payload: {
    meal_type: string
    recipe_id?: number
    custom_name?: string
    day_hint?: string
    notes?: string
    assigned_member_ids?: number[]
    cook_member_id?: number
  }) {
    if (!plan) return
    if (modal?.meal) {
      const updated = await api.plans.updateMeal(modal.meal.id, payload) as WeeklyPlanMeal
      setPlan(prev => prev ? {
        ...prev,
        meals: prev.meals.map(m => m.id === updated.id ? updated : m)
      } : prev)
    } else {
      const created = await api.plans.addMeal(plan.id, payload) as WeeklyPlanMeal
      setPlan(prev => prev ? { ...prev, meals: [...prev.meals, created] } : prev)
    }
    setModal(null)
  }

  async function handleDeleteMeal(mealId: number) {
    await api.plans.deleteMeal(mealId)
    setPlan(prev => prev ? { ...prev, meals: prev.meals.filter(m => m.id !== mealId) } : prev)
  }

  async function handleAddFromHistory(name: string, type: string) {
    if (!plan) return
    const created = await api.plans.addMeal(plan.id, {
      meal_type: type,
      custom_name: name,
    }) as WeeklyPlanMeal
    setPlan(prev => prev ? { ...prev, meals: [...prev.meals, created] } : prev)
  }

  async function handleDropMeal(name: string, mealType: string, day: Day) {
    if (!plan) return
    const created = await api.plans.addMeal(plan.id, {
      meal_type: mealType,
      custom_name: name,
      day_hint: day,
    }) as WeeklyPlanMeal
    setPlan(prev => prev ? { ...prev, meals: [...prev.meals, created] } : prev)
    success(`${name} added to ${DAY_LABELS[day]}`)
  }

  async function handleAddAllToList() {
    if (!plan) return
    const mealIds = plan.meals.filter(m => m.recipe_id).map(m => m.id)
    if (mealIds.length === 0) return
    setAddingToList(true)
    try {
      await api.list.addFromMeals(mealIds)
      setAddedToList(true)
      success(`${mealIds.length} recipe${mealIds.length !== 1 ? 's' : ''} added to shopping list`)
    } catch {
      error('Failed to add meals to list')
    } finally {
      setAddingToList(false)
    }
  }

  const totalMeals = plan?.meals.length ?? 0
  const recipeMeals = plan?.meals.filter(m => m.recipe_id).length ?? 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="page-header">Meal Planner</h1>
        <div className="flex items-center gap-2">
          {recipeMeals > 0 && (
            <button
              onClick={handleAddAllToList}
              disabled={addingToList || addedToList}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                addedToList
                  ? 'bg-brand-50 text-brand-600 border border-brand-200'
                  : 'btn-secondary'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              {addedToList ? 'Added to list' : `Add ${recipeMeals} recipe${recipeMeals !== 1 ? 's' : ''} to list`}
            </button>
          )}
        </div>
      </div>

      {/* Week navigator */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setWeekStart(d => addDays(d, -7))}
          className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-stone-600" />
        </button>
        <span className="text-sm font-medium text-stone-700 dark:text-stone-300 flex-1 text-center">
          {weekLabel(weekStart)}
        </span>
        <button
          onClick={() => setWeekStart(d => addDays(d, 7))}
          className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-stone-600" />
        </button>
      </div>

      {loading ? (
        <PlannerSkeleton />
      ) : (
        <>
          {/* Day grid — desktop: 7 columns, mobile: scrollable */}
          <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
            <div className="min-w-[640px] md:min-w-0">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {DAYS.map((day, i) => {
                  const d = addDays(weekStart, i)
                  const isToday = isoDate(d) === isoDate(new Date())
                  return (
                    <div key={day} className="text-center">
                      <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-brand-600' : 'text-stone-400'}`}>
                        {DAY_LABELS[day]}
                      </p>
                      <p className={`text-sm font-medium mt-0.5 ${isToday ? 'text-brand-600' : 'text-stone-500'}`}>
                        {d.getDate()}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Meal rows */}
              {MEAL_TYPES.map(type => (
                <div key={type} className="mb-2">
                  <p className="label mb-1.5">{MEAL_LABELS[type]}</p>
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS.map(day => {
                      const meals = getMeals(day, type)
                      return (
                        <DayCell
                          key={day}
                          meals={meals}
                          mealType={type}
                          members={members}
                          onAdd={() => setModal({ day, type })}
                          onEdit={(meal) => setModal({ day, type, meal })}
                          onDelete={handleDeleteMeal}
                          onDrop={(name, mealType) => handleDropMeal(name, mealType, day)}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* General meals this week */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="label">General this week</h2>
              <button
                onClick={() => setModal({ day: 'mon' as Day, type: 'dinner', meal: undefined })}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {getGeneralMeals().length === 0 ? (
              <div className="card p-4 text-center">
                <p className="text-sm text-stone-400">No general meals planned.</p>
                <button
                  onClick={() => setModal({ day: '' as Day, type: 'dinner' })}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium mt-1"
                >
                  + Add a meal without a specific day
                </button>
              </div>
            ) : (
              <div className="card divide-y divide-stone-100 dark:divide-stone-800">
                {getGeneralMeals().map(meal => (
                  <div key={meal.id} className="flex items-center gap-3 px-4 py-3 group">
                    <Utensils className="w-4 h-4 text-stone-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">
                        {meal.recipe?.name ?? meal.custom_name}
                      </p>
                      <p className="text-xs text-stone-400">{MEAL_LABELS[meal.meal_type as MealType] ?? meal.meal_type}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteMeal(meal.id)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
                    >
                      <X className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Last week's meals — inspiration panel */}
          <MealHistoryPanel
            weekStart={weekStart}
            onUseMeal={handleAddFromHistory}
          />

          {totalMeals === 0 && (
            <p className="text-center text-stone-400 text-sm py-4">
              Click any + to start planning your week.
            </p>
          )}
        </>
      )}

      {/* Add/Edit meal modal */}
      {modal !== null && (
        <MealModal
          day={modal.day}
          mealType={modal.type}
          existing={modal.meal}
          members={members}
          onSave={handleSaveMeal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ── Day cell ──────────────────────────────────────────────────────────────────

const DEFAULT_EMOJIS: Record<string, string> = { kid: '🧒', teen: '👦', adult: '🧑' }

function MemberAvatar({ member, size = 'sm' }: { member: FamilyMember; size?: 'sm' | 'chip' }) {
  if (member.photo_path) {
    // chip = inside day cell pill, sm = inside modal button
    const cls = size === 'chip'
      ? 'w-10 h-10 rounded-full object-cover inline-block'
      : 'w-12 h-12 rounded-full object-cover inline-block'
    return <img src={member.photo_path} alt={member.name} className={cls} />
  }
  const textSize = size === 'chip' ? 'text-2xl' : 'text-3xl'
  return <span className={textSize}>{member.emoji || DEFAULT_EMOJIS[member.age_group] || '🧑'}</span>
}

function DayCell({
  meals,
  mealType,
  members,
  onAdd,
  onEdit,
  onDelete,
  onDrop,
}: {
  meals: WeeklyPlanMeal[]
  mealType: MealType
  members: FamilyMember[]
  onAdd: () => void
  onEdit: (meal: WeeklyPlanMeal) => void
  onDelete: (id: number) => void
  onDrop: (name: string, mealType: string) => void
}) {
  const colorClass = MEAL_COLORS[mealType]
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      className={`min-h-[64px] rounded-lg border p-1 flex flex-col gap-1 transition-colors ${
        dragOver
          ? 'border-brand-400 bg-brand-50/50 dark:bg-brand-900/20'
          : 'border-stone-100 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50'
      }`}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setDragOver(false)
        try {
          const data = JSON.parse(e.dataTransfer.getData('application/x-meal'))
          onDrop(data.name, data.meal_type)
        } catch {}
      }}
    >
      {meals.map(meal => {
        const cook = meal.cook_member_id
          ? members.find(m => m.id === meal.cook_member_id)
          : null
        return (
          <div
            key={meal.id}
            className={`rounded-md border px-1.5 py-1 text-[11px] font-medium leading-tight cursor-pointer flex flex-col gap-0.5 group ${colorClass}`}
          >
            <div className="flex items-start justify-between gap-1">
              <span
                className="flex-1 truncate cursor-pointer"
                onClick={() => onEdit(meal)}
                title={meal.recipe?.name ?? meal.custom_name ?? ''}
              >
                {meal.recipe?.name ?? meal.custom_name}
              </span>
              <button
                onClick={() => onDelete(meal.id)}
                className="opacity-0 group-hover:opacity-100 shrink-0 hover:text-red-500 transition-all"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
            {cook && (
              <div className="flex items-center gap-0.5">
                <MemberAvatar member={cook} size="chip" />
                <span className="text-[11px] leading-none">👨‍🍳</span>
              </div>
            )}
          </div>
        )
      })}
      <button
        onClick={onAdd}
        className="flex-1 flex items-center justify-center text-stone-300 dark:text-stone-600 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-md transition-colors min-h-[24px]"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  )
}

// ── Meal modal ────────────────────────────────────────────────────────────────

function MealModal({
  day,
  mealType,
  existing,
  members,
  onSave,
  onClose,
}: {
  day: Day | ''
  mealType: MealType
  existing?: WeeklyPlanMeal
  members: FamilyMember[]
  onSave: (payload: {
    meal_type: string
    recipe_id?: number
    custom_name?: string
    day_hint?: string
    notes?: string
    cook_member_id?: number
  }) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(existing?.custom_name ?? existing?.recipe?.name ?? '')
  const [selectedType, setSelectedType] = useState<MealType>(
    (existing?.meal_type as MealType) ?? mealType
  )
  const [selectedDay, setSelectedDay] = useState<Day | ''>(
    (existing?.day_hint as Day) ?? day
  )
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [recipeSearch, setRecipeSearch] = useState('')
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(existing?.recipe_id ?? null)
  const [cookId, setCookId] = useState<number | null>(existing?.cook_member_id ?? null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.recipes.list().then(data => setRecipes(data as Recipe[])).catch(console.error)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const filteredRecipes = recipes.filter(r =>
    r.name.toLowerCase().includes(recipeSearch.toLowerCase())
  )

  async function handleSave() {
    if (!name.trim() && !selectedRecipeId) return
    setSaving(true)
    try {
      await onSave({
        meal_type: selectedType,
        recipe_id: selectedRecipeId ?? undefined,
        custom_name: selectedRecipeId ? undefined : name.trim(),
        day_hint: selectedDay || undefined,
        cook_member_id: cookId ?? undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-stone-100 dark:border-stone-800">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            {existing ? 'Edit meal' : 'Add meal'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700">
            <X className="w-4 h-4 text-stone-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Day + Meal type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1">Day</label>
              <select className="input" value={selectedDay} onChange={e => setSelectedDay(e.target.value as Day | '')}>
                <option value="">Any day</option>
                {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
              </select>
            </div>
            <div>
              <label className="label block mb-1">Meal</label>
              <select className="input" value={selectedType} onChange={e => setSelectedType(e.target.value as MealType)}>
                {MEAL_TYPES.map(t => <option key={t} value={t}>{MEAL_LABELS[t]}</option>)}
                <option value="snack">Snack</option>
              </select>
            </div>
          </div>

          {/* Recipe picker */}
          {recipes.length > 0 && (
            <div>
              <label className="label block mb-1">From a recipe</label>
              <input
                className="input mb-2"
                placeholder="Search recipes…"
                value={recipeSearch}
                onChange={e => setRecipeSearch(e.target.value)}
              />
              <div className="max-h-36 overflow-y-auto rounded-lg border border-stone-200 dark:border-stone-700 divide-y divide-stone-100 dark:divide-stone-800">
                <button
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    selectedRecipeId === null ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium' : 'hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400'
                  }`}
                  onClick={() => setSelectedRecipeId(null)}
                >
                  None (custom name)
                </button>
                {filteredRecipes.map(r => (
                  <button
                    key={r.id}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      selectedRecipeId === r.id ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium' : 'hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                    onClick={() => { setSelectedRecipeId(r.id); setName(r.name) }}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate">{r.name}</span>
                      <span className="flex gap-1 shrink-0">
                        {r.is_quick && <QuickBadge />}
                        {r.difficulty && <DifficultyBadge value={r.difficulty} />}
                        {r.nutrition && <NutritionBadge value={r.nutrition} />}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom name — shown when no recipe selected */}
          {!selectedRecipeId && (
            <div>
              <label className="label block mb-1">Meal name</label>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Spaghetti Bolognese"
                autoFocus={recipes.length === 0}
              />
            </div>
          )}

          {/* Who's cooking */}
          {members.length > 0 && (
            <div>
              <label className="label block mb-1.5">Who's cooking?</label>
              <div className="flex flex-wrap gap-2">
                {members.map(m => {
                  const selected = cookId === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setCookId(selected ? null : m.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        selected
                          ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                          : 'border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'
                      }`}
                    >
                      <MemberAvatar member={m} />
                      {m.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || (!name.trim() && !selectedRecipeId)}
              className="btn-primary flex-1"
            >
              {saving ? 'Saving…' : (existing ? 'Save' : 'Add meal')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
