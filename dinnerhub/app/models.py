from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Meal(Base):
    __tablename__ = "meals"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    main_protein: Mapped[str | None] = mapped_column(String(80), index=True)
    category: Mapped[str | None] = mapped_column(String(80), index=True)
    cuisine: Mapped[str | None] = mapped_column(String(80), index=True)
    prep_minutes: Mapped[int] = mapped_column(Integer, default=0)
    cook_minutes: Mapped[int] = mapped_column(Integer, default=0)
    servings: Mapped[float] = mapped_column(Float, default=4)
    difficulty: Mapped[str] = mapped_column(String(30), default="easy")
    instructions: Mapped[list[str]] = mapped_column(JSON, default=list)
    dietary_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    allergens: Mapped[list[str]] = mapped_column(JSON, default=list)
    substitutions: Mapped[list[str]] = mapped_column(JSON, default=list)
    notes: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(1000))
    source_url: Mapped[str | None] = mapped_column(String(1000))
    favourite: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    household_rating: Mapped[float | None] = mapped_column(Float)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    last_prepared_at: Mapped[date | None] = mapped_column(Date, index=True)
    selection_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    ingredients: Mapped[list[RecipeIngredient]] = relationship(
        back_populates="meal", cascade="all, delete-orphan", order_by="RecipeIngredient.sort_order"
    )
    plan_entries: Mapped[list[MealPlanEntry]] = relationship(back_populates="meal")

    __table_args__ = (
        Index("ix_meals_recent_usage", "active", "last_prepared_at"),
    )


class Ingredient(Base):
    __tablename__ = "ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    shopping_category: Mapped[str] = mapped_column(String(80), default="Other", index=True)
    default_unit: Mapped[str | None] = mapped_column(String(40))
    pantry_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    recipe_links: Mapped[list[RecipeIngredient]] = relationship(back_populates="ingredient")


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    meal_id: Mapped[int] = mapped_column(ForeignKey("meals.id", ondelete="CASCADE"), index=True)
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id", ondelete="RESTRICT"), index=True)
    quantity: Mapped[float | None] = mapped_column(Float)
    unit: Mapped[str | None] = mapped_column(String(40))
    notes: Mapped[str | None] = mapped_column(String(300))
    optional: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    meal: Mapped[Meal] = relationship(back_populates="ingredients")
    ingredient: Mapped[Ingredient] = relationship(back_populates="recipe_links")

    __table_args__ = (
        UniqueConstraint("meal_id", "ingredient_id", "sort_order", name="uq_recipe_ingredient_order"),
    )


class MealPlanEntry(Base):
    __tablename__ = "meal_plan_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    meal_date: Mapped[date] = mapped_column(Date, unique=True, index=True)
    meal_id: Mapped[int | None] = mapped_column(ForeignKey("meals.id", ondelete="SET NULL"), index=True)
    entry_type: Mapped[str] = mapped_column(String(30), default="meal", index=True)
    custom_title: Mapped[str | None] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(30), default="planned", index=True)
    servings: Mapped[float | None] = mapped_column(Float)
    selected_by_id: Mapped[str] = mapped_column(String(100), default="system")
    selected_by_name: Mapped[str] = mapped_column(String(180), default="DinnerHub")
    locked: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    meal: Mapped[Meal | None] = relationship(back_populates="plan_entries")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    actor_id: Mapped[str] = mapped_column(String(100))
    actor_name: Mapped[str] = mapped_column(String(180))
    action: Mapped[str] = mapped_column(String(100), index=True)
    entity_type: Mapped[str] = mapped_column(String(80), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(100), index=True)
    previous_value: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    new_value: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(String(80), default="web")
    result: Mapped[str] = mapped_column(String(30), default="success")
