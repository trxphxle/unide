// The overlay's look, scoped to its shadow root so the page's styles can't reach it.
// Riso poster: two print inks (pink and blue) a little off register, black edges, Archivo Black and Space Mono.
export const INK = { pink: '#ff48b0', blue: '#0078bf', ink: '#161616' };
export const FONTS = 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Mono:wght@400;700&display=swap';
// the mark: a whirlpool. Many arms of a logarithmic spiral (each turn wider by the same ratio), in the blues with a
// couple of pink streaks, fading out at the rim. Turning such a spiral looks like the water being drawn in forever,
// not like a shape spinning, because a turned log spiral is the same spiral, only smaller.
const ARMS = [['#0078bf', 1.3], ['#5aaee0', .7], ['#00508a', 1], ['#ff48b0', .8], ['#0078bf', .6], ['#7cc2ec', 1.1], ['#00508a', .7], ['#0078bf', .9], ['#ff48b0', .6], ['#3d94cf', 1]];
function arm(turn) {
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * 3.2 * Math.PI, r = 0.5 * Math.exp(0.31 * t), a = t + turn;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return 'M' + pts.join(' L');
}
export const whirl = (id) => `<defs><radialGradient id="${id}g"><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="${id}m"><circle cx="12" cy="12" r="11.5" fill="url(#${id}g)"/></mask></defs>`
  + `<g mask="url(#${id}m)"><g class="vortex">${ARMS.map(([c, w], i) => `<path d="${arm((i / ARMS.length) * 2 * Math.PI)}" stroke="${c}" stroke-width="${w}"/>`).join('')}</g></g>`;
export const LOGO = `<svg class="logo" viewBox="0 0 24 24" aria-label="unide" role="img">${whirl('unide-w')}</svg>`;

