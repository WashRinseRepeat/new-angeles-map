// Nuremberg's churches around 1500: St. Sebald, St. Lorenz, the Frauenkirche, St. Egidien, St. Jakob and St. Klara.
// Each builds in local metres round its site's centre, x east and z south, with its west front toward -x.

import { HALF_PI, GOLD, DARK, helpers } from './common.js';

export const kits = () => ({});

// Red-brown sandstone with its weathered and dressed tones, roofs, glass and greenery.

const SST = [.36, .2, .14], OLD = [.29, .18, .13], DRESS = [.46, .34, .25], PLINTH = [.2, .13, .1], WEATHER = [.24, .16, .12];
const TILE = [.38, .15, .08], GLAZED = [.22, .1, .06], GREEN = [.1, .3, .17], YELLOW = [.55, .42, .1];
const LEAD = [.2, .21, .23], GILT = [.6, .45, .15], WOOD = [.16, .11, .06], LEAF = [.06, .14, .06];
const GLASS = [[.75, .2, .12], [.2, .28, .85], [.8, .58, .18], [.25, .6, .32], [.6, .25, .65]];
const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]], SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const OCT = Math.PI / 8, COS8 = Math.cos(OCT), D45 = Math.SQRT1_2;

// Bay centres and the marks between them, from x0 to x1 in n bays.

const bays = (x0, x1, n) => Array.from({ length: n }, (_, k) => x0 + (k + .5) * (x1 - x0) / n);
const marks = (x0, x1, n) => Array.from({ length: n + 1 }, (_, k) => x0 + k * (x1 - x0) / n);

// The parts a church is made of, for one build's style and random stream. Walls take blind ashlar, coursed stone
// without the small house windows, and roofs the tile skin.

