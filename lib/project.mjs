// A project's unide state: where it lives, which port it uses, and whether its server is running.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

// folders that hold dependencies or build output, never the source you'd edit
export const SKIP = new Set(['node_modules', '.git', 'dist', 'target', 'release', '.claude', '.local', '.fixtures', '.unide', '.venv', '__pycache__',
  '.next', '.nuxt', '.output', '.svelte-kit', '.astro', '.vercel', '.netlify', '.turbo', '.cache', '.parcel-cache', '.angular', 'build', 'coverage', 'out']);

// the project is the nearest folder with .unide/, else the folder you're in
export function findRoot(start = process.cwd()) {
  for (let d = path.resolve(start); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.unide'))) return d;
    if (path.dirname(d) === d) return path.resolve(start);
  }
}
export const dir = (root) => path.join(root, '.unide');
export const file = (root, name) => path.join(dir(root), name);
export function readJson(f, fallback) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } }
export function writeJson(f, v) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n'); }

// ports browsers and Node's fetch refuse to talk to (the Fetch standard's "bad ports" in our range)
export const BAD_PORTS = new Set([4190]);
// the same project always gets the same port, so links stay valid between sessions
export function preferredPort(root) {
  let h = 0;
  for (const ch of root) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const p = 4180 + (h % 400);
  return BAD_PORTS.has(p) ? p + 1 : p;
}

export function htmlPages(root) {
  const out = [];
  (function walk(d, depth) {
    if (depth > 6) return;
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (/\.html?$/.test(e.name) && !/\.template\./.test(e.name)) out.push({ file: path.relative(root, p).split(path.sep).join('/'), mtime: fs.statSync(p).mtimeMs });
    }
  })(root, 0);
  return out.sort((a, b) => b.mtime - a.mtime);
}

export function ping(port) {
  return new Promise((ok) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/__unide/ping', timeout: 800 }, (res) => {
      let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => { try { ok(JSON.parse(b)); } catch { ok(null); } });
    });
    req.on('error', () => ok(null)); req.on('timeout', () => { req.destroy(); ok(null); });
  });
}
// the running server for this project, if there is one
export async function running(root) {
  const s = readJson(file(root, 'server.json'), null);
  if (!s) return null;
  const p = await ping(s.port);
  return p && p.root === root ? { ...s, url: `http://127.0.0.1:${s.port}` } : null;
}
