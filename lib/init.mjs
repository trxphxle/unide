// unide init: set a project up for every agent at once. unide remove: undo exactly what init did.
// Everything init changes is listed, and recorded in .unide/config.json so remove can reverse it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dir, file, readJson, writeJson, preferredPort, htmlPages } from './project.mjs';
import { detect } from './devserver.mjs';
import { routes } from './routes.mjs';

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'unide.mjs');
const START = '<!-- unide:start -->', END = '<!-- unide:end -->';
const has = (cmd) => { try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch { return false; } };
const exists = (p) => fs.existsSync(p);
// node as found on PATH (e.g. /opt/homebrew/bin/node), not a versioned path that breaks when node updates
function stableNode() {
  try {
    const p = execFileSync('which', ['node'], { encoding: 'utf8' }).trim();
    if (p && fs.realpathSync(p) === fs.realpathSync(process.execPath)) return p;
  } catch { /* not on PATH */ }
  return process.execPath;
}

function block(port) {
  return `${START}
## unide: the user points at UI by clicking

The user reviews HTML designs in **unide**, a local overlay: they click elements on a page and say what should change. Each click is a numbered pin. (If no unide tool or \`.unide/\` folder is available, ignore this section.)

- **Read the pins** with the unide MCP tool \`get_pins\` (without MCP, read \`.unide/pins.md\`). Do it before any UI or design work, and whenever the user mentions pins, unide, "what I clicked" or "what I pinned". Pins the user placed but didn't send come last, marked "not sent yet": act on them when the user refers to them, and say they're there otherwise.
- **A pin is the user pointing.** The element, its measurements, the component that drew it and where that's written (file:line), where its styles are written, and the page state are facts from the live page; the user's words are the intent. Each pin has a screenshot of the area as the user saw it (a PNG path under \`.unide/shots/\`): look at it when the words or facts leave the problem unclear. If the words are vague ("feels off"), offer 2–3 named options instead of guessing.
- **Edit the source** (components, stylesheets, templates and build inputs, not generated files). Pages update by themselves: through the project's own dev server and its hot reload when it has one (unide starts it if needed), otherwise by reloading.
- **Answer every pin** with \`resolve_pin\`: \`addressed\` and one line on what you changed, or \`skipped\` and why (without MCP, add \`#<id> addressed: …\` or \`#<id> skipped: …\` to \`.unide/replies.md\`). The user sees your line on the page. An addressed pin is then deleted with its screenshot, so read everything you need from it before you answer; a skipped one stays for the user. When a pin asks for options, build them side by side in the code marked \`data-unide-variant="<id>-A"\` (B, C) and answer \`options\`; the user picks one and sends it back, then keep only that one.
- **Give the link** to any design you create or change, from \`page_link\` with the file or route (or http://127.0.0.1:${port}/<route or file>).
- Record lasting design decisions in \`design-decisions.md\`.
${END}`;
}
function putBlock(f, text) {
  const cur = exists(f) ? fs.readFileSync(f, 'utf8') : '';
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  const next = re.test(cur) ? cur.replace(re, text) : (cur ? cur.replace(/\s*$/, '\n\n') : '') + text + '\n';
  fs.writeFileSync(f, next);
}
function takeBlock(f) {
  if (!exists(f)) return false;
  const cur = fs.readFileSync(f, 'utf8'), next = cur.replace(new RegExp(`\\n*${START}[\\s\\S]*?${END}\\n?`), '\n').replace(/\n{3,}$/, '\n');
  if (next === cur) return false;
  next.trim() ? fs.writeFileSync(f, next) : fs.rmSync(f);
  return true;
}
function mergeJson(f, key, name, entry) {
  const cur = readJson(f, {});
  cur[key] = { ...(cur[key] || {}), [name]: entry };
  writeJson(f, cur);
}
function unmergeJson(f, key, name, created) {
  if (!exists(f)) return;
  const cur = readJson(f, null);
  if (!cur?.[key]?.[name]) return;
  delete cur[key][name];
  if (!Object.keys(cur[key]).length) delete cur[key];
  created && !Object.keys(cur).length ? fs.rmSync(f) : writeJson(f, cur);
}
const CODEX = path.join(os.homedir(), '.codex', 'config.toml');
const codexHas = () => exists(CODEX) && /^\[mcp_servers\.unide\]/m.test(fs.readFileSync(CODEX, 'utf8'));
async function ask(q) {
  if (!process.stdin.isTTY) return false;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(q)).trim().toLowerCase();
  rl.close();
  return a === 'y' || a === 'yes';
}

