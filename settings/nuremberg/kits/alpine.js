// Alpine house kits for the Burgviertel under the Kaiserburg, after Tyrol, Upper Bavaria and the Black Forest. A house
// has a whitewashed or stone ground floor, upper storeys of dark weathered timber, and a wide low roof that turns its
// gable to the street over deep eaves. Carved balconies with red flowers run across the gable front. Kit signature:
// (x, z, s, st, b, r) in the lot frame.

import { parts } from '../../emberford/kits/town.js';
import { RELIEF, groundAt } from '../../../engine/relief.js';

import { HALF_PI, GOLD, WOOD, trees } from './common.js';

const WHITE = [[.56, .54, .5], [.55, .52, .46], [.52, .5, .47], [.54, .49, .4], [.5, .47, .44]];
const STONE = [[.34, .32, .28], [.3, .28, .25], [.36, .31, .25]];
const LOG = [[.04, .024, .015], [.05, .03, .017], [.035, .025, .018], [.055, .034, .02], [.045, .034, .025]];
const SHINGLE = [[.06, .05, .04], [.055, .04, .028], [.07, .06, .05]];
const SHINGLES = [[.045, .042, .04], [.042, .033, .027], [.055, .052, .05], [.036, .03, .027]];
const TILES = [[.26, .1, .055], [.21, .09, .05], [.27, .13, .08]];
const SHUTTERS = [[.1, .24, .13], [.08, .19, .11], [.13, .28, .17], [.1, .24, .13], [.26, .15, .08]];
const FRAMES = [[.52, .4, .18], [.4, .4, .38], [.44, .17, .1], [.26, .31, .4], [.5, .44, .3]];
const BLOOM = [[.62, .07, .05], [.66, .12, .1], [.58, .05, .08], [.7, .16, .08]];
const SIGNS = [GOLD, [.12, .2, .12], [.32, .1, .07], [.6, .52, .3]];
const DOORS = [[.18, .11, .05], [.22, .13, .06], [.12, .16, .1], [.26, .15, .07]];
const CARVE = [.34, .23, .12], LOGEND = [.4, .29, .16], TRIM = [.56, .54, .5], ROCK = [.3, .3, .28];
const GLASS = [.04, .045, .05], LAMP = [1, .66, .3], IRON = [.08, .08, .08], SKY = [.2, .32, .52], CHIM = [.36, .34, .3];
const tone = (c, k) => c.map(v => v * k);

// bld() draws its brightness from the first random number. A steady generator gives a body and its front plate the
// same brightness, so the wall reads as one.

const steady = (r, k) => { let first = true; return () => first ? (first = false, k) : r(); };

