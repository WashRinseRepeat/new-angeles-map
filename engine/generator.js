// City build: lot frames, zones, block sites, filler, generate() and the showcase.

import * as THREE from 'three';
import { S, H } from './state.js';
import { AXIS_LO, BLOCK, CENTRE, CENTRE_R, CITY, STYLES, density, hash, lerp, mapToWorld, mixStyle, pickStyle, quarterAt, rng, sdPoly, smooth, styleAt, vnoise } from './core.js';
import { SETTING, inPack } from './setting.js';
import { chamfer, edgeAt } from './edge.js';
import { camera, controls, label } from './render.js';
import { DECOR, INSTANCED, PROPS, SHAPES, SKINS, beacon, bld, glow, glows, holo, neon, pool, pools, prop, puffs, put, roof, sign, signs, tileAll } from './instances.js';
import { KITS, M, buildTall, flushMerged, pick, prism, resetMerged, scalePoly, yard } from './grammar.js';
import { CORRIDORS, HIGHWAYS, STREETS, corridorIn, traffic } from './transport.js';

// ---------- preview modes: ?showcase=<family> lays out one kit family, ?focus=<slug> flies to a place ----------

export const QUERY = new URLSearchParams(location.search);
export const SHOWCASE = QUERY.get('showcase');
export async function showcase(fam) {
  const mod = await import(inPack(`kits/${fam}.js`)), names = Object.keys(mod.kits(H));

  // A district family shows in its own style. Other families show at both ends of the style axis and halfway.

  const showStyle = w => STYLES[fam] ? { ...STYLES[fam], id: fam, mix: [[fam, 1]] } : mixStyle(w);
  names.forEach((k, i) => [0, .5, 1].forEach((w, j) => {
    const x = (i - (names.length - 1) / 2) * 60, z = (j - 1) * 60;
    KITS[k](x, z, 28, showStyle(w), 1, rng(hash(i, j)));
    label(k, 'district', new THREE.Vector3(x, 45, z));
  }));

  // Block kits get a row of 110 × 80 m blocks behind the lot kits.

  Object.entries(mod.blocks?.(H) ?? {}).forEach(([k, { build }], i, all) => {
    const x = (i - (all.length - 1) / 2) * 160;
    build(x, -260, 110, 80, showStyle(0), rng(hash(i, 77)));
    label(k, 'district', new THREE.Vector3(x, 60, -260));
  });
  for (const m of INSTANCED) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    for (const a of ['aBase', 'aWin', 'aP', 'aSkin', 'aSeed', 'aSlot']) if (m.geometry.attributes[a]) m.geometry.attributes[a].needsUpdate = true;
  }
  controls.target.set(0, 10, 0);
  camera.position.set(0, 140, 240);
}

// ---------- generator ----------

// Minimum-area rectangle of a lot: kits build in that frame.

export function lotFrame(poly) {
  let best = null;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    const phi = Math.atan2(bz - az, bx - ax), c = Math.cos(phi), s = Math.sin(phi);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, z] of poly) {
      const u = x * c + z * s, v = -x * s + z * c;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) {
      const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
      best = { area, cx: um * c - vm * s, cz: um * s + vm * c, w: u1 - u0, d: v1 - v0, a: -phi };
    }
  }
  best.c = Math.cos(best.a); best.s = Math.sin(best.a); best.poly = poly;
  return best;
}
export const FRAMES = CITY.lots.map(lotFrame);

// City dials scale heights, built lots, street lights and each block zone's cap. The first build uses the defaults of
// the pack's cityTune rows. skew bends small-lot heights toward low, so tall ones grow rarer. small scales each
// style's smallShare.

export const CITYTUNE = { skew: 1.4, small: 1, needles: 0, needleTop: 350, shapes: 1, ...SETTING.kits.tune, ...Object.fromEntries(SETTING.kits.cityTune.map(([k, , , , , def]) => [k, def])) };

// Mega-housing fills a whole city block. A pack's block zones can use it as a builder.
// A ring stacks four slabs round a courtyard with sky bridges. A stepped block climbs in setbacks.

export function megaHousing(x, z, w, d, st, r) {
  w = Math.min(w, 120); d = Math.min(d, 120);
  const H = (130 + 130 * r()) * CITYTUNE.height, ms = { ...st, grime: .85, neon: 1.2 };
  const o = { skin: SKINS.grid, lit: .3, roof: false };
  bld(x, z, w, d, 14, ms, r, { ...o, skin: SKINS.bands, lit: .45 });

  // Floor decks every 20 m: a dark perimeter frame with warm strip lights, and lit lift shafts on two faces.

  const decks = (ww, dd, y0, th) => {
    for (let y = y0 + 20; y < y0 + th - 4; y += 20) for (const s of [-1, 1]) {
      prop('box', x, y, z + s * (dd / 2 + 1), ww + 4, 1.6, 2, [.05, .045, .045]);
      prop('box', x + s * (ww / 2 + 1), y, z, 2, 1.6, dd, [.05, .045, .045]);
      glow(x, y - 1, z + s * (dd / 2 + 2), ww * .9, .15, .15, [.5, .32, .12]);
    }
    for (const s of [-1, 1]) if (r() < .7) {
      const along = (r() - .5) * ww * .6, rgb = r() < .5 ? [.2, .7, .9] : [.9, .55, .2];
      glow(x + along, y0 + th / 2, z + s * (dd / 2 + .3), 1.2, th - 2, .3, rgb);
    }
  };
  let y = 14, ww = w - 2, dd = d - 2;
  if (r() < .5) {
    const t = Math.min(16, Math.max(10, Math.min(w, d) * .18));
    while (y < H && ww > 2 * t + 14 && dd > 2 * t + 14) {
      const th = Math.min(H - y, 40 + r() * 30);
      for (const s of [-1, 1]) {
        bld(x, z + s * (dd - t) / 2, ww, t, th, ms, r, { ...o, y0: y });
        bld(x + s * (ww - t) / 2, z, t, dd - 2 * t, th, ms, r, { ...o, y0: y });
      }
      for (let k = 0; k < 2; k++) {
        const by = y + th * (.3 + .4 * k), along = r() < .5;
        bld(x, z, along ? ww - 2 * t + 2 : 5, along ? 5 : dd - 2 * t + 2, 4, ms, r, { ...o, y0: by, lit: .6, skin: SKINS.curtain });
      }
      decks(ww, dd, y, th);
      y += th; ww *= .92; dd *= .92;
    }
    glow(x, .4, z, ww * .5, .2, dd * .5, [.45, .3, .12]);
  } else {
    while (y < H && ww > 24) {
      const th = Math.min(H - y, 35 + r() * 25);
      bld(x, z, ww, dd, th, ms, r, { ...o, y0: y, skin: r() < .3 ? SKINS.bands : SKINS.grid });
      for (const s of [-1, 1]) bld(x + s * ww * .55, z, ww * .12, dd * .5, th * .8, ms, r, { ...o, y0: y, lit: .2 });
      decks(ww, dd, y, th);
      y += th; ww *= .8; dd *= .8;
    }
  }

  // Crown: roof plant, corner beacons, masts, a tall sign and an ad screen.

  roof(x, z, ww, dd, y, ms, r);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) beacon(x + sx * ww / 2, y + 1, z + sz * dd / 2, r);
  for (let k = 1 + Math.floor(r() * 3); k > 0; k--) prop('lattice', x + (r() - .5) * ww * .6, y + 15, z + (r() - .5) * dd * .6, 2, 30, 2, [.2, .2, .22]);
  const pal = AXIS_LO.signs;
  sign(x, z, w, d, y, ms, r, pal[Math.floor(r() * pal.length)], { blade: true, sh: Math.min(40, y * .3), y: 40 + r() * 30 });
  holo(x, z, ww, dd, y - 12, r, undefined, 24);
}

