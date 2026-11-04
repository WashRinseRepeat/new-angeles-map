// The Rebenberg's slopes: terraced vineyards held by dry-stone walls, with rows of vines along the contours, stairs,
// vineyard huts, a wayside shrine and the wine press house, then woods on the steep flanks and orchards on the
// gentler ground below the village. Everything builds in world coordinates as one free landmark.

import { SAND, RED, helpers } from './common.js';
import { groundAt } from '../../../engine/relief.js';

export const kits = () => ({});

// Palette.

const EARTH = [[.2, .15, .09], [.17, .14, .08], [.13, .13, .06]], VINE = [.08, .14, .05], GOLDEN = [.4, .3, .07], RUSSET = [.34, .1, .05];
const POST = [.14, .1, .06], DOOR = [.08, .06, .04], CASK = [.24, .14, .07], LAMP = [1.9, .9, .3];

// Small helpers: a hashed value noise, point in polygon and distance to a polygon's edge.

const h2 = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); };
const vn = (x, z) => {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = h2(i, j), b = h2(i + 1, j), c = h2(i, j + 1), d = h2(i + 1, j + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
};
const inPoly = (x, z, P) => {
  let a = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) a = !a;
  }
  return a;
};
const segDist = (x, z, ax, az, bx, bz) => {
  const ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
  return Math.hypot(x - ax - ex * t, z - az - ez * t);
};
const edgeDist = (x, z, P) => { let d = Infinity; for (let i = 0, j = P.length - 1; i < P.length; j = i++) d = Math.min(d, segDist(x, z, ...P[j], ...P[i])); return d; };
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// The woods and orchards share one instanced tree of unit height. The crown stays white so the instance colour tints it.

let TREES = null;
function treeMesh(H) {
  if (TREES) return TREES;
  const T = H.THREE;
  const paint = (g, rgb) => {
    g = g.index ? g.toNonIndexed() : g;
    g.setAttribute('color', new T.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => rgb).flat(), 3));
    g.deleteAttribute('uv');
    return g;
  };
  const parts = [paint(new T.CylinderGeometry(.04, .06, .45, 5).translate(0, .22, 0), [1.7, .75, .55]),
    paint(new T.IcosahedronGeometry(.36, 0).scale(1, .85, 1).translate(0, .62, 0), [1, 1, 1])];
  const geo = new T.BufferGeometry();
  for (const k of ['position', 'normal', 'color']) {
    const arr = parts.flatMap(g => Array.from(g.attributes[k].array));
    geo.setAttribute(k, new T.Float32BufferAttribute(arr, 3));
  }
  TREES = H.instanced(new T.InstancedMesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: .9, flatShading: true }), 6000));
  TREES.userData.massing = true;
  return TREES;
}

