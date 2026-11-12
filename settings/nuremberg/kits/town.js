// Nuremberg's house kits: burgher houses of sandstone, plaster and timber frame under steep tile roofs, and gardens.
// Kit signature: (x, z, s, st, b, r) in the lot frame. The yards and the cottages come from Emberford.

import { kits as emberKits, parts } from '../../emberford/kits/town.js';
import { SUBURBS } from '../setting.js';

import { HALF_PI, SLATE, COPPER, GOLD, WOOD, STONES, PLASTERS, ROOF_TONES, FRAME_FILL, trees } from './common.js';

const DARK = [.05, .045, .04], IRON = [.08, .08, .08];
const DOORS = [[.16, .1, .05], [.2, .12, .06], [.12, .14, .1], [.24, .08, .05]];
const PAINT = [[.3, .1, .07], [.18, .2, .16], [.35, .3, .2]];
const SIGNS = [GOLD, [.32, .1, .07], [.12, .18, .12], [.15, .17, .24]];
const AWNINGS = [[.34, .12, .08], [.42, .32, .14], [.14, .2, .12], [.2, .22, .26], [.4, .38, .32]];
const CHIMNEYS = [[.3, .15, .1], [.26, .2, .16], [.2, .12, .09]];
const tone = (c, k) => c.map(v => v * k);

// bld() draws its brightness from the first random number. A steady generator gives every part of one wall the
// same brightness, so a house reads as one material.

const steady = (r, k) => { let first = true; return () => first ? (first = false, k) : r(); };

// The town house builder, shared with other packs. A kit passes stones, plasters, fills or roofs to swap the
// palettes, and pitch to scale the roof's height.

