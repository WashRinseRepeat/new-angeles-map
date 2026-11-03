// La Costa: the city's farm belt. Dark fields, orchards, wetlands and villages, broken by glowing agroplexes.
// Lot kits take (x, z, s, st, b, r) in the lot frame. Block kits and landmarks take (x, z, w, d, st, r).

import { trees } from './nature.js';
import { vnoise } from '../../../engine/core.js';

const MAG = [1.5, .3, 1.2], SEC = [.9, 1.2, 1.3], TEAL = [.2, 1.3, 1.1], WARM = [1, .7, .4];
const SOIL = [.022, .017, .011], MARSH = [.012, .02, .015], DIRT = [.04, .032, .022], WATER = [.006, .014, .02];
const FILL_CROPS = [[.07, .14, .04], [.11, .13, .04], [.12, .1, .05], [.06, .11, .06]];
const CROPS = [[.018, .04, .014], [.025, .05, .016], [.05, .042, .018], [.03, .022, .012], [.014, .032, .02], [.04, .05, .02]];
const LEAVES = { broad: [.03, .06, .025], shrub: [.03, .055, .022], fern: [.02, .06, .035], palm: [.03, .065, .03], cypress: [.015, .04, .02] };
const PAINT = [[.3, .28, .24], [.26, .16, .1], [.2, .22, .2], [.3, .22, .14], [.16, .18, .22]];
const TILE = [.16, .06, .04], PANEL = [.36, .37, .39], METAL = [.13, .13, .14], DARK = [.04, .04, .045];
const dim = (rgb, f) => rgb.map(c => c * f);
const pick = (r, a) => a[Math.floor(r() * a.length)];

