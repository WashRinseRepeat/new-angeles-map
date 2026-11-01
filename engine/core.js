// City data, layout maths, district styles and named places.

import * as THREE from 'three';
import { S } from './state.js';

// ---------- layout: streets, lots and districts come from city.json (gen/gen.ts) ----------

// The public copy of the map runs without the archive site. Its index.html carries <meta name="standalone">,
// so it skips the site's images, pages and session index and plays audio from audio/.

export const STANDALONE = !!document.querySelector('meta[name=standalone]');

export const loadMsg = t => { document.getElementById('loadMsg').textContent = t; };

// city.json streams in with a progress count. The server compresses it, so the count is in uncompressed MB.

export const CITY = await (async () => {
  const res = await fetch('city.json'), reader = res.body.getReader(), parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.length;
    loadMsg(`Loading the city · ${(got / 1e6).toFixed(1)} MB`);
  }
  loadMsg('Loading districts');
  return JSON.parse(new TextDecoder().decode(await new Blob(parts).arrayBuffer()));
})();
if (innerWidth < 600) document.getElementById('hud').open = false;
export const [DX, DZ] = CITY.dims;
export const STALK = new THREE.Vector2(...CITY.root);
export const PLAZA_R = 150;
export const BLOCK = CITY.placeHalf * 2;

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

// Signed distance to a polygon, positive inside. Drives the Rutherford style weight.

export function sdPoly(x, z, poly) {
  let d = Infinity, inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i], ex = bx - ax, ez = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
    d = Math.min(d, Math.hypot(x - ax - ex * t, z - az - ez * t));
    if ((az > z) !== (bz > z) && x < ax + (z - az) * ex / ez) inside = !inside;
  }
  return inside ? d : -d;
}
// Quarters (CITY.quarters) are pockets inside a district with their own lot kits. Every lot in one builds,
// and block kits keep out.
//   fam    kit family the quarter's lots build from
//   style  dials laid over the district style. h0 and h1 scale with the lot's height factor.
//   tiers  kit names by density, like a district's tiers. Without them a lot picks from the whole family.
//   fill   filler buildings take the quarter style too

export const QUARTER_STYLES = {
  'mercado-baja': { fam: 'mercado', style: { h0: 6, h1: 24, neon: 1.4, lit: .34, density: 1 } },
  akeidito: {
    fam: 'akeidito', fill: true,
    style: { w: .75, h0: 10, h1: 40, density: 1, neon: 1.2, lit: .34, grime: .3, base: [.12, .065, .06], win: [1, .66, .32],
      signs: [[1.9, .2, 1], [.2, 1.4, 1.9], [1.8, .85, .15], [1.9, .25, .3]], street: [1.15, .5, .18] },
    tiers: [['ak_shop', 'ak_shop', 'ak_kwiky', 'ak_galleria', 'ak_hall'], ['ak_pagoda', 'ak_pagoda', 'ak_hall', 'ak_galleria', 'ak_shop'],
      ['ak_pagoda', 'ak_pagoda', 'ak_hall', 'ak_galleria', 'ak_shop'], ['ak_pagoda', 'ak_pagoda', 'ak_tower', 'ak_hall']],
  },
};
export const QUARTERS = (CITY.quarters ?? []).filter(q => QUARTER_STYLES[q.id]).map(q => ({ ...q, ...QUARTER_STYLES[q.id] }));
export const quarterAt = (x, z) => QUARTERS.find(q => sdPoly(x, z, q.poly) > 0) ?? null;
export const inMercado = (x, z) => quarterAt(x, z)?.id === 'mercado-baja';

// Density decides height. Smooth noise gives the low carpet, cores give the skyline clusters.

export const CORES = [{ x: -600, z: 640, r: 220, s: .95 }, { x: -380, z: 900, r: 150, s: .6 }, { x: -420, z: 80, r: 160, s: .45 }, { x: 300, z: -300, r: 150, s: .3 }, { x: 560, z: -820, r: 260, s: .5 }];
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), u = smooth(0, 1, x - xi), v = smooth(0, 1, z - zi);
  const h = (a, b) => hash(a, b) / 4294967296;
  return lerp(lerp(h(xi, zi), h(xi + 1, zi), u), lerp(h(xi, zi + 1), h(xi + 1, zi + 1), u), v);
}
export function density(x, z) {
  let n = .5 * vnoise(x / 420, z / 420) + .3 * vnoise(x / 180 + 7, z / 180 + 3) + .2 * vnoise(x / 70, z / 70);
  for (const c of CORES) n += c.s * Math.exp(-((x - c.x) ** 2 + (z - c.z) ** 2) / (2 * c.r * c.r));
  return n - .2;
}

