// People on foot, for a pack whose people section asks for them. Walkers stroll the streets at the roadside and
// turn back at a street's end. Crowds stand round a point, as at market stalls, or mill about inside a circle.
// Under a clock most of them go home at night. The city file's paths add walkers off the streets, such as guards on
// a wall walk, who stay out day and night and walk at the path's lift above the ground. Without a people section
// nothing here is built.
//
// people keys, with their defaults:
//   walk 3            walkers per 100 m of street
//   side [2.6, 3.6]   how far from the street's middle they walk, on minor and other streets, in metres; a city
//                     file with street widths overrides it, keeping walkers 0.6 m inside each street's edge
//   crowds []         { at: [x, z], ring: radius, n } stand on a ring facing out, as at stalls round a square;
//                     { at: [x, z], r: radius, n } stand and mill inside a circle
//   clothes, skin     lists of [r, g, b] to pick from
//   night .15         the share still out at night under a clock

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './core.js';
import { SETTING } from './setting.js';
import { scene } from './render.js';
import { STREETS, sides } from './transport.js';
import { CITY } from './core.js';
import { DAY } from './daylight.js';
import { groundAt } from './relief.js';

const P = SETTING.people && {
  walk: 3, side: [2.6, 3.6], crowds: [], night: .15,
  clothes: [[.35, .12, .08], [.15, .2, .35], [.3, .28, .2], [.18, .25, .12], [.4, .35, .25], [.25, .15, .25], [.12, .1, .08]],
  skin: [[.85, .62, .48], [.7, .5, .38], [.55, .38, .28], [.9, .72, .58]], ...SETTING.people,
};

// A figure is 1.7 m tall: dark legs and a tunic in one mesh that takes the clothes colour, and a head that takes
// the skin colour. Vertex colours shade the legs darker than the tunic.

const shade = (g, k) => {
  g = g.index ? g.toNonIndexed() : g;
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(k), 3));
  return g;
};
const BODY = () => mergeGeometries([
  shade(new THREE.BoxGeometry(.3, .8, .2).translate(0, .4, 0), .45),
  shade(new THREE.CylinderGeometry(.16, .21, .66, 7).translate(0, 1.12, 0), 1),
]);
const HEAD = () => shade(new THREE.IcosahedronGeometry(.12, 1).translate(0, 1.58, 0), 1);

export const people = [];
let body, head;
if (P) {
  const r = rng(9187), pick = list => list[Math.floor(r() * list.length)];
  const off = kind => CITY.widths ? Math.max(.8, CITY.widths[kind] / 2 - .6) : P.side[kind === 'minor' ? 0 : 1];
  for (const st of STREETS) {
    const metres = (st.path.length - 1) * 4;
    for (let k = r() * 100 / P.walk; k < metres; k += (.5 + r()) * 100 / P.walk) {
      people.push({ st, u: k / 4, dir: r() < .5 ? 1 : -1, v: (1 + r() * .5) / 4, side: (r() < .5 ? -1 : 1) * off(st.kind),
        phase: r() * 6.3, rank: r() });
    }
  }
  for (const w of CITY.paths ?? []) {
    const path = w.line.map(([x, z]) => new THREE.Vector3(x, 0, z)), st = { path, side: sides(path, false), lift: w.lift ?? 0 };
    for (let i = 0; i < (w.n ?? 10); i++) {
      people.push({ st, u: (i + r() * .5) / (w.n ?? 10) * (path.length - 1), dir: r() < .5 ? 1 : -1, v: (.7 + r() * .3) / 4, side: 0,
        phase: r() * 6.3, rank: -1 + r() * .01 });
    }
  }
  for (const c of P.crowds) for (let i = 0; i < c.n; i++) {
    const a = r() * Math.PI * 2, d = c.ring ? c.ring + (r() - .5) * 1.5 : c.r * Math.sqrt(r());
    const x = c.at[0] + Math.cos(a) * d, z = c.at[1] + Math.sin(a) * d;
    people.push({ x, z, yaw: c.ring ? Math.atan2(Math.cos(a), Math.sin(a)) : r() * 6.3, phase: r() * 6.3, rank: r() });
  }

  // Instances are sorted by rank, so a share of the people is the first part of the list.

  people.sort((a, b) => a.rank - b.rank);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 });
  body = new THREE.InstancedMesh(BODY(), mat, people.length);
  head = new THREE.InstancedMesh(HEAD(), mat, people.length);
  const c = new THREE.Color();
  people.forEach((p, i) => {
    p.s = .9 + r() * .2;
    body.setColorAt(i, c.setRGB(...pick(P.clothes)));
    head.setColorAt(i, c.setRGB(...pick(P.skin)));
  });
  for (const m of [body, head]) { m.frustumCulled = false; m.userData.moves = true; scene.add(m); }
}