function kit(H, st, r) {
  const { bld, prop, glow, flickerGlow, SKINS } = H;
  const S = { ...st, lit: 0, grime: .35 };
  const jit = (c, k = .12) => { const v = 1 - k + 2 * k * r(); return c.map(x => x * v); };
  const glass = () => GLASS[Math.floor(r() * GLASS.length)].map(c => c * (.42 + .16 * r()));
  const o = (y0, base, more) => ({ y0, base, skin: more?.shape === 'gable' || more?.shape === 'pyr' ? SKINS.tile : SKINS.blindAshlar, lit: 0, roof: false, kibble: false, ...more });

  const block = (x, z, w, d, h, y0 = 0, base = SST, ry = 0) => bld(x, z, w, d, h, S, r, o(y0, base, { ry }));
  const oct = (x, z, s, h, y0 = 0, base = SST) => bld(x, z, s, s, h, S, r, o(y0, base, { shape: 'oct' }));
  const drum = (x, z, s, h, y0 = 0, base = SST) => bld(x, z, s, s, h, S, r, o(y0, base, { shape: 'cyl' }));
  const roof = (x, z, len, span, h, y0, base = TILE, ry = 0) => bld(x, z, len, span, h, S, r, o(y0, base, { shape: 'gable', ry }));
  const spire = (x, z, y0, s, h, rgb = LEAD) => prop('cone', x, y0 + h / 2, z, s, h, s, jit(rgb), OCT);

  const pinnacle = (x, z, y0, h, s = .7) => {
    prop('box', x, y0 + h * .3, z, s, h * .6, s, jit(DRESS));
    prop('cone', x, y0 + h * .78, z, s * 1.25, h * .45, s * 1.25, jit(DRESS));
  };
  const finial = (x, z, y, k = 1) => {
    prop('cyl', x, y + .3 * k, z, .6 * k, .6 * k, .6 * k, GOLD);
    prop('box', x, y + 1.3 * k, z, .14 * k, 1.6 * k, .14 * k, GOLD);
    prop('box', x, y + 1.6 * k, z, .8 * k, .14 * k, .14 * k, GOLD);
  };

  // A dark opening on a wall whose outward normal is (nx, nz), at the wall point (x, z).

  const slot = (x, z, nx, nz, y0, h, wd) => prop('box', x + nx * .06, y0 + h / 2, z + nz * .06, wd, h, .16, DARK, Math.atan2(nx, nz));

  // A pointed window in a dressed surround. Its lights and head glow in coloured glass at night.

  const lancet = (x, z, nx, nz, y0, h, wd, lights = 2, rows = 1) => {
    const ry = Math.atan2(nx, nz), tx = nz, tz = -nx;
    prop('box', x + nx * .12, y0 + h / 2, z + nz * .12, wd + .7, h + .6, .24, jit(DRESS), ry);
    const head = wd * .55, body = h - head, gap = .25;
    const rh = (body - gap * (rows - 1)) / rows, lw = (wd - gap * (lights - 1)) / lights, gx = x + nx * .26, gz = z + nz * .26;
    for (let j = 0; j < rows; j++) for (let i = 0; i < lights; i++) {
      const u = -wd / 2 + lw / 2 + i * (lw + gap);
      glow(gx + tx * u, y0 + rh / 2 + j * (rh + gap), gz + tz * u, lw, rh, .06, glass(), ry);
    }
    glow(gx, y0 + body + head * .45, gz, wd * .45, head * .9, .06, glass(), ry);
  };

  // A stepped buttress standing out from the wall point (x, z), with a pinnacle of height pin on top.

  const buttress = (x, z, nx, nz, h, dep, wd = 1.5, pin = 0) => {
    const ry = Math.atan2(nx, nz), at = k => [x + nx * k, z + nz * k];
    block(...at(dep / 2), wd, dep, h * .55, 0, SST, ry);
    block(...at(dep * .3), wd * .85, dep * .6, h * .45, h * .55, SST, ry);
    if (pin) { const [px, pz] = at(dep * .3); pinnacle(px, pz, h - .2, pin, wd * .55); }
  };

  // Steps falling away from a doorway at (x, z) along (nx, nz).

  const steps = (x, z, nx, nz, w, n) => {
    for (let k = 0; k < n; k++) block(x + nx * (k + .5) * .45, z + nz * (k + .5) * .45, w, .46, (n - k) * .16, 0, DRESS, Math.atan2(nx, nz));
  };

  // A projecting portal with a pointed gable, a dark door, a lantern and steps.

  const portal = (x, z, nx, nz, wd, h) => {
    const ry = Math.atan2(nx, nz), at = k => [x + nx * k, z + nz * k];
    block(...at(.6), wd + 1.6, 1.2, h, 0, DRESS, ry);
    roof(...at(.6), 1.2, wd + 1.8, wd * .7, h, DRESS, Math.atan2(-nz, nx));
    const [dx, dz] = at(1.22), [lx, lz] = at(1.5);
    prop('box', dx, h * .33, dz, wd, h * .66, .1, DARK, ry);
    flickerGlow(lx, h * .78, lz, .3, .45, .3, [2, .9, .3], r, .7);
    steps(...at(1.2), nx, nz, wd + 1.6, 2);
  };

  // A polygonal apse: half an octagon whose side flats run on at the choir walls (z = ±half), under a hipped
  // tile roof that meets the choir's gable.

  const apse = (x, z, half, h, rh, base = TILE) => {
    const s = half * 2 / COS8;
    oct(x, z, s + .6, 1.3, 0, PLINTH);
    oct(x, z, s, h);
    spire(x, z, h, (half + .4) * 2 / COS8, rh, base);
  };

  // The apse's flats (centre and normal) and corners (corner and outward normal) on its east side.

  const flats = (x, z, half) => [0, 1, -1].map(k => [x + half * Math.cos(k * Math.PI / 4), z + half * Math.sin(k * Math.PI / 4), Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)]);
  const corners = (x, z, half) => [-3, -1, 1, 3].map(k => {
    const a = k * OCT, R = half / COS8;
    return [x + R * Math.cos(a), z + R * Math.sin(a), Math.cos(a), Math.sin(a)];
  });

  // Coloured glazed tiles laid in a lozenge lattice on both slopes of a gable roof running from x0 to x1.

  const glazed = (x0, x1, zc, span, h, y0, c = 1.5, every = 6) => {
    const L = Math.hypot(span / 2, h), a = Math.atan2(2 * h, span), ny = Math.cos(a), nz = Math.sin(a);
    for (const v of [-1, 1]) for (let j = 1; (j + 1) * c < L; j++) for (let i = 0; x0 + (i + 1) * c <= x1; i++) {
      const m = (i + j) % every, q = (i - j + every * 99) % every;
      if (m && q) continue;
      const t = (j + .5) * c / L;
      prop('box', x0 + (i + .5) * c, y0 + h * t + ny * .07, zc + v * (span / 2 * (1 - t) + nz * .07),
        c * .92, .06, c * .92, jit(!m && !q ? YELLOW : GREEN, .15), 0, v * a);
    }
  };

  // A small gabled dormer on the slope of a gable roof, a share t of the way up toward the ridge.

  const dormer = (x, zc, v, span, h, y0, t) => {
    const zs = zc + v * span / 2 * (1 - t), ys = y0 + h * t;
    block(x, zs - v * .9, 1.6, 2.4, 2.5, ys - .8, TILE);
    roof(x, zs - v * .9, 2.4, 2, 1.1, ys + 1.7, TILE, HALF_PI);
    prop('box', x, ys + .8, zs + v * .32, .8, .9, .08, DARK);
  };

  // A west tower: a square shaft with clasping corner buttresses, string courses and belfry openings, then an
  // octagonal stage behind a gallery with corner pinnacles and a pointed spire, or a pyramid helm.

  const tower = (x, z, s, h, oh, sh, { base = SST, top = 'oct', pins = true, clasp = true, courses = 4 } = {}) => {
    block(x, z, s + .8, s + .8, 1.4, 0, PLINTH);
    block(x, z, s, s, h, 0, base);
    if (clasp) for (const [cx, cz] of CORNERS) block(x + cx * s / 2, z + cz * s / 2, 1.3, 1.3, h * .7, 0, base);
    for (let k = 1; k <= courses; k++) block(x, z, s + .5, s + .5, .45, h * k / courses - .45, DRESS);
    for (const [nx, nz] of SIDES) {
      const fx = x + nx * s / 2, fz = z + nz * s / 2;
      for (const u of [-1, 1]) slot(fx + nz * u * s * .2, fz - nx * u * s * .2, nx, nz, h * .8, h * .12, s * .16);
      slot(fx, fz, nx, nz, h * .45, h * .09, s * .09);
    }
    if (top === 'pyr') { bld(x, z, s + .6, s + .6, sh, S, r, o(h, TILE, { shape: 'pyr' })); finial(x, z, h + sh, .8); return; }
    const so = s * .84, ap = so / 2 * COS8;
    block(x, z, s + .3, s + .3, 1.1, h, DRESS);
    oct(x, z, so, oh, h, base);
    if (pins) for (const [cx, cz] of CORNERS) pinnacle(x + cx * (s / 2 - .4), z + cz * (s / 2 - .4), h + 1.1, oh * .5, .7);
    for (let k = 0; k < 8; k++) {
      const nx = Math.cos(k * Math.PI / 4), nz = Math.sin(k * Math.PI / 4);
      slot(x + nx * ap, z + nz * ap, nx, nz, h + oh * .3, oh * .5, so * .2);
    }
    oct(x, z, so + .5, .6, h + oh, DRESS);
    spire(x, z, h + oh + .6, so * 1.02, sh);
    finial(x, z, h + oh + .6 + sh);
  };

  const tree = (x, z, k = 1) => {
    const h = (5 + r() * 3) * k;
    prop('cyl', x, h * .25, z, .45 * k, h * .5, .45 * k, WOOD);
    prop('cone', x, h * .55, z, 4.2 * k, h * .55, 4.2 * k, jit(LEAF, .25), r() * 6);
    prop('cone', x, h * .8, z, 3 * k, h * .45, 3 * k, jit(LEAF, .25), r() * 6);
  };
  const graves = (x0, x1, z0, z1, n) => {
    for (let k = 0; k < n; k++) {
      const gx = x0 + r() * (x1 - x0), gz = z0 + r() * (z1 - z0);
      prop('box', gx, .08, gz, .9, .16, 1.9, jit(WEATHER));
      if (r() < .6) prop('box', gx, .5, gz - .9, .7, 1, .16, jit(WEATHER));
    }
  };

  return { prop, glow, flickerGlow, jit, glass, block, oct, drum, roof, spire, pinnacle, finial, slot, lancet, buttress, steps,
    portal, apse, flats, corners, glazed, dormer, tower, tree, graves };
}

