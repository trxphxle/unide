// Finding where a selector, token or colour is written in the project, and whether that file is generated.
import fs from 'node:fs';
import path from 'node:path';
import { SKIP } from './project.mjs';

const SEARCHABLE = /\.(html|css|scss|sass|less|js|mjs|cjs|jsx|ts|mts|tsx|vue|svelte|astro|py)$/;
const MAX_SEARCH_BYTES = 6e6;

export function createLocator(root) {
  let listing = null, listedAt = 0;
  function files() {
    if (listing && Date.now() - listedAt < 5000) return listing;
    const out = [];
    (function walk(dir) {
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (SKIP.has(e.name)) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (SEARCHABLE.test(e.name)) out.push(p);
      }
    })(root);
    listedAt = Date.now();
    return (listing = out);
  }
  const rel = (p) => path.relative(root, p).split(path.sep).join('/');

  // a file is probably generated when a sibling template exists or a build script names it
  function generatedFrom(f) {
    if (/\.template\./.test(f)) return null; // a template is the source
    const tpl = f.replace(/\.html$/, '.template.html');
    const from = tpl !== f && fs.existsSync(tpl) ? rel(tpl) : null;
    const base = path.basename(f);
    const named = new RegExp(`[\\s"'/]${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'\\s]`);
    const builders = files().filter((x) => /build/i.test(path.basename(x)) && /\.(py|js|mjs)$/.test(x) && x !== f)
      .filter((x) => { try { return named.test(fs.readFileSync(x, 'utf8')); } catch { return false; } })
      .map(rel);
    let head = '';
    try { head = fs.readFileSync(f, 'utf8').slice(0, 600); } catch { /* gone */ }
    const says = /written by|generated|do not edit|edit there/i.test(head);
    return from || builders.length || says ? { from, builders, says } : null;
  }

  // selectors are compared without spaces or quotes: the browser writes `[a="b"] .x :is(.y, .z)`,
  // the source may say `[a=b] .x :is(.y,.z)`
  const norm = (t) => t.replace(/[\s"']/g, '');
  function locate(q, page = '') {
    const stem = path.basename(page).replace(/\..*$/, '');
    // a colour like #3b2416 is matched without case and may be followed by anything but another hex digit
    const isHex = /^#[0-9a-f]{3,8}$/i.test(q);
    const hits = [], nq = isHex ? q.toLowerCase() : norm(q);
    if (!nq) return hits;
    for (const f of files()) {
      let text;
      try { if (fs.statSync(f).size > MAX_SEARCH_BYTES) continue; text = fs.readFileSync(f, 'utf8'); } catch { continue; }
      if (!(isHex ? text.toLowerCase() : norm(text)).includes(nq)) continue;
      const lines = text.split('\n');
      for (let i = 0, n = 0; i < lines.length && n < 12 && hits.length < 400; i++) {
        const nl = isHex ? lines[i].toLowerCase() : norm(lines[i]);
        const at = nl.indexOf(nq);
        if (at < 0) continue;
        // a selector is followed by "{", "," or a pseudo-class; a token definition ends in ":"
        const next = nl.slice(at + nq.length, at + nq.length + 1);
        if (isHex ? /[0-9a-f]/.test(next) : !q.endsWith(':') && next && !/[{,:.\[>+~]/.test(next)) continue;
        n++;
        hits.push({ file: rel(f), line: i + 1, text: lines[i].trim().slice(0, 160), generated: null, exact: !next || /[{,]/.test(next), here: !!stem && rel(f).includes(stem) });
      }
    }
    const seen = new Map();
    for (const h of hits) {
      if (!seen.has(h.file)) seen.set(h.file, generatedFrom(path.join(root, h.file)));
      h.generated = seen.get(h.file);
    }
    // sources before generated copies, the rule itself before descendants, this page's files first
    const score = (h) => (h.generated ? 4 : 0) + (h.exact ? 0 : 2) + (stem && h.file.includes(stem) ? 0 : 1);
    return hits.sort((a, b) => score(a) - score(b)).slice(0, 40);
  }
  // the few lines worth showing: the rule itself, in this page's files, real sources over generated copies
  // `nearFile`: a file the page says the rule came from (a stylesheet that @imports others): prefer hits beside it
  function where(q0, page = '', nearFile = '') {
    const q = q0.replace(/\[_ngcontent-[\w-]+\]|\[_nghost-[\w-]+\]|\[data-v-[a-f0-9]+\]|\[data-astro-cid-[\w]+\]|\.svelte-[a-z0-9]+/gi, '').trim() || q0;
    let hits = locate(q, page);
    if (nearFile) {
      const dir = nearFile.split('/').slice(0, -1);
      const shared = (f) => { const d = f.split('/'); let n = 0; while (n < dir.length && d[n] === dir[n]) n++; return n; };
      const ext = nearFile.split('.').pop();
      hits = [...hits].sort((a, b) => shared(b.file) - shared(a.file) || (b.file.endsWith('.' + ext) - a.file.endsWith('.' + ext)));
      const best = hits[0] && shared(hits[0].file);
      if (best > 0) hits = hits.filter((h) => shared(h.file) === best);
    }
    const exact = hits.filter((h) => h.exact), pool = exact.length ? exact : hits, here = nearFile ? pool : pool.filter((h) => h.here);
    const near = here.length ? here : pool, src = near.filter((h) => !h.generated);
    const top = (src.length ? src : near).slice(0, 2);
    return top.length ? top.map((h) => `${h.file}:${h.line}${h.generated ? ` (generated${h.generated.from ? ` from ${h.generated.from}` : ''})` : ''}`).join(', ') : null;
  }
  // the first line containing any of `needles`, as written (for definitions like selector: 'app-root')
  function grep(needles) {
    const list = needles.filter(Boolean);
    for (const f of files()) {
      if (/\.(css|scss|sass|less|py)$/.test(f)) continue;
      let text;
      try { if (fs.statSync(f).size > MAX_SEARCH_BYTES) continue; text = fs.readFileSync(f, 'utf8'); } catch { continue; }
      for (const n of list) {
        const i = text.indexOf(n);
        if (i >= 0) return { file: rel(f), line: text.slice(0, i).split('\n').length, match: n };
      }
    }
    return null;
  }
  return { files, locate, where, grep };
}
