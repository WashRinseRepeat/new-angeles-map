// Offline city generator for the map spike.
// Streets come from tensor fields (vendored MapGenerator core, LGPL-3.0, see mapgen/).
// Output: ../city.json with districts, streets, lots and places in world metres.

import { readFileSync, writeFileSync } from 'node:fs';
import Vector from './mapgen/vector';
import TensorField from './mapgen/impl/tensor_field';
import { RK4Integrator } from './mapgen/impl/integrator';
import StreamlineGenerator from './mapgen/impl/streamlines';
import Graph from './mapgen/impl/graph';
import PolygonFinder from './mapgen/impl/polygon_finder';
import PolygonUtil from './mapgen/impl/polygon_util';
import { MAP } from '../settings/new-angeles/map.js';

// The upstream code draws from Math.random. A seeded generator makes every run identical.

const SEED = 1873;
let s = SEED;
Math.random = () => {
  s = (s + 0x6D2B79F5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Traced from the Shadow of the Beanstalk district map (p151), in map pixels. The setting pack owns the
// map-pixel-to-world transform, so the engine places landmarks and stops with the same numbers.

const w = ([u, v]: number[]) => [(u - MAP.cx) * MAP.scale, (v - MAP.cy) * MAP.scale];
// All 11 Earth districts, traced in design/map-trace.json. The engine looks styles up by id.

const TRACE = JSON.parse(readFileSync(new URL('../../design/map-trace.json', import.meta.url), 'utf8'));
const OLD3 = ['chakana', 'base-de-cayambe', 'rutherford'];
const DISTRICTS = TRACE.districts.map((d: any) => ({ id: d.id, name: d.name, poly: d.poly.map(w) }));
const SUBAREAS = TRACE.subareas.filter((a: any) => a.district).map((a: any) => ({ name: a.name, district: a.district, at: w(a.at), r: a.r * MAP.scale }));
const WATER = TRACE.water.map((x: any) => ({ name: x.name, poly: x.poly.map(w) }));
const PARKS = TRACE.parks.filter((x: any) => !/outside/.test(x.name)).map((x: any) => ({ name: x.name, poly: x.poly.map(w) }));
const COAST = TRACE.coast.map ? (Array.isArray(TRACE.coast[0][0]) ? TRACE.coast : [TRACE.coast]).map((l: number[][]) => l.map(w)) : [];
const byId = (id: string) => DISTRICTS.find((d: any) => d.id === id);

const ROOT = w([860, 115]);
// Campaign places come from spikes/map/places.json, which GM edit mode writes. at is world metres, size [w, d] metres,
// rot radians or null for the block's rotation, snap false seats the place exactly at at.

const PLACES = Object.entries(JSON.parse(readFileSync(new URL('../../places.json', import.meta.url), 'utf8')))
  .filter(([slug]) => !slug.startsWith('lm:'))
  .map(([slug, p]: [string, any]) => ({ slug, at: p.at, size: p.size, rot: p.rot ?? null, snap: p.snap !== false }));
const PLACE_HALF = 34;

// Quarters: named areas inside a district with their own look. Mercado Baja holds several of the crew's haunts;
// Akeidito is Rutherford's arcade quarter.

const QUARTERS = [
  { id: 'mercado-baja', name: 'Mercado Baja', poly: [[556, 316], [615, 306], [665, 322], [672, 396], [628, 410], [564, 402], [550, 360]].map(w) },
  { id: 'akeidito', name: 'Akeidito', poly: [[440, 520], [470, 512], [495, 500], [515, 488], [535, 492], [540, 520], [530, 550], [505, 568], [480, 572], [450, 560], [438, 540]].map(w) },
];

// Elevated highways follow the orange arterials on the map.

// Two more spurs start at the Root plaza edge and feed the city.

const HIGHWAYS = [
  { y: 34, pts: [[846, 152], [830, 220], [720, 330], [630, 450], [600, 560], [610, 680], [600, 740]] },
  { y: 24, pts: [[640, 100], [600, 200], [560, 330], [520, 400], [400, 450]] },
  { y: 30, pts: [[822, 108], [760, 100], [690, 120], [612, 170]] },
  { y: 28, pts: [[866, 156], [880, 230], [860, 290], [800, 330], [780, 380]] },
].map(h => ({ ...h, pts: h.pts.map(w) }));

// The traced arterials outside the first three districts become more elevated highways.

const vec = ([x, y]: number[]) => new Vector(x, y);
const oldPolys = OLD3.map(id => byId(id).poly.map(vec));
const inOld = (q: number[]) => oldPolys.some(poly => PolygonUtil.insidePolygon(vec(w(q)), poly));
// Arterials are sampled every 5 px and split where they enter the first three districts or water,
// so no highway runs out over a lake. The engine ramps open highway ends down to the street.

const wetNow = WATER.map((x: any) => x.poly.map(vec));
const inWater = (q: number[]) => wetNow.some((poly: Vector[]) => PolygonUtil.insidePolygon(vec(w(q)), poly));
for (const a of TRACE.arterials) {
  const pts: number[][] = [];
  for (let i = 0; i < a.pts.length - 1; i++) {
    const [ax, ay] = a.pts[i], [bx, by] = a.pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 5));
    for (let k = 0; k < n; k++) pts.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  pts.push(a.pts[a.pts.length - 1]);
  let run: number[][] = [];
  for (const q of [...pts, null]) {
    if (q && !inOld(q) && !inWater(q)) { run.push(q); continue; }
    if (run.length > 8) HIGHWAYS.push({ y: 26, pts: run.filter((_, k) => k % 4 === 0 || k === run.length - 1).map(w) });
    run = [];
  }
}

// The southern highway leaves the Quinde arterial at its south-west bend and runs east just outside the city,
// over the low peninsula south of Hospital Alcívar. It crosses the estuary on the Puente Alterno Sur and ends past
// the Florine Ojeda Bank. Past the branch it keeps 70 m off the district edge, so the Guayaquil lots stay as they
// are. gen/se-strip.py then grows the south-east corner down to it and turns its east end north into the city.

HIGHWAYS.push({ y: 26, pts: [[810, 1561.33], [810.56, 1584.44], [824.44, 1609.44], [874.44, 1617.78], [943.89, 1616.39], [993.89, 1612.22], [1124.44, 1612.22], [1166.11, 1615], [1221.67, 1617.78], [1263.33, 1615]].map(w) });

// Maglev loop through the first three districts. The spur runs from the Root plaza edge out to the west.
// The Grand and Center loops (gen/loops.py) carry the maglev west to the coast and south to Guayaquil.

const MAGLEV = [[650, 150], [800, 180], [780, 330], [700, 450], [650.6, 601.1], [529.4, 656.9], [401.7, 621.9], [361.7, 542.2], [370.6, 413.6], [532.8, 343.1], [570, 250]].map(w);
// The Beanstalk Southwest Line runs out from the Root plaza edge, round a loop and back to its own stem.

const SPURS = [
  [[826.1, 138.1], [760, 210], [690, 280], [509.7, 403.9], [473.1, 489.2], [401.1, 616.4], [523.9, 796.9], [443.9, 959.4], [500, 1093.9], [736.9, 1061.9], [799.4, 975], [782.2, 863.9], [688.1, 703.1], [528.6, 653.6], [472.5, 492.5], [509.7, 403.9], [691.1, 279.4]],
].map(l => l.map(w));
const RINGS = [
  [[958.1, 1490], [985, 1555], [1060, 1573.9], [1140, 1566.1], [1191.9, 1538.1], [1220, 1470], [1218.1, 1390], [1233.9, 1151.1], [1185.8, 1120.8], [1089.7, 1148.1], [1006.4, 1151.9], [950.3, 1243.9], [948.9, 1292.8], [928.1, 1361.4], [932.8, 1430.8]],
].map(l => l.map(w));

// The whole map frame, 1272 × 1600 px.

const ORIGIN = new Vector(...w([0, 0]));
const DIMS = new Vector(1272 * MAP.scale, 1600 * MAP.scale);

// ---------- tensor field ----------

// BEND=<degrees> turns on a slow rotational noise over the whole field, so long streets curve gently. It writes
// city-bend.json, which the map loads with ?streets=bend. BEND_IN=<id,id> bends only those districts, fading out
// over 150 m each side of their edge, and writes city-blend.json.

const BEND = Number(process.env.BEND ?? 0), BEND_IN = (process.env.BEND_IN ?? '').split(',').filter(Boolean);
const VARIANT = BEND_IN.length ? 'blend' : BEND ? 'bend' : '';
const field = new TensorField({ globalNoise: BEND > 0, noiseSizePark: 90, noiseAnglePark: 35, noiseSizeGlobal: 350, noiseAngleGlobal: BEND });

// The bend weight is 1 inside the bent districts and 0 outside, on a 20 m raster.

const sdPoly = ([x, y]: number[], poly: number[][]) => {
  let d = Infinity, inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i], ex = bx - ax, ey = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey)));
    d = Math.min(d, Math.hypot(x - ax - ex * t, y - ay - ey * t));
    if ((ay > y) !== (by > y) && x < ax + (y - ay) * ex / ey) inside = !inside;
  }
  return inside ? d : -d;
};
const RW = 20, RX = Math.ceil(DIMS.x / RW) + 1, RY = Math.ceil(DIMS.y / RW) + 1, WEIGHT = new Float32Array(RX * RY).fill(1);
if (BEND_IN.length) for (let j = 0; j < RY; j++) for (let i = 0; i < RX; i++) {
  const p = [ORIGIN.x + i * RW, ORIGIN.y + j * RW], d = Math.max(...BEND_IN.map(id => sdPoly(p, byId(id).poly)));
  const t = Math.max(0, Math.min(1, (d + 150) / 300));
  WEIGHT[j * RX + i] = t * t * (3 - 2 * t);
}
const bendAt = (p: Vector) => WEIGHT[Math.max(0, Math.min(RY - 1, Math.round((p.y - ORIGIN.y) / RW))) * RX + Math.max(0, Math.min(RX - 1, Math.round((p.x - ORIGIN.x) / RW)))];
field.noiseWeight = bendAt;
const centroid = (p: number[][]) => p.reduce((a, q) => [a[0] + q[0] / p.length, a[1] + q[1] / p.length], [0, 0]);
const V = ([x, y]: number[]) => new Vector(x, y);

