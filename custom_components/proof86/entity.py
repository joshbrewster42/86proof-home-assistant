"""Base entities for the 86Proof integration."""

from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, MANUFACTURER, MODEL
from .coordinator import Proof86Coordinator


class Proof86Entity(CoordinatorEntity[Proof86Coordinator]):
    """Base entity for a shared 86Proof bar."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: Proof86Coordinator,
        *,
        bar_id: str,
        bar_name: str,
    ) -> None:
        """Initialize the entity."""
        super().__init__(coordinator)
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, bar_id)},
            manufacturer=MANUFACTURER,
            model=MODEL,
            name=bar_name,
        )
