// 3D objects in a three.js canvas (plain three.js or React Three Fiber): which object is under the pointer, its
// name and the names it sits in, the model file it came from, and the component that drew it. A 3D object has no
// DOM element, so this asks the scene itself, with the camera it was last drawn with (see early.js).
import { fromFiber } from './components.js';
import { api } from './core.js';

const T = window.__unideEarly?.three;
const E = window.__unideEarly;

// the scenes drawn into this canvas lately, the one on screen first; a lone full-screen quad (post-processing) last
function pairsFor(canvas) {
  const r = T?.renderers.find((x) => x.canvas === canvas);
  if (!r) return [];
  const quad = (p) => p.scene.children.length <= 1 && p.camera.isOrthographicCamera;
  return [...r.pairs].sort((a, b) => quad(a) - quad(b) || b.toScreen - a.toScreen);
}
export const isThreeCanvas = (el) => el?.tagName === 'CANVAS' && pairsFor(el).length > 0;

// a ray from the camera through the pointer, built from the app's own three.js classes
function rayFrom(camera, canvas, x, y) {
  const V3 = camera.position.constructor, r = canvas.getBoundingClientRect();
  const nx = ((x - r.left) / r.width) * 2 - 1, ny = -((y - r.top) / r.height) * 2 + 1;
  let origin, direction;
  if (camera.isOrthographicCamera) {
    origin = new V3(nx, ny, (camera.near + camera.far) / (camera.near - camera.far)).unproject(camera);
    direction = new V3(0, 0, -1).transformDirection(camera.matrixWorld);
  } else {
    origin = new V3().setFromMatrixPosition(camera.matrixWorld);
    direction = new V3(nx, ny, 0.5).unproject(camera).sub(origin).normalize();
  }
  return { ray: { origin, direction }, near: 0, far: Infinity, camera, layers: camera.layers,
    params: { Mesh: {}, Line: { threshold: 0.05 }, Line2: { threshold: 0 }, LOD: {}, Points: { threshold: 0.05 }, Sprite: {} } };
}
const seen = (m) => [].concat(m || []).some((x) => x && x.visible !== false && !(x.transparent && x.opacity < 0.05));
function cast(obj, rc, out) {
  if (!obj.visible) return;
  // the class's own hit test: apps often switch it off on decoration (raycast={() => null}) so their clicks skip it,
  // but anything you can see can be pinned
  const test = obj.constructor?.prototype?.raycast || obj.raycast;
  if (test && (!obj.layers || rc.layers.test(obj.layers))) { try { test.call(obj, rc, out); } catch { /* an object that can't be hit */ } }
  for (const c of obj.children) cast(c, rc, out);
}

// what's under the pointer in this canvas, nearest first: one entry per object.
// A big scene takes tens of milliseconds to test, so the hover preview (quick) reuses an answer from just before.
let last = null;
export function threeAt(canvas, x, y, quick = false) {
  const now = performance.now();
  if (quick && last && last.canvas === canvas && now - last.t < 80) return last.out;
  const out = hitsAt(canvas, x, y);
  last = { canvas, t: performance.now(), out };
  return out;
}
function hitsAt(canvas, x, y) {
  for (const { scene, camera } of pairsFor(canvas)) {
    const rc = rayFrom(camera, canvas, x, y), hits = [];
    cast(scene, rc, hits);
    const out = [], objs = new Set();
    for (const h of hits.filter((h) => !h.object.isMesh || seen(h.object.material)).sort((a, b) => a.distance - b.distance)) {
      // the named thing a nameless part belongs to (the mountain, not one of its meshes); a part of something
      // already listed isn't listed again
      const o = unitOf(h.object), id = o === h.object ? h.instanceId ?? null : null, key = id != null ? `${o.uuid}#${id}` : o.uuid;
      if (objs.has(key) || out.some((x) => x.instanceId == null && within(o, x.object))) continue;
      objs.add(key);
      out.push({ kind: 'three', el: canvas, object: o, instanceId: id, point: h.point, scene, camera });
      if (out.length >= 5) break;
    }
    if (out.length) return out;
  }
  return [];
}