// One street field per district: grids at their own angle, a spiral round the Root, radial knots at centres.

const C = (id: string) => V(centroid(byId(id).poly));
const sub = (name: string) => V(SUBAREAS.find((a: any) => a.name === name).at);
const [rx, ry] = centroid(byId('rutherford').poly);
field.addGrid(new Vector(rx, ry), 900, 1.4, 0.12);
field.addGrid(new Vector(rx - 220, ry + 260), 500, 1.2, 0.5);
const [bx, by] = centroid(byId('base-de-cayambe').poly);
field.addGrid(new Vector(bx, by), 800, 1.4, 0.68);
field.addGrid(new Vector(bx - 280, by - 120), 420, 1.2, 0.3);
field.addRadial(V(ROOT), 700, 1.6);
field.addGrid(V(w([700, 200])), 700, 1, 0.9);
field.addGrid(C('esmeraldas'), 900, 1.3, 1.0);
field.addGrid(C('nihongai'), 800, 1.3, 1.15);
field.addRadial(sub('Jinteki Biotech'), 260, 2);
field.addGrid(C('manta'), 900, 1.3, 1.22);
field.addGrid(C('laguna-velasco'), 1000, 1.2, 0.3);
field.addGrid(C('rabotgorod'), 1000, 1.1, 0.0);
field.addGrid(C('la-costa'), 1100, 1.1, 0.8);
field.addGrid(C('quinde'), 900, 1.2, 0.5);
field.addGrid(C('guayaquil'), 900, 1.3, 0.3);
field.addRadial(sub('Nuevo Guayaquil'), 300, 1.8);

