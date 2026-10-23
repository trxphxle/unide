// Trying typefaces on a pinned element: the page's own fonts, then trending free fonts (Google Fonts, open licences).
// Point at one and the element shows it; click to keep it. Fonts on your Mac say so; others link to their free
// download page. Nothing is bundled: names are drawn from a tiny subset, and a font loads in full only when you try it.
import { esc } from './core.js';

export const FONTS = {
  sans: ['Inter', 'Geist', 'Manrope', 'DM Sans', 'Plus Jakarta Sans', 'Outfit', 'Sora', 'Space Grotesk', 'Figtree', 'Onest', 'Instrument Sans',
    'Bricolage Grotesque', 'Hanken Grotesk', 'Schibsted Grotesk', 'Familjen Grotesk', 'Work Sans', 'IBM Plex Sans', 'Public Sans', 'Lexend', 'Albert Sans',
    'Rubik', 'Nunito', 'Poppins', 'Montserrat', 'Archivo'],
  serif: ['Fraunces', 'Instrument Serif', 'Playfair Display', 'DM Serif Display', 'Newsreader', 'Source Serif 4', 'Literata', 'Lora', 'EB Garamond',
    'Cormorant Garamond', 'Young Serif', 'Gloock', 'Libre Caslon Text', 'Crimson Pro', 'Bodoni Moda'],
  display: ['Archivo Black', 'Bebas Neue', 'Anton', 'Unbounded', 'Syne', 'Righteous', 'Bungee', 'Rubik Mono One', 'Dela Gothic One', 'Major Mono Display', 'Climate Crisis'],
  mono: ['JetBrains Mono', 'Space Mono', 'IBM Plex Mono', 'Fira Code', 'DM Mono', 'Geist Mono', 'Martian Mono', 'Azeret Mono'],
  hand: ['Caveat', 'Kalam', 'Patrick Hand', 'Shadows Into Light', 'Homemade Apple', 'Reenie Beanie', 'Gochi Hand', 'Permanent Marker'],
};
export const GROUPS = { page: 'On this page', sans: 'Sans', serif: 'Serif', display: 'Display', mono: 'Mono', hand: 'Handwriting' };
export const pageOf = (name) => `https://fonts.google.com/specimen/${encodeURIComponent(name).replace(/%20/g, '+')}`;
const fam = (name) => name.replace(/ /g, '+');

// on your Mac? Measured before any web copy of it is loaded, so a preview can't fake it
const probe = document.createElement('canvas').getContext('2d'), have = new Map();
const SAMPLE = 'mmmmmmmmmlli10WQ@';
export function installed(name) {
  if (have.has(name)) return have.get(name);
  let yes = false;
  for (const base of ['monospace', 'serif', 'sans-serif']) {
    probe.font = `40px ${base}`; const w0 = probe.measureText(SAMPLE).width;
    probe.font = `40px "${name}", ${base}`; if (probe.measureText(SAMPLE).width !== w0) { yes = true; break; }
  }
  have.set(name, yes);
  return yes;
}
// the fonts the page uses itself (headings, text, buttons)
export function pageFonts() {
  const seen = new Set();
  for (const el of document.querySelectorAll('h1, h2, h3, p, a, button, li, label, input, body')) {
    if (el.closest('unide-overlay')) continue;
    const f = getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
    if (f && !/^(Archivo Black|Space Mono)$/.test(f)) seen.add(f);
    if (seen.size >= 6) break;
  }
  return [...seen];
}
const all = () => Object.values(FONTS).flat();

