// Colour maths (OKLCH, after Björn Ottosson) and the words for colours this tool teaches.

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const round = (v) => +v.toFixed(1);
export const px = (v) => parseFloat(v) || 0;

export const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const delin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export function toOklch([r, g, b]) {
  [r, g, b] = [r, g, b].map((v) => lin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), H: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}
function fromOklch({ L, C, H }) {
  const h = (H * Math.PI) / 180, A = C * Math.cos(h), B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707612701 * s];
}
const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
// out-of-gamut colours keep their lightness and hue and lose chroma until they fit
export function oklchToRgb(c) {
  let lo = 0, hi = c.C, rgb = fromOklch(c);
  if (!inGamut(rgb)) {
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; inGamut(fromOklch({ ...c, C: mid })) ? (lo = mid) : (hi = mid); }
    rgb = fromOklch({ ...c, C: lo });
  }
  return rgb.map((v) => Math.round(clamp(delin(clamp(v))) * 255));
}
export const hex = (rgb, a = 1) => '#' + [...rgb.slice(0, 3), ...(a < 1 ? [Math.round(a * 255)] : [])].map((v) => v.toString(16).padStart(2, '0')).join('');
export const fmtOklch = ({ L, C, H }) => `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${Math.round(H)})`;

const cv = document.createElement('canvas'); cv.width = cv.height = 1;
const cx = cv.getContext('2d', { willReadFrequently: true });
// any CSS colour string → [r,g,b,a], via the browser's own parser
export function parse(str) {
  if (!str) return null;
  cx.fillStyle = '#010203'; cx.fillStyle = str;
  if (cx.fillStyle === '#010203' && !/#010203/i.test(str)) return null;
  cx.clearRect(0, 0, 1, 1); cx.fillRect(0, 0, 1, 1);
  const d = cx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3] / 255];
}

const FAMILIES = [[0, 'pink'], [22, 'red'], [45, 'orange'], [75, 'amber'], [100, 'yellow'], [125, 'lime'], [145, 'green'],
  [180, 'teal'], [215, 'cyan'], [255, 'blue'], [285, 'indigo'], [310, 'purple'], [340, 'magenta'], [360, 'pink']];
export const family = (H) => FAMILIES.reduce((a, b) => (Math.abs(b[0] - H) < Math.abs(a[0] - H) ? b : a))[1];
export function describe({ L, C, H }) {
  const light = L < 0.3 ? 'very dark' : L < 0.45 ? 'dark' : L < 0.68 ? 'mid' : L < 0.86 ? 'light' : 'very light';
  if (C < 0.02) return `${light} grey`;
  let fam = family(H);
  if (H > 30 && H < 95 && C < 0.07 && L > 0.84) fam = 'cream';
  else if (H > 25 && H < 85 && L < 0.5 && C < 0.13) fam = 'brown';
  const sat = C < 0.05 ? 'greyish' : C < 0.1 ? 'muted' : C < 0.16 ? 'moderate' : 'vivid';
  return `${sat} ${fam}, ${light}`;
}
export const words = (rgb) => describe(toOklch(rgb));
const lum = ([r, g, b]) => { const [R, G, B] = [r, g, b].map((v) => lin(v / 255)); return 0.2126 * R + 0.7152 * G + 0.0722 * B; };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export const oklabDist = (p, q) => {
  const a = toOklch(p), b = toOklch(q), h1 = (a.H * Math.PI) / 180, h2 = (b.H * Math.PI) / 180;
  return Math.hypot(a.L - b.L, a.C * Math.cos(h1) - b.C * Math.cos(h2), a.C * Math.sin(h1) - b.C * Math.sin(h2));
};

// knob steps
export const STEP = { L: 0.03, C: 0.02, H: 6 };
export const shift = (base, s) => ({ L: clamp(base.L + s.L * STEP.L), C: Math.max(0, base.C + s.C * STEP.C), H: (base.H + s.H * STEP.H + 360) % 360 });
export const moved = (s) => !!(s && (s.L || s.C || s.H));
export function movesInWords(s) {
  const n = (k) => `${Math.abs(s[k])} step${Math.abs(s[k]) > 1 ? 's' : ''}`;
  const out = [];
  if (s.L) out.push(`${n('L')} ${s.L > 0 ? 'lighter' : 'darker'}`);
  if (s.C) out.push(`${n('C')} ${s.C > 0 ? 'more vivid' : 'more muted'}`);
  if (s.H) out.push(`hue ${s.H > 0 ? '+' : '−'}${Math.abs(s.H * STEP.H)}°`);
  return out.join(', ');
}

// colours that go with a base colour, each set with the reason designers use it
export function harmonies(rgb) {
  const o = toOklch(rgb);
  const at = (dH, dL = 0, dC = 0) => oklchToRgb({ L: clamp(o.L + dL), C: Math.max(0, o.C + dC), H: (o.H + dH + 360) % 360 });
  return [
    { name: 'Analogous', hint: 'Neighbours on the colour wheel: calm and related.', colours: [at(-30), at(-15), at(15), at(30)] },
    { name: 'Complementary', hint: 'The opposite colour: strong contrast, for accents.', colours: [at(180, -0.08), at(180), at(180, 0.1)] },
    { name: 'Split complementary', hint: 'Both neighbours of the opposite: contrast with less tension.', colours: [at(150), at(210)] },
    { name: 'Triad', hint: 'Three evenly spaced: lively.', colours: [at(120), at(240)] },
    { name: 'Tints and shades', hint: 'The same colour lighter and darker: for surfaces, borders and text.', colours: [at(0, 0.3, -o.C * 0.6), at(0, 0.18, -o.C * 0.3), at(0, -0.12), at(0, -0.24, -o.C * 0.2)] },
    { name: 'Muted', hint: 'The same hue with less colour: for backgrounds behind the vivid one.', colours: [at(0, 0.1, -o.C * 0.5), at(0, 0.22, -o.C * 0.7), at(0, -0.08, -o.C * 0.4)] },
  ];
}
