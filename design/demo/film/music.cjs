// The soundtrack, synthesised on the film's own clock (film.json): 120 BPM, A minor, i–VI–III–VII.
// Drums, bass and pads drop where the picture drops; every click, key and typed letter in the footage gets a sound.
// usage: node music.cjs → music.wav (44.1 kHz stereo)
const fs = require('fs'), path = require('path');
const F = JSON.parse(fs.readFileSync(path.join(__dirname, 'film.json')));
const SR = 44100, DUR = F.dur + 0.2, N = Math.ceil(DUR * SR);
const L = new Float32Array(N), R = new Float32Array(N), RL = new Float32Array(N), RR = new Float32Array(N), DL = new Float32Array(N), DR = new Float32Array(N);
let seed = 7; const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const at = (t) => Math.round(t * SR);
const scene = (k, n = 0) => F.scenes.filter((s) => s.kind === k)[n];
function put(i, l, r, rev = 0, duck = false) { if (i < 0 || i >= N) return; if (duck) { DL[i] += l; DR[i] += r; } else { L[i] += l; R[i] += r; } if (rev) { RL[i] += l * rev; RR[i] += r * rev; } }
class Biquad {
  constructor(type, f, q = 0.707) { this.type = type; this.q = q; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f); }
  set(f) { const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR, c = Math.cos(w), a = Math.sin(w) / (2 * this.q); let b0, b1, b2;
    if (this.type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (this.type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = a; b1 = 0; b2 = -a; }
    const a0 = 1 + a; this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * c) / a0; this.a2 = (1 - a) / a0; }
  run(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}

