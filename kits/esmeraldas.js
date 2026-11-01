// Esmeraldas: even 30-storey condo rows over an old plaza deck, pastel row shops, a shabby beach strip,
// the Malecón docks and pier, and Blue Sun Stadium. Lot kits read H.frame() and fall back to an s × s square.

const ESM = { base: [.13, .11, .1], win: [1, .76, .45], street: [1, .58, .25],
  signs: [[.3, .8, 1.8], [1.6, .55, .15], [.4, 1.5, .5], [1.5, .3, .9]] };

const pick = (r, a) => a[Math.floor(r() * a.length)];
const dim = (rgb, k) => rgb.map(c => c * k);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const PASTEL = [[.2, .12, .09], [.07, .15, .14], [.19, .16, .07], [.14, .1, .16], [.09, .14, .08], [.18, .09, .07], [.16, .15, .13], [.08, .11, .17]];
const AWN = [[.24, .05, .04], [.04, .1, .22], [.22, .16, .03], [.04, .15, .08], [.18, .05, .13], [.2, .2, .18]];
const BOX = [[.22, .06, .04], [.05, .1, .22], [.2, .15, .04], [.05, .15, .08], [.15, .15, .16], [.17, .09, .03], [.04, .13, .16]];
const WARM = [1.3, .72, .32], SODIUM = [1.25, .6, .18], BLUE = [.3, .8, 1.8], COLD = [.8, .88, 1];
const LEAF = [.03, .1, .035], GROW = [.75, .16, .6], DARK = [.04, .04, .045], CONC = [.08, .072, .065];

const FOOD = ['CEVICHE', 'ENCEBOLLADO', 'MARISCOS', 'BOLONES', 'EMPANADAS', 'JUGOS', 'TACOS 24H', 'PAN DE YUCA', 'CERVEZA', 'NOODLES'];
const SHOP = [...FOOD, 'KARAOKE', 'DISCOS', 'BINGO', 'FARMACIA', 'BARBERIA', 'LAVANDERIA', 'LOTTO', 'ARCADE', 'GOAL!'];
const CLUB = ['SALSA', 'KARAOKE', "ROXY HT'S", "SUNNY BLU'S", 'THE BARN', 'DISCOS'];
const HOTEL = ['HOTEL', 'VACANCY', 'SUITES', 'MAR AZUL', 'OCEAN VIEW'];
const CALLE = ['CALLE 9', 'CALLE 73', 'CALLE 150', 'CALLE 151', 'CALLE 212', 'CALLE 327'];

