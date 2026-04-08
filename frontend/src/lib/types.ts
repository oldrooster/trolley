export interface Category {
  id: number
  name: string
  icon?: string
}

export interface Product {
  id: number
  category_id?: number
  category?: Category
  base_name: string
  variant_name?: string
  full_name?: string
  unit: string
  created_at: string
  // Computed display name
  display_name?: string
}

export interface ShoppingListItem {
  id: number
  list_id: number
  product_id?: number
  product?: Product
  custom_name?: string
  quantity: number
  unit?: string
  checked: boolean
  added_at: string
  source_meals?: string[]
}

export interface ShoppingList {
  id: number
  created_at: string
  archived_at?: string
  items: ShoppingListItem[]
}

export interface RecipeIngredient {
  id: number
  recipe_id: number
  product_id?: number
  product?: Product
  ingredient_name: string
  quantity?: number
  unit?: string
  notes?: string
}

export type RecipeDifficulty = 'everyone' | 'kid_friendly' | 'teen' | 'adult'
export type RecipeNutrition = 'very_healthy' | 'healthy' | 'moderate' | 'indulgent'
export type RecipeMealType = 'breakfast' | 'lunch' | 'dinner' | 'dessert'

export interface Recipe {
  id: number
  name: string
  description?: string
  method?: string
  image_path?: string
  source_url?: string
  servings?: number
  prep_time_mins?: number
  cook_time_mins?: number
  difficulty?: RecipeDifficulty
  nutrition?: RecipeNutrition
  is_quick?: boolean
  meal_type?: RecipeMealType
  created_at: string
  ingredients: RecipeIngredient[]
}

export interface WeeklyPlanMeal {
  id: number
  plan_id: number
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipe_id?: number
  recipe?: Recipe
  custom_name?: string
  day_hint?: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
  notes?: string
  assigned_member_ids?: number[]
  cook_member_id?: number
}

export type AgeGroup = 'kid' | 'teen' | 'adult'

export interface FamilyMember {
  id: number
  name: string
  age_group: AgeGroup
  emoji?: string
  photo_path?: string
  active: boolean
}

export interface WeeklyPlan {
  id: number
  week_start: string  // ISO date (Monday)
  created_at: string
  meals: WeeklyPlanMeal[]
}

export interface ReceiptItem {
  id: number
  receipt_id: number
  product_id?: number
  product?: Product
  raw_name: string
  quantity?: number
  unit_price?: number
  total_price?: number
}

export interface Receipt {
  id: number
  store_name?: string
  purchase_date?: string
  total_amount?: number
  file_path?: string
  uploaded_at: string
  items: ReceiptItem[]
}

export interface AppSetting {
  key: string
  value?: string
}