// ---------- instruments ----------
const kicks = [];
function kick(t, a = 1) {
  kicks.push(t); const i0 = at(t), n = at(0.5);
  for (let i = 0; i < n; i++) { const s = i / SR, f = 46 + 120 * Math.exp(-s * 30), ph = 2 * Math.PI * (46 * s + (120 / 30) * (1 - Math.exp(-s * 30)));
    let v = Math.sin(ph) * Math.exp(-s * 6.5) * a; if (s < 0.004) v += noise() * 0.5 * a * (1 - s / 0.004); v = Math.tanh(v * 1.6) * 0.75; put(i0 + i, v, v); }
}
function clap(t, a = 1) {
  const bp = new Biquad('bp', 1400, 0.9), i0 = at(t), n = at(0.35);
  for (let i = 0; i < n; i++) { const s = i / SR, e = s < 0.03 ? Math.exp(-(s % 0.01) * 260) : Math.exp(-(s - 0.03) * 17);
    const v = bp.run(noise()) * e * a * 0.9 + Math.sin(2 * Math.PI * 185 * s) * Math.exp(-s * 40) * 0.25 * a; put(i0 + i, v, v, 0.35); }
}
function hat(t, a = 0.3, open = false, pan = 0) {
  const hp = new Biquad('hp', 8000, 0.8), i0 = at(t), d = open ? 0.28 : 0.045, n = at(d * 4);
  for (let i = 0; i < n; i++) { const s = i / SR, v = hp.run(noise()) * Math.exp(-s / d * 1.3) * a; put(i0 + i, v * (1 - pan), v * (1 + pan), 0.08); }
}
function bass(t, d, m, a = 0.5) {
  const lp = new Biquad('lp', 600, 1.1), i0 = at(t), n = at(d), f = mtof(m); let ph = 0;
  for (let i = 0; i < n + at(0.05); i++) { const s = i / SR; ph += f / SR; const saw = 2 * (ph % 1) - 1, sub = Math.sin(2 * Math.PI * ph);
    lp.set(180 + 1600 * Math.exp(-s * 14)); const env = Math.min(1, s / 0.004) * (s < d ? 1 : Math.exp(-(s - d) * 80));
    const v = (lp.run(saw) * 0.55 + sub * 0.6) * env * a; put(i0 + i, v, v, 0, true); }
}
function pad(t, d, notes, a = 0.14, cut = 1800, rel = 0.8) {
  const i0 = at(t), n = at(d + rel);
  notes.forEach((m, k) => {
    for (const [det, pan] of [[-0.11, -0.7], [0.0, 0], [0.12, 0.7]]) {
      const f = mtof(m + det), lp = new Biquad('lp', cut, 0.7); let ph = noise() * 0.5 + 0.5;
      for (let i = 0; i < n; i++) { const s = i / SR; ph += f / SR; const saw = 2 * (ph % 1) - 1;
        const env = Math.min(1, s / 0.35) * (s < d ? 1 : Math.exp(-(s - d) / rel * 3));
        if (i % 64 === 0) lp.set(cut * (0.75 + 0.25 * Math.sin(s * 1.3 + k)));
        const v = lp.run(saw) * env * a / notes.length; put(i0 + i, v * (1 - pan * 0.6), v * (1 + pan * 0.6), 0.45, true); }
    }
  });
}
function pluck(t, m, a = 0.12, pan = 0) {
  const lp = new Biquad('lp', 3000, 2), i0 = at(t), n = at(0.4), f = mtof(m); let ph = 0;
  for (let i = 0; i < n; i++) { const s = i / SR; ph += f / SR; lp.set(500 + 5000 * Math.exp(-s * 22)); const sq = (ph % 1) < 0.5 ? 1 : -1;
    const v = lp.run(sq) * Math.exp(-s * 9) * a; put(i0 + i, v * (1 - pan), v * (1 + pan), 0.3);
    // a dotted-eighth echo
    put(i0 + i + at(0.375), v * 0.35 * (1 + pan), v * 0.35 * (1 - pan), 0.2); }
}
function impact(t, a = 1) {
  const lp = new Biquad('lp', 900, 0.7), i0 = at(t), n = at(2.2);
  for (let i = 0; i < n; i++) { const s = i / SR, f = 32 + 60 * Math.exp(-s * 6);
    const boom = Math.sin(2 * Math.PI * (32 * s + (60 / 6) * (1 - Math.exp(-s * 6)))) * Math.exp(-s * 2.2);
    const crash = lp.run(noise()) * Math.exp(-s * 4) * 0.9, air = noise() * Math.exp(-s * 6) * 0.12;
    const v = Math.tanh((boom * 0.95 + crash + air) * a * 1.2) * 0.8; put(i0 + i, v, v, 0.6); }
  kicks.push(t);
}
function riser(t0, t1, a = 0.35) {
  const bp = new Biquad('bp', 400, 2.5), i0 = at(t0), n = at(t1 - t0); let ph = 0;
  for (let i = 0; i < n; i++) { const p = i / n; if (i % 32 === 0) bp.set(300 + 7000 * p * p); ph += (110 + 660 * p * p) / SR;
    const v = (bp.run(noise()) * 1.4 + (2 * (ph % 1) - 1) * 0.12 * p) * a * p * p; const w = Math.sin(p * 40) * 0.3; put(i0 + i, v * (1 - w), v * (1 + w), 0.4); }
}
function roll(t0, t1, a = 0.5) { // a snare roll that speeds up
  let t = t0, k = 0; while (t < t1) { const p = (t - t0) / (t1 - t0); clap(t, a * (0.25 + 0.75 * p)); const step = p < 0.5 ? 0.125 : p < 0.8 ? 0.0625 : 0.03125; t += step; k++; }
}
function whoosh(t, d = 0.6, a = 0.5) {
  const bp = new Biquad('bp', 500, 1.2), i0 = at(t - d / 2), n = at(d);
  for (let i = 0; i < n; i++) { const p = i / n; if (i % 32 === 0) bp.set(300 + 5000 * Math.sin(p * Math.PI)); const e = Math.sin(p * Math.PI) ** 2;
    const v = bp.run(noise()) * e * a * 1.6; put(i0 + i, v * (1.2 - p), v * (0.2 + p), 0.25); }
}
function blip(t, f, d, a, rev = 0.1, pan = 0) { const i0 = at(t), n = at(d); for (let i = 0; i < n; i++) { const s = i / SR, v = Math.sin(2 * Math.PI * f * s) * Math.exp(-s / d * 5) * a; put(i0 + i, v * (1 - pan), v * (1 + pan), rev); } }
const uiClick = (t) => { blip(t, 2300, 0.03, 0.22); blip(t, 1150, 0.05, 0.14); const i0 = at(t); for (let i = 0; i < 90; i++) put(i0 + i, noise() * 0.18 * (1 - i / 90), noise() * 0.18 * (1 - i / 90)); };
const uiKey = (t) => { blip(t, 520, 0.07, 0.3, 0.1); const hp = new Biquad('hp', 2000), i0 = at(t); for (let i = 0; i < 300; i++) { const v = hp.run(noise()) * 0.25 * (1 - i / 300); put(i0 + i, v, v); } };
const tick = (t, k) => { const bp = new Biquad('bp', 3000 + (k % 5) * 400, 3), i0 = at(t); for (let i = 0; i < 220; i++) { const v = bp.run(noise()) * 0.5 * Math.exp(-i / 50); put(i0 + i, v * 0.8, v); } };
const pop = (t, k) => { const i0 = at(t), n = at(0.08); let ph = 0; for (let i = 0; i < n; i++) { const p = i / n; ph += (480 + 700 * p) / SR; const v = Math.sin(2 * Math.PI * ph) * (1 - p) * 0.32; put(i0 + i, v * (k % 2 ? 0.6 : 1.2), v * (k % 2 ? 1.2 : 0.6), 0.2); } };
function glitch(t) { const i0 = at(t), n = at(0.16); let hold = 0; for (let i = 0; i < n; i++) { if (i % 140 === 0) hold = noise(); const v = Math.round(hold * 4) / 4 * 0.22 * (1 - i / n) * (Math.floor(i / 700) % 2 ? 1 : 0.3); put(i0 + i, v, -v); } }

