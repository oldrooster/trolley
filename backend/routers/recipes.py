import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Recipe, RecipeIngredient, Product

router = APIRouter(prefix="/recipes", tags=["recipes"])

IMAGES_DIR = os.getenv("IMAGES_DIR", "/data/images")


def _ensure_images_dir() -> str:
    os.makedirs(IMAGES_DIR, exist_ok=True)
    return IMAGES_DIR


# ── Schemas ───────────────────────────────────────────────────────────────────

class IngredientIn(BaseModel):
    product_id: int | None = None
    ingredient_name: str
    quantity: float | None = None
    unit: str | None = None
    notes: str | None = None
    create_product: bool = False  # create a base catalogue entry if no match
    category_id: int | None = None  # suggested category for new product
    new_base_name: str | None = None    # user-supplied base name for new product
    new_variant_name: str | None = None  # user-supplied variant name for new product


class IngredientOut(BaseModel):
    id: int
    recipe_id: int
    product_id: int | None = None
    ingredient_name: str
    quantity: float | None = None
    unit: str | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


class RecipeCreate(BaseModel):
    name: str
    description: str | None = None
    method: str | None = None
    source_url: str | None = None
    servings: int | None = None
    prep_time_mins: int | None = None
    cook_time_mins: int | None = None
    difficulty: str | None = None    # everyone / kid_friendly / teen / adult
    nutrition: str | None = None     # very_healthy / healthy / moderate / indulgent
    is_quick: bool = False
    ingredients: list[IngredientIn] = []


class RecipeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    method: str | None = None
    source_url: str | None = None
    servings: int | None = None
    prep_time_mins: int | None = None
    cook_time_mins: int | None = None
    difficulty: str | None = None
    nutrition: str | None = None
    is_quick: bool | None = None
    ingredients: list[IngredientIn] | None = None


class RecipeOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    method: str | None = None
    image_path: str | None = None
    source_url: str | None = None
    servings: int | None = None
    prep_time_mins: int | None = None
    cook_time_mins: int | None = None
    difficulty: str | None = None
    nutrition: str | None = None
    is_quick: bool = False
    created_at: datetime
    ingredients: list[IngredientOut]

    model_config = {"from_attributes": True}


class RecipeSummary(BaseModel):
    id: int
    name: str
    description: str | None = None
    image_path: str | None = None
    servings: int | None = None
    prep_time_mins: int | None = None
    cook_time_mins: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ParseUrlBody(BaseModel):
    url: str


class GenerateBody(BaseModel):
    description: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def load_recipe(db: Session, recipe_id: int) -> Recipe:
    recipe = (
        db.query(Recipe)
        .options(joinedload(Recipe.ingredients))
        .filter(Recipe.id == recipe_id)
        .first()
    )
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    return recipe


def save_ingredients(db: Session, recipe_id: int, ingredients: list[IngredientIn]) -> None:
    from models import Product
    db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe_id).delete()
    for ing in ingredients:
        product_id = ing.product_id
        if ing.create_product and not product_id:
            base = (ing.new_base_name or ing.ingredient_name).strip().title()
            variant = ing.new_variant_name.strip().title() if ing.new_variant_name else None
            existing = db.query(Product).filter(
                Product.base_name == base,
                Product.variant_name == variant if variant else Product.variant_name.is_(None),
                Product.brand_name.is_(None),
            ).first()
            if existing:
                product_id = existing.id
            else:
                p = Product(base_name=base, variant_name=variant, unit=ing.unit or "each", category_id=ing.category_id)
                db.add(p)
                db.flush()
                product_id = p.id
        db.add(RecipeIngredient(
            recipe_id=recipe_id,
            product_id=product_id,
            ingredient_name=ing.ingredient_name,
            quantity=ing.quantity,
            unit=ing.unit,
            notes=ing.notes,
        ))


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[RecipeSummary])
def list_recipes(q: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Recipe)
    if q:
        pattern = f"%{q}%"
        query = query.filter(Recipe.name.ilike(pattern))
    return query.order_by(Recipe.name).all()


@router.get("/{recipe_id}", response_model=RecipeOut)
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    return load_recipe(db, recipe_id)


@router.post("", response_model=RecipeOut, status_code=201)
def create_recipe(body: RecipeCreate, db: Session = Depends(get_db)):
    recipe = Recipe(**body.model_dump(exclude={"ingredients"}))
    db.add(recipe)
    db.flush()
    save_ingredients(db, recipe.id, body.ingredients)
    db.commit()
    return load_recipe(db, recipe.id)


