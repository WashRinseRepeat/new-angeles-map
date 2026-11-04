// Burg Himmelsfels on the summit of the Rebenberg: a romantic castle of pale limestone under blue-grey slate. The
// core stands on the summit platform round an inner court: the palas over the south face, a slender round keep, a
// chapel, two wings and towers of several shapes. An outer curtain with towers steps down the falling ground, a
// bastion stands out on the east spur, a tall tower on its plinth guards the south-west slope, and a gatehouse and
// barbican meet the Burgweg on the south side. Flags fly from the towers and smoke rises from the palas chimney.
// Every height here is absolute, so each part subtracts the ground under its own spot.

import { HALF_PI, RED, GOLD, DARK, WOOD, helpers } from './common.js';
import { groundAt } from '../../../engine/relief.js';

export const kits = () => ({});

const LIME = [.48, .45, .39], LIME_D = [.5, .47, .4], LIME_P = [.72, .68, .58], PLASTER = [.56, .53, .46], BLUE = [.15, .17, .21];
const WARM = [1.6, .85, .35].map(c => c * .32), TORCH = [2, .9, .3];
const BANNERS = [[[.5, .06, .05], [.62, .6, .55]], [[.08, .12, .38], [.6, .46, .14]], [[.5, .06, .05], [.6, .46, .14]]];
const q15 = y => Math.round(y / 1.5) * 1.5;

