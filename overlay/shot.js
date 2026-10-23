// A picture of the pinned area as you saw it, taken from the live page the moment you pin, so the agent can see
// what words and measurements can't say (an icon's empty space, text on a photo, something under a sticky bar).
// The page is drawn from its DOM (snapDOM), not grabbed from the screen: no permission prompt, and unide's own
// overlay is never in it. Things fixed or stuck to the viewport are drawn where they are on screen.
import { host } from './core.js';
import { grab } from './three.js';
import { INK } from './styles.js';

let lib;
const snap = () => (lib ||= import('./snapdom.js').then((m) => m.snapdom));
const up = (e) => e.parentElement || e.getRootNode?.()?.host || null;
const inside = (a, b) => a.left <= b.left + 0.5 && a.top <= b.top + 0.5 && a.right >= b.right - 0.5 && a.bottom >= b.bottom - 0.5;
const meets = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

// the area: the target with room around it, at least 360×220, kept to what's on screen
function area(r) {
  const w = Math.max(r.width + 64, 360), h = Math.max(r.height + 64, 220);
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let left = Math.max(0, cx - w / 2), top = Math.max(0, cy - h / 2);
  const right = Math.min(innerWidth, left + w), bottom = Math.min(innerHeight, top + h);
  left = Math.max(0, Math.min(left, right - w)); top = Math.max(0, Math.min(top, bottom - h));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}
// elements drawn relative to the viewport rather than the page: drawn on their own, where they are now
function pinnedToScreen() {
  const out = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (el === host) continue;
      if (el.shadowRoot) walk(el.shadowRoot);
      const pos = getComputedStyle(el).position;
      if (pos === 'fixed' || pos === 'sticky') out.push(el);
    }
  };
  walk(document);
  // the outermost of nested ones carries the inner ones; paint lower z-index first
  const z = (el) => { const v = parseInt(getComputedStyle(el).zIndex, 10); return Number.isNaN(v) ? 0 : v; };
  return out.filter((el) => !out.some((o) => o !== el && o.contains(el))).map((el, i) => ({ el, i, z: z(el) })).sort((a, b) => a.z - b.z || a.i - b.i).map((x) => x.el);
}
const bgOf = () => {
  for (const e of [document.body, document.documentElement]) {
    const c = e && getComputedStyle(e).backgroundColor;
    if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
  }
  return '#fff';
};

// closed shadow roots are drawn too: for the length of the capture their hosts show them (early.js kept them)
function openClosedRoots(layer) {
  const E = window.__unideEarly, opened = [];
  for (const ref of E?.closedHosts || []) {
    const h = ref.deref();
    if (!h?.isConnected || !(layer.contains(h) || layer.shadowRoot?.contains(h))) continue;
    Object.defineProperty(h, 'shadowRoot', { get: () => E.closed.get(h), configurable: true });
    opened.push(h);
  }
  // and unide's own bar inside same-origin frames stays out of the picture
  const hidden = [];
  for (const f of layer.querySelectorAll('iframe')) {
    if (f.sandbox?.length && !f.sandbox.contains('allow-same-origin')) continue; // closed to us (asking makes Safari log an error)
    let o = null;
    try { o = f.contentDocument?.querySelector('unide-overlay'); } catch { /* another origin */ }
    if (o) { hidden.push([o, o.style.visibility]); o.style.visibility = 'hidden'; }
  }
  return () => { for (const h of opened) delete h.shadowRoot; for (const [o, v] of hidden) o.style.visibility = v; };
}

// el: the pinned element; target: the rect to outline (a word or the element). Returns a PNG data URL.
export async function shoot(el, target = el.getBoundingClientRect(), shape = null) {
  const snapdom = await snap();
  const crop = area(target);
  if (crop.width < 4 || crop.height < 4) return null;
  // the page under the area: the smallest box around the element that holds all of it, without what's fixed
  // or stuck to the screen (the page's own drawing would put those where they'd be without scrolling)
  const screenEls = pinnedToScreen(), skip = new Set([host, ...screenEls]);
  let base = el;
  while (base && (screenEls.some((s) => s.contains(base)) || !inside(base.getBoundingClientRect(), crop))) base = up(base);
  if (!base || base === document.documentElement) base = document.body;
  // then what's on the screen, where it is now, lower z-index first
  const layers = [base, ...screenEls.filter((s) => meets(s.getBoundingClientRect(), crop))];
  let dpr = Math.min(2, devicePixelRatio || 1);
  const out = document.createElement('canvas');
  out.width = Math.round(crop.width * dpr); out.height = Math.round(crop.height * dpr);
  const g = out.getContext('2d');
  g.fillStyle = bgOf(); g.fillRect(0, 0, out.width, out.height);
  // 3D canvases keep no picture between frames: give the copy one drawn just now
  const fresh = [];
  for (const r of window.__unideEarly?.three?.renderers || []) {
    const c = r.canvas, d = c?.isConnected && meets(c.getBoundingClientRect(), crop) && grab(c);
    if (d) { c.toDataURL = () => d; fresh.push(c); }
  }
  try {
  for (const layer of layers) {
    const r = layer.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const scale = r.width * r.height * dpr * dpr > 6e7 || Math.max(r.width, r.height) * dpr > 16000 ? 1 : dpr;
    let c;
    const open = openClosedRoots(layer);
    try {
      c = await (await snapdom(layer, { dpr: scale, embedFonts: false, exclude: [(n) => n !== layer && (skip.has(n) || n.tagName === 'UNIDE-OVERLAY')], excludeMode: 'hide' })).toCanvas();
    } catch (err) { console.warn('unide: screenshot', err); continue; } finally { open(); }
    const k = c.width / r.width;
    // the part of this layer inside the area, drawn at its place
    const sx = Math.max(0, crop.left - r.left), sy = Math.max(0, crop.top - r.top);
    const sw = Math.min(r.right, crop.right) - Math.max(r.left, crop.left), sh = Math.min(r.bottom, crop.bottom) - Math.max(r.top, crop.top);
    if (sw <= 0 || sh <= 0) continue;
    g.drawImage(c, sx * k, sy * k, sw * k, sh * k, (Math.max(r.left, crop.left) - crop.left) * dpr, (Math.max(r.top, crop.top) - crop.top) * dpr, sw * dpr, sh * dpr);
  }
  } finally { for (const c of fresh) delete c.toDataURL; }
  // outline what was pinned: a 3D object by its own shape, anything else by a box
  if (shape) {
    g.drawImage(shape.canvas, (shape.rect.left - crop.left) * dpr, (shape.rect.top - crop.top) * dpr, shape.rect.width * dpr, shape.rect.height * dpr);
    return out.toDataURL('image/png');
  }
  const x = (target.left - crop.left) * dpr, y = (target.top - crop.top) * dpr, w = target.width * dpr, h = target.height * dpr;
  // the two inks, a little apart, like the overlay itself
  g.lineWidth = 3 * dpr; g.strokeStyle = INK.blue; g.strokeRect(x - 1 * dpr, y - 1 * dpr, w + 6 * dpr, h + 6 * dpr);
  g.lineWidth = 3 * dpr; g.strokeStyle = INK.pink; g.strokeRect(x - 4 * dpr, y - 4 * dpr, w + 6 * dpr, h + 6 * dpr);
  return out.toDataURL('image/png');
}
