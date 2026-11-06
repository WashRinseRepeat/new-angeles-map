// The Beanstalk hall below the Root, and the tunnels that bring the Grand Loop and the Center Loop into it.
// The hall is a horn of the Root's own steel and lit windows. It rises from a wide floor round the tether, over a
// low canopy above the tracks, to a throat at the crown, where the tether leaves for the sky. The tunnels are low
// and dim, with lit rings overhead, neon adverts on the walls and openings into the anchor's machinery.
// Hall and tunnels draw only while the camera is below ground or inside a hood. In and near the hall the city
// stops drawing too, so the hall may rise past the ground. Local origin is the Root at ground level. Angle a
// gives (cos a, sin a).

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUNDLES, HALL, ROUTES, STATIONS, STATION_LEN, UNDER } from '../../../engine/transport.js';
import { groundAt } from '../../../engine/relief.js';
import { camera, labels, scene } from '../../../engine/render.js';
import { billboards } from '../../../engine/instances.js';

const TAU = Math.PI * 2;

// Adverts and wayfinding boards, as neon text lines and a colour.

const ADS = [
  [['HAAS-BIOROID', 'LABOR OF LOVE'], '#3ff2ff'], [['JINTEKI', 'PERFECTION, GROWN'], '#ff3fa4'], [['NBN', 'ALWAYS ON'], '#ffb43f'],
  [['WEYLAND CONSORTIUM', 'BUILDING TOMORROW'], '#7dff6a'], [['MELANGE MINING', 'HELIUM-3 FOR EARTH'], '#ff5f3f'],
  [['EARTH STATION', '23 MINUTES TO ORBIT'], '#ffffff'], [['HEINLEIN', 'THE MOON IS OPEN'], '#b07dff'], [['MARS DIRECT', 'NOW BOARDING'], '#ff5f3f'],
  [['ZERO-G SPA', 'FLOAT AWAY'], '#3ff2ff'], [['TITAN TRANSNATIONAL', 'MOVING THE WORLD'], '#ffb43f'], [['GRNDL', 'POWER THE CITY'], '#7dff6a'],
  [['SYNC', 'STAY CONNECTED'], '#ff3fa4'], [['BLUE SUN', 'CLEAN ENERGY'], '#3ff2ff'], [['ELI-1000', 'MEET YOUR NEW PARTNER'], '#b07dff'],
  [['HAAS ARCOLOGY', 'LIVE ABOVE IT ALL'], '#ffffff'], [['NEW ANGELES SOL', 'GO SOL!'], '#ffb43f'], [['NOODLES 24H', 'CHEAP AND HOT'], '#ff5f3f'],
  [['SPARK AGENCY', 'SEE MORE'], '#ff3fa4'], [['CLONE CARE', 'YOUR BEST SELF'], '#7dff6a'], [['ORBITAL HOTEL', 'BOOK THE VIEW'], '#3ff2ff'],
];
const WAYS = [
  [['THE BEANSTALK'], '#ffffff'], [['GRAND LOOP'], '#3ff2ff'], [['CENTER LOOP'], '#ffb43f'], [['CLIMBER DOCKS', 'UP AND DOWN'], '#7dff6a'],
  [['EARTH STATION', 'BY CLIMBER'], '#ffffff'], [['ROOT ANCHOR', 'TENSION PLANT'], '#ffb43f'], [['NO ENTRY', 'ANCHOR WORKS'], '#ff5f3f'],
];

// A beanpod is a capsule r in radius and 2 h tall, with two lit window bands, a cyan stripe, a beacon and two
// clamps on its tether side. Local +x faces out. Every climber carries one.

export function beanpod(THREE, C, r = 6, h = 10.5) {
  const part = (g, rgb) => {
    g = g.index ? g.toNonIndexed() : g;
    g.deleteAttribute('uv');
    if (rgb) g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => rgb).flat(), 3));
    return g;
  };
  const box = (w, bh, d, x, y, z) => new THREE.BoxGeometry(w, bh, d).translate(x, y, z);
  const body = mergeGeometries([new THREE.CapsuleGeometry(r, 2 * (h - r), 8, 24), ...[-4, 4].map(y => box(1.6, 3, 2.4, -r - .6, y, 0))].map(g => part(g)));
  const lit = mergeGeometries([
    ...[-1.5, 3].map(y => part(new THREE.CylinderGeometry(r + .08, r + .08, 1.6, 32, 1, true).translate(0, y, 0), C.WARM)),
    part(box(.3, 9, 1.6, r + .05, -1, 0), C.CYAN), part(box(1.4, 1.4, 1.4, 0, h + .6, 0), C.WHITE),
  ]);
  return { body, lit, r, h };
}

// A climber is a drive frame that clamps the ribbon, with one beanpod hanging below it. Its origin sits on the
// ribbon's axis and its frame on the +z face. The frame scales with the ribbon by CLIMBER_SCALE, so the grips close
// round the edge cables at x = ±5.88. The pod keeps its full size, 1.3 times the 6 m hall pod, and the frame's
// depth offsets keep the old values, so the frame clears the ribs and reaches the pod. Lit strips run on the grips
// and the frame, with a red light to port and a green one to starboard. pod is the beanpod's centre.
// The hall's pods, the Root's climbers and the tour pod share it.

export const CLIMBER_SCALE = .7;
export function climber(THREE, C) {
  const S = CLIMBER_SCALE, P = beanpod(THREE, C, 6 * 1.3, 10.5 * 1.3), PY = -6 * S - P.h, PZ = P.r + 2.3;
  const box = (w, h, d, x, y, z, rgb) => {
    const g = new THREE.BoxGeometry(w * S, h * S, d * S).translate(x * S, y * S, z).toNonIndexed();
    g.deleteAttribute('uv');
    if (rgb) g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => rgb).flat(), 3));
    return g;
  };
  const hang = g => g.clone().rotateY(-Math.PI / 2).translate(0, PY, PZ);
  const body = mergeGeometries([
    box(22, 6, 3, 0, 0, 3.2), ...[-8.4, 8.4].map(x => box(5, 9, 6, x, 0, .8 * S)), box(18, 3, 7, 0, 4.4, 5),
    box(4, 3, (PZ - 3) / S, 0, -4.5, (PZ + 3) / 2), hang(P.body),
  ]);
  const lit = mergeGeometries([
    box(17, .6, .4, 0, 6, 5 + 3.5 * S + .15, C.WHITE), box(.8, .8, .8, -11.4, 0, 3.2, [3, .2, .1]), box(.8, .8, .8, 11.4, 0, 3.2, C.GREEN),
    ...[-1, 1].map(s => box(.3, 7, 4, s * 10.95, 0, .8 * S, C.WARM)), hang(P.lit),
  ]);
  return { body, lit, pod: [0, PY, PZ], r: P.r, h: P.h };
}

