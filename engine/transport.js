// Maglev, highways, street and sky traffic, and the group that holds the central landmark.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { S } from './state.js';
import { CENTRE, CENTRE_PLACE, CITY, lerp, mapToWorld, rng, sdPoly, smooth, styleAt } from './core.js';
import { SETTING } from './setting.js';
import { edgeAt } from './edge.js';
import { RELIEF, groundAt } from './relief.js';
import { QUALITY, U, addHole, camera, scene, shadowUniforms } from './render.js';
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
const overHighway = path => path.map(p => {
  let y = 0;
  for (const q of HW_PTS) if (q.y > 5 && Math.abs(q.x - p.x) < 16 && Math.abs(q.z - p.z) < 16 && Math.hypot(q.x - p.x, q.z - p.z) < 16) y = Math.max(y, q.y + 10);
  return y;
});
const clearHighways = (path, closed) => rise(path, closed, overHighway(path));

// Each deck rises to at least ys, and its neighbours rise to meet it on an 8% grade.

function rise(path, closed, ys) {
  const n = path.length, ds = path[0].distanceTo(path[1]);
  for (let pass = 0; pass < (closed ? 2 : 1); pass++) for (const dir of [1, -1]) for (let k = closed ? 0 : 1; k < n; k++) {
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
const heightRule = P => {
  let ys = P.map(p => lerp(...MAGLEV.height, styleAt(p.x, p.z, 200).w));
  for (let pass = 0; pass < 3; pass++) ys = ys.map((_, i) => {
    let s = 0;
    for (let k = -30; k <= 30; k++) s += ys[(i + k + ys.length) % ys.length];
    return s / 61;
  });
  return ys;
};
export const ys = heightRule(pts);
pts.forEach((p, i) => { p.y = ys[i]; });
if (HAS_LOOP) clearHighways(pts, true);
export const track = HAS_LOOP ? new THREE.CatmullRomCurve3(pts, true) : null;
if (track) track.arcLengthDivisions = 4000;

// Maglev spurs run from the centre plaza's edge down to the loop. Lines carry the maglev on outward at a
// fixed height. An end on the loop or on an earlier line or ring takes that track's height, so the joints meet.

pts.closed = true;
const laid = [pts], G = .08;

// The Beanstalk hall, in world metres, or null in a pack without one. Loops may climb LOOP_G on the ramps down
// into it.

export const HALL = MAGLEV.hall ? (([x, z]) => ({ x, z, y: MAGLEV.hall.y, r: MAGLEV.hall.r }))(mapToWorld(MAGLEV.hall.at)) : null;
export const LOOP_G = .1;

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

// A line whose tail runs back within 20 m of its own earlier points is a lollipop. Its stem runs from the start to
// the point the tail returns to, and its balloon runs from there round to the tail. Returns that point's index j
// and the tail's first index k, or null.

const lollipop = l => {
  let k = l.length;
  while (k > 3 && lineDist(l[k - 1], l.slice(0, k - 2)) < 20) k--;
  if (k > l.length - 2) return null;
  const d = i => Math.hypot(l[i][0] - l[k][0], l[i][1] - l[k][1]), j = l.slice(0, k - 1).reduce((b, _, i) => d(i) < d(b) ? i : b, 0);
  return j > 0 ? { j, k } : null;
};

// A lollipop lays as one route that runs out its single-track stem to the switch, round the balloon and back to
// the switch, where its last sample sits on the stem's sample m. A train runs on from there back down the stem.
// The route samples every 6 m. The balloon's bends ease to 64 m, with the stem as its run on past the end. Its
// deck runs from y0 at the root to y1 at the balloon's far side, the same each way along the stem.

const unbendBalloon = (P, loose, H) => {
  const { m } = P.stem, more = Array.from({ length: H + 1 }, (_, k) => P[Math.max(0, m - 1 - k)]);
  return unbend([...P, ...more], [...loose, ...more.map(() => false)], H);
};
const balloonTrack = (l, { j, k }, y0, y1) => {
  const flatC = new THREE.CatmullRomCurve3([...l.slice(0, k), l[j], l[Math.max(0, j - 1)]].map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const raw = flatC.getSpacedPoints(Math.round(flatC.getLength() / 6)), half = Math.floor(raw.length / 2);
  const nearest = (q, from, to) => { let b = from; for (let i = from; i < to; i++) if (Math.hypot(raw[i].x - q[0], raw[i].z - q[1]) < Math.hypot(raw[b].x - q[0], raw[b].z - q[1])) b = i; return b; };
  const m = nearest(l[j], 0, half), e = nearest(l[j], half, raw.length), ds = flat2(raw[0], raw[1]);
  const path = [...raw.slice(0, e), raw[m].clone()], n = path.length, ring = e + m + 1, J = joined(path[0]);
  path.stem = { m };

  // The balloon's last 60 m bend onto the stem on a curve tangent to both, like a line's merge.

  const q = Math.round(60 / ds), S = path[n - 1 - q], M = path[n - 1], ch = flat2(S, M) / 3;
  const hS = new THREE.Vector3().subVectors(path[n - q], path[n - 2 - q]).setY(0).normalize(), tM = new THREE.Vector3().subVectors(path[m - 1], path[m]).setY(0).normalize();
  const merge = new THREE.CubicBezierCurve3(S.clone(), S.clone().addScaledVector(hS, ch), M.clone().addScaledVector(tM, -ch), M.clone()).getSpacedPoints(q);
  merge.forEach((v, i) => path[n - 1 - q + i].copy(v));
  unbendBalloon(path, path.map((_, i) => i > m && i < n - 1), Math.round(20 / ds));
  y0 = J ? J.P[J.k].y : y0;
  path.forEach((p, i) => { p.y = lerp(y0, y1, smooth(0, 1, Math.min(i, ring - 1 - i) / ((ring - 1) / 2))); });
  path[n - 1].y = path[m].y;
  clearHighways(path, false);
  path[m].y = path[n - 1].y = Math.max(path[m].y, path[n - 1].y);
  rise(path, false, path.map(p => p.y));
  laid.push(path);
  const curve = new THREE.CatmullRomCurve3(path);
  curve.arcLengthDivisions = 2 * n;
  return { path, curve, len: curve.getLength(), balloon: { m } };
};
export const openTrack = (l, y0, y1) => {
  const loop = lollipop(l);
  if (loop) return balloonTrack(l, loop, y0, y1);
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

// A loop is a closed route on its own guideway, laid after every other track. Where it runs within 12 m of a track
// and within 30° of its heading, it lies 6.8 m beside that track at its deck height, on the side its own line leaves.
// Elsewhere it takes the City Loop's height rule. The pull eases out over 60 m or more, and each sample keeps its
// weight in w and in pin whether it keeps its partner's deck. The loop clears highways and every track it meets by
// 10 m, over or under it, and climbs no more than 8%. Loops have no ends, so they never merge onto or lift other
// track. ?loops=0 skips them.

export const footOn = (P, p) => {
  const n = P.length;
  let best = { d: Infinity };
  for (let i = 0; i < (P.closed ? n : n - 1); i++) {
    const a = P[i], b = P[(i + 1) % n], ex = b.x - a.x, ez = b.z - a.z, L = Math.hypot(ex, ez) || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.z - a.z) * ez) / (L * L)));
    const x = a.x + ex * t, z = a.z + ez * t, d = Math.hypot(p.x - x, p.z - z);
    if (d < best.d) best = { d, x, z, y: lerp(a.y, b.y, t), tx: ex / L, tz: ez / L, i, t };
  }
  return best;
};
const COS30 = Math.cos(Math.PI / 6);

