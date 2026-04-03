"""
Provider factory — reads from DB settings first, falls back to env vars.
"""
import os
from sqlalchemy.orm import Session

from ai.base import AIProvider


def _get_setting(db: Session, key: str, fallback: str = "") -> str:
    from models import AppSetting
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return (row.value or "") if row else fallback


def get_ai_provider(db: Session) -> AIProvider:
    provider = _get_setting(db, "ai.provider", os.getenv("AI_PROVIDER", "vertex"))

    if provider == "vertex":
        from ai.vertex import VertexAIProvider
        return VertexAIProvider(
            project_id=_get_setting(db, "ai.vertex.project_id", os.getenv("VERTEX_PROJECT_ID", "")),
            location=_get_setting(db, "ai.vertex.location", os.getenv("VERTEX_LOCATION", "us-central1")),
            credentials_path=_get_setting(db, "ai.vertex.credentials_path",
                                          os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")),
        )
    elif provider == "gemini":
        from ai.gemini import GeminiProvider
        return GeminiProvider(
            api_key=_get_setting(db, "ai.gemini.api_key", os.getenv("GEMINI_API_KEY", "")),
        )
    elif provider == "openai":
        from ai.vertex import VertexAIProvider  # placeholder until OpenAI implemented
        raise NotImplementedError("OpenAI provider not yet implemented")
    elif provider == "anthropic":
        raise NotImplementedError("Anthropic provider not yet implemented")
    else:
        raise ValueError(f"Unknown AI provider: {provider!r}")
