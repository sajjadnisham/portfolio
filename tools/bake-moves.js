// Bake the Mixamo clips (tools/source/3d/*.fbx) into assets/3d/moves.json.
// Needs a static server on :8765 at the repo root and Playwright.
//   python3 -m http.server 8765 &  node tools/bake-moves.js
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/tools/lab/bake.html');
  await p.waitForFunction(() => window.__done, null, { timeout: 240000 });
  const out = await p.evaluate(() => JSON.stringify(window.__out));
  fs.writeFileSync(__dirname + '/../assets/3d/moves.json', out);
  const o = JSON.parse(out);
  for (const [k, c] of Object.entries(o.clips)) console.log(k, c.d + 's', c.tracks.length, 'tracks');
  console.log('size', (out.length / 1024).toFixed(0) + 'KB');
  await b.close();
})();
