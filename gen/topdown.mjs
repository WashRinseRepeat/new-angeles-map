// A straight top-down image of a map page over a world rectangle, rendered in square orthographic tiles and
// stitched in the page. North is up.
//
//   node spikes/map/gen/topdown.mjs --page=gareth.html --rect=-5004,-2446,3675,3684 --mpp=1.39 \
//     --out=spikes/map/settings/gareth/compare/built.jpg [--hour=12] [--tile=960]
//
// --rect is x0,z0,x1,z1 in world metres and --mpp the metres per pixel. Each tile is at most 1400 m wide, so the
// sun's shadow map, which reaches 700 m round the view's target, covers it. A .jpg out is written at quality .9,
// anything else as PNG. It exits with 1 on a page error.

import { writeFileSync } from 'node:fs';
import { openMap } from './harness.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const page = arg('page') ?? 'index.html', out = arg('out'), hour = Number(arg('hour') ?? 12), mpp = Number(arg('mpp') ?? 2);
const rect = arg('rect')?.split(',').map(Number), tile = Math.min(Number(arg('tile') ?? 960), Math.floor(1360 / mpp));
if (!out || rect?.length !== 4) { console.error('Give --out=file and --rect=x0,z0,x1,z1'); process.exit(2); }

setTimeout(() => { console.error('topdown: did not finish within 20 minutes'); process.exit(1); }, 1200000).unref();

const [x0, z0, x1, z1] = rect, W = Math.round((x1 - x0) / mpp), H = Math.round((z1 - z0) / mpp);
const cols = Math.ceil(W / tile), rows = Math.ceil(H / tile), span = tile * mpp;
const { page: p, browser, server, errors } = await openMap(`?view=${(x0 + x1) / 2},3000,${(z0 + z1) / 2 + 1},${(x0 + x1) / 2},0,${(z0 + z1) / 2}`, page);
await p.setViewportSize({ width: tile, height: tile });
await p.evaluate(([w, h, hr]) => {
  document.getElementById('wSkip')?.click();
  const c = document.querySelector('#clock input');
  if (c) { c.value = hr; c.dispatchEvent(new Event('input', { bubbles: true })); }
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  window.__top = out;
}, [W, H, hour]);
await p.evaluate(() => window.__pump(20));

for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const cx = x0 + (c + .5) * span, cz = z0 + (r + .5) * span;

  // The frame loop runs with the camera 3000 m straight above the tile, so it draws the sun's shadows round it.

  await p.evaluate(([x, z]) => {
    const s = window.spike;
    s.controls.target.set(x, 0, z); s.camera.position.set(x, 3000, z + 1); s.controls.update();
  }, [cx, cz]);
  await p.evaluate(() => window.__pump(8));

  // One render through an orthographic projection, without fog, clouds or AO, copied into the stitched image
  // in the same task, before the browser clears the drawing buffer.

  await p.evaluate(async ([x, z, half, px, py, n]) => {
    const R = await import('/engine/render.js'), s = window.spike, cam = s.camera;
    s.renderer.setPixelRatio(1); s.composer.setPixelRatio(1);
    s.renderer.setSize(n, n, false); s.composer.setSize(n, n);
    for (const t of s.TILES()) t.mesh.visible = true;
    for (const pass of s.composer.passes) if (pass === R.aoPass) pass.enabled = false;
    else if (pass.constructor.name === 'CloudPass') {
      pass.enabled = false;
      const col = s.renderer.getClearColor(R.FOG.clone()), a = s.renderer.getClearAlpha();
      s.renderer.setRenderTarget(pass.rt); s.renderer.setClearColor(0, 0); s.renderer.clear(); s.renderer.setRenderTarget(null);
      s.renderer.setClearColor(col, a);
    }
    R.U.uFogNear.value = s.scene.fog.near = 1e7; R.U.uFogFar.value = s.scene.fog.far = 2e7;
    cam.up.set(0, 0, -1); cam.position.set(x, 3000, z); cam.lookAt(x, 0, z); cam.updateMatrixWorld();
    cam.projectionMatrix.makeOrthographic(-half, half, half, -half, 1, 6000);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    R.NEAR.hold = true; s.composer.render(); R.NEAR.hold = false;
    window.__top.getContext('2d').drawImage(s.renderer.domElement, px, py);
    cam.up.set(0, 1, 0); cam.updateProjectionMatrix();
  }, [cx, cz, span / 2, c * tile, r * tile, tile]);
  console.log(`tile ${r * cols + c + 1}/${rows * cols}`);
}

const jpg = /\.jpe?g$/i.test(out);
const data = await p.evaluate(j => window.__top.toDataURL(j ? 'image/jpeg' : 'image/png', .9), jpg);
writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
console.log(`${out}: ${W}x${H}, ${mpp} m/px, ${cols}x${rows} tiles`);
if (errors.length) console.log(`console errors:\n${errors.join('\n')}`);
await browser.close();
server.close();
process.exit(errors.some(e => e.startsWith('pageerror')) ? 1 : 0);
