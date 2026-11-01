// Maglev ride: district stations on the loop and the lines, and a train the camera rides on.

import * as THREE from 'three';
import { S } from './state.js';
import { CITY, STANDALONE, hash, rng, sdPoly, smooth } from './core.js';
import { camera, controls, labels, renderer, scene } from './render.js';
import { ROUTES, STATIONS, STATION_LEN, TRAFFIC, carriage, routeU, sweep, uploadTrains } from './transport.js';
import { TUNNELS, portalWidth } from './generator.js';
import { GLOWS, beam, glow, glows, prop, puff, put, textSign } from './instances.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const districtAt = (x, z) => CITY.districts.find(d => sdPoly(x, z, d.poly) > 0);
const short = d => d?.name.replace(/\s+District$/i, '');

// The first route is the City Loop. A line takes the name of the district at its far end, a ring the district it
// circles. A Root spur is a Beanstalk line, named by where it heads from the Root, in city.json's spur order.

const districtOf = R => short(districtAt(R.curve.getPointAt(1).x, R.curve.getPointAt(1).z)) ?? 'Outer';
const SPUR_NAMES = ['Beanstalk Southwest Line', 'Beanstalk West Line', 'Beanstalk South Line'];
export const routeName = R => R === ROUTES[0] ? 'City Loop' : R.root ? SPUR_NAMES[ROUTES.indexOf(R) - 1] : `${districtOf(R)} ${R.closed ? 'Loop' : 'Line'}`;
for (const R of ROUTES) { R.name = routeName(R); R.stops = STATIONS.filter(st => st.route === R).sort((a, b) => a.s - b.s); }

// ---------- stations ----------
// Each station builds in a frame on the track: z runs along the line, x across it, y from the deck top.
// Platforms run from x 3.4 to 9.4 on both sides, 64 m long, with their floor at the train's floor (y 1).

const HALF = STATION_LEN / 2, SIDES = [-1, 1];
let y0 = 0;
const A = {
  box: (x, y, z, sx, sy, sz, rgb, ry = 0, rx = 0) => prop('box', x, y0 + y, z, sx, sy, sz, rgb, ry, rx),
  cyl: (x, y, z, d, h, rgb, rx = 0) => prop('cyl', x, y0 + y, z, d, h, d, rgb, 0, rx),
  cone: (x, y, z, d, h, rgb) => prop('cone', x, y0 + y, z, d, h, d, rgb),
  glw: (x, y, z, sx, sy, sz, rgb, ry = 0) => glow(x, y0 + y, z, sx, sy, sz, rgb, ry),
  ball: (x, y, z, d, rgb) => put(GLOWS.sphere, x, y0 + y, z, d, d, d, 0, 0, rgb),
  beam: (a, b, t, rgb, kind) => beam([a[0], y0 + a[1], a[2]], [b[0], y0 + b[1], b[2]], t, rgb, kind),
  text: (t, x, y, z, w, rgb, ry) => textSign(t, x, y0 + y, z, w, w / 4, ry, rgb),
  puff: (x, y, z, r) => puff(x, y0 + y, z, r, [.16, .16, .17]),
  blink: (x, y, z, s, rgb) => S.flicker.push([glows, glow(x, y0 + y, z, s, s, s, rgb), rgb, Math.random() * 10, true]),
};
const along = (step, fn, from = -HALF + step / 2, to = HALF) => { for (let z = from; z < to; z += step) fn(z); };

// Boards at the back of each platform carry the station name, facing the track below the rider's eye line.

function nameBoards(name, rgb, board) {
  for (const s of SIDES) for (const z of [-16, 16]) {
    A.box(s * 9.15, 3, z, .15, 1.9, 7.6, board);
    A.text(name.toUpperCase(), s * 9.05, 3, z, 7, rgb, -s * Math.PI / 2);
  }
}

// Kits dress the bare platforms. deck and edge colour the platform. sign and board colour the name boards.

