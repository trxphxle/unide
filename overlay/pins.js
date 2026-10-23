// Pins: click something, say what should change, send it to your agent, and see its answer on the page.
// Pins are saved on the server as you go, so a reload (or the agent's next design) doesn't lose them.
import { S, pageState, root, $, esc, actions, inputs, changes, render, api, setTimeout, setInterval, requestAnimationFrame, optClick, isMac } from './core.js';
import { makeSel } from './selection.js';
import { facts, factLine } from './measure.js';
import { clean } from './preview.js';
import { setPicking } from './picking.js';
import { componentOf } from './components.js';
import { ruleSource } from './stylesource.js';
import { setRoot } from './sourcemap.js';
import { pathOf, allRules, splitList, TRANSIENT, specificity } from './dom.js';
import { shoot } from './shot.js';
import { frozen, freeze, unfreeze, isQuiet, forceState, unforce } from './freeze.js';
import { shadowOf, label, rectOf, above, stackAt } from './layers.js';
import { expand } from './dock.js';
import * as ed from './edits.js';
import * as fonts from './fonts.js';
import * as wheel from './wheel.js';
import * as images from './images.js';
import * as icons from './icons.js';
import * as compare from './compare.js';
import * as type from './type.js';
import { parse, hex, words } from './colour.js';
import { INK } from './styles.js';
import { info3, liveRect3, topIs, resolve3, showOutline, targetOf3, outline3, spot3 } from './three.js';

export const P = { pins: [], open: null, list: false, toast: '' };
const LABEL = { draft: 'not sent', sent: 'sent — waiting for the agent', options: 'options ready: flip between them', addressed: 'addressed', skipped: 'skipped', dismissed: 'dismissed' };
const shown = () => P.pins.filter((p) => p.status !== 'dismissed').sort((a, b) => a.id - b.id);
export const drafts = () => P.pins.filter((p) => p.status === 'draft');

// what the agent needs to know about a clicked element: what it is, which component drew it and where
// that's written, and where its styles are written (through source maps when the styles are compiled)
async function info(el, t = {}) {
  const s = makeSel(el);
  let selectors = [...new Set([...s.drafts.filter((d) => d.win && !d.win.inline).map((d) => d.win.selector), ...Object.values(s.style)])];
  const reset = (q) => /^(\*|::?[\w-]+|[a-z][a-z0-9]*|html|body|:root|:host)(\s*,\s*(\*|::?[\w-]+|[a-z][a-z0-9]*))*$/i.test(q.trim()) || /^:where\(/.test(q);
  if (selectors.some((q) => !reset(q))) selectors = selectors.filter((q) => !reset(q));
  selectors = selectors.slice(0, 4);
  const [component, sources] = await Promise.all([componentOf(el), Promise.all(selectors.map((q) => ruleSource(s.styleRules[q], q).then((src) => ({ selector: q, ...(src || {}) }))))]);
  // frameworks that know the file but not the line (Vue): find the element in that file by its class or text
  if (component?.file && !component.line) {
    const cls = (el.getAttribute('class') || '').trim(), first = cls.split(/\s+/)[0], text = (el.firstChild?.nodeType === 3 ? el.firstChild.textContent : '').trim().slice(0, 30);
    const q = [cls && `class="${cls}"`, cls && `className="${cls}"`, first && `class="${first}`, first && first.length > 2 && first, text && text.length > 3 && text, `<${el.tagName.toLowerCase()}`].filter(Boolean);
    const r = await api(`source?file=${encodeURIComponent(component.file)}&${q.map((x) => 'q=' + encodeURIComponent(x)).join('&')}`).catch(() => null);
    if (r?.file) component.file = r.file;
    if (r?.line) component.line = r.line;
  }
  const e = { path: deepPath(el), tag: s.tag, name: s.name, text: s.text, classes: el.getAttribute('class') || '', facts: factLine(clean(() => facts(el))), selectors,
    sources: sources.filter((x) => x.file), component, state: pageState() };
  const sr = el.getRootNode();
  if (sr instanceof ShadowRoot) {
    Object.assign(e, { shadowHost: sr.host.tagName.toLowerCase(), shadowMode: sr.mode });
    // where its definition can't be found, at least where the host is written
    if (!component?.file) { const hc = await componentOf(sr.host); if (hc?.file) e.component = hc; }
  }
  if (t.kind === 'pseudo') await pseudoInfo(e, el, t.pseudo);
  if (t.kind === 'three') {
    const d = await info3(t);
    Object.assign(e, { name: d.name, three: d.three, part: d.part, facts: d.facts, selectors: [], sources: [] });
    if (d.component) e.component = d.component;
  }
  if (t.kind === 'word') Object.assign(e, { word: t.word, part: `the word “${t.word.text}” (in “…${t.word.before}${t.word.text}${t.word.after}…”)` });
  if (frozen() && !isQuiet()) e.frozen = true;
  e.viewport = { w: innerWidth, h: innerHeight, ...(/^unide-size:/.test(window.name || '') ? { size: window.name.slice(11) } : {}) }; // the user's own Freeze, not the hold every ⌥-click makes
  return e;
}
// a ::before or ::after: its own look, and the rules that draw it
async function pseudoInfo(e, el, pseudo) {
  const cs = getComputedStyle(el, pseudo), bare = pseudo.slice(2), list = allRules(el.getRootNode() instanceof ShadowRoot ? el.getRootNode() : document), rules = {};
  for (const r of list) for (const part of splitList(r.selectorText)) {
    const m = part.match(new RegExp(`^(.*?)::?${bare}$`));
    if (!m || TRANSIENT.test(part)) continue;
    try { if (el.matches(m[1] || '*')) rules[part] = r; } catch { /* odd selector */ }
  }
  let sels = Object.keys(rules).sort((a, b) => specificity(b) - specificity(a));
  const reset = (q) => /^(\*|:where\(.*\)|:root|html|body)?::?(before|after)$/i.test(q.trim());
  if (sels.some((q) => !reset(q))) sels = sels.filter((q) => !reset(q));
  sels = sels.slice(0, 3);
  e.selectors = sels;
  e.sources = (await Promise.all(sels.map((q) => ruleSource(rules[q], q).then((src) => ({ selector: q, ...(src || {}) }))))).filter((x) => x.file);
  e.pseudo = pseudo;
  e.part = `its ${pseudo} pseudo-element (content: ${cs.content})`;
  e.facts = `${pseudo}: content ${cs.content}; colour ${cs.color}; ${cs.fontSize}${cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? `; background ${cs.backgroundColor}` : ''}${cs.padding !== '0px' ? `; padding ${cs.padding}` : ''}; on an element that is ${e.facts}`;
}
// a path through shadow roots too: host path >>> path inside its root
function deepPath(el) {
  const segs = [];
  for (let e = el; e; ) {
    segs.unshift(pathOf(e));
    const r = e.getRootNode();
    e = r instanceof ShadowRoot ? r.host : null;
  }
  return segs.join(' >>> ');
}
function query(path) {
  let scope = document, el = null;
  for (const seg of path.split(' >>> ')) {
    if (!scope) return null;
    el = scope.querySelector(seg);
    scope = el && shadowOf(el);
  }
  return el;
}
// a pinned word, found again inside its element by the words around it
function wordRange(el, w) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let best = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent;
    for (let i = text.indexOf(w.text); i >= 0; i = text.indexOf(w.text, i + 1)) {
      const score = (text.slice(0, i).endsWith(w.before) ? 2 : 0) + (text.slice(i + w.text.length).startsWith(w.after) ? 1 : 0);
      if (!best || score > best.score) best = { n, i, score };
    }
  }
  if (!best) return null;
  const r = document.createRange();
  r.setStart(best.n, best.i); r.setEnd(best.n, best.i + w.text.length);
  return r;
}
const ZERO = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
const targetRect = (e, el) => { if (e.three) return liveRect3(el, e.three) || ZERO; const r = e.word && wordRange(el, e.word); return (r || el).getBoundingClientRect(); };
// the same thing as what's under the pointer: the same element, and for a 3D canvas the same object in it
const sameAs = (e, t) => (e.three || t.kind === 'three' ? !!e.three && t.kind === 'three' && resolve3(t.el, e.three.path) === t.object && (e.three.instanceId ?? null) === t.instanceId : true);
// the element again after the page re-rendered: by its path if it still looks the same, else by its tag and text
function find(e) {
  let el = null;
  try { el = query(e.path); } catch { /* bad path */ }
  const same = (x) => x && x.tagName.toLowerCase() === e.tag.split('.')[0] && (!e.text || (x.textContent || '').replace(/\s+/g, ' ').trim().startsWith(e.text.replace(/…$/, '').slice(0, 30)));
  if (same(el)) return el;
  const tag = e.tag.split('.')[0];
  if (!/^[a-z][a-z0-9-]*$/.test(tag) || e.path.includes(' >>> ')) return el;
  return [...document.getElementsByTagName(tag)].find(same) || el;
}

