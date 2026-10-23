// Style's Text tab: how the type sits. Size from the page's own scale (the sizes it already uses), weight, line
// height, letter spacing, capitals and alignment. Each shows at once and is kept on the pin as before → after.
import { esc } from './core.js';

export const LABEL = { 'font-size': 'text size', 'font-weight': 'weight', 'line-height': 'line height', 'letter-spacing': 'letter spacing', 'text-transform': 'capitals', 'text-align': 'alignment' };

// the sizes the page uses, smallest first (its type scale, as built)
export function scale() {
  const seen = new Map();
  for (const el of [...document.querySelectorAll('body *')].slice(0, 800)) {
    if (el.closest('unide-overlay') || !el.firstChild || ![...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())) continue;
    const px = Math.round(parseFloat(getComputedStyle(el).fontSize));
    if (px) seen.set(px, (seen.get(px) || 0) + 1);
  }
  return [...seen.keys()].sort((a, b) => a - b).slice(0, 12);
}
const em = (cs) => { const ls = cs.letterSpacing; return ls === 'normal' ? 0 : Math.round((parseFloat(ls) / parseFloat(cs.fontSize)) * 100) / 100; };
const lh = (cs) => (cs.lineHeight === 'normal' ? 1.2 : Math.round((parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)) * 100) / 100);

export function typePanel(e, el) {
  const k = e.k, cs = getComputedStyle(el), size = Math.round(parseFloat(cs.fontSize)), sizes = [...new Set([...scale(), size])].sort((a, b) => a - b);
  const w = +cs.fontWeight, tt = cs.textTransform, ta = cs.textAlign === 'start' ? 'left' : cs.textAlign, changed = Object.entries(e.edits?.type || {});
  const chip = (prop, v, label, cur) => `<button class="mini ${cur ? 'on' : ''}" data-act="tset" data-arg="${k}|${prop}|${v}">${label}</button>`;
  return `<div class="typetool" data-k="${k}">
    <div class="small">Size · ${size}px <span class="soft">(from this page's sizes)</span></div>
    <div class="row wrap">${chip('font-size', 'down', '−', false)}${sizes.map((s) => chip('font-size', s + 'px', s, s === size)).join('')}${chip('font-size', 'up', '+', false)}</div>
    <div class="small">Weight · ${w}</div>
    <div class="row wrap">${[300, 400, 500, 600, 700, 800].map((x) => chip('font-weight', x, x, x === w)).join('')}</div>
    <label class="small">Line height · <b data-out="line-height">${lh(cs)}</b><input type="range" min="0.9" max="2.2" step="0.05" value="${lh(cs)}" data-in="ttrack" data-ch="ttrackdone" data-prop="line-height"></label>
    <label class="small">Letter spacing · <b data-out="letter-spacing">${em(cs)}em</b><input type="range" min="-0.06" max="0.3" step="0.01" value="${em(cs)}" data-in="ttrack" data-ch="ttrackdone" data-prop="letter-spacing"></label>
    <div class="small">Capitals</div>
    <div class="row wrap">${[['none', 'As typed'], ['uppercase', 'UPPER'], ['lowercase', 'lower'], ['capitalize', 'Title']].map(([v, l]) => chip('text-transform', v, l, tt === v)).join('')}</div>
    <div class="small">Alignment</div>
    <div class="row wrap">${['left', 'center', 'right'].map((v) => chip('text-align', v, v, ta === v)).join('')}</div>
    ${changed.length ? `<div class="small changed">${changed.map(([p, c]) => `${LABEL[p]} ${esc(c.from)} → ${esc(c.to)}`).join(' · ')} · <button class="link" data-act="treset" data-arg="${k}">put it back</button></div>` : ''}
  </div>`;
}

// one change; size steps move along the page's scale
export function set(e, el, prop, value, original) {
  const cs = getComputedStyle(el);
  let v = value;
  if (prop === 'font-size' && (value === 'up' || value === 'down')) {
    const now = Math.round(parseFloat(cs.fontSize)), s = scale();
    const next = value === 'up' ? s.find((x) => x > now) ?? now + 2 : [...s].reverse().find((x) => x < now) ?? Math.max(8, now - 2);
    v = next + 'px';
  }
  if (prop === 'line-height') v = String(value);
  if (prop === 'letter-spacing') v = `${value}em`;
  e.edits ||= {}; const t = e.edits.type ||= {};
  const from = t[prop]?.from ?? norm(prop, original(el, prop), cs);
  if (String(from) === String(v)) delete t[prop]; else t[prop] = { from, to: String(v) };
  if (!Object.keys(t).length) delete e.edits.type;
}
// what it is in the code today, said plainly
function norm(prop, v, cs) {
  if (prop === 'line-height') return v === 'normal' ? 'normal' : String(Math.round((parseFloat(v) / parseFloat(cs.fontSize)) * 100) / 100);
  if (prop === 'letter-spacing') return v === 'normal' ? '0em' : `${Math.round((parseFloat(v) / parseFloat(cs.fontSize)) * 100) / 100}em`;
  if (prop === 'text-align') return v === 'start' ? 'left' : v;
  if (prop === 'font-size') return `${Math.round(parseFloat(v))}px`;
  return v;
}
