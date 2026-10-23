// Swapping a pinned image: drop a file, choose one, or paste a link; set how it fits and where its focal point is.
// The page shows it at once (CSS only: an <img> gets new content, a background a new image); a dropped file is kept in
// .unide/assets/ so the agent can copy it into the project.
import { esc, api } from './core.js';

// an <img> (or the <img> in a <picture>), or anything with a background image
export function imageOf(el) {
  if (!el) return null;
  const img = el.tagName === 'IMG' ? el : el.tagName === 'PICTURE' ? el.querySelector('img') : null;
  if (img) return { kind: 'img', el: img, src: img.currentSrc || img.src };
  const bg = getComputedStyle(el).backgroundImage, m = bg && bg.match(/url\(["']?(.*?)["']?\)/);
  return m ? { kind: 'bg', el, src: m[1] } : null;
}
const FITS = { cover: 'fill the box, cropping', contain: 'show it all', fill: 'stretch to the box', none: 'natural size' };
const short = (u) => (u || '').replace(location.origin, '').replace(/^data:([^;,]+).*$/, 'a dropped $1 file').slice(0, 60);

export function imagePanel(e, el) {
  const im = imageOf(el), ed = e.edits?.image || {}, k = e.k;
  if (!im) return '<div class="small">This isn\'t an image.</div>';
  const cs = getComputedStyle(im.el), fit = ed.fit?.to || (im.kind === 'img' ? cs.objectFit : bgFit(cs.backgroundSize));
  const focus = ed.focus?.to || (im.kind === 'img' ? cs.objectPosition : cs.backgroundPosition);
  const [fx, fy] = focus.split(' ').map((v) => parseFloat(v)).concat([50, 50]);
  const src = ed.src?.url || im.src;
  return `<div class="imgtool" data-k="${k}">
    <div class="ithumb" data-act="ifocus" data-arg="${k}" style="background-image:url('${esc(src)}')" title="Click where the focal point is"><b class="ifocus" style="left:${fx}%;top:${fy}%"></b></div>
    <div class="small">Click the picture where it matters most: that part stays in view when it's cropped.</div>
    <div class="idrop" data-drop="${k}">Drop an image here, or <label class="ipick">choose a file<input type="file" accept="image/*" data-ch="ifile" hidden></label></div>
    <input class="iurl" data-ch="iurl" placeholder="or paste a link to an image" value="${ed.src?.url && !ed.src.url.startsWith('/__unide/') ? esc(ed.src.url) : ''}">
    <div class="small">How it fits</div>
    <div class="row wrap">${Object.entries(FITS).map(([f, t]) => `<button class="mini ${fit === f ? 'on' : ''}" data-act="ifit" data-arg="${k}|${f}" title="${t}">${f}</button>`).join('')}</div>
    ${ed.src ? `<div class="small changed">image ${esc(short(ed.src.from))} → ${esc(ed.src.name || short(ed.src.url))} · <button class="link" data-act="ireset" data-arg="${k}">put it back</button></div>` : ''}
  </div>`;
}
const bgFit = (size) => (size === 'cover' || size === 'contain' ? size : size === '100% 100%' ? 'fill' : 'none');

// the CSS that shows it
export function imageCss(sel, el, ed) {
  const im = imageOf(el);
  if (!im || !ed) return [];
  const isImg = im.kind === 'img', s = isImg && im.el !== el ? `${sel} img` : sel, d = {};
  if (ed.src) isImg ? (d.content = `url("${ed.src.url}")`) : (d['background-image'] = `url("${ed.src.url}")`);
  if (ed.fit) isImg ? (d['object-fit'] = ed.fit.to) : (d['background-size'] = { cover: 'cover', contain: 'contain', fill: '100% 100%', none: 'auto' }[ed.fit.to]);
  if (ed.focus) d[isImg ? 'object-position' : 'background-position'] = ed.focus.to;
  return [[s, d]];
}

// changes (each saved with the pin)
export function setFit(e, el, fit) {
  const im = imageOf(el), cs = getComputedStyle(im.el);
  e.edits ||= {}; const ed = e.edits.image ||= {};
  ed.fit = { from: ed.fit?.from ?? (im.kind === 'img' ? cs.objectFit : bgFit(cs.backgroundSize)), to: fit };
  if (ed.fit.from === fit) delete ed.fit;
}
export function setFocus(e, el, x, y) {
  const im = imageOf(el), cs = getComputedStyle(im.el);
  e.edits ||= {}; const ed = e.edits.image ||= {};
  ed.focus = { from: ed.focus?.from ?? (im.kind === 'img' ? cs.objectPosition : cs.backgroundPosition), to: `${Math.round(x)}% ${Math.round(y)}%` };
  if (!ed.fit && im.kind === 'img' && cs.objectFit === 'fill') ed.fit = { from: 'fill', to: 'cover' }; // a focal point only shows when it crops
}
export async function setFile(e, el, file) {
  const im = imageOf(el);
  if (!im || !file || !/^image\//.test(file.type)) return false;
  const data = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(file); });
  const res = await api('asset', { k: e.k, name: file.name, data }).catch(() => null);
  if (!res?.url) return false;
  e.edits ||= {}; const ed = e.edits.image ||= {};
  ed.src = { from: ed.src?.from ?? im.src, url: res.url, file: res.file, name: file.name };
  return true;
}
export function setUrl(e, el, url) {
  const im = imageOf(el);
  if (!im || !/^(https?:|\/|data:image\/)/.test(url)) return false;
  e.edits ||= {}; const ed = e.edits.image ||= {};
  ed.src = { from: ed.src?.from ?? im.src, url };
  return true;
}
