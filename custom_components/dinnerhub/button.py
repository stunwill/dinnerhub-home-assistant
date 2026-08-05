"""Buttons for DinnerHub."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Awaitable, Callable

from homeassistant.components.button import ButtonEntity, ButtonEntityDescription
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .coordinator import DinnerHubCoordinator
from .entity import DinnerHubEntity


@dataclass(frozen=True, kw_only=True)
class DinnerHubButtonDescription(ButtonEntityDescription):
    """Describe a DinnerHub button."""

    action: Callable[[DinnerHubCoordinator], Awaitable[object]]


BUTTONS = (
    DinnerHubButtonDescription(
        key="generate_shopping_7_days",
        translation_key="generate_shopping_7_days",
        icon="mdi:cart-plus",
        action=lambda coordinator: coordinator.api.generate_shopping(7),
    ),
    DinnerHubButtonDescription(
        key="generate_shopping_14_days",
        translation_key="generate_shopping_14_days",
        icon="mdi:cart-arrow-down",
        action=lambda coordinator: coordinator.api.generate_shopping(14),
    ),
    DinnerHubButtonDescription(
        key="clear_purchased",
        translation_key="clear_purchased",
        icon="mdi:cart-remove",
        action=lambda coordinator: coordinator.api.clear_checked(),
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up DinnerHub buttons."""
    coordinator: DinnerHubCoordinator = entry.runtime_data
    async_add_entities(DinnerHubButton(coordinator, description) for description in BUTTONS)


class DinnerHubButton(DinnerHubEntity, ButtonEntity):
    """Representation of a DinnerHub action button."""

    entity_description: DinnerHubButtonDescription

    def __init__(
        self,
        coordinator: DinnerHubCoordinator,
        description: DinnerHubButtonDescription,
    ) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = f"dinnerhub_{description.key}"

    async def async_press(self) -> None:
        await self.entity_description.action(self.coordinator)
        await self.coordinator.async_request_refresh()
