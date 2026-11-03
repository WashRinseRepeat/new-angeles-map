// Base de Cayambe housing: stacked shacks, tenement slabs, infill wedges, courtyards, shop-houses and roof villages.
// Kit signature: (x, z, s, st, b, r) in the lot frame. Kits read H.frame() and fall back to an s × s square.

export function kits(H) {
  const { FACES, GLOWS, BDC, SKINS, beacon, bld, glow, lerp, pool, prop, puff, put, sign, stringLights, textSign } = H;

  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const dims = s => { const f = H.frame(); return f ? [Math.min(f.w - 2, 60), Math.min(f.d - 2, 60)] : [s, s]; };

  // Faded paint and window light. Rutherford weight pulls both toward the district style.

  const PAINT = [[.2, .09, .06], [.18, .13, .06], [.06, .12, .12], [.08, .1, .14], [.18, .09, .1], [.12, .11, .1], [.1, .12, .07], [.16, .15, .13]];
  const WIN = [[1.0, .62, .22], [1.0, .62, .22], [1.05, .5, .2], [1.0, .7, .4], [.85, .95, .75], [1.0, .45, .35]];
  const TARP = [[.05, .09, .2], [.2, .07, .04], [.05, .14, .1], [.2, .16, .05], [.1, .1, .1]];
  const CLOTH = [[.3, .08, .06], [.06, .12, .3], [.3, .28, .22], [.25, .2, .05], [.1, .25, .15], [.3, .12, .2]];
  const WARM = [1.4, .7, .25], PALE = [.9, 1.1, .85], SODIUM = [1.3, .6, .15];
  const STORE = [[1.5, .9, .4], [.6, 1.5, .8], [1.4, 1.4, 1.3], [1.6, .3, .2], [.3, 1.1, 1.6], [1.6, 1.2, .2]];
  const CRATE = [[.2, .1, .03], [.08, .14, .04], [.22, .05, .03], [.2, .16, .04]];
  const LIME = [[.3, .27, .22], [.3, .21, .14], [.22, .24, .25], [.3, .22, .2]], TILE = [[.17, .06, .04], [.12, .05, .03], [.08, .08, .08]];
  const TIN = [[.09, .06, .045], [.05, .06, .065], [.11, .05, .035], [.06, .07, .05]], METAL = [.06, .06, .065];
  const CONT = [[.22, .06, .04], [.05, .1, .2], [.06, .14, .08], [.25, .13, .03], [.14, .14, .13], [.24, .2, .04], [.2, .2, .21]];
  const CAR = [[.25, .03, .03], [.04, .06, .12], [.18, .18, .17], [.2, .14, .02], [.03, .03, .03]];
  const GOLD = [1.9, 1.1, .3], CANDLE = [2, 1.1, .35], STEAM = [.16, .15, .14];
  const WORDS = {
    bodega: ['BODEGA', 'TIENDA', 'ABARROTES', '24 HORAS', 'MINIMARKET', 'LICORES', 'FARMACIA', 'CAFÉ'],
    noodles: ['FIDEOS', 'CHIFA', 'RAMEN', 'CALDOS', 'PHO 24H', 'NOODLES', 'SOPAS'],
    taller: ['TALLER', 'MECÁNICA', 'REPUESTOS', 'SOLDADURA', 'LLANTAS', 'MOTOS', 'CYBERWARE'],
  };
  const dim = (c, k) => c.map(v => v * k);
  const paint = (st, r) => { const p = pick(r, PAINT), v = .75 + .5 * r(); return p.map((c, i) => lerp(c, st.base[i], st.w) * v); };
  const look = (st, r, lit) => ({ ...st, base: paint(st, r), win: pick(r, WIN).map((c, i) => lerp(c, st.win[i], st.w)), lit: lit ?? st.lit * (.8 + 1.4 * r()) });

  // Building volume in its own paint and light.

  const vol = (x, z, w, d, h, st, r, o = {}) => bld(x, z, w, d, h, look(st, r, o.lit), r, { skin: r() < .55 ? SKINS.sparse : SKINS.grid, ...o });

  // A straight cable between two points.

  const cable = (a, c, rgb = [.03, .03, .03], dia = .08) => {
    const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2], len = Math.hypot(dx, dy, dz);
    if (len < .5) return;
    prop('cyl', (a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2, dia, len, dia, rgb, Math.atan2(dx, dz), Math.acos(dy / len));
  };

  // Washing line with a few clothes.

  const laundry = (a, c, r) => {
    cable(a, c, [.06, .06, .06], .05);
    for (let k = 1 + Math.floor(r() * 4); k > 0; k--) {
      const t = .15 + r() * .7;
      prop('box', lerp(a[0], c[0], t), lerp(a[1], c[1], t) - .45, lerp(a[2], c[2], t), .7, .8, .7, pick(r, CLOTH), Math.atan2(c[0] - a[0], c[2] - a[2]));
    }
  };

  // Rooftop water tank on legs.

  const tank = (x, y, z, r) => {
    const rad = .9 + r() * .9, c = r() < .5 ? [.03, .05, .1] : [.12, .08, .05];
    prop('box', x, y + .5, z, rad * 1.6, 1, rad * 1.6, [.05, .05, .05]);
    prop('cyl', x, y + 1 + rad, z, rad * 2, rad * 2, rad * 2, c);
    prop('cone', x, y + 1 + rad * 2.25, z, rad * 2.05, rad * .5, rad * 2.05, c);
  };

  // Antenna forest, dishes, a tarp or two and a garden patch on a roof.

  const clutter = (x, z, w, d, y, st, r, n = 3) => {
    const at = m => [x + (r() - .5) * Math.max(0, w - m), z + (r() - .5) * Math.max(0, d - m)];
    for (let k = 0; k < n; k++) {
      const roll = r(), [px, pz] = at(2);
      if (roll < .3) { const h = 3 + r() * 9; prop('cyl', px, y + h / 2, pz, .15, h, .15, [.12, .12, .12]); if (h > 9) beacon(px, y + h + .2, pz, r); }
      else if (roll < .5) { const s = 1.2 + r() * 2; prop('dish', px, y + .3, pz, s, s, s, [.3, .3, .3], r() * 6.3, -.7 - r() * .4); }
      else if (roll < .68) tank(px, y, pz, r);
      else if (roll < .84) prop('box', px, y + 1.6 + r(), pz, 3 + r() * 3, .08, 3 + r() * 3, pick(r, TARP), r() * 6.3, (r() - .5) * .3);
      else prop('box', px, y + .3, pz, 2 + r() * 3, .6, 1.5 + r() * 2, [.03, .08 + .06 * r(), .03]);
    }
  };

  // Lit shop shutter with an optional small sign above it, on face +z or -z.

  const shop = (x, z, w, side, st, r) => {
    const rgb = r() < .7 ? WARM : r() < .5 ? PALE : [.4, 1.2, 1.0], v = .5 + .5 * r();
    glow(x, 1.5, z + side * .1, w * .8, 2.6, .3, rgb.map(c => c * v));
    prop('box', x, 3.3, z + side * .8, w * .9, .12, 1.6, pick(r, TARP), 0, side * .2);
    if (r() < .55) {
      const pal = r() < st.w ? [[1.8, .15, 1.2], [.18, 1.4, 1.8]] : BDC.signs;
      sign(x, z - side * .05, w, .1, 6, st, r, pick(r, pal), { face: side > 0 ? 2 : 3, blade: r() < .4, sw: w * .7, sh: 1.1, y: 4.4, along: 0 });
    }
  };

  // One shack: box with a slanted tin roof or a tarp, sometimes a lit door.

  const shack = (x, z, w, d, h, y0, st, r) => {
    vol(x, z, w, d, h, st, r, { y0, roof: false, skin: r() < .5 ? SKINS.sparse : SKINS.grid, lit: .3 + .4 * r() });
    if (r() < .5) prop('box', x, y0 + h + .1, z, w + .6, .1, d + .6, r() < .5 ? pick(r, TARP) : [.09, .07, .05], 0, (r() - .5) * .25);
    if (r() < .4) glow(x + (r() - .5) * w * .5, y0 + 1, z + (r() < .5 ? 1 : -1) * (d / 2 + .05), .9, 1.8, .1, WARM.map(c => c * .9));
  };

  // A lot frame turned to the street. u runs along the front, v points out to the street.
  //   U, V     lot size along u and v
  //   P, at    local point for (u, v), or (u, y, v) as a 3D point
  //   b, vol   a plain bld, or a volume in favela paint, sizes in u and v
  //   box, gl  prop and glow boxes turned to the front

  const front = (x, z, s) => {
    const f = H.frame(), fr = f?.front ?? { x: 0, z: 1 }, fx = fr.x, fz = fr.z, ry = Math.atan2(fx, fz), [W, D] = dims(s);
    const P = (u, v) => [x + u * fz + v * fx, z - u * fx + v * fz], sz = (su, sv) => fx ? [sv, su] : [su, sv];
    return {
      U: fx ? D : W, V: fx ? W : D, P, ry,
      at: (u, y, v) => { const [px, pz] = P(u, v); return [px, y, pz]; },
      b: (u, v, su, sv, h, st, r, o) => bld(...P(u, v), ...sz(su, sv), h, st, r, o),
      vol: (u, v, su, sv, h, st, r, o) => vol(...P(u, v), ...sz(su, sv), h, st, r, o),
      box: (u, y, v, su, sy, sv, rgb, kind = 'box', rx = 0) => { const [px, pz] = P(u, v); prop(kind, px, y, pz, su, sy, sv, rgb, ry, rx); },
      gl: (u, y, v, su, sy, sv, rgb) => { const [px, pz] = P(u, v); glow(px, y, pz, su, sy, sv, rgb, ry); },
      text: (t, u, y, v, tw, th, rgb) => { const [px, pz] = P(u, v); textSign(t, px, y, pz, tw, th, ry, rgb); },
    };
  };

  return {
    // Shacks piled on shacks: columns of mismatched boxes that overhang and lean on each other.

    shacks(x, z, s, st, b, r) {
      const [W, D] = dims(s), cell = 3.6 + r() * 2, nx = Math.min(5, Math.max(2, Math.floor(W / cell))), nz = Math.min(5, Math.max(2, Math.floor(D / cell)));
      const cw = W / nx, cd = D / nz, tops = [];
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        if (r() < .12) continue;
        const cx = x + (i + .5) * cw - W / 2, cz = z + (j + .5) * cd - D / 2;
        let y = 0;
        const levels = 1 + Math.floor(r() ** .8 * 4 * Math.min(1.5, b));
        for (let k = 0; k < levels; k++) {
          const h = 2.6 + r() * 1.4, grow = k ? 1 + r() * .5 : 1;
          const w = Math.min(cw * grow, cw + 2) - .4, d = Math.min(cd * grow, cd + 2) - .4;
          const ox = k ? (r() - .5) * 2.4 : 0, oz = k ? (r() - .5) * 2.4 : 0;
          shack(cx + ox, cz + oz, w, d, h, y, st, r);
          y += h;
        }
        tops.push([cx, y, cz]);
      }
      for (const [tx, ty, tz] of tops) if (r() < .25) clutter(tx, tz, cw, cd, ty, st, r, 1);
      for (let k = Math.min(tops.length - 1, 3 + Math.floor(r() * 4)); k > 0; k--) {
        const a = pick(r, tops), c = pick(r, tops);
        if (a !== c) laundry([a[0], a[1] - .6, a[2]], [c[0], c[1] - .6, c[2]], r);
      }
      for (let k = 1 + Math.floor(r() * 2); k > 0; k--) { const a = pick(r, tops), c = pick(r, tops); if (a !== c) stringLights([a[0], a[1] - 1, a[2]], [c[0], c[1] - 1, c[2]], 1, 6, r() < .7 ? WARM : [1.2, .35, .55]); }
      if (r() < .4) sign(x, z, W, D, 4, st, r, pick(r, BDC.signs).map(c => c * .7), { blade: false, sh: 1.2, y: 3.2 });
    },

    // Tenement tower: one tall slab with gallery bands, add-ons, laundry and a roof of tanks and masts.

    slab(x, z, s, st, b, r) {
      const [W, D] = dims(s), along = W >= D, w = along ? W - 2 : Math.min(W - 2, 12 + r() * 6), d = along ? Math.min(D - 2, 12 + r() * 6) : D - 2;
      const h = (30 + r() * 40) * Math.min(b, 1.3), sx = along ? 0 : 1;
      vol(x, z, w, d, h, st, r, { lit: .22 + .2 * r() });

      // Gallery strips on both long faces read as balconies.

      for (const side of [-1, 1]) {
        if (r() < .3) continue;
        const gw = (along ? w : d) * (.4 + .5 * r()), off = (r() - .5) * ((along ? w : d) - gw), gh = h * (.5 + .45 * r());
        const gx = x + (sx ? side * (w / 2 + .8) : off), gz = z + (sx ? off : side * (d / 2 + .8));
        bld(gx, gz, sx ? 1.6 : gw, sx ? gw : 1.6, gh - 3, look(st, r, .45), r, { y0: 3, skin: SKINS.bands, roof: false });
        for (let k = 1 + Math.floor(r() * 3); k > 0; k--) {
          const y = 5 + Math.floor(r() * (gh - 8) / 3.6) * 3.6 + 2.6, half = gw / 2 - .5, o = .9;
          const a = sx ? [gx + side * o, y, gz - half] : [gx - half, y, gz + side * o];
          const c = sx ? [gx + side * o, y, gz + half] : [gx + half, y, gz + side * o];
          laundry(a, c, r);
        }
      }
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) tank(x + (r() - .5) * (w - 4), h, z + (r() - .5) * (d - 4), r);
      clutter(x, z, w, d, h, st, r, 4 + Math.floor(r() * 4));
      if (r() < .6) shack(x + (r() - .5) * w * .4, z + (r() - .5) * d * .4, 4 + r() * 3, 3 + r() * 3, 3, h, st, r);
      for (let k = Math.floor(r() * 3); k > 0; k--) sign(x, z, w, d, h, st, r, pick(r, BDC.signs).map(c => c * (.6 + .5 * r())));
      for (const side of [-1, 1]) shop(x + (r() - .5) * (w - 8), z + side * d / 2, Math.min(8, w * .6), side, st, r);
    },

    // Infill wedge: handshake towers flare toward each other over a narrow alley, with bridges across it.

    wedge(x, z, s, st, b, r) {
      const [W, D] = dims(s), n = 2 + Math.floor(r() * 2), along = W >= D, L = along ? W : D, S = along ? D : W;
      const at = (u, v) => along ? [x + u, z + v] : [x + v, z + u];
      const box = (u, v, lu, lv, h, y0, o) => { const [px, pz] = at(u, v); vol(px, pz, along ? lu : lv, along ? lv : lu, h, st, r, { y0, ...o }); return [px, pz]; };
      const slot = L / n, towers = [];
      for (let k = 0; k < n; k++) {
        const c = (k + .5) * slot - L / 2, dir = n === 2 ? (k ? -1 : 1) : k === 1 ? 0 : k ? -1 : 1;
        const top = (16 + r() * 40) * Math.min(b, 1.4), steps = 3 + Math.floor(r() * 2), deep = S * (.55 + .35 * r());
        let y = 0, lo = c - slot * .28, hi = c + slot * .28;
        for (let q = 0; q < steps; q++) {
          const sh = top / steps * (.8 + .4 * r());
          const [px, pz] = box((lo + hi) / 2, (r() - .5) * (S - deep), hi - lo, deep, sh, y, { roof: q === steps - 1 });
          if (q) glow(px, y - .15, pz, along ? (hi - lo) * .9 : deep * .8, .12, along ? deep * .8 : (hi - lo) * .9, WARM.map(v => v * .3));
          y += sh;
          const g = 1.5 + r() * 2.5;
          if (dir >= 0) hi = Math.min(c + slot / 2 - .4, hi + g);
          if (dir <= 0) lo = Math.max(c - slot / 2 + .4, lo - g);
        }
        towers.push({ c, h: y, y1: top / steps * .8, lo: c - slot * .28, hi: c + slot * .28, w: hi - lo, m: (lo + hi) / 2 });
      }
      for (let k = 0; k + 1 < towers.length; k++) {
        const A = towers[k], B = towers[k + 1], len = B.lo - A.hi + .6, mid = (A.hi + B.lo) / 2;
        for (let q = 1 + Math.floor(r() * 2); q > 0; q--) {
          const y = 4 + r() * Math.max(0, Math.min(A.y1, B.y1) - 7), v = (r() - .5) * S * .3;
          const [bx, bz] = at(mid, v);
          bld(bx, bz, along ? len : 2.2, along ? 2.2 : len, 2.6, look(st, r, .6), r, { y0: y, roof: false, skin: SKINS.bands });
          glow(bx, y - .1, bz, along ? len * .8 : .3, .1, along ? .3 : len * .8, PALE.map(c => c * .5));
        }
        for (let q = 0; q < 2; q++) {
          const y = 5 + r() * 6, [ax, az] = at(A.hi, -S * .4 + q * S * .8 * r()), [cx, cz] = at(B.lo, (r() - .5) * S * .8);
          q ? laundry([ax, y, az], [cx, y - 1, cz], r) : stringLights([ax, y, az], [cx, y - 1, cz], 1.2, 6, r() < .5 ? WARM : [1.3, .4, .6]);
        }
      }
      for (const t of towers) { const [px, pz] = at(t.m, 0); clutter(px, pz, along ? t.w : S * .5, along ? S * .5 : t.w, t.h, st, r, 2); }
      sign(x, z, W, D, 12, st, r, pick(r, BDC.signs));
    },

    // Courtyard walk-up: a U of four-to-seven-floor wings with open galleries round a lit yard.

    courtyard(x, z, s, st, b, r) {
      const [W, D] = dims(s), t = Math.min(9, Math.min(W, D) * .3), h = (11 + r() * 14) * Math.min(b, 1.4);
      const open = r() < .5 ? 1 : -1, lit = .22 + .2 * r(), wings = [
        [x - W / 2 + t / 2, z, t, D, 1, 0],
        [x + W / 2 - t / 2, z, t, D, -1, 0],
        [x, z - open * (D / 2 - t / 2), W - 2 * t, t, 0, open],
      ];
      for (const [wx, wz, ww, wd, nx, nz] of wings) {
        const wh = h * (.8 + .4 * r());
        vol(wx, wz, ww, wd, wh, st, r, { lit });
        clutter(wx, wz, ww, wd, wh, st, r, 2);

        // Gallery slabs and rails on the courtyard face.

        const gx = wx + nx * (ww / 2 + .7), gz = wz + nz * (wd / 2 + .7), span = (nx ? wd : ww) - (nz ? 0 : 2 * t);
        for (let y = 3.6; y < wh - 1; y += 3.6) {
          prop('box', gx, y, gz, nx ? 1.4 : span, .2, nx ? span : 1.4, [.08, .07, .06]);
          glow(gx + nx * .65, y + .9, gz + nz * .65, nx ? .05 : span, .05, nx ? span : .05, [.25, .15, .06]);
        }
      }
      const yd = [W - 2 * t - 1, D - t - 1], cy = z + open * t / 2;
      prop('box', x, .1, cy, yd[0], .2, yd[1], [.05, .045, .04]);
      for (let k = 3 + Math.floor(r() * 3); k > 0; k--) {
        const y = 5 + r() * 4, u = (r() - .5) * yd[1];
        const a = [x - yd[0] / 2, y, cy + u], c = [x + yd[0] / 2, y - r() * 2, cy + (r() - .5) * yd[1]];
        r() < .65 ? stringLights(a, c, 1.2, 8, r() < .7 ? WARM : [1.2, .35, .55]) : laundry(a, c, r);
      }
      for (let k = Math.floor(r() * 3); k > 0; k--) prop('box', x + (r() - .5) * yd[0] * .7, .5, cy + (r() - .5) * yd[1] * .7, 1.2, 1, .8, pick(r, TARP));
      if (r() < .5) prop('cyl', x, 2.5, cy, 3 + r() * 2, 5, 3 + r() * 2, [.03, .09, .04]);
      sign(x, z, W, D, 5, st, r, pick(r, BDC.signs), { face: open > 0 ? 2 : 3, blade: false, sw: Math.min(8, W * .4), sh: 1.3, y: 3.8 });
    },

    // Shop-house rows: narrow units back to back, lit shutters below, three to six floors of flats above.

    shophouse(x, z, s, st, b, r) {
      const [W, D] = dims(s), along = W >= D, L = along ? W : D, S = along ? D : W, deep = S / 2 - .3;
      const flip = (u, v) => along ? [x + u, z + v] : [x + v, z + u];
      for (const side of [1, -1]) {
        let u = -L / 2;
        while (u < L / 2 - 2) {
          const uw = Math.min(L / 2 - u, 4 + r() * 4), h = (9 + r() * 15) * Math.min(b, 1.4), c = u + uw / 2;
          const [bx, bz] = flip(c, side * S / 4);
          vol(bx, bz, along ? uw - .2 : deep, along ? deep : uw - .2, h, st, r, { y0: 0 });
          const [fx, fz] = flip(c, side * (S / 2 - .1));
          if (along) shop(fx, fz, uw - .4, side, st, r);
          else glow(fx, 1.5, fz, .3, 2.6, (uw - .4) * .8, WARM.map(v => v * (.5 + .5 * r())));
          if (r() < .3) shack(bx, bz, (along ? uw : deep) * .6, (along ? deep : uw) * .5, 2.8, h, st, r);
          else if (r() < .4) tank(bx, h, bz, r);
          u += uw;
        }
        if (along) for (let k = 1 + Math.floor(r() * 2); k > 0; k--) {
          const y = 6 + r() * 4, a = [x - L / 2, y, z + side * (S / 2 + .5)], e = [x + L / 2, y - 1, z + side * (S / 2 + .5)];
          cable(a, e);
          if (r() < .5) stringLights(a, e, .8, 8, WARM);
        }
      }
      for (let k = 1 + Math.floor(r() * 3); k > 0; k--) sign(x, z, along ? L : S, along ? S : L, 14, st, r, pick(r, BDC.signs), { face: along ? (r() < .5 ? 2 : 3) : undefined, blade: true });
    },

    // Roof village: a plain mid-rise carrying a second, informal settlement on top.

    rooftop(x, z, s, st, b, r) {
      const [W, D] = dims(s), w = W - 1, d = D - 1, h = (18 + r() * 24) * Math.min(b, 1.4);
      vol(x, z, w, d, h, st, r, { roof: false, skin: r() < .5 ? SKINS.bands : SKINS.grid, lit: .2 + .25 * r() });
      const tops = [];
      for (let k = 5 + Math.floor(r() * Math.min(9, w * d / 60)); k > 0; k--) {
        const sw = 3 + r() * 3, sd = 3 + r() * 3, px = x + (r() - .5) * (w - sw), pz = z + (r() - .5) * (d - sd);
        let y = h;
        for (let q = r() < .35 ? 2 : 1; q > 0; q--) { const sh = 2.6 + r(); shack(px, pz, sw, sd, sh, y, st, r); y += sh; }
        tops.push([px, y, pz]);
      }
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) {
        const a = pick(r, tops), c = pick(r, tops);
        if (a !== c) stringLights([a[0], a[1] - .5, a[2]], [c[0], c[1] - .5, c[2]], .8, 6, r() < .7 ? WARM : [1.1, .3, .6]);
      }
      clutter(x, z, w, d, h, st, r, 3 + Math.floor(r() * 3));
      for (const [dx, dz] of [[1, 0], [0, 1]]) if (r() < .6) prop('box', x + dx * (w / 2 + .15), h / 2, z + dz * (d / 2 + .15), dx ? .3 : .5, h, dz ? .3 : .5, [.05, .05, .05]);
      for (let k = Math.floor(r() * 3); k > 0; k--) sign(x, z, w, d, h, st, r, pick(r, BDC.signs).map(c => c * .8));
      shop(x, z + d / 2, Math.min(9, w * .4), 1, st, r);
    },

    // Walled-city cluster: towers of every height fused into one block, roofs bristling with masts.

    warren(x, z, s, st, b, r) {
      const [W, D] = dims(s), nx = 2 + Math.floor(r() * 2), nz = 2 + Math.floor(r() * 2), cw = W / nx, cd = D / nz;
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const cx = x + (i + .5) * cw - W / 2, cz = z + (j + .5) * cd - D / 2;
        const h = (8 + r() ** 1.3 * 52) * Math.min(b, 1.3), w = cw + .2, d = cd + .2;
        vol(cx, cz, w, d, h, st, r, { lit: .15 + .25 * r() });
        clutter(cx, cz, w, d, h, st, r, 1 + Math.floor(r() * 3));
        if (r() < .4) shack(cx + (r() - .5) * w * .3, cz + (r() - .5) * d * .3, 3 + r() * 2, 3 + r() * 2, 2.8, h, st, r);
        if (i === 0 || j === 0 || i === nx - 1 || j === nz - 1) if (r() < .35) sign(cx, cz, w, d, h, st, r, pick(r, BDC.signs).map(c => c * (.5 + .6 * r())));
      }
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) {
        const y = 4 + r() * 10, a = [x - W / 2 - .3, y, z + (r() - .5) * D], c = [x + W / 2 + .3, y + (r() - .5) * 3, z + (r() - .5) * D];
        cable(a, c);
      }
      put(GLOWS.sphere, x, 3, z + D / 2 + .5, 1.2, .5, .4, 0, 0, SODIUM.map(v => v * .5));
    },

    // ---------- small-lot kits: each turns its frontage to the street ----------

    // Corner bodega: two or three floors over a lit shop window, a striped awning and blade signs stacked up the corner.

    bodega(x, z, s, st, b, r) {
      const T = front(x, z, s), bu = Math.min(T.U - .6, 14), bv = Math.min(T.V - 1.8, 14), fv = bv / 2, c = pick(r, STORE);
      const floors = 2 + Math.floor(r() * 2), h = floors * 3.3 * Math.min(Math.max(b, .85), 1.3);
      T.vol(0, 0, bu, bv, h, st, r, { lit: .25 + .3 * r() });

      T.gl(0, 1.45, fv + .06, bu * .82, 2.3, .1, dim(c, .26));
      for (let k = -1; k <= 1; k++) T.box(k * bu * .27, 1.45, fv + .14, .14, 2.3, .06, [.03, .03, .03]);
      T.box(0, 3.1, fv + .2, bu, .6, .4, [.04, .035, .03]);
      T.gl(0, 3.1, fv + .42, bu * .96, .2, .06, dim(c, 1.1));
      T.box(0, 3.55, fv + .95, bu * .96, .08, 1.6, pick(r, CLOTH), 'box', .25);
      stringLights(T.at(-bu * .45, 3.25, fv + 1.7), T.at(bu * .45, 3.25, fv + 1.7), .12, 6, r() < .7 ? WARM : c);
      T.text(pick(r, WORDS.bodega), 0, 4.45, fv + .08, Math.min(bu * .75, 7), Math.min(bu * .14, 1.3), dim(c, 1.4));
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) T.box((r() - .5) * bu * .8, .35, fv + .45, .9, .7, .6, pick(r, CRATE));
      pool(...T.P(0, fv + 3), Math.max(3, bu * .4), dim(c, .07));

      // Blade signs stacked up one corner, one per upper floor.

      const cu = (r() < .5 ? -1 : 1) * (bu / 2 - .4);
      for (let y = 4.9; y < h - .8; y += 2.3) {
        T.box(cu, y, fv + .75, .2, 2, 1.5, [.04, .035, .03]);
        T.gl(cu, y, fv + .75, .3, 1.7, 1.25, dim(pick(r, r() < .5 ? STORE : BDC.signs), .9));
      }
      for (let k = 1; k < floors; k++) if (r() < .5) {
        const u = (r() - .5) * (bu - 3), y = k * 3.3 * Math.min(Math.max(b, .85), 1.3);
        T.box(u, y + .1, fv + .5, 2.6, .15, 1, METAL);
        T.box(u, y + .6, fv + .98, 2.6, .9, .06, METAL);
      }
      if (r() < .45) { const [px, pz] = T.P((r() - .5) * bu * .4, -bv * .2); tank(px, h, pz, r); }
    },

    // Walk-up: a narrow four-to-seven-floor block with a stair tower, caged balconies and a tin gable or a roof of tanks.

    walkup(x, z, s, st, b, r) {
      const T = front(x, z, s), fh = 3.1, floors = 4 + Math.floor(r() * 4 * Math.min(b, 1)), h = floors * fh, sd = r() < .5 ? -1 : 1;

      // A wide lot puts the stair beside the block. A narrow one pushes the block back and puts the stair in front.

      const side = T.U >= 9 && r() < .6, bu = side ? Math.min(T.U - 3.4, 10) : Math.min(T.U - .6, 10);
      const bv = side ? Math.min(T.V - 2, 12) : Math.min(T.V - 4.4, 12), u0 = side ? -sd * 1.3 : 0, v0 = side ? 0 : -1.4, fv = v0 + bv / 2;
      const su = side ? u0 + sd * (bu / 2 + 1.3) : sd * (bu / 2 - 1.3), sv = side ? fv - 1.4 : fv + 1.4;
      const gable = r() < .45;
      T.vol(u0, v0, bu, bv, h, st, r, { lit: .2 + .3 * r(), roof: !gable });
      T.vol(su, sv, 2.6, 2.8, h + 2.6, st, r, { lit: .08, skin: SKINS.sparse, roof: false, kibble: false });
      T.box(su, h + 2.7, sv, 3, .2, 3.2, METAL);

      // Stair landings light up in a zig-zag up the tower's street face.

      const stairLight = r() < .6 ? PALE : SODIUM;
      for (let k = 0; k < floors; k++) T.gl(su + (k % 2 ? .55 : -.55), k * fh + 2, sv + 1.42, .7, .9, .06, dim(stairLight, .3 + .2 * r()));
      T.gl(su, 1.1, sv + 1.42, 1, 2.1, .06, dim(stairLight, .45));

      // Balcony cages on the front, kept clear of a front stair.

      const cw = Math.min(bu * .5, 3.2);
      for (let k = 1; k < floors; k++) if (r() < .55) {
        const cu = side ? u0 + (r() - .5) * (bu - cw) : -sd * r() * (bu - cw) / 2, y = k * fh;
        T.box(cu, y + .05, fv + .45, cw, .15, .9, METAL);
        T.box(cu, y + 2.35, fv + .45, cw, .1, .9, METAL);
        T.box(cu, y + 1, fv + .88, cw, .06, .06, METAL);
        for (const e of [-1, 1]) T.box(cu + e * (cw / 2 - .05), y + 1.2, fv + .88, .07, 2.3, .07, METAL);
        if (r() < .35) T.box(cu, y + .45, fv + .55, cw * .7, .5, .4, [.03, .09, .03]);
      }
      if (r() < .4) T.gl(u0, 1.4, fv + .06, Math.min(bu * .6, 4), 2.4, .1, dim(r() < .6 ? WARM : PALE, .5));
      if (gable) bld(...T.P(u0, v0), bu + .6, 1.8 + r() * 1.4, bv + .6, { ...st, base: pick(r, TIN), lit: 0 }, r, { y0: h, shape: 'gable', ry: T.ry, skin: SKINS.sparse });
      else { const [px, pz] = T.P(u0, v0 - bv * .2); tank(px, h, pz, r); }
      if (r() < .5) { const y = fh * (1 + Math.floor(r() * (floors - 1))) + 2.6; laundry(T.at(u0 - bu / 2 + .4, y, fv + .7), T.at(u0 + bu / 2 - .4, y - .3, fv + .7), r); }
    },

    // Noodle stalls: counters, cookers and steam under tarps in front of a two-floor kitchen house.

    noodles(x, z, s, st, b, r) {
      const T = front(x, z, s), U = Math.min(T.U, 16), V = Math.min(T.V, 16), bu = U - .6, bv = Math.max(3.5, V * .42), bh = 5.6 + r() * 2.2;
      const v0 = -V / 2 + bv / 2 + .2, y0 = v0 + bv / 2, yd = V / 2 - .2 - y0, yc = y0 + yd / 2, c = pick(r, STORE);
      T.vol(0, v0, bu, bv, bh, st, r, { lit: .3 + .3 * r() });
      T.box(0, .06, yc, bu, .12, yd, [.05, .045, .04]);
      T.text(pick(r, WORDS.noodles), 0, Math.min(bh - .9, 4.7), y0 + .08, Math.min(bu * .6, 6), 1, dim(c, 1.4));
      T.gl(0, 1.5, y0 + .05, bu * .7, 2.4, .08, dim(WARM, .35));

      const nt = bu > 9 ? 2 : 1, tw = bu / nt;
      for (let k = 0; k < nt; k++) {
        const cu = -bu / 2 + tw * (k + .5), ty = 3.1 + r() * .5;
        T.box(cu, ty, yc, tw - .2, .08, yd + .3, pick(r, CLOTH), 'box', (r() - .5) * .14);
        T.gl(cu, ty - .12, yc, (tw - .6) * .8, .04, yd * .6, dim(WARM, .22));
        for (const e of [-1, 1]) {
          T.box(cu + e * (tw / 2 - .3), ty / 2, yc + yd / 2 - .1, .1, ty, .1, METAL);
          if (r() < .7) put(GLOWS.sphere, ...T.at(cu + e * (tw / 2 - .9), ty - .55, yc + yd / 2 - .2), .45, .6, .45, 0, 0, r() < .7 ? [1.8, .2, .1] : GOLD);
        }
      }
      for (let n = Math.max(1, Math.min(3, Math.floor(bu / 3.4))), k = 0; k < n; k++) {
        const u = -bu / 2 + (k + .5) * bu / n, v = yc - yd * .1;
        T.box(u, .55, v, 2.2, 1.1, .9, pick(r, PAINT));
        T.gl(u, 1.13, v, 2, .06, .7, dim(WARM, .7));
        T.gl(u, .65, v + .47, 1.8, .6, .04, dim(pick(r, STORE), .3));
        T.gl(u - .5, 1.3, v - .15, .5, .25, .4, [1.8, .5, .1]);
        puff(...T.at(u - .5, 2.3 + r() * .6, v - .15), .6 + r() * .4, STEAM);
        for (const e of [-1, 1]) T.box(u + e * .6, .35, v + .95, .35, .7, .35, [.3, .05, .04], 'cyl');
      }
      stringLights(T.at(-bu / 2 + .3, 2.9, V / 2 - .3), T.at(bu / 2 - .3, 2.9, V / 2 - .3), .3, 7, r() < .6 ? WARM : [1.3, .4, .6]);
      pool(...T.P(0, V / 2 + 1.5), Math.max(3, bu * .4), dim(WARM, .08));
      if (r() < .5) { const [px, pz] = T.P((r() - .5) * bu * .5, v0); tank(px, bh, pz, r); }
    },

    // Order of Sol chapel: a whitewashed nave under a tile gable, a belfry or bell wall with a lit sun ring, candles on the steps.

    chapel(x, z, s, st, b, r) {
      const T = front(x, z, s), nu = Math.min(T.U - 2, 9), nv = Math.min(T.V - 3, 15), v0 = -.8, fv = v0 + nv / 2, nh = 5 + r() * 2.5, rh = 1.4 + nu * .16;
      const cst = { ...st, base: pick(r, LIME).map((c, i) => lerp(c, st.base[i], st.w * .6)), lit: .12 };
      T.b(0, v0, nu, nv, nh, cst, r, { skin: SKINS.plaster, roof: false, kibble: false });
      bld(...T.P(0, v0), nv + .6, rh, nu + .8, { ...st, base: pick(r, TILE), lit: 0 }, r, { y0: nh, shape: 'gable', ry: T.ry + Math.PI / 2, skin: SKINS.tile });

      // A corner belfry with a pyramid cap, or a bell wall over the front gable. Either carries the sun ring.

      const sd = r() < .5 ? -1 : 1, tower = r() < .55;
      const tu = tower ? sd * (nu / 2 - .9) : 0, tv = tower ? fv - .7 : fv - .2, tw = tower ? 2.2 : Math.min(nu * .5, 3.4);
      const th = tower ? nh + (5 + r() * 5) * Math.min(b, 1.2) : nh + rh + 2.4, tf = tv + (tower ? 1.1 : .3);
      T.b(tu, tv, tw, tower ? 2.2 : .6, tower ? th : th - nh, cst, r, { y0: tower ? 0 : nh, skin: SKINS.plaster, roof: false, kibble: false });
      if (tower) bld(...T.P(tu, tv), 2.6, 2.4, 2.6, { ...st, base: pick(r, TILE), lit: 0 }, r, { y0: th, shape: 'pyr' });
      put(GLOWS.ring, ...T.at(tu, th - 1.3, tf + .05), 1.7, 1.7, 1.7, T.ry, Math.PI / 2, GOLD);
      put(GLOWS.sphere, ...T.at(tu, th - 1.3, tf + .05), .55, .55, .15, T.ry, 0, GOLD);

      T.gl(0, 1.3, fv + .06, 1.5, 2.6, .1, dim(GOLD, .5));
      put(GLOWS.sphere, ...T.at(0, 2.6, fv + .06), 1.5, 1.5, .1, T.ry, 0, dim(GOLD, .5));
      if (nh > 5.8) put(GLOWS.sphere, ...T.at(0, nh - 1.1, fv + .06), 1.1, 1.1, .1, T.ry, 0, [1.4, .45, .3]);
      T.box(0, .15, fv + .6, 2.8, .3, 1.2, [.12, .11, .1]);
      for (let k = 8 + Math.floor(r() * 7); k > 0; k--) {
        const onStep = r() < .5, u = (r() - .5) * (onStep ? 2.6 : Math.min(nu, 6)), v = onStep ? fv + .3 + r() * .9 : fv + 1.3 + r() * .6;
        T.gl(u, (onStep ? .3 : 0) + .15, v, .1, .3, .1, dim(CANDLE, .6 + .5 * r()));
      }
      stringLights(T.at(tu, th - 3, tf), T.at(-sd * (T.U / 2 - .3), 2.6, T.V / 2 - .3), .5, 6, [1.6, .7, .1]);
      pool(...T.P(0, fv + 2.5), 3.5, dim(GOLD, .08));
    },

    // Repair shop: a roller door half up over a lit workshop, a car on the apron, drums and tyres, a hoist jib.

    taller(x, z, s, st, b, r) {
      const T = front(x, z, s), bu = Math.min(T.U - .6, 14), bv = Math.min(T.V - 3, 14), v0 = -1.2, fv = v0 + bv / 2, h = 7 + r() * 2.5;
      T.vol(0, v0, bu, bv, h, st, r, { lit: .2 + .2 * r() });
      const du = Math.min(bu * .72, 6.5), d0 = (r() - .5) * (bu - du), work = r() < .5 ? [.6, .8, 1.05] : WARM;
      T.gl(d0, 1.3, fv + .05, du, 2.6, .1, dim(work, .22));
      T.gl(d0 + (r() - .5) * du * .5, 2.4, fv + .07, .8, .25, .06, dim(work, 1.2));
      T.box(d0, 3.1, fv + .15, du + .2, 1, .12, [.16, .16, .15]);
      for (const y of [2.8, 3.2]) T.box(d0, y, fv + .22, du + .2, .05, .04, [.06, .06, .06]);

      // Dark shapes against the lit bay: a car up on a lift, or a bench under a tool wall.

      const SIL = [.025, .025, .028];
      if (r() < .55) {
        for (const e of [-1, 1]) T.box(d0 + e * Math.min(du * .35, 2), 1.2, fv + .14, .15, 2.4, .1, SIL);
        T.box(d0, 1.75, fv + .16, Math.min(du * .8, 4.2), .8, .1, SIL);
        T.box(d0 - .3, 2.3, fv + .16, Math.min(du * .4, 2), .45, .1, SIL);
      } else {
        T.box(d0, .5, fv + .16, du * .6, 1, .1, SIL);
        for (let k = 2 + Math.floor(r() * 3); k > 0; k--) T.box(d0 + (r() - .5) * du * .7, 1.6 + r() * .8, fv + .14, .2 + r() * .5, .1 + r() * .6, .08, SIL);
      }
      T.box(d0, 4.0, fv + .3, du + .4, .5, .5, METAL);
      T.text(pick(r, WORDS.taller), d0, 4.9, fv + .08, Math.min(du * .8, 6), 1, r() < .5 ? [1.7, 1.2, .2] : [1.7, .25, .15]);
      T.box(0, .04, fv + 1.35, bu, .08, 2.6, [.03, .03, .03]);
      if (r() < .6) for (let k = 2 + Math.floor(r() * 2); k > 0; k--) T.gl(d0 + (r() - .5) * du * .6, .6 + r() * 1.2, fv + .3, .15, .15, .15, [2.2, 2.2, 2.6]);
      if (r() < .6) {
        const cu = (r() - .5) * Math.max(0, bu - 4.4), cv = fv + 1.35, cc = pick(r, CAR);
        T.box(cu, .55, cv, 4, .8, 1.8, cc);
        T.box(cu - .2, 1.2, cv, 2, .55, 1.6, dim(cc, .5));
        if (r() < .5) T.box(cu + 1.4, 1.35, cv, .1, .9, 1.6, cc, 'box', 0);
      }
      const eu = (d0 > 0 ? -1 : 1) * (bu / 2 - .6);
      for (let k = 1 + Math.floor(r() * 3); k > 0; k--) T.box(eu + (r() - .5) * 1.2, .45, fv + .5 + r() * 1.5, .6, .9, .6, pick(r, [[.2, .05, .03], [.04, .08, .15], [.15, .12, .02]]), 'cyl');
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) T.box(eu, .12 + k * .25, fv + 2.1, .75, .24, .75, [.02, .02, .02], 'cyl');
      if (r() < .45) {
        T.box(d0, 4.55, fv + .9, .25, .3, 1.8, [.2, .15, .03]);
        T.box(d0, 3.8, fv + 1.7, .05, 1.4, .05, METAL, 'cyl');
        T.box(d0, 3.05, fv + 1.7, .25, .3, .25, METAL);
      }
      pool(...T.P(d0, fv + 2.5), Math.max(3, du * .45), dim(work, .08));
    },

    // Container homes: shipping boxes stacked crosswise three to six high, a steel stair and gallery on the front, cables to a pole.

    boxhomes(x, z, s, st, b, r) {
      const T = front(x, z, s), U = Math.min(T.U, 14), V = Math.min(T.V, 14) - 1.4, CH = 2.6, CW = 2.45, vc = -.7;
      const layers = 3 + Math.floor(r() * 3.99 * Math.min(b, 1)), flip = r() < .5 ? 1 : 0, tops = [];
      for (let k = 0; k < layers; k++) {
        const alongU = (k + flip) % 2 === 0, len = alongU ? U : V, across = alongU ? V : U;
        const L = len >= 12.4 ? 12.2 : Math.min(6.1, len - .2), n = Math.max(1, Math.min(4, Math.floor(across / (CW + .15))) - (k > 2 ? Math.floor(r() * 2) : 0));
        for (let i = 0; i < n; i++) {
          if (k && r() < .15) continue;
          const off = (i - (n - 1) / 2) * (CW + .15), slide = (r() - .5) * Math.max(0, len - L), y = k * CH;
          const [u, v] = alongU ? [slide, vc + off] : [off, vc + slide];
          const cst = { ...look(st, r, .12), base: pick(r, CONT).map((c, q) => lerp(c, st.base[q], st.w * .7)) };
          T.b(u, v, alongU ? L : CW, alongU ? CW : L, CH - .05, cst, r, { y0: y, roof: false, kibble: false, skin: SKINS.bands });
          if (r() < .5) {
            const e = r() < .5 ? -1 : 1;
            alongU ? T.gl(u + e * (L / 2 + .03), y + 1.3, v, .06, 1.1, 1.4, dim(pick(r, WIN), .32)) : T.gl(u, y + 1.3, v + L / 2 + .03, 1.4, 1.1, .06, dim(pick(r, WIN), .32));
          }
          tops.push([u, y + CH, v]);
        }
      }

      // Front gallery at each level with a flight of steps up to the next.

      const gv = V / 2 + vc + .6, sd = r() < .5 ? -1 : 1;
      for (let k = 1; k < layers; k++) {
        T.box(0, k * CH - .05, gv, U * .7, .12, 1.1, METAL);
        T.gl(0, k * CH + .9, gv + .5, U * .7, .04, .04, dim(SODIUM, .35));
        const e = k % 2 ? 1 : -1, fu = sd * U * .2;
        H.beam(T.at(fu - e * 1.5, (k - 1) * CH + .1, gv + .2), T.at(fu + e * 1.5, k * CH - .1, gv + .2), .28, METAL);
      }
      const [px, pz] = T.P(-sd * (U / 2 - .3), T.V / 2 - .3);
      prop('cyl', px, 4.5, pz, .2, 9, .2, [.08, .06, .04]);
      for (let k = Math.min(tops.length, 2 + Math.floor(r() * 2)); k > 0; k--) { const t = pick(r, tops); cable(T.at(t[0], t[1] - .3, t[2]), [px, 8.8, pz]); }
      stringLights([px, 8.5, pz], T.at(sd * U * .4, layers * CH - .5, vc), .8, 6, r() < .6 ? WARM : [1.2, .35, .55]);
      for (let k = 0; k < 2 && tops.length > 1; k++) { const t = pick(r, tops), [qx, qz] = T.P(t[0], t[2]); clutter(qx, qz, 2.4, 2.4, t[1], st, r, 1); }
      if (tops.length > 2) { const a = pick(r, tops), c = pick(r, tops); if (a !== c) laundry(T.at(a[0], a[1] - .4, a[2]), T.at(c[0], c[1] - .9, c[2]), r); }
    },
  };
}

export const tiers = {
  bdc: {
    0: ['shacks', 'shacks', 'shacks', 'shacks', 'shophouse', 'shophouse', 'shophouse', 'courtyard', 'courtyard', 'rooftop', 'rooftop', 'warren'],
    1: ['shacks', 'shacks', 'shophouse', 'shophouse', 'shophouse', 'courtyard', 'courtyard', 'warren', 'warren', 'wedge', 'wedge', 'rooftop', 'rooftop', 'slab', 'slab'],
    2: ['slab', 'slab', 'slab', 'slab', 'warren', 'warren', 'warren', 'wedge', 'wedge', 'rooftop', 'rooftop', 'shophouse'],
  },
};
