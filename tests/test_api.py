import json

import pytest
from aiohttp import ClientSession, web
from aiohttp.test_utils import TestServer

from custom_components.proof86 import api as api_module
from custom_components.proof86.api import (
    Proof86ApiClient,
    Proof86InvalidShareCodeError,
    Proof86MembershipRevokedError,
)


async def _start_server(
    routes: list[tuple[str, str, web.RequestHandler]],
) -> TestServer:
    app = web.Application()
    for method, path, handler in routes:
        app.router.add_route(method, path, handler)
    server = TestServer(app)
    await server.start_server()
    return server


@pytest.mark.asyncio
async def test_authorize_exchanges_custom_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    received_authorize_payload: dict[str, object] = {}

    async def authorize(request: web.Request) -> web.Response:
        received_authorize_payload.update(await request.json())
        return web.json_response(
            {
                "result": {
                    "barId": "bar-1",
                    "barName": "Home Bar",
                    "viewerUid": "viewer-1",
                    "customToken": "custom-token",
                }
            }
        )

    async def custom_token(request: web.Request) -> web.Response:
        assert await request.json() == {
            "token": "custom-token",
            "returnSecureToken": True,
        }
        return web.json_response(
            {
                "idToken": "id-token",
                "refreshToken": "refresh-token",
                "expiresIn": "3600",
            }
        )

    server = await _start_server(
        [
            ("POST", "/authorize", authorize),
            ("POST", "/custom-token", custom_token),
        ]
    )
    monkeypatch.setattr(api_module, "AUTHORIZE_URL", str(server.make_url("/authorize")))
    monkeypatch.setattr(
        api_module,
        "CUSTOM_TOKEN_URL",
        str(server.make_url("/custom-token")),
    )
    try:
        async with ClientSession() as session:
            client = Proof86ApiClient(session)
            grant = await client.async_authorize(
                invite_code="abcdefgh",
                installation_id="installation-1",
                display_name="Home Assistant",
            )
    finally:
        await server.close()

    assert grant.bar_id == "bar-1"
    assert grant.bar_name == "Home Bar"
    assert grant.viewer_uid == "viewer-1"
    assert grant.refresh_token == "refresh-token"
    assert received_authorize_payload["data"] == {
        "inviteCode": "ABCDEFGH",
        "installationId": "installation-1",
        "displayName": "Home Assistant",
    }