export function houses(H) {
  const { bld, prop, glow, SKINS } = H;
  const { strip, pick, yard } = parts(H);
  const { tree } = trees(H);
  const opt = o => ({ roof: false, kibble: false, ...o });
  const wall = (kind, pal) => ({
    ashlar: [SKINS.ashlar, pal.stone], stone: [SKINS.stone, pal.stone], rubble: [SKINS.rubble, pal.stone],
    plaster: [SKINS.plaster, pal.plaster], quoins: [SKINS.quoins, pal.plaster],
    timber: [SKINS.timber, pal.fill], braced: [SKINS.braced, pal.fill], redframe: [SKINS.redframe, pal.fill],
  })[kind];

  // A town house in the lot's own axes: u runs along the street, v out toward it from the house's centre. The kit's
  // options pick the floors, the wall materials, the roof (eaves to the street, gable to the street, a stepped
  // gable or a hip), the dormers, the oriel, the shop front, the sign and what lies behind.

  function townhouse(x, z, s, st, r, o) {
    const p = strip(x, z, s, o.depth[0] + r() * (o.depth[1] - o.depth[0]));
    const w = p.frontage, d = p.deep, fr = p.fr, face = Math.atan2(fr.x, fr.z), ry = p.ry;
    const ax = { x: Math.abs(fr.z), z: Math.abs(fr.x) };
    const at = (u, v) => [p.cx + ax.x * u + fr.x * v, p.cz + ax.z * u + fr.z * v];
    const block = (u, v, y0, bw, bd, h, [skin, base], more = {}, rr = r) => bld(...at(u, v), bw, bd, h, st, rr, opt({ y0, skin, base, ry, ...more }));
    const fbox = (u, v, y, sx, sy, sz, rgb, tilt = 0) => { const [px, pz] = at(u, v); prop('box', px, y, pz, sx, sy, sz, rgb, face, tilt); };
    const pane = (u, v, y, sx, sy, rgb) => { const [px, pz] = at(u, v); glow(px, y, pz, sx, sy, .04, rgb, face); };

    // The palette: one stone, one plaster, one infill and one roof per house.

    const pal = { stone: pick(r, o.stones ?? STONES), plaster: pick(r, o.plasters ?? PLASTERS), fill: pick(r, o.fills ?? FRAME_FILL) };
    const roofM = r() < (o.slate ?? .05) ? [SKINS.slate, SLATE] : [SKINS.tiles, pick(r, o.roofs ?? ROOF_TONES)];
    const ridge = tone(roofM[1], .7);

    // The ground floor, then the upper floors. A timber house juts each floor out over the one below.

    const gf = o.gf ?? 3.8 + r() * .7, n = o.floors, fh = o.fh ?? 3 + r() * .3;
    const ground = wall(pick(r, o.ground), pal), upKind = pick(r, o.upper), up = wall(upKind, pal);
    const k = r(), upR = () => steady(r, k);
    block(0, 0, 0, w, d, gf, ground, { lit: st.lit * 1.3 });
    const jet = o.jetty && /timber|braced|redframe/.test(upKind) ? .3 + r() * .2 : 0;
    if (jet) for (let i = 1; i <= n; i++) block(0, i * jet / 2, gf + (i - 1) * fh, w, d + i * jet, fh, up, {}, upR());
    else block(0, 0, gf, w, d, n * fh, up, {}, upR());
    const top = gf + n * fh, dr = d + n * jet, v0 = n * jet / 2, vf = v0 + dr / 2, vf1 = d / 2 + jet;

    // A wall gable sits just inside a roof gable whose end faces the street, so the end shows the wall.

    const endWall = (u, v, y0, len, wid, h, roofW, mat, rr) => {
      block(u, v, y0, len, wid, h * wid / roofW, mat, { shape: 'gable', ry: ry + HALF_PI, lit: st.lit * .5 }, rr);
      block(u, v, y0, len + .5, roofW, h, roofM, { shape: 'gable', ry: ry + HALF_PI, lit: 0 });
    };
    const hoist = (u, y) => fbox(u, vf + .55, y, .22, .22, 1.2, WOOD);

    // A house wider than 10.5 m turns its eaves to the street, and no roof rises more than 10 to 11.5 m, so a big
    // plot gets a flatter roof instead of a towering one.

    const picked = pick(r, o.roof), kind = w > 10.5 && picked !== 'hip' ? 'eaves' : picked;
    let rh;
    if (kind === 'eaves' || kind === 'hip') {
      const W = w + .3, D = dr + .9;
      rh = Math.min(kind === 'hip' ? Math.min(W, D) * (.6 + r() * .2) : D * (.68 + r() * .14), 10 + r() * 1.5) * (o.pitch ?? 1);
      if (kind === 'hip' && W <= D + .5) block(0, v0, top, W, D, rh, roofM, { shape: 'pyr', lit: 0 });
      else if (kind === 'hip') {
        block(0, v0, top, W - D, D, rh, roofM, { shape: 'gable', lit: 0 });

        // The hip ends sit 3 % lower than the gable between them, so their front and back faces stay under its slopes.

        for (const sg of [-1, 1]) block(sg * (W - D) / 2, v0, top, D, D, rh * .97, roofM, { shape: 'pyr', lit: 0 });
        fbox(0, v0, top + rh - .05, W - D, .2, .3, ridge);
      } else {
        block(0, v0, top, W, D, rh, roofM, { shape: 'gable', lit: 0 });
        fbox(0, v0, top + rh - .05, W, .2, .3, ridge);
      }

      // The street slope: a Zwerchhaus as wide as a bay, a brewer's tall hoist dormer, or rows of small dormers.
      // Each dormer's front stands on the slope, so higher rows sit further back. y(v) = top + rh (1 - 2 |v - v0| / D).

      const front = kind === 'eaves' ? pick(r, o.front ?? ['dormers']) : 'none';
      let zw = 0;
      if (front === 'zwerch' || front === 'hoist') {
        zw = front === 'hoist' ? 2.4 + r() * .4 : Math.max(3, Math.min(w * .6, 6));
        const zh = fh * (front === 'hoist' ? 1.6 : 1.1 + r() * .3);
        const zd = D * (front === 'hoist' ? .45 : .35), mat = front === 'hoist' ? wall(pick(r, ['plaster', 'timber']), pal) : up;
        block(0, vf - zd / 2, top - .1, zw, zd, zh + .1, mat, { lit: st.lit * .6 }, front === 'hoist' ? r : upR());
        endWall(0, vf - zd / 2, top + zh, zd, zw, zw * .8, zw + .4, mat, front === 'hoist' ? r : upR());
        hoist(0, top + zh + zw * .45);
        if (front === 'hoist') fbox(0, vf + .03, top + zh * .45, 1.4, zh * .6, .08, pick(r, DOORS));
      }
      // Beside a Zwerchhaus or hoist dormer, the higher rows keep to its sides, where there is room.

      const rows = kind === 'eaves' ? o.rows ?? 1 : 0, c0 = Math.max(1, Math.round(w / 4.5));
      for (let row = front === 'dormers' ? 0 : 1; row < rows && (row === 0 || rh > 6.5); row++) {
        const f = [.1, .42, .68][row], dw = 1.8 - .3 * row, dh = 1.9 - .45 * row, dd = 2.4 - .4 * row;
        const vd = v0 + D / 2 * (1 - f), y0 = top + rh * f - .3, cn = Math.max(1, c0 - row);
        const us = zw ? [-1, 1].map(sg => sg * (zw / 2 + dw / 2 + .3)).filter(u => Math.abs(u) < w / 2 - dw / 2)
          : Array.from({ length: cn }, (_, i) => (i + .5 - cn / 2) * w / cn);
        for (const u of us) {
          block(u, vd - dd / 2, y0, dw, dd, dh + .3, roofM, { lit: 0 });
          block(u, vd - dd / 2, y0 + dh + .3, dd + .2, dw + .35, dw * .6, roofM, { shape: 'gable', ry: ry + HALF_PI, lit: 0 });
          fbox(u, vd + .02, y0 + .3 + dh * .5, dw * .55, dh * .5, .05, DARK);
        }
      }
    } else {
      const Wd = kind === 'stepped' ? w : w + .3;
      rh = w * (.95 + r() * .25) * (o.pitch ?? 1);
      if (kind === 'stepped') {

        // A stepped gable of stone stands in front of the roof's end and hides it.

        const steps = 4 + Math.floor(r() * 3), hs = rh / steps, sm = [SKINS.ashlar, pal.stone];
        block(0, v0 - .25, top, dr - .5, Wd, rh, roofM, { shape: 'gable', ry: ry + HALF_PI, lit: 0 });
        for (let i = 0; i < steps; i++) block(0, vf - .3, top + i * hs, w * (steps - i) / steps + .1, .6, hs, sm, { lit: st.lit * .3 }, upR());
        fbox(0, vf - .3, top + rh + .35, .45, .7, .45, tone(pal.stone, 1.1));
        fbox(0, v0 - .25, top + rh - .05, .3, .2, dr - .5, ridge);
      } else {
        endWall(0, v0, top, dr, w, rh, Wd, up, upR());
        hoist(0, top + rh * .62);
        fbox(0, v0, top + rh - .05, .3, .2, dr + .4, ridge);
      }
    }

    // Chimneys rise just behind the ridge, or beside it on a roof that turns its gable to the street.

    for (let c = (r() < .75) + (r() < .3); c > 0; c--) {
      const ch = rh * .4 + 1.3, rgb = pick(r, CHIMNEYS);
      const [u, v] = kind === 'eaves' || kind === 'hip' ? [(r() - .5) * w * .6, v0 - .6] : [(r() < .5 ? -.6 : .6), v0 + (r() - .5) * dr * .6];
      fbox(u, v, top + rh * .6 + ch / 2, .7, ch, .7, rgb);
    }

    // A Chörlein on the first floor: a box or a polygon of stone or painted timber, on a corbel, under a little spire.

    if (r() < (o.oriel ?? 0) && n > 1) {
      const ou = (r() - .5) * Math.max(0, w - 3.5), ow = 1.6 + r() * .4, oh = fh * (1.2 + r() * .5), oy = gf + .5;
      const rgb = r() < .5 ? tone(pal.stone, 1.05) : pick(r, PAINT), cap = r() < .1 ? COPPER : r() < .3 ? SLATE : roofM[1];
      const poly = r() < .5, ov = vf1 + (poly ? .15 : .5), [px, pz] = at(ou, ov), turn = face + Math.PI / 8;
      fbox(ou, vf1 + .35, oy - .3, ow * .6, .6, .7, tone(pal.stone, .9));
      if (poly) {
        prop('cyl', px, oy + oh / 2, pz, ow, oh, ow, rgb, turn);
        prop('cone', px, oy + oh + .6, pz, ow * 1.05, 1.2, ow * 1.05, cap, turn);
        pane(ou, ov + ow * .462 + .02, oy + oh * .55, ow * .35, oh * .4, [1, .66, .3]);
      } else {
        fbox(ou, ov, oy + oh / 2, ow, oh, 1, rgb);
        bld(px, pz, ow + .2, 1.2, 1.1, st, r, opt({ y0: oy + oh, shape: 'pyr', skin: roofM[0], base: cap, lit: 0, ry }));
        pane(ou, ov + .52, oy + oh * .55, ow * .6, oh * .4, [1, .66, .3]);
      }
    }

    // The street front: arched shop openings with counters and awnings, or a door, and sometimes a house sign.

    if (o.shop) {
      const m = w > 9.5 ? 3 : 2, awn = pick(r, AWNINGS);
      for (let i = 0; i < m; i++) {
        const u = (i + .5 - m / 2) * w / m, [px, pz] = at(u, d / 2 + .04);
        fbox(u, d / 2 + .04, 1.25, 1.7, 2.5, .08, DARK);
        prop('cyl', px, 2.5, pz, 1.7, .08, 1.7, DARK, face, HALF_PI);
        if (r() < .35) pane(u, d / 2 + .1, 1.4, 1.4, 2, [.7, .42, .18]);
        fbox(u, d / 2 + .35, .85, 1.6, .08, .6, WOOD);
        if (r() < .7) fbox(u, d / 2 + .7, 3.45, 1.9, .05, 1.4, awn, .35);
      }
    } else {
      const du = (r() - .5) * Math.max(0, w - 2.5);
      if (r() < .4) pane(du, d / 2 + .05, 1.2, 1.1, 2, [1, .6, .25]);
      else fbox(du, d / 2 + .04, 1.15, 1.2, 2.3, .08, pick(r, DOORS));
    }
    if (r() < (o.sign ?? .2)) {
      const su = (r() < .5 ? -1 : 1) * (w / 2 - .5);
      fbox(su, d / 2 + .6, gf - .3, .08, .08, 1.2, IRON);
      fbox(su, d / 2 + .85, gf - .95, .06, .9, .8, pick(r, SIGNS));
    }

    // Behind: a back house across a small court, or the yard. Either may hold a tree.

    const behind = 2 * p.back + .5;
    if (p.back > 4.5 && r() < (o.back ?? .3)) {
      const hd = Math.min(behind - 5.5, 9), hh = 3.1 * (1 + (r() < .5)), vb = -d / 2 - behind + hd / 2 + .2;
      block(0, vb, 0, w, hd, hh, wall(pick(r, ['plaster', 'timber', 'rubble', upKind]), pal), { lit: st.lit * .7 });
      block(0, vb, hh, w + .4, hd + .6, Math.min(w, hd) * .8, roofM, { shape: 'gable', lit: 0 });
      const court = behind - hd - .2;
      if (r() < (o.tree ?? .3)) tree(...at((r() - .5) * Math.max(0, w - 4), -d / 2 - court / 2), r, court > 8 ? undefined : 'fruit');
    } else {
      yard(p, x, z, s, st, r);
      if (p.back > 3 && r() < (o.tree ?? .3)) tree(...at((r() - .5) * Math.max(0, w - 3), -d / 2 - p.back - .25), r);
    }
  }

  return { townhouse, tree, opt, pick };
}