export function kits(H) {
  const { GLOWS, SKINS, beacon, bld, glow, lerp, pool, prop, put, stringLights, textSign } = H;
  const K = shared(H);
  const { dims, toWorld, coast, tree, lamp, combine, house, agroplex, greenhouse, field } = K;

  const kits = {
    // Crop patchwork: strips of crop on dark soil, a farm track, an irrigation line, sometimes a combine at work.

    lc_fields(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      field(x, z, W, D, r);
      if (r() < .35) lamp(x + W / 2 - 1, z + D / 2 - 1, 5);
    },

    // Tree grid in rows: guato and cacao, or trellised vines.

    lc_orchard(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      prop('box', x, .1, z, W, .2, D, SOIL);
      const gap = 4 + r() * 1.5, vines = r() < .35;
      const nx = Math.min(9, Math.floor(W / gap)), nz = Math.min(9, Math.floor(D / gap));
      if (vines) for (let i = 0; i < nz; i++) {
        const tz = z + (i - (nz - 1) / 2) * gap;
        prop('box', x, .9, tz, W - 3, 1.4, .7, [.025, .045, .018]);
        prop('box', x - W / 2 + 1.5, 1, tz, .15, 2, .15, DARK);
        prop('box', x + W / 2 - 1.5, 1, tz, .15, 2, .15, DARK);
      } else for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const tx = x + (i - (nx - 1) / 2) * gap + (r() - .5) * .6, tz = z + (j - (nz - 1) / 2) * gap + (r() - .5) * .6;
        tree(r() < .8 ? 'broad' : 'shrub', tx, .2, tz, 3 + r() * 2.5, 2.6 + r(), r);
      }
      if (r() < .3) lamp(x - W / 2 + 1, z - D / 2 + 1, 4);
    },

    // Glass-house rows with a soft pink or white glow, dark ribs and a service shed.

    lc_greenhouse(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      prop('box', x, .1, z, W, .2, D, DIRT);
      const n = Math.max(1, Math.min(5, Math.floor(D / 7))), gd = (D - 2) / n, tint = r() < .6 ? [.12, .028, .1] : [.07, .085, .08];
      for (let k = 0; k < n; k++) greenhouse(x - 1.5, z - D / 2 + 1 + gd * (k + .5), W - 5, gd - 1.5, 4 + r() * 2, tint, r);
      bld(x + W / 2 - 1.5, z - D / 2 + 3, 2.5, 4, 3, st, r, { lit: .3, roof: false, skin: SKINS.sparse });
    },

    // Vertical farm: pale panel tower with magenta grow-light bands, security floods at the base.

    lc_agroplex(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      prop('box', x, .1, z, W, .2, D, DIRT);
      agroplex(x, z, Math.min(W, D) * .6, (34 + 46 * r()) * b, st, r);
    },

    // Grain elevator: a row or two of concrete silos, a tall headhouse with a few lit floors, a conveyor
    // gantry up to it and a co-op sign.

    lc_silo(x, z, s, st, b, r) {
      const [W, D] = dims(s), R = 7 + r() * 2, n = Math.min(6, Math.floor((W - 9 - R / 2) / R)), rows = D > 2.4 * R + 6 ? 2 : 1;
      if (n < 2) return kits.lc_workhouse(x, z, s, st, b, r);
      const sh = (30 + 14 * r()) * Math.min(1.2, b), x0 = x - W / 2 + 2 + R / 2, CONC = [.3, .29, .26];
      prop('box', x, .1, z, W, .2, D, DIRT);
      for (let i = 0; i < n; i++) for (let j = 0; j < rows; j++) {
        const sx = x0 + i * R, sz = z + (j - (rows - 1) / 2) * R;
        prop('cyl', sx, sh / 2, sz, R - .4, sh, R - .4, CONC.map(c => c * (.9 + .2 * r())));
        prop('cone', sx, sh + .8, sz, R - .3, 1.6, R - .3, [.1, .1, .1]);
      }
      prop('box', x0 + (n - 1) * R / 2, sh + 2, z, n * R, 2.4, 3, [.12, .11, .1]);
      const hx = x0 + n * R + 3, hh = sh + 14 + r() * 8;
      bld(hx, z, 8, 10, hh, { ...st, base: CONC, win: WARM }, r, { lit: .35, roof: false, skin: SKINS.sparse });
      H.beam([hx + 4, 1, z + D / 2 - 3], [hx, hh - 4, z], .9, [.2, .16, .08]);
      glow(hx, hh - 3, z + 5.1, 5, .5, .2, dim(WARM, .7));
      beacon(hx, hh + 2, z, r);
      textSign(pick(r, ['COOP LA COSTA', 'GRANOS DEL PACIFICO', 'SILOS MANABI']), x0 + (n - 1) * R / 2, sh * .7, z + (rows * R) / 2 + .2, Math.min(n * R - 2, 22), 3, 0, dim(WARM, .8));
      for (const g of [-1, 1]) pool(x0 + (n - 1) * R / 2 + g * R, z + D / 2 - 4, 14, [.1, .07, .03]);
    },

    // Farmworker dormitory: a plain stucco slab of warm windows, tank on the roof, string lights in the yard.

    lc_workhouse(x, z, s, st, b, r) {
      const [W, D] = dims(s), along = W >= D, L = Math.min(along ? W : D, 60) - 4, T = Math.min(along ? D : W, 16) - 2;
      const h = (22 + 18 * r()) * Math.min(1.2, b), w = along ? L : T, d = along ? T : L;
      prop('box', x, .1, z, W, .2, D, DIRT);
      bld(x, z, w, d, h, { ...st, base: pick(r, PAINT), win: [1, .74, .44] }, r, { lit: .45 + .2 * r(), roof: false, skin: SKINS.grid });
      prop('cyl', x + (along ? w * .3 : 0), h + 2.5, z + (along ? 0 : d * .3), 4, 5, 4, METAL);
      textSign(pick(r, ['DORMITORIO 4', 'BRACEROS 12', 'CASA OBRERA']), x, h - 2, z + d / 2 + .2, Math.min(w - 2, 12), 2.4, 0, dim(SEC, .7));
      const yz = z + d / 2 + 5;
      stringLights([x - w / 3, 4, yz], [x + w / 3, 4, yz], 1, 8, dim(WARM, .7));
      lamp(x - w / 2 - 1, yz, 5);
    },

    // Crop stack: a tall vertical farm on a greenhouse podium, the district's skyline.

    lc_cropstack(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      prop('box', x, .1, z, W, .2, D, DIRT);
      agroplex(x, z, Math.min(W, D) * .45, (80 + 60 * r()) * Math.min(1.2, b), st, r);
      greenhouse(x, z + D / 2 - 6, W - 6, 8, 5, [.12, .028, .1], r);
    },

    // Free ground round the lots and farm plots, in 10 m cells. A coarse noise picks crop rows, orchard or
    // jungle scrub on its own ground, so neighbouring cells join into patches. A cell costs at most six instances.

    lc_fill(x, z, s, st, b, r) {
      const [wx, wz] = toWorld(x, z), n = vnoise(wx / 80 + 17, wz / 80 + 4);
      prop('box', x, .08, z, s + .5, .16, s + .5, n < .66 ? SOIL : [.016, .03, .016]);
      if (n < .5) {
        const c = FILL_CROPS[Math.min(3, Math.floor(vnoise(wx / 50 + 3, wz / 50 + 8) * 4))];
        for (const o of [-3.2, 0, 3.2]) prop('box', x + o, .5, z, 2.2, .7, s - 1, c);
      } else if (n < .66) {
        for (const [a, c] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) tree('broad', x + a, .2, z + c, 3 + r() * 2, 2.8 + r(), r);
      } else {
        tree(pick(r, ['broad', 'fern', 'palm']), x + (r() - .5) * 4, .2, z + (r() - .5) * 4, 7 + r() * 6, 5 + r() * 3, r);
        tree('shrub', x + (r() - .5) * 6, .2, z + (r() - .5) * 6, 2 + r() * 2, 3, r);
      }
      if (r() < .03) lamp(x + s / 2 - 1, z + s / 2 - 1, 5);
    },

    // Coastal fish ponds with buoy lights and a feed shed. Inland lots grow crops instead.

    lc_fishpen(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      if (coast(...toWorld(x, z)).d > 450) return kits.lc_fields(x, z, s, st, b, r);
      prop('box', x, .1, z, W, .2, D, [.03, .03, .03]);
      const R = 3.5 + r() * 2, nx = Math.max(1, Math.floor(W / (R * 2.5))), nz = Math.max(1, Math.floor(D / (R * 2.5)));
      for (let i = 0; i < Math.min(nx, 4); i++) for (let j = 0; j < Math.min(nz, 4); j++) {
        const px = x + (i - (Math.min(nx, 4) - 1) / 2) * R * 2.5, pz = z + (j - (Math.min(nz, 4) - 1) / 2) * R * 2.5;
        prop('cyl', px, .35, pz, R * 2 + .6, .5, R * 2 + .6, [.07, .07, .07]);
        prop('cyl', px, .62, pz, R * 2, .06, R * 2, WATER);
        if (r() < .4) glow(px + R, .9, pz, .2, .2, .2, dim(TEAL, .5));
      }
      bld(x - W / 2 + 2.5, z + D / 2 - 2.5, 4, 3, 3, st, r, { lit: .25, roof: false, skin: SKINS.sparse });
    },

    // Water reclamation: round filter pools over tanks, faint teal rims.

    lc_reclaim(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      prop('box', x, .1, z, W, .2, D, [.045, .045, .045]);
      const R = 4 + r() * 2, step = R * 2.4, nx = Math.min(4, Math.floor(W / step)), nz = Math.min(4, Math.floor(D / step));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const px = x + (i - (nx - 1) / 2) * step, pz = z + (j - (nz - 1) / 2) * step;
        prop('cyl', px, .5, pz, R * 2 + .5, .8, R * 2 + .5, [.09, .09, .09]);
        prop('cyl', px, .92, pz, R * 2, .04, R * 2, [.01, .03, .035]);
        if ((i + j) % 2) put(GLOWS.ring, px, .98, pz, R * 2, 1, R * 2, 0, 0, dim(TEAL, .25));
      }
    },

    // Marsh: dark reed beds, water channels, an elevated walkway with a faint lamp strip.

    lc_wetland(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      prop('box', x, .08, z, W, .16, D, MARSH);
      for (let k = 0; k < 3; k++) {
        const cz = z + (k - 1) * D * .3 + (r() - .5) * 3, ry = (r() - .5) * .5;
        prop('box', x, .18, cz, W * (.6 + .3 * r()), .04, 2 + r() * 3, WATER, ry);
      }
      for (let k = Math.min(24, Math.floor(W * D / 40)); k > 0; k--)
        tree(r() < .75 ? 'shrub' : 'fern', x + (r() - .5) * W, .1, z + (r() - .5) * D, .6 + r() * (r() < .2 ? 4 : 1), 1.2 + r() * 2, r);
      const wx = (r() - .5) * W * .3, y = 3;
      prop('box', x + wx, y, z, 1.6, .25, D - 2, [.08, .065, .05]);
      for (let t = -D / 2 + 3; t < D / 2 - 2; t += 7) prop('box', x + wx, y / 2, z + t, .25, y, .25, DARK);
      glow(x + wx + .7, y + .25, z, .06, .06, D - 3, [.12, .1, .05]);
    },

    // Village pocket: small homes round a lane, warm windows, gardens. A noodle stall faces the street.

    lc_village(x, z, s, st, b, r) {
      const [W, D] = dims(s), f = H.frame()?.front ?? { x: 0, z: 1 };
      prop('box', x, .1, z, W, .2, D, [.035, .04, .025]);
      prop('box', x, .22, z, W, .04, 2.4, [.06, .055, .05]);
      const n = Math.min(8, Math.max(2, Math.floor(W / 7.5)));
      for (let k = 0; k < n; k++) {
        const hx = x - W / 2 + (k % Math.ceil(n / 2) + .5) * W / Math.ceil(n / 2), sd = k < n / 2 ? -1 : 1;
        const hw = 4 + r() * 3, hd = 4 + r() * 2.5;
        house(hx, z + sd * (1.5 + hd / 2 + r() * Math.max(0, D / 2 - hd - 3)), hw, hd, 3 + r() * 2.5, st, r);
        if (r() < .6) tree(r() < .5 ? 'broad' : 'palm', hx + (r() - .5) * 3, .2, z + sd * (D / 2 - 1.5), 4 + r() * 3, 3 + r() * 2, r);
      }
      lamp(x, z, 4.5);
      if (r() < .5) {
        const sx = x + f.x * (W / 2 - 1.5), sz = z + f.z * (D / 2 - 1.5), ry = Math.atan2(f.x, f.z);
        prop('box', sx, .6, sz, 3, 1.2, 1.4, [.12, .08, .05], ry);
        prop('box', sx + f.x * .5, 2.4, sz + f.z * .5, 3.6, .1, 2.2, [.35, .08, .05], ry);
        glow(sx + f.x * .3, 2, sz + f.z * .3, .3, .3, .3, [1.6, 1, .45]);
        if (r() < .4) textSign(pick(r, ['NOODLES', 'CAFÉ', 'TIENDA']), sx + f.x * 1.4, 3.3, sz + f.z * 1.4, 2.8, .7, ry, [1.1, .6, .25]);
      }
      if (r() < .35) stringLights([x - W / 2 + 1, 3, z], [x + W / 2 - 1, 3, z], .6, 8, dim(WARM, .8));
    },

    // Summer home of the corporate gentry: white walls, a lit pool, a clipped garden.

    lc_villa(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      prop('box', x, .1, z, W, .2, D, [.025, .045, .025]);
      const vw = W * .5, vd = D * .35, vx = x - W * .15, vz = z - D * .2;
      bld(vx, vz, vw, vd, 4, { ...st, base: [.42, .41, .38], win: [1, .8, .55] }, r, { lit: .55, roof: false, skin: SKINS.curtain });
      bld(vx + vw * .2, vz, vw * .5, vd * .8, 3.2, { ...st, base: [.4, .39, .36], win: [1, .8, .55] }, r, { y0: 4, lit: .5, roof: false, skin: SKINS.curtain });
      prop('box', vx, 4.1, vz, vw + 2, .2, vd + 2, [.3, .3, .28]);
      const px = x + W * .2, pz = z + D * .2;
      prop('box', px, .24, pz, W * .3, .1, D * .25, [.05, .06, .06]);
      glow(px, .3, pz, W * .27, .02, D * .22, [.05, .22, .26]);
      for (let k = 0; k < 6; k++) tree(k % 2 ? 'cypress' : 'palm', x - W / 2 + 1.5 + k * (W - 3) / 5, .2, z + D / 2 - 1.5, 5 + r() * 3, k % 2 ? 2.2 : 4, r);
      pool(vx, vz + vd / 2 + 2, 10, [.08, .06, .04]);
    },

    // Coastal cannery: long sheds, a cold store, steam, crates, a pier toward the sea. Inland it is a bioplastics plant.

    lc_cannery(x, z, s, st, b, r) {
      const [W, D] = dims(s), c = coast(...toWorld(x, z));
      prop('box', x, .1, z, W, .2, D, [.04, .04, .04]);
      const sw = W * .6, sd = D * .35;
      prop('box', x - W * .15, 3.5, z - D * .22, sw, 7, sd, [.12, .12, .125]);
      prop('box', x - W * .15, 7.3, z - D * .22, sw * .9, .6, sd * .3, [.08, .08, .085]);
      glow(x - W * .15, 5.5, z - D * .22 + sd / 2 + .05, sw * .8, .3, .05, dim(SEC, .25));
      if (c.d < 450) {
        bld(x + W * .3, z + D * .2, W * .3, D * .35, 6, { ...st, base: [.3, .31, .32], win: SEC }, r, { lit: .2, roof: false, skin: SKINS.bands });
        prop('cyl', x + W * .3, 10, z - D * .3, 1.2, 8, 1.2, METAL);
        H.puff(x + W * .3, 15, z - D * .3, 2, [.1, .1, .11]);
        const [lx, lz] = K.toLocalDir(c.nx, c.nz), L = Math.min(60, c.d + 15);
        if (c.d < 120) {
          prop('box', x + lx * (D / 2 + L / 2), .4, z + lz * (D / 2 + L / 2), 3, .4, L, [.08, .065, .05], Math.atan2(lx, lz));
          glow(x + lx * (D / 2 + L), 2, z + lz * (D / 2 + L), .3, .3, .3, [1.4, .9, .5]);
          prop('box', x + lx * (D / 2 + L * .7) + lz * 4, -1.4, z + lz * (D / 2 + L * .7) - lx * 4, 2.4, 1.4, 8, [.1, .12, .14], Math.atan2(lx, lz));
        }
      } else for (let k = 0; k < 3; k++) {
        const tx = x + W * (.1 + k * .14), tz = z + D * .22;
        prop('cyl', tx, 4, tz, 4, 8, 4, [.14, .15, .13]);
        put(GLOWS.ring, tx, 7.6, tz, 4.1, 1, 4.1, 0, 0, dim(TEAL, .35));
      }
      for (let k = Math.floor(r() * 5); k > 0; k--) prop('box', x + (r() - .5) * (W - 3), .8, z + D * .1 + r() * D * .3, 2.4, 1.2, 1.4, pick(r, [[.2, .06, .04], [.05, .1, .18], [.12, .12, .12]]), r() * 3);
      glow(x - W / 2 + 1, 6, z + D / 2 - 1, .5, .3, .5, [1.3, .6, .15]);
    },
  };
  return kits;
}

