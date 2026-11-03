// Landmarks from the Tour Guide and Akeidito finds. See design/pdf-finds/.
// South family: Rabotgorod, Quinde and La Costa.

export const kits = () => ({});

const pick = (r, a) => a[Math.floor(r() * a.length)];
const dim = (rgb, f) => rgb.map(c => c * f);
const mapWorld = ([u, v]) => [(u - 680) * 3.6, (v - 390) * 3.6];

const CYAN = [.3, 1.4, 1.6], GOLD = [1.6, 1.05, .25], MERC = [.62, .78, .7], FIRE = [1.5, .55, .12];
const ORANGE = [1.6, .5, .08], COLD = [.95, 1.1, 1.35], STEEL = [.35, .75, 1.5], WARM = [1.1, .72, .38];
const MAG = [1.5, .2, 1.1], VIOLET = [.8, .3, 1.5], LIME = [.5, 1.5, .35];
const ASH = [.03, .027, .024], DARK = [.04, .04, .045];

export function landmarks(H) {
  const { THREE, GLOWS, PROPS, SKINS, beam, bld, flickerGlow, glow, pool, prop, puff, put, textSign } = H;

  // A u-v frame on the block. v points at the block's street front (or the given axis), u runs along it.
  // Fronts are axis-aligned, so sizes swap instead of rotating. dir turns a u-v direction into a local one.

  const uv = (x, z, w, d, F) => {
    const f = H.frame()?.front;
    F ??= f ? (Math.abs(f.x) > Math.abs(f.z) ? [Math.sign(f.x), 0] : [0, Math.sign(f.z)]) : [0, 1];
    const [fx, fz] = F, ax = -fz, az = fx;
    const P = (u, v) => [x + u * ax + v * fx, z + u * az + v * fz];
    const S = (su, sv) => fz ? [su, sv] : [sv, su];
    const face = (du, dv) => Math.atan2(du * ax + dv * fx, du * az + dv * fz);
    return {
      U: fz ? w : d, V: fz ? d : w, P, S, face, dir: (du, dv) => [du * ax + dv * fx, du * az + dv * fz],
      box: (u, y, v, su, sy, sv, rgb, kind = 'box') => { const [px, pz] = P(u, v), [sx, sz] = S(su, sv); return prop(kind, px, y, pz, sx, sy, sz, rgb); },
      gl: (u, y, v, su, sy, sv, rgb) => { const [px, pz] = P(u, v), [sx, sz] = S(su, sv); return glow(px, y, pz, sx, sy, sz, rgb); },
      fl: (u, y, v, s, rgb, r) => { const [px, pz] = P(u, v); flickerGlow(px, y, pz, s, s, s, rgb, r); },
      vol: (u, v, su, sv, h, st, r, o) => { const [px, pz] = P(u, v), [sx, sz] = S(su, sv); bld(px, pz, sx, sz, h, st, r, o); },
      pool: (u, v, rad, rgb) => pool(...P(u, v), rad, rgb),
      puff: (u, y, v, rad, rgb) => { const [px, pz] = P(u, v); puff(px, y, pz, rad, rgb); },
      beam: (a, b, t, rgb, kind) => { const [ax2, az2] = P(a[0], a[2]), [bx, bz] = P(b[0], b[2]); beam([ax2, a[1], az2], [bx, b[1], bz], t, rgb, kind); },
      sign: (text, u, y, v, sw, sh, rgb, du = 0, dv = 1) => { const [px, pz] = P(u, v); textSign(text, px, y, pz, sw, sh, face(du, dv), rgb); },
    };
  };

  // Standing figure.

  const fig = (T, u, v, r) => T.box(u, .85, v, .55, 1.7, .55, [.06 + .08 * r(), .06, .055], 'cyl');

  // Nearest coast point from a world spot: distance and unit direction toward it (seaward from land).

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
  const toLocalDir = (wx, wz) => { const f = H.frame(); return f ? [wx * f.c - wz * f.s, wx * f.s + wz * f.c] : [wx, wz]; };

  // ---------- Rabotgorod ----------

  // Scrapper's Square: a rubble lot beside a tall dead shell. The shell carries a lit mural of a human arm and
  // a bioroid arm clasping hands, cyan and gold, the only colour for blocks around. A shorter shell stands behind it.

  const mural = (x, z, w, d, st, r) => {
    const T = uv(x, z, w, d), U = Math.min(T.U, 70), V = Math.min(T.V, 70);
    const dead = { ...st, base: ASH, lit: 0, grime: 1 };
    T.box(0, .1, 0, U, .2, V, [.06, .058, .055]);

    // The mural is on the tall shell's -u face. The square opens on that side, so nothing stands in front of it.

    const wu = -U / 2 + Math.min(30, U * .45), mu = wu - 7.1, mh = 36, open = mu + U / 2;
    T.vol(wu, -2, 14, V * .8, mh, dead, r, { skin: SKINS.grid, roof: false });
    const sw = Math.min(12, U / 2 - wu - 9), su = U / 2 - 1 - sw / 2;
    if (sw > 5) {
      T.vol(su, -4, sw, V * .6, 20 + r() * 6, dead, r, { skin: SKINS.grid, roof: false });
      for (let k = 0; k < 3; k++) T.beam([su, 20, (r() - .5) * V * .4], [su - 4, 25 + r() * 5, (r() - .5) * V * .5], .6, [.04, .03, .025]);
    }

    // Mural: dark backing, two arms rising to a clasp, a halo ring and scattered paint stars.

    T.box(mu, 18, -2, .2, 30, V * .7, [.02, .02, .025]);
    T.beam([mu - .2, 6, -18], [mu - .2, 22, -3], 3, dim(CYAN, .9), 'glow');
    T.beam([mu - .2, 6, 14], [mu - .2, 22, -1], 3, dim(GOLD, .9), 'glow');
    for (const [v, c] of [[-20, CYAN], [16, GOLD]]) T.gl(mu - .2, 4, v, .3, 4, 6, dim(c, .6));
    const [hx, hz] = T.P(mu - .3, -2), fu = T.face(-1, 0), [ssx, ssz] = T.S(.4, 6);
    put(GLOWS.sphere, hx, 23, hz, ssx, 6, ssz, 0, 0, [1.6, 1.5, 1.3]);
    put(GLOWS.ring, hx, 23, hz, 22, 1, 22, fu, Math.PI / 2, dim(GOLD, .8));
    put(GLOWS.ring, hx, 23, hz, 16, 1, 16, fu, Math.PI / 2, dim(CYAN, .7));
    for (let k = 0; k < 14; k++) T.gl(mu - .25, 6 + r() * 26, -2 + (r() - .5) * V * .65, .2, .7, .7, r() < .5 ? CYAN : GOLD);
    T.pool(mu - open * .5, -2, 20, dim(CYAN, .08));

    // Rubble, trash fires, smoke and the crowd under the wall.

    for (let k = 10 + Math.floor(r() * 6); k > 0; k--) T.box(-U / 2 + 2 + r() * Math.max(2, open - 4), .6, (r() - .5) * V * .7, 1.5 + r() * 4, 1.2 + r() * 1.2, 1.5 + r() * 3, [.05 + .03 * r(), .045, .04]);
    for (let k = 0; k < 2; k++) {
      const u = mu - open * (.35 + k * .4), v = (k - .5) * 14;
      T.box(u, .5, v, 1, 1, 1, [.1, .07, .05], 'cyl');
      T.fl(u, 1.3, v, .8, FIRE, r);
      T.pool(u, v, 6, [.14, .06, .01]);
      for (let j = 0; j < 3; j++) T.puff(u + j * .8, 4 + j * 3, v, 1.5 + j, [.07, .07, .075]);
      for (let j = 0; j < 7; j++) { const a = r() * 6.3; fig(T, u + Math.cos(a) * 3, v + Math.sin(a) * 3, r); }
    }
    T.sign('SCRAPPER’S SQUARE', mu - open * .5, 4, V / 2 - .5, 12, 2.6, dim(GOLD, .4));
    return { face: T.dir(-1, 0) };
  };

  // Chone "Green Valley" Boulevard: a straight walk through grey slabs, lined with identical bioplastic
  // trees that glow from inside, EverGreen verges and g-modded bushes, a welcome gantry at one end.

  const chone = (x, z, w, d, st, r) => {
    const along = w >= d, L = along ? w : d, S = along ? d : w;
    const at = (u, v) => along ? [x + u, z + v] : [x + v, z + u];
    const sz = (su, sv) => along ? [su, sv] : [sv, su];
    const box = (u, y, v, su, sy, sv, rgb, kind = 'box') => { const [px, pz] = at(u, v), [a, b] = sz(su, sv); prop(kind, px, y, pz, a, sy, b, rgb); };
    const gl = (u, y, v, su, sy, sv, rgb) => { const [px, pz] = at(u, v), [a, b] = sz(su, sv); glow(px, y, pz, a, sy, b, rgb); };
    const grey = { ...st, base: [.11, .108, .105], win: MERC, lit: .05, grime: .8 };

    // Paving, the walk and two lime verges.

    box(0, .1, 0, L, .2, S, [.07, .07, .07]);
    box(0, .2, 0, L, .1, 12, [.11, .11, .1]);
    for (const g of [-1, 1]) {
      box(0, .3, g * 8, L - 2, .15, 3, [.05, .2, .05]);
      gl(0, .4, g * 8, L - 2, .04, 3, dim(LIME, .18));
    }

    // Trees in perfect rows, every 6 m, with a bush between each pair.

    for (const g of [-1, 1]) for (let u = -L / 2 + 4; u <= L / 2 - 4; u += 6) {
      const [px, pz] = at(u, g * 8);
      prop('cyl', px, 2, pz, .5, 4, .5, [.25, .3, .22]);
      put(GLOWS.sphere, px, 5.5, pz, 4.4, 3.6, 4.4, 0, 0, dim(LIME, .55));
      const [bx, bz] = at(u + 3, g * 8);
      if (u + 3 < L / 2 - 2) put(GLOWS.sphere, bx, .9, bz, 1.6, 1.2, 1.6, 0, 0, dim(MAG, .5));
    }

    // Dull grey slabs on both sides stay as they were.

    for (const g of [-1, 1]) {
      const n = L > 70 ? 2 : 1, sl = (L - 6) / n - 4, t = Math.max(8, S / 2 - 14);
      for (let k = 0; k < n; k++) {
        const [px, pz] = at(-L / 2 + 3 + sl / 2 + k * (sl + 4), g * (S / 2 - t / 2 - 1)), [a, b] = sz(sl, t);
        bld(px, pz, a, b, 24 + r() * 14, grey, r, { skin: SKINS.grid });
      }
    }

    // Welcome gantry across the walk.

    const eu = L / 2 - 2;
    for (const g of [-1, 1]) box(eu, 5, g * 7, .8, 10, .8, [.3, .32, .3]);
    box(eu, 10.4, 0, 1, 1.4, 15, [.2, .22, .2]);
    gl(eu, 9.6, 0, .2, .2, 14.4, dim(LIME, .8));
    const [sx, sz2] = at(eu + .6, 0);
    textSign('WELCOME TO GREEN VALLEY', sx, 12.6, sz2, 16, 2.6, along ? Math.PI / 2 : 0, LIME);
    put(GLOWS.sphere, sx, 15.4, sz2, 2.4, 2.4, 2.4, 0, 0, dim(LIME, .9));

    // The gantry sign faces +u, out of the walk's far end.

    return { face: along ? [1, 0] : [0, 1] };
  };

  // ---------- Quinde ----------

  // Arms and Hammers: a squat Colonche shop with a roller shutter, barred windows and a hot orange
  // sign of a crossed rifle and sledgehammer. Run-down sheds fill the rest of the block.

  const arms = (x, z, w, d, st, r) => {
    const T = uv(x, z, w, d), sv = T.V / 2 - 9;
    const shell = { ...st, base: [.09, .075, .06], win: [1, .62, .3], lit: .12, grime: .9 };
    T.box(0, .1, 0, T.U, .2, T.V, [.05, .045, .04]);
    T.vol(0, sv, 18, 14, 8, shell, r, { skin: SKINS.sparse, roof: false });
    T.box(0, 8.3, sv, 18.4, .6, 14.4, [.06, .055, .05]);
    const fv = sv + 7.05;

    // Shutter, barred windows, door light.

    T.box(-3, 2, fv, 6, 4, .2, [.16, .16, .17]);
    for (let k = 0; k < 8; k++) T.box(-3, .4 + k * .5, fv + .12, 6, .06, .05, [.08, .08, .08]);
    for (const u of [4.5, -7.5]) {
      T.gl(u, 2.4, fv + .05, 3, 1.8, .1, dim(WARM, .7));
      for (let b = -1.2; b <= 1.2; b += .6) T.box(u + b, 2.4, fv + .15, .12, 2, .12, DARK);
    }
    T.gl(4.5, 5.6, fv + .05, 3, 1.2, .1, dim(WARM, .45));
    T.gl(-3, 4.4, fv + .3, 6, .2, .5, dim(ORANGE, .6));

    // Sign: a dark board on the roof with crossed rifle and hammer.

    const sy = 12.5, bv = fv - .5;
    T.box(0, sy, bv - .2, 10, 6, .3, DARK);
    T.beam([-3.5, sy - 2.2, bv], [3.5, sy + 2.2, bv], .4, ORANGE, 'glow');
    T.beam([-3.5, sy - 2.2, bv], [-4.8, sy - 2.8, bv], .9, ORANGE, 'glow');
    T.beam([3.5, sy - 2.2, bv], [-2.6, sy + 1.6, bv], .35, ORANGE, 'glow');
    T.beam([-3.4, sy + 1.2, bv], [-1.8, sy + 2.6, bv], 1.4, ORANGE, 'glow');
    for (const u of [-4, 4]) T.box(u, 9.5, bv - .2, .3, 2.4, .3, DARK);
    T.sign('ARMS AND HAMMERS', 0, 7.4, fv + .4, 12, 1.2, ORANGE);

    // Regulars on the pavement.

    T.pool(0, fv + 5, 10, dim(ORANGE, .12));
    for (let k = 0; k < 9; k++) fig(T, (r() - .5) * 14, fv + 2 + r() * 4, r);

    // Sheds behind.

    for (let k = 0; k < 3; k++) {
      const u = (k - 1) * T.U * .3;
      T.vol(u, -T.V / 2 + 14, T.U * .26, 20, 7 + r() * 5, { ...shell, lit: .04 }, r, { skin: SKINS.bands });
    }
    for (let k = 0; k < 2; k++) T.gl((r() - .5) * T.U * .6, 5, -T.V / 2 + 24.2, 2, .3, .2, dim(ORANGE, .5));
    return { face: T.dir(0, 1) };
  };

  // Golem Grove Chop Shops: an alley of lean-tos against a clean Haas-Bioroid factory wall. Cold work lamps,
  // welding sparks, hanging limbs, hand-made signs. A row of tin shacks closes the alley's street side.

  const chop = (x, z, w, d, st, r) => {
    const T = uv(x, z, w, d), L = Math.min(T.U - 6, 90), wv = -T.V / 2 + 9;
    const hb = { ...st, base: [.1, .13, .18], win: [.8, .9, 1.05], lit: .3, grime: .2 };
    const tin = { ...st, base: [.11, .09, .07], win: COLD, lit: .1, grime: .95 };
    T.box(0, .1, 0, T.U, .2, T.V, [.045, .045, .05]);

    // Factory wall: a long HB shed with a steel-blue band.

    T.vol(0, wv, L, 14, 18, hb, r, { skin: SKINS.bands, roof: false });
    T.gl(0, 16.5, wv + 7.05, L, .5, .1, dim(STEEL, .7));
    T.sign('HAAS-BIOROID · GOLEM GROVE', 0, 13, wv + 7.15, 18, 2, dim(STEEL, .9));

    // Lean-tos along the wall.

    const NAMES = ['ARMS', 'JOINTS', 'NO SERIALS', 'OPTICS', 'TUNE-UP', 'PARTS', 'SKINWORK'];
    const n = Math.max(4, Math.floor(L / 13)), step = L / n, lv = wv + 7 + 3;
    for (let k = 0; k < n; k++) {
      const u = -L / 2 + step * (k + .5), lw = step - 1.5, h = 4 + r();
      T.box(u, h, lv, lw, .3, 6.4, [.12 + .05 * r(), .1, .08]);
      for (const g of [-1, 1]) T.box(u + g * lw / 2, h / 2, lv + 3, .25, h, .25, DARK);
      T.gl(u, h - .4, lv, 1.2, .2, .4, COLD);
      T.pool(u, lv + 2, 6, dim(COLD, .12));
      T.box(u - lw * .25, 1, lv - 1, 2.4, 2, 1.4, [.14, .14, .15]);
      if (r() < .7) T.fl(u + (r() - .5) * lw * .5, 1 + r(), lv + (r() - .5) * 3, .35, [1.6, 1.7, 2], r);

      // Hanging limbs on the awning edge.

      for (let j = 0; j < 3; j++) {
        const lu = u + (j - 1) * lw * .3, len = 1.4 + r() * .8;
        T.beam([lu, h - .2, lv + 3], [lu + (r() - .5) * .4, h - .2 - len, lv + 3.1], .35, [.07, .075, .085]);
      }
      T.sign(NAMES[k % NAMES.length], u, h + .9, lv + 3.25, lw * .7, 1.1, pick(r, [dim(COLD, .9), dim(ORANGE, .8), [1.4, .3, .25]]));
    }

    // String lights down the alley, the street-side shacks and a few bioroids waiting.

    const av = lv + 7;
    T.beam([-L / 2, 5.4, av], [L / 2, 5.4, av], .12, dim(COLD, .6), 'glow');
    for (let k = 0; k < 8; k++) T.box((r() - .5) * L * .8, 1, av + (r() - .5) * 3, .5, 2, .5, [.18, .2, .24], 'cyl');
    const sv = T.V / 2 - 6;
    for (let u = -L / 2 + 5; u < L / 2 - 4; u += 10) T.vol(u, sv, 8, 8, 4 + r() * 3, tin, r, { skin: SKINS.sparse });

    // The factory sign and the stall signs face +v, across the alley.

    return { face: T.dir(0, 1) };
  };

  // ---------- La Costa ----------

  // Floating Nightclub: a shuttle hub on the shore, and offshore a round raft with two glass decks under a canopy.
  // A hologram turns over the canopy, lasers sweep the water and rings of light spread out from the raft.

  // The moving parts own their meshes, because shared instances are frozen into tiles after the build.

  const FX = { ring: null, mx: 0, mz: 0 }, RIP = 3, HOLO = 4, LASERS = 8, HOLO_Y = 40, RIM = 19.5, RIM_Y = 19.8;
  const _o = new THREE.Object3D(), _c = new THREE.Color();
  _o.rotation.order = 'YXZ';

  const boat = (x, z, ry, len, rgb) => {
    const sx = Math.sin(ry), sz = Math.cos(ry);
    prop('box', x, -1.6, z, len * .35, 1, len, [.12, .12, .13], ry);
    prop('box', x - sx * len * .1, -.8, z - sz * len * .1, len * .25, 1.2, len * .3, [.2, .2, .2], ry);
    glow(x + sx * len * .5, -.6, z + sz * len * .5, .3, .3, .3, rgb);
  };

  const club = (x, z, w, d, st, r) => {
    const [wx, wz] = H.worldOf(x, z), c = coast(wx, wz), [ux, uz] = toLocalDir(c.nx, c.nz);
    const q = Math.min(w, d) * .3, off = Math.max(c.d + 40, q + 110);
    const mx = x + ux * off, mz = z + uz * off, ry = Math.atan2(ux, uz), land = Math.atan2(-ux, -uz);

    // Shore hub: a glass drum with its sign to the land, and a pier out to the shuttle stop.

    const qx = x + ux * q, qz = z + uz * q;
    bld(qx, qz, 14, 14, 5, { ...st, base: [.12, .1, .14], win: MAG }, r, { lit: .5, roof: false, shape: 'cyl', skin: SKINS.curtain });
    textSign('FLOATING CLUB · SHUTTLE', qx - ux * 7.4, 6.4, qz - uz * 7.4, 10, 1.8, land, dim(MAG, 1.1));
    const pe = Math.min(c.d + 10, Math.min(w, d) / 2 + 20);
    beam([qx, .6, qz], [x + ux * pe, .6, z + uz * pe], 3, [.1, .1, .11]);
    for (let t = c.d + 20; t < off - 36; t += 14) glow(x + ux * t, -1.6, z + uz * t, .5, .5, .5, (t / 14) % 2 < 1 ? MAG : CYAN);

    // Raft with a lit edge.

    prop('cyl', mx, -1.5, mz, 64, 2, 64, [.07, .07, .08]);
    prop('cyl', mx, .5, mz, 54, 2, 54, [.1, .1, .11]);
    put(GLOWS.ring, mx, -.4, mz, 65, 1, 65, 0, 0, dim(MAG, .9));
    put(GLOWS.ring, mx, 1.6, mz, 54.4, 1, 54.4, 0, 0, dim(CYAN, .5));

    // Lower deck: the dance floor in a magenta glass drum, capped by a terrace with warm lamps.

    bld(mx, mz, 40, 40, 7, { ...st, base: [.1, .08, .13], win: MAG }, r, { y0: 1.5, lit: .7, roof: false, shape: 'cyl', skin: SKINS.curtain });
    textSign('FLOATING CLUB', mx - ux * 20.6, 5, mz - uz * 20.6, 16, 2.4, land, dim(MAG, 1.2));
    prop('cyl', mx, 8.8, mz, 46, .6, 46, [.1, .1, .11]);
    put(GLOWS.ring, mx, 9.2, mz, 46.4, 1, 46.4, 0, 0, dim(WARM, 1));
    for (let k = 0; k < 12; k++) { const a = k / 12 * 6.3; glow(mx + Math.cos(a) * 21, 9.7, mz + Math.sin(a) * 21, .3, .3, .3, WARM); }
    for (let k = 0; k < 16; k++) {
      const a = r() * 6.3, rr = 3 + r() * 15;
      flickerGlow(mx + Math.cos(a) * rr, 2.4 + r() * 1.5, mz + Math.sin(a) * rr, .3, .3, .3, r() < .5 ? CYAN : MAG, r);
    }

    // Upper deck: the bar in a cyan drum, under a canopy on posts.

    bld(mx, mz, 26, 26, 6, { ...st, base: [.08, .1, .13], win: CYAN }, r, { y0: 9.1, lit: .65, roof: false, shape: 'cyl', skin: SKINS.curtain });
    prop('cyl', mx, 15.4, mz, 27, .5, 27, [.1, .1, .11]);
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.3 + .4; prop('box', mx + Math.cos(a) * 17, 14.6, mz + Math.sin(a) * 17, .4, 11, .4, DARK); }
    prop('cone', mx, 22, mz, 40, 5, 40, [.12, .1, .14]);
    put(GLOWS.ring, mx, 19.6, mz, 40.4, 1, 40.4, 0, 0, dim(MAG, 1.1));
    put(GLOWS.ring, mx, 22, mz, 20.6, 1, 20.6, 0, 0, dim(CYAN, .8));
    for (let k = 0; k < LASERS; k++) { const a = k / LASERS * Math.PI * 2; glow(mx + Math.sin(a) * RIM, RIM_Y, mz + Math.cos(a) * RIM, .6, .6, .6, [1.6, 1.6, 1.6]); }

    // Holo emitter on a mast, a cone of light up to the hologram's core.

    prop('cyl', mx, 27, mz, .8, 6, .8, DARK);
    glow(mx, 30.2, mz, 1.6, .4, 1.6, dim(VIOLET, 1.4));
    for (let k = 0; k < 6; k++) { const a = k / 6 * 6.3; beam([mx, 30.4, mz], [mx + Math.cos(a) * 6, 34, mz + Math.sin(a) * 6], .12, dim(VIOLET, .9), 'glow'); }
    put(GLOWS.sphere, mx, HOLO_Y, mz, 3, 3, 3, 0, 0, [1.6, 1.4, 1.7]);

    // Reflections streak under the raft.

    for (let k = 0; k < 10; k++) {
      const a = k / 10 * 6.3;
      glow(mx + Math.cos(a) * 30, -1.95, mz + Math.sin(a) * 30, 1.2, .02, 14, dim(k % 2 ? CYAN : MAG, .3), Math.PI / 2 - a);
    }

    // Shuttle boats on the route and one tied up at the raft.

    for (const t of [.35, .7]) boat(x + ux * (c.d + (off - c.d) * t) + uz * 8, z + uz * (c.d + (off - c.d) * t) - ux * 8, ry, 10, WARM);
    boat(mx - ux * 38, mz - uz * 38, ry + Math.PI / 2, 12, MAG);

    // Ripple and holo rings share one mesh.

    const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.userData.noTile = true; m.frustumCulled = false; H.decor.add(m); return m; };
    FX.ring = mk(GLOWS.ring.geometry, GLOWS.ring.material, RIP + HOLO);
    for (let i = 0; i < HOLO; i++) FX.ring.setColorAt(RIP + i, _c.setRGB(...dim(i % 2 ? CYAN : VIOLET, 1.3)));

    // Lasers leave the canopy rim and sweep side to side, dipping toward the water and lifting to the sky.

    for (let i = 0; i < LASERS; i++) {
      const a = i / LASERS * Math.PI * 2, o = [mx + Math.sin(a) * RIM, RIM_Y, mz + Math.cos(a) * RIM], p = .06, L = 140;
      H.laser(o, [o[0] + Math.sin(a) * Math.cos(p) * L, RIM_Y - Math.sin(p) * L, o[2] + Math.cos(a) * Math.cos(p) * L], .12,
        [MAG, CYAN, LIME][i % 3].map(v => v * 1.4), { sweep: [.7, .14, .8, i * 1.3], blink: i % 2 ? .6 : 0 });
    }
    FX.mx = mx; FX.mz = mz;
    clubFx(0);

    // The camera looks out from the shore, over the hub and the pier to the club.

    return { focus: [mx, mz], face: [-ux, -uz], span: 220 };
  };

  const clubFx = t => {
    const { ring, mx, mz } = FX;
    if (!ring) return;

    // Ripples grow and fade out.

    for (let i = 0; i < RIP; i++) {
      const f = (t * .25 + i / RIP) % 1, s = 62 * (.55 + f * .9), col = i % 2 ? CYAN : MAG, a = .7 * (1 - f);
      _o.position.set(mx, -1.9, mz); _o.rotation.set(0, 0, 0); _o.scale.set(s, 1, s); _o.updateMatrix();
      ring.setMatrixAt(i, _o.matrix);
      ring.setColorAt(i, _c.setRGB(col[0] * a, col[1] * a, col[2] * a));
    }

    // Hologram: three upright rings spin as a globe, a tilted ring wobbles and bobs around them.

    for (let i = 0; i < HOLO; i++) {
      const tilt = i === HOLO - 1, s = tilt ? 20 : 14;
      _o.position.set(mx, HOLO_Y + (tilt ? Math.sin(t * 1.3) * 2 : 0), mz);
      _o.rotation.set(tilt ? .35 : Math.PI / 2, t * (tilt ? -.9 : .6) + i * Math.PI / 3, 0);
      _o.scale.set(s, s, s); _o.updateMatrix();
      ring.setMatrixAt(RIP + i, _o.matrix);
    }
    ring.instanceMatrix.needsUpdate = ring.instanceColor.needsUpdate = true;
  };

  // G-mod Vineyard: terraced rows climbing the block from the Agricultural Plots side, each row a thin line
  // of violet or gold grow-light, with a low winery hall and tasting terrace on top.

  const vine = (x, z, w, d, st, r) => {
    const [px, pz] = H.toLocal(...mapWorld([655, 1215])), dx = px - x, dz = pz - z;
    const T = uv(x, z, w, d, Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz) || 1]);
    const U = T.U, V = T.V, rise = .45, rows = Math.floor((V - 22) / 4.5);
    T.box(0, .1, 0, U, .2, V, [.07, .055, .04]);

    // Rows from the plot edge (v high) up the slope (v low). The terrace rises with each row.

    for (let k = 0; k < rows; k++) {
      const v = V / 2 - 3 - k * 4.5, y = k * rise;
      T.box(0, y / 2 + .2, v, U - 4, y + .2, 4.5, [.08, .06, .04]);
      T.box(0, y + 1, v, U - 8, 1.4, .7, [.05, .1, .05]);
      T.gl(0, y + 1.85, v, U - 8, .12, .2, dim(k % 2 ? VIOLET : GOLD, .7));
      if (k % 3 === 0) T.gl(-U / 2 + 3, y + .9, v, .4, .4, .4, WARM);
    }

    // Winery hall, tasting terrace and string lights.

    const top = rows * rise, hv = -V / 2 + 9;
    T.box(0, top / 2 + .2, hv + 2, U - 4, top + .2, 14, [.08, .06, .04]);
    T.vol(-U * .15, hv - 1, Math.min(34, U * .5), 10, 6, { ...st, base: [.24, .18, .12], win: [1, .74, .44] }, r, { y0: top, lit: .55, roof: false, skin: SKINS.sparse });
    T.vol(-U * .15, hv - 1, Math.min(34, U * .5) + .8, 10.8, 2, { ...st, base: [.22, .09, .05] }, r, { y0: top + 6, lit: 0, roof: false, shape: 'pyr' });
    T.box(U * .22, top + .4, hv + 2, U * .3, .4, 10, [.14, .1, .07]);
    for (let k = 0; k < 6; k++) T.gl(U * .22 + (r() - .5) * U * .25, top + 1.2, hv + 2 + (r() - .5) * 7, .4, .4, .4, WARM);
    T.beam([U * .07, top + 4, hv + 6.5], [U * .37, top + 4, hv + 6.5], .1, dim(WARM, .8), 'glow');
    T.pool(U * .22, hv + 2, 14, dim(WARM, .12));
    T.sign('G-MOD VINEYARD · TASTING', -U * .15, top + 4.4, hv + 4.1, 12, 1.6, dim(GOLD, .9));
    return { face: T.dir(0, 1) };
  };

  return {
    fso_mural: { at: [545, 975], label: "Scrapper's Square Mural", labelY: 44, minSide: 34, reach: 400, build: mural },
    fso_chone: { at: [598, 1087], label: 'Green Valley Boulevard', labelY: 44, minSide: 40, reach: 400, build: chone },
    fso_arms: { at: [748, 1385], label: 'Arms and Hammers', labelY: 22, minSide: 30, reach: 400, build: arms },
    fso_chop: { at: [790, 1430], label: 'Golem Grove Chop Shops', labelY: 26, minSide: 46, reach: 400, build: chop },
    fso_club: { at: [575, 1335], label: 'La Costa Floating Nightclub', labelY: 56, minSide: 30, reach: 600, build: club, update: clubFx },
    fso_vine: { at: [655, 1215], label: 'G-mod Vineyard', labelY: 24, minSide: 40, reach: 600, build: vine },
  };
}
