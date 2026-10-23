// The film's edit: scenes on a 120 BPM grid, footage cut from the recorded shots (anchored to their logged events so a
// re-record keeps the cuts), a virtual camera computed from the recorder's cues and the cursor, and the sound cues.
// build() → { fps, dur, scenes, frames[], keys[], quotes[], caps[], audio[] }
const fs = require('fs'), path = require('path');
const FR = path.join(__dirname, 'frames');
const FPS = 30, BEAT = 0.5;

function load(name) {
  const times = JSON.parse(fs.readFileSync(path.join(FR, name, 'times.json'))), t0 = times[0].t;
  const ev = JSON.parse(fs.readFileSync(path.join(FR, name, 'events.json'))).map((e) => ({ ...e, t: e.t - t0 }));
  const frames = times.map((f) => ({ file: path.join(FR, name, f.file), t: f.t - t0 }));
  const moves = ev.filter((e) => e.type === 'move');
  // the n-th event of a kind (negative n counts from the end)
  const E = (type, n = 0, f = () => true) => { const l = ev.filter((e) => e.type === type && f(e)); const e = l[n < 0 ? l.length + n : n]; if (!e) throw new Error(`${name}: no ${type} #${n}`); return e.t; };
  const key = (k, n = 0, down = true) => E('key', n, (e) => e.key === k && e.down === down);
  return { name, frames, ev, moves, E, key, click: (n) => E('click', n), dur: frames.at(-1).t };
}
const shots = {};
const S = (n) => (shots[n] ||= load(n));

// the scenes, in order. footage: segs [in, out, speed] in shot seconds; cut: a jump cut into that seg.
// caps: [shot time, film seconds shown, title, sub]
function scenes() {
  const pin = S('pin'), sty = S('style'), fon = S('fonts'), ico = S('icons'), thr = S('three'), siz = S('sizes'), res = S('result'), opt = S('options');
  return [
    { kind: 'open', dur: 4.5 },
    { kind: 'problem', dur: 6, in: 'ink' },
    { kind: 'foot', shot: 'pin', ch: ['01', 'Pin'], in: 'fly',
      segs: [[pin.click(0) + 0.45, pin.key('Alt') - 0.2, 1.5], [pin.key('Alt') - 0.2, pin.key('Enter') + 0.5, 1.15]],
      caps: [[pin.key('Alt') - 0.1, 2.6, '⌥-click anything.', 'The page holds still. Nothing gets clicked.'], [pin.E('type') + 0.1, 2.9, 'Say what should change.', 'Return keeps it.']] },
    { kind: 'foot', shot: 'style', ch: ['02', 'Style'], in: 'glitch',
      segs: [[sty.click(0) - 0.5, sty.click(3) + 0.2, 1.7], [sty.click(3) + 0.2, sty.click(4) - 0.2, 2.4], [sty.click(4) - 0.2, sty.key('Escape') + 0.15, 2.0]],
      caps: [[sty.click(0) - 0.4, 3.4, 'Or change it by hand.', 'A colour wheel, text, states: previewed live.'], [sty.click(4), 3.4, 'Your type scale, not guesses.', 'Sizes come from the ones the page already uses.']] },
    { kind: 'foot', shot: 'fonts', ch: ['03', 'Fonts'], in: 'glitch',
      segs: [[fon.key('Alt') - 0.4, fon.click(3) + 0.3, 1.6], [fon.click(3) + 0.3, fon.click(4) - 0.3, 2.3], [fon.click(4) - 0.3, fon.key('Enter') + 0.4, 1.3]],
      caps: [[fon.key('Alt'), 3.2, 'Try any font. Live.', '67 trending free fonts, or the ones you have.'], [fon.click(3) + 0.6, 3.2, 'Point to preview.', 'Missing one? It links you to the download.']] },
    { kind: 'foot', shot: 'icons', ch: ['04', 'Icons'], in: 'glitch',
      segs: [[ico.key('Alt') - 0.4, ico.click(1) + 0.3, 1.6], [ico.click(1) + 0.3, ico.key('Enter') + 0.45, 1.7]],
      caps: [[ico.key('Alt'), 3.4, 'Swap any icon.', '1,600+ free Lucide icons, previewed in place.']] },
    { kind: 'foot', shot: 'three', ch: ['05', '3D'], in: 'glitch',
      segs: [[thr.E('cue') - 0.1, thr.key('Alt'), 1.7], [thr.key('Alt'), thr.click(0) + 0.3, 1.9], [thr.click(0) + 0.3, thr.key('Enter') + 0.5, 1.35]],
      caps: [[thr.key('Alt') - 0.3, 4.2, 'Even 3D.', 'Each part of a three.js scene, outlined by its real shape.']] },
    { kind: 'foot', shot: 'sizes', ch: ['06', 'Sizes'], in: 'glitch',
      segs: [[siz.E('caption') - 0.3, siz.click(0) + 0.6, 1.6], [siz.click(0) + 0.6, siz.key('Alt') - 0.3, 2.4], [siz.key('Alt') - 0.3, siz.key('Escape') + 0.5, 1.3]],
      caps: [[siz.click(0) - 0.6, 3.4, 'Every screen size.', 'Phone, tablet and laptop, side by side.'], [siz.key('Alt'), 3.4, 'Pin it on the phone.', 'The agent knows it was 390px wide.']] },
    { kind: 'send', dur: 3.5, in: 'ink' },
    { kind: 'agent', dur: 7, in: 'ink' },
    { kind: 'foot', shot: 'result', ch: ['07', 'Done'], in: 'fly',
      segs: [[0.2, res.click(0) - 0.6, 1.3], [res.click(0) - 0.6, res.click(1), 1.5], [res.click(1), res.click(2) + 0.2, 2.3], [res.click(2) + 0.2, res.click(3) - 0.3, 1.4]],
      caps: [[0.9, 3.4, 'The page updates itself.', 'Done pins clear themselves: nothing piles up.'], [res.click(1) - 0.5, 3.6, 'Before. After.', 'Judge the fix right on the page.']] },
    { kind: 'foot', shot: 'options', ch: ['08', 'Options'], in: 'glitch',
      segs: [[opt.key('Alt') - 0.5, opt.key('Meta') + 0.5, 1.45], [opt.click(2) - 0.9, opt.click(-1) + 1.3, 1.6, 'cut']],
      caps: [[opt.key('Alt') - 0.3, 3.2, "Can't decide? Ask for 3.", 'The agent builds three versions.'], [opt.click(3) - 0.2, 3.2, 'Flip. Keep one.', 'The others are deleted from the code.']] },
    { kind: 'works', dur: 4.5, in: 'ink' },
    { kind: 'outro', dur: 7, in: 'flash' },
  ];
}

