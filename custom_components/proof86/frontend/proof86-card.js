const CARD_TAG = "proof86-inventory-card";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const normalized = (value) =>
  String(value == null ? "" : value).trim().toLocaleLowerCase();
let nameCollator = null;
try {
  if (typeof Intl !== "undefined" && Intl.Collator) {
    nameCollator = new Intl.Collator(undefined, {
      sensitivity: "base",
      numeric: true,
    });
  }
} catch (_error) {
  // Some lightweight Android builds ship WebView without complete ICU data.
}

const compareNames = (left, right) => {
  const leftName = String(left == null ? "" : left);
  const rightName = String(right == null ? "" : right);
  if (nameCollator) return nameCollator.compare(leftName, rightName);
  const normalizedLeft = normalized(leftName);
  const normalizedRight = normalized(rightName);
  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  return 0;
};

const FULLNESS_LEVELS = {
  full: 100,
  "100%": 100,
  "¾": 75,
  "3/4": 75,
  "75%": 75,
  "three quarters": 75,
  threequarters: 75,
  half: 50,
  "½": 50,
  "1/2": 50,
  "50%": 50,
  quarter: 25,
  "¼": 25,
  "1/4": 25,
  "25%": 25,
  low: 10,
  "almost empty": 10,
  empty: 0,
  "0%": 0,
  "86d": 0,
  "86'd": 0,
};

const fullnessPercent = (value) => {
  const label = normalized(value);
  return Object.prototype.hasOwnProperty.call(FULLNESS_LEVELS, label)
    ? FULLNESS_LEVELS[label]
    : null;
};

const fullnessLabel = (value) => {
  const percent = fullnessPercent(value);
  if (percent === 100) return "Full";
  if (percent === 75) return "¾";
  if (percent === 50) return "½";
  if (percent === 25) return "¼";
  if (percent === 10) return "Low";
  if (percent === 0) return "Empty";
  return value || "Unknown";
};

const CATEGORY_COLORS = {
  whiskey: ["#c1742e", "#c47a2e"],
  scotch: ["#d9a441", "#e8bc5f"],
  vodka: ["#5ba4e6", "#7bbaf0"],
  gin: ["#5ca17c", "#77b993"],
  rum: ["#8b572a", "#a87348"],
  tequila: ["#b7b46a", "#a7a25c"],
  mezcal: ["#7a8b71", "#95a68c"],
  brandy: ["#ad6b3a", "#c88858"],
  cognac: ["#c06030", "#d87d52"],
  asian: ["#6c7b9c", "#8a98b8"],
  "other spirit": ["#a0a0a0", "#b8b8b8"],
  red: ["#7a1f1f", "#a53b3b"],
  white: ["#e3c66e", "#edd88a"],
  rosé: ["#e9a8a6", "#f2c0be"],
  sparkling: ["#e4d5b7", "#efe5ce"],
  fortified: ["#c59b3a", "#d9b358"],
  fruit: ["#c15d7c", "#d67c98"],
  "herbal / botanical": ["#5d814d", "#729c63"],
  "nut / seed": ["#7b563a", "#9c7858"],
  "coffee / chocolate": ["#5a3a2e", "#7d5a4a"],
  cream: ["#dcc7a1", "#e8d9bb"],
  vermouth: ["#892e33", "#b0494f"],
  amaro: ["#c9562c", "#e47145"],
  "other apéritifs": ["#d1a642", "#e6c05e"],
  aromatic: ["#6b3520", "#9a5540"],
  citrus: ["#e07c35", "#f2a86c"],
  "herbal / spice": ["#437d68", "#5d9e86"],
  specialty: ["#5a3a2e", "#7d5a4a"],
  syrups: ["#b97239", "#d38d56"],
  shrubs: ["#c15061", "#d46e7c"],
  "juices / purees": ["#e3b045", "#f0c566"],
  "sodas / tonics": ["#8dc6dd", "#a8d8eb"],
  "bitters (alternative)": ["#678b6b", "#85a886"],
  garnishes: ["#ce8aae", "#dda6c4"],
  "creams / dairy": ["#eadbc0", "#f2ead6"],
  "other mixer": ["#8f8c86", "#b0aba5"],
  "non-alcoholic": ["#6c7b9c", "#8a98b8"],
};

const TYPE_COLORS = {
  spirit: ["#c1742e", "#c47a2e"],
  wine: ["#7a1f1f", "#a53b3b"],
  liqueur: ["#788e55", "#8fa768"],
  "apéritif/digestif": ["#e07c35", "#f2a86c"],
  "apéritif / digestif": ["#e07c35", "#f2a86c"],
  "aperitif/digestif": ["#e07c35", "#f2a86c"],
  "aperitif / digestif": ["#e07c35", "#f2a86c"],
  bitters: ["#a0462d", "#ba5535"],
  mixer: ["#8dc6dd", "#a8d8eb"],
  mixers: ["#8dc6dd", "#a8d8eb"],
  "mixers & ingredients": ["#8dc6dd", "#a8d8eb"],
  "non-alcoholic": ["#6c7b9c", "#8a98b8"],
};

const DEFAULT_COLORS = ["#8f8c86", "#b0aba5"];
const CARD_WIDTHS = {
  narrow: 6,
  medium: 9,
  wide: 12,
  full: "full",
};

