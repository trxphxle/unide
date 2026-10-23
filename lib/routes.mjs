// The pages of a framework app, from its file conventions: app/**/page.tsx (Next.js), src/routes/**/+page.svelte
// (SvelteKit), pages/*.vue (Nuxt), src/pages/* (Astro), app/routes/* (Remix, React Router). Plain Vite apps: "/".
import fs from 'node:fs';
import path from 'node:path';
import { SKIP } from './project.mjs';

function walk(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const clean = (segs) => '/' + segs.filter((s) => s && s !== '.' && !/^\(.*\)$/.test(s) && !s.startsWith('@')).join('/');

// one file → its route, or null if it isn't a page
const RULES = [
  { dirs: ['app', 'src/app'], test: /\/page\.(tsx|jsx|ts|js|mdx)$/, route: (rel) => clean(path.dirname(rel).split('/')) },
  { dirs: ['pages', 'src/pages'], test: /\.(tsx|jsx|ts|js|vue|astro|md|mdx)$/, skip: /(^|\/)(_app|_document|_error|api\/)|\/api\//, route: (rel) => clean(rel.replace(/\.[a-z]+$/, '').replace(/(^|\/)index$/, '').split('/')) },
  { dirs: ['src/routes'], test: /\/\+page\.(svelte|ts|js)$|^\+page\.(svelte|ts|js)$/, route: (rel) => clean(path.dirname(rel).split('/')) },
  { dirs: ['app/routes'], test: /\.(tsx|jsx|ts|js)$/, route: (rel) => clean(rel.replace(/\.[a-z]+$/, '').replace(/\/route$/, '').split(/[./]/).map((s) => (s === '_index' ? '' : s.replace(/^_/, '').replace(/^\$(.+)/, ':$1')))) },
];
function routeOf(root, abs) {
  const rel0 = path.relative(root, abs).split(path.sep).join('/');
  for (const r of RULES) for (const d of r.dirs) {
    if (!rel0.startsWith(d + '/')) continue;
    const rel = rel0.slice(d.length + 1);
    if (!r.test.test('/' + rel) || (r.skip && r.skip.test(rel))) continue;
    return r.route(rel).replace(/\/+$/, '') || '/';
  }
  return null;
}
// React Router v7 (framework mode) declares routes in app/routes.ts: index("routes/home.tsx"), route("about", "routes/about.tsx")
function configRoutes(root) {
  const f = ['app/routes.ts', 'app/routes.js', 'app/routes.tsx'].map((x) => path.join(root, x)).find((x) => fs.existsSync(x));
  if (!f) return null;
  const text = fs.readFileSync(f, 'utf8'), out = new Map();
  for (const m of text.matchAll(/\bindex\(\s*["'`]([^"'`]+)["'`]/g)) out.set('/', 'app/' + m[1].replace(/^\.\//, ''));
  for (const m of text.matchAll(/\broute\(\s*["'`]([^"'`]*)["'`]\s*,\s*["'`]([^"'`]+)["'`]/g)) out.set('/' + m[1].replace(/^\/+/, ''), 'app/' + m[2].replace(/^\.\//, ''));
  return out.size ? out : null;
}
export function routes(root) {
  const declared = configRoutes(root);
  if (declared) return [...declared].map(([route, file]) => ({ route, file })).sort((a, b) => a.route.localeCompare(b.route));
  const found = new Map();
  for (const d of ['app', 'src/app', 'pages', 'src/pages', 'src/routes', 'app/routes']) {
    for (const f of walk(path.join(root, d))) { const r = routeOf(root, f); if (r && !found.has(r)) found.set(r, path.relative(root, f).split(path.sep).join('/')); }
  }
  if (!found.has('/')) found.set('/', fs.existsSync(path.join(root, 'index.html')) ? 'index.html' : '');
  return [...found].map(([route, file]) => ({ route, file })).sort((a, b) => a.route.localeCompare(b.route));
}
export function fileToRoute(root, _framework, file) {
  if (!file) return '/';
  const declared = configRoutes(root);
  if (declared) for (const [route, f] of declared) if (f === file) return route;
  return routeOf(root, path.join(root, file)) ?? (/\.html?$/.test(file) ? '/' + file : null);
}