// A bend on a closed track tighter than a 64 m radius over a chord of 2H samples eases, which keeps a margin on the
// 60 m limit. Its loose samples step halfway to the midpoint of their neighbours until the bend is clear. Returns
// the samples that moved.

const unbend = (path, loose, H) => {
  const n = path.length, at = i => (i % n + n) % n, moved = new Set(), radius = i => {
    const a = path[at(i - H)], b = path[i], c = path[at(i + H)];
    return flat2(a, b) * flat2(b, c) * flat2(a, c) / (2 * Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) || 1e-9);
  };
  for (let t = 0; t < 500; t++) {
    const tight = new Set();
    for (let i = 0; i < n; i++) if (radius(i) < 64) for (let k = -H; k <= H; k++) if (loose[at(i + k)]) tight.add(at(i + k));
    if (!tight.size) break;
    for (const i of tight) {
      const a = path[at(i - 1)], b = path[at(i + 1)], p = path[i];
      p.x += ((a.x + b.x) / 2 - p.x) / 2;
      p.z += ((a.z + b.z) / 2 - p.z) / 2;
      moved.add(i);
    }
  }
  return moved;
};
const loopTrack = l => {
  const flatC = new THREE.CatmullRomCurve3(l.pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  const n = Math.round(flatC.getLength() / 4), raw = flatC.getSpacedPoints(n).slice(0, -1), ds = flatC.getLength() / n;
  const at = i => (i % n + n) % n;
  const head = raw.map((_, i) => new THREE.Vector3().subVectors(raw[at(i + 1)], raw[at(i - 1)]).normalize());
  const free = heightRule(raw);
  const aligned = (f, h) => Math.abs(f.tx * h.x + f.tz * h.z) > COS30;

  // Each sample takes the nearest aligned track within 12 m. Samples on one track in a row form a run.

  const pull = raw.map((p, i) => {
    let best = null;
    for (const P of laid) { const f = footOn(P, p); if (f.d < 12 && aligned(f, head[i]) && (!best || f.d < best.f.d)) best = { P, f }; }
    return best;
  });
  const runs = [];
  for (let i = 0; i < n; i++) {
    if (!pull[i] || pull[at(i - 1)]?.P === pull[i].P) continue;
    let j = i;
    while (j < i + n - 1 && pull[at(j + 1)]?.P === pull[i].P) j++;
    runs.push({ P: pull[i].P, a: i, b: j });
  }

  // Beside a lollipop's single-track stem, runs less than 150 m apart join into one, so the loop holds beside the
  // stem instead of weaving across it.

  const onStem = (P, k) => P.stem && footOn(P, raw[at(k)]).i < P.stem.m;
  for (let r = runs.length - 1; r > 0; r--) {
    const A = runs[r - 1], B = runs[r];
    if (A.P === B.P && (B.a - A.b) * ds < 150 && onStem(A.P, A.b) && onStem(B.P, B.a)) { A.b = B.b; runs.splice(r, 1); }
  }

  // A run ends on the side where the loop's own line comes 6.8 m clear of the track. A run whose ends agree keeps
  // that side and holds it until the line is clear. A run shorter than 200 m whose ends disagree is a crossing and
  // takes no pull. A longer one keeps the side most of it lies on and crosses at the other end, where it lets go
  // once the line is 6.8 m clear on the far side. Sides count from the loop's own heading, so a track that runs
  // either way gives the same side.

  const normal = (f, i) => { const o = Math.sign(f.tx * head[i].x + f.tz * head[i].z) || 1; return [-f.tz * o, f.tx * o]; };
  const offset = (P, k) => { const p = raw[at(k)], f = footOn(P, p), [nx, nz] = normal(f, at(k)); return { d: f.d, s: (p.x - f.x) * nx + (p.z - f.z) * nz }; };
  const exitOf = (P, e, dir) => {
    let k = e;
    while (offset(P, k).d < 6.8 && Math.abs(k - e) * ds < 300) k += dir;
    return { side: Math.sign(offset(P, k).s) || 1, k };
  };
  const hold = [], ends = [];
  for (const R of runs) {
    const { P, a, b } = R, A = exitOf(P, a, -1), B = exitOf(P, b, 1);
    if (A.side !== B.side && (b - a) * ds < 200) continue;
    let sum = 0;
    for (let k = a; k <= b; k++) sum += offset(P, k).s;
    const side = A.side === B.side ? A.side : Math.sign(sum) || 1;
    let lo = a, hi = b;
    for (const [E, dir] of [[A, -1], [B, 1]]) {
      let r = E.k;
      if (E.side !== side) {
        r = dir > 0 ? b : a;
        while (r !== (dir > 0 ? a : b) && -side * offset(P, r - dir).s >= 6.8) r -= dir;
        if (-side * offset(P, r).s < 6.8) r = E.k;
      }
      if (dir > 0) hi = r; else lo = r;
      ends.push({ P, side, r, dir, L: E.side === side ? 60 : 90 });
    }
    for (let k = lo; k <= hi; k++) hold[at(k)] ??= { P, side };
  }

  // Past each end the loop eases back onto its own line over 60 m, or 90 m where it crosses, weighted by its
  // distance along the loop.

  const ease = [];
  for (const { P, side, r, dir, L } of ends) for (let k = 1; k * ds < L && !hold[at(r + dir * k)]; k++) {
    const w = 1 - smooth(0, L, k * ds), i = at(r + dir * k);
    if (w > (ease[i]?.w ?? 0)) ease[i] = { P, side, w };
  }
  const path = raw.map((p, i) => {
    const h = hold[i] ?? ease[i];
    if (!h) return Object.assign(new THREE.Vector3(p.x, free[i], p.z), { w: 0 });
    const { P, side } = h, f = footOn(P, p), w = hold[i] ? 1 : h.w, [nx, nz] = normal(f, i);
    const x = f.x + nx * side * 6.8, z = f.z + nz * side * 6.8;
    return Object.assign(new THREE.Vector3(lerp(p.x, x, w), lerp(free[i], f.y, w), lerp(p.z, z, w)), { w, pin: !!hold[i], beside: P });
  });

  // A held sample moves only within 40 m of its hold's end, and then lets go of its partner's deck.

  const H = Math.round(20 / ds), loose = path.map((_, i) => !hold[i]);
  for (const { r, dir } of ends) for (let k = 0; k <= 2 * H; k++) loose[at(r - dir * k)] = true;
  for (const i of unbend(path, loose, H)) path[i].pin = false;

  // A held sample keeps its partner's deck. Highways set floors 10 m over the loop. A deck meets the loop within
  // 6.5 m at any angle, or within 16 m at more than 30° unless it is the partner. A meeting deck sets a floor 10 m
  // over it, or a ceiling 10 m under it where the loop runs well below it and its pinned decks let it stay there.
  // A held sample that cannot reach that height at its grade, or whose partner climbs steeper than that beside it,
  // lets go of its partner's deck but keeps its place beside it. Between these the loop takes its eased height and
  // climbs no more than 8%, or LOOP_G where it is steep.

  // Samples inside the hall's radius take a ceiling at its deck. The ceiling climbs away from the hall at LOOP_G.
  // Where it lies below the loop's highest deck the loop is steep, so its grades there may reach LOOP_G. A meeting
  // deck the ramp cannot clear by 10 m sets a ceiling under it instead of a floor over it. A highway the ramp
  // runs under sets a ceiling 10 m under its deck.

  const span = (i, j) => flat2(path[i], path[j]);
  const slope = (i, j) => path[i].steep || path[j].steep ? LOOP_G : G;
  const grade = (ys, way, g = slope, held = i => path[i].pin) => {
    for (let pass = 0; pass < 2; pass++) for (const dir of [1, -1]) for (let k = 0; k < n; k++) {
      const i = dir > 0 ? k : n - 1 - k, j = at(i - dir), y = ys[j] - way * g(i, j) * span(i, j);
      if (way * (y - ys[i]) > 0 && !held(i)) ys[i] = y;
    }
    return ys;
  };
  const inHall = path.map(p => !!HALL && Math.hypot(p.x - HALL.x, p.z - HALL.z) < HALL.r);
  const ramp = grade(inHall.map(h => h ? HALL.y : Infinity), -1, () => LOOP_G, () => false);
  path.forEach((p, i) => { p.steep = ramp[i] < MAGLEV.height[1]; });
  const down = i => ramp[i] < path[i].y;
  const hw = overHighway(path).map(y => y || -Infinity), lo = [...hw], hi = path.map(() => Infinity);
  path.forEach((p, i) => { if (p.pin) lo[i] = hi[i] = footOn(p.beside, p).y; });
  path.forEach((p, i) => { if (p.pin && path[at(i + 1)].pin && Math.abs(lo[i] - lo[at(i + 1)]) > slope(i, at(i + 1)) * span(i, at(i + 1))) { p.pin = false; hi[i] = Infinity; } });
  const least = grade([...lo], 1), want = [];
  path.forEach((p, i) => {
    if (hold[i]) return;
    for (const P of laid) {
      const f = footOn(P, p);
      if (f.d >= 6.5 && (P === p.beside || f.d >= 16 || aligned(f, head[i]))) continue;
      const over = f.y < Math.max(p.y, least[i]) + 10 && f.y + 10 <= ramp[i];
      want.push(over ? { i, y: f.y + 10, way: 1 } : { i, y: f.y - 10, way: -1 });
    }
  });
  const reach = Math.ceil(600 / ds);
  for (const { i, y, way } of want) for (const dir of [1, -1]) for (let k = 1; k <= reach; k++) {
    const j = at(i + dir * k), q = path[j];
    if (q.pin && way * (y - lo[j]) > .9 * (q.steep ? LOOP_G : G) * ds * k) { q.pin = false; lo[j] = hw[j]; hi[j] = Infinity; }
  }
  path.forEach((p, i) => {
    if (p.pin || !down(i)) return;
    if (inHall[i]) hi[i] = HALL.y;
    if (hw[i] > ramp[i]) { hi[i] = Math.min(hi[i], hw[i] - 20); lo[i] = -Infinity; }
  });
  for (const { i, y, way } of want) if (way > 0) lo[i] = Math.max(lo[i], y); else hi[i] = Math.min(hi[i], y);
  const floor = grade(lo, 1), ceil = grade(hi, -1);
  const ys = grade(path.map((p, i) => Math.max(floor[i], Math.min(ceil[i], p.y))), -1);
  path.forEach((p, i) => { p.y = Math.max(floor[i], ys[i]); });
  path.closed = true;
  laid.push(path);
  const curve = new THREE.CatmullRomCurve3(path, true);
  curve.arcLengthDivisions = 2 * n;
  return { path, curve, len: curve.getLength(), closed: true, name: l.name, music: l.music, lap: true };
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

// Loops lay once every other deck is level, so the decks they run beside keep their final heights.

if (new URLSearchParams(location.search).get('loops') !== '0') SPURS.push(...(CITY.loops ?? []).map(loopTrack));
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
// Routes are the City Loop, the centre spurs, the rings, the lines and the data loops. A station clears a wider, taller band than the line, so platforms and canopies stay free of buildings.

export const ROUTES = [...HAS_LOOP ? [{ curve: track, path: pts, len: trackLen, closed: true, loop: true }] : [],
  ...SPURS.map((l, i) => ({ ...l, closed: !!l.closed, root: i < (CITY.spurs ?? []).length }))];
export const STATION_LEN = 64;
export const routeU = (R, u) => R.closed ? ((u % 1) + 1) % 1 : Math.min(1, Math.max(0, u));

// Hand-placed stops from the pack, in map px, snap to the nearest route within 150 m, or drop. st.snap keeps that
// distance. Every other route within 12 m of the snapped point gets a station there too. Track within 30° of the
// master's heading may be double track, and its station is a twin that keeps its master in st.of. Any other track
// crosses, and its station links to the master in st.cross both ways. A twin with no level stretch in reach
// becomes a crossing pair too (see the slide below).
// A centre spur takes only the hand stops the pack lists for it in spurStops, because it has its terminus. A
// district listed there gets these instead of its one station at the deepest point.

const STOPS = MAGLEV.stops ?? [];
const nearestU = (R, x, z, [u0, u1] = [0, 1]) => {
  let best = null;
  for (let u = u0; u <= u1; u += 3 / R.len) {
    const p = R.curve.getPointAt(u), k = Math.hypot(p.x - x, p.z - z);
    if (!best || k < best.k) best = { k, R, u };
  }
  return best;
};
const SPUR_ROUTES = ROUTES.filter(R => R.root);
const openFor = name => ROUTES.filter(R => !R.root || MAGLEV.spurStops?.[SPUR_ROUTES.indexOf(R)]?.includes(name));
export const STATIONS = STOPS.flatMap(({ id, name, at: [px, pz] }) => {
  const OPEN = openFor(name), [x, z] = mapToWorld([px, pz]), best = OPEN.map(R => nearestU(R, x, z)).sort((a, b) => a.k - b.k)[0];
  if (!best || best.k > 150) return [];
  const st = { id, name, route: best.R, u: best.u, s: best.u * best.R.len, snap: best.k }, p = best.R.curve.getPointAt(best.u);
  const h = best.R.curve.getTangentAt(best.u);
  return [st, ...OPEN.filter(R => R !== best.R).map(R => nearestU(R, p.x, p.z)).filter(t => t.k < 12).map(t => {
    const g = t.R.curve.getTangentAt(t.u), o = { id, name, route: t.R, u: t.u, s: t.u * t.R.len };
    if (Math.abs(h.x * g.x + h.z * g.z) / Math.hypot(h.x, h.z) / Math.hypot(g.x, g.z) > COS30) o.of = st;
    else { o.cross = st; st.cross = o; }
    return o;
  })];
});

// Loop routes and the other routes each take their own district stations. A hand stop whose stations all lie on
// loop routes leaves the other routes their station in that district.

const isLoop = R => !!R.lap;
const ofStop = s => STATIONS.filter(st => st.id === s.id && st.name === s.name);
const loopOnly = s => ofStop(s).length > 0 && ofStop(s).every(st => isLoop(st.route));
const stopped = (d, loops) => STOPS.some(s => s.id === d.id && (loops || !loopOnly(s)));
STATIONS.push(...[true, false].flatMap(loops => CITY.districts.filter(d => !stopped(d, loops)).flatMap(d => {
  let best = null;
  for (const R of ROUTES.filter(R => !R.root && isLoop(R) === loops)) {
    const m = R.closed ? 0 : 50 / R.len;
    for (let u = m; u <= 1 - m; u += 6 / R.len) {
      if (clearOf(R, u * R.len) < 30) continue;
      const p = R.curve.getPointAt(u), k = sdPoly(p.x, p.z, d.poly);
      if (!best || k > best.k) best = { k, R, u };
    }
  }
  return best?.k > 0 ? [{ id: d.id, name: d.name.replace(/\s+District$/i, ''), route: best.R, u: best.u, s: best.u * best.R.len }] : [];
})));

// Each centre spur starts at the centre's terminus on the plaza edge, 90 m in from its end.

for (const R of ROUTES) if (R.root) STATIONS.push({ ...MAGLEV.centreStation, route: R, u: 90 / R.len, s: 90 });

// A line end that joins another track gets an interchange 90 m in. Where the end merges, it sits at least
// 150 m in and 30 m clear of the track it merges onto, so the platform stays off the ramp. It takes the name of
// the nearest station on another track within 500 m, loop routes aside, or its district's name with Junction.
// Two lines that meet end to end run on as one track, so that end gets no interchange.

const lineEnds = ROUTES.filter(R => !R.closed).flatMap(R => [R.path[0], R.path.at(-1)]);
for (const R of ROUTES) if (!R.closed) for (const [k, s0, way] of [[0, 90, 1], [R.path.length - 1, R.len - 90, -1]]) {
  const p = R.path[k];
  if (!laid.some(P => P !== R.path && P.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 9))) continue;
  if (lineEnds.some(q => q !== p && Math.hypot(q.x - p.x, q.z - p.z) < 9)) continue;
  let s = s0;
  if (R.path.into?.[k ? 1 : 0]) for (s = s0 + way * 60; clearOf(R, s) < 30 && Math.abs(s - s0) < R.len / 3; s += way * 10);
  const q = R.curve.getPointAt(s / R.len), inD = v => CITY.districts.find(d => sdPoly(v.x, v.z, d.poly) > 0), d = inD(q) ?? inD(p);
  if (!d) continue;
  const near = STATIONS.filter(o => o.route !== R && !isLoop(o.route)).map(o => { const c = o.route.curve.getPointAt(o.u); return { o, d: Math.hypot(c.x - q.x, c.z - q.z) }; })
    .sort((a, b) => a.d - b.d)[0];
  STATIONS.push({ id: d.id, name: near?.d < 500 ? near.o.name : `${d.name.replace(/\s+District$/i, '')} Junction`, route: R, u: s / R.len, s });
}
// ---------- straight platforms ----------
// A platform is straight, so a station slides up to 100 m to the straightest track nearby, but never onto a
// merge ramp. A station near a line end stays within 115 m of it and so stays the terminus. A crossing pair keeps
// its place, so both levels stay stacked. Then the track under the platform is pulled onto its chord and eases back
// to the curve each side. The ease is the shortest of EASES that keeps the pulled track at a 64 m radius or more,
// 71 m with double track, whose inner track runs 6.8 m tighter. Among the spots that fit with that ease, the
// station takes the straightest, with a small cost per metre it slides. Where none fits, it takes the longest ease.

const HALF = (STATION_LEN + 24) / 2, EASES = [40, 60, 80, 100, 120];
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

// The tightest radius on three points 20 m apart round a station at s, pulled with ease E, and unpulled.

const radius = (a, b, c) => {
  const area = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
  return area ? flat2(a, b) * flat2(b, c) * flat2(a, c) / (4 * area) : Infinity;
};
function tightest(R, s, E) {
  const a = atS(R, s - HALF), b = atS(R, s + HALF), dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz, P = [], Q = [];
  for (let d = -HALF - E - 20; d <= HALF + E + 20; d += 4) {
    const p = atS(R, s + d), w = 1 - smooth(HALF, HALF + E, Math.abs(d)), t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2;
    P.push({ x: p.x + (a.x + t * dx - p.x) * w, z: p.z + (a.z + t * dz - p.z) * w });
    Q.push(p);
  }
  let m = Infinity, n = Infinity;
  for (let i = 5; i < P.length - 5; i++) { m = Math.min(m, radius(P[i - 5], P[i], P[i + 5])); n = Math.min(n, radius(Q[i - 5], Q[i], Q[i + 5])); }
  return { pulled: m, was: n };
}
for (const st of STATIONS) {
  if (st.of || st.rides) continue;
  const R = st.route, edge = s => R.closed ? Infinity : Math.min(s, R.len - s), end = edge(st.s) < 120;

  // A stop with twins slides only along level double track, so each pair of platforms sits side by side.

  let twins = STATIONS.filter(o => o.of === st), paired = s => [-HALF, 0, HALF].every(d => {
    const p = atS(R, s + d);
    return twins.every(o => { const f = footOn(o.route.path, p); return f.d < 12 && Math.abs(f.y - p.y) < .5; });
  });

  // A stop that lands on a merge ramp moves along the line until it is clear.

  if (!st.cross) for (let d = 10; clearOf(R, st.s) < 30 && d < 400; d += 10) {
    const s = [st.s + d, st.s - d].find(s => edge(s) >= HALF + EASES[0] && clearOf(R, s) >= 30);
    if (s !== undefined) st.s = s;
  }
  let spots = [];
  for (let d = st.cross ? 0 : -100; d <= (st.cross ? 0 : 100); d += 4) {
    const s = st.s + d;
    if (d && (edge(s) < HALF + EASES[0] || (end && edge(s) > 115) || clearOf(R, s) < 30 || !paired(s))) continue;
    spots.push({ s, k: paired(s) ? sag(R, s) + Math.abs(d) * .005 : Infinity });
  }
  spots.sort((a, b) => a.k - b.k);

  // Twins with no level double track in reach stand at two heights, so they become a crossing pair. Where the
  // other track runs within 12 m all along the platform, the stop moves to the nearest such spot within 100 m, and
  // the partner rides on its master's chord in st.rides, so the two tracks keep their spacing through the station.

  if (twins.length && !(spots[0]?.k < Infinity)) {
    const by = s => edge(s) >= HALF + EASES[0] && clearOf(R, s) >= 30 &&
      twins.every(o => [-HALF, 0, HALF].every(d => footOn(o.route.path, atS(R, s + d)).d < 12));
    let at;
    for (let d = 0; d <= 100 && at === undefined; d += 4) at = [st.s + d, st.s - d].find(by);
    for (const o of twins) { delete o.of; o.cross = st; st.cross = o; if (at !== undefined) o.rides = st; }
    twins = [];
    spots = [{ s: at ?? st.s, k: 0 }];
  }
  const need = twins.length || STATIONS.some(o => o.rides === st) ? 71 : 64, fits = (s, E) => edge(s) >= HALF + E && (({ pulled, was }) => pulled >= Math.min(need, was))(tightest(R, s, E));
  const fit = EASES.flatMap(E => spots.filter(p => p.k < Infinity).map(p => ({ ...p, E }))).find(p => fits(p.s, p.E));
  st.s = fit?.s ?? (spots[0]?.k < Infinity ? spots[0].s : st.s);
  st.ease = fit?.E ?? EASES.filter(E => edge(st.s) >= HALF + E).at(-1) ?? EASES[0];
  const p = atS(R, st.s);
  for (const o of STATIONS.filter(o => o.of === st || o.rides === st)) o.s = nearestU(o.route, p.x, p.z).u * o.route.len;
}

// Track of another route within 12 m of a station's moved track, and within 30° of its heading, moves with it unless
// its own station moves it. The move fades out from 8 m to 12 m, so double track keeps its spacing through the
// station and twins ride on their master's chord.

const headOf = (P, i) => { const a = flatAt(P, i - 1), b = flatAt(P, i + 1), L = flat2(a, b) || 1; return [(b.x - a.x) / L, (b.z - a.z) / L]; };
const PULL = new Map();
for (const R of ROUTES) {
  const P = R.path, n = P.length, cum = [0];
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + P[i - 1].distanceTo(P[i % n]));
  const k = R.len / cum[R.closed ? n : n - 1];
  const own = STATIONS.filter(st => st.route === R && !st.of && !st.rides).map(st => ({ s: st.s, E: st.ease, a: atS(R, st.s - HALF), b: atS(R, st.s + HALF) }));
  if (!own.length) continue;
  PULL.set(R, { own, D: P.map((p, i) => {
    let x = p.x, z = p.z;
    for (const { s, E, a, b } of own) {
      let d = Math.abs(cum[i] * k - s);
      if (R.closed) d = Math.min(d, R.len - d);
      const w = 1 - smooth(HALF, HALF + E, d);
      if (w <= 0) continue;
      const dx = b.x - a.x, dz = b.z - a.z, t = ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz);
      x += (a.x + t * dx - x) * w;
      z += (a.z + t * dz - z) * w;
    }
    return [x - p.x, z - p.z];
  }) });
}
const shift = new Map(ROUTES.map(R => [R, PULL.get(R)?.D.map(v => [...v]) ?? R.path.map(() => [0, 0])]));
for (const [R, { own, D }] of PULL) {
  const P = R.path, mid = own.map(({ s, E }) => ({ c: atS(R, s), E }));
  for (const Q of ROUTES) if (Q !== R) Q.path.forEach((q, j) => {
    const mine = PULL.get(Q)?.D[j];
    if (mine && (mine[0] || mine[1]) || !mid.some(({ c, E }) => flat2(c, q) < HALF + E + 30)) return;
    const f = footOn(P, q), h = headOf(Q.path, j);
    if (f.d >= 12 || Math.abs(h[0] * f.tx + h[1] * f.tz) <= COS30) return;
    // The offset from the foot turns with the track, so double track keeps its spacing through the ease.

    const i1 = (f.i + 1) % P.length, [ax, az] = D[f.i], [bx, bz] = D[i1], k = 1 - smooth(8, 12, f.d), v = shift.get(Q)[j];
    const nx = P[i1].x + bx - P[f.i].x - ax, nz = P[i1].z + bz - P[f.i].z - az, L = Math.hypot(nx, nz) || 1;
    const cos = (f.tx * nx + f.tz * nz) / L, sin = (f.tx * nz - f.tz * nx) / L, ox = q.x - f.x, oz = q.z - f.z;
    v[0] += (lerp(ax, bx, f.t) + ox * cos - oz * sin - ox) * k;
    v[1] += (lerp(az, bz, f.t) + ox * sin + oz * cos - oz) * k;
  });
}

