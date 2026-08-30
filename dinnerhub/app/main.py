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

APP_VERSION = os.getenv("DINNERHUB_VERSION", "0.14.1")
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
    result: str = "success",
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
            result=result,
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
        "ingredients": [
            {
                "id": link.id,
                "name": link.ingredient.name,
                "quantity": link.quantity,
                "unit": link.unit,
                "shopping_category": link.ingredient.shopping_category,
                "notes": link.notes,
                "optional": link.optional,
            }
            for link in meal.ingredients
        ],
        "active": meal.active,
    }


def upsert_ingredients(db: Session, meal: Meal, supplied: list[dict]) -> None:
    meal.ingredients.clear()
    for index, item in enumerate(supplied):
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        ingredient = db.scalar(select(Ingredient).where(func.lower(Ingredient.name) == name.lower()))
        if ingredient is None:
            ingredient = Ingredient(
                name=name,
                shopping_category=item.get("shopping_category") or "Other",
                default_unit=item.get("unit"),
            )
            db.add(ingredient)
            db.flush()
        meal.ingredients.append(
            RecipeIngredient(
                ingredient=ingredient,
                quantity=item.get("quantity"),
                unit=item.get("unit"),
                notes=item.get("notes"),
                optional=bool(item.get("optional", False)),
                sort_order=index,
            )
        )


def plan_to_dict(entry: MealPlanEntry) -> dict:
    return {
        "id": entry.id,
        "meal_date": entry.meal_date,
        "meal_id": entry.meal_id,
        "title": entry.meal.name if entry.meal else (entry.custom_title or "No meal selected"),
        "entry_type": entry.entry_type,
        "status": entry.status,
        "servings": entry.servings,
        "selected_by_id": entry.selected_by_id,
        "selected_by_name": entry.selected_by_name,
        "locked": entry.locked,
        "notes": entry.notes,
        "meal": meal_to_dict(entry.meal) if entry.meal else None,
    }


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "version": APP_VERSION, "database": str(DATABASE_PATH)}


@app.get("/api/ready")
def ready() -> dict:
    return {"status": "ready", "version": APP_VERSION, "database": DATABASE_PATH.exists()}


@app.get("/api/version")
def version() -> dict:
    return {"version": APP_VERSION}


@app.get("/api/dashboard", response_model=DashboardOutput)
def dashboard(db: DbSession, days: int = Query(default=7, ge=1, le=31)) -> dict:
    today = date.today()
    entries = db.scalars(
        select(MealPlanEntry)
        .options(selectinload(MealPlanEntry.meal).selectinload(Meal.ingredients).selectinload(RecipeIngredient.ingredient))
        .where(MealPlanEntry.meal_date.between(today, today + timedelta(days=days - 1)))
        .order_by(MealPlanEntry.meal_date)
    ).all()
    by_date = {entry.meal_date: entry for entry in entries}
    upcoming = [by_date.get(today + timedelta(days=offset)) for offset in range(days)]
    return {
        "version": APP_VERSION,
        "today": plan_to_dict(by_date[today]) if today in by_date else None,
        "tomorrow": plan_to_dict(by_date[today + timedelta(days=1)]) if today + timedelta(days=1) in by_date else None,
        "upcoming": [plan_to_dict(entry) for entry in upcoming if entry is not None],
        "unplanned_days": sum(1 for entry in upcoming if entry is None or entry.meal_id is None),
        "active_meals": db.scalar(select(func.count(Meal.id)).where(Meal.active.is_(True))) or 0,
    }


@app.get("/api/meals", response_model=list[MealOutput])
def list_meals(db: DbSession, include_archived: bool = False, search: str | None = None) -> list[dict]:
    query = meal_query()
    if not include_archived:
        query = query.where(Meal.active.is_(True))
    if search:
        term = f"%{search.strip()}%"
        query = query.where(or_(Meal.name.ilike(term), Meal.description.ilike(term), Meal.category.ilike(term)))
    meals = db.scalars(query.order_by(Meal.name)).unique().all()
    return [meal_to_dict(meal) for meal in meals]


@app.post("/api/meals", response_model=MealOutput, status_code=status.HTTP_201_CREATED)
def create_meal(
    payload: MealCreate,
    db: DbSession,
    x_dinnerhub_user_id: str | None = Header(default=None),
    x_dinnerhub_user_name: str | None = Header(default=None),
    x_dinnerhub_display_name: str | None = Header(default=None),
) -> dict:
    values = payload.model_dump(exclude={"ingredients"})
    meal = Meal(**values)
    db.add(meal)
    try:
        db.flush()
        upsert_ingredients(db, meal, [item.model_dump() for item in payload.ingredients])
        actor_id, actor_name = actor(x_dinnerhub_user_id, x_dinnerhub_user_name, x_dinnerhub_display_name)
        record_audit(db, actor_id=actor_id, actor_name=actor_name, action="meal.create", entity_type="meal", entity_id=meal.id, new_value=values)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A meal with that name already exists") from exc
    db.refresh(meal)
    return meal_to_dict(db.scalar(meal_query().where(Meal.id == meal.id)))


