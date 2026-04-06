from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Product, Category
from schemas import ProductCreate, ProductUpdate, ProductOut, CategoryOut
from fts import fts_search

router = APIRouter(tags=["catalogue"])


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.name).all()


# ── Catalogue search ──────────────────────────────────────────────────────────

@router.get("/catalogue/search", response_model=list[ProductOut])
def search_catalogue(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, le=50),
    db: Session = Depends(get_db),
):
    ids = fts_search(db, q, limit)
    if not ids:
        return []
    products = (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(Product.id.in_(ids))
        .all()
    )
    # Sort: base_name matches first, then variant, then brand.
    # Within each tier: base-only (no variant/brand) before specific entries.
    q_lower = q.lower()

    def _sort_key(p: Product):
        if q_lower in p.base_name.lower():
            tier = 0
        elif p.variant_name and q_lower in p.variant_name.lower():
            tier = 1
        elif p.brand_name and q_lower in p.brand_name.lower():
            tier = 2
        else:
            tier = 3
        specificity = (1 if p.variant_name else 0) + (1 if p.brand_name else 0)
        return (tier, specificity)

    return sorted(products, key=_sort_key)


# ── Catalogue browse ──────────────────────────────────────────────────────────

class CatalogueResponse(BaseModel):
    items: list[ProductOut]
    total: int
    limit: int

    model_config = {"from_attributes": True}


@router.get("/catalogue", response_model=CatalogueResponse)
def list_catalogue(
    category_id: int | None = None,
    skip: int = 0,
    limit: int = Query(100, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Product).options(joinedload(Product.category))
    if category_id is not None:
        q = q.filter(Product.category_id == category_id)
    total = db.query(Product.id).filter(
        *([Product.category_id == category_id] if category_id is not None else [])
    ).count()
    items = q.order_by(Product.base_name, Product.variant_name).offset(skip).limit(limit).all()
    return CatalogueResponse(items=items, total=total, limit=limit)


# ── Single product ───────────────────────────────────────────────────────────

@router.get("/catalogue/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(Product.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(404, "Product not found")
    return product


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("/catalogue", response_model=ProductOut, status_code=201)
def create_product(body: ProductCreate, db: Session = Depends(get_db)):
    if body.category_id:
        if not db.get(Category, body.category_id):
            raise HTTPException(404, "Category not found")
    product = Product(**body.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return db.query(Product).options(joinedload(Product.category)).filter(Product.id == product.id).one()


# ── Update ────────────────────────────────────────────────────────────────────

@router.put("/catalogue/{product_id}", response_model=ProductOut)
def update_product(product_id: int, body: ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    old_base_name = product.base_name
    old_variant_name = product.variant_name

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    # Cascade base_name rename to all siblings sharing the same base_name
    if body.base_name is not None and body.base_name != old_base_name:
        siblings = db.query(Product).filter(
            Product.base_name == old_base_name,
            Product.id != product_id,
        ).all()
        for s in siblings:
            s.base_name = body.base_name

    # Cascade variant_name rename to all siblings sharing the same variant_name (brand rows)
    if body.variant_name is not None and body.variant_name != old_variant_name and old_variant_name is not None:
        siblings = db.query(Product).filter(
            Product.base_name == product.base_name,
            Product.variant_name == old_variant_name,
            Product.id != product_id,
        ).all()
        for s in siblings:
            s.variant_name = body.variant_name

    db.commit()
    db.refresh(product)
    return db.query(Product).options(joinedload(Product.category)).filter(Product.id == product_id).one()


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/catalogue/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    db.delete(product)
    db.commit()