export async function init(root, { codex } = {}) {
  root = path.resolve(root);
  const cfg = readJson(file(root, 'config.json'), { created: [], edited: [] });
  const done = [], created = new Set(cfg.created), edited = new Set(cfg.edited);
  const touch = (rel, isNew) => { (isNew ? created : edited).add(rel); };
  const port = preferredPort(root);
  const dirs = new Set(cfg.dirs || []);
  for (const d of ['.cursor', '.gemini', '.vscode']) if (!exists(path.join(root, d))) dirs.add(d);
  const command = stableNode(), args = [BIN, 'mcp', '--root', root];

  // 1. what's here
  fs.mkdirSync(dir(root), { recursive: true });
  const pages = htmlPages(root).slice(0, 50).map((p) => p.file);
  const templates = pages.filter((p) => exists(path.join(root, p.replace(/\.html$/, '.template.html'))));
  const dev = detect(root);
  if (dev) cfg.dev = { ...dev, lastPort: cfg.dev?.lastPort };
  const appRoutes = dev ? routes(root, dev.framework) : [];
  done.push(dev ? `.unide/ — pins and settings (${/^[AEIOU]/.test(dev.framework) ? 'an' : 'a'} ${dev.framework} app: unide runs in front of \`${dev.command.join(' ')}\`, ${appRoutes.length} route${appRoutes.length === 1 ? '' : 's'} found)`
    : `.unide/ — pins and settings (found ${pages.length} page${pages.length === 1 ? '' : 's'}${templates.length ? `, ${templates.length} built from templates` : ''})`);

  // 2. tell every agent: AGENTS.md (Codex, Cursor, Copilot and others), CLAUDE.md, GEMINI.md
  const text = block(port);
  for (const name of ['AGENTS.md']) { const f = path.join(root, name), isNew = !exists(f); putBlock(f, text); touch(name, isNew); done.push(`${name} — instructions for agents${isNew ? ' (new file)' : ''}`); }
  const claude = path.join(root, 'CLAUDE.md');
  if (!exists(claude)) { fs.writeFileSync(claude, `${START}\n@AGENTS.md\n${END}\n`); touch('CLAUDE.md', true); done.push('CLAUDE.md — new, points Claude Code at AGENTS.md'); }
  else if (!/^@AGENTS\.md\s*$/m.test(fs.readFileSync(claude, 'utf8'))) { putBlock(claude, text); touch('CLAUDE.md', false); done.push('CLAUDE.md — the same instructions'); }
  const gemini = path.join(root, 'GEMINI.md');
  if (exists(gemini) || has('gemini')) { const isNew = !exists(gemini); putBlock(gemini, text); touch('GEMINI.md', isNew); done.push(`GEMINI.md — the same instructions${isNew ? ' (new file)' : ''}`); }

  // 3. register the MCP server with each tool that's here; it starts unide by itself when the agent starts
  const entry = { command, args };
  let claudeDone = false;
  if (has('claude')) {
    try {
      execFileSync('claude', ['mcp', 'remove', 'unide', '-s', 'local'], { cwd: root, stdio: 'ignore' });
    } catch { /* wasn't there */ }
    try {
      execFileSync('claude', ['mcp', 'add', '-s', 'local', 'unide', '--', command, ...args], { cwd: root, stdio: 'ignore' });
      cfg.claudeLocal = true; claudeDone = true; done.push('Claude Code — MCP server, private to you (local scope)');
    } catch { /* fall back to the project file */ }
  }
  if (!claudeDone) { const f = path.join(root, '.mcp.json'), isNew = !exists(f); mergeJson(f, 'mcpServers', 'unide', entry); touch('.mcp.json', isNew); done.push('.mcp.json — MCP server for Claude Code'); }
  if (exists(path.join(root, '.cursor')) || exists(path.join(os.homedir(), '.cursor'))) {
    const f = path.join(root, '.cursor', 'mcp.json'), isNew = !exists(f); mergeJson(f, 'mcpServers', 'unide', entry); if (!created.has('.cursor/mcp.json')) touch('.cursor/mcp.json', isNew); done.push(`.cursor/mcp.json — MCP server for Cursor${isNew || created.has('.cursor/mcp.json') ? '' : ' (this file existed: the unide entry has a path on your Mac, so leave it out of commits)'}`);
  }
  if (exists(path.join(root, '.vscode'))) {
    const f = path.join(root, '.vscode', 'mcp.json'), isNew = !exists(f); mergeJson(f, 'servers', 'unide', { type: 'stdio', ...entry }); touch('.vscode/mcp.json', isNew); done.push('.vscode/mcp.json — MCP server for VS Code');
  }
  if (exists(path.join(root, '.gemini')) || has('gemini')) {
    const f = path.join(root, '.gemini', 'settings.json'), isNew = !exists(f); mergeJson(f, 'mcpServers', 'unide', entry); touch('.gemini/settings.json', isNew); done.push('.gemini/settings.json — MCP server for Gemini CLI');
  }
  // Codex keeps MCP servers in your home folder, so it's asked, and set up once for every project
  if (has('codex') && !codexHas()) {
    const yes = codex ?? await ask('Codex keeps MCP servers in ~/.codex/config.toml (outside this project). Add unide there, once for all projects? [y/N] ');
    if (yes) {
      fs.mkdirSync(path.dirname(CODEX), { recursive: true });
      fs.appendFileSync(CODEX, `\n# unide (added by unide init; finds the project from where Codex runs)\n[mcp_servers.unide]\ncommand = ${JSON.stringify(command)}\nargs = [${JSON.stringify(BIN)}, "mcp"]\n`);
      done.push('~/.codex/config.toml — MCP server for Codex, all projects');
    } else done.push('Codex — skipped (run "unide init --codex" to add it)');
  } else if (codexHas()) done.push('Codex — already set up');

  // 4. keep pins and machine-specific files out of git
  if (exists(path.join(root, '.git'))) {
    const gi = path.join(root, '.gitignore'), cur = exists(gi) ? fs.readFileSync(gi, 'utf8') : '';
    const lines = ['/.unide/', ...[...created].filter((f) => f.endsWith('.json')).map((f) => '/' + f)].filter((l) => !cur.split('\n').includes(l));
    if (lines.length) {
      fs.writeFileSync(gi, cur.replace(/\s*$/, cur ? '\n\n' : '') + `# unide (local pins and machine-specific settings)\n${lines.join('\n')}\n`);
      cfg.gitignore = [...new Set([...(cfg.gitignore || []), ...lines])];
      touch('.gitignore', !cur);
      done.push(`.gitignore — ${lines.join(', ')}`);
    }
  }

  writeJson(file(root, 'config.json'), { ...cfg, version: 1, port, pages, templates, created: [...created], edited: [...edited], dirs: [...dirs].filter((d) => exists(path.join(root, d))) });
  return { root, port, done, url: `http://127.0.0.1:${port}/${dev ? '' : pages[0] || ''}` };
}