@app.get("/api/meals/{meal_id}", response_model=MealOutput)
def get_meal(meal_id: int, db: DbSession) -> dict:
    meal = db.scalar(meal_query().where(Meal.id == meal_id))
    if meal is None:
        raise HTTPException(status_code=404, detail="Meal not found")
    return meal_to_dict(meal)


@app.put("/api/meals/{meal_id}", response_model=MealOutput)
def update_meal(
    meal_id: int,
    payload: MealUpdate,
    db: DbSession,
    x_dinnerhub_user_id: str | None = Header(default=None),
    x_dinnerhub_user_name: str | None = Header(default=None),
    x_dinnerhub_display_name: str | None = Header(default=None),
) -> dict:
    meal = db.scalar(meal_query().where(Meal.id == meal_id))
    if meal is None:
        raise HTTPException(status_code=404, detail="Meal not found")
    previous = meal_to_dict(meal)
    changes = payload.model_dump(exclude_unset=True)
    supplied_ingredients = changes.pop("ingredients", None)
    for key, value in changes.items():
        setattr(meal, key, value)
    if supplied_ingredients is not None:
        upsert_ingredients(db, meal, supplied_ingredients)
    actor_id, actor_name = actor(x_dinnerhub_user_id, x_dinnerhub_user_name, x_dinnerhub_display_name)
    record_audit(db, actor_id=actor_id, actor_name=actor_name, action="meal.update", entity_type="meal", entity_id=meal.id, previous_value=previous, new_value=changes)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A meal with that name already exists") from exc
    return meal_to_dict(db.scalar(meal_query().where(Meal.id == meal.id)))


@app.delete("/api/meals/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_meal(
    meal_id: int,
    db: DbSession,
    x_dinnerhub_user_id: str | None = Header(default=None),
    x_dinnerhub_user_name: str | None = Header(default=None),
    x_dinnerhub_display_name: str | None = Header(default=None),
) -> Response:
    meal = db.get(Meal, meal_id)
    if meal is None:
        raise HTTPException(status_code=404, detail="Meal not found")
    meal.active = False
    actor_id, actor_name = actor(x_dinnerhub_user_id, x_dinnerhub_user_name, x_dinnerhub_display_name)
    record_audit(db, actor_id=actor_id, actor_name=actor_name, action="meal.archive", entity_type="meal", entity_id=meal.id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/meal-plan", response_model=list[PlanEntryOutput])
def list_plan(db: DbSession, start: date = Query(default_factory=date.today), days: int = Query(default=14, ge=1, le=60)) -> list[dict]:
    entries = db.scalars(
        select(MealPlanEntry)
        .options(selectinload(MealPlanEntry.meal).selectinload(Meal.ingredients).selectinload(RecipeIngredient.ingredient))
        .where(MealPlanEntry.meal_date.between(start, start + timedelta(days=days - 1)))
        .order_by(MealPlanEntry.meal_date)
    ).unique().all()
    return [plan_to_dict(entry) for entry in entries]


@app.put("/api/meal-plan/{meal_date}", response_model=PlanEntryOutput)
def put_plan_entry(
    meal_date: date,
    payload: PlanEntryInput,
    db: DbSession,
    x_dinnerhub_user_id: str | None = Header(default=None),
    x_dinnerhub_user_name: str | None = Header(default=None),
    x_dinnerhub_display_name: str | None = Header(default=None),
) -> dict:
    entry = db.scalar(select(MealPlanEntry).where(MealPlanEntry.meal_date == meal_date))
    previous = plan_to_dict(entry) if entry else None
    if entry is None:
        entry = MealPlanEntry(meal_date=meal_date)
        db.add(entry)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    actor_id, actor_name = actor(x_dinnerhub_user_id, x_dinnerhub_user_name, x_dinnerhub_display_name)
    record_audit(db, actor_id=actor_id, actor_name=actor_name, action="plan.update", entity_type="meal_plan_entry", entity_id=meal_date.isoformat(), previous_value=previous, new_value=payload.model_dump(exclude_unset=True))
    db.commit()
    entry = db.scalar(
        select(MealPlanEntry)
        .options(selectinload(MealPlanEntry.meal).selectinload(Meal.ingredients).selectinload(RecipeIngredient.ingredient))
        .where(MealPlanEntry.meal_date == meal_date)
    )
    return plan_to_dict(entry)


@app.delete("/api/meal-plan/{meal_date}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan_entry(meal_date: date, db: DbSession) -> Response:
    entry = db.scalar(select(MealPlanEntry).where(MealPlanEntry.meal_date == meal_date))
    if entry is None:
        raise HTTPException(status_code=404, detail="Meal plan entry not found")
    db.delete(entry)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/{path:path}")
def frontend(path: str) -> FileResponse:
    candidate = STATIC_DIR / path
    if path and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(STATIC_DIR / "index.html")
