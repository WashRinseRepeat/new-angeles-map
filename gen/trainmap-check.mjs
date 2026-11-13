// Train map check. It loads the map on the frozen clock and runs named checks on the train map and the ride start.
// Each check prints PASS <name> or FAIL <name>: <detail>. The run exits with 1 on any failure.
//
//   node spikes/map/gen/trainmap-check.mjs
//   node spikes/map/gen/trainmap-check.mjs --only=ride   runs only checks whose name holds one of these words

import { openMap } from './harness.mjs';

const { page, browser, server, errors } = await openMap('');
const BASE_T = 111.30558546417453;
let failed = 0;
const ONLY = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');
async function check(name, fn) {
  if (ONLY && !ONLY.some(w => name.includes(w))) return;
  let r;
  try { r = await fn(); } catch (e) { r = e.message; }
  if (r === true) return console.log(`PASS ${name}`);
  failed++;
  console.log(`FAIL ${name}: ${r === false ? 'false' : r}`);
}

// Starts the Grand Loop ride at Rutherford with dir (or none), ticks 1 s and reports the ride state. It stops the ride after.

const ride = (dir, ticks = 2) => page.evaluate(async ([dir, ticks]) => {
  const { ROUTES } = await import(new URL('engine/transport.js', location.href).href);
  const { startRide, stopRide, rideTick, state } = await import(new URL('engine/ride.js', location.href).href);
  const R = ROUTES.find(R => R.name === 'Grand Loop'), st = R.stops.find(s => s.name === 'Rutherford');
  dir === undefined ? startRide(st) : startRide(st, dir);
  const t0 = R.t;
  for (let i = 0; i < ticks; i++) rideTick(0.5);
  const out = { sign: R.sign, t0, stop: state(R, R.t).g.st?.name ?? null };
  stopRide();
  return out;
}, [dir, ticks]);

await check('ride-reverse', async () => {
  const r = await ride(-1);
  return r.sign === -1 && r.stop === 'Rutherford' || JSON.stringify(r);
});
await check('ride-forward', async () => {
  const r = await ride(1);
  return r.sign === 1 || JSON.stringify(r);
});
await check('ride-default', async () => {
  const r = await ride();
  return Math.abs(r.t0 - BASE_T) < 1e-6 || `t0 ${r.t0}, want ${BASE_T}`;
});

// Runs fn(env) in the page. env holds the schematic, RIDES built as in nav.js, and the schematic helpers.

const inPage = fn => page.evaluate(async src => {
  const at = f => import(new URL(f, location.href).href);
  const [{ SETTING }, { ROUTES }, { TOURS }, S] = await Promise.all(['engine/setting.js', 'engine/transport.js', 'engine/ride.js', 'engine/schematic.js'].map(at));
  const RIDES = [...ROUTES.filter(R => R.stops?.length && !TOURS.some(T => T.name === R.name)), ...TOURS]
    .map(R => ({ name: R.name, tour: TOURS.includes(R), stops: R.stops.map(s => ({ name: s.name })) }));
  const sc = SETTING.transport.maglev.schematic;
  if (!sc) return 'no schematic';
  const nodes = { ...sc.stations, ...sc.bends };
  return new Function('env', `return (${src})(env)`)({ sc, RIDES, nodes, ...S });
}, fn.toString());

await check('schematic-placed', () => inPage(({ sc, RIDES, missingStops }) => {
  const m = missingStops(sc, RIDES);
  return !m.length || m.join(', ');
}));
await check('schematic-order', () => inPage(({ sc, RIDES, stationOrder }) => {
  const bad = RIDES.flatMap(R => {
    const want = R.stops.map(s => s.name), line = sc.lines[R.name];
    if (R.tour && want.length > 1 && want[0] === want.at(-1)) want.pop();
    const got = line ? stationOrder(line, sc.stations) : [];
    return got.join('|') === want.join('|') ? [] : [`${R.name}: got ${got.join(', ')}; want ${want.join(', ')}`];
  });
  return !bad.length || bad.join('; ');
}));
await check('schematic-octilinear', () => inPage(({ sc, nodes, linePoints, isOctilinear }) => {
  const bad = Object.entries(sc.lines).filter(([, l]) => !isOctilinear(linePoints(l, nodes).pts)).map(([n]) => n);
  return !bad.length || bad.join(', ');
}));

// No unknown node, no zero-length leg and no U-turn (a turn of more than 135°) anywhere on a line.

await check('schematic-kinks', () => inPage(({ sc, nodes, linePoints }) => {
  const bad = [];
  for (const [n, l] of Object.entries(sc.lines)) {
    const keys = l.path.map(e => e.replace('|', ''));
    const unknown = keys.filter(k => !Object.hasOwn(nodes, k));
    if (unknown.length) { bad.push(`${n}: unknown ${unknown.join(', ')}`); continue; }
    keys.slice(1).forEach((k, i) => { if (nodes[k].join() === nodes[keys[i]].join()) bad.push(`${n}: zero leg ${keys[i]} to ${k}`); });
    const pts = linePoints(l, nodes).pts, closed = keys[0] === keys.at(-1);
    const dirs = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]).filter(([x, y]) => x || y);
    const turns = closed ? dirs.map((d, i) => [dirs.at(i - 1), d]) : dirs.slice(1).map((d, i) => [dirs[i], d]);
    for (const [a, b] of turns) {
      const cos = (a[0] * b[0] + a[1] * b[1]) / Math.hypot(...a) / Math.hypot(...b);
      if (cos < Math.cos(135.5 * Math.PI / 180)) bad.push(`${n}: U-turn ${a} then ${b}`);
    }
  }
  return !bad.length || bad.join('; ');
}));

// A leg runs between two split points and has at most one bend. Stations are split points. A junction where a line
// meets its own track again is a split point too. The closing repeat of a closed loop is not a junction.

