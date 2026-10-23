// The unide server for one project: serves its pages with the overlay added, keeps the pins,
// tells open pages when files or pins change, and answers the MCP bridge.
// It only writes inside .unide/ (pins, server state) and unide's own store/ and requests/.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIP, BAD_PORTS, dir, file, preferredPort, htmlPages, writeJson, readJson } from './project.mjs';
import { detect, startDev, hostFor, ours } from './devserver.mjs';
import { routes, fileToRoute } from './routes.mjs';
import { originalOnDisk } from './sourcemap.mjs';
import { createLocator } from './locate.mjs';
import { createPins } from './pins.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8')).version;
const TYPES = { html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript',
  json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf' };

const send = (res, code, body, type = 'text/plain; charset=utf-8') =>
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
const json = (res, v, code = 200) => send(res, code, JSON.stringify(v), TYPES.json);
const readBody = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => ok(b)); });
const TAG = '<script type="module" src="/__unide/main.js"></script>';
// a plain script at the top of <head>, before the page's own: Freeze needs the page's timers to go through it
const EARLY = '<script src="/__unide/early.js"></script>';
function inject(html) {
  if (html.includes('/__unide/main.js')) return html;
  const head = /<head\b[^>]*>/i.exec(html);
  html = head ? html.slice(0, head.index + head[0].length) + EARLY + html.slice(head.index + head[0].length) : EARLY + html;
  const i = html.lastIndexOf('</body>');
  return i < 0 ? html + TAG : html.slice(0, i) + TAG + html.slice(i);
}
function decode(buf, enc) {
  if (enc === 'gzip' || enc === 'x-gzip') return zlib.gunzipSync(buf);
  if (enc === 'br') return zlib.brotliDecompressSync(buf);
  if (enc === 'deflate') return zlib.inflateSync(buf);
  if (enc === 'zstd' && zlib.zstdDecompressSync) return zlib.zstdDecompressSync(buf);
  return buf;
}