export function kits(H) {
  const { SKINS, beacon, bld, flickerGlow, glow, lerp, prop, sign, stringLights, textSign } = H;
  const pool = (x, z, rad, rgb) => H.pool?.(x, z, rad, rgb);
  const puff = (x, y, z, rad, rgb) => H.puff?.(x, y, z, rad, rgb);
  const G = geo(H);

  // Showcase styles carry no district palette, so they get the Esmeraldas one.

  const own = st => st.signs ? st : { ...st, ...ESM };
  const grimy = st => ({ ...own(st), grime: .75, neon: .3, lit: .15 });
  const look = (st, r, k = .5, lit) => ({ ...st, base: pick(r, PASTEL).map((c, i) => lerp(st.base[i], c, k) * (.8 + .4 * r())), lit: lit ?? st.lit * (.8 + .5 * r()) });

  // Lot frame with a front. u runs along the front, v from the front face (0) to the back (S).

  const lot = (x, z, s) => {
    const F = H.frame(), W = F ? Math.min(F.w - 2, 70) : s, D = F ? Math.min(F.d - 2, 70) : s, fr = F?.front ?? { x: 0, z: 1 };
    const nx = Math.abs(fr.x) > Math.abs(fr.z) ? Math.sign(fr.x) : 0, nz = nx ? 0 : Math.sign(fr.z) || 1;
    return {
      W, D, nx, nz, L: nx ? D : W, S: nx ? W : D, ry: Math.atan2(nx, nz), face: nx > 0 ? 0 : nx < 0 ? 1 : nz > 0 ? 2 : 3,
      ends: nx ? [2, 3] : [0, 1],
      at: (u, v) => nx ? [x + nx * (W / 2 - v), z + u] : [x + u, z + nz * (D / 2 - v)],
      p3: (u, v, y) => nx ? [x + nx * (W / 2 - v), y, z + u] : [x + u, y, z + nz * (D / 2 - v)],
      box: (len, dep) => nx ? [dep, len] : [len, dep],
      bar: (len, dep, h) => nx ? [dep, h, len] : [len, h, dep],
    };
  };

  // Lit shop fronts with awnings and painted names along the lot front.

  const shops = (o, st, r, names = SHOP, y = 0) => {
    for (let u = -o.L / 2 + 1; u < o.L / 2 - 3;) {
      const uw = Math.min(o.L / 2 - 1 - u, 4 + r() * 4), c = u + uw / 2;
      if (r() < .85) {
        const [gx, gz] = o.at(c, -.1), [sx, sz] = o.box(uw * .85, .25);
        glow(gx, y + 1.5, gz, sx, 2.6, sz, dim(r() < .7 ? WARM : pick(r, st.signs), .3 + .45 * r()));
        const [ax, az] = o.at(c, -1), [bx, bz] = o.box(uw * .95, 2);
        prop('box', ax, y + 3.2, az, bx, .12, bz, pick(r, AWN));
        if (r() < st.neon * 1.2) {
          const [tx, tz] = o.at(c, -.35), tw = Math.min(uw * .9, 5);
          textSign(pick(r, names), tx, y + 4.2, tz, tw, tw / 4, o.ry, dim(pick(r, st.signs), .75));
        }
      }
      u += uw;
    }
  };

  // Curb planters, patchily tended, and a sodium pool in front.

  const curb = (o, r, n = 3) => {
    for (let k = 0; k < n; k++) {
      const [px, pz] = o.at((r() - .5) * (o.L - 4), -2.6);
      prop('box', px, .35, pz, 1.4, .7, 1.4, CONC);
      prop('box', px, .95, pz, 1.1, .6, 1.1, r() < .6 ? LEAF : [.08, .06, .03]);
    }
    const [px, pz] = o.at(0, -4);
    pool(px, pz, o.L * .35, dim(SODIUM, .06));
  };

  // Roof garden boxes with a green grow light.

  const garden = (x, z, w, d, y, r, n = 3) => {
    for (let k = 0; k < n; k++) prop('box', x + (r() - .5) * w * .7, y + .4, z + (r() - .5) * d * .7, 2 + r() * 4, .8, 2 + r() * 3, LEAF.map(c => c * (.7 + .6 * r())));
    if (r() < .6) glow(x, y + .9, z, Math.min(w * .3, 6), .1, Math.min(d * .3, 4), [.12, .4, .14]);
  };

  // Lot kits that change with the shore: Malecón lots turn to docks and stilt blocs, beach lots to holiday flats.

  const zoned = fn => (x, z, s, st, b, r) => {
    const zone = G.zoneAt(...G.world(x, z));
    if (zone === 'malecon') { const k = r(); return (k < .45 ? K.esm_dockShed : k < .75 ? K.esm_stiltBloc : fn)(x, z, s, grimy(st), b, r, zone); }
    if (zone === 'shore' && r() < .7) return K.esm_beachFlats(x, z, s, st, b, r, zone);
    return fn(x, z, s, st, b, r, zone);
  };

  const K = {
    // Condo row: an old plaza-deck podium carrying one or two even 30-storey slabs, balcony bands and roof gardens.

    esm_condoRow: zoned((x, z, s, st0, b, r, zone) => {
      const st = own(st0), o = lot(x, z, s), deck = 12 + r() * 6;
      bld(x, z, o.W, o.D, deck, look(st, r, .3, .4), r, { skin: SKINS.bands, roof: false });
      shops(o, st, r);
      curb(o, r);
      const rows = o.S > 36 ? 2 : 1, dep = Math.min(18, o.S / rows - 5), len = o.L - 4;
      const h = (80 + 16 * r()) * clamp(b, .85, 1.2) * (zone === 'historic' ? 1.35 : 1);
      for (let i = 0; i < rows; i++) {
        const v = o.S * (i + .5) / rows, [cx, cz] = o.at(0, v), [sx, sz] = o.box(len, dep), cs = look(st, r, .35);
        bld(cx, cz, sx, sz, h, cs, r, { y0: deck, skin: r() < .7 ? SKINS.grid : SKINS.bands });
        for (const side of [-1, 1]) for (let y = deck + 7; y < deck + h - 4; y += 12.8) {
          if (r() < .25) continue;
          const bw = len * (.35 + .55 * r()), [px, pz] = o.at((r() - .5) * (len - bw), v + side * (dep / 2 + .3)), [bx, bz] = o.box(bw, .25);
          glow(px, y, pz, bx, .16, bz, dim(WARM, .14 + .1 * r()));
        }
        garden(cx, cz, sx, sz, deck + h, r);
        if (r() < .7) sign(cx, cz, sx, sz, deck + h, st, r, dim(pick(r, st.signs), .7 + .4 * r()), { face: pick(r, o.ends), blade: true, y: deck + 14 + r() * (h - 34), sh: 8 + r() * 10, sw: 2.2 });
      }
      for (let k = 0; k < 3; k++) { const [px, pz] = o.at((k - 1) * len * .35, rows > 1 ? o.S / 2 : o.S * .08); H.put(H.GLOWS.sphere, px, deck + 4, pz, .7, .7, .7, 0, 0, dim(SODIUM, .8)); }
    }),

    // Row shops: narrow pastel houses of three to five floors over lit shops, rooftop terraces strung with lights.

    esm_rowShops: zoned((x, z, s, st0, b, r) => {
      const st = own(st0), o = lot(x, z, s), dep = Math.min(14, o.S * .55), tops = [];
      for (let u = -o.L / 2 + .5; u < o.L / 2 - 2;) {
        const uw = Math.min(o.L / 2 - .5 - u, 4.5 + r() * 3.5), h = (9 + r() * 8) * clamp(b, .8, 1.2), c = u + uw / 2;
        const [bx, bz] = o.at(c, dep / 2), [sx, sz] = o.box(uw - .25, dep);
        bld(bx, bz, sx, sz, h, look(st, r, .8), r, { skin: r() < .6 ? SKINS.sparse : SKINS.grid, roof: r() < .35 });
        tops.push([bx, h, bz]);
        if (r() < .35) garden(bx, bz, sx, sz, h, r, 1);
        u += uw;
      }
      shops(o, st, r);
      curb(o, r, 4);
      for (let k = 0; k + 1 < tops.length; k += 1 + Math.floor(r() * 2)) {
        const a = tops[k], c = tops[Math.min(tops.length - 1, k + 1 + Math.floor(r() * 2))];
        if (r() < .6) stringLights([a[0], a[1] + 1.8, a[2]], [c[0], c[1] + 1.8, c[2]], .6, 5, r() < .7 ? WARM : dim(pick(r, st.signs), .7));
      }

      // The back half: a second, taller walk-up row or a yard with a water tank.

      if (o.S - dep > 10) {
        const bd = Math.min(16, o.S - dep - 3), [bx, bz] = o.at(0, o.S - bd / 2), [sx, sz] = o.box(o.L - 3, bd);
        if (r() < .6) bld(bx, bz, sx, sz, (16 + r() * 12) * clamp(b, .8, 1.2), look(st, r, .6), r, { skin: SKINS.grid });
        else { prop('box', bx, .1, bz, sx, .2, sz, CONC); prop('cyl', bx, 2.5, bz, 3, 5, 3, [.06, .07, .1]); }
      }
    }),

    // Radial tower: an isolated starscraper on a podium, light lines radiating from its foot, a plain blue crown.

    esm_radialTower: zoned((x, z, s, st0, b, r, zone) => {
      const st = own(st0), o = lot(x, z, s), ph = 12 + r() * 4;
      if (Math.min(o.W, o.D) < 30 && zone !== 'historic') return K.esm_condoRow(x, z, s, st0, b, r);
      bld(x, z, o.W, o.D, ph, look(st, r, .2, .4), r, { skin: SKINS.bands, roof: false });
      shops(o, st, r);
      curb(o, r, 2);
      const tw = Math.min(o.W, o.D) * (.5 + .1 * r()), oct = r() < .4, th = (140 + 100 * r()) * clamp(b, .8, 1.2) * (zone === 'historic' ? 1.25 : 1);
      const ts = { ...st, base: dim(st.base, .8), lit: .28 };
      const h1 = th * (.62 + .1 * r()), shape = oct ? 'oct' : 'box', skin = r() < .5 ? SKINS.curtain : SKINS.fins;
      bld(x, z, tw, tw, h1, ts, r, { y0: ph, shape, skin, roof: false });
      bld(x, z, tw * .78, tw * .78, th - h1, ts, r, { y0: ph + h1, shape, skin, roof: false });
      const top = ph + th, cw = tw * .78;
      if (oct) H.put(H.GLOWS.ring, x, top - 3, z, cw * 1.04, 1, cw * 1.04, 0, 0, dim(BLUE, .55));
      else for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) glow(x + dx * (cw / 2 + .2), top - 3, z + dz * (cw / 2 + .2), dx ? .3 : cw, 1.2, dz ? .3 : cw, dim(BLUE, .55));
      glow(x, ph + h1 + .2, z, tw * 1.01, .4, tw * 1.01, dim(BLUE, .3));
      prop('box', x, top + 2, z, cw * .5, 4, cw * .5, DARK);
      prop('cyl', x, top + 14, z, .5, 20, .5, [.15, .15, .15]);
      beacon(x, top + 24.5, z, r);
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + .3, R = Math.min(o.W, o.D) / 2 - 1, c = Math.cos(a), sn = Math.sin(a);
        H.beam([x + c * tw * .6, ph + .1, z + sn * tw * .6], [x + c * R, ph + .1, z + sn * R], .35, dim(SODIUM, .3), 'glow');
      }
      if (r() < .5) H.holo(x, z, tw, tw, ph + h1 * .5, r, o.face, tw * .8);
      sign(x, z, tw, tw, ph + h1, st, r, dim(pick(r, st.signs), .8), { face: o.face, blade: false, y: ph + 8, sw: tw * .5, sh: 3 });
    }),

    // Beach flats: tiny candy-coloured holiday blocks with flickering signs, a boardwalk and a littered strip of sand.

    esm_beachFlats(x, z, s, st0, b, r) {
      const st = own(st0), o = lot(x, z, s), [sx0, sz0] = G.seaLocal(x, z), seaFront = sx0 * o.nx + sz0 * o.nz > .3;
      const fd = Math.min(12, o.S * .5), v0 = seaFront ? o.S - fd / 2 : fd / 2, vb = seaFront ? o.S * .3 : o.S - (o.S - fd) / 2;
      const n = clamp(Math.floor(o.L / 11), 2, 4), uw = o.L / n;
      for (let k = 0; k < n; k++) {
        const c = -o.L / 2 + uw * (k + .5), h = (12 + r() * 8) * clamp(b, .8, 1.15), [bx, bz] = o.at(c, v0), [sx, sz] = o.box(uw - 1.5, fd);
        bld(bx, bz, sx, sz, h, look({ ...st, base: [.2, .18, .16] }, r, .9, .25 + .2 * r()), r, { skin: SKINS.grid, roof: r() < .5 });
        for (let y = 4; y < h - 2; y += 3.3) { const [px, pz] = o.at(c, v0 - fd / 2 - .4), [gx, gz] = o.box(uw - 2, .3); prop('box', px, y, pz, gx, .15, gz, [.2, .2, .2]); }
        const [tx, tz] = o.at(c, v0 - fd / 2 - .3), tw = Math.min(uw * .7, 7), col = dim(pick(r, [[1.6, .3, .9], [.3, 1.2, 1.5], [1.6, .9, .2]]), .8);
        if (!seaFront) textSign(pick(r, HOTEL), tx, h - 2, tz, tw, tw / 4, o.ry, col);
        flickerGlow(tx, h - 3.3, tz, ...o.bar(tw * .9, .15, .2), col, r);
      }
      if (!seaFront) shops(o, st, r, FOOD);

      // Sand, umbrellas, loungers and litter on the other side, behind a lit boardwalk.

      const bd = o.S - fd - 1, [cx, cz] = o.at(0, vb), [sx, sz] = o.box(o.L, bd);
      prop('box', cx, .05, cz, sx, .1, sz, [.14, .12, .085]);
      const wv = seaFront ? o.S - fd - 1.5 : fd + 1.5, [wx, wz] = o.at(0, wv), [px, pz] = o.box(o.L, 2.6);
      prop('box', wx, .35, wz, px, .3, pz, [.12, .08, .05]);
      const lamps = [];
      for (let k = 0; k < 4; k++) { const [lx, lz] = o.at(-o.L / 2 + o.L * (k + .5) / 4, wv); prop('cyl', lx, 2, lz, .2, 4, .2, DARK); lamps.push([lx, 4, lz]); }
      for (let k = 0; k + 1 < lamps.length; k++) stringLights(lamps[k], lamps[k + 1], .5, 5, r() < .5 ? WARM : [1.4, .4, .8]);
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) {
        const [ux, uz] = o.at((r() - .5) * (o.L - 4), vb + (r() - .5) * bd * .6);
        prop('cyl', ux, 1.2, uz, .1, 2.4, .1, DARK);
        prop('cone', ux, 2.4, uz, 3, .7, 3, pick(r, AWN));
      }
      for (let k = 4; k > 0; k--) { const [ux, uz] = o.at((r() - .5) * o.L, vb + (r() - .5) * bd); prop('box', ux, .2, uz, .4 + r(), .3, .3 + r() * .6, pick(r, BOX)); }
    },

    // Stilt bloc: a cheap Weyland condo slab raised on bare pilings, slightly askew, with mist at its feet.

    esm_stiltBloc(x, z, s, st0, b, r) {
      const st = own(st0), o = lot(x, z, s), len = Math.min(o.L - 4, 44), dep = Math.min(o.S - 6, 15), lift = 6 + r() * 2;
      const [cx, cz] = o.at(0, o.S / 2), [sx, sz] = o.box(len, dep), tilt = (r() - .5) * .07;
      for (let i = 0; i < 5; i++) for (const j of [-1, 0, 1]) {
        const [px, pz] = o.at(-len / 2 + 2 + i * (len - 4) / 4, o.S / 2 + j * (dep / 2 - 1.5));
        prop('cyl', px, lift / 2, pz, 1.1, lift, 1.1, [.06, .06, .055]);
      }
      prop('box', cx, lift - .4, cz, sx + 1, .8, sz + 1, CONC, tilt);
      bld(cx, cz, sx, sz, 28 + r() * 14, { ...st, base: [.08, .09, .09], win: [.7, .85, .95], lit: .2, grime: .7 }, r, { y0: lift, ry: tilt, skin: SKINS.bands });
      const [tx, tz] = o.at(0, o.S / 2 - dep / 2 - .4);
      textSign('BLOC E69', tx, lift + 3, tz, 8, 2, o.ry, [.5, .65, .7]);
      for (let k = 0; k < 4; k++) { const [px, pz] = o.at((r() - .5) * len, o.S / 2 + (r() - .5) * dep); puff(px, 1.5, pz, 4 + r() * 3, [.1, .11, .12]); }
      for (let k = 0; k < 3; k++) { const [px, pz] = o.at((r() - .5) * len * .8, o.S / 2 + (r() - .5) * dep * .6); flickerGlow(px, .6, pz, .5, .5, .5, [1.4, .55, .15], r); }
      const [sx2, sz2] = o.at(len / 2 + 2, o.S / 2);
      bld(sx2, sz2, ...o.box(3, 4), lift + 30, { ...st, base: [.07, .07, .07], lit: .4 }, r, { skin: SKINS.bands, roof: false });
    },

    // School block: a worn low L of classrooms with a floodlit football court on the roof.

    esm_schoolBlock(x, z, s, st0, b, r) {
      const st = own(st0), o = lot(x, z, s), h = 15 + r() * 8, dep = Math.min(16, o.S * .55), len = o.L - 3;
      const [cx, cz] = o.at(0, dep / 2), [sx, sz] = o.box(len, dep), cs = look(st, r, .5, .3);
      bld(cx, cz, sx, sz, h, cs, r, { skin: SKINS.bands, roof: false });
      const cw = Math.min(len - 4, 30), cd = Math.min(dep - 3, 15), [cxs, czs] = o.box(cw, cd);
      prop('box', cx, h + .1, cz, cxs, .2, czs, [.03, .08, .11]);
      glow(cx, h + .25, cz, cxs * .9, .05, czs * .9, [.04, .07, .05]);
      glow(cx, h + .3, cz, ...o.bar(cw * .9, .15, .05), [.35, .35, .3]);
      glow(cx, h + .3, cz, ...o.bar(.15, cd * .9, .05), [.35, .35, .3]);
      for (const su of [-1, 1]) for (const sv of [-1, 1]) {
        const [px, pz] = o.at(su * cw / 2, dep / 2 + sv * cd / 2);
        prop('cyl', px, h + 5, pz, .3, 10, .3, DARK);
        glow(px, h + 10.2, pz, 1.4, .5, 1.4, [1.2, 1.15, 1]);
      }
      pool(cx, cz, Math.max(cw, cd) * .6, [.06, .06, .05]);
      if (o.S - dep > 10) { const gd = Math.min(18, o.S - dep - 2), [gx, gz] = o.at(0, dep + gd / 2 + .5), [g1, g2] = o.box(len * .7, gd); bld(gx, gz, g1, g2, 9, cs, r, { skin: SKINS.sparse, roof: false }); prop('cyl', gx, 9, gz, gd, len * .7, gd * .3, [.09, .09, .1], o.nx ? 0 : Math.PI / 2, Math.PI / 2); }
      const [tx, tz] = o.at(0, -.3);
      textSign(r() < .5 ? 'SAN MIGUEL' : 'ESCUELA 150', tx, 6, tz, 10, 2.5, o.ry, dim(BLUE, .6));
      curb(o, r, 2);
    },

    // Eat Row: a canopy of food stalls on the street, steam and string lights, a music club behind.

    esm_eatRow: zoned((x, z, s, st0, b, r) => {
      const st = own(st0), o = lot(x, z, s), cd = 6;
      const [kx, kz] = o.at(0, cd / 2), [ks, kd] = o.box(o.L - 1, cd);
      prop('box', kx, 4, kz, ks, .2, kd, pick(r, AWN));
      for (let u = -o.L / 2 + 2; u < o.L / 2 - 2; u += 3.5 + r()) {
        const [gx, gz] = o.at(u, 1), [gs, gd] = o.box(2.8, .6);
        glow(gx, 1, gz, gs, .8, gd, dim(r() < .6 ? [1.5, .6, .18] : WARM, .45 + .3 * r()));
        if (r() < .55) { const [tx, tz] = o.at(u, -.2); textSign(pick(r, FOOD), tx, 3.3, tz, 3, .75, o.ry, dim(pick(r, st.signs), .8)); }
        if (r() < .5) { const [px, pz] = o.at(u, 2.5); puff(px, 4.6 + r() * 2, pz, 1.5 + r(), [.16, .14, .12]); }
      }
      for (let k = 0; k < 3; k++) {
        const [ax, az] = o.at(-o.L / 2 + o.L * k / 3, 0), [cx, cz] = o.at(-o.L / 2 + o.L * (k + 1) / 3, -6);
        stringLights([ax, 5, az], [cx, 5, cz], 1, 6, r() < .6 ? WARM : dim(pick(r, st.signs), .7));
      }
      for (let k = 3; k > 0; k--) { const [px, pz] = o.at((r() - .5) * (o.L - 4), -3.5); prop('box', px, .45, pz, 1.4, .9, 1.4, [.12, .09, .06]); }
      const [px, pz] = o.at(0, -3);
      pool(px, pz, o.L * .4, [.12, .07, .03]);
      if (o.S > cd + 8) {
        const bd = o.S - cd - 1, [bx, bz] = o.at(0, cd + bd / 2 + .5), [bs, bdd] = o.box(o.L - 2, bd), h = (12 + r() * 10) * clamp(b, .8, 1.2);
        bld(bx, bz, bs, bdd, h, look(st, r, .7, .3), r, { skin: SKINS.sparse });
        const [tx, tz] = o.at(0, cd + .2), tw = Math.min(o.L * .6, 14), col = dim(pick(r, [[1.5, .3, .9], [.3, .8, 1.8]]), 1.1);
        textSign(pick(r, CLUB), tx, h - 3, tz, tw, tw / 4, o.ry, col);
        flickerGlow(tx, h - 3 - tw / 8 - .4, tz, ...o.bar(tw, .15, .15), col, r);
      }
    }),

    // Dock shed: a barrel-roofed Malecón warehouse with sodium loading bays, containers and a prisec floodlight.

    esm_dockShed(x, z, s, st0, b, r) {
      const st = grimy(st0), o = lot(x, z, s), dep = o.S * .65, len = o.L - 2, h = 10 + r() * 6;
      const [cx, cz] = o.at(0, o.S - dep / 2), [sx, sz] = o.box(len, dep);
      bld(cx, cz, sx, sz, h, { ...st, base: [.09, .085, .08] }, r, { skin: SKINS.sparse, roof: false });
      prop('cyl', cx, h, cz, dep, len, dep * .3, [.07, .075, .08], o.nx ? 0 : Math.PI / 2, Math.PI / 2);
      for (let u = -len / 2 + 4; u < len / 2 - 3; u += 7) {
        const [gx, gz] = o.at(u, o.S - dep - .1), [gs, gd] = o.box(4.5, .2);
        glow(gx, 2.3, gz, gs, 4, gd, r() < .7 ? dim(SODIUM, .45) : [.05, .04, .03]);
      }
      for (let k = 2 + Math.floor(r() * 4); k > 0; k--) {
        const [px, pz] = o.at((r() - .5) * (len - 8), (o.S - dep) * (.25 + .5 * r())), [bx, bz] = o.box(6.1, 2.4);
        for (let q = 1 + Math.floor(r() * 3); q > 0; q--) prop('box', px, q * 2.6 - 1.3, pz, bx, 2.5, bz, pick(r, BOX));
      }
      const [mx, mz] = o.at(len / 2 - 2, 1);
      prop('cyl', mx, 9, mz, .5, 18, .5, DARK);
      glow(mx, 18, mz, 2.4, .4, .8, COLD);
      pool(mx, mz, 16, [.08, .09, .1]);
      for (const y of [1, 2.2]) H.beam(o.p3(-len / 2, -.5, y), o.p3(len / 2, -.5, y), .08, [.5, .18, .06], 'glow');
      if (r() < .3) {
        const [tx, tz] = o.at(0, o.S - dep - .3);
        textSign("SALTY'S", tx, h - 2, tz, 10, 2.5, o.ry, [1.5, .3, .9]);
        stringLights(o.p3(-len / 2, o.S - dep - .5, 5), o.p3(len / 2, o.S - dep - .5, 5), .8, 8, WARM);
      }
    },
  };

  return K;
}

