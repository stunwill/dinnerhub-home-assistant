from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/filter-settings", tags=["filter-settings"])

DATA_DIR = Path(os.getenv("DINNERHUB_DATA_DIR", "/data/dinnerhub"))
SETTINGS_FILE = DATA_DIR / "filter-settings.json"


class RecipeFilter(BaseModel):
    label: str = Field(min_length=1, max_length=40)
    kind: Literal["ingredient", "category", "cuisine"]
    value: str = Field(min_length=1, max_length=80)
    enabled: bool = True


class FilterSettings(BaseModel):
    favourites_first: bool = True
    show_favourites_filter: bool = True
    maximum_active_filters: int = Field(default=2, ge=1, le=5)
    filters: list[RecipeFilter] = Field(default_factory=list, max_length=30)


DEFAULT_SETTINGS = FilterSettings(
    filters=[
        RecipeFilter(label="Chicken", kind="ingredient", value="chicken"),
        RecipeFilter(label="Beef", kind="ingredient", value="beef"),
        RecipeFilter(label="Pork", kind="ingredient", value="pork"),
        RecipeFilter(label="Lamb", kind="ingredient", value="lamb"),
        RecipeFilter(label="Fish", kind="ingredient", value="fish"),
        RecipeFilter(label="Vegetarian", kind="category", value="vegetarian"),
        RecipeFilter(label="Pasta", kind="ingredient", value="pasta"),
        RecipeFilter(label="Curry", kind="category", value="curry"),
        RecipeFilter(label="Mexican", kind="category", value="mexican"),
    ]
)


def load_filter_settings() -> FilterSettings:
    if not SETTINGS_FILE.exists():
        return DEFAULT_SETTINGS.model_copy(deep=True)
    try:
        return FilterSettings.model_validate_json(SETTINGS_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return DEFAULT_SETTINGS.model_copy(deep=True)


def save_filter_settings(settings: FilterSettings) -> None:
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        temporary = SETTINGS_FILE.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(settings.model_dump(), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        temporary.replace(SETTINGS_FILE)
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Filter settings could not be saved") from exc


@router.get("", response_model=FilterSettings)
def get_filter_settings() -> FilterSettings:
    return load_filter_settings()


@router.put("", response_model=FilterSettings)
def update_filter_settings(payload: FilterSettings) -> FilterSettings:
    normalised_filters: list[RecipeFilter] = []
    seen: set[tuple[str, str]] = set()
    for item in payload.filters:
        label = " ".join(item.label.split())
        value = " ".join(item.value.split())
        key = (item.kind, value.casefold())
        if key in seen:
            continue
        seen.add(key)
        normalised_filters.append(
            RecipeFilter(label=label, kind=item.kind, value=value, enabled=item.enabled)
        )

    settings = FilterSettings(
        favourites_first=payload.favourites_first,
        show_favourites_filter=payload.show_favourites_filter,
        maximum_active_filters=payload.maximum_active_filters,
        filters=normalised_filters,
    )
    save_filter_settings(settings)
    return settings
