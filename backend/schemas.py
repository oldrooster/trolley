from pydantic import BaseModel, computed_field


class CategoryOut(BaseModel):
    id: int
    name: str
    icon: str | None = None

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    category_id: int | None = None
    base_name: str
    variant_name: str | None = None
    brand_name: str | None = None
    unit: str = "each"


class ProductUpdate(BaseModel):
    category_id: int | None = None
    base_name: str | None = None
    variant_name: str | None = None
    brand_name: str | None = None
    unit: str | None = None


class ProductOut(BaseModel):
    id: int
    category_id: int | None = None
    category: CategoryOut | None = None
    base_name: str
    variant_name: str | None = None
    brand_name: str | None = None
    unit: str

    @computed_field
    @property
    def display_name(self) -> str:
        if self.brand_name:
            return self.brand_name
        if self.variant_name:
            return f"{self.variant_name} {self.base_name}"
        return self.base_name

    model_config = {"from_attributes": True}
