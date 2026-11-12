// The train map is a full-screen schematic of the maglev lines. It lights one line, marks a station on it and offers
// a ride button to the next station each way. A click on a button starts the ride. Stations, buttons and list rows all
// take the keyboard.

import { linePoints, offsetLine, stationOrder } from './schematic.js';

const G = 40, GAP = 7, BEND = 8;

// A label side is a unit direction from its station and a text anchor.

const LABEL = { n: [0, -1, 'middle'], s: [0, 1, 'middle'], e: [1, 0, 'start'], w: [-1, 0, 'end'],
  ne: [.7, -.7, 'start'], nw: [-.7, -.7, 'end'], se: [.7, .7, 'start'], sw: [-.7, .7, 'end'] };
const esc = s => String(s).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const P = ([x, y]) => [x * G, y * G];
const f = p => p.map(v => v.toFixed(1)).join(' ');
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], len = v => Math.hypot(...v);

// Landmark outlines in px before SIZE scales them. The base sits at y 0 and the shape rises into negative y. A helix
// has two strands and a rung where they stand far apart.

const helix = (h, w, turns) => {
  const x = t => w * Math.sin(t * turns * 2 * Math.PI), n = turns * 4;
  const strand = s => 'M' + Array.from({ length: 41 }, (_, i) => f([s * x(i / 40), -h * i / 40])).join('L');
  const rungs = Array.from({ length: n - 1 }, (_, i) => (i + 1) / n).filter(t => Math.abs(x(t)) > w / 2);
  return strand(1) + strand(-1) + rungs.map(t => `M${f([-x(t), -h * t])}L${f([x(t), -h * t])}`).join('');
};
const ring = (y, r) => `M${-r} ${y}A${r} ${r * .32} 0 0 0 ${r} ${y}`;
const SHAPES = {
  beanstalk: 'M-40 8C-16 6-8-4-6-24H6C8-4 16 6 40 8M-48 8H48M-9-24H9M-7-28H7M-26 8C-12 4-5-6-3-24M26 8C12 4 5-6 3-24M-7-28V-32H7V-28',
  nbn: 'M-12 0V-40H12V0ZM-8-40V-48H8V-40M0-48V-60M-12-10H12M-12-20H12M-12-30H12M-4 0V-40M4 0V-40',
  jinteki: helix(56, 8, 2),
  haas: `M-16 0L0-38L16 0${ring(0, 16)}${ring(-12.7, 10.7)}${ring(-25.3, 5.3)}`,
  weyland: `M-8 0V-52M8 0V-52${ring(0, 8)}M-8-52A8 2.6 0 0 1 8-52A8 2.6 0 0 1-8-52`,
};
const RINGS = { weyland: [-12, -24, -36, -48].map(y => ring(y, 9.5)).join('') };
const SIZE = { beanstalk: 1.2, nbn: 1.1, jinteki: 1.1, haas: 1.3, weyland: 1 };
const SHORT = { 'NBN Headquarters': 'NBN', 'Jinteki HQ': 'Jinteki', 'Haas-Bioroid HQ': 'Haas-Bioroid', 'Weyland HQ': 'Weyland' };

let el, opts, lines, lit, mark;

// Each line gets its drawn points (offset to its side of the bundle), the index of each path entry, its station keys
// and its rounded path with sample points.

function prepare({ schematic: sc }) {
  const nodes = { ...sc.stations, ...sc.bends };
  return Object.entries(sc.lines).map(([name, l]) => {
    const { pts, at } = linePoints(l, nodes);
    const keys = l.path.map(e => e.replace('|', ''));
    const o = offsetLine(pts.map(P), (l.side ?? 0) * GAP / 2), j = keys.indexOf(keys.at(-1));
    if (keys[0] !== keys.at(-1) && j < keys.length - 1) joinEnd(o, at[j]);
    return { name, color: l.color, pts: o, at, keys, closed: keys[0] === keys.at(-1), stops: stationOrder(l, sc.stations).length, ...curve(o) };
  });
}

