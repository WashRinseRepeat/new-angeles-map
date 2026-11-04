// The Lindwurmdom: a fantasy Gothic cathedral at the fantasy site in city.json, with a lindworm coiled round its
// crossing tower. It builds in local metres round the site's centre, x east and z south, with its west front toward
// -x. The stone is instanced parts. The dragon is custom meshes that breathe, flex their wings and watch the city.
// The site's rot is 0, and the parts assume it.

import { HALF_PI, GOLD, DARK, helpers } from './common.js';

export const kits = () => ({});

// Red sandstone walls, yellow sandstone tracery, weathered stone low down, slate roofs and glazed tiles.

const SST = [.36, .2, .14], YST = [.44, .35, .22], OLD = [.22, .16, .13], DRESS = [.47, .37, .25], PLINTH = [.2, .14, .11];
const SLATE = [.12, .12, .15], GREEN = [.08, .26, .16], OXBLOOD = [.32, .07, .05], GILT = [.62, .46, .16];
const GLASS = [[.85, .12, .1], [.15, .22, .95], [.9, .62, .15], [.2, .65, .35], [.6, .2, .75], [.15, .22, .95]];
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]], CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const OCT = Math.PI / 8, COS8 = Math.cos(OCT), DEG = Math.PI / 180;
const MH = 34, AH = 15, RH = 17;

const bays = (x0, x1, n) => Array.from({ length: n }, (_, k) => x0 + (k + .5) * (x1 - x0) / n);
const marks = (x0, x1, n) => Array.from({ length: n + 1 }, (_, k) => x0 + k * (x1 - x0) / n);
const XZ = p => [p[0], p[2]];

// Small vector helpers on [x, y, z] arrays.

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => mul(a, 1 / (Math.hypot(...a) || 1));
const mix = (a, b, t) => add(a, mul(sub(b, a), t));

// The parts the cathedral is made of, for one build's style and random stream.

