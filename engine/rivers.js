// Rivers with a direction, for a pack whose rivers key lists them. Each river is a line from source to mouth with a
// water height and a width at each point. render.js draws it as a sloped ribbon whose ripples run downstream, and as
// a falling sheet with mist where the line drops steeply. hills.js shapes the land round it, boats.js sails it, and
// country.js keeps fields off it. Without a rivers key nothing here is built and every function returns its input.
//
// rivers entries (SETTINGS.md has the full schema):
//   water 'Gardel'      take the line from this city-file river, a band of near bank then far bank back; the
//                       river replaces its flat outline
//   reverse true        the band's first point is the mouth, not the source
//   y .12 | [[f, y]]    water height: one level, or keys by share f of the length (band points only)
//   head [[x, z, y, w]] points upstream of the band's source, source first
//   line [[x, z, y, w]] a river of its own points instead of a band
//   speed .5            the current in metres a second on level water; it grows with the slope
//   scarp 6 × width     half the length of the cliff each fall cuts across the land
//   spring              the source is a spring: true by default when it is a head or line point
//
// A stretch that drops more than it runs, and more than 2 m, is a fall.

import * as THREE from 'three';
import { CITY, rng, smooth, vnoise } from './core.js';
import { SETTING } from './setting.js';

const ASK = SETTING.rivers ?? [], STEP = 6, DEPTH = 1.5, CELL = 32, REACH = 96, BACK = 18, BED = 10;
const inPoly = (P, x, z) => {
  let a = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) a = !a;
  }
  return a;
};
const boxOf = P => [Math.min(...P.map(p => p[0])), Math.min(...P.map(p => p[1])), Math.max(...P.map(p => p[0])), Math.max(...P.map(p => p[1]))];
const inside = ({ P, box }, x, z) => x > box[0] && z > box[1] && x < box[2] && z < box[3] && inPoly(P, x, z);

// A city-file band as cross sections: middle point, width and both banks.

function band(P, reverse, y) {
  const n = P.length, out = [];
  for (let i = 0; i < n >> 1; i++) {
    const a = P[i], b = P[n - 1 - i];
    out.push({ x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, w: Math.hypot(a[0] - b[0], a[1] - b[1]), L: a, R: b });
  }
  if (reverse) out.reverse();
  let s = 0;
  out.forEach((p, i) => { if (i) s += Math.hypot(p.x - out[i - 1].x, p.z - out[i - 1].z); p.s = s; });
  const keys = typeof y === 'number' ? [[0, y], [1, y]] : y;
  for (const p of out) {
    const f = s ? p.s / s : 0, k = keys.findIndex(q => q[0] >= f);
    const [f0, y0] = keys[Math.max(0, k - 1)] ?? keys[0], [f1, y1] = keys[k < 0 ? keys.length - 1 : k];
    p.y = f1 > f0 ? y0 + (y1 - y0) * (f - f0) / (f1 - f0) : y1;
  }
  return out;
}

// Pack points, cut into pieces of at most STEP metres, except across a fall.

const isFall = (a, b) => { const h = Math.hypot(b.x - a.x, b.z - a.z), d = a.y - b.y; return d > 2 && d > h; };
function points(list) {
  const out = [];
  list.map(([x, z, y, w]) => ({ x, z, y, w })).forEach((p, i, A) => {
    const a = A[i - 1];
    if (a && !isFall(a, p)) {
      const n = Math.ceil(Math.hypot(p.x - a.x, p.z - a.z) / STEP);
      for (let k = 1; k < n; k++) {
        const t = k / n;
        out.push({ x: a.x + (p.x - a.x) * t, z: a.z + (p.z - a.z) * t, y: a.y + (p.y - a.y) * t, w: a.w + (p.w - a.w) * t });
      }
    }
    out.push(p);
  });
  return out;
}

const STILL = (CITY.water ?? []).filter(w => !ASK.some(r => r.water === w.name)).map(w => ({ P: w.poly, box: boxOf(w.poly) }));
export const CLAIMED = new Set(ASK.map(r => r.water).filter(Boolean));
export const RIVERS = [], FALLS = [];

