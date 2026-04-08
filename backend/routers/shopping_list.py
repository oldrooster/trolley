from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import ShoppingList, ShoppingListItem, Product, Recipe
from schemas import ProductOut

router = APIRouter(prefix="/list", tags=["shopping-list"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ItemOut(BaseModel):
    id: int
    list_id: int
    product_id: int | None = None
    product: ProductOut | None = None
    custom_name: str | None = None
    quantity: float
    unit: str | None = None
    checked: bool
    added_at: datetime
    source_meals: list[str] | None = None

    model_config = {"from_attributes": True}


class ListOut(BaseModel):
    id: int
    created_at: datetime
    archived_at: datetime | None = None
    items: list[ItemOut]

    model_config = {"from_attributes": True}


class ListSummary(BaseModel):
    id: int
    created_at: datetime
    archived_at: datetime | None = None
    item_count: int

    model_config = {"from_attributes": True}


class AddItemBody(BaseModel):
    product_id: int | None = None
    custom_name: str | None = None
    quantity: float = 1.0
    unit: str | None = None


class UpdateItemBody(BaseModel):
    quantity: float | None = None
    checked: bool | None = None
    custom_name: str | None = None


class AddFromMealsBody(BaseModel):
    meal_ids: list[int]


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_or_create_active(db: Session) -> ShoppingList:
    active = db.query(ShoppingList).filter(ShoppingList.archived_at.is_(None)).first()
    if not active:
        active = ShoppingList()
        db.add(active)
        db.commit()
        db.refresh(active)
    return active


def load_list(db: Session, list_id: int) -> ShoppingList:
    return (
        db.query(ShoppingList)
        .options(
            joinedload(ShoppingList.items)
            .joinedload(ShoppingListItem.product)
            .joinedload(Product.category)
        )
        .filter(ShoppingList.id == list_id)
        .one()
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/active", response_model=ListOut)
def get_active_list(db: Session = Depends(get_db)):
    active = get_or_create_active(db)
    return load_list(db, active.id)


@router.post("/items", response_model=ItemOut, status_code=201)
def add_item(body: AddItemBody, db: Session = Depends(get_db)):
    if not body.product_id and not body.custom_name:
        raise HTTPException(400, "Provide product_id or custom_name")
    active = get_or_create_active(db)

    # Resolve unit from product if not provided
    unit = body.unit
    if body.product_id and not unit:
        product = db.get(Product, body.product_id)
        if product:
            unit = product.unit

    item = ShoppingListItem(
        list_id=active.id,
        product_id=body.product_id,
        custom_name=body.custom_name,
        quantity=body.quantity,
        unit=unit,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    # Reload with product relationship
    return (
        db.query(ShoppingListItem)
        .options(joinedload(ShoppingListItem.product).joinedload(Product.category))
        .filter(ShoppingListItem.id == item.id)
        .one()
    )


@router.patch("/items/{item_id}", response_model=ItemOut)
def update_item(item_id: int, body: UpdateItemBody, db: Session = Depends(get_db)):
    item = db.get(ShoppingListItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    if body.quantity is not None:
        item.quantity = body.quantity
    if body.checked is not None:
        item.checked = body.checked
    if body.custom_name is not None:
        item.custom_name = body.custom_name
    db.commit()
    db.refresh(item)
    return (
        db.query(ShoppingListItem)
        .options(joinedload(ShoppingListItem.product).joinedload(Product.category))
        .filter(ShoppingListItem.id == item_id)
        .one()
    )


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(ShoppingListItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    db.delete(item)
    db.commit()


@router.post("/archive", response_model=ListOut)
def archive_list(db: Session = Depends(get_db)):
    active = get_or_create_active(db)
    active.archived_at = datetime.utcnow()
    db.commit()
    # Create and return new active list
    new_list = ShoppingList()
    db.add(new_list)
    db.commit()
    return load_list(db, new_list.id)


@router.get("/history", response_model=list[ListSummary])
def list_history(db: Session = Depends(get_db)):
    lists = (
        db.query(ShoppingList)
        .filter(ShoppingList.archived_at.isnot(None))
        .order_by(ShoppingList.archived_at.desc())
        .limit(52)  # 1 year of weekly shops
        .all()
    )
    result = []
    for lst in lists:
        count = db.query(ShoppingListItem).filter(ShoppingListItem.list_id == lst.id).count()
        result.append(ListSummary(
            id=lst.id,
            created_at=lst.created_at,
            archived_at=lst.archived_at,
            item_count=count,
        ))
    return result


@router.post("/add-from-meals", response_model=ListOut)
def add_from_meals(body: AddFromMealsBody, db: Session = Depends(get_db)):
    """Add all recipe ingredients from selected weekly plan meals to the active list.

    Idempotent per meal ID — re-clicking with the same meals will not double quantities.
    Quantities are summed when the same recipe appears multiple times in the selection.
    """
    from models import WeeklyPlanMeal, RecipeIngredient

    active = get_or_create_active(db)

    # ── Accumulate ingredients ────────────────────────────────────────────────
    # Key: (product_id, unit) or (ingredient_name, unit) — different units are
    # intentionally separate keys so they become separate list items (Option 2).
    # acc[key][meal_id] = (qty, unit, custom_name, recipe_name)
    IngEntry = tuple  # (qty, unit, custom_name, recipe_name)
    # Using tuple key: (product_id_or_name, normalised_unit)
    acc: dict[tuple, dict[int, IngEntry]] = {}

    def _unit_key(unit: str | None) -> str:
        """Normalise unit string for grouping — same unit spelt differently still groups."""
        return (unit or '').strip().lower()

    for meal_id in body.meal_ids:
        meal = (
            db.query(WeeklyPlanMeal)
            .options(joinedload(WeeklyPlanMeal.recipe))
            .filter(WeeklyPlanMeal.id == meal_id)
            .first()
        )
        if not meal or not meal.recipe_id:
            continue
        recipe_name = meal.recipe.name if meal.recipe else "Unknown"
        ingredients = db.query(RecipeIngredient).filter(
            RecipeIngredient.recipe_id == meal.recipe_id
        ).all()
        for ing in ingredients:
            ing_id: int | str = ing.product_id if ing.product_id else ing.ingredient_name
            key = (ing_id, _unit_key(ing.unit))
            qty = ing.quantity or 1.0
            if key not in acc:
                acc[key] = {}
            if meal_id in acc[key]:
                prev = acc[key][meal_id]
                acc[key][meal_id] = (prev[0] + qty, prev[1], prev[2], prev[3])
            else:
                acc[key][meal_id] = (
                    qty,
                    ing.unit,
                    None if ing.product_id else ing.ingredient_name,
                    recipe_name,
                )

    # ── Merge into the active list ────────────────────────────────────────────
    # Key on (product_id, normalised unit) so different-unit entries are distinct.
    existing_by_product_unit: dict[tuple, ShoppingListItem] = {
        (item.product_id, _unit_key(item.unit)): item
        for item in active.items
        if item.product_id
    }

    for (ing_id, unit_key), per_meal in acc.items():
        if isinstance(ing_id, int):
            lookup = (ing_id, unit_key)
            if lookup in existing_by_product_unit:
                existing = existing_by_product_unit[lookup]
                existing_ids = set(existing.source_meal_ids or [])
                new_meals = {mid: data for mid, data in per_meal.items() if mid not in existing_ids}
                if not new_meals:
                    continue
                existing.quantity += sum(d[0] for d in new_meals.values())
                existing_meals = list(existing.source_meals or [])
                merged_ids = list(existing_ids)
                for mid, (_, _, _, rname) in new_meals.items():
                    if rname not in existing_meals:
                        existing_meals.append(rname)
                    merged_ids.append(mid)
                existing.source_meals = sorted(existing_meals)
                existing.source_meal_ids = sorted(merged_ids)
            else:
                total_qty = sum(d[0] for d in per_meal.values())
                unit = next(iter(per_meal.values()))[1]
                meal_names = sorted({d[3] for d in per_meal.values()})
                meal_ids = sorted(per_meal.keys())
                db.add(ShoppingListItem(
                    list_id=active.id,
                    product_id=ing_id,
                    quantity=total_qty,
                    unit=unit,
                    source_meals=meal_names,
                    source_meal_ids=meal_ids,
                ))
        else:
            total_qty = sum(d[0] for d in per_meal.values())
            unit = next(iter(per_meal.values()))[1]
            custom_name = next(iter(per_meal.values()))[2]
            meal_names = sorted({d[3] for d in per_meal.values()})
            meal_ids = sorted(per_meal.keys())
            db.add(ShoppingListItem(
                list_id=active.id,
                custom_name=custom_name,
                quantity=total_qty,
                unit=unit,
                source_meals=meal_names,
                source_meal_ids=meal_ids,
            ))

    db.commit()
    return load_list(db, active.id)
