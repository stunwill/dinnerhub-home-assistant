# Changelog

## 0.15.1

### Improved

- Added a focused mobile UX refinement layer for iPhone-sized screens and Home Assistant ingress.
- Reduced mobile header height and visual competition while keeping the primary Add Recipe action easy to reach.
- Added safe-area-aware sticky mobile navigation and stronger active-state feedback.
- Reduced vertical density on Home, recipe cards and planning rows.
- Improved mobile recipe detail, serving controls and ingredient editing for touch use.
- Converted core mobile modals into full-height task views with sticky headings and 16 px form inputs to avoid iOS input zoom.
- Refined Meal Planner week navigation, planned-meal actions and Cooking Mode controls for one-handed use.
- Added tablet and mobile-landscape responsive refinements.

### Compatibility

- The `dinnerhub` add-on slug, repository name, environment variables, persistent storage paths and existing Home Assistant identifiers remain unchanged.
- No recipe, Meal Planner, Cooking Mode or Shopping data migration is required.
- The 0.14.3 container-relative width strategy remains authoritative, without reintroducing JavaScript Visual Viewport sizing.

### Testing

- Existing rendered mobile overflow coverage remains active across 320, 360, 375, 390, 393, 414 and 430 px viewport widths.
- New mobile layout rules use responsive, container-relative sizing and iPhone safe-area insets.

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
