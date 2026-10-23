// Reading the page: what an element is called, which rule styles it, and which colour tokens it has.
import { host } from './core.js';
import { parse } from './colour.js';

// ---------- naming (a guess, said as one) ----------
const BY_TAG = { BUTTON: 'button', A: 'link', INPUT: 'text field', TEXTAREA: 'text area', SELECT: 'dropdown (select)', IMG: 'image',
  svg: 'icon / illustration', H1: 'heading', H2: 'heading', H3: 'heading', H4: 'heading', P: 'paragraph', LI: 'list item', NAV: 'navigation / sidebar', HEADER: 'header', DIALOG: 'dialog' };
const BY_CLASS = [[/bubble|msg|message|chat/, 'message bubble'], [/btn|button|send/, 'button'], [/card|tile/, 'card'], [/pill|badge|chip|tag|status/, 'badge / pill'],
  [/avatar|(^|-)av($|-)/, 'avatar'], [/head|header|bar|top/, 'header bar'], [/nav|menu|crumb/, 'navigation'], [/tab/, 'tab'], [/input|field|search/, 'text field'],
  [/modal|dialog|sheet|popover/, 'dialog / popover'], [/toast|notice/, 'toast'], [/ico|icon|mark|logo/, 'icon / mark'], [/name|label|title|meta|caption/, 'text label'], [/row|item|list/, 'list row'],
  [/panel|pane|side|drawer/, 'panel'], [/tip/, 'tooltip']];
const SEMANTIC = new Set(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'IMG', 'NAV', 'HEADER', 'DIALOG', 'H1', 'H2', 'H3', 'H4']);
export function nameOf(el) {
  if (SEMANTIC.has(el.tagName)) return BY_TAG[el.tagName];
  const cls = [...el.classList].join(' ').toLowerCase();
  for (const [re, n] of BY_CLASS) if (re.test(cls)) return n;
  if (BY_TAG[el.tagName]) return BY_TAG[el.tagName];
  return el.getAttribute('role') || 'element';
}
export const tagOf = (el) => el.tagName.toLowerCase() + [...el.classList].map((c) => '.' + c).join('');
export const snippet = (el) => { const t = (el.textContent || '').replace(/\s+/g, ' ').trim(); return t.length > 40 ? t.slice(0, 40) + '…' : t; };
// a path that finds the same element after the page re-renders
export function pathOf(el) {
  const parts = [];
  for (let e = el; e && e.nodeType === 1 && e !== document.documentElement; e = e.parentElement) {
    if (e.id) { parts.unshift('#' + CSS.escape(e.id)); break; }
    const sib = [...(e.parentElement?.children || [])].filter((x) => x.tagName === e.tagName);
    parts.unshift(e.tagName.toLowerCase() + [...e.classList].map((c) => '.' + CSS.escape(c)).join('') + (sib.length > 1 ? `:nth-of-type(${sib.indexOf(e) + 1})` : ''));
  }
  return parts.join(' > ');
}
// "all like this": same tag and classes, ignoring state classes such as on/open/active
const STATE = /^(on|off|open|closed|active|selected|current|hover|focus|disabled|is-.*|has-.*)$/;
export function likeSelector(el) {
  const cls = [...el.classList].filter((c) => !STATE.test(c));
  return cls.length ? el.tagName.toLowerCase() + cls.map((c) => '.' + CSS.escape(c)).join('') : null;
}
export const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
export const visible = (el) => { if (el === host || host.contains(el)) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

// ---------- which rule sets a property ----------
function* walk(list) {
  for (const r of list) {
    if (r.selectorText !== undefined) yield r;
    if (r.cssRules) yield* walk(r.cssRules);
  }
}
// the page's rules, or a shadow root's own (its <style> tags and adopted sheets)
export function allRules(root = document) {
  const out = [];
  for (const sh of [...root.styleSheets, ...(root.adoptedStyleSheets || [])]) {
    if (sh.ownerNode?.id?.startsWith('unide-')) continue;
    try { out.push(...walk(sh.cssRules)); } catch { /* another origin's sheet */ }
  }
  return out;
}
export function splitList(sel) {
  const out = []; let depth = 0, cur = '';
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && !depth) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  return [...out, cur.trim()].filter(Boolean);
}
export function specificity(sel) {
  const s = sel.replace(/:where\([^)]*\)/g, '');
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const cls = (s.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) || []).length;
  const tags = (s.replace(/\[[^\]]*\]|\([^)]*\)/g, '').match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
  return ids * 1e6 + cls * 1e3 + tags;
}
// a rule that only applies while hovered or focused isn't the element's resting style
export const TRANSIENT = /:(hover|focus|active|focus-visible|focus-within)\b/;
export const PROPS = {
  'background-color': { label: 'Background', reads: ['background-color', 'background'], writes: 'background-color' },
  color: { label: 'Text colour', reads: ['color'], writes: 'color' },
  'border-color': { label: 'Border', reads: ['border-color', 'border', 'border-top-color', 'border-top', 'border-bottom', 'border-left', 'border-right'], writes: 'border-color' },
};
// longhands are often set through a shorthand: font-size through font, row-gap through gap
const SHORT = { 'padding-top': 'padding', 'font-size': 'font', 'font-weight': 'font', 'font-family': 'font', 'line-height': 'font', 'row-gap': 'gap', 'column-gap': 'gap' };
const readsOf = (prop) => PROPS[prop]?.reads || [prop, SHORT[prop]].filter(Boolean);
export function winner(el, prop, list = allRules()) {
  let best = null, order = 0;
  for (const r of list) {
    order++;
    for (const name of readsOf(prop)) {
      const value = r.style.getPropertyValue(name);
      if (!value) continue;
      const part = splitList(r.selectorText).find((p) => { if (TRANSIENT.test(p)) return false; try { return el.matches(p); } catch { return false; } });
      if (!part) break;
      const cand = { rule: r, selector: part, full: r.selectorText, value: value.trim(), important: r.style.getPropertyPriority(name) === 'important', spec: specificity(part), order };
      if (!best || cand.important > best.important || (cand.important === best.important && (cand.spec > best.spec || (cand.spec === best.spec && cand.order >= best.order)))) best = cand;
      break;
    }
  }
  if (el.style.getPropertyValue(prop)) best = { selector: '(inline style attribute)', full: null, value: el.style.getPropertyValue(prop), inline: true };
  // a layered background paints its colour in the last layer
  const colourPart = best && prop === 'background-color' ? splitList(best.value).pop() : best?.value;
  if (best) best.token = (colourPart.match(/(?:^|\s)var\((--[\w-]+)\)(?:\s|$)/) || [])[1] || null;
  return best;
}
export const usersOf = (token, list = allRules()) => list.filter((r) => r.style.cssText.includes(`var(${token})`)).map((r) => r.selectorText);
export function effectiveBg(el) {
  for (let e = el; e; e = e.parentElement) {
    const c = parse(getComputedStyle(e).backgroundColor);
    if (c && c[3] > 0.5) return c;
  }
  return [255, 255, 255, 1];
}

