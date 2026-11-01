// Laguna Velasco, the Government District: civic glass on wide lawns, villas and mansions by the lake, a brick campus.
// Kit signature: (x, z, s, st, b, r) in the lot frame. Kits read H.frame() and fall back to an s × s square.
// On the city map every lot kit reroutes by sub-area and lot size. Most lots are 8-16 m wide, so small lots get
// compact models: modern villas in Lakeside, terraced homes and slim towers Downtown, brick halls at Levy.
// A low-frequency noise field turns clusters of lots into gardens, so parks read as parks, not gaps.

import { trees } from './nature.js';

let LIB = null;

function lib(H) {
  if (LIB) return LIB;
  const { GLOWS, SKINS, bld, glow, prop, put, pool, beam, textSign, stringLights, helipad, beacon, grammarTowerBody, flickerGlow } = H;

  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const dim = (c, k) => c.map(v => v * k);

  // Palette: pale stone, white glass, terracotta, dark lawns and water. Few signs, one warm orange for lamps.

  const LAWN = [.022, .055, .028], VINE = [.02, .06, .025], HEDGE = [.012, .034, .016], WATER = [.008, .02, .034], DECK = [.08, .08, .085];
  const STONE = [.2, .19, .17], WOOD = [.12, .075, .045], TILE = [.2, .07, .035], CREAM = [.21, .19, .15];
  const BRICK = [.19, .08, .05], GRANITE = [.07, .07, .075], SILVER = [.3, .32, .35], WHITE = [.24, .25, .27];
  const WARM = [1, .78, .5], ORANGE = [1.25, .72, .36], TEAL = [.3, 1.2, 1.4], GOLD = [1.3, 1.1, .7], ROSE = [1.2, .5, .9];
  const COLD = [1.3, 1.45, 1.6], POLICE = [.5, .8, 1.8];
  const GARDEN = [.03, .075, .035], PLANT = [.03, .09, .04], PATH = [.11, .1, .09], RENDER = [.27, .27, .26], POOLW = [.08, .5, .6];
  const IVORY = [.28, .26, .22], ESTLAWN = [.035, .09, .04], GRAVEL = [.15, .14, .12], ROOF = [.3, .12, .06];

  const dims = (s, cap = 120) => { const f = H.frame(); return f?.w ? [Math.min(f.w - 2, cap), Math.min(f.d - 2, cap)] : [s, s]; };
  const front = () => { const f = H.frame()?.front; return f ? [f.x, f.z] : [0, 1]; };

  // Street-relative axes: u runs along the street, v points toward it. at() and sz() map back to the lot frame.

  const axesOf = (x, z, W, D, [fx, fz]) => fz
    ? { L: W, S: D, at: (u, v) => [x + u, z + v * fz], sz: (a, c) => [a, c] }
    : { L: D, S: W, at: (u, v) => [x + v * fx, z + u], sz: (a, c) => [c, a] };
  const boxIn = A => (kind, u, v, lu, lv, y, h, rgb) => { const [px, pz] = A.at(u, v), [w, d] = A.sz(lu, lv); return prop(kind, px, y + h / 2, pz, w, h, d, rgb); };
  const glowIn = A => (u, v, lu, lv, y, h, rgb) => { const [px, pz] = A.at(u, v), [w, d] = A.sz(lu, lv); return glow(px, y + h / 2, pz, w, h, d, rgb); };
  const p3 = (A, u, y, v) => { const [px, pz] = A.at(u, v); return [px, y, pz]; };

  // Sub-area under a point. Outside the canon circles: Levy to the north-west, Downtown south-west of the lake, Lakeside elsewhere.

  const area = (x, z) => {
    const a = H.subareaAt(x, z);
    if (a) return a;
    const u = x / 3.6 + 680, v = z / 3.6 + 390;
    return u < 545 ? 'Levy University' : v > 895 && u < 702 ? 'Downtown' : 'Lakeside';
  };

  const lawn = (x, z, w, d, y = 0, rgb = LAWN) => prop('box', x, y + .17, z, w, .2, d, rgb);

  // Smooth value noise in [0, 1). Lots above PARK_T on the park field become gardens.

  const vnoise = (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), u = H.smooth(0, 1, x - xi), v = H.smooth(0, 1, z - zi), h = (a, b) => H.hash(a, b) / 4294967296;
    return H.lerp(H.lerp(h(xi, zi), h(xi + 1, zi), u), H.lerp(h(xi, zi + 1), h(xi + 1, zi + 1), u), v);
  };
  const PARK_T = .74;
  const parkField = (x, z) => vnoise(x / 170 + 31, z / 170 + 17);

  // Nearest shore point in the lot frame, or null when no water lies within R metres (default 40).

  const WATERS = (H.CITY.water ?? []).map(w => w.poly);
  const shore = (x, z, R = 40) => {
    if (!H.frame()) return null;
    const [wx, wz] = H.worldOf(x, z);
    let best = null, bd = R;
    for (const P of WATERS) for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [ax, az] = P[j], ex = P[i][0] - ax, ez = P[i][1] - az;
      const t = Math.max(0, Math.min(1, ((wx - ax) * ex + (wz - az) * ez) / (ex * ex + ez * ez)));
      const px = ax + ex * t, pz = az + ez * t, dd = Math.hypot(wx - px, wz - pz);
      if (dd < bd) { bd = dd; best = [px, pz]; }
    }
    return best && H.toLocal(...best);
  };
  const lamp = (x, z, h = 4.5, y = 0) => {
    prop('cyl', x, y + h / 2, z, .18, h, .18, [.05, .05, .05]);
    glow(x, y + h + .1, z, .5, .3, .5, ORANGE);
    if (!y) pool(x, z, 5, [.1, .06, .03]);
  };
  const tree = (x, y, z, h, r, kind) => {
    const T = trees(), k = kind ?? pick(r, ['broad', 'broad', 'palm', 'cypress']);
    if (!T) { prop('cone', x, y + h * .6, z, h * .5, h * .8, h * .5, HEDGE); return; }
    const m = T[k], v = 1.3 + r();
    put(m, x, y, z, h * .85, h, h * .85, r() * 6.3, 0, [.02 * v, .06 * v, .04 * v]);
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  };

  // A moored sailboat: hull, cabin light, mast and a masthead lamp.

  const boat = (x, z, alongX, len, r) => {
    const [w, d] = alongX ? [len, len * .32] : [len * .32, len];
    prop('box', x, .55, z, w, .9, d, [.24, .24, .26]);
    glow(x, 1.2, z, w * .4, .4, d * .4, dim(WARM, .45));
    prop('cyl', x, 1 + len * .6, z, .15, len * 1.2, .15, [.15, .15, .16]);
    glow(x, 1.2 + len * 1.2, z, .3, .3, .3, r() < .5 ? [1.6, .25, .15] : [1.4, 1.4, 1.3]);
  };

  // Private dock: a lot whose edge lies within 9 m of the water gets a jetty, an end lamp and a moored boat.

  const dock = (x, z, W, D, r) => {
    const p = shore(x, z);
    if (!p) return;
    const X = p[0] - x, Z = p[1] - z, ax = Math.abs(X) / W > Math.abs(Z) / D;
    const half = (ax ? W : D) / 2, gap = Math.abs(ax ? X : Z) - half, sg = Math.sign(ax ? X : Z) || 1;
    if (gap > 9) return;
    const len = Math.max(0, gap) + 7, o = (r() - .5) * (ax ? D : W) * .4, at = t => ax ? [x + sg * t, z + o] : [x + o, z + sg * t];
    const [jx, jz] = at(half + len / 2 - 1), [ex, ez] = at(half + len - 1.5);
    prop('box', jx, .45, jz, ax ? len : 2.2, .25, ax ? 2.2 : len, WOOD);
    glow(ex, 1.6, ez, .3, .3, .3, ORANGE);
    boat(ax ? ex - sg * 2 : ex + 3, ax ? ez + 3 : ez - sg * 2, ax, 7 + r() * 3, r);
  };

  // A lit swimming pool: a turquoise water box and its glow on the ground.

  const swim = (x, y, z, w, d) => {
    glow(x, y + .12, z, w, .12, d, POOLW);
    if (!y) pool(x, z, Math.max(w, d) * .7, [.02, .09, .11]);
  };

  // Hip roof in terracotta over a wing.

  const hip = (x, z, w, d, y, st, r, c = TILE) => bld(x, z, w + 1, d + 1, Math.min(w, d) * .3, { ...st, base: dim(c, .8 + .4 * r()) }, r, { y0: y, shape: 'pyr', lit: 0, roof: false });

  // ---------- reusable builders: mansion, villa, campus ----------

  // Spanish Colonial mansion: a U of hip-roofed wings round a fountain court, a pool, hedges, and by the water a jetty and a boat.

  const mansionAt = (x, z, W, D, st, r, fv) => {
    const A = axesOf(x, z, W, D, fv), { L, S } = A, box = boxIn(A), gl = glowIn(A);
    const ms = { ...st, base: dim(CREAM, .95 + .3 * r()), win: WARM, lit: .6 + .25 * r(), grime: 0 };
    lawn(x, z, W, D, 0, GARDEN);
    const hl = Math.min(L * .62, 36), hs = Math.min(S * .5, 26), hv = -S * .06, t = Math.min(8, hs * .38), h = 7 + 2.5 * r();
    const wings = [[0, hv - hs / 2 + t / 2, hl, t, h + 3], [-(hl / 2 - t / 2), hv, t, hs, h], [hl / 2 - t / 2, hv, t, hs, h]];
    for (const [u, v, lu, lv, wh] of wings) {
      const [px, pz] = A.at(u, v), [w, d] = A.sz(lu, lv);
      bld(px, pz, w, d, wh, ms, r, { roof: false, kibble: false, skin: SKINS.grid, glow: .2 });
      hip(px, pz, w, d, wh, st, r);
    }

    // Lit arcade on the court face, a fountain, a pool beside the house.

    gl(0, hv - hs / 2 + t + .2, hl - 2 * t, .2, 1, 1.6, dim(WARM, .35));
    const [cx, cz] = A.at(0, hv + t / 2);
    put(GLOWS.sphere, cx, .9, cz, 1.4, .6, 1.4, 0, 0, dim(TEAL, .4));
    pool(cx, cz, 6, [.08, .07, .05]);
    const room = L / 2 - hl / 2;
    if (room > 9) {
      const side = r() < .5 ? -1 : 1, pu = side * (hl / 2 + room / 2), pl = Math.min(room - 4, 14);
      const [sx, sz] = A.at(pu, hv), [sw, sd] = A.sz(pl, Math.min(hs * .6, 9));
      swim(sx, 0, sz, sw, sd);
    }

    // Front hedges with a gate, drive lamps and garden trees.

    const gate = Math.min(8, L * .2), hw = (L - gate) / 2 - 1;
    for (const sd of [-1, 1]) {
      box('box', sd * (gate / 2 + hw / 2), S / 2 - 1, hw, 1.2, 0, 1.4, HEDGE);
      lamp(...A.at(sd * (gate / 2 + .5), S / 2 - 2.5), 3);
    }
    for (let k = 2 + Math.floor(r() * 4); k > 0; k--) {
      const u = (r() < .5 ? -1 : 1) * (hl / 2 + 2 + r() * Math.max(1, room - 4)), v = (r() - .5) * (S - 6);
      const [px, pz] = A.at(u, v);
      tree(px, .3, pz, 6 + r() * 5, r);
    }

    dock(x, z, W, D, r);
  };

  // Wood-and-stone villa set back among trees: a long timber hall, a stone wing, a lit deck and a pergola.

  const villaAt = (x, z, W, D, st, r, fv) => {
    const A = axesOf(x, z, W, D, fv), { L, S } = A, box = boxIn(A), gl = glowIn(A);
    lawn(x, z, W, D, 0, GARDEN);
    const hl = Math.min(L * .5, 26), hs = Math.min(S * .25, 10), v0 = -S * .15, h = 5 + 2 * r();
    const ws = { ...st, base: dim([.17, .11, .07], .8 + .4 * r()), win: WARM, lit: .65 + .2 * r(), grime: 0 };
    const ss = { ...ws, base: dim(STONE, .8 + .3 * r()) };
    const parts = [[0, v0, hl, hs, h, ws], [-hl / 2, v0 - hs / 2, Math.min(10, hl * .4), hs * 1.6, h + 2, ss]];
    for (const [u, v, lu, lv, vh, vs] of parts) {
      const [px, pz] = A.at(u, v), [w, d] = A.sz(lu, lv);
      bld(px, pz, w, d, vh, vs, r, { roof: false, kibble: false, skin: SKINS.grid, glow: .2 });
      prop('box', px, vh + .2, pz, w + 2.4, .35, d + 2.4, [.05, .04, .03]);
    }
    box('box', 0, v0 + hs / 2 + 2.5, hl * .8, 5, 0, .6, WOOD);
    gl(0, v0 + hs / 2 + .2, hl * .7, .2, 2.5, .2, dim(WARM, .8));
    const a = p3(A, -hl * .35, 3.2, v0 + hs / 2 + 5), c = p3(A, hl * .35, 3.2, v0 + hs / 2 + 5);
    stringLights(a, c, .5, 8, dim(WARM, 1.1));
    for (let k = 6 + Math.floor(r() * 6); k > 0; k--) {
      const u = (r() - .5) * (L - 4), v = (r() - .5) * (S - 4);
      if (Math.abs(u) < hl / 2 + 3 && Math.abs(v - v0) < hs / 2 + 6) continue;
      const [px, pz] = A.at(u, v);
      tree(px, .3, pz, 6 + r() * 7, r, pick(r, ['broad', 'palm', 'palm', 'fern']));
    }
    lamp(...A.at(0, S / 2 - 2), 3);
    dock(x, z, W, D, r);
  };

  // Levy campus: brick halls round a quad, vine patches, a white lab box, prefab huts and sometimes a student high-rise.

  const campusAt = (x, z, W, D, st, r, fv, tower) => {
    const A = axesOf(x, z, W, D, fv), { L, S } = A, box = boxIn(A), gl = glowIn(A);
    const bs = { ...st, base: dim(BRICK, .8 + .4 * r()), win: WARM, lit: .5 + .2 * r(), grime: 0 };
    const ls = { ...st, base: WHITE, win: [.78, .9, 1], lit: .55 };
    lawn(x, z, W, D);
    const t = Math.min(12, S * .24), side = Math.min(12, L * .22), hall = (u, v, lu, lv, h, s, lab) => {
      const [px, pz] = A.at(u, v), [w, d] = A.sz(lu, lv);
      bld(px, pz, w, d, h, s, r, { roof: false, skin: lab ? SKINS.curtain : SKINS.grid });
      if (lab) { roofKit(px, pz, w, d, h, r); return; }
      bld(px, pz, w + .6, d + .6, 3, { ...st, base: [.07, .07, .08] }, r, { y0: h, shape: 'pyr', lit: 0, roof: false });

      // Vine patches climb the lower facade on the quad side.

      for (let k = 1 + Math.floor(r() * 3); k > 0; k--) {
        const vh = h * (.3 + .5 * r()), along = (r() - .5) * (Math.max(lu, lv) - 6), vw = 3 + r() * 5;
        if (lu > lv) box('box', u + along, v + lv / 2 + .15, vw, .3, 0, vh, VINE);
        else box('box', u - Math.sign(u) * (lu / 2 + .15), v + along, .3, vw, 0, vh, VINE);
      }
    };
    hall(0, -S / 2 + t / 2 + 1, L * .84, t, 11 + r() * 7, bs);
    const lab = r() < .5 ? -1 : 1;
    for (const sd of [-1, 1]) hall(sd * (L / 2 - side / 2 - 1), 0, side, S * .56, sd === lab ? 14 + r() * 8 : 9 + r() * 6, sd === lab ? ls : bs, sd === lab);

    // Quad paths, lamps and trees.

    gl(0, t / 2, L - 2 * side - 6, 1.6, .25, .05, [.1, .07, .04]);
    gl(0, t / 2, 1.6, S - t - 8, .25, .05, [.1, .07, .04]);
    for (const [su, sv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lamp(...A.at(su * (L / 2 - side - 4), t / 2 + sv * (S * .28)), 3.5);
    for (let k = 4 + Math.floor(r() * 4); k > 0; k--) {
      const [px, pz] = A.at((r() - .5) * (L - 2 * side - 8), t / 2 + (r() - .5) * (S - t - 10));
      tree(px, .3, pz, 7 + r() * 6, r, 'broad');
    }
    for (let k = Math.floor(r() * 3); k > 0; k--) {
      const [px, pz] = A.at(-lab * (L / 2 - side - 8 - k * 7), S / 2 - 5), [w, d] = A.sz(6, 4);
      bld(px, pz, w, d, 3.2, { ...st, base: [.11, .11, .1], lit: .25 }, r, { roof: false, skin: SKINS.sparse });
    }
    if (tower) {
      const [px, pz] = A.at(lab * (L / 2 - side / 2 - 1), S / 2 - 8), th = st.h1 * (1 + .6 * r());
      bld(px, pz, 12, 12, th, { ...st, base: dim(CREAM, .9), win: WARM, lit: .4 }, r, { skin: SKINS.grid });
    }
  };

  // A tidy civic roof: one plant box and a lit edge.

  const roofKit = (x, z, w, d, y, r) => {
    prop('box', x + (r() - .5) * w * .3, y + 1.2, z + (r() - .5) * d * .3, Math.min(6, w * .4), 2.4, Math.min(6, d * .4), [.1, .1, .11]);
  };

  // Glass tower style: white glass, cool even windows, faint glow.

  const glassOf = (st, r, lit = .45) => ({ ...st, base: dim([.2, .22, .25], .85 + .3 * r()), win: [.78, .9, 1], lit, neon: .08 });

  // A reflecting pool with teal edge strips.

  const reflect = (A, u, v, lu, lv) => {
    boxIn(A)('box', u, v, lu, lv, .1, .16, WATER);
    for (const s of [-1, 1]) glowIn(A)(u, v + s * lv / 2, lu, .18, .2, .1, dim(TEAL, .35));
  };

  // ---------- small-lot builders: modern villa, terraced residence, sky residence, garden, brick hall ----------

  // Homes use white render, warm interior light and no grime.

  const homeOf = (st, r, lit = .8) => ({ ...st, base: dim(RENDER, .85 + .3 * r()), win: WARM, lit, grime: 0, neon: 0 });
  const homeBld = (A, u, v, lu, lv, y0, h, s, r, skin, gl = 0) => {
    const [px, pz] = A.at(u, v), [w, d] = A.sz(lu, lv);
    bld(px, pz, w, d, h, s, r, { y0, roof: false, kibble: false, skin, glow: gl });
  };

  // A planted terrace edge: a planter on the step, and warm balcony light under its lip.

  const terraceEdge = (A, u, v, lu, y) => {
    boxIn(A)('box', u, v - .7, lu, 1.4, y, .7, PLANT);
    glowIn(A)(u, v + .1, lu * .94, .15, y - .7, .25, dim(WARM, .6));
  };

  // Modern villa: a glass ground floor and white upper floors that step back from the street and slide sideways.
  // Each step carries a planter. The top has a roof garden. The front garden has a lit pool and a palm.

  const modernVillaAt = (x, z, W, D, st, r, fv) => {
    const A = axesOf(x, z, W, D, fv), { L, S } = A, box = boxIn(A);
    const vs = homeOf(st, r), gs = { ...vs, base: [.1, .11, .12], lit: .95 }, n = Math.min(L, S) > 22 ? 3 : 2, side = r() < .5 ? -1 : 1;
    lawn(x, z, W, D, 0, GARDEN);
    let lu = L * .72, lv = S * .5, u = side * L * .06, v = -S * .1, y = 0;
    for (let k = 0; k < n; k++) {
      homeBld(A, u, v, lu, lv, y, 3.5, k ? vs : gs, r, k ? SKINS.bands : SKINS.curtain, k ? 0 : .3);
      y += 3.5;
      if (k === n - 1) break;
      terraceEdge(A, u, v + lv / 2, lu, y);
      const step = Math.max(1.6, lv * .3);
      lv -= step; v -= step / 2; lu *= .85; u -= side * L * .05;
    }
    box('box', u, v, lu * .7, lv * .6, y, .35, PLANT);
    tree(...p3(A, u + lu * .2, y + .35, v), 2 + r() * 1.5, r, 'shrub');
    const [sx, sz] = A.at(-side * L * .2, S * .32), [sw, sd] = A.sz(L * .38, Math.min(S * .16, 6));
    swim(sx, 0, sz, sw, sd);
    const [px, pz] = A.at(side * L * .33, S * .3);
    tree(px, .3, pz, 7 + r() * 3, r, 'palm');
    pool(px, pz, 3, [.09, .06, .03]);
    box('box', 0, S / 2 - .6, L - 2, 1, 0, 1, HEDGE);
    dock(x, z, W, D, r);
  };

  // Terraced residence: stacked two-floor steps that recede from the street, each front edge planted and lit.
  // The top step carries a roof garden with a pool and a palm.

  const terraceAt = (x, z, W, D, st, r, fv, n) => {
    const A = axesOf(x, z, W, D, fv), { L, S } = A, box = boxIn(A), ts = { ...homeOf(st, r, .72), base: dim(CREAM, 1 + .25 * r()) };
    lawn(x, z, W, D, 0, GARDEN);
    let lu = L * .86, lv = S * .8, v = -S * .06, y = 0;
    const step = Math.max(2.2, lv * .55 / n);
    for (let k = 0; k < n; k++) {
      homeBld(A, 0, v, lu, lv, y, 6.6, ts, r, SKINS.bands, k ? 0 : .25);
      y += 6.6;
      if (k === n - 1) break;
      terraceEdge(A, 0, v + lv / 2, lu, y);
      lv -= step; v -= step / 2; lu *= .95;
    }
    box('box', 0, v, lu * .8, lv * .7, y, .35, PLANT);
    const [px, pz] = A.at(-lu * .2, v), [pw, pd] = A.sz(lu * .3, lv * .3);
    swim(px, y + .35, pz, pw, pd);
    tree(...p3(A, lu * .3, y + .35, v), 4 + r() * 2, r, 'palm');
    box('box', 0, S / 2 - .6, L - 2, 1, 0, 1, HEDGE);
  };

  // Sky residence: a slim warm-glass tower with an open sky garden every 26-36 m and a lit lantern crown with halos.

  const skyresAt = (x, z, W, D, st, r, fv, b) => {
    const A = axesOf(x, z, W, D, fv), { L, S } = A, box = boxIn(A);
    const fw = Math.min(L * .74, 26), fd = Math.min(S * .64, 22), v0 = -S * .08;
    const h = Math.min(Math.max(fw, fd) * 11, Math.max(32, st.h1 * (.8 + .9 * r()) * Math.min(b, 1.5)));
    const gs = { ...st, base: dim([.09, .1, .12], .9 + .25 * r()), win: r() < .6 ? [.8, .58, .34] : [.78, .7, .56], lit: .42, grime: 0, neon: .05 }, bright = { ...gs, lit: .8 };
    lawn(x, z, W, D, 0, GARDEN);
    homeBld(A, 0, v0, fw + 2, fd + 2, 0, 6, bright, r, SKINS.curtain, .4);
    let y = 6;
    const band = 26 + 10 * r();
    while (true) {
      const seg = Math.min(band, h - y);
      homeBld(A, 0, v0, fw, fd, y, seg, gs, r, SKINS.curtain, .12);
      y += seg;
      if (y > h - 12) break;

      // Sky garden: an open floor with a lit core, a planted rim and a tree.

      homeBld(A, 0, v0, fw * .55, fd * .55, y, 3.4, bright, r, SKINS.curtain, .5);
      box('box', 0, v0, fw + 1.2, fd + 1.2, y, .5, PLANT);
      tree(...p3(A, fw * .3, y + .5, v0 + fd * .25), 3 + r() * 1.5, r, 'shrub');
      y += 3.4;
    }
    const cc = pick(r, [GOLD, GOLD, GOLD, TEAL]), [cx, cz] = A.at(0, v0), [cw, cd] = A.sz(fw * 1.2, fd * 1.2);
    homeBld(A, 0, v0, fw * .8, fd * .8, y, 6, bright, r, SKINS.curtain, .7);
    put(GLOWS.ring, cx, y + .3, cz, cw, 1, cd, 0, 0, dim(cc, .8));
    put(GLOWS.ring, cx, y + 6.2, cz, cw * .75, 1, cd * .75, 0, 0, dim(cc, .6));
    if (y > 50) { prop('cyl', cx, y + 13, cz, .3, 14, .3, [.2, .2, .22]); beacon(cx, y + 20.4, cz, r); }
    if (S > 14) { const [px, pz] = A.at(fw * .2, S / 2 - 3), [pw, pd] = A.sz(Math.min(L * .4, 12), 2.6); swim(px, 0, pz, pw, pd); }
    if (L > 12) for (const sd of [-1, 1]) { const [px, pz] = A.at(sd * (L / 2 - 1.5), S / 2 - 1.5); tree(px, .3, pz, 8 + r() * 3, r, 'palm'); }
  };

  // Garden: a lamp-lit promenade along the street, a cross path on deep plots, a fountain and tree groves.
  // keep = [u, v, hu, hv] marks a rectangle that stays free of trees.

  const gardenAt = (x, z, W, D, r, fv, keep) => {
    const A = axesOf(x, z, W, D, fv), { L, S } = A, box = boxIn(A), m = Math.min(L, S), cross = S > 26;
    lawn(x, z, W, D, 0, GARDEN);
    box('box', 0, 0, L, 2.4, .2, .08, PATH);
    if (cross) box('box', 0, 0, 2.4, S, .2, .08, PATH);
    const R = m >= 14 ? Math.min(m * .14, 6) : 0;
    if (R) {
      const [fx, fz] = A.at(0, 0);
      prop('cyl', fx, .45, fz, R * 2, .7, R * 2, dim(STONE, .8));
      put(GLOWS.sphere, fx, .85, fz, R * 1.75, .12, R * 1.75, 0, 0, dim(POOLW, .9));
      put(GLOWS.sphere, fx, 2.2, fz, .5, 3, .5, 0, 0, [.6, .9, 1]);
      pool(fx, fz, R * 2.2, [.03, .09, .11]);
      if (m >= 40) put(GLOWS.ring, fx, .9, fz, R * 2.8, 1, R * 2.8, 0, 0, dim(GOLD, .5));
    }

    // Lamps line the promenade, alternating sides every 16 m.

    for (let u = -L / 2 + 5, k = 0; u < L / 2 - 3; u += 16, k++) lamp(...A.at(u, k % 2 ? 2.4 : -2.4), 4);
    for (let k = Math.min(28, Math.max(2, Math.round(L * S / 90))); k > 0; k--) {
      const u = (r() - .5) * (L - 3), v = (r() - .5) * (S - 3);
      if (Math.abs(v) < 2.6 || (cross && Math.abs(u) < 2.6) || Math.hypot(u, v) < R + 3) continue;
      if (keep && Math.abs(u - keep[0]) < keep[2] && Math.abs(v - keep[1]) < keep[3]) continue;
      const [px, pz] = A.at(u, v);
      tree(px, .3, pz, 5 + r() * 5, r, pick(r, ['broad', 'broad', 'palm', 'cypress', 'shrub']));
    }
  };

  // Signed distance from a world point to polygon P: positive inside.

  const inside = (P, px, pz) => {
    let c = false, e = Infinity;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [ax, az] = P[j], [bx, bz] = P[i], ex = bx - ax, ez = bz - az;
      if (!ex && !ez) continue;
      if ((az > pz) !== (bz > pz) && px < ex * (pz - az) / ez + ax) c = !c;
      const t = Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / (ex * ex + ez * ez)));
      e = Math.min(e, Math.hypot(px - ax - ex * t, pz - az - ez * t));
    }
    return c ? e : -e;
  };
  // Largest frame-aligned rectangle inside the frame's own polygon, m metres in from its edges, as [x, z, w, d].
  // Block frames are bounding boxes of irregular blocks, so builders get this rectangle to keep walls off streets.
  // The search tries centre offsets and aspect ratios, then grows each candidate by bisection.

  const fitRect = (x, z, W, D, m = 3) => {
    const P = H.frame()?.poly;
    if (!P) return [x, z, W, D];
    const ok = (cx, cz, w, d) => [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0], [-.5, -1], [.5, -1], [-.5, 1], [.5, 1], [-1, -.5], [-1, .5], [1, -.5], [1, .5]]
      .every(([a, b]) => inside(P, ...H.worldOf(cx + a * w / 2, cz + b * d / 2)) >= m);
    if (ok(x, z, W, D)) return [x, z, W, D];
    let best = [x, z, 0, 0];
    for (const ou of [-.2, -.1, 0, .1, .2]) for (const ov of [-.2, -.1, 0, .1, .2]) for (const [aw, ad] of [[1, 1], [1, .75], [.75, 1], [1, .55], [.55, 1]]) {
      const cx = x + ou * W, cz = z + ov * D;
      let lo = 0, hi = 1;
      for (let i = 0; i < 7; i++) { const k = (lo + hi) / 2; if (ok(cx, cz, k * aw * W, k * ad * D)) lo = k; else hi = k; }
      if (lo * lo * aw * ad > best[2] * best[3] / (W * D)) best = [cx, cz, lo * aw * W, lo * ad * D];
    }
    return best;
  };

  // Trees on the polygon ground that the fitted rectangle leaves over.

  const fringe = (x, z, W, D, R, r) => {
    const P = H.frame()?.poly;
    if (!P) return;
    for (let k = 0, n = 0; k < 40 && n < 14; k++) {
      const px = x + (r() - .5) * W, pz = z + (r() - .5) * D;
      if (Math.abs(px - R[0]) < R[2] / 2 + 2 && Math.abs(pz - R[1]) < R[3] / 2 + 2) continue;
      if (inside(P, ...H.worldOf(px, pz)) < 3) continue;
      tree(px, .3, pz, 7 + r() * 6, r, pick(r, ['broad', 'broad', 'palm', 'cypress']));
      n++;
    }
  };

  // Trees scattered over a rectangle in (u, v), clear of the keep-out rectangles [u, v, hu, hv].

  const scatter = (A, n, u0, v0, lu, lv, keep, r, kinds, hmin = 6, hvar = 6) => {
    for (let k = n; k > 0; k--) {
      const u = u0 + (r() - .5) * lu, v = v0 + (r() - .5) * lv;
      if (keep.some(([ku, kv, hu, hv]) => Math.abs(u - ku) < hu && Math.abs(v - kv) < hv)) continue;
      tree(...p3(A, u, .3, v), hmin + r() * hvar, r, pick(r, kinds));
    }
  };

  // Estate: a private lawn behind a hedge or a low stone wall. One in four walls carries a gold-lit top.
  // The house takes one of five plans (bar with wings, L, courtyard, pavilions, stacked modern slabs).
  // The pool varies in shape and place. The grounds are open lawn, dense private woods, a formal forecourt or a canal.

  const estateAt = (x, z, W, D, st, r, fv) => {
    const A = axesOf(x, z, W, D, fv), { L, S } = A, box = boxIn(A), gl = glowIn(A);
    const hs = { ...st, base: dim(IVORY, .9 + .2 * r()), win: WARM, lit: .65 + .25 * r(), grime: 0, neon: 0 };
    const glass = { ...hs, base: [.1, .11, .12], lit: 1 };
    lawn(x, z, W, D, 0, ESTLAWN);

    // Boundary: a hedge, a stone wall, or a stone wall with a lit top. The gate gap faces the street.

    const wr = r(), stone = wr < .55, gate = 7, wc = stone ? dim(IVORY, .7) : HEDGE, wh = stone ? 1.6 : 2.4;
    for (const [u, v, lu, lv] of [[0, -S / 2 + .5, L, 1], [-L / 2 + .5, 0, 1, S], [L / 2 - .5, 0, 1, S],
      [-(L + gate) / 4, S / 2 - .5, (L - gate) / 2, 1], [(L + gate) / 4, S / 2 - .5, (L - gate) / 2, 1]]) {
      box('box', u, v, lu, lv, 0, wh, wc);
      if (wr < .25) gl(u, v, lu, lv, wh, .12, dim(GOLD, .3));
    }

    // House. Plans set footprints in (u, v); keep collects them so trees stay clear.

    const plan = pick(r, ['bar', 'bar', 'L', 'court', 'court', 'pav', 'modern']), keep = [];
    const part = (u, v, lu, lv, y0, ph, s, skin, g = .2) => { homeBld(A, u, v, lu, lv, y0, ph, s, r, skin, g); if (!y0) keep.push([u, v, lu / 2 + 3, lv / 2 + 3]); };
    const roofed = (u, v, lu, lv, ph) => { part(u, v, lu, lv, 0, ph, hs, SKINS.grid); hip(...A.at(u, v), ...A.sz(lu, lv), ph, st, r, ROOF); };
    const flat = (u, v, lu, lv, y0, ph, s = hs) => { part(u, v, lu, lv, y0, ph, s, s === glass ? SKINS.curtain : SKINS.bands, s === glass ? .4 : .15); box('box', u, v, lu * .8, lv * .8, y0 + ph, .35, PLANT); };
    const side = r() < .5 ? -1 : 1, deep = r() < .4;
    const Lm = Math.min(L * (.38 + .14 * r()), 40), Sm = Math.min(S * .24, 15), h = 9 + 4 * r();
    const vH = deep ? -S / 2 + Math.max(9, S * .2) + Sm / 2 : -S * .05 + (r() - .5) * S * .1, uH = (r() - .5) * (L - Lm) * .5;
    let hf = vH + Sm / 2, poolAt = null;
    if (plan === 'bar') {
      roofed(uH, vH, Lm, Sm, h);
      const wl = Math.min(L * .13, 10);
      for (const sd of [-1, 1]) roofed(uH + sd * (Lm / 2 + wl / 2), vH + Sm * .3, wl, Sm * 1.5, h - 3.5);
      box('box', uH, hf + 1.5, Lm * .35, 3, 0, 5, dim(IVORY, 1.1));
      gl(uH, hf + 3.1, Lm * .3, .15, .4, 4, dim(WARM, .8));
    } else if (plan === 'L') {
      roofed(uH, vH, Lm, Sm, h);
      const wv = Math.min(S * .4, 26), wl = Math.min(12, Sm * .8);
      roofed(uH + side * (Lm / 2 - wl / 2), vH + Sm / 2 + wv / 2, wl, wv, h - 2);
      poolAt = [uH - side * Lm * .1, vH + Sm / 2 + wv * .5, Math.min(Lm * .45, 18), Math.min(wv * .35, 8)];
      hf += wv;
    } else if (plan === 'court') {
      const cl = Math.min(Lm * 1.05, L * .55), cs = Math.min(S * .45, cl * .9), t = Math.min(9, cs * .28);
      const cv = vH + (cs - Sm) / 2 - (deep ? 0 : cs * .2);
      for (const [u, v, lu, lv] of [[0, -cs / 2 + t / 2, cl, t], [0, cs / 2 - t / 2, cl, t], [-cl / 2 + t / 2, 0, t, cs - 2 * t], [cl / 2 - t / 2, 0, t, cs - 2 * t]])
        roofed(uH + u, cv + v, lu, lv, v > 0 ? h - 3 : h);
      poolAt = [uH, cv, cl - 2 * t - 5, Math.min(cs - 2 * t - 5, 6)];
      keep.push([uH, cv, cl / 2 + 3, cs / 2 + 3]);
      hf = cv + cs / 2;
    } else if (plan === 'pav') {
      const n = 3, pw = Math.min(L * .2, 14), ps = Math.min(S * .2, 12);
      for (let k = 0; k < n; k++) {
        const u = uH + (k - 1) * (pw + 5), v = vH + (k % 2 ? ps * .5 : 0);
        flat(u, v, pw, ps, 0, 4.2, glass);
        box('box', u, v, pw + 3, ps + 3, 4.2, .4, dim(IVORY, .9));
      }
      gl(uH, vH + ps * .25, (pw + 5) * 2, 1.4, 1, 2.4, dim(WARM, .6));
      hf = vH + ps;
    } else {
      flat(uH, vH, Lm, Sm, 0, 4, glass);
      part(uH - side * Lm * .08, vH - 1, Lm * 1.15, Sm * .9, 4, 4, hs, SKINS.bands);
      flat(uH + side * Lm * .14, vH - 2, Lm * .55, Sm * .6, 8, 3.5);
      gl(uH - side * Lm * .08, vH - 1 + Sm * .45, Lm * 1.1, .15, 7.8, .2, dim(WARM, .7));
    }

    // Pool: a court pool, or a long lap pool, a wide rectangle, an L, or a round pool, behind, beside or in front.

    if (!poolAt) {
      const where = pick(r, ['back', 'back', 'side', 'front']);
      const pl = Math.min(L * (.2 + .2 * r()), 24), pd = Math.min(4 + r() * 5, S * .12);
      poolAt = where === 'back' && deep ? [uH + (r() - .5) * Lm * .4, -S / 2 + (vH - Sm / 2 + S / 2) / 2, pl, Math.min(pd, vH - Sm / 2 + S / 2 - 4)]
        : where === 'side' ? [side * (L / 2 - pl / 2 - 4) || 0, vH, Math.min(pl, Math.max(4, L / 2 - Lm / 2 - 6)), pd * 1.4]
        : [uH + side * Lm * .2, Math.min(hf + 8, S / 2 - 8), pl, pd];
    }
    const [pu, pv, pl, pd] = poolAt;
    if (pl > 3 && pd > 2) {
      const shape = r();
      keep.push([pu, pv, pl / 2 + 3, pd / 2 + 3]);
      box('box', pu, pv, pl + 3, pd + 3, 0, .3, GRAVEL);
      if (shape < .2) {
        const [sx, sz] = A.at(pu, pv), rr = Math.min(pl, pd * 1.8);
        put(GLOWS.sphere, sx, .35, sz, rr, .1, rr, 0, 0, POOLW);
        pool(sx, sz, rr * .7, [.02, .09, .11]);
      } else {
        const [sx, sz] = A.at(pu, pv), [sw, sd] = A.sz(pl, pd);
        swim(sx, .3, sz, sw, sd);
        if (shape > .75) { const [qx, qz] = A.at(pu + pl / 2 - pd / 2, pv + pd), [qw, qd] = A.sz(pd, pd); swim(qx, .3, qz, qw, qd); }
      }
    }

    // Grounds.

    const fl = S / 2 - hf - 3, fc = hf + 3 + fl / 2, ground = pick(r, ['lawn', 'woods', 'woods', 'formal', 'canal']);
    const drive = () => {
      box('box', 0, (hf + S / 2) / 2, 3.6, Math.max(1, S / 2 - hf), 0, .26, GRAVEL);
      keep.push([0, (hf + S / 2) / 2, 3, (S / 2 - hf) / 2]);
      for (const sd of [-1, 1]) lamp(...A.at(sd * 3, S / 2 - 3), 3);
    };
    if (ground === 'canal' && fl > 14) {
      const cl = fl * .8;
      for (const sd of [-1, 1]) box('box', sd * 4, fc, 2.4, fl + 2, 0, .26, GRAVEL);
      const [cx, cz] = A.at(0, fc), [cw, cd] = A.sz(3.6, cl);
      prop('box', cx, .2, cz, cw + 1.2, .3, cd + 1.2, dim(IVORY, .7));
      swim(cx, .3, cz, cw, cd);
      for (const sd of [-1, 1]) for (let v = fc - cl / 2 + 3; v < fc + cl / 2; v += 8) tree(...p3(A, sd * 7.5, .3, v), 7 + r() * 3, r, 'cypress');
      for (const sd of [-1, 1]) lamp(...A.at(sd * 5.8, S / 2 - 3), 3);
      scatter(A, 4, 0, -S * .25, L - 6, S * .45, keep, r, ['broad', 'palm']);
    } else if (ground === 'formal' && fl > 14) {
      drive();
      const pw = Math.min((L - 14) / 2 - 3, 18);
      for (const sd of [-1, 1]) {
        const cu = sd * (5 + pw / 2);
        box('box', cu, fc, pw, fl * .8, 0, .24, GRAVEL);
        for (const sv of [-1, 1]) box('box', cu, fc + sv * fl * .2, pw - 3, fl * .3, 0, .9, HEDGE);
        for (const sv of [-1, 1]) tree(...p3(A, cu + sd * pw / 2, .3, fc + sv * fl * .4), 7 + r() * 2, r, 'cypress');
      }
      const R = Math.min(4.5, fl * .2), [fx, fz] = A.at(0, fc);
      prop('cyl', fx, .45, fz, R * 2, .7, R * 2, dim(IVORY, .9));
      put(GLOWS.sphere, fx, .85, fz, R * 1.75, .12, R * 1.75, 0, 0, dim(POOLW, .9));
      if (r() < .3) put(GLOWS.ring, fx, .9, fz, (R + 3) * 2, 1, (R + 3) * 2, 0, 0, dim(GOLD, .3));
      scatter(A, 4, 0, -S * .25, L - 6, S * .45, keep, r, ['broad', 'palm']);
    } else if (ground === 'woods') {
      drive();
      scatter(A, Math.min(26, Math.round(L * S / 110)), 0, 0, L - 4, S - 4, keep, r, ['broad', 'broad', 'broad', 'cypress'], 8, 7);
    } else {
      drive();
      scatter(A, 4 + Math.floor(r() * 3), 0, 0, L - 8, S - 8, keep, r, ['broad', 'palm', 'palm']);
    }
    dock(x, z, W, D, r);
  };

  // Luxury apartments: six to fourteen floors of cream render, warm balcony strips every second floor on the outer faces,
  // green roofs, and one of three plans (a court ring, a stepped bar falling to the street, or a comb of parallel bars).

  const apartmentsAt = (x, z, W, D, st, r, fv, plan) => {
    const A = axesOf(x, z, W, D, fv), { L, S } = A, box = boxIn(A), gl = glowIn(A);
    const as = { ...st, base: dim(r() < .5 ? IVORY : RENDER, .9 + .2 * r()), win: WARM, lit: .55 + .2 * r(), grime: 0, neon: 0 };
    const floors = 6 + Math.floor(r() * 9), H0 = floors * 3.3, t = Math.min(15, Math.max(9, S * .26));
    lawn(x, z, W, D, 0, ESTLAWN);
    plan ??= pick(r, ['court', 'court', 'stepped', 'comb']);

    // A wing: the block, balcony strips on its outward face (n = [nu, nv]), a planted roof.

    const wing = (u, v, lu, lv, h, n, y0 = 0) => {
      homeBld(A, u, v, lu, lv, y0, h, as, r, SKINS.bands, .15);
      const along = n[0] ? lv : lu;
      for (let y = y0 + 6.6; y < y0 + h - 1; y += 6.6)
        gl(u + n[0] * (lu / 2 + .3), v + n[1] * (lv / 2 + .3), n[0] ? .3 : along * .9, n[0] ? along * .9 : .3, y - .2, .3, dim(WARM, .5));
      box('box', u, v, lu * .85, lv * .8, y0 + h, .4, PLANT);
    };
    if (plan === 'court') {
      const cl = L * .86, cs = S * .8, v0 = -S * .04;
      wing(0, v0 - cs / 2 + t / 2, cl, t, H0, [0, -1]);
      wing(0, v0 + cs / 2 - t / 2, cl, t, H0 * .6, [0, 1]);
      for (const sd of [-1, 1]) wing(sd * (cl / 2 - t / 2), v0, t, cs - 2 * t, H0 * .8, [sd, 0]);
      const [gx, gz] = A.at(0, v0), [gw, gd] = A.sz(cl - 2 * t - 4, cs - 2 * t - 4);
      swim(gx, .3, gz, gw * .4, Math.min(gd * .3, 6));
      scatter(A, 5, 0, v0, cl - 2 * t - 6, cs - 2 * t - 6, [[0, v0, gw * .2 + 2, 5]], r, ['broad', 'palm']);
    } else if (plan === 'stepped') {
      const n = 3, lu = L * .82;
      let y = 0, lv = S * .62, v = -S * .1;
      for (let k = 0; k < n; k++) {
        const sh = H0 / n * (k ? 1 : 1.2);
        wing(0, v, lu, lv, sh, [0, 1], y);
        y += sh;
        if (k < n - 1) terraceEdge(A, 0, v + lv / 2, lu, y);
        const step = lv * .28;
        lv -= step; v -= step / 2;
      }
      scatter(A, 4, 0, S * .38, L - 6, S * .16, [[0, S * .38, 3, 6]], r, ['palm', 'broad']);
    } else {
      const n = L > 70 ? 3 : 2, gap = (L - n * t) / (n + 1);
      for (let k = 0; k < n; k++) {
        const u = -L / 2 + gap + t / 2 + k * (t + gap);
        wing(u, -S * .05, t, S * .75, H0 * (k % 2 ? .75 : 1), [k % 2 ? 1 : -1, 0]);
      }
      for (let k = 0; k < n - 1; k++) scatter(A, 3, -L / 2 + gap + t + gap / 2 + k * (t + gap), 0, gap - 4, S * .7, [], r, ['broad', 'palm']);
    }
    for (const sd of [-1, 1]) lamp(...A.at(sd * (L / 2 - 3), S / 2 - 2), 3.5);
  };

  // Icon tower: a rare modernist high-rise, 90-220 m, on a lawn with a reflecting pool.
  // Each of the four forms has its own light: gold floor plates (twist), teal undersides (cantilever),
  // rose overhangs (stack), teal edges and a gold bridge (sail).

  const iconAt = (x, z, W, D, st, r, fv, form) => {
    const A = axesOf(x, z, W, D, fv), { L, S } = A, box = boxIn(A);
    const H0 = 90 + 130 * r(), cool = { ...st, base: dim([.12, .14, .17], .9 + .2 * r()), win: [.78, .9, 1], lit: .5, grime: 0, neon: 0 };
    const warm = { ...cool, base: dim(IVORY, .7), win: [.8, .58, .34], lit: .5 };
    const [cx, cz] = A.at(0, -S * .1);
    lawn(x, z, W, D, 0, ESTLAWN);
    reflect(A, 0, S * .32, L * .5, Math.min(8, S * .14));
    for (const sd of [-1, 1]) lamp(...A.at(sd * L * .3, S / 2 - 3));
    const top = (y, rgb, k = 1) => { put(GLOWS.ring, cx, y, cz, 22 * k, 1, 22 * k, 0, 0, rgb); prop('cyl', cx, y + 8, cz, .3, 16, .3, [.2, .2, .22]); beacon(cx, y + 16.4, cz, r); };
    const solid = { roof: false, kibble: false };
    if (form === 'twist') {

      // Twist: eighteen rotated slabs round a dark core, a gold light plate in every floor gap.

      const n = 18, sh = H0 / n, sw = Math.min(L * .55, 34), sd = Math.min(S * .32, 15), turn = (r() < .5 ? -1 : 1) * (1.4 + .5 * r()) / n;
      bld(cx, cz, sd * .7, sd * .7, H0, { ...cool, base: [.04, .04, .05], lit: .15 }, r, { ...solid, shape: 'oct', skin: SKINS.sparse });
      for (let k = 0; k < n; k++) {
        bld(cx, cz, sw, sd, sh - 1.8, warm, r, { ...solid, y0: k * sh + .9, ry: k * turn, skin: SKINS.curtain, glow: .4 });
        glow(cx, k * sh + .45, cz, sw + 1, .35, sd + 1, dim(GOLD, .55), k * turn);
      }
      top(H0, dim(GOLD, .9), 1.1);
    } else if (form === 'cantilever') {

      // Cantilever: a slim dark core with four big boxes thrown out in different directions, lit teal underneath, roof gardens on top.

      const cw = Math.min(L * .18, 11);
      bld(cx, cz, cw, cw, H0, { ...cool, base: [.05, .055, .06], lit: .2 }, r, { ...solid, skin: SKINS.sparse });
      for (let k = 0; k < 4; k++) {
        const y = H0 * (.22 + .2 * k), bw = 32 + 10 * r(), bd = 15 + 4 * r(), bh = 11 + 5 * r(), a = k * 1.9 + r() * .6;
        const ox = Math.cos(a) * bw * .38, oz = -Math.sin(a) * bw * .38;
        bld(cx + ox, cz + oz, bw, bd, bh, cool, r, { ...solid, y0: y, ry: a, skin: SKINS.curtain, glow: .3 });
        glow(cx + ox, y - .2, cz + oz, bw - 1, .3, bd - 1, dim(TEAL, 1.1), a);
        prop('box', cx + ox, y + bh + .2, cz + oz, bw + .4, .4, bd + .4, [.05, .055, .06], a);
        prop('box', cx + ox, y + bh + .55, cz + oz, bw * .8, .4, bd * .7, PLANT, a);
      }
      top(H0, dim(TEAL, .8), .6);
    } else if (form === 'stack') {

      // Stack: six volumes of different sizes, each shoved off the one below, rose light under each overhang, green tops.

      let y = 0, ox = 0, oz = 0;
      const n = 6, sh = H0 / n;
      for (let k = 0; k < n; k++) {
        const bw = 16 + 18 * r(), bd = 14 + 12 * r();
        if (k) { ox = Math.max(-L * .25, Math.min(L * .25, ox + (r() < .5 ? -1 : 1) * (6 + 8 * r()))); oz = Math.max(-S * .2, Math.min(S * .2, oz + (r() - .5) * 16)); }
        bld(cx + ox, cz + oz, bw, bd, sh - .6, k % 2 ? warm : cool, r, { ...solid, y0: y, skin: k % 2 ? SKINS.bands : SKINS.curtain, glow: .25 });
        if (k) glow(cx + ox, y - .1, cz + oz, bw - 1, .3, bd - 1, dim(ROSE, .8));
        prop('box', cx + ox, y + sh - .4, cz + oz, bw * .8, .4, bd * .8, PLANT);
        y += sh;
      }
      glow(cx + ox, y + .6, cz + oz, 6, 1, 6, dim(ROSE, .9));
    } else {

      // Sail: two dark-glass blades that taper and curve toward each other, teal leading edges, a gold sky bridge.

      const n = 10, sh = H0 / n, gap = Math.min(L * .16, 10), bl = Math.min(L * .26, 20), bd = Math.min(S * .18, 9);
      const glassD = { ...cool, base: [.06, .07, .09], lit: .35 };
      for (const sd of [-1, 1]) {
        const hh = H0 * (sd > 0 ? 1 : .8);
        for (let k = 0; k * sh < hh; k++) {
          const t = k / n, lu = bl * (1 - .6 * t), off = gap / 2 + lu / 2 + 14 * (1 - t) * t;
          bld(cx + sd * off, cz, lu, bd, Math.min(sh, hh - k * sh), glassD, r, { ...solid, y0: k * sh, skin: SKINS.curtain, glow: .4 });
        }
        beam([cx + sd * (gap / 2 + bl), .5, cz + bd / 2 + .2], [cx + sd * (gap / 2 + bl * .2 + 3), hh, cz + bd / 2 + .2], .45, dim(TEAL, 1), 'glow');
      }
      const by = H0 * .62, bw = gap + 2 * 14 * .62 * .38 + bl * .6;
      bld(cx, cz, bw, bd * .8, 6, warm, r, { ...solid, y0: by, skin: SKINS.curtain, glow: .9 });
      glow(cx, by - .25, cz, bw, .3, bd * .7, dim(GOLD, 1.2));
      top(H0 + 2, dim([.9, 1.1, 1.3], .7), .5);
    }
  };

  // Levy brick hall for a small lot: one gabled hall, a vine patch, a tree and a lamp.

  const hallAt = (x, z, W, D, st, r, fv) => {
    const A = axesOf(x, z, W, D, fv), { L, S } = A, bs = { ...st, base: dim(BRICK, .85 + .4 * r()), win: WARM, lit: .55 + .2 * r(), grime: 0 };
    const lu = L * .8, lv = S * .6, v = -S * .08, h = 9 + 6 * r(), [px, pz] = A.at(0, v), [w, d] = A.sz(lu, lv);
    lawn(x, z, W, D, 0, GARDEN);
    homeBld(A, 0, v, lu, lv, 0, h, bs, r, SKINS.grid, .15);
    bld(px, pz, w + .6, d + .6, 3, { ...st, base: [.07, .07, .08] }, r, { y0: h, shape: 'pyr', lit: 0, roof: false });
    boxIn(A)('box', (r() - .5) * lu * .5, v + lv / 2 + .15, 3 + r() * 4, .3, 0, h * (.4 + .4 * r()), VINE);
    const [tx, tz] = A.at(L * .35 * (r() < .5 ? -1 : 1), S * .36);
    tree(tx, .3, tz, 6 + r() * 4, r, 'broad');
    lamp(...A.at(0, S / 2 - 1.5), 3.5);
  };

  // ---------- lot kits ----------

  const K = {
    // Government arcology: a white glass tower on a lawn plate, a reflecting pool and an allée in front.

    lv_govarc(x, z, s, st, b, r) {
      const [W, D] = dims(s), A = axesOf(x, z, W, D, front()), { L, S } = A;
      lawn(x, z, W, D);
      const tw = Math.min(L * .5, 40), ts = Math.min(S * .45, 34), h = st.h1 * (1.4 + r()) * Math.min(b, 1.5);
      const [tx, tz] = A.at(0, -S * .18), [w, d] = A.sz(tw, ts);
      grammarTowerBody(tx, tz, w, d, h, glassOf(st, r), r, { plan: pick(r, ['rect', 'oct', 'slab', 'round']), skirt: 'podium', skin: SKINS.curtain, flank: 'none', crown: pick(r, ['ring', 'spire', 'helipad', 'flat']) });
      const pv = -S * .18 + ts / 2 + (S / 2 - (-S * .18 + ts / 2)) / 2, pl = Math.max(4, S / 2 - (-S * .18 + ts / 2) - 6);
      reflect(A, 0, pv, tw * .7, Math.min(pl, 14));
      for (const sd of [-1, 1]) {
        for (let k = 0; k < 3; k++) { const [px, pz] = A.at(sd * (tw * .45 + 3), pv + (k - 1) * 6); tree(px, .3, pz, 7 + r() * 3, r, 'cypress'); }
        lamp(...A.at(sd * (L / 2 - 2), S / 2 - 2));
      }
    },

    // Sail tower: stacked glass slices that thin, curve and lean back, with a lit leading edge.

    lv_sailtower(x, z, s, st, b, r) {
      const [W, D] = dims(s), A = axesOf(x, z, W, D, front()), { L, S } = A;
      lawn(x, z, W, D);
      const n = 10, h = st.h1 * (1.2 + .8 * r()) * Math.min(b, 1.5), seg = h / n, tl = Math.min(L * .62, 46), td = Math.min(S * .36, 20);
      const gs = glassOf(st, r, .5), edge = pick(r, [TEAL, TEAL, ROSE, GOLD]), dir = r() < .5 ? -1 : 1;
      let prev = null;
      for (let k = 0; k < n; k++) {
        const t = k / n, lu = tl * (1 - .5 * t * t), lv = td * (1 - .55 * t), cu = dir * tl * .28 * t * t, cv = -S * .1 - td * .3 * t;
        const [px, pz] = A.at(cu, cv), [w, d] = A.sz(lu, lv);
        bld(px, pz, w, d, seg, gs, r, { y0: k * seg, roof: false, skin: SKINS.curtain, glow: .35 });
        const e = p3(A, cu - dir * lu / 2, k * seg + seg, cv + lv / 2);
        if (prev) beam(prev, e, .35, dim(edge, .7), 'glow');
        prev = e;
      }
      const top = p3(A, dir * tl * .28 * .81, h, -S * .1 - td * .27);
      prop('cyl', top[0], h + 9, top[2], .4, 18, .4, [.2, .2, .22]);
      beacon(top[0], h + 18.4, top[2], r);
      const [lx, lz] = A.at(0, -S * .1 + td / 2 + 3), [lw, ld] = A.sz(tl * .6, 6);
      bld(lx, lz, lw, ld, 6, glassOf(st, r, .9), r, { roof: false, skin: SKINS.curtain });
      reflect(A, 0, S / 2 - 6, tl * .5, 5);
      for (const sd of [-1, 1]) lamp(...A.at(sd * (L / 2 - 2), S / 2 - 2));
    },

    // Garden-ring tower: a slim octagon banded with planted terraces every few floors.

    lv_gardenring(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      lawn(x, z, W, D);
      const rad = Math.min(W, D, 46) * .3, h = st.h1 * (1 + .7 * r()) * Math.min(b, 1.5), band = 24 + 10 * r();
      const gs = glassOf(st, r, .42), skin = r() < .5 ? SKINS.curtain : SKINS.bands;
      let y = 0;
      while (y < h - 6) {
        const sh = Math.min(band, h - y);
        bld(x, z, rad * 2, rad * 2, sh - 2, gs, r, { y0: y, shape: 'oct', skin, roof: false, glow: .2 });
        y += sh - 2;
        prop('cyl', x, y + 1, z, rad * 2.35, 2, rad * 2.35, dim(LAWN, 1.4));
        put(GLOWS.ring, x, y - .1, z, rad * 2.4, 1, rad * 2.4, 0, 0, dim(GOLD, .45));
        if (y < h - 8) for (let k = 0; k < 5; k++) {
          const a = k * 1.2566 + r() * .4;
          tree(x + Math.cos(a) * rad * 1.02, y + 2, z + Math.sin(a) * rad * 1.02, 4 + r() * 3, r);
        }
        y += 2;
      }
      if (r() < .35) {
        prop('cone', x, y + 14, z, rad * .5, 28, rad * .5, [.14, .1, .13]);
        beam([x, y + 2, z + rad * .2], [x, y + 26, z + .2], .3, dim(ROSE, .9), 'glow');
      } else for (let k = 0; k < 4; k++) tree(x + (r() - .5) * rad, y + .2, z + (r() - .5) * rad, 5 + r() * 3, r);
      prop('cyl', x + rad * 1.6, .2, z, rad * 1.2, .16, rad * 1.2, WATER);
      pool(x, z, rad * 2, [.08, .07, .05]);
      for (let k = 0; k < 4; k++) { const a = k * 1.571 + .8; tree(x + Math.cos(a) * rad * 1.9, .3, z + Math.sin(a) * rad * 1.9, 7 + r() * 4, r); }
    },

    // Civic ziggurat: a squat stepped hall in pale stone, gold terrace lines, a portico and a grand stair.

    lv_ziggurat(x, z, s, st, b, r) {
      const [W, D] = dims(s), A = axesOf(x, z, W, D, front()), { L, S } = A, gl = glowIn(A);
      lawn(x, z, W, D);
      const zs = { ...st, base: dim(STONE, .8 + .3 * r()), win: GOLD.map(c => c * .6), lit: .15 };
      const n = 4 + Math.floor(r() * 3);
      let lu = L * .8, lv = S * .7, y = 0;
      const v0 = -S * .06;
      for (let k = 0; k < n; k++) {
        const sh = 5 + 3 * r(), [px, pz] = A.at(0, v0), [w, d] = A.sz(lu, lv);
        bld(px, pz, w, d, sh, zs, r, { y0: y, roof: false, skin: SKINS.bands });
        y += sh;
        gl(0, v0 + lv / 2 + .1, lu * .96, .2, y - .5, .25, dim(GOLD, .35));
        if (k && k < n - 1) for (const sd of [-1, 1]) { const [px, pz] = A.at(sd * lu * .38, v0 + lv * .4); tree(px, y, pz, 3 + r() * 2, r, 'shrub'); }
        lu *= .8; lv *= .78;
      }
      beam(p3(A, 0, 1, v0 + S * .35 + 5), p3(A, 0, y - 2, v0 + lv / .78 / 2), 5, dim(STONE, .7));
      beam(p3(A, 0, 1.8, v0 + S * .35 + 5), p3(A, 0, y - 1.2, v0 + lv / .78 / 2), .3, dim(GOLD, .5), 'glow');
      for (let k = -2; k <= 2; k++) {
        const [px, pz] = A.at(k * Math.min(6, L * .12), v0 + S * .35 + 1);
        prop('cyl', px, 4, pz, 1.3, 8, 1.3, dim(STONE, 1.1));
      }
      for (let k = -1; k <= 1; k++) {
        const [px, pz] = A.at(k * lu * .35, v0);
        prop('cyl', px, y + 6, pz, .2, 12, .2, [.2, .2, .2]);
        glow(px + .9, y + 11, pz, 1.6, 1, .1, dim(k ? GOLD : TEAL, .5));
      }
      for (const sd of [-1, 1]) lamp(...A.at(sd * (L / 2 - 2), S / 2 - 2));
    },

    // Spanish Colonial mansion on its lawn. By the water it gets a jetty.

    lv_mansion(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      mansionAt(x, z, W, D, st, r, front());
    },

    // Wood-and-stone lodge set back from the road in a garden.

    lv_lodge(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      villaAt(x, z, W, D, st, r, front());
    },

    // Modern terraced villa with a pool, a roof garden and a palm.

    lv_villa(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      modernVillaAt(x, z, W, D, st, r, front());
    },

    // Stepped green-terraced residence, three to six steps.

    lv_terrace(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      terraceAt(x, z, W, D, st, r, front(), Math.min(6, 3 + Math.floor(r() * (Math.min(W, D) < 16 ? 2 : 4))));
    },

    // Slim luxury tower with sky gardens and a lit crown.

    lv_skyres(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      skyresAt(x, z, W, D, st, r, front(), b);
    },

    // Walled estate with a lit drive, a fountain court, a house and a pool.

    lv_estate(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      estateAt(x, z, W, D, st, r, front());
    },

    // Luxury apartments on a lot: a stepped bar.

    lv_apartments(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      apartmentsAt(x, z, W, D, st, r, front(), 'stepped');
    },

    // Garden: lawn, promenade lamps, fountain and tree groves.

    lv_garden(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      gardenAt(x, z, W, D, r, front());
    },

    // Marina: a cove with finger piers and moored sailboats, a lamp-lit boardwalk and a yacht club.

    lv_marina(x, z, s, st, b, r) {
      const [W, D] = dims(s), A = axesOf(x, z, W, D, front()), { L, S } = A, box = boxIn(A), gl = glowIn(A);
      const wv = S * .15, wd = S * .65, wc = wv - wd / 2;
      lawn(x, z, W, D);
      box('box', 0, wc, L + 1, wd, .1, .16, WATER);
      box('box', 0, wv + 1.5, L, 3, .1, .5, WOOD);
      for (let u = -L / 2 + 4; u < L / 2 - 2; u += 9) {
        const [px, pz] = A.at(u, wv + 2.6);
        lamp(px, pz, 3.6);
        gl(u, wv - 4, .5, 6, .27, .02, [.25, .14, .06]);
      }
      const n = Math.max(2, Math.floor(L / 10));
      for (let k = 0; k < n; k++) {
        const u = (k + .5) * L / n - L / 2, pl = wd * .55;
        box('box', u, wv - pl / 2, 1.4, pl, .2, .4, WOOD);
        if (r() < .8) { const [bx, bz] = A.at(u + 3, wv - pl * (.3 + .5 * r())); boat(bx, bz, !front()[1], 6 + r() * 4, r); }
      }
      const cl = Math.min(18, L * .35), [cx, cz] = A.at(L / 2 - cl / 2 - 1, S / 2 - S * .1 - 1), [cw, cd] = A.sz(cl, S * .2 - 2);
      bld(cx, cz, cw, cd, 5.5, { ...st, base: dim(CREAM, .9), win: WARM, lit: .7 }, r, { roof: false, skin: SKINS.bands });
      prop('box', cx, 5.8, cz, cw + 2, .3, cd + 2, [.06, .05, .04]);
      if (r() < .6) textSign('YACHT CLUB', ...p3(A, L / 2 - cl / 2 - 1, 4.6, S / 2 - 1), cl * .6, cl * .15, fvRy(front()), dim(GOLD, .8));
    },

    // L-square deck on columns: a raised garden with a holopark, a jogging loop and lit undersides.

    lv_lawnplaza(x, z, s, st, b, r) {
      const [W, D] = dims(s), dy = 10 + 12 * r(), w = W * .92, d = D * .88;
      prop('box', x, .12, z, W, .24, D, [.04, .04, .045]);
      prop('box', x, dy - .6, z, w, 1.2, d, DECK);
      lawn(x, z, w - 2, d - 2, dy);
      for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) {
        if (!i && !j) continue;
        prop('cyl', x + i * w * .35, dy / 2 - .6, z + j * d * .35, 1.6, dy - 1.2, 1.6, [.1, .1, .11]);
        if (r() < .5) pool(x + i * w * .35, z + j * d * .35, 5, [.08, .06, .04]);
      }
      glow(x, dy - 1.25, z, w * .6, .1, .3, dim(WARM, .35));
      for (const sd of [-1, 1]) {
        glow(x, dy + .4, z + sd * (d / 2 - .4), w - 1, .12, .5, dim(ORANGE, .45));
        glow(x + sd * (w / 2 - .4), dy + .4, z, .5, .12, d - 1, dim(ORANGE, .45));
      }
      put(GLOWS.ring, x, dy + .5, z, 14, 1, 14, 0, 0, dim(TEAL, .7));
      put(GLOWS.sphere, x, dy + 4, z, 5, 5, 5, 0, 0, dim(TEAL, .18));
      for (let k = 3 + Math.floor(r() * 3); k > 0; k--) prop('box', x + (r() - .5) * (w - 10), dy + .6, z + (r() - .5) * (d - 10), 3 + r() * 4, .8, 2 + r() * 3, HEDGE);
      for (let k = 5 + Math.floor(r() * 4); k > 0; k--) {
        const px = x + (r() - .5) * (w - 6), pz = z + (r() - .5) * (d - 6);
        if (Math.hypot(px - x, pz - z) > 9) tree(px, dy + .3, pz, 5 + r() * 4, r);
      }
      bld(x + w / 2 - 3, z - d / 2 + 3, 5, 5, dy + 4, glassOf(st, r, .8), r, { roof: false, skin: SKINS.curtain });
    },

    // Levy University block: brick quad, lab box, prefabs, sometimes a student tower.

    lv_campus(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      (Math.min(W, D) < 22 ? hallAt : campusAt)(x, z, W, D, st, r, front(), r() < .3 * b);
    },
  };

  // Text facing the front vector.

  function fvRy([fx, fz]) { return Math.atan2(fx, fz); }

  // On the city map each sub-area picks from its own list by lot size: under 16 m, 16-30 m, over 30 m.
  // Lots on the park field become gardens. The showcase has no frame and builds every kit as named.

  const SIZE = s => s < 16 ? 0 : s < 30 ? 1 : 2;
  const ALLOW = {
    Downtown: [
      ['lv_terrace', 'lv_terrace', 'lv_villa', 'lv_villa', 'lv_garden', 'lv_skyres'],
      ['lv_skyres', 'lv_apartments', 'lv_apartments', 'lv_terrace', 'lv_villa', 'lv_garden', 'lv_sailtower'],
      ['lv_govarc', 'lv_sailtower', 'lv_gardenring', 'lv_ziggurat', 'lv_lawnplaza', 'lv_terrace', 'lv_skyres'],
    ],
    Lakeside: [
      ['lv_villa', 'lv_villa', 'lv_villa', 'lv_villa', 'lv_terrace'],
      ['lv_villa', 'lv_villa', 'lv_terrace', 'lv_terrace', 'lv_skyres'],
      ['lv_estate', 'lv_estate', 'lv_mansion', 'lv_lodge', 'lv_marina'],
    ],
    'Levy University': [
      ['lv_campus', 'lv_campus', 'lv_campus', 'lv_villa'],
      ['lv_campus', 'lv_campus', 'lv_terrace'],
      ['lv_campus', 'lv_campus', 'lv_lawnplaza', 'lv_terrace'],
    ],
  };
  const route = (name, x, z, s, r) => {
    if (!H.frame() || name === 'lv_garden') return K[name];
    if (parkField(x, z) > PARK_T) return K.lv_garden;
    const ok = ALLOW[area(x, z)]?.[SIZE(s)];
    return ok ? K[pick(r, ok)] : K[name];
  };
  const kits = {};
  for (const name of Object.keys(K)) kits[name] = (x, z, s, st, b, r) => route(name, x, z, s, r)(x, z, s, st, b, r);

  LIB = { kits, area, axesOf, boxIn, glowIn, p3, lawn, lamp, tree, boat, reflect, glassOf, mansionAt, villaAt, campusAt, roofKit, front, pick, dim, fvRy,
    terraceAt, skyresAt, gardenAt, estateAt, apartmentsAt, iconAt, fitRect, fringe, shore,
    C: { GARDEN, LAWN, HEDGE, WATER, DECK, STONE, WOOD, TILE, CREAM, BRICK, GRANITE, SILVER, WHITE, WARM, ORANGE, TEAL, GOLD, ROSE, COLD, POLICE } };
  return LIB;
}

