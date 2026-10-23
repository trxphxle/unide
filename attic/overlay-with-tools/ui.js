// Small pieces of panel markup shared by the modes.
import { S, esc, zero } from './core.js';
import { family, parse, hex } from './colour.js';
import { nameOf, likeSelector } from './dom.js';
import { best, groupMode, result } from './selection.js';
import { facts } from './measure.js';
import { clean } from './preview.js';

export const valueLabel = (v) => (+v ? (+v > 0 ? '+' : '') + +v : '0');
// a slider: data-in updates the preview while dragging, data-ch re-renders the panel when released
export function knob(name, arg, value, label, def, left, right, range = 6) {
  return `<div class="knob"><div class="k"><b>${label}</b><span class="muted v">${valueLabel(value)}</span></div>
    <input type="range" min="-${range}" max="${range}" step="1" value="${value}" data-in="${name}" data-ch="rerender" data-arg="${esc(arg)}">
    <div class="ends"><span>← ${left}</span><span>${right} →</span></div><div class="def">${def}</div></div>`;
}
export const colourKnobs = (name, id, st, H) =>
  knob(name, `${id}|L`, st.L, 'Lightness', 'How light or dark. OKLCH “L”.', 'darker', 'lighter')
  + knob(name, `${id}|C`, st.C, 'Chroma', 'How much colour versus grey; often called saturation. OKLCH “C”.', 'more muted', 'more vivid')
  + knob(name, `${id}|H`, st.H, 'Hue', 'Which colour family. OKLCH “H”.', 'toward ' + family((H - 30 + 360) % 360), 'toward ' + family((H + 30) % 360));
export const act = (name, label, { arg = '', cls = '', disabled = false, title = '' } = {}) =>
  `<button data-act="${name}" data-arg="${esc(arg)}" class="${cls}" ${disabled ? 'disabled' : ''} ${title ? `title="${esc(title)}"` : ''}>${label}</button>`;
export const swatch = (c, title = '') => `<span class="msw" style="background:${c}" title="${esc(title || c)}"></span>`;

export function sources(q) {
  const hits = best(q);
  if (!hits || hits === 'loading') return '<div class="small">Looking in the project…</div>';
  if (!hits.length) return '<div class="small">Not found in the project files (it may be built by a script).</div>';
  return `<ul class="src">${hits.map((h) => `<li><code>${esc(h.file)}:${h.line}</code>${h.generated ? ` <span class="gen">generated${h.generated.from ? ` from ${esc(h.generated.from)}` : ''}${h.generated.builders?.length ? ` · build: ${esc(h.generated.builders.join(', '))}` : ''}</span>` : ''}</li>`).join('')}</ul>`;
}

// the chain from the page down to the picked element; a swatch marks the ones with their own background
export let chain = [];
function crumbs(el) {
  chain = [];
  for (let e = el; e && e !== document.documentElement; e = e.parentElement) chain.unshift(e);
  const shown = chain.slice(-7);
  return `<div class="crumbs">${chain.length > shown.length ? '<span class="small">…</span>' : ''}${shown.map((e, i) => {
    const bg = parse(getComputedStyle(e).backgroundColor);
    const sw = bg && bg[3] > 0.05 ? `<span class="dot" style="background:${hex(bg)}"></span>` : '';
    return `<button data-act="crumb" data-arg="${chain.length - shown.length + i}" class="${e === el ? 'cur' : ''}" title="${esc(nameOf(e))}">${sw}${esc(e.tagName.toLowerCase() + (e.classList[0] ? '.' + e.classList[0] : ''))}</button>`;
  }).join('')}</div>`;
}

// what's selected, the same at the top of every mode
export function selectionHeader() {
  if (!S.sels.length) return '';
  if (!groupMode()) {
    const s = S.sels[0], like = likeSelector(s.el), likeN = like ? document.querySelectorAll(like).length : 0;
    return `<section>
      <div class="small">Probably a</div><h2>${esc(s.name)}</h2>
      <div><code>${esc(s.tag)}</code>${s.text ? ` <span class="small">“${esc(s.text)}”</span>` : ''}</div>
      ${crumbs(s.el)}
      <div class="actions">${s.el.firstElementChild ? act('child', '↓ Child', { cls: 'mini' }) : ''}${likeN > 1 ? act('likeall', `Select all ${likeN} like this`, { cls: 'mini' }) : ''}
        <span class="small">Shift+click while picking adds more.</span></div></section>`;
  }
  const c = S.d.colour;
  return `<section><h2>${S.sels.length} elements together</h2>
      ${S.d.origin ? `<div class="small">From ${esc(S.d.origin)}</div>` : ''}
      <details ${S.sels.length <= 6 ? 'open' : ''}><summary><span class="small">Shift+click while picking to add or remove one. Show each ▾</span></summary>
      <ul class="members">${S.sels.map((s, i) => {
        const f = clean(() => facts(s.el)), d = s.drafts.find((x) => x.prop === c.prop);
        const sw = d ? `${swatch(result(d, zero(), null).from)} → <span class="msw to" data-m="${i}" style="background:${result({ ...d, scope: 'rule' }, c.steps, c.set).to}"></span>` : '';
        return `<li><span class="n">${i + 1}</span><div>${esc(s.name)} <code>${esc(s.tag)}</code>${s.text ? ` <span class="small">“${esc(s.text)}”</span>` : ''}</div>${act('unsel', '×', { arg: i, cls: 'x', title: 'Remove from group' })}
          <div class="f">${sw} ${esc(f.bg)} · text ${esc(f.fg)} · ${esc(f.font)} · ${esc(f.size)}</div></li>`;
      }).join('')}</ul></details></section>`;
}
export const nothingPicked = (what) => `<section><div class="muted">Press <b>Pick</b> on the bar, then click part of the page${what ? ` ${what}` : ''}. <b>Shift+click</b> picks several to judge together.</div></section>`;