function castle(H, s, at, a, st, r) {
  const { bld, prop, glow, flickerGlow, SKINS } = H;
  const { opt, STONE, pick3 } = helpers(H, {});
  const ry0 = -a, [cx, cz] = s.at, PLAIN = SKINS.blindAshlar;
  const G = (u, v) => { const [px, pz] = at(u, v); return groundAt(cx + px, cz + pz); };
  const L = G(0, 0);
  const S0 = STONE(st, 0, LIME), S1 = STONE(st, .3, LIME), SD = STONE(st, 0, [.43, .4, .34]), SP = STONE(st, .3, PLASTER);

  // A point al along and ac across a part turned dry from the site's axes, and the lowest ground round a rectangle
  // grown by 3 m, so footings reach below the falling ground beside them.

  const off = (u, v, al, ac, dry = 0) => [u + al * Math.cos(dry) + ac * Math.sin(dry), v - al * Math.sin(dry) + ac * Math.cos(dry)];
  const low = (u, v, w, d, dry = 0) => {
    let m = G(u, v);
    for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) m = Math.min(m, G(...off(u, v, i * (w / 2 + 3), j * (d / 2 + 3), dry)));
    return m;
  };

  // A body with its floor at absolute Y, a footing from below the ground up to absolute Y, a prop centred at
  // absolute Y, a glow and a torch.

  const B = (u, v, w, d, Y, h, o = {}) => {
    const [px, pz] = at(u, v), S = o.S ?? S0;
    bld(px, pz, w, d, h, S, r, opt({ skin: SKINS.ashlar, lit: S.lit, ...o, ry: ry0 + (o.dry ?? 0), y0: Y - G(u, v) }));
  };
  const F = (u, v, w, d, Y, o = {}) => { const b = low(u, v, w, d, o.dry) - 1.5; if (Y - b > .3) B(u, v, w, d, b, Y - b, { skin: PLAIN, S: SD, ...o }); };
  const P = (kind, u, Y, v, sx, sy, sz, rgb, dry = 0, rx = 0) => { const [px, pz] = at(u, v); prop(kind, px, Y - G(u, v), pz, sx, sy, sz, rgb, ry0 + dry, rx); };
  const W = (u, Y, v, sx, sy, sz, rgb, dry = 0) => { const [px, pz] = at(u, v); glow(px, Y - G(u, v), pz, sx, sy, sz, rgb, ry0 + dry); };
  const torch = (u, Y, v) => { const [px, pz] = at(u, v); flickerGlow(px, Y - G(u, v), pz, .35, .5, .35, TORCH, r, .7); };

  // Flag poles. The cloths are one animated mesh, made after the build.

  const flags = [];
  const flag = (u, Y, v, k = 1) => { P('cyl', u, Y + 2.5 * k, v, .14 * k, 5 * k, .14 * k, WOOD); flags.push([u, Y + 5 * k - .1, v, k]); };

  // A cone roof over a round or eight-sided shaft, with an eaves band, and a flag or a gilt finial on top.

  const cap = (u, v, dia, Y, h, rgb = BLUE, fl = 0) => {
    P('cyl', u, Y + .3, v, dia + .7, .6, dia + .7, LIME_D, Math.PI / 8);
    P('cone', u, Y + .6 + h / 2, v, dia + 1.1, h, dia + 1.1, rgb, Math.PI / 8);
    if (fl) flag(u, Y + h, v, fl); else P('box', u, Y + .6 + h + .9, v, .18, 1.8, .18, GOLD);
  };

  // A round or eight-sided tower on its footing, and a square tower with a slate pyramid and corner turrets.

  const roundT = (u, v, dia, Y, h, roofH, o = {}) => {
    const shape = o.shape ?? 'cyl';
    F(u, v, dia * 1.14, dia * 1.14, Y + 1, { shape });
    B(u, v, dia, dia, Y, h, { shape, S: o.S ?? S1 });
    P('cyl', u, Y + h - .7, v, dia + .5, 1.4, dia + .5, LIME_D, Math.PI / 8);
    cap(u, v, dia, Y + h, roofH, o.rgb, o.flag);
  };
  const turret = (u, v, dia, Y, h, roofH, rgb = RED) => {
    P('cone', u, Y - .7, v, dia, 1.4, dia, LIME_D, 0, Math.PI);
    P('cyl', u, Y + h / 2, v, dia, h, dia, LIME_P);
    cap(u, v, dia - .4, Y + h, roofH, rgb);
  };
  const squareT = (u, v, side, Y, h, roofH, o = {}) => {
    F(u, v, side * 1.12, side * 1.12, Y + 1);
    B(u, v, side, side, Y, h, { S: o.S ?? S1 });
    P('box', u, Y + h - .6, v, side + .6, 1.2, side + .6, LIME_D);
    B(u, v, side + .8, side + .8, Y + h, roofH, { shape: 'pyr', skin: SKINS.slate, base: o.rgb ?? BLUE });
    if (o.corners) for (const [i, j] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) turret(u + i * side / 2, v + j * side / 2, 2.6, Y + h - 6, 6, 4.5);
    if (o.flag) flag(u, Y + h + roofH - .3, v, o.flag);
  };

  // A wing: a body under a steep roof whose ridge runs along it, with stepped gables, rows of dormers and lit window
  // rows on the faces it names. open leaves out the footing, for a hall over a passage.

  const wing = (u, v, len, dep, Y, h, roofH, o = {}) => {
    const dry = o.dry ?? 0, roofSkin = o.tile ? SKINS.tiles : SKINS.slate, roofRgb = o.tile ? RED : BLUE;
    if (!o.open) F(u, v, len, dep, Y + .8, { dry });
    B(u, v, len, dep, Y, h, { S: o.S ?? S1, skin: o.skin ?? SKINS.ashlar, dry });
    B(u, v, len + .6, dep + 1, Y + h, roofH, { shape: 'gable', skin: roofSkin, base: roofRgb, dry });
    if (o.steps) for (const e of [-1, 1]) {
      const [gu, gv] = off(u, v, e * (len / 2 + .15), 0, dry);
      for (let k = 0; k < 5; k++) B(gu, gv, .9, (dep + 1.2) * (1 - k / 5), Y + h + k * roofH / 5, roofH / 5 + .6, { skin: PLAIN, dry });
      P('box', gu, Y + h + roofH + 1.4, gv, .5, 1.6, .5, LIME_D, dry);
    }
    for (const [side, fs] of o.dorm ?? []) fs.forEach((f, k) => {
      for (let al = -len / 2 + 4 + k * 2.5; al <= len / 2 - 4; al += 5.5) {
        const [du, dv] = off(u, v, al, side * (dep / 2 + .5) * (1 - f), dry), sc = 1 - .25 * k;
        B(du, dv, 2.2 * sc, 1.9 * sc, Y + h + roofH * f - 1.2 * sc, 1.9 * sc, { shape: 'gable', skin: roofSkin, base: roofRgb, dry: dry + HALF_PI });
      }
    });
    for (const [side, rows] of o.faces ?? []) for (const y of rows) for (let al = -len / 2 + 3; al <= len / 2 - 3; al += o.step ?? 4.5) {
      const [wu, wv] = off(u, v, al, side * (dep / 2 + .04), dry), [gu, gv] = off(u, v, al, side * (dep / 2 + .09), dry);
      P('box', wu, Y + y, wv, 1.5, o.tall ?? 2.6, .1, DARK, dry);
      W(gu, Y + y - .1, gv, 1.2, (o.tall ?? 2.6) - .4, .06, o.glass ? pick3(r).map(c => c * .4) : WARM, dry);
    }
  };

  // A curtain along a path, cut into pieces of at most 6 m. Each piece's top is level, stepping by 1.5 m with the
  // ground (or running from top0 to top1), and its footing goes below the falling ground. skip leaves gaps.

  const curtain = (path, { rise = 8, top0, top1, th = 2.4, skip = () => false } = {}) => {
    let run = 0;
    const total = path.slice(1).reduce((t, p, i) => t + Math.hypot(p[0] - path[i][0], p[1] - path[i][1]), 0);
    path.slice(1).forEach((q, i) => {
      const p = path[i], du = q[0] - p[0], dv = q[1] - p[1], len = Math.hypot(du, dv), n = Math.ceil(len / 6), dry = Math.atan2(-dv, du);
      for (let k = 0; k < n; k++) {
        const f = (k + .5) / n, u = p[0] + du * f, v = p[1] + dv * f, pl = len / n;
        if (skip(u, v)) continue;
        const top = q15(top0 != null ? top0 + (top1 - top0) * (run + pl * (k + .5)) / total : G(u, v) + rise);
        F(u, v, pl + .3, th, top, { dry });
        for (const e of [-.25, .25]) { const [mu, mv] = off(u, v, e * pl, 0, dry); P('box', mu, top + .7, mv, 1.5, 1.4, th, LIME_D, dry); }
      }
      run += len;
    });
  };

  // ---------- the core on the summit ----------
  // The palas stands over the south face, its outer wall on the curtain line, with three rows of hall windows
  // towards the city, oriel turrets at its corners and an eight-sided stair tower on its court side.

  wing(-22, 32.5, 48, 15, L, 22, 16, { steps: true, faces: [[1, [5, 11.5, 18]], [-1, [11.5, 18]]], dorm: [[1, [.25, .58]], [-1, [.3]]], tall: 3.4 });
  for (const tu of [-46.6, 2.6]) turret(tu, 40.6, 3.6, L + 13, 12, 6);
  roundT(-10, 23, 6.2, L, 33, 10, { shape: 'oct', rgb: BLUE });
  P('box', -30, L + 30, 29, 1.6, 14, 1.6, LIME_D);
  const SMOKE = [-30, 37.5, 29];

  // The keep: a slender round shaft, a gallery on corbels with merlons, a lit upper stage and a tall slate spire.

  const KU = -30, KV = -8;
  F(KU, KV, 11, 11, L + 1, { shape: 'cyl' });
  B(KU, KV, 9.6, 9.6, L, 46, { shape: 'cyl', skin: PLAIN });
  for (const y of [14, 24, 34]) P('box', KU, L + y, KV + 4.82, .4, 1.4, .2, DARK);
  P('cone', KU, L + 45, KV, 12.6, 2, 12.6, LIME_D, 0, Math.PI);
  P('cyl', KU, L + 46.4, KV, 12.6, .8, 12.6, LIME_D);
  for (let k = 0; k < 14; k++) {
    const t = k / 14 * 2 * Math.PI;
    P('box', KU + 5.9 * Math.cos(t), L + 47.5, KV + 5.9 * Math.sin(t), 1.3, 1.6, .6, LIME_P, -t + HALF_PI);
  }
  B(KU, KV, 7.6, 7.6, L + 46.8, 10, { shape: 'cyl', S: S1 });
  for (let k = 0; k < 6; k++) {
    const t = k / 6 * 2 * Math.PI + .3;
    W(KU + 3.85 * Math.cos(t), L + 51.5, KV + 3.85 * Math.sin(t), 1, 2.2, .06, WARM, -t + HALF_PI);
  }
  cap(KU, KV, 7.6, L + 56.8, 17, BLUE, 1.5);
  turret(KU + 4.6, KV - 4.6, 2.2, L + 47, 5, 3.5, BLUE);

  // The wings round the court: a plastered north wing with dormers and a stone west wing.

  wing(10, -32, 58, 12, L, 15, 11, { S: SP, skin: SKINS.quoins, steps: true, faces: [[1, [5, 10.5]]], dorm: [[1, [.3]], [-1, [.3]]] });
  wing(-48, -10, 40, 11, L, 16, 11, { dry: HALF_PI, faces: [[1, [6, 11.5]], [-1, [6, 11.5]]], dorm: [[1, [.3]]] });

  // The chapel: a nave under a red roof with tall coloured windows, a round apse and a gilt ridge turret.

  wing(26, -8, 22, 11, L, 14, 9, { tile: true, faces: [[1, [6.5]], [-1, [6.5]]], step: 4, tall: 6.5, glass: true });
  B(37, -8, 10, 10, L, 12, { shape: 'cyl', S: S0 });
  P('cone', 37, L + 15.2, -8, 11, 6.4, 11, RED);
  P('cyl', 21, L + 24.5, -8, 1.8, 3.5, 1.8, LIME_P, Math.PI / 8);
  P('cone', 21, L + 29.5, -8, 2.2, 6.5, 2.2, GOLD, Math.PI / 8);

  // Towers on the inner curtain: the gate tower, a red-roofed round tower, a square tower with corner turrets and a
  // round tower at the north-west corner.

  squareT(10, 35.5, 10, L, 25, 12, { flag: 1 });
  P('box', 10, L + 2.3, 40.6, 3.6, 4.6, .3, DARK);
  for (const e of [-1, 1]) torch(10 + e * 2.8, L + 3.5, 41);
  roundT(50, 36, 11, L, 25, 13, { rgb: RED });
  squareT(55, -36, 12, L, 30, 12, { corners: true, flag: 1.1 });
  roundT(-56, -37, 10, L, 23, 11);

  // The inner curtain, crenellated, round the platform's edge.

  const inRect = (u, v, u0, u1, v0, v1) => u > u0 && u < u1 && v > v0 && v < v1;
  const coreSkip = (u, v) => inRect(u, v, -47, 3, 24, 42) || inRect(u, v, 4, 16, 29, 42) || Math.hypot(u - 50, v - 36) < 6.5
    || inRect(u, v, 48, 62, -43, -29) || Math.hypot(u + 56, v + 37) < 6;
  curtain([[-61, 30], [-61, -42], [61, -42], [61, 30], [48, 40], [3, 40]], { top0: L + 11, top1: L + 11, skip: coreSkip });
  curtain([[-47, 40], [-61, 30]], { top0: L + 11, top1: L + 11 });

  // The court's well and its linden.

  P('cyl', 14, L + .5, 12, 2.6, 1, 2.6, LIME_D);
  for (const e of [-1, 1]) P('box', 14 + e * 1.1, L + 2, 12, .2, 2.6, .2, WOOD);
  P('box', 14, L + 3.4, 12, 3, .3, 1.2, RED);
  P('cyl', 32, L + 1.8, 16, .6, 3.6, .6, WOOD);
  P('cyl', 32, L + 6, 16, 7, 5, 7, [.07, .15, .06]);
  P('cyl', 32, L + 6.4, 16, 5.4, 6.4, 5.4, [.08, .16, .06], .7, HALF_PI);

  // ---------- down the slopes ----------
  // The east bastion on the spur: a terrace 6 m below the court on a footing 20 m tall, buttressed down to the
  // falling ground, with an eight-sided belvedere and a garden hall on it. A cross wall steps down to it.

  const BY = L - 6;
  F(132, 5, 28, 36, BY);
  for (let v = -10; v <= 20; v += 7.5) {
    F(147.4, v, 2.8, 2.6, BY - 2.5);
    F(149.6, v, 2, 3.4, BY - 10);
  }
  for (const [u0, v0, u1, v1] of [[118, -13, 146, -13], [146, -13, 146, 23], [146, 23, 118, 23]]) {
    const n = Math.round(Math.hypot(u1 - u0, v1 - v0) / 3.5);
    for (let k = 0; k <= n; k++) P('box', u0 + (u1 - u0) * k / n, BY + .6, v0 + (v1 - v0) * k / n, 1.4, 1.2, 1.4, LIME_D);
  }
  roundT(138, 5, 10, BY, 17, 10, { shape: 'oct', flag: 1 });
  wing(124, 5, 16, 9, BY, 7, 6, { dry: HALF_PI, tile: true, faces: [[1, [3.5]], [-1, [3.5]]], step: 3.5 });
  curtain([[61, 4], [118, 4]], { top0: L + 10, top1: BY + 2, th: 2.2 });

  // The tower on the south-west slope: a battered plinth up to the court's level, then three lit storeys with
  // corner oriels and a steep slate roof.

  const PU = -100, PV = 76;
  F(PU, PV, 15, 15, L - 9);
  F(PU, PV, 12.6, 12.6, L);
  for (const e of [-1, 1]) F(PU + e * 8, PV + 8.6, 2.6, 2.6, L - 12);
  squareT(PU, PV, 11, L, 20, 13, { corners: true, flag: 1 });

  // The outer curtain with its towers. It runs out round the core on the falling ground, meets the bastion on the
  // east, the plinth tower on the south-west and the gatehouse on the south.

  const RING = [[14, 58], [34, 60], [62, 54], [84, 34], [118, 22], [118, -12], [88, -40], [60, -62], [20, -70], [-25, -70],
    [-62, -60], [-86, -36], [-92, 0], [-90, 36], [-100, 76], [-60, 70], [-26, 68], [0, 58]];
  const RT = [[62, 54, 7.5], [88, -40, 8], [-62, -60, 8], [-92, 0, 7], [-26, 68, 7], [20, -70, 0]];
  const ringSkip = (u, v) => RT.some(([tu, tv, dia]) => Math.hypot(u - tu, v - tv) < (dia || 9) / 2 + .5)
    || inRect(u, v, PU - 8, PU + 8, PV - 8, PV + 8) || inRect(u, v, 117, 147, -14, 24);
  curtain(RING, { skip: ringSkip });
  RT.forEach(([u, v, dia], k) => {
    const Y = q15(G(u, v) + 9);
    if (dia) roundT(u, v, dia, Y, 8 + 3 * (k % 2), 6 + k % 3, { S: S0, rgb: k % 2 ? RED : BLUE });
    else squareT(u, v, 9, Y, 9, 8, { S: S0 });
  });

  // The gatehouse where the Burgweg arrives: twin round towers, a passage under a stepped-gable gate hall, and the
  // drawbridge lowered onto the road on its chains.

  const GU = 7, GV = 58, GY = q15(G(GU, GV));
  for (const e of [-1, 1]) roundT(GU + e * 7, GV, 7, GY, 15, 8, { flag: e > 0 ? .8 : 0 });
  for (const e of [-1, 1]) F(GU + e * 2.9, GV, 1.8, 9, GY + 6);
  wing(GU, GV, 8, 9.6, GY + 6, 8, 7, { tile: true, steps: true, open: true, faces: [[1, [4]]], step: 2.5 });
  for (const e of [-1, 1]) torch(GU + e * 2.6, GY + 3.4, GV + 5);
  const D0 = GV + 5, D1 = GV + 11.5, dy = G(GU, D0) - G(GU, D1);
  P('box', GU, (G(GU, D0) + G(GU, D1)) / 2 + .3, (D0 + D1) / 2, 3.8, .35, D1 - D0, WOOD, 0, Math.atan2(dy, D1 - D0));
  for (const e of [-1, 1]) {
    const yt = GY + 6, yb = G(GU, D1) + .4, len = Math.hypot(D1 - D0, yt - yb);
    P('box', GU + e * 1.7, (yt + yb) / 2, (D0 + D1) / 2, .1, len, .1, DARK, 0, Math.atan2(-(D1 - D0), yt - yb));
  }

  // The barbican on the ramp below: two small towers and an arch over the road, walled back to the gatehouse.

  const AU = 9, AV = 86, AY = q15(G(AU, AV));
  for (const e of [-1, 1]) squareT(AU + e * 6.5, AV, 5, AY, 9, 4.5, { S: S0, rgb: RED });
  B(AU, AV, 8, 4, AY + 5.5, 3.5, { skin: PLAIN });
  curtain([[AU - 6.5, AV - 3], [GU - 7, GV + 4]], { rise: 6, th: 1.8 });
  curtain([[AU + 6.5, AV - 3], [GU + 7, GV + 4]], { rise: 6, th: 1.8 });
  torch(AU, AY + 6, AV + 2.4);

  return { flags, smoke: SMOKE, L };
}

