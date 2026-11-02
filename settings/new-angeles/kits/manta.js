// Manta: the resort coast. Three bands run parallel to the shore, the party Strip, a wall of office towers, then warehouses.
// Lot kits read H.frame() and fall back to an s × s square. In the city a kit swaps itself for the kit of the same rank in its shore band.

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MAN_SIGNS = [[1.8, .2, 1.3], [.2, 1.6, 1.5], [.4, .9, 1.8], [1.8, .6, .6]];
const HOTELS = ['PACIFICA', 'SOLARA', 'MAR AZUL', 'THE PEARL', 'OCEANO', 'LA PERLA', 'HALCYON', 'SPONDYLUS', 'MANTARAYA', 'CORAL BAY'];
const CLUBS = ['SYNESTHESIA', 'NOX', 'SUNSET', 'AQUA', 'DEEP END', 'TIDE', 'CLUB 9', 'REEF', 'LUMEN', 'VELVET', 'SALT'];
let M = null;
const CORPS = ['HEUREKA', 'I/O SECURE DATA', 'PELE', 'THE BROADSHEET', 'HAAS-BIOROID', 'GENEBRIDGE', 'OCEANUS LABS', 'PACIFIC GENOMICS'];

export function kits(H) {
  const { GLOWS, SKINS, beacon, beam, bld, glow, helipad, holo, lerp, pool, prop, put, puff, sign, stringLights, textSign } = H;
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const dims = (s, cap = 70) => { const f = H.frame(); return f?.w ? [Math.min(f.w - 2, cap), Math.min(f.d - 2, cap)] : [s, s]; };
  const pal = st => st.signs ?? MAN_SIGNS;
  const dim = (rgb, k) => rgb.map(c => c * k);

  const PEARL = [.3, .31, .34], SAND = [.42, .4, .35], WHITE = [1.3, 1.35, 1.4], WARM = [1.4, .9, .5], POOLC = [.08, .9, 1.1];
  const look = (st, o) => ({ ...st, ...o });

  // A palm: leaning trunk, flat crown and an uplight.

  const palm = (x, z, h, r) => {
    const lean = (r() - .5) * .25, ry = r() * 6.3;
    prop('cyl', x, h / 2, z, .45, h, .45, [.12, .09, .06], ry, lean);
    prop('cone', x + Math.sin(ry) * lean * h * .5, h, z + Math.cos(ry) * lean * h * .5, 6 + r() * 2, 1.4, 6 + r() * 2, [.03, .1, .05], r() * 6);
    glow(x, .3, z, .4, .4, .4, [.9, 1, .7]);
  };

  // Lot frame position in world space, distance to the shore, and the local unit vector toward the sea.

  const toW = (x, z) => {
    const F = H.frame();
    if (!F) return [x, z];
    const dx = x - F.cx, dz = z - F.cz;
    return [(F.tx ?? F.cx) + dx * F.c + dz * F.s, (F.tz ?? F.cz) - dx * F.s + dz * F.c];
  };
  const toL = (wx, wz) => {
    const F = H.frame();
    if (!F) return [wx, wz];
    const dx = wx - (F.tx ?? F.cx), dz = wz - (F.tz ?? F.cz);
    return [F.cx + dx * F.c - dz * F.s, F.cz + dx * F.s + dz * F.c];
  };
  const COAST = H.CITY.coast ?? [];
  const shore = (wx, wz) => {
    let best = { d: Infinity, x: wx, z: wz + 1 };
    for (const line of COAST) for (let i = 0; i + 1 < line.length; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1], ex = bx - ax, ez = bz - az;
      const t = Math.max(0, Math.min(1, ((wx - ax) * ex + (wz - az) * ez) / (ex * ex + ez * ez)));
      const px = ax + ex * t, pz = az + ez * t, d = Math.hypot(wx - px, wz - pz);
      if (d < best.d) best = { d, x: px, z: pz };
    }
    return best;
  };
  const sea = (x, z) => {
    if (!H.frame()) return { d: 30, u: 0, v: 1 };
    const [wx, wz] = toW(x, z), c = shore(wx, wz), [lx, lz] = toL(c.x, c.z), L = Math.hypot(lx - x, lz - z) || 1;
    return { d: c.d, u: (lx - x) / L, v: (lz - z) / L };
  };
  const snap = s => Math.abs(s.u) > Math.abs(s.v) ? { x: Math.sign(s.u), z: 0 } : { x: 0, z: Math.sign(s.v) || 1 };
  const faceIdx = f => f.x > 0 ? 0 : f.x < 0 ? 1 : f.z > 0 ? 2 : 3;
  const ryOf = f => Math.atan2(f.x, f.z);

  // Shore band of a world point: named sub-areas first, then distance from the coast. Docks hold both ends.

  const band = (wx, wz) => {
    const d = shore(wx, wz).d, py = wz / 3.6 + 390;
    if ((py < 860 || py > 1268) && d < 110) return 'docks';
    const sub = H.subareaAt(wx, wz);
    if (sub === 'The Strip' || sub === 'Sunken City') return 'strip';
    if (sub === 'Business Subdistrict') return d < 120 ? 'wall' : 'business';
    if (sub === 'Warehouse Subdistrict') return 'warehouse';
    return d < 75 ? 'strip' : d < 120 ? 'wall' : d < 200 ? 'business' : 'warehouse';
  };

  // Shop fronts: lit glass with a small neon sign, on face f of a w × d box.

  const shopfront = (x, z, w, d, f, st, r, n = 2) => {
    const span = f.x ? d : w, out = (f.x ? w : d) / 2 + .15;
    for (let k = 0; k < n; k++) {
      const along = ((k + .5) / n - .5) * span * .9, sw = span / n * .8;
      const px = x + f.x * out - f.z * along, pz = z + f.z * out + f.x * along;
      glow(px, 1.8, pz, f.x ? .2 : sw, 3, f.x ? sw : .2, r() < .6 ? [.9, .95, 1] : WARM);
      if (r() < .5) textSign(pick(r, CLUBS), px + f.x * .2, 4.4, pz + f.z * .2, sw * .8, sw * .2, ryOf(f), dim(pick(r, pal(st)), .8));
    }
  };

  // Sculpture-hotel body: twisted slabs, cantilevered blocks or a pearl egg, lit edges, a halo crown.

  const sculpture = (x, z, W, D, h, st, r, mode = r()) => {
    const S = look(st, { base: PEARL.map(c => c * (.9 + .3 * r())), win: [.9, .96, 1], lit: .32 });
    const P = pal(st), accent = pick(r, P);
    let top = h, tw = Math.min(W, D) * .7;
    if (mode < .4) {
      const n = 7 + Math.floor(r() * 6), twist = (r() < .5 ? 1 : -1) * (.08 + r() * .1), sh = h / n;
      for (let k = 0; k < n; k++) {
        const sc = 1 - .25 * Math.abs(k / n - .5);
        bld(x, z, W * .8 * sc, D * .45 * sc, sh - .6, S, r, { y0: k * sh, ry: k * twist, glow: .35, skin: SKINS.bands, roof: false });
        if (k % 2) glow(x, (k + 1) * sh - .3, z, Math.min(W, D) * .3, .2, Math.min(W, D) * .3, dim(accent, .25));
      }
      tw = Math.min(W, D) * .4;
    } else if (mode < .7) {
      const cw = Math.min(W, D) * .45;
      bld(x, z, cw, cw, h, S, r, { glow: .25, skin: SKINS.curtain, roof: false });
      for (let k = 0, n = 3 + Math.floor(r() * 2); k < n; k++) {
        const y = h * (.25 + .6 * k / n), f = H.FACES[Math.floor(r() * 4)], bw = cw * (1.1 + r() * .6), bh = 6 + r() * 8, o = cw * .5;
        const bx = x + f[0] * o, bz = z + f[1] * o;
        bld(bx, bz, f[0] ? bw : cw * .9, f[0] ? cw * .9 : bw, bh, S, r, { y0: y, glow: .5, skin: SKINS.curtain, roof: false });
        glow(bx, y - .2, bz, (f[0] ? bw : cw) * .8, .15, (f[0] ? cw : bw) * .8, dim(accent, .45));
      }
      tw = cw;
    } else {
      const n = 9, R = Math.min(W, D) * .5;
      for (let k = 0; k < n; k++) {
        const t = (k + .5) / n, rad = R * (.45 + .55 * Math.sin(Math.PI * Math.min(1, t * 1.1)));
        bld(x, z, rad * 2, rad * 2 * (D > W ? 1.2 : .85), h / n, S, r, { y0: k * h / n, shape: 'cyl', glow: .3, skin: SKINS.bands, roof: false });
      }
      tw = R * .6;
    }
    put(GLOWS.ring, x, top + 1, z, tw * 1.4, tw * 1.4, tw * 1.4, 0, 0, dim(accent, .9));
    if (r() < .5) beacon(x, top + 2, z, r); else helipad(x, z, Math.min(14, tw), top, r);
    return { top, accent };
  };

  // Lasers from a roof fanning up and out toward the sea.

  const lasers = (x, y, z, s, n, st, r) => {
    for (let k = 0; k < n; k++) {
      const a = Math.atan2(s.u, s.v) + (r() - .5) * 1.6, L = 30 + r() * 40, e = .5 + r() * .6;
      beam([x, y, z], [x + Math.sin(a) * L * Math.cos(e), y + L * Math.sin(e), z + Math.cos(a) * L * Math.cos(e)], .12, dim(pick(r, pal(st)), .55), 'glow');
    }
  };

  // A yacht moored with lit cabins.

  const yacht = (x, z, len, ry, r) => {
    const w = len * .28, y = -2;
    prop('box', x, y + .6, z, w, 1.4, len, [.55, .56, .58], ry);
    prop('box', x, y + 1.9, z - Math.cos(ry) * len * .05, w * .75, 1.2, len * .5, [.6, .62, .64], ry);
    glow(x, y + 1.9, z, w * .78, .35, len * .3, r() < .7 ? [1.2, 1.15, 1] : [.4, .9, 1.4]);
    if (r() < .4) { prop('cyl', x, y + 8, z, .15, 12, .15, [.4, .4, .4]); glow(x, y + 14, z, .3, .3, .3, [1.6, .2, .2]); }
    if (r() < .35) put(GLOWS.sphere, x, y + .2, z, w * 3, .2, len * 1.2, ry, 0, [.02, .1, .14]);
  };

  const raw = {
    // Sculpture resort: a beachfront hotel shaped like an art piece, with a pool deck and palms on the sand.

    man_sculpt(x, z, s, st, b, r) {
      const [W, D] = dims(s), sv = sea(x, z), f = snap(sv), h = lerp(40, 130, r() ** 1.3) * Math.min(b, 1.3);
      const { top, accent } = sculpture(x, z, W, D, h, st, r);
      const px = x + f.x * (W / 2 - 3), pz = z + f.z * (D / 2 - 3);
      glow(px, .2, pz, f.x ? 4 : W * .6, .15, f.x ? D * .6 : 4, dim(POOLC, .35));
      for (let k = 0; k < 3; k++) palm(px + f.z * (k - 1) * W * .3, pz + f.x * (k - 1) * D * .3, 9 + r() * 5, r);
      textSign(pick(r, HOTELS), x + f.x * (W * .42), top * .82, z + f.z * (D * .42), Math.min(W, D) * .7, Math.min(W, D) * .17, ryOf(f), dim(accent, 1.1));
      pool(x, z, Math.max(W, D) * .6, dim(accent, .08));
    },

    // Beach club: a low pavilion on the sand, a lit floor, lasers and string lights out to the surf.

    man_beachclub(x, z, s, st, b, r) {
      const [W, D] = dims(s), sv = sea(x, z), f = snap(sv), P = pal(st), c1 = pick(r, P), c2 = pick(r, P);
      prop('box', x, .08, z, W, .16, D, SAND);
      const pw = W * (.45 + .2 * r()), pd = D * (.4 + .2 * r()), ph = 5 + r() * 6, bx = x - f.x * W * .2, bz = z - f.z * D * .2;
      bld(bx, bz, pw, pd, ph, look(st, { base: [.22, .22, .24], lit: .6 }), r, { glow: 1, skin: SKINS.curtain, roof: false });
      prop('box', bx, ph + .3, bz, pw + 6, .4, pd + 6, [.16, .16, .18]);
      glow(bx, ph + .05, bz, pw + 5.6, .2, pd + 5.6, dim(c1, .35));
      const fx = x + f.x * W * .18, fz = z + f.z * D * .18, fw = W * .4, fd = D * .4;
      glow(fx, .2, fz, fw, .1, fd, dim(c2, .3));
      for (let k = 0; k < 4; k++) put(GLOWS.sphere, fx + (r() - .5) * fw, .3, fz + (r() - .5) * fd, 4, .2, 4, 0, 0, dim(pick(r, P), .5));
      lasers(bx, ph + 1, bz, sv, 3 + Math.floor(r() * 4), st, r);
      const reach = Math.min(70, sv.d + 12);
      for (let k = -1; k <= 1; k++) {
        const ox = -f.z * k * W * .3, oz = f.x * k * D * .3, a = [bx + ox, ph, bz + oz], e = [bx + ox + f.x * reach, 4, bz + oz + f.z * reach];
        prop('cyl', e[0], 2, e[2], .2, 4, .2, [.2, .2, .2]);
        stringLights(a, e, 1, Math.max(6, Math.floor(reach / 5)), k ? WARM : dim(c1, .8));
      }
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) {
        const ux = x + (r() - .5) * W * .8, uz = z + (r() - .5) * D * .8;
        prop('cone', ux, 2.6, uz, 3.2, .7, 3.2, dim(pick(r, P), .25));
        prop('cyl', ux, 1.2, uz, .1, 2.4, .1, [.3, .3, .3]);
      }
      textSign(pick(r, CLUBS), bx + f.x * (pw / 2 + 3.2), ph + 2.2, bz + f.z * (pd / 2 + 3.2), Math.min(pw, 16), Math.min(pw, 16) * .25, ryOf(f), dim(c1, 1.2));
      pool(x, z, Math.max(W, D) * .7, dim(c1, .1));
    },

    // Holopark: palms and a fountain plaza by night, or a projected jungle of teal and green light.

    man_holopark(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      prop('box', x, .08, z, W, .16, D, [.2, .2, .2]);
      if (r() < .55) {
        const JUNGLE = [[.05, .4, .2], [.03, .3, .3], [.1, .5, .12], [.02, .25, .35], [.2, .45, .1]];
        for (let k = 10 + Math.floor(r() * 8); k > 0; k--) {
          const rad = 3 + r() * 5, rgb = pick(r, JUNGLE).map(c => c * (.4 + .4 * r())), px = x + (r() - .5) * (W - rad), pz = z + (r() - .5) * (D - rad);
          puff(px, rad * (.6 + r()), pz, rad, rgb);
          put(GLOWS.sphere, px, rad * .5, pz, .5, .5, .5, 0, 0, dim(rgb, 4));
        }
        for (let k = 0; k < 4; k++) {
          const px = x + (k % 2 - .5) * W * .85, pz = z + (Math.floor(k / 2) - .5) * D * .85;
          prop('cyl', px, 3, pz, .5, 6, .5, [.2, .22, .25]);
          glow(px, 6.3, pz, .7, .6, .7, [.5, 1.6, 1.2]);
        }
        for (let k = 3 + Math.floor(r() * 3); k > 0; k--) palm(x + (r() - .5) * W * .8, z + (r() - .5) * D * .8, 12 + r() * 8, r);
        if (r() < .5) holo(x, z, W * .6, D * .6, 10, r, undefined, 12);
        pool(x, z, Math.max(W, D) * .7, [.02, .12, .08]);
      } else {
        prop('cyl', x, .5, z, 10, 1, 10, [.25, .25, .27]);
        glow(x, 1.05, z, 8, .1, 8, dim(POOLC, .35));
        for (let k = 0; k < 5; k++) glow(x + (k - 2) * 1.6, 2 + r() * 3, z, .25, 3 + r() * 3, .25, [.5, 1.1, 1.3]);
        const n = 6 + Math.floor(r() * 4);
        for (let k = 0; k < n; k++) {
          const a = k / n * 6.28;
          palm(x + Math.cos(a) * W * .38, z + Math.sin(a) * D * .38, 11 + r() * 6, r);
        }
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pool(x + sx * W * .3, z + sz * D * .3, 8, [.12, .12, .11]);
      }
    },

    // Indoor ski hall: a long glazed shed that climbs along the lot, a white lit run under its sloped roof.

    man_skidome(x, z, s, st, b, r) {
      const [W, D] = dims(s, 90), along = W >= D, L = (along ? W : D) - 2, S = Math.min(along ? D : W, 30) - 2;
      const h0 = 14, h1 = (55 + r() * 45) * Math.min(b, 1.2), n = 6, seg = L / n, ang = Math.atan2(h1 - h0, L);
      const at = u => along ? [x + u, z] : [x, z + u];
      const S2 = look(st, { base: [.22, .23, .26], win: [.9, .97, 1], lit: .26 });
      for (let k = 0; k < n; k++) {
        const u = -L / 2 + (k + .5) * seg, hh = lerp(h0, h1, (k + 1) / n), [px, pz] = at(u);
        bld(px, pz, along ? seg - .3 : S, along ? S : seg - .3, hh, S2, r, { skin: SKINS.curtain, roof: false });
      }
      const [cx, cz] = at(0), roofY = (h0 + h1) / 2 + 1, len = Math.hypot(L, h1 - h0);
      prop('box', cx, roofY, cz, along ? len : S + 2, .8, along ? S + 2 : len, [.24, .25, .28], along ? Math.PI / 2 : 0, -ang);
      const a = at(-L / 2), e = at(L / 2);
      for (const o of [-S * .25, 0, S * .25]) beam([a[0] + (along ? 0 : o), h0 + 1.4, a[1] + (along ? o : 0)], [e[0] + (along ? 0 : o), h1 + 1.4, e[1] + (along ? o : 0)], 1.4, [1.5, 1.6, 1.7], 'glow');
      glow(a[0], 3, a[1], along ? .3 : S * .7, 4, along ? S * .7 : .3, [1, 1.1, 1.2]);
      textSign('SNOWDOME', e[0], h1 + 6, e[1], 22, 5.5, along ? Math.PI / 2 : 0, dim(pick(r, pal(st)), 1.1));
      beacon(e[0], h1 + 1, e[1], r);
    },

    // Office wall tower: a modest glass tower with lit sea-facing top floors and a corporate logo.

    man_officewall(x, z, s, st, b, r) {
      const [W, D] = dims(s), sv = sea(x, z), f = snap(sv), h = lerp(60, 140, r() ** 1.2) * Math.min(b, 1.3);
      const w = W * (.7 + .2 * r()), d = D * (.7 + .2 * r()), skin = r() < .6 ? SKINS.curtain : SKINS.fins;
      const S = look(st, { base: [.12, .14, .17], win: [.85, .95, 1], lit: .3 });
      bld(x, z, w, d, h * .78, S, r, { skin, roof: false, glow: .3 });
      bld(x, z, w * .82, d * .82, h * .22, look(S, { lit: .45 }), r, { y0: h * .78, skin: SKINS.curtain, glow: .3 });
      const out = (f.x ? w : d) / 2 + .2;
      glow(x + f.x * out * .82, h * .89, z + f.z * out * .82, f.x ? .2 : w * .78, h * .2, f.x ? d * .78 : .2, [.2, .23, .26]);
      textSign(pick(r, CORPS), x + f.x * (out * .82 + .3), h * .97 - 3, z + f.z * (out * .82 + .3), Math.min(w, d) * .75, Math.min(w, d) * .19, ryOf(f), dim(pick(r, pal(st)), 1));
      if (r() < .5) helipad(x, z, Math.min(w, d) * .5, h, r); else { put(GLOWS.ring, x, h + .5, z, w * .7, w * .7, w * .7, 0, 0, [.5, .8, 1]); beacon(x, h + 1, z, r); }
      const fr = H.frame()?.front ?? f;
      shopfront(x, z, w, d, fr, st, r, 2);
      for (let k = -1; k <= 1; k += 2) palm(x + fr.x * (W / 2 - 1) - fr.z * k * W * .35, z + fr.z * (D / 2 - 1) + fr.x * k * D * .35, 10 + r() * 4, r);
    },

    // Mid-rise maze: plain office and flat blocks with tiny alleys, roof gardens and many lit windows.

    man_midmaze(x, z, s, st, b, r) {
      const [W, D] = dims(s), nx = W > 34 ? 2 : 1, nz = D > 34 ? 2 : 1, cw = W / nx, cd = D / nz;
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const cx = x + (i + .5) * cw - W / 2, cz = z + (j + .5) * cd - D / 2, h = (24 + r() * 40) * Math.min(b, 1.3);
        const S = look(st, { base: PEARL.map(c => c * (.6 + .4 * r())), lit: .38 + .2 * r(), win: r() < .4 ? [1, .85, .6] : [.85, .95, 1] });
        bld(cx, cz, cw - 3, cd - 3, h, S, r, { skin: r() < .5 ? SKINS.bands : SKINS.grid, roof: false });
        if (r() < .5) { prop('box', cx, h + .3, cz, (cw - 5) * .7, .6, (cd - 5) * .7, [.03, .1, .05]); glow(cx, h + .7, cz, .3, .3, .3, [.8, 1, .6]); }
        else bld(cx, cz, (cw - 3) * .5, (cd - 3) * .5, 4 + r() * 6, S, r, { y0: h });
        if (r() < .45) sign(cx, cz, cw - 3, cd - 3, h, st, r, dim(pick(r, pal(st)), .7));
      }
      const fr = H.frame()?.front ?? { x: 0, z: 1 };
      shopfront(x, z, W - 3, D - 3, fr, st, r, 3);
      for (let k = -1; k <= 1; k++) palm(x + fr.x * (W / 2 + 1) - fr.z * k * W * .4, z + fr.z * (D / 2 + 1) + fr.x * k * D * .4, 9 + r() * 4, r);
      for (let k = 0; k < 2; k++) {
        const y = 6 + r() * 6, a = [x - W / 2 + 1, y, z + (r() - .5) * D * .5], e = [x + W / 2 - 1, y - 1, z + (r() - .5) * D * .5];
        if (nx > 1) stringLights(a, e, .8, 8, WARM);
      }
    },

    // Worker slab: a plain low-income block for resort staff, galleries on the long faces and a lit kiosk below.

    man_worker(x, z, s, st, b, r) {
      const [W, D] = dims(s), along = W >= D, w = along ? W - 2 : Math.min(W - 2, 14), d = along ? Math.min(D - 2, 14) : D - 2, h = (30 + r() * 30) * Math.min(b, 1.2);
      const S = look(st, { base: [.12, .12, .12], win: [1, .82, .55], lit: .32, grime: .4 });
      bld(x, z, w, d, h, S, r, { skin: SKINS.grid, roof: false });
      for (const side of [-1, 1]) {
        const gx = along ? x : x + side * (w / 2 + .7), gz = along ? z + side * (d / 2 + .7) : z;
        for (let y = 3.6; y < h - 1; y += 7.2) glow(gx, y, gz, along ? w * .9 : .1, .12, along ? .1 : d * .9, [.5, .4, .25]);
        bld(gx, gz, along ? w * .3 : 1.4, along ? 1.4 : d * .3, h - 3, look(S, { lit: .5 }), r, { y0: 3, skin: SKINS.bands, roof: false });
      }
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) {
        const px = x + (r() - .5) * (w - 4), pz = z + (r() - .5) * (d - 4);
        prop('cyl', px, h + 1.5, pz, 2.4, 3, 2.4, [.1, .1, .12]);
      }
      if (r() < .5) { prop('cyl', x, h + 6, z, .3, 12, .3, [.2, .2, .2]); beacon(x, h + 12.3, z, r); }
      const fr = H.frame()?.front ?? { x: 0, z: 1 };
      shopfront(x, z, w, d, fr, st, r, 1);
    },

    // Secure warehouse lot: a clean shed with roof-edge light, lit loading bays and floodlit yard.

    man_shed(x, z, s, st, b, r) {
      const [W, D] = dims(s), w = W - 4, d = D - 6, h = 10 + r() * 10;
      const S = look(st, { base: [.16, .17, .18], lit: .08, grime: .3 });
      bld(x, z, w, d, h, S, r, { skin: SKINS.sparse, roof: false });
      for (const [sx, sz, lw, ld] of [[0, 1, w, 0], [0, -1, w, 0], [1, 0, 0, d], [-1, 0, 0, d]])
        glow(x + sx * (w / 2 + .1), h - .4, z + sz * (d / 2 + .1), lw ? lw : .15, .25, ld ? ld : .15, [.35, .55, .7]);
      const fr = H.frame()?.front ?? { x: 0, z: 1 }, span = fr.x ? d : w, out = (fr.x ? w : d) / 2 + .2;
      for (let k = 0, n = Math.max(2, Math.floor(span / 8)); k < n; k++) {
        const along = ((k + .5) / n - .5) * span * .85;
        glow(x + fr.x * out - fr.z * along, 2.4, z + fr.z * out + fr.x * along, fr.x ? .2 : 3.6, 4, fr.x ? 3.6 : .2, k % 2 ? [.9, .9, .8] : [.3, .3, .3]);
      }
      for (const sx of [-1, 1]) {
        const px = x + sx * (W / 2 - 1), pz = z + (D / 2 - 1) * (fr.z || 1);
        prop('cyl', px, 6, pz, .3, 12, .3, [.2, .2, .2]);
        glow(px, 12.2, pz, 1.2, .4, 1.2, [1.2, 1.2, 1.1]);
        pool(px, pz, 10, [.1, .1, .1]);
      }
      if (r() < .6) prop('box', x + fr.x * (out + 4), 1.6, z + fr.z * (out + 4), fr.x ? 3 : 10, 3, fr.x ? 10 : 3, [.25, .25, .27]);
      textSign(pick(r, ['MANTA FREIGHT', 'PORT SECURE', 'PACIFIC LOGISTICS', 'TIDELINE', 'BLUE HARBOR']), x + fr.x * (out + .1), h - 2.5, z + fr.z * (out + .1), Math.min(span * .5, 16), 3.2, ryOf(fr), [.5, .9, 1.2]);
    },

    // Dock: a quay with a container crane over the water, boxes stacked on the apron and work lights.

    man_dock(x, z, s, st, b, r) {
      const [W, D] = dims(s, 80), sv = sea(x, z), f = snap(sv), e = f.x ? W / 2 : D / 2;
      prop('box', x, .1, z, W, .2, D, [.08, .08, .09]);
      const qx = x + f.x * (e - 2), qz = z + f.z * (e - 2), span = (f.x ? D : W) * .8;
      prop('box', qx + f.x * Math.min(20, sv.d) / 2, .4, qz + f.z * Math.min(20, sv.d) / 2, f.x ? Math.min(20, sv.d) + 4 : span, .8, f.x ? span : Math.min(20, sv.d) + 4, [.12, .12, .12]);
      const C = [[.5, .15, .08], [.08, .2, .4], [.4, .35, .08], [.1, .3, .2], [.3, .3, .32]];
      for (let k = 6 + Math.floor(r() * 8); k > 0; k--) {
        const u = (r() - .5) * span, v = -(r() * (e - 6)), ht = 1 + Math.floor(r() * 3);
        const px = x + f.x * v - f.z * u, pz = z + f.z * v + f.x * u;
        for (let q = 0; q < ht; q++) prop('box', px, 1.3 + q * 2.6, pz, f.x ? 2.4 : 6, 2.5, f.x ? 6 : 2.4, pick(r, C));
      }
      const cu = (r() - .5) * span * .5, ch = 30 + r() * 15, reach = Math.min(40, sv.d + 25);
      for (const lu of [-6, 6]) for (const lv of [-4, 4]) {
        const px = qx + f.x * lv - f.z * (cu + lu), pz = qz + f.z * lv + f.x * (cu + lu);
        beam([px, 0, pz], [px, ch, pz], 1, [.45, .25, .08]);
      }
      for (const lu of [-6, 6]) {
        const a = [qx - f.x * 10 - f.z * (cu + lu), ch, qz - f.z * 10 + f.x * (cu + lu)], c = [qx + f.x * reach - f.z * (cu + lu), ch, qz + f.z * reach + f.x * (cu + lu)];
        beam(a, c, 1.2, [.45, .25, .08]);
        glow(c[0], ch - 1, c[2], .8, .8, .8, [1.8, .2, .1]);
      }
      glow(qx + f.x * reach * .5 - f.z * cu, ch - 3, qz + f.z * reach * .5 + f.x * cu, 2, 1.5, 2, [1.2, 1.1, .8]);
      pool(qx + f.x * 8, qz + f.z * 8, 22, [.12, .1, .07]);
      for (let k = 0; k < 2; k++) {
        const u = (k - .5) * span * .7, px = qx - f.z * u, pz = qz + f.x * u;
        prop('cyl', px, 8, pz, .4, 16, .4, [.2, .2, .2]);
        glow(px, 16.3, pz, 1.6, .5, 1.6, [1.3, 1.1, .8]);
      }
      if (r() < .6) yacht(qx + f.x * 18 - f.z * span * .3, qz + f.z * 18 + f.x * span * .3, 14 + r() * 10, ryOf(f) + Math.PI / 2, r);
    },

    // Party Row marina: a pier runs out over the surf with finger piers, moored yachts and string lights.

    man_yacht(x, z, s, st, b, r) {
      const sv = sea(x, z);
      if (sv.d > 70) return raw.man_beachclub(x, z, s, st, b, r);
      const [W, D] = dims(s), f = snap(sv), e = f.x ? W / 2 : D / 2, L = Math.min(90, sv.d + 50), P = pal(st);
      prop('box', x, .1, z, W, .2, D, [.2, .2, .21]);
      const along = (u, v) => [x + f.x * v - f.z * u, z + f.z * v + f.x * u];
      const [mx, mz] = along(0, e - 2 + L / 2);
      prop('box', mx, .3, mz, f.x ? L : 4, .5, f.x ? 4 : L, [.18, .15, .12]);
      const [ax, az] = along(0, e - 2), [bx, bz] = along(0, e - 2 + L);
      stringLights([ax, 4, az], [bx, 4, bz], .5, Math.floor(L / 4), WARM);
      for (let v = e + 14; v < e + L - 4; v += 14) for (const side of [-1, 1]) {
        const [fx, fz] = along(side * 9, v);
        prop('box', fx, .3, fz, f.x ? 2 : 16, .4, f.x ? 16 : 2, [.18, .15, .12]);
        if (r() < .85) { const [yx, yz] = along(side * 9, v + 6); yacht(yx, yz, 12 + r() * 14, ryOf({ x: f.z, z: f.x }) + Math.PI / 2, r); }
        glow(fx, 1.4, fz, .3, .3, .3, dim(pick(r, P), .9));
      }
      const [kx, kz] = along(0, e - 8);
      bld(kx, kz, 10, 8, 4.5, look(st, { lit: .7, base: [.25, .25, .26] }), r, { glow: 1, skin: SKINS.curtain, roof: false });
      textSign('PARTY ROW', kx, 6.4, kz, 12, 3, ryOf(f), dim(pick(r, P), 1.2));
      pool(mx, mz, L * .45, [.05, .06, .08]);
    },
  };

  // In the city each lot kit gives way to the kit of the same rank in its shore band.

  const RANK = { man_beachclub: 0, man_holopark: 0, man_yacht: 0, man_shed: 0, man_midmaze: 1, man_skidome: 1, man_worker: 1, man_dock: 1, man_sculpt: 2, man_officewall: 2 };
  const BANDS = {
    strip: [['man_beachclub', 'man_beachclub', 'man_holopark', 'man_yacht'], ['man_beachclub', 'man_skidome', 'man_sculpt', 'man_holopark'], ['man_sculpt', 'man_sculpt', 'man_skidome']],
    wall: [['man_holopark', 'man_midmaze'], ['man_officewall', 'man_midmaze'], ['man_officewall']],
    business: [['man_midmaze', 'man_midmaze', 'man_holopark'], ['man_midmaze', 'man_midmaze', 'man_officewall'], ['man_officewall', 'man_midmaze']],
    warehouse: [['man_shed', 'man_shed', 'man_worker'], ['man_worker', 'man_shed'], ['man_worker', 'man_worker', 'man_shed']],
    docks: [['man_dock', 'man_yacht'], ['man_dock', 'man_shed'], ['man_dock', 'man_worker']],
  };
  const out = {};
  for (const [name, kit] of Object.entries(raw)) out[name] = (x, z, s, st, b, r) => {
    if (!H.frame()) return kit(x, z, s, st, b, r);
    const [wx, wz] = toW(x, z), k = pick(r, BANDS[band(wx, wz)][RANK[name]]);
    return raw[k](x, z, s, st, b, r);
  };
  M = { raw, sculpture, palm, yacht, lasers, sea, snap, shore, toW, toL, band, pal, dim, look, pick, ryOf, shopfront, PEARL, SAND, WARM, WHITE, POOLC };
  return out;
}

