// Colour: the picked element's colours, the whole palette's tokens with harmonies, the eyedropper, and the colour audit.
import { S, esc, actions, inputs, changes, render, zero, $ } from './core.js';
import { toOklch, words, contrast, moved, harmonies, hex, parse } from './colour.js';
import { PROPS, effectiveBg } from './dom.js';
import { groupMode, result, baseOf, selectMany } from './selection.js';
import { tokens, tokenDraft, tokenValue } from './page.js';
import { runAudit } from './audit.js';
import { updatePreview } from './preview.js';
import { eyedrop, hasEyedropper } from './review.js';
import { colourKnobs, act, swatch, selectionHeader } from './ui.js';

const pickBtn = (target, label = 'Pick from screen') => (hasEyedropper() ? act('eyedrop', label, { arg: target, cls: 'mini', title: 'Pick any colour on your screen' }) : '');

function pickedSection() {
  if (!S.picked) return '';
  const rgb = parse(S.picked), many = groupMode();
  const props = S.sels.length ? Object.keys(PROPS).filter((p) => S.sels.some((s) => s.drafts.some((d) => d.prop === p))) : [];
  return `<section><h3>Picked colour</h3><div class="row"><div class="sw" style="background:${S.picked}"></div><div class="grow"><div class="words">${esc(words(rgb))}</div><code>${S.picked}</code></div></div>
    <div class="actions">${props.map((p) => act('usepicked', `Use as ${PROPS[p].label.toLowerCase()}${many ? ' (all)' : ''}`, { arg: p, cls: 'mini' })).join('')}
      ${S.openToken ? act('usepicked', 'Use for the open token', { arg: 'token', cls: 'mini' }) : ''}${act('clearpicked', 'Clear', { cls: 'mini' })}</div></section>`;
}
function colourBlock(d, i) {
  const sel = S.sels[0], r = result(d), o = toOklch(baseOf(d)), live = moved(d.steps) || d.set;
  const set = d.win ? `set by <code>${esc(d.win.selector)}</code> as <code>${esc(d.win.value)}</code>` : 'inherited from a parent';
  const scope = d.win?.token ? `<div class="scope">
      <label><input type="radio" name="sc${i}" value="rule" data-ch="scope" data-arg="${i}" ${d.scope === 'rule' ? 'checked' : ''}> <span>Only this rule <code>${esc(d.win.selector)}</code></span></label>
      <label><input type="radio" name="sc${i}" value="token" data-ch="scope" data-arg="${i}" ${d.scope === 'token' ? 'checked' : ''}> <span>The token <code>${esc(d.win.token)}</code> everywhere <span class="small">(used by ${d.users.length} rule${d.users.length === 1 ? '' : 's'})</span></span></label></div>` : '';
  let contrastLine = '';
  if (d.prop === 'color') {
    const ratio = contrast(r.rgb, effectiveBg(sel.el));
    contrastLine = `<div class="small" style="margin-top:8px">Contrast with its background: <b>${ratio.toFixed(1)} : 1</b> — ${ratio >= 7 ? 'passes AAA' : ratio >= 4.5 ? 'passes AA for body text' : ratio >= 3 ? '<span class="warn">only OK for large text (AA large)</span>' : '<span class="warn">fails: hard to read</span>'}</div>`;
  }
  return `<div class="card" data-p="${i}">
    <div class="row"><h3 class="grow" style="margin:0">${PROPS[d.prop].label}</h3>${pickBtn('sel:' + i)}</div>
    <div class="row" style="margin-top:8px"><div class="sw" style="background:${r.from}"></div><span class="arrow">→</span><div class="sw to" style="background:${r.to}"></div>
      <div><div class="words">${esc(live ? r.toWords : r.fromWords)}</div><div class="small was">${live ? `was ${esc(r.fromWords)} · ` : ''}<code>${r.to}</code>${d.set ? ' · picked' : ''}</div></div></div>
    <div class="small" style="margin-top:6px">${set}</div>
    ${scope}
    <div style="margin-top:10px">${colourKnobs('col', i, d.steps, o.H)}</div>
    ${contrastLine}
    ${live ? `<div class="actions">${act('colreset', 'Reset', { arg: i, cls: 'mini' })}</div>` : ''}
  </div>`;
}
function selectionColours() {
  if (!S.sels.length) return '';
  if (!groupMode()) {
    const s = S.sels[0];
    return `<section><h3>This element's colours</h3>${s.drafts.length ? s.drafts.map(colourBlock).join('') : '<div class="muted">It has no colours of its own. Pick one of its parents in Inspect.</div>'}</section>`;
  }
  const c = S.d.colour;
  const props = Object.keys(PROPS).filter((p) => S.sels.some((s) => s.drafts.some((d) => d.prop === p)));
  if (!props.length) return '<section><div class="muted">None of these has a colour of its own.</div></section>';
  const first = S.sels.map((s) => s.drafts.find((d) => d.prop === c.prop)).find(Boolean);
  return `<section><div class="row"><h3 class="grow" style="margin:0">Shift all their colours together</h3>${pickBtn('group')}</div>
    <div class="seg" style="margin-top:8px">${props.map((p) => act('gprop', PROPS[p].label, { arg: p, cls: p === c.prop ? 'on' : '' })).join('')}</div>
    <div class="small" style="margin-top:6px">Each keeps its own colour and moves by the same steps${c.set ? `, starting from the picked ${c.set}` : ''}.</div>
    <div data-p="g" style="margin-top:8px">${colourKnobs('col', 'g', c.steps, first ? toOklch(first.rgba).H : 0)}</div>
    ${moved(c.steps) || c.set ? `<div class="actions">${act('colreset', 'Reset', { arg: 'g', cls: 'mini' })}</div>` : ''}</section>`;
}
function tokenEditor(t) {
  const d = S.page.tokens[t.key] || { steps: zero(), set: null, rgba: t.rgba };
  const v = tokenValue({ ...d, rgba: t.rgba }), live = moved(d.steps) || d.set, o = toOklch(d.set ? parse(d.set) : t.rgba);
  return `<div class="card" data-tok="${esc(t.key)}">
    <div class="row"><div class="sw" style="background:${hex(t.rgba, t.rgba[3])}"></div><span class="arrow">→</span><div class="sw to" style="background:${v.hex}"></div>
      <div class="grow"><div class="words">${esc(words(live ? v.rgb : t.rgba))}</div><div class="small was"><code>${v.hex}</code>${live ? ` · was ${esc(words(t.rgba))}` : ''}</div></div></div>
    <div class="row" style="margin-top:8px"><input type="text" value="${v.hex}" data-ch="tokhex" style="width:96px" title="Type a colour">${pickBtn('token')}${live ? act('tokreset', 'Reset', { cls: 'mini' }) : ''}</div>
    <div style="margin-top:10px">${colourKnobs('tok', 'open', d.steps, o.H)}</div>
    <div class="harm"><div class="small" style="margin-top:12px"><b>Goes with it</b> — click one to use it for this token</div>
      ${harmonies(live ? v.rgb : t.rgba).map((h) => `<div class="small" style="margin-top:6px" title="${esc(h.hint)}">${h.name} <span style="opacity:.7">· ${esc(h.hint)}</span></div><div class="row">${h.colours.map((c) => `<button class="msw" data-act="harm" data-arg="${hex(c)}" title="${hex(c)} · ${esc(words(c))}" style="background:${hex(c)};width:26px;height:22px"></button>`).join('')}</div>`).join('')}</div>
  </div>`;
}
function paletteSection() {
  const list = tokens();
  if (!list.length) return '<section><h3>Palette</h3><div class="muted">This page has no colour tokens (CSS variables) to edit. Colours are written into each rule.</div></section>';
  return `<section><div class="row"><h3 class="grow" style="margin:0">Palette — ${list.length} colour tokens</h3>${act('tokrefresh', 'Refresh', { cls: 'mini', title: 'Read the tokens again (after switching palette or theme)' })}</div>
    <div class="small" style="margin:6px 0">Change one and everything that uses it follows. Tokens are listed per scope, as you see them now.</div>
    ${list.map((t) => {
      const d = S.page.tokens[t.key], v = d ? tokenValue(d) : null, live = d && (moved(d.steps) || d.set);
      return `<button class="tok ${S.openToken === t.key ? 'open' : ''}" data-act="token" data-arg="${esc(t.key)}">${swatch(live ? v.hex : hex(t.rgba, t.rgba[3]))}
        <span class="grow"><span class="name">${esc(t.name)}</span> <span class="small">${esc(t.selector)} · ${esc(words(t.rgba))}${t.rgba[3] < 0.99 ? ` at ${Math.round(t.rgba[3] * 100)}%` : ''} · ${t.users} use${t.users === 1 ? '' : 's'}</span></span>${live ? '<span class="small warn">changed</span>' : ''}</button>
        ${S.openToken === t.key ? tokenEditor(t) : ''}`;
    }).join('')}</section>`;
}
function auditSection() {
  const A = S.audit;
  if (!A) return `<section><h3>Colour audit</h3><div class="small">Every colour on the page, with ones that are almost the same flagged.</div><div class="actions">${act('audit', 'Check colours')}</div></section>`;
  return `<section><div class="row"><h3 class="grow" style="margin:0">Colour audit — ${A.colours.length} distinct${A.near.length ? `, <span class="warn">${A.near.length} group${A.near.length > 1 ? 's' : ''} almost the same</span>` : ''}</h3>${act('audit', 'Again', { cls: 'mini' })}</div>
    ${A.near.map((k, i) => `<div class="line"><span>${k.map((c) => swatch(c.hex)).join('')}</span><span class="grow small">${esc(words(k[0].rgb))}: ${k.map((c) => c.hex).join(', ')} — hard to tell apart</span>${act('anear', 'Select', { arg: i, cls: 'mini' })}</div>`).join('')}
    ${A.colours.slice(0, 14).map((c, i) => `<div class="line">${swatch(c.hex)}<span class="grow small"><b style="color:var(--t1)">${esc(words(c.rgb))}</b> ${c.hex} · ${[...c.roles].join(', ')} · ${c.count}×</span>${act('acol', 'Select', { arg: i, cls: 'mini' })}</div>`).join('')}</section>`;
}
export const view = () => `${hasEyedropper() ? `<section class="row"><span class="grow small">Pick any colour on your screen: a photo, another app, a site you like.</span>${act('eyedrop', 'Eyedropper', { arg: 'picked', cls: 'mini' })}</section>` : ''}
  ${pickedSection()}${S.sels.length ? selectionHeader() + selectionColours() : ''}${paletteSection()}${auditSection()}`;

