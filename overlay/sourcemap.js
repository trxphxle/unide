// Source maps: from a position in what the browser runs back to the line you wrote.
// Dev servers attach them to compiled JavaScript and CSS (inline as data: URLs, or as .map files).

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const VAL = Object.fromEntries([...B64].map((c, i) => [c, i]));
// "mappings" → per generated line, segments [genCol, source, line, col]
function decode(mappings) {
  const lines = [];
  let src = 0, line = 0, col = 0;
  for (const l of mappings.split(';')) {
    const segs = [];
    let gen = 0;
    for (const s of l.split(',')) {
      if (!s) continue;
      const v = [];
      let shiftN = 0, val = 0;
      for (const ch of s) {
        const d = VAL[ch];
        val += (d & 31) << shiftN;
        if (d & 32) shiftN += 5;
        else { v.push(val & 1 ? -(val >>> 1) : val >>> 1); val = 0; shiftN = 0; }
      }
      gen += v[0];
      if (v.length >= 4) { src += v[1]; line += v[2]; col += v[3]; segs.push([gen, src, line, col]); }
    }
    lines.push(segs);
  }
  return lines;
}

const maps = new Map();
// the source map for a script or stylesheet's text (fetched from its URL when no text is given)
export async function mapFor(url, text) {
  if (maps.has(url)) return maps.get(url);
  const p = (async () => {
    try {
      if (text === undefined) text = await (await fetch(url)).text();
      const m = [...text.matchAll(/[#@]\s*sourceMappingURL=([^\s*'"]+)/g)].pop()?.[1];
      if (!m) return null;
      let json;
      if (m.startsWith('data:')) {
        const b64 = m.split(',')[1];
        json = JSON.parse(/;base64/.test(m) ? new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))) : decodeURIComponent(b64));
      } else json = await (await fetch(new URL(m, url || location.href))).json();
      return { json, lines: decode(json.mappings || ''), base: url || location.href, text };
    } catch { return null; }
  })();
  maps.set(url, p);
  return p;
}

// the project folder, from the server, so absolute paths can be shown relative to it
let ROOT = '';
export const setRoot = (r) => { ROOT = (r || '').replace(/\/+$/, '') + '/'; };
// a source path as a project path: strips webpack://, turbopack:///[project]/, the project folder and "./"
export function cleanSource(src, base) {
  let s = String(src || '');
  if (ROOT.length > 1) for (const r of [ROOT, ROOT.replace(/^\/private\//, '/')]) if (s.startsWith(r)) return s.slice(r.length);
  if (s.startsWith('/@fs/')) s = s.slice(4);
  s = s.replace(/^webpack:\/\/[^/]*\//, '').replace(/^turbopack:\/\/\/\[project\]\//, '').replace(/^turbopack:\/\/\//, '').replace(/^\(.*?\)\//, '').replace(/^\.\//, '');
  if (/^https?:/.test(s)) s = new URL(s).pathname;
  else if (!s.startsWith('/') && base && /^https?:/.test(base) && !/^(node_modules|app|src|pages|components|lib)\//.test(s)) s = new URL(s, base).pathname;
  s = s.replace(/\?.*$/, '');
  // a relative source can resolve to an absolute path inside the project (Bun writes them this way)
  if (ROOT.length > 1) for (const r of [ROOT, ROOT.replace(/^\/private\//, '/')]) if (s.startsWith(r)) return s.slice(r.length);
  return s.replace(/^\/+/, '');
}

// generated (line, col), both 1-based → { file, line } in the original source
export function original(map, line, col) {
  const segs = map?.lines[line - 1];
  if (!segs?.length) return null;
  let best = segs[0];
  for (const s of segs) { if (s[0] <= col - 1) best = s; else break; }
  const src = map.json.sources?.[best[1]];
  if (src == null) return null;
  const root = map.json.sourceRoot ? map.json.sourceRoot.replace(/\/?$/, '/') : '';
  return { file: cleanSource(root + src, map.base), line: best[2] + 1 };
}

// line and column of the first match of any of `needles` in `text`
export function position(text, needles) {
  for (const n of needles) {
    const i = n ? text.indexOf(n) : -1;
    if (i < 0) continue;
    const before = text.slice(0, i), line = before.split('\n').length;
    return { line, col: i - before.lastIndexOf('\n') };
  }
  return null;
}