export async function load() {
  P.path = location.pathname;
  try { P.pins = await api('pins?page=' + encodeURIComponent(P.path)); } catch { P.pins = []; }
  P.variant ||= {};
  showVariants();
  draw(); render();
}
async function save(p) {
  const r = await api('pins', p);
  if (r.gone) return r;
  const i = P.pins.findIndex((x) => x.id === r.id);
  i >= 0 ? (P.pins[i] = r) : P.pins.push(r);
  return r;
}

// a click while pinning: a new pin, or (with Shift, or after "Add element") another element on the open pin.
// t is what was chosen under the pointer (Alt+click picks a lower layer, a word or a ::before) and the stack it's in.
export async function pinClick(el, add, t = { kind: 'element', el }) {
  const picture = shoot(el, rectOf(t), t.kind === 'three' ? outline3(t.el, t.object, t.instanceId, INK.pink, 3) : null).catch((err) => (console.warn('unide: screenshot', err), null)); // now, before anything moves
  const cur = P.pins.find((p) => p.id === P.open), e = await info(el, t);
  e.k = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  if (t.stack?.length > 1) e.layer = { index: t.i + 1, count: t.stack.length, above: above(t.stack, t.i) };
  let p;
  if (add && cur && cur.status === 'draft') {
    if (cur.elements.some((x) => x.path === e.path && !x.word && !x.pseudo && !e.word && !e.pseudo && (!x.three && !e.three || x.three && e.three && x.three.path.idx.join() === e.three.path.idx.join() && x.three.instanceId === e.three.instanceId))) return;
    cur.elements.push(e); p = await save(cur);
  } else {
    p = await save({ page: location.pathname, note: '', status: 'draft', elements: [e] });
    P.open = p.id;
  }
  if (t.stack) layersOf.set(e.k, t);
  draw(); render();
  P.focusNote = true; draw();
  attachShot(p.id, e.k, await picture);
}
// the screenshot goes next to the pins (.unide/shots/), and the pin keeps its path
async function attachShot(id, k, data) {
  if (!data) return;
  const n = P.pins.find((x) => x.id === id)?.elements.findIndex((x) => x.k === k);
  const { file } = await api('shot', { name: `${id}-${n + 1}-${k}`, data }).catch(() => ({}));
  const pin = P.pins.find((x) => x.id === id), el = pin?.elements.find((x) => x.k === k);
  if (!file || !el) return;
  el.shot = file;
  await save(pin);
  draw();
}
// the layers under the pointer of elements pinned on this visit, so the card can switch between them
const layersOf = new Map();
async function setLayer(k, i) {
  let t0 = layersOf.get(k), pin = P.pins.find((p) => p.elements.some((x) => x.k === k));
  if (!t0 || !pin || pin.status !== 'draft' || !t0.stack[i]) return;
  const t = { ...t0.stack[i], stack: t0.stack, i, x: t0.x, y: t0.y };
  layersOf.set(k, t); // the card shows the choice at once; the details follow
  draw();
  const picture = shoot(t.el, rectOf(t), t.kind === 'three' ? outline3(t.el, t.object, t.instanceId, INK.pink, 3) : null).catch(() => null);
  const e = await info(t.el, t);
  if (layersOf.get(k) !== t) return; // chose again meanwhile
  e.k = k; e.layer = { index: i + 1, count: t.stack.length, above: above(t.stack, i) };
  const cur = P.pins.find((p) => p.id === pin.id), idx = cur?.elements.findIndex((x) => x.k === k);
  if (!cur || idx < 0) return;
  cur.elements[idx] = e;
  pin = cur;
  await save(pin);
  draw();
  const data = await picture;
  if (layersOf.get(k) === t) attachShot(pin.id, k, data);
}
// Alt+click again on the same spot: the next layer down for the element just pinned there
export function nextLayer(x, y) {
  const pin = P.pins.find((p) => p.id === P.open), e = pin?.elements.at(-1), t = e && layersOf.get(e.k);
  if (!t || pin.status !== 'draft') return false;
  // anywhere on what the first click hit counts as "the same spot" (a hand never clicks the same pixel twice)
  const r = t.stack[0]?.el?.getBoundingClientRect(), pad = 4;
  // in a 3D canvas "the same spot" is the same object, not anywhere on the canvas
  const on = e.three ? topIs(t.stack[0].el, e.three, x, y) : r ? x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad : Math.hypot(t.x - x, t.y - y) <= 6;
  if (!on) return false;
  setLayer(e.k, (t.i + 1) % t.stack.length);
  return true;
}
// the pin (and which of its elements) sitting on an element: the innermost pinned thing that holds it
export function pinnedAt(target) {
  let best = null;
  for (const p of shown()) p.elements.forEach((e, idx) => {
    const el = find(e);
    if (!el || !(el === target || el.contains(target))) return;
    // a 3D object: only when it's the one under the pointer
    const pt = window.__unideEarly?.pointer;
    if (e.three && !(pt && topIs(el, e.three, pt.x, pt.y))) return;
    const r = targetRect(e, el), area = r.width * r.height;
    if (!best || area < best.area) best = { pin: p, idx, area, el, rect: e.three ? r : null };
  });
  return best;
}
// ⌘-click a pinned element (or its badge): unpin it. A pin with several elements loses just that one.
export async function unpin(pin, idx = null) {
  if (idx != null && pin.elements.length > 1) {
    pin.elements.splice(idx, 1);
    await save(pin);
    flash(`Took that element off #${pin.id}.`);
  } else {
    await api('pins/delete', { id: pin.id });
    P.pins = P.pins.filter((p) => p.id !== pin.id);
    if (P.open === pin.id) P.open = null;
    flash(`Unpinned #${pin.id}.`);
  }
  draw(); render();
}

