# Changelog

This root changelog is the canonical DevHub-discoverable release history for FoodHub. The Home Assistant-facing changelog remains at `dinnerhub/CHANGELOG.md`.

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

### Added
- Added supported social-video extraction with authenticated-cookie fallback guidance.

## Earlier releases

Earlier release details remain preserved in `dinnerhub/CHANGELOG.md` and repository pull-request history. This root file intentionally does not invent or reconstruct entries that are not reliably documented.

## Release publication note

The repository currently has no published GitHub Releases. Version `0.14.0` is established by the merged FoodHub 0.14.0 release work and Home Assistant app metadata. Future published tags/releases should use the same semantic version as the application metadata.