// where the camera wants to be at a shot time (window coordinates: the window is 1608×952, its screen at 4,48)
const WX = 4, WY = 48, S0 = 0.858;
function cursorAt(sh, t) {
  const m = sh.moves; if (!m.length) return [800, 450];
  let lo = 0, hi = m.length - 1;
  if (t <= m[0].t) return [m[0].x, m[0].y];
  if (t >= m[hi].t) return [m[hi].x, m[hi].y];
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (m[mid].t <= t) lo = mid; else hi = mid; }
  const a = m[lo], b = m[hi], k = (t - a.t) / Math.max(1e-6, b.t - a.t);
  return [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k];
}
function camTarget(sh, t) {
  let cue = null;
  for (const e of sh.ev) { if (e.t > t) break; if (e.type === 'cue') cue = e; }
  const [cx, cy] = cursorAt(sh, t);
  if (!cue || cue.kind === 'wide' || !cue.rect) return { x: 804 + (cx - 800) * 0.04, y: 476 + (cy - 450) * 0.03, z: 1 };
  const r = cue.rect, s = Math.min(1480 / r.width, 840 / r.height), z = Math.min(1.95, Math.max(1.08, s / S0));
  const rx = WX + r.x + r.width / 2, ry = WY + r.y + r.height / 2;
  return { x: rx * 0.72 + (WX + cx) * 0.28, y: ry * 0.75 + (WY + cy) * 0.25, z };
}
function clampCam(c) {
  const s = S0 * c.z, hw = 960 / s, hh = 512 / s, m = 50;
  if (hw < 804 + m) c.x = Math.min(1608 - hw + m, Math.max(hw - m, c.x));
  if (hh < 476 + m) c.y = Math.min(952 - (1080 - 512) / s + m, Math.max(hh - m, c.y));
  return c;
}

