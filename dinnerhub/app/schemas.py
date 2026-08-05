from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class IngredientInput(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    quantity: float | None = Field(default=None, ge=0)
    unit: str | None = Field(default=None, max_length=40)
    shopping_category: str = Field(default="Other", max_length=80)
    notes: str | None = Field(default=None, max_length=300)
    optional: bool = False

    @field_validator("name", "unit", "shopping_category", "notes", mode="before")
    @classmethod
    def trim_text(cls, value):  # type: ignore[no-untyped-def]
        return value.strip() if isinstance(value, str) else value


class IngredientOutput(IngredientInput):
    id: int


class MealBase(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    description: str | None = None
    main_protein: str | None = Field(default=None, max_length=80)
    category: str | None = Field(default=None, max_length=500)
    cuisine: str | None = Field(default=None, max_length=80)
    prep_minutes: int = Field(default=0, ge=0, le=1440)
    cook_minutes: int = Field(default=0, ge=0, le=2880)
    servings: float = Field(default=4, gt=0, le=100)
    difficulty: Literal["easy", "medium", "hard"] = "easy"
    instructions: list[str] = Field(default_factory=list, max_length=100)
    dietary_tags: list[str] = Field(default_factory=list, max_length=50)
    allergens: list[str] = Field(default_factory=list, max_length=50)
    substitutions: list[str] = Field(default_factory=list, max_length=50)
    notes: str | None = None
    image_url: str | None = Field(default=None, max_length=2_500_000)
    source_url: HttpUrl | None = None
    favourite: bool = False
    household_rating: float | None = Field(default=None, ge=0, le=5)
    ingredients: list[IngredientInput] = Field(default_factory=list, max_length=250)

    @field_validator("name", "main_protein", "category", "cuisine", mode="before")
    @classmethod
    def trim_names(cls, value):  # type: ignore[no-untyped-def]
        return value.strip() if isinstance(value, str) else value


class MealCreate(MealBase):
    pass


class MealUpdate(MealBase):
    active: bool = True


class MealOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    main_protein: str | None
    category: str | None
    cuisine: str | None
    prep_minutes: int
    cook_minutes: int
    total_minutes: int
    servings: float
    difficulty: str
    instructions: list[str]
    dietary_tags: list[str]
    allergens: list[str]
    substitutions: list[str]
    notes: str | None
    image_url: str | None
    source_url: str | None
    favourite: bool
    household_rating: float | None
    active: bool
    last_prepared_at: date | None
    selection_count: int
    ingredients: list[IngredientOutput]
    created_at: datetime
    updated_at: datetime


class PlanEntryInput(BaseModel):
    meal_id: int | None = None
    entry_type: Literal["meal", "takeaway", "leftovers", "eating_out", "no_meal"] = "meal"
    custom_title: str | None = Field(default=None, max_length=180)
    servings: float | None = Field(default=None, gt=0, le=100)
    locked: bool = False
    notes: str | None = None


class PlanEntryOutput(BaseModel):
    id: int
    meal_date: date
    meal_id: int | None
    title: str
    entry_type: str
    status: str
    servings: float | None
    selected_by_id: str
    selected_by_name: str
    locked: bool
    notes: str | None
    meal: MealOutput | None
    created_at: datetime
    updated_at: datetime


class DashboardOutput(BaseModel):
    version: str
    today: PlanEntryOutput | None
    tomorrow: PlanEntryOutput | None
    upcoming: list[PlanEntryOutput]
    unplanned_days: int
    active_meals: int
