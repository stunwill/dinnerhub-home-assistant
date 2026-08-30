# Changelog

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

- Fixed the Add Recipe modal becoming trapped or effectively frozen in the Home Assistant iOS WebView after scrolling, opening the keyboard or returning to the app.
- Removed nested mobile scrolling by making the full-screen modal backdrop the single vertical scroll container on phones and tablets.
- Added Visual Viewport tracking so the modal follows the usable iPhone viewport while the software keyboard opens and closes.
- Added defensive recovery of stale page scroll-lock styles after a modal closes or the Home Assistant app resumes.
- Prevented iOS input zoom by ensuring recipe form controls use a 16px minimum font size on mobile.
- Improved file-input sizing so the meal-image control cannot force the recipe modal wider than the phone viewport.

### Added

- Added automatic local draft protection while creating a new recipe.
- Added an **Unfinished recipe found** recovery prompt when a previously interrupted Add Recipe session exists.
- Added Restore and Discard actions for recovered drafts.
- Added automatic restoration of standard recipe fields, categories and ingredient rows.
- Added a small draft-save status beside the recipe form actions.

### Improved

- Recipe modal headings remain visible while scrolling on mobile.
- Save and Cancel controls remain reachable through a sticky mobile action bar with iPhone safe-area spacing.
- Focused fields automatically scroll back into view when the iPhone keyboard obscures them.
- Draft data is cleared only after a successful recipe form close following submission, while interrupted sessions remain recoverable.

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
- AI changes remain review-first and do not modify legacy data until the user explicitly chooses a save action.
- Added CI syntax validation for the 0.12 frontend extension.

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

- Fixed the legacy logo failing to load through Home Assistant Ingress by rendering the branded fork-and-knife logo inline instead of relying on a root-relative image URL.

### Improved

- AI-generated cooking instructions explicitly include ingredient quantities in the method where ingredients are used.
- AI recipes remain review-first and are only written to the FoodHub library after selecting **Create this recipe**.

## 0.10.1

### Added

- Added `yt-dlp` social-video extraction for Instagram, Facebook and `fb.watch` recipe links.
- Added optional Netscape-format social cookies support at `/data/dinnerhub/social-cookies.txt` for posts requiring an authenticated session.

### Improved

- Social post URLs are no longer treated as direct MP4 files.
- FoodHub now returns clearer authentication guidance when Meta blocks anonymous video retrieval.
- Manual video upload remains available as the reliable fallback.
