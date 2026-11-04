// Maglev, highways, street and sky traffic, and the group that holds the central landmark.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { S } from './state.js';
import { CENTRE, CENTRE_PLACE, CITY, lerp, mapToWorld, rng, sdPoly, smooth, styleAt } from './core.js';
import { SETTING } from './setting.js';
import { edgeAt } from './edge.js';
import { RELIEF, groundAt } from './relief.js';
import { QUALITY, U, camera, scene, shadowUniforms } from './render.js';
import { _c, beam, glow, prop, yawAt } from './instances.js';

// ---------- elevated highways: they clear a canyon and carry streams of light ----------

// The traced highways come in pieces. A road that runs within 70 m of a longer one for most of its length is a
// double and drops out. Two ends within 70 m that face each other join into one road, best-aligned pair first,
// so a star of ends becomes through roads. A road shorter than 500 m with no end on another road drops out.
// Roads that cross take decks at least 10 m apart, longest road first.

const segDist = ([px, pz], [ax, az], [bx, bz]) => {
  const ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / (ex * ex + ez * ez || 1)));
  return Math.hypot(px - ax - ex * t, pz - az - ez * t);
};
const lineDist = (p, pts) => { let d = Infinity; for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(p, pts[i - 1], pts[i])); return d; };
const lenOf = pts => pts.reduce((s, p, i) => s + (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
const endOf = (pts, e) => e ? pts[pts.length - 1] : pts[0];
const outOf = (pts, e) => {
  const [a, b] = e ? [pts[pts.length - 2], pts[pts.length - 1]] : [pts[1], pts[0]], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
};
const crossAt = (a, b, c, d) => {
  const rx = b[0] - a[0], rz = b[1] - a[1], sx = d[0] - c[0], sz = d[1] - c[1], den = rx * sz - rz * sx;
  if (!den) return null;
  const t = ((c[0] - a[0]) * sz - (c[1] - a[1]) * sx) / den, u = ((c[0] - a[0]) * rz - (c[1] - a[1]) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * rx, a[1] + t * rz] : null;
};

let roads = (CITY.highways ?? []).map(h => ({ y: h.y, pts: h.pts.map(p => [...p]) }));
const halves = pts => pts.flatMap((p, i) => i ? [[(p[0] + pts[i - 1][0]) / 2, (p[1] + pts[i - 1][1]) / 2], p] : [p]);
roads = roads.filter(r => {
  const s = halves(r.pts), L = lenOf(r.pts);
  return !roads.some(o => o !== r && lenOf(o.pts) > L && s.filter(p => lineDist(p, o.pts) < 70).length > s.length * .7);
});
for (let best; ; ) {
  best = null;
  for (let i = 0; i < roads.length; i++) for (let j = i + 1; j < roads.length; j++) for (const ei of [0, 1]) for (const ej of [0, 1]) {
    const A = roads[i].pts, B = roads[j].pts, a = endOf(A, ei), b = endOf(B, ej), oa = outOf(A, ei), ob = outOf(B, ej);
    const dot = oa[0] * ob[0] + oa[1] * ob[1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 70 && dot < -.3 && (!best || dot < best.dot)) best = { i, j, ei, ej, dot };
  }
  if (!best) break;
  const { i, j, ei, ej } = best, A = ei ? roads[i].pts : [...roads[i].pts].reverse(), B = ej ? [...roads[j].pts].reverse() : roads[j].pts;
  roads[i] = { y: Math.max(roads[i].y, roads[j].y), pts: [...A, ...B.slice(1)] };
  roads.splice(j, 1);
}
const onOther = (r, p) => roads.some(o => o !== r && lineDist(p, o.pts) < 40);
roads = roads.filter(r => lenOf(r.pts) >= 500 || onOther(r, r.pts[0]) || onOther(r, r.pts[r.pts.length - 1]));
roads.sort((a, b) => lenOf(b.pts) - lenOf(a.pts));
const nearEnd = (p, pts) => [pts[0], pts[pts.length - 1]].some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 80);
roads.forEach((r, k) => {
  const above = [];
  for (const o of roads.slice(0, k)) for (let a = 1; a < r.pts.length; a++) for (let b = 1; b < o.pts.length; b++) {
    const x = crossAt(r.pts[a - 1], r.pts[a], o.pts[b - 1], o.pts[b]);
    if (x && !nearEnd(x, r.pts) && !nearEnd(x, o.pts)) above.push(o.y);
  }
  r.y = [r.y, 26, 38, 50, 62].find(y => above.every(o => Math.abs(o - y) >= 10));
});

export const HIGHWAYS = roads.map(h => {
  const path = new THREE.CatmullRomCurve3(h.pts.map(([x, z]) => new THREE.Vector3(x, h.y, z))).getSpacedPoints(500);
  return { ...h, path, side: sides(path, false) };
});

// Open ends ramp down to street level over 180 m. An end that meets another highway eases to that highway's
// deck over 150 m. Ends that reach the centre's road terminals stay up.

for (const h of HIGHWAYS) {
  const P = h.path, cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + P[i].distanceTo(P[i - 1]));
  const total = cum[cum.length - 1];
  const reach = SETTING.centre.highwayReach;
  const meets = p => HIGHWAYS.find(o => o !== h && o.path.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 40));
  const atCentre = p => Math.hypot(p.x - CENTRE.x, p.z - CENTRE.y) < reach;
  const ends = [P[0], P[P.length - 1]].map(p => ({ centre: atCentre(p), joins: meets(p) }));
  P.forEach((p, i) => {
    let y = h.y;
    for (const [e, d] of [[ends[0], cum[i]], [ends[1], total - cum[i]]]) {
      if (e.joins) y = lerp(e.joins.y, y, smooth(0, 150, d));
      else if (!e.centre) y *= smooth(0, 180, d);
    }
    p.y = y + .3;
  });
}
// ---------- maglev: guideway height follows the style weight ----------
// Where the maglev crosses a highway its deck rises to 10 m above the highway's deck, on an 8% grade each side.

