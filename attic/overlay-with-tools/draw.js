// Drawn over the page every frame: selection boxes, the look being copied, spacing lines, alignment marks.
import { S, $, requestAnimationFrame } from './core.js';
import { gapPairs, median } from './measure.js';

export function place(box, el) {
  const r = el.getBoundingClientRect();
  Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  return r;
}
const ensure = (parent, n, make) => { while (parent.children.length < n) parent.append(make()); return [...parent.children]; };
const div = (className, inner) => () => Object.assign(document.createElement('div'), { className, innerHTML: inner });

export function follow() {
  for (const s of S.sels) if (!s.el.isConnected) s.el = document.querySelector(s.path) || s.el;
  const ref = S.d.like?.el;
  const targets = [...S.sels.map((s) => ({ el: s.el })), ...(ref ? [{ el: ref, ref: true }] : [])];
  ensure($('.boxes'), targets.length, div('box', '<i></i>')).forEach((b, i) => {
    const t = targets[i];
    if (!t || !t.el.isConnected) return void (b.style.display = 'none');
    place(b, t.el);
    b.classList.toggle('ref', !!t.ref);
    b.firstChild.textContent = t.ref ? 'look to copy' : S.sels.length > 1 ? i + 1 : '';
    b.firstChild.style.display = t.ref || S.sels.length > 1 ? 'block' : 'none';
  });
  // spacing lines between group members: unequal ones red, ones with other content between grey
  const pairs = S.sels.length > 1 && S.sels.length <= 40 ? gapPairs(S.sels.map((s) => s.el)) : [];
  const med = median(pairs.filter((p) => p.empty).map((p) => p.px));
  ensure($('.lines'), pairs.length, div('ln', '<b></b>')).forEach((l, i) => {
    const p = pairs[i];
    if (!p || !p.dir || p.px <= 0) return void (l.style.display = 'none');
    const A = p.ra, B = p.rb;
    l.classList.toggle('bad', p.empty && Math.abs(p.px - med) > 2);
    l.classList.toggle('mid', p.between);
    l.classList.toggle('h', p.dir === 'h');
    if (p.dir === 'v') {
      const x = (Math.max(A.left, B.left) + Math.min(A.right, B.right)) / 2 || B.left + 12;
      Object.assign(l.style, { display: 'block', left: x + 'px', top: A.bottom + 'px', width: '1.5px', height: p.px + 'px' });
    } else {
      const y = (Math.max(A.top, B.top) + Math.min(A.bottom, B.bottom)) / 2 || B.top + 8;
      Object.assign(l.style, { display: 'block', left: A.right + 'px', top: y + 'px', width: p.px + 'px', height: '1.5px' });
    }
    l.firstChild.textContent = p.px + 'px' + (p.between ? ' · not empty' : '');
  });
  // alignment near-misses
  const issues = S.lens.align ? S.alignIssues : [];
  ensure($('.aligns'), issues.length * 2, div('al', '<b></b>')).forEach((m, i) => {
    const is = issues[i >> 1];
    if (!is || !is.a.isConnected || !is.b.isConnected) return void (m.style.display = 'none');
    const ra = is.a.getBoundingClientRect(), rb = is.b.getBoundingClientRect();
    const r = i % 2 ? rb : ra, top = Math.min(ra.top, rb.top), bottom = Math.max(ra.bottom, rb.bottom);
    Object.assign(m.style, { display: 'block', left: r[is.edge] + 'px', top: top + 'px', height: bottom - top + 'px' });
    m.firstChild.textContent = i % 2 ? '' : `${is.delta}px off`;
    m.firstChild.style.display = i % 2 ? 'none' : 'block';
  });
  requestAnimationFrame(follow);
}
