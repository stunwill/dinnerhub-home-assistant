# DinnerHub API design

The current implementation exposes the core foundation endpoints. Later endpoints are reserved so clients can evolve without large route changes.

## Implemented foundation

| Method | Path | Purpose | Authentication |
|---|---|---|---|
| GET | `/api/health` | Liveness and version | Ingress or local container |
| GET | `/api/ready` | Database readiness | Ingress or local container |
| GET | `/api/version` | Installed version | Ingress |
| GET | `/api/settings` | Effective app options | Ingress |
| GET | `/api/meals` | Search and filter meals | Household user |
| POST | `/api/meals` | Create a recipe | Household user, admin policy later |
| GET | `/api/meals/{id}` | Retrieve full recipe | Household user |
| PUT | `/api/meals/{id}` | Replace recipe data | Household user, admin policy later |
| DELETE | `/api/meals/{id}` | Archive recipe | Administrator later |
| POST | `/api/meals/{id}/restore` | Restore recipe | Administrator later |
| GET | `/api/meal-plan` | Read a date window | Household user |
| PUT | `/api/meal-plan/{date}` | Assign or replace dinner | Household user |
| DELETE | `/api/meal-plan/{date}` | Remove planned dinner | Household user |
| POST | `/api/meal-plan/{date}/complete` | Mark prepared | Household user |
| GET | `/api/dashboard` | Household summary | Household user |
| GET | `/api/home-assistant/states` | Sensor payload contract | Home Assistant adapter |
| GET | `/api/calendar` | Calendar event contract | Home Assistant adapter |
| GET | `/api/audit` | Recent audit events | Administrator later |

## Planned endpoint groups

- `/api/ingredients`
- `/api/filters`
- `/api/meal-suggestions`
- `/api/meal-history`
- `/api/shopping-lists`
- `/api/pantry-items`
- `/api/household-members`
- `/api/preferences`
- `/api/reports`
- `/api/import`
- `/api/export`
- `/api/home-assistant/services`

## Error body

FastAPI validation errors use the standard `detail` array. Application errors use:

```json
{
  "detail": "A meal with this name already exists"
}
```

A future stable error envelope will add `code`, `message`, `field_errors`, `trace_id` and `retryable` without removing `detail` during the deprecation period.