const HW_PTS = HIGHWAYS.flatMap(h => h.path.filter((_, k) => k % 2 === 0));
function clearHighways(path, closed) {
  const n = path.length, ds = path[0].distanceTo(path[1]), ys = path.map(p => {
    let y = 0;
    for (const q of HW_PTS) if (q.y > 5 && Math.abs(q.x - p.x) < 16 && Math.abs(q.z - p.z) < 16 && Math.hypot(q.x - p.x, q.z - p.z) < 16) y = Math.max(y, q.y + 10);
    return y;
  });
  for (let pass = 0; pass < (closed ? 2 : 1); pass++) for (const dir of [1, -1]) for (let k = 1; k < n; k++) {
    const i = dir > 0 ? k : n - 1 - k, j = closed ? (i - dir + n) % n : i - dir;
    if (j >= 0 && j < n) ys[i] = Math.max(ys[i], ys[j] - .08 * ds);
  }
  path.forEach((p, i) => { p.y = Math.max(p.y, ys[i]); });
}

// A city without a maglev loop has an empty loop path and no loop track. Spurs, rings and lines still lay.

export const HAS_LOOP = (CITY.maglev?.length ?? 0) >= 3;
export const flat = HAS_LOOP ? new THREE.CatmullRomCurve3(CITY.maglev.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal') : null;
export const pts = HAS_LOOP ? flat.getSpacedPoints(1000).slice(0, -1) : [];
const MAGLEV = SETTING.transport.maglev;
export let ys = pts.map(p => lerp(...MAGLEV.height, styleAt(p.x, p.z, 200).w));
for (let pass = 0; pass < 3; pass++) ys = ys.map((_, i) => {
  let s = 0;
  for (let k = -30; k <= 30; k++) s += ys[(i + k + ys.length) % ys.length];
  return s / 61;
});
pts.forEach((p, i) => { p.y = ys[i]; });
if (HAS_LOOP) clearHighways(pts, true);
export const track = HAS_LOOP ? new THREE.CatmullRomCurve3(pts, true) : null;
if (track) track.arcLengthDivisions = 4000;

// Maglev spurs run from the centre plaza's edge down to the loop. Lines carry the maglev on outward at a
// fixed height. An end on the loop or on an earlier line or ring takes that track's height, so the joints meet.

pts.closed = true;
const laid = [pts], G = .08;
const flat2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const flatAt = (P, i) => P.closed ? P[(i % P.length + P.length) % P.length] : P[Math.max(0, Math.min(P.length - 1, i))];
const nearestOn = (P, p) => { let k = 0, d = Infinity; P.forEach((q, i) => { const e = flat2(q, p); if (e < d) { d = e; k = i; } }); return { k, d }; };
const joined = p => { for (const P of laid) { const { k, d } = nearestOn(P, p); if (d < 12) return { P, k }; } return null; };

// How far a point on a line, s metres along, lies from the tracks its ends merge onto.

const clearOf = (R, s) => Math.min(Infinity, ...(R.path.into ?? []).filter(Boolean).map(T => nearestOn(T, R.curve.getPointAt(Math.min(1, Math.max(0, s / R.len)))).d));

// A line that ends on another track at an angle swings onto it on a 220 m radius arc, tangent to both, so it
// stays on its own side of that track and lands running along it. A line that ends on another line's end runs on
// from it with no arc. Returns the path and the track it joins.

const mergeTail = path => {
  const e = path.at(-1), J = joined(e);
  if (!J) return [path, null];
  if (!J.P.closed && (J.k === 0 || J.k === J.P.length - 1)) return [path, J.P];
  const { P, k } = J, hE = new THREE.Vector3().subVectors(e, path.at(-6)).setY(0).normalize();
  const t = new THREE.Vector3().subVectors(flatAt(P, k + 1), flatAt(P, k - 1)).setY(0).normalize(), dir = t.dot(hE) < 0 ? -1 : 1;
  const th = Math.acos(Math.min(1, Math.abs(t.dot(hE)))), T = Math.max(40, 220 * Math.tan(th / 2));
  const back = path.findLastIndex(p => flat2(p, e) > T), S = path[back];
  let j = k;
  for (let run = 0; run < T && (P.closed || (j + dir >= 0 && j + dir < P.length)); j += dir) run += flat2(flatAt(P, j), flatAt(P, j + dir));
  const M = flatAt(P, j).clone().setY(0), hS = new THREE.Vector3().subVectors(path[back + 1], path[back - 1]).setY(0).normalize();

  // The arc fits the real ends: the line's heading at S, the track's heading where it lands, and the chord.

  const tM = new THREE.Vector3().subVectors(flatAt(P, j + 1), flatAt(P, j - 1)).setY(0).normalize().multiplyScalar(dir);
  const a = Math.acos(Math.max(-1, Math.min(1, hS.dot(tM)))), ch = flat2(S, M);
  const c = a < .01 ? ch / 3 : 4 / 3 * Math.tan(a / 4) * ch / (2 * Math.sin(a / 2));
  const tail = new THREE.CubicBezierCurve3(S, S.clone().addScaledVector(hS, c), M.clone().addScaledVector(tM, -c), M).getPoints(40);
  return [new THREE.CatmullRomCurve3([...path.slice(0, back), ...tail], false, 'centripetal').getSpacedPoints(240), P];
};
export const openTrack = (l, y0, y1) => {
  const raw = new THREE.CatmullRomCurve3(l.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal').getSpacedPoints(240);
  const [p1, into1] = mergeTail(raw), [p0, into0] = mergeTail(p1.reverse()), path = p0.reverse();
  const J0 = joined(path[0]), J1 = joined(path.at(-1));
  y0 = J0 ? J0.P[J0.k].y : y0; y1 = J1 ? J1.P[J1.k].y : y1;
  path.forEach((p, i) => { p.y = lerp(y0, y1, smooth(0, 1, i / (path.length - 1))); });
  clearHighways(path, false);
  path.into = [into0, into1];
  laid.push(path);
  const curve = new THREE.CatmullRomCurve3(path);
  return { path, curve, len: curve.getLength() };
};

// A ring is a closed line at a fixed height. Rings lay before lines, so a line that ends on a ring takes its height.

const ringTrack = l => {
  const path = new THREE.CatmullRomCurve3(l.map(([x, z]) => new THREE.Vector3(x, MAGLEV.ring, z)), true, 'centripetal').getSpacedPoints(400).slice(0, -1);
  clearHighways(path, true);
  path.closed = true;
  laid.push(path);
  const curve = new THREE.CatmullRomCurve3(path, true);
  curve.arcLengthDivisions = 2000;
  return { path, curve, len: curve.getLength(), closed: true };
};
export const SPURS = [...(CITY.spurs ?? []).map(l => openTrack(l, ...MAGLEV.spur)), ...(CITY.rings ?? []).map(ringTrack),
  ...(CITY.lines ?? []).map(l => openTrack(l, MAGLEV.line, MAGLEV.line))];

// A merging end and the track it joins run level along the 130 m merge ramp, and as long before it as the
// decks pass within 22 m. Each ramp point takes the higher of the two decks: the joined track eases up to it
// on an 8% grade, and the line eases into the ramp's start. A lift can disturb an earlier joint, so the
// pass repeats until nothing moves.

const lift = (T, k, y) => {
  const ds = flat2(T[0], T[1]), n = T.length;
  T.forEach((q, j) => { const off = T.closed ? Math.min(Math.abs(j - k), n - Math.abs(j - k)) : Math.abs(j - k); q.y = Math.max(q.y, y - G * ds * off); });
};
const level = (P, T, rev) => {
  const N = P.length, at = i => P[rev ? N - 1 - i : i], ds = flat2(P[0], P[1]);
  let r = N - 1;
  for (let run = 0; r > 0 && (run < 130 || nearestOn(T, at(r)).d < 22); r--) run += flat2(at(r), at(r - 1));
  const ks = [];
  for (let i = r; i < N; i++) ks[i] = nearestOn(T, at(i)).k;

  // The ramp start must be high enough for the line above it to come down at 8%.

  let need = 0;
  for (let i = 0; i < r; i++) need = Math.max(need, at(i).y - G * ds * (r - i));
  lift(T, ks[r], need);
  for (let i = r; i < N; i++) lift(T, ks[i], at(i).y);
  for (let i = r; i < N; i++) at(i).y = T[ks[i]].y;
  for (let i = r - 1; i >= 0; i--) at(i).y = Math.max(at(i).y, at(i + 1).y - G * ds);
};
for (let pass = 0; pass < 4; pass++) {
  const before = laid.flatMap(P => P.map(q => q.y)).join();
  for (const { path } of SPURS) path.into?.forEach((T, end) => T && level(path, T, !end));
  if (laid.flatMap(P => P.map(q => q.y)).join() === before) break;
}
for (const S of SPURS) { S.curve.updateArcLengths(); S.len = S.curve.getLength(); }
track?.updateArcLengths();
export const trackLen = track?.getLength() ?? 0;

export function sides(path, closed) {
  const n = path.length, up = new THREE.Vector3(0, 1, 0);
  const at = i => path[closed ? (i + n) % n : Math.min(n - 1, Math.max(0, i))];
  return path.map((_, i) => new THREE.Vector3().subVectors(at(i + 1), at(i - 1)).normalize().cross(up).normalize());
}
export function sweep(path, profile, closed = true) {
  const n = path.length, side = sides(path, closed);
  const P = (i, k) => path[i].clone().addScaledVector(side[i], profile[k][0]).setY(path[i].y + profile[k][1]).toArray();
  const pos = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) for (let k = 0; k < profile.length; k++) {
    const j = (i + 1) % n, l = (k + 1) % profile.length;
    pos.push(...P(i, k), ...P(j, k), ...P(j, l), ...P(i, k), ...P(j, l), ...P(i, l));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
// ---------- maglev stations: one per district, where a ride route runs deepest inside it ----------
// Routes are the loop, the centre spurs, the rings and the lines. A station clears a wider, taller band than the line, so platforms and canopies stay free of buildings.

export const ROUTES = [...HAS_LOOP ? [{ curve: track, path: pts, len: trackLen, closed: true, loop: true }] : [],
  ...SPURS.map((l, i) => ({ ...l, closed: !!l.closed, root: i < (CITY.spurs ?? []).length }))];
export const STATION_LEN = 64;
export const routeU = (R, u) => R.closed ? ((u % 1) + 1) % 1 : Math.min(1, Math.max(0, u));

// Hand-placed stops from the pack, in map px, snap to the nearest track. A district listed there gets these instead
// of its one station at the deepest point.

const STOPS = MAGLEV.stops ?? [];
export const STATIONS = STOPS.map(({ id, name, at: [px, pz] }) => {
  const [x, z] = mapToWorld([px, pz]);
  let best = null;
  for (const R of ROUTES) for (let u = 0; u <= 1; u += 3 / R.len) {
    const p = R.curve.getPointAt(u), k = Math.hypot(p.x - x, p.z - z);
    if (!best || k < best.k) best = { k, R, u };
  }
  return best && { id, name, route: best.R, u: best.u, s: best.u * best.R.len };
}).filter(Boolean);
STATIONS.push(...CITY.districts.filter(d => !STOPS.some(s => s.id === d.id)).flatMap(d => {
  let best = null;
  for (const R of ROUTES.filter(R => !R.root)) {
    const m = R.closed ? 0 : 50 / R.len;
    for (let u = m; u <= 1 - m; u += 6 / R.len) {
      if (clearOf(R, u * R.len) < 30) continue;
      const p = R.curve.getPointAt(u), k = sdPoly(p.x, p.z, d.poly);
      if (!best || k > best.k) best = { k, R, u };
    }
  }
  return best?.k > 0 ? [{ id: d.id, name: d.name.replace(/\s+District$/i, ''), route: best.R, u: best.u, s: best.u * best.R.len }] : [];
}));

// Each centre spur starts at the centre's terminus on the plaza edge, 90 m in from its end.

for (const R of ROUTES) if (R.root) STATIONS.push({ ...MAGLEV.centreStation, route: R, u: 90 / R.len, s: 90 });

// A line end that joins another track gets an interchange 90 m in. Where the end merges, it sits at least
// 150 m in and 30 m clear of the track it merges onto, so the platform stays off the ramp. It takes the name of
// the nearest station on another track within 500 m, or its district's name with Junction. Two lines that meet end
// to end run on as one track, so that end gets no interchange.

const lineEnds = ROUTES.filter(R => !R.closed).flatMap(R => [R.path[0], R.path.at(-1)]);
for (const R of ROUTES) if (!R.closed) for (const [k, s0, way] of [[0, 90, 1], [R.path.length - 1, R.len - 90, -1]]) {
  const p = R.path[k];
  if (!laid.some(P => P !== R.path && P.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 9))) continue;
  if (lineEnds.some(q => q !== p && Math.hypot(q.x - p.x, q.z - p.z) < 9)) continue;
  let s = s0;
  if (R.path.into?.[k ? 1 : 0]) for (s = s0 + way * 60; clearOf(R, s) < 30 && Math.abs(s - s0) < R.len / 3; s += way * 10);
  const q = R.curve.getPointAt(s / R.len), inD = v => CITY.districts.find(d => sdPoly(v.x, v.z, d.poly) > 0), d = inD(q) ?? inD(p);
  if (!d) continue;
  const near = STATIONS.filter(o => o.route !== R).map(o => { const c = o.route.curve.getPointAt(o.u); return { o, d: Math.hypot(c.x - q.x, c.z - q.z) }; })
    .sort((a, b) => a.d - b.d)[0];
  STATIONS.push({ id: d.id, name: near?.d < 500 ? near.o.name : `${d.name.replace(/\s+District$/i, '')} Junction`, route: R, u: s / R.len, s });
}
// ---------- straight platforms ----------
// A platform is straight, so a station slides up to 100 m to the straightest track nearby, but never onto a
// merge ramp. A station near a line end stays within 115 m of it and so stays the terminus. Then the track under the platform is pulled
// onto its chord and eases back to the curve over 40 m each side.

const HALF = (STATION_LEN + 24) / 2, EASE = 40;
const atS = (R, s) => R.curve.getPointAt(routeU(R, s / R.len));
function sag(R, s) {
  const a = atS(R, s - HALF), b = atS(R, s + HALF), dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
  let m = 0;
  for (let d = -HALF; d <= HALF; d += 4) {
    const p = atS(R, s + d), t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2;
    m = Math.max(m, Math.hypot(a.x + t * dx - p.x, a.z + t * dz - p.z));
  }
  return m;
}
for (const st of STATIONS) {
  const R = st.route, edge = s => R.closed ? Infinity : Math.min(s, R.len - s), end = edge(st.s) < 120;

  // A stop that lands on a merge ramp moves along the line until it is clear.

  for (let d = 10; clearOf(R, st.s) < 30 && d < 400; d += 10) {
    const s = [st.s + d, st.s - d].find(s => edge(s) >= HALF + EASE && clearOf(R, s) >= 30);
    if (s !== undefined) st.s = s;
  }
  let best = st.s, score = sag(R, st.s);
  for (let d = -100; d <= 100; d += 4) {
    const s = st.s + d;
    if (edge(s) < HALF + EASE || (end && edge(s) > 115) || clearOf(R, s) < 30) continue;
    const k = sag(R, s) + Math.abs(d) * .005;
    if (k < score) { score = k; best = s; }
  }
  st.s = best;
}
for (const R of ROUTES) {
  const P = R.path, step = R.len / (R.closed ? P.length : P.length - 1);
  const own = STATIONS.filter(st => st.route === R).map(st => ({ s: st.s, a: atS(R, st.s - HALF), b: atS(R, st.s + HALF) }));
  if (!own.length) continue;
  P.forEach((p, i) => {
    for (const { s, a, b } of own) {
      let d = Math.abs(i * step - s);
      if (R.closed) d = Math.min(d, R.len - d);
      const w = 1 - smooth(HALF, HALF + EASE, d);
      if (w <= 0) continue;
      const dx = b.x - a.x, dz = b.z - a.z, t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz);
      p.x += (a.x + t * dx - p.x) * w;
      p.z += (a.z + t * dz - p.z) * w;
    }
  });
  R.curve.updateArcLengths();
  R.len = R.curve.getLength();
}
for (const st of STATIONS) st.u = st.s / st.route.len;

export const concrete = new THREE.MeshStandardMaterial({ color: 0x2c313a, roughness: .85, metalness: .1, side: THREE.DoubleSide });
export const steel = new THREE.MeshStandardMaterial({ color: 0x6a7280, roughness: .35, metalness: .8, side: THREE.DoubleSide });
// Track and highway sweeps collect per material and draw as one mesh each, once the highways are laid.

const SWEEPS = new Map();
const addSweep = (geo, mat) => { if (!SWEEPS.has(mat)) SWEEPS.set(mat, []); SWEEPS.get(mat).push(geo); };
if (HAS_LOOP) {
  addSweep(sweep(pts, [[-3.2, 0], [3.2, 0], [2.4, -2.8], [-2.4, -2.8]]), concrete);
  for (const s of [-1, 1]) addSweep(sweep(pts, [[s * 1.3, 0], [s * 2.1, 0], [s * 2.1, .7], [s * 1.3, .7]]), steel);
  scene.add(new THREE.Mesh(sweep(pts, [[-2.42, -2.82], [2.42, -2.82], [2.42, -2.9], [-2.42, -2.9]]),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(.1, .3, .4), side: THREE.DoubleSide })));
}
for (const { path, closed = false } of SPURS) {
  addSweep(sweep(path, [[-3.2, 0], [3.2, 0], [2.4, -2.8], [-2.4, -2.8]], closed), concrete);
  for (const s of [-1, 1]) addSweep(sweep(path, [[s * 1.3, 0], [s * 2.1, 0], [s * 2.1, .7], [s * 1.3, .7]], closed), steel);
}

