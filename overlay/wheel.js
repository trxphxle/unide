// Changing a pinned element's colours: its text, background or border, with a colour wheel, a lightness slider, a hex
// field, the eyedropper, or a swatch of the page's own colours (its tokens first). The page shows it while you drag;
// the pin tells the agent the colour, how it reads against its background, and the nearest colour token the page has.
import { esc, isMac } from './core.js';
import { parse, hex, words, contrast, oklabDist } from './colour.js';
import { effectiveBg } from './dom.js';

export const PROPS = { color: 'Text', 'background-color': 'Background', 'border-color': 'Border' };
const textIn = (el) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.trim()) return true; return false; };
export function propsFor(el) {
  const cs = getComputedStyle(el), out = [];
  if (textIn(el)) out.push('color');
  out.push('background-color');
  if (['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs[`border${s}Width`]) > 0)) out.push('border-color');
  return out;
}

// HSL, which the wheel is drawn in (hue round the ring, saturation outward, lightness on the slider)
export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
export function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map((v) => Math.round((v + m) * 255));
}

// the page's colour tokens (CSS variables on the root that hold a colour) and the colours it actually uses
export function tokens() {
  const cs = getComputedStyle(document.documentElement), out = [];
  for (const name of cs) {
    if (!name.startsWith('--') || out.length > 40) continue;
    const v = cs.getPropertyValue(name).trim(), rgb = /^(#|rgb|hsl|oklch|oklab|lab|lch|color\()/.test(v) && parse(v);
    if (rgb && rgb[3] > 0.05) out.push({ name, rgb, hex: hex(rgb) });
  }
  return out;
}
export function pageColours(max = 14) {
  const count = new Map();
  for (const el of [...document.querySelectorAll('body *')].slice(0, 600)) {
    if (el.closest('unide-overlay')) continue;
    const cs = getComputedStyle(el);
    for (const v of [cs.color, cs.backgroundColor, cs.borderTopColor]) {
      const rgb = parse(v);
      if (!rgb || rgb[3] < 0.5) continue;
      const k = hex(rgb);
      count.set(k, (count.get(k) || 0) + 1);
    }
  }
  const out = [];
  for (const [k] of [...count].sort((a, b) => b[1] - a[1])) {
    const rgb = parse(k);
    if (!out.some((o) => oklabDist(o.rgb, rgb) < 0.03)) out.push({ rgb, hex: k });
    if (out.length >= max) break;
  }
  return out;
}
// the page's token nearest a colour: the same one, or the closest
export function nearestToken(rgb) {
  let best = null;
  for (const t of tokens()) { const d = oklabDist(t.rgb, rgb); if (!best || d < best.d) best = { ...t, d }; }
  return best && best.d < 0.12 ? { name: best.name, hex: best.hex, exact: best.d < 0.015 } : null;
}
// how a text colour reads on its background (or a background under its text)
export function readability(el, prop, rgb) {
  const cs = getComputedStyle(el);
  const fg = prop === 'color' ? rgb : parse(cs.color), bg = prop === 'background-color' ? rgb : effectiveBg(el);
  if (!fg || !bg || prop === 'border-color') return null;
  const r = contrast(fg, bg), big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && +cs.fontWeight >= 700);
  return { ratio: Math.round(r * 10) / 10, ok: r >= (big ? 3 : 4.5) };
}

// the panel
const sw = (k, prop, c, title = '') => `<button class="csw" style="background:${c}" data-act="cset" data-arg="${k}|${prop}|${c}" title="${esc(title || c)}"></button>`;
export function colourPanel(e, el, prop, current) {
  const k = e.k, props = propsFor(el), p = props.includes(prop) ? prop : props[0], rgb = current(p) || [128, 128, 128];
  const [, , l] = rgbToHsl(rgb), r = readability(el, p, rgb), tok = nearestToken(rgb), toks = tokens().slice(0, 16), page = pageColours();
  const changed = e.edits?.colour?.[p];
  return `<div class="cwheel" data-k="${k}" data-prop="${p}">
    <div class="row wrap">${props.map((x) => `<button class="mini ${x === p ? 'on' : ''}" data-act="cprop" data-arg="${k}|${x}"><i class="cdot" style="background:${hex(current(x) || [0, 0, 0])}"></i>${PROPS[x]}</button>`).join('')}</div>
    <div class="cring"><canvas width="176" height="176"></canvas><b class="cmark"></b></div>
    <label class="small">Lightness <input type="range" min="0" max="100" value="${Math.round(l * 100)}" data-in="clight" data-ch="clightdone"></label>
    <div class="row"><span class="cnow" style="background:${hex(rgb)}"></span><input class="chex" value="${hex(rgb)}" data-ch="chex" spellcheck="false">
      ${'EyeDropper' in window ? `<button class="mini" data-act="ceye" data-arg="${k}" title="Pick any colour on your screen">Eyedropper</button>` : ''}</div>
    <div class="small">${esc(words(rgb))}${r ? ` · contrast ${r.ratio}:1 ${r.ok ? '· readable' : '· <span class="warn">hard to read</span>'}` : ''}${tok ? ` · ${tok.exact ? 'is' : 'near'} <code>${esc(tok.name)}</code>` : ''}</div>
    ${toks.length ? `<div class="small">The page's tokens</div><div class="cswatches">${toks.map((t) => sw(k, p, t.hex, `${t.name} ${t.hex}`)).join('')}</div>` : ''}
    <div class="small">On this page</div><div class="cswatches">${page.map((c) => sw(k, p, c.hex)).join('')}</div>
    ${changed ? `<div class="small changed">${PROPS[p].toLowerCase()} ${esc(changed.from)} → ${esc(changed.to)} · ${'<button class="link" data-act="creset" data-arg="' + k + '|' + p + '">put it back</button>'}</div>` : ''}
  </div>`;
}
// the wheel itself, drawn once it's on the page, at the slider's lightness, with a mark where the colour is
export function paint(box, rgb, ring = true) {
  const cv = box?.querySelector('canvas');
  if (!cv) return;
  const [h, s, l] = rgbToHsl(rgb), n = cv.width, g = cv.getContext('2d'), img = g.createImageData(n, n), c = n / 2;
  if (ring) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = x - c, dy = y - c, rr = Math.hypot(dx, dy) / c, i = (y * n + x) * 4;
    if (rr > 1) { img.data[i + 3] = 0; continue; }
    const [R, G, B] = hslToRgb((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, rr, l);
    img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = 255;
  }
  if (ring) g.putImageData(img, 0, 0);
  const now = box.querySelector('.cnow'), field = box.querySelector('.chex');
  if (now) now.style.background = hex(rgb);
  if (field && box.ownerDocument !== null && field !== field.getRootNode().activeElement) field.value = hex(rgb);
  const m = box.querySelector('.cmark'), a = (h * Math.PI) / 180;
  Object.assign(m.style, { left: 50 + Math.cos(a) * s * 50 + '%', top: 50 + Math.sin(a) * s * 50 + '%', background: hex(rgb) });
}
// where on the wheel the pointer is, as a colour at this lightness
export function at(box, x, y, l) {
  const r = box.querySelector('canvas').getBoundingClientRect(), c = r.width / 2, dx = x - r.left - c, dy = y - r.top - c;
  return hslToRgb((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, Math.min(1, Math.hypot(dx, dy) / c), l);
}
export const eyeHint = () => (isMac ? 'Pick any colour on your screen' : 'Pick a colour');
