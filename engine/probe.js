// Performance probe, opened with ?probe. It switches one part of the scene off at a time and measures each state.
// fps counts real renders. cpu is the main-thread time from the frame's start to the end of render submission.
// When fps stays low while cpu is small, the GPU is the limit.
//
// ?probe=live shows frame time, main-thread time and draw calls as you move, with a button per state, so any
// browser can test a view by hand.
//
// ?probe=gpu times the GPU itself at seven fixed views, with timer queries, at quality high. It holds the camera,
// so reload the page afterwards. Browsers without timer queries (Safari, Firefox) say so.

import { FOG_BASE, QUALITY, U, applyQuality, bloom, camera, composer, controls, labelRoot, labels, renderer, scene } from './render.js';
import { GLOWS, PROPS, SHAPES, TILES, glows, pools, signs } from './instances.js';
import { decor } from './grammar.js';
import { LANDMARKS } from './api.js';

let frameStart = 0, renders = 0, cpu = 0, onRender = null;
const raf = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = cb => raf(t => { frameStart = performance.now(); cb(t); });
const render = composer.render.bind(composer);
composer.render = (...a) => { render(...a); renders++; cpu += performance.now() - frameStart; onRender?.(); };

// Tiles redraw their visibility every frame, so a part is switched off by zeroing its instance counts.

const tilesOf = mats => TILES.filter(t => mats.has(t.mesh.material));
const zero = tiles => { const saved = tiles.map(t => [t.mesh, t.mesh.count]); for (const t of tiles) t.mesh.count = 0; return () => { for (const [m, n] of saved) m.count = n; }; };
const mats = list => new Set(list.map(m => m.material));

const dpr = renderer.getPixelRatio();
const css = (rule) => { const el = document.head.appendChild(document.createElement('style')); el.textContent = rule; return () => el.remove(); };
const level = name => () => { const was = QUALITY.level; applyQuality(name); return () => applyQuality(was); };

// Single states switch one part off. Strip states add up, from the whole scene down to an empty frame.

const STATES = [
  ['everything', () => () => {}],
  ['no bloom', () => { const b = bloom.enabled; bloom.enabled = false; return () => { bloom.enabled = b; }; }],
  ['half resolution', () => { renderer.setPixelRatio(dpr / 2); composer.setPixelRatio(dpr / 2); return () => { renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr); }; }],
  ['no labels', () => { labelRoot.visible = false; labels.domElement.style.display = 'none'; return () => { labelRoot.visible = true; labels.domElement.style.display = ''; }; }],
  ['no panel blur', () => css('* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }')],
  ['no glows', () => zero(tilesOf(mats([glows, ...Object.values(GLOWS), pools, signs])))],
  ['no props', () => zero(tilesOf(mats(Object.values(PROPS))))],
  ['no buildings', () => zero(tilesOf(mats(Object.values(SHAPES))))],
  ['no kit meshes', () => { decor.visible = false; return () => { decor.visible = true; }; }],
  ['no animation', () => { const saved = LANDMARKS.map(l => [l, l.update]); for (const l of LANDMARKS) l.update = null; return () => { for (const [l, u] of saved) l.update = u; }; }],
  ['quality low', level('low')],
  ['quality medium', level('medium')],
  ['quality high', level('high')],
];
const STRIP = [
  ['low, no UI', () => [level('low')(), css('.panel, #card, #hud, #fps { display: none !important; } * { backdrop-filter: none !important; }'), (() => { labelRoot.visible = false; labels.domElement.style.display = 'none'; return () => { labelRoot.visible = true; labels.domElement.style.display = ''; }; })()]],
  [' + no glows', () => [zero(tilesOf(mats([glows, ...Object.values(GLOWS), pools, signs])))]],
  [' + no props', () => [zero(tilesOf(mats(Object.values(PROPS))))]],
  [' + no buildings', () => [zero(tilesOf(mats(Object.values(SHAPES))))]],
  [' + no kit meshes', () => [(() => { decor.visible = false; return () => { decor.visible = true; }; })()]],
  [' + empty scene', () => [(() => { const kids = scene.children.filter(o => o.visible); for (const o of kids) o.visible = false; return () => { for (const o of kids) o.visible = true; }; })()]],
];

