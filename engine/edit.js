// GM edit mode: ?edit=1 on localhost. Move, size and rotate campaign places, move landmarks, and mark change requests.
// ui.js imports this module only in edit mode. It injects its own HTML and CSS and draws on an SVG overlay.
// Writes go to the dev server (gen/serve.mjs): POST /api/places and POST /api/requests.
// Without the server it offers Copy patch and Download.

import * as THREE from 'three';
import { H } from './state.js';
import { SETTING, atRoot } from './setting.js';
import { CITY, PLACES } from './core.js';
import { camera, composer, controls, renderer } from './render.js';
import { insidePoly } from './grammar.js';
import { ALL_BLOCK_FRAMES, SC } from './generator.js';
import { LANDMARK_SITES } from './api.js';
import { ray as pickRay, releaseView } from './ui.js';

const KEY = `${SETTING.storage}-map-edit`;
const DEG = 180 / Math.PI;
const { cx: MX, cy: MY, scale: MS } = SETTING.map;
const toMap = ([x, z]) => [+(x / MS + MX).toFixed(1), +(z / MS + MY).toFixed(1)];
const r1 = v => Math.round(v * 10) / 10;
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------- data ----------

// ORIG is the seat each place was built with. DATA is the edited copy that places.json receives.
// Landmarks join as `lm:<name>`. They only move: each takes the size and turn of the block it lands on.

const LMS = LANDMARK_SITES.filter(s => s.block).map(s => ({ slug: `lm:${s.key}`, title: s.name, lm: true, minSide: s.minSide,
  seat: { at: s.at, size: [s.block.w, s.block.d].map(Math.round), rot: null, snap: true, block: s.block } }));
const EDITABLE = [...PLACES.filter(p => p.seat), ...LMS];
const SAVED = await fetch(atRoot(SETTING.data.seats), { cache: 'no-store' }).then(r => r.json()).catch(() => ({}));
const ORIG = Object.fromEntries(EDITABLE.map(p => [p.slug, { at: p.seat.at.map(r1), size: p.seat.size, rot: p.seat.rot, snap: p.seat.snap }]));
let DATA = clone(ORIG);
const history = [];
const bySlug = Object.fromEntries(EDITABLE.map(p => [p.slug, p]));
const API = await fetch('/api/requests', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
let REQS = API ?? [];

// The block a place would snap to: the nearest large block within 260 m that is free or already its own.
// ponytail: ignores other edited places claiming blocks first; the reload after Apply seats them in order.

function snapBlock(p, [x, z]) {
  let best = SC.seatReach, out = null;
  for (const b of ALL_BLOCK_FRAMES) {
    if (b.seat || (b.used && b !== p.seat.block) || Math.min(b.w, b.d) < (p.minSide ?? SC.siteMin)) continue;
    const d = Math.hypot(b.cx - x, b.cz - z);
    if (d < best) { best = d; out = b; }
  }
  return out;
}

// Where the engine would seat a place from its edited data.

function seatOf(slug) {
  const q = DATA[slug], b = q.snap ? snapBlock(bySlug[slug], q.at) : null, lm = bySlug[slug].lm && b;
  return { x: b?.cx ?? q.at[0], z: b?.cz ?? q.at[1], a: q.rot ?? b?.a ?? 0, w: lm ? b.w : q.size[0], d: lm ? b.d : q.size[1], block: b };
}
const changed = slug => JSON.stringify(DATA[slug]) !== JSON.stringify(ORIG[slug]);
const local = (s, x, z) => [s.x + x * Math.cos(s.a) + z * Math.sin(s.a), s.z - x * Math.sin(s.a) + z * Math.cos(s.a)];
const corners = s => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => local(s, i * s.w / 2, j * s.d / 2));

// ---------- page ----------

