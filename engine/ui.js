// Layers, labels, pins, the place card, the tuning panel and the frame loop. Entry point.

import * as THREE from 'three';
import { updateFireworks } from './fireworks.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { S, H } from './state.js';
import { CENTRE, CENTRE_PLACE, CENTRE_R, CITY, CORES, DENSITY, PLACES, SITE, STANDALONE, STYLES, centroidOf, density, lerp, styleAt } from './core.js';
import { SETTING, inPack } from './setting.js';
import { FOG, FOG_BASE, LOCK, OPT, PICK, QUALITY, QUALITY_LEVELS, SHADOWS, SURFACE, U, aoPass, applyQuality, bloom, camera, composer, controls, fadeTwin, flatGeo, hemi, label, labelRoot, labels, lockCamera, moon, renderer, scene } from './render.js';
import { SHAPES, TILE, TILES, glows, pools, put, signs, yawAt } from './instances.js';
import { ARCHETYPES, ARCH_BASE, ARCH_WEIGHTS, MERGED_MAT, TALLY, decor, insidePoly, merged } from './grammar.js';
import { rideFocus, rideTick, riding } from './ride.js';
import { RIDE_AUDIO } from './ridesound.js';
import { TRAFFIC, centre, hwCars, hwTraffic, moveCars, nearHighway, track, uploadUsed } from './transport.js';
import { BLOCK_MAX, CITYTUNE, FRAMES, QUERY, SC, SITES, frontOf, generate } from './generator.js';
import { LANDMARKS, LANDMARK_LABELS } from './api.js';
import { initNav } from './nav.js';
import { DAY, tick } from './daylight.js';
import { movePeople } from './people.js';
import { moveBoats } from './boats.js';
import './groundmap.js';
import { RELIEF, groundAt } from './relief.js';

// ---------- layers: a horizontal slice through the city ----------

// The all layer clips above the tallest tower. A pack layer, such as New Angeles' undercity, lives in its own module.
// It exports group, labels and build(), loads on first use and builds once.

const PACK_LAYERS = SETTING.layers ?? {}, LAYER_MODS = {}, SKY = scene.background;
export const LAYERS = { all: SETTING.scale.layerTop,
  ...Object.fromEntries(Object.entries(PACK_LAYERS).map(([k, l]) => [k, l.clip])) };
export const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5);
export let layer = 'all', clipTop = LAYERS.all, cutOpen = false;
export function setLayer(name) {

  // The first switch to a pack layer waits one frame, so the button shows its busy state while the build runs.

  const L = PACK_LAYERS[name];
  if (L && !LAYER_MODS[name]?.group.children.length) {
    document.body.classList.add('busy');
    return setTimeout(async () => {
      const mod = LAYER_MODS[name] ??= await import(inPack(L.module));
      mod.build();
      document.body.classList.remove('busy');
      setLayer(name);
    }, 50);
  }
  layer = name;
  for (const m of SURFACE) m.visible = !L;

  // Several layers may share one module, each with its own clip, such as the levels of a dungeon.

  for (const mod of new Set(Object.values(LAYER_MODS))) {
    mod.group.visible = mod === LAYER_MODS[name];
    for (const el of mod.labels) el.obj.visible = mod === LAYER_MODS[name];
  }
  U.uMistBase.value = L?.mistBase ?? 0;
  scene.background = L?.background != null ? new THREE.Color(L.background) : SKY;
  document.body.classList.toggle('underground', !!L?.underground);
  for (const b of document.querySelectorAll('[data-layer]')) b.classList.toggle('on', b.dataset.layer === name);
}
for (const b of document.querySelectorAll('[data-layer]')) b.onclick = () => setLayer(b.dataset.layer);
if (LAYERS[QUERY.get('layer')] !== undefined) { setLayer(QUERY.get('layer')); clipTop = LAYERS[QUERY.get('layer')]; }

// ---------- labels, pins, card ----------


export const QUARTER_LABELS = [];
const LABEL = SETTING.scale.labels;
for (const q of CITY.quarters ?? []) {
  const c = centroidOf(q.poly);
  QUARTER_LABELS.push(label(q.name, 'district quarter', new THREE.Vector3(c[0], LABEL.quarterY, c[1])));
}
export const DISTRICT_LABELS = new Map();
for (const d of CITY.districts) {
  const c = d.poly.reduce((a, [x, z]) => [a[0] + x / d.poly.length, a[1] + z / d.poly.length], [0, 0]);
  DISTRICT_LABELS.set(d.id, label(d.name.replace(/\s+District$/i, ''), 'district', new THREE.Vector3(c[0], LABEL.districtY, c[1])));
}

// A pin holds a campaign place and its label. It draws nothing; the label marks the place.

export const pins = [];
for (const p of [...PLACES, CENTRE_PLACE].filter(p => p?.top)) {
  const pin = new THREE.Object3D();
  pin.userData = { place: p, base: p.top.y + (p === CENTRE_PLACE ? SETTING.centre.pinLift : LABEL.pinLift) };
  pin.position.copy(p.top);
  pins.push(pin);
  const el = label(p.title, 'place', new THREE.Vector3(p.top.x, pin.userData.base + 6, p.top.z), p.color);
  el.place = p;
  pin.userData.label = el;
}

export const card = document.getElementById('card');
let shownPlace = null;

// Minimizing keeps only the title, so the map stays clear on a phone. A new selection opens the card in full.

const cMin = document.getElementById('cMin');
cMin.onclick = () => { cMin.textContent = card.classList.toggle('min') ? '+' : '–'; cMin.ariaLabel = card.classList.contains('min') ? 'Expand card' : 'Minimize card'; };
document.getElementById('close').onclick = () => {
  card.style.display = 'none';
  shownPlace = null;
  rideFocus(null);
  if (home) { flyCam(home.t, home.c); home = null; }
};

// A tour that takes the camera closes the card quietly, without the flight back.

export function hideCard() {
  card.style.display = 'none';
  shownPlace = home = null;
}
// The spike runs from the repo root locally and as /map/ next to the built site.

export const LOCAL = location.pathname.includes('/spikes/');
if (STANDALONE) document.getElementById('back').hidden = true;
else if (LOCAL) document.getElementById('back').href = 'http://localhost:1313/';

// A selected place fills the view from its street side. Closing the card flies back to the view before.

let home = null;

// True when a building stands on the line from the camera spot to within r of the target.

const sight = new THREE.Raycaster(), seen = new THREE.Vector3();
function blocked(at, dir, dist, r) {
  sight.set(seen.copy(at).addScaledVector(dir, dist), dir.clone().negate());
  sight.far = dist - r;
  const walls = new Set(Object.values(SHAPES).map(s => s.material));
  const solid = TILES.filter(t => !t.detail && walls.has(t.mesh.material)).map(t => t.mesh);
  if (merged) solid.push(merged);
  return sight.intersectObjects(solid, false).length > 0;
}
// The card camera aims at the middle of the place, so the orbit turns about it. face, a world direction from the
// place toward the camera, overrides the place's own front.

