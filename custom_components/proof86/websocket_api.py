"""Authenticated WebSocket API for the 86Proof inventory card."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN
from .models import inventory_to_dict

WS_TYPE_SUBSCRIBE_INVENTORY = "proof86/inventory/subscribe"


@callback
def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Register the 86Proof WebSocket commands."""
    websocket_api.async_register_command(hass, websocket_subscribe_inventory)


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_SUBSCRIBE_INVENTORY,
        vol.Optional("entry_id"): cv.string,
    }
)
@websocket_api.async_response
async def websocket_subscribe_inventory(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Subscribe an authenticated frontend client to inventory snapshots."""
    entry = _resolve_entry(hass, msg.get("entry_id"))
    if entry is None:
        connection.send_error(
            msg["id"],
            websocket_api.ERR_NOT_FOUND,
            "86Proof config entry not found or not loaded",
        )
        return

    coordinator = entry.runtime_data.coordinator

    @callback
    def send_inventory() -> None:
        connection.send_message(
            websocket_api.event_message(
                msg["id"],
                {
                    "entry_id": entry.entry_id,
                    **inventory_to_dict(coordinator.data),
                },
            )
        )

    connection.subscriptions[msg["id"]] = coordinator.async_add_listener(send_inventory)
    connection.send_result(msg["id"])
    send_inventory()


def _resolve_entry(
    hass: HomeAssistant,
    entry_id: str | None,
) -> ConfigEntry[Any] | None:
    """Resolve one loaded 86Proof entry."""
    if entry_id:
        entry = hass.config_entries.async_get_entry(entry_id)
        if not _is_loaded_proof86_entry(entry):
            return None
        return entry

    entries = [
        entry
        for entry in hass.config_entries.async_entries(DOMAIN)
        if _is_loaded_proof86_entry(entry)
    ]
    return entries[0] if len(entries) == 1 else None


def _is_loaded_proof86_entry(entry: ConfigEntry | None) -> bool:
    """Return whether an entry is a loaded 86Proof entry."""
    return bool(
        entry and entry.domain == DOMAIN and entry.state is ConfigEntryState.LOADED
    )
