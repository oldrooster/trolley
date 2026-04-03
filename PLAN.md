# Weekly Shop App — Implementation Plan

This document is the source of truth for how the app will be built.
Each phase is self-contained and results in a working (if incomplete) app.
Resume any session by reading SPEC.md and this file first.

---

## Phase 1 — Scaffold

**Goal:** A running Docker container with routing, DB connection, and empty page shells.

### Tasks
- [x] Create directory structure: `/backend`, `/frontend`
- [x] FastAPI app skeleton (`main.py`, routers, DB session)
- [x] SQLAlchemy models for all entities (see SPEC.md Data Model)
- [ ] ~~Alembic migrations~~ — using `create_all` on startup (sufficient for this app)
- [x] React + Vite project with TypeScript
- [x] React Router: 6 routes (Shopping List, Meal Planner, Recipes, Catalogue, Receipts, Settings)
- [x] Sidebar nav (desktop) + bottom nav (mobile) shell
- [x] UI foundation: Tailwind CSS, Inter font, Lucide icons, brand green accent
- [x] Multi-stage Dockerfile: Node build stage → Python runtime stage
- [x] docker-compose.yml: one service, port 8080, named volume at `/data`
- [x] FastAPI serves built React static files
- [x] Health check endpoint (`GET /api/health`)
- [x] AI provider abstraction layer + Vertex/OpenAI/Anthropic stubs (`backend/ai/`)

### Done when
`docker compose up` serves the app at `localhost:8080` with navigable empty pages.

**STATUS: COMPLETE ✓**

---

## Phase 2 — Product Catalogue

**Goal:** A fully working catalogue with CRUD and autocomplete-ready search.

### Tasks
- [x] Seed script: NZ essential items from SPEC.md pre-seed list (78 products, 11 categories)
- [x] `GET /api/catalogue` — browse with category filter + pagination
- [x] `GET /api/catalogue/search?q=` — FTS5 across base/variant/brand names
- [x] `POST /api/catalogue` — create product
- [x] `PUT /api/catalogue/{id}` — update product
- [x] `DELETE /api/catalogue/{id}` — delete product
- [x] `GET /api/categories` — list categories
- [x] Catalogue page: browse by category, search bar, product cards grouped by category
- [x] Product form: add/edit modal (base, variant, brand, category, unit)
- [x] Delete confirmation modal

### Done when
Can browse, search, add, edit, and delete products. Seed data is present.

**STATUS: COMPLETE ✓**

---

## Phase 3 — Shopping List

**Goal:** The core daily-use feature. Fast, frictionless, keyboard-friendly.

### Tasks
- [x] `GET /api/list/active` — get current active list + items
- [x] `POST /api/list/items` — add item (product_id or custom_name, qty)
- [x] `PATCH /api/list/items/{id}` — update qty or checked state
- [x] `DELETE /api/list/items/{id}` — remove item
- [x] `POST /api/list/archive` — archive active list, create new one
- [x] `GET /api/list/history` — list archived shopping lists
- [x] `POST /api/list/add-from-meals` — pull recipe ingredients into active list
- [x] Shopping List page:
  - [x] Autocomplete text input (debounced FTS, keyboard nav)
  - [x] Keyboard: Enter to add, Escape to clear, arrow keys to navigate
  - [x] Item rows: checkbox, name, qty stepper, delete
  - [x] Grouped by category, checked items collapsed
  - [x] Progress bar, archive button with confirmation
- [x] "Add from meal plan" — push meal recipe ingredients to shopping list

### Done when
Can add items by typing, check them off, adjust quantities, and archive the list.

**STATUS: COMPLETE ✓**

---

## Phase 4 — Meal Planner

**Goal:** A persistent weekly meal planning board.

### Tasks
- [x] `GET /api/plans?week=YYYY-MM-DD` — get plan for a given Monday (auto-creates)
- [x] `POST /api/plans/{id}/meals` — add a meal slot
- [x] `PUT /api/plans/meals/{id}` — update meal slot
- [x] `DELETE /api/plans/meals/{id}` — remove meal slot
- [x] Meal Planner page:
  - [x] Week selector (prev/next week, labelled "This week" / "Last week" etc.)
  - [x] 7-column grid (Mon–Sun) with day numbers, today highlighted
  - [x] 3 rows per day (Breakfast / Lunch / Dinner) with colour coding
  - [x] "General this week" section (no specific day)
  - [x] Click + → modal to assign a recipe or type a custom name
  - [x] "Add N recipes to list" button
- [x] Auto-create plan record when user first opens a week

### Done when
Can plan meals for the week, navigate between weeks, and push ingredients to shopping list.

**STATUS: COMPLETE ✓**

---

## Phase 5 — Recipes

**Goal:** A browsable recipe library with AI-assisted adding.

