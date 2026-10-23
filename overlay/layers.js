// What's under the pointer, top to bottom: the element a click lands on, the word there, its ::before/::after,
// then everything beneath (through transparent overlays, into open and closed shadow roots). Alt+click walks it.
import { host } from './core.js';
import { tagOf } from './dom.js';
import { isThreeCanvas, threeAt, label3, rect3 } from './three.js';

const closed = window.__unideEarly?.closed;
export const shadowOf = (el) => el.shadowRoot || closed?.get(el) || null;
const skip = (el) => el === host || el === document.documentElement || el === document.body;

// elements under a point, going into shadow roots (a host's insides come before the host)
function elementsAt(x, y, root = document, seen = new Set()) {
  const out = [];
  for (const el of root.elementsFromPoint(x, y)) {
    if (seen.has(el) || skip(el) || (root !== document && el.getRootNode() !== root)) continue;
    seen.add(el);
    const sr = shadowOf(el);
    if (sr) out.push(...elementsAt(x, y, sr, seen));
    out.push(el);
  }
  return out;
}

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null;
// the word under the pointer, as a range, when the pointer is really on it
function wordAt(x, y) {
  const pos = document.caretPositionFromPoint?.(x, y) || (() => { const r = document.caretRangeFromPoint?.(x, y); return r && { offsetNode: r.startContainer, offset: r.startOffset }; })();
  const node = pos?.offsetNode;
  if (!node || node.nodeType !== 3 || host.contains(node)) return null;
  const text = node.textContent;
  let start = pos.offset, end = pos.offset;
  if (segmenter) {
    for (const s of segmenter.segment(text)) if (s.index <= pos.offset && pos.offset <= s.index + s.segment.length && s.isWordLike) { start = s.index; end = s.index + s.segment.length; break; }
  } else {
    while (start > 0 && /\w/.test(text[start - 1])) start--;
    while (end < text.length && /\w/.test(text[end])) end++;
  }
  if (end <= start) return null;
  const range = document.createRange();
  range.setStart(node, start); range.setEnd(node, end);
  const hit = [...range.getClientRects()].some((r) => x >= r.left - 1 && x <= r.right + 1 && y >= r.top - 1 && y <= r.bottom + 1);
  if (!hit) return null;
  // the words around it, so it can be found again and the agent knows which occurrence
  return { el: node.parentElement, range, text: text.slice(start, end), before: text.slice(Math.max(0, start - 24), start), after: text.slice(end, end + 24) };
}

// a contains b, also across shadow roots
const holds = (a, b) => { for (let e = b; e; e = e.parentElement || e.getRootNode?.()?.host) if (e === a) return true; return false; };
const content = (el, pseudo) => { const c = getComputedStyle(el, pseudo).content; return c && c !== 'none' && c !== 'normal' ? c : null; };

// everything you can pin at this point, top first
export function stackAt(x, y, quick = false) {
  const els = elementsAt(x, y);
  if (!els.length) return [];
  const out = [{ kind: 'element', el: els[0] }];
  const w = wordAt(x, y);
  if (w && els.includes(w.el)) out.push({ kind: 'word', el: w.el, range: w.range, word: { text: w.text, before: w.before, after: w.after } });
  // decorations drawn by CSS on the top element and its nearest ancestors
  for (const el of els.slice(0, 3)) for (const pseudo of ['::before', '::after']) {
    const c = content(el, pseudo);
    if (c) out.push({ kind: 'pseudo', el, pseudo, content: c });
  }
  // beneath: what's painted under it, not the boxes it sits in (a click there would never land on those)
  const kept = [els[0]];
  for (const el of els.slice(1)) if (!kept.some((k) => holds(el, k))) { kept.push(el); out.push({ kind: 'element', el }); }
  // a 3D canvas: the objects drawn at this point, nearest first, come before the canvas itself
  const i = out.findIndex((t) => t.kind === 'element' && isThreeCanvas(t.el));
  if (i >= 0) out.splice(i, 0, ...threeAt(out[i].el, x, y, quick));
  return out.slice(0, 8);
}

export function label(t) {
  if (t.kind === 'three') return label3(t);
  if (t.kind === 'word') return `the word “${t.word.text}”`;
  const name = tagOf(t.el).split('.').slice(0, 2).join('.');
  if (t.kind === 'pseudo') return `${name}${t.pseudo} ${t.content.length > 14 ? t.content.slice(0, 13) + '…"' : t.content}`;
  const txt = (t.el.textContent || '').replace(/\s+/g, ' ').trim();
  return `${name}${txt && t.el.children.length < 3 ? ` “${txt.length > 18 ? txt.slice(0, 17) + '…' : txt}”` : ''}`;
}
export const rectOf = (t) => (t.kind === 'three' ? rect3(t.object, t.camera, t.el, t.instanceId) : t.kind === 'word' ? t.range.getBoundingClientRect() : t.el.getBoundingClientRect());

// the elements drawn above the chosen one that would take a click there
export function above(stack, i) {
  return stack.slice(0, i).filter((t) => t.kind === 'element' && !t.el.contains(stack[i].el) && !(stack[i].el.getRootNode()?.host === t.el)).map((t) => tagOf(t.el).split('.').slice(0, 2).join('.'));
}
