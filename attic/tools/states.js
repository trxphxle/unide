// Forcing hover, focus, pressed or disabled on what you picked. JavaScript can't set :hover, so the
// page's own state rules are copied without their condition and applied to the picked elements.
import { S } from './core.js';
import { allRules, splitList, pathOf } from './dom.js';
import { providers } from './preview.js';

export const STATES = { rest: 'Resting', hover: 'Hover', focus: 'Focus', pressed: 'Pressed', disabled: 'Disabled' };
const PSEUDO = { hover: ':hover\\b', focus: ':focus(?:-visible|-within)?\\b', pressed: ':active\\b', disabled: ':disabled\\b|\\[disabled\\]' };

let cache = { key: '', css: '', count: 0 };
function build() {
  const st = S.d.state;
  if (st === 'rest' || !S.sels.length) return { css: '', count: 0 };
  const key = st + '|' + S.sels.map((s) => s.path).join(',');
  if (cache.key === key) return cache;
  const has = new RegExp(PSEUDO[st]), strip = new RegExp(PSEUDO[st], 'g'), out = [];
  for (const r of allRules()) {
    for (const part of splitList(r.selectorText)) {
      if (!has.test(part)) continue;
      const bare = part.replace(strip, '').trim();
      if (!bare || /[>+~]$/.test(bare)) continue;
      const body = [...r.style].map((p) => `${p}:${r.style.getPropertyValue(p)} !important`).join(';');
      if (!body) continue;
      for (const s of S.sels) {
        let targets;
        try { targets = s.el.matches(bare) ? [s.el] : [...s.el.querySelectorAll(bare)].slice(0, 20); } catch { continue; }
        for (const t of targets) out.push(`${pathOf(t)}{${body}}`);
      }
    }
  }
  return (cache = { key, css: out.join('\n'), count: out.length });
}
export const stateCss = () => build().css;
// how many of the page's rules the forced state brought in (0 means the page has no style for it)
export const stateRuleCount = () => build().count;
providers.unshift({ id: 'state', css: stateCss }); // first, so your knobs still win over the state's styles
