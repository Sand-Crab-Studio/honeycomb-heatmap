// honeycomb-heatmap — a zero-dependency activity / contribution heatmap (hexagon or square).
// MIT © Sand Crab Studio.
//
//   honeycomb(container, data, options)
//
// data — any of:
//   { from, to, series: [ Series ] }                 full form
//   Series                                            a single series object
//   { 'YYYY-MM-DD': count, ... }                      a bare "days" map (single series)
//   Series = {
//     label?, meta?: string[], badge?: string|{text,kind},
//     total?: number,          // defaults to the sum of `days`
//     lastActive?: string,     // 'YYYY-MM-DD'; defaults to the latest non-zero day
//     days: { 'YYYY-MM-DD': number }
//   }
//   from / to ('YYYY-MM-DD') default to the span of the data (or a trailing year to today).
//
// options (all optional):
//   shape:'hex'|'square'     initial view (default 'hex'); user can flip it if showViewToggle
//   bands:[t1,t2,t3]         count thresholds → shades 1..4 (default [9,24,44]) — see README "Tuning"
//   unit:'event'             tooltip / total noun ("12 events")
//   showHeader:true, title:'Activity', sub:''
//   showLegend:true, legendLabels:{ less:'Less', more:'More' }
//   showViewToggle:true      the Hexagons / Squares segmented toggle
//   showSort:false           the Most active / Most dormant toggle (multi-series)
//   showLabels:auto          per-row label + meta line (default: series.length > 1)
//   emptyText:'No activity yet.'
//   formatTooltip(count, ymd) => string
//   formatLastActive(ymd) => string
//
// Returns { update(newData) } so you can re-feed data without re-reading options.
// Also: honeycomb.fromEndpoint(container, url, options) — fetch JSON { from, to, series } then render.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// count → shade 0..4 against FIXED absolute thresholds (not per-series quartiles), so a shade
// means the same activity level on every series. Tune `bands` to your data's magnitude (README).
function levelFor(n, bands) {
  if (!n) return 0;
  if (n <= bands[0]) return 1;
  if (n <= bands[1]) return 2;
  if (n <= bands[2]) return 3;
  return 4;
}

