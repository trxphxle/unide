// Inspect: what you picked, its states, its feel, "make it like that one", and swapping the component.
import { S, esc, actions, inputs, changes, render } from './core.js';
import { groupMode, feelMoved, SWAPS, swapType, selectOnly, selectAllLike, membersChanged, LIKE_LABEL } from './selection.js';
import { STATES, stateRuleCount } from './states.js';
import { updatePreview } from './preview.js';
import { knob, act, sources, selectionHeader, nothingPicked, chain } from './ui.js';
import { setPicking } from './picking.js';

function stateSection() {
  const n = S.d.state === 'rest' ? null : stateRuleCount();
  return `<section><h3>State</h3>
    <div class="seg">${Object.entries(STATES).map(([k, v]) => act('state', v, { arg: k, cls: S.d.state === k ? 'on' : '' })).join('')}</div>
    <div class="small" style="margin-top:6px">${n === null ? 'See how it looks hovered, focused, pressed or disabled.'
      : n ? `Showing the page's own ${STATES[S.d.state].toLowerCase()} styles (${n} rule${n === 1 ? '' : 's'}).` : `<span class="warn">The page has no ${STATES[S.d.state].toLowerCase()} style for this.</span> That may be worth asking for.`}</div></section>`;
}
function feelSection() {
  const f = S.d.feel;
  return `<section><h3>Feel <span class="hint">${groupMode() ? '— applied to each' : ''}</span></h3>
    ${knob('feel', 'e', f.e, 'Emphasis', 'Weight, size and contrast together.', 'quieter', 'louder', 4)}
    ${knob('feel', 'd', f.d, 'Density', 'Padding and the gaps inside.', 'more compact', 'airier', 4)}
    ${knob('feel', 'mood', f.mood, 'Mood', 'A preset: colour intensity, density and emphasis together.', 'calmer', 'more energetic', 4)}
    ${knob('feel', 'play', f.play, 'Tone', 'A preset: corner radius and a little colour.', 'more serious', 'more playful', 4)}
    ${feelMoved(f) ? `<div class="actions">${act('reset', 'Reset feel', { arg: 'feel', cls: 'mini' })}</div>` : ''}</section>`;
}
function likeSection() {
  const L = S.d.like;
  if (!L) return `<section><h3>Make it like that one</h3><div class="small">Point at something you like instead of describing it. It borrows that element's colours, type and spacing${groupMode() ? ' for each of these' : ''}.</div>
    <div class="actions">${act('likepick', 'Pick the one you like')}</div></section>`;
  return `<section><h3>Make it like that one</h3>
    <div>Like: ${esc(L.name)} <code>${esc(L.tag)}</code>${L.text ? ` <span class="small">“${esc(L.text)}”</span>` : ''}</div>
    ${L.diffs.length ? `<div class="likes">${L.diffs.map((x, i) => `<label><input type="checkbox" data-ch="likeon" data-arg="${i}" ${x.on ? 'checked' : ''}><span><b>${esc(LIKE_LABEL[x.prop])}</b> <code>${esc(x.from)}</code> → <code>${esc(x.to)}</code></span></label>`).join('')}</div>`
      : '<div class="small" style="margin-top:6px">They already look the same in every way this compares.</div>'}
    <div class="actions">${act('likepick', 'Pick another', { cls: 'mini' })}${act('likeclear', 'Clear', { cls: 'mini' })}</div></section>`;
}
function swapSection() {
  const type = swapType(), opts = SWAPS[type];
  return `<section><details ${S.d.swap || S.d.variants ? 'open' : ''}><summary><h3>Swap the component</h3></summary>
    <div class="row small">It's a <select data-ch="swaptype">${Object.keys(SWAPS).map((k) => `<option ${k === type ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></div>
    <div class="opts">${opts.map(([n, desc]) => `<label class="opt ${S.d.swap === n ? 'on' : ''}"><input type="radio" name="swap" data-ch="swap" value="${esc(n)}" ${S.d.swap === n ? 'checked' : ''}><span><b>${esc(n)}</b><span class="small">${esc(desc)}</span></span></label>`).join('')}</div>
    <label class="opt" style="margin-top:8px"><input type="checkbox" data-ch="variants" ${S.d.variants ? 'checked' : ''}><span><b>Show me 3 versions</b><span class="small">The agent builds three named versions behind a switch, so you can compare them on the page.</span></span></label>
    ${S.d.swap ? `<div class="actions">${act('reset', 'Clear swap', { arg: 'swap', cls: 'mini' })}</div>` : ''}</details></section>`;
}
function whereSection() {
  if (groupMode()) return '';
  const s = S.sels[0];
  const qs = [...new Set([...s.drafts.filter((d) => d.win && !d.win.inline).map((d) => d.win.selector), ...Object.values(s.style)])];
  if (!qs.length) return '';
  return `<section><details><summary><h3>Where its style lives</h3></summary>${qs.map((q) => `<div style="margin-top:6px"><code>${esc(q)}</code>${sources(q)}</div>`).join('')}</details></section>`;
}
export const view = () => (S.sels.length ? selectionHeader() + stateSection() + feelSection() + likeSection() + swapSection() + whereSection()
  : `<section><h2>Pick something</h2><div class="muted">Press <b>Pick</b>, then click part of the page. <b>Shift+click</b> picks several to judge them together.</div>
    <div class="small" style="margin-top:10px"><b>Inspect</b> names it and changes its feel · <b>Colour</b> edits it and the whole palette · <b>Type</b> tries scales and fonts · <b>Layout</b> checks spacing, order and alignment · <b>Review</b> has lenses, snapshots, references and your request.</div></section>`);

// ---------- controls ----------
Object.assign(actions, {
  crumb: (i) => selectOnly(chain[+i]),
  child: () => selectOnly(S.sels[0].el.firstElementChild),
  likeall: () => selectAllLike(),
  unsel: (i) => { S.sels.splice(+i, 1); membersChanged(); },
  state: (k) => { S.d.state = k; render(); },
  likepick: () => setPicking('ref'),
  likeclear: () => { S.d.like = null; render(); },
  reset: (what) => {
    if (what === 'feel') S.d.feel = { e: 0, d: 0, mood: 0, play: 0 };
    else if (what === 'swap') S.d.swap = null;
    else if (what === 'lead') S.d.lead = null;
    else if (what === 'equalize') S.d.equalize = null;
    render();
  },
});
inputs.feel = (el) => { S.d.feel[el.dataset.arg] = +el.value; updatePreview(); };
Object.assign(changes, {
  likeon: (el) => { S.d.like.diffs[+el.dataset.arg].on = el.checked; render(); },
  variants: (el) => { S.d.variants = el.checked; render(); },
  swaptype: (el) => { S.d.swapType = el.value; S.d.swap = null; render(); },
  swap: (el) => { S.d.swap = el.value; render(); },
});
