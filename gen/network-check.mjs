// Maglev network check. It loads the map twice, with the loops and with ?loops=0, and runs named checks on the
// routes. Each check prints PASS <name> or FAIL <name>: <detail>. The run exits with 1 on any failure.
//
//   node spikes/map/gen/network-check.mjs
//   node spikes/map/gen/network-check.mjs --only=reverse,decks   runs only checks whose name holds one of these words

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openMap } from './harness.mjs';
import { validPlaces } from './places-shape.mjs';

const grab = async query => {
  const { page, browser, server, errors } = await openMap(query);
  try {
    return await page.evaluate(async () => {
      const { ROUTES, STATIONS } = await import(new URL('engine/transport.js', location.href).href);
      const { SETTING } = await import(new URL('engine/setting.js', location.href).href);
      const loops = (window.spike.CITY.loops ?? []).map(l => l.name);
      const routes = ROUTES.map(R => ({ name: R.name, closed: R.closed, len: R.len, loop: loops.includes(R.name),
        path: R.path.map(p => [p.x, p.y, p.z, p.w ?? 0, p.pin ? 1 : 0]), wrap: !!R.path.closed, balloon: R.balloon ?? null,
        beside: R.path.map(p => ROUTES.find(Q => Q.path === p.beside)?.name ?? null), letGo: R.path.filter(p => p.letGo).map(p => [p.x, p.z]),
        stops: STATIONS.filter(st => st.route === R).map(st => { const c = R.curve.getPointAt(st.u); return { name: st.name, snap: st.snap, x: c.x, z: c.z }; }) }));
      // Each station with its route, heading and deck, the route of its twin master (of) and of its crossing
      // partner (cross). Each build unit lists the boxes a station frame laid, in that frame.

      const { UNITS } = await import(new URL('engine/ride.js', location.href).href);
      const stations = STATIONS.map(st => { const p = st.route.curve.getPointAt(st.u), t = st.route.curve.getTangentAt(st.u);
        return { name: st.name, route: st.route.name, s: st.s, x: p.x, y: p.y, z: p.z, hx: t.x, hz: t.z, of: st.of?.route.name ?? null, cross: st.cross?.route.name ?? null, sides: st.sides }; });
      const units = (UNITS ?? []).map(u => ({ kind: u.kind, name: u.name, own: u.own.map(R => R.name), f: u.f, parts: u.parts, tower: u.tower ?? null }));
      return { routes, stations, units, want: (SETTING.transport.maglev.stops ?? []).map(s => s.name) };
    });
  } finally {
    if (errors.length) console.log(`page errors (${query || 'default'}):\n  ${errors.join('\n  ')}`);
    await browser.close();
    server.close();
  }
};
const [{ routes: ROUTES, stations: ST, units: UNITS, want: WANT }, { routes: BASE }] = await Promise.all([grab(''), grab('?loops=0')]);

// ---------- helpers ----------

const between = (v, a, b) => v >= a && v <= b, near = (v, t, e) => Math.abs(v - t) <= e;
const len = name => ROUTES.find(R => R.name === name)?.len ?? NaN;
const stopsOf = name => ROUTES.find(R => R.name === name)?.stops.map(st => st.name) ?? [];
const STATIONS = ROUTES.flatMap(R => R.stops);
const dist2d = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
const V = ([x, y, z, w, pin]) => ({ x, y, z, w, pin });

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

// Each loop point lists every other route's track within 12 m. Each entry holds that track's nearest point q and
// says whether the two headings lie within 30°. A pinned point also carries pq, its nearest point on its partner.

let POINTS;
const loopPoints = () => POINTS ??= ROUTES.filter(R => R.loop).flatMap(L => L.path.flatMap((a, i) => {
  const n = L.path.length, p = V(a), b = L.path[(i + 1) % n], c = L.path[(i - 1 + n) % n];
  const hx = b[0] - c[0], hz = b[2] - c[2], h = Math.hypot(hx, hz) || 1;
  const B = p.pin && ROUTES.find(R => R.name === L.beside[i]), pq = B && footOn(B, p);
  return ROUTES.filter(R => R !== L).map(R => ({ ...footOn(R, p), R })).filter(q => q.d < 12)
    .map(q => ({ p, q, pq, para: Math.abs(q.tx * hx + q.tz * hz) / h > Math.cos(Math.PI / 6), loop: L.name, on: q.R.name }));
}));

// Each route without a loop keeps every deck height it has when the loops are skipped. Within 200 m of a stop it
// shares with a loop the deck may differ by 0.1 m, because the loop's station decides where that stop's station
// stands, so its pull differs.

const sameHeights = () => {
  const now = ROUTES.filter(R => !R.loop), was = BASE.filter(R => !R.loop);
  if (now.length !== was.length) return `${now.length} routes, ${was.length} without loops`;
  const loops = ROUTES.filter(R => R.loop).map(R => R.name);
  const moved = now.flatMap((R, k) => {
    const shared = ST.filter(t => t.route === R.name && ST.some(o => o.name === t.name && loops.includes(o.route)));
    const slack = ([x, , z]) => shared.some(t => Math.hypot(t.x - x, t.z - z) <= 200) ? .1 : 0;
    const d = Math.max(0, ...R.path.map((p, i) => Math.abs(p[1] - (was[k].path[i]?.[1] ?? Infinity)) - slack(p)));
    return d > 1e-6 || R.name !== was[k].name ? [`${R.name} by ${d.toFixed(2)} m`] : [];
  });
  return moved.length ? moved.join(', ') : true;
};

// Failing loop points group into runs of points within 40 m of each other.

