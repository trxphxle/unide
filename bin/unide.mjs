#!/usr/bin/env node
// unide: click your HTML pages to tell your coding agent what to change.
//   unide init      set this project up for your agents (run once)
//   unide           open: start the server for this project and print its link
//   unide remove    undo everything init did
//   unide mcp       the MCP server (your agent tools start this themselves)
import path from 'node:path';
import { findRoot, running } from '../lib/project.mjs';

const [cmd = 'open', ...rest] = process.argv.slice(2);
const flag = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : null; };
const root = path.resolve(flag('--root') || (cmd !== 'init' && rest[0] && !rest[0].startsWith('-') ? rest[0] : null) || findRoot());

if (cmd === 'mcp') {
  const { runMcp } = await import('../lib/mcp.mjs');
  runMcp(root);
} else if (cmd === 'init') {
  const { init } = await import('../lib/init.mjs');
  const target = rest[0] && !rest[0].startsWith('-') ? path.resolve(rest[0]) : process.cwd();
  const r = await init(target, { codex: rest.includes('--codex') ? true : rest.includes('--no-codex') ? false : undefined });
  console.log(`\nunide is set up in ${r.root}\n`);
  for (const d of r.done) console.log(`  ✓ ${d}`);
  console.log(`\nYour agents start unide by themselves (restart any that are open; Claude Code and Cursor may ask you to approve it once).`);
  console.log(`Or open it now:  ${r.url}\nUndo everything: unide remove\n`);
} else if (cmd === 'remove') {
  const { remove } = await import('../lib/init.mjs');
  const target = rest[0] && !rest[0].startsWith('-') ? path.resolve(rest[0]) : findRoot();
  const s = await running(target);
  if (s) try { process.kill(s.pid); } catch { /* already stopped */ }
  const r = await remove(target);
  if (r.missing) console.log(`unide isn't set up in ${target}`);
  else { console.log(`\nunide removed from ${target}\n`); for (const d of r.done) console.log(`  ✓ ${d}`); console.log(''); }
} else if (cmd === 'serve' || cmd === 'open') {
  const s = await running(root);
  if (s) console.log(`unide is already running for ${root}\nopen   ${s.url}/${flag('--page') || ''}`);
  else {
    const { start } = await import('../lib/server.mjs');
    await start({ root, page: flag('--page') || '', quiet: rest.includes('--quiet') });
  }
} else {
  console.log('usage: unide [init | open | remove | mcp]\n  init     set this project up for your agents (run once)\n  open     start unide for this project and print its link\n  remove   undo everything init did');
}