// ---------- ⌥-click: pin what's under the pointer, no mode, no button ----------
// The page is held still from the moment the button goes down until the note is done (Return), so whatever was
// open (a hover menu, a dropdown, a toast) stays as it was. A Freeze you turned on yourself is left alone.
let hold = false, pinning = 0;
function startHold() { if (!frozen()) { freeze({ quiet: true }); hold = true; } }
function endHold() { if (hold && !pinning && !openDraft() && !S.picking) { hold = false; if (isQuiet()) unfreeze(); } }
const openDraft = () => P.pins.find((p) => p.id === P.open && p.status === 'draft');
export async function optPin(e) {
  const x = e.clientX, y = e.clientY;
  // Copy look: this ⌥-click picks the element whose look the pinned one takes
  if (P.lookFor) {
    const pin = openDraft(), pe = pin?.elements.find((x2) => x2.k === P.lookFor), top = stackAt(x, y).find((t) => t.kind === 'element')?.el;
    P.lookFor = null;
    if (pe && top && ed.copyLook(pe, find(pe), top)) await editCommit(pin, true); else draw();
    return;
  }
  // ⌥-click again on the same spot: one layer deeper (a word, a ::before, what an overlay covers)
  if (!e.shiftKey && nextLayer(x, y)) return;
  const top = e.composedPath()[0] instanceof Element ? e.composedPath()[0] : e.target;
  const stack = stackAt(x, y), t = stack[0] ? { ...stack[0], stack, i: 0, x, y } : { kind: 'element', el: top };
  if (!e.shiftKey && t.el) {
    const pin = P.pins.find((p) => p.status === 'draft' && p.elements.some((x2) => find(x2) === t.el && sameAs(x2, t)));
    if (pin) {
      const k = pin.elements.find((x2) => find(x2) === t.el && sameAs(x2, t)).k;
      P.open = pin.id;
      // which layer it's on now, so "again" moves to the next one
      const cur = layersOf.get(k), i = cur ? cur.i : 0;
      layersOf.set(k, { ...stack[i] || t, stack, i, x, y });
      if (stack.length > 1) await setLayer(k, (i + 1) % stack.length); else draw();
      P.focusNote = true; draw();
      endHold();
      return;
    }
  }
  pinning++;
  try { await pinClick(t.el || top, e.shiftKey, t); } finally { pinning--; endHold(); }
}
// the note's keys: Return is done, ⇧ Return a new line, Esc throws away an empty pin, ⌘ Return sends everything
function noteKeys(e) {
  const ta = e.composedPath()[0];
  if (ta?.dataset?.in !== 'pinnote') return;
  const p = openDraft();
  if (!p) return;
  const sendKey = isMac ? e.metaKey : e.ctrlKey;
  if (e.key === 'Enter' && (sendKey || !e.shiftKey)) {
    e.preventDefault();
    clearTimeout(noteTimer); // this save replaces the pending one
    p.note = ta.value;
    save(p).then(() => (sendKey ? sendAll() : null));
    P.open = null; draw();
  } else if (e.key === 'Escape') {
    e.preventDefault(); e.stopPropagation();
    if (!ta.value.trim()) actions.pindel(); else { P.open = null; draw(); }
  }
}

export async function sendAll() {
  clearTimeout(noteTimer);
  const open = openDraft();
  if (open) await save(open); // the note as typed so far goes too
  if (!drafts().length) return;
  const n = (await api('pins/send', { page: location.pathname })).sent;
  P.open = null;
  await load();
  flash(`Sent ${n} pin${n === 1 ? '' : 's'}. Your agent gets them through unide; tell it to go ahead.`);
}
// the Tools panel's request goes to the agent as one pin
export async function sendDetail(title, detail) {
  await save({ page: location.pathname, note: title, status: 'draft', elements: [], detail });
  await api('pins/send', { page: location.pathname });
  await load();
  flash('Sent to your agent.');
}
function flash(msg) { P.toast = msg; draw(); clearTimeout(flash.t); flash.t = setTimeout(() => { P.toast = ''; draw(); }, 7000); }

