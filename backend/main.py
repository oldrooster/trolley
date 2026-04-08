import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from database import engine, SessionLocal
import models
from fts import setup_fts, rebuild_fts
from seed import run_seed
from routers import health, catalogue, shopping_list, meal_planner, recipes, receipts, settings_router, insights, family


def _migrate(db):
    """Add columns that didn't exist in earlier schema versions."""
    migrations = [
        ("recipes",           "difficulty",           "TEXT"),
        ("recipes",           "nutrition",            "TEXT"),
        ("recipes",           "is_quick",             "INTEGER NOT NULL DEFAULT 0"),
        ("recipes",           "meal_type",            "TEXT"),
        ("shopping_list_items", "source_meals",        "TEXT"),
        ("shopping_list_items", "source_meal_ids",    "TEXT"),
        ("weekly_plan_meals", "assigned_member_ids",  "TEXT"),
        ("weekly_plan_meals", "cook_member_id",       "INTEGER"),
        ("family_members",    "photo_path",            "TEXT"),
    ]
    for table, col, col_def in migrations:
        try:
            db.execute(
                __import__("sqlalchemy").text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")
            )
            db.commit()
        except Exception:
            db.rollback()  # column already exists — safe to ignore

    # Rename brand_name → full_name
    try:
        import sqlalchemy as sa
        db.execute(sa.text("ALTER TABLE products RENAME COLUMN brand_name TO full_name"))
        db.commit()
    except Exception:
        db.rollback()  # already renamed — safe to ignore


@asynccontextmanager
async def lifespan(app: FastAPI):
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _migrate(db)
        setup_fts(db)
        seeded = db.query(models.Product).count() == 0
        run_seed(db)
        if seeded:
            rebuild_fts(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Trolley", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(catalogue.router, prefix="/api")
app.include_router(shopping_list.router, prefix="/api")
app.include_router(meal_planner.router, prefix="/api")
app.include_router(recipes.router, prefix="/api")
app.include_router(receipts.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(insights.router, prefix="/api")
app.include_router(family.router, prefix="/api")

# Serve React frontend in production
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    # SPA fallback: any non-API path that doesn't match a static file serves index.html
    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))

    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