export function hall(H, look) {
  const THREE = H.THREE, C = look.rgb, r = H.rng(5150);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const OX = HALL.x, OZ = HALL.z, FLOOR = HALL.y - .3, RG = HALL.r, TOP = look.top, RO = 30, KR = 205, KY = 30;
  const polar = (rad, a, y = 0) => V3(Math.cos(a) * rad, y, Math.sin(a) * rad);
  const inward = a => Math.atan2(-Math.cos(a), -Math.sin(a));

  // Geometry bins, merged into one mesh per material. A bin with colours takes rgb on every piece.

  const bins = {};
  const add = (key, g, rgb) => {
    g = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (rgb) g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => rgb).flat(), 3));
    (bins[key] ??= []).push(g);
  };
  const box = (w, h, d, x, y, z, ry = 0) => new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z);
  const _o = new THREE.Object3D();
  const beam = (a, b, w, h) => {
    const g = new THREE.BoxGeometry(w, h, a.distanceTo(b));
    _o.position.copy(a).add(b).multiplyScalar(.5); _o.lookAt(b); _o.updateMatrix();
    return g.applyMatrix4(_o.matrix);
  };

  // ---------- the loops below ground, in local metres ----------
  // A sample holds the deck point p, the flat tangent t and the side n that sweep() offsets along.

  const laps = ROUTES.filter(R => R.lap && UNDER.get(R)?.length);
  if (!laps.length) return null;
  const sample = (R, s) => {
    const u = ((s / R.len) % 1 + 1) % 1, p = R.curve.getPointAt(u), t = R.curve.getTangentAt(u).setY(0).normalize();
    return { R, s, p: p.sub(V3(OX, 0, OZ)), t, n: V3(-t.z, 0, t.x) };
  };
  const spans = new Map(laps.map(R => [R, UNDER.get(R).map(([a, b]) => {
    const out = [];
    for (let s = a, e = b < a ? b + R.len : b; s <= e; s += 2) out.push(sample(R, s));
    return out;
  })]));
  const deep = [...spans.values()].flat(2), flat = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
  const clear = (x, z, d) => deep.every(q => Math.hypot(q.p.x - x, q.p.z - z) > d);

  // Where the tracks cross the hall's wall. Crossings within 15 m share one opening, hw wide on each side.

  const cross = [];
  for (const q of deep) {
    const o = deep.find(o => o.R === q.R && Math.abs(o.s - q.s - 2) < .01);
    if (!o || (Math.hypot(q.p.x, q.p.z) - RG) * (Math.hypot(o.p.x, o.p.z) - RG) > 0) continue;
    const near = cross.find(c => flat(c.ps[0], q.p) < 15);
    if (near) near.ps.push(q.p); else cross.push({ R: q.R, ps: [q.p], t: q.t.clone().multiplyScalar(Math.sign(Math.hypot(o.p.x, o.p.z) - Math.hypot(q.p.x, q.p.z))) });
  }
  for (const c of cross) {
    c.p = c.ps.reduce((a, p) => a.add(p), V3(0, 0, 0)).multiplyScalar(1 / c.ps.length);
    c.n = V3(-c.t.z, 0, c.t.x);
    c.hw = 4.2 + Math.max(...c.ps.map(p => Math.abs(p.clone().sub(c.p).dot(c.n))));
  }
  const inOpening = (x, z) => cross.some(c => {
    const dx = x - c.p.x, dz = z - c.p.z;
    return Math.abs(dx * c.n.x + dz * c.n.z) < c.hw + .6 && Math.abs(dx * c.t.x + dz * c.t.z) < 12;
  });

  // ---------- the shell ----------
  // The section runs up the outer wall, across the canopy over the tracks and up the horn to the throat. The
  // horn narrows like the Root's own spire, so the eye from the platforms runs up it into the throat.

  const hornR = y => RO + (KR - RO) * Math.pow(Math.max(0, 1 - (y - KY) / (TOP - KY)), 1.3);
  const prof = [[RG, 8]];
  for (let k = 1; k <= 6; k++) prof.push([RG + (KR - RG) * k / 6, 8 + (KY - 8) * k / 6]);
  for (let k = 1; k <= 40; k++) { const y = KY + (TOP - KY) * Math.pow(k / 40, 1.15); prof.push([hornR(y), y]); }
  const arc = prof.map((p, i) => i ? Math.hypot(p[0] - prof[i - 1][0], p[1] - prof[i - 1][1]) : 0);
  for (let i = 1; i < arc.length; i++) arc[i] += arc[i - 1];
  const lathe = (pts, seg, ku, vs, phi = 0, len = TAU) => {
    const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg, phi, len), uv = g.attributes.uv;
    for (let i = 0; i <= seg; i++) for (let j = 0; j < pts.length; j++) { const k = i * pts.length + j; uv.setXY(k, (phi + uv.getX(k) * len) / TAU * ku, vs[j]); }
    return g;
  };
  add('shell', lathe(prof, 192, 5, arc.map(a => a / 160)));

  // The outer wall below the canopy stands in half-degree panels, open where the tracks come through.

  for (let k = 0; k < 720; k++) {
    const phi = k / 720 * TAU, d = TAU / 720;
    if ([0, .25, .5, .75, 1].some(f => inOpening(Math.sin(phi + f * d) * RG, Math.cos(phi + f * d) * RG))) continue;
    add('shell', lathe([[RG, FLOOR], [RG, 8]], 1, 5, [(8 - FLOOR) / -160, 0], phi, d));
  }

  // Each opening holds the tunnel in a steel collar, with a lit frame and the loop's sign on the hall side.

  for (const c of cross) {
    const ry = Math.atan2(c.t.x, c.t.z), y = c.p.y, top = y + 6;
    for (const s of [-1, 1]) {
      const q = c.p.clone().addScaledVector(c.n, s * (c.hw + 9));
      add('steel', box(18, 8.6 - FLOOR, 16, q.x, (8.6 + FLOOR) / 2, q.z, ry));
      const j = c.p.clone().addScaledVector(c.n, s * (c.hw + .3)).addScaledVector(c.t, -8.1);
      add('glow', box(.5, top - FLOOR, .3, j.x, (top + FLOOR) / 2, j.z, ry), C.CYAN);
    }
    add('steel', box(2 * c.hw, 8.6 - top, 16, c.p.x, (8.6 + top) / 2, c.p.z, ry));
    const l = c.p.clone().addScaledVector(c.t, -8.1);
    add('glow', box(2 * c.hw + .6, .5, .3, l.x, top + .25, l.z, ry), C.CYAN);
    c.sign = { p: l.setY(top + 3.2), ry: ry + Math.PI };
  }

  // Floor: the plaza's deck, grown to the hall's width.

  const floor = new THREE.Mesh(new THREE.CircleGeometry(RG, 128).rotateX(-Math.PI / 2).translate(0, FLOOR, 0), look.deck);

  // Ribs run up the whole section, a little inside the shell, with chaser lights that pulse in toward the tether.

  const offset = prof.map(([x, y], i) => {
    const [a, b] = [prof[Math.max(0, i - 1)], prof[Math.min(prof.length - 1, i + 1)]], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    return [x - dy / L * 1.2, y + dx / L * 1.2];
  });
  for (let k = 0; k < 48; k++) {
    const a = (k + .5) / 48 * TAU, pts = [[RG - 1.2, FLOOR], ...offset].map(([x, y]) => polar(x, a, y));
    for (let i = 1; i < pts.length; i++) {
      if (i === 1 && inOpening(pts[0].x, pts[0].z)) continue;
      add('steel', beam(pts[i - 1], pts[i], 2.2, 1.6));
      const L = pts[i - 1].distanceTo(pts[i]);
      for (let f = 3; f < L; f += 7) {
        const q = pts[i - 1].clone().lerp(pts[i], f / L), dn = V3(-Math.cos(a), 0, -Math.sin(a));
        add('chaser', box(1, 1, 1.6, 0, 0, 0, -a).translate(q.x + dn.x * 1.2, q.y, q.z + dn.z * 1.2));
      }
    }
  }

  // Rings of light up the horn. Higher rings sit closer together and fade into the haze.

  const HAZE = [.32, .5, .72];
  const ring = (y, rgb) => {
    const f = THREE.MathUtils.smoothstep(y, 100, TOP), c = rgb.map((v, i) => (v * (1 - f) + HAZE[i] * f) * (1 - .45 * f));
    add('glow', new THREE.TorusGeometry(hornR(y) - 2.5, .55, 4, 160).rotateX(Math.PI / 2).translate(0, y, 0), c);
  };
  for (let y = 48; y < 150; y += 26) ring(y, C.CYAN);
  for (let y = 150, k = 0; y < TOP - 4; y += 11, k++) ring(y, k % 4 ? C.CYAN : C.WARM);
  add('glow', new THREE.TorusGeometry(KR - 1.5, .7, 4, 192).rotateX(Math.PI / 2).translate(0, KY - 1.5, 0), C.WARM);
  add('glow', new THREE.TorusGeometry(RG - .8, .4, 4, 192).rotateX(Math.PI / 2).translate(0, 7.4, 0), C.CYAN);

  // Piers hold the canopy's inner edge. They keep 12 m from the tracks and carry tall holo banners.

  const holos = [];
  const holo = (p, ry, w, h) => holos.push({ p, ry, w, h });
  for (let k = 0; k < 48; k++) {
    const a = k / 48 * TAU, p = polar(KR, a);
    if (!clear(p.x, p.z, 12)) continue;
    add('steel', box(5, KY - FLOOR, 5, p.x, (KY + FLOOR) / 2, p.z, -a));
    for (const y of [FLOOR + .4, KY - 3]) add('glow', box(5.3, .5, 5.3, p.x, y, p.z, -a), y > 0 ? C.WARM : C.CYAN);
    for (const s of [-1, 1]) holo(polar(KR + s * 2.7, a, -2), inward(a) + (s > 0 ? Math.PI : 0), 4.4, 15);
  }

  // Giant holo screens hang in the horn, facing the platforms.

  for (let k = 0; k < 8; k++) {
    const a = (k + .25) / 8 * TAU, y = 70 + (k % 2) * 34;
    holo(polar(hornR(y) - 7, a, y), inward(a), 44, 26);
  }

  // ---------- the tether and its anchor ----------

  const tether = new THREE.Mesh(look.ribbon(FLOOR, TOP), look.tether);
  tether.frustumCulled = false;
  add('steel', new THREE.CylinderGeometry(20, 24, 10, 48).translate(0, FLOOR + 5, 0));
  add('steel', new THREE.CylinderGeometry(11, 13, 22, 32).translate(0, FLOOR + 11, 0));
  add('glow', new THREE.TorusGeometry(24.2, .4, 4, 96).rotateX(Math.PI / 2).translate(0, FLOOR + 10.1, 0), C.CYAN);
  add('glow', new THREE.TorusGeometry(13.2, .35, 4, 64).rotateX(Math.PI / 2).translate(0, FLOOR + 22.1, 0), C.WARM);

  // The edge cables glow on both faces of the ribbon, from the anchor's floor to the oculus.

  const cableGlow = mergeGeometries([-1, 1].flatMap(sx => [-1, 1].map(sz => {
    const g = new THREE.BoxGeometry(.3, TOP - FLOOR, .3).translate(sx * 5.88, (TOP + FLOOR) / 2, sz * 1.4).toNonIndexed();
    g.deleteAttribute('uv');
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => C.CYAN).flat(), 3));
    return g;
  })));

  // Six struts brace the anchor, clear of the belts on the z axis.

  for (let k = 0; k < 6; k++) {
    const a = k / 6 * TAU;
    add('steel', beam(polar(22, a, FLOOR + 8), polar(40, a, FLOOR + 1), 3, 4));
    add('glow', box(.6, .6, .6, 0, 0, 0).translate(...polar(40.5, a, FLOOR + 2).toArray()), [3, .2, .1]);
  }

  // ---------- conveyors ----------
  // Two belts serve the ribbon. The up belt runs from a loading dock on the +z axis in to the +z face, the down
  // belt from the -z face out to an unloading dock on the -z axis. d is 1 on the up side and -1 on the down side.
  // A belt runs level through its dock, out of the door DOOR m from the axis, then climbs over the anchor to a level
  // end below the face. A climber rides with its pod LIFT m above the deck and stops OPEN m short of the face.

  const CL = look.climber, PY = CL.pod[1], PZ = CL.pod[2], PR = CL.r;
  const DOOR = 95, DEPTH = 32, DW = 22, DH = 40, BW = 12, OPEN = 4, YD = FLOOR + 1.5, YE = FLOOR + 24, ZE = OPEN + PZ, LIFT = CL.h + .4;
  const deckY = z => z >= DOOR ? YD : z <= ZE ? YE : YE + (YD - YE) * (z - ZE) / (DOOR - ZE);
  const deck = d => [DOOR + DEPTH - 1, DOOR, ZE, ZE - PR - 1].map(z => V3(0, deckY(z), d * z));
  const side = (p, x, y) => p.clone().add(V3(x, y, 0));
  for (const d of [1, -1]) {
    const D = deck(d);
    for (let i = 1; i < D.length; i++) {
      const a = D[i - 1], b = D[i];
      add('steel', beam(side(a, 0, -.8), side(b, 0, -.8), BW, .4));
      add('glow', beam(side(a, 0, -.45), side(b, 0, -.45), BW - .6, .1), C.DIM);
      for (const s of [-1, 1]) {
        add('steel', beam(side(a, s * (BW / 2 + .4), -.6), side(b, s * (BW / 2 + .4), -.6), .8, 1.6));
        add('glow', beam(side(a, s * (BW / 2 + .85), -.3), side(b, s * (BW / 2 + .85), -.3), .12, .3), C.CYAN.map(v => v * .5));
      }
    }
    for (let z = 30; z < DOOR - 4; z += 12) {
      const y = deckY(z) - 1.4;
      for (const s of [-1, 1]) add('steel', box(.8, y - FLOOR, .8, s * (BW / 2 + .4), (y + FLOOR) / 2, d * z));
      add('steel', box(BW + 1.6, .6, .6, 0, y - 2, d * z));
    }
    add('steel', box(BW + 1.6, 2.4, 2.4, 0, YE + .2, d * (ZE - PR - 1.9)));
    add('glow', box(BW + 1.7, .3, 2.5, 0, YE + 1, d * (ZE - PR - 1.9)), C.WARM);

    // The dock is a steel box DW wide, DH high over the deck and DEPTH deep, lit inside, with a door that drops
    // into the floor.

    const zc = d * (DOOR + DEPTH / 2), hi = YD + DH + 4;
    add('steel', box(DW + 4, hi - FLOOR, 2, 0, (hi + FLOOR) / 2, d * (DOOR + DEPTH + 1)));
    for (const s of [-1, 1]) add('steel', box(2, hi - FLOOR, DEPTH + 2, s * (DW / 2 + 1), (hi + FLOOR) / 2, zc));
    add('steel', box(DW, 4, DEPTH + 2, 0, YD + DH + 2, zc));
    add('steel', box(DW, YD - 1 - FLOOR, DEPTH, 0, (YD - 1 + FLOOR) / 2, zc));
    add('glow', box(DW - 1.4, DH - 2, .2, 0, YD + DH / 2, d * (DOOR + DEPTH - .1)), C.DIM);
    for (const s of [-1, 1]) add('glow', box(.6, DH + .4, .3, s * (DW / 2 + .3), YD + DH / 2, d * (DOOR - .2)), C.WARM);
    add('glow', box(DW + 1.2, .6, .3, 0, YD + DH + .3, d * (DOOR - .2)), C.WARM);
  }

  // A passing climber lights its dock. A soft band rings the door frame and a pool of light spreads over the floor
  // before it, fading out away from the door. The geometry stands at the up dock's door, and each dock's instance
  // colour sets its light.

  const shine = [];
  for (const s of [-1, 1]) shine.push([new THREE.BoxGeometry(1.4, DH + 1.4, .2).translate(s * (DW / 2 + 1), YD + DH / 2, -.4), 1]);
  shine.push([new THREE.BoxGeometry(DW + 3.4, 1.4, .2).translate(0, YD + DH + 1, -.4), 1]);
  shine.push([new THREE.PlaneGeometry(DW + 6, 20, 1, 4).rotateX(-Math.PI / 2).translate(0, FLOOR + .06, -10), null]);
  const shineGeo = mergeGeometries(shine.map(([g, v]) => {
    g = g.index ? g.toNonIndexed() : g;
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) col.fill(v ?? .5 * (1 + pos.getZ(i) / 20) ** 2, i * 3, i * 3 + 3);
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }));
  const DOCKS = [1, -1].map(d => new THREE.Matrix4().makeRotationY(d > 0 ? 0 : Math.PI).setPosition(0, 0, d * DOOR));

  // ---------- posters ----------
  // One atlas holds every advert and board, each drawn by the district kits' neon sign helper, 512 x 128 per cell.

  const CELLS = [...WAYS, ...ADS], atlas = document.createElement('canvas');
  atlas.width = 2048; atlas.height = 128 * Math.ceil(CELLS.length / 4);
  const ag = atlas.getContext('2d');
  CELLS.forEach(([lines, col], i) => {
    const tex = H.neonTexture(lines, col, { font: lines.length > 1 ? 'bold 44px "Avenir Next Condensed", "Arial Narrow", sans-serif' : undefined });
    ag.drawImage(tex.image, (i % 4) * 512, Math.floor(i / 4) * 128);
    tex.dispose();
  });
  const atlasTex = new THREE.CanvasTexture(atlas);
  atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 8;
  const posterMat = new THREE.MeshBasicMaterial({ map: atlasTex, color: new THREE.Color().setScalar(1.1), side: THREE.DoubleSide });
  const rows = atlas.height / 128;
  const poster = (list, { p, ry, w, cell }) => {
    const g = new THREE.PlaneGeometry(w, w / 4), uv = g.attributes.uv, cx = cell % 4, cy = Math.floor(cell / 4);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + uv.getX(i)) / 4, 1 - (cy + 1 - uv.getY(i)) / rows);
    list.push(g.rotateY(ry).translate(p.x, p.y, p.z));
  };
  const ad = () => WAYS.length + Math.floor(r() * ADS.length);
  const hallPosters = [];
  for (const c of cross) poster(hallPosters, { ...c.sign, w: 12, cell: c.ps.length > 1 ? 0 : c.R.name === 'Grand Loop' ? 1 : 2 });

  // The outer wall carries three rows of adverts between the ribs. The canopy's edge carries a band of large ones.

  for (let k = 0; k < 48; k++) for (const y of [-7, -1.5, 4]) {
    const a = k / 48 * TAU, p = polar(RG - .4, a, y);
    if (!inOpening(p.x, p.z) && clear(p.x, p.z, 6)) poster(hallPosters, { p, ry: inward(a), w: 18, cell: ad() });
  }
  for (let k = 0; k < 24; k++) {
    const a = (k + .5) / 24 * TAU;
    poster(hallPosters, { p: polar(KR + 6, a, KY - 7.5), ry: inward(a), w: 30, cell: k % 3 ? ad() : 4 });
  }
  for (const d of [1, -1]) {
    poster(hallPosters, { p: V3(-DW / 2 - 2.2, YD + DH - 6, d * (DOOR + DEPTH / 2)), ry: -Math.PI / 2, w: 20, cell: 3 });
    poster(hallPosters, { p: V3(0, YD + DH + 7, d * (DOOR - 1.2)), ry: d > 0 ? Math.PI : 0, w: 20, cell: 3 });
  }

  // Holo banners share the city's animated billboard shader through an instanced mesh of their own.

  const holoMesh = (list) => {
    const g = new THREE.PlaneGeometry(1, 1), seed = new THREE.InstancedBufferAttribute(new Float32Array(list.length), 1);
    g.setAttribute('aSeed', seed);
    const m = new THREE.InstancedMesh(g, billboards.material, list.length);
    list.forEach(({ p, ry, w, h }, i) => {
      _o.position.copy(p); _o.rotation.set(0, ry, 0); _o.scale.set(w, h, 1); _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix); seed.setX(i, r() * 50);
    });
    m.frustumCulled = false;
    return m;
  };

  // ---------- light and haze ----------
  // A soft beam falls from the throat to the floor. An additive skin inside the horn thickens into haze with height.

  const shaft = new THREE.Mesh(H.beamGeo, H.searchBeam([.55, .75, 1], 1.4));
  shaft.position.set(0, TOP, 0); shaft.rotation.x = Math.PI; shaft.scale.set(120, TOP - FLOOR, 120);
  shaft.frustumCulled = false;
  const hazeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vW;
      void main(){
        float h = smoothstep(40., ${TOP.toFixed(1)}, vW.y), d = distance(cameraPosition, vW);
        gl_FragColor = vec4(vec3(${HAZE.map(v => (v * .55).toFixed(3)).join(', ')}) * h * h * (1. - exp(-d / 220.)), 1.);
      }`,
  });
  const haze = new THREE.Mesh(lathe(prof.slice(7).map(([x, y]) => [x - 4, y]), 96, 1, prof.slice(7).map(() => 0)), hazeMat);

  // ---------- the tunnels ----------
  // A tunnel follows each deep span out from the hall's wall to the portal's hood. It is a flat-roofed box, 9 m
  // high, its walls 4.2 m out. Within 8.4 m of the other loop the shared wall drops and each side meets in the
  // middle. Rings of light every 24 m light pools on the floor, walls and roof. Every 110 m a side opens on a lit
  // plant room. Neon adverts hang midway between the rings.

  const tPos = [], tCol = [], tGlow = [], tPosters = [];
  let rooms = 0;
  const push = (pts, cols) => { for (const p of pts) tPos.push(p.x, p.y, p.z); for (const c of cols) tCol.push(...c); };
  const quad = (a, b, c, d, ca, cb = ca, cc = cb, cd = ca) => push([a, b, c, a, c, d], [ca, cb, cc, ca, cc, cd]);
  const BASE = [.01, .012, .016], LIT = { floor: [.14, .12, .09], wall: [.13, .13, .14], roof: [.18, .18, .19] };
  const shade = (L, k) => BASE.map((v, i) => v + LIT[k][i] * L);
  const solid = (g, top, side) => {
    g = g.toNonIndexed(); g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { tPos.push(p.getX(i), p.getY(i), p.getZ(i)); tCol.push(...(n.getY(i) > .5 ? top : side)); }
  };
  const tglow = (g, rgb) => tGlow.push([g, rgb]);
  for (const R of laps) for (const span of spans.get(R)) {
    const others = deep.filter(o => o.R !== R), runs = [[]];
    for (const q of span) if (Math.hypot(q.p.x, q.p.z) > RG - 8) runs.at(-1).push(q); else if (runs.at(-1).length) runs.push([]);
    for (const run of runs.filter(run => run.length > 1)) {
      const s0 = run[0].s;

      // Over the first 18 m in from the hood, half-bright rings stand every 12 m, so the light steps up from the
      // hood gently.

      const outer = Math.hypot(run[0].p.x, run[0].p.z) > Math.hypot(run.at(-1).p.x, run.at(-1).p.z) ? run[0].s : run.at(-1).s;
      const entry = q => { const e = Math.abs(q.s - outer); return e < 18 ? (e + 6) % 12 - 6 : Infinity; };
      const main = q => Math.abs((q.s - s0 + 12) % 24 - 12) <= 1, ring = q => main(q) || Math.abs(entry(q)) <= 1;
      for (const q of run) {
        q.hw = [4.2, 4.2]; q.open = [false, false];
        let best = 8.4, o = null;
        for (const c of others) { const d = flat(c.p, q.p); if (d < best) { best = d; o = c; } }
        const lat = o ? o.p.clone().sub(q.p).dot(q.n) : 0;
        if (Math.abs(lat) > 4) { const k = +(lat > 0); q.hw[k] = Math.abs(lat) / 2; q.open[k] = true; q.dy = o.p.y - q.p.y; }
        const d = (q.s - s0 + 12) % 24 - 12;
        q.L = Math.max(Math.exp(-((d / 4) ** 2)), .5 * Math.exp(-((entry(q) / 4) ** 2)));

        // At the hall's wall the floor rises to the hall's floor, so no gap opens under the hall's floor.

        q.fy = Math.hypot(q.p.x, q.p.z) < RG + 2 ? Math.max(-3, FLOOR - q.p.y) : -3;
      }
      const at = (q, k, y) => q.p.clone().addScaledVector(q.n, k ? q.hw[1] : -q.hw[0]).setY(q.p.y + y);
      const mid = (q, lat, y, along = 0) => q.p.clone().addScaledVector(q.n, lat).addScaledVector(q.t, along).setY(q.p.y + y);

      // Openings and posters keep off shared walls and off each other.

      const holes = [];
      for (let s = s0 + 22; s < run.at(-1).s - 12; s += 110) {
        const side = rooms++ % 2, q = run.find(q => q.s >= s);
        if (Math.hypot(q.p.x, q.p.z) < RG + 18 || run.some(o => Math.abs(o.s - s) < 8 && o.open[side])) continue;
        holes.push({ q, side, s });
      }
      const cut = (q, side) => holes.some(h => h.side === side && Math.abs(q.s - h.s) <= 6);
      for (let i = 1; i < run.length; i++) {
        const a = run[i - 1], b = run[i];
        quad(at(a, 0, a.fy), at(a, 1, a.fy), at(b, 1, b.fy), at(b, 0, b.fy), shade(a.L, 'floor'), shade(a.L, 'floor'), shade(b.L, 'floor'), shade(b.L, 'floor'));
        quad(at(a, 0, 6), at(a, 1, 6), at(b, 1, 6), at(b, 0, 6), shade(a.L, 'roof'), shade(a.L, 'roof'), shade(b.L, 'roof'), shade(b.L, 'roof'));
        for (const k of [0, 1]) {
          if (cut(a, k) && cut(b, k)) continue;
          const band = i % 4 < 2 ? 1 : .7, w = (q, f) => shade(q.L * f, 'wall').map(v => v * band);

          // Where the decks differ beside the other loop, the higher roof hangs a strip down and the lower floor
          // raises a strip up at the midline, so no gap opens between the two tunnels.

          if (a.open[k] && b.open[k]) {
            const up = Math.max(a.dy, b.dy) + .2, down = Math.max(-a.dy, -b.dy) + .2;
            if (up > .25) quad(at(a, k, a.fy), at(a, k, a.fy + up), at(b, k, b.fy + up), at(b, k, b.fy), w(a, .6), w(a, .6), w(b, .6), w(b, .6));
            if (down > .25) quad(at(a, k, 6 - down), at(a, k, 6), at(b, k, 6), at(b, k, 6 - down), w(a, 1), w(a, 1), w(b, 1), w(b, 1));
            continue;
          }

          // Where the shared wall ends, the own wall starts at the open sample and a cap closes the gap to the midline.

          const edge = a.open[k] !== b.open[k], o = a.open[k] ? a : b;
          const side = (q, y) => edge ? q.p.clone().addScaledVector(q.n, k ? 4.2 : -4.2).setY(q.p.y + y) : at(q, k, y);
          quad(side(a, a.fy), side(a, 6), side(b, 6), side(b, b.fy), w(a, .6), w(a, 1), w(b, 1), w(b, .6));
          if (edge) quad(side(o, o.fy), side(o, 6), at(o, k, 6), at(o, k, o.fy), w(o, .6), w(o, 1), w(o, 1), w(o, .6));
          const sd = (k ? 1 : -1) * .08;
          tglow(beam(side(a, .5).addScaledVector(a.n, -sd), side(b, .5).addScaledVector(b.n, -sd), .12, .1), [.08, .3, .45]);
        }
      }
      for (const q of run) {
        if (!ring(q)) continue;
        const ry = Math.atan2(q.t.x, q.t.z), w = q.hw[0] + q.hw[1], warm = Math.round((q.s - s0) / 24) % 6 === 0, rgb = (warm ? [1.6, .85, .3] : [.85, 1.1, 1.35]).map(v => main(q) ? v : v / 2);
        const c = mid(q, (q.hw[1] - q.hw[0]) / 2, 5.8);
        tglow(box(w - .4, .22, .5, c.x, c.y, c.z, ry), rgb);
        for (const k of [0, 1]) if (!q.open[k] && !cut(q, k)) { const e = mid(q, (k ? 1 : -1) * (q.hw[k] - .15), 2.65); tglow(box(.2, 6.3, .5, e.x, e.y, e.z, ry), rgb); }
      }

      // A plant room: sodium-lit walls, two great tension drums with lit rims, pipes and status lights. A pool of
      // light falls from the lamp strip over the floor and walls, and a lit trim runs along the walls as in the tunnel.

      const ROOM = { base: [.012, .009, .006], floor: [.24, .15, .07], wall: [.3, .18, .08], roof: [.1, .07, .04] };
      for (const { q, side } of holes) {
        const sd = side ? 1 : -1, hw = q.hw[side], ry = Math.atan2(q.t.x, q.t.z), lo = -3.7, hi = 6.7;
        const P = (lat, y, along) => mid(q, sd * lat, y, along);
        const lux = (lat, along, k, f = 1) => ROOM.base.map((v, i) => v + ROOM[k][i] * f * (.25 + .75 * Math.exp(-((along / 5) ** 2) - ((lat - hw - 5) / 6) ** 2)));
        const grid = (lats, alongs, y, k) => {
          for (let i = 1; i < lats.length; i++) for (let j = 1; j < alongs.length; j++) {
            const [l0, l1, e0, e1] = [lats[i - 1], lats[i], alongs[j - 1], alongs[j]];
            quad(P(l0, y, e0), P(l1, y, e0), P(l1, y, e1), P(l0, y, e1), lux(l0, e0, k), lux(l1, e0, k), lux(l1, e1, k), lux(l0, e1, k));
          }
        };
        const steps = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
        const LAT = steps(hw - .1, hw + 10, 5), ALONG = steps(-7, 7, 7);
        for (let j = 1; j < ALONG.length; j++) {
          const [e0, e1] = [ALONG[j - 1], ALONG[j]];
          quad(P(hw + 10, lo, e0), P(hw + 10, lo, e1), P(hw + 10, hi, e1), P(hw + 10, hi, e0), lux(hw + 10, e0, 'wall', .4), lux(hw + 10, e1, 'wall', .4), lux(hw + 10, e1, 'wall'), lux(hw + 10, e0, 'wall'));
        }
        for (const e of [-7, 7]) for (let i = 1; i < LAT.length; i++) {
          const [l0, l1] = [LAT[i - 1], LAT[i]];
          quad(P(l0, lo, e), P(l1, lo, e), P(l1, hi, e), P(l0, hi, e), lux(l0, e, 'wall', .4), lux(l1, e, 'wall', .4), lux(l1, e, 'wall'), lux(l0, e, 'wall'));
        }
        grid(LAT, ALONG, lo, 'floor');
        grid(LAT, ALONG, hi, 'roof');
        for (const e of [-6.92, 6.92]) tglow(beam(P(hw, .5, e), P(hw + 9.92, .5, e), .12, .1), [.45, .26, .08]);
        tglow(beam(P(hw + 9.92, .5, -7), P(hw + 9.92, .5, 7), .12, .1), [.45, .26, .08]);
        for (const along of [-3, 3]) {
          const c = P(hw + 5.5, lo + 2.8, along), g = new THREE.CylinderGeometry(2.6, 2.6, 4.5, 20).rotateX(Math.PI / 2).rotateY(ry).translate(c.x, c.y, c.z);
          solid(g, [.22, .2, .17], [.25, .25, .27]);
          for (const e of [-2.3, 2.3]) {
            const rc = c.clone().addScaledVector(q.t, e);
            tglow(new THREE.TorusGeometry(2.65, .12, 4, 32).rotateY(ry).translate(rc.x, rc.y, rc.z), along < 0 ? [1.6, .75, .2] : [.3, 1.2, 1.8]);
          }
          const l = P(hw + 3, lo + 4.6, along);
          tglow(box(.3, .3, .3, l.x, l.y, l.z), [2.4, .15, .1]);
        }
        for (let along = -5; along <= 5; along += 2.5) { const c = P(hw + 9, (lo + hi) / 2, along); solid(box(.9, hi - lo, .9, c.x, c.y, c.z, ry), [.14, .1, .06], [.12, .09, .06]); }
        const l = P(hw + 5, hi - .2, 0);
        tglow(box(.5, .15, 12, l.x, l.y, l.z, ry), [1.7, .95, .35]);
        for (const e of [-6, 6]) { const f = P(hw, 1.5, e); tglow(box(.2, 9, .2, f.x, f.y, f.z, ry), [.6, .35, .1]); }
        tPosters.push({ p: P(hw + 8.3, 4.4, 0), ry: ry + (side ? Math.PI / 2 : -Math.PI / 2), w: 6, cell: 5 + (r() < .5) });
      }

      // Adverts hang midway between the rings, alternating sides.

      for (let s = s0 + 12, k = 0; s < run.at(-1).s - 6; s += 24, k++) {
        const side = k % 2, q = run.find(q => q.s >= s);
        if (q.open[side] || holes.some(h => Math.abs(h.s - s) < 10)) continue;
        const sd = side ? 1 : -1, ry = Math.atan2(q.t.x, q.t.z) + (side ? Math.PI / 2 : -Math.PI / 2);
        tPosters.push({ p: mid(q, sd * (q.hw[side] - .1), 2.6), ry, w: 8, cell: ad() });
      }
    }
  }
  const tube = new THREE.BufferGeometry();
  tube.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
  tube.setAttribute('color', new THREE.Float32BufferAttribute(tCol, 3));
  for (const [g, rgb] of tGlow) add('tglow', g, rgb);
  const tunnelPosters = [];
  for (const p of tPosters) poster(tunnelPosters, p);

  // ---------- meshes ----------

  const shellMat = look.body.clone(), win = look.body.emissiveMap.clone();
  win.wrapT = THREE.RepeatWrapping; win.repeat.set(1, 1); win.needsUpdate = true;
  Object.assign(shellMat, { emissiveMap: win, side: THREE.BackSide, emissiveIntensity: 1.6 });
  const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; return m; };
  const merged = key => mergeGeometries(bins[key]);
  const group = new THREE.Group(), tunnel = new THREE.Group(), mouths = new THREE.Group();
  const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; return m; };
  const podBody = inst(CL.body, look.steel, 8), podLit = inst(CL.lit, look.podLit, 8), doors = inst(new THREE.BoxGeometry(DW, DH, .5), look.dark, 2);
  const lights = inst(shineGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 2);
  DOCKS.forEach((m, k) => lights.setMatrixAt(k, m));
  const cables = mesh(cableGlow, look.glow);
  group.add(mesh(merged('shell'), shellMat), floor, mesh(merged('steel'), look.steel), podBody, podLit, doors, lights, cables,
    mesh(merged('glow'), look.glow), mesh(merged('chaser'), look.chaser), tether, holoMesh(holos), mesh(mergeGeometries(hallPosters), posterMat), shaft, haze);
  tunnel.add(mesh(tube, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })), mesh(merged('tglow'), look.glow),
    mesh(mergeGeometries(tunnelPosters), Object.assign(posterMat.clone(), { color: new THREE.Color().setScalar(.75) })));

  // ---------- platforms ----------
  // Each loop's Beanstalk station gets a low platform on its open side, lit edges, lamps and name boards. The
  // engine decides the open sides after the landmarks build, so the platforms build on the first update.

  const platforms = () => {
    const keep = Object.keys(bins), boards = [];
    for (const st of STATIONS.filter(st => st.route.lap && st.name === 'The Beanstalk')) {
      const p = st.route.curve.getPointAt(st.u).sub(V3(OX, 0, OZ)), t = st.route.curve.getTangentAt(st.u).setY(0).normalize();
      const x = V3(t.z, 0, -t.x), ry = Math.atan2(t.x, t.z);
      for (const [k, s] of [[0, -1], [1, 1]]) {
        if (!st.sides[k]) continue;
        const at = (lat, y, along = 0) => p.clone().addScaledVector(x, s * lat).addScaledVector(t, along).setY(p.y + y);
        add('pdark', box(6, 1.6, STATION_LEN, ...at(6.4, .2).toArray(), ry));
        add('pglow', box(.15, .06, STATION_LEN, ...at(3.5, 1.03).toArray(), ry), C.CYAN);
        for (let z = -28; z <= 28; z += 8) {
          add('psteel', box(.3, 4.2, .3, ...at(8.8, 3.1, z).toArray(), ry));
          add('pglow', box(.5, .3, 1.6, ...at(8.5, 5.2, z).toArray(), ry), C.WARM);
        }
        for (const [z, cell] of [[-16, st.route.name === 'Grand Loop' ? 1 : 2], [0, 0], [16, 3]]) poster(boards, { p: at(9.1, 3.4, z), ry: ry - s * Math.PI / 2, w: 8, cell });
      }
    }
    const g = new THREE.Group();
    if (bins.pdark) g.add(mesh(merged('pdark'), look.dark), mesh(merged('psteel'), look.steel), mesh(merged('pglow'), look.glow), mesh(mergeGeometries(boards), posterMat));
    for (const k of Object.keys(bins)) if (!keep.includes(k)) delete bins[k];
    return g;
  };

  // A black throat closes each portal's trench where the tunnel starts. It stands only while the tunnel is hidden.

  const throat = BUNDLES.map(({ line, hw }) => {
    const e = line.at(-1), f = line.at(-3), g = groundAt(e.x, e.z), h = g + 6.8 - (e.deck - 3.2);
    return new THREE.PlaneGeometry(2 * hw, h).rotateY(Math.atan2(e.x - f.x, e.z - f.z)).translate(e.x - OX, e.deck - 3.2 + h / 2, e.z - OZ);
  });
  if (throat.length) mouths.add(mesh(mergeGeometries(throat), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })));
  group.visible = tunnel.visible = false;

  // ---------- visibility ----------
  // Below ground or inside a hood the hall and tunnels draw and the throats hide. Deeper than 4 m, the Root and
  // every top-level scene object without userData.under stop drawing for the frame while the camera is inside the
  // hall's wall, or in a tunnel and looking within 70° of the hall. So the city stays out of the hall, and a rider
  // who looks out of a tunnel sees the city through the mouth. The scene hook runs inside the render, after the
  // ride has placed the camera.

  let near = false;
  const _f = V3(0, 0, 0), FACING = Math.cos(70 * Math.PI / 180);
  const inHood = (x, y, z) => BUNDLES.some(({ line, hw }) => line.some(p => Math.hypot(x - p.x, z - p.z) < hw && y < groundAt(p.x, p.z) + 6.8));
  const show = cam => {
    const c = cam.position, g = groundAt(c.x, c.z), under = c.y < g - .05, dx = OX - c.x, dz = OZ - c.z, dist = Math.hypot(dx, dz);
    const covered = under || dist < RG + 200 && inHood(c.x, c.y, c.z);
    group.visible = tunnel.visible = covered;
    mouths.visible = !covered;
    labels.domElement.style.visibility = covered ? 'hidden' : '';
    cam.getWorldDirection(_f);
    const facing = _f.x * dx + _f.z * dz > FACING * Math.hypot(_f.x, _f.z) * dist;
    near = c.y < g - 4 && (dist < RG || dist < RG + 160 && facing);
    for (const m of look.root) m.visible = !near;
  };
  const hidden = [], before = scene.onBeforeRender, after = scene.onAfterRender;
  scene.onBeforeRender = function (renderer, s, cam, ...rest) {
    before.call(this, renderer, s, cam, ...rest);
    if (cam !== camera) return;
    show(cam);
    if (near) for (const o of scene.children) if (o.visible && !o.isLight && !o.userData.under && o !== group.parent) { o.visible = false; hidden.push(o); }
  };
  scene.onAfterRender = function (...a) {
    for (const o of hidden) o.visible = true;
    hidden.length = 0;
    after.apply(this, a);
  };

  // ---------- climbers ----------
  // Each belt serves four climbers, one every SLOT seconds. The down side runs SLOT / 2 behind the up side. An up
  // climber runs through four states.
  //   belt      it rides the belt out of its dock and up to the belt's end below the +z face
  //   clamp     the frame closes on the ribbon over TC seconds
  //   climbing  thrust grows by the outside climbers' jerk up to V m/s, so it creeps off and then shoots up
  //   gone      it is past GONE m and waits there, unseen, for its next turn in the dock
  // A down climber runs the same way backwards through arriving, unclamp, belt and gone. It waits in the shut dock.
  // A climber shrinks over the 1000 m below GONE, where it is a few pixels wide, so it never pops in or out of
  // sight. A dock's door opens and its light fades in while a climber on its belt passes within 20 m of the door.
  // belts holds each belt's path for a climber's origin, from its spawn deep in the dock to its stop before the face.

  const SLOT = 15, CYCLE = 4 * SLOT, V = 240, GONE = 4000, J = look.jerk, TV = Math.sqrt(2 * V / J), TC = 2.5, TB = 22;
  const rise = s => s < TV ? J / 6 * s ** 3 : J / 6 * TV ** 3 + V * (s - TV), YC = YE + LIFT - PY;
  const TA = GONE - YC > rise(TV) ? TV + (GONE - YC - rise(TV)) / V : Math.cbrt(6 * (GONE - YC) / J);
  const ease = x => THREE.MathUtils.smootherstep(x, 0, 1), LIGHT = new THREE.Color(...C.WARM).multiplyScalar(.3);
  const belts = {}, BL = {};
  for (const [b, d] of [['up', 1], ['down', -1]]) {
    belts[b] = [DOOR + 22, DOOR, ZE].map(z => [0, deckY(z) + LIFT - PY, d * (z - PZ)]);
    BL[b] = belts[b].slice(1).reduce((s, q, i) => s + Math.hypot(...q.map((v, k) => v - belts[b][i][k])), 0);
  }
  const walk = (path, s, p) => {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      if (s <= L || i === path.length - 1) { const u = Math.min(1, Math.max(0, s / L)); [p.x, p.y, p.z] = a.map((v, k) => v + (b[k] - v) * u); return; }
      s -= L;
    }
  };
  const pods = ['up', 'down'].flatMap(belt => [0, 1, 2, 3].map(k => ({ belt, k, state: 'gone', x: 0, y: 0, z: 0, scale: 0, face: belt === 'up' ? 1 : -1 })));
  const docks = [{ door: 0, light: 0 }, { door: 0, light: 0 }];
  const podAt = (p, c) => {
    const d = p.face, P = belts[p.belt], L = BL[p.belt], at = (z, y) => { p.x = 0; p.z = z; p.y = y; };
    p.scale = 1;
    if (p.belt === 'up') {
      if (c < TB) { p.state = 'belt'; walk(P, L * c / TB, p); }
      else if (c < TB + TC) { p.state = 'clamp'; at(d * OPEN * (1 - ease((c - TB) / TC)), YC); }
      else { const y = Math.min(GONE, YC + rise(c - TB - TC)); p.state = y < GONE ? 'climbing' : 'gone'; at(0, y); }
    } else if (c < TA) { p.state = 'arriving'; at(0, YC + rise(TA - c)); }
    else if (c < TA + TC) { p.state = 'unclamp'; at(d * OPEN * ease((c - TA) / TC), YC); }
    else if (c < TA + TC + TB) { p.state = 'belt'; walk(P, L * (1 - (c - TA - TC) / TB), p); }
    else { p.state = 'gone'; p.scale = 0; walk(P, 0, p); }
    if (p.state === 'climbing' || p.state === 'arriving' || p.y >= GONE) p.scale = THREE.MathUtils.clamp((GONE - p.y) / 1000, 0, 1);
  };

  // The slats run with the belts at the climbers' belt speed, SP m apart along the deck. A slat wraps from one end
  // of its deck to the other. It hides over the last 0.3 m, under the end stop, and wraps unseen inside the dock.

  const decks = [1, -1].map(deck), SV = BL.up / TB;
  const deckLen = decks[0].slice(1).reduce((s, b, i) => s + b.distanceTo(decks[0][i]), 0), NS = Math.round(deckLen / 1.8), SP = deckLen / NS;
  const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(BW, .25, 1.2), look.steel, 2 * NS);
  slats.frustumCulled = false;
  const _a = V3(0, 0, 0), _b = V3(0, 0, 0);
  const onDeck = (D, s) => {
    for (let i = 1; i < D.length; i++) {
      const L = D[i].distanceTo(D[i - 1]);
      if (s <= L || i === D.length - 1) { _a.lerpVectors(D[i - 1], D[i], Math.min(1, s / L)); _b.subVectors(D[i], D[i - 1]).add(_a); return; }
      s -= L;
    }
  };
  const placeSlats = t => {
    decks.forEach((D, j) => {
      for (let i = 0; i < NS; i++) {
        const s = ((i * SP + (j ? -1 : 1) * SV * t) % deckLen + deckLen) % deckLen;
        onDeck(D, s);
        _o.position.copy(_a); _o.scale.setScalar(s > deckLen - .3 ? 0 : 1); _o.lookAt(_b); _o.updateMatrix();
        slats.setMatrixAt(j * NS + i, _o.matrix);
      }
    });
    slats.instanceMatrix.needsUpdate = true;
  };

  const placePods = t => {
    pods.forEach(p => podAt(p, ((t - (p.belt === 'up' ? 0 : SLOT / 2) - p.k * SLOT) % CYCLE + CYCLE) % CYCLE));
    docks.forEach((dk, j) => {
      const b = j ? 'down' : 'up', q = Math.min(Infinity, ...pods.filter(p => p.belt === b && p.state === 'belt').map(p => Math.abs(Math.abs(p.z) + PZ - DOOR)));
      dk.door = dk.light = 1 - THREE.MathUtils.smoothstep(q, 12, 20);
      _o.position.set(0, YD + DH / 2 - (DH + YD - FLOOR + .2) * dk.door, (j ? -1 : 1) * (DOOR + .3)); _o.rotation.set(0, 0, 0); _o.scale.setScalar(1); _o.updateMatrix();
      doors.setMatrixAt(j, _o.matrix);
      lights.setColorAt(j, _c.copy(LIGHT).multiplyScalar(dk.light));
    });
    pods.forEach((p, k) => {
      _o.position.set(p.x, p.y, p.z); _o.rotation.set(0, p.face > 0 ? 0 : Math.PI, 0); _o.scale.setScalar(p.scale); _o.updateMatrix();
      podBody.setMatrixAt(k, _o.matrix); podLit.setMatrixAt(k, _o.matrix);
    });
    placeSlats(t);
    podBody.instanceMatrix.needsUpdate = podLit.instanceMatrix.needsUpdate = doors.instanceMatrix.needsUpdate = lights.instanceColor.needsUpdate = true;
  };
  const _c = new THREE.Color();
  group.add(slats);
  placePods(0);

  let built = false;
  return {
    group, tunnel, mouths, pods, docks, belts, cables, oculus: TOP, floor: FLOOR,
    update(t, cam) {
      if (!built && STATIONS.every(st => st.sides)) { group.add(platforms()); built = true; }
      placePods(t);
      show(cam);
    },
  };
}
