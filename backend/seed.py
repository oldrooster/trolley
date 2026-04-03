"""
Seed NZ essential grocery items.
Called once on startup if the products table is empty.
"""
from sqlalchemy.orm import Session
from models import Category, Product


SEED_DATA = {
    "Dairy & Eggs": {
        "icon": "🥛",
        "items": [
            {"base": "Milk", "unit": "each"},
            {"base": "Butter", "unit": "each"},
            {"base": "Cheese", "unit": "each"},
            {"base": "Yoghurt", "unit": "each"},
            {"base": "Cream", "unit": "each"},
            {"base": "Eggs", "unit": "dozen"},
            {"base": "Sour Cream", "unit": "each"},
        ],
    },
    "Bakery": {
        "icon": "🍞",
        "items": [
            {"base": "Bread", "unit": "each"},
            {"base": "Wraps", "unit": "each"},
            {"base": "Pita Bread", "unit": "each"},
            {"base": "Crumpets", "unit": "each"},
            {"base": "Bagels", "unit": "each"},
        ],
    },
    "Produce": {
        "icon": "🥦",
        "items": [
            {"base": "Broccoli", "unit": "each"},
            {"base": "Carrots", "unit": "each"},
            {"base": "Onions", "unit": "each"},
            {"base": "Garlic", "unit": "each"},
            {"base": "Potatoes", "unit": "kg"},
            {"base": "Kumara", "unit": "each"},
            {"base": "Lettuce", "unit": "each"},
            {"base": "Tomatoes", "unit": "each"},
            {"base": "Capsicum", "unit": "each"},
            {"base": "Cucumber", "unit": "each"},
            {"base": "Spinach", "unit": "each"},
            {"base": "Avocado", "unit": "each"},
            {"base": "Lemon", "unit": "each"},
            {"base": "Banana", "unit": "each"},
            {"base": "Apples", "unit": "each"},
            {"base": "Oranges", "unit": "each"},
        ],
    },
    "Meat & Seafood": {
        "icon": "🥩",
        "items": [
            {"base": "Chicken Breast", "unit": "kg"},
            {"base": "Chicken Thighs", "unit": "kg"},
            {"base": "Mince", "unit": "kg"},
            {"base": "Steak", "unit": "each"},
            {"base": "Bacon", "unit": "each"},
            {"base": "Salmon", "unit": "each"},
            {"base": "Sausages", "unit": "each"},
            {"base": "Ham", "unit": "each"},
        ],
    },
    "Pantry": {
        "icon": "🫙",
        "items": [
            {"base": "Rice", "unit": "kg"},
            {"base": "Pasta", "unit": "each"},
            {"base": "Flour", "unit": "kg"},
            {"base": "Sugar", "unit": "kg"},
            {"base": "Salt", "unit": "each"},
            {"base": "Pepper", "unit": "each"},
            {"base": "Olive Oil", "unit": "each"},
            {"base": "Soy Sauce", "unit": "each"},
            {"base": "Tinned Tomatoes", "unit": "each"},
            {"base": "Coconut Milk", "unit": "each"},
            {"base": "Chicken Stock", "unit": "each"},
            {"base": "Pasta Sauce", "unit": "each"},
        ],
    },
    "Breakfast": {
        "icon": "🥣",
        "items": [
            {"base": "Porridge", "unit": "each"},
            {"base": "Weet-Bix", "unit": "each"},
            {"base": "Muesli", "unit": "each"},
            {"base": "Cereal", "unit": "each"},
            {"base": "Peanut Butter", "unit": "each"},
            {"base": "Vegemite", "unit": "each"},
            {"base": "Jam", "unit": "each"},
            {"base": "Honey", "unit": "each"},
            {"base": "Milo", "unit": "each"},
        ],
    },
    "Snacks": {
        "icon": "🍫",
        "items": [
            {"base": "Chips", "unit": "each"},
            {"base": "Crackers", "unit": "each"},
            {"base": "Nuts", "unit": "each"},
            {"base": "Chocolate", "unit": "each"},
            {"base": "Muesli Bars", "unit": "each"},
        ],
    },
    "Drinks": {
        "icon": "🧃",
        "items": [
            {"base": "Orange Juice", "unit": "each"},
            {"base": "Coffee", "unit": "each"},
            {"base": "Tea", "unit": "each"},
            {"base": "Sparkling Water", "unit": "each"},
        ],
    },
    "Frozen": {
        "icon": "🧊",
        "items": [
            {"base": "Frozen Peas", "unit": "each"},
            {"base": "Frozen Corn", "unit": "each"},
            {"base": "Ice Cream", "unit": "each"},
        ],
    },
    "Household": {
        "icon": "🧹",
        "items": [
            {"base": "Dish Soap", "unit": "each"},
            {"base": "Washing Powder", "unit": "each"},
            {"base": "Toilet Paper", "unit": "each"},
            {"base": "Paper Towels", "unit": "each"},
        ],
    },
    "Condiments": {
        "icon": "🧴",
        "items": [
            {"base": "Tomato Sauce", "unit": "each"},
            {"base": "Mayonnaise", "unit": "each"},
            {"base": "Mustard", "unit": "each"},
            {"base": "Sweet Chilli Sauce", "unit": "each"},
            {"base": "Relish", "unit": "each"},
        ],
    },
}


def run_seed(db: Session) -> None:
    if db.query(Product).count() > 0:
        return

    for cat_name, cat_data in SEED_DATA.items():
        category = Category(name=cat_name, icon=cat_data["icon"])
        db.add(category)
        db.flush()

        for item in cat_data["items"]:
            product = Product(
                category_id=category.id,
                base_name=item["base"],
                unit=item["unit"],
            )
            db.add(product)

    db.commit()
    print(f"[seed] Seeded {db.query(Product).count()} products across {db.query(Category).count()} categories.")
