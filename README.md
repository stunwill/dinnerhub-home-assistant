# FoodHub

**Plan food. Share dinner. Shop smarter.**

FoodHub is the new user-facing name for the existing DinnerHub Home Assistant application. It remains a self-hosted household meal planner, recipe manager and shopping-list app designed for Home Assistant OS, Home Assistant Ingress and persistent local storage on devices such as a Raspberry Pi 5.

## Compatibility note

This release deliberately retains the legacy technical identifier `dinnerhub` for the add-on slug, repository name, persistent `/data/dinnerhub` storage path, Home Assistant entity IDs and other installed-system references. This preserves existing installations and data while the product branding moves to FoodHub. Do not rename these technical identifiers without a documented migration and backup/restore plan.

## Current status

This repository contains the FoodHub development foundation:

- Home Assistant app packaging and Ingress support
- Responsive React and TypeScript interface
- FastAPI and SQLAlchemy backend
- Persistent SQLite storage in `/data/dinnerhub`
- Meal and structured ingredient management
- Seven-day and fourteen-day dinner planning
- Today and tomorrow dashboard summaries
- Audit events for important changes
- Health, readiness and version endpoints
- Initial Home Assistant REST and calendar payloads
- Versioned FoodHub v1 capability and recipe-summary contract for HealthHub
- CI and release workflow foundations

FoodHub does not yet publish authoritative recipe nutrition. The v1 contract reports nutrition availability explicitly so HealthHub never treats missing nutrition as zero calories.

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
DINNERHUB_DATA_DIR=/tmp/dinnerhub-data uvicorn app.main:app --reload --port 8099
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
