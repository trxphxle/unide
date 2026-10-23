// Page-wide changes: the palette's colour tokens, a type scale, and fonts.
import { S, zero } from './core.js';
import { parse, toOklch, oklchToRgb, hex, shift, moved, round, px } from './colour.js';
import { colourTokens, pathOf, ownText, visible } from './dom.js';
import { providers, clean, decl } from './preview.js';
import { lookup } from './selection.js';

// ---------- palette tokens ----------
let tokenCache = null;
export function tokens(refresh = false) {
  if (!tokenCache || refresh) tokenCache = clean(() => colourTokens());
  return tokenCache;
}
export function tokenDraft(key) {
  if (!S.page.tokens[key]) {
    const t = tokens().find((x) => x.key === key);
    S.page.tokens[key] = { key, name: t.name, selector: t.selector, rgba: t.rgba, users: t.users, steps: zero(), set: null };
    lookup(t.name + ':');
  }
  return S.page.tokens[key];
}
export function tokenValue(t) {
  const base = t.set ? [...parse(t.set).slice(0, 3), t.rgba[3]] : t.rgba;
  const rgb = oklchToRgb(shift(toOklch(base), t.steps));
  return { rgb, a: t.rgba[3], hex: hex(rgb, t.rgba[3]) };
}
export const changedTokens = () => Object.values(S.page.tokens).filter((t) => moved(t.steps) || t.set);

// ---------- type scale ----------
export const RATIOS = [[1.125, 'Major second (1.125): subtle steps'], [1.2, 'Minor third (1.2): balanced'], [1.25, 'Major third (1.25): clear steps'],
  [1.333, 'Perfect fourth (1.333): bold'], [1.5, 'Perfect fifth (1.5): dramatic']];
const isMono = (family, tag) => /mono|code|courier|consolas|menlo/i.test(family) || /^(CODE|PRE|KBD|SAMP)$/.test(tag);
function textElements() {
  return clean(() => [...document.body.querySelectorAll('*')].filter((el) => visible(el) && ownText(el)).slice(0, 1500).map((el) => {
    const cs = getComputedStyle(el);
    return { el, path: pathOf(el), size: px(cs.fontSize), family: cs.fontFamily, tag: el.tagName };
  }));
}
export function mostCommonSize(els = textElements()) {
  const n = new Map();
  for (const t of els) n.set(t.size, (n.get(t.size) || 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] || 16;
}
export function scaleSteps(base, ratio) {
  const out = [];
  for (let k = -4; k <= 8; k++) out.push(round(base * ratio ** k));
  return out.filter((v) => v >= 8 && v <= 120);
}
const snap = (size, steps) => steps.reduce((a, b) => (Math.abs(b - size) < Math.abs(a - size) ? b : a));
export function setScale(on, base, ratio) {
  if (!on) return void (S.page.scale = null);
  const targets = textElements();
  S.page.scale = { base: base || mostCommonSize(targets), ratio: ratio || 1.2, targets };
}
// each size on the page and the scale step it snaps to
export function scaleMapping() {
  const sc = S.page.scale, steps = scaleSteps(sc.base, sc.ratio), m = new Map();
  for (const t of sc.targets) {
    const e = m.get(t.size) || { from: t.size, to: snap(t.size, steps), count: 0, sample: t.el };
    e.count++; m.set(t.size, e);
  }
  return [...m.values()].sort((a, b) => b.from - a.from);
}

// ---------- fonts (from Google Fonts) ----------
export const FONTS = {
  'Sans serif': ['Inter', 'Geist', 'Manrope', 'DM Sans', 'IBM Plex Sans', 'Work Sans', 'Space Grotesk', 'Archivo', 'Outfit'],
  Serif: ['Fraunces', 'Newsreader', 'Source Serif 4', 'Playfair Display', 'Instrument Serif', 'Libre Caslon Text', 'Lora'],
  Display: ['Bricolage Grotesque', 'Syne', 'Unbounded', 'Space Mono'],
};
const loaded = new Set();
// try the variable version first; fonts with fixed weights reject that, so fall back to the plain family
export function loadFont(name) {
  if (!name || loaded.has(name)) return;
  loaded.add(name);
  const fam = encodeURIComponent(name).replace(/%20/g, '+');
  const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?family=${fam}:wght@100..900&display=swap` });
  link.onerror = () => { link.href = `https://fonts.googleapis.com/css2?family=${fam}&display=swap`; link.onerror = null; };
  link.dataset.unide = 'font';
  document.head.append(link);
}
export function setFonts(heading, body) {
  if (!heading && !body) return void (S.page.fonts = null);
  loadFont(heading); loadFont(body);
  const els = S.page.fonts?.targets || textElements(), base = mostCommonSize(els);
  const targets = els.filter((t) => !isMono(t.family, t.tag)).map((t) => ({ ...t, role: /^H[1-6]$/.test(t.tag) || t.size >= base * 1.3 ? 'heading' : 'body' }));
  S.page.fonts = { heading, body, targets, was: { heading: firstFamily(targets, 'heading'), body: firstFamily(targets, 'body') } };
}
function firstFamily(targets, role) {
  const n = new Map();
  for (const t of targets.filter((x) => x.role === role)) { const f = t.family.split(',')[0].replace(/["']/g, '').trim(); n.set(f, (n.get(f) || 0) + 1); }
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

// ---------- the page's preview ----------
providers.push({ id: 'page', css: () => {
  const out = changedTokens().map((t) => `${t.selector}{${t.name}:${tokenValue(t).hex} !important}`);
  if (S.page.scale) {
    const steps = scaleSteps(S.page.scale.base, S.page.scale.ratio);
    for (const t of S.page.scale.targets) { const to = snap(t.size, steps); if (to !== t.size) out.push(decl(t.path, { 'font-size': `${to}px` })); }
  }
  const f = S.page.fonts;
  if (f) for (const t of f.targets) {
    const name = f[t.role];
    if (name) out.push(decl(t.path, { 'font-family': `"${name}", ${FONTS.Serif.includes(name) ? 'Georgia, serif' : 'system-ui, sans-serif'}` }));
  }
  return out.filter(Boolean).join('\n');
} });
export const hasPageDraft = () => !!(changedTokens().length || S.page.scale || S.page.fonts);
