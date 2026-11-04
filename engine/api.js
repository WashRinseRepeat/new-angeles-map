// The helper API H, kit family and landmark loading, place seating and the first build.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { S, H } from './state.js';
import { AXIS_HI, AXIS_LO, BLOCK, CENTRE, CENTRE_PLACE, CENTRE_R, CITY, PLACES, STANDALONE, STYLES, hash, lerp, loadMsg, mapToWorld, mixStyle, rng, sdPoly, smooth, styleAt } from './core.js';
import { SETTING, atRoot, inPack } from './setting.js';
import { FOG_GLSL, SURFACE, U, WATER_GLSL, addHole, holed, label, outerGround, slab, surface, water } from './render.js';
import { groundAt } from './relief.js';
import { FACES, GLOWS, INSTANCED, PROPS, SKINS, beacon, beam, bld, laser, glow, glows, grey, helipad, holo, kibble, neon, pool, prop, puff, put, soften, roof, sign, textSign } from './instances.js';
import { KITS, crownOf, decor, grammarTowerBody, neonTexture, panel, plate, stringLights } from './grammar.js';
import { fillGreens } from './greens.js';
import { SOIL, soil } from './soil.js';
import { packClouds } from './clouds.js';
import { keep } from './edge.js';
import { STREETS, buildPylons, centre, corridorIn, traffic } from './transport.js';
import { buildStations } from './ride.js';
import { ALL_BLOCK_FRAMES, BLOCK_FRAMES, BLOCK_KITS, BLOCK_MAX, FAMILY_KITS, SC, FRAMES, HUSH, frontOf, LANDMARKS_KITS, OWN_TIERS, SHOWCASE, SMALL_LOTS, generate, inRect, showcase } from './generator.js';

// ---------- module API: what place and kit files may use ----------

export const canvasTexture = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
};
// H is created empty in state.js so kits and the generator can import it. The API fills it here. The pack's
// helpers add its own names, such as the style axis ends under their district names.

