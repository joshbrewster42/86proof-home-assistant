"""The 86Proof Home Assistant integration."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import Proof86ApiClient
from .const import CONF_REFRESH_TOKEN, PLATFORMS
from .coordinator import Proof86Coordinator
from .frontend import async_register_frontend
from .websocket_api import async_register_websocket_commands


@dataclass(slots=True)
class Proof86RuntimeData:
    """Runtime data for an 86Proof config entry."""

    client: Proof86ApiClient
    coordinator: Proof86Coordinator


type Proof86ConfigEntry = ConfigEntry[Proof86RuntimeData]


async def async_setup(
    hass: HomeAssistant,
    config: dict[str, Any],
) -> bool:
    """Set up shared 86Proof frontend resources and APIs."""
    await async_register_frontend(hass)
    async_register_websocket_commands(hass)
    return True


async def async_setup_entry(
    hass: HomeAssistant,
    entry: Proof86ConfigEntry,
) -> bool:
    """Set up 86Proof from a config entry."""
    client = Proof86ApiClient(
        async_get_clientsession(hass),
        refresh_token=entry.data[CONF_REFRESH_TOKEN],
    )
    coordinator = Proof86Coordinator(hass, entry, client)
    await coordinator.async_config_entry_first_refresh()

    entry.runtime_data = Proof86RuntimeData(
        client=client,
        coordinator=coordinator,
    )
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(
    hass: HomeAssistant,
    entry: Proof86ConfigEntry,
) -> bool:
    """Unload an 86Proof config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
