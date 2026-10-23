// The page at phone, tablet and laptop sizes, side by side, each live: ⌥-click in any of them to pin there. Each is
// the same page in a frame of that size (scaled down to fit); its pins say which size they were made at.
import { root, esc } from './core.js';

export const SIZES = [{ id: 'phone', label: 'Phone', w: 390, h: 844 }, { id: 'tablet', label: 'Tablet', w: 820, h: 1180 }, { id: 'laptop', label: 'Laptop', w: 1280, h: 800 }];
// inside one of the frames: unide's bar stays out (the page's own bar is outside), pins still work
export const framed = () => /^unide-size:/.test(window.name || '');
export const frameName = () => (framed() ? window.name.slice(11) : null);

const view = Object.assign(document.createElement('div'), { className: 'sizes' });
export const isOpen = () => view.isConnected;
export function open() {
  if (isOpen()) return close();
  const availH = innerHeight - 110, gap = 22;
  // the frames share the width; each is scaled so it fits
  const raw = SIZES.map((s) => ({ ...s, k: Math.min(1, availH / s.h) }));
  const total = raw.reduce((n, s) => n + s.w * s.k, 0) + gap * (SIZES.length - 1), fit = Math.min(1, (innerWidth - 48) / total);
  view.innerHTML = `<div class="sizesbar"><b>Sizes</b><span class="small">⌥-click inside any of them to pin there · each pin says its size</span><span class="grow"></span><button class="x" data-act="sizes" title="Close (Esc)">×</button></div>
    <div class="sizesrow">${raw.map((s) => { const k = Math.max(0.4, s.k * fit); /* never so small you can't aim: the row scrolls sideways instead */ return `<figure style="width:${Math.round(s.w * k)}px"><figcaption>${s.label} · ${s.w} × ${s.h}</figcaption>
      <div class="sizebox" style="width:${Math.round(s.w * k)}px;height:${Math.round(s.h * k)}px"><iframe name="unide-size:${s.id}" src="${esc(location.href)}" style="width:${s.w}px;height:${s.h}px;transform:scale(${k})" title="${s.label}"></iframe></div></figure>`; }).join('')}</div>`;
  root.append(view);
}
export function close() { view.remove(); view.innerHTML = ''; }
addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); close(); } }, true);
