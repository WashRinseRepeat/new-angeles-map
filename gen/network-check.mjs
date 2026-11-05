// Maglev network check. It loads the map twice, with the loops and with ?loops=0, and runs named checks on the
// routes. Each check prints PASS <name> or FAIL <name>: <detail>. The run exits with 1 on any failure.
//
//   node spikes/map/gen/network-check.mjs
//   node spikes/map/gen/network-check.mjs --only=reverse,decks   runs only checks whose name holds one of these words

import { openMap } from './harness.mjs';

const grab = async query => {
  const { page, browser, server, errors } = await openMap(query);
  try {
    return await page.evaluate(async () => {
      const { ROUTES, STATIONS } = await import(new URL('engine/transport.js', location.href).href);
      const { SETTING } = await import(new URL('engine/setting.js', location.href).href);
      const loops = (window.spike.CITY.loops ?? []).map(l => l.name);
      const routes = ROUTES.map(R => ({ name: R.name, closed: R.closed, len: R.len, loop: loops.includes(R.name),
        path: R.path.map(p => [p.x, p.y, p.z, p.w ?? 0]), wrap: !!R.path.closed,
        beside: R.path.map(p => ROUTES.find(Q => Q.path === p.beside)?.name ?? null),
        stops: STATIONS.filter(st => st.route === R).map(st => ({ name: st.name, snap: st.snap })) }));
      return { routes, want: (SETTING.transport.maglev.stops ?? []).map(s => s.name) };
    });
  } finally {
    if (errors.length) console.log(`page errors (${query || 'default'}):\n  ${errors.join('\n  ')}`);
    await browser.close();
    server.close();
  }
};
const [{ routes: ROUTES, want: WANT }, { routes: BASE }] = await Promise.all([grab(''), grab('?loops=0')]);

// ---------- helpers ----------

const between = (v, a, b) => v >= a && v <= b, near = (v, t, e) => Math.abs(v - t) <= e;
const len = name => ROUTES.find(R => R.name === name)?.len ?? NaN;
const stopsOf = name => ROUTES.find(R => R.name === name)?.stops.map(st => st.name) ?? [];
const STATIONS = ROUTES.flatMap(R => R.stops);
const dist2d = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
const V = ([x, y, z, w]) => ({ x, y, z, w });

// The nearest point on route R's track to p, with its deck height and flat heading.

const footOn = (R, p) => {
  const P = R.path, n = P.length;
  let best = { d: Infinity };
  for (let i = 0; i < (R.wrap ? n : n - 1); i++) {
    const [ax, ay, az] = P[i], [bx, by, bz] = P[(i + 1) % n], ex = bx - ax, ez = bz - az, L = Math.hypot(ex, ez) || 1;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * ex + (p.z - az) * ez) / (L * L)));
    const x = ax + ex * t, z = az + ez * t, d = Math.hypot(p.x - x, p.z - z);
    if (d < best.d) best = { d, x, z, y: ay + (by - ay) * t, tx: ex / L, tz: ez / L };
  }
  return best;
};

// Every loop point within 12 m of another route's track, with that track's nearest point q and whether the two
// headings lie within 30°.

let POINTS;
const loopPoints = () => POINTS ??= ROUTES.filter(R => R.loop).flatMap(L => L.path.flatMap((a, i) => {
  const n = L.path.length, p = V(a), b = L.path[(i + 1) % n], c = L.path[(i - 1 + n) % n];
  const hx = b[0] - c[0], hz = b[2] - c[2], h = Math.hypot(hx, hz) || 1;
  let q = null;
  for (const R of ROUTES) if (R !== L) { const f = footOn(R, p); if (f.d < 12 && (!q || f.d < q.d)) q = { ...f, R }; }
  const B = p.w === 1 && ROUTES.find(R => R.name === L.beside[i]), pq = B && footOn(B, p);
  return q ? [{ p, q, pq, para: Math.abs(q.tx * hx + q.tz * hz) / h > Math.cos(Math.PI / 6), loop: L.name, on: q.R.name }] : [];
}));

// Each route without a loop keeps every deck height it has when the loops are skipped.

const sameHeights = () => {
  const now = ROUTES.filter(R => !R.loop), was = BASE.filter(R => !R.loop);
  if (now.length !== was.length) return `${now.length} routes, ${was.length} without loops`;
  const moved = now.flatMap((R, k) => {
    const d = Math.max(0, ...R.path.map((p, i) => Math.abs(p[1] - (was[k].path[i]?.[1] ?? Infinity))));
    return d > 1e-6 || R.name !== was[k].name ? [`${R.name} by ${d.toFixed(2)} m`] : [];
  });
  return moved.length ? moved.join(', ') : true;
};

// Failing loop points group into runs of points within 40 m of each other.

