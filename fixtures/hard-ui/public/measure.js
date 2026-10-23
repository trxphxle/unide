// Measuring unide on the hard cases from inside the page (paste into the console, or run through a browser tool).
// For each case: open what needs opening, find the thing a person wants to point at, see what a click there
// would pick (elementFromPoint, which is what unide's click handler gets), pin it through the overlay's own
// module, send it, and read back exactly what the agent gets.
window.__measure = async function measure(only) {
  const { pinClick, P } = await import('/__unide/pins.js');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s, r = document) => r.querySelector(s);
  const byText = (sel, t) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().startsWith(t));
  const CASES = {
    V1: { open: () => q('#V1 .menu-trigger').parentElement.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })), want: () => byText('.hover-menu a', 'Billing') },
    V2: { want: () => q('#V2 .tip') },
    V3: { open: () => byText('#V3 button', 'Save').click(), want: () => q('.toast') },
    V4: { open: () => q('#V4 input').focus(), want: () => byText('#V4 li', 'Lisbon') },
    N1: { want: () => q('#N1 select') },
    N2: { want: () => q('#N2 .price'), point: (r) => [r.left + 6, r.top + r.height / 2], wantPart: '::before' },
    N3: { want: () => q('#N3 p'), wantPart: 'the word “quarterly”' },
    W1: { want: () => q('#W1 open-card').shadowRoot.querySelector('button') },
    W2: { want: () => q('#W2 closed-card'), wantPart: 'its Action button (closed root)' },
    W3: { want: () => q('#W3 iframe').contentDocument?.querySelector('.frame-btn'), frame: () => q('#W3 iframe') },
    W4: { want: () => q('#W4 iframe'), wantPart: 'the Pay now button inside' },
    W5: { want: () => q('#W5 canvas'), wantPart: 'the red bar' },
    W6: { want: () => q('#W6 .clapper') },
    L1: { want: () => q('#L1 .covered') },
    L2: { open: () => byText('#L2 button', 'Open modal').click(), want: () => q('.modal .danger'), close: () => q('.modal-backdrop')?.click() },
    L3: { open: () => byText('#L3 button', 'Sort by').click(), want: () => byText('.portal-dd div', 'Oldest'), close: () => byText('#L3 button', 'Sort by').click() },
    I1: { want: () => byText('#I1 .row', 'Order #1003') },
    I2: { want: () => byText('#I2 li', 'Seoul') },
    I3: { want: () => q('#I3 .ticker') },
    I4: { want: () => q('#I4 .mobile-only') },
    C1: { want: () => byText('#C1 .stack-item', 'Second') },
    C2: { want: () => q('#C2 button') },
    C3: { want: () => q('#C3 .stage > span') },
    C4: { want: () => byText('#C4 .tag', 'Design') },
    C5: { want: () => q('#C5 .cta') },
    P1: { want: () => q('#P1 svg') },
    P2: { want: () => q('#P2 .hero') },
    P3: { want: () => q('#P3 .after-img') },
    P4: { want: () => q('#P4 .long') },
    P5: { want: () => q('#P5 .dd') },
  };
  const out = [];
  for (const [id, c] of Object.entries(CASES)) {
    if (only && !only.includes(id)) continue;
    q('#' + id)?.scrollIntoView({ block: 'center' });
    await sleep(80);
    try { c.open?.(); } catch {}
    await sleep(250);
    const want = c.want();
    const row = { id, exists: !!want };
    if (want) {
      const r = (c.frame ? c.frame() : want).getBoundingClientRect();
      const [x, y] = c.point ? c.point(r) : [r.left + r.width / 2, r.top + Math.min(r.height / 2, 10)];
      const hit = document.elementFromPoint(x, y);
      row.visible = r.width > 0 && r.height > 0;
      row.clickPicks = hit ? hit.tagName.toLowerCase() + (hit.className && typeof hit.className === 'string' ? '.' + hit.className.split(' ')[0] : '') : null;
      row.isWanted = hit === want && !c.wantPart;
      if (hit) {
        await pinClick(hit, false);
        const pin = P.pins.find((p) => p.id === P.open);
        row.pin = pin.id;
        row.el = pin.elements[0];
      }
    }
    try { c.close?.(); } catch {}
    out.push(row);
  }
  return out;
};

// Does each pin find its element again? Same lookup as overlay/pins.js find(): the saved path if the element
// there still looks the same, else the first element with the same tag and text.
window.__refind = async function refind(stir) {
  const pins = (await fetch('/__unide/pins').then((r) => r.json())).filter((p) => p.status !== 'dismissed');
  const find = (e) => {
    let el = null;
    try { el = document.querySelector(e.path); } catch {}
    const same = (x) => x && x.tagName.toLowerCase() === e.tag.split('.')[0] && (!e.text || (x.textContent || '').replace(/\s+/g, ' ').trim().startsWith(e.text.replace(/…$/, '').slice(0, 30)));
    if (same(el)) return el;
    const tag = e.tag.split('.')[0];
    if (!/^[a-z][a-z0-9-]*$/.test(tag)) return el;
    return [...document.getElementsByTagName(tag)].find(same) || el;
  };
  if (stir) await stir();
  return pins.map((p) => {
    const e = p.elements[0];
    if (!e) return { id: p.id };
    const el = find(e), r = el?.getBoundingClientRect();
    const now = el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30) : null;
    return { id: p.id, text: e.text?.slice(0, 30), found: !!el, shown: !!r && r.width > 0, nowText: now, sameText: !!el && (!e.text || now.startsWith(e.text.replace(/…$/, '').slice(0, 20))) };
  });
};