for (const [rank, A] of ASK.entries()) {
  const src = A.water && CITY.water?.find(w => w.name === A.water);
  if (A.water && !src) { console.warn(`rivers: no water named ${A.water}`); continue; }
  const head = points(A.head ?? []), P = [...head, ...src ? band(src.poly, A.reverse, A.y ?? .12) : points(A.line ?? [])];
  if (P.length < 2) continue;

  // A spring, a source that no lake or earlier river feeds, starts as a stream a third as wide and a third as deep
  // and widens to the river over four widths. p.taper is 0 at the spring and 1 past it.

  P.forEach((p, i) => { p.s = i ? P[i - 1].s + Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z) : 0; p.taper = 1; });
  const fed = [...STILL, ...RIVERS.map(o => o.outline)].some(w => inside(w, P[0].x, P[0].z));
  if ((A.spring ?? (head.length > 0 || !src)) && !fed) {
    const L = 4 * P[0].w;
    for (const p of P) {
      if (p.s >= L) break;
      p.taper = smooth(0, L, p.s);
      const f = .33 + .67 * p.taper;
      p.w *= f;
      if (p.L) { p.L = [p.x + (p.L[0] - p.x) * f, p.z + (p.L[1] - p.z) * f]; p.R = [p.x + (p.R[0] - p.x) * f, p.z + (p.R[1] - p.z) * f]; }
    }
  }

  // Banks for pack points, square to the line's mean direction there.

  P.forEach((p, i) => {
    if (p.L) return;
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = -(b.z - a.z) / len * p.w / 2, nz = (b.x - a.x) / len * p.w / 2;
    p.L = [p.x + nx, p.z + nz]; p.R = [p.x - nx, p.z - nz];
  });

  // Distance along, falls, current, travel time and foam. The current grows with the slope; travel time, the
  // integral of distance over current, runs the ripples downstream at the local speed without shearing them.

  const base = A.speed ?? .5, seg = [];
  P.forEach(p => { p.foam = 0; });
  for (let i = 0; i + 1 < P.length; i++) seg.push(isFall(P[i], P[i + 1]));
  P.forEach((p, i) => {
    const g = [i - 1, i].filter(k => k >= 0 && k + 1 < P.length && !seg[k]).map(k => Math.max(0, P[k].y - P[k + 1].y) / Math.max(.1, P[k + 1].s - P[k].s));
    p.v = Math.min(6, base + 30 * (g.length ? g.reduce((s, v) => s + v, 0) / g.length : 0));
    p.a = i ? P[i - 1].a + (seg[i - 1] ? 1 : (p.s - P[i - 1].s) / ((p.v + P[i - 1].v) / 2)) : 0;
  });
  const reaches = [];
  let start = 0;
  for (let i = 0; i <= seg.length; i++) {
    if (i < seg.length && !seg[i]) continue;
    reaches.push([start, i]);
    if (i === seg.length) break;
    const lip = P[i], foot = P[i + 1], h = foot.s - lip.s || 1, w = Math.max(lip.w, foot.w);
    const up = P.slice(start, i + 1), dx = (foot.x - lip.x) / h, dz = (foot.z - lip.z) / h;
    FALLS.push({ x: lip.x, z: lip.z, y: lip.y, foot: foot.y, dx, dz, w, lip, low: foot, k: FALLS.length * 7.3,
      top: Math.max(...up.map(p => p.y)) + .5, S: A.scarp ?? w * 6, U: lip.s - P[start].s });
    for (const p of P) {
      if (p.s >= foot.s) p.foam = Math.max(p.foam, 1 - (p.s - foot.s) / 45);
      else if (p.s <= lip.s) p.foam = Math.max(p.foam, .5 * (1 - (lip.s - p.s) / 12));
    }
    start = i + 1;
  }
  const banks = Q => [...Q.map(p => p.L), ...Q.map(p => p.R).reverse()], outline = banks(P);
  RIVERS.push({ name: A.water ?? A.name ?? `river ${rank}`, rank, P, seg, reaches, outline: { P: outline, box: boxOf(outline) },
    extra: !src ? outline : head.length ? banks(P.slice(0, head.length + 1)) : null });
}

