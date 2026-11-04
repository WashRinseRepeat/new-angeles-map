// The Beinhaus of St. Sebald (an ossuary crypt under the church) and the Felsengänge, the rock-cut beer cellars
// of the old town, four levels deep. Bones, barrels, ice and candlelight, all lit through the dungeon toolkit.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const RED = [.5, .3, .22], FLR = [.4, .27, .2], ASH = [.52, .34, .26], PALE = [1.25, .95, .6], ICE = [.35, .65, 1];
const PI = Math.PI;
let seed = 11;
const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
const ni = g => g.index ? g.toNonIndexed() : g;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Shared geometry.

const SKULL = ni(new THREE.IcosahedronGeometry(.1, 0).scale(1, 1.08, .95));
const BONE = ni(mergeGeometries([new THREE.BoxGeometry(.5, .045, .045), new THREE.BoxGeometry(.07, .085, .085).translate(.25, 0, 0), new THREE.BoxGeometry(.07, .085, .085).translate(-.25, 0, 0)].map(ni)));
const ENDS = ni(mergeGeometries([ni(new THREE.CylinderGeometry(.035, .035, .22, 5, 1, true).rotateX(PI / 2).translate(0, 0, .11)), ni(new THREE.CircleGeometry(.035, 5).translate(0, 0, .22))]));
const HEAP = ni(new THREE.IcosahedronGeometry(1, 1).scale(1, .5, .8));
const LUMP = ni(new THREE.IcosahedronGeometry(1, 0));
const HOOP = ni(new THREE.CylinderGeometry(1, 1, .12, 10, 1, true).rotateZ(PI / 2));
const HOOPV = ni(new THREE.CylinderGeometry(1, 1, .1, 14, 1, true));
const KETTLE = ni(new THREE.SphereGeometry(1, 10, 8).scale(1, .75, 1));
const HEAD = ni(new THREE.IcosahedronGeometry(.12, 1));
const WHEEL = ni(new THREE.CylinderGeometry(.32, .32, .1, 10).rotateX(PI / 2));
const barrelGeos = new Map();
const barrelGeo = (r, len) => {
  const k = r.toFixed(2) + len.toFixed(2), h = len / 2;
  if (!barrelGeos.has(k)) barrelGeos.set(k, ni(new THREE.LatheGeometry([[0, -h], [r * .9, -h], [r * .97, -h * .55], [r, 0], [r * .97, h * .55], [r * .9, h], [0, h]].map(([a, b]) => new THREE.Vector2(a, b)), 12).rotateZ(PI / 2)));
  return barrelGeos.get(k);
};

// A soft additive disc for mist and smoke, cut like the dungeon.

