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

Add the inventory card to a dashboard using Home Assistant's manual card:

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

The list is 640 pixels tall by default. Set `max_height` to a value from 320 to
1200 pixels to fit a particular dashboard:

```yaml
type: custom:proof86-inventory-card
title: Inventory
max_height: 800
sort: fullness-desc
```

Supported initial sort values are `name-asc`, `name-desc`, `fullness-desc`, and
`fullness-asc`. The sort can also be changed directly from the card.

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
