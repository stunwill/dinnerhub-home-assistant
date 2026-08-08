# Changelog

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

## 0.10.0

### Added

- Added the new green **DinnerHub by Stu** logo and fork-and-knife emblem based on the supplied brand reference.
- Added an in-app **AI settings** screen for OpenAI API configuration.
- Added secure server-side storage of the OpenAI API key with masked browser display.
- Added configurable OpenAI API base URL, recipe-analysis model and transcription model.
- Added a **Save & test** connection action for validating the configured API credentials.
- Added an **Import recipe** workflow for uploaded cooking videos up to 250 MB.
- Added direct-video-URL import with clear fallback guidance for Instagram and Facebook page links that block automated retrieval.
- Added FFmpeg-based audio and representative-frame extraction inside the DinnerHub container.
- Added OpenAI audio transcription and multimodal recipe analysis.
- Added AI extraction of recipe title, description, categories, cuisine, prep/cook times, servings, difficulty, ingredients, quantities and structured cooking steps.
- Added selection of a representative food frame as the proposed recipe image.
- Added a review-first AI draft screen with uncertainty warnings before any recipe is saved.
- Added creation of structured ingredient-linked cooking steps from an approved AI draft.

### Security and behaviour

- The complete API key is never returned to the frontend after saving.
- AI-generated recipes are never automatically committed to the recipe library; the user must review and explicitly create the recipe.
- When a video does not state or visibly support an exact quantity, DinnerHub asks the AI to return an unknown quantity and surface a warning rather than inventing one.

## 0.9.0

### Added

- Added persistent structured cooking steps linked explicitly to recipe ingredients.
- Added a structured-step editor with ingredient chips, step ordering controls and optional timers.
- Added API endpoints to read and save structured cooking steps.
- Added server-side rendering of scaled ingredient quantities inside cooking instructions.
- Added automatic legacy fallback for recipes that have not yet been converted to structured steps.
- Added an AI recipe import architecture document covering video uploads, supported source URLs, transcription, frame analysis, draft review and image extraction.

### Improved

- Cooking-step quantities no longer depend solely on matching ingredient names in free text.
- Linked ingredients continue to scale correctly when the serving count changes.
- Existing recipe instructions remain compatible and can be converted gradually by editing a recipe and selecting **Structure cooking steps**.
- Structured steps stay synchronised with the existing recipe instruction list for backward compatibility.

## 0.8.0

### Added

- Added a quantity-aware Cooking View to the recipe detail screen.
- Added numbered cooking step cards for easier use while preparing a meal.
- Added automatic ingredient quantity insertion into method steps when the ingredient name appears in the instruction.
- Added automatic refresh of in-step quantities when recipe servings are increased or decreased.
- Added guidance explaining that cooking-step quantities come from the structured ingredient list.

### Improved

- Recipe instructions now read more like practical cooking directions, for example `Brown 400 g chicken thigh` and `Add 2 tbsp tomato paste`.
- Existing saved instructions remain unchanged, so structured ingredient quantities remain the source of truth and serving scaling continues to work.
- Instructions that already contain an explicit quantity are left unchanged to avoid duplicated amounts.
- Steps without a recognisable ingredient remain unchanged rather than guessing an amount.

## 0.7.0

### Added

- Added a more complete visual plan builder for 3, 5, 7, 10 and 14 day planning windows.
- Added open-day cards with recipe images and direct Choose or Change actions.
- Added one-click assignment of suggested recipes to the next open day.
- Added searchable recipe discovery inside the planner with favourites and household score filters.
- Added repeat warnings when a meal has already appeared within the recent planning window.
- Added a clear-day action so planned meals can be removed directly from the visual planner.
- Added direct shopping-list generation from the active planning window.
- Added a faster searchable meal picker showing ratings and recent-use context.

### Improved

- Favourites and higher-rated recipes are prioritised when choosing meals.
- Planner cards now show meal duration, categories and recipe imagery where available.
- The planning workflow now keeps meal selection, discovery and shopping-list generation together on one screen.
- Desktop and mobile planner layouts have been improved for faster household use.

## 0.6.0

### Added

- Added a guided menu-plan builder with selectable 3, 5, 7, 10 and 14 day planning lengths.
- Added visual day slots with recipe images and direct Add or Change actions.
- Added suggested recipes ordered by favourites and household rating.
- Added separate meal scores for Stu, Kristy and Sienna.
- Added calculated household average scores out of 10.
- Added household-score badges on recipe cards and minimum-score filtering.
- Added a new DinnerHub by Stu brand treatment with a fork-and-knife emblem.

### Improved

- Increased the maximum page width to use more of the available browser window, similar to MediaHub.
- Improved desktop and mobile responsiveness for planning, ratings and recipe discovery.
- Preserved existing meals, plans, favourites and shopping data through additive database changes.

## 0.5.1

### Added

- Added recipe images to the Tonight and Tomorrow dashboard cards.
- Added readable image overlays and mobile styling.

## 0.5.0

### Added

- Added heart controls directly to recipe cards.
- Added favourite-first recipe sorting.
- Added a visual quick-filter panel inspired by guided menu-planning workflows.
- Added Favourites, ingredient, category and cuisine filter types.
- Added support for selecting up to two filters at once by default.
- Added an in-app recipe filter configuration screen.
- Added persistent filter settings stored in DinnerHub data storage.

### Improved

- Favourite recipes now remain grouped at the top of the meal library.
- Filter options can be added, renamed, enabled, disabled or removed without editing code.
- The maximum number of simultaneous filters can be configured from one to five.

## 0.4.2

### Fixed

- Fixed meal-plan dates resolving to the previous day during early morning hours in positive UTC offsets.
- Today, Tomorrow, meal assignment and shopping-list ranges now follow the browser's local calendar date.

## 0.4.1

### Fixed

- Fixed recipe editing when existing ingredient rows were replaced, which could be misreported as a duplicate meal name.
- Existing recipes can now be saved without changing their name.
- Recipe form validation errors are shown inside the open recipe modal.

### Added

- Added a pencil edit button to the top-right of every recipe card.

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
