# Ingredient Unit Normalisation

## The Problem

When the same ingredient is added to the shopping list from multiple meals with **different units** (e.g. one recipe uses `1 cup of milk`, another uses `1L of milk`), naively summing quantities produces a wrong result (`2 cups`).

## Current Behaviour (intentional)

**Show both quantities as separate entries.** If units differ, milk appears twice: `1L` and `1 cup`. This is honest, unambiguous, and errs on the side of buying more rather than computing something subtly wrong.

This was a deliberate decision — unit normalisation has enough edge cases that it's not worth the complexity until it actually causes real friction with the family.

---

## Options Considered

### Option 1 — Normalise to a base unit
Convert everything to ml/g/each before summing, display in a readable unit (L if ≥1L, ml otherwise; kg if ≥1kg, g otherwise).

- ✅ Single clean line item, mathematically correct for same-type units
- ❌ Needs a conversion table + per-ingredient measurement type
- ❌ Cross-type conversions are genuinely hard (1 cup flour ≠ 1 cup milk in grams)
- ❌ Some ingredients are ambiguous (butter: `125g` vs `1 cup`)

### Option 2 — Show both (current choice)
Group by unit. Same unit → sum. Different units → separate entries.

- ✅ Always accurate, zero ambiguity
- ✅ Zero implementation complexity
- ❌ Slightly more cognitive load at the shop

### Option 3 — Flag mixed units
One line item, but show a ⚠ badge when units were mixed. Still technically wrong.

---

## Future Implementation Plan

When we come back to this, here's the agreed architecture:

### 1. Add `measurement_type` to `Product`
```
volume | weight | count | other
```
This is the source of truth. Milk = `volume`, garlic = `count`, flour = `weight`.

### 2. Hardcoded conversion table
Only within-type conversions — no cross-type guessing:
```
volume: ml ↔ L ↔ tsp ↔ tbsp ↔ cup
weight: g ↔ kg
count:  each / cloves / pieces — no conversion, just sum
```
Approximate factors are fine (1 cup ≈ 237ml, 1 tsp ≈ 5ml). "Roughly right, err on more" is acceptable.

### 3. NZ-specific display rules
- Liquids: display in `L` if ≥1L, otherwise `ml`
- Solids: display in `kg` if ≥1kg, otherwise `g`
- Count items (garlic, onions, eggs): always display as `each` regardless of recipe unit

### 4. AI enrichment (at recipe-save time, not query time)
When a recipe is saved, trigger a background call to the AI provider:
> "For each of these ingredients and units, what is the measurement type (volume/weight/count) and canonical base unit?"

Store the result on `Product.measurement_type`. Runs once per product, then it's just a lookup forever.

### 5. Hybrid fallback
If units are same-type and convertible → normalise and sum.  
If incompatible or unknown → fall back to Option 2 (show both).

### Edge cases to handle eventually
- Butter: used as both weight (`125g`) and volume (`1 cup`) in different recipes
- Garlic: `2 cloves` vs `1 tsp minced` — genuinely incompatible, show both
- For these, `measurement_type` may need to be a list, not a single value

---

## Files to touch when implementing
- `backend/models.py` — add `measurement_type` to `Product`
- `backend/main.py` — migration for new column
- `backend/routers/shopping_list.py` — normalisation logic in `add_from_meals`
- `backend/routers/recipes.py` — trigger AI enrichment on recipe save
- `frontend/src/lib/types.ts` — add `measurement_type` to `Product`