await check('schematic-bends', () => inPage(({ sc, nodes, linePoints }) => {
  const bad = [];
  for (const [n, l] of Object.entries(sc.lines)) {
    const { pts, at } = linePoints(l, nodes), keys = l.path.map(e => e.replace('|', ''));
    const own = l.path.length > 1 && keys[0] === keys.at(-1) ? keys.slice(0, -1) : keys;
    const joins = new Set(own.filter((k, i) => own.indexOf(k) !== i));
    const stops = keys.map((k, i) => k in sc.stations || joins.has(k) ? i : -1).filter(i => i >= 0);
    stops.slice(1).forEach((b, j) => {
      const seg = pts.slice(at[stops[j]], at[b] + 1).filter((p, i, a) => !i || p.join() !== a[i - 1].join());
      const dirs = seg.slice(1).map((p, i) => [Math.sign(p[0] - seg[i][0]), Math.sign(p[1] - seg[i][1])].join());
      const bends = dirs.filter((d, i) => i && d !== dirs[i - 1]).length;
      if (bends > 1) bad.push(`${n}: ${keys[stops[j]]} to ${keys[b]} has ${bends} bends`);
    });
  }
  return !bad.length || bad.join('; ');
}));

// Each landmark stands within 2 grid units of its anchor station. Haas stands south-west of Haas Central. Weyland
// stands inside the Grand Loop, north-west of Nuevo Guayaquil.

await check('schematic-landmarks', () => inPage(({ sc }) => {
  const s = sc.stations, near = (p, a) => Math.hypot(p[0] - a[0], p[1] - a[1]) <= 2;
  const want = {
    beanstalk: p => near(p, s['The Beanstalk']),
    nbn: p => near(p, s['Rutherford']),
    jinteki: p => near(p, s['Nihongai']),
    haas: p => near(p, s['Haas Central']) && p[0] <= s['Haas Central'][0] && p[1] >= s['Haas Central'][1],
    weyland: p => near(p, s['Nuevo Guayaquil']) && p[0] < s['Nuevo Guayaquil'][0] && p[1] < s['Nuevo Guayaquil'][1],
  };
  const bad = Object.keys(want).filter(k => !want[k](sc.landmarks.find(l => l.shape === k)?.at ?? [NaN, NaN]));
  return !bad.length || bad.join(', ');
}));

// A copy without Quinde names it as missing, and the lines that skip Quinde still draw.

await check('schematic-missing', () => inPage(({ sc, RIDES, missingStops, linePoints }) => {
  const cut = structuredClone(sc);
  delete cut.stations['Quinde'];
  const m = missingStops(cut, RIDES), nodes = { ...cut.stations, ...cut.bends };
  const rest = Object.values(cut.lines).filter(l => !l.path.some(e => e.replace('|', '') === 'Quinde'));
  rest.forEach(l => linePoints(l, nodes));
  let thrown = '';
  try { linePoints(cut.lines['Grand Loop'], nodes); } catch (e) { thrown = e.message; }
  return m.includes('Grand Loop: Quinde') && rest.length >= 3 && thrown === 'unknown node Quinde' || `${m} / ${rest.length} / ${thrown}`;
}));

// Train map. The checks drive real clicks. A click that finds nothing fails after 3 s. On a small screen show()
// opens the folded list before it picks a line.

const click = (sel, o) => page.click(sel, { timeout: 3000, ...o });
const show = async line => {
  if (await page.isHidden('#trainmap')) await click('[data-tab=ride]');
  if (line && await page.isHidden(`#trainmap .row[data-line="${line}"]`)) await click('#trainmap .row.lit');
  if (!line) return;
  const again = (await lit()).includes(line);
  await click(`#trainmap .row[data-line="${line}"]`);

  // A click on the already-lit row opens the list on a phone, so show() folds it again. A pick of another line must
  // fold the list by itself, and show() throws if it stays open.

  if (again && await page.$('#trainmap .side.open')) await click('#trainmap .row.lit');
  else if (await page.$('#trainmap .side.open')) throw new Error(`list stayed open after picking ${line}`);
};
const lit = () => page.$$eval('#trainmap path.line.lit', e => e.map(x => x.dataset.line));
const rides = () => page.$$eval('#trainmap .ride', e => e.map(x => x.getAttribute('aria-label')));
const stn = n => click(`#trainmap [data-st="${n}"]`);

const marked = () => page.$$eval('#trainmap .stn.mark text', e => e.map(x => x.textContent));

// The map opens with the Grand Loop lit and The Beanstalk marked, so its ride buttons show at once.

await check('map-open', async () => {
  await show();
  const l = await lit(), m = await marked(), a = await rides();
  return l.join() === 'Grand Loop' && !(await page.isHidden('#trainmap')) && m.join() === 'The Beanstalk' && a.length === 2 || `lit ${l}, marked ${m}, ${a}`;
});
await check('map-pick', async () => {
  await show('City Loop');
  const l = await lit();
  return l.join() === 'City Loop' || `lit ${l}`;
});
await check('map-buttons', async () => {
  await show('Grand Loop');
  await stn('Rutherford');
  const a = await rides();
  return a.join() === 'Ride south to Laguna Velasco,Ride north to Base de Cayambe' || a.join();
});
await check('map-tour-buttons', async () => {
  await show('Beanstalk Southwest Line');
  const out = [];
  for (const n of ['Haas Central', 'The Beanstalk']) { await stn(n); out.push((await rides()).length); }
  return out.join() === '1,1' || out.join();
});
await check('map-ride', async () => {
  await show('Grand Loop');
  await stn('Rutherford');
  await click('#trainmap .ride[aria-label="Ride north to Base de Cayambe"] rect');
  const r = await page.evaluate(async () => {
    const { rideInfo } = await import(new URL('engine/ride.js', location.href).href);
    const { ROUTES } = await import(new URL('engine/transport.js', location.href).href);
    return { route: rideInfo()?.route, sign: ROUTES.find(R => R.name === 'Grand Loop').sign };
  });
  return await page.isHidden('#trainmap') && r.route === 'Grand Loop' && r.sign === -1 || JSON.stringify(r);
});
await check('map-reopen', async () => {
  await page.evaluate(async () => (await import(new URL('engine/ride.js', location.href).href)).stopRide());
  await show();
  const l = await lit(), m = await marked(), a = await rides();
  return l.join() === 'Grand Loop' && m.join() === 'The Beanstalk' && a.length === 2 || `lit ${l}, marked ${m}, ${a}`;
});