const runs = bad => {
  const out = [];
  for (const b of bad) {
    const r = out.find(r => r.loop === b.loop && r.on === b.on && dist2d(r.last, b.p) < 40);
    if (r) { r.n++; r.last = b.p; r.dy = Math.max(r.dy, Math.abs(b.p.y - b.q.y)); r.d = Math.min(r.d, b.q.d); r.D = Math.max(r.D, b.q.d); }
    else out.push({ loop: b.loop, on: b.on, para: b.para, pulled: !!b.p.pin, at: b.p, last: b.p, n: 1, dy: Math.abs(b.p.y - b.q.y), d: b.q.d, D: b.q.d });
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

// Every loop point sits at least 6.4 m beside every other track's deck, or 8 m above or below it, at any angle.
// A pinned point also sits 6.8 ± 0.3 m beside its partner track at the same height (± 0.5 m).

const fine = ({ p, q, pq }) => (q.d >= 6.4 || Math.abs(p.y - q.y) >= 8) && (!pq || near(pq.d, 6.8, .3) && Math.abs(p.y - pq.y) < .5);
await check('decks clear', () => explain(loopPoints().every(fine), () => {
  const bad = loopPoints().filter(b => !fine(b));
  return `${bad.length} of ${loopPoints().length} points\n    ${runs(bad)}`;
}));
await check('no existing deck moved', sameHeights);

// A pinned loop sample keeps 6.8 ± 0.3 m beside its partner track after every pass.

await check('pins: partners stay 6.8 m apart', () => {
  const bad = ROUTES.filter(R => R.loop).flatMap(L => L.path.map(V).flatMap((p, i) => {
    const B = p.pin && ROUTES.find(R => R.name === L.beside[i]), f = B && footOn(B, p);
    return f && !near(f.d, 6.8, .3) ? [`${L.name} at (${p.x.toFixed(0)}, ${p.z.toFixed(0)}) ${f.d.toFixed(2)} m from ${B.name}`] : [];
  }));
  return !bad.length || `${bad.length} samples\n    ${bad.slice(0, 12).join('\n    ')}`;
});

// A pinned sample that lets go of its partner's deck drops out of the two checks above. Four samples on the Centre
// Loop let go today, so a change in that count shows up here.

await check('pins: 4 samples let go of their partner', () => {
  const all = ROUTES.flatMap(R => R.letGo.map(([x, z]) => `${R.name} at (${x.toFixed(0)}, ${z.toFixed(0)})`));
  return all.length === 4 || `${all.length} samples\n    ${all.slice(0, 12).join('\n    ')}`;
});

// A loop turns no tighter than a 60 m radius, measured on three points 20 m apart along it, stations included.
// bends lists a route's bends under 60 m. An open route skips the first and last 20 m. A lollipop runs on from
// its end down the stem, so the switch counts.

const bends = L => {
  const P = L.path.map(V).concat(L.balloon ? L.path.slice(L.balloon.m - 8, L.balloon.m).reverse().map(V) : []);
  const n = P.length, cum = [0], ring = L.wrap, end = ring ? n : n - 1;
  for (let i = 1; i <= end; i++) cum.push(cum[i - 1] + dist2d(P[i - 1], P[i % n]));
  const at = s => {
    s = ring ? (s % cum[end] + cum[end]) % cum[end] : s;
    let i = 0;
    while (cum[i + 1] <= s) i++;
    const a = P[i], b = P[(i + 1) % n], t = (s - cum[i]) / (cum[i + 1] - cum[i]);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
  };
  const out = [];
  P.forEach((b, i) => {
    if (!ring && (cum[i] < 20 || cum[i] > cum[end] - 20)) return;
    const a = at(cum[i] - 20), c = at(cum[i] + 20), area = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
    const r = area ? dist2d(a, b) * dist2d(b, c) * dist2d(a, c) / (4 * area) : Infinity;
    if (r >= 60) return;
    const last = out.at(-1);
    if (last && dist2d(last.end, b) < 40) { last.end = b; if (r < last.r) Object.assign(last, { r, b }); }
    else out.push({ r, b, end: b });
  });
  return out.map(o => `${L.name} ${o.r.toFixed(0)} m at (${o.b.x.toFixed(0)}, ${o.b.z.toFixed(0)})`);
};
await check('curves: no radius under 60 m', () => {
  const bad = ROUTES.filter(R => R.loop).flatMap(bends);
  return !bad.length || `${bad.length} bends\n    ${bad.join('\n    ')}`;
});

// A line turns no tighter than 60 m either, the Southwest Line's switch included.

await check('curves: lines no radius under 60 m', () => {
  const bad = ROUTES.filter(R => !R.closed).flatMap(bends);
  return !bad.length || `${bad.length} bends\n    ${bad.join('\n    ')}`;
});

// No loop sample climbs more than 10% to the next one, and no sample of any other track more than 8%. These are
// the engine's grade limits (1e-6 for rounding). The loops need the 10% to ramp down into the hall.

const limit = L => L.loop ? .1 : .08;
await check('hall: ramp grade', () => {
  const steep = ROUTES.flatMap(L => L.path.flatMap((a, i) => {
    const b = L.path[i + 1] ?? (L.wrap && L.path[0]);
    if (!b) return [];
    const g = Math.abs(b[1] - a[1]) / (Math.hypot(b[0] - a[0], b[2] - a[2]) || 1e-9);
    return g > limit(L) + 1e-6 ? [`${L.name} at (${a[0].toFixed(0)}, ${a[2].toFixed(0)}) ${(g * 100).toFixed(2)}%`] : [];
  }));
  return !steep.length || `${steep.length} samples\n    ${steep.slice(0, 12).join('\n    ')}`;
});

// On a closed track the last sample and the first differ in height by at most the track's grade limit times
// their spacing.

await check('seam: closed tracks join level', () => {
  const bad = ROUTES.filter(R => R.closed && R.wrap).flatMap(R => {
    const a = R.path.at(-1), b = R.path[0], d = Math.hypot(b[0] - a[0], b[2] - a[2]), step = Math.abs(b[1] - a[1]);
    return step > limit(R) * d + 1e-6 ? [`${R.name} at (${a[0].toFixed(0)}, ${a[2].toFixed(0)}) step ${step.toFixed(2)} m in ${d.toFixed(1)} m`] : [];
  });
  return !bad.length || bad.join('\n    ');
});

// Hand stops snap to a route within 150 m, or the engine drops them. A stop on double track gets a station on each guideway.

await check('beanstalk on both loops', () => ['Grand Loop', 'Centre Loop'].every(n => stopsOf(n).includes('The Beanstalk')));
await check('interchanges follow the user routes', () => ['Grand Loop', 'Centre Loop'].every(n => stopsOf(n).includes('Base de Cayambe'))
  && stopsOf('Grand Loop').includes('Laguna Velasco'));
await check('every hand stop has a station', () => {
  const lost = WANT.filter(n => !STATIONS.some(st => st.name === n));
  return !lost.length || `no station for ${lost.join(', ')}`;
});

// A twin lies within 30° of its master's heading and within 1 m of its deck, so twins stand on parallel track.

const angle = (a, b) => Math.acos(Math.min(1, Math.abs(a.hx * b.hx + a.hz * b.hz) / (Math.hypot(a.hx, a.hz) * Math.hypot(b.hx, b.hz)))) * 180 / Math.PI;
await check('stations: twins are parallel', () => {
  const bad = ST.filter(t => t.of).flatMap(t => {
    const m = ST.find(o => o.name === t.name && o.route === t.of), a = angle(t, m), dy = Math.abs(t.y - m.y);
    return a <= 30 && dy <= 1 ? [] : [`${t.name} on ${t.route} ${a.toFixed(0)}° and ${dy.toFixed(1)} m off ${t.of}`];
  });
  return !bad.length || bad.join('\n    ');
});

// No box a station lays overlaps another route's corridor band, 6 m beside its deck and 5 m above or below it.
// A unit's own routes are its station's route, or both routes of a shared double-track kit.

await check('stations: kits stay off other track', () => {
  if (!UNITS.length) return 'no build units';
  const bad = UNITS.flatMap(u => {
    const { tx, tz, c, s, y0 } = u.f, hits = new Map();
    for (const R of ROUTES.filter(R => !u.own.includes(R.name))) {
      const P = R.path, n = P.length;
      for (let i = 0; i < (R.wrap ? n : n - 1); i++) {
        const a = V(P[i]), b = V(P[(i + 1) % n]), k = Math.ceil(dist2d(a, b) / 2);
        if (dist2d(a, { x: tx, z: tz }) > 140) continue;
        for (let j = 0; j <= k; j++) {
          const x = a.x + (b.x - a.x) * j / k, z = a.z + (b.z - a.z) * j / k, y = a.y + (b.y - a.y) * j / k - y0;
          const X = x - tx, Z = z - tz, lx = X * c - Z * s, lz = X * s + Z * c;
          for (const [x0, x1, py0, py1, z0, z1] of u.parts) {
            const d = Math.hypot(Math.max(x0 - lx, 0, lx - x1), Math.max(z0 - lz, 0, lz - z1));
            if (d < 6 && py1 > y - 5 && py0 < y + 5) hits.set(R.name, (hits.get(R.name) ?? 0) + 1);
          }
        }
      }
    }
    return [...hits].map(([r, k]) => `${u.name} ${u.kind} on ${u.own.join('/')} hits ${r} (${k})`);
  });
  return !bad.length || `${bad.length} units\n    ${bad.join('\n    ')}`;
});

// An interchange tower meets no piece of either station it joins. Its box turns into each station's frame as the
// box round its corners.

const toWorld = (f, x, z) => [f.tx + x * f.c + z * f.s, f.tz - x * f.s + z * f.c];
const toLocal = (f, x, z) => { const X = x - f.tx, Z = z - f.tz; return [X * f.c - Z * f.s, X * f.s + Z * f.c]; };
await check('stations: towers clear the kits', () => {
  const bad = UNITS.filter(u => u.kind === 'interchange' && u.tower).flatMap(u => {
    const [x0, x1, b0, b1, z0, z1] = u.tower;
    return UNITS.filter(v => v.kind === 'station' && v.name === u.name && u.own.includes(v.own[0])).flatMap(v => {
      const P = [[x0, z0], [x0, z1], [x1, z0], [x1, z1]].map(([x, z]) => toLocal(v.f, ...toWorld(u.f, x, z)));
      const X0 = Math.min(...P.map(p => p[0])), X1 = Math.max(...P.map(p => p[0])), Z0 = Math.min(...P.map(p => p[1])), Z1 = Math.max(...P.map(p => p[1]));
      const dy = u.f.y0 - v.f.y0, k = v.parts.filter(([a0, a1, c0, c1, e0, e1]) => a0 < X1 && a1 > X0 && e0 < Z1 && e1 > Z0 && c0 < b1 + dy && c1 > b0 + dy).length;
      return k ? [`${u.name} tower meets ${k} pieces of the ${v.own[0]} station`] : [];
    });
  });
  return !bad.length || bad.join('\n    ');
});

// No platform side lies over or under another route's deck. A side does when another route runs within its strip,
// x 3.4 to 9.4 from its track, for 8 m or more within 20° of its heading, from 15 m under the deck to 15 m over
// it. A crossing at a steeper angle passes.

await check('stations: no platform over or under other track', () => {
  const bad = ST.flatMap(t => {
    const u = UNITS.find(v => v.kind === 'station' && v.name === t.name && v.own[0] === t.route);
    if (!u || !t.sides) return [`${t.name} on ${t.route} has no sides`];
    const { tx, tz, c, s, y0 } = u.f;
    return [-1, 1].flatMap((side, k) => {
      if (!t.sides[k]) return [];
      return ROUTES.filter(R => R.name !== t.route).flatMap(R => {
        const P = R.path, n = P.length, bins = new Set();
        for (let i = 0; i < (R.wrap ? n : n - 1); i++) {
          const a = V(P[i]), b = V(P[(i + 1) % n]), m = Math.ceil(dist2d(a, b) / 2), L = dist2d(a, b) || 1;
          if (dist2d(a, { x: tx, z: tz }) > 140 || Math.abs(((b.x - a.x) * s + (b.z - a.z) * c) / L) < Math.cos(Math.PI / 9)) continue;
          for (let j = 0; j <= m; j++) {
            const X = a.x + (b.x - a.x) * j / m - tx, Z = a.z + (b.z - a.z) * j / m - tz, y = a.y + (b.y - a.y) * j / m - y0;
            const lx = (X * c - Z * s) * side, lz = X * s + Z * c;
            if (lx > 3.4 && lx < 9.4 && Math.abs(lz) < 32 && Math.abs(y) < 15) bins.add(Math.floor((lz + 32) / 4));
          }
        }
        return bins.size >= 2 ? [`${t.name} on ${t.route} ${side < 0 ? 'left' : 'right'} side over ${R.name} for ${bins.size * 4} m`] : [];
      });
    });
  });
  return !bad.length || bad.join('\n    ');
});

// Each named crossing has a station on both routes, linked as cross both ways, stacked at least 10 m apart where
// the decks cross, and joined by an interchange tower.

await check('stations: crossings interchange', () => {
  const bad = ['Rutherford', 'Antiguo Guayaquil', 'Chakana'].flatMap(name => {
    const a = ST.find(t => t.name === name && t.cross), b = a && ST.find(t => t.name === name && t.route === a.cross);
    if (!a || !b || b.cross !== a.route) return [`${name} has no linked pair`];
    const A = ROUTES.find(R => R.name === a.route), B = ROUTES.find(R => R.name === b.route);
    const at = A.path.map(V).flatMap((p, i, P) => {
      const q = P[(i + 1) % P.length];
      if (dist2d(p, a) > 60) return [];
      return Array.from({ length: 8 }, (_, k) => {
        const t = k / 8, m = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: p.z + (q.z - p.z) * t };
        return { p: m, f: footOn(B, m) };
      });
    }).sort((u, v) => u.f.d - v.f.d)[0];
    const dy = Math.abs(at.p.y - at.f.y);
    if (dy < 9.95) return [`${name} decks ${dy.toFixed(1)} m apart`];
    return UNITS.some(u => u.kind === 'interchange' && u.name === name && u.parts.length) ? [] : [`${name} has no interchange tower`];
  });
  return !bad.length || bad.join('\n    ');
});

// The branch lines are gone and every tour still has a path (TOURS warns at load when one has none).

const RETIRED = ['Esmeraldas Line', 'Chakana Line', 'Guayaquil Line', 'La Costa Line', 'Base de Cayambe Line'];
await check('branch lines retired', () => !ROUTES.some(R => RETIRED.includes(R.name)) || ROUTES.filter(R => RETIRED.includes(R.name)).map(R => R.name).join());

// ---------- the Southwest lollipop ----------
// The line runs out its single-track stem, round the balloon and back to the switch, where its last sample sits
// on the stem's sample balloon.m. A train runs on from there back down the stem.

const SW = ROUTES.find(R => R.name === 'Beanstalk Southwest Line'), BL = SW?.balloon;

// No two samples of the line lie within 8 m in plan and 8 m in height, 60 m or more apart along it, except within
// 60 m of the switch, where the balloon's two ends meet the stem.

await check('lollipop: one deck per stretch', () => {
  if (!BL) return 'the line has no balloon';
  const P = SW.path.map(V), n = P.length, cum = [0], W = P[BL.m];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + dist2d(P[i - 1], P[i]));
  const bad = [];
  P.forEach((p, i) => {
    if (dist2d(p, W) < 60) return;
    for (let j = 0; j < n - 1; j++) {
      if (Math.abs(cum[j] - cum[i]) < 60 || Math.abs(cum[j + 1] - cum[i]) < 60) continue;
      const a = P[j], b = P[j + 1], ex = b.x - a.x, ez = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.z - a.z) * ez) / (ex * ex + ez * ez || 1)));
      const d = Math.hypot(p.x - a.x - ex * t, p.z - a.z - ez * t), dy = Math.abs(p.y - a.y - (b.y - a.y) * t);
      if (d < 8 && dy < 8 && !bad.some(o => dist2d(o.p, p) < 40)) bad.push({ p, d, dy });
    }
  });
  return !bad.length || `${bad.length} places\n    ${bad.map(o => `(${o.p.x.toFixed(0)}, ${o.p.z.toFixed(0)}) ${o.d.toFixed(1)} m apart, dy ${o.dy.toFixed(1)} m`).join('\n    ')}`;
});

