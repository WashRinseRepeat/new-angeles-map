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
const toScreen = M => ([x, y]) => ({ x: M.a * x + M.c * y + M.e, y: M.b * x + M.d * y + M.f });

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
// and its rounded path with sample points. The track holds points every 3 units along the path and the fine track
// every half unit, so the overlap tests and the ride buttons read no SVG geometry.

function prepare({ schematic: sc }) {
  const nodes = { ...sc.stations, ...sc.bends };
  return Object.entries(sc.lines).map(([name, l]) => {
    const { pts, at } = linePoints(l, nodes);
    const keys = l.path.map(e => e.replace('|', ''));
    const o = offsetLine(pts.map(P), (l.side ?? 0) * GAP / 2), j = keys.indexOf(keys.at(-1));
    if (keys[0] !== keys.at(-1) && j < keys.length - 1) joinEnd(o, at[j]);
    const c = curve(o);
    return { name, color: l.color, pts: o, at, keys, closed: keys[0] === keys.at(-1), stops: stationOrder(l, sc.stations).length, ...c,
      track: along(c.samples, 3), fine: along(c.samples, .5) };
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

// Points every step units along a polyline, from its start.

function along(S, step) {
  const out = [S[0]];
  let need = step;
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1], g = len(sub(S[i], a));
    let t = 0;
    while (g - t >= need) { t += need; need = step; out.push([a[0] + (S[i][0] - a[0]) * t / g, a[1] + (S[i][1] - a[1]) * t / g]); }
    need -= g - t;
  }
  return out;
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

// The lines that stop at station n, each once, with the index of its drawn point.

const spotsAt = n => lines.flatMap(l => l.keys.flatMap((k, i) => k === n ? [{ l, i: l.at[i] }] : []))
  .filter((s, j, a) => a.findIndex(t => t.l === s.l) === j);

// A station on one line is a tick at 90° to its track, pointing to its label. It is drawn with its line, so it shares
// the line's stroke, glow and core.

function tickAt(n, [, , side]) {
  const sp = spotsAt(n);
  if (sp.length !== 1) return null;
  const { l, i } = sp[0], p = l.pts[i], q = i + 1 < l.pts.length && len(sub(l.pts[i + 1], p)) > .01 ? l.pts[i + 1] : l.pts[i - 1];
  const [ux, uy] = LABEL[side] ?? LABEL.e, t = sub(q, p);
  let nx = -t[1] / len(t), ny = t[0] / len(t);
  if (nx * ux + ny * uy < 0) [nx, ny] = [-nx, -ny];
  return { l, n, d: `M${f(p)}L${f([p[0] + nx * 11, p[1] + ny * 11])}` };
}

// An interchange is a capsule on the 0°, 45°, 90° or 135° axis. It spans the points where its lines stop and covers
// every stretch of those lines within CAP_R units of the station, with half the lit line's width and a margin. The
// samples run 1 unit past CAP_R, since they sit about 1 unit apart. The axis that needs the thinnest capsule wins.

const CAP_R = 6, CAP_MIN = 7;
const toSeg = (p, a, b) => {
  const v = sub(b, a), l2 = v[0] ** 2 + v[1] ** 2, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / l2)) : 0;
  return len(sub(p, [a[0] + v[0] * t, a[1] + v[1] * t]));
};

function capsule(spots, ps, c, o) {
  const q = [...ps, ...spots.flatMap(({ l }) => l.samples.filter(s => len(sub(s, o)) <= CAP_R + 1))];
  let best;
  for (const [ax, ay] of [[1, 0], [Math.SQRT1_2, Math.SQRT1_2], [0, 1], [-Math.SQRT1_2, Math.SQRT1_2]]) {
    const along = ps.map(p => (p[0] - c[0]) * ax + (p[1] - c[1]) * ay), lo = Math.min(...along), hi = Math.max(...along);
    const ends = hi - lo < .5 ? [c, c] : [lo, hi].map(v => [c[0] + ax * v, c[1] + ay * v]);
    const r = Math.max(CAP_MIN, Math.max(...q.map(p => toSeg(p, ...ends))) + 3.25 + 1);
    if (!best || r < best.r - 1e-6 || r < best.r + 1e-6 && hi - lo < best.span) best = { r, ends, span: hi - lo };
  }
  return best;
}

// A label k units from its station centre c, on the given side. The baseline drops so the text centres on its side.