export const tiers = {
  esmeraldas: {
    0: ['esm_rowShops', 'esm_rowShops', 'esm_rowShops', 'esm_condoRow', 'esm_condoRow', 'esm_eatRow', 'esm_eatRow', 'esm_schoolBlock', 'park'],
    1: ['esm_condoRow', 'esm_condoRow', 'esm_condoRow', 'esm_condoRow', 'esm_condoRow', 'esm_rowShops', 'esm_rowShops', 'esm_eatRow', 'esm_schoolBlock'],
    2: ['esm_condoRow', 'esm_condoRow', 'esm_condoRow', 'esm_condoRow', 'esm_condoRow', 'esm_radialTower', 'esm_rowShops'],
  },
};

// Shared geometry: world and local frames, the coast and the sub-zones.

function geo(H) {
  const COAST = H.CITY.coast?.[0] ?? [];
  const coastNear = (x, z) => {
    let d = Infinity, px = x, pz = z;
    for (let i = 0; i + 1 < COAST.length; i++) {
      const [ax, az] = COAST[i], [bx, bz] = COAST[i + 1], dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      const qx = ax + t * dx, qz = az + t * dz, e = Math.hypot(x - qx, z - qz);
      if (e < d) { d = e; px = qx; pz = qz; }
    }
    return { d, x: px, z: pz };
  };
  const world = (x, z) => {
    const F = H.frame();
    if (!F) return [x, z];
    const dx = x - F.cx, dz = z - F.cz;
    return [(F.tx ?? F.cx) + dx * F.c + dz * F.s, (F.tz ?? F.cz) - dx * F.s + dz * F.c];
  };
  const local = (X, Z) => { const F = H.frame(); return F ? [X * F.c - Z * F.s, X * F.s + Z * F.c] : [X, Z]; };

  // Unit vector toward the nearest coast, in the current frame, and the distance to it.

  const sea = (x = 0, z = 0) => {
    const [X, Z] = world(x, z), c = coastNear(X, Z), [ux, uz] = local(c.x - X, c.z - Z), L = Math.hypot(ux, uz) || 1;
    return { ux: ux / L, uz: uz / L, d: c.d };
  };
  const seaLocal = (x, z) => { if (!H.frame()) return [0, 0]; const s = sea(x, z); return [s.ux, s.uz]; };

  // The north-west waterfront is the Malecón and its docks. Other coast is beach.

  const zoneAt = (X, Z) => {
    if (!H.frame()) return 'streets';
    const sub = H.subareaAt(X, Z), d = coastNear(X, Z).d;
    if (sub === 'The Malecon' || (d < 260 && Z < 110 && X < -1500 && X > -2150)) return 'malecon';
    if (d < 140) return 'shore';
    if (sub === 'Historic Esmeraldas') return 'historic';
    return 'streets';
  };
  return { coastNear, world, local, sea, seaLocal, zoneAt };
}

