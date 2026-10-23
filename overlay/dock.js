// Where unide's bar sits. By itself: a corner with none of the page's own controls under it, checked again as the
// page changes (a game's zoom buttons, a chat box, a cookie banner). Or wherever you drag it by "unide", remembered
// for this site; double-click "unide" to let it choose again. The pins list, toasts and banners follow it.
// Idle, it's a dot ("u" and the pin count) so it covers next to nothing; it opens into the full bar while you
// point at it, hold ⌥, have a pin or the pins list or Tools open, or have Freeze on.
import { $, host, setInterval, setTimeout } from './core.js';

const KEY = 'unide:bar', M = 12;
const CONTROL = 'a[href], button, input, select, textarea, summary, label, [role=button], [role=link], [role=tab], [role=slider], [role=switch], [role=menuitem], [role=checkbox], [onclick], [contenteditable=""], [contenteditable=true], [tabindex]:not([tabindex="-1"])';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const write = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch { /* no storage here */ } };

// a spot: which edges it's measured from and how far
const corner = (c) => ({ h: c[1], v: c[0], dx: M, dy: M });
function rectFor(s, w, h) {
  const left = s.h === 'l' ? s.dx : innerWidth - w - s.dx, top = s.v === 'b' ? innerHeight - h - s.dy : s.dy;
  return { left, top, right: left + w, bottom: top + h };
}
// any of the page's controls under this area (sampled on a grid; a full-screen canvas or backdrop isn't a control)
// strict: anything at all there (text too), not only controls
function busy(r, strict = false) {
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 2; j++) {
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + ((r.right - r.left) * i) / 8));
    const y = Math.min(innerHeight - 1, Math.max(0, r.top + ((r.bottom - r.top) * j) / 2));
    for (const el of document.elementsFromPoint(x, y)) {
      if (el === host || el === document.body || el === document.documentElement) continue;
      // something as big as a good part of the screen (a 3D canvas you can tab to, a backdrop) isn't a control
      const big = (x) => { const b = x.getBoundingClientRect(); return b.width * b.height > innerWidth * innerHeight * 0.25; };
      if (big(el)) break;
      if (strict) return true;
      const c = el.closest(CONTROL);
      if (c && !big(c)) return true;
      if (getComputedStyle(el).cursor === 'pointer') return true;
    }
  }
  return false;
}

let spot = null;
// why the bar is open right now; none left, and it folds back into the dot
const open = new Set();
let fold = null;
export function expand(reason, on) {
  on ? open.add(reason) : open.delete(reason);
  const bar = $('.bar');
  if (!bar) return;
  clearTimeout(fold);
  if (open.size) bar.classList.remove('mini');
  else fold = setTimeout(() => { if (!open.size) bar.classList.add('mini'); }, 500);
}
function apply(s) {
  const bar = $('.bar');
  if (!bar) return;
  spot = s;
  Object.assign(bar.style, s.h === 'l' ? { left: s.dx + 'px', right: 'auto' } : { right: s.dx + 'px', left: 'auto' });
  Object.assign(bar.style, s.v === 'b' ? { bottom: s.dy + 'px', top: 'auto' } : { top: s.dy + 'px', bottom: 'auto' });
  host.dataset.h = s.h; host.dataset.v = s.v;
  host.style.setProperty('--bar-x', s.dx + 'px');
  host.style.setProperty('--bar-y', s.dy + bar.offsetHeight + 8 + 'px');
}
// the first corner that's free, keeping the current one while it stays free
function choose() {
  const bar = $('.bar');
  // only the dot is placed: not while the bar is open (you're using it) or about to fold
  if (!bar || read() || dragging || open.size || !bar.classList.contains('mini')) return;
  const w = bar.offsetWidth, h = bar.offsetHeight;
  if (spot && !busy(rectFor(spot, w, h))) return;
  // a corner with nothing under it, else one with no controls under it
  const all = ['bl', 'br', 'tl', 'tr'].map(corner);
  const free = all.find((s) => !busy(rectFor(s, w, h), true)) || all.find((s) => !busy(rectFor(s, w, h)));
  apply(free || spot || corner('bl'));
}

let dragging = null;
export function startDock() {
  const bar = $('.bar'), brand = $('.bar .brand');
  if (!bar || !brand) return;
  brand.title = 'Drag to move the bar · double-click to let it find a free corner';
  brand.style.cursor = 'grab';
  bar.classList.add('mini');
  bar.addEventListener('pointerenter', () => expand('hover', true));
  bar.addEventListener('pointerleave', () => expand('hover', false));
  apply(read() || corner('bl'));
  choose();
  setInterval(choose, 1500);
  addEventListener('resize', () => (read() ? apply(read()) : choose()));
  brand.addEventListener('pointerdown', (e) => {
    const r = bar.getBoundingClientRect();
    dragging = { dx: e.clientX - r.left, dy: e.clientY - r.top, x: e.clientX, y: e.clientY, moved: false };
    brand.style.cursor = 'grabbing';
    e.preventDefault();
  });
  addEventListener('pointermove', (e) => {
    if (!dragging) return;
    if (!dragging.moved && Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y) < 4) return;
    dragging.moved = true;
    const w = bar.offsetWidth, h = bar.offsetHeight;
    const left = Math.min(innerWidth - w - 4, Math.max(4, e.clientX - dragging.dx)), top = Math.min(innerHeight - h - 4, Math.max(4, e.clientY - dragging.dy));
    // measured from the nearer edges, so it stays put when the window is resized
    const s = { h: left + w / 2 < innerWidth / 2 ? 'l' : 'r', v: top + h / 2 < innerHeight / 2 ? 't' : 'b' };
    s.dx = Math.round(s.h === 'l' ? left : innerWidth - w - left); s.dy = Math.round(s.v === 't' ? top : innerHeight - h - top);
    apply(s);
  }, true);
  addEventListener('pointerup', () => {
    if (!dragging) return;
    const moved = dragging.moved;
    dragging = null; brand.style.cursor = 'grab';
    if (moved) write(spot);
  }, true);
  brand.addEventListener('dblclick', () => { write(null); spot = null; choose(); });
}