// A pylon on the sea side of the traced coast stands in the sea, which lies left of the coast's direction. It rests
// on two splayed stilts from the sea bed, braced halfway up, with pile caps at the waterline and an amber marker light.

const COAST = (CITY.coast ?? []).flatMap(l => l.slice(1).map((b, i) => [l[i], b]));
function offshore(x, z) {
  let best = Infinity, side = 0;
  for (const [[ax, az], [bx, bz]] of COAST) {
    const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - ax - t * dx, z - az - t * dz);
    if (d < best) { best = d; side = dx * (z - az) - dz * (x - ax); }
  }
  return side > 0 && CITY.districts.every(d => sdPoly(x, z, d.poly) < 0);
}
const SEA_Y = -2, LEG = [.07, .075, .085], CAP = [.11, .1, .09];
function stilts(p, t, y) {
  const L = Math.hypot(t.x, t.z) || 1, ox = -t.z / L, oz = t.x / L, y0 = SEA_Y - 8, mid = (SEA_Y + y) / 2;
  const at = (o, h) => [p.x + ox * o, h, p.z + oz * o], spread = h => 3.4 - 2.1 * (h - y0) / (y - y0);
  for (const s of [-1, 1]) {
    beam(at(s * 3.4, y0), at(s * 1.3, y), 1.3, LEG);
    prop('cyl', ...at(s * spread(SEA_Y), SEA_Y + .4), 2.4, 1.6, 2.4, CAP);
  }
  beam(at(-spread(mid), mid), at(spread(mid), mid), .7, LEG);
  glow(...at(spread(SEA_Y) + 1.4, SEA_Y + 1.6), .3, .3, .3, [1.6, .8, .2]);
}