export async function remove(root) {
  root = path.resolve(root);
  const cfg = readJson(file(root, 'config.json'), null);
  if (!cfg) return { done: [], missing: true };
  const done = [], created = new Set(cfg.created || []);
  for (const name of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']) if (takeBlock(path.join(root, name))) done.push(`${name} — instructions removed${exists(path.join(root, name)) ? '' : ' (file deleted)'}`);
  if (cfg.claudeLocal && has('claude')) { try { execFileSync('claude', ['mcp', 'remove', 'unide', '-s', 'local'], { cwd: root, stdio: 'ignore' }); done.push('Claude Code — MCP server removed'); } catch { /* already gone */ } }
  for (const [rel, key] of [['.mcp.json', 'mcpServers'], ['.cursor/mcp.json', 'mcpServers'], ['.vscode/mcp.json', 'servers'], ['.gemini/settings.json', 'mcpServers']]) {
    const f = path.join(root, rel);
    if (exists(f) && readJson(f, {})?.[key]?.unide) { unmergeJson(f, key, 'unide', created.has(rel)); done.push(`${rel} — unide removed`); }
  }
  if (cfg.gitignore?.length && exists(path.join(root, '.gitignore'))) {
    const gi = path.join(root, '.gitignore');
    const next = fs.readFileSync(gi, 'utf8').split('\n').filter((l) => !cfg.gitignore.includes(l) && l !== '# unide (local pins and machine-specific settings)').join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n');
    next.trim() ? fs.writeFileSync(gi, next) : fs.rmSync(gi);
    done.push('.gitignore — unide lines removed');
  }
  for (const d of cfg.dirs || []) { const f = path.join(root, d); try { if (exists(f) && !fs.readdirSync(f).filter((x) => x !== '.DS_Store').length) { fs.rmSync(f, { recursive: true }); done.push(`${d}/ — empty folder removed`); } } catch { /* leave it */ } }
  const pins = readJson(file(root, 'pins.json'), { pins: [] }).pins.length;
  fs.rmSync(dir(root), { recursive: true, force: true });
  done.push(`.unide/ — deleted${pins ? ` (${pins} pin${pins === 1 ? '' : 's'})` : ''}`);
  if (codexHas()) done.push('Codex — still set up for all projects in ~/.codex/config.toml (it does nothing in projects without .unide)');
  return { done };
}