// A station on a route its partner moved keeps its place on the ground, not its distance along the route.

const nudged = new Set(), moveAt = new Map();
for (const R of ROUTES) if (shift.get(R).some((v, i) => v[0] !== (PULL.get(R)?.D[i][0] ?? 0) || v[1] !== (PULL.get(R)?.D[i][1] ?? 0))) nudged.add(R);
for (const st of STATIONS) if (nudged.has(st.route)) {
  const p = atS(st.route, st.s), v = shift.get(st.route)[nearestOn(st.route.path, p).k];
  moveAt.set(st, [p.x + v[0], p.z + v[1]]);
}
for (const R of ROUTES) {
  const v = shift.get(R);
  if (v.every(([x, z]) => !x && !z)) continue;
  R.path.forEach((p, i) => { p.x += v[i][0]; p.z += v[i][1]; });
  R.curve.updateArcLengths();
  R.len = R.curve.getLength();
}

// A lollipop's last sample sits on its stem at the switch again once the pulls have moved it.

for (const R of ROUTES) if (R.balloon) { R.path.at(-1).copy(R.path[R.balloon.m]); R.curve.updateArcLengths(); R.len = R.curve.getLength(); }

// A pull beside a loop can tighten the loop's bend where it eases onto its partner, and a pull can bend a
// lollipop's balloon. The bend eases again before the pins re-project. Pinned samples, the samples a pin stands
// beside, samples within 8 m of a platform's end and a lollipop's stem stay put.