// A polyline with small round corners, as path data and as points about 1 px apart.

function curve(pts) {
  let d = 'M' + f(pts[0]), at = pts[0];
  const samples = [], line = q => {
    const n = Math.ceil(len(sub(q, at)));
    for (let k = 0; k < n; k++) samples.push([at[0] + (q[0] - at[0]) * k / n, at[1] + (q[1] - at[1]) * k / n]);
    at = q;
  };
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], a = sub(pts[i - 1], p), b = sub(pts[i + 1], p), r = Math.min(BEND, len(a) / 2, len(b) / 2);
    const u = r ? [p[0] + a[0] * r / len(a), p[1] + a[1] * r / len(a)] : p, v = r ? [p[0] + b[0] * r / len(b), p[1] + b[1] * r / len(b)] : p;
    d += `L${f(u)}Q${f(p)} ${f(v)}`;
    line(u);
    for (let k = 0; k < 12; k++) { const t = k / 12, w = 1 - t; samples.push([w * w * u[0] + 2 * w * t * p[0] + t * t * v[0], w * w * u[1] + 2 * w * t * p[1] + t * t * v[1]]); }
    at = v;
  }
  line(pts.at(-1));
  samples.push(at);
  return { d: d + 'L' + f(pts.at(-1)), samples };
}

// An open line that ends on its own earlier track, like a balloon, stops where its last leg meets the drawn track
// at node index k. The leg stretches or shrinks to that point, so it neither overshoots nor falls short.

function joinEnd(o, k) {
  const p = o.at(-2), e = o.at(-1), r0 = sub(e, p), r = [r0[0] * (1 + 2 * GAP / len(r0)), r0[1] * (1 + 2 * GAP / len(r0))];
  const track = curve(o.slice(0, k + 2)).samples;
  let best = Infinity;
  track.slice(1).forEach((s1, i) => {
    const q = track[i], v = sub(s1, q), d = r[0] * v[1] - r[1] * v[0], w = sub(q, p);
    if (!d) return;
    const t = (w[0] * v[1] - w[1] * v[0]) / d, u = (w[0] * r[1] - w[1] * r[0]) / d;
    if (t > .5 && t <= 1 && u >= 0 && u <= 1) best = Math.min(best, t);
  });
  if (best < Infinity) o[o.length - 1] = [p[0] + r[0] * best, p[1] + r[1] * best];
}

// Ride buttons for the marked station. Forward is the next stop in ride order and backward the one before it. A tour
// has forward only, and an open line has none past its ends.

function ridesFor(L) {
  const R = opts.rides.find(r => r.name === L.name), st = opts.schematic.stations;
  const stn = L.keys.map((k, i) => k in st ? i : -1).filter(i => i >= 0), last = stn.at(-1), i = L.keys.indexOf(mark);
  if (!R || i < 0) return [];
  const out = [], pos = stn.indexOf(i);
  const fwd = pos < stn.length - 1 ? stn[pos + 1] : null, back = i === 0 && L.closed ? stn.at(-2) : pos > 0 ? stn[pos - 1] : null;
  const seg = (a, b) => a <= b ? L.pts.slice(a, b + 1) : L.pts.slice(b, a + 1).reverse();
  const add = (dir, from, to, name) => out.push({ dir, name, leg: seg(L.at[from], L.at[to]) });

  // A tour past its last station runs on to the end of its balloon and back up its stem to the next stop.

  if (R.tour) {
    const si = R.stops.findIndex(s => s.name === mark), nx = R.stops[si + 1]?.name;
    if (nx && fwd !== null) add(1, i, fwd, nx);
    else if (nx) {
      const stem = seg(L.at[L.keys.indexOf(L.keys.at(-1))], L.at[L.keys.indexOf(nx)]);
      out.push({ dir: 1, name: nx, leg: [...seg(L.at[i], L.pts.length - 1), ...stem] });
    }
    return out;
  }
  if (fwd !== null) add(1, i, fwd, L.keys[fwd]);
  if (back !== null) add(-1, i === 0 && L.closed ? last : i, back, L.keys[back]);
  return out;
}

