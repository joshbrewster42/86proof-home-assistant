"""Data models for the 86Proof integration."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

EMPTY_FULLNESS_VALUES = frozenset({"0%", "86d", "86'd", "empty"})
LOW_FULLNESS_VALUES = frozenset({"1/4", "25%", "almost empty", "low", "quarter", "¼"})

# Category colors (day, night), the same as the inventory card (frontend/proof86-card.js)
CATEGORY_COLORS: dict[str, tuple[str, str]] = {
    "whiskey": ("#c1742e", "#c47a2e"),
    "scotch": ("#d9a441", "#e8bc5f"),
    "vodka": ("#5ba4e6", "#7bbaf0"),
    "gin": ("#5ca17c", "#77b993"),
    "rum": ("#8b572a", "#a87348"),
    "tequila": ("#b7b46a", "#a7a25c"),
    "mezcal": ("#7a8b71", "#95a68c"),
    "brandy": ("#ad6b3a", "#c88858"),
    "cognac": ("#c06030", "#d87d52"),
    "asian": ("#6c7b9c", "#8a98b8"),
    "other spirit": ("#a0a0a0", "#b8b8b8"),
    "red": ("#7a1f1f", "#a53b3b"),
    "white": ("#e3c66e", "#edd88a"),
    "rosé": ("#e9a8a6", "#f2c0be"),
    "sparkling": ("#e4d5b7", "#efe5ce"),
    "fortified": ("#c59b3a", "#d9b358"),
    "fruit": ("#c15d7c", "#d67c98"),
    "herbal / botanical": ("#5d814d", "#729c63"),
    "nut / seed": ("#7b563a", "#9c7858"),
    "coffee / chocolate": ("#5a3a2e", "#7d5a4a"),
    "cream": ("#dcc7a1", "#e8d9bb"),
    "vermouth": ("#892e33", "#b0494f"),
    "amaro": ("#c9562c", "#e47145"),
    "other apéritifs": ("#d1a642", "#e6c05e"),
    "aromatic": ("#6b3520", "#9a5540"),
    "citrus": ("#e07c35", "#f2a86c"),
    "herbal / spice": ("#437d68", "#5d9e86"),
    "specialty": ("#5a3a2e", "#7d5a4a"),
    "syrups": ("#b97239", "#d38d56"),
    "shrubs": ("#c15061", "#d46e7c"),
    "juices / purees": ("#e3b045", "#f0c566"),
    "sodas / tonics": ("#8dc6dd", "#a8d8eb"),
    "bitters (alternative)": ("#678b6b", "#85a886"),
    "garnishes": ("#ce8aae", "#dda6c4"),
    "creams / dairy": ("#eadbc0", "#f2ead6"),
    "other mixer": ("#8f8c86", "#b0aba5"),
    "non-alcoholic": ("#6c7b9c", "#8a98b8"),
}

TYPE_COLORS: dict[str, tuple[str, str]] = {
    "spirit": ("#c1742e", "#c47a2e"),
    "wine": ("#7a1f1f", "#a53b3b"),
    "liqueur": ("#788e55", "#8fa768"),
    "apéritif/digestif": ("#e07c35", "#f2a86c"),
    "apéritif / digestif": ("#e07c35", "#f2a86c"),
    "aperitif/digestif": ("#e07c35", "#f2a86c"),
    "aperitif / digestif": ("#e07c35", "#f2a86c"),
    "bitters": ("#a0462d", "#ba5535"),
    "mixer": ("#8dc6dd", "#a8d8eb"),
    "mixers": ("#8dc6dd", "#a8d8eb"),
    "mixers & ingredients": ("#8dc6dd", "#a8d8eb"),
    "non-alcoholic": ("#6c7b9c", "#8a98b8"),
}

DEFAULT_COLORS = ("#8f8c86", "#b0aba5")
# Types the card groups by type instead of by category
GROUP_BY_TYPE = frozenset({"Liqueur", "Bitters", "Mixer"})


def _normalized_fullness(value: str | None) -> str:
    """Normalize a fullness label for summary calculations."""
    return value.strip().casefold() if value else ""


@dataclass(frozen=True, slots=True)
class Bottle:
    """A bottle in a shared 86Proof bar."""

    id: str
    name: str
    type: str
    category: str | None = None
    upc: str | None = None
    selected_product_id: int | None = None
    style: str | None = None
    abv: float | None = None
    size: int | None = None
    fullness: str | None = None
    notes: str = ""
    julep_blurb: str | None = None
    updated_at: datetime | None = None

    @property
    def is_empty(self) -> bool:
        """Return whether the fullness label represents an empty bottle."""
        return _normalized_fullness(self.fullness) in EMPTY_FULLNESS_VALUES

    @property
    def group(self) -> str:
        """Return the group the inventory card files this bottle under."""
        bottle_type = (self.type or "").strip()
        if bottle_type in GROUP_BY_TYPE:
            return bottle_type
        return (self.category or bottle_type or "Other").strip()

    @property
    def colors(self) -> tuple[str, str]:
        """Return the bottle's (day, night) color, as the inventory card picks it."""
        category = _normalized_fullness(self.category)
        bottle_type = _normalized_fullness(self.type)
        return (
            CATEGORY_COLORS.get(category)
            or CATEGORY_COLORS.get(bottle_type)
            or TYPE_COLORS.get(bottle_type)
            or TYPE_COLORS.get(category)
            or DEFAULT_COLORS
        )

    @property
    def is_low_stock(self) -> bool:
        """Return whether the fullness label represents low stock."""
        normalized = _normalized_fullness(self.fullness)
        return normalized in LOW_FULLNESS_VALUES or normalized in EMPTY_FULLNESS_VALUES


