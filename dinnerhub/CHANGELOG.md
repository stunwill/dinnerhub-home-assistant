# Changelog

## 0.4.0

### Added

- Added a native Home Assistant custom integration with Config Flow setup.
- Added automatic sensors for today's dinner and tomorrow's dinner.
- Added shopping-list remaining and purchased item sensors.
- Added an active recipe diagnostic sensor.
- Added a DinnerHub meal-plan calendar entity.
- Added Home Assistant buttons to rebuild 7-day and 14-day shopping lists.
- Added a Home Assistant button to clear purchased shopping items.
- Added HACS custom-repository metadata and installation documentation.

### Improved

- DinnerHub entities are grouped under one Home Assistant device.
- Entity availability now follows the local DinnerHub API connection.
- Native entities remove the need for manually maintained REST sensors after migration.

## 0.3.0

### Added

- Added a dedicated Shopping tab inside DinnerHub.
- Added a persistent shopping list stored in DinnerHub's SQLite database.
- Added 7-day and 14-day list generation from the current meal plan.
- Added serving-aware quantity aggregation across planned meals.
- Added manual shopping items for groceries and household products.
- Added shopping-category grouping.
- Added purchased-item checkboxes that remain checked between sessions.
- Added controls to remove individual items and clear purchased items.
- Added a shopping-list summary showing remaining, purchased and manual items.

### Improved

- Rebuilding the list preserves manual items and the purchased state of matching planned ingredients.
- Shopping-list meal references show which planned recipes require each item.

## 0.2.0

### Added

- Added full recipe detail views from the meal library.
- Added editing for existing recipes.
- Added ingredient quantity and unit entry.
- Added step-by-step cooking instructions.
- Added cuisine, difficulty, notes and source URL fields.
- Added serving controls that scale displayed ingredient quantities.
- Added favourite and archive actions.

### Improved

- Shopping-list quantities now scale using the servings assigned to each planned meal.
- Meal cards now provide separate recipe and meal-planning actions.
- Recipe forms now support adding and removing structured ingredient rows.

## 0.1.3

### Added

- Added reusable ingredient autocomplete with keyboard and mouse selection.
- Added ingredient pills and automatic creation of new ingredients.
- Added multi-select meal categories with reusable suggestions and new-category creation.
- Added meal image selection, client-side resizing and image previews.
- Added CSV shopping-list export for the active 7-day or 14-day meal plan.

### Changed

- Removed the separate main-protein field from the recipe form because proteins are now managed as ingredients.
- Meal cards now display uploaded meal images when available.

## 0.1.2

### Added

- Added an **Add to meal plan** button to every recipe card.
- Added a 7-day and 14-day picker showing the current meal assigned to each upcoming date.
- Added direct Add and Change actions so a recipe can be assigned or replace an existing planned meal without leaving the Meals page.

## 0.1.1

### Fixed

- Removed the container-level Ingress IP restriction that rejected Home Assistant's proxy with `403 Forbidden`.
- Retained Home Assistant Ingress as the authentication and access-control boundary.

## 0.1.0-dev

### Added

- Initial Home Assistant app repository and Ingress configuration.
- FastAPI, SQLAlchemy and SQLite backend foundation.
- Structured meals, ingredients, meal plans and audit events.
- Responsive React and TypeScript interface.
- Health, readiness, version, dashboard, calendar and Home Assistant state endpoints.
- Initial automated API tests and GitHub Actions workflows.
