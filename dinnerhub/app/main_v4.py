from __future__ import annotations

from .ai_import import router as ai_import_router
from .main_v3 import app

# main_v3 already places extension routes ahead of the SPA fallback. Insert the
# AI endpoints immediately before that fallback as well.
original_count = len(app.router.routes)
app.include_router(ai_import_router)
new_routes = app.router.routes[original_count:]
del app.router.routes[original_count:]
catch_all_index = max(0, len(app.router.routes) - 1)
for offset, route in enumerate(new_routes):
    app.router.routes.insert(catch_all_index + offset, route)