@router.put("/{recipe_id}", response_model=RecipeOut)
def update_recipe(recipe_id: int, body: RecipeUpdate, db: Session = Depends(get_db)):
    recipe = load_recipe(db, recipe_id)
    for field, value in body.model_dump(exclude_unset=True, exclude={"ingredients"}).items():
        setattr(recipe, field, value)
    if body.ingredients is not None:
        save_ingredients(db, recipe_id, body.ingredients)
    db.commit()
    return load_recipe(db, recipe_id)


@router.delete("/{recipe_id}", status_code=204)
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    # Delete image file if present
    if recipe.image_path:
        path = os.path.join(_ensure_images_dir(), os.path.basename(recipe.image_path))
        if os.path.exists(path):
            os.remove(path)
    db.delete(recipe)
    db.commit()


@router.post("/{recipe_id}/image", response_model=RecipeOut)
async def upload_image(recipe_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    recipe = load_recipe(db, recipe_id)
    images_dir = _ensure_images_dir()
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(images_dir, filename)
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)
    # Delete old image
    if recipe.image_path:
        old = os.path.join(images_dir, os.path.basename(recipe.image_path))
        if os.path.exists(old):
            os.remove(old)
    recipe.image_path = f"/api/recipes/images/{filename}"
    db.commit()
    return load_recipe(db, recipe_id)


@router.get("/images/{filename}")
def get_image(filename: str):
    path = os.path.join(IMAGES_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, "Image not found")
    return FileResponse(path)


@router.post("/parse-url", response_model=RecipeOut)
def parse_recipe_url(body: ParseUrlBody, db: Session = Depends(get_db)):
    """Parse a recipe from a URL using the configured AI provider."""
    from ai.factory import get_ai_provider
    try:
        provider = get_ai_provider(db)
        recipe_data = provider.parse_recipe_from_url(body.url)
    except Exception as e:
        # AI unavailable or URL failed — create blank draft so user can fill in
        recipe_data = None
        fallback_name = f"Recipe from {body.url[:60]}"
        fallback_desc = f"Could not auto-parse: {e}. Please fill in manually."

    if recipe_data:
        recipe = Recipe(
            name=recipe_data.name,
            description=recipe_data.description,
            method=recipe_data.method,
            source_url=recipe_data.source_url or body.url,
            servings=recipe_data.servings,
            prep_time_mins=recipe_data.prep_time_mins,
            cook_time_mins=recipe_data.cook_time_mins,
        )
        db.add(recipe)
        db.flush()
        for ing in recipe_data.ingredients:
            db.add(RecipeIngredient(recipe_id=recipe.id, **ing))
    else:
        recipe = Recipe(name=fallback_name, description=fallback_desc, source_url=body.url)
        db.add(recipe)

    db.commit()
    return load_recipe(db, recipe.id)


@router.post("/generate", response_model=RecipeOut)
def generate_recipe(body: GenerateBody, db: Session = Depends(get_db)):
    """Generate a recipe from a description using the configured AI provider."""
    from ai.factory import get_ai_provider
    try:
        provider = get_ai_provider(db)
        recipe_data = provider.generate_recipe(body.description)
    except Exception as e:
        recipe_data = None
        fallback_desc = f"AI generation failed: {e}. Please fill in manually."

    if recipe_data:
        recipe = Recipe(
            name=recipe_data.name,
            description=recipe_data.description,
            method=recipe_data.method,
            servings=recipe_data.servings,
            prep_time_mins=recipe_data.prep_time_mins,
            cook_time_mins=recipe_data.cook_time_mins,
        )
        db.add(recipe)
        db.flush()
        for ing in recipe_data.ingredients:
            db.add(RecipeIngredient(recipe_id=recipe.id, **ing))
    else:
        recipe = Recipe(name=body.description[:80], description=fallback_desc)
        db.add(recipe)

    db.commit()
    return load_recipe(db, recipe.id)


@router.post("/{recipe_id}/generate-image", response_model=RecipeOut)
def generate_recipe_image(recipe_id: int, db: Session = Depends(get_db)):
    """Generate an image for a recipe using the configured AI provider."""
    from ai.factory import get_ai_provider
    from ai.prompts import RECIPE_IMAGE
    recipe = load_recipe(db, recipe_id)
    try:
        provider = get_ai_provider(db)
        image_bytes = provider.generate_image(RECIPE_IMAGE.format(recipe_name=recipe.name))
        images_dir = _ensure_images_dir()
        filename = f"{uuid.uuid4().hex}.png"
        with open(os.path.join(images_dir, filename), "wb") as f:
            f.write(image_bytes)
        if recipe.image_path:
            old = os.path.join(images_dir, os.path.basename(recipe.image_path))
            if os.path.exists(old):
                os.remove(old)
        recipe.image_path = f"/api/recipes/images/{filename}"
        db.commit()
    except Exception as e:
        raise HTTPException(502, f"Image generation failed: {e}")
    return load_recipe(db, recipe_id)
