// Maglev ride: district stations on the loop and the lines, and a train the camera rides on.

import * as THREE from 'three';
import { S } from './state.js';
import { SETTING } from './setting.js';
import { CITY, hash, rng, sdPoly, smooth } from './core.js';
import { camera, controls, labels, renderer, scene } from './render.js';
import { FOOTPRINTS, HALL, PILLARS, ROUTES, decksNear, onFootprint, STATIONS, STATION_LEN, TRAFFIC, cab, carriage, clearGhosts, ghostCar, routeU, sweep, uploadTrains } from './transport.js';
import { groundAt } from './relief.js';
import { TUNNELS } from './generator.js';
import { GLOWS, beam, glow, glows, prop, puff, put, textSign } from './instances.js';
import { RIDE_AUDIO, rideSound, stopSound } from './ridesound.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const districtAt = (x, z) => CITY.districts.find(d => sdPoly(x, z, d.poly) > 0);
const short = d => d?.name.replace(/\s+District$/i, '');

// The loop route takes the pack's loop name. A line takes the name of the district at its far end, a ring the
// district it circles. A centre spur takes the pack's name for it, in city.json's spur order. A route that
// already has a name keeps it.

const MAGLEV = SETTING.transport.maglev;
const districtOf = R => short(districtAt(R.curve.getPointAt(1).x, R.curve.getPointAt(1).z)) ?? 'Outer';
export const routeName = R => R.name ?? (R.loop ? MAGLEV.loopName : R.root ? MAGLEV.spurNames[ROUTES.indexOf(R) - 1]
  : `${districtOf(R)} ${R.closed ? 'Loop' : 'Line'}`);
for (const R of ROUTES) { R.name = routeName(R); R.stops = STATIONS.filter(st => st.route === R).sort((a, b) => a.s - b.s); }

// A ring that stops at the centre station lists its stops from there.

for (const R of ROUTES) {
  const i = R.closed ? R.stops.findIndex(st => st.name === MAGLEV.centreStation.name) : -1;
  if (i > 0) R.stops.push(...R.stops.splice(0, i));
}

// ---------- stations ----------
// Each station builds in a frame on the track: z runs along the line, x across it, y from the deck top.
// Platforms run from x 3.4 to 9.4 on both sides, 64 m long, with their floor at the train's floor (y 1).

const HALF = STATION_LEN / 2, SIDES = [-1, 1];

// A unit is one build in one frame: a station, a shared double-track kit or an interchange tower. Its band holds
// samples of every route but its own, in its frame, each with the cosine of its heading to the frame's z. A piece
// that reaches within 6 m of such a deck and 5 m above or below it is left out. A long piece along the line splits
// in halves down to 4 m, and a pillar splits in height down to 2 m, and each keeps the parts that clear.
// UNITS keeps each unit's frame and the boxes it laid, frame-local with y from the deck top. A lollipop counts
// as its own track only on the stretch its stations stand on, the stem or the balloon. So a station by the
// switch keeps clear of the other stretch.

export const UNITS = [];
let y0 = 0, gap = 0, unit = null;
const wayOf = (R, s) => s <= R.balloon.loopFrom ? 0 : 1;
function band(own, at) {
  const { tx, tz, c, s } = S.FRAME, out = [];
  for (const R of ROUTES) if (!own.includes(R) || R.balloon) {
    const P = R.path, n = P.length, mine = own.includes(R) ? at.filter(st => st.route === R).map(st => wayOf(R, st.s)) : [];
    for (let i = 0; i < (P.closed ? n : n - 1); i++) {
      const a = P[i], b = P[(i + 1) % n], L = Math.hypot(b.x - a.x, b.z - a.z), k = Math.ceil(L / 2);
      if (Math.hypot(a.x - tx, a.z - tz) > 140) continue;
      if (mine.length && mine.includes(i < R.balloon.m ? 0 : 1)) continue;
      const h = Math.abs(((b.x - a.x) * s + (b.z - a.z) * c) / (L || 1));
      for (let j = 0; j <= k; j++) {
        const X = a.x + (b.x - a.x) * j / k - tx, Z = a.z + (b.z - a.z) * j / k - tz;
        out.push([X * c - Z * s, a.y + (b.y - a.y) * j / k - y0, X * s + Z * c, h]);
      }
    }
  }
  return out;
}
const hits = (B, [x0, x1, b0, b1, z0, z1]) => B.some(([x, y, z]) =>
  Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1)) < 6 && b1 > y - 5 && b0 < y + 5);
function begin(kind, name, own, f, at) {
  S.FRAME = { cx: 0, cz: 0, ...f };
  y0 = f.y0;
  unit = { kind, name, own, f, parts: [], band: band(own, at) };
  UNITS.push(unit);
}
function end() { delete unit.band; unit = null; gap = 0; S.FRAME = null; }
function piece(x, y, z, sx, sy, sz, ry, draw, cut = '') {
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hx = (c * sx + s * sz) / 2, hz = (s * sx + c * sz) / 2;
  const b = [x - hx, x + hx, y - sy / 2, y + sy / 2, z - hz, z + hz];
  if (!hits(unit.band, b)) { unit.parts.push(b); return draw(y, z, sy, sz); }
  if (cut === 'z' && sz > 4 && !ry) for (const d of [-1, 1]) piece(x, y, z + d * sz / 4, sx, sy, sz / 2, 0, draw, cut);
  if (cut === 'y' && sy > 2) for (const d of [-1, 1]) piece(x, y + d * sy / 4, z, sx, sy / 2, sz, ry, draw, cut);
  return -1;
}

// A shared kit builds on the midline of double track. gap moves each piece out by half the track spacing, so a
// side's pieces land on that track's outer platform, and a piece across the middle widens to span both tracks.

