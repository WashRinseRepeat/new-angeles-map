// Industrial kits: the Base de Cayambe flats of tanks, stacks, yards and depots. Kit signature: (x, z, s, st, b, r) in the lot frame.
// Kits read the real lot rectangle from H.frame() and fall back to an s × s square in the showcase.

export function kits(H) {
  const { BDC, GLOWS, beacon, bld, flickerGlow, glow, lerp, prop, put, sign } = H;

  const SODIUM = [1.3, .6, .15], FLAME = [2.6, 1.0, .2], TOXIC = [.35, 1.3, .25];
  const RUST = [[.16, .07, .04], [.12, .09, .06], [.09, .09, .1], [.18, .12, .05], [.06, .07, .08]];
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const dims = s => { const f = H.frame(); return f ? [Math.min(f.w - 2, 70), Math.min(f.d - 2, 70)] : [s, s]; };
  const metal = (st, r, v = .1) => { const g = v * (.7 + .6 * r()); return [g * lerp(1.2, .8, st.w), g, g * lerp(.85, 1.15, st.w)]; };
  const lamp = st => st.w > .5 ? [.6, .95, 1.1] : SODIUM;
  const slab = (x, z, w, d, rgb = [.03, .028, .027]) => prop('box', x, .1, z, w, .2, d, rgb);

  // Pinpoint work lights scattered over a structure.

  const pins = (x, z, w, d, y0, y1, n, r, rgb) => {
    for (let k = 0; k < n; k++) glow(x + (r() - .5) * w, y0 + r() * (y1 - y0), z + (r() - .5) * d, .25, .25, .25, rgb);
  };

  // Storage tank with a shallow domed roof.

  const tank = (x, z, rad, h, rgb, st, r) => {
    prop('cyl', x, h / 2, z, rad * 2, h, rad * 2, rgb);
    prop('dish', x, h + rad * .25, z, rad * 2, rad * 1.25, rad * 2, rgb, 0, Math.PI);
    if (r() < .5) glow(x, h + .2, z + rad, .4, .3, .4, lamp(st));
  };

  // Smoke or steam plume: puffs rise, swell, drift downwind and fade.

  const plume = (x, y, z, rad, n, r, rgb) => {
    const wx = .5 + r() * .5, wz = (r() - .5) * .6;
    for (let k = 0; k < n; k++) {
      const t = k / n, sz = rad * (1 + k * .6), f = .7 * (1 - t) ** 1.5;
      put(GLOWS.sphere, x + wx * k * rad * 1.2, y + rad * .6 + k * rad * 1.1, z + wz * k * rad * 1.2, sz, sz * .7, sz, 0, 0, rgb.map(c => c * f));
    }
  };

  // Pipe run between two points at one height, with posts.

  const pipe = (x0, z0, x1, z1, y, dia, rgb) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    prop('cyl', (x0 + x1) / 2, y, (z0 + z1) / 2, dia, len, dia, rgb, ry, Math.PI / 2);
    for (let t = 0; t <= len; t += 8) {
      const px = lerp(x0, x1, t / len), pz = lerp(z0, z1, t / len);
      prop('box', px, y / 2, pz, .4, y, .4, [.05, .05, .05]);
    }
  };

  // Tall stack with banded warning lights and an optional plume.

  const stack = (x, z, rad, h, st, r, smoke) => {
    prop('cyl', x, h / 2, z, rad * 2, h, rad * 2, metal(st, r, .09));
    for (let y = h * .55; y < h; y += h * .22) put(GLOWS.ring, x, y, z, rad * 2.15, 1, rad * 2.15, 0, 0, [1.4, .12, .06]);
    glow(x, h + .2, z, rad * 2.1, .4, rad * 2.1, [1.2, .45, .1]);
    beacon(x, h + 1, z, r);
    if (smoke) plume(x, h, z, rad * 1.1, 3 + Math.floor(r() * 2), r, [.09, .07, .06]);
  };

  return {
    warehouse(x, z, s, st, b, r) {
      const [W, D] = dims(s), w = W - 2, d = D * (.55 + .35 * r()), h = 7 + r() * 8;
      slab(x, z, W, D);
      bld(x, z - (D - d) / 2, w, d, h, st, r, { lit: st.lit * .4 });
      const fz = z - (D - d) / 2 + d / 2;
      for (let k = Math.floor(w / 7); k > 0; k--) {
        const dx = x + (k / (Math.floor(w / 7) + 1) - .5) * w;
        prop('box', dx, 2, fz + .1, 4, 4, .2, [.05, .045, .04]);
        if (r() < .6) glow(dx, 4.6, fz + .4, .8, .2, .4, lamp(st));
        if (r() < .3) prop('box', dx, 1.6, fz + 6, 2.4, 2.6, 7, pick(r, RUST));
      }
      for (let k = Math.floor(r() * 3); k > 0; k--) {
        const cx = x + (r() - .5) * (w - 4), cz = z + (r() - .5) * (d - 4), ch = h + 14 + r() * 22;
        prop('cyl', cx, ch / 2, cz, 2.6, ch, 2.6, [.09, .07, .06]);
        glow(cx, ch + .3, cz, 2.8, .5, 2.8, [1.6, .6, .12]);
      }
      if (r() < .5) sign(x, z, w, d, h, st, r, BDC.signs[Math.floor(r() * 3)], { face: 2, blade: false, sw: Math.min(10, w * .5), sh: 1.6, y: h - 2 });
    },

    cargo(x, z, s, st, b, r) {
      const [W, D] = dims(s), CC = [[.22, .06, .04], [.05, .1, .2], [.18, .14, .04], [.05, .14, .08], [.14, .14, .14]];
      const cols = Math.max(1, Math.floor((W - 4) / 7)), rows = Math.max(1, Math.floor((D - 4) / 5));
      slab(x, z, W, D);
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        if (r() < .2) continue;
        const stack = 1 + Math.floor(r() * 3);
        for (let k = 0; k < stack; k++) prop('box', x + (col - (cols - 1) / 2) * 7, 1.3 + k * 2.6, z + (row - (rows - 1) / 2) * 5, 6, 2.5, 2.4, CC[Math.floor(r() * CC.length)]);
      }
      const yel = [.32, .2, .03], ch = 16 + r() * 6, cw = W * .44, cd = Math.min(D * .45, 12);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) prop('box', x + dx * cw, ch / 2, z + dz * cd, 1, ch, 1, yel);
      for (const dz of [-1, 1]) prop('box', x, ch, z + dz * cd, cw * 2 + 1, 1.2, 1.2, yel);
      prop('box', x + (r() - .5) * cw, ch - 1.5, z, 3, 2, cd * 2 + 2, yel);
      glow(x + (r() - .5) * cw, ch - 2.7, z, 1.2, .2, 1.2, SODIUM);
      beacon(x + cw, ch + 1, z + cd, r);
    },

    // Tank farm, pipe rack, cracking column and a flare stack.

    refinery(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      slab(x, z, W, D);
      const rad = 3 + r() * 3, nx = Math.max(1, Math.floor(W * .6 / (rad * 2.4))), nz = Math.max(1, Math.floor(D * .6 / (rad * 2.4)));
      const tx0 = x - W / 2 + rad + 1, tz0 = z - D / 2 + rad + 1, tint = metal(st, r, .14);
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) if (r() < .85) tank(tx0 + i * rad * 2.4, tz0 + j * rad * 2.4, rad * (.8 + .2 * r()), rad * (.8 + .5 * r()), tint, st, r);
      const rack = 5 + r() * 3, px = x + W * .22;
      for (let k = 0; k < 3; k++) pipe(px + k * .9, z - D / 2 + 1, px + k * .9, z + D / 2 - 1, rack + k * .3, .7, [.12, .09, .07]);
      pipe(x - W / 2 + 1, z + D * .3, px, z + D * .3, rack, .8, [.12, .09, .07]);
      const ch = (20 + r() * 25) * b, cx = x + W * .32, cz = z - D * .2;
      prop('cyl', cx, ch / 2, cz, 3, ch, 3, metal(st, r, .12));
      prop('lattice', cx, ch / 2, cz, 5, ch, 5);
      for (let y = 6; y < ch; y += 7) glow(cx, y, cz + 2.6, 2.4, .25, .3, SODIUM);
      const fh = ch + 6 + r() * 12, fx = x + W * .4, fz = z + D * .4;
      prop('cyl', fx, fh / 2, fz, .8, fh, .8, [.08, .07, .06]);
      for (let y = 8; y < fh; y += 12) prop('box', fx, y, fz, 2.4, .2, .2, [.08, .07, .06]);
      flickerGlow(fx, fh + 1.6, fz, 1.2, 3.2, 1.2, FLAME, r);
      beacon(cx, ch + .8, cz, r);
      pins(x, z, W * .8, D * .8, 2, ch * .6, 6 + Math.floor(r() * 8), r, SODIUM);
    },

    // Hyperbolic cooling towers built from stacked rings, with steam.

    cooling(x, z, s, st, b, r) {
      const [W, D] = dims(s), n = W * D > 900 ? 2 + Math.floor(r() * 2) : 1;
      const R = Math.min(W / n, D) * .42, along = W >= D;
      slab(x, z, W, D);
      for (let k = 0; k < n; k++) {
        const o = (k - (n - 1) / 2) * (along ? W : D) / n, tx = x + (along ? o : 0), tz = z + (along ? 0 : o);
        const h = R * (2.2 + r() * .6) * Math.min(1.3, b + .3), rr = R * (.95 + .1 * r()), c = [.2, .19, .18].map(v => v * (.8 + .4 * r()));
        const N = 9;
        for (let i = 0; i < N; i++) {
          const t = (i + .5) / N, w = rr * (.62 + .38 * Math.abs(t - .7) ** 1.3 / .7 ** 1.3);
          prop('cyl', tx, t * h, tz, w * 2, h / N + .05, w * 2, c.map(v => v * (.8 + .3 * t)));
        }
        put(GLOWS.ring, tx, h, tz, rr * 1.6, 1, rr * 1.6, 0, 0, [.5, .2, .06]);
        beacon(tx + rr * .78, h + .6, tz, r);
        if (r() < .85) plume(tx, h, tz, rr * .55, 3, r, st.w > .5 ? [.09, .1, .12] : [.13, .1, .08]);
        for (let a = 0; a < 6; a++) glow(tx + Math.cos(a) * rr, 1.5, tz + Math.sin(a) * rr, .6, .3, .6, SODIUM);
      }
    },

    // Reactor dome, turbine hall, stack and a transformer yard.

    reactor(x, z, s, st, b, r) {
      const [W, D] = dims(s), R = Math.min(W, D) * .26, dx = x - W * .22, dz = z - D * .15;
      slab(x, z, W, D);
      const wall = R * (.8 + r() * .4), c = metal(st, r, .2);
      prop('cyl', dx, wall / 2, dz, R * 2, wall, R * 2, c);
      prop('dish', dx, wall + R * .9, dz, R * 2, R * 4.5, R * 2, c, 0, Math.PI);
      put(GLOWS.ring, dx, wall, dz, R * 2.05, 1, R * 2.05, 0, 0, st.w > .5 ? [.3, .9, 1.3] : [1.2, .45, .1]);
      beacon(dx, wall + R * .9 + .6, dz, r);
      const hw = W * .4, hd = D * .3;
      bld(x + W * .25, z - D * .2, hw, hd, 9 + r() * 6, st, r, { lit: st.lit * .3, roof: false });
      stack(x + W * .38, z + D * .3, 1.2 + r() * .6, (32 + r() * 20) * b, st, r, r() < .6);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
        const px = x - W * .4 + i * W * .1, pz = z + D * .3 + j * 4;
        prop('box', px, 1.2, pz, 2, 2.4, 2, [.07, .07, .08]);
        if (r() < .3) glow(px, 2.6, pz, .3, .3, .3, [1.8, .1, .05]);
      }
      for (const lx of [-.42, -.08]) prop('lattice', x + W * lx, 7, z + D * .42, 2.4, 14, 2.4);
    },

    // Row of smokestacks over a long, low works hall.

    stacks(x, z, s, st, b, r) {
      const [W, D] = dims(s), along = W >= D, L = along ? W : D, Sd = along ? D : W;
      slab(x, z, W, D);
      const hh = 8 + r() * 6;
      bld(x, z, along ? L - 2 : Sd * .5, along ? Sd * .5 : L - 2, hh, st, r, { lit: st.lit * .5 });
      const n = Math.max(2, Math.min(6, Math.floor(L / 8))), h = (30 + r() * 25) * b;
      for (let k = 0; k < n; k++) {
        const o = (k - (n - 1) / 2) * (L - 6) / n, off = Sd * .32;
        stack(x + (along ? o : off), z + (along ? off : o), 1 + r() * .6, h * (.85 + .3 * r()), st, r, r() < .7);
      }
      for (let k = 0; k < 4; k++) glow(x + (r() - .5) * W * .8, hh * .4, z + (r() - .5) * D * .8, 1.4, .6, .1, [1.6, .5, .1]);
    },

    // Conveyor gantries running from ore heaps to hoppers.

    gantry(x, z, s, st, b, r) {
      const [W, D] = dims(s), yel = [.28, .18, .04];
      slab(x, z, W, D, [.04, .035, .03]);
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) {
        const hr = 4 + r() * 5;
        prop('cone', x - W * .25 + (r() - .5) * W * .4, hr * .4, z + (r() - .5) * D * .7, hr * 2.4, hr * .8, hr * 2.4, pick(r, [[.08, .06, .045], [.05, .05, .055], [.1, .05, .03]]));
      }
      const hx = x + W * .32, hz = z + (r() - .5) * D * .3, hy = 12 + r() * 8;
      prop('box', hx, hy / 2, hz, 5, hy, 5, metal(st, r, .12));
      prop('cone', hx, hy + 3, hz, 7, 6, 7, metal(st, r, .14), 0, Math.PI);
      for (let k = 0; k < 2; k++) {
        const ax = x - W * .45, az = z + (k - .5) * D * .5, len = Math.hypot(hx - ax, hz - az);
        const ry = Math.atan2(hx - ax, hz - az), slope = Math.atan2(hy + 4, len);
        prop('box', (ax + hx) / 2, (hy + 4) / 2, (az + hz) / 2, 1.6, .9, Math.hypot(len, hy + 4), yel, ry, -slope);
        for (let t = .25; t < 1; t += .25) {
          const px = lerp(ax, hx, t), pz = lerp(az, hz, t), py = (hy + 4) * t;
          prop('box', px, py / 2, pz, .5, py, .5, [.06, .05, .04]);
          glow(px, py - .7, pz, .5, .15, .5, SODIUM);
        }
      }
      beacon(hx, hy + 6.6, hz, r);
    },

    // Rabotgorod depot: open racks of dormant bioroids in faint lit pods.

    depot(x, z, s, st, b, r) {
      const [W, D] = dims(s), ph = 3.2, levels = 2 + Math.floor(r() * 3), roofY = levels * ph + 1.5;
      const pod = r() < .5 ? [.18, .55, .7] : [.7, .5, .2];
      slab(x, z, W, D);
      for (let rz = -(D - 6) / 2; rz <= (D - 6) / 2; rz += 3) prop('box', x, roofY + .3, z + rz, W - 2, .4, .5, metal(st, r, .08));
      for (const sx of [-1, 1]) prop('box', x + sx * (W / 2 - 1.5), roofY + .3, z, .6, .6, D - 6, metal(st, r, .08));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) prop('box', x + sx * (W / 2 - 1.5), roofY / 2, z + sz * (D / 2 - 3.5), .8, roofY, .8, [.06, .06, .07]);
      const rows = Math.max(1, Math.floor((D - 8) / 4)), per = Math.floor((W - 6) / 1.4);
      for (let i = 0; i < rows; i++) {
        const rz = z - (D - 8) / 2 + (i + .5) * (D - 8) / rows;
        prop('box', x, levels * ph / 2, rz, W - 5, levels * ph, .8, [.05, .05, .06]);
        for (let l = 0; l < levels; l++) for (let k = 0; k < per; k++) {
          if (r() < .25) continue;
          const v = .4 + .6 * r();
          glow(x - (W - 6) / 2 + (k + .5) * (W - 6) / per, l * ph + 1.6, rz + .6, .7, 2.2, .4, pod.map(c => c * v));
        }
      }
      glow(x, roofY - .4, z + D / 2 - 3, W * .5, .25, .25, [1.4, 1.2, .9]);
      if (r() < .6) sign(x, z, W - 2, D - 6, roofY, st, r, [.3, 1.1, 1.5], { face: 2, blade: false, sw: Math.min(12, W * .4), sh: 1.6, y: roofY + 2 });
      beacon(x - W / 2 + 1.5, roofY + 1, z - D / 2 + 3.5, r);
    },

    // Scrapyard: heaps of crushed hulls, a magnet crane, burn barrels.

    scrapyard(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      slab(x, z, W, D, [.04, .033, .028]);
      for (let k = Math.floor(W * D / 60); k > 0; k--) {
        const px = x + (r() - .5) * (W - 3), pz = z + (r() - .5) * (D - 3), hr = 2 + r() * 4;
        if (r() < .4) prop('cone', px, hr * .4, pz, hr * 2.6, hr * .8, hr * 2.6, pick(r, RUST));
        else prop('box', px, .4 + r() * hr * .6, pz, 1.5 + r() * 3, .8 + r() * 1.4, 1.5 + r() * 4, pick(r, RUST), r() * 3, (r() - .5) * .8);
      }
      const ch = 14 + r() * 10, cx = x + (r() - .5) * W * .4, cz = z + (r() - .5) * D * .4, arm = Math.min(W, D) * .4, ry = r() * 6.28;
      prop('lattice', cx, ch / 2, cz, 2.6, ch, 2.6);
      prop('box', cx + Math.sin(ry) * arm / 2, ch, cz + Math.cos(ry) * arm / 2, .8, .8, arm, [.3, .16, .03], ry);
      const mx = cx + Math.sin(ry) * arm, mz = cz + Math.cos(ry) * arm;
      prop('box', mx, ch * .6, mz, .1, ch * .8, .1, [.1, .1, .1]);
      prop('cyl', mx, ch * .2, mz, 3, .8, 3, [.09, .08, .07]);
      beacon(cx, ch + 1, cz, r);
      for (let k = 1 + Math.floor(r() * 3); k > 0; k--) {
        const bx = x + (r() - .5) * W * .8, bz = z + (r() - .5) * D * .8;
        prop('cyl', bx, .5, bz, .8, 1, .8, [.1, .05, .03]);
        flickerGlow(bx, 1.4, bz, .7, .8, .7, FLAME, r);
      }
      for (const sz of [-1, 1]) prop('box', x, 1.2, z + sz * D / 2, W, 2.4, .1, [.07, .065, .06]);
    },

    // Desalination plant: settling basins, membrane hall, round clarifiers.

    desal(x, z, s, st, b, r) {
      const [W, D] = dims(s), water = [.006, .03, .035];
      slab(x, z, W, D);
      const nb = Math.max(2, Math.floor(W * .55 / 7));
      for (let k = 0; k < nb; k++) {
        const bx = x - W / 2 + 4 + k * 7;
        prop('box', bx, .7, z - D * .15, 6.2, 1.4, D * .6, [.08, .08, .085]);
        glow(bx, 1.42, z - D * .15, 5.4, .02, D * .6 - .8, water);
      }
      const cr = Math.min(W * .2, D * .22);
      for (let k = 0; k < 2; k++) {
        const cx = x + W * .3, cz = z + (k - .5) * D * .46;
        prop('cyl', cx, .9, cz, cr * 2, 1.8, cr * 2, [.09, .09, .1]);
        put(GLOWS.ring, cx, 1.85, cz, cr * 1.8, 1, cr * 1.8, 0, 0, [.15, .5, .55]);
        prop('box', cx, 2.3, cz, cr * 2, .5, .6, [.2, .14, .04], r() * 3);
      }
      bld(x - W * .1, z + D * .36, W * .5, D * .22, 6 + r() * 4, st, r, { lit: st.lit * .5 });
      for (let k = 0; k < 3; k++) pipe(x - W / 2 + 1, z + D * .2 + k * 1.2, x + W * .3, z + D * .2 + k * 1.2, 2.5 + k * .4, .8, [.06, .12, .14]);
      pins(x, z, W * .8, D * .8, 1, 3, 6, r, [.4, .9, 1.0]);
    },

    // Chemical vats: domed tanks, catwalks, toxic green leaks, hazard lights.

    vats(x, z, s, st, b, r) {
      const [W, D] = dims(s), rad = 2.5 + r() * 2.5, step = rad * 2.6;
      slab(x, z, W, D, [.035, .04, .03]);
      const nx = Math.max(1, Math.floor((W - 2) / step)), nz = Math.max(1, Math.floor((D - 2) / step));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        if (r() < .15) continue;
        const vx = x + (i - (nx - 1) / 2) * step, vz = z + (j - (nz - 1) / 2) * step, h = rad * (1.6 + r() * 1.4);
        const c = pick(r, [[.17, .18, .1], [.2, .13, .08], [.14, .15, .17]]);
        prop('cyl', vx, h / 2 + 1.5, vz, rad * 2, h, rad * 2, c);
        prop('dish', vx, h + 1.5 + rad * .5, vz, rad * 2, rad * 2.5, rad * 2, c, 0, Math.PI);
        for (const lx of [-1, 1]) prop('box', vx + lx * rad * .6, .75, vz, .4, 1.5, .4, [.05, .05, .05]);
        if (r() < .4) put(GLOWS.ring, vx, h * .5 + 1.5, vz, rad * 2.1, 1, rad * 2.1, 0, 0, TOXIC.map(v => v * .7));
        if (r() < .2) glow(vx + (r() - .5) * rad, .22, vz + rad + 1, 2 + r() * 2, .04, 1.5 + r(), TOXIC.map(v => v * .12));
      }
      const cy = rad * 3.6;
      prop('box', x, cy, z, (nx - 1) * step + 2, .3, 1.4, [.2, .13, .04]);
      for (let k = 0; k < 3; k++) glow(x + (r() - .5) * W * .7, cy + .8, z, .4, .4, .4, [1.9, .12, .05]);
      for (let k = 0; k < nx; k++) glow(x + (k - (nx - 1) / 2) * step, cy - .3, z + .8, 1, .15, .3, SODIUM);
      pins(x, z, W * .8, D * .8, 1, cy, 4 + Math.floor(r() * 5), r, SODIUM);
    },

    // Data centre: blank hall, roof fan grid, warm exhaust shimmer.

    datacentre(x, z, s, st, b, r) {
      const [W, D] = dims(s), h = 10 + r() * 8, w = W - 3, d = D - 3;
      slab(x, z, W, D);
      bld(x, z, w, d, h, st, r, { lit: 0, roof: false, skin: H.SKINS.sparse });
      const fx = Math.max(1, Math.floor((w - 2) / 4.5)), fz = Math.max(1, Math.floor((d - 2) / 4.5));
      for (let i = 0; i < fx; i++) for (let j = 0; j < fz; j++) {
        const px = x + (i - (fx - 1) / 2) * 4.5, pz = z + (j - (fz - 1) / 2) * 4.5;
        prop('cyl', px, h + .5, pz, 3.4, 1, 3.4, [.06, .065, .07]);
        glow(px, h + 1.05, pz, 2.2, .05, 2.2, [.35, .12, .04]);
      }
      const accent = st.w > .5 ? [.3, 1.2, 1.6] : [.25, .9, .5];
      glow(x, h * .3, z + d / 2 + .05, w * .9, .2, .1, accent);
      glow(x, h * .3, z - d / 2 - .05, w * .9, .2, .1, accent);
      for (let k = 1 + Math.floor(r() * 2); k > 0; k--) plume(x + (r() - .5) * w * .6, h + 1, z + (r() - .5) * d * .6, 1.6, 3, r, [.1, .05, .03]);
      for (let k = 0; k < 4; k++) prop('box', x + (k - 1.5) * w * .22, 1.4, z + d / 2 + 2.5, 3, 2.8, 2.2, [.08, .08, .09]);
      pins(x, z, w, d, h + .2, h + .3, 4, r, [1.6, .1, .05]);
    },

    // Freight rail yard: parallel sidings, wagon strings, signals, light masts.

    rail(x, z, s, st, b, r) {
      const [W, D] = dims(s), along = W >= D, L = (along ? W : D) - 2, Sd = along ? D : W;
      slab(x, z, W, D, [.032, .03, .03]);
      const n = Math.max(2, Math.floor((Sd - 2) / 4.5)), ry = along ? Math.PI / 2 : 0;
      const at = (u, v) => along ? [x + u, z + v] : [x + v, z + u];
      for (let i = 0; i < n; i++) {
        const v = (i - (n - 1) / 2) * 4.5, [tx, tz] = at(0, v);
        prop('box', tx, .25, tz, along ? L : 1.6, .1, along ? 1.6 : L, [.07, .06, .05]);
        let u = -L / 2 + r() * 6;
        while (u < L / 2 - 8 && r() < .9) {
          const len = 12 + r() * 4, tanker = r() < .3, [cx, cz] = at(u + len / 2, v);
          if (tanker) prop('cyl', cx, 2, cz, 2.6, len, 2.6, pick(r, [[.12, .12, .13], [.05, .05, .06]]), ry, Math.PI / 2);
          else prop('box', cx, 2, cz, along ? len : 2.8, 3, along ? 2.8 : len, pick(r, RUST));
          u += len + .8;
          if (r() < .25) u += 10 + r() * 20;
        }
        const [sx, sz] = at(L / 2 - 1, v + 1.8);
        prop('box', sx, 2, sz, .2, 4, .2, [.05, .05, .05]);
        glow(sx, 4.1, sz, .35, .35, .35, r() < .6 ? [2, .1, .05] : [.2, 1.6, .5]);
      }
      for (const u of [-L * .3, L * .3]) {
        const [mx, mz] = at(u, Sd / 2 - 1);
        prop('box', mx, 9, mz, .5, 18, .5, [.06, .06, .06]);
        glow(mx, 18.2, mz, 2.4, .4, .6, SODIUM);
      }
      const [bx, bz] = at(-L / 2 + 1, 0);
      if (r() < .6) beacon(bx, 4, bz, r);
    },
  };
}

// Extra kit names per district style and density tier (0 = low). Base kits already use these names.

export const tiers = {
  bdc: {
    0: ['refinery', 'cooling', 'stacks', 'gantry', 'scrapyard', 'vats', 'rail', 'desal'],
    1: ['depot', 'datacentre', 'reactor', 'stacks'],
  },
  rut: { 0: ['datacentre', 'depot', 'reactor'] },
};
