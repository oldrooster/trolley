# Weekly Shop App — Full Specification

## Overview
A self-hosted web app to manage the weekly grocery shop for a NZ household.
Single Docker container, deployable to existing Docker infra.

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + Vite (TypeScript) | Fast, flexible, great DX |
| Backend | FastAPI (Python) | User knows Python; great AI/PDF lib support |
| Database | SQLite + SQLAlchemy | Single file, zero config, easy backup |
| AI | Abstracted provider layer | Swap-friendly; Vertex AI first |
| Container | Single Dockerfile + docker-compose | One command deployment |

The FastAPI backend serves the built React frontend as static files.
SQLite database stored on a named Docker volume (persists across restarts).

---

## Data Model

### Category
- id, name, icon (optional)
- e.g. "Dairy", "Produce", "Snacks", "Bakery"

### Product (the catalogue)
- id, category_id
- base_name (e.g. "Chips", "Milk", "Broccoli")
- variant_name (optional, e.g. "Salt & Vinegar", "Low Fat")
- brand_name (optional, e.g. "Bluebird 150g", "Anchor Green Top 2L")
- unit (e.g. "each", "kg", "L")
- Full-text search index across all name fields

### ShoppingList
- id, created_at, archived_at (null = active)
- One active list at a time; completed lists are archived not deleted

### ShoppingListItem
- id, list_id, product_id (nullable), custom_name, quantity, unit, checked, added_at

### Recipe
- id, name, description, method (text), image_path, source_url
- servings, prep_time_mins, cook_time_mins, created_at

### RecipeIngredient
- id, recipe_id, product_id (nullable), ingredient_name, quantity, unit, notes

### WeeklyPlan
- id, week_start (Monday date), created_at
- One plan per calendar week (Mon–Sun)

### WeeklyPlanMeal
- id, plan_id, meal_type (breakfast/lunch/dinner/snack)
- recipe_id (nullable), custom_name, day_hint (mon/tue/.../sun, optional), notes

### Receipt
- id, store_name, purchase_date, total_amount
- file_path (image or PDF), uploaded_at, raw_extraction (JSON)

### ReceiptItem
- id, receipt_id, product_id (nullable), raw_name, quantity, unit_price, total_price

---

## Pages & Features

### 1. Shopping List (default/home page)
- Text input with FTS autocomplete across product catalogue (all levels)
- Type "chips" → see all chip variants; "salt & vinegar" → narrows; "whitakers" → brand specific
- Hit Enter or click Add; default qty = 1 (adjustable inline)
- Check off items as you shop
- Archive list button (moves to history, starts fresh)
- "Add from meal plan" button — pulls ingredients from selected meals
- Prompt banner: "Do you need any of: ..." (from purchase history)

### 2. Meal Planner
- Calendar week view (Mon–Sun), aligned to real calendar
- Previous weeks accessible for inspiration
- Add meals to each day slot (breakfast/lunch/dinner) or as general week meals
- Link meal to a saved recipe or free-type a custom name
- "Add to shopping list" — extracts all recipe ingredients and adds them

### 3. Recipes
- Browse and search saved recipes
- Add via:
  - URL (AI scrapes and parses into structured recipe)
  - AI prompt (describe a meal, AI generates recipe)
  - Both flows: user reviews and edits before saving
- If no image available: AI generates one from recipe name/description
- Fields: name, description, method, ingredients (linked to catalogue), image, source URL, servings, prep/cook time

### 4. Product Catalogue
- Browse by category
- Full CRUD: add, edit, delete products
- 3-level optional hierarchy:
  - base_name only: "Broccoli" (unit: each)
  - base + variant: "Salt & Vinegar Chips"
  - base + variant + brand: "Bluebird Salt & Vinegar Chips 150g"
- AI enriches catalogue from uploaded receipts
- Pre-seeded with NZ essential grocery items

### 5. Receipts
- Upload image (jpg/png) or PDF
- AI extracts: store name, date, line items (name, qty, unit price, total)
- User reviews extraction before confirming
- Saving a receipt:
  - Adds to receipt history
  - Attempts to match items to product catalogue
  - Creates new catalogue entries for unmatched items (with user approval)
- NZ stores recognised: Woolworths NZ, New World, Pak'n'Save

### 6. Settings
- AI provider selection (Vertex AI / OpenAI / Anthropic — config per provider)
- API key and model configuration
- App preferences (default week start, etc.)

---

## AI Provider Abstraction

```python
class AIProvider(Protocol):
    def chat(self, prompt: str, context: str = "") -> str: ...
    def extract_receipt(self, file_bytes: bytes, mime_type: str) -> ReceiptData: ...
    def parse_recipe_from_url(self, url: str) -> RecipeData: ...
    def generate_recipe(self, description: str) -> RecipeData: ...
    def generate_image(self, prompt: str) -> bytes: ...

class VertexAIProvider(AIProvider): ...   # Phase 1
class OpenAIProvider(AIProvider): ...     # Future
class AnthropicProvider(AIProvider): ...  # Future
```

Active provider configured via environment variable in docker-compose.

---

## NZ Pre-seed Categories & Items (essentials only)

**Dairy & Eggs:** Milk, Butter, Cheese, Yoghurt, Cream, Eggs, Sour Cream
**Bakery:** Bread, Wraps, Pita Bread, Crumpets, Bagels
**Produce:** Broccoli, Carrots, Onions, Garlic, Potatoes, Kumara, Lettuce, Tomatoes, Capsicum, Cucumber, Spinach, Avocado, Lemon, Banana, Apples, Oranges
**Meat & Seafood:** Chicken Breast, Chicken Thighs, Mince, Steak, Bacon, Salmon, Sausages, Ham
**Pantry:** Rice, Pasta, Flour, Sugar, Salt, Pepper, Olive Oil, Soy Sauce, Tinned Tomatoes, Coconut Milk, Chicken Stock, Pasta Sauce
**Breakfast:** Oats/Porridge, Weet-Bix, Muesli, Cereal, Peanut Butter, Vegemite, Jam, Honey, Milo
**Snacks:** Chips, Crackers, Nuts, Chocolate, Muesli Bars
**Drinks:** Orange Juice, Coffee, Tea, Sparkling Water
**Frozen:** Peas, Corn, Ice Cream
**Household:** Dish Soap, Washing Powder, Toilet Paper, Paper Towels
**Condiments:** Tomato Sauce, Mayonnaise, Mustard, Sweet Chilli Sauce, Relish

---

## Docker Setup

```
/shop
  Dockerfile          # Multi-stage: Node build → Python runtime
  docker-compose.yml  # One service + one named volume
  /backend            # FastAPI app
  /frontend           # React + Vite app
```

`docker-compose.yml` exposes one port (configurable, default 8080).
SQLite file lives at `/data/shop.db` inside the container, mounted as a volume.
