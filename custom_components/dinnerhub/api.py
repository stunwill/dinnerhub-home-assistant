"""Local API client for DinnerHub."""

from __future__ import annotations

from datetime import date
from typing import Any

from aiohttp import ClientError, ClientSession


class DinnerHubApiError(Exception):
    """Raised when DinnerHub cannot be reached or returns invalid data."""


class DinnerHubApi:
    """Small async client for the DinnerHub app API."""

    def __init__(self, session: ClientSession, host: str) -> None:
        self._session = session
        self.host = host.rstrip("/")

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            async with self._session.request(
                method,
                f"{self.host}{path}",
                timeout=15,
                **kwargs,
            ) as response:
                response.raise_for_status()
                if response.status == 204:
                    return None
                return await response.json()
        except (ClientError, TimeoutError, ValueError) as err:
            raise DinnerHubApiError(str(err)) from err

    async def health(self) -> dict[str, Any]:
        return await self._request("GET", "/api/health")

    async def dashboard(self) -> dict[str, Any]:
        return await self._request("GET", "/api/dashboard?days=14")

    async def meal_plan(self, start: date, days: int = 31) -> list[dict[str, Any]]:
        return await self._request("GET", f"/api/meal-plan?start={start.isoformat()}&days={days}")

    async def shopping_summary(self) -> dict[str, Any]:
        return await self._request("GET", "/api/shopping/summary")

    async def generate_shopping(self, days: int = 7) -> dict[str, Any]:
        return await self._request("POST", f"/api/shopping/generate?days={days}&preserve_manual=true")

    async def clear_checked(self) -> dict[str, Any]:
        return await self._request("POST", "/api/shopping/clear-checked")
