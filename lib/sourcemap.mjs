// Source maps on disk, for code the browser never sees: server components (Next.js, React Server Components)
// run from compiled files under .next/ or similar, and their stack frames point there.
import fs from 'node:fs';
import path from 'node:path';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const VAL = Object.fromEntries([...B64].map((c, i) => [c, i]));
function decode(mappings) {
  const lines = [];
  let src = 0, line = 0, col = 0;
  for (const l of mappings.split(';')) {
    const segs = [];
    let gen = 0;
    for (const s of l.split(',')) {
      if (!s) continue;
      const v = [];
      let sh = 0, val = 0;
      for (const ch of s) { const d = VAL[ch]; val += (d & 31) << sh; if (d & 32) sh += 5; else { v.push(val & 1 ? -(val >>> 1) : val >>> 1); val = 0; sh = 0; } }
      gen += v[0];
      if (v.length >= 4) { src += v[1]; line += v[2]; col += v[3]; segs.push([gen, src, line, col]); }
    }
    lines.push(segs);
  }
  return lines;
}
function lookup(map, line0, col0) {
  // index maps (Turbopack writes these): pick the section that starts at or before the position
  if (map.sections) {
    let sec = null;
    for (const s of map.sections) { const o = s.offset; if (o.line < line0 || (o.line === line0 && o.column <= col0)) sec = s; else break; }
    if (!sec?.map) return null;
    return lookup(sec.map, line0 - sec.offset.line, line0 === sec.offset.line ? col0 - sec.offset.column : col0);
  }
  map._lines ||= decode(map.mappings || '');
  const segs = map._lines[line0];
  if (!segs?.length) return null;
  let best = segs[0];
  for (const s of segs) { if (s[0] <= col0) best = s; else break; }
  const src = map.sources?.[best[1]];
  return src == null ? null : { source: (map.sourceRoot || '') + src, line: best[2] + 1 };
}
const cache = new Map();
function mapOf(file) {
  if (cache.has(file)) return cache.get(file);
  let map = null;
  try {
    const text = fs.readFileSync(file, 'utf8');
    const ref = [...text.matchAll(/[#@]\s*sourceMappingURL=([^\s*'"]+)/g)].pop()?.[1];
    if (ref?.startsWith('data:')) map = JSON.parse(Buffer.from(ref.split(',')[1], /;base64/.test(ref) ? 'base64' : 'utf8').toString('utf8'));
    else {
      const f = ref ? path.resolve(path.dirname(file), decodeURIComponent(ref)) : file + '.map';
      if (fs.existsSync(f)) map = JSON.parse(fs.readFileSync(f, 'utf8'));
    }
  } catch { map = null; }
  cache.set(file, map);
  return map;
}
// a project path for a source map's source: turbopack:///[project]/app/page.tsx → app/page.tsx
export function projectPath(root, src) {
  let s = String(src || '').replace(/^turbopack:\/\/\/\[project\]\//, '').replace(/^webpack:\/\/[^/]*\//, '').replace(/^file:\/\//, '').replace(/^\.\//, '');
  if (s.startsWith(root + '/')) s = s.slice(root.length + 1);
  return s.split('?')[0];
}
// compiled file + 1-based line and column → { file, line } in the project's own source
export function originalOnDisk(root, file, line, col) {
  const map = mapOf(file);
  const o = map && lookup(map, line - 1, col - 1);
  if (!o) return null;
  const f = projectPath(root, o.source);
  return /node_modules|^\[/.test(f) ? null : { file: f, line: o.line };
}