// Block kits: the plaza-deck superblock, Parque Soleado and the harbour container yard.

export function blocks(H) {
  const { SKINS, GLOWS, beacon, bld, glow, holo, prop, put, sign, stringLights, textSign, flickerGlow } = H;
  const pool = (x, z, rad, rgb) => H.pool?.(x, z, rad, rgb);
  const puff = (x, y, z, rad, rgb) => H.puff?.(x, y, z, rad, rgb);
  const G = geo(H);
  const own = st => st.signs ? st : { ...st, ...ESM };
  const lamp = (x, y, z, rgb = SODIUM) => put(GLOWS.sphere, x, y, z, .8, .8, .8, 0, 0, dim(rgb, .8));

  // Plaza deck: one old deck over the whole block, shops beneath, three or four even condo rows on top.

  function deckBlock(x, z, w, d, st0, r) {
    const st = own(st0), deck = 16 + r() * 5;
    prop('box', x, deck, z, w, 1.4, d, CONC);
    glow(x, deck - .8, z, w * .92, .1, d * .92, [.1, .06, .025]);
    for (let i = 0, nx = Math.max(2, Math.round(w / 20)); i <= nx; i++) for (let j = 0, nz = Math.max(2, Math.round(d / 20)); j <= nz; j++)
      if (i === 0 || j === 0 || i === nx || j === nz || r() < .3) prop('cyl', x - w / 2 + 1 + i * (w - 2) / nx, deck / 2, z - d / 2 + 1 + j * (d - 2) / nz, 1.4, deck, 1.4, [.07, .065, .06]);

    // Shops under the deck edge on all four sides, and a sodium rail on the deck lip.

    for (const [nx, nz] of FACES4) {
      const span = nx ? d : w, out = (nx ? w : d) / 2 - 1.5;
      for (let u = -span / 2 + 4; u < span / 2 - 4; u += 6 + r() * 3) {
        if (r() < .25) continue;
        const px = x + nx * out + (nz ? u : 0), pz = z + nz * out + (nx ? u : 0);
        glow(px, 1.6, pz, nx ? .25 : 4, 2.8, nx ? 4 : .25, dim(r() < .7 ? WARM : pick(r, st.signs), .3 + .4 * r()));
      }
      glow(x + nx * (w / 2 + .1), deck + 1.1, z + nz * (d / 2 + .1), nx ? .15 : w, .15, nx ? d : .15, dim(SODIUM, .4));
      if (r() < .7) textSign(pick(r, CALLE), x + nx * (w / 2 + .3), deck - 2.4, z + nz * (d / 2 + .3), 8, 2, Math.atan2(nx, nz), dim(BLUE, .5));
    }

    // Rows along the long side.

    const along = w >= d, L = (along ? w : d) - 12, S = along ? d : w, n = clamp(Math.floor(S / 30), 2, 4), dep = Math.min(17, S / n - 9);
    const h = (84 + 14 * r());
    for (let k = 0; k < n; k++) {
      const v = -S / 2 + S * (k + .5) / n, cx = along ? x : x + v, cz = along ? z + v : z, sx = along ? L : dep, sz = along ? dep : L;
      const cs = { ...st, base: pick(r, PASTEL).map((c, i) => lerp(st.base[i], c, .35)) };
      const hk = h * (.94 + .1 * r());
      bld(cx, cz, sx, sz, hk, cs, r, { y0: deck + .7, skin: SKINS.grid });
      for (const side of [-1, 1]) for (let y = deck + 8; y < deck + hk - 4; y += 12.8) if (r() < .7) {
        const bw = L * (.3 + .6 * r()), o = (r() - .5) * (L - bw);
        glow(along ? cx + o : cx + side * (dep / 2 + .3), y, along ? cz + side * (dep / 2 + .3) : cz + o, along ? bw : .25, .16, along ? .25 : bw, dim(WARM, .16));
      }
      for (let q = 3; q > 0; q--) prop('box', cx + (r() - .5) * sx * .7, deck + hk + 1.1, cz + (r() - .5) * sz * .7, 3 + r() * 3, .8, 2 + r() * 2, LEAF);
      sign(cx, cz, sx, sz, deck + hk, st, r, dim(pick(r, st.signs), .8 + .4 * r()), { face: along ? (r() < .5 ? 0 : 1) : (r() < .5 ? 2 : 3), blade: true, y: deck + 16 + r() * (hk - 36), sh: 10 + r() * 8, sw: 2.4 });
      if (k + 1 < n) {

        // Deck plaza between rows: planters and lamps.

        const g = v + S / n / 2;
        for (let u = -L / 2 + 6; u < L / 2 - 4; u += 14) {
          const px = along ? x + u : x + g, pz = along ? z + g : z + u;
          prop('box', px, deck + 1.1, pz, 2, .8, 2, LEAF);
          lamp(px + 3, deck + 4.5, pz + 3);
        }
      }
    }
  }

  // Parque Soleado: fake grass and plascrete courts between starscrapers, lit by mall ads, fire barrels at night.

  function parque(x, z, w, d, st0, r) {
    if (H.frame() && G.zoneAt(...G.world(x, z)) !== 'historic' && r() < .8) return deckBlock(x, z, w, d, st0, r);
    const st = own(st0), tw = Math.min(w, d) * .27;
    prop('box', x, .1, z, w, .2, d, [.03, .09, .035]);
    const courts = [[-w * .18, -d * .12, [.03, .06, .12]], [w * .12, d * .14, [.13, .06, .03]], [w * .14, -d * .16, [.03, .06, .12]]];
    for (const [cx, cz, c] of courts) {
      prop('box', x + cx, .25, z + cz, w * .22, .1, d * .2, c);
      glow(x + cx, .32, z + cz, w * .2, .04, .12, [.3, .3, .28]);
      glow(x + cx, .32, z + cz, .12, .04, d * .18, [.3, .3, .28]);
    }
    pool(x, z, Math.min(w, d) * .45, [.06, .04, .09]);

    // Starscrapers on three corners, ad faces turned to the park.

    for (const [sx, sz, face] of [[-1, -1, 0], [1, -1, 1], [-1, 1, 0]]) {
      const tx = x + sx * (w / 2 - tw / 2 - 2), tz = z + sz * (d / 2 - tw / 2 - 2), th = 120 + r() * 80;
      bld(tx, tz, tw, tw, th, { ...st, base: dim(st.base, .8), lit: .26 }, r, { skin: SKINS.curtain, shape: r() < .5 ? 'oct' : 'box' });
      holo(tx, tz, tw, tw, 30 + r() * 40, r, face, tw * .85);
      sign(tx, tz, tw, tw, th, st, r, dim(pick(r, st.signs), 1.1), { face: sz > 0 ? 3 : 2, blade: false, y: 20 + r() * 30, sw: tw * .7, sh: 9 });
      put(GLOWS.ring, tx, th - 2, tz, tw * 1.1, 1, tw * 1.1, 0, 0, dim(BLUE, .4));
    }

    // The mall on the fourth corner throws ad light over the grass.

    const mx = x + w / 2 - tw - 2, mz = z + d / 2 - tw * .6 - 2;
    bld(mx, mz, tw * 2, tw * 1.2, 22, { ...st, lit: .35 }, r, { skin: SKINS.bands });
    for (const t of ['BLUE SUN', 'GOAL!']) { glow(mx - tw * .5 + (t === 'GOAL!') * tw, 14, mz - tw * .6 - .3, tw * .8, 8, .2, dim(pick(r, st.signs), .45)); }
    textSign('PARQUE SOLEADO', x, 4, z + d / 2 - 1, 14, 3.5, 0, dim([.4, 1.5, .5], .7));
    for (let k = 0; k < 5; k++) {
      const px = x + (r() - .5) * w * .6, pz = z + (r() - .5) * d * .6;
      prop('cyl', px, .5, pz, .7, 1, .7, [.1, .05, .03]);
      flickerGlow(px, 1.2, pz, .6, .6, .6, [1.6, .6, .15], r);
      puff(px, 4, pz, 2.5, [.1, .09, .09]);
    }
    for (let k = 0; k < 6; k++) put(GLOWS.sphere, x + (r() - .5) * w * .8, 6, z + (r() - .5) * d * .8, .6, .6, .6, 0, 0, dim(COLD, .6));
  }

  // Harbour yard: container stacks in bays, two rail gantries and floodlight masts. Inland blocks get a deck block.

  function harbour(x, z, w, d, st, r) {
    if (H.frame() && G.coastNear(...G.world(x, z)).d > 320 || G.zoneAt(...G.world(x, z)) === 'historic') return deckBlock(x, z, w, d, st, r);
    prop('box', x, .1, z, w, .2, d, [.045, .045, .05]);
    const cols = Math.floor((w - 8) / 6.8), rows = Math.floor((d - 16) / 3);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (r() < .35 || j % 5 === 4) continue;
      const cx = x - (cols - 1) * 3.4 + i * 6.8, cz = z - (rows - 1) * 1.5 + j * 3;
      const n = 1 + Math.floor(r() * 3);
      prop('box', cx, n * 1.3, cz, 6.1, n * 2.6, 2.4, pick(r, BOX));
    }
    for (const gx of [-w * .25, w * .25]) {
      const yel = [.12, .15, .2], span = d - 6, hh = 22;
      for (const s of [-1, 1]) for (const dx of [-3, 3]) prop('box', x + gx + dx, hh / 2, z + s * span / 2, .9, hh, .9, yel);
      for (const dx of [-3, 3]) prop('box', x + gx + dx, hh, z, 1.2, 1.4, span + 3, yel);
      prop('box', x + gx, hh - .5, z + (r() - .5) * span * .6, 7.5, 2.4, 3.5, yel);
      beacon(x + gx, hh + 1.2, z + span / 2, r);
      glow(x + gx, hh - 2, z, 1, .2, span * .8, dim([1.3, .5, .1], .4));
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const mx = x + sx * (w / 2 - 2), mz = z + sz * (d / 2 - 2);
      prop('cyl', mx, 14, mz, .7, 28, .7, DARK);
      glow(mx, 28, mz, 3.2, .5, 1.2, COLD);
      pool(mx - sx * 8, mz - sz * 8, 22, [.09, .1, .11]);
    }
    const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [x + sx * w / 2, 1.2, z + sz * d / 2]);
    for (let k = 0; k < 4; k++) H.beam(C[k], C[(k + 1) % 4], .1, [.45, .15, .05], 'glow');
  }

  return {
    esm_deckBlock: { zone: 'esmeraldas', build: deckBlock },
    esm_parque: { zone: 'esmeraldas', build: parque },
    esm_harbour: { zone: 'esmeraldas', build: harbour },
  };
}

