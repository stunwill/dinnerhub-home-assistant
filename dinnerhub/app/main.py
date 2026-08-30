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

APP_VERSION = os.getenv("DINNERHUB_VERSION", "0.14.2")
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
    start_date = start or date.today()
    end_date = start_date + timedelta(days=days - 1)
    statement = (
        select(MealPlanEntry)
        .options(selectinload(MealPlanEntry.meal).selectinload(Meal.ingredients).selectinload(RecipeIngredient.ingredient))
        .where(MealPlanEntry.meal_date.between(start_date, end_date))
        .order_by(MealPlanEntry.meal_date)
    )
    return [plan_to_dict(entry) for entry in db.scalars(statement).unique().all()]


@app.put("/api/meal-plan/{meal_date}", response_model=PlanEntryOutput)
def upsert_plan_entry(
    meal_date: date,
    payload: PlanEntryInput,
    db: DbSession,
    x_remote_user_id: str | None = Header(default=None),
    x_remote_user_name: str | None = Header(default=None),
    x_remote_user_display_name: str | None = Header(default=None),
) -> dict:
    actor_id, actor_name = actor(x_remote_user_id, x_remote_user_name, x_remote_user_display_name)
    if payload.entry_type == "meal" and payload.meal_id is None:
        raise HTTPException(status_code=422, detail="meal_id is required when entry_type is meal")
    meal = get_meal_or_404(db, payload.meal_id) if payload.meal_id else None
    existing = db.scalar(select(MealPlanEntry).where(MealPlanEntry.meal_date == meal_date))
    previous_meal_id = existing.meal_id if existing else None
    previous = (
        {
            "date": existing.meal_date.isoformat(),
            "meal_id": existing.meal_id,
            "entry_type": existing.entry_type,
            "status": existing.status,
        }
        if existing
        else None
    )
    entry = existing or MealPlanEntry(meal_date=meal_date)
    entry.meal = meal
    entry.entry_type = payload.entry_type
    entry.custom_title = payload.custom_title
    entry.servings = payload.servings or (meal.servings if meal else None)
    entry.selected_by_id = actor_id
    entry.selected_by_name = actor_name
    entry.locked = payload.locked
    entry.notes = payload.notes
    if not existing:
        db.add(entry)
    if meal and previous_meal_id != meal.id:
        meal.selection_count += 1
    db.flush()
    record_audit(
        db,
        actor_id=actor_id,
        actor_name=actor_name,
        action="meal_assigned" if not existing else "meal_replaced",
        entity_type="meal_plan_entry",
        entity_id=entry.id,
        previous_value=previous,
        new_value={"date": meal_date.isoformat(), "meal_id": payload.meal_id, "entry_type": payload.entry_type},
    )
    db.commit()
    refreshed = db.scalar(
        select(MealPlanEntry)
        .options(selectinload(MealPlanEntry.meal).selectinload(Meal.ingredients).selectinload(RecipeIngredient.ingredient))
        .where(MealPlanEntry.id == entry.id)
    )
    if not refreshed:
        raise HTTPException(status_code=500, detail="Meal plan entry could not be reloaded")
    return plan_to_dict(refreshed)


