// Freeze: hold the page still so things that vanish (hover menus, tooltips, toasts, lists that close on blur)
// stay put while you pin them. early.js holds the page's timers, frames and events; this pauses animations,
// transitions and media, and keeps hover and focus styles on what had them when you froze.
import { $ } from './core.js';
import { allRules, splitList } from './dom.js';
import { expand } from './dock.js';

const E = window.__unideEarly;
export const frozen = () => !!E?.frozen;
const STATES = { hover: [':hover', 'data-unide-hover'], focus: [':focus', 'data-unide-focus'], 'focus-visible': [':focus-visible', 'data-unide-focus-visible'], 'focus-within': [':focus-within', 'data-unide-focus-within'], active: [':active', 'data-unide-active'] };
const sheet = Object.assign(document.createElement('style'), { id: 'unide-freeze' });
let kept = [], paused = [], media = [], was = { hover: null, focus: null };

// the page's :hover and :focus rules again, for attributes unide sets on the elements that had those states
function stateRules() {
  const out = [];
  for (const r of allRules()) {
    const parts = splitList(r.selectorText).filter((p) => /:(hover|focus|focus-visible|focus-within|active)\b/.test(p));
    if (!parts.length) continue;
    const sel = parts.map((p) => p.replace(/:(hover|focus-visible|focus-within|focus|active)\b/g, (_, s) => `[${STATES[s][1]}]`)).join(', ');
    const body = r.style.cssText;
    const media = r.parentRule?.conditionText;
    out.push(media ? `@media ${media}{${sel}{${body}}}` : `${sel}{${body}}`);
  }
  return out.join('\n');
}

function holdAnimations() {
  for (const a of document.getAnimations()) if (a.playState === 'running') { a.pause(); paused.push(a); }
  if (E.frozen) E.native.requestAnimationFrame(holdAnimations); // ones that start while frozen (a hover that changed) too
}

// quiet: the short hold an ⌥-click makes while you write the note; no banner, and the Freeze button stays off
let quiet = false;
export const isQuiet = () => quiet;
export function freeze({ quiet: q = false } = {}) {
  if (!E || E.frozen) return;
  quiet = q;
  for (const [, [pseudo, attr]] of Object.entries(STATES)) {
    let els = [];
    try { els = [...document.querySelectorAll(pseudo)]; } catch { /* :focus-visible on old browsers */ }
    for (const el of els) if (el.tagName !== 'UNIDE-OVERLAY') { el.setAttribute(attr, ''); kept.push([el, attr]); }
  }
  const hovered = kept.filter(([, a]) => a === 'data-unide-hover').map(([el]) => el);
  was = { hover: hovered.at(-1) || null, focus: document.activeElement !== document.body ? document.activeElement : null };
  sheet.textContent = stateRules();
  document.documentElement.append(sheet);
  for (const m of document.querySelectorAll('video, audio')) if (!m.paused) { m.pause(); media.push(m); }
  E.frozen = true;
  holdAnimations();
  show();
}

export function unfreeze() {
  if (!E?.frozen) return;
  E.frozen = false;
  quiet = false;
  for (const [el, attr] of kept) el.removeAttribute(attr);
  kept = [];
  sheet.remove();
  for (const a of paused) try { a.play(); } catch { /* finished or removed */ }
  paused = [];
  for (const m of media) m.play().catch(() => {});
  media = [];
  const held = E.held.splice(0);
  for (const run of held) try { run(); } catch (err) { console.error(err); }
  catchUp();
  show();
}
// what the page missed while frozen: the pointer left what it hovered, the focus left its field
function catchUp() {
  const p = E.pointer, now = p && document.elementsFromPoint(p.x, p.y).find((el) => el.tagName !== 'UNIDE-OVERLAY');
  const h = was.hover;
  if (h?.isConnected && now && !h.contains(now)) {
    const at = p ? { clientX: p.x, clientY: p.y } : {};
    h.dispatchEvent(new MouseEvent('mouseout', { ...at, bubbles: true, relatedTarget: now }));
    for (let e = h; e && !e.contains(now); e = e.parentElement) for (const t of ['pointerleave', 'mouseleave']) e.dispatchEvent(new (t[0] === 'p' ? PointerEvent : MouseEvent)(t, { ...at, relatedTarget: now }));
    now.dispatchEvent(new MouseEvent('mouseover', { ...at, bubbles: true, relatedTarget: h }));
  }
  const f = was.focus;
  if (f?.isConnected && document.activeElement !== f && !f.contains(document.activeElement)) {
    f.dispatchEvent(new FocusEvent('blur'));
    f.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  }
  was = { hover: null, focus: null };
}
// Freeze pressed during an ⌥-click's hold: the hold becomes yours, and stays after the note is done
export const toggleFreeze = () => (frozen() && quiet ? ((quiet = false), show()) : frozen() ? unfreeze() : freeze());

function show() {
  const b = $(".bar [data-act=\"freeze\"]"), f = $(".banner.frozen");
  const mine = frozen() && !quiet;
  if (b) { b.classList.toggle('on', mine); b.textContent = mine ? 'Frozen' : 'Freeze'; }
  if (f) f.style.display = mine ? 'block' : 'none';
  expand('frozen', mine);
}
export function startFreeze() {
  if (!E) { const b = $(".bar [data-act=\"freeze\"]"); if (b) b.style.display = 'none'; return; }
  E.onToggle = toggleFreeze;
}
