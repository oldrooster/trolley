from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import WeeklyPlan, WeeklyPlanMeal, Recipe

router = APIRouter(prefix="/plans", tags=["meal-planner"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class RecipeSummary(BaseModel):
    id: int
    name: str
    image_path: str | None = None
    prep_time_mins: int | None = None
    cook_time_mins: int | None = None
    difficulty: str | None = None
    nutrition: str | None = None

    model_config = {"from_attributes": True}


class MealOut(BaseModel):
    id: int
    plan_id: int
    meal_type: str
    recipe_id: int | None = None
    recipe: RecipeSummary | None = None
    custom_name: str | None = None
    day_hint: str | None = None
    notes: str | None = None
    assigned_member_ids: list[int] | None = None

    model_config = {"from_attributes": True}


class PlanOut(BaseModel):
    id: int
    week_start: date
    meals: list[MealOut]

    model_config = {"from_attributes": True}


class AddMealBody(BaseModel):
    meal_type: str          # breakfast / lunch / dinner / snack
    recipe_id: int | None = None
    custom_name: str | None = None
    day_hint: str | None = None   # mon/tue/wed/thu/fri/sat/sun
    notes: str | None = None
    assigned_member_ids: list[int] | None = None


class UpdateMealBody(BaseModel):
    meal_type: str | None = None
    recipe_id: int | None = None
    custom_name: str | None = None
    day_hint: str | None = None
    notes: str | None = None
    assigned_member_ids: list[int] | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def load_plan(db: Session, plan_id: int) -> WeeklyPlan:
    return (
        db.query(WeeklyPlan)
        .options(joinedload(WeeklyPlan.meals).joinedload(WeeklyPlanMeal.recipe))
        .filter(WeeklyPlan.id == plan_id)
        .one()
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=PlanOut)
def get_plan(week: str | None = None, db: Session = Depends(get_db)):
    """Get plan for a week. week = ISO date string (any day in that week).
    Defaults to current week. Creates plan if it doesn't exist."""
    if week:
        try:
            target = monday_of(date.fromisoformat(week))
        except ValueError:
            raise HTTPException(400, "Invalid date format, use YYYY-MM-DD")
    else:
        target = monday_of(date.today())

    plan = db.query(WeeklyPlan).filter(WeeklyPlan.week_start == target).first()
    if not plan:
        plan = WeeklyPlan(week_start=target)
        db.add(plan)
        db.commit()
        db.refresh(plan)

    return load_plan(db, plan.id)


@router.post("/{plan_id}/meals", response_model=MealOut, status_code=201)
def add_meal(plan_id: int, body: AddMealBody, db: Session = Depends(get_db)):
    plan = db.get(WeeklyPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    if not body.recipe_id and not body.custom_name:
        raise HTTPException(400, "Provide recipe_id or custom_name")
    if body.recipe_id and not db.get(Recipe, body.recipe_id):
        raise HTTPException(404, "Recipe not found")

    meal = WeeklyPlanMeal(plan_id=plan_id, **body.model_dump())
    db.add(meal)
    db.commit()
    db.refresh(meal)
    return (
        db.query(WeeklyPlanMeal)
        .options(joinedload(WeeklyPlanMeal.recipe))
        .filter(WeeklyPlanMeal.id == meal.id)
        .one()
    )


@router.put("/meals/{meal_id}", response_model=MealOut)
def update_meal(meal_id: int, body: UpdateMealBody, db: Session = Depends(get_db)):
    meal = db.get(WeeklyPlanMeal, meal_id)
    if not meal:
        raise HTTPException(404, "Meal not found")
    if body.recipe_id and not db.get(Recipe, body.recipe_id):
        raise HTTPException(404, "Recipe not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(meal, field, value)
    db.commit()
    return (
        db.query(WeeklyPlanMeal)
        .options(joinedload(WeeklyPlanMeal.recipe))
        .filter(WeeklyPlanMeal.id == meal_id)
        .one()
    )


@router.delete("/meals/{meal_id}", status_code=204)
def delete_meal(meal_id: int, db: Session = Depends(get_db)):
    meal = db.get(WeeklyPlanMeal, meal_id)
    if not meal:
        raise HTTPException(404, "Meal not found")
    db.delete(meal)
    db.commit()
