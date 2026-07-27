"""Async cloud client for the 86Proof integration."""

from __future__ import annotations

import asyncio
import time
from datetime import UTC, datetime
from typing import Any
from urllib.parse import quote

from aiohttp import ClientError, ClientResponse, ClientSession, ClientTimeout

from .const import (
    AUTHORIZE_URL,
    CUSTOM_TOKEN_URL,
    FIRESTORE_BASE_URL,
    REFRESH_TOKEN_URL,
)
from .models import (
    AuthorizationGrant,
    Inventory,
    bar_from_document,
    bottle_from_document,
)

REQUEST_TIMEOUT = ClientTimeout(total=15)
TOKEN_EXPIRY_MARGIN = 60


class Proof86ApiError(Exception):
    """Base exception for the 86Proof cloud API."""


class Proof86CannotConnectError(Proof86ApiError):
    """Raised when the cloud API cannot be reached."""


class Proof86InvalidAuthError(Proof86ApiError):
    """Raised when a Firebase credential is invalid."""


class Proof86MembershipRevokedError(Proof86InvalidAuthError):
    """Raised when the viewer no longer has access to the shared bar."""


class Proof86InvalidShareCodeError(Proof86ApiError):
    """Raised when a share code cannot authorize a viewer."""


class Proof86ApiClient:
    """Read-only 86Proof Firebase client."""

    def __init__(
        self,
        session: ClientSession,
        *,
        refresh_token: str | None = None,
    ) -> None:
        """Initialize the client."""
        self._session = session
        self._refresh_token = refresh_token
        self._id_token: str | None = None
        self._id_token_expires_at = 0.0

    @property
    def refresh_token(self) -> str | None:
        """Return the latest refresh token."""
        return self._refresh_token

    async def async_authorize(
        self,
        *,
        invite_code: str,
        installation_id: str,
        display_name: str,
        expected_bar_id: str | None = None,
    ) -> AuthorizationGrant:
        """Exchange a share code for a revocable Firebase viewer credential."""
        request_data = {
            "inviteCode": invite_code.strip().upper(),
            "installationId": installation_id,
            "displayName": display_name,
        }
        if expected_bar_id is not None:
            request_data["expectedBarId"] = expected_bar_id
        payload = await self._async_post_json(
            AUTHORIZE_URL,
            json={"data": request_data},
            callable_request=True,
        )
        result = payload.get("result")
        if not isinstance(result, dict):
            raise Proof86CannotConnectError("Malformed authorization response")

        custom_token = result.get("customToken")
        bar_id = result.get("barId")
        bar_name = result.get("barName")
        viewer_uid = result.get("viewerUid")
        if not all(
            isinstance(value, str) and value
            for value in (custom_token, bar_id, bar_name, viewer_uid)
        ):
            raise Proof86CannotConnectError("Incomplete authorization response")

        token_payload = await self._async_post_json(
            CUSTOM_TOKEN_URL,
            json={"token": custom_token, "returnSecureToken": True},
            auth_request=True,
        )
        self._store_identity_token_payload(token_payload)
        if self._refresh_token is None:
            raise Proof86InvalidAuthError("Firebase did not return a refresh token")

        return AuthorizationGrant(
            bar_id=bar_id,
            bar_name=bar_name,
            viewer_uid=viewer_uid,
            refresh_token=self._refresh_token,
        )

    async def async_get_inventory(self, bar_id: str) -> Inventory:
        """Fetch the shared bar and all bottle documents."""
        id_token = await self._async_ensure_id_token()
        encoded_bar_id = quote(bar_id, safe="")
        headers = {"Authorization": f"Bearer {id_token}"}

        bar_document = await self._async_get_json(
            f"{FIRESTORE_BASE_URL}/shared_bars/{encoded_bar_id}",
            headers=headers,
            firestore_request=True,
        )
        bar = bar_from_document(bar_id, bar_document)

        documents: list[dict[str, Any]] = []
        page_token: str | None = None
        while True:
            params = {"pageSize": "1000"}
            if page_token:
                params["pageToken"] = page_token
            page = await self._async_get_json(
                f"{FIRESTORE_BASE_URL}/shared_bars/{encoded_bar_id}/bottles",
                headers=headers,
                params=params,
                firestore_request=True,
            )
            page_documents = page.get("documents", [])
            if not isinstance(page_documents, list):
                raise Proof86CannotConnectError("Malformed bottle-list response")
            documents.extend(page_documents)
            next_page_token = page.get("nextPageToken")
            if not isinstance(next_page_token, str) or not next_page_token:
                break
            page_token = next_page_token

        return Inventory(
            bar=bar,
            bottles=tuple(bottle_from_document(document) for document in documents),
            fetched_at=datetime.now(UTC),
        )

    async def _async_ensure_id_token(self) -> str:
        """Return a valid Firebase ID token, refreshing when necessary."""
        if (
            self._id_token
            and self._id_token_expires_at > time.monotonic() + TOKEN_EXPIRY_MARGIN
        ):
            return self._id_token
        if not self._refresh_token:
            raise Proof86InvalidAuthError("No Firebase refresh token")

        payload = await self._async_post_json(
            REFRESH_TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "refresh_token": self._refresh_token,
            },
            auth_request=True,
        )
        self._store_refresh_token_payload(payload)
        if not self._id_token:
            raise Proof86InvalidAuthError("Firebase did not return an ID token")
        return self._id_token

    def _store_identity_token_payload(self, payload: dict[str, Any]) -> None:
        """Store a response from signInWithCustomToken."""
        id_token = payload.get("idToken")
        refresh_token = payload.get("refreshToken")
        if not isinstance(id_token, str) or not isinstance(refresh_token, str):
            raise Proof86InvalidAuthError("Malformed Firebase token response")
        self._id_token = id_token
        self._refresh_token = refresh_token
        self._id_token_expires_at = time.monotonic() + int(
            payload.get("expiresIn", 3600)
        )

    def _store_refresh_token_payload(self, payload: dict[str, Any]) -> None:
        """Store a response from the Secure Token API."""
        id_token = payload.get("id_token")
        refresh_token = payload.get("refresh_token")
        if not isinstance(id_token, str) or not isinstance(refresh_token, str):
            raise Proof86InvalidAuthError("Malformed Firebase refresh response")
        self._id_token = id_token
        self._refresh_token = refresh_token
        self._id_token_expires_at = time.monotonic() + int(
            payload.get("expires_in", 3600)
        )

    async def _async_get_json(
        self,
        url: str,
        *,
        headers: dict[str, str],
        params: dict[str, str] | None = None,
        firestore_request: bool = False,
    ) -> dict[str, Any]:
        """Perform a GET and return a JSON object."""
        try:
            async with asyncio.timeout(REQUEST_TIMEOUT.total):
                async with self._session.get(
                    url,
                    headers=headers,
                    params=params,
                ) as response:
                    payload = await self._response_json(response)
                    self._raise_for_status(
                        response,
                        payload,
                        firestore_request=firestore_request,
                    )
                    return payload
        except (TimeoutError, ClientError) as err:
            raise Proof86CannotConnectError("Cloud request failed") from err

    async def _async_post_json(
        self,
        url: str,
        *,
        json: dict[str, Any] | None = None,
        data: dict[str, str] | None = None,
        callable_request: bool = False,
        auth_request: bool = False,
    ) -> dict[str, Any]:
        """Perform a POST and return a JSON object."""
        try:
            async with asyncio.timeout(REQUEST_TIMEOUT.total):
                async with self._session.post(url, json=json, data=data) as response:
                    payload = await self._response_json(response)
                    self._raise_for_status(
                        response,
                        payload,
                        callable_request=callable_request,
                        auth_request=auth_request,
                    )
                    return payload
        except (TimeoutError, ClientError) as err:
            raise Proof86CannotConnectError("Cloud request failed") from err

    @staticmethod
    async def _response_json(response: ClientResponse) -> dict[str, Any]:
        """Decode a JSON object, mapping invalid responses to connectivity errors."""
        try:
            payload = await response.json(content_type=None)
        except (ValueError, ClientError) as err:
            raise Proof86CannotConnectError("Cloud returned invalid JSON") from err
        if not isinstance(payload, dict):
            raise Proof86CannotConnectError("Cloud returned a non-object response")
        return payload

    @staticmethod
    def _raise_for_status(
        response: ClientResponse,
        payload: dict[str, Any],
        *,
        callable_request: bool = False,
        auth_request: bool = False,
        firestore_request: bool = False,
    ) -> None:
        """Map a cloud HTTP response to integration exceptions."""
        if response.status < 400:
            return

        if callable_request:
            error = payload.get("error", {})
            status = str(error.get("status", "")).casefold().replace("_", "-")
            if status in {"invalid-argument", "not-found", "failed-precondition"}:
                raise Proof86InvalidShareCodeError("Share code was not accepted")
            if status in {"unauthenticated", "permission-denied"}:
                raise Proof86InvalidAuthError("Authorization was denied")

        if firestore_request and response.status in {403, 404}:
            raise Proof86MembershipRevokedError(
                "Shared bar is unavailable or membership was revoked"
            )
        if auth_request or response.status == 401:
            raise Proof86InvalidAuthError("Firebase credential was rejected")
        raise Proof86CannotConnectError(f"Cloud returned HTTP {response.status}")
