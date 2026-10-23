// Swapping a pinned icon for one from Lucide (free, ISC licence, 1,600+ icons): search by name or meaning, point to
// preview it in place, click to keep. The page shows it with a mask in the icon's own colour; nothing is bundled,
// each icon loads from the CDN when it's shown.
import { esc } from './core.js';

const V = '1.53.0', CDN = `https://cdn.jsdelivr.net/npm/lucide-static@${V}`;
export const svgUrl = (name) => `${CDN}/icons/${name}.svg`;
export const pageUrl = (name) => `https://lucide.dev/icons/${name}`;
const POPULAR = ['house', 'search', 'menu', 'x', 'check', 'plus', 'minus', 'chevron-down', 'chevron-right', 'arrow-right', 'arrow-left', 'external-link',
  'settings', 'user', 'users', 'bell', 'mail', 'heart', 'star', 'bookmark', 'share-2', 'download', 'upload', 'trash-2', 'pencil', 'copy', 'link', 'lock',
  'eye', 'eye-off', 'calendar', 'clock', 'map-pin', 'phone', 'message-circle', 'shopping-cart', 'credit-card', 'filter', 'sliders-horizontal',
  'more-horizontal', 'info', 'circle-help', 'triangle-alert', 'log-out', 'sun', 'moon', 'image', 'file-text', 'folder', 'sparkles'];

// is it an icon: a small inline svg, an icon-font element, or a small svg image
const FONT = /\b(ti|fa[srlbd]?|fa-[\w-]+|lucide|bi|ri-[\w-]+|ph|material-icons|material-symbols-[\w-]+|icon|icons?-[\w-]+|glyphicon)\b/;
export function iconOf(el) {
  if (!el) return null;
  const small = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.width <= 72 && r.height <= 72; };
  const up = el.closest?.('svg'); // a part drawn inside it (a path, a rect) means the icon
  if (up && small(up)) return { kind: 'svg', el: up };
  const svgs = el.querySelectorAll?.('svg');
  if (svgs?.length === 1 && small(svgs[0])) return { kind: 'svg', el: svgs[0] };
  if (/^(I|SPAN)$/.test(el.tagName) && FONT.test(el.className || '') && small(el)) return { kind: 'font', el };
  if (el.tagName === 'IMG' && /\.svg(\?|$)/.test(el.src) && small(el)) return { kind: 'img', el };
  return null;
}
const describeIcon = (ic) => ic.kind === 'font' ? `icon-font glyph \`${ic.el.className}\`` : ic.kind === 'img' ? `svg image ${ic.el.getAttribute('src')}` : `inline svg${ic.el.getAttribute('class') ? ` \`${ic.el.getAttribute('class')}\`` : ''}`;

// the names and their meanings, fetched once when you first search
let tags = null, tagsP = null;
export const loadTags = () => (tagsP ||= fetch(`${CDN}/tags.json`).then((r) => r.json()).then((t) => (tags = t)).catch(() => (tags = {})));
export function find(q) {
  const ql = q.trim().toLowerCase();
  if (!ql) return POPULAR;
  if (!tags) return POPULAR.filter((n) => n.includes(ql));
  const hits = [];
  for (const [name, words] of Object.entries(tags)) {
    const score = name === ql ? 3 : name.includes(ql) ? 2 : words.some((w) => w.includes(ql)) ? 1 : 0;
    if (score) hits.push([score, name]);
  }
  return hits.sort((a, b) => b[0] - a[0] || a[1].length - b[1].length).slice(0, 60).map((h) => h[1]);
}
const cell = (k, n, cur) => `<button class="icell ${cur === n ? 'cur' : ''}" data-act="iconpick" data-arg="${k}|${n}" data-icon="${n}" title="${n}"><img src="${svgUrl(n)}" alt="" loading="lazy"></button>`;
export function iconCells(k, q, cur) {
  const names = find(q);
  return names.length ? names.map((n) => cell(k, n, cur)).join('') : `<div class="small">No Lucide icon for “${esc(q)}”.</div>`;
}
export function iconPanel(e, el) {
  const ic = iconOf(el), k = e.k, cur = e.edits?.icon?.to;
  if (!ic) return '<div class="small">This isn\'t an icon.</div>';
  return `<div class="icontool" data-k="${k}">
    <input class="isearch" data-in="iconq" placeholder="Search icons: arrow, cart, settings…">
    <div class="igrid">${iconCells(k, '', cur)}</div>
    <div class="small">Point to preview · click to keep · Lucide, free (ISC licence)${cur ? ` · <a href="${pageUrl(cur)}" target="_blank" rel="noopener">${esc(cur)} ↗</a>` : ''}</div>
    ${cur ? `<div class="small changed">icon → ${esc(cur)} · <button class="link" data-act="iconreset" data-arg="${k}">put it back</button></div>` : ''}
  </div>`;
}

// the CSS that shows an icon in place, in the icon's own colour (the old drawing hidden, the new one as a mask)
// the colour the icon is actually drawn in: its shapes' fill or stroke (an svg often ignores the text colour)
function inkOf(ic) {
  if (ic.kind !== 'svg') return getComputedStyle(ic.el).color;
  for (const part of ic.el.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon')) {
    const cs = getComputedStyle(part);
    for (const v of [cs.fill, cs.stroke]) if (v && v !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(v)) return v;
  }
  return getComputedStyle(ic.el).color;
}
export function iconCss(k, el, name) {
  const ic = iconOf(el);
  if (!ic || !name) return [];
  // the icon itself carries the mark (it may be inside the pinned element, or hold it)
  const marks = new Set((ic.el.getAttribute('data-unide-ic') || '').split(' ').filter(Boolean));
  if (!marks.has(k)) { marks.add(k); ic.el.setAttribute('data-unide-ic', [...marks].join(' ')); }
  const s = `[data-unide-ic~="${k}"]`, url = `url("${svgUrl(name)}")`;
  if (ic.kind === 'img') return [[s, { content: url }]];
  return [
    [s, { '-webkit-mask': `${url} center / contain no-repeat`, mask: `${url} center / contain no-repeat`, 'background-color': inkOf(ic) }],
    [`${s} > *`, { opacity: '0' }], [`${s}::before`, { opacity: '0' }], [`${s}::after`, { opacity: '0' }],
  ];
}
export function choose(e, el, name) {
  const ic = iconOf(el);
  if (!ic) return false;
  e.edits ||= {};
  e.edits.icon = { from: e.edits.icon?.from ?? describeIcon(ic), to: name, url: pageUrl(name), svg: svgUrl(name) };
  return true;
}

// pointing at an icon in the grid shows it on the element
const sheet = Object.assign(document.createElement('style'), { id: 'unide-iconpreview' });
export function preview(el, name) {
  if (!sheet.isConnected) document.documentElement.append(sheet);
  document.querySelectorAll('[data-unide-ic~="preview"]').forEach((x) => x.setAttribute('data-unide-ic', x.getAttribute('data-unide-ic').replace(/\bpreview\b/, '').trim()));
  if (!el || !name) return void (sheet.textContent = '');
  sheet.textContent = iconCss('preview', el, name).map(([s, d]) => `${s}{${Object.entries(d).map(([p, v]) => `${p}:${v} !important`).join(';')}}`).join('\n');
}
