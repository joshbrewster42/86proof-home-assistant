const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const registry = new Map();

global.HTMLElement = class {
  attachShadow() {
    this.shadowRoot = {
      innerHTML: "",
      querySelector: () => null,
      querySelectorAll: () => [],
    };
  }
};
global.customElements = {
  define: (tag, element) => registry.set(tag, element),
  get: (tag) => registry.get(tag),
};
global.window = { customCards: [] };

require("../../custom_components/proof86/frontend/proof86-card.js");

const InventoryCard = registry.get("proof86-inventory-card");

const createCard = (config = {}) => {
  const card = new InventoryCard();
  card.setConfig(config);
  return card;
};

test("registers a graphical editor form and useful defaults", () => {
  const form = InventoryCard.getConfigForm();
  const defaults = InventoryCard.getStubConfig();

  assert.ok(form.schema.some((field) => field.name === "max_height"));
  assert.equal(defaults.card_width, "wide");
  assert.equal(defaults.show_fullness_bars, true);
});

test("returns the configured Sections-dashboard width", () => {
  assert.equal(createCard({ card_width: "narrow" }).getGridOptions().columns, 6);
  assert.equal(createCard({ card_width: "medium" }).getGridOptions().columns, 9);
  assert.equal(createCard({ card_width: "wide" }).getGridOptions().columns, 12);
  assert.equal(
    createCard({ card_width: "full" }).getGridOptions().columns,
    "full",
  );
});

test("uses category colors and falls back to the bottle type", () => {
  const card = createCard();

  assert.equal(
    card._categoryColor({ category: "Fruit", type: "Liqueur" }),
    "#c15d7c",
  );
  assert.equal(
    card._categoryColor({ category: "London Dry", type: "Gin" }),
    "#5ca17c",
  );
  assert.equal(
    card._categoryColor({ category: "Unknown", type: "Mixer" }),
    "#8dc6dd",
  );

  card._darkMode = true;
  assert.equal(
    card._categoryColor({ category: "Fruit", type: "Liqueur" }),
    "#d67c98",
  );
});

test("only renders fullness and remaining volume for known levels", () => {
  const card = createCard();
  const known = card._bottleTemplate({
    name: "Known",
    category: "Gin",
    type: "Spirit",
    size: 750,
    fullness: "half",
  });
  const unknown = card._bottleTemplate({
    name: "Unknown",
    category: "Gin",
    type: "Spirit",
    size: 750,
    fullness: null,
  });

  assert.match(known, /class="meter"/);
  assert.match(known, />375 mL</);
  assert.doesNotMatch(unknown, /class="meter"/);
  assert.doesNotMatch(unknown, /mL</);
});

test("visual visibility settings remove optional bottle details", () => {
  const card = createCard({
    show_abv: false,
    show_remaining_volume: false,
    show_fullness_bars: false,
  });
  const bottle = card._bottleTemplate({
    name: "Hidden details",
    category: "Whiskey",
    type: "Spirit",
    abv: 50,
    size: 750,
    fullness: "full",
  });

  assert.doesNotMatch(bottle, /50\.0%/);
  assert.doesNotMatch(bottle, /mL</);
  assert.doesNotMatch(bottle, /class="meter"/);
});

test("renders the bundled custom bottle header icon", () => {
  const card = createCard();
  card._inventory = {
    bar: { name: "Home Bar" },
    bottles: [],
  };
  card._render();

  assert.match(card.shadowRoot.innerHTML, /class="header-icon"/);
  assert.doesNotMatch(card.shadowRoot.innerHTML, /mdi:bottle-tonic-outline/);
});

test("avoids JavaScript features missing from older Silk runtimes", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "../../custom_components/proof86/frontend/proof86-card.js",
    ),
    "utf8",
  );

  assert.doesNotMatch(source, /\basync\s+[_a-z]/);
  assert.doesNotMatch(source, /\bawait\b/);
  assert.doesNotMatch(source, /\.includes\(/);
  assert.doesNotMatch(source, /\.replaceAll\(/);
  assert.doesNotMatch(source, /\?\./);
  assert.doesNotMatch(source, /\?\?/);
  assert.doesNotMatch(source, /,\s*\)/);
});
