from __future__ import annotations

from .foodhub_v1 import MealNutrition, router as foodhub_v1_router
from .main_v5 import app

# Register the additive nutrition table before the application lifespan calls
# Base.metadata.create_all(). Existing FoodHub/DinnerHub tables are untouched.
_ = MealNutrition

# The original FoodHub compatibility foundation exposed provisional v1 routes
# for capabilities and recipe summaries. Replace those provisional handlers
# with the authoritative v0.14 implementations, then insert the new router
# ahead of the SPA catch-all route.
replaced_paths = {
    "/api/v1/capabilities",
    "/api/v1/recipes/{meal_id}/summary",
}
app.router.routes[:] = [
    route for route in app.router.routes
    if getattr(route, "path", None) not in replaced_paths
]

original_count = len(app.router.routes)
app.include_router(foodhub_v1_router)
new_routes = app.router.routes[original_count:]
del app.router.routes[original_count:]
catch_all_index = max(0, len(app.router.routes) - 1)
for offset, route in enumerate(new_routes):
    app.router.routes.insert(catch_all_index + offset, route)