class Proof86InventoryCard extends HTMLElement {
  static getConfigForm() {
    const sortOptions = [
      { value: "name-asc", label: "Name A–Z" },
      { value: "name-desc", label: "Name Z–A" },
      { value: "fullness-desc", label: "Fullest first" },
      { value: "fullness-asc", label: "Emptiest first" },
    ];
    const widthOptions = [
      { value: "narrow", label: "Narrow (6 columns)" },
      { value: "medium", label: "Medium (9 columns)" },
      { value: "wide", label: "Wide (12 columns)" },
      { value: "full", label: "Full section width" },
    ];
    const layoutOptions = [
      { value: "auto", label: "Automatic (recommended)" },
      { value: "vertical", label: "Vertical list" },
      { value: "horizontal", label: "Horizontal canvas" },
    ];
    const columnOptions = [
      { value: "auto", label: "Automatic" },
      { value: "2", label: "2 columns" },
      { value: "3", label: "3 columns" },
    ];
    const densityOptions = [
      { value: "comfortable", label: "Comfortable" },
      { value: "compact", label: "Compact" },
    ];
    const appearanceOptions = [
      { value: "auto", label: "Follow Home Assistant" },
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ];

    return {
      schema: [
        { name: "title", selector: { text: {} } },
        {
          name: "layout",
          selector: { select: { options: layoutOptions, mode: "dropdown" } },
        },
        {
          name: "appearance",
          selector: {
            select: { options: appearanceOptions, mode: "dropdown" },
          },
        },
        {
          type: "expandable",
          name: "",
          title: "Transparency",
          flatten: true,
          schema: [
            {
              name: "background_opacity",
              selector: {
                number: {
                  min: 0,
                  max: 100,
                  step: 5,
                  mode: "slider",
                  unit_of_measurement: "%",
                },
              },
            },
            {
              name: "bottle_opacity",
              selector: {
                number: {
                  min: 0,
                  max: 100,
                  step: 5,
                  mode: "slider",
                  unit_of_measurement: "%",
                },
              },
            },
          ],
        },
        {
          type: "grid",
          name: "",
          flatten: true,
          column_min_width: "200px",
          schema: [
            {
              name: "sort",
              selector: { select: { options: sortOptions, mode: "dropdown" } },
            },
            {
              name: "card_width",
              selector: { select: { options: widthOptions, mode: "dropdown" } },
            },
          ],
        },
        {
          type: "expandable",
          name: "",
          title: "Horizontal layout",
          flatten: true,
          schema: [
            {
              name: "horizontal_columns",
              selector: {
                select: { options: columnOptions, mode: "dropdown" },
              },
            },
            {
              name: "horizontal_density",
              selector: {
                select: { options: densityOptions, mode: "dropdown" },
              },
            },
            {
              name: "horizontal_height",
              selector: {
                number: {
                  min: 320,
                  max: 720,
                  step: 20,
                  mode: "slider",
                  unit_of_measurement: "px",
                },
              },
            },
          ],
        },
        {
          name: "max_height",
          selector: {
            number: {
              min: 320,
              max: 1200,
              step: 40,
              mode: "slider",
              unit_of_measurement: "px",
            },
          },
        },
        {
          type: "expandable",
          name: "",
          title: "Visible details",
          flatten: true,
          schema: [
            { name: "show_search", selector: { boolean: {} } },
            { name: "show_category_chips", selector: { boolean: {} } },
            { name: "show_abv", selector: { boolean: {} } },
            { name: "show_remaining_volume", selector: { boolean: {} } },
            { name: "show_fullness_bars", selector: { boolean: {} } },
          ],
        },
      ],
      computeLabel: (schema) => {
        const labels = {
          title: "Card title",
          layout: "Layout",
          appearance: "Appearance",
          background_opacity: "Card background",
          bottle_opacity: "Bottle tiles",
          sort: "Initial sorting",
          card_width: "Preferred card width",
          horizontal_columns: "Bottle columns",
          horizontal_density: "Bottle spacing",
          horizontal_height: "Horizontal card height",
          max_height: "Scrollable list height",
          show_search: "Search field",
          show_category_chips: "Category filters",
          show_abv: "Alcohol percentage",
          show_remaining_volume: "Estimated remaining volume",
          show_fullness_bars: "Bottle fullness bars",
        };
        return labels[schema.name];
      },
      computeHelper: (schema) => {
        const helpers = {
          layout:
            "Automatic uses the horizontal canvas on a wide card in a landscape viewport.",
          card_width:
            "Sets the default width in a Sections dashboard. You can also resize the card directly on the dashboard.",
          horizontal_columns:
            "Automatic uses two columns for readable bottle names on small landscape displays.",
          horizontal_height:
            "Sets the complete card height when the horizontal canvas is active.",
        };
        return helpers[schema.name];
      },
    };
  }