// Rotational noise bends old-town streets: Base de Cayambe, Antiguo Guayaquil, Lakeside.

const disc = (c: Vector, r: number) => Array.from({ length: 16 }, (_, k) => new Vector(c.x + r * Math.cos(k * Math.PI / 8), c.y + r * Math.sin(k * Math.PI / 8)));
field.parks = [byId('base-de-cayambe').poly.map(V), disc(sub('Antiguo Guayaquil'), 230), disc(sub('Lakeside'), 170)];

// No streets inside the Root plaza or a named location's block.

const holes = [
  { c: ROOT, r: 170 },
];
const wet = [...WATER, ...PARKS].map((x: any) => x.poly.map(V));
const inHole = (p: Vector) => holes.some(h => Math.abs(p.x - h.c[0]) < h.r && Math.abs(p.y - h.c[1]) < h.r)
  || wet.some((poly: Vector[]) => PolygonUtil.insidePolygon(p, poly));
const city = DISTRICTS.map(d => d.poly.map(V));
const inCity = (p: Vector) => city.some(poly => PolygonUtil.insidePolygon(p, poly));
field.onLand = (p: Vector) => inCity(p) && !inHole(p);

// ---------- streets ----------

// Bent streets meet sooner and leave gaps for new ones, so BEND widens the spacing to keep blocks as large.
// Unbent ground keeps the straight spacing.

const spaced = (straight: number, bent: number) =>
  BEND ? { dsep: bent, dsepScale: (p: Vector) => 1 + (straight / bent - 1) * (1 - bendAt(p)) } : { dsep: straight };