export function kits(H) {
  const { bld, prop, SKINS } = H;
  const { townhouse, tree, opt, pick } = houses(H);
  const T = ['timber', 'braced', 'redframe'];
  return {
    ...emberKits(H),

    // A patrician house: three or four upper floors of ashlar or quoined plaster, rows of dormers or a Zwerchhaus,
    // often an oriel, and a back house across a court.

    nb_patrician(x, z, s, st, b, r) {
      townhouse(x, z, s, st, r, { depth: [11, 15], floors: 3 + (r() < .4), ground: ['ashlar', 'ashlar', 'stone'],
        upper: ['ashlar', 'ashlar', 'quoins', 'quoins', 'plaster', 'redframe'], roof: ['eaves', 'eaves', 'eaves', 'gable', 'stepped', 'hip'],
        front: ['dormers', 'zwerch'], rows: 2 + (r() < .4), oriel: .55, sign: .25, back: .7, tree: .35, slate: .1 });
    },

    // A narrow stone house that turns its gable to the street, often stepped.

    nb_gablestone(x, z, s, st, b, r) {
      townhouse(x, z, s, st, r, { depth: [10, 13], floors: 2 + (r() < .5), ground: ['ashlar', 'stone'], upper: ['ashlar', 'stone', 'quoins'],
        roof: ['stepped', 'gable'], oriel: .3, back: .4, tree: .25 });
    },

    // A craftsman's house: two or three jettied floors of timber frame, or plaster.

    nb_timber(x, z, s, st, b, r) {
      townhouse(x, z, s, st, r, { depth: [9, 12], floors: 2 + (r() < .35), gf: 3.4 + r() * .5, ground: ['stone', 'rubble', 'ashlar'],
        upper: [...T, 'braced', 'plaster'], jetty: true, roof: ['eaves', 'gable'], front: ['dormers', 'dormers', 'zwerch'],
        rows: 1 + (r() < .3), oriel: .1, sign: .2, tree: .3 });
    },

    // A brewer's house: wide under one roof, with a tall hoist dormer for the malt loft and a deep yard behind.

    nb_brewer(x, z, s, st, b, r) {
      townhouse(x, z, s, st, r, { depth: [12, 15], floors: 2, ground: ['ashlar', 'stone'], upper: ['plaster', 'quoins', 'timber', 'ashlar'],
        roof: ['eaves'], front: ['hoist'], rows: 2 + (r() < .4), sign: .5, back: .8, tree: .2 });
    },

    // A market house with arched shop openings, counters and awnings on the ground floor.

    nb_shop(x, z, s, st, b, r) {
      townhouse(x, z, s, st, r, { depth: [10, 13], floors: 2 + (r() < .5), shop: true, ground: ['ashlar', 'stone'],
        upper: ['plaster', 'plaster', 'quoins', ...T], roof: ['eaves', 'eaves', 'gable', 'gable', 'stepped'],
        front: ['dormers', 'zwerch', 'zwerch'], rows: 1 + (r() < .4), oriel: .25, sign: .7, tree: .15 });
    },

    // A small house in the back lanes: one or two low floors.

    nb_small(x, z, s, st, b, r) {
      townhouse(x, z, s, st, r, { depth: [7, 9], floors: 1 + (r() < .5), gf: 3 + r() * .4, fh: 2.8, ground: ['rubble', 'stone', 'plaster'],
        upper: ['timber', 'braced', 'plaster', 'plaster'], jetty: r() < .5, roof: ['eaves', 'eaves', 'gable'], rows: r() < .4 ? 1 : 0,
        tree: .45 });
    },

    // A stone tower house of the old families: tall and narrow under a hip or pyramid roof.

    nb_tower(x, z, s, st, b, r) {
      townhouse(x, z, s, st, r, { depth: [9, 11], floors: 4 + (r() < .4), fh: 3.2, ground: ['rubble', 'ashlar'], upper: ['rubble', 'ashlar'],
        roof: ['hip'], oriel: .4, back: .3, tree: .3, slate: .3 });
    },

    // A garden: fruit and shade trees, a wall or fence on the street, sometimes beds and a garden house.

    nb_garden(x, z, s, st, b, r) {
      const f = H.frame(), w = f?.w ?? s, d = f?.d ?? s, fr = f?.front ?? { x: 0, z: 1 }, ry = fr.x ? HALF_PI : 0;
      prop('box', x, .05, z, w - 1, .1, d - 1, [.05, .09, .04]);
      for (let k = 1 + Math.floor(r() * 3) + (w * d > 250); k > 0; k--) tree(x + (r() - .5) * (w - 4), z + (r() - .5) * (d - 4), r, r() < .5 ? 'fruit' : undefined);
      const [fh, ft, fc] = st.w < .25 ? [1.8, .5, tone(pick(r, STONES), .9)] : [1.2, .1, WOOD];
      prop('box', x + fr.x * (w / 2 - .6), fh / 2, z + fr.z * (d / 2 - .6), fr.x ? ft : w - 1, fh, fr.x ? d - 1 : ft, fc);
      const garden = r();
      if (garden < .4) for (let k = 0; k < 3; k++) {
        const v = -(fr.z ? d : w) / 2 + 2 + k * 1.4, L = (fr.z ? w : d) - 3;
        prop('box', x + fr.x * v, .12, z + fr.z * v, fr.x ? .9 : L, .25, fr.x ? L : .9, [.12, .08, .05]);
        prop('box', x + fr.x * v, .32, z + fr.z * v, fr.x ? .5 : L - .3, .18, fr.x ? L - .3 : .5, [.14, .22, .07]);
      }
      else if (garden < .65) {
        const v = 3 - (fr.z ? d : w) / 2, gx = x + fr.x * v, gz = z + fr.z * v;
        bld(gx, gz, 3, 3, 2.6, st, r, opt({ skin: pick(r, [SKINS.timber, SKINS.plaster]), base: pick(r, FRAME_FILL), lit: st.lit * .3, ry }));
        bld(gx, gz, 3.6, 3.6, 2, st, r, opt({ y0: 2.6, shape: 'pyr', skin: SKINS.tiles, base: pick(r, ROOF_TONES), lit: 0, ry }));
      }
    },
  };
}

