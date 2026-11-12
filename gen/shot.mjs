// Screenshots of a map page from fixed views, in a headless browser of its own, so several builders can check their
// work at once without sharing one browser.
//
//   node spikes/map/gen/shot.mjs --page=gareth.html --out=/tmp/shots \
//     --view=front:-2600,190,-330,-2836,60,-634 --view=far:-1200,900,1900,-1700,0,300 [--hour=22] [--size=1280x800] [--layer=name]
//
// Each --view is name:camX,camY,camZ,targetX,targetY,targetZ in world metres. --hour sets the clock for every view.
// --layer opens the page on a pack layer, such as a dungeon level.
// It writes <out>/<name>.png, prints draw calls and triangles per view, and prints the page's console errors. It
// exits with 1 on a page error. The page loads once, which takes 30–60 s for a large city.

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openMap } from './harness.mjs';

const arg = k => process.argv.filter(a => a.startsWith(`--${k}=`)).map(a => a.slice(k.length + 3));
const [page = 'index.html'] = arg('page'), [out = '.'] = arg('out'), [hour] = arg('hour'), [size = '1280x800'] = arg('size'), [layer] = arg('layer');
const views = arg('view').map(v => { const [name, at] = v.split(':'); return { name, at: at.split(',').map(Number) }; });
if (!views.length) { console.error('Give at least one --view=name:camX,camY,camZ,tX,tY,tZ'); process.exit(2); }
mkdirSync(out, { recursive: true });

// A page that never finishes loading fails after ten minutes instead of hanging.

setTimeout(() => { console.error('shot: the page did not finish within 10 minutes'); process.exit(1); }, 600000).unref();

const [w, h] = size.split('x').map(Number);
const { page: p, browser, server, errors } = await openMap(`?view=${views[0].at.join(',')}${layer ? `&layer=${layer}` : ''}`, page);
await p.setViewportSize({ width: w, height: h });
await p.evaluate(() => { const b = document.getElementById('wSkip'); if (b && !document.getElementById('welcome')?.hidden) b.click(); });

// The page's clock stands still, so a layer's cut would never ease to its level. Step the clock until it settles.

if (layer) for (let k = 0; k < 40; k++) await p.evaluate(() => { window.__t += 100; return window.__pump(1); });

if (hour !== undefined) await p.evaluate(v => {
  const c = document.querySelector('#clock input');
  if (c) { c.value = v; c.dispatchEvent(new Event('input', { bubbles: true })); }
}, Number(hour));
for (const v of views) {
  await p.evaluate(([x, y, z, tx, ty, tz]) => {
    const s = window.spike;
    s.camera.position.set(x, y, z); s.controls.target.set(tx, ty, tz); s.controls.update();
  }, v.at);
  await p.evaluate(() => window.__pump(40));
  const info = await p.evaluate(() => {
    const s = window.spike;
    s.renderer.info.autoReset = false; s.renderer.info.reset(); s.composer.render();
    const r = { calls: s.renderer.info.render.calls, triangles: s.renderer.info.render.triangles };
    s.renderer.info.autoReset = true;
    return r;
  });
  const file = join(out, `${v.name}.png`);
  await p.screenshot({ path: file });
  console.log(`${v.name}: ${file}  ${info.calls} draw calls, ${(info.triangles / 1e6).toFixed(2)} M triangles`);
}
if (errors.length) console.log(`console errors:\n${errors.join('\n')}`);
await browser.close();
server.close();
process.exit(errors.some(e => e.startsWith('pageerror')) ? 1 : 0);