// The balloon's last sample sits on the stem at the switch, within 0.1 m in plan and in height.

await check('lollipop: balloon rejoins the stem', () => {
  if (!BL) return 'the line has no balloon';
  const e = V(SW.path.at(-1)), w = V(SW.path[BL.m]), d = dist2d(e, w), dy = Math.abs(e.y - w.y);
  return d <= .1 && dy <= .1 || `end ${d.toFixed(2)} m off the switch, ${dy.toFixed(2)} m step`;
});

await check('lollipop: stops along the line', () => {
  const lost = ['Haas Central', 'Oak Lane'].filter(n => !stopsOf('Beanstalk Southwest Line').includes(n));
  return !lost.length || `no station on the line for ${lost.join(', ')}`;
});

// Where the line comes within 6.4 m of the Centre Loop in plan, the decks lie 10 m apart (5 cm for rounding).

await check('lollipop: crosses clear', () => {
  const C = ROUTES.find(R => R.name === 'Centre Loop');
  const bad = SW.path.map(V).map(p => ({ p, f: footOn(C, p) })).filter(({ p, f }) => f.d < 6.4 && Math.abs(p.y - f.y) < 9.95);
  return !bad.length || `${bad.length} samples\n    ${bad.slice(0, 12).map(({ p, f }) => `(${p.x.toFixed(0)}, ${p.z.toFixed(0)}) ${f.d.toFixed(1)} m apart, dy ${Math.abs(p.y - f.y).toFixed(1)} m`).join('\n    ')}`;
});

// ---------- rides (live page) ----------
// One page runs every ride check. The in-page helpers pump frames and read the rider's train with rideInfo.

const live = await openMap();

// The harness serves no ride audio. A clip the page asks for comes from static/podcasts/ride when it is there,
// else as 3 s of silence, so the sound checks can play it.

const AUDIO = new URL('../../../static/podcasts/ride/', import.meta.url), SILENCE = Buffer.alloc(44 + 48000);
SILENCE.write('RIFF', 0); SILENCE.writeUInt32LE(36 + 48000, 4); SILENCE.write('WAVEfmt ', 8);
[[16, 16, 4], [1, 20, 2], [1, 22, 2], [8000, 24, 4], [16000, 28, 4], [2, 32, 2], [16, 34, 2]].forEach(([v, at, n]) => n === 4 ? SILENCE.writeUInt32LE(v, at) : SILENCE.writeUInt16LE(v, at));
SILENCE.write('data', 36); SILENCE.writeUInt32LE(48000, 40);
await live.page.route(/\/podcasts\/ride\/[\w-]+\.mp3$/, r => {
  const f = fileURLToPath(new URL(r.request().url().split('/').pop(), AUDIO));
  return existsSync(f) ? r.fulfill({ path: f, contentType: 'audio/mpeg' }) : r.fulfill({ body: SILENCE, contentType: 'audio/wav' });
});
const inPage = fn => () => live.page.evaluate(fn);
await check('no tour warnings', () => !live.errors.concat(live.warnings).some(m => m.includes('tour without a path')) || live.warnings.concat(live.errors).filter(m => m.includes('tour without')).join());

// The whole of places.json passes the dev server's shape rules, so a GM edit-mode save of the current file succeeds.

await check('places.json: seats pass the server rules', async () => {
  const { readFileSync } = await import('node:fs');
  const all = JSON.parse(readFileSync(new URL('../places.json', import.meta.url), 'utf8'));
  const bad = Object.keys(all).filter(k => !validPlaces({ [k]: all[k] }));
  return validPlaces(all) && !bad.length || `refused: ${bad.join(', ')}`;
});

// A landmark seat in places.json (`lm:<name>`) holds a block centre. Its landmark stands on that block, and no
// track crosses it.

await check('landmarks: pinned seats hold', async () => {
  const { readFileSync } = await import('node:fs');
  const seats = Object.entries(JSON.parse(readFileSync(new URL('../places.json', import.meta.url), 'utf8'))).filter(([k]) => k.startsWith('lm:'));
  if (!seats.length) return 'no pinned landmark seats';
  const sites = await live.page.evaluate(async () => {
    const { corridorIn } = await import(new URL('engine/transport.js', location.href).href);
    return (await import(new URL('engine/api.js', location.href).href)).LANDMARK_SITES
      .map(l => ({ key: l.key, block: l.block && [l.block.cx, l.block.cz], crossed: l.block ? corridorIn(l.block, 4, Math.min(l.block.w, 140), Math.min(l.block.d, 140)).length : 0 }));
  });
  const off = seats.map(([k, p]) => ({ key: k.slice(3), p: p.at, s: sites.find(l => l.key === k.slice(3)) }))
    .filter(o => !o.s?.block || Math.hypot(o.s.block[0] - o.p[0], o.s.block[1] - o.p[1]) > 1 || o.s.crossed)
    .map(o => o.s?.block && !o.s.crossed ? `${o.key} seat (${o.p}) stands on ${o.s.block.map(v => v.toFixed(1))}`
      : o.s?.block && o.s.crossed && Math.hypot(o.s.block[0] - o.p[0], o.s.block[1] - o.p[1]) <= 1 ? `${o.key} seat (${o.p}) is crossed by track` : `${o.key} seat (${o.p}) stands on no block`);
  return off.length ? off.join('; ') : true;
});

