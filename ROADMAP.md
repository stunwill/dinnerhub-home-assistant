# FoodHub Roadmap

FoodHub is the current user-facing product name. The repository, Home Assistant slug, storage path and existing integration identifiers retain the legacy `dinnerhub` name for compatibility.

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

## Next Release - Recipe Capture & Import Improvements

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
