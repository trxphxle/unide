// Before and after, for pins the agent just finished. The pin and its screenshot are already gone (done is gone),
// so the answer carries the screenshot; this page keeps it in memory for this visit only. Compare takes a fresh
// picture of the same area and puts the two together: side by side, or one over the other with a wipe.
import { esc } from './core.js';
import { shoot } from './shot.js';

export const done = []; // answers this visit, newest first, with their before pictures
export function remember(list) {
  for (const a of list || []) if (a.flushed && a.before?.length && a.page === location.pathname) done.unshift({ ...a, seen: false });
  done.length = Math.min(done.length, 12);
}
export const open = () => done.filter((a) => !a.dismissed);

// the after picture: the same element now (found again by the pin's description), framed like the screenshot was
export async function after(a, find) {
  const el = a.elements?.map((e) => find(e)).find(Boolean);
  if (!el) return null;
  try { return await shoot(el, el.getBoundingClientRect()); } catch { return null; }
}

// the tray of finished pins, by the bar
export function tray() {
  const list = open().slice(0, 3);
  if (!list.length) return '';
  return `<div class="donetray">${list.map((a) => `<div class="doneitem"><span class="badge s-addressed">✓</span><span class="grow"><b>#${a.id} done</b> ${esc(a.reply)}</span>
    <button class="mini primary" data-act="cmpopen" data-arg="${a.id}">Compare</button><button class="x" data-act="cmpdismiss" data-arg="${a.id}" title="Dismiss">×</button></div>`).join('')}</div>`;
}
// the comparison itself
export function view(state) {
  const a = done.find((x) => x.id === state.id);
  if (!a) return '';
  const before = a.before[0], mode = state.mode || 'wipe', cut = state.cut ?? 50;
  const tab = (m, l) => `<button class="mini ${mode === m ? 'on' : ''}" data-act="cmpmode" data-arg="${m}">${l}</button>`;
  const afterImg = state.after ? `<img src="${state.after}" alt="After">` : `<div class="cmpwait">${state.after === null ? 'Not on this page any more: nothing to take an after picture of.' : 'Taking the after picture…'}</div>`;
  const pics = mode === 'side' ? `<div class="cmpside"><figure><img src="${before}" alt="Before"><figcaption>Before</figcaption></figure><figure>${afterImg}<figcaption>After</figcaption></figure></div>`
    : `<div class="cmpstack">${afterImg}<img class="cmpbefore" src="${before}" alt="Before" style="clip-path:inset(0 ${mode === 'before' ? 0 : mode === 'after' ? 100 : 100 - cut}% 0 0)">${mode === 'wipe' ? `<i class="cmpline" style="left:${cut}%"></i>` : ''}</div>
      ${mode === 'wipe' ? `<input type="range" min="0" max="100" value="${cut}" data-in="cmpwipe" aria-label="Wipe between before and after">` : ''}`;
  return `<div class="compare"><div class="row"><span class="badge s-addressed">✓</span><b class="grow">#${a.id}: before and after</b>${tab('wipe', 'Wipe')}${tab('side', 'Side by side')}${tab('before', 'Before')}${tab('after', 'After')}<button class="x" data-act="cmpclose">×</button></div>
    ${a.note ? `<div class="small">You said: “${esc(a.note)}”</div>` : ''}<div class="small">Agent: ${esc(a.reply)}</div>
    ${pics}
    <div class="small">The before picture is only in this page's memory: it goes when you leave or reload.</div></div>`;
}
