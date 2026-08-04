# DinnerHub

**Plan dinner. Shop smarter. Eat better.**

DinnerHub is a self-hosted meal planner, recipe manager and shopping list app for Home Assistant. It is designed for Home Assistant OS, Home Assistant Ingress and persistent local storage on devices such as a Raspberry Pi 5.

## Current status

This repository contains the first DinnerHub development foundation:

- Home Assistant app packaging and Ingress support
- Responsive React and TypeScript interface
- FastAPI and SQLAlchemy backend
- Persistent SQLite storage in `/data/dinnerhub`
- Meal and structured ingredient management
- Seven-day and fourteen-day meal planning
- Today and tomorrow dashboard summaries
- Audit events for important changes
- Health, readiness and version endpoints
- Initial Home Assistant REST and calendar payloads
- CI and release workflow foundations

The current version is an early development build. MQTT discovery, a dedicated Home Assistant integration, shopping lists, suggestions and advanced household roles are scheduled for later releases.

## Install in Home Assistant

1. Open **Settings > Apps > App store**.
2. Open the app store menu and select **Repositories**.
3. Add `https://github.com/stunwill/dinnerhub-home-assistant`.
4. Install **DinnerHub**.
5. Start DinnerHub and enable **Show in sidebar**.

See [`dinnerhub/DOCS.md`](dinnerhub/DOCS.md) for full instructions.

## Repository layout

```text
.
├── .github/workflows/
├── dinnerhub/
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

DinnerHub uses Home Assistant Ingress for authentication and user identity, FastAPI for the local API, React for the interface and SQLite for reliable local persistence. The initial Home Assistant integration surface is REST-based. MQTT discovery and a dedicated custom integration will be added after the core data model stabilises.

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
