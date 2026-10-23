// Review: lenses, snapshots to compare versions, reference images, and the request for your agent.
import { S, esc, actions, inputs, changes, render, api, setTimeout, optClick, isMac } from './core.js';
import { words, parse } from './colour.js';
import { VISION, MOTION, applyLenses } from './lenses.js';
import { snapshot, viewSnapshot, useSnapshot, deleteSnapshot, addRefs, setRefNote, deleteRef, pickFromRef } from './review.js';
import { requestMarkdown } from './request.js';
import { act, swatch } from './ui.js';
import { sendDetail } from './pins.js';

function lensSection() {
  const sel = (name, opts, cur) => `<select data-ch="${name}">${Object.entries(opts).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
  const optOn = window.__unideEarly?.optOn?.() !== false;
  const gesture = `<section><h3>Pinning</h3><label class="opt"><input type="checkbox" data-ch="optclick" ${optOn ? 'checked' : ''}><span><b>${optClick} pins</b><span class="small">Hold ${isMac ? '⌥ Option' : 'Alt'} and click anything to pin it. Turn this off in apps that use ${optClick} themselves (code editors, design tools); the Pin button still works.</span></span></label></section>`;
  return gesture + `<section><h3>Lenses</h3>
    <div class="seg">${act('lens', 'Squint', { arg: 'squint', cls: S.lens.squint ? 'on' : '', title: 'Blur: what stands out first?' })}${act('lens', 'Gray', { arg: 'gray', cls: S.lens.gray ? 'on' : '', title: 'No colour: does the hierarchy still work?' })}
      <button class="hold ${S.comparing ? 'on' : ''}" title="Hold to see the page before your changes">Hold for before</button></div>
    <div class="line"><span class="grow small"><b style="color:var(--t1)">Colour vision</b></span>${sel('vision', VISION, S.lens.vision)}</div>
    <div class="line"><span class="grow small"><b style="color:var(--t1)">Motion</b></span>${sel('motion', MOTION, S.lens.motion)}</div>
    <div class="small">Motion drawn frame by frame in JavaScript keeps its speed; CSS animations and transitions follow this.</div></section>`;
}
function snapshotSection() {
  return `<section><h3>Snapshots</h3>
    <div class="small">Save how the page looks now (your kept changes and what you're trying) to compare versions. Saved in unide, not your project.</div>
    <div class="row" style="margin-top:8px"><input type="text" placeholder="Name, e.g. calmer sidebar" data-snapname style="flex:1">${act('snap', 'Save')}</div>
    ${S.snapshots.map((s) => `<div class="line"><span class="grow"><b>${esc(s.name)}</b> <span class="small">${new Date(s.at).toLocaleString()} · ${s.items.length} kept${s.state ? ` · ${esc(s.state)}` : ''}</span></span>
      ${S.viewing?.id === s.id ? act('viewsnap', 'Back to now', { cls: 'mini on' }) : act('viewsnap', 'View', { arg: s.id, cls: 'mini' })}${act('usesnap', 'Use this', { arg: s.id, cls: 'mini', title: 'Replace your request with this version' })}${act('delsnap', '×', { arg: s.id, cls: 'x' })}</div>`).join('')}</section>`;
}
function refSection() {
  const open = S.refs.find((r) => r.id === S.openRef);
  return `<section><h3>References</h3>
    <div class="small">Designs you like. Click an open image to pick its colours. Ones with a note or colours go into the request, so the agent can look at them too.</div>
    <label class="drop" data-drop>Drop images here, or <input type="file" accept="image/*" multiple data-ch="reffile" style="width:auto"></label>
    ${S.refs.length ? `<div class="thumbs">${S.refs.map((r) => `<button data-act="refopen" data-arg="${r.id}" class="${r.id === S.openRef ? 'cur' : ''}" title="${esc(r.name || '')}"><img src="${r.url}" alt=""></button>`).join('')}</div>` : ''}
    ${open ? `<img class="refimg" src="${open.url}" data-refimg alt="">
      <textarea data-in="refnote" placeholder="What do you like about it? e.g. the calm cream with one strong orange" style="margin-top:8px">${esc(open.note)}</textarea>
      ${open.colours.length ? `<div class="row" style="margin-top:6px;flex-wrap:wrap">${open.colours.map((c) => `<button class="msw" data-act="chip" data-arg="${c}" title="${c} · ${esc(words(parse(c)))}" style="background:${c};width:24px;height:22px"></button>`).join('')}<span class="small">picked; click one to use it in Colour</span></div>` : ''}
      <div class="actions">${act('refdel', 'Remove', { arg: open.id, cls: 'mini' })}</div>` : ''}</section>`;
}
function requestSection() {
  const n = S.items.length, LABEL = { change: 'Change', note: 'Note', lock: 'Locked', page: 'Page-wide' };
  const who = (it) => it.kind === 'page' ? 'the whole page' : it.members.length > 1 ? `${it.members.length} elements (${esc([...new Set(it.members.map((m) => m.name))].join(', '))})` : it.members.length ? `${esc(it.members[0].name)} <code>${esc(it.members[0].tag)}</code>` : 'the page';
  return `<section><h3>Request for your agent</h3>${n ? `<ul class="items">${S.items.map((it, i) => `<li><div><div class="k ${it.kind}">${LABEL[it.kind]}</div><div>${who(it)}</div>
      ${it.directions?.length ? `<div class="small">${it.directions.map(esc).join(' · ')}</div>` : ''}${it.note ? `<div class="small">“${esc(it.note)}”</div>` : ''}</div>${act('del', '×', { arg: i, cls: 'x', title: 'Remove' })}</li>`).join('')}</ul>`
    : '<div class="empty">Nothing yet. Keep a change or a note, or lock something you like.</div>'}
    <div class="actions">${act('sendreq', 'Send to agent', { cls: 'primary', disabled: !n })}${act('copy', 'Copy instead', { disabled: !n })}${n ? act('clear', 'Clear') : ''}</div>${S.flash ? `<div class="ok">${esc(S.flash)}</div>` : ''}</section>`;
}
export const view = () => lensSection() + snapshotSection() + refSection() + requestSection();

// ---------- controls ----------
let noteTimer, flashTimer;
export function flash(msg) { S.flash = msg; render(); clearTimeout(flashTimer); flashTimer = setTimeout(() => { S.flash = ''; render(); }, 8000); }
Object.assign(actions, {
  lens: (k) => { S.lens[k] = !S.lens[k]; applyLenses(); render(); },
  snap: (_, btn) => snapshot(btn.closest('section').querySelector('[data-snapname]').value.trim()),
  viewsnap: (id) => viewSnapshot(id || null),
  usesnap: (id) => useSnapshot(id),
  delsnap: (id) => deleteSnapshot(id),
  refopen: (id) => { S.openRef = S.openRef === id ? null : id; render(); },
  refdel: (id) => deleteRef(id),
  chip: (c) => { S.picked = c; S.mode = 'colour'; render(); },
  del: (i) => { S.items.splice(+i, 1); render(); },
  sendreq: async () => {
    if (!S.items.length) return;
    await Promise.all(S.pending); // file lookups still running
    const title = S.items.map((it) => it.note || it.directions?.[0] || it.kind).filter(Boolean).slice(0, 2).join('; ');
    await sendDetail(`From Tools: ${title}`, requestMarkdown());
    S.items = []; render();
  },
  clear: () => { S.items = []; render(); },
  copy: async (_, btn) => {
    await Promise.all(S.pending); // file lookups still running
    const md = requestMarkdown();
    let msg = '';
    try { await navigator.clipboard.writeText(md); msg = 'Copied. Paste it into Claude Code.'; } catch { msg = 'Couldn’t copy; use the saved file.'; }
    try { const r = await api('request', md); msg += ` Also saved to ${r.saved}`; } catch { /* server gone */ }
    flash(msg);
  },
});
inputs.refnote = (el) => { clearTimeout(noteTimer); noteTimer = setTimeout(() => setRefNote(S.openRef, el.value), 400); };
Object.assign(changes, {
  optclick: (el) => { try { localStorage.setItem('unide:optclick', el.checked ? 'on' : 'off'); } catch { /* storage blocked: stays on */ } render(); },
  vision: (el) => { S.lens.vision = el.value; applyLenses(); },
  motion: (el) => { S.lens.motion = el.value; applyLenses(); },
  reffile: (el) => addRefs([...el.files]),
});
export { pickFromRef, addRefs };