export const tiers = {
  'la-costa': {
    0: ['lc_fields', 'lc_fields', 'lc_fields', 'lc_orchard', 'lc_orchard', 'lc_wetland', 'lc_greenhouse', 'lc_village', 'lc_fishpen', 'lc_reclaim', 'lc_villa',
      'lc_silo', 'lc_workhouse', 'lc_cropstack'],
    1: ['lc_fields', 'lc_orchard', 'lc_greenhouse', 'lc_greenhouse', 'lc_agroplex', 'lc_agroplex', 'lc_village', 'lc_village', 'lc_cannery', 'lc_fishpen', 'lc_villa',
      'lc_silo', 'lc_silo', 'lc_workhouse', 'lc_workhouse', 'lc_cropstack'],
  },
};

export function blocks(H) {
  const { SKINS, beacon, beam, bld, glow, pool, prop, puff, textSign } = H;
  const { tree, lamp, combine, house, agroplex, greenhouse, field } = shared(H);

  // Security fence with floodlight posts round a site.

  const fence = (x, z, w, d, r) => {
    for (const sd of [-1, 1]) {
      prop('box', x, 1.5, z + sd * d / 2, w, 3, .12, [.08, .09, .09]);
      prop('box', x + sd * w / 2, 1.5, z, .12, 3, d, [.08, .09, .09]);
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      prop('box', x + sx * w / 2, 6, z + sz * d / 2, .4, 12, .4, DARK);
      glow(x + sx * (w / 2 - .5), 12, z + sz * (d / 2 - .5), 1.4, .4, .8, SEC);
      pool(x + sx * (w / 2 - 8), z + sz * (d / 2 - 8), 22, [.07, .09, .1]);
    }
  };

  // Grain terminal: two rows of tall silos, a 60 to 75 m headhouse, a conveyor bridge, a rail spur with
  // hopper cars and floodlit yards. It is listed twice, so more La Costa blocks pick it.

  const granary = (x, z, w, d, st, r) => {
    prop('box', x, .1, z, w, .2, d, DIRT);
    const R = 9, n = Math.min(8, Math.floor((w - 30) / R)), sh = 40 + 10 * r(), x0 = x - w / 2 + 4 + R / 2, CONC = [.3, .29, .26];
    for (let i = 0; i < n; i++) for (const j of [-.5, .5]) {
      prop('cyl', x0 + i * R, sh / 2, z - 6 + j * R, R - .4, sh, R - .4, CONC.map(c => c * (.9 + .2 * r())));
      prop('cone', x0 + i * R, sh + .8, z - 6 + j * R, R - .3, 1.6, R - .3, [.1, .1, .1]);
    }
    prop('box', x0 + (n - 1) * R / 2, sh + 2.5, z - 6, n * R, 3, 4, [.12, .11, .1]);
    const hx = x0 + n * R + 5, hh = 60 + 15 * r();
    bld(hx, z - 6, 11, 14, hh, { ...st, base: CONC, win: WARM }, r, { lit: .35, roof: false, skin: SKINS.sparse });
    beam([hx + 10, 1, z + d / 2 - 8], [hx, hh - 6, z - 6], 1.2, [.2, .16, .08]);
    glow(hx, hh - 4, z + 1.1, 7, .6, .2, dim(WARM, .7));
    beacon(hx, hh + 2, z - 6, r);
    textSign(pick(r, ['GRANOS DEL PACIFICO', 'TERMINAL GRANERA', 'COOP LA COSTA']), x0 + (n - 1) * R / 2, sh * .75, z - 6 + R + .2, Math.min(n * R - 4, 30), 4, 0, dim(WARM, .8));
    const rz = z + d / 2 - 6;
    prop('box', x, .3, rz, w - 4, .3, 3, [.07, .06, .05]);
    for (let k = 0; k < 6; k++) prop('box', x - w / 2 + 10 + k * 12, 2.2, rz, 10, 3.4, 3, [.24, .14, .06]);
    for (const g of [-1, 1]) {
      prop('box', x + g * w * .35, 9, z + d * .2, .5, 18, .5, DARK);
      glow(x + g * w * .35, 18, z + d * .2, 2.5, .5, 1, SEC);
      pool(x + g * w * .25, z + d * .25, 26, [.1, .08, .05]);
    }
  };

  return {
    // Agroplex campus: one or two towers on a podium, greenhouse rows, fields, a fenced and floodlit perimeter.

    lc_agrocampus: { zone: 'la-costa', build(x, z, w, d, st, r) {
      prop('box', x, .1, z, w, .2, d, SOIL);
      const two = w > 70 && r() < .6, cw = w * .45;
      const tx = x - w / 2 + cw / 2 + 2;
      agroplex(tx, z - (two ? d * .18 : 0), Math.min(cw, d) * .55, 90 + 90 * r(), st, r);
      if (two) agroplex(tx + cw * .1, z + d * .25, Math.min(cw, d) * .38, 55 + 50 * r(), st, r);
      const gx = x + cw / 2, gw = w - cw - 4, n = Math.min(6, Math.floor(d / 11));
      for (let k = 0; k < n; k++) greenhouse(gx, z - d / 2 + (k + .5) * d / n, gw - 4, d / n - 3, 5 + r() * 2, [.12, .028, .1], r);
      fence(x, z, w - 1, d - 1, r);
      textSign(pick(r, ['AGINFUSION', 'POLYMORE', 'KERNEL BIOTECH', 'NUTRI-VISTA']), tx, 9, z + d / 2 - 1, 12, 3, 0, dim(MAG, .8));
    } },

    // Farm estate: parcels of crop and orchard over the block, a farmstead in one corner, lamps along the tracks.

    lc_estate: { zone: 'la-costa', build(x, z, w, d, st, r) {
      prop('box', x, .08, z, w, .16, d, SOIL);
      const nx = 2 + Math.floor(r() * 2), nz = 2, pw = w / nx, pd = d / nz, home = Math.floor(r() * nx * nz);
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const px = x - w / 2 + (i + .5) * pw, pz = z - d / 2 + (j + .5) * pd, k = i * nz + j;
        if (k === home) {
          for (let q = 0; q < 4; q++) house(px + (q % 2 - .5) * 9, pz + (Math.floor(q / 2) - .5) * 9, 5 + r() * 3, 5 + r() * 2, 3 + r() * 3, st, r);
          prop('cyl', px + pw * .3, 6, pz - pd * .3, 3, 12, 3, [.16, .15, .14]);
          prop('cone', px + pw * .3, 13, pz - pd * .3, 3.1, 2, 3.1, [.12, .11, .1]);
          pool(px, pz, 18, [.09, .06, .03]);
          for (let q = 0; q < 5; q++) tree('broad', px + (r() - .5) * pw * .8, .2, pz + pd * .35, 5 + r() * 3, 4, r);
        } else if (r() < .3) for (let a = 0; a < 5; a++) for (let c = 0; c < 4; c++) tree('broad', px + (a - 2) * pw / 5.5, .2, pz + (c - 1.5) * pd / 4.5, 3.5 + r() * 2, 3, r);
        else field(px, pz, pw - 3, pd - 3, r, true);
      }
      for (let t = -w / 2 + 12; t < w / 2; t += 30) lamp(x + t, z, 5);
      if (r() < .6) combine(x + (r() - .5) * w * .6, z + pd * .5 * (r() < .5 ? -1 : 1), r() * 3, r);
    } },

    lc_granary: { zone: 'la-costa', build: granary },
    lc_granary2: { zone: 'la-costa', build: granary },

    // Weyland "Reclamation Project": farmland under clearance. Mud, bioroid rigs, floodlights, a rising agroplex frame.

    lc_clearing: { zone: 'la-costa', build(x, z, w, d, st, r) {
      prop('box', x, .08, z, w, .16, d, [.05, .035, .022]);
      field(x - w * .3, z, w * .35, d - 4, r);
      const fx = x + w * .15, fw = Math.min(w * .35, d * .5), fh = 30 + 40 * r();
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) prop('box', fx + sx * fw / 2, fh / 2, z + sz * fw / 2, .8, fh, .8, [.2, .16, .06]);
      for (let y = 8; y < fh; y += 8) for (const sd of [-1, 1]) {
        prop('box', fx, y, z + sd * fw / 2, fw, .5, .5, [.18, .14, .05]);
        prop('box', fx + sd * fw / 2, y, z, .5, .5, fw, [.18, .14, .05]);
      }
      prop('box', fx, fh + 4, z - fw / 2, .6, 8, .6, [.3, .22, .05]);
      prop('box', fx + fw * .4, fh + 8, z - fw / 2, fw * 1.2, .8, .8, [.3, .22, .05]);
      beacon(fx + fw, fh + 8.8, z - fw / 2, r);
      for (let k = 0; k < 4; k++) {
        const bx = x + (r() - .2) * w * .6, bz = z + (r() - .5) * d * .8, ry = r() * 3;
        prop('box', bx, 3, bz, 3, 6, 5, [.22, .17, .05], ry);
        prop('box', bx, 7, bz, 1.2, 2, 1.2, [.25, .25, .27], ry);
        glow(bx, 7.2, bz, .5, .3, .5, [.3, .9, 1.1]);
      }
      for (const sd of [-1, 1]) {
        prop('box', x + sd * w * .4, 9, z + sd * d * .4, .5, 18, .5, DARK);
        glow(x + sd * w * .4, 18, z + sd * d * .4, 2.5, .5, 1, SEC);
        pool(x + sd * w * .25, z + sd * d * .25, 30, [.08, .09, .1]);
      }
      textSign('RECLAMATION PROJECT', x - w * .2, 4, z + d / 2 - 1, 14, 3, 0, [1.2, 1.1, .9]);
      for (let k = 0; k < 4; k++) puff(x + (r() - .5) * w, 2 + r() * 3, z + (r() - .5) * d, 5, [.06, .05, .04]);
    } },
  };
}

