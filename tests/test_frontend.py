"""Tests for the bundled dashboard card registration."""

from __future__ import annotations

import sys
import types
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest

homeassistant = types.ModuleType("homeassistant")
components = types.ModuleType("homeassistant.components")
ha_frontend = types.ModuleType("homeassistant.components.frontend")
ha_http = types.ModuleType("homeassistant.components.http")
ha_core = types.ModuleType("homeassistant.core")

ha_frontend.add_extra_js_url = lambda *args, **kwargs: None


@dataclass
class StaticPathConfig:
    """Small stand-in for Home Assistant's static path configuration."""

    url_path: str
    path: str
    cache_headers: bool


ha_http.StaticPathConfig = StaticPathConfig
ha_core.HomeAssistant = Any

sys.modules.setdefault("homeassistant", homeassistant)
sys.modules.setdefault("homeassistant.components", components)
sys.modules.setdefault("homeassistant.components.frontend", ha_frontend)
sys.modules.setdefault("homeassistant.components.http", ha_http)
sys.modules.setdefault("homeassistant.core", ha_core)

from custom_components.proof86 import frontend as frontend_module  # noqa: E402


class FakeHttp:
    """Capture static path registrations."""

    def __init__(self) -> None:
        self.paths: list[StaticPathConfig] = []

    async def async_register_static_paths(
        self, paths: list[StaticPathConfig]
    ) -> None:
        """Store registered paths."""
        self.paths.extend(paths)


class FakeHass:
    """Minimal Home Assistant instance for frontend registration."""

    def __init__(self) -> None:
        self.http = FakeHttp()


@pytest.mark.asyncio
async def test_registers_card_for_modern_and_legacy_frontends(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Serve the card and register it in both frontend asset registries."""
    registrations: list[tuple[Any, str, bool]] = []

    def add_extra_js_url(hass: Any, url: str, es5: bool = False) -> None:
        registrations.append((hass, url, es5))

    monkeypatch.setattr(frontend_module, "add_extra_js_url", add_extra_js_url)
    hass = FakeHass()

    await frontend_module.async_register_frontend(hass)

    assert registrations == [
        (hass, frontend_module.CARD_URL, False),
        (hass, frontend_module.CARD_URL, True),
    ]
    assert len(hass.http.paths) == 2
    assert hass.http.paths[0].url_path == frontend_module.STATIC_URL
    assert Path(hass.http.paths[0].path).name == "frontend"
    assert hass.http.paths[1].url_path == frontend_module.CARD_URL
    assert Path(hass.http.paths[1].path).name == frontend_module.CARD_FILENAME
    assert "0_5_0" in frontend_module.CARD_URL
