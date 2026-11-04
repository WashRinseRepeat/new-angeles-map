// The lie of the land, for a city file with a relief (gen/town.py copies it from town.json). Without one the ground
// is flat at 0 and every function here returns 0.
//
// The relief is a sum of smooth hills. A hill rises h metres over radius r as (1 - t²)², t the distance over r, so
// it meets the ground without a crease; a negative h is a hollow. A "mound" has a flat top over its inner share top
// and steep sides, as a castle motte.
//
// On the relief the town levels its ground:
// - Each lot is a flat platform, so its buildings stand level. Its level is its centre's height rounded to a band
//   of terrace metres (default 1.5), so neighbouring lots on one band share a level and the terraces run along the
//   contours. Where a platform meets the sloping ground round it, a stone retaining wall holds it, and a flight of
//   steps leads from it down or up to its street (walls()).
// - The centre square and each site in the city file are platforms that blend into the slope over 14 m.
// Streets and open ground follow the relief.

import * as THREE from 'three';
import { CENTRE, CENTRE_R, CITY } from './core.js';

const R = CITY.relief;
export const RELIEF = !!R;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function reliefAt(x, z) {
  if (!R) return 0;
  let h = 0;
  for (const k of R.hills) {
    const t = Math.hypot(x - k.at[0], z - k.at[1]) / k.r;
    if (t < 1) h += k.h * (k.shape === 'mound' ? smooth(1, k.top ?? .55, t) : (1 - t * t) ** 2);
  }
  return h;
}

// Soft platforms: the square as a circle, each site as a turned rectangle. Within one the ground takes its level;
// past its edge the level blends into the relief over BLEND metres.

const BLEND = 14;
const SOFT = !R ? [] : [
  ...CENTRE_R ? [{ x: CENTRE.x, z: CENTRE.y, r: CENTRE_R }] : [],
  ...(CITY.sites ?? []).map(s => ({ x: s.at[0], z: s.at[1], w: s.w / 2, d: s.d / 2, c: Math.cos(s.rot ?? 0), s: Math.sin(s.rot ?? 0) })),
];
for (const p of SOFT) p.level = reliefAt(p.x, p.z);
const outside = (p, x, z) => {
  const dx = x - p.x, dz = z - p.z;
  if (p.r) return Math.hypot(dx, dz) - p.r;
  const u = Math.abs(dx * p.c - dz * p.s) - p.w, v = Math.abs(dx * p.s + dz * p.c) - p.d;
  return Math.hypot(Math.max(u, 0), Math.max(v, 0)) + Math.min(Math.max(u, v), 0);
};
export function softAt(x, z) {
  let h = reliefAt(x, z);
  for (const p of SOFT) {
    const d = outside(p, x, z);
    if (d < BLEND) h += (p.level - h) * (1 - smooth(0, BLEND, d));
  }
  return h;
}

// Lot platforms, found through a 16 m grid of the lots that overlap each cell.

