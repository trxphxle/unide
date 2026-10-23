// Changing a pinned element on the page with your hands: rewrite its text, hide it, drag its size, padding and
// corner radius, move it among its neighbours, or give it another element's look. Nothing touches your files: the
// page shows the change (one stylesheet, and the text you typed) and the pin tells the agent exactly what to make the
// code do. Only the pinned element changes, unless the note says otherwise.
import { root, esc, isMac } from './core.js';
import { decl } from './preview.js';
import { nameOf, tagOf, pathOf } from './dom.js';
import { loadFull } from './fonts.js';
import { imageOf, imageCss } from './images.js';
import { iconOf, iconCss } from './icons.js';

const sheet = Object.assign(document.createElement('style'), { id: 'unide-edits' });
const ensureSheet = () => { if (!sheet.isConnected) document.documentElement.append(sheet); };

const px = (v) => Math.round(parseFloat(v) || 0);
const sel = (k) => `[data-unide-e~="${k}"]`;
const SIDES = ['top', 'right', 'bottom', 'left'];
const LOOK = ['background-color', 'color', 'border-color', 'border-width', 'border-style', 'border-radius', 'padding', 'font-family',
  'font-size', 'font-weight', 'letter-spacing', 'line-height', 'text-transform', 'box-shadow'];
export const LOOK_LABEL = { 'background-color': 'background', color: 'text colour', 'border-color': 'border colour', 'border-width': 'border width',
  'border-style': 'border style', 'border-radius': 'corner radius', padding: 'padding', 'font-family': 'typeface', 'font-size': 'text size',
  'font-weight': 'weight', 'letter-spacing': 'tracking', 'line-height': 'line height', 'text-transform': 'capitalisation', 'box-shadow': 'shadow' };

// ---------- showing the changes on the page ----------
const flexy = (el) => /flex|grid/.test(getComputedStyle(el).display);
const siblingsOf = (el) => [...(el.parentElement?.children || [])].filter((c) => c.tagName !== 'UNIDE-OVERLAY' && !/^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(c.tagName));
function declsFor(el, ed) {
  const d = {};
  if (ed.hide) d.display = 'none';
  const b = ed.box || {}, inFlex = el.parentElement && flexy(el.parentElement);
  if (b.width) Object.assign(d, { 'box-sizing': 'border-box', width: b.width[1] + 'px', 'max-width': 'none', 'min-width': '0' }, inFlex ? { 'flex-basis': b.width[1] + 'px', 'flex-grow': '0', 'flex-shrink': '0' } : {});
  if (b.height) Object.assign(d, { 'box-sizing': 'border-box', height: b.height[1] + 'px', 'max-height': 'none', 'min-height': '0' });
  for (const s of SIDES) if (b.padding?.[s]) d[`padding-${s}`] = b.padding[s][1] + 'px';
  if (b.radius) d['border-radius'] = b.radius[1] + 'px';
  for (const x of ed.look?.diffs || []) if (!(x.prop === 'padding' && b.padding) && !(x.prop === 'border-radius' && b.radius)) d[x.prop] = x.to;
  for (const [p, c] of Object.entries(ed.colour || {})) d[p] = c.to;
  for (const [p, c] of Object.entries(ed.type || {})) d[p] = c.to;
  if (ed.font) { loadFull(ed.font.to); d['font-family'] = `"${ed.font.to}", ${ed.font.from}`; }
  return d;
}
const applied = new Map(); // k → the text nodes changed and what they said
let orderRules = [];
// every pinned element with changes: mark it, write its rule, put its text and order in
export function applyEdits(list) {
  ensureSheet();
  const css = [], keep = new Set();
  orderRules = [];
  for (const el of document.querySelectorAll('[data-unide-ord]')) el.removeAttribute('data-unide-ord');
  for (const { e, el } of list) {
    const ed = e.edits;
    if (!el || !ed || !Object.keys(ed).length) continue;
    const at = (s) => atState(s, sel(e.k), ed.at); // changes made for a state (hover, pressed…) apply in that state
    const ks = new Set((el.getAttribute('data-unide-e') || '').split(' ').filter(Boolean));
    if (!ks.has(e.k)) { ks.add(e.k); el.setAttribute('data-unide-e', [...ks].join(' ')); }
    css.push(decl(at(sel(e.k)), declsFor(el, ed)));
    if (ed.font) css.push(decl(at(`${sel(e.k)} *`), { 'font-family': `"${ed.font.to}", ${ed.font.from}` })); // its text inside, too
    for (const [s, d] of [...imageCss(sel(e.k), el, ed.image), ...iconCss(e.k, el, ed.icon?.to)]) css.push(decl(s, d));
    if (ed.text) { keep.add(e.k); putText(e.k, el, ed.text.to); }
    if (ed.move && el.parentElement && flexy(el.parentElement)) order(el, ed.move);
  }
  for (const [k, a] of applied) if (!keep.has(k)) { restoreText(a); applied.delete(k); }
  sheet.textContent = [...css, ...orderRules].filter(Boolean).join('\n');
}
function textNodes(el) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), out = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.trim()) out.push(n);
  return out;
}
function putText(k, el, to) {
  let a = applied.get(k);
  if (a && (a.el !== el || a.nodes.some((n) => !n.isConnected))) { applied.delete(k); a = null; }
  if (!a) { const nodes = textNodes(el); if (!nodes.length) return; a = { el, nodes, orig: nodes.map((n) => n.nodeValue) }; applied.set(k, a); }
  const lead = a.orig[0].match(/^\s*/)[0], tail = a.orig.at(-1).match(/\s*$/)[0];
  a.nodes.forEach((n, i) => { const v = i === 0 ? lead + to + (a.nodes.length === 1 ? tail : '') : ''; if (n.nodeValue !== v) n.nodeValue = v; });
}
const restoreText = (a) => a.nodes.forEach((n, i) => { if (n.isConnected) n.nodeValue = a.orig[i]; });
// in a row, column or grid the move is shown: every sibling gets its place, this one the new one
function order(el, mv) {
  const sibs = siblingsOf(el), i = sibs.indexOf(el), to = Math.max(0, Math.min(sibs.length - 1, i + mv.by));
  sibs.forEach((s, j) => { const n = s === el ? to * 2 + (mv.by < 0 ? -1 : 1) : j * 2; s.setAttribute('data-unide-ord', n); orderRules.push(`[data-unide-ord="${n}"]{order:${n} !important}`); });
}