const box = Object.assign(document.body.appendChild(document.createElement('pre')), { id: 'probe' });
box.style.cssText = 'position:fixed;left:8px;top:60px;z-index:9999;margin:0;padding:10px 12px;background:rgba(5,8,14,.88);color:#cfe;font:12px/1.5 ui-monospace,monospace;border:1px solid #2a4a5a;border-radius:6px;pointer-events:none';
const rows = [];
let head = `${'state'.padEnd(16)} fps   cpu ms`;
const show = note => { box.textContent = `PERF PROBE  ${innerWidth}x${innerHeight} @${dpr}x\n${head}\n${rows.join('\n')}${note ? `\n${note}` : ''}`; };
const wait = ms => new Promise(r => setTimeout(r, ms));

async function measure(name) {
  show(`measuring ${name.trim()}…`);
  await wait(1200);
  renders = 0; cpu = 0;
  const t0 = performance.now();
  await wait(4000);
  const s = (performance.now() - t0) / 1000;
  rows.push(`${name.padEnd(17)} ${String(Math.round(renders / s)).padStart(3)}   ${(cpu / Math.max(renders, 1)).toFixed(1).padStart(5)}`);
  show();
}

export async function runProbe() {
  QUALITY.mode = 'probe';
  show('settling…');
  await wait(4000);
  for (const [name, off] of STATES) { const undo = off(); await measure(name); undo(); }
  rows.push('— cumulative —');
  const undo = [];
  for (const [name, off] of STRIP) { undo.push(...off()); await measure(name); }
  for (const u of undo.reverse()) u();
  QUALITY.mode = 'auto';
  show('done · screenshot this');
}

const VIEWS = {
  wide: [[-1450, 1350, 1330], [-220, 0, -10]], street: [[-300, 60, 200], [200, 40, -300]],
  root: [[200, 400, -500], [650, 300, -990]], guayaquil: [[400, 500, 3800], [900, 0, 3300]],
  low: [[-900, 220, 900], [600, 150, -600]], andes: [[600, 1300, 1500], [2600, 100, 1500]], coast: [[-1200, 500, 600], [-2500, 0, 500]],
};

// Each view sets the fog and tile culling the frame loop would, then takes the median of 14 timed renders.
// A message channel waits between polls, because background tabs throttle timers.

export async function runGpuBench() {
  const gl = renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext) return show('this browser has no GPU timer queries');
  renderer.setAnimationLoop(null);
  QUALITY.mode = 'probe'; applyQuality('high');
  head = `${'view'.padEnd(17)} gpu ms  draws`;
  const tick = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = r; c.port2.postMessage(0); });
  const time = async n => {
    const qs = [];
    for (let i = 0; i < n; i++) { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); composer.render(); gl.endQuery(ext.TIME_ELAPSED_EXT); qs.push(q); }
    const ms = [];
    for (const q of qs) {
      while (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) await tick();
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) ms.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
    }
    return ms.sort((a, b) => a - b)[ms.length >> 1];
  };
  show('settling…');
  await wait(3000);
  for (const [name, [c, t]] of Object.entries(VIEWS)) {
    camera.position.set(...c); controls.target.set(...t); controls.update(); camera.updateMatrixWorld();
    const away = Math.max(0, camera.position.distanceTo(controls.target) - 800);
    U.uFogNear.value = scene.fog.near = (FOG_BASE.near + away * .9) * QUALITY.fog;
    U.uFogFar.value = scene.fog.far = (FOG_BASE.far + away * 1.8) * QUALITY.fog;
    for (const tl of TILES) { const d = Math.hypot(camera.position.x - tl.x, camera.position.y, camera.position.z - tl.z); tl.mesh.visible = d < scene.fog.far + tl.half * 1.5 && (!tl.detail || d < QUALITY.detail + tl.half * 1.4); }
    renderer.info.autoReset = false; renderer.info.reset(); composer.render();
    const calls = renderer.info.render.calls;
    renderer.info.autoReset = true;
    rows.push(`${name.padEnd(17)} ${(await time(14)).toFixed(1).padStart(5)} ms  ${String(calls).padStart(4)} calls`);
    show();
  }
  show('done · reload to use the map');
}