const KITS = {
  chakana: {
    deck: [.42, .46, .52], edge: [.5, 1.6, 2.2], sign: [1.3, 1.9, 2.2], board: [.04, .06, .09],
    build(r) {
      // A ribbed vault of pale steel, open to the sky, with a light line along its crown. A ring at each end
      // wraps the platforms and the vault, so the train runs through it.

      along(5, z => {
        let p = [-11, 1];
        for (let k = 1; k <= 8; k++) {
          const a = Math.PI * (1 - k / 8), q = [Math.cos(a) * 11, 1 + Math.sin(a) * 13];
          A.beam([p[0], p[1], z], [q[0], q[1], z], .35, [.5, .55, .62]);
          p = q;
        }
      }, -HALF, HALF + 1);
      A.glw(0, 14, 0, .3, .3, STATION_LEN, [.6, 1.6, 2.2]);
      for (const s of SIDES) A.glw(s * 9, 1.06, 0, .5, .05, STATION_LEN, [.3, .8, 1.1]);
      for (const z of [-HALF - 2, HALF + 2]) put(GLOWS.ring, 0, y0 + 5, z, 30, 30, 30, 0, Math.PI / 2, [.5, 1.4, 2]);
      void r;
    },
  },
  'base-de-cayambe': {
    deck: [.2, .17, .14], edge: [1.6, .7, .15], sign: [1.7, .9, .3], board: [.12, .07, .04],
    build(r) {
      // Patched corrugated roofs on rusty posts, sodium lamps, crates and paint on the back fences.

      const rust = () => [[.26, .12, .06], [.18, .16, .14], [.12, .16, .2], [.3, .2, .08]][Math.floor(r() * 4)];
      for (const s of SIDES) {
        along(8, z => { A.box(s * 9, 3.8, z, .5, 5.6, .5, [.2, .1, .05]); A.box(s * 4, 3.8, z, .4, 5.6, .4, [.2, .1, .05]); }, -HALF + 2);
        along(6, z => A.box(s * (6.6 + r() * .4), 6.7 + r() * .4, z, 7 + r(), .25, 6.3, rust(), r() * .06 - .03));
        along(8, z => A.glw(s * 6.5, 6.3, z, .5, .3, .5, [1.9, .85, .2]));
        A.box(s * 9.6, 2, 0, .2, 2, STATION_LEN, [.1, .09, .08]);
        along(5, z => r() < .6 && A.glw(s * 9.48, 1.4 + r() * 1.2, z, .05, .8 + r(), 2 + r() * 3,
          [[1.6, .2, .9], [.2, 1.3, 1.2], [1.6, 1.3, .1], [.9, .3, 1.6]][Math.floor(r() * 4)].map(v => v * .5)));
        along(9, z => r() < .7 && A.box(s * 8.2, 1.6, z + r() * 3, 1.2, 1.2, 1.2, [.22, .15, .08], r()));
      }
    },
  },
  rutherford: {
    deck: [.05, .06, .08], edge: [1.8, .2, 1.4], sign: [1.6, 2, 2.2], board: [.02, .02, .03],
    build(r) {
      // A chrome hall under one thin roof, neon lines below it, gold trim and wall-high adverts behind the platforms.

      A.box(0, 9.2, 0, 22, .4, STATION_LEN + 4, [.55, .6, .66]);
      for (const x of [-8, -4, 4, 8]) A.glw(x, 8.9, 0, .15, .1, STATION_LEN, [.2, 1.5, 1.9]);
      for (const s of SIDES) {
        A.glw(s * 11, 9.2, 0, .12, .5, STATION_LEN + 4, [1.7, 1.25, .45]);
        along(8, z => A.cyl(s * 9.9, 5, z, .5, 8, [.7, .74, .8]), -HALF + 4);
        along(16, z => A.glw(s * 9.6, 4.6, z, .2, 5, 12, [[1.5, .15, 1.1], [.15, 1.2, 1.5], [.2, 1.4, 1.1], [1.1, .2, 1.4]][Math.floor(r() * 4)]));
      }
    },
  },
  esmeraldas: {
    deck: [.2, .2, .19], edge: [1.7, 1.3, .1], sign: [1.8, 1.4, .5], board: [.08, .08, .07],
    build(r) {
      // Steel portal frames with braces, hazard stripes on the edges and stacked containers on both sides.

      along(8, z => {
        for (const s of SIDES) { A.box(s * 10, 5, z, .6, 10, .6, [.22, .24, .26]); A.beam([s * 10, 7, z], [s * 6, 10, z], .25, [.22, .24, .26]); }
        A.box(0, 10, z, 21, .6, .6, [.22, .24, .26]);
        A.glw(0, 9.6, z, .7, .3, .7, [1.8, 1.1, .35]);
      }, -HALF);
      for (const s of SIDES) {
        along(2, z => A.box(s * 3.75, 1.02, z, .5, .06, 1, [1.4, 1.1, .1]));
        along(13, z => {
          const n = 1 + Math.floor(r() * 3);
          for (let k = 0; k < n; k++) A.box(s * 13, -1.4 + k * 2.7, z, 2.5, 2.6, 12, [[.4, .08, .05], [.08, .2, .35], [.35, .3, .08], [.12, .25, .12]][Math.floor(r() * 4)]);
        });
      }
    },
  },
  nihongai: {
    deck: [.16, .1, .07], edge: [1.8, .5, .2], sign: [1.9, 1.6, 1.2], board: [.18, .03, .02],
    build(r) {
      // Tiered tile roofs on red posts, rows of paper lanterns and a red gate at each end of both platforms.

      for (const s of SIDES) {
        along(8, z => { A.cyl(s * 4.2, 3.6, z, .45, 5.2, [.35, .05, .03]); A.cyl(s * 9, 3.6, z, .45, 5.2, [.35, .05, .03]); }, -HALF + 4);
        A.box(s * 6.6, 6.4, 0, 8.4, .35, STATION_LEN - 8, [.07, .05, .05]);
        A.box(s * 6.6, 7.2, 0, 6, .35, STATION_LEN - 12, [.07, .05, .05]);
        A.box(s * 6.6, 7.6, 0, .4, .3, STATION_LEN - 12, [.6, .08, .04]);
        along(4, z => { A.ball(s * 4.8, 5.3, z, .6, [1.2, .22, .08]); A.ball(s * 8.4, 5.3, z, .6, [1.2, .35, .1]); }, -HALF + 6, HALF - 4);
        for (const z of [-HALF + 1, HALF - 1]) {
          for (const x of [4, 9]) A.cyl(s * x, 4.2, z, .55, 6.4, [.75, .08, .04]);
          A.box(s * 6.5, 7.4, z, 7.6, .5, .6, [.75, .08, .04]);
          A.box(s * 6.5, 7.75, z, 8.4, .25, .7, [.06, .04, .04]);
          A.box(s * 6.5, 6.3, z, 5.4, .3, .4, [.75, .08, .04]);
        }
      }
      void r;
    },
  },
  'laguna-velasco': {
    deck: [.5, .48, .44], edge: [1.5, 1.2, .8], sign: [1.4, 1.3, 1.1], board: [.3, .3, .28],
    build(r) {
      // A white canopy that rises and falls in a soft wave, planted trees, a water channel and warm light.

      for (const s of SIDES) {
        along(4, z => A.box(s * 6.6, 7.2 + Math.sin(z / 9) * .9, z, 8, .3, 4.1, [.72, .72, .7]));
        along(12, z => A.cyl(s * 9, 4, z, .35, 6.2, [.7, .7, .68]), -HALF + 6);
        along(4, z => A.glw(s * 6.6, 6.9 + Math.sin(z / 9) * .9, z, 5, .08, .3, [1.4, 1.05, .7]));
        A.glw(s * 9.1, 1.06, 0, .7, .05, STATION_LEN - 4, [.15, .6, .8]);
        along(10, z => { A.cyl(s * 7.8, 1.6, z, 1.6, 1.2, [.5, .48, .44]); A.cyl(s * 7.8, 3, z, .25, 2.4, [.15, .1, .06]); A.cone(s * 7.8, 5 + r(), z, 2.6, 3.8, [.06, .2, .08]); }, -HALF + 7);
      }
    },
  },
  manta: {
    deck: [.6, .62, .66], edge: [.4, 1, 2.2], sign: [1.4, 1.8, 2.2], board: [.7, .72, .76],
    build(r) {
      // Thin white fins sweep up over each platform like a wing, a blue strip on their tips, a mast with a beacon.

      for (const s of SIDES) {
        along(2.4, z => A.beam([s * 3, 8.8, z], [s * 11.5, 6.2, z], .3, [.78, .8, .84]));
        A.glw(s * 11.5, 6.2, 0, .25, .25, STATION_LEN, [.4, 1, 2.2]);
        along(16, z => A.box(s * 10.5, 3.6, z, .5, 5.2, .5, [.78, .8, .84]), -HALF + 8);
      }
      A.cyl(13, 9, HALF - 6, .9, 18 + 8, [.78, .8, .84]);
      A.blink(13, 22.5, HALF - 6, .9, [2.2, .1, .05]);
      void r;
    },
  },
  rabotgorod: {
    deck: [.2, .2, .19], edge: [.6, 1, .7], sign: [1.2, 1.3, 1.15], board: [.12, .12, .12],
    build(r) {
      // Heavy concrete slabs on square pillars, pale tube lights and red banners on the pillars.

      for (const s of SIDES) {
        A.box(s * 6.6, 6.8, 0, 8.6, 1.4, STATION_LEN + 2, [.2, .2, .19]);
        along(4, z => A.glw(s * 6.6, 6.05, z, 6, .1, .3, [.55, .85, .6]));
        along(10, z => {
          A.box(s * 9.4, 3.6, z, 1.3, 5.2, 1.3, [.22, .22, .21]);
          if (r() < .7) A.glw(s * 8.7, 3.6, z, .05, 4, 1.1, [.9, .07, .04]);
        }, -HALF + 2);
      }
    },
  },
  'la-costa': {
    deck: [.24, .2, .16], edge: [1.3, 1, .6], sign: [1.5, 1.2, .8], board: [.22, .14, .07],
    build(r) {
      // A country halt: a small wooden shelter in the middle, benches, lamp posts and palms beside the line.

      for (const s of SIDES) {
        for (const z of [-8, 0, 8]) A.box(s * 8.6, 2.8, z, .3, 3.6, .3, [.25, .15, .08]);
        A.box(s * 7.6, 4.7, 0, 4.2, .25, 18, [.2, .12, .06]);
        for (const z of [-5, 5]) A.box(s * 8, 1.5, z, .6, .4, 2.6, [.3, .18, .09]);
        along(11, z => { A.cyl(s * 4.6, 3, z, .14, 4, [.15, .15, .15]); A.ball(s * 4.6, 5.1, z, .45, [1.2, .9, .5]); });
        along(15, z => {
          const h = 7 + r() * 3, x = s * (12 + r() * 3);
          A.cyl(x, h / 2 - 2, z, .5, h + 4, [.2, .14, .08]);
          for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + r(); A.beam([x, h, z], [x + Math.cos(a) * 3.2, h - 1.4, z + Math.sin(a) * 3.2], .35, [.08, .22, .07]); }
        }, -HALF + 4 + r() * 4);
      }
    },
  },
  quinde: {
    deck: [.16, .14, .12], edge: [1.8, 1.2, .1], sign: [1.8, 1.5, .4], board: [.06, .05, .04],
    build(r) {
      // A factory gate: black steel frames under a truss roof, pipes on the walls with steam, orange beacons.

      along(8, z => {
        for (const s of SIDES) A.box(s * 10.2, 5, z, .8, 10, .8, [.1, .09, .08]);
        A.box(0, 10.2, z, 21.6, 1, .6, [.12, .1, .08]);
      }, -HALF);
      for (const s of SIDES) {
        A.box(s * 6, 10.4, 0, 9, .2, STATION_LEN, [.16, .12, .08]);
        along(2, z => A.box(s * 3.75, 1.02, z, .5, .06, 1, [1.6, 1.1, .08]));
        for (const y of [2.6, 3.8]) A.cyl(s * 10, y, 0, .7, STATION_LEN, [.3, .22, .12], Math.PI / 2);
        along(16, z => { A.blink(s * 9.6, 7.5, z, .6, [2, .7, .05]); if (r() < .7) A.puff(s * 10, 5, z + 3, 2.2); }, -HALF + 8);
      }
    },
  },
  guayaquil: {
    deck: [.18, .14, .1], edge: [1.6, .4, .2], sign: [1.8, 1.1, .5], board: [.25, .05, .1],
    build(r) {
      // A patchwork of painted roof sheets, market stalls on the platforms, string lights and laundry overhead.

      const paint = () => [[.35, .08, .06], [.06, .2, .3], [.3, .25, .05], [.08, .22, .1], [.25, .1, .28], [.2, .2, .2]][Math.floor(r() * 6)];
      for (const s of SIDES) {
        along(4, z => A.box(s * (6.5 + r() - .5), 6 + r() * .9, z, 6 + r() * 2, .2, 3.4 + r() * 2, paint(), r() * .2 - .1));
        along(6, z => A.box(s * 9, 3.3, z, .3, 4.8, .3, [.15, .12, .1]), -HALF + 3);
        along(8, z => {
          if (r() < .3) return;
          A.box(s * 8.6, 1.9, z, 1.4, 1.8, 4, [.14, .1, .08]);
          A.box(s * 8, 3.1, z, 2.6, .12, 4.6, paint().map(v => v * 3), -s * .2);
        }, -HALF + 5);
        along(.9, z => A.glw(s * (4 + ((z * 7.3) % 1 + 1) % 1 * 5), 5.3 + Math.sin(z * .7) * .3, z, .18, .18, .18,
          [[1.8, .3, .3], [.3, 1.6, .5], [1.8, 1.4, .3], [.4, .6, 1.8]][Math.floor(r() * 4)]));
        along(7, z => { for (let k = 0; k < 4; k++) A.box(s * (5 + k * 1.1), 4.4, z, .9, 1 + r() * .6, .05, paint().map(v => v * 2.5)); }, -HALF + 4);
      }
    },
  },
};

