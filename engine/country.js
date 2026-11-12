// Country round the town, for a pack whose look.country is set and whose terrain is engine/hills.js. The pack
// lists its terrain types as data in look.country.types. The engine gives the primitives: layouts cut the land into
// parcels, painters colour a parcel in one ground texture, and builders add its 3D features to one merged mesh.
// SETTINGS.md describes the schema. Everything comes from a seed, so the same pack always grows the same country.
// ?country=0 turns it off.
//
// The fields layout cuts the open land into field systems, patches about zone metres across, each turned to the
// nearest road, split into rows and the rows into fields. The borders between patches are lanes. A field takes the
// first fields type whose where rules hold at its middle. Fields keep off the town's wards, its streets and roads,
// the water and the ground round landmarks. The blobs and outline layouts lay woods, scrub or groves over the fields.
//
// A range [a, d] in the schema runs from a to a + d.

import * as THREE from 'three';
import { CITY, lerp, sdPoly, smooth, vnoise } from './core.js';
import { SETTING, inPack } from './setting.js';
import { KEEPS, chamfer } from './edge.js';
import { terrainAt } from './relief.js';
import { RIVER_OUTLINES } from './rivers.js';

const ASK = SETTING.look.country;
export const COUNTRY = ASK && new URLSearchParams(location.search).get('country') !== '0' && {
  seed: 1, px: 4, pad: 1000, ...ASK,
  fields: { zone: 450, size: [70, 100], lane: [.36, .32, .18], verge: [.3, .36, .14], ...ASK.fields },
  steep: { slope: [.6, .45], ...ASK.steep },
};

// Pack builder modules that clusters name, as landmark kits are named: a path inside the pack.

const MODS = {};
if (COUNTRY) for (const T of COUNTRY.types) for (const K of T.clusters ?? []) if (K.module) MODS[K.module] ??= (await import(inPack(K.module))).default;

// The hills and the ground map read the field texture through these. Its colours are stored as square roots, so
// dark greens keep their steps in eight bits.

export const COUNTRY_U = { uFields: { value: new THREE.DataTexture(new Uint8Array(4), 1, 1) }, uFieldBox: { value: new THREE.Vector4(0, 0, 0, 0) },
  uFieldSize: { value: new THREE.Vector2(1, 1) } };
export const COUNTRY_GLSL = `
  uniform sampler2D uFields; uniform vec4 uFieldBox; uniform vec2 uFieldSize;
  float cHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  float cNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
    return mix(mix(cHash(i), cHash(i + vec2(1, 0)), u.x), mix(cHash(i + vec2(0, 1)), cHash(i + vec2(1, 1)), u.x), u.y);
  }
  vec3 countryColour(vec2 w, vec3 base) {
    vec2 uv = (w - uFieldBox.xy) * uFieldBox.zw;
    if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return base;

    // Up close a texel spans many pixels, so the blend between texels narrows to keep field edges crisp, and a
    // little noise makes them ragged instead of stepped.

    vec2 t = uv * uFieldSize - .5, near = clamp(.3 / max(fwidth(t), vec2(1e-4)), 1., 2.5);
    t += (vec2(cNoise(w * .35), cNoise(w * .35 + 7.)) - .5) * .6 * step(1.01, near);
    vec2 i = floor(t), g = clamp((t - i - .5) * near + .5, 0., 1.);
    vec4 f = textureGrad(uFields, (i + g + .5) / uFieldSize, dFdx(uv), dFdy(uv));

    // Crops and grass show a fine grain only where it is larger than a pixel.

    float far = smoothstep(.4, 2., length(fwidth(w)));
    float n = mix(cNoise(w * .4) * .55 + cNoise(w * 1.9) * .45, .5, far);
    return mix(base, f.rgb * f.rgb * (.86 + .28 * n), f.a);
  }
`;

// The hills' ground material reads the fields in place of its own colour.

