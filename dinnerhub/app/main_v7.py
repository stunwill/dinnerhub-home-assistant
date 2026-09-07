from __future__ import annotations

from .main_v6 import app
from .meal_planner_v015 import PlannedMeal, migrate_legacy_dinner_plans, router as meal_planner_router

# Register the additive v0.15 planner table and migrate legacy dinner-only plans
# into dinner slots without deleting or rewriting the existing table.
_ = PlannedMeal
migrate_legacy_dinner_plans()

# Insert Meal Planner routes before the SPA fallback.
original_count = len(app.router.routes)
app.include_router(meal_planner_router)
new_routes = app.router.routes[original_count:]
del app.router.routes[original_count:]
catch_all_index = max(0, len(app.router.routes) - 1)
for offset, route in enumerate(new_routes):
    app.router.routes.insert(catch_all_index + offset, route)