// A pylon that would land on a highway deck moves along the line until it clears it.

const onHighway = (x, z) => HW_PTS.some(q => q.y > 5 && Math.hypot(q.x - x, q.z - z) < 11);
export function buildPylons() {
  const r = rng(77);
  if (HAS_LOOP) for (let u = 0; u < 1; u += 46 / trackLen) {
    while (onHighway(track.getPointAt(u % 1).x, track.getPointAt(u % 1).z)) u += 4 / trackLen;
    const p = track.getPointAt(u % 1), t = track.getTangentAt(u % 1), ry = Math.atan2(t.x, t.z);
    const top = p.y - 2.8;
    prop('box', p.x, top - .9, p.z, 9, 1.8, 3.2, [.06, .065, .075], ry);
    prop('cyl', p.x, (top - 1.8) / 2, p.z, 2.8, top - 1.8, 2.8, [.06, .065, .075]);
    glow(p.x, top - 1.9, p.z, .5, .2, .5, [.3, .7, 1.0]);
  }
  for (const { curve, len } of SPURS) for (let u = .02; u < 1; u += 46 / len) {
    while (u < 1 && onHighway(curve.getPointAt(u).x, curve.getPointAt(u).z)) u += 4 / len;
    if (u >= 1) break;
    const p = curve.getPointAt(u), t = curve.getTangentAt(u), top = p.y - 2.8;
    prop('box', p.x, top - .9, p.z, 9, 1.8, 3.2, [.06, .065, .075], Math.atan2(t.x, t.z));
    if (offshore(p.x, p.z)) stilts(p, t, top - 1.8);
    else prop('cyl', p.x, (top - 1.8) / 2, p.z, 2.8, top - 1.8, 2.8, [.06, .065, .075]);
    glow(p.x, top - 1.9, p.z, .5, .2, .5, [.3, .7, 1.0]);
  }
  void r;
}
// Moving instances upload only the slots in use, not the whole buffer.

