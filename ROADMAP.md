# FoodHub Roadmap

FoodHub is the current user-facing product name. The repository, Home Assistant slug, storage path and existing integration identifiers retain the legacy `dinnerhub` name for compatibility.

## v0.15.1 - Mobile UX Optimisation

Status: In development

### Mobile UX
- [x] Reduce mobile header height and competing primary actions.
- [x] Add safe-area-aware sticky mobile navigation.
- [x] Reduce Home, recipe-card and planning-row vertical density.
- [x] Improve mobile recipe detail, serving controls and ingredient editing.
- [x] Convert core mobile dialogs to full-height task surfaces with sticky headings.
- [x] Refine Meal Planner week controls and planned-meal actions for narrow screens.
- [x] Refine Cooking Mode for one-handed use and iPhone safe areas.
- [x] Add tablet and mobile-landscape responsive refinements.

### Compatibility
- [x] Keep the container-relative responsive strategy introduced by the 0.14.x corrective releases.
- [x] Do not restore JavaScript Visual Viewport width calculations.
- [x] Preserve legacy repository, add-on, storage and Home Assistant technical identifiers.
- [x] Do not migrate recipe, planner, cooking or shopping data.

### Testing
- [x] Preserve rendered 320–430 px mobile overflow regression coverage.
- [ ] Verify full CI on the release Pull Request.

## v0.15.0 - Meal Planner & Cooking Mode

Status: Released

### Features
- [x] Add persistent Breakfast, Lunch and Dinner planning slots.
- [x] Support recipe-backed and custom planned meals.
- [x] Support edit, move, duplicate and remove planner actions.
- [x] Add recipe-to-planner scheduling.
- [x] Add step-by-step Cooking Mode using existing structured cooking data and serving scaling.
- [x] Preserve active Cooking Mode progress for the browser session.

### Mobile UX
- [x] Use stacked day cards on narrow mobile and Home Assistant Ingress viewports.
- [x] Retain an efficient seven-day overview on wider screens.
- [x] Keep planner and cooking surfaces inside the available viewport without document-level horizontal overflow.

### Compatibility
- [x] Preserve legacy dinner plan data during upgrade.
- [x] Keep new Dinner changes synchronized with existing dashboard, Home Assistant, calendar and HealthHub scheduled-dinner contracts.
- [x] Preserve legacy repository, add-on, storage and Home Assistant identifiers.

### Testing
- [x] Add backend Meal Planner lifecycle and validation tests.
- [x] Keep existing rendered mobile layout regression coverage active.

## v0.14.0 - Nutrition & HealthHub Handoff

Status: Released

### Features
- [x] Store recipe nutrition per serving.
- [x] Distinguish unavailable nutrition from true zero values.
- [x] Expose FoodHub capability and recipe-summary contracts for HealthHub.
- [x] Expose scheduled dinners through the versioned v1 API.

### Home Assistant
- [x] Preserve the existing `dinnerhub` technical identity while using FoodHub branding.
- [x] Keep health, readiness and version endpoints available for operational checks.

### Testing
- [x] Validate backend behaviour, frontend build, Home Assistant metadata and container build in CI.

## Next Feature Release - Recipe Capture & Import Improvements

Status: Planned

### Features
- [ ] Improve recipe capture from uploaded images where supported by the existing AI import architecture.
- [ ] Support multiple-photo recipe extraction with explicit user review before saving.
- [ ] Improve video recipe extraction and review workflows without bypassing source-access restrictions.
- [ ] Keep extracted ingredients and cooking steps structured for shopping and serving-scale use.

### Mobile UX
- [ ] Continue reducing Home Assistant mobile WebView friction in recipe import and editing flows.
- [ ] Ensure image, multi-image and video capture workflows remain usable on phones and tablets.

### Testing
- [ ] Add regression coverage for supported recipe-capture sources and review-first save behaviour.

## Future

### Recipe Management
- Continue improving recipe editing, duplication, archive/restore and structured cooking workflows where gaps remain.

### Shopping Lists
- Extend shopping-list handoff and integration options where they add value without duplicating existing delivered shopping functionality.

### Food Library & Product Data
- Evaluate reusable food-library, barcode and import capabilities only where they fit FoodHub's responsibilities and do not duplicate HealthHub ownership.

### Home Assistant Integration
- Continue strengthening Home Assistant integration, diagnostics and upgrade compatibility while retaining legacy technical identifiers until a documented migration exists.