function build() {
  const list = scenes();
  let t = 0;
  for (const sc of list) {
    if (sc.kind === 'foot') {
      const raw = sc.segs.reduce((a, [i, o, v]) => a + (o - i) / v, 0), want = Math.max(BEAT * 2, Math.round(raw / BEAT) * BEAT);
      const k = raw / want; sc.segs = sc.segs.map(([i, o, v, f]) => [i, o, v * k, f]);
      sc.dur = want;
    }
    sc.start = t; t += sc.dur;
  }
  const dur = t, N = Math.round(dur * FPS);
  // film time ↔ shot time inside a footage scene
  const toShot = (sc, lt) => { let a = 0; for (const [i, o, v] of sc.segs) { const d = (o - i) / v; if (lt < a + d || sc.segs.at(-1)[0] === i) return i + Math.min(d, lt - a) * v; a += d; } };
  const toFilm = (sc, st) => { let a = 0; for (const [i, o, v] of sc.segs) { const d = (o - i) / v; if (st >= i && st <= o) return sc.start + a + (st - i) / v; a += d; } return null; };
  const frames = [], keys = [], quotes = [], caps = [], audio = [];
  let cam = null, vel = { x: 0, y: 0, z: 0 }, prevFoot = null;
  for (let n = 0; n < N; n++) {
    const ft = n / FPS, si = list.findIndex((s) => ft >= s.start && ft < s.start + s.dur), sc = list[si === -1 ? list.length - 1 : si];
    const f = { t: ft, sc: list.indexOf(sc), lt: ft - sc.start };
    if (sc.kind === 'foot') {
      const sh = S(sc.shot), st = toShot(sc, f.lt);
      let lo = 0; for (let i = 0; i < sh.frames.length; i++) { if (sh.frames[i].t <= st) lo = i; else break; }
      f.file = sh.frames[lo].file; f.st = st;
      const tg = clampCam(camTarget(sh, st));
      // a small push on every click
      for (const e of sh.ev) if (e.type === 'click' && st >= e.t && st - e.t < 0.6) tg.z *= 1 + 0.03 * Math.exp(-(st - e.t) * 7);
      if (!cam || prevFoot !== list.indexOf(sc)) { cam = { ...tg }; vel = { x: 0, y: 0, z: 0 }; }
      const dt = 1 / FPS, w = 4.2, wz = 3.4, px = cam.x, py = cam.y;
      for (const [k, ww] of [['x', w], ['y', w], ['z', wz]]) { vel[k] += (ww * ww * (tg[k] - cam[k]) - 2 * ww * vel[k]) * dt; cam[k] += vel[k] * dt; }
      const s = S0 * cam.z, sp = Math.hypot((cam.x - px) * s, (cam.y - py) * s);
      f.cam = { x: cam.x, y: cam.y, z: cam.z, bx: Math.min(28, Math.abs(cam.x - px) * s * 0.45), by: Math.min(28, Math.abs(cam.y - py) * s * 0.45), sp };
      prevFoot = list.indexOf(sc);
    }
    frames.push(f);
  }
  // events from footage, on the film's clock
  list.forEach((sc, idx) => {
    if (sc.kind !== 'foot') return;
    const sh = S(sc.shot), inScene = (x) => x != null && x >= sc.start && x < sc.start + sc.dur;
    const downs = {};
    for (const e of sh.ev) {
      const ft = toFilm(sc, e.t);
      if (e.type === 'key') {
        if (e.down) { if (inScene(ft)) downs[e.key] = ft; }
        else if (downs[e.key] != null) { const a = downs[e.key]; keys.push({ k: e.key, a, b: Math.min(sc.start + sc.dur - 0.25, Math.max(ft ?? a + 0.4, a + 0.5)) }); audio.push({ t: a, kind: 'key' }); delete downs[e.key]; }
      }
      if (e.type === 'click' && inScene(ft)) audio.push({ t: ft, kind: 'click' });
      if (e.type === 'type' && inScene(ft)) {
        const next = sh.ev.find((x) => x.t > e.t && x.type === 'key'), end = Math.min(next ? next.t : e.t + 3, e.t + e.text.length * 0.085);
        const fe = toFilm(sc, end) ?? ft + 1.5;
        quotes.push({ text: e.text, a: ft, b: fe, hold: Math.min(sc.start + sc.dur - 0.3, fe + 1.1) });
        for (let i = 0; i < e.text.length; i++) audio.push({ t: ft + ((fe - ft) * i) / e.text.length, kind: 'tick' });
      }
    }
    for (const [k, a] of Object.entries(downs)) keys.push({ k, a, b: a + 0.5 });
    for (const [st, len, title, sub] of sc.caps || []) { const a = toFilm(sc, st); if (a != null) caps.push({ a, b: Math.min(a + len, sc.start + sc.dur - 0.05), title, sub }); }
    // jump cuts inside a scene
    let acc = sc.start; for (const [i, o, v, flag] of sc.segs) { if (flag === 'cut') audio.push({ t: acc, kind: 'glitch' }); sc.cuts = sc.cuts || []; if (flag === 'cut') sc.cuts.push(acc); acc += (o - i) / v; }
  });
  list.forEach((sc) => { if (sc.in) audio.push({ t: sc.start, kind: sc.in }); });
  return { fps: FPS, dur, N, scenes: list.map(({ kind, start, dur, ch, in: tin, cuts, shot }) => ({ kind, start, dur, ch, in: tin, cuts: cuts || [], shot })), frames, keys, quotes, caps, audio };
}
module.exports = { build, FPS };
if (require.main === module) {
  const b = build();
  for (const s of b.scenes) console.log(`${s.start.toFixed(1).padStart(6)}  ${s.dur.toFixed(1).padStart(5)}  ${s.kind} ${s.shot || ''}`);
  console.log('total', b.dur.toFixed(1), 's,', b.N, 'frames;', b.keys.length, 'keys,', b.quotes.length, 'quotes,', b.caps.length, 'caps');
}
