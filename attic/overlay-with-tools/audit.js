// Looking across the whole page: every colour and text size, near-duplicates, and edges that almost line up.
import { parse, hex, oklabDist, px, round } from './colour.js';
import { visible, ownText } from './dom.js';
import { clean } from './preview.js';

export function runAudit() {
  return clean(() => {
    const cols = new Map(), types = new Map();
    const add = (str, role, el) => {
      const c = parse(str);
      if (!c || c[3] < 0.05) return;
      const k = hex(c);
      const e = cols.get(k) || { hex: k, rgb: c.slice(0, 3), count: 0, roles: new Set(), els: [] };
      e.count++; e.roles.add(role); if (e.els.length < 40) e.els.push(el);
      cols.set(k, e);
    };
    for (const el of [...document.body.querySelectorAll('*')].slice(0, 4000)) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      add(cs.backgroundColor, 'background', el);
      if (px(cs.borderTopWidth) && cs.borderTopStyle !== 'none') add(cs.borderTopColor, 'border', el);
      if (ownText(el)) {
        add(cs.color, 'text', el);
        const k = `${px(cs.fontSize)}|${cs.fontWeight}|${cs.fontFamily.split(',')[0].replace(/["']/g, '')}`;
        const t = types.get(k) || { size: px(cs.fontSize), weight: cs.fontWeight, family: k.split('|')[2], count: 0, els: [] };
        t.count++; if (t.els.length < 40) t.els.push(el);
        types.set(k, t);
      }
    }
    const all = [...cols.values()].sort((a, b) => b.count - a.count);
    const clusters = [];
    for (const c of all) {
      const home = clusters.find((k) => oklabDist(k[0].rgb, c.rgb) < 0.03);
      home ? home.push(c) : clusters.push([c]);
    }
    const ts = [...types.values()].sort((a, b) => b.size - a.size || b.count - a.count);
    const sizes = [...new Set(ts.map((t) => t.size))].sort((a, b) => b - a);
    const close = sizes.flatMap((s, i) => (i && sizes[i - 1] - s > 0 && sizes[i - 1] - s <= 1 ? [[sizes[i - 1], s]] : []));
    return { colours: all, near: clusters.filter((k) => k.length > 1), types: ts, sizes, close };
  });
}

// edges that almost line up (1–4px apart) between nearby elements
export function findAlignment() {
  return clean(() => {
    const els = [...document.body.querySelectorAll('*')].filter((el) => {
      if (!visible(el)) return false;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el), bg = parse(cs.backgroundColor);
      return r.width >= 12 && r.height >= 8 && r.width < innerWidth * 0.9 && (ownText(el) || (bg && bg[3] > 0.05) || px(cs.borderTopWidth));
    }).slice(0, 900).map((el) => ({ el, r: el.getBoundingClientRect() }));
    const out = [], seen = new Set();
    for (const edge of ['left', 'right']) {
      const sorted = [...els].sort((a, b) => a.r[edge] - b.r[edge]);
      for (let i = 0; i < sorted.length && out.length < 40; i++) {
        for (let j = i + 1; j < sorted.length && sorted[j].r[edge] - sorted[i].r[edge] <= 4; j++) {
          const a = sorted[i], b = sorted[j], delta = round(b.r[edge] - a.r[edge]);
          if (delta < 1 || a.el.contains(b.el) || b.el.contains(a.el)) continue;
          if (Math.abs(a.r.top - b.r.top) > 300) continue;
          const key = `${edge}${Math.round(a.r[edge])}|${Math.round(b.r[edge])}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ a: a.el, b: b.el, edge, delta });
        }
      }
    }
    return out;
  });
}