// On a desktop and on a phone the open map marks The Beanstalk and shows its ride buttons. The hint sits in the top
// quarter of the screen. The title block meets no close button, line list, track, label, ride pill or cable, and the
// folded line list meets no track or label. Three more window sizes test the map's fit round both.

await check('map-open-preselect', async () => {
  const bad = [];
  try {
    for (const [width, height] of [[1440, 900], [375, 812], [1024, 768], [1280, 800], [768, 1024]]) {
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width, height });
      await show();
      const m = await marked(), a = await rides();
      const h = await page.evaluate(async () => {
        await document.fonts.ready;
        await window.__pump(2);
        const el = document.getElementById('trainmap'), e = el.querySelector('.hint'), r = e?.getBoundingClientRect();
        if (!e) return null;
        const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom, hits = [];
        const test = (who, t, sels, paths) => {
          for (const [name, sel] of sels)
            for (const o of el.querySelectorAll(sel)) if (meets(t, o.getBoundingClientRect())) hits.push(`${who} x ${name} ${o.textContent.trim().slice(0, 20)}`);
          for (const p of el.querySelectorAll(paths)) {
            const M = p.getScreenCTM(), n = p.getTotalLength(), w = parseFloat(getComputedStyle(p).strokeWidth) / 2 * M.a;
            for (let s = 0; s <= n; s += Math.max(.5, n / 4000)) {
              const q = p.getPointAtLength(s).matrixTransform(M);
              if (q.x > t.left - w && q.x < t.right + w && q.y > t.top - w && q.y < t.bottom + w) { hits.push(`${who} x ${p.dataset.line ?? 'cable'}`); break; }
            }
          }
        };
        test('title', el.querySelector('.title').getBoundingClientRect(), [['close', '.x'], ['list', '.side'], ['label', '.base text'], ['pill', '.ride .pill']], 'svg .ln path.line, svg .cable');
        test('list', el.querySelector('.side').getBoundingClientRect(), [['label', '.base text']], 'svg .ln path.line');
        return { text: e.textContent, w: r.width, h: r.height, top: r.bottom <= innerHeight / 4, in: r.left >= 0 && r.top >= 0 && r.right <= innerWidth,
          shown: getComputedStyle(e).visibility === 'visible' && +getComputedStyle(e).opacity > .5, hits };
      });
      if (m.join() !== 'The Beanstalk' || a.length !== 2) bad.push(`${width}: marked ${m}, ${a.length} buttons`);
      if (!h || h.text !== 'Pick a line, then a station, then a direction' || h.w < 1 || h.h < 1 || !h.in || !h.top || !h.shown || h.hits.length) bad.push(`${width}: hint ${JSON.stringify(h)}`);
    }
  } finally {
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 640, height: 400 });
  }
  return !bad.length || bad.join('; ');
});

// A fresh map has The Beanstalk's buttons. A click on Rutherford moves them there, a second click keeps them, and a
// click on empty map clears them.

await check('map-clicks', async () => {
  await page.keyboard.press('Escape');
  await show();
  const a0 = (await rides()).length;
  await stn('Rutherford');
  await stn('Rutherford');
  const a = (await rides()).length, m = await marked();
  await click('#trainmap svg', { position: { x: 630, y: 390 } });
  const b = (await rides()).length, l = await lit();
  return a0 === 2 && a === 2 && m.join() === 'Rutherford' && b === 0 && l.join() === 'Grand Loop' || `${a0} ${a} ${m} ${b} ${l}`;
});
await check('map-offline-station', async () => {
  await show('City Loop');
  await stn('Rutherford');
  await click('#trainmap .stn:not(.on) text', { force: true });
  const a = await rides();
  return a.join() === 'Ride west to Nihongai,Ride north to Chakana' || a.join();
});

// Enter on a focused ride button starts the ride like a click.

await check('map-button-key', async () => {
  await show('Grand Loop');
  await stn('Rutherford');
  await page.focus('#trainmap .ride[aria-label="Ride south to Laguna Velasco"]');
  await page.keyboard.press('Enter');
  const r = await page.evaluate(async () => {
    const { rideInfo, stopRide } = await import(new URL('engine/ride.js', location.href).href);
    const { ROUTES } = await import(new URL('engine/transport.js', location.href).href);
    const out = { route: rideInfo()?.route, sign: ROUTES.find(R => R.name === 'Grand Loop').sign };
    stopRide();
    return out;
  });
  return await page.isHidden('#trainmap') && r.route === 'Grand Loop' && r.sign === 1 || JSON.stringify(r);
});

// Tab order reaches the station hit targets, and Enter marks a station like a click.

await check('map-keyboard', async () => {
  await page.keyboard.press('Escape');
  await show('Grand Loop');
  const f0 = await page.evaluate(() => document.activeElement.className);
  await page.focus('#trainmap .hit[data-st="Rutherford"]');
  await page.keyboard.press('Enter');
  const a = (await rides()).length;
  await page.focus('#trainmap .ride[aria-label="Ride south to Laguna Velasco"]');
  await page.keyboard.press('Enter');
  const r = await page.evaluate(async () => (await import(new URL('engine/ride.js', location.href).href)).rideInfo()?.route);
  await page.evaluate(async () => (await import(new URL('engine/ride.js', location.href).href)).stopRide());
  return a === 2 && r === 'Grand Loop' && await page.isHidden('#trainmap') || `${f0} ${a} ${r}`;
});

// A reverse start on the Grand Loop followed by a change to another line leaves the Grand Loop running forward.

await check('ride-change-sign', async () => {
  const r = await page.evaluate(async () => {
    const { ROUTES } = await import(new URL('engine/transport.js', location.href).href);
    const { startRide, stopRide, changesAt, changeLine } = await import(new URL('engine/ride.js', location.href).href);
    const R = ROUTES.find(R => R.name === 'Grand Loop'), st = R.stops.find(s => s.name === 'Rutherford');
    startRide(st, -1);
    const c = changesAt(st).find(c => c.R.name === 'City Loop');
    if (!c) { stopRide(); return 'no City Loop change'; }
    changeLine(c.st);
    const out = R.sign;
    stopRide();
    return out;
  });
  return r === 1 || `sign ${r}`;
});