// Outlines that are not already in the city file's water, for the country to keep off.

export const RIVER_OUTLINES = RIVERS.map(r => r.extra).filter(Boolean);

// The river's middle segments in a CELL grid, for the land.

const GRID = new Map(), NEAR = new Set(), key = (i, j) => i * 65536 + j, R3 = Math.ceil(REACH / CELL);
for (const r of RIVERS) for (let i = 0; i + 1 < r.P.length; i++) {
  const a = r.P[i], b = r.P[i + 1], e = { a, b, ex: b.x - a.x, ez: b.z - a.z, fall: r.seg[i], first: i === 0, last: i + 2 === r.P.length };
  e.L2 = e.ex * e.ex + e.ez * e.ez || 1;
  for (let gi = Math.floor(Math.min(a.x, b.x) / CELL); gi <= Math.floor(Math.max(a.x, b.x) / CELL); gi++)
    for (let gj = Math.floor(Math.min(a.z, b.z) / CELL); gj <= Math.floor(Math.max(a.z, b.z) / CELL); gj++) {
      const k = key(gi, gj);
      if (!GRID.has(k)) GRID.set(k, []);
      GRID.get(k).push(e);
      for (let di = -R3; di <= R3; di++) for (let dj = -R3; dj <= R3; dj++) NEAR.add(key(gi + di, gj + dj));
    }
}

// The nearest point of any river within REACH: its distance d, water height y, half width hw and the spring's
// taper. Next to a fall the water is the pool's. Past either end of the line, beyond is how far past it the point
// lies along the end's direction and d is the distance square to that direction.

export function nearRiver(x, z) {
  const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
  if (!NEAR.has(key(ci, cj))) return null;
  let best = null, bd = REACH * REACH;
  for (let i = ci - R3; i <= ci + R3; i++) for (let j = cj - R3; j <= cj + R3; j++) for (const e of GRID.get(key(i, j)) ?? []) {
    const raw = ((x - e.a.x) * e.ex + (z - e.a.z) * e.ez) / e.L2, t = Math.max(0, Math.min(1, raw));
    const d2 = (x - e.a.x - e.ex * t) ** 2 + (z - e.a.z - e.ez * t) ** 2;
    if (d2 < bd) { bd = d2; best = { e, t, raw }; }
  }
  if (!best) return null;
  const { e, t, raw } = best, len = Math.sqrt(e.L2);
  const beyond = e.first && raw < 0 ? -raw * len : e.last && raw > 1 ? (raw - 1) * len : 0;
  const d = beyond ? Math.abs((x - e.a.x) * e.ez - (z - e.a.z) * e.ex) / len : Math.sqrt(bd);
  return { d, beyond, y: e.fall ? e.b.y : e.a.y + (e.b.y - e.a.y) * t, hw: (e.a.w + (e.b.w - e.a.w) * t) / 2,
    taper: e.a.taper + (e.b.taper - e.a.taper) * t };
}

// The land round the rivers, from the land's own height h:
// - Upstream of each fall a tableland rises to the river's highest water + 0.5 m. Its front is the cliff the fall
//   drops over, scarp metres to each side, ragged away from the river. Past its sides and its upstream end it falls
//   away steeply. The front stands BACK metres behind the lip, and the land between sinks below the pool, so the
//   land grid's slope down the cliff lies inside the rock at the lip and the pool stays clear.
// - Where the land stands above the water, the river cuts its bed DEPTH metres deep with banks rising at 0.8. At a
//   spring the bed starts a third as deep. The bed is at least BED metres to each side, so a land grid of up to
//   16 m keeps a narrow stream in the open. Past either end of the line the bed rises 0.3 m a metre, so the cut
//   runs out as the head of a dry valley instead of a bowl.
// - Where the water stands 0.3 to 3 m above the land, banks rise to 0.25 m above it.
// Land already a little below the water keeps its height, so a town's flat river changes nothing.

