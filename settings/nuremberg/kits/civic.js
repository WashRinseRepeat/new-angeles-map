// Nuremberg's civic landmarks around 1500: the Hauptmarkt and its fountain, the town hall, the hospital on the
// Pegnitz, the wine hall, granary, patrician houses, the inner gate towers, the river prison and the inns.

import { HALF_PI, SLATE, COPPER, GOLD, helpers } from './common.js';
import { groundAt } from '../../../engine/relief.js';

export const kits = () => ({});

// Palette.

const YEL = [.42, .34, .21], RUST = [.34, .2, .14], LIGHT = [.5, .41, .28], CREAM = [.5, .46, .36], OCHRE = [.5, .4, .2];
const TILE = [.38, .14, .07], TILE2 = [.27, .12, .08], TIMB = [.14, .09, .05], IRON = [.07, .07, .08], WATER = [.08, .2, .3];
const GOODS = [[.75, .15, .1], [.85, .6, .15], [.25, .5, .15], [.6, .5, .32], [.5, .28, .14], [.78, .74, .62], [.28, .34, .55], [.6, .2, .4]];
const AWN = [[.5, .15, .1], [.15, .25, .45], [.45, .4, .15], [.2, .35, .18], [.5, .45, .4], [.35, .12, .3], [.55, .3, .1]];
const WIN = r => [.95 + r() * .5, .55 + r() * .25, .2 + r() * .08];
const LAMP = [1.9, .9, .3], DOOR = [.1, .07, .05], SHUT = [.45, .14, .1];