const out = x => x + Math.sign(x) * gap;
const wide = (x, sx) => Math.abs(x) < sx / 2 ? [x, sx + 2 * gap] : [out(x), sx];
const A = {
  box: (x, y, z, sx, sy, sz, rgb, ry = 0, rx = 0) => { [x, sx] = wide(x, sx); return piece(x, y, z, sx, sy, sz, ry, (y, z, sy, sz) => prop('box', x, y0 + y, z, sx, sy, sz, rgb, ry, rx), rx ? '' : 'z'); },
  cyl: (x, y, z, d, h, rgb, rx = 0) => { x = out(x); return rx ? piece(x, y, z, d, d, h, 0, (y, z, _, h) => prop('cyl', x, y0 + y, z, d, h, d, rgb, 0, rx), 'z')
    : piece(x, y, z, d, h, d, 0, (y, _, h) => prop('cyl', x, y0 + y, z, d, h, d, rgb, 0, rx), 'y'); },
  cone: (x, y, z, d, h, rgb) => { x = out(x); return piece(x, y, z, d, h, d, 0, () => prop('cone', x, y0 + y, z, d, h, d, rgb)); },
  glw: (x, y, z, sx, sy, sz, rgb, ry = 0) => { [x, sx] = wide(x, sx); return piece(x, y, z, sx, sy, sz, ry, (y, z, sy, sz) => glow(x, y0 + y, z, sx, sy, sz, rgb, ry), 'z'); },
  ball: (x, y, z, d, rgb) => { x = out(x); return piece(x, y, z, d, d, d, 0, () => put(GLOWS.sphere, x, y0 + y, z, d, d, d, 0, 0, rgb)); },
  beam: (a, b, t, rgb, kind) => {
    const [ax, ay, az] = a, [bx, by, bz] = b, p = [out(ax), ay, az], q = [out(bx), by, bz];
    return piece((p[0] + q[0]) / 2, (ay + by) / 2, (az + bz) / 2, Math.abs(q[0] - p[0]) + t, Math.abs(by - ay) + t, Math.abs(bz - az) + t, 0,
      () => beam([p[0], y0 + ay, az], [q[0], y0 + by, bz], t, rgb, kind));
  },
  text: (t, x, y, z, w, rgb, ry) => { x = out(x); return piece(x, y, z, w, w / 4, .1, ry, () => textSign(t, x, y0 + y, z, w, w / 4, ry, rgb)); },
  puff: (x, y, z, r) => { x = out(x); return piece(x, y, z, 2 * r, 2 * r, 2 * r, 0, () => puff(x, y0 + y, z, r, [.16, .16, .17])); },
  blink: (x, y, z, s, rgb) => { x = out(x); return piece(x, y, z, s, s, s, 0, () => S.flicker.push([glows, glow(x, y0 + y, z, s, s, s, rgb), rgb, Math.random() * 10, true])); },
  ring: (x, y, z, s, rx, rgb) => { s += 2 * gap; return piece(x, y, z, s, s, .1, 0, () => put(GLOWS.ring, x, y0 + y, z, s, s, s, 0, rx, rgb)); },
};
const along = (step, fn, from = -HALF + step / 2, to = HALF) => { for (let z = from; z < to; z += step) fn(z); };

// The pack's station kits dress the bare platforms, one kit per district. A district without one takes the
// pack's default kit. The pack's interchange kit draws the tower at a crossing.

const KITS = MAGLEV.stations?.(A, { HALF, LEN: STATION_LEN, SIDES, along }) ?? {};
const kitOf = st => KITS[st.id] ?? KITS[MAGLEV.defaultStation];

// Boards at the back of each platform carry the station name, facing the track below the rider's eye line.

function nameBoards(name, rgb, board, sides) {
  for (const s of sides) for (const z of [-16, 16]) {
    A.box(s * 9.15, 3, z, .15, 1.9, 7.6, board);
    A.text(name.toUpperCase(), s * 9.05, 3, z, 7, rgb, -s * Math.PI / 2);
  }
}

// A station's frame sits on its track: z along the line, x across it, y from the deck top.

const frameOf = st => {
  const R = st.route, p = R.curve.getPointAt(st.u), t = R.curve.getTangentAt(st.u), a = Math.atan2(t.x, t.z);
  return { tx: p.x, tz: p.z, a, c: Math.cos(a), s: Math.sin(a), y0: p.y };
};
const toLocal = (f, x, z) => { const X = x - f.tx, Z = z - f.tz; return [X * f.c - Z * f.s, X * f.s + Z * f.c]; };
const toWorld = (f, x, z) => [f.tx + x * f.c + z * f.s, f.tz - x * f.s + z * f.c];

// A platform side keeps its strip, x 3.4 to 9.4 and 4 m of headroom, clear of every other route's band. It also
// drops where another route runs over or under the strip for 8 m or more within 20° of its heading, from 15 m
// under the deck to 15 m over it. So double track drops its middle platforms on one level or two, and a
// crossing deck 10 m above or below leaves both sides.

const strip = s => [s > 0 ? 3.4 : -9.4, s > 0 ? 9.4 : -3.4, -.6, 4, -HALF, HALF];
const COS20 = Math.cos(Math.PI / 9);
const faces = s => {
  const [x0, x1, , , z0] = strip(s), bins = new Set();
  for (const [x, y, z, h] of unit.band) if (h > COS20 && x > x0 && x < x1 && z > z0 && z < -z0 && Math.abs(y) < 15) bins.add(Math.floor((z - z0) / 4));
  return bins.size >= 2;
};
const toStrip = (st, x, z) => {
  const [lx, lz] = toLocal(st.f, x, z);
  return Math.min(...SIDES.filter((s, k) => st.sides[k]).map(s => {
    const [x0, x1, , , z0, z1] = strip(s);
    return Math.hypot(Math.max(x0 - lx, 0, lx - x1), Math.max(z0 - lz, 0, lz - z1));
  }));
};

// Whether box b, in frame f, meets any piece of unit u. The box turns into u's frame as the box round its corners.

function meets(u, f, [x0, x1, b0, b1, z0, z1]) {
  const P = [[x0, z0], [x0, z1], [x1, z0], [x1, z1]].map(([x, z]) => toLocal(u.f, ...toWorld(f, x, z)));
  const X0 = Math.min(...P.map(p => p[0])), X1 = Math.max(...P.map(p => p[0])), Z0 = Math.min(...P.map(p => p[1])), Z1 = Math.max(...P.map(p => p[1]));
  const dy = f.y0 - u.f.y0;
  return u.parts.some(([a0, a1, c0, c1, e0, e1]) => a0 < X1 && a1 > X0 && e0 < Z1 && e1 > Z0 && c0 < b1 + dy && c1 > b0 + dy);
}

// A crossing pair gets a tower beside both platforms, from the ground to 5 m over the upper deck, clear of every
// route's band and of both stations' pieces. It stands where the walks from it to the two platforms are shortest,
// and a walk runs to each. The unit keeps the tower's box in tower.

function interchange(lo, up, K) {
  begin('interchange', lo.name, [], lo.f, []);
  const all = unit.band, dh = up.f.y0 - lo.f.y0;
  let best = null;
  for (let x = -30; x <= 30; x++) for (let z = -HALF; z <= HALF; z++) {
    const [wx, wz] = toWorld(lo.f, x, z), dl = toStrip(lo, wx, wz), du = toStrip(up, wx, wz);
    const box = [x - 2.5, x + 2.5, -y0, dh + 5, z - 2.5, z + 2.5];
    if (dl < 2.5 || du < 2.5 || hits(all, box) || [lo, up].some(st => meets(st.unit, lo.f, box))) continue;
    const k = dl + du + Math.hypot(x, z) * .01;
    if (!best || k < best.k) best = { k, x, z };
  }
  unit.own = [lo.route, up.route];
  unit.band = band(unit.own, [lo, up]);
  if (best) {
    unit.tower = [best.x - 2.5, best.x + 2.5, -y0, dh + 5, best.z - 2.5, best.z + 2.5];
    const near = (st, y) => {
      const [wx, wz] = toWorld(lo.f, best.x, best.z), [lx, lz] = toLocal(st.f, wx, wz), s = SIDES.find((s, k) => st.sides[k] && Math.sign(lx) === s) ?? SIDES.find((s, k) => st.sides[k]);
      const [x0, x1, , , z0, z1] = strip(s), [px, pz] = toWorld(st.f, Math.min(x1, Math.max(x0, lx)), Math.min(z1, Math.max(z0, lz)));
      return [...toLocal(lo.f, px, pz), y];
    };
    K.build(rng(hash(Math.round(lo.f.tx), 79)), { x: best.x, z: best.z, low: -y0, high: dh, walks: [near(lo, 0), near(up, dh)] });
  }
  end();
}