function kit(H, st, r) {
  const { bld, prop, glow, put, flickerGlow, GLOWS, SKINS } = H;
  const S = { ...st, lit: 0, grime: .45 };
  const jit = (c, k = .1) => { const v = 1 - k + 2 * k * r(); return c.map(x => x * v); };
  const glass = () => GLASS[Math.floor(r() * GLASS.length)].map(c => c * (.5 + .2 * r()));
  const o = (y0, base, more) => ({ y0, base, skin: SKINS.blindAshlar, lit: 0, roof: false, kibble: false, ...more });

  const block = (x, z, w, d, h, y0 = 0, base = SST, ry = 0) => bld(x, z, w, d, h, S, r, o(y0, base, { ry }));
  const oct = (x, z, s, h, y0 = 0, base = SST) => bld(x, z, s, s, h, S, r, o(y0, base, { shape: 'oct' }));
  const gable = (x, z, len, span, h, y0, base = SLATE, ry = 0, skin = SKINS.slate) => bld(x, z, len, span, h, S, r, o(y0, base, { shape: 'gable', ry, skin }));
  const pyr = (x, z, s, h, y0) => bld(x, z, s, s, h, S, r, o(y0, SLATE, { shape: 'pyr', skin: SKINS.slate }));

  // A bar from a to b. The engine turns a part by rx about its own x, then by ry about the vertical.

  const orient = (dx, dy, dz) => [Math.atan2(dx, dz), Math.acos(Math.max(-1, Math.min(1, dy / Math.hypot(dx, dy, dz))))];
  const bar = (a, b, t, rgb, kind = 'box') => {
    const d = sub(b, a), [ry, rx] = orient(...d);
    prop(kind, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, t, Math.hypot(...d), t, rgb, ry, rx);
  };

  // Points on a wall whose outward normal is (nx, nz), through (x, z): u along the wall, y up, v out from it.

  const wall = (x, z, nx, nz) => ({ ry: Math.atan2(nx, nz), P: (u, y, v = 0) => [x + nz * u + nx * v, y, z - nx * u + nz * v] });

  const pinnacle = (x, z, y0, h, s = .7) => {
    prop('box', x, y0 + h * .3, z, s, h * .6, s, jit(YST));
    prop('cone', x, y0 + h * .78, z, s * 1.3, h * .45, s * 1.3, jit(YST), OCT);
    if (h < 4) return;
    for (let k = 0; k < 4; k++) for (const g of [.25, .55]) {
      const a = k * HALF_PI + g * 2, rr = s * .65 * (1 - g) + .1;
      prop('box', x + Math.cos(a) * rr, y0 + h * (.555 + .45 * g), z + Math.sin(a) * rr, s * .26, s * .3, s * .26, jit(YST), -a);
    }
    prop('cyl', x, y0 + h + .1, z, s * .3, s * .35, s * .3, GILT);
  };
  const finial = (x, z, y, k = 1) => {
    prop('cyl', x, y + .3 * k, z, .6 * k, .6 * k, .6 * k, GOLD);
    prop('box', x, y + 1.3 * k, z, .14 * k, 1.6 * k, .14 * k, GOLD);
    prop('box', x, y + 1.6 * k, z, .8 * k, .14 * k, .14 * k, GOLD);
  };
  const slot = (x, z, nx, nz, y0, h, wd) => prop('box', x + nx * .06, y0 + h / 2, z + nz * .06, wd, h, .16, DARK, Math.atan2(nx, nz));

  // A pointed window in a dressed surround, its lights and head in coloured glass.

  const lancet = (x, z, nx, nz, y0, h, wd, lights = 2, rows = 1) => {
    const ry = Math.atan2(nx, nz), tx = nz, tz = -nx;
    prop('box', x + nx * .12, y0 + h / 2, z + nz * .12, wd + .7, h + .6, .24, jit(DRESS), ry);
    const head = wd * .55, body = h - head, gap = .25;
    const rh = (body - gap * (rows - 1)) / rows, lw = (wd - gap * (lights - 1)) / lights, gx = x + nx * .26, gz = z + nz * .26;
    for (let j = 0; j < rows; j++) for (let i = 0; i < lights; i++) {
      const u = -wd / 2 + lw / 2 + i * (lw + gap);
      glow(gx + tx * u, y0 + rh / 2 + j * (rh + gap), gz + tz * u, lw, rh, .06, glass(), ry);
    }
    glow(gx, y0 + body + head * .45, gz, wd * .45, head * .9, .06, glass(), ry);
  };

  // A statue on a corbel under a canopy, in a dark niche, before a wall with outward normal (nx, nz).

  const statue = (x, z, nx, nz, y, h = 2.4, rgb = YST, niche = true) => {
    const { ry, P } = wall(x, z, nx, nz);
    if (niche) prop('box', ...P(0, y + h * .62, .06), h * .5, h * 1.3, .14, DARK, ry);
    prop('box', ...P(0, y - .12, .3), h * .4, .24, .5, jit(DRESS), ry);
    prop('cyl', ...P(0, y + h * .38, .32), h * .26, h * .76, h * .22, jit(rgb), ry);
    prop('cyl', ...P(0, y + h * .86, .32), h * .15, h * .2, h * .15, jit(rgb), ry);
    prop('cone', ...P(0, y + h * 1.2, .3), h * .42, h * .42, h * .42, jit(DRESS), ry + OCT);
  };

  // A horned gargoyle spouting out from (x, y, z) along (nx, nz).

  const gargoyle = (x, y, z, nx, nz, len = 2.4) => {
    const b = [x + nx * len, y - .5, z + nz * len];
    bar([x, y, z], b, .45, jit(OLD));
    prop('box', b[0] + nx * .25, b[1] - .1, b[2] + nz * .25, .55, .45, .55, jit(OLD), Math.atan2(nx, nz));
    for (const s of [-1, 1]) bar([b[0] + nz * s * .18, b[1] + .1, b[2] - nx * s * .18], [b[0] + nz * s * .3 - nx * .25, b[1] + .6, b[2] - nx * s * .3 - nz * .25], .12, DARK, 'cone');
  };

  // A rose window: rings of glass under a wheel of tracery round a gilt boss.

  const rose = (x, y, z, nx, nz, R) => {
    const { ry, P } = wall(x, z, nx, nz), Q = (u, h, v) => P(u, y + h, v);
    prop('cyl', ...Q(0, 0, .1), R * 2 + .8, .3, R * 2 + .8, jit(DRESS), ry, HALF_PI);
    [[1, [.75, .08, .06]], [.8, [.12, .18, .85]], [.55, [.85, .55, .12]], [.32, [.14, .5, .3]], [.13, [1, .85, .5]]]
      .forEach(([f, c], k) => put(GLOWS.sphere, ...Q(0, 0, .3 + k * .04), 2 * R * f, 2 * R * f, .05, ry, 0, c));
    for (let k = 0; k < 12; k++) {
      const a = (k + .5) * Math.PI / 6;
      put(GLOWS.sphere, ...Q(R * .68 * Math.cos(a), R * .68 * Math.sin(a), .5), R * .22, R * .22, .05, ry, 0, [.9, .6, .15]);
    }
    const ring = (f, n, t) => {
      for (let k = 0; k < n; k++) {
        const a = k * 2 * Math.PI / n, b = (k + 1) * 2 * Math.PI / n;
        bar(Q(R * f * Math.cos(a), R * f * Math.sin(a), .58), Q(R * f * Math.cos(b), R * f * Math.sin(b), .58), t, jit(YST, .05));
      }
    };
    ring(1, 24, R * .09); ring(.62, 16, R * .05); ring(.28, 8, R * .05);
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8;
      bar(Q(R * .28 * Math.cos(a), R * .28 * Math.sin(a), .58), Q(R * Math.cos(a), R * Math.sin(a), .58), R * .045, jit(YST, .05));
    }
    prop('cyl', ...Q(0, 0, .66), R * .22, .2, R * .22, GOLD, ry, HALF_PI);
  };

  // Steps falling away from (x, z) along (nx, nz).

  const steps = (x, z, nx, nz, w, n) => {
    for (let k = 0; k < n; k++) block(x + nx * (k + .5) * .45, z + nz * (k + .5) * .45, w, .46, (n - k) * .16, 0, DRESS, Math.atan2(nx, nz));
  };

  // A deeply recessed portal on the wall point (x, z): a dark door under a tympanum with a gilt mandorla, orders
  // of jamb shafts and pointed archivolts stepping out, saints on the jambs, an open crocketed gable over it
  // between pinnacled piers, lamps and steps.

  const portal = (x, z, nx, nz, wd, h, orders = 4) => {
    const { ry, P } = wall(x, z, nx, nz), dh = h * .6;
    prop('box', ...P(0, dh / 2, .05), wd, dh, .12, DARK, ry);
    let u = 0, v = 0, hk = 0;
    for (let k = 0; k < orders; k++) {
      u = wd / 2 + .3 + k * .5; v = .25 + k * .55; hk = dh + .2 + k * .3;
      for (const s of [-1, 1]) {
        prop('cyl', ...P(s * u, hk / 2, v), .44, hk, .44, jit(YST), ry);
        bar(P(s * u, hk, v), P(0, hk + u * 1.05, v), .42, jit(YST));
        if (k) statue(...XZ(P(s * (u - .25), 0, v - .1)), nx, nz, 1.4, 2.2, YST, false);
      }
    }
    const u0 = wd / 2 + .3, ty = u0 * 1.05 * .8;
    prop('box', ...P(0, dh + .2 + ty / 2, .12), wd, ty, .2, jit(DRESS), ry);
    prop('cyl', ...P(0, dh + .2 + ty * .5, .26), ty * .5, .1, ty * .8, GOLD, ry, HALF_PI);
    if (wd > 4) {
      prop('box', ...P(0, dh / 2, .25), .6, dh, .4, jit(YST), ry);
      statue(...XZ(P(0, 0, .3)), nx, nz, dh * .3, 2.4, GILT, false);
    }
    const ug = u + .7, yt = hk + ug * 1.7, vg = v + .3;
    for (const s of [-1, 1]) {
      bar(P(s * ug, hk, vg), P(0, yt, vg), .5, jit(YST));
      for (let f = .2; f < .95; f += .2) prop('box', ...P(s * ug * (1 - f), hk + (yt - hk) * f + .32, vg), .34, .42, .34, jit(YST), ry + .6);
      const [px, pz] = XZ(P(s * (ug + .55), 0, (v + .9) / 2));
      block(px, pz, 1.1, v + .9, hk, 0, SST, ry);
      pinnacle(px, pz, hk, yt - hk + 2, .9);
      const [lx, ly, lz] = P(s * (ug - .3), dh * .85, v + .6);
      flickerGlow(lx, ly, lz, .3, .45, .3, [2, .9, .3], r, .7);
    }
    finial(...XZ(P(0, 0, vg)), yt - .1, .7);
    steps(...XZ(P(0, 0, v + .9)), nx, nz, ug * 2 + 2.4, 3);
  };

  // A stepped buttress out from the wall point (x, z), with a pinnacle of height pin on top.

  const buttress = (x, z, nx, nz, h, dep, wd = 1.5, pin = 0) => {
    const ry = Math.atan2(nx, nz), at = k => [x + nx * k, z + nz * k];
    block(...at(dep / 2), wd, dep, h * .55, 0, OLD, ry);
    block(...at(dep * .3), wd * .85, dep * .6, h * .45, h * .55, SST, ry);
    if (pin) pinnacle(...at(dep * .3), h - .2, pin, wd * .55);
  };

  // A pier on the aisle wall at (x, z), out along (nx, nz), with a saint, a gargoyle and a pinnacle. Two tiers of
  // flyers spring from it to the clerestory wall, reach metres inward.

  const flyer = (x, z, nx, nz, reach, ph = 27, dep = 3.2) => {
    const { ry, P } = wall(x, z, nx, nz);
    block(...XZ(P(0, 0, dep / 2)), 1.9, dep, ph * .55, 0, OLD, ry);
    block(...XZ(P(0, 0, dep * .4)), 1.6, dep * .8, ph * .45, ph * .55, SST, ry);
    pinnacle(...XZ(P(0, 0, dep * .4)), ph - .2, 8, 1.1);
    statue(...XZ(P(0, 0, dep)), nx, nz, 4.5, 2.3);
    gargoyle(...P(0, ph - 3, dep * .8), nx, nz);
    for (const [y0, y1] of [[ph - 1, 31.5], [ph - 7, 24.5]]) bar(P(0, y0, .9), P(0, y1, -reach - .2), .8, jit(YST));
  };

  // Glazed tiles in chevrons on both slopes of a gable roof whose ridge runs from a0 to a1 along x, or along z when
  // alongZ, centred on c across it.

  const chevrons = (a0, a1, c, span, h, y0, alongZ = false, cell = 1.4) => {
    const L = Math.hypot(span / 2, h), sl = Math.atan2(2 * h, span), ny = Math.cos(sl), nh = Math.sin(sl), COLS = [GILT, GREEN, OXBLOOD];
    for (const v of [-1, 1]) for (let j = 1; (j + 1) * cell < L; j++) for (let i = 0; a0 + (i + 1) * cell <= a1; i++) {
      const m = j + Math.abs((i % 8) - 4);
      if (m % 4) continue;
      const t = (j + .5) * cell / L, along = a0 + (i + .5) * cell, across = c + v * (span / 2 * (1 - t) + nh * .07);
      const [ry, rx] = orient(...(alongZ ? [v * nh, ny, 0] : [0, ny, v * nh]));
      const [x, z] = alongZ ? [across, along] : [along, across];
      prop('box', x, y0 + h * t + ny * .07, z, cell * .92, .06, cell * .92, jit(COLS[Math.floor(m / 4) % 3]), ry, rx);
    }
  };

  // Gilt cresting along a ridge from (x0, z0) to (x1, z1).

  const cresting = (x0, z0, x1, z1, y) => {
    const n = Math.floor(Math.hypot(x1 - x0, z1 - z0) / 1.6);
    for (let k = 0; k <= n; k++) {
      const h = k % 2 ? .6 : 1.1;
      prop('box', x0 + (x1 - x0) * k / n, y + h / 2, z0 + (z1 - z0) * k / n, .18, h, .18, GILT);
    }
  };

  // An openwork spire on an octagon of vertex radius R: crocketed ribs, tracery rings and pointed arches, with
  // nothing inside, so the sky shows through.

  const openSpire = (x, z, y0, R, Hs) => {
    const at = (k, f) => { const a = OCT + k * Math.PI / 4; return [x + Math.cos(a) * R * (1 - f), y0 + Hs * f, z + Math.sin(a) * R * (1 - f)]; };
    const F = [0, .14, .29, .44, .58, .72, .84];
    for (let k = 0; k < 8; k++) {
      const a = OCT + k * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
      bar(at(k, 0), at(k, .985), .5, jit(YST));
      for (let f = .05; f < .92; f += 2.4 / Hs) { const p = at(k, f); prop('box', p[0] + c * .32, p[1] + .1, p[2] + s * .32, .32, .42, .32, jit(YST), -a); }
      F.forEach((f, i) => {
        bar(at(k, f), at(k + 1, f), .3, jit(YST));
        if (i === F.length - 1) return;
        const g = F[i + 1], y = f + (g - f) * .35, top = mix(at(k, g - (g - f) * .12), at(k + 1, g - (g - f) * .12), .5);
        bar(at(k, y), top, .22, jit(YST)); bar(at(k + 1, y), top, .22, jit(YST));
      });
    }
    finial(x, z, y0 + Hs - .2, R / 3.2);
  };

  return { r, BLIND: SKINS.blindAshlar, prop, glow, flickerGlow, jit, block, oct, gable, pyr, bar, wall, pinnacle, finial, slot, lancet, statue, gargoyle,
    rose, steps, portal, buttress, flyer, chevrons, cresting, openSpire };
}