export const tiers = {
  manta: {
    0: ['man_beachclub', 'man_holopark', 'man_yacht', 'man_shed'],
    1: ['man_beachclub', 'man_holopark', 'man_midmaze', 'man_skidome', 'man_worker', 'man_dock'],
    2: ['man_midmaze', 'man_skidome', 'man_worker', 'man_sculpt', 'man_officewall'],
    3: ['man_sculpt', 'man_officewall'],
  },
};

export function blocks(H) {
  const { GLOWS, SKINS, beacon, beam, bld, glow, helipad, lerp, pool, prop, put, stringLights, textSign } = H;
  const { sculpture, palm, sea, snap, toW, band, pal, dim, look, pick, ryOf, lasers, raw, SAND, WARM, POOLC } = M;

  // Strip resort: two or three sculpture hotels on a pool podium, cabanas, and a beach plaza strung with lights.

  function resort(x, z, w, d, st, r) {
    const sv = sea(x, z), f = snap(sv), P = pal(st);
    prop('box', x, .1, z, w, .2, d, SAND);
    bld(x - f.x * w * .1, z - f.z * d * .1, w * .8, d * .7, 6, look(st, { base: [.24, .24, .26], lit: .5 }), r, { skin: SKINS.bands, roof: false, glow: .6 });
    const n = 2 + Math.floor(r() * 2), along = f.x ? d : w;
    for (let k = 0; k < n; k++) {
      const u = ((k + .5) / n - .5) * along * .8, v = -.25 * (f.x ? w : d), tx = x + f.x * v - f.z * u, tz = z + f.z * v + f.x * u;
      const { top, accent } = sculpture(tx, tz, along / n * .75, along / n * .75, lerp(60, 150, r()) * (k === 1 ? 1.2 : 1), st, r);
      textSign(pick(r, HOTELS), tx + f.x * along / n * .4, top * .85, tz + f.z * along / n * .4, along / n * .6, along / n * .15, ryOf(f), dim(accent, 1.1));
    }
    for (let k = 0; k < 3; k++) {
      const u = (k - 1) * along * .28, px = x + f.x * (f.x ? w : d) * .12 - f.z * u, pz = z + f.z * (f.x ? w : d) * .12 + f.x * u;
      glow(px, 6.2, pz, f.x ? 8 : 14, .12, f.x ? 14 : 8, dim(POOLC, .4));
    }
    const ex = x + f.x * w * .42, ez = z + f.z * d * .42;
    for (let k = -3; k <= 3; k++) {
      const px = ex - f.z * k * along * .13, pz = ez + f.x * k * along * .13;
      palm(px, pz, 10 + r() * 6, r);
      prop('cone', px + f.x * 6, 2.5, pz + f.z * 6, 3, .6, 3, dim(pick(r, P), .25));
    }
    for (let k = -1; k <= 1; k++) {
      const a = [ex - f.z * k * along * .3, 7, ez + f.x * k * along * .3], reach = Math.min(60, sv.d + 15);
      stringLights(a, [a[0] + f.x * reach, 3, a[2] + f.z * reach], 1.2, 10, k ? WARM : dim(pick(r, P), .8));
    }
    lasers(x, 8, z, sv, 4, st, r);
    pool(ex, ez, along * .5, [.12, .12, .11]);
  }

  // Secure warehouse: big clean sheds on a deck several storeys up, a lit fence line, gatehouse and roof pads.

  function secure(x, z, w, d, st, r) {
    const dk = 9 + r() * 4, S = look(st, { base: [.14, .15, .16], lit: .1, grime: .35, win: [.8, .9, 1] });
    bld(x, z, w, d, dk, look(S, { lit: .25 }), r, { skin: SKINS.bands, roof: false });
    for (const [sx, sz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      glow(x + sx * (w / 2 + .1), dk + 1.2, z + sz * (d / 2 + .1), sz ? w : .15, .15, sx ? d : .15, [.4, .7, .9]);
      prop('box', x + sx * (w / 2 - .2), dk + 1.2, z + sz * (d / 2 - .2), sz ? w : .2, 2.4, sx ? d : .2, [.2, .21, .23]);
    }
    const n = 1 + Math.floor(r() * 3), along = w >= d, L = (along ? w : d) - 8, S2 = (along ? d : w) - 14;
    for (let k = 0; k < n; k++) {
      const u = ((k + .5) / n - .5) * L, sl = L / n - 6, h = 12 + r() * 16, [px, pz] = along ? [x + u, z] : [x, z + u];
      bld(px, pz, along ? sl : S2, along ? S2 : sl, h, S, r, { y0: dk, skin: SKINS.sparse, roof: false });
      glow(px, dk + h + .1, pz, (along ? sl : S2) * .96, .15, (along ? S2 : sl) * .96, [.06, .08, .1]);
      if (r() < .6) helipad(px, pz, Math.min(sl, S2) * .4, dk + h, r);
      for (let q = 0; q < 3; q++) prop('box', px + (r() - .5) * (along ? sl : S2) * .8, dk + h + 1, pz + (r() - .5) * (along ? S2 : sl) * .8, 3, 2, 3, [.2, .2, .22]);
      for (const side of [-1, 1]) for (let q = 0; q < 3; q++) {
        const o = ((q + .5) / 3 - .5) * sl, bx = along ? px + o : px + side * (S2 / 2 + .1), bz = along ? pz + side * (S2 / 2 + .1) : pz + o;
        glow(bx, dk + 2.4, bz, along ? 3.5 : .2, 4, along ? .2 : 3.5, q % 2 ? [.8, .85, .85] : [.25, .25, .25]);
      }
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const px = x + sx * (w / 2 - 2), pz = z + sz * (d / 2 - 2);
      prop('cyl', px, dk + 9, pz, .4, 18, .4, [.2, .2, .2]);
      glow(px, dk + 18.3, pz, 2, .6, 2, [1.3, 1.3, 1.2]);
      pool(px - sx * 10, pz - sz * 10, 18, [.1, .11, .12]);
    }
    const fr = H.frame()?.front ?? { x: 0, z: 1 }, gx = x + fr.x * (w / 2 + 3), gz = z + fr.z * (d / 2 + 3);
    bld(gx, gz, 5, 5, 3.5, look(S, { lit: .8 }), r, { skin: SKINS.curtain, roof: false, glow: 1 });
    beam([gx - fr.z * 4, 2.4, gz + fr.x * 4], [gx - fr.z * 14, 2.4, gz + fr.x * 14], .3, [1.6, .4, .1], 'glow');
    textSign(pick(r, ['I/O SECURE DATA', 'MANTA PORT 2', 'HB LOGISTICS', 'PELE', 'SECURE STORAGE']), x + fr.x * (w / 2 + .3), dk - 3, z + fr.z * (d / 2 + .3), Math.min(w, d) * .4, 4, ryOf(fr), [.6, 1, 1.3]);
    for (let k = 0; k < 4; k++) prop('box', x + (r() - .5) * w * .7, dk + 1.6, z + fr.z * (d / 2 - 6) + fr.x * (r() - .5) * d * .6, fr.x ? 2.6 : 9, 3, fr.x ? 9 : 2.6, [.3, .3, .32]);
  }

  // The Racetracks: a junkyard turned into a floodlit race and obstacle course with ramps and scrap stands.

  function racetrack(x, z, w, d, st, r) {
    const P = pal(st), ax = w * .42, az = d * .38, n = 28;
    prop('box', x, .1, z, w, .2, d, [.07, .065, .06]);
    for (let k = 0; k < n; k++) {
      const a0 = k / n * 6.283, a1 = (k + 1) / n * 6.283;
      for (const s of [1, .72]) beam([x + Math.cos(a0) * ax * s, .5, z + Math.sin(a0) * az * s], [x + Math.cos(a1) * ax * s, .5, z + Math.sin(a1) * az * s], .35, k % 4 < 2 ? dim(P[0], .7) : [1, 1, 1], 'glow');
    }
    for (let k = 0; k < 5; k++) {
      const a = r() * 6.283, s = .86, px = x + Math.cos(a) * ax * s, pz = z + Math.sin(a) * az * s, ry = -a;
      prop('box', px, 1.8, pz, 6, .5, 9, [.25, .2, .15], ry, -.35);
    }
    const JUNK = [[.3, .1, .06], [.15, .15, .17], [.25, .2, .1], [.08, .15, .25]];
    for (let k = 0; k < 40; k++) {
      const a = r() * 6.283, s = r() < .5 ? .3 + r() * .25 : 1.08 + r() * .1, px = x + Math.cos(a) * ax * s, pz = z + Math.sin(a) * az * s;
      for (let q = Math.floor(r() * 3); q >= 0; q--) prop('box', px, .8 + q * 1.4, pz, 2, 1.3, 4.2, pick(r, JUNK), r() * 6.3, (r() - .5) * .3);
    }
    for (const sx of [-1, 1]) {
      const px = x + sx * w * .47;
      for (let q = 0; q < 4; q++) prop('box', px, 1 + q * 2, z, 3 + q * 2.5, .5, d * .5, [.18, .16, .14]);
      put(H.PROPS.lattice, px, 8, z, 6, 16, d * .5);
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]]) {
      const px = x + sx * w * .45, pz = z + sz * d * .45;
      prop('cyl', px, 11, pz, .5, 22, .5, [.2, .2, .2]);
      glow(px, 22.4, pz, 2.6, .8, 1, [1.4, 1.3, 1.1]);
      pool(x + sx * w * .3, z + sz * d * .3, 20, [.11, .1, .09]);
    }
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1, cx = x + Math.cos(a) * ax * .86, cz = z + Math.sin(a) * az * .86;
      glow(cx, .9, cz, 1.8, .8, 3.6, dim(pick(r, P), .8));
      glow(cx, .9, cz + 1.9, .4, .3, .2, [1.8, .3, .2]);
    }
    textSign('THE RACETRACKS', x, 14, z - d * .47, Math.min(w * .5, 40), 8, 0, dim(P[1], 1.1));
    beacon(x, 23, z, r);
  }

  // Each block builds the kit of its shore band. The showcase shows each kit as it is.

  const pickBand = (me, x, z, r) => {
    if (!H.frame()) return me;
    const [wx, wz] = toW(x, z), bd = band(wx, wz);
    if (bd === 'strip' || bd === 'wall') return resort;
    if (bd === 'docks') return secure;
    return bd === 'warehouse' && r() < .3 ? racetrack : r() < .6 ? secure : resort;
  };
  const wrap = fn => (x, z, w, d, st, r) => pickBand(fn, x, z, r)(x, z, w, d, st, r);
  return {
    man_resort: { zone: 'manta', build: wrap(resort) },
    man_secure: { zone: 'manta', build: wrap(secure) },
    man_racetrack: { zone: 'manta', build: wrap(racetrack) },
  };
}