// The flags as one mesh whose cloths ripple in the wind from the west, and the palas chimney's smoke as a few
// soft puffs rising and drifting east. Returns the update hook.

function life(H, at, { flags, smoke, L }) {
  const T = H.THREE, NX = 8, NY = 3, nv = (NX + 1) * (NY + 1);
  const pos = new Float32Array(flags.length * nv * 3), col = new Float32Array(flags.length * nv * 3), idx = [];
  flags.forEach(([u, Y, v, k], f) => {
    const [c0, c1] = BANNERS[f % BANNERS.length];
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) col.set(j < NY / 2 + .5 ? c0 : c1, (f * nv + j * (NX + 1) + i) * 3);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const o = f * nv + j * (NX + 1) + i;
      idx.push(o, o + NX + 1, o + 1, o + 1, o + NX + 1, o + NX + 2);
    }
  });
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  geo.setAttribute('color', new T.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const cloth = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: .9, side: T.DoubleSide }));
  cloth.frustumCulled = false;
  const roots = flags.map(([u, Y, v, k]) => { const [px, pz] = at(u, v); return [px, Y - L, pz, k]; });
  const wave = t => {
    roots.forEach(([x, y, z, k], f) => {
      const len = 3.4 * k, hgt = 2 * k, ph = f * 1.7;
      for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
        const sv = i / NX, o = (f * nv + j * (NX + 1) + i) * 3, w = Math.sin(5.5 * sv - 3.4 * t + ph);
        pos[o] = x + len * sv * (1 - .06 * w * w);
        pos[o + 1] = y - hgt * j / NY - .25 * k * sv * sv;
        pos[o + 2] = z + .45 * k * sv * w;
      }
    });
    geo.attributes.position.needsUpdate = true;
  };
  wave(0);
  geo.computeVertexNormals();

  const N = 7, puffs = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1),
    H.soften(new T.MeshBasicMaterial({ color: new T.Color(.15, .145, .14), transparent: true, opacity: .2, depthWrite: false })), N);
  puffs.frustumCulled = false;
  const [sx, sz] = at(smoke[0], smoke[2]), o3 = new T.Object3D();
  H.decor.add(cloth, puffs);
  return t => {
    wave(t);
    for (let j = 0; j < N; j++) {
      const age = ((t * .09 + j / N) % 1 + 1) % 1, sc = (.7 + 3.4 * age) * Math.min(1, (1 - age) * 3, age * 8);
      o3.position.set(sx + 9 * age * age + .6 * Math.sin(j * 2.3), smoke[1] + 14 * age, sz + 2 * age);
      o3.scale.setScalar(sc);
      o3.updateMatrix();
      puffs.setMatrixAt(j, o3.matrix);
    }
    puffs.instanceMatrix.needsUpdate = true;
  };
}

export function landmarks(H) {
  const out = {};
  const { each } = helpers(H, out);
  each('hillcastle', (s, at, a) => {
    let tick = null;
    return {
      labelY: 84,
      build(x, z, w, d, st, r) {
        tick = life(H, at, castle(H, s, at, a, st, r));
        return { focus: [10, 10], span: 320, face: [0, 1] };
      },
      update(t) { tick?.(t); },
    };
  });
  return out;
}