export function landmarks(H) {
  const { GLOWS, SKINS, bld, flickerGlow, glow, pool, prop, put, puff, textSign } = H;
  const K = shared(H);
  const { tree, agroplex, greenhouse, coast, toLocal } = K;

  // Small boat: hull and cabin along heading ry, with lights.

  const boat = (x, z, ry, len, rgb, r) => {
    const sx = Math.sin(ry), sz = Math.cos(ry);
    prop('box', x, -1.6, z, len * .35, 1, len, [.12, .12, .13], ry);
    prop('box', x - sx * len * .1, -.8, z - sz * len * .1, len * .25, 1.2, len * .3, [.2, .2, .2], ry);
    glow(x + sx * len * .5, -.6, z + sz * len * .5, .3, .3, .3, rgb);
    glow(x - sx * len * .45, -.6, z - sz * len * .45, .3, .3, .3, [1.4, .1, .06]);
  };

  // Moving parts live in their own meshes in the landmark group, because shared instances are frozen into tiles
  // after the build. A part is [x, y, z, sx, sy, sz, rgb] round the mesh's pivot.

  const _o = new H.THREE.Object3D(), _c = new H.THREE.Color();
  const mover = (geometry, material, x, y, z, parts) => {
    const m = new H.THREE.InstancedMesh(geometry, material, parts.length);
    parts.forEach(([px, py, pz, sx, sy, sz, rgb], i) => {
      _o.position.set(px, py, pz); _o.scale.set(sx, sy, sz); _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix); m.setColorAt(i, _c.setRGB(...rgb));
    });
    m.position.set(x, y, z); m.userData.noTile = true; m.frustumCulled = false;
    H.decor.add(m);
    return m;
  };
  const FALLS = {}, PATROL = {}, ARMS = {};

  // Block axes from the street front: a runs toward the street (+A/2 is the kerb), b runs across it.

  const axes = (x, z, w, d) => {
    const f = H.frame()?.front ?? { x: 0, z: 1 }, zf = !!f.z, sg = zf ? f.z : f.x;
    return { A: zf ? d : w, B: zf ? w : d, ry: Math.atan2(f.x, f.z), face: [f.x, f.z],
      p: (a, b) => zf ? [x + b, z + a * sg] : [x + a * sg, z + b], sz: (sa, sb) => zf ? [sb, sa] : [sa, sb],
      at: (a, y, b) => zf ? [x + b, y, z + a * sg] : [x + a * sg, y, z + b],
      prop: (kind, a, y, b, sa, sy, sb, rgb, ry = 0) => { const [px, pz] = zf ? [x + b, z + a * sg] : [x + a * sg, z + b], [u, v] = zf ? [sb, sa] : [sa, sb]; prop(kind, px, y, pz, u, sy, v, rgb, ry); } };
  };

  // Reclamation pools: concrete rims over dark water with faint teal rims, header pipes between the rows.
  // Returns the pool centres. Pools run 6.5 m in radius, half the canon size, so a block holds a dozen or more.

  const R_POOL = 6.5, STEP = 15.5;
  const pools = (x, z, W, D) => {
    const nx = Math.max(1, Math.floor(W / STEP)), nz = Math.max(1, Math.floor(D / STEP)), out = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const px = x + (i - (nx - 1) / 2) * STEP, pz = z + (j - (nz - 1) / 2) * STEP;
      prop('cyl', px, .45, pz, R_POOL * 2 + .8, .9, R_POOL * 2 + .8, [.1, .1, .1]);
      prop('cyl', px, .92, pz, R_POOL * 2, .04, R_POOL * 2, [.008, .028, .032]);
      put(GLOWS.ring, px, .98, pz, R_POOL * 2, 1, R_POOL * 2, 0, 0, dim(TEAL, (i * 7 + j * 3) % 4 ? .14 : .32));
      out.push([px, pz]);
    }
    for (let j = 0; j < nz - 1; j++) prop('box', x, .5, z + (j - (nz - 2) / 2) * STEP, nx * STEP, .7, .7, METAL);
    return out;
  };

  // Floodlight poles at the four corners of a yard.

  const floods = (x, z, W, D) => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      prop('box', x + sx * W / 2, 7, z + sz * D / 2, .4, 14, .4, DARK);
      glow(x + sx * (W / 2 - .6), 14, z + sz * (D / 2 - .6), 1.4, .4, .8, SEC);
      pool(x + sx * (W / 2 - 9), z + sz * (D / 2 - 9), 24, [.06, .08, .09]);
    }
  };

  // The outer pool blocks of the reclamation plant: pools, a valve shed and floods. No label of their own.

  const annex = (x, z, w, d, st, r) => {
    prop('box', x, .1, z, w, .2, d, [.045, .045, .045]);
    pools(x, z, w - 4, d - 10);
    bld(x - w / 2 + 4, z + d / 2 - 3, 5, 3.5, 3, { ...st, base: [.2, .2, .2], win: TEAL }, r, { lit: .3, roof: false, skin: SKINS.sparse });
    floods(x, z, w - 2, d - 2);
  };

  return {
    // Vitru-Val agroplex beside Cascada El Armadillo, the restored waterfall over hidden plascrete beams.

    lc_vitruval: { at: [725, 1181], label: 'Vitru-Val Agroplex · Cascada El Armadillo', labelY: 260, minSide: 60, reach: 200, build(x, z, w, d, st, r) {
      prop('box', x, .1, z, w, .2, d, SOIL);
      const ax = x - w * .22;
      agroplex(ax, z - d * .12, Math.min(w * .4, d * .5), 210, st, r, true);
      agroplex(ax + w * .2, z + d * .28, Math.min(w, d) * .2, 95, st, r);
      for (let k = 0; k < 3; k++) greenhouse(ax, z + d * (.15 + k * .1), w * .35, d * .07, 5, [.12, .028, .1], r);

      // Cliff, falls and plunge pool on the east side, river channel running south.

      const cx = x + w * .34, ch = 34, cw = w * .3;
      for (let k = 0; k < 5; k++) prop('box', cx + k * 2.5, ch * (1 - k * .16) / 2, z - d * .3, cw, ch * (1 - k * .16), 14 - k * 2, [.06, .055, .05].map(c => c * (1 + k * .1)));
      const streaks = [], sp = ch / 3;
      for (let k = 0; k < 7; k++) {
        const t = k / 6, sx = cx - cw * .25 + t * cw * .5, jit = r() * sp;
        glow(sx, ch * .5, z - d * .3 + 7.2, 1.6 + r() * 1.5, ch * (.75 + .25 * r()), .3, [.38, .6, .7].map(c => c * (.7 + .5 * r())));
        for (let j = 0; j < 4; j++) streaks.push([sx + (r() - .5), ch - 2 - jit - j * sp, z - d * .3 + 7.45, 1.1, 3.2, .15, [.55, .8, .9]]);
      }

      // Bright streaks fall down the strands. The lowest row sinks below the ground, and update() wraps one spacing.

      FALLS.mesh = mover(H.PROPS.box.geometry, GLOWS.sphere.material, 0, 0, 0, streaks);
      FALLS.sp = sp;
      prop('cyl', cx, .25, z - d * .3 + 16, cw * 1.1, .3, 18, WATER);
      put(GLOWS.ring, cx, .5, z - d * .3 + 16, cw * 1.05, 1, 17, 0, 0, [.3, .55, .65]);
      for (let k = 0; k < 6; k++) puff(cx + (r() - .5) * cw, 3 + r() * 10, z - d * .3 + 12 + r() * 6, 5 + r() * 3, [.1, .12, .13]);
      prop('box', cx, .2, z + d * .2, 6, .1, d * .5, WATER);
      glow(cx, .26, z + d * .2, 1.5, .02, d * .48, [.04, .09, .1]);
      for (let k = 0; k < 14; k++) tree(pick(r, ['broad', 'fern', 'palm']), cx + (r() < .5 ? -1 : 1) * (6 + r() * 8), .2, z - d * .05 + r() * d * .5, 6 + r() * 6, 4 + r() * 3, r);
      for (let k = 0; k < 6; k++) tree('broad', cx + (r() - .5) * cw, ch * (.8 + .2 * r()), z - d * .3 + (r() - .5) * 8, 5 + r() * 4, 4, r);
      for (let k = 0; k < 4; k++) glow(cx - cw / 2 + k * cw / 3, 1.2, z - d * .3 + 26, .25, .25, .25, dim(WARM, 1.1));
      textSign('VITRU-VAL', ax, 14, z - d * .12 + Math.min(w * .4, d * .5) * .5 + 6, 18, 4.5, 0, dim(MAG, .9));
    }, update(t) {
      if (FALLS.mesh) FALLS.mesh.position.y = -((t * 13) % FALLS.sp);
    } },

    // Mama Qucha: nightclub floating far off the Nihongai coast, screens hiding the city, reached by a lit underwater
    // slidewalk. It sits up the coast from the La Costa Floating Nightclub.

    lc_mamaqucha: { at: [280, 700], label: 'Mama Qucha', labelY: 60, minSide: 30, reach: 500, build(x, z, w, d, st, r) {
      const [wx, wz] = K.toWorld(x, z), c = coast(wx, wz);
      const [ux, uz] = K.toLocalDir(c.nx, c.nz), off = c.d + 620;
      const mx = x + ux * off, mz = z + uz * off, ry = Math.atan2(ux, uz);
      bld(x, z, Math.min(w, 20), Math.min(d, 14), 5, { ...st, base: [.12, .12, .14], win: TEAL }, r, { lit: .5, roof: false, skin: SKINS.curtain });
      textSign('MAMA QUCHA', x, 7, z + Math.min(d, 14) / 2 + .5, 9, 2.2, Math.atan2(ux, uz), dim(TEAL, 1.1));
      for (let t = 30; t < off - 30; t += 22) glow(x + ux * t, -2.1, z + uz * t, .5, .1, .5, [.04, .2, .18]);

      // Club platform: stacked discs, a screen dome of lattice rings, teal body light, hidden dock.

      prop('cyl', mx, -1.5, mz, 70, 2, 70, [.07, .08, .09]);
      prop('cyl', mx, .5, mz, 50, 2, 50, [.1, .1, .11]);
      put(GLOWS.ring, mx, -.4, mz, 71, 1, 71, 0, 0, dim(TEAL, .8));
      bld(mx, mz, 22, 22, 9, { ...st, base: [.1, .1, .12], win: [.6, .3, 1.1] }, r, { y0: 1.5, lit: .7, roof: false, shape: 'cyl', skin: SKINS.curtain });
      for (let k = 0; k < 9; k++) {
        const t = k / 9, R = 46 * Math.cos(t * Math.PI / 2), y = 1.5 + 24 * Math.sin(t * Math.PI / 2);
        put(GLOWS.ring, mx, y, mz, R, 1, R, 0, 0, (k % 3 ? TEAL : MAG).map(q => q * .55));
        prop('cyl', mx, y, mz, R * 1.01, .25, R * 1.01, [.05, .06, .07]);
      }
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2;
        prop('box', mx + Math.cos(a) * 23, 13, mz + Math.sin(a) * 23, .5, 24, .5, DARK, -a);
      }
      put(GLOWS.sphere, mx, 12, mz, 14, 8, 14, 0, 0, [.08, .35, .32]);
      for (let k = 0; k < 24; k++) {
        const a = r() * Math.PI * 2, rr = 6 + r() * 16;
        glow(mx + Math.cos(a) * rr, 2.2 + r() * 2, mz + Math.sin(a) * rr, .25, .25, .25, r() < .5 ? TEAL : MAG);
      }
      prop('box', mx + Math.cos(ry) * 40, -1.4, mz - Math.sin(ry) * 40, 4, .6, 26, [.08, .08, .09], ry);
      boat(mx + Math.cos(ry) * 45, mz - Math.sin(ry) * 45 + 6, ry, 12, SEC, r);

      // Two Coast Guard cutters circle the club on opposite sides, bow lamps forward and a pale wake behind.
      // Each mesh turns round the club, and the blue strobes blink in their own mesh.

      const hull = [], lit = [], strobe = [];
      for (const s of [-1, 1]) {
        hull.push([s * 140, -1.5, 0, 4, 1.2, 16, [.16, .17, .19]], [s * 140, -.3, s * 1.5, 3, 1.4, 5, [.22, .23, .25]]);
        lit.push([s * 140, -.6, -s * 8, .5, .5, .5, [1.4, 1.4, 1.2]], [s * 140, -.6, s * 8, .4, .4, .4, [1.4, .1, .06]], [s * 140, -1.95, s * 16, 1.4, .05, 14, [.2, .26, .28]]);
        strobe.push([s * 140, .7, s * 1.5, .7, .5, .7, [.4, .6, 2]]);
      }
      PATROL.parts = [
        mover(H.PROPS.box.geometry, H.PROPS.box.material, mx, 0, mz, hull),
        mover(H.PROPS.box.geometry, GLOWS.sphere.material, mx, 0, mz, lit),
        PATROL.strobe = mover(GLOWS.sphere.geometry, GLOWS.sphere.material, mx, 0, mz, strobe),
      ];
      return [mx, mz];
    }, update(t) {
      if (!PATROL.parts) return;
      for (const m of PATROL.parts) m.rotation.y = t * .035;
      PATROL.strobe.visible = (t * 1.2) % 1 < .1;
    } },

    // Pisces fish farm: open-sea pen grid, sonobuoy fence lights, bait tanks, dorm barges and boats.

    lc_pisces: { at: [495, 1400], label: 'Pisces Fish Farm', labelY: 40, minSide: 30, reach: 900, build(x, z, w, d, st, r) {
      const [tx, tz] = toLocal(...K.mapWorld([495, 1400])), [wx, wz] = K.toWorld(x, z), c = coast(wx, wz);
      const [ux, uz] = K.toLocalDir(c.nx, c.nz);

      // The pen field sits at the canon spot, or 260 m offshore when that spot is on land.

      const far = Math.hypot(tx - x, tz - z) > c.d + 120;
      const px = far ? tx : x + ux * (c.d + 260), pz = far ? tz : z + uz * (c.d + 260);
      prop('box', x, .1, z, w, .2, d, [.04, .04, .04]);

      // Shore sheds: ridged roofs, roller doors and lamps on the -z yard side, vents and ice tanks on top.

      const fz = z - d * .3, sw = w * .25;
      for (let k = 0; k < 3; k++) {
        const sx = x - w * .3 + k * w * .3;
        prop('box', sx, 3.5, z, sw, 7, d * .6, [.12, .12, .13]);
        prop('box', sx, 7.4, z, sw + .6, .8, d * .6 + .6, [.09, .09, .1]);
        prop('box', sx, 8.2, z, sw * .5, .8, d * .6, [.1, .1, .11]);
        prop('box', sx, 2.6, fz - .1, sw * .55, 5, .2, [.07, .07, .08]);
        for (let j = 0; j < 6; j++) prop('box', sx, .5 + j * .8, fz - .22, sw * .55, .06, .05, [.04, .04, .045]);
        glow(sx, 5.6, fz - .4, 1, .3, .3, dim(WARM, .9));
        pool(sx, fz - 5, 8, dim(WARM, .1));
        for (const g of [-1, 1]) prop('cyl', sx + g * sw * .3, 9.4, z + d * .15, 1.2, 1.6, 1.2, METAL);
        prop('cyl', sx + sw * .25, 8.8, z - d * .12, 3, 3.6, 3, [.2, .21, .22]);
      }
      glow(x, 7.5, fz - .4, w * .8, .2, .2, dim(SEC, .3));
      for (let k = 0; k < 5; k++) prop('box', x + (r() - .5) * w * .8, .7, fz - 4 - r() * 6, 2.4, 1.2, 1.6, [.14, .16, .18]);
      const R = 11, step = 30, nx = 7, nz = 4;
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const qx = px + (i - (nx - 1) / 2) * step, qz = pz + (j - (nz - 1) / 2) * step;
        prop('cyl', qx, -1.8, qz, R * 2, .5, R * 2, [.1, .1, .1]);
        prop('cyl', qx, -1.75, qz, R * 2 - 1.4, .45, R * 2 - 1.4, [.005, .015, .02]);
        put(GLOWS.ring, qx, -1.4, qz, R * 2, 1, R * 2, 0, 0, [.05, .12, .11]);
        if ((i + j) % 3 === 0) glow(qx + R, -1, qz, .35, .35, .35, dim(TEAL, .7));
      }
      const fw = nx * step + 40, fd = nz * step + 40;
      for (let t = 0; t < 1; t += 1 / 16) for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, 1, -1, 1]]) {
        flickerGlow(px + lerpN(ax, bx, t) * fw / 2, -1, pz + az * fd / 2, .5, .5, .5, [1.3, .8, .2], r);
      }
      for (let t = 0; t < 1; t += 1 / 8) for (const sd of [-1, 1]) glow(px + sd * fw / 2, -1, pz + (t - .5) * fd, .5, .5, .5, [1.3, .8, .2]);
      for (let k = 0; k < 6; k++) {
        const bx = px + (r() - .5) * fw, bz = pz + fd / 2 + 14 + r() * 10;
        prop('cyl', bx, -1.2, bz, 6, 1.6, 6, [.16, .16, .14]);
        glow(bx, -.2, bz, .3, .3, .3, SEC);
      }
      for (let k = 0; k < 3; k++) {
        const bx = px - fw / 2 - 24 - k * 18, bz = pz + (k - 1) * 22;
        prop('box', bx, -1.3, bz, 12, 1.4, 34, [.1, .1, .11]);
        bld(bx, bz, 10, 28, 6, { ...st, base: [.2, .2, .21], win: WARM }, r, { y0: -.6, lit: .55, roof: false, skin: SKINS.grid });
      }
      for (let k = 0; k < 6; k++) boat(px + (r() - .5) * fw * 1.2, pz + (r() - .5) * fd * 1.4, r() * 6.3, 8 + r() * 8, WARM, r);

      // Roof sign over the yard side. It faces -z, so the card's camera looks from there.

      prop('box', x, 11.6, fz + .3, 21, 5.6, .3, DARK);
      for (const g of [-1, 1]) prop('box', x + g * 8, 9.8, fz + .6, .3, 3, .3, DARK);
      textSign('PISCES', x, 11.6, fz - .1, 20, 5, Math.PI, dim(TEAL, .9));
      return { face: [0, -1] };
    } },

    // La Costa Water Storage and Reclamation Facility: three blocks of round filter pools over buried tanks.
    // The main block holds the control building and pump hall on the street side. Clarifier arms sweep its pools.

    // Machalilla Park: the city's great jungle preserve. A canopy walkway on stilts loops through the trees,
    // a slidewalk runs out to it from a visitor pavilion on the north edge, and camdrones hover over the nests.

    lc_machalilla: { at: [631.1, 1300], free: [540, 300], fillUnder: true, label: 'Machalilla Park', labelY: 60, build(x, z, w, d, st, r) {
      const P = H.CITY.parks.find(p => /Machalilla/.test(p.name)).poly, [cx, cz] = K.toWorld(x, z);
      const inPark = (lx, lz) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > lz + cz) !== (zj > lz + cz) && lx + cx < (xj - xi) * (lz + cz - zi) / (zj - zi) + xi) c = !c; } return c; };
      const Y = 17, ring = [];
      for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; ring.push([x + Math.cos(a) * 170 + Math.sin(a * 3) * 18, z + Math.sin(a) * 85 + Math.cos(a * 2) * 12]); }
      ring.forEach(([ax, az], k) => {
        const [bx, bz] = ring[(k + 1) % ring.length];
        if (!inPark(ax, az) || !inPark(bx, bz)) return;
        H.beam([ax, Y, az], [bx, Y, bz], 1.4, [.14, .12, .1]);
        H.beam([ax, Y - .3, az], [bx, Y - .3, bz], .15, [.4, .9, .5], 'glow');
        prop('cyl', ax, Y / 2, az, .5, Y, .5, DARK);
        glow(ax, Y + 1.4, az, .6, .5, .6, dim(WARM, 1.1));
        pool(ax, az, 9, [.03, .05, .03]);
      });

      // Pavilion and slidewalk from the park's north edge, where the tube-lev visitors arrive.

      const px = x - 40, pz = z - d / 2 + 14;
      bld(px, pz, 26, 14, 7, { ...st, base: [.2, .22, .18], win: [1, .85, .6] }, r, { lit: .6, roof: false, skin: SKINS.bands });
      prop('box', px, 7.6, pz, 30, .6, 18, [.12, .16, .1]);
      textSign('MACHALILLA', px, 9.4, pz + 9.2, 16, 2.6, 0, [.5, 1.3, .6]);
      H.beam([px, Y, pz + 8], [ring[21][0], Y, ring[21][1]], 2, [.16, .14, .12]);
      H.beam([px, Y - .3, pz + 8], [ring[21][0], Y - .3, ring[21][1]], .15, [.3, .6, .35], 'glow');
      prop('box', px, Y / 2 + 3, pz + 6, 3, Y + 6, 3, [.12, .12, .13]);

      // Camdrones over the canopy, each with a red record light.

      for (let k = 0; k < 7; k++) {
        const a = r() * Math.PI * 2, rr = 40 + r() * 120, dx = x + Math.cos(a) * rr, dz = z + Math.sin(a) * rr * .5;
        if (!inPark(dx, dz)) continue;
        prop('box', dx, 30 + r() * 10, dz, .8, .25, .8, [.15, .15, .16]);
        glow(dx, 29.6, dz, .25, .25, .25, [1.4, .1, .08]);
      }

      // The card's camera looks in from the sea over the walkway loop.

      return { focus: [0, 1], span: 300, face: [0, 1] };
    } },

    lc_reclaim_hq: { at: [665, 1398.3], label: 'La Costa Water Reclamation Facility', labelY: 50, minSide: 50, reach: 80, build(x, z, w, d, st, r) {
      const X = axes(x, z, w, d), { A, B } = X;
      prop('box', x, .1, z, w, .2, d, [.045, .045, .045]);
      const [px, pz] = X.p(-10.5, 0), centres = pools(px, pz, ...X.sz(A - 27, B - 4));

      // Control building with a lit band and the plant's name, pump hall beside it, trunk pipes to the pool field.

      const [cx, cz] = X.p(A / 2 - 11, -B * .22), [hx, hz] = X.p(A / 2 - 10, B * .2);
      bld(cx, cz, ...X.sz(14, B * .4), 12, { ...st, base: [.15, .16, .17], win: TEAL }, r, { lit: .5, roof: false, skin: SKINS.bands });
      bld(hx, hz, ...X.sz(12, B * .45), 7, { ...st, base: [.16, .16, .17], win: SEC }, r, { lit: .2, roof: false, skin: SKINS.sparse });
      for (let k = -1; k <= 1; k++) {
        const [vx, vz] = X.p(A / 2 - 10, B * .2 + k * B * .12);
        prop('cyl', vx, 8, vz, 1.4, 2.4, 1.4, METAL);
        const [ax, az] = X.p(A / 2 - 16, B * .2 + k * 4), [bx, bz] = X.p(A / 2 - 23, B * .2 + k * 4);
        H.beam([ax, .9, az], [bx, .9, bz], 1.1, [.15, .15, .16]);
      }
      const [sx, sz] = X.p(A / 2 - 3.9, -B * .22);
      textSign('LA COSTA WATER RECLAMATION', sx, 10, sz, Math.min(B * .38, 24), 2.4, X.ry, dim(TEAL, 1));

      // Gate board with the four owners.

      ['AGINFUSION', 'POLYMORE', 'KERNEL BIOTECH', 'NUTRI-VISTA'].forEach((n, k) => {
        const [gx, gz] = X.p(A / 2 - 1, -B / 2 + 4 + k * 5.5);
        textSign(n, gx, 2.2, gz, 5, 1, X.ry, dim(k % 2 ? SEC : WARM, .7));
      });
      floods(x, z, w - 2, d - 2);

      // One arm per pool, with a lamp at the tip. update() turns them all.

      const arms = centres.map(() => [0, 0, 0, 1, 1, 1, [.16, .16, .17]]), tips = centres.map(() => [0, 0, 0, 1, 1, 1, dim(TEAL, .9)]);
      ARMS.mesh = mover(H.PROPS.box.geometry, H.PROPS.box.material, 0, 0, 0, arms);
      ARMS.tip = mover(GLOWS.sphere.geometry, GLOWS.sphere.material, 0, 0, 0, tips);
      ARMS.pools = centres.map(([a, b]) => [a, b, r() * 6.3]);
      ARMS.o = new H.THREE.Object3D();
      return { face: X.face };
    }, update(t) {
      if (!ARMS.pools) return;
      const o = ARMS.o;
      ARMS.pools.forEach(([px, pz, ph], i) => {
        const a = t * .12 + ph, c = Math.cos(a), s = Math.sin(a);
        o.position.set(px, 1.25, pz); o.rotation.set(0, a, 0); o.scale.set(R_POOL * 2 - .6, .35, .45); o.updateMatrix();
        ARMS.mesh.setMatrixAt(i, o.matrix);
        o.position.set(px + c * (R_POOL - .5), 1.55, pz - s * (R_POOL - .5)); o.scale.set(.35, .35, .35); o.updateMatrix();
        ARMS.tip.setMatrixAt(i, o.matrix);
      });
      ARMS.mesh.instanceMatrix.needsUpdate = ARMS.tip.instanceMatrix.needsUpdate = true;
    } },
    lc_reclaim_n: { at: [645, 1381.1], minSide: 50, reach: 80, build: annex },
    lc_reclaim_ne: { at: [656.9, 1367.5], minSide: 50, reach: 80, build: annex },

    // Los Scorpiones lair: two bunkers dug into a jungle hill on the coast by the water reclamation facility,
    // registered as hazardous storage. A truck waits at one door under a weak work light. Nutri-Vista survey
    // stakes mark the road edge.

    lc_scorpiones: { at: [631.4, 1396.7], label: 'Los Scorpiones Lair', labelY: 40, minSide: 50, reach: 80, build(x, z, w, d, st, r) {
      const X = axes(x, z, w, d), { A, B } = X, CONC = [.15, .15, .14];
      prop('box', x, .08, z, w, .16, d, [.016, .028, .014]);

      // The hill: two flattened cones toward the back, the slope meeting the bunker doors. hill() gives its height.

      const ra = (A * .24 + 2) / .93, rb = B * .5, HH = 15;
      X.prop('cone', -A * .22, HH / 2, 0, ra * 2, HH, rb * 2, [.03, .032, .018]);
      X.prop('cone', -A * .22, HH * .3, 0, ra * 1.9, HH * .6, rb * 2.1, [.025, .03, .016]);
      const hill = (a, b) => Math.max(0, HH * (1 - Math.hypot((a + A * .22) / ra, b / rb)));

      // Dirt track from the street to the bunker yard.

      X.prop('box', A * .2, .2, 0, A * .55, .04, 7, [.045, .035, .022]);
      X.prop('box', A * .02, .21, 0, 8, .04, B * .6, [.045, .035, .022]);

      // Bunker fronts set into the hill face: concrete portal, steel door, hazard stripes, a dim lamp.

      for (const sd of [-1, 1]) {
        const b = sd * B * .18, a0 = A * .02 - 4;
        X.prop('box', a0, 3, b, 6, 6, 11, CONC);
        X.prop('box', a0 + 3.05, 2, b, .1, 4, 6, DARK);
        for (let k = 0; k < 5; k++) X.prop('box', a0 + 3.1, 5.1, b - 4 + k * 2, .1, .5, 1, k % 2 ? DARK : [.5, .4, .04]);
        const [lx, lz] = X.p(a0 + 3.4, b + 3.5);
        if (sd < 0) H.flickerGlow(lx, 4.6, lz, .5, .3, .4, [1.2, .9, .4], r); else glow(lx, 4.6, lz, .4, .25, .3, [.5, .4, .2]);
        pool(...X.p(a0 + 6, b + 2), 7, [.06, .05, .03]);
        for (let k = 0; k < 9; k++) {
          const ta = a0 - 1 - r() * 6, tb = b + (r() - .5) * 15, [qx, qz] = X.p(ta, tb);
          tree(pick(r, ['fern', 'shrub', 'palm', 'broad']), qx, Math.max(hill(ta, tb), 5.5) - .5, qz, 3 + r() * 6, 3 + r() * 4, r);
        }
      }
      const [gx, gz] = X.p(A * .02 - .85, -B * .18);
      textSign('HAZARDOUS STORAGE', gx, 6.6, gz, 8, 1.1, X.ry, [1.2, .95, .1]);

      // Truck backed up to the west door, tail lamps on.

      X.prop('box', A * .14, 2.2, -B * .18, 9, 3.4, 3, [.1, .1, .095]);
      X.prop('box', A * .14 + 7, 1.6, -B * .18, 3, 2.6, 2.8, [.13, .11, .08]);
      for (const g of [-1, 1]) glow(...X.at(A * .14 - 4.6, 1, -B * .18 + g), .25, .2, .25, [1.4, .1, .06]);
      for (let k = 0; k < 4; k++) X.prop('box', A * .08 + r() * 3, .5, -B * .18 + 3 + r() * 4, 1.2, 1, 1.2, [.12, .1, .06], r());

      // Canopy over the rest: tall crowns on the hill and round the yard, kept off the track.

      for (let k = 0; k < 110; k++) {
        const ta = (r() - .5) * A, tb = (r() - .5) * B;
        if ((ta > A * .02 - 4 && Math.abs(tb) < 5) || (ta > A * .02 - 6 && ta < A * .2 && Math.abs(tb) < B * .28)) continue;
        const [qx, qz] = X.p(ta, tb), yard = ta > A * .02 && ta < A * .3 && Math.abs(tb) < B * .35;
        if (yard) tree(pick(r, ['shrub', 'fern']), qx, 0, qz, 1.5 + r() * 3, 2 + r() * 2, r);
        else tree(pick(r, ['broad', 'broad', 'palm', 'fern']), qx, hill(ta, tb) - .5, qz, 9 + r() * 9, 6 + r() * 5, r);
      }

      // Nutri-Vista survey stakes along the street edge and a board on two posts.

      for (let k = 0; k < 5; k++) {
        const [qx, qz] = X.p(A / 2 - 1.5, -B / 2 + 4 + k * B / 5);
        prop('box', qx, .6, qz, .12, 1.2, .12, [.3, .25, .15]);
        glow(qx, 1.25, qz, .18, .12, .18, [1.4, .45, .08]);
      }
      const [nx, nz] = X.p(A / 2 - 1, B * .32);
      for (const g of [-1.6, 1.6]) X.prop('box', A / 2 - 1.2, 1.2, B * .32 + g, .15, 2.4, .15, DARK);
      textSign('NUTRI-VISTA · SURVEY SITE', nx, 2.3, nz, 4.6, 1, X.ry, [.45, 1.1, .5]);
      return { face: X.face };
    } },
  };
}