// A station on one line is a tick at 90° to its track, pointing to its label. The lit line's ticks glow with it. An
// interchange is a capsule on the 0°, 45°, 90° or 135° axis that keeps the points where its lines pass closest to it.

function station(n, [, , side], L) {
  const spots = lines.flatMap(l => l.keys.flatMap((k, i) => k === n ? [{ l, i: l.at[i] }] : []))
    .filter((s, j, a) => a.findIndex(t => t.l === s.l) === j);
  const ps = spots.map(s => s.l.pts[s.i]), c = [ps.reduce((t, p) => t + p[0], 0) / ps.length, ps.reduce((t, p) => t + p[1], 0) / ps.length];
  const [ux, uy, an] = LABEL[side] ?? LABEL.e, on = spots.some(s => s.l === L), k = (spots.length > 1 ? 12 : 16) + Math.max(...ps.map(p => len(sub(p, c))));
  let mk;
  if (spots.length === 1) {
    const { l, i } = spots[0], p = l.pts[i], q = i + 1 < l.pts.length && len(sub(l.pts[i + 1], p)) > .01 ? l.pts[i + 1] : l.pts[i - 1];
    const t = sub(q, p);
    let nx = -t[1] / len(t), ny = t[0] / len(t);
    if (nx * ux + ny * uy < 0) [nx, ny] = [-nx, -ny];
    const tick = cls => `<path class="${cls}" data-line="${esc(l.name)}" data-name="${esc(n)}" d="M${f(p)}L${f([p[0] + nx * 11, p[1] + ny * 11])}" style="--c:${l.color}"/>`;
    mk = l === L ? tick('tick-glow') + tick('tick on') + tick('tick-core') : tick('tick');
  } else {
    let best;
    for (const [ax, ay] of [[1, 0], [Math.SQRT1_2, Math.SQRT1_2], [0, 1], [-Math.SQRT1_2, Math.SQRT1_2]]) {
      const along = ps.map(p => (p[0] - c[0]) * ax + (p[1] - c[1]) * ay), across = ps.map(p => (p[1] - c[1]) * ax - (p[0] - c[0]) * ay);
      const spread = Math.max(...across) - Math.min(...across), lo = Math.min(...along), hi = Math.max(...along);
      if (!best || spread < best.spread - 1e-6) best = { spread, ends: hi - lo < .5 ? [c, c] : [lo, hi].map(v => [c[0] + ax * v, c[1] + ay * v]) };
    }
    const g = p => p.map(v => v.toFixed(2)).join(' '), [a, b] = best.ends, d = `M${g(a)}L${g(b)}`;
    mk = `<path class="cap-o" d="${d}"/><path class="cap-i" d="${d}"/>`;
  }
  const y = c[1] + uy * k + (uy > 0 ? 9 : uy < 0 ? 0 : 4.5);
  return `<g class="stn${on ? ' on' : ''}${n === mark ? ' mark' : ''}">${mk}
    ${n === mark ? `<circle class="ring" cx="${f([c[0]])}" cy="${f([c[1]])}" r="13"/>` : ''}
    <text x="${f([c[0] + ux * k])}" y="${f([y])}" text-anchor="${an}">${esc(n)}</text>
    ${on ? `<circle class="hit" data-st="${esc(n)}" role="button" tabindex="0" aria-label="${esc(n)}" cx="${f([c[0]])}" cy="${f([c[1]])}" r="14"/>` : ''}</g>`;
}

function landmark({ name, shape, at }) {
  const [x, y] = P(at), d = SHAPES[shape];
  if (!d) return '';
  const label = shape === 'beanstalk' ? '' : `<text y="16" text-anchor="middle">${esc(SHORT[name] ?? name)}</text>`;
  return `<g class="lm" transform="translate(${x} ${y})"><g transform="scale(${SIZE[shape]})"><path d="${d}"/>${RINGS[shape] ? `<path class="rings" d="${RINGS[shape]}"/>` : ''}</g>${label}</g>`;
}

