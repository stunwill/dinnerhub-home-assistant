# Changelog

## 0.15.0

### Added

- Added a persistent weekly Meal Planner with Breakfast, Lunch and Dinner slots.
- Added recipe-backed and custom meals with edit, move, duplicate and remove actions.
- Added responsive mobile day cards plus a wider-screen seven-day weekly planner.
- Added Add to Meal Plan and Start Cooking actions from recipe workflows.
- Added a dedicated step-by-step Cooking Mode that reuses structured recipe steps, serving scaling, ingredient associations and optional timers.
- Added active-session cooking progress restoration and a clear Meal complete state.

### Compatibility

- Existing one-dinner-per-date records are preserved and copied safely into the new Dinner slot.
- Dinner changes in the new planner remain synchronized with the established dinner-plan table used by the FoodHub dashboard, Home Assistant entities, calendar and versioned scheduled-dinner API.
- The `dinnerhub` add-on slug, repository name, persistent storage paths and existing Home Assistant identifiers remain unchanged.

### Testing

- Added backend Meal Planner coverage for recipe/custom meals, updates, moving, duplication, removal, validation and date-window boundaries.
- Added CI syntax validation for the new FoodHub 0.15 frontend layer while retaining the existing rendered 320–430 px mobile regression suite.

## 0.14.3

### Fixed

- Removed the 0.14.2 runtime Visual Viewport width-guessing workaround that could still leave Home wider than the visible iPhone WebView while making Guided Planning and Recipe Discovery too narrow.
- Replaced viewport-calculated page widths with stable containing-block sizing and deliberate mobile reflow rules.
- Kept FoodHub branding, Add Recipe, Import Recipe, AI Settings, primary navigation and Home cards inside the mobile content width.
- Restored Guided Planning and Recipe Discovery to the full available content width instead of a collapsed narrow column.
- Prevented mobile modals, planning controls and legacy extension surfaces from establishing a wider document.

### Improved

- Added a real Chromium mobile-layout regression test covering 320, 360, 375, 390, 393, 414 and 430 px viewport widths.
- The rendered test now checks document `scrollWidth`, horizontal offset, top-level element bounds, Guided Planning width and Recipe Discovery width after navigation and modal interactions.
- Removed the 0.14.2 `visualViewport` runtime script from the production page so iOS keyboard and WebView changes no longer recalculate the entire app width.

### Compatibility

- The `dinnerhub` add-on slug, repository name, persistent storage paths and existing Home Assistant identifiers remain unchanged.
- This corrective release does not migrate or modify recipe, planning, rating or shopping data.

## 0.14.2

### Fixed

- Released the follow-up iPhone/Home Assistant Ingress width correction as an installable Home Assistant patch version.
- Constrained FoodHub to the actual usable visual viewport width so the document cannot remain wider than the visible iPhone WebView.
- Reflowed the mobile header so Add Recipe and Import Recipe fit in two columns with AI Settings on a full-width row underneath.
- Re-constrained primary navigation, Home cards, Meal Plan, Guided Planning, Shopping, forms and modals after legacy extension injection.
- Added runtime width re-evaluation for resize, orientation and Visual Viewport changes, including stale horizontal-offset recovery.

### Compatibility

- The `dinnerhub` add-on slug, repository name, persistent storage paths and existing Home Assistant identifiers remain unchanged.
- This patch does not migrate or modify recipe, planning, rating or shopping data.

## 0.14.1

### Fixed

- Fixed document-level horizontal scrolling on mobile by removing legacy `100vw` shell constraints and constraining FoodHub layouts to the actual Home Assistant Ingress container width.
- Reflowed the mobile header, FoodHub branding, primary actions and navigation so controls remain visible without side-to-side page dragging.
- Constrained Home dashboard cards, Guided Planning, meal planning, AI dialogs and legacy extension surfaces to the available viewport width.
- Fixed Guided Planning and AI import surfaces using hard-coded light styling while FoodHub is in dark mode.
- Updated remaining user-facing legacy DinnerHub text in AI import/settings and legacy enhancement UI to FoodHub while retaining technical compatibility identifiers.

### Improved

- Added a dedicated corrective responsive/theme layer for narrow Home Assistant WebViews, including 320–430 px mobile widths.
- Improved mobile planning-length controls, modal sizing and AI source tabs so they reflow instead of increasing document width.
- Reused FoodHub theme variables across legacy planning and AI extension surfaces for consistent dark/light presentation.

### Compatibility

- The `dinnerhub` add-on slug, repository name, persistent storage paths and existing Home Assistant identifiers remain unchanged.
- This corrective release does not migrate or modify recipe, planning, rating or shopping data.

## 0.14.0

### Added

- Added authoritative per-serving recipe nutrition storage with calories, protein, carbohydrate, fat, saturated fat, sugar, fibre and sodium.
- Added versioned FoodHub capability, recipe nutrition and scheduled-dinner API support for HealthHub integration.
- Added a recipe nutrition editor in the FoodHub interface.
- Added the FoodHub / HealthHub v1 integration contract documentation.

### Changed

- Completed user-facing branding from DinnerHub to FoodHub while retaining the legacy `dinnerhub` add-on slug, repository name, storage path and existing Home Assistant identifiers for compatibility.
- Updated API, ingress and Home Assistant-facing branding to use FoodHub.

### Compatibility

- Existing data remains under `/data/dinnerhub/dinnerhub.db`.
- Existing `sensor.dinnerhub_*` entity identifiers and calendar UID prefixes remain unchanged.
- The GitHub repository remains `stunwill/dinnerhub-home-assistant`.

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
