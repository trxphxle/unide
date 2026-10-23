// The bar, the panel with its five modes, and the footer where you keep what you tried.
import { S, root, $, esc, actions, inputs, changes, setRender, render, freshPage, setTimeout, optKey, optClick, isMac } from './core.js';
import { CSS } from './styles.js';
import { expand } from './dock.js';
import { updatePreview } from './preview.js';
import { groupMode, clearSelection } from './selection.js';
import { hasPageDraft } from './page.js';
import { keep, canKeep } from './request.js';
import { compare, applyLenses } from './lenses.js';
import { setPicking } from './picking.js';
import { toggleFreeze } from './freeze.js';
import { viewSnapshot, addRefs, pickFromRef } from './review.js';
import { act, valueLabel } from './ui.js';
import * as inspect from './mode-inspect.js';
import * as colour from './mode-colour.js';
import * as type from './mode-type.js';
import * as layout from './mode-layout.js';
import * as review from './mode-review.js';

const MODES = { inspect: ['Inspect', inspect], colour: ['Colour', colour], type: ['Type', type], layout: ['Layout', layout], review: ['Review', review] };

root.innerHTML = `<style>${CSS}</style>
  <div class="hl hover"></div><div class="boxes"></div><div class="lines"></div><div class="aligns"></div><div class="tag"></div>
  <div class="banner before">Before your changes</div><div class="banner viewing"></div>
  <div class="banner frozen">Frozen: the page's timers, animations and hover are held. <button data-act="freeze">Unfreeze (${optKey('F')})</button></div>
  <div class="bar"><span class="brand"><span class="full">unide</span><span class="short">u</span><b class="dotn">0</b></span>
    <button class="pinbtn" data-act="pinmode" data-key="Shortcut: ${optClick} anything on the page, no need to press Pin">Pin</button>
    <button class="bar-pins" data-act="pinlist" title="Your pins on this page and the agent's answers">Pins 0</button>
    <button class="primary" data-act="pinsend" data-key="Shortcut: ${isMac ? '⌘' : 'Ctrl+'}Return while typing a note sends everything" disabled>Send</button>
    <button data-act="freeze" data-key="Shortcut: ${optKey('F')}, without moving the mouse off what's open">Freeze</button>
    <span class="sep"></span>
    <button data-act="panel" title="Inspect, colour, type, layout, lenses and snapshots">Tools</button></div>
  <aside class="panel"><nav class="tabs"></nav><div class="body"></div><div class="foot"></div></aside>`;

function foot() {
  const sel = S.sels.length, page = hasPageDraft(), n = S.items.length;
  const copy = `<span class="small">${n} kept</span>${act('sendreq', 'Send to agent', { cls: 'mini primary', disabled: !n })}${act('copy', 'Copy', { cls: 'mini', disabled: !n })}`;
  const ok = S.flash ? `<div class="ok">${esc(S.flash)}</div>` : '';
  if (!sel && !page) return `<div class="row"><span class="small">${n ? 'Ready when you are.' : 'Nothing kept yet.'}</span><span class="row">${copy}</span></div>${ok}`;
  return `<textarea data-in="note" placeholder="${sel ? 'In your own words (optional), e.g. too loud next to the cream' : 'Why? (optional)'}">${esc(S.d.note)}</textarea>
    <div class="row" style="margin-top:8px"><span class="row">${act('keep', 'Keep', { cls: 'keep', disabled: !canKeep() })}${sel ? act('lock', groupMode() ? 'Lock all' : 'Lock as is', { cls: 'lock' }) : ''}${act(sel ? 'done' : 'discard', sel ? 'Done' : 'Discard')}</span><span class="row">${copy}</span></div>
    <div class="small" style="margin-top:4px">Keep works with words alone, for things the knobs can't say.${page ? ' Page-wide changes are kept as their own item.' : ''}</div>${ok}`;
}

