"""Calendar platform for DinnerHub."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from homeassistant.components.calendar import CalendarEntity, CalendarEvent
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .coordinator import DinnerHubCoordinator
from .entity import DinnerHubEntity


def _calendar_event(entry: dict[str, Any]) -> CalendarEvent:
    event_date = date.fromisoformat(str(entry["meal_date"]))
    meal = entry.get("meal") or {}
    description_parts = [
        meal.get("description"),
        f"Servings: {entry.get('servings') or meal.get('servings')}" if (entry.get("servings") or meal.get("servings")) else None,
        f"Total time: {meal.get('total_minutes')} minutes" if meal.get("total_minutes") is not None else None,
    ]
    return CalendarEvent(
        summary=str(entry.get("title") or "Dinner"),
        start=event_date,
        end=event_date + timedelta(days=1),
        description="\n".join(part for part in description_parts if part),
    )


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the DinnerHub calendar."""
    coordinator: DinnerHubCoordinator = entry.runtime_data
    async_add_entities([DinnerHubCalendar(coordinator)])


class DinnerHubCalendar(DinnerHubEntity, CalendarEntity):
    """DinnerHub meal-plan calendar."""

    _attr_name = "Meal plan"
    _attr_icon = "mdi:calendar-silverware"
    _attr_unique_id = "dinnerhub_meal_plan"

    @property
    def event(self) -> CalendarEvent | None:
        today = date.today()
        for entry in self.coordinator.data.get("plan", []):
            try:
                if date.fromisoformat(str(entry["meal_date"])) >= today:
                    return _calendar_event(entry)
            except (KeyError, ValueError):
                continue
        return None

    async def async_get_events(
        self,
        hass: HomeAssistant,
        start_date: datetime,
        end_date: datetime,
    ) -> list[CalendarEvent]:
        """Return DinnerHub meal-plan events in a date range."""
        events: list[CalendarEvent] = []
        for entry in self.coordinator.data.get("plan", []):
            try:
                event_date = date.fromisoformat(str(entry["meal_date"]))
            except (KeyError, ValueError):
                continue
            if start_date.date() <= event_date < end_date.date():
                events.append(_calendar_event(entry))
        return events