export const CSS = `
  :host { --ink:#161616; --paper:#ffffff; --cream:#f4f1ea; --pink:${INK.pink}; --blue:${INK.blue}; --green:#00a95c; --grey:#a7a39a; --soft:#5f5d57; --faint:#8d8a83;
    --display:'Archivo Black', 'Arial Black', Impact, sans-serif; --mono:'Space Mono', ui-monospace, Menlo, monospace; --edge:3px solid var(--ink); --press:4px 4px 0 var(--blue); }
  * { box-sizing:border-box; font:12px/1.5 var(--mono); color:var(--ink); }
  /* the bar's place (dock.js): what opens from it opens on its side */
  :host([data-h=l]) .plist { left:var(--bar-x, 12px); right:auto; }
  :host([data-h=r]) .plist { right:var(--bar-x, 12px); left:auto; }
  :host([data-v=b]) .plist, :host([data-v=b]) .banner.frozen { bottom:var(--bar-y, 62px); top:auto; }
  :host([data-v=t]) .plist, :host([data-v=t]) .banner.frozen { top:var(--bar-y, 62px); bottom:auto; }
  :host([data-v=b]) .toast { bottom:calc(var(--bar-y, 62px) + 2px); top:auto; }
  :host([data-v=t]) .toast { top:calc(var(--bar-y, 62px) + 2px); bottom:auto; }

  /* controls */
  button { cursor:pointer; border:2px solid var(--ink); background:var(--paper); border-radius:0; padding:3px 10px; font:12px/1.4 var(--mono); }
  button:hover { background:var(--cream); }
  button.on, button.primary { background:var(--pink); border-color:var(--ink); }
  button.primary:disabled { background:var(--paper); }
  button:disabled { opacity:.45; cursor:default; }
  button.mini { padding:1px 7px; font-size:11px; }
  .x { padding:0 6px; border:0; background:none; color:var(--faint); font:15px/1 var(--mono); }
  .x:hover { color:var(--pink); background:none; }
  textarea { width:100%; min-height:60px; resize:vertical; background:var(--paper); border:2px solid var(--ink); border-radius:0; padding:7px 9px; outline:none; }
  textarea:focus { box-shadow:3px 3px 0 var(--pink); }
  code { font:11px var(--mono); background:var(--cream); padding:1px 5px; word-break:break-all; }
  .row { display:flex; align-items:center; gap:8px; }
  .grow { flex:1; min-width:0; }
  .small { font-size:11px; color:var(--soft); }
  .warn { color:var(--pink); }

  /* the bar, and the dot it folds into */
  .bar { position:fixed; left:12px; bottom:12px; display:flex; gap:4px; align-items:center; padding:4px; background:var(--paper); border:var(--edge); box-shadow:var(--press); pointer-events:auto; }
  .bar button { border-color:transparent; }
  .bar button:hover { border-color:var(--ink); background:var(--paper); }
  .bar button.on, .bar button.primary:not(:disabled) { background:var(--pink); border-color:var(--ink); }
  .bar [data-key] { position:relative; }
  .bar [data-key]::after { content:attr(data-key); position:absolute; left:0; bottom:calc(100% + 12px); white-space:nowrap; padding:4px 8px; background:var(--ink); color:var(--paper); font:11px var(--mono); opacity:0; pointer-events:none; transition:opacity .1s; }
  .bar [data-key]:hover::after { opacity:1; transition-delay:.15s; }
  :host([data-v=t]) .bar [data-key]::after { bottom:auto; top:calc(100% + 12px); }
  :host([data-h=r]) .bar [data-key]::after { left:auto; right:0; }
  .brand { display:inline-flex; align-items:center; gap:5px; padding:0 6px 0 3px; cursor:grab; }
  .logo { width:24px; height:24px; flex:none; overflow:visible; }
  .logo path { fill:none; stroke-linecap:round; mix-blend-mode:multiply; }
  .logo .vortex { transform-origin:12px 12px; animation:unide-whirl 5s linear infinite; }
  .bar:hover .logo .vortex { animation-duration:2s; }
  @keyframes unide-whirl { to { transform:rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .logo .vortex { animation:none; } }
  .brand .dotn { display:none; min-width:18px; padding:1px 4px; background:var(--cream); font:11px/1.3 var(--display); text-align:center; }
  .brand .dotn.has { background:var(--pink); }
  .bar.mini { padding:3px; gap:0; }
  .bar.mini > :not(.brand) { display:none; }
  .bar.mini .brand { padding:0 3px 0 2px; }
  .bar.mini .brand .dotn { display:inline-block; }

  /* what's under the pointer, and the frozen banner */
  .hl { position:fixed; pointer-events:none; border:2px solid var(--pink); box-shadow:3px 3px 0 0 var(--blue); display:none; }
  .hl.del { border-color:var(--ink); box-shadow:3px 3px 0 0 var(--pink); background:rgba(255,72,176,.12); }
  .tag { position:fixed; pointer-events:none; background:var(--ink); color:var(--paper); font:11px/1.6 var(--mono); padding:0 6px; display:none; white-space:nowrap; }
  .tag span { color:#c9c6bf; font:11px var(--mono); }
  .tag.del { background:var(--pink); color:var(--ink); }
  .tag.del span { color:var(--ink); }
  .banner { position:fixed; left:50%; top:12px; transform:translateX(-50%); background:var(--blue); color:var(--paper); font:12px/1.6 var(--mono); padding:5px 12px; border:var(--edge); display:none; pointer-events:auto; }
  .banner.frozen { top:auto; bottom:62px; }
  .banner button { margin-left:8px; color:var(--ink); }
  .sil { position:fixed; pointer-events:none; display:none; }
  /* while you write a pin: a paper wash over everything but it (cheap to draw: no filters), the other badges fade */
  .spot i { position:fixed; pointer-events:none; background:rgba(236,232,222,.72); opacity:0; transition:opacity .18s; }
  .spot.on i { opacity:1; }
  .pins.focus .mark:not(.cur) { opacity:.3; }
  @media (prefers-reduced-motion: reduce) { .spot i { transition:none; } }

  /* pins: badges, the card, the list, answers */
  .pins { position:fixed; inset:0; pointer-events:none; }
  .pins.through .pop, .pins.through .plist, .pins.through .mark { pointer-events:none; opacity:.25; transition:opacity .12s; }
  .badge { display:inline-grid; place-items:center; min-width:22px; height:22px; padding:0 5px; font:12px/1 var(--display); flex:none; border:2px solid var(--ink); }
  .mark { position:fixed; pointer-events:auto; min-width:22px; height:22px; padding:0 5px; border:2px solid var(--ink); font:12px/18px var(--display); box-shadow:2px 2px 0 var(--blue); cursor:pointer; }
  .mark.cur { box-shadow:3px 3px 0 var(--blue), 0 0 0 3px var(--paper); }
  .s-draft { background:var(--pink); color:var(--ink); }
  .s-sent { background:var(--blue); color:var(--paper); }
  .s-addressed { background:var(--green); color:var(--paper); }
  .s-skipped { background:var(--grey); color:var(--ink); }
  .pop { position:fixed; width:320px; pointer-events:auto; background:var(--paper); border:var(--edge); box-shadow:6px 6px 0 var(--blue); padding:12px 14px 14px; display:grid; gap:7px; }
  .pop > .row:first-child b { font:14px/1.15 var(--display); }
  .pop .layers { display:flex; flex-wrap:wrap; gap:4px; }
  .pop .layers .small { flex-basis:100%; }
  .pop .layer { padding:0 6px; font-size:11px; border-width:2px; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .pop .layer.cur { background:var(--pink); }
  .pop .shots { display:flex; gap:6px; }
  .pop .shots img { max-width:100%; max-height:84px; border:2px solid var(--ink); background:var(--paper); }
  .said { font-style:italic; }
  .reply { padding:7px 9px; background:var(--cream); border-left:5px solid var(--green); }
  .reply.s-skipped { border-left-color:var(--grey); }
  .reply.s-addressed, .reply.s-skipped { background:var(--cream); color:var(--ink); }
  .reply b { font:12px var(--display); }
  .plist { position:fixed; left:12px; bottom:62px; width:350px; max-height:60vh; overflow:auto; pointer-events:auto; background:var(--paper); border:var(--edge); box-shadow:6px 6px 0 var(--blue); padding:10px 12px; display:grid; gap:7px; }
  .plist > .row:first-child b { font:13px var(--display); }
  .pitem { display:flex; gap:8px; align-items:flex-start; text-align:left; padding:7px 8px; background:var(--cream); }
  .pitem .grow { display:grid; gap:2px; }
  .pitem .pmain { display:flex; gap:8px; align-items:flex-start; flex:1; min-width:0; text-align:left; border:0; background:none; padding:0; }
  .pitem .x { flex:none; align-self:center; }
  .toast { position:fixed; left:50%; bottom:64px; transform:translateX(-50%); pointer-events:auto; background:var(--blue); color:var(--paper); font:12px/1.5 var(--mono); padding:8px 14px; border:var(--edge); box-shadow:4px 4px 0 var(--pink); max-width:80vw; white-space:pre-line; }

  /* changing a pinned element by hand (edits.js) */
  .edits { display:grid; gap:4px; padding:7px 0 2px; border-top:2px solid var(--ink); }
  .edits .row.wrap { flex-wrap:wrap; gap:4px; }
  .edits .changed { color:var(--blue); }
  .etext { position:fixed; z-index:1; pointer-events:auto; resize:none; margin:0; border:3px solid var(--pink); background:rgba(255,255,255,.97); outline:none; box-shadow:4px 4px 0 var(--blue); }
  .ehandles { position:fixed; display:none; pointer-events:none; outline:2px dashed var(--pink); outline-offset:3px; }
  .ehandles.lineonly { outline:none; }
  .ehandles.lineonly .eh { display:none; }
  .eh { position:absolute; pointer-events:auto; background:var(--pink); border:2px solid var(--ink); }
  .eh-w { right:-8px; top:50%; width:10px; height:22px; margin-top:-11px; cursor:ew-resize; }
  .eh-h { bottom:-8px; left:50%; width:22px; height:10px; margin-left:-11px; cursor:ns-resize; }
  .eh-wh { right:-9px; bottom:-9px; width:14px; height:14px; cursor:nwse-resize; }
  .eh-r { width:13px; height:13px; border-radius:50%; background:var(--blue); cursor:nesw-resize; }
  .eh-p-top, .eh-p-bottom { width:18px; height:6px; margin-left:-9px; background:var(--paper); cursor:ns-resize; }
  .eh-p-left, .eh-p-right { width:6px; height:18px; margin-top:-9px; background:var(--paper); cursor:ew-resize; }
  /* while Shape is on: the padding as shaded bands, what each handle does, the old size and the value while dragging */
  .epad { position:absolute; pointer-events:none; background:repeating-linear-gradient(45deg, rgba(0,120,191,.24) 0 3px, rgba(0,120,191,.08) 3px 6px); }
  .ehandles.lineonly .epad { display:none; }
  .eh::after { content:attr(data-tip); position:absolute; left:50%; top:calc(100% + 8px); transform:translateX(-50%); white-space:nowrap; background:var(--ink); color:var(--paper); font:11px/1.6 var(--mono); padding:0 6px; opacity:0; pointer-events:none; transition:opacity .1s; }
  .eh:hover::after { opacity:1; transition-delay:.2s; }
  .ehandles.dragging .eh { opacity:.35; }
  .ehandles.dragging .eh::after { opacity:0; }
  .ehandles.dragging[data-h=w] .eh-w, .ehandles.dragging[data-h=h] .eh-h, .ehandles.dragging[data-h=wh] .eh-wh, .ehandles.dragging[data-h=r] .eh-r,
  .ehandles.dragging[data-h=p-top] .eh-p-top, .ehandles.dragging[data-h=p-right] .eh-p-right, .ehandles.dragging[data-h=p-bottom] .eh-p-bottom, .ehandles.dragging[data-h=p-left] .eh-p-left { opacity:1; }
  .eghost { position:fixed; display:none; pointer-events:none; border:2px dashed var(--ink); opacity:.45; }
  .eread { position:fixed; display:none; pointer-events:none; background:var(--pink); color:var(--ink); border:2px solid var(--ink); box-shadow:3px 3px 0 var(--blue); font:12px/1.5 var(--mono); padding:2px 8px; white-space:nowrap; z-index:2; }
  /* pins the agent finished: a tray by the bar, and before and after */
  .donetray { position:fixed; left:var(--bar-x, 12px); bottom:var(--bar-y, 62px); width:340px; display:grid; gap:6px; pointer-events:auto; }
  :host([data-h=r]) .donetray { left:auto; right:var(--bar-x, 12px); }
  :host([data-v=t]) .donetray { bottom:auto; top:var(--bar-y, 62px); }
  .doneitem { display:flex; gap:8px; align-items:center; background:var(--paper); border:var(--edge); box-shadow:4px 4px 0 var(--green); padding:6px 8px; }
  .doneitem b { font:12px var(--display); }
  .compare { position:fixed; left:50%; top:50%; transform:translate(-50%, -50%); width:min(760px, calc(100vw - 32px)); max-height:calc(100vh - 32px); overflow:auto; pointer-events:auto; background:var(--paper); border:var(--edge); box-shadow:8px 8px 0 var(--green); padding:14px 16px; display:grid; gap:8px; z-index:3; }
  .compare > .row { flex-wrap:wrap; gap:4px; }
  .compare > .row b { font:14px var(--display); margin-right:6px; }
  .cmpstack { position:relative; border:2px solid var(--ink); background:var(--cream); }
  .cmpstack img { display:block; width:100%; height:auto; }
  .cmpstack .cmpbefore { position:absolute; inset:0; height:100%; object-fit:fill; }
  .cmpline { position:absolute; top:0; bottom:0; width:3px; margin-left:-1.5px; background:var(--pink); box-shadow:0 0 0 1px var(--paper); pointer-events:none; }
  .cmpside { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .cmpside figure { margin:0; border:2px solid var(--ink); background:var(--cream); }
  .cmpside img { display:block; width:100%; height:auto; }
  .cmpside figcaption { font:11px var(--mono); padding:3px 6px; border-top:2px solid var(--ink); background:var(--paper); }
  .cmpwait { padding:40px 12px; text-align:center; font:12px var(--mono); color:var(--soft); }
  .compare input[type=range] { width:100%; accent-color:var(--pink); }
  /* the side panel beside the pin card: Style (colour, font, copy look), Image, Icon */
  .spanel { position:fixed; width:300px; pointer-events:auto; background:var(--paper); border:var(--edge); box-shadow:6px 6px 0 var(--pink); padding:12px 14px 14px; display:grid; gap:7px; }
  .spanel > .row:first-child b { font:13px/1.2 var(--display); }
  .spanel > .row.wrap { flex-wrap:wrap; gap:4px; }
  .pins.through .spanel { pointer-events:none; opacity:.25; }
  .spanel .flist { max-height:min(48vh, 380px); }
  .imgtool, .icontool { display:grid; gap:7px; }
  .ithumb { position:relative; height:140px; border:2px solid var(--ink); background:var(--cream) center/cover no-repeat; cursor:crosshair; }
  .ifocus { position:absolute; width:18px; height:18px; margin:-9px 0 0 -9px; border:3px solid var(--paper); outline:2px solid var(--ink); border-radius:50%; background:var(--pink); pointer-events:none; }
  .idrop { border:2px dashed var(--ink); padding:12px; text-align:center; font:12px var(--mono); }
  .idrop.over { background:var(--pink); }
  .ipick { color:var(--blue); text-decoration:underline; cursor:pointer; }
  .iurl, .isearch { width:100%; border:2px solid var(--ink); padding:4px 8px; font:12px var(--mono); outline:none; }
  .iurl:focus, .isearch:focus { box-shadow:3px 3px 0 var(--pink); }
  .igrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(38px, 1fr)); gap:4px; max-height:min(44vh, 300px); overflow:auto; }
  .icell { height:38px; padding:0; display:grid; place-items:center; border:2px solid var(--ink); background:var(--paper); }
  .icell img { width:20px; height:20px; }
  .icell:hover { background:var(--cream); }
  .icell.cur { background:var(--pink); }
  /* colours: a panel of its own beside the pin card */
  .cpanel { position:fixed; width:300px; pointer-events:auto; background:var(--paper); border:var(--edge); box-shadow:6px 6px 0 var(--pink); padding:12px 14px 14px; display:grid; gap:7px; }
  .cpanel > .row:first-child b { font:13px/1.2 var(--display); }
  .pins.through .cpanel { pointer-events:none; opacity:.25; }
  .cwheel { display:grid; gap:7px; }
  .cwheel .row.wrap { flex-wrap:wrap; gap:4px; }
  .cdot { display:inline-block; width:10px; height:10px; border:1.5px solid var(--ink); margin-right:5px; vertical-align:-1px; }
  .cring { position:relative; width:176px; height:176px; justify-self:center; }
  .cring canvas { width:176px; height:176px; border-radius:50%; border:3px solid var(--ink); box-shadow:4px 4px 0 var(--blue); cursor:crosshair; touch-action:none; }
  .cmark { position:absolute; width:16px; height:16px; margin:-8px 0 0 -8px; border:3px solid var(--paper); outline:2px solid var(--ink); border-radius:50%; pointer-events:none; }
  .cwheel input[type=range] { width:100%; accent-color:var(--pink); }
  .cnow { width:26px; height:26px; border:2px solid var(--ink); flex:none; }
  .chex { width:96px; border:2px solid var(--ink); padding:3px 6px; font:12px var(--mono); outline:none; }
  .cswatches { display:flex; flex-wrap:wrap; gap:4px; }
  .csw { width:22px; height:22px; padding:0; border:2px solid var(--ink); }
  .csw:hover { transform:translate(-1px, -1px); box-shadow:2px 2px 0 var(--ink); }
  button.link { border:0; background:none; padding:0; color:var(--blue); text-decoration:underline; font:11px var(--mono); }
  /* trying typefaces: a panel of its own beside the pin card */
  .fpanel { position:fixed; width:300px; pointer-events:auto; background:var(--paper); border:var(--edge); box-shadow:6px 6px 0 var(--pink); padding:12px 14px 14px; display:grid; gap:6px; }
  .fpanel > .row:first-child b { font:13px/1.2 var(--display); }
  .fpanel .flist { max-height:min(52vh, 420px); }
  .pins.through .fpanel { pointer-events:none; opacity:.25; }
  .fonts { display:grid; gap:6px; padding:6px 0 2px; }
  .fonts .row.wrap { flex-wrap:wrap; gap:4px; }
  .fsearch { width:100%; border:2px solid var(--ink); padding:4px 8px; font:12px var(--mono); outline:none; }
  .fsearch:focus { box-shadow:3px 3px 0 var(--pink); }
  .flist { max-height:210px; overflow:auto; border:2px solid var(--ink); background:var(--paper); }
  .frow { display:flex; align-items:center; gap:8px; padding:3px 8px; border-bottom:1px solid var(--cream); }
  .frow:hover { background:var(--cream); }
  .frow.cur { background:var(--pink); }
  .fname { flex:1; text-align:left; border:0; background:none; padding:2px 0; font-size:17px !important; line-height:1.25 !important; color:var(--ink); }
  .fname:hover { background:none; }
  .fsrc { flex:none; font:11px var(--mono); color:var(--soft); }
  .fsrc a, .fonts .small a { color:var(--blue); font:11px var(--mono); }
  .eline { position:absolute; display:none; height:4px; background:var(--pink); box-shadow:2px 2px 0 var(--blue); }
`;