// WebGL reads a zero-length range as the whole buffer, so an empty mesh uploads nothing.

export function uploadUsed(m) {
  if (!m.count) return;
  const a = m.instanceMatrix;
  a.clearUpdateRanges();
  a.addUpdateRange(0, m.count * 16);
  a.needsUpdate = true;
}

// Maglev carriages share two instanced meshes: the lit hull and its glowing windows, stripe and lamps.
// A carriage is a holder object; its lookAt writes the instance matrix, and uploadTrains sends them once a frame.

const tint = (g, rgb) => g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => rgb).flat(), 3));
const litGeo = mergeGeometries([
  ...[-1, 1].map(s => tint(new THREE.BoxGeometry(.05, .7, 9.6).translate(s * 1.73, .35, 0), [.95, .85, .6])),
  tint(new THREE.BoxGeometry(3.45, .18, 11.25).translate(0, -.9, 0), [.2, .8, 1.2]),
  ...[-1, 1].map(s => tint(new THREE.BoxGeometry(.5, .3, .1).translate(s * 1.1, -.4, 5.65), [2.2, 2.1, 1.8])),
]);
const TRAIN_HULL = new THREE.InstancedMesh(new THREE.BoxGeometry(3.4, 2.8, 11.2), new THREE.MeshStandardMaterial({ color: 0xb8c0cc, roughness: .3, metalness: .7 }), 600);
const TRAIN_LIT = new THREE.InstancedMesh(litGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), 600);
for (const m of [TRAIN_HULL, TRAIN_LIT]) { m.count = 0; m.frustumCulled = false; m.userData.moves = true; scene.add(m); }
export function carriage() {
  const i = TRAIN_HULL.count++, o = new THREE.Object3D(), look = o.lookAt.bind(o);
  TRAIN_LIT.count = TRAIN_HULL.count;
  o.lookAt = t => {
    look(t); o.updateMatrix();
    TRAIN_HULL.setMatrixAt(i, o.matrix); TRAIN_LIT.setMatrixAt(i, o.matrix);
  };
  return o;
}
export const uploadTrains = () => { uploadUsed(TRAIN_HULL); uploadUsed(TRAIN_LIT); };
export function nearHighway(x, z) {
  let m = Infinity;
  for (const h of HIGHWAYS) for (let k = 0; k < h.path.length; k += 2) m = Math.min(m, Math.hypot(h.path[k].x - x, h.path[k].z - z));
  for (let k = 0; k < pts.length; k += 3) m = Math.min(m, Math.hypot(pts[k].x - x, pts[k].z - z) + 4);
  for (const { path } of SPURS) for (let k = 0; k < path.length; k += 2) m = Math.min(m, Math.hypot(path[k].x - x, path[k].z - z) + 4);
  return m;
}