document.head.insertAdjacentHTML('beforeend', `<style>
  body.editing #hud, body.editing #card { display: none !important; }
  body.editing .place { pointer-events: none !important; }
  #eside [hidden] { display: none !important; }
  #eov { position: fixed; inset: 0; z-index: 4; pointer-events: none; width: 100%; height: 100%; }
  #eov .fp { fill: rgba(127, 243, 255, .06); stroke: #7ff3ff; stroke-width: 1.5; stroke-dasharray: 5 4; pointer-events: all; cursor: grab; }
  #eov .fp.lm { stroke: #d59cff; fill: rgba(213, 156, 255, .05); }
  #eov .fp.chg { stroke: #ffd9a0; }
  #eov .fp.sel { fill: rgba(127, 243, 255, .16); stroke-dasharray: none; }
  #eov .ghost { fill: none; stroke: #8fa; stroke-width: 1.2; stroke-dasharray: 2 3; opacity: .8; }
  #eov .at { fill: #ffd9a0; }
  #eov .h { fill: #07131c; stroke: #7ff3ff; stroke-width: 2; pointer-events: all; cursor: nwse-resize; }
  #eov .rot { fill: #ffd9a0; stroke: #1a0f00; pointer-events: all; cursor: grab; }
  #eov .rl { stroke: #ffd9a0; stroke-width: 1; }
  #eov .req polygon { fill: rgba(255, 170, 60, .12); stroke: #ffb35f; stroke-width: 2; stroke-dasharray: 8 5; }
  #eov .req.done polygon { stroke: #7d93a3; fill: none; }
  #eov .req circle { fill: #ffb35f; }
  #eov .req text { fill: #1a0f00; font: 700 12px system-ui; text-anchor: middle; dominant-baseline: central; }
  #eov .draft polyline { fill: rgba(255, 170, 60, .1); stroke: #ffd9a0; stroke-width: 2; }
  #eov .draft circle { fill: #ffd9a0; }
  body.req-tool canvas { cursor: crosshair; }
  body.req-tool #eov * { pointer-events: none !important; }
  #ebar { left: 50%; bottom: 16px; transform: translateX(-50%); padding: 6px; display: flex; gap: 4px; align-items: center; z-index: 8; }
  #ebar .badge { color: #1a0f00; background: #ffd9a0; border-radius: 4px; padding: 2px 6px; font-size: 11px; font-weight: 700; letter-spacing: .1em; margin-right: 4px; }
  #eside { right: 12px; top: 12px; width: 320px; max-height: calc(100vh - 90px); padding: 12px; display: flex; flex-direction: column; gap: 10px; overflow: auto; font-size: 13px; z-index: 8; }
  #eside h1 { margin: 0; font-size: 14px; letter-spacing: .12em; text-transform: uppercase; color: #7ff3ff; }
  #eside .mute { color: #7d93a3; font-size: 12px; }
  #eside .sec { border-top: 1px solid #1d3546; padding-top: 8px; }
  #eside .kv { display: grid; grid-template-columns: 70px 1fr; gap: 4px 8px; font-size: 12px; margin-top: 6px; align-items: center; }
  #eside .kv > span:nth-child(odd) { color: #7d93a3; }
  #eside input[type=number] { width: 60px; background: #08101a; color: #d8e6ef; border: 1px solid #23435a; border-radius: 4px; padding: 2px 4px; font: inherit; }
  #eside textarea { width: 100%; box-sizing: border-box; background: #08101a; color: #d8e6ef; border: 1px solid #23435a; border-radius: 6px; padding: 6px; font: 13px system-ui; resize: vertical; }
  #eside .chg { font-size: 12px; padding: 4px 0; display: flex; justify-content: space-between; gap: 6px; border-bottom: 1px solid #12222e; cursor: pointer; }
  #eside .chg code { color: #ffd9a0; }
  #eside .row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  #etoast { left: 50%; top: 60px; transform: translateX(-50%); padding: 6px 14px; border-radius: 20px; color: #7ff3ff; font-size: 13px; z-index: 9; display: none; }
</style>`);