// a name for an object, and the named things it sits in
const nameOf = (o) => o.name || o.userData?.name || null;
const within = (o, a) => { for (let p = o; p; p = p.parent) if (p === a) return true; return false; };
// the meshes an object is drawn with (itself, or what's in it)
function meshesOf(o, max = 400) {
  const out = [];
  o.traverse((x) => { if (out.length < max && x.visible !== false && (x.isMesh || x.isLine || x.isPoints || x.isSprite) && x.geometry) out.push(x); });
  return out;
}
// what a pin means by a nameless mesh: the nearest named group holding it, when that's one modest thing
function unitOf(o) {
  if (nameOf(o)) return o;
  for (let p = o.parent, d = 0; p && !p.isScene && d < 3; p = p.parent, d++) if (nameOf(p)) return meshesOf(p, 61).length <= 60 ? p : o;
  return o;
}
const kindOf = (o) => (o.isInstancedMesh ? 'instanced mesh' : o.isSkinnedMesh ? 'skinned mesh' : o.isMesh ? 'mesh' : o.isSprite ? 'sprite' : o.isPoints ? 'points' : o.isLine ? 'line' : o.isGroup ? 'group' : (o.type || 'object').toLowerCase());
const shapeOf = (o) => (o.geometry?.type || '').replace(/Geometry$/, '').replace(/^Buffer$/, '').toLowerCase();
// what to call it: its own name, else the named thing it's part of, else its shape
function called(o) {
  if (nameOf(o)) return nameOf(o);
  for (let p = o.parent; p && !p.isScene; p = p.parent) if (nameOf(p)) return nameOf(p);
  return [shapeOf(o), kindOf(o)].filter(Boolean).join(' ');
}
export function label3(t) {
  return `3D “${called(t.object)}”${t.instanceId != null ? ` #${t.instanceId}` : ''}`;
}
function chain(o) {
  const names = [];
  for (let p = o.parent; p && !p.isScene && names.length < 6; p = p.parent) if (nameOf(p)) names.unshift(nameOf(p));
  if (!nameOf(o) && names.at(-1) === called(o)) names.pop(); // an unnamed part already goes by its parent's name
  return names;
}
// how to find it again after a reload or a re-render: child positions from the scene, checked against names
export function pathOf3(o) {
  const idx = [], names = [];
  for (let c = o; c.parent; c = c.parent) { idx.unshift(c.parent.children.indexOf(c)); names.unshift(nameOf(c) || ''); }
  return { idx, names };
}
export function resolve3(canvas, path) {
  for (const { scene } of pairsFor(canvas)) {
    let o = scene;
    for (let i = 0; o && i < path.idx.length; i++) {
      o = o.children[path.idx[i]];
      if (o && path.names[i] && nameOf(o) !== path.names[i]) o = null;
    }
    if (o) return o;
  }
  return null;
}

// its box in the world: its geometry's, or the union of the meshes in it (one instance of an instanced mesh)
function box3(object, instanceId = null) {
  let box = null;
  for (const m of object.geometry ? [object] : meshesOf(object)) {
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox.clone(), w = m.matrixWorld.clone();
    if (m === object && instanceId != null && m.getMatrixAt) { const im = m.matrixWorld.clone(); m.getMatrixAt(instanceId, im); w.multiply(im); }
    b.applyMatrix4(w);
    box = box ? box.union(b) : b;
  }
  return box;
}
// its box on screen: the world box's eight corners, projected with the camera
export function rect3(object, camera, canvas, instanceId = null) {
  const r = canvas.getBoundingClientRect(), box = box3(object, instanceId);
  if (!box) return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  const V3 = camera.position.constructor, xs = [], ys = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const v = new V3(x, y, z).project(camera);
    if (v.z > 1) continue; // behind the camera
    xs.push(r.left + ((v.x + 1) / 2) * r.width); ys.push(r.top + ((1 - v.y) / 2) * r.height);
  }
  if (!xs.length) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  const left = Math.max(r.left, Math.min(...xs)), right = Math.min(r.right, Math.max(...xs));
  const top = Math.max(r.top, Math.min(...ys)), bottom = Math.min(r.bottom, Math.max(...ys));
  return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top), x: left, y: top };
}