// ---------- corridors: the clear space round the maglev, its spurs and the highways ----------
// Each line holds samples every 3 m. r is the half width with a margin. A build stays out of the band
// from y - lo to y + hi within r of a sample, so it may pass under a deck but not through it or its traffic.

export const CORRIDORS = [];
const corridor = (curve, kind, r, lo, hi, p = curve.getSpacedPoints(Math.ceil(curve.getLength() / 3))) => {
  const line = { kind, r, lo, hi, p };
  line.s = p.map((q, i) => ({ x: q.x, y: q.y, z: q.z, line, i }));
  CORRIDORS.push(line);
};
if (HAS_LOOP) { corridor(track, 'maglev', 6, 5, 5); CORRIDORS[0].closed = true; }
for (const { curve, closed } of SPURS) { corridor(curve, 'maglev', 6, 5, 5); CORRIDORS.at(-1).closed = closed; }
for (const h of HIGHWAYS) corridor(new THREE.CatmullRomCurve3(h.path), 'highway', 10, 3, 4);

for (const st of STATIONS) {
  const L = STATION_LEN + 24, p = Array.from({ length: 31 }, (_, i) => st.route.curve.getPointAt(routeU(st.route, st.u + (i / 30 - .5) * L / st.route.len)));
  corridor(null, 'station', 16, 4, 15, p);
}

