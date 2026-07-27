"""Diagnostics support for the 86Proof integration."""

from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.core import HomeAssistant

from . import Proof86ConfigEntry
from .const import (
    CONF_INSTALLATION_ID,
    CONF_REFRESH_TOKEN,
    CONF_VIEWER_UID,
)

TO_REDACT = {
    CONF_INSTALLATION_ID,
    CONF_REFRESH_TOKEN,
    CONF_VIEWER_UID,
}


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant,
    entry: Proof86ConfigEntry,
) -> dict[str, Any]:
    """Return privacy-conscious diagnostics for a config entry."""
    coordinator = entry.runtime_data.coordinator
    inventory = coordinator.data
    return {
        "config_entry": async_redact_data(dict(entry.data), TO_REDACT),
        "coordinator": {
            "last_update_success": coordinator.last_update_success,
            "last_exception": str(coordinator.last_exception)
            if coordinator.last_exception
            else None,
        },
        "inventory_summary": {
            "bottle_count": inventory.bottle_count,
            "empty_bottle_count": inventory.empty_bottle_count,
            "low_stock_bottle_count": inventory.low_stock_bottle_count,
            "category_count": inventory.category_count,
            "fetched_at": inventory.fetched_at.isoformat(),
        },
    }
