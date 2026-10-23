// Picking on the page. Any time: hold ⌥ to see what ⌥-click would pin (the pin itself happens in pins.js, which
// early.js hands the click to). Modes: 'pin', after pressing Pin: a plain click pins (Shift adds to the open one).
// 'pick': Tools selects (Shift adds or removes). 'ref': the look to copy.
import { S, $, esc, ours, optClick, isMac, setTimeout, root } from './core.js';
import { nameOf, tagOf } from './dom.js';
import { selectOnly, toggle, setLike } from './selection.js';
import { compare } from './lenses.js';
import { place } from './draw.js';
import { pinClick, nextLayer, pinnedAt } from './pins.js';
import { stackAt, label, rectOf } from './layers.js';
import { showOutline, targetOf3 } from './three.js';
import { expand } from './dock.js';

// a 3D object is shown by its own outline; anything else by a box
function mark(hov, t, r) {
  const shape = t?.kind === 'three' && showOutline(root, 'hover', t, '#8fb4ff');
  if (!shape) showOutline(root, 'hover', null);
  Object.assign(hov.style, shape ? { display: 'none' } : { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
}

export function setPicking(mode) {
  S.picking = mode;
  expand('mode', !!mode);
  const pin = $('.pinbtn'), sel = $('.pick');
  pin?.classList.toggle('on', mode === 'pin' || mode === 'pinadd');
  if (pin) pin.textContent = mode === 'pin' ? 'Pinning… (Shift adds · Esc)' : mode === 'pinadd' ? 'Click to add (Esc)' : 'Pin';
  sel?.classList.toggle('on', mode === 'pick' || mode === 'ref');
  if (sel) sel.textContent = mode === 'ref' ? 'Click the one you like (Esc)' : mode === 'pick' ? 'Selecting… (Shift adds · Esc)' : 'Select';
  if (!mode) { $('.hl.hover').style.display = $('.tag').style.display = 'none'; showOutline(root, 'hover', null); }
}

// the element itself, also inside an open shadow root (the page only sees its host)
const under = (e) => { const t = e.composedPath()[0]; return t instanceof Element ? t : e.target; };
const pinning = () => S.picking === 'pin' || S.picking === 'pinadd';
// with Alt held while pinning, the highlight shows what Alt+click would pin: the next layer under the pointer
const optOn = () => window.__unideEarly?.optOn?.() !== false;
function hover({ el, x, y, altKey, preview }) {
  if (!(el instanceof Element)) return;
  if (preview) {
    // ⌥ held, no mode: what ⌥-click would pin
    const hov = $('.hl.hover'), tag = $('.tag');
    hov.classList.remove('ref'); tag.classList.remove('ref');
    const stack = stackAt(x, y, true), t = stack[0], r = t ? rectOf(t) : el.getBoundingClientRect();
    mark(hov, t, r);
    tag.innerHTML = `Pinning: ${esc(t ? label(t) : nameOf(el))} <span>click to pin it · click again: what’s underneath · add ${isMac ? '⇧' : 'Shift'} to add to the open pin</span>`;
    Object.assign(tag.style, { display: 'block', left: Math.max(4, r.left) + 'px', top: Math.max(4, r.top - 20) + 'px' });
    return;
  }
  const ref = S.picking === 'ref', hov = $('.hl.hover'), tag = $('.tag');
  hov.classList.toggle('ref', ref); tag.classList.toggle('ref', ref);
  let r, head;
  if (altKey && pinning()) {
    const stack = stackAt(x, y, true), i = Math.min(1, stack.length - 1), t = stack[i];
    if (!t) return;
    r = rectOf(t);
    mark(hov, t, r);
    head = `${esc(label(t))} <span>${optClick}: layer ${i + 1} of ${stack.length} · again for the next</span>`;
  } else if (pinning() && stackAt(x, y, true)[0]?.kind === 'three') {
    const t = stackAt(x, y, true)[0];
    r = rectOf(t); mark(hov, t, r);
    head = `${esc(label(t))} <span>click to pin it · ${optClick}: what’s behind it</span>`;
  } else {
    showOutline(root, 'hover', null);
    r = place(hov, el);
    const hint = ref ? 'copy this look' : S.picking === 'pin' ? `click to pin · Shift-click adds · ${optClick}: what’s underneath` : S.picking === 'pinadd' ? 'add to the pin' : S.sels.length ? 'Shift+click to add' : '';
    head = `${esc(nameOf(el))} · ${esc(tagOf(el))}${hint ? ` <span>${hint}</span>` : ''}`;
  }
  tag.innerHTML = head;
  Object.assign(tag.style, { display: 'block', left: Math.max(4, r.left) + 'px', top: Math.max(4, r.top - 20) + 'px' });
}
let lastMove = null, previewing = false, altTimer = null;
const cursor = Object.assign(document.createElement('style'), { id: 'unide-cursor', textContent: '*{cursor:crosshair !important}' });
function holding(on) {
  previewing = on;
  expand('alt', on);
  const pin = $('.pinbtn');
  if (pin && !S.picking) { pin.classList.toggle('on', on); pin.textContent = on ? `Pinning (${isMac ? '⌥' : 'Alt'} held)` : 'Pin'; }
  on ? document.documentElement.append(cursor) : cursor.remove();
  root.querySelector('.pins')?.classList.toggle('through', on);
}
// ⌘ held over something pinned: a red box and what ⌘-click will do
let unpinShown = false;
function unpinPreview(el) {
  const hit = pinnedAt(el), hov = $('.hl.hover'), tag = $('.tag');
  if (!hit) { if (unpinShown) { unpinShown = false; hov.classList.remove('del'); tag.classList.remove('del'); hov.style.display = tag.style.display = 'none'; showOutline(root, 'hover', null); } return; }
  unpinShown = true;
  hov.classList.add('del'); tag.classList.add('del');
  const e3 = hit.pin.elements[hit.idx]?.three, t3 = e3 && targetOf3(hit.el, e3);
  const r = place(hov, hit.rect ? { getBoundingClientRect: () => hit.rect } : hit.el); // the pinned element, which may hold what's under the pointer
  if (t3 && showOutline(root, 'hover', t3, '#ff7a7a')) hov.style.display = 'none';
  tag.innerHTML = `${isMac ? '⌘' : 'Ctrl'}-click to unpin #${hit.pin.id}${hit.pin.elements.length > 1 ? ' (just this element)' : ''}`;
  Object.assign(tag.style, { display: 'block', left: Math.max(4, r.left) + 'px', top: Math.max(4, r.top - 20) + 'px' });
}
const hidePreview = () => {
  if (unpinShown) { unpinShown = false; $('.hl.hover').classList.remove('del'); $('.tag').classList.remove('del'); if (!previewing) $('.hl.hover').style.display = $('.tag').style.display = 'none'; } if (previewing && !S.picking) { holding(false); $('.hl.hover').style.display = $('.tag').style.display = 'none'; showOutline(root, 'hover', null); } };
addEventListener('mousemove', (e) => {
  if (ours(e)) return;
  lastMove = { el: under(e), x: e.clientX, y: e.clientY, altKey: e.altKey };
  if (S.picking) hover(lastMove);
  else if ((isMac ? e.metaKey : e.ctrlKey) && !e.altKey) unpinPreview(lastMove.el);
  else if (e.altKey && !e.metaKey && !e.ctrlKey && optOn()) { holding(true); hover({ ...lastMove, preview: true }); }
  else hidePreview();
}, true);
for (const type of ['keydown', 'keyup']) addEventListener(type, (e) => {
  if (e.key === (isMac ? 'Meta' : 'Control')) { if (type === 'keydown' && lastMove && !S.picking) unpinPreview(lastMove.el); else if (type === 'keyup') hidePreview(); return; }
  if (e.key !== 'Alt') { clearTimeout(altTimer); if (type === 'keydown') { hidePreview(); root.querySelector('.pins')?.classList.remove('through'); } return; } // ⌥ as part of typing (⌥E for é): no highlight
  if (S.picking && lastMove) return hover({ ...lastMove, altKey: type === 'keydown' });
  clearTimeout(altTimer);
  if (type === 'keyup') { root.querySelector('.pins')?.classList.remove('through'); return hidePreview(); }
  if (!optOn() || e.metaKey || e.ctrlKey) return;
  root.querySelector('.pins')?.classList.add('through');
  if (!lastMove) return;
  altTimer = setTimeout(() => { holding(true); hover({ ...lastMove, preview: true }); }, 150);
}, true);
addEventListener('blur', () => { clearTimeout(altTimer); hidePreview(); });
for (const type of ['pointerdown', 'mousedown', 'mouseup', 'pointerup']) {
  addEventListener(type, (e) => { if (S.picking && !ours(e)) { e.preventDefault(); e.stopPropagation(); } }, true);
}
addEventListener('click', (e) => {
  if (!S.picking || ours(e)) return;
  e.preventDefault(); e.stopPropagation();
  const el = under(e);
  if (pinning() && e.altKey) {
    // Alt+click: the layer under the top one (a word, a ::before, what a transparent overlay covers); again: the next
    if (nextLayer(e.clientX, e.clientY)) return;
    const stack = stackAt(e.clientX, e.clientY), i = Math.min(1, stack.length - 1);
    if (stack[i]) pinClick(stack[i].el, S.picking === 'pinadd' || e.shiftKey, { ...stack[i], stack, i, x: e.clientX, y: e.clientY });
    return;
  }
  const t = pinning() ? (() => { const stack = stackAt(e.clientX, e.clientY); return stack[0]?.el === el ? { ...stack[0], stack, i: 0, x: e.clientX, y: e.clientY } : undefined; })() : null;
  if (S.picking === 'pin') { if (!e.shiftKey) setPicking(null); pinClick(el, e.shiftKey, t); }
  else if (S.picking === 'pinadd') { if (!e.shiftKey) setPicking(null); pinClick(el, true, t); }
  else if (S.picking === 'ref') { setPicking(null); setLike(el); }
  else if (e.shiftKey) toggle(el);
  else { setPicking(null); selectOnly(el); }
}, true);

// hold the ` key to see the page before your changes
const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.composedPath()[0]?.tagName) || e.composedPath()[0]?.isContentEditable;
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.picking) { e.stopPropagation(); setPicking(null); }
  if (e.key === '`' && !e.repeat && !typing(e)) { e.preventDefault(); compare(true); }
}, true);
addEventListener('keyup', (e) => { if (e.key === '`') compare(false); }, true);
