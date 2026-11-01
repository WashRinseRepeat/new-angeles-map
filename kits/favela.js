// Base de Cayambe housing: stacked shacks, tenement slabs, infill wedges, courtyards, shop-houses and roof villages.
// Kit signature: (x, z, s, st, b, r) in the lot frame. Kits read H.frame() and fall back to an s × s square.

export function kits(H) {
  const { GLOWS, BDC, SKINS, beacon, bld, glow, lerp, prop, put, sign, stringLights } = H;

  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const dims = s => { const f = H.frame(); return f ? [Math.min(f.w - 2, 60), Math.min(f.d - 2, 60)] : [s, s]; };

  // Faded paint and window light. Rutherford weight pulls both toward the district style.

  const PAINT = [[.2, .09, .06], [.18, .13, .06], [.06, .12, .12], [.08, .1, .14], [.18, .09, .1], [.12, .11, .1], [.1, .12, .07], [.16, .15, .13]];
  const WIN = [[1.0, .62, .22], [1.0, .62, .22], [1.05, .5, .2], [1.0, .7, .4], [.85, .95, .75], [1.0, .45, .35]];
  const TARP = [[.05, .09, .2], [.2, .07, .04], [.05, .14, .1], [.2, .16, .05], [.1, .1, .1]];
  const CLOTH = [[.3, .08, .06], [.06, .12, .3], [.3, .28, .22], [.25, .2, .05], [.1, .25, .15], [.3, .12, .2]];
  const WARM = [1.4, .7, .25], PALE = [.9, 1.1, .85], SODIUM = [1.3, .6, .15];
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
  };
}

export const tiers = {
  bdc: {
    0: ['shacks', 'shacks', 'shacks', 'shacks', 'shophouse', 'shophouse', 'shophouse', 'courtyard', 'courtyard', 'rooftop', 'rooftop', 'warren'],
    1: ['shacks', 'shacks', 'shophouse', 'shophouse', 'shophouse', 'courtyard', 'courtyard', 'warren', 'warren', 'wedge', 'wedge', 'rooftop', 'rooftop', 'slab', 'slab'],
    2: ['slab', 'slab', 'slab', 'slab', 'warren', 'warren', 'warren', 'wedge', 'wedge', 'rooftop', 'rooftop', 'shophouse'],
  },
};
