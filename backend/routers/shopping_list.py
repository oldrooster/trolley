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
    """Add all recipe ingredients from selected weekly plan meals to the active list."""
    from models import WeeklyPlanMeal, RecipeIngredient

    active = get_or_create_active(db)

    # Get existing product_ids already on the list (avoid exact duplicates)
    existing_ids = {
        item.product_id for item in active.items if item.product_id
    }

    for meal_id in body.meal_ids:
        meal = db.get(WeeklyPlanMeal, meal_id)
        if not meal or not meal.recipe_id:
            continue
        ingredients = db.query(RecipeIngredient).filter(
            RecipeIngredient.recipe_id == meal.recipe_id
        ).all()
        for ing in ingredients:
            if ing.product_id and ing.product_id in existing_ids:
                continue  # already on list
            item = ShoppingListItem(
                list_id=active.id,
                product_id=ing.product_id,
                custom_name=None if ing.product_id else ing.ingredient_name,
                quantity=ing.quantity or 1.0,
                unit=ing.unit,
            )
            db.add(item)
            if ing.product_id:
                existing_ids.add(ing.product_id)

    db.commit()
    return load_list(db, active.id)