export function kits(H) { return lib(H).kits; }

export const tiers = {
  'laguna-velasco': {
    0: ['lv_villa', 'lv_villa', 'lv_terrace', 'lv_skyres', 'lv_campus'],
    1: ['lv_mansion', 'lv_villa', 'lv_terrace', 'lv_skyres', 'lv_marina', 'lv_ziggurat', 'lv_lawnplaza', 'lv_campus', 'lv_gardenring'],
    2: ['lv_govarc', 'lv_sailtower', 'lv_gardenring', 'lv_ziggurat', 'lv_lawnplaza', 'lv_campus', 'lv_mansion'],
    3: ['lv_govarc', 'lv_govarc', 'lv_sailtower', 'lv_sailtower', 'lv_gardenring'],
  },
};

// ---------- block kits ----------

export function blocks(H) {
  const { SKINS, bld, glow, prop, pool, beam, grammarTowerBody } = H;
  const L = lib(H), { C, axesOf, boxIn, glowIn, p3, lawn, lamp, tree, boat, reflect, glassOf, mansionAt, villaAt, campusAt, terraceAt, skyresAt, gardenAt, estateAt, apartmentsAt, iconAt, fitRect, fringe, shore, front, dim, pick } = L;

  const B = {
    // Civic arcology campus: twin white towers joined by skybridges, a long reflecting pool, allées and a raised jogging loop.

    lv_civic(x, z, w, d, st, r) {
      const A = axesOf(x, z, w, d, front()), { L: Lu, S } = A, gl = glowIn(A);
      lawn(x, z, w, d);
      const h = st.h1 * (3 + 1.5 * r()), t1 = [-Lu * .18, -S * .18, Math.min(38, Lu * .3), Math.min(30, S * .3)], t2 = [Lu * .24, -S * .2, Math.min(26, Lu * .22), Math.min(26, S * .26)];
      for (const [u, v, lu, lv, th, plan] of [[...t1, h, 'rect'], [...t2, h * (.55 + .2 * r()), 'oct']]) {
        const [px, pz] = A.at(u, v), [bw, bd] = A.sz(lu, lv);
        grammarTowerBody(px, pz, bw, bd, th, glassOf(st, r, .5), r, { plan, skirt: 'podium', skin: SKINS.curtain, flank: 'none', profile: 'setback', crown: plan === 'rect' ? 'ring' : 'helipad' });
      }
      for (const k of [.22, .4]) {
        const [px, pz] = A.at((t1[0] + t2[0]) / 2, -S * .19), [bw, bd] = A.sz(t2[0] - t1[0] - 10, 5);
        bld(px, pz, bw, bd, 5, glassOf(st, r, .9), r, { y0: h * k, roof: false, skin: SKINS.curtain, glow: .3 });
      }
      reflect(A, 0, S * .22, Lu * .55, S * .14);
      for (const sd of [-1, 1]) for (let k = 0; k < 6; k++) {
        const [px, pz] = A.at((k - 2.5) * Lu * .1, S * .22 + sd * (S * .07 + 4));
        tree(px, .3, pz, 8 + r() * 3, r, 'cypress');
      }

      // Raised jogging loop of reflexive concrete: an orange-lit ribbon on posts round the lawn.

      const ru = Lu / 2 - 4, rv = S / 2 - 4, ring = [[-ru, -rv], [ru, -rv], [ru, rv], [-ru, rv]];
      for (let k = 0; k < 4; k++) {
        const a = ring[k], c = ring[(k + 1) % 4];
        beam(p3(A, a[0], 5, a[1]), p3(A, c[0], 5, c[1]), 1.2, [.12, .12, .12]);
        beam(p3(A, a[0], 5.7, a[1]), p3(A, c[0], 5.7, c[1]), .2, dim(C.ORANGE, .5), 'glow');
        for (let q = 0; q < 1; q += 16 / Math.hypot(c[0] - a[0], c[1] - a[1])) {
          const [px, pz] = A.at(a[0] + (c[0] - a[0]) * q, a[1] + (c[1] - a[1]) * q);
          prop('cyl', px, 2.5, pz, .6, 5, .6, [.1, .1, .1]);
        }
      }
      for (const sd of [-1, 1]) { lamp(...A.at(sd * Lu * .3, S * .42)); lamp(...A.at(sd * Lu * .3, -S * .42)); }
      gl(0, S / 2 - 1, 16, .3, .2, 1.2, dim(C.GOLD, .3));
    },

    // Channel estate: two channels cut the block into islands of mansions and villas, with bridges, jetties and boats.

    lv_channels(x, z, w, d, st, r) {
      const fv = front(), A = axesOf(x, z, w, d, fv), { L: Lu, S } = A, box = boxIn(A), gl = glowIn(A);
      const cw = 10 + 4 * r(), cu = (r() - .5) * Lu * .3, cv = (r() - .5) * S * .2;
      box('box', 0, cv, Lu + 4, cw, .1, .16, C.WATER);
      box('box', cu, 0, cw, S + 4, .1, .16, C.WATER);
      for (let k = 0; k < 8; k++) gl((r() - .5) * Lu * .9, cv + (r() - .5) * cw * .6, 4 + r() * 6, .25, .26, .02, [.22, .13, .06]);
      const isl = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (const [su, sv] of isl) {
        const u0 = su < 0 ? -Lu / 2 : cu + cw / 2, u1 = su < 0 ? cu - cw / 2 : Lu / 2, v0 = sv < 0 ? -S / 2 : cv + cw / 2, v1 = sv < 0 ? cv - cw / 2 : S / 2;
        const lu = u1 - u0 - 2, lv = v1 - v0 - 2;
        if (lu < 16 || lv < 16) { const [px, pz] = A.at((u0 + u1) / 2, (v0 + v1) / 2), [iw, id] = A.sz(Math.max(lu, 2), Math.max(lv, 2)); lawn(px, pz, iw, id); continue; }
        const [px, pz] = A.at((u0 + u1) / 2, (v0 + v1) / 2), [iw, id] = A.sz(lu, lv), ifv = [fv[0] * sv, fv[1] * sv];
        (r() < .7 ? mansionAt : villaAt)(px, pz, iw, id, st, r, ifv, false);

        // A jetty and a boat on the main channel.

        const ju = (u0 + u1) / 2 + (r() - .5) * lu * .4, jv = sv < 0 ? cv - cw / 2 : cv + cw / 2;
        box('box', ju, jv - sv * cw * .3, 2.2, cw * .6, .2, .5, C.WOOD);
        const [bx, bz] = A.at(ju + 3.5, cv);
        boat(bx, bz, !!fv[1], 7 + r() * 3, r);
      }

      // Bridges: stone decks with lit rails over both channels.

      for (const [u, v, lu, lv] of [[(cu - Lu / 2) / 2, cv, 6, cw + 4], [(cu + Lu / 2) / 2, cv, 6, cw + 4], [cu, (cv + S / 2) / 2, cw + 4, 6]]) {
        box('box', u, v, lu, lv, 1.2, .6, dim(C.STONE, .8));
        for (const s of [-1, 1]) gl(u + (lu < lv ? s * lu / 2 : 0), v + (lu < lv ? 0 : s * lv / 2), lu < lv ? .2 : lu, lu < lv ? lv : .2, 2.2, .15, dim(C.WARM, .5));
      }
    },

    // Levy quad: a block-scale campus with a student tower and a clock tower in the quad.

    lv_quad(x, z, w, d, st, r) {
      const fv = front(), A = axesOf(x, z, w, d, fv);
      campusAt(x, z, w, d, st, r, fv, true);
      const [px, pz] = A.at(0, -A.S * .05);
      bld(px, pz, 6, 6, 32, { ...st, base: dim(C.BRICK, 1.1), win: C.WARM, lit: .2 }, r, { roof: false, skin: SKINS.sparse });
      bld(px, pz, 6.6, 6.6, 5, { ...st, base: [.07, .07, .08] }, r, { y0: 32, shape: 'pyr', lit: 0, roof: false });
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) glow(px + nx * 3.1, 28, pz + nz * 3.1, nx ? .1 : 3, 3, nz ? .1 : 3, dim(C.GOLD, .6));
    },

    // Residence court: two terraced wings step down to the street, a sky residence rises behind, a garden court lies between.

    lv_residence(x, z, w, d, st, r) {
      const fv = front(), A = axesOf(x, z, w, d, fv), { L: Lu, S } = A;
      lawn(x, z, w, d, 0, C.GARDEN);
      for (const sd of [-1, 1]) {
        const [px, pz] = A.at(sd * Lu * .3, S * .14), [bw, bd] = A.sz(Lu * .36, S * .62);
        terraceAt(px, pz, bw, bd, st, r, fv, 5 + Math.floor(r() * 2));
      }
      const [tx, tz] = A.at(0, -S * .3), [tw, td] = A.sz(Lu * .3, S * .34);
      skyresAt(tx, tz, tw, td, st, r, fv, 1.5);
      const [gx, gz] = A.at(0, S * .2), [gw, gd] = A.sz(Lu * .2, S * .55);
      gardenAt(gx, gz, gw, gd, r, fv);
    },

    // Estate block: one estate fills the block, or a long block splits into two estates side by side.

    lv_estate(x, z, w, d, st, r) {
      const fv = front(), A = axesOf(x, z, w, d, fv);
      if (A.L < 64 || r() < .6) { estateAt(x, z, w, d, st, r, fv); return; }
      const split = .38 + .24 * r();
      for (const [u, lu] of [[-A.L / 2 + A.L * split / 2, A.L * split], [A.L * split / 2, A.L * (1 - split)]]) {
        const [px, pz] = A.at(u, 0), [bw, bd] = A.sz(lu - 2, A.S);
        estateAt(px, pz, bw, bd, st, r, fv);
      }
    },

    // Luxury apartment block.

    lv_apartments(x, z, w, d, st, r) {
      apartmentsAt(x, z, w, d, st, r, front());
    },

    // Rare modernist tower. The router hands it out; named directly it picks a random form.

    lv_icon(x, z, w, d, st, r, form) {
      iconAt(x, z, w, d, st, r, front(), form ?? pick(r, ['twist', 'cantilever', 'stack', 'sail']));
    },

    // Park block: groves, a fountain plaza, promenades with lamps and a lit glass pavilion cafe.

    lv_park(x, z, w, d, st, r) {
      const fv = front(), A = axesOf(x, z, w, d, fv), { L: Lu, S } = A, pu = Lu * .3, pv = -S * .3;
      gardenAt(x, z, w, d, r, fv, [pu, pv, 11, 8]);
      const [px, pz] = A.at(pu, pv), [bw, bd] = A.sz(14, 9);
      bld(px, pz, bw, bd, 4.5, { ...st, base: [.1, .11, .12], win: C.WARM, lit: 1, grime: 0 }, r, { roof: false, kibble: false, skin: SKINS.curtain, glow: .4 });
      prop('box', px, 4.7, pz, bw + 3, .4, bd + 3, dim(C.STONE, .9));
      pool(px, pz, 10, [.1, .065, .03]);
    },
  };

  // Blocks follow the sub-area. Estates dominate Lakeside, apartments and civic courts Downtown, the quad at Levy.
  // Every builder gets the largest rectangle that fits inside the block polygon, so nothing spills onto streets.
  // Up to seven icon towers, at least 320 m apart, one form each in turn. Downtown and reservoir-edge blocks are likely picks; other Lakeside blocks are rare ones.

  const ROUTE = {
    Downtown: ['lv_civic', 'lv_residence', 'lv_apartments', 'lv_apartments', 'lv_apartments', 'lv_estate', 'lv_estate', 'lv_park'],
    Lakeside: ['lv_estate', 'lv_estate', 'lv_estate', 'lv_estate', 'lv_estate', 'lv_apartments', 'lv_apartments', 'lv_channels', 'lv_park'],
    'Levy University': ['lv_quad', 'lv_quad', 'lv_apartments', 'lv_estate', 'lv_park'],
  };

  // ponytail: icon picks live in this closure and assume blocks build in a stable order; a regenerate reuses them by position.

  const ICONS = [], FORMS = ['twist', 'sail', 'cantilever', 'stack'];
  const icon = (x, z, w, d, r) => {
    const [wx, wz] = H.worldOf(x, z), seen = ICONS.find(p => Math.hypot(p[0] - wx, p[1] - wz) < 1);
    if (seen) return seen[2];
    const prime = L.area(x, z) === 'Downtown' || shore(x, z, Math.max(w, d) / 2 + 110);
    const ok = ICONS.length < 7 && Math.min(w, d) >= 34 && L.area(x, z) !== 'Levy University'
      && ICONS.every(p => Math.hypot(p[0] - wx, p[1] - wz) > 320) && r() < (prime ? .7 : .1);
    if (!ok) return null;
    const form = FORMS[ICONS.length % FORMS.length];
    ICONS.push([wx, wz, form]);
    return form;
  };
  return Object.fromEntries(Object.entries(B).map(([name, fn]) => [name, { zone: 'laguna-velasco', build(x, z, w, d, st, r) {
    if (!H.frame()) { B[name](x, z, w, d, st, r); return; }
    const R = fitRect(x, z, w, d, 2), [fx, fz, fw, fd] = R;
    fringe(x, z, w, d, R, r);
    if (Math.min(fw, fd) < 24) { if (Math.min(fw, fd) > 8) gardenAt(fx, fz, fw, fd, r, front()); return; }
    const form = icon(fx, fz, fw, fd, r);
    if (form) { B.lv_icon(fx, fz, fw, fd, st, r, form); return; }
    const list = ROUTE[L.area(x, z)];
    B[list ? pick(r, list) : name](fx, fz, fw, fd, st, r);
  } }]));
}