// the model file behind an object: what a loader loaded it from (the object, its geometry or material, or a parent)
function modelOf(o) {
  for (const p of [...meshesOf(o, 20), ...(function* () { for (let a = o.parent; a; a = a.parent) yield a; })()]) for (const x of [p, p.geometry, ...[].concat(p.material || [])]) {
    const u = x && T?.src.get(x);
    if (u) return u.replace(location.origin, '').split('?')[0];
  }
  return null;
}
// a model file named in the props of the components around it (useGLTF(asset), <Model url="…">), when the app
// rebuilt the loaded geometry and the loader's link to it is gone
const MODEL = /\.(glb|gltf|fbx|obj|usdz|ply|stl|vrm|3dm|dae)(\?|#|$)/i;
function modelFromProps(f) {
  for (let i = 0, x = f; x && i < 12; i++, x = x._debugOwner || x.return) {
    for (const v of Object.values(x.memoizedProps || {})) if (typeof v === 'string' && MODEL.test(v)) return v.replace(location.origin, '').split('?')[0];
  }
  return null;
}
// React Three Fiber: the fiber whose instance is this object (or the nearest parent that has one)
function fiberFor(o) {
  let inst = null;
  for (let p = o; p && !inst; p = p.parent) inst = p.__r3f || null;
  if (!inst || !E?.fiberRoots) return null;
  for (const root of E.fiberRoots) {
    const stack = [root.current];
    while (stack.length) {
      const f = stack.pop();
      if (!f) continue;
      if (f.stateNode === inst) return f;
      if (f.sibling) stack.push(f.sibling);
      if (f.child) stack.push(f.child);
    }
  }
  return null;
}
const num = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100);
const vec = (v) => `(${num(v.x)}, ${num(v.y)}, ${num(v.z)})`;
const colourOf = (m) => (m?.color?.getHexString ? '#' + m.color.getHexString() : null);

// everything the agent needs about a 3D object; the pin's element stays the canvas
export async function info3(t) {
  const o = t.object, parts = meshesOf(o), name = called(o);
  const mats = [...new Set(parts.flatMap((m) => [].concat(m.material || [])).filter(Boolean))].slice(0, 3);
  const r = rect3(o, t.camera, t.el, t.instanceId), names = chain(o);
  let model = modelOf(o);
  const verts = parts.reduce((n, m) => n + (m.geometry?.attributes?.position?.count || 0), 0) || null;
  const b = box3(o, t.instanceId), size = b ? vec(b.getSize(new (t.camera.position.constructor)())) : null;
  const f = fiberFor(o);
  let component = f ? await fromFiber(f).catch(() => null) : null;
  model ||= modelFromProps(f);
  // no fiber (plain three.js), or one inside a library: where the model file is used in the code
  if (!component?.file && model) {
    const file = model.split('/').pop(), hit = await api(`grep?q=${encodeURIComponent(file)}&q=${encodeURIComponent(file.replace(/\.[a-z0-9]+$/i, ''))}`).catch(() => null);
    if (hit?.file) component = { framework: component?.framework || 'three.js', name: component?.name || null, file: hit.file, line: hit.line, via: `uses ${file}` };
  }
  const mat = mats.map((m) => [m.name && `“${m.name}”`, m.type, colourOf(m), m.map ? 'textured' : null, m.transparent ? `opacity ${num(m.opacity)}` : null].filter(Boolean).join(' ')).join('; ');
  if (!nameOf(o) && !names.length && component?.name) {
    // nothing in the scene is named: say whose it is and what shape
    names.push(`<${component.name}>`);
  }
  const where = names.length ? ` in ${names.map((n) => (n.startsWith('<') ? n : `“${n}”`)).join(' › ')}` : '';
  return {
    name: `3D object “${name}”`,
    three: { name, kind: kindOf(o), names, path: pathOf3(o), instanceId: t.instanceId, model, r3f: o.__r3f?.type || null,
      // where on it you clicked, in its own space, so the badge stays on that spot as it or the camera moves
      at: t.point ? (() => { const p = o.worldToLocal(t.point.clone()); return [p.x, p.y, p.z]; })() : null },
    part: `the 3D object “${name}”${t.instanceId != null ? ` (instance ${t.instanceId})` : ''}, a ${kindOf(o)}${where}, drawn inside this canvas${model ? `, from the model ${model}` : ''}`,
    facts: [`${o.geometry ? kindOf(o) : `group of ${parts.length} mesh${parts.length === 1 ? '' : 'es'}`} “${name}”${where}`, model && `model ${model}`, mat && `material ${mat}`, verts && `${verts} vertices`, size && `size ${size} (world units)`,
      `position ${vec(o.getWorldPosition(new (t.camera.position.constructor)()))}`, `about ${Math.round(r.width)}×${Math.round(r.height)}px on screen`, t.point && `clicked at ${vec(t.point)}`].filter(Boolean).join('; '),
    component,
  };
}

