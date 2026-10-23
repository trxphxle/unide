// Keeping what you tried, and writing the request: intent first, then measured facts, then where you landed.
import { S, freshPage, PAGE, pageState, render } from './core.js';
import { hex, words, movesInWords } from './colour.js';
import { PROPS, winner } from './dom.js';
import { draftCss, clean } from './preview.js';
import { facts, factLine, gapPairs, gapWords } from './measure.js';
import { groupMode, groupChanges, singleChanges, feelMoved, feelWords, feelLanded, swapType, SWAPS, leadMoved, measuredOrder,
  hasSelDraft, clearSelection, where, lookup, LIKE_LABEL } from './selection.js';
import { changedTokens, tokenValue, hasPageDraft, scaleMapping, RATIOS } from './page.js';
import { STATES } from './states.js';

const factsOf = (s) => ({ name: s.name, tag: s.tag, text: s.text, path: s.path, facts: facts(s.el),
  selectors: [...new Set([...s.drafts.filter((d) => d.win && !d.win.inline).map((d) => d.win.selector), ...Object.values(s.style)])] });

function selectionItem(kind) {
  const d = S.d, many = groupMode();
  const it = clean(() => ({ kind, note: d.note.trim(), members: S.sels.map(factsOf), gaps: many ? gapWords(gapPairs(S.sels.map((s) => s.el))) : [],
    origin: d.origin, hexes: d.hexes, directions: [], state: d.state !== 'rest' ? STATES[d.state].toLowerCase() : null }));
  it.css = kind === 'lock' ? '' : draftCss(['selection']);
  if (kind === 'lock') return it;
  it.colour = many ? groupChanges() : singleChanges();
  for (const c of many ? it.colour.slice(0, 1) : it.colour) {
    const label = PROPS[c.prop].label.toLowerCase();
    const how = [c.picked && `set to ${c.picked} (picked from the screen)`, movesInWords(c.steps)].filter(Boolean).join(', then ');
    it.directions.push(`${label} ${how}${many ? ' on each, keeping each one\'s own colour' : ''}`);
  }
  if (feelMoved(d.feel)) { it.directions.push(...feelWords(d.feel)); it.feel = S.sels.map(feelLanded); }
  const likes = (d.like?.diffs || []).filter((x) => x.on);
  if (likes.length) { it.like = { name: d.like.name, tag: d.like.tag, text: d.like.text, diffs: likes }; it.directions.push(`styled like ${d.like.name} \`${d.like.tag}\``); }
  if (d.swap) { it.swap = { type: swapType(), to: d.swap, desc: SWAPS[swapType()].find((o) => o[0] === d.swap)?.[1] }; it.directions.push(`becomes a ${d.swap}`); }
  if (d.variants) { it.variants = true; it.directions.push('3 versions to compare'); }
  if (leadMoved()) { it.lead = { want: d.lead.map((i) => i + 1), now: measuredOrder().map((i) => i + 1) }; it.directions.push(`noticed in the order ${it.lead.want.join(' → ')}`); }
  if (d.equalize) { it.equalize = { to: d.equalize.to, was: d.equalize.pairs.map((p) => p.px) }; it.directions.push(`equal spacing of ${d.equalize.to}px`); }
  it.kind = it.directions.length ? 'change' : 'note';
  return it;
}