export function landmarks(H) {
  const out = {};
  const { each, slug } = helpers(H, out);

  // A basilica nave: a tall middle vessel with a clerestory over lower aisles under lean-to roofs. The aisle
  // roofs are gables centred on the clerestory walls, so their inner halves hide inside the middle vessel.

  const basilica = (K, x0, x1, n, { mid, aisle, mh, ah, rh, roofBase = TILE, cw, aw, skip = [] }) => {
    const L = x1 - x0, cx = (x0 + x1) / 2, wall = mid / 2 + aisle;
    K.block(cx, 0, L, wall * 2 + .8, 1.2, 0, PLINTH);
    K.block(cx, 0, L, mid, mh);
    for (const v of [-1, 1]) {
      K.block(cx, v * (mid / 2 + aisle / 2), L, aisle, ah);
      K.roof(cx, v * mid / 2, L, aisle * 2 + .8, ah * .45, ah);
      K.block(cx, v * (wall + .12), L, .25, .4, ah - .6, DRESS);
    }
    K.roof(cx, 0, L, mid + .8, rh, mh, roofBase);
    bays(x0, x1, n).forEach((bx, k) => {
      for (const v of [-1, 1]) {
        K.lancet(bx, v * mid / 2, 0, v, ah * 1.45 + .6, mh - ah * 1.45 - 1.6, cw, cw > 1.8 ? 2 : 1);
        if (!skip.includes(k * v)) K.lancet(bx, v * wall, 0, v, 2.5, ah - 4, aw, aw > 1.4 ? 2 : 1);
      }
    });
    return { L, cx, wall };
  };

  // ---------- St. Sebald: twin west towers round the west choir, a basilica nave, and the tall hall choir ----------

  each('sebald', () => ({
    labelY: 80,
    build(x, z, w, d, st, r) {
      const K = kit(H, st, r);

      // Twin towers, about 70 m, with octagonal belfries and pointed spires.

      for (const v of [-1, 1]) K.tower(-40, v * 8.25, 9.5, 42, 12, 16);

      // The west choir between the towers, with its polygonal apse to the west.

      K.block(-40, 0, 9.5, 7, 20);
      K.oct(-44.75, 0, 7 / COS8, 20);
      K.roof(-40, 0, 9.5, 7.8, 6, 20, GLAZED);
      K.spire(-44.75, 0, 20, 7.8 / COS8, 6, GLAZED);
      for (const k of [-1, 0, 1]) {
        const a = Math.PI + k * Math.PI / 4;
        K.lancet(-44.75 + 3.5 * Math.cos(a), 3.5 * Math.sin(a), Math.cos(a), Math.sin(a), 6, 10, 1.5, 1);
      }

      // The Romanesque nave with aisles, buttressed, under a patterned roof of glazed tiles.

      const n0 = -35.25, n1 = 6;
      const N = basilica(K, n0, n1, 8, { mid: 11, aisle: 6.5, mh: 22, ah: 10, rh: 13, roofBase: GLAZED, cw: 1.4, aw: 1.8, skip: [-4, 6] });
      K.glazed(n0, n1, 0, 11.8, 13, 22);
      for (const bx of marks(n0, n1, 8).slice(1, -1)) for (const v of [-1, 1]) K.buttress(bx, v * N.wall, 0, v, 9, 1.2, 1.1);
      const nb = bays(n0, n1, 8);
      K.portal(nb[4], -N.wall, 0, -1, 2.6, 7);
      K.portal(nb[6], N.wall, 0, 1, 2.2, 6);

      // The late-Gothic hall choir (1361-79): higher and wider than the nave, with buttresses, pinnacles and
      // tall three-light windows, under a glazed roof whose ridge rises far above the nave's.

      const c0 = 6, c1 = 33, half = 15, ch = 25;
      K.block((c0 + c1) / 2, 0, c1 - c0, half * 2 + .8, 1.3, 0, PLINTH);
      K.block((c0 + c1) / 2, 0, c1 - c0, half * 2, ch);
      K.apse(c1, 0, half, ch, 22, GLAZED);
      K.roof((c0 + c1) / 2, 0, c1 - c0, half * 2 + .8, 22, ch, GLAZED);
      K.glazed(c0, c1, 0, half * 2 + .8, 22, ch);
      const sideEnd = c1 + half * Math.tan(OCT);
      for (const v of [-1, 1]) {
        K.block((c0 + sideEnd) / 2, v * (half + .3), sideEnd - c0, .7, .9, ch - .9, DRESS);
        for (const bx of marks(c0, sideEnd, 5).slice(0, -1)) K.buttress(bx, v * half, 0, v, 24, 2, 1.6, 6);
        for (const bx of bays(c0, sideEnd, 5)) K.lancet(bx, v * half, 0, v, 3.5, 19, 3, 3, 2);
      }
      for (const [cx, cz, nx, nz] of K.corners(c1, 0, half)) K.buttress(cx, cz, nx, nz, 24, 2, 1.6, 6);
      for (const [fx, fz, nx, nz] of K.flats(c1, 0, half)) K.lancet(fx, fz, nx, nz, 3.5, 19, 3, 3, 2);

      // The churchyard: trees on the north side, graves and a tree on the south.

      for (const tx of [-29, -3]) K.tree(tx, -14.6, .7);
      K.graves(-33, -18, 13.4, 15.6, 9);
      K.tree(-10, 14.6, .7);
      return { focus: [0, 0], span: 160 };
    },
  }));

  // ---------- St. Lorenz: twin west towers, the rose window and portal, a basilica nave and the great hall choir ----------

  each('lorenz', () => ({
    labelY: 90,
    build(x, z, w, d, st, r) {
      const K = kit(H, st, r), { prop, glow, flickerGlow } = K;

      // Twin towers, about 80 m.

      for (const v of [-1, 1]) K.tower(-47.5, v * 10.5, 11, 50, 14, 17, { courses: 5 });

      // The west front between them: a pinnacled stone gable with blind tracery.

      const fx = -52;
      K.block(-47, 0, 10, 10, 34);
      K.roof(-47, 0, 10, 10, 12, 34, SST);
      for (const t of [.2, .45, .7]) for (const v of [-1, 1]) K.pinnacle(fx - .2, v * 5 * (1 - t), 33.7 + 12 * t, 3.2, .55);
      K.pinnacle(fx + .5, 0, 45.5, 5, .8);
      for (const sz of [-2.6, 0, 2.6]) {
        const hh = 12 * (1 - Math.abs(sz) / 5) - 1;
        prop('box', fx - .08, 34.2 + hh / 2, sz, .16, hh, .3, K.jit(DRESS));
      }
      glow(fx - .14, 38, -1.3, .06, 1.8, 1, K.glass());
      glow(fx - .14, 38, 1.3, .06, 1.8, 1, K.glass());

      // The rose window: tracery spokes and a rim over glass in a rough circle.

      const ry0 = 24.5;
      prop('cyl', fx - .08, ry0, 0, 9.4, .2, 9.4, K.jit(DRESS), HALF_PI, HALF_PI);
      [[7.4, 3.1], [3.1, 7.4], [5.6, 5.6]].forEach(([a, b], k) => glow(fx - .22 - k * .02, ry0, 0, .06, b, a, K.glass()));
      for (let k = 0; k < 8; k++) {
        prop('box', fx - .36, ry0, 0, .14, 7.6, .22, K.jit(DRESS), 0, k * OCT);
        const p = k * Math.PI / 4;
        prop('box', fx - .36, ry0 + 3.95 * Math.sin(p), 3.95 * Math.cos(p), .14, 3.3, .3, K.jit(DRESS), 0, -p);
      }
      prop('cyl', fx - .4, ry0, 0, 1.4, .2, 1.4, GOLD, HALF_PI, HALF_PI);
      K.block(fx - .15, 0, .3, 10, .5, 19.4, DRESS);

      // The west portal: a projecting porch with a carved tympanum, a pointed gable, tall pinnacles and steps.

      K.block(-52.8, 0, 1.6, 8.4, 12.5, 0, DRESS);
      K.roof(-52.8, 0, 1.6, 8.4, 6, 12.5, DRESS);
      prop('box', -53.65, 3.4, 0, .1, 6.8, 3.8, DARK);
      prop('box', -53.65, 8.3, 0, .1, 2.6, 2.8, K.jit(DRESS, .2));
      for (const v of [-1, 1]) K.pinnacle(-53.1, v * 4.6, 0, 19, 1);
      flickerGlow(-54, 7.4, 0, .3, .5, .3, [2, .9, .3], r, .7);
      K.steps(-53.6, 0, -1, 0, 10, 3);

      // The nave: clerestory, aisles, and flying buttresses from pinnacled piers.

      const n0 = -42, n1 = 8;
      const N = basilica(K, n0, n1, 9, { mid: 12, aisle: 7, mh: 26, ah: 12, rh: 14, cw: 2.2, aw: 2.2, skip: [4] });
      for (const bx of marks(n0, n1, 9).slice(1, -1)) for (const v of [-1, 1]) {
        K.buttress(bx, v * N.wall, 0, v, 14.5, 1.4, 1.2, 3.5);
        prop('box', bx, 17.5, v * 9.7, .5, Math.hypot(7.4, 7), .7, K.jit(DRESS), 0, Math.atan2(-v * 7.4, 7));
      }
      K.portal(bays(n0, n1, 9)[4], N.wall, 0, 1, 2.6, 7);

      // The late-Gothic hall choir (1439-77): buttresses with pinnacles, two tiers of tall windows over a
      // gallery band, and a very steep roof with rows of dormers.

      const c0 = 8, c1 = 38.5, half = 16, ch = 27, rh = 27, span = half * 2 + .8, cx = (c0 + c1) / 2;
      K.block(cx, 0, c1 - c0, span, 1.3, 0, PLINTH);
      K.block(cx, 0, c1 - c0, half * 2, ch);
      K.apse(c1, 0, half, ch, rh);
      K.roof(cx, 0, c1 - c0, span, rh, ch);
      const sideEnd = c1 + half * Math.tan(OCT);
      for (const v of [-1, 1]) {
        K.block((c0 + sideEnd) / 2, v * (half + .35), sideEnd - c0, .7, .7, 13.4, DRESS);
        K.block((c0 + sideEnd) / 2, v * (half + .25), sideEnd - c0, .5, 1.1, ch, DRESS);
        for (const bx of marks(c0, sideEnd, 6).slice(0, -1)) K.buttress(bx, v * half, 0, v, 26, 1.8, 1.6, 7);
        for (const bx of bays(c0, sideEnd, 6)) for (const y of [3, 14.6]) K.lancet(bx, v * half, 0, v, y, 10, 3.2, 3);
        for (const t of [.28, .55]) for (const dx of bays(c0 + 1, c1 - 1, 4)) K.dormer(dx + (t > .5 ? 3 : 0), 0, v, span, rh, ch, t);
      }
      for (const [bx, bz, nx, nz] of K.corners(c1, 0, half)) K.buttress(bx, bz, nx, nz, 26, 1.8, 1.6, 7);
      for (const [wx, wz, nx, nz] of K.flats(c1, 0, half)) for (const y of [3, 14.6]) K.lancet(wx, wz, nx, nz, y, 10, 3.2, 3);

      // The churchyard along the nave.

      for (const tx of [-36, -24, -4]) K.tree(tx, -15.9, .75);
      K.graves(-38, -22, 14.4, 17, 10);
      K.tree(-6, 15.9, .75);
      return { focus: [0, 0], span: 170 };
    },
  }));

  // ---------- the Frauenkirche: a hall church behind a stepped, pinnacled west gable on the market ----------

  each('frauenkirche', () => ({
    labelY: 46,
    build(x, z, w, d, st, r) {
      const K = kit(H, st, r), { prop, glow, flickerGlow } = K;

      // The hall under one steep roof, buttressed, with a roof turret on the ridge.

      K.block(-1.5, 0, 13.6, 23.4, 1.2, 0, PLINTH);
      K.block(-1.5, 0, 13, 22, 15);
      K.roof(-1.5, 0, 13, 22.8, 17, 15);
      for (const v of [-1, 1]) {
        for (const bx of marks(-8, 5, 3)) K.buttress(bx, v * 11, 0, v, 13.5, 1.4, 1.2, 4);
        for (const bx of bays(-8, 5, 3)) K.lancet(bx, v * 11, 0, v, 3, 10, 2.4, 2);
      }
      K.block(2, 0, 1.8, 1.8, 3, 30.5, LEAD);
      K.oct(2, 0, 1.6, 2.8, 33.5, WOOD);
      for (const [nx, nz] of SIDES) K.slot(2 + nx * .74, nz * .74, nx, nz, 34.1, 1.6, .5);
      K.spire(2, 0, 36.3, 1.8, 5);
      K.finial(2, 0, 41.3, .5);

      // The short choir with its polygonal end.

      K.block(6, 0, 2, 9, 13);
      K.roof(6, 0, 2, 9.8, 8, 13);
      K.apse(7, 0, 4.5, 13, 8);
      for (const [cx, cz, nx, nz] of K.corners(7, 0, 4.5)) K.buttress(cx, cz, nx, nz, 12, 1, 1, 3);
      for (const [fx, fz, nx, nz] of K.flats(7, 0, 4.5)) K.lancet(fx, fz, nx, nz, 3, 8, 1.6, 1);

      // The west gable: dressed stone in seven steps, a pinnacle at every step, blind tracery and a window.

      K.block(-8, 0, 1.2, 23.4, 15, 0, DRESS);
      const nk = 7, th = 17 / nk;
      for (let k = 0; k < nk; k++) {
        const hw = 11.7 * (1 - k / nk) - .2, y = 15 + k * th;
        K.block(-8, 0, 1.2, hw * 2, th, y, DRESS);
        for (const v of [-1, 1]) K.pinnacle(-8.2, v * (hw - .35), y + th - .1, 2.8, .5);
      }
      K.pinnacle(-8.2, 0, 31.9, 6, .8);
      K.finial(-8.2, 0, 37.6, .6);
      for (const sz of [-7.5, -4.2, 4.2, 7.5]) {
        const top = 15 + 17 * (1 - (Math.abs(sz) + .6) / 11.7);
        prop('box', -8.66, (15.5 + top) / 2, sz, .12, top - 15.5, .35, K.jit(DRESS, .2));
      }
      K.lancet(-8.6, 0, -1, 0, 23.4, 4.6, 2, 2);
      for (const v of [-1, 1]) K.lancet(-8.6, v * 7.5, -1, 0, 3, 9, 2, 2);

      // The porch with open arches, steps and a lantern.

      K.block(-10, 0, 2.8, 8, 9.5, 0, DRESS);
      prop('box', -11.42, 3.1, 0, .1, 6.2, 4.2, DARK);
      for (const v of [-1, 1]) prop('box', -10, 2.6, v * 4.02, 1.8, 5.2, .1, DARK);
      flickerGlow(-11.7, 5.4, 0, .3, .45, .3, [2, .9, .3], r, .7);
      K.steps(-11.4, 0, -1, 0, 6, 2);

      // The gilded oriel over the porch, on a corbel, with a gilt cap.

      K.oct(-11.9, 0, 2.6, 2.8, 9.6, GILT);
      prop('cone', -11.9, 8.9, 0, 2.6, 1.4, 2.6, GOLD, OCT, Math.PI);
      K.spire(-11.9, 0, 12.4, 2.9, 1.5, GOLD);
      for (const [nx, nz] of [[-1, 0], [-D45, -D45], [-D45, D45]]) glow(-11.9 + nx * 1.23, 11, nz * 1.23, .55, 1.6, .06, [1, .7, .3], Math.atan2(nx, nz));

      // The clock gable above it: the Männleinlaufen gallery of electors round the emperor, the clock, and a
      // pinnacled top.

      K.block(-9.8, 0, 2.4, 5.2, 9.5, 9.5, DRESS);
      K.roof(-9.8, 0, 2.4, 5.4, 3.5, 19, DRESS);
      for (const v of [-1, 1]) K.pinnacle(-10.8, v * 2.5, 18.9, 3, .45);
      K.pinnacle(-10.8, 0, 22.3, 3.5, .5);
      K.block(-11.3, 0, .6, 4.6, .3, 14.05, DRESS);
      for (let k = -3; k <= 3; k++) prop('box', -11.3, 14.35 + (k ? .4 : .55), k * .62, .3, k ? .8 : 1.1, .3, K.jit(GILT));
      prop('box', -11.04, 17, 0, .1, 2.8, 2.8, GOLD);
      prop('box', -11.1, 17, 0, .1, 2.3, 2.3, [.06, .08, .28]);
      glow(-11.17, 17, 0, .05, .45, .45, [1.2, .9, .4]);
      for (const a of [.6, 2.4]) prop('box', -11.2, 17 + .45 * Math.cos(a), .45 * Math.sin(a), .06, .9, .12, GOLD, 0, a);
      return { focus: [0, 0], span: 60, face: [-1, 0] };
    },
  }));

  // ---------- the smaller churches ----------

  // St. Egidien: the Romanesque basilica of the Scots monastery, with an apse and one tower by the choir.

  const egidien = {
    labelY: 50,
    build(x, z, w, d, st, r) {
      const K = kit(H, st, r);
      const n0 = -18, n1 = 10;
      const N = basilica(K, n0, n1, 6, { mid: 10, aisle: 5, mh: 16, ah: 8, rh: 9.5, cw: 1, aw: 1 });
      for (const bx of marks(n0, n1, 6)) for (const v of [-1, 1]) K.block(bx, v * (N.wall + .15), .8, .3, 7.4, 0, OLD);
      K.portal(n0, 0, -1, 0, 2.6, 6);
      K.lancet(n0, 0, -1, 0, 9.3, 4, 1.4, 1);
      K.block(14, 0, 8, 10, 13, 0, OLD);
      K.roof(14, 0, 8, 10.8, 8.5, 13);
      K.drum(18, 0, 10, 11, 0, OLD);
      K.prop('cone', 18, 13.5, 0, 10.8, 5, 10.8, K.jit(TILE), OCT);
      for (const a of [0, .87, -.87]) K.lancet(18 + 5 * Math.cos(a), 5 * Math.sin(a), Math.cos(a), Math.sin(a), 4, 3.6, 1, 1);
      K.tower(13, -8.5, 6.5, 30, 0, 11, { top: 'pyr', pins: false, clasp: false, courses: 3, base: OLD });
      for (const v of [-1, 1]) K.tree(-22, v * 6.5, .8);
      return { focus: [0, 0], span: 80 };
    },
  };

  // St. Jakob: the Gothic church of the Teutonic Order, with a slender west tower and a tall choir.

  const jakob = {
    labelY: 66,
    build(x, z, w, d, st, r) {
      const K = kit(H, st, r);
      K.tower(-19.5, 0, 6.5, 34, 7, 18);
      K.portal(-22.75, 0, -1, 0, 1.8, 4.5);
      K.block(-5.6, 0, 21.9, 16.8, 1.2, 0, PLINTH);
      K.block(-5.6, 0, 21.25, 16, 14);
      K.roof(-5.6, 0, 21.25, 16.8, 14, 14);
      for (const v of [-1, 1]) {
        for (const bx of marks(-16.25, 5, 4)) K.buttress(bx, v * 8, 0, v, 13, 1, 1.1, 3);
        for (const bx of bays(-16.25, 5, 4)) K.lancet(bx, v * 8, 0, v, 3, 9.5, 2, 2);
      }
      const sideEnd = 17 + 5.5 * Math.tan(OCT);
      K.block(11, 0, 12, 11, 18);
      K.roof(11, 0, 12, 11.8, 11, 18);
      K.apse(17, 0, 5.5, 18, 11);
      for (const v of [-1, 1]) {
        for (const bx of marks(5, sideEnd, 3).slice(1, -1)) K.buttress(bx, v * 5.5, 0, v, 17, 1.2, 1.1, 4);
        for (const bx of bays(5, sideEnd, 3)) K.lancet(bx, v * 5.5, 0, v, 4, 12, 2, 2, 2);
      }
      for (const [cx, cz, nx, nz] of K.corners(17, 0, 5.5)) K.buttress(cx, cz, nx, nz, 17, 1.2, 1.1, 4);
      for (const [fx, fz, nx, nz] of K.flats(17, 0, 5.5)) K.lancet(fx, fz, nx, nz, 4, 12, 2, 2, 2);
      return { focus: [0, 0], span: 80 };
    },
  };

  // St. Klara: a plain convent church of the Poor Clares under one roof, with a roof turret and no tower.

  const klara = {
    labelY: 38,
    build(x, z, w, d, st, r) {
      const K = kit(H, st, r);
      const sideEnd = 12 + 5.5 * Math.tan(OCT);
      K.block(-.5, 0, 25.6, 11.8, 1.2, 0, PLINTH);
      K.block(-.5, 0, 25, 11, 12);
      K.roof(-.5, 0, 25, 11.8, 11, 12);
      K.apse(12, 0, 5.5, 12, 11);
      for (const v of [-1, 1]) for (const bx of marks(-13, sideEnd, 5).slice(0, -1)) K.buttress(bx, v * 5.5, 0, v, 11, 1, 1);
      for (const [cx, cz, nx, nz] of K.corners(12, 0, 5.5)) K.buttress(cx, cz, nx, nz, 11, 1, 1);
      bays(-13, sideEnd, 5).forEach((bx, k) => {
        K.lancet(bx, 5.5, 0, 1, 3.5, 7.5, 1.8, 2);
        if (k > 2) K.lancet(bx, -5.5, 0, -1, 3.5, 7.5, 1.8, 2);
      });
      for (const [fx, fz, nx, nz] of K.flats(12, 0, 5.5)) K.lancet(fx, fz, nx, nz, 3.5, 8, 1.6, 1);
      K.portal(-13, 0, -1, 0, 2, 4.5);
      K.lancet(-13, 0, -1, 0, 7.5, 4, 1.6, 2);

      // The roof turret (Dachreiter) on the ridge.

      K.block(3, 0, 1.4, 1.4, 2.5, 22, LEAD);
      K.oct(3, 0, 1.3, 2.6, 24.5, WOOD);
      for (const [nx, nz] of SIDES) K.slot(3 + nx * .6, nz * .6, nx, nz, 25, 1.5, .4);
      K.spire(3, 0, 27.1, 1.5, 4.5);
      K.finial(3, 0, 31.6, .45);
      K.tree(-16, 4.8, .7);
      K.tree(-16, -4.8, .6);
      return { focus: [0, 0], span: 70 };
    },
  };

  const SMALL = { 'st-egidien': egidien, 'st-jakob': jakob, 'st-klara': klara };
  each('church', s => SMALL[slug(s)] ?? jakob);
  return out;
}