// ---------- the cathedral ----------

function cathedral(K) {
  const { r, BLIND, prop, glow, flickerGlow, jit, block, oct, gable, pyr, pinnacle, finial, slot, lancet, statue, gargoyle, rose, portal,
    buttress, flyer, chevrons, cresting, openSpire, bar } = K;

  // A west tower: a buttressed square shaft with saints, glass and belfry openings, a gallery of great pinnacles,
  // an open octagonal stage round a glowing core, and an openwork spire to about 90 m.

  const westTower = (x, z, s, v) => {
    const hs = 44, half = s / 2;
    block(x, z, s + 1, s + 1, 1.4, 0, PLINTH);
    block(x, z, s, s, hs);
    for (const [cx, cz] of CORNERS) {
      block(x + cx * half, z + cz * half, 2, 2, hs - 6, 0, OLD);
      pinnacle(x + cx * half, z + cz * half, hs - 6, 15, 1.5);
      gargoyle(x + cx * (half + .9), hs - 8, z + cz * (half + .9), cx * Math.SQRT1_2, cz * Math.SQRT1_2);
    }
    for (const y of [11, 22, 33]) block(x, z, s + .6, s + .6, .5, y, DRESS);
    block(x, z, s + 1, s + 1, 1, hs, DRESS);
    for (const [nx, nz] of SIDES) {
      const fx = x + nx * half, fz = z + nz * half;
      if (nz !== -v) lancet(fx, fz, nx, nz, 23.5, 8.5, 2.6, 2, 2);
      for (const u of [-1, 1]) slot(fx + nz * u * 2.4, fz - nx * u * 2.4, nx, nz, 35.5, 6, 1.3);
      if (nx < 0 || nz === v) for (const u of [-1, 1]) statue(fx + nz * u * 2.6, fz - nx * u * 2.6, nx, nz, 13.5, 2.4);
    }
    const y1 = hs + 1, sh = 14, R = s * .42;
    oct(x, z, R * 1.1, sh, y1, YST);
    for (let k = 0; k < 8; k++) {
      const a = OCT + k * Math.PI / 4, b = a + Math.PI / 4, fa = a + OCT;
      const V = [x + R * Math.cos(a), z + R * Math.sin(a)], W = [x + R * Math.cos(b), z + R * Math.sin(b)];
      const M = [(V[0] + W[0]) / 2, (V[1] + W[1]) / 2], at = (p, y) => [p[0], y, p[1]];
      const ap = R * .55 * COS8;
      glow(x + Math.cos(fa) * (ap + .05), y1 + sh * .5, z + Math.sin(fa) * (ap + .05), .7, sh * .6, .06, [.9, .55, .18], Math.atan2(Math.cos(fa), Math.sin(fa)));
      prop('box', V[0], y1 + sh / 2, V[1], .75, sh, .75, jit(YST), -a);
      bar(at(V, y1 + .3), at(W, y1 + .3), .45, jit(YST));
      bar(at(V, y1 + sh), at(W, y1 + sh), .45, jit(YST));
      bar(at(V, y1 + sh * .62), at(M, y1 + sh * .86), .32, jit(YST));
      bar(at(W, y1 + sh * .62), at(M, y1 + sh * .86), .32, jit(YST));
      bar(at(M, y1 + .3), at(M, y1 + sh * .86), .25, jit(YST));
      const tip = [M[0] + Math.cos(fa) * .2, y1 + sh + 3.2, M[1] + Math.sin(fa) * .2];
      bar(at(V, y1 + sh), tip, .35, jit(YST)); bar(at(W, y1 + sh), tip, .35, jit(YST));
      prop('box', tip[0], tip[1] + .2, tip[2], .3, .5, .3, GILT);
      pinnacle(V[0], V[1], y1 + sh, 4, .55);
    }
    openSpire(x, z, y1 + sh + .3, R, 28);
  };

  // ---------- the west front: twin towers, a gabled centre with the rose and the gallery of kings, three portals ----------

  for (const v of [-1, 1]) {
    westTower(-46, v * 12.5, 11, v);
    portal(-51.5, v * 12.5, -1, 0, 3, 10, 3);
  }
  block(-46, 0, 11.8, 14.8, 1.4, 0, PLINTH);
  block(-46, 0, 11, 14, MH);
  gable(-50.9, 0, 1.4, 15.6, 17.6, MH, DRESS, 0, BLIND);
  for (const f of [.25, .5, .75]) for (const v of [-1, 1]) pinnacle(-51.75, v * 7.8 * (1 - f), MH + 17.6 * f - .4, 3.4, .55);
  pinnacle(-51.4, 0, MH + 17.2, 7, 1);
  finial(-51.4, 0, MH + 24.3, .8);
  rose(-51.5, 24.8, 0, -1, 0, 5.6);
  block(-51.9, 0, .8, 13, .4, 31.6, DRESS);
  for (let k = -3; k <= 3; k++) statue(-51.85, k * 1.8, -1, 0, 32, 2.4, GILT);
  portal(-51.5, 0, -1, 0, 4.4, 13, 4);

  // ---------- the nave: a basilica of seven bays with two tiers of flyers ----------

  const vessel = (x0, x1, wallTo = x1) => {
    const L = x1 - x0, cx = (x0 + x1) / 2, ax = (x0 + wallTo) / 2, AL = wallTo - x0;
    block(cx, 0, L, 14, MH);
    block(ax, 0, AL, 26.8, 1.2, 0, PLINTH);
    for (const v of [-1, 1]) {
      block(ax, v * 10, AL, 6, AH);
      gable(ax, v * 7, AL, 12.8, AH * .45, AH);
      block(ax, v * 13.1, AL, .5, 1, AH - .2, DRESS);
      block(cx, v * 7.1, L, .5, 1.2, MH - .2, DRESS);
    }
  };
  const n0 = -40.5, n1 = 8;
  vessel(n0, n1);
  gable(-20.75 - 1.5, 0, 58.5, 14.8, RH, MH);
  chevrons(-50.5, 7, 0, 14.8, RH, MH);
  cresting(-50, 0, -8, 0, MH + RH);
  for (const v of [-1, 1]) {
    for (const bx of bays(n0, n1, 7)) {
      lancet(bx, v * 7, 0, v, 22.5, 10.5, 3.2, 3, 2);
      lancet(bx, v * 13, 0, v, 3, 10, 3, 2, 2);
      pinnacle(bx, v * 13.1, AH + .8, 3, .45);
    }
    for (const bx of marks(n0, n1, 7).slice(1, -1)) {
      flyer(bx, v * 13, 0, v, 6);
      pinnacle(bx, v * 7.1, MH + 1, 4.5, .6);
    }
  }

  // ---------- the transepts: rose fronts with portals between pinnacled turrets ----------

  for (const v of [-1, 1]) {
    block(15, v * 17, 14.8, 20.8, 1.2, 0, PLINTH);
    block(15, v * 17, 14, 20, MH);
    gable(15, v * 17, 20, 14.8, RH, MH, SLATE, HALF_PI);
    chevrons(v < 0 ? -26.6 : 7.6, v < 0 ? -7.6 : 26.6, 15, 14.8, RH, MH, true);
    cresting(15, v * 7.8, 15, v * 26, MH + RH);
    gable(15, v * 26.5, 1.4, 15.6, 17.6, MH, DRESS, HALF_PI, BLIND);
    for (const f of [.25, .5, .75]) for (const s of [-1, 1]) pinnacle(15 + s * 7.8 * (1 - f), v * 27.35, MH + 17.6 * f - .4, 3.4, .55);
    pinnacle(15, v * 27, MH + 17.2, 6, .8);
    finial(15, v * 27, MH + 23.3, .7);
    rose(15, 22.5, v * 27, 0, v, 5);
    portal(15, v * 27, 0, v, 3.6, 11, 4);
    for (const tx of [8, 22]) {
      oct(tx, v * 27, 3.2, 44);
      oct(tx, v * 27, 3.7, .6, 44, DRESS);
      prop('cone', tx, 50.1, v * 27, 3.4, 11, 3.4, jit(SLATE), OCT);
      finial(tx, v * 27, 55.5, .5);
      for (const y of [20, 32]) glow(tx, y, v * 28.56, .5, 2.2, .06, [.9, .55, .18]);
    }
    for (const nx of [-1, 1]) {
      const fx = 15 + nx * 7;
      buttress(fx, v * 20, nx, 0, 30, 2.4, 1.7, 7);
      for (const zz of [16.5, 23.5]) lancet(fx, v * zz, nx, 0, 4, 26, 3.2, 3, 3);
      lancet(fx, v * 10, nx, 0, 22.8, 9.5, 2.6, 2, 1);
    }
  }

  // ---------- the crossing tower: a lantern on a gallery for the lindworm, under an openwork crown ----------

  block(15, 0, 15, 15, 19, 33);
  block(15, 0, 15.8, 15.8, .8, 51.2, DRESS);
  for (const [nx, nz] of SIDES) {
    const { ry, P } = K.wall(15 + nx * 7.5, nz * 7.5, nx, nz);
    for (const s of [-1, 1]) {
      block(...XZ(P(s * 5.55, 0, -.25)), 3.9, .5, .8, 52, DRESS, ry);
      lancet(...XZ(P(s * 4.4, 0)), nx, nz, 41.8, 8.5, 2.4, 2, 2);
    }
  }
  for (const [cx, cz] of CORNERS) {
    oct(15 + cx * 7.5, cz * 7.5, 2.6, 23, 33, YST);
    prop('cone', 15 + cx * 7.5, 59.75, cz * 7.5, 2.7, 7.5, 2.7, jit(SLATE), OCT);
    finial(15 + cx * 7.5, cz * 7.5, 63.4, .4);
  }
  oct(15, 0, 10, 14, 52, YST);
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, c = Math.cos(a), s = Math.sin(a), b = OCT + a;
    lancet(15 + c * 4.62, s * 4.62, c, s, 54.6, 9.6, 2.1, 2, 2);
    pinnacle(15 + Math.cos(b) * 5.1, Math.sin(b) * 5.1, 66.7, 6, .6);
  }
  oct(15, 0, 10.8, .7, 66, DRESS);
  openSpire(15, 0, 66.8, 4.6, 18);
  flickerGlow(15, 70.5, 0, 1.3, 1.3, 1.3, [2.2, 1.3, .45], r, .55);

  // ---------- the choir: two bays, a tall apse and a chevet of five radiating chapels between flyers ----------

  const ax = 37.5, amb = 13, side = ax - amb * Math.tan(OCT);
  vessel(22, ax, side);
  gable(30, 0, 15, 14.8, RH, MH);
  chevrons(22.6, 37.4, 0, 14.8, RH, MH);
  cresting(23, 0, 37, 0, MH + RH);
  oct(ax, 0, 14 / COS8, MH);
  pyr(ax, 0, 14.8 * .97, RH * .97, MH);
  oct(ax, 0, amb * 2 / COS8 + .8, 1.2, 0, PLINTH);
  oct(ax, 0, amb * 2 / COS8, AH);
  prop('cone', ax, AH + 3.2, 0, amb * 2 / COS8 * 1.04, 6.4, amb * 2 / COS8 * 1.04, jit(SLATE), OCT);
  for (const v of [-1, 1]) {
    for (const bx of bays(22, ax, 2)) lancet(bx, v * 7, 0, v, 22.5, 10.5, 3.2, 3, 2);
    lancet(26, v * 13, 0, v, 3, 10, 3, 2, 2);
    flyer(29.5, v * 13, 0, v, 6);
  }
  for (const k of [-1, 0, 1]) {
    const a = k * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    lancet(ax + c * 7, s * 7, c, s, 19.5, 13, 3, 2, 3);
  }
  for (const deg of [-90, -45, 0, 45, 90]) {
    const a = deg * DEG, cx = ax + 14.2 * Math.cos(a), cz = 14.2 * Math.sin(a), m0 = Math.round(a / (Math.PI / 4));
    oct(cx, cz, 6.6, 1.2, 0, PLINTH);
    oct(cx, cz, 6, 13);
    oct(cx, cz, 6.4, .5, 12.6, DRESS);
    prop('cone', cx, 15.9, cz, 6.4, 5.8, 6.4, jit(SLATE), OCT);
    finial(cx, cz, 18.7, .45);
    for (const m of [m0 - 1, m0, m0 + 1]) {
      const fa = m * Math.PI / 4;
      lancet(cx + 2.77 * Math.cos(fa), cz + 2.77 * Math.sin(fa), Math.cos(fa), Math.sin(fa), 3, 8.5, 1.6, 1, 2);
    }
  }
  for (const deg of [-67.5, -22.5, 22.5, 67.5]) {
    const a = deg * DEG, c = Math.cos(a), s = Math.sin(a);
    flyer(ax + 13.4 * c, 13.4 * s, c, s, 6, 24, 3);
  }
}