const partner = new Map(ROUTES.map(R => [R.path, new Set()]));
for (const R of ROUTES) for (const p of R.path) if (p.pin) { const f = footOn(p.beside, p), n = p.beside.length; partner.get(p.beside)?.add(f.i).add((f.i + 1) % n); }
for (const R of ROUTES.filter(R => R.lap || R.balloon)) {
  const P = R.path, n = P.length, cum = [0], B = R.balloon;
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + flat2(P[i - 1], P[i]));
  const k = R.len / (cum[n - 1] + (R.closed ? flat2(P[n - 1], P[0]) : 0)), stops = STATIONS.filter(st => st.route === R).map(st => st.s);
  const off = i => stops.every(s => { const d = Math.abs(cum[i] * k - s); return (R.closed ? Math.min(d, R.len - d) : d) > HALF + 8; });
  const loose = P.map((p, i) => !p.pin && !partner.get(P).has(i) && off(i) && (!B || i > B.m && i < n - 1));
  if ((B ? unbendBalloon : unbend)(P, loose, Math.round(20 * n / R.len)).size) { R.curve.updateArcLengths(); R.len = R.curve.getLength(); }
}

// A pinned sample keeps 6.8 m beside its partner, whose samples may lie too far apart to follow a station's ease.

for (const R of ROUTES) if (R.path.some(p => p.pin)) {
  for (const p of R.path) if (p.pin) {
    const f = footOn(p.beside, p), k = 6.8 / (f.d || 1);
    p.x = f.x + (p.x - f.x) * k;
    p.z = f.z + (p.z - f.z) * k;
  }
  R.curve.updateArcLengths();
  R.len = R.curve.getLength();
}