// A stilt stands from the ground to the platform underside. Where another deck passes under the platform within
// 3.5 m in plan, the stilt ends on that deck's underside (deck - 1.2) and drops above it. A stilt on a landmark
// moves 4 or 8 m along the platform to clear it, else drops. A landmark never gives way to a stilt.
// PLATFORMS lists each platform side that takes stilts, with the landmark that took a stilt from it, if any.

export const PLATFORMS = [];
function stiltAt(x, z) {
  const F = S.FRAME, wx = F.tx + x * F.c + z * F.s, wz = F.tz - x * F.s + z * F.c, g = groundAt(wx, wz), top = y0 - .6;
  const under = decksNear(wx, wz, 3.5).filter(q => q.y - .5 < top && q.y + 3.3 > g), y1 = under.length ? Math.min(...under.map(q => q.y)) - 1.2 : top;
  return { x, z, wx, wz, g, y1, top, ok: y1 - g >= 2, foot: onFootprint(wx, wz) };
}
function stilts(st, side) {
  const x = side * 7, kept = [], row = { station: st.name, route: st.route.name, side, foot: null };
  PLATFORMS.push(row);
  along(16, z => {
    const s = stiltAt(x, z);
    if (!s.ok) return;
    if (!s.foot) return kept.push(s);
    const moved = [4, -4, 8, -8].map(d => z + d).filter(z => Math.abs(z) <= HALF - 2 && !kept.some(k => Math.abs(k.z - z) < 4))
      .map(z => stiltAt(x, z)).find(s => s.ok && !s.foot);
    if (moved) kept.push(moved); else row.foot = FOOTPRINTS.find(f => onFootprint(s.wx, s.wz, [f]))?.name;
  });
  for (const s of kept) {
    prop('cyl', x, (s.g + s.y1) / 2, s.z, 1.4, s.y1 - s.g, 1.4, [.06, .065, .075]);
    PILLARS.push({ kind: 'stilt', x: s.wx, z: s.wz, r: .7, y0: s.g, y1: s.y1, top: s.top, station: st.name, route: st.route.name, side, lz: s.z });
  }
}

// A station in the Beanstalk hall stands deep underground. The hall dresses it, so it takes no kit and no stilts.

const deepAt = f => !!HALL && f.y0 < groundAt(f.tx, f.tz) - 6;
export function buildStations() {
  for (const st of STATIONS) {
    st.f = frameOf(st);
    begin('station', st.name, [st.route], st.f, [st]);
    st.unit = unit;
    st.sides = SIDES.map(s => !hits(unit.band, strip(s)) && !faces(s));
    const K = kitOf(st), sides = SIDES.filter((s, k) => st.sides[k]), deep = deepAt(st.f);
    for (const s of sides) {
      A.box(s * 6.4, .2, 0, 6, 1.6, STATION_LEN, K.deck);
      A.glw(s * 3.5, 1.03, 0, .12, .05, STATION_LEN, K.edge.map(v => v * .45));
      if (!deep) stilts(st, s);
    }
    nameBoards(st.name, K.sign, K.board, sides);
    if (!deep && !st.of && !STATIONS.some(o => o.of === st)) K.build(rng(hash(Math.round(st.f.tx), 77)), st.sides);
    end();
  }

  // Double track takes one kit across both platforms, on the midline between the two tracks.

  for (const tw of STATIONS.filter(o => o.of)) {
    const m = tw.of, [lx, lz] = toLocal(m.f, tw.f.tx, tw.f.tz), [mx, mz] = toWorld(m.f, lx / 2, lz / 2);
    const ts = m.f.c * tw.f.c + m.f.s * tw.f.s > 0 ? tw.sides : [...tw.sides].reverse();
    begin('shared', m.name, [m.route, tw.route], { ...m.f, tx: mx, tz: mz }, [m, tw]);
    gap = Math.abs(lx) / 2;
    if (!deepAt(m.f)) kitOf(m).build(rng(hash(Math.round(m.f.tx), 77)), lx > 0 ? [m.sides[0], ts[1]] : [ts[0], m.sides[1]]);
    end();
  }
  for (const st of STATIONS) if (st.cross && st.f.y0 < st.cross.f.y0 && KITS.interchange) interchange(st, st.cross, KITS.interchange);
}

// ---------- timetable: every maglev train runs one ----------
// A loop carries a train per 800 m. They run one way round, time-shifted copies of one timetable, so they never meet.
// Each line is single track and carries one shuttle that runs end to end and back. A lollipop's shuttle runs out
// the stem, round the balloon the same way every trip, back down the stem and reverses at the root.
// Every train stops at each station with its centre on the platform's centre.

const CAR = 11.8, CARS = 5, TL = CAR * CARS, VMAX = 41.6, ACC = 2.8, DWELL = 3, END_DWELL = 12, SPEEDS = [.5, 1, 3, 8];
const DA = VMAX * VMAX / (2 * ACC), TA = VMAX / ACC;

// A pack stop's dwell, in seconds, replaces DWELL at its stations.

const DWELLS = new Map((MAGLEV.stops ?? []).filter(s => s.dwell).map(s => [s.name, s.dwell]));
const dwellAt = st => DWELLS.get(st?.name) ?? DWELL;
const runTime = D => D < 2 * DA ? 2 * Math.sqrt(D / ACC) : 2 * TA + (D - 2 * DA) / VMAX;
function runDist(D, t) {
  const T = runTime(D), h = Math.min(t, T - t);
  const near = D < 2 * DA || h < TA ? .5 * ACC * h * h : DA + VMAX * (h - TA);
  return t <= T / 2 ? near : D - near;
}

// A timetable is a cycle of dwells and runs. A line's cycle starts on arrival at its first end and is
// symmetric about the middle of that dwell, so time END_DWELL − t finds the same spot facing the other way.
// A lollipop's cycle runs like a loop's. Its last run goes on past the route's end at the switch and back down
// the stem to the root platform, so it runs a ring of length R.balloon.ring.

const cyc = R => R.closed || !!R.balloon;

// A lollipop train keeps its car order through the root reverse, so on odd trips car 0 runs at the rear.