document.body.insertAdjacentHTML('beforeend', `
<svg id="eov"><g id="ereqs"></g><g id="efps"></g><g id="edraft" class="draft"></g></svg>
<div id="ebar" class="panel">
  <span class="badge">EDIT</span>
  <button data-tool="move" class="on">✥ Move / size</button>
  <button data-tool="req">✎ Change request</button>
  <button id="etop">Top-down</button>
  <button id="eapply" title="Save places.json and rebuild the city">Apply · rebuild</button>
</div>
<div id="etoast" class="panel"></div>
<div id="eside" class="panel">
  <h1>GM edit mode</h1>
  <div class="mute">${API ? 'Dev server found. Saves write <code>spikes/map/places.json</code> and <code>spikes/map/requests/</code>.'
    : 'No dev server: changes stay in this tab. Use Copy patch or Download. Run <code>node spikes/map/gen/serve.mjs</code> to save.'}</div>
  <div class="sec">
    <div class="kicker">Selected</div>
    <div id="esel" class="mute" style="margin-top:4px">Click a footprint. Drag it to move, a corner to resize, the amber knob to rotate.</div>
    <div class="kv" id="ekv" hidden>
      <span>world m</span><span id="kWorld"></span>
      <span>map px</span><span id="kMap"></span>
      <span>size m</span><span><input id="kW" type="number" min="8" max="600"> × <input id="kD" type="number" min="8" max="600"></span>
      <span>rotate °</span><span><input id="kR" type="number" step="1" placeholder="block"> <button id="kRnull" title="Take the block's rotation">block</button></span>
      <span>snap</span><span><label><input id="kSnap" type="checkbox"> to the nearest free block</label></span>
    </div>
  </div>
  <div class="sec">
    <div class="kicker">Changes</div>
    <div id="echgs" class="mute">None yet.</div>
    <div class="row">
      <button id="esave" class="on" ${API ? '' : 'disabled'}>Save to repo</button><button id="ecopy">Copy patch</button><button id="edl">Download</button><button id="eundo">Undo</button>
    </div>
  </div>
  <div class="sec" id="ereqForm" hidden>
    <div class="kicker">New change request</div>
    <div class="mute" id="ereqCtx" style="margin:4px 0"></div>
    <textarea id="ereqText" rows="3" placeholder="What should change here?"></textarea>
    <div class="row"><button id="ereqSave" class="on">${API ? 'Save request' : 'Download request'}</button><button id="ereqCancel">Cancel</button></div>
  </div>
  <div class="sec">
    <div class="kicker">Change requests</div>
    <div id="ereqList" class="mute">${API ? 'None open.' : 'The list needs the dev server.'}</div>
    <label class="mute" style="display:flex;gap:6px;margin-top:6px"><input id="eshowDone" type="checkbox"> Show done</label>
  </div>
</div>`);
document.body.classList.add('editing');

// Clicks in edit mode edit; they do not open the place card. Layer 31 holds nothing, so the card's raycast misses.

pickRay.layers.set(31);