// ---------- arrangement ----------
const CH = [[57, 60, 64, 69], [53, 57, 60, 65], [55, 60, 64, 67], [55, 59, 62, 67]], ROOT = [33, 29, 36, 31];
const drop1 = scene('foot', 0).start, sendS = scene('send'), agentS = scene('agent'), res = scene('foot', 6), works = scene('works'), outro = scene('outro'), prob = scene('problem');
function groove(a, b, o = {}) {
  for (let t = a; t < b - 1e-6; t += 0.5) {
    const bar = Math.floor((t - drop1 + 1e-6) / 2), beat = Math.round((t - drop1) / 0.5) % 4, ch = ((bar % 4) + 4) % 4;
    if (o.kick !== false) kick(t, beat === 0 ? 1 : 0.9);
    if (o.clap !== false && (beat === 1 || beat === 3)) clap(t, 0.55);
    hat(t + 0.25, 0.22, beat === 3 && o.open, 0.2); if (o.sixteen) { hat(t + 0.125, 0.08, false, -0.3); hat(t + 0.375, 0.08, false, 0.3); }
    if (o.bass !== false) { bass(t, 0.2, ROOT[ch] + (beat % 2 ? 12 : 0), 0.42); bass(t + 0.25, 0.18, ROOT[ch] + 12, 0.32); }
    if (o.arp) { const tones = CH[ch]; for (let k = 0; k < 4; k++) pluck(t + k * 0.125, tones[(beat * 4 + k) % 4] + 12, 0.07, (k % 2 ? 0.4 : -0.4)); }
  }
  if ((o.padA ?? 1) > 0) for (let t = a; t < b - 1e-6; t += 2) { const bar = Math.floor((t - drop1 + 1e-6) / 2), ch = ((bar % 4) + 4) % 4; pad(t, Math.min(2, b - t), CH[ch], o.padA ?? 0.13, o.cut ?? 2200, 0.5); }
}
// open: a swell into the logo's slam, then a held chord
riser(0, 1.0, 0.35); impact(1.0, 1.0); pad(1.0, 3.3, [45, 57, 64, 69, 72], 0.16, 1200, 1.2);
for (let t = 2.0; t < 4.5; t += 0.25) hat(t, 0.06 + 0.06 * ((t - 2) / 2.5), false, Math.sin(t * 3) * 0.4);
kick(3.0, 0.6); kick(3.5, 0.6); kick(4.0, 0.7); kick(4.25, 0.5);
// the problem: a nervous pulse, faster pops, then a hard stop and a riser into the drop
const P0 = prob.start;
for (let t = P0; t < P0 + 3.75 - 1e-6; t += 0.5) { kick(t, 0.75); hat(t + 0.25, 0.18); bass(t, 0.2, 33, 0.35); bass(t + 0.25, 0.2, 45, 0.25); }
pad(P0, 3.75, [57, 60, 63, 69], 0.1, 900, 0.3); // a darker, tenser chord
[0.25, 0.75, 1.2, 1.62, 2.0, 2.34, 2.64, 2.9, 3.14, 3.36].forEach((x, k) => pop(P0 + x, k));
impact(P0 + 3.75, 1.1); riser(P0 + 4.1, P0 + 4.95, 0.3);
impact(P0 + 4.95, 0.9); roll(P0 + 4.95, drop1, 0.4); uiClick(P0 + 5.5); blip(P0 + 5.5, 880, 0.3, 0.2, 0.4);
// the footage: full groove
impact(drop1, 0.8);
groove(drop1, sendS.start, { sixteen: true, arp: false, open: true });
groove(drop1 + 6.5, sendS.start, { kick: false, clap: false, bass: false, arp: true, padA: 0 }); // arps join at Style
// sent: two hits, then the groove carries the names
impact(sendS.start, 0.9); impact(sendS.start + 0.5, 0.9);
groove(sendS.start + 1.0, agentS.start, { sixteen: true, open: true });
riser(agentS.start - 1.0, agentS.start, 0.25);
// the agent works: no drums, just the chord, arps and the typing
groove(agentS.start, res.start, { kick: false, clap: false, bass: false, arp: true, padA: 0.24, cut: 1500 });
for (let t = agentS.start; t < res.start - 1e-6; t += 0.5) hat(t + 0.25, 0.1);
for (let k = 0; k < 23; k++) tick(agentS.start + 0.1 + k * 0.75 / 23, k);
[1.15, 3.0, 4.3, 4.9].forEach((x) => blip(agentS.start + x, 1320, 0.12, 0.16, 0.3));
riser(res.start - 1.5, res.start, 0.35); roll(res.start - 1.0, res.start, 0.3);
// the result and the options: the groove again, brighter
impact(res.start, 0.85);
groove(res.start, works.start, { sixteen: true, arp: true, open: true, cut: 3000 });
// works with: a stab on every word, then the two lines, then the build
for (let k = 0; k < 9; k++) { const t = works.start + k * 0.25; kick(t, 0.8); pad(t, 0.18, CH[k % 4].map((m) => m + 12), 0.2, 4000, 0.08); }
impact(works.start + 2.25, 0.8); impact(works.start + 2.75, 0.8);
roll(works.start + 3.0, outro.start, 0.45); riser(works.start + 2.9, outro.start, 0.3);
// outro: the last hit and a long chord
impact(outro.start, 1.2); pad(outro.start, 4.5, [45, 57, 64, 69, 71, 76], 0.2, 1600, 2.5); bass(outro.start, 3.5, 33, 0.4);
for (let k = 0; k < 6; k++) pluck(outro.start + 1.5 + k * 0.125, [69, 72, 76, 81, 76, 72][k], 0.06);
for (let k = 0; k < 12; k++) tick(outro.start + 1.5 + (k * 0.7) / 12, k);