export function landmarks(H) {
  const { bld, prop, glow, flickerGlow, SKINS, CITY } = H, out = {};
  const { opt, STONE } = helpers(H, out);
  const vines = CITY.features?.vineyards ?? [], hill = CITY.features?.hill;
  if (!vines.length || !hill) return out;
  const [CX, CZ] = hill.at, village = CITY.districts.find(d => d.id === 'rebenhain')?.poly ?? [];
  const castle = (CITY.sites ?? []).find(s => s.kind === 'hillcastle');
  const pos = (r, b) => [CX + r * Math.cos(b), CZ + r * Math.sin(b)];
  const bearing = (x, z) => Math.atan2(z - CZ, x - CX);

  // Streets as segments in a 20 m hash, each with its half width.

  const segs = [], grid = new Map(), cell = 20, key = (i, j) => i * 100003 + j;
  for (const [kind, list] of Object.entries(CITY.streets ?? {})) for (const L of list) for (let i = 1; i < L.length; i++) {
    const s = [...L[i - 1], ...L[i], (CITY.widths?.[kind] ?? 4) / 2], n = segs.push(s) - 1;
    for (const [x, z] of [L[i - 1], L[i]]) {
      const k = key(Math.floor(x / cell), Math.floor(z / cell));
      if (!grid.has(k)) grid.set(k, new Set());
      grid.get(k).add(n);
    }
  }

  // Clearance from the nearest street edge, looked up to 20 m away.

  const clearance = (x, z) => {
    let d = 99;
    const i0 = Math.floor(x / cell), j0 = Math.floor(z / cell);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) for (const n of grid.get(key(i, j)) ?? []) {
      const s = segs[n];
      d = Math.min(d, segDist(x, z, s[0], s[1], s[2], s[3]) - s[4]);
    }
    return d;
  };
  const inVine = (x, z) => vines.some(P => inPoly(x, z, P));

  // A box chord from bearing b0 to b1 at radius rr, depth dr, from absolute height y0 to y1.

  const chord = (rr, b0, b1) => {
    const [ax, az] = pos(rr, b0), [bx, bz] = pos(rr, b1);
    return { x: (ax + bx) / 2, z: (az + bz) / 2, L: Math.hypot(bx - ax, bz - az) + .3, ry: Math.atan2(-(bz - az), bx - ax) };
  };
  const slab = (rr, b0, b1, dr, y0, y1, rgb) => {
    const c = chord(rr, b0, b1);
    prop('box', c.x, (y0 + y1) / 2 - groundAt(c.x, c.z), c.z, c.L, y1 - y0, dr, rgb, c.ry);
    return c;
  };

  // Runs of clear samples along an arc, cut into chords of at most 30 m.

  const STEP = 2.5;
  const runs = (r, bA, bB, ok) => {
    const db = STEP / r, n = Math.floor((bB - bA) / db), list = [];
    let k0 = -1;
    for (let k = 0; k <= n; k++) {
      const good = k < n && ok(bA + (k + .5) * db);
      if (good && k0 < 0) k0 = k;
      if ((!good || k - k0 >= 12) && k0 >= 0) { list.push([bA + k0 * db, bA + k * db, !good]); k0 = good ? k : -1; }
    }
    return list;
  };

  out.nb_vineyards = {
    at: [0, 0], free: [1, 1],
    build(x0, z0, w0, d0, st, r) {
      const WALL = STONE(st, 0, [.22, .18, .13]), keep = [], stairs = [];

      // The wine press house stands just below the village's south-east corner, long side along the contour.

      let kel = null, best = Infinity;
      for (let deg = 54; deg <= 72; deg += .5) for (let rr = 528; rr <= 580; rr += 4) {
        const b = deg * Math.PI / 180, [x, z] = pos(rr, b);
        if (inPoly(x, z, village) || edgeDist(x, z, village) < 8 || clearance(x, z) < 11) continue;
        const cost = Math.abs(deg - 60) + Math.abs(rr - 540) / 8;
        if (cost < best) { best = cost; kel = { x, z, b, rr }; }
      }
      if (kel) keep.push([kel.x, kel.z, 15]);

      // The wayside shrine stands beside the first street that passes through a vineyard.

      let shrine = null;
      for (const s of segs) {
        const mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2, L = Math.hypot(s[2] - s[0], s[3] - s[1]) || 1;
        if (shrine || !inVine(mx, mz) || Math.hypot(mx - CX, mz - CZ) < 330) continue;
        for (const side of [-1, 1]) {
          const nx = -(s[3] - s[1]) / L * side, nz = (s[2] - s[0]) / L * side, x = mx + nx * (s[4] + 2.2), z = mz + nz * (s[4] + 2.2);
          if (!shrine && inVine(x, z) && clearance(x, z) > 1.8) shrine = { x, z, ry: Math.atan2(-nx, -nz) };
        }
      }

      // Terraces run along the contours, 5.5 m deep. Each is a flat earth fill behind a dry-stone wall at its outer,
      // downhill edge, so the wall rises from the terrace below to this one's floor and grows tall where it is steep.

      const W = 5.5;
      let ti = 0;
      for (const P of vines) {
        const bs = P.map(([x, z]) => bearing(x, z)), rs = P.map(([x, z]) => Math.hypot(x - CX, z - CZ));
        const bA = Math.min(...bs), bB = Math.max(...bs), rA = Math.min(...rs), rB = Math.max(...rs);
        const stairB = [.3, .68].map(f => bA + (bB - bA) * f);

        // A few vineyard huts on the terrace floors, kept off the stairs.

        const huts = [];
        for (let k = 0; k < 3; k++) {
          const ri = rA + W * (3 + Math.floor(r() * ((rB - rA) / W - 6))), b = bA + (bB - bA) * (.12 + .76 * r());
          if (stairB.some(sb => Math.abs(sb - b) * ri < 6)) continue;
          const [x, z] = pos(ri + W / 2 - .3, b);
          if (clearance(x, z) < 7 || !inPoly(x, z, P)) continue;
          huts.push({ x, z, b, ri });
          keep.push([x, z, 3.6]);
        }

        for (let ro = rA + W; ro <= rB; ro += W, ti++) {
          const ri = ro - W, mid = (bA + bB) / 2, yT = groundAt(...pos(ri, mid)), yB = groundAt(...pos(ro, mid)), H_ = yT - yB;
          const open = b => [ro - .2, ri + .2, ro - W / 2].every(rr => { const [x, z] = pos(rr, b); return inPoly(x, z, P) && clearance(x, z) > 5; });
          const onStair = (b, half) => stairB.some(sb => Math.abs(sb - b) * ro < half);
          const kept = (b, rr) => { const [x, z] = pos(rr, b); return keep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr); };

          // Earth fill, then the wall in front of it, broken where a stair climbs through.

          for (const [b0, b1] of runs(ro, bA, bB, open)) slab(ri + (W - .6) / 2, b0, b1, W - .6, yB - .5, yT, EARTH[Math.floor(r() * 3)]);
          for (const [b0, b1] of runs(ro, bA, bB, b => open(b) && !onStair(b, 1))) {
            const c = chord(ro - .35, b0, b1);
            bld(c.x, c.z, c.L, .7, H_ + .75, WALL, r, opt({ y0: yB - .5 - groundAt(c.x, c.z), skin: SKINS.blindRubble, ry: c.ry, lit: 0 }));
          }

          // Two rows of vines on the floor. Patches turn gold and red, and each run of a row ends in a stout post.

          for (const rr of [ri + 1.5, ri + 3.6]) for (const [b0, b1, end] of runs(rr, bA, bB, b => open(b) && !onStair(b, 2) && !kept(b, rr))) {
            const n = vn(b0 * rr / 40, ti / 3), v = .8 + .4 * r();
            const rgb = n > .87 ? RUSSET : n > .79 ? GOLDEN : VINE.map(c => c * v);
            slab(rr, b0, b1, .55, yT, yT + 1.3, rgb);
            if (end) { const [px, pz] = pos(rr, b1); prop('box', px, yT + .8 - groundAt(px, pz), pz, .16, 1.6, .16, POST); }
          }

          // Stairs climb from the terrace below up through the wall, as stacked solid steps.

          if (ro + W <= rB) for (const sb of stairB) {
            if (!open(sb)) continue;
            const n = Math.max(2, Math.ceil(H_ / .65)), rise = H_ / n, tread = Math.min(.42, (W - 1.2) / n);
            for (let k = 0; k < n; k++) {
              const depth = (n - k) * tread;
              slab(ro + depth / 2 - .05, sb - .7 / ro, sb + .7 / ro, depth, yB - .3, yB + (k + 1) * rise, [.36, .3, .22].map(c => c * (.9 + .2 * r())));
            }
          }
        }
        stairs.push(...stairB);

        // Vineyard huts: rubble walls, a tiled gable, a door to the downhill side.

        for (const h of huts) {
          const yT = groundAt(...pos(h.ri, h.b)), g = groundAt(h.x, h.z), ry = Math.atan2(-Math.cos(h.b), -Math.sin(h.b));
          bld(h.x, h.z, 3.2, 2.8, 2.5, STONE(st, 0, SAND), r, opt({ y0: yT - g, skin: SKINS.blindRubble, ry }));
          bld(h.x, h.z, 3.6, 3.3, 1.5, STONE(st, 0, SAND), r, opt({ y0: yT + 2.5 - g, shape: 'gable', skin: SKINS.tile, base: RED, ry }));
          const [dx, dz] = [Math.cos(h.b) * 1.42, Math.sin(h.b) * 1.42];
          prop('box', h.x + dx, yT + .9 - groundAt(h.x + dx, h.z + dz), h.z + dz, .9, 1.8, .1, DOOR, ry);
        }
      }

      // The wine press house: a stone platform cut into the slope, a stone hall with a tiled roof, a barn door and
      // casks before it, and a lantern by the door.

      if (kel) {
        const ry = Math.atan2(-Math.cos(kel.b), -Math.sin(kel.b)), tx = -Math.sin(kel.b), tz = Math.cos(kel.b), nx = Math.cos(kel.b), nz = Math.sin(kel.b);
        const at = (u, v) => [kel.x + tx * u + nx * v, kel.z + tz * u + nz * v];
        const gs = [[-9, -6], [9, -6], [-9, 6], [9, 6]].map(([u, v]) => groundAt(...at(u, v)));
        const lo = Math.min(...gs) - .5, top = Math.max(...gs) + .3, g = groundAt(kel.x, kel.z);
        bld(kel.x, kel.z, 18, 12, top - lo, STONE(st, 0, SAND), r, opt({ y0: lo - g, skin: SKINS.blindRubble, ry }));
        bld(kel.x, kel.z, 15, 9, 4.6, STONE(st, .35, [.36, .3, .22]), r, opt({ y0: top - g, skin: SKINS.ashlar, ry }));
        bld(kel.x, kel.z, 15.6, 9.8, 5.2, STONE(st, 0, SAND), r, opt({ y0: top + 4.6 - g, shape: 'gable', skin: SKINS.tiles, base: RED, ry }));
        const P = (u, y, v, sx, sy, sz, rgb, rx = 0) => { const [x, z] = at(u, v); prop('box', x, y - groundAt(x, z), z, sx, sy, sz, rgb, ry, rx); };
        P(0, top + 1.6, 4.55, 3.2, 3.2, .15, DOOR);
        for (let k = 0; k < 4; k++) {
          const [x, z] = at(-5.5 + k * 1.3, 5.3);
          prop('cyl', x, top + .5 - groundAt(x, z), z, 1, 1.2, 1, CASK);
        }
        const [lx, lz] = at(2.2, 4.75);
        flickerGlow(lx, top + 2.6 - groundAt(lx, lz), lz, .22, .3, .22, LAMP, r, .7);
      }

      // The wayside shrine: a sandstone shaft, a niche with a candle, a little gabled cap.

      if (shrine) {
        const { x, z, ry } = shrine, S = [.4, .32, .22];
        prop('box', x, .1, z, .8, .2, .8, S, ry);
        prop('box', x, 1, z, .3, 1.8, .3, S, ry);
        prop('box', x, 2.25, z, .7, .8, .45, S, ry);
        prop('box', x + Math.sin(ry) * .2, 2.25, z + Math.cos(ry) * .2, .45, .5, .1, [.05, .04, .03], ry);
        prop('box', x, 2.8, z, .82, .12, .6, RED, ry);
        prop('box', x, 3.05, z, .06, .4, .06, [.5, .4, .2], ry);
        flickerGlow(x + Math.sin(ry) * .26, 2.15, z + Math.cos(ry) * .26, .08, .14, .08, LAMP, r, .6);
      }

      // Woods on the steep slopes outside vineyards, village, castle and streets, densest on the east and west flanks
      // and thinning toward the vineyards. Orchards of small fruit trees take the gentler ground below the village.

      const M = treeMesh(H);
      if (!M.parent) (H.decor.parent ?? H.decor).add(M);
      const R = hill.r, rand = H.rng(H.hash(911, 37));
      const tree = (x, z, h, sx, rgb) => H.put(M, x, -.4, z, sx, h, sx, rand() * 6.3, 0, rgb);
      const castleOut = (x, z) => !castle || Math.hypot(x - castle.at[0], z - castle.at[1]) > 160;
      const ground = (x, z) => !inVine(x, z) && castleOut(x, z) && !inPoly(x, z, village) && edgeDist(x, z, village) > 10
        && !keep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr + 4);
      const orchardZone = (rr, b) => rr > 525 && rr < 690 && b > .52 && b < 2.62;
      const minZ = CITY.origin[1] - 60;
      for (let x = CX - R; x <= CX + R; x += 11) for (let z = CZ - R; z <= CZ + R; z += 11) {
        const px = x + (rand() - .5) * 9, pz = z + (rand() - .5) * 9, rr = Math.hypot(px - CX, pz - CZ), b = bearing(px, pz);
        if (rr < 160 || rr > R - 15 || pz < minZ || !ground(px, pz) || clearance(px, pz) < 8) continue;
        const slope = Math.abs(groundAt(px + (px - CX) / rr * 4, pz + (pz - CZ) / rr * 4) - groundAt(px, pz)) / 4;
        if (orchardZone(rr, b)) continue;
        const flank = .3 + .7 * Math.abs(Math.cos(b)) ** .6, steep = smooth(.12, .4, slope);
        const fade = smooth(8, 110, Math.min(...vines.map(P => edgeDist(px, pz, P)))), clump = smooth(.3, .62, vn(px / 70, pz / 70));
        if (rand() > flank * steep * fade * clump) continue;
        const fir = rand() < .25 + .35 * groundAt(px, pz) / hill.h, h = fir ? 14 + rand() * 9 : 10 + rand() * 9, v = .75 + .5 * rand();
        if (fir) tree(px, pz, h, h * .48, [.03 * v, .07 * v, .045 * v]);
        else {
          const q = rand();
          tree(px, pz, h, h * (.85 + rand() * .35), q < .07 ? [.32, .2, .05] : q < .11 ? [.3, .1, .04] : [.055 * v, .11 * v, .04 * v]);
        }
      }

      // Orchards stand in rows on a 9 m grid, in patches.

      for (let x = CX - R; x <= CX + R; x += 9) for (let z = CZ - R; z <= CZ + R; z += 9) {
        const rr = Math.hypot(x - CX, z - CZ), b = bearing(x, z);
        if (!orchardZone(rr, b) || vn(x / 60 + 9, z / 60 + 4) < .42 || !ground(x, z) || clearance(x, z) < 4) continue;
        const h = 4.5 + rand() * 1.8, v = .8 + .4 * rand(), q = rand();
        tree(x + (rand() - .5), z + (rand() - .5), h, h * 1.1, q < .15 ? [.32, .26, .07] : q < .2 ? [.3, .12, .05] : [.09 * v, .16 * v, .05 * v]);
      }
      return { focus: [CX, CZ + 420], span: 400 };
    },
  };
  return out;
}
