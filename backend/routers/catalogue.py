from fastapi import APIRouter, Depends, HTTPException, Query
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
    # Preserve FTS rank order
    order = {pid: idx for idx, pid in enumerate(ids)}
    return sorted(products, key=lambda p: order.get(p.id, 999))


# ── Catalogue browse ──────────────────────────────────────────────────────────

@router.get("/catalogue", response_model=list[ProductOut])
def list_catalogue(
    category_id: int | None = None,
    skip: int = 0,
    limit: int = Query(100, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Product).options(joinedload(Product.category))
    if category_id is not None:
        q = q.filter(Product.category_id == category_id)
    return q.order_by(Product.base_name, Product.variant_name).offset(skip).limit(limit).all()


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
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
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