// Block kits take a whole city block. Each zone picks its blocks, then a random builder of that zone fills each one.
// Kit modules add builders through blocks(H), which returns { name: { zone, build(x, z, w, d, st, r) } }.
// The pack lists the zones. Every district is a zone too.

export const SC = SETTING.scale.city, BLOCK_MAX = SC.blockMax;
export const CENTRE_POLY = CITY.districts.find(d => d.id === SETTING.centre.district)?.poly ?? [];
export const toCentre = b => Math.hypot(b.cx - CENTRE.x, b.cz - CENTRE.y);

// Centre blocks rank nearest-first within each of eight sectors round the centre, so the ring closes on every side.

export const sectorOf = b => Math.floor((Math.atan2(b.cz - CENTRE.y, b.cx - CENTRE.x) + Math.PI) / (Math.PI / 4)) % 8;
export const ringRank = b => b.ring ??= -1000 * ALL_BLOCK_FRAMES.filter(o => o !== b && Math.min(o.w, o.d) >= SC.blockMin && sectorOf(o) === sectorOf(b)
  && sdPoly(o.cx, o.cz, CENTRE_POLY) > 0 && toCentre(o) < toCentre(b)).length - toCentre(b);
export const allows = (b, zone, blend) => STYLES[styleAt(b.cx, b.cz, blend).id].zones.includes(zone);
// Each district zone takes up to 16 of its own blocks, 140 m apart, for that district's block kits.
// A style can change these with blockCap, blockGap and blockMin.

export const districtZone = d => ({ zone: d.id, cap: () => STYLES[d.id]?.blockCap ?? SC.district.cap, gap: STYLES[d.id]?.blockGap ?? SC.district.gap,
  minSide: STYLES[d.id]?.blockMin ?? SC.district.minSide,
  test: b => sdPoly(b.cx, b.cz, d.poly) > 20, rank: b => vnoise(b.cx / 300 + 5, b.cz / 300 + 9) });

// The pack's zones get the helpers they need to pick blocks: the district zone, the centre ring rank, the style test
// allows, noise, the city dials and the built-in mega-housing builder.

export const BLOCK_ZONES = SETTING.kits.blockZones({ districts: CITY.districts, districtZone, ringRank, allows, vnoise, megaHousing,
  tune: CITYTUNE, inCentre: b => sdPoly(b.cx, b.cz, CENTRE_POLY) > 0 });
export const BLOCK_KITS = Object.fromEntries(CITY.districts.map(d => [d.id, []]));
for (const z of BLOCK_ZONES) BLOCK_KITS[z.zone] = [...BLOCK_KITS[z.zone] ?? [], ...z.builders ?? []];
export let SITES = [];
export function blockSites(blend) {
  const out = [];

  // Blocks under a place's footprint stay free, because large places reach past their own block.

  const placed = ALL_BLOCK_FRAMES.filter(b => b.used && b.size);
  const underPlace = b => placed.some(p => {
    const X = b.cx - p.cx, Z = b.cz - p.cz, pad = Math.min(b.w, b.d) / 2;
    return Math.abs(X * p.c - Z * p.s) < p.size[0] / 2 + pad && Math.abs(X * p.s + Z * p.c) < p.size[1] / 2 + pad;
  });
  const free = ALL_BLOCK_FRAMES.filter(b => Math.min(b.w, b.d) >= SC.blockMin && !b.used && !quarterAt(b.cx, b.cz) && (!CENTRE_R || toCentre(b) > CENTRE_R + 40)
    && !corridorIn(b, 4, Math.min(b.w, BLOCK_MAX), Math.min(b.d, BLOCK_MAX)).length && !underPlace(b));
  for (const z of BLOCK_ZONES) {
    if (!BLOCK_KITS[z.zone].length) continue;
    const cap = Math.round(z.cap()), mine = [];
    for (const b of free.filter(b => Math.min(b.w, b.d) >= (z.minSide ?? SC.siteMin) && z.test(b, blend)).sort((p, q) => z.rank(q) - z.rank(p))) {
      if (mine.length >= cap) break;
      if (out.some(s => s.f === b) || mine.some(m => Math.hypot(m.f.cx - b.cx, m.f.cz - b.cz) < z.gap)) continue;
      mine.push({ f: b, zone: z.zone });
    }
    out.push(...mine);
  }
  return out;
}
export const inRect = (f, x, z, pad = 0) => {
  const X = x - f.cx, Z = z - f.cz;
  return Math.abs(X * f.c - Z * f.s) < Math.min(f.w, BLOCK_MAX) / 2 + pad && Math.abs(X * f.s + Z * f.c) < Math.min(f.d, BLOCK_MAX) / 2 + pad;
};
export const inSite = (x, z, pad) => SITES.some(s => inRect(s.f, x, z, pad));

// Land-use zones from the pack group each kit family into patches instead of scattering it.

export const ZONES = SETTING.kits.landUse?.({ vnoise }) ?? [];

