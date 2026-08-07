from __future__ import annotations

import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .database import get_db
from .models import Meal, RecipeIngredient
from .schemas import RecipeStepInput, RecipeStepOutput
from .structured_steps import RecipeStep, list_steps, replace_steps

router = APIRouter(prefix="/api", tags=["cooking-steps"])
DbSession = Annotated[Session, Depends(get_db)]


def _meal(db: Session, meal_id: int) -> Meal:
    meal = db.scalar(
        select(Meal)
        .options(selectinload(Meal.ingredients).selectinload(RecipeIngredient.ingredient))
        .where(Meal.id == meal_id)
    )
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    return meal


def _quantity(value: float) -> str:
    rounded = round(value, 2)
    if rounded.is_integer():
        return str(int(rounded))
    return f"{rounded:g}"


def _amount_for(meal: Meal, ingredient_name: str, servings: float) -> str | None:
    for link in meal.ingredients:
        if link.ingredient.name.lower() != ingredient_name.lower():
            continue
        if link.quantity is None:
            return link.ingredient.name
        scaled = link.quantity * (servings / meal.servings)
        amount = _quantity(scaled)
        unit = f" {link.unit}" if link.unit else ""
        return f"{amount}{unit} {link.ingredient.name}".strip()
    return None


def _already_has_amount(text: str, ingredient_name: str) -> bool:
    escaped = re.escape(ingredient_name)
    return bool(re.search(rf"\b\d+(?:[./]\d+|\.\d+)?\s*(?:[a-zA-Z]+\s+)?{escaped}\b", text, re.IGNORECASE))


def _render_instruction(meal: Meal, step: RecipeStep | dict, servings: float) -> str:
    instruction = step.instruction if isinstance(step, RecipeStep) else str(step["instruction"])
    names = step.ingredient_names if isinstance(step, RecipeStep) else list(step.get("ingredient_names", []))
    rendered = instruction
    missing: list[str] = []

    for ingredient_name in names:
        amount = _amount_for(meal, ingredient_name, servings)
        if not amount:
            continue
        if _already_has_amount(rendered, ingredient_name):
            continue
        pattern = re.compile(re.escape(ingredient_name), re.IGNORECASE)
        if pattern.search(rendered):
            rendered = pattern.sub(amount, rendered, count=1)
        else:
            missing.append(amount)

    if missing:
        prefix = ", ".join(missing)
        rendered = f"Using {prefix}, {rendered[0].lower() + rendered[1:] if rendered else rendered}"
    return rendered


def _fallback_steps(meal: Meal) -> list[dict]:
    result: list[dict] = []
    ingredient_names = [link.ingredient.name for link in meal.ingredients]
    for position, instruction in enumerate(meal.instructions or [], start=1):
        linked = [name for name in ingredient_names if name.lower() in instruction.lower()]
        result.append(
            {
                "id": None,
                "position": position,
                "instruction": instruction,
                "ingredient_names": linked,
                "timer_minutes": None,
                "note": None,
            }
        )
    return result


@router.get("/meals/{meal_id}/steps", response_model=list[RecipeStepOutput])
def get_recipe_steps(
    meal_id: int,
    db: DbSession,
    servings: float | None = Query(default=None, gt=0, le=100),
) -> list[dict]:
    meal = _meal(db, meal_id)
    target_servings = servings or meal.servings
    stored = list_steps(db, meal_id)
    rows = stored if stored else _fallback_steps(meal)
    output: list[dict] = []
    for row in rows:
        if isinstance(row, RecipeStep):
            item = {
                "id": row.id,
                "position": row.position,
                "instruction": row.instruction,
                "ingredient_names": row.ingredient_names or [],
                "timer_minutes": row.timer_minutes,
                "note": row.note,
            }
        else:
            item = dict(row)
        item["rendered_instruction"] = _render_instruction(meal, row, target_servings)
        output.append(item)
    return output


@router.put("/meals/{meal_id}/steps", response_model=list[RecipeStepOutput])
def save_recipe_steps(meal_id: int, payload: list[RecipeStepInput], db: DbSession) -> list[dict]:
    meal = _meal(db, meal_id)
    available = {link.ingredient.name.lower(): link.ingredient.name for link in meal.ingredients}
    clean: list[dict] = []
    for step in payload:
        names: list[str] = []
        for supplied in step.ingredient_names:
            canonical = available.get(supplied.lower())
            if canonical and canonical not in names:
                names.append(canonical)
        clean.append(
            {
                "instruction": step.instruction,
                "ingredient_names": names,
                "timer_minutes": step.timer_minutes,
                "note": step.note,
            }
        )

    rows = replace_steps(db, meal_id, clean)
    meal.instructions = [row.instruction for row in rows]
    db.commit()
    return [
        {
            "id": row.id,
            "position": row.position,
            "instruction": row.instruction,
            "ingredient_names": row.ingredient_names or [],
            "timer_minutes": row.timer_minutes,
            "note": row.note,
            "rendered_instruction": _render_instruction(meal, row, meal.servings),
        }
        for row in rows
    ]
