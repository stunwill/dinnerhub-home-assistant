from __future__ import annotations

from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from .database import get_db
from .models import Meal, MealPlanEntry, RecipeIngredient
from .shopping_models import ShoppingItem

router = APIRouter(prefix="/api/shopping", tags=["shopping"])
DbSession = Annotated[Session, Depends(get_db)]


class ShoppingItemInput(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    quantity: float | None = Field(default=None, ge=0)
    unit: str | None = Field(default=None, max_length=40)
    shopping_category: str = Field(default="Other", max_length=80)


class ShoppingItemUpdate(BaseModel):
    checked: bool | None = None
    name: str | None = Field(default=None, min_length=1, max_length=180)
    quantity: float | None = Field(default=None, ge=0)
    unit: str | None = Field(default=None, max_length=40)
    shopping_category: str | None = Field(default=None, max_length=80)


def item_to_dict(item: ShoppingItem) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "quantity": item.quantity,
        "unit": item.unit,
        "shopping_category": item.shopping_category,
        "source": item.source,
        "source_key": item.source_key,
        "meal_names": [name for name in (item.meal_names or "").split("\n") if name],
        "checked": item.checked,
        "sort_order": item.sort_order,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


@router.get("")
def list_items(db: DbSession, include_checked: bool = True) -> list[dict]:
    statement = select(ShoppingItem)
    if not include_checked:
        statement = statement.where(ShoppingItem.checked.is_(False))
    items = db.scalars(
        statement.order_by(
            ShoppingItem.checked,
            ShoppingItem.shopping_category,
            ShoppingItem.sort_order,
            ShoppingItem.name,
        )
    ).all()
    return [item_to_dict(item) for item in items]


@router.post("", status_code=status.HTTP_201_CREATED)
def add_item(payload: ShoppingItemInput, db: DbSession) -> dict:
    item = ShoppingItem(
        name=" ".join(payload.name.split()),
        quantity=payload.quantity,
        unit=payload.unit.strip() if payload.unit else None,
        shopping_category=payload.shopping_category.strip() or "Other",
        source="manual",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item_to_dict(item)


@router.patch("/{item_id}")
def update_item(item_id: int, payload: ShoppingItemUpdate, db: DbSession) -> dict:
    item = db.get(ShoppingItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Shopping item not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        if isinstance(value, str):
            value = value.strip()
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item_to_dict(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, db: DbSession) -> Response:
    item = db.get(ShoppingItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Shopping item not found")
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/clear-checked")
def clear_checked(db: DbSession) -> dict:
    result = db.execute(delete(ShoppingItem).where(ShoppingItem.checked.is_(True)))
    db.commit()
    return {"removed": result.rowcount or 0}


@router.post("/clear-all")
def clear_all(db: DbSession) -> dict:
    result = db.execute(delete(ShoppingItem))
    db.commit()
    return {"removed": result.rowcount or 0}


@router.post("/generate")
def generate_from_plan(
    db: DbSession,
    days: int = Query(default=7, ge=1, le=14),
    preserve_manual: bool = True,
) -> dict:
    start = date.today()
    end = start + timedelta(days=days)
    entries = db.scalars(
        select(MealPlanEntry)
        .options(
            selectinload(MealPlanEntry.meal)
            .selectinload(Meal.ingredients)
            .selectinload(RecipeIngredient.ingredient)
        )
        .where(MealPlanEntry.meal_date >= start, MealPlanEntry.meal_date < end)
        .order_by(MealPlanEntry.meal_date)
    ).all()

    existing_checked = {
        item.source_key: item.checked
        for item in db.scalars(select(ShoppingItem).where(ShoppingItem.source == "plan")).all()
        if item.source_key
    }
    db.execute(delete(ShoppingItem).where(ShoppingItem.source == "plan"))
    if not preserve_manual:
        db.execute(delete(ShoppingItem).where(ShoppingItem.source == "manual"))

    aggregated: dict[str, dict] = {}
    for entry in entries:
        if not entry.meal:
            continue
        servings = entry.servings or entry.meal.servings or 1
        scale = servings / (entry.meal.servings or 1)
        for recipe_item in entry.meal.ingredients:
            ingredient = recipe_item.ingredient
            unit = recipe_item.unit or ingredient.default_unit or ""
            source_key = f"{ingredient.name.lower()}|{unit.lower()}"
            current = aggregated.setdefault(
                source_key,
                {
                    "name": ingredient.name,
                    "quantity": 0.0,
                    "has_quantity": False,
                    "unit": unit or None,
                    "shopping_category": ingredient.shopping_category or "Other",
                    "meal_names": set(),
                },
            )
            if recipe_item.quantity is not None:
                current["quantity"] += recipe_item.quantity * scale
                current["has_quantity"] = True
            current["meal_names"].add(entry.meal.name)

    sorted_items = sorted(
        aggregated.items(),
        key=lambda item: (item[1]["shopping_category"], item[1]["name"]),
    )
    for order, (source_key, value) in enumerate(sorted_items):
        db.add(
            ShoppingItem(
                name=value["name"],
                quantity=round(value["quantity"], 2) if value["has_quantity"] else None,
                unit=value["unit"],
                shopping_category=value["shopping_category"],
                source="plan",
                source_key=source_key,
                meal_names="\n".join(sorted(value["meal_names"])),
                checked=existing_checked.get(source_key, False),
                sort_order=order,
            )
        )

    db.commit()
    count = db.scalar(select(func.count(ShoppingItem.id))) or 0
    unchecked = db.scalar(
        select(func.count(ShoppingItem.id)).where(ShoppingItem.checked.is_(False))
    ) or 0
    return {"generated": len(aggregated), "total": count, "unchecked": unchecked, "days": days}


@router.get("/summary")
def shopping_summary(db: DbSession) -> dict:
    total = db.scalar(select(func.count(ShoppingItem.id))) or 0
    unchecked = db.scalar(
        select(func.count(ShoppingItem.id)).where(ShoppingItem.checked.is_(False))
    ) or 0
    manual = db.scalar(
        select(func.count(ShoppingItem.id)).where(ShoppingItem.source == "manual")
    ) or 0
    return {"total": total, "unchecked": unchecked, "checked": total - unchecked, "manual": manual}