export function start({ root, port, page = '', quiet = false }) {
  root = path.resolve(root);
  const locator = createLocator(root);
  let PORT = port || preferredPort(root);
  const pageUrl = (p) => `http://127.0.0.1:${PORT}/${String(p || '').replace(/^\/+/, '')}`;

  // pages that are open in a browser, told when files or pins change
  const clients = new Set();
  const emit = (event) => { for (const c of clients) c.write(`data: ${JSON.stringify(event)}\n\n`); };
  const pins = createPins(root, { where: locator.where, url: pageUrl, onChange: (x) => emit({ type: 'pins', ...x }) });

  // ---------- proxy mode: unide in front of the project's dev server ----------
  const cfgFile = file(root, 'config.json');
  const dev = readJson(cfgFile, {})?.dev ?? detect(root);
  let target = null, devChild = null;
  const devLog = [];
  async function findTarget() {
    if (!dev) return null;
    const saved = readJson(cfgFile, {})?.dev?.lastPort;
    for (const port of [saved, dev.port].filter(Boolean)) {
      const host = await hostFor(port);
      if (!host) continue;
      // something answers there: only use it if it's this project's (another project's Vite may sit on 5173);
      // when that can't be told, only the port unide itself started before
      const mine = await ours(port, root);
      if (mine || (mine === null && port === saved)) return { host, port, https: false };
      if (!quiet && mine === false) console.log(`unide: port ${port} is another project's dev server; starting this one's`);
    }
    if (!quiet) console.log(`unide: starting the ${dev.framework} dev server (${dev.command.join(' ')})`);
    const r = await startDev(root, dev, (t) => { devLog.push(t); if (devLog.length > 200) devLog.shift(); });
    devChild = r.child;
    if (fs.existsSync(cfgFile)) { const c = readJson(cfgFile, {}); c.dev = { ...dev, ...(c.dev || {}), lastPort: r.port }; writeJson(cfgFile, c); }
    for (let i = 0; i < 40; i++) { const host = await hostFor(r.port); if (host) return { host, port: r.port, https: r.https }; await new Promise((ok) => setTimeout(ok, 150)); }
    return { host: '127.0.0.1', port: r.port, https: r.https };
  }
  let targetP = null;
  const getTarget = () => (targetP ||= findTarget().then((t) => (target = t)).catch((e) => { targetP = null; throw e; }));
  const stopDev = () => { try { devChild?.kill(); } catch { /* gone */ } };
  process.on('exit', stopDev);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { stopDev(); process.exit(0); });

  // the dev server sees itself being asked, not unide
  function forwardHeaders(h, t) {
    const out = { ...h, host: `localhost:${t.port}` };
    const self = `http://127.0.0.1:${PORT}`, there = `${t.https ? 'https' : 'http'}://localhost:${t.port}`;
    for (const k of ['origin', 'referer']) if (out[k]) out[k] = out[k].replace(self, there).replace(`http://localhost:${PORT}`, there);
    return out;
  }
  const backHeaders = (h, t) => {
    const out = { ...h };
    if (out.location) out.location = out.location.replace(new RegExp(`^https?://(localhost|127\\.0\\.0\\.1|\\[::1\\]):${t.port}`), `http://127.0.0.1:${PORT}`);
    return out;
  };
  async function proxy(req, res, fallback) {
    let t;
    try { t = await getTarget(); } catch (e) { return send(res, 502, `unide couldn't start the dev server.\n\n${e.message}`); }
    const body = req.method === 'GET' || req.method === 'HEAD' ? null : await new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); });
    const headers = forwardHeaders(req.headers, t);
    const lib = t.https ? https : http;
    const up = lib.request({ host: t.host, port: t.port, method: req.method, path: req.url, headers, rejectUnauthorized: false }, (r) => {
      // a 404 for a file that exists here (pages outside the dev server's root): serve it directly
      if (r.statusCode === 404 && fallback && req.method === 'GET' && fallback()) { r.resume(); return; }
      const h = backHeaders(r.headers, t);
      if (!/text\/html/.test(r.headers['content-type'] || '') || req.method === 'HEAD') { res.writeHead(r.statusCode, h); return r.pipe(res); }
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => {
        let html;
        try { html = decode(Buffer.concat(chunks), r.headers['content-encoding']).toString('utf8'); } catch { html = Buffer.concat(chunks).toString('utf8'); }
        for (const k of ['content-length', 'content-encoding', 'content-security-policy', 'content-security-policy-report-only', 'etag', 'transfer-encoding']) delete h[k];
        h['cache-control'] = 'no-store';
        res.writeHead(r.statusCode, h);
        res.end(inject(html));
      });
    });
    up.on('error', (e) => { targetP = null; send(res, 502, `unide couldn't reach the dev server: ${e.message}`); });
    body ? up.end(body) : up.end();
  }

  // snapshots and reference images, kept in unide, not the project
  const STORE = path.join(HERE, 'store', path.basename(root));
  const KEYS = new Set(['snapshots', 'refs']);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);
    try {
      // ---------- the overlay ----------
      const mod = p.match(/^\/__unide\/([a-z-]+\.js)$/);
      if (mod) {
        const f = path.join(HERE, 'overlay', mod[1]);
        return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f), TYPES.js) : send(res, 404, 'no such module');
      }
      if (p === '/__unide/ping') return json(res, { root, port: PORT, version: VERSION, mode: dev ? 'proxy' : 'static', framework: dev?.framework || null, target: target && `${target.host}:${target.port}` });
      if (p === '/__unide/grep') return json(res, locator.grep(url.searchParams.getAll('q')));
      if (p === '/__unide/ngtemplate') {
        // an Angular component's templateUrl, relative to the project
        const f = path.resolve(root, url.searchParams.get('file') || '');
        if (!f.startsWith(root) || !fs.existsSync(f)) return json(res, null);
        const m = fs.readFileSync(f, 'utf8').match(/templateUrl\s*:\s*['"`]([^'"`]+)['"`]/);
        const t = m && path.resolve(path.dirname(f), m[1]);
        return json(res, t && fs.existsSync(t) ? { file: path.relative(root, t).split(path.sep).join('/') } : null);
      }
      if (p === '/__unide/mapfile') {
        // a stack frame in a compiled file on disk (server components) → the line in your source
        const f = path.resolve(url.searchParams.get('path') || '');
        if (!f.startsWith(root) && !f.startsWith(fs.realpathSync(root))) return json(res, null);
        return json(res, originalOnDisk(fs.realpathSync(root), f, +url.searchParams.get('line'), +url.searchParams.get('col')));
      }
      if (p === '/__unide/source') {
        // where a selector or class is written inside one known file (from the page: a dev server's style id, a component's file)
        const f = path.resolve(root, (url.searchParams.get('file') || '').replace(/^\/(?=src\/|app\/|pages\/|components\/)/, '')), qs = url.searchParams.getAll('q');
        if (!f.startsWith(root) || !fs.existsSync(f)) return json(res, null);
        const lines = fs.readFileSync(f, 'utf8').split('\n');
        for (const q of qs) { const i = lines.findIndex((l) => l.includes(q)); if (i >= 0) return json(res, { file: path.relative(root, f).split(path.sep).join('/'), line: i + 1, match: q }); }
        return json(res, { file: path.relative(root, f).split(path.sep).join('/'), line: null });
      }
      if (p === '/__unide/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write('retry: 1000\n\n');
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (p === '/__unide/locate') return json(res, locator.locate(url.searchParams.get('q') || '', url.searchParams.get('page') || ''));
      if (p === '/__unide/pages') {
        if (dev) return json(res, routes(root, dev.framework).map((r) => ({ file: r.file, route: r.route, url: pageUrl(r.route.slice(1)) })));
        return json(res, htmlPages(root).map((x) => ({ file: x.file, url: pageUrl(x.file) })));
      }
      if (p === '/__unide/link') {
        const f = (url.searchParams.get('file') || '').replace(/^\/+/, '');
        if (dev) { const r = fileToRoute(root, dev.framework, f); return json(res, { url: pageUrl((r ?? '/' + f).slice(1)), route: r }); }
        return json(res, { url: pageUrl(f), exists: fs.existsSync(path.join(root, f)) });
      }

      // ---------- pins ----------
      if (p === '/__unide/pins' && req.method === 'GET') return json(res, pins.list(url.searchParams.get('page')));
      if (p === '/__unide/pins' && req.method === 'POST') return json(res, pins.upsert(JSON.parse(await readBody(req))));
      if (p === '/__unide/pins/delete') { pins.remove(JSON.parse(await readBody(req)).id); return json(res, { ok: true }); }
      // a picture of the pinned area, taken on the page when it was pinned; agents open it by its path
      if (p === '/__unide/shot' && req.method === 'POST') {
        const { name, data } = JSON.parse(await readBody(req)), m = /^data:image\/png;base64,(.+)$/.exec(data || '');
        if (!m || !/^[\w-]+$/.test(name || '')) return send(res, 400, 'not a png');
        const f = file(root, `shots/${name}.png`);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, Buffer.from(m[1], 'base64'));
        return json(res, { file: f });
      }
      // an image dropped on a pin's Image panel: kept in .unide/assets/ until the pin is done
      if (p === '/__unide/asset' && req.method === 'POST') {
        const { k, name, data } = JSON.parse(await readBody(req)), m = /^data:image\/([\w.+-]+);base64,(.+)$/.exec(data || '');
        if (!m) return send(res, 400, 'not an image');
        const ext = ((name || '').match(/\.(\w+)$/)?.[1] || m[1].replace('svg+xml', 'svg').replace('jpeg', 'jpg')).toLowerCase().replace(/\W/g, '');
        const safe = `${String(k || 'img').replace(/\W/g, '')}-${Date.now().toString(36)}.${ext}`, f = file(root, `assets/${safe}`);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, Buffer.from(m[2], 'base64'));
        return json(res, { file: f, url: `/__unide/asset-file?name=${safe}` });
      }
      if (p === '/__unide/asset-file') {
        const n = path.basename(url.searchParams.get('name') || ''), f = file(root, `assets/${n}`), ext = n.split('.').pop();
        const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif' }[ext] || 'application/octet-stream';
        return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f), type) : send(res, 404, 'not found');
      }
      if (p === '/__unide/shot-file') {
        const f = file(root, `shots/${path.basename(url.searchParams.get('name') || '')}`);
        return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f), TYPES.png) : send(res, 404, 'not found');
      }
      if (p === '/__unide/pins/send') return json(res, { sent: pins.send(JSON.parse((await readBody(req)) || '{}').page) });
      if (p === '/__unide/pins/resolve') {
        const b = JSON.parse(await readBody(req)), r = pins.resolve(b.id, b.status, b.reply);
        return r ? json(res, r) : json(res, { error: `no pin #${b.id}` }, 404);
      }
      if (p === '/__unide/pins/open') return url.searchParams.get('format') === 'json' ? json(res, [...pins.open(), ...pins.unsent()]) : send(res, 200, pins.markdown());

      // ---------- Tools: snapshots, references, copied requests ----------
      if (p === '/__unide/store') {
        const key = url.searchParams.get('key');
        if (!KEYS.has(key)) return send(res, 400, 'unknown key');
        const f = path.join(STORE, key + '.json');
        if (req.method === 'POST') {
          const b = await readBody(req);
          JSON.parse(b);
          fs.mkdirSync(STORE, { recursive: true }); fs.writeFileSync(f, b);
          return json(res, { ok: true });
        }
        return send(res, 200, fs.existsSync(f) ? fs.readFileSync(f) : '[]', TYPES.json);
      }
      if (p === '/__unide/ref' && req.method === 'POST') {
        const { data } = JSON.parse(await readBody(req)), m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(data || '');
        if (!m) return send(res, 400, 'not an image');
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6), d = path.join(STORE, 'refs');
        fs.mkdirSync(d, { recursive: true });
        const f = path.join(d, `${id}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`);
        fs.writeFileSync(f, Buffer.from(m[2], 'base64'));
        return json(res, { id, file: f, url: `/__unide/ref-file?name=${path.basename(f)}` });
      }
      if (p === '/__unide/ref-file') {
        const name = path.basename(url.searchParams.get('name') || ''), f = path.join(STORE, 'refs', name);
        return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f), TYPES[path.extname(f).slice(1)] || 'application/octet-stream') : send(res, 404, 'not found');
      }
      if (p === '/__unide/request' && req.method === 'POST') {
        const body = await readBody(req), d = path.join(HERE, 'requests');
        fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, `${new Date().toISOString().replace(/[:.]/g, '-')}.md`), body);
        fs.writeFileSync(path.join(d, 'latest.md'), body);
        return json(res, { saved: path.join(d, 'latest.md') });
      }

      // ---------- the project's own files, read-only (or the dev server's, in proxy mode) ----------
      if (dev) return proxy(req, res, () => serveFile(p, res, true));
      return serveFile(p, res, false);
    } catch (e) {
      return send(res, 500, String(e.message || e));
    }
  });
  function serveFile(p, res, onlyIfExists) {
    {
      if (p === '/' && !onlyIfExists) {
        const first = page || htmlPages(root)[0]?.file;
        return first ? res.writeHead(302, { Location: '/' + first }).end() : send(res, 404, 'no HTML pages in this project');
      }
      const f0 = path.join(root, p);
      if (!f0.startsWith(root) || f0.split(path.sep).includes('.unide')) return onlyIfExists ? false : send(res, 403, 'not served');
      let f = f0;
      try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.statSync(f).isFile()) throw 0; } catch { return onlyIfExists ? false : send(res, 404, 'not found'); }
      const buf = fs.readFileSync(f);
      const ext = path.extname(f).slice(1).toLowerCase();
      if (ext !== 'html' && ext !== 'htm') send(res, 200, buf, TYPES[ext] || 'application/octet-stream');
      else send(res, 200, inject(buf.toString('utf8')), TYPES.html);
      return true;
    }
  }

  // hot reload sockets go straight through to the dev server
  server.on('upgrade', async (req, socket, head) => {
    if (!dev || req.url.startsWith('/__unide')) return socket.destroy();
    let t;
    try { t = await getTarget(); } catch { return socket.destroy(); }
    const up = t.https ? tls.connect({ host: t.host, port: t.port, rejectUnauthorized: false }) : net.connect({ host: t.host, port: t.port });
    up.on('connect', () => {}).on('error', () => socket.destroy());
    const send0 = () => {
      const h = forwardHeaders(req.headers, t);
      up.write(`${req.method} ${req.url} HTTP/1.1\r\n` + Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n');
      if (head?.length) up.write(head);
      up.pipe(socket); socket.pipe(up);
    };
    t.https ? up.once('secureConnect', send0) : up.once('connect', send0);
    socket.on('error', () => up.destroy());
  });

  // live reload: tell open pages which file changed
  let timer = null, changed = new Set();
  if (!dev) try {
    fs.watch(root, { recursive: true }, (_, name) => {
      if (!name) return;
      const parts = name.split(path.sep);
      if (parts.some((x) => SKIP.has(x))) return;
      changed.add(parts.join('/'));
      clearTimeout(timer);
      timer = setTimeout(() => { for (const f of changed) emit({ type: 'file', file: f }); changed = new Set(); }, 150);
    });
  } catch { /* no recursive watching on this system: no live reload */ }
  // answers from agents without MCP
  if (fs.existsSync(dir(root))) fs.watchFile(file(root, 'replies.md'), { interval: 1000 }, () => pins.readReplies());

  return new Promise((resolve, reject) => {
    let tries = 0;
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE' && !port && tries++ < 30) { PORT++; if (BAD_PORTS.has(PORT)) PORT++; server.listen(PORT, '127.0.0.1'); }
      else reject(e);
    });
    server.on('listening', () => {
      if (fs.existsSync(dir(root))) writeJson(file(root, 'server.json'), { port: PORT, pid: process.pid, started: new Date().toISOString() });
      if (!quiet) { console.log(`unide: serving ${root}${dev ? ` through its ${dev.framework} dev server` : ''}`); console.log(`open   ${pageUrl(page)}`); }
      if (dev) getTarget().then((t) => !quiet && console.log(`       (${dev.framework} at localhost:${t.port})`), (e) => !quiet && console.log(`unide: ${e.message}`));
      resolve({ port: PORT, url: pageUrl(page), pins, close: () => server.close() });
    });
    server.listen(PORT, '127.0.0.1');
  });
}
