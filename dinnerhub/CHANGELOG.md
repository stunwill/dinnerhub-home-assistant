# Changelog

## Unreleased - FoodHub compatibility foundation

### Added

- Added the versioned `/api/v1/capabilities` integration endpoint for HealthHub connectivity and capability negotiation.
- Added the read-only `/api/v1/recipes/{meal_id}/summary` endpoint for stable recipe identity, serving count, image reference, archive state and revision timestamp.
- Added explicit nutrition availability metadata so incomplete FoodHub nutrition is never represented as zero calories.
- Added the FoodHub / HealthHub v1 integration contract documentation.

### Changed

- Changed user-facing add-on branding from DinnerHub to FoodHub while retaining the legacy `dinnerhub` add-on slug, repository name, storage path and existing Home Assistant identifiers for compatibility.
- Updated API and ingress messages to use the FoodHub brand.

### Compatibility

- No database migration is performed by this change.
- Existing data remains under `/data/dinnerhub/dinnerhub.db`.
- Existing `sensor.dinnerhub_*` entity identifiers and calendar UID prefixes remain unchanged.
- The GitHub repository remains `stunwill/dinnerhub-home-assistant`.

## 0.12.0

### Added

- Added **Improve with AI** to existing recipe detail views.
- Added conversational AI refinement for existing recipes using the same structured recipe schema as AI-created recipes.
- Added quick AI improvement prompts for faster, healthier, cheaper, kid-friendly, simpler and more flavourful recipe variations.
- Added a side-by-side comparison between the current saved recipe and the proposed AI version.
- Added a concise change summary covering serving, timing, ingredient, category, cuisine, difficulty and method changes.
- Added an explicit choice to update the existing recipe or save the AI result as a separate recipe variation.
- Added iterative follow-up prompts so an AI revision can be refined repeatedly before anything is saved.

### Improved

- Updating an existing recipe keeps its recipe ID, favourites, household scores and meal-plan history attached to the same recipe.
- Saving an AI result as a variation leaves the original recipe untouched and starts the new recipe without inherited ratings or favourite status.
- Existing recipe images, source URLs, dietary tags, allergens and substitutions are preserved when AI improvements are applied.
- AI changes remain review-first and do not modify DinnerHub data until the user explicitly chooses a save action.
- Added CI syntax validation for the DinnerHub 0.12 frontend extension.

## 0.11.0

### Added

- Added **Create recipe with AI** directly inside the Add Recipe modal.
- Added prompt-based recipe generation for requests such as `I want a recipe for banana bread`.
- Added starter recipe prompt suggestions for common meal ideas.
- Added a full on-screen AI recipe preview showing title, timings, servings, categories, ingredients and method before anything is saved.
- Added conversational recipe refinement so follow-up requests such as `make it less sweet`, `use 3 bananas`, `make it dairy free` or `scale it to 8 serves` regenerate the complete draft while preserving unaffected details.
- Added structured ingredient links to AI-generated cooking steps so the quantity-aware cooking view continues to work after saving.
- Added friendly OpenAI credit/quota error handling for prompt-based recipe creation.
- Added backend tests for the new AI recipe-generation routes.

### Fixed

- Fixed the DinnerHub logo failing to load through Home Assistant Ingress by rendering the branded fork-and-knife logo inline instead of relying on a root-relative image URL.

### Improved

- AI-generated cooking instructions explicitly include ingredient quantities in the method where ingredients are used.
- AI recipes remain review-first and are only written to the DinnerHub library after selecting **Create this recipe**.

## 0.10.1

### Added

- Added `yt-dlp` social-video extraction for Instagram, Facebook and `fb.watch` recipe links.
- Added optional Netscape-format social cookies support at `/data/dinnerhub/social-cookies.txt` for posts requiring an authenticated session.

### Improved

- Social post URLs are no longer treated as direct MP4 files.
- DinnerHub now returns clearer authentication guidance when Meta blocks anonymous video retrieval.
- Manual video upload remains available as the reliable fallback.
