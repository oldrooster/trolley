"""
Google Vertex AI provider using the google-genai SDK (current, non-deprecated).

Authentication (choose one):
  1. Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON key file path
  2. Mount the key file in Docker and set the env var to its container path
  3. Use Application Default Credentials (gcloud auth application-default login) for local dev

Required env vars:
  VERTEX_PROJECT_ID   — GCP project ID
  VERTEX_LOCATION     — region, e.g. us-central1 or global (default: us-central1)
"""
import json
import os
from functools import cached_property

from ai.base import AIProvider, RecipeData, ReceiptData
from ai import prompts

MODEL = "gemini-2.5-flash"


class VertexAIProvider:
    """Vertex AI implementation using the google-genai SDK with vertexai=True."""

    def __init__(self, project_id: str, location: str = "us-central1", credentials_path: str = ""):
        self.project_id = project_id
        self.location = location
        self.credentials_path = credentials_path

    @cached_property
    def _client(self):
        from google import genai

        # If a credentials file is specified, point ADC at it.
        # genai.Client picks up GOOGLE_APPLICATION_CREDENTIALS automatically.
        if self.credentials_path and os.path.exists(self.credentials_path):
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = self.credentials_path

        return genai.Client(
            vertexai=True,
            project=self.project_id,
            location=self.location,
        )

    def _generate_json(self, prompt: str, system: str) -> dict:
        from google.genai import types
        response = self._client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        return json.loads(response.text)

    def _generate_json_with_file(self, prompt: str, system: str, file_bytes: bytes, mime_type: str) -> dict:
        from google.genai import types
        response = self._client.models.generate_content(
            model=MODEL,
            contents=[
                types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                prompt,
            ],
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        return json.loads(response.text)

    def chat(self, prompt: str, context: str = "") -> str:
        from google.genai import types
        full = f"{context}\n\n{prompt}" if context else prompt
        response = self._client.models.generate_content(
            model=MODEL,
            contents=full,
            config=types.GenerateContentConfig(temperature=0.7),
        )
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
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)[:12000]

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
        response = self._client.models.generate_images(
            model="imagen-3.0-fast-generate-001",
            prompt=prompt,
            config={"number_of_images": 1},
        )
        return response.generated_images[0].image.image_bytes


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