// A loop may tunnel through a block site. Every New Angeles style has a portal look, so every portal wears one,
// the one of its building's style. Portals of two style objects differ in shape or light.

await check('block sites tunnel', inPage(async () => {
  const { SITES } = await import(new URL('engine/generator.js', location.href).href);
  return SITES.some(s => s.tunnel) || 'no block site has a tunnel';
}));

// Where a maglev crosses a portal's facade at deck height, its deck fits inside that portal, so double track
// shares one wide opening. A route may have its own portal on the same face when the two openings stand 6 m
// or more apart. Every maglev portal meets its facade with cos .7 or more, or .4 on a standing tower.

await check('portals: one per track bundle', inPage(async () => {
  const { TUNNELS } = await import(new URL('engine/generator.js', location.href).href);
  const { ROUTES } = await import(new URL('engine/transport.js', location.href).href);
  const ps = TUNNELS.flat().filter(p => p.kind === 'maglev'), bad = [];
  const tracks = ROUTES.map(R => ({ R, s: R.curve.getSpacedPoints(Math.ceil(R.len / 2)) }));
  const at = p => `(${p.x.toFixed(0)},${p.z.toFixed(0)})`;
  for (const p of ps) {
    if (p.cos < (p.stand ? .4 : .7)) bad.push(`${at(p)} at cos ${p.cos.toFixed(2)}`);
    if (p.w == null || p.half == null) { bad.push(`${at(p)} has no width or facade`); continue; }
    const ex = p.nz, ez = -p.nx;
    for (const { R, s } of tracks) for (let i = 1; i < s.length; i++) {
      const a = s[i - 1], b = s[i], da = (a.x - p.x) * p.nx + (a.z - p.z) * p.nz, db = (b.x - p.x) * p.nx + (b.z - p.z) * p.nz;
      if (da * db > 0 || da === db) continue;
      const t = da / (da - db), x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
      const u = Math.abs((x - p.x) * ex + (z - p.z) * ez);
      if (Math.abs(y - p.y) >= 5 || u >= p.half || u + 3.4 <= p.w / 2 + .5) continue;
      const own = ps.find(o => o !== p && o.at.some(c => Math.hypot(c.x - x, c.y - y, c.z - z) < 3));
      if (own && Math.abs((own.x - p.x) * ex + (own.z - p.z) * ez) - (own.w + p.w) / 2 >= 6) continue;
      bad.push(`${R.name} misses the portal at ${at(p)} by ${(u + 3.4 - p.w / 2).toFixed(1)} m`);
    }
  }
  return !bad.length || [...new Set(bad)].join('; ');
}));

// A test guideway 6.5 m beside the City Loop through the tower at (-396,1018) makes double track there. Each face
// it pierces gets one portal that holds both crossings, wide enough for both decks.

await check('portals: twin track shares one wide portal', async () => {
  const twin = await openMap('?twin=-396,1018,6.5');
  try {
    return await twin.page.evaluate(async () => {
      const { TUNNELS } = await import(new URL('engine/generator.js', location.href).href);
      const { CORRIDORS } = await import(new URL('engine/transport.js', location.href).href);
      const ps = TUNNELS.find(ps => ps.some(p => Math.hypot(p.x + 396, p.z - 1018) < 40)), test = CORRIDORS.at(-1);
      if (!ps) return 'the tower at (-396,1018) does not tunnel';
      const on = (c, L) => L.s.some(q => Math.hypot(q.x - c.x, q.z - c.z) < 2);
      const bad = ps.flatMap(p => {
        const u = p.at.map(c => Math.abs((c.x - p.x) * p.nz - (c.z - p.z) * p.nx));
        return p.at.length === 2 && p.at.some(c => on(c, test)) && p.at.some(c => !on(c, test)) && u.every(u => u + 3.4 <= p.w / 2 + .1)
          ? [] : [`(${p.x.toFixed(0)},${p.z.toFixed(0)}) w${p.w.toFixed(1)} holds ${p.at.length}`];
      });
      return ps.length === 2 && !bad.length || `${ps.length} portals; ${bad.join('; ')}`;
    });
  } finally {
    await twin.browser.close();
    twin.server.close();
  }
});

// A tunnelled building keeps 1 m clear of every other building. Its boxes above 30 m come no closer than 1 m to
// another building's boxes above 30 m. Older lots elsewhere may still overlap their neighbours.