const runs = bad => {
  const out = [];
  for (const b of bad) {
    const r = out.find(r => r.loop === b.loop && dist2d(r.last, b.p) < 40);
    if (r) { r.n++; r.last = b.p; r.dy = Math.max(r.dy, Math.abs(b.p.y - b.q.y)); r.d = Math.min(r.d, b.q.d); r.D = Math.max(r.D, b.q.d); }
    else out.push({ loop: b.loop, on: b.on, para: b.para, pulled: b.p.w === 1, at: b.p, last: b.p, n: 1, dy: Math.abs(b.p.y - b.q.y), d: b.q.d, D: b.q.d });
  }
  return out.map(r => `${r.loop} by ${r.on} at (${r.at.x.toFixed(0)}, ${r.at.z.toFixed(0)}) ${r.para ? 'parallel' : 'crossing'}${r.pulled ? ' pulled' : ''} ` +
    `${r.n} pts, ${r.d.toFixed(1)}-${r.D.toFixed(1)} m apart, dy up to ${r.dy.toFixed(1)} m`).join('\n    ');
};

// ---------- checks ----------

let failed = 0;
const ONLY = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');
const ran = new Set();
async function check(name, fn) {
  if (ONLY && !ONLY.some(w => name.includes(w))) return;
  ran.add(name);
  let r;
  try { r = await fn(); } catch (e) { r = e.message; }
  if (r === true) return console.log(`PASS ${name}`);
  failed++;
  console.log(`FAIL ${name}: ${r === false ? 'false' : r}`);
}
const explain = (ok, detail) => ok || detail();

await check('loops exist', () => ['Grand Loop', 'Centre Loop'].every(n => ROUTES.some(R => R.name === n && R.closed)));
await check('loop lengths', () => explain(between(len('Grand Loop'), 12000, 20000) && between(len('Centre Loop'), 6000, 11000),
  () => `Grand Loop ${len('Grand Loop').toFixed(0)} m, Centre Loop ${len('Centre Loop').toFixed(0)} m`));

// Every loop point within 12 m of another track's deck sits at least 6.4 m beside it or 8 m above or below it.
// A fully pulled point (weight 1) also sits 6.8 ± 0.3 m beside its partner track at the same height (± 0.5 m).

const fine = ({ p, q, pq }) => (q.d >= 6.4 || Math.abs(p.y - q.y) >= 8) && (!pq || near(pq.d, 6.8, .3) && Math.abs(p.y - pq.y) < .5);
await check('decks clear', () => explain(loopPoints().every(fine), () => {
  const bad = loopPoints().filter(b => !fine(b));
  return `${bad.length} of ${loopPoints().length} points\n    ${runs(bad)}`;
}));
await check('no existing deck moved', sameHeights);

// No loop sample climbs more than 8% to the next one, the engine's grade limit (1e-6 for rounding).

await check('loop grades', () => {
  const steep = ROUTES.filter(R => R.loop).flatMap(L => L.path.flatMap((a, i) => {
    const b = L.path[(i + 1) % L.path.length], g = Math.abs(b[1] - a[1]) / (Math.hypot(b[0] - a[0], b[2] - a[2]) || 1e-9);
    return g > .08 + 1e-6 ? [`${L.name} at (${a[0].toFixed(0)}, ${a[2].toFixed(0)}) ${(g * 100).toFixed(2)}%`] : [];
  }));
  return !steep.length || `${steep.length} samples\n    ${steep.slice(0, 12).join('\n    ')}`;
});

// Hand stops snap to a route within 150 m, or the engine drops them. A stop on double track gets a station on each guideway.

await check('beanstalk on both loops', () => ['Grand Loop', 'Centre Loop'].every(n => stopsOf(n).includes('The Beanstalk')));
await check('interchanges on both loops', () => ['Base de Cayambe', 'Laguna Velasco'].every(s => ['Grand Loop', 'Centre Loop'].every(n => stopsOf(n).includes(s))));
await check('every hand stop has a station', () => {
  const lost = WANT.filter(n => !STATIONS.some(st => st.name === n));
  return !lost.length || `no station for ${lost.join(', ')}`;
});

// The branch lines are gone and every tour still has a path (TOURS warns at load when one has none).

const RETIRED = ['Esmeraldas Line', 'Chakana Line', 'Guayaquil Line', 'La Costa Line', 'Base de Cayambe Line'];
await check('branch lines retired', () => !ROUTES.some(R => RETIRED.includes(R.name)) || ROUTES.filter(R => RETIRED.includes(R.name)).map(R => R.name).join());

// ---------- rides (live page) ----------
// One page runs every ride check. The in-page helpers pump frames and read the rider's train with rideInfo.

const live = await openMap();
const inPage = fn => () => live.page.evaluate(fn);
await check('no tour warnings', () => !live.errors.concat(live.warnings).some(m => m.includes('tour without a path')) || live.warnings.concat(live.errors).filter(m => m.includes('tour without')).join());

// A loop may tunnel through a block site. Every New Angeles style has a portal look, so every portal wears one,
// the one of its building's style. Portals of two style objects differ in shape or light.

