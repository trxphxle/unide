// Where a CSS rule is written in your source: Sass, CSS Modules, PostCSS and the like are compiled before the
// browser sees them, so the rule's text alone isn't enough. In order of preference:
//   1. the file a dev server names on the stylesheet (Vite, SvelteKit, Nuxt and Astro tag <style data-vite-dev-id>)
//   2. the stylesheet's source map
//   3. nothing here: the server's text search, as for plain CSS
import { api } from './core.js';
import { mapFor, original, position, cleanSource } from './sourcemap.js';

// CSS Modules rename classes: Vite writes _card_1a2b3, Next.js Card_card__x7Yz9; the source says .card
function unhashed(selector) {
  const out = new Set();
  for (const m of selector.matchAll(/\.([\w-]+)/g)) {
    const c = m[1];
    const vite = c.match(/^_(.+?)_[\w-]{5}(?:_\d+)?$/), next = c.match(/^[A-Za-z0-9-]+_(.+)__[\w-]{5,}$/);
    out.add('.' + (vite?.[1] || next?.[1] || c));
  }
  return [...out].reverse(); // the last class is usually the one the rule is about
}
// component-scoped styles add a marker the source doesn't have: Svelte's .svelte-1x2y3z, Vue's [data-v-7a7a37b1]
const unscoped = (sel) => sel.replace(/\.svelte-[a-z0-9]+/gi, '').replace(/\[data-v-[a-f0-9]+\]|\[_ngcontent-[\w-]+\]|\[_nghost-[\w-]+\]|\[data-astro-cid-\w+\]/gi, '').trim();
const needles = (sel) => { const u = unscoped(sel); return [...new Set([sel, sel.replace(/\s*([>+~,])\s*/g, '$1'), u, u.replace(/\s*([>+~,])\s*/g, '$1'), ...unhashed(u)])].filter(Boolean); };
const textOf = async (sheet) => {
  const n = sheet.ownerNode;
  if (n?.tagName === 'STYLE') return n.textContent;
  if (sheet.href) { try { return await (await fetch(sheet.href)).text(); } catch { return null; } }
  return null;
};

const cache = new Map();
export function ruleSource(rule, selector) {
  if (!rule?.parentStyleSheet) return Promise.resolve(null);
  let sheet = rule.parentStyleSheet;
  while (sheet.ownerRule?.parentStyleSheet) sheet = sheet.ownerRule.parentStyleSheet; // @import chains
  const key = (sheet.href || sheet.ownerNode?.dataset?.viteDevId || '') + '|' + selector;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const id = sheet.ownerNode?.dataset?.viteDevId;
    const text = await textOf(sheet);
    // 2. a source map, when the dev server attached one
    if (text) {
      const map = await mapFor(sheet.href || `inline:${id || key}`, text);
      const at = map && position(text, needles(selector));
      const o = at && original(map, at.line, at.col);
      if (o) return { ...o, via: 'source map' };
    }
    // 1. the file the dev server named, searched for the selector as you wrote it
    // (Vite's CSS Modules names end in the line the class is written on: _title_duaxh_7)
    const lineInName = selector.match(/\._.+?_[\w-]{5}_(\d+)\b/);
    if (id) {
      const r = await api(`source?file=${encodeURIComponent(id.split('?')[0].replace(/^\/@fs/, ''))}&${needles(selector).map((n) => 'q=' + encodeURIComponent(n)).join('&')}`).catch(() => null);
      if (r) return { file: r.file, line: lineInName ? +lineInName[1] : r.line, via: 'dev server' };
    }
    if (id) return { file: cleanSource(id.split('?')[0]), line: null, via: 'dev server' };
    return null;
  })();
  cache.set(key, p);
  return p;
}
