// Snapshots to compare versions, reference images you like, and colours picked from the screen.
// Snapshots and references are saved by the server under unide/store/, never in your project.
import { S, pageState, render, api } from './core.js';
import { keptCss, draftCss, updatePreview } from './preview.js';
import { hex, parse } from './colour.js';

// ---------- snapshots: a recipe (your previews and requests), re-applied live, not a picture ----------
export async function loadStore() {
  try { S.snapshots = await api('store?key=snapshots'); } catch { S.snapshots = []; }
  try { S.refs = await api('store?key=refs'); } catch { S.refs = []; }
  render();
}
const saveSnapshots = () => api('store?key=snapshots', S.snapshots.map(({ id, name, at, state, css, items }) => ({ id, name, at, state, css, items })));
export function snapshot(name) {
  S.snapshots.push({ id: Date.now().toString(36), name: name || `Version ${S.snapshots.length + 1}`, at: new Date().toISOString(), state: pageState(),
    css: [keptCss(), draftCss(['selection', 'page'])].filter(Boolean).join('\n'), items: JSON.parse(JSON.stringify(S.items)) });
  saveSnapshots(); render();
}
export function viewSnapshot(id) { S.viewing = id ? S.snapshots.find((s) => s.id === id) : null; updatePreview(); render(); }
export function useSnapshot(id) {
  const s = S.snapshots.find((x) => x.id === id);
  if (!s) return;
  S.items = JSON.parse(JSON.stringify(s.items)); S.viewing = null; render();
}
export function deleteSnapshot(id) { S.snapshots = S.snapshots.filter((s) => s.id !== id); if (S.viewing?.id === id) S.viewing = null; saveSnapshots(); updatePreview(); render(); }

// ---------- references ----------
const saveRefs = () => api('store?key=refs', S.refs);
function shrink(file, max = 1400) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
export async function addRefs(files) {
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    const r = await api('ref', { data: await shrink(f), name: f.name });
    S.refs.push({ id: r.id, file: r.file, url: r.url, name: f.name, note: '', colours: [] });
  }
  S.openRef = S.refs.at(-1)?.id || null;
  saveRefs(); render();
}
export const setRefNote = (id, note) => { const r = S.refs.find((x) => x.id === id); if (r) { r.note = note; saveRefs(); } };
export function deleteRef(id) { S.refs = S.refs.filter((r) => r.id !== id); if (S.openRef === id) S.openRef = null; saveRefs(); render(); }
// clicking the open reference picks the colour under the pointer
export function pickFromRef(img, e) {
  const c = document.createElement('canvas'), r = img.getBoundingClientRect();
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const x = Math.floor(((e.clientX - r.left) / r.width) * c.width), y = Math.floor(((e.clientY - r.top) / r.height) * c.height);
  const d = g.getImageData(x, y, 1, 1).data, h = hex([d[0], d[1], d[2]]);
  const ref = S.refs.find((x) => x.id === S.openRef);
  if (ref && !ref.colours.includes(h)) { ref.colours.push(h); saveRefs(); }
  S.picked = h; render();
}

// ---------- the eyedropper: any colour on your screen (Chrome and Edge) ----------
export const hasEyedropper = () => 'EyeDropper' in window;
export async function eyedrop() {
  if (!hasEyedropper()) return null;
  try { const { sRGBHex } = await new window.EyeDropper().open(); S.picked = parse(sRGBHex) ? hex(parse(sRGBHex)) : sRGBHex; render(); return S.picked; } catch { return null; }
}
