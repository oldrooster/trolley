import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine, SessionLocal
import models
from fts import setup_fts, rebuild_fts
from seed import run_seed
from routers import health, catalogue, shopping_list, meal_planner, recipes, receipts, settings_router, insights, family


@asynccontextmanager
async def lifespan(app: FastAPI):
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
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
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
