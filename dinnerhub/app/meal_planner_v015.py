from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, select, text
from sqlalchemy.orm import Mapped, Session, mapped_column, selectinload

from .database import Base, engine, get_db
from .models import Meal, MealPlanEntry, RecipeIngredient

router = APIRouter(prefix="/api", tags=["meal-planner"])
DbSession = Annotated[Session, Depends(get_db)]
MealType = Literal["breakfast", "lunch", "dinner"]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PlannedMeal(Base):
    __tablename__ = "planned_meals_v015"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meal_date: Mapped[date] = mapped_column(Date, index=True)
    meal_type: Mapped[str] = mapped_column(String(30), index=True)
    meal_id: Mapped[int | None] = mapped_column(ForeignKey("meals.id", ondelete="SET NULL"), index=True)
    custom_title: Mapped[str | None] = mapped_column(String(180))
    servings: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (UniqueConstraint("meal_date", "meal_type", name="uq_planned_meal_date_type"),)


class PlannedMealInput(BaseModel):
    meal_date: date
    meal_type: MealType
    meal_id: int | None = None
    custom_title: str | None = Field(default=None, max_length=180)
    servings: float | None = Field(default=None, gt=0, le=100)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("custom_title", "notes", mode="before")
    @classmethod
    def trim_text(cls, value):  # type: ignore[no-untyped-def]
        return value.strip() if isinstance(value, str) else value


class PlannedMealPatch(BaseModel):
    meal_date: date | None = None
    meal_type: MealType | None = None
    meal_id: int | None = None
    custom_title: str | None = Field(default=None, max_length=180)
    servings: float | None = Field(default=None, gt=0, le=100)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("custom_title", "notes", mode="before")
    @classmethod
    def trim_text(cls, value):  # type: ignore[no-untyped-def]
        return value.strip() if isinstance(value, str) else value


class DuplicateInput(BaseModel):
    meal_date: date
    meal_type: MealType


def _meal(db: Session, meal_id: int | None) -> Meal | None:
    if meal_id is None:
        return None
    meal = db.scalar(
        select(Meal)
        .options(selectinload(Meal.ingredients).selectinload(RecipeIngredient.ingredient))
        .where(Meal.id == meal_id, Meal.active.is_(True))
    )
    if not meal:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return meal


def _validate_choice(meal: Meal | None, custom_title: str | None) -> None:
    if bool(meal) == bool(custom_title):
        raise HTTPException(status_code=422, detail="Choose either a recipe or a custom meal")


def _row(db: Session, planned_id: int) -> PlannedMeal:
    row = db.get(PlannedMeal, planned_id)
    if not row:
        raise HTTPException(status_code=404, detail="Planned meal not found")
    return row


def _payload(db: Session, row: PlannedMeal) -> dict:
    meal = _meal(db, row.meal_id) if row.meal_id else None
    return {
        "id": row.id,
        "meal_date": row.meal_date,
        "meal_type": row.meal_type,
        "meal_id": row.meal_id,
        "title": meal.name if meal else row.custom_title,
        "custom_title": row.custom_title,
        "servings": row.servings or (meal.servings if meal else None),
        "notes": row.notes,
        "recipe": None if meal is None else {
            "id": meal.id,
            "name": meal.name,
            "image_url": meal.image_url,
            "prep_minutes": meal.prep_minutes,
            "cook_minutes": meal.cook_minutes,
            "servings": meal.servings,
            "has_instructions": bool(meal.instructions),
        },
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def migrate_legacy_dinner_plans() -> None:
    """Copy legacy one-dinner-per-date rows into v0.15 slots without deleting them."""
    Base.metadata.create_all(bind=engine, tables=[PlannedMeal.__table__])
    with engine.begin() as connection:
        table_names = {item[0] for item in connection.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))}
        if "meal_plan_entries" not in table_names:
            return
        rows = connection.execute(
            text(
                "SELECT meal_date, meal_id, custom_title, servings, notes, created_at, updated_at "
                "FROM meal_plan_entries"
            )
        ).mappings()
        for item in rows:
            exists = connection.execute(
                text(
                    "SELECT 1 FROM planned_meals_v015 WHERE meal_date=:meal_date AND meal_type='dinner' LIMIT 1"
                ),
                {"meal_date": item["meal_date"]},
            ).first()
            if exists:
                continue
            custom_title = item["custom_title"]
            meal_id = item["meal_id"]
            if meal_id is None and not custom_title:
                custom_title = "Dinner"
            connection.execute(
                text(
                    "INSERT INTO planned_meals_v015 "
                    "(meal_date, meal_type, meal_id, custom_title, servings, notes, created_at, updated_at) "
                    "VALUES (:meal_date, 'dinner', :meal_id, :custom_title, :servings, :notes, :created_at, :updated_at)"
                ),
                {
                    "meal_date": item["meal_date"],
                    "meal_id": meal_id,
                    "custom_title": custom_title,
                    "servings": item["servings"],
                    "notes": item["notes"],
                    "created_at": item["created_at"] or utc_now(),
                    "updated_at": item["updated_at"] or utc_now(),
                },
            )