// the list's names, each drawn in its own face: one small request with just the letters of the names
let listLoaded = false;
function loadList() {
  if (listLoaded) return;
  listLoaded = true;
  all().forEach(installed); // decide before any web copy arrives
  const names = all().filter((n) => !installed(n)), letters = [...new Set(names.join('').replace(/\s/g, ''))].join('');
  for (let i = 0; i < names.length; i += 30) {
    const url = `https://fonts.googleapis.com/css2?${names.slice(i, i + 30).map((n) => `family=${fam(n)}`).join('&')}&text=${encodeURIComponent(letters)}&display=swap`;
    document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: url, className: 'unide-fontlist' }));
  }
}
// one font in full, the moment you try it (regular and bold)
const full = new Set();
export function loadFull(name) {
  if (full.has(name) || installed(name) || !all().includes(name)) return;
  full.add(name);
  document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?family=${fam(name)}:wght@400;700&display=swap`, className: 'unide-fontfull' }));
}

// a row: the name in its own face, and where it comes from (the page, your Mac, or a free download)
function row(k, n, picked, page) {
  const src = page.includes(n) ? 'on this page' : installed(n) ? 'on your Mac' : all().includes(n) ? `<a href="${pageOf(n)}" target="_blank" rel="noopener">Get ↗</a>` : '';
  return `<div class="frow ${picked === n ? 'cur' : ''}" data-font="${esc(n)}"><button class="fname" data-act="fontpick" data-arg="${k}|${esc(n)}" style="font-family:'${esc(n)}', var(--mono)">${esc(n)}</button><span class="fsrc">${src}</span></div>`;
}
// the panel inside the pin card
export function fontPanel(e, group = 'sans', picked = null) {
  loadList();
  const k = e.k, page = pageFonts();
  const tabs = Object.entries(GROUPS).filter(([g]) => g !== 'page' || page.length)
    .map(([g, label]) => `<button class="mini ${g === group ? 'on' : ''}" data-act="fontgroup" data-arg="${k}|${g}">${label}</button>`).join('');
  const names = group === 'page' ? page : FONTS[group] || [];
  const rows = names.map((n) => row(k, n, picked, page)).join('');
  return `<div class="fonts" data-k="${k}"><div class="row wrap">${tabs}</div>
    <input class="fsearch" data-in="fontq" placeholder="Search ${all().length} fonts" value="">
    <div class="flist">${rows}</div>
    <div class="small">Point to preview on the element · click to keep · <a href="https://fonts.google.com" target="_blank" rel="noopener">more on Google Fonts ↗</a></div></div>`;
}
// search across every group: rows for the matches, replacing the list
export function searchRows(k, q, picked) {
  const ql = q.trim().toLowerCase(), names = ql ? [...new Set([...pageFonts(), ...all()])].filter((n) => n.toLowerCase().includes(ql)) : [];
  const page = pageFonts();
  return names.map((n) => row(k, n, picked, page)).join('')
    || `<div class="small">No font called “${esc(q)}” in the list. <a href="https://fonts.google.com/?query=${encodeURIComponent(q)}" target="_blank" rel="noopener">Search Google Fonts ↗</a></div>`;
}

// the element shows a font while you point at it
const sheet = Object.assign(document.createElement('style'), { id: 'unide-fontpreview' });
export function preview(el, name) {
  if (!sheet.isConnected) document.documentElement.append(sheet);
  if (!el || !name) { sheet.textContent = ''; document.querySelectorAll('[data-unide-font]').forEach((x) => x.removeAttribute('data-unide-font')); return; }
  loadFull(name);
  el.setAttribute('data-unide-font', '');
  sheet.textContent = `[data-unide-font], [data-unide-font] * { font-family:"${name.replace(/"/g, '')}", ${getComputedStyle(el).fontFamily} !important; }`;
}
// the kept choice, as a change by hand (edits.js shows it, the pin tells the agent)
export function choose(e, el, name) {
  const from = getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
  e.edits ||= {};
  if (from === name && !e.edits.font) return false;
  e.edits.font = { from: e.edits.font?.from ?? from, to: name, installed: installed(name), url: all().includes(name) ? pageOf(name) : null };
  if (e.edits.font.from === name) delete e.edits.font;
  return true;
}
