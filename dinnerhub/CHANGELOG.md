# Changelog

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