await check('block sites tunnel', inPage(async () => {
  const { SITES } = await import(new URL('engine/generator.js', location.href).href);
  return SITES.some(s => s.tunnel) || 'no block site has a tunnel';
}));
await check('portals styled', inPage(async () => {
  const { TUNNELS } = await import(new URL('engine/generator.js', location.href).href);
  const { STYLES } = await import(new URL('engine/core.js', location.href).href);
  const ps = TUNNELS.flat(), bare = ps.filter(p => !p.look || p.look !== STYLES[p.style]?.portal);
  // Styles that share one style object (Chakana is Base de Cayambe's) share its look.

  const looks = new Map();
  for (const p of ps.filter(p => p.look)) {
    const key = JSON.stringify([p.look.depth, p.look.bar, p.look.strip, p.lit]);
    looks.set(p.look, { id: p.style, keys: new Set([...looks.get(p.look)?.keys ?? [], key]) });
  }
  const L = [...looks.values()];
  const same = L.flatMap((a, i) => L.slice(i + 1).filter(b => [...a.keys].some(k => b.keys.has(k))).map(b => `${a.id}/${b.id}`));
  if (bare.length) return `${bare.length} of ${ps.length} portals without their style's look (${[...new Set(bare.map(p => p.style))].join(', ')})`;
  if (looks.size < 2) return `portals in ${looks.size} style only`;
  return !same.length || `same look in ${same.join(', ')}`;
}));
try {
  await live.page.evaluate(async () => {
    const { ROUTES } = await import(new URL('engine/transport.js', location.href).href);
    const { startRide, rideInfo } = await import(new URL('engine/ride.js', location.href).href);
    // The page clock only moves when the harness moves it, so each pumped frame also moves it 17 ms.

    const $ = id => document.getElementById(id), pump = async n => { for (let i = 0; i < n; i++) { window.__t += 17; await window.__pump(1); } };
    const ride = name => { startRide(ROUTES.find(R => R.name === name).stops[0]); return pump(200); };
    const moved = async n => { const a = rideInfo(); await pump(n); const b = rideInfo(); return { dir: b.dir, ds: b.s - a.s }; };
    const rideAtDwell = async name => {
      await ride(name);
      // A train counts as at a dwell only after it has moved, so a stalled train never passes.

      const s0 = rideInfo().s;
      for (let i = 0; i < 400; i++) { const a = rideInfo().s; await pump(5); if (rideInfo().s === a && Math.abs(a - s0) > 1) return true; }
      return false;
    };
    window.__ride = { $, pump, ride, moved, rideAtDwell, rideInfo };
  });
  await check('reverse shows on a loop', inPage(async () => { const { ride, $ } = window.__ride; await ride('Centre Loop'); return !$('rFlip').hidden; }));
  await check('reverse turns a loop train', inPage(async () => {
    const { ride, moved, pump, $ } = window.__ride;
    await ride('Centre Loop');
    await pump(300);
    const a = await moved(40);
    $('rFlip').click();
    const b = await moved(40);
    return a.dir === -b.dir && Math.abs(a.ds) > 1 && Math.abs(b.ds) > 1 && Math.sign(a.ds) === -Math.sign(b.ds) || JSON.stringify({ a, b });
  }));
  await check('reverse at a dwell keeps position', inPage(async () => {
    const { rideAtDwell, rideInfo, pump, $ } = window.__ride;
    if (!await rideAtDwell('Grand Loop')) return 'the train never moved to a dwell';
    const s0 = rideInfo().s;
    $('rFlip').click();
    await pump(1);
    return Math.abs(rideInfo().s - s0) < 1 || `${s0} -> ${rideInfo().s}`;
  }));
  await check('reverse names the station ahead', inPage(async () => {
    const { ride, moved, pump, rideInfo, $ } = window.__ride;
    await ride('Centre Loop');
    await moved(40);
    $('rFlip').click();
    await pump(60);
    const R = (await import(new URL('engine/transport.js', location.href).href)).ROUTES.find(R => R.name === 'Centre Loop');
    const s = rideInfo().s, behind = [...R.stops].reverse().find(st => st.s <= s) ?? R.stops.at(-1);
    const got = $('rNext').textContent;
    return got === `Next: ${behind.name}` || got === `${behind.name} station` || `${got} vs Next: ${behind.name}`;
  }));
  await check('picker lists loops first', inPage(() => {
    const got = [...document.querySelectorAll('#ridePick summary span')].slice(0, 2).map(e => e.textContent).join();
    return got === 'Grand Loop,Centre Loop' || got;
  }));
} finally {
  if (live.errors.length) console.log(`page errors (rides):\n  ${live.errors.join('\n  ')}`);
  await live.browser.close();
  live.server.close();
}

if (ONLY && !ran.size) { console.log(`FAIL --only=${ONLY.join(',')} matches no check`); failed++; }
process.exitCode = failed ? 1 : 0;
