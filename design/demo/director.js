// Injected while recording the demo film only (never part of unide): a visible cursor with click ripples. (Key caps
// and captions are drawn by the film itself, so they're hidden here.) Everything sits in its own shadow root above the page and unide.
(() => {
  if (window.__director) return;
  const host = document.createElement('demo-director');
  host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  const sr = host.attachShadow({ mode: 'open' });
  sr.innerHTML = `<style>
    .cur { position:fixed; left:0; top:0; width:30px; height:30px; transform:translate(-4px,-3px); transition:transform .05s; filter:drop-shadow(0 3px 6px rgba(0,0,0,.35)); }
    .rip { position:fixed; width:16px; height:16px; margin:-8px 0 0 -8px; border-radius:50%; border:3px solid #ff48b0; box-shadow:0 0 0 2px #0078bf; animation:rip .55s ease-out forwards; }
    @keyframes rip { to { transform:scale(4.2); opacity:0; } }
    .keys, .cap { display:none !important; }
    .keys { position:fixed; right:40px; bottom:40px; display:flex; gap:10px; }
    .key { min-width:74px; height:74px; padding:0 16px; display:grid; place-items:center; background:#fff; border:4px solid #161616; box-shadow:6px 6px 0 #0078bf; font:400 34px/1 'Archivo Black', 'Arial Black', sans-serif; color:#161616; transform:translateY(20px) scale(.8); opacity:0; transition:all .16s cubic-bezier(.2,1.6,.4,1); }
    .key small { display:block; font:12px 'Space Mono', monospace; margin-top:2px; text-align:center; }
    .key.on { transform:none; opacity:1; background:#ff48b0; }
    .cap { position:fixed; left:48px; bottom:46px; max-width:62vw; display:grid; gap:6px; transform:translateY(30px); opacity:0; transition:all .35s cubic-bezier(.2,1.4,.4,1); }
    .cap.on { transform:none; opacity:1; }
    .cap b { justify-self:start; background:#161616; color:#fff; padding:10px 18px; font:400 38px/1.1 'Archivo Black', 'Arial Black', sans-serif; box-shadow:7px 7px 0 #ff48b0; }
    .cap span { justify-self:start; background:#fff; color:#161616; padding:6px 12px; font:18px/1.35 'Space Mono', monospace; border:3px solid #161616; box-shadow:5px 5px 0 #0078bf; }
  </style>
  <svg class="cur" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 14.8 L11.6 21.5 L14.4 20.3 L11.4 13.7 L17.5 13.6 Z" fill="#fff" stroke="#161616" stroke-width="1.6" stroke-linejoin="round"/></svg>
  <div class="keys"><div class="key" data-k="Alt">⌥<small>Option</small></div><div class="key" data-k="Shift">⇧<small>Shift</small></div><div class="key" data-k="Meta">⌘<small>Command</small></div><div class="key" data-k="Enter">↩<small>Return</small></div></div>
  <div class="cap"><b></b><span></span></div>`;
  const cur = sr.querySelector('.cur');
  // the page's root may not exist yet (this runs first): wait for it, then stay its last child, above everything
  const keep = () => { const d = document.documentElement; if (d && (host.parentNode !== d || d.lastElementChild !== host)) d.append(host); };
  const watch = () => { keep(); new MutationObserver(keep).observe(document.documentElement, { childList: true }); };
  if (document.documentElement) watch(); else new MutationObserver((_, o) => { if (document.documentElement) { o.disconnect(); watch(); } }).observe(document, { childList: true });
  addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', (e) => { const r = document.createElement('i'); r.className = 'rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; sr.append(r); setTimeout(() => r.remove(), 700); cur.style.transform = 'translate(-4px,-3px) scale(.86)'; }, true);
  addEventListener('mouseup', () => { cur.style.transform = 'translate(-4px,-3px)'; }, true);
  const key = (k, on) => sr.querySelector(`.key[data-k="${k}"]`)?.classList.toggle('on', on);
  addEventListener('keydown', (e) => key(e.key, true), true);
  addEventListener('keyup', (e) => key(e.key, false), true);
  addEventListener('blur', () => sr.querySelectorAll('.key').forEach((k) => k.classList.remove('on')));
  window.__director = {
    caption(title, sub = '') { const c = sr.querySelector('.cap'); c.classList.remove('on'); setTimeout(() => { c.querySelector('b').textContent = title; c.querySelector('span').textContent = sub; c.querySelector('span').style.display = sub ? '' : 'none'; c.classList.toggle('on', !!title); }, title ? 120 : 0); },
    flashKey(k, ms = 500) { key(k, true); setTimeout(() => key(k, false), ms); },
    hideCursor(h) { cur.style.display = h ? 'none' : ''; },
  };
})();
