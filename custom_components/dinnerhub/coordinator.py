"""DinnerHub data update coordinator."""

from __future__ import annotations

from datetime import date
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import DinnerHubApi, DinnerHubApiError
from .const import DOMAIN, SCAN_INTERVAL


class DinnerHubCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinate DinnerHub API updates."""

    def __init__(self, hass: HomeAssistant, api: DinnerHubApi) -> None:
        super().__init__(
            hass,
            logger=__import__("logging").getLogger(__name__),
            name=DOMAIN,
            update_interval=SCAN_INTERVAL,
        )
        self.api = api

    async def _async_update_data(self) -> dict[str, Any]:
        try:
            dashboard = await self.api.dashboard()
            shopping = await self.api.shopping_summary()
            plan = await self.api.meal_plan(date.today(), 31)
        except DinnerHubApiError as err:
            raise UpdateFailed(f"Unable to update DinnerHub: {err}") from err
        return {"dashboard": dashboard, "shopping": shopping, "plan": plan}