function pageItem(note) {
  const it = { kind: 'page', note, directions: [], css: draftCss(['page']), members: [] };
  it.tokens = changedTokens().map((t) => {
    const v = tokenValue(t);
    return { name: t.name, selector: t.selector, from: hex(t.rgba, t.rgba[3]), fromWords: words(t.rgba), to: v.hex, toWords: words(v.rgb), users: t.users,
      moves: [t.set && `set to ${t.set}`, movesInWords(t.steps)].filter(Boolean).join(', then ') };
  });
  for (const t of it.tokens) it.directions.push(`token \`${t.name}\`: ${t.fromWords} → ${t.toWords}`);
  if (S.page.scale) {
    const sc = S.page.scale;
    const rows = scaleMapping().filter((r) => r.to !== r.from).map((r) => {
      const w = clean(() => winner(r.sample, 'font-size'));
      if (w && !w.inline) lookup(w.selector);
      return { from: r.from, to: r.to, count: r.count, rule: w && !w.inline ? w.selector : null };
    });
    it.scale = { base: sc.base, ratio: sc.ratio, name: RATIOS.find((x) => x[0] === sc.ratio)?.[1] || String(sc.ratio), rows };
    it.directions.push(`a type scale from ${sc.base}px, ratio ${sc.ratio}`);
  }
  if (S.page.fonts) {
    const f = S.page.fonts;
    const rule = (role) => { const t = f.targets.find((x) => x.role === role); const w = t && clean(() => winner(t.el, 'font-family')); if (w && !w.inline) lookup(w.selector); return w && !w.inline ? w.selector : null; };
    it.fonts = { heading: f.heading, body: f.body, was: f.was, headingRule: f.heading ? rule('heading') : null, bodyRule: f.body ? rule('body') : null };
    if (f.heading) it.directions.push(`headings in ${f.heading}`);
    if (f.body) it.directions.push(`body text in ${f.body}`);
  }
  return it;
}

// Keep: the selection's draft and the page's draft each become an item. Lock: only the selection.
export function keep(kind = 'change') {
  const note = S.d.note.trim(), out = [], sel = hasSelDraft(), page = kind !== 'lock' && hasPageDraft();
  // words with nothing moved on the selection describe the page-wide change, if there is one
  const noteForPage = page && !sel && kind !== 'lock';
  if (S.sels.length && (kind === 'lock' || sel || (note && !noteForPage))) out.push(selectionItem(kind));
  if (page) out.push(pageItem(noteForPage || !S.sels.length ? note : ''));
  if (!S.sels.length && !out.length && note) out.push({ kind: 'note', note, members: [], directions: [], gaps: [], css: '' });
  S.items.push(...out);
  S.page = freshPage();
  clearSelection();
}
export const canKeep = () => hasSelDraft() || hasPageDraft() || !!S.d.note.trim();

