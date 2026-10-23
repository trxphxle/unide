// Finding a project's dev server (Vite, Next.js, Nuxt, SvelteKit, Astro, Angular, Webpack, Rspack, Bun…),
// starting it when it isn't running, and learning which port it chose.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { readJson } from './project.mjs';

// what each tool is called in package.json, and the port it uses unless told otherwise
const TOOLS = [
  ['next', 'Next.js', 3000], ['nuxt', 'Nuxt', 3000], ['@sveltejs/kit', 'SvelteKit', 5173], ['astro', 'Astro', 4321],
  ['@angular/cli', 'Angular', 4200], ['@remix-run/dev', 'Remix', 5173], ['@react-router/dev', 'React Router', 5173],
  ['@tanstack/react-start', 'TanStack Start', 3000], ['@solidjs/start', 'SolidStart', 3000], ['@builder.io/qwik', 'Qwik', 5173],
  ['@rsbuild/core', 'Rsbuild', 3000], ['@rspack/cli', 'Rspack', 8080], ['webpack-dev-server', 'Webpack', 8080],
  ['parcel', 'Parcel', 1234], ['bun', 'Bun', 3000], ['vite', 'Vite', 5173],
];
const SCRIPT_NAMES = ['dev', 'start', 'serve', 'develop'];

function packageManager(root) {
  if (fs.existsSync(path.join(root, 'bun.lockb')) || fs.existsSync(path.join(root, 'bun.lock'))) return 'bun';
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

// the dev server described by package.json, or null for a plain HTML project
export function detect(root) {
  const pkg = readJson(path.join(root, 'package.json'), null);
  if (!pkg) return null;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const scripts = pkg.scripts || {};
  const name = SCRIPT_NAMES.find((s) => scripts[s] && !/^(node|tsx|ts-node)\b/.test(scripts[s]) && /(vite|next|nuxt|astro|ng |ng$|webpack|rspack|rsbuild|parcel|remix|react-router|vinxi|bun|svelte-kit|qwik)/.test(scripts[s]));
  if (!name) return null;
  const tool = TOOLS.find(([dep]) => deps[dep]) || TOOLS.find(([, label]) => scripts[name].toLowerCase().includes(label.toLowerCase().split(/[ .]/)[0])) || [null, 'dev server', null];
  const pm = packageManager(root);
  return { framework: tool[1], script: name, command: [pm, pm === 'npm' ? ['run', name] : [name]].flat(), port: tool[2] };
}

export const reachable = (port) => new Promise((ok) => {
  const s = net.connect({ host: '127.0.0.1', port }, () => { s.destroy(); ok(true); });
  s.on('error', () => {
    // some dev servers listen on ::1 only (Node resolves "localhost" to IPv6 first)
    const s6 = net.connect({ host: '::1', port }, () => { s6.destroy(); ok('::1'); });
    s6.on('error', () => ok(false));
  });
});
// the folder the server listening on a port runs from (lsof, on macOS and Linux), or null when that can't be told
const run = (cmd, args) => new Promise((ok) => execFile(cmd, args, { timeout: 3000 }, (err, out) => ok(err ? '' : out)));
export async function servedFrom(port) {
  const pid = (await run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp'])).match(/^p(\d+)/m)?.[1];
  if (!pid) return null;
  return (await run('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'])).match(/^n(.+)$/m)?.[1] || null;
}
// is the server on this port this project's own (not another project's dev server on the same usual port)
export async function ours(port, root) {
  const cwd = await servedFrom(port);
  if (!cwd) return null; // can't tell
  const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
  const a = real(cwd), b = real(root);
  return a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
}
export async function hostFor(port) { const r = await reachable(port); return r === '::1' ? '::1' : r ? '127.0.0.1' : null; }

// start the dev server and read its port from what it prints (e.g. "Local: http://localhost:5174/")
export function startDev(root, dev, log = () => {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(dev.command[0], dev.command.slice(1), { cwd: root, env: { ...process.env, BROWSER: 'none', FORCE_COLOR: '0', NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', done = false;
    const finish = (v, err) => { if (done) return; done = true; clearTimeout(timer); err ? reject(err) : resolve(v); };
    const scan = (chunk) => {
      out += chunk;
      log(String(chunk));
      const m = out.replace(/\x1b\[[0-9;]*m/g, '').match(/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0):(\d{2,5})/);
      if (m) finish({ child, port: +m[1], https: /https:\/\//.test(m[0]) });
    };
    child.stdout.on('data', scan); child.stderr.on('data', scan);
    child.on('exit', (code) => finish(null, new Error(`the dev server stopped (exit ${code}):\n${out.slice(-1500)}`)));
    // some servers never print a URL: fall back to the tool's usual port once it answers
    const timer = setTimeout(async () => { if (dev.port && await reachable(dev.port)) finish({ child, port: dev.port, https: false }); else finish(null, new Error(`the dev server didn't say where it is:\n${out.slice(-1500)}`)); }, 60000);
  });
}