const $ = id => document.getElementById(id);
const svg = $('eov');
const toast = msg => { const t = $('etoast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => { t.style.display = 'none'; }, 2600); };

// ---------- camera and picking ----------

const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ray = new THREE.Raycaster(), _v = new THREE.Vector3();
function groundAt(e) {
  ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1), camera);
  return ray.ray.intersectPlane(ground, _v) ? [_v.x, _v.z] : null;
}
const screen = ([x, z]) => {
  _v.set(x, 0, z).project(camera);
  return _v.z < 1 ? [(_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight] : null;
};

let top = null;
function topDown(on) {
  releaseView();
  if (on && !top) {
    top = { pos: camera.position.clone(), target: controls.target.clone() };
    const t = controls.target.setY(0), h = THREE.MathUtils.clamp(camera.position.distanceTo(t), 300, 1400);
    camera.position.set(t.x, h, t.z + .01);
  } else if (!on && top) {
    camera.position.copy(top.pos); controls.target.copy(top.target); top = null;
  }
  $('etop').classList.toggle('on', !!top);
}
$('etop').onclick = () => topDown(!top);

// ---------- state ----------

let sel = null, tool = 'move', drag = null, draft = [];
const push = () => { history.push(clone(DATA)); if (history.length > 100) history.shift(); };
function select(slug) {
  sel = slug;
  $('ekv').hidden = !slug;
  $('esel').textContent = slug ? bySlug[slug].title + (bySlug[slug].lm ? ' · landmark: drag it onto another block' : '') : 'Click a footprint. Drag it to move, a corner to resize, the amber knob to rotate.';
  panel();
}
function panel() {
  if (sel) {
    const q = DATA[sel], s = seatOf(sel);
    $('kWorld').textContent = `${r1(s.x)}, ${r1(s.z)}`;
    $('kMap').textContent = toMap([s.x, s.z]).join(', ');
    if (document.activeElement !== $('kW')) $('kW').value = q.size[0];
    if (document.activeElement !== $('kD')) $('kD').value = q.size[1];
    if (document.activeElement !== $('kR')) $('kR').value = q.rot === null ? '' : Math.round(q.rot * DEG);
    $('kSnap').checked = q.snap;
    for (const id of ['kW', 'kD', 'kR', 'kRnull', 'kSnap']) $(id).disabled = !!bySlug[sel].lm;
  }
  const rows = EDITABLE.filter(p => changed(p.slug)).map(p => {
    const a = ORIG[p.slug], b = DATA[p.slug], d = [];
    if (`${a.at}` !== `${b.at}`) d.push(`at <code>${b.at.map(Math.round).join(', ')}</code>`);
    if (`${a.size}` !== `${b.size}`) d.push(`size <code>${b.size.join(' × ')}</code>`);
    if (a.rot !== b.rot) d.push(`rot <code>${b.rot === null ? 'block' : Math.round(b.rot * DEG) + '°'}</code>`);
    if (a.snap !== b.snap) d.push(`snap <code>${b.snap ? 'on' : 'off'}</code>`);
    return `<div class="chg" data-s="${p.slug}"><span><b>${esc(p.title)}</b><br>${d.join(' · ')}</span><button data-revert="${p.slug}">↺</button></div>`;
  });
  $('echgs').innerHTML = rows.join('') || 'None yet.';
}
$('echgs').onclick = e => {
  const r = e.target.closest('[data-revert]'), row = e.target.closest('[data-s]');
  if (r) { push(); DATA[r.dataset.revert] = clone(ORIG[r.dataset.revert]); panel(); }
  else if (row) select(row.dataset.s);
};
const edit = f => { if (!sel) return; push(); f(DATA[sel]); panel(); };
$('kW').onchange = () => edit(q => { q.size[0] = THREE.MathUtils.clamp(Math.round(+$('kW').value), 8, 600); });
$('kD').onchange = () => edit(q => { q.size[1] = THREE.MathUtils.clamp(Math.round(+$('kD').value), 8, 600); });
$('kR').onchange = () => edit(q => { q.rot = $('kR').value === '' ? null : +(+$('kR').value / DEG).toFixed(4); });
$('kRnull').onclick = () => edit(q => { q.rot = null; });
$('kSnap').onchange = () => edit(q => {

  // Turning snap off keeps the place where it stands now.

  if (!$('kSnap').checked) { const s = seatOf(sel); q.at = [r1(s.x), r1(s.z)]; q.rot = +s.a.toFixed(4); }
  q.snap = $('kSnap').checked;
});
$('eundo').onclick = () => { if (history.length) { DATA = history.pop(); panel(); } };

// ---------- drawing ----------

const pts = list => list.map(screen).filter(Boolean).map(p => p.map(Math.round).join(',')).join(' ');
function draw() {
  let fp = '';
  for (const p of EDITABLE) {
    const s = seatOf(p.slug), on = p.slug === sel;
    fp += `<polygon class="fp${p.lm ? ' lm' : ''}${on ? ' sel' : ''}${changed(p.slug) ? ' chg' : ''}" data-s="${p.slug}" data-h="move" points="${pts(corners(s))}"/>`;
    if (!on) continue;
    if (s.block) fp += `<polygon class="ghost" points="${pts(corners({ x: s.block.cx, z: s.block.cz, a: s.block.a, w: s.block.w, d: s.block.d }))}"/>`;
    const at = screen(DATA[p.slug].at);
    if (at) fp += `<circle class="at" cx="${at[0]}" cy="${at[1]}" r="3"/>`;
    if (p.lm) continue;
    corners(s).forEach((c, i) => { const q = screen(c); if (q) fp += `<rect class="h" data-h="size" x="${q[0] - 5}" y="${q[1] - 5}" width="10" height="10"/>`; });
    const k0 = screen(local(s, 0, s.d / 2)), k = screen(local(s, 0, s.d / 2 + Math.max(14, s.d * .25)));
    if (k0 && k) fp += `<line class="rl" x1="${k0[0]}" y1="${k0[1]}" x2="${k[0]}" y2="${k[1]}"/><circle class="rot" data-h="rot" cx="${k[0]}" cy="${k[1]}" r="7"/>`;
  }
  $('efps').innerHTML = fp;
  const show = $('eshowDone').checked;
  $('ereqs').innerHTML = REQS.map((r, i) => {
    if (r.status !== 'open' && !show) return '';
    const c = screen(r.poly_world.reduce((a, q) => [a[0] + q[0] / r.poly_world.length, a[1] + q[1] / r.poly_world.length], [0, 0]));
    return `<g class="req ${r.status}"><polygon points="${pts(r.poly_world)}"/>${c ? `<circle cx="${c[0]}" cy="${c[1]}" r="11"/><text x="${c[0]}" y="${c[1]}">${i + 1}</text>` : ''}</g>`;
  }).join('');
  $('edraft').innerHTML = draft.length ? `<polyline points="${pts(draft)}${draftClosed ? ' ' + pts([draft[0]]) : ''}"/>${draft.map(screen).filter(Boolean).map(q => `<circle cx="${q[0]}" cy="${q[1]}" r="4"/>`).join('')}` : '';
  requestAnimationFrame(draw);
}

// ---------- dragging: move, size, rotate ----------

svg.addEventListener('pointerdown', e => {
  const h = e.target.dataset.h;
  if (!h || tool !== 'move') return;
  const slug = e.target.dataset.s ?? sel, g = groundAt(e);
  if (!g) return;
  if (slug !== sel) select(slug);
  push();
  const q = DATA[sel], s = seatOf(sel);
  drag = { h, off: [q.at[0] - g[0], q.at[1] - g[1]], s };
  controls.enabled = false;
  e.preventDefault();
});
addEventListener('pointermove', e => {
  if (!drag) return;
  const g = groundAt(e);
  if (!g) return;
  const q = DATA[sel], s = drag.s;
  if (drag.h === 'move') q.at = [r1(g[0] + drag.off[0]), r1(g[1] + drag.off[1])];

  // Corners resize about the centre; the knob sets rot so the place front faces it. Shift snaps to 15°.

  if (drag.h === 'size') {
    const dx = g[0] - s.x, dz = g[1] - s.z, c = Math.cos(s.a), n = Math.sin(s.a);
    q.size = [Math.abs(dx * c - dz * n) * 2, Math.abs(dx * n + dz * c) * 2].map(v => THREE.MathUtils.clamp(Math.round(v), 8, 600));
  }
  if (drag.h === 'rot') {
    let a = Math.atan2(g[0] - s.x, g[1] - s.z);
    const step = e.shiftKey ? Math.PI / 12 : Math.PI / 180;
    q.rot = +(Math.round(a / step) * step).toFixed(4);
  }
  panel();
});
addEventListener('pointerup', () => {
  if (!drag) return;
  if (JSON.stringify(history.at(-1)) === JSON.stringify(DATA)) history.pop();
  drag = null; controls.enabled = true; panel();
});

// ---------- save, copy, download ----------

// A landmark entry holds only its world point, and only moved landmarks are written.

const entry = k => k.startsWith('lm:') ? { at: DATA[k].at } : DATA[k];
const patch = () => JSON.stringify(Object.fromEntries(EDITABLE.filter(p => changed(p.slug)).map(p => [p.slug, entry(p.slug)])), null, 2);
const full = () => Object.fromEntries(Object.keys(DATA).filter(k => !k.startsWith('lm:') || changed(k) || SAVED[k]).map(k => [k, entry(k)]));
const download = (name, href) => { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); };
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; });
const remember = () => sessionStorage.setItem(KEY, JSON.stringify({ pos: camera.position.toArray(), target: controls.target.toArray(), top, sel, tool }));