for (const [st, [x, z]] of moveAt) {
  const { R, u } = nearestU(st.route, x, z);
  let best = { k: Infinity };
  for (let d = -3; d <= 3; d += .25) { const v = routeU(R, u + d / R.len), p = R.curve.getPointAt(v), k = Math.hypot(p.x - x, p.z - z); if (k < best.k) best = { k, v }; }
  st.s = best.v * R.len;
}

// A station's pull shortens some spans. Each track eases back under the 8% grade by lowering the higher end, or
// under LOOP_G on a loop's steep samples. Closed tracks wrap at the seam.

for (const R of ROUTES) {
  const P = R.path, n = P.length;
  for (let pass = 0; pass < 2; pass++) for (const dir of [1, -1]) for (let k = 0; k < n; k++) {
    const i = dir > 0 ? k : n - 1 - k, j = R.closed ? (i - dir + n) % n : i - dir;
    if (j < 0 || j >= n) continue;
    P[i].y = Math.min(P[i].y, P[j].y + (P[i].steep || P[j].steep ? LOOP_G : G) * flat2(P[i], P[j]));
  }
  R.curve.updateArcLengths();
  R.len = R.curve.getLength();
}
for (const st of STATIONS) st.u = st.s / st.route.len;

// A pinned sample that the grade pass lowered off its partner's deck by more than 0.5 m lets go of that deck. It
// keeps its place beside the partner, and letGo marks it for the network check.