function patch(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => {
    prev.call(mat, s, r);
    Object.assign(s.uniforms, COUNTRY_U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vCW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCW = (modelMatrix * vec4(transformed, 1.)).xz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec2 vCW;\n${COUNTRY_GLSL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = countryColour(vCW, diffuseColor.rgb);');
  };
  mat.customProgramCacheKey = () => 'country';
}

// A hash of three integers to [0, 1).

const h3 = (a, b, c) => {
  let h = Math.imul(a ^ 0x2c1b3c6d, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};
const pick = (list, t) => {
  const sum = list.reduce((s, e) => s + (e[3] ?? 1), 0);
  let a = t * sum;
  for (const e of list) if ((a -= e[3] ?? 1) < 0) return e;
  return list[list.length - 1];
};

// Item shapes. A tree is a crown on a three-sided trunk; the others set its proportions.

const SHAPES = { palm: { lift: 3.4, squash: .3, trunk: true }, bush: { lift: .55, squash: .7, trunk: false }, rock: { lift: .1, squash: .55, trunk: false, tint: .2 } };
const NONE = [], NO_SHAPE = {};

// buildCountry(H, group, mat, height, slope) paints the country for the hills' material and adds its 3D features to
// the terrain group. height(x, z) is the height of the hills' ground as drawn, slope(x, z) its rise per metre.
//
// Steep ground, from steep.slope[0] rise per metre to full at [0] + [1], is bare: scree first, then rock in strata.
// No field, wood, farm, hedge or item stands on it. Its colours are steep.rock and steep.scree, by default the
// pack's look.rock or look.land.rock, and that a little darker.

export function buildCountry(H, group, mat, height, slope = () => 0) {
  const t0 = performance.now(), C = COUNTRY, F = C.fields, PX = C.px, S = C.seed * 7919;
  const ST = C.steep, ROCK = ST.rock ?? SETTING.look.rock ?? SETTING.look.land?.rock ?? [.4, .37, .33];
  const SCREE = ST.scree ?? ROCK.map(v => v * .95), steep = (x, z) => smooth(ST.slope[0], ST.slope[0] + ST.slope[1], slope(x, z));
  const [ox, oz] = CITY.origin, [dx, dz] = CITY.dims;
  const X0 = ox - C.pad, Z0 = oz - C.pad, RW = dx + 2 * C.pad, RD = dz + 2 * C.pad;
  const W = Math.ceil(RW / PX), D = Math.ceil(RD / PX);
  const PARCEL = C.types.filter(T => T.layout === 'fields'), OVER = C.types.filter(T => T.layout === 'blobs' || T.layout === 'outline');

  // Distance to the wards, and to anything fields keep off: wards, water, streets and roads, and the ground round
  // landmarks and places. Both are rasters at PX metres a cell.

  const path = (g, P) => { g.beginPath(); P.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); };
  const raster = draw => {
    const g = new OffscreenCanvas(W, D).getContext('2d', { willReadFrequently: true });
    g.setTransform(1 / PX, 0, 0, 1 / PX, -X0 / PX, -Z0 / PX);
    g.fillStyle = g.strokeStyle = '#fff'; g.lineCap = g.lineJoin = 'round';
    draw(g);
    const px = g.getImageData(0, 0, W, D).data, free = new Uint8Array(W * D);
    for (let i = 0; i < W * D; i++) free[i] = px[i * 4] < 128;
    return chamfer(free, W, D);
  };
  const wards = g => { for (const d of CITY.districts) { path(g, d.poly); g.fill(); } };
  const town = raster(wards);
  const off = raster(g => {
    wards(g);
    g.lineWidth = 10;
    for (const w of CITY.water ?? []) { path(g, w.poly); g.closePath(); g.fill(); g.stroke(); }
    for (const P of RIVER_OUTLINES) { path(g, P); g.closePath(); g.fill(); g.stroke(); }
    for (const [kind, lines] of Object.entries(CITY.streets)) {
      g.lineWidth = (CITY.widths?.[kind] ?? 6) + 10;
      for (const L of lines) { path(g, L); g.stroke(); }
    }

    // A keep circle carries a margin for the frayed edge; fields come closer, to three quarters of it.

    for (const [x, z, r] of KEEPS) { g.beginPath(); g.arc(x, z, r * .75, 0, Math.PI * 2); g.fill(); }
  });
  const water = C.types.some(T => T.where?.water) && raster(g => {
    for (const P of [...(CITY.water ?? []).map(w => w.poly), ...RIVER_OUTLINES]) { path(g, P); g.closePath(); g.fill(); }
  });
  const dist = (A, x, z) => {
    const i = Math.min(W - 1, Math.max(0, Math.floor((x - X0) / PX))), j = Math.min(D - 1, Math.max(0, Math.floor((z - Z0) / PX)));
    return A[j * W + i] * PX / 3;
  };

  // A type's where rules: bands [low, high) of distance from the town and the water, height and slope (rise per
  // metre). jitter widens or narrows the bands per parcel by up to that share, from the hash t. share keeps that
  // share of the parcels that pass, by the hash u.

  const rise = (x, z) => Math.hypot(height(x + 4, z) - height(x - 4, z), height(x, z + 4) - height(x, z - 4)) / 8;
  const inBand = (b, v, j) => v >= b[0] * j && v < (b[1] ?? Infinity) * j;
  const fits = (w, x, z, t, u) => {
    if (!w) return true;
    const J = w.jitter ?? 0, j = 1 - J + 2 * J * t;
    return (!w.town || inBand(w.town, dist(town, x, z), j)) && (!w.water || inBand(w.water, dist(water, x, z), j))
      && (!w.height || inBand(w.height, height(x, z), j)) && (!w.slope || inBand(w.slope, rise(x, z), j)) && !(u >= w.share);
  };

  // A gentle warp bends rows and lanes, sampled on a 16 m grid and read back smoothly. Its inverse takes a point
  // of the warped plan back to the land.

  const WS = 16, WW = Math.ceil(RW / WS) + 2, WD = Math.ceil(RD / WS) + 2, wx = new Float32Array(WW * WD), wz = new Float32Array(WW * WD);
  for (let j = 0; j < WD; j++) for (let i = 0; i < WW; i++) {
    const x = X0 + i * WS, z = Z0 + j * WS;
    wx[j * WW + i] = 120 * (vnoise(x / 700 + 3, z / 700 + 1) - .5) + 36 * (vnoise(x / 200 + 9, z / 200 + 4) - .5);
    wz[j * WW + i] = 120 * (vnoise(x / 700 + 13, z / 700 + 7) - .5) + 36 * (vnoise(x / 200 + 2, z / 200 + 15) - .5);
  }
  let QX = 0, QZ = 0;
  const warp = (x, z) => {
    const fx = Math.min(WW - 1.001, Math.max(0, (x - X0) / WS)), fz = Math.min(WD - 1.001, Math.max(0, (z - Z0) / WS));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * WW + i;
    QX = x + lerp(lerp(wx[k], wx[k + 1], u), lerp(wx[k + WW], wx[k + WW + 1], u), v);
    QZ = z + lerp(lerp(wz[k], wz[k + 1], u), lerp(wz[k + WW], wz[k + WW + 1], u), v);
  };
  const unwarp = (qx, qz) => {
    let x = qx, z = qz;
    for (let k = 0; k < 4; k++) { warp(x, z); x += qx - QX; z += qz - QZ; }
    return [x, z];
  };

  // ---------- the fields layout ----------
  // Each field system has one centre per cell of a jittered grid, turned along the nearest street or road within 900 m.
  // Street segments sit in 300 m buckets by their midpoint, so a centre searches only the buckets within reach.

  const SEGS = new Map(), sk = (i, j) => i * 65536 + j;
  for (const lines of Object.values(CITY.streets)) for (const L of lines) for (let i = 1; i < L.length; i++) {
    const k = sk(Math.floor((L[i - 1][0] + L[i][0]) / 600), Math.floor((L[i - 1][1] + L[i][1]) / 600));
    if (!SEGS.has(k)) SEGS.set(k, []);
    SEGS.get(k).push([...L[i - 1], ...L[i]]);
  }
  const ZS = F.zone, F0 = F.size[0], F1 = F.size[0] + F.size[1], NX = Math.ceil(RW / ZS) + 3, NZ = Math.ceil(RD / ZS) + 3, ZX0 = X0 - ZS, ZZ0 = Z0 - ZS;
  const zones = [];
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i, x = ZX0 + (i + .5 + (h3(S, k, 1) - .5) * .7) * ZS, z = ZZ0 + (j + .5 + (h3(S, k, 2) - .5) * .7) * ZS;
    let best = 900 * 900, a = h3(S, k, 3) * Math.PI;
    const bi = Math.floor(x / 300), bj = Math.floor(z / 300);
    for (let di = -4; di <= 4; di++) for (let dj = -4; dj <= 4; dj++) for (const [ax, az, bx, bz] of SEGS.get(sk(bi + di, bj + dj)) ?? []) {
      const ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
      const d = (ax + ex * t - x) ** 2 + (az + ez * t - z) ** 2;
      if (d < best) { best = d; a = Math.atan2(ez, ex); }
    }
    a += (h3(S, k, 4) - .5) * .4;
    zones.push({ k, x, z, c: Math.cos(a), s: Math.sin(a), a, rows: new Map(), row: lerp(F0, lerp(F0, F1, .6), h3(S, k, 5)) });
  }

  // The zone whose centre is nearest a warped point, and how far the point lies from that zone's border.

  let ZB = 0;
  const zoneAt = (qx, qz) => {
    const fi = Math.floor((qx - ZX0) / ZS), fj = Math.floor((qz - ZZ0) / ZS);
    let z1 = null, z2 = null, d1 = Infinity, d2 = Infinity;
    for (let j = Math.max(0, fj - 1); j <= Math.min(NZ - 1, fj + 1); j++) for (let i = Math.max(0, fi - 1); i <= Math.min(NX - 1, fi + 1); i++) {
      const Z = zones[j * NX + i], d = (Z.x - qx) ** 2 + (Z.z - qz) ** 2;
      if (d < d1) { z2 = z1; d2 = d1; z1 = Z; d1 = d; } else if (d < d2) { z2 = Z; d2 = d; }
    }
    ZB = z2 ? (d2 - d1) / (2 * Math.hypot(z2.x - z1.x, z2.z - z1.z)) : 1e9;
    return z1;
  };

  // A row's fields share a width, the offset of the first edge and the slant of the edges across the row.

  const rowOf = (Z, r) => {
    let R = Z.rows.get(r);
    if (!R) {
      const w = lerp(F0 * 1.1, F1, h3(S + Z.k, r, 6)), sl = (h3(S + Z.k, r, 8) - .5) * .5;
      Z.rows.set(r, R = { w, off: h3(S + Z.k, r, 7) * w, sl, cos: 1 / Math.hypot(1, sl) });
    }
    return R;
  };
  const toLand = (Z, u, v) => unwarp(Z.x + u * Z.c - v * Z.s, Z.z + u * Z.s + v * Z.c);

  // typeOf finds a field's middle and its type: the first fields type whose where rules hold there, else the last.

  const TYPES = new Map(), fkey = (Z, r, c) => (Z.k * 256 + r + 128) * 256 + c + 128;
  const typeOf = (Z, r, c) => {
    const key = fkey(Z, r, c);
    let e = TYPES.get(key);
    if (e) return e;
    const R = rowOf(Z, r), id = Math.floor(h3(S + Z.k, r * 997 + c, 9) * 4294967296);
    const [x, z] = toLand(Z, (c + .5) * R.w - R.off, (r + .5) * Z.row), t = h3(id, S, 1);
    const T = PARCEL.find((T, i) => fits(T.where, x, z, t, h3(id, S, 30 + i))) ?? PARCEL[PARCEL.length - 1];
    TYPES.set(key, e = { T, R, id, x, z });
    return e;
  };

  // The edge a field owns along its top (side 0) or left (side 1), from its type's edges list by share, or null.
  // When every fields type shares one list, the edge needs no type.

  const EDGES0 = PARCEL[0].edges ?? NONE, SAME = PARCEL.every(T => (T.edges ?? NONE) === EDGES0);
  const edgeKind = (Z, r, c, side) => {
    const L = SAME ? EDGES0 : typeOf(Z, r, c).T.edges ?? NONE;
    if (!L.length) return null;
    const t = h3(S + Z.k, r * 997 + c, side ? 21 : 22);
    let a = 0;
    for (const E of L) if (t < (a += E.share)) return E;
    return null;
  };

  // A parcel's tone by weight and shade, and its painter: the first of marks that its share lets in, from the hash
  // t(k) onward.

  const markOf = (list, t, k, tone) => {
    for (let i = 0; i < list.length; i++) {
      const M = list[i];
      if (t(k + i) >= (M.share ?? 1)) continue;
      const p = M.period === undefined ? 0 : typeof M.period === 'number' ? M.period : M.period[0] + t(k + i + 1) * M.period[1];
      return { M, p, along: M.along ?? t(k + i + 2) < .5, dark: tone.map(v => v * (M.dark ?? .72)) };
    }
    return null;
  };
  const parcel = (tones, marks, t, k, sh) => {
    const pt = pick(tones, t(k)), shade = sh === undefined ? .92 + .16 * t(k + 1) : 1 - sh / 2 + sh * t(k + 1), tone = pt.slice(0, 3).map(v => v * shade);
    return { tone, mark: markOf(marks ?? NONE, t, k + 2, tone) };
  };
  const plotOf = (f, su, sv) => parcel(f.T.plots.tones, f.T.plots.marks, k => h3(f.id + su * 31 + sv * 977, S, k), 1, f.T.plots.shade);

  // fieldOf works out once per field its type, tone and painter, its plots or its cluster. Neighbouring texels
  // mostly share a field, so the last one is kept at hand.

  const FIELDS = new Map();
  let LK = -1, LF = null;
  const fieldOf = (Z, r, c) => {
    const key = fkey(Z, r, c);
    if (key === LK) return LF;
    let f = FIELDS.get(key);
    if (f) { LK = key; return LF = f; }
    const { T, R, id, x, z } = typeOf(Z, r, c), t = k => h3(id, S, k);
    f = { Z, r, c, id, x, z, T, ...parcel(T.tones, T.marks, t, 2, T.shade), top: edgeKind(Z, r, c, 0), left: edgeKind(Z, r, c, 1), right: edgeKind(Z, r, c + 1, 1) };
    if (T.plots) {
      const P = T.plots;
      f.split = [P.across[0] + Math.floor(t(7) * (P.across[1] + 1)), P.along[0] + Math.floor(t(8) * (P.along[1] + 1))];
      f.plots = [];
      for (let sv = 0; sv < f.split[1]; sv++) for (let su = 0; su < f.split[0]; su++) f.plots.push(plotOf(f, su, sv));
    } else for (let i = 0; i < (T.clusters ?? NONE).length; i++) {

      // Clusters: the first whose share lets it in and that fits takes the field. Cluster i hashes from t(10 + 4i).

      const K = T.clusters[i], b = 10 + 4 * i;
      if (t(b) >= K.share) continue;
      if (K.clump) {
        if (dist(off, x, z) <= (K.clear ?? 40)) continue;
        const Q = K.clump;
        f.clump = { Q, x: x + (t(b + 1) - .5) * R.w * .3, z: z + (t(b + 2) - .5) * Z.row * .3, r: Q.r[0] + t(b + 3) * Q.r[1] };
      } else if (K.farm) {

        // A farm stands at the field's edge nearest a lane or road, 20 m in.

        let best = Infinity, at = null;
        for (const [du, dv] of [[0, -.5], [0, .5], [-.5, 0], [.5, 0]]) {
          const [mx, mz] = toLand(Z, (c + .5 + du) * R.w - R.off, (r + .5 + dv) * Z.row);
          warp(mx, mz); zoneAt(QX, QZ);
          const s = Math.min(ZB, dist(off, mx, mz) - 12);
          if (s < best) { best = s; at = [mx, mz]; }
        }
        if (best > 30 && t(b + 1) > .3) at = [x, z];
        const k = 22 / Math.max(1, Math.hypot(x - at[0], z - at[1]));
        const fx = at[0] + (x - at[0]) * Math.min(1, k), fz = at[1] + (z - at[1]) * Math.min(1, k);
        if (dist(off, fx, fz) > (K.farm.clear ?? 22) && dist(town, fx, fz) > (K.farm.town ?? 0)) f.site = { K, x: fx, z: fz, a: Z.a + (t(b + 2) < .5 ? 0 : Math.PI / 2), id };
      } else if (dist(off, x, z) > (K.clear ?? 20)) f.site = { K, x, z, a: Z.a, id };
      break;
    }
    FIELDS.set(key, f);
    LK = key;
    return LF = f;
  };

  // Distance to the nearest farm in metres, up to 40, in a raster stamped round each farm, and that farm's yard colour.

  const YARD = new Uint8Array(W * D).fill(255), YCOL = [], YI = new Uint8Array(W * D);
  const nearFarm = (x, z) => {
    const i = Math.floor((x - X0) / PX), j = Math.floor((z - Z0) / PX);
    return i < 0 || j < 0 || i >= W || j >= D ? 255 : YARD[j * W + i];
  };
  const inClump = (q, x, z) => Math.hypot(x - q.x, z - q.z) < q.r * (.7 + .55 * vnoise(x / 18 + q.x, z / 18));

  // Every field and its cluster are known before the paint, so yards and hedges can keep clear of each other. Fields
  // are found from their zone's rows; a field whose middle lies in another zone is skipped.

  const list = [];
  for (const Z of zones) {
    const R0 = ZS * 1.1;
    for (let r = Math.floor(-R0 / Z.row); r <= Math.ceil(R0 / Z.row); r++) {
      const R = rowOf(Z, r);
      for (let c = Math.floor((-R0 + R.off) / R.w) - 1; c <= Math.ceil((R0 + R.off) / R.w) + 1; c++) {
        const [x, z] = toLand(Z, (c + .5) * R.w - R.off, (r + .5) * Z.row);
        if (x < X0 || z < Z0 || x > X0 + RW || z > Z0 + RD) continue;
        warp(x, z);
        if (zoneAt(QX, QZ) !== Z || dist(off, x, z) < 4) continue;
        list.push([Z, r, c, fieldOf(Z, r, c)]);
      }
    }
  }

  // ---------- the blobs and outline layouts ----------
  // Every blob or outline writes its signed distance (metres, positive inside, -127 to 127) into WSD and its kind
  // into WKIND: 1 for the first overlay type, 2 for the next. Paint, fields and builders read them back. Outlines
  // cover all they hold, clearings too, so fields, farms and lanes keep out.

  const WSD = new Int8Array(W * D).fill(-127), WKIND = new Uint8Array(W * D), WHOLE = [false, ...OVER.map(O => O.layout === 'outline')];
  const stamp = (x0, z0, x1, z1, kind, sd) => {
    for (let j = Math.max(0, Math.floor((z0 - Z0) / PX)); j <= Math.min(D - 1, Math.ceil((z1 - Z0) / PX)); j++)
      for (let i = Math.max(0, Math.floor((x0 - X0) / PX)); i <= Math.min(W - 1, Math.ceil((x1 - X0) / PX)); i++) {
        const o = j * W + i, d = Math.max(-127, Math.min(127, Math.round(sd(X0 + (i + .5) * PX, Z0 + (j + .5) * PX))));
        if (d === -127) continue;
        if (d > WSD[o]) { WSD[o] = d; WKIND[o] = kind; }
      }
  };
  const covered = (x, z) => {
    const i = Math.floor((x - X0) / PX), j = Math.floor((z - Z0) / PX);
    return i >= 0 && j >= 0 && i < W && j < D && WHOLE[WKIND[j * W + i]];
  };
  const overSd = (x, z) => {
    const fx = Math.min(W - 1.001, Math.max(0, (x - X0) / PX - .5)), fz = Math.min(D - 1.001, Math.max(0, (z - Z0) / PX - .5));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * W + i;
    return lerp(lerp(WSD[k], WSD[k + 1], u), lerp(WSD[k + W], WSD[k + W + 1], u), v);
  };

  // An outline fills its shape, which frays with noise, but keeps keep metres (default 40) off the town. Its
  // clearings open round where a slow noise rises, with ragged edges, and where it rises further a dark knot of trees
  // stands in the clearing's middle.

  const glade = (x, z) => vnoise(x / 160 + 5, z / 160 + 9);
  const clearing = (x, z) => { const c = glade(x, z); return Math.max((.72 - c) * 300 + 28 * (vnoise(x / 14, z / 14) - .5), (c - .88) * 400); };

  // An outline's streams wander south from near its top, each with a braid that splits off and rejoins.
  // stream(kind, x, z) sets SE, the distance from open water (negative in it), and SB, the width of the boggy meadow
  // round it.

  let SE = 1e9, SB = 0;
  const STREAMS = [[], ...OVER.map(O => O.layout !== 'outline' ? [] : O.outlines.flatMap((P, w) => {
    const xs = P.map(p => p[0]), zs = P.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), n = O.streams ?? 0;
    return Array.from({ length: n }, (_, k) => ({ k: w * 7 + k, z0: Math.min(...zs) + 150 + h3(S, w, 80 + k) * 300,
      x: lerp(x0, x1, (k + .5 + (h3(S, w, 90 + k) - .5) * .5) / n) }));
  }))];
  const stream = (kind, x, z) => {
    SE = 1e9; SB = 0;
    for (const T of STREAMS[kind]) {
      if (z < T.z0) continue;
      const k = T.k, start = smooth(T.z0, T.z0 + 150, z), xc = T.x + 440 * (vnoise(z / 500 + 17 * k, 3 * k) - .5) + 220 * (vnoise(z / 170 + 9 * k, k) - .5)
        + 50 * (vnoise(z / 45 + 4 * k, k + 2) - .5);
      const w = (2.5 + 3 * vnoise(z / 200 + k, 11)) * start, bog = (10 + 34 * vnoise(z / 150 + k, 5) ** 2 + 10 * vnoise(x / 30, z / 30)) * start;
      const braid = smooth(.4, .55, vnoise(z / 300 + 5 * k, 7)), xb = xc + braid * (30 + 70 * vnoise(z / 150 + k, 2));
      const e = Math.min(Math.abs(x - xc) - w, braid > .05 ? Math.abs(x - xb) - w * braid * .8 : 1e9);
      if (e < SE) { SE = e; SB = bog; }
    }
  };
  OVER.forEach((O, i) => {
    if (O.layout !== 'outline') return;
    for (const P of O.outlines) {
      const xs = P.map(p => p[0]), zs = P.map(p => p[1]);
      stamp(Math.min(...xs) - 300, Math.min(...zs) - 300, Math.max(...xs) + 300, Math.max(...zs) + 300, i + 1, (x, z) => {
        const inside = sdPoly(x, z, P) + 520 * (vnoise(x / 420 + 2, z / 420 + 6) - .5) + 200 * (vnoise(x / 130 + 7, z / 130) - .5)
          + 50 * (vnoise(x / 35, z / 35 + 3) - .5);
        if (inside <= 0) return -127;
        stream(i + 1, x, z);
        return Math.max(-126, Math.min(inside, dist(town, x, z) - (O.keep ?? 40), O.clearings ? clearing(x, z) : 1e9, SE - SB));
      });
    }
  });

  // A blob is round, its edge wandering with noise out to 1.25 times its radius. Blobs come from fields (one at a
  // field's corner, as large as the roads and the town let it be), from open ground in wards, and from spots.

  let busy = null;
  const BLOBS = OVER.map(() => []);
  OVER.forEach((O, i) => {
    if (O.layout !== 'blobs') return;
    const kind = i + 1, B = BLOBS[i], fr = O.from ?? {}, bi = OVER.slice(0, i).filter(o => o.layout === 'blobs').length, hb = 60 + 10 * bi;
    const S0 = O.size[0], S1 = O.size[0] + O.size[1];
    const blob = (x, z, r) => {
      const k = B.push([x, z, r]);
      stamp(x - r * 1.3, z - r * 1.3, x + r * 1.3, z + r * 1.3, kind, (px, pz) => r * (.75 + .5 * vnoise(px / 22 + k * 7.3, pz / 22)) - Math.hypot(px - x, pz - z));
    };
    if (fr.fields) for (const [Z, r, c, f] of list) {
      if (h3(f.id, S, hb) >= fr.fields || covered(f.x, f.z)) continue;
      const R = rowOf(Z, r), [x, z] = toLand(Z, c * R.w - R.off - R.sl * Z.row / 2, r * Z.row);
      const rr = Math.min(lerp(S0, S1, h3(f.id, S, hb + 1)), (dist(off, x, z) - 4) / 1.25);
      if (rr >= S0 && fits(O.where, x, z, .5, h3(f.id, S, hb + 2))) blob(x, z, rr);
    }

    // In the named wards a blob takes open ground clear of lots, streets, water and landmarks by a few metres.

    if (fr.wards?.length) {
      busy ??= raster(g => {
        for (const P of CITY.lots ?? []) { path(g, P); g.closePath(); g.fill(); }
        g.lineWidth = 6;
        for (const w of CITY.water ?? []) { path(g, w.poly); g.closePath(); g.fill(); g.stroke(); }
    for (const P of RIVER_OUTLINES) { path(g, P); g.closePath(); g.fill(); g.stroke(); }
        for (const [kind, lines] of Object.entries(CITY.streets)) {
          g.lineWidth = (CITY.widths?.[kind] ?? 6) + 6;
          for (const L of lines) { path(g, L); g.stroke(); }
        }
        for (const [x, z, r] of KEEPS) { g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2); g.fill(); }
      });
      for (const d of CITY.districts) {
        if (!fr.wards.includes(d.id)) continue;
        const xs = d.poly.map(p => p[0]), zs = d.poly.map(p => p[1]);
        for (let x = Math.min(...xs); x < Math.max(...xs); x += 50) for (let z = Math.min(...zs); z < Math.max(...zs); z += 50) {
          const t = k => h3(Math.round(x), Math.round(z), S + k + 100 * bi), wx = x + (t(1) - .5) * 40, wz = z + (t(2) - .5) * 40;
          if (t(3) >= (fr.wardShare ?? .3) || sdPoly(wx, wz, d.poly) < 10) continue;
          const rr = Math.min(lerp(S0, S1 * .6, t(4)), (dist(busy, wx, wz) - 3) / 1.25);
          if (rr >= S0) blob(wx, wz, rr);
        }
      }
    }
    for (const [x, z, r] of fr.spots ?? NONE) blob(x, z, r);
  });

  const sites = list.map(e => e[3].site).filter(F => F && overSd(F.x, F.z) < -20 && !covered(F.x, F.z) && steep(F.x, F.z) < .2);
  for (const F of sites) {
    if (!F.K.farm) continue;
    const fi = (F.x - X0) / PX, fj = (F.z - Z0) / PX, n = Math.ceil(40 / PX), yc = YCOL.indexOf(F.K.farm.yard) + 1 || YCOL.push(F.K.farm.yard);
    for (let j = Math.max(0, Math.floor(fj - n)); j <= Math.min(D - 1, fj + n); j++) for (let i = Math.max(0, Math.floor(fi - n)); i <= Math.min(W - 1, fi + n); i++) {
      const d = Math.hypot(i + .5 - fi, j + .5 - fj) * PX, o = j * W + i;
      if (d < 40 && d < YARD[o]) { YARD[o] = d; YI[o] = yc - 1; }
    }
  }

  // ---------- painters ----------
  // Paint. Each texel finds its zone, row and field in the warped plan, then draws the field's tone and painter, its
  // plots, its margins, its edges, lanes at the zone's border, yards and clumps. A blob or outline paints over it.

  const data = new Uint8Array(W * D * 4), col = [0, 0, 0];
  const mixIn = (rgb, k) => { for (let i = 0; i < 3; i++) col[i] += (rgb[i] - col[i]) * k; };

  // Steep ground: speckled scree as the slope begins, then rock in strata about 2.3 m thick that wander with the
  // land. It returns how bare the texel is.

  const bare = (x, z, i, j) => {
    const k = steep(x, z);
    if (k <= 0) return 0;
    const y = height(x, z), n = vnoise(x / 5, z / 5), g = .8 + .4 * h3(i, j, S + 77), band = .55 + .3 * vnoise(y / 2.3 + 1.5 * vnoise(x / 40, z / 40), 7);
    mixIn(SCREE.map(v => v * g * (.9 + .2 * n)), smooth(0, .5, k));
    mixIn(ROCK.map(v => v * band * (.85 + .3 * n)), smooth(.4, 1, k));
    return k;
  };

  // rows: stripes of a darker shade, period metres apart along or across the row (or the world's x or z with
  // world), bent by an optional wave [metres, scale]. dots: a grid step metres apart, as an orchard's crowns. speckle: single texels of a colour.
  // patches: noise blots of a colour.

  const markPaint = (m, u, v, x, z, i, j) => {
    const M = m.M;
    if (M.paint === 'rows') {
      const w = M.world ? m.along ? z : x : m.along ? v : u, q = (M.wave ? w + M.wave[0] * (vnoise(x / M.wave[1], z / M.wave[1]) - .5) : w) / m.p;
      mixIn(m.dark, smooth(M.soft[0], M.soft[1], Math.abs((q % 2 + 2) % 2 - 1)));
    } else if (M.paint === 'dots') {
      const s = M.step, gu = ((u % s) + s) % s - s / 2, gv = ((v % s) + s) % s - s / 2;
      mixIn(M.colour, (1 - smooth(M.r[0], M.r[1], Math.hypot(gu, gv))) * M.alpha);
    } else if (M.paint === 'speckle') {
      if (h3(i, j, S + 31) < M.density) mixIn(M.colour, M.alpha ?? 1);
    } else if (M.paint === 'patches') mixIn(M.colour, smooth(M.cut[0], M.cut[1], vnoise(x / M.scale + 3, z / M.scale + 5)) * (M.alpha ?? 1));
  };
  const edgeMark = (E, e, along) => {
    const P = E?.paint;
    if (!P) return;
    const s = P.dots ? e + 4 * Math.abs(((along / P.dots) % 1 + 1) % 1 - .5) : e;
    mixIn(P.colour, (1 - smooth(P.soft[0], P.soft[1], s)) * (P.alpha ?? 1));
  };
  const overMark = OVER.map(O => O.mark && { M: O.mark, p: typeof O.mark.period === 'number' ? O.mark.period : O.mark.period?.[0] ?? 0, along: !!O.mark.along, dark: O.floor.map(v => v * (O.mark.dark ?? .72)) });
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
    const o = j * W + i, x = X0 + (i + .5) * PX, z = Z0 + (j + .5) * PX, dOff = off[o] * PX / 3;

    // Blobs darken the ground under them. In an outline, streams run through boggy meadow, and clearings are
    // meadow with a lighter rim where the forest steps down. Neither needs the fields.

    const wd = WSD[o], kind = WKIND[o], wild = WHOLE[kind];
    if (wd > 3 || wild) {
      const O = OVER[kind - 1];
      if (wild) stream(kind, x, z);
      const n = vnoise(x / 13, z / 13);
      if (wild && SE < 0) for (let c = 0; c < 3; c++) col[c] = O.water[c] * (.85 + .3 * n);
      else if (wild && SE < SB) for (let c = 0; c < 3; c++) col[c] = lerp(O.bog[c], O.water[c], (1 - smooth(0, 4, SE)) * .6) * (.8 + .4 * n);
      else if (wd > 3 || !O.clearings) {
        for (let c = 0; c < 3; c++) col[c] = O.floor[c] * (.8 + .4 * n);
        if (overMark[kind - 1]) markPaint(overMark[kind - 1], x, z, x, z, i, j);
      } else {
        const rim = 1 - smooth(-18 - 10 * n, -4, wd), Q = O.clearings;
        for (let c = 0; c < 3; c++) col[c] = lerp(Q.clearing[c], Q.rim[c], rim) * (.85 + .3 * vnoise(x / 30, z / 30));
      }
      bare(x, z, i, j);
      data[o * 4] = Math.sqrt(col[0]) * 255; data[o * 4 + 1] = Math.sqrt(col[1]) * 255; data[o * 4 + 2] = Math.sqrt(col[2]) * 255;
      data[o * 4 + 3] = 255;
      continue;
    }
    if (dOff < 1) continue;
    const rim = Math.min(i, j, W - 1 - i, D - 1 - j) * PX;
    let a = dOff < 17 ? smooth(4, 14, dOff + 6 * (vnoise(x / 23, z / 23) - .5)) : 1;
    if (rim < 375) a *= smooth(0, 300, rim + 150 * (vnoise(x / 200, z / 200) - .5));
    if (a <= 0) continue;
    warp(x, z);
    const Z = zoneAt(QX, QZ), zb = ZB, du = QX - Z.x, dv = QZ - Z.z, u = du * Z.c + dv * Z.s, v = -du * Z.s + dv * Z.c;
    const r = Math.floor(v / Z.row), R = rowOf(Z, r), vm = v - (r + .5) * Z.row, s = u + R.off - R.sl * vm, c = Math.floor(s / R.w), fu = s / R.w - c;
    const f = fieldOf(Z, r, c), cosl = R.cos, T = f.T;
    const eT = v - r * Z.row, eB = (r + 1) * Z.row - v, eL = fu * R.w * cosl, eR = (1 - fu) * R.w * cosl;
    col[0] = f.tone[0]; col[1] = f.tone[1]; col[2] = f.tone[2];
    let margin = Math.min(eT, eB, eL, eR);
    if (f.split) {

      // A field that splits into plots draws each plot's tone and painter, with a narrow edge between them.

      const [ku, kv] = f.split, su = Math.min(ku - 1, Math.floor(fu * ku)), sv = Math.min(kv - 1, Math.floor(eT / Z.row * kv));
      const p = f.plots[sv * ku + su], PE = T.plots.edge;
      col[0] = p.tone[0]; col[1] = p.tone[1]; col[2] = p.tone[2];
      const pu = (fu * ku - su) * R.w / ku * cosl, pv = eT - sv * Z.row / kv, inner = Math.min(pu, R.w / ku * cosl - pu, pv, Z.row / kv - pv);
      if (p.mark) markPaint(p.mark, u, v, x, z, i, j);
      if (PE && margin > 3) mixIn(PE.colour, (1 - smooth(.6, 2, inner)) * PE.alpha);
    } else if (f.mark) markPaint(f.mark, u, v, x, z, i, j);

    // Field margins are a strip of rough grass. Edges darken their line; tree rows in dots.

    const verge = T.verge === undefined ? F.verge : T.verge;
    if (verge) mixIn(verge, (1 - smooth(.8, 2.4, margin)) * .8);
    if (margin < 4.5) {
      const bottom = eB < 4.5 ? (R1 => edgeKind(Z, r + 1, Math.floor((u + R1.off + R1.sl * Z.row / 2) / R1.w), 0))(rowOf(Z, r + 1)) : null;
      edgeMark(f.top, eT, u); edgeMark(bottom, eB, u); edgeMark(f.left, eL, v); edgeMark(f.right, eR, v);
    }

    // Lanes run along the zones' borders.

    if (zb < 3.4) mixIn(F.lane, (1 - smooth(2, 3.4, zb)) * (.85 + .3 * vnoise(x / 9, z / 9)));
    if (f.clump && inClump(f.clump, x, z)) mixIn(f.clump.Q.colour, f.clump.Q.alpha);
    const fd = YARD[o];
    if (fd < 34) mixIn(YCOL[YI[o]], 1 - smooth(16, 26 + 8 * vnoise(x / 9, z / 9), fd));
    if (wd > -6) mixIn(OVER[kind - 1].floor, smooth(-6, 3, wd));
    const b = bare(x, z, i, j);
    data[o * 4] = Math.sqrt(col[0]) * 255; data[o * 4 + 1] = Math.sqrt(col[1]) * 255; data[o * 4 + 2] = Math.sqrt(col[2]) * 255;
    data[o * 4 + 3] = Math.max(a, b) * 255;
  }
  const tex = new THREE.DataTexture(data, W, D);
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true; tex.anisotropy = 8;
  tex.needsUpdate = true;
  COUNTRY_U.uFields.value = tex;
  COUNTRY_U.uFieldBox.value.set(X0, Z0, 1 / (W * PX), 1 / (D * PX));
  COUNTRY_U.uFieldSize.value.set(W, D);
  patch(mat);
  const tPaint = performance.now();

  // ---------- builders, in one merged mesh ----------

  // The mesh is cut into three tiles across the land's width, so the view and the shadow map skip the tiles they
  // do not see. at(x, z) picks the tile for what follows.

  const TILES = Array.from({ length: 3 }, () => ({ pos: [], rgb: [] })), rnd = H.rng(S + 5);
  let pos, rgb;
  const at = x => ({ pos, rgb } = TILES[Math.min(2, Math.max(0, Math.floor((x - X0) / RW * 3)))]);
  const tri = (a, b, c, k) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    rgb.push(k[0], k[1], k[2], k[0], k[1], k[2], k[0], k[1], k[2]);
  };
  const quad = (a, b, c, d, k) => { tri(a, b, c, k); tri(a, c, d, k); };
  const tint = (k, v) => k.map(t => t * (1 - v / 2 + rnd() * v));
  const ICO = new THREE.IcosahedronGeometry(1, 0).toNonIndexed().attributes.position.array;

  // A three-sided prism from a to b, w0 wide at a and w1 at b: trunks, limbs, cacti.

  const limb = (ax, ay, az, bx, by, bz, w0, w1, k) => {
    const e = [0, 2.1, 4.2].map(a => [Math.cos(a), Math.sin(a)]);
    for (let i = 0; i < 3; i++) {
      const [c0, s0] = e[i], [c1, s1] = e[(i + 1) % 3];
      quad([ax + c0 * w0, ay, az + s0 * w0], [ax + c1 * w0, ay, az + s1 * w0], [bx + c1 * w1, by, bz + s1 * w1], [bx + c0 * w1, by, bz + s0 * w1], k);
    }
  };

  // A tree is a crown lift times its size up on a three-sided trunk, squashed in height. Trees in clumps and
  // orchards stand close, so their crowns sit lower and hide the trunk, which they leave out.

  const tree = (x, z, s, k, trunk = true, y = height(x, z), lift = trunk ? 1.5 : 1.1, squash = .85, tv = .4) => {
    at(x, z);
    const h = s * lift, cr = tint(k, tv), tr = [.14, .1, .06];
    for (let i = 0; i < ICO.length; i += 3) {
      pos.push(x + ICO[i] * s, y + h + ICO[i + 1] * s * squash, z + ICO[i + 2] * s);
      rgb.push(cr[0], cr[1], cr[2]);
    }
    if (!trunk) return;
    const b = [0, 2.1, 4.2].map(a => [x + Math.cos(a) * s * .14, z + Math.sin(a) * s * .14]);
    for (let e = 0; e < 3; e++) { const [p, q] = [b[e], b[(e + 1) % 3]]; quad([p[0], y - .3, p[1]], [q[0], y - .3, q[1]], [q[0], y + h, q[1]], [p[0], y + h, p[1]], tr); }
  };

  // item(x, z, I) places one item: size [s, ds], colour, shape (tree, palm, bush, rock or cactus), trunk.

  let items = 0;
  const item = (x, z, I) => {
    if (steep(x, z) > .3) return;
    const s = I.size[0] + rnd() * I.size[1];
    items++;
    if (I.shape === 'cactus') {
      const y = height(x, z), k = tint(I.colour, .2), w = s * .1;
      at(x, z);
      limb(x, y - .3, z, x, y + s, z, w, w * .8, k);
      for (const side of [-1, 1]) {
        const ay = y + s * (.3 + rnd() * .25), ax = x + side * s * .28;
        limb(x, ay, z, ax, ay + s * .08, z, w * .7, w * .7, k);
        limb(ax, ay + s * .08, z, ax, ay + s * .45, z, w * .7, w * .5, k);
      }
      return;
    }
    const P = SHAPES[I.shape] ?? NO_SHAPE, trunk = I.trunk ?? P.trunk ?? true;
    tree(x, z, s, I.colour, trunk, undefined, I.lift ?? P.lift ?? (trunk ? 1.5 : 1.1), I.squash ?? P.squash ?? .85, P.tint ?? .4);
  };

  // A ridge (a hedge or a dry-stone wall) is a low bank with sloping sides along a line of land points, broken
  // where the line leaves its zone, nears a road, the town, a farmyard or an overlay.

  const ok = (Z, x, z) => { warp(x, z); return zoneAt(QX, QZ) === Z && ZB > 4 && dist(off, x, z) > 8 && nearFarm(x, z) > 28 && overSd(x, z) < -3 && !covered(x, z) && steep(x, z) < .3; };
  let ridgeN = 0;
  const run = (Z, E, from, to) => {
    const G = E.ridge, Tr = E.trees;
    if (!G && !Tr) return;
    const L = Math.hypot(to[0] - from[0], to[1] - from[1]), n = Math.max(1, Math.ceil(L / (G ? G.step ?? 10 : Tr.step ?? 16))), pts = [];
    const flush = () => {
      if (pts.length > 1 && G) {
        const b = G.base ?? 1.6, tw = G.top ?? .7;
        const sec = pts.map(([x, z], i) => {
          const [px, pz] = pts[Math.max(0, i - 1)], [qx, qz] = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(qx - px, qz - pz) || 1;
          const nx = -(qz - pz) / l, nz = (qx - px) / l, y = height(x, z), t = G.height[0] + rnd() * G.height[1];
          return [[x - nx * b, y - .3, z - nz * b], [x - nx * tw, y + t, z - nz * tw], [x + nx * tw, y + t, z + nz * tw], [x + nx * b, y - .3, z + nz * b]];
        });
        const k = tint(G.colour, .3);
        at(...pts[0]);
        for (let i = 1; i < sec.length; i++) {
          const [a, b] = [sec[i - 1], sec[i]];
          quad(a[0], b[0], b[1], a[1], k); quad(a[1], b[1], b[2], a[2], k); quad(a[2], b[2], b[3], a[3], k);
          ridgeN++;
        }
        for (const s of [sec[0], sec[sec.length - 1]]) quad(s[0], s[1], s[2], s[3], k);
      }
      pts.length = 0;
    };
    for (let i = 0; i <= n; i++) {
      const [x, z] = unwarp(lerp(from[0], to[0], i / n), lerp(from[1], to[1], i / n));
      if (!ok(Z, x, z)) { flush(); continue; }
      if (G) pts.push([x, z]);
      else if (rnd() < (Tr.keep ?? .7)) { const J = Tr.jitter ?? 3; item(x + (rnd() - .5) * J, z + (rnd() - .5) * J, Tr.item); }
    }
    flush();
  };
  const plan = (Z, u, v) => [Z.x + u * Z.c - v * Z.s, Z.z + u * Z.s + v * Z.c];

  // Items on a dots painter's grid, each on a dot inside its plot and clear of the plot's edges.

  const dotItems = (f, ku, kv, markAt) => {
    const { Z, c } = f, R = rowOf(Z, f.r), u0 = c * R.w - R.off, top = f.r * Z.row, h2 = Z.row / 2;
    for (let su = 0; su < ku; su++) for (let sv = 0; sv < kv; sv++) {
      const M = markAt(su, sv)?.M;
      if (!M?.item) continue;
      const st = M.step, cl = M.clear ?? 3;
      for (let gu = Math.floor((u0 - R.sl * h2) / st) * st + st / 2; gu < u0 + R.w + Math.abs(R.sl) * h2; gu += st) for (let gv = Math.floor(top / st) * st + st / 2; gv < top + Z.row; gv += st) {
        const fu = (gu + R.off - R.sl * (gv - top - h2)) / R.w - c, pv = (gv - top) / Z.row * kv;
        if (Math.floor(fu * ku) !== su || Math.floor(pv) !== sv) continue;
        if (Math.min(fu * ku - su, su + 1 - fu * ku) * R.w / ku < cl || Math.min(pv - sv, sv + 1 - pv) * Z.row / kv < cl) continue;
        const [x, z] = unwarp(...plan(Z, gu, gv));
        if (ok(Z, x, z)) item(x, z, M.item);
      }
    }
  };

  // Every painted field, whichever zone holds its middle, gets the edges, clump and dot items its paint shows.

  for (const f of FIELDS.values()) {
    const { Z, r, c } = f;
    const R = rowOf(Z, r), u0 = c * R.w - R.off, top = r * Z.row, h2 = Z.row / 2;
    const kt = f.top, kl = f.left;
    if (kt) run(Z, kt, plan(Z, u0 - R.sl * h2, top), plan(Z, u0 + R.w - R.sl * h2, top));
    if (kl) run(Z, kl, plan(Z, u0 - R.sl * h2, top), plan(Z, u0 + R.sl * h2, top + Z.row));

    // A clump fills its patch with items step metres apart.

    if (f.clump) {
      const q = f.clump, st = q.Q.step ?? 8, J = q.Q.jitter ?? 6;
      for (let x = q.x - q.r * 1.3; x < q.x + q.r * 1.3; x += st) for (let z = q.z - q.r * 1.3; z < q.z + q.r * 1.3; z += st) {
        const tx = x + (rnd() - .5) * J, tz = z + (rnd() - .5) * J;
        if (inClump(q, tx, tz) && ok(Z, tx, tz)) item(tx, tz, q.Q.item);
      }
    }
    if (f.split) dotItems(f, f.split[0], f.split[1], (su, sv) => f.plots[sv * f.split[0] + su].mark);
    else if (f.mark?.M.item) dotItems(f, 1, 1, () => f.mark);
  }

  // A farmstead is a house and one or two barns round a yard, walls under roofs of pitch (ridge height over depth).

  const shed = (x, z, a, w, d, h, wall, roof, pitch) => {
    const c = Math.cos(a), s = Math.sin(a), P = (u, v, y) => [x + u * c - v * s, y, z + u * s + v * c];
    const y0 = Math.min(...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => height(x + (i * w * c - j * d * s) / 2, z + (i * w * s + j * d * c) / 2))) - .3;
    const y1 = y0 + .3 + h, ridge = y1 + d * pitch, hw = w / 2, hd = d / 2, ew = hw + .5, ed = hd + .6;
    const k = tint(wall, .1), m = tint(roof, .2);
    quad(P(-hw, -hd, y0), P(hw, -hd, y0), P(hw, -hd, y1), P(-hw, -hd, y1), k);
    quad(P(hw, hd, y0), P(-hw, hd, y0), P(-hw, hd, y1), P(hw, hd, y1), k);
    quad(P(hw, -hd, y0), P(hw, hd, y0), P(hw, hd, y1), P(hw, -hd, y1), k);
    quad(P(-hw, hd, y0), P(-hw, -hd, y0), P(-hw, -hd, y1), P(-hw, hd, y1), k);
    tri(P(hw, -hd, y1), P(hw, hd, y1), P(hw, 0, ridge), k);
    tri(P(-hw, hd, y1), P(-hw, -hd, y1), P(-hw, 0, ridge), k);
    quad(P(-ew, -ed, y1 - .5), P(ew, -ed, y1 - .5), P(ew, 0, ridge + .05), P(-ew, 0, ridge + .05), m);
    quad(P(ew, ed, y1 - .5), P(-ew, ed, y1 - .5), P(-ew, 0, ridge + .05), P(ew, 0, ridge + .05), m);
  };

  // A site is a farmstead or a pack module's build. A module gets the site and the mesh's builders.

  let farmN = 0;
  for (const F of sites) {
    at(F.x, F.z);
    const t = k => h3(F.id, S, 40 + k), c = Math.cos(F.a), s = Math.sin(F.a), on = (u, v) => [F.x + u * c - v * s, F.z + u * s + v * c];
    if (!F.K.farm) {
      MODS[F.K.module]({ x: F.x, z: F.z, a: F.a, y: height(F.x, F.z), t, on, height, tri, quad, limb, tint, item, rnd, spec: F.K });
      continue;
    }
    const P = F.K.farm, pitch = P.pitch ?? .55;
    farmN++;
    const wall = P.walls[Math.floor(t(1) * P.walls.length)], roof = P.roofs[Math.floor(t(2) * P.roofs.length)];
    shed(...on(-6, -7), F.a, 12 + t(3) * 4, 8 + t(4) * 2, 4.5, wall, roof, pitch);
    shed(...on(9, 3), F.a + Math.PI / 2, 18 + t(5) * 6, 10 + t(6) * 2, 5, P.walls[0].map(v => v * .8), roof.map(v => v * .85), pitch);
    if (t(7) < .5) shed(...on(-7, 11), F.a, 14 + t(8) * 4, 8, 4, wall, roof.map(v => v * .9), pitch);
    for (let k = 0; k < 2 + t(9) * 3; k++) { const [x, z] = on(-25 + t(10 + k) * 4, -15 + k * 9); tree(x, z, 3.5 + t(20 + k) * 2, P.tree); items++; }
  }

  // A canopy is one lumpy sheet on a lattice grid metres apart, 9 to 19 m up inside and sinking 1.2 m under the
  // ground past its edge, so it never lies flat on the ground. Single crowns stand along the edge to hide the
  // sheet's slope, and a poke share rises out of it. dull mixes in a duller colour in patches; an outline's clearings
  // hold knots of darker trees; dead adds bare dead trees above it. In a ward the ground is the town's. Lattice points
  // shift by up to a third of a cell, so the facets are uneven.

  let crownN = 0, deadN = 0;
  const DONE = new Set();
  const canopyTone = (O, x, z) => {
    const K = O.canopy;
    return O.clearings && glade(x, z) > .86 ? O.clearings.knot
      : K.dull ? K.colour.map((v, c) => lerp(v, K.dull[c], smooth(.5, .8, vnoise(x / 260 + 1, z / 260 + 3)) * .7)) : K.colour;
  };
  const canopy = (kind, G, x0, z0, x1, z1) => {
    const O = OVER[kind - 1], NI = Math.ceil((x1 - x0) / G) + 1, NJ = Math.ceil((z1 - z0) / G) + 1;
    const node = (i, j) => {
      const gx = x0 + i * G, gz = z0 + j * G, x = gx + (h3(Math.round(gx), Math.round(gz), S + 5) - .5) * G * .66;
      const z = gz + (h3(Math.round(gz), Math.round(gx), S + 6) - .5) * G * .66, o = Math.floor((z - Z0) / PX) * W + Math.floor((x - X0) / PX);
      const d = o >= 0 && o < W * D && WKIND[o] === kind && steep(x, z) < .3 ? overSd(x, z) : -20;
      if (d <= -G * 1.5) return { gx, gz, x, z, d, y: 0 };
      const g = dist(town, x, z) < 1 ? terrainAt(x, z) : height(x, z);
      const top = 8 + 8 * vnoise(x / 7, z / 7) + 4 * vnoise(x / 25 + 4, z / 25) + 3 * vnoise(x / 90, z / 90 + 2);
      return { gx, gz, x, z, d, g, y: g - 1.2 + (smooth(0, 5, d) * .55 + smooth(5, 20, d) * .45) * (top + 1.2) };
    };
    let prev = Array.from({ length: NI }, (_, i) => node(i, 0));
    for (let j = 1; j < NJ; j++) {
      const row = Array.from({ length: NI }, (_, i) => node(i, j));
      for (let i = 0; i + 1 < NI; i++) {
        const a = prev[i], b = prev[i + 1], c = row[i + 1], d = row[i];
        if (Math.max(a.d, b.d, c.d, d.d) <= 0) continue;

        // Blobs that overlap share the lattice, so each cell is laid once.

        const key = Math.round((a.gx - X0) / G) * 1e5 + Math.round((a.gz - Z0) / G) + kind * 1e10;
        if (DONE.has(key)) continue;
        DONE.add(key);
        at(a.x);
        const k = canopyTone(O, a.x, a.z).map(v => v * (.75 + .5 * vnoise(a.x / 9, a.z / 9)));
        const P = q => [q.x, q.y, q.z];
        tri(P(a), P(d), P(b), k); tri(P(b), P(d), P(c), k.map(v => v * .92));
      }

      // Crowns along the edge and poking out of the canopy, and bare dead trees.

      for (const q of row) {
        const nk = Math.round((q.gx - X0) / G) * 1e5 + Math.round((q.gz - Z0) / G) + kind * 1e10 + 5e10;
        if (q.d <= 0 || DONE.has(nk)) continue;
        DONE.add(nk);
        const t = h3(Math.round(q.gx), Math.round(q.gz), S + 70 + kind);
        const k = canopyTone(O, q.x, q.z).map(v => v * 1.2), t2 = h3(Math.round(q.gz), Math.round(q.gx), S);
        if (q.d < 6 && t < .55) {
          tree(q.x + (t - .45) * G, q.z + (t2 - .5) * G, 4 + t * 2.5, k, false, q.g);
          crownN++;
        } else if (q.d > 8 && t < (O.canopy.poke ?? .1)) {

          // Inside, a few crowns rise out of the canopy, so it reads as trees close to.

          tree(q.x + (t2 - .5) * G, q.z + (t * 7 % 1 - .5) * G, 3.5 + t2 * 2.5, k.map(v => v * (.8 + t2 * .3)), false, q.y - 3);
          crownN++;
        } else if (O.canopy.dead && q.d > 10 && t > .9 && t2 < O.canopy.dead.share) {
          snag(q.x, q.z, q.g, t, O.canopy.dead.colour);
          deadN++;
        }
      }
      prev = row;
    }
  };

  // A dead tree: a bare trunk 15 to 22 m tall and three crooked limbs.

  const snag = (x, z, y, t, colour) => {
    at(x);
    const h = 17 + t * 300 % 7, k = tint(colour, .3);
    limb(x, y - .3, z, x + 1, y + h, z, .9, .2, k);
    for (let b = 0; b < 3; b++) {
      const a = b * 2.1 + t * 40, f = .45 + b * .17, ty = y + h * f, l = 4 + b;
      limb(x + f, ty, z, x + Math.cos(a) * l, ty + l * .8, z + Math.sin(a) * l, .3, .08, k);
    }
  };

  // scatter spreads items over a blob or outline on a grid step metres apart, inset metres in from its edge.

  const SCAT = new Set();
  const scatter = (kind, Sc, x0, z0, x1, z1) => {
    const st = Sc.step;
    for (let x = Math.floor((x0 - X0) / st) * st + X0; x < x1; x += st) for (let z = Math.floor((z0 - Z0) / st) * st + Z0; z < z1; z += st) {
      const key = Math.round((x - X0) / st) * 1e5 + Math.round((z - Z0) / st) + kind * 1e10;
      if (SCAT.has(key)) continue;
      SCAT.add(key);
      const tx = x + (rnd() - .5) * st, tz = z + (rnd() - .5) * st, i = Math.floor((tx - X0) / PX), j = Math.floor((tz - Z0) / PX);
      if (i < 0 || j < 0 || i >= W || j >= D || WKIND[j * W + i] !== kind || overSd(tx, tz) < (Sc.inset ?? 2) || rnd() >= (Sc.share ?? 1)) continue;
      item(tx, tz, Sc.item);
    }
  };
  const box = (L, G) => {
    const xs = L.map(p => p[0]), zs = L.map(p => p[1]);
    return [Math.floor((Math.min(...xs) - X0) / G) * G + X0, Math.floor((Math.min(...zs) - Z0) / G) * G + Z0, Math.max(...xs), Math.max(...zs)];
  };
  OVER.forEach((O, i) => {
    const kind = i + 1, G = O.canopy?.grid ?? 8;

    // A blob's lattice starts on its own grid, an outline's on a 12 m step.

    const boxes = O.layout === 'blobs' ? BLOBS[i].map(([x, z, r]) => box([[x - r * 1.3, z - r * 1.3], [x + r * 1.3, z + r * 1.3]], G))
      : O.outlines.map(P => box(P.flatMap(([x, z]) => [[x - 300, z - 300], [x + 300, z + 300]]), 12));
    if (O.canopy) for (const b of boxes) canopy(kind, G, ...b);
    if (O.scatter) for (const b of boxes) scatter(kind, O.scatter, ...b);
  });

  // The props take no ground holes, because none stand where a landmark cuts the ground.

  const prop = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, flatShading: true, side: THREE.DoubleSide });
  let tris = 0;
  for (const T of TILES) {
    if (!T.pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(T.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(T.rgb, 3));
    geo.computeVertexNormals();
    THREE.Group.prototype.add.call(group, new THREE.Mesh(geo, prop));
    tris += T.pos.length / 9;
  }
  const kinds = {};
  for (const f of FIELDS.values()) kinds[f.T.id] = (kinds[f.T.id] ?? 0) + 1;
  console.info(`country: ${list.length} fields (${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ')}), ${farmN} farms,`
    + ` ${sites.length - farmN} module sites, ${ridgeN} ridge lengths, ${items} items, ${OVER.map((O, i) => `${O.id} ${O.layout === 'blobs' ? BLOBS[i].length : O.outlines.length}`).join(', ')},`
    + ` ${crownN} canopy crowns, ${deadN} dead trees, ${tris} triangles; paint ${Math.round(tPaint - t0)} ms, props ${Math.round(performance.now() - tPaint)} ms`);
}
