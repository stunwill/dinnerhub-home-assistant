# FoodHub

**Plan food. Share dinner. Shop smarter.**

FoodHub is the user-facing name for the existing DinnerHub Home Assistant application. It remains a self-hosted household meal planner, recipe manager and shopping-list app designed for Home Assistant OS, Home Assistant Ingress and persistent local storage.

## Compatibility note

The legacy technical identifier `dinnerhub` is intentionally retained for the add-on slug, repository name, persistent `/data/dinnerhub` storage path, Home Assistant entity IDs and other installed-system references. This preserves existing installations and data while the product branding uses FoodHub. Do not rename these technical identifiers without a documented migration and backup/restore plan.

## Current status

The current feature application version is **0.15.0**.

This repository contains:

- Home Assistant app packaging and Ingress support
- Responsive React and TypeScript interface
- FastAPI and SQLAlchemy backend
- Persistent SQLite storage in `/data/dinnerhub`
- Meal and structured ingredient management
- Weekly Breakfast, Lunch and Dinner planning
- Recipe-backed and custom planned meals
- Step-by-step Cooking Mode with serving-aware structured steps and optional timers
- Today and tomorrow dinner dashboard summaries
- Shopping-list functionality
- AI-assisted recipe capture and improvement workflows
- Recipe nutrition and HealthHub integration contracts
- Health, readiness and version endpoints
- Native Home Assistant integration support
- CI and release workflow foundations

## Meal Planner and Cooking Mode

FoodHub 0.15.0 adds a first-class weekly Meal Planner. On phones and narrow Home Assistant WebViews, the week is presented as stacked day cards with Breakfast, Lunch and Dinner slots. Wider screens use a seven-column weekly overview. Planned meals can reference an existing recipe or a custom meal, with editing, moving, duplication and removal supported.

Recipes can be added to the planner from recipe workflows. Recipe-backed planned meals can launch Cooking Mode directly. Cooking Mode presents one structured recipe step at a time, preserves the active step for the browser session, respects the selected serving count, uses FoodHub's structured ingredient associations where available, and exposes optional recipe-step timers.

Existing dinner-only integrations remain compatible. FoodHub safely copies legacy dinner plans into the new Dinner slots, and Dinner updates from the new planner are mirrored to the established dinner-plan table used by the dashboard, Home Assistant states, calendar and versioned scheduled-dinner API.

## Mobile and Home Assistant Ingress

FoodHub is designed to fit the actual Home Assistant Ingress containing block rather than setting the application width from `100vw` or JavaScript Visual Viewport calculations. Mobile layouts deliberately reflow FoodHub branding, primary actions, navigation, dashboard cards, Meal Planner, Cooking Mode, Guided Planning, Recipe Discovery and AI dialogs so normal screens do not require document-level horizontal scrolling.

The rendered Chromium regression test covers representative 320–430 px mobile widths. It checks the real document `scrollWidth`, horizontal position and element bounding boxes after navigation and modal interactions so responsive regressions are detected by CI rather than by CSS-source inspection alone.

Light and dark modes share the same FoodHub theme variables across the core interface and legacy extension surfaces.

## DevHub metadata

DevHub-compatible repository metadata is maintained in these locations:

- `ROADMAP.md` is the canonical repository roadmap and current/next phase source.
- `CHANGELOG.md` is the canonical root release-history source for repository discovery.
- `dinnerhub/CHANGELOG.md` contains concise Home Assistant app-facing release notes and preserved detailed historical notes.
- `dinnerhub/config.yaml` is the authoritative Home Assistant app version source.
- `dinnerhub/frontend/package.json` carries the same application version for frontend discovery.
- `dinnerhub/app/main.py` exposes the same version through `/api/health`, `/api/ready` and `/api/version` when no container build version overrides it.
- `dinnerhub/Dockerfile` receives the same version through the Home Assistant build argument.
- GitHub tags/releases, when published, should use the same semantic version.

CI checks these metadata files and version sources for consistency so future releases do not silently drift.

## Install in Home Assistant

1. Open **Settings > Apps > App store**.
2. Open the app store menu and select **Repositories**.
3. Add `https://github.com/stunwill/dinnerhub-home-assistant`.
4. Install **FoodHub**. Existing DinnerHub installations keep the same technical add-on identity.
5. Start FoodHub and enable **Show in sidebar**.

See [`dinnerhub/DOCS.md`](dinnerhub/DOCS.md) for full instructions and [`docs/foodhub-healthhub-api-v1.md`](docs/foodhub-healthhub-api-v1.md) for the integration contract.

## Repository layout

```text
.
├── .github/workflows/
├── CHANGELOG.md
├── ROADMAP.md
├── dinnerhub/              # legacy technical directory retained for compatibility
│   ├── app/
│   ├── frontend/
│   ├── tests/
│   ├── config.yaml
│   ├── Dockerfile
│   ├── run.sh
│   ├── DOCS.md
│   └── CHANGELOG.md
├── docs/
├── repository.yaml
└── README.md
```

## Architecture decisions

FoodHub uses Home Assistant Ingress as the access boundary, FastAPI for the local API, React for the interface and SQLite for reliable local persistence. HealthHub is a separate application and datastore. It integrates with FoodHub through the versioned API only, never by reading the FoodHub database directly.

Current Home Assistant app guidance no longer uses `build.yaml`. The Docker base image and labels are declared directly in `Dockerfile`.

## Development

Backend:

```bash
cd dinnerhub
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
DINNERHUB_DATA_DIR=/tmp/dinnerhub-data uvicorn app.main_v7:app --reload --port 8099
```

Frontend:

```bash
cd dinnerhub/frontend
npm install
npm run dev
```

Tests:

```bash
cd dinnerhub
pytest
```
