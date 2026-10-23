// What you picked, and everything you're trying on it: colour knobs, feel, "like that one", swap, lead order, spacing.
import { S, zero, freshDraft, PAGE, render, $ } from './core.js';
import { parse, toOklch, oklchToRgb, hex, fmtOklch, words, shift, moved, clamp, round, px } from './colour.js';
import { nameOf, tagOf, snippet, pathOf, allRules, winner, usersOf, effectiveBg, PROPS, splitList, likeSelector } from './dom.js';
import { providers, clean, decl } from './preview.js';
import { gapPairs, weightOf } from './measure.js';

export const groupMode = () => S.sels.length > 1;

// ---------- where styles live in the project (asked of the server) ----------
export function lookup(q) {
  if (S.locate[q]) return;
  S.locate[q] = 'loading';
  S.pending.push(fetch('/__unide/locate?q=' + encodeURIComponent(q) + '&page=' + encodeURIComponent(PAGE)).then((r) => r.json())
    .then((hits) => { S.locate[q] = hits; render(); }, () => { S.locate[q] = []; render(); }));
}
// the rule itself before rules nested in it, this page's files before others
export function best(q) {
  const hits = S.locate[q];
  if (!Array.isArray(hits)) return hits;
  const exact = hits.filter((h) => h.exact), pool = exact.length ? exact : hits, here = pool.filter((h) => h.here);
  // once the real source is found, its generated copies are noise
  const near = here.length ? here : pool, src = near.filter((h) => !h.generated);
  return (src.length ? src : near).slice(0, 3);
}
export function where(q) {
  const hits = best(q);
  if (!Array.isArray(hits) || !hits.length) return 'not found in project files';
  return hits.map((h) => `${h.file}:${h.line}${h.generated ? ` (generated${h.generated.from ? ` from ${h.generated.from}` : ''}${h.generated.builders?.length ? `; build: ${h.generated.builders.join(', ')}` : ''})` : ''}`).join(' · ');
}

// ---------- selecting ----------
function captureBase(el) {
  const cs = getComputedStyle(el), flex = /flex|grid/.test(cs.display);
  return { fs: px(cs.fontSize), fw: +cs.fontWeight || 400, color: parse(cs.color), bg: parse(cs.backgroundColor),
    pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px),
    gap: flex ? px(cs.rowGap) : 0, colGap: flex ? px(cs.columnGap) : 0,
    radius: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(px),
    mt: px(cs.marginTop), ml: px(cs.marginLeft), under: effectiveBg(el.parentElement || el) };
}
export function makeSel(el) {
  const sr = el.getRootNode?.(), list = allRules(sr instanceof ShadowRoot ? sr : document), cs = getComputedStyle(el), drafts = [];
  for (const prop of Object.keys(PROPS)) {
    if (prop === 'border-color' && !px(cs.borderTopWidth) && !px(cs.borderBottomWidth)) continue;
    const rgba = parse(cs.getPropertyValue(prop));
    if (!rgba || rgba[3] === 0) continue;
    const win = winner(el, prop, list);
    let tokenRgba = null, users = [];
    if (win?.token) { tokenRgba = parse(cs.getPropertyValue(win.token).trim()); users = usersOf(win.token, list); }
    drafts.push({ prop, rgba, win, tokenRgba, users, steps: zero(), set: null, scope: 'rule' });
    if (win && !win.inline) lookup(win.selector);
    if (win?.token) lookup(win.token + ':');
  }
  // which rules set the spacing and type, for the request
  const style = {}, styleRules = {};
  for (const p of ['padding-top', 'row-gap', 'font-size', 'font-weight', 'font-family', 'line-height', 'border-radius']) {
    const w = winner(el, p, list);
    if (w && !w.inline) { style[p] = w.selector; styleRules[w.selector] = w.rule; lookup(w.selector); }
  }
  for (const d of drafts) if (d.win?.rule) styleRules[d.win.selector] = d.win.rule;
  return { el, path: pathOf(el), name: nameOf(el), tag: tagOf(el), text: snippet(el), drafts, style, styleRules, base: captureBase(el) };
}
export function membersChanged() {
  const props = Object.keys(PROPS).filter((p) => S.sels.some((s) => s.drafts.some((d) => d.prop === p)));
  if (!props.includes(S.d.colour.prop)) S.d.colour.prop = props[0] || null;
  S.d.lead = null; S.d.equalize = null; // member numbers changed
  if (S.mode === 'review') S.mode = 'inspect'; // Review has nothing about the selection
  $('.panel').classList.add('open');
  render();
}
export function selectOnly(el) { S.sels = [makeSel(el)]; S.d = freshDraft(); membersChanged(); }
export function selectMany(els, origin = '', hexes = []) {
  S.sels = els.map(makeSel); S.d = freshDraft(); S.d.origin = origin; S.d.hexes = hexes;
  hexes.forEach(lookup); // where each colour is written in the source
  membersChanged();
}
export function toggle(el) {
  const i = S.sels.findIndex((s) => s.el === el);
  i >= 0 ? S.sels.splice(i, 1) : S.sels.push(makeSel(el));
  membersChanged();
}
export function clearSelection() { S.sels = []; S.d = freshDraft(); render(); }
export const selectAllLike = () => selectMany([...document.querySelectorAll(likeSelector(S.sels[0].el))].slice(0, 40));

