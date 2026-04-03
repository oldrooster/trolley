import os
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import AppSetting

router = APIRouter(prefix="/settings", tags=["settings"])

# Keys that contain secrets — masked on GET
SECRET_KEYS = {"ai.gemini.api_key", "ai.openai.api_key", "ai.anthropic.api_key"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class SettingsOut(BaseModel):
    ai_provider: str
    vertex_project_id: str
    vertex_location: str
    vertex_credentials_path: str
    gemini_api_key: str        # masked if set
    openai_api_key: str        # masked if set
    anthropic_api_key: str     # masked if set


class SettingsIn(BaseModel):
    ai_provider: str | None = None
    vertex_project_id: str | None = None
    vertex_location: str | None = None
    vertex_credentials_path: str | None = None
    gemini_api_key: str | None = None     # empty string = clear
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None


class TestConnectionOut(BaseModel):
    ok: bool
    message: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get(db: Session, key: str, fallback: str = "") -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return (row.value or "") if row else fallback


def _set(db: Session, key: str, value: str) -> None:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))


def _mask(value: str) -> str:
    """Return masked version if value is set."""
    return "••••••••" if value else ""


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return SettingsOut(
        ai_provider=_get(db, "ai.provider", os.getenv("AI_PROVIDER", "vertex")),
        vertex_project_id=_get(db, "ai.vertex.project_id", os.getenv("VERTEX_PROJECT_ID", "")),
        vertex_location=_get(db, "ai.vertex.location", os.getenv("VERTEX_LOCATION", "us-central1")),
        vertex_credentials_path=_get(db, "ai.vertex.credentials_path",
                                     os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")),
        gemini_api_key=_mask(_get(db, "ai.gemini.api_key", os.getenv("GEMINI_API_KEY", ""))),
        openai_api_key=_mask(_get(db, "ai.openai.api_key", os.getenv("OPENAI_API_KEY", ""))),
        anthropic_api_key=_mask(_get(db, "ai.anthropic.api_key", os.getenv("ANTHROPIC_API_KEY", ""))),
    )


@router.put("", response_model=SettingsOut)
def update_settings(body: SettingsIn, db: Session = Depends(get_db)):
    mapping = {
        "ai_provider": "ai.provider",
        "vertex_project_id": "ai.vertex.project_id",
        "vertex_location": "ai.vertex.location",
        "vertex_credentials_path": "ai.vertex.credentials_path",
        "gemini_api_key": "ai.gemini.api_key",
        "openai_api_key": "ai.openai.api_key",
        "anthropic_api_key": "ai.anthropic.api_key",
    }
    for field, db_key in mapping.items():
        value = getattr(body, field)
        if value is not None:  # None = not provided, don't touch
            _set(db, db_key, value)
    db.commit()
    return get_settings(db)


@router.post("/test", response_model=TestConnectionOut)
def test_connection(db: Session = Depends(get_db)):
    """Quick smoke-test the configured AI provider."""
    try:
        from ai.factory import get_ai_provider
        provider = get_ai_provider(db)
        result = provider.chat("Reply with exactly: ok")
        return TestConnectionOut(ok=True, message=f"Connected. Response: {result[:80]}")
    except NotImplementedError as e:
        return TestConnectionOut(ok=False, message=str(e))
    except Exception as e:
        return TestConnectionOut(ok=False, message=str(e))