export function landmarks(H) {
  const { THREE, GLOWS, SKINS, beacon, beam, bld, glow, helipad, lerp, pool, prop, put, puff, stringLights, textSign } = H;
  const { palm, shore, toW, toL, pal, dim, look, pick, ryOf, yacht, lasers, sea, snap, raw } = M;
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); H.decor.add(m); return m; };
  const now = () => performance.now() / 1000;
  const SURF = {};

  // Additive text plane for decor signs that stay visible from the overview. A newline starts a second line; h is per line.

  const logo = (text, color, w, h) => {
    const lines = text.split('\n'), n = lines.length;
    const tex = H.canvasTexture(1024, 192 * n, (g, W) => {
      g.font = 'bold 120px "Avenir Next Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      lines.forEach((t, i) => {
        g.shadowColor = color; g.shadowBlur = 24; g.fillStyle = color; g.fillText(t, W / 2, 96 + i * 192);
        g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(t, W / 2, 96 + i * 192);
      });
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h * n), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  };

  // Local point at the shore nearest a world point, pushed seaward by out metres, plus the local seaward unit vector.

  const seaward = (wx, wz, out) => {
    const c = shore(wx, wz), [sx, sz] = toL(c.x, c.z), [px, pz] = toL(wx, wz), L = Math.hypot(sx - px, sz - pz) || 1;
    const u = (sx - px) / L, v = (sz - pz) / L;
    return { x: sx + u * out, z: sz + v * out, u, v };
  };

  return {
    // Haas Arcology: a kilometre-tall pearl spire on Punta San Lorenzo, its podium walls standing in the surf.
    // Housing fills the low terraces, labs and the Haas Academy the shaft, the executives the glass apex.

    haas: {
      at: [449, 1160], reach: 600, minSide: 40, label: 'Haas Arcology · Haas-Bioroid HQ', labelY: 1080, scaleY: .6,
      build(x, z, w, d, st, r) {
        const [wx, wz] = toW(0, 0), C = seaward(wx, wz, 45), cx = C.x, cz = C.z;
        const pearl = new THREE.MeshStandardMaterial({ color: new THREE.Color(.42, .43, .46), emissive: new THREE.Color(.035, .038, .045), metalness: .35, roughness: .3 });
        const lip = [[0, -9], [178, -9], [172, 2], [154, 14], [134, 24], [0, 24]].map(([a, b]) => new THREE.Vector2(a, b));
        add(new THREE.LatheGeometry(lip, 64), pearl, cx, 0, cz);

        // Housing terraces with garden rims.

        const HOUSE = look(st, { base: [.3, .31, .34], win: [1, .86, .62], lit: .3, grime: .05 });
        let y = 24;
        for (const [dia, th] of [[250, 20], [212, 20], [176, 20], [146, 18]]) {
          bld(cx, cz, dia, dia, th, HOUSE, r, { y0: y, shape: 'oct', skin: SKINS.bands, roof: false, glow: .15 });
          put(GLOWS.ring, cx, y + th + .3, cz, dia * 1.01, dia * 1.01, dia * 1.01, 0, 0, [.25, .45, .3]);
          y += th;
        }

        // The shaft: a core and three lobes taper through fourteen tiers; joints carry halo rings, lobes carry light strips.

        const LAB = look(st, { base: [.34, .35, .38], win: [.8, .93, 1], lit: .55, grime: .03 }), n = 14, th = 56, y0 = y, a0 = r() * 6.28;
        const env = [];
        for (let k = 0; k < n; k++) {
          const t = k / (n - 1), yy = y0 + k * th, lr = lerp(48, 11, t ** .85), off = lerp(46, 9, t), cr = lerp(42, 10, t);
          const S = look(LAB, { lit: k > 9 ? .42 : k > 4 ? .3 : .22 });
          bld(cx, cz, cr * 2, cr * 2, th - 2, S, r, { y0: yy, shape: 'cyl', skin: k > 9 ? SKINS.curtain : SKINS.grid, roof: false, glow: .12 });
          for (let q = 0; q < 3; q++) {
            const a = a0 + q * 2.094, lx = cx + Math.cos(a) * off, lz = cz + Math.sin(a) * off;
            bld(lx, lz, lr * 2, lr * 2, th - 2, S, r, { y0: yy, shape: 'cyl', skin: k % 3 === 2 ? SKINS.curtain : SKINS.fins, roof: false, glow: .18 });
            if (k % 2 === 0) glow(cx + Math.cos(a) * (off + lr + .2), yy + th / 2, cz + Math.sin(a) * (off + lr + .2), 1, th - 8, 1, [.35, .5, .7]);
          }
          const R = off + lr + 2;
          if (k % 2) put(GLOWS.ring, cx, yy, cz, R * 2, R * 2, R * 2, 0, 0, k % 4 === 3 ? [.4, .9, 1.2] : [.18, .22, .27]);
          env.push([yy, R]);
        }
        const yTop = y0 + n * th;

        // Three buttress fins between the lobes, edged in light.

        for (let q = 0; q < 3; q++) {
          const a = a0 + q * 2.094 + 1.047, shp = new THREE.Shape();
          shp.moveTo(0, 0); shp.lineTo(200, -9);
          for (const [yy, R] of [[24, 175], ...env.map(([yy, R]) => [yy, R * .92 + 6])]) shp.lineTo(R, yy);
          shp.lineTo(0, yTop);
          const geo = new THREE.ExtrudeGeometry(shp, { depth: 3, bevelEnabled: false }).translate(0, 0, -1.5);
          const m = add(geo, pearl, cx, 0, cz);
          m.rotation.y = -a;
          let prev = [cx + Math.cos(a) * 175, 24, cz + Math.sin(a) * 175];
          for (const [yy, R] of env) {
            const p = [cx + Math.cos(a) * (R * .92 + 6.3), yy, cz + Math.sin(a) * (R * .92 + 6.3)];
            beam(prev, p, .7, [.7, .9, 1.2], 'glow');
            prev = p;
          }
        }

        // Exec apex: a glass crown, a spire and halo rings.

        const glass = new THREE.MeshBasicMaterial({ color: new THREE.Color(.28, .5, .66) });
        add(new THREE.CylinderGeometry(5, 22, 70, 24, 1).translate(0, 35, 0), glass, cx, yTop, cz);
        add(new THREE.CylinderGeometry(.4, 4, 110, 8).translate(0, 55, 0), pearl, cx, yTop + 70, cz);
        for (const [yy, R] of [[yTop + 10, 30], [yTop + 40, 20], [yTop + 70, 12]]) put(GLOWS.ring, cx, yy, cz, R * 2, R * 2, R * 2, 0, 0, [.8, 1.3, 1.6]);
        put(GLOWS.sphere, cx, yTop + 182, cz, 5, 5, 5, 0, 0, [2, 2.1, 2.3]);
        beacon(cx, yTop + 140, cz, r);
        for (let q = 0; q < 3; q++) {
          const a = a0 + q * 2.094, R = env[11][1] + 4;
          beam([cx + Math.cos(a) * R * .3, yTop - 120, cz + Math.sin(a) * R * .3], [cx + Math.cos(a) * (R + 30), yTop - 120, cz + Math.sin(a) * (R + 30)], 3, [.3, .31, .34]);
          helipad(cx + Math.cos(a) * (R + 30), cz + Math.sin(a) * (R + 30), 18, yTop - 121, r);
        }

        // Logos on the lobes at the Academy level, facing out, in two lines so they fit the lobe.
        // The camera looks at the lobe that faces the land.

        let face = null, best = -2;
        for (let q = 0; q < 3; q++) {
          const a = a0 + q * 2.094, k = 7, [yy, R] = env[k], m = logo('HAAS\nBIOROID', '#bfe6ff', 140, 26);
          m.position.set(cx + Math.cos(a) * (R + 1), yy + th / 2, cz + Math.sin(a) * (R + 1));
          m.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
          H.decor.add(m);
          const dot = -Math.cos(a) * C.u - Math.sin(a) * C.v;
          if (dot > best) { best = dot; face = [Math.cos(a), Math.sin(a)]; }
        }

        // Surf at the walls, landing pads on the podium and a lit quay on the land side.
        // The surf sits just above the undercity cut at y −0.5, so the undercity view hides it.

        for (const [R, c] of [[182, .28], [196, .14], [214, .07]]) put(GLOWS.ring, cx, -.3, cz, R * 2, 6, R * 2, 0, 0, [c, c * 1.1, c * 1.2]);
        for (let q = 0; q < 3; q++) {
          const a = a0 + q * 2.094 + 1.047;
          helipad(cx + Math.cos(a) * 60, cz + Math.sin(a) * 60, 16, y0, r);
        }
        for (let k = 0; k < 10; k++) {
          const a = Math.atan2(-C.v, -C.u) + (k - 4.5) * .12;
          glow(cx + Math.cos(a) * 180, 1.5, cz + Math.sin(a) * 180, 1.2, 3, 1.2, [1.2, 1.25, 1.3]);
        }
        for (let k = 0; k < 4; k++) yacht(cx + C.u * 230 + C.v * (k - 1.5) * 40, cz + C.v * 230 - C.u * (k - 1.5) * 40, 20 + r() * 12, Math.atan2(C.u, C.v), r);
        pool(cx - C.u * 150, cz - C.v * 150, 80, [.08, .09, .1]);
        return { face };
      },
    },

    // Al-Ghym: a sky-blue hotel with white trim. Its floors turn slowly, and lit rooms slide up and down the core.

    alghym: {
      at: [345, 880], reach: 400, minSide: 40, label: 'Al-Ghym', labelY: 160,
      build(x, z, w, d, st, r) {
        const S = look(st, { base: [.15, .3, .42], win: [.85, .95, 1], lit: .6 });
        bld(0, 0, Math.min(w, 56), Math.min(d, 44), 9, S, r, { skin: SKINS.curtain, glow: 1, roof: false });
        bld(0, 0, 11, 11, 140, look(S, { base: [.4, .42, .45], lit: .3 }), r, { shape: 'cyl', skin: SKINS.bands, roof: false });
        const facade = H.canvasTexture(256, 64, (g, W, Hh) => {
          g.fillStyle = '#3d8fd0'; g.fillRect(0, 0, W, Hh);
          for (let i = 0; i < 16; i++) { g.fillStyle = (i * 7) % 5 ? '#e8f4ff' : '#ffd9a0'; g.fillRect(i * 16 + 3, 16, 10, 34); }
        });
        facade.wrapS = facade.wrapT = THREE.RepeatWrapping; facade.repeat.set(1 / 16, 1 / 3.4);
        const blue = new THREE.MeshBasicMaterial({ map: facade, color: new THREE.Color(.36, .38, .42) });
        const trim = new THREE.MeshBasicMaterial({ color: new THREE.Color(.55, .58, .62) });
        const rounded = (W, D, rad) => {
          const s = new THREE.Shape(), x0 = -W / 2, z0 = -D / 2;
          s.moveTo(x0 + rad, z0); s.lineTo(-x0 - rad, z0); s.quadraticCurveTo(-x0, z0, -x0, z0 + rad);
          s.lineTo(-x0, -z0 - rad); s.quadraticCurveTo(-x0, -z0, -x0 - rad, -z0); s.lineTo(x0 + rad, -z0);
          s.quadraticCurveTo(x0, -z0, x0, -z0 - rad); s.lineTo(x0, z0 + rad); s.quadraticCurveTo(x0, z0, x0 + rad, z0);
          return s;
        };
        const FL = 3.8, N = 32, G = 8, base = 12;
        for (let g = 0; g < G; g++) {
          const fl = [], tr = [];
          for (let k = g * N / G; k < (g + 1) * N / G; k++) {
            const sc = 1 - .3 * Math.abs(k / N - .55), a = k * .11, yy = base + k * FL;
            fl.push(new THREE.ExtrudeGeometry(rounded(32 * sc, 19 * sc, 6 * sc), { depth: FL - .5, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2).rotateY(a).translate(0, yy, 0));
            tr.push(new THREE.ExtrudeGeometry(rounded(33.4 * sc, 20.4 * sc, 6.6 * sc), { depth: .45, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2).rotateY(a).translate(0, yy + FL - .5, 0));
          }
          const grp = new THREE.Group(), speed = (g % 2 ? 1 : -1) * (.015 + .006 * g), ph = r() * 6;
          grp.add(new THREE.Mesh(mergeGeometries(fl), blue), new THREE.Mesh(mergeGeometries(tr), trim));
          grp.children[0].onBeforeRender = () => { grp.rotation.y = ph + now() * speed; grp.updateMatrixWorld(true); };
          H.decor.add(grp);
        }
        const roomMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.15, .85) });
        for (let k = 0; k < 4; k++) {
          const a = k * 1.571 + .4, m = add(new THREE.BoxGeometry(4, 3.4, 4), roomMat, Math.cos(a) * 7.6, 0, Math.sin(a) * 7.6), ph = k * 1.7;
          m.onBeforeRender = () => { m.position.y = base + 4 + (Math.sin(now() * .08 + ph) * .5 + .5) * (N * FL - 8); m.updateMatrixWorld(); };
        }
        const top = base + N * FL, sky = [.4, .9, 1.8];
        put(GLOWS.ring, 0, top + 1, 0, 30, 30, 30, 0, 0, sky);
        put(GLOWS.ring, 0, 9.4, 0, 60, 60, 60, 0, 0, dim(sky, .5));
        beacon(0, 141, 0, r);
        for (const f of [{ x: 0, z: 1 }, { x: 0, z: -1 }]) {
          const m = logo('AL-GHYM', '#7fd0ff', 26, 5.5);
          m.position.set(0, top + 6, f.z * 2); m.rotation.y = ryOf(f);
          H.decor.add(m);
        }
        const sv = sea(0, 0), f = snap(sv);
        glow(f.x * w * .35, .25, f.z * d * .35, f.x ? 8 : w * .5, .1, f.x ? d * .5 : 8, [.06, .5, .65]);
        for (let k = -2; k <= 2; k++) palm(f.x * w * .45 - f.z * k * w * .18, f.z * d * .45 + f.x * k * d * .18, 12 + r() * 5, r);
        pool(0, 0, 50, [.04, .1, .16]);

        // The camera looks from the sea side, over the palms.

        return { face: [f.x, f.z] };
      },
    },

    // Anon: a featureless black cube on the Strip, wrapped every night in a different projected holo-set.

    anon: {
      at: [350, 902], reach: 400, minSide: 36, label: 'Anon', labelY: 70, face: [0, 1],
      build(x, z, w, d, st, r) {
        const E = 38, P = pal(st), c1 = pick(r, P), c2 = pick(r, P);
        const css = c => `rgb(${c.map(v => Math.min(255, v * 140) | 0).join(',')})`;
        add(new THREE.BoxGeometry(E, E, E), new THREE.MeshStandardMaterial({ color: 0x050506, metalness: .8, roughness: .25 }), 0, E / 2, 0);
        const style = Math.floor(r() * 3);
        const tex = H.canvasTexture(256, 256, (g, W) => {
          g.clearRect(0, 0, W, W); g.lineWidth = 3;
          for (let i = 0; i < 12; i++) {
            g.strokeStyle = css(i % 2 ? c1 : c2);
            if (style === 0) { g.beginPath(); g.arc(W / 2, W / 2, 10 + i * 10, 0, 6.3); g.stroke(); }
            else if (style === 1) { g.beginPath(); g.moveTo(0, i * 22); g.lineTo(W, i * 22 + 40); g.stroke(); }
            else { g.strokeRect(i * 10, i * 10, W - i * 20, W - i * 20); }
          }
        });
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        const proj = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        const shell = add(new THREE.BoxGeometry(E + .4, E + .4, E + .4), proj, 0, E / 2, 0);
        shell.onBeforeRender = () => { tex.offset.set(0, (now() * .05) % 1); };
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          prop('box', sx * (E / 2 + 10), .6, sz * (E / 2 + 10), 1.4, 1.2, 1.4, [.1, .1, .1]);
          beam([sx * (E / 2 + 10), 1.4, sz * (E / 2 + 10)], [sx * E * .2, E * .6, sz * E * .2], .25, dim(sx * sz > 0 ? c1 : c2, .9), 'glow');
        }
        lasers(0, E + 1, 0, { u: 0, v: 1 }, 5, st, r);
        const fr = { x: 0, z: 1 };
        for (let k = 0; k < 14; k++) glow((r() - .5) * 20, .9, E / 2 + 4 + r() * 8, .5, 1.8, .5, k % 3 ? [.2, .2, .25] : dim(c1, .4));
        stringLights([-12, 3, E / 2 + 3], [12, 3, E / 2 + 3], .2, 10, dim(c2, .7));
        pool(0, 0, 45, dim(c1, .1));
        pool(fr.x, E / 2 + 8, 16, [.12, .12, .14]);
      },
    },

    // Sunken City: an old town sunk below the new ground. The ground opens over it, and terraces of old buildings
    // step down the pit to black seawater 28 m below the street, where drowned blocks stand linked by rope bridges.
    // Stairs, lifts, stalls and pipes line the terraces, and lights hang over the pit.

    sunken: {
      at: [324, 1020], reach: 500, minSide: 56, label: 'Sunken City', labelY: 24,
      build(x, z, w, d, st, r) {
        const RUIN = look(st, { base: [.11, .1, .09], win: [1, .6, .25], lit: .18, grime: .9, w: .2 });
        const P = pal(st), WARM = [1.5, .75, .3], ROPE = [.14, .1, .07], PIPE = [.2, .21, .2];
        const CRETE = [[.1, .1, .09], [.16, .15, .13], [.14, .13, .12], [.12, .11, .1]];
        const s = Math.min(w, d) * .085, RIM = 15, TOP = [0, -7, -14, -21], WET = -28, FLOOR = -32, pw = w - 8 * s, pd = d - 8 * s;

        // Band k runs round the pit from inset k·s to (k + 1)·s. Each side has a centre, a length, an axis and an inward normal.
        // along(q, t, o) is the point t metres along side q, o metres inward from the band centre.
        // The ground hole covers bands 1 to 3, so the inner face of band 0 is the pit wall below the street.

        const sides = k => {
          const ix = w / 2 - (k + .5) * s, iz = d / 2 - (k + .5) * s, Lx = w - 2 * k * s, Lz = d - 2 * (k + 1) * s;
          return [
            { x: 0, z: iz, L: Lx, Li: Lx - 2 * s, ax: 1, nx: 0, nz: -1 },
            { x: 0, z: -iz, L: Lx, Li: Lx - 2 * s, ax: 1, nx: 0, nz: 1 },
            { x: ix, z: 0, L: Lz, Li: Lz, ax: 0, nx: -1, nz: 0 },
            { x: -ix, z: 0, L: Lz, Li: Lz, ax: 0, nx: 1, nz: 0 },
          ];
        };
        const along = (q, t, o = 0) => [q.x + (q.ax ? t : 0) + q.nx * o, q.z + (q.ax ? 0 : t) + q.nz * o];

        // The rim: a ring of old buildings at street level on the lip of the pit.

        for (const q of sides(0)) for (let n = Math.max(1, Math.round(q.L / 14)), i = 0; i < n; i++) {
          const seg = q.L / n, [px, pz] = along(q, (i + .5) * seg - q.L / 2), h = RIM - 1.5 + r() * 4;
          bld(px, pz, q.ax ? seg - .4 : s, q.ax ? s : seg - .4, h, look(RUIN, { lit: .1 + .25 * r() }), r, { skin: SKINS.sparse, roof: false });
        }

        // Each band is solid fill down to the pit floor. Its top is a terrace with a lit lip, and its inner face
        // is the wall down to the next terrace, with old windows and a pipe run. Market stalls stand on the terraces.

        for (let k = 0; k < 4; k++) for (const q of sides(k)) {
          const y = TOP[k], lo = TOP[k + 1] ?? WET, Li = q.Li;
          prop('box', q.x, (y + FLOOR) / 2, q.z, q.ax ? q.L : s, y - FLOOR, q.ax ? s : q.L, CRETE[k]);
          const [lx, lz] = along(q, 0, s / 2);
          glow(lx, y + .05, lz, q.ax ? Li : .25, .1, q.ax ? .25 : Li, [.7, .4, .18]);
          for (const wy of [y - 2.4, y - 5.2]) for (let t = -Li / 2 + 2; t < Li / 2 - 1; t += 3) if (wy > lo + 1 && r() < .45) {
            const [wx, wz] = along(q, t, s / 2 + .06);
            glow(wx, wy, wz, q.ax ? 1.2 : .1, 1.6, q.ax ? .1 : 1.2, r() < .8 ? dim(WARM, .4 + .4 * r()) : [.3, 1, 1.2]);
          }
          const [ax, az] = along(q, -Li / 2, s / 2 + .35), [bx, bz] = along(q, Li / 2, s / 2 + .35);
          beam([ax, y - .7, az], [bx, y - .7, bz], .45, PIPE);
          if (k === 1) beam([ax, y - 1.5, az], [bx, y - 1.5, bz], .3, [.15, .5, .55], 'glow');
          if (!k) continue;
          if (r() < .4) puff(ax, y, az, 1.2 + r(), [.12, .12, .13]);
          for (let t = -Li / 2 + 3; t < Li / 2 - 3; t += 5) if (r() < .45) {
            const [px, pz] = along(q, t, -s * .2);
            prop('box', px, y + .8, pz, 2, 1.6, 2, [.16, .12, .09]);
            glow(px + q.nx * .4, y + 1.75, pz + q.nz * .4, q.ax ? 2.6 : 2.2, .12, q.ax ? 2.2 : 2.6, dim(pick(r, P), .6));
          }
        }

        // A flight of stairs down each wall, from the street to the lowest terrace, with a lamp at the foot.

        for (let k = 1; k < 4; k++) {
          const q = sides(k)[(k * 3) % 4], t0 = (k - 2) * 6 - 3;
          for (let i = 0; i < 8; i++) {
            const [px, pz] = along(q, t0 + i, -s / 2 + 1), h = lerp(TOP[k - 1], TOP[k], (i + .5) / 8);
            prop('box', px, (TOP[k] + h) / 2, pz, q.ax ? 1 : 1.6, h - TOP[k], q.ax ? 1.6 : 1, [.2, .18, .16]);
          }
          const [fx, fz] = along(q, t0 + 9, -s / 2 + 1);
          glow(fx, TOP[k] + 2.4, fz, .4, .4, .4, WARM);
        }

        // Home-built lifts in two corners run from the water up past the street, with a gantry into the rim.

        for (const [ex, ez] of [[1, 1], [-1, -1]]) {
          const lx = ex * (pw / 2 - 1.2), lz = ez * (pd / 2 - 1.2), Ht = 5;
          for (const o of [-1, 1]) prop('cyl', lx + o * .9, (WET + Ht) / 2, lz, .35, Ht - WET, .35, [.25, .24, .22]);
          glow(lx, WET + 2 + r() * (Ht - WET - 6), lz, 1.5, 2.2, 1.5, [1.4, 1.1, .6]);
          beam([lx, Ht, lz], [ex * (w / 2 - s / 2), Ht - 1, ez * (d / 2 - s / 2)], .4, [.2, .19, .17]);
          glow(lx, Ht + .3, lz, .6, .6, .6, [1.8, .3, .2]);
        }

        // Seawater floods the floor.

        add(new THREE.PlaneGeometry(pw + 1, pd + 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x061820, emissive: 0x020a0e, roughness: .15, metalness: .6 }), 0, WET, 0);

        // Drowned blocks stand in the water, with fires on the roofs and jetties out of second-floor windows.

        const ruins = [];
        for (const [fx, fz] of [[-.25, -.28], [.26, -.22], [.24, .27], [-.22, .25]]) {
          const rw = (.18 + .1 * r()) * pw, rd = (.14 + .08 * r()) * pd, px = fx * pw, pz = fz * pd, h = 5 + r() * 6;
          bld(px, pz, rw, rd, h + 3, look(RUIN, { lit: .1 + .3 * r() }), r, { y0: WET - 3, skin: SKINS.sparse, roof: false, ry: (r() - .5) * .3 });
          ruins.push([px, pz, h]);
          if (r() < .7) { glow(px, WET + h + .5, pz, .9, .7, .9, [1.7, .65, .15]); puff(px, WET + h + 4, pz, 1.6 + r(), [.1, .09, .09]); }
          const f = H.FACES[Math.floor(r() * 4)], jx = px + f[0] * (rw / 2 + 1.5), jz = pz + f[1] * (rd / 2 + 1.5);
          prop('box', jx, WET + 3.4, jz, f[0] ? 3 : 1.2, .25, f[0] ? 1.2 : 3, ROPE);
          prop('cyl', jx + f[0] * 1.3, WET + 1.7, jz + f[1] * 1.3, .25, 3.4, .25, ROPE);
        }

        // Rope bridges link the ruins in a loop and run up to the lowest terrace.

        ruins.forEach(([px, pz, h], i) => {
          const [qx, qz, qh] = ruins[(i + 1) % ruins.length], y = WET + Math.min(h, qh) - .5;
          beam([px, y, pz], [qx, y, qz], .2, ROPE);
          stringLights([px, y + 1.4, pz], [qx, y + 1.4, qz], .8, 5, WARM);
          const [bx, bz] = Math.abs(px) / pw > Math.abs(pz) / pd ? [Math.sign(px) * (pw / 2 - .3), pz] : [px, Math.sign(pz) * (pd / 2 - .3)];
          beam([px, WET + Math.min(h - .5, 6), pz], [bx, TOP[3] + .2, bz], .25, ROPE);
        });

        // Pole barges drift between them, and the ferry ties up at a jetty under the stairs.

        for (let k = 0; k < 3; k++) {
          const px = (r() - .5) * pw * .6, pz = (r() - .5) * pd * .15, ry = r() * 6.3;
          prop('box', px, WET + .25, pz, 1.6, .5, 4, ROPE, ry);
          prop('cyl', px, WET + 2, pz, .15, 3.5, .15, ROPE, ry, .3);
          glow(px, WET + .9, pz, .4, .4, .4, [1.5, .7, .25]);
        }
        const fq = sides(3)[1], [jx, jz] = along(fq, 0, s / 2 + 3);
        prop('box', jx, WET + .5, jz, 1.6, .3, 6, ROPE);
        prop('box', jx + 2.2, WET + .4, jz, 2.4, .9, 6, [.2, .2, .22]);
        glow(jx + 2.2, WET + 1.3, jz + 2.4, .5, .5, .5, [1.6, .9, .4]);

        // Strings of lights hang across the pit, one layer from rim to rim and one lower between the middle terraces.

        const across = w < d;
        for (const [y, inset, n] of [[TOP[0] + 1, s / 2, 5], [TOP[2] + 3, 2.5 * s, 3]]) {
          const span = (across ? d : w) - 2 * inset - 3 * s;
          for (let i = 0; i < n; i++) {
            const t = (i / (n - 1) - .5) * span, c = i % 2 ? WARM : dim(pick(r, P), .8);
            const a = across ? [-w / 2 + inset, y, t] : [t, y, -d / 2 + inset], b = across ? [w / 2 - inset, y, t] : [t, y, d / 2 - inset];
            stringLights(a, b, 3, 14, c);
          }
        }

        // The name over the street front.

        const F = H.frame()?.front ?? { x: 0, z: 1 };
        textSign('SUNKEN CITY', F.x * (w / 2 + .4), RIM - 1, F.z * (d / 2 + .4), 18, 3.6, ryOf(F), WARM);
        return { hole: [w - 2 * s, d - 2 * s] };
      },
    },

    // White Beach: two kilometres of artificial silica sand that glows at night. A filter ring of lit floats curves 200 m offshore,
    // tidal harness bars calm the surf inside it, and security lights walk the waterline.

    whitebeach: {
      at: [432, 1056], reach: 400, minSide: 30, label: 'White Beach', labelY: 30,
      build(x, z, w, d, st, r) {
        const [cx, cz] = toW(0, 0), pts = [], P = pal(st), RING = 200, shore = [];
        for (const line of H.CITY.coast ?? []) for (let i = 0; i + 1 < line.length; i++) {
          const [ax, az] = line[i], [bx, bz] = line[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 14);
          for (let k = 0; k < n; k++) {
            const px = lerp(ax, bx, k / n), pz = lerp(az, bz, k / n);
            if (Math.hypot(px - cx, pz - cz) < 330) pts.push([px, pz, bz - az, -(bx - ax)]);
          }
        }
        // The drawn ground is the district outline, and the coast road runs out past it over the water.
        // The beach starts where both end.

        const ground = (wx, wz) => H.CITY.districts.some(({ poly: P }) => {
          let c = false;
          for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > wz) !== (P[j][1] > wz) && wx < (P[j][0] - P[i][0]) * (wz - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
          return c;
        });
        const segs = Object.values(H.CITY.streets).flat().flatMap(l => l.slice(1).map((q, k) => [l[k], q]))
          .filter(([[ax, az]]) => Math.hypot(ax - cx, az - cz) < 600);
        const road = (wx, wz) => segs.some(([[ax, az], [bx, bz]]) => {
          const ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((wx - ax) * ex + (wz - az) * ez) / (ex * ex + ez * ez || 1)));
          return Math.hypot(wx - ax - ex * t, wz - az - ez * t) < 13;
        });
        const SAND = 26;
        pts.forEach(([px, pz, nx, nz], i) => {
          const L = Math.hypot(nx, nz) || 1, [lx, lz] = toL(px, pz), [ox, oz] = toL(px + nx / L, pz + nz / L), u = ox - lx, v = oz - lz;
          // The sea lies on the side of the coast normal with no district ground 120 m out.

          const s = ground(px + nx / L * 120, pz + nz / L * 120) ? -1 : 1, su = u * s, sv = v * s, ry = Math.atan2(su, sv);

          // The beach starts where the ground and the road end. The edges are smoothed after this loop.

          const [w0x, w0z] = toW(lx, lz), [w1x, w1z] = toW(lx + su, lz + sv);
          let edge = 0;
          while (edge < 150 && (ground(px + (w1x - w0x) * edge, pz + (w1z - w0z) * edge) || road(px + (w1x - w0x) * edge, pz + (w1z - w0z) * edge))) edge += 2;
          shore.push([lx, lz, su, sv, ry, edge]);

          // Tidal harness bars halfway out, and the filter ring floats at 200 m.

          if (i % 4 === 2) {
            glow(lx + su * 110, -1.5, lz + sv * 110, 12, .25, .8, [.2, .6, .7], ry);
            prop('cyl', lx + su * 110, -1, lz + sv * 110, .3, 2, .3, [.3, .3, .3]);
          }
          glow(lx + su * RING, -1.2, lz + sv * RING, 2.2, .4, 2.2, [.6, 1.3, 1.5]);
          if (i % 3 === 0) {
            put(GLOWS.ring, lx + su * RING, -1.1, lz + sv * RING, 9, 9, 9, 0, 0, [1.4, 1.6, 1.8]);
            put(GLOWS.sphere, lx + su * RING, -1, lz + sv * RING, 1.4, 1.4, 1.4, 0, 0, [1.6, 1.7, 1.8]);
          }
        });

        // A matte sand ribbon runs out over the water from the smoothed edge, with the crowd on it.
        // Each edge takes the widest of its neighbours, then their average, so the ribbon runs straight.

        // Seaward directions are averaged over close neighbours too, so the ribbons bend round corners instead of folding.

        const near = (i, j) => j >= 0 && j < shore.length && Math.hypot(shore[j][0] - shore[i][0], shore[j][1] - shore[i][1]) < 45;
        const dirs = shore.map((_, i) => {
          let u = 0, v = 0;
          for (let j = i - 2; j <= i + 2; j++) if (near(i, j)) { u += shore[j][2]; v += shore[j][3]; }
          const L = Math.hypot(u, v) || 1;
          return [u / L, v / L];
        });
        shore.forEach((q, i) => { [q[2], q[3]] = dirs[i]; q[4] = Math.atan2(q[2], q[3]); });
        const wide = shore.map((_, i) => Math.max(...shore.slice(Math.max(0, i - 1), i + 2).map(q => q[5])));
        shore.forEach((q, i) => { const n = wide.slice(Math.max(0, i - 2), i + 3); q[5] = n.reduce((a, b) => a + b) / n.length; });
        shore.forEach(([lx, lz, su, sv, , edge], i) => {
          if (r() < .5) for (let k = 0; k < 3; k++) {
            const a = (r() - .5) * 14, b = edge + 3 + r() * (SAND - 6);
            glow(lx + su * b - sv * a, .95, lz + sv * b + su * a, .35, 1.7, .35, dim(pick(r, P), .5));
          }
          if (i % 5 === 0) glow(lx + su * (edge + 2), .95, lz + sv * (edge + 2), .3, 1.8, .3, [.6, .8, 1.7]);
        });

        // Ribbons join neighbouring shore points into quads. They break where the coast leaves the beach
        // or turns too sharply.

        const joined = i => i >= 0 && i + 1 < shore.length && Math.hypot(shore[i + 1][0] - shore[i][0], shore[i + 1][1] - shore[i][1]) <= 30
          && shore[i][2] * shore[i + 1][2] + shore[i][3] * shore[i + 1][3] >= .85;
        const ribbon = rows => {
          const idx = [];
          for (let i = 0; i + 1 < shore.length; i++) {
            if (!joined(i)) continue;
            for (let k = 0; k + 1 < rows; k++) {
              const a = i * rows + k, b = a + rows;
              idx.push(a, b, a + 1, a + 1, b, b + 1);
            }
          }
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(shore.length * rows * 3), 3));
          g.setIndex(idx);
          return g;
        };

        // Sand: the top from the edge outward, then a front face down to the water.

        const sand = ribbon(3), sp = sand.attributes.position.array;
        shore.forEach(([lx, lz, su, sv, , edge], i) => {
          [[edge, .05], [edge + SAND, .05], [edge + SAND, -2.2]].forEach(([o, y], k) => sp.set([lx + su * o, y, lz + sv * o], (i * 3 + k) * 3));
        });
        sand.computeVertexNormals();
        add(sand, new THREE.MeshStandardMaterial({ color: new THREE.Color(.55, .4, .22), roughness: 1, side: THREE.DoubleSide }));
        shore.forEach(q => { q[5] += SAND; });

        // Surf: three foam ribbons a third of a cycle apart, just above the sea. update() rolls each one in from
        // 25 m beyond the sand, widens it as it breaks and fades it at the sand's edge.

        SURF.shore = shore;
        // Foam fades out over the last three points before each ribbon end or break.

        const reach = (i, d) => { let n = 0; while (n < 3 && joined(d > 0 ? i + n : i - n - 1)) n++; return n; };
        const fade = shore.flatMap((_, i) => { const f = Math.min(reach(i, 1), reach(i, -1)) / 3; return [f, f, f, f, f, f]; });
        SURF.waves = [0, 1, 2].map(() => {
          const g = ribbon(2);
          g.setAttribute('color', new THREE.Float32BufferAttribute(fade, 3));
          const m = add(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
          m.frustumCulled = false;
          return m;
        });

        // The name stands at the shore nearest the block and reads from the land. The camera looks from the land side.

        const S = seaward(cx, cz, 0), sx = S.x - S.u * 5, sz = S.z - S.v * 5;
        textSign('WHITE BEACH', sx, 9, sz, 40, 10, Math.atan2(-S.u, -S.v), [2.2, 2.3, 2.4]);
        for (const o of [-1, 1]) prop('cyl', sx - S.v * o * 16, 2.5, sz + S.u * o * 16, .5, 5, .5, [.35, .35, .35]);
        return { face: [-S.u, -S.v] };
      },
      update(t) {
        SURF.waves?.forEach((m, k) => {
          const ph = (t * .11 + k / 3) % 1, out = 25 - ph * 23, th = .4 + 2.2 * ph * ph, p = m.geometry.attributes.position;
          m.material.color.setRGB(.55, .65, .7).multiplyScalar(Math.sin(Math.PI * ph) ** 1.5);
          SURF.shore.forEach(([lx, lz, su, sv, , edge], i) => {
            const o0 = edge + out - th / 2, o1 = edge + out + th / 2;
            p.setXYZ(i * 2, lx + su * o0, -1.75, lz + sv * o0);
            p.setXYZ(i * 2 + 1, lx + su * o1, -1.75, lz + sv * o1);
          });
          p.needsUpdate = true;
        });
      },
    },
  };
}
