// Protect check. It confirms two things in the map stay put: the building sites in Base de Cayambe and the
// towers in Guayaquil.
//
//   node spikes/map/gen/protect.mjs          compare the map with protect-baseline.json
//   node spikes/map/gen/protect.mjs --save   write the baseline from the current map
//
// A zone's site count may rise but must not fall. Every baseline tower must still stand within 0.5 m of its
// [x, z, top]. An extra tower, or one a track tunnels through, does not fail.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openMap } from './harness.mjs';

const FILE = fileURLToPath(new URL('./protect-baseline.json', import.meta.url));

const { page, browser, server } = await openMap();
const now = await page.evaluate(async () => {
  const { SITES } = await import(new URL('engine/generator.js', location.href).href);
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
  const towers = [], a = SHAPES.box.instanceMatrix.array, r = v => Math.round(v * 10) / 10;
  for (let i = 0; i < SHAPES.box.count; i++) {
    const m = a.subarray(i * 16, i * 16 + 16), top = m[13] + Math.abs(Math.hypot(m[4], m[5], m[6])) / 2;
    if (top > 60 && inside(m[12], m[14], guayaquil)) towers.push([r(m[12]), r(m[14]), r(top)]);
  }
  towers.sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
  return { sites, towers };
});
await browser.close();
server.close();

if (process.argv.includes('--save')) {
  writeFileSync(FILE, `{\n "sites": ${JSON.stringify(now.sites)},\n "towers": [\n${now.towers.map(t => `  ${JSON.stringify(t)}`).join(',\n')}\n ]\n}\n`);
  console.log(`protect: saved ${Object.keys(now.sites).length} zones, ${now.towers.length} towers`);
} else {
  const base = JSON.parse(readFileSync(FILE, 'utf8')), bad = [];
  for (const [z, n] of Object.entries(base.sites)) if ((now.sites[z] ?? 0) < n) bad.push(`sites: zone ${z} has ${now.sites[z] ?? 0}, baseline ${n}`);
  const near = (t, u) => t.every((v, i) => Math.abs(v - u[i]) <= .5);
  for (const t of base.towers) if (!now.towers.some(u => near(t, u))) bad.push(`towers: missing ${t.join(',')}`);
  console.log(bad.length ? bad.join('\n') : 'protect: ok');
  process.exitCode = bad.length ? 1 : 0;
}