// The lit line stacks a blurred glow, a coloured stroke and a white core, in that order. The other lines draw at
// about 60% and have neither glow nor core.

await check('style-glow', async () => {
  await show('Grand Loop');
  return page.evaluate(() => {
    const q = s => [...document.querySelectorAll(`#trainmap svg ${s}`)], cs = e => getComputedStyle(e);
    const [glow, lit, core] = ['path.glow', 'path.line.lit', 'path.core'].map(q);
    if (glow.length !== 1 || lit.length !== 1 || core.length !== 1) return `glow ${glow.length}, lit ${lit.length}, core ${core.length}`;
    const [g, l, c] = [glow[0], lit[0], core[0]], after = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const r = {
      order: after(g, l) && after(l, c),
      same: g.dataset.line === l.dataset.line && c.dataset.line === l.dataset.line,
      white: cs(c).stroke === 'rgb(255, 255, 255)' && cs(l).stroke !== cs(c).stroke,
      glow: cs(g).stroke === cs(l).stroke && cs(g).filter !== 'none' && parseFloat(cs(g).strokeWidth) > parseFloat(cs(l).strokeWidth),
      thin: parseFloat(cs(c).strokeWidth) < parseFloat(cs(l).strokeWidth),
      dim: q('path.line:not(.lit)').every(p => +cs(p).opacity * +cs(p.parentNode).opacity >= .5 && +cs(p).opacity * +cs(p.parentNode).opacity <= .7 && cs(p).filter === 'none'),
    };
    return Object.values(r).every(Boolean) || JSON.stringify(r);
  });
});

// Each station tick leaves its track at 90°. style-tick-join tests how it joins its line. Each interchange capsule sits
// at 0°, 45°, 90° or 135°. It lights each line in turn.

await check('style-ticks', async () => {
  await show('Grand Loop');
  return page.evaluate(() => {
    const el = document.getElementById('trainmap'), bad = new Set(), ends = p => p.getAttribute('d').match(/-?[\d.]+/g).map(Number);
    let ticks = 0, caps = 0;
    for (const name of [...el.querySelectorAll('.row')].map(r => r.dataset.line)) {
      el.querySelector(`.row[data-line="${name}"]`).click();
      for (const t of el.querySelectorAll('path.tick')) {
        ticks++;
        const [x0, y0, x1, y1] = ends(t), line = el.querySelector(`path.line[data-line="${t.dataset.line}"]`), n = line.getTotalLength();
        let best = 0, dist = Infinity;
        for (let d = 0; d <= n; d += .25) { const q = line.getPointAtLength(d), h = Math.hypot(q.x - x0, q.y - y0); if (h < dist) [best, dist] = [d, h]; }
        const a = line.getPointAtLength(Math.max(0, best - 2)), b = line.getPointAtLength(Math.min(n, best + 2));
        const cos = ((x1 - x0) * (b.x - a.x) + (y1 - y0) * (b.y - a.y)) / Math.hypot(x1 - x0, y1 - y0) / Math.hypot(b.x - a.x, b.y - a.y);
        if (dist > 1 || Math.abs(cos) > .01) bad.add(`${t.dataset.line} tick ${t.dataset.name}: off ${dist.toFixed(1)}, cos ${cos.toFixed(3)}`);
      }
      for (const c of el.querySelectorAll('path.cap-o')) {
        caps++;
        const [x0, y0, x1, y1] = ends(c);
        if (Math.hypot(x1 - x0, y1 - y0) < .01) continue;
        const ang = ((Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI) % 180 + 180) % 180;
        if ([0, 45, 90, 135, 180].every(k => Math.abs(ang - k) > .5)) bad.add(`capsule at ${ang.toFixed(1)}°`);
      }
    }
    el.querySelector('.row[data-line="Grand Loop"]').click();
    return ticks > 20 && caps > 20 && !bad.size || [...bad].join('; ') || `${ticks} ticks, ${caps} capsules`;
  });
});

// Each tick is drawn as part of its line. It has the line's stroke colour and width, and a dim line's opacity sits on
// a group that holds both, so the overlap never brightens. On the lit line the glow and the white core run on into the
// tick. It lights each line in turn.

await check('style-tick-join', async () => {
  await show('Grand Loop');
  return page.evaluate(() => {
    const el = document.getElementById('trainmap'), bad = new Set(), cs = e => getComputedStyle(e);
    const fade = (e, top) => { let o = 1; for (; e && e !== top; e = e.parentNode) o *= +cs(e).opacity; return o; };
    let ticks = 0;
    for (const name of [...el.querySelectorAll('.row')].map(r => r.dataset.line)) {
      el.querySelector(`.row[data-line="${name}"]`).click();
      for (const t of el.querySelectorAll('path.tick')) {
        ticks++;
        const line = el.querySelector(`path.line[data-line="${t.dataset.line}"]`), at = `${name} / ${t.dataset.line} / ${t.dataset.name}`;
        let top = t.parentNode;
        while (!top.contains(line)) top = top.parentNode;
        if (cs(t).stroke !== cs(line).stroke || cs(t).strokeWidth !== cs(line).strokeWidth) bad.add(`${at}: stroke ${cs(t).stroke} ${cs(t).strokeWidth}, line ${cs(line).stroke} ${cs(line).strokeWidth}`);
        if (fade(t, top) !== 1 || fade(line, top) !== 1) bad.add(`${at}: opacity ${fade(t, top)} on the tick, ${fade(line, top)} on the line`);
        if (t.dataset.line !== name) continue;
        const [x0, y0, x1, y1] = t.getAttribute('d').match(/-?[\d.]+/g).map(Number), p = new DOMPoint(x0 + (x1 - x0) * .8, y0 + (y1 - y0) * .8);
        for (const k of ['glow', 'core']) if (!el.querySelector(`path.${k}[data-line="${name}"]`)?.isPointInStroke(p)) bad.add(`${at}: no ${k} on the tick`);
      }
    }
    el.querySelector('.row[data-line="Grand Loop"]').click();
    return ticks > 20 && !bad.size || [...bad].slice(0, 20).join('; ') || `${ticks} ticks`;
  });
});

