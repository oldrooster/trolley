"""
Google Gemini provider using the google-generativeai SDK with an API key.
Simpler alternative to Vertex AI — get a key at https://aistudio.google.com/

Required: GEMINI_API_KEY
"""
import json
from functools import cached_property

from ai.base import AIProvider, RecipeData, ReceiptData
from ai import prompts
from ai.vertex import _recipe_data_from_dict  # shared helpers


class GeminiProvider:
    """Google Gemini via API key (Google AI Studio)."""

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        self.api_key = api_key
        self.model_name = model

    @cached_property
    def _model(self):
        import google.generativeai as genai
        genai.configure(api_key=self.api_key)
        return genai.GenerativeModel(self.model_name)

    def _generate_json(self, parts: list) -> dict:
        import google.generativeai as genai
        response = self._model.generate_content(
            parts,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        return json.loads(response.text)

    def chat(self, prompt: str, context: str = "") -> str:
        full = f"{context}\n\n{prompt}" if context else prompt
        return self._model.generate_content(full).text

    def extract_receipt(self, file_bytes: bytes, mime_type: str) -> ReceiptData:
        import google.generativeai as genai
        blob = genai.protos.Blob(data=file_bytes, mime_type=mime_type)
        data = self._generate_json([
            {"inline_data": blob},
            prompts.RECEIPT_EXTRACT,
            "Extract all receipt data from this image/document.",
        ])
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

        data = self._generate_json([
            prompts.RECIPE_FROM_URL,
            f"Extract the recipe from this webpage content:\n\n{text}",
        ])
        return _recipe_data_from_dict(data, source_url=url)

    def generate_recipe(self, description: str) -> RecipeData:
        data = self._generate_json([
            prompts.RECIPE_GENERATE,
            f"Generate a recipe for: {description}",
        ])
        return _recipe_data_from_dict(data)

    def suggest_unit_conversions(self, ingredients: list[dict]) -> list[dict]:
        import json as _json
        data = self._generate_json([
            prompts.UNIT_CONVERSION,
            _json.dumps(ingredients),
        ])
        return data if isinstance(data, list) else []

    def generate_image(self, prompt: str) -> bytes:
        # google-generativeai doesn't support Imagen; fall back to Vertex SDK
        raise NotImplementedError(
            "Image generation requires Vertex AI provider. "
            "Switch to Vertex AI in Settings to enable recipe image generation."
        )
