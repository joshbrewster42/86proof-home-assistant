"""Sensor platform for the 86Proof integration."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from homeassistant.components.sensor import (
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.helpers.typing import StateType

from . import Proof86ConfigEntry
from .const import CONF_BAR_ID, CONF_BAR_NAME
from .coordinator import Proof86Coordinator
from .entity import Proof86Entity
from .models import Inventory


@dataclass(frozen=True, kw_only=True)
class Proof86SensorEntityDescription(SensorEntityDescription):
    """Describe an 86Proof summary sensor."""

    value_fn: Callable[[Inventory], StateType]


SENSORS: tuple[Proof86SensorEntityDescription, ...] = (
    Proof86SensorEntityDescription(
        key="bottle_count",
        translation_key="bottle_count",
        native_unit_of_measurement="bottles",
        state_class=SensorStateClass.MEASUREMENT,
        icon="mdi:bottle-tonic",
        value_fn=lambda inventory: inventory.bottle_count,
    ),
    Proof86SensorEntityDescription(
        key="empty_bottle_count",
        translation_key="empty_bottle_count",
        native_unit_of_measurement="bottles",
        state_class=SensorStateClass.MEASUREMENT,
        icon="mdi:bottle-tonic-outline",
        value_fn=lambda inventory: inventory.empty_bottle_count,
    ),
    Proof86SensorEntityDescription(
        key="low_stock_bottle_count",
        translation_key="low_stock_bottle_count",
        native_unit_of_measurement="bottles",
        state_class=SensorStateClass.MEASUREMENT,
        icon="mdi:liquid-spot",
        value_fn=lambda inventory: inventory.low_stock_bottle_count,
    ),
    Proof86SensorEntityDescription(
        key="category_count",
        translation_key="category_count",
        native_unit_of_measurement="categories",
        state_class=SensorStateClass.MEASUREMENT,
        icon="mdi:shape",
        value_fn=lambda inventory: inventory.category_count,
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: Proof86ConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up 86Proof summary sensors."""
    coordinator = entry.runtime_data.coordinator
    async_add_entities(
        Proof86Sensor(
            coordinator,
            description,
            bar_id=entry.data[CONF_BAR_ID],
            bar_name=entry.data[CONF_BAR_NAME],
        )
        for description in SENSORS
    )


class Proof86Sensor(Proof86Entity, SensorEntity):
    """A summary sensor for a shared 86Proof bar."""

    entity_description: Proof86SensorEntityDescription

    def __init__(
        self,
        coordinator: Proof86Coordinator,
        description: Proof86SensorEntityDescription,
        *,
        bar_id: str,
        bar_name: str,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(
            coordinator,
            bar_id=bar_id,
            bar_name=bar_name,
        )
        self.entity_description = description
        self._attr_unique_id = f"{bar_id}_{description.key}"

    @property
    def native_value(self) -> StateType:
        """Return the current summary value."""
        return self.entity_description.value_fn(self.coordinator.data)