@app.delete("/api/meal-plan/{meal_date}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan_entry(meal_date: date, db: DbSession) -> Response:
    entry = db.scalar(select(MealPlanEntry).where(MealPlanEntry.meal_date == meal_date))
    if not entry:
        raise HTTPException(status_code=404, detail="No planned dinner exists for this date")
    record_audit(
        db,
        actor_id="local-user",
        actor_name="FoodHub user",
        action="meal_removed",
        entity_type="meal_plan_entry",
        entity_id=entry.id,
        previous_value={"date": meal_date.isoformat(), "meal_id": entry.meal_id, "entry_type": entry.entry_type},
    )
    db.delete(entry)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/meal-plan/{meal_date}/complete", response_model=PlanEntryOutput)
def complete_plan_entry(meal_date: date, db: DbSession) -> dict:
    entry = db.scalar(
        select(MealPlanEntry)
        .options(selectinload(MealPlanEntry.meal).selectinload(Meal.ingredients).selectinload(RecipeIngredient.ingredient))
        .where(MealPlanEntry.meal_date == meal_date)
    )
    if not entry:
        raise HTTPException(status_code=404, detail="No planned dinner exists for this date")
    entry.status = "completed"
    if entry.meal:
        entry.meal.last_prepared_at = meal_date
    record_audit(
        db,
        actor_id="local-user",
        actor_name="FoodHub user",
        action="meal_marked_completed",
        entity_type="meal_plan_entry",
        entity_id=entry.id,
        new_value={"status": "completed"},
    )
    db.commit()
    return plan_to_dict(entry)


@app.get("/api/dashboard", response_model=DashboardOutput)
def dashboard(db: DbSession, days: int = Query(default=7, ge=1, le=14)) -> dict:
    today = date.today()
    entries = get_meal_plan(db=db, start=today, days=days)
    by_date = {entry["meal_date"]: entry for entry in entries}
    active_meals = db.scalar(select(func.count(Meal.id)).where(Meal.active.is_(True))) or 0
    return {
        "version": APP_VERSION,
        "today": by_date.get(today),
        "tomorrow": by_date.get(today + timedelta(days=1)),
        "upcoming": entries,
        "unplanned_days": sum(1 for offset in range(days) if today + timedelta(days=offset) not in by_date),
        "active_meals": active_meals,
    }


@app.get("/api/home-assistant/states")
def home_assistant_states(db: DbSession) -> dict:
    today = date.today()
    entries = get_meal_plan(db=db, start=today, days=14)
    by_date = {entry["meal_date"]: entry for entry in entries}

    def sensor_payload(target: date) -> dict:
        entry = by_date.get(target)
        if not entry:
            return {"state": "Unplanned", "attributes": {"date": target.isoformat(), "planned": False}}
        meal = entry.get("meal")
        return {
            "state": entry["title"],
            "attributes": {
                "date": target.isoformat(),
                "planned": True,
                "recipe_id": entry["meal_id"],
                "entry_type": entry["entry_type"],
                "status": entry["status"],
                "selected_by": entry["selected_by_name"],
                "protein": meal["main_protein"] if meal else None,
                "category": meal["category"] if meal else None,
                "preparation_time": meal["prep_minutes"] if meal else None,
                "cooking_time": meal["cook_minutes"] if meal else None,
                "total_time": meal["total_minutes"] if meal else None,
                "servings": entry["servings"],
                "image_url": meal["image_url"] if meal else None,
            },
        }

    next_entry = next((entry for entry in entries if entry["meal_date"] >= today), None)
    return {
        "sensor.dinnerhub_dinner_today": sensor_payload(today),
        "sensor.dinnerhub_dinner_tomorrow": sensor_payload(today + timedelta(days=1)),
        "sensor.dinnerhub_next_planned_dinner": {
            "state": next_entry["title"] if next_entry else "Unplanned",
            "attributes": {"date": next_entry["meal_date"].isoformat() if next_entry else None},
        },
        "sensor.dinnerhub_meal_plan_status": {
            "state": "complete" if len(entries) >= 7 else "incomplete",
            "attributes": {"planned_days": len(entries), "days_checked": 14},
        },
    }


@app.get("/api/calendar")
def calendar_events(
    db: DbSession,
    start: date | None = Query(default=None),
    days: int = Query(default=14, ge=1, le=90),
) -> list[dict]:
    return [
        {
            "summary": entry["title"],
            "start": entry["meal_date"].isoformat(),
            "end": (entry["meal_date"] + timedelta(days=1)).isoformat(),
            "all_day": True,
            "description": f"FoodHub: {entry['entry_type']}",
            "uid": f"dinnerhub-{entry['id']}@home-assistant",
        }
        for entry in get_meal_plan(db=db, start=start or date.today(), days=days)
    ]


@app.get("/api/audit")
def list_audit_events(db: DbSession, limit: int = Query(default=100, ge=1, le=500)) -> list[dict]:
    events = db.scalars(select(AuditEvent).order_by(AuditEvent.occurred_at.desc()).limit(limit)).all()
    return [
        {
            "id": event.id,
            "occurred_at": event.occurred_at,
            "actor_id": event.actor_id,
            "actor_name": event.actor_name,
            "action": event.action,
            "entity_type": event.entity_type,
            "entity_id": event.entity_id,
            "previous_value": event.previous_value,
            "new_value": event.new_value,
            "source": event.source,
            "result": event.result,
        }
        for event in events
    ]


@app.get("/{full_path:path}", include_in_schema=False)
def frontend(full_path: str):  # type: ignore[no-untyped-def]
    requested = STATIC_DIR / full_path
    if full_path and requested.is_file() and requested.resolve().is_relative_to(STATIC_DIR.resolve()):
        return FileResponse(requested)
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="FoodHub frontend has not been built")
