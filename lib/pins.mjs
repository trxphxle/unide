// Pins: what the user clicked and said, stored once in .unide/pins.json.
// Agents read them through MCP or .unide/pins.md, and answer through MCP or .unide/replies.md.
import fs from 'node:fs';
import { file, readJson, writeJson } from './project.mjs';

export const STATUSES = ['draft', 'sent', 'addressed', 'skipped', 'dismissed'];
const OPEN = (p) => p.status === 'sent';

// changes made by hand on the page (overlay/edits.js keeps the same shape), in words for the agent
const SIDES = ['top', 'right', 'bottom', 'left'];
const LOOK_LABEL = { 'background-color': 'background', color: 'text colour', 'border-color': 'border colour', 'border-width': 'border width',
  'border-style': 'border style', 'border-radius': 'corner radius', padding: 'padding', 'font-family': 'typeface', 'font-size': 'text size',
  'font-weight': 'weight', 'letter-spacing': 'tracking', 'line-height': 'line height', 'text-transform': 'capitalisation', 'box-shadow': 'shadow' };
const nm = (x) => `${x.name} \`${x.tag}\`${x.text ? ` ("${x.text}")` : ''} at \`${x.path}\``;
export function editWords(ed) {
  if (!ed || !Object.keys(ed).some((k) => k !== 'at')) return []; // a state chosen, nothing changed yet
  const out = [], b = ed.box || {};
  if (ed.at && ed.at !== 'normal') out.push(`all of these for its ${ed.at} state only (${{ hover: ':hover', pressed: ':active', focus: ':focus-visible', disabled: ':disabled' }[ed.at]}), not how it normally looks`);
  if (ed.text) out.push(`text "${ed.text.from}" → "${ed.text.to}"`);
  if (ed.hide) out.push('remove it from the page');
  if (b.width) out.push(`width ${b.width[0]}px → ${b.width[1]}px`);
  if (b.height) out.push(`height ${b.height[0]}px → ${b.height[1]}px`);
  const pads = SIDES.filter((x) => b.padding?.[x]);
  if (pads.length) out.push(`padding ${pads.map((x) => `${x} ${b.padding[x][0]}px → ${b.padding[x][1]}px`).join(', ')}`);
  if (b.radius) out.push(`corner radius ${b.radius[0]}px → ${b.radius[1]}px`);
  if (ed.move) out.push(`move it ${ed.move.by < 0 ? 'before' : 'after'} ${nm(ed.move.next)}${Math.abs(ed.move.by) > 1 ? ` (${Math.abs(ed.move.by)} places)` : ''}`);
  const own = (x) => !(x.prop === 'border-radius' && b.radius) && !(x.prop === 'padding' && b.padding); // dragged after the look: those win
  for (const [p, c] of Object.entries(ed.type || {})) out.push(`${{ 'font-size': 'text size', 'font-weight': 'font weight', 'line-height': 'line height', 'letter-spacing': 'letter spacing', 'text-transform': 'capitals (text-transform)', 'text-align': 'alignment' }[p] || p} ${c.from} → ${c.to}${p === 'font-size' ? ' (prefer the project\'s type scale or tokens if one matches)' : ''}`);
  for (const [p, c] of Object.entries(ed.colour || {})) {
    const what = { color: 'text colour', 'background-color': 'background', 'border-color': 'border colour' }[p] || p;
    out.push(`${what} ${c.from} → ${c.to}${c.words ? ` (${c.words})` : ''}${c.token ? (c.token.exact ? `, which is the page's token \`${c.token.name}\`: use it` : `; the nearest token is \`${c.token.name}\` (${c.token.hex}): use it if they're close enough, otherwise add the colour`) : ''}${c.read ? `; contrast ${c.read.ratio}:1${c.read.ok ? '' : ', below the readable minimum: say so'}` : ''}`);
  }
  if (ed.image?.src) { const src = ed.image.src; out.push(`replace the image ${/^data:/.test(src.from) ? '(an inline image)' : src.from} with ${src.file ? `the file they dropped, ${src.file} (copy it into the project's images and use it there)` : src.url}`); }
  if (ed.image?.fit) out.push(`image fit ${ed.image.fit.from} → ${ed.image.fit.to} (object-fit, or background-size for a background)`);
  if (ed.image?.focus) out.push(`focal point ${ed.image.focus.to} (object-position / background-position: keep that part in view)`);
  if (ed.icon) out.push(`swap the icon (${ed.icon.from}) for Lucide's \`${ed.icon.to}\` (free, ISC licence, ${ed.icon.url}): use the project's Lucide package if it has one (lucide-react, lucide-vue-next, lucide-svelte…), else inline its SVG from ${ed.icon.svg}`);
  if (ed.font) out.push(`typeface ${ed.font.from} → "${ed.font.to}"${ed.font.url ? ` (free on Google Fonts, ${ed.font.url}${ed.font.installed ? '; they have it installed' : '; add it to the project as a web font, e.g. its @fontsource package or a <link>'})` : ''}`);
  if (ed.look) out.push(`give it the look of ${nm(ed.look.from)}: ${ed.look.diffs.filter(own).map((x) => `${LOOK_LABEL[x.prop] || x.prop} ${x.from} → ${x.to}`).join(', ')}`);
  return out;
}

export function createPins(root, { where, url, onChange }) {
  const store = () => readJson(file(root, 'pins.json'), { next: 1, pins: [] });
  let data = store();
  function save(event) {
    writeJson(file(root, 'pins.json'), data);
    fs.writeFileSync(file(root, 'pins.md'), markdown());
    onChange?.(event);
  }
  // Done is gone: a pin the agent addressed, or one the user dismissed, is deleted at once with its screenshots.
  // A skipped pin stays (with the agent's reason) until the user removes or re-sends it.
  // a pin's files: its screenshots, and images dropped on it
  const shotsOf = (p) => (p?.elements || []).flatMap((e) => [e.shot, e.edits?.image?.src?.file]).filter((f) => f?.startsWith(file(root, 'shots')) || f?.startsWith(file(root, 'assets')));
  function flush(p) {
    for (const f of shotsOf(p)) fs.rmSync(f, { force: true });
    data.pins = data.pins.filter((x) => x !== p);
  }
  // screenshots no pin refers to (a layer switched, a pin deleted while unide was off); recent ones may still be on their way
  function sweep() {
    const dirShots = file(root, 'shots'), keep = new Set(data.pins.flatMap(shotsOf));
    let names = [];
    try { names = fs.readdirSync(dirShots); } catch { return; }
    for (const n of names) {
      const f = `${dirShots}/${n}`;
      try { if (!keep.has(f) && Date.now() - fs.statSync(f).mtimeMs > 10 * 60e3) fs.rmSync(f, { force: true }); } catch { /* gone */ }
    }
  }
  if (data.pins.some((p) => p.status === 'addressed' || p.status === 'dismissed')) { for (const p of data.pins.filter((p) => p.status === 'addressed' || p.status === 'dismissed')) flush(p); save(); }
  sweep();
  const get = (id) => data.pins.find((p) => p.id === +id);
  // a new pin takes the lowest number not in use, so deleted pins don't push the count up.
  // Pins that exist keep their numbers: an agent may be working on #3 and must answer the right one.
  function freeId() {
    const used = new Set(data.pins.map((p) => p.id));
    let i = 1;
    while (used.has(i)) i++;
    return i;
  }
  // an old answer in replies.md for a number that's now someone else's must not resolve the new pin
  function forgetReplies(id) {
    const f = file(root, 'replies.md');
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch { return; }
    const kept = text.split('\n').filter((l) => !new RegExp(`^#${id}\\s+(addressed|skipped)\\s*:`, 'i').test(l));
    if (kept.length !== text.split('\n').length) fs.writeFileSync(f, kept.join('\n'));
  }

  function upsert(input) {
    const now = new Date().toISOString();
    let p = input.id ? get(input.id) : null;
    // a late save for a pin that was deleted meanwhile must not bring it back (under a number that's free again)
    if (input.id && !p) return { id: +input.id, gone: true };
    if (!p) { p = { id: freeId(), created: now, status: 'draft' }; data.pins.push(p); forgetReplies(p.id); }
    for (const k of ['page', 'note', 'elements', 'detail', 'title']) if (input[k] !== undefined) p[k] = input[k];
    if (input.status && STATUSES.includes(input.status) && !(input.status === 'draft' && p.status !== 'draft')) p.status = input.status;
    p.updated = now;
    if (p.status === 'dismissed') { flush(p); save(); return { id: p.id, gone: true }; }
    save();
    return p;
  }
  function remove(id) {
    const p = get(id);
    if (p) flush(p);
    save();
  }
  // send this page's drafts (or all drafts) to the agent
  function send(page) {
    let n = 0;
    for (const p of data.pins) if (p.status === 'draft' && (!page || p.page === page)) { p.status = 'sent'; p.sent = new Date().toISOString(); n++; }
    if (n) save();
    return n;
  }
  // the agent's answer: an addressed pin is flushed on the spot; the open page shows the agent's line once
  function answer(p, status, reply) {
    const out = { id: p.id, page: p.page, status, reply: String(reply).slice(0, 2000) };
    if (status === 'addressed') {
      // the screenshots go with the answer, so the open page can show before and after; it keeps them in memory only
      out.before = shotsOf(p).filter((f) => f.startsWith(file(root, 'shots')) && fs.existsSync(f) && fs.statSync(f).size < 2e6).slice(0, 3)
        .map((f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`);
      out.elements = (p.elements || []).map(({ path, tag, text, three, word }) => ({ path, tag, text, three, word }));
      out.note = p.note || '';
      flush(p); out.flushed = true;
    }
    else Object.assign(p, { status, reply: out.reply, resolved: new Date().toISOString() });
    return out;
  }
  function resolve(id, status, reply = '') {
    const p = get(id);
    if (!p) return null;
    if (!['addressed', 'skipped'].includes(status)) throw new Error('status must be "addressed" or "skipped"');
    const out = answer(p, status, reply);
    save({ answered: [out] });
    return out;
  }
  const list = (page) => data.pins.filter((p) => !page || p.page === page);
  const open = () => data.pins.filter(OPEN);
  // pinned but not sent: the user may still be at it, or may just tell the agent "what I pinned" in chat
  const unsent = () => data.pins.filter((p) => p.status === 'draft' && (p.note || p.elements?.length));

  // ---------- what the agent reads ----------
  function pinMarkdown(p) {
    const out = [`## Pin #${p.id} · ${p.page} · ${p.status === 'draft' ? 'not sent yet' : p.status}`, `Link: ${url(p.page)}`];
    out.push(p.note ? `The user says: "${p.note}"` : (p.elements || []).some((e) => e.edits) ? 'No words on this pin: what they changed by hand (below) is the request.' : 'No words on this pin: what they told you in chat may say what they want ("remove what I pinned"); if not, ask, or offer 2–3 named options.');
    const els = p.elements || [];
    if (els.length) {
      out.push(els.length > 1 ? `They picked ${els.length} elements, to judge together:` : 'They picked:');
      els.forEach((e, i) => {
        const fromPage = new Map((e.sources || []).map((x) => [x.selector, x]));
        const c = e.component, at = c?.file ? `${c.file}${c.line ? `:${c.line}` : ''}` : null;
        // a rule the page names but no file line explains, on a single class: a utility class (Tailwind and the like),
        // which is written where the component writes className, not in a stylesheet
        const utilities = [], rules = [];
        for (const s of e.selectors || []) {
          const src = fromPage.get(s), w = src?.line ? `${src.file}:${src.line}` : where(s, p.page, src?.file);
          if (!w && /^\.[\w\\:/.\[\]%#-]+$/.test(s)) utilities.push(s.slice(1).replace(/\\/g, ''));
          else rules.push(`\`${s}\`${w ? ` at ${w}` : src?.file ? ` in ${src.file}` : ''}`);
        }
        const tag = e.tag.split('.')[0], who = c ? (c.name ? (c.name.startsWith('<') ? c.name : `<${c.name}>`) : `a ${c.framework} component`) : null;
        const parts = [`${els.length > 1 ? `${i + 1}. ` : '- '}${e.three ? `a ${e.name} (in the \`${tag}\`)` : e.name === 'element' ? 'an element' : `probably a ${e.name}`}${e.three ? '' : ` \`${tag}\``}${e.text ? ` ("${e.text}")` : ''}: ${e.facts}`];
        if (e.shadowHost) parts.push(`inside the ${e.shadowMode} shadow root of <${e.shadowHost}>`);
        if (who) parts.push(`${e.shadowHost && !c.name?.startsWith('<') ? `<${e.shadowHost}> is used by` : 'drawn by'} ${who}${at ? ` at ${at}` : ''}${c.definedAt && c.definedAt !== at ? ` (the component is defined at ${c.definedAt})` : ''}`);
        if (utilities.length || (e.classes && !rules.length)) parts.push(`styled by utility classes \`${e.classes}\`${at ? `, written in its className at ${at}` : ''}`);
        if (rules.length) parts.push(`styled by ${rules.join('; ')}`);
        out.push(parts.join('; ') + '.');
        const sub = (t) => out.push(`  - ${t}`);
        if (e.part) sub(`They mean ${e.part}, not the whole element.`);
        const hand = editWords(e.edits);
        if (hand.length) sub(`They changed it on the page by hand (a preview, nothing written): ${hand.join('; ')}. Make the code do exactly this, for this element only unless their words say otherwise${e.edits.look ? '; for the look, prefer reusing that element\'s classes or tokens over copying values' : ''}. The screenshot shows it before the change.`);
        if (e.layer?.index > 1) sub(`Under the pointer it's layer ${e.layer.index} of ${e.layer.count}${e.layer.above?.length ? `, beneath ${e.layer.above.map((a) => `\`${a}\``).join(', ')} (on top: that takes the clicks)` : ''}.`);
        if (e.viewport?.size || (e.viewport && e.viewport.w < 900)) sub(`Seen at ${e.viewport.w} × ${e.viewport.h}${e.viewport.size ? ` (${e.viewport.size}, in unide's Sizes view)` : ''}: the change may be needed only at that size; check the project's breakpoints.`);
        if (e.frozen) sub('Pinned while the page was frozen (timers, animations and hover held): it may only exist while hovered or open, or until a timer runs.');
        if (e.shot) sub(`Screenshot of the area as they saw it, the pinned part outlined: ${e.shot}`);
      });
      if (els[0]?.state) out.push(`Page state when they looked: \`${els[0].state}\``);
    }
    if (p.detail) out.push('', 'Details from unide Tools:', '', p.detail.replace(/^## Design request from unide\n+/, ''));
    if (p.reply) out.push(`Your answer: ${p.status}: ${p.reply}`);
    return out.join('\n');
  }
  function markdown() {
    const o = open();
    const head = [`# unide pins`, ``, `What the user clicked on their pages and said should change. Facts (element, measurements, file:line, page state) are read from the live page; their words are the intent. Names marked "probably" are guesses; check file:line before editing.`,
      `Answer each pin with the unide MCP tool \`resolve_pin\`, or add a line to .unide/replies.md: \`#<id> addressed: what you did\` or \`#<id> skipped: why\`.`, ``];
    const u = unsent();
    const later = u.length ? ['', '# Not sent yet', '', 'The user placed these but hasn\'t pressed Send: they may still be pinning. Act on them when they refer to them ("what I pinned", "these"); otherwise just mention they\'re there. Answer them the same way.', '', u.map(pinMarkdown).join('\n\n')] : [];
    return [...head, o.length ? o.map(pinMarkdown).join('\n\n') : '_No sent pins._', ...later, ''].join('\n');
  }

  // answers written to .unide/replies.md by agents without MCP; each line is taken out of the file once it's applied
  function readReplies() {
    const f = file(root, 'replies.md');
    let text = '';
    try { text = fs.readFileSync(f, 'utf8'); } catch { return 0; }
    const answered = [], used = new Set();
    for (const m of text.matchAll(/^#(\d+)\s+(addressed|skipped)\s*:\s*(.+)$/gim)) {
      const p = get(m[1]);
      if (p && (p.status === 'sent' || p.status === 'draft')) { answered.push(answer(p, m[2].toLowerCase(), m[3].trim())); used.add(m[0]); }
    }
    if (!answered.length) return 0;
    fs.writeFileSync(f, text.split('\n').filter((l) => !used.has(l)).join('\n'));
    save({ answered });
    return answered.length;
  }

  return { upsert, remove, send, resolve, list, open, unsent, get, markdown, pinMarkdown, readReplies, reload: () => (data = store()) };
}