const base = { dstep: 1, dcirclejoin: 5, joinangle: 0.1, seedTries: 300, simplifyTolerance: 0.5, collideEarly: 0 };
const PARAMS = {
  main: { ...base, dsep: 420, dtest: 200, dlookahead: 500, pathIterations: 4000 },
  major: { ...base, ...spaced(130, 150), dtest: 45, dlookahead: 220, pathIterations: 3000 },
  minor: { ...base, ...spaced(46, 50), dtest: 20, dlookahead: 60, pathIterations: 1500 },
};
const integrator = new RK4Integrator(field, PARAMS.minor);
const gens: Record<string, StreamlineGenerator> = {};
const prior: StreamlineGenerator[] = [];
for (const [name, params] of Object.entries(PARAMS)) {
  const g = new StreamlineGenerator(integrator, ORIGIN, DIMS, { ...params });
  for (const p of prior) g.addExistingStreamlines(p);
  const t = Date.now();

  // Upstream resolves this from its animation loop. Draining update() settles it.

  const done = g.createAllStreamlines(false);
  while (g.update());
  await done;
  console.log(`${name}: ${g.allStreamlinesSimple.length} streets in ${Date.now() - t} ms`);
  gens[name] = g;
  prior.push(g);
}

// ---------- blocks and lots ----------

// PolygonFinder drops blocks inside parks, so the noise region must go before block finding.

field.parks = [];
const all = Object.values(gens).flatMap(g => g.allStreamlinesSimple);
const graph = new Graph(all, PARAMS.minor.dstep, true);
const finder = new PolygonFinder(graph.nodes, { maxLength: 60, minArea: 200, shrinkSpacing: 3, chanceNoDivide: 0.08 }, field);
finder.findPolygons();
await finder.shrink(false);
const blocks = (finder as any)._shrunkPolygons.map((poly: Vector[]) => poly.map(v => [Math.round(v.x * 10) / 10, Math.round(v.y * 10) / 10]));
await finder.divide(false);
const lots = finder.polygons
  .map(poly => poly.map(v => [Math.round(v.x * 10) / 10, Math.round(v.y * 10) / 10]))
  .filter(poly => inCity(V(centroid(poly))));
console.log(`lots: ${lots.length}`);

// Streets resampled every 4 m so cars can move at constant speed.

function resample(line: Vector[], step = 4) {
  const out = [[line[0].x, line[0].y]];
  let carry = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], len = a.distanceTo(b);
    let d = step - carry;
    while (d <= len) { out.push([a.x + (b.x - a.x) * d / len, a.y + (b.y - a.y) * d / len]); d += step; }
    carry = (carry + len) % step;
  }
  return out.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
}
const streets = Object.fromEntries(Object.entries(gens).map(([k, g]) =>
  [k, g.allStreamlinesSimple.filter(l => l.length > 1).map(l => resample(l))]));

// A coastal road runs 16 m inland along the shore, so traffic follows the coast instead of ending at the sea.
// Lots it would cut through are dropped.

const coastRoads: number[][][] = [];
for (const line of COAST) {
  let run: number[][] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1], L = Math.hypot(bx - ax, bz - az), nx = (bz - az) / L, nz = -(bx - ax) / L;
    for (let t = 0; t < L; t += 8) {
      const p = [ax + (bx - ax) * t / L + nx * 16, az + (bz - az) * t / L + nz * 16];
      if (inCity(V(p))) { run.push(p); continue; }
      if (run.length > 8) coastRoads.push(run);
      run = [];
    }
  }
  if (run.length > 8) coastRoads.push(run);
}
streets.main.push(...coastRoads.map(l => resample(l.map(V))));
const roadCells = new Set<string>();
for (const l of coastRoads) for (const [x, z] of l) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) roadCells.add(`${Math.floor(x / 10) + a},${Math.floor(z / 10) + b}`);
const nearRoad = (poly: number[][]) => poly.some(([x, z]) => roadCells.has(`${Math.floor(x / 10)},${Math.floor(z / 10)}`));
const keptLots = lots.filter(poly => !nearRoad(poly));
console.log(`coast roads: ${coastRoads.length}, lots dropped: ${lots.length - keptLots.length}`);

// A variant takes everything but its streets, blocks and lots from city.json, so places and lines match.

const OUT = VARIANT ? `city-${VARIANT}.json` : 'city.json';
const rest = VARIANT ? JSON.parse(readFileSync(new URL('../../city.json', import.meta.url), 'utf8')) : {
  seed: SEED, origin: [ORIGIN.x, ORIGIN.y], dims: [DIMS.x, DIMS.y],
  districts: DISTRICTS, root: ROOT, places: PLACES, placeHalf: PLACE_HALF, quarters: QUARTERS, highways: HIGHWAYS, maglev: MAGLEV, spurs: SPURS, rings: RINGS, lines: [],
  subareas: SUBAREAS, water: WATER, parks: PARKS, coast: COAST,
};
writeFileSync(new URL(`../../${OUT}`, import.meta.url), JSON.stringify({ ...rest, streets, blocks, lots: keptLots }));
console.log(`wrote ${OUT}`);

// The Hugo site shows a "Show on the map" link on these location pages.

writeFileSync(new URL('../../../../data/map_places.json', import.meta.url), JSON.stringify(PLACES.map(p => p.slug), null, 2) + '\n');
console.log('wrote data/map_places.json');
