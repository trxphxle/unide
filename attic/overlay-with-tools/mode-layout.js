// Layout: what should lead, spacing between a group, and edges that almost line up.
import { S, esc, actions, render } from './core.js';
import { groupMode, measuredOrder, leadMoved, startEqualize, selectMany } from './selection.js';
import { nameOf } from './dom.js';
import { gapPairs, gapWords, median } from './measure.js';
import { findAlignment } from './audit.js';
import { applyLenses } from './lenses.js';
import { clean } from './preview.js';
import { act, selectionHeader } from './ui.js';

function leadSection() {
  const now = measuredOrder(), want = S.d.lead || now;
  return `<section><h3>What should lead?</h3>
    <div class="small">Noticed first now (from size, weight and contrast): ${now.map((i) => i + 1).join(' → ')}. Put them in the order they should be noticed.</div>
    <ol class="lead">${want.map((m, k) => `<li><span class="n">${m + 1}</span><span class="grow">${esc(S.sels[m].name)} ${S.sels[m].text ? `“${esc(S.sels[m].text)}”` : `<code>${esc(S.sels[m].tag)}</code>`}</span>
      ${act('up', '↑', { arg: k, cls: 'mini', disabled: !k })}${act('dn', '↓', { arg: k, cls: 'mini', disabled: k >= want.length - 1 })}</li>`).join('')}</ol>
    ${leadMoved() ? `<div class="actions">${act('reset', 'Reset order', { arg: 'lead', cls: 'mini' })}</div>` : ''}</section>`;
}
function spacingSection() {
  const pairs = clean(() => gapPairs(S.sels.map((s) => s.el))), med = median(pairs.filter((p) => p.empty).map((p) => p.px));
  const uneven = pairs.some((p) => p.empty && Math.abs(p.px - med) > 2);
  return `<section><h3>Spacing</h3>
    <div class="small">${gapWords(pairs).map(esc).join(' · ')}${uneven ? ' — <span class="bad">uneven (red on the page)</span>' : ''}</div>
    ${pairs.filter((p) => p.empty).length >= 2 ? `<div class="actions">${S.d.equalize ? `<span>Equal at <b>${S.d.equalize.to}px</b></span>${act('reset', 'Undo', { arg: 'equalize', cls: 'mini' })}`
      : `<span class="small">Make every gap</span><input type="number" data-eqto value="${med}" min="0"><span class="small">px</span>${act('eq', 'Equalize', { cls: 'mini' })}`}</div>`
      : '<div class="small" style="margin-top:6px">Equalize needs at least two empty gaps between neighbours.</div>'}</section>`;
}
function alignSection() {
  return `<section><div class="row"><h3 class="grow" style="margin:0">Alignment — ${S.alignIssues.length} near-miss${S.alignIssues.length === 1 ? '' : 'es'}</h3>
      ${act('align', S.lens.align ? 'Hide on page' : 'Show on page', { cls: 'mini' + (S.lens.align ? ' on' : '') })}${act('alignrun', 'Check', { cls: 'mini' })}</div>
    <div class="small" style="margin-top:6px">Edges 1–4px apart look like mistakes rather than choices.</div>
    ${S.alignIssues.slice(0, 12).map((x, i) => `<div class="line"><span class="grow small">${esc(nameOf(x.a))} and ${esc(nameOf(x.b))}: ${x.edge} edges ${x.delta}px apart</span>${act('aal', 'Select', { arg: i, cls: 'mini' })}</div>`).join('')}</section>`;
}
export const view = () => `${S.sels.length ? selectionHeader() : ''}${groupMode() ? leadSection() + spacingSection()
  : '<section><div class="muted">Shift+click two or more elements to compare their spacing and decide which should lead.</div></section>'}${alignSection()}`;

// ---------- controls ----------
function move(k, j) {
  const order = S.d.lead || measuredOrder();
  [order[k], order[j]] = [order[j], order[k]];
  S.d.lead = [...order]; render();
}
Object.assign(actions, {
  up: (k) => move(+k, +k - 1),
  dn: (k) => move(+k, +k + 1),
  eq: (_, btn) => { startEqualize(+btn.closest('section').querySelector('[data-eqto]').value); render(); },
  align: () => { S.lens.align = !S.lens.align; if (S.lens.align && !S.alignIssues.length) S.alignIssues = findAlignment(); applyLenses(); render(); },
  alignrun: () => { S.alignIssues = findAlignment(); render(); },
  aal: (i) => { const x = S.alignIssues[+i]; selectMany([x.a, x.b], `the alignment check: ${x.edge} edges ${x.delta}px apart`); },
});