export function buildStations() {
  for (const st of STATIONS) {
    const R = st.route, u = st.u, p = R.curve.getPointAt(u), t = R.curve.getTangentAt(u), a = Math.atan2(t.x, t.z), K = KITS[st.id] ?? KITS.chakana;
    y0 = p.y;
    S.FRAME = { cx: 0, cz: 0, tx: p.x, tz: p.z, a, c: Math.cos(a), s: Math.sin(a) };
    const r = rng(hash(Math.round(p.x), 77));
    for (const s of SIDES) {
      A.box(s * 6.4, .2, 0, 6, 1.6, STATION_LEN, K.deck);
      A.glw(s * 3.5, 1.03, 0, .12, .05, STATION_LEN, K.edge.map(v => v * .45));
      along(16, z => A.cyl(s * 7, -y0 / 2 - .3, z, 1.4, y0 - .6, [.06, .065, .075]));
    }
    nameBoards(st.name, K.sign, K.board);
    K.build(r);
    S.FRAME = null;
  }
}

// ---------- timetable: every maglev train runs one ----------
// A loop carries a train per 800 m. They run one way round, time-shifted copies of one timetable, so they never meet.
// Each line is single track and carries one shuttle that runs end to end and back.
// Every train stops at each station with its centre on the platform's centre.