// Every lot is narrow, so tier 0 decides each ward's mix. The higher tiers repeat it.

const SEBALD = ['nb_patrician', 'nb_patrician', 'nb_shop', 'nb_shop', 'nb_gablestone', 'nb_timber', 'nb_timber', 'nb_brewer', 'nb_small', 'nb_tower'];
const SUBURB = ['ef_cottage', 'ef_cottage', 'ef_workshop', 'nb_small', 'nb_garden', 'nb_garden'];

// Three quarters show other building traditions: Hanseatic brick in Lorenz, a Venetian merchant colony in Lorenz Ost and
// Alpine timber under the castle. Their kits live in kits/hanse.js, kits/venice.js and kits/alpine.js.

const HANSE = ['hs_gable', 'hs_gable', 'hs_merchant', 'hs_twin', 'hs_glazed', 'hs_small', 'hs_small', 'hs_warehouse'];
const VENICE = ['ve_casa', 've_casa', 've_palazzo', 've_arcade', 've_court', 've_small', 've_small', 've_campanile'];
const ALPINE = ['al_chalet', 'al_chalet', 'al_painted', 'al_inn', 'al_barn', 'al_small', 'al_small', 'al_shingle'];
const VILLAGE = ['ef_cottage', 'ef_cottage', 'nb_small', 'nb_small', 'nb_timber', 'ef_workshop', 'nb_garden'];
const all = list => ({ 0: list, 1: list, 2: list });
export const tiers = {
  burg: all(ALPINE), sebald: all(SEBALD), lorenz: all(HANSE), 'lorenz-ost': all(VENICE),
  ...Object.fromEntries(SUBURBS.map(id => [id, all(SUBURB)])),
  rebenhain: all(VILLAGE),
};