export function viewPlace(p, dur, face) {
  const h = p.top.y, f = p.frame;
  if (!f) return flyTo(new THREE.Vector3(p.top.x, h * .5, p.top.z), THREE.MathUtils.clamp(h * 2.6, 150, 1600), null, dur);
  const half = Math.min(camera.fov, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(camera.fov * Math.PI / 360) * (camera.aspect || 1)))) * Math.PI / 360;
  const cap = f.face ? 400 : 120, r = Math.max(Math.hypot(Math.min(f.w, cap), Math.min(f.d, cap)) / 2, h * .6);
  const { x, z } = f.face ? { x: f.face[0], z: f.face[1] } : PLACES.includes(p) ? { x: 0, z: 1 } : frontOf(f), dir = new THREE.Vector3(x * f.c + z * f.s, .75, -x * f.s + z * f.c).normalize();
  const dist = THREE.MathUtils.clamp(r / Math.sin(half) * 1.1, 60, 1600), at = new THREE.Vector3(f.cx, h * .5, f.cz);

  // A tower between the camera and the place tilts the view steeper, up to almost top-down.

  if (face) dir.copy(face).normalize();
  const flat = new THREE.Vector2(dir.x, dir.z).normalize();
  for (const up of face ? [] : [.75, 1.5, 3, 8]) {
    dir.set(flat.x, up, flat.y).normalize();
    if (!blocked(at, dir, dist, r)) break;
  }

  flyTo(at, dist, dir, dur);
}
export function select(p) {
  if (card.style.display !== 'block' && !riding()) home = { t: controls.target.clone(), c: camera.position.clone() };

  // Campaign places carry a slug, an image and a page. District and landmark cards may have neither,
  // can hold several paragraphs, and bring their own camera move.

  const img = document.getElementById('cImg'), link = document.getElementById('cLink');
  img.hidden = !p.slug || !SITE;
  if (!img.hidden) { img.onerror = () => { img.hidden = true; }; img.src = `${LOCAL ? '/content/images/' : '../images/'}${p.slug}.png`; }
  document.getElementById('cDist').textContent = (p.district ?? '').replace(/\s+District$/i, '');
  document.getElementById('cTitle').textContent = p.title;
  document.getElementById('cType').textContent = p.type ?? '';
  const sum = document.getElementById('cSum');
  sum.replaceChildren(...[p.summary ?? ''].flat().map(t => Object.assign(document.createElement('p'), { textContent: t })));
  const href = p.link ?? (p.slug && SITE && `${LOCAL ? 'http://localhost:1313/locations/' : '../locations/'}${p.slug}/`);
  link.hidden = !href;
  if (href) link.href = href;
  card.classList.remove('min'); cMin.textContent = '–';
  card.style.display = 'block';
  shownPlace = p;

  // On the train the camera stays aboard and turns to follow the place.

  if (riding()) rideFocus(p);
  else if (p.view) p.view(); else viewPlace(p);

  // The orbit locks on where the card's camera lands. A place or landmark also thins out what stands in front,
  // on the map and on the train.

  lockAt = riding() ? null : (fly?.toT ?? controls.target).clone();
  fadeOn = !!p.top;
  if (fadeOn) focusOn(p);
}
let lockAt = null, fadeOn = false, tourFocus = false;

// The fade box wraps a place's lot up to its top, or the pack's box round the centre. A place without a lot gets
// a 20 m box.

function focusOn(p) {
  const F = U.uFocus.value, B = U.uFocusB.value, K = U.uFocusK.value, C = SETTING.centre.fade;
  if (p === 'centre') { F.set(CENTRE.x, C.y, CENTRE.y, C.edge); B.set(...C.half); K.x = 1; K.y = 0; return; }
  const f = p.frame, h = Math.max(p.top.y, 10);
  F.set(f?.cx ?? p.top.x, h / 2, f?.cz ?? p.top.z, 12);
  B.set(f ? Math.min(f.w, BLOCK_MAX) / 2 - 2 : 10, h / 2, f ? Math.min(f.d, BLOCK_MAX) / 2 - 2 : 10);
  K.x = f?.c ?? 1; K.y = f?.s ?? 0;
}

// An audio tour names the subject of each shot: a place, 'centre' or null.

export function tourFade(s) {
  tourFocus = !!s;
  if (s) focusOn(s);
}

// The compass needle points to map north, world -z. A click turns the view north up about the same target.

const needle = document.getElementById('needle'), UP_Y = new THREE.Vector3(0, 1, 0);
let spin = null, needleDeg = null;
document.getElementById('compass').onclick = () => {
  const o = camera.position.clone().sub(controls.target);
  spin = { t: 0, turn: -Math.atan2(o.x, o.z) };
};
function turnCompass(dt) {
  if (spin) {
    const e = x => 1 - (1 - x) ** 3, t = Math.min(1, spin.t + dt / .8);
    camera.position.sub(controls.target).applyAxisAngle(UP_Y, spin.turn * (e(t) - e(spin.t))).add(controls.target);
    spin.t = t;
    if (t >= 1) spin = null;
  }
  const deg = Math.round(THREE.MathUtils.radToDeg(Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z)));
  if (deg !== needleDeg) needle.setAttribute('transform', `rotate(${needleDeg = deg} 22 22)`);
}

export let fly = null;
export const flying = () => !!fly;
const flyCam = (toT, toC, dur = 1.2) => { fly = { t: 0, dur, fromT: controls.target.clone(), toT, fromC: camera.position.clone(), toC }; };
export function flyTo(target, dist = 150, dir = null, dur = 1.2) {
  if (!dir) { dir = camera.position.clone().sub(controls.target).normalize(); dir.y = Math.max(dir.y, .55); dir.normalize(); }
  flyCam(target.clone(), target.clone().addScaledVector(dir, dist), dur);
}

export const FOCUS = PLACES.find(p => p.slug === QUERY.get('focus'));
if (FOCUS) { controls.target.set(FOCUS.x, 10, FOCUS.z); camera.position.set(FOCUS.x + 110, 190, FOCUS.z + 150); select(FOCUS); }

// ?view=x,y,z,tx,ty,tz opens the map at a camera pose, as Copy values writes it (pos, then target). The pose
// holds as given, below ground too, until the user drags or zooms.

const VIEW = QUERY.get('view')?.split(',').map(Number);
let held = VIEW?.length === 6 && VIEW.every(Number.isFinite);
export const releaseView = () => { held = false; };
if (held) { camera.position.set(...VIEW.slice(0, 3)); controls.target.set(...VIEW.slice(3)); camera.lookAt(controls.target); }

window.spike = { setLayer, look: (x, y, z, d = 60) => { controls.target.set(x, y, z); camera.position.set(x - d * .5, y + d * .8, z + d * .6); controls.update(); }, H, generate, renderer, composer, TILES: () => TILES, getSites: () => SITES, scene, CITY, density, styleAt, STYLES, getMerged: () => merged, TALLY, ARCHETYPES, SHAPES, select, PLACES, CENTRE_PLACE, camera, controls, track, FRAMES, nearHighway, CENTRE, CENTRE_R, SETTING };

export const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
export let down = null;
// A second finger turns the touch into a gesture, so lifting it never selects.