// ---------- on the page: a numbered badge on each pinned element, the open pin's card, the list ----------
const layer = document.createElement('div');
layer.className = 'pins';
let noteTimer;
export function draw() {
  if (!layer.isConnected) root.append(layer);
  if (!openDraft()) { P.shape = P.lookFor = P.side = null; ed.closeEditor(); fonts.preview(null); icons.preview(null); if (P.showState) { P.showState = null; unforce(); } }
  const open = P.pins.find((p) => p.id === P.open);
  const card = open ? `<div class="pop" data-pin="${open.id}">
      <div class="row"><span class="badge s-${open.status}">${open.id}</span><b class="grow">${open.elements.length ? open.elements.map((e) => esc(e.name)).join(', ') : 'From Tools'}</b>${act('pinclose', '×', 'x')}</div>
      <div class="small">${esc(LABEL[open.status])}${open.elements.some((e) => !find(e)) ? ' · <span class="warn">not on this version of the page</span>' : ''}</div>
      ${open.elements.filter((e) => e.component).slice(0, 3).map((e) => `<div class="small">in <code>${esc(e.component.name ? (e.component.name.startsWith('<') ? e.component.name : `<${e.component.name}>`) : e.component.framework)}</code>${e.component.file ? ` · ${esc(e.component.file)}${e.component.line ? `:${e.component.line}` : ''}` : ''}</div>`).join('')}
      ${open.elements.map((e) => layerRow(e, open.status === 'draft')).join('')}
      ${open.status === 'draft' ? open.elements.map(optionRow).join('') : ''}
      ${open.status === 'draft' ? open.elements.map((e) => ed.editRow(e, find(e), open.elements.length > 1, P)).join('') : open.elements.some((e) => e.edits) ? `<div class="small changed">On the page: ${esc(open.elements.flatMap((e) => ed.editWords(e.edits)).join(' · '))}</div>` : ''}
      ${open.elements.some((e) => e.shot) ? `<div class="shots">${open.elements.filter((e) => e.shot).map((e) => `<img src="/__unide/shot-file?name=${encodeURIComponent(e.shot.split('/').pop())}" alt="What the agent sees">`).join('')}</div>` : ''}
      ${open.status === 'draft' ? `<textarea data-in="pinnote" placeholder="What should change? e.g. too loud next to the cream">${esc(open.note)}</textarea>
        <div class="row" style="margin-top:8px">${act('pinadd', '+ Add element', 'mini')}${act('pinopts', open.options ? '3 options ✓' : '3 options', `mini ${open.options ? 'on' : ''}`)}${act('pindel', 'Delete', 'mini')}<span class="grow"></span>${act('pindone', 'Done', 'mini primary')}</div>
        ${open.options ? '<div class="small">The agent will build three versions; you flip between them here and keep one.</div>' : ''}
        <div class="small" style="margin-top:6px"><b>Return</b> done · <b>${isMac ? '⌥⇧' : 'Alt+Shift+'}-click</b> adds another element · <b>${optClick} again</b> goes a layer deeper · <b>Esc</b> on an empty note throws it away · <b>${isMac ? '⌘' : 'Ctrl+'}Return</b> sends</div>`
      : `${open.note ? `<div class="said">“${esc(open.note)}”</div>` : ''}${open.reply ? `<div class="reply s-${open.status}"><b>Agent:</b> ${esc(open.reply)}</div>` : ''}
        ${open.status === 'options' ? optionsChooser(open) : ''}
        <div class="row" style="margin-top:8px">${!['sent', 'options'].includes(open.status) ? act('pindismiss', 'Dismiss', 'mini') : ''}${act('pinagain', 'New pin here', 'mini')}</div>`}
    </div>` : '';
  const hold = P.list && P.listHold;
  const optOn = window.__unideEarly?.optOn?.() !== false;
  const list = P.list ? `<div class="plist"${hold ? ` style="top:${hold.top}px;bottom:auto;max-height:${hold.height}px"` : ''}><div class="row"><b class="grow">Pins on this page</b>${act('optclick', `${optClick} pins: ${optOn ? 'on' : 'off'}`, `mini ${optOn ? 'on' : ''}`)}${act('pinlist', '×', 'x')}</div>
      ${shown().length ? shown().map((p) => `<div class="pitem"><button class="pmain" data-act="pinopen" data-arg="${p.id}"><span class="badge s-${p.status}">${p.id}</span><span class="grow"><span>${esc(p.note || (p.elements.length ? p.elements.map((e) => e.name).join(', ') : 'From Tools'))}</span>
        <span class="small">${esc(LABEL[p.status])}${p.reply ? ` — ${esc(p.reply)}` : ''}</span></span></button><button class="x" data-act="pinx" data-arg="${p.id}" title="Remove this pin">×</button></div>`).join('') : `<div class="small">No pins yet. <b>${optClick}</b> anything on the page to pin it.</div>`}</div>` : '';
  // redrawing must not take the note away from someone typing in it: keep focus, text and caret
  const ta0 = root.activeElement?.matches?.('.pop textarea') ? root.activeElement : null;
  const keep = ta0 && { value: ta0.value, a: ta0.selectionStart, b: ta0.selectionEnd, pin: +ta0.closest('.pop').dataset.pin };
  // one side panel beside the card (place() puts it there): Style (colour, font, copy look), Image or Icon
  const sp = P.side, se = open?.status === 'draft' && sp && open.elements.find((x) => x.k === sp.k), sel2 = se && find(se);
  let side = '';
  if (se && sel2) {
    const style = ['colour', 'text', 'font', 'states', 'look'].includes(sp.kind), hasText = !!(sel2.innerText || '').trim();
    const tabs = style ? `<div class="row wrap">${[['colour', 'Colour'], ...(hasText ? [['text', 'Text'], ['font', 'Font']] : []), ['states', 'States'], ['look', 'Copy look']].map(([t, l]) => `<button class="mini ${sp.kind === t ? 'on' : ''}" data-act="sidetab" data-arg="${t}">${l}</button>`).join('')}</div>` : '';
    const body = sp.kind === 'colour' ? wheel.colourPanel(se, sel2, P.colourProp, (p) => nowRgb(sel2, p)) : sp.kind === 'text' ? type.typePanel(se, sel2) : sp.kind === 'font' ? fonts.fontPanel(se, P.fontGroup, se.edits?.font?.to)
      : sp.kind === 'look' ? lookBody(se) : sp.kind === 'states' ? statesBody(se, sel2) : sp.kind === 'image' ? images.imagePanel(se, sel2) : icons.iconPanel(se, sel2);
    side = `<div class="spanel side"><div class="row"><b class="grow">${style ? 'Style' : sp.kind === 'image' ? 'Image' : 'Icon'} for ${esc(se.name)}</b>${act('editside', '×', 'x')}</div>${tabs}${body}</div>`;
  }
  layer.innerHTML = `<div class="marks"></div>${card}${side}${list}${compare.tray()}${P.compare ? compare.view(P.compare) : ''}${P.toast ? `<div class="toast">${esc(P.toast)}</div>` : ''}`;
  if (se && sel2 && sp.kind === 'colour') wheel.paint(colourBox(), nowRgb(sel2, colourBox()?.dataset.prop) || [128, 128, 128]);
  if (hold) layer.querySelector('.plist').scrollTop = hold.scroll;
  const ta = layer.querySelector('.pop textarea');
  if (ta && keep && keep.pin === P.open) { ta.value = keep.value; ta.focus(); ta.setSelectionRange(keep.a, keep.b); }
  else if (ta && P.focusNote) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  if (ta) P.focusNote = false;
  endHold();
  const n = drafts().length, sendBtn = $('[data-act="pinsend"]'), listBtn = $('[data-act="pinlist"].bar-pins');
  if (sendBtn) { sendBtn.disabled = !n; sendBtn.textContent = n ? `Send ${n}` : 'Send'; }
  if (listBtn) listBtn.textContent = `Pins ${shown().length}`;
  const dot = $('.bar .dotn');
  if (dot) { dot.textContent = shown().length; dot.classList.toggle('has', n > 0); dot.title = n ? `${n} not sent yet` : ''; }
  expand('pin', !!P.open || !!P.list);
  place();
}
// once the pointer leaves the list, it settles back above the bar
function watchListHold() {
  if (watchListHold.on) return;
  watchListHold.on = true;
  (function tick() {
    const l = layer.querySelector('.plist'), pt = window.__unideEarly?.pointer;
    if (!P.listHold || !l) { P.listHold = null; watchListHold.on = false; return; }
    const r = l.getBoundingClientRect();
    if (pt && (pt.x < r.left - 4 || pt.x > r.right + 4 || pt.y < r.top - 4 || pt.y > r.bottom + 4)) { P.listHold = null; watchListHold.on = false; draw(); return; }
    requestAnimationFrame(tick);
  })();
}
// ⌘Z: the last change by hand on the open pin; typing in a field keeps its own undo
function undoKey(ev, pin, page = false) {
  if (!((isMac ? ev.metaKey : ev.ctrlKey) && !ev.shiftKey && !ev.altKey && ev.key.toLowerCase() === 'z')) return;
  const t = ev.composedPath()[0];
  if (/^(TEXTAREA|INPUT|SELECT)$/.test(t?.tagName) || t?.isContentEditable) { if (page || t.value) return; }
  if ([...pin.elements].reverse().some((x) => ed.undo(x))) { ev.preventDefault(); ev.stopImmediatePropagation(); editCommit(pin, true); }
}
// Style's States tab: see it hovered, pressed, focused or disabled without doing it, and change it for that state
const CAN_DISABLE = /^(BUTTON|INPUT|SELECT|TEXTAREA|FIELDSET|OPTION)$/;
function statesBody(e, el) {
  const at = e.edits?.at || 'normal', showing = P.showState?.k === e.k ? P.showState.state : at;
  const list = [['normal', 'Normal'], ['hover', 'Hover'], ['pressed', 'Pressed'], ['focus', 'Focus'], ...(CAN_DISABLE.test(el.tagName) ? [['disabled', 'Disabled']] : [])];
  return `<div class="small">Show it as</div>
    <div class="row wrap">${list.map(([s, l]) => `<button class="mini ${showing === s ? 'on' : ''}" data-act="stateshow" data-arg="${e.k}|${s}">${l}</button>`).join('')}</div>
    <div class="small">${at === 'normal' ? 'Changes you make apply to it as it normally is.' : `Changes you make (colour, text, shape…) apply to its <b>${at}</b> state only.`}</div>
    ${e.edits && Object.keys(e.edits).some((x) => x !== 'at') && showing !== at ? '<div class="small warn">Its changes are kept for one state at a time: switching moves them to this one.</div>' : ''}`;
}
// Style's last tab: give it another element's look
function lookBody(e) {
  const L = e.edits?.look, on = P.lookFor === e.k;
  return `<div class="small">Give it another element's look: its colours, border, corners, type, padding and shadow.</div>
    <div class="row">${act('editlook', on ? 'Picking… (Esc)' : 'Pick the element', `mini ${on ? 'on' : ''}`).replace('data-act="editlook"', `data-act="editlook" data-arg="${e.k}"`)}</div>
    ${on ? `<div class="small">${optClick} the one whose look you want</div>` : ''}
    ${L ? `<div class="small changed">the look of ${esc(L.from.name)}${L.from.text ? ` “${esc(L.from.text)}”` : ''}: ${L.diffs.length} changes · <button class="link" data-act="editlookreset" data-arg="${e.k}">put it back</button></div>` : ''}`;
}
// a colour as the element shows it now (with changes by hand)
const nowRgb = (el, p) => parse(getComputedStyle(el).getPropertyValue(p));
const colourBox = () => layer.querySelector('.cwheel');
// set one of its colours: shown at once; saved when it's done (a drag saves on letting go)
function setColour(k, p, rgb, final) {
  const [pin, e] = editTarget(k), el = e && find(e);
  if (!el || !rgb || !p) return;
  if (!colourDrag?.snapped) { ed.snapshot(e); if (colourDrag) colourDrag.snapped = true; }
  e.edits ||= {}; e.edits.colour ||= {};
  const was = e.edits.colour[p], from = was?.from ?? hex(parse(ed.original(el, p)) || [0, 0, 0]), to = hex(rgb);
  if (from === to) delete e.edits.colour[p];
  else e.edits.colour[p] = { from, to, words: words(rgb), token: wheel.nearestToken(rgb), read: wheel.readability(el, p, rgb) };
  if (!Object.keys(e.edits.colour).length) delete e.edits.colour;
  ed.tidyEdits(e);
  const box = colourBox();
  if (box && !final) wheel.paint(box, rgb, false);
  editCommit(pin, final);
}
let colourDrag = null;
// options the agent built (data-unide-variant="<pin>-A"…): one shows at a time; flip, then keep one
const variantsOf = (id) => [...new Set([...document.querySelectorAll(`[data-unide-variant^="${id}-"]`)].map((el) => el.getAttribute('data-unide-variant').slice(String(id).length + 1)))].sort();
const variantSheet = Object.assign(document.createElement('style'), { id: 'unide-variants' });
function showVariants() {
  if (!variantSheet.isConnected) document.documentElement.append(variantSheet);
  variantSheet.textContent = P.pins.filter((p) => p.status === 'options').map((p) => { const v = P.variant[p.id] || variantsOf(p.id)[0] || 'A'; return `[data-unide-variant^="${p.id}-"]:not([data-unide-variant="${p.id}-${v}"]){display:none !important}`; }).join('\n');
}
function optionsChooser(p) {
  const vs = variantsOf(p.id), cur = P.variant[p.id] || vs[0];
  if (!vs.length) return '<div class="small warn">The agent says the options are ready, but none are marked on this page yet (it may still be reloading).</div>';
  return `<div class="small">Options</div><div class="row wrap">${vs.map((v) => `<button class="mini ${v === cur ? 'on' : ''}" data-act="pinvariant" data-arg="${p.id}|${v}">${v}</button>`).join('')}<span class="grow"></span>${act('pinkeep', `Keep ${cur}`, 'mini primary').replace('data-act="pinkeep"', `data-act="pinkeep" data-arg="${p.id}|${cur}"`)}</div>`;
}
// the draft pin holding element k, and that element
function editTarget(k) {
  const pin = P.pins.find((p) => p.status === 'draft' && p.elements.some((x) => x.k === k));
  return [pin, pin?.elements.find((x) => x.k === k)];
}
// a change by hand: shown at once; saved (and the card redrawn) when it's done, not on every pixel of a drag
async function editCommit(pin, final) {
  ed.applyEdits(shown().flatMap((p) => p.elements.filter((e) => e.edits).map((e) => ({ e, el: find(e) }))));
  if (!final || !pin) return;
  await save(pin);
  draw();
}
const act = (name, label, cls = '') => `<button data-act="${name}" class="${cls}">${label}</button>`;
// a native dropdown's list is drawn by the system, outside the page, so it can't be clicked into: pick the option here
function optionRow(e) {
  const el = find(e);
  if (el?.tagName !== 'SELECT' || !el.options.length) return '';
  return `<div class="layers"><div class="small">Mean one option? Its list is drawn by ${isMac ? 'macOS' : 'the system'}, outside the page, so pick it here:</div>
    ${[...el.options].slice(0, 30).map((o, i) => `<button class="layer ${e.option?.index === i ? 'cur' : ''}" data-act="pinoption" data-arg="${e.k}|${i}">${esc(o.text || o.value || `option ${i + 1}`)}</button>`).join('')}</div>`;
}
// which layer under the pointer this element is, and the others to switch to
function layerRow(e, draft) {
  const t = draft && layersOf.get(e.k), what = e.part ? esc(e.part.replace(/ \(in “.*$/, '')) : null;
  if (!t || t.stack.length < 2) return what ? `<div class="small">Pinned: ${what}</div>` : (e.layer ? `<div class="small">Layer ${e.layer.index} of ${e.layer.count} under the pointer</div>` : '');
  return `<div class="layers"><div class="small">Layer ${t.i + 1} of ${t.stack.length} under the pointer · ${optClick} again for the next, or pick:</div>
    ${t.stack.map((x, i) => `<button class="layer ${i === t.i ? 'cur' : ''}" data-act="pinlayer" data-arg="${e.k}|${i}" title="${esc(label(x))}">${i + 1} · ${esc(label(x))}</button>`).join('')}</div>`;
}

// keep badges on their elements, and the open card next to its first element
// ---------- focus while you write a pin: the rest of the page goes quiet, the pinned element keeps its colour ----------
// Four strips around it (not a black-out: you still see what it sits next to), and the other badges fade.
const spot = Object.assign(document.createElement('div'), { className: 'spot', innerHTML: '<i></i><i></i><i></i><i></i>' });
function focusOn() {
  const op = P.pins.find((p) => p.id === P.open && p.status === 'draft');
  const rs = op ? op.elements.map((e) => { const el = find(e); return el ? targetRect(e, el) : null; }).filter((r) => r && (r.width || r.height)) : [];
  if (!spot.isConnected) root.prepend(spot);
  layer.classList.toggle('focus', !!rs.length);
  if (!rs.length) return void spot.classList.remove('on');
  const pad = 6, l = Math.min(...rs.map((r) => r.left)) - pad, t = Math.min(...rs.map((r) => r.top)) - pad;
  const r = Math.max(...rs.map((x) => x.right)) + pad, b = Math.max(...rs.map((x) => x.bottom)) + pad;
  const [top, bottom, left, right] = spot.children;
  Object.assign(top.style, { left: 0, top: 0, width: '100vw', height: Math.max(0, t) + 'px' });
  Object.assign(bottom.style, { left: 0, top: b + 'px', width: '100vw', height: `calc(100vh - ${b}px)` });
  Object.assign(left.style, { left: 0, top: t + 'px', width: Math.max(0, l) + 'px', height: b - t + 'px' });
  Object.assign(right.style, { left: r + 'px', top: t + 'px', width: `calc(100vw - ${r}px)`, height: b - t + 'px' });
  spot.classList.add('on');
}
addEventListener('scroll', () => { if (spot.classList.contains('on')) focusOn(); }, { capture: true, passive: true });
addEventListener('resize', () => focusOn());

function place() {
  focusOn();
  // changes made by hand on pinned elements, shown on the page; the open one's handles
  ed.applyEdits(shown().flatMap((p) => p.elements.filter((e) => e.edits).map((e) => ({ e, el: find(e) }))));
  const op = P.pins.find((p) => p.id === P.open && p.status === 'draft'), oe = op && (op.elements.find((e) => e.k === P.shape) || op.elements.find((e) => e.edits?.move));
  ed.showHandles(oe, oe && find(oe), !!oe && P.shape === oe.k, (final) => editCommit(op, final));
  const marks = layer.querySelector('.marks');
  const want = shown().flatMap((p) => p.elements.map((e, i) => ({ p, e, i })));
  while (marks.children.length < want.length) marks.append(Object.assign(document.createElement('button'), { className: 'mark' }));
  [...marks.children].forEach((m, k) => {
    const w = want[k], el = w && find(w.e);
    if (!w || !el) return void (m.style.display = 'none');
    const r = targetRect(w.e, el);
    if (!r.width && !r.height) return void (m.style.display = 'none'); // not shown at this size or state
    // while pinning, clicks go through badges to the page (a badge sits on a small target's corner)
    // a 3D object's badge sits where you clicked on it (its box on screen is loose); anything else's on its corner
    const tiny = r.width < 44 || r.height < 30; // a small target keeps its badge outside, so you still see it
    const at = w.e.three && spot3(el, w.e.three), bx = at ? at.x - 9 : tiny ? r.left - 25 : r.left - 9, by = at ? at.y - 9 : tiny ? r.top - 14 : r.top - 9;
    m.style.cssText = `display:block;left:${Math.max(2, bx)}px;top:${Math.max(2, by)}px${S.picking ? ';pointer-events:none;opacity:.6' : ''}`;
    m.className = `mark s-${w.p.status}${w.p.id === P.open ? ' cur' : ''}`;
    m.textContent = w.p.elements.length > 1 ? `${w.p.id}.${w.i + 1}` : w.p.id;
    m.dataset.act = 'pinopen'; m.dataset.arg = w.p.id;
  });
  const pop = layer.querySelector('.pop'), open = P.pins.find((p) => p.id === P.open), el = open?.elements[0] && find(open.elements[0]);
  // the open pin's 3D object, outlined (badges and boxes can't show which object in a crowded scene)
  const e3 = open?.elements.find((x) => x.three), c3 = e3 && find(e3);
  showOutline(root, 'pin', c3 ? targetOf3(c3, e3.three) : null, INK.pink);
  if (pop) {
    // keep clear of the whole element as well as the part pinned in it (a word, a ::before)
    const t = el ? targetRect(open.elements[0], el) : null, b = open.elements[0].three ? null : el?.getBoundingClientRect(); // a 3D object: clear of it, not of the whole canvas
    const r = t && b ? { left: Math.min(t.left, b.left), right: Math.max(t.right, b.right), top: Math.min(t.top, b.top), bottom: Math.max(t.bottom, b.bottom) }
      : t || { left: innerWidth / 2 - 150, right: innerWidth / 2 + 150, top: 60, bottom: 80 };
    const h = pop.offsetHeight, room = innerHeight - 70;
    // below it, else above it, else beside it: never on top of what you pinned
    let left = Math.min(innerWidth - 320, Math.max(8, r.left)), top = r.bottom + 10;
    if (top + h > room) top = r.top - h - 10;
    if (top < 8) { top = Math.min(room - h, Math.max(8, r.top)); left = r.right + 330 < innerWidth ? r.right + 12 : Math.max(8, r.left - 322); }
    pop.style.left = left + 'px'; pop.style.top = Math.max(8, top) + 'px';
    // the font panel: beside the card, on the side with room
    const fp = layer.querySelector('.side');
    if (fp) {
      // the side with more room; it narrows (to 240px) before it would cover the card
      const pr = pop.getBoundingClientRect(), fh = fp.offsetHeight, right = innerWidth - 8 - pr.right - 10, left = pr.left - 10 - 8;
      const w = Math.max(240, Math.min(300, Math.max(right, left)));
      fp.style.width = w + 'px';
      // a side that fits and stays off what you pinned; else one that fits; else the window's edge
      let y = Math.max(8, Math.min(pr.top, innerHeight - fh - 8));
      const clear = (x0, y0) => !t || x0 + w < t.left || x0 > t.right || y0 + fh < t.top || y0 > t.bottom;
      const sides = [right >= w && pr.right + 10, left >= w && pr.left - 10 - w].filter((x0) => x0 !== false);
      let x = sides.find((x0) => clear(x0, y));
      if (x === undefined) {
        // no side is clear of it: beside the card still, but below or above what you pinned
        x = sides[0] ?? Math.max(8, innerWidth - 8 - w);
        // the bigger space below or above it; the panel scrolls inside if it's taller than that
        const below = t ? innerHeight - 8 - (t.bottom + 10) : 0, above = t ? t.top - 18 : 0, room2 = Math.max(below, above);
        if (t && room2 >= 220) { fp.style.maxHeight = room2 + 'px'; y = below >= above ? t.bottom + 10 : Math.max(8, t.top - 10 - Math.min(fh, room2)); }
      } else fp.style.maxHeight = '';
      fp.style.left = x + 'px'; fp.style.top = y + 'px';
    }
  }
}
function loop() {
  if (P.path && P.path !== location.pathname) { P.open = null; load(); } // moved to another route without a reload
  if (layer.querySelector('.marks')) place();
  requestAnimationFrame(loop);
}

// ---------- controls ----------
Object.assign(actions, {
  pinmode: () => setPicking(S.picking === 'pin' ? null : 'pin'),
  pinsend: () => sendAll(),
  pinlist: () => { P.list = !P.list; draw(); },
  pinoption: async (arg) => {
    const [k, i] = arg.split('|'), pin = P.pins.find((p) => p.elements.some((x) => x.k === k));
    const e = pin?.elements.find((x) => x.k === k), o = e && find(e)?.options[+i];
    if (!o) return;
    if (e.option?.index === +i) { delete e.option; delete e.part; } // the same one again: the whole dropdown
    else {
      e.option = { index: +i, text: o.text, value: o.value };
      e.part = `the option “${o.text}”${o.value && o.value !== o.text ? ` (value “${o.value}”)` : ''} in this dropdown (its open list is drawn by the system, so the screenshot shows it closed)`;
    }
    await save(pin); draw();
  },
  pinx: (id) => {
    const p = P.pins.find((x) => x.id === +id), l = layer.querySelector('.plist');
    // the list keeps its top edge while the pointer is on it, so the next row slides up under the same ×
    if (l) { const r = l.getBoundingClientRect(); P.listHold = { top: r.top, height: r.height, scroll: l.scrollTop }; watchListHold(); }
    if (p) unpin(p);
  },
  pinopen: (id, _b, ev) => {
    if (ev && (isMac ? ev.metaKey : ev.ctrlKey)) { const p = P.pins.find((x) => x.id === +id); if (p) unpin(p); return; } // ⌘-click a badge: unpin
    P.open = +id; P.list = false; const p = P.pins.find((x) => x.id === +id), el = p?.elements[0] && find(p.elements[0]); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); draw(); },
  pinclose: () => { P.open = null; draw(); },
  // for apps that use ⌥-click themselves (code editors, design tools)
  optclick: () => { const on = window.__unideEarly?.optOn?.() !== false; try { localStorage.setItem('unide:optclick', on ? 'off' : 'on'); } catch { /* no storage */ } draw(); },
  // before and after for pins the agent finished (compare.js)
  cmpopen: async (id) => { const a = compare.done.find((x) => x.id === +id); if (!a) return; P.compare = { id: a.id, mode: 'wipe', cut: 50, after: undefined }; draw(); const shot = await compare.after(a, find); if (P.compare?.id === a.id) { P.compare.after = shot; draw(); } },
  cmpmode: (m) => { if (P.compare) { P.compare.mode = m; draw(); } },
  cmpclose: () => { P.compare = null; draw(); },
  cmpdismiss: (id) => { const a = compare.done.find((x) => x.id === +id); if (a) a.dismissed = true; if (P.compare?.id === +id) P.compare = null; draw(); },
  // options
  pinopts: async () => { const p = openDraft(); if (!p) return; p.options = p.options ? 0 : 3; await save(p); draw(); },
  pinvariant: (arg) => { const [id, v] = arg.split('|'); P.variant[id] = v; showVariants(); draw(); },
  pinkeep: async (arg) => { const [id, v] = arg.split('|'), p = P.pins.find((x) => x.id === +id); if (!p) return; await save({ id: p.id, chosen: v, status: 'sent' }); P.open = null; await load(); flash(`Sent: keep option ${v}. Your agent removes the others.`); },
  pinlayer: (arg) => { const [k, i] = arg.split('|'); setLayer(k, +i); },
  // changing it by hand (edits.js): each saves the pin and shows the change at once
  edittext: (k) => { const [pin, e] = editTarget(k), el = e && find(e); if (el) ed.editText(e, el, (changed) => (changed ? editCommit(pin, true) : draw())); },
  edithide: (k) => { const [pin, e] = editTarget(k); if (e) { ed.toggleHide(e); editCommit(pin, true); } },
  editshape: (k) => { P.shape = P.shape === k ? null : k; draw(); },
  editmove: (arg) => { const [k, d] = arg.split('|'), [pin, e] = editTarget(k), el = e && find(e); if (el && ed.move(e, el, +d)) editCommit(pin, true); },
  editlook: (k) => { P.lookFor = P.lookFor === k ? null : k; draw(); },
  // colours (wheel.js): a wheel, a slider, a hex field, the eyedropper, swatches
  // the side panel: Style (with its tabs), Image or Icon; the same button again, or its ×, closes it
  editside: (arg) => {
    fonts.preview(null); icons.preview(null);
    if (!arg) { P.side = null; return draw(); }
    const [k, which] = arg.split('|'), kind = which === 'style' ? P.lastStyle || 'colour' : which;
    const same = P.side?.k === k && (which === 'style' ? ['colour', 'text', 'font', 'states', 'look'].includes(P.side.kind) : P.side.kind === which);
    P.side = same ? null : { k, kind };
    if (kind === 'font') P.fontGroup ||= fonts.pageFonts().length ? 'page' : 'sans';
    draw();
  },
  sidetab: (t) => { if (!P.side) return; P.side.kind = P.lastStyle = t; if (t === 'font') P.fontGroup ||= fonts.pageFonts().length ? 'page' : 'sans'; fonts.preview(null); draw(); },
  // Style's Text tab (type.js)
  tset: (arg) => { const [k, prop, v] = arg.split('|'), [pin, e] = editTarget(k), el = e && find(e); if (!el) return; ed.snapshot(e); type.set(e, el, prop, v, ed.original); ed.tidyEdits(e); editCommit(pin, true); },
  treset: (k) => { const [pin, e] = editTarget(k); if (!e?.edits?.type) return; ed.snapshot(e); delete e.edits.type; ed.tidyEdits(e); editCommit(pin, true); },
  // States: show it in a state; what you change from then on is for that state
  stateshow: (arg) => {
    const [k, s] = arg.split('|'), [pin, e] = editTarget(k), el = e && find(e);
    if (!el) return;
    P.showState = { k, state: s };
    forceState(el, s);
    ed.snapshot(e); e.edits ||= {};
    if (s === 'normal') delete e.edits.at; else e.edits.at = s;
    ed.tidyEdits(e);
    editCommit(pin, true);
  },
  editlookreset: (k) => { const [pin, e] = editTarget(k); if (!e?.edits?.look) return; ed.snapshot(e); delete e.edits.look; ed.tidyEdits(e); editCommit(pin, true); },
  // images (images.js)
  ifit: (arg) => { const [k, f] = arg.split('|'), [pin, e] = editTarget(k), el = e && find(e); if (!el) return; ed.snapshot(e); images.setFit(e, el, f); ed.tidyEdits(e); editCommit(pin, true); },
  ifocus: (k, b, ev) => { const [pin, e] = editTarget(k), el = e && find(e); if (!el) return; const r = b.getBoundingClientRect(); ed.snapshot(e); images.setFocus(e, el, ((ev.clientX - r.left) / r.width) * 100, ((ev.clientY - r.top) / r.height) * 100); editCommit(pin, true); },
  ireset: (k) => { const [pin, e] = editTarget(k); if (!e?.edits?.image) return; ed.snapshot(e); delete e.edits.image; ed.tidyEdits(e); editCommit(pin, true); },
  // icons (icons.js)
  iconpick: (arg) => { const [k, n] = arg.split('|'), [pin, e] = editTarget(k), el = e && find(e); icons.preview(null); if (!el) return; ed.snapshot(e); if (icons.choose(e, el, n)) editCommit(pin, true); },
  iconreset: (k) => { const [pin, e] = editTarget(k); if (!e?.edits?.icon) return; ed.snapshot(e); delete e.edits.icon; ed.tidyEdits(e); editCommit(pin, true); },
  cprop: (arg) => { P.colourProp = arg.split('|')[1]; draw(); },
  cset: (arg) => { const [k, p, c] = arg.split('|'); setColour(k, p, parse(c), true); },
  creset: (arg) => { const [k, p] = arg.split('|'), [pin, e] = editTarget(k); if (!e?.edits?.colour?.[p]) return; ed.snapshot(e); delete e.edits.colour[p]; if (!Object.keys(e.edits.colour).length) delete e.edits.colour; ed.tidyEdits(e); editCommit(pin, true); },
  ceye: async (k) => { try { const r = await new window.EyeDropper().open(); setColour(k, P.colourProp || colourBox()?.dataset.prop, parse(r.sRGBHex), true); } catch { /* cancelled */ } },
  // trying typefaces (fonts.js): point to preview, click to keep
  fontgroup: (arg) => { const [, g] = arg.split('|'); P.fontGroup = g; draw(); },
  fontpick: (arg) => { const i = arg.indexOf('|'), k = arg.slice(0, i), name = arg.slice(i + 1), [pin, e] = editTarget(k), el = e && find(e); fonts.preview(null); if (el && fonts.choose(e, el, name)) editCommit(pin, true); else draw(); },
  editundo: (k) => { const [pin, e] = editTarget(k); if (e && ed.undo(e)) editCommit(pin, true); },
  editreset: (k) => { const [pin, e] = editTarget(k); if (e && ed.reset(e)) editCommit(pin, true); },
  pindone: () => { P.open = null; draw(); },
  pinadd: () => setPicking('pinadd'),
  pindel: async () => { await api('pins/delete', { id: P.open }); P.pins = P.pins.filter((p) => p.id !== P.open); P.open = null; draw(); render(); },
  pindismiss: async () => { const p = P.pins.find((x) => x.id === P.open); p.status = 'dismissed'; await save(p); P.open = null; draw(); },
  pinagain: async () => { const p = P.pins.find((x) => x.id === P.open); const els = p.elements.map(find).filter(Boolean); P.open = null; if (els[0]) { await pinClick(els[0], false); for (const e of els.slice(1)) await pinClick(e, true); } },
});
inputs.pinnote = (el) => {
  const p = P.pins.find((x) => x.id === P.open);
  if (!p) return;
  p.note = el.value;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => save(p), 400);
  const s = $('[data-act="pinsend"]'); if (s) s.disabled = !drafts().length;
};