  static getStubConfig() {
    return {
      title: "Inventory",
      layout: "auto",
      appearance: "auto",
      background_opacity: 100,
      bottle_opacity: 100,
      sort: "name-asc",
      card_width: "wide",
      horizontal_columns: "auto",
      horizontal_density: "comfortable",
      horizontal_height: 400,
      max_height: 640,
      show_search: true,
      show_category_chips: true,
      show_abv: true,
      show_remaining_volume: true,
      show_fullness_bars: true,
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._inventory = null;
    this._error = null;
    this._query = "";
    this._category = "all";
    this._sort = "name-asc";
    this._darkMode = false;
    this._panel = null;
    this._autoHorizontal = false;
    this._resizeObserver = null;
    this._subscriptionRequested = false;
    this._subscriptionTimer = null;
  }

  setConfig(config) {
    const maxHeight = Number(
      config.max_height == null ? 640 : config.max_height
    );
    this._config = Object.assign(
      {
        title: "Inventory",
        layout: "auto",
        appearance: "auto",
        background_opacity: 100,
        bottle_opacity: 100,
        sort: "name-asc",
        card_width: "wide",
        horizontal_columns: "auto",
        horizontal_density: "comfortable",
        horizontal_height: 400,
        show_search: true,
        show_category_chips: true,
        show_abv: true,
        show_remaining_volume: true,
        show_fullness_bars: true,
      },
      config,
      {
        max_height: Math.max(320, Math.min(1200, maxHeight || 640)),
        background_opacity: Math.max(
          0,
          Math.min(
            100,
            config.background_opacity == null
              ? 100
              : Number(config.background_opacity)
          )
        ),
        bottle_opacity: Math.max(
          0,
          Math.min(
            100,
            config.bottle_opacity == null ? 100 : Number(config.bottle_opacity)
          )
        ),
        horizontal_height: Math.max(
          320,
          Math.min(720, Number(config.horizontal_height) || 400)
        ),
      }
    );
    this._sort = [
      "name-asc",
      "name-desc",
      "fullness-desc",
      "fullness-asc",
    ].indexOf(this._config.sort) !== -1
      ? this._config.sort
      : "name-asc";
    if (
      ["auto", "vertical", "horizontal"].indexOf(this._config.layout) === -1
    ) {
      this._config.layout = "auto";
    }
    if (["auto", "light", "dark"].indexOf(this._config.appearance) === -1) {
      this._config.appearance = "auto";
    }
    if (!Number.isFinite(this._config.background_opacity)) {
      this._config.background_opacity = 100;
    }
    if (!Number.isFinite(this._config.bottle_opacity)) {
      this._config.bottle_opacity = 100;
    }
    if (
      ["auto", "2", "3"].indexOf(this._config.horizontal_columns) === -1
    ) {
      this._config.horizontal_columns = "auto";
    }
    if (
      ["comfortable", "compact"].indexOf(
        this._config.horizontal_density
      ) === -1
    ) {
      this._config.horizontal_density = "comfortable";
    }
    if (!this._config.show_search) this._query = "";
    if (!this._config.show_category_chips) this._category = "all";
    this._darkMode =
      this._config.appearance === "dark" ||
      (this._config.appearance === "auto" &&
        Boolean(
          this._hass && this._hass.themes && this._hass.themes.darkMode
        ));
    if (this._config.layout === "vertical") this._panel = null;
    if (
      this.isConnected &&
      this.getBoundingClientRect &&
      this._config.layout === "auto"
    ) {
      this._updateAutomaticLayout(this.getBoundingClientRect().width);
    }
    this._render();
    this._ensureSubscription();
  }

  set hass(hass) {
    const appearance =
      (this._config && this._config.appearance) || "auto";
    const darkMode =
      appearance === "dark" ||
      (appearance === "auto" &&
        Boolean(hass && hass.themes && hass.themes.darkMode));
    const themeChanged = this._hass && darkMode !== this._darkMode;
    this._hass = hass;
    this._darkMode = darkMode;
    if (themeChanged) this._render();
    this._ensureSubscription();
  }

  connectedCallback() {
    this._render();
    this._ensureSubscription();
    this._observeSize();
  }

  disconnectedCallback() {
    this._disposeSubscription();
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  getCardSize() {
    const bottleCount =
      this._inventory && this._inventory.bottles
        ? this._inventory.bottles.length
        : 0;
    return Math.max(4, Math.min(12, Math.ceil(bottleCount / 3) + 3));
  }

  getGridOptions() {
    const configuredWidth =
      this._config && CARD_WIDTHS[this._config.card_width]
        ? CARD_WIDTHS[this._config.card_width]
        : CARD_WIDTHS.wide;
    return {
      columns: configuredWidth,
      min_columns: 3,
      min_rows: 4,
    };
  }

  _observeSize() {
    if (this._resizeObserver || typeof ResizeObserver === "undefined") return;
    this._resizeObserver = new ResizeObserver((entries) => {
      if (!entries || !entries.length) return;
      this._updateAutomaticLayout(entries[0].contentRect.width);
    });
    this._resizeObserver.observe(this);
  }

  _updateAutomaticLayout(width) {
    if (!this._config || this._config.layout !== "auto") return;
    const viewportIsWide =
      window.innerWidth &&
      window.innerHeight &&
      window.innerWidth > window.innerHeight * 1.2;
    const horizontal = width >= 620 && Boolean(viewportIsWide);
    if (horizontal === this._autoHorizontal) return;
    this._autoHorizontal = horizontal;
    this._panel = null;
    this._render();
  }

  _isHorizontal() {
    const layout = (this._config && this._config.layout) || "auto";
    return layout === "horizontal" || (layout === "auto" && this._autoHorizontal);
  }

  _horizontalColumns() {
    const configured =
      (this._config && this._config.horizontal_columns) || "auto";
    if (configured === "2" || configured === "3") return configured;
    return "2";
  }

  _sortLabel() {
    const labels = {
      "name-asc": "Name A–Z",
      "name-desc": "Name Z–A",
      "fullness-desc": "Fullest",
      "fullness-asc": "Emptiest",
    };
    return labels[this._sort] || labels["name-asc"];
  }

  _ensureSubscription() {
    if (
      !this.isConnected ||
      !this._config ||
      !this._hass ||
      !this._hass.connection ||
      this._subscriptionRequested
    ) {
      return;
    }

    this._subscriptionRequested = true;
    this._subscriptionTimer = window.setTimeout(
      () =>
        this._subscriptionFailed(
          new Error(
            "Inventory loading timed out. Confirm that the 86Proof integration is connected."
          )
        ),
      15000
    );
    const message = { type: "proof86/inventory/subscribe" };
    if (this._config.entry_id) {
      message.entry_id = this._config.entry_id;
    }

    let subscription;
    try {
      subscription = this._hass.connection.subscribeMessage(
        (inventory) => {
          this._clearSubscriptionTimer();
          this._inventory = inventory;
          this._error = null;
          this._render();
        },
        message
      );
    } catch (error) {
      this._subscriptionFailed(error);
      return;
    }

    Promise.resolve(subscription).then(
      (unsubscribe) => {
        if (this.isConnected && this._subscriptionRequested) {
          this._unsubscribe = unsubscribe;
        } else {
          unsubscribe();
          this._subscriptionRequested = false;
        }
      },
      (error) => this._subscriptionFailed(error)
    );
  }

  _subscriptionFailed(error) {
    this._clearSubscriptionTimer();
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this._error =
      (error && error.message) ||
      "Unable to load the shared inventory. Confirm that 86Proof is connected.";
    this._subscriptionRequested = false;
    this._render();
  }

  _disposeSubscription() {
    this._clearSubscriptionTimer();
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this._subscriptionRequested = false;
  }

  _clearSubscriptionTimer() {
    if (this._subscriptionTimer != null) {
      window.clearTimeout(this._subscriptionTimer);
      this._subscriptionTimer = null;
    }
  }

  _categoryLabel(bottle) {
    const type = String(bottle.type || "").trim();
    if (["Liqueur", "Bitters", "Mixer"].indexOf(type) !== -1) return type;
    return String(bottle.category || type || "Other").trim();
  }

  _rowCategory(bottle) {
    return String(bottle.category || bottle.type || "Other").trim();
  }

  _categoryColor(bottleOrLabel) {
    let colors;
    if (typeof bottleOrLabel === "string") {
      const key = normalized(bottleOrLabel);
      colors = CATEGORY_COLORS[key] || TYPE_COLORS[key];
    } else {
      const category = normalized(bottleOrLabel.category);
      const type = normalized(bottleOrLabel.type);
      colors =
        CATEGORY_COLORS[category] ||
        CATEGORY_COLORS[type] ||
        TYPE_COLORS[type] ||
        TYPE_COLORS[category];
    }
    colors = colors || DEFAULT_COLORS;
    return colors[this._darkMode ? 1 : 0];
  }

  _filteredBottles() {
    const query = normalized(this._query);
    const inventoryBottles =
      this._inventory && this._inventory.bottles
        ? this._inventory.bottles
        : [];
    const bottles = inventoryBottles.filter((bottle) => {
      const matchesCategory =
        this._category === "all" ||
        normalized(this._categoryLabel(bottle)) === this._category;
      const haystack = [
        bottle.name,
        bottle.type,
        bottle.category,
        bottle.style,
        bottle.fullness,
        bottle.notes,
        bottle.julep_blurb,
      ]
        .map(normalized)
        .join(" ");
      return matchesCategory && haystack.indexOf(query) !== -1;
    });

    return bottles.sort((left, right) => {
      const nameOrder = compareNames(left.name || "", right.name || "");
      if (this._sort === "name-desc") return -nameOrder;
      if (this._sort === "fullness-desc" || this._sort === "fullness-asc") {
        const leftPercent = fullnessPercent(left.fullness);
        const rightPercent = fullnessPercent(right.fullness);
        if (leftPercent == null && rightPercent != null) return 1;
        if (leftPercent != null && rightPercent == null) return -1;
        const fullnessOrder =
          (rightPercent == null ? 0 : rightPercent) -
          (leftPercent == null ? 0 : leftPercent);
        if (fullnessOrder !== 0) {
          return this._sort === "fullness-desc"
            ? fullnessOrder
            : -fullnessOrder;
        }
      }
      return nameOrder;
    });
  }

  _categories() {
    const categories = new Map();
    const bottles =
      this._inventory && this._inventory.bottles
        ? this._inventory.bottles
        : [];
    for (const bottle of bottles) {
      const label = this._categoryLabel(bottle);
      const value = normalized(label);
      const existing = categories.get(value);
      categories.set(value, {
        value,
        label,
        count: (existing ? existing.count : 0) + 1,
        color: existing ? existing.color : this._categoryColor(bottle),
      });
    }
    return Array.from(categories.values()).sort(
      (left, right) =>
        right.count - left.count || compareNames(left.label, right.label)
    );
  }

  _render() {
    if (!this.shadowRoot) return;

    const title = escapeHtml(
      (this._config && this._config.title) || "Inventory"
    );
    if (this._error) {
      this.shadowRoot.innerHTML = `
        ${this._styles()}
        <ha-card>
          <div class="header simple-header"><h1>${title}</h1></div>
          <div class="state error">${escapeHtml(this._error)}</div>
        </ha-card>
      `;
      return;
    }

    if (!this._inventory) {
      this.shadowRoot.innerHTML = `
        ${this._styles()}
        <ha-card>
          <div class="header simple-header"><h1>${title}</h1></div>
          <div class="state"><ha-circular-progress active></ha-circular-progress>Loading inventory…</div>
        </ha-card>
      `;
      return;
    }

    const filtered = this._filteredBottles();
    const categories = this._categories();
    const barName = escapeHtml(
      (this._inventory.bar && this._inventory.bar.name) || "Shared Bar"
    );
    const total = this._inventory.bottles.length;
    const maxHeight =
      this._config && this._config.max_height != null
        ? this._config.max_height
        : 640;
    const horizontalHeight =
      this._config && this._config.horizontal_height != null
        ? this._config.horizontal_height
        : 400;
    const horizontal = this._isHorizontal();
    const density =
      this._config.horizontal_density === "compact"
        ? "density-compact"
        : "density-comfortable";
    const columns = this._horizontalColumns();
    const backgroundOpacity = Number.isFinite(this._config.background_opacity)
      ? this._config.background_opacity
      : 100;
    const bottleOpacity = Number.isFinite(this._config.bottle_opacity)
      ? this._config.bottle_opacity
      : 100;
    const appearance =
      this._config.appearance === "light"
        ? "appearance-light"
        : this._config.appearance === "dark"
          ? "appearance-dark"
          : "";

    this.shadowRoot.innerHTML = `
      ${this._styles()}
      <ha-card
        class="${horizontal ? "horizontal" : "vertical"} ${density} ${appearance}"
        style="--proof86-list-height:${maxHeight}px;--proof86-horizontal-height:${horizontalHeight}px;--proof86-columns:${columns};--proof86-card-opacity:${backgroundOpacity}%;--proof86-bottle-opacity:${bottleOpacity}%"
      >
        <div class="header">
          <div>
            <div class="eyebrow">${barName} <span>•</span> ${total} ${total === 1 ? "Bottle" : "Bottles"}</div>
            <h1>${title}</h1>
          </div>
          ${
            horizontal
              ? this._actionButtonsTemplate()
              : `<span class="header-icon" aria-hidden="true"></span>`
          }
        </div>
        ${
          horizontal
            ? this._horizontalContent(filtered, categories)
            : this._verticalContent(filtered, categories)
        }
        ${horizontal ? this._panelTemplate() : ""}
      </ha-card>
    `;

    this._bindInteractions();
  }

  _chipsTemplate(categories) {
    if (!this._config.show_category_chips) return "";
    return `
      <div class="chips" role="group" aria-label="Filter by category">
        <button
          class="chip ${this._category === "all" ? "selected" : ""}"
          data-category="all"
          aria-pressed="${this._category === "all"}"
        >All</button>
        ${categories
          .map(
            (category) => `
              <button
                class="chip ${this._category === category.value ? "selected" : ""}"
                data-category="${escapeHtml(category.value)}"
                aria-pressed="${this._category === category.value}"
              >
                <i style="background:${category.color}"></i>${escapeHtml(category.label)}
              </button>
            `
          )
          .join("")}
      </div>
    `;
  }

  _bottlesTemplate(filtered) {
    return filtered.length
      ? filtered.map((bottle) => this._bottleTemplate(bottle)).join("")
      : `<div class="empty-state">
           <ha-icon icon="mdi:magnify"></ha-icon>
           <strong>No bottles found</strong>
           <span>Try a different search or category.</span>
         </div>`;
  }

  _verticalContent(filtered, categories) {
    return `
      ${
        this._config.show_search
          ? `<div class="search-row">
               <label class="search">
                 <ha-icon icon="mdi:magnify"></ha-icon>
                 <input
                   type="search"
                   aria-label="Search bottles"
                   placeholder="Search your bar…"
                   value="${escapeHtml(this._query)}"
                 >
               </label>
             </div>`
          : ""
      }
      ${this._chipsTemplate(categories)}
      <div class="list-tools">
        <span>${filtered.length} ${filtered.length === 1 ? "bottle" : "bottles"}</span>
        <label class="sort">
          <span class="sr-only">Sort inventory</span>
          <select class="sort-select" aria-label="Sort inventory">
            <option value="name-asc" ${this._sort === "name-asc" ? "selected" : ""}>Name A–Z</option>
            <option value="name-desc" ${this._sort === "name-desc" ? "selected" : ""}>Name Z–A</option>
            <option value="fullness-desc" ${this._sort === "fullness-desc" ? "selected" : ""}>Fullest first</option>
            <option value="fullness-asc" ${this._sort === "fullness-asc" ? "selected" : ""}>Emptiest first</option>
          </select>
          <ha-icon icon="mdi:chevron-down"></ha-icon>
        </label>
      </div>
      <div class="bottles">${this._bottlesTemplate(filtered)}</div>
    `;
  }

  _horizontalContent(filtered, categories) {
    return `
      ${this._chipsTemplate(categories)}
      <div class="bottles canvas">${this._bottlesTemplate(filtered)}</div>
    `;
  }

  _actionButtonsTemplate() {
    return `
      <div class="action-buttons" aria-label="Inventory tools">
        ${
          this._config.show_search
            ? `<button class="action-button ${this._query ? "active" : ""}" data-panel="search">
                 <ha-icon icon="mdi:magnify"></ha-icon>
                 <span>${this._query ? "Searching" : "Search"}</span>
               </button>`
            : ""
        }
        <button class="action-button" data-panel="sort">
          <ha-icon icon="mdi:sort"></ha-icon>
          <span>${escapeHtml(this._sortLabel())}</span>
        </button>
      </div>
    `;
  }

  _panelTemplate() {
    if (!this._panel) return "";
    let content = "";
    if (this._panel === "search") {
      content = `
        <div class="sheet-title">
          <div><ha-icon icon="mdi:magnify"></ha-icon><strong>Search your bar</strong></div>
          <button class="close-panel" aria-label="Close search"><ha-icon icon="mdi:close"></ha-icon></button>
        </div>
        <label class="search sheet-search">
          <ha-icon icon="mdi:magnify"></ha-icon>
          <input
            class="panel-search-input"
            type="search"
            aria-label="Search bottles"
            placeholder="Bottle, category, style…"
            value="${escapeHtml(this._query)}"
          >
          ${
            this._query
              ? `<button class="clear-search" aria-label="Clear search"><ha-icon icon="mdi:close-circle"></ha-icon></button>`
              : ""
          }
        </label>
      `;
    } else {
      const sortOptions = [
        ["name-asc", "Name A–Z", "mdi:sort-alphabetical-ascending"],
        ["name-desc", "Name Z–A", "mdi:sort-alphabetical-descending"],
        ["fullness-desc", "Fullest first", "mdi:sort-descending"],
        ["fullness-asc", "Emptiest first", "mdi:sort-ascending"],
      ];
      content = `
        <div class="sheet-title">
          <div><ha-icon icon="mdi:sort"></ha-icon><strong>Sort bottles</strong></div>
          <button class="close-panel" aria-label="Close sorting"><ha-icon icon="mdi:close"></ha-icon></button>
        </div>
        <div class="sheet-options sort-options">
          ${sortOptions
            .map(
              (option) => `
                <button class="sheet-option ${this._sort === option[0] ? "selected" : ""}" data-sort="${option[0]}">
                  <span><ha-icon icon="${option[2]}"></ha-icon>${option[1]}</span>
                  ${this._sort === option[0] ? `<ha-icon icon="mdi:check"></ha-icon>` : ""}
                </button>
              `
            )
            .join("")}
        </div>
      `;
    }
    return `
      <div class="panel-backdrop" role="presentation">
        <section class="action-sheet ${this._panel}-sheet" role="dialog" aria-modal="true">
          ${content}
        </section>
      </div>
    `;
  }

  _bindInteractions() {
    this.shadowRoot.onkeydown = (event) => {
      if (!this._panel || event.key !== "Escape") return;
      this._panel = null;
      this._render();
    };
    const searchInput = this.shadowRoot.querySelector('input[type="search"]');
    if (searchInput) {
      searchInput.addEventListener("input", (event) => {
        this._query = event.target.value;
        this._render();
        const search = this.shadowRoot.querySelector('input[type="search"]');
        if (search) {
          search.focus();
          search.setSelectionRange(this._query.length, this._query.length);
        }
      });
    }

    for (const chip of this.shadowRoot.querySelectorAll("[data-category]")) {
      chip.addEventListener("click", () => {
        this._category = chip.dataset.category;
        this._render();
      });
    }

    const sortSelect = this.shadowRoot.querySelector(".sort-select");
    if (sortSelect) {
      sortSelect.addEventListener("change", (event) => {
        this._sort = event.target.value;
        this._render();
      });
    }

    for (const button of this.shadowRoot.querySelectorAll("[data-panel]")) {
      button.addEventListener("click", () => {
        this._panel = button.dataset.panel;
        this._render();
        if (this._panel === "search") {
          const input = this.shadowRoot.querySelector(".panel-search-input");
          if (input) input.focus();
        }
      });
    }

    for (const button of this.shadowRoot.querySelectorAll("[data-sort]")) {
      button.addEventListener("click", () => {
        this._sort = button.dataset.sort;
        this._panel = null;
        this._render();
      });
    }

    const closePanel = this.shadowRoot.querySelector(".close-panel");
    if (closePanel) {
      closePanel.addEventListener("click", () => {
        this._panel = null;
        this._render();
      });
    }

    const backdrop = this.shadowRoot.querySelector(".panel-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", (event) => {
        if (event.target !== backdrop) return;
        this._panel = null;
        this._render();
      });
    }

    const clearSearch = this.shadowRoot.querySelector(".clear-search");
    if (clearSearch) {
      clearSearch.addEventListener("click", () => {
        this._query = "";
        this._render();
        const input = this.shadowRoot.querySelector(".panel-search-input");
        if (input) input.focus();
      });
    }
  }

  _bottleTemplate(bottle) {
    const percent = fullnessPercent(bottle.fullness);
    const category = this._rowCategory(bottle);
    const color = this._categoryColor(bottle);
    const isLow = percent != null && percent > 0 && percent <= 25;
    const isEmpty = percent === 0;
    const size = bottle.size == null ? null : Number(bottle.size);
    const remaining =
      Number.isFinite(size) && percent != null
        ? Math.round(size * (percent / 100))
        : null;
    const abv = Number(bottle.abv);
    const meta = [
      category,
      this._config.show_abv && Number.isFinite(abv) && abv > 0
        ? `${abv.toFixed(1)}%`
        : null,
    ].filter(Boolean);

    return `
      <article class="bottle" style="--category-color:${color}">
        <div class="bottle-top">
          <div class="bottle-name">
            <strong title="${escapeHtml(bottle.name || "Unnamed Bottle")}">${escapeHtml(bottle.name || "Unnamed Bottle")}</strong>
            <span>${meta.map(escapeHtml).join(" · ")}</span>
          </div>
          <div class="bottle-status">
            ${
              isLow
                ? `<span class="stock low">Low</span>`
                : isEmpty
                  ? `<span class="stock empty">Empty</span>`
                  : ""
            }
            ${
              !this._config.show_remaining_volume || remaining == null
                ? ""
                : `<span class="remaining">${remaining.toLocaleString()} mL</span>`
            }
          </div>
        </div>
        ${
          this._config.show_fullness_bars && percent != null
            ? `<div class="meter" role="img" aria-label="Fullness: ${escapeHtml(fullnessLabel(bottle.fullness))}">
                 <i style="width:${percent}%"></i>
               </div>`
            : ""
        }
      </article>
    `;
  }

  _styles() {
    return `
      <style>
        :host {
          display: block;
          --proof86-mono: ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, monospace;
        }
        * { box-sizing: border-box; }
        ha-card {
          --proof86-primary-text: var(--primary-text-color);
          --proof86-secondary-text: var(--secondary-text-color);
          --proof86-primary-bg: var(--primary-background-color);
          --proof86-secondary-bg: var(--secondary-background-color);
          --proof86-surface: var(--card-background-color);
          --proof86-divider: var(--divider-color);
          --proof86-error: var(--error-color);
          background: var(--proof86-secondary-bg);
          background: color-mix(
            in srgb,
            var(--proof86-secondary-bg) var(--proof86-card-opacity),
            transparent
          );
          overflow: hidden;
        }
        ha-card.appearance-light {
          --proof86-primary-text: #171717;
          --proof86-secondary-text: #77736e;
          --proof86-primary-bg: #f6f3ed;
          --proof86-secondary-bg: #f6f3ed;
          --proof86-surface: #ffffff;
          --proof86-divider: #e8e3dc;
          --proof86-error: #d83b32;
          color-scheme: light;
        }
        ha-card.appearance-dark {
          --proof86-primary-text: #f5f5f7;
          --proof86-secondary-text: #8c8c95;
          --proof86-primary-bg: #0d0d13;
          --proof86-secondary-bg: #0d0d13;
          --proof86-surface: #17171f;
          --proof86-divider: #272730;
          --proof86-error: #ff5147;
          color-scheme: dark;
        }
        .header, .search, .list-tools, .sort, .state, .bottle-top {
          display: flex;
          align-items: center;
        }
        .header {
          justify-content: space-between;
          gap: 20px;
          padding: 24px 22px 18px;
        }
        .header-icon {
          background: var(--proof86-secondary-text);
          display: block;
          flex: 0 0 auto;
          height: 32px;
          -webkit-mask: url("/proof86_static/bottle.svg") center / contain no-repeat;
          mask: url("/proof86_static/bottle.svg") center / contain no-repeat;
          width: 32px;
        }
        .simple-header { justify-content: flex-start; }
        .eyebrow {
          color: var(--proof86-secondary-text);
          font: 500 12px/1.3 var(--proof86-mono);
          letter-spacing: 1.4px;
          text-transform: uppercase;
        }
        .eyebrow span { padding: 0 3px; }
        h1 {
          color: var(--proof86-primary-text);
          font-size: 30px;
          line-height: 1.1;
          margin: 7px 0 0;
        }
        .search-row { padding: 0 22px 14px; }
        .search {
          background: var(--proof86-surface);
          border: 1px solid var(--proof86-divider);
          border-radius: 14px;
          gap: 10px;
          padding: 0 14px;
          width: 100%;
        }
        .search ha-icon {
          color: var(--proof86-secondary-text);
          --mdc-icon-size: 23px;
        }
        input {
          background: transparent;
          border: 0;
          color: var(--proof86-primary-text);
          flex: 1;
          font: inherit;
          font-size: 16px;
          height: 50px;
          min-width: 0;
          outline: 0;
        }
        input::placeholder { color: var(--proof86-secondary-text); }
        .chips {
          display: flex;
          gap: 9px;
          overflow-x: auto;
          padding: 0 22px 16px;
          scrollbar-width: none;
        }
        .chips::-webkit-scrollbar { display: none; }
        .chip {
          align-items: center;
          background: var(--proof86-surface);
          border: 1px solid var(--proof86-divider);
          border-radius: 999px;
          color: var(--proof86-primary-text);
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          font: 500 13px var(--proof86-mono);
          gap: 6px;
          padding: 8px 13px;
        }
        .chip i {
          border-radius: 50%;
          height: 8px;
          width: 8px;
        }
        .chip.selected {
          background: var(--proof86-primary-text);
          border-color: var(--proof86-primary-text);
          color: var(--proof86-primary-bg);
        }
        .list-tools {
          color: var(--proof86-secondary-text);
          font: 500 11px var(--proof86-mono);
          justify-content: space-between;
          letter-spacing: 1px;
          padding: 0 22px 10px;
          text-transform: uppercase;
        }
        .sort {
          color: var(--proof86-primary-text);
          position: relative;
        }
        .sort select {
          appearance: none;
          background: transparent;
          border: 0;
          color: inherit;
          cursor: pointer;
          font: 500 12px var(--proof86-mono);
          outline: 0;
          padding: 5px 23px 5px 8px;
        }
        .sort ha-icon {
          pointer-events: none;
          position: absolute;
          right: 2px;
          --mdc-icon-size: 17px;
        }
        .bottles {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: var(--proof86-list-height);
          overflow-y: auto;
          padding: 0 22px 22px;
          scrollbar-color: var(--proof86-divider) transparent;
        }
        .bottle {
          background: var(--proof86-surface);
          background: color-mix(
            in srgb,
            var(--proof86-surface) var(--proof86-bottle-opacity),
            transparent
          );
          border: 1px solid var(--proof86-divider);
          border-radius: 12px;
          flex: 0 0 auto;
          padding: 14px 15px 13px;
        }
        .bottle-top {
          align-items: flex-start;
          gap: 14px;
          justify-content: space-between;
        }
        .bottle-name { min-width: 0; }
        .bottle-name strong {
          color: var(--proof86-primary-text);
          display: block;
          font-size: 15px;
          letter-spacing: 0.2px;
          overflow: hidden;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .bottle-name span, .remaining {
          color: var(--proof86-secondary-text);
          font: 500 12px/1.3 var(--proof86-mono);
        }
        .bottle-name span { display: block; margin-top: 4px; }
        .bottle-status {
          align-items: flex-end;
          display: flex;
          flex: 0 0 auto;
          flex-direction: column;
          gap: 4px;
        }
        .stock {
          border-radius: 999px;
          font: 500 11px var(--proof86-mono);
          padding: 3px 7px;
        }
        .stock.low {
          background: rgba(196, 134, 43, 0.11);
          background: color-mix(in srgb, #c4862b 11%, transparent);
          color: #c4862b;
        }
        .stock.empty {
          background: rgba(255, 59, 48, 0.11);
          background: color-mix(in srgb, var(--proof86-error) 11%, transparent);
          color: var(--proof86-error);
        }
        .meter {
          background: rgba(143, 140, 134, 0.14);
          background: color-mix(in srgb, var(--category-color) 12%, transparent);
          height: 4px;
          margin-top: 12px;
          overflow: hidden;
        }
        .meter i {
          background: var(--category-color);
          display: block;
          height: 100%;
        }
        .state {
          gap: 12px;
          justify-content: center;
          min-height: 150px;
          padding: 24px;
        }
        .error { color: var(--proof86-error); }
        .empty-state {
          align-items: center;
          color: var(--proof86-secondary-text);
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding: 44px 20px 52px;
          text-align: center;
        }
        .empty-state ha-icon { --mdc-icon-size: 32px; }
        .empty-state strong { color: var(--proof86-primary-text); margin-top: 4px; }
        .empty-state span { font-size: 13px; }
        .horizontal {
          display: flex;
          flex-direction: column;
          height: var(--proof86-horizontal-height);
          min-height: 320px;
          position: relative;
        }
        .horizontal .header {
          flex: 0 0 auto;
          padding: 14px 18px 9px;
        }
        .horizontal .eyebrow {
          font-size: 10px;
          letter-spacing: 1.1px;
        }
        .horizontal h1 {
          font-size: 23px;
          margin-top: 3px;
        }
        .horizontal .header-icon {
          height: 27px;
          width: 27px;
        }
        .action-buttons {
          display: flex;
          flex: 0 1 auto;
          gap: 7px;
          justify-content: flex-end;
          min-width: 0;
        }
        button {
          -webkit-tap-highlight-color: transparent;
        }
        .action-button {
          align-items: center;
          background: var(--proof86-surface);
          border: 1px solid var(--proof86-divider);
          border-radius: 11px;
          color: var(--proof86-primary-text);
          cursor: pointer;
          display: flex;
          font: 600 11px var(--proof86-mono);
          gap: 6px;
          height: 44px;
          justify-content: center;
          min-width: 92px;
          padding: 0 12px;
        }
        .action-button ha-icon { --mdc-icon-size: 19px; }
        .action-button.active {
          border-color: var(--proof86-primary-text);
          box-shadow: inset 0 0 0 1px var(--proof86-primary-text);
        }
        .horizontal .chips {
          flex: 0 0 auto;
          padding: 0 18px 8px;
        }
        .horizontal .chip {
          min-height: 36px;
          padding: 7px 12px;
        }
        .horizontal .bottles.canvas {
          display: grid;
          flex: 1 1 auto;
          gap: 9px;
          grid-auto-rows: max-content;
          grid-template-columns: repeat(var(--proof86-columns), minmax(0, 1fr));
          max-height: none;
          min-height: 0;
          overflow-y: auto;
          padding: 0 18px 16px;
        }
        .horizontal .empty-state {
          grid-column: 1 / -1;
        }
        .horizontal .bottle {
          min-width: 0;
          padding: 11px 13px 10px;
        }
        .horizontal .bottle-name strong {
          font-size: 13px;
        }
        .horizontal .bottle-name span,
        .horizontal .remaining {
          font-size: 10px;
        }
        .horizontal .meter {
          margin-top: 9px;
        }
        .horizontal.density-compact .bottles.canvas {
          gap: 7px;
        }
        .horizontal.density-compact .bottle {
          padding: 8px 11px 7px;
        }
        .horizontal.density-compact .bottle-name span {
          margin-top: 2px;
        }
        .horizontal.density-compact .meter {
          height: 3px;
          margin-top: 6px;
        }
        .panel-backdrop {
          align-items: flex-end;
          background: rgba(0, 0, 0, 0.48);
          bottom: 0;
          display: flex;
          justify-content: center;
          left: 0;
          padding: 12px;
          position: absolute;
          right: 0;
          top: 0;
          z-index: 20;
        }
        .action-sheet {
          background: var(--proof86-surface);
          border: 1px solid var(--proof86-divider);
          border-radius: 18px;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.28);
          color: var(--proof86-primary-text);
          max-height: calc(100% - 24px);
          max-width: 640px;
          overflow-y: auto;
          padding: 15px;
          width: 100%;
        }
        .search-sheet { align-self: center; }
        .sheet-title, .sheet-title > div {
          align-items: center;
          display: flex;
        }
        .sheet-title {
          justify-content: space-between;
          margin-bottom: 13px;
        }
        .sheet-title > div {
          font-size: 16px;
          gap: 9px;
        }
        .sheet-title ha-icon { --mdc-icon-size: 21px; }
        .close-panel, .clear-search {
          align-items: center;
          background: transparent;
          border: 0;
          color: var(--proof86-secondary-text);
          cursor: pointer;
          display: flex;
          height: 44px;
          justify-content: center;
          padding: 0;
          width: 44px;
        }
        .sheet-search {
          position: relative;
        }
        .sheet-search input {
          height: 52px;
        }
        .clear-search {
          flex: 0 0 auto;
          margin-right: -8px;
        }
        .sheet-options {
          display: grid;
          gap: 8px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .sheet-option {
          align-items: center;
          background: var(--proof86-secondary-bg);
          border: 1px solid var(--proof86-divider);
          border-radius: 12px;
          color: var(--proof86-primary-text);
          cursor: pointer;
          display: flex;
          font: 600 13px var(--proof86-mono);
          justify-content: space-between;
          min-height: 48px;
          padding: 9px 13px;
          text-align: left;
        }
        .sheet-option > span {
          align-items: center;
          display: flex;
          gap: 8px;
          min-width: 0;
        }
        .sheet-option i {
          border-radius: 50%;
          flex: 0 0 auto;
          height: 9px;
          width: 9px;
        }
        .sheet-option small {
          color: var(--proof86-secondary-text);
          font-size: 11px;
          margin-left: 8px;
        }
        .sheet-option.selected {
          border-color: var(--proof86-primary-text);
          box-shadow: inset 0 0 0 1px var(--proof86-primary-text);
        }
        .sheet-option ha-icon { --mdc-icon-size: 19px; }
        .sr-only {
          height: 1px;
          margin: -1px;
          overflow: hidden;
          padding: 0;
          position: absolute;
          width: 1px;
          clip: rect(0, 0, 0, 0);
        }
        @media (max-width: 520px) {
          .header { padding: 20px 16px 16px; }
          .search-row { padding: 0 16px 13px; }
          .chips { padding: 0 16px 15px; }
          .list-tools { padding: 0 16px 9px; }
          .bottles { padding: 0 16px 18px; }
          h1 { font-size: 27px; }
          .header-icon { display: none; }
        }
        @media (max-width: 720px) {
          .horizontal .action-button {
            min-width: 44px;
            padding: 0 10px;
          }
          .horizontal .action-button span { display: none; }
        }
      </style>
    `;
  }
}

const registerCard = (reportError) => {
  try {
    if (!customElements.get(CARD_TAG)) {
      customElements.define(CARD_TAG, Proof86InventoryCard);
    }
  } catch (error) {
    if (reportError && window.console && window.console.error) {
      window.console.error("Unable to register the 86Proof inventory card", error);
    }
  }
};

registerCard(false);

// Extra integration modules are imported in parallel with Home Assistant's
// frontend core. On some embedded WebViews, core initialization replaces the
// element registry after this small module has already registered. Retry once
// the larger frontend bundles have had time to finish.
const registrationRetryDelays = [250, 1000, 3000];
registrationRetryDelays.forEach((delay, index) => {
  window.setTimeout(
    () => registerCard(index === registrationRetryDelays.length - 1),
    delay
  );
});

window.customCards = window.customCards || [];
const cardMetadata = {
  type: CARD_TAG,
  name: "86Proof Inventory",
  description: "Browse and filter a shared 86Proof home bar inventory.",
  preview: false,
};
const registeredCard = window.customCards.find(
  (card) => card.type === CARD_TAG
);
if (registeredCard) {
  Object.assign(registeredCard, cardMetadata);
} else {
  window.customCards.push(cardMetadata);
}
