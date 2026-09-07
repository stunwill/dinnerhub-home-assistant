# Changelog

This root changelog is the canonical DevHub-discoverable release history for FoodHub. The Home Assistant-facing changelog remains at `dinnerhub/CHANGELOG.md`.

## 0.15.0

### Added
- Added a persistent weekly Meal Planner with Breakfast, Lunch and Dinner slots.
- Added recipe-backed and custom planned meals, with edit, move, duplicate and remove workflows.
- Added a mobile-first weekly planner that reflows to stacked day cards on narrow Home Assistant and iPhone-sized viewports, while retaining a seven-column weekly overview on wider screens.
- Added recipe-to-planner actions so a recipe can be scheduled without first navigating to the planner.
- Added a dedicated step-by-step Cooking Mode using FoodHub's existing structured cooking steps, serving scaling, ingredient associations and optional timer metadata.
- Added session restoration for the current Cooking Mode step and clear completion state.

### Compatibility
- Added the new `planned_meals` table without deleting or rewriting the legacy `meal_plan_entries` table.
- Existing dinner plans are copied safely into Dinner slots on upgrade.
- Dinner changes made through the new planner are mirrored back to the established dinner-plan table so the Home dashboard, Home Assistant entities, calendar and v1 scheduled-dinner integration continue to receive current dinner data.
- The legacy `dinnerhub` repository name, add-on slug, persistent storage path and Home Assistant identifiers remain unchanged.

### Testing
- Added Meal Planner API coverage for recipe meals, custom meals, moving, duplication, deletion, validation and week boundaries.
- Extended CI syntax checking to the FoodHub 0.15 frontend extension.
- Existing rendered mobile-layout regression coverage remains active for 320–430 px widths.

## 0.14.3

### Fixed
- Removed the 0.14.2 runtime Visual Viewport width-guessing workaround that could still leave Home wider than the iPhone WebView while making Guided Planning and Recipe Discovery too narrow.
- Replaced viewport-calculated page widths with stable containing-block sizing and explicit mobile reflow rules.
- Kept FoodHub branding, Add Recipe, Import Recipe, AI Settings, primary navigation and Home cards inside the mobile content width.
- Restored Guided Planning and Recipe Discovery to the full available content width rather than a collapsed narrow column.
- Prevented mobile modals, planning controls and legacy extension surfaces from establishing a wider page.

### Testing
- Added a rendered Chromium regression test across 320, 360, 375, 390, 393, 414 and 430 px widths.
- The browser test checks real `scrollWidth`, bounding boxes and horizontal scroll position on Home, Add Recipe, Meal Plan, Guided Planning, Meals and Recipe Discovery.
- The test fails with the first offending DOM elements when any rendered content extends beyond the viewport.

### Compatibility
- The `dinnerhub` repository name, add-on slug, storage path and established Home Assistant identifiers remain unchanged.
- No recipe, planning, rating or shopping data migration is required.

## 0.14.2

### Fixed
- Released the follow-up iPhone/Home Assistant Ingress width correction as an installable Home Assistant patch version.
- Constrained FoodHub to the actual usable visual viewport width so the application cannot remain wider than the visible iPhone WebView.
- Reflowed the mobile header so Add Recipe and Import Recipe fit in two columns with AI Settings on its own full-width row.
- Re-constrained primary navigation, dashboard cards, meal planning, Guided Planning, Shopping, forms and modals after legacy extension injection.
- Added runtime re-evaluation for resize, orientation and Visual Viewport changes so stale horizontal offsets are reset.

### Compatibility
- The `dinnerhub` repository name, add-on slug, storage path and established Home Assistant identifiers remain unchanged.
- No recipe, planning, rating or shopping data migration is required.

## 0.14.1

### Fixed
- Fixed document-level horizontal scrolling on mobile Home Assistant WebViews by replacing legacy `100vw` shell constraints with container-relative sizing.
- Reflowed FoodHub branding, Add Recipe, Import Recipe, AI Settings and primary navigation for narrow mobile widths.
- Constrained Guided Planning, dashboard cards and AI/planning dialogs so they do not expand the document horizontally.
- Corrected dark-mode styling for Guided Planning and AI import surfaces that previously used hard-coded light backgrounds.
- Updated remaining user-facing DinnerHub wording in AI import/settings and legacy enhancement UI to FoodHub.

### Compatibility
- The `dinnerhub` repository name, add-on slug, storage path and established Home Assistant identifiers remain unchanged.
- No recipe, planning, rating or shopping data migration is required.

## 0.14.0

### Added
- Added authoritative per-serving recipe nutrition storage with explicit unavailable-versus-zero handling.
- Added versioned FoodHub capability, recipe nutrition and scheduled-dinner API support for HealthHub integration.
- Added recipe nutrition editing in the FoodHub interface.

### Changed
- Completed user-facing FoodHub branding while retaining the legacy `dinnerhub` repository, add-on slug, storage path and established Home Assistant identifiers for compatibility.

### Compatibility
- Existing technical identifiers remain unchanged.
- Existing recipe, planning, rating and shopping data remain compatible.

## 0.13.0

### Fixed
- Improved Add Recipe modal reliability in Home Assistant iOS WebViews.
- Added draft recovery for interrupted recipe creation.

## 0.12.0

### Added
- Added review-first AI improvements for existing recipes, including iterative refinement and save-as-variation support.

## 0.11.0

### Added
- Added conversational AI recipe creation with structured ingredient and cooking-step output.

## 0.10.1

### Fixed
- Corrected minor recipe experience issues following the v0.10.0 release.

## 0.10.0

### Added
- Added the first structured Cooking View and improved recipe instruction authoring.

## 0.9.0

### Added
- Added AI-assisted recipe extraction and review workflows.

## 0.8.0

### Added
- Added improved meal planning and recipe management workflows.

## 0.7.0

### Added
- Added recipe and meal-management enhancements.

## 0.6.0

### Added
- Added broader meal planning and interface improvements.
