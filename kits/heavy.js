// Block-scale heavy industry for Base de Cayambe. Each builder fills a whole city block with one plant.
// Signature: build(x, z, w, d, st, r) in the block frame. w runs along local x, d along local z.

export function kits(H) { return {}; }

export function blocks(H) {
  const { BDC, GLOWS, SKINS, beacon, bld, flickerGlow, glow, lerp, prop, put, sign } = H;

  const SODIUM = [1.3, .6, .15], FLAME = [2.6, 1.0, .2], RED = [1.4, .12, .06], MOLTEN = [2.4, .8, .15];
  const DARK = [.05, .05, .05], CONCRETE = [.11, .105, .1], YEL = [.3, .2, .04];
  const RUST = [[.16, .07, .04], [.12, .09, .06], [.09, .09, .1], [.18, .12, .05], [.06, .07, .08]];
  const BOXES = [[.22, .06, .04], [.05, .1, .2], [.18, .14, .04], [.05, .14, .08], [.14, .14, .14], [.2, .1, .03], [.08, .08, .1]];
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const metal = (r, v = .1) => { const g = v * (.7 + .6 * r()); return [g * 1.15, g, g * .9]; };
  const dim = (rgb, f) => rgb.map(c => c * f);

  // Ground slab, perimeter fence with work lights, and corner light masts.

  const site = (x, z, w, d, r, rgb = [.03, .028, .027]) => {
    prop('box', x, .1, z, w, .2, d, rgb);
    for (const s of [-1, 1]) {
      prop('box', x, 1.2, z + s * d / 2, w, 2.4, .1, [.07, .065, .06]);
      prop('box', x + s * w / 2, 1.2, z, .1, 2.4, d, [.07, .065, .06]);
    }
    for (let t = -w / 2 + 10; t < w / 2; t += 22) for (const s of [-1, 1]) glow(x + t, 2.8, z + s * d / 2, .3, .2, .3, dim(SODIUM, .7));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (r() < .7) mast(x + sx * (w / 2 - 2), z + sz * (d / 2 - 2), 22 + r() * 14);
  };

  const mast = (x, z, h) => {
    prop('box', x, h / 2, z, .5, h, .5, DARK);
    prop('box', x, h, z, 3.4, .3, .6, DARK);
    glow(x, h - .4, z, 3, .4, .8, SODIUM);
  };

  // Smoke or steam plume: puffs rise, swell, drift downwind and fade.

  const plume = (x, y, z, rad, n, r, rgb) => {
    const wx = .5 + r() * .5, wz = (r() - .5) * .6;
    for (let k = 0; k < n; k++) {
      const t = k / n, sz = rad * (1 + k * .6), f = .7 * (1 - t) ** 1.5;
      put(GLOWS.sphere, x + wx * k * rad * 1.2, y + rad * .6 + k * rad * 1.1, z + wz * k * rad * 1.2, sz, sz * .7, sz, 0, 0, dim(rgb, f));
    }
  };

  // Pipe between two points at one height. Posts are optional because racks carry their own.

  const pipe = (x0, z0, x1, z1, y, dia, rgb, posts = true) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    prop('cyl', (x0 + x1) / 2, y, (z0 + z1) / 2, dia, len, dia, rgb, ry, Math.PI / 2);
    if (posts) for (let t = 4; t < len; t += 12) prop('box', lerp(x0, x1, t / len), y / 2, lerp(z0, z1, t / len), .5, y, .5, DARK);
  };

  // Straight beam between two 3D points.

  const strut = (x0, y0, z0, x1, y1, z1, t, rgb) => {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, lh = Math.hypot(dx, dz);
    prop('box', (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, t, t, Math.hypot(lh, dy), rgb, Math.atan2(dx, dz), -Math.atan2(dy, lh));
  };

  // Pipe rack: portal frames every 8 m carrying two tiers of pipes along x.

  const rack = (x, z, len, y, r) => {
    for (let t = -len / 2; t <= len / 2; t += 8) {
      for (const s of [-1, 1]) prop('box', x + t, y / 2, z + s * 2.5, .5, y, .5, DARK);
      prop('box', x + t, y, z, .5, .5, 5.5, DARK);
      prop('box', x + t, y - 2.5, z, .5, .4, 5.5, DARK);
    }
    for (let k = 0; k < 4; k++) prop('cyl', x, y + .7 - (k > 1 ? 2.5 : 0), z + (k % 2 - .5) * 2.4 + (k > 1 ? .6 : 0), .9, len, .9, pick(r, [[.13, .09, .06], [.1, .1, .11], [.16, .12, .05]]), Math.PI / 2, Math.PI / 2);
  };

  // Tall stack with red warning bands, a hot rim and a plume.

  const stack = (x, z, rad, h, r, smoke = .7, smokeRgb = [.05, .04, .035]) => {
    prop('cyl', x, h / 2, z, rad * 2, h, rad * 2, metal(r, .09));
    prop('cyl', x, h * .2, z, rad * 2.6, h * .4, rad * 2.6, metal(r, .08));
    for (let y = h * .5; y < h; y += h * .16) put(GLOWS.ring, x, y, z, rad * 2.2, 1, rad * 2.2, 0, 0, RED);
    glow(x, h + .2, z, rad * 2.1, .4, rad * 2.1, [1.2, .45, .1]);
    beacon(x, h + 1, z, r);
    if (r() < smoke) plume(x, h, z, rad * 1.1, 3, r, smokeRgb);
  };

  // Domed storage tank.

  const tank = (x, z, rad, h, rgb, r) => {
    prop('cyl', x, h / 2, z, rad * 2, h, rad * 2, rgb);
    prop('dish', x, h + rad * .2, z, rad * 2, rad, rad * 2, rgb, 0, Math.PI);
    put(GLOWS.ring, x, h * .98, z, rad * 2.02, 1, rad * 2.02, 0, 0, dim(SODIUM, .35));
    if (r() < .6) glow(x, h + .4, z + rad * .9, .6, .4, .6, SODIUM);
  };

  // Pressure sphere on legs, built from two dishes.

  const sphere = (x, z, R, rgb) => {
    const cy = R + 3;
    prop('dish', x, cy - R, z, R * 2, R * 5, R * 2, rgb);
    prop('dish', x, cy + R, z, R * 2, R * 5, R * 2, rgb, 0, Math.PI);
    for (const [sx, sz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) prop('box', x + sx * R * .8, cy / 2, z + sz * R * .8, .5, cy, .5, DARK);
    glow(x, cy + R + .3, z, .5, .4, .5, SODIUM);
  };

  // Process column with lit platforms.

  const column = (x, z, rad, h, r) => {
    prop('cyl', x, h / 2, z, rad * 2, h, rad * 2, metal(r, .13));
    prop('cone', x, h + rad * .5, z, rad * 2, rad, rad * 2, metal(r, .13));
    for (let y = 9 + r() * 4; y < h - 2; y += 9 + r() * 4) {
      prop('cyl', x, y, z, rad * 2 + 2, .3, rad * 2 + 2, DARK);
      put(GLOWS.ring, x, y + .4, z, rad * 2 + 1.8, 1, rad * 2 + 1.8, 0, 0, dim(SODIUM, .6));
    }
    beacon(x, h + rad + .6, z, r);
  };

  // Hyperbolic cooling tower stacked from rings.

  const cooler = (x, z, R, h, st, r) => {
    const N = 12, c = [.2, .19, .18].map(v => v * (.8 + .4 * r()));
    for (let i = 0; i < N; i++) {
      const t = (i + .5) / N, rr = R * (.62 + .38 * Math.abs(t - .7) ** 1.3 / .7 ** 1.3);
      prop('cyl', x, t * h, z, rr * 2, h / N + .05, rr * 2, c.map(v => v * (.75 + .35 * t)));
    }
    put(GLOWS.ring, x, h, z, R * 1.64, 1, R * 1.64, 0, 0, [.6, .25, .07]);
    put(GLOWS.ring, x, 2, z, R * 2.02, 1, R * 2.02, 0, 0, dim(SODIUM, .5));
    beacon(x + R * .8, h + .6, z, r);
    plume(x, h, z, R * .25, 3, r, [.06, .055, .05]);
  };

  // Truck: trailer and cab along heading ry, with tail lights.

  const truck = (x, z, ry, r) => {
    const sx = Math.sin(ry), sz = Math.cos(ry);
    prop('box', x, 2.1, z, 2.5, 3.6, 12.5, pick(r, BOXES), ry);
    prop('box', x + sx * 7.6, 1.7, z + sz * 7.6, 2.5, 2.8, 2.6, pick(r, RUST), ry);
    glow(x - sx * 6.3, 1, z - sz * 6.3, 2.2, .2, .1, [1.3, .06, .03]);
  };

  // Clad metal shed with a roof vent ridge and a faint clerestory strip on the long faces.

  const shed = (x, z, w, d, h, r, rgb = metal(r, .15)) => {
    prop('box', x, h / 2, z, w, h, d, rgb);
    prop('box', x, h + .5, z, w * .94, 1, Math.min(d * .25, 6), dim(rgb, .7));
    for (const s of [-1, 1]) glow(x, h * .82, z + s * (d / 2 + .05), w * .9, .45, .1, [.32, .22, .1]);
  };

  return {

    // Refinery: process units of tall columns, a pipe rack spine, pressure spheres and flare stacks.

    refinery: { zone: 'industry', build(x, z, w, d, st, r) {
      site(x, z, w, d, r);
      const sz = z + (r() - .5) * d * .15;
      rack(x, sz, w - 8, 7 + r() * 3, r);
      const units = Math.max(1, Math.floor(w / 36));
      let tallest = null;
      for (let u = 0; u < units; u++) {
        const ux = x - w / 2 + (u + .5) * w / units, uz = sz - d * .3;
        for (let k = 2 + Math.floor(r() * 3); k > 0; k--) {
          const cx = ux + (r() - .5) * w / units * .6, cz = uz + (r() - .5) * d * .2, h = 30 + r() * 45, rad = 1.6 + r() * 2.2;
          column(cx, cz, rad, h, r);
          pipe(cx, cz + rad, cx, sz - 2.5, 6 + r() * 3, .6, [.12, .09, .07], false);
          if (!tallest || h > tallest[2]) tallest = [cx, cz, h];
        }
        const hx = ux + (r() - .5) * 6, hz = sz - 7;
        shed(hx, hz, 12, 6, 12 + r() * 6, r);
        for (let k = 0; k < 3; k++) glow(hx + (k - 1) * 3.6, 1.6, hz + 3.05, 2.4, .9, .1, MOLTEN);
        stack(hx + 4, hz, 1.1, 40 + r() * 20, r, .5);
      }
      prop('lattice', tallest[0], tallest[2] / 2, tallest[1], 9, tallest[2], 9);
      if (r() < .6) plume(tallest[0], tallest[2], tallest[1], 3, 4, r, [.06, .055, .05]);

      // Spheres and day tanks south of the rack.

      const n = Math.max(2, Math.floor(w * .55 / 15)), R = 5 + r() * 2.5, tint = metal(r, .2);
      for (let k = 0; k < n; k++) sphere(x - w / 2 + 10 + k * 15, sz + d * .22, R, tint);
      const tr = 5 + r() * 3;
      for (let k = 0; k < Math.floor(w * .45 / (tr * 2.6)); k++) tank(x + w / 2 - tr - 4 - k * tr * 2.6, sz + d * .36, tr, tr * 1.4, metal(r, .14), r);

      // Flare stacks on guyed towers.

      for (let k = 0; k < 1 + Math.floor(r() * 2); k++) {
        const fx = x - w / 2 + 6 + k * 10, fz = z + d / 2 - 6, fh = 90 + r() * 40;
        prop('cyl', fx, fh / 2, fz, 1.4, fh, 1.4, [.08, .07, .06]);
        for (let y = 20; y < fh; y += 22) prop('box', fx, y, fz, 4, .3, .3, DARK);
        flickerGlow(fx, fh + 3, fz, 2.2, 6, 2.2, FLAME, r);
        beacon(fx, fh - 4, fz + 1, r);
      }
    } },

    // Tank farm: big floating-roof tanks in bunds, pipe manifolds and a pump house.

    tankfarm: { zone: 'industry', build(x, z, w, d, st, r) {
      site(x, z, w, d, r, [.035, .03, .027]);
      const R = Math.min(9 + r() * 7, Math.min(w, d) * .2), step = R * 2.6;
      const nx = Math.max(1, Math.floor((w - 6) / step)), nz = Math.max(1, Math.floor((d - 14) / step));
      const tint = pick(r, [[.2, .19, .18], [.16, .15, .13], [.18, .12, .08]]);
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        if (r() < .1 || (i === nx - 1 && j === 0 && nx > 1)) continue;
        const tx = x + (i - (nx - 1) / 2) * step, tz = z - 4 + (j - (nz - 1) / 2) * step;
        const rad = R * (.75 + .25 * r()), h = rad * (1.1 + r() * .7);
        tank(tx, tz, rad, h, tint.map(v => v * (.8 + .4 * r())), r);
        prop('box', tx + rad * .7, h / 2, tz + rad * .7, .8, h * 1.12, 1.2, DARK, Math.PI / 4, .5);
        const b = step * .48;
        for (const s of [-1, 1]) {
          prop('box', tx, .8, tz + s * b, step * .96, 1.6, .6, CONCRETE);
          prop('box', tx + s * b, .8, tz, .6, 1.6, step * .96, CONCRETE);
        }
      }

      // Manifold along the front edge, a pump house and a vapour stack.

      rack(x, z + d / 2 - 6, w - 8, 5, r);
      const px = x + (nx - 1) / 2 * step, pz = z - 4 - (nz - 1) / 2 * step;
      if (nx > 1) {
        shed(px, pz, step * .7, step * .4, 9, r);
        stack(px + step * .3, pz + step * .3, 1.2, 55 + r() * 25, r, .4);
      }
      for (let k = 0; k < 2; k++) mast(x + (k - .5) * w * .5, z + d / 2 - 2, 36 + r() * 10);
    } },

    // Fulfilment hub: one vast shed, a high-bay storage tower, loading docks and parked trucks.

    fulfilment: { zone: 'industry', build(x, z, w, d, st, r) {
      site(x, z, w, d, r, [.04, .038, .036]);
      const sw = w - 8, sd = d * (.42 + r() * .12), h = 18 + r() * 10, sz = z - d / 2 + 4 + sd / 2;
      shed(x, sz, sw, sd, h, r);
      for (let t = -sw / 2 + 6; t < sw / 2 - 3; t += 9) glow(x + t, h + .1, sz, 1.4, .12, sd - 6, [.08, .1, .12]);
      for (let k = Math.floor(sw * sd / 300); k > 0; k--) prop('box', x + (r() - .5) * (sw - 6), h + 1, sz + (r() - .5) * (sd - 6), 3 + r() * 3, 2, 2 + r() * 2, metal(r, .14));

      // High-bay tower on one end with a lit lift strip.

      const tw = Math.min(26, sw * .3), th = 45 + r() * 30, side = r() < .5 ? -1 : 1, tx = x + side * (sw - tw) / 2;
      bld(tx, sz, tw, sd * .8, th, st, r, { lit: st.lit * .15, roof: false, skin: SKINS.bands });
      glow(tx - side * tw / 2 - .1, th / 2, sz + sd * .4 - 3, .3, th - 4, 1.4, [.3, .75, .9]);
      beacon(tx, th + 1, sz, r);
      sign(tx, sz, tw, sd * .8, th, st, r, pick(r, BDC.signs), { face: 2, blade: false, sw: tw * .8, sh: 4, y: th - 5 });

      // Docks on the yard face: doors, a canopy, and trucks backed up to most of them.

      const fz = sz + sd / 2, n = Math.floor((sw - (tw + 4)) / 5);
      const dx0 = x - side * tw / 2 - (n - 1) * 2.5;
      prop('box', x - side * tw / 2, 5.6, fz + 2, n * 5, .4, 4, DARK);
      for (let k = 0; k < n; k++) {
        const dx = dx0 + k * 5;
        glow(dx, 2.3, fz + .1, 3.4, 3.4, .1, r() < .7 ? [.55, .42, .25] : [.08, .07, .06]);
        if (r() < .6) truck(dx, fz + 6.5, 0, r);
      }

      // Trailer parking along the far edge.

      if (z + d / 2 - 17 > fz + 14) for (let t = -w / 2 + 6; t < w / 2 - 4; t += 4) if (r() < .55) truck(x + t, z + d / 2 - 10, 0, r);
      for (let k = 0; k < 3; k++) mast(x + (k - 1) * w * .32, (fz + 13 + z + d / 2) / 2, 18 + r() * 6);
    } },

    // Steel mill: blast furnace with hot stoves, a melt shop with glowing mouths, a rolling mill and stacks.

    steelmill: { zone: 'industry', build(x, z, w, d, st, r) {
      site(x, z, w, d, r, [.035, .03, .028]);
      const fx = x - w * .25, fz = z - d * .18, R = Math.min(8, Math.min(w, d) * .1), fh = 45 + r() * 20;
      prop('cyl', fx, fh * .35, fz, R * 2, fh * .7, R * 2, metal(r, .12));
      prop('cyl', fx, fh * .78, fz, R * 1.5, fh * .16, R * 1.5, metal(r, .12));
      prop('cone', fx, fh * .9, fz, R * 1.5, fh * .08, R * 1.5, metal(r, .12));
      prop('lattice', fx, fh / 2 + 4, fz, R * 3, fh + 8, R * 3);
      for (const s of [-1, 1]) prop('cyl', fx + s * R * .9, fh * .6, fz + R * 1.4, 1.6, fh * .6, 1.6, [.12, .1, .08], 0, s * .25);
      shed(fx, fz + R + 6, R * 3.4, 12, 12, r);
      for (let k = 0; k < 3; k++) glow(fx + (k - 1) * R, 3, fz + R + 12.1, 3, 3.5, .1, MOLTEN);
      glow(fx + R * 2.2, .25, fz + R + 15, 8, .05, 4, [.9, .3, .05]);

      // Hot stoves in a row beside the furnace.

      for (let k = 0; k < 3 + Math.floor(r() * 2); k++) {
        const hx = fx - R - 5 - k * 8.5, hz = fz - R * .5, hh = fh * (.7 + .15 * r());
        if (hx < x - w / 2 + 4) break;
        prop('cyl', hx, hh / 2, hz, 7, hh, 7, metal(r, .1));
        prop('dish', hx, hh + 3.5, hz, 7, 17.5, 7, metal(r, .1), 0, Math.PI);
        put(GLOWS.ring, hx, hh * .3, hz, 7.2, 1, 7.2, 0, 0, dim(SODIUM, .5));
      }

      // Skip bridge from the stockyard to the furnace top.

      const sx0 = fx + w * .2, sz0 = z - d / 2 + 8, rise = fh * .9;
      strut(sx0, 0, sz0, fx, rise, fz, 2, YEL);
      for (let k = 0; k < 4; k++) prop('cone', sx0 + (k - 1.5) * 12, 3, sz0 + (r() - .5) * 4, 11, 6, 11, pick(r, [[.06, .05, .045], [.1, .05, .03], [.04, .04, .045]]));

      // Melt shop: a tall shed with a roof monitor and molten light spilling from high openings.

      const mw = w * .42, md = d * .32, mh = 32 + r() * 16, mx = x + w * .22, mz = z - d * .12;
      shed(mx, mz, mw, md, mh, r);
      prop('box', mx, mh + 2.5, mz, mw * .9, 5, md * .3, [.07, .06, .055]);
      for (let t = -mw / 2 + 5; t < mw / 2 - 3; t += 8) glow(mx + t, mh * (.45 + .3 * r()), mz + md / 2 + .1, 3.5, 3 + r() * 4, .1, r() < .5 ? MOLTEN : [1.3, .45, .1]);
      glow(mx, mh + 2.6, mz + md * .15 + .1, mw * .85, 1.4, .1, [1.0, .35, .08]);
      plume(mx, mh + 5, mz, 4, 4, r, [.11, .05, .02]);

      // Rolling mill along the front edge and a row of stacks.

      const rz = z + d / 2 - d * .12, rh = 14 + r() * 4;
      shed(x, rz, w - 10, d * .14, rh, r);
      for (let t = -w / 2 + 10; t < w / 2 - 8; t += 7) glow(x + t, rh * .6, rz - d * .07 - .1, 4, .5, .1, [1.1, .4, .1]);
      for (let k = 0; k < 2 + Math.floor(r() * 2); k++) stack(x + w * .3 + k * 8, z + d * .14, 1.6, 80 + r() * 30, r, .8, [.06, .045, .035]);

      // Torpedo cars on the hot-metal line.

      for (let k = 0; k < 3; k++) {
        const tx = fx + R * 2 + 8 + k * 10, tz = fz + R + 20;
        prop('cyl', tx, 2, tz, 3, 8, 3, [.1, .09, .08], Math.PI / 2, Math.PI / 2);
        if (r() < .5) glow(tx, 3.6, tz, 1.4, .2, 1.4, MOLTEN);
      }
    } },

    // Container yard: colourful stacks in bays, rail gantries over the bays and a tall quay crane.

    containeryard: { zone: 'industry', build(x, z, w, d, st, r) {
      site(x, z, w, d, r, [.04, .04, .042]);
      const bayD = 6 * 2.7, lane = 9, nb = Math.max(1, Math.floor((d - 14) / (bayD + lane)));
      const nx = Math.max(1, Math.floor((w - 30) / 12.8)), x0 = x - w / 2 + 24;
      for (let b = 0; b < nb; b++) {
        const bz = z - d / 2 + 10 + lane / 2 + b * (bayD + lane) + bayD / 2, tall = 2 + r() * 3;
        for (let i = 0; i < nx; i++) for (let j = 0; j < 6; j++) {
          if (r() < .12) continue;
          const k = Math.max(1, Math.round(tall * (.5 + r() * .7)));
          prop('box', x0 + i * 12.8 + 6.4, k * 1.3, bz + (j - 2.5) * 2.7, 12.2, k * 2.6 - .1, 2.44, pick(r, BOXES));
        }

        // Rail-mounted gantry spanning this bay.

        const gx = x0 + (.15 + r() * .7) * nx * 12.8, gh = 18 + r() * 6, gc = r() < .5 ? YEL : [.05, .12, .22], half = bayD / 2 + 2;
        for (const s of [-1, 1]) for (const t of [-1, 1]) prop('box', gx + t * 4, gh / 2, bz + s * half, 1, gh, 1, gc);
        for (const t of [-1, 1]) prop('box', gx + t * 4, gh, bz, 1.2, 1.4, half * 2 + 1, gc);
        prop('box', gx, gh - 1.2, bz + (r() - .5) * bayD, 9, 2, 3, gc);
        glow(gx, gh - 2.4, bz, 1.4, .2, bayD * .8, SODIUM);
        beacon(gx + 4, gh + 1, bz + half, r);
      }

      // Quay crane along the west edge: portal legs, boom and the A-frame apex.

      const qx = x - w / 2 + 9, qz = z + (r() - .5) * d * .3, ph = 40 + r() * 10, ah = ph + 22 + r() * 10, qc = r() < .5 ? [.3, .08, .04] : [.06, .14, .26];
      for (const s of [-1, 1]) for (const t of [-1, 1]) prop('box', qx + t * 6, ph / 2, qz + s * 7, 1.4, ph, 1.4, qc);
      for (const s of [-1, 1]) prop('box', qx + 6, ph, qz + s * 4, 54, 1.8, 1.4, qc);
      for (const s of [-1, 1]) {
        prop('box', qx - 2, (ph + ah) / 2, qz + s * 4, 1, ah - ph, 1, qc);
        strut(qx - 2, ah, qz + s * 4, qx + 32, ph, qz + s * 2, .5, qc);
        strut(qx - 2, ah, qz + s * 4, qx - 20, ph, qz + s * 2, .5, qc);
      }
      prop('box', qx - 2, ah, qz, 1.2, 1.2, 9, qc);
      prop('box', qx + 10, ph - 2, qz, 4, 3, 5, metal(r, .15));
      glow(qx + 10, ph - 3.7, qz, 2.6, .3, 3, SODIUM);
      for (let t = 0; t < 50; t += 10) glow(qx - 14 + t, ph - .8, qz, .4, .25, .4, SODIUM);
      beacon(qx - 2, ah + 1, qz, r);
      beacon(qx + 32, ph + 1.5, qz, r);

      // Tall light masts and a few trucks in the lanes.

      for (let k = 0; k < Math.max(2, Math.floor(w / 40)); k++) mast(x - w / 2 + 30 + k * 40, z + (r() < .5 ? -1 : 1) * (d / 2 - 4), 34 + r() * 8);
      for (let k = Math.floor(nb * 2 * r()) + 1; k > 0; k--) truck(x0 + r() * nx * 12.8, z - d / 2 + 10 + lane / 2 + Math.floor(r() * nb) * (bayD + lane), Math.PI / 2, r);
    } },

    // Power station: cooling towers, boiler house, turbine hall, twin stacks and a switchyard.

    powerplant: { zone: 'industry', build(x, z, w, d, st, r) {
      site(x, z, w, d, r);
      const n = w > 1.6 * d ? 2 : 1, R = Math.min(w * .55 / n, d) * .42;
      for (let k = 0; k < n; k++) {
        const cx = x - w / 2 + R + 3 + k * (2 * R + 4), cz = z - d / 2 + R + 3;
        cooler(cx, cz, R, R * (2.6 + r() * .6), st, r);
      }
      const bx = x + w * .2, bz = z - d * .15, bh = 50 + r() * 20, bw = Math.min(30, w * .3), bd = d * .32;
      shed(bx, bz, bw, bd, bh, r, metal(r, .12));
      for (let t = 6; t < bh - 4; t += 10) glow(bx - bw / 2 - .1, t, bz, .1, .3, bd * .9, dim(SODIUM, .5));
      shed(bx, bz + bd / 2 + 9, w * .4, 16, 22 + r() * 6, r);
      const sx = bx + bw / 2 + 6, ssz = bz - bd * .2, sh = 110 + r() * 40;
      for (const s of [0, 1]) stack(sx, ssz + s * 9, 2.2, sh * (1 - s * .08), r, .8, [.05, .045, .04]);
      pipe(bx + bw / 2, bz, sx, ssz, 20, 3, [.1, .09, .08], false);

      // Switchyard: transformers with red pins and H-frame pylons.

      const yz = z + d / 2 - 10, yw = w * .5, yx = x - w * .22;
      for (let t = -yw / 2; t <= yw / 2; t += 7) {
        prop('box', yx + t, 1.6, yz, 3, 3.2, 3, [.07, .075, .08]);
        if (r() < .4) glow(yx + t, 3.5, yz, .3, .3, .3, [1.8, .1, .05]);
      }
      for (let t = -yw / 2; t <= yw / 2; t += 14) {
        for (const s of [-1, 1]) prop('box', yx + t + s * 2, 9, yz - 5, .4, 18, .4, DARK);
        prop('box', yx + t, 17, yz - 5, 6, .4, .4, DARK);
      }
      prop('box', yx, 16.5, yz - 5, yw, .06, .06, [.15, .15, .15]);
      plume(bx, bh, bz, 3, 3, r, [.06, .055, .05]);
      beacon(bx + bw / 2, bh + 1, bz + bd / 2, r);
    } },

    // Android works: a sawtooth assembly hall glazed in cold light, an office tower and clean exhaust stacks.

    androidworks: { zone: 'industry', build(x, z, w, d, st, r) {
      site(x, z, w, d, r, [.035, .036, .04]);
      const hw = w - 10, hd = d * .55, hh = 14 + r() * 6, hz = z + d / 2 - 5 - hd / 2, cool = r() < .5 ? [.35, .65, .8] : [.6, .7, .75];
      shed(x, hz, hw, hd, hh, r);
      const t = 7, rise = 4.5, slope = Math.atan2(rise, t), L = Math.hypot(t, rise);
      for (let zz = hz - hd / 2; zz + t <= hz + hd / 2 + .1; zz += t) {
        prop('box', x, hh + rise / 2, zz + t / 2, hw, .4, L, [.15, .15, .16], 0, slope);
        glow(x, hh + rise / 2, zz + .05, hw - 1, rise - .6, .1, dim(cool, .42));
      }

      // Office tower with a corporate sign.

      const ow = Math.min(24, w * .25, d * .28), oh = 50 + r() * 40, ox = x + (r() < .5 ? -1 : 1) * (w / 2 - 4 - ow / 2), oz = z - d / 2 + 4 + ow / 2;
      bld(ox, oz, ow, ow, oh, st, r, { lit: Math.max(.5, st.lit), roof: true, skin: SKINS.curtain });
      const accent = pick(r, [[.2, 1.4, 1.7], [1.6, .2, 1.1], [.3, 1.5, .6]]);
      sign(ox, oz, ow, ow, oh, st, r, accent, { face: 2, blade: false, sw: ow * .8, sh: 3.5, y: oh - 4 });
      put(GLOWS.ring, ox, oh + .3, oz, ow * 1.3, 1, ow * 1.3, 0, 0, dim(accent, .5));

      // Clean-room block with louvre vents, stainless stacks and delivery docks.

      const cx = ox - Math.sign(ox - x) * (ow / 2 + 16), cw = Math.min(26, w * .3), ch = 22 + r() * 8;
      shed(cx, oz, cw, ow, ch, r, [.16, .17, .18]);
      for (let y = 4; y < ch - 2; y += 4) glow(cx, y, oz + ow / 2 + .1, cw * .8, .3, .1, dim(cool, .45));
      for (let k = 0; k < 2 + Math.floor(r() * 3); k++) {
        const sx = x + (r() - .5) * hw * .8, sz = hz + (r() - .5) * hd * .6, h = hh + 18 + r() * 20;
        prop('cyl', sx, h / 2, sz, 1.6, h, 1.6, [.2, .2, .22]);
        put(GLOWS.ring, sx, h - 1, sz, 1.8, 1, 1.8, 0, 0, dim(accent, .7));
        if (r() < .7) plume(sx, h, sz, 1.4, 3, r, [.06, .065, .07]);
      }
      for (let k = 0; k < Math.floor(hw / 9); k++) {
        const dx = x - hw / 2 + 5 + k * 9;
        if ((dx - x) * Math.sign(ox - x) > 0) continue;
        glow(dx, 2.3, hz - hd / 2 - .1, 3.4, 3.4, .1, [.45, .5, .55]);
        if (r() < .5) truck(dx, hz - hd / 2 - 6.5, 0, r);
      }
    } },

    // Water works: clarifier basins with sweeping bridges, aeration lanes, digester eggs and a pump house.

    waterworks: { zone: 'industry', build(x, z, w, d, st, r) {
      site(x, z, w, d, r, [.04, .04, .038]);
      const water = [.02, .07, .075];
      const cr = Math.min(10 + r() * 5, Math.min(w, d) * .17), step = cr * 2.3, half = w * .55;
      const nx = Math.max(1, Math.floor(half / step)), nz = Math.max(1, Math.floor((d - 8) / step));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const cx = x - w / 2 + 4 + cr + i * step, cz = z - (nz - 1) / 2 * step + j * step;
        prop('cyl', cx, 1.2, cz, cr * 2, 2.4, cr * 2, CONCRETE);
        glow(cx, 2.42, cz, cr * 1.7, .02, cr * 1.7, water);
        put(GLOWS.ring, cx, 2.5, cz, cr * 1.9, 1, cr * 1.9, 0, 0, [.12, .45, .5]);
        prop('box', cx, 3, cz, cr * 2, .6, 1, YEL, r() * Math.PI);
        prop('cyl', cx, 2.8, cz, 2, 1.6, 2, [.12, .12, .12]);
      }

      // Aeration lanes with bubbling light.

      const ax = x + w * .18, aw = w * .18;
      for (let k = 0; k < 4; k++) {
        const lz = z - d / 2 + 8 + k * 5;
        prop('box', ax, .8, lz, aw, 1.6, 4.2, CONCRETE);
        glow(ax, 1.62, lz, aw - 1, .02, 3.4, [.05, .15, .15]);
      }

      // Digester eggs joined by a top walkway, with a gas flare.

      const ne = 2 + Math.floor(r() * 3), er = 6 + r() * 2.5, eh = 34 + r() * 16, ex = x + w / 2 - er - 6;
      for (let k = 0; k < ne; k++) {
        const ez = z - d / 2 + er + 6 + k * (d - 2 * er - 12) / Math.max(1, ne - 1);
        const silver = metal(r, .26);
        prop('dish', ex, 2, ez, er * 2, eh * .9, er * 2, silver);
        prop('cyl', ex, 2 + eh * .18 + eh * .2, ez, er * 2, eh * .4, er * 2, silver);
        prop('dish', ex, 2 + eh * .76, ez, er * 2, eh * .9, er * 2, silver, 0, Math.PI);
        put(GLOWS.ring, ex, 2 + eh * .38, ez, er * 2.05, 1, er * 2.05, 0, 0, dim(SODIUM, .55));
        beacon(ex, 2.6 + eh * .76, ez, r);
      }
      if (ne > 1) prop('box', ex, 1 + eh * .76, z, 1.6, .5, d - 2 * er - 12, DARK);
      const gx = ex - er - 8, gz = z + d / 2 - 8, gh = 28 + r() * 10;
      prop('cyl', gx, gh / 2, gz, .9, gh, .9, DARK);
      flickerGlow(gx, gh + 1.5, gz, 1, 2.6, 1, [1.3, .9, .3], r);
      shed(ax, z + d * .2, aw, d * .22, 12 + r() * 6, r);
      for (let k = 0; k < 3; k++) pipe(ax - w * .15, z + d * .32 + k * 1.4, ex, z + d * .32 + k * 1.4, 3 + k * .5, 1, [.06, .12, .14]);
    } },
  };
}
