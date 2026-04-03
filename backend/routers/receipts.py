import os
import uuid
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Receipt, ReceiptItem, Product, Category

router = APIRouter(prefix="/receipts", tags=["receipts"])

UPLOADS_DIR = os.getenv("UPLOADS_DIR", "/data/receipts")


def _ensure_uploads_dir() -> str:
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    return UPLOADS_DIR


# ── Schemas ───────────────────────────────────────────────────────────────────

class ReceiptItemDraft(BaseModel):
    """An extracted item, pre-matched to catalogue where possible."""
    raw_name: str
    quantity: float | None = None
    unit_price: float | None = None
    total_price: float | None = None
    matched_product_id: int | None = None
    matched_product_name: str | None = None


class ExtractionResult(BaseModel):
    receipt_id: int
    store_name: str | None = None
    purchase_date: str | None = None
    total_amount: float | None = None
    items: list[ReceiptItemDraft]


class ConfirmItem(BaseModel):
    raw_name: str
    quantity: float | None = None
    unit_price: float | None = None
    total_price: float | None = None
    product_id: int | None = None      # confirmed catalogue link
    create_product: bool = False       # create a new catalogue entry for this item
    skip: bool = False                 # exclude from saved items


class ConfirmBody(BaseModel):
    store_name: str | None = None
    purchase_date: str | None = None
    total_amount: float | None = None
    items: list[ConfirmItem]


class ReceiptItemOut(BaseModel):
    id: int
    raw_name: str
    quantity: float | None = None
    unit_price: float | None = None
    total_price: float | None = None
    product_id: int | None = None

    model_config = {"from_attributes": True}


class ReceiptOut(BaseModel):
    id: int
    store_name: str | None = None
    purchase_date: date | None = None
    total_amount: float | None = None
    uploaded_at: datetime
    item_count: int

    model_config = {"from_attributes": True}


class ReceiptDetailOut(BaseModel):
    id: int
    store_name: str | None = None
    purchase_date: date | None = None
    total_amount: float | None = None
    file_path: str | None = None
    uploaded_at: datetime
    items: list[ReceiptItemOut]

    model_config = {"from_attributes": True}


# ── Catalogue fuzzy match ─────────────────────────────────────────────────────

def _fuzzy_match_product(db: Session, raw_name: str) -> Product | None:
    """Very simple fuzzy match: check if any word in raw_name matches a base_name."""
    raw_lower = raw_name.lower()
    products = db.query(Product).all()
    best: Product | None = None
    best_score = 0
    for product in products:
        # Check base_name, variant_name, brand_name
        for field in [product.base_name, product.variant_name, product.brand_name]:
            if field and field.lower() in raw_lower:
                score = len(field)
                if score > best_score:
                    best_score = score
                    best = product
    return best if best_score >= 3 else None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=ExtractionResult)
