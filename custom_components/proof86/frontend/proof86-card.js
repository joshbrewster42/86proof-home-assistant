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
const nameCollator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

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

    return {
      schema: [
        { name: "title", selector: { text: {} } },
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
          sort: "Initial sorting",
          card_width: "Preferred card width",
          max_height: "Scrollable list height",
          show_search: "Search field",
          show_category_chips: "Category filters",
          show_abv: "Alcohol percentage",
          show_remaining_volume: "Estimated remaining volume",
          show_fullness_bars: "Bottle fullness bars",
        };
        return labels[schema.name];
      },
      computeHelper: (schema) =>
        schema.name === "card_width"
          ? "Sets the default width in a Sections dashboard. You can also resize the card directly on the dashboard."
          : undefined,
    };
  }

  static getStubConfig() {
    return {
      title: "Inventory",
      sort: "name-asc",
      card_width: "wide",
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
    this._subscriptionRequested = false;
  }

  setConfig(config) {
    const maxHeight = Number(
      config.max_height == null ? 640 : config.max_height
    );
    this._config = Object.assign(
      {
        title: "Inventory",
        sort: "name-asc",
        card_width: "wide",
        show_search: true,
        show_category_chips: true,
        show_abv: true,
        show_remaining_volume: true,
        show_fullness_bars: true,
      },
      config,
      {
        max_height: Math.max(320, Math.min(1200, maxHeight || 640)),
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
    if (!this._config.show_search) this._query = "";
    if (!this._config.show_category_chips) this._category = "all";
    this._render();
    this._ensureSubscription();
  }

  set hass(hass) {
    const darkMode = Boolean(hass && hass.themes && hass.themes.darkMode);
    const themeChanged = this._hass && darkMode !== this._darkMode;
    this._hass = hass;
    this._darkMode = darkMode;
    if (themeChanged) this._render();
    this._ensureSubscription();
  }

  connectedCallback() {
    this._render();
    this._ensureSubscription();
  }

  disconnectedCallback() {
    this._disposeSubscription();
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
    const message = { type: "proof86/inventory/subscribe" };
    if (this._config.entry_id) {
      message.entry_id = this._config.entry_id;
    }

    let subscription;
    try {
      subscription = this._hass.connection.subscribeMessage(
        (inventory) => {
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
        if (this.isConnected) {
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
    this._error =
      (error && error.message) ||
      "Unable to load the shared inventory. Confirm that 86Proof is connected.";
    this._subscriptionRequested = false;
    this._render();
  }

  _disposeSubscription() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this._subscriptionRequested = false;
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
      const nameOrder = nameCollator.compare(left.name || "", right.name || "");
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
        right.count - left.count || nameCollator.compare(left.label, right.label)
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

    this.shadowRoot.innerHTML = `
      ${this._styles()}
      <ha-card style="--proof86-list-height:${maxHeight}px">
        <div class="header">
          <div>
            <div class="eyebrow">${barName} <span>•</span> ${total} ${total === 1 ? "Bottle" : "Bottles"}</div>
            <h1>${title}</h1>
          </div>
          <span class="header-icon" aria-hidden="true"></span>
        </div>

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

        ${
          this._config.show_category_chips
            ? `<div class="chips" role="group" aria-label="Filter by category">
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
               </div>`
            : ""
        }

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

        <div class="bottles">
          ${
            filtered.length
              ? filtered.map((bottle) => this._bottleTemplate(bottle)).join("")
              : `<div class="empty-state">
                   <ha-icon icon="mdi:magnify"></ha-icon>
                   <strong>No bottles found</strong>
                   <span>Try a different search or category.</span>
                 </div>`
          }
        </div>
      </ha-card>
    `;

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

    for (const chip of this.shadowRoot.querySelectorAll(".chip")) {
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
          background: var(--secondary-background-color);
          overflow: hidden;
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
          background: var(--secondary-text-color);
          display: block;
          flex: 0 0 auto;
          height: 32px;
          -webkit-mask: url("/proof86_static/bottle.svg") center / contain no-repeat;
          mask: url("/proof86_static/bottle.svg") center / contain no-repeat;
          width: 32px;
        }
        .simple-header { justify-content: flex-start; }
        .eyebrow {
          color: var(--secondary-text-color);
          font: 500 12px/1.3 var(--proof86-mono);
          letter-spacing: 1.4px;
          text-transform: uppercase;
        }
        .eyebrow span { padding: 0 3px; }
        h1 {
          color: var(--primary-text-color);
          font-size: 30px;
          line-height: 1.1;
          margin: 7px 0 0;
        }
        .search-row { padding: 0 22px 14px; }
        .search {
          background: var(--card-background-color);
          border: 1px solid var(--divider-color);
          border-radius: 14px;
          gap: 10px;
          padding: 0 14px;
          width: 100%;
        }
        .search ha-icon {
          color: var(--secondary-text-color);
          --mdc-icon-size: 23px;
        }
        input {
          background: transparent;
          border: 0;
          color: var(--primary-text-color);
          flex: 1;
          font: inherit;
          font-size: 16px;
          height: 50px;
          min-width: 0;
          outline: 0;
        }
        input::placeholder { color: var(--secondary-text-color); }
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
          background: var(--card-background-color);
          border: 1px solid var(--divider-color);
          border-radius: 999px;
          color: var(--primary-text-color);
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
          background: var(--primary-text-color);
          border-color: var(--primary-text-color);
          color: var(--primary-background-color);
        }
        .list-tools {
          color: var(--secondary-text-color);
          font: 500 11px var(--proof86-mono);
          justify-content: space-between;
          letter-spacing: 1px;
          padding: 0 22px 10px;
          text-transform: uppercase;
        }
        .sort {
          color: var(--primary-text-color);
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
          scrollbar-color: var(--divider-color) transparent;
        }
        .bottle {
          background: var(--card-background-color);
          border: 1px solid var(--divider-color);
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
          color: var(--primary-text-color);
          display: block;
          font-size: 15px;
          letter-spacing: 0.2px;
          overflow: hidden;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .bottle-name span, .remaining {
          color: var(--secondary-text-color);
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
          background: color-mix(in srgb, var(--error-color) 11%, transparent);
          color: var(--error-color);
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
        .error { color: var(--error-color); }
        .empty-state {
          align-items: center;
          color: var(--secondary-text-color);
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding: 44px 20px 52px;
          text-align: center;
        }
        .empty-state ha-icon { --mdc-icon-size: 32px; }
        .empty-state strong { color: var(--primary-text-color); margin-top: 4px; }
        .empty-state span { font-size: 13px; }
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
      </style>
    `;
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, Proof86InventoryCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "86Proof Inventory",
    description: "Browse and filter a shared 86Proof home bar inventory.",
    preview: true,
  });
}
