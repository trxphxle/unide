// Records the real unide on the Halo demo page, shot by shot, as screencast frames with timestamps.
// usage: node record.cjs <shot> [<shot>…]   (shots run in order on one page, each captured to frames/<shot>/)
const fs = require('fs'), path = require('path');
const pw = require('/Users/treearc/Documents/GitHub/Hackathon/Project-One/node_modules/playwright-core');
const HERE = __dirname, UNIDE = '/Users/treearc/Documents/treearcProjects/unide';
const BASE = 'http://127.0.0.1:4364', URL = `${BASE}/design/demo/index.html`;
const CHROME = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1169/chrome-mac/Chromium.app/Contents/MacOS/Chromium';
const W = 1600, H = 900, DPR = 2; // a 1600×900 page drawn at 2×: 3200×1800 frames, so the film's camera can push in and stay sharp
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

let page, cdp, mouse = { x: W / 2, y: H / 2 }, events = [];
const ev = (type, data = {}) => events.push({ t: Date.now() / 1000, type, ...data });
async function glide(x, y, ms = 700) {
  const x0 = mouse.x, y0 = mouse.y, n = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) { const k = ease(i / n), px = x0 + (x - x0) * k, py = y0 + (y - y0) * k; await page.mouse.move(px, py); ev('move', { x: px, y: py }); await sleep(ms / n); }
  mouse = { x, y };
}
const centre = (r) => [r.x + r.width / 2, r.y + r.height / 2];
// a rect inside unide's shadow root (or the page), in viewport pixels
const uRect = (sel) => page.evaluate((s) => { const el = document.querySelector('unide-overlay').shadowRoot.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, sel);
const pRect = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, sel);
async function clickU(sel, ms = 600) { const r = await uRect(sel); if (!r) throw new Error('no ' + sel); await glide(...centre(r), ms); await sleep(120); await down(); await sleep(70); await up(); await sleep(250); }
async function altClick(x, y, ms = 800, hold = 650) {
  await glide(x - 60, y - 30, ms * 0.6); await kdown('Alt'); await sleep(200);
  await glide(x, y, ms * 0.4); await sleep(hold);
  await down(); await sleep(70); await up(); await sleep(300); await kup('Alt'); await sleep(200);
}
const cap = (t, s) => ev('caption', { title: t, sub: s || '' });
const cue = (kind, rect = null, zoom = null) => ev('cue', { kind, rect, zoom }); // camera hints: 'wide', 'close' on a rect
const down = async () => { ev('click', { x: mouse.x, y: mouse.y }); await page.mouse.down(); };
const up = () => page.mouse.up();
const kdown = async (k) => { ev('key', { key: k, down: true }); await page.keyboard.down(k); };
const kup = async (k) => { ev('key', { key: k, down: false }); await page.keyboard.up(k); };
const press = async (k) => { ev('key', { key: k, down: true }); await page.keyboard.press(k); ev('key', { key: k, down: false }); };
async function type(text, o) { ev('type', { text }); await page.keyboard.type(text, o); }
// camera: frame these unide parts (and a page element) together
async function frameOn(uSels, pSel) {
  const rs = [];
  for (const u of uSels) { const r = await uRect(u); if (r) rs.push(r); }
  if (pSel) { const r = await pRect(pSel); if (r) rs.push(r); }
  if (!rs.length) return;
  const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y)), r = Math.max(...rs.map((r) => r.x + r.width)), b = Math.max(...rs.map((r) => r.y + r.height));
  cue('close', { x, y, width: r - x, height: b - y });
}
const scrollTo = (sel, block = 'center') => page.evaluate(([s, b]) => document.querySelector(s).scrollIntoView({ behavior: 'smooth', block: b }), [sel, block]);

// screencast: frames with their timestamps
let shotDir = null, frames = [];
async function startShot(name) {
  shotDir = path.join(HERE, 'frames', name); fs.rmSync(shotDir, { recursive: true, force: true }); fs.mkdirSync(shotDir, { recursive: true }); frames = [];
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 86, maxWidth: 3200, maxHeight: 1800, everyNthFrame: 2 });
  events = [];
}
async function stopShot() {
  await cdp.send('Page.stopScreencast');
  fs.writeFileSync(path.join(shotDir, 'times.json'), JSON.stringify(frames));
  fs.writeFileSync(path.join(shotDir, 'events.json'), JSON.stringify(events));
  console.log(`  ${path.basename(shotDir)}: ${frames.length} frames, ${(frames.at(-1)?.t - frames[0]?.t || 0).toFixed(1)}s`);
}
const api = (p, body) => page.evaluate(([p, b]) => fetch('/__unide/' + p, b ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) } : {}).then((r) => r.json()), [p, body]);
const pins = () => api('pins');