function draw() {
  const sc = opts.schematic, L = lines.find(l => l.name === lit), svg = el.querySelector('svg');
  const rides = L && mark ? ridesFor(L) : [];
  const path = (l, cls) => `<path class="${cls}" data-line="${esc(l.name)}" d="${l.d}" style="--c:${l.color}"/>`;
  el.querySelector('.rows').innerHTML = lines.map(l => `<button class="row${l.name === lit ? ' lit' : ''}" data-line="${esc(l.name)}" style="--c:${l.color}">
    <i></i><span>${esc(l.name)}</span><b>${l.stops}</b></button>`).join('');
  svg.querySelector('.base').innerHTML = `<g class="lms">${(sc.landmarks ?? []).map(landmark).join('')}</g>` +
    lines.filter(l => l !== L).map(l => path(l, 'line')).join('') +
    (L ? path(L, 'glow') + path(L, 'line lit') + path(L, 'core') : '') +
    Object.entries(sc.stations).map(([n, s]) => station(n, s, L)).join('');
  svg.querySelector('.rides').innerHTML = rides.map(a => `<g class="chev" data-dir="${a.dir}"></g>`).join('') +
    rides.map(a => `<g class="ride" role="button" tabindex="0" data-dir="${a.dir}" data-to="${esc(a.name)}" aria-label="Ride ${compass(a.leg)} to ${esc(a.name)}" style="--c:${L.color}">
    <rect class="tap"/><rect class="pill"/><path d="M-7-2H0V-7L8 0 0 7V2H-7Z"/><text dominant-baseline="central">Ride ${compass(a.leg)}</text></g>`).join('');

  // The view fits the drawn map and its labels. The Beanstalk's cable runs on past the top edge.

  const b = svg.querySelector('.base').getBBox(), pad = 28;
  svg.setAttribute('viewBox', [b.x - pad, b.y - pad, b.width + 2 * pad, b.height + 2 * pad].map(v => v.toFixed(1)).join(' '));
  const root = sc.landmarks?.find(l => l.shape === 'beanstalk');
  svg.querySelector('.cable').setAttribute('d', root ? (([x, y]) => `M${x} ${y - 32 * SIZE.beanstalk}V${b.y - 4000}`)(P(root.at)) : '');
  placeRideButtons(svg, rides);
}

// Chevrons every 16 px along a leg, clear of both stations, or one at the middle of a short leg. Each one pulses a
// little later than the one before it, so the light runs the way the train goes. k is SVG units per screen pixel.

function chevrons(leg, k) {
  const segs = leg.slice(1).map((q, i) => ({ p: leg[i], d: sub(q, leg[i]) })), total = segs.reduce((t, g) => t + len(g.d), 0);
  const ts = [];
  for (let t = 10 * k; t < total - 8 * k; t += 16 * k) ts.push(t);
  let i = 0, at = 0;
  return (ts.length ? ts : [total / 2]).map((t, n) => {
    while (at + len(segs[i].d) < t) at += len(segs[i++].d);
    const { p, d } = segs[i], r = (t - at) / len(d);
    return `<path d="M-3-4.5L2 0-3 4.5" style="animation-delay:${(n * .09 - 60).toFixed(2)}s" ` +
      `transform="translate(${f([p[0] + d[0] * r, p[1] + d[1] * r])}) rotate(${(Math.atan2(d[1], d[0]) * 180 / Math.PI).toFixed(1)}) scale(${(1.3 * k).toFixed(3)})"/>`;
  }).join('');
}

// The way a leg leaves its station as a compass word. Screen up is north, and a diagonal reads as its north or south
// part.

const firstStep = leg => sub(leg[leg.findIndex((p, n) => n && len(sub(p, leg[0])) > .01)], leg[0]);
const compass = leg => {
  const [dx, dy] = firstStep(leg);
  return Math.abs(dy) > .3 * Math.hypot(dx, dy) ? (dy < 0 ? 'north' : 'south') : dx > 0 ? 'east' : 'west';
};

