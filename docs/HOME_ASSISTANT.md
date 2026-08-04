# Home Assistant integration design

## Recommended implementation sequence

1. Keep the DinnerHub API as the source of truth.
2. Add a small custom integration configured through a UI config flow.
3. Have the integration poll `api/home-assistant/states` and `api/calendar` over the internal app network.
4. Expose `calendar.dinnerhub`, today, tomorrow, next dinner, plan status and shopping count entities.
5. Add services for plan assignment, completion, suggestions and shopping list operations.
6. Optionally publish the four core sensors through MQTT discovery when Mosquitto is available.

## Planned entities

- `sensor.dinnerhub_dinner_today`
- `sensor.dinnerhub_dinner_tomorrow`
- `sensor.dinnerhub_next_planned_dinner`
- `sensor.dinnerhub_meal_plan_status`
- `sensor.dinnerhub_shopping_list_count`
- `calendar.dinnerhub`

## Temporary REST example

Until the custom integration is delivered, advanced users can test the payload from within the DinnerHub app or through the internal app network. Direct external ports are intentionally disabled.

## Dashboard card example

After the sensors are available:

```yaml
type: vertical-stack
cards:
  - type: heading
    heading: DinnerHub
    icon: mdi:silverware-fork-knife
  - type: tile
    entity: sensor.dinnerhub_dinner_today
    name: Tonight's dinner
    tap_action:
      action: navigate
      navigation_path: /hassio/ingress/dinnerhub
  - type: tile
    entity: sensor.dinnerhub_dinner_tomorrow
    name: Tomorrow's dinner
  - type: entities
    entities:
      - entity: sensor.dinnerhub_meal_plan_status
      - entity: sensor.dinnerhub_shopping_list_count
```

## Calendar card example

The exact colour support depends on the calendar card being used. A dedicated `calendar.dinnerhub` entity lets the dashboard assign a distinct colour without modifying household calendars.

```yaml
type: calendar
initial_view: listWeek
entities:
  - calendar.household
  - calendar.dinnerhub
```

For a calendar card that supports entity colours:

```yaml
type: custom:calendar-card-pro
entities:
  - entity: calendar.household
    color: var(--primary-color)
  - entity: calendar.dinnerhub
    color: '#6f9b62'
days_to_show: 14
```

## Automation examples

```yaml
alias: DinnerHub - Tomorrow's dinner
triggers:
  - trigger: time
    at: '19:00:00'
actions:
  - action: notify.mobile_app_stus_iphone
    data:
      title: Tomorrow's dinner
      message: "{{ states('sensor.dinnerhub_dinner_tomorrow') }}"
mode: single
```

```yaml
alias: DinnerHub - Meal plan incomplete
triggers:
  - trigger: time
    at: '18:00:00'
conditions:
  - condition: state
    entity_id: sensor.dinnerhub_meal_plan_status
    state: incomplete
actions:
  - action: notify.mobile_app_stus_iphone
    data:
      title: DinnerHub needs attention
      message: Fewer than seven upcoming dinners are planned.
mode: single
```
