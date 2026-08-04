# DinnerHub installation and usage

## Installation

1. In Home Assistant, open **Settings > Apps > App store**.
2. Open the menu in the top-right corner and select **Repositories**.
3. Add `https://github.com/stunwill/dinnerhub-home-assistant`.
4. Refresh the app store and select **DinnerHub**.
5. Select **Install**.
6. Start the app.
7. Enable **Start on boot**, **Watchdog** and **Show in sidebar**.

## Data storage

DinnerHub stores its database and internal backups beneath `/data/dinnerhub` inside the app container. Home Assistant includes `/data` in app backups, so recipes and meal plans are retained through standard Home Assistant backup and restore operations.

An app-specific public configuration directory is mapped read-write to `/config`. It is intended for future import, export and diagnostics files. DinnerHub does not map the main Home Assistant configuration directory.

## Current workflow

1. Open DinnerHub from the Home Assistant sidebar.
2. Select **Add recipe**.
3. Add the recipe name, category, protein, timing and ingredients.
4. Open **Meal plan**.
5. Select seven or fourteen days.
6. Choose one recipe or a special night for each date.

## Home Assistant integration status

The first development release exposes:

- `GET api/home-assistant/states`
- `GET api/calendar`
- `GET api/dashboard`

These endpoints provide stable data contracts for the custom integration and MQTT discovery layer planned for a later release. They do not yet create Home Assistant entities automatically.

## Health checks

- `GET api/health` confirms the service is running.
- `GET api/ready` confirms the database is queryable.
- Docker uses `api/health` for the container health check.

## Backup and restore

Use Home Assistant backups for normal protection. Before database migrations are introduced, DinnerHub will create a timestamped copy of `dinnerhub.db` in `/data/dinnerhub/backups`. Database migration and rollback safeguards are scheduled for v0.2.0.

## Troubleshooting

### The sidebar opens a blank page

Restart DinnerHub, then force-refresh the Home Assistant page. DinnerHub uses relative frontend paths so it remains compatible with Home Assistant Ingress.

### DinnerHub will not start

Check the DinnerHub app log. Confirm the app was rebuilt after a repository refresh and that port 8099 is not changed independently from `config.yaml`.

### Data is missing after reinstalling

Restore the Home Assistant backup that contains DinnerHub. Removing the app without retaining a backup can remove its `/data` volume.
