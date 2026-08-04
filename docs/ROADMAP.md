# DinnerHub release roadmap

## v0.1.0, foundation and installation

Scope:

- Home Assistant repository and app packaging.
- Ingress, persistent data, health checks and version display.
- React interface, FastAPI API and initial SQLAlchemy schema.
- Basic meal creation, search and seven-day or fourteen-day planning.
- REST contracts for Home Assistant states and calendar events.

Acceptance criteria:

- DinnerHub installs on a Raspberry Pi 5 through the app repository.
- Data remains after app restart and upgrade.
- A user can add a recipe and assign it to a date.
- The dashboard shows tonight, tomorrow and upcoming meals.
- Automated API tests pass.

## v0.2.0, complete recipe database

- Alembic migration framework and pre-migration backups.
- Detailed ingredient quantities, units and serving scaling.
- Recipe edit, duplicate, archive, restore and export.
- Controlled category, protein, cuisine, dietary and allergen vocabularies.
- Image uploads with validation.
- Full recipe page and mobile editor.

## v0.3.0, advanced meal planning

- Custom date ranges, drag and drop, copy week and reuse plan.
- Repeat warnings, locked meals and replacement history.
- Attendance-based servings.
- Meal completion and history reporting.

## v0.4.0, Home Assistant entities and calendar

- Dedicated custom integration with config flow.
- `calendar.dinnerhub` and documented dashboard cards.
- Today, tomorrow, next dinner and plan status sensors.
- Home Assistant services and optional MQTT discovery.
- Defrost and slow-cooker automation metadata.

## v0.5.0, shopping list

- Generated and manual shopping items.
- Unit consolidation and category grouping.
- Pantry staples and item provenance.
- Home Assistant shopping list and Grocy adapters.

## v0.6.0, suggestions and reporting

- Rule-based suggestion engine.
- Full plan generation, lock and regenerate.
- Ratings, favourites, usage history and reports.
- Repeat avoidance and batch-cooking support.

## v0.7.0, household features

- Role-based access, suggestions, voting and comments.
- Shared dietary preferences and disliked ingredients.
- Household attendance and serving calculations.

## v1.0.0, stable release

- Migration compatibility policy.
- Documented backup and disaster recovery validation.
- Security review, dependency scanning and signed images.
- Performance and accessibility acceptance testing.
- Stable API and Home Assistant integration contracts.
