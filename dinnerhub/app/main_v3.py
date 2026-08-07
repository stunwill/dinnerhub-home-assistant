from __future__ import annotations

from sqlalchemy import func, select

from . import main
from .filter_settings import router as filter_settings_router
from .main import app
from .models import Ingredient, RecipeIngredient
from .ratings import MealRating, router as ratings_router
from .shopping import router as shopping_router
from .structured_steps import RecipeStep
from .structured_steps_api import router as structured_steps_router


def replace_ingredients_safely(db, meal, items) -> None:  # type: ignore[no-untyped-def]
    """Replace recipe ingredients without colliding with existing link rows.

    Existing recipes need their old ingredient links deleted and flushed before
    replacement rows are inserted. New recipes must not be flushed here because
    create_meal owns the flush and converts duplicate-name integrity errors into
    a clear HTTP 409 response.
    """
    if meal.id is not None:
        meal.ingredients.clear()
        db.flush()

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


# Importing extension models registers their tables with SQLAlchemy before create_all runs.
_ = MealRating
_ = RecipeStep

# The create and update endpoints resolve this helper from the main module at
# request time, so replacing it here fixes both paths without duplicating the
# API routes.
main.replace_ingredients = replace_ingredients_safely

# The original application ends with a catch-all SPA route. Register extension
# APIs, then move their routes ahead of that fallback so GET requests are
# handled by the API instead of index.html.
original_count = len(app.router.routes)
app.include_router(shopping_router)
app.include_router(filter_settings_router)
app.include_router(ratings_router)
app.include_router(structured_steps_router)
new_routes = app.router.routes[original_count:]
del app.router.routes[original_count:]
catch_all_index = max(0, len(app.router.routes) - 1)
for offset, route in enumerate(new_routes):
    app.router.routes.insert(catch_all_index + offset, route)