const labelPos = (c, k, side) => {
  const [ux, uy, an] = LABEL[side] ?? LABEL.e;
  return { x: f([c[0] + ux * k]), y: f([c[1] + uy * k + (uy > 0 ? 9 : uy < 0 ? 0 : 4.5)]), an };
};

// A station's marker, label, mark ring and hit target. Stations of the lit line carry the cue class. Their label sits
// in an oval with a tap target, which placeOvals() sizes once the label has its final spot.

function station(n, s, L) {
  const spots = spotsAt(n), ps = spots.map(s => s.l.pts[s.i]);
  const c = [ps.reduce((t, p) => t + p[0], 0) / ps.length, ps.reduce((t, p) => t + p[1], 0) / ps.length];
  const on = spots.some(s => s.l === L), far = Math.max(...ps.map(p => len(sub(p, c))));
  let mk = '', r = 0;
  if (spots.length > 1) {
    const cap = capsule(spots, ps, c, P(s)), g = p => p.map(v => v.toFixed(2)).join(' '), [a, b] = cap.ends, d = `M${g(a)}L${g(b)}`;
    r = cap.r;
    mk = `<path class="cap-o" d="${d}" style="stroke-width:${(2 * r).toFixed(2)}px"/><path class="cap-i" d="${d}" style="stroke-width:${(2 * r - 4.5).toFixed(2)}px"/>`;
  }
  const k = (r ? r + 5 : 16) + far, lp = labelPos(c, k, s[2]), at = `cx="${f([c[0]])}" cy="${f([c[1]])}"`;
  return `<g class="stn${on ? ' on cue' : ''}${n === mark ? ' mark' : ''}">${mk}
    ${n === mark ? `<circle class="ring" ${at} r="${Math.max(13, r + 5).toFixed(1)}"/>` : ''}
    ${on ? '<rect class="oval"/>' : ''}<text x="${lp.x}" y="${lp.y}" text-anchor="${lp.an}" data-c="${f(c)}" data-k="${k.toFixed(1)}" data-side="${s[2]}">${esc(n)}</text>${on ? `<rect class="ltap" data-st="${esc(n)}"/>` : ''}
    ${on ? `<circle class="hit" data-st="${esc(n)}" role="button" tabindex="0" aria-label="${esc(n)}" ${at} r="${Math.max(14, r + 6).toFixed(1)}"/>` : ''}</g>`;
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
  const ticks = Object.entries(sc.stations).map(([n, s]) => tickAt(n, s)).filter(Boolean);

  // A line and its ticks share one group. A dim line's opacity sits on the group, so a tick never brightens where it
  // meets its track. The lit line's glow and core run on through its ticks.

  const group = l => {
    const a = `data-line="${esc(l.name)}"`, own = ticks.filter(t => t.l === l), td = own.map(t => t.d).join('');
    const tk = own.map(t => `<path class="tick" ${a} data-name="${esc(t.n)}" d="${t.d}"/>`).join('');
    return `<g class="ln${l === L ? ' lit' : ''}" ${a} style="--c:${l.color}">` + (l === L
      ? `<path class="glow" ${a} d="${l.d}${td}"/><path class="line lit" ${a} d="${l.d}"/>${tk}<path class="core" ${a} d="${l.d}${td}"/>`
      : `<path class="line" ${a} d="${l.d}"/>${tk}`) + '</g>';
  };
  el.querySelector('.rows').innerHTML = lines.map(l => `<button class="row${l.name === lit ? ' lit' : ''}" data-line="${esc(l.name)}" style="--c:${l.color}">
    <i></i><span>${esc(l.name)}</span><b>${l.stops}</b></button>`).join('');
  svg.querySelector('.base').innerHTML = `<g class="lms">${(sc.landmarks ?? []).map(landmark).join('')}</g>` +
    lines.filter(l => l !== L).map(group).join('') + (L ? group(L) : '') +
    Object.entries(sc.stations).map(([n, s]) => station(n, s, L)).join('');
  svg.querySelector('.rides').innerHTML = rides.map(a => `<g class="chev" data-dir="${a.dir}"></g>`).join('') +
    rides.map(a => `<g class="ride" role="button" tabindex="0" data-dir="${a.dir}" data-to="${esc(a.name)}" aria-label="Ride ${compass(a.leg)} to ${esc(a.name)}" style="--c:${L.color}">
    <rect class="tap"/><rect class="pill"/><path d="M-7-2H0V-7L8 0 0 7V2H-7Z"/><text dominant-baseline="central">Ride ${compass(a.leg)}</text></g>`).join('');

  // The view fits the drawn map and its labels. The Beanstalk's cable runs on past the top edge.

  const b = svg.querySelector('.base').getBBox();
  fit(svg, b);
  const root = sc.landmarks?.find(l => l.shape === 'beanstalk');
  svg.querySelector('.cable').setAttribute('d', root ? (([x, y]) => `M${x} ${y - 32 * SIZE.beanstalk}V${b.y - 4000}`)(P(root.at)) : '');
  placeRideButtons(svg, rides);
  dodgePills(svg);
  placeOvals(svg);
}