// Each ride button sits on its own leg, rideGap px from the marked station's centre along the drawn track, so a pair
// looks even. On a leg shorter than the gap it sits on the next station. The gap is RIDE_GAP px at the map's scale on
// a 1440 by 900 screen. It shrinks with the map on a smaller screen, down to RIDE_FLOOR px, which still clears the
// marked station. Each pill is 34 px tall with 14 px text inside a clear tap target 48 px tall. Its arrow points the
// way the train leaves the station.

export const RIDE_GAP = 128, RIDE_FLOOR = 96;
export const rideGap = svg => {
  const vb = svg.viewBox.baseVal, desk = Math.min(1440 / vb.width, 900 / vb.height);
  return Math.max(RIDE_FLOOR, RIDE_GAP * Math.min(1, svg.getScreenCTM().a / desk));
};
const TAP = 48, PILL = 34, PAD = 14;

// Walks the drawn track S from the sample nearest c, the way leg leaves, for `want` SVG units. It stops early at the
// sample nearest `end`, the next station, so a button never runs past it. A closed line wraps round. An open line that
// ends on its own track, like a balloon, carries on from the junction back along its stem.

function walk(L, S, leg, c, end, want) {
  const N = S.length, d = firstStep(leg), dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const nearest = (p, n = N) => S.slice(0, n).reduce((b, q, k) => len(sub(q, p)) < len(sub(S[b], p)) ? k : b, 0);

  // The walk starts at the sample nearest c and heads the way that best matches the leg's first step. A closed line
  // may also start from its other end, which is the same station.

  const way = ([i, step]) => {
    const v = sub(S[i + 3 * step] ?? S[i], S[i]);
    return len(v) ? dot(v, d) / len(v) : -2;
  };
  const n0 = nearest(c), seam = L.closed && Math.min(len(sub(S[n0], S[0])), len(sub(S[n0], S[N - 1]))) < 8;
  const starts = [[n0, 1], [n0, -1], ...(seam ? [[0, 1], [N - 1, -1]] : [])];
  let [i, step] = starts.reduce((a, b) => way(b) > way(a) ? b : a), t = 0;
  for (;;) {

    // A closed line's two ends are the same station, so the walk steps from one to the other for free.

    if (L.closed && i === N - 1 && step > 0) i = 0;
    else if (L.closed && i === 0 && step < 0) i = N - 1;
    let k = i + step;
    if (k >= N) [k, step] = [nearest(S[N - 1], N - 20), -1];
    if (k < 0) return S[i];
    const e = len(sub(S[i], end));
    if (e < 16 && len(sub(S[k], end)) > e) return S[i];
    const g = len(sub(S[k], S[i]));
    if (t + g >= want) return S[i].map((v, j) => v + (S[k][j] - v) * (want - t) / g);
    t += g;
    i = k;
  }
}

