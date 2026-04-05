from datetime import datetime, date
from typing import Optional
from sqlalchemy import (
    Integer, String, Text, Float, Boolean, DateTime, Date,
    ForeignKey, JSON, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    icon: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    products: Mapped[list["Product"]] = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("categories.id"), nullable=True)
    base_name: Mapped[str] = mapped_column(String, nullable=False)
    variant_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    brand_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    unit: Mapped[str] = mapped_column(String, default="each")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    category: Mapped[Optional["Category"]] = relationship("Category", back_populates="products")
    shopping_list_items: Mapped[list["ShoppingListItem"]] = relationship("ShoppingListItem", back_populates="product")
    recipe_ingredients: Mapped[list["RecipeIngredient"]] = relationship("RecipeIngredient", back_populates="product")
    receipt_items: Mapped[list["ReceiptItem"]] = relationship("ReceiptItem", back_populates="product")

    @property
    def display_name(self) -> str:
        if self.brand_name:
            return self.brand_name
        if self.variant_name:
            return f"{self.variant_name} {self.base_name}"
        return self.base_name


class ShoppingList(Base):
    __tablename__ = "shopping_lists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    items: Mapped[list["ShoppingListItem"]] = relationship(
        "ShoppingListItem", back_populates="list", cascade="all, delete-orphan"
    )


class ShoppingListItem(Base):
    __tablename__ = "shopping_list_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    list_id: Mapped[int] = mapped_column(Integer, ForeignKey("shopping_lists.id"), nullable=False)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    custom_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    checked: Mapped[bool] = mapped_column(Boolean, default=False)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    list: Mapped["ShoppingList"] = relationship("ShoppingList", back_populates="items")
    product: Mapped[Optional["Product"]] = relationship("Product", back_populates="shopping_list_items")


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    method: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    servings: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    prep_time_mins: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cook_time_mins: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    difficulty: Mapped[Optional[str]] = mapped_column(String, nullable=True)   # everyone / kid_friendly / teen / adult
    nutrition: Mapped[Optional[str]] = mapped_column(String, nullable=True)    # very_healthy / healthy / moderate / indulgent
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        "RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan"
    )


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recipe_id: Mapped[int] = mapped_column(Integer, ForeignKey("recipes.id"), nullable=False)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    ingredient_name: Mapped[str] = mapped_column(String, nullable=False)
    quantity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    recipe: Mapped["Recipe"] = relationship("Recipe", back_populates="ingredients")
    product: Mapped[Optional["Product"]] = relationship("Product", back_populates="recipe_ingredients")


class WeeklyPlan(Base):
    __tablename__ = "weekly_plans"
    __table_args__ = (UniqueConstraint("week_start"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    week_start: Mapped[date] = mapped_column(Date, nullable=False)  # Always a Monday
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    meals: Mapped[list["WeeklyPlanMeal"]] = relationship(
        "WeeklyPlanMeal", back_populates="plan", cascade="all, delete-orphan"
    )


class WeeklyPlanMeal(Base):
    __tablename__ = "weekly_plan_meals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("weekly_plans.id"), nullable=False)
    meal_type: Mapped[str] = mapped_column(String, nullable=False)  # breakfast/lunch/dinner/snack
    recipe_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("recipes.id"), nullable=True)
    custom_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    day_hint: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # mon/tue/wed/thu/fri/sat/sun
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assigned_member_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # [1, 2, 3]

    plan: Mapped["WeeklyPlan"] = relationship("WeeklyPlan", back_populates="meals")
    recipe: Mapped[Optional["Recipe"]] = relationship("Recipe")


class Receipt(Base):
    __tablename__ = "receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    store_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    purchase_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    total_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    raw_extraction: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    items: Mapped[list["ReceiptItem"]] = relationship(
        "ReceiptItem", back_populates="receipt", cascade="all, delete-orphan"
    )


class ReceiptItem(Base):
    __tablename__ = "receipt_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    receipt_id: Mapped[int] = mapped_column(Integer, ForeignKey("receipts.id"), nullable=False)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    raw_name: Mapped[str] = mapped_column(String, nullable=False)
    quantity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unit_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    total_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    receipt: Mapped["Receipt"] = relationship("Receipt", back_populates="items")
    product: Mapped[Optional["Product"]] = relationship("Product", back_populates="receipt_items")


class AppSetting(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class FamilyMember(Base):
    __tablename__ = "family_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    age_group: Mapped[str] = mapped_column(String, nullable=False)  # kid / teen / adult
    emoji: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