// Each lit-line label sits in a soft oval, padded in screen pixels round its text. The padding shrinks where the oval
// would meet a ride pill or another label. A hidden label has no oval. A clear tap target 46 px tall and wide or more
// covers the oval, so a tap on the name marks the station.

function placeOvals(svg) {
  const k = 1 / svg.getScreenCTM().a, pills = [...svg.querySelectorAll('.ride .pill')].map(p => p.getBoundingClientRect());
  const texts = [...svg.querySelectorAll('.base text')], meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const set = (e, x, y, w, h, rx) => Object.entries({ x, y, width: w, height: h, rx }).forEach(([a, v]) => e.setAttribute(a, v.toFixed(2)));
  for (const g of svg.querySelectorAll('.stn.cue')) {
    const [o, t, tap] = ['.oval', 'text', '.ltap'].map(q => g.querySelector(q));
    if (t.style.visibility) { o.remove(); tap.remove(); continue; }
    const b = t.getBBox(), r = t.getBoundingClientRect(), near = [...pills, ...texts.filter(x => x !== t && !x.style.visibility).map(x => x.getBoundingClientRect())];
    const [px, py] = [[8, 4], [5, 3], [2, 1.5]].find(([px, py]) => !near.some(z => meets({ left: r.left - px, right: r.right + px, top: r.top - py, bottom: r.bottom + py }, z))) ?? [0, 0];
    const w = b.width + 2 * px * k, h = b.height + 2 * py * k, tw = Math.max(w, 46 * k), th = Math.max(h, 46 * k);
    set(o, b.x - px * k, b.y - py * k, w, h, h / 2);
    set(tap, b.x + b.width / 2 - tw / 2, b.y + b.height / 2 - th / 2, tw, th, 0);
  }
}

// The map fits the whole screen with a 28 unit margin. If a track or label would then touch the title block or the
// folded line list, the map fits into the free area beside or below them that keeps the largest scale instead. The
// list's folded box is kept while it is open on a phone, so opening it does not shrink the map. Each open measures
// it afresh, since the map always opens with the list folded.

let sideBox;
function fit(svg, b) {
  const pad = 28, w = b.width + 2 * pad, h = b.height + 2 * pad, { width: W, height: H } = svg.getBoundingClientRect(), m = 8;
  const scale = r => Math.min(r.w / w, r.h / h), put = r => {
    const s = scale(r), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    svg.setAttribute('viewBox', [cx - (r.x + r.w / 2) / s, cy - (r.y + r.h / 2) / s, W / s, H / s].map(v => v.toFixed(1)).join(' '));
  };
  svg.dataset.fit = `${w.toFixed(1)} ${h.toFixed(1)}`;
  put({ x: 0, y: 0, w: W, h: H });
  const side = el.querySelector('.side');
  if (!side.classList.contains('open') || !sideBox) sideBox = side.getBoundingClientRect();
  const t = el.querySelector('.title').getBoundingClientRect(), l = sideBox;
  if (!touches(svg, [t, l])) return;
  const top = Math.max(t.bottom, l.bottom) + m, left = t.right + m, right = l.left - m;
  const free = [{ x: 0, y: top, w: W, h: H - top }, { x: left, y: 0, w: right - left, h: H },
    { x: 0, y: t.bottom + m, w: right, h: H - t.bottom - m }, { x: left, y: l.bottom + m, w: W - left, h: H - l.bottom - m }];
  put(free.filter(r => r.w > 0 && r.h > 0).reduce((a, r) => scale(r) > scale(a) ? r : a));
}

// Whether a drawn track or a label comes within 4 px of any of the screen boxes.

