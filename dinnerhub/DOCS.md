# FoodHub installation and usage

## Installation

1. In Home Assistant, open **Settings > Apps > App store**.
2. Open the menu in the top-right corner and select **Repositories**.
3. Add `https://github.com/stunwill/dinnerhub-home-assistant`.
4. Refresh the app store and select **FoodHub**.
5. Select **Install**.
6. Start the app.
7. Enable **Start on boot**, **Watchdog** and **Show in sidebar**.

## Data storage

FoodHub stores its database and internal backups beneath `/data/dinnerhub` inside the app container. The legacy `dinnerhub` storage path is intentionally retained for compatibility with existing installations and backups. Home Assistant includes `/data` in app backups, so recipes and meal plans are retained through standard Home Assistant backup and restore operations.

An app-specific public configuration directory is mapped read-write to `/config`. It is intended for future import, export and diagnostics files. FoodHub does not map the main Home Assistant configuration directory.

## Mobile and Home Assistant ingress

FoodHub 0.15.1 deliberately optimises narrow mobile and Home Assistant ingress use while preserving the desktop interface.

- The mobile header is compact and keeps the main contextual action reachable.
- Primary mobile navigation stays close to the bottom edge and respects iPhone safe areas.
- Home and recipe cards use denser mobile spacing so important information appears sooner.
- Core Add/Edit/Detail dialogs become full-height mobile task views with sticky headings.
- Form controls use mobile-safe sizing to reduce iOS input zoom and keyboard disruption.
- Ingredient editing reflows into touch-friendly mobile rows rather than a cramped desktop grid.
- Meal Planner week controls and planned-meal actions are compact on narrow screens.
- Cooking Mode keeps large readable steps and sticky Previous/Next controls above the bottom safe area.
- iPad/tablet and mobile-landscape layouts receive separate responsive treatment.

FoodHub continues to use CSS containing-block sizing rather than JavaScript Visual Viewport width calculations. The application should not require document-level horizontal scrolling on supported mobile widths.

## Meal Planner

Open **Meal Planner** to organise Breakfast, Lunch and Dinner for the week.

- On phones and narrow Home Assistant WebViews, each day is stacked vertically with separate meal slots.
- On wider screens, FoodHub presents the full week as a seven-column planner.
- Select **+ Add meal** to choose an existing recipe or enter a custom meal such as Takeaway.
- Planned meals can be edited, moved by changing their date or meal type, duplicated or removed.
- Week navigation remains available with compact controls on mobile.
- The current day is highlighted.

Existing dinner-only records are migrated safely into Dinner slots. Dinner updates from the new planner are also mirrored to the established dinner-plan storage used by existing dashboard, Home Assistant, calendar and integration contracts.

## Add a recipe to the Meal Planner

Open a recipe and choose **Add to Meal Plan**. Select the date, meal type and serving count, then save it. A recipe does not need to be scheduled before it can be cooked.

## Cooking Mode

For recipes with cooking instructions, choose **Start Cooking** from the recipe or from a planned recipe meal.

Cooking Mode:

- shows one primary cooking step at a time;
- provides explicit **Previous** and **Next** controls;
- shows step progress;
- uses the selected serving count;
- reuses FoodHub's structured step-to-ingredient associations when available;
- falls back to the recipe ingredient list when a step has no explicit ingredient mapping;
- exposes an in-app timer when a structured step includes a timer duration;
- restores the active cooking step during the current browser session;
- keeps mobile controls above the iPhone safe area;
- finishes with a clear **Meal complete** state.

Timer and cooking progress are browser-session features. Background timer alerts are not guaranteed when the Home Assistant app or browser suspends the page.

## Home Assistant integration status

FoodHub exposes:

- `GET api/home-assistant/states`
- `GET api/calendar`
- `GET api/dashboard`
- `GET api/meal-planner`
- the existing versioned FoodHub integration API under `api/v1`

Legacy `sensor.dinnerhub_*` identifiers remain intentionally unchanged for compatibility.

## Health checks

- `GET api/health` confirms the service is running.
- `GET api/ready` confirms the database is queryable.
- Docker uses `api/health` for the container health check.

## Backup and restore

Use Home Assistant backups for normal protection. Existing data remains under `/data/dinnerhub`. FoodHub 0.15.1 does not introduce a data migration or require a reset.

## Troubleshooting

### The sidebar opens a blank page

Restart FoodHub, then force-refresh the Home Assistant page. FoodHub uses the existing Ingress-compatible frontend routing and legacy technical identifiers.

### The mobile layout appears stale after updating

Force-refresh FoodHub or restart the Home Assistant app WebView so the latest versioned responsive stylesheet is loaded.

### FoodHub will not start

Check the FoodHub app log. Confirm the app was rebuilt after a repository refresh and that the configured internal service remains consistent with the packaged app.

### Data is missing after reinstalling

Restore the Home Assistant backup that contains FoodHub. Removing the app without retaining a backup can remove its `/data` volume.
