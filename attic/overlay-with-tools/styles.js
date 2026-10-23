// The overlay's look, scoped to its shadow root so the page's styles can't reach it.
export const CSS = `
  :host { --bg:#16171b; --bg2:#1f2126; --bg3:#272a31; --line:#2c2f36; --t1:#ececf1; --t2:#a9acb6; --t3:#767a85; --acc:#8fb4ff; --keep:#7fd1a0; --lock:#f0c674; --bad:#ff7a7a; }
  * { box-sizing:border-box; font:12.5px/1.45 -apple-system,system-ui,sans-serif; color:var(--t1); }
  /* the bar's place (dock.js): what opens from it opens on its side */
  :host([data-h=l]) .plist { left:var(--bar-x, 12px); right:auto; }
  :host([data-h=r]) .plist { right:var(--bar-x, 12px); left:auto; }
  :host([data-v=b]) .plist, :host([data-v=b]) .banner.frozen { bottom:var(--bar-y, 62px); top:auto; }
  :host([data-v=t]) .plist, :host([data-v=t]) .banner.frozen { top:var(--bar-y, 62px); bottom:auto; }
  :host([data-v=b]) .toast { bottom:calc(var(--bar-y, 62px) + 2px); top:auto; }
  :host([data-v=t]) .toast { top:calc(var(--bar-y, 62px) + 2px); bottom:auto; }
  :host([data-h=r]) .panel { right:auto; left:12px; }
  /* changing a pinned element by hand (edits.js) */
  .edits { display:grid; gap:4px; padding:6px 0 2px; border-top:1px solid var(--line); }
  .edits .row.wrap { flex-wrap:wrap; gap:4px; }
  .edits .changed { color:var(--keep); }
  .etext { position:fixed; z-index:1; pointer-events:auto; resize:none; box-sizing:border-box; margin:0; border:2px solid var(--acc); border-radius:4px; background:rgba(255,255,255,.96); outline:none; box-shadow:0 4px 18px rgba(0,0,0,.3); }
  .ehandles { position:fixed; display:none; pointer-events:none; outline:1.5px dashed var(--acc); outline-offset:2px; }
  .ehandles.lineonly { outline:none; }
  .ehandles.lineonly .eh { display:none; }
  .eh { position:absolute; pointer-events:auto; background:var(--acc); border:2px solid #fff; box-shadow:0 1px 4px rgba(0,0,0,.4); }
  .eh-w { right:-7px; top:50%; width:10px; height:22px; margin-top:-11px; border-radius:5px; cursor:ew-resize; }
  .eh-h { bottom:-7px; left:50%; width:22px; height:10px; margin-left:-11px; border-radius:5px; cursor:ns-resize; }
  .eh-wh { right:-8px; bottom:-8px; width:14px; height:14px; border-radius:3px; cursor:nwse-resize; }
  .eh-r { width:12px; height:12px; border-radius:50%; background:#f0c674; cursor:nwse-resize; }
  .eh-p-top, .eh-p-bottom { width:18px; height:5px; margin-left:-9px; border-radius:3px; background:#7fd1a0; cursor:ns-resize; }
  .eh-p-left, .eh-p-right { width:5px; height:18px; margin-top:-9px; border-radius:3px; background:#7fd1a0; cursor:ew-resize; }
  .eline { position:absolute; display:none; height:3px; background:#e5007a; border-radius:2px; box-shadow:0 0 0 1px #fff; }
  .sil { position:fixed; pointer-events:none; display:none; }
  .hl { position:fixed; pointer-events:none; border:1.5px solid var(--acc); background:rgba(143,180,255,.10); border-radius:3px; display:none; }
  .hl.ref { border-color:var(--keep); background:rgba(127,209,160,.12); }
  .pins.through .pop, .pins.through .plist, .pins.through .mark { pointer-events:none; opacity:.25; transition:opacity .12s; }
  .hl.del { border-color:var(--bad); background:rgba(255,122,122,.14); }
  .tag.del { background:var(--bad); color:#200; }
  .box { position:fixed; pointer-events:none; border:2px solid var(--acc); border-radius:3px; }
  .box.ref { border:2px dashed var(--keep); }
  .box i { position:absolute; left:-2px; top:-17px; background:var(--acc); color:#0d1220; font:700 10px/15px -apple-system,system-ui,sans-serif; padding:0 5px; border-radius:3px 3px 3px 0; font-style:normal; }
  .box.ref i { background:var(--keep); color:#0b1a12; }
  .ln { position:fixed; pointer-events:none; background:var(--acc); }
  .ln.bad { background:var(--bad); } .ln.mid { background:var(--t3); }
  .ln b { position:absolute; left:4px; top:50%; transform:translateY(-50%); background:var(--acc); color:#0d1220; font:700 10px/14px -apple-system,system-ui,sans-serif; padding:0 4px; border-radius:3px; white-space:nowrap; }
  .ln.bad b { background:var(--bad); } .ln.mid b { background:var(--t3); color:#111; }
  .ln.h b { left:50%; top:4px; transform:translateX(-50%); }
  .al { position:fixed; pointer-events:none; width:0; border-left:1.5px dashed var(--bad); }
  .al b { position:absolute; top:-15px; left:2px; background:var(--bad); color:#200; font:700 10px/14px -apple-system,system-ui,sans-serif; padding:0 4px; border-radius:3px; white-space:nowrap; }
  .tag { position:fixed; pointer-events:none; background:var(--acc); color:#0d1220; font-weight:600; font-size:11px; padding:1px 6px; border-radius:3px; display:none; white-space:nowrap; }
  .tag.ref { background:var(--keep); color:#0b1a12; }
  .tag span { color:inherit; font-weight:400; opacity:.75; font-size:11px; }
  .banner { position:fixed; left:50%; top:12px; transform:translateX(-50%); background:var(--lock); color:#211; font-weight:700; padding:4px 12px; border-radius:999px; display:none; pointer-events:auto; }
  .banner.frozen { background:#9fd3ff; color:#06223a; top:auto; bottom:62px; }
  .banner button { margin-left:8px; padding:1px 8px; font-size:11px; color:#211; background:rgba(255,255,255,.4); border-color:rgba(0,0,0,.2); }
  .bar { position:fixed; left:12px; bottom:12px; display:flex; gap:4px; align-items:center; padding:6px; background:var(--bg); border:1px solid var(--line); border-radius:999px; pointer-events:auto; box-shadow:0 6px 24px rgba(0,0,0,.35); }
  .bar [data-key] { position:relative; }
  .bar [data-key]::after { content:attr(data-key); position:absolute; left:0; bottom:calc(100% + 10px); white-space:nowrap; padding:5px 9px; border-radius:7px; background:var(--bg); border:1px solid var(--line); color:var(--t1); font-size:12px; font-weight:500; box-shadow:0 6px 18px rgba(0,0,0,.35); opacity:0; pointer-events:none; transition:opacity .1s; }
  .bar [data-key]:hover::after { opacity:1; transition-delay:.15s; }
  :host([data-v=t]) .bar [data-key]::after { bottom:auto; top:calc(100% + 10px); }
  :host([data-h=r]) .bar [data-key]::after { left:auto; right:0; }
  .bar .sep { width:1px; height:18px; background:var(--line); margin:0 3px; }
  .brand { font-weight:700; padding:0 8px 0 6px; letter-spacing:.02em; display:inline-flex; align-items:center; gap:4px; }
  .brand .short, .brand .dotn { display:none; }
  /* idle: just a dot with the pin count */
  .bar.mini { padding:4px; gap:0; }
  .bar.mini > :not(.brand) { display:none; }
  .bar.mini .brand { padding:0 4px 0 7px; height:22px; }
  .bar.mini .brand .full { display:none; }
  .bar.mini .brand .short, .bar.mini .brand .dotn { display:inline-block; }
  .brand .dotn { min-width:18px; padding:1px 5px; border-radius:999px; background:var(--bg3); color:var(--t2); font-size:11px; font-weight:600; text-align:center; }
  .brand .dotn.has { background:var(--acc); color:#0d1220; }
  button { cursor:pointer; border:1px solid var(--line); background:var(--bg2); border-radius:999px; padding:5px 11px; }
  button:hover { border-color:var(--t3); }
  button.on { background:var(--acc); color:#0d1220; border-color:var(--acc); font-weight:600; }
  button.keep { background:var(--keep); color:#0b1a12; border-color:var(--keep); font-weight:600; }
  button.lock { background:none; border-color:var(--lock); color:var(--lock); }
  button.primary { background:var(--acc); color:#0d1220; border-color:var(--acc); font-weight:600; }
  button:disabled { opacity:.4; cursor:default; }
  button.mini { padding:1px 8px; font-size:11px; }
  button.link { border:0; background:none; padding:0; color:var(--acc); }
  .count { color:var(--t2); padding:0 8px; }
  .panel { position:fixed; top:12px; right:12px; bottom:12px; width:380px; display:none; flex-direction:column; background:var(--bg); border:1px solid var(--line); border-radius:14px; pointer-events:auto; box-shadow:0 10px 40px rgba(0,0,0,.45); overflow:hidden; }
  .panel.open { display:flex; }
  .tabs { display:flex; gap:2px; padding:8px 8px 0; border-bottom:1px solid var(--line); flex:none; }
  .tabs button { border:0; border-radius:8px 8px 0 0; background:none; color:var(--t2); padding:7px 10px 8px; font-weight:600; }
  .tabs button.cur { background:var(--bg2); color:var(--t1); box-shadow:inset 0 -2px 0 var(--acc); }
  .body { flex:1; overflow:auto; }
  .foot { flex:none; border-top:1px solid var(--line); padding:10px 14px 12px; background:var(--bg); }
  .foot textarea { min-height:38px; }
  .foot .row { justify-content:space-between; }
  section { padding:14px 16px; border-bottom:1px solid var(--line); }
  section:last-child { border-bottom:0; }
  h2 { font-size:15px; font-weight:650; margin:0 0 2px; }
  h3 { font-size:11px; font-weight:650; text-transform:uppercase; letter-spacing:.06em; color:var(--t3); margin:0 0 8px; }
  h3 .hint { text-transform:none; letter-spacing:0; font-weight:400; }
  .muted { color:var(--t2); } .small { font-size:11.5px; color:var(--t3); }
  code { font:11.5px ui-monospace,Menlo,monospace; color:#cfd6e6; background:var(--bg2); padding:1px 5px; border-radius:4px; word-break:break-all; }
  .crumbs { display:flex; flex-wrap:wrap; gap:3px; margin-top:10px; }
  .crumbs button { padding:2px 7px; font-size:11px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; }
  .crumbs button.cur { border-color:var(--acc); color:var(--acc); }
  .dot { width:8px; height:8px; border-radius:2px; border:1px solid rgba(255,255,255,.3); display:inline-block; }
  .src { margin:4px 0 0; padding:0; list-style:none; } .src li { margin:3px 0; }
  .gen { color:var(--lock); font-size:11px; }
  .card { margin-top:10px; padding:12px; background:var(--bg2); border:1px solid var(--line); border-radius:10px; }
  .card:first-child { margin-top:0; }
  .row { display:flex; align-items:center; gap:8px; }
  .grow { flex:1; min-width:0; }
  .sw { width:34px; height:34px; border-radius:8px; border:1px solid rgba(255,255,255,.15); flex:none; }
  .msw { width:16px; height:16px; border-radius:4px; border:1px solid rgba(255,255,255,.2); flex:none; display:inline-block; vertical-align:middle; }
  button.msw { padding:0; cursor:pointer; }
  .arrow { color:var(--t3); }
  .words { font-weight:600; }
  .knob { margin-top:10px; } .knob:first-child { margin-top:0; }
  .knob .k { display:flex; justify-content:space-between; font-size:11.5px; } .knob .k b { font-weight:650; }
  .knob .ends { display:flex; justify-content:space-between; font-size:11px; color:var(--t3); }
  .knob .def { font-size:11px; color:var(--t3); margin-top:1px; }
  input[type=range] { width:100%; margin:4px 0 0; accent-color:var(--acc); }
  input[type=number], input[type=text], select { background:var(--bg2); border:1px solid var(--line); border-radius:6px; padding:3px 6px; }
  input[type=number] { width:64px; }
  .scope { margin-top:10px; display:grid; gap:4px; }
  .scope label, .opt { display:flex; gap:6px; align-items:flex-start; cursor:pointer; }
  .scope input, .opt input { margin-top:3px; }
  .opts { display:grid; gap:6px; margin-top:8px; }
  .opt { padding:7px 9px; background:var(--bg2); border:1px solid var(--line); border-radius:8px; }
  .opt.on { border-color:var(--acc); }
  .opt b { font-weight:650; } .opt .small { display:block; }
  .seg { display:flex; gap:4px; flex-wrap:wrap; }
  .seg button { padding:3px 9px; font-size:11.5px; }
  .members { list-style:none; margin:0; padding:0; display:grid; gap:6px; }
  .members li { padding:8px 10px; background:var(--bg2); border-radius:8px; display:grid; grid-template-columns:auto 1fr auto; gap:2px 8px; align-items:start; }
  .n { font:700 10px/16px -apple-system,system-ui,sans-serif; background:var(--acc); color:#0d1220; border-radius:3px; padding:0 5px; display:inline-block; }
  .members .f { grid-column:2 / 4; font-size:11px; color:var(--t3); }
  .x { padding:0 7px; border:0; background:none; color:var(--t3); }
  .lead { list-style:none; margin:8px 0 0; padding:0; display:grid; gap:4px; }
  .lead li { display:flex; align-items:center; gap:8px; padding:5px 8px; background:var(--bg2); border-radius:7px; }
  .lead li .grow { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .likes { display:grid; gap:4px; margin-top:8px; }
  .likes label { display:grid; grid-template-columns:auto 1fr; gap:6px; align-items:start; font-size:11.5px; cursor:pointer; }
  .likes code { font-size:10.5px; }
  .line { display:flex; align-items:center; gap:8px; padding:6px 0; border-top:1px solid var(--line); }
  .line:first-of-type { border-top:0; }
  .tok { display:flex; align-items:center; gap:8px; width:100%; padding:6px 8px; border:1px solid transparent; border-radius:8px; background:none; text-align:left; }
  .tok:hover { background:var(--bg2); }
  .tok.open { background:var(--bg2); border-color:var(--line); }
  .tok .name { font:600 11.5px ui-monospace,Menlo,monospace; }
  .harm { margin-top:8px; } .harm .row { flex-wrap:wrap; gap:4px; margin-top:3px; }
  .thumbs { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-top:8px; }
  .thumbs button { padding:0; border-radius:8px; overflow:hidden; height:70px; }
  .thumbs button.cur { border-color:var(--acc); border-width:2px; }
  .thumbs img { width:100%; height:100%; object-fit:cover; display:block; }
  .refimg { width:100%; border-radius:8px; cursor:crosshair; display:block; margin-top:8px; }
  .drop { margin-top:8px; padding:14px; border:1.5px dashed var(--line); border-radius:10px; text-align:center; color:var(--t3); }
  .drop.over { border-color:var(--acc); color:var(--acc); }
  textarea { width:100%; min-height:52px; resize:vertical; background:var(--bg2); border:1px solid var(--line); border-radius:8px; padding:7px 9px; }
  .actions { display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; align-items:center; }
  .items { list-style:none; margin:0; padding:0; display:grid; gap:6px; }
  .items li { display:flex; gap:8px; align-items:flex-start; padding:8px 10px; background:var(--bg2); border-radius:8px; }
  .items .x { margin-left:auto; }
  .k { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; }
  .k.change, .k.page { color:var(--keep); } .k.lock { color:var(--lock); } .k.note { color:var(--acc); }
  .empty { color:var(--t3); }
  .ok { color:var(--keep); font-size:11.5px; margin-top:8px; }
  .warn { color:var(--lock); } .bad { color:var(--bad); }
  details > summary { cursor:pointer; list-style:none; } details > summary::-webkit-details-marker { display:none; }
  details > summary h3::after { content:' ▸'; } details[open] > summary h3::after { content:' ▾'; }
  details > summary h3 { margin:0; }
  details[open] > summary { margin-bottom:8px; }
  .tabs { align-items:center; } .tabs .pick { margin:0 4px 6px 0; border-radius:999px; }
  .pins { position:fixed; inset:0; pointer-events:none; }
  .mark { position:fixed; pointer-events:auto; min-width:20px; height:20px; padding:0 5px; border-radius:999px; border:2px solid #fff; font:700 11px/16px -apple-system,system-ui,sans-serif; color:#0d1220; background:var(--acc); box-shadow:0 2px 8px rgba(0,0,0,.35); cursor:pointer; }
  .mark.cur { outline:2px solid var(--acc); outline-offset:2px; }
  .s-draft { background:var(--acc); color:#0d1220; } .s-sent { background:var(--lock); color:#211; } .s-addressed { background:var(--keep); color:#0b1a12; } .s-skipped { background:#9aa0aa; color:#111; }
  .badge { display:inline-grid; place-items:center; min-width:20px; height:20px; padding:0 5px; border-radius:999px; font:700 11px/1 -apple-system,system-ui,sans-serif; flex:none; }
  .pop { position:fixed; width:310px; pointer-events:auto; background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:10px 12px 12px; box-shadow:0 10px 32px rgba(0,0,0,.45); display:grid; gap:6px; }
  .pop textarea { min-height:60px; }
  .pop .layers { display:flex; flex-wrap:wrap; gap:4px; }
  .pop .layers .small { flex-basis:100%; }
  .pop .layer { padding:1px 7px; font-size:11px; border-radius:6px; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .pop .layer.cur { background:var(--acc); color:#0d1220; border-color:var(--acc); font-weight:600; }
  .pop .shots { display:flex; gap:6px; }
  .pop .shots img { max-width:100%; max-height:84px; border-radius:6px; border:1px solid var(--line); background:#fff; }
  .said { font-style:italic; color:var(--t2); }
  .reply { padding:7px 9px; border-radius:8px; background:var(--bg2); border-left:3px solid var(--keep); }
  .reply.s-skipped { border-left-color:#9aa0aa; } .reply b { color:inherit; }
  .reply.s-addressed, .reply.s-skipped { background:var(--bg2); color:var(--t1); }
  .plist { position:fixed; left:12px; bottom:62px; width:340px; max-height:60vh; overflow:auto; pointer-events:auto; background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:10px 12px; box-shadow:0 10px 32px rgba(0,0,0,.45); display:grid; gap:6px; }
  .pitem { display:flex; gap:8px; align-items:flex-start; text-align:left; border-radius:8px; padding:7px 8px; background:var(--bg2); }
  .pitem .grow { display:grid; gap:2px; }
  .pitem .pmain { display:flex; gap:8px; align-items:flex-start; flex:1; min-width:0; text-align:left; border:0; background:none; padding:0; border-radius:0; }
  .pitem .x { flex:none; align-self:center; padding:0 6px; font-size:15px; color:var(--t3); }
  .pitem .x:hover { color:var(--bad); }
  .toast { position:fixed; left:50%; bottom:64px; transform:translateX(-50%); pointer-events:auto; background:var(--keep); color:#0b1a12; font-weight:600; padding:7px 14px; border-radius:14px; box-shadow:0 6px 20px rgba(0,0,0,.35); max-width:80vw; white-space:pre-line; }
`;
