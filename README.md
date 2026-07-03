# 🍯 honeycomb-heatmap

A tiny, **zero-dependency** activity / contribution heatmap — GitHub-style, but with a **hexagon (honeycomb) view** as well as squares. Pure DOM + one CSS file, themeable via CSS variables, with an optional `<honeycomb-heatmap>` web component. No build step, no framework.

- **Hex or square**, with a built-in view toggle
- **Multi-series** (compare rows against the *same* fixed shade bands) or single-series
- Drag-to-pan viewport + slim scroll pill for the full ~53-week year on small screens
- Legend, "last active" stats, per-row labels/badges — all optional
- **Themeable** entirely through CSS custom properties

👉 Open [`demo/index.html`](demo/index.html) for a live, retune-it-yourself example.

## Install

```bash
npm i honeycomb-heatmap
```

Or drop the two files (`src/honeycomb.js`, `src/honeycomb.css`) onto a page — they're plain ES modules with no dependencies.

## Quick start (function API)

```html
<link rel="stylesheet" href="honeycomb.css">
<div id="chart"></div>

<script type="module">
  import { honeycomb } from 'honeycomb-heatmap';

  honeycomb(document.getElementById('chart'), {
    series: [
      { label: 'web',  days: { '2026-06-29': 12, '2026-06-28': 4 /* ... */ } },
      { label: 'api',  days: { '2026-06-29': 31 /* ... */ } },
    ],
  }, {
    unit: 'commit',
    bands: [9, 24, 44],   // ← the numbers you'll want to tune (see below)
    showSort: true,
  });
</script>
```

You can also pass a **single series**, or just a **bare `{ 'YYYY-MM-DD': count }` map**:

```js
honeycomb(el, { '2026-06-29': 12, '2026-06-28': 4 });   // dates → counts, that's it
```

## Web component

```html
<link rel="stylesheet" href="honeycomb.css">
<honeycomb-heatmap id="hc" unit="commit" bands="9,24,44" title="Repo activity"></honeycomb-heatmap>

<script type="module">
  import 'honeycomb-heatmap/element';
  document.getElementById('hc').data = { series: [{ days: { '2026-06-29': 12 } }] };
</script>
```

Or feed it a JSON endpoint returning `{ from, to, series }`:

```html
<honeycomb-heatmap endpoint="/api/activity" sort></honeycomb-heatmap>
```

## Data

```ts
{
  from?: 'YYYY-MM-DD',   // defaults to the span of your data (or a trailing year)
  to?:   'YYYY-MM-DD',
  series: [
    {
      days:  { 'YYYY-MM-DD': number },   // required — the only thing you must supply
      label?: string,                    // row title (shown when >1 series, or force with showLabels)
      meta?:  string[],                  // small stat chips, e.g. ['/web', 'UTC']
      badge?: string | { text, kind },   // e.g. 'trial' → styled .hc-badge--trial
      total?: number,                    // defaults to sum(days)
      lastActive?: 'YYYY-MM-DD',         // defaults to the latest non-zero day
    },
  ],
}
```

## Options

| option | default | notes |
|---|---|---|
| `shape` | `'hex'` | `'hex'` or `'square'`; users can flip it if `showViewToggle` |
| `bands` | `[9, 24, 44]` | count thresholds for shades 1–4 — **tune these** |
| `unit` | `'event'` | tooltip / total noun (`"12 events"`) |
| `showHeader` / `title` / `sub` | `true` / `'Activity'` / `''` | header block |
| `showLegend` | `true` | the *Less ▪▪▪▪ More* key |
| `showViewToggle` | `true` | Hexagons / Squares toggle |
| `showSort` | `false` | Most active / Most dormant toggle (multi-series) |
| `showLabels` | auto | per-row label + meta (default: on when >1 series) |
| `emptyText` | `'No activity yet.'` | shown when there's no data |
| `formatTooltip(n, ymd)` | — | override cell tooltips |
| `formatLastActive(ymd)` | — | override the "last active" text |

`honeycomb(...)` returns `{ update(newData) }` so you can re-feed data without re-passing options.

## Tuning the bands & palette

This is the part worth reading — **it's what makes a heatmap look good or look like mud.**

### How shading works (and why)

Each day's count is mapped to a shade **0–4** using **fixed absolute thresholds**, `bands: [t1, t2, t3]`:

```
count == 0          → shade 0 (empty)
count <= t1         → shade 1
count <= t2         → shade 2
count <= t3         → shade 3
count >  t3         → shade 4 (peak)
```

They're **absolute, not per-series quartiles**, on purpose: it means a colour represents the *same* activity level on every row, so you can compare series honestly. (Relative/quartile scaling would make a sleepy series glow as hot as a busy one.) The trade-off: **the right thresholds depend entirely on the magnitude of _your_ counts** — the defaults `[9, 24, 44]` were tuned for data where a busy day is a few dozen events. If your counts are page-views (thousands) or PRs (single digits), those defaults will make everything one flat colour.

### Picking good bands

Look at your actual distribution of **daily counts on active days**, then:

1. **`t1` ≈ your typical/median active day.** Below this is "a little" (shade 1).
2. **`t2` ≈ ~75th–80th percentile.** A solidly busy day (shade 2–3).
3. **`t3` ≈ ~90th–95th percentile.** Set it so **only genuinely heavy days** reach the peak shade (4). If *lots* of days hit peak, the top colour stops meaning "wow" — raise `t3`.

Rules of thumb:
- Everything looks the **same pale shade** → bands are **too high**; lower them.
- Everything is **peak/red** → bands are **too low**; raise them (especially `t3`).
- Aim for a spread where most active days land in shades **1–3** and the peak is reserved for outliers.

The [demo](demo/index.html) has live band inputs — the fastest way to feel it. Expect to iterate a few times; that's normal.

### Palette (colours)

Override the five shade colours (and everything else) with CSS custom properties. Scope globally or per-instance:

```css
/* GitHub greens instead of the default autumn ramp */
.honeycomb {
  --hc-l0: #ebedf0;
  --hc-l1: #9be9a8;
  --hc-l2: #40c463;
  --hc-l3: #30a14e;
  --hc-l4: #216e39;
}
```

Other themeable variables (see the top of `honeycomb.css`):

| variable | what |
|---|---|
| `--hc-l0 … --hc-l4` | the five shades (empty → peak) |
| `--hc-cell`, `--hc-gap`, `--hc-radius` | square-view cell size / gap / corner |
| `--hc-hex-w`, `--hc-hex-h` | hex cell width / height (flat-top hexes are wider than tall) |
| `--hc-accent` | active toggle button / brand colour |
| `--hc-ink`, `--hc-muted`, `--hc-faint` | text colours |
| `--hc-surface`, `--hc-line` | row card background / border |
| `--hc-track`, `--hc-thumb` | scroll-pill colours |

Per-instance theming just sets the vars inline on the container:

```js
el.style.setProperty('--hc-l4', '#c8451c');
```

## Browser support

Modern evergreen browsers. Uses `clip-path` (hex cells), `ResizeObserver`, and pointer events — all widely supported. The square view works without `clip-path`.

## License

MIT © Sand Crab Studio.