const CELL = 16, LOTS = !R ? [] : CITY.blocks.map(P => {
  const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cz = P.reduce((s, p) => s + p[1], 0) / P.length;
  const step = R.terrace ?? 1.5;
  return { P, cx, cz, level: Math.round(softAt(cx, cz) / step) * step };
});
const GRID = new Map();
for (const l of LOTS) {
  const xs = l.P.map(p => p[0]), zs = l.P.map(p => p[1]);
  for (let i = Math.floor(Math.min(...xs) / CELL); i <= Math.floor(Math.max(...xs) / CELL); i++)
    for (let j = Math.floor(Math.min(...zs) / CELL); j <= Math.floor(Math.max(...zs) / CELL); j++) {
      const k = `${i},${j}`;
      if (!GRID.has(k)) GRID.set(k, []);
      GRID.get(k).push(l);
    }
}
const inPoly = (P, x, z) => {
  let a = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) a = !a;
  }
  return a;
};
export const lotAt = (x, z) => GRID.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`)?.find(l => inPoly(l.P, x, z));

// The moat: relief.moat cuts a ditch round the outside of the town wall, offset metres out (default 9), width wide
// (12), depth deep (4), with a flat bottom. Water lies in it only up to water metres (2) above its lowest point, so on
// a hill town the low stretches hold water and the high ones are dry.

const WALL = CITY.wall ?? [], M = R?.moat && WALL.length ? { offset: 9, width: 12, depth: 4, water: 2, ...R.moat } : null;
const WC = WALL.reduce((c, p) => [c[0] + p[0] / WALL.length, c[1] + p[1] / WALL.length], [0, 0]);
const WR = WALL.map(p => Math.hypot(p[0] - WC[0], p[1] - WC[1])), WMIN = Math.min(...WR, 0), WMAX = Math.max(...WR, 0);
function wallDist(x, z) {
  let d = Infinity;
  for (let i = 0; i < WALL.length; i++) {
    const [ax, az] = WALL[i], [bx, bz] = WALL[(i + 1) % WALL.length], ex = bx - ax, ez = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
    d = Math.min(d, Math.hypot(x - ax - ex * t, z - az - ez * t));
  }
  return d;
}

// How far past the wall a point lies, or -1 inside it or out of the moat's reach.

function pastWall(x, z, reach) {
  if (!M) return -1;
  const r = Math.hypot(x - WC[0], z - WC[1]);
  if (r < WMIN - 1 || r > WMAX + reach || inPoly(WALL, x, z)) return -1;
  return wallDist(x, z);
}
export function ditchAt(x, z) {
  const d = pastWall(x, z, M?.offset + M?.width);
  if (d < 0) return 0;
  const s = Math.abs(d - M.offset) / (M.width / 2);
  return s < 1 ? -M.depth * smooth(1, .45, s) : 0;
}

// The coarse hills sink along the moat, deepest over the ditch and back to the land 18 m beyond it, so they stay
// under the town's own ground there.

export function moatSink(x, z) {
  const d = pastWall(x, z, M?.offset + M?.width + 20);
  if (d < 0) return 0;
  return (M.depth + 1.5) * (1 - smooth(M.width / 2 + 2, M.width / 2 + 18, Math.abs(d - M.offset)));
}

// Bridges. At every gate a deck spans the moat level with its banks. Where a street crosses the city file's water, a
// deck spans it 3 m past each bank and humps relief.hump metres (default 2.5) at its middle. On a bridge groundAt
// gives the deck, so people, carts and lamps cross on it; the ground beneath keeps its ditch or river.

const WIDE = { main: 7, major: 6, minor: 4.5 };
export const BRIDGES = [];
if (M) for (const [gx, gz, deg] of CITY.gates ?? []) {
  const a = deg * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a), far = M.offset + M.width / 2 + 2.5;
  BRIDGES.push({ x0: gx + ux, z0: gz + uz, x1: gx + ux * far, z1: gz + uz * far, w: 7, hump: 0 });
}
if (R) for (const [kind, lines] of Object.entries(CITY.streets)) for (const L of lines) {
  const wet = L.map(([x, z]) => (CITY.water ?? []).some(w => inPoly(w.poly, x, z)));
  for (let i = 0; i < L.length; i++) {
    if (!wet[i] || wet[i - 1]) continue;
    let j = i;
    while (j + 1 < L.length && wet[j + 1]) j++;
    const a = L[Math.max(0, i - 1)], b = L[Math.min(L.length - 1, j + 1)], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
    BRIDGES.push({ x0: a[0] - ux * 3, z0: a[1] - uz * 3, x1: b[0] + ux * 3, z1: b[1] + uz * 3, w: WIDE[kind] ?? 5, hump: R.hump ?? 2.5 });
    i = j;
  }
}
for (const b of BRIDGES) {
  b.h0 = softAt(b.x0, b.z0); b.h1 = softAt(b.x1, b.z1);
  b.dx = b.x1 - b.x0; b.dz = b.z1 - b.z0; b.L = Math.hypot(b.dx, b.dz);
}
const deck = (b, t) => b.h0 + (b.h1 - b.h0) * t + b.hump * Math.sin(Math.PI * t);
function bridgeAt(x, z) {
  for (const b of BRIDGES) {
    const px = x - b.x0, pz = z - b.z0, t = (px * b.dx + pz * b.dz) / (b.L * b.L);
    if (t >= 0 && t <= 1 && Math.abs(px * b.dz - pz * b.dx) / b.L < b.w / 2 + .5) return deck(b, t);
  }
  return undefined;
}

// The ground's height at a point. terrainAt is the land itself: a lot's platform, else the soft platforms on the
// relief with the moat's ditch. groundAt is where things stand: a bridge's deck over it, else the land.

export function terrainAt(x, z) {
  if (!R) return 0;
  return lotAt(x, z)?.level ?? softAt(x, z) + ditchAt(x, z);
}
export function groundAt(x, z) {
  if (!R) return 0;
  return bridgeAt(x, z) ?? terrainAt(x, z);
}

// The moat's water: a ribbon along the ditch's middle at one level, water metres above the ditch's lowest point,
// drawn where the ditch dips below that level. The banks hide its edges.

export function moatWater() {
  if (!M) return null;
  const n = WALL.length, mid = WALL.map(([x, z]) => {
    const r = Math.hypot(x - WC[0], z - WC[1]) || 1, ox = (x - WC[0]) / r, oz = (z - WC[1]) / r;
    return { x: x + ox * M.offset, z: z + oz * M.offset, ox, oz };
  });
  for (const m of mid) m.bed = softAt(m.x, m.z) - M.depth;
  const level = Math.min(...mid.map(m => m.bed)) + M.water, hw = M.width * .42, v = [];
  for (let i = 0; i < n; i++) {
    const a = mid[i], b = mid[(i + 1) % n];
    if (Math.min(a.bed, b.bed) > level - .1) continue;
    const A0 = [a.x - a.ox * hw, level, a.z - a.oz * hw], A1 = [a.x + a.ox * hw, level, a.z + a.oz * hw];
    const B0 = [b.x - b.ox * hw, level, b.z - b.oz * hw], B1 = [b.x + b.ox * hw, level, b.z + b.oz * hw];
    v.push(...A0, ...B0, ...B1, ...A0, ...B1, ...A1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

// Retaining walls: along each lot edge, in pieces of up to 2 m, a stone wall from below the lower side to just
// above the higher one. Pieces with under 25 cm between the sides are left out. Each wall is battered: 0.5 m thick
// at its top and 1.8 m at its foot, leaning back from the low side. The ground grid leans across a lot edge for a
// cell, and the batter covers that lean.
//
// Steps: on each lot's longest edge onto open ground with at least 45 cm to climb, a flight 1.6 m wide runs from the
// high side down to the low one, treads 32 cm deep and at most 20 cm high, outside the lot when the lot is the
// higher, inside it when the street is. The wall opens where the flight meets it.

function batter() {
  const g = new THREE.BufferGeometry(), P = [[0, 1], [.5, 1], [1.8, 0], [0, 0]], v = [];
  const quad = (a, b, c, d) => v.push(...a, ...b, ...c, ...a, ...c, ...d);
  const at = ([x, y], z) => [x, y, z];
  for (let i = 0; i < 4; i++) { const p = P[i], q = P[(i + 1) % 4]; quad(at(p, -.5), at(p, .5), at(q, .5), at(q, -.5)); }
  quad(at(P[0], .5), at(P[3], .5), at(P[2], .5), at(P[1], .5));
  quad(at(P[0], -.5), at(P[1], -.5), at(P[2], -.5), at(P[3], -.5));
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export function walls(material) {
  if (!R) return null;
  const wall = [], steps = [], RISE = .2, TREAD = .32, WIDE = 1.6;
  for (const l of LOTS) {
    const pieces = [];
    let stair = null;
    l.P.forEach((a, i) => {
      const b = l.P[(i + 1) % l.P.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 2));
      let ox = (b[1] - a[1]) / len, oz = -(b[0] - a[0]) / len;
      if (ox * ((a[0] + b[0]) / 2 - l.cx) + oz * ((a[1] + b[1]) / 2 - l.cz) < 0) { ox = -ox; oz = -oz; }
      for (let k = 0; k < n; k++) {
        const f = (k + .5) / n, x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f, out = softAt(x + ox * .8, z + oz * .8);
        if (Math.abs(out - l.level) >= .25) pieces.push({ x, z, ox, oz, out, L: len / n });
      }
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, out = softAt(mx + ox * 1.5, mz + oz * 1.5);
      if (len > 4 && Math.abs(out - l.level) >= .45 && !lotAt(mx + ox * 1.5, mz + oz * 1.5) && (!stair || len > stair.len)) {
        stair = { x: mx, z: mz, ox, oz, out, len, ry: Math.atan2(b[0] - a[0], b[1] - a[1]) };
      }
    });
    for (const p of pieces) {
      if (stair && Math.hypot(p.x - stair.x, p.z - stair.z) < WIDE / 2 + .6) continue;
      const d = l.level > p.out ? 1 : -1, lo = Math.min(p.out, l.level) - .6, hi = Math.max(p.out, l.level) + .25;
      wall.push([p.x, lo, p.z, p.L + .05, hi - lo, Math.atan2(-p.oz * d, p.ox * d)]);
    }
    if (stair) {
      const up = l.level > stair.out, hi = Math.max(l.level, stair.out), lo = Math.min(l.level, stair.out);
      const n = Math.ceil((hi - lo) / RISE), d = up ? 1 : -1, x0 = stair.x + (up ? stair.ox * .5 : 0), z0 = stair.z + (up ? stair.oz * .5 : 0);
      for (let k = 0; k < n; k++) {
        const top = hi - k * (hi - lo) / n, at = (k + .5) * TREAD * d;
        steps.push([x0 + stair.ox * at, (top + lo - .4) / 2, z0 + stair.oz * at, TREAD + .02, top - lo + .4, WIDE, stair.ry]);
      }
    }
  }

  // A bridge: deck pieces of about 2 m, each tilted to the hump's slope, a parapet along each side, and piers down to the ditch
  // or the river bed at a third and two thirds of its span.

  for (const b of BRIDGES) {
    const n = Math.max(2, Math.ceil(b.L / 2)), ry = Math.atan2(b.dx, b.dz), sx = b.dz / b.L, sz = -b.dx / b.L;
    for (let k = 0; k < n; k++) {
      const t = (k + .5) / n, x = b.x0 + b.dx * t, z = b.z0 + b.dz * t, y = deck(b, t);
      const pitch = -Math.atan((deck(b, t + .5 / n) - deck(b, t - .5 / n)) / (b.L / n)), seg = b.L / n / Math.cos(pitch) + .1;
      steps.push([x, y - .4, z, b.w, .8, seg, ry, pitch]);
      for (const side of [-1, 1]) steps.push([x + sx * side * (b.w / 2 - .2), y + .45, z + sz * side * (b.w / 2 - .2), .4, .9, seg, ry, pitch]);
    }
    for (const t of [1 / 3, 2 / 3]) {
      const x = b.x0 + b.dx * t, z = b.z0 + b.dz * t, top = deck(b, t) - .8, foot = terrainAt(x, z) - 1.5;
      steps.push([x, (top + foot) / 2, z, b.w - .6, top - foot, 1.6, ry]);
    }
  }
  const o = new THREE.Object3D(), group = new THREE.Group();
  const walled = new THREE.InstancedMesh(batter(), material, wall.length), stepped = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, steps.length);
  wall.forEach(([x, y, z, L, h, ry], i) => {
    o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.scale.set(1, h, L); o.updateMatrix();
    walled.setMatrixAt(i, o.matrix);
  });
  o.rotation.order = 'YXZ';
  steps.forEach(([x, y, z, sx, h, sz, ry, pitch = 0], i) => {
    o.position.set(x, y, z); o.rotation.set(pitch, ry, 0); o.scale.set(sx, h, sz); o.updateMatrix();
    stepped.setMatrixAt(i, o.matrix);
  });
  group.add(walled, stepped);
  return group;
}