// City ground that no lot covers gets small filler buildings, turned to the nearest street, or the style's fillKit.
// A 2 m raster marks city land red, then paints lots, streets, highways, place sites and the centre plaza black.

// Street samples in 50 m buckets. nearestStreet returns [x, z, heading] of the closest sample.

export let BUCKETS = null;
export function nearestStreet(x, z) {
  const B = 50;
  if (!BUCKETS) {
    BUCKETS = new Map();
    for (const st of STREETS) for (let k = 0; k < st.path.length - 1; k += 2) {
      const p = st.path[k], key = `${Math.floor(p.x / B)},${Math.floor(p.z / B)}`;
      if (!BUCKETS.has(key)) BUCKETS.set(key, []);
      BUCKETS.get(key).push([p.x, p.z, Math.atan2(st.path[k + 1].x - p.x, st.path[k + 1].z - p.z)]);
    }
  }
  let best = Infinity, out = [x, z, 0];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++)
    for (const q of BUCKETS.get(`${Math.floor(x / B) + a},${Math.floor(z / B) + b}`) ?? []) {
      const d = (q[0] - x) ** 2 + (q[1] - z) ** 2;
      if (d < best) { best = d; out = q; }
    }
  return out;
}

// A lot's front is the side of its rectangle that faces the nearest street, as a local unit vector { x, z }.
// Lots come from splitting blocks, and the split keeps no record of which edge touches a street.

export function frontOf(f) {
  const [sx, sz] = nearestStreet(f.cx, f.cz), X = sx - f.cx, Z = sz - f.cz;
  const u = X * f.c - Z * f.s, v = X * f.s + Z * f.c;
  return Math.abs(u) / f.w > Math.abs(v) / f.d ? { x: Math.sign(u), z: 0 } : { x: 0, z: Math.sign(v) || 1 };
}

export function fillCells() {
  const S = 2, [ox, oz] = CITY.origin, W = Math.ceil(CITY.dims[0] / S), D = Math.ceil(CITY.dims[1] / S);
  const g = new OffscreenCanvas(W, D).getContext('2d', { willReadFrequently: true });
  g.setTransform(1 / S, 0, 0, 1 / S, -ox / S, -oz / S);
  const path = poly => { g.beginPath(); poly.forEach(([x, z], i) => i ? g.lineTo(x, z) : g.moveTo(x, z)); };
  g.fillStyle = '#f00';
  for (const d of CITY.districts) { path(d.poly); g.fill(); }
  const land = g.getImageData(0, 0, W, D).data;
  g.fillStyle = g.strokeStyle = '#000';
  for (const x of [...(CITY.water ?? []), ...(CITY.parks ?? [])]) { path(x.poly); g.fill(); }
  g.lineWidth = 3;
  for (const l of CITY.lots) { path(l); g.closePath(); g.fill(); g.stroke(); }
  for (const [kind, lw] of [['main', 12], ['major', 9], ['minor', 7]]) {
    g.lineWidth = lw;
    for (const l of CITY.streets[kind]) { path(l); g.stroke(); }
  }
  g.lineWidth = 26;
  for (const h of HIGHWAYS) { path(h.path.map(p => [p.x, p.z])); g.stroke(); }
  g.lineWidth = 18;
  for (const L of CORRIDORS) if (L.kind === 'maglev') { path(L.p.map(p => [p.x, p.z])); g.stroke(); }
  for (const b of ALL_BLOCK_FRAMES) if (b.used) {
    const [w, d] = b.size ?? [BLOCK, BLOCK];
    g.save(); g.translate(b.cx, b.cz); g.rotate(-b.a); g.fillRect(-w / 2 - 4, -d / 2 - 4, w + 8, d + 8); g.restore();
  }

  // Free landmark sites keep fill off, unless a site such as an oval park wants fill round its edge (fillUnder).

  for (const lm of LANDMARKS_KITS) if (lm.free && !lm.fillUnder) {
    const [w, d, a = 0] = lm.free;
    g.save(); g.translate(...mapToWorld(lm.at)); g.rotate(-a); g.fillRect(-w / 2 - 2, -d / 2 - 2, w + 4, d + 4); g.restore();
  }
  if (CENTRE_R) { g.beginPath(); g.arc(CENTRE.x, CENTRE.y, CENTRE_R + 10, 0, 7); g.fill(); }
  const px = g.getImageData(0, 0, W, D).data, open = new Uint8Array(W * D), city = new Uint8Array(W * D);
  for (let i = 0; i < W * D; i++) { open[i] = px[i * 4] > 128; city[i] = land[i * 4] > 128; }
  const at = (x, z) => {
    const i = Math.floor((x - ox) / S), j = Math.floor((z - oz) / S);
    return i >= 0 && j >= 0 && i < W && j < D ? j * W + i : -1;
  };
  const free = (x, z) => { const k = at(x, z); return k >= 0 && open[k] === 1; };
  INFILL = NO_INFILL || !Object.values(STYLES).some(st => st.infill) ? [] : infillSites(open, chamfer(city, W, D), W, D, S, at, free);

  // Band: open land up to 40 m outside the districts, where the ground is still flat, gets grove cells that
  // thicken outward, so the city fades into the jungle. Pixels painted for roads or water stay bare.

  BAND = [];
  if (!NO_INFILL && KITS.grove) {
    const out = new Uint8Array(W * D);
    for (let i = 0; i < W * D; i++) out[i] = city[i] ? 0 : 1;
    const od = chamfer(out, W, D), bare = (x, z) => { const k = at(x, z); return k >= 0 && !city[k] && !px[k * 4 + 3]; };
    for (let z = oz; z < oz + CITY.dims[1]; z += 10) for (let x = ox; x < ox + CITY.dims[0]; x += 10) {
      const k = at(x, z), d = k < 0 ? Infinity : od[k] * S / 3;
      if (d > 40 || ![[-4, -4], [4, -4], [-4, 4], [4, 4]].every(([a, b]) => bare(x + a, z + b))) continue;
      if (rng(hash(x, z + 5))() > .3 + .65 * d / 40 || shore(x, z) < 60) continue;
      BAND.push({ x, z });
    }
  }

  const cells = [], STEP = SC.fillStep;
  for (let z = oz; z < oz + CITY.dims[1]; z += STEP) for (let x = ox; x < ox + CITY.dims[0]; x += STEP) {
    let ok = true;
    for (let a = -STEP / 2; a <= STEP / 2 && ok; a += STEP / 4) for (let b = -STEP / 2; b <= STEP / 2 && ok; b += STEP / 4) ok = free(x + a, z + b);
    if (!ok) continue;
    cells.push({ x, z, a: nearestStreet(x, z)[2] });
  }
  return cells;
}