// picture cues: transitions, clicks, keys, letters
for (const s of F.scenes) { if (s.in === 'ink') whoosh(s.start, 0.8, 0.45); if (s.in === 'glitch') glitch(s.start); if (s.in === 'fly') whoosh(s.start + 0.2, 0.5, 0.3); }
let tk = 0;
for (const c of F.audio) { if (c.kind === 'click') uiClick(c.t); else if (c.kind === 'key') uiKey(c.t); else if (c.kind === 'tick') tick(c.t, tk++); else if (c.kind === 'glitch') glitch(c.t); }

// ---------- mix: sidechain, reverb, limiter ----------
kicks.sort((a, b) => a - b);
let ki = 0;
for (let i = 0; i < N; i++) { const t = i / SR; while (ki + 1 < kicks.length && kicks[ki + 1] <= t) ki++; const dt = kicks[ki] <= t ? t - kicks[ki] : 9; const g = 1 - 0.65 * Math.exp(-dt * 9); L[i] += DL[i] * g; R[i] += DR[i] * g; }
function reverb(inp, sizes) {
  const out = new Float32Array(N), combs = sizes.map((d) => ({ b: new Float32Array(d), i: 0, f: 0 })), aps = [556, 441].map((d) => ({ b: new Float32Array(d), i: 0 }));
  for (let n = 0; n < N; n++) { const x = inp[n] * 0.3; let y = 0;
    for (const c of combs) { const o = c.b[c.i]; c.f = o * 0.7 + c.f * 0.3; c.b[c.i] = x + c.f * 0.84; c.i = (c.i + 1) % c.b.length; y += o; }
    for (const a of aps) { const o = a.b[a.i], v = -0.5 * y + o; a.b[a.i] = y + 0.5 * o; a.i = (a.i + 1) % a.b.length; y = v; }
    out[n] = y * 0.25; }
  return out;
}
const vl = reverb(RL, [1557, 1617, 1491, 1422]), vr = reverb(RR, [1580, 1640, 1514, 1445]);
let peak = 0; for (let i = 0; i < N; i++) { L[i] += vl[i]; R[i] += vr[i]; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
const fadeA = at(F.dur - 1.0), fadeB = at(F.dur);
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
const gain = 1.25 / Math.max(1, peak * 0.9);
for (let i = 0; i < N; i++) { const f = i < fadeA ? 1 : i > fadeB ? 0 : 1 - (i - fadeA) / (fadeB - fadeA);
  const l = Math.tanh(L[i] * gain) * 0.93 * f, r = Math.tanh(R[i] * gain) * 0.93 * f;
  buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4); }
fs.writeFileSync(path.join(__dirname, 'music.wav'), buf);
console.log('music.wav', DUR.toFixed(1) + 's, peak before limiter', peak.toFixed(2));
