// Type: the picked element's type, a type scale for the page, fonts to try, and the type audit.
import { S, esc, actions, changes, render } from './core.js';
import { px } from './colour.js';
import { groupMode, selectMany } from './selection.js';
import { RATIOS, scaleSteps, scaleMapping, setScale, FONTS, setFonts } from './page.js';
import { runAudit } from './audit.js';
import { act, sources, selectionHeader } from './ui.js';

function selectionType() {
  if (!S.sels.length || groupMode()) return '';
  const s = S.sels[0], cs = getComputedStyle(s.el); // as it looks now, with what you're trying
  const row = (label, value, prop) => `<div class="line"><span class="grow"><b>${label}</b> <span class="small">${esc(value)}</span></span>${s.style[prop] ? `<code>${esc(s.style[prop])}</code>` : ''}</div>`;
  return `<section><h3>This element's type</h3>
    ${row('Size', cs.fontSize, 'font-size')}${row('Weight', cs.fontWeight, 'font-weight')}
    ${row('Typeface', cs.fontFamily.split(',')[0].replace(/["']/g, ''), 'font-family')}
    ${row('Line height', cs.lineHeight === 'normal' ? 'normal' : `${cs.lineHeight} (${(px(cs.lineHeight) / px(cs.fontSize)).toFixed(2)}× the size)`, 'line-height')}
    ${row('Tracking (letter-spacing)', cs.letterSpacing, '')}
    ${s.style['font-size'] ? `<details style="margin-top:6px"><summary><span class="small">Where the size is set ▾</span></summary>${sources(s.style['font-size'])}</details>` : ''}</section>`;
}
function scaleSection() {
  const sc = S.page.scale;
  if (!sc) return `<section><h3>Type scale</h3><div class="small">A scale is a short list of sizes where each is the last one times a fixed ratio. Snapping every text size to it removes the near-duplicates and makes the hierarchy clearer.</div>
    <div class="actions">${act('scaleon', 'Try a type scale')}</div></section>`;
  const steps = scaleSteps(sc.base, sc.ratio), rows = scaleMapping(), moving = rows.filter((r) => r.to !== r.from);
  return `<section><h3>Type scale</h3>
    <div class="row"><span class="small">Base</span><input type="number" step="0.5" min="8" value="${sc.base}" data-ch="scalebase"><span class="small">px · ratio</span>
      <select data-ch="scaleratio">${RATIOS.map(([r, label]) => `<option value="${r}" ${r === sc.ratio ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></div>
    <div class="small" style="margin-top:8px">Steps: ${steps.map((v) => `<b style="color:${v === sc.base ? 'var(--acc)' : 'var(--t2)'}">${v}</b>`).join(' · ')}</div>
    <div class="small" style="margin-top:8px">${moving.length} of ${rows.length} sizes move:</div>
    ${rows.map((r) => `<div class="line small"><span class="grow">${r.from}px → <b style="color:${r.to === r.from ? 'var(--t3)' : 'var(--t1)'}">${r.to}px</b></span><span>${r.count}×</span></div>`).join('')}
    <div class="actions">${act('scaleoff', 'Stop trying', { cls: 'mini' })}</div></section>`;
}
function fontsSection() {
  const f = S.page.fonts, cur = (role) => f?.[role] || '';
  const select = (role) => `<select data-ch="font" data-arg="${role}"><option value="">Keep current${f?.was?.[role] ? ` (${esc(f.was[role])})` : ''}</option>
    ${Object.entries(FONTS).map(([g, list]) => `<optgroup label="${g}">${list.map((n) => `<option ${n === cur(role) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join('')}
    ${cur(role) && !Object.values(FONTS).flat().includes(cur(role)) ? `<option selected>${esc(cur(role))}</option>` : ''}</select>`;
  return `<section><h3>Fonts</h3>
    <div class="small">Try typefaces from Google Fonts (needs an internet connection). Code and monospace text stay as they are.</div>
    <div class="line"><span class="grow"><b>Headings</b></span>${select('heading')}</div>
    <div class="line"><span class="grow"><b>Body text</b></span>${select('body')}</div>
    <div class="row" style="margin-top:6px"><input type="text" placeholder="Any Google font, e.g. Sora" data-ch="fontcustom" style="flex:1"><span class="small">for</span>
      <select data-ch="fontrole"><option value="body">body</option><option value="heading">headings</option></select></div>
    ${f ? `<div class="actions">${act('fontsclear', 'Stop trying', { cls: 'mini' })}</div>` : ''}</section>`;
}
function auditSection() {
  const A = S.audit;
  if (!A) return `<section><h3>Type audit</h3><div class="small">Every text size on the page, with sizes that are almost the same flagged.</div><div class="actions">${act('audit', 'Check type')}</div></section>`;
  return `<section><div class="row"><h3 class="grow" style="margin:0">Type audit — ${A.sizes.length} sizes${A.close.length ? `, <span class="warn">${A.close.length} pair${A.close.length > 1 ? 's' : ''} within 1px</span>` : ''}</h3>${act('audit', 'Again', { cls: 'mini' })}</div>
    ${A.close.length ? `<div class="small warn" style="margin:6px 0">${A.close.map(([a, b]) => `${a}px and ${b}px are almost the same`).join(' · ')}</div>` : ''}
    ${A.types.slice(0, 16).map((t, i) => `<div class="line"><span class="grow small"><b style="color:var(--t1)">${t.size}px</b> · weight ${t.weight} · ${esc(t.family)} · ${t.count}×</span>${act('atype', 'Select', { arg: i, cls: 'mini' })}</div>`).join('')}</section>`;
}
export const view = () => `${S.sels.length ? selectionHeader() + selectionType() : ''}${scaleSection()}${fontsSection()}${auditSection()}`;

// ---------- controls ----------
let customRole = 'body';
Object.assign(actions, {
  scaleon: () => { setScale(true); render(); },
  scaleoff: () => { setScale(false); render(); },
  fontsclear: () => { setFonts('', ''); render(); },
  atype: (i) => { const x = S.audit.types[+i]; selectMany(x.els, `the type audit: all ${x.size}px / ${x.weight} text`); },
});
Object.assign(changes, {
  scalebase: (el) => { const v = parseFloat(el.value); if (v > 0) { S.page.scale.base = v; render(); } },
  scaleratio: (el) => { S.page.scale.ratio = +el.value; render(); },
  font: (el) => { const f = S.page.fonts || {}; setFonts(el.dataset.arg === 'heading' ? el.value : f.heading || '', el.dataset.arg === 'body' ? el.value : f.body || ''); render(); },
  fontrole: (el) => { customRole = el.value; },
  fontcustom: (el) => {
    const name = el.value.trim();
    if (!name) return;
    const f = S.page.fonts || {};
    setFonts(customRole === 'heading' ? name : f.heading || '', customRole === 'body' ? name : f.body || '');
    render();
  },
});