// Infill: open ground wider than 12 m becomes synthetic lots that build like real ones. Seeds go widest
// first. Each grows a rectangle square to the nearest street until it touches a lot, a street or another
// site, then paints itself and a 3 m margin closed. A site carries its distance to the district edge, so
// sites by the jungle can grow forest instead. Only styles with infill: true take sites; the rest keep the
// scattered 10 m fill, which reads more organic.

const MIN_SIDE = 12, MAX_HALF = 60, GAP = 3;

// Distance to the coast or open water. The district edge there meets the sea, not the jungle.

const SHORES = [...(CITY.coast ?? []), ...(CITY.water ?? []).map(w => [...w.poly, w.poly[0]])];
function shore(x, z) {
  let best = Infinity;
  for (const L of SHORES) for (let i = 1; i < L.length; i++) {
    const [ax, az] = L[i - 1], [bx, bz] = L[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}
function infillSites(open, edge, W, D, S, at, free) {
  const t0 = performance.now(), dist = chamfer(open, W, D), seeds = [];
  for (let j = 1; j < D - 1; j++) for (let i = 1; i < W - 1; i++) {
    const k = j * W + i, v = dist[k];
    if (v * S / 3 < MIN_SIDE / 2) continue;
    if (v < dist[k - 1] || v < dist[k + 1] || v < dist[k - W] || v < dist[k + W]) continue;
    seeds.push(k);
  }
  seeds.sort((a, b) => dist[b] - dist[a]);
  const [ox, oz] = CITY.origin, out = [];
  for (const k of seeds) {
    if (!open[k]) continue;
    const x = ox + (k % W + .5) * S, z = oz + (Math.floor(k / W) + .5) * S;
    if (!STYLES[styleAt(x, z, 0).id].infill) continue;
    const a = nearestStreet(x, z)[2] - Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    const fits = (hw, hd) => {
      for (let u = -hw; u <= hw; u += S) for (let v = -hd; v <= hd; v += S) if (!free(x + u * c + v * s, z - u * s + v * c)) return false;
      return true;
    };
    let hw = MIN_SIDE / 2, hd = MIN_SIDE / 2, gw = true, gd = true;
    if (!fits(hw, hd)) continue;
    while (gw || gd) {
      if (gw && hw < MAX_HALF && fits(hw + S, hd)) hw += S; else gw = false;
      if (gd && hd < MAX_HALF && fits(hw, hd + S)) hd += S; else gd = false;
    }
    for (let u = -hw - GAP; u <= hw + GAP; u += S / 2) for (let v = -hd - GAP; v <= hd + GAP; v += S / 2) {
      const q = at(x + u * c + v * s, z - u * s + v * c);
      if (q >= 0) open[q] = 0;
    }
    const poly = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([p, q]) => [x + p * hw * c + q * hd * s, z - p * hw * s + q * hd * c]);
    const f = { cx: x, cz: z, w: hw * 2, d: hd * 2, a, c, s, poly, area: hw * hd * 4, edge: shore(x, z) < 80 ? Infinity : edge[k] * S / 3 };
    f.front = frontOf(f);
    out.push(f);
  }
  console.info(`infill: ${out.length} sites in ${Math.round(performance.now() - t0)} ms`);
  return out;
}
export let INFILL = null, BAND = null;
const NO_INFILL = new URLSearchParams(location.search).get('infill') === '0';
export let FILL = null;

// One lot. f seeds the draws, g is the frame it builds in: the lot itself, or a part trimmed off a corridor.
// k scales the heights, bare builds only the yard, and slab builds one tower of that height over the whole frame.

// A landmark with hush r keeps the lots round it low: 35% height at the landmark, full height at r metres.

export const HUSH = [];
const hushAt = (x, z) => HUSH.reduce((m, h) => m * lerp(.35, 1, smooth(h.r * .3, h.r, Math.hypot(x - h.x, z - h.z))), 1);

const BOOST = SETTING.centre.boost;
function buildLot(f, g, blend, k = 1, bare = false, slab = 0) {
  k *= hushAt(f.cx, f.cz);
  const size = Math.min(g.w, g.d) - 2;
  const r = rng(hash(Math.round(f.cx * 10), Math.round(f.cz * 10)));
  const dS = Math.hypot(f.cx - CENTRE.x, f.cz - CENTRE.y);
  const st = styleAt(f.cx, f.cz, blend);
  const roll = r(), kitRoll = r(), kitPick = r(), Q = quarterAt(f.cx, f.cz);
  S.FRAME = g;
  if (slab) {
    bld(g.cx, g.cz, g.w - 2, g.d - 2, slab, st, r, { skin: SKINS[pick('skin', st.w, r)] });
    neon(g.cx, g.cz, g.w - 2, g.d - 2, slab, st, r);
    S.FRAME = null;
    return;
  }
  if (bare || (roll > st.density * CITYTUNE.fill && !Q)) {
    const yk = KITS[STYLES[st.id].yardKit];
    if (yk) yk(g.cx, g.cz, size, st, 1, r);
    else yard(g.cx, g.cz, g.w - 2, g.d - 2, st, r);
    S.FRAME = null;
    return;
  }
  const d = density(f.cx, f.cz) + (r() - .5) * .15;
  const D = pickStyle(st, kitRoll);
  const kits = D.tiers[Math.min(D.tiers.length - 1, Math.floor(smooth(.1, 1.2, d) * D.tiers.length))];
  const boost = lerp(.6, 1.15, smooth(.15, 1.1, d)) * (1 + BOOST.k * Math.exp(-dS / BOOST.r)) * CITYTUNE.height * k;

  // A quarter lot builds from the quarter's family in its style. Its tiers follow density like a district's.

  if (Q) {
    const qs = { ...st, ...Q.style, h0: Q.style.h0 * k, h1: Q.style.h1 * k };
    const ks = Q.tiers?.[Math.min(Q.tiers.length - 1, Math.floor(smooth(.1, 1.2, d) * Q.tiers.length))] ?? FAMILY_KITS[Q.fam];
    KITS[ks[Math.floor(kitPick * ks.length)]](g.cx, g.cz, size, qs, 1, r);
    S.FRAME = null;
    return;
  }
  const zone = size >= SC.zoneLot && ZONES.find(zn => FAMILY_KITS[zn.fam]?.length && zn.test(f.cx, f.cz, st.w));
  if (zone) {
    const ks = FAMILY_KITS[zone.fam];
    KITS[ks[Math.floor(kitPick * ks.length)]](g.cx, g.cz, size, st, boost, r);
    S.FRAME = null;
    return;
  }

  // A needle is a slim tower on any lot, whatever the district's heights. It stands 35% to 100% of needleTop metres,
  // and only the needle dials set its height. Its own seed keeps every other lot's draws the same.

  const nr = rng(hash(Math.round(f.cx * 10) + 7, Math.round(f.cz * 10) + 3));
  if (size >= 10 && nr() < CITYTUNE.needles) {
    buildTall(g.cx, g.cz, Math.min(g.w - 2, 16 + 10 * nr()), Math.min(g.d - 2, 16 + 10 * nr()), CITYTUNE.needleTop * (.35 + .65 * nr() ** 2), st, nr, false);
    S.FRAME = null;
    return;
  }

  // Small lots get one infill building that fills the lot. Big lots get a kit.

  // Small lots mostly get small district kits: the pack's small-lot kits in their style, tier 0 in a district family.

  const own = STYLES[st.id], smallKits = own === SETTING.kits.smallLots?.style ? SMALL_LOTS : OWN_TIERS.has(st.id) ? own.tiers[0] : null;
  const small = smallKits?.length && r() < (STYLES[st.id].smallShare ?? .8) * CITYTUNE.small;
  if (size < SC.smallLot && small) KITS[smallKits[Math.floor(kitPick * smallKits.length)]]?.(g.cx, g.cz, size, st, boost, r);
  else if (size < SC.smallLot) {
    const h = lerp(st.h0, st.h1, r() ** CITYTUNE.skew) * boost * (.5 + .6 * r());
    if (h > SC.tallInfill) buildTall(g.cx, g.cz, g.w - 2, g.d - 2, h, st, r, false);
    else if (r() < .5) {
      prism(scalePoly(g.poly, .92), 0, h, st, r, { skin: SKINS[pick('skin', st.w, r)] });
      roof(g.cx, g.cz, (g.w - 2) * .6, (g.d - 2) * .6, h, st, r);
    } else {
      bld(g.cx, g.cz, g.w - 2, g.d - 2, h, st, r, { skin: SKINS[pick('skin', st.w, r)] });
      neon(g.cx, g.cz, g.w - 2, g.d - 2, h, st, r);
    }
  } else KITS[kits[Math.floor(kitPick * kits.length)]]?.(g.cx, g.cz, size, st, boost, r);
  S.FRAME = null;
}

// ---------- corridor clearance ----------
// A build near a corridor runs, then every instance it added is checked against the corridor band.
// mark() and undo() wrap a build, so a failed try leaves nothing behind.

const mark = () => ({ n: INSTANCED.map(m => m.count), v: M.skin.length, fl: S.flicker.length, dc: S.DECOR.children.length });
function undo(k) {
  INSTANCED.forEach((m, j) => { m.count = k.n[j] ?? 0; });
  for (const [a, n] of [['pos', 3], ['nrm', 3], ['base', 3], ['win', 3], ['p', 4], ['skin', 1], ['u', 1], ['len', 1]]) M[a].length = k.v * n;
  S.flicker.length = k.fl;
  while (S.DECOR.children.length > k.dc) S.DECOR.remove(S.DECOR.children[S.DECOR.children.length - 1]);
}
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _n = new THREE.Matrix3(), _p = new THREE.Vector3(), _q = new THREE.Vector3(), _bb = new THREE.Box3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), SEETHROUGH = new Set([pools, puffs]);
const inBand = (q, y0, y1) => y1 > q.y - q.line.lo && y0 < q.y + q.line.hi;

