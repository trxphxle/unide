// Measurements read from the live page: what the agent can't see from the code.
import { host } from './core.js';
import { parse, hex, words, contrast, px } from './colour.js';
import { effectiveBg } from './dom.js';

export function facts(el) {
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  const bg = parse(cs.backgroundColor), fg = parse(cs.color);
  return {
    size: `${Math.round(r.width)}×${Math.round(r.height)}px`,
    bg: bg && bg[3] > 0.05 ? `${words(bg)} ${hex(bg)}` : 'no background',
    fg: fg ? words(fg) : '?',
    font: `${px(cs.fontSize)}px, weight ${cs.fontWeight}, ${cs.fontFamily.split(',')[0].replace(/["']/g, '')}`,
    pad: cs.padding, radius: cs.borderRadius,
  };
}
export const factLine = (f) => `${f.size}; background ${f.bg}; text ${f.fg}; ${f.font}; padding ${f.pad}${f.radius !== '0px' ? `; radius ${f.radius}` : ''}`;
export const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

// is there something else in the space between two neighbours? then it isn't an empty gap
function occupied(a, b, x, y) {
  for (const e of document.elementsFromPoint(x, y)) {
    if (e === host || host.contains(e)) continue;
    return !(e.contains(a) && e.contains(b));
  }
  return false;
}
// neighbours in reading order and the space between them
export function gapPairs(els) {
  const rs = els.map((el, i) => ({ i, r: el.getBoundingClientRect() })).sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left);
  const out = [];
  for (let k = 1; k < rs.length; k++) {
    const a = rs[k - 1], b = rs[k];
    const v = Math.round(b.r.top - a.r.bottom), h = Math.round(b.r.left - a.r.right);
    const dir = v >= 0 ? 'v' : h >= 0 ? 'h' : null, gap = v >= 0 ? v : h >= 0 ? h : 0;
    const x = dir === 'v' ? (Math.max(a.r.left, b.r.left) + Math.min(a.r.right, b.r.right)) / 2 : (a.r.right + b.r.left) / 2;
    const y = dir === 'v' ? (a.r.bottom + b.r.top) / 2 : (Math.max(a.r.top, b.r.top) + Math.min(a.r.bottom, b.r.bottom)) / 2;
    const between = gap > 1 && occupied(els[a.i], els[b.i], x, y);
    out.push({ a: a.i, b: b.i, ra: a.r, rb: b.r, dir, px: gap, between, empty: !!dir && !between });
  }
  return out;
}
export const gapWords = (pairs) => pairs.map((p) => `${p.a + 1}→${p.b + 1}: ${p.dir === 'v' ? `${p.px}px below` : p.dir === 'h' ? `${p.px}px to the right` : 'overlapping'}${p.between ? ' (other content between)' : ''}`);

// how strongly an element pulls the eye: size, weight and contrast (an estimate)
export function weightOf(el) {
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  const fg = parse(cs.color) || [0, 0, 0, 1], bg = parse(cs.backgroundColor), under = effectiveBg(el.parentElement || el);
  const own = bg && bg[3] > 0.05 ? bg : null;
  const textC = contrast(fg, own || under), boxC = own ? contrast(own, under) : 1;
  return (px(cs.fontSize) / 14) ** 1.5 * ((+cs.fontWeight || 400) / 400) * Math.sqrt(textC) * (1 + Math.log(boxC)) * Math.sqrt(Math.sqrt(r.width * r.height) / 40);
}
