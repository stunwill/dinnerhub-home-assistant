"""Base entity for DinnerHub."""

from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import DinnerHubCoordinator


class DinnerHubEntity(CoordinatorEntity[DinnerHubCoordinator]):
    """Base DinnerHub coordinator entity."""

    _attr_has_entity_name = True

    def __init__(self, coordinator: DinnerHubCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, "dinnerhub")},
            name="DinnerHub",
            manufacturer="DinnerHub",
            model="Home Assistant Meal Planner",
            configuration_url=coordinator.api.host,
        )
