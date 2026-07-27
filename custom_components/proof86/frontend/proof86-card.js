const CARD_TAG = "proof86-inventory-card";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const normalized = (value) => String(value ?? "").trim().toLocaleLowerCase();

const fullnessPercent = (value) => {
  const label = normalized(value);
  const levels = {
    full: 100,
    "100%": 100,
    "3/4": 75,
    "75%": 75,
    half: 50,
    "1/2": 50,
    "50%": 50,
    quarter: 25,
    "1/4": 25,
    "25%": 25,
    low: 15,
    empty: 0,
    "0%": 0,
    "86d": 0,
    "86'd": 0,
  };
  return levels[label] ?? null;
};

class Proof86InventoryCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._inventory = null;
    this._error = null;
    this._query = "";
    this._category = "all";
    this._subscriptionRequested = false;
  }

  setConfig(config) {
    this._config = {
      title: "86Proof",
      ...config,
    };
    this._render();
    this._ensureSubscription();
  }

  set hass(hass) {
    this._hass = hass;
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
    const bottleCount = this._inventory?.bottles?.length ?? 0;
    return Math.max(3, Math.min(12, Math.ceil(bottleCount / 2) + 2));
  }

  async _ensureSubscription() {
    if (
      !this.isConnected ||
      !this._config ||
      !this._hass?.connection ||
      this._subscriptionRequested
    ) {
      return;
    }

    this._subscriptionRequested = true;
    const message = { type: "proof86/inventory/subscribe" };
    if (this._config.entry_id) {
      message.entry_id = this._config.entry_id;
    }

    try {
      const unsubscribe = await this._hass.connection.subscribeMessage(
        (inventory) => {
          this._inventory = inventory;
          this._error = null;
          this._render();
        },
        message,
      );
      if (this.isConnected) {
        this._unsubscribe = unsubscribe;
      } else {
        unsubscribe();
        this._subscriptionRequested = false;
      }
    } catch (error) {
      this._error =
        error?.message ??
        "Unable to load the shared inventory. Confirm that 86Proof is connected.";
      this._subscriptionRequested = false;
      this._render();
    }
  }

  _disposeSubscription() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this._subscriptionRequested = false;
  }

  _filteredBottles() {
    const bottles = this._inventory?.bottles ?? [];
    return bottles.filter((bottle) => {
      const category = normalized(bottle.category || bottle.type || "Other");
      const matchesCategory =
        this._category === "all" || category === this._category;
      const haystack = [
        bottle.name,
        bottle.type,
        bottle.category,
        bottle.style,
        bottle.fullness,
        bottle.notes,
      ]
        .map(normalized)
        .join(" ");
      return matchesCategory && haystack.includes(normalized(this._query));
    });
  }

  _categories() {
    const categories = new Map();
    for (const bottle of this._inventory?.bottles ?? []) {
      const label = String(bottle.category || bottle.type || "Other").trim();
      categories.set(normalized(label), label);
    }
    return [...categories.entries()].sort((left, right) =>
      left[1].localeCompare(right[1]),
    );
  }

  _render() {
    if (!this.shadowRoot) return;

    const title = escapeHtml(this._config?.title || "86Proof");
    if (this._error) {
      this.shadowRoot.innerHTML = `
        ${this._styles()}
        <ha-card>
          <div class="header"><ha-icon icon="mdi:bottle-tonic"></ha-icon>${title}</div>
          <div class="state error">${escapeHtml(this._error)}</div>
        </ha-card>
      `;
      return;
    }

    if (!this._inventory) {
      this.shadowRoot.innerHTML = `
        ${this._styles()}
        <ha-card>
          <div class="header"><ha-icon icon="mdi:bottle-tonic"></ha-icon>${title}</div>
          <div class="state"><ha-circular-progress active></ha-circular-progress>Loading inventory…</div>
        </ha-card>
      `;
      return;
    }

    const filtered = this._filteredBottles();
    const categories = this._categories();
    const barName = escapeHtml(this._inventory.bar?.name || "Shared Bar");
    const fetchedAt = new Date(this._inventory.fetched_at);
    const updatedLabel = Number.isNaN(fetchedAt.getTime())
      ? ""
      : `Updated ${fetchedAt.toLocaleString()}`;

    this.shadowRoot.innerHTML = `
      ${this._styles()}
      <ha-card>
        <div class="header">
          <div class="identity">
            <ha-icon icon="mdi:bottle-tonic"></ha-icon>
            <div><span>${title}</span><small>${barName}</small></div>
          </div>
          <span class="total">${this._inventory.bottles.length} bottles</span>
        </div>
        <div class="tools">
          <label class="search">
            <ha-icon icon="mdi:magnify"></ha-icon>
            <input type="search" placeholder="Search bottles" value="${escapeHtml(this._query)}">
          </label>
          <select aria-label="Filter by category">
            <option value="all">All categories</option>
            ${categories
              .map(
                ([value, label]) =>
                  `<option value="${escapeHtml(value)}" ${
                    value === this._category ? "selected" : ""
                  }>${escapeHtml(label)}</option>`,
              )
              .join("")}
          </select>
        </div>
        <div class="results">${filtered.length} shown</div>
        <div class="bottles">
          ${
            filtered.length
              ? filtered.map((bottle) => this._bottleTemplate(bottle)).join("")
              : `<div class="empty-state">No bottles match these filters.</div>`
          }
        </div>
        <div class="footer">${escapeHtml(updatedLabel)}</div>
      </ha-card>
    `;

    this.shadowRoot
      .querySelector('input[type="search"]')
      ?.addEventListener("input", (event) => {
        this._query = event.target.value;
        this._render();
        const search = this.shadowRoot.querySelector('input[type="search"]');
        search?.focus();
        search?.setSelectionRange(this._query.length, this._query.length);
      });
    this.shadowRoot.querySelector("select")?.addEventListener("change", (event) => {
      this._category = event.target.value;
      this._render();
    });
  }

  _bottleTemplate(bottle) {
    const percent = fullnessPercent(bottle.fullness);
    const fullness = bottle.fullness || "Unknown fullness";
    const category = bottle.category || bottle.type || "Other";
    const details = [
      bottle.style,
      bottle.abv == null ? null : `${bottle.abv}% ABV`,
      bottle.size == null ? null : `${bottle.size} mL`,
    ].filter(Boolean);
    const description = bottle.notes || bottle.julep_blurb;

    return `
      <article class="bottle">
        <div class="bottle-top">
          <div class="bottle-name">
            <strong>${escapeHtml(bottle.name || "Unnamed Bottle")}</strong>
            <span>${escapeHtml(category)}</span>
          </div>
          <span class="fullness">${escapeHtml(fullness)}</span>
        </div>
        ${
          percent == null
            ? ""
            : `<div class="meter" aria-label="${escapeHtml(fullness)}"><i style="width:${percent}%"></i></div>`
        }
        ${details.length ? `<div class="details">${details.map(escapeHtml).join(" · ")}</div>` : ""}
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
      </article>
    `;
  }

  _styles() {
    return `
      <style>
        :host { display: block; }
        ha-card { overflow: hidden; }
        .header, .identity, .tools, .search, .state, .bottle-top {
          display: flex;
          align-items: center;
        }
        .header {
          justify-content: space-between;
          gap: 16px;
          padding: 20px 20px 14px;
        }
        .identity { gap: 12px; min-width: 0; }
        .identity ha-icon { color: var(--primary-color); --mdc-icon-size: 30px; }
        .identity span { display: block; font-size: 20px; font-weight: 600; }
        .identity small {
          display: block;
          color: var(--secondary-text-color);
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .total, .fullness {
          background: color-mix(in srgb, var(--primary-color) 12%, transparent);
          border-radius: 999px;
          color: var(--primary-color);
          font-size: 12px;
          font-weight: 600;
          padding: 6px 10px;
          white-space: nowrap;
        }
        .tools { gap: 10px; padding: 0 20px 8px; }
        .search {
          background: var(--secondary-background-color);
          border: 1px solid var(--divider-color);
          border-radius: 10px;
          flex: 1;
          gap: 8px;
          min-width: 0;
          padding: 0 10px;
        }
        .search ha-icon { color: var(--secondary-text-color); --mdc-icon-size: 20px; }
        input, select {
          background: var(--secondary-background-color);
          border: 1px solid var(--divider-color);
          border-radius: 10px;
          color: var(--primary-text-color);
          font: inherit;
          height: 42px;
        }
        input { background: transparent; border: 0; flex: 1; min-width: 0; outline: 0; }
        select { max-width: 180px; padding: 0 10px; }
        .results, .footer {
          color: var(--secondary-text-color);
          font-size: 11px;
          padding: 2px 20px 10px;
        }
        .bottles {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          max-height: 600px;
          overflow: auto;
          padding: 0 20px 18px;
        }
        .bottle {
          border: 1px solid var(--divider-color);
          border-radius: 12px;
          padding: 13px;
        }
        .bottle-top { align-items: flex-start; gap: 10px; justify-content: space-between; }
        .bottle-name { min-width: 0; }
        .bottle-name strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .bottle-name span, .details, .bottle p {
          color: var(--secondary-text-color);
          font-size: 12px;
        }
        .bottle-name span { display: block; margin-top: 3px; }
        .fullness { background: var(--secondary-background-color); color: var(--primary-text-color); }
        .meter {
          background: var(--secondary-background-color);
          border-radius: 999px;
          height: 5px;
          margin-top: 11px;
          overflow: hidden;
        }
        .meter i {
          background: var(--primary-color);
          border-radius: inherit;
          display: block;
          height: 100%;
        }
        .details { margin-top: 9px; }
        .bottle p { line-height: 1.4; margin: 8px 0 0; }
        .state { gap: 12px; justify-content: center; min-height: 120px; padding: 20px; }
        .error { color: var(--error-color); }
        .empty-state { color: var(--secondary-text-color); padding: 40px; text-align: center; }
        .footer { border-top: 1px solid var(--divider-color); padding: 10px 20px; }
        @media (max-width: 520px) {
          .tools { align-items: stretch; flex-direction: column; }
          select { max-width: none; width: 100%; }
          .total { display: none; }
          .bottles { grid-template-columns: 1fr; max-height: 520px; }
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
    description: "Browse a shared 86Proof home bar inventory.",
    preview: true,
  });
}
