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

APP_VERSION = os.getenv("DINNERHUB_VERSION", "0.15.1")
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


@app.get("/api/meals", response_model=list[MealOutput])
def list_meals(
    db: DbSession,
    search: str | None = Query(default=None, max_length=180),
    protein: str | None = Query(default=None, max_length=80),
    category: str | None = Query(default=None, max_length=80),
    active: bool | None = True,
    favourite: bool | None = None,
) -> list[dict]:
    statement = meal_query()
    if active is not None:
        statement = statement.where(Meal.active == active)
    if protein:
        statement = statement.where(func.lower(Meal.main_protein) == protein.lower())
    if category:
        statement = statement.where(func.lower(Meal.category) == category.lower())
    if favourite is not None:
        statement = statement.where(Meal.favourite == favourite)
    if search:
        pattern = f"%{search.lower()}%"
        ingredient_ids = select(RecipeIngredient.meal_id).join(Ingredient).where(func.lower(Ingredient.name).like(pattern))
        statement = statement.where(
            or_(
                func.lower(Meal.name).like(pattern),
                func.lower(func.coalesce(Meal.description, "")).like(pattern),
                func.lower(func.coalesce(Meal.main_protein, "")).like(pattern),
                func.lower(func.coalesce(Meal.category, "")).like(pattern),
                Meal.id.in_(ingredient_ids),
            )
        )
    meals = db.scalars(statement.order_by(Meal.name)).unique().all()
    return [meal_to_dict(meal) for meal in meals]


