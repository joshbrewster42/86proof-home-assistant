"""Config flow for the 86Proof integration."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.config_entries import ConfigFlowResult
from homeassistant.helpers import selector
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import (
    Proof86ApiClient,
    Proof86CannotConnectError,
    Proof86InvalidAuthError,
    Proof86InvalidShareCodeError,
)
from .const import (
    CONF_BAR_ID,
    CONF_BAR_NAME,
    CONF_DISPLAY_NAME,
    CONF_INSTALLATION_ID,
    CONF_REFRESH_TOKEN,
    CONF_SHARE_CODE,
    CONF_VIEWER_UID,
    DEFAULT_DISPLAY_NAME,
    DOMAIN,
    LOGGER,
)
from .models import AuthorizationGrant

SHARE_CODE_LENGTH = 8


class Proof86ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle an 86Proof config flow."""

    VERSION = 1
    MINOR_VERSION = 1

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> ConfigFlowResult:
        """Handle setup initiated by the user."""
        errors: dict[str, str] = {}
        if user_input is not None:
            share_code = _normalize_share_code(user_input[CONF_SHARE_CODE])
            display_name = user_input[CONF_DISPLAY_NAME].strip()
            if not _is_valid_share_code(share_code):
                errors["base"] = "invalid_share_code"
            elif not _is_valid_display_name(display_name):
                errors[CONF_DISPLAY_NAME] = "invalid_display_name"
            else:
                installation_id = str(uuid4())
                try:
                    grant = await self._async_authorize(
                        share_code=share_code,
                        installation_id=installation_id,
                        display_name=display_name,
                        expected_bar_id=None,
                    )
                except Proof86InvalidShareCodeError:
                    errors["base"] = "invalid_share_code"
                except Proof86InvalidAuthError:
                    errors["base"] = "invalid_auth"
                except Proof86CannotConnectError:
                    errors["base"] = "cannot_connect"
                except Exception:
                    LOGGER.exception("Unexpected exception during 86Proof setup")
                    errors["base"] = "unknown"
                else:
                    await self.async_set_unique_id(grant.bar_id)
                    self._abort_if_unique_id_configured()
                    return self.async_create_entry(
                        title=grant.bar_name,
                        data=_entry_data(
                            grant,
                            installation_id=installation_id,
                            display_name=display_name,
                        ),
                    )

        return self.async_show_form(
            step_id="user",
            data_schema=_setup_schema(user_input),
            errors=errors,
        )

    async def async_step_reauth(
        self,
        entry_data: dict[str, Any],
    ) -> ConfigFlowResult:
        """Start reauthorization for a revoked viewer."""
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> ConfigFlowResult:
        """Reauthorize using a current share code."""
        entry = self._get_reauth_entry()
        errors: dict[str, str] = {}
        if user_input is not None:
            share_code = _normalize_share_code(user_input[CONF_SHARE_CODE])
            if not _is_valid_share_code(share_code):
                errors["base"] = "invalid_share_code"
            else:
                try:
                    grant = await self._async_authorize(
                        share_code=share_code,
                        installation_id=entry.data[CONF_INSTALLATION_ID],
                        display_name=entry.data.get(
                            CONF_DISPLAY_NAME,
                            DEFAULT_DISPLAY_NAME,
                        ),
                        expected_bar_id=entry.data[CONF_BAR_ID],
                    )
                except Proof86InvalidShareCodeError:
                    errors["base"] = "invalid_share_code"
                except Proof86InvalidAuthError:
                    errors["base"] = "invalid_auth"
                except Proof86CannotConnectError:
                    errors["base"] = "cannot_connect"
                except Exception:
                    LOGGER.exception(
                        "Unexpected exception during 86Proof reauthorization"
                    )
                    errors["base"] = "unknown"
                else:
                    if grant.bar_id != entry.data[CONF_BAR_ID]:
                        errors["base"] = "wrong_bar"
                    else:
                        return self.async_update_reload_and_abort(
                            entry,
                            data_updates=_entry_data(
                                grant,
                                installation_id=entry.data[CONF_INSTALLATION_ID],
                                display_name=entry.data.get(
                                    CONF_DISPLAY_NAME,
                                    DEFAULT_DISPLAY_NAME,
                                ),
                            ),
                        )

        return self.async_show_form(
            step_id="reauth_confirm",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_SHARE_CODE): selector.TextSelector(
                        selector.TextSelectorConfig(
                            autocomplete="off",
                        )
                    )
                }
            ),
            errors=errors,
        )

    async def _async_authorize(
        self,
        *,
        share_code: str,
        installation_id: str,
        display_name: str,
        expected_bar_id: str | None,
    ) -> AuthorizationGrant:
        """Authorize a viewer through the 86Proof cloud API."""
        client = Proof86ApiClient(async_get_clientsession(self.hass))
        return await client.async_authorize(
            invite_code=share_code,
            installation_id=installation_id,
            display_name=display_name,
            expected_bar_id=expected_bar_id,
        )


def _setup_schema(
    user_input: dict[str, Any] | None,
) -> vol.Schema:
    """Return the setup form schema."""
    suggested = user_input or {}
    return vol.Schema(
        {
            vol.Required(
                CONF_SHARE_CODE,
                default=suggested.get(CONF_SHARE_CODE, ""),
            ): selector.TextSelector(
                selector.TextSelectorConfig(
                    autocomplete="off",
                )
            ),
            vol.Required(
                CONF_DISPLAY_NAME,
                default=suggested.get(CONF_DISPLAY_NAME, DEFAULT_DISPLAY_NAME),
            ): selector.TextSelector(),
        }
    )


def _normalize_share_code(value: str) -> str:
    """Normalize a user-entered share code."""
    return value.strip().upper().replace(" ", "").replace("-", "")


def _is_valid_share_code(value: str) -> bool:
    """Return whether a normalized share code has the expected shape."""
    allowed = frozenset("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
    return len(value) == SHARE_CODE_LENGTH and set(value) <= allowed


def _is_valid_display_name(value: str) -> bool:
    """Return whether a viewer name is acceptable to the backend."""
    return 1 <= len(value) <= 60


def _entry_data(
    grant: AuthorizationGrant,
    *,
    installation_id: str,
    display_name: str,
) -> dict[str, str]:
    """Build persisted config entry data."""
    return {
        CONF_BAR_ID: grant.bar_id,
        CONF_BAR_NAME: grant.bar_name,
        CONF_DISPLAY_NAME: display_name,
        CONF_INSTALLATION_ID: installation_id,
        CONF_REFRESH_TOKEN: grant.refresh_token,
        CONF_VIEWER_UID: grant.viewer_uid,
    }
