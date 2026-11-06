// Protect check. It confirms two things in the map stay put: the building sites in Base de Cayambe and the
// skyline of Guayaquil.
//
//   node spikes/map/gen/protect.mjs          compare the map with protect-baseline.json
//   node spikes/map/gen/protect.mjs --save   write the baseline from the current map
//   node spikes/map/gen/protect.mjs --shrink=0.95   scale every tower top in memory, to show the gate trips
//
// A zone's site count may rise but must not fall. The Guayaquil skyline is a soft guard against a major loss of tall
// or large buildings. The check fails when any of these falls more than 3% below the baseline.
//   1. The sum of tower box tops.
//   2. The number of buildings with a top over 150 m.
//   3. The number of buildings with a top over 250 m.
//   4. The plan floor area of tower boxes (the baseline needs a footprint per box).
//
// A tower box is a box with a top over 60 m. Tower boxes whose centres lie within 2 m of each other in plan join one
// building, and a building's top is its highest box. 2 m is the widest join at which no building spans two
// generator owners (OWNER) in the current map. The baseline holds [x, z, top] per box, and a --save adds the
// footprint, which turns item 4 into a gate. Until then the footprint area prints as information for the map only.
//
// The check also prints the building count and lists each baseline box that no longer stands within 0.5 m of its
// [x, z, top]. A lost box that reappears elsewhere at the same top counts as moved. These lines are information.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openMap } from './harness.mjs';

const FILE = fileURLToPath(new URL('./protect-baseline.json', import.meta.url));

// The top of each building among tower boxes. Boxes join when their centres lie within 2 m in plan.

function buildings(ts) {
  const up = ts.map((_, i) => i), root = i => up[i] === i ? i : (up[i] = root(up[i]));
  for (let i = 0; i < ts.length; i++) for (let j = 0; j < i; j++)
    if (Math.hypot(ts[i][0] - ts[j][0], ts[i][1] - ts[j][1]) <= 2) up[root(i)] = root(j);
  const top = new Map();
  ts.forEach((t, i) => top.set(root(i), Math.max(top.get(root(i)) ?? 0, t[2])));
  return [...top.values()];
}

const shrink = +(process.argv.find(a => a.startsWith('--shrink='))?.slice(9) ?? 1);

const { page, browser, server } = await openMap();
const now = await page.evaluate(async () => {
  const { OWNER, SITES } = await import(new URL('engine/generator.js', location.href).href);
  const { SHAPES } = await import(new URL('engine/instances.js', location.href).href);
  const poly = id => window.spike.CITY.districts.find(d => d.id === id).poly;
  const inside = (x, z, p) => {
    let c = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++)
      if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
    return c;
  };
  const sites = {}, cayambe = poly('base-de-cayambe'), guayaquil = poly('guayaquil');
  for (const s of SITES) if (inside(s.f.cx, s.f.cz, cayambe)) sites[s.zone] = (sites[s.zone] ?? 0) + 1;
  const towers = [], owners = new Set(), a = SHAPES.box.instanceMatrix.array, r = v => Math.round(v * 10) / 10;
  for (let i = 0; i < SHAPES.box.count; i++) {
    const m = a.subarray(i * 16, i * 16 + 16), top = m[13] + Math.abs(Math.hypot(m[4], m[5], m[6])) / 2;
    if (top > 60 && inside(m[12], m[14], guayaquil)) {
      towers.push([r(m[12]), r(m[14]), r(top), r(Math.hypot(m[0], m[1], m[2]) * Math.hypot(m[8], m[9], m[10]))]);
      owners.add(OWNER[i]);
    }
  }
  towers.sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
  return { sites, towers, owners: owners.size };
});
await browser.close();
server.close();

if (shrink !== 1) now.towers = now.towers.map(t => [t[0], t[1], Math.round(t[2] * shrink * 10) / 10, t[3]]).filter(t => t[2] > 60);

if (process.argv.includes('--save')) {
  writeFileSync(FILE, `{\n "sites": ${JSON.stringify(now.sites)},\n "towers": [\n${now.towers.map(t => `  ${JSON.stringify(t)}`).join(',\n')}\n ]\n}\n`);
  console.log(`protect: saved ${Object.keys(now.sites).length} zones, ${now.towers.length} towers`);
} else {
  const base = JSON.parse(readFileSync(FILE, 'utf8')), bad = [];
  for (const [z, n] of Object.entries(base.sites)) if ((now.sites[z] ?? 0) < n) bad.push(`sites: zone ${z} has ${now.sites[z] ?? 0}, baseline ${n}`);
  const near = (t, u) => t.every((v, i) => Math.abs(v - u[i]) <= .5);
  const gone = base.towers.filter(t => !now.towers.some(u => near(t, u))), added = now.towers.filter(u => !base.towers.some(t => near(t, u)));
  const moved = [];
  for (const t of gone) {
    const j = added.findIndex(u => Math.abs(u[2] - t[2]) <= .5);
    if (j >= 0) moved.push([t, ...added.splice(j, 1)]);
  }
  const lost = gone.filter(t => !moved.some(m => m[0] === t)), sum = ts => ts.reduce((s, t) => s + t[2], 0);
  const tall = ts => [...ts].sort((p, q) => q[2] - p[2]).slice(0, 5).map(t => t[2]).join(', ') || 'none';
  for (const [t, u] of moved) console.log(`towers: moved ${t.join(',')} to ${u.slice(0, 3).join(',')}`);
  const hasFp = base.towers.every(t => t.length > 3), area = ts => ts.reduce((s, t) => s + t[3], 0);
  const N = buildings(now.towers), N0 = buildings(base.towers);
  console.log(`towers: ${N.length} buildings, baseline ${N0.length}; ${now.owners} generator owners hold a tower box`);
  console.log(`towers: ${now.towers.length} boxes, baseline ${base.towers.length}; ${moved.length} moved, ${lost.length} lost, ${added.length} new`);
  console.log(`towers: tallest lost ${tall(lost)}; tallest new ${tall(added)}`);
  const gates = [
    ['height sum (m)', sum(now.towers), sum(base.towers)],
    ['buildings over 150 m', N.filter(h => h > 150).length, N0.filter(h => h > 150).length],
    ['buildings over 250 m', N.filter(h => h > 250).length, N0.filter(h => h > 250).length],
  ];
  if (hasFp) gates.push(['tower floor area (m2)', area(now.towers), area(base.towers)]);
  else console.log(`towers: floor area ${area(now.towers).toFixed(0)} m2, no baseline footprints, information only`);
  for (const [name, n, n0] of gates) {
    const pct = n0 ? 100 * (n - n0) / n0 : 0;
    console.log(`towers: ${name} ${n.toFixed(0)}, baseline ${n0.toFixed(0)}, ${pct.toFixed(1)}%`);
    if (n < n0 * .97) bad.push(`towers: ${name} ${n.toFixed(0)} is more than 3% below baseline ${n0.toFixed(0)}`);
  }
  console.log(bad.length ? bad.join('\n') : 'protect: ok');
  process.exitCode = bad.length ? 1 : 0;
}
