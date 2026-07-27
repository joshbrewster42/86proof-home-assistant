from datetime import UTC, datetime

from custom_components.proof86.models import (
    Bar,
    Bottle,
    Inventory,
    bottle_from_document,
    inventory_to_dict,
    unwrap_firestore_value,
)


def test_unwrap_firestore_value_supports_nested_values() -> None:
    assert unwrap_firestore_value(
        {
            "mapValue": {
                "fields": {
                    "names": {
                        "arrayValue": {
                            "values": [
                                {"stringValue": "Rye"},
                                {"integerValue": "2"},
                            ]
                        }
                    }
                }
            }
        }
    ) == {"names": ["Rye", 2]}


def test_bottle_from_document_maps_wire_names() -> None:
    bottle = bottle_from_document(
        {
            "name": "projects/example/documents/shared_bars/bar/bottles/bottle-1",
            "fields": {
                "name": {"stringValue": "Buffalo Trace"},
                "type": {"stringValue": "Whiskey"},
                "category": {"stringValue": "Bourbon"},
                "selectedProductID": {"integerValue": "42"},
                "abv": {"doubleValue": 45},
                "size": {"integerValue": "750"},
                "fullness": {"stringValue": "25%"},
                "updatedAt": {"timestampValue": "2026-07-26T04:12:00Z"},
            },
        }
    )

    assert bottle.id == "bottle-1"
    assert bottle.name == "Buffalo Trace"
    assert bottle.selected_product_id == 42
    assert bottle.abv == 45.0
    assert bottle.updated_at == datetime(2026, 7, 26, 4, 12, tzinfo=UTC)
    assert bottle.is_low_stock
    assert not bottle.is_empty


def test_inventory_summaries() -> None:
    inventory = Inventory(
        bar=Bar(id="bar-1", name="Home Bar"),
        bottles=(
            Bottle(id="1", name="One", type="Whiskey", category="Bourbon"),
            Bottle(
                id="2",
                name="Two",
                type="Whiskey",
                category=" bourbon ",
                fullness="empty",
            ),
            Bottle(
                id="3",
                name="Three",
                type="Gin",
                category="Gin",
                fullness="Quarter",
            ),
        ),
        fetched_at=datetime.now(UTC),
    )

    assert inventory.bottle_count == 3
    assert inventory.empty_bottle_count == 1
    assert inventory.low_stock_bottle_count == 2
    assert inventory.category_count == 2


def test_inventory_serialization_excludes_owner_and_uses_iso_dates() -> None:
    fetched_at = datetime(2026, 7, 26, 4, 12, tzinfo=UTC)
    inventory = Inventory(
        bar=Bar(id="bar-1", name="Home Bar", owner_uid="private-owner"),
        bottles=(
            Bottle(
                id="bottle-1",
                name="Gin",
                type="Spirit",
                updated_at=fetched_at,
            ),
        ),
        fetched_at=fetched_at,
    )

    serialized = inventory_to_dict(inventory)

    assert serialized["bar"] == {"id": "bar-1", "name": "Home Bar"}
    assert "owner_uid" not in serialized["bar"]
    assert serialized["bottles"][0]["updated_at"] == fetched_at.isoformat()
    assert serialized["fetched_at"] == fetched_at.isoformat()
