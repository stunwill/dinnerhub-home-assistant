# DinnerHub Home Assistant integration

DinnerHub 0.4.0 includes a custom Home Assistant integration in `custom_components/dinnerhub`.

## Installation

### HACS custom repository

1. Open HACS in Home Assistant.
2. Open Integrations and choose Custom repositories.
3. Add `https://github.com/stunwill/dinnerhub-home-assistant` as an Integration repository.
4. Install DinnerHub.
5. Restart Home Assistant.
6. Open Settings, Devices & services, Add integration, then select DinnerHub.

The default API address is:

```text
http://d312fc48-dinnerhub:8099
```

## Entities

The integration creates:

- `sensor.dinnerhub_dinner_today`
- `sensor.dinnerhub_dinner_tomorrow`
- `sensor.dinnerhub_shopping_remaining`
- `sensor.dinnerhub_shopping_purchased`
- `sensor.dinnerhub_active_recipes`
- `calendar.dinnerhub_meal_plan`
- buttons for rebuilding the 7-day or 14-day shopping list
- a button for clearing purchased shopping items

All entities are grouped under one DinnerHub device and are marked unavailable if the app cannot be reached.

## Existing REST sensors

The earlier manually configured REST sensors can be removed after the native integration is installed and the replacement entities are confirmed. Do not remove them before confirming entity IDs in Developer Tools.