// Each interchange capsule covers every line that stops at its station. Every point of each such line within 6 units
// of the station's grid point, with half the line's width, lies inside the capsule's white outline. It lights each
// line in turn, since the lit line is wider.

await check('style-capsule-cover', async () => {
  await show('Grand Loop');
  return page.evaluate(async () => {
    const { SETTING } = await import(new URL('engine/setting.js', location.href).href);
    const sc = SETTING.transport.maglev.schematic, el = document.getElementById('trainmap'), bad = new Set();
    const seg = (p, a, b) => {
      const v = [b[0] - a[0], b[1] - a[1]], l2 = v[0] ** 2 + v[1] ** 2, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / l2)) : 0;
      return Math.hypot(p[0] - a[0] - v[0] * t, p[1] - a[1] - v[1] * t);
    };
    let caps = 0;
    for (const name of [...el.querySelectorAll('.row')].map(r => r.dataset.line)) {
      el.querySelector(`.row[data-line="${name}"]`).click();
      for (const c of el.querySelectorAll('path.cap-o')) {
        caps++;
        const st = c.closest('.stn').querySelector('text').textContent, [x0, y0, x1, y1] = c.getAttribute('d').match(/-?[\d.]+/g).map(Number);
        const a = [x0, y0], b = [x1, y1], o = sc.stations[st].slice(0, 2).map(v => v * 40), R = parseFloat(getComputedStyle(c).strokeWidth) / 2;
        for (const [ln, l] of Object.entries(sc.lines)) {
          if (!l.path.some(e => e.replace('|', '') === st)) continue;
          const p = el.querySelector(`path.line[data-line="${ln}"]`), n = p.getTotalLength(), w = parseFloat(getComputedStyle(p).strokeWidth) / 2;
          let worst = 0;
          for (let s = 0; s <= n; s += .25) {
            const q = p.getPointAtLength(s);
            if (Math.hypot(q.x - o[0], q.y - o[1]) <= 6) worst = Math.max(worst, seg([q.x, q.y], a, b) + w);
          }
          if (worst > R + .01) bad.add(`${name} lit: ${st} / ${ln} reaches ${worst.toFixed(2)}, capsule ${R.toFixed(2)}`);
        }
      }
    }
    el.querySelector('.row[data-line="Grand Loop"]').click();
    return caps > 20 && !bad.size || [...bad].join('; ') || `${caps} capsules`;
  });
});

// Each label of a lit-line station sits in a soft oval that breathes at rest, and dim-line labels have none. Hover
// brightens the oval and shows a pointer. A tap on a label marks its station, and each label's tap target is at least
// 44 px tall. No oval meets a ride pill or another label. A keyboard-focused marked station shows a focus ring unlike
// its mark ring. With reduced motion the ovals stand still. It runs on a desktop and on a phone.

await check('style-station-cue', async () => {
  const bad = [];
  try {
    for (const [width, height] of [[1440, 900], [375, 812]]) {
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width, height });
      await show();
      const state = () => page.evaluate(async () => {
        await document.fonts.ready;
        await window.__pump(2);
        const el = document.getElementById('trainmap'), cs = e => getComputedStyle(e), bad = [];
        const meets = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > .5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > .5;
        const pills = [...el.querySelectorAll('.ride .pill')].map(p => p.getBoundingClientRect()), texts = [...el.querySelectorAll('.base text')];
        let on = 0;
        for (const g of el.querySelectorAll('.stn')) {
          const t = g.querySelector('text'), o = g.querySelector('.oval'), tap = g.querySelector('.ltap'), name = t.textContent;
          const shown = cs(t).visibility !== 'hidden', drawn = o && cs(o).display !== 'none' && cs(o).stroke !== 'none' && +cs(o).strokeOpacity > 0;
          if (!g.classList.contains('on')) { if (drawn || tap) bad.push(`${name}: dim station has an oval or tap target`); continue; }
          if (!shown) { if (drawn) bad.push(`${name}: hidden label keeps its oval`); continue; }
          on++;
          if (!drawn) { bad.push(`${name}: no oval`); continue; }
          const r = o.getBoundingClientRect(), b = t.getBoundingClientRect();
          if (r.left > b.left || r.right < b.right || r.top > b.top || r.bottom < b.bottom) bad.push(`${name}: oval does not hold its label`);
          if (pills.some(p => meets(r, p))) bad.push(`${name}: oval meets a ride pill`);
          for (const x of texts) if (x !== t && cs(x).visibility !== 'hidden' && meets(r, x.getBoundingClientRect())) bad.push(`${name}: oval meets ${x.textContent}`);
          if (!tap || tap.dataset.st !== name || tap.getBoundingClientRect().height < 44) bad.push(`${name}: tap target ${tap?.getBoundingClientRect().height.toFixed(1)} px`);
        }
        const o = el.querySelector('.stn.on .oval');
        return { bad, on, anim: o && cs(o).animationName, op: o && +cs(o).strokeOpacity };
      });
      const rest = await state();
      bad.push(...rest.bad.map(b => `${width} open: ${b}`));
      if (rest.on < 10 || rest.anim === 'none') bad.push(`${width}: ${rest.on} ovals, animation ${rest.anim}`);

      // A tap on the middle of a label, away from the ride buttons, marks its station.

      const c = await page.evaluate(() => {
        const r = [...document.querySelectorAll('#trainmap .stn.on text')].find(t => t.textContent === 'Laguna Velasco').getBoundingClientRect();
        return [r.x + r.width / 2, r.y + r.height / 2];
      });
      await page.mouse.click(...c);
      const m = await marked();
      await page.keyboard.press('Escape');
      await show();
      await stn('Rutherford');
      bad.push(...(await state()).bad.map(b => `${width} Rutherford: ${b}`));
      if (m.join() !== 'Laguna Velasco') bad.push(`${width}: label tap marked ${m}`);
    }

    // Hover on a label brightens its oval and shows a pointer.

    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 900 });
    await show();
    const op = () => page.evaluate(() => {
      const g = [...document.querySelectorAll('#trainmap .stn.on')].find(g => g.querySelector('text').textContent === 'Rabotgorod');
      const o = g.querySelector('.oval'), t = g.querySelector('.ltap');
      return { op: o ? +getComputedStyle(o).strokeOpacity : 0, cursor: t ? getComputedStyle(t).cursor : 'none' };
    });
    const before = await op();
    if (await page.$('#trainmap .ltap[data-st="Rabotgorod"]')) await page.hover('#trainmap .ltap[data-st="Rabotgorod"]', { timeout: 3000 });
    const hover = await op();
    await page.mouse.move(0, 0);
    if (!(hover.op > before.op) || hover.op < .9 || hover.cursor !== 'pointer') bad.push(`hover ${JSON.stringify({ before, hover })}`);

    await stn('Rutherford');
    await page.focus('#trainmap .stn.mark .hit');
    await page.keyboard.press('Shift');
    const focus = await page.evaluate(() => {
      const h = document.querySelector('#trainmap .stn.mark .hit'), c = getComputedStyle(h);
      return h.matches(':focus-visible') && c.stroke !== 'none' && +c.strokeOpacity > .9 && c.stroke !== getComputedStyle(document.querySelector('#trainmap .stn.mark .ring')).stroke;
    });
    if (!focus) bad.push('marked station has no focus ring');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const still = await page.evaluate(() => { const o = document.querySelector('#trainmap .stn.on .oval'); return o ? getComputedStyle(o).animationName : 'no oval'; });
    if (still !== 'none') bad.push(`reduced motion animation ${still}`);
  } finally {
    await page.emulateMedia({ reducedMotion: null });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 640, height: 400 });
  }
  return !bad.length || `${bad.length} faults: ${bad.slice(0, 25).join('; ')}`;
});