// Each lot gets its own seed from its position, so one lot never shifts another.

export function hash(a, b) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return (h ^ (h >>> 13)) >>> 0;
}
export function rng(seed) {
  let s = seed || 1;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- district styles ----------

export const BDC = {
  h0: 8, h1: 34, density: .86, neon: .3, lit: .2, grime: .7,
  base: [.14, .1, .075], win: [1.0, .62, .22],
  signs: [[1.6, .7, .12], [1.5, .16, .1], [1.4, .35, .08]],
  tiers: [['tenement', 'warehouse', 'cargo', 'park'], ['block', 'tenement', 'stack', 'warehouse'], ['tower', 'block']],
  street: [1.0, .45, .1],
};
export const RUT = {
  h0: 14, h1: 80, density: .97, neon: .8, lit: .2, grime: .2,
  base: [.07, .09, .11], win: [.42, .88, .95],
  signs: [[1.8, .15, 1.2], [.18, 1.4, 1.8], [.2, 1.6, 1.3], [1.2, .2, 1.6]],
  tiers: [['stack', 'block', 'park'], ['stack', 'tower', 'block', 'stack'], ['tower', 'twin', 'stack'], ['mega', 'tower', 'tower', 'twin', 'stack']],
  street: [.55, .6, 1.0],
};
export function mixStyle(w) {
  const m = {};
  for (const k of ['h0', 'h1', 'density', 'neon', 'lit', 'grime']) m[k] = lerp(BDC[k], RUT[k], w);
  for (const k of ['base', 'win', 'street']) m[k] = BDC[k].map((v, i) => lerp(v, RUT[k][i], w));
  m.w = w;
  return m;
}

// Every district has a style. Dials come from design/districts/<id>.md. w places a style on the old
// Base de Cayambe (0) to Rutherford (1) axis, which kits read for palettes and massing. zones lists
// the block zones a district allows. Tiers use existing kits until a district gets its own family.

export const STYLE = (o) => ({ zones: [], ...o });
export const STYLES = {
  chakana: BDC,
  'base-de-cayambe': BDC,
  rutherford: RUT,
  esmeraldas: STYLE({ w: .35, h0: 10, h1: 40, density: .72, neon: .45, lit: .32, grime: .45, base: [.13, .11, .1], win: [1, .76, .45],
    signs: [[.3, .8, 1.8], [1.6, .55, .15], [.4, 1.5, .5], [1.5, .3, .9]], street: [1, .58, .25], zones: ['industry'],
    tiers: [['block', 'tenement', 'park'], ['block', 'stack', 'tenement'], ['tower', 'block', 'stack']] }),
  nihongai: STYLE({ w: .85, h0: 12, h1: 55, density: .68, neon: .35, lit: .17, grime: .08, base: [.08, .085, .08], win: [1, .74, .44],
    signs: [[1.8, .18, .22], [1.6, .4, 1], [.3, 1.5, .8], [1.7, 1.2, .4]], street: [.95, .86, .72],
    tiers: [['park', 'stack', 'block'], ['stack', 'tower', 'block'], ['tower', 'twin', 'stack'], ['tower', 'twin']] }),
  manta: STYLE({ w: .7, h0: 6, h1: 45, density: .55, neon: .95, lit: .35, grime: .12, base: [.17, .18, .2], win: [.85, .95, 1],
    signs: [[1.8, .2, 1.3], [.2, 1.6, 1.5], [.4, .9, 1.8], [1.8, .6, .6]], street: [.9, .9, .85], zones: ['industry'],
    tiers: [['park', 'block', 'stack'], ['stack', 'tower', 'block'], ['tower', 'twin', 'stack'], ['tower', 'twin']] }),
  'laguna-velasco': STYLE({ w: .8, h0: 6, h1: 60, density: .8, neon: .15, lit: .3, grime: .1, base: [.17, .18, .2], win: [.78, .9, 1],
    signs: [[.3, 1.2, 1.4], [1.3, 1.1, .7], [1.2, .5, .9]], street: [1, .6, .32],
    tiers: [['park', 'park', 'block'], ['block', 'tower', 'park'], ['tower', 'twin', 'block'], ['tower', 'twin']], yardKit: 'lv_garden', noFill: true,
    blockCap: 160, blockGap: 0, blockMin: 30, smallShare: 1 }),
  rabotgorod: STYLE({ w: .2, h0: 14, h1: 38, density: .92, neon: .12, lit: .12, grime: .85, base: [.09, .085, .08], win: [.82, .9, .78],
    signs: [[1.4, .12, .1], [.25, .55, 1.4], [1.3, .9, .2]], street: [.62, .78, .7], zones: ['industry'],
    tiers: [['block', 'tenement'], ['block', 'tenement', 'stack'], ['tenement', 'block', 'stack']] }),
  'la-costa': STYLE({ w: .3, h0: 4, h1: 16, density: .15, neon: .08, lit: .15, grime: .2, base: [.13, .11, .09], win: [1, .76, .46],
    signs: [[1.5, .3, 1.2], [.9, 1.2, 1.3], [.2, 1.3, 1.1]], street: [1, .7, .4],
    tiers: [['park', 'park', 'warehouse'], ['park', 'warehouse', 'block']], yardKit: 'lc_fields', fillKit: 'lc_fill' }),
  quinde: STYLE({ w: .25, h0: 7, h1: 30, density: .82, neon: .25, lit: .35, grime: .9, base: [.12, .1, .08], win: [1, .78, .45],
    signs: [[1.6, 1.1, .1], [1.5, .45, .08], [1.4, 1.4, 1.5], [.4, 1.4, .3]], street: [1, .55, .15], zones: ['industry'],
    tiers: [['warehouse', 'cargo', 'tenement'], ['warehouse', 'tenement', 'block'], ['block', 'tower', 'tenement']] }),
  guayaquil: STYLE({ w: .4, h0: 10, h1: 60, density: .95, neon: .35, lit: .18, grime: .8, base: [.09, .08, .07], win: [1, .62, .32],
    signs: [[1.6, .2, .3], [1.5, .8, .2], [1.2, .2, 1.4], [.2, 1.2, .5]], street: [.85, .45, .15],
    tiers: [['tenement', 'block', 'stack'], ['block', 'stack', 'tower'], ['tower', 'twin', 'mega']] }),
};
BDC.w = 0; BDC.zones = ['industry', 'housing'];
RUT.w = 1; RUT.zones = [];

// A point's style mixes every district whose border lies within blend metres. mix lists [id, weight], strongest first.

export const STYLE_KEYS = ['h0', 'h1', 'density', 'neon', 'lit', 'grime', 'w'], STYLE_RGB = ['base', 'win', 'street'];
export function styleAt(x, z, blend) {
  const mix = [];
  let tot = 0, best = -Infinity, near = null;
  for (const d of CITY.districts) {
    const sd = sdPoly(x, z, d.poly), k = smooth(-blend, blend, sd);
    if (k > 0) { mix.push([d.id, k]); tot += k; }
    if (sd > best) { best = sd; near = d.id; }
  }
  if (!tot) { mix.push([near, 1]); tot = 1; }
  mix.sort((a, b) => b[1] - a[1]);
  const m = { mix: mix.map(([id, k]) => [id, k / tot]) };
  for (const key of STYLE_KEYS) m[key] = 0;
  for (const key of STYLE_RGB) m[key] = [0, 0, 0];
  for (const [id, k] of m.mix) {
    const S = STYLES[id];
    for (const key of STYLE_KEYS) m[key] += S[key] * k;
    for (const key of STYLE_RGB) for (let i = 0; i < 3; i++) m[key][i] += S[key][i] * k;
  }
  m.id = m.mix[0][0];
  m.signs = STYLES[m.id].signs;
  return m;
}
export const pickStyle = (st, roll) => {
  for (const [id, k] of st.mix) if ((roll -= k) <= 0) return STYLES[id];
  return STYLES[st.id];
};

// ---------- named places: positions come from city.json ----------

export const PLACE_MODULES = await Promise.all(CITY.places.map(q => import(`../places/${q.slug}.js`)));
export const PLACES = CITY.places.map((q, k) => ({ slug: q.slug, x: q.at[0], z: q.at[1], ...PLACE_MODULES[k].meta, build: PLACE_MODULES[k].build }));
export const STALK_PLACE = { slug: 'new-angeles', title: 'The Beanstalk', district: 'Chakana', type: 'Landmark · space elevator',
  summary: 'The space elevator at the heart of New Angeles. It rises from the Root and the Plaza del Cielo in Chakana.', color: [.6, 1.8, 2.6] };

