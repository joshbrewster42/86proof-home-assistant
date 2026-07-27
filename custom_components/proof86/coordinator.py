"""Data update coordinator for the 86Proof integration."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import (
    Proof86ApiClient,
    Proof86CannotConnectError,
    Proof86InvalidAuthError,
)
from .const import (
    CONF_BAR_ID,
    CONF_REFRESH_TOKEN,
    DEFAULT_UPDATE_INTERVAL,
    DOMAIN,
    LOGGER,
)
from .models import Inventory


class Proof86Coordinator(DataUpdateCoordinator[Inventory]):
    """Coordinate shared-bar inventory updates."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        client: Proof86ApiClient,
    ) -> None:
        """Initialize the coordinator."""
        super().__init__(
            hass,
            LOGGER,
            config_entry=entry,
            name=DOMAIN,
            update_interval=DEFAULT_UPDATE_INTERVAL,
            always_update=False,
        )
        self._entry = entry
        self._client = client

    async def _async_update_data(self) -> Inventory:
        """Fetch a complete inventory snapshot."""
        try:
            inventory = await self._client.async_get_inventory(
                self._entry.data[CONF_BAR_ID]
            )
        except Proof86InvalidAuthError as err:
            raise ConfigEntryAuthFailed(
                "86Proof authorization is no longer valid"
            ) from err
        except Proof86CannotConnectError as err:
            raise UpdateFailed(f"Error communicating with 86Proof: {err}") from err

        refresh_token = self._client.refresh_token
        if refresh_token and refresh_token != self._entry.data[CONF_REFRESH_TOKEN]:
            self.hass.config_entries.async_update_entry(
                self._entry,
                data={**self._entry.data, CONF_REFRESH_TOKEN: refresh_token},
            )
        return inventory
