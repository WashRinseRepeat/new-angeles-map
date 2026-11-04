// Nuremberg's fortifications: the Kaiserburg on its rock, and the double wall with its towers, gates and moat.

import { HALF_PI, RED, BROWN, SLATE, GOLD, DARK, WOOD, helpers } from './common.js';
import { groundAt, terrainAt } from '../../../engine/relief.js';

export const kits = () => ({});

// Sandstone in its Nuremberg shades: red-brown, yellow-grey and dark weathered stone.

const STONES = [[.38, .19, .13], [.35, .22, .15], [.37, .32, .23], [.33, .29, .22], [.22, .16, .13]];
const ROCK = [[.42, .2, .13], [.38, .17, .11], [.44, .27, .17], [.3, .2, .15], [.24, .14, .1], [.36, .3, .24]];
const IRON = [.05, .05, .05], TIMBER = [.3, .22, .15], GRASS = [.12, .2, .08], LEAF = [.07, .16, .06], SOIL = [.2, .13, .08];
const PAVE = [.3, .27, .23], WARM = [1.6, .8, .3];
const hash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const shade = (c, f) => c.map(q => q * f);

const inPoly = (P, x, z) => {
  let a = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) a = !a;
  }
  return a;
};

// The sign that turns a ring's left-hand normal outward.

function outSign(P) {
  const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cz = P.reduce((s, p) => s + p[1], 0) / P.length;
  let acc = 0;
  P.forEach((p, i) => { const q = P[(i + 1) % P.length]; acc += (q[1] - p[1]) * (p[0] - cx) - (q[0] - p[0]) * (p[1] - cz); });
  return acc > 0 ? 1 : -1;
}

// A ring cut into pieces of at most step metres. Each piece has its centre, length, heading ry, distance run round
// the ring, direction (ux, uz) and outward normal (nx, nz).

function pieces(P, step) {
  const sgn = outSign(P), A = [];
  let run = 0;
  P.forEach((p, i) => {
    const q = P[(i + 1) % P.length], dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
    if (!len) return;
    const n = Math.ceil(len / step), ux = dx / len, uz = dz / len;
    for (let k = 0; k < n; k++) {
      const f = (k + .5) / n;
      A.push({ x: p[0] + dx * f, z: p[1] + dz * f, len: len / n, ry: Math.atan2(-dz, dx), run: run += len / n, ux, uz, nx: sgn * uz, nz: -sgn * ux, sgn });
    }
  });
  return A;
}

// A ring pushed k metres outward along each point's normal.

function offset(P, k) {
  const sgn = outSign(P);
  return P.map((p, i) => {
    const a = P[(i + P.length - 1) % P.length], b = P[(i + 1) % P.length], tx = b[0] - a[0], tz = b[1] - a[1], t = Math.hypot(tx, tz) || 1;
    return [p[0] + sgn * tz / t * k, p[1] - sgn * tx / t * k];
  });
}