// Touching the map stops a flight, so gestures never fight it.

renderer.domElement.addEventListener('pointerdown', e => { down = e.isPrimary ? [e.clientX, e.clientY] : null; fly = spin = null; held = false; });
renderer.domElement.addEventListener('wheel', () => { fly = null; held = false; }, { passive: true });

// Labels thin out where they would crowd. Every sixth frame each label is projected to the screen and accepted in
// priority order: the open card's place, district names, quarters, campaign places, then landmarks, nearest first.
// A label whose box overlaps an accepted one fades out. Places and landmarks also fade beyond their range, so
// they appear as the camera comes closer.

let declutterTick = 0;
const labelCam = new THREE.Matrix4();
const PLACE_RANGE = LABEL.place, MARK_RANGE = LABEL.landmark, _lp = new THREE.Vector3();
// A label's width is read once, because each read after a class change forces a layout. Fonts that finish
// loading later change the widths, so they are read again then.

let widthGen = 0;
document.fonts?.ready.then(() => { widthGen++; });
function declutter() {
  const cands = [], W = innerWidth, Hgt = innerHeight;
  const add = (el, rank, range) => {
    if (!el || el.classList.contains('off') || !el.obj.visible) return;
    const d = el.obj.position.distanceTo(camera.position);
    _lp.copy(el.obj.position).project(camera);
    if (d > range || _lp.z > 1) { el.classList.add('faded'); return; }
    cands.push({ el, rank: el.place && el.place === shownPlace ? -1 : rank, d, x: (_lp.x + 1) / 2 * W, y: (1 - _lp.y) / 2 * Hgt });
  };
  for (const el of DISTRICT_LABELS.values()) add(el, 0, Infinity);
  for (const el of QUARTER_LABELS) add(el, 1, LABEL.quarter);
  for (const pin of pins) add(pin.userData.label, 2, PLACE_RANGE);
  for (const el of LANDMARK_LABELS) add(el, 3, MARK_RANGE);
  cands.sort((a, b) => a.rank - b.rank || a.d - b.d);
  const taken = [];
  for (const c of cands) {
    if (c.el.__g !== widthGen || !c.el.__w) { c.el.__w = c.el.offsetWidth; c.el.__g = widthGen; }
    const w = c.el.__w || 90, h = 16;
    const box = [c.x - w / 2 - 4, c.y - h / 2 - 3, c.x + w / 2 + 4, c.y + h / 2 + 3];
    const clear = c.rank < 0 || !taken.some(t => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1]);
    c.el.classList.toggle('faded', !clear);
    if (clear) taken.push(box);
  }
}

// Labels let pointers and wheel through to the map, so they never block a gesture. A tap selects the label under it.

const labelAt = (x, y) => document.body.classList.contains('editing') ? null : [...labels.domElement.querySelectorAll('.place, .link')].find(el => {
  const r = el.getBoundingClientRect();
  return el.place && !el.classList.contains('faded') && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
});
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  const el = labelAt(e.clientX, e.clientY);
  if (el) return select(el.place);
  ptr.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects([centre, decor], true).find(h => h.object.userData.place);
  if (hit) select(hit.object.userData.place);
});

export const blendInput = document.getElementById('blend');
blendInput.oninput = () => {
  U.uBlend.value = +blendInput.value;
  document.getElementById('bv').textContent = blendInput.value;
  generate(U.uBlend.value);
};

// ---------- tuning panel (temporary) ----------

// A row is [key, name, min, max, step, default, info, apply, rebuild]. Groups show as tabs. A row with rebuild set
// rebuilds the city when its slider is released. The i pill shows the row's info, and the search box finds rows
// in every group.