// The live readout keeps the last two seconds of renders. Frame time is the gap between renders, so it includes
// waits on the GPU. When frame time is high while cpu stays low, the GPU or the browser's compositor is the limit.
// upload counts the bytes sent to buffers and textures each frame, and anim the time landmark animations take.

export function runLive() {
  const ring = [], undo = new Map(), gl = renderer.getContext();
  let last = 0, bytes = 0, anim = 0;
  const bd = gl.bufferData.bind(gl), bs = gl.bufferSubData.bind(gl);
  gl.bufferData = (...a) => { bytes += a[1]?.byteLength ?? a[1]; return bd(...a); };
  gl.bufferSubData = (...a) => { const d = a[2], e = d?.BYTES_PER_ELEMENT ?? 1; bytes += a[4] ? a[4] * e : (d?.byteLength ?? 0) - (a[3] ?? 0) * e; return bs(...a); };
  for (const f of ['texImage2D', 'texSubImage2D']) {
    const orig = gl[f].bind(gl);
    gl[f] = (...a) => { const d = a.find(x => x?.byteLength != null || x?.width); bytes += d?.byteLength ?? (d ? d.width * d.height * 4 : 0); return orig(...a); };
  }
  for (const l of LANDMARKS) {
    const orig = l.update;
    if (orig) l.update = (...a) => { const t0 = performance.now(); orig(...a); anim += performance.now() - t0; };
  }
  renderer.info.autoReset = false;
  onRender = () => {
    const t = performance.now();
    if (last) ring.push([t, t - last, t - frameStart, renderer.info.render.calls, bytes / 1024, anim]);
    last = t; bytes = 0; anim = 0;
    renderer.info.reset();
    while (ring.length && ring[0][0] < t - 2000) ring.shift();
  };
  box.style.pointerEvents = 'auto';
  const text = box.appendChild(document.createElement('div')), bar = box.appendChild(document.createElement('div'));
  bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;max-width:300px';
  for (const [name, off] of STATES.slice(1)) {
    const b = bar.appendChild(Object.assign(document.createElement('button'), { textContent: name }));
    b.style.cssText = 'font:11px ui-monospace,monospace;padding:4px 6px;background:#123;color:#cfe;border:1px solid #2a4a5a;border-radius:4px';
    b.onclick = () => {
      if (undo.has(name)) { undo.get(name)(); undo.delete(name); } else undo.set(name, off());
      b.style.background = undo.has(name) ? '#2a6a5a' : '#123';
    };
  }
  setInterval(() => {
    if (!ring.length) return;
    const gaps = ring.map(r => r[1]).sort((a, b) => a - b), pick = q => gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * q))];
    const mean = k => ring.reduce((a, r) => a + r[k], 0) / ring.length;
    text.textContent = `LIVE PROBE  ${innerWidth}x${innerHeight} @${renderer.getPixelRatio()}x  ${QUALITY.level}\n`
      + `fps        ${(1000 / mean(1)).toFixed(0)}\nframe ms   ${pick(.5).toFixed(1)} median · ${pick(.95).toFixed(1)} p95 · ${gaps.at(-1).toFixed(0)} worst\n`
      + `cpu ms     ${mean(2).toFixed(1)} · anim ${mean(5).toFixed(1)}\ndraw calls ${Math.round(mean(3))}\nupload     ${Math.round(mean(4))} KB/frame`;
  }, 250);
}