// Samples in 40 m cells, for quick lookups round a lot.

const CELL = 40, CELLS = new Map();
for (const { s } of CORRIDORS) for (const q of s) {
  const k = `${Math.floor(q.x / CELL)},${Math.floor(q.z / CELL)}`;
  if (!CELLS.has(k)) CELLS.set(k, []);
  CELLS.get(k).push(q);
}
export function corridorNear(x, z, R) {
  const out = [];
  for (let a = Math.floor((x - R) / CELL); a <= Math.floor((x + R) / CELL); a++)
    for (let b = Math.floor((z - R) / CELL); b <= Math.floor((z + R) / CELL); b++)
      for (const q of CELLS.get(`${a},${b}`) ?? []) if (Math.hypot(q.x - x, q.z - z) < R) out.push(q);
  return out;
}

// Samples whose band reaches into the rectangle of frame f, grown by pad. Each comes with its local u, v.

export function corridorIn(f, pad = 0, w = f.w, d = f.d) {
  return corridorNear(f.cx, f.cz, Math.hypot(w, d) / 2 + pad + 10).flatMap(q => {
    const X = q.x - f.cx, Z = q.z - f.cz, u = X * f.c - Z * f.s, v = X * f.s + Z * f.c, R = q.line.r + pad;
    return Math.abs(u) < w / 2 + R && Math.abs(v) < d / 2 + R ? [{ q, u, v }] : [];
  });
}
export const hwTraffic = [], HW = SETTING.transport.highway;
for (const h of HIGHWAYS) {
  addSweep(sweep(h.path, [[-8, 0], [8, 0], [7, -1.8], [-7, -1.8]], false), concrete);
  for (const s of [-1, 1]) addSweep(sweep(h.path, [[s * 7.6, 0], [s * 8, 0], [s * 8, 1.1], [s * 7.6, 1.1]], false), concrete);
  for (let k = 4; k < h.path.length; k += 9) { const p = h.path[k]; if (p.y > 5) prop('cyl', p.x, (p.y - 1.8) / 2, p.z, 3.4, p.y - 1.8, 3.4, [.06, .065, .075]); }

  // The pack sets the cars per metre of highway and their speed before the speed slider.

  let len = 0;
  for (let k = 1; k < h.path.length; k++) len += h.path[k].distanceTo(h.path[k - 1]);
  for (let k = 0; k < len / HW.every; k++) hwTraffic.push({ h, lane: (k % 4) - 1.5, u: Math.random(), v: ((k % 4) < 2 ? -1 : 1) * (HW.speed + Math.random() * HW.spread) / len, rank: Math.random() });
}
for (const [mat, list] of SWEEPS) { scene.add(new THREE.Mesh(mergeGeometries(list), mat)); for (const g of list) g.dispose(); }

// Traffic lists sort by rank, so the visible cars come first and a mesh draws only up to the last of them.

hwTraffic.sort((a, b) => a.rank - b.rank);
export const hwCars = new THREE.InstancedMesh(new THREE.BoxGeometry(.9, .5, 2.6), new THREE.MeshBasicMaterial(), hwTraffic.length);
hwTraffic.forEach((c, i) => hwCars.setColorAt(i, _c.setRGB(...HW.colours[c.lane > 0 ? 0 : 1])));
hwCars.frustumCulled = false;
hwCars.userData.moves = true;
scene.add(hwCars);

// ---------- street and sky traffic ----------

export const part = (w, h, l, x, y, z, rgb) => {
  const g = new THREE.BoxGeometry(w, h, l).translate(x, y, z);
  g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => rgb).flat(), 3));
  return g;
};

// The pack gives each vehicle as boxes [w, h, l, x, y, z, rgb]. A pack without hover traffic reuses the car.

const vehicle = parts => mergeGeometries(parts.map(q => part(...q)));
export const carGeometry = () => vehicle(SETTING.transport.cars.parts);
export const hoverGeometry = () => vehicle(SETTING.transport.hover?.parts ?? SETTING.transport.cars.parts);

// Street paths are sampled every 4 m, so u counts samples and v is samples per second.

// Streets end where the city's edge frays, so cars turn back there. A street that leaves and re-enters splits in two.

const inCity = l => l.reduce((runs, p) => (edgeAt(p[0], p[1]) < 0 ? runs.push([]) : runs.at(-1).push(p), runs), [[]]);
export const STREETS = Object.entries(CITY.streets).flatMap(([kind, lines]) => lines.flatMap(inCity).filter(l => l.length > 8).map(l => {
  const path = l.map(([x, z]) => new THREE.Vector3(x, 0, z)), xs = l.map(p => p[0]), zs = l.map(p => p[1]);
  return { kind, path, side: sides(path, false), box: [Math.min(...xs) - 8, Math.min(...zs) - 8, Math.max(...xs) + 8, Math.max(...zs) + 8] };
}));
export const traffic = [], HOVER = SETTING.transport.hover;
{
  const r = rng(4242);
  for (const st of STREETS) {
    const every = st.kind === 'minor' ? 22 : 8;
    for (let k = 0; k < st.path.length - 1; k += every * (.6 + r())) {
      const dir = r() < .5 ? 1 : -1;
      traffic.push({ st, u: k, dir, v: (2.5 + r() * 1.8) * (st.kind === 'main' ? 1.3 : 1), lane: st.kind === 'minor' ? 1.6 : 2.4, y: 0, hover: false, rank: r() });

      // Sky lanes: one altitude per street kind and direction, so hovercars fly in readable layers. A pack without
      // hover traffic still draws the roll, so the street cars keep their seeds.

      if (st.kind !== 'minor' && r() < (HOVER?.share ?? 0)) traffic.push({ st, u: k, dir, v: 8 + r() * 6, lane: 3 + r() * 3,
        y: HOVER.y[st.kind] + (dir > 0 ? 0 : HOVER.climb) + r() * 3, hover: true, rank: r() });
    }
  }
}
export const ground = traffic.filter(c => !c.hover).sort((a, b) => a.rank - b.rank), sky = traffic.filter(c => c.hover).sort((a, b) => a.rank - b.rank);