const T = SETTING.look.tune, BOOST = SETTING.centre.boost;
export const TUNE = {
  Light: [
    ['exposure', 'Exposure', .3, 2.5, .05, T.exposure, 'Brightness of the whole image.', v => { renderer.toneMappingExposure = v; }],
    ['sky', 'Sky light', 0, 4, .1, T.sky, 'Soft light from the sky on every surface.', v => { hemi.intensity = v; }],
    ['moon', 'Moonlight', 0, 3, .1, T.moon, 'Light from one direction. It shades the sides of buildings.', v => { moon.intensity = v; }],
    ['windows', 'Window light', 0, 3, .05, T.windows, 'Brightness of lit windows.', v => { U.uWin.value = v; }],
    ['edges', 'Tower edge glow', 0, 3, .05, T.edges, 'Glow along tower edges and roof lines.', v => { U.uEdge.value = v; }],
    ['neon', 'Neon signs', 0, 3, .05, T.neon, 'Brightness of neon signs.', v => { signs.material.color.setScalar(v); }],
    ['glows', 'Street and roof lights', 0, 3, .05, T.glows, 'Brightness of street lamps and roof lights.', v => { glows.material.color.setScalar(v); }],
    ['pools', 'Light pools on the ground', 0, 3, .05, T.pools, 'Brightness of the light that lamps throw on the ground.', v => { pools.material.color.setScalar(v); }],
    ['bloomStrength', 'Bloom strength', 0, 2, .05, T.bloomStrength, 'How strongly bright lights bleed into a glow.', v => { bloom.strength = v; }],
    ['bloomThreshold', 'Bloom threshold', .2, 2, .05, T.bloomThreshold, 'How bright a pixel must be before it glows. Lower makes more of the city glow.', v => { bloom.threshold = v; }],
    ['bloomRadius', 'Bloom radius', 0, 1, .05, T.bloomRadius, 'How far the glow spreads.', v => { bloom.radius = v; }],
  ],
  Air: [
    ['fogNear', 'Fog start (m)', 0, 3000, 50, T.fogNear, 'Distance from the camera where the fog begins.', v => { FOG_BASE.near = v; }],
    ['fogFar', 'Fog end (m)', 500, 9000, 100, T.fogFar, 'Distance where the fog hides everything.', v => { FOG_BASE.far = v; }],
    ['mist', 'Street mist', 0, 1.5, .02, T.mist, 'Thickness of the mist that lies in the streets.', v => { U.uMist.value = v; }],
    ['mistBase', 'Mist height (m)', -20, 60, 1, T.mistBase, 'Height of the top of the street mist.', v => { U.uMistBase.value = v; }],
  ],

  // A traffic slider shows only when the setting has that traffic. The pack's tune may set cars and speed.

  Traffic: [
    ['cars', 'Street cars', 0, 1, .02, T.cars ?? 1, 'Share of street car slots that have a car.', v => { TRAFFIC.ground = v; }],
    SETTING.transport.hover && ['hover', 'Hovercars', 0, 1, .02, 1, 'Share of hovercar slots that have a car.', v => { TRAFFIC.hover = v; }],
    CITY.highways?.length && ['highway', 'Highway traffic', 0, 1, .02, 1, 'Share of highway slots that have a car.', v => { TRAFFIC.highway = v; }],
    ['speed', 'Traffic speed', 0, 3, .05, T.speed ?? 0.3, 'Speed of all traffic.', v => { TRAFFIC.speed = v; }],
  ].filter(Boolean),

  // A pack with a clock gets the hour and the length of a day. Under the clock, the hour sets the Light rows it
  // covers whenever it moves.

  ...DAY && { Time: [
    ['hour', 'Time of day', 0, 23.75, .25, DAY.hour, 'The hour. Sun, moon, sky, shadows, windows and lanterns follow it.', v => { DAY.hour = v; }],
    ['cycle', 'Day length (min)', 0, 60, 1, DAY.cycle, 'Minutes for a whole day. At 0 the clock stands still.', v => { DAY.cycle = v; }],
  ] },

  // Skyline and Lots rows change how the city builds.

  Skyline: [
    CORES.length && ['cores', 'Skyline clusters', 0, 2.5, .05, DENSITY.cores, 'Scales the peaks of the density cores. Higher grows taller, denser clusters with low ground between them. At 0 only the noise remains.', v => { DENSITY.cores = v; }, true],
    ['grain', 'Tall next to low', 0, 4, .1, DENSITY.grain, 'Widens the fine 70 m noise in the density field. Higher puts tall and low lots side by side more often.', v => { DENSITY.grain = v; }, true],
    ['skew', 'Height skew', .6, 3, .05, CITYTUNE.skew, 'Shapes the heights of one-building lots. Higher keeps most of them low and makes the tall ones rarer. Lower evens them out.', v => { CITYTUNE.skew = v; }, true],
    ['needles', 'Needle towers', 0, .2, .005, CITYTUNE.needles, 'The share of lots in every district that grow one slim tower, whatever the district\'s own heights. Odd tower shapes apply to them too.', v => { CITYTUNE.needles = v; }, true],
    ['needleTop', 'Needle height (m)', 80, 800, 10, CITYTUNE.needleTop, 'The tallest a needle grows. Each needle stands 35% to 100% of this, and most stay in the lower half. Building height and the centre lift do not change it.', v => { CITYTUNE.needleTop = v; }, true],
    ['tallInfill', 'Infill towers from (m)', 15, 80, 1, SC.tallInfill, 'A one-building small lot taller than this becomes a tower. Its height still follows the district, so low districts only get towers of about 50 m.', v => { SC.tallInfill = v; }, true],
    ['shapes', 'Odd tower shapes', 0, 5, .1, CITYTUNE.shapes, 'Scales the odds of the special tower shapes (ziggurat, split, launch, kowloon and screens) against the plain stacked tower. Only generic towers take them, which is mostly Rutherford and the needles.',
      v => { for (const k in ARCH_BASE) if (k !== 'grammar') ARCH_WEIGHTS[k] = ARCH_BASE[k].map(w => w * v); }, true],
    BOOST.k && ['boost', 'Lift near the centre', 0, 3, .05, BOOST.k, 'Raises buildings close to the centre. The lift fades with distance.', v => { BOOST.k = v; }, true],
    BOOST.k && ['boostReach', 'Lift reach (m)', 100, 3000, 50, BOOST.r, 'How far the centre lift reaches. At this distance the lift falls to about a third.', v => { BOOST.r = v; }, true],
  ].filter(Boolean),
  Lots: [
    ['smallLot', 'Small lot width (m)', 8, 30, 1, SC.smallLot, 'Lots narrower than this take a small kit or one building. Wider lots take a full kit from the district tiers.', v => { SC.smallLot = v; }, true],
    ['small', 'Small kit share', 0, 1.5, .05, CITYTUNE.small, 'Scales the share of small lots that take their district\'s small kits. The rest get one plain building.', v => { CITYTUNE.small = v; }, true],
  ],
};

// The pack's city dials go first in their group, Lots unless the row names another. Each sets CITYTUNE[key].

for (const [key, name, min, max, step, def, info = '', group = 'Lots'] of [...SETTING.kits.cityTune].reverse()) {
  (TUNE[group] ??= []).unshift([key, name, min, max, step, def, info, v => { CITYTUNE[key] = v; }, true]);
}
export const TUNE_KEY = `${SETTING.storage}-map-tune`;
export let saved = {};
try { saved = JSON.parse(localStorage.getItem(TUNE_KEY)) || {}; } catch {}

// ?time= and ?cycle= win over a stored hour and day length.

if (DAY && /[?&](time|cycle)=/.test(location.search)) { delete saved.hour; delete saved.cycle; }
export const tuned = {};
export const sliders = document.getElementById('sliders'), tabs = document.getElementById('ttabs');
export const resets = [];
export const rebuild = () => generate(U.uBlend.value);

// Only changed values are stored, so a new default reaches every browser.

const DEFS = {};
const store = () => {
  const changed = Object.fromEntries(Object.entries(tuned).filter(([k, v]) => v !== DEFS[k]));
  try { localStorage.setItem(TUNE_KEY, JSON.stringify(changed)); } catch {}
};

// The search box sits above the tabs. The info bubble floats over the page next to its pill.

const find = Object.assign(document.createElement('input'), { type: 'search', id: 'tfind', placeholder: 'Find a setting' });
const bubble = Object.assign(document.createElement('div'), { id: 'tinfo', role: 'tooltip', hidden: true });
tabs.before(find);
document.body.appendChild(bubble);
const showInfo = (pill, text) => {
  bubble.textContent = text;
  bubble.hidden = false;
  const b = pill.getBoundingClientRect(), h = bubble.offsetHeight;
  bubble.style.left = `${Math.max(8, Math.min(b.left - 12, innerWidth - bubble.offsetWidth - 8))}px`;
  bubble.style.top = `${b.bottom + 6 + h < innerHeight ? b.bottom + 6 : b.top - 6 - h}px`;
};
addEventListener('pointerdown', e => { if (!e.target.closest?.('#tune .i')) bubble.hidden = true; });

let open;
const show = box => {
  open = box;
  for (const b of tabs.children) b.classList.toggle('on', b.box === box);
  for (const g of sliders.children) g.hidden = g !== box;
};
find.oninput = () => {
  const q = find.value.trim().toLowerCase();
  sliders.classList.toggle('finding', !!q);
  for (const el of sliders.querySelectorAll('.slider')) el.hidden = !!q && !el.dataset.find.includes(q);
  if (!q) return show(open);
  for (const g of sliders.children) g.hidden = !g.querySelector('.slider:not([hidden])');
};