const CAR = 11.8, CARS = 5, TL = CAR * CARS, VMAX = 41.6, ACC = 2.8, DWELL = 3, END_DWELL = 12, SPEEDS = [1, 3, 8];
const DA = VMAX * VMAX / (2 * ACC), TA = VMAX / ACC;
const runTime = D => D < 2 * DA ? 2 * Math.sqrt(D / ACC) : 2 * TA + (D - 2 * DA) / VMAX;
function runDist(D, t) {
  const T = runTime(D), h = Math.min(t, T - t);
  const near = D < 2 * DA || h < TA ? .5 * ACC * h * h : DA + VMAX * (h - TA);
  return t <= T / 2 ? near : D - near;
}

// A timetable is a cycle of dwells and runs. A line's cycle starts on arrival at its first end and is
// symmetric about the middle of that dwell, so time END_DWELL − t finds the same spot facing the other way.

function timetable(R) {
  const L = R.len, segs = [];
  if (R.closed) {
    R.stops.forEach((st, i) => {
      const nx = R.stops[(i + 1) % R.stops.length];
      segs.push({ T: DWELL, at: st.s, st }, { from: st.s, D: ((nx.s - st.s) % L + L) % L || L, dir: 1, to: { st: nx } });
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
      segs.push({ T: w.end ? END_DWELL : DWELL, at: w.s, st: w.st, end: w.end }, { from: w.s, D: Math.abs(nx.s - w.s), dir: Math.sign(nx.s - w.s), to: nx });
    });
  }
  for (const g of segs) g.T ??= runTime(g.D);
  segs.forEach((g, i) => { g.dir ??= segs[i + 1].dir; });
  R.segs = segs;
  R.P = segs.reduce((a, g) => a + g.T, 0);
}

