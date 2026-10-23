// The unide MCP server (stdio). Agent tools launch it; it starts the project's unide server if it isn't
// running, then answers tool calls from that server. stdout carries only JSON-RPC; logs go to stderr.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { running, dir } from './project.mjs';

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'unide.mjs');
const log = (...a) => process.stderr.write(`[unide] ${a.join(' ')}\n`);

async function ensureServer(root) {
  let s = await running(root);
  if (s) return s;
  const child = spawn(process.execPath, [BIN, 'serve', '--root', root, '--quiet'], { detached: true, stdio: 'ignore' });
  child.unref();
  for (let i = 0; i < 40 && !s; i++) { await new Promise((r) => setTimeout(r, 150)); s = await running(root); }
  if (!s) throw new Error('could not start the unide server');
  log(`started ${s.url} for ${root}`);
  return s;
}
const call = async (s, p, body) => {
  const r = await fetch(s.url + p, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(t);
  try { return JSON.parse(t); } catch { return t; }
};

const TOOLS = [
  { name: 'get_pins', description: 'Get what the user clicked on their pages in unide and said should change: the pins they sent, then the ones they placed but haven\'t sent yet (marked "not sent yet"). Call this before any UI or design work, and whenever the user mentions pins, unide, "what I clicked" or "what I pinned". Each pin has the element, its measurements, where its style is written (file:line), the page state, the user\'s words, and a screenshot of the area (its path, and the image).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'resolve_pin', description: 'Answer one pin after you dealt with it: "addressed" with one line on what you changed (the pin and its screenshot are then cleared), "skipped" with why (it stays for the user), or "options" when they asked for options and you built them marked data-unide-variant (one line saying what differs: A: …, B: …, C: …). The user sees your line on the page.',
    inputSchema: { type: 'object', properties: { id: { type: 'integer', description: 'Pin number' }, status: { type: 'string', enum: ['addressed', 'skipped', 'options'] }, reply: { type: 'string', description: 'One line for the user' } }, required: ['id', 'status', 'reply'], additionalProperties: false } },
  { name: 'page_link', description: 'The unide link for a page, to give the user after you create or change a design: an HTML file, a page file of the framework (e.g. app/settings/page.tsx, src/routes/about/+page.svelte), or a route like /settings. Opening it shows the page with unide on it; it updates by itself when files change (through the project\'s own dev server when it has one).',
    inputSchema: { type: 'object', properties: { file: { type: 'string', description: 'A file relative to the project (moodboard/hansi.html, app/page.tsx) or a route (/settings)' } }, required: ['file'], additionalProperties: false } },
  { name: 'list_pages', description: 'List the project\'s pages (HTML files, or the framework\'s routes) with their unide links.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
];
const INSTRUCTIONS = 'unide is how the user points at UI: they click elements on their HTML pages and say what should change. Call get_pins before design work and whenever the user mentions what they pinned (unsent pins are included, marked); answer each pin with resolve_pin; give the user page_link links to designs you create or change.';

async function tool(root, name, args) {
  const s = await ensureServer(root);
  if (name === 'get_pins') {
    const open = await call(s, '/__unide/pins/open?format=json');
    if (!open.length) return `No pins, sent or unsent. They click things on a page in unide and press Send; give them a link with page_link (pages: ${(await call(s, '/__unide/pages')).slice(0, 3).map((p) => p.url).join(', ') || 'none yet'}).`;
    // the screenshots too, so agents that read images see what the user saw without opening files
    const images = [];
    for (const e of open.flatMap((p) => p.elements || [])) {
      if (images.length >= 6 || !e.shot || !fs.existsSync(e.shot) || fs.statSync(e.shot).size > 1.5e6) continue;
      images.push({ type: 'image', data: fs.readFileSync(e.shot).toString('base64'), mimeType: 'image/png' });
    }
    return [{ type: 'text', text: await call(s, '/__unide/pins/open') }, ...images];
  }
  if (name === 'resolve_pin') { const p = await call(s, '/__unide/pins/resolve', args); return p.status === 'options' ? `Pin #${p.id}: the options are ready; the user flips between them on the page and sends back the one to keep.` : p.flushed ? `Pin #${p.id} is done and cleared (with its screenshot). If the page is open, the user sees your line there.` : `Pin #${p.id} marked ${p.status}. It stays on the page with your reason until the user removes or re-sends it.`; }
  if (name === 'page_link') {
    const f = String(args.file || '').replace(/^\/+/, '');
    const isRoute = !f || !/\.[a-z0-9]+$/i.test(f.split('/').pop());
    if (!isRoute && !fs.existsSync(path.join(root, f))) return `No file ${f} in ${root}. Pages: ${(await call(s, '/__unide/pages')).map((p) => p.route || p.file).slice(0, 10).join(', ')}`;
    return (await call(s, '/__unide/link?file=' + encodeURIComponent(f))).url;
  }
  if (name === 'list_pages') { const pages = await call(s, '/__unide/pages'); return pages.length ? pages.map((p) => `${p.route ? `${p.route}${p.file ? ` (${p.file})` : ''}` : p.file} — ${p.url}`).join('\n') : 'No pages yet.'; }
  throw new Error(`unknown tool ${name}`);
}

export function runMcp(root) {
  if (!fs.existsSync(dir(root))) log(`no .unide in ${root}; run "unide init" there`);
  const write = (m) => process.stdout.write(JSON.stringify(m) + '\n');
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (line) handle(line);
    }
  });
  async function handle(line) {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    const { id, method, params } = msg;
    const reply = (result) => id !== undefined && write({ jsonrpc: '2.0', id, result });
    const fail = (code, message) => id !== undefined && write({ jsonrpc: '2.0', id, error: { code, message } });
    if (method === 'initialize') return reply({ protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'unide', version: '0.2.0' }, instructions: INSTRUCTIONS });
    if (method === 'ping') return reply({});
    if (method === 'tools/list') return reply({ tools: TOOLS });
    if (method === 'tools/call') {
      try { const r = await tool(root, params.name, params.arguments || {}); return reply({ content: Array.isArray(r) ? r : [{ type: 'text', text: r }] }); }
      catch (e) { return reply({ content: [{ type: 'text', text: `unide: ${e.message}` }], isError: true }); }
    }
    if (method?.startsWith('notifications/')) return;
    fail(-32601, `unknown method ${method}`);
  }
}