$('ecopy').onclick = () => navigator.clipboard.writeText(patch()).then(() => toast('Patch copied: the changed places.json entries'));
$('edl').onclick = () => download('places.json', URL.createObjectURL(new Blob([JSON.stringify(full(), null, 2) + '\n'], { type: 'application/json' })));
async function save() {
  if (!API) return toast('No dev server: use Copy patch or Download');
  try { await post('/api/places', full()); toast('Saved spikes/map/places.json'); return true; } catch (e) { toast(`Save failed: ${e.message}`); }
}
$('esave').onclick = save;

// Apply saves, then reloads, because places build into shared instanced meshes and cannot be rebuilt one by one.

$('eapply').onclick = async () => {
  if (!API) return toast('Apply needs the dev server. Use Copy patch or Download.');
  if (await save()) { remember(); location.reload(); }
};

// ---------- change requests ----------

let draftClosed = false;
for (const b of document.querySelectorAll('#ebar [data-tool]')) b.onclick = () => setTool(b.dataset.tool);
function setTool(t) {
  tool = t; draft = []; draftClosed = false; $('ereqForm').hidden = true;
  for (const b of document.querySelectorAll('#ebar [data-tool]')) b.classList.toggle('on', b.dataset.tool === t);
  document.body.classList.toggle('req-tool', t === 'req');
  if (t === 'req') toast('Click 3 or more points on the ground. Click the first point or press Enter to close.');
}