for (const [group, rows] of Object.entries(TUNE)) {
  const box = document.createElement('div'), tab = document.createElement('button');
  box.className = 'group';
  box.innerHTML = `<h4>${group}</h4>`;
  tab.textContent = group;
  tab.box = box;
  tab.onclick = () => {
    if (find.value) { find.value = ''; find.oninput(); }
    show(box);
  };
  tabs.appendChild(tab);
  sliders.appendChild(box);

  // A changed row shows a reset arrow, and its tab counts the changed rows.

  const count = () => { tab.dataset.n = box.querySelectorAll('.changed').length; };
  for (const [key, name, min, max, step, def, info, apply, regen] of rows) {
    const el = document.createElement('div');
    el.className = 'slider';
    el.dataset.find = `${name} ${info}`.toLowerCase();
    el.innerHTML = `<span>${name}</span><button class="i" aria-label="About ${name}">i</button><button class="undo" title="Back to ${def}">↺</button>`
      + `<output></output><input type="range" min="${min}" max="${max}" step="${step}" aria-label="${name}">`;
    const input = el.querySelector('input'), out = el.querySelector('output'), pill = el.querySelector('.i');
    const text = `${info} Range ${min} to ${max}, default ${def}.${regen ? ' The city rebuilds when you release the slider.' : ''}`;
    const set = v => {
      tuned[key] = v; input.value = v; out.textContent = v; apply(v);
      el.classList.toggle('changed', v !== def);
      count();
    };
    input.oninput = () => {
      if (regen) out.textContent = input.value;
      else set(+input.value);
    };
    input.onchange = () => {
      set(+input.value);
      if (regen) rebuild();
      store();
    };
    el.querySelector('.undo').onclick = () => {
      set(def);
      if (regen) rebuild();
      store();
    };
    pill.onpointerenter = () => showInfo(pill, text);
    pill.onpointerleave = e => { if (e.pointerType === 'mouse') bubble.hidden = true; };
    pill.onclick = () => showInfo(pill, text);
    DEFS[key] = def;
    resets.push(() => set(def));
    set(saved[key] ?? def);
    box.appendChild(el);
  }
  if (group === 'Air') {
    const fogInput = document.createElement('label');
    fogInput.className = 'slider';
    fogInput.dataset.find = 'fog and sky colour';
    fogInput.innerHTML = '<span>Fog and sky colour</span><input type="color" value="#' + FOG.getHexString() + '">';
    fogInput.querySelector('input').oninput = e => { FOG.set(e.target.value); scene.fog.color.copy(FOG); };
    box.appendChild(fogInput);
  }
  if (rows.some(row => row[8])) box.insertAdjacentHTML('beforeend', '<div class="note">The city rebuilds when you release a slider.</div>');
}
tabs.firstChild.click();

// A pack with a clock also shows the hour in a slider above Smooth edges. It drives the Time tab's slider, so the
// two stay in step and the hour is stored like any tuned value. A running clock moves both twice a second.

const hourInput = sliders.querySelector('input[aria-label="Time of day"]');
if (hourInput) {
  document.body.insertAdjacentHTML('beforeend', '<label id="clock" title="Time of day"><button class="play" type="button"></button>'
    + '<output></output><input type="range" min="0" max="23.75" step=".25" aria-label="Hour"></label>');
  const clock = document.querySelector('#clock input'), clockText = document.querySelector('#clock output');
  const play = document.querySelector('#clock .play'), run = DAY.cycle || 4;
  const show = () => {
    const text = `${Math.floor(DAY.hour)}:${String(Math.floor(DAY.hour % 1 * 60)).padStart(2, '0')}`;
    clock.value = hourInput.value = DAY.hour;
    clockText.textContent = hourInput.previousElementSibling.textContent = text;
    play.textContent = DAY.cycle ? '❚❚' : '▶';
    play.setAttribute('aria-label', DAY.cycle ? 'Stop the day' : 'Run the day');
  };

  // The button runs the day, four minutes a day unless the pack's cycle says otherwise, or stops it.

  play.onclick = () => { DAY.cycle = DAY.cycle ? 0 : run; show(); };
  clock.oninput = () => { hourInput.value = clock.value; hourInput.oninput(); show(); };
  clock.onchange = () => hourInput.onchange();
  hourInput.addEventListener('input', show);
  show();
  setInterval(() => { if (DAY.cycle) show(); }, 500);
}
if (Object.values(TUNE).flat().some(([k, , , , , def, , , regen]) => regen && (saved[k] ?? def) !== def)) rebuild();
document.getElementById('treset').onclick = () => {
  resets.forEach(f => f());
  rebuild();
  try { localStorage.removeItem(TUNE_KEY); } catch {}
};

// Copy values also copies the camera view, so a bug report can name the exact spot.

document.getElementById('tcopy').onclick = () => {
  const v = a => a.toArray().map(n => Math.round(n * 10) / 10);
  const view = { pos: v(camera.position), target: v(controls.target), quality: QUALITY.level, size: [innerWidth, innerHeight], dpr: renderer.getPixelRatio() };
  navigator.clipboard.writeText(JSON.stringify({ ...tuned, fog: '#' + FOG.getHexString(), view }));
};

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); labels.setSize(innerWidth, innerHeight);
  labelCam.identity();
  if (OPT.budget) applyQuality(QUALITY.level);
});

// ---------- loop ----------

export const clock = new THREE.Clock();
export const _p = new THREE.Vector3(), _t = new THREE.Vector3();
export const waving = [];
decor.traverse(m => { if (m.userData.wave) waving.push(m); });
const fpsEl = document.getElementById('fps');

// The tuning panel shows the camera as ?view=x,y,z,tx,ty,tz. The target sits 50 m ahead along the view,
// so the pose holds on a ride too, where the orbit target is not used. A click copies the link.

const tune = document.getElementById('tune'), viewEl = document.getElementById('tview'), _d = new THREE.Vector3();
const viewText = () => {
  const r = n => Math.round(n * 10) / 10, t = camera.getWorldDirection(_d).multiplyScalar(50).add(camera.position);
  return [...camera.position.toArray(), ...t.toArray()].map(r).join(',');
};
viewEl.onclick = () => { const u = new URL(location.href); u.searchParams.set('view', viewText()); navigator.clipboard.writeText(u.href); };

// Auto quality: four slow half-second windows in a row step down a level; twelve fast ones step back up,
// never above the level auto started at. Hidden tabs are skipped, because the browser throttles them.

const ORDER = ['low', 'medium', 'high'], START = QUALITY.level;
let slow = 0, fast = 0;
function autoQuality(fps) {
  if (QUALITY.mode !== 'auto' || document.hidden) return;
  slow = fps < 28 ? slow + 1 : 0;
  fast = fps > 52 ? fast + 1 : 0;
  const k = ORDER.indexOf(QUALITY.level);
  if (slow >= 4 && k > 0) { applyQuality(ORDER[k - 1]); slow = 0; }
  if (fast >= 12 && k < ORDER.indexOf(START)) { applyQuality(ORDER[k + 1]); fast = 0; }
}
let fpsN = 0, fpsT = 0;

// three draws a transparent double-sided mesh twice, back faces then front, and resolves its program both times.
// One pass draws the same pixels when the blend is additive without depth writes, or when the mesh is flat.

const isFlat = g => { g.boundingBox ?? g.computeBoundingBox(); const s = g.boundingBox.getSize(_p); return Math.min(s.x, s.y, s.z) < 1e-4; };
const users = new Map();
scene.traverse(o => { if (o.material?.transparent && o.material.side === THREE.DoubleSide) users.set(o.material, [...users.get(o.material) ?? [], o]); });
for (const [m, os] of users) {
  if ((m.blending === THREE.AdditiveBlending && !m.depthWrite) || os.every(o => isFlat(o.geometry))) m.forceSinglePass = true;
}

// While a card thins the view, opaque built-in meshes off the ground draw with their fadeTwin. The list is taken
// fresh each time, so tiles from a city rebuild join. Twins compile at start, so the first card does not stall.