// Everything added since k that reaches into the band of a sample in qs, as { m, i, q }.
// Lot prisms and decor meshes come back with m null.

function clash(k, qs) {
  const out = [];
  if (!qs.length) return out;
  INSTANCED.forEach((m, j) => {
    if (SEETHROUGH.has(m)) return;
    const g = m.geometry, bb = g.boundingBox ?? (g.computeBoundingBox(), g.boundingBox);
    const hx = (bb.max.x - bb.min.x) / 2, hy = (bb.max.y - bb.min.y) / 2, hz = (bb.max.z - bb.min.z) / 2;
    for (let i = k.n[j] ?? 0; i < m.count; i++) {
      _m.fromArray(m.instanceMatrix.array, i * 16);
      if (Math.abs(_m.determinant()) < 1e-9) continue;
      const e = _m.elements, cy = bb.getCenter(_p).applyMatrix4(_m).y;
      const ey = Math.abs(e[1]) * hx + Math.abs(e[5]) * hy + Math.abs(e[9]) * hz;
      _inv.copy(_m).invert(); _n.setFromMatrix4(_m);
      for (const q of qs) {
        if (!inBand(q, cy - ey, cy + ey)) continue;
        _p.set(q.x, cy, q.z).applyMatrix4(_inv);
        _q.copy(_p).clamp(bb.min, bb.max);
        if (_p.sub(_q).applyMatrix3(_n).length() < q.line.r) { out.push({ m, i, q }); break; }
      }
    }
  });

  // Prism triangles: walls test as a segment with a height range, roofs as a flat triangle.

  const P = M.pos, N = M.nrm;
  for (let t = k.v * 3; t + 9 <= P.length; t += 9) {
    const ys = [P[t + 1], P[t + 4], P[t + 7]], y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (const q of qs) {
      if (!inBand(q, y0, y1 + .01)) continue;
      let hit;
      if (Math.abs(N[t + 1]) > .5) {
        const s = [0, 3, 6].map(o => (P[t + (o + 3) % 9] - P[t + o]) * (q.z - P[t + o + 2]) - (P[t + (o + 5) % 9] - P[t + o + 2]) * (q.x - P[t + o]));
        hit = s.every(v => v >= 0) || s.every(v => v <= 0);
      } else {
        let a = 0, b = 3;
        if (Math.hypot(P[t + 3] - P[t], P[t + 5] - P[t + 2]) < .01) b = 6;
        const ax = P[t + a], az = P[t + a + 2], dx = P[t + b] - ax, dz = P[t + b + 2] - az, L2 = dx * dx + dz * dz || 1;
        const u = Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.z - az) * dz) / L2));
        hit = Math.hypot(q.x - ax - u * dx, q.z - az - u * dz) < q.line.r;
      }
      if (hit) { out.push({ m: null, q }); break; }
    }
  }
  for (const c of S.DECOR.children.slice(k.dc)) {
    _bb.setFromObject(c);
    if (_bb.isEmpty()) continue;
    const q = qs.find(q => inBand(q, _bb.min.y, _bb.max.y)
      && Math.hypot(Math.max(_bb.min.x - q.x, 0, q.x - _bb.max.x), Math.max(_bb.min.z - q.z, 0, q.z - _bb.max.z)) < q.line.r);
    if (q) out.push({ m: null, q });
  }
  return out;
}