// while a knob is dragged, update its swatches in place so the slider keeps the pointer
function patch(kind, id) {
  if (kind === 'col' && id === 'g') {
    S.sels.forEach((s, i) => {
      const d = s.drafts.find((x) => x.prop === S.d.colour.prop), m = $(`.msw.to[data-m="${i}"]`);
      if (d && m) m.style.background = result({ ...d, scope: 'rule' }, S.d.colour.steps, S.d.colour.set).to;
    });
  } else if (kind === 'col') {
    const d = S.sels[0].drafts[+id], r = result(d), b = $(`.card[data-p="${id}"]`);
    if (!b) return;
    b.querySelector('.sw.to').style.background = r.to;
    b.querySelector('.words').textContent = r.toWords;
  } else {
    const t = S.page.tokens[S.openToken], b = $(`.card[data-tok="${CSS.escape(S.openToken)}"]`);
    if (!t || !b) return;
    const v = tokenValue(t);
    b.querySelector('.sw.to').style.background = v.hex;
    b.querySelector('.words').textContent = words(v.rgb);
  }
}

// ---------- controls ----------
function applyColour(target, value) {
  if (target === 'picked') return;
  if (target === 'group') { S.d.colour.set = value; S.d.colour.steps = zero(); }
  else if (target === 'token') { const t = tokenDraft(S.openToken); t.set = value; t.steps = zero(); }
  else if (target.startsWith('sel:')) { const d = S.sels[0].drafts[+target.slice(4)]; d.set = value; d.steps = zero(); }
  render();
}
Object.assign(actions, {
  eyedrop: async (target) => { const v = await eyedrop(); if (v) applyColour(target, v); },
  usepicked: (p) => {
    if (p === 'token') return applyColour('token', S.picked);
    if (groupMode()) { S.d.colour.prop = p; return applyColour('group', S.picked); }
    const i = S.sels[0].drafts.findIndex((d) => d.prop === p);
    if (i >= 0) applyColour('sel:' + i, S.picked);
  },
  clearpicked: () => { S.picked = null; render(); },
  gprop: (p) => { S.d.colour.prop = p; S.d.colour.steps = zero(); S.d.colour.set = null; render(); },
  colreset: (i) => { if (i === 'g') { S.d.colour.steps = zero(); S.d.colour.set = null; } else { const d = S.sels[0].drafts[+i]; d.steps = zero(); d.set = null; } render(); },
  token: (key) => { S.openToken = S.openToken === key ? null : key; render(); },
  tokrefresh: () => { tokens(true); render(); },
  tokreset: () => { delete S.page.tokens[S.openToken]; render(); },
  harm: (h) => applyColour('token', h),
  audit: () => { S.audit = runAudit(); render(); },
  anear: (i) => { const k = S.audit.near[+i]; selectMany(k.flatMap((x) => x.els).slice(0, 40), `the colour audit: near-identical colours ${k.map((x) => x.hex).join(', ')}`, k.map((x) => x.hex)); },
  acol: (i) => { const x = S.audit.colours[+i]; selectMany(x.els, `the colour audit: everything using ${x.hex}`, [x.hex]); },
});
inputs.col = (el) => {
  const [id, k] = el.dataset.arg.split('|');
  (id === 'g' ? S.d.colour.steps : S.sels[0].drafts[+id].steps)[k] = +el.value;
  updatePreview(); patch('col', id);
};
inputs.tok = (el) => { tokenDraft(S.openToken).steps[el.dataset.arg.split('|')[1]] = +el.value; updatePreview(); patch('tok'); };
Object.assign(changes, {
  scope: (el) => { S.sels[0].drafts[+el.dataset.arg].scope = el.value; render(); },
  tokhex: (el) => { const c = parse(el.value.trim()); if (c) applyColour('token', hex(c)); },
});