let swapped = null;
function thin(on) {
  if (on === !!swapped) return;
  if (!on) { for (const [o, m] of swapped) o.material = m; swapped = null; return; }
  const ground = new Set();
  for (const s of SURFACE) s.traverse(o => ground.add(o));
  swapped = [];
  scene.traverse(o => {
    const m = o.material;
    if (o.isMesh && !ground.has(o) && m && !Array.isArray(m) && m.visible && !m.transparent && !m.isShaderMaterial) swapped.push([o, m]);
  });
  for (const [o, m] of swapped) o.material = fadeTwin(m);
}
performance.mark('na:compile0');
thin(true);
renderer.compileAsync(scene, camera).catch(() => {});
thin(false);
performance.mark('na:compile1');

// Frames are capped at 60 per second. On faster screens the loop skips a refresh until a 60 Hz slot has passed;
// carrying the remainder keeps 120 and 144 Hz screens near 60 instead of dropping to 48.

const SLOT = 1000 / 60, flickered = new Map(), FLICKER = SETTING.look.flicker, FOG_ZOOM = SETTING.scale.fogZoom;
let lastFrame = 0, lift = 0, settled = false;
renderer.setAnimationLoop(now => {
  const since = now - lastFrame;
  if (since < SLOT - 2) return;
  lastFrame = now - since % SLOT;
  const dt = Math.min(clock.getDelta(), .1), t = clock.elapsedTime;

  // Frames per second, counted over half-second windows.

  fpsN++; fpsT += dt;
  if (fpsT > .5) {
    const fps = fpsN / fpsT;
    fpsEl.textContent = `${Math.round(fps)} fps · ${QUALITY.level}`;
    if (tune.open) viewEl.textContent = viewText();
    autoQuality(fps);
    fpsN = 0; fpsT = 0;
  }
  S.trafficT += dt * TRAFFIC.speed;
  U.uTime.value = t;

  if (fly) {
    fly.t = Math.min(1, fly.t + dt / fly.dur);
    const e = 1 - (1 - fly.t) ** 3;
    controls.target.lerpVectors(fly.fromT, fly.toT, e);
    camera.position.lerpVectors(fly.fromC, fly.toC, e);
    if (fly.t >= 1) fly = null;
  }

  // An open card holds the orbit on its subject, except while a tour, a ride or edit mode drives the camera.
  // A flight cut short by a touch eases the target the rest of the way.

  const locked = !!lockAt && card.style.display === 'block' && controls.enabled && !document.body.classList.contains('focus') && !document.body.classList.contains('editing');
  if (locked !== LOCK.on) lockCamera(locked);
  if (locked && !fly) { _t.subVectors(lockAt, controls.target).multiplyScalar(Math.min(1, dt * 5)); controls.target.add(_t); camera.position.add(_t); }

  // On a phone the card covers the lower third, so an open card shifts the view up and the place sits higher on
  // screen. A minimized card leaves the view centred. The orbit target stays on the place.

  lift += ((locked && innerWidth < 700 && !card.classList.contains('min') ? innerHeight * .17 : 0) - lift) * Math.min(1, dt * 5);
  if (lift > .5) camera.setViewOffset(innerWidth, innerHeight, 0, lift, innerWidth, innerHeight);
  else if (camera.view?.enabled) { lift = 0; camera.clearViewOffset(); }
  const k = U.uFocusK.value;
  const fading = tourFocus || fadeOn && (locked || riding() && card.style.display === 'block');
  k.z = THREE.MathUtils.clamp(k.z + (fading ? dt : -dt) / .3, 0, 1);
  thin(k.z > 0);
  turnCompass(dt);

  // On a relief the orbit's target rides on the ground, so the camera climbs and falls with the town. A layer's floor
  // sets the target's height instead, or with follow its depth below the ground. It settles at
  // once on the first frame and eases after that. A ride or a tour steers the camera itself.

  if (RELIEF && !held && !fly && !riding() && !tourFocus) {
    const L = PACK_LAYERS[layer], g = L?.floor == null || L.follow ? groundAt(controls.target.x, controls.target.z) : 0;
    const dy = (g + (L?.floor ?? 0) - controls.target.y) * (settled ? Math.min(1, dt * 4) : 1);
    controls.target.y += dy; camera.position.y += dy; settled = true;
  }
  if (held) held = !fly && !riding() && !tourFocus;
  if (!held) controls.update();
  clipTop += (LAYERS[layer] - clipTop) * Math.min(1, dt * 3);
  const top = layer === 'all' && clipTop > LAYERS.all - 10 ? 1e5 : clipTop;
  clipPlane.constant = top;
  U.uClipTop.value = top;

  // Back faces paint the cut-open insides while a low layer's clip is on. Otherwise they stay culled,
  // so a camera inside a building sees out, and the GPU skips half the building faces. The clip plane is on
  // only while cut open, because it compiles a discard into every built-in material.

  if ((top < 1e5) !== cutOpen) {
    cutOpen = top < 1e5;
    renderer.clippingPlanes = cutOpen ? [clipPlane] : [];
    for (const m of [...Object.values(SHAPES).map(s => s.material), MERGED_MAT]) { m.side = cutOpen ? THREE.DoubleSide : THREE.FrontSide; m.needsUpdate = true; }
  }

  moveCars(dt * TRAFFIC.speed);
  movePeople(dt);
  moveBoats(dt);

  // Highway cars sort by rank, so the shown ones come first. Every car moves on, but one past the pack's near range
  // takes its new spot every second frame, about a metre at a time, and one past the fog only one frame in eight.

  const hwShow = TRAFFIC.highway * QUALITY.cars, far2 = (scene.fog.far + 300) ** 2, mid2 = SETTING.scale.traffic.highwayNear ** 2, cx = camera.position.x, cz = camera.position.z, turn = declutterTick & 7;
  hwCars.count = 0;
  for (let i = 0; i < hwTraffic.length; i++) {
    const c = hwTraffic[i];
    if (c.rank >= hwShow) break;
    hwCars.count = i + 1;
    c.u = (c.u + c.v * dt * TRAFFIC.speed + 1) % 1;
    const P = c.h.path, n = P.length - 1, f = c.u * n, k = Math.floor(f), a = P[k];
    const d2 = (a.x - cx) ** 2 + (a.z - cz) ** 2;
    if (!(d2 <= mid2 || (d2 <= far2 ? ((i + turn) & 1) === 0 : (i & 7) === turn))) continue;
    const b = P[Math.min(k + 1, n)], sd = c.h.side[k];
    yawAt(hwCars, i, lerp(a.x, b.x, f - k) + sd.x * c.lane * 3.2, a.y + .4, lerp(a.z, b.z, f - k) + sd.z * c.lane * 3.2, b.x - a.x, b.z - a.z);
  }
  uploadUsed(hwCars);
  for (const l of LANDMARKS) l.update?.(t, dt);
  if (layer !== 'all') LAYER_MODS[layer]?.update?.(t, dt, PACK_LAYERS[layer]);
  rideTick(dt);
  updateFireworks(dt);
  for (const f of waving) f.rotation.y = Math.sin(t * 2.3) * .25;

  const zoom = camera.position.distanceTo(controls.target), away = Math.max(0, zoom - FOG_ZOOM.from);

  for (const el of LANDMARK_LABELS) el.obj.visible = layer === 'all';
  if (++declutterTick % 6 === 0) declutter();
  U.uFogNear.value = scene.fog.near = (FOG_BASE.near + away * FOG_ZOOM.near) * QUALITY.fog;
  U.uFogFar.value = scene.fog.far = (FOG_BASE.far + away * FOG_ZOOM.far) * QUALITY.fog;
  const beat = (t * FLICKER.beat) % 1 < FLICKER.on;
  for (const f of S.flicker) {

    // Beacons blink together on one city-wide beat. Broken neon keeps its own random stutter. A lantern stutters
    // the same way but only dims to its own level, f[5].
    // Only lights that switched get written, and each tile uploads one range that spans them.
    // A light on a tile that is not drawing waits; its stored state still matches its colour. Neon stutter
    // updates half the lights each frame, alternating.

    const m = f[0], i = f[1], rgb = f[2], ph = f[3], tile = m.userData.tileOf?.[i], tm = tile ? tile[0] : m, j = tile ? tile[1] : i;
    if (!tm.visible && f.tiles === TILES) continue;
    if (!f[4] && ((i + declutterTick) & 1) && f.tiles === TILES) continue;
    const on = f[4] ? beat : Math.sin(t * 13 + ph) + Math.sin(t * 7.3 + ph * 2) > FLICKER.stutter;
    if (f.on === on && f.tiles === TILES) continue;
    f.on = on; f.tiles = TILES;
    const at = tm.instanceColor, k = on ? 1 : f[5] ?? FLICKER.dim;
    at.array[j * 3] = rgb[0] * k; at.array[j * 3 + 1] = rgb[1] * k; at.array[j * 3 + 2] = rgb[2] * k;
    const js = flickered.get(at);
    if (js) js.push(j); else flickered.set(at, [j]);
  }

  // Lights within 64 slots of each other share one upload range. A hidden tile keeps its ranges until it draws;
  // past 32 they fold into one span.

  for (const [at, js] of flickered) {
    js.sort((a, b) => a - b);
    let lo = js[0], hi = lo;
    for (const j of [...js.slice(1), Infinity]) {
      if (j - hi <= 64) { hi = j; continue; }
      at.addUpdateRange(lo * 3, (hi - lo) * 3 + 3);
      lo = hi = j;
    }
    const R = at.updateRanges;
    if (R.length > 32) {
      const s = Math.min(...R.map(r => r.start)), e = Math.max(...R.map(r => r.start + r.count));
      at.clearUpdateRanges(); at.addUpdateRange(s, e - s);
    }
    at.needsUpdate = true;
  }
  flickered.clear();
  // Detail tiles show within the prop range. Every tile past the fog's end stops drawing.

  for (const tl of TILES) {
    const d = Math.hypot(camera.position.x - tl.x, camera.position.y, camera.position.z - tl.z);
    tl.mesh.visible = d < scene.fog.far + tl.half * 1.5 && (!tl.detail || d < QUALITY.detail + tl.half * 1.4);
  }

  tick(dt);
  if (!S.drawn) performance.mark('na:frame0');
  composer.render();
  if (!S.drawn) { S.drawn = true; performance.mark('na:frame1'); requestAnimationFrame(() => performance.mark('na:painted')); }

  // Labels rewrite every element's style, so they redraw only when the camera moved, and every sixth frame
  // for labels that appear or hide.

  if (declutterTick % 6 === 0 || !labelCam.equals(camera.matrixWorld)) { labels.render(labelRoot, camera); labelCam.copy(camera.matrixWorld); }
});
initNav();
performance.mark('na:shown');
document.getElementById('loading').classList.add('done');
setTimeout(() => document.getElementById('loading').remove(), 700);
// The tuning panel, with the dev readouts, stays hidden until "?" is pressed; "?" again hides it. On a touch
// screen, four quick taps on the "?" button do the same.