// No map label crosses a drawn line or another label, in screen space. It lights each line in turn. The ride buttons
// sit on the track, so style-ride-buttons tests them instead.

await check('style-labels', async () => {
  await show('Grand Loop');
  return page.evaluate(() => {
    const el = document.getElementById('trainmap'), svg = el.querySelector('svg'), bad = new Set();
    const box = t => {
      const b = t.getBBox(), m = t.getScreenCTM(), pt = (x, y) => new DOMPoint(x, y).matrixTransform(m);
      const a = pt(b.x, b.y), c = pt(b.x + b.width, b.y + b.height);
      return { x0: Math.min(a.x, c.x), y0: Math.min(a.y, c.y), x1: Math.max(a.x, c.x), y1: Math.max(a.y, c.y), name: t.textContent };
    };
    const test = state => {
      const M = svg.getScreenCTM(), labels = [...svg.querySelectorAll('.base text')].map(box);
      for (const p of svg.querySelectorAll('path.line')) {
        const len = p.getTotalLength(), r = parseFloat(getComputedStyle(p).strokeWidth) / 2 * M.a;
        for (let s = 0; s <= len; s += 1) {
          const q = p.getPointAtLength(s).matrixTransform(M);
          for (const b of labels) if (q.x > b.x0 - r && q.x < b.x1 + r && q.y > b.y0 - r && q.y < b.y1 + r) bad.add(`${state}: ${b.name} x ${p.dataset.line}`);
        }
      }
      labels.forEach((a, i) => labels.slice(i + 1).forEach(b => {
        if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) bad.add(`${state}: ${a.name} x ${b.name}`);
      }));
      return labels.length;
    };
    const n = test('none');
    for (const row of [...el.querySelectorAll('.row')].map(r => r.dataset.line)) {
      el.querySelector(`.row[data-line="${row}"]`).click();
      test(row);
    }
    el.querySelector('.row[data-line="Grand Loop"]').click();
    return n > 20 && !bad.size || [...bad].join(', ') || `${n} labels`;
  });
});

// Each ride button sits on its own leg rideGap px from the marked station, its centre within 3 px of the drawn track.
// rideGap is 128 px at the desktop map scale, scales down with the map and stops at a floor. On a leg shorter than
// the gap the button is capped. It sits on the next station, its centre within 3 px of the track and either within
// 6 px of that station's centre or at the leg's end, and the check lists it by name. Two uncapped buttons sit within 1 px of the same
// distance.
//
// Each tap target is at least 44 px tall and each text at least 13 px, on a desktop and on a phone. The text is
// "Ride north", "south", "east" or "west" by the way the leg leaves the station, where a diagonal reads as its north or
// south part. Two buttons of one station never read the same, and each leg carries chevrons. No button covers the
// marked station's tick, ring, capsule or label, and no two buttons overlap. Only a capped button may break those two
// rules, since it has no other spot, and the check lists those cases by name.

