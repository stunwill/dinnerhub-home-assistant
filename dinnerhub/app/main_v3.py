from __future__ import annotations

from .main import app
from .shopping import router as shopping_router

# The original application ends with a catch-all SPA route. Register the
# shopping API, then move its routes ahead of that fallback so GET requests
# are handled by the API instead of index.html.
original_count = len(app.router.routes)
app.include_router(shopping_router)
new_routes = app.router.routes[original_count:]
del app.router.routes[original_count:]
catch_all_index = max(0, len(app.router.routes) - 1)
for offset, route in enumerate(new_routes):
    app.router.routes.insert(catch_all_index + offset, route)