await check('buildings: no tall boxes overlap', inPage(async () => {
  const { OWNER, TUNNELS, boxGap } = await import(new URL('engine/generator.js', location.href).href);
  const { SHAPES } = await import(new URL('engine/instances.js', location.href).href);
  const a = SHAPES.box.instanceMatrix.array, n = SHAPES.box.count, top = i => a[i * 16 + 13] + Math.abs(a[i * 16 + 5]) / 2;
  const holds = (i, x, y, z) => {
    const e = a.subarray(i * 16, i * 16 + 16), sx = Math.hypot(e[0], e[2]), sz = Math.hypot(e[8], e[10]), hy = Math.abs(e[5]) / 2;
    const u = ((x - e[12]) * e[0] + (z - e[14]) * e[2]) / sx, v = ((x - e[12]) * e[8] + (z - e[14]) * e[10]) / sz;
    return sx && Math.abs(u) <= sx / 2 && Math.abs(v) <= sz / 2 && Math.abs(y - e[13]) <= hy;
  };

  // A portal's building owns the box that holds a point 1 m inside its facade.

  const tunnelled = new Set();
  for (const p of TUNNELS.flat()) for (let i = 0; i < n; i++) if (holds(i, p.x - p.nx, p.y, p.z - p.nz)) tunnelled.add(OWNER[i]);
  const bad = [];
  for (let i = 0; i < n; i++) if (tunnelled.has(OWNER[i]) && top(i) > 30)
    for (let j = 0; j < n; j++) if (OWNER[j] !== OWNER[i] && top(j) > 30 && Math.hypot(a[i * 16 + 12] - a[j * 16 + 12], a[i * 16 + 14] - a[j * 16 + 14]) < 200 && boxGap(i, j) < 1)
      bad.push(`(${a[i * 16 + 12].toFixed(0)},${a[i * 16 + 14].toFixed(0)}) top ${top(i).toFixed(0)} / (${a[j * 16 + 12].toFixed(0)},${a[j * 16 + 14].toFixed(0)}) top ${top(j).toFixed(0)} gap ${boxGap(i, j).toFixed(2)}`);
  return !bad.length || `${tunnelled.size} tunnelled buildings; ${bad.join('; ')}`;
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

// ---------- the Beanstalk hall ----------
// Each loop's Beanstalk station stands on the hall deck, with at least 8 m of ground over it.

await check('hall: loops stop underground', inPage(async () => {
  const { HALL, ROUTES, STATIONS } = await import(new URL('engine/transport.js', location.href).href);
  const { groundAt } = await import(new URL('engine/relief.js', location.href).href);
  if (!HALL) return 'no hall';
  const bad = ROUTES.filter(R => R.lap).flatMap(R => {
    const st = STATIONS.find(st => st.route === R && st.name === 'The Beanstalk');
    if (!st) return [`${R.name} has no Beanstalk station`];
    const p = R.curve.getPointAt(st.u), cover = groundAt(p.x, p.z) - p.y;
    return p.y <= HALL.y + .5 && cover >= 8 ? [] : [`${R.name} stops at ${p.y.toFixed(1)} m under ${cover.toFixed(1)} m of ground`];
  });
  return !bad.length || bad.join('; ');
}));

// No corridor sample lies on an underground loop span, so tunnels trim no building.

await check('hall: tunnels clear nothing', inPage(async () => {
  const { ROUTES, UNDER, corridorNear } = await import(new URL('engine/transport.js', location.href).href);
  const loops = ROUTES.filter(R => R.lap), bad = [];
  if (!loops.every(R => UNDER?.get(R)?.length)) return 'a loop has no underground span';
  for (const R of loops) for (const [a, b] of UNDER.get(R)) for (let s = a + 1; s < (b < a ? b + R.len : b) - 1; s += 3) {
    const p = R.curve.getPointAt((s / R.len) % 1);
    if (corridorNear(p.x, p.z, 1.5).some(q => Math.abs(q.y - p.y) < 1)) bad.push(`${R.name} at (${p.x.toFixed(0)}, ${p.z.toFixed(0)})`);
  }
  return !bad.length || `${bad.length} samples: ${bad.slice(0, 8).join('; ')}`;
}));

// One portal stands at ground level within 100 m of each end of each underground span, on that loop.

await check('hall: portals at the ground', inPage(async () => {
  const { ROUTES, UNDER, PORTALS } = await import(new URL('engine/transport.js', location.href).href);
  const { groundAt } = await import(new URL('engine/relief.js', location.href).href);
  if (!PORTALS) return 'no portals';
  const bad = ROUTES.filter(R => R.lap).flatMap(R => (UNDER.get(R) ?? []).flatMap(span => span.flatMap((s, end) => {
    const e = R.curve.getPointAt(s / R.len);
    const at = PORTALS.filter(p => p.route === R && Math.hypot(p.x - e.x, p.z - e.z) < 100 && Math.abs(p.y - groundAt(p.x, p.z)) < 1);
    return at.length === 1 ? [] : [`${R.name} span ${end ? 'end' : 'start'} at (${e.x.toFixed(0)}, ${e.z.toFixed(0)}) has ${at.length} portals`];
  })));
  return !bad.length || bad.join('; ');
}));

// The hall and its tunnels draw only while the camera is below ground, so the default city view sees neither.

await check('hall: hidden above ground', inPage(async () => {
  const { CENTRE_API } = await import(new URL('engine/api.js', location.href).href);
  const h = CENTRE_API.hall;
  if (!h) return 'no hall';
  await window.__pump(1);
  return !h.group.visible && !h.tunnel.visible || `group ${h.group.visible}, tunnel ${h.tunnel.visible}`;
}));

// Beanpods leave from the hall's loading bays. Each pod is sampled at 60 frames a second for 100 s of hall time,
// longer than one full round of the bays. Every launch starts inside the pod's bay as its door opens. A climbing
// pod moves at most 5 m a frame and leaves only above the oculus. A pod only ever moves on through closed,
// opening, out, climbing and gone. One pod launches at a time, and a bay's light fades without flashing.

const podFrames = async () => {
  const { CENTRE_API } = await import(new URL('engine/api.js', location.href).href);
  const { camera } = await import(new URL('engine/render.js', location.href).href);
  const h = CENTRE_API.hall;
  if (!h?.pods?.length) return null;
  const frames = [];
  for (let i = 0; i <= 6000; i++) { h.update(i / 60, camera); frames.push(h.pods.map(p => ({ ...p }))); }
  await window.__pump(1);
  return { frames, oculus: h.oculus, bays: h.bays.map(b => [b.x, b.z]), cavity: h.cavity };
};
await live.page.evaluate(`window.__podFrames = ${podFrames}`);
await check('pods: start inside a bay', inPage(async () => {
  const got = await window.__podFrames();
  if (!got) return 'no pods';
  const NEXT = { closed: 'opening', opening: 'out', out: 'climbing', climbing: 'gone', gone: 'closed' }, bad = [], launches = new Set();
  got.frames.forEach((f, i) => f.forEach((p, k) => {
    const q = got.frames[i - 1]?.[k];
    if (!q || q.state === p.state) return;
    if (NEXT[q.state] !== p.state) bad.push(`pod ${k} went ${q.state} to ${p.state} at frame ${i}`);
    if (p.state !== 'opening') return;
    launches.add(k);
    const d = Math.hypot(p.x - got.bays[k][0], p.z - got.bays[k][1]);
    if (!(d < got.cavity && p.door >= 0 && p.door < .2)) bad.push(`pod ${k} leaves ${d.toFixed(1)} m from its bay's centre with the door ${p.door.toFixed(2)} open`);
  }));
  if (launches.size < got.frames[0].length) bad.push(`${launches.size} of ${got.frames[0].length} pods launched`);
  return !bad.length || bad.slice(0, 6).join('; ');
}));
await check('pods: climb out of sight', inPage(async () => {
  const got = await window.__podFrames();
  if (!got) return 'no pods';
  const bad = [];
  got.frames.forEach((f, i) => f.forEach((p, k) => {
    const q = got.frames[i - 1]?.[k];
    if (!q) return;
    if (q.state === 'climbing' && p.state === 'climbing' && (p.y < q.y || p.y - q.y > 5)) bad.push(`pod ${k} moves ${(p.y - q.y).toFixed(1)} m at frame ${i}`);
    if (q.state === 'climbing' && p.state === 'gone' && q.y <= got.oculus) bad.push(`pod ${k} leaves at ${q.y.toFixed(0)} m, below the oculus at ${got.oculus.toFixed(0)} m`);
    if (p.state === 'gone' && p.scale !== 0) bad.push(`pod ${k} is gone but drawn at scale ${p.scale}`);
  }));
  return !bad.length || bad.slice(0, 6).join('; ');
}));

await check('pods: one launch at a time', inPage(async () => {
  const got = await window.__podFrames();
  if (!got) return 'no pods';
  const bad = [];
  got.frames.forEach((f, i) => {
    const on = f.filter(p => p.state === 'opening' || p.state === 'out').map(p => p.bay);
    if (on.length > 1) bad.push(`pods ${on.join(', ')} launch together at frame ${i}`);
    const lit = f.filter(p => p.light > 0).map(p => p.bay);
    if (lit.length > 1) bad.push(`bays ${lit.join(', ')} light together at frame ${i}`);
    f.forEach((p, k) => { const q = got.frames[i - 1]?.[k]; if (q && Math.abs(p.light - q.light) > .02) bad.push(`bay ${k} light jumps ${(p.light - q.light).toFixed(3)} at frame ${i}`); });
  });
  return !bad.length || bad.slice(0, 6).join('; ');
}));

// The Root's climbers keep their timing. Their heights at three fixed times match the formula of the merge base.

await check('pods: outside climbers unchanged', inPage(async () => {
  const { CENTRE_API } = await import(new URL('engine/api.js', location.href).href);
  const ims = CENTRE_API.hall.group.parent.children.filter(o => o.isInstancedMesh && o.count === 15);
  if (ims.length !== 2) return `${ims.length} climber meshes`;
  const CROWN = 154 * 2.25, BASE = CROWN - 40, TOP = 9600, TRIP = Math.cbrt(6 * (TOP - BASE) / 20), bad = [];
  for (const t of [0, 5.3, 11.7]) {
    CENTRE_API.update(t);
    for (let k = 0; k < 14; k++) {
      const up = k % 2 === 0, u = ((t / TRIP + (k >> 1) / 7 + (k % 2) * .037) % 1 + 1) % 1, y = BASE + (TOP - BASE) * (up ? u : 1 - u) ** 3;
      for (const m of ims) { const got = m.instanceMatrix.array[16 * k + 13]; if (Math.abs(got - y) > 1e-3) bad.push(`climber ${k} at t ${t} is at ${got.toFixed(2)}, not ${y.toFixed(2)}`); }
    }
  }
  await window.__pump(1);
  return !bad.length || bad.slice(0, 4).join('; ');
}));

try {
  await live.page.evaluate(async () => {
    const { ROUTES } = await import(new URL('engine/transport.js', location.href).href);
    const { startRide, rideInfo } = await import(new URL('engine/ride.js', location.href).href);
    // The page clock only moves when the harness moves it, so each pumped frame also moves it ms, 17 by default.
    // A frame of FAST ms is the longest step the map takes, so waits and flights cost the fewest frames.

    const FAST = 100, $ = id => document.getElementById(id);
    const pump = async (n, ms = 17) => { for (let i = 0; i < n; i++) { window.__t += ms; await window.__pump(1); } };
    const ride = name => { startRide(ROUTES.find(R => R.name === name).stops[0]); return pump(34, FAST); };
    const moved = async (n, ms) => { const a = rideInfo(); await pump(n, ms); const b = rideInfo(); return { dir: b.dir, ds: b.s - a.s }; };
    const speed = async mul => { for (let n = 0; n < 3 && $('rSpeed').textContent !== `${mul}×`; n++) $('rSpeed').click(); };

    // jump sets route R's clock so its train 0 runs lead timetable seconds short of its dwell at st.

    const jump = (R, st, lead) => {
      let t = 0;
      for (const g of R.segs) { if (g.D == null && g.st === st) break; t += g.T; }
      R.t = t - lead;
    };

    // toStop boards a loop train at the stop before the named one and jumps it to 3 s short of that stop. The
    // clock holds for the 2.4 s boarding flight. It returns the station once the train has stood there for .5 s.

    const toStop = async (route, name, lead = 3) => {
      const R = ROUTES.find(R => R.name === route), i = R.stops.findIndex(st => st.name === name), st = R.stops[i];
      startRide(R.stops[(i - 1 + R.stops.length) % R.stops.length]);
      await speed(1);
      jump(R, st, lead);
      await pump(25 + lead * 10 + 5, FAST);
      return Math.abs(rideInfo().s - st.s) < .5 ? st : null;
    };
    window.__ride = { FAST, $, pump, ride, moved, speed, jump, toStop, rideInfo, ROUTES };
  });
  await check('reverse shows on a loop', inPage(async () => { const { ride, $ } = window.__ride; await ride('Centre Loop'); return !$('rFlip').hidden; }));
  await check('reverse turns a loop train', inPage(async () => {
    const { ride, moved, pump, FAST, $ } = window.__ride;
    await ride('Centre Loop');
    await pump(51, FAST);
    const a = await moved(7, FAST);
    $('rFlip').click();
    const b = await moved(7, FAST);
    return a.dir === -b.dir && Math.abs(a.ds) > 1 && Math.abs(b.ds) > 1 && Math.sign(a.ds) === -Math.sign(b.ds) || JSON.stringify({ a, b });
  }));
  await check('pause holds the train, half speed moves it half as far', inPage(async () => {
    const { ride, moved, pump, speed, FAST, $ } = window.__ride;
    await ride('Centre Loop');
    await pump(51, FAST);
    const full = await moved(7, FAST);
    await speed(0.5);
    const half = await moved(7, FAST);
    $('rPause').click();
    const held = await moved(7, FAST);
    $('rPause').click();
    await speed(1);
    const r = Math.abs(half.ds / full.ds);
    return held.ds === 0 && r > .4 && r < .6 || JSON.stringify({ full, half, held });
  }));
  await check('reverse at a dwell keeps position', inPage(async () => {
    const { toStop, rideInfo, pump, ROUTES, $ } = window.__ride;
    if (!await toStop('Grand Loop', ROUTES.find(R => R.name === 'Grand Loop').stops[1].name)) return 'the train never reached a dwell';
    const s0 = rideInfo().s;
    $('rFlip').click();
    await pump(1);
    return Math.abs(rideInfo().s - s0) < 1 || `${s0} -> ${rideInfo().s}`;
  }));
  await check('reverse names the station ahead', inPage(async () => {
    const { ride, moved, pump, rideInfo, FAST, $ } = window.__ride;
    await ride('Centre Loop');
    await moved(7, FAST);
    $('rFlip').click();
    await pump(10, FAST);
    const R = (await import(new URL('engine/transport.js', location.href).href)).ROUTES.find(R => R.name === 'Centre Loop');
    const s = rideInfo().s, behind = [...R.stops].reverse().find(st => st.s <= s) ?? R.stops.at(-1);
    const got = $('rNext').textContent;
    return got === `Next: ${behind.name}` || got === `${behind.name} station` || `${got} vs Next: ${behind.name}`;
  }));

  // The eye stays inside the lead car's box, at seat height, at 1x and at 8x. The car centre is 2.4 m above the track.

  await check('cab: eye inside the lead car', inPage(async () => {
    const { ride, pump, rideInfo, $ } = window.__ride;
    await ride('Grand Loop');
    const out = [];

    // Each sample comes 170 ms after the last, in two frames, as ten frames of 17 ms did.

    for (const mul of [1, 8]) {
      for (let n = 0; n < 3 && $('rSpeed').textContent !== `${mul}×`; n++) $('rSpeed').click();
      if ($('rSpeed').textContent !== `${mul}×`) return `no ${mul}× speed`;
      for (let i = 0; i < 300; i += 10) {
        await pump(2, 85);
        const { eye, car } = rideInfo(), dx = eye.x - car.x, dz = eye.z - car.z, dy = eye.y - car.y;
        const along = dx * Math.sin(car.yaw) + dz * Math.cos(car.yaw), across = dx * Math.cos(car.yaw) - dz * Math.sin(car.yaw);
        if (!(Math.abs(along) < 5.6 && Math.abs(across) < 1.4 && dy >= -.4 && dy <= .5)) out.push(`${mul}x frame ${i}: along ${along.toFixed(2)} across ${across.toFixed(2)} dy ${dy.toFixed(2)}`);
      }
    }
    for (let n = 0; n < 3 && $('rSpeed').textContent !== '1×'; n++) $('rSpeed').click();
    return !out.length || `${out.length} frames\n    ${out.slice(0, 8).join('\n    ')}`;
  }));
  await check('cab: ridden car is see-through', inPage(async () => {
    const { ride, pump } = window.__ride;
    const { cab } = await import(new URL('engine/transport.js', location.href).href);
    const { stopRide } = await import(new URL('engine/ride.js', location.href).href);
    await ride('Grand Loop');
    const on = cab.visible, opacity = cab.getObjectByName('hull').material.opacity;
    stopRide();
    await pump(1);
    return on && opacity >= .2 && opacity <= .4 && !cab.visible || JSON.stringify({ on, opacity, after: cab.visible });
  }));

  // Line changes. board waits through a change until the rider sits in the new train.

  await live.page.evaluate(async () => {
    const { changesAt } = await import(new URL('engine/ride.js', location.href).href);
    const { pump, rideInfo, FAST } = window.__ride;
    const board = async () => { for (let n = 0; n < 300 && rideInfo().waiting; n++) await pump(1, FAST); await pump(13, FAST); return !rideInfo().waiting; };
    const to = (st, name) => changesAt(st).find(c => c.R.name === name);
    Object.assign(window.__ride, { board, to });
  });
  const dot = (a, b) => Math.cos(a - b);
  await check('change: buttons at an interchange', inPage(async () => {
    const { toStop, $ } = window.__ride;
    if (!await toStop('Grand Loop', 'Base de Cayambe')) return 'never reached Base de Cayambe';
    const got = [...document.querySelectorAll('#rChange button')].map(b => b.textContent);
    return !$('rChange').hidden && got.includes('Change to Centre Loop') || `buttons: ${JSON.stringify(got)}`;
  }));
  await check('change: keeps the direction', async () => {
    const r = await live.page.evaluate(async () => {
      const { toStop, board, to, moved, rideInfo, FAST } = window.__ride;
      const { changeLine } = await import(new URL('engine/ride.js', location.href).href);
      const st = await toStop('Grand Loop', 'Base de Cayambe'), yaw0 = rideInfo().car.yaw;
      changeLine(to(st, 'Centre Loop').st);
      if (!await board()) return { err: 'never boarded' };
      const yaw1 = rideInfo().car.yaw, route = rideInfo().route, m = await moved(40, FAST);
      return { yaw0, yaw1, route, ds: m.ds };
    });
    if (r.err) return r.err;
    return dot(r.yaw0, r.yaw1) > 0 && r.route === 'Centre Loop' && Math.abs(r.ds) > 1 || JSON.stringify(r);
  });
  await check('change: reverse while waiting', async () => {
    const r = await live.page.evaluate(async () => {
      const { toStop, board, to, moved, pump, rideInfo, FAST, $ } = window.__ride;
      const { changeLine } = await import(new URL('engine/ride.js', location.href).href);
      const st = await toStop('Grand Loop', 'Base de Cayambe'), yaw0 = rideInfo().car.yaw;
      changeLine(to(st, 'Centre Loop').st);
      await pump(10);
      if (!rideInfo().waiting) return { err: 'not waiting after the change' };
      $('rFlip').click();
      if (!await board()) return { err: 'never boarded' };
      const yaw = rideInfo().car.yaw, m = await moved(40, FAST);
      return { yaw0, yaw, ds: m.ds };
    });
    if (r.err) return r.err;
    return dot(r.yaw0, r.yaw) < 0 && Math.abs(r.ds) > 1 || JSON.stringify(r);
  });

  // A train passes when its centre car crosses the platform's centre, from more than 2 m before it to more than 2 m past.

  await check('change: no train runs through the wait', inPage(async () => {
    const { toStop, to, pump, rideInfo, FAST } = window.__ride;
    const { changeLine } = await import(new URL('engine/ride.js', location.href).href);
    const st = await toStop('Grand Loop', 'Base de Cayambe'), c = to(st, 'Centre Loop'), R = c.R;
    const p = R.curve.getPointAt(c.st.u), t = R.curve.getTangentAt(c.st.u);
    changeLine(c.st);
    const last = R.trains.map(() => 0), passed = [];
    for (let n = 0; n < 300 && rideInfo().waiting; n++) {
      await pump(1, FAST);
      R.trains.forEach((cars, k) => {
        const q = cars[2].position, dx = q.x - p.x, dz = q.z - p.z, along = dx * t.x + dz * t.z, across = Math.abs(dx * t.z - dz * t.x);
        const side = across > 10 || Math.abs(along) > 100 ? 0 : along > 2 ? 1 : along < -2 ? -1 : last[k];
        if (last[k] && side && side !== last[k]) passed.push(`train ${k} at frame ${n}`);
        last[k] = side;
      });
    }
    if (rideInfo().waiting) return 'never boarded';
    return !passed.length || passed.join(', ');
  }));
  await check('beanstalk dwells longer', inPage(() => {
    const R = window.__ride.ROUTES.find(R => R.name === 'Grand Loop'), g = R.segs.find(g => g.D == null && g.st?.name === 'The Beanstalk');
    return g?.T >= 20 || `dwell ${g?.T}`;
  }));

  // At 8x ride speed and traffic speed 2 a train covers about 38 m a frame. The camera stays at the cab seat,
  // half a car in from the train's end and 2.7 m up, every frame, so a fast frame starts no ease and no lift.

  await check('camera: fast frames keep the seat', inPage(async () => {
    const { ride, pump, rideInfo, $ } = window.__ride;
    const T = await import(new URL('engine/transport.js', location.href).href), { camera } = await import(new URL('engine/render.js', location.href).href);
    const R = T.ROUTES.find(R => R.name === 'Centre Loop'), speed = T.TRAFFIC.speed, bad = [];
    await ride(R.name);
    while ($('rSpeed').textContent !== '8×') $('rSpeed').click();
    T.TRAFFIC.speed = 2;
    try {
      for (let k = 0; k < 100; k++) {
        await pump(1);
        const { s, dir } = rideInfo(), p = R.curve.getPointAt(T.routeU(R, (s + dir * (5 * 11.8 / 2 - 11.8 / 2)) / R.len));
        const d = Math.hypot(camera.position.x - p.x, camera.position.z - p.z), dy = camera.position.y - p.y - 2.7;
        if (d > 3 || Math.abs(dy) > 1) bad.push(`frame ${k}: ${d.toFixed(1)} m off, ${dy.toFixed(1)} m up`);
      }
    } finally { T.TRAFFIC.speed = speed; while ($('rSpeed').textContent !== '1×') $('rSpeed').click(); }
    return !bad.length || `${bad.length} frames, ${bad.slice(0, 4).join('; ')}`;
  }));

  // Through the lollipop's reverse at the root the rider keeps the same car and rides on backwards. Each frame
  // the camera moves less than 1 m, keeps its height within 0.1 m and keeps its view within 1°. After the turn
  // it sits at the train's rear end and faces back along the track.

  await check('camera: the root turn keeps the view', inPage(async () => {
    const { ride, pump, rideInfo } = window.__ride;
    const T = await import(new URL('engine/transport.js', location.href).href), { camera, controls } = await import(new URL('engine/render.js', location.href).href);
    const R = T.ROUTES.find(R => R.balloon);
    if (!R) return 'the line has no balloon';
    await ride(R.name);
    R.t = R.P - 2.5;
    await pump(60);
    if (R.t > R.P) return `the train turned before the test, t ${R.t.toFixed(1)}`;
    const look = () => camera.getWorldDirection(new (camera.position.constructor)()), bad = [];
    let p = camera.position.clone(), v = look();
    for (let k = 0; k < 100; k++) {
      await pump(1);
      const q = camera.position, w = look();
      if (q.distanceTo(p) > 1 || Math.abs(q.y - p.y) > .1 || v.dot(w) < Math.cos(Math.PI / 180)) bad.push(`frame ${k}: moved ${q.distanceTo(p).toFixed(2)} m, view ${(Math.acos(Math.min(1, v.dot(w))) * 180 / Math.PI).toFixed(1)}°`);
      p = q.clone(); v = w;
    }
    const { s, dir } = rideInfo(), rear = R.curve.getPointAt(T.routeU(R, (s - dir * (5 * 11.8 / 2 - 11.8 / 2)) / R.len));
    const back = Math.hypot(camera.position.x - rear.x, camera.position.z - rear.z) < 3 && R.t > R.P;
    return !bad.length && back || `${bad.slice(0, 4).join('; ') || 'no jump'}${back ? '' : `, not at the rear (t ${R.t.toFixed(1)} of ${R.P.toFixed(1)})`}`;
  }));

  // The lollipop rides step their train's timetable clock by 0.5 s and read the train, so a whole trip runs in one
  // frame. A trip keeps moving one way and moves more than 1 m in every 5 s outside the root dwell. Each trip runs
  // out the stem, round the balloon, back down the stem and turns only at the root platform, so consecutive trips
  // run the balloon the same way. A flip mid-balloon runs the balloon back the other way and down the stem to the
  // root platform.

  const trip = async (flip) => {
    const { ride, rideInfo, $ } = window.__ride;
    const R = (await import(new URL('engine/transport.js', location.href).href)).ROUTES.find(R => R.balloon);
    if (!R) return 'the line has no balloon';
    await ride(R.name);
    const B = R.balloon, root = R.stops[0], turn = root.s + B.ring, mid = (B.loopFrom + B.loopTo) / 2, log = [rideInfo()];
    const step = () => { R.t += .5 * (R.sign ?? 1); log.push(rideInfo()); return log.at(-1); };
    const atRoot = s => Math.abs(s - root.s) < 1 || Math.abs(s - turn) < 1;
    if (log[0].s > B.loopFrom || root.name !== 'The Beanstalk') return `boards at ${root.name}, ${log[0].s.toFixed(0)} m`;
    if (flip) {
      while (step().s < mid) if (log.length > 4000) return 'the train never reached the balloon';
      $('rFlip').click();
      log.length = 0; log.push(rideInfo());
      while (Math.abs(log.at(-1).s - root.s) > 1 || log.at(-1).s !== log.at(-2)?.s) {
        const o = step();
        if (o.s > log.at(-2).s) return `heading flips at ${o.s.toFixed(0)} m`;
        if (log.length > 10 && Math.abs(o.s - log.at(-11).s) <= 1 && !atRoot(o.s)) return `stands at ${o.s.toFixed(0)} m`;
        if (log.length > 8000) return `never reached ${root.name}`;
      }
      return Math.min(...log.map(o => o.s)) < B.loopFrom || 'the train never came down the stem';
    }
    let turns = 0, passes = [];
    while (turns < 2 || log.at(-1).s < mid) {
      const o = step(), p = log.at(-2), ds = o.s - p.s;
      if (ds < -1000) {
        if (!(Math.abs(p.s - turn) < 1 && Math.abs(o.s - root.s) < 1)) return `jumps from ${p.s.toFixed(0)} to ${o.s.toFixed(0)} m`;
        turns++;
      } else if (ds < 0) return `heading flips at ${o.s.toFixed(0)} m`;
      if (p.s < mid && o.s >= mid) passes.push(ds > 0);
      if (log.length > 10 && Math.abs(o.s - log.at(-11).s) <= 1 && !atRoot(o.s)) return `stands at ${o.s.toFixed(0)} m`;
      if (log.length > 20000) return `${turns} turns only`;
    }
    const hi = Math.max(...log.map(o => o.s));
    return passes.length >= 3 && passes.every(Boolean) && hi > R.len || `balloon passes ${JSON.stringify(passes)}, ran to ${hi.toFixed(0)} of ${R.len.toFixed(0)} m`;
  };
  // The cab follows car 0 through the root turn. Before the turn the eye sits in the cab at the front, and after
  // it the eye sits in the cab at the rear, so car 0 keeps its glass end on the rider's side.

  await check('lollipop: the cab holds the eye across the root turn', inPage(async () => {
    const { ride, pump, rideInfo, FAST } = window.__ride;
    const T = await import(new URL('engine/transport.js', location.href).href);
    const R = T.ROUTES.find(R => R.balloon);
    if (!R) return 'the line has no balloon';
    await ride(R.name);
    const out = [], ends = new Set();
    let last = null;
    R.t = R.P - 6;
    for (let k = 0; k < 400; k++) {
      await pump(1, FAST);
      const { eye, car } = rideInfo(), dx = eye.x - car.x, dz = eye.z - car.z, dy = eye.y - car.y;
      const along = dx * Math.sin(car.yaw) + dz * Math.cos(car.yaw), across = dx * Math.cos(car.yaw) - dz * Math.sin(car.yaw);
      if (!(Math.abs(along) < 5.6 && Math.abs(across) < 1.4 && dy >= -.4 && dy <= .5)) out.push(`frame ${k}: along ${along.toFixed(2)} across ${across.toFixed(2)} dy ${dy.toFixed(2)}`);
      if (last) {
        const vx = car.x - last.x, vz = car.z - last.z, v = Math.hypot(vx, vz);
        if (v > .05) ends.add((vx * Math.sin(car.yaw) + vz * Math.cos(car.yaw)) / v > 0 ? 'front' : 'rear');
      }
      last = car;
    }
    return !out.length && ends.size === 2 || `${out.slice(0, 4).join('; ') || 'eye in cab'}, cab faced ${[...ends].join(' and ') || 'nowhere'}`;
  }));
  await check('lollipop: a ride goes out and back', inPage(`(${trip})(false)`));
  await check('lollipop: reverse on the balloon', inPage(`(${trip})(true)`));

  await check('picker lists loops first', inPage(() => {
    const got = [...document.querySelectorAll('#ridePick summary span')].slice(0, 2).map(e => e.textContent).join();
    return got === 'Grand Loop,Centre Loop' || got;
  }));

  // Sound. Each check reads SOUND, the gains ridesound.js aims for and its last announcement.

  await live.page.evaluate(async () => {
    const { SOUND } = await import(new URL('engine/ridesound.js', location.href).href);
    const { cab } = await import(new URL('engine/transport.js', location.href).href);
    window.__ride.SOUND = SOUND;
    window.__ride.cab = cab;
  });

  // At 1x the train out of the stop before the Grand Loop's longest gap is still below full speed after 5 s.
  // The hum at 2 s and at 5 s each match .02 + .16 · v / 41.6 within 10%, with v the centre's speed that frame.

  await check('sound: hum follows speed', inPage(async () => {
    const { ROUTES, SOUND, FAST, speed, pump, rideInfo } = window.__ride;
    const { startRide } = await import(new URL('engine/ride.js', location.href).href);
    const R = ROUTES.find(R => R.name === 'Grand Loop'), g = R.segs.filter(g => g.D != null).sort((a, b) => b.D - a.D)[0];
    startRide(g.fromSt);
    await speed(1);
    await pump(25, FAST);
    const s0 = rideInfo().s;
    for (let n = 0; n < 80 && rideInfo().s === s0; n++) await pump(1);
    if (rideInfo().s === s0) return 'the train never left';
    const first = SOUND.hum, at = [];
    for (const n of [20, 30]) {
      await pump(n - 1, FAST);
      const a = rideInfo().s;
      await pump(1, FAST);
      const v = Math.abs(rideInfo().s - a) / (FAST / 1000);
      at.push({ v, hum: SOUND.hum, want: .02 + .16 * v / 41.6 });
    }
    const fit = at.every(o => o.v < 41 && Math.abs(o.hum - o.want) < .1 * o.want);
    return fit && at[1].hum > 3 * first && at[1].hum > at[0].hum || JSON.stringify({ first, at });
  }));

  // The Grand Loop train and Centre Loop train 0 meet 2 s after the clocks are set. The meeting point is where the
  // Grand Loop runs at full speed within 8 m of the Centre Loop's track and at its height, so on the trunk.

  await check('sound: whoosh on a pass', inPage(async () => {
    const { ROUTES, SOUND, FAST, cab, pump } = window.__ride;
    const { startRide, state } = await import(new URL('engine/ride.js', location.href).href);
    const { routeU } = await import(new URL('engine/transport.js', location.href).href);
    const G = ROUTES.find(R => R.name === 'Grand Loop'), C = ROUTES.find(R => R.name === 'Centre Loop');
    const where = (R, tau) => { const { c, g } = state(R, tau); return { g, p: R.curve.getPointAt(routeU(R, ((c % R.len) + R.len) % R.len / R.len)) }; };
    const track = C.curve.getSpacedPoints(Math.ceil(C.len / 4));
    let tG = null;
    for (let t = 0; t < G.P && tG == null; t++) {
      const a = where(G, t), b = where(G, t + 1);
      if (a.g.D != null && a.p.distanceTo(b.p) > 38 && track.some(q => Math.hypot(q.x - a.p.x, q.z - a.p.z) < 8 && Math.abs(q.y - a.p.y) < 2)) tG = t;
    }
    if (tG == null) return 'the Grand Loop never runs fast beside the Centre Loop';
    const meet = where(G, tG).p;
    let tC = 0, best = Infinity;
    for (let t = 0; t < C.P; t += .25) {
      const { g, p } = where(C, t), d = p.distanceTo(meet);
      if (g.D != null && d < best) { best = d; tC = t; }
    }
    startRide(G.stops[0]);
    await pump(30, FAST);
    G.t = tG - 2; C.t = tC - 2; C.sign = 1;
    const gap = () => Math.min(...C.trains[0].map(m => m.position.distanceTo(cab.position)));
    let peak = 0, close = 0, nearest = Infinity;
    for (let n = 0; n < 80; n++) {
      await pump(1, 50);
      const d = gap();
      nearest = Math.min(nearest, d);
      if (d < 30) { close++; peak = Math.max(peak, SOUND.whoosh); }
    }
    if (!close) return `no Centre Loop train within 30 m, nearest ${nearest.toFixed(0)} m`;
    return peak > .2 || `whoosh peaked at ${peak.toFixed(3)}`;
  }));

  // The ride starts two stops short of the Beanstalk and jumps past each run. Plays counts every start of a
  // one-shot buffer source. Two flips at the platform run the train back out and in again, and add no play.

  await check('sound: one announcement', inPage(async () => {
    const { ROUTES, SOUND, FAST, pump, jump, toStop, $ } = window.__ride;
    const R = ROUTES.find(R => R.name === 'Grand Loop'), i = R.stops.findIndex(st => st.name === 'The Beanstalk');
    let plays = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) { if (!this.loop) plays++; return start.apply(this, a); };
    try {
      SOUND.announced = null;
      const before = R.stops[(i - 1 + R.stops.length) % R.stops.length];
      if (!await toStop('Grand Loop', before.name)) return `never reached ${before.name}`;
      if (SOUND.announced !== null || plays) return `announced ${SOUND.announced} at ${before.name}`;
      jump(R, R.stops[i], 3);
      await pump(40, FAST);
      for (let n = 0; n < 2; n++) { $('rFlip').click(); await pump(30, FAST); }
      return SOUND.announced === 'The Beanstalk' && plays === 1 || `announced ${SOUND.announced}, ${plays} plays`;
    } finally {
      AudioBufferSourceNode.prototype.start = start;
    }
  }));
  // SOUND.speaking is true while the announcement plays. Muting stops it, and so does leaving the train.
  // The Centre Loop announces too.

  await check('sound: mute silences all', inPage(async () => {
    const { ROUTES, SOUND, pump, toStop, $ } = window.__ride;
    const { startRide, stopRide } = await import(new URL('engine/ride.js', location.href).href);
    startRide(ROUTES.find(R => R.name === 'Grand Loop').stops[0]);
    await pump(2);
    const on = SOUND.hum;
    $('rMusic').click();
    await pump(2);
    const r = { on, hum: SOUND.hum, whoosh: SOUND.whoosh };
    $('rMusic').click();
    if (!(r.on > 0 && r.hum === 0 && r.whoosh === 0)) return JSON.stringify(r);
    const speak = async route => {
      if (!await toStop(route, 'The Beanstalk')) return false;
      for (let n = 0; n < 20 && !SOUND.speaking; n++) await pump(1);
      return SOUND.speaking;
    };
    if (!await speak('Grand Loop')) return 'no announcement on the Grand Loop';
    $('rMusic').click();
    await pump(1);
    const muted = SOUND.speaking;
    $('rMusic').click();
    if (muted) return 'the announcement plays on after mute';
    if (!await speak('Centre Loop')) return 'no announcement on the Centre Loop';
    stopRide();
    await pump(1);
    return !SOUND.speaking || 'the announcement plays on after the ride ends';
  }));

  // A rider at the hall platform sees the hall and tunnels. The change buttons offer the other loop only. The hall
  // and tunnels add at most 40 draw calls in a frame. Leaving the ride there flies the camera back above ground,
  // the hall hides again, and the city and the Root's climbers draw again.

  const hallAt = async () => {
    const { toStop, pump } = window.__ride;
    const { CENTRE_API } = await import(new URL('engine/api.js', location.href).href);
    const st = await toStop('Grand Loop', 'The Beanstalk');
    await pump(1);
    return st && CENTRE_API.hall;
  };
  await live.page.evaluate(`window.__ride.hallAt = ${hallAt}`);
  await check('hall: shown below ground', inPage(async () => {
    const h = await window.__ride.hallAt();
    return h ? h.group.visible && h.tunnel.visible || `group ${h.group.visible}, tunnel ${h.tunnel.visible}` : 'never reached the hall';
  }));
  await check('hall: change offers the other loop', inPage(async () => {
    if (!await window.__ride.hallAt()) return 'never reached the hall';
    const got = [...document.querySelectorAll('#rChange button')].map(b => b.textContent);
    return got.length === 1 && got[0] === 'Change to Centre Loop' || `buttons: ${JSON.stringify(got)}`;
  }));
  await check('hall: draw budget', inPage(async () => {
    const h = await window.__ride.hallAt();
    if (!h) return 'never reached the hall';
    const { renderer } = window.spike, draw = renderer.renderBufferDirect, mine = new Set();
    for (const g of [h.group, h.tunnel]) g.traverse(o => mine.add(o));
    let n = 0;
    renderer.renderBufferDirect = function (...a) { if (mine.has(a[4])) n++; return draw.apply(this, a); };
    try { await window.__ride.pump(1); } finally { renderer.renderBufferDirect = draw; }
    return n > 0 && n <= 40 || `${n} draw calls`;
  }));
  await check('hall: exit returns to the city', inPage(async () => {
    const { pump, FAST } = window.__ride;
    const { stopRide } = await import(new URL('engine/ride.js', location.href).href);
    const { camera } = await import(new URL('engine/render.js', location.href).href);
    const { groundAt } = await import(new URL('engine/relief.js', location.href).href);
    const h = await window.__ride.hallAt();
    if (!h) return 'never reached the hall';
    const under = camera.position.y < groundAt(camera.position.x, camera.position.z);

    // hidden lists the top-level scene objects that are off while the main camera renders one frame. With keep it
    // lists only those that are back on after the frame, so the ones the hall's hook hid.

    const { scene } = window.spike, climbers = () => h.group.parent.children.filter(o => o.isInstancedMesh && o.count === 15).map(m => m.visible);
    const hidden = async keep => {
      const after = scene.onAfterRender;
      let off = [];
      scene.onAfterRender = function (...a) { if (a[2] === camera) off = scene.children.filter(o => !o.visible); after.apply(this, a); };
      try { await pump(1); } finally { scene.onAfterRender = after; }
      return keep ? off.filter(o => o.visible) : off;
    };
    const city = await hidden(true), down = climbers();
    stopRide();
    await pump(20, FAST);
    const off = await hidden(), back = city.filter(o => !off.includes(o)).length, up = climbers(), p = camera.position;
    const ok = under && p.y > groundAt(p.x, p.z) && !h.group.visible && !h.tunnel.visible && city.length > 0 && back === city.length
      && down.length === 2 && down.every(v => !v) && up.every(v => v);
    return ok || JSON.stringify({ under, y: p.y, group: h.group.visible, tunnel: h.tunnel.visible, hid: city.length, back, down, up });
  }));
} finally {
  if (live.errors.length) console.log(`page errors (rides):\n  ${live.errors.join('\n  ')}`);
  await live.browser.close();
  live.server.close();
}

if (ONLY && !ran.size) { console.log(`FAIL --only=${ONLY.join(',')} matches no check`); failed++; }
process.exitCode = failed ? 1 : 0;