// what a property is in the code today, without these changes
export function original(el, prop) {
  sheet.disabled = true;
  try { return getComputedStyle(el).getPropertyValue(prop); } finally { sheet.disabled = false; }
}

// a selector for one state: the real pseudo-class, and the attribute States uses to show it
const PSEUDO = { hover: [':hover', '[data-unide-hover]'], pressed: [':active', '[data-unide-active]'], focus: [':focus-visible', '[data-unide-focus-visible]'], disabled: [':disabled', '[disabled]'] };
function atState(s, tok, state) {
  const p = PSEUDO[state];
  return p ? p.map((x) => s.replace(tok, tok + x)).join(', ') : s;
}

// ---------- what was changed, in words (for the card and the agent) ----------
const nm = (x) => `${x.name}${x.text ? ` “${x.text}”` : ''}`;
export function editWords(ed = {}) {
  const out = [];
  if (!Object.keys(ed).some((k) => k !== 'at')) return out; // a state chosen, nothing changed yet
  if (ed.text) out.push(`text “${ed.text.from}” → “${ed.text.to}”`);
  if (ed.at && ed.at !== 'normal') out.push(`(for its ${ed.at} state)`);
  if (ed.hide) out.push('remove it');
  const b = ed.box || {};
  if (b.width) out.push(`width ${b.width[0]} → ${b.width[1]}px`);
  if (b.height) out.push(`height ${b.height[0]} → ${b.height[1]}px`);
  const pads = SIDES.filter((s) => b.padding?.[s]);
  if (pads.length) out.push(`padding ${pads.map((s) => `${s} ${b.padding[s][0]} → ${b.padding[s][1]}px`).join(', ')}`);
  if (b.radius) out.push(`corner radius ${b.radius[0]} → ${b.radius[1]}px`);
  if (ed.move) out.push(`move it ${ed.move.by < 0 ? 'before' : 'after'} ${nm(ed.move.next)}${ed.move.shown ? '' : ' (marked on the page, not moved)'}`);
  const own = (x) => !(x.prop === 'border-radius' && b.radius) && !(x.prop === 'padding' && b.padding); // dragged after: those win
  for (const [p, c] of Object.entries(ed.type || {})) out.push(`${{ 'font-size': 'text size', 'font-weight': 'weight', 'line-height': 'line height', 'letter-spacing': 'letter spacing', 'text-transform': 'capitals', 'text-align': 'alignment' }[p]} ${c.from} → ${c.to}`);
  for (const [p, c] of Object.entries(ed.colour || {})) out.push(`${{ color: 'text colour', 'background-color': 'background', 'border-color': 'border colour' }[p]} ${c.from} → ${c.to}`);
  if (ed.image?.src) out.push(`image → ${ed.image.src.name || ed.image.src.url.slice(0, 50)}`);
  if (ed.image?.fit) out.push(`fit ${ed.image.fit.from} → ${ed.image.fit.to}`);
  if (ed.image?.focus) out.push(`focal point ${ed.image.focus.to}`);
  if (ed.icon) out.push(`icon → ${ed.icon.to}`);
  if (ed.font) out.push(`typeface ${ed.font.from} → ${ed.font.to}${ed.font.installed ? '' : ' (not on your Mac)'}`);
  if (ed.look) out.push(`the look of ${nm(ed.look.from)}: ${ed.look.diffs.filter(own).map((x) => `${LOOK_LABEL[x.prop]} ${x.from} → ${x.to}`).join('; ')}`);
  return out;
}