for (const R of ROUTES) for (const p of R.path) if (p.pin && Math.abs(p.y - footOn(p.beside, p).y) > .5) Object.assign(p, { pin: false, letGo: true });

// R.balloon gives the stem's length to the switch, switchS. The balloon runs from loopFrom to loopTo, the route's
// end, back at the switch. switchS, loopFrom and land name the same point, where a train runs on from the end
// back down the stem. The last sample sits on the stem again after the grade pass.

for (const R of ROUTES) if (R.balloon) {
  const P = R.path, { m } = R.balloon;
  P.at(-1).copy(P[m]);
  R.curve.updateArcLengths();
  R.len = R.curve.getLength();
  let s = 0;
  for (let i = 1; i <= m; i++) s += P[i].distanceTo(P[i - 1]);
  const total = P.reduce((a, p, i) => a + (i ? p.distanceTo(P[i - 1]) : 0), 0), at = s / total * R.len;
  Object.assign(R.balloon, { switchS: at, loopFrom: at, loopTo: R.len, land: at });
  for (const st of STATIONS.filter(st => st.route === R)) st.u = st.s / R.len;
}

// ---------- the hall's tunnels ----------
// A loop sample is deep where its deck lies more than 6 m under the ground. UNDER maps each loop route to its deep
// spans, as [from, to] in metres along it, sampled every 2 m. A span across the seam ends before it starts. Each
// span end has a portal on its open side, where the deck meets the ground. The portal's hood runs from there to
// the span end and covers the train until the deck lies deep.

const deep = p => p.y < groundAt(p.x, p.z) - 6;
export const UNDER = new Map(), PORTALS = [];
if (HALL) for (const R of ROUTES.filter(R => R.lap)) {
  const N = Math.ceil(R.len / 2), at = k => R.curve.getPointAt(((k % N) + N) % N / N), d = Array.from({ length: N }, (_, k) => deep(at(k)));
  const spans = [];
  for (let k = 0; k < N; k++) if (d[k] && !d[(k + N - 1) % N]) { let e = k; while (d[(e + 1) % N] && e < k + N - 1) e++; spans.push([k, e]); }
  UNDER.set(R, spans.map(([a, b]) => [a / N * R.len, (b % N) / N * R.len]));
  for (const [a, b] of spans) for (const [e, dir] of [[a, -1], [b, 1]]) {
    let k = e;
    while (at(k).y < groundAt(at(k).x, at(k).z) && Math.abs(k - e) < 200) k += dir;
    const p = at(k), hood = [];
    for (let j = k; j !== e; j -= dir) hood.push(at(j));
    PORTALS.push({ route: R, x: p.x, y: groundAt(p.x, p.z), z: p.z, hood: [...hood, at(e)] });
  }
}

// Portals whose mouths stand within 15 m share one hood. A bundle's line runs down the middle of its hoods from
// the mouth to the deep end. Each line point holds the lowest deck there and hw, the half width inside the walls.

export const BUNDLES = [];
for (const p of PORTALS) {
  const b = BUNDLES.find(b => b.portals.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 15));
  if (b) b.portals.push(p); else BUNDLES.push({ portals: [p] });
}
for (const b of BUNDLES) {
  const [first, ...rest] = b.portals;
  b.line = first.hood.map(a => {
    const qs = rest.map(r => r.hood.reduce((m, q) => flat2(a, q) < flat2(a, m) ? q : m));
    const x = [a, ...qs].reduce((v, q) => v + q.x, 0) / (qs.length + 1), z = [a, ...qs].reduce((v, q) => v + q.z, 0) / (qs.length + 1);
    return { x, z, deck: Math.min(a.y, ...qs.map(q => q.y)), hw: 4.7 + Math.max(0, ...qs.map(q => flat2(a, q) / 2)) };
  });
  b.hw = Math.max(...b.line.map(q => q.hw));

  // The ground opens inside the walls along the hood's chord, so the trench shows from the street.

  const m = b.line[0], e = b.line.at(-1), L = flat2(m, e), tx = (e.x - m.x) / L, tz = (e.z - m.z) / L;
  const dev = Math.max(...b.line.map(q => Math.abs((q.x - m.x) * tz - (q.z - m.z) * tx)));
  addHole((m.x + e.x) / 2, (m.z + e.z) / 2, Math.atan2(tx, tz), Math.max(1, 2 * (b.hw - .6 - dev)), L);
}

export const concrete = new THREE.MeshStandardMaterial({ color: 0x2c313a, roughness: .85, metalness: .1, side: THREE.DoubleSide });
export const steel = new THREE.MeshStandardMaterial({ color: 0x6a7280, roughness: .35, metalness: .8, side: THREE.DoubleSide });
// Track and highway sweeps collect per material and draw as one mesh each, once the highways are laid. In a pack
// with a hall, loop track keeps meshes of its own, marked under, so it still draws while the hall hides the city.

