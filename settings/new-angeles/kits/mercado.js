// Mercado Baja: lot kits for the market quarter. Low, dense, loud and warm. Kit signature: (x, z, s, st, b, r) in the lot frame.
// Kits read the real lot rectangle from H.frame() and fall back to an s × s square in the showcase. The front faces +z.

// Text signs share one canvas atlas. Each cell is its own instanced plane, tinted by instance colour.

let SIGNS = null;
const H_TXT = ['MERCADO', 'COMIDA', 'LICORES', 'EMPEÑO', 'FARMACIA', 'CAMBIO', 'REPARA', 'JUEGOS'];
const V_TXT = ['拉麺', 'BAR', '薬局', 'TACO', '電脳', 'HOTEL', '酒場', 'MODS'];

function signAtlas(H) {
  const { THREE, lerp } = H;
  const tex = H.canvasTexture(1024, 1024, g => {
    g.fillStyle = '#0b0a0e'; g.fillRect(0, 0, 1024, 1024);
    g.strokeStyle = g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6;
    H_TXT.forEach((t, k) => {
      const cx = (k % 2) * 512, cy = Math.floor(k / 2) * 128;
      g.shadowBlur = 0; g.strokeRect(cx + 10, cy + 10, 492, 108);
      g.shadowBlur = 16; g.font = 'bold 72px "Avenir Next Condensed", "Arial Narrow", sans-serif';
      g.fillText(t, cx + 256, cy + 68, 450);
    });
    V_TXT.forEach((t, k) => {
      const cx = k * 128, ch = [...t];
      g.shadowBlur = 0; g.strokeRect(cx + 8, 520, 112, 496);
      g.shadowBlur = 14; g.font = `bold ${ch.length > 3 ? 74 : 92}px "Hiragino Sans", "Arial Narrow", sans-serif`;
      ch.forEach((c, j) => g.fillText(c, cx + 64, 520 + 496 * (j + .5) / ch.length));
    });
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  const cell = (u0, v0, u1, v1) => {
    const geo = new THREE.PlaneGeometry(1, 1), uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(u0, u1, uv.getX(i)), lerp(v0, v1, uv.getY(i)));
    const m = H.instanced(new THREE.InstancedMesh(geo, mat, 1500));
    H.decor.add(m);
    return m;
  };
  return {
    h: H_TXT.map((_, k) => cell((k % 2) * .5, 1 - (Math.floor(k / 2) + 1) * .125, (k % 2) * .5 + .5, 1 - Math.floor(k / 2) * .125)),
    v: V_TXT.map((_, k) => cell(k * .125, 0, (k + 1) * .125, .49)),
  };
}

export function kits(H) {
  const { GLOWS, SKINS, bld, flickerGlow, glow, holo, prop, put, stringLights, beacon } = H;
  SIGNS ??= signAtlas(H);

  const NEON = [[1.7, .2, .9], [.2, 1.3, 1.7], [1.7, .8, .15], [.3, 1.6, .5], [1.7, .18, .14], [1, .3, 1.7]];
  const BULBS = [[1, .6, .25], [1, .6, .25], [1, .35, .55], [.35, .8, 1]];
  const PAINT = [[.16, .07, .06], [.06, .11, .12], [.15, .11, .05], [.12, .06, .11], [.08, .09, .06], [.13, .09, .08]];
  const WIN = [[1, .62, .22], [1, .4, .5], [.5, .9, 1], [1, .8, .4]];
  const AWN = [[.45, .08, .12], [.06, .25, .3], [.4, .28, .04], [.3, .06, .3], [.08, .28, .1]];
  const RUST = [[.16, .07, .04], [.12, .09, .06], [.09, .09, .1], [.18, .12, .05]];
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const dim = (c, k) => c.map(v => v * k);
  const dims = s => { const f = H.frame(); return f ? [Math.min(f.w - 2, 56), Math.min(f.d - 2, 56)] : [s, s]; };
  const paint = (st, r, lit) => ({ ...st, base: pick(r, PAINT), win: pick(r, WIN), lit });
  const slab = (x, z, w, d, rgb = [.05, .04, .035]) => prop('box', x, .1, z, w, .2, d, rgb);
  const txt = (kind, x, y, z, w, h, ry, rgb, r, k) => put(k == null ? pick(r, SIGNS[kind]) : SIGNS[kind][k], x, y, z, w, h, 1, ry, 0, rgb);
  const faceRy = sd => sd > 0 ? 0 : Math.PI;

  // Stall: counter, goods, an awning sloping toward sd (±z) and a bulb.

  const stall = (x, z, sd, r, w = 2.6) => {
    prop('box', x, .5, z, w, 1, 1.4, [.09, .07, .05]);
    prop('box', x, 1.15, z, w * .8, .3, 1, dim(pick(r, AWN), 1.4));
    prop('box', x, 2.5, z + sd * .5, w + .4, .08, 2.2, pick(r, AWN), 0, sd * .22);
    glow(x, 2.1, z + sd * .3, .28, .28, .28, pick(r, BULBS));
  };

  // Shop-house: painted walls, a lit shutter, awning, light spill, a facade sign and a blade sign.

  const shop = (x, z, w, d, floors, sd, st, r) => {
    const h = floors * 3.2, fz = z + sd * d / 2, c = pick(r, NEON);
    bld(x, z, w, d, h, paint(st, r, .35 + r() * .3), r, { roof: r() < .6 });
    glow(x, 1.3, fz + sd * .05, w * .8, 2.4, .1, dim(c, .1 + r() * .12));
    prop('box', x, 3, fz + sd * 1.1, w * .96, .1, 2.2, pick(r, AWN), 0, sd * .25);
    glow(x, 2.75, fz + sd * 2.15, w * .9, .07, .07, dim(c, .8));
    if (h > 6 && r() < .8) txt('h', x, 4.3, fz + sd * .15, w * .8, w * .2, faceRy(sd), dim(c, 1.1), r);
    if (r() < .7) {
      const sh = Math.min(h - 3, 3 + r() * 3);
      txt('v', x + (r() < .5 ? -1 : 1) * w * .35, 4 + sh / 2, fz + sd * .9, sh * .26, sh, Math.PI / 2, pick(r, NEON), r);
    }
    return [h, fz];
  };

  // Smoke from a grill: warm puffs rise, swell and fade.

  const smoke = (x, y, z, r) => {
    for (let k = 0; k < 3; k++) {
      const sz = .5 + k * .5, f = .6 * (1 - k / 3);
      put(GLOWS.sphere, x + k * .4 * r(), y + .4 + k * 1.2, z + k * .3, sz, sz * .8, sz, 0, 0, [.12 * f, .11 * f, .11 * f]);
    }
  };

  // Shop street: rows of narrow 2–5 floor shop-houses, light strings out across the street.

  const shops = (x, z, s, st, b, r) => {
    const [W, D] = dims(s), two = D > 22, dd = two ? D / 2 - 1.5 : D - 3;
    slab(x, z, W, D);
    for (const sd of two ? [1, -1] : [r() < .5 ? 1 : -1]) {
      const cz = two ? z + sd * D / 4 : z - sd;
      let u = -W / 2, n = 0;
      while (u < W / 2 - 3) {
        const w = Math.min(W / 2 - u, 4 + r() * 4), d = dd * (.8 + .2 * r());
        const [h, fz] = shop(x + u + w / 2, cz + sd * (dd - d) / 2, w - .2, d, 2 + Math.floor(r() * 4), sd, st, r);
        if (n++ % 2 === 0) {
          const a = [x + u + w / 2, h - .5, fz];
          stringLights(a, [a[0] + (r() - .5) * 8, 4 + r() * 3, fz + sd * 8], .8, 6, pick(r, BULBS));
        }
        u += w;
      }
      for (let k = Math.floor(r() * 3); k > 0; k--) stall(x + (r() - .5) * (W - 4), cz + sd * (dd / 2 + 4), sd, r);
    }
  };

  return {

    // Market hall: a long shed with a lit barrel or sawtooth roof and stalls spilling out the front.

    hall(x, z, s, st, b, r) {
      const [W, D] = dims(s), w = W - 2, d = D * .72, hz = z - D / 2 + d / 2, wall = 7 + r() * 3, fz = hz + d / 2;
      const amber = [.9, .42, .12], c = pick(r, NEON);
      slab(x, z, W, D);
      bld(x, hz, w, d, wall, paint(st, r, .3), r, { roof: false, skin: SKINS.bands });
      if (r() < .5) {
        const rise = w * .3;
        prop('cyl', x, wall, hz, w, d, rise * 2, [.1, .085, .07], 0, Math.PI / 2);
        for (let k = -d / 2 + 2; k < d / 2; k += 4) put(GLOWS.ring, x, wall, hz + k, w * 1.02, 1, rise * 2.04, 0, Math.PI / 2, dim(amber, .45));
        glow(x, wall + rise + .05, hz, 1.2, .12, d * .95, dim(amber, .6));
        for (let u = -3; u <= 3; u++) {
          const hh = rise * Math.sqrt(1 - (u / 3.6) ** 2) * .9;
          glow(x + u * w / 8, wall + hh / 2, fz + .1, w / 10, hh, .1, dim(amber, .25));
        }
      } else {
        const n = Math.max(2, Math.floor(d / 5)), p = d / n, th = 2.6, len = Math.hypot(p, th);
        for (let k = 0; k < n; k++) {
          const zc = hz - d / 2 + (k + .5) * p;
          prop('box', x, wall + th / 2, zc, w, .2, len, [.1, .085, .07], 0, -Math.atan2(th, p));
          glow(x, wall + th / 2, zc + p / 2 - .1, w * .97, th * .9, .12, dim(k % 2 ? amber : c, k % 2 ? .45 : .25));
        }
      }
      glow(x, wall - .2, fz + .12, w, .15, .15, dim(c, 1.2));
      glow(x, 2.6, fz + .06, w * .45, 4.6, .1, dim(amber, .4));
      const sw = Math.min(w * .5, 12);
      txt('h', x, 5.5 + sw / 8, fz + .2, sw, sw / 4, 0, dim(c, 1.3), r, r() < .6 ? 0 : null);
      for (let u = -w / 2 + 2; u < w / 2 - 1; u += 3.3) if (r() < .85) stall(x + u, fz + 3.2, 1, r);
      for (const sx of [-1, 1]) stringLights([x + sx * w / 2, wall - .5, fz], [x + sx * w / 3, 4, z + D / 2 + 2], 1, 7, pick(r, BULBS));
    },

    shops,
    alley: shops,

    // Night-food court: carts and grills with smoke, tables under umbrellas, bulbs overhead, a neon arch.

    food(x, z, s, st, b, r) {
      const [W, D] = dims(s), bz = z - D / 2 + 3;
      slab(x, z, W, D, [.055, .042, .035]);
      bld(x, bz - 1, W - 2, 4, 6.4, paint(st, r, .5), r, { roof: true });
      for (let u = -W / 2 + 3; u < W / 2 - 2; u += 4.5) {
        const cz = bz + 3, c = pick(r, NEON);
        prop('box', x + u, .6, cz, 3, 1.2, 1.6, [.12, .1, .08]);
        prop('box', x + u, 2.6, cz, 3.4, .1, 2.2, pick(r, AWN), 0, .2);
        glow(x + u, 1.3, cz + .82, 2.6, .5, .05, dim(c, .5));
        flickerGlow(x + u - .6, 1.25, cz, .9, .12, .7, [1.6, .55, .12], r);
        smoke(x + u - .6, 2.8, cz, r);
      }
      const tw = W - 6, td = D - 12;
      for (let i = 0; i < Math.max(1, Math.floor(tw / 5)); i++) for (let j = 0; j < Math.max(1, Math.floor(td / 5)); j++) {
        if (r() < .25) continue;
        const tx = x - tw / 2 + 2.5 + i * 5, tz = bz + 7 + j * 5;
        prop('cyl', tx, .75, tz, 1.4, .08, 1.4, [.14, .12, .1]);
        prop('cyl', tx, 1.5, tz, .08, 3, .08, [.1, .1, .1]);
        prop('cone', tx, 3.1, tz, 2.8, .8, 2.8, pick(r, AWN));
        glow(tx, 2.6, tz, .3, .3, .3, pick(r, BULBS));
      }
      const poles = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dz]) => [x + dx * (W / 2 - .5), 5.5, z + dz * (D / 2 - 1)]);
      for (const [px, , pz] of poles) prop('cyl', px, 2.75, pz, .14, 5.5, .14, [.06, .05, .04]);
      stringLights(poles[0], poles[2], 1.3, 12, [1, .6, .25]);
      stringLights(poles[1], poles[3], 1.3, 12, [1, .4, .55]);
      const aw = Math.min(W * .5, 10), az = z + D / 2 - .6, c = pick(r, NEON);
      for (const sx of [-1, 1]) prop('box', x + sx * aw / 2, 3.2, az, .5, 6.4, .5, [.08, .07, .06]);
      glow(x, 6.6, az, aw + .5, .25, .25, dim(c, 1.4));
      txt('h', x, 5.4, az + .3, aw * .8, aw * .2, 0, dim(c, 1.2), r, 1);
    },

    // Stacked bazaar: open decks of stalls three or four levels high, like a car park turned market.

    bazaar(x, z, s, st, b, r) {
      const [W, D] = dims(s), w = Math.min(W - 6, 40), d = Math.min(D - 2, 30), L = 3 + Math.floor(r() * 2), fh = 3.6;
      const fx = x - 2, fz = z + d / 2, gray = [.09, .085, .08];
      slab(x, z, W, D);
      bld(fx, z - d / 2 + 1.5, w, 3, L * fh, paint(st, r, .45), r, { roof: false, skin: SKINS.sparse });
      for (const [dx, dz] of [[-1, 1], [1, 1], [0, 1], [-1, 0], [1, 0]]) prop('box', fx + dx * (w / 2 - .4), L * fh / 2, z + dz * (d / 2 - .4), .7, L * fh, .7, gray);
      for (let k = 0; k <= L; k++) {
        const y = k * fh, c = pick(r, NEON);
        if (k > 0) {
          prop('box', fx, y, z, w, .45, d, gray);
          glow(fx, y - .35, fz + .05, w, .12, .12, dim(c, 1.1));
          glow(fx + w / 2 + .05, y - .35, z, .12, .12, d, dim(c, .8));
        }
        for (let u = -w / 2 + 2; u < w / 2 - 1; u += 3.6) {
          if (r() < .2) continue;
          if (k === L) {
            prop('cone', fx + u, y + 2.6, fz - 3, 3, .7, 3, pick(r, AWN));
            glow(fx + u, y + 2.1, fz - 3, .3, .3, .3, pick(r, BULBS));
            continue;
          }
          glow(fx + u, y + 1.4, fz - 4.5, 3, 2.4, .1, dim(pick(r, NEON), .15 + r() * .15));
          prop('box', fx + u, y + .7, fz - 2.2, 2.6, .9, 1.2, dim(pick(r, AWN), .7));
          glow(fx + u, y + fh - .6, fz - 2.2, .25, .25, .25, pick(r, BULBS));
        }
        if (k > 0 && k < L && r() < .6) txt('h', fx + (r() - .5) * (w - 6), y - 1, fz + .1, 4, 1, 0, dim(pick(r, NEON), 1), r);
      }
      const top = L * fh;
      stringLights([fx - w / 2, top + 4, fz - d + 2], [fx + w / 2, top + 4, fz], 1.2, 10, pick(r, BULBS));
      for (const sx of [-1, 1]) prop('cyl', fx + sx * w / 2, top + 2, fz - (sx < 0 ? d - 2 : 0), .14, 4, .14, [.06, .05, .04]);
      const rl = Math.hypot(d, fh), rx = fx + w / 2 + 2;
      prop('box', rx, fh / 2, z, 3, .3, rl, gray, 0, Math.atan2(fh, d));
      glow(rx + 1.5, fh / 2 + .6, z, .08, .08, rl, [.2, 1.2, 1.4]);
      const c = pick(r, NEON);
      txt('h', fx, top + 1.8, fz, Math.min(w * .6, 12), Math.min(w * .15, 3), 0, dim(c, 1.3), r);
      prop('box', fx, top + 1.8, fz - .2, Math.min(w * .6, 12) + .4, Math.min(w * .15, 3) + .4, .2, [.04, .04, .04]);
      txt('v', fx - w / 2 - .2, top / 2 + 1, fz + .6, 1.6, top * .7, Math.PI / 2, pick(r, NEON), r);
      if (r() < .5) holo(fx, z, w, d, top - 3, r, 1, 10);
    },

    // Cheap tower: a 20–40 m stack over a shop podium, wrapped in billboards and vertical neon.

    mer_tower(x, z, s, st, b, r) {
      const [W, D] = dims(s), tw = Math.min(W - 3, Math.max(8, Math.min(16, W * .55))), td = Math.min(D - 3, Math.max(8, Math.min(14, D * .5)));
      const ph = 4.5, th = 16 + r() * 18, tz = z - D / 2 + td / 2 + 1, pst = paint(st, r, .4);
      slab(x, z, W, D);
      bld(x, z, W - 2, D - 2, ph, pst, r, { roof: false, skin: SKINS.bands });
      const fz = z + D / 2 - 1;
      for (let u = -W / 2 + 3; u < W / 2 - 2; u += 5) {
        const c = pick(r, NEON);
        glow(x + u, 1.4, fz + .05, 4, 2.4, .1, dim(c, .15));
        prop('box', x + u, 3, fz + 1.1, 4.4, .1, 2.2, pick(r, AWN), 0, .25);
      }
      bld(x, tz, tw, td, th, { ...pst, base: pick(r, PAINT), lit: .36 + r() * .12 }, r, { y0: ph, skin: pick(r, [SKINS.grid, SKINS.bands, SKINS.sparse]) });
      const top = ph + th, tf = tz + td / 2;
      for (let u = -W / 2 + 4; u < W / 2 - 3; u += 5) if (r() < .7) {
        const uz = tf + 2 + r() * Math.max(0, fz - tf - 5);
        prop('cone', x + u, ph + 2.4, uz, 3, .7, 3, pick(r, AWN));
        glow(x + u, ph + 1.9, uz, .3, .3, .3, pick(r, BULBS));
      }
      stringLights([x - tw / 2, ph + 7, tf], [x - W / 2 + 2, ph + 3, fz], .6, 8, pick(r, BULBS));
      stringLights([x + tw / 2, ph + 7, tf], [x + W / 2 - 2, ph + 3, fz], .6, 8, pick(r, BULBS));
      holo(x, tz, tw, td, ph + th * (.45 + .3 * r()), r, 2, tw * .9);
      if (r() < .6) holo(x, tz, tw, td, ph + th * .5, r, r() < .5 ? 0 : 1, td * .8);
      for (const sx of [-1, 1]) {
        const vh = th * (.4 + .3 * r());
        txt('v', x + sx * (tw / 2 + .2), ph + 2 + vh / 2 + r() * (th - vh - 3), tf + 1, vh * .2, vh, Math.PI / 2, pick(r, NEON), r);
      }
      for (let y = ph + 2; y < top - 3; y += 4 + r() * 4) if (r() < .6) {
        const sw = tw * (.3 + .4 * r());
        txt('h', x + (r() - .5) * (tw - sw), y, tf + .2, sw, sw / 4, 0, dim(pick(r, NEON), 1.1), r);
      }
      const c = pick(r, NEON);
      for (const dz of [-1, 1]) glow(x, top - .3, tz + dz * (td / 2 + .05), tw + .1, .2, .1, dim(c, 1));
      for (const dx of [-1, 1]) glow(x + dx * (tw / 2 + .05), top - .3, tz, .1, .2, td + .1, dim(c, 1));
      for (const sx of [-1, 1]) prop('box', x + sx * tw * .3, top + 2.5, tz, .3, 5, .3, [.06, .06, .06]);
      txt('h', x, top + 3.4, tz, tw * .8, tw * .2, 0, dim(pick(r, NEON), 1.4), r);
      beacon(x, top + 5.5, tz, r);
    },

    // Scrap and parts dealer: fenced yard, heaps of hulks, a lattice crane, a lit office and welding sparks.

    scrap(x, z, s, st, b, r) {
      const [W, D] = dims(s), fence = [.07, .06, .05];
      slab(x, z, W, D, [.045, .038, .03]);
      prop('box', x, 1.3, z - D / 2, W, 2.6, .2, fence);
      for (const sx of [-1, 1]) prop('box', x + sx * W / 2, 1.3, z, .2, 2.6, D, fence);
      for (const sx of [-1, 1]) prop('box', x + sx * W * .3, 1.3, z + D / 2, W * .4, 2.6, .2, fence);
      for (const sx of [-1, 1]) glow(x + sx * W * .3, 2.65, z + D / 2 + .1, W * .4, .1, .1, [1.2, .55, .1]);
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) {
        const px = x + (r() - .5) * (W - 10), pz = z - D * .1 + (r() - .5) * (D * .5), ph = 2 + r() * 4, pr = 4 + r() * 4;
        prop('cone', px, ph / 2, pz, pr * 2, ph, pr * 2, pick(r, RUST));
        for (let j = 0; j < 5; j++) {
          const a = r() * 6.3, rr = r() * pr * .8;
          prop('box', px + Math.cos(a) * rr, ph * (1 - rr / pr) + .3, pz + Math.sin(a) * rr, 1.8, 1.1, 3.8, pick(r, RUST), r() * 6.3, (r() - .5) * .8);
        }
      }
      const cx = x + W / 2 - 3, cz = z - D / 2 + 3, ch = 14 + r() * 6, ba = r() * 1.5 + 2;
      put(H.PROPS.lattice, cx, ch / 2, cz, 2.4, ch, 2.4);
      prop('box', cx, ch + .8, cz, 2.2, 1.6, 2.2, [.3, .2, .03]);
      prop('box', cx + Math.sin(ba) * 8, ch + 1.6, cz + Math.cos(ba) * 8, .8, .8, 18, [.3, .2, .03], ba);
      const hx = cx + Math.sin(ba) * 13, hz = cz + Math.cos(ba) * 13;
      prop('box', hx, ch - 3, hz, .08, 9, .08, [.05, .05, .05]);
      prop('box', hx, ch - 7.6, hz, 1.8, 1.1, 3.8, pick(r, RUST), r() * 3);
      beacon(cx, ch + 2, cz, r);
      const ox = x - W / 2 + 4, oz = z + D / 2 - 4, c = pick(r, NEON);
      bld(ox, oz, 6, 5, 3.6, paint(st, r, .6), r, { roof: true });
      txt('h', ox, 4.4, oz + 2.6, 5, 1.25, 0, dim(c, 1.2), r, r() < .6 ? 6 : 3);
      glow(ox, 1.4, oz + 2.55, 3, 2, .08, dim(c, .3));
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) flickerGlow(x + (r() - .5) * W * .6, .6 + r(), z + (r() - .5) * D * .5, .3, .3, .3, [1.4, 1.6, 2.2], r);
      for (const sx of [-1, 1]) {
        prop('cyl', x + sx * W * .25, 4, z + D * .3, .2, 8, .2, [.06, .06, .06]);
        glow(x + sx * W * .25, 8.1, z + D * .3, .9, .3, .5, [1, .6, .25]);
      }
    },
  };
}