const carEnd = (R, t) => R.balloon && Math.floor(t / R.P) % 2 ? -1 : 1;
function timetable(R) {
  const L = R.len, segs = [];
  if (R.balloon) R.balloon.ring = R.len + R.balloon.land - 2 * R.stops[0].s;
  if (cyc(R)) {
    const ring = R.balloon?.ring ?? L;
    R.stops.forEach((st, i) => {
      const nx = R.stops[(i + 1) % R.stops.length], end = R.balloon && !i;
      segs.push({ T: end ? Math.max(END_DWELL, dwellAt(st)) : dwellAt(st), at: st.s, st, end }, { from: st.s, fromSt: st, D: ((nx.s - st.s) % ring + ring) % ring || ring, dir: 1, to: { st: nx } });
    });
  } else {

    // A station within 120 m of a line's end is its terminus. Otherwise the train turns at the bare end.

    const e0 = 8 + TL / 2, e1 = L - 8 - TL / 2, way = R.stops.filter(st => st.s >= e0 && st.s <= e1).map(st => ({ s: st.s, st }));
    if (!way.length || way[0].s - e0 > 120) way.unshift({ s: e0 });
    if (e1 - way.at(-1).s > 120) way.push({ s: e1 });
    way[0].end = way.at(-1).end = true;
    const path = [...way, ...way.slice(1, -1).reverse()];
    path.forEach((w, i) => {
      const nx = path[(i + 1) % path.length];
      segs.push({ T: w.end ? END_DWELL : dwellAt(w.st), at: w.s, st: w.st, end: w.end }, { from: w.s, D: Math.abs(nx.s - w.s), dir: Math.sign(nx.s - w.s), to: nx });
    });
  }
  for (const g of segs) g.T ??= runTime(g.D);
  segs.forEach((g, i) => { g.dir ??= segs[i + 1].dir; });
  R.segs = segs;
  R.P = segs.reduce((a, g) => a + g.T, 0);
}

// Where a train is at timetable time tau: its centre c, heading dir, and the segment it is in. The checks use it
// to set up a meeting of two trains.

export function state(R, tau) {
  let t = ((tau % R.P) + R.P) % R.P;
  for (const g of R.segs) {
    if (t < g.T) return { c: g.D == null ? g.at : g.from + g.dir * runDist(g.D, t), dir: g.dir, g };
    t -= g.T;
  }
  return { c: R.segs[0].at, dir: R.segs[0].dir, g: R.segs[0] };
}

// Only a route with a station runs a train, because a timetable needs a stop.

const RUNS = ROUTES.filter(R => R.stops.length);
RUNS.forEach((R, i) => {
  timetable(R);
  R.t = i * 37;
  R.trains = Array.from({ length: R.closed ? Math.round(R.len / 800) : 1 }, () => Array.from({ length: CARS }, (_, j) => carriage(!j ? 1 : j === CARS - 1 ? -1 : 0)));
});

const _a = V(0, 0, 0), _b = V(0, 0, 0), _f = V(0, 0, 0), _e = V(0, 0, 0), _T = V(0, 0, 0);
// Past a lollipop's end, s runs back down the stem from the switch.

const at = (R, s, out) => R.curve.getPointAt(routeU(R, (R.balloon && s > R.len ? R.balloon.land - (s - R.len) : s) / R.len), out);

// ---------- tours ----------
// A tour rides through several lines. It names the stations it must pass in order, each optionally on a given
// route, and a search finds the track between them. The search never turns back. It changes track only where
// a line's end meets another track, and only where the turn there is under about 107°. The legs join into one
// open route that stops at every station on the way. A tour's single train is the only one on the tracks while
// it runs. The pack lists the tours and the music each one plays.

const TOURS_DEF = MAGLEV.tours ?? [];

// Nodes are the stations and the junctions. A line's end node knows the heading that leaves the line there. A
// lollipop's end links to its own stem at the switch.

function network() {
  const nodes = ROUTES.map(() => []);
  const node = (R, s, st) => {
    const n = { R, s, st, links: [], t: R.curve.getTangentAt(routeU(R, s / R.len)) };
    nodes[ROUTES.indexOf(R)].push(n);
    return n;
  };
  for (const st of STATIONS) node(st.route, st.s, st);
  for (const R of ROUTES) if (!R.closed) for (const e of [0, R.len]) {
    const p = R.curve.getPointAt(e / R.len);
    let best = null;
    for (const O of ROUTES) if (O !== R || R.balloon) for (let u = 0; u <= 1; u += 2 / O.len) {
      const q = O.curve.getPointAt(u), d = Math.hypot(q.x - p.x, q.z - p.z);
      if (O === R && Math.abs(u * O.len - e) < 100) continue;
      if (d < 12 && (!best || d < best.d)) best = { d, O, s: u * O.len };
    }
    if (!best) continue;
    const a = node(R, e), b = node(best.O, best.s);
    a.out = e ? 1 : -1;
    a.links.push(b); b.links.push(a);
  }
  for (const list of nodes) list.sort((p, q) => p.s - q.s);
  return nodes;
}

// Dijkstra over (node, heading) from the start states to the first node that matches. Moves run along the
// node's route in its heading, leave a line at its end onto the track it meets, or enter a line inward.

function search(nodes, starts, match) {
  const key = (n, d) => `${ROUTES.indexOf(n.R)}:${n.s}:${d}`, dist = new Map(), prev = new Map(), open = [];
  for (const [n, d] of starts) { dist.set(key(n, d), 0); open.push([0, n, d]); }
  while (open.length) {
    open.sort((p, q) => p[0] - q[0]);
    const [c, n, d] = open.shift(), k = key(n, d);
    if (c > dist.get(k)) continue;
    if (c > 0 && match(n)) {
      const path = [[n, d]];
      for (let p = prev.get(k); p; p = prev.get(key(...p))) path.unshift(p);
      return path;
    }
    const list = nodes[ROUTES.indexOf(n.R)], i = list.indexOf(n), L = n.R.len, steps = [];
    let j = i + d;
    if (n.R.closed) j = (j + list.length) % list.length;
    if (j >= 0 && j < list.length && list[j] !== n) steps.push([list[j], d, ((list[j].s - n.s) * d % L + L) % L || L]);
    const turn = (p, dp, q, dq) => (p.t.x * q.t.x + p.t.z * q.t.z) * dp * dq > -.3;
    if (n.out === d) for (const b of n.links) for (const e of [1, -1]) if (turn(n, d, b, e)) steps.push([b, e, 0]);
    for (const b of n.links) if (b.out && turn(n, d, b, -b.out)) steps.push([b, -b.out, 0]);
    for (const [m, e, w] of steps) {
      const mk = key(m, e);
      if (c + w < (dist.get(mk) ?? Infinity)) { dist.set(mk, c + w); prev.set(mk, [n, d]); open.push([c + w, m, e]); }
    }
  }
  return null;
}

// Samples every leg every 3 m into one polyline and keeps the stations it passes, then builds the route.
// A tour starts and ends 60 m past its end stations, so the train fits the platform.

