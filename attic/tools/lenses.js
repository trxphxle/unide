// Ways of looking at the page without changing it: before/after, squint, gray, colour vision, motion.
import { S, preview, lensStyle, mounted, $, $$, setInterval } from './core.js';

export function compare(on) {
  S.comparing = on;
  preview.media = on ? 'not all' : '';
  $('.before').style.display = on ? 'block' : 'none';
  $('.hold')?.classList.toggle('on', on);
}

// colour-vision simulation (the commonly used matrices for the three kinds of colour blindness)
const MATRICES = {
  protanopia: '0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0',
  deuteranopia: '0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0',
  tritanopia: '0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0',
};
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
svg.setAttribute('aria-hidden', 'true');
svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
svg.innerHTML = Object.entries(MATRICES).map(([k, v]) => `<filter id="unide-${k}"><feColorMatrix type="matrix" values="${v}"/></filter>`).join('');
mounted.push(svg);

export const VISION = {
  normal: 'Typical colour vision',
  deuteranopia: 'Deuteranopia: green-blind, the strongest form of the most common kind',
  protanopia: 'Protanopia: red-blind',
  tritanopia: 'Tritanopia: blue-blind (rare)',
  achromatopsia: 'No colour at all (very rare)',
};
export const MOTION = { normal: 'Normal speed', slow: 'Slow motion (¼ speed)', paused: 'Paused', off: 'Off: no animations or transitions' };

export function applyLenses() {
  const v = S.lens.vision;
  const f = [S.lens.squint && 'blur(3px)', (S.lens.gray || v === 'achromatopsia') && 'grayscale(1)', MATRICES[v] && `url(#unide-${v})`].filter(Boolean).join(' ');
  lensStyle.textContent = [f && `body{filter:${f} !important}`,
    S.lens.motion === 'off' && '*,*::before,*::after{animation:none !important;transition:none !important}'].filter(Boolean).join('\n');
  $$('[data-lens]').forEach((b) => b.classList.toggle('on', !!S.lens[b.dataset.lens]));
  motionTick();
}

// slow motion and pause act on the page's running animations, including ones that start later.
// Motion drawn frame by frame in JavaScript isn't an animation the browser knows about, so it keeps its speed.
const touched = new Set();
function motionTick() {
  const m = S.lens.motion;
  for (const a of document.getAnimations()) {
    if (m === 'slow') { a.playbackRate = 0.25; touched.add(a); }
    else if (m === 'paused' && a.playState === 'running') { a.pause(); touched.add(a); }
  }
  if (m === 'normal' || m === 'off') {
    for (const a of touched) { try { a.playbackRate = 1; if (a.playState === 'paused') a.play(); } catch { /* finished */ } }
    touched.clear();
  }
}
setInterval(() => { if (S.lens.motion === 'slow' || S.lens.motion === 'paused') motionTick(); }, 250);
