from datetime import date, timedelta
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Receipt, ReceiptItem, ShoppingList, ShoppingListItem, Product, Category, WeeklyPlan, WeeklyPlanMeal
from schemas import ProductOut

router = APIRouter(prefix="/insights", tags=["insights"])

# Categories treated as "breakfast / everyday staples" for the fallback prompt
STAPLE_CATEGORIES = {"Breakfast", "Dairy & Eggs", "Bakery"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class SuggestionsOut(BaseModel):
    source: str          # "history" | "staples" | "mixed" | "none"
    items: list[ProductOut]


class MealHistoryOut(BaseModel):
    week_start: date
    meals: list[dict]    # [{name, meal_type, day_hint}]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _active_product_ids(db: Session) -> set[int]:
    """Product IDs already on the active shopping list."""
    active = db.query(ShoppingList).filter(ShoppingList.archived_at.is_(None)).first()
    if not active:
        return set()
    return {item.product_id for item in active.items if item.product_id}


def _history_suggestions(db: Session, exclude_ids: set[int], limit: int = 10) -> list[Product]:
    """
    Products that appear in >50% of the last 8 confirmed receipt trips,
    not currently on the active list.
    """
    # Last 8 receipts that have at least one item
    receipts = (
        db.query(Receipt)
        .filter(Receipt.items.any())
        .order_by(Receipt.uploaded_at.desc())
        .limit(8)
        .all()
    )
    if not receipts:
        return []

    threshold = max(2, len(receipts) * 0.5)
    product_counts: dict[int, int] = {}

    for receipt in receipts:
        seen = set()
        for item in receipt.items:
            if item.product_id and item.product_id not in seen:
                product_counts[item.product_id] = product_counts.get(item.product_id, 0) + 1
                seen.add(item.product_id)

    frequent_ids = [
        pid for pid, count in sorted(product_counts.items(), key=lambda x: -x[1])
        if count >= threshold and pid not in exclude_ids
    ][:limit]

    if not frequent_ids:
        return []

    products = (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(Product.id.in_(frequent_ids))
        .all()
    )
    # Preserve frequency order
    order = {pid: i for i, pid in enumerate(frequent_ids)}
    return sorted(products, key=lambda p: order.get(p.id, 999))


def _staple_suggestions(db: Session, exclude_ids: set[int], limit: int = 10) -> list[Product]:
    """
    Fallback when there's little receipt history: return items from staple
    categories (Breakfast, Dairy & Eggs, Bakery) not already on the list.
    """
    staple_cat_ids = [
        c.id for c in db.query(Category).filter(Category.name.in_(STAPLE_CATEGORIES)).all()
    ]
    if not staple_cat_ids:
        return []

    return (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(
            Product.category_id.in_(staple_cat_ids),
            Product.id.notin_(exclude_ids),
        )
        .order_by(Product.base_name)
        .limit(limit)
        .all()
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/suggestions", response_model=SuggestionsOut)
def get_suggestions(db: Session = Depends(get_db)):
    """
    Returns purchase suggestions for the active shopping list.
    - Primary: items frequently bought (>50% of last 8 trips) but not on current list.
    - Fallback: breakfast/dairy/bakery staples if receipt history is thin.
    """
    exclude = _active_product_ids(db)
    history = _history_suggestions(db, exclude, limit=10)

    if len(history) >= 3:
        return SuggestionsOut(source="history", items=history)

    staples = _staple_suggestions(db, exclude | {p.id for p in history}, limit=10 - len(history))

    if history:
        combined = history + staples
        return SuggestionsOut(source="mixed", items=combined[:10])

    if staples:
        return SuggestionsOut(source="staples", items=staples)

    return SuggestionsOut(source="none", items=[])


@router.get("/meal-history", response_model=MealHistoryOut | None)
def get_meal_history(week: str | None = None, db: Session = Depends(get_db)):
    """
    Returns the meal plan for the week before the given week (defaults to last week).
    Used to show "last week you had..." inspiration on the meal planner.
    """
    from datetime import date as date_type
    if week:
        try:
            ref = date_type.fromisoformat(week)
        except ValueError:
            ref = date_type.today()
    else:
        ref = date_type.today()

    # Monday of the target week, then go back 7 days
    weekday = ref.weekday()
    this_monday = ref - timedelta(days=weekday)
    last_monday = this_monday - timedelta(days=7)

    plan = (
        db.query(WeeklyPlan)
        .options(joinedload(WeeklyPlan.meals).joinedload(WeeklyPlanMeal.recipe))
        .filter(WeeklyPlan.week_start == last_monday)
        .first()
    )
    if not plan or not plan.meals:
        return None

    return MealHistoryOut(
        week_start=plan.week_start,
        meals=[
            {
                "name": m.recipe.name if m.recipe else m.custom_name,
                "meal_type": m.meal_type,
                "day_hint": m.day_hint,
            }
            for m in plan.meals
            if m.recipe or m.custom_name
        ],
    )


@router.get("/purchase-trends", response_model=list[dict])
def get_purchase_trends(db: Session = Depends(get_db)):
    """
    Returns top purchased products with frequency counts.
    Used for future analytics / smart reordering features.
    """
    receipts = db.query(Receipt).filter(Receipt.items.any()).all()
    product_counts: dict[int, int] = {}

    for receipt in receipts:
        seen = set()
        for item in receipt.items:
            if item.product_id and item.product_id not in seen:
                product_counts[item.product_id] = product_counts.get(item.product_id, 0) + 1
                seen.add(item.product_id)

    if not product_counts:
        return []

    top_ids = sorted(product_counts, key=lambda pid: -product_counts[pid])[:20]
    products = (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(Product.id.in_(top_ids))
        .all()
    )
    order = {pid: i for i, pid in enumerate(top_ids)}
    products.sort(key=lambda p: order.get(p.id, 999))

    return [
        {
            "product_id": p.id,
            "display_name": p.display_name,
            "base_name": p.base_name,
            "category": p.category.name if p.category else None,
            "trip_count": product_counts[p.id],
        }
        for p in products
    ]