function defaultLastActive(s) {
  if (!s) return '—';
  const d = parseYmd(s);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((today - d) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// Fold the accepted data shorthands into { from, to, series:[normalized...] }.
function normalize(data) {
  data = data || {};
  let series;
  if (Array.isArray(data.series)) series = data.series;
  else if (Array.isArray(data.tenants)) series = data.tenants;                 // alias
  else if (data.days) series = [data];                                         // one Series
  else if (!data.from && !data.to) series = [{ days: data }];                  // a bare days map
  else series = [];

  series = series.map((s) => {
    const days = s.days || {};
    const total = s.total != null
      ? s.total
      : Object.values(days).reduce((a, b) => a + (b || 0), 0);
    let lastActive = s.lastActive;
    if (lastActive === undefined) {
      const active = Object.keys(days).filter((k) => days[k] > 0).sort();
      lastActive = active.length ? active[active.length - 1] : null;
    }
    // convenience aliases: name -> label, slug/timezone -> meta (so server "tenant" envelopes just work)
    const label = s.label != null ? s.label : s.name;
    const meta = s.meta || [s.slug && ('/' + s.slug), s.timezone].filter(Boolean);
    const badge = s.badge || (s.status && s.status !== 'active' ? s.status : null);
    return { label, meta, badge, total, lastActive, days };
  });

  let from = data.from, to = data.to;
  if (!from || !to) {
    const all = series.flatMap((s) => Object.keys(s.days)).sort();
    if (all.length) { from = from || all[0]; to = to || all[all.length - 1]; }
    else {
      const t = new Date(); t.setHours(0, 0, 0, 0);
      const y = new Date(t); y.setFullYear(y.getFullYear() - 1);
      from = from || ymd(y); to = to || ymd(t);
    }
  }
  return { from, to, series };
}

// One series' grid — weeks as columns, Sun..Sat as rows — over [from, to]. shape: 'hex' | 'square'.
function heatmap(from, to, days, shape, opts) {
  const wrap = el('div', 'hc-heatwrap');
  const months = el('div', 'hc-months');
  const grid = el('div', 'hc-heat' + (shape === 'hex' ? ' hc-hex' : ''));

  const gridStart = new Date(from);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());   // back to the Sunday on/before `from`

  let cursor = new Date(gridStart);
  let lastMonth = -1;
  while (cursor <= to) {
    const week = el('div', 'hc-week');
    const weekFirst = new Date(cursor);
    for (let dow = 0; dow < 7; dow++) {
      if (cursor < from || cursor > to) {
        week.appendChild(el('div', 'hc-cell hc-pad'));
      } else {
        const key = ymd(cursor);
        const n = days[key] || 0;
        const c = el('div', `hc-cell hc-l${levelFor(n, opts.bands)}`);
        c.title = opts.formatTooltip(n, key);
        week.appendChild(c);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    grid.appendChild(week);

    const m = weekFirst.getMonth();
    const label = el('div', 'hc-mlabel');
    if (m !== lastMonth && weekFirst.getDate() <= 7) { label.textContent = MONTHS[m]; lastMonth = m; }
    months.appendChild(label);
  }

  wrap.appendChild(months);
  wrap.appendChild(grid);

  const block = el('div', 'hc-heatblock' + (shape === 'hex' ? ' hc-hex' : ''));
  block.appendChild(wrap);
  const sc = el('div', 'hc-scroll');
  sc.appendChild(el('div', 'hc-scroll-thumb'));
  block.appendChild(sc);
  return block;
}

// Turn a grid block into a drag-pannable viewport with a slim scroll pill (native bar hidden in CSS).
function wireScroller(block) {
  const wrap = block.querySelector('.hc-heatwrap');
  const track = block.querySelector('.hc-scroll');
  const thumb = block.querySelector('.hc-scroll-thumb');

  function update() {
    const sw = wrap.scrollWidth, cw = wrap.clientWidth;
    const overflow = sw > cw + 1;
    track.style.visibility = overflow ? '' : 'hidden';
    wrap.classList.toggle('pan', overflow);
    if (!overflow) return;
    const wPct = Math.max((cw / sw) * 100, 8);
    const maxScroll = sw - cw;
    thumb.style.width = wPct + '%';
    thumb.style.left = (maxScroll ? (wrap.scrollLeft / maxScroll) * (100 - wPct) : 0) + '%';
  }

  wrap.addEventListener('scroll', update, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(update).observe(wrap);

  let down = false, startX = 0, startScroll = 0;
  wrap.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    down = true; startX = e.clientX; startScroll = wrap.scrollLeft;
    wrap.setPointerCapture(e.pointerId); wrap.classList.add('dragging');
  });
  wrap.addEventListener('pointermove', (e) => { if (down) wrap.scrollLeft = startScroll - (e.clientX - startX); });
  const end = () => { down = false; wrap.classList.remove('dragging'); };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);

  wrap.scrollLeft = wrap.scrollWidth;   // start at the most recent weeks
  update();
}

function seriesRow(from, to, s, showLabels, shape, opts) {
  const row = el('div', 'hc-row');

  if (showLabels && (s.label || s.badge)) {
    const line = el('div', 'hc-name');
    if (s.label) line.appendChild(el('span', 'hc-label', s.label));
    if (s.badge) {
      const b = typeof s.badge === 'string' ? { text: s.badge } : s.badge;
      line.appendChild(el('span', 'hc-badge' + (b.kind ? ' hc-badge--' + b.kind : ''), b.text));
    }
    row.appendChild(line);
  }

  row.appendChild(heatmap(from, to, s.days || {}, shape, opts));

  const stats = el('div', 'hc-stats');
  for (const m of s.meta || []) stats.appendChild(el('span', 'hc-stat', m));
  if (s.total != null) stats.appendChild(el('span', 'hc-stat', `${s.total.toLocaleString()} ${opts.unit}${s.total === 1 ? '' : 's'}`));
  stats.appendChild(el('span', 'hc-stat', `last active ${opts.formatLastActive(s.lastActive)}`));
  row.appendChild(stats);

  return row;
}

function legend(opts) {
  const l = el('div', 'hc-legend');
  l.appendChild(el('span', 'hc-legend-label', opts.legendLabels.less));
  for (let i = 0; i <= 4; i++) l.appendChild(el('div', `hc-cell hc-l${i}`));
  l.appendChild(el('span', 'hc-legend-label', opts.legendLabels.more));
  return l;
}

export function honeycomb(container, data, options = {}) {
  const opts = {
    bands: Array.isArray(options.bands) && options.bands.length === 3 ? options.bands.slice() : [9, 24, 44],
    unit: options.unit || 'event',
    showHeader: options.showHeader !== false,
    title: options.title || 'Activity',
    sub: options.sub || '',
    showLegend: options.showLegend !== false,
    legendLabels: { less: 'Less', more: 'More', ...(options.legendLabels || {}) },
    showViewToggle: options.showViewToggle !== false,
    showSort: !!options.showSort,
    emptyText: options.emptyText || 'No activity yet.',
    formatLastActive: options.formatLastActive || defaultLastActive,
  };
  opts.formatTooltip = options.formatTooltip
    || ((n, key) => (n ? `${n} ${opts.unit}${n === 1 ? '' : 's'} · ${key}` : `No activity · ${key}`));

  let norm = normalize(data);
  const showLabels = options.showLabels != null ? !!options.showLabels : norm.series.length > 1;
  const state = { sort: 'active', shape: options.shape === 'square' ? 'square' : 'hex' };

  container.classList.add('honeycomb');

  const sortKey = (s) => (s.lastActive ? Date.parse(s.lastActive) : -Infinity);
  const sorted = () => norm.series.slice()
    .sort((a, b) => (state.sort === 'dormant' ? sortKey(a) - sortKey(b) : sortKey(b) - sortKey(a)));

  function toggle(label, key, choices) {
    const wrap = el('div', 'hc-toggle');
    wrap.appendChild(el('span', 'hc-toggle-label', label));
    for (const [mode, text] of choices) {
      const b = el('button', 'hc-btn' + (state[key] === mode ? ' hc-btn--on' : ''), text);
      b.type = 'button';
      b.onclick = () => { state[key] = mode; render(); };
      wrap.appendChild(b);
    }
    return wrap;
  }

  function render() {
    container.innerHTML = '';
    const head = el('div', 'hc-head');
    if (opts.showHeader) {
      head.appendChild(el('h2', 'hc-title', opts.title));
      if (opts.sub) head.appendChild(el('p', 'hc-sub', opts.sub));
    }
    const bar = el('div', 'hc-bar');
    if (opts.showLegend) bar.appendChild(legend(opts));
    const ctrls = el('div', 'hc-controls');
    if (opts.showViewToggle) ctrls.appendChild(toggle('View', 'shape', [['hex', 'Hexagons'], ['square', 'Squares']]));
    if (opts.showSort) ctrls.appendChild(toggle('Sort', 'sort', [['active', 'Most active'], ['dormant', 'Most dormant']]));
    bar.appendChild(ctrls);
    if (opts.showLegend || opts.showViewToggle || opts.showSort || opts.showHeader) head.appendChild(bar);
    container.appendChild(head);

    const series = sorted();
    if (!series.length) { container.appendChild(el('div', 'hc-empty', opts.emptyText)); return; }
    const from = parseYmd(norm.from), to = parseYmd(norm.to);
    const list = el('div', 'hc-list');
    for (const s of series) list.appendChild(seriesRow(from, to, s, showLabels, state.shape, opts));
    container.appendChild(list);
    list.querySelectorAll('.hc-heatblock').forEach(wireScroller);   // needs layout, so after append
  }

  render();
  return { update(newData) { norm = normalize(newData); render(); } };
}

honeycomb.fromEndpoint = async function (container, url, options = {}) {
  container.classList.add('honeycomb');
  try {
    const res = await fetch(url, { credentials: 'same-origin', ...(options.fetch || {}) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return honeycomb(container, await res.json(), options);
  } catch (e) {
    container.innerHTML = '';
    container.appendChild(el('div', 'hc-empty', `Couldn't load activity (${e.message}).`));
  }
};

export default honeycomb;