const lerpN = (a, b, t) => a + (b - a) * t;

// Helpers shared by lot kits, block kits and landmarks.

function shared(H) {
  const { GLOWS, SKINS, beacon, bld, glow, lerp, pool, prop, put } = H;
  const T = trees();

  const dims = s => { const f = H.frame(); return f?.w ? [Math.min(f.w - 2, 80), Math.min(f.d - 2, 80)] : [s, s]; };

  // Lot frame to world and back. Without a frame (showcase) local is world.

  const toWorld = (x, z) => {
    const f = H.frame();
    if (!f) return [x, z];
    const dx = x - f.cx, dz = z - f.cz;
    return [(f.tx ?? f.cx) + dx * f.c + dz * f.s, (f.tz ?? f.cz) - dx * f.s + dz * f.c];
  };
  const toLocal = (wx, wz) => {
    const f = H.frame();
    if (!f) return [wx, wz];
    const dx = wx - (f.tx ?? f.cx), dz = wz - (f.tz ?? f.cz);
    return [f.cx + dx * f.c - dz * f.s, f.cz + dx * f.s + dz * f.c];
  };
  const toLocalDir = (wx, wz) => { const f = H.frame(); return f ? [wx * f.c - wz * f.s, wx * f.s + wz * f.c] : [wx, wz]; };
  const mapWorld = ([u, v]) => [(u - 680) * 3.6, (v - 390) * 3.6];

  // Nearest coast point: distance and unit direction toward it (seaward from land).

  const coast = (wx, wz) => {
    let best = { d: Infinity, nx: 0, nz: 1 };
    for (const line of H.CITY.coast ?? []) for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1], ex = bx - ax, ez = bz - az;
      const t = Math.max(0, Math.min(1, ((wx - ax) * ex + (wz - az) * ez) / (ex * ex + ez * ez || 1)));
      const qx = ax + ex * t - wx, qz = az + ez * t - wz, dd = Math.hypot(qx, qz);
      if (dd < best.d) best = { d: dd, nx: qx / (dd || 1), nz: qz / (dd || 1) };
    }
    return best;
  };

  const tree = (kind, x, y, z, h, wd, r) => {
    const m = T?.[kind];
    if (!m) return;
    put(m, x, y, z, wd, h, wd, r() * 6.3, 0, dim(LEAVES[kind], 1.2 + r()));
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  };
  const lamp = (x, z, h) => {
    prop('cyl', x, h / 2, z, .14, h, .14, DARK);
    glow(x, h, z, .4, .3, .4, dim(WARM, .9));
  };

  // AI combine with a work light and a lit patch of crop ahead of it.

  const combine = (x, z, ry, r) => {
    const sx = Math.sin(ry), sz = Math.cos(ry);
    prop('box', x, 1.8, z, 3.4, 3, 6, [.26, .2, .05], ry);
    prop('box', x + sx * 3.6, .9, z + sz * 3.6, 7, .8, 1.4, [.2, .16, .05], ry);
    glow(x + sx * 2.8, 3.5, z + sz * 2.8, 1.6, .3, .3, [1.3, 1.25, 1]);
    pool(x + sx * 8, z + sz * 8, 12, [.09, .085, .07]);
    glow(x - sx * 2.2, 3.6, z - sz * 2.2, .3, .3, .3, [1.6, .7, .1]);
  };

  // Crop patchwork in strips along the longer side, with a track and an irrigation line.

  const field = (x, z, W, D, r, cheap = false) => {
    if (!cheap) prop('box', x, .08, z, W, .16, D, SOIL);
    const along = W >= D, L = along ? W : D, S = along ? D : W;
    const n = Math.max(1, Math.min(4, Math.floor(S / 9))), sw = (S - 2) / n;
    for (let k = 0; k < n; k++) {
      const o = -S / 2 + 1 + sw * (k + .5), c = pick(r, CROPS), h = .25 + r() * .7;
      const fx = along ? x : x + o, fz = along ? z + o : z;
      prop('box', fx, .16 + h / 2, fz, along ? L - 2 : sw - 1.2, h, along ? sw - 1.2 : L - 2, c);
      if (!cheap && r() < .5) for (let j = 1; j < 4; j++) {
        const t = -L / 2 + j * L / 4;
        prop('box', along ? x + t : fx, .17 + h, along ? fz : z + t, along ? .4 : sw - 1.3, .03, along ? sw - 1.3 : .4, dim(c, .6));
      }
    }
    glow(along ? x : x - S / 2 + 1, .2, along ? z - S / 2 + 1 : z, along ? L - 2 : .08, .03, along ? .08 : L - 2, [.03, .08, .08]);
    if (!cheap && r() < .12) combine(x + (r() - .5) * L * .4, z + (r() - .5) * S * .3, along ? Math.PI / 2 : 0, r);
  };

  // Low house with a hip roof, warm windows, a garden shrub.

  const house = (x, z, w, d, h, st, r) => {
    const p = pick(r, PAINT).map(c => c * (.8 + .4 * r()));
    bld(x, z, w, d, h, { ...st, base: p, win: [1, .74, .44] }, r, { lit: .35 + .3 * r(), roof: false, skin: SKINS.sparse });
    bld(x, z, w + .6, d + .6, 1.8, { ...st, base: TILE }, r, { y0: h, lit: 0, roof: false, shape: 'pyr' });
    tree('shrub', x + w / 2 + .8, .2, z + (r() - .5) * d, .8 + r() * .5, 1.4, r);
  };

  // Glass house: a soft glowing volume under dark ribs, a brighter ridge.

  const greenhouse = (x, z, w, d, h, tint, r) => {
    prop('box', x, .3, z, w + .4, .6, d + .4, [.06, .06, .06]);
    glow(x, .6 + h / 2, z, w, h, d, tint.map(c => c * (.8 + .4 * r())));
    glow(x, .6 + h + .2, z, w, .12, .25, tint.map(c => c * 3));
    for (let t = -w / 2; t <= w / 2 + .01; t += Math.max(4, w / 8)) prop('box', x + t, .6 + h / 2, z, .2, h + .5, d + .2, [.03, .03, .035]);
  };

  // Agroplex tower: pale panel body, magenta grow-light bands, a lit crown, floods and a fence at the base.

  const agroplex = (x, z, fp, h, st, r, hero = false) => {
    fp = Math.max(8, Math.min(fp, hero ? 48 : 24));
    const ps = { ...st, base: PANEL, win: [.9, .2, .75], grime: .15 };
    const cyl = !hero && r() < .4, shape = cyl ? 'cyl' : 'box';
    bld(x, z, fp * 1.5, fp * 1.5, 7, { ...ps, win: SEC }, r, { lit: .5, roof: false, skin: SKINS.bands });
    bld(x, z, fp, fp, h, ps, r, { y0: 7, lit: .3, roof: false, shape, skin: SKINS.fins });
    const gap = hero ? 14 : 11 + r() * 6;
    for (let y = 7 + gap; y < h; y += gap) {
      if (cyl) put(GLOWS.ring, x, y, z, fp * 1.04, 1, fp * 1.04, 0, 0, dim(MAG, .7));
      else for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        glow(x + sx * (fp / 2 + .15), y, z + sz * (fp / 2 + .15), sx ? .2 : fp, 1.1, sx ? fp : .2, dim(MAG, .55));
    }

    // Stepped sky-farm terraces on the hero tower.

    if (hero) for (let k = 1; k < 4; k++) {
      const y = 7 + h * k / 4, tw = fp * (1.1 - k * .12);
      prop('box', x, y, z, tw + 6, 1, tw + 6, [.18, .18, .19]);
      glow(x, y + 1.2, z + tw / 2 + 2.8, tw + 5, .9, .3, [.6, .12, .5]);
      for (let j = 0; j < 6; j++) tree('broad', x + (r() - .5) * (tw + 4), y + .5, z + (r() < .5 ? -1 : 1) * (tw / 2 + 2), 3 + r() * 2, 3, r);
    }
    const top = 7 + h;
    glow(x, top + 1.5, z, fp * .8, 3, fp * .8, dim(MAG, cyl ? .7 : .5));
    prop(cyl ? 'cyl' : 'box', x, top + .5, z, fp * 1.05, 1, fp * 1.05, [.2, .2, .21]);
    prop('box', x, top + 7, z, .6, 10, .6, DARK);
    beacon(x, top + 12.4, z, r);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      glow(x + sx * fp * .8, 7.6, z + sz * fp * .8, 1, .4, 1, SEC);
      pool(x + sx * fp * 1.1, z + sz * fp * 1.1, 18, [.07, .09, .1]);
    }
  };

  return { dims, toWorld, toLocal, toLocalDir, mapWorld, coast, tree, lamp, combine, field, house, greenhouse, agroplex };
}