// A click (not a drag) on the canvas adds a point; clicking near the first point closes the polygon.

let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (tool !== 'req' || draftClosed || !downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  const g = groundAt(e), first = draft[0] && screen(draft[0]);
  if (!g) return;
  if (draft.length >= 3 && first && Math.hypot(first[0] - e.clientX, first[1] - e.clientY) < 12) return closeDraft();
  draft.push([r1(g[0]), r1(g[1])]);
});
addEventListener('keydown', e => {
  if (tool !== 'req' || /^(TEXTAREA|INPUT)$/.test(e.target.tagName)) return;
  if (e.key === 'Enter' && draft.length >= 3) closeDraft();
  if (e.key === 'Escape') setTool('req');
  if (e.key === 'Backspace' && !draftClosed) draft.pop();
});

// District, sub-area and the nearest places and landmarks tell a later session which files to open.

function context(poly) {
  const [cx, cz] = poly.reduce((a, q) => [a[0] + q[0] / poly.length, a[1] + q[1] / poly.length], [0, 0]);
  const r = Math.max(250, ...poly.map(([x, z]) => Math.hypot(x - cx, z - cz))) + 150;
  const near = [...EDITABLE.map(p => ({ id: p.slug, x: p.x, z: p.z })), ...LANDMARK_SITES.map(l => ({ id: l.place?.slug ?? l.name, x: l.x, z: l.z }))]
    .map(o => ({ ...o, d: Math.hypot(o.x - cx, o.z - cz) })).filter(o => o.d < r).sort((a, b) => a.d - b.d).slice(0, 8).map(o => o.id);
  return { district: CITY.districts.find(d => insidePoly(cx, cz, d.poly))?.id ?? null, subarea: H.subareaAt(cx, cz, 1.5), near, cx, cz };
}
function closeDraft() {
  draftClosed = true;
  const c = context(draft);
  $('ereqCtx').textContent = [c.district, c.subarea, c.near.length && `near ${c.near.slice(0, 4).join(', ')}`].filter(Boolean).join(' · ');
  $('ereqForm').hidden = false;
  $('ereqText').focus();
}
$('ereqCancel').onclick = () => setTool('req');

// The screenshot is the canvas right after a render, with the polygon drawn on top.

