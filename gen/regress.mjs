// Map regression check. It captures fixed views of the map from two trees and compares them, so an engine change
// can show that a setting still looks and behaves the same.
//
//   node spikes/map/gen/regress.mjs [ref]            the working tree against a git ref (default main)
//   node spikes/map/gen/regress.mjs capture <dir>    capture the working tree only
//   node spikes/map/gen/regress.mjs compare <a> <b>  compare two captures
//
// Options: --page=<file in the map folder> (default index.html), --views=default,ride, --out=<dir>, --tolerance=<pixels>,
// --gpu (use the machine's GPU instead of SwiftShader, faster but less portable).
//
// Each tree is served by a small static server. three.js comes from gen/node_modules (npm install in gen/), so the
// check runs offline. The page runs on a frozen clock with a seeded Math.random, and three's UUIDs draw from their
// own stream, so object counts never shift other random numbers. The harness pumps animation frames itself, so
// every capture runs the same frames however long loading takes. A view records the draw calls, the canvas pixels
// and the visible labels. A run also records the build stats, the ride tours and the console errors.
// The check exits with 1 when anything differs past the pixel tolerance.
// It needs Playwright with Chromium: npm install --no-save playwright in gen/, then npx playwright install chromium.

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The map folder is the parent of gen/. It sits at spikes/map in the archive and at the root of the public copy.