// ---------- the card's row ----------
const act = (a, k, label, cls = 'mini', title = '') => `<button class="${cls}" data-act="${a}" data-arg="${k}"${title ? ` title="${esc(title)}"` : ''}>${label}</button>`;
export function editRow(e, el, named, state) {
  if (!el || e.three) return '';
  const ed = e.edits || {}, words = editWords(ed), hasText = textNodes(el).length > 0, k = e.k;
  const look = state.lookFor === k, shape = state.shape === k;
  const side = state.side?.k === k ? (['colour', 'text', 'font', 'states', 'look'].includes(state.side.kind) ? 'style' : state.side.kind) : null;
  return `<div class="edits">${named ? `<div class="small"><b>${esc(e.name)}</b></div>` : ''}
    <div class="row wrap">
      ${hasText ? act('edittext', k, 'Edit text', 'mini', 'Rewrite it right here') : ''}
      ${act('edithide', k, ed.hide ? 'Show' : 'Hide', `mini ${ed.hide ? 'on' : ''}`, 'Take it off the page: the pin says to remove it')}
      ${act('editshape', k, 'Shape', `mini ${shape ? 'on' : ''}`, 'Drag its edges for size, the inner bars for padding, the corner dot for roundness (⇧ for all sides)')}
      ${act('editmove', `${k}|-1`, '↑', 'mini', 'Move it before the one before it')}${act('editmove', `${k}|1`, '↓', 'mini', 'Move it after the one after it')}
      ${act('editside', `${k}|style`, 'Style', `mini ${side === 'style' ? 'on' : ''}`, 'Colour, font, and copying another element\'s look')}
      ${imageOf(el) ? act('editside', `${k}|image`, 'Image', `mini ${side === 'image' ? 'on' : ''}`, 'Swap the picture, how it fits, its focal point') : ''}
      ${iconOf(el) ? act('editside', `${k}|icon`, 'Icon', `mini ${side === 'icon' ? 'on' : ''}`, 'Swap it for a free Lucide icon') : ''}
      ${words.length ? act('editundo', k, 'Undo', 'mini', `${isMac ? '⌘' : 'Ctrl+'}Z`) + act('editreset', k, 'Reset', 'mini') : ''}
    </div>
    ${look ? `<div class="small">${isMac ? '⌥' : 'Alt'}-click the one whose look you want · Esc cancels</div>` : ''}
    ${shape ? '<div class="small">Drag: edges for size, the inner bars for padding, the dot for corners · ⇧ for all sides</div>' : ''}
    ${words.length ? `<div class="small changed">On the page: ${esc(words.join(' · '))}</div>` : ''}</div>`;
}

