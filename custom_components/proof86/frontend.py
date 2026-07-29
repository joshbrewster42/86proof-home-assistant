"""Frontend registration for the bundled 86Proof inventory card."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

STATIC_URL = "/proof86_static"
CARD_FILENAME = "proof86-card.js"
CARD_VERSION = "0.6.1"
CARD_URL = f"/proof86_card_{CARD_VERSION.replace('.', '_')}.js"


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Serve and load the bundled 86Proof dashboard card."""
    frontend_path = Path(__file__).parent / "frontend"
    card_path = frontend_path / CARD_FILENAME
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                STATIC_URL,
                path=str(frontend_path),
                cache_headers=True,
            ),
            # Some embedded WebViews cache JavaScript by path and ignore query
            # strings. A new path guarantees that each frontend version is
            # fetched while the stable directory continues serving SVG assets.
            StaticPathConfig(
                CARD_URL,
                path=str(card_path),
                cache_headers=True,
            ),
        ]
    )
    # Home Assistant maintains separate registries for its modern module
    # frontend and its legacy WebView frontend. The card is constrained to
    # ES2015 syntax so the same asset can safely serve both paths.
    add_extra_js_url(hass, CARD_URL)
    add_extra_js_url(hass, CARD_URL, es5=True)