// Where a train is at timetable time tau: its centre c, heading dir, and the segment it is in.

function state(R, tau) {
  let t = ((tau % R.P) + R.P) % R.P;
  for (const g of R.segs) {
    if (t < g.T) return { c: g.D == null ? g.at : g.from + g.dir * runDist(g.D, t), dir: g.dir, g };
    t -= g.T;
  }
  return { c: R.segs[0].at, dir: R.segs[0].dir, g: R.segs[0] };
}

const RUNS = ROUTES;
RUNS.forEach((R, i) => {
  timetable(R);
  R.t = i * 37;
  R.trains = Array.from({ length: R.closed ? Math.round(R.len / 800) : 1 }, () => Array.from({ length: CARS }, () => carriage()));
});

const _a = V(0, 0, 0), _b = V(0, 0, 0), _f = V(0, 0, 0), _e = V(0, 0, 0), _T = V(0, 0, 0);
const at = (R, s, out) => R.curve.getPointAt(routeU(R, s / R.len), out);

// ---------- tours ----------
// A tour rides through several lines. It names the stations it must pass in order, each optionally on a given
// route, and a search finds the track between them. The search never turns back. It changes track only where
// a line's end meets another track, and only where the turn there is under about 107°. The legs join into one
// open route that stops at every station on the way. A tour's single train is the only one on the tracks while
// it runs.