// The top of the tallest building part added since k.

function topSince(k) {
  let top = 0;
  INSTANCED.forEach((m, j) => {
    if (!Object.values(SHAPES).includes(m)) return;
    const a = m.instanceMatrix.array;
    for (let i = k.n[j] ?? 0; i < m.count; i++) top = Math.max(top, a[i * 16 + 13] + Math.abs(a[i * 16 + 5]) / 2);
  });
  for (let t = k.v * 3 + 1; t < M.pos.length; t += 3) top = Math.max(top, M.pos[t]);
  return top;
}

// The largest part of frame f that one straight cut keeps clear of the samples in near, as a new frame, or null.

function trim(f, near) {
  let best = null;
  for (const ax of ['u', 'v']) for (const sg of [1, -1]) {
    const L = ax === 'u' ? f.w : f.d, O = ax === 'u' ? f.d : f.w;
    let cut = L / 2;
    for (const { q, u, v } of near) {
      const t = sg * (ax === 'u' ? u : v), R = q.line.r + 2;
      if (t + R > -L / 2) cut = Math.min(cut, t - R);
    }
    const keep = cut + L / 2;
    if (keep < 10 || keep >= L || (best && keep * O <= best.area)) continue;
    const m = sg * (cut - L / 2) / 2, du = ax === 'u' ? m : 0, dv = ax === 'v' ? m : 0;
    const w = ax === 'u' ? keep : f.w, d = ax === 'v' ? keep : f.d;
    const at = (u, v) => [f.cx + u * f.c + v * f.s, f.cz - u * f.s + v * f.c];
    const [cx, cz] = at(du, dv);
    best = { area: keep * O, g: { ...f, cx, cz, w, d, poly: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => at(du + a * w / 2, dv + b * d / 2)) } };
  }
  return best?.g ?? null;
}

// A tall tower may keep a maglev passing through it, or a highway when the tower is very wide.
// Its crossed boxes stay. Lights, signs and props in the band go, and a lit portal frames each point
// where the line enters or leaves a box. Returns false when the lot does not qualify.

export const TUNNELS = [];
function tunnel(k, hits) {
  if (hits.some(h => h.q.line.kind === 'station')) return false;
  if (hits.some(h => !h.m || (h.m !== SHAPES.box && Object.values(SHAPES).includes(h.m)))) return false;
  const boxes = [...new Set(hits.filter(h => h.m === SHAPES.box).map(h => h.i))];
  if (!boxes.length) return false;
  const top = topSince(k), a = SHAPES.box.instanceMatrix.array, j0 = k.n[INSTANCED.indexOf(SHAPES.box)];
  const box = i => {
    const e = a.slice(i * 16, i * 16 + 16);
    return { i, e, y0: e[13] - Math.abs(e[5]) / 2, y1: e[13] + Math.abs(e[5]) / 2, sx: Math.hypot(e[0], e[2]), sz: Math.hypot(e[8], e[10]), inv: new THREE.Matrix4().fromArray(e).invert() };
  };
  const inside = (b, x, y, z) => {
    if (y < b.y0 || y > b.y1) return false;
    _p.set(x, b.e[13], z).applyMatrix4(b.inv);
    return Math.abs(_p.x) <= .5 && Math.abs(_p.z) <= .5;
  };
  const all = [];
  for (let i = j0; i < SHAPES.box.count; i++) all.push(box(i));

  // Small low boxes in the band (fins, add-on rooms) go with the props. Every other crossed box must be
  // tall and wide enough to hold the line.

  const thin = new Set();
  for (const i of boxes) {
    const b = all.find(o => o.i === i), mine = hits.filter(h => h.m === SHAPES.box && h.i === i);
    for (const { q } of mine) {
      const L = q.line;
      if (top < Math.max(2 * q.y, q.y + 40)) return false;
      if (Math.min(b.sx, b.sz) < 10 && b.y1 - b.y0 < 15) { thin.add(i); continue; }
      if (b.y1 < q.y + L.hi) return false;
      if (Math.min(b.sx, b.sz) < (L.kind === 'maglev' ? 11 : 36)) return false;
    }
  }
  const portals = [];
  for (const i of boxes) {
    if (thin.has(i)) continue;
    const b = all.find(o => o.i === i), mine = hits.filter(h => h.m === SHAPES.box && h.i === i);

    // Walk each crossed line past the box and mark where it goes in or out.

    for (const L of new Set(mine.map(h => h.q.line))) {
      const n = L.s.length, idx = mine.filter(h => h.q.line === L).map(h => h.q.i), span = Math.ceil((b.sx + b.sz) / 3) + 4;
      const at = i => L.s[L.closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))];
      for (let s = Math.min(...idx) - span; s < Math.max(...idx) + span; s++) {
        let p0 = at(s), p1 = at(s + 1);
        if (inside(b, p0.x, p0.y, p0.z) === inside(b, p1.x, p1.y, p1.z)) continue;
        const into = !inside(b, p0.x, p0.y, p0.z);
        let t0 = 0, t1 = 1;
        for (let it = 0; it < 10; it++) {
          const t = (t0 + t1) / 2, x = lerp(p0.x, p1.x, t), z = lerp(p0.z, p1.z, t);
          if (inside(b, x, lerp(p0.y, p1.y, t), z) === into) t1 = t; else t0 = t;
        }
        const t = (t0 + t1) / 2, x = lerp(p0.x, p1.x, t), y = lerp(p0.y, p1.y, t), z = lerp(p0.z, p1.z, t);
        if (all.some(o => o !== b && !thin.has(o.i) && inside(o, x, y, z))) continue;
        _p.set(x, b.e[13], z).applyMatrix4(b.inv);
        const lx = Math.abs(_p.x) > Math.abs(_p.z) ? Math.sign(_p.x) : 0, lz = lx ? 0 : Math.sign(_p.z);
        const nx = b.e[0] * lx + b.e[8] * lz, nz = b.e[2] * lx + b.e[10] * lz, nl = Math.hypot(nx, nz);
        const tx = p1.x - p0.x, tz = p1.z - p0.z, tl = Math.hypot(tx, tz) || 1, cos = Math.abs(tx * nx + tz * nz) / tl / nl;

        // A portal that would overhang the facade's corner means the line clips the corner, so the lot does not tunnel.

        const along = lx ? Math.abs(_p.z) * b.sz : Math.abs(_p.x) * b.sx, half = (lx ? b.sz : b.sx) / 2;
        if (along + portalWidth(cos, L.kind) / 2 + .8 > half) return false;
        portals.push({ x, y, z, nx: nx / nl, nz: nz / nl, cos, kind: L.kind });
      }
    }
  }
  if (!portals.length) return false;
  for (const h of hits) if (h.m !== SHAPES.box || thin.has(h.i)) h.m.setMatrixAt(h.i, ZERO);
  for (const p of portals) portal(p);
  TUNNELS.push(portals);
  return true;
}

