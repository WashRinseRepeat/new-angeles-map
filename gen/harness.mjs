// Shared page harness for the map checks. It serves the map folder, routes three.js to gen/node_modules and runs the
// page on a frozen clock (see INIT). regress.mjs and the other checks import it.

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const GEN = fileURLToPath(new URL('./', import.meta.url)), MAP = resolve(GEN, '..');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
export function serve(root) {
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

export async function playwright() {
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

export const INIT = () => {
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

// Routes the CDN three.js requests to the local copy.

export async function routeThree(page) {
  const three = join(GEN, 'node_modules/three/');
  if (!existsSync(three)) throw new Error('three.js not found. Run `npm install` in spikes/map/gen.');
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\//, r => r.fulfill({ path: three + r.request().url().replace(/^.*three@[\d.]+\//, ''), contentType: 'text/javascript' }));
}

// MAP_GL picks the renderer: gpu (the machine's GPU, headless, the default and about 10x faster), headed
// (a visible window on the GPU) or swiftshader (CPU, for a machine without a GPU).

const GL = process.env.MAP_GL ?? 'gpu';
export const LAUNCH = GL === 'swiftshader'
  ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }
  : { headless: GL !== 'headed', args: ['--ignore-gpu-blocklist', '--enable-gpu'] };

// Opens the map folder on a frozen clock, waits for window.spike and pumps 60 frames. The caller closes browser and server.

export async function openMap(query = '', page = 'index.html') {
  const { chromium } = await playwright();
  const { server, url } = await serve(MAP);
  const browser = await chromium.launch(LAUNCH);
  const p = await browser.newPage({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 });
  p.setDefaultTimeout(0);
  const errors = [], warnings = [];
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); else if (m.type() === 'warning') warnings.push(m.text()); });
  p.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  await routeThree(p);
  await p.addInitScript(INIT);
  await p.goto(`${url}${page === 'index.html' ? '' : page}${query}`);
  await p.waitForFunction(() => window.spike, null, { polling: 250 });
  await p.waitForLoadState('networkidle');
  await p.waitForFunction(() => !document.body.classList.contains('busy'), null, { polling: 250 });
  await p.waitForTimeout(2000);
  await p.evaluate(() => window.__pump(60));
  return { page: p, browser, server, errors, warnings };
}
