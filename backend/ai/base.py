from typing import Protocol, runtime_checkable
from dataclasses import dataclass, field


@dataclass
class RecipeData:
    name: str
    description: str = ""
    method: str = ""
    servings: int | None = None
    prep_time_mins: int | None = None
    cook_time_mins: int | None = None
    source_url: str | None = None
    ingredients: list[dict] = field(default_factory=list)
    # Each ingredient: {"name": str, "quantity": float|None, "unit": str|None, "notes": str|None}


@dataclass
class ReceiptData:
    store_name: str | None = None
    purchase_date: str | None = None  # ISO date string
    total_amount: float | None = None
    items: list[dict] = field(default_factory=list)
    # Each item: {"raw_name": str, "quantity": float|None, "unit_price": float|None, "total_price": float|None}


@runtime_checkable
class AIProvider(Protocol):
    def chat(self, prompt: str, context: str = "") -> str:
        """General text generation."""
        ...

    def extract_receipt(self, file_bytes: bytes, mime_type: str) -> ReceiptData:
        """Extract structured data from a receipt image or PDF."""
        ...

    def parse_recipe_from_url(self, url: str) -> RecipeData:
        """Fetch and parse a recipe from a URL."""
        ...

    def generate_recipe(self, description: str) -> RecipeData:
        """Generate a recipe from a natural language description."""
        ...

    def generate_image(self, prompt: str) -> bytes:
        """Generate an image from a prompt, returns raw image bytes (PNG)."""
        ...
