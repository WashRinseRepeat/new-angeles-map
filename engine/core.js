// City data, layout maths, district styles and named places.

import * as THREE from 'three';
import { S } from './state.js';
import { SETTING, atRoot, inPack } from './setting.js';

// ---------- layout: streets, lots and districts come from city.json (gen/gen.ts) ----------

// The public copy of the map runs without the archive site. Its index.html carries <meta name="standalone">,
// so it skips the site's images, pages and session index and plays audio from audio/.

export const STANDALONE = !!document.querySelector('meta[name=standalone]');

// A pack whose places have pages on the archive site sets cards.site. Its cards then show the site's images and
// link to its location pages, and the session tours load from the site's index. The public copy never does.

export const SITE = !STANDALONE && SETTING.cards.site === true;

export const loadMsg = t => { document.getElementById('loadMsg').textContent = t; };

// city.json streams in with a progress count. The server compresses it, so the count is in uncompressed MB.

export const CITY = await (async () => {
  const res = await fetch(atRoot(SETTING.data.city)), reader = res.body.getReader(), parts = [];
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

// The centre is the pack's central landmark. city.json gives its point, and the pack the radius of the plaza round it.

export const CENTRE = new THREE.Vector2(...(CITY.root ?? [0, 0]));
export const CENTRE_R = SETTING.centre.radius;
export const BLOCK = CITY.placeHalf * 2;

// A map pixel [u, v] on the pack's traced map to world metres [x, z].

const { cx: MX, cy: MY, scale: MS } = SETTING.map;
export const mapToWorld = ([u, v]) => [(u - MX) * MS, (v - MY) * MS];

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

// Signed distance to a polygon, positive inside.

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
// Quarters (CITY.quarters) are pockets inside a district with their own lot kits. The pack's quarter styles say
// which family each one builds from.

export const QUARTER_STYLES = SETTING.styles.quarters;
export const QUARTERS = (CITY.quarters ?? []).filter(q => QUARTER_STYLES[q.id]).map(q => ({ ...q, ...QUARTER_STYLES[q.id] }));
export const quarterAt = (x, z) => QUARTERS.find(q => sdPoly(x, z, q.poly) > 0) ?? null;

// Density decides height. Smooth noise gives the low carpet, cores give the skyline clusters.
// DENSITY.cores scales every core's peak. DENSITY.grain widens the 70 m noise, so tall and low lots mix
// more closely, and keeps its mean.

export const CORES = SETTING.styles.cores, DENSITY = { cores: SETTING.kits.tune.cores ?? 1, grain: SETTING.kits.tune.grain ?? 1 };
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), u = smooth(0, 1, x - xi), v = smooth(0, 1, z - zi);
  const h = (a, b) => hash(a, b) / 4294967296;
  return lerp(lerp(h(xi, zi), h(xi + 1, zi), u), lerp(h(xi, zi + 1), h(xi + 1, zi + 1), u), v);
}
export function density(x, z) {
  let n = .5 * vnoise(x / 420, z / 420) + .3 * vnoise(x / 180 + 7, z / 180 + 3) + .2 * (.5 + DENSITY.grain * (vnoise(x / 70, z / 70) - .5));
  for (const c of CORES) n += c.s * DENSITY.cores * Math.exp(-((x - c.x) ** 2 + (z - c.z) ** 2) / (2 * c.r * c.r));
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

// The pack's two end styles span the style axis. st.w places a style on it, from 0 at AXIS_LO to 1 at AXIS_HI.

export const [AXIS_LO, AXIS_HI] = SETTING.styles.axis;
export function mixStyle(w) {
  const m = {};
  for (const k of ['h0', 'h1', 'density', 'neon', 'lit', 'grime']) m[k] = lerp(AXIS_LO[k], AXIS_HI[k], w);
  for (const k of ['base', 'win', 'street']) m[k] = AXIS_LO[k].map((v, i) => lerp(v, AXIS_HI[k][i], w));
  m.w = w;
  return m;
}

// Every district has a style in the pack. zones lists the block zones a district allows.

export const STYLES = SETTING.styles.styles;

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

export const PLACE_MODULES = await Promise.all((CITY.places ??= []).map(q => import(inPack(`places/${q.slug}.js`))));
export const PLACES = CITY.places.map((q, k) => ({ slug: q.slug, x: q.at[0], z: q.at[1], ...PLACE_MODULES[k].meta, build: PLACE_MODULES[k].build }));
export const CENTRE_PLACE = SETTING.centre.place && { ...SETTING.centre.place };
export const centroidOf = poly => poly.reduce((a, q) => [a[0] + q[0] / poly.length, a[1] + q[1] / poly.length], [0, 0]);

