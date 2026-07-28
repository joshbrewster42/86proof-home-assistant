# 86Proof for Home Assistant

A read-only Home Assistant integration for viewing a home bar shared from the
86Proof iOS app.

> [!IMPORTANT]
> This project is under active development and does not have a supported HACS
> release yet.

## Setup experience

1. In 86Proof, share a bar and copy its eight-character share code.
2. In Home Assistant, add the **86Proof** integration.
3. Enter the share code. No Firebase account, password, or service-account key
   is required.
4. Home Assistant joins as a revocable, read-only viewer and periodically
   refreshes the bottle inventory.

The initial integration exposes one Home Assistant device for the shared bar,
a searchable inventory dashboard card, and these summary sensors:

- Bottle count
- Empty bottle count
- Low-stock bottle count
- Category count

Add the **86Proof Inventory** card from Home Assistant's dashboard card picker.
Its visual editor lets you change the title, initial sorting, scrollable list
height, preferred Sections-dashboard width, screen layout, and which controls
or bottle details are visible. No YAML is required.

In a Sections dashboard, choose a preferred width of 6, 9, or 12 columns (or
the full section width) in the card editor. Home Assistant's normal card
resizing controls remain available as well.

The equivalent manual configuration is:

```yaml
type: custom:proof86-inventory-card
title: Inventory
```

If more than one shared bar is configured, add the config entry ID:

```yaml
type: custom:proof86-inventory-card
entry_id: 01JEXAMPLE
```

The card includes a vertically scrollable bottle list, text search, horizontal
category chips, and sorting by name or fullness. Bottle rows show category,
ABV, estimated remaining volume, low-stock status, and a category-colored
fullness bar.

For landscape displays, the card also includes a horizontal inventory canvas
with a touch-friendly two- or three-column bottle grid. Search, Filter, and
Sort buttons open large in-card action sheets suitable for kiosk WebViews.
Choose **Automatic**, **Vertical list**, or **Horizontal canvas** from the
graphical card editor. Automatic selects the horizontal canvas when both the
card and viewport are wide; either layout can be forced for a specific
dashboard. Appearance can follow Home Assistant or be locked to the card's
light or dark palette.

The graphical editor also has separate 0–100% opacity sliders for the outer
card background and individual bottle tiles. Both default to 100%, preserving
the normal Home Assistant appearance. Existing `card_mod` styles remain
compatible; an `!important` background declaration overrides the outer card's
configured background.

The list is 640 pixels tall by default. The visual editor can set it from 320
to 1200 pixels. The same setting is available manually:

```yaml
type: custom:proof86-inventory-card
title: Inventory
max_height: 800
sort: fullness-desc
```

Supported initial sort values are `name-asc`, `name-desc`, `fullness-desc`, and
`fullness-asc`. The sort can also be changed directly from the card.

Fullness bars are only shown when a bottle has a recognized fullness value.
Their light- or dark-theme color is selected from the bottle's 86Proof
category. If a more specific Firebase category is not in the palette, the card
falls back to the bottle type and then to a neutral color.

The card subscribes to inventory snapshots from the integration over Home
Assistant's authenticated WebSocket connection. Bottle details are not copied
into entity attributes or recorded in Home Assistant's state history.

## Development

Requirements:

- Python 3.13
- [uv](https://docs.astral.sh/uv/)

Run the checks:

```bash
uv sync
uv run ruff check .
uv run pytest
```

The integration lives in [`custom_components/proof86`](custom_components/proof86).

## Installation

There is no supported release yet. Once the first release is ready, this
repository will be installable as a custom HACS integration.

## Security

Do not configure this integration with a Firebase service-account key.
Home Assistant receives a normal Firebase viewer identity scoped by the
existing Firestore membership rules. Removing that viewer from 86Proof revokes
its inventory access.

Please report vulnerabilities privately rather than opening a public issue.

## License

[MIT](LICENSE)