function screenshot(poly) {
  composer.render();
  const c = document.createElement('canvas'), g = c.getContext('2d');
  c.width = renderer.domElement.width; c.height = renderer.domElement.height;
  g.drawImage(renderer.domElement, 0, 0);
  const k = c.width / innerWidth;
  g.beginPath();
  poly.map(screen).filter(Boolean).forEach(([x, y], i) => i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k));
  g.closePath();
  g.fillStyle = 'rgba(255, 170, 60, .15)'; g.fill();
  g.setLineDash([8 * k, 5 * k]); g.lineWidth = 2 * k; g.strokeStyle = '#ffb35f'; g.stroke();
  return c.toDataURL('image/png');
}
$('ereqSave').onclick = async () => {
  const text = $('ereqText').value.trim();
  if (!text) return toast('Type the request first');
  const c = context(draft), now = new Date(), off = -now.getTimezoneOffset();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const stamp = new Date(now - now.getTimezoneOffset() * 6e4).toISOString().slice(0, 19)
    + `${off < 0 ? '-' : '+'}${String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')}:${String(Math.abs(off) % 60).padStart(2, '0')}`;
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').split('-').filter(Boolean).slice(0, 5).join('-') || 'request';
  const request = {
    id: `${day}-${slug}`, status: 'open', created: stamp, text,
    district: c.district, subarea: c.subarea, near: c.near,
    poly_world: draft, poly_map: draft.map(toMap),
    camera: { pos: camera.position.toArray().map(r1), target: controls.target.toArray().map(r1) },
    screenshot: null, resolved: null,
  };
  const png = screenshot(draft);
  if (!API) {
    request.screenshot = `${request.id}.png`;
    download(`${request.id}.json`, URL.createObjectURL(new Blob([JSON.stringify(request, null, 2) + '\n'], { type: 'application/json' })));
    download(`${request.id}.png`, png);
    toast('Downloaded. Put both files in spikes/map/requests/.');
  } else {
    try {
      const r = await post('/api/requests', { request, png });
      request.id = r.id; request.screenshot = `${r.id}.png`;
      REQS.push(request);
      listRequests();
      toast(`Saved ${r.file}`);
    } catch (e) { return toast(`Save failed: ${e.message}`); }
  }
  $('ereqText').value = '';
  setTool('move');
};

function listRequests() {
  if (!API) return;
  const show = $('eshowDone').checked;
  const rows = REQS.map((r, i) => (r.status === 'open' || show) ? `<div class="chg" data-r="${i}"><span><b style="color:#ffb35f">#${i + 1}</b> ${esc(r.text)}</span><span class="mute">${esc(r.status)}</span></div>` : '').join('');
  $('ereqList').innerHTML = rows || 'None open.';
}
$('eshowDone').onchange = listRequests;
$('ereqList').onclick = e => {
  const r = REQS[e.target.closest('[data-r]')?.dataset.r];
  if (r) { camera.position.fromArray(r.camera.pos); controls.target.fromArray(r.camera.target); top = null; $('etop').classList.remove('on'); }
};

// ---------- start: restore the view after Apply, else go top-down ----------

let back = null;
try { back = JSON.parse(sessionStorage.getItem(KEY)); sessionStorage.removeItem(KEY); } catch {}
if (back) {
  camera.position.fromArray(back.pos); controls.target.fromArray(back.target);
  top = back.top && { pos: new THREE.Vector3().fromArray([back.top.pos.x, back.top.pos.y, back.top.pos.z]), target: new THREE.Vector3(back.top.target.x, back.top.target.y, back.top.target.z) };
  $('etop').classList.toggle('on', !!top);
  if (back.sel && DATA[back.sel]) select(back.sel);
  toast('Rebuilt from places.json');
} else {

  // First entry looks straight down from the pack's edit view.

  controls.target.set(...SETTING.camera.edit.target);
  camera.position.set(...SETTING.camera.edit.position);
  topDown(true);
}
listRequests();
panel();
draw();
window.spike.edit = { DATA: () => DATA, seatOf, select, setTool, save, screen };
