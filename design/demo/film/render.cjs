// Renders the film frame by frame: the compositor page draws frame n, we take the picture. Several pages at once.
// usage: node render.cjs                 → out/f00000.jpg … (all frames)
//        node render.cjs --at 12.5,30    → stills/s-12.50.jpg … (film seconds), for checking
const fs = require('fs'), path = require('path');
const pw = require('/Users/treearc/Documents/GitHub/Hackathon/Project-One/node_modules/playwright-core');
const { build } = require('./film.cjs');
const CHROME = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1169/chrome-mac/Chromium.app/Contents/MacOS/Chromium';
const HERE = __dirname;
(async () => {
  const data = build();
  fs.writeFileSync(path.join(HERE, 'film.json'), JSON.stringify({ dur: data.dur, N: data.N, scenes: data.scenes, keys: data.keys, quotes: data.quotes, audio: data.audio }));
  const ai = process.argv.indexOf('--at');
  let jobs, outDir;
  if (ai > 0) { outDir = path.join(HERE, process.env.STILLS || 'stills'); jobs = process.argv[ai + 1].split(',').map((s) => ({ n: Math.min(data.N - 1, Math.round(+s * data.fps)), name: `s-${(+s).toFixed(2)}.jpg` })); }
  else { outDir = path.join(HERE, 'out'); const from = +(process.argv[2] || 0), to = +(process.argv[3] || data.N); jobs = []; for (let n = from; n < to; n++) jobs.push({ n, name: `f${String(n).padStart(5, '0')}.jpg` }); }
  fs.mkdirSync(outDir, { recursive: true });
  const W = Math.min(+(process.env.WORKERS || 6), jobs.length);
  const browser = await pw.chromium.launch({ executablePath: CHROME, headless: true, args: ['--force-color-profile=srgb', '--allow-file-access-from-files', '--disable-web-security'] });
  const t0 = Date.now(); let done = 0;
  // contiguous chunks per worker, so the camera's image cache stays warm
  const per = Math.ceil(jobs.length / W);
  await Promise.all(Array.from({ length: W }, async (_, w) => {
    const mine = jobs.slice(w * per, (w + 1) * per); if (!mine.length) return;
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.log('page error:', e.message));
    await page.goto('file://' + path.join(HERE, 'comp.html'));
    await page.evaluate(async () => { await document.fonts.ready; for (const f of ['400 100px "Archivo Black"', '400 20px "Space Mono"', '700 20px "Space Mono"', '600 20px Inter']) await document.fonts.load(f); });
    await page.evaluate((d) => window.init(d), data);
    const cdp = await page.context().newCDPSession(page);
    for (const j of mine) {
      await page.evaluate((n) => window.draw(n), j.n);
      const { data: b64 } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, captureBeyondViewport: false });
      fs.writeFileSync(path.join(outDir, j.name), Buffer.from(b64, 'base64'));
      if (++done % 150 === 0) console.log(`${done}/${jobs.length}  ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
    }
  }));
  await browser.close();
  console.log(`done ${jobs.length} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})();
