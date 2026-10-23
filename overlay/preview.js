// Every preview is one stylesheet: what you kept, plus what you're trying now.
// It survives pages that re-render with innerHTML, and reloading the page drops it.
import { S, preview } from './core.js';

// each module adds { id, css() } returning the CSS for its current draft
export const providers = [];
export const keptCss = () => S.items.map((i) => i.css || '').filter(Boolean).join('\n');
export const draftCss = (only) => providers.filter((p) => !only || only.includes(p.id)).map((p) => p.css()).filter(Boolean).join('\n');
export function updatePreview() {
  preview.textContent = S.viewing ? S.viewing.css : [keptCss(), draftCss()].filter(Boolean).join('\n');
}
// measure the page as kept, without the draft or a forced state
export function clean(fn) {
  const t = preview.textContent;
  preview.textContent = keptCss();
  try { return fn(); } finally { preview.textContent = t; }
}
export function decl(selector, decls) {
  const body = Object.entries(decls).map(([p, v]) => `${p}:${v} !important`).join(';');
  return body ? `${selector}{${body}}` : '';
}