// A lit frame round the line's section on the facade. A highway's frame holds a dark inset that hides the windows
// behind it. A maglev opening gets a one-sided inset and a lining from ride.js, so riders see out the far end.

export const portalWidth = (cos, kind) => Math.min(2, 1 / Math.max(cos, .5)) * (kind === 'maglev' ? 7.2 : 18);
function portal({ x, y, z, nx, nz, cos, kind }) {
  const mag = kind === 'maglev', W = portalWidth(cos, kind);
  const y0 = y - (mag ? 3.6 : 2.4), y1 = y + (mag ? 6.2 : 3.4), H = y1 - y0, yc = (y0 + y1) / 2, ry = Math.atan2(nx, nz);
  const rgb = mag ? [.4, 1.3, 1.8] : [1.6, .9, .35], ex = nz, ez = -nx;
  if (!mag) prop('box', x + nx * .12, yc, z + nz * .12, W, H, .24, [.012, .014, .02], ry);
  for (const s of [-1, 1]) {
    glow(x + nx * .35, yc + s * (H / 2 + .3), z + nz * .35, W + 1.2, .6, .3, rgb, ry);
    glow(x + nx * .35 + ex * s * (W / 2 + .3), yc, z + nz * .35 + ez * s * (W / 2 + .3), .6, H, .3, rgb, ry);
  }
}

// Builds on frame f so nothing it adds reaches into a corridor. build(g, k, bare, slab) builds in frame g.
// The tries run in order: the full frame (a tall tower may tunnel), a tall lot rebuilt as one tower over
// the whole lot so the line can tunnel through its middle, the frame trimmed off the corridor, the full frame
// kept under the deck, then a bare yard. A lot that fits none of them stays empty.

function clearOf(f, build) {
  const qs = corridorIn(f, 30).map(h => h.q);
  if (!qs.length) return build(f, 1, false);
  const k = mark();
  build(f, 1, false);
  let hit = clash(k, qs);
  if (!hit.length || tunnel(k, hit)) return;
  const near = corridorIn(f, 2), top = topSince(k), g = near.length ? trim(f, near) : null;
  const yMax = Math.max(...hit.map(h => h.q.y)), wide = hit.every(h => h.q.line.kind === 'maglev') ? 16 : 40;
  if (top >= Math.max(2 * yMax, yMax + 40) && Math.min(f.w, f.d) >= wide) {
    undo(k);
    build(f, 1, false, top);
    hit = clash(k, qs);
    if (!hit.length || tunnel(k, hit)) return;
  }
  const low = Math.min(...[...hit.map(h => h.q), ...near.map(h => h.q)].map(q => q.y - q.line.lo)) - 1;
  const tries = [];
  if (g) tries.push([g, 1, false]);
  if (low > 8 && top > low) tries.push([f, low / top * .9, false], [f, low / top * .6, false]);
  tries.push([f, 1, true]);
  if (g) tries.push([g, 1, true]);
  for (const [frame, s, bare] of tries) {
    undo(k);
    build(frame, s, bare);
    if (!clash(k, qs).length) return;
  }
  undo(k);
}