// ---------- the page's colour tokens, per scope (:root, a palette, a theme) ----------
export function colourTokens() {
  const list = allRules(), scopes = new Map();
  list.forEach((r, order) => {
    const names = [...r.style].filter((p) => p.startsWith('--'));
    if (!names.length) return;
    for (const part of splitList(r.selectorText)) {
      if (TRANSIENT.test(part)) continue;
      let el;
      try { el = /^(:root|html)$/.test(part) ? document.documentElement : document.querySelector(part); } catch { continue; }
      if (!el) continue;
      // the same token on the same element: only the definition that wins is what you see
      for (const name of names) {
        const key = `${name}@${pathOf(el) || 'html'}`, spec = specificity(part);
        const prev = scopes.get(key);
        if (!prev || spec > prev.spec || (spec === prev.spec && order >= prev.order)) scopes.set(key, { name, selector: part, el, spec, order });
      }
    }
  });
  const out = [];
  for (const t of scopes.values()) {
    const raw = getComputedStyle(t.el).getPropertyValue(t.name).trim();
    const rgba = /^(-?[\d.]+\s*){3}$/.test(raw) ? null : parse(raw);
    if (!rgba) continue;
    out.push({ key: `${t.name}|${t.selector}`, name: t.name, selector: t.selector, raw, rgba, users: list.filter((r) => r.style.cssText.includes(`var(${t.name})`)).length });
  }
  const seen = new Set();
  return out.filter((t) => !seen.has(t.key) && seen.add(t.key)).sort((a, b) => b.users - a.users || a.name.localeCompare(b.name));
}