// ---------- colour knobs ----------
export const baseOf = (d) => (d.scope === 'token' && d.tokenRgba ? d.tokenRgba : d.rgba);
// steps move from the element's colour, or from a colour you picked with the eyedropper
export function result(d, steps = d.steps, set = d.set) {
  const b0 = baseOf(d), b = set ? [...parse(set).slice(0, 3), b0[3]] : b0;
  const rgb = oklchToRgb(shift(toOklch(b), steps));
  return { from: hex(b0, b0[3]), to: hex(rgb, b0[3]), toOk: fmtOklch(toOklch(rgb)), fromWords: words(b0), toWords: words(rgb), rgb, a: b0[3], picked: set || null };
}
const changed = (steps, set) => moved(steps) || !!set;
function changeOf(sel, d, steps = d.steps, set = d.set, byPath = false) {
  return { prop: d.prop, scope: d.scope, token: d.win?.token, full: d.win?.full, selector: d.win?.selector, inline: d.win?.inline, byPath,
    shared: d.win?.full ? splitList(d.win.full).length - 1 : 0, path: sel.path, name: sel.name, tag: sel.tag, text: sel.text,
    value: d.win?.value, users: d.users, steps: { ...steps }, ...result(d, steps, set) };
}
// a group's colour knobs shift each member's own colour by the same steps
export function groupChanges() {
  const c = S.d.colour;
  if (!groupMode() || !c.prop || !changed(c.steps, c.set)) return [];
  return S.sels.flatMap((s) => s.drafts.filter((d) => d.prop === c.prop).map((d) => changeOf(s, { ...d, scope: 'rule' }, c.steps, c.set, true)));
}
export const singleChanges = () => (groupMode() || !S.sels[0] ? [] : S.sels[0].drafts.filter((d) => changed(d.steps, d.set)).map((d) => changeOf(S.sels[0], d)));
export function cssFor(c) {
  if (c.scope === 'token') return `*{${c.token}:${c.to} !important}`;
  if (c.byPath || c.inline || !c.selector) return `${c.path}{${PROPS[c.prop].writes}:${c.to} !important}`;
  return `${c.selector}{${PROPS[c.prop].writes}:${c.to} !important}`;
}
// the colour a member has after the colour knobs, which the feel knobs start from
function colourAfter(sel, prop) {
  const d = sel.drafts.find((x) => x.prop === prop);
  if (!d) return null;
  const g = groupMode(), steps = g ? (S.d.colour.prop === prop ? S.d.colour.steps : zero()) : d.steps;
  const set = g ? (S.d.colour.prop === prop ? S.d.colour.set : null) : d.set;
  if (!changed(steps, set)) return null;
  const r = result(g ? { ...d, scope: 'rule' } : d, steps, set);
  return [...r.rgb, r.a];
}

