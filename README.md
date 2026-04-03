# Trolley 🛒

A self-hosted weekly grocery shopping app for New Zealand households. Manage your shopping list, plan meals for the week, store recipes, and scan receipts — all in one container.

## Features

- **Shopping list** — FTS autocomplete from your product catalogue, smart suggestions based on purchase history
- **Weekly meal planner** — Mon–Sun grid, attach recipes or free-text meals, one-click add ingredients to list
- **Recipe library** — Import from URL, generate with AI, store with images
- **Product catalogue** — 3-level hierarchy (base → variant → brand), pre-seeded with ~80 NZ products
- **Receipt scanning** — Upload photo or PDF, AI extracts items and fuzzy-matches your catalogue
- **Dark mode** — Persisted per-device
- **PWA** — Add to home screen on iOS/Android

## Quick start

```bash
docker compose up -d
```

Open [http://localhost:8080](http://localhost:8080).

Data is stored in the `trolley-data` Docker volume at `/data/trolley.db`.

## Configuration

All configuration is done in **Settings** inside the app. To use AI features (recipe import/generation, receipt scanning), configure an AI provider there.

### Vertex AI (Google Cloud)

Set these environment variables in `docker-compose.yml`:

| Variable | Description |
|---|---|
| `VERTEX_PROJECT` | Your GCP project ID |
| `VERTEX_LOCATION` | Region, e.g. `us-central1` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON (mount the file into the container) |

Requires a service account with the `Vertex AI User` role.

### Gemini API

Set `GEMINI_API_KEY` in `docker-compose.yml`. Get a key at [aistudio.google.com](https://aistudio.google.com).

## docker-compose.yml

```yaml
services:
  trolley:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - trolley-data:/data
      # Uncomment to use Vertex AI with a service account file:
      # - ./service-account.json:/secrets/sa.json:ro
    environment:
      DATABASE_URL: sqlite:////data/trolley.db
      # Vertex AI
      # VERTEX_PROJECT: my-gcp-project
      # VERTEX_LOCATION: us-central1
      # GOOGLE_APPLICATION_CREDENTIALS: /secrets/sa.json
      # Gemini API
      # GEMINI_API_KEY: your-key-here

volumes:
  trolley-data:
```

## Development

### Prerequisites

- Python 3.12+
- Node.js 20+

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev     # dev server on :5173, proxies /api → :8080
```

### Build Docker image

```bash
docker build -t trolley .
```

## Data model

```
Category
  └── Product (base_name / variant_name / brand_name)

ShoppingList (active | archived)
  └── ShoppingListItem → Product

WeeklyPlan (week_start Mon)
  └── WeeklyPlanMeal → Recipe?

Recipe
  └── RecipeIngredient → Product?

Receipt
  └── ReceiptItem → Product?
```

## Backup

```bash
docker run --rm -v trolley-data:/data -v $(pwd):/backup alpine \
  cp /data/trolley.db /backup/trolley-$(date +%Y%m%d).db
```