// A pack's transport.cars.lit lights its cars by the sun and the sky, for daylight, and lets them take shadows.
// A part whose colour passes 1 is a lamp: it glows while the windows are lit.

function carMaterial() {
  if (!SETTING.transport.cars.lit) return new THREE.MeshBasicMaterial({ vertexColors: true });
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 });
  m.onBeforeCompile = s => {
    shadowUniforms(s);
    s.uniforms.uWin = U.uWin;
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWin;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * step(1., max(vColor.r, max(vColor.g, vColor.b))) * uWin;');
  };
  return m;
}
export const cars = new THREE.InstancedMesh(carGeometry(), carMaterial(), ground.length);
export const hovers = new THREE.InstancedMesh(hoverGeometry(), cars.material, sky.length);
for (const m of [cars, hovers]) { m.frustumCulled = false; m.userData.moves = true; scene.add(m); }
export const TRAFFIC = { ground: 1, hover: 1, highway: 1, speed: 1 };

// All traffic follows one clock scaled by TRAFFIC.speed. Maglev trains run timetables in ride.js.

S.trafficT = 0;
// Every shown car keeps driving, but only cars within sight range take an instance slot.
// Past it a car is under three pixels, so the mesh draws just the near ones.
// Near cars step every frame. The far ones step an eighth of the list per frame with the time they skipped,
// and a car on a street wholly out of range skips its position, so a frame reads little beyond the near cars.

let clockT = 0, tick = 0, nearGround = [], nearSky = [];
export function moveCars(dt) {
  const { x: cx, y: cy, z: cz } = camera.position;
  clockT += dt; tick++;
  const step = (c, mesh, far) => {
    const lag = Math.min(clockT - (c.t ?? clockT), .9 / c.v), P = c.st.path, n = P.length - 1;
    c.t = clockT; c.seen = tick;

    // Cars U-turn at dead ends, so none drive off a street's end into the sea. A step stays under one sample,
    // so the check ahead never jumps a blocked sample.

    c.u += c.dir * c.v * lag;
    if (c.u > n - .01) { c.u = n - .01; c.dir = -1; }
    if (c.u < 0) { c.u = 0; c.dir = 1; }
    if (!c.hover && c.st.block?.[Math.floor(c.u) + (c.dir > 0)]) { c.u -= c.dir * c.v * lag; c.dir = -c.dir; }
    const B = c.st.box, bx = Math.max(B[0] - cx, 0, cx - B[2]), bz = Math.max(B[1] - cz, 0, cz - B[3]);
    if (bx * bx + (c.y - cy) ** 2 + bz * bz > far * far) return false;
    const k = Math.floor(c.u), f = c.u - k, a = P[k], b = P[k + 1], sd = c.st.side[k], off = c.lane * c.dir;
    const px = lerp(a.x, b.x, f) + sd.x * off, pz = lerp(a.z, b.z, f) + sd.z * off;
    if ((px - cx) ** 2 + (c.y - cy) ** 2 + (pz - cz) ** 2 > far * far) return false;
    yawAt(mesh, mesh.count++, px, c.y + (RELIEF && !c.hover ? groundAt(px, pz) : 0), pz, (b.x - a.x) * c.dir, (b.z - a.z) * c.dir, c.hover ? 1.4 : 1);
    return true;
  };
  const move = (list, near, mesh, show, far) => {
    const kept = near.filter(c => c.rank < show && step(c, mesh, far));
    const q = Math.ceil(list.length / 8), from = (tick % 8) * q, to = Math.min(from + q, list.length);
    for (let i = from; i < to; i++) {
      const c = list[i];
      if (c.rank < show && c.seen !== tick && step(c, mesh, far)) kept.push(c);
    }
    return kept;
  };
  cars.count = hovers.count = 0;
  nearGround = move(ground, nearGround, cars, TRAFFIC.ground * QUALITY.cars, SETTING.scale.traffic.ground);
  nearSky = move(sky, nearSky, hovers, TRAFFIC.hover * QUALITY.cars, SETTING.scale.traffic.sky);
  uploadUsed(cars); uploadUsed(hovers);
}

// ---------- the centre ----------
// The pack's centre module builds the central landmark into this group. Clicks on it open the centre's card.

export const centre = new THREE.Group();
centre.position.set(CENTRE.x, 0, CENTRE.y);
scene.add(centre);
if (CENTRE_PLACE) CENTRE_PLACE.top = new THREE.Vector3(CENTRE.x, SETTING.centre.top, CENTRE.y);