const TOURS_DEF = [
  { name: 'Beanstalk Circle', music: 'beanstalk-line', via: [['The Beanstalk', 'Beanstalk South Line'], ['Rutherford', 'City Loop'],
    ['Base de Cayambe', 'City Loop'], ['The Beanstalk', 'Beanstalk West Line']] },
  { name: 'Beanstalk to the Malecón', music: 'esmeraldas-line', via: [['The Beanstalk', 'Beanstalk West Line'], ['The Malecón']] },
  { name: 'Beanstalk to Guayaquil', music: 'guayaquil-loop', via: [['The Beanstalk', 'Beanstalk Southwest Line'], ['Quinde'],
    ['Nuevo Guayaquil', 'Guayaquil Loop'], ['Las Peñas', 'Guayaquil Loop']] },
  { name: 'Beanstalk to the Coast', music: 'la-costa-line', via: [['The Beanstalk', 'Beanstalk West Line'], ['Manta'], ['Quinde'],
    ['Antiguo Guayaquil', 'Guayaquil Line']] },
];

// Nodes are the stations and the junctions. A line's end node knows the heading that leaves the line there.

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
    for (const O of ROUTES) if (O !== R) for (let u = 0; u <= 1; u += 2 / O.len) {
      const q = O.curve.getPointAt(u), d = Math.hypot(q.x - p.x, q.z - p.z);
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
    if (m.R === n.R) legs.push({ R: n.R, a: n.s, D: ((m.s - n.s) * d % n.R.len + n.R.len) % n.R.len, d });
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
  R.trains = [Array.from({ length: CARS }, () => carriage())];
  for (const m of R.trains[0]) { m.position.set(0, -1e4, 0); m.lookAt(V(0, -1e4, 1)); }
  return R;
}
export const TOURS = (() => {
  const nodes = network();
  return TOURS_DEF.map(d => buildTour(nodes, d) ?? console.warn('tour without a path', d.name)).filter(Boolean);
})();
const trainState = (R, k) => state(R, R.t + k * R.P / R.trains.length);
// The traffic slider's default, 0.3, runs the timetables at their own pace.
// The rider's line holds still while the camera flies in to board.