await check('style-ride-buttons', async () => {
  const bad = [], listed = [], held = [];
  let n = 0;
  try {
    for (const [width, height] of [[1440, 900], [375, 812]]) {
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width, height });
      await show();
      const r = await page.evaluate(async () => {
        const { SETTING } = await import(new URL('engine/setting.js', location.href).href);
        const { stationOrder } = await import(new URL('engine/schematic.js', location.href).href);
        const { rideGap } = await import(new URL('engine/trainmap.js', location.href).href);
        if (!rideGap) return { bad: ['no rideGap'], listed: [], held: [], n: 0 };
        const sc = SETTING.transport.maglev.schematic, el = document.getElementById('trainmap'), svg = el.querySelector('svg');
        const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const gap = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

        // Fonts set the pill widths, and a resize redraws a frame later, so each measure waits for both. The harness
        // queues animation frames on its frozen clock, and __pump(2) runs two of them.

        const settle = async () => {
          await document.fonts.ready;
          await window.__pump(2);
        };
        await settle();
        const range = (a, z) => Array.from({ length: Math.abs(z - a) + 1 }, (_, k) => a < z ? a + k : a - k);
        const bad = [], listed = [], held = [];
        let n = 0;
        for (const row of [...el.querySelectorAll('.row')].map(r => r.dataset.line)) {
          el.querySelector(`.row[data-line="${row}"]`).click();
          await settle();
          const order = stationOrder(sc.lines[row], sc.stations);
          for (const st of [...el.querySelectorAll('[data-st]')].map(h => h.dataset.st)) {
            el.querySelector(`[data-st="${st}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await settle();
            const M = svg.getScreenCTM(), s = M.a, gap0 = rideGap(svg), i = order.indexOf(st), next = [order.at(i - 1), order[(i + 1) % order.length]];
            const lit = svg.querySelector('path.line.lit'), track = Array.from({ length: Math.floor(lit.getTotalLength() * 4) + 1 }, (_, i) => lit.getPointAtLength(i / 4).matrixTransform(M));
            const closed = gap(track[0], track.at(-1)) < 8, j = track.reduce((b, q, k) => k < track.length - 80 && gap(q, track.at(-1)) < 3 && (b < 0 || gap(q, track.at(-1)) < gap(track[b], track.at(-1))) ? k : b, -1);
            const parts = [...svg.querySelectorAll(`.stn.mark text, .ln.lit .tick[data-name="${CSS.escape(st)}"], .stn.mark .ring, .stn.mark .cap-o`)].map(e => ({ e, r: e.getBoundingClientRect() }));
            const near = name => {
              const h = el.querySelector(`.hit[data-st="${CSS.escape(name)}"]`).getBoundingClientRect(), c = { x: h.x + h.width / 2, y: h.y + h.height / 2 };
              const d = track.map(q => gap(q, c)), m = Math.min(...d);
              return d.flatMap((v, i) => v <= m + .5 && !(d[i - 1] < v) && !(d[i + 1] < v) ? [i] : []);
            };

            // A leg is the shortest stretch of the lit track from the marked station to the next one, in ride order. On
            // a balloon, a leg that starts past the junction j may run on to the track's end, then back from j.

            const legTo = to => {
              let leg;
              for (const a of near(st)) for (const z of near(to)) {
                const cands = [range(a, z)];
                if (closed) cands.push(a < z ? [...range(a, 0), ...range(track.length - 1, z)] : [...range(a, track.length - 1), ...range(0, z)]);
                if (j >= 0 && z <= j && a > j) cands.push([...range(a, track.length - 1), ...range(j, z)]);
                for (const c of cands) if (!leg || c.length < leg.length) leg = c;
              }
              return leg.map(k => track[k]);
            };
            const taps = [...el.querySelectorAll('.ride')].map(b => ({ b, r: b.querySelector('.tap')?.getBoundingClientRect() }));
            const words = taps.map(({ b }) => b.querySelector('text').textContent);
            if (words.length === 2 && words[0] === words[1]) bad.push(`${row} / ${st}: both buttons read "${words[0]}"`);
            const alongs = [];
            taps.forEach(tap => {
              const { b, r } = tap;
              n++;
              const to = b.dataset.to, at = `${row} / ${st} / ${to}`, t = b.querySelector('text');
              if (!next.includes(to)) return bad.push(`${at}: not a next station`);
              if (!r || r.height < 44) return bad.push(`${at}: tap target ${r?.height.toFixed(1)} px tall`);
              const px = parseFloat(getComputedStyle(t).fontSize) * s;
              if (px < 13) bad.push(`${at}: text ${px.toFixed(1)} px`);
              const leg = legTo(to), q = leg.find((p, n) => n && gap(p, leg[0]) >= 12), dx = q.x - leg[0].x, dy = q.y - leg[0].y;
              const word = Math.abs(dy) > .3 * Math.hypot(dx, dy) ? (dy < 0 ? 'north' : 'south') : dx > 0 ? 'east' : 'west';
              if (t.textContent !== `Ride ${word}` || b.getAttribute('aria-label') !== `Ride ${word} to ${to}`) bad.push(`${at}: reads "${t.textContent}", want "Ride ${word}"`);
              const c = { x: r.x + r.width / 2, y: r.y + r.height / 2 }, walk = a => a.reduce((t, p, n) => n && gap(p, a[n - 1]) < .6 ? t + gap(p, a[n - 1]) : t, 0);
              const ds = leg.map(p => gap(p, c)), m = Math.min(...ds), along = walk(leg.slice(0, ds.indexOf(m) + 1)), full = walk(leg);
              const h = el.querySelector(`.hit[data-st="${CSS.escape(to)}"]`).getBoundingClientRect(), onNext = gap(c, { x: h.x + h.width / 2, y: h.y + h.height / 2 }) <= 6;
              if (full < gap0) {
                tap.capped = true;
                listed.push(`${at} (leg ${full.toFixed(0)} px)`);
                const off = Math.min(...track.map(p => gap(p, c)));
                if (off > 3) bad.push(`${at}: centre ${off.toFixed(1)} px off the track`);
                if (!onNext && full - along > 2) bad.push(`${at}: ${along.toFixed(1)} px along a ${full.toFixed(1)} px leg, want the next station`);
              } else {
                if (m > 3) bad.push(`${at}: centre ${m.toFixed(1)} px off its leg`);
                alongs.push(along);
                if (Math.abs(along - gap0) > 1) bad.push(`${at}: ${along.toFixed(1)} px along its leg, want ${gap0.toFixed(1)}`);
              }
              if (!svg.querySelector(`.chev[data-dir="${b.dataset.dir}"]`)?.children.length) bad.push(`${at}: no chevrons on its leg`);
            });

            // A capped button has no other spot, so its own covers and overlaps are listed instead of failed.

            taps.forEach(({ b, r, capped }, k) => {
              const at = `${row} / ${st} / ${b.dataset.to}`;
              if (!r) return;
              for (const p of parts) if (meets(r, p.r)) (capped ? held : bad).push(`${at} covers the marked station's ${p.e.tagName === 'text' ? 'label' : p.e.getAttribute('class')}`);
              for (const o of taps.slice(k + 1)) if (o.r && meets(r, o.r)) (capped || o.capped ? held : bad).push(`${at} overlaps the button to ${o.b.dataset.to}`);
            });
            if (alongs.length === 2 && Math.abs(alongs[0] - alongs[1]) > 1) bad.push(`${row} / ${st}: buttons sit ${alongs.map(a => a.toFixed(1)).join(' and ')} px out`);
          }
        }
        el.querySelector('.row[data-line="Grand Loop"]').click();
        return { bad, listed, held, n };
      });
      bad.push(...r.bad.map(b => `${width}: ${b}`));
      listed.push(...r.listed.map(b => `${width}: ${b}`));
      held.push(...r.held.map(b => `${width}: ${b}`));
      n += r.n;
    }
  } finally {
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 640, height: 400 });
  }
  console.log(`  note: ${held.length} covers or overlaps by capped buttons${held.length ? `: ${held.join('; ')}` : ''}`);
  console.log(`  note: ${listed.length} buttons sit on the next station because their leg is shorter than the gap${listed.length ? `: ${listed.join('; ')}` : ''}`);
  return n > 80 && !bad.length || `${bad.length} faults in ${n} buttons: ${bad.slice(0, 30).join('; ')}`;
});