async def upload_receipt(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload a receipt image or PDF. AI extracts items. Returns draft for user review."""
    allowed = {"image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"}
    content_type = file.content_type or "application/octet-stream"
    if content_type not in allowed:
        raise HTTPException(400, f"Unsupported file type: {content_type}. Upload JPEG, PNG, or PDF.")

    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:  # 20 MB
        raise HTTPException(400, "File too large (max 20 MB)")

    # Save file
    uploads_dir = _ensure_uploads_dir()
    ext = os.path.splitext(file.filename or "")[1].lower() or (".pdf" if "pdf" in content_type else ".jpg")
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(uploads_dir, filename)
    with open(filepath, "wb") as f:
        f.write(file_bytes)

    # Create receipt record (unconfirmed)
    receipt = Receipt(file_path=f"/api/receipts/files/{filename}")
    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    # Run AI extraction
    extraction_items: list[ReceiptItemDraft] = []
    try:
        from ai.factory import get_ai_provider
        provider = get_ai_provider(db)
        result = provider.extract_receipt(file_bytes, content_type)

        receipt.store_name = result.store_name
        receipt.total_amount = result.total_amount
        if result.purchase_date:
            try:
                receipt.purchase_date = date.fromisoformat(result.purchase_date)
            except ValueError:
                pass
        receipt.raw_extraction = {
            "store_name": result.store_name,
            "purchase_date": result.purchase_date,
            "total_amount": result.total_amount,
            "items": result.items,
        }
        db.commit()

        for item in result.items:
            matched = _fuzzy_match_product(db, item.get("raw_name", ""))
            extraction_items.append(ReceiptItemDraft(
                raw_name=item.get("raw_name", ""),
                quantity=item.get("quantity"),
                unit_price=item.get("unit_price"),
                total_price=item.get("total_price"),
                matched_product_id=matched.id if matched else None,
                matched_product_name=(matched.display_name if hasattr(matched, "display_name") else matched.base_name) if matched else None,
            ))
    except Exception as e:
        # AI failed — return empty draft so user can still save manually
        extraction_items = []
        receipt.raw_extraction = {"error": str(e)}
        db.commit()

    db.refresh(receipt)
    return ExtractionResult(
        receipt_id=receipt.id,
        store_name=receipt.store_name,
        purchase_date=receipt.purchase_date.isoformat() if receipt.purchase_date else None,
        total_amount=receipt.total_amount,
        items=extraction_items,
    )


@router.post("/{receipt_id}/confirm", response_model=ReceiptDetailOut)
def confirm_receipt(receipt_id: int, body: ConfirmBody, db: Session = Depends(get_db)):
    """User confirms the extracted data. Saves items; optionally creates catalogue entries."""
    receipt = db.get(Receipt, receipt_id)
    if not receipt:
        raise HTTPException(404, "Receipt not found")

    # Update receipt metadata
    if body.store_name is not None:
        receipt.store_name = body.store_name
    if body.purchase_date:
        try:
            receipt.purchase_date = date.fromisoformat(body.purchase_date)
        except ValueError:
            pass
    if body.total_amount is not None:
        receipt.total_amount = body.total_amount

    # Delete any existing items (re-confirm replaces)
    db.query(ReceiptItem).filter(ReceiptItem.receipt_id == receipt_id).delete()

    for item in body.items:
        if item.skip:
            continue

        product_id = item.product_id

        # Optionally create a new catalogue entry
        if item.create_product and not product_id:
            # Guess category from store section — leave uncategorised for now
            new_product = Product(base_name=item.raw_name.title(), unit="each")
            db.add(new_product)
            db.flush()
            product_id = new_product.id

        db.add(ReceiptItem(
            receipt_id=receipt_id,
            product_id=product_id,
            raw_name=item.raw_name,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.total_price,
        ))

    db.commit()
    return _load_receipt_detail(db, receipt_id)


@router.get("", response_model=list[ReceiptOut])
def list_receipts(db: Session = Depends(get_db)):
    receipts = db.query(Receipt).order_by(Receipt.uploaded_at.desc()).limit(100).all()
    result = []
    for r in receipts:
        count = db.query(ReceiptItem).filter(ReceiptItem.receipt_id == r.id).count()
        result.append(ReceiptOut(
            id=r.id,
            store_name=r.store_name,
            purchase_date=r.purchase_date,
            total_amount=r.total_amount,
            uploaded_at=r.uploaded_at,
            item_count=count,
        ))
    return result


@router.get("/{receipt_id}", response_model=ReceiptDetailOut)
def get_receipt(receipt_id: int, db: Session = Depends(get_db)):
    return _load_receipt_detail(db, receipt_id)


@router.get("/files/{filename}")
def get_receipt_file(filename: str):
    from fastapi.responses import FileResponse
    path = os.path.join(UPLOADS_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, "File not found")
    return FileResponse(path)


@router.delete("/{receipt_id}", status_code=204)
def delete_receipt(receipt_id: int, db: Session = Depends(get_db)):
    receipt = db.get(Receipt, receipt_id)
    if not receipt:
        raise HTTPException(404, "Receipt not found")
    if receipt.file_path:
        fname = os.path.basename(receipt.file_path)
        path = os.path.join(UPLOADS_DIR, fname)
        if os.path.exists(path):
            os.remove(path)
    db.delete(receipt)
    db.commit()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_receipt_detail(db: Session, receipt_id: int) -> Receipt:
    receipt = (
        db.query(Receipt)
        .options(joinedload(Receipt.items))
        .filter(Receipt.id == receipt_id)
        .first()
    )
    if not receipt:
        raise HTTPException(404, "Receipt not found")
    return receipt