function placeRideButtons(svg, rides) {
  const M = svg.getScreenCTM(), s = M.a, k = 1 / s, L = lines.find(l => l.name === lit), ring = svg.querySelector('.stn.mark .ring'), gap = rideGap(svg);
  const centre = e => [+e.getAttribute('cx'), +e.getAttribute('cy')];

  // The drawn lit track, sampled every half unit, so distances match what the eye sees round the corners.

  const P = svg.querySelector('path.line.lit'), S = Array.from({ length: Math.floor(P.getTotalLength() * 2) + 1 }, (_, i) => {
    const q = P.getPointAtLength(i / 2);
    return [q.x, q.y];
  });
  svg.querySelectorAll('.chev').forEach((g, i) => { g.innerHTML = chevrons(rides[i].leg, k); });
  svg.querySelectorAll('.ride').forEach((g, i) => {
    const [tap, pill, arrow, text] = g.children, d = firstStep(rides[i].leg);
    Object.assign(text.style, { fontSize: `${14 * k}px`, strokeWidth: `${2 * k}px` });
    const w = 2 * PAD + 24 + text.getBBox().width * s;
    const set = (e, h) => Object.entries({ x: -w / 2, y: -h / 2, width: w, height: h, rx: h / 2 }).forEach(([a, v]) => e.setAttribute(a, (v * k).toFixed(2)));
    set(tap, TAP);
    set(pill, PILL);
    text.setAttribute('x', ((-w / 2 + PAD + 24) * k).toFixed(2));
    arrow.setAttribute('transform', `translate(${f([(-w / 2 + PAD + 8) * k, 0])}) rotate(${(Math.atan2(d[1], d[0]) * 180 / Math.PI).toFixed(1)}) scale(${k.toFixed(3)})`);
    g.setAttribute('transform', `translate(${f(walk(L, S, rides[i].leg, centre(ring), centre(svg.querySelector(`.hit[data-st="${CSS.escape(rides[i].name)}"]`)), gap * k))})`);
  });
}

function build() {
  el = document.createElement('div');
  el.id = 'trainmap';
  el.hidden = true;
  el.innerHTML = `<svg role="img" aria-label="Maglev lines"><defs>
      <filter id="tmGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
      <pattern id="tmDots" width="${G}" height="${G}" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="1.1"/></pattern>
    </defs><rect class="dots" x="-4000" y="-4000" width="8000" height="8000"/><path class="cable"/><g class="base"></g><g class="rides"></g></svg>
    <div class="side panel"><div class="rows"></div></div><button class="x" aria-label="Close">✕</button>
    <div class="title"><span class="kicker">Maglev</span><b>Network map</b><small>Pick a line, then a station</small></div>`;
  document.body.append(el);
  el.onclick = e => {
    const t = e.target, row = t.closest('.row, path.line'), st = t.closest('[data-st]'), ar = t.closest('.ride');
    if (t.closest('.x')) return opts.onClose();
    if (ar) {
      const R = opts.rides.find(r => r.name === lit);
      return opts.onRide(R.stops.find(s => s.name === mark), +ar.dataset.dir);
    }

    // A tap on the lit row opens or folds the list on a phone. A pick folds it.

    el.querySelector('.side').classList.toggle('open', !!row?.matches('.row.lit') && !el.querySelector('.side.open'));
    if (row) { lit = row.dataset.line; mark = null; }
    else if (st) mark = st.dataset.st;
    else if (t.closest('.stn')) return;
    else mark = null;
    redraw();
  };
  el.onkeydown = e => {
    const k = e.target.closest?.('.ride, .hit');
    if (!k || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    k.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !el.hidden) opts.onClose(); });

  // The ride buttons are sized in screen pixels, so a resize or a turned phone redraws the open map once per frame.

  let frame;
  addEventListener('resize', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => el.hidden || redraw());
  });
}

// A redraw replaces the focused hit target, row or ride button, so focus moves to its new copy.

function redraw() {
  const had = el.contains(document.activeElement) && document.activeElement;
  draw();
  if (!had) return;
  const sel = had.matches('.hit') ? `.hit[data-st="${CSS.escape(had.dataset.st)}"]` : had.matches('.row') ? `.row[data-line="${CSS.escape(had.dataset.line)}"]`
    : had.matches('.ride') ? `.ride[data-dir="${had.dataset.dir}"]` : null;
  if (sel) el.querySelector(sel)?.focus();
}

// Opens with the Grand Loop lit and nothing marked. The map must show before draw() measures it.

export function openTrainMap(o) {
  opts = o;
  if (!el) build();
  lines = prepare(o);
  lit = lines.find(l => l.name === 'Grand Loop') ? 'Grand Loop' : lines[0]?.name;
  mark = null;
  el.querySelector('.side').classList.remove('open');
  el.hidden = false;
  draw();
  el.querySelector('.row.lit')?.focus();
}

export const closeTrainMap = () => { if (el) el.hidden = true; };