// a short way to name a neighbour or the element a look comes from: its id or heading, not all its text run together
function brief(n) {
  const head = n.querySelector?.('h1,h2,h3,h4,h5,h6,legend,[aria-label]'), raw = head ? head.getAttribute('aria-label') || head.innerText : n.innerText || n.textContent || '';
  const text = raw.split('\n').map((t) => t.trim()).filter(Boolean)[0]?.slice(0, 40) || '';
  return { name: n.id ? `#${n.id}` : nameOf(n) === 'element' ? tagOf(n).split('.').slice(0, 2).join('.') : nameOf(n), tag: tagOf(n), text, path: pathOf(n) };
}

// ---------- changes, with undo ----------
const undos = new Map(); // k → earlier versions of its changes
const snap = (e) => { const s = undos.get(e.k) || []; s.push(JSON.stringify(e.edits || {})); undos.set(e.k, s.slice(-50)); };
const tidy = (e) => { if (e.edits && !Object.keys(e.edits).filter((x) => x !== 'at').length && !e.edits.at) delete e.edits; };
export const snapshot = (e) => snap(e);
export const tidyEdits = (e) => tidy(e);
export function undo(e) {
  const s = undos.get(e.k);
  if (!s?.length) return false;
  e.edits = JSON.parse(s.pop()); tidy(e);
  return true;
}
export function reset(e) { if (!e.edits) return false; snap(e); delete e.edits; return true; }
export function toggleHide(e) {
  snap(e); e.edits ||= {};
  if (e.edits.hide) delete e.edits.hide; else e.edits.hide = true;
  tidy(e);
}
export function move(e, el, dir) {
  const sibs = siblingsOf(el), i = sibs.indexOf(el);
  const by = (e.edits?.move?.by || 0) + dir, to = i + by;
  if (to < 0 || to >= sibs.length) return false;
  snap(e); e.edits ||= {};
  if (!by) delete e.edits.move;
  else e.edits.move = { by, shown: flexy(el.parentElement), next: brief(sibs[to]) };
  tidy(e);
  return true;
}
export function copyLook(e, el, from) {
  if (!from || from === el) return false;
  // compared as the page is without these changes, so "from" is what the code says today
  sheet.disabled = true;
  let diffs;
  try {
    const a = getComputedStyle(el), b = getComputedStyle(from);
    diffs = LOOK.map((p) => ({ prop: p, from: a.getPropertyValue(p), to: b.getPropertyValue(p) })).filter((x) => x.from !== x.to);
  } finally { sheet.disabled = false; }
  snap(e); e.edits ||= {};
  // the newest change wins: the look's corners and padding replace ones dragged before
  if (e.edits.box) { delete e.edits.box.radius; delete e.edits.box.padding; if (!Object.keys(e.edits.box).length) delete e.edits.box; }
  e.edits.look = { from: brief(from), diffs };
  return true;
}

// ---------- rewriting its text in place ----------
let editor = null;
export function editText(e, el, done) {
  closeEditor();
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el), was = e.edits?.text?.from ?? (el.innerText || el.textContent || '').trim();
  const ta = editor = document.createElement('textarea');
  ta.className = 'etext';
  ta.value = e.edits?.text?.to ?? was;
  Object.assign(ta.style, { left: r.left + 'px', top: r.top + 'px', width: Math.max(r.width, 120) + 'px', height: Math.max(r.height, 28) + 'px',
    font: cs.font, letterSpacing: cs.letterSpacing, color: cs.color, textAlign: cs.textAlign, padding: cs.padding });
  root.append(ta);
  ta.focus(); ta.select();
  const finish = (keep) => {
    if (editor !== ta) return;
    closeEditor();
    const to = ta.value.replace(/\s+$/, '');
    if (!keep || to === (e.edits?.text?.to ?? was)) return done(false);
    snap(e); e.edits ||= {};
    if (to === was) delete e.edits.text; else e.edits.text = { from: was, to };
    tidy(e);
    done(true);
  };
  ta.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); finish(true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(false); }
  });
  ta.addEventListener('blur', () => finish(true));
}
export function closeEditor() { const t = editor; editor = null; t?.remove(); }