export function shapeLand(x, z, h) {
  if (!RIVERS.length) return h;
  for (const F of FALLS) {
    const px = x - F.x, pz = z - F.z, u = px * F.dx + pz * F.dz, v = Math.abs(px * F.dz - pz * F.dx);
    if (u > -BACK - 4 && u < 4 && v < F.w / 2 + 22) h = Math.min(h, F.foot - 1);
    else if (u + BACK + 30 * vnoise(v / 50 + F.k, 3) * smooth(F.w / 2 + 25, F.w / 2 + 90, v) <= 0)
      h = Math.max(h, F.top - Math.max(0, v - F.S) * 1.2 - Math.max(0, -u - F.U - 40) * .4);
  }
  const q = nearRiver(x, z);
  if (!q) return h;
  const { d, y, hw, beyond, taper } = q;
  const hb = Math.max(hw, BED);
  if (h > y - .05) return Math.min(h, y - DEPTH * (.35 + .65 * taper) * (1 - smooth(hb * .5, hb + 1.5, d)) + Math.max(0, d - hb - 1) * .8 + beyond * .3);
  if (y > h + .3 && y < h + 3 && d > hw - 2) return Math.max(h, y + .25 - Math.max(0, d - hw - 1) * .5);
  return h;
}

// ---------- geometry for render.js ----------

// The water: a quad between each pair of cross sections, outside the falls. A quad whose middle lies in still water
// or in an earlier river is left out, so a lake or the main river shows there. aFlow is across (m), travel time (s),
// current (m/s) and foam; aRank lifts later rivers' depth a hair, so a tributary's mouth wins over the main river.

export function riverGeometry() {
  const pos = [], flow = [], rank = [];
  for (const r of RIVERS) {
    const { P, seg } = r, earlier = RIVERS.filter(o => o.rank < r.rank).map(o => o.outline);
    const put = (p, side) => { const b = side < 0 ? p.L : p.R; pos.push(b[0], p.y, b[1]); flow.push(side * p.w / 2, p.a, p.v, p.foam); rank.push(r.rank); };
    for (let i = 0; i + 1 < P.length; i++) {
      if (seg[i]) continue;
      const a = P[i], b = P[i + 1], mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      if (STILL.some(w => inside(w, mx, mz)) || earlier.some(o => inside(o, mx, mz))) continue;
      put(a, -1); put(a, 1); put(b, 1); put(a, -1); put(b, 1); put(b, -1);
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 4));
  g.setAttribute('aRank', new THREE.Float32BufferAttribute(rank, 1));
  return g;
}

// The falling sheets: rows from the lip to 0.3 m under the pool, the water leaving the lip level and falling on a
// parabola. aFall is across (m), share of the fall, and its height.

