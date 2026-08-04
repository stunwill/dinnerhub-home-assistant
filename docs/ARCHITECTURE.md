# DinnerHub architecture

## Recommendation

The proposed FastAPI, React, TypeScript, SQLite and Docker architecture is appropriate for a Raspberry Pi 5 running Home Assistant OS. DinnerHub should remain a single container and a single local database until real scale or operational evidence justifies more services.

## Runtime components

1. **React and TypeScript frontend** for responsive mobile, tablet, desktop and wall-dashboard use.
2. **FastAPI application** for meal, planning, shopping and Home Assistant contracts.
3. **SQLAlchemy data layer** over SQLite using WAL mode, foreign keys and explicit transactions.
4. **Home Assistant Ingress** for authentication and sidebar access.
5. **Home Assistant adapter layer** for sensors, services and calendar entities.

## Home Assistant integration decision

The recommended long-term approach is a combination:

- Ingress for the application UI and Home Assistant-authenticated users.
- A dedicated DinnerHub custom integration for `calendar.dinnerhub`, services and richer entity lifecycle management.
- MQTT discovery for simple, highly visible sensors only when the Mosquitto service is available.
- REST endpoints as the stable internal contract and diagnostic fallback.

A custom integration is more maintainable than relying on REST sensors for calendar and services. MQTT remains useful for decoupled sensor state, but it should not be the sole source of truth.

## Storage

The authoritative database is `/data/dinnerhub/dinnerhub.db`. SQLite is sufficient because writes are low-volume and normally originate from one household. WAL mode improves read concurrency. Every schema migration must:

1. Validate free disk space.
2. Create a timestamped database copy.
3. Run the migration in a transaction where SQLite permits.
4. Perform `PRAGMA integrity_check`.
5. Retain the previous database until the new application version has started successfully.

## Full target data model

Core tables:

- `users`: cached Home Assistant identity and DinnerHub role.
- `household_members`: dietary preferences, dislikes and attendance defaults.
- `meals`: meal identity, metadata, timing, status and usage counters.
- `ingredients`: normalised ingredient catalogue and shopping category.
- `recipe_ingredients`: quantities, units, optional flags and sort order.
- `meal_categories`, `proteins`, `cuisines`, `dietary_tags`, `allergens`: controlled vocabulary tables.
- Association tables for meal tags, allergens and secondary proteins.
- `meal_plan_entries`: one planned dinner per date, including special night types.
- `meal_history`: planned, completed, replaced and skipped outcomes.
- `ratings`, `favourites`, `comments`: per-household-member feedback.
- `shopping_lists`, `shopping_list_items`, `shopping_item_sources`: generated and manual items with recipe provenance.
- `pantry_items`: staple and optional quantity information.
- `settings`: versioned household and integration settings.
- `audit_events`: append-oriented change history.

Important constraints and indexes:

- Unique active meal name, case-insensitive.
- Unique `meal_plan_entries.meal_date`.
- Unique ingredient normalised name.
- Index meal protein, category, active state, favourite, rating and last-prepared date.
- Index plan date and status.
- Index audit timestamp, actor, action and entity.
- Use archive timestamps instead of destructive deletion for user-owned records.

## API principles

- Prefix all application endpoints with `/api`.
- Use typed Pydantic request and response models.
- Return `409` for conflicting names or version conflicts.
- Return `422` for validation errors.
- Return `404` only when the requested resource does not exist.
- Include an idempotency key for future generation and integration writes.
- Preserve manually added shopping items when regenerating recipe-derived items.

## Security

- Trust user identity only from Supervisor-provided `X-Remote-User-*` headers received through Ingress.
- Do not expose a host port by default.
- Do not map Home Assistant's main configuration directory.
- Treat imported URLs and images as untrusted input.
- Restrict uploads by type, size and decoded image validation.
- Store no Home Assistant long-lived access token. Use the injected `SUPERVISOR_TOKEN` only inside the container when Home Assistant API access is needed.
- Enforce roles in the backend, never only in the frontend.