// ---------- handles: size, padding, corners ----------
const box = Object.assign(document.createElement('div'), { className: 'ehandles' });
const H = ['w', 'h', 'wh', 'r', 'p-top', 'p-right', 'p-bottom', 'p-left'];
// what each handle does, shown when you point at it
const TIP = { w: 'drag: width', h: 'drag: height', wh: 'drag: width and height', r: 'drag in: rounder corners',
  'p-top': 'drag: padding top (⇧ all sides)', 'p-right': 'drag: padding right (⇧ all sides)', 'p-bottom': 'drag: padding bottom (⇧ all sides)', 'p-left': 'drag: padding left (⇧ all sides)' };
// the padding shown as shaded bands (like the box view in browser developer tools), under the handles
box.innerHTML = SIDES.map((s) => `<u class="epad epad-${s}"></u>`).join('') + H.map((h) => `<i class="eh eh-${h}" data-h="${h}" data-tip="${TIP[h]}"></i>`).join('') + '<b class="eline"></b>';
// while dragging: the size it had, dashed, and the value next to the pointer
const ghost = Object.assign(document.createElement('div'), { className: 'eghost' });
const read = Object.assign(document.createElement('div'), { className: 'eread' });
let drag = null, target = null;
// shown for the open pin's element while Shape is on; the move line while it has a move that isn't shown
export function showHandles(e, el, on, commit) {
  if (!box.isConnected) { root.prepend(box); root.append(ghost, read); }
  target = on && el && e ? { e, el, commit } : (e && el && e.edits?.move && !e.edits.move.shown ? { e, el, commit, lineOnly: true } : null);
  box.style.display = target ? 'block' : 'none';
  if (target) placeHandles();
}
function placeHandles() {
  const { el, e, lineOnly } = target, r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  box.classList.toggle('lineonly', !!lineOnly);
  // the corner dot sits just outside the top-right corner (the badge has the top-left); drag it in for rounder
  const rad = Math.min(px(cs.borderTopRightRadius), r.width / 2, r.height / 2);
  const q = (h) => box.querySelector(`.eh-${h}`);
  Object.assign(q('r').style, { right: -12 + rad * 0.3 + 'px', top: -12 + rad * 0.3 + 'px' });
  // the padding bands sit inside the border
  const bw = Object.fromEntries(SIDES.map((s) => [s, px(cs[`border${s[0].toUpperCase()}${s.slice(1)}Width`])]));
  const pd = Object.fromEntries(SIDES.map((s) => [s, px(cs[`padding${s[0].toUpperCase()}${s.slice(1)}`])]));
  const inner = { left: bw.left, top: bw.top, width: r.width - bw.left - bw.right, height: r.height - bw.top - bw.bottom };
  const band = (s, st) => Object.assign(box.querySelector(`.epad-${s}`).style, st);
  band('top', { left: inner.left + 'px', top: inner.top + 'px', width: inner.width + 'px', height: pd.top + 'px' });
  band('bottom', { left: inner.left + 'px', top: inner.top + inner.height - pd.bottom + 'px', width: inner.width + 'px', height: pd.bottom + 'px' });
  band('left', { left: inner.left + 'px', top: inner.top + pd.top + 'px', width: pd.left + 'px', height: Math.max(0, inner.height - pd.top - pd.bottom) + 'px' });
  band('right', { left: inner.left + inner.width - pd.right + 'px', top: inner.top + pd.top + 'px', width: pd.right + 'px', height: Math.max(0, inner.height - pd.top - pd.bottom) + 'px' });
  for (const s of SIDES) {
    const p = pd[s] + bw[s], st = q(`p-${s}`).style;
    st.left = st.top = st.right = st.bottom = '';
    if (s === 'top') Object.assign(st, { top: p + 'px', left: '50%' }); else if (s === 'bottom') Object.assign(st, { bottom: p + 'px', left: '50%' });
    else if (s === 'left') Object.assign(st, { left: p + 'px', top: '50%' }); else Object.assign(st, { right: p + 'px', top: '50%' });
  }
  // where a move goes when it can't be shown: a line at the neighbour's edge
  const line = box.querySelector('.eline'), mv = e.edits?.move;
  if (mv && !mv.shown) {
    const sibs = siblingsOf(el), i = sibs.indexOf(el), n = sibs[Math.max(0, Math.min(sibs.length - 1, i + mv.by))], nr = n?.getBoundingClientRect();
    if (nr) Object.assign(line.style, { display: 'block', left: nr.left - r.left + 'px', width: nr.width + 'px', top: (mv.by < 0 ? nr.top : nr.bottom) - r.top - 1 + 'px' });
  } else line.style.display = 'none';
}
export const refreshHandles = () => { if (target?.el?.isConnected) placeHandles(); };
box.addEventListener('pointerdown', (ev) => {
  const h = ev.composedPath()[0]?.dataset?.h;
  if (!h || !target || target.lineOnly) return;
  ev.preventDefault();
  const { e, el } = target, r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  const pad = Object.fromEntries(SIDES.map((s) => [s, px(cs[`padding${s[0].toUpperCase()}${s.slice(1)}`])]));
  snap(e);
  drag = { h, x: ev.clientX, y: ev.clientY, w: Math.round(r.width), hh: Math.round(r.height), pad, rad: px(cs.borderTopRightRadius), maxRad: Math.round(Math.min(r.width, r.height) / 2) };
  Object.assign(ghost.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: cs.borderRadius });
  box.classList.add('dragging'); box.dataset.h = h;
  showRead(ev);
});
// the value being dragged, in words, by the pointer
function showRead(ev) {
  const b = target?.e.edits?.box || {}, h = drag.h, v = (x, from) => `${x?.[1] ?? from}px`;
  const side = h.slice(2);
  const text = h === 'r' ? `corner radius ${v(b.radius, drag.rad)}`
    : h.startsWith('p-') ? `padding ${ev.shiftKey ? 'all sides' : side} ${v(b.padding?.[side], drag.pad[side])}`
    : [h !== 'h' && `width ${v(b.width, drag.w)}`, h !== 'w' && `height ${v(b.height, drag.hh)}`].filter(Boolean).join(' × ');
  read.textContent = text;
  Object.assign(read.style, { display: 'block', left: Math.min(innerWidth - 200, ev.clientX + 16) + 'px', top: Math.min(innerHeight - 30, ev.clientY + 18) + 'px' });
}
addEventListener('pointermove', (ev) => {
  if (!drag || !target) return;
  const { e, el } = target, dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
  e.edits ||= {}; const b = e.edits.box ||= {};
  const set = (key, from, to) => { b[key] = [b[key]?.[0] ?? from, Math.max(0, Math.round(to))]; };
  if (drag.h === 'w' || drag.h === 'wh') set('width', drag.w, drag.w + dx);
  if (drag.h === 'h' || drag.h === 'wh') set('height', drag.hh, drag.hh + dy);
  if (drag.h === 'r') set('radius', drag.rad, Math.min(drag.maxRad, drag.rad + (dy - dx) / 2));
  if (drag.h.startsWith('p-')) {
    const s = drag.h.slice(2), inward = { top: dy, bottom: -dy, left: dx, right: -dx }[s], sides = ev.shiftKey ? SIDES : [s];
    b.padding ||= {};
    for (const x of sides) b.padding[x] = [b.padding[x]?.[0] ?? drag.pad[x], Math.max(0, Math.round(drag.pad[s] + inward))];
  }
  target.commit(false);
  placeHandles();
  showRead(ev);
}, true);
addEventListener('pointerup', () => {
  if (!drag) return;
  drag = null;
  ghost.style.display = read.style.display = 'none';
  box.classList.remove('dragging'); delete box.dataset.h;
  const b = target?.e.edits?.box;
  // a value dragged back to where it started isn't a change
  if (b) {
    for (const key of ['width', 'height', 'radius']) if (b[key] && b[key][0] === b[key][1]) delete b[key];
    for (const s of SIDES) if (b.padding?.[s] && b.padding[s][0] === b.padding[s][1]) delete b.padding[s];
    if (b.padding && !Object.keys(b.padding).length) delete b.padding;
    if (!Object.keys(b).length) delete target.e.edits.box;
    tidy(target.e);
  }
  target?.commit(true);
}, true);