export function landmarks(H) {
  const { bld, prop, glow, flickerGlow, SKINS, CITY } = H, out = {};
  const { opt, STONE, each } = helpers(H, out);

  // Blind ashlar draws coursed stone with no windows, so curtains and defensive towers use it.

  const PLAIN = SKINS.blindAshlar;
  const torch = (x, y, z, r) => flickerGlow(x, y, z, .35, .5, .35, [2, .9, .3], r, .7);

  // ---------- the Kaiserburg on its rock ----------
  // From west to east: the castle garden, the Palas with the double chapel and Heidenturm, the Kemenate, the round
  // Sinwellturm in the inner court, the Tiefer Brunnen and the Burgamtmannshaus in the outer court, the five-sided
  // tower and the Walburgis chapel, the long Kaiserstallung, and Luginsland. Curtains run round the rock's top, and
  // red sandstone faces stand wherever the ground falls away below it.

  each('burg', (s, at, a) => ({
    labelY: 70,
    build(x, z, w, d, st, r) {
      const ry = -a, [cx, cz] = s.at, c = Math.cos(a), sn = Math.sin(a), hw = s.w / 2, hd = s.d / 2;
      const G = (u, v) => { const [px, pz] = at(u, v); return groundAt(cx + px, cz + pz); };
      const L = G(0, 0);
      const local = (px, pz) => [px * c + pz * sn, -px * sn + pz * c];
      const SR = STONE(st, 0, STONES[0]), SY = STONE(st, 0, STONES[2]), SD = STONE(st, 0, STONES[4]);
      const B = (u, v, bw, bd, h, o = {}) => bld(...at(u, v), bw, bd, h, o.S ?? SY, r, opt({ skin: SKINS.stone, lit: 0, ry, ...o }));
      const P = (kind, u, y, v, sx, sy, sz, rgb, dry = 0, rx = 0) => { const [px, pz] = at(u, v); prop(kind, px, y, pz, sx, sy, sz, rgb, ry + dry, rx); };
      const gable = (u, v, bw, bd, y0, h, base = RED, turned = 0) => B(u, v, bw, bd, h, { y0, shape: 'gable', skin: SKINS.tile, base, ry: ry + turned });
      const pyr = (u, v, bw, bd, y0, h, base = RED) => B(u, v, bw, bd, h, { y0, shape: 'pyr', skin: SKINS.tile, base });
      const slit = (u, v, y, dry = 0) => P('box', u, y, v, .3, 1.3, .3, DARK, dry);
      const lamp = (u, v, y, sx, sz) => { const [px, pz] = at(u, v); glow(px, y, pz, sx, 1.4, sz, WARM.map(q => q * .35), ry); };

      // Dormers in rows up one slope of a roof whose ridge runs along u: fs gives each row's share of the way up.

      const dormers = (u0, u1, step, vc, half, y0, h, fs, side) => fs.forEach((f, k) => {
        const q = 1 - .16 * k;
        for (let u = u0 + (k % 2) * step / 2; u <= u1; u += step)
          gable(u, vc + side * half * (1 - f), 2.4 * q, 1.7 * q, y0 + h * f - 1.1 * q, 1.6 * q, RED, HALF_PI);
      });

      // Footprints the curtain stops at, because the building's own wall stands on the rock's edge there.

      const FOOT = [[-97, -59, -50, -28], [40, 110, -50, -28], [112, 125, -34, -24]];
      const GATES = [[-14, 47], [70, 47]];
      const inFoot = (u, v) => FOOT.some(([u0, u1, v0, v1]) => u > u0 && u < u1 && v > v0 && v < v1);

      // The curtain round the rock's top, crenellated, sunk 6 m so its outer face meets the cliff.

      const RING = [[-118, -45], [-60, -47], [60, -47], [118, -46], [123, -22], [123, 40], [60, 47], [-60, 47], [-112, 42], [-123, 10], [-123, -32]];
      for (const p of pieces(RING.map(([u, v]) => at(u, v)), 8)) {
        const [u, v] = local(p.x, p.z);
        if (inFoot(u, v) || GATES.some(([gu, gv]) => Math.hypot(u - gu, v - gv) < 6)) continue;
        const S = hash(Math.floor(p.run / 60)) < .6 ? SR : SY;
        bld(p.x, p.z, p.len + .3, 2.4, 18, S, r, opt({ y0: -6, skin: PLAIN, lit: 0, ry: p.ry }));
        for (const f of [-.25, .25]) prop('box', p.x + p.ux * p.len * f + p.nx * .85, 12.7, p.z + p.uz * p.len * f + p.nz * .85, 1.6, 1.4, .7, shade(S.base, .9), p.ry);
      }

      // Round flanking turrets at three corners of the ring.

      for (const [u, v] of [[-123, 10], [-112, 42], [123, 40]]) {
        B(u, v, 6, 6, 21, { y0: -6, shape: 'cyl', skin: PLAIN, S: SR });
        P('cone', u, 17.2, v, 6.6, 4.4, 6.6, RED);
      }

      // The inner ward: a wall round the inner court with its gate, and a cross wall to the outer court.

      for (const p of pieces([at(-112, 12), at(-26, 12), at(-26, -28), at(-60, -28), at(-112, -28)], 8)) {
        const [u, v] = local(p.x, p.z);
        if (v < -27 || u < -111 || Math.hypot(u + 60, v - 12) < 4.5) continue;
        bld(p.x, p.z, p.len + .3, 1.8, 9, SY, r, opt({ y0: -1, skin: PLAIN, lit: 0, ry: p.ry }));
        prop('box', p.x, 8.5, p.z, p.len * .45, 1, 1.9, shade(SY.base, .85), p.ry);
      }
      B(-60, 12, 7, 6, 12, { y0: -1, S: SR });
      pyr(-60, 12, 7.6, 6.6, 11, 6);

      // Gate towers over the Himmelstor and the eastern gate, each with a ramp down to the town.

      for (const [gu, gv] of GATES) {
        for (const sd of [-1, 1]) B(gu + sd * 3.8, gv, 2.6, 9, 10, { y0: -2, skin: PLAIN, S: SR });
        B(gu, gv, 10, 9, 10, { y0: 7, S: SR });
        pyr(gu, gv, 10.6, 9.6, 17, 8);
        slit(gu, gv + 4.6, 12);
        for (const sd of [-1, 1]) {
          const [tx, tz] = at(gu + sd * 3.2, gv + 5);
          torch(tx, 3.5, tz, r);
        }
        for (let k = 0; k < 10; k++) {
          const sv = gv + 6.5 + 4 * k, yR = L - (sv - gv) / 9, g = G(gu, sv);
          if (yR - g < .25 && k >= 3) break;
          const up = Math.max(yR - g, .15);
          P('box', gu, (up - 1.2) / 2, sv, 5, up + 1.2, 4.2, PAVE);
          for (const sd of [-1, 1]) P('box', gu + sd * 2.8, up / 2, sv, .6, up + 2, 4.2, shade(SY.base, .9));
        }
      }

      // The Palas: a stone hall on the north edge under a steep roof with dormers, its hall windows lit.

      B(-78, -38.8, 38, 16, 16, { y0: -1, S: SR });
      gable(-78, -38.8, 38.6, 16.8, 15, 13);
      dormers(-93, -63, 6, -38.8, 8.4, 15, 13, [.25, .55], 1);
      dormers(-93, -63, 6, -38.8, 8.4, 15, 13, [.35], -1);
      for (let u = -93; u <= -63; u += 5) lamp(u, -30.75, 10, 1.4, .06);

      // The double chapel and the square Heidenturm over its east end.

      B(-53, -36, 13, 14, 17, { y0: -1, S: SY });
      gable(-53, -36, 13.6, 14.6, 16, 8);
      for (const u of [-56, -50]) lamp(u, -28.95, 9, .9, .06);
      B(-41, -37, 9, 9, 31, { y0: -1, skin: PLAIN, S: SR });
      pyr(-41, -37, 9.8, 9.8, 30, 7);
      for (const y of [18, 24]) for (const u of [-42.2, -39.8]) slit(u, -32.45, y);

      // The Kemenate: a stone hall with a timber storey on the inner court's south side.

      B(-96, -6, 22, 12, 11, { y0: -1, S: SY });
      B(-96, -6, 22.6, 12.6, 4, { y0: 10, skin: SKINS.timber, S: STONE(st, .1, TIMBER) });
      gable(-96, -6, 23.2, 13.2, 14, 9, BROWN);
      dormers(-103, -89, 7, -6, 6.6, 14, 9, [.35], 1);

      // The Sinwellturm: a round stone shaft with a timber upper storey and a pointed roof.

      B(-38, -16, 12, 12, 27, { y0: -1, shape: 'cyl', skin: PLAIN, S: SR });
      B(-38, -16, 12.8, 12.8, 5, { y0: 26, shape: 'cyl', skin: SKINS.timber, S: STONE(st, .15, TIMBER) });
      P('cone', -38, 36, -16, 13.6, 10, 13.6, RED);
      P('box', -38, 42, -16, .2, 2, .2, GOLD);
      for (const y of [9, 17]) for (const v of [-22.1, -9.9]) slit(-38, v, y);

      // The Tiefer Brunnen in its timber well house, and the Burgamtmannshaus on the outer court's south side.

      B(-14, -10, 6, 6, 4, { skin: SKINS.timber, S: STONE(st, 0, TIMBER) });
      gable(-14, -10, 6.8, 6.8, 4, 3.5, BROWN);
      B(8, 24, 20, 11, 7, { y0: -1, S: SY });
      B(8, 24, 20.6, 11.6, 5, { y0: 6, skin: SKINS.timber, S: STONE(st, .15, TIMBER) });
      gable(8, 24, 21.2, 12.2, 11, 8);
      dormers(1, 16, 7.5, 24, 6.1, 11, 8, [.35], 1);
      dormers(1, 16, 7.5, 24, 6.1, 11, 8, [.35], -1);

      // The five-sided tower: a square with a prow to the north, and the small Walburgis chapel beside it.

      B(16, -34, 9, 9, 23, { y0: -1, skin: PLAIN, S: SD });
      B(16, -38.5, 6.4, 6.4, 23, { y0: -1, skin: PLAIN, S: SD, ry: ry + Math.PI / 4 });
      pyr(16, -34, 9.8, 9.8, 22, 6);
      for (const y of [10, 16]) slit(16, -29.45, y);
      B(30, -26, 10, 7, 10, { y0: -1, S: SY });
      gable(30, -26, 10.6, 7.6, 9, 5);
      P('cyl', 26, 15.5, -26, 1.2, 3, 1.2, TIMBER);
      P('cone', 26, 18, -26, 1.6, 2.2, 1.6, SLATE);

      // The Kaiserstallung: a long stone granary under a very tall roof with four rows of dormers.

      B(75, -38.9, 70, 15, 12, { y0: -1, S: SR });
      gable(75, -38.9, 70.6, 15.8, 11, 17);
      dormers(44, 106, 6, -38.9, 7.9, 11, 17, [.16, .36, .56, .74], 1);
      dormers(44, 106, 6, -38.9, 7.9, 11, 17, [.2, .43, .66], -1);

      // Luginsland: a tall square tower at the east end with a steep roof and four corner turrets.

      B(118, -30, 11, 11, 34, { y0: -2, skin: PLAIN, S: SR });
      pyr(118, -30, 11.8, 11.8, 32, 11);
      for (const [du, dv] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        P('cyl', 118 + du * 5.5, 30, -30 + dv * 5.5, 2, 4, 2, shade(SR.base, .9));
        P('cone', 118 + du * 5.5, 34, -30 + dv * 5.5, 2.4, 4, 2.4, RED);
      }
      for (const y of [12, 20, 27]) slit(118, -24.45, y);

      // The courts' paving, the castle garden's trees and a few in the outer courts.

      for (const [u, v, pw, pd] of [[-72, -20, 46, 14], [5, 0, 56, 26], [75, -10, 70, 30]]) P('box', u, .06, v, pw, .12, pd, PAVE);
      for (const [u, v] of [[-116, -30], [-116, -16], [-108, -36], [-110, 28], [-98, 34], [-86, 26], [-72, 36], [-58, 30], [-44, 38], [-46, 24], [14, 38], [26, 36], [100, 20], [110, 32]]) {
        const k = 4 + 2 * r();
        P('cyl', u, 1.6, v, .5, 3.2, .5, WOOD);
        P('cyl', u, 3.2 + k * .35, v, k, k * .7, k, shade(LEAF, .8 + .4 * r()));
        P('cone', u, 3.2 + k * .95, v, k * .8, k * .5, k * .8, shade(LEAF, .8 + .4 * r()));
      }

      // Red sandstone faces in tiers round the rock, wherever the ground falls away below the castle's level.

      for (const [nu, nv, half] of [[0, -1, hw], [0, 1, hw], [-1, 0, hd], [1, 0, hd]]) {
        for (let t = -half - 10; t <= half + 10; t += 7) for (const o of [2.5, 6.5, 10.5]) {
          const u = nu ? nu * (hw + o) : t, v = nv ? nv * (hd + o) : t;
          if (nv > 0 && GATES.some(([gu]) => Math.abs(u - gu) < 6)) continue;
          const top = L - G(u, v) - o * .35;
          if (top < 1.2) continue;
          const col = shade(ROCK[Math.floor(r() * ROCK.length)], .8 + .35 * r());
          P('box', u, (top - 2.5) / 2, v, nu ? 4.6 + r() * 2 : 7.5 + r() * 2, top + 2.5, nu ? 7.5 + r() * 2 : 4.6 + r() * 2, col, (r() - .5) * .5, (r() - .5) * .14);
        }
      }

      for (const [u, v] of [[-72, -22], [-60, 15], [-14, 42], [70, 42], [5, -6], [75, -20]]) {
        const [lx, lz] = at(u, v);
        torch(lx, 3, lz, r);
      }
      return { focus: [0, 0], span: 260, face: [0, 1] };
    },
  }));


  // ---------- the walls ----------
  // The inner wall follows city.json's wall: a curtain with a roofed walk on posts and braces, and a tower every 55 m
  // in four types. Each gate has a gate tower, a Zwinger gate in the outer wall and piers under its moat bridge, and
  // the Spittlertor, Frauentor, Laufer Tor and Neutor each have a great round tower beside the road. The outer wall
  // runs 18 m out with crenels and small half-round towers, and stone scarps line the dry moat. The Zwinger between
  // the walls holds grass, gardens and trees. Where the Pegnitz crosses, piers and grilles carry both walls over the
  // water, with water towers on the banks. Everything stands free at the centre in world coordinates.

  if (CITY.wall?.length) out.nb_walls = {
    at: [0, 0], free: [40, 40], label: 'Stadtmauer', slug: 'stadtmauer', labelY: 26,
    build(x, z, w, d, st, r) {
      const W = CITY.wall, G = CITY.gates ?? [], WATER = CITY.water ?? [];
      const tint = (run, lit = 0) => {
        const h = hash(Math.floor(run / 130));
        return STONE(st, lit, STONES[h < .32 ? 0 : h < .55 ? 1 : h < .78 ? 2 : h < .92 ? 3 : 4]);
      };
      const wet = (px, pz) => WATER.some(q => inPoly(q.poly, px, pz));
      const gateNear = (px, pz, k) => G.some(([gx, gz]) => Math.hypot(px - gx, pz - gz) < k);

      // Within half metres of a gate road, between a0 and a1 metres out from the gate.

      const road = (px, pz, half, a0, a1) => G.some(([gx, gz, deg]) => {
        const t = deg * Math.PI / 180, ox = Math.cos(t), oz = Math.sin(t), dx = px - gx, dz = pz - gz, al = dx * ox + dz * oz;
        return al > a0 && al < a1 && Math.abs(-dx * oz + dz * ox) < half;
      });
      const burg = CITY.sites?.find(s => s.kind === 'burg');
      const inBurg = (px, pz, m) => {
        if (!burg) return false;
        const dx = px - burg.at[0], dz = pz - burg.at[1], c = Math.cos(burg.rot ?? 0), sn = Math.sin(burg.rot ?? 0);
        return Math.abs(dx * c + dz * sn) < burg.w / 2 + m && Math.abs(-dx * sn + dz * c) < burg.d / 2 + m;
      };
      const NAMES = { 135: 'Spittlertor', 72: 'Frauentor', 346: 'Laufer Tor', 215: 'Neutor' };
      const GT = G.filter(([, , deg]) => NAMES[Math.round(deg)]).map(([gx, gz, deg]) => {
        const t = deg * Math.PI / 180, ox = Math.cos(t), oz = Math.sin(t);
        return [gx + ox * 13 - oz * 15.5, gz + oz * 13 + ox * 15.5];
      });
      const inGT = (px, pz, k) => GT.some(([tx, tz]) => Math.hypot(px - tx, pz - tz) < k);
      const at = (p, along, outward) => [p.x + p.ux * along + p.nx * outward, p.z + p.uz * along + p.nz * outward];
      const slit = (p, along, outward, y) => { const [sx, sz] = at(p, along, outward); prop('box', sx, y, sz, .35, 1.3, .1, DARK, p.ry); };

      // Small towers: a round tower with a cone cap, and a square timber oriel with a cap, for corners.

      const oriel = (ox, oz, y, ry) => {
        bld(ox, oz, 1.6, 1.6, 2.8, STONE(st, .1, TIMBER), r, opt({ y0: y, skin: SKINS.timber, ry, lit: .1 }));
        prop('cone', ox, y + 3.9, oz, 2.1, 2.2, 2.1, RED);
      };
      const corners = (cx, cz, half, y, ry) => {
        const c = Math.cos(ry), sn = Math.sin(ry);
        for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) oriel(cx + (a * c + b * sn) * half, cz + (-a * sn + b * c) * half, y, ry);
      };

      // The roofed walk on a curtain whose top stands top metres above the piece's ground: a breastwork with a loophole
      // on the field side, planks on the town side held by a post and a brace, and a tiled roof over both.

      const walk = (p, top, S) => {
        const { x: px, z: pz, nx, nz, ry, len } = p;
        bld(px + nx, pz + nz, len + .4, .6, 1.6, S, r, opt({ y0: top, skin: PLAIN, ry, lit: 0 }));
        prop('box', px + nx * 1.31, top + .9, pz + nz * 1.31, .25, .7, .06, DARK, ry);
        prop('box', px - nx * 1.7, top - .15, pz - nz * 1.7, len + .3, .3, 1.2, WOOD, ry);
        prop('box', px - nx * 2.2, top + 1.1, pz - nz * 2.2, .26, 2.2, .26, WOOD, ry);
        prop('box', px - nx * 1.75, top - 1, pz - nz * 1.75, .2, 1.6, .2, WOOD, ry, p.sgn * .65);
        bld(px - nx * .45, pz - nz * .45, len + .4, 4.6, 1.9, S, r, opt({ y0: top + 2.2, shape: 'gable', skin: SKINS.tile, base: RED, ry, lit: 0 }));
      };

      // A wall tower of one of four types, standing out from the curtain on the field side.

      const tower = (p, kind, S) => {
        const ry = p.ry;
        if (kind === 'shell') {

          // A half-round shell with merlons round its field side, half of them under a cone cap.

          const [tx, tz] = at(p, 0, 1.6);
          bld(tx, tz, 8, 8, 19, S, r, opt({ y0: -4, shape: 'cyl', skin: PLAIN, lit: 0 }));
          if (r() < .5) prop('cone', tx, 17.5, tz, 8.6, 5, 8.6, RED);
          else for (let k = 0; k < 5; k++) {
            const t = (k / 4 - .5) * Math.PI;
            prop('box', tx + (p.nx * Math.cos(t) + p.ux * Math.sin(t)) * 3.6, 15.6, tz + (p.nz * Math.cos(t) + p.uz * Math.sin(t)) * 3.6, 1, 1.2, 1, shade(S.base, .9), ry);
          }
          slit(p, 0, 5.62, 8);
          return;
        }
        const [tx, tz] = at(p, 0, 2.4), hip = kind === 'hip', bw = hip ? 9.5 : 7.5, bd = hip ? 6.8 : 7.5;
        const shaft = kind === 'timber' ? 22 : hip ? 24 : 26;
        bld(tx, tz, bw, bd, shaft, S, r, opt({ y0: -4, skin: PLAIN, ry, lit: 0 }));
        for (const y of [7, 13]) slit(p, 0, 2.4 + bd / 2 + .04, y);
        let y0 = shaft - 4;
        if (kind === 'timber') {
          bld(tx, tz, 8.7, 8.7, 4.4, STONE(st, .15, TIMBER), r, opt({ y0, skin: SKINS.timber, ry }));
          corners(tx, tz, 4.9, y0 + .5, ry);
          y0 += 4.4;
        }
        const rh = hip ? 9 : 10 + r() * 2;
        bld(tx, tz, bw + .8, bd + .8, rh, S, r, opt({ y0, shape: 'pyr', skin: SKINS.tile, base: r() < .2 ? BROWN : RED, ry, lit: 0 }));
        const [dx, dz] = at(p, 0, 2.4 + (bd + .8) * .22);
        bld(dx, dz, 2.2, 1.5, 1.5, S, r, opt({ y0: y0 + rh * .56 - .8, shape: 'gable', skin: SKINS.tile, base: RED, ry: ry + HALF_PI, lit: 0 }));
      };

      // A water tower on a river bank: a tall square tower with a timber storey, corner oriels and a steep roof.

      const waterTower = (p, S) => {
        const [tx, tz] = at(p, 0, 2), ry = p.ry;
        bld(tx, tz, 9, 9, 30, S, r, opt({ y0: -4, skin: PLAIN, ry, lit: 0 }));
        for (const y of [8, 15, 21]) slit(p, 0, 6.55, y);
        bld(tx, tz, 9.8, 9.8, 4, STONE(st, .2, TIMBER), r, opt({ y0: 26, skin: SKINS.timber, ry }));
        corners(tx, tz, 5.2, 26.4, ry);
        bld(tx, tz, 10.4, 10.4, 11, S, r, opt({ y0: 30, shape: 'pyr', skin: SKINS.tile, base: RED, ry, lit: 0 }));
      };

      // The inner curtain. Over the river it rides on piers above the water, with an iron grille down to the bed.

      const IN = pieces(W, 6);
      IN.forEach(p => { p.wet = wet(p.x, p.z); });
      let dryG = groundAt(IN[0].x, IN[0].z), last = -99;
      IN.forEach((p, i) => {
        if (inBurg(p.x, p.z, 3) || gateNear(p.x, p.z, 7)) return;
        const S = tint(p.run), g = groundAt(p.x, p.z);
        let top = 10;
        if (p.wet) {
          top = dryG + 10 - g;
          const arch = .12 - g + 4;
          bld(p.x, p.z, p.len + .4, 2.6, top - arch, S, r, opt({ y0: arch, skin: PLAIN, ry: p.ry, lit: 0 }));
          const [qx, qz] = at(p, -p.len / 2, 0);
          bld(qx, qz, 2, 3.2, arch + 1.5, S, r, opt({ y0: -1.5, skin: PLAIN, ry: p.ry, lit: 0 }));
          for (const f of [-.3, -.1, .1, .3]) {
            const [bx, bz] = at(p, p.len * f, 1.4);
            prop('box', bx, (arch - 1) / 2, bz, .16, arch + 1, .16, IRON);
          }
        } else {
          dryG = g;
          bld(p.x, p.z, p.len + .4, 2.6, 14, S, r, opt({ y0: -4, skin: PLAIN, ry: p.ry, lit: 0 }));
        }
        walk(p, top, S);

        // A water tower on each bank where the river meets the wall.

        const n = IN.length, prev = IN[(i + n - 1) % n], next = IN[(i + 1) % n];
        if (!p.wet && (prev.wet || next.wet)) { waterTower(p, tint(p.run + 3)); return; }
        const nearWet = [-3, -2, -1, 1, 2, 3].some(k => IN[(i + k + n) % n].wet);
        if (p.run - last > 55 && !p.wet && !nearWet && !gateNear(p.x, p.z, 22) && !inBurg(p.x, p.z, 12)) {
          last = p.run;
          const q = r();
          tower(p, q < .35 ? 'pyr' : q < .55 ? 'timber' : q < .75 ? 'hip' : 'shell', tint(p.run + 1));
        }
      });

      // Gate complexes: the inner gate tower over the road, side walls through the Zwinger, the Zwinger gate in the
      // outer wall, piers and parapets on the moat bridge, and at the four great gates a round tower beside the road.

      G.forEach(([gx, gz, deg], gi) => {
        const t = deg * Math.PI / 180, ox = Math.cos(t), oz = Math.sin(t), tx = -oz, tz = ox, ry = -t, S = tint(gi * 130, .1);
        const pt = (al, pp) => [gx + ox * al + tx * pp, gz + oz * al + tz * pp];
        for (const s of [-1, 1]) bld(...pt(0, s * 4.6), 12, 3, 9, S, r, opt({ y0: -1, skin: PLAIN, ry, lit: 0 }));
        const timber = gi % 2;
        bld(gx, gz, 12, 12, timber ? 14 : 18, S, r, opt({ y0: 8, skin: SKINS.stone, ry, lit: .1 }));
        let y0 = timber ? 22 : 26;
        if (timber) {
          bld(gx, gz, 12.8, 12.8, 4.5, STONE(st, .2, TIMBER), r, opt({ y0, skin: SKINS.timber, ry }));
          corners(gx, gz, 6.8, y0 + .6, ry);
          y0 += 4.5;
        } else {
          for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
            const [cx, cz] = pt(a * 6, b * 6);
            bld(cx, cz, 2, 2, 3.4, S, r, opt({ y0: y0 - 3.4, shape: 'cyl', skin: PLAIN, lit: 0 }));
            prop('cone', cx, y0 + 1.1, cz, 2.4, 2.2, 2.4, RED);
          }
        }
        bld(gx, gz, 13.2, 13.2, 13, S, r, opt({ y0, shape: 'pyr', skin: SKINS.tile, base: RED, ry, lit: 0 }));
        bld(...pt(3.6, 0), 2.2, 1.5, 1.5, S, r, opt({ y0: y0 + 4.9, shape: 'gable', skin: SKINS.tile, base: RED, ry, lit: 0 }));
        for (const s of [-1, 1]) { const [lx, lz] = pt(7, s * 3); torch(lx, 3.5, lz, r); }

        for (const s of [-1, 1]) bld(...pt(10, s * 5.2), 11, 1.2, 6.5, S, r, opt({ y0: -2, skin: PLAIN, ry, lit: 0 }));
        for (const s of [-1, 1]) bld(...pt(18, s * 4.4), 5, 2.4, 8.5, S, r, opt({ y0: -2, skin: PLAIN, ry, lit: 0 }));
        bld(...pt(18, 0), 5, 11.2, 4.5, S, r, opt({ y0: 6.5, skin: PLAIN, ry, lit: 0 }));
        bld(...pt(18, 0), 11.8, 5.6, 3.6, S, r, opt({ y0: 11, shape: 'gable', skin: SKINS.tile, base: RED, ry: ry + HALF_PI, lit: 0 }));
        const [zx, zz] = pt(21, 2.8);
        torch(zx, 3, zz, r);

        // Bridge piers down to the moat floor, and parapets along the deck in four steps.

        for (const al of [28, 34.5, 41]) {
          const [bx, bz] = pt(al, 0), deck = groundAt(bx, bz), floor = terrainAt(bx, bz);
          if (deck - floor > 1.5) prop('box', bx, (floor - deck - 1.45) / 2, bz, 2.4, deck - floor + .55, 7.6, shade(S.base, .85), ry);
        }
        for (let k = 0; k < 4; k++) for (const s of [-1, 1]) {
          const [px, pz] = pt(25 + (k - 1.5) * 11.5, s * 3.8);
          prop('box', px, .55, pz, 11.4, 1.1, .5, shade(S.base, .9), ry);
        }
        if (!NAMES[Math.round(deg)]) return;

        // The great round tower: an 18 m shaft with a string course and rings of windows, a corbelled walkway with
        // merlons near the top, and a drum under a steep conical cap.

        const [cx, cz] = pt(13, 15.5), T = tint(gi * 130 + 50, .05);
        bld(cx, cz, 18, 18, 35, T, r, opt({ y0: -9, shape: 'cyl', skin: PLAIN, lit: 0 }));
        bld(cx, cz, 18.8, 18.8, 1, T, r, opt({ y0: 8, shape: 'cyl', skin: PLAIN, lit: 0 }));
        bld(cx, cz, 19.8, 19.8, 1.2, T, r, opt({ y0: 25.4, shape: 'cyl', skin: PLAIN, lit: 0 }));
        bld(cx, cz, 15.4, 15.4, 3.5, T, r, opt({ y0: 26, shape: 'cyl', skin: PLAIN, lit: 0 }));
        prop('cone', cx, 35.25, cz, 16.4, 11.5, 16.4, RED);
        prop('cyl', cx, 42.2, cz, .25, 2.5, .25, GOLD);
        for (let k = 0; k < 16; k++) {
          const th = k / 16 * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th), fy = Math.atan2(-c, -sn);
          prop('box', cx + c * 9.5, 27.4, cz + sn * 9.5, 1.6, 1.6, .8, shade(T.base, .9), fy);
          if (k % 2) continue;
          prop('box', cx + c * 9.03, 21, cz + sn * 9.03, .9, 1.4, .1, DARK, fy);
          prop('box', cx + c * 9.03, 13, cz + sn * 9.03, .35, 1.3, .1, DARK, fy);
          if (k % 6 === 0) glow(cx + c * 9.06, 21, cz + sn * 9.06, .7, 1.1, .05, WARM.map(q => q * .4), fy);
        }
      });

      // The outer wall, 18 m out: crenellated, with small half-round towers. Over the river it rides on piers above
      // the water behind a grille.

      const OUT = pieces(offset(W, 18), 6);
      OUT.forEach(p => { p.wet = wet(p.x, p.z); });
      let dryO = groundAt(OUT[0].x, OUT[0].z), lastO = -99;
      OUT.forEach((p, i) => {
        if (inBurg(p.x, p.z, 14) || road(p.x, p.z, 5.5, 8, 30) || inGT(p.x, p.z, 9.5)) return;
        const S = tint(p.run + 7), g = groundAt(p.x, p.z);
        let top = 8;
        if (p.wet) {
          top = dryO + 8 - g;
          const arch = .12 - g + 3;
          bld(p.x, p.z, p.len + .4, 1.8, top - arch, S, r, opt({ y0: arch, skin: PLAIN, ry: p.ry, lit: 0 }));
          const [qx, qz] = at(p, -p.len / 2, 0);
          bld(qx, qz, 1.8, 2.4, arch + 1.5, S, r, opt({ y0: -1.5, skin: PLAIN, ry: p.ry, lit: 0 }));
          for (const f of [-.25, 0, .25]) {
            const [bx, bz] = at(p, p.len * f, 1);
            prop('box', bx, (arch - 1) / 2, bz, .16, arch + 1, .16, IRON);
          }
        } else {
          dryO = g;
          bld(p.x, p.z, p.len + .4, 1.7, 12, S, r, opt({ y0: -4, skin: PLAIN, ry: p.ry, lit: 0 }));
        }
        for (const f of [-.25, .25]) {
          const [mx, mz] = at(p, p.len * f, .45);
          prop('box', mx, top + .65, mz, 1.5, 1.3, .8, shade(S.base, .8 + .3 * r()), p.ry);
        }
        const n = OUT.length, nearWet = [-2, -1, 1, 2].some(k => OUT[(i + k + n) % n].wet);
        if (!p.wet && nearWet && (OUT[(i + n - 1) % n].wet || OUT[(i + 1) % n].wet)) {
          const [tx, tz] = at(p, 0, 1.4);
          bld(tx, tz, 7, 7, 20, S, r, opt({ y0: -4, shape: 'cyl', skin: PLAIN, lit: 0 }));
          prop('cone', tx, 19, tz, 7.6, 6, 7.6, RED);
          return;
        }
        if (p.run - lastO > 45 && !p.wet && !nearWet && !road(p.x, p.z, 25, 0, 40) && !inGT(p.x, p.z, 20)) {
          lastO = p.run;
          const [tx, tz] = at(p, 0, 1.4);
          bld(tx, tz, 5.6, 5.6, 14, S, r, opt({ y0: -4, shape: 'cyl', skin: PLAIN, lit: 0 }));
          if (r() < .7) prop('cone', tx, 12.1, tz, 6.2, 4.2, 6.2, RED);
          else for (let k = 0; k < 4; k++) {
            const th = (k / 3 - .5) * Math.PI;
            prop('box', tx + (p.nx * Math.cos(th) + p.ux * Math.sin(th)) * 2.4, 10.5, tz + (p.nz * Math.cos(th) + p.uz * Math.sin(th)) * 2.4, .9, 1, .9, shade(S.base, .9), p.ry);
          }
        }
      });

      // Stone scarps line the dry moat's inner and outer banks, from the floor up to the bank.

      for (const [k, th, bank, floor] of [[25.2, 5.6, 21, 31], [43.2, 5.4, 47.5, 37]]) {
        for (const p of pieces(offset(W, k), 8)) {
          if (inBurg(p.x, p.z, 30) || road(p.x, p.z, 5.5, 10, 55) || inGT(p.x, p.z, 10.5) || wet(p.x, p.z)) continue;
          const gC = groundAt(p.x, p.z), [bx, bz] = at(p, 0, bank - k), [fx, fz] = at(p, 0, floor - k);
          const gB = groundAt(bx, bz), gF = groundAt(fx, fz);
          if (gB - gF < 2) continue;
          const y0 = gF - gC - .6;
          bld(p.x, p.z, p.len + .3, th, gB - gC + .15 - y0, shade3(tint(p.run + 11)), r, opt({ y0, skin: PLAIN, ry: p.ry, lit: 0 }));
        }
      }

      // The Zwinger between the walls: grass all along, with fruit trees, kitchen gardens and the odd shed.

      for (const p of pieces(offset(W, 9.5), 12)) {
        if (inBurg(p.x, p.z, 14) || road(p.x, p.z, 8, -5, 30) || inGT(p.x, p.z, 11) || wet(p.x, p.z) || wet(...at(p, 8, 0)) || wet(...at(p, -8, 0))) continue;
        prop('box', p.x, -.45, p.z, p.len + .5, 1.2, 8, shade(GRASS, .8 + .4 * r()), p.ry);
        const q = r(), [ax, az] = at(p, (r() - .5) * 6, (r() - .5) * 2.5);
        if (q < .4) {
          const k = 3.5 + 2 * r();
          prop('cyl', ax, 1.5, az, .4, 3, .4, WOOD);
          prop('cyl', ax, 3 + k * .35, az, k, k * .7, k, shade(LEAF, .8 + .5 * r()));
          if (r() < .5) prop('cone', ax, 3 + k * .95, az, k * .75, k * .5, k * .75, shade(LEAF, .8 + .5 * r()));
        } else if (q < .65) {
          prop('box', ax, .1, az, 6, .3, 5, SOIL, p.ry);
          for (const s of [-1, 1]) prop('box', ax + p.ux * s * 1.4, .35, az + p.uz * s * 1.4, .7, .4, 4.4, shade(GRASS, 1.2), p.ry);
        } else if (q < .72) {
          bld(ax, az, 3.4, 3, 2.6, STONE(st, 0, TIMBER), r, opt({ skin: SKINS.timber, ry: p.ry, lit: 0 }));
          bld(ax, az, 3.8, 3.4, 1.6, STONE(st, 0, TIMBER), r, opt({ y0: 2.6, shape: 'gable', skin: SKINS.tile, base: BROWN, ry: p.ry, lit: 0 }));
        }
      }
      return { focus: G[0] ? [G[0][0], G[0][1]] : [0, 0], span: 120 };
    },
  };

  return out;
}

// A darker cast of a style, for the moat's weathered scarps.

function shade3(S) { return { ...S, base: shade(S.base, .82), grime: .6 }; }