// ---------- the request ----------
const who = (m) => `${m.name === 'element' ? 'an element' : `probably a ${m.name}`} — \`${m.tag}\`${m.text ? ` ("${m.text}")` : ''}`;
function memberLines(it) {
  const many = it.members.length > 1, out = [];
  if (it.members.length > 8) {
    // big groups: one line per kind of element instead of one per element
    const kinds = [];
    for (const m of it.members) {
      const key = `${m.tag.replace(/\.(on|open|active|selected|current)\b/g, '')}|${m.selectors[0] || ''}`;
      const k = kinds.find((x) => x.key === key);
      k ? k.list.push(m) : kinds.push({ key, list: [m] });
    }
    out.push(`- ${it.members.length} elements of ${kinds.length} kind${kinds.length > 1 ? 's' : ''}:`);
    for (const k of kinds.slice(0, 15)) {
      const m = k.list[0], texts = k.list.map((x) => x.text).filter(Boolean).slice(0, 3).map((t) => `"${t}"`).join(', ');
      out.push(`  - ${k.list.length}× ${m.name === 'element' ? 'element' : `probably a ${m.name}`} \`${m.tag}\`${texts ? ` (${texts}${k.list.length > 3 ? ', …' : ''})` : ''}: ${factLine(m.facts)}${m.selectors.length ? `; styled by \`${m.selectors[0]}\` (${where(m.selectors[0])})` : ''}`);
    }
    if (kinds.length > 15) out.push(`  - …and ${kinds.length - 15} more kinds`);
    return out;
  }
  // members that look and are styled the same share one line
  const rows = [];
  it.members.forEach((m, k) => {
    const ch = it.colour?.filter((c) => c.path === m.path) || [];
    const feel = it.feel?.[k];
    const body = `${factLine(m.facts)}${m.selectors.length ? `; styled by ${m.selectors.map((s) => `\`${s}\``).join(', ')} (${where(m.selectors[0])})` : ''}`
      + `${ch.map((c) => `; ${PROPS[c.prop].label.toLowerCase()} landed on \`${c.from}\` → \`${c.to}\` (${c.toWords})`).join('')}${feel?.length ? `; feel landed on ${feel.join(', ')}` : ''}`;
    const same = rows.find((r) => r.tag === m.tag && r.body === body);
    same ? same.list.push({ k, m }) : rows.push({ tag: m.tag, body, list: [{ k, m }] });
  });
  for (const r of rows) {
    const m = r.list[0].m, nums = r.list.map((x) => x.k + 1).join(', ');
    const texts = r.list.map((x) => x.m.text).filter(Boolean).map((t) => `"${t}"`).join(', ');
    out.push(!many ? `- Element: \`${m.tag}\`${m.text ? ` ("${m.text}")` : ''}: ${r.body}`
      : r.list.length > 1 ? `- ${nums}. ${r.list.length}× ${m.name === 'element' ? 'element' : `probably a ${m.name}`} \`${m.tag}\` (${texts}), alike: ${r.body}`
      : `- ${nums}. ${who(m)}: ${r.body}`);
  }
  return out;
}
function selectionLines(it) {
  const many = it.members.length > 1, out = [];
  const title = it.kind === 'lock' ? 'Locked' : it.kind === 'note' ? 'Note' : 'Change';
  out.push(`### ${title}: ${many ? `${it.members.length} elements, judged together` : it.members.length ? who(it.members[0]) : 'the page'}`);
  if (it.origin) out.push(`- Found through ${it.origin}`);
  if (it.hexes?.length) out.push(`- Where these colours are written: ${it.hexes.map((h) => { const w = where(h); return `\`${h}\` ${w === 'not found in project files' ? '(not written in the source; probably computed, e.g. by color-mix or opacity)' : `at ${w}`}`; }).join(' · ')}`);
  if (it.state) out.push(`- The user judged ${many ? 'them' : 'it'} in the **${it.state}** state (forced). Apply changes to that state's rules.`);
  if (it.note) out.push(`- ${it.kind === 'lock' ? 'Why' : 'Wants'}: "${it.note}"`);
  for (const dir of it.directions || []) out.push(`- Direction: ${dir}`);
  if (it.like) out.push(`- Make ${many ? 'them' : 'it'} look like ${who(it.like)} in: ${it.like.diffs.map((x) => `${LIKE_LABEL[x.prop]} \`${x.from}\` → \`${x.to}\``).join('; ')}. Prefer reusing that element's rules or tokens over copying values.`);
  if (it.swap) out.push(`- Replace the ${it.swap.type} with a **${it.swap.to}** (${it.swap.desc}) Keep what it does; change its form.`);
  if (it.variants) out.push(`- Build 3 named versions of this, switchable on the page (for example \`?variant=a|b|c\` or a small switcher), keeping the current one as the default, so the user can compare before choosing.`);
  if (it.lead) out.push(`- Hierarchy: the user wants them noticed in the order ${it.lead.want.join(' → ')}; measured now (size, weight, contrast): ${it.lead.now.join(' → ')}. Adjust emphasis to get that order.`);
  if (it.equalize) out.push(`- Spacing: make the empty gaps between them equal at ${it.equalize.to}px (now ${it.equalize.was.join(', ')}px). Gaps with other content between are left alone.`);
  if (it.kind === 'lock') out.push(`- Keep ${many ? 'these' : 'it'} exactly as ${many ? 'they look' : 'it looks'} now. Don't change ${[...new Set(it.members.flatMap((m) => m.selectors))].map((s) => `\`${s}\``).join(', ') || 'their styles'} or the tokens they use.`);
  for (const c of (!many && it.colour) || []) {
    if (c.scope === 'token') out.push(`- Colour scope: the token \`${c.token}\` everywhere (used by ${c.users.length} rules: ${c.users.slice(0, 6).map((u) => `\`${u}\``).join(', ')}${c.users.length > 6 ? ', …' : ''}); defined at ${where(c.token + ':')}`);
    else out.push(`- Colour scope: only \`${c.selector}\` (set as \`${c.value}\`).${c.shared ? ` That rule also styles ${c.shared} other selector${c.shared > 1 ? 's' : ''}; split this one out rather than changing them.` : ''}${c.token ? ` Don't change \`${c.token}\` itself.` : ''}`);
  }
  out.push(...memberLines(it));
  if (it.gaps?.length) out.push(`- Spacing between them as rendered: ${it.gaps.join(' · ')}`);
  const names = [...new Set(it.members.map((m) => m.name))].join(', ');
  if (it.kind === 'lock') out.push(`- Record: ${it.members.map((m) => `${m.name} (\`${m.tag}\`)`).join(', ')} approved as is${it.note ? `: "${it.note}"` : ''}. Don't restyle unless the user asks.`);
  if (it.kind === 'change') out.push(`- Record: ${names}: ${it.directions.join('; ')}${it.note ? `, because "${it.note}"` : ''}.`);
  return out;
}
function pageLines(it) {
  const out = [`### Page-wide: ${it.directions.join('; ') || 'a note'}`];
  if (it.note) out.push(`- Wants: "${it.note}"`);
  for (const t of it.tokens || []) {
    out.push(`- Token \`${t.name}\` in \`${t.selector}\`: \`${t.from}\` (${t.fromWords}) → \`${t.to}\` (${t.toWords})${t.moves ? `; moved: ${t.moves}` : ''}. Used by ${t.users} rule${t.users === 1 ? '' : 's'}; defined at ${where(t.name + ':')}. Change the definition in that scope only.`);
  }
  if (it.scale) {
    const s = it.scale;
    out.push(`- Type scale: base ${s.base}px, ratio ${s.ratio} — ${s.name}. Snap each text size to the nearest step:`);
    for (const r of s.rows) out.push(`  - ${r.from}px → ${r.to}px (${r.count}×${r.rule ? `; set by \`${r.rule}\` at ${where(r.rule)}` : ''})`);
    out.push(`  - Prefer defining the steps once (tokens such as \`--text-1\` … or a scale in the build) over scattering values.`);
  }
  if (it.fonts) {
    const f = it.fonts;
    if (f.heading) out.push(`- Headings: **${f.heading}** (was ${f.was.heading || 'unknown'})${f.headingRule ? `; their font is set by \`${f.headingRule}\` at ${where(f.headingRule)}` : ''}.`);
    if (f.body) out.push(`- Body text: **${f.body}** (was ${f.was.body || 'unknown'})${f.bodyRule ? `; set by \`${f.bodyRule}\` at ${where(f.bodyRule)}` : ''}.`);
    out.push(`- Load them from Google Fonts (https://fonts.google.com), or bundle them the way the project bundles its other fonts. Keep monospace text as it is.`);
  }
  out.push(`- Record: page-wide: ${it.directions.join('; ')}${it.note ? `, because "${it.note}"` : ''}.`);
  return out;
}
export function requestMarkdown() {
  const state = pageState();
  const out = [`## Design request from unide`, ``, `Page: \`${PAGE}\`${state ? `, seen with \`${state}\`` : ''}`, ``,
    `How to read this: each item starts with what the user wants, in their words and as a direction. Elements, measurements, files and page state are facts read from the live page. Values marked "landed on" are where the user ended up while previewing: aim for that look, but prefer a fix that fits the project's tokens and scale. Names marked "probably" are guesses. Source lines are likely locations; check them before editing.`,
    `Apply changes in the source files. If a file is generated, edit its template or build input and rerun the build.`,
    ...(state ? [`The user judged the page in that state. If a style differs between states (a palette, a theme), change it only for that state unless the scope says otherwise.`] : []),
    `Then add each "Record" line to \`design-decisions.md\` at the project root (create it if missing), and follow that file in future UI work. For notes, ask the user if the fix isn't clear.`, ``];
  const refs = S.refs.filter((r) => r.note || r.colours.length);
  if (refs.length) {
    out.push(`References the user likes (images you can open):`);
    for (const r of refs) out.push(`- ${r.file}${r.note ? ` — "${r.note}"` : ''}${r.colours.length ? `; colours picked from it: ${r.colours.join(', ')}` : ''}`);
    out.push('');
  }
  S.items.forEach((it, i) => {
    const lines = it.kind === 'page' ? pageLines(it) : selectionLines(it);
    lines[0] = lines[0].replace(/^### /, `### ${i + 1}. `);
    out.push(...lines, '');
  });
  return out.join('\n');
}
