from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from datetime import date, timedelta
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .database import DATABASE_PATH, get_db, initialise_database
from .models import AuditEvent, Ingredient, Meal, MealPlanEntry, RecipeIngredient
from .schemas import DashboardOutput, MealCreate, MealOutput, MealUpdate, PlanEntryInput, PlanEntryOutput

APP_VERSION = os.getenv("DINNERHUB_VERSION", "0.14.0")
STATIC_DIR = Path(os.getenv("DINNERHUB_STATIC_DIR", "/app/static"))
OPTIONS_FILE = Path("/data/options.json")
DbSession = Annotated[Session, Depends(get_db)]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialise_database()
    yield


app = FastAPI(
    title="FoodHub API",
    description="Local household food, recipe, dinner planning and shopping-list management for Home Assistant.",
    version=APP_VERSION,
    lifespan=lifespan,
)

if (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")


@app.middleware("http")
async def restrict_direct_access(request: Request, call_next):  # type: ignore[no-untyped-def]
    enforce = os.getenv("DINNERHUB_ENFORCE_INGRESS", "false").lower() == "true"
    allowed = {"172.30.32.2", "127.0.0.1", "::1", "testclient"}
    client_host = request.client.host if request.client else "unknown"
    if enforce and client_host not in allowed:
        return Response(status_code=403, content="FoodHub is available through Home Assistant Ingress only")
    return await call_next(request)


def actor(user_id: str | None, user_name: str | None, display_name: str | None) -> tuple[str, str]:
    return user_id or "local-development-user", display_name or user_name or "Local Development User"


def record_audit(
    db: Session,
    *,
    actor_id: str,
    actor_name: str,
    action: str,
    entity_type: str,
    entity_id: int | str | None,
    previous_value: dict | None = None,
    new_value: dict | None = None,
    source: str = "web",
) -> None:
    db.add(
        AuditEvent(
            actor_id=actor_id,
            actor_name=actor_name,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            previous_value=previous_value,
            new_value=new_value,
            source=source,
        )
    )


def load_options() -> dict:
    defaults = {
        "planning": {"default_days": 7, "repeat_warning_days": 14},
        "household": {"default_servings": 4},
        "features": {"shopping_list": False, "meal_suggestions": False},
    }
    if not OPTIONS_FILE.exists():
        return defaults
    try:
        supplied = json.loads(OPTIONS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return defaults
    for section, values in defaults.items():
        supplied.setdefault(section, values)
        for key, value in values.items():
            supplied[section].setdefault(key, value)
    return supplied


def meal_query():
    return select(Meal).options(selectinload(Meal.ingredients).selectinload(RecipeIngredient.ingredient))


def meal_to_dict(meal: Meal) -> dict:
    return {
        "id": meal.id,
        "name": meal.name,
        "description": meal.description,
        "main_protein": meal.main_protein,
        "category": meal.category,
        "cuisine": meal.cuisine,
        "prep_minutes": meal.prep_minutes,
        "cook_minutes": meal.cook_minutes,
        "total_minutes": meal.prep_minutes + meal.cook_minutes,
        "servings": meal.servings,
        "difficulty": meal.difficulty,
        "instructions": meal.instructions or [],
        "dietary_tags": meal.dietary_tags or [],
        "allergens": meal.allergens or [],
        "substitutions": meal.substitutions or [],
        "notes": meal.notes,
        "image_url": meal.image_url,
        "source_url": meal.source_url,
        "favourite": meal.favourite,
        "household_rating": meal.household_rating,
        "active": meal.active,
        "last_prepared_at": meal.last_prepared_at,
        "selection_count": meal.selection_count,
        "ingredients": [
            {
                "id": link.ingredient.id,
                "name": link.ingredient.name,
                "quantity": link.quantity,
                "unit": link.unit,
                "shopping_category": link.ingredient.shopping_category,
                "notes": link.notes,
                "optional": link.optional,
            }
            for link in meal.ingredients
        ],
        "created_at": meal.created_at,
        "updated_at": meal.updated_at,
    }


def plan_to_dict(entry: MealPlanEntry) -> dict:
    titles = {
        "takeaway": "Takeaway",
        "leftovers": "Leftovers",
        "eating_out": "Eating out",
        "no_meal": "No meal required",
    }
    title = entry.meal.name if entry.meal else entry.custom_title or titles.get(entry.entry_type, "Unplanned")
    return {
        "id": entry.id,
        "meal_date": entry.meal_date,
        "meal_id": entry.meal_id,
        "title": title,
        "entry_type": entry.entry_type,
        "status": entry.status,
        "servings": entry.servings,
        "selected_by_id": entry.selected_by_id,
        "selected_by_name": entry.selected_by_name,
        "locked": entry.locked,
        "notes": entry.notes,
        "meal": meal_to_dict(entry.meal) if entry.meal else None,
        "created_at": entry.created_at,
        "updated_at": entry.updated_at,
    }


def get_meal_or_404(db: Session, meal_id: int) -> Meal:
    meal = db.scalar(meal_query().where(Meal.id == meal_id))
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    return meal


def replace_ingredients(db: Session, meal: Meal, items) -> None:  # type: ignore[no-untyped-def]
    meal.ingredients.clear()
    for position, item in enumerate(items):
        normalised = " ".join(item.name.lower().split())
        ingredient = db.scalar(select(Ingredient).where(func.lower(Ingredient.name) == normalised))
        if not ingredient:
            ingredient = Ingredient(
                name=normalised.title(),
                shopping_category=item.shopping_category or "Other",
                default_unit=item.unit,
            )
            db.add(ingredient)
            db.flush()
        meal.ingredients.append(
            RecipeIngredient(
                ingredient=ingredient,
                quantity=item.quantity,
                unit=item.unit,
                notes=item.notes,
                optional=item.optional,
                sort_order=position,
            )
        )


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "FoodHub",
        "version": APP_VERSION,
        "database": "ready" if DATABASE_PATH.exists() else "initialising",
    }


@app.get("/api/ready")
def readiness(db: DbSession) -> dict:
    db.scalar(select(func.count(Meal.id)))
    return {"status": "ready", "version": APP_VERSION}


@app.get("/api/version")
def version() -> dict:
    return {
        "name": "FoodHub",
        "version": APP_VERSION,
        "slug": "dinnerhub",
        "legacy_name": "DinnerHub",
        "compatibility": "legacy technical identifiers retained",
    }


@app.get("/api/v1/capabilities")
def v1_capabilities() -> dict:
    return {
        "service": "FoodHub",
        "api_version": "v1",
        "application_version": APP_VERSION,
        "technical_slug": "dinnerhub",
        "capabilities": {
            "connectivity": True,
            "scheduled_dinners": True,
            "recipe_catalogue": True,
            "recipe_nutrition": False,
            "shopping_list_handoff": False,
            "events": False,
        },
        "nutrition": {
            "available": False,
            "authoritative": False,
            "reason": "FoodHub does not yet store validated recipe nutrition in the v1 contract.",
        },
    }


@app.get("/api/v1/recipes/{meal_id}/summary")
def v1_recipe_summary(meal_id: int, db: DbSession) -> dict:
    meal = get_meal_or_404(db, meal_id)
    return {
        "id": str(meal.id),
        "name": meal.name,
        "image_ref": meal.image_url,
        "serving_count": meal.servings,
        "active": meal.active,
        "updated_at": meal.updated_at,
        "nutrition": {
            "available": False,
            "authoritative": False,
            "completeness": "unavailable",
            "reason": "Validated recipe nutrition has not been implemented in FoodHub yet.",
        },
    }


@app.get("/api/settings")
def settings() -> dict:
    return load_options()
