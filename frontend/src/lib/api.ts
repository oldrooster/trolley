const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const error = await res.text()
    throw new Error(error || `Request failed: ${res.status}`)
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }
  return res.json()
}

export const api = {
  health: () => request<{ status: string; app: string }>('/health'),

  // Catalogue — Phase 2
  catalogue: {
    categories: () => request('/categories'),
    list: (params?: { category_id?: number }) => {
      const qs = params?.category_id ? `?category_id=${params.category_id}` : ''
      return request(`/catalogue${qs}`)
    },
    search: (q: string) => request(`/catalogue/search?q=${encodeURIComponent(q)}`),
    create: (data: unknown) => request('/catalogue', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: unknown) => request(`/catalogue/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/catalogue/${id}`, { method: 'DELETE' }),
  },

  // Shopping List — Phase 3
  list: {
    active: () => request('/list/active'),
    addItem: (data: unknown) => request('/list/items', { method: 'POST', body: JSON.stringify(data) }),
    updateItem: (id: number, data: unknown) => request(`/list/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteItem: (id: number) => request(`/list/items/${id}`, { method: 'DELETE' }),
    archive: () => request('/list/archive', { method: 'POST' }),
    history: () => request('/list/history'),
    addFromMeals: (mealIds: number[]) => request('/list/add-from-meals', { method: 'POST', body: JSON.stringify({ meal_ids: mealIds }) }),
  },

  // Meal Planner — Phase 4
  plans: {
    get: (weekStart: string) => request(`/plans?week=${weekStart}`),
    addMeal: (planId: number, data: unknown) => request(`/plans/${planId}/meals`, { method: 'POST', body: JSON.stringify(data) }),
    updateMeal: (id: number, data: unknown) => request(`/plans/meals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteMeal: (id: number) => request(`/plans/meals/${id}`, { method: 'DELETE' }),
  },

  // Recipes — Phase 5
  recipes: {
    list: (q?: string) => request(`/recipes${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    get: (id: number) => request(`/recipes/${id}`),
    create: (data: unknown) => request('/recipes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: unknown) => request(`/recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/recipes/${id}`, { method: 'DELETE' }),
    parseUrl: (url: string) => request('/recipes/parse-url', { method: 'POST', body: JSON.stringify({ url }) }),
    generate: (description: string) => request('/recipes/generate', { method: 'POST', body: JSON.stringify({ description }) }),
    generateImage: (recipeId: number) => request(`/recipes/${recipeId}/generate-image`, { method: 'POST' }),
    uploadImage: (recipeId: number, file: File) => {
      const form = new FormData()
      form.append('file', file)
      return request(`/recipes/${recipeId}/image`, { method: 'POST', body: form, headers: {} })
    },
  },

  // Receipts — Phase 7
  receipts: {
    upload: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return request('/receipts/upload', { method: 'POST', body: form, headers: {} })
    },
    confirm: (id: number, data: unknown) => request(`/receipts/${id}/confirm`, { method: 'POST', body: JSON.stringify(data) }),
    list: () => request('/receipts'),
    get: (id: number) => request(`/receipts/${id}`),
    delete: (id: number) => request(`/receipts/${id}`, { method: 'DELETE' }),
  },

  // Insights — Phase 8
  insights: {
    suggestions: () => request('/insights/suggestions'),
    mealHistory: (week?: string) => request(`/insights/meal-history${week ? `?week=${week}` : ''}`),
  },

  // Settings — Phase 6
  settings: {
    get: () => request('/settings'),
    update: (data: unknown) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),
    test: () => request('/settings/test', { method: 'POST' }),
  },
}