function buildTour(nodes, def) {
  const want = ([name, on]) => n => n.st?.name === name && (!on || n.R.name === on);
  const first = nodes.flat().find(want(def.via[0]));
  if (!first) return null;
  let path = [[first, 1]];
  for (const stop of def.via.slice(1)) {
    const tail = path.at(-1), p = search(nodes, path.length > 1 ? [tail] : [[first, 1], [first, -1]], want(stop));
    if (!p) return null;
    path = path.length > 1 ? [...path, ...p.slice(1)] : p;
  }
  const legs = [];
  for (let k = 1; k < path.length; k++) {
    const [n, d] = path[k - 1], [m] = path[k];
    if (m.R === n.R && !n.links.includes(m)) legs.push({ R: n.R, a: n.s, D: ((m.s - n.s) * d % n.R.len + n.R.len) % n.R.len, d });
  }
  const pad = (g, front) => {
    const room = g.R.closed ? 60 : front ? (g.d > 0 ? g.a : g.R.len - g.a) : (g.d > 0 ? g.R.len - g.a - g.D : g.a - g.D);
    return Math.min(60, room);
  };
  const f = pad(legs[0], true), b = pad(legs.at(-1), false);
  legs[0].a -= legs[0].d * f; legs[0].D += f;
  legs.at(-1).D += b;
  const pts = [], cum = [0], passed = [];
  for (const g of legs) {
    const n = Math.max(1, Math.ceil(g.D / 3)), base = pts.length;
    for (let k = 0; k <= n; k++) {
      const p = at(g.R, g.a + g.d * g.D * k / n, V(0, 0, 0));
      if (pts.length && p.distanceTo(pts.at(-1)) < .5) continue;

      // A junction point can sit a metre past the line's end. Samples that would step back there drop out.

      while (pts.length > 1 && (p.x - pts.at(-1).x) * (pts.at(-1).x - pts.at(-2).x) + (p.z - pts.at(-1).z) * (pts.at(-1).z - pts.at(-2).z) < 0) { pts.pop(); cum.pop(); }
      if (pts.length) cum.push(cum.at(-1) + p.distanceTo(pts.at(-1)));
      pts.push(p);
    }
    for (const st of g.R.stops) {
      const L = g.R.len, along = g.R.closed ? ((st.s - g.a) * g.d % L + L) % L : (st.s - g.a) * g.d;
      if (along >= 0 && along <= g.D) passed.push({ st, i: Math.min(pts.length - 1, base + Math.round(along / g.D * n)) });
    }
  }

  // A 21 m moving average rounds the corners where lines meet, so the camera does not snap round them.

  const soft = pts.map((p, i) => {
    if (i < 3 || i > pts.length - 4) return p;
    const q = V(0, 0, 0);
    for (let k = -3; k <= 3; k++) q.add(pts[i + k]);
    return q.divideScalar(7);
  });
  const curve = new THREE.CatmullRomCurve3(soft);
  curve.arcLengthDivisions = pts.length * 2;
  const R = { name: def.name, music: def.music, tour: true, closed: false, curve, path: pts, len: curve.getLength() };

  // A station that repeats within 400 m is a second platform of the same interchange, so the train runs through.

  R.stops = [];
  for (const { st, i } of passed.sort((p, q) => p.i - q.i)) {
    const s = cum[i] * R.len / cum.at(-1);
    if (R.stops.some(o => o.name === st.name && s - o.s < 400)) continue;
    R.stops.push({ id: st.id, name: st.name, route: R, s, u: s / R.len });
  }
  timetable(R);
  R.t = 0;
  R.trains = [Array.from({ length: CARS }, (_, j) => carriage(!j ? 1 : j === CARS - 1 ? -1 : 0))];
  for (const m of R.trains[0]) { m.position.set(0, -1e4, 0); m.lookAt(V(0, -1e4, 1)); }
  return R;
}
export const TOURS = (() => {
  const nodes = network();
  return TOURS_DEF.map(d => buildTour(nodes, d) ?? console.warn('tour without a path', d.name)).filter(Boolean);
})();
// A closed route runs backwards when R.sign is -1. The heading flips with it.

const trainState = (R, k) => {
  const o = state(R, R.t + k * R.P / R.trains.length);
  if (cyc(R)) o.dir *= R.sign ?? 1;
  return o;
};
// The traffic slider's default, 0.3, runs the timetables at their own pace.
// The rider's line holds still while the camera flies in to board.

// On a tour only the tour's train runs. The other trains drop out of sight when it starts and come back when
// it ends, and a tour's train drops out when its tour ends. The cab takes the place of the ridden lead car, and
// the ridden train's other cars draw half see-through.

let onTour = null;
const _g = new THREE.Matrix4(), hideCar = m => { m.position.set(0, -1e4, 0); m.lookAt(_b.set(0, -1e4, 1)); };
function moveTrains(dt) {
  const tour = ride?.R.tour ? ride.R : null;
  if (tour !== onTour) {
    for (const R of onTour ? [onTour] : RUNS) for (const cars of R.trains) cars.forEach(hideCar);
    onTour = tour;
  }
  clearGhosts();
  for (const R of tour ? [tour] : RUNS) {
    R.t += dt * TRAFFIC.speed / .3 * (ride?.R === R ? (ride.boarding || ride.paused ? 0 : ride.mul) : 1) * (cyc(R) ? R.sign ?? 1 : 1);
    R.trains.forEach((cars, k) => {
      const { c, dir } = trainState(R, k), e = dir * carEnd(R, R.t + k * R.P / R.trains.length);
      cars.forEach((m, j) => {
        const s = c + e * (TL / 2 - CAR / 2 - j * CAR);
        at(R, s, _a); at(R, s + e * 2, _b);
        m.position.copy(_a).y += 2.4; _b.y += 2.4; m.lookAt(_b);
        if (ride?.R !== R || ride.wait || k) return;
        if (!j) { cab.position.copy(m.position); cab.quaternion.copy(m.quaternion); }
        _g.copy(m.matrix);
        hideCar(m);
        if (j) ghostCar(_g, j === cars.length - 1, m.lamp);
      });
    });
  }
  cab.visible = !!ride && !ride.wait;
  uploadTrains();
}

// ---------- the ride ----------
// The rider boards train 0 of the station's route. Boarding shifts that route's clock, so the train is
// standing at the station when the camera lands. Only this viewer's city sees the shift.

let ride = null, exit = null, drag = null, shown = '';
export const riding = () => !!(ride || exit);
const NEAR = camera.near;
const setNear = n => { camera.near = n; camera.updateProjectionMatrix(); };

// Tunnels on a route, as [from, to] in metres along it. Each tunnelled lot gives the points where its portals
// meet this line.

function tunnels(R) {
  const key = TUNNELS[0] ?? null;
  if (R.tunKey === key && R.tun) return R.tun;
  R.tunKey = key; R.tun = [];
  R.samples ??= R.curve.getSpacedPoints(Math.ceil(R.len / 3));
  const n = R.samples.length - 1;
  for (const ps of TUNNELS) {
    const ss = ps.flatMap(p => p.at).flatMap(p => {
      let best = 64, s = null;
      R.samples.forEach((q, i) => { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2 + (q.z - p.z) ** 2; if (d < best) { best = d; s = i / n * R.len; } });
      if (s == null) return [];

      // A finer pass puts the lining's end on the facade.

      let fine = s;
      for (let u = s - 3; u <= s + 3; u += .25) { at(R, u, _a); const d = (_a.x - p.x) ** 2 + (_a.y - p.y) ** 2 + (_a.z - p.z) ** 2; if (d < best) { best = d; fine = u; } }
      return [fine];
    });
    if (ss.length > 1 && Math.max(...ss) - Math.min(...ss) < 300) R.tun.push([Math.min(...ss), Math.max(...ss)]);
  }
  return R.tun;
}