// On a tour only the tour's train runs. The other trains drop out of sight when it starts and come back when
// it ends, and a tour's train drops out when its tour ends.

let onTour = null;
const hideCar = m => { m.position.set(0, -1e4, 0); m.lookAt(_b.set(0, -1e4, 1)); };
function moveTrains(dt) {
  const tour = ride?.R.tour ? ride.R : null;
  if (tour !== onTour) {
    for (const R of onTour ? [onTour] : RUNS) for (const cars of R.trains) cars.forEach(hideCar);
    onTour = tour;
  }
  for (const R of tour ? [tour] : RUNS) {
    R.t += dt * TRAFFIC.speed / .3 * (ride?.R === R ? (ride.boarding ? 0 : ride.mul) : 1);
    R.trains.forEach((cars, k) => {
      const { c, dir } = trainState(R, k);
      cars.forEach((m, j) => {
        const s = c + dir * (TL / 2 - CAR / 2 - j * CAR);
        at(R, s, _a); at(R, s + dir * 2, _b);
        m.position.copy(_a).y += 2.4; _b.y += 2.4; m.lookAt(_b);
      });
    });
  }
  uploadTrains();
}

// ---------- the ride ----------
// The rider boards train 0 of the station's route. Boarding shifts that route's clock, so the train is
// standing at the station when the camera lands. Only this viewer's city sees the shift.

let ride = null, exit = null, drag = null, shown = '';
export const riding = () => !!(ride || exit);
const NEAR = camera.near;
const setNear = n => { camera.near = n; camera.updateProjectionMatrix(); };

// Tunnels on a route, as [from, to] in metres along it: the portals of each tunnelled lot that sit on the line.