const SWEEPS = new Map(), LAP_SWEEPS = new Map();
const addSweep = (geo, mat, to = SWEEPS) => { if (!to.has(mat)) to.set(mat, []); to.get(mat).push(geo); };
if (HAS_LOOP) {
  addSweep(sweep(pts, [[-3.2, 0], [3.2, 0], [2.4, -2.8], [-2.4, -2.8]]), concrete);
  for (const s of [-1, 1]) addSweep(sweep(pts, [[s * 1.3, 0], [s * 2.1, 0], [s * 2.1, .7], [s * 1.3, .7]]), steel);
  scene.add(new THREE.Mesh(sweep(pts, [[-2.42, -2.82], [2.42, -2.82], [2.42, -2.9], [-2.42, -2.9]]),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(.1, .3, .4), side: THREE.DoubleSide })));
}
for (const { path, closed = false, lap } of SPURS) {
  const to = lap && HALL ? LAP_SWEEPS : SWEEPS;
  addSweep(sweep(path, [[-3.2, 0], [3.2, 0], [2.4, -2.8], [-2.4, -2.8]], closed), concrete, to);
  for (const s of [-1, 1]) addSweep(sweep(path, [[s * 1.3, 0], [s * 2.1, 0], [s * 2.1, .7], [s * 1.3, .7]], closed), steel, to);
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
  for (const { curve, len, lap } of SPURS) for (let u = .02; u < 1; u += 46 / len) {
    while (u < 1 && onHighway(curve.getPointAt(u).x, curve.getPointAt(u).z)) u += 4 / len;
    if (u >= 1) break;
    const p = curve.getPointAt(u), t = curve.getTangentAt(u), top = p.y - 2.8;
    if (HALL && lap && p.y < groundAt(p.x, p.z) + 5) continue;
    prop('box', p.x, top - .9, p.z, 9, 1.8, 3.2, [.06, .065, .075], Math.atan2(t.x, t.z));
    if (offshore(p.x, p.z)) stilts(p, t, top - 1.8);
    else prop('cyl', p.x, (top - 1.8) / 2, p.z, 2.8, top - 1.8, 2.8, [.06, .065, .075]);
    glow(p.x, top - 1.9, p.z, .5, .2, .5, [.3, .7, 1.0]);
  }

  // A bundle's hood stands over its tracks from the mouth to where the decks lie deep. Its walls reach down past
  // the decks, so the cut in the ground shows a trench going down. Lit frames step down the trench with the decks.
  // A cyan lintel and an amber hazard band mark the mouth. An end wall closes the hood above the tunnel.

  const DECK = [.05, .06, .085];
  for (const { line, hw } of BUNDLES) {
    for (let j = 0; j + 2 < line.length; j += 2) {
      const a = line[j], b = line[j + 2], cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2, L = flat2(a, b) || 1, tx = (b.x - a.x) / L, tz = (b.z - a.z) / L;
      const g = groundAt(cx, cz), ry = Math.atan2(tx, tz), low = Math.min(a.deck, b.deck) - 3.2, wall = g + 6.8 - low;
      prop('box', cx, g + 6.8, cz, 2 * hw, .6, L + .3, DECK, ry);
      for (const s of [-1, 1]) prop('box', cx + tz * s * (hw - .25), low + wall / 2, cz - tx * s * (hw - .25), .5, wall, L + .3, DECK, ry);
      prop('box', cx, (a.deck + b.deck) / 2 - 3.1, cz, 2 * hw, .4, L + .3, DECK, ry, Math.atan2(a.deck - b.deck, L));
      if (j % 4) continue;
      const top = Math.min(a.deck + 6, g + 6.2), h = top - a.deck - .6;
      if (h < 1) continue;
      glow(a.x, top, a.z, 2 * hw - 1.2, .2, .3, [.2, .55, .8], ry);
      for (const s of [-1, 1]) glow(a.x + tz * s * (hw - .6), a.deck + .6 + h / 2, a.z - tx * s * (hw - .6), .2, h, .3, [.2, .55, .8], ry);
    }
    const yaw = (a, b) => Math.atan2(b.x - a.x, b.z - a.z), m = line[0], ry = yaw(m, line[1]), tx = Math.sin(ry), tz = Math.cos(ry), g = groundAt(m.x, m.z);
    glow(m.x, g + 6.2, m.z, 2 * hw - 1, .35, .25, [.25, .9, 1.4], ry);
    for (let u = -hw + .8; u < hw - .4; u += 1.6) glow(m.x + tz * u, g + 7.25, m.z - tx * u, .8, .3, .3, [1, .42, .03], ry);
    const e = line.at(-1), ge = groundAt(e.x, e.z);
    prop('box', e.x, (e.deck + 6 + ge + 6.8) / 2, e.z, 2 * hw, ge + 6.8 - e.deck - 6, .5, DECK, yaw(line.at(-3), e));
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

// Maglev carriages are streamlined. Each car lofts one rounded cross-section along its length, inside the old
// 3.4 x 2.8 x 11.2 m box, so clearances hold. The end cars taper to a low nose over their front 5 m; the rear
// car is a nose car turned round. Body cars and nose cars each share two instanced meshes, the lit hull and its
// glowing windows, stripe and roof line. End cars share one more mesh for their lamps, white at the front and red
// at the rear by instance colour. A carriage is a holder object; its lookAt writes the instance
// matrix, and uploadTrains sends them once a frame.

const arc = (cx, cy, r, a0) => Array.from({ length: 7 }, (_, k) => {
  const a = (a0 + k * 15) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});
const PROFILE = [...arc(1.35, -1.05, .35, -90), ...arc(.7, .4, 1, 0), ...arc(-.7, .4, 1, 90), ...arc(-1.35, -1.05, .35, 180)];
const NOSE = .6;

// A ring places the profile at z, scaled by sx across and sy up about cy. Along a nose the roof drops and the
// sides pull in faster than the floor rises. A body ring keeps the full section.

const ring = (z, nose = true) => {
  const t = nose ? Math.max(0, (z - NOSE) / (5.6 - NOSE)) : 0, top = 1.4 - 2.2 * t ** 1.5, bottom = -1.4 + .45 * t * t;
  return { z, sx: Math.max(.06, Math.sqrt(1 - t ** 2.5)), sy: (top - bottom) / 2.8, cy: (top + bottom) / 2 };
};
const rings = (z0, z1, nose) => {
  const a = nose ? Math.max(z0, NOSE) : z1;
  return [ring(z0, !!nose), ...nose ? Array.from({ length: 11 }, (_, i) => ring(a + (z1 - a) * i / 10)).filter(r => r.z > z0) : [ring(z1, false)]];
};

// loft sweeps a profile through rings. A closed profile can cap both ends.

function loft(profile, R, closed = false, caps = false) {
  const n = profile.length, pos = [], idx = [];
  for (const r of R) for (const [x, y] of profile) pos.push(x * r.sx, r.cy + y * r.sy, r.z);
  const m = closed ? n : n - 1;
  for (let i = 0; i < R.length - 1; i++) for (let k = 0; k < m; k++) {
    const a = i * n + k, b = i * n + (k + 1) % n, c = a + n, d = b + n;
    idx.push(a, b, c, b, d, c);
  }
  if (caps) for (const [r, back] of [[R[0], 1], [R.at(-1), 0]]) {
    const o = pos.length / 3;
    pos.push(0, r.cy, r.z);
    for (const [x, y] of profile) pos.push(x * r.sx, r.cy + y * r.sy, r.z);
    for (let k = 0; k < n; k++) idx.push(o, o + 1 + (back ? (k + 1) % n : k), o + 1 + (back ? k : (k + 1) % n));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const side = (y0, y1) => [-1, 1].map(s => [[s * 1.705, y0], [s * 1.705, y1]]);
const tint = (g, rgb) => g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => rgb).flat(), 3));
const litGeo = nose => mergeGeometries([
  ...side(-.05, .55).map(p => tint(loft(p, rings(-4.8, nose ? .4 : 4.8)), [.95, .85, .6])),
  ...side(-1, -.82).map(p => tint(loft(p, rings(-5.6, 5.6, nose)), [.2, .8, 1.2])),
  tint(loft([[.12, 1.405], [-.12, 1.405]], rings(-5.6, 5.6, nose)), [.15, .5, .8]),
]);
const HULL = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, roughness: .3, metalness: .7, side: THREE.DoubleSide });
const LIT = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
const TRAINS = [false, true].map(nose => {
  const hull = new THREE.InstancedMesh(loft(PROFILE, rings(-5.6, 5.6, nose), true, true), HULL, 600);
  const lit = new THREE.InstancedMesh(litGeo(nose), LIT, 600);
  for (const m of [hull, lit]) { m.count = 0; m.frustumCulled = false; m.userData.moves = m.userData.under = true; scene.add(m); }
  return [hull, lit];
});
const LAMPS = new THREE.InstancedMesh(mergeGeometries(side(-.82, -.6).map(p => loft(p, rings(4.4, 5.6, true)))), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 1.8), side: THREE.DoubleSide }), 600);
LAMPS.count = 0; LAMPS.frustumCulled = false; LAMPS.userData.moves = LAMPS.userData.under = true; scene.add(LAMPS);
const HEAD = new THREE.Color(1, 1, 1), TAIL = new THREE.Color(1, .05, .04);