function softMat(D, rgb, a) {
  return new THREE.ShaderMaterial({
    uniforms: { uCut: D.cut, uC: { value: new THREE.Color(...rgb) }, uA: { value: a } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; varying float vY;
      void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uCut, uA; uniform vec3 uC; varying vec2 vUv; varying float vY;
      void main() {
        if (vY > uCut) discard;
        float d = length(vUv - .5) * 2., a = (1. - smoothstep(0., 1., d)) * uA;
        gl_FragColor = vec4(uC, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// A flat disc on the floor that the tick moves.

function disc(D, rgb, a, r, x, y, z) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20).rotateX(-PI / 2), softMat(D, rgb, a));
  m.position.set(x, y, z); m.frustumCulled = false;
  D.add(m);
  return m;
}

// A niche in a wall: stone frame, dark back, a candle and a small figure. (nx, nz) points into the room.

function niche(D, x, y, z, nx, nz, o = {}) {
  D.frame(x, z, Math.atan2(nx, nz), () => {
    const w = o.w ?? 1.1, h = o.h ?? 1.7, rgb = o.rgb ?? ASH;
    for (const s of [-1, 1]) D.box(s * (w / 2 + .12), y, .12, .24, h + .25, .26, 'ashlar', { rgb });
    D.box(0, y + h, .12, w + .6, .28, .3, 'ashlar', { rgb });
    D.box(0, y - .12, .14, w + .5, .14, .34, 'ashlar', { rgb });
    D.box(0, y, .04, w, h, .06, 'iron', { rgb: [.05, .045, .045], jit: 0 });
    if (o.skull) { D.geo(SKULL, 'bone', { at: [0, y + .42, .22], scale: 1.9 }); D.geo(SKULL, 'bone', { at: [.3, y + .16, .2], scale: 1.1 }); D.geo(SKULL, 'bone', { at: [-.3, y + .16, .2], scale: 1.1 }); }
    else { D.cyl(0, y, .24, .2, .7, 'plaster', { seg: 6, r1: .1 }); D.geo(HEAD, 'plaster', { at: [0, y + .85, .24], rgb: [.7, .62, .5] }); }
    D.candle(w / 2 - .22, y, .26, { r: o.r ?? 3.4, rgb: o.rgb2 });
  });
}

// A wall of rough boulders along a line, to break up flat stone. (nx, nz) points into the room.

function lumps(x0, z0, x1, z1, nx, nz, y, h, n, D, rgb = RED) {
  for (let i = 0; i < n; i++) {
    const u = rnd();
    D.geo(LUMP, 'rock', { at: [x0 + (x1 - x0) * u + nx * .1, y + rnd() * h, z0 + (z1 - z0) * u + nz * .1], scale: .22 + rnd() * .35, rot: rnd() * 6, rgb });
  }
}

export default function build(D, Z) {
  for (const f of [ossuary, felsen]) {
    try { f(D, Z); } catch (e) { console.error('catacombs: cellars', f.name, e); }
  }
}

// ---------- Beinhaus of St. Sebald ----------

function ossuary(D, Zs) {
  const Z = Zs.ossuary, F = Z.floor, BW = [.44, .4, .31], BF = [.34, .31, .26], BN = [.5, .47, .4];
  const A = { x: -117, z: -160, w: 26, d: 20, h: 4.4 }, B = { x: -83, z: -160, w: 34, d: 30, h: 4.8 }, C = { x: -51, z: -160, w: 22, d: 14, h: 4.4 };
  const AC = { x: -51, z: -148.2, w: 10, d: 8, h: 4.2 };
  const door = (side, at = 0, w = 3, h = 3) => ({ side, at, w, h });
  const room = (r, doors) => D.room(r.x, r.z, F, r.w, r.d, r.h, { wall: 'bone', rgb: BW, floor: 'flag', floorRgb: BF, doors });
  const torch = (x, y, z, nx, nz) => D.torch(x, y, z, nx, nz, { rgb: PALE, r: 9 });

  // A wall of a room as a local frame. u(c) turns a world coordinate along the wall into a distance from the wall's start.

  function wallFrame(r, side) {
    const { x, z, w, d } = r;
    return {
      n: { p: [x - w / 2, z - d / 2], n: [0, 1], L: w, u: c => c - (x - w / 2) },
      s: { p: [x + w / 2, z + d / 2], n: [0, -1], L: w, u: c => x + w / 2 - c },
      w: { p: [x - w / 2, z + d / 2], n: [1, 0], L: d, u: c => z + d / 2 - c },
      e: { p: [x + w / 2, z - d / 2], n: [-1, 0], L: d, u: c => c - (z - d / 2) },
    }[side];
  }

  // Bone stacks on a wall, bottom row first. S skulls, E bone ends, L long bones. skips lists world ranges left bare.

  function clad(r, side, rows, skips = []) {
    const f = wallFrame(r, side), gaps = skips.map(([a, b]) => [Math.min(f.u(a), f.u(b)), Math.max(f.u(a), f.u(b))]);
    const ok = u => !gaps.some(([a, b]) => u > a && u < b);
    D.frame(f.p[0], f.p[1], Math.atan2(f.n[0], f.n[1]), () => {
      rows.forEach((k, i) => {
        const y = F + .16 + i * .3;
        if (k === 'S') for (let u = .2 + (i % 2) * .17; u < f.L - .1; u += .34) ok(u) && D.geo(SKULL, 'bone', { at: [u, y + .02, .12], rot: (rnd() - .5) * 1.2, scale: 1.25 + rnd() * .3, jit: .1 });
        if (k === 'E') for (let u = .08; u < f.L; u += .22) ok(u) && D.geo(ENDS, 'bone', { at: [u, y + (rnd() - .5) * .05, .02], scale: 1.1 + rnd() * .5, jit: .1 });
        if (k === 'L') for (let u = .4; u < f.L - .3; u += .8) ok(u) && D.geo(BONE, 'bone', { at: [u + (rnd() - .5) * .08, y, .08], rot: (rnd() - .5) * .25, scale: 1.45 + rnd() * .2, jit: .1 });
      });
    });
  }

  // A cross of skulls inside a ring of skulls, centred on world coordinate c along the wall.

  function emblem(r, side, c) {
    const f = wallFrame(r, side), u0 = f.u(c), cy = F + 3;
    D.frame(f.p[0], f.p[1], Math.atan2(f.n[0], f.n[1]), () => {
      const sk = (u, y, s = 1.15) => D.geo(SKULL, 'bone', { at: [u, y, .12], rot: (rnd() - .5) * .8, scale: s, jit: .08 });
      for (let k = -4; k <= 5; k++) sk(u0, cy + k * .26);
      for (let k = -4; k <= 4; k++) if (k) sk(u0 + k * .26, cy + .52);
      for (let k = 0; k < 18; k++) { const a = k / 18 * PI * 2; sk(u0 + Math.cos(a) * 1.9, cy + Math.sin(a) * 1.9, .95); }
      for (const s of [-1, 1]) D.geo(BONE, 'bone', { at: [u0 + s * 2.6, cy - .9, .08], scale: 1.4 });
    });
  }

  // A pillar wound with rings of skulls.

  function pillar(x, z, h = 3.6) {
    D.box(x, F, z, 1.5, .3, 1.5, 'ashlar', { rgb: [.5, .46, .38] });
    D.cyl(x, F + .3, z, .55, h - .6, 'bone', { seg: 10, rgb: [.55, .5, .4] });
    D.box(x, F + h - .3, z, 1.5, .3, 1.5, 'ashlar', { rgb: [.5, .46, .38] });
    for (const hh of [.7, 1.3, 1.9, 2.5]) for (let k = 0; k < 9; k++) { const a = k / 9 * PI * 2 + hh; D.geo(SKULL, 'bone', { at: [x + Math.cos(a) * .6, F + hh, z + Math.sin(a) * .6], rot: -a, scale: 1.05 }); }
  }

  const heap = (x, z, r) => {
    D.geo(HEAP, 'bone', { at: [x, F - .12, z], scale: r, rgb: [.5, .45, .36] });
    for (let k = 0; k < 9; k++) {
      const a = rnd() * 6.28, d = rnd() * r * .8, hy = F - .12 + .5 * r * Math.sqrt(Math.max(0, 1 - (d / r) ** 2));
      D.geo(SKULL, 'bone', { at: [x + Math.cos(a) * d, hy + .04, z + Math.sin(a) * d * .8], rot: rnd() * 6, scale: 1 + rnd() * .3 });
    }
    for (let k = 0; k < 10; k++) { const a = rnd() * 6.28, d = rnd() * r * .7; D.geo(BONE, 'bone', { at: [x + Math.cos(a) * d, F + .2 + rnd() * r * .3, z + Math.sin(a) * d * .8], rot: rnd() * 6, scale: 1.1 + rnd() * .5 }); }
  };

  // A stone sarcophagus with a gabled lid, a skull and crossed bones. rot turns it.

  function sarcophagus(x, z, rot) {
    D.frame(x, z, rot, () => {
      D.box(0, F, 0, 2.7, .95, 1.1, 'ashlar', { rgb: [.5, .46, .4] });
      D.box(0, F + .95, 0, 2.9, .12, 1.3, 'ashlar', { rgb: [.54, .5, .44] });
      D.frame(0, 0, PI / 2, () => {
        D.slab(-.31, F + 1.27, 0, .75, .1, 2.8, .5, 'ashlar', [.52, .48, .42]);
        D.slab(.31, F + 1.27, 0, .75, .1, 2.8, -.5, 'ashlar', [.52, .48, .42]);
      });
      D.geo(SKULL, 'bone', { at: [-.95, F + 1.2, 0], scale: 1.5 });
      D.geo(BONE, 'bone', { at: [.2, F + 1.5, 0], rot: .7, scale: 1.7 });
      D.geo(BONE, 'bone', { at: [.2, F + 1.5, 0], rot: -.7, scale: 1.7 });
      for (const s of [-1, 1]) D.candle(1.55, F, s * .8, { r: 5 });
    });
  }

  // Rooms. The three halls run west to east along z -160.

  room(A, [door('w'), door('e')]);
  room(B, [door('w'), door('e'), door('n', -.53), door('n', .53), door('s', -.53), door('s', .53)]);
  room(C, [door('w'), door('e'), door('s')]);
  room(AC, [door('n')]);
  D.tunnel([[-145, F, -160], [-138, F, -160], [-130.4, F, -160]], { w: 3, h: 3.4, wall: 'bone', rgb: BW, floorRgb: BF, torches: 7, torchRgb: PALE });
  D.tunnel([[-104.3, F, -160], [-99.7, F, -160]], { w: 3, h: 3.4, wall: 'bone', rgb: BW, floorRgb: BF });
  D.tunnel([[-66.3, F, -160], [-61.7, F, -160]], { w: 3, h: 3.4, wall: 'bone', rgb: BW, floorRgb: BF });
  D.tunnel([[-39.6, F, -160], [-32, F, -160], [-25, F, -160]], { w: 3, h: 3.4, wall: 'bone', rgb: BW, floorRgb: BF, torches: 7, torchRgb: PALE });
  const chapels = [[-92, -179.8, 's', 'n'], [-74, -179.8, 's', 'n'], [-92, -140.2, 'n', 's'], [-74, -140.2, 'n', 's']];
  for (const [x, z, dside, back] of chapels) {
    const r = { x, z, w: 10, d: 8, h: 4.2 };
    room(r, [door(dside)]);
    clad(r, back, ['S', 'L', 'S']);
    sarcophagus(x, z, 0);
    torch(x, F + 3.2, z + (back === 'n' ? -3.85 : 3.85), 0, back === 'n' ? 1 : -1);
    D.arch(x, F + 3, z, 8, 1, { rot: 0, mat: 'ashlar', rgb: [.5, .46, .38] });
  }

  // A: the charnel gallery, with bone pillars, vault ribs and wall stacks.

  clad(A, 'n', ['S', 'L', 'S']); clad(A, 's', ['S', 'L', 'S']);
  for (const x of [-124, -110]) for (const z of [-166, -154]) pillar(x, z);
  for (const x of [-124, -110]) D.arch(x, F + 3, -160, 20, 1.4, { rot: PI / 2, mat: 'ashlar', rgb: [.5, .46, .38] });
  for (const z of [-166, -154]) D.arch(-117, F + 3, z, 26, 1.4, { rot: 0, mat: 'ashlar', rgb: [.5, .46, .38] });
  for (const x of [-124, -110]) { torch(x, F + 3.3, -169.85, 0, 1); torch(x, F + 3.3, -150.15, 0, -1); }
  for (const z of [-167, -153]) { niche(D, -129.85, F + .9, z, 1, 0, { rgb: BN, skull: true }); niche(D, -104.15, F + .9, z, -1, 0, { rgb: BN, skull: true }); }
  for (const [x, z] of [[-127, -156], [-107, -164], [-120, -168]]) heap(x, z, 1.3);
  emblem(A, 'n', -117); emblem(A, 's', -117);

  // B: the central ossuary, with walls of bones, bone heaps and a chandelier of bones.

  const gate = c => [c - 1.7, c + 1.7];
  clad(B, 'w', ['S', 'L', 'S', 'L'], [gate(-160)]); clad(B, 'e', ['S', 'L', 'S', 'L'], [gate(-160)]);
  clad(B, 'n', ['S', 'L', 'S'], [gate(-92), gate(-74)]); clad(B, 's', ['S', 'L', 'S'], [gate(-92), gate(-74)]);
  emblem(B, 'n', -83); emblem(B, 's', -83);
  for (const [x, z, r] of [[-97.5, -172.5, 2.2], [-68.5, -172.5, 1.9], [-97.5, -147.5, 1.9], [-68.5, -147.5, 2.2]]) heap(x, z, r);
  for (const x of [-95, -83, -71]) D.arch(x, F + 3.2, -160, 30, 1.6, { rot: PI / 2, mat: 'ashlar', rgb: [.5, .46, .38] });
  D.arch(-83, F + 3.2, -160, 34, 1.6, { rot: 0, mat: 'ashlar', rgb: [.5, .46, .38] });
  for (const x of [-97, -69]) { torch(x, F + 3.4, -174.85, 0, 1); torch(x, F + 3.4, -145.15, 0, -1); }
  for (const z of [-170, -150]) { torch(-99.85, F + 3.4, z, 1, 0); torch(-66.15, F + 3.4, z, -1, 0); }
  for (const z of [-168, -152]) { niche(D, -99.85, F + .9, z + (z < -160 ? -5 : 5) * 0, 1, 0, { rgb: BN, skull: true, w: 1.3 }); niche(D, -66.15, F + .9, z, -1, 0, { rgb: BN, skull: true, w: 1.3 }); }

  // The mosaic circle, its ring of skulls and the chandelier hanging from the crossed ribs.

  const cx = -83, cz = -160, cy = F + 2.5;
  D.floorPoly(Array.from({ length: 20 }, (_, k) => [cx + Math.cos(k / 20 * PI * 2) * 3.4, cz + Math.sin(k / 20 * PI * 2) * 3.4]), F + .03, 'bone', { rgb: [.5, .45, .36] });
  for (let k = 0; k < 14; k++) { const a = k / 14 * PI * 2; D.geo(SKULL, 'bone', { at: [cx + Math.cos(a) * 3.1, F + .12, cz + Math.sin(a) * 3.1], rot: -a, scale: 1.15 }); D.candle(cx + Math.cos(a + .22) * 3.1, F, cz + Math.sin(a + .22) * 3.1, { light: false }); }
  D.box(cx - .03, cy + .2, cz - .03, .06, 2.1, .06, 'iron', { jit: 0 });
  for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2; D.geo(BONE, 'bone', { at: [cx + Math.cos(a) * 1.5, cy, cz + Math.sin(a) * 1.5], rot: -(a + PI / 2), scale: 1.5 }); }
  for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2 + .4; D.geo(BONE, 'bone', { at: [cx + Math.cos(a) * .75, cy, cz + Math.sin(a) * .75], rot: -a, scale: 1.5 }); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2 + .2; D.candle(cx + Math.cos(a) * 1.5, cy + .03, cz + Math.sin(a) * 1.5, { light: k % 2 === 0, r: 7 }); }
  D.box(cx - .03, cy - 1.15, cz - .03, .06, 1.15, .06, 'bone', { jit: 0 });
  D.geo(SKULL, 'bone', { at: [cx, cy - 1.35, cz], scale: 2.2 });
  for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2 + .78; D.box(cx + Math.cos(a) * 1.5 - .015, cy - .6, cz + Math.sin(a) * 1.5 - .015, .03, .6, .03, 'iron', { jit: 0 }); D.geo(SKULL, 'bone', { at: [cx + Math.cos(a) * 1.5, cy - .7, cz + Math.sin(a) * 1.5], scale: 1.3 }); }
  D.light(cx, cy + .8, cz, PALE, 16);

  // C: the Dance of Death along the north wall, light and dark panels with skeletons and their partners.

  clad(C, 's', ['S', 'L', 'S'], [gate(-51)]);
  for (const x of [-58, -51, -44]) D.arch(x, F + 3.1, -160, 14, 1.2, { rot: PI / 2, mat: 'ashlar', rgb: [.5, .46, .38] });
  for (const x of [-57, -45]) torch(x, F + 3.1, -153.15, 0, -1);
  torch(-61.85, F + 3.1, -160, 1, 0); torch(-40.15, F + 3.1, -160, -1, 0);
  D.box(-51, F + .3, -166.85, 21.6, .18, .22, 'ashlar', { rgb: [.5, .46, .38] });
  D.box(-51, F + 3.25, -166.85, 21.6, .22, .22, 'ashlar', { rgb: [.5, .46, .38] });
  const victims = [[[.7, .12, .1], 'crown', .95], [[.85, .8, .7], 'mitre', 1], [[.12, .3, .6], 'cap', .6], [[.2, .45, .2], 'hood', .9], [[.3, .3, .35], 'helm', 1], [[.55, .1, .35], 'crown', 1.0], [[.6, .5, .12], 'cap', .9]];
  const skeleton = (x, y0, z) => {
    const dk = [.22, .2, .17], bn = (a, b, c, w, h, d, o) => D.box(x + a, y0 + b, z + c, w, h, d, 'bone', { rgb: dk, jit: 0, ...o });
    D.slab(x - .13, y0 + .5, z, .08, 1, .08, .2, 'bone', dk); D.slab(x + .15, y0 + .5, z, .08, 1, .08, -.28, 'bone', dk);
    bn(-.18, .95, 0, .36, .12, .1); bn(-.03, 1.05, 0, .06, .55, .06);
    for (let k = 0; k < 3; k++) bn(-.2, 1.2 + k * .1, 0, .4, .05, .07);
    D.slab(x - .36, y0 + 1.6, z, .07, .55, .07, .6, 'bone', dk); D.slab(x + .38, y0 + 1.6, z, .07, .55, .07, -.95, 'bone', dk);
    D.geo(SKULL, 'bone', { at: [x, y0 + 1.82, z], scale: 1.2, rgb: dk });
    for (const s of [-1, 1]) bn(s * .045 - .02, 1.82, .1, .04, .04, .04, { rgb: [.02, .02, .02] });
  };
  const person = (x, y0, z, [rgb, hat, s]) => {
    D.geo(ni(new THREE.CylinderGeometry(.17 * s, .3 * s, 1.25 * s, 7)), 'cloth', { at: [x, y0 + .62 * s, z], rgb });
    D.geo(HEAD, 'plaster', { at: [x, y0 + 1.38 * s, z], rgb: [.78, .6, .5], scale: s });
    const hy = y0 + 1.5 * s;
    if (hat === 'mitre') D.geo(ni(new THREE.ConeGeometry(.15 * s, .45 * s, 5)), 'gold', { at: [x, hy + .2 * s, z] });
    if (hat === 'crown') D.geo(ni(new THREE.CylinderGeometry(.13 * s, .11 * s, .14 * s, 6)), 'gold', { at: [x, hy + .02, z] });
    if (hat === 'helm') D.geo(ni(new THREE.SphereGeometry(.14 * s, 6, 4, 0, PI * 2, 0, PI / 2)), 'iron', { at: [x, hy - .06, z] });
    if (hat === 'cap') D.geo(ni(new THREE.CylinderGeometry(.06 * s, .13 * s, .1 * s, 6)), 'cloth', { at: [x, hy, z], rgb: [.5, .1, .1] });
    if (hat === 'hood') D.geo(ni(new THREE.ConeGeometry(.16 * s, .3 * s, 5)), 'cloth', { at: [x, hy, z], rgb: rgb.map(c => c * .6) });
    D.slab(x + .3 * s, y0 + 1 * s, z, .07, .5 * s, .07, -.7, 'cloth', rgb);
  };
  for (let i = 0; i < 14; i++) {
    const px = -61.25 + i * 1.5, light = i % 2 === 0;
    D.box(px, F + .48, -166.9, 1.44, 2.77, .12, 'plaster', { rgb: light ? [.74, .68, .52] : [.15, .11, .09], jit: .02 });
    if (light) skeleton(px, F + .55, -166.7); else person(px, F + .55, -166.7, victims[(i >> 1) % victims.length]);
  }

  // The altar chapel south of C: a bone altar with candles, a cross of skulls above and drifting incense.

  clad(AC, 'w', ['S']); clad(AC, 'e', ['S']);
  D.box(-51, F, -145.4, 3.4, 1, 1.3, 'ashlar', { rgb: [.5, .46, .4] });
  D.box(-51, F + 1, -145.4, 3.7, .12, 1.5, 'ashlar', { rgb: [.54, .5, .44] });
  D.box(-51, F + 1.12, -145.4, 2.9, .03, 1.1, 'cloth', { rgb: [.3, .05, .06] });
  D.box(-51, F + .25, -146.06, 3.1, .6, .06, 'iron', { rgb: [.07, .06, .05], jit: 0 });
  D.frame(-51 + 1.55, -146.1, PI, () => { for (let r = 0; r < 2; r++) for (let u = 0; u < 3.1; u += .27) D.geo(SKULL, 'bone', { at: [u, F + .35 + r * .27, .02], scale: 1.1 }); });
  D.box(-51.06, F + 1.1, -144.6, .12, 2.3, .1, 'bone', { jit: 0 }); D.box(-51.6, F + 2.3, -144.6, 1.1, .1, .1, 'bone', { jit: 0 });
  D.geo(SKULL, 'bone', { at: [-51, F + 2.35, -144.5], scale: 1.8 });
  emblem(AC, 's', -51);
  for (let k = 0; k < 6; k++) D.candle(-52.7 + k * .68, F + 1.15, -145.4, { light: k % 2 === 0, r: 6 });
  D.brazier(-54.2, F, -146, { rgb: PALE, r: 10, size: .9 }); D.brazier(-47.8, F, -146, { rgb: PALE, r: 10, size: .9 });
  D.box(-51, F + .02, -151, 2, .02, 7, 'cloth', { rgb: [.28, .05, .06], jit: 0 });
  D.arch(-51, F + 2.9, -148.2, 10, 1.2, { rot: 0, mat: 'ashlar', rgb: [.5, .46, .38] });
  niche(D, -55.85, F + .9, -149, 1, 0, { rgb: BN, skull: true }); niche(D, -46.15, F + .9, -149, -1, 0, { rgb: BN, skull: true });
  const smoke = Array.from({ length: 6 }, (_, i) => disc(D, [.8, .8, .85], .14, .5, -51 + (rnd() - .5) * .4, F + 1.3, -145.4));
  D.tick(t => smoke.forEach((m, i) => {
    const u = (t * .12 + i / smoke.length) % 1;
    m.position.set(-51 + Math.sin(t * .6 + i) * .3 * u, F + 1.4 + u * 2.6, -145.4 + Math.cos(t * .5 + i * 2) * .3 * u);
    m.scale.setScalar(.6 + u * 1.6);
    m.material.uniforms.uA.value = .16 * Math.sin(u * PI);
  }));

  D.label('Beinhaus of St. Sebald', -83, F + 6, -160);
  D.label('Charnel Gallery', -117, F + 5, -160, 'district quarter under');
  D.label('Chandelier of Bones', -83, F + 4.5, -150, 'district quarter under');
  D.label('Totentanz', -51, F + 5, -162, 'district quarter under');
  D.label('Altar of the Dead', -51, F + 5, -147, 'district quarter under');
}

