from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .database import Base, get_db
from .models import Meal, MealPlanEntry

router = APIRouter(prefix="/api/v1", tags=["foodhub-v1"])
DbSession = Annotated[Session, Depends(get_db)]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MealNutrition(Base):
    __tablename__ = "meal_nutrition"

    meal_id: Mapped[int] = mapped_column(ForeignKey("meals.id", ondelete="CASCADE"), primary_key=True)
    calories_kcal: Mapped[float | None] = mapped_column(Float)
    protein_g: Mapped[float | None] = mapped_column(Float)
    carbohydrate_g: Mapped[float | None] = mapped_column(Float)
    fat_g: Mapped[float | None] = mapped_column(Float)
    saturated_fat_g: Mapped[float | None] = mapped_column(Float)
    sugar_g: Mapped[float | None] = mapped_column(Float)
    fibre_g: Mapped[float | None] = mapped_column(Float)
    sodium_mg: Mapped[float | None] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(40), default="manual")
    authoritative: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class NutritionInput(BaseModel):
    calories_kcal: float | None = Field(default=None, ge=0)
    protein_g: float | None = Field(default=None, ge=0)
    carbohydrate_g: float | None = Field(default=None, ge=0)
    fat_g: float | None = Field(default=None, ge=0)
    saturated_fat_g: float | None = Field(default=None, ge=0)
    sugar_g: float | None = Field(default=None, ge=0)
    fibre_g: float | None = Field(default=None, ge=0)
    sodium_mg: float | None = Field(default=None, ge=0)
    source: Literal["manual", "label", "ai", "calculated", "imported"] = "manual"
    authoritative: bool = False


NUTRIENT_FIELDS = (
    "calories_kcal",
    "protein_g",
    "carbohydrate_g",
    "fat_g",
    "saturated_fat_g",
    "sugar_g",
    "fibre_g",
    "sodium_mg",
)


def _meal(db: Session, meal_id: int) -> Meal:
    meal = db.get(Meal, meal_id)
    if not meal:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return meal


def _nutrition(db: Session, meal_id: int) -> MealNutrition | None:
    return db.get(MealNutrition, meal_id)


def _nutrition_dict(row: MealNutrition | None) -> dict:
    if row is None:
        return {
            "available": False,
            "authoritative": False,
            "completeness": "unavailable",
            "basis": "per_serving",
            "source": None,
            "values": {field: None for field in NUTRIENT_FIELDS},
            "updated_at": None,
        }

    values = {field: getattr(row, field) for field in NUTRIENT_FIELDS}
    populated = sum(value is not None for value in values.values())
    completeness = "complete" if populated == len(values) else "partial"
    return {
        "available": populated > 0,
        "authoritative": bool(row.authoritative and populated > 0),
        "completeness": completeness if populated else "unavailable",
        "basis": "per_serving",
        "source": row.source,
        "values": values,
        "updated_at": row.updated_at,
    }


@router.get("/capabilities")
def capabilities() -> dict:
    return {
        "service": "FoodHub",
        "api_version": "v1",
        "technical_slug": "dinnerhub",
        "capabilities": {
            "connectivity": True,
            "scheduled_dinners": True,
            "recipe_catalogue": True,
            "recipe_nutrition": True,
            "shopping_list_handoff": False,
            "events": False,
        },
        "nutrition": {
            "available": True,
            "authoritative": "per_recipe",
            "basis": "per_serving",
            "missing_values_are_null": True,
        },
    }


@router.get("/recipes/{meal_id}/summary")
def recipe_summary(meal_id: int, db: DbSession) -> dict:
    meal = _meal(db, meal_id)
    return {
        "id": str(meal.id),
        "name": meal.name,
        "image_ref": meal.image_url,
        "serving_count": meal.servings,
        "active": meal.active,
        "updated_at": meal.updated_at,
        "nutrition": _nutrition_dict(_nutrition(db, meal.id)),
    }


@router.get("/recipes/{meal_id}/nutrition")
def get_recipe_nutrition(meal_id: int, db: DbSession) -> dict:
    meal = _meal(db, meal_id)
    return {
        "recipe_id": str(meal.id),
        "recipe_name": meal.name,
        "serving_count": meal.servings,
        "nutrition": _nutrition_dict(_nutrition(db, meal.id)),
    }


@router.put("/recipes/{meal_id}/nutrition")
def put_recipe_nutrition(meal_id: int, payload: NutritionInput, db: DbSession) -> dict:
    meal = _meal(db, meal_id)
    row = _nutrition(db, meal.id)
    if row is None:
        row = MealNutrition(meal_id=meal.id)
        db.add(row)
    for field, value in payload.model_dump().items():
        setattr(row, field, value)
    row.updated_at = utc_now()
    db.commit()
    db.refresh(row)
    return {
        "recipe_id": str(meal.id),
        "recipe_name": meal.name,
        "serving_count": meal.servings,
        "nutrition": _nutrition_dict(row),
    }


@router.delete("/recipes/{meal_id}/nutrition")
def delete_recipe_nutrition(meal_id: int, db: DbSession) -> dict:
    meal = _meal(db, meal_id)
    row = _nutrition(db, meal.id)
    if row is not None:
        db.delete(row)
        db.commit()
    return {
        "recipe_id": str(meal.id),
        "nutrition": _nutrition_dict(None),
    }


@router.get("/scheduled-dinners")
def scheduled_dinners(
    db: DbSession,
    start: date | None = Query(default=None),
    days: int = Query(default=7, ge=1, le=31),
) -> dict:
    first = start or date.today()
    last = first + timedelta(days=days - 1)
    entries = db.scalars(
        select(MealPlanEntry)
        .where(MealPlanEntry.meal_date >= first, MealPlanEntry.meal_date <= last)
        .order_by(MealPlanEntry.meal_date)
    ).all()

    items: list[dict] = []
    for entry in entries:
        meal = entry.meal
        nutrition = _nutrition_dict(_nutrition(db, meal.id)) if meal else _nutrition_dict(None)
        items.append(
            {
                "date": entry.meal_date,
                "entry_type": entry.entry_type,
                "status": entry.status,
                "servings": entry.servings or (meal.servings if meal else None),
                "recipe": None if meal is None else {
                    "id": str(meal.id),
                    "name": meal.name,
                    "image_ref": meal.image_url,
                    "serving_count": meal.servings,
                    "nutrition": nutrition,
                },
                "updated_at": entry.updated_at,
            }
        )

    return {
        "service": "FoodHub",
        "start": first,
        "days": days,
        "items": items,
    }