export function landmarks(H) {
  const { bld, prop, glow, flickerGlow, SKINS } = H, out = {};
  const { site, turn, opt, STONE, pick3, each } = helpers(H, out);
  const pk = (r, a) => a[Math.floor(r() * a.length)];

  // A local frame turned by a. Parts take local metres (u east, v south) and a height above the ground at their spot.

  const frame = (a = 0) => {
    const T = (u, v) => turn(a, u, v);
    return {
      B(u, v, w, d, h, st, r, o = {}) { const [x, z] = T(u, v); bld(x, z, w, d, h, st, r, opt({ ...o, ry: (o.ry ?? 0) - a })); },
      P(k, u, y, v, sx, sy, sz, c, ry = 0, rx = 0) { const [x, z] = T(u, v); prop(k, x, y, z, sx, sy, sz, c, ry - a, rx); },
      G(u, y, v, sx, sy, sz, c, ry = 0) { const [x, z] = T(u, v); glow(x, y, z, sx, sy, sz, c, ry - a); },
      L(u, y, v, sx, sy, sz, c, r, dim = .7) { const [x, z] = T(u, v); flickerGlow(x, y, z, sx, sy, sz, c, r, dim); },
    };
  };

  // Places a flat box on a wall. f is the face (s, n, e, w), t the position along the wall and p the wall plane.

  const wallAt = (F, f, t, p) => {
    const ns = f === 's' || f === 'n', k = f === 's' || f === 'e' ? 1 : -1;
    return (a, b, y, sa, sh, sb, c, g) => {
      const u = ns ? t + a : p + b * k, v = ns ? p + b * k : t + a, sx = ns ? sa : sb, sz = ns ? sb : sa;
      if (g) F.G(u, y, v, sx, sh, sz, c); else F.P('box', u, y, v, sx, sh, sz, c);
    };
  };

  // A lit window with an optional stone frame, shutters, bars and sill. y is the sill height.

  const win = (F, t, y, p, f, w, h, r, o = {}) => {
    const W = wallAt(F, f, t, p), k = y + h / 2;
    if (o.frame !== false) W(0, .02, k, w + .5, h + .5, .14, o.fc ?? LIGHT);
    W(0, .07, k, w, h, .08, o.rgb ?? WIN(r), true);
    if (o.shut) for (const s of [-1, 1]) W(s * (w / 2 + .38), .13, k, .5, h, .08, o.shut);
    if (o.bars) { W(0, .13, k, .07, h, .05, IRON); W(0, .13, k + h * .12, w, .07, .05, IRON); }
    if (o.sill) W(0, .22, y - .1, w + .7, .12, .45, o.fc ?? LIGHT);
  };

  // A pointed Gothic window: a stepped head over a lit body, with a mullion and a transom.

  const gothic = (F, t, y, p, f, w, h, r) => {
    const W = wallAt(F, f, t, p), c = WIN(r), hh = w * .7, bh = h - hh;
    W(0, .02, y + h / 2, w + .5, h + .5, .14, LIGHT);
    W(0, .07, y + bh / 2, w, bh, .08, c, true);
    W(0, .07, y + bh + hh * .25, w * .8, hh * .5, .08, c, true);
    W(0, .07, y + bh + hh * .65, w * .4, hh * .5, .08, c, true);
    W(0, .13, y + bh / 2, .07, bh, .05, IRON);
    W(0, .13, y + bh * .62, w, .07, .05, IRON);
  };

  // Lit window plates on the flat faces of an octagonal shaft, at the given face angles.

  const facets = (F, cu, cv, ap, y, h, w, angles, r) => {
    for (const a of angles) F.G(cu + Math.cos(a) * ap, y, cv + Math.sin(a) * ap, w, h, .08, WIN(r), -(a + HALF_PI));
  };

  // A horizontal beam between two points at height y.

  const beam = (F, u1, v1, u2, v2, y, t, h, c) =>
    F.P('box', (u1 + u2) / 2, y, (v1 + v2) / 2, Math.hypot(u2 - u1, v2 - v1), h, t, c, -Math.atan2(v2 - v1, u2 - u1));

  // A regular octagonal ring of wall boxes with apothem ap.

  const ring8 = (F, ap, y, h, th, c) => {
    const len = 2 * ap * Math.tan(Math.PI / 8) + th;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + Math.PI / 8;
      F.P('box', Math.cos(a) * ap, y, Math.sin(a) * ap, len, h, th, c, -(a + HALF_PI));
    }
  };

  // An arch of wedge stones in the v-y plane at u = ur, springing at height y over the given span. It only suits an
  // unturned frame. lf lifts y over uneven ground. It returns the rise.

  const arch = (F, ur, vc, y, span, depth, thick, c, pointed = true, lf = (u, v, yy) => yy) => {
    const arcs = pointed
      ? [[vc + span / 2, span, Math.PI, 2 * Math.PI / 3], [vc - span / 2, span, 0, Math.PI / 3]]
      : [[vc, span / 2, Math.PI, 0]];
    const n = pointed ? 5 : 9;
    for (const [cv, R, p0, p1] of arcs) for (let i = 0; i < n; i++) {
      const p = p0 + (p1 - p0) * (i + .5) / n, v = cv + R * Math.cos(p), yy = y + R * Math.sin(p);
      F.P('box', ur, lf(ur, v, yy), v, depth, thick, Math.abs(R * (p1 - p0)) / n * 1.15, c, 0, -(p + HALF_PI));
    }
    return pointed ? span * .866 : span / 2;
  };

  // Stepped blocks that fill the corners between a round arch opening and its square head.

  const spandrel = (F, ur, vc, y, span, depth, c, lf = (u, v, yy) => yy) => {
    const R = span / 2, n = 6, sh = R / n;
    for (let i = 1; i < n; i++) {
      const hm = (i + .5) * sh, wid = R - Math.sqrt(R * R - hm * hm);
      for (const s of [-1, 1]) F.P('box', ur, lf(ur, vc, y + (i + .5) * sh), vc + s * (R - wid / 2), depth, sh + .02, wid, c);
    }
  };

  // A stepped gable wall. Its width is span at the base and narrows to nothing over rise.

  const stepped = (F, ur, vc, y0, span, rise, thick, S, r, n = 7) => {
    const sh = rise / n;
    for (let k = 0; k < n; k++) {
      const wid = span * (1 - k / n) * .96 + .5;
      F.B(ur, vc, thick, wid, sh, S, r, { y0: y0 + k * sh, skin: SKINS.stone, lit: .05 });
      for (const s of [-1, 1]) F.P('cone', ur, y0 + (k + 1) * sh + .3, vc + s * wid / 2, .5, .7, .5, S.base);
    }
  };

  // A gabled dormer on a roof slope. The slope falls from the ridge at vc (ridge height ey + rh) to the eave at
  // distance hs. t is the height of the dormer's front foot above the eave. ax puts the ridge along v, and then u
  // is the position along v and vc the ridge's u.

  const dormer = (F, u, vc, sg, hs, ey, rh, t, bw, bd, S, rc, r, ax = false) => {
    const vf = hs * (1 - t / rh), bh = Math.max(2, rh * bd / hs + .7), p = vc + sg * (vf - bd / 2), y0 = ey + t - .3;
    const wu = ax ? p : u, wv = ax ? u : p, face = ax ? (sg > 0 ? 'e' : 'w') : (sg > 0 ? 's' : 'n');
    F.B(wu, wv, ax ? bd : bw, ax ? bw : bd, bh, S, r, { y0, skin: SKINS.stone, lit: .08 });
    F.B(wu, wv, ax ? bw + .8 : bd + .8, ax ? bd + .8 : bw + .8, bw * .62, S, r, { y0: y0 + bh, shape: 'gable', skin: SKINS.tile, base: rc, lit: 0, ry: ax ? 0 : HALF_PI });
    win(F, u, y0 + .5, vc + sg * vf, face, bw * .5, bh * .5, r, { fc: LIGHT });
  };

  // A hanging sign on an iron bracket, reaching dir (1 or -1) along v from the wall at (u, v).

  const sign = (F, u, y, v, dir, col, tip) => {
    F.P('box', u, y, v + dir * .9, .08, .08, 1.8, IRON);
    F.P('box', u, y - .75, v + dir * 1.5, .1, 1, 1.15, col);
    F.P('box', u, y - .22, v + dir * 1.5, .06, .5, .06, IRON);
    F.P('box', u, y - .75, v + dir * 1.5, .14, .12, .5, GOLD);
    if (tip) F.P('cone', u, y - 1.55, v + dir * 1.5, .35, .5, .35, tip);
  };

  // A wall lantern.

  const lantern = (F, u, y, v, r) => {
    F.P('box', u, y, v, .1, .1, .1, IRON);
    F.L(u, y - .25, v, .25, .38, .25, LAMP, r, .7);
  };

  // ---------- the Hauptmarkt: stalls of every size, with awnings, goods, carts, barrels and lanterns ----------

  const stall = (F, kind, u, v, r) => {
    const wood = [.2, .14, .08].map(c => c * (.8 + r() * .5)), ns = r() < .8;
    if (kind === 0) {
      const sx = (ns ? 2.8 : 1.9) + r() * 1.6, sz = (ns ? 1.9 : 2.8) + r() * .8, a1 = pk(r, AWN), a2 = r() < .6 ? [.58, .52, .42] : pk(r, AWN);
      F.P('box', u, .5, v, sx, 1, sz, wood);
      for (const i of [-1, 1]) for (const j of [-1, 1]) F.P('box', u + i * (sx / 2 + .1), j > 0 ? 1.15 : 1.4, v + j * (sz / 2 + .1), .12, j > 0 ? 2.3 : 2.8, .12, wood);
      const len = (ns ? sx : sz) + .5, n = Math.max(3, Math.round(len / .65));
      for (let i = 0; i < n; i++) {
        const o = ((i + .5) / n - .5) * len, c = i % 2 ? a2 : a1, wd = len / n * .98;
        if (ns) { F.P('box', u + o, 2.6, v + .1, wd, .06, sz + .9, c, 0, .17); F.P('box', u + o, 2.2, v + sz / 2 + .5, wd, .3, .04, c); }
        else { F.P('box', u + .1, 2.55, v + o, sx + .9, .06, wd, c); F.P('box', u + sx / 2 + .5, 2.2, v + o, .04, .3, wd, c); }
      }
      const g = pk(r, GOODS);
      for (let i = 0; i < 4; i++) F.P('box', u + (i - 1.5) * (ns ? sx : sz * .6) / 3.2, 1.2, v + (r() - .5) * .4, .5, .3 + r() * .2, .45, i % 2 ? g : pk(r, GOODS));
      F.P('box', u, 1.7, v - sz / 2 + .1, sx, .08, .4, wood);
      F.P('box', u + (r() - .5) * sx * .6, 1.9, v - sz / 2 + .15, .4, .35, .3, pk(r, GOODS));
      F.P('cyl', u + sx / 2 + .9, .3, v + sz / 2 - .2, .6, .6, .6, wood);
      F.P('box', u - sx / 2 - .8, .25, v + sz / 2, .6, .5, .5, [.4, .32, .2]);
    } else if (kind === 1) {
      const c = pk(r, AWN), c2 = pk(r, AWN), s = 4 + r() * 1.2;
      F.P('cyl', u, 1.6, v, .14, 3.2, .14, wood);
      F.P('cone', u, 3.3, v, s, 1.5, s, c);
      F.P('cyl', u, 2.95, v, s + .05, .12, s + .05, c2);
      F.P('cyl', u, .85, v, 1.9, .1, 1.9, wood);
      F.P('cyl', u, .42, v, .3, .84, .3, wood);
      for (let i = 0; i < 4; i++) F.P('box', u + (r() - .5) * 1.1, 1, v + (r() - .5) * 1.1, .4, .25, .4, pk(r, GOODS));
      for (const a of [.6, 3.4]) F.P('cyl', u + Math.cos(a) * 1.7, .25, v + Math.sin(a) * 1.7, .5, .5, .5, wood);
    } else if (kind === 2) {
      const ry = (r() - .5) * 1.2;
      F.P('box', u, .9, v, 2.8, .45, 1.5, wood, ry);
      for (const i of [-1, 1]) for (const j of [-1, 1]) {
        const [du, dv] = [i * .85 * Math.cos(ry) + j * .85 * Math.sin(ry), -i * .85 * Math.sin(ry) + j * .85 * Math.cos(ry)];
        F.P('cyl', u + du, .5, v + dv, 1, .12, 1, [.12, .08, .05], ry, HALF_PI);
      }
      const hx = Math.cos(ry) * 2.2, hz = -Math.sin(ry) * 2.2;
      F.P('box', u + hx, .65, v + hz, 2.2, .08, .1, wood, ry);
      const g = pk(r, GOODS);
      for (let i = 0; i < 6; i++) F.P('box', u + (i % 3 - 1) * .8, 1.35 + (i > 2 ? .3 : 0), v + (i > 2 ? .3 : -.3), .75, .4, .65, i % 2 ? g : pk(r, GOODS), ry);
      if (r() < .5) { F.P('box', u - 1.8, .5, v + .2, .55, 1, .55, [.55, .4, .2]); F.P('box', u - 1.8, 1.1, v + .2, .6, .3, .6, [.7, .62, .3]); }
    } else if (kind === 3) {
      F.P('box', u, .6, v, 2.4, .1, 1.1, wood);
      for (const i of [-1, 1]) F.P('box', u + i * 1.0, .3, v, .12, .6, 1, wood);
      const n = 4 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const bu = u + (i % 4 - 1.5) * .95 + (r() - .5) * .2, bv = v + 1.5 + Math.floor(i / 4) * .95;
        F.P('cyl', bu, .5, bv, .78, 1, .78, [.28, .17, .08]);
        F.P('cyl', bu, .25, bv, .84, .08, .84, IRON); F.P('cyl', bu, .78, bv, .84, .08, .84, IRON);
      }
      F.P('box', u, .9, v, .7, .5, .7, pk(r, GOODS));
      F.P('box', u - 1.8, .45, v - .6, .9, .9, .7, [.34, .24, .12]);
    } else if (kind === 4) {
      for (const i of [-1, 1]) F.P('cyl', u + i * 2, 1.4, v, .14, 2.8, .14, wood);
      beam(F, u - 2, v, u + 2, v, 2.7, .1, .1, wood);
      for (let i = 0; i < 7; i++) {
        const hg = 1.3 + r() * 1.1;
        F.P('box', u - 1.8 + i * .6, 2.65 - hg / 2, v + (r() - .5) * .2, .5, hg, .05, pk(r, AWN));
      }
      F.P('box', u, .45, v + 1, 3, .9, .9, wood);
      for (let i = 0; i < 3; i++) F.P('box', u + (i - 1) * 1, 1, v + 1, .7, .15, .5, pk(r, GOODS));
    } else {
      F.P('box', u, .4, v, 3, .8, 1.2, wood);
      for (const i of [-1, 1]) F.P('cyl', u + i * 1.6, 1.1, v - .5, .12, 2.2, .12, wood);
      F.P('box', u, 2.2, v - .1, 3.6, .1, 1.8, pk(r, AWN), 0, .12);
      for (let i = 0; i < 5; i++) {
        const bu = u + (i - 2) * .6;
        F.P('cyl', bu, .98, v, .5, .36, .5, [.45, .34, .18]);
        F.P('cyl', bu, 1.2, v, .42, .1, .42, pk(r, GOODS));
      }
      for (let i = 0; i < 4; i++) F.P('box', u + (i - 1.5) * .7, .15, v + 1.1, .35, .3, .3, i % 2 ? [.85, .82, .75] : [.5, .35, .2]);
    }
  };

  const market = site('square');
  if (market) out.nb_market = {
    at: market.at, free: [market.w, market.d],
    build(x, z, w, d, st, r) {
      const F = frame();
      for (let gu = -w / 2 + 9; gu <= w / 2 - 12; gu += 8.5) for (let gv = -d / 2 + 7; gv <= d / 2 - 6; gv += 9.5) {
        const u = gu + (r() - .5) * 2.6, v = gv + (r() - .5) * 2.4;
        if (Math.hypot(u, v) < 15 || Math.hypot(u + 33, v + 30) < 14 || (u < -22 && v < -12) || Math.abs(v) < 4) continue;
        const q = r(), kind = q < .3 ? 0 : q < .45 ? 1 : q < .6 ? 2 : q < .75 ? 3 : q < .88 ? 4 : 5;
        stall(F, kind, u, v, r);
        if (r() < .3) F.L(u + 1.4, 3.1, v + 1.2, .22, .3, .22, LAMP, r, .7);
      }
      for (const [u, v] of [[-14, 18], [20, -20], [30, 8], [-30, 24], [6, 30], [12, -34], [-8, -24], [28, 28]]) {
        F.P('cyl', u, 1.7, v, .14, 3.4, .14, IRON);
        F.P('box', u, 3.5, v, .4, .5, .4, IRON);
        F.L(u, 3.5, v, .3, .4, .3, LAMP, r, .7);
      }
      return { focus: [0, 0], span: 110 };
    },
  };

  // ---------- the Schöner Brunnen: a 19 m painted and gilded spire of four tiers over an octagonal basin ----------

  const figure = (F, u, y, v, r, crown) => {
    const c = pick3(r).map(k => k * .8);
    F.P('box', u, y + .4, v, .32, .8, .28, c);
    F.P('box', u, y + .4, v, .4, .08, .34, GOLD);
    F.P('box', u, y + .92, v, .22, .24, .22, [.72, .52, .4]);
    if (crown) F.P('cone', u, y + 1.15, v, .3, .22, .3, GOLD);
  };

  each('fountain', () => ({
    labelY: 24,
    build(x, z, w, d, st, r) {
      const F = frame(), S = STONE(st, 0, [.44, .34, .22]), sk = SKINS.stone;
      F.B(0, 0, 7.8, 7.8, .3, S, r, { shape: 'oct', skin: sk });
      ring8(F, 3.3, .75, 1.05, .6, [.45, .36, .25]);
      ring8(F, 3.3, 1.32, .12, .8, GOLD.map(c => c * .6));
      F.P('cyl', 0, .8, 0, 6.2, .12, 6.2, WATER);
      F.G(0, .88, 0, 5.6, .04, 5.6, [.04, .12, .2]);

      // iron grille: posts with gilt tips, rails and bars

      const V = k => [Math.cos(k * Math.PI / 4 + Math.PI / 8) * 4.06, Math.sin(k * Math.PI / 4 + Math.PI / 8) * 4.06];
      for (let k = 0; k < 8; k++) {
        const [u1, v1] = V(k), [u2, v2] = V(k + 1);
        F.P('box', u1, .95, v1, .16, 1.9, .16, IRON);
        F.P('cone', u1, 2.05, v1, .26, .4, .26, GOLD);
        beam(F, u1, v1, u2, v2, 1.7, .08, .08, IRON);
        beam(F, u1, v1, u2, v2, .35, .08, .08, IRON);
        for (let j = 1; j < 6; j++) F.P('box', u1 + (u2 - u1) * j / 6, 1.0, v1 + (v2 - v1) * j / 6, .05, 1.3, .05, IRON);
      }

      // tiers: slab diameter, shaft diameter, shaft height, figures, figure radius, painted colour

      let y = 1.2, a0 = 0;
      const tiers = [[3.8, 2.0, 2.8, 16, 1.5, [.48, .24, .18]], [3.0, 1.5, 2.6, 16, 1.15, [.2, .28, .5]], [2.3, 1.1, 2.6, 8, .85, [.5, .22, .18]], [1.6, .75, 2.0, 0, 0, [.2, .4, .3]]];
      for (const [sd, dd, h, nf, fr, col] of tiers) {
        F.B(0, 0, sd, sd, .4, S, r, { y0: y, shape: 'oct', skin: sk });
        F.B(0, 0, sd + .15, sd + .15, .1, { ...S, base: GOLD }, r, { y0: y + .4, shape: 'oct', skin: sk });
        y += .5;
        F.B(0, 0, dd, dd, h, { ...S, base: col }, r, { y0: y, shape: 'oct', skin: sk });
        F.B(0, 0, dd + .2, dd + .2, .16, { ...S, base: GOLD }, r, { y0: y + h * .55, shape: 'oct', skin: sk });
        for (let k = 0; k < nf; k++) {
          const a = a0 + k / nf * Math.PI * 2, fu = Math.cos(a) * fr, fv = Math.sin(a) * fr;
          figure(F, fu, y, fv, r, nf === 16 && k % 2 === 0);
          F.P('cone', fu, y + 1.55, fv, .5, .7, .5, S.base);
          F.P('cone', fu, y + 1.95, fv, .2, .3, .2, GOLD);
        }
        for (let k = 0; k < 8; k++) {
          const a = k * Math.PI / 4 + Math.PI / 8, pr = sd * .5 - .08;
          F.P('cyl', Math.cos(a) * pr, y + h * .55 + .2, Math.sin(a) * pr, .2, h * 1.05, .2, S.base);
          F.P('cone', Math.cos(a) * pr, y + h * 1.1 + .55, Math.sin(a) * pr, .26, .7, .26, GOLD);
        }
        y += h; a0 += .2;
      }

      // spire with crockets and a finial

      F.P('cone', 0, y + 2.3, 0, 1.5, 4.6, 1.5, [.2, .42, .34]);
      for (let i = 0; i < 6; i++) for (let k = 0; k < 4; k++) {
        const t = (i + .5) / 6.4, rr = .72 * (1 - t) + .08, a = k * Math.PI / 2 + i * .4;
        F.P('box', Math.cos(a) * rr, y + t * 4.6, Math.sin(a) * rr, .16, .2, .16, GOLD);
      }
      F.P('cyl', 0, y + 4.8, 0, .1, .6, .1, GOLD);
      F.P('box', 0, y + 5.3, 0, .1, .5, .1, GOLD); F.P('box', 0, y + 5.4, 0, .36, .08, .08, GOLD);
      F.G(0, y + 5.2, 0, .18, .18, .18, [1.2, .8, .3]);
      F.L(3.0, 1.9, 3.0, .3, .4, .3, LAMP, r, .7); F.L(-3.0, 1.9, -3.0, .3, .4, .3, LAMP, r, .7);
      return { focus: [0, 0], span: 40 };
    },
  }));

  // ---------- the Altes Rathaus: the Gothic great hall of 1332-40 with a cross wing, an oriel and a stepped east block ----------

  each('rathaus', () => ({
    labelY: 32,
    build(x, z, w, d, st, r) {
      const F = frame(), S = STONE(st, .1, YEL), S2 = STONE(st, .1, RUST), sk = SKINS.stone, tile = SKINS.tile;
      const hu = -6, hv = 3, hw = 50, hd = 15, hh = 13, rise = 13, eaveV = hd / 2 + .6, front = hv + hd / 2, back = hv - hd / 2;

      // great hall, west cross wing with its Gothic gable to the south, west annex and east block

      F.B(hu, hv, hw, hd, hh, S, r, { skin: sk });
      F.B(hu, hv, hw + .8, hd + 1.2, rise, st, r, { y0: hh, shape: 'gable', skin: tile, base: TILE, lit: 0 });
      F.B(-24.5, 4.25, 13, 17.5, hh, S, r, { skin: sk });
      F.B(-24.5, 4.25, 18.3, 14, 11, st, r, { y0: hh, shape: 'gable', skin: tile, base: TILE2, lit: 0, ry: HALF_PI });
      F.B(-24.5, 13.3, .5, 13.6, 11, S, r, { y0: hh, shape: 'gable', skin: sk, lit: .05, ry: HALF_PI });
      F.B(-36, 0, 9, 12, 9, S2, r, { skin: sk });
      F.B(-36, 0, 12.4, 9.8, 7, st, r, { y0: 9, shape: 'gable', skin: tile, base: TILE, lit: 0, ry: HALF_PI });
      F.B(28.5, 0, 19, 16, 11, S, r, { skin: sk });
      F.B(28.5, 0, 19.8, 17.4, 10, st, r, { y0: 11, shape: 'gable', skin: tile, base: TILE2, lit: 0 });
      stepped(F, 38.4, 0, 11, 16.6, 10, .9, S, r, 6);

      // hall front: windows on two floors, buttresses and string courses

      for (const u of [-16, -5.6, -.4, 10, 15.2]) {
        gothic(F, u, 6, front, 's', 1.7, 5.8, r);
        win(F, u, 1.9, front, 's', 1, 1.5, r, { sill: true, bars: true });
      }
      for (const u of [-13.4, -8.2, -3, 2.2, 7.4, 12.6, 17.8]) {
        F.P('box', u, 6.4, front + .4, .8, 12.8, 1, S.base); F.P('box', u, 12.9, front + .3, .8, .6, 1.2, LIGHT);
        F.P('box', u, 6.4, back - .4, .8, 12.8, 1, S.base);
      }
      F.P('box', hu, 5.2, front + .1, hw, .35, .5, LIGHT);
      F.P('box', hu, 13.1, front + .15, hw + .2, .3, .55, LIGHT);
      for (const u of [-16, -10.8, -5.6, -.4, 4.8, 10, 15.2]) {
        gothic(F, u, 6, back, 'n', 1.7, 5.8, r);
        win(F, u, 1.9, back, 'n', 1, 1.5, r, { bars: true });
      }

      // portal with a stepped pointed head, steps, a coat of arms and lanterns

      const pu = -10.8;
      F.P('box', pu, 1.9, front + .1, 3.6, 3.8, .4, LIGHT);
      F.P('box', pu, 1.7, front + .25, 2.4, 3.4, .2, DOOR);
      F.G(pu, 3.15, front + .36, 1.5, .4, .04, [.6, .35, .1]);
      for (const [wd, y] of [[2.9, 3.7], [2.0, 4.1], [1.1, 4.5]]) F.P('box', pu, y, front + .3, wd, .42, .3, LIGHT);
      F.P('box', pu, 5.3, front + .25, 2.2, 1.1, .2, [.55, .45, .3]);
      F.P('box', pu, 5.3, front + .36, 1.2, .8, .06, [.6, .12, .1]); F.P('box', pu, 5.3, front + .4, .5, .5, .06, GOLD);
      for (let i = 0; i < 3; i++) F.P('box', pu, .15 + i * .15, front + 1.1 - i * .35, 4.4 - i * .5, .3, 1.1, LIGHT);
      for (const s of [-1, 1]) { lantern(F, pu + s * 2.3, 3.2, front + .5, r); F.P('box', pu + s * 2.5, 2.6, front + .4, .5, 1.4, .5, LIGHT); }

      // oriel on corbels: facets over a stepped corbel stack, with a copper roof

      const ou = 4.8, ov = front + 1.5;
      for (let i = 0; i < 4; i++) F.P('cone', ou, 4.6 - i * .45, ov, 3.1 - i * .6, .5, 3.1 - i * .6, LIGHT, 0, Math.PI);
      F.B(ou, ov, 3.4, 3.4, 6, S, r, { y0: 5, shape: 'oct', skin: sk });
      for (const y of [6.2, 9.2]) facets(F, ou, ov, 1.6, y + .8, 1.4, .8, [Math.PI / 4, HALF_PI, 3 * Math.PI / 4], r);
      F.P('cone', ou, 12.8, ov, 4, 3.6, 4, COPPER); F.P('cone', ou, 14.9, ov, .3, .7, .3, GOLD);

      // Gothic gable of the wing: windows, rose, pinnacles along the rake

      const gv = 13.55, gu = -24.5;
      for (const du of [-2.2, 0, 2.2]) gothic(F, gu + du, 14, gv, 's', 1.2, 4.2, r);
      F.P('cyl', gu, 20.6, gv + .1, 2.4, .3, 2.4, LIGHT, 0, HALF_PI);
      F.G(gu, 20.6, gv + .3, 1.6, 1.6, .05, WIN(r));
      F.P('box', gu, 20.6, gv + .36, .08, 1.8, .04, IRON); F.P('box', gu, 20.6, gv + .36, 1.8, .08, .04, IRON);
      for (const s of [-1, 1]) for (let i = 1; i <= 4; i++) {
        const gx = gu + s * (6.4 - i * 1.5), gy = hh + i * 2.54 + .3;
        F.P('cone', gx, gy + .7, gv + .1, .45, .8, .45, LIGHT); F.P('box', gx, gy, gv + .15, .5, .8, .5, LIGHT);
      }
      F.P('cone', gu, 25.2, gv + .15, .5, 1.6, .5, GOLD);
      for (const s of [-1, 1]) { F.P('cyl', gu + s * 6.5, 15.5, gv, .7, 5, .7, S.base); F.P('cone', gu + s * 6.5, 18.8, gv, .9, 1.6, .9, LIGHT); }

      // dormers and a ridge turret

      for (let i = 0; i < 5; i++) {
        const u = -13 + i * 7.4; if (Math.abs(u - ou) < 4) continue;
        dormer(F, u, hv, 1, eaveV, hh, rise, 3.4, 2.4, 1.6, S, TILE, r);
      }
      for (let i = 0; i < 5; i++) dormer(F, -15 + i * 7.6, hv, -1, eaveV, hh, rise, 3.4, 2.2, 1.6, S, TILE, r);
      for (let i = 0; i < 3; i++) dormer(F, 24 + i * 5.4, 0, 1, 8.7, 11, 10, 2.6, 2, 1.5, S, TILE2, r);
      F.B(hu + 4, hv, 2.4, 2.4, 3, S2, r, { y0: hh + rise, shape: 'oct', skin: sk });
      F.G(hu + 4, hh + rise + 1.5, hv + 1.22, .7, 1.5, .06, WIN(r));
      F.P('cone', hu + 4, hh + rise + 5.4, hv, 3, 4.6, 3, COPPER); F.P('cone', hu + 4, hh + rise + 8.3, hv, .3, 1.2, .3, GOLD);

      // stair turret on the north side, east block windows and bay, annex windows

      F.B(-3, -6.4, 3.8, 3.8, 20, S2, r, { shape: 'cyl', skin: sk });
      F.P('cone', -3, 23.8, -6.4, 4.6, 7, 4.6, COPPER); F.P('cone', -3, 28.1, -6.4, .3, 1.6, .3, GOLD);
      for (let i = 0; i < 6; i++) { const a = i * 1.9; F.G(-3 + Math.cos(a) * 1.92, 3 + i * 2.8, -6.4 + Math.sin(a) * 1.92, .3, .9, .06, WIN(r), -(a + HALF_PI)); }
      for (const u of [22, 27, 32, 35]) {
        win(F, u, 6, 8, 's', 1.1, 2.2, r, { sill: true, shut: [.3, .12, .08] }); win(F, u, 2, 8, 's', 1.1, 1.8, r, { bars: true });
        win(F, u, 6, -8, 'n', 1.1, 2.2, r);
      }
      F.B(30, 9.4, 3, 2.6, 4, S, r, { y0: 4, shape: 'oct', skin: sk });
      F.P('cone', 30, 10.6, 9.4, 3.4, 2.2, 3.4, COPPER); F.G(30, 6, 10.8, .9, 1.4, .06, WIN(r));
      for (const t of [-2, 2]) { win(F, -36 + t * 1.5, 4.5, 6, 's', 1, 2.2, r); win(F, t * 1.5, 4.5, -40.5, 'w', 1, 2.2, r); }
      lantern(F, 26, 3.5, 8.3, r); lantern(F, -20, 3.5, 13.5, r);
      return { focus: [0, 0], span: 110, face: [0, 1] };
    },
  }));

  // ---------- Heilig-Geist-Spital: stone halls and a half-timber wing on two arches across the Pegnitz ----------
  // The building turns a quarter, so u runs north to south across the river and the water flows along v under it.
  // Heights are absolute: K lifts a part from the river bed to the deck.

  each('spital', s => ({
    labelY: 30,
    build(x, z, w, d, st, r) {
      const F = frame(HALF_PI), S = STONE(st, .2, YEL), S2 = STONE(st, .1, RUST), sk = SKINS.stone, [sx0, sz0] = s.at;
      const lf = (u, v, y) => { const [wx, wz] = turn(HALF_PI, u, v); return y - groundAt(sx0 + wx, sz0 + wz); };
      const bank = Math.max(groundAt(sx0, sz0 - 20), groundAt(sx0, sz0 + 20));
      const D = bank + 1.4, R = 5.4, spring = D - 1.2 - R, L = w - 2, K = lf(0, 0, D);

      // Three piers run across the building, at each bank and in the river's middle. Two round arches open in each
      // long side between them, and a deck spans the whole length.

      for (const [u, th] of [[-14, 3], [0, 2.8], [14, 3]]) F.B(u, 0, th, d - 1, lf(u, 0, D - .8), S2, r, { skin: sk, lit: 0 });
      F.B(0, 0, L, d - 2, 1.4, S2, r, { y0: K - 1.4, skin: sk, lit: 0 });
      F.B(0, 0, L + 1.6, d, 1.2, S, r, { y0: K - .2, skin: sk, lit: 0 });
      const A = frame(Math.PI), la = (u, v, y) => lf(-v, u, y);
      for (const face of [-1, 1]) for (const uc of [-7, 7]) {
        arch(A, face * (d / 2 - .4), -uc, spring, 2 * R, .9, .7, LIGHT, false, la);
        spandrel(A, face * (d / 2 - .4), -uc, spring, 2 * R, .9, S2.base, la);
      }

      // the stone hall under a steep roof

      const hu = -6, hl = 44, hv = -1, hd = 15;
      F.B(hu, hv, hl, hd, 10, S, r, { y0: K, skin: sk });
      F.B(hu, hv, hl + .8, hd + 1.4, 11, st, r, { y0: K + 10, shape: 'gable', skin: SKINS.tile, base: TILE, lit: 0 });
      for (let u = hu - hl / 2 + 4; u < hu + hl / 2 - 2; u += 5) for (const [f, p] of [['s', hv + hd / 2], ['n', hv - hd / 2]]) {
        gothic(F, u, K + 4.2, p, f, 1.4, 4.4, r);
        win(F, u, K + 1.2, p, f, .9, 1.4, r, { bars: true });
      }
      for (let i = 0; i < 8; i++) dormer(F, hu - hl / 2 + 5.5 + i * 5.2, hv, i % 2 ? 1 : -1, (hd + 1.4) / 2, K + 10, 11, 3.2, 2.2, 1.5, S, TILE, r);

      // half-timber wing on the east end with two jettied floors

      const tu = 24, tl = 12, tv = 2, T = { ...st, lit: .3 };
      F.B(tu, tv, tl, 13, 4, S, r, { y0: K, skin: sk });
      F.B(tu, tv, tl + .8, 14, 4.2, T, r, { y0: K + 4, skin: SKINS.timber, base: CREAM });
      F.B(tu, tv, tl + 1.6, 15, 4.2, T, r, { y0: K + 8.2, skin: SKINS.timber, base: [.46, .4, .3] });
      F.B(tu, tv, tl + 3, 16.6, 7, st, r, { y0: K + 12.4, shape: 'gable', skin: SKINS.tile, base: TILE2, lit: 0, ry: HALF_PI });
      F.B(tu, tv + 8.1, .5, tl + 2.2, 7, T, r, { y0: K + 12.4, shape: 'gable', skin: SKINS.timber, base: CREAM, ry: HALF_PI });
      for (const u of [tu - 3.5, tu, tu + 3.5]) {
        win(F, u, K + 5.2, tv + 7.7, 's', 1.1, 1.6, r, { shut: [.28, .1, .06], sill: true });
        win(F, u, K + 9.4, tv + 8.5, 's', 1.1, 1.6, r, { shut: [.28, .1, .06], sill: true });
      }
      for (const u of [tu - 3.5, tu + 3.5]) win(F, u, K + 1.2, tv + 6.5, 's', 1, 1.6, r, { bars: true });
      for (let i = 0; i < 5; i++) { F.P('box', tu - 4.4 + i * 2.2, K + 3.6, tv + 7.2, .3, .6, 1.4, TIMB); F.P('box', tu - 4.4 + i * 2.2, K + 7.8, tv + 8, .3, .6, 1.4, TIMB); }

      // tower with a spire at the west end

      const gu = -27, gv = -6;
      F.B(gu, gv, 5, 5, 20, S, r, { y0: K, skin: sk });
      F.B(gu, gv, 4.2, 4.2, 5, S, r, { y0: K + 20, shape: 'oct', skin: sk });
      facets(F, gu, gv, 1.95, K + 22.5, 2, .9, [0, HALF_PI, Math.PI, 3 * HALF_PI], r);
      F.P('cone', gu, K + 30.5, gv, 5, 11, 5, COPPER);
      F.P('cone', gu, K + 36.8, gv, .4, 1.8, .4, GOLD);
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) F.P('cone', gu + a * 2.1, K + 26.2, gv + b * 2.1, .7, 2.2, .7, COPPER);
      for (const y of [6, 12, 17]) win(F, gu, K + y, gv + 2.5, 's', .6, 1.4, r);

      // chapel porch on the south and quay lanterns

      F.B(10, 8.6, 6, 3.4, 5, S, r, { y0: K, skin: sk });
      F.B(10, 8.6, 6.6, 4, 3, st, r, { y0: K + 5, shape: 'gable', skin: SKINS.tile, base: TILE, lit: 0 });
      gothic(F, 10, K + 1.2, 10.3, 's', 1.3, 3, r);
      for (const u of [-26, -10, 12, 28]) { F.P('cyl', u, K + 1.6, 10.5, .14, 3.2, .14, IRON); F.L(u, K + 3.4, 10.5, .3, .4, .3, LAMP, r, .7); }
      return { focus: [0, 0], span: 90 };
    },
  }));

  // ---------- Weinstadel: sandstone arches below, two jettied timber floors, galleries and a steep roof ----------

  each('weinstadel', () => ({
    labelY: 26,
    build(x, z, w, d, st, r) {
      const F = frame(), S = STONE(st, .15, RUST), sk = SKINS.stone, T = { ...st, lit: .25 };
      F.B(0, 0, w - 3, d - 3, 4.6, S, r, { skin: sk });
      F.B(0, 0, w - 1.5, d - 1.6, 4.2, T, r, { y0: 4.6, skin: SKINS.timber, base: [.44, .38, .28] });
      F.B(0, 0, w, d, 4.2, T, r, { y0: 8.8, skin: SKINS.timber, base: [.42, .34, .24] });
      F.B(0, 0, w + 1.2, d + 1.8, 10, st, r, { y0: 13, shape: 'gable', skin: SKINS.tile, base: TILE, lit: 0 });
      for (const e of [-1, 1]) F.B(e * (w / 2 + .3), 0, .5, d + 1, 10, T, r, { y0: 13, shape: 'gable', skin: SKINS.timber, base: CREAM, ry: HALF_PI });
      for (const [f, dk] of [['s', 1], ['n', -1]]) {
        const p = dk * (d - 3) / 2;
        for (let u = -w / 2 + 5; u < w / 2 - 3; u += 4.6) {
          F.P('box', u, 1.6, p + dk * .15, 2.6, 3.2, .3, LIGHT);
          F.P('box', u, 1.5, p + dk * .3, 2, 3, .15, DOOR);
          F.G(u, 3.4, p + dk * .38, .5, .6, .04, [.7, .4, .12]);
        }
        for (let u = -w / 2 + 3; u < w / 2 - 2; u += 3.2) {
          win(F, u, 5.6, dk * (d - 1.6) / 2, f, .9, 1.4, r, { shut: [.3, .1, .06] });
          win(F, u, 9.8, dk * d / 2, f, .9, 1.4, r, { shut: [.3, .1, .06] });
        }
      }

      // knee braces under the jetties and a gallery on the river side

      for (let u = -w / 2 + 2; u < w / 2 - 1; u += 2.3) { F.P('box', u, 4.1, (d - 3) / 2 + .5, .28, .5, .9, TIMB); F.P('box', u, 8.3, (d - 1.6) / 2 + .45, .28, .5, .9, TIMB); }
      const gl = 34, gv = d / 2 + .7;
      F.P('box', 0, 8.75, gv, gl, .16, 1.5, TIMB);
      for (let u = -gl / 2; u <= gl / 2; u += 1.7) { F.P('box', u, 9.45, gv + .72, .1, 1.2, .1, TIMB); F.P('box', u, 7.9, gv + .3, .16, 1.6, .16, TIMB, 0, -.6); }
      F.P('box', 0, 10.1, gv + .72, gl, .1, .14, TIMB); F.P('box', 0, 9.3, gv + .72, gl, .06, .08, TIMB);
      for (let u = -gl / 2 + 3; u < gl / 2; u += 5.2) F.L(u, 8.2, gv + .5, .22, .3, .22, LAMP, r, .7);

      // dormers with hoist beams

      for (let k = 0; k < 7; k++) {
        const u = -w / 2 + 6 + k * 5.6;
        dormer(F, u, 0, 1, (d + 1.8) / 2, 13, 10, 2.8 + (k % 2) * 3, 1.9, 1.4, T, TILE, r);
        dormer(F, u + 2.8, 0, -1, (d + 1.8) / 2, 13, 10, 3.2, 1.9, 1.4, T, TILE, r);
        if (k % 2) F.P('box', u, 16.4, (d + 1.8) / 2 * .6 + 1.9, .14, .14, 2, TIMB);
      }

      // the Wasserturm in the river beside the hall: stone drum, timber top, pointed roof

      const tu = -w / 2 - 6, tv = 12;
      F.B(tu, tv, 8, 8, 14, S, r, { shape: 'cyl', skin: sk });
      F.B(tu, tv, 9, 9, 4.6, T, r, { y0: 14, shape: 'cyl', skin: SKINS.timber, base: CREAM });
      F.P('cone', tu, 23.4, tv, 10, 9.6, 10, [.34, .13, .08]);
      F.P('cone', tu, 29.2, tv, .4, 2, .4, GOLD);
      for (let k = 0; k < 6; k++) { const a = k * 1.05; F.G(tu + Math.cos(a) * 4.55, 16.3, tv + Math.sin(a) * 4.55, .7, 1.3, .06, WIN(r), -(a + HALF_PI)); }
      for (let k = 0; k < 4; k++) { const a = k * 1.6 + .5; F.G(tu + Math.cos(a) * 4.05, 6 + k * 2.2, tv + Math.sin(a) * 4.05, .3, .9, .06, WIN(r), -(a + HALF_PI)); }

      // the Henkersteg: a roofed timber gallery on the street's line, standing on the bridge deck

      const hu = v => 41 - .125 * (v - 26), hr = -Math.atan2(1, -.125);
      for (let v = 25.5; v < 52; v += 3) {
        const u = hu(v);
        for (const s of [-1, 1]) { F.P('box', u + s * 2.1, 1.6, v, .24, 3.2, .24, TIMB); F.P('box', u + s * 2.1, .9, v + 1.5, .06, .1, 3, TIMB); F.P('box', u + s * 2.1, 2.1, v + 1.5, .06, .1, 3, TIMB); }
        F.P('box', u, 3.25, v, 4.6, .18, .22, TIMB);
        F.B(u, v + 1.5, 3.3, 5.6, 2.4, st, r, { y0: 3.25, shape: 'gable', skin: SKINS.tile, base: TILE2, lit: 0, ry: hr });
      }
      for (const v of [30, 39, 48]) F.L(hu(v), 2.8, v, .25, .35, .25, LAMP, r, .7);
      return { focus: [0, 0], span: 80 };
    },
  }));

  // ---------- the Mauthalle: a sandstone granary with stepped gables and a huge roof of five dormer rows ----------

  each('mauthalle', () => ({
    labelY: 36,
    build(x, z, w, d, st, r) {
      const F = frame(), S = STONE(st, .12, YEL), sk = SKINS.stone, hs = d / 2 + .6, eh = 12, rh = 20;
      F.B(0, 0, w, d, eh, S, r, { skin: sk });
      F.B(0, 0, w + .2, d + 1.2, rh, st, r, { y0: eh, shape: 'gable', skin: SKINS.tile, base: TILE, lit: 0 });
      for (const e of [-1, 1]) {
        stepped(F, e * (w / 2 + .45), 0, eh, d + 1.2, rh, .9, S, r, 8);
        for (const [v, y] of [[-3, 2.5], [3, 2.5], [0, 6.5]]) F.G(e * (w / 2 + .95), eh + y, v, .06, 1.8, .45, WIN(r));
      }
      for (const [f, dk] of [['s', 1], ['n', -1]]) {
        const p = dk * d / 2;
        for (let u = -w / 2 + 3; u < w / 2 - 2; u += 4) {
          for (const [y, hh] of [[1.4, 1.1], [4.4, 1.5], [7.4, 1.5], [10, 1.5]]) win(F, u, y, p, f, .75, hh, r, { frame: y > 3, bars: y < 3 });
        }
        for (const y of [4, 8]) F.P('box', 0, y, p + dk * .06, w + .3, .28, .3, LIGHT);
        for (let y = .6; y < eh; y += 1.6) for (const e of [-1, 1]) F.P('box', e * (w / 2 - .2), y, p + dk * .12, .6 + (Math.round(y / 1.6) % 2) * .3, .8, .2, LIGHT);
      }
      for (const [u, dk] of [[-12, 1], [12, -1]]) {
        const p = dk * d / 2;
        F.P('box', u, 3, p + dk * .2, 5, 6, .4, LIGHT);
        F.P('box', u, 2.5, p + dk * .38, 3.2, 5, .12, DOOR);
        F.P('box', u, 6.3, p + dk * 1.2, .16, .16, 2.6, TIMB);
        lantern(F, u + 3.1, 3.4, p + dk * .5, r);
      }
      for (let k = 0; k < 5; k++) for (const sg of [-1, 1]) {
        const t = 2.2 + k * 3.35;
        for (let u = -w / 2 + 5 + (k % 2) * 2; u < w / 2 - 4; u += 4) dormer(F, u, 0, sg, hs, eh, rh, t, 1.5 + (k === 0 ? .5 : 0), 1.2, S, k % 2 ? TILE2 : TILE, r);
      }
      for (let k = 0; k < 3; k++) { const u = -w / 2 + 14 + k * 15; F.P('box', u, eh + rh + .2, 0, 1.6, .5, 1.6, S.base); F.P('cone', u, eh + rh + 1.6, 0, 2, 2.4, 2, S.base); }
      return { focus: [0, 0], span: 80 };
    },
  }));

  // ---------- the Nassauer Haus: a Romanesque tower house under a Gothic crenellated crown, with a Chörlein ----------

  each('towerhouse', () => ({
    labelY: 36,
    build(x, z, w, d, st, r) {
      const F = frame(), S = STONE(st, .15, [.33, .25, .17]), S2 = STONE(st, .2, YEL), sk = SKINS.stone, hw = (w - .6) / 2;
      F.B(0, 0, w - .6, d - .6, 12, S, r, { skin: sk });
      F.B(0, 0, w - 1, d - 1, 8, S2, r, { y0: 12, skin: sk });

      // corbel frieze, top storey, parapet and corner turrets

      for (let k = 0; k < 8; k++) for (const e of [-1, 1]) {
        const t = -w / 2 + 1.6 + k * 1.4;
        F.P('cone', e * (hw - .4), 19.4, t, .6, .8, .6, LIGHT, 0, Math.PI);
        F.P('cone', t, 19.4, e * (hw - .4), .6, .8, .6, LIGHT, 0, Math.PI);
      }
      F.B(0, 0, w + .6, d + .6, 3.6, S2, r, { y0: 19.8, skin: sk });
      for (let k = 0; k < 12; k++) {
        const t = -w / 2 - .3 + (k + .5) * (w + .6) / 12;
        for (const e of [-1, 1]) { F.P('box', t, 24.2, e * (w / 2 + .3), .8, 1, .6, LIGHT); F.P('box', e * (w / 2 + .3), 24.2, t, .6, 1, .8, LIGHT); }
      }
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const tu = a * (w / 2 + .3), tv = b * (d / 2 + .3);
        for (let i = 0; i < 3; i++) F.P('cone', tu, 19.6 - i * .5, tv, 2.6 - i * .6, .6, 2.6 - i * .6, LIGHT, 0, Math.PI);
        F.B(tu, tv, 2.4, 2.4, 5, S2, r, { y0: 20, shape: 'cyl', skin: sk });
        F.P('cone', tu, 27.6, tv, 3, 4.2, 3, SLATE); F.P('cone', tu, 30.1, tv, .2, .8, .2, GOLD);
        F.G(tu, 22.4, tv + b * 1.22, .4, .8, .05, WIN(r));
      }
      F.B(0, 0, w - 2, d - 2, 6, st, r, { y0: 23.4, shape: 'pyr', skin: SKINS.tile, base: TILE, lit: 0 });
      F.P('box', 2.2, 28.4, -2, 1.2, 3, 1.2, S.base);

      // windows: small below, Gothic above

      for (const [f, p] of [['s', hw], ['n', -hw], ['e', hw], ['w', -hw]]) for (const t of [-2.4, 2.4]) {
        win(F, t, 3.2, p, f, .55, 1.1, r, { frame: false });
        win(F, t, 8, p, f, .6, 1.2, r);
        gothic(F, t, 13, p, f, 1, 3.2, r);
        gothic(F, t * .8, 20.4, p, f, .9, 2.3, r);
      }

      // Chörlein: a two-storey oriel on a corbel stack

      const ov = hw + 1.1;
      for (let i = 0; i < 5; i++) F.P('cone', 0, 6.6 - i * .55, ov, 3.1 - i * .55, .55, 3.1 - i * .55, LIGHT, 0, Math.PI);
      F.B(0, ov, 3.2, 3.2, 7, S2, r, { y0: 7, shape: 'oct', skin: sk });
      for (const y of [8, 11]) facets(F, 0, ov, 1.5, y + .9, 1.5, .8, [Math.PI / 4, HALF_PI, 3 * Math.PI / 4], r);
      F.P('cone', 0, 16.4, ov, 3.8, 4.8, 3.8, SLATE); F.P('cone', 0, 19.2, ov, .25, 1, .25, GOLD);

      // Romanesque portal and a lantern

      F.P('box', -2.6, 1.6, hw + .1, 2.2, 3.2, .3, LIGHT);
      F.P('box', -2.6, 1.4, hw + .25, 1.4, 2.8, .2, DOOR);
      F.P('box', -2.6, 3.4, hw + .3, 1.8, .4, .3, LIGHT);
      lantern(F, -.9, 3.2, hw + .5, r);
      return { focus: [0, 0], span: 40 };
    },
  }));

  // ---------- the Albrecht-Dürer-Haus: two sandstone floors, two half-timber floors and a steep gable roof with dormers ----------

  each('durer', (s, at, a) => ({
    labelY: 28,
    build(x, z, w, d, st, r) {
      const F = frame(a), S = STONE(st, .15, [.4, .31, .2]), T = { ...st, lit: .35 }, sk = SKINS.stone, sf = (d - 1.4) / 2, tf = (d - .2) / 2;
      F.B(0, 0, w, d - 1.4, 6.8, S, r, { skin: sk });
      F.B(0, 0, w, d - .2, 3, T, r, { y0: 6.8, skin: SKINS.timber, base: [.46, .4, .3] });
      F.B(0, 0, w, d - .2, 3, T, r, { y0: 9.8, skin: SKINS.timber, base: [.44, .37, .27] });
      F.B(0, 0, d + .4, w + .6, 11, st, r, { y0: 12.8, shape: 'gable', skin: SKINS.tile, base: TILE, lit: 0, ry: HALF_PI });
      for (const e of [-1, 1]) F.B(0, e * (d / 2 + .45), .5, w + .5, 11, T, r, { y0: 12.8, shape: 'gable', skin: SKINS.timber, base: CREAM, ry: HALF_PI });

      // front facade

      for (const u of [-4.2, -1.4, 1.4, 4.2]) {
        win(F, u, 1.7, sf, 's', .9, 1.5, r, { bars: true, sill: true });
        win(F, u, 4.6, sf, 's', 1, 1.6, r, { shut: [.18, .26, .12], sill: true });
        win(F, u, 7.2, tf, 's', 1.1, 1.5, r, { shut: SHUT, frame: false });
        win(F, u, 10.2, tf, 's', 1.1, 1.5, r, { shut: SHUT, frame: false });
        F.P('box', u, 6.9, tf + .25, 1.4, .3, .4, [.28, .12, .08]); F.P('box', u, 7.15, tf + .25, 1.2, .16, .3, [.3, .5, .2]);
      }
      win(F, 0, 14.4, tf + .6, 's', 1.4, 2.2, r, { shut: SHUT });
      win(F, 0, 18.4, tf + .6, 's', .9, 1.4, r, { frame: false });
      F.P('box', 0, 21.5, tf + 1.4, .14, .14, 2.2, TIMB); F.P('box', 0, 21.8, tf + 2.3, .3, .4, .3, [.3, .2, .1]);
      F.P('box', 0, 1.5, sf + .1, 2.4, 3, .3, LIGHT); F.P('box', 0, 1.3, sf + .25, 1.6, 2.6, .2, [.14, .08, .04]);
      for (let i = 0; i < 3; i++) F.P('box', 0, .15 + i * .15, sf + .9 - i * .3, 2.8 - i * .3, .3, 1, LIGHT);
      lantern(F, 1.9, 3.1, sf + .45, r);

      // sides: two rows of dormers, windows, quoins and a chimney

      for (const sg of [-1, 1]) {
        for (let k = 0; k < 2; k++) for (const v of [-2.5, 2.5]) dormer(F, v + .3, 0, sg, (w + .6) / 2, 12.8, 11, 2.4 + k * 3.4, 1.5, 1.3, S, TILE, r, true);
        const f = sg > 0 ? 'e' : 'w';
        for (const v of [-3, 0, 3]) { win(F, v, 1.8, sg * w / 2, f, .8, 1.3, r, { bars: true }); win(F, v, 4.6, sg * w / 2, f, .9, 1.4, r); win(F, v, 7.9, sg * (w / 2 + .1), f, 1, 1.4, r, { frame: false }); }
      }
      for (let y = .5; y < 6.8; y += 1.1) for (const [a1, b1] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        const q = .7 + (Math.round(y / 1.1) % 2) * .3;
        F.P('box', a1 * (w / 2 - .1), y, b1 * (sf - .1), q, .55, q, LIGHT);
      }
      F.P('box', 3.4, 19, -1.5, 1.4, 5.4, 1.4, [.34, .26, .18]); F.P('box', 3.4, 21.9, -1.5, 1.7, .3, 1.7, LIGHT);
      return { focus: [0, 0], span: 40 };
    },
  }));

  // ---------- gate towers inside the town: the Weißer Turm (round, whitewashed) and the Laufer Schlagturm (square, with a clock) ----------
  // The street runs along u through a round arch in each end.

  each('gatetower', s => ({
    labelY: 44,
    build(x, z, w, d, st, r) {
      const F = frame(), round = !s.name.includes('Lauf'), S =STONE(st, .1, round ? [.36, .28, .2] : YEL), sk = SKINS.stone;
      const pier = 3.1, ps = d / 2 - pier / 2, ph = 7.4, span = d - 2 * pier, spring = 3;
      for (const v of [-1, 1]) F.B(0, v * ps, w, pier, ph - 1, S, r, { y0: -1, skin: sk, lit: 0 });
      F.B(0, 0, w, d, 1.2, S, r, { y0: ph - 1, skin: sk, lit: 0 });
      F.L(0, 4.6, 0, .4, .5, .4, LAMP, r, .7);
      for (const e of [-1, 1]) {
        const ur = e * (w / 2 + .1);
        arch(F, ur, 0, spring, span, .9, .75, LIGHT, false);
        spandrel(F, ur, 0, spring, span, .9, S.base);
        for (const v of [-1, 1]) lantern(F, e * (w / 2 + .5), 5.2, v * (span / 2 + .8), r);
      }
      if (round) {
        F.B(0, 0, w - .4, w - .4, 18, { ...S, base: CREAM }, r, { y0: ph + .2, shape: 'cyl', skin: SKINS.plaster });
        F.B(0, 0, w + .6, w + .6, .9, S, r, { y0: ph + 17.4, shape: 'oct', skin: sk });
        for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; F.P('cone', Math.cos(a) * (w / 2 + .05), ph + 17.2, Math.sin(a) * (w / 2 + .05), .6, .8, .6, LIGHT, 0, Math.PI); }
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + .2, rr = w / 2 - .1; F.G(Math.cos(a) * rr, ph + 4 + k * 1.5, Math.sin(a) * rr, .5, 1.3, .06, WIN(r), -(a + HALF_PI)); }
        const cy = ph + 18.3;
        F.P('cone', 0, cy + 8, 0, w + 1.4, 16, w + 1.4, [.4, .14, .08]);
        F.P('cone', 0, cy + 17.4, 0, .5, 3, .5, GOLD);
        for (let k = 0; k < 4; k++) {
          const a = k * HALF_PI, rr = w * .32;
          F.B(Math.cos(a) * rr, Math.sin(a) * rr, 1.6, 1.6, 2.2, S, r, { y0: cy + 3.4, skin: sk });
          F.P('cone', Math.cos(a) * rr, cy + 6.2, Math.sin(a) * rr, 2, 1.6, 2, TILE);
          F.G(Math.cos(a) * (rr + .82), cy + 4.5, Math.sin(a) * (rr + .82), k % 2 ? .06 : .6, 1, k % 2 ? .6 : .06, WIN(r));
        }
      } else {
        F.B(0, 0, w, d, 19, S, r, { y0: ph + .2, skin: sk });
        for (const y of [ph + 5, ph + 12]) F.P('box', 0, y, 0, w + .3, .3, d + .3, LIGHT);
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          for (let y = ph + .5; y < ph + 19; y += 1.3) { const q = .8 + (Math.round(y / 1.3) % 2) * .3; F.P('box', a * (w / 2 - .1), y, b * (d / 2 - .1), q, .62, q, LIGHT); }
          F.B(a * (w / 2 + .1), b * (d / 2 + .1), 2.4, 2.4, 3.6, S, r, { y0: ph + 17, shape: 'cyl', skin: sk });
          F.P('cone', a * (w / 2 + .1), ph + 22.2, b * (d / 2 + .1), 3, 3.4, 3, COPPER);
          for (let i = 0; i < 2; i++) F.P('cone', a * (w / 2 + .1), ph + 16.4 - i * .5, b * (d / 2 + .1), 2.5 - i * .9, .6, 2.5 - i * .9, LIGHT, 0, Math.PI);
        }
        for (const e of [-1, 1]) {
          const cu = e * (w / 2 + .12);
          F.P('box', cu, ph + 14, 0, .18, 3.2, 3.2, GOLD);
          F.P('box', cu + e * .06, ph + 14, 0, .12, 2.8, 2.8, [.78, .74, .6]);
          F.G(cu + e * .1, ph + 14, 0, .05, 2.6, 2.6, [.7, .55, .25]);
          F.P('box', cu + e * .14, ph + 14.5, 0, .05, 1.1, .1, IRON); F.P('box', cu + e * .14, ph + 14.1, .5, .05, .1, 1, IRON);
          for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; F.P('box', cu + e * .13, ph + 14 + Math.sin(a) * 1.2, Math.cos(a) * 1.2, .04, .14, .14, IRON); }
          win(F, 0, ph + 8.4, cu, e > 0 ? 'e' : 'w', 1, 1.8, r, { shut: [.3, .12, .08] });
          win(F, 0, ph + 2.4, cu, e > 0 ? 'e' : 'w', .6, 1.2, r, { bars: true });
        }
        for (const v of [-1, 1]) {
          win(F, 0, ph + 7, v * (d / 2), v > 0 ? 's' : 'n', .9, 1.6, r);
          win(F, 0, ph + 13, v * (d / 2), v > 0 ? 's' : 'n', .9, 1.6, r, { shut: [.3, .12, .08] });
        }
        F.B(0, 0, w - 3.4, d - 3.4, 4.2, S, r, { y0: ph + 19.2, shape: 'oct', skin: sk });
        facets(F, 0, 0, 2.2, ph + 21.4, 2, .8, [0, HALF_PI, Math.PI, 3 * HALF_PI], r);
        F.B(0, 0, w + .6, d + .6, 11, st, r, { y0: ph + 23.4, shape: 'pyr', skin: SKINS.tile, base: [.4, .15, .08], lit: 0 });
        F.P('cone', 0, ph + 36.4, 0, .5, 3, .5, GOLD);
        F.P('box', 0, ph + 38.4, 0, .1, 1.4, .1, GOLD); F.P('box', 0, ph + 38.6, 0, .6, .1, .1, GOLD);
      }
      return { focus: [0, 0], span: 50 };
    },
  }));

  // ---------- the Schuldturm: a debtors' prison tower on a pier in the river ----------

  each('rivertower', () => ({
    labelY: 36,
    build(x, z, w, d, st, r) {
      const F = frame(), S = STONE(st, .05, [.3, .23, .16]), sk = SKINS.stone, T = { ...st, lit: .25 };
      F.B(0, 0, 6.4, 6.4, 6.5, S, r, { skin: sk, lit: 0, ry: Math.PI / 4 });
      F.B(0, 0, 8, 8, 14, S, r, { y0: 2, skin: sk });
      for (let k = 0; k < 8; k++) for (const s of [-1, 1]) { F.P('box', s * 4.1, 15.2, -3.5 + k, .4, .6, .6, LIGHT); F.P('box', -3.5 + k, 15.2, s * 4.1, .6, .6, .4, LIGHT); }
      F.B(0, 0, 9, 9, 4.4, T, r, { y0: 16, skin: SKINS.timber, base: [.42, .36, .26] });
      F.B(0, 0, 9.6, 9.6, 8.6, st, r, { y0: 20.4, shape: 'pyr', skin: SKINS.tile, base: TILE2, lit: 0 });
      F.P('cone', 0, 31.2, 0, .4, 2.4, .4, GOLD);
      for (const [f, p] of [['s', 4], ['n', -4], ['e', 4], ['w', -4]]) {
        for (const t of [-1.8, 1.8]) {
          win(F, t, 6, p, f, .45, 1.1, r, { frame: false, bars: true, rgb: [.5, .28, .1] });
          win(F, t, 11, p, f, .45, 1.1, r, { frame: false, bars: true, rgb: [.5, .28, .1] });
        }
        win(F, 0, 17.4, p + .55 * (f === 's' || f === 'e' ? 1 : -1), f, 1.3, 1.5, r, { frame: false, shut: [.3, .1, .06] });
      }
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) F.P('box', a * 4.8, 22.2, b * 4.8, .8, 1.4, .8, TIMB);
      dormer(F, 0, 0, 1, 4.8, 20.4, 8.6, 2.2, 1.5, 1.2, S, TILE2, r);
      dormer(F, 0, 0, -1, 4.8, 20.4, 8.6, 2.2, 1.5, 1.2, S, TILE2, r);
      F.L(4.3, 1.6, 0, .3, .4, .3, LAMP, r, .7);
      return { focus: [0, 0], span: 40 };
    },
  }));

  // ---------- the inns: half-timber taverns round a lit courtyard, with hanging signs ----------

  each('inn', (s, at, a) => ({
    labelY: 20,
    build(x, z, w, d, st, r) {
      const F = frame(a), post = s.name.includes('Posthorn'), SW = { ...st, lit: post ? .3 : .35 }, S = STONE(st, .2, post ? [.4, .34, .26] : [.36, .28, .2]);
      const wall = post ? OCHRE : CREAM, roof = post ? TILE : TILE2, fw = post ? 18 : 19, fd = post ? 7.4 : 6.2, fv = d / 2 - fd / 2, fy = post ? 4.2 : 3.4;

      // front block on the street

      F.B(0, fv, fw, fd, fy, S, r, { skin: SKINS.plaster });
      F.B(0, fv + .15, fw, fd + .5, 3.1, SW, r, { y0: fy, skin: SKINS.timber, base: wall });
      if (post) F.B(0, fv + .15, fw - 1, fd + .3, 2.6, SW, r, { y0: fy + 3.1, skin: SKINS.timber, base: [.46, .4, .3] });
      const ey = fy + 3.1 + (post ? 2.6 : 0), rr = post ? 7.4 : 6.6, front = fv + fd / 2;
      F.B(0, fv, fw + 1.2, fd + 1.6, rr, st, r, { y0: ey, shape: 'gable', skin: SKINS.tile, base: roof, lit: 0 });
      for (const e of [-1, 1]) F.B(e * (fw / 2 + .3), fv, .5, fd + 1, rr, SW, r, { y0: ey, shape: 'gable', skin: SKINS.timber, base: wall, ry: HALF_PI });
      F.P('box', post ? -6.2 : 5.8, ey + rr * .55, fv - 1, 1.1, rr * .8, 1.1, [.34, .26, .18]);
      for (const u of post ? [-6.6, -3.3, 3.3, 6.6] : [-6.4, -2.4, 2.4, 6.4]) {
        win(F, u, 1.3, front, 's', 1, 1.5, r, { sill: true, bars: !post, shut: post ? [.2, .3, .16] : SHUT });
        win(F, u, fy + .7, front + .3, 's', 1, 1.5, r, { shut: SHUT, frame: false });
        F.P('box', u, fy + .3, front + .5, 1.3, .22, .34, [.3, .12, .08]);
        if (post) win(F, u, fy + 3.8, front + .3, 's', .9, 1.4, r, { frame: false, shut: SHUT });
      }
      if (post) {
        F.P('box', -1.7, 2, front + .1, .5, 4, .5, LIGHT); F.P('box', 1.7, 2, front + .1, .5, 4, .5, LIGHT);
        F.P('box', 0, 4.1, front + .1, 4.2, .6, .5, LIGHT);
        F.P('box', 0, 1.9, front - .1, 3.2, 3.6, .15, DOOR);
        for (const e of [-1, 1]) dormer(F, e * 4.5, fv, 1, (fd + 1.6) / 2, ey, rr, 2.2, 1.8, 1.3, S, roof, r);
      } else {
        F.P('box', 0, 1.3, front + .08, 1.3, 2.6, .25, LIGHT); F.P('box', 0, 1.2, front + .2, .9, 2.3, .15, [.12, .07, .04]);
        for (let i = 0; i < 2; i++) F.P('box', 0, .1 + i * .12, front + .6 - i * .3, 1.8, .2, .8, LIGHT);
        dormer(F, 2.5, fv, 1, (fd + 1.6) / 2, ey, rr, 1.8, 1.7, 1.2, S, roof, r);
      }
      lantern(F, post ? 2.9 : 1.3, 3.1, front + .5, r);
      sign(F, post ? -4.4 : 3.8, fy - .1, front, 1, post ? [.75, .6, .15] : [.35, .1, .08], post ? GOLD : [.8, .65, .2]);

      // wings round a courtyard, with timber galleries on the courtyard side

      const wl = post ? 8.5 : 8.8, wy = post ? 3.6 : 3.2;
      for (const e of post ? [-1, 1] : [-1]) {
        const wu = e * (fw / 2 - 2.4), wv = fv - fd / 2 - wl / 2 + .2, ux = wu - e * 2.6, gx = ux - e * .7, f = e > 0 ? 'w' : 'e';
        F.B(wu, wv, 4.8, wl, wy, S, r, { skin: SKINS.plaster });
        F.B(wu, wv, 5.2, wl + .2, 3, SW, r, { y0: wy, skin: SKINS.timber, base: wall });
        F.B(wu, wv, wl + .8, 6.4, 5, st, r, { y0: wy + 3, shape: 'gable', skin: SKINS.tile, base: roof, lit: 0, ry: HALF_PI });
        for (let v = wv - wl / 2 + 1.6; v < wv + wl / 2 - 1; v += 2.8) {
          win(F, v, 1.2, ux, f, .9, 1.4, r, { shut: [.2, .3, .16] });
          win(F, v, wy + .6, ux, f, .9, 1.4, r, { frame: false });
        }
        F.P('box', gx, wy - .05, wv, 1.4, .14, wl - 1, TIMB);
        for (let v = wv - wl / 2 + .8; v < wv + wl / 2 - .5; v += 1.4) F.P('box', gx - e * .6, wy + .5, v, .08, 1, .08, TIMB);
        F.P('box', gx - e * .6, wy + 1, wv, .08, .08, wl - 1, TIMB);
        for (const v of [wv - wl / 2 + 1, wv + wl / 2 - 1]) F.P('box', gx - e * .6, wy / 2, v, .18, wy, .18, TIMB);
      }

      // low shed at the back

      const bv = -d / 2 + 1.6, sw = post ? 9 : 10, su = post ? 0 : 3;
      F.B(su, bv, sw, 3, 2.6, SW, r, { skin: SKINS.timber, base: wall });
      F.B(su, bv, sw + .8, 4, 2.2, st, r, { y0: 2.6, shape: 'gable', skin: SKINS.tile, base: roof, lit: 0 });

      // the courtyard: a well, tables with candles, barrels and lanterns on a warm pool of light

      const cu = post ? 0 : 3, cv = (fv - fd / 2 + bv + 1.5) / 2 + .2;
      F.G(cu, .07, cv, post ? 6 : 8, .04, 5, [.3, .17, .06]);
      F.P('cyl', cu - 2.2, .55, cv, 1.4, 1.1, 1.4, [.38, .32, .24]);
      for (const e of [-1, 1]) F.P('box', cu - 2.2 + e * .6, 1.4, cv, .1, 1.8, .1, TIMB);
      F.P('box', cu - 2.2, 2.35, cv, 1.5, .1, .7, TIMB);
      for (let i = 0; i < 3; i++) {
        const tu = cu + (post ? -.6 : .8) + i * (post ? 1.4 : 2.1), tv = cv + (i % 2 ? -1 : .6);
        F.P('box', tu, .8, tv, 1.2, .08, .8, [.3, .2, .1]); F.P('box', tu, .4, tv, .2, .8, .2, TIMB);
        F.P('box', tu, .45, tv - .7, 1.3, .1, .35, TIMB); F.P('box', tu, .45, tv + .7, 1.3, .1, .35, TIMB);
        F.L(tu, 1.05, tv, .12, .18, .12, [1.6, .8, .3], r, .6);
      }
      for (let i = 0; i < 3; i++) { F.P('cyl', cu + 3.2, .45, cv - 1.4 + i * .9, .8, .9, .8, [.3, .18, .09]); F.P('cyl', cu + 3.2, .78, cv - 1.4 + i * .9, .84, .07, .84, IRON); }
      for (const [u, v] of [[cu - 3.2, cv - 1.8], [cu + 3.2, cv + 1.8]]) { F.P('cyl', u, 1.7, v, .12, 3.4, .12, IRON); F.L(u, 3.5, v, .28, .4, .28, LAMP, r, .7); }
      return { focus: [0, 0], span: 40 };
    },
  }));

  // ---------- the quays ----------
  // Inside the walls the Pegnitz runs between stone quay walls. Every bank of every water band is walked in pieces of
  // about 5 m. A piece stands where the ground beside the water rises above it, from 1.2 m under the water's surface
  // to half a metre over the bank, with a coping on top. It stands free at the centre, so its parts take world
  // coordinates and absolute heights.

  const WALL = H.CITY.wall ?? [];
  const inWall = (x, z) => {
    let a = false;
    for (let i = 0, j = WALL.length - 1; i < WALL.length; j = i++) {
      const [xi, zi] = WALL[i], [xj, zj] = WALL[j];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) a = !a;
    }
    return a;
  };
  if (H.CITY.water?.length && WALL.length) out.nb_quays = {
    at: [0, 0], free: [40, 40],
    build(x, z, w, d, st, r) {
      const S = STONE(st, 0, RUST), COPE = [.42, .34, .24];
      for (const { poly: P } of H.CITY.water) for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < .5) continue;
        const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L, ry = Math.atan2(-tz, tx), m = Math.ceil(L / 5);
        for (let k = 0; k < m; k++) {
          const f = (k + .5) / m, px = a[0] + (b[0] - a[0]) * f, pz = a[1] + (b[1] - a[1]) * f;
          if (!inWall(px, pz)) continue;
          let nx = -tz, nz = tx;
          if (groundAt(px - nx * 7, pz - nz * 7) > groundAt(px + nx * 7, pz + nz * 7)) { nx = -nx; nz = -nz; }
          const top = Math.max(groundAt(px + nx * 6, pz + nz * 6), groundAt(px + nx * 8, pz + nz * 8));
          if (top < .5) continue;
          const cx = px + nx * 1.2, cz = pz + nz * 1.2, g0 = groundAt(cx, cz);
          bld(cx, cz, L / m + .3, 2.4, top + 1.7, S, r, opt({ y0: -1.2 - g0, skin: SKINS.blindAshlar, ry, lit: 0 }));
          prop('box', cx, top + .62 - g0, cz, L / m + .3, .25, 2.7, COPE, ry);
        }
      }
    },
  };

  return out;
}