@app.post("/api/meals", response_model=MealOutput, status_code=status.HTTP_201_CREATED)
def create_meal(
    payload: MealCreate,
    db: DbSession,
    x_remote_user_id: str | None = Header(default=None),
    x_remote_user_name: str | None = Header(default=None),
    x_remote_user_display_name: str | None = Header(default=None),
) -> dict:
    actor_id, actor_name = actor(x_remote_user_id, x_remote_user_name, x_remote_user_display_name)
    values = payload.model_dump(exclude={"ingredients", "image_url", "source_url"})
    meal = Meal(
        **values,
        image_url=str(payload.image_url) if payload.image_url else None,
        source_url=str(payload.source_url) if payload.source_url else None,
    )
    db.add(meal)
    replace_ingredients(db, meal, payload.ingredients)
    try:
        db.flush()
        record_audit(
            db,
            actor_id=actor_id,
            actor_name=actor_name,
            action="recipe_created",
            entity_type="meal",
            entity_id=meal.id,
            new_value={"name": meal.name},
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A meal with this name already exists") from exc
    return meal_to_dict(get_meal_or_404(db, meal.id))


@app.get("/api/meals/{meal_id}", response_model=MealOutput)
def get_meal(meal_id: int, db: DbSession) -> dict:
    return meal_to_dict(get_meal_or_404(db, meal_id))


@app.put("/api/meals/{meal_id}", response_model=MealOutput)
def update_meal(
    meal_id: int,
    payload: MealUpdate,
    db: DbSession,
    x_remote_user_id: str | None = Header(default=None),
    x_remote_user_name: str | None = Header(default=None),
    x_remote_user_display_name: str | None = Header(default=None),
) -> dict:
    actor_id, actor_name = actor(x_remote_user_id, x_remote_user_name, x_remote_user_display_name)
    meal = get_meal_or_404(db, meal_id)
    previous = {"name": meal.name, "active": meal.active}
    for field, value in payload.model_dump(exclude={"ingredients", "image_url", "source_url"}).items():
        setattr(meal, field, value)
    meal.image_url = str(payload.image_url) if payload.image_url else None
    meal.source_url = str(payload.source_url) if payload.source_url else None
    replace_ingredients(db, meal, payload.ingredients)
    record_audit(
        db,
        actor_id=actor_id,
        actor_name=actor_name,
        action="recipe_edited",
        entity_type="meal",
        entity_id=meal.id,
        previous_value=previous,
        new_value={"name": meal.name, "active": meal.active},
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A meal with this name already exists") from exc
    return meal_to_dict(get_meal_or_404(db, meal.id))


@app.delete("/api/meals/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_meal(
    meal_id: int,
    db: DbSession,
    x_remote_user_id: str | None = Header(default=None),
    x_remote_user_name: str | None = Header(default=None),
    x_remote_user_display_name: str | None = Header(default=None),
) -> Response:
    actor_id, actor_name = actor(x_remote_user_id, x_remote_user_name, x_remote_user_display_name)
    meal = get_meal_or_404(db, meal_id)
    meal.active = False
    record_audit(
        db,
        actor_id=actor_id,
        actor_name=actor_name,
        action="recipe_archived",
        entity_type="meal",
        entity_id=meal.id,
        previous_value={"active": True},
        new_value={"active": False},
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/meals/{meal_id}/restore", response_model=MealOutput)
def restore_meal(meal_id: int, db: DbSession) -> dict:
    meal = get_meal_or_404(db, meal_id)
    meal.active = True
    db.add(
        AuditEvent(
            actor_id="system",
            actor_name="FoodHub",
            action="recipe_restored",
            entity_type="meal",
            entity_id=str(meal.id),
        )
    )
    db.commit()
    return meal_to_dict(get_meal_or_404(db, meal.id))


@app.get("/api/meal-plan", response_model=list[PlanEntryOutput])
def get_meal_plan(
    db: DbSession,
    start: date | None = Query(default=None),
    days: int = Query(default=7, ge=1, le=31),
) -> list[dict]:
    first_day = start or date.today()
    last_day = first_day + timedelta(days=days - 1)
    entries = db.scalars(
        select(MealPlanEntry)
        .options(selectinload(MealPlanEntry.meal).selectinload(Meal.ingredients).selectinload(RecipeIngredient.ingredient))
        .where(MealPlanEntry.meal_date >= first_day, MealPlanEntry.meal_date <= last_day)
        .order_by(MealPlanEntry.meal_date)
    ).unique().all()
    return [plan_to_dict(entry) for entry in entries]


@app.put("/api/meal-plan/{meal_date}", response_model=PlanEntryOutput)
def set_meal_plan_entry(
    meal_date: date,
    payload: PlanEntryInput,
    db: DbSession,
    x_remote_user_id: str | None = Header(default=None),
    x_remote_user_name: str | None = Header(default=None),
    x_remote_user_display_name: str | None = Header(default=None),
) -> dict:
    actor_id, actor_name = actor(x_remote_user_id, x_remote_user_name, x_remote_user_display_name)
    existing = db.scalar(select(MealPlanEntry).where(MealPlanEntry.meal_date == meal_date))
    previous = plan_to_dict(existing) if existing else None
    if payload.entry_type == "meal" and payload.meal_id is None:
        raise HTTPException(status_code=422, detail="meal_id is required for meal entries")
    if payload.entry_type != "meal" and payload.meal_id is not None:
        raise HTTPException(status_code=422, detail="meal_id is only valid for meal entries")
    meal = get_meal_or_404(db, payload.meal_id) if payload.meal_id is not None else None
    if not existing:
        existing = MealPlanEntry(meal_date=meal_date)
        db.add(existing)
    existing.meal = meal
    existing.entry_type = payload.entry_type
    existing.status = payload.status
    existing.servings = payload.servings or (meal.servings if meal else None)
    existing.selected_by_id = actor_id
    existing.selected_by_name = actor_name
    existing.locked = payload.locked
    existing.notes = payload.notes
    if payload.entry_type == "meal":
        existing.custom_title = None
    else:
        existing.custom_title = {
            "takeaway": "Takeaway",
            "leftovers": "Leftovers",
            "eating_out": "Eating out",
            "no_meal": "No meal required",
        }.get(payload.entry_type)
    record_audit(
        db,
        actor_id=actor_id,
        actor_name=actor_name,
        action="meal_plan_changed",
        entity_type="meal_plan",
        entity_id=meal_date.isoformat(),
        previous_value=previous,
        new_value={"date": meal_date.isoformat(), "meal_id": payload.meal_id, "entry_type": payload.entry_type},
    )
    db.commit()
    refreshed = db.scalar(
        select(MealPlanEntry)
        .options(selectinload(MealPlanEntry.meal).selectinload(Meal.ingredients).selectinload(RecipeIngredient.ingredient))
        .where(MealPlanEntry.meal_date == meal_date)
    )
    return plan_to_dict(refreshed)


@app.delete("/api/meal-plan/{meal_date}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal_plan_entry(meal_date: date, db: DbSession) -> Response:
    existing = db.scalar(select(MealPlanEntry).where(MealPlanEntry.meal_date == meal_date))
    if not existing:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    db.delete(existing)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/dashboard", response_model=DashboardOutput)
def dashboard(db: DbSession, days: int = Query(default=7, ge=1, le=31)) -> dict:
    today = date.today()
    entries = db.scalars(
        select(MealPlanEntry)
        .options(selectinload(MealPlanEntry.meal).selectinload(Meal.ingredients).selectinload(RecipeIngredient.ingredient))
        .where(MealPlanEntry.meal_date >= today, MealPlanEntry.meal_date < today + timedelta(days=days))
        .order_by(MealPlanEntry.meal_date)
    ).unique().all()
    by_date = {entry.meal_date: entry for entry in entries}
    return {
        "version": APP_VERSION,
        "today": plan_to_dict(by_date[today]) if today in by_date else None,
        "tomorrow": plan_to_dict(by_date[today + timedelta(days=1)]) if today + timedelta(days=1) in by_date else None,
        "upcoming": [plan_to_dict(entry) for entry in entries],
        "unplanned_days": sum(1 for offset in range(days) if today + timedelta(days=offset) not in by_date),
        "active_meals": db.scalar(select(func.count(Meal.id)).where(Meal.active.is_(True))) or 0,
    }


@app.get("/api/calendar")
def calendar_feed(db: DbSession, days: int = Query(default=30, ge=1, le=90)) -> dict:
    start_day = date.today()
    end_day = start_day + timedelta(days=days)
    entries = db.scalars(
        select(MealPlanEntry)
        .options(selectinload(MealPlanEntry.meal))
        .where(MealPlanEntry.meal_date >= start_day, MealPlanEntry.meal_date < end_day)
        .order_by(MealPlanEntry.meal_date)
    ).all()
    return {
        "events": [
            {
                "uid": f"dinnerhub-{entry.meal_date.isoformat()}",
                "summary": entry.meal.name if entry.meal else entry.custom_title,
                "date": entry.meal_date,
                "description": entry.notes or "FoodHub meal plan",
            }
            for entry in entries
        ]
    }


@app.get("/api/home-assistant/states")
def home_assistant_states(db: DbSession) -> dict:
    today = date.today()
    entries = db.scalars(
        select(MealPlanEntry)
        .options(selectinload(MealPlanEntry.meal))
        .where(MealPlanEntry.meal_date >= today, MealPlanEntry.meal_date <= today + timedelta(days=1))
    ).all()
    by_date = {entry.meal_date: entry for entry in entries}

    def title(day: date) -> str:
        entry = by_date.get(day)
        return entry.meal.name if entry and entry.meal else entry.custom_title if entry else "Unplanned"

    return {
        "sensor.dinnerhub_tonight": {"state": title(today), "attributes": {"friendly_name": "FoodHub Tonight"}},
        "sensor.dinnerhub_tomorrow": {
            "state": title(today + timedelta(days=1)),
            "attributes": {"friendly_name": "FoodHub Tomorrow"},
        },
    }


@app.get("/api/audit")
def audit_log(db: DbSession, limit: int = Query(default=100, ge=1, le=500)) -> list[dict]:
    rows = db.scalars(select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit)).all()
    return [
        {
            "id": row.id,
            "actor_id": row.actor_id,
            "actor_name": row.actor_name,
            "action": row.action,
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
            "previous_value": row.previous_value,
            "new_value": row.new_value,
            "source": row.source,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@app.get("/{path:path}")
def frontend(path: str):  # type: ignore[no-untyped-def]
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    candidate = STATIC_DIR / path
    if path and candidate.exists() and candidate.is_file():
        return FileResponse(candidate)
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "FoodHub frontend has not been built yet"}
