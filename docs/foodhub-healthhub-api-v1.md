# FoodHub / HealthHub API v1 contract

## Purpose

FoodHub is the household source of truth for shared recipes, scheduled dinners, ingredients and shopping-list workflows. HealthHub owns personal nutrition, diary, exercise, goals and progress data. The two applications do not share database tables.

## Compatibility

The GitHub repository, add-on directory, slug, persistent `/data/dinnerhub` path, Home Assistant entity IDs and calendar UID prefix retain the legacy `dinnerhub` identifier in this compatibility phase. User-facing branding is FoodHub.

## Initial v1 endpoints

### `GET /api/v1/capabilities`

Returns the FoodHub application version, API version and capability flags. `recipe_nutrition` is currently `false` and HealthHub must not interpret missing nutrition as zero calories.

### `GET /api/v1/recipes/{meal_id}/summary`

Returns stable recipe identity, display name, image reference, serving count, active/archive state and revision timestamp. Nutrition is explicitly reported as unavailable until FoodHub has validated nutrition fields and migration support.

## Planned compatible extensions

The v1 namespace is reserved to evolve compatibly toward:

- recipe nutrition totals and per-serving nutrition with provenance
- recipe nutrition revision and completeness state
- scheduled dinner reads
- recipe archive/update state
- shopping-list handoff
- durable schedule and recipe change events

Breaking response changes require a new API version.

## HealthHub integration rules

- Use HTTP API calls only, never direct FoodHub database access.
- Treat FoodHub unavailability as a degraded integration, not a HealthHub startup failure.
- Apply finite connection/read timeouts.
- Do not automatically copy FoodHub recipes into HealthHub.
- Do not mark scheduled dinners as consumed.
- Persist nutrition snapshots only when FoodHub later reports authoritative values with provenance and a revision.