function tunnels(R) {
  const key = TUNNELS[0] ?? null;
  if (R.tunKey === key && R.tun) return R.tun;
  R.tunKey = key; R.tun = [];
  R.samples ??= R.curve.getSpacedPoints(Math.ceil(R.len / 3));
  const n = R.samples.length - 1;
  for (const ps of TUNNELS) {
    const ss = ps.flatMap(p => {
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
// ahead. Each mouth gets a black inset that faces out: from outside it hides the facade's windows, and
// from inside it does not draw. Lamps on the walls show the speed. All of it rebuilds with the city.

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
  for (const p of TUNNELS.flat()) if (p.kind === 'maglev') {
    const m = new THREE.Mesh(INSET, LINING_OUT);
    m.position.set(p.x + p.nx * .12, p.y + 1.3, p.z + p.nz * .12);
    m.rotation.y = Math.atan2(p.nx, p.nz);
    m.scale.set(portalWidth(p.cos, 'maglev'), 9.8, 1);
    linings.add(m);
  }
  lamps.instanceMatrix.needsUpdate = true;
}

// The camera sits just above the lead car's nose. It looks at a clicked place, or else where the rider's
// yaw and pitch turn the view off the heading. The view eases toward that aim, so a change never jumps.

const _d = V(0, 0, 0);
function pose(C, T, dt = 1) {
  const { R } = ride, { c, dir } = trainState(R, 0), s = c + dir * (TL / 2 - .4);
  at(R, s, _a); at(R, s + dir * 5, _b);
  _f.subVectors(_b, _a).setY(0).normalize();
  ride.head = Math.atan2(_f.x, _f.z);
  const Y = ride.head + ride.yaw, P = ride.pitch - .06;
  C.copy(_a).y += 4.4;
  if (ride.focus) _d.subVectors(ride.focus, C).normalize();
  else _d.set(Math.sin(Y) * Math.cos(P), Math.sin(P), Math.cos(Y) * Math.cos(P));
  ride.aim ??= _d.clone();
  ride.aim.lerp(_d, 1 - Math.exp(-dt * 5)).normalize();
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

  const dir = R.closed || st.s < R.len / 2 ? 1 : -1;
  let t0 = 0;
  for (const g of R.segs) { if (g.st === st && g.dir === dir) { t0 += g.T - 1; break; } t0 += g.T; }
  R.t = t0 + .01;
  ride = { R, dir: 0, boarding: true, yaw: 0, pitch: 0, mul: ride?.mul ?? 1, blend: { fromC: camera.position.clone(), fromT: controls.target.clone(), t: 0, dur: 2.4 } };
  controls.enabled = false;
  setNear(.4);
  $('rSpeed').textContent = `${ride.mul}×`;
  $('rFlip').hidden = R.closed;
  document.body.classList.add('focus');
  $('ride').hidden = false;
  showLabels();
  music(R);
}
export function stopRide() {
  if (!ride) return;
  pose(_e, _T);
  const f = _f.clone(), toT = V(_e.x + f.x * 60, Math.max(0, _e.y - 20), _e.z + f.z * 60);
  exit = { fromC: camera.position.clone(), fromT: controls.target.clone(), toT, toC: toT.clone().addScaledVector(f, -240).setY(toT.y + 200), t: 0 };
  ride = null;
  drag = null;
  document.body.classList.remove('focus');
  $('ride').hidden = true;
  showLabels();
  music(null);
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
  pose(_e, _T, dt);
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

// ---------- music ----------
// Each route loops its own track, from podcast/music.py. It fades in on boarding and out on leaving.
// Web Audio loops without the gap an <audio> element leaves. The mute choice persists.

const MUSIC = STANDALONE ? 'audio/ride/' : location.pathname.includes('/spikes/') ? '/static/podcasts/ride/' : '../podcasts/ride/';
const VOL = .5, tracks = new Map();
let actx, gain, playing = null, muted = false;
try { muted = localStorage.getItem('rideMusic') === 'off'; } catch {}
function music(R) {
  actx ??= new AudioContext();
  if (!gain) { gain = actx.createGain(); gain.gain.value = 0; gain.connect(actx.destination); }
  actx.resume();
  const key = R?.music ?? (R?.root ? 'beanstalk-line' : R?.name.toLowerCase().replace(/\s+/g, '-'));
  if (playing?.key === key) return fade();
  const old = playing;
  playing = null;
  if (old) { old.src.stop(actx.currentTime + .8); old.out.gain.setTargetAtTime(0, actx.currentTime, .25); }
  if (!R) return fade();
  if (!tracks.has(key)) tracks.set(key, fetch(`${MUSIC}${key}.mp3`).then(r => r.arrayBuffer()).then(b => actx.decodeAudioData(b)).catch(() => null));
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
  const name = g.st?.name, next = g.D == null
    ? (g.end ? (name ? `${name} station · end of the line` : 'End of the line · turning back') : `${name} station`)
    : g.to.st ? `Next: ${g.to.st.name}` : 'Next: end of the line';
  const txt = `${ride.R.name}|${next}|${here ? `Passing through ${here}` : 'Over open ground'}`;
  if (txt === shown) return;
  shown = txt;
  [$('rLine').textContent, $('rNext').textContent, $('rWhere').textContent] = txt.split('|');
}

$('rExit').onclick = stopRide;
$('rFlip').onclick = () => { if (ride && !ride.R.closed) ride.R.t = END_DWELL - ride.R.t % ride.R.P; };
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