// re-rendering while you type would wipe what you typed, so wait until the field loses focus
let deferred = false;
function typingInPanel() {
  const a = root.activeElement;
  return a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && /text|number/.test(a.type)));
}
function draw() {
  updatePreview();
  if (typingInPanel()) { deferred = true; return; }
  deferred = false;
  $('.tabs').innerHTML = Object.entries(MODES).map(([k, [label]]) => `<button data-act="mode" data-arg="${k}" class="${S.mode === k ? 'cur' : ''}">${label}</button>`).join('')
    + `<span class="grow"></span><button class="pick mini ${S.picking === 'pick' || S.picking === 'ref' ? 'on' : ''}" data-act="pick" title="Select an element to work on. Shift+click adds more.">${S.picking === 'ref' ? 'Click the one you like (Esc)' : S.picking === 'pick' ? 'Selecting… (Esc)' : 'Select'}</button>`;
  const body = $('.body'), top = body.scrollTop;
  body.innerHTML = MODES[S.mode][1].view();
  body.scrollTop = top;
  $('.foot').innerHTML = foot();
  const v = $('.viewing');
  v.style.display = S.viewing ? 'block' : 'none';
  if (S.viewing) v.innerHTML = `Viewing snapshot: ${esc(S.viewing.name)} <button data-act="viewsnap" data-arg="">Back to now</button>`;
}
setRender(draw);
root.addEventListener('focusout', () => setTimeout(() => { if (deferred && !typingInPanel()) draw(); }));

Object.assign(actions, {
  mode: (m) => { S.mode = m; $('.body').scrollTop = 0; render(); },
  pick: () => setPicking(S.picking ? null : 'pick'),
  panel: () => expand('tools', $('.panel').classList.toggle('open')),
  keep: () => keep('change'),
  lock: () => keep('lock'),
  done: () => clearSelection(),
  discard: () => { S.page = freshPage(); render(); },
  viewsnap: (id) => viewSnapshot(id || null),
  freeze: () => toggleFreeze(),
});
inputs.note = (el) => { S.d.note = el.value; const k = $('.foot [data-act="keep"]'); if (k) k.disabled = !canKeep(); };
changes.rerender = () => render();

// ---------- one set of listeners for every control in the overlay ----------
root.addEventListener('click', (e) => {
  if (e.target.matches?.('[data-refimg]')) return pickFromRef(e.target, e);
  const b = e.target.closest('[data-act]');
  if (b && !b.disabled) actions[b.dataset.act]?.(b.dataset.arg, b, e);
});
root.addEventListener('input', (e) => {
  const el = e.target, name = el.dataset?.in;
  if (!name) return;
  if (el.type === 'range') { const v = el.closest('.knob')?.querySelector('.v'); if (v) v.textContent = valueLabel(el.value); }
  inputs[name]?.(el);
  if (el.type === 'range') { const k = $('.foot [data-act="keep"]'); if (k) k.disabled = !canKeep(); else if (!$('.foot textarea')) $('.foot').innerHTML = foot(); }
});
root.addEventListener('change', (e) => { const name = e.target.dataset?.ch; if (name) changes[name]?.(e.target); });
// typing in unide's notes and fields: the page's own keyboard shortcuts never hear it
for (const t of ['keydown', 'keyup', 'keypress', 'input', 'beforeinput', 'paste', 'copy', 'cut']) root.addEventListener(t, (e) => e.stopPropagation());
// hold to compare
root.addEventListener('pointerdown', (e) => { if (e.target.closest('.hold')) compare(true); });
for (const t of ['pointerup', 'pointercancel']) addEventListener(t, () => S.comparing && compare(false), true);
root.addEventListener('pointerout', (e) => { if (S.comparing && e.target.closest?.('.hold')) compare(false); });
// dropping reference images
root.addEventListener('dragover', (e) => { const d = e.target.closest?.('[data-drop]'); if (d) { e.preventDefault(); d.classList.add('over'); } });
root.addEventListener('dragleave', (e) => e.target.closest?.('[data-drop]')?.classList.remove('over'));
root.addEventListener('drop', (e) => { const d = e.target.closest?.('[data-drop]'); if (d) { e.preventDefault(); addRefs([...e.dataTransfer.files]); } });

export { applyLenses };