const SHOTS = {
  // the first pin: the welcome card, then ⌥-click the grey button and say what's wrong
  async pin() {
    cue('wide'); await glide(1100, 520, 10); await sleep(1600);
    await cap('Meet unide', 'point at it · your agent gets it');
    await sleep(1800);
    await clickU('.welcome [data-act=welcomed]', 900); await cap('');
    const b = await pRect('.buy');
    await sleep(300); await cap('⌥-click anything', 'the page holds still · nothing gets clicked');
    await frameOn([], '.buy'); await altClick(...centre(b), 1100, 900);
    await sleep(450); await frameOn(['.pop'], '.buy');
    await type('make this the obvious next step', { delay: 55 });
    await sleep(700); await cap('Say what should change', 'Return keeps it');
    await press('Enter'); cue('wide'); await sleep(1400);
  },
  // changing it by hand: the colour wheel, then type size and weight
  async style() {
    await cap('Or change it by hand', 'colour · type · fonts · shape · states');
    const badge = await page.evaluate(() => { const m = [...document.querySelector('unide-overlay').shadowRoot.querySelectorAll('.mark')].find((x) => x.style.display !== 'none'); const r = m.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    await glide(...centre(badge), 800); await down(); await sleep(60); await up(); await sleep(700);
    await clickU('.pop [data-act=editside][data-arg$="|style"]', 700); await sleep(500);
    await frameOn(['.pop', '.spanel'], '.buy');
    await clickU('.spanel [data-act=cprop][data-arg$="|background-color"]', 600); await sleep(400);
    const ring = await uRect('.cring canvas'), c = centre(ring), rad = ring.width / 2;
    // sweep round the wheel, settle on a warm orange
    await glide(c[0], c[1], 500); await down();
    for (const [a, r] of [[200, .3], [260, .7], [330, .9], [20, .95], [70, .9], [25, .92]]) { const t = (a * Math.PI) / 180; await glide(c[0] + Math.cos(t) * r * rad, c[1] + Math.sin(t) * r * rad, 420); }
    await up(); await sleep(700);
    await clickU('.spanel [data-act=sidetab][data-arg=text]', 600); await sleep(400);
    await clickU('.typetool [data-arg$="|font-size|up"]', 500); await sleep(250);
    await clickU('.typetool [data-arg$="|font-size|up"]', 300); await sleep(250);
    await clickU('.typetool [data-arg$="|font-weight|800"]', 500); await sleep(900);
    await clickU('.spanel [data-act=editside]', 600); await sleep(300); await press('Escape'); await sleep(300);
    await cap(''); await sleep(500);
  },
  // fonts, live on the big headline
  async fonts() {
    await cap('Try any font, live', '67 trending free fonts · or yours');
    const h = await pRect('h1');
    await altClick(h.x + h.width * 0.3, h.y + h.height * 0.35, 900, 500); await sleep(500);
    await clickU('.pop [data-act=editside][data-arg$="|style"]', 600); await sleep(300);
    await clickU('.spanel [data-act=sidetab][data-arg=font]', 500); await sleep(300);
    await clickU('.spanel [data-act=fontgroup][data-arg$="|serif"]', 500); await frameOn(['.spanel'], 'h1'); await sleep(900);
    for (const f of ['Fraunces', 'Playfair Display', 'DM Serif Display', 'Bodoni Moda', 'Young Serif', 'Fraunces']) {
      const r = await uRect(`.flist .frow[data-font="${f}"] .fname`); if (!r) continue; await glide(r.x + 60, r.y + r.height / 2, 380); await sleep(650);
    }
    const r = await uRect('.flist .frow[data-font="Fraunces"] .fname'); await glide(r.x + 60, r.y + r.height / 2, 200); await down(); await sleep(60); await up(); await sleep(800);
    await type('a bit more character', { delay: 45 }); await press('Enter'); await sleep(600);
    await cap(''); await sleep(400);
  },
  // icons from a free set
  async icons() {
    await scrollTo('#features', 'start'); await sleep(1200);
    await cap('Swap icons', '1,600+ free Lucide icons · preview in place');
    const i = await pRect('.card:nth-child(1) .ico svg');
    await altClick(...centre(i), 900, 500); await sleep(500);
    await clickU('.pop [data-act=editside][data-arg$="|icon"]', 600); await frameOn(['.spanel'], '.card:nth-child(1)'); await sleep(1200);
    for (const n of ['sun', 'moon', 'sparkles', 'zap', 'star', 'sparkles']) { const r = await uRect(`.igrid .icell[data-icon="${n}"]`); if (!r) continue; await glide(...centre(r), 330); await sleep(520); }
    const r = await uRect('.igrid .icell[data-icon="sparkles"]'); await glide(...centre(r), 150); await down(); await sleep(60); await up(); await sleep(700);
    await press('Enter'); await sleep(500); await cap(''); await sleep(300);
  },
  // 3D: hold ⌥ over the lamp, its parts outline by their own shape
  async three() {
    await scrollTo('#studio'); await sleep(1400);
    await cap('Even 3D', 'three.js · React Three Fiber · outlined by its real shape');
    const v = await pRect('#viewer'); const at = (fx, fy) => [v.x + v.width * fx, v.y + v.height * fy]; cue('close', v);
    await glide(...at(0.3, 0.3), 700); await kdown('Alt'); await sleep(300);
    // each part where it really is on screen (the lamp sways, so aim twice: most of the way, then exactly)
    const part = (n) => page.evaluate((n) => { const h = window.__halo, o = h.lamp.getObjectByName(n), v = new h.THREE.Vector3(); o.getWorldPosition(v); v.project(h.camera); const r = h.canvas.getBoundingClientRect(); return [r.x + ((v.x + 1) / 2) * r.width, r.y + ((1 - v.y) / 2) * r.height]; }, n);
    for (const n of ['lamp-base', 'lower-arm', 'elbow-joint', 'upper-arm', 'linen-shade']) { await glide(...(await part(n)), 480); await glide(...(await part(n)), 120); await sleep(n === 'linen-shade' ? 900 : 650); }
    await down(); await sleep(60); await up(); await sleep(300); await kup('Alt'); await sleep(600);
    await type('warmer linen, a touch smaller', { delay: 45 }); await press('Enter'); await sleep(900);
    await cap(''); await sleep(300);
  },
  // every size at once
  async sizes() {
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' })); await sleep(1000);
    await cap('Every screen size', 'pin on the phone · the agent knows it was 390px');
    const dot = await uRect('.bar'); await glide(...centre(dot), 800); await sleep(700);
    await clickU('.bar [data-act=sizes]', 500); cue('wide'); await sleep(4500);
    const r = await page.evaluate(() => { const f = document.querySelector('unide-overlay').shadowRoot.querySelector('.sizes iframe'), b = f.getBoundingClientRect(), s = b.width / 390, t = f.contentDocument.querySelector('.ghost').getBoundingClientRect(); return { x: b.x + t.x * s, y: b.y + t.y * s, width: t.width * s, height: t.height * s }; });
    await altClick(...centre(r), 900, 700); await sleep(600);
    await type('stack these on phones', { delay: 50 }); await press('Enter'); await sleep(900);
    await press('Escape'); await sleep(300);
    await page.evaluate(() => document.querySelector('unide-overlay').shadowRoot.querySelector('.sizes [data-act=sizes]').click()); await sleep(700);
    await cap(''); await sleep(300);
  },
  // send, the agent works, the page updates, before and after
  async send() {
    await cap('⌘ Return sends it', 'to Claude Code · Codex · Cursor · Gemini · any MCP agent');
    const dot = await uRect('.bar'); await glide(...centre(dot), 600); await sleep(500);
    await frameOn(['.bar']); await clickU('.bar [data-act=pinsend]', 500); await sleep(1600); await cap(''); await sleep(400);
  },
  async result() {
    // the "agent" edits the page (the same changes a real one would), then answers the pins
    const f = UNIDE + '/design/demo/index.html'; let s = fs.readFileSync(f, 'utf8');
    s = s.replace(".buy { background:#3a3a44; color:#fff; border:0; padding:15px 26px; border-radius:8px; font:600 16px Inter, sans-serif; cursor:pointer; }",
      ".buy { background:var(--accent); color:var(--accent-ink); border:0; padding:17px 30px; border-radius:999px; font:800 18px Inter, sans-serif; cursor:pointer; box-shadow:0 12px 28px -10px rgba(255,122,61,.7); }");
    s = s.replace("h1 { font:400 78px/0.98 'Instrument Serif', serif;", "h1 { font:400 80px/0.98 'Fraunces', serif; font-optical-sizing:auto;");
    s = s.replace("family=Instrument+Serif:ital@0;1&display=swap", "family=Instrument+Serif:ital@0;1&family=Fraunces:opsz,wght@9..144,400&display=swap");
    fs.writeFileSync(f, s);
    await sleep(2500); // the page reloads by itself
    cue('wide'); await cap('The agent answers', 'the page updates · done pins clear themselves');
    const list = await pins(); const mine = list.filter((p) => p.status === 'sent');
    const buy = mine.find((p) => p.note.startsWith('make this')), h1 = mine.find((p) => p.note.startsWith('a bit more'));
    if (buy) await api('pins/resolve', { id: buy.id, status: 'addressed', reply: 'Pre-order is now the warm accent pill, bigger and bolder' });
    await sleep(300);
    if (h1) await api('pins/resolve', { id: h1.id, status: 'addressed', reply: 'Headline set in Fraunces' });
    await sleep(2200);
    await frameOn(['.donetray']); await clickU('.donetray .doneitem:last-child [data-act=cmpopen]', 900); await sleep(900); await frameOn(['.compare']); await sleep(500);
    await cap('See before and after', 'judge the fix right on the page');
    const sl = await uRect('.compare input[type=range]');
    await glide(sl.x + sl.width * 0.5, sl.y + sl.height / 2, 600); await down();
    for (const k of [0.12, 0.9, 0.3, 0.7, 0.5]) await glide(sl.x + sl.width * k, sl.y + sl.height / 2, 700);
    await up(); await sleep(500);
    await clickU('.compare [data-act=cmpmode][data-arg=side]', 600); await sleep(1800);
    await clickU('.compare [data-act=cmpclose]', 600); await sleep(400); await cap(''); await sleep(300);
  },
  // three options, flip, keep one
  async options() {
    await scrollTo('#pricing'); await sleep(1300);
    await cap('Ask for 3 options', 'the agent builds them · you flip and keep one');
    const c = await pRect('.plan.pro .choose');
    await altClick(...centre(c), 900, 500); await sleep(400);
    await type('needs more pull', { delay: 50 });
    await frameOn(['.pop'], '.plan.pro'); await clickU('.pop [data-act=pinopts]', 600); await sleep(500);
    await kdown('Meta'); await press('Enter'); await kup('Meta'); await sleep(900);
    // the agent builds three
    const f = UNIDE + '/design/demo/index.html'; let s = fs.readFileSync(f, 'utf8');
    const id = (await pins()).find((p) => p.options)?.id;
    s = s.replace('<button class="choose">Choose Studio</button>', `<button class="choose" data-unide-variant="${id}-A" style="background:#fff;color:#1c1a24">Choose Studio</button><button class="choose" data-unide-variant="${id}-B" style="background:linear-gradient(120deg,#ff7a3d,#ff3d8a);color:#fff;border-radius:999px;font-size:17px">Get Studio →</button><button class="choose" data-unide-variant="${id}-C" style="background:var(--accent);color:var(--accent-ink);box-shadow:0 0 0 4px rgba(255,122,61,.35), 0 14px 30px -8px rgba(255,122,61,.8)">Choose Studio ✦ most loved</button>`);
    fs.writeFileSync(f, s);
    await sleep(2400);
    await api('pins/resolve', { id, status: 'options', reply: 'A: quiet white, B: gradient pill, C: glowing accent' });
    await sleep(1500);
    const m = await page.evaluate((id) => { const x = [...document.querySelector('unide-overlay').shadowRoot.querySelectorAll('.mark')].find((b) => b.dataset.arg == id); const r = x.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, id);
    await glide(...centre(m), 800); await down(); await sleep(60); await up(); await sleep(700); await frameOn(['.pop'], '.plan.pro');
    for (const v of ['B', 'C', 'A', 'B', 'C']) { await clickU(`.pop [data-act=pinvariant][data-arg="${id}|${v}"]`, 380); await sleep(650); }
    await clickU('.pop [data-act=pinkeep]', 600); await sleep(1500);
    await cap(''); await sleep(300);
  },
};

(async () => {
  const want = process.argv.slice(2);
  const browser = await pw.chromium.launch({ executablePath: CHROME, headless: true, args: ['--force-color-profile=srgb', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  await ctx.addInitScript({ path: path.join(UNIDE, 'design/demo/director.js') });
  page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  page error:', e.message));
  cdp = await ctx.newCDPSession(page);
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    if (!shotDir) return;
    const n = frames.length, file = `f${String(n).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(shotDir, file), Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
  });
  await page.goto(URL, { waitUntil: 'load' });
  // a clean start: no pins from earlier runs
  for (const p of await pins()) await api('pins/delete', { id: p.id });
  await page.reload({ waitUntil: 'load' }); await sleep(2500);
  await page.mouse.move(mouse.x, mouse.y);
  for (const name of want) {
    console.log('shot', name);
    await startShot(name);
    try { await SHOTS[name](); } catch (e) { console.log('  FAILED:', e.message); }
    await stopShot(); shotDir = null;
  }
  await browser.close();
})();