### Tasks
- [x] `GET /api/recipes` — list/search saved recipes
- [x] `GET /api/recipes/{id}` — recipe detail
- [x] `POST /api/recipes` — save a recipe
- [x] `PUT /api/recipes/{id}` — update recipe
- [x] `DELETE /api/recipes/{id}` — delete recipe
- [x] `POST /api/recipes/{id}/image` — upload image for a recipe
- [x] `GET /api/recipes/images/{filename}` — serve recipe image
- [x] `POST /api/recipes/parse-url` — stub (wired in Phase 6)
- [x] `POST /api/recipes/generate` — stub (wired in Phase 6)
- [x] `POST /api/recipes/{id}/generate-image` — stub (wired in Phase 6)
- [x] Recipes page:
  - [x] Grid of recipe cards (image/placeholder, name, cook time, servings)
  - [x] Search bar
  - [x] Add via URL flow (imports as draft, opens in editor)
  - [x] Add via AI prompt flow (generates draft, opens in editor)
- [x] Recipe detail page: image (hover to change), ingredients, method, meta
- [x] Add/edit recipe form: name, description, prep/cook/serves, ingredients, method, URL

### Done when
Can browse recipes, add via URL or AI, edit before saving, and view detail.

**STATUS: COMPLETE ✓**

---

## Phase 6 — AI Provider Layer

**Goal:** A clean abstraction so providers are truly swappable.

### Tasks
- [x] `AIProvider` Protocol in `backend/ai/base.py`
- [x] `VertexAIProvider` — Gemini 2.0 Flash (text + vision), Imagen 3 (images)
- [x] `GeminiProvider` — Google AI Studio API key alternative
- [x] `backend/ai/prompts.py` — shared prompt strings (receipt, recipe URL, generate, image)
- [x] `backend/ai/factory.py` — reads DB settings first, falls back to env vars
- [x] `GET /api/settings` — masked secrets
- [x] `PUT /api/settings` — persist provider config to SQLite
- [x] `POST /api/settings/test` — smoke-test the configured provider
- [x] Settings page — provider selector, Vertex AI fields, Gemini API key, test button, docker-compose hint
- [x] Wire AI into `POST /api/recipes/parse-url` — fetch URL, strip HTML, parse with Gemini
- [x] Wire AI into `POST /api/recipes/generate` — generate recipe from description
- [x] Wire AI into `POST /api/recipes/{id}/generate-image` — Imagen 3 generation

### Done when
All AI calls go through the abstraction layer. Swapping provider = change one env var.

**STATUS: COMPLETE ✓**

---

## Phase 7 — Receipt Scanning

**Goal:** Upload a receipt, AI extracts it, user confirms, history is stored.

### Tasks
- [x] `POST /api/receipts/upload` — accepts JPEG/PNG/PDF, stores file, AI extracts items
- [x] `POST /api/receipts/{id}/confirm` — user confirms draft, saves ReceiptItems, optionally creates catalogue entries
- [x] `GET /api/receipts` — list with summary (store, date, total, item count)
- [x] `GET /api/receipts/{id}` — detail with all items
- [x] `DELETE /api/receipts/{id}` — delete receipt + file
- [x] `GET /api/receipts/files/{filename}` — serve uploaded file
- [x] Fuzzy catalogue matching on extracted item names
- [x] Receipts page:
  - [x] Drag & drop / click upload zone with loading state
  - [x] AI extraction review: skip toggle, match indicator, "add to catalogue" checkbox
  - [x] Receipt metadata editing (store, date, total) before confirm
  - [x] History list with store, date, total, item count, delete
- [x] Graceful fallback if AI unavailable (returns empty draft for manual entry)

### Done when
Can upload a Woolworths/New World/Pak'n'Save receipt and get structured items saved.

**STATUS: COMPLETE ✓**

---

## Phase 8 — Smart Prompts

**Goal:** Surface helpful reminders based on purchase history.

### Tasks
- [x] `GET /api/insights/suggestions` — frequent items not on current list, with staples fallback
- [x] `GET /api/insights/meal-history?week=` — previous week's meals for planner inspiration
- [x] `GET /api/insights/purchase-trends` — top purchased products with counts
- [x] Shopping list: dismissable "Do you need these?" banner, one-click add, 12h dismiss
- [x] Meal planner: collapsible "Last week you had…" panel with "Add this week" shortcut
- [x] Breakfast/Dairy/Bakery staples used as fallback when receipt history is thin

### Done when
Smart suggestions appear on shopping list and meal planner pages after sufficient history.

**STATUS: COMPLETE ✓**


---

## Phase 9 — Polish

**Goal:** Production-ready. Looks great on mobile. Dark mode. No rough edges.

### Tasks
- [x] Mobile layout audit (bottom nav, touch-friendly tap targets, no horizontal scroll)
- [x] Dark mode (Tailwind `dark:` classes, toggle in settings)
- [x] Loading states and skeleton screens
- [x] Error handling: toast notifications for API errors
- [x] Empty states: helpful copy + CTA when lists/recipes/catalogue are empty
- [x] Keyboard shortcuts: `/` to focus search, `1-5` navigate, `,` settings
- [x] PWA manifest (so it can be "installed" on mobile home screen)
- [x] Docker image size optimisation (multi-stage, .dockerignore)
- [x] README.md: setup and deployment instructions

### Done when
App feels complete, polished, and works well on a phone browser.

**STATUS: COMPLETE ✓**

---

## Resuming a Session

If starting a new Claude Code session, do this first:

1. Read `SPEC.md` — full feature spec and data model
2. Read `PLAN.md` (this file) — find the first unchecked task in the current phase
3. Read any relevant source files before editing them
4. Continue from where the last session left off

Mark tasks `[x]` as they are completed.
