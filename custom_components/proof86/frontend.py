"""Frontend registration for the bundled 86Proof inventory card."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

STATIC_URL = "/proof86_static"
CARD_FILENAME = "proof86-card.js"
CARD_VERSION = "0.2.1"
CARD_URL = f"{STATIC_URL}/{CARD_FILENAME}?v={CARD_VERSION}"


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Serve and load the bundled 86Proof dashboard card."""
    frontend_path = Path(__file__).parent / "frontend"
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                STATIC_URL,
                path=str(frontend_path),
                cache_headers=True,
            )
        ]
    )
    add_extra_js_url(hass, CARD_URL)