// ---------- tunnel linings ----------
// A black tube lines each tower tunnel from portal to portal, so a rider sees no rooms, only the lit mouth
// ahead. The tower's facade opens inside the tube's ends, so from outside the tunnel shows through to the far
// mouth. A mouth the facade cannot open gets a black inset that faces out and hides the windows. Lamps on the
// walls show the speed. All of it rebuilds with the city.

const LINING = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }), LINING_OUT = new THREE.MeshBasicMaterial({ color: 0x020305 });
const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(.25, .18, 1.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(.22, .55, .75) }), 2000);
const linings = new THREE.Group(), INSET = new THREE.PlaneGeometry(1, 1);
lamps.count = 0; lamps.frustumCulled = false;
scene.add(linings, lamps);
let liningKey;
function lineTunnels() {
  const key = TUNNELS[0] ?? null;
  if (key === liningKey) return;
  liningKey = key;
  for (const m of linings.children) if (m.geometry !== INSET) m.geometry.dispose();
  linings.clear();
  lamps.count = 0;
  const o = new THREE.Object3D();
  for (const R of RUNS) for (const [a, b] of tunnels(R)) {
    const path = [];
    for (let s = a; s < b; s += 2) path.push(at(R, s, V(0, 0, 0)));
    path.push(at(R, b, V(0, 0, 0)));
    linings.add(new THREE.Mesh(sweep(path, [[-3.4, -3.4], [3.4, -3.4], [3.4, 6], [-3.4, 6]], false), LINING));
    for (let s = a + 4; s < b - 2 && lamps.count < 1998; s += 8) for (const k of [-1, 1]) {
      at(R, s, _a); at(R, s + 1, _b);
      const sx = (_b.z - _a.z) * 3.2 * k, sz = (_a.x - _b.x) * 3.2 * k, n = Math.hypot(_b.x - _a.x, _b.z - _a.z) || 1;
      o.position.set(_a.x + sx / n, _a.y + 3, _a.z + sz / n);
      o.lookAt(_b.x + sx / n, _a.y + 3, _b.z + sz / n);
      o.updateMatrix();
      lamps.setMatrixAt(lamps.count++, o.matrix);
    }
  }
  for (const p of TUNNELS.flat()) if (p.kind === 'maglev' && !p.open) {
    const m = new THREE.Mesh(INSET, LINING_OUT);
    m.position.set(p.x + p.nx * .12, p.y + 1.3, p.z + p.nz * .12);
    m.rotation.y = Math.atan2(p.nx, p.nz);
    m.scale.set(p.w, 9.8, 1);
    linings.add(m);
  }
  lamps.instanceMatrix.needsUpdate = true;
}

// The camera sits in the lead car, .5 m ahead of its centre and 2.7 m above the track, so the floor shows low
// ahead and the eye clears the decks beside the line. The heading runs along a chord to AHEAD m on, so the rider
// looks into a curve. The view looks at a clicked place, or else where the rider's yaw and pitch turn it off the
// heading. It eases toward that aim, so a change never jumps. The cab hull turns with the track's heading over the
// car, eased over HULL m of track, and snaps round only when the train reverses.

const _d = V(0, 0, 0), AHEAD = 20, EASE = 5, HULL = 6;
const yawTo = (R, a, b) => { at(R, a, _a); at(R, b, _b); return Math.hypot(_b.x - _a.x, _b.z - _a.z) > 1 ? Math.atan2(_b.x - _a.x, _b.z - _a.z) : null; };
function pose(C, T, dt = 1) {
  // On a lollipop the rider keeps the same car after the root reverse and rides the next trip backwards, at the
  // glass end that is now at the rear. Odd trips seat the camera there, facing back, so the view never turns.

  const { R } = ride, { c, dir } = trainState(R, 0), end = carEnd(R, R.t), e = dir * end, s = c + e * (TL / 2 - CAR / 2);
  at(R, s, _a); at(R, s + e * 2, _b);
  _f.subVectors(_b, _a).normalize();
  C.copy(_a).addScaledVector(_f, .5).y += 2.7;
  const pitch = Math.asin(_f.y), near = Math.atan2(_f.x, _f.z), k = 1 - Math.exp(-dt * EASE);
  ride.head = yawTo(R, s, s + e * AHEAD) ?? near;
  _f.set(Math.sin(ride.head), 0, Math.cos(ride.head));
  const car = yawTo(R, s - e * CAR / 2, s + e * CAR / 2) ?? near;
  if (ride.face !== e) Object.assign(ride, { face: e, hull: car, hs: s });
  const kh = 1 - Math.exp(-Math.abs(s - ride.hs) / HULL);
  ride.hs = s;
  ride.hull += (car - ride.hull - Math.round((car - ride.hull) / (2 * Math.PI)) * 2 * Math.PI) * kh;
  cab.rotation.set(-pitch, ride.hull, 0, 'YXZ');
  const Y = ride.head + ride.yaw, P = ride.pitch - .06;
  if (ride.focus) _d.subVectors(ride.focus, C).normalize();
  else _d.set(Math.sin(Y) * Math.cos(P), Math.sin(P), Math.cos(Y) * Math.cos(P));
  ride.aim ??= _d.clone();
  ride.aim.lerp(_d, k).normalize();
  T.copy(ride.aim).multiplyScalar(40).add(C);
  if (ride.dir !== dir) {
    if (ride.dir) ride.blend ??= { fromC: camera.position.clone(), fromT: controls.target.clone(), t: 0, dur: 1.2 };
    ride.dir = dir;
  }
}

// A clicked place holds the view while its card is open. Letting go keeps the view where it points.

export function rideFocus(p) {
  if (!ride) return;
  if (p?.top) ride.focus = V(p.frame?.cx ?? p.top.x, p.top.y * .45, p.frame?.cz ?? p.top.z);
  else release();
}
function release() {
  if (!ride?.focus) return;
  ride.focus = null;
  ride.yaw = Math.atan2(ride.aim.x, ride.aim.z) - ride.head;
  ride.pitch = THREE.MathUtils.clamp(Math.asin(ride.aim.y) + .06, -1.2, 1.2);
}

