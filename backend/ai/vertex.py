"""
Google Vertex AI provider using the Gemini model family.

Authentication (choose one):
  1. Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON key file path
  2. Mount the key file in Docker and set the env var to its container path
  3. Use Application Default Credentials (gcloud auth application-default login) for local dev

Required env vars:
  VERTEX_PROJECT_ID   — GCP project ID
  VERTEX_LOCATION     — region, e.g. us-central1 (default)
"""
import json
import os
from functools import cached_property

from ai.base import AIProvider, RecipeData, ReceiptData
from ai import prompts


class VertexAIProvider:
    """Vertex AI implementation using Gemini for text/vision and Imagen for image generation."""

    def __init__(self, project_id: str, location: str = "us-central1", credentials_path: str = ""):
        self.project_id = project_id
        self.location = location
        self.credentials_path = credentials_path

    def _init_vertexai(self):
        import vertexai
        kwargs: dict = {"project": self.project_id, "location": self.location}
        if self.credentials_path and os.path.exists(self.credentials_path):
            from google.oauth2 import service_account
            creds = service_account.Credentials.from_service_account_file(self.credentials_path)
            kwargs["credentials"] = creds
        vertexai.init(**kwargs)

    @cached_property
    def _text_model(self):
        self._init_vertexai()
        from vertexai.generative_models import GenerativeModel
        return GenerativeModel("gemini-2.0-flash-001")

    @cached_property
    def _vision_model(self):
        self._init_vertexai()
        from vertexai.generative_models import GenerativeModel
        return GenerativeModel("gemini-2.0-flash-001")

    def _generate_json(self, prompt: str, system: str) -> dict:
        from vertexai.generative_models import GenerationConfig
        response = self._text_model.generate_content(
            [system, prompt],
            generation_config=GenerationConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        return json.loads(response.text)

    def _generate_json_with_file(self, prompt: str, system: str, file_bytes: bytes, mime_type: str) -> dict:
        from vertexai.generative_models import GenerationConfig, Part
        file_part = Part.from_data(data=file_bytes, mime_type=mime_type)
        response = self._vision_model.generate_content(
            [file_part, system, prompt],
            generation_config=GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        return json.loads(response.text)

    def chat(self, prompt: str, context: str = "") -> str:
        full = f"{context}\n\n{prompt}" if context else prompt
        response = self._text_model.generate_content(full)
        return response.text

    def extract_receipt(self, file_bytes: bytes, mime_type: str) -> ReceiptData:
        data = self._generate_json_with_file(
            prompt="Extract all receipt data from this image/document.",
            system=prompts.RECEIPT_EXTRACT,
            file_bytes=file_bytes,
            mime_type=mime_type,
        )
        return ReceiptData(
            store_name=data.get("store_name"),
            purchase_date=data.get("purchase_date"),
            total_amount=data.get("total_amount"),
            items=data.get("items", []),
        )

    def parse_recipe_from_url(self, url: str) -> RecipeData:
        import httpx
        from bs4 import BeautifulSoup

        resp = httpx.get(url, timeout=15, follow_redirects=True,
                         headers={"User-Agent": "Mozilla/5.0 Trolley/1.0"})
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        # Remove script/style noise
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)[:12000]  # ~3k tokens

        data = self._generate_json(
            prompt=f"Extract the recipe from this webpage content:\n\n{text}",
            system=prompts.RECIPE_FROM_URL,
        )
        return _recipe_data_from_dict(data, source_url=url)

    def generate_recipe(self, description: str) -> RecipeData:
        data = self._generate_json(
            prompt=f"Generate a recipe for: {description}",
            system=prompts.RECIPE_GENERATE,
        )
        return _recipe_data_from_dict(data)

    def generate_image(self, prompt: str) -> bytes:
        self._init_vertexai()
        from vertexai.preview.vision_models import ImageGenerationModel
        model = ImageGenerationModel.from_pretrained("imagen-3.0-fast-generate-001")
        images = model.generate_images(prompt=prompt, number_of_images=1)
        return images[0]._image_bytes


# ── Helpers ───────────────────────────────────────────────────────────────────

def _recipe_data_from_dict(data: dict, source_url: str | None = None) -> RecipeData:
    return RecipeData(
        name=data.get("name", "Untitled Recipe"),
        description=data.get("description") or "",
        method=data.get("method") or "",
        servings=_int_or_none(data.get("servings")),
        prep_time_mins=_int_or_none(data.get("prep_time_mins")),
        cook_time_mins=_int_or_none(data.get("cook_time_mins")),
        source_url=source_url,
        ingredients=[
            {
                "ingredient_name": i.get("ingredient_name", ""),
                "quantity": _float_or_none(i.get("quantity")),
                "unit": i.get("unit"),
                "notes": i.get("notes"),
            }
            for i in data.get("ingredients", [])
        ],
    )


def _int_or_none(v) -> int | None:
    try:
        return int(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _float_or_none(v) -> float | None:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None
