// <honeycomb-heatmap> — a thin custom-element wrapper around honeycomb().
// MIT © Sand Crab Studio.
//
// Renders into its own light DOM (so the global honeycomb.css applies — remember to include it).
//
//   <honeycomb-heatmap unit="commit" title="Repo activity" bands="9,24,44"></honeycomb-heatmap>
//   document.querySelector('honeycomb-heatmap').data = { series: [{ days: {...} }] };
//
// Or point it at a JSON endpoint that returns { from, to, series }:
//   <honeycomb-heatmap endpoint="/api/activity" sort header></honeycomb-heatmap>
//
// Attributes: shape, bands ("9,24,44" or JSON), unit, title, sub, endpoint,
//             sort, header, legend, view-toggle, labels  (booleans: present/true = on, "false" = off).
// Property:   .data  — a data object (see honeycomb()); setting it re-renders.

import { honeycomb } from './honeycomb.js';

function parseBands(v) {
  if (!v) return undefined;
  try { const a = JSON.parse(v); if (Array.isArray(a) && a.length === 3) return a; } catch { /* not JSON */ }
  const a = v.split(',').map((s) => Number(s.trim()));
  return a.length === 3 && a.every((n) => !Number.isNaN(n)) ? a : undefined;
}
const boolAttr = (elm, name, dflt) => (elm.hasAttribute(name) ? elm.getAttribute(name) !== 'false' : dflt);

export class HoneycombHeatmap extends HTMLElement {
  static get observedAttributes() {
    return ['shape', 'bands', 'unit', 'title', 'sub', 'endpoint', 'sort', 'header', 'legend', 'view-toggle', 'labels'];
  }

  set data(v) { this._data = v; this._render(); }
  get data() { return this._data; }

  connectedCallback() { this._render(); }
  attributeChangedCallback() { if (this.isConnected) this._render(); }

  _options() {
    const o = {
      showSort: boolAttr(this, 'sort', false),
      showHeader: boolAttr(this, 'header', true),
      showLegend: boolAttr(this, 'legend', true),
      showViewToggle: boolAttr(this, 'view-toggle', true),
    };
    if (this.hasAttribute('shape')) o.shape = this.getAttribute('shape');
    if (this.hasAttribute('unit')) o.unit = this.getAttribute('unit');
    if (this.hasAttribute('title')) o.title = this.getAttribute('title');
    if (this.hasAttribute('sub')) o.sub = this.getAttribute('sub');
    if (this.hasAttribute('labels')) o.showLabels = this.getAttribute('labels') !== 'false';
    const b = parseBands(this.getAttribute('bands')); if (b) o.bands = b;
    return o;
  }

  _render() {
    if (!this.isConnected) return;
    const opts = this._options();
    const endpoint = this.getAttribute('endpoint');
    if (endpoint) honeycomb.fromEndpoint(this, endpoint, opts);
    else honeycomb(this, this._data || { series: [] }, opts);
  }
}

if (!customElements.get('honeycomb-heatmap')) customElements.define('honeycomb-heatmap', HoneycombHeatmap);

export default HoneycombHeatmap;