// a picture of the canvas as it is now: WebGL clears its buffer after each frame, so draw it once more and read it at once
export function grab(canvas) {
  const r = T?.renderers.find((x) => x.canvas === canvas), p = pairsFor(canvas).find((x) => x.toScreen) || pairsFor(canvas)[0];
  if (!r || !p) return null;
  try { r.gl.render(p.scene, p.camera); return canvas.toDataURL('image/png'); } catch { return null; }
}

// where a pinned 3D object is on screen now (it moves when the camera or the object does)
export function liveRect3(canvas, e3) {
  const o = e3?.path && resolve3(canvas, e3.path), cam = pairsFor(canvas)[0]?.camera;
  return o && cam ? rect3(o, cam, canvas, e3.instanceId ?? null) : null;
}
// the spot you clicked on it, on screen now
export function spot3(canvas, e3) {
  const o = e3?.at && e3.path && resolve3(canvas, e3.path), cam = pairsFor(canvas)[0]?.camera;
  if (!o || !cam) return null;
  const V3 = cam.position.constructor, v = o.localToWorld(new V3(...e3.at)).project(cam), r = canvas.getBoundingClientRect();
  return v.z > 1 ? null : { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
}
// is this pinned 3D object the one at the top of the pointer now
export function topIs(canvas, e3, x, y) {
  const o = e3?.path && resolve3(canvas, e3.path), top = threeAt(canvas, x, y)[0];
  return !!o && top?.object === o && (top.instanceId ?? null) === (e3.instanceId ?? null);
}

// ---------- its outline on screen ----------
// Draw the scene once with only this object in it, copy that at once (WebGL keeps no picture), put everything back
// and draw the real frame again before the browser shows anything. The copy's shape, grown by a few pixels, is the outline.
function shapeOf3(canvas, object, instanceId) {
  const entry = T?.renderers.find((x) => x.canvas === canvas), pair = pairsFor(canvas).find((p) => p.toScreen) || pairsFor(canvas)[0];
  if (!entry || !pair) return null;
  const gl = entry.gl;
  try { if (gl.getContext?.().getContextAttributes?.()?.alpha === false) return null; } catch { /* no context to ask */ }
  const r = canvas.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  const keep = new Set();
  object.traverse((o) => keep.add(o));
  for (let a = object.parent; a; a = a.parent) keep.add(a);
  const hidden = [];
  pair.scene.traverse((o) => { if (o.visible && !keep.has(o) && (o.isMesh || o.isLine || o.isPoints || o.isSprite)) { o.visible = false; hidden.push(o); } });
  let inst = null;
  if (instanceId != null && object.isInstancedMesh) {
    const M = object.matrixWorld.constructor, mine = new M(), first = new M();
    object.getMatrixAt(instanceId, mine); object.getMatrixAt(0, first);
    inst = { first, count: object.count };
    object.setMatrixAt(0, mine); object.count = 1; object.instanceMatrix.needsUpdate = true;
  }
  const bg = pair.scene.background, alpha = gl.getClearAlpha?.(), auto = gl.autoClear, mask = document.createElement('canvas');
  mask.width = w; mask.height = h;
  try {
    pair.scene.background = null; gl.setClearAlpha?.(0); gl.autoClear = true;
    gl.render(pair.scene, pair.camera);
    mask.getContext('2d').drawImage(canvas, 0, 0, w, h);
  } catch { return null; } finally {
    for (const o of hidden) o.visible = true;
    if (inst) { object.setMatrixAt(0, inst.first); object.count = inst.count; object.instanceMatrix.needsUpdate = true; }
    pair.scene.background = bg; if (alpha != null) gl.setClearAlpha(alpha); gl.autoClear = auto;
    try { gl.render(pair.scene, pair.camera); } catch { /* the app draws again next frame */ }
  }
  return { mask, rect: r, w, h };
}
// the outline as a picture the size of the canvas: a ring in the colour around the object's shape, with a dark
// edge outside it so it reads on light and dark scenes alike. Inside is left alone: you see the object as it is.
export function outline3(canvas, object, instanceId = null, colour = '#8fb4ff', width = 2.5) {
  const s = shapeOf3(canvas, object, instanceId);
  if (!s) return null;
  const { mask, w, h } = s, out = document.createElement('canvas'), g = out.getContext('2d');
  out.width = w; out.height = h;
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.drawImage(mask, Math.cos(a) * width, Math.sin(a) * width); }
  g.globalCompositeOperation = 'source-in'; g.fillStyle = colour; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out'; g.drawImage(mask, 0, 0);
  // a thin dark rim outside the ring
  const rim = document.createElement('canvas'), rg = rim.getContext('2d');
  rim.width = w; rim.height = h;
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; rg.drawImage(mask, Math.cos(a) * (width + 1.5), Math.sin(a) * (width + 1.5)); }
  rg.globalCompositeOperation = 'source-in'; rg.fillStyle = 'rgba(0,0,0,.55)'; rg.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-over'; g.drawImage(rim, 0, 0);
  g.globalCompositeOperation = 'destination-out'; g.drawImage(mask, 0, 0);
  return { canvas: out, rect: s.rect };
}
// shown over the page: one outline per use ('hover' while ⌥ is held, 'pin' for the open pin), redrawn when the object
// changes or after a moment (the camera may be moving)
const shown = new Map();
export function showOutline(root, slot, t, colour) {
  let el = root.querySelector(`canvas.sil-${slot}`);
  if (!t) { if (el) el.style.display = 'none'; shown.delete(slot); return false; }
  const was = shown.get(slot), now = performance.now();
  if (was && was.object === t.object && was.instanceId === t.instanceId && was.colour === colour && now - was.t < 250 && el?.style.display !== 'none') return true;
  const o = outline3(t.el, t.object, t.instanceId, colour);
  if (!o) { if (el) el.style.display = 'none'; return false; }
  if (!el) { el = document.createElement('canvas'); el.className = `sil sil-${slot}`; root.prepend(el); } // under unide's cards
  el.width = o.canvas.width; el.height = o.canvas.height;
  el.getContext('2d').drawImage(o.canvas, 0, 0);
  Object.assign(el.style, { display: 'block', left: o.rect.left + 'px', top: o.rect.top + 'px', width: o.rect.width + 'px', height: o.rect.height + 'px' });
  shown.set(slot, { object: t.object, instanceId: t.instanceId, colour, t: now });
  return true;
}
// the open pin's object, found again from what was saved
export function targetOf3(canvas, e3) {
  const o = e3?.path && resolve3(canvas, e3.path);
  return o ? { kind: 'three', el: canvas, object: o, instanceId: e3.instanceId ?? null } : null;
}