// Each frame walkers step along their street and bob with their stride. Standing people sway a little.
// A walker turns only about the vertical, so its matrix is written straight from its heading into both meshes.

const o = new THREE.Object3D();
let time = 0;
export function movePeople(dt) {
  if (!P) return;
  time += dt;
  const fixed = people.findIndex(p => p.rank >= 0), always = fixed < 0 ? people.length : fixed;
  const share = DAY ? P.night + (1 - P.night) * DAY.light : 1, n = always + Math.round((people.length - always) * share);
  const B = body.instanceMatrix.array, Hd = head.instanceMatrix.array;
  for (let i = 0; i < n; i++) {
    const p = people[i];
    if (p.st) {
      const L = p.st.path.length - 1;
      p.u += p.dir * p.v * dt;
      if (p.u > L - .01) { p.u = L - .01; p.dir = -1; }
      if (p.u < 0) { p.u = 0; p.dir = 1; }
      const k = Math.floor(p.u), f = p.u - k, a = p.st.path[k], b = p.st.path[k + 1], sd = p.st.side[k];
      const x = a.x + (b.x - a.x) * f + sd.x * p.side, z = a.z + (b.z - a.z) * f + sd.z * p.side;

      // The ground is sampled once at each end of the walker's 4 m step and blended between, as groundAt is slow on a
      // relief. A step whose ground leaves that straight line by more than 30 cm anywhere along it, such as onto a
      // bridge or past a lot's platform, follows the ground exactly. An even slope stays blended, however steep.

      if (p.k !== k) {
        const g = u => groundAt(a.x + (b.x - a.x) * u + sd.x * p.side, a.z + (b.z - a.z) * u + sd.z * p.side);
        p.k = k; p.ga = g(0); p.gb = g(1);
        p.bent = [.25, .5, .75].some(u => Math.abs(g(u) - (p.ga + (p.gb - p.ga) * u)) > .3);
        const dx = (b.x - a.x) * p.dir, dz = (b.z - a.z) * p.dir, l = Math.hypot(dx, dz) || 1;
        p.sin = dx / l * p.s; p.cos = dz / l * p.s;
      }
      const y = (p.bent ? groundAt(x, z) : p.ga + (p.gb - p.ga) * f) + (p.st.lift ?? 0) + Math.abs(Math.sin(time * 7 + p.phase)) * .05;
      const j = i * 16, c = p.cos, sn = p.sin, sc = p.s;
      B[j] = Hd[j] = c; B[j + 1] = Hd[j + 1] = 0; B[j + 2] = Hd[j + 2] = -sn; B[j + 3] = Hd[j + 3] = 0;
      B[j + 4] = Hd[j + 4] = 0; B[j + 5] = Hd[j + 5] = sc; B[j + 6] = Hd[j + 6] = 0; B[j + 7] = Hd[j + 7] = 0;
      B[j + 8] = Hd[j + 8] = sn; B[j + 9] = Hd[j + 9] = 0; B[j + 10] = Hd[j + 10] = c; B[j + 11] = Hd[j + 11] = 0;
      B[j + 12] = Hd[j + 12] = x; B[j + 13] = Hd[j + 13] = y; B[j + 14] = Hd[j + 14] = z; B[j + 15] = Hd[j + 15] = 1;
    } else {
      o.position.set(p.x, p.y ??= groundAt(p.x, p.z), p.z);
      o.rotation.set(0, p.yaw + Math.sin(time * .6 + p.phase) * .25, Math.sin(time * 1.3 + p.phase) * .02);
      o.scale.setScalar(p.s);
      o.updateMatrix();
      body.setMatrixAt(i, o.matrix); head.setMatrixAt(i, o.matrix);
    }
  }
  body.count = head.count = n;
  body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = true;
}
