const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const registry = new Map();
const scheduledWindowTimers = [];

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
global.window = {
  customCards: [
    {
      type: "proof86-inventory-card",
      name: "Stale 86Proof Inventory",
      preview: true,
    },
  ],
  setTimeout: (callback, delay) => {
    scheduledWindowTimers.push({ callback, delay });
    return scheduledWindowTimers.length;
  },
  clearTimeout: () => {},
};

const nativeIntl = global.Intl;
global.Intl = {
  Collator: class {
    constructor() {
      throw new Error("ICU locale data unavailable");
    }
  },
};
require("../../custom_components/proof86/frontend/proof86-card.js");
global.Intl = nativeIntl;

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
  assert.ok(form.schema.some((field) => field.name === "layout"));
  assert.equal(defaults.card_width, "wide");
  assert.equal(defaults.layout, "auto");
  assert.equal(defaults.background_color, "");
  assert.equal(defaults.bottle_color, "");
  assert.equal(defaults.chip_color, "");
  assert.equal(defaults.button_color, "");
  assert.equal(defaults.background_opacity, 100);
  assert.equal(defaults.bottle_opacity, 100);
  assert.equal(defaults.horizontal_columns, "auto");
  assert.equal(defaults.show_fullness_bars, true);
  assert.equal(window.customCards.length, 1);
  assert.equal(window.customCards[0].name, "86Proof Inventory");
  assert.equal(window.customCards[0].preview, false);
});

test("applies configurable card and bottle transparency", () => {
  const card = createCard({
    layout: "horizontal",
    background_color: "#FFF",
    background_opacity: 20,
    bottle_color: "#17171F",
    bottle_opacity: 65,
    chip_color: "#FFF",
    chip_opacity: 15,
    button_color: "#FFF",
    button_opacity: 25,
  });
  card._inventory = {
    bar: { name: "Home Bar" },
    bottles: [{ name: "Sipsmith VJOP", category: "Gin", type: "Spirit" }],
  };
  card._render();

  assert.match(card.shadowRoot.innerHTML, /--proof86-card-opacity:20%/);
  assert.match(card.shadowRoot.innerHTML, /--proof86-bottle-opacity:65%/);
  assert.match(card.shadowRoot.innerHTML, /--proof86-card-color:#FFF/);
  assert.match(card.shadowRoot.innerHTML, /--proof86-bottle-color:#17171F/);
  assert.match(card.shadowRoot.innerHTML, /--proof86-chip-color:#FFF/);
  assert.match(card.shadowRoot.innerHTML, /--proof86-chip-opacity:15%/);
  assert.match(card.shadowRoot.innerHTML, /--proof86-button-color:#FFF/);
  assert.match(card.shadowRoot.innerHTML, /--proof86-button-opacity:25%/);
  assert.match(card.shadowRoot.innerHTML, /color-mix\(/);
});

test("rejects invalid custom background colors", () => {
  const card = createCard({
    background_color: "white",
    bottle_color: "#12345; background:red",
    chip_color: "transparent",
    button_color: "#12",
  });

  assert.equal(card._config.background_color, "");
  assert.equal(card._config.bottle_color, "");
  assert.equal(card._config.chip_color, "");
  assert.equal(card._config.button_color, "");
});

test("renders the horizontal inventory canvas and touch actions", () => {
  const card = createCard({
    layout: "horizontal",
    horizontal_columns: "2",
  });
  card._inventory = {
    bar: { name: "Home Bar" },
    bottles: [
      {
        name: "Sipsmith VJOP",
        category: "Gin",
        type: "Spirit",
        abv: 57.7,
        size: 750,
        fullness: "quarter",
      },
    ],
  };
  card._render();

  assert.match(card.shadowRoot.innerHTML, /class="horizontal/);
  assert.match(card.shadowRoot.innerHTML, /class="bottles canvas"/);
  assert.match(card.shadowRoot.innerHTML, /data-panel="search"/);
  assert.match(card.shadowRoot.innerHTML, /data-panel="sort"/);
  assert.doesNotMatch(card.shadowRoot.innerHTML, /data-panel="filter"/);
  assert.match(card.shadowRoot.innerHTML, /--proof86-columns:2/);
  assert.doesNotMatch(card.shadowRoot.innerHTML, /action-summary/);
});

test("renders search and sort action sheets", () => {
  const card = createCard({ layout: "horizontal" });
  card._inventory = {
    bar: { name: "Home Bar" },
    bottles: [{ name: "Sipsmith VJOP", category: "Gin", type: "Spirit" }],
  };

  card._panel = "search";
  card._render();
  assert.match(card.shadowRoot.innerHTML, /Search your bar/);
  assert.match(card.shadowRoot.innerHTML, /panel-search-input/);

  card._panel = "sort";
  card._render();
  assert.match(card.shadowRoot.innerHTML, /Sort bottles/);
  assert.match(card.shadowRoot.innerHTML, /data-sort="fullness-desc"/);
});

test("automatic layout selects horizontal only for a wide card and viewport", () => {
  const card = createCard({ layout: "auto" });
  window.innerWidth = 960;
  window.innerHeight = 480;

  card._updateAutomaticLayout(760);
  assert.equal(card._isHorizontal(), true);

  card._updateAutomaticLayout(500);
  assert.equal(card._isHorizontal(), false);
});

test("registers and sorts when Android locale data is unavailable", () => {
  const card = createCard();
  card._inventory = {
    bar: { name: "Home Bar" },
    bottles: [{ name: "Zulu" }, { name: "alpha" }],
  };

  assert.deepEqual(
    card._filteredBottles().map((bottle) => bottle.name),
    ["alpha", "Zulu"],
  );
});

test("re-registers after Home Assistant replaces its startup registry", () => {
  registry.clear();
  assert.equal(registry.get("proof86-inventory-card"), undefined);

  scheduledWindowTimers[0].callback();

  assert.equal(registry.get("proof86-inventory-card"), InventoryCard);
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