Object.defineProperties(H, Object.getOwnPropertyDescriptors({
  THREE, CITY, CENTRE, CENTRE_R, SETTING, U, FOG_GLSL, WATER_GLSL, BLOCK, AXIS: [AXIS_LO, AXIS_HI], SKINS, FACES, PROPS, GLOWS,
  ...SETTING.styles.helpers, get decor() { return S.DECOR; },
  mapToWorld,
  mixStyle, rng, hash, lerp, smooth, grey,
  put, prop, glow, pool, soil, beam, laser, puff, soften, textSign, beacon, bld, roof, kibble, sign, neon, holo, helipad, crownOf, grammarTowerBody,
  panel, neonTexture, stringLights, plate, canvasTexture,
  frame: () => S.FRAME,

  // Local point in the current frame to world coordinates, and back.

  worldOf: (x, z) => {
    if (!S.FRAME) return [x, z];
    const dx = x - S.FRAME.cx, dz = z - S.FRAME.cz;
    return [(S.FRAME.tx ?? S.FRAME.cx) + dx * S.FRAME.c + dz * S.FRAME.s, (S.FRAME.tz ?? S.FRAME.cz) - dx * S.FRAME.s + dz * S.FRAME.c];
  },

  toLocal: (x, z) => {
    if (!S.FRAME) return [x, z];
    const dx = x - (S.FRAME.tx ?? S.FRAME.cx), dz = z - (S.FRAME.tz ?? S.FRAME.cz);
    return [S.FRAME.cx + dx * S.FRAME.c - dz * S.FRAME.s, S.FRAME.cz + dx * S.FRAME.s + dz * S.FRAME.c];
  },
  styleAt: (x, z) => styleAt(x, z, U.uBlend.value),

  // The named sub-area (design/map-trace.json) whose circle, grown by scale, holds a world point, or null.

  subareaAt: (x, z, scale = 1) => {
    let best = null, bd = Infinity;
    for (const a of CITY.subareas ?? []) {
      const d = Math.hypot(x - a.at[0], z - a.at[1]) / a.r;
      if (d < scale && d < bd) { bd = d; best = a.name; }
    }
    return best;
  },

  // Kit-owned instanced meshes register here so generate() resets and uploads them with the engine's own.

  instanced: m => { m.count = 0; m.frustumCulled = false; INSTANCED.push(m); return m; },

  // A flickering light, like broken neon. dim, a share such as .7, makes it waver like a flame instead.

  flickerGlow: (x, y, z, sx, sy, sz, rgb, r, dim) => S.flicker.push([glows, glow(x, y, z, sx, sy, sz, rgb), rgb, r() * 10, false, ...dim ? [dim] : []]),

  // A soft searchlight: a cone from its lamp at the origin up +y to its wide end at y = 1, so a mesh or
  // instance scales it to (radius, length, radius). It is brightest at the lamp, fades along its length,
  // fades at its edges and carries drifting haze. The pack sets the default colour.

  beamGeo: new THREE.CylinderGeometry(1, .08, 1, 32, 12, true).translate(0, .5, 0),
  searchBeam: (rgb = SETTING.look.searchlight, gain = 1) => BEAMS[`${rgb}|${gain}`] ??= new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uFogNear: U.uFogNear, uFogFar: U.uFogFar, uCol: { value: new THREE.Color(...rgb).multiplyScalar(gain) } },
    vertexShader: `
      varying vec3 vW, vA, vD; varying float vT;
      void main() {
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
        m = m * instanceMatrix;
        #endif
        vec4 w = m * vec4(position, 1.);
        vW = w.xyz; vA = (m * vec4(0., 0., 0., 1.)).xyz; vD = normalize((m * vec4(0., 1., 0., 1.)).xyz - vA); vT = position.y;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform float uTime, uFogNear, uFogFar; uniform vec3 uCol;
      varying vec3 vW, vA, vD; varying float vT;
      float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float n3(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      void main() {
        vec3 rad = vW - vA; rad -= vD * dot(rad, vD);
        float edge = pow(abs(dot(normalize(rad), normalize(cameraPosition - vW))), 2.2);
        float fall = (1. - .7 * vT) * (.35 + 1.6 * exp(-vT * 6.));
        vec3 q = vW * .05 + vec3(uTime * .12, -uTime * .05, 0.);
        float haze = .45 + .9 * n3(q) * n3(q * 2.7 + 3.1);
        float fog = 1. - smoothstep(uFogNear, uFogFar * 1.4, distance(cameraPosition, vW));
        gl_FragColor = vec4(uCol * edge * fall * haze * fog * .16, 1.);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }),
}));
const BEAMS = {};

// Kit families live in the pack's kits/<family>.js. Each exports kits(H) and tiers, which adds kit names to district
// tiers. District families own their district's tiers. Find families add landmarks, each with a card file at
// content/<family>.json. Private families hold campaign places, so the public copy leaves them out.

const K = SETTING.kits;
export const NEW_DISTRICTS = K.districts;
export const FIND_FAMILIES = K.finds.filter(f => !STANDALONE || !K.private?.includes(f));
export const KIT_FAMILIES = [...K.families, ...NEW_DISTRICTS, ...FIND_FAMILIES];

for (const fam of KIT_FAMILIES) {
  const mod = await import(inPack(`kits/${fam}.js`)), kits = mod.kits(H);
  Object.assign(KITS, kits, mod.EXTRA);
  FAMILY_KITS[fam] = Object.keys(kits);
  for (const { zone, build } of Object.values(mod.blocks?.(H) ?? {})) BLOCK_KITS[zone].push(build);
  for (const [name, lm] of Object.entries(mod.landmarks?.(H) ?? {})) LANDMARKS_KITS.push({ name, ...lm });

  // A new district's own tiers replace its placeholder tiers, as do the tiers of a district in kits.ownTiers, for a
  // family that serves several districts. Older districts only gain names.

  for (const [d, add] of Object.entries(mod.tiers ?? {})) {
    const id = SETTING.styles.tierAlias?.[d] ?? d, S = STYLES[id];
    if (!S) continue;
    if ((NEW_DISTRICTS.includes(id) || K.ownTiers?.includes(id)) && !OWN_TIERS.has(id)) { S.tiers = []; OWN_TIERS.add(id); }
    for (const [t, names] of Object.entries(add)) (S.tiers[t] ??= []).push(...names);
  }
}
for (const id of OWN_TIERS) STYLES[id].tiers = STYLES[id].tiers.filter(t => t?.length);

SMALL_LOTS.push(...(K.smallLots?.kits ?? []).filter(k => KITS[k]));

// The pack's centre module builds its central landmark into a group at the centre. Its terrain module gets a group
// at the origin and replaces the flat ground, the slab and the water. build may return { update(t, dt) } for
// animation, and the centre's top sets its pin height.

export const LANDMARKS = [];
export let CENTRE_API = {};
if (SETTING.centre.module) {
  const mod = await import(inPack(SETTING.centre.module));
  if (mod.build) {
    centre.clear();
    const api = mod.build(H, centre) ?? {};
    centre.traverse(o => { o.userData.place = CENTRE_PLACE; });
    if (api.top && CENTRE_PLACE) CENTRE_PLACE.top = new THREE.Vector3(CENTRE.x, api.top, CENTRE.y);
    LANDMARKS.push(CENTRE_API = api);
  }
}
// Seats saved in GM edit mode (see below). Landmarks and places keep solid ground where the city's edge frays,
// before the pack's forest grows into it.

const SEATS = await fetch(atRoot(SETTING.data.seats), { cache: 'no-store' }).then(r => r.json()).catch(() => ({}));
for (const lm of LANDMARKS_KITS) keep(...(SEATS[`lm:${lm.name}`]?.at ?? mapToWorld(lm.at ?? [0, 0])), lm.free ? Math.hypot(lm.free[0], lm.free[1]) / 2 + 20 : 70);
for (const p of CITY.places ?? []) keep(...(SEATS[p.slug]?.at ?? p.at), 70);

// The city file's keep list holds more ground solid, as [x, z, r] circles, where hand-added lots meet the edge.

for (const [x, z, r] of CITY.keep ?? []) keep(x, z, r);

if (SETTING.terrain) {
  const mod = await import(inPack(SETTING.terrain));
  if (mod.build) {
    for (const m of [outerGround, slab, water]) { m.visible = false; SURFACE.splice(SURFACE.indexOf(m), 1); }
    const g = surface(new THREE.Group());

    // Terrain meshes arrive once the heightmap loads. They skip the ground holes like the flat ground.

    g.add = (...o) => { for (const m of o) if (m.isMesh && !m.isInstancedMesh) holed(m.material); return THREE.Group.prototype.add.apply(g, o); };
    LANDMARKS.push(mod.build(H, g) ?? {});
  }
}

// A pack's look.clouds lists cloud decks over its centre (clouds.js).

packClouds(H, SETTING.look.clouds);

// ---------- static merge ----------
// Place and landmark builds leave many small meshes, one draw call each, and kits often give each mesh its own
// material just for its colour. Once everything is built, static meshes from all build groups merge in world
// space, one mesh per material signature and 800 m chunk, so far chunks still cull. Each mesh's colour moves
// into vertex colours, so the merged mesh draws the same. Edit mode applies by reloading, so nothing moves a
// build group afterwards.
// A mesh stays apart when anything could move or tell it apart: groups with an update hook, nested meshes
// (pivots and movers live in subgroups), user data, custom render hooks, shader or patched materials (they
// may read object-space positions), a mirrored transform, or textured or strong transparency that is not
// additive. Faint untextured overlays merge, because their order among themselves cannot show. Softened
// materials merge too: their fade reads only normals and view positions, which baking keeps.

const HOOK = THREE.Object3D.prototype.onBeforeRender;
const MAPS = ['map', 'alphaMap', 'aoMap', 'emissiveMap', 'lightMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'bumpMap'];
const SKIP = new Set(['uuid', 'name', 'color', 'version', 'userData', 'vertexColors', 'id']);
const sigOf = m => JSON.stringify(Object.keys(m).filter(k => !SKIP.has(k) && !k.startsWith('_')).sort().map(k => {
  const v = m[k];
  return [k, v?.isTexture ? v.uuid : v?.isColor ? v.getHex() : typeof v === 'object' && v !== null ? String(v) : v];
}));
const STATIC_BUILDS = [], CHUNK = 800, _local = new THREE.Matrix4(), _c = new THREE.Vector3();
function mergeable(o) {
  const m = o.material;
  if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.children.length || !m || Array.isArray(m) || !m.visible || !m.color) return false;
  if (m.transparent && m.blending !== THREE.AdditiveBlending && (m.opacity > .5 || MAPS.some(k => m[k]))) return false;
  if (m.isShaderMaterial || (Object.hasOwn(m, 'onBeforeCompile') && !m.userData.soft) || o.onBeforeRender !== HOOK || Object.keys(o.userData).length) return false;
  return o.visible && !o.renderOrder && !o.geometry.morphAttributes.position && o.matrixWorld.determinant() > 0;
}
// Signs carry their own canvas texture each, so they could not merge. Their canvases copy into shared 2048 px
// atlas pages, each with an 8 px border of stretched edge pixels so far mip levels do not bleed into a
// neighbour, and their uvs move to the slot. Only plain canvas maps in static builds move, so no sign that
// redraws itself freezes.

const ATLAS = 2048, GUT = 8, pages = [], slots = new Map();
function atlasSlot(tex) {
  if (slots.has(tex)) return slots.get(tex);
  const img = tex.image, w = img.width, h = img.height;
  let page = pages.at(-1);
  const fits = p => p && (p.x + w + 2 * GUT <= ATLAS ? p.y + h + 2 * GUT <= ATLAS : p.y + p.row + h + 2 * GUT <= ATLAS);
  if (!fits(page)) {
    const c = document.createElement('canvas');
    c.width = c.height = ATLAS;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    page = { c, g: c.getContext('2d'), t, x: 0, y: 0, row: 0 };
    pages.push(page);
  }
  if (page.x + w + 2 * GUT > ATLAS) { page.x = 0; page.y += page.row; page.row = 0; }
  const x = page.x + GUT, y = page.y + GUT, g = page.g;
  g.drawImage(img, x, y);
  g.drawImage(img, 0, 0, 1, h, x - GUT, y, GUT, h); g.drawImage(img, w - 1, 0, 1, h, x + w, y, GUT, h);
  g.drawImage(page.c, x - GUT, y, w + 2 * GUT, 1, x - GUT, y - GUT, w + 2 * GUT, GUT);
  g.drawImage(page.c, x - GUT, y + h - 1, w + 2 * GUT, 1, x - GUT, y + h, w + 2 * GUT, GUT);
  page.x += w + 2 * GUT; page.row = Math.max(page.row, h + 2 * GUT);
  const slot = { t: page.t, x, y, w, h };
  slots.set(tex, slot);
  return slot;
}
function atlasSigns() {
  for (const g of STATIC_BUILDS) for (const o of g.children) {
    const m = o.material, tex = m?.map, img = tex?.image, uv = o.geometry?.attributes.uv;
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(m) || !img || !(img instanceof HTMLCanvasElement) || !uv || m.isShaderMaterial) continue;
    if (MAPS.some(k => k !== 'map' && m[k]) || img.width > ATLAS - 2 * GUT || img.height > ATLAS - 2 * GUT) continue;
    if (tex.repeat.x !== 1 || tex.repeat.y !== 1 || tex.offset.x || tex.offset.y || tex.rotation || tex.wrapS !== THREE.ClampToEdgeWrapping || tex.wrapT !== THREE.ClampToEdgeWrapping || !tex.flipY) continue;
    let inside = true;
    for (let i = 0; i < uv.count && inside; i++) inside = uv.getX(i) >= 0 && uv.getX(i) <= 1 && uv.getY(i) >= 0 && uv.getY(i) <= 1;
    if (!inside) continue;
    const { t, x, y, w, h } = atlasSlot(tex), geo = o.geometry.clone(), a = geo.attributes.uv;
    for (let i = 0; i < a.count; i++) a.setXY(i, (x + a.getX(i) * w) / ATLAS, 1 - (y + (1 - a.getY(i)) * h) / ATLAS);
    o.geometry = geo;
    o.material = m.clone();
    o.material.map = t;
  }
  for (const p of pages) p.t.needsUpdate = true;
}

function mergeBuilds() {
  atlasSigns();
  decor.updateMatrixWorld(true);
  const toDecor = new THREE.Matrix4().copy(decor.matrixWorld).invert(), sets = new Map();
  for (const g of STATIC_BUILDS) for (const o of g.children) {
    if (!mergeable(o)) continue;
    const m = o.material, geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(_local.multiplyMatrices(toDecor, o.matrixWorld));
    if (!MAPS.some(k => m[k])) for (const k of ['uv', 'uv1', 'uv2']) geo.deleteAttribute(k);
    const n = geo.attributes.position.count, c = new Float32Array(n * 3), src = geo.attributes.color;
    if (src && src.itemSize !== 3) { geo.dispose(); continue; }
    for (let i = 0; i < n; i++) {
      c[i * 3] = m.color.r * (src ? src.getX(i) : 1);
      c[i * 3 + 1] = m.color.g * (src ? src.getY(i) : 1);
      c[i * 3 + 2] = m.color.b * (src ? src.getZ(i) : 1);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    geo.computeBoundingSphere();
    _c.copy(geo.boundingSphere.center);
    const keys = Object.entries(geo.attributes).map(([k, a]) => `${k}${a.itemSize}${a.array.constructor.name}${a.normalized}`).sort().join();
    const k = `${sigOf(m)}|${!!m.userData.soft}|${keys}|${o.layers.mask}|${Math.floor(_c.x / CHUNK)},${Math.floor(_c.z / CHUNK)}`;
    if (!sets.has(k)) sets.set(k, { m, list: [], src: [] });
    sets.get(k).list.push(geo); sets.get(k).src.push(o);
  }
  for (const { m, list, src } of sets.values()) {
    const merged = list.length > 1 && mergeGeometries(list);
    for (const geo of list) geo.dispose();
    if (!merged) continue;
    for (const o of src) o.parent.remove(o);
    const mat = m.clone();
    mat.color.setRGB(1, 1, 1);
    mat.vertexColors = true;
    if (m.userData.soft) soften(mat);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.layers.mask = src[0].layers.mask;
    decor.add(mesh);
  }
}

// ---------- build ----------

buildPylons();
buildStations();

// Each place builds around the origin; FRAME and a parent group rotate and move it onto its seat,
// and every lot under its footprint is taken, even past the block edge.
// Seats come from places.json (GM edit mode writes it), then city.json, then meta.size:
//   at    world point [x, z] in metres
//   size  footprint [w, d] in metres, default the 68 m block
//   rot   radians, or null to take the block's rotation
//   snap  true seats the place on the nearest free large block within 260 m; false builds exactly at `at`
// A seat that is not a plain snapped block becomes its own frame in ALL_BLOCK_FRAMES, so block kits keep off it.

for (const p of PLACES) {
  if (SHOWCASE) break;
  const q = { ...CITY.places.find(c => c.slug === p.slug), ...SEATS[p.slug] };
  const [sw, sd] = q.size ?? p.size ?? [BLOCK, BLOCK], snap = q.snap !== false, rot = q.rot ?? null;
  if (q.at) [p.x, p.z] = q.at;

  // Place modules build their door on local +z. A snapped seat turns so that side faces the nearest street.
  // A snapped seat skips blocks where its footprint would meet the maglev or a highway.

  const turnOf = b => { const f = frontOf(b); return f.z > 0 ? 0 : f.z < 0 ? Math.PI : f.x > 0 ? Math.PI / 2 : -Math.PI / 2; };
  const clearSeat = b => { const a = rot ?? b.a + turnOf(b); return !corridorIn({ cx: b.cx, cz: b.cz, c: Math.cos(a), s: Math.sin(a) }, 4, sw, sd).length; };
  let block = null, best = SC.seatReach;
  if (snap) for (const b of ALL_BLOCK_FRAMES) {
    const d = Math.hypot(b.cx - p.x, b.cz - p.z);
    if (!b.used && Math.min(b.w, b.d) >= SC.siteMin && d < best && clearSeat(b)) { best = d; block = b; }
  }
  if (block) block.used = true;
  let turn = 0;
  if (block && rot === null) turn = turnOf(block);
  let site = block;
  if (!block || rot !== null || turn) {
    const a = rot ?? (block ? block.a + turn : 0);
    site = { cx: block?.cx ?? p.x, cz: block?.cz ?? p.z, a, c: Math.cos(a), s: Math.sin(a), w: sw, d: sd, used: true, seat: true };
    ALL_BLOCK_FRAMES.push(site);
  }
  site.size = [sw, sd];
  [p.x, p.z] = [site.cx, site.cz];
  p.frame = site;
  p.seat = { at: q.at ?? [p.x, p.z], size: [sw, sd], rot, snap, x: site.cx, z: site.cz, a: site.a, block };
  for (const f of FRAMES) {
    const X = f.cx - site.cx, Z = f.cz - site.cz;
    if (Math.abs(X * site.c - Z * site.s) < sw / 2 + 2 && Math.abs(X * site.s + Z * site.c) < sd / 2 + 2) f.taken = true;
  }
  const g = new THREE.Group();
  g.position.set(site.cx, groundAt(site.cx, site.cz), site.cz);
  g.rotation.y = site.a;
  decor.add(g);
  S.DECOR = g;
  S.FRAME = { cx: 0, cz: 0, tx: site.cx, tz: site.cz, a: site.a, c: site.c, s: site.s, w: sw, d: sd };
  p.top = new THREE.Vector3(p.x, p.build(H, p, 0, 0), p.z);
  STATIC_BUILDS.push(g);
  S.FRAME = null;
  S.DECOR = decor;
}

// Streets that cross a place's footprint close there. Cars turn back at its edge and street lamps keep off it.

for (const st of STREETS) st.block = new Uint8Array(st.path.length);
for (const { frame: f } of PLACES) if (f) for (const st of STREETS) st.path.forEach((q, k) => {
  const X = q.x - f.cx, Z = q.z - f.cz, [w, d] = f.size ?? [f.w, f.d];
  if (Math.abs(X * f.c - Z * f.s) < w / 2 && Math.abs(X * f.s + Z * f.c) < d / 2) st.block[k] = 1;
});
for (const c of traffic) if (!c.hover && c.st.block[Math.floor(c.u)]) c.rank = 2;

// Landmarks from kit modules claim the free block nearest their canon spot (map px) and build there like places.

export const LANDMARK_LABELS = [];

// One row per built landmark for search and the atlas. A landmark with a slug is a campaign location and gets a place for the card.

export const LANDMARK_SITES = [];
for (const lm of LANDMARKS_KITS) {
  if (SHOWCASE) break;

  // A seat saved in GM edit mode (places.json key `lm:<name>`) moves the landmark to the block nearest its world point.

  const moved = SEATS[`lm:${lm.name}`]?.at, [x, z] = moved ?? mapToWorld(lm.at ?? [0, 0]);

  // A landmark takes the nearest free block in its own district, clear of the maglev and the highways if it can.
  // With none in reach it takes the nearest block in another district, and warns for a corridor or no block.

  const home = CITY.districts.find(d => sdPoly(x, z, d.poly) > 0)?.poly;
  const seek = (clear, poly) => {
    let site = null, best = moved ? SC.seatReach : lm.reach ?? SC.landmarkReach;
    for (const b of ALL_BLOCK_FRAMES) {
      const d = Math.hypot(b.cx - x, b.cz - z);
      if (!b.used && Math.min(b.w, b.d) >= (lm.minSide ?? SC.siteMin) && d < best && (!poly || sdPoly(b.cx, b.cz, poly) > 0)
        && (!clear || !corridorIn(b, 4, Math.min(b.w, BLOCK_MAX), Math.min(b.d, BLOCK_MAX)).length)) { best = d; site = b; }
    }
    return site;
  };

  // hush r lowers the lots round the landmark out to r metres, so it stands clear of its neighbours.
  // A free landmark ([w, d, a]) stands at its point without a block, for a park or open ground. The optional a turns it.
  // claim: true makes it take the lots whose centres fall inside it, so a small one can replace a single lot.

  const fa = lm.free?.[2] ?? 0;
  let site = lm.free ? { cx: x, cz: z, a: fa, c: Math.cos(fa), s: Math.sin(fa), w: lm.free[0], d: lm.free[1] } : null;
  for (const poly of home ? [home, null] : [null]) for (const clear of [true, false]) {
    if (!site && (site = seek(clear, poly)) && !clear) console.warn('landmark over a corridor', lm.name);
  }
  if (!site) { console.warn('landmark without a site', lm.name); continue; }
  site.used = true;
  if (lm.hush) HUSH.push({ x: site.cx, z: site.cz, r: lm.hush });
  site.size = [Math.min(site.w, BLOCK_MAX), Math.min(site.d, BLOCK_MAX)];
  if (!lm.free || lm.claim) for (const f of FRAMES) if (inRect(site, f.cx, f.cz, 2)) f.taken = true;
  const g = new THREE.Group(), sy = lm.scaleY ?? 1, ly = (lm.labelY ?? SETTING.scale.labels.landmarkY) * sy;
  g.position.set(site.cx, groundAt(site.cx, site.cz), site.cz);
  g.rotation.y = site.a;
  g.scale.y = sy;
  decor.add(g);
  S.DECOR = g;
  S.FRAME = { cx: 0, cz: 0, tx: site.cx, tz: site.cz, a: site.a, c: site.c, s: site.s, w: site.w, d: site.d, front: site.front ?? frontOf(site), sy: lm.scaleY };
  const focus = lm.build(0, 0, Math.min(site.w, BLOCK_MAX) - 4, Math.min(site.d, BLOCK_MAX) - 4, styleAt(site.cx, site.cz, U.uBlend.value), rng(hash(Math.round(site.cx), 31)));

  // A build that puts its showpiece away from the block (a club offshore) returns that spot in local metres,
  // as [lx, lz] or { focus: [lx, lz] }. The label, the click box and the card's camera then go there.
  // An optional span (metres, default 90) sets how much ground round the focus the card's camera frames.

  const [lx, lz] = (Array.isArray(focus) ? focus : focus?.focus) ?? [0, 0];
  const fx = site.cx + lx * site.c + lz * site.s, fz = site.cz - lx * site.s + lz * site.c;
  const span = focus?.span ?? 90, view0 = lx || lz ? { ...site, cx: fx, cz: fz, w: span, d: span } : site;

  // A face [lx, lz] is the local side the card's camera looks from, where the build shows its logo or front.
  // It comes from the build's { face } return, else the landmark's face field.

  const face = focus?.face ?? lm.face, view = face ? { ...view0, face } : view0;

  // A build that sinks below grade returns hole: [w, d], a rectangle round its local origin. The ground opens there.

  if (focus?.hole) addHole(site.cx, site.cz, site.a, ...focus.hole);
  if (!lm.update) STATIC_BUILDS.push(g);
  S.FRAME = null;
  S.DECOR = decor;
  if (lm.update) LANDMARKS.push(lm);
  const el = lm.label && label(lm.label, 'district landmark', new THREE.Vector3(fx, ly, fz));
  if (el) LANDMARK_LABELS.push(el);
  const place = lm.slug && { slug: lm.slug, title: lm.label, district: '', type: 'Landmark', summary: '', color: SETTING.look.cardColor, top: new THREE.Vector3(fx, ly + groundAt(fx, fz), fz), frame: view };

  // Kit geometry lands in shared instanced meshes, so an unseen box over the site takes the clicks.

  if (place) {
    const pick = new THREE.Mesh(new THREE.BoxGeometry(Math.min(site.w, BLOCK_MAX) - 4, ly / sy, Math.min(site.d, BLOCK_MAX) - 4), new THREE.MeshBasicMaterial({ visible: false }));
    pick.position.set(lx, ly / sy / 2, lz);
    pick.userData.place = place;
    g.add(pick);
  }
  LANDMARK_SITES.push({ name: lm.label ?? lm.name, key: lm.name, x: fx, z: fz, y: ly, frame: view, el, place, block: lm.free ? null : site, at: [x, z], minSide: lm.minSide ?? SC.siteMin });
}
if (!SHOWCASE) { mergeBuilds(); LANDMARKS.push(fillGreens(H)); }
S.BASE = new Map(INSTANCED.map(m => [m, m.count]));
S.BASE.set(SOIL, SOIL.length);
loadMsg('Building the city');

// A short pause lets the loading message paint. A timeout also runs in background tabs, where animation frames stop.

await new Promise(r => setTimeout(r, 40));
if (SHOWCASE) showcase(SHOWCASE); else generate(U.uBlend.value);