const FACES4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const lerp = (a, b, t) => a + (b - a) * t;

// Landmarks: Blue Sun Stadium, Chinca Agroplex, Esmeraldas Prison, Puerto Maritimo with the Malecón pier, Arcology E42.

export function landmarks(H) {
  const { THREE, SKINS, GLOWS, beacon, beam, bld, glow, holo, prop, put, stringLights, textSign, flickerGlow } = H;
  const pool = (x, z, rad, rgb) => H.pool?.(x, z, rad, rgb);
  const puff = (x, y, z, rad, rgb) => H.puff?.(x, y, z, rad, rgb);
  const G = geo(H);
  const own = st => st.signs ? st : { ...st, ...ESM };
  const lamp = (x, z, h, rgb) => { prop('cyl', x, h / 2, z, .35, h, .35, DARK); put(GLOWS.sphere, x, h + .3, z, .9, .9, .9, 0, 0, dim(rgb, .9)); pool(x, z, h * .9, dim(rgb, .07)); };

  // Moving parts get their own meshes in the landmark group, because shared instances are frozen into tiles after the build.

  const _o = new THREE.Object3D(), _v = new THREE.Vector3(), _c = new THREE.Color(), _y = new THREE.Vector3(0, 1, 0);
  const mover = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.userData.noTile = true; m.frustumCulled = false; H.decor.add(m); return m; };
  const additive = (rgb, map = null) => new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const SWEEP = { lights: [] }, EVENT = { beams: [] };

  // Frame along the sea: u points to the nearest coast, v runs along it. P(a, b, y) is a local point.

  const shore = () => {
    const s = G.sea(), vx = -s.uz, vz = s.ux;
    return { ...s, vx, vz, ang: Math.atan2(s.ux, s.uz), P: (a, b, y = 0) => [s.ux * a + vx * b, y, s.uz * a + vz * b] };
  };

  return {

    // Blue Sun Stadium: a glowing blue dome over a lit concourse drum, the split field showing through,
    // threedee projectors and event beams on the rim.

    esm_stadium: {
      at: [205, 452], label: 'Blue Sun Stadium', minSide: 80, reach: 500, labelY: 110, face: [.71, .71],
      build(x, z, w, d, st, r) {
        const R = clamp(Math.min(w, d) / 2 + 14, 55, 80), wall = 22, dh = R * .55;
        prop('cyl', x, .15, z, (R + 16) * 2, .3, (R + 16) * 2, [.05, .05, .055]);
        pool(x, z, R + 30, [.03, .08, .18]);
        bld(x, z, R * 2, R * 2, wall, { ...own(st), base: [.06, .07, .09], win: [.5, .75, 1.1], lit: .45 }, r, { shape: 'cyl', skin: SKINS.bands, roof: false });
        put(GLOWS.ring, x, wall + .2, z, R * 2.02, 1, R * 2.02, 0, 0, dim(BLUE, .9));
        put(GLOWS.ring, x, 1.5, z, R * 2.08, 1, R * 2.08, 0, 0, dim(BLUE, .45));

        // Shell: an additive blue cap and a wire lattice inside it.

        const cap = new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const shell = new THREE.Mesh(cap, new THREE.MeshBasicMaterial({ color: new THREE.Color(.05, .17, .45), transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        const grid = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(.12, .4, .9), wireframe: true, transparent: true, opacity: .5, depthWrite: false }));
        for (const m of [shell, grid]) { m.position.set(x, wall, z); m.scale.set(R, dh, R); H.decor.add(m); }

        // Ribs: sixteen meridians of light strips.

        for (let k = 0; k < 16; k++) {
          const a = k * Math.PI / 8;
          let p = null;
          for (let q = 0; q <= 6; q++) {
            const t = q / 6 * Math.PI / 2, n = [x + Math.cos(a) * Math.cos(t) * R * 1.005, wall + Math.sin(t) * dh * 1.005, z + Math.sin(a) * Math.cos(t) * R * 1.005];
            if (p) beam(p, n, .5, dim(BLUE, .55), 'glow');
            p = n;
          }
        }
        for (const t of [.35, .7]) put(GLOWS.ring, x, wall + Math.sin(t * Math.PI / 2) * dh, z, 2 * R * Math.cos(t * Math.PI / 2), 1, 2 * R * Math.cos(t * Math.PI / 2), 0, 0, dim(BLUE, .5));
        put(GLOWS.sphere, x, wall + dh, z, 8, 2, 8, 0, 0, dim(BLUE, 1.2));

        // Split field: a baseball diamond on one half, a football pitch on the other.

        prop('cyl', x, .6, z, R * 1.7, .3, R * 1.7, [.03, .1, .04]);
        glow(x, .8, z, R * 1.5, .05, R * 1.1, [.05, .16, .06]);
        const bx = x - R * .38, s = R * .28;
        for (let k = 0; k < 4; k++) {
          const a0 = k * Math.PI / 2, a1 = a0 + Math.PI / 2;
          beam([bx + Math.cos(a0) * s, .95, z + Math.sin(a0) * s], [bx + Math.cos(a1) * s, .95, z + Math.sin(a1) * s], .35, [.8, .7, .5], 'glow');
        }
        for (let k = -3; k <= 3; k++) glow(x + R * .4 + k * R * .07, .95, z, .25, .05, R * .9, [.6, .6, .6]);
        glow(x, .95, z, .4, .05, R * 1.1, [.7, .7, .7]);

        // Stands: stepped tiers inside the drum, light masts and the name on four sides.

        for (let k = 0; k < 4; k++) bld(x, z, R * (1.95 - k * .1), R * (1.95 - k * .1), 5 + k * 4, { ...own(st), base: [.07, .07, .08], lit: .05 }, r, { shape: 'cyl', y0: 0, roof: false, skin: SKINS.sparse });
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2 + Math.PI / 4;
          textSign('BLUE SUN', x + Math.cos(a) * (R + .6), 12, z + Math.sin(a) * (R + .6), 34, 8.5, Math.atan2(Math.cos(a), Math.sin(a)), [.5, 1.2, 2.4]);
        }

        // Projectors and event beams on the rim, holo shows above them.

        // The event beams lean out and cross slowly over the dome. update() swings them.

        for (let k = 0; k < 6; k++) {
          const a = k * Math.PI / 3 + .2, px = x + Math.cos(a) * R * .96, pz = z + Math.sin(a) * R * .96;
          prop('box', px, wall + 2, pz, 3, 4, 3, DARK);
          EVENT.beams.push([px, wall + 4, pz, a, r() * 6.3]);
        }
        EVENT.mesh = mover(H.PROPS.box.geometry, GLOWS.sphere.material, 6);
        for (let k = 0; k < 6; k++) EVENT.mesh.setColorAt(k, _c.setRGB(...dim(BLUE, .65)));
        for (const k of [0, 1]) holo(x, z, R * .9, R * .9, wall + dh + 20, r, k * 2, 30);
        for (let k = 0; k < 20; k++) { const a = k * Math.PI / 10; lamp(x + Math.cos(a) * (R + 12), z + Math.sin(a) * (R + 12), 8, [.6, .85, 1.3]); }
      },
      update(t) {
        if (!EVENT.mesh) return;
        EVENT.beams.forEach(([px, py, pz, a, ph], i) => {
          const out = 50 + 30 * Math.sin(t * .13 + ph), side = 140 * Math.sin(t * .09 + ph * 1.7), c = Math.cos(a), s = Math.sin(a);
          const dx = c * out - s * side, dy = 420 - py, dz = s * out + c * side, L = Math.hypot(dx, dy, dz);
          _o.position.set(px + dx / 2, py + dy / 2, pz + dz / 2); _o.lookAt(px + dx, py + dy, pz + dz);
          _o.scale.set(.7, .7, L); _o.updateMatrix(); EVENT.mesh.setMatrixAt(i, _o.matrix);
        });
        EVENT.mesh.instanceMatrix.needsUpdate = true;
      },
    },

    // Chinca Agroplex: a windowless 340 m slab banded with hundreds of thin magenta grow-light stripes.

    esm_agroplex: {
      at: [335, 372], label: 'Chinca Agroplex', minSide: 50, reach: 500, labelY: 380, face: [0, 1],
      build(x, z, w, d, st, r) {
        const W = Math.min(w * .75, 80), D = Math.min(d * .5, 34), Ht = 330 + r() * 30, py = 18;
        bld(x, z, w - 4, d - 4, py, { ...own(st), base: [.07, .07, .065], lit: .3 }, r, { skin: SKINS.bands, roof: false });
        bld(x, z, W, D, Ht, { ...own(st), base: [.055, .06, .055], lit: .01, grime: .3 }, r, { y0: py, skin: SKINS.sparse, roof: false });
        let k = 0;
        for (let y = py + 3; y < py + Ht - 6; y += 2.2, k++) {
          if (r() < .1) continue;
          const c = k % 9 === 0 ? dim(GROW, .9) : k % 2 ? dim(GROW, .38) : dim([.45, .12, .7], .35);
          glow(x, y, z + D / 2 + .12, W * .96, .22, .1, c);
          glow(x, y, z - D / 2 - .12, W * .96, .22, .1, c);
          if (k % 2) { glow(x + W / 2 + .12, y, z, .1, .22, D * .94, c); glow(x - W / 2 - .12, y, z, .1, .22, D * .94, c); }
        }

        // Crawler bots on the faces, vents and masts on the roof.

        for (let q = 0; q < 24; q++) glow(x + (r() - .5) * W * .9, py + 10 + r() * (Ht - 20), z + (r() < .5 ? 1 : -1) * (D / 2 + .4), .8, .5, .3, [.3, 1.2, .5]);
        const top = py + Ht;
        prop('box', x, top + 2, z, W * .9, 4, D * .9, [.05, .05, .05]);
        for (let q = 0; q < 6; q++) glow(x - W * .35 + q * W * .14, top + 4.3, z, 3, .3, D * .6, [.2, .6, .7]);
        for (const s of [-1, 1]) { prop('cyl', x + s * W * .4, top + 18, z, .6, 32, .6, [.15, .15, .15]); beacon(x + s * W * .4, top + 34.5, z, r); }
        puff(x, top + 10, z, 14, [.12, .1, .12]);
        textSign('CHINCA AGROPLEX', x, py - 5, z + (d - 4) / 2 + .3, 26, 6.5, 0, dim([.4, 1.5, .5], .9));
        textSign('CHINCA AGROPLEX', x, py - 5, z - (d - 4) / 2 - .3, 26, 6.5, Math.PI, dim([.4, 1.5, .5], .9));
        for (let q = 0; q < 4; q++) prop('box', x - w * .3 + q * w * .2, 1.8, z + d / 2 - 1, 2.6, 3.2, 9, pick(r, BOX));
      },
    },

    // Esmeraldas Prison: a walled peninsula off the shore, joined by a guarded causeway. Two wings in an
    // electrified double fence, guard towers with searchlights, a floodlit ball field and sharkbot lights offshore.

    esm_prison: {
      at: [124, 488], label: 'Esmeraldas Prison', minSide: 60, reach: 450, labelY: 70,
      build(bx, bz, bw, bd, st, r) {

        // The prison covers three times the block's area and sits offshore. A causeway runs out to it.

        const S = shore(), w = bw * 1.73, d = bd * 1.73, W = w / 2, D = d / 2, reach = Math.max(W, D);
        const gap = 50, [x, , z] = S.P(S.d + gap + reach + 12, 0), ps = { ...own(st), base: [.09, .09, .085], win: COLD, lit: .2, grime: .6 };
        prop('box', x, -1.3, z, w + 44, 2.8, d + 44, [.045, .05, .04]);
        prop('box', x, .1, z, w + 10, .2, d + 10, [.05, .05, .045]);
        const neck = S.d + gap + 16, [nx, , nz] = S.P(neck / 2, 0);
        prop('box', nx, -1.3, nz, 26, 2.8, neck + 8, [.06, .06, .058], S.ang);
        for (let k = 0; k <= neck; k += 16) for (const sd of [-11, 11]) { const [lx, , lz] = S.P(k, sd); lamp(lx, lz, 7, COLD); }
        const [gx, , gz] = S.P(S.d + gap - 4, 0);
        bld(gx, gz, 18, 10, 8, ps, r, { skin: SKINS.bands, ry: S.ang });
        for (const [k, off] of [[1, 0], [.94, 1]]) {
          const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [x + a * (W + 4) * k, 0, z + b * (D + 4) * k]);
          for (let i = 0; i < 4; i++) {
            const A = C[i], B = C[(i + 1) % 4];
            for (const y of [1.2, 2.6, 4]) beam([A[0], y, A[2]], [B[0], y, B[2]], .16, dim([.3, 1, 1.5], .75 + .25 * off), 'glow');
            const L = Math.hypot(B[0] - A[0], B[2] - A[2]), n = Math.floor(L / 10);
            for (let q = 0; q < n; q++) { const t = q / n; prop('box', lerp(A[0], B[0], t), 2.2, lerp(A[2], B[2], t), .25, 4.4, .25, DARK); }
          }
        }

        // West wing holds the high-risk block, east wing the runners.

        const [wx, wz] = G.local(-1, 0), side = Math.abs(wx) > Math.abs(wz) ? [Math.sign(wx), 0] : [0, Math.sign(wz)];
        for (const s of [1, -1]) {
          const cx = x + side[0] * s * W * .45, cz = z + side[1] * s * D * .45, bw = side[0] ? W * .55 : w * .7, bd = side[0] ? d * .7 : D * .55;
          const wh = s > 0 ? 24 : 16;
          bld(cx, cz, bw, bd, wh, ps, r, { skin: SKINS.bands });
          for (let y = 4; y < wh - 1; y += 4) for (const f of [-1, 1]) glow(cx, y, cz + f * (bd / 2 + .2), bw * .85, .25, .1, dim(COLD, .35));
          pool(cx, cz, Math.max(bw, bd) * .7, [.08, .09, .1]);
        }
        bld(x, z - D * .65, w * .25, d * .18, 12, ps, r, { skin: SKINS.bands });
        textSign('ESMERALDAS PRISON', x, 9, z - D * .65 - d * .09 - .3, 20, 5, Math.PI, [.9, .95, 1]);

        // Ball field.

        prop('box', x, .25, z + D * .1, W * .7, .1, D * .7, [.03, .08, .035]);
        for (let k = 0; k < 4; k++) { const a0 = k * Math.PI / 2 + Math.PI / 4, a1 = a0 + Math.PI / 2, s = Math.min(W, D) * .2; beam([x + Math.cos(a0) * s, .4, z + D * .1 + Math.sin(a0) * s], [x + Math.cos(a1) * s, .4, z + D * .1 + Math.sin(a1) * s], .25, [.6, .55, .45], 'glow'); }
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lamp(x + a * W * .4, z + D * .1 + b * D * .4, 16, [1.1, 1.1, 1]);

        // Guard towers with searchlights sweeping the yard.

        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]]) {
          const tx = x + a * (W + 8), tz = z + b * (D + 8);
          prop('cyl', tx, 8, tz, 1.6, 16, 1.6, [.08, .08, .08]);
          prop('box', tx, 17.5, tz, 4.5, 3, 4.5, [.08, .08, .085]);
          glow(tx, 17.5, tz, 4.6, .8, 4.6, dim(COLD, .4));
          SWEEP.lights.push([tx, tz, .1 + r() * .08, .13 + r() * .08, r() * 6.3, r() * 6.3]);
          beacon(tx, 20, tz, r);
        }

        // Each searchlight is a soft beam with a lit spot where it meets the ground. update() sweeps them.

        const spotTex = H.canvasTexture(64, 64, (g, Wc) => {
          const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
          gr.addColorStop(0, '#fff'); gr.addColorStop(.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr; g.fillRect(0, 0, Wc, Wc);
        });
        const n = SWEEP.lights.length;
        SWEEP.cone = mover(H.beamGeo, H.searchBeam([.85, .92, 1.1], 3), n);
        SWEEP.spot = mover(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), additive([.5, .52, .6], spotTex), n);
        SWEEP.x = x; SWEEP.z = z; SWEEP.W = W * .8; SWEEP.D = D * .8;

        // Sharkbot water: dim red and cyan points offshore, a buoy line.

        for (let k = 0; k < 18; k++) {
          const [px, , pz] = S.P(S.d + gap + 2 * reach + 40 + r() * 140, (r() - .5) * 360);
          glow(px, -1.7, pz, .7, .2, .7, r() < .6 ? [1.4, .1, .08] : [.2, .9, 1.2]);
        }
        for (let k = -6; k <= 6; k++) { const [px, , pz] = S.P(S.d + gap + 2 * reach + 60, k * 30); put(GLOWS.sphere, px, -1.4, pz, 1, 1, 1, 0, 0, [1.4, .5, .1]); }
        return { focus: [x, z], face: [0, -1] };
      },
      update(t) {
        if (!SWEEP.cone) return;
        SWEEP.lights.forEach(([tx, tz, sa, sb, pa, pb], i) => {
          const ex = SWEEP.x + Math.sin(t * sa + pa) * SWEEP.W, ez = SWEEP.z + Math.sin(t * sb + pb) * SWEEP.D;
          _o.position.set(tx, 18.5, tz); _v.set(ex, .4, ez).sub(_o.position);
          _o.quaternion.setFromUnitVectors(_y, _v.clone().normalize());
          _o.scale.set(6, _v.length(), 6); _o.updateMatrix(); SWEEP.cone.setMatrixAt(i, _o.matrix);
          _v.add(_o.position);
          _o.quaternion.identity(); _o.position.copy(_v); _o.scale.set(7, 1, 7); _o.updateMatrix(); SWEEP.spot.setMatrixAt(i, _o.matrix);
        });
        SWEEP.cone.instanceMatrix.needsUpdate = SWEEP.spot.instanceMatrix.needsUpdate = true;
      },
    },

    // Puerto Maritimo: warehouses and a container yard, quay cranes over the water, supertainers alongside,
    // floating jetties, and the unfinished Malecón pier with Bloc E69 on its piles.

    esm_port: {
      at: [165, 386], label: 'Puerto Maritimo & the Malecón', minSide: 50, reach: 450, labelY: 90,
      build(x, z, w, d, st, r) {
        const S = shore(), q = clamp(S.d, 15, 90), { P, ang } = S, st2 = { ...own(st), grime: .75, lit: .2 };
        const at2 = (a, b) => { const p = P(a, b); return [p[0], p[2]]; };
        const box = (a, b, y, la, lb, h, rgb, extra = 0) => { const [px, pz] = at2(a, b); prop('box', px, y, pz, lb, h, la, rgb, ang + extra); };

        // Land: two barrel-roofed sheds, the yard between them and the quay.

        for (const b of [-45, 45]) {
          const [px, pz] = at2(q - 60, b);
          bld(px, pz, 70, 36, 15, { ...st2, base: [.08, .08, .085] }, r, { ry: ang, skin: SKINS.sparse, roof: false });
          prop('cyl', px, 15, pz, 36, 70, 11, [.07, .075, .08], ang - Math.PI / 2, Math.PI / 2);
          for (let k = -3; k <= 3; k++) { const [gx, gz] = at2(q - 41.8, b + k * 9); prop('box', gx, 2.4, gz, 5, 4, .2, r() < .7 ? dim(SODIUM, .45) : [.05, .04, .03], ang); }
        }
        { const [tx, tz] = at2(q - 41.6, -45); textSign('PUERTO MARITIMO', tx, 11, tz, 30, 7.5, ang, [1.3, .7, .3]); }
        box(q - 5, 0, .4, 10, 360, .8, [.07, .07, .07]);
        { const a = P(q - .3, -180, .9), b = P(q - .3, 180, .9); beam(a, b, .25, dim(SODIUM, .6), 'glow'); }
        for (let b = -150; b <= 150; b += 12) for (let a = q - 32; a < q - 12; a += 3) {
          if (r() < .4 || Math.abs(b) < 8) continue;
          const n = 1 + Math.floor(r() * 4), [px, pz] = at2(a, b);
          prop('box', px, n * 1.3, pz, 12, n * 2.6, 2.4, pick(r, BOX), ang);
        }

        // Quay cranes: portal legs on the quay, a boom out over the water, an A-frame and stays.

        const CR = [.16, .2, .26], CW = [.9, .45, .1];
        for (let k = 0; k < 5; k++) {
          const b = -120 + k * 60, top = 46;
          for (const da of [-8, 8]) for (const db of [-7, 7]) beam(P(q + da, b + db, 0), P(q + da, b + db, top), 1.3, CR);
          for (const db of [-4, 4]) beam(P(q - 30, b + db, top), P(q + 58, b + db, top), 1.4, CR);
          for (const da of [-8, 8]) beam(P(q + da, b - 7, top - 14), P(q + da, b + 7, top - 14), 1, CR);
          beam(P(q - 4, b, top), P(q - 6, b, top + 22), 1.2, CR);
          beam(P(q - 6, b, top + 22), P(q + 58, b, top + .5), .35, CR);
          beam(P(q - 6, b, top + 22), P(q - 30, b, top + .5), .35, CR);
          const [cx, cz] = at2(q + 14 + r() * 30, b);
          prop('box', cx, top - 2.5, cz, 4, 3, 5, [.2, .2, .2], ang);
          glow(cx, top - 4.2, cz, 1.4, .3, 1.4, [1.2, 1.1, .9]);
          pool(cx, cz, 12, [.1, .1, .1]);
          const [ex, ez] = at2(q + 58, b);
          beacon(ex, top + 1.5, ez, r);
          const [hx, hz] = at2(q - 6, b);
          beacon(hx, top + 23, hz, r);
          for (const da of [-8, 8]) { const [lx, lz] = at2(q + da, b); glow(lx, 6, lz, 1.2, .4, 1.2, dim(CW, .8)); }
        }

        // Supertainers: one alongside the quay, one at anchor offshore.

        const ship = (a, b, L, B, full) => {
          box(a, b, 4, B, L, 14, [.08, .03, .028]);
          box(a, b, 11.2, B * .96, L * .98, .4, [.06, .06, .06]);
          box(a, b + L / 2 + 5, 6, B * .6, 10, 10, [.08, .03, .028]);
          const [hx, hz] = at2(a, b - L / 2 + 14);
          bld(hx, hz, 12, B * .8, 24, { ...st2, base: [.14, .14, .13], win: COLD, lit: .5 }, r, { y0: 11, ry: ang, skin: SKINS.bands, roof: false });
          for (let bb = b - L / 2 + 28; bb < b + L / 2 - 6; bb += 13) for (let aa = -1; aa <= 1; aa++) {
            if (!full && r() < .4) continue;
            const n = 2 + Math.floor(r() * 4), [px, pz] = at2(a + aa * B * .3, bb);
            prop('box', px, 11.4 + n * 1.3, pz, 12, n * 2.6, B * .28, pick(r, BOX), ang);
          }
          const [rx, rz] = at2(a - B / 2, b), [gx, gz] = at2(a + B / 2, b), [mx, mz] = at2(a, b - L / 2 + 14);
          glow(rx, 13, rz, .8, .8, .8, [1.6, .1, .1]);
          glow(gx, 13, gz, .8, .8, .8, [.1, 1.4, .3]);
          prop('cyl', mx, 45, mz, .4, 20, .4, [.2, .2, .2]);
          beacon(mx, 55.5, mz, r);
          for (let k = 0; k < 5; k++) { const [px, pz] = at2(a, b - L / 2 + 30 + k * L / 5.5); put(GLOWS.sphere, px, 30, pz, .8, .8, .8, 0, 0, [1.1, 1, .85]); }
        };
        ship(q + 32, 0, 300, 44, true);
        ship(q + 260, 120, 260, 40, false);

        // Floating jetties beyond the cranes.

        for (const b of [175, 200, 225]) {
          box(q + 60, b, -1.6, 120, 4, .5, [.06, .06, .06]);
          for (let a = q + 10; a < q + 120; a += 28) { const [lx, lz] = at2(a, b); put(GLOWS.sphere, lx, -.6, lz, .6, .6, .6, 0, 0, dim(SODIUM, .8)); }
        }

        // The Malecón pier: a giant deck on piles with gaps, half-built frames, shacks and Bloc E69 at its edge.

        const pb = -230, pw = 70, tops = [];
        for (let a = q; a < q + 240; a += 24) {
          for (const db of [-30, -10, 10, 30]) { const [px, pz] = at2(a + 12, pb + db); prop('cyl', px, 3.5, pz, 1.6, 11, 1.6, [.07, .065, .06]); }
          if (r() < .18) { beam(P(a, pb - pw / 2, 8.5), P(a + 24, pb - pw / 2, 8.5), .6, [.1, .1, .1]); continue; }
          box(a + 12, pb, 9, 23.6, pw, 1.2, CONC);
          const roll = r();
          if (roll < .4) {
            const fl = 2 + Math.floor(r() * 4);
            for (const da of [2, 22]) for (const db of [-20, 0, 20]) beam(P(a + da, pb + db, 9.6), P(a + da, pb + db, 9.6 + fl * 3.6), .6, [.14, .13, .12]);
            for (let f = 1; f <= fl; f++) { beam(P(a + 2, pb - 20, 9.6 + f * 3.6), P(a + 2, pb + 20, 9.6 + f * 3.6), .5, [.13, .12, .11]); if (r() < .5) beam(P(a + 22, pb - 20, 9.6 + f * 3.6), P(a + 22, pb + 20, 9.6 + f * 3.6), .5, [.13, .12, .11]); }
            if (r() < .4) { const [cx, cz] = at2(a + 12, pb); prop('box', cx, 9.6 + fl * 3.6 + .2, cz, 22, .4, 20, CONC, ang); }
          } else {
            for (let n = 2 + Math.floor(r() * 3); n > 0; n--) {
              const [sx, sz] = at2(a + 3 + r() * 18, pb + (r() - .5) * (pw - 10)), h = 3 + r() * 4;
              bld(sx, sz, 5 + r() * 4, 4 + r() * 4, h, { ...st2, base: pick(r, PASTEL), lit: .4 + .3 * r() }, r, { y0: 9.6, ry: ang + (r() - .5) * .3, skin: SKINS.sparse, roof: false });
              tops.push([sx, 9.6 + h, sz]);
              if (r() < .4) flickerGlow(sx, 11, sz, 1, 1.6, 1, dim(pick(r, own(st).signs), .6), r);
            }
          }
        }
        for (let k = 0; k + 1 < tops.length; k += 2) stringLights(tops[k], tops[k + 1], 1, 6, r() < .6 ? WARM : [1.4, .4, .8]);
        {
          const [cx, cz] = at2(q + 120, pb + 25);
          put(H.PROPS.lattice, cx, 35, cz, 3, 70, 3);
          beam(P(q + 90, pb + 25, 68), P(q + 170, pb + 25, 68), 1, [.3, .2, .04]);
          beacon(cx, 71, cz, r);
        }

        // Bloc E69: cold condo slabs on bare piles at the pier edge.

        for (const [a, b, L] of [[q + 268, pb - 12, 56], [q + 262, pb + 30, 40]]) {
          for (let i = -2; i <= 2; i++) for (const j of [-6, 6]) { const [px, pz] = at2(a + j, b + i * L / 5); prop('cyl', px, 2.5, pz, 1.1, 9, 1.1, [.06, .06, .055]); }
          const [bx, bz] = at2(a, b);
          bld(bx, bz, L, 16, 34 + r() * 10, { ...st2, base: [.08, .09, .09], win: [.7, .85, .95], lit: .22 }, r, { y0: 7, ry: ang + (r() - .5) * .06, skin: SKINS.bands });
          puff(bx, 3, bz, 10, [.1, .11, .12]);
        }
        { const [tx, tz] = at2(q + 259.5, pb - 12); textSign('BLOC E69', tx, 12, tz, 14, 3.5, ang + Math.PI, [.5, .7, .8]); }

        // The camera looks in from the sea, at the cranes and the shed sign.

        return { face: [S.ux, S.uz] };
      },
    },

    // Arcology E42: a shoreline arcology lit only in its lower third. Luxury floors above stand empty.

    esm_e42: {
      at: [150, 546], label: 'Arcology E42', minSide: 50, reach: 450, labelY: 300, face: [0, 1],
      build(x, z, w, d, st, r) {
        const W = Math.min(w, d) * .62, lo = 85, hi = 200 + r() * 40, as = { ...own(st), base: [.09, .085, .08] };
        bld(x, z, w - 6, d - 6, 20, { ...as, lit: .35 }, r, { skin: SKINS.bands, roof: false });
        bld(x, z, W, W, lo, { ...as, lit: .42 }, r, { y0: 20, shape: 'oct', skin: SKINS.grid, roof: false });
        bld(x, z, W * .9, W * .9, hi, { ...as, lit: .015, base: [.06, .065, .07] }, r, { y0: 20 + lo, shape: 'oct', skin: SKINS.curtain, roof: false });
        bld(x, z, W * .5, W * .5, 30, { ...as, lit: .0 }, r, { y0: 20 + lo + hi, shape: 'oct', skin: SKINS.fins, roof: false });
        put(GLOWS.ring, x, 20 + lo, z, W * 1.02, 1, W * 1.02, 0, 0, dim(WARM, .5));
        for (let k = 0; k < 14; k++) { const a = r() * Math.PI * 2; flickerGlow(x + Math.cos(a) * W * .46, 20 + lo + 6 + r() * hi * .8, z + Math.sin(a) * W * .46, 1.2, 1, 1.2, [1.2, .6, .25], r); }
        const top = 20 + lo + hi + 30;
        prop('cyl', x, top + 15, z, .6, 30, .6, [.15, .15, .15]);
        beacon(x, top + 30.5, z, r);
        textSign('E42', x, top - 12, z + W * .25 + .3, 14, 3.5, 0, [.5, .4, .3]);
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; glow(x + Math.cos(a) * (w / 2 - 3.2), 2, z + Math.sin(a) * (d / 2 - 3.2), Math.abs(Math.sin(a)) * 12 + .3, 3, Math.abs(Math.cos(a)) * 12 + .3, [.06, .05, .04]); }
        for (let k = 0; k < 5; k++) { const px = x + (r() - .5) * (w - 10), pz = z + (d / 2 + 4) * (r() < .5 ? 1 : -1); flickerGlow(px, .8, pz, .6, .6, .6, [1.6, .6, .15], r); puff(px, 3, pz, 2, [.1, .09, .09]); }
      },
    },
  };
}