// While ride buttons show, no visible station label overlaps a ride pill. A label a pill would cover moves to a free
// side or hides. It marks every station of every line, on a desktop and on a phone.

await check('style-label-not-clipped', async () => {
  const bad = [];
  let n = 0;
  try {
    for (const [width, height] of [[1440, 900], [375, 812]]) {
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width, height });
      await show();
      const r = await page.evaluate(async () => {
        const el = document.getElementById('trainmap'), bad = [];
        const settle = async () => { await document.fonts.ready; await window.__pump(2); };
        const meets = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > .5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > .5;
        const shown = t => { const c = getComputedStyle(t); return c.visibility !== 'hidden' && c.display !== 'none' && +c.opacity > 0; };
        let n = 0;
        await settle();
        for (const row of [...el.querySelectorAll('.row')].map(r => r.dataset.line)) {
          el.querySelector(`.row[data-line="${row}"]`).click();
          await settle();
          for (const st of [...el.querySelectorAll('[data-st]')].map(h => h.dataset.st)) {
            el.querySelector(`[data-st="${st}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await settle();
            const pills = [...el.querySelectorAll('.ride .pill')].map(p => p.getBoundingClientRect());
            for (const t of el.querySelectorAll('.stn text')) {
              n++;
              if (shown(t) && pills.some(p => meets(t.getBoundingClientRect(), p))) bad.push(`${row} / ${st}: pill covers ${t.textContent}`);
            }
          }
        }
        el.querySelector('.row[data-line="Grand Loop"]').click();
        return { bad, n };
      });
      bad.push(...r.bad.map(b => `${width}: ${b}`));
      n += r.n;
    }
  } finally {
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 640, height: 400 });
  }
  return n > 500 && !bad.length || `${bad.length} covered labels in ${n}: ${bad.slice(0, 20).join('; ')}`;
});

// On a phone the list folds to the lit line. A tap opens all five rows, and a pick folds it again. Nothing scrolls sideways.

await check('style-phone', async () => {
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 375, height: 812 });
  try {
    await show();
    const rows = () => page.$$eval('#trainmap .row', e => e.filter(x => x.getBoundingClientRect().height > 0).length);
    const a = await rows();
    await click('#trainmap .row.lit');
    const b = await rows();
    await click('#trainmap .row[data-line="City Loop"]');
    const c = await rows(), l = await lit(), w = await page.evaluate(() => document.documentElement.scrollWidth);
    return a === 1 && b === 5 && c === 1 && l.join() === 'City Loop' && w <= 375 || JSON.stringify({ a, b, c, l, w });
  } finally {
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 640, height: 400 });
  }
});
// On a phone a pick from the open list folds it to the picked line.

await check('map-list-fold', async () => {
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 375, height: 812 });
  try {
    await show();
    await click('#trainmap .row.lit');
    const opened = await page.$$eval('#trainmap .row', e => e.filter(x => x.getBoundingClientRect().height > 0).length);
    await click('#trainmap .row[data-line="City Loop"]');
    const r = await page.evaluate(() => ({
      open: !!document.querySelector('#trainmap .side.open'),
      rows: [...document.querySelectorAll('#trainmap .row')].filter(x => x.getBoundingClientRect().height > 0).map(x => x.dataset.line),
    }));
    return opened === 5 && !r.open && r.rows.join() === 'City Loop' || JSON.stringify({ opened, ...r });
  } finally {
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 640, height: 400 });
  }
});

// Open, a line click and a station click each run within budget at 1440 by 900. The page clock is frozen, so the
// check times the synchronous handlers with Date.now and prints the median of 5 runs.

await check('perf-trainmap', async () => {
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });
  try {
    const runs = await page.evaluate(() => {
      const time = sel => { const t = Date.now(); document.querySelector(sel).dispatchEvent(new MouseEvent('click', { bubbles: true })); return Date.now() - t; };
      return Array.from({ length: 6 }, () => {
        const r = [time('[data-tab=ride]'), time('#trainmap .row:not(.lit)'), time('#trainmap .stn.cue:not(.mark) .hit')];
        document.querySelector('#trainmap .x').click();
        return r;
      }).slice(1);
    });
    const [open, line, station] = [0, 1, 2].map(k => runs.map(r => r[k]).sort((a, b) => a - b)[2]);
    console.log(`  perf-trainmap open ${open} ms, line ${line} ms, station ${station} ms`);
    return open < 250 && line < 120 && station < 120 || `open ${open} ms (< 250), line ${line} ms, station ${station} ms (< 120)`;
  } finally {
    await page.setViewportSize({ width: 640, height: 400 });
  }
});
await check('map-escape', async () => {
  await show();
  await page.keyboard.press('Escape');
  const on = await page.$$eval('#nav [data-tab].on', e => e.length);
  return await page.isHidden('#trainmap') && !on || `on ${on}`;
});
await check('map-cleanup', async () => {
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.spike.select(window.spike.PLACES[0]));
  const open = await page.evaluate(() => getComputedStyle(document.getElementById('card')).display !== 'none');
  await click('[data-tab=ride]');
  const shut = await page.evaluate(() => getComputedStyle(document.getElementById('card')).display === 'none');
  return open && shut || `card open ${open}, hidden ${shut}`;
});
await check('map-fallback', async () => {
  const f = await openMap('', 'emberford.html');
  try {
    const b = await f.page.$('[data-tab=ride]');
    if (b && await b.isVisible()) await b.click({ timeout: 3000 });
    return !(await f.page.$('#trainmap')) || 'trainmap exists';
  } finally { await f.browser.close(); f.server.close(); }
});

if (errors.length) console.log(`page errors:\n  ${errors.join('\n  ')}`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