@pytest.mark.asyncio
async def test_authorize_sends_expected_bar_during_reauthentication(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def authorize(request: web.Request) -> web.Response:
        assert await request.json() == {
            "data": {
                "inviteCode": "ABCDEFGH",
                "installationId": "installation-1",
                "displayName": "Home Assistant",
                "expectedBarId": "bar-1",
            }
        }
        return web.json_response(
            {
                "result": {
                    "barId": "bar-1",
                    "barName": "Home Bar",
                    "viewerUid": "viewer-1",
                    "customToken": "custom-token",
                }
            }
        )

    async def custom_token(request: web.Request) -> web.Response:
        return web.json_response(
            {
                "idToken": "id-token",
                "refreshToken": "refresh-token",
                "expiresIn": "3600",
            }
        )

    server = await _start_server(
        [
            ("POST", "/authorize", authorize),
            ("POST", "/custom-token", custom_token),
        ]
    )
    monkeypatch.setattr(api_module, "AUTHORIZE_URL", str(server.make_url("/authorize")))
    monkeypatch.setattr(
        api_module,
        "CUSTOM_TOKEN_URL",
        str(server.make_url("/custom-token")),
    )
    try:
        async with ClientSession() as session:
            client = Proof86ApiClient(session)
            await client.async_authorize(
                invite_code="ABCDEFGH",
                installation_id="installation-1",
                display_name="Home Assistant",
                expected_bar_id="bar-1",
            )
    finally:
        await server.close()


@pytest.mark.asyncio
async def test_authorize_maps_callable_share_code_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def authorize(request: web.Request) -> web.Response:
        return web.json_response(
            {
                "error": {
                    "status": "NOT_FOUND",
                    "message": "Share code was not accepted",
                }
            },
            status=404,
        )

    server = await _start_server([("POST", "/authorize", authorize)])
    monkeypatch.setattr(api_module, "AUTHORIZE_URL", str(server.make_url("/authorize")))
    try:
        async with ClientSession() as session:
            client = Proof86ApiClient(session)
            with pytest.raises(Proof86InvalidShareCodeError):
                await client.async_authorize(
                    invite_code="ABCDEFGH",
                    installation_id="installation-1",
                    display_name="Home Assistant",
                )
    finally:
        await server.close()


@pytest.mark.asyncio
async def test_get_inventory_refreshes_and_reads_firestore(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    firestore_authorizations: list[str | None] = []
    bottle_page_tokens: list[str | None] = []

    async def refresh_token(request: web.Request) -> web.Response:
        form = await request.post()
        assert form["refresh_token"] == "refresh-token"
        return web.json_response(
            {
                "id_token": "new-id-token",
                "refresh_token": "rotated-refresh-token",
                "expires_in": "3600",
            }
        )

    async def get_bar(request: web.Request) -> web.Response:
        firestore_authorizations.append(request.headers.get("Authorization"))
        return web.json_response(
            {
                "fields": {
                    "name": {"stringValue": "Home Bar"},
                    "ownerUID": {"stringValue": "owner-1"},
                }
            }
        )

    async def get_bottles(request: web.Request) -> web.Response:
        firestore_authorizations.append(request.headers.get("Authorization"))
        assert request.query["pageSize"] == "1000"
        bottle_page_tokens.append(request.query.get("pageToken"))
        if request.query.get("pageToken") == "page-2":
            return web.json_response(
                {
                    "documents": [
                        {
                            "name": (
                                "projects/example/documents/shared_bars/bar-1/"
                                "bottles/bottle-2"
                            ),
                            "fields": {
                                "name": {"stringValue": "Sipsmith"},
                                "type": {"stringValue": "Gin"},
                                "category": {"stringValue": "London Dry"},
                                "notes": {"stringValue": ""},
                            },
                        }
                    ]
                }
            )
        return web.json_response(
            {
                "documents": [
                    {
                        "name": (
                            "projects/example/documents/shared_bars/bar-1/"
                            "bottles/bottle-1"
                        ),
                        "fields": {
                            "name": {"stringValue": "Rittenhouse Rye"},
                            "type": {"stringValue": "Whiskey"},
                            "category": {"stringValue": "Rye"},
                            "notes": {"stringValue": ""},
                        },
                    }
                ],
                "nextPageToken": "page-2",
            }
        )

    server = await _start_server(
        [
            ("POST", "/refresh", refresh_token),
            ("GET", "/documents/shared_bars/bar-1", get_bar),
            ("GET", "/documents/shared_bars/bar-1/bottles", get_bottles),
        ]
    )
    monkeypatch.setattr(
        api_module,
        "REFRESH_TOKEN_URL",
        str(server.make_url("/refresh")),
    )
    monkeypatch.setattr(
        api_module,
        "FIRESTORE_BASE_URL",
        str(server.make_url("/documents")).rstrip("/"),
    )
    try:
        async with ClientSession() as session:
            client = Proof86ApiClient(session, refresh_token="refresh-token")
            inventory = await client.async_get_inventory("bar-1")
    finally:
        await server.close()

    assert inventory.bar.name == "Home Bar"
    assert inventory.bar.owner_uid == "owner-1"
    assert inventory.bottle_count == 2
    assert inventory.bottles[0].name == "Rittenhouse Rye"
    assert inventory.bottles[1].name == "Sipsmith"
    assert client.refresh_token == "rotated-refresh-token"
    assert firestore_authorizations == [
        "Bearer new-id-token",
        "Bearer new-id-token",
        "Bearer new-id-token",
    ]
    assert bottle_page_tokens == [None, "page-2"]


@pytest.mark.asyncio
async def test_get_inventory_maps_revoked_membership(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def refresh_token(request: web.Request) -> web.Response:
        return web.json_response(
            {
                "id_token": "new-id-token",
                "refresh_token": "refresh-token",
                "expires_in": "3600",
            }
        )

    async def get_bar(request: web.Request) -> web.Response:
        return web.Response(
            status=403,
            text=json.dumps(
                {
                    "error": {
                        "code": 403,
                        "status": "PERMISSION_DENIED",
                    }
                }
            ),
            content_type="application/json",
        )

    server = await _start_server(
        [
            ("POST", "/refresh", refresh_token),
            ("GET", "/documents/shared_bars/bar-1", get_bar),
        ]
    )
    monkeypatch.setattr(
        api_module,
        "REFRESH_TOKEN_URL",
        str(server.make_url("/refresh")),
    )
    monkeypatch.setattr(
        api_module,
        "FIRESTORE_BASE_URL",
        str(server.make_url("/documents")).rstrip("/"),
    )
    try:
        async with ClientSession() as session:
            client = Proof86ApiClient(session, refresh_token="refresh-token")
            with pytest.raises(Proof86MembershipRevokedError):
                await client.async_get_inventory("bar-1")
    finally:
        await server.close()


@pytest.mark.asyncio
async def test_get_inventory_maps_stopped_sharing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def refresh_token(request: web.Request) -> web.Response:
        return web.json_response(
            {
                "id_token": "new-id-token",
                "refresh_token": "refresh-token",
                "expires_in": "3600",
            }
        )

    async def get_bar(request: web.Request) -> web.Response:
        return web.json_response(
            {"error": {"code": 404, "status": "NOT_FOUND"}},
            status=404,
        )

    server = await _start_server(
        [
            ("POST", "/refresh", refresh_token),
            ("GET", "/documents/shared_bars/bar-1", get_bar),
        ]
    )
    monkeypatch.setattr(
        api_module,
        "REFRESH_TOKEN_URL",
        str(server.make_url("/refresh")),
    )
    monkeypatch.setattr(
        api_module,
        "FIRESTORE_BASE_URL",
        str(server.make_url("/documents")).rstrip("/"),
    )
    try:
        async with ClientSession() as session:
            client = Proof86ApiClient(session, refresh_token="refresh-token")
            with pytest.raises(Proof86MembershipRevokedError):
                await client.async_get_inventory("bar-1")
    finally:
        await server.close()