// ---------- the lindworm ----------

// A Catmull-Rom curve through pts, resampled to n points evenly spaced along its length.

const curve = (pts, n) => {
  const P = [pts[0], ...pts, pts[pts.length - 1]], fine = [];
  for (let i = 1; i < P.length - 2; i++) for (let k = 0; k < 24; k++) {
    const t = k / 24, [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    fine.push([0, 1, 2].map(c => .5 * (2 * p1[c] + (p2[c] - p0[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t * t
      + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t * t * t)));
  }
  fine.push(pts[pts.length - 1]);
  const acc = [0];
  for (let i = 1; i < fine.length; i++) acc.push(acc[i - 1] + Math.hypot(...sub(fine[i], fine[i - 1])));
  const len = acc[acc.length - 1], out = [];
  for (let k = 0, i = 0; k < n; k++) {
    const d = len * k / (n - 1);
    while (i < fine.length - 2 && acc[i + 1] < d) i++;
    out.push(mix(fine[i], fine[i + 1], Math.min(1, (d - acc[i]) / (acc[i + 1] - acc[i] || 1))));
  }
  return { pts: out, len };
};

// A frame at each point: the tangent t, the normal n nearest to up, and the side b.

const frames = pts => pts.map((p, i) => {
  const t = norm(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]));
  let n = sub([0, 1, 0], mul(t, t[1]));
  if (Math.hypot(...n) < .2) n = sub([1, 0, 0], mul(t, t[0]));
  n = norm(n);
  return { t, n, b: cross(t, n) };
});
const line = (a, b, m = 6) => Array.from({ length: m }, (_, i) => mix(a, b, i / (m - 1)));

// Mesh data gathered in arrays, relative to an origin o.

const geo = (o = [0, 0, 0]) => ({ o, p: [], c: [], i: [] });
const vert = (G, q, col) => { G.p.push(q[0] - G.o[0], q[1] - G.o[1], q[2] - G.o[2]); G.c.push(col[0], col[1], col[2]); return G.p.length / 3 - 1; };

// A tube along pts with radius rad(s) and colour col(s, up, i, j), up being +1 on top and -1 underneath. s runs
// from s0 to s1 along it. each(d, R, s) sees every vertex's outward direction.

const tube = (G, pts, F, rad, col, seg, s0 = 0, s1 = 1, each) => {
  const i0 = G.p.length / 3, n = pts.length;
  pts.forEach((p, i) => {
    const s = s0 + (s1 - s0) * i / (n - 1), R = rad(s);
    for (let j = 0; j < seg; j++) {
      const a = j / seg * 2 * Math.PI, d = add(mul(F[i].n, Math.cos(a)), mul(F[i].b, Math.sin(a)));
      vert(G, add(p, mul(d, R)), col(s, Math.cos(a), i, j));
      each?.(d, R, s);
    }
  });
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i0 + i * seg + j, b = i0 + i * seg + (j + 1) % seg;
    G.i.push(a, b, a + seg, b, b + seg, a + seg);
  }
};