export function kits(H) {
  const { bld, prop, glow, SKINS } = H;
  const { strip, pick, yard } = parts(H);
  const { tree } = trees(H);
  const opt = o => ({ roof: false, kibble: false, ...o });

  // Each wall material has a body skin with windows for the sides and back, and a blind skin for the street front,
  // where the kit sets its own windows, shutters and paint.

  const MATS = {
    white: [SKINS.plaster, SKINS.tile, WHITE], stone: [SKINS.rubble, SKINS.blindRubble, STONE],
    log: [SKINS.ashlar, SKINS.blindAshlar, LOG], shingle: [SKINS.slate, SKINS.slate, SHINGLE],
  };

  // An Alpine house in the lot's own axes: u runs along the street, v out toward it from the house's centre. The
  // options pick the floors, the materials, the roof, the balconies, the paint and what stands in front and behind.

  function chalet(x, z, s, st, r, o) {
    const p = strip(x, z, s, o.depth[0] + r() * (o.depth[1] - o.depth[0]));

    // A wide lot holds two or three houses side by side, each with its own draws, and one yard behind them.

    if (!o.part && p.frontage > 15) {
      const m = Math.ceil(p.frontage / 12), pw = p.frontage / m;
      for (let i = 0; i < m; i++) chalet(x, z, s, st, r, { ...o, part: { u0: (i + .5 - m / 2) * pw, w: pw - .4, yard: i === 0 } });
      return;
    }
    const u0 = o.part?.u0 ?? 0, w = o.part?.w ?? p.frontage, d = p.deep, fr = p.fr, face = Math.atan2(fr.x, fr.z), ry = p.ry;
    const ax = { x: Math.abs(fr.z), z: Math.abs(fr.x) };
    const at = (u, v) => [p.cx + ax.x * (u + u0) + fr.x * v, p.cz + ax.z * (u + u0) + fr.z * v];

    // Every part stands at the level of the house's own platform, so balconies, signs and eaves over the street keep
    // to the house instead of dropping to the street below.

    const base = RELIEF ? groundAt(...H.worldOf(...at(0, 0))) : 0;
    const lift = (px, pz) => RELIEF ? base - groundAt(...H.worldOf(px, pz)) : 0;
    const block = (u, v, y0, bw, bd, h, skin, rgb, more = {}, rr = r) => {
      const [px, pz] = at(u, v);
      bld(px, pz, bw, bd, h, st, rr, opt({ y0: y0 + lift(px, pz), skin, base: rgb, ry, ...more }));
    };
    const fbox = (u, v, y, sx, sy, sz, rgb) => { const [px, pz] = at(u, v); prop('box', px, y + lift(px, pz), pz, sx, sy, sz, rgb, face); };
    const pane = (u, v, y, sx, sy) => { const [px, pz] = at(u, v); glow(px, y + lift(px, pz), pz, sx, sy, .04, LAMP, face); };
    const litP = st.lit * (o.litK ?? 1.4);

    // The walls: a stone plinth, the ground floor and the upper floors, each a body with a blind plate on its front.

    const gf = o.gf ?? 3 + r() * .4, n = o.floors, fh = o.fh ?? 2.75 + r() * .2, top = gf + n * fh;
    const gK = pick(r, o.ground), uK = pick(r, o.upper), [gSkin, gBlind, gPal] = MATS[gK], [uSkin, uBlind, uPal] = MATS[uK];
    const gC = pick(r, gPal), uC = gK === uK ? gC : pick(r, uPal);
    const vf = d / 2 + .08;
    const wall = (y0, h, skin, blind, rgb, lit) => {
      const k = r();
      block(0, 0, y0, w, d, h, skin, rgb, { lit }, steady(r, k));
      if (blind !== skin) block(0, d / 2 + .03, y0, w - .04, .1, h, blind, rgb, { lit: 0 }, steady(r, k));
    };
    if (gK !== 'stone') fbox(0, 0, .3, w + .06, .6, d + .06, tone(pick(r, STONE), .8));
    wall(0, gf, gSkin, gBlind, gC, st.lit * 1.2);
    if (n) wall(gf, n * fh, uSkin, uBlind, uC, st.lit);

    // The wide low roof: 20 to 25 degrees, deep eaves at the sides and further out over the gable front. Houses in a
    // row keep short side eaves, so their roofs meet without overlapping. A house
    // wider than 12.5 m turns its eaves to the street instead, with its balconies under them. The wall's gable stands
    // just proud of the roof's end, so the end shows timber framed by a thin band of roof. P(t, c) places a point t
    // along the ridge and c across it.

    const eaves = w > 12.5, os = o.side ?? (o.part ? .18 : .8 + r() * .4), of = o.front ?? 1.2 + r() * .5, ob = .5;
    const span = eaves ? d : w, run = eaves ? w : d, oa = eaves ? of * .9 : os, [l1, l2] = eaves ? [os, os] : [ob, of];
    const W = span + 2 * oa, rh = W / 2 * (o.pitch ?? .36 + r() * .1), L = run + l1 + l2, cl = (l2 - l1) / 2, F = run / 2 + l2;
    const P = (t, c) => eaves ? [t, c] : [c, t], rry = eaves ? ry : ry + HALF_PI;
    const tiled = r() < (o.tile ?? .25), roofC = pick(r, tiled ? TILES : SHINGLES), roofS = tiled ? SKINS.tiles : SKINS.tile;
    const hw = rh * span / W, gableK = uK === 'stone' ? 'log' : uK;
    block(...P(cl, 0), top, L, W, rh, roofS, roofC, { shape: 'gable', ry: rry, lit: 0 });
    block(...P(cl, 0), top, L + .1, span, hw, MATS[gableK][1], pick(r, MATS[gableK][2]), { shape: 'gable', ry: rry, lit: 0 });
    fbox(...P(cl, 0), top + rh - .02, ...(eaves ? [L + .1, .14, .3] : [.3, .14, L + .1]), tone(roofC, .7));
    const gv = F + .1, gy = top + hw * .32;

    // A half-hip clips each gable's top. It is 4 % narrower than the roof there, so its sides stay under the roof's
    // planes and only its end shows, leaning out over the gable.

    if (r() < (o.hip ?? .3)) {
      const k = .35 + r() * .1, hd = .7 + r() * .3;
      for (const t of eaves ? [-F, F] : [F]) block(...P(t, 0), top + rh * (1 - k), ...(eaves ? [2 * hd, W * k * .96] : [W * k * .96, 2 * hd]), rh * k, roofS, roofC, { shape: 'pyr', lit: 0 });
    }

    // Stones and weighting poles hold down a shingle roof.

    if (!tiled && r() < (o.stones ?? .2)) for (const sg of [-1, 1]) {
      const c = sg * W / 4, y = top + rh / 2 + .1;
      fbox(...P(cl, c), y, ...(eaves ? [L * .9, .14, .14] : [.14, .14, L * .9]), tone(WOOD, 1.4));
      for (const t of [-1, 0, 1]) fbox(...P(cl + t * L / 3, c + sg * .1), y + .12, .55, .28, .55, tone(ROCK, .85 + .3 * r()));
    }
    if (r() < (o.chimney ?? .8)) {
      const ch = 1.6;
      fbox(...P(cl + (r() - .3) * L * .5, (r() < .5 ? -1 : 1) * .7), top + rh * (1 - 1.4 / W) + ch / 2 - .3, .7, ch, .7, CHIM);
    }

    // Windows on the street front. Each has green shutters, a painted frame or a plain trim, and sometimes a box of
    // flowers. Some are lit.

    const k = Math.max(2, Math.min(5, Math.round(w / 2.6))), us = Array.from({ length: k }, (_, i) => (i + .5 - k / 2) * w / k);
    const shut = pick(r, SHUTTERS), frame = pick(r, FRAMES);
    const win = (u, y, ww, wh, look, v = vf) => {
      if (look === 'paint') fbox(u, v + .02, y + .18, ww + .5, wh + .8, .03, frame);
      if (look === 'shut' || (look === 'paint' && o.shut)) fbox(u, v + .04, y, ww * 2.15, wh, .04, shut);
      else if (look === 'trim') fbox(u, v + .03, y, ww + .22, wh + .22, .03, uK === 'log' ? CARVE : TRIM);
      if (r() < litP) pane(u, v + .08, y, ww, wh);
      else fbox(u, v + .07, y, ww, wh, .04, GLASS);
      if (r() < (o.flowers ?? .4)) fbox(u, v + .18, y - wh / 2 - .12, ww + .3, .24, .3, pick(r, BLOOM));
    };
    const gLook = o.paint ? 'paint' : gK === 'white' ? 'shut' : 'trim';
    const uLook = o.paint ? 'paint' : uK === 'white' || uK === 'shingle' || r() < .5 ? 'shut' : 'trim';

    // The ground floor: a door, the windows, and sometimes a woodpile at one end under the windows.

    const di = k % 2 ? (k - 1) / 2 : Math.floor(r() * k), du = us[di];
    if (o.paint || o.inn) fbox(du, vf + .02, 1.3, 1.9, 2.9, .03, o.paint ? frame : tone(pick(r, STONE), 1.2));
    if (r() < (o.inn ? .8 : .35)) pane(du, vf + .06, 1.15, 1.2, 2.3);
    else fbox(du, vf + .05, 1.15, 1.2, 2.3, .08, pick(r, DOORS));
    us.forEach((u, i) => i !== di && win(u, gf * .6, .85, 1.05, gLook));
    if (r() < (o.wood ?? .5)) {
      const sg = di < k / 2 ? 1 : -1, len = 1.4 + r() * .8;
      fbox(sg * (w / 2 - len / 2 - .15), vf + .3, .7, len, 1.3, .55, LOGEND);
    }

    // The upper floors. A balcony runs across the gable front at each of the top floors it is given: a plank floor,
    // a carved board railing and a row of red flowers along its top.

    const balc = (y, len, v = vf) => {
      fbox(0, v + .5, y - .08, len + .2, .14, 1.05, WOOD);
      fbox(0, v + 1, y + .5, len + .2, 1, .07, CARVE);
      fbox(0, v + 1.02, y + 1.02, len + .3, .08, .14, tone(WOOD, .8));
      for (const sg of [-1, 1]) fbox(sg * (len / 2 + .05), v + .5, y + .5, .07, 1, 1, CARVE);
      fbox(0, v + 1.08, y + 1.2, len - .1, .28, .26, pick(r, BLOOM));
    };
    const picFloor = o.picture && n > 1 ? n - 1 : -1;
    for (let i = 0; i < n; i++) {
      const fy = gf + i * fh, hasB = i >= n - (o.balconies ?? 0);
      if (hasB) balc(fy, w);
      us.forEach((u, j) => {
        if (i === picFloor && k % 2 && j === (k - 1) / 2) return;
        if (o.oriel && i < 2 && Math.abs(u - o.orielU(w)) < 1.4) return;
        win(u, fy + fh * (hasB ? .6 : .55), .85, 1.15, uLook);
      });
    }

    // The gable on the street: one or two small windows or a hay door, and sometimes a balcony under the eaves. A
    // house with its eaves to the street has its hay door in the front wall.

    if (eaves && o.hayDoor) fbox(0, vf + .03, gf + fh * .5, 2.6, 2.4, .06, tone(WOOD, .7));
    else if (!eaves) {
      if (o.gableBalc && r() < o.gableBalc) balc(top + .1, w * .5, gv - .08);
      if (o.hayDoor) fbox(0, gv, top + .9, 1.6, 1.5, .06, tone(WOOD, .7));
      else if (hw > 1.6) (w > 8 && !o.sundial ? [-.9, .9] : [0]).forEach(u => win(u, gy + .2, .6, .8, 'trim', gv - .04));
    }

    // Lüftlmalerei: corner quoins painted on the plaster, a saint in a frame between the top windows and a sundial
    // in the gable.

    if (o.paint) {
      for (const sg of [-1, 1]) fbox(sg * (w / 2 - .22), vf + .02, top / 2 + .3, .4, top - .6, .03, frame);
      if (picFloor >= 0) {
        const py = gf + picFloor * fh + fh * .55, pu = 0;
        fbox(pu, vf + .02, py, 1.3, 1.9, .03, GOLD);
        fbox(pu, vf + .04, py, 1.05, 1.65, .03, SKY);
        fbox(pu, vf + .06, py - .15, .42, 1.1, .03, pick(r, [[.5, .1, .08], [.15, .2, .45], [.4, .3, .1]]));
        fbox(pu, vf + .06, py + .55, .24, .24, .03, [.6, .45, .32]);
      }
    }
    if (o.sundial && !eaves) {
      fbox(0, gv + .02, gy + .3, 1.1, 1.1, .03, [.58, .55, .45]);
      fbox(0, gv + .08, gy + .45, .05, .05, .4, IRON);
    }

    // A corner oriel on two floors, on a corbel, under a little spire.

    if (o.oriel) {
      const ou = o.orielU(w), ow = 1.4, oh = Math.min(n, 2) * fh - .4, oy = gf + .3;
      fbox(ou, vf + .35, oy - .25, ow * .7, .5, .7, tone(pick(r, STONE), 1.1));
      block(ou, vf + .45, oy, ow, .9, oh, uBlind, uC, { lit: 0 });
      for (let i = 0; i < Math.min(n, 2); i++) win(ou, oy + i * fh + fh * .5, .7, 1.1, o.paint ? 'paint' : 'shut', vf + .82);
      const [px, pz] = at(ou, vf + .45);
      prop('cone', px, oy + oh + .7 + lift(px, pz), pz, ow * 1.15, 1.4, ow * 1.15, roofC, face);
    }

    // An inn's hanging sign on an iron bracket, and benches by the door.

    if (o.inn) {
      const su = du + (du < 0 ? 1.4 : -1.4), sy = gf + .35;
      fbox(su, vf + .7, sy, .07, .07, 1.4, IRON);
      fbox(su, vf + 1.15, sy - .6, .04, 1.05, .9, GOLD);
      fbox(su, vf + 1.15, sy - .6, .07, .85, .7, pick(r, SIGNS));
      pane(du, vf + .5, gf - .3, .3, .4);
      for (const sg of [-1, 1]) if (Math.abs(du + sg * 1.9) < w / 2 - 1) fbox(du + sg * 1.9, vf + .35, .45, 1.6, .1, .4, WOOD);
    }

    // Behind: a barn's earth ramp up to its threshing floor door, or the yard. Either may hold a fir or a fruit tree.

    if (o.ramp && p.back > 3) {
      const len = Math.min(p.back - .4, 7), rw = Math.min(3.2, w - 1.5), hs = gf / 3;
      for (let i = 0; i < 3; i++) {
        const li = len * (3 - i) / 3;
        fbox(0, -d / 2 - li / 2, (i + .5) * hs, rw, hs, li, i === 2 ? [.12, .15, .07] : tone(ROCK, .8));
      }
      fbox(0, -d / 2 - .05, gf + 1.3, 2.6, 2.6, .08, tone(WOOD, .8));
    } else if (o.part?.yard ?? true) {
      yard(p, x, z, s, st, r);
      if (p.back > 3 && r() < (o.tree ?? .3)) tree(...at((r() - .5) * Math.max(0, w - 3), -d / 2 - p.back - .25), r, r() < .5 ? 'fir' : 'fruit');
    }
  }

  return {

    // The classic house: a whitewashed or stone ground floor, one to three floors of dark logs and one or two
    // balconies across the gable front.

    al_chalet(x, z, s, st, b, r) {
      const n = 1 + (r() < .7) + (r() < .2);
      chalet(x, z, s, st, r, { depth: [10, 13], floors: n, ground: ['white', 'white', 'stone'], upper: ['log'],
        balconies: Math.min(n, 1 + (r() < .5)), gableBalc: .35, hip: .3, stones: .2, flowers: .5 });
    },

    // A plastered house painted all over: window frames, corner quoins, a saint and a sundial, an oriel at one corner
    // and a half-hip roof.

    al_painted(x, z, s, st, b, r) {
      const sg = r() < .5 ? -1 : 1;
      chalet(x, z, s, st, r, { depth: [11, 14], floors: 2 + (r() < .35), gf: 3.4 + r() * .4, ground: ['white'], upper: ['white'],
        paint: true, shut: r() < .5, picture: true, sundial: r() < .7, oriel: r() < .75, orielU: w => sg * (w / 2 - 1.2),
        gableBalc: .5, hip: .7, tile: .5, flowers: .5, wood: .1 });
    },

    // A Gasthof: wide and tall under a broad roof, balconies on every upper floor, a hanging sign and lit windows.

    al_inn(x, z, s, st, b, r) {
      const n = 2 + (r() < .5);
      chalet(x, z, s, st, r, { depth: [13, 16], floors: n, gf: 3.6 + r() * .3, ground: ['white', 'white', 'stone'],
        upper: ['log', 'log', 'white'], paint: r() < .4, shut: true, inn: true, balconies: n, gableBalc: .6, side: 1.2 + r() * .3,
        front: 1.5 + r() * .4, hip: .4, tile: .4, litK: 2.4, flowers: .7, wood: .2 });
    },

    // A barn or stable: a stone byre under a timber loft, a hay door in the gable, and an earth ramp up to the
    // threshing floor at the back.

    al_barn(x, z, s, st, b, r) {
      chalet(x, z, s, st, r, { depth: [10, 13], floors: 1, gf: 3, fh: 3.4 + r() * .6, ground: ['stone', 'stone', 'white'], upper: ['log'],
        hayDoor: true, ramp: true, hip: .4, stones: .5, chimney: 0, litK: .5, flowers: .1, wood: .7 });
    },

    // A small log house for the back lanes: one low floor over a stone or log ground floor, stones on its roof.

    al_small(x, z, s, st, b, r) {
      chalet(x, z, s, st, r, { depth: [7, 9], floors: r() < .7 ? 1 : 0, gf: 2.8 + r() * .3, fh: 2.6, ground: ['stone', 'white', 'log'],
        upper: ['log'], side: .6 + r() * .3, front: .9 + r() * .4, balconies: r() < .35 ? 1 : 0, hip: .2, stones: .6, wood: .8,
        flowers: .35, tree: .45 });
    },

    // A house clad in wooden shingles up to the eaves, under a very wide and flat roof.

    al_shingle(x, z, s, st, b, r) {
      const n = 1 + (r() < .6);
      chalet(x, z, s, st, r, { depth: [10, 13], floors: n, ground: ['shingle', 'white', 'stone'], upper: ['shingle'],
        side: 1.3 + r() * .3, front: 1.7 + r() * .3, pitch: .34 + r() * .06, balconies: r() < .4 ? 1 : 0, hip: .5, stones: .4,
        flowers: .35 });
    },
  };
}