const toggleTune = () => {
  const tune = document.getElementById('tune'), hud = document.getElementById('hud');
  tune.hidden = !tune.hidden;
  hud.classList.toggle('tuning', !tune.hidden);
  if (!tune.hidden) { hud.open = true; tune.open = true; }
};
addEventListener('keydown', e => {
  if (e.key === '?' && !/input|textarea|select/i.test(e.target.tagName)) toggleTune();
});

// The "?" button opens the help panel. Escape or a touch on the map closes it.

const helpBtn = document.getElementById('help'), helpPanel = document.getElementById('helpPanel');
const showHelp = on => { helpPanel.hidden = !on; helpBtn.setAttribute('aria-expanded', on); };
let taps = 0, lastTap = 0;
helpBtn.onclick = () => {
  const now = performance.now();
  taps = now - lastTap < 500 ? taps + 1 : 1;
  lastTap = now;
  if (taps === 4) { taps = 0; showHelp(false); toggleTune(); return; }
  showHelp(helpPanel.hidden);
};
document.getElementById('helpClose').onclick = () => showHelp(false);
addEventListener('keydown', e => { if (e.key === 'Escape' && !helpPanel.hidden) showHelp(false); });
renderer.domElement.addEventListener('pointerdown', () => showHelp(false));

// The sliders button beside "?" opens the graphics panel. Quality picks a preset level, and auto moves the level
// with the frame rate. The controls under it show what the level sets. A change to one of them switches the preset
// to Custom, which holds the controls over the level then showing. Auto stops stepping under Custom.

const gfxBtn = Object.assign(document.createElement('button'), { id: 'gfx', title: 'Settings' });
gfxBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h11M18 7h3M3 17h4M11 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>';
Object.entries({ 'aria-label': 'Settings', 'aria-expanded': false, 'aria-controls': 'gfxPanel' }).forEach(([k, v]) => gfxBtn.setAttribute(k, v));
const gfxPanel = Object.assign(document.createElement('div'), { id: 'gfxPanel', className: 'panel', hidden: true });
gfxPanel.innerHTML = '<button id="gfxClose" aria-label="Close settings">×</button><h2>Settings</h2>';
helpBtn.after(gfxBtn, gfxPanel);
const row = (name, el) => { const l = document.createElement('label'); l.append(name, el); gfxPanel.append(l); };
const qSel = document.getElementById('quality');
qSel.add(new Option('Custom', 'custom'));
qSel.parentNode.remove();
row('Quality', qSel);

// Resolution is the share of the screen's pixels the frame draws, up to 3 device pixels per pixel. A level can
// land between the listed shares, so the control adds that share as its own entry.
// View distance takes the fog range and prop range of the low, medium or high level.
// Glow scales the bloom the output pass adds, or turns bloom off. The other controls are on/off switches.

