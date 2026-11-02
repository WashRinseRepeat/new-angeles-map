// Lakeside architecture round the NAPD pier. The street mesh east and south of the reservoir left cells without
// blocks, so these stand on free sites turned to the local streets. Each one has its own form, so the shore reads
// as a gallery of civic buildings. laguna-velasco.js spreads them into its landmarks and passes its tools as L.

export function sights(H, L) {
  const { GLOWS, SKINS, bld, glow, prop, put, pool, beam, beacon, helipad } = H;
  const { C, lawn, lamp, tree, reflect, iconAt, axesOf, front, dim, glassOf } = L;
  const solid = { roof: false, kibble: false };
  const warmOf = (st, r) => ({ ...st, base: dim([.28, .26, .22], .7 + .2 * r()), win: [.8, .58, .34], lit: .55, grime: 0, neon: 0 });
  const darkOf = st => ({ ...st, base: [.05, .055, .06], win: [.78, .9, 1], lit: .25, grime: 0, neon: 0 });
  const lamps = (w, d, k = 3) => { for (let i = 0; i < k; i++) for (const s of [-1, 1]) lamp((i / (k - 1) - .5) * (w - 6), s * (d / 2 - 2)); };
  const icon = form => (x, z, w, d, st, r) => { iconAt(x, z, w, d, st, r, front(), form); return { face: front() }; };

  return {
    // Twist and stack towers from the district's icon set.

    lv_shore_twist: { at: [746.7, 948.3], free: [56, 52, -.227], build: icon('twist') },
    lv_shore_stack: { at: [741.7, 870.6], free: [44, 44, -1.822], build: icon('stack') },

    // Inverted ziggurat: eight floors that grow outward as they climb, gold light under every overhang, a roof garden.

    lv_shore_invert: { at: [741.1, 966.4], free: [56, 40, -.227], build(x, z, w, d, st, r) {
      const S = warmOf(st, r), n = 8, fh = 4.6, y0 = 7;
      lawn(x, z, w, d, 0, C.GARDEN);
      bld(x, z, w * .3, d * .3, y0, darkOf(st), r, { ...solid, skin: SKINS.sparse });
      glow(x, 2, z + d * .15 + .1, w * .2, 3.6, .2, dim(C.GOLD, .7));
      let lw = 0, ld = 0;
      for (let k = 0; k < n; k++) {
        lw = w * (.42 + .07 * k); ld = d * (.42 + .07 * k);
        bld(x, z, lw, ld, fh - .5, S, r, { ...solid, y0: y0 + k * fh, skin: SKINS.curtain, glow: .35 });
        glow(x, y0 + k * fh - .15, z, lw + .2, .3, ld + .2, dim(C.GOLD, .55));
      }
      const top = y0 + n * fh;
      prop('box', x, top + .2, z, lw - 1, .4, ld - 1, [.03, .09, .04]);
      for (let k = 0; k < 6; k++) tree(x + (r() - .5) * lw * .7, top + .4, z + (r() - .5) * ld * .7, 3 + r() * 2, r, 'broad');
      for (const s of [-1, 1]) glow(x + s * (lw / 2 + .1), top + .5, z, .2, .6, ld, dim(C.GOLD, .6));
      lamps(w, d);
      return { face: front() };
    } },

    // Lake pavilion: a glass hall under a long wave roof, lit underneath, with stepped terraces to the promenade.

    lv_shore_wave: { at: [736.9, 982.2], free: [52, 28, -.227], build(x, z, w, d, st, r) {
      const G = glassOf(st, r, .7), hw = w - 6, hd = d * .45;
      lawn(x, z, w, d, 0, C.GARDEN);
      bld(x, z, hw, hd, 5.5, G, r, { ...solid, skin: SKINS.curtain, glow: .6 });
      const seg = 2.5;
      for (let u = -hw / 2 - 1; u < hw / 2 + 1; u += seg) {
        const y = 7.5 + 2.6 * Math.sin(u / 6.5), y2 = 7.5 + 2.6 * Math.sin((u + seg) / 6.5);
        beam([x + u, y, z], [x + u + seg, y2, z], 1, [.24, .25, .27]);
        prop('box', x + u + seg / 2, (y + y2) / 2, z, seg + .05, .5, hd + 8, [.24, .25, .27]);
        glow(x + u + seg / 2, (y + y2) / 2 - .4, z, seg * .9, .2, hd + 6, dim(C.TEAL, .35));
      }
      for (let u = -hw / 2; u <= hw / 2; u += hw / 4) for (const s of [-1, 1]) prop('cyl', x + u, 4, z + s * (hd / 2 + 3.5), .5, 8, .5, [.2, .2, .22]);
      for (let k = 0; k < 3; k++) for (const s of [-1, 1]) prop('box', x, .3 + k * .3, z + s * (hd / 2 + 6 - k * 1.2), hw, .6 + k * .6, 1.2, [.13, .12, .11]);
      lamps(w, d, 4);
      return { face: front() };
    } },

    // Gyroscope monument: two great lit rings at right angles over a reflecting pool, cypresses round the edge.

    lv_shore_halo: { at: [757.8, 987.2], free: [40, 28, -.227], build(x, z, w, d, st, r) {
      const A = axesOf(x, z, w, d, [0, 1]), R = Math.min(w, d) * .55;
      lawn(x, z, w, d, 0, C.GARDEN);
      reflect(A, 0, 0, w * .7, d * .6);
      prop('cyl', x, 1, z, 5, 2, 5, [.15, .14, .13]);
      for (const ry of [0, Math.PI / 2]) {
        put(GLOWS.ring, x, R + 2.5, z, R * 2, 1, R * 2, ry, Math.PI / 2, dim(C.COLD, 1.2));
        put(GLOWS.ring, x, R + 2.5, z, R * 2 + 1.2, 1, R * 2 + 1.2, ry, Math.PI / 2, dim(C.TEAL, .6));
      }
      glow(x, R + 2.5, z, 1.6, 1.6, 1.6, dim(C.COLD, 1.4));
      pool(x, z, R * 1.4, dim(C.TEAL, .06));
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; tree(x + Math.cos(a) * (w / 2 - 3), .3, z + Math.sin(a) * (d / 2 - 2.5), 7 + r() * 3, r, 'cypress'); }
      return { face: front() };
    } },

    // Slab on pilotis: a long office bar lifted on paired columns, teal light under the belly, a garden on the roof.

    lv_shore_slab: { at: [787.2, 933.3], free: [64, 20, -1.798], build(x, z, w, d, st, r) {
      const S = { ...glassOf(st, r, .5), base: dim(C.WHITE, .9) }, lift = 13, sh = 20, sw = w - 4, sd = Math.min(d - 2, 12);
      lawn(x, z, w, d, 0, C.GARDEN);
      for (let u = -sw / 2 + 3; u <= sw / 2 - 3; u += 8) for (const s of [-1, 1]) prop('cyl', x + u, lift / 2, z + s * sd * .3, 1.4, lift, 1.4, [.2, .2, .21]);
      bld(x, z, 10, sd * .6, lift, darkOf(st), r, { ...solid, skin: SKINS.grid, lit: .6 });
      bld(x, z, sw, sd, sh, S, r, { ...solid, y0: lift, skin: SKINS.bands, glow: .3 });
      glow(x, lift - .2, z, sw - 1, .3, sd - 1, dim(C.TEAL, .9));
      prop('box', x, lift + sh + .3, z, sw - 2, .5, sd - 2, [.03, .09, .04]);
      for (let k = 0; k < 7; k++) tree(x + (k / 6 - .5) * (sw - 8), lift + sh + .5, z + (r() - .5) * sd * .4, 3 + r() * 1.5, r, 'broad');
      pool(x, z, sw * .4, dim(C.TEAL, .05));
      return { face: front() };
    } },

    // Hyperboloid tower: a lattice of straight struts twisted into a waist, three lit rings, a glass pod on top.

    lv_shore_lattice: { at: [784.2, 956.7], free: [48, 40, -1.798], build(x, z, w, d, st, r) {
      const Ht = 125, R = Math.min(w, d) * .36, n = 16, turn = 1.9, steel = [.32, .34, .37];
      lawn(x, z, w, d, 0, C.GARDEN);
      bld(x, z, R * .7, R * .7, Ht, darkOf(st), r, { ...solid, shape: 'oct', skin: SKINS.sparse });
      for (let k = 0; k < n; k++) {
        const a = k * 2 * Math.PI / n;
        for (const s of [-1, 1]) {
          const b = a + s * turn;
          beam([x + Math.cos(a) * R, 0, z + Math.sin(a) * R], [x + Math.cos(b) * R, Ht, z + Math.sin(b) * R], .9, steel);
        }
      }
      for (const t of [.3, .55, .8]) {
        const rad = R * Math.hypot(1 - t + t * Math.cos(turn), t * Math.sin(turn));
        put(GLOWS.ring, x, Ht * t, z, rad * 2, 1, rad * 2, 0, 0, dim(C.TEAL, 1));
      }
      bld(x, z, R * 1.5, R * 1.5, 9, glassOf(st, r, .8), r, { ...solid, y0: Ht, shape: 'cyl', skin: SKINS.curtain, glow: .7 });
      put(GLOWS.ring, x, Ht + .2, z, R * 1.6, 1, R * 1.6, 0, 0, dim(C.GOLD, 1));
      prop('cyl', x, Ht + 9 + 12, z, .5, 24, .5, steel);
      beacon(x, Ht + 33.5, z, r);
      put(GLOWS.ring, x, .4, z, R * 2.2, 1, R * 2.2, 0, 0, dim(C.TEAL, .6));
      pool(x, z, R * 1.6, dim(C.TEAL, .06));
      lamps(w, d);
      return { face: front() };
    } },

    // Observatory: a stone drum under a stepped silver dome, a lit slit and a telescope tube aimed at the sky.

    lv_shore_observatory: { at: [724.4, 1030], free: [60, 48, -.251], build(x, z, w, d, st, r) {
      const R = Math.min(w, d) * .32, hb = 9, silver = [.28, .3, .33];
      lawn(x, z, w, d, 0, C.GARDEN);
      bld(x, z, R * 2.2, R * 2.2, hb, { ...st, base: C.STONE, win: [.8, .58, .34], lit: .4, grime: .1 }, r, { ...solid, shape: 'cyl', skin: SKINS.sparse });
      const n = 6;
      for (let k = 0; k < n; k++) {
        const rk = R * Math.cos(Math.asin(k / n)), h = R / n;
        prop('cyl', x, hb + k * h + h / 2, z, rk * 2, h, rk * 2, silver);
      }
      beam([x, hb + 1, z - R * .15], [x, hb + R + .4, z + R * .2], 1.6, dim(C.GOLD, .7), 'glow');
      beam([x, hb + R * .5, z], [x, hb + R * 1.4, z + R * .9], 1.2, [.1, .1, .11]);
      put(GLOWS.ring, x, hb + .2, z, R * 2.3, 1, R * 2.3, 0, 0, dim(C.GOLD, .7));
      bld(x, z - d * .3, w * .5, 6, 5, { ...st, base: C.STONE, win: [.8, .58, .34], lit: .6 }, r, { ...solid, skin: SKINS.bands });
      for (let k = 0; k < 5; k++) { const a = k * 1.26 + .3; tree(x + Math.cos(a) * (R * 1.6 + 3), .3, z + Math.sin(a) * (R * 1.6 + 3), 5 + r() * 2, r); }
      lamps(w, d, 2);
      return { face: front() };
    } },

    // Spiral garden tower: a slim glass core wrapped by a ramp of planted terraces that winds to a lantern crown.

    lv_shore_spiral: { at: [778.9, 975], free: [32, 36, -.227], build(x, z, w, d, st, r) {
      const Ht = 96, R = Math.min(w, d) * .2, n = 64, turns = 4.5;
      lawn(x, z, w, d, 0, C.GARDEN);
      bld(x, z, R * 2, R * 2, Ht, glassOf(st, r, .6), r, { ...solid, shape: 'cyl', skin: SKINS.curtain, glow: .4 });
      for (let k = 0; k < n; k++) {
        const t = k / n, a = t * turns * 2 * Math.PI, y = 4 + t * (Ht - 8), ox = Math.cos(a) * (R + 3), oz = Math.sin(a) * (R + 3);
        prop('box', x + ox, y, z + oz, 7, .6, 5, [.2, .2, .19], -a);
        prop('box', x + ox, y + .5, z + oz, 6, .5, 4, [.03, .09, .04], -a);
        glow(x + ox, y - .4, z + oz, 6.4, .15, 4.4, dim(C.ORANGE, .35), -a);
        if (k % 3 === 0) tree(x + Math.cos(a) * (R + 4), y + .7, z + Math.sin(a) * (R + 4), 2.5 + r() * 1.5, r, 'broad');
      }
      bld(x, z, R * 2.6, R * 2.6, 6, warmOf(st, r), r, { ...solid, y0: Ht, shape: 'oct', skin: SKINS.curtain, glow: .8 });
      put(GLOWS.ring, x, Ht + 6.3, z, R * 2.8, 1, R * 2.8, 0, 0, dim(C.GOLD, 1));
      beacon(x, Ht + 7, z, r);
      pool(x, z, R * 2.5, [.1, .06, .03]);
      lamps(w, d, 2);
      return { face: front() };
    } },

    // Twin round towers: stacked balcony discs with warm rings every few floors and a glass sky bridge between them.

    lv_shore_rounds: { at: [766.4, 856.7], free: [56, 48, -.257], build(x, z, w, d, st, r) {
      const S = warmOf(st, r), rad = Math.min(w * .17, d * .2), fh = 3.2;
      lawn(x, z, w, d, 0, C.GARDEN);
      const towers = [[-w * .22, -d * .1, 108], [w * .22, d * .1, 84]];
      for (const [ox, oz, Ht] of towers) {
        bld(x + ox, z + oz, rad * 1.7, rad * 1.7, Ht, S, r, { ...solid, shape: 'cyl', skin: SKINS.curtain, glow: .3 });
        for (let k = 1, y = fh; y < Ht; k++, y += fh) {
          prop('cyl', x + ox, y, z + oz, rad * 2, .35, rad * 2, [.25, .24, .22]);
          if (k % 5 === 0) put(GLOWS.ring, x + ox, y - .25, z + oz, rad * 2 - .2, 1, rad * 2 - .2, 0, 0, dim(C.ORANGE, .6));
        }
        prop('cyl', x + ox, Ht + 1.5, z + oz, rad * 1.2, 3, rad * 1.2, [.1, .1, .11]);
        helipad(x + ox, z + oz, rad * 1.1, Ht + 3, r);
        beacon(x + ox, Ht + 5, z + oz, r);
        pool(x + ox, z + oz, rad * 1.5, [.1, .06, .03]);
      }
      const by = 62, [ax, az] = towers[0], [bx, bz] = towers[1];
      beam([x + ax, by, z + az], [x + bx, by, z + bz], 6, [.12, .13, .15]);
      beam([x + ax, by - 3.2, z + az], [x + bx, by - 3.2, z + bz], .3, dim(C.GOLD, 1), 'glow');
      bld(x, z, w * .7, d * .25, 6, S, r, { ...solid, skin: SKINS.bands, lit: .7 });
      lamps(w, d);
      return { face: front() };
    } },
  };
}
