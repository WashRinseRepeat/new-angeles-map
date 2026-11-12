// Boats on the rivers, for a pack whose boats section asks for them. Each river in the city file's water is a band,
// near bank then far bank back, so its middle line runs between matching points of the two. Boats sail up and down
// that line at the water's height and turn back at its ends. A river with a direction sails its reaches instead. They are lit and cast shadows under live shadows.
// Without a boats section nothing here is built.
//
// boats keys, with their defaults:
//   n 4             boats on each river
//   speed [.8, 1.6] their speed range in metres per second
//   parts [...]     [sx, sy, sz, x, y, z, [r, g, b]] boxes, z toward the bow; by default a barge with a cabin, a mast
//                   and a sail

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITY, rng } from './core.js';
import { SETTING } from './setting.js';
import { scene } from './render.js';
import { yawAt } from './instances.js';
import { CLAIMED, RIVERS, reachPaths } from './rivers.js';

const B = SETTING.boats && {
  n: 4, speed: [.8, 1.6],
  parts: [[2.2, .7, 7, 0, .3, 0, [.22, .15, .08]], [1.5, .9, 1.8, 0, 1.1, -2, [.3, .22, .12]], [.14, 4.5, .14, 0, 2.8, 1, [.15, .1, .06]],
    [.05, 2.8, 2.2, 0, 3, 1.6, [.72, .66, .55]]],
  ...SETTING.boats,
};
const WATER_Y = .12;

// A river's middle line, resampled every 4 m.

function middle(P) {
  const half = Math.floor(P.length / 2), pts = [];
  for (let i = 0; i < half; i++) {
    const a = P[i], b = P[P.length - 1 - i];
    pts.push(new THREE.Vector3((a[0] + b[0]) / 2, WATER_Y, (a[1] + b[1]) / 2));
  }
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const n = Math.ceil(pts[i].distanceTo(pts[i - 1]) / 4);
    for (let k = 1; k <= n; k++) out.push(pts[i - 1].clone().lerp(pts[i], k / n));
  }
  return out;
}

// A river with a direction (engine/rivers.js) gives its reaches instead, each at its own water height, and its
// current carries the boats: faster downstream, slower up. A reach ends short of a fall, so no boat goes over.

const boats = [];
let mesh;
if (B && (CITY.water?.length || RIVERS.length)) {
  const r = rng(5113);
  const paths = [...(CITY.water ?? []).filter(w => !CLAIMED.has(w.name)).map(w => middle(w.poly)), ...RIVERS.flatMap(reachPaths)];
  for (const path of paths) {
    if (path.length < 4) continue;
    for (let i = 0; i < B.n; i++) {
      boats.push({ path, u: (i + r()) / B.n * (path.length - 1), dir: r() < .5 ? 1 : -1, v: (B.speed[0] + r() * (B.speed[1] - B.speed[0])) / 4,
        side: (r() - .5) * 6 });
    }
  }
  const box = ([sx, sy, sz, x, y, z, rgb]) => {
    const g = new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z).toNonIndexed();
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(rgb).flat(), 3));
    return g;
  };
  mesh = new THREE.InstancedMesh(mergeGeometries(B.parts.map(box)), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 }), boats.length);
  mesh.frustumCulled = false;
  mesh.userData.moves = true;
  scene.add(mesh);
}

// Each frame a boat moves along its river's middle, a few metres to one side, and faces its way.

export function moveBoats(dt) {
  if (!mesh) return;
  boats.forEach((b, i) => {
    const L = b.path.length - 1;
    b.u += (b.dir * b.v + (b.path[Math.floor(b.u)].v ?? 0) / 4) * dt;
    if (b.u > L - .01) { b.u = L - .01; b.dir = -1; }
    if (b.u < 0) { b.u = 0; b.dir = 1; }
    const k = Math.floor(b.u), f = b.u - k, a = b.path[k], c = b.path[k + 1], dx = (c.x - a.x) * b.dir, dz = (c.z - a.z) * b.dir;
    const len = Math.hypot(dx, dz) || 1;
    yawAt(mesh, i, a.x + (c.x - a.x) * f - dz / len * b.side, a.y + (c.y - a.y) * f, a.z + (c.z - a.z) * f + dx / len * b.side, dx, dz);
  });
  mesh.instanceMatrix.needsUpdate = true;
}