// ---------- Felsengänge ----------

function felsen(D, Zs) {
  const Z = Zs.felsen, F1 = 18, F2 = 11, F3 = 4, F4 = -14;
  const door = (side, at = 0, w = 3, h = 3.6) => ({ side, at, w, h });
  const hall = (x, z, y, w, d, h, doors, o = {}) => D.room(x, z, y, w, d, h, { wall: 'rock', rgb: RED, floor: 'flag', floorRgb: FLR, doors, ...o });
  const hew = (pts, o = {}) => D.tunnel(pts, { w: 3.4, h: 4, wall: 'rock', rgb: RED, floor: 'flag', floorRgb: FLR, rough: .2, ...o });
  const rib = (x, y, z, span, rise, rot) => D.arch(x, y, z, span, rise, { rot, mat: 'ashlar', rgb: ASH, thick: .5, depth: .6 });

  // A hewn stair along local +x after rot, with side walls. Returns its length.

  function stair(x, z, y0, y1, rot, w = 2.4) {
    const n = Math.round(Math.abs(y1 - y0) / .22), tr = .32, dy = (y1 - y0) / n, lo = Math.min(y0, y1);
    D.frame(x, z, rot, () => {
      for (let k = 0; k < n; k++) D.box(k * tr + tr / 2, lo - .2, 0, tr, Math.min(y0 + dy * k, y0 + dy * (k + 1)) - lo + .2 + Math.abs(dy), w, 'ashlar', { rgb: ASH, jit: .03 });
      for (const s of [-1, 1]) D.box(n * tr / 2, lo, s * (w / 2 + .3), n * tr, Math.abs(y1 - y0) + 2.6, .6, 'rock', { rgb: RED });
    });
    return n * tr;
  }

  // A ring of hewn wall round (cx, cz), open at the mouths (angles, a multiple of a quarter turn). half widens each mouth.

  function ringWall(cx, cz, rad, y, h, N, mouths, half, mat, o) {
    const sp = PI * 2 / N, pts = [], gap = [];
    for (let k = 0; k < N; k++) {
      const a = -k * sp, rr = rad(a);
      pts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]);
      gap.push(mouths.some(m => Math.abs(Math.atan2(Math.sin(a - m), Math.cos(a - m))) < (half + .5) * sp));
    }
    const i0 = gap.indexOf(true);
    if (i0 < 0) return D.wall(pts, y, h, mat, { closed: true, ...o });
    let run = [];
    for (let j = 1; j <= N; j++) {
      const i = (i0 + j) % N;
      if (gap[i]) { if (run.length > 1) D.wall(run, y, h, mat, o); run = []; } else run.push(pts[i]);
    }
    if (run.length > 1) D.wall(run, y, h, mat, o);
  }

  // A natural cave with a floor and mouths for the tunnels.

  function cave(cx, cz, y, r, h, mouths = [], o = {}) {
    const N = Math.max(24, Math.round(PI * r / 4) * 4), ph = rnd() * 6;
    const rad = a => r * (1 + Math.min(1, ...mouths.map(m => smooth(0, .7, Math.abs(Math.atan2(Math.sin(a - m), Math.cos(a - m)))))) * (.1 * Math.sin(3 * a + ph) + .06 * Math.sin(5 * a + 2 * ph) + .03 * Math.sin(9 * a + ph)));
    D.floorPoly(Array.from({ length: N }, (_, k) => { const a = k / N * PI * 2; return [cx + Math.cos(a) * rad(a), cz + Math.sin(a) * rad(a)]; }), y, o.floor ?? 'rock', { rgb: FLR, bump: o.bump ?? .15 });
    ringWall(cx, cz, rad, y, h, N, mouths, 0, 'rock', { thick: 1.4, rough: .3, rgb: o.rgb ?? RED });
  }

  // Lager barrels lying on cradles, axis along local x after rot.

  function barrel(x, z, y, rot, r = 1.35, len = 3.4, rgb = [.55, .35, .2]) {
    D.frame(x, z, rot, () => {
      const cy = y + .35 + r;
      D.geo(barrelGeo(r, len), 'wood', { at: [0, cy, 0], rgb, jit: .12 });
      for (const u of [-.36, -.13, .13, .36]) D.geo(HOOP, 'iron', { at: [u * len, cy, 0], scale: r + .02 });
      for (const u of [-.3, .3]) D.box(u * len, y, 0, .4, .38, r * 1.7, 'wood');
      D.box(len / 2 + .07, cy - .3, 0, .14, .12, .12, 'gold', { jit: 0 });
    });
  }
  const trough = (x, y, z, rot = 0) => D.frame(x, z, rot, () => {
    D.box(0, y, 0, 2.4, .45, .7, 'wood'); D.box(0, y + .45, 0, 2.1, .02, .4, 'iron', { rgb: [.07, .06, .05], jit: 0 });
    D.cyl(.8, y + .45, .1, .09, .22, 'iron', { seg: 6 }); D.cyl(-.5, y + .45, -.1, .09, .2, 'iron', { seg: 6 });
  });
  const sack = (x, y, z, rot) => D.box(x, y, z, .9, .35, .55, 'cloth', { rgb: [.55, .46, .3], rot });

  // ---- Level I (+18): the entry, the Lagerhalle and the hop loft with the brewer's chute ----

  hew([[-200, F1, -330], [-200, F1, -304]], { w: 3.2, h: 4.6, torches: 8 });
  hall(-200, -296, F1, 80, 16, 5.6, [door('n', 0, 3.2, 4.2), door('s', .85), door('w', 0)]);
  for (let x = -237; x < -162; x += 3.9) {
    const v = () => 1.3 + rnd() * .2;
    if (Math.abs(x + 200) > 2.8) barrel(x, -302.55, F1, 0, v());
    if (Math.abs(x + 166) > 3.2) barrel(x, -289.45, F1, 0, v());
  }
  for (let x = -232; x < -165; x += 11.7) { trough(x, F1, -300.4); trough(x + 5.8, F1, -291.6); }
  for (let x = -235; x < -164; x += 10) {
    rib(x, F1 + 3.9, -296, 16, 1.6, PI / 2);
    if (Math.abs(x + 200) > 3) D.torch(x, F1 + 4.4, -303.85, 0, 1); if (Math.abs(x + 166) > 4) D.torch(x, F1 + 4.4, -288.15, 0, -1);
  }
  for (let x = -230; x < -165; x += 14) D.light(x, F1 + 3.6, -296, [1.5, .85, .4], 15);
  D.tunnel([[-240.4, F1, -296], [-244.4, F1, -296]], { w: 3, h: 4, wall: 'rock', rgb: RED, floorRgb: FLR });
  const sx = -166, stairLen1 = stair(sx, -287.2, F1, F2, -PI / 2);

  // The hop loft, a cave where the brewer's chute drops from the street.

  cave(-253, -296, F1, 8.6, 5, [0]);
  D.slab(-255.8, 22.4, -296, 9.6, .22, 1.3, -.675, 'wood', [.4, .26, .15]);
  for (const s of [-1, 1]) D.slab(-255.8, 22.7, -296 + s * .62, 9.6, .4, .1, -.675, 'wood', [.4, .26, .15]);
  for (const [x, y] of [[-258, 24], [-255, 22.5], [-252, 20.7]]) for (const s of [-.6, .6]) D.box(x, F1, -296 + s, .18, y - F1 - .3, .18, 'wood');
  D.cyl(-250.4, F1, -296, 1.4, 1.5, 'wood', { seg: 12 }); D.water(-250.4, F1 + 1.45, -296, 2, 2, { rgb: [.2, .15, .08] });
  for (const dy of [.3, 1.1]) D.geo(HOOPV, 'iron', { at: [-250.4, F1 + dy, -296], scale: 1.43 });
  for (let k = 0; k < 7; k++) sack(-257 + (k % 3) * .95, F1 + Math.floor(k / 3) * .35, -291.5 - (k % 2) * .3, rnd());
  D.box(-253, F1, -302.5, .1, 4.4, .1, 'wood'); D.box(-252.4, F1, -302.5, .1, 4.4, .1, 'wood');
  for (let k = 0; k < 9; k++) D.box(-252.7, F1 + .4 + k * .45, -302.5, .7, .06, .06, 'wood');
  D.light(-253, F1 + 3.5, -296, [1.2, .75, .35], 12, { flicker: 0 });
  D.torch(-249, F1 + 3.8, -289, -.3, -.95); D.torch(-260, F1 + 3.8, -300, .9, .4);
  niche(D, -241.1, F1 + .7, -291, 1, 0, { w: 1 });

  // ---- Level II (+11): the junction and the Eiskeller with Pegnitz ice ----

  const v2 = { x: -166, z: -272 };
  hall(v2.x, v2.z, F2, 8, 8, 5, [door('n'), door('e'), door('w'), door('s')], { wall: 'ashlar', rgb: ASH });
  hew([[-162, F2, -272], [-155, F2, -272], [-155, F2, -260], [-150, F2, -260]], { w: 3, torches: 9 });
  D.brazier(-168, F2, -275, { r: 9 }); D.brazier(-164, F2, -269, { r: 9 });
  const stairLen2 = stair(v2.x, -267.4, F2, F3, -PI / 2);
  hew([[-171, F2, -272], [-195, F2, -272], [-205, F2, -270], [-222.5, F2, -272]], { w: 3.6, h: 4.6 });
  for (const s of [-.55, .55]) D.box(-183, F2 + .02, -272 + s, 24, .06, .1, 'iron', { jit: 0 });
  D.frame(-186, -272, 0, () => {
    D.box(0, F2 + .45, 0, 2.4, .35, 1.3, 'wood');
    for (const [x, z] of [[-.85, -.7], [.85, -.7], [-.85, .7], [.85, .7]]) D.geo(WHEEL, 'iron', { at: [x, F2 + .32, z] });
    for (let i = 0; i < 6; i++) D.box(-.7 + (i % 3) * .72, F2 + .8 + Math.floor(i / 3) * .5, 0, .66, .46, .66, 'plaster', { rgb: [.6, .78, .92], jit: .05 });
  });
  for (const x of [-180, -192, -203]) { niche(D, x, F2 + .8, -273.8, 0, 1, { w: .9 }); niche(D, x - 5, F2 + .8, -270.2, 0, -1, { w: .9 }); }
  for (const x of [-178, -198]) D.torch(x, F2 + 3.4, -270.35, 0, -1);

  // The ice store. Blocks stack in pyramids, a few glow, and cold blue light holds still.

  const ic = { x: -234, z: -272 };
  cave(ic.x, ic.z, F2, 11.5, 6, [0]);
  function iceStack(x, z, nx, nz, layers, rot) {
    D.frame(x, z, rot, () => {
      for (let l = 0; l < layers; l++) for (let i = 0; i < nx - l; i++) for (let j = 0; j < nz - l; j++) {
        const bx = (i - (nx - l - 1) / 2) * 1.05, bz = (j - (nz - l - 1) / 2) * .75;
        if (rnd() < .22) D.glow(bx, F2 + l * .52, bz, 1, .5, .7, [.2, .42, .62]);
        else D.box(bx, F2 + l * .52, bz, 1, .5, .7, 'plaster', { rgb: [.55, .74, .9], jit: .06 });
      }
    });
  }
  iceStack(-241, -278, 5, 4, 3, .2); iceStack(-241, -265, 4, 3, 3, -.3); iceStack(-230, -281, 4, 3, 2, 1.2); iceStack(-229, -262, 3, 3, 2, -1);
  iceStack(-237, -272, 3, 2, 2, .6);
  D.box(-232.5, F2, -272.6, 2.4, .8, 1.1, 'wood'); D.box(-232.5, F2 + .8, -272.6, 2.6, .08, 1.2, 'wood');
  D.box(-232.5, F2 + .88, -272.6, .9, .5, .7, 'plaster', { rgb: [.6, .8, .95], jit: .04 });
  D.box(-231.2, F2 + .9, -272.2, .9, .06, .06, 'iron', { jit: 0 });
  for (const [x, z] of [[-243, -272], [-236, -283], [-228, -269], [-238, -261], [-232, -277]]) D.light(x, F2 + 3, z, ICE, 13, { flicker: 0 });
  D.brazier(-224.5, F2, -270, { r: 9, size: .9 }); D.brazier(-224.5, F2, -274, { r: 9, size: .9 });
  const mist = [[-236, -270, 6], [-232, -278, 5], [-241, -263, 5], [-229, -266, 4]].map(([x, z, r], i) => disc(D, [.45, .7, 1], .22, r, x, F2 + .7 + i * .12, z));
  D.tick(t => mist.forEach((m, i) => { m.position.x += Math.sin(t * .2 + i * 2) * .004; m.position.z += Math.cos(t * .17 + i) * .004; m.material.uniforms.uA.value = .17 + .08 * Math.sin(t * .5 + i * 1.7); m.rotation.y = t * .03 * (i % 2 ? 1 : -1); }));

  // ---- Level III (+4): the Braukeller with its vaulted barrel gallery, brewing alcoves and the cooper ----

  const v3 = { x: -166, z: -252 };
  hall(v3.x, v3.z, F3, 8, 8, 5, [door('n'), door('w'), door('s')], { wall: 'ashlar', rgb: ASH });
  D.brazier(-168, F3, -254, { r: 9 });
  const aX = [-190, -208, -226], gz = -252;
  hall(-204.5, gz, F3, 67, 7, 5.4, [door('e'), door('w'), ...aX.map(x => door('s', (x + 204.5) / 33.5))]);
  for (let x = -236; x < -173; x += 3.6) barrel(x, -254.2, F3, 0, 1.25 + rnd() * .1, 3.2);
  for (let x = -233; x < -175; x += 11) trough(x, F3, -252.6);
  for (let x = -235; x < -173; x += 7) rib(x, F3 + 3.6, gz, 7, 1.6, PI / 2);
  for (const x of [-182, -199, -217, -233]) D.torch(x, F3 + 3.8, -248.65, 0, -1);
  for (const x of [-180, -192, -204, -216, -228]) D.torch(x, F3 + 4.1, -255.35, 0, 1);
  for (let x = -230; x < -172; x += 12) D.light(x, F3 + 3.4, gz, [1.5, .85, .4], 13);
  lumps(-237.8, -255.4, -171.2, -255.4, 0, 1, F3 + 3, 2, 22, D); lumps(-237.8, -248.6, -171.2, -248.6, 0, -1, F3 + 3, 2, 22, D);
  lumps(-170.5, -255.5, -170.5, -248.5, -1, 0, F3, 4, 3, D);

  // The brewing alcove: a copper kettle on a brick hearth.

  const k1 = { x: aX[0], z: -244.7 };
  hall(k1.x, k1.z, F3, 6, 6, 4.6, [door('n')], { wall: 'rock', rgb: RED });
  D.box(k1.x, F3, -244.2, 2.4, .9, 2.4, 'brick');
  D.geo(KETTLE, 'iron', { at: [k1.x, F3 + 1.55, -244.2], rgb: [.72, .4, .22] });
  D.cyl(k1.x, F3 + 2.2, -244.2, .3, 2.2, 'iron', { seg: 6 });
  D.glow(k1.x - .5, F3 + .25, -242.95, 1, .5, .3, [2, .8, .2], { pulse: 1.3 });
  D.flame(k1.x, F3 + .6, -243.1, .9); D.light(k1.x, F3 + 1, -243, [1.7, .85, .35], 9);
  D.box(k1.x + 1.9, F3, -243.5, .8, 1, .8, 'wood'); D.box(k1.x - 2, F3 + .7, -246.6, 1.6, .06, .5, 'wood');
  D.torch(k1.x - 2.85, F3 + 3, -244, 1, 0);

  // The malt store: sacks, kegs on racks.

  const k2 = { x: aX[1], z: -244.7 };
  hall(k2.x, k2.z, F3, 6, 6, 4.6, [door('n')], { wall: 'rock', rgb: RED });
  for (let k = 0; k < 10; k++) sack(k2.x - 1.8 + (k % 4) * .95, F3 + Math.floor(k / 4) * .35, -242.5 - (k % 2) * .2, rnd());
  for (let k = 0; k < 4; k++) { D.box(k2.x + 2.5 - .3, F3, -246.4 + k * 1.2, .08, 1, .8, 'wood'); }
  for (let k = 0; k < 3; k++) barrel(k2.x + 2.2, -246.2 + k * 1.3, F3 + .9, PI / 2, .42, .9);
  D.box(k2.x + 2.55, F3 + .9, -244.5, .08, .08, 3.8, 'wood');
  D.torch(k2.x - 2.85, F3 + 3, -244.3, 1, 0);

  // The tap room: a table, benches, tankards and candles.

  const k3 = { x: aX[2], z: -244.7 };
  hall(k3.x, k3.z, F3, 6, 6, 4.6, [door('n')], { wall: 'rock', rgb: RED });
  D.box(k3.x, F3 + .8, -244.5, 2.4, .1, 1.1, 'wood');
  for (const [x, z] of [[-1, -.4], [1, -.4], [-1, .4], [1, .4]]) D.box(k3.x + x - .05, F3, -244.5 + z - .05, .1, .8, .1, 'wood');
  for (const s of [-1, 1]) D.box(k3.x, F3 + .4, -244.5 + s * 1.05, 2.4, .08, .4, 'wood');
  for (let k = 0; k < 4; k++) D.cyl(k3.x - .8 + k * .5, F3 + .9, -244.5 + (k % 2 - .5) * .3, .09, .2, 'iron', { seg: 6, rgb: [.5, .5, .52] });
  D.candle(k3.x, F3 + .9, -244.5, { r: 5 });
  barrel(k3.x + 2.1, -243.2, F3 + 0, PI / 2, .5, 1.1); D.torch(k3.x + 2.85, F3 + 3, -245, -1, 0);

  // The cooper's workshop: staves, an unfinished barrel, a bench and an anvil.

  const cp = { x: -166, z: -242.2 };
  hall(cp.x, cp.z, F3, 10, 10, 4.6, [door('n')], { wall: 'rock', rgb: RED });
  for (let k = 0; k < 14; k++) { const a = k / 14 * PI * 2; D.box(cp.x - 1.5 + Math.cos(a) * .7, F3, cp.z + 1 + Math.sin(a) * .7, .06, 1.3, .3, 'wood', { rot: -a }); }
  for (const dy of [.25, .75]) D.geo(HOOPV, 'iron', { at: [cp.x - 1.5, F3 + dy, cp.z + 1], scale: .72 });
  for (let k = 0; k < 7; k++) D.box(cp.x + 2.4, F3 + k * .07, cp.z - 2.8 + k * .02, .12, .07, 2.4, 'wood', { rot: .1 });
  for (let k = 0; k < 8; k++) D.box(cp.x + 2.3, F3 + k * .07, cp.z + 1.6, 2.4, .07, .12, 'wood', { rot: .05 });
  D.box(cp.x - 2.2, F3 + .85, cp.z - 3.5, 3, .12, .9, 'wood'); for (const x of [-3.5, -.9]) D.box(cp.x + x - .1, F3, cp.z - 3.55, .2, .85, .8, 'wood');
  D.box(cp.x + 1, F3, cp.z - 2, .5, .6, .5, 'iron'); D.box(cp.x + 1, F3 + .6, cp.z - 2, 1.1, .2, .4, 'iron');
  D.brazier(cp.x - 3.8, F3, cp.z - 1, { r: 10, size: .9 });
  D.torch(cp.x + 4.85, F3 + 3, cp.z, -1, 0);

  // The air shaft. It rises from the deepest level to a vent in the street, with a spiral stair and doors on levels III and IV.

  const sh = { x: -242, z: -252, r: 3.4 }, SN = 24;
  const shRing = (y, h, mouths) => ringWall(sh.x, sh.z, () => sh.r, y, h, SN, mouths, mouths.length ? 1 : 0, 'ashlar', { thick: .8, rgb: ASH });
  shRing(F4, 3.6, [PI / 2]); shRing(F4 + 3.6, F3 - F4 - 3.6, []); shRing(F3, 3.6, [0]); shRing(F3 + 3.6, 26 - F3 - 3.6, []);
  D.floorPoly(Array.from({ length: SN }, (_, k) => [sh.x + Math.cos(k / SN * PI * 2) * sh.r, sh.z + Math.sin(k / SN * PI * 2) * sh.r]), F4, 'flag', { rgb: FLR });
  for (let k = 0, n = Math.round((26 - F4) / .25); k < n; k++) {
    const a = k * .32;
    D.box(sh.x + Math.cos(a) * sh.r * .55, F4 + k * .25, sh.z + Math.sin(a) * sh.r * .55, sh.r * .9, .25, .7, 'ashlar', { rot: -a, rgb: ASH, jit: .03, faces: 'b' });
  }
  D.cyl(sh.x, F4, sh.z, .35, 26 - F4, 'ashlar', { seg: 8, rgb: ASH });
  for (let y = F4 + 2.5, k = 0; y < 25; y += 4, k++) { const a = k * 2.1; D.torch(sh.x + Math.cos(a) * (sh.r - .15), y, sh.z + Math.sin(a) * (sh.r - .15), -Math.cos(a), -Math.sin(a)); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; D.box(sh.x + Math.cos(a) * (sh.r + 1.1) - .35, 25.2, sh.z + Math.sin(a) * (sh.r + 1.1) - .35, .7, .8, .7, 'ashlar', { rgb: ASH, rot: -a }); }

  // ---- Level IV (-14): the lowest cellars, a flooded cave and the way down to the dungeons ----

  hew([[sh.x, F4, -248.6], [sh.x, F4, -230]], { w: 3, h: 3.8, torches: 9 });
  const fc = { x: -242, z: -217 };
  cave(fc.x, fc.z, F4, 13, 3.9, [-PI / 2, 0], { bump: .2 });
  hew([[-229, F4, -217], [-212, F4, -213], [-200, F4, -209], [-200, F4, -195]], { w: 3.4, h: 3.8, torches: 9 });
  const pool = Array.from({ length: 16 }, (_, k) => [fc.x + 1 + Math.cos(k / 16 * PI * 2) * 8.5, fc.z + 5.5 + Math.sin(k / 16 * PI * 2) * 5]);
  D.waterPoly(pool, F4 + .25, {});
  D.water(-220.5, F4 + .25, -215, 17, 3.2, { rot: -.23 });
  for (const [x, z] of [[-236, -215], [-233, -213.5], [-230, -211], [-226.5, -210.5], [-244, -219]]) D.box(x, F4, z, 1, .45, .9, 'rock', { rgb: RED, rot: rnd() * 3 });
  D.frame(-238, -207, .4, () => {
    D.box(0, F4 + .2, 0, 2.8, .1, 1, 'wood'); for (const s of [-1, 1]) D.box(0, F4 + .2, s * .5, 2.8, .4, .08, 'wood');
    D.slab(1.55, F4 + .35, 0, .8, .08, 1, .7, 'wood', [.3, .2, .12]); D.candle(.9, F4 + .3, 0, { r: 6, rgb: [.5, .9, .9] });
  });
  barrel(-250, -223, F4, .5, 1.3, 3.2, [.4, .27, .16]); barrel(-248, -226, F4, 1.9, 1.3, 3.2, [.4, .27, .16]); barrel(-252.5, -220, F4, 2.4, 1.2, 3, [.28, .2, .12]);
  D.geo(HEAP, 'bone', { at: [-246, F4 - .1, -229], scale: 1.1, rgb: [.5, .45, .36] }); D.geo(SKULL, 'bone', { at: [-246, F4 + .55, -229], scale: 1.4 });
  for (let k = 0; k < 11; k++) D.cyl(-207 + k * .3, F4, -211.5 - k * .15, .035, 3.4, 'iron', { seg: 4, jit: 0 });
  D.box(-205.5, F4 + .6, -212.2, 3.5, .08, .08, 'iron', { rot: .45, jit: 0 }); D.box(-205.5, F4 + 2.4, -212.2, 3.5, .08, .08, 'iron', { rot: .45, jit: 0 });
  D.brazier(-252, F4, -214, { rgb: [.45, 1, 1.1], r: 10, size: .9 });
  for (const [x, z] of [[-240, -208], [-232, -212], [-246, -213]]) D.light(x, F4 + 2.5, z, [.3, .6, .75], 12, { flicker: 0 });
  D.light(-249, F4 + 2.5, -224, [1.4, .85, .4], 11); D.light(-236, F4 + 2.5, -226, [1.2, .75, .35], 9);
  lumps(-254, -208, -230, -204.5, 0, -1, F4, 3, 8, D);
  const rip = Array.from({ length: 5 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 20).rotateX(-PI / 2), D.mat(0xa8d8e0, { additive: true, opacity: .5 }));
    m.frustumCulled = false; D.add(m);
    const d = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 4), D.mat(0xd0f0f4, { additive: true, opacity: .8 }));
    d.frustumCulled = false; D.add(d);
    return { m, d, x: fc.x + 1 + (rnd() - .5) * 11, z: fc.z + 5.5 + (rnd() - .5) * 6, p: i / 5 };
  });
  D.tick(t => rip.forEach(r => {
    const u = (t * .22 + r.p) % 1, fall = Math.min(1, u / .35), ring = Math.max(0, (u - .35) / .65);
    r.d.position.set(r.x, F4 + 4 - fall * 3.75, r.z); r.d.visible = ring === 0;
    r.m.position.set(r.x, F4 + .28, r.z); r.m.scale.setScalar(.15 + ring * 1.6); r.m.visible = ring > 0; r.m.material.uniforms.uOpacity.value = .5 * (1 - ring);
  }));
  const fog = disc(D, [.3, .6, .7], .16, 7, fc.x + 1, F4 + .5, fc.z + 5.5);
  D.tick(t => { fog.material.uniforms.uA.value = .13 + .06 * Math.sin(t * .4); fog.rotation.y = t * .04; });

  D.label('Felsengänge', -207, F1 + 6, -262);
  D.label('I · Lagerhalle', -200, F1 + 4.5, -296, 'district quarter under');
  D.label('II · Eiskeller', ic.x, F2 + 5, ic.z, 'district quarter under');
  D.label('III · Braukeller', -204, F3 + 5, -252, 'district quarter under');
  D.label('Luftschacht', sh.x, F3 + 7, sh.z, 'district quarter under');
  D.label('IV · Flooded Gallery', fc.x, -12.5, fc.z, 'district quarter under');
}