S.BASE = new Map();
export function generate(blend) {
  for (const m of INSTANCED) m.count = S.BASE.get(m) ?? 0;
  resetMerged();
  S.flicker = S.flicker.filter(f => f[1] < (S.BASE.get(f[0]) ?? 0));
  if (!FRAMES[0]?.front) for (const f of [...FRAMES, ...ALL_BLOCK_FRAMES]) f.front = frontOf(f);
  TUNNELS.length = 0;

  // A block kit that spills into a corridor gives its block back to the lots.

  SITES = blockSites(blend).filter(({ f, zone }) => {
    if (edgeAt(f.cx, f.cz) < .15) return false;
    const r = rng(hash(Math.round(f.cx), Math.round(f.cz) + 99)), kits = BLOCK_KITS[zone], k = mark();
    S.FRAME = f;
    kits[Math.floor(r() * kits.length)](f.cx, f.cz, Math.min(f.w, BLOCK_MAX) - 4, Math.min(f.d, BLOCK_MAX) - 4, styleAt(f.cx, f.cz, blend), r);
    S.FRAME = null;
    if (!clash(k, corridorIn(f, 40).map(h => h.q)).length) return true;
    undo(k);
    return false;
  });
  for (const f of FRAMES) {
    if (Math.min(f.w, f.d) - 2 < 4 || Math.hypot(f.cx - CENTRE.x, f.cz - CENTRE.y) < CENTRE_R) continue;
    if (f.taken || inSite(f.cx, f.cz, 2)) continue;

    // Lots thin out toward the frayed edge, so the city ends in scattered buildings.

    if (edgeAt(f.cx, f.cz) < .08 + .3 * rng(hash(Math.round(f.cx), Math.round(f.cz) + 41))()) continue;
    clearOf(f, (g, k, bare, slab) => buildLot(f, g, blend, k, bare, slab));
  }
  FILL ??= fillCells();

  // Infill sites build as lots. Sites within 30 m of the district edge grow the style's edge kit, by default a grove.

  for (const f of INFILL) {
    if (inSite(f.cx, f.cz, 2)) continue;
    if (f.edge < 30) {
      const st = styleAt(f.cx, f.cz, blend), r = rng(hash(Math.round(f.cx * 10), Math.round(f.cz * 10) + 3));
      S.FRAME = f;
      KITS[STYLES[st.id].edgeKit ?? 'grove'](f.cx, f.cz, Math.min(f.w, f.d), st, 1, r);
      S.FRAME = null;
    } else clearOf(f, (g, k, bare, slab) => buildLot(f, g, blend, k, bare, slab));
  }
  for (const c of BAND) {
    const st = styleAt(c.x, c.z, blend);
    S.FRAME = { cx: 0, cz: 0, tx: c.x, tz: c.z, a: 0, c: 1, s: 0, w: 10, d: 10 };
    KITS[STYLES[st.id].edgeKit ?? 'grove'](0, 0, 10, st, 1, rng(hash(c.x, c.z + 11)));
    S.FRAME = null;
  }
  for (const c of FILL) {
    if (inSite(c.x, c.z, 4) || edgeAt(c.x, c.z) < .05) continue;
    const r = rng(hash(Math.round(c.x * 10), Math.round(c.z * 10) + 7));
    const Q = quarterAt(c.x, c.z), st = { ...styleAt(c.x, c.z, blend), ...(Q?.fill && Q.style) };
    const fk = KITS[STYLES[st.id].fillKit];
    if (STYLES[st.id].noFill && !fk) continue;
    S.FRAME = { cx: 0, cz: 0, tx: c.x, tz: c.z, a: c.a, c: Math.cos(c.a), s: Math.sin(c.a) };
    if (fk) fk(0, 0, 10, st, 1, r);
    else bld(0, 0, SC.fill + r() * SC.fill / 2, SC.fill + r() * SC.fill / 2, lerp(st.h0 * .5, st.h1 * .6, r() ** 2), st, r, { skin: SKINS[pick('skin', st.w, r)] });
    S.FRAME = null;
  }

  // Street lights along main and major streets, one pair every 24 m. A quarter's street colour beats its district's.
  // The pack's look.lamps sets the lamp heights on main and minor streets, and a post colour to stand each lamp
  // on a post, such as a lantern post. flicker makes each lamp waver like a flame, down to that share of its light.

  const LAMP = { main: 7, minor: 5, ...SETTING.look.lamps };
  const post = (x, z, y) => { if (LAMP.post) prop('cyl', x, y / 2, z, .18, y, .18, LAMP.post); };
  const lamp = (x, y, z, s, sy, rgb) => {
    const i = glow(x, y, z, s, sy, s, rgb);
    if (LAMP.flicker) S.flicker.push([glows, i, rgb, hash(Math.round(x * 10), Math.round(z * 10)) % 1000 / 100, false, LAMP.flicker]);
  };
  const streetAt = (x, z) => quarterAt(x, z)?.style.street ?? styleAt(x, z, blend).street;
  for (const st of STREETS) if (st.kind !== 'minor') for (let k = 0; k < st.path.length; k += Math.max(2, Math.round(SC.lampStep.main / 4 / CITYTUNE.lights))) {
    if (st.block?.[k]) continue;
    const p = st.path[k], sd = st.side[k], sc = streetAt(p.x, p.z);
    for (const o of [-SC.lampOffset.main, SC.lampOffset.main]) {
      lamp(p.x + sd.x * o, LAMP.main, p.z + sd.z * o, .5, .3, sc);
      post(p.x + sd.x * o, p.z + sd.z * o, LAMP.main - .2);
      pool(p.x + sd.x * o * .7, p.z + sd.z * o * .7, 16, sc.map(v => v * .07));
    }
  }

  // Faded centre dashes on main and major streets, one every 8 m, unless the pack's look.decor turns markings off.

  if (DECOR.markings) for (const st of STREETS) if (st.kind !== 'minor') for (let k = 0; k < st.path.length - 1; k += 2) {
    if (st.block?.[k]) continue;
    const a = st.path[k], b = st.path[k + 1];
    put(glows, (a.x + b.x) / 2, .12, (a.z + b.z) / 2, .25, .05, 2.6, Math.atan2(b.x - a.x, b.z - a.z), 0, [.16, .13, .06]);
  }

  // Minor streets get one dimmer light every 28 m, alternating sides.

  for (const st of STREETS) if (st.kind === 'minor') for (let k = 3, n = 0, step = Math.max(2, Math.round(SC.lampStep.minor / 4 / CITYTUNE.lights)); k < st.path.length; k += step, n++) {
    if (st.block?.[k]) continue;
    const p = st.path[k], sd = st.side[k], o = n % 2 ? SC.lampOffset.minor : -SC.lampOffset.minor;
    const sc = streetAt(p.x, p.z).map(v => v * .6);
    lamp(p.x + sd.x * o, LAMP.minor, p.z + sd.z * o, .4, .25, sc);
    post(p.x + sd.x * o, p.z + sd.z * o, LAMP.minor - .2);
    pool(p.x + sd.x * o * .6, p.z + sd.z * o * .6, 13, sc.map(v => v * .08));
  }
  for (const m of INSTANCED) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    for (const a of ['aBase', 'aWin', 'aP', 'aSkin', 'aSeed', 'aSlot']) if (m.geometry.attributes[a]) m.geometry.attributes[a].needsUpdate = true;
  }
  flushMerged();
  tileAll();
  const nb = Object.values(SHAPES).reduce((s, m) => s + m.count, 0);
  const np = Object.values(PROPS).reduce((s, m) => s + m.count, 0);
  document.getElementById('stats').textContent = `${nb} building parts · ${np} props · ${signs.count} signs · ${traffic.length} vehicles`;
}


export const SMALL_LOTS = [];
export const FAMILY_KITS = {}, LANDMARKS_KITS = [], OWN_TIERS = new Set();

export const ALL_BLOCK_FRAMES = CITY.blocks.map(lotFrame);

export const BLOCK_FRAMES = ALL_BLOCK_FRAMES.filter(f => Math.min(f.w, f.d) >= SC.siteMin);