@router.get("/meal-planner")
def list_planned_meals(
    db: DbSession,
    start: date | None = Query(default=None),
    days: int = Query(default=7, ge=1, le=31),
) -> list[dict]:
    first = start or date.today()
    last = first + timedelta(days=days - 1)
    rows = db.scalars(
        select(PlannedMeal)
        .where(PlannedMeal.meal_date.between(first, last))
        .order_by(PlannedMeal.meal_date, PlannedMeal.meal_type)
    ).all()
    return [_payload(db, row) for row in rows]


@router.post("/meal-planner", status_code=status.HTTP_201_CREATED)
def create_planned_meal(payload: PlannedMealInput, db: DbSession) -> dict:
    meal = _meal(db, payload.meal_id)
    _validate_choice(meal, payload.custom_title)
    conflict = db.scalar(
        select(PlannedMeal).where(
            PlannedMeal.meal_date == payload.meal_date,
            PlannedMeal.meal_type == payload.meal_type,
        )
    )
    if conflict:
        raise HTTPException(status_code=409, detail="That meal slot is already planned")
    row = PlannedMeal(
        meal_date=payload.meal_date,
        meal_type=payload.meal_type,
        meal_id=meal.id if meal else None,
        custom_title=None if meal else payload.custom_title,
        servings=payload.servings or (meal.servings if meal else None),
        notes=payload.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _payload(db, row)


@router.patch("/meal-planner/{planned_id}")
def update_planned_meal(planned_id: int, payload: PlannedMealPatch, db: DbSession) -> dict:
    row = _row(db, planned_id)
    data = payload.model_dump(exclude_unset=True)
    target_date = data.get("meal_date", row.meal_date)
    target_type = data.get("meal_type", row.meal_type)
    conflict = db.scalar(
        select(PlannedMeal).where(
            PlannedMeal.meal_date == target_date,
            PlannedMeal.meal_type == target_type,
            PlannedMeal.id != row.id,
        )
    )
    if conflict:
        raise HTTPException(status_code=409, detail="That meal slot is already planned")

    meal_id = data.get("meal_id", row.meal_id)
    custom_title = data.get("custom_title", row.custom_title)
    if "meal_id" in data and data["meal_id"] is not None:
        custom_title = None
    if "custom_title" in data and data["custom_title"]:
        meal_id = None
    meal = _meal(db, meal_id)
    _validate_choice(meal, custom_title)

    row.meal_date = target_date
    row.meal_type = target_type
    row.meal_id = meal.id if meal else None
    row.custom_title = None if meal else custom_title
    row.servings = data.get("servings", row.servings) or (meal.servings if meal else row.servings)
    row.notes = data.get("notes", row.notes)
    row.updated_at = utc_now()
    db.commit()
    db.refresh(row)
    return _payload(db, row)


@router.post("/meal-planner/{planned_id}/duplicate", status_code=status.HTTP_201_CREATED)
def duplicate_planned_meal(planned_id: int, payload: DuplicateInput, db: DbSession) -> dict:
    source = _row(db, planned_id)
    conflict = db.scalar(
        select(PlannedMeal).where(
            PlannedMeal.meal_date == payload.meal_date,
            PlannedMeal.meal_type == payload.meal_type,
        )
    )
    if conflict:
        raise HTTPException(status_code=409, detail="That meal slot is already planned")
    row = PlannedMeal(
        meal_date=payload.meal_date,
        meal_type=payload.meal_type,
        meal_id=source.meal_id,
        custom_title=source.custom_title,
        servings=source.servings,
        notes=source.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _payload(db, row)


@router.delete("/meal-planner/{planned_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_planned_meal(planned_id: int, db: DbSession) -> Response:
    row = _row(db, planned_id)
    db.delete(row)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
