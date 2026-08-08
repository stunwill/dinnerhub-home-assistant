from __future__ import annotations

import json
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .ai_import import _base, _headers, _response_text, _settings

router = APIRouter(prefix="/api/ai/recipe", tags=["ai-recipe-generation"])


class IngredientDraft(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    quantity: float | None = None
    unit: str | None = Field(default=None, max_length=80)
    shopping_category: str = Field(default="Other", max_length=80)
    notes: str | None = Field(default=None, max_length=500)
    optional: bool = False


class StepDraft(BaseModel):
    instruction: str = Field(min_length=1, max_length=1200)
    ingredient_names: list[str] = Field(default_factory=list)
    timer_minutes: int | None = Field(default=None, ge=0, le=1440)
    note: str | None = Field(default=None, max_length=500)


class RecipeDraft(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    description: str | None = Field(default=None, max_length=1500)
    categories: list[str] = Field(default_factory=list)
    cuisine: str | None = Field(default=None, max_length=120)
    prep_minutes: int = Field(default=0, ge=0, le=1440)
    cook_minutes: int = Field(default=0, ge=0, le=2880)
    servings: float = Field(default=4, gt=0, le=100)
    difficulty: str = Field(default="easy", pattern="^(easy|medium|hard)$")
    ingredients: list[IngredientDraft] = Field(default_factory=list)
    steps: list[StepDraft] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class GenerateRecipeInput(BaseModel):
    prompt: str = Field(min_length=3, max_length=4000)


class RefineRecipeInput(BaseModel):
    prompt: str = Field(min_length=2, max_length=3000)
    draft: RecipeDraft


RECIPE_GENERATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "name": {"type": "string"},
        "description": {"type": ["string", "null"]},
        "categories": {"type": "array", "items": {"type": "string"}},
        "cuisine": {"type": ["string", "null"]},
        "prep_minutes": {"type": "integer", "minimum": 0},
        "cook_minutes": {"type": "integer", "minimum": 0},
        "servings": {"type": "number", "exclusiveMinimum": 0},
        "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]},
        "ingredients": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string"},
                    "quantity": {"type": ["number", "null"]},
                    "unit": {"type": ["string", "null"]},
                    "shopping_category": {"type": "string"},
                    "notes": {"type": ["string", "null"]},
                    "optional": {"type": "boolean"},
                },
                "required": ["name", "quantity", "unit", "shopping_category", "notes", "optional"],
            },
        },
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "instruction": {"type": "string"},
                    "ingredient_names": {"type": "array", "items": {"type": "string"}},
                    "timer_minutes": {"type": ["integer", "null"]},
                    "note": {"type": ["string", "null"]},
                },
                "required": ["instruction", "ingredient_names", "timer_minutes", "note"],
            },
        },
        "warnings": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "name",
        "description",
        "categories",
        "cuisine",
        "prep_minutes",
        "cook_minutes",
        "servings",
        "difficulty",
        "ingredients",
        "steps",
        "warnings",
    ],
}


def _friendly_openai_error(response: httpx.Response) -> str:
    try:
        payload = response.json()
        error = payload.get("error", {}) if isinstance(payload, dict) else {}
        code = str(error.get("code") or "")
        message = str(error.get("message") or "")
        if code in {"credit_balance_exhausted", "insufficient_quota"} or "no credits remaining" in message.lower():
            return (
                "Your OpenAI API account has no available credit. Add API credit in OpenAI billing, "
                "then try the recipe again."
            )
        if message:
            return message[:800]
    except (ValueError, TypeError, AttributeError):
        pass
    return f"OpenAI returned HTTP {response.status_code}."


def _generate_with_openai(prompt: str, current: RecipeDraft | None = None) -> RecipeDraft:
    settings = _settings()
    if current is None:
        instruction = (
            "Create a practical, reliable home-cooking recipe from the user's request. Use sensible household quantities and metric units "
            "where practical. Every cooking step must include the relevant ingredient quantity directly in the instruction when that "
            "ingredient is first added or used, for example 'Brown 400 g chicken thigh' or 'Add 2 tbsp tomato paste'. Also link each step "
            "to the exact ingredient names it uses in ingredient_names. Keep the method concise, sequential and cook-friendly. "
            "Return a complete recipe even when the user gives only a short meal idea.\n\nUser request:\n"
            f"{prompt}"
        )
    else:
        instruction = (
            "Revise the current DinnerHub recipe according to the user's latest request. Preserve all recipe details the user did not ask "
            "to change. Recalculate quantities when servings or ingredient proportions change. Every cooking step must include relevant "
            "ingredient quantities directly in the instruction and ingredient_names must reference the exact ingredient names in the "
            "ingredient list. Return the complete revised recipe, not just the changed fields.\n\n"
            f"Current recipe:\n{json.dumps(current.model_dump(), ensure_ascii=False)}\n\n"
            f"User adjustment:\n{prompt}"
        )

    request_payload = {
        "model": settings["analysis_model"],
        "input": [{"role": "user", "content": [{"type": "input_text", "text": instruction}]}],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "dinnerhub_generated_recipe",
                "strict": True,
                "schema": RECIPE_GENERATION_SCHEMA,
            }
        },
    }
    try:
        with httpx.Client(timeout=180) as client:
            response = client.post(
                f"{_base()}/responses",
                headers={**_headers(), "Content-Type": "application/json"},
                json=request_payload,
            )
            response.raise_for_status()
            return RecipeDraft.model_validate(json.loads(_response_text(response.json())))
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=_friendly_openai_error(exc.response)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach the configured OpenAI API: {exc}") from exc
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="OpenAI returned a recipe that DinnerHub could not validate. Please try again.") from exc


@router.post("/generate")
def generate_recipe(payload: GenerateRecipeInput) -> dict[str, Any]:
    draft = _generate_with_openai(payload.prompt.strip())
    return {"draft": draft.model_dump(), "message": f"Created a draft for {draft.name}."}


@router.post("/refine")
def refine_recipe(payload: RefineRecipeInput) -> dict[str, Any]:
    draft = _generate_with_openai(payload.prompt.strip(), payload.draft)
    return {"draft": draft.model_dump(), "message": f"Updated {draft.name}."}
