"""Sensors for DinnerHub."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from homeassistant.components.sensor import SensorEntity, SensorEntityDescription
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .coordinator import DinnerHubCoordinator
from .entity import DinnerHubEntity


@dataclass(frozen=True, kw_only=True)
class DinnerHubSensorDescription(SensorEntityDescription):
    """Describe a DinnerHub sensor."""

    value_fn: Callable[[dict[str, Any]], Any]
    attributes_fn: Callable[[dict[str, Any]], dict[str, Any]] | None = None


def _meal(day: str, data: dict[str, Any]) -> dict[str, Any] | None:
    return data.get("dashboard", {}).get(day)


def _meal_name(day: str, data: dict[str, Any]) -> str:
    entry = _meal(day, data)
    return str(entry.get("title")) if entry else "Unplanned"


def _meal_attributes(day: str, data: dict[str, Any]) -> dict[str, Any]:
    entry = _meal(day, data)
    if not entry:
        return {"planned": False}
    meal = entry.get("meal") or {}
    return {
        "planned": True,
        "date": entry.get("meal_date"),
        "entry_type": entry.get("entry_type"),
        "status": entry.get("status"),
        "servings": entry.get("servings") or meal.get("servings"),
        "category": meal.get("category"),
        "cuisine": meal.get("cuisine"),
        "prep_minutes": meal.get("prep_minutes"),
        "cook_minutes": meal.get("cook_minutes"),
        "total_minutes": meal.get("total_minutes"),
        "image_url": meal.get("image_url"),
    }


SENSORS = (
    DinnerHubSensorDescription(
        key="dinner_today",
        translation_key="dinner_today",
        icon="mdi:silverware-fork-knife",
        value_fn=lambda data: _meal_name("today", data),
        attributes_fn=lambda data: _meal_attributes("today", data),
    ),
    DinnerHubSensorDescription(
        key="dinner_tomorrow",
        translation_key="dinner_tomorrow",
        icon="mdi:calendar-arrow-right",
        value_fn=lambda data: _meal_name("tomorrow", data),
        attributes_fn=lambda data: _meal_attributes("tomorrow", data),
    ),
    DinnerHubSensorDescription(
        key="shopping_remaining",
        translation_key="shopping_remaining",
        icon="mdi:cart-outline",
        native_unit_of_measurement="items",
        value_fn=lambda data: data.get("shopping", {}).get("unchecked", 0),
    ),
    DinnerHubSensorDescription(
        key="shopping_purchased",
        translation_key="shopping_purchased",
        icon="mdi:cart-check",
        native_unit_of_measurement="items",
        value_fn=lambda data: data.get("shopping", {}).get("checked", 0),
    ),
    DinnerHubSensorDescription(
        key="active_recipes",
        translation_key="active_recipes",
        icon="mdi:book-open-page-variant",
        native_unit_of_measurement="recipes",
        entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=lambda data: data.get("dashboard", {}).get("active_meals", 0),
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up DinnerHub sensors."""
    coordinator: DinnerHubCoordinator = entry.runtime_data
    async_add_entities(DinnerHubSensor(coordinator, description) for description in SENSORS)


class DinnerHubSensor(DinnerHubEntity, SensorEntity):
    """Representation of a DinnerHub sensor."""

    entity_description: DinnerHubSensorDescription

    def __init__(
        self,
        coordinator: DinnerHubCoordinator,
        description: DinnerHubSensorDescription,
    ) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = f"dinnerhub_{description.key}"

    @property
    def native_value(self) -> Any:
        return self.entity_description.value_fn(self.coordinator.data)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        if self.entity_description.attributes_fn is None:
            return None
        return self.entity_description.attributes_fn(self.coordinator.data)