function touches(svg, boxes) {
  const M = svg.getScreenCTM(), near = (q, r = 0) => boxes.some(o => q.x > o.left - 4 - r && q.x < o.right + 4 + r && q.y > o.top - 4 - r && q.y < o.bottom + 4 + r);
  const meets = a => boxes.some(o => a.left < o.right + 4 && o.left - 4 < a.right && a.top < o.bottom + 4 && o.top - 4 < a.bottom);
  if ([...svg.querySelectorAll('.base text')].some(e => meets(e.getBoundingClientRect()))) return true;
  return [...svg.querySelectorAll('.ln path.line')].some(p => {
    const r = parseFloat(getComputedStyle(p).strokeWidth) / 2 * M.a;
    return lines.find(l => l.name === p.dataset.line).track.map(toScreen(M)).some(q => near(q, r));
  });
}

// A station label that a ride pill covers moves to the side of its station with the least overlap with pills, lines
// and other labels. Each side is tried at its usual distance and 14 units further out, and pills weigh most. A label
// that no spot can clear hides. draw() rebuilds every label, so each label
// is back on its own side once the buttons go away.

function dodgePills(svg) {
  const pills = [...svg.querySelectorAll('.ride .pill')].map(p => p.getBoundingClientRect());
  if (!pills.length) return;
  const M = svg.getScreenCTM(), area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const texts = [...svg.querySelectorAll('.base text')], track = lines.flatMap(l => l.track.map(toScreen(M)));
  const cost = t => {
    const b = t.getBoundingClientRect(), pad = { left: b.left - 3, right: b.right + 3, top: b.top - 3, bottom: b.bottom + 3 };
    const hit = pills.reduce((s, p) => s + area(b, p), 0);
    return { hit, score: hit * 1000 + (+t.getAttribute('data-out') || 0) + track.filter(q => q.x > pad.left && q.x < pad.right && q.y > pad.top && q.y < pad.bottom).length * 50 +
      texts.reduce((s, o) => o === t || o.style.visibility ? s : s + area(b, o.getBoundingClientRect()), 0) };
  };
  for (const t of svg.querySelectorAll('.stn text')) {
    if (!cost(t).hit) continue;
    const c = t.dataset.c.split(' ').map(Number), k = +t.dataset.k, put = ([side, out]) => {
      const { x, y, an } = labelPos(c, k + out, side);
      Object.entries({ x, y, 'text-anchor': an, 'data-out': out }).forEach(([a, v]) => t.setAttribute(a, v));
    };
    const spots = [0, 14].flatMap(out => [t.dataset.side, ...Object.keys(LABEL)].map(side => [side, out]));
    const best = spots.map(sp => (put(sp), { sp, ...cost(t) })).reduce((a, b) => b.score < a.score ? b : a);
    put(best.sp);
    if (best.hit) t.style.visibility = 'hidden';
  }
}

// Chevrons every 16 px along a leg, clear of both stations, or one at the middle of a short leg. They start outside
// the mark ring of radius r0. Each one pulses a little later than the one before it, so the light runs the way the
// train goes. k is SVG units per screen pixel.

function chevrons(leg, k, r0) {
  const segs = leg.slice(1).map((q, i) => ({ p: leg[i], d: sub(q, leg[i]) })), total = segs.reduce((t, g) => t + len(g.d), 0);
  const ts = [];
  for (let t = Math.max(10 * k, r0 + 4 * k); t < total - 8 * k; t += 16 * k) ts.push(t);
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
  const [w, h] = svg.dataset.fit.split(' ').map(Number), desk = Math.min(1440 / w, 900 / h);
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

  const S = L.fine;
  svg.querySelectorAll('.chev').forEach((g, i) => { g.innerHTML = chevrons(rides[i].leg, k, +ring.getAttribute('r')); });
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
    <div class="title"><span class="kicker">Maglev</span><b>Network map</b><small class="hint">Pick a line, then a station, then a direction</small></div>`;
  document.body.append(el);
  el.onclick = e => {
    const t = e.target, row = t.closest('.row, .ln'), st = t.closest('[data-st]'), ar = t.closest('.ride');
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

// Opens with the Grand Loop lit and The Beanstalk marked, so its ride buttons show at once. The map must show before
// draw() measures it.

export function openTrainMap(o) {
  opts = o;
  if (!el) build();
  lines = prepare(o);
  lit = lines.find(l => l.name === 'Grand Loop') ? 'Grand Loop' : lines[0]?.name;
  mark = lines.find(l => l.name === lit)?.keys.includes('The Beanstalk') ? 'The Beanstalk' : null;
  el.querySelector('.side').classList.remove('open');
  sideBox = null;
  el.hidden = false;
  draw();
  el.querySelector('.row.lit')?.focus();
}

export const closeTrainMap = () => { if (el) el.hidden = true; };