// ---------- live: the page reloads when the agent changes a file; answers appear when it resolves a pin ----------
const ASSET = /\.(html?|css|js|mjs|svg|png|jpe?g|gif|webp|woff2?|json)$/i;
function showAnswers(list) {
  const here = (list || []).filter((a) => a.page === location.pathname);
  // done ones go to the tray, with Compare; skipped ones say so
  compare.remember(here);
  const opts = here.filter((a) => a.status === 'options'), skipped = here.filter((a) => !a.flushed && a.status === 'skipped'), plain = here.filter((a) => a.flushed && !a.before?.length);
  if (opts.length || skipped.length || plain.length) flash([...opts.map((a) => `#${a.id}: options ready (${a.reply}). Open it to flip between them.`), ...plain.map((a) => `✓ #${a.id} done: ${a.reply}`), ...skipped.map((a) => `#${a.id} skipped: ${a.reply} (still in Pins)`)].join('\n'));
  else draw();
}
// One live connection per site, not one per page: a browser lets a page talk to a server over only six connections at
// a time, and each open stream holds one, so with a few tabs or the Sizes frames every other request would wait
// forever. The pages take turns holding it (a Web Lock) and the holder passes each message on (a BroadcastChannel).
function listen() {
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('unide-events') : null;
  const open = () => { const es = new EventSource('/__unide/events'); es.onmessage = (m) => { handle(m); bc?.postMessage(m.data); }; return es; };
  if (bc) bc.onmessage = (m) => handle({ data: m.data });
  if (bc && navigator.locks) navigator.locks.request('unide-events', () => new Promise(() => open())); // held while this page lives
  else open();
}
async function handle(m) {
  const ev = JSON.parse(m.data);
  if (ev.type === 'file' && ASSET.test(ev.file)) { clearTimeout(listen.t); listen.t = setTimeout(() => location.reload(), 200); }
  if (ev.type === 'pins') {
    // don't swap the pins out from under a note you're typing; catch up when you're done
    if (root.activeElement?.closest?.('.pop')) { listen.behind = true; if (ev.answered) (listen.missed ||= []).push(...ev.answered); return; }
    await load();
    // addressed pins are already cleared, so their answer is shown once here; skipped ones stay with the reason
    showAnswers(ev.answered);
  }
}
export function startPins() {
  api('ping').then((p) => setRoot(p.root)).catch(() => {});
  const E = window.__unideEarly;
  if (E) {
    E.onOptDown = startHold; E.onOptPin = optPin;
    E.onUnpinHit = (ev) => !!pinnedAt(ev.composedPath()[0] instanceof Element ? ev.composedPath()[0] : ev.target);
    E.onUnpin = (ev) => { const hit = pinnedAt(ev.composedPath()[0] instanceof Element ? ev.composedPath()[0] : ev.target); if (hit) unpin(hit.pin, hit.idx); };
  }
  root.addEventListener('keydown', noteKeys);
  // pointing at a font in the list previews it on the element; leaving the list puts it back
  let previewing = null;
  root.addEventListener('pointermove', (ev) => {
    const path = ev.composedPath(), row = path.find((n) => n.classList?.contains('frow')), cell = path.find((n) => n.classList?.contains('icell'));
    const box = row?.closest('.fonts') || cell?.closest('.icontool'), name = row ? `f:${row.dataset.font}` : cell ? `i:${cell.dataset.icon}` : null;
    if (name === previewing) return;
    previewing = name;
    const pin = openDraft(), e = box && pin?.elements.find((x) => x.k === box.dataset.k), el = e && find(e);
    fonts.preview(row && el ? el : null, row?.dataset.font);
    icons.preview(cell && el ? el : null, cell?.dataset.icon);
  });
  // dragging on the wheel
  root.addEventListener('pointerdown', (ev) => {
    const cv = ev.composedPath()[0], box = cv?.tagName === 'CANVAS' && cv.closest('.cwheel');
    if (!box) return;
    ev.preventDefault();
    const l = +box.querySelector('[data-in=clight]').value / 100;
    colourDrag = { k: box.dataset.k, p: box.dataset.prop, l };
    setColour(colourDrag.k, colourDrag.p, wheel.at(box, ev.clientX, ev.clientY, l), false);
  });
  addEventListener('pointermove', (ev) => { const box = colourBox(); if (colourDrag && box) setColour(colourDrag.k, colourDrag.p, wheel.at(box, ev.clientX, ev.clientY, colourDrag.l), false); }, true);
  addEventListener('pointerup', () => { if (!colourDrag) return; const d = colourDrag; colourDrag = null; const [pin] = editTarget(d.k); editCommit(pin, true); }, true);
  // the lightness slider (shown while it moves, saved when let go) and the hex field
  inputs.clight = (inp) => { const box = inp.closest('.cwheel'), el = box && find(editTarget(box.dataset.k)[1]); if (!el) return; const [h, s] = wheel.rgbToHsl(nowRgb(el, box.dataset.prop)); const rgb = wheel.hslToRgb(h, s, +inp.value / 100); wheel.paint(box, rgb); colourDrag ||= { k: box.dataset.k, p: box.dataset.prop, slider: true }; setColour(box.dataset.k, box.dataset.prop, rgb, false); };
  changes.clightdone = (inp) => { const box = inp.closest('.cwheel'); colourDrag = null; const [pin] = editTarget(box.dataset.k); editCommit(pin, true); };
  changes.chex = (inp) => { const box = inp.closest('.cwheel'), rgb = parse(inp.value.trim()); if (rgb) setColour(box.dataset.k, box.dataset.prop, rgb, true); };
  // icons: search (the meanings load the first time)
  inputs.iconq = (inp) => {
    const box = inp.closest('.icontool'), grid = box?.querySelector('.igrid'), e = openDraft()?.elements.find((x) => x.k === box?.dataset.k);
    if (!grid || !e) return;
    const show = () => { grid.innerHTML = icons.iconCells(e.k, inp.value, e.edits?.icon?.to); };
    show(); icons.loadTags().then(show);
  };
  // images: a chosen file, a pasted link, or a file dropped on the panel
  const imageTo = async (k, how) => { const [pin, e] = editTarget(k), el = e && find(e); if (!el) return; ed.snapshot(e); if (await how(e, el)) editCommit(pin, true); };
  changes.ifile = (inp) => { const k = inp.closest('.imgtool')?.dataset.k, f = inp.files?.[0]; if (k && f) imageTo(k, (e, el) => images.setFile(e, el, f)); };
  changes.iurl = (inp) => { const k = inp.closest('.imgtool')?.dataset.k, u = inp.value.trim(); if (k && u) imageTo(k, (e, el) => images.setUrl(e, el, u)); };
  root.addEventListener('dragover', (ev) => { const d = ev.composedPath().find((n) => n.dataset?.drop); if (d) { ev.preventDefault(); d.classList.add('over'); } });
  root.addEventListener('dragleave', (ev) => ev.composedPath().find((n) => n.dataset?.drop)?.classList.remove('over'));
  root.addEventListener('drop', (ev) => { const d = ev.composedPath().find((n) => n.dataset?.drop), f = ev.dataTransfer?.files?.[0]; if (!d) return; ev.preventDefault(); d.classList.remove('over'); if (f) imageTo(d.dataset.drop, (e, el) => images.setFile(e, el, f)); });
  // Text's sliders: shown while they move, saved when let go
  let tDrag = false;
  inputs.ttrack = (inp) => { const box = inp.closest('.typetool'), [pin, e] = editTarget(box.dataset.k), el = e && find(e); if (!el) return; if (!tDrag) { ed.snapshot(e); tDrag = true; } type.set(e, el, inp.dataset.prop, inp.value, ed.original); ed.tidyEdits(e); const out = box.querySelector(`[data-out="${inp.dataset.prop}"]`); if (out) out.textContent = inp.dataset.prop === 'letter-spacing' ? inp.value + 'em' : inp.value; editCommit(pin, false); };
  changes.ttrackdone = (inp) => { tDrag = false; const [pin] = editTarget(inp.closest('.typetool').dataset.k); editCommit(pin, true); };
  // the wipe moves without redrawing everything
  inputs.cmpwipe = (inp) => { if (!P.compare) return; P.compare.cut = +inp.value; const box = inp.closest('.compare'); box.querySelector('.cmpbefore').style.clipPath = `inset(0 ${100 - P.compare.cut}% 0 0)`; box.querySelector('.cmpline').style.left = P.compare.cut + '%'; };
  inputs.fontq = (inp) => { const box = inp.closest('.fonts'), list = box?.querySelector('.flist'), pin = openDraft(), e = pin?.elements.find((x) => x.k === box.dataset.k); if (!list || !e) return; list.innerHTML = inp.value.trim() ? fonts.searchRows(e.k, inp.value, e.edits?.font?.to) : ''; if (!inp.value.trim()) draw(); };
  // while a pin is open: Esc leaves Copy look or Shape; ⌘Z undoes the last change by hand (not while undoing typing)
  root.addEventListener('keydown', (ev) => {
    const pin = openDraft();
    if (!pin) return;
    if (ev.key === 'Escape' && (P.lookFor || P.shape)) { ev.preventDefault(); ev.stopPropagation(); P.lookFor = P.shape = null; draw(); return; }
    undoKey(ev, pin);
  }, true);
  // clicking the card's buttons leaves the keyboard with the page, so ⌘Z is also heard there (and kept from the page)
  addEventListener('keydown', (ev) => { const pin = openDraft(); if (pin && !ev.composedPath().includes(root.host)) undoKey(ev, pin, true); }, true);
  draw(); load(); listen(); loop();
  // animation frames pause in hidden tabs; this keeps badges on elements that render late anyway
  setInterval(() => layer.querySelector('.marks') && place(), 500);
  root.addEventListener('focusout', () => setTimeout(() => { if (listen.behind && !root.activeElement?.closest?.('.pop')) { listen.behind = false; load().then(() => { showAnswers(listen.missed); listen.missed = null; }); } }, 50));
}