export function fallsGeometry() {
  if (!FALLS.length) return null;
  const pos = [], fall = [], ROWS = 10;
  for (const F of FALLS) {
    const { lip: a, low: b } = F, drop = a.y - b.y + .3, nx = -F.dz, nz = F.dx;
    const row = k => {
      const t = k / ROWS, w = a.w + (b.w - a.w) * t * .5, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y - drop * t * t;
      return [[x + nx * w / 2, y, z + nz * w / 2, -w / 2, t], [x - nx * w / 2, y, z - nz * w / 2, w / 2, t]];
    };
    for (let k = 0; k < ROWS; k++) {
      const [p, q] = row(k), [r, s] = row(k + 1);
      for (const v of [p, q, s, p, s, r]) { pos.push(v[0], v[1], v[2]); fall.push(v[3], v[4], drop); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFall', new THREE.Float32BufferAttribute(fall, 3));
  return g;
}

// Mist at each fall's foot: twelve soft quads that the shader turns to the camera and lifts in a loop. aMist is the
// quad corner and a phase; aSize the puff's size.

export function mistGeometry() {
  if (!FALLS.length) return null;
  const pos = [], mist = [], size = [], r = rng(9091);
  for (const F of FALLS) for (let k = 0; k < 12; k++) {
    const along = 2 + r() * F.w * .5, across = (r() - .5) * F.w, x = F.x + F.dx * along - F.dz * across, z = F.z + F.dz * along + F.dx * across;
    const ph = r(), s = F.w * (.25 + r() * .3);
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) { pos.push(x, F.foot + s * .3, z); mist.push(cx, cy, ph); size.push(s); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aMist', new THREE.Float32BufferAttribute(mist, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  return g;
}

// The rock at each lip, as one faceted mesh per fall in the fall's own frame: a across the river, u downstream from
// the lip, y up.
// - The face is a grid from 1.5 m under the pool to the top. Strata 1.6 to 2.8 m thick step it back and forth, each
//   with a ledge at its top and an undercut below. Joints a few metres apart break each stratum into blocks that
//   stand out or sit back, and noise breaks every vertex.
// - Behind the sheet the face stands at least 0.3 m back from the lip, and its top lies just under the water.
//   Beside the river it rises a little over the tableland, and towards its ends it bends back to the tableland's
//   front, so it meets the land's own cliff.
// - Its top runs back past the tableland's front, over the land grid's slope there, and dips into the ground.
// - A talus apron bulges out at its foot. Boulders lie on it, and a few stand in the pool.
// rgb is the rock's tone; strata, ledges and boulders vary it.

export function rockGeometry(rgb) {
  if (!FALLS.length) return null;
  const pos = [], col = [], r = rng(4441), n = (a, b) => vnoise(a, b) - .5;
  const tri = (p, q, s, k) => { pos.push(...p, ...q, ...s); for (let i = 0; i < 3; i++) col.push(...k); };
  for (const F of FALLS) {
    const hw = F.w / 2, A = hw + 30, bottom = F.foot - 1.5, seed = F.k * 13;
    const at = (a, u, y) => [F.x - F.dz * a + F.dx * u, y, F.z + F.dx * a + F.dz * u];
    const top = a => {
      const k = smooth(hw - 1, hw + 5, Math.abs(a));
      return F.y - .25 + (F.top + .4 + 1.2 * vnoise(a / 7 + seed, 1) - F.y + .25) * k;
    };
    const layer = (a, y) => {
      const t = (y - bottom) / 2.2 + .4 * n(a / 11 + seed, 3), q = Math.floor(t);
      return { q, f: t - q, tone: .84 + .26 * vnoise(q * 1.7 + seed, 5) };
    };

    // The face: u for each (a, y), tones per stratum.

    const NA = Math.ceil(2 * A / 1.6), NY = Math.ceil((F.top + 2 - bottom) / .9), face = [];
    for (let i = 0; i <= NA; i++) {
      const a = -A + 2 * A * i / NA, end = smooth(hw + 6, A, Math.abs(a)), t0 = top(a), dry = smooth(hw - 1, hw + 3, Math.abs(a)), column = [];
      for (let j = 0; j <= NY; j++) {
        const y = bottom + (t0 - bottom) * j / NY, L = layer(a, y);
        const joint = Math.floor((a + 4 * n(y / 6, seed)) / (3.5 + 3 * vnoise(L.q + seed, 9))), block = vnoise(joint * 5.3 + L.q * 1.9, seed) - .5;
        const strata = ((vnoise(L.q * 3.1 + seed, a / 23) - .5) * 2.2 + block * 1.6) * dry - .6 * smooth(.25, .05, L.f) + .5 * smooth(.6, .95, L.f) * dry;
        const talus = 3.5 * (1 - smooth(bottom, bottom + 6, y)) * (.6 + .8 * vnoise(a / 6 + seed, 7));
        const u = Math.min(-.3, -.3 + strata - .8 + .7 * n(a / 2.3, y / 2.3) - .6 * (1 - dry)) + talus * dry - (BACK + 4) * end;
        column.push({ p: at(a, u, y), k: rgb.map(v => v * L.tone * (.9 + .2 * vnoise(a / 3, y / 3))) });
      }
      face.push(column);
    }
    for (let i = 0; i < NA; i++) for (let j = 0; j < NY; j++) {
      const a = face[i][j], b = face[i + 1][j], c = face[i + 1][j + 1], d = face[i][j + 1];
      tri(a.p, b.p, c.p, a.k); tri(a.p, c.p, d.p, c.k);
    }

    // The top, from the face's top edge back over the tableland's front, dipping 2 m under the ground at its back.

    const NB = 8, back = -(BACK + 20);
    let prev = face.map(c => ({ p: c[NY].p, k: c[NY].k }));
    for (let m = 1; m <= NB; m++) {
      const row = face.map((c, i) => {
        const a = -A + 2 * A * i / NA, f = m / NB, edge = c[NY].p, u0 = (edge[0] - F.x) * F.dx + (edge[2] - F.z) * F.dz;
        const y = top(a) + .5 * n(a / 4, m) - 2.5 * smooth(.7, 1, f);
        return { p: at(a, u0 + (back - u0) * f, y), k: rgb.map(v => v * (1.02 + .12 * vnoise(a / 5, m))) };
      });
      for (let i = 0; i < NA; i++) {
        const A0 = prev[i], B0 = prev[i + 1], C0 = row[i + 1], D0 = row[i];
        tri(A0.p, D0.p, C0.p, D0.k); tri(A0.p, C0.p, B0.p, A0.k);
      }
      prev = row;
    }

    // Boulders: squashed icosahedra, part sunk, on the talus and in the pool.

    const ICO = new THREE.IcosahedronGeometry(1, 0);
    for (let b = 0; b < 12; b++) {
      const side = r() < .5 ? -1 : 1, pool = b % 3 === 0, sz = .9 + r() * (pool ? 1.8 : 2.6);
      const a = side * (pool ? r() * hw * .9 : hw + 2 + r() * 16), u = pool ? 5 + r() * 10 : r() * 2.5;
      const g = ICO.clone(), P = g.attributes.position;
      for (let v = 0; v < P.count; v++) P.setXYZ(v, P.getX(v) * sz * (.8 + .5 * r()), P.getY(v) * sz * (.55 + .3 * r()), P.getZ(v) * sz * (.8 + .5 * r()));
      g.rotateY(r() * 6.3);
      const [x, , z] = at(a, u, 0), y = pool ? F.foot - .5 : F.foot + sz * .1, k = rgb.map(v => v * (.75 + .25 * r()));
      const N = g.toNonIndexed().attributes.position.array;
      for (let v = 0; v < N.length; v += 9) tri([x + N[v], y + N[v + 1], z + N[v + 2]], [x + N[v + 3], y + N[v + 4], z + N[v + 5]], [x + N[v + 6], y + N[v + 7], z + N[v + 8]], k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// ---------- for boats.js ----------

// Each river's reaches as paths every 4 m along its middle, at the water: clear of a fall's lip by 15 m, of its
// pool by 25 m and of a spring's narrow stream. Each point carries the current. Reaches under 80 m are left out.

export function reachPaths(r) {
  const out = [];
  for (const [i0, i1] of r.reaches) {
    const P = r.P, s0 = i0 ? P[i0].s + 25 : P.find(p => p.taper >= 1).s, s1 = P[i1].s - (i1 < P.length - 1 ? 15 : 0);
    if (s1 - s0 < 80) continue;
    const path = [];
    for (let s = s0, k = i0; s <= s1; s += 4) {
      while (k + 1 < i1 && P[k + 1].s < s) k++;
      const a = P[k], b = P[Math.min(k + 1, i1)], t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
      const p = new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
      p.v = a.v + (b.v - a.v) * t;
      path.push(p);
    }
    out.push(path);
  }
  return out;
}
