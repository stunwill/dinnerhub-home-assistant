from __future__ import annotations

from .ai_recipe_generation import router as ai_recipe_generation_router
from .main_v4 import app

# main_v4 already places extension routes ahead of the SPA fallback. Insert the
# conversational recipe-generation API immediately before that fallback too.
original_count = len(app.router.routes)
app.include_router(ai_recipe_generation_router)
new_routes = app.router.routes[original_count:]
del app.router.routes[original_count:]
catch_all_index = max(0, len(app.router.routes) - 1)
for offset, route in enumerate(new_routes):
    app.router.routes.insert(catch_all_index + offset, route)