export function startRide(st) {
  exit = null;
  const R = st.route;

  // On a line the ride sets off towards the farther end. The train leaves 1 s after the camera boards.

  const dir = cyc(R) || st.s < R.len / 2 ? 1 : -1;
  let t0 = 0;
  for (const g of R.segs) { if (g.st === st && g.dir === dir) { t0 += g.T - 1; break; } t0 += g.T; }
  R.t = t0 + .01;
  if (ride) ride.R.sign = 1;
  R.sign = 1;
  ride = { R, dir: 0, boarding: true, yaw: 0, pitch: 0, mul: ride?.mul ?? 1, blend: { fromC: camera.position.clone(), fromT: controls.target.clone(), t: 0, dur: 2.4 } };
  controls.enabled = false;
  setNear(.4);
  $('rSpeed').textContent = `${ride.mul}×`;
  $('rPause').textContent = '❚❚ Pause';
  $('rFlip').hidden = false;
  document.body.classList.add('focus');
  $('ride').hidden = false;
  showLabels();
  music(R);
}

// ---------- line changes ----------
// An interchange is a station of another route with the same name within 60 m. Spur stations never count.

export const changesAt = st => {
  if (!st?.route || st.route.root || st.route.tour) return [];
  const p = st.route.curve.getPointAt(st.u), out = [];
  for (const o of STATIONS) {
    const R = o.route;
    if (R === st.route || R.root || o.name !== st.name || out.some(c => c.R === R) || !R.segs?.some(g => g.st === o)) continue;
    if (R.curve.getPointAt(o.u).distanceTo(p) < 60) out.push({ st: o, R });
  }
  return out;
};

// A change moves the rider to the new platform to wait. Each way the new train can leave is an option, as a
// clock time t at the platform and, on a loop, a sign. The way closest to the old heading comes first.

export function changeLine(st) {
  if (!ride) return;
  const R = st.route, h = V(Math.sin(ride.head), 0, Math.cos(ride.head)), t = R.curve.getTangentAt(st.u).setY(0).normalize(), opts = [];
  let t0 = 0;
  for (const g of R.segs) {
    if (g.st === st && g.D == null) {
      if (R.closed) opts.push({ sign: 1, t: t0, way: 1 }, { sign: -1, t: t0 + g.T, way: -1 });
      else opts.push({ sign: 1, t: t0, way: g.dir });
    }
    t0 += g.T;
  }
  for (const o of opts) o.dot = o.way * t.dot(h);
  opts.sort((a, b) => b.dot - a.dot);
  ride = { ...ride, R, boarding: null, focus: null, wait: { st, opts, i: 0, t, C: V(0, 0, 0), T: V(0, 0, 0), h: V(0, 0, 0) } };
  waitFor();
  music(R);
}

// Times the chosen train to reach the platform in about 8 s, but before the train ahead could still stand there.
// The rider stands on the platform side nearest the camera and looks back down the track at the train coming in.

function waitFor() {
  const { R } = ride, w = ride.wait, o = w.opts[w.i], st = w.st, p = R.curve.getPointAt(st.u), g = R.segs.find(g => g.st === st && g.D == null);
  const lead = Math.max(0, Math.min(8 * TRAFFIC.speed / .3 * ride.mul, R.P / R.trains.length - g.T - 2));
  R.sign = o.sign;
  R.t = o.t - o.sign * lead;
  w.h.copy(w.t).multiplyScalar(o.way);
  const a = Math.atan2(w.t.x, w.t.z), c = Math.cos(a), sn = Math.sin(a), sides = SIDES.filter((s, k) => st.sides[k]);
  const side = (sides.length ? sides : SIDES).map(s => [s, Math.hypot(p.x + s * 5.5 * c - camera.position.x, p.z - s * 5.5 * sn - camera.position.z)]).sort((x, y) => x[1] - y[1])[0][0];
  w.C.set(p.x + side * 5.5 * c, p.y + 2.7, p.z - side * 5.5 * sn);
  w.T.copy(p).addScaledVector(w.h, -60).y += 2.7;
  ride.blend = { fromC: camera.position.clone(), fromT: controls.target.clone(), t: 0, dur: 1.6 };
}

// The rider's train centre along its route, the eye, and the lead car's centre and yaw, or null when not riding.

export const rideInfo = () => {
  if (!ride) return null;
  const { c, dir } = trainState(ride.R, 0), { x, y, z } = camera.position, f = V(0, 0, 1).applyQuaternion(cab.quaternion);
  return { route: ride.R.name, s: c, dir, waiting: !!ride.wait, eye: { x, y, z }, car: { x: cab.position.x, y: cab.position.y, z: cab.position.z, yaw: Math.atan2(f.x, f.z) } };
};
export function stopRide() {
  if (!ride) return;
  ride.R.sign = 1;
  if (ride.wait) { _e.copy(ride.wait.C); _f.copy(ride.wait.h); } else pose(_e, _T);
  const f = _f.clone(), toT = V(_e.x + f.x * 60, Math.max(0, _e.y - 20), _e.z + f.z * 60);
  exit = { fromC: camera.position.clone(), fromT: controls.target.clone(), toT, toC: toT.clone().addScaledVector(f, -240).setY(toT.y + 200), t: 0 };
  ride = null;
  drag = null;
  document.body.classList.remove('focus');
  $('ride').hidden = true;
  showLabels();
  music(null);
  stopSound();
}

// Runs after the map controls update, so the ride owns the camera for the frame.

export function rideTick(dt) {
  lineTunnels();
  moveTrains(dt);
  if (exit) {
    exit.t += dt;
    const w = smooth(0, 1.4, exit.t);
    camera.position.lerpVectors(exit.fromC, exit.toC, w);
    controls.target.lerpVectors(exit.fromT, exit.toT, w);
    camera.lookAt(controls.target);
    if (w >= 1) { exit = null; controls.enabled = true; setNear(NEAR); }
    return;
  }
  if (!ride) return;
  sound(dt);

  // The rider boards once the new train stands at the platform. The clock holds while the camera boards.

  if (ride.wait) {
    const { g } = trainState(ride.R, 0);
    if (g.D == null && g.st === ride.wait.st) Object.assign(ride, { wait: null, boarding: true, dir: 0, aim: null, face: 0, yaw: 0, pitch: 0, blend: { fromC: camera.position.clone(), fromT: controls.target.clone(), t: 0, dur: 1.2 } });
  }
  if (ride.wait) { _e.copy(ride.wait.C); _T.copy(ride.wait.T); } else pose(_e, _T, dt);
  const b = ride.blend;
  if (b) {
    b.t += dt;
    const w = smooth(0, b.dur, b.t), hop = Math.sin(w * Math.PI) * Math.min(400, b.fromC.distanceTo(_e) * .25);
    _e.lerpVectors(b.fromC, _e, w); _T.lerpVectors(b.fromT, _T, w);
    _e.y += hop; _T.y += hop;
    if (w >= 1) ride.blend = ride.boarding = null;
  }
  camera.position.copy(_e);
  controls.target.copy(_T);
  camera.lookAt(_T);
  hud();
}

// ---------- sound ----------
// The speed comes from the cab's move this frame. Passing is the distance to the nearest car of another
// route's train at the cab's height, so on the partner guideway. A loop train arrives on the frame it starts a
// dwell at a station other than the last one it stood at, so a flip at a platform never arrives twice. Only the
// loops run into the Beanstalk hall, so spurs and tours never announce.
// The rider on a platform hears none of it.

