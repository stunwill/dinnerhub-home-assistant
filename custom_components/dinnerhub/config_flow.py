"""Config flow for DinnerHub."""

from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_HOST
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import DinnerHubApi, DinnerHubApiError
from .const import DEFAULT_HOST, DOMAIN


class DinnerHubConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for DinnerHub."""

    VERSION = 1

    async def async_step_user(self, user_input: dict | None = None) -> FlowResult:
        """Handle the initial step."""
        errors: dict[str, str] = {}
        if user_input is not None:
            host = str(user_input[CONF_HOST]).rstrip("/")
            try:
                health = await DinnerHubApi(async_get_clientsession(self.hass), host).health()
            except DinnerHubApiError:
                errors["base"] = "cannot_connect"
            else:
                await self.async_set_unique_id(f"dinnerhub-{host}")
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=str(health.get("service", "DinnerHub")),
                    data={CONF_HOST: host},
                )

        schema = vol.Schema({vol.Required(CONF_HOST, default=DEFAULT_HOST): str})
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)
