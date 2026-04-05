from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import FamilyMember

router = APIRouter(prefix="/family", tags=["family"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class FamilyMemberCreate(BaseModel):
    name: str
    age_group: str   # kid / teen / adult
    emoji: str | None = None


class FamilyMemberUpdate(BaseModel):
    name: str | None = None
    age_group: str | None = None
    emoji: str | None = None
    active: bool | None = None


class FamilyMemberOut(BaseModel):
    id: int
    name: str
    age_group: str
    emoji: str | None = None
    active: bool

    model_config = {"from_attributes": True}


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[FamilyMemberOut])
def list_members(include_inactive: bool = False, db: Session = Depends(get_db)):
    q = db.query(FamilyMember)
    if not include_inactive:
        q = q.filter(FamilyMember.active == True)
    return q.order_by(FamilyMember.id).all()


@router.post("", response_model=FamilyMemberOut, status_code=201)
def create_member(body: FamilyMemberCreate, db: Session = Depends(get_db)):
    member = FamilyMember(**body.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.put("/{member_id}", response_model=FamilyMemberOut)
def update_member(member_id: int, body: FamilyMemberUpdate, db: Session = Depends(get_db)):
    member = db.get(FamilyMember, member_id)
    if not member:
        raise HTTPException(404, "Member not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(member, field, value)
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{member_id}", status_code=204)
def delete_member(member_id: int, db: Session = Depends(get_db)):
    member = db.get(FamilyMember, member_id)
    if not member:
        raise HTTPException(404, "Member not found")
    db.delete(member)
    db.commit()