// ---------- feel: one plain word moves several properties, and the request names each one ----------
// mood and tone are presets of the plain knobs, so the agent always sees which properties they moved
const effective = (f) => ({ e: f.e + 0.5 * f.mood, d: f.d - 0.5 * f.mood, c: f.mood + 0.5 * f.play, r: f.play });
export const feelMoved = (f) => !!(f.e || f.d || f.mood || f.play);
export function feelDecls(sel) {
  const x = effective(S.d.feel), b = sel.base, out = {};
  if (!feelMoved(S.d.feel)) return out;
  if (x.e) {
    out['font-weight'] = String(clamp(Math.round((b.fw + 100 * x.e) / 100) * 100, 100, 900));
    out['font-size'] = `${round(b.fs * 1.06 ** x.e)}px`;
  }
  const bg = colourAfter(sel, 'background-color') || b.bg, fg = colourAfter(sel, 'color') || b.color;
  const ownBg = bg && bg[3] > 0.05;
  if ((x.e || x.c) && fg) {
    // louder pushes text away from what's behind it (and makes see-through text more solid); quieter brings it closer
    const o = toOklch(fg), behind = toOklch(ownBg ? bg : b.under), dir = o.L >= behind.L ? 1 : -1;
    const a = fg[3] < 1 ? clamp(fg[3] + 0.08 * x.e, 0.2, 1) : 1;
    out.color = hex(oklchToRgb({ L: clamp(o.L + dir * 0.035 * x.e), C: Math.max(0, o.C + 0.015 * x.c), H: o.H }), a);
  }
  if ((x.c || x.e) && ownBg) {
    const o = toOklch(bg);
    out['background-color'] = hex(oklchToRgb({ L: o.L, C: Math.max(0, o.C + 0.015 * (x.c + 0.5 * x.e)), H: o.H }), bg[3]);
  }
  if (x.d) {
    const k = 1.18 ** x.d;
    out.padding = b.pad.map((p) => `${p ? round(p * k) : Math.max(0, 2 * x.d)}px`).join(' ');
    if (b.gap) out['row-gap'] = `${round(b.gap * k)}px`;
    if (b.colGap) out['column-gap'] = `${round(b.colGap * k)}px`;
  }
  if (x.r) out['border-radius'] = b.radius.map((r) => `${Math.max(0, r + 3 * x.r)}px`).join(' ');
  return out;
}
const stepsWord = (n, up, down) => `${Math.abs(n)} step${Math.abs(n) > 1 ? 's' : ''} ${n > 0 ? up : down}`;
export function feelWords(f) {
  const out = [];
  if (f.e) out.push(`${stepsWord(f.e, 'louder', 'quieter')} (emphasis: weight, size, contrast)`);
  if (f.d) out.push(`${stepsWord(f.d, 'airier', 'more compact')} (density: padding and gaps)`);
  if (f.mood) out.push(`${stepsWord(f.mood, 'more energetic', 'calmer')} (mood: colour intensity, density and emphasis together)`);
  if (f.play) out.push(`${stepsWord(f.play, 'more playful', 'more serious')} (tone: corner radius and a little colour)`);
  return out;
}
// the feel values before and after, for the request
export function feelLanded(sel) {
  const b = sel.base, decls = feelDecls(sel);
  const from = { 'font-weight': String(b.fw), 'font-size': `${b.fs}px`, color: b.color && hex(b.color, b.color[3]), 'background-color': b.bg && b.bg[3] > 0.05 ? hex(b.bg) : 'none',
    padding: b.pad.map((p) => p + 'px').join(' '), 'row-gap': `${b.gap}px`, 'column-gap': `${b.colGap}px`, 'border-radius': b.radius.map((r) => r + 'px').join(' ') };
  return Object.entries(decls).map(([p, v]) => `${p} ${from[p]} → ${v}`);
}

// ---------- make it like that one ----------
const LIKE_PROPS = ['background-color', 'color', 'border-color', 'border-width', 'border-style', 'border-radius', 'padding', 'font-family',
  'font-size', 'font-weight', 'letter-spacing', 'line-height', 'text-transform', 'box-shadow'];
export const LIKE_LABEL = { 'background-color': 'background', color: 'text colour', 'border-color': 'border colour', 'border-width': 'border width', 'border-style': 'border style',
  'border-radius': 'corner radius', padding: 'padding', 'font-family': 'typeface', 'font-size': 'text size', 'font-weight': 'weight', 'letter-spacing': 'tracking',
  'line-height': 'line height', 'text-transform': 'capitalisation', 'box-shadow': 'shadow' };
export function setLike(refEl) {
  const target = S.sels[0]?.el;
  if (!target || S.sels.some((s) => s.el === refEl)) return render();
  const diffs = clean(() => {
    const a = getComputedStyle(target), b = getComputedStyle(refEl);
    return LIKE_PROPS.map((p) => ({ prop: p, from: a.getPropertyValue(p), to: b.getPropertyValue(p), on: true })).filter((x) => x.from !== x.to);
  });
  S.d.like = { el: refEl, name: nameOf(refEl), tag: tagOf(refEl), text: snippet(refEl), path: pathOf(refEl), diffs };
  render();
}
const likeDecls = () => Object.fromEntries((S.d.like?.diffs || []).filter((x) => x.on).map((x) => [x.prop, x.to]));