const GEN = fileURLToPath(new URL('./', import.meta.url)), MAP = resolve(GEN, '..');
const ROOT = execFileSync('git', ['-C', MAP, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const MAP_PATH = relative(ROOT, MAP).split(sep).join('/');
const args = process.argv.slice(2), opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
const pos = args.filter(a => !a.startsWith('--'));
const PAGE = opt.page ?? 'index.html', TOLERANCE = +(opt.tolerance ?? 0);
const OUT = resolve(opt.out ?? join(tmpdir(), 'map-regress'));

// ---------- views ----------
// A view sets the camera in setup, runs steps of 0.1 s, then settles for 7 frames and captures. Views on one query
// share a page and run in order, so the card and the ride follow the overview as a visitor's session would.
// Setup code runs in the page with R (engine/render.js) and spike (window.spike). It reads the centre under its
// new or old name, so a ref from before the setting packs works too.

const CENTRE = 'const C = spike.CENTRE ?? spike.STALK, P = spike.CENTRE_PLACE ?? spike.STALK_PLACE;';
const look = (cx, cy, cz, tx, ty, tz) => `R.controls.target.set(${tx}, ${ty}, ${tz}); R.camera.position.set(${cx}, ${cy}, ${cz}); R.camera.lookAt(R.controls.target); R.controls.update();`;
const VIEWS = [
  { name: 'default', query: '', setup: '' },
  { name: 'root', query: '', setup: `${CENTRE} R.controls.target.set(C.x, 120, C.y); R.camera.position.set(C.x + 320, 260, C.y + 380); R.camera.lookAt(R.controls.target); R.controls.update();` },
  { name: 'street', query: '', setup: look(-600, 30, 700, -520, 25, 560) },
  { name: 'high', query: '', setup: look(0, 5200, 2600, 0, 0, 0) },
  { name: 'card', query: '', setup: `${CENTRE} if (P) spike.select(P);`, steps: 15 },
  { name: 'ride', query: '', steps: 30,
    setup: `document.getElementById('close').click(); const ride = await import(new URL('engine/ride.js', location.href).href); if (ride.TOURS[0]) ride.startRide(ride.TOURS[0].stops[0]);` },
  { name: 'rideFar', query: '', setup: '', steps: 50 },
  { name: 'undercity', query: '?layer=undercity', setup: look(-400, 500, 900, -200, -20, 200), steps: 4 },
  { name: 'showcase', query: '?showcase=nihongai', setup: '' },
].filter(v => !opt.views || opt.views.split(',').includes(v.name));

// ---------- static server ----------

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
function serve(root) {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(readFileSync(file));
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}

// ---------- browser ----------

async function playwright() {
  const tries = ['playwright', join(GEN, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright'];
  try { tries.push(join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'playwright')); } catch {}
  for (const t of tries) {
    try {
      const mod = t === 'playwright' ? await import(t) : await import(pathToFileURL(createRequire(import.meta.url).resolve(t)));
      if (mod.chromium ?? mod.default?.chromium) return { chromium: mod.chromium ?? mod.default.chromium };
    } catch {}
  }
  throw new Error('Playwright not found. Run `npm install --no-save playwright` in spikes/map/gen, then `npx playwright install chromium`.');
}

// The page runs on a frozen clock. performance.now returns __t, which only the harness moves. requestAnimationFrame
// queues its callbacks, and __pump(n) runs the queue n times, one browser frame each, with 17 ms timestamps.

const INIT = () => {
  let s = 12345, u = 999;
  const next = k => { k = (k + 0x6D2B79F5) | 0; let t = Math.imul(k ^ (k >>> 15), 1 | k); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return [k, ((t ^ (t >>> 14)) >>> 0) / 4294967296]; };
  Math.random = () => { let v; if (new Error().stack.includes('three.module')) [u, v] = next(u); else [s, v] = next(s); return v; };
  window.__t = 1000;
  performance.now = () => window.__t;
  const real = window.requestAnimationFrame.bind(window), queue = new Map();
  let id = 0, ft = 0;
  window.requestAnimationFrame = cb => { queue.set(++id, cb); return id; };
  window.cancelAnimationFrame = k => queue.delete(k);
  window.__pump = n => new Promise(done => {
    const frame = () => {
      const due = [...queue.values()];
      queue.clear();
      ft += 17;
      for (const cb of due) try { cb(ft); } catch (e) { console.error(e); }
      if (--n > 0) real(frame); else real(() => done());
    };
    real(frame);
  });
  try { localStorage.setItem('na-map-quality', 'high'); localStorage.setItem('na-map-welcomed', '1'); } catch {}
};

async function capture(root, dir) {
  const { chromium } = await playwright();
  const three = join(GEN, 'node_modules/three/');
  if (!existsSync(three)) throw new Error('three.js not found. Run `npm install` in spikes/map/gen.');
  const { server, url } = await serve(root);
  const browser = await chromium.launch({ args: opt.gpu ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  mkdirSync(dir, { recursive: true });
  const result = { views: {}, runs: {} };
  try {
    for (const query of [...new Set(VIEWS.map(v => v.query))]) {
      const page = await browser.newPage({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 });
      page.setDefaultTimeout(0);
      const errors = [];
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text().replace(/\d+\.\d+\.\d+\.\d+:\d+/g, 'HOST')); });
      page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
      page.on('response', r => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${new URL(r.url()).pathname}`); });
      await page.route(/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\//, r => r.fulfill({ path: three + r.request().url().replace(/^.*three@[\d.]+\//, ''), contentType: 'text/javascript' }));
      await page.addInitScript(INIT);
      await page.goto(`${url}${MAP_PATH ? `${MAP_PATH}/` : ''}${PAGE === 'index.html' ? '' : PAGE}${query}`);
      await page.waitForFunction(() => window.spike && document.getElementById('loading')?.classList.contains('done') !== false, null, { polling: 250 });

      // The terrain heightmap and a first layer build finish after load. Network idle and a short wait cover both.

      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => !document.body.classList.contains('busy'), null, { polling: 250 });
      await page.waitForTimeout(2000);
      for (const v of VIEWS.filter(v => v.query === query)) {
        const r = await page.evaluate(async ({ setup, steps }) => {
          const R = await import(new URL('engine/render.js', location.href).href), spike = window.spike;
          await (new Function('R', 'spike', `return (async () => { ${setup} })()`))(R, spike);
          for (let i = 0; i < steps; i++) { window.__t += 100; await window.__pump(1); }
          await window.__pump(7);
          R.renderer.info.autoReset = false; R.renderer.info.reset();
          R.composer.render();
          const png = R.renderer.domElement.toDataURL('image/png'), calls = R.renderer.info.render.calls;
          R.renderer.info.autoReset = true;
          const labels = [...R.labels.domElement.querySelectorAll('div')]
            .filter(el => el.textContent && !el.classList.contains('faded') && !el.classList.contains('off') && el.obj?.visible !== false).map(el => el.textContent).sort();
          return { calls, labels, png };
        }, { setup: v.setup, steps: v.steps ?? 0 });
        writeFileSync(join(dir, `${v.name}.png`), Buffer.from(r.png.split(',')[1], 'base64'));
        result.views[v.name] = { calls: r.calls, labels: r.labels };
        console.log(`  ${v.name}: ${r.calls} draw calls`);
      }
      result.runs[query || 'main'] = {
        errors: [...new Set(errors)].sort(),
        ...await page.evaluate(async () => {
          const ride = await import(new URL('engine/ride.js', location.href).href);
          return { stats: document.getElementById('stats')?.textContent ?? '',
            tours: ride.TOURS.map(t => `${t.name} | ${t.music} | ${Math.round(t.len)} m | ${t.stops.map(s => s.name).join(', ')}`) };
        }),
      };
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  writeFileSync(join(dir, 'result.json'), JSON.stringify(result, null, 2));
  return result;
}

// ---------- compare ----------
// Pixels compare in the browser, so the check needs no image library. A differing pixel paints red in <view>.diff.png.

async function compare(a, b) {
  const ra = JSON.parse(readFileSync(join(a, 'result.json'))), rb = JSON.parse(readFileSync(join(b, 'result.json')));
  const { chromium } = await playwright();
  const browser = await chromium.launch(), page = await browser.newPage();
  const rows = [], same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  let fail = false;
  for (const name of Object.keys(ra.views).filter(k => rb.views[k])) {
    const img = d => `data:image/png;base64,${readFileSync(join(d, `${name}.png`)).toString('base64')}`;
    const { n, diff } = await page.evaluate(async ([x, y]) => {
      const load = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
      const [p, q] = await Promise.all([load(x), load(y)]), c = document.createElement('canvas');
      c.width = p.width; c.height = p.height;
      const g = c.getContext('2d'), read = i => { g.drawImage(i, 0, 0); return g.getImageData(0, 0, c.width, c.height); };
      const A = read(p).data, B = read(q).data, out = g.createImageData(c.width, c.height);
      let n = 0;
      for (let k = 0; k < A.length; k += 4) {
        const d = A[k] !== B[k] || A[k + 1] !== B[k + 1] || A[k + 2] !== B[k + 2];
        n += d;
        out.data.set(d ? [255, 0, 0, 255] : [A[k] / 3, A[k + 1] / 3, A[k + 2] / 3, 255], k);
      }
      g.putImageData(out, 0, 0);
      return { n, diff: c.toDataURL('image/png') };
    }, [img(a), img(b)]);
    writeFileSync(join(b, `${name}.diff.png`), Buffer.from(diff.split(',')[1], 'base64'));
    const va = ra.views[name], vb = rb.views[name], ok = va.calls === vb.calls && same(va.labels, vb.labels) && n <= TOLERANCE;
    fail ||= !ok;
    rows.push(`| ${name} | ${va.calls} | ${vb.calls} | ${n} | ${same(va.labels, vb.labels) ? 'same' : 'differ'} | ${ok ? 'ok' : 'DIFFERS'} |`);
  }
  await browser.close();
  console.log('\n| View | Draw calls (a) | Draw calls (b) | Pixels that differ | Labels | Result |\n|---|---|---|---|---|---|');
  console.log(rows.join('\n'));
  for (const run of Object.keys(ra.runs).filter(k => rb.runs[k])) for (const key of ['stats', 'tours', 'errors']) {
    const ok = same(ra.runs[run][key], rb.runs[run][key]);
    fail ||= !ok;
    console.log(`${run} ${key}: ${ok ? 'same' : `DIFFERS\n  a: ${JSON.stringify(ra.runs[run][key])}\n  b: ${JSON.stringify(rb.runs[run][key])}`}`);
  }
  console.log(fail ? '\nDifferences found.' : '\nNo differences.');
  console.log(`Captures and diff images: ${a} and ${b}`);
  return !fail;
}

// ---------- commands ----------

if (pos[0] === 'capture') {
  await capture(ROOT, resolve(pos[1] ?? join(OUT, 'work')));
} else if (pos[0] === 'compare') {
  process.exitCode = await compare(resolve(pos[1]), resolve(pos[2])) ? 0 : 1;
} else {
  const ref = pos[0] ?? 'main', tree = mkdtempSync(join(tmpdir(), 'map-ref-'));
  rmSync(OUT, { recursive: true, force: true });
  execFileSync('git', ['-C', ROOT, 'worktree', 'add', '--detach', '--quiet', tree, ref]);
  try {
    console.log(`Capturing ${ref}`);
    await capture(tree, join(OUT, 'ref'));
  } finally {
    execFileSync('git', ['-C', ROOT, 'worktree', 'remove', '--force', tree]);
  }
  console.log('Capturing the working tree');
  await capture(ROOT, join(OUT, 'work'));
  process.exitCode = await compare(join(OUT, 'ref'), join(OUT, 'work')) ? 0 : 1;
}