@dataclass(frozen=True, slots=True)
class Bar:
    """A shared 86Proof bar."""

    id: str
    name: str
    owner_uid: str | None = None


@dataclass(frozen=True, slots=True)
class Inventory:
    """A complete shared-bar inventory snapshot."""

    bar: Bar
    bottles: tuple[Bottle, ...]
    fetched_at: datetime = field(compare=False)

    @property
    def bottle_count(self) -> int:
        """Return the number of bottles."""
        return len(self.bottles)

    @property
    def empty_bottle_count(self) -> int:
        """Return the number of empty bottles."""
        return sum(bottle.is_empty for bottle in self.bottles)

    @property
    def low_stock_bottle_count(self) -> int:
        """Return the number of low-stock or empty bottles."""
        return sum(bottle.is_low_stock for bottle in self.bottles)

    @property
    def low_stock_bottles(self) -> list[dict[str, Any]]:
        """Return the low-stock and empty bottles, empty ones first, then by name."""
        return [
            {
                "id": bottle.id,
                "name": bottle.name,
                "fullness": bottle.fullness,
                "category": bottle.category,
                "empty": bottle.is_empty,
            }
            for bottle in sorted(
                (bottle for bottle in self.bottles if bottle.is_low_stock),
                key=lambda bottle: (not bottle.is_empty, bottle.name.casefold()),
            )
        ]

    @property
    def all_bottles(self) -> list[dict[str, Any]]:
        """Return every bottle by name, with the fields a wall panel shows."""
        return [
            {
                "id": bottle.id,
                "name": bottle.name,
                "type": bottle.type,
                "category": bottle.category,
                "style": bottle.style,
                "abv": bottle.abv,
                "size": bottle.size,
                "fullness": bottle.fullness,
                "empty": bottle.is_empty,
                "low": bottle.is_low_stock,
                "description": bottle.julep_blurb,
                "group": bottle.group,
                "color": bottle.colors[0],
                "color_dark": bottle.colors[1],
            }
            for bottle in sorted(self.bottles, key=lambda bottle: bottle.name.casefold())
        ]

    @property
    def category_count(self) -> int:
        """Return the number of non-empty categories."""
        return len(
            {
                bottle.category.strip().casefold()
                for bottle in self.bottles
                if bottle.category and bottle.category.strip()
            }
        )