// ---------- swap the component: names you might not know, and what each is for ----------
export const SWAPS = {
  'list row': [['card', 'Each item in its own raised box; more room for detail.'], ['table row', 'Aligned columns; best for comparing values.'],
    ['tile', 'Items in a grid of squares; best when there are pictures.'], ['compact list', 'One line each, no extras; best for long lists.'], ['timeline item', 'Items on a line in time order.']],
  button: [['ghost button', 'Text with a faint fill on hover; quieter than a filled button.'], ['outlined button', 'A border, no fill; secondary actions.'],
    ['text link', 'Just underlined text; the quietest action.'], ['icon button', 'Only an icon; for familiar actions in tight space.'], ['segmented control', 'A row of joined buttons where one is chosen.']],
  tab: [['segmented control', 'Joined buttons, one chosen; for 2–5 short options.'], ['pill tabs', 'Rounded chips; softer than underlined tabs.'],
    ['underline tabs', 'Text with a line under the chosen one; the classic.'], ['dropdown', 'One button that opens a list; saves space.'], ['sidebar nav', 'A vertical list; for many sections.']],
  card: [['list row', 'A single line; denser.'], ['tile', 'A square in a grid.'], ['accordion', 'A header that opens to show its content.'], ['table row', 'Columns instead of a box.']],
  'dialog / popover': [['side panel (drawer)', 'Slides in from the edge; the page stays visible.'], ['popover', 'A small box next to what opened it.'],
    ['inline expand', 'Opens in place, pushing content down.'], ['bottom sheet', 'Rises from the bottom; common on phones.'], ['full page', 'Its own screen.']],
  'badge / pill': [['dot indicator', 'Just a coloured dot.'], ['plain text label', 'No box, only words.'], ['count bubble', 'A small number in a circle.'], ['icon', 'A symbol instead of words.']],
  toggle: [['switch', 'On/off slider; takes effect at once.'], ['checkbox', 'A tick box; often confirmed with a button.'], ['segmented control', 'Joined buttons.'], ['radio group', 'Pick one of a few, all visible.']],
  'text field': [['search bar', 'A field with a search icon, often rounded.'], ['combobox', 'A field that suggests matches as you type.'], ['inline edit', 'Text that becomes a field when clicked.']],
  'navigation / sidebar': [['top tabs', 'Sections across the top.'], ['icon rail', 'A thin column of icons that expands.'], ['collapsible sidebar', 'A sidebar that folds away.'],
    ['command palette', 'A search box for every place and action (⌘K).'], ['breadcrumb', 'The path to where you are.']],
  'header bar': [['floating toolbar', 'A detached bar with rounded ends.'], ['sticky header', 'Stays at the top while scrolling.'], ['minimal title', 'Just the title, no bar.']],
  'message bubble': [['card', 'A boxed message with more structure.'], ['plain transcript', 'No bubbles, just names and text.'], ['inline annotation', 'A note attached to the thing it is about.']],
};
export const swapType = () => S.d.swapType || (SWAPS[S.sels[0]?.name] ? S.sels[0].name : 'list row');

// ---------- what should lead, and even spacing ----------
export const measuredOrder = () => clean(() => S.sels.map((s, i) => ({ i, w: weightOf(s.el) })).sort((a, b) => b.w - a.w).map((x) => x.i));
export function leadMoved() {
  if (!S.d.lead) return false;
  const now = measuredOrder();
  return S.d.lead.some((v, i) => v !== now[i]);
}
export function startEqualize(to) {
  S.d.equalize = { to, pairs: clean(() => gapPairs(S.sels.map((s) => s.el))).filter((p) => p.empty).map(({ a, b, dir, px: p }) => ({ a, b, dir, px: p })) };
}
function equalizeDecls(i) {
  const q = S.d.equalize;
  if (!q) return {};
  const p = q.pairs.find((x) => x.b === i);
  if (!p || !p.dir || p.px === q.to) return {};
  const s = S.sels[i], delta = q.to - p.px;
  return p.dir === 'v' ? { 'margin-top': `${round(s.base.mt + delta)}px` } : { 'margin-left': `${round(s.base.ml + delta)}px` };
}

// ---------- the selection's preview, and whether anything moved ----------
providers.push({ id: 'selection', css: () => {
  const out = [...singleChanges(), ...groupChanges()].map(cssFor);
  S.sels.forEach((s, i) => out.push(decl(s.path, { ...feelDecls(s), ...likeDecls(), ...equalizeDecls(i) })));
  return out.filter(Boolean).join('\n');
} });
export function hasSelDraft() {
  const d = S.d;
  return !!(singleChanges().length || groupChanges().length || feelMoved(d.feel) || d.like?.diffs.some((x) => x.on) || d.swap || d.variants || d.equalize || leadMoved());
}