// end is 1 for a front car, -1 for a rear car and 0 for a body car. A rear car looks away from its target.

export function carriage(end = 0) {
  const [hull, lit] = TRAINS[+!!end], i = hull.count++, o = new THREE.Object3D(), look = o.lookAt.bind(o), _t = new THREE.Vector3();
  lit.count = hull.count;
  const l = end ? LAMPS.count++ : -1;
  if (end) { LAMPS.setColorAt(l, end > 0 ? HEAD : TAIL); LAMPS.instanceColor.needsUpdate = true; }
  o.lookAt = t => {
    look(end < 0 ? _t.copy(o.position).multiplyScalar(2).sub(t) : t); o.updateMatrix();
    hull.setMatrixAt(i, o.matrix); lit.setMatrixAt(i, o.matrix);
    if (end) LAMPS.setMatrixAt(l, o.matrix);
  };
  return o;
}
export const uploadTrains = () => { for (const ms of TRAINS) ms.forEach(uploadUsed); uploadUsed(LAMPS); };

// The cab stands in for the ridden lead car. Its walls let 70% of the city through, its nose is curved glass
// and its floor is solid. Thin lit ribs ring the body twice, and a lit sill runs low along both walls into the nose.

const CAB_HULL = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, roughness: .3, metalness: .7, transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide });
const CAB_GLASS = new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: .05, metalness: .2, transparent: true, opacity: .08, depthWrite: false, side: THREE.DoubleSide });
const CAB_FLOOR = new THREE.MeshStandardMaterial({ color: 0x3a3f48, roughness: .8, side: THREE.DoubleSide });
const CAB_RIB = new THREE.MeshBasicMaterial({ color: new THREE.Color(.05, .18, .26), side: THREE.DoubleSide });
const cabHull = new THREE.Mesh(loft(PROFILE, rings(-5.6, NOSE)), CAB_HULL);
const cabGlass = new THREE.Mesh(mergeGeometries([loft(PROFILE, rings(NOSE, 5.6, true), true, true), loft(PROFILE, [ring(-5.6), ring(-5.59)], true, true)]), CAB_GLASS);
const cabFloor = new THREE.Mesh(loft([[1.45, -1.2], [-1.45, -1.2]], rings(-5.6, 4.4, true)), CAB_FLOOR);
const cabRibs = new THREE.Mesh(mergeGeometries([
  ...[-4, -1].map(z => loft(PROFILE.map(([x, y]) => [x * .995, y * .995]), [ring(z - .015), ring(z + .015)], true)),
  ...[1, -1].map(s => loft([[s * 1.69, -.35], [s * 1.69, -.32]], rings(-5.6, 5.6, true))),
]), CAB_RIB);
cabHull.name = 'hull';
export const cab = new THREE.Group().add(cabHull, cabGlass, cabFloor, cabRibs);
cab.visible = false;
cab.userData.under = true;
scene.add(cab);

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

// A loop's deep samples hold no corridor, so a loop with tunnels lays as the open stretches between them. A sample
// below the ground clears from the ground, so no building stands on a portal's hood.

for (const R of ROUTES) if (!R.loop) {
  const { curve, closed } = R;
  if (!UNDER.get(R)?.length) { corridor(curve, 'maglev', 6, 5, 5); CORRIDORS.at(-1).closed = closed; continue; }
  const p = curve.getSpacedPoints(Math.ceil(curve.getLength() / 3)).slice(0, -1), k = p.findIndex(deep);
  if (k < 0) { corridor(curve, 'maglev', 6, 5, 5); CORRIDORS.at(-1).closed = closed; continue; }
  let run = [];
  for (const q of [...p.slice(k), ...p.slice(0, k), null]) {
    if (q && !deep(q)) { run.push(q.setY(Math.max(q.y, groundAt(q.x, q.z)))); continue; }
    if (run.length > 1) corridor(null, 'maglev', 6, 5, 5, run);
    run = [];
  }
}
for (const h of HIGHWAYS) corridor(new THREE.CatmullRomCurve3(h.path), 'highway', 10, 3, 4);

for (const st of STATIONS) {
  const L = STATION_LEN + 24, p = Array.from({ length: 31 }, (_, i) => st.route.curve.getPointAt(routeU(st.route, st.u + (i / 30 - .5) * L / st.route.len)))
    .filter(q => !UNDER.get(st.route)?.length || !deep(q));
  if (p.length > 1) corridor(null, 'station', 16, 4, 15, p);
}

// ?twin=x,z,d lays a test guideway d metres to the left of the nearest maglev, for 150 m each way round x, z.
// The checks use it to force double track through a building.

const TWIN = new URLSearchParams(location.search).get('twin')?.split(',').map(Number);
if (TWIN) {
  const [x, z, d] = TWIN, near = CORRIDORS.filter(L => L.kind === 'maglev').flatMap(L => L.s).reduce((a, q) => Math.hypot(q.x - x, q.z - z) < Math.hypot(a.x - x, a.z - z) ? q : a);
  const s = near.line.s.slice(Math.max(1, near.i - 50), near.i + 50);
  corridor(null, 'maglev', 6, 5, 5, s.map(q => {
    const o = near.line.s[q.i - 1], tx = q.x - o.x, tz = q.z - o.z, tl = Math.hypot(tx, tz) || 1;
    return new THREE.Vector3(q.x + tz / tl * d, q.y, q.z - tx / tl * d);
  }));
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
for (const [map, under] of [[SWEEPS, false], [LAP_SWEEPS, true]]) for (const [mat, list] of map) {
  const m = new THREE.Mesh(mergeGeometries(list), mat);
  if (under) m.userData.under = true;
  scene.add(m);
  for (const g of list) g.dispose();
}

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
