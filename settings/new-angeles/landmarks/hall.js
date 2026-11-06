// The Beanstalk hall below the Root, and the tunnels that bring the Grand Loop and the Centre Loop into it.
// The hall is a horn of the Root's own steel and lit windows. It rises from a wide floor round the tether, over a
// low canopy above the tracks, to a throat at the crown, where the tether leaves for the sky. The tunnels are low
// and dim, with lit rings overhead, neon adverts on the walls and openings into the anchor's machinery.
// Hall and tunnels draw only while the camera is below ground. In and near the hall the city stops drawing too,
// so the hall may rise past the ground. Local origin is the Root at ground level. Angle a gives (cos a, sin a).

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
  [['THE BEANSTALK'], '#ffffff'], [['GRAND LOOP'], '#3ff2ff'], [['CENTRE LOOP'], '#ffb43f'], [['CLIMBER GATES', '1 - 6'], '#7dff6a'],
  [['EARTH STATION', 'BY CLIMBER'], '#ffffff'], [['ROOT ANCHOR', 'TENSION PLANT'], '#ffb43f'], [['NO ENTRY', 'ANCHOR WORKS'], '#ff5f3f'],
];

// A beanpod is a capsule r in radius and 2 h tall, with two lit window bands, a cyan stripe, a beacon and two
// clamps on its tether side. Local +x faces out. The hall's pods, the Root's climbers and the tour pod share it.

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

  // Six loading bays stand in a ring at R0 round the anchor, like the blades of a wheel. Each door faces along
  // the ring toward a greater angle, so the bay 30° short of the platforms' bearing opens toward the riders. A pod
  // slides out along the ring and then swings in to its guide rail. The struts stand between the bays.

  const face = STATIONS.filter(st => st.route.lap && st.name === 'The Beanstalk')
    .reduce((v, st) => v.add(st.route.curve.getPointAt(st.u).sub(V3(OX, 0, OZ)).setY(0).normalize()), V3(0, 0, 0));
  const BAYS = Array.from({ length: 6 }, (_, k) => k / 6 * TAU + Math.atan2(face.z, face.x) + TAU / 12);
  for (const b of BAYS) {
    const a = b + TAU / 12;
    add('steel', beam(polar(22, a, FLOOR + 8), polar(40, a, FLOOR + 1), 3, 4));
    add('glow', box(.6, .6, .6, 0, 0, 0).translate(...polar(40.5, a, FLOOR + 2).toArray()), [3, .2, .1]);
  }

  // Each bay is a steel box, lit inside, with a door that drops into the floor. The cavity is BW wide, BH high and
  // BD deep. In a bay's own frame x points out from the tether, z through the door, and the frame sits at the
  // bay's centre. A pod slides SLIDE m out of its bay. Its guide rail stands at the bearing where the slide ends
  // and runs from the collar to the throat.

  const R0 = 110, BW = 20, BH = 26, BD = 18, PR = look.pod.r, PH = look.pod.h, SLIDE = BD / 2 + PR + 6;
  const bayFrame = a => new THREE.Matrix4().makeRotationY(-a).setPosition(polar(R0, a));
  const rail = a => a + Math.atan2(SLIDE, R0);
  for (const a of BAYS) {
    const m = bayFrame(a), at = (g, x, y, z) => g.translate(x, y, z).applyMatrix4(m), B = (w, h, d, x, y, z) => at(new THREE.BoxGeometry(w, h, d), x, y, z);
    add('steel', B(BW + 4, BH + 4, 2, 0, FLOOR + BH / 2 + 2, -BD / 2 - 1));
    for (const s of [-1, 1]) add('steel', B(2, BH + 4, BD, s * (BW / 2 + 1), FLOOR + BH / 2 + 2, 0));
    add('steel', B(BW, 4, BD, 0, FLOOR + BH + 2, 0));
    add('glow', B(BW - 1.4, BH - 2, .2, 0, FLOOR + BH / 2, -BD / 2 + .1), C.DIM);
    for (const s of [-1, 1]) add('glow', B(.6, BH + .4, .3, s * (BW / 2 + .3), FLOOR + BH / 2, BD / 2 + .2), C.WARM);
    add('glow', B(BW + 1.2, .6, .3, 0, FLOOR + BH + .3, BD / 2 + .2), C.WARM);
    for (const z of [0, BD / 2 + 9]) add('glow', B(1.6, .25, 14, 0, FLOOR + .1, z), C.SEA);
    const r = rail(a);
    add('steel', box(.9, TOP - FLOOR - 22, .9, ...polar(11.5, r, (TOP + FLOOR + 22) / 2).toArray(), -r + Math.PI / 2));
    add('glow', box(.25, TOP - FLOOR - 22, .25, ...polar(12.05, r, (TOP + FLOOR + 22) / 2).toArray(), -r + Math.PI / 2), C.CYAN);
  }

  // A launch lights its bay. A soft band rings the door frame and a pool of light spreads over the floor before
  // it, fading out away from the door. The geometry is white, and each bay's instance colour sets its light.

  const shine = [];
  for (const s of [-1, 1]) shine.push([new THREE.BoxGeometry(1.4, BH + 1.4, .2).translate(s * (BW / 2 + 1), FLOOR + BH / 2, BD / 2 + .4), 1]);
  shine.push([new THREE.BoxGeometry(BW + 3.4, 1.4, .2).translate(0, FLOOR + BH + 1, BD / 2 + .4), 1]);
  const pool = new THREE.PlaneGeometry(BW + 6, 20, 1, 4).rotateX(-Math.PI / 2).translate(0, FLOOR + .06, BD / 2 + 10);
  shine.push([pool, null]);
  const shineGeo = mergeGeometries(shine.map(([g, v]) => {
    g = g.index ? g.toNonIndexed() : g;
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) col.fill(v ?? .5 * (1 - (pos.getZ(i) - BD / 2) / 20) ** 2, i * 3, i * 3 + 3);
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }));

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
  for (const a of BAYS) poster(hallPosters, { p: polar(R0 + BW / 2 + 2.2, a, FLOOR + BH + 9), ry: inward(a) + Math.PI, w: 20, cell: 3 });

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
  // high, its walls 4.2 m out. Beside the other loop the shared wall drops and each side meets in the middle.
  // Rings of light every 24 m light pools on the floor, walls and roof. Every 110 m a side opens on a lit plant
  // room. Neon adverts hang between the rings.

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
      for (const q of run) {
        q.hw = [4.2, 4.2]; q.open = [false, false];
        let best = 10, o = null;
        for (const c of others) { const d = flat(c.p, q.p); if (d < best) { best = d; o = c; } }
        const lat = o ? o.p.clone().sub(q.p).dot(q.n) : 0;
        if (Math.abs(lat) > 4) { const k = +(lat > 0); q.hw[k] = Math.abs(lat) / 2; q.open[k] = true; }
        const d = (q.s - s0 + 12) % 24 - 12;
        q.L = Math.exp(-((d / 4) ** 2));
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
        quad(at(a, 0, -3), at(a, 1, -3), at(b, 1, -3), at(b, 0, -3), shade(a.L, 'floor'), shade(a.L, 'floor'), shade(b.L, 'floor'), shade(b.L, 'floor'));
        quad(at(a, 0, 6), at(a, 1, 6), at(b, 1, 6), at(b, 0, 6), shade(a.L, 'roof'), shade(a.L, 'roof'), shade(b.L, 'roof'), shade(b.L, 'roof'));
        for (const k of [0, 1]) {
          if (a.open[k] || b.open[k] || cut(a, k) && cut(b, k)) continue;
          const band = i % 4 < 2 ? 1 : .7, w = (q, f) => shade(q.L * f, 'wall').map(v => v * band);
          quad(at(a, k, -3), at(a, k, 6), at(b, k, 6), at(b, k, -3), w(a, .6), w(a, 1), w(b, 1), w(b, .6));
          const sd = (k ? 1 : -1) * .08;
          tglow(beam(at(a, k, .5).addScaledVector(a.n, -sd), at(b, k, .5).addScaledVector(b.n, -sd), .12, .1), [.08, .3, .45]);
        }
      }
      for (const q of run) {
        if (Math.abs((q.s - s0 + 12) % 24 - 12) > 1) continue;
        const ry = Math.atan2(q.t.x, q.t.z), w = q.hw[0] + q.hw[1], warm = Math.round((q.s - s0) / 24) % 6 === 0, rgb = warm ? [1.6, .85, .3] : [.85, 1.1, 1.35];
        const c = mid(q, (q.hw[1] - q.hw[0]) / 2, 5.8);
        tglow(box(w - .4, .22, .5, c.x, c.y, c.z, ry), rgb);
        for (const k of [0, 1]) if (!q.open[k] && !cut(q, k)) { const e = mid(q, (k ? 1 : -1) * (q.hw[k] - .15), 2.65); tglow(box(.2, 6.3, .5, e.x, e.y, e.z, ry), rgb); }
      }

      // A plant room: sodium-lit walls, two great tension drums with lit rims, pipes and status lights.

      for (const { q, side } of holes) {
        const sd = side ? 1 : -1, hw = q.hw[side], ry = Math.atan2(q.t.x, q.t.z), lo = -3.7, hi = 6.7;
        const P = (lat, y, along) => mid(q, sd * lat, y, along);
        const WALL = [.2, .11, .04], WALL_LO = [.07, .04, .015], ROOF = [.05, .035, .02];
        quad(P(hw + 10, lo, -7), P(hw + 10, lo, 7), P(hw + 10, hi, 7), P(hw + 10, hi, -7), WALL_LO, WALL_LO, WALL, WALL);
        for (const e of [-7, 7]) quad(P(hw - .1, lo, e), P(hw + 10, lo, e), P(hw + 10, hi, e), P(hw - .1, hi, e), WALL_LO, WALL_LO, WALL, WALL);
        quad(P(hw - .1, lo, -7), P(hw + 10, lo, -7), P(hw + 10, lo, 7), P(hw - .1, lo, 7), [.06, .04, .02]);
        quad(P(hw - .1, hi, -7), P(hw + 10, hi, -7), P(hw + 10, hi, 7), P(hw - .1, hi, 7), ROOF);
        for (const along of [-3, 3]) {
          const c = P(hw + 5.5, lo + 2.8, along), g = new THREE.CylinderGeometry(2.6, 2.6, 4.5, 20).rotateX(Math.PI / 2).rotateY(ry).translate(c.x, c.y, c.z);
          solid(g, [.22, .2, .17], [.1, .1, .11]);
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
        tPosters.push({ p: P(hw + 9.4, 4.4, 0), ry: ry + (side ? Math.PI / 2 : -Math.PI / 2), w: 6, cell: 5 + (r() < .5) });
      }

      // Adverts every 30 m, alternating sides, between the rings.

      for (let s = s0 + 18, k = 0; s < run.at(-1).s - 6; s += 30, k++) {
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
  const inst = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, BAYS.length); m.frustumCulled = false; return m; };
  const podBody = inst(look.pod.body, look.steel), podLit = inst(look.pod.lit, look.podLit), doors = inst(new THREE.BoxGeometry(BW, BH, .5), look.dark);
  const lights = inst(shineGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const FRAMES = BAYS.map(bayFrame);
  FRAMES.forEach((m, k) => lights.setMatrixAt(k, m));
  group.add(mesh(merged('shell'), shellMat), floor, mesh(merged('steel'), look.steel), podBody, podLit, doors, lights,
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
  // Below ground the hall and tunnels draw and the throats hide. Deeper than 4 m and near the hall, the Root and
  // every top-level scene object without userData.under stop drawing for the frame, so the city stays out of the
  // hall. The scene hook runs inside the render, after the ride has placed the camera.

  let near = false;
  const show = cam => {
    const c = cam.position, g = groundAt(c.x, c.z), under = c.y < g - .05;
    group.visible = tunnel.visible = under;
    mouths.visible = !under;
    labels.domElement.style.visibility = under ? 'hidden' : '';
    near = c.y < g - 4 && Math.hypot(c.x - OX, c.z - OZ) < RG + 80;
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

  // ---------- beanpods ----------
  // The bays launch in turn, one every SLOT seconds, so a launch ends before the next begins. A cycle runs through
  // five states.
  //   closed    the pod waits behind the shut door, out of sight
  //   opening   the door drops into the floor and the bay's light fades in
  //   out       the pod slides out along the floor rail, then lifts and swings in to its guide rail at R2.
  //             The door closes and the light fades out behind it
  //   climbing  thrust grows by the outside climbers' jerk up to V m/s, so the pod creeps off and then shoots up
  //   gone      the pod is past GONE m and the door has long shut on the next one
  // The pod shrinks over its last 1000 m, where it is a few pixels wide, so it never pops out of sight.

  const SLOT = 15, CYCLE = SLOT * BAYS.length, V = 240, GONE = 4000, J = look.jerk, TV = Math.sqrt(2 * V / J);
  const R2 = 11.5 + PR + .5, Y0 = FLOOR + PH + .8, Y1 = FLOOR + 50, LIGHT = new THREE.Color(...C.WARM).multiplyScalar(.3);
  const ease = x => THREE.MathUtils.smootherstep(x, 0, 1), rise = s => s < TV ? J / 6 * s ** 3 : J / 6 * TV ** 3 + V * (s - TV);
  const pods = BAYS.map((a, bay) => ({ bay, state: 'closed', x: 0, y: Y0, z: 0, r: R0, door: 0, light: 0, scale: 1, turn: -a }));
  const _p = V3(0, 0, 0), _c = new THREE.Color();
  const podAt = (p, a, m, c) => {
    p.door = 0; p.scale = 1; p.turn = -a;
    p.light = ease((c - 3) / 2) * (1 - ease((c - 10) / 3));
    _p.set(0, Y0, 0).applyMatrix4(m);
    if (c < 3) p.state = 'closed';
    else if (c < 5.5) { p.state = 'opening'; p.door = ease((c - 3) / 2.5); }
    else if (c < 16.5) {
      p.state = 'out'; p.door = 1 - ease((c - 10) / 3);
      if (c < 9.5) _p.set(0, Y0, SLIDE * ease((c - 5.5) / 4)).applyMatrix4(m);
      else {
        const u = (c - 9.5) / 7, r1 = Math.hypot(R0, SLIDE), e = ease(u);
        _p.copy(polar(r1 - (r1 - R2) * e, rail(a), Y0 + (Y1 - Y0) * ease(u / .7)));
        p.turn = -a - (rail(a) - a) * e;
      }
    } else {
      _p.copy(polar(R2, rail(a), Y1 + rise(c - 16.5))); p.turn = -rail(a);
      p.state = _p.y < GONE ? 'climbing' : 'gone';
      p.scale = THREE.MathUtils.clamp((GONE - _p.y) / 1000, 0, 1);
    }
    p.x = _p.x; p.y = _p.y; p.z = _p.z; p.r = Math.hypot(_p.x, _p.z);
  };
  const placePods = t => {
    pods.forEach((p, k) => {
      const a = BAYS[k];
      podAt(p, a, FRAMES[k], ((t - k * SLOT) % CYCLE + CYCLE) % CYCLE);
      _o.position.set(p.x, p.y, p.z); _o.rotation.set(0, p.turn, 0); _o.scale.setScalar(p.scale); _o.updateMatrix();
      podBody.setMatrixAt(k, _o.matrix); podLit.setMatrixAt(k, _o.matrix);
      _o.position.set(0, FLOOR + BH / 2 - (BH + .2) * p.door, BD / 2 + .1).applyMatrix4(FRAMES[k]); _o.rotation.set(0, -a, 0); _o.scale.setScalar(1); _o.updateMatrix();
      doors.setMatrixAt(k, _o.matrix);
      lights.setColorAt(k, _c.copy(LIGHT).multiplyScalar(p.light));
    });
    podBody.instanceMatrix.needsUpdate = podLit.instanceMatrix.needsUpdate = doors.instanceMatrix.needsUpdate = lights.instanceColor.needsUpdate = true;
  };
  placePods(0);

  let built = false;
  return {
    group, tunnel, mouths, pods, oculus: TOP, bays: BAYS.map(a => polar(R0, a)), cavity: BD / 2,
    update(t, cam) {
      if (!built && STATIONS.every(st => st.sides)) { group.add(platforms()); built = true; }
      placePods(t);
      show(cam);
    },
  };
}