// A cone from base along dir, coloured c0 at the base and c1 at the tip.

const cone = (G, base, dir, len, rb, c0, c1, sides = 5) => {
  const d = norm(dir), e = norm(cross(d, Math.abs(d[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), f = cross(d, e);
  const tip = vert(G, add(base, mul(d, len)), c1), ring = [];
  for (let k = 0; k < sides; k++) {
    const a = k / sides * 2 * Math.PI;
    ring.push(vert(G, add(base, add(mul(e, Math.cos(a) * rb), mul(f, Math.sin(a) * rb))), c0));
  }
  for (let k = 0; k < sides; k++) G.i.push(ring[k], ring[(k + 1) % sides], tip);
};

// A loft of rounded sections [x, half width, half height, lift] along a frame's forward axis. Sections are
// squarish, and flatter underneath by the share under.

const loft = (G, at, secs, col, seg = 16, under = .55) => {
  const i0 = G.p.length / 3;
  secs.forEach(([x, w, h, y], i) => {
    for (let j = 0; j < seg; j++) {
      const a = j / seg * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a);
      const yy = y + h * Math.sign(c) * Math.abs(c) ** .8 * (c < 0 ? under : 1), zz = w * Math.sign(s) * Math.abs(s) ** .8;
      vert(G, at(x, yy, zz), col(i / (secs.length - 1), c, i, j));
    }
  });
  for (let i = 0; i < secs.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i0 + i * seg + j, b = i0 + i * seg + (j + 1) % seg;
    G.i.push(a, b, a + seg, b, b + seg, a + seg);
  }
};

// A membrane from the bone apex A out to the edge Pa-Pb. The edge scallops inward by the share sc, and the skin
// sags by sag of the edge's length.

const panel = (G, A, Pa, Pb, sc, sag, col, n = 6) => {
  const nr = norm(cross(sub(Pa, A), sub(Pb, A))), sg = nr[1] > 0 ? -1 : 1, Lb = Math.hypot(...sub(Pb, Pa)), rows = [];
  for (let i = 0; i <= n; i++) {
    rows.push([]);
    for (let j = 0; j <= i; j++) {
      const u = i / n, v = i ? j / i : 0, e = mix(A, mix(Pa, Pb, v), 1 - sc * Math.sin(Math.PI * v));
      rows[i].push(vert(G, add(mix(A, e, u), mul(nr, sg * sag * Lb * 4 * u * (1 - u) * Math.sin(Math.PI * v))), col(u, v)));
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    G.i.push(rows[i][j], rows[i + 1][j], rows[i + 1][j + 1]);
    if (j < i) G.i.push(rows[i][j], rows[i + 1][j + 1], rows[i][j + 1]);
  }
};

// The scale colours: a dark green-bronze back, bronze flanks and a gold belly of plates, with the scales in a
// fine checker. Horn runs from old ivory to black.

const BACK = [.06, .09, .05], FLANK = [.14, .14, .07], BELLY = [.34, .25, .12], HORN = [.32, .27, .18], TIP = [.04, .03, .03];
const scaleCol = (s, up, i, j) => {
  const c = up > 0 ? mix(FLANK, BACK, up) : mix(FLANK, BELLY, Math.min(1, -up * 1.6));
  return mul(c, up < -.4 ? (i % 3 ? 1 : .7) : (i + j) % 2 ? .82 : 1.08);
};
const hornCol = s => mix(HORN, TIP, s ** 1.4);

// The lindworm, about 60 m from nose to tail and 45 m across the wings. Its tail lies on the nave ridge, its body
// coils round the lantern on the crossing tower's gallery, and its neck rears up to look out over the city to
// the north-west. It returns its update hook.

function dragon(H) {
  const T = H.THREE, decor = H.decor;
  const scales = new T.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: .4, side: T.DoubleSide });
  const skinMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: .8, metalness: .05, side: T.DoubleSide });
  const fire = new T.MeshBasicMaterial({ color: new T.Color(2.6, 1, .22) });
  const eyeMat = new T.MeshBasicMaterial({ color: new T.Color(3.2, 1.7, .3) });
  const mesh = (G, mat) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(G.p, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(G.c, 3));
    g.setIndex(G.i);
    g.computeVertexNormals();
    return new T.Mesh(g, mat);
  };
  const ball = (p, rad, mat, o) => { const m = new T.Mesh(new T.SphereGeometry(rad, 10, 8), mat); m.position.set(...sub(p, o)); return m; };

  // The spine: the tail on the ridge, over the gallery parapet, 225 degrees round the lantern, then the neck.

  const C = [15, 0], RC = 6.6, GAL = 52.05, N = 240;
  const ctrl = [[-3, 51.25, .1], [.5, 51.45, -.12], [3.5, 52.3, .5], [6.6, 54, 2.8]];
  for (let k = 0; k <= 10; k++) {
    const a = (135 - k * 22.5) * DEG;
    ctrl.push([C[0] + RC * Math.cos(a), 52.6 + .12 * k, C[1] + RC * Math.sin(a)]);
  }
  ctrl.push([11.8, 57.4, -7.7], [9.9, 60.6, -9.3], [8.9, 63.6, -10.7], [8.5, 65.7, -11.6]);
  const { pts } = curve(ctrl, N);
  const rad = s => s < .5 ? .14 + 1.5 * (s / .5) ** .85 : s < .8 ? 1.64 + .12 * Math.sin((s - .5) / .3 * Math.PI) : 1.64 - .7 * ((s - .8) / .2) ** .8;
  const sOf = i => i / (N - 1);

  // The coil rests on the gallery floor.

  pts.forEach((p, i) => { if (Math.hypot(p[0] - C[0], p[2] - C[1]) < 8.4) p[1] = Math.max(p[1], GAL + rad(sOf(i)) * .96); });
  const F = frames(pts), iS = Math.round(.835 * (N - 1)), P0 = pts[iS];
  const radial = p => norm([p[0] - C[0], 0, p[2] - C[1]]);

  // The point on the coil nearest the bearing deg round the lantern, counted as the coil runs from 135 to -90.

  const onCoil = deg => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < iS; i++) {
      const p = pts[i];
      if (Math.hypot(p[0] - C[0], p[2] - C[1]) > 7.5) continue;
      let a = Math.atan2(p[2] - C[1], p[0] - C[0]) / DEG;
      if (a > 150) a -= 360;
      if (Math.abs(a - deg) < bd) { bd = Math.abs(a - deg); best = i; }
    }
    return best;
  };

  // The body as far as the neck. Its chest swells with each breath.

  const G = geo(), swell = [];
  const bump = s => s > .5 && s < .82 ? Math.sin(Math.PI * (s - .5) / .32) ** 2 : 0;
  tube(G, pts.slice(0, iS + 2), F, rad, scaleCol, 18, 0, sOf(iS + 1), (d, R, s) => swell.push(...mul(d, R * .07 * bump(s))));
  const Gn = geo(P0);
  tube(Gn, pts.slice(iS), F.slice(iS), rad, scaleCol, 16, sOf(iS), 1);

  // Spines down the back, swept toward the tail, with obsidian-red tips.

  for (let i = 6; i < N - 4; i += 4) {
    const s = sOf(i), R = rad(s), f = F[i];
    cone(i <= iS ? G : Gn, add(pts[i], mul(f.n, R * .85)), sub(mul(f.n, Math.cos(.6)), mul(f.t, Math.sin(.6))), .3 + .75 * R, .12 + .14 * R, TIP, [.3, .06, .03], 4);
  }

  // The spade at the tail's tip.

  {
    const f = F[3], A = pts[3], tip = sub(A, mul(f.t, 2.4)), c = [.14, .05, .04];
    const a = vert(G, A, c), t = vert(G, tip, TIP), l = vert(G, add(sub(A, mul(f.t, .9)), mul(f.b, 1)), c), rr = vert(G, sub(sub(A, mul(f.t, .9)), mul(f.b, 1)), c);
    G.i.push(a, l, t, a, t, rr);
  }

  // Legs: hind legs near the coil's start and forelegs near the shoulders. Outer feet grip the gallery's edge and
  // inner feet the lantern wall.

  for (const [deg, fore] of [[100, false], [-50, true]]) for (const out of [1, -1]) {
    const i = onCoil(deg), p = pts[i], f = F[i], R = rad(sOf(i)), rd = radial(p);
    const side = dot(f.b, rd) > 0 ? f.b : mul(f.b, -1), sd = mul(side, out), dist = Math.hypot(p[0] - C[0], p[2] - C[1]);
    const hip = add(add(p, mul(sd, R * .7)), mul(f.n, -R * .15));
    const r2 = out > 0 ? Math.min(dist + 1.5, 7.3 / Math.max(Math.abs(rd[0]), Math.abs(rd[2]))) : 5.3, foot = [C[0] + rd[0] * r2, out > 0 ? GAL + .25 : p[1] - .2, C[1] + rd[2] * r2];
    const knee = add(add(mix(hip, foot, .5), add(mul(sd, .7), mul(f.n, .9))), mul(f.t, fore ? .5 : -.6));
    const F1 = frames(line(hip, knee)), F2 = frames(line(knee, foot));
    tube(G, line(hip, knee), F1, s2 => .7 - .25 * s2, scaleCol, 8);
    tube(G, line(knee, foot), F2, s2 => .42 - .14 * s2, scaleCol, 8);
    const fw = out > 0 ? rd : mul(rd, -1);
    for (const k of [-1, 0, 1]) cone(G, foot, add(add(fw, mul(f.t, k * .55)), [0, -.35, 0]), .95, .17, HORN, TIP, 4);
    cone(G, foot, add(mul(fw, -.6), [0, -.3, 0]), .6, .14, HORN, TIP, 4);
  }

  // The head, looking out over the city, with a lower jaw that opens on the ember in its throat.

  const base = pts[N - 1], Fw = norm([-.74, -.12, -.66]), U = norm(sub([0, 1, 0], mul(Fw, Fw[1]))), Sd = cross(Fw, U);
  const hf = (x, y, z) => add(base, add(mul(Fw, x - .3), add(mul(U, y), mul(Sd, z))));
  loft(Gn, hf, [[0, .95, .95, 0], [.6, 1.25, 1.12, .12], [1.5, 1.2, 1.05, .28], [2.4, .95, .8, .2], [3.4, .72, .6, .05],
    [4.3, .55, .48, -.05], [4.9, .4, .36, -.1], [5.2, .1, .1, -.12]], (s, up, i, j) => scaleCol(.9, up, i, j));
  const hinge = hf(1, -.45, 0), Gj = geo(hinge);
  loft(Gj, hf, [[1, .85, .3, -.62], [2.2, .78, .3, -.74], [3.4, .6, .24, -.74], [4.4, .44, .18, -.68], [4.95, .14, .07, -.64]],
    (s, up, i, j) => scaleCol(.9, up, i, j), 12, 1);
  const IVORY = [.42, .38, .3];
  for (let x = 2.6; x < 4.8; x += .42) {
    const w = x < 3.4 ? .95 - (x - 2.4) * .23 : .72 - (x - 3.4) * .19, bot = x < 3.4 ? -.24 : -.25;
    for (const z of [-1, 1]) {
      cone(Gn, hf(x, bot + .05, z * (w - .12)), mul(U, -1), .36, .08, IVORY, [.6, .55, .45], 4);
      cone(Gj, hf(x + .2, -.46, z * (w - .2)), U, .3, .07, IVORY, [.6, .55, .45], 4);
    }
  }
  for (const z of [-1, 1]) {
    const horn = (ps, r0) => { const q = ps.map(([x, y, w]) => hf(x, y, w * z)); tube(Gn, q, frames(q), s => r0 * (1 - .9 * s), hornCol, 7); };
    horn(curve([[1.4, .85, .7], [.6, 1.6, 1.15], [-.6, 2.25, 1.5], [-1.9, 2.5, 1.4], [-3.1, 2.2, 1.05]], 16).pts, .4);
    horn(curve([[.9, .25, 1.05], [-.2, .35, 1.6], [-1.4, .15, 1.85], [-2.2, -.2, 1.8]], 10).pts, .24);
    const spike = (p, d, len, rb) => cone(Gn, hf(...p), add(add(mul(Fw, d[0]), mul(U, d[1])), mul(Sd, d[2] * z)), len, rb, HORN, TIP, 4);
    spike([2.1, .95, .65], [-.7, .7, .3], .6, .12);
    spike([1.1, -.25, 1.1], [-1, 0, .6], 1.1, .16);
    spike([.2, .6, .7], [-1, .3, .5], 1.4, .18);
    spike([0, .2, .95], [-1, .3, .5], 1.2, .16);
    spike([-.1, -.25, .9], [-1, .3, .5], .9, .14);
  }
  cone(Gn, hf(4.3, .4, 0), add(U, mul(Fw, .6)), .55, .12, HORN, TIP, 4);

  // The neck and head turn on a pivot at the neck's root, and the jaw on its hinge.

  const head = new T.Group(), jaw = new T.Group();
  head.position.set(...P0);
  head.add(mesh(Gn, scales));
  jaw.position.set(...sub(hinge, P0));
  jaw.add(mesh(Gj, scales));
  head.add(jaw);
  const ember = [ball(hf(1.8, -.52, 0), .55, fire, P0), ball(hf(2.7, -.5, 0), .32, fire, P0), ball(hf(3.5, -.53, 0), .24, fire, P0)];
  for (const z of [-1, 1]) {
    head.add(ball(hf(2.15, .62, z * .92), .2, eyeMat, P0));
    ember.push(ball(hf(4.85, .1, z * .24), .09, fire, P0));
  }
  head.add(...ember);
  const nose = sub(hf(5.2, .1, 0), P0);

  // Wings at the shoulders. The outer wing spreads half open over the north transept. The inner one stands raised
  // beside the crown spire, leaning out past upright so it clears the lantern's pinnacles.

  const iW = onCoil(-72), pw = pts[iW], fw = F[iW], Rw = rad(sOf(iW));
  const outS = dot(fw.b, radial(pw)) > 0 ? fw.b : mul(fw.b, -1);
  const DESIGN = [[0, 0, 0], [6, 2.2, -1], [11, 4.8, -2.5], [21, 6.5, 1.5], [19, 1.8, 6.5], [14.5, -1.2, 10], [8.5, -2, 11.5]];
  const memCol = (u, v) => mix([.12, .035, .03], [.36, .1, .06], Math.sin(Math.PI * v) * (.4 + .6 * u));
  const wing = (X, raise, k, lift) => {
    const Sh = add(add(pw, mul(X, Rw * lift[0])), mul(fw.n, Rw * lift[1])), Z = mul(fw.t, -1), c = Math.cos(raise), s = Math.sin(raise);
    const D = ([x, y, z]) => add(Sh, add(mul(X, k * (x * c - y * s)), add(mul(fw.n, k * (x * s + y * c)), mul(Z, k * z))));
    const [S0, E, W, ...fingers] = DESIGN.map(D), Gw = geo(Sh);
    const root = i => add(add(pts[i], mul(X, rad(sOf(i)) * lift[0] * .9)), mul(F[i].n, rad(sOf(i)) * .3));
    const R1 = root(iW - 14), R2 = root(iW - 30);
    const bone = (a, b, r0, r1) => { const q = line(a, b); tube(Gw, q, frames(q), s2 => k * (r0 + (r1 - r0) * s2), scaleCol, 7); };
    bone(S0, E, .5, .38); bone(E, W, .38, .28);
    for (const f of fingers) bone(W, f, .24, .05);
    cone(Gw, W, add(norm(sub(W, E)), mul(fw.n, .6)), 1.3 * k, .2, HORN, TIP, 4);
    const [F1, F2, F3, F4] = fingers;
    panel(Gw, W, F1, F2, .2, .05, memCol); panel(Gw, W, F2, F3, .2, .05, memCol); panel(Gw, W, F3, F4, .2, .05, memCol);
    panel(Gw, W, F4, R2, .16, .05, memCol); panel(Gw, W, R2, R1, 0, .03, memCol, 4); panel(Gw, W, R1, S0, 0, .02, memCol, 3);
    panel(Gw, W, S0, E, 0, 0, memCol, 2);
    const g = new T.Group();
    g.position.set(...Sh);
    g.add(mesh(Gw, skinMat));
    decor.add(g);
    return g;
  };
  const wingOut = wing(outS, .3, 1, [.75, .45]), wingIn = wing(mul(outS, -1), 1.75, .82, [.35, .8]);
  const axis = new T.Vector3(...fw.t);

  // The body mesh, and the smoke that drifts from the nostrils.

  const body = mesh(G, scales), posAttr = body.geometry.attributes.position, rest = Float32Array.from(posAttr.array);
  decor.add(body, head);
  const smokeGeo = new T.IcosahedronGeometry(1, 1);
  const puffs = Array.from({ length: 12 }, () => {
    const m = new T.Mesh(smokeGeo, H.soften(new T.MeshBasicMaterial({ color: new T.Color(.13, .12, .11), transparent: true, opacity: 0, depthWrite: false })));
    m.visible = false;
    decor.add(m);
    return m;
  });

  // Each breath takes 6.5 s. Every third breath is an exhale. The jaw parts, the ember flares and smoke rolls
  // from the nostrils, while the head turns slowly to watch the city.

  const CYCLE = 19.5, LIFE = 7;
  return t => {
    const b = Math.sin(t * 2 * Math.PI / 6.5), ph = ((t % CYCLE) + CYCLE) % CYCLE;
    const flare = ph > 13 && ph < 17 ? Math.sin((ph - 13) / 4 * Math.PI) : 0;
    const arr = posAttr.array;
    for (let i = 0; i < swell.length; i++) arr[i] = rest[i] + swell[i] * b;
    posAttr.needsUpdate = true;
    const yaw = .14 * Math.sin(t * .13) + .05 * Math.sin(t * .31 + 1);
    head.rotation.y = yaw;
    jaw.quaternion.setFromAxisAngle(new T.Vector3(...Sd), -(.05 + .2 * flare + .02 * b));
    wingOut.quaternion.setFromAxisAngle(axis, .05 * b + .03 * Math.sin(t * .23));
    wingIn.quaternion.setFromAxisAngle(axis, -.03 * b + .02 * Math.sin(t * .29 + 2));
    const k = 1 + .25 * Math.sin(t * 5.3) * Math.sin(t * 2.1) + 2.2 * flare;
    fire.color.setRGB(2.6 * k, k, .22 * k);
    eyeMat.color.setRGB(3.2 * (1 + .4 * flare), 1.7 * (1 + .4 * flare), .3);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const nz = [P0[0] + nose[0] * cy + nose[2] * sy, P0[1] + nose[1], P0[2] - nose[0] * sy + nose[2] * cy];
    const fwd = [Fw[0] * cy + Fw[2] * sy, Fw[1], -Fw[0] * sy + Fw[2] * cy];
    puffs.forEach((m, j) => {
      const age = (((t - 13 - j * .3) % CYCLE) + CYCLE) % CYCLE;
      m.visible = age < LIFE;
      if (!m.visible) return;
      const go = 2.2 * (1 - Math.exp(-age)), q = add(add(nz, mul(fwd, go)), [1.1 * age, 1.3 * age, .5 * age]);
      m.position.set(...q);
      m.scale.set(.35 + .45 * age, .35 + .45 * age, .35 + .45 * age);
      m.material.opacity = .32 * Math.min(1, age * 3) * (1 - age / LIFE);
    });
  };
}

export function landmarks(H) {
  const out = {};
  const { each } = helpers(H, out);
  each('fantasy', () => {
    let tick = null;
    return {
      labelY: 96,
      build(x, z, w, d, st, r) {
        cathedral(kit(H, st, r));
        tick = dragon(H);
        return { focus: [0, 0], span: 190, face: [-1, -.6] };
      },
      update(t) { tick?.(t); },
    };
  });
  return out;
}