// ---------- landmarks ----------

export function landmarks(H) {
  const { GLOWS, PROPS, SKINS, bld, glow, prop, put, pool, beam, textSign, helipad, beacon, flickerGlow } = H;
  const HOPPERS = [], HOP = {}, HOP_O = new H.THREE.Object3D(), HOP_C = new H.THREE.Color();
  const L = lib(H), { C, axesOf, boxIn, glowIn, p3, lawn, lamp, tree, reflect, front, dim, fvRy } = L;

  // A block point toward a map-px target, in the landmark's local frame.

  const localOf = ([mu, mv]) => {
    const f = H.frame(), X = (mu - 680) * 3.6 - f.tx, Z = (mv - 390) * 3.6 - f.tz;
    return [X * f.c - Z * f.s, X * f.s + Z * f.c];
  };

  // Cold security light on a pole.

  const secLight = (x, z, h = 7) => {
    prop('cyl', x, h / 2, z, .25, h, .25, [.06, .06, .07]);
    glow(x, h + .2, z, .7, .35, .7, dim(C.COLD, .9));
    pool(x, z, 7, [.07, .08, .1]);
  };

  return {
    // City Hall: a silver octagonal tower in a ring of office blocks, skywalks, hopper garages and security lights.

    lv_cityhall: { at: [690, 918], label: 'City Hall', minSide: 60, labelY: 270, build(x, z, w, d, st, r) {
      const A = axesOf(x, z, w, d, front()), { L: Lu, S } = A, gl = glowIn(A);
      const silver = { ...st, base: C.SILVER, win: [.8, .9, 1], lit: .5 }, office = { ...st, base: dim(C.WHITE, .9), win: [.78, .9, 1], lit: .4 };
      lawn(x, z, w, d);
      prop('box', x, .3, z, w * .5, .4, d * .5, [.09, .09, .1]);
      let y = 0, rad = Math.min(Lu, S) * .17;
      for (const [sh, k] of [[90, 1], [70, .82], [50, .64], [30, .46]]) {
        bld(x, z, rad * 2 * k, rad * 2 * k, sh, silver, r, { y0: y, shape: 'oct', roof: false, skin: SKINS.fins, glow: .45 });
        y += sh;
        put(GLOWS.ring, x, y + .3, z, rad * 2.2 * k, 1, rad * 2.2 * k, 0, 0, dim(C.COLD, .7));
      }
      prop('cone', x, y + 20, z, 3, 40, 3, [.3, .32, .35]);
      beacon(x, y + 40.5, z, r);

      // Ring of offices and the skywalks that tie them to the tower.

      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3 + Math.PI / 6, ox = Math.cos(a) * Math.min(Lu, S) * .36, oz = Math.sin(a) * Math.min(Lu, S) * .36, oh = 26 + 22 * r();
        bld(x + ox, z + oz, 16, 16, oh, office, r, { roof: false, skin: SKINS.grid });
        prop('box', x + ox, oh + 1, z + oz, 6, 2, 6, [.1, .1, .11]);
        for (const sy of [14, oh - 6]) {
          beam([x + ox * .78, sy, z + oz * .78], [x + ox * .3, sy, z + oz * .3], 3, [.14, .15, .17]);
          beam([x + ox * .78, sy - 1.6, z + oz * .78], [x + ox * .3, sy - 1.6, z + oz * .3], .2, dim(C.COLD, .6), 'glow');
        }
      }

      // Municipal hopper garage with pads, at the back.

      const [gx, gz] = A.at(0, -S / 2 + 9), [gw, gd] = A.sz(Lu * .6, 14);
      bld(gx, gz, gw, gd, 10, office, r, { roof: false, skin: SKINS.bands, lit: .55 });
      for (const k of [-1, 0, 1]) { const [hx, hz] = A.at(k * Lu * .18, -S / 2 + 9); helipad(hx, hz, 10, 10, r); }

      // Front steps, name, flags and the security perimeter.

      textSign('CIUDAD DE NUEVO ANGELES', ...p3(A, 0, 7, S / 2 - 6), 30, 3.4, fvRy(front()), dim(C.GOLD, .9));
      for (let k = -2; k <= 2; k++) { const [px, pz] = A.at(k * 5, S / 2 - 3); prop('cyl', px, 7, pz, .2, 14, .2, [.2, .2, .2]); glow(px + .9, 13, pz, 1.6, 1, .1, dim(k % 2 ? C.TEAL : C.GOLD, .5)); }
      for (let k = 0; k < 8; k++) { const [px, pz] = A.at((k % 4 - 1.5) * Lu * .3, (k < 4 ? 1 : -1) * (S / 2 - 1.5)); secLight(px, pz); }
      for (const s of [-1, 1]) { gl(0, s * (S / 2 - .5), Lu - 2, .2, .4, .3, dim(C.COLD, .3)); gl(s * (Lu / 2 - .5), 0, .2, S - 2, .4, .3, dim(C.COLD, .3)); }
      for (let k = 0; k < 6; k++) { const a = k * 1.05; tree(x + Math.cos(a) * rad * 1.9, .3, z + Math.sin(a) * rad * 1.9, 6 + r() * 3, r, 'cypress'); }
      return { face: front() };
    } },

    // NAPD headquarters: a granite monolith on a pier out in the reservoir, hopper launch tubes at mid height.
    // The pier runs straight out along the block axis that points most toward the lake.

    lv_napd: { at: [699, 953], label: 'NAPD Headquarters', minSide: 46, labelY: 240, build(x, z, w, d, st, r) {
      const [lx, lz] = localOf([719, 953]), ax = Math.abs(lx) > Math.abs(lz);
      const ux = ax ? Math.sign(lx) : 0, uz = ax ? 0 : Math.sign(lz), edge = (ax ? w : d) / 2;
      const MW = 40, MD = 40, P = 64, H1 = 70, H2 = 34, H3 = 78, want = edge + 100 + P / 2;
      const mx = ux * want, mz = uz * want, top = 4 + H1 + H2 + H3;
      const gran = { ...st, base: C.GRANITE, win: [.7, .82, 1], lit: .12, grime: .3 }, deck = { ...st, base: dim(C.GRANITE, .8), win: dim(C.POLICE, .7), lit: .7 };

      // Pier platform with lit edges, then the body in three bands: granite, the recessed launch deck, granite.

      prop('box', mx, 2, mz, P, 4, P, [.06, .06, .065]);
      for (const s of [-1, 1]) { glow(mx + s * (P / 2 + .1), 4.1, mz, .2, .3, P, dim(C.COLD, .5)); glow(mx, 4.1, mz + s * (P / 2 + .1), P, .3, .2, dim(C.COLD, .5)); }
      for (const [cx, cz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) secLight(mx + cx * (P / 2 - 3), mz + cz * (P / 2 - 3), 6);
      pool(mx, mz, 45, dim(C.POLICE, .05));
      bld(mx, mz, MW + 6, MD + 6, 6, gran, r, { y0: 4, roof: false, lit: 0 });
      bld(mx, mz, MW, MD, H1, gran, r, { y0: 4, roof: false, skin: SKINS.sparse });
      bld(mx, mz, MW - 8, MD - 8, H2, deck, r, { y0: 4 + H1, roof: false, skin: SKINS.bands, glow: .3 });
      bld(mx, mz, MW, MD, H3, gran, r, { y0: 4 + H1 + H2, roof: false, skin: SKINS.sparse });
      for (const y of [4 + H1, 4 + H1 + H2]) prop('box', mx, y, mz, MW + 1, 1.2, MD + 1, [.05, .05, .055]);
      bld(mx, mz, MW * .6, MD * .6, 12, gran, r, { y0: top, roof: false, skin: SKINS.fins });
      prop('cyl', mx, top + 12 + 15, mz, .8, 30, .8, [.12, .12, .13]);
      beacon(mx, top + 42, mz, r);
      for (const s of [-1, 1]) helipad(mx + s * 6, mz - s * 6, 9, top + 12, r);

      // Vertical plascrete ribs on the granite bands, and the name high on every face.

      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const out = MW / 2 + .4, ry = Math.atan2(nx, nz);
        for (const k of [-1.5, -.5, .5, 1.5]) for (const [y0, h] of [[4, H1], [4 + H1 + H2, H3]]) {
          prop('box', mx + nx * out - nz * k * MW * .25, y0 + h / 2, mz + nz * out + nx * k * MW * .25, nx ? .8 : 1.4, h, nx ? 1.4 : .8, [.05, .05, .055]);
        }
        textSign('NAPD', mx + nx * (out + .5), top - 14, mz + nz * (out + .5), MW * .55, MW * .14, ry, dim(C.POLICE, .7));
      }

      // Launch tubes: three ports per face in the deck band. Hoppers launch from them and climb away over the lake.

      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const out = (MW - 8) / 2, ry = Math.atan2(nx, nz), len = 6;
        for (let k = -1; k <= 1; k++) {
          const ty = 4 + H1 + H2 / 2, al = k * MW * .28;
          const bx = mx + nx * (out + len / 2) - nz * al, bz = mz + nz * (out + len / 2) + nx * al;
          prop('cyl', bx, ty, bz, 6, len, 6, [.09, .09, .1], ry, Math.PI / 2);
          put(GLOWS.ring, bx + nx * len / 2, ty, bz + nz * len / 2, 6.2, 1, 6.2, ry, Math.PI / 2, dim(C.COLD, 1.1));
          glow(bx + nx * (len / 2 - .3), ty, bz + nz * (len / 2 - .3), nx ? .2 : 4.4, 4.4, nz ? .2 : 4.4, dim(C.POLICE, .6));
          for (let j = 0; j < 2; j++) HOPPERS.push({ x: bx + nx * len / 2, z: bz + nz * len / 2, y: ty, nx, nz, k: k || (j ? 1 : -1), ph: r() * .5 + j * .5, sp: .05 + r() * .02 });
        }
      }

      // Hoppers get their own meshes in the landmark group, because shared instances are frozen into tiles after the build.

      const n = HOPPERS.length, T = H.THREE;
      HOP.body = new T.InstancedMesh(PROPS.box.geometry, PROPS.box.material, n);
      HOP.light = new T.InstancedMesh(GLOWS.sphere.geometry, GLOWS.sphere.material, n * 2);
      for (let i = 0; i < n; i++) {
        HOP.body.setColorAt(i, HOP_C.setRGB(.08, .09, .11));
        HOP.light.setColorAt(i * 2, HOP_C.setRGB(...dim(C.POLICE, 1.4)));
        HOP.light.setColorAt(i * 2 + 1, HOP_C.setRGB(1.8, .15, .15));
      }
      for (const m of [HOP.body, HOP.light]) { m.userData.noTile = true; m.frustumCulled = false; H.decor.add(m); }

      // Causeway from the shore annex to the pier, square to both, with lit rails and pylons.

      const sx0 = ux * (edge - 4), sz0 = uz * (edge - 4), ex = mx - ux * P / 2, ez = mz - uz * P / 2;
      beam([sx0, 3, sz0], [ex, 3, ez], 9, [.08, .08, .09]);
      for (const s of [-1, 1]) beam([sx0 + uz * s * 4.2, 4.2, sz0 + ux * s * 4.2], [ex + uz * s * 4.2, 4.2, ez + ux * s * 4.2], .2, dim(C.COLD, .6), 'glow');
      for (let t = .1; t < 1; t += .15) prop('box', sx0 + (ex - sx0) * t, 1, sz0 + (ez - sz0) * t, ax ? 2 : 8, 2, ax ? 8 : 2, [.05, .05, .055]);
      prop('box', x, .3, z, w, .4, d, [.06, .06, .065]);
      bld(x - ux * w * .15, z - uz * d * .15, ax ? w * .45 : w * .6, ax ? d * .6 : d * .45, 16, gran, r, { roof: false, skin: SKINS.bands, lit: .3 });
      glow(sx0 * .95, 2, sz0 * .95, 3, 3, 3, dim(C.POLICE, .6));
      for (const [px, pz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) secLight(x + px * (w / 2 - 2), z + pz * (d / 2 - 2), 9);
      helipad(x - uz * w * .28 + ux * w * .2, z + ux * d * .28 + uz * d * .2, 12, 0, r);
      return [mx, mz];
    }, update(t) {

      // Each hopper leaves its port, swings out to one side and climbs; it shrinks away near the end of the loop.

      HOPPERS.forEach((q, i) => {
        const f = (t * q.sp + q.ph) % 1, o = f * f * 520, lat = q.k * f * f * f * 220, y = q.y + f * f * 160;
        const hx = q.nx * 1040 * f - q.nz * 660 * q.k * f * f, hz = q.nz * 1040 * f + q.nx * 660 * q.k * f * f;
        const lx = q.x + q.nx * o - q.nz * lat, lz = q.z + q.nz * o + q.nx * lat, s = f > .85 ? (1 - f) / .15 : Math.min(1, f * 30);
        const ry = Math.atan2(hx, hz), fx = Math.sin(ry), fz = Math.cos(ry);
        HOP_O.rotation.set(0, ry, 0);
        HOP_O.position.set(lx, y, lz); HOP_O.scale.set(2.2 * s, 1 * s, 4.4 * s); HOP_O.updateMatrix(); HOP.body.setMatrixAt(i, HOP_O.matrix);
        HOP_O.position.set(lx + fx * 2.3 * s, y + .3 * s, lz + fz * 2.3 * s); HOP_O.scale.setScalar(1.1 * s); HOP_O.updateMatrix(); HOP.light.setMatrixAt(i * 2, HOP_O.matrix);
        HOP_O.position.set(lx - fx * 2.3 * s, y, lz - fz * 2.3 * s); HOP_O.scale.setScalar(.8 * s); HOP_O.updateMatrix(); HOP.light.setMatrixAt(i * 2 + 1, HOP_O.matrix);
      });
      if (HOP.body) HOP.body.instanceMatrix.needsUpdate = HOP.light.instanceMatrix.needsUpdate = true;
    } },

    // Nuevo Angeles Opera House: an Incan step pyramid with gold terraces, a glowing stair and a glass crown hall.

    lv_opera: { at: [668, 900], label: 'Opera House', minSide: 50, labelY: 110, build(x, z, w, d, st, r) {
      const A = axesOf(x, z, w, d, front()), { L: Lu, S } = A, gl = glowIn(A);
      const os = { ...st, base: dim([.22, .18, .14], 1), win: C.GOLD.map(c => c * .7), lit: .12 };
      lawn(x, z, w, d);
      prop('box', x, .3, z, w * .9, .4, d * .9, [.1, .09, .08]);
      let lu = Lu * .78, lv = S * .7, y = 0;
      const n = 8, v0 = -S * .04;
      for (let k = 0; k < n; k++) {
        const sh = 6, [px, pz] = A.at(0, v0), [bw, bd] = A.sz(lu, lv);
        bld(px, pz, bw, bd, sh, os, r, { y0: y, roof: false, skin: SKINS.bands });
        y += sh;
        for (const s of [-1, 1]) {
          gl(0, v0 + s * (lv / 2 + .1), lu * .98, .2, y - .3, .3, dim(C.GOLD, .55));
          gl(s * (lu / 2 + .1), v0, .2, lv * .98, y - .3, .3, dim(C.GOLD, .4));
        }
        lu -= Lu * .07; lv -= S * .065;
      }

      // Grand stair up the front face, trapezoid portals at the foot.

      const fv0 = v0 + S * .35 + 2, ftop = v0 + (lv + S * .065) / 2;
      beam(p3(A, 0, .5, fv0 + 6), p3(A, 0, y - 1, ftop), 9, [.16, .13, .1]);
      for (const s of [-1, 1]) beam(p3(A, s * 4.8, 1.6, fv0 + 6), p3(A, s * 4.8, y, ftop), .3, dim(C.GOLD, .8), 'glow');
      for (const s of [-2, -1, 1, 2]) {
        const [px, pz] = A.at(s * Lu * .14, fv0 + .3), [pw, pd] = A.sz(4, .3);
        glow(px, 3, pz, pw, 6, pd, dim(C.WARM, .8));
        glow(px, 6.4, pz, pw * .6, .8, pd, dim(C.WARM, .8));
      }

      // Glass crown hall with a rose halo.

      const [px, pz] = A.at(0, v0), [cw, cd] = A.sz(lu * .9, lv * .9);
      bld(px, pz, cw, cd, 12, { ...st, base: [.2, .17, .2], win: C.ROSE, lit: .7 }, r, { y0: y, roof: false, skin: SKINS.curtain, glow: .4 });
      put(GLOWS.ring, px, y + 13, pz, Math.max(cw, cd) * 1.3, 1, Math.max(cw, cd) * 1.3, 0, 0, dim(C.ROSE, .8));
      bld(px, pz, cw * 1.05, cd * 1.05, 6, { ...st, base: [.1, .09, .08] }, r, { y0: y + 12, shape: 'pyr', lit: 0, roof: false });

      // Plaza: fountain, lamps, trees, name.

      const [fx, fz] = A.at(0, S / 2 - 7);
      prop('cyl', fx, .3, fz, 12, .4, 12, C.WATER);
      put(GLOWS.ring, fx, .6, fz, 12, 1, 12, 0, 0, dim(C.TEAL, .6));
      put(GLOWS.sphere, fx, 1.5, fz, 1.6, 2.4, 1.6, 0, 0, dim(C.TEAL, .5));
      textSign('OPERA NUEVO ANGELES', ...p3(A, 0, 3.5, fv0 + 1.5), 22, 2.8, fvRy(front()), dim(C.GOLD, 1));
      for (let k = -3; k <= 3; k++) if (k) lamp(...A.at(k * Lu * .14, S / 2 - 2));
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const [tx, tz] = A.at(s * (Lu / 2 - 4), (k - 1) * S * .3); tree(tx, .3, tz, 8 + r() * 3, r, 'palm'); }
      return { face: front() };
    } },

    // Federal Courthouse: a squat, heavy granite ziggurat with slit windows, a colonnade and cold uplights.

    lv_courthouse: { at: [640, 945], label: 'Federal Courthouse', minSide: 50, labelY: 90, build(x, z, w, d, st, r) {
      const A = axesOf(x, z, w, d, front()), { L: Lu, S } = A, gl = glowIn(A);
      const cs = { ...st, base: dim([.11, .1, .09], 1), win: [.85, .9, 1], lit: .18, grime: .2 };
      lawn(x, z, w, d);
      let lu = Lu * .82, lv = S * .72, y = 0;
      const v0 = -S * .05;
      for (const [sh, k] of [[16, .86], [13, .84], [11, .8], [9, .78]]) {
        const [px, pz] = A.at(0, v0), [bw, bd] = A.sz(lu, lv);
        bld(px, pz, bw, bd, sh, cs, r, { y0: y, roof: false, skin: SKINS.fins });
        y += sh;
        prop('box', px, y + .3, pz, bw + 1, .6, bd + 1, [.09, .085, .08]);
        lu *= k; lv *= k;
      }
      const [px, pz] = A.at(0, v0), [tw, td] = A.sz(lu, lv);
      bld(px, pz, tw * .6, td * .6, 8, cs, r, { y0: y, roof: false, skin: SKINS.sparse, lit: .4 });
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) beam([px + cx * tw * .42, y, pz + cz * td * .42], [px + cx * tw * .42, y + 60, pz + cz * td * .42], .5, dim(C.COLD, .12), 'glow');

      // Colonnade and steps along the front.

      const fvv = v0 + S * .36;
      for (let k = -5; k <= 5; k++) { const [cx, cz] = A.at(k * Lu * .072, fvv + 1.5); prop('cyl', cx, 7, cz, 1.8, 14, 1.8, [.15, .14, .13]); }
      const [ex, ez] = A.at(0, fvv + 1.5), [ew, ed] = A.sz(Lu * .82, 3);
      prop('box', ex, 14.5, ez, ew, 1.4, ed, [.12, .11, .1]);
      for (let k = 0; k < 4; k++) { const [sx, sz] = A.at(0, fvv + 3.5 + k * 1.2), [sw, sd] = A.sz(Lu * .5, 1.2); prop('box', sx, (4 - k) * .3, sz, sw, (4 - k) * .6, sd, [.13, .12, .11]); }
      gl(0, fvv + .6, Lu * .7, .2, 1, 10, dim(C.COLD, .35));
      textSign('FEDERAL COURTHOUSE', ...p3(A, 0, 16.5, fvv + 3.3), 26, 2.6, fvRy(front()), dim(C.COLD, .7));
      for (let k = -2; k <= 2; k++) if (k) { const [lx, lz] = A.at(k * Lu * .2, S / 2 - 2); secLight(lx, lz, 6); }
      reflect(A, 0, S / 2 - 6, Lu * .4, 3);
      return { face: front() };
    } },
  };
}