const share = () => Math.round(renderer.getPixelRatio() / devicePixelRatio * 100) / 100;
const VIEWS = ['low', 'medium', 'high'];
const KNOBS = [
  ['res', 'Resolution', [['0.5', '50%'], ['0.75', '75%'], ['1', '100%'], ['1.5', '150%'], ['2', '200%']].filter(([v]) => devicePixelRatio * v <= 3)],
  ['view', 'View distance', [['low', 'Near'], ['medium', 'Medium'], ['high', 'Far']]],
  ['glow', 'Glow', [['off', 'Off'], ['0.6', 'Subtle'], ['1', 'Normal'], ['1.6', 'Strong']]],
  ['smaa', 'Smooth edges'],
  ...aoPass ? [['ao', 'Corner shade']] : [],
  ...SHADOWS ? [['shadows', 'Shadows']] : [],
];
const shown = {
  res: () => String(share()),
  view: () => VIEWS.find(l => QUALITY_LEVELS[l].fog === QUALITY.fog && QUALITY_LEVELS[l].detail === QUALITY.detail) ?? 'high',
  glow: () => QUALITY.bloom ? String(QUALITY.glow) : 'off',
};
const valueOf = el => el.type === 'checkbox' ? (el.checked ? 'on' : 'off') : el.value;

// Smooth edges also raises Resolution to 150%, or to the highest share under it the screen allows, as ultra does.
// Turning it off puts back the resolution it raised, unless the viewer changed Resolution since.

let resBeforeSmaa = null;
const smaaRes = (on, res) => {
  if (!on) {
    if (resBeforeSmaa !== null) res.value = resBeforeSmaa;
    resBeforeSmaa = null;
    return;
  }
  const top = [...res.options].map(o => o.value).filter(v => +v <= 1.5).at(-1);
  if (+res.value < +top) { resBeforeSmaa = res.value; res.value = top; }
};

const knobs = KNOBS.map(([k, name, opts]) => {
  const el = document.createElement(opts ? 'select' : 'input');
  if (opts) el.innerHTML = opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  else { el.type = 'checkbox'; el.setAttribute('role', 'switch'); }
  el.dataset.k = k;
  el.onchange = () => {
    if (k === 'smaa') smaaRes(el.checked, knobs.find(e => e.dataset.k === 'res'));
    if (k === 'res') resBeforeSmaa = null;
    pick = Object.fromEntries(knobs.map(e => [e.dataset.k, valueOf(e)]));
    pick.level = QUALITY.level;
    setMode('custom');
  };
  row(name, el);
  return el;
});
addEventListener('map-quality', () => {
  for (const el of knobs) {
    if (el.type === 'checkbox') { el.checked = !!QUALITY[el.dataset.k]; continue; }
    const v = shown[el.dataset.k]();
    if (![...el.options].some(o => o.value === v)) el.add(new Option(`${Math.round(v * 100)}%`, v), [...el.options].find(o => +o.value > +v));
    el.value = v;
  }
});

// The pixel cap works at every quality level and leaves the preset alone. It persists per browser.

const OPT_KEY = `${SETTING.storage}-map-opt`;
try { OPT.budget = !!JSON.parse(localStorage.getItem(OPT_KEY))?.budget; } catch {}
const capEl = Object.assign(document.createElement('input'), { type: 'checkbox', checked: OPT.budget });
capEl.setAttribute('role', 'switch');
capEl.onchange = () => {
  OPT.budget = capEl.checked;
  try { localStorage.setItem(OPT_KEY, JSON.stringify(OPT)); } catch {}
  applyQuality(QUALITY.level);
};
row('4K pixel cap', capEl);

// The preset and the custom controls persist per browser.

const QUALITY_KEY = `${SETTING.storage}-map-quality`, GFX_KEY = `${SETTING.storage}-map-gfx`;
let pick = {};
const save = () => { try { localStorage.setItem(QUALITY_KEY, qSel.value); localStorage.setItem(GFX_KEY, JSON.stringify(pick)); } catch {} };
const setMode = v => {
  if (v === 'custom' && !(pick.level in QUALITY_LEVELS)) v = 'auto';
  QUALITY.mode = qSel.value = v;
  for (const k in PICK) delete PICK[k];
  if (v === 'custom') {
    const view = QUALITY_LEVELS[VIEWS.includes(pick.view) ? pick.view : pick.level], glow = pick.glow ?? (pick.bloom === 'off' ? 'off' : '1');
    Object.assign(PICK, { ss: +pick.res, dpr: 3, fog: view.fog, detail: view.detail, bloom: glow !== 'off', glow: glow === 'off' ? 1 : +glow,
      smaa: pick.smaa === 'on', ao: pick.ao !== 'off', shadows: pick.shadows !== 'off' });
  }
  applyQuality(v === 'custom' ? pick.level : v === 'auto' ? START : v);
  save();
};
qSel.onchange = () => setMode(qSel.value);
let stored = 'auto';
try { stored = localStorage.getItem(QUALITY_KEY) || 'auto'; pick = JSON.parse(localStorage.getItem(GFX_KEY)) || {}; } catch {}
setMode([...qSel.options].some(o => o.value === stored) ? stored : 'auto');

// Music plays while the visitor looks around. Rides and tours bring their own sound, so it pauses while one runs.
// The pick persists. A saved pick starts on the first tap, because browsers block autoplay.

if (SETTING.music?.length) {
  const KEY = `${SETTING.storage}-map-music`, tune = Object.assign(new Audio(), { loop: true, volume: .5 }), sel = document.createElement('select');
  sel.id = 'music';
  sel.innerHTML = [['', 'Off'], ...SETTING.music.map(m => [m.file, m.name])].map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  try { sel.value = localStorage.getItem(KEY) ?? ''; } catch {}
  if (sel.selectedIndex < 0) sel.value = '';
  const play = () => {
    if (!sel.value || document.body.classList.contains('focus')) return tune.pause();
    const url = new URL(`${RIDE_AUDIO}${sel.value}.mp3`, location.href).href;
    if (tune.src !== url) tune.src = url;
    tune.play().catch(() => {});
  };
  sel.onchange = () => { try { localStorage.setItem(KEY, sel.value); } catch {} play(); };
  addEventListener('pointerdown', play, { once: true });
  new MutationObserver(play).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  row('Music', sel);
}

const hint = text => gfxPanel.appendChild(Object.assign(document.createElement('p'), { className: 'hint', textContent: text }));
hint('Resolution is a share of the screen’s pixels.');
hint('').append(fpsEl);

const showGfx = on => { gfxPanel.hidden = !on; gfxBtn.setAttribute('aria-expanded', on); if (on) showHelp(false); };
gfxBtn.onclick = () => showGfx(gfxPanel.hidden);
helpBtn.addEventListener('click', () => showGfx(false));
document.getElementById('gfxClose').onclick = () => showGfx(false);
addEventListener('keydown', e => { if (e.key === 'Escape') showGfx(false); });
renderer.domElement.addEventListener('pointerdown', () => showGfx(false));

if (QUERY.has('edit') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) import('./edit.js');

// ?probe measures what each part of the scene costs on this device. ?probe=live shows frame times as you move,
// and ?probe=gpu times the GPU at fixed views.

if (QUERY.has('probe')) import('./probe.js').then(m => ({ gpu: m.runGpuBench, live: m.runLive }[QUERY.get('probe')] ?? m.runProbe)());