function sound(dt) {
  const { g } = trainState(ride.R, 0), hall = CITY.loops?.some(l => l.name === ride.R.name), stop = g.D == null ? g.st : null;
  const arrive = hall && !ride.wait && ride.st !== undefined && stop && stop !== ride.st ? stop.name : null;
  if (stop || ride.st === undefined) ride.st = stop;
  if (ride.wait) ride.at = null;
  const speed = ride.at && dt > 0 ? cab.position.distanceTo(ride.at) / dt : 0;
  (ride.at ??= V(0, 0, 0)).copy(cab.position);
  rideSound({ actx, out: actx.destination, speed, arrive, muted: muted || !!ride.wait });
}

// ---------- music ----------
// Each route loops its own track, from podcast/music.py. It fades in on boarding and out on leaving.
// Web Audio loops without the gap an <audio> element leaves. The mute choice persists.

const VOL = .5, tracks = new Map();
let actx, gain, playing = null, muted = false;
try { muted = localStorage.getItem('rideMusic') === 'off'; } catch {}
function music(R) {
  actx ??= new AudioContext();
  if (!gain) { gain = actx.createGain(); gain.gain.value = 0; gain.connect(actx.destination); }
  actx.resume();
  const key = R?.music ?? (R?.root ? MAGLEV.centreMusic : R?.name.toLowerCase().replace(/\s+/g, '-'));
  if (playing?.key === key) return fade();
  const old = playing;
  playing = null;
  if (old) { old.src.stop(actx.currentTime + .8); old.out.gain.setTargetAtTime(0, actx.currentTime, .25); }
  if (!R) return fade();
  if (!tracks.has(key)) tracks.set(key, fetch(`${RIDE_AUDIO}${key}.mp3`).then(r => r.arrayBuffer()).then(b => actx.decodeAudioData(b)).catch(() => null));
  tracks.get(key).then(buf => {
    if (!buf || !ride || ride.R !== R || playing) return;
    const src = actx.createBufferSource(), out = actx.createGain();
    src.buffer = buf; src.loop = true;
    src.connect(out).connect(gain);
    src.start();
    playing = { key, src, out };
    fade();
  });
}
function fade() {
  gain.gain.cancelScheduledValues(actx.currentTime);
  gain.gain.setTargetAtTime(playing && ride && !muted ? VOL : 0, actx.currentTime, playing && ride ? .8 : .3);
  $('rMusic').textContent = muted ? '♪ Off' : '♪ On';
}

// ---------- HUD and input ----------

const $ = id => document.getElementById(id);
let hudAt = 0;
function hud() {
  if (performance.now() - hudAt < 250) return;
  hudAt = performance.now();
  const { g } = trainState(ride.R, 0), here = short(districtAt(camera.position.x, camera.position.z));
  const name = g.st?.name, ch = !ride.wait && g.D == null ? changesAt(g.st) : [], next = ride.wait ? `${ride.wait.st.name} · waiting for the train`
    : g.D == null
    ? (g.end ? (name ? `${name} station · end of the line` : 'End of the line · turning back') : `${name} station`)
    : cyc(ride.R) && ride.R.sign < 0 ? `Next: ${g.fromSt.name}`
    : g.to.st ? `Next: ${g.to.st.name}` : 'Next: end of the line';
  const txt = `${ride.R.name}|${next}|${here ? `Passing through ${here}` : 'Over open ground'}|${ch.map(c => c.R.name)}`;
  if (txt === shown) return;
  shown = txt;
  [$('rLine').textContent, $('rNext').textContent, $('rWhere').textContent] = txt.split('|');
  $('rChange').hidden = !ch.length;
  $('rChange').replaceChildren(...ch.map(c => {
    const b = document.createElement('button');
    b.textContent = `Change to ${c.R.name}`;
    b.onclick = () => changeLine(c.st);
    return b;
  }));
}

$('rExit').onclick = stopRide;
$('rFlip').onclick = () => {
  if (!ride) return;
  const R = ride.R, w = ride.wait;
  if (w) { if (w.opts.length > 1) { w.i = 1 - w.i; waitFor(); } }
  else if (cyc(R)) R.sign = -(R.sign ?? 1);
  else R.t = END_DWELL - R.t % R.P;
};
$('rMusic').onclick = () => {
  muted = !muted;
  try { localStorage.setItem('rideMusic', muted ? 'off' : 'on'); } catch {}
  fade();
};

// Map labels can hide while riding. The choice is remembered, and leaving the train shows them again.

let quiet = false;
try { quiet = localStorage.getItem('rideLabels') === 'off'; } catch {}
const showLabels = () => {
  labels.domElement.style.display = ride && quiet ? 'none' : '';
  $('rLabels').textContent = quiet ? 'Labels Off' : 'Labels On';
};
$('rLabels').onclick = () => {
  quiet = !quiet;
  try { localStorage.setItem('rideLabels', quiet ? 'off' : 'on'); } catch {}
  showLabels();
};
$('rSpeed').onclick = () => { if (!ride) return; ride.mul = SPEEDS[(SPEEDS.indexOf(ride.mul) + 1) % SPEEDS.length]; $('rSpeed').textContent = `${ride.mul}×`; };

// Pause stops the ridden line's trains, for screenshots. Other traffic keeps moving.

$('rPause').onclick = () => { if (!ride) return; ride.paused = !ride.paused; $('rPause').textContent = ride.paused ? '▶ Resume' : '❚❚ Pause'; };

// Dragging turns the view like grabbing the world. A press passes on to the map, so a tap still selects.
// Past 5 px it is a drag, which frees the view from a clicked place and keeps its release from the map.

const canvas = renderer.domElement;
addEventListener('pointerdown', e => { if (ride && e.target === canvas) drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }; }, true);
addEventListener('pointermove', e => {
  if (!drag || !ride) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) <= 5) return;
  if (!drag.moved) { drag.moved = true; release(); }
  ride.yaw += (e.clientX - drag.x) * .005;
  ride.pitch = THREE.MathUtils.clamp(ride.pitch + (e.clientY - drag.y) * .004, -1.2, 1.2);
  drag.x = e.clientX; drag.y = e.clientY;
}, true);
addEventListener('pointerup', e => { if (drag?.moved) e.stopPropagation(); drag = null; }, true);
addEventListener('wheel', e => { if (ride && e.target === canvas) e.stopPropagation(); }, { capture: true, passive: true });
addEventListener('keydown', e => {
  if (!ride || e.target.matches?.('input, textarea, select')) return;
  const turn = { ArrowLeft: [.12, 0], ArrowRight: [-.12, 0], ArrowUp: [0, .08], ArrowDown: [0, -.08] }[e.key];
  if (turn) { e.preventDefault(); release(); ride.yaw += turn[0]; ride.pitch = THREE.MathUtils.clamp(ride.pitch + turn[1], -1.2, 1.2); }
  if (e.key === 'Escape') stopRide();
});