@dataclass(frozen=True, slots=True)
class AuthorizationGrant:
    """Credential and bar metadata returned during authorization."""

    bar_id: str
    bar_name: str
    viewer_uid: str
    refresh_token: str


def unwrap_firestore_value(value: dict[str, Any]) -> Any:
    """Unwrap one Firestore REST typed value."""
    if "nullValue" in value:
        return None
    if "stringValue" in value:
        return value["stringValue"]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return float(value["doubleValue"])
    if "booleanValue" in value:
        return bool(value["booleanValue"])
    if "timestampValue" in value:
        return datetime.fromisoformat(value["timestampValue"].replace("Z", "+00:00"))
    if "referenceValue" in value:
        return value["referenceValue"]
    if "bytesValue" in value:
        return value["bytesValue"]
    if "geoPointValue" in value:
        return value["geoPointValue"]
    if "arrayValue" in value:
        return [
            unwrap_firestore_value(item)
            for item in value["arrayValue"].get("values", [])
        ]
    if "mapValue" in value:
        return {
            key: unwrap_firestore_value(item)
            for key, item in value["mapValue"].get("fields", {}).items()
        }
    raise ValueError(f"Unsupported Firestore value type: {tuple(value)}")


def unwrap_firestore_fields(document: dict[str, Any]) -> dict[str, Any]:
    """Unwrap all fields in a Firestore REST document."""
    return {
        key: unwrap_firestore_value(value)
        for key, value in document.get("fields", {}).items()
    }


def bar_from_document(bar_id: str, document: dict[str, Any]) -> Bar:
    """Build a bar from a Firestore REST document."""
    fields = unwrap_firestore_fields(document)
    return Bar(
        id=bar_id,
        name=str(fields.get("name") or "Shared Bar"),
        owner_uid=fields.get("ownerUID"),
    )


def bottle_from_document(document: dict[str, Any]) -> Bottle:
    """Build a bottle from a Firestore REST document."""
    fields = unwrap_firestore_fields(document)
    document_name = str(document.get("name", ""))
    bottle_id = document_name.rsplit("/", 1)[-1]
    return Bottle(
        id=bottle_id,
        name=str(fields.get("name") or "Unnamed Bottle"),
        type=str(fields.get("type") or ""),
        category=fields.get("category"),
        upc=fields.get("upc"),
        selected_product_id=fields.get("selectedProductID"),
        style=fields.get("style"),
        abv=fields.get("abv"),
        size=fields.get("size"),
        fullness=fields.get("fullness"),
        notes=str(fields.get("notes") or ""),
        julep_blurb=fields.get("julepBlurb"),
        updated_at=fields.get("updatedAt"),
    )


def empty_inventory(bar_id: str, bar_name: str) -> Inventory:
    """Return an empty inventory, primarily for diagnostics and tests."""
    return Inventory(
        bar=Bar(id=bar_id, name=bar_name),
        bottles=(),
        fetched_at=datetime.now(UTC),
    )


def inventory_to_dict(inventory: Inventory) -> dict[str, Any]:
    """Serialize an inventory for the authenticated Home Assistant frontend."""
    return {
        "bar": {
            "id": inventory.bar.id,
            "name": inventory.bar.name,
        },
        "bottles": [
            {
                "id": bottle.id,
                "name": bottle.name,
                "type": bottle.type,
                "category": bottle.category,
                "upc": bottle.upc,
                "selected_product_id": bottle.selected_product_id,
                "style": bottle.style,
                "abv": bottle.abv,
                "size": bottle.size,
                "fullness": bottle.fullness,
                "notes": bottle.notes,
                "julep_blurb": bottle.julep_blurb,
                "updated_at": bottle.updated_at.isoformat()
                if bottle.updated_at
                else None,
            }
            for bottle in inventory.bottles
        ],
        "fetched_at": inventory.fetched_at.isoformat(),
    }
