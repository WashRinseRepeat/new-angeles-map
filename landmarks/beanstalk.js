// The Beanstalk landmark. The Root megastructure, the plaza around it, the tether and its climbers.
// Local origin is the Root at ground level. Directions use angle a with (x, z) = (cos a, sin a).
// The city lies west (a = PI) and south (a = PI / 2). Utilities and freight sit on the north and east.

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;

export function build(H, group) {
  const THREE = H.THREE, U = H.U, r = H.rng ? H.rng(7177) : Math.random;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // Geometry bins, merged into one mesh per material at the end.

  const bins = {};
  const add = (key, g, rgb) => {
    g = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (rgb) {
      const n = g.attributes.position.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.set(rgb, i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    (bins[key] ??= []).push(g);
    return g;
  };

  // Radial frame: build with +x pointing outward along angle a, then turn into place.

  const at = (g, a) => g.rotateY(-a);
  const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const cyl = (rt, rb, h, seg, x, y, z, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open).translate(x, y, z);
  const _o = new THREE.Object3D();
  const beam = (a, b, w, h) => {
    const g = new THREE.BoxGeometry(w, h, a.distanceTo(b));
    _o.position.copy(a).add(b).multiplyScalar(.5); _o.lookAt(b); _o.updateMatrix();
    return g.applyMatrix4(_o.matrix);
  };
  const polar = (rad, a, y = 0) => V3(Math.cos(a) * rad, y, Math.sin(a) * rad);

  const WARM = [1.7, 1.25, .8], WHITE = [2.4, 2.4, 2.6], CYAN = [.35, 1.4, 2.2], SEA = [2.4, 1.5, .15],
    GREEN = [.3, 2.2, .7], DIM = [.5, .42, .32];

  // Root silhouette: a concave carbosteel spire, buttressed by eight fins, crowned by Plaza del Cielo.

  // RISE stretches the spire's height. Terminals keep their deck heights and meet the body through bodyR.

  const RISE = 2.25, BODY = 150 * RISE, FIN = 168 * RISE;
  const CROWN = 154 * RISE, bodyR = y => 26 + 70 * Math.pow(1 - Math.min(y, BODY) / BODY, 1.5);
  const finR = y => 30 + 88 * Math.pow(Math.max(0, 1 - y / FIN), 1.7);

  // ---------- transport arrivals ----------
  // Collect open polylines from CITY whose ends land near the Root, and put a terminal where each meets the plaza.

  const lines = [];
  const toXYZ = p => Array.isArray(p) ? (p.length >= 3 ? [p[0], p[1], p[2]] : [p[0], null, p[1]]) : [p.x, p.z !== undefined ? p.y : null, p.z ?? p.y];
  const isPt = p => (Array.isArray(p) && typeof p[0] === 'number') || (p && typeof p.x === 'number');
  const take = (pts, kind, y) => { if (Array.isArray(pts) && pts.length >= 2 && pts.every(isPt)) lines.push({ pts: pts.map(toXYZ), kind, y }); };
  for (const [key, v] of Object.entries(H.CITY)) {
    if (!Array.isArray(v) || !/spur|highway|maglev|rail|road|line|transit/i.test(key) || key === 'maglev') continue;
    const tag = e => `${key} ${e?.kind ?? ''} ${e?.type ?? ''}`;
    const kindOf = e => /highway|road/i.test(tag(e)) ? 'road' : /mag|rail|train|metro|spur/i.test(tag(e)) ? 'maglev' : 'road';
    if (v.every(isPt)) take(v, kindOf(), null);
    else for (const e of v) {
      if (Array.isArray(e)) take(e, kindOf(), null);
      else if (e) take(e.pts ?? e.points ?? e.path, kindOf(e), e.y ?? e.h ?? null);
    }
  }
  const terminals = [];
  for (const l of lines) for (const p of [l.pts[0], l.pts[l.pts.length - 1]]) {
    const dx = p[0] - H.STALK.x, dz = p[2] - H.STALK.y, d = Math.hypot(dx, dz);
    if (d > 260) continue;
    const a = Math.atan2(dz, dx);
    if (terminals.some(t => t.kind === l.kind && Math.abs(Math.atan2(Math.sin(t.a - a), Math.cos(t.a - a))) < .3)) continue;
    terminals.push({ a, kind: l.kind, y: p[1] ?? l.y ?? (l.kind === 'maglev' ? 40 : 0) });
  }
  if (!terminals.length) terminals.push({ a: Math.PI, kind: 'maglev', y: 40 }, { a: Math.PI * .5, kind: 'road', y: 0 }, { a: Math.PI * .75, kind: 'maglev', y: 40 });
  const angDist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const nearTerminal = (a, w) => terminals.some(t => angDist(t.a, a) < w);

  // Fins turn to keep clear of the terminals. Freight and power take the three gaps nearest the northeast.

  const FINS = 8, finClear = o => Math.min(...terminals.map(t => Math.min(...[...Array(FINS).keys()].map(k => angDist(t.a, o + k * TAU / FINS)))));
  const FIN0 = [...Array(45).keys()].map(i => i / 45 * TAU / FINS).reduce((b, o) => finClear(o) > finClear(b) ? o : b, 0);
  const finA = k => FIN0 + k * TAU / FINS, gapA = k => FIN0 + (k + .5) * TAU / FINS;
  const FREIGHT = [...Array(FINS).keys()].filter(k => !nearTerminal(gapA(k), .4))
    .sort((p, q) => angDist(gapA(p), -Math.PI / 4) - angDist(gapA(q), -Math.PI / 4)).slice(0, 3);

  // ---------- plaza deck ----------

  const S = 2048, R = H.PLAZA_R, px = v => (v + R) / (2 * R) * S;
  const drawPlaza = (g, lit) => {
    g.fillStyle = lit ? '#000' : '#0d1016'; g.fillRect(0, 0, S, S);
    g.lineWidth = lit ? 3 : 4;
    for (let rad = 20; rad < R; rad += 9) {
      g.strokeStyle = lit ? (rad % 27 === 2 ? 'rgba(40,120,190,.55)' : 'rgba(0,0,0,0)') : (rad % 18 ? '#141922' : '#1a202b');
      g.beginPath(); g.arc(px(0), px(0), rad / (2 * R) * S, 0, TAU); g.stroke();
    }
    for (let k = 0; k < 96; k++) {
      const a = k / 96 * TAU, main = k % 12 === 6;
      if (lit && !main) continue;
      g.strokeStyle = lit ? 'rgba(60,170,255,.8)' : (k % 4 ? '#12161e' : '#1b212c');
      g.lineWidth = main ? 5 : 3;
      g.beginPath(); g.moveTo(px(Math.cos(a) * 100), px(Math.sin(a) * 100)); g.lineTo(px(Math.cos(a) * 139), px(Math.sin(a) * 139)); g.stroke();
    }
    if (!lit) return;

    // Guidance lanes from each terminal to the Root, and hazard rings at the security line.

    for (const t of terminals) for (const s of [-1, 1]) {
      g.strokeStyle = 'rgba(255,200,120,.9)'; g.lineWidth = 4; g.setLineDash([18, 14]);
      const c = Math.cos(t.a), sn = Math.sin(t.a), ox = -sn * 9 * s, oz = c * 9 * s;
      g.beginPath(); g.moveTo(px(c * 118 + ox), px(sn * 118 + oz)); g.lineTo(px(c * 146 + ox), px(sn * 146 + oz)); g.stroke();
    }
    g.setLineDash([22, 22]); g.strokeStyle = 'rgba(255,190,20,.9)'; g.lineWidth = 7;
    g.beginPath(); g.arc(px(0), px(0), 136 / (2 * R) * S, 0, TAU); g.stroke();
    g.setLineDash([]); g.strokeStyle = 'rgba(80,200,255,.9)'; g.lineWidth = 4;
    g.beginPath(); g.arc(px(0), px(0), 129 / (2 * R) * S, 0, TAU); g.stroke();
  };
  const deckMat = new THREE.MeshStandardMaterial({
    map: H.canvasTexture(S, S, g => drawPlaza(g, false)), emissiveMap: H.canvasTexture(S, S, g => drawPlaza(g, true)),
    emissive: 0xffffff, emissiveIntensity: 1.3, roughness: .55, metalness: .3,
  });
  group.add(new THREE.Mesh(new THREE.CircleGeometry(R, 96).rotateX(-Math.PI / 2).translate(0, .25, 0), deckMat));

  // ---------- foundation and body ----------

  add('steel', cyl(124, 128, 3, 48, 0, 1.5, 0));
  add('steel', cyl(108, 113, 4, 48, 0, 5, 0));
  add('glow', cyl(124.3, 124.3, .5, 96, 0, 2.6, 0, true), CYAN);
  add('glow', cyl(108.3, 108.3, .4, 96, 0, 6.6, 0, true), WARM);

  const prof = [];
  for (let i = 0; i <= 15; i++) { const y = i * BODY / 15; prof.push(new THREE.Vector2(bodyR(y), y)); }
  const body = new THREE.LatheGeometry(prof, 24);
  for (const y of [28, 52, 76, 100, 124].map(y => y * RISE)) add('glow', cyl(bodyR(y) + .5, bodyR(y) + .5, .9, 48, 0, y, 0, true), CYAN);

  // Fins: concave buttresses from the plinth to the crown.

  for (let k = 0; k < FINS; k++) {
    const sh = new THREE.Shape();
    sh.moveTo(bodyR(0) - 4, 0);
    for (let y = 0; y <= FIN; y += 8) sh.lineTo(finR(y), y + 3);
    for (let y = FIN; y >= 0; y -= 12) sh.lineTo(bodyR(y) - 3, y);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 8, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -4);
    add('steel', at(g, finA(k)));
    for (let y = 6; y < BODY; y += 7) {
      const p = polar(finR(y - 3) + .5, finA(k), y);
      add('chaser', box(1.6, 1.6, 2.2, 0, 0, 0).rotateY(-finA(k)).translate(p.x, p.y, p.z));
    }
    add('red', at(box(2, 2, 2, finR(0) + 1, 5, 0), finA(k)));
    add('red', at(box(2, 2, 2, finR(77) + 1, 80, 0), finA(k)));
  }

  // ---------- crown: Plaza del Cielo, Earth Station dome, tensioners, climber dock ----------

  add('steel', cyl(54, 28, 22, 48, 0, CROWN - 11, 0));
  add('steel', cyl(54, 54, 2, 48, 0, CROWN + 1, 0));
  add('glow', new THREE.TorusGeometry(54.2, .35, 4, 96).rotateX(Math.PI / 2).translate(0, CROWN + 2.2, 0), WARM);
  add('glow', cyl(54.1, 50, .6, 96, 0, CROWN - 4, 0, true), CYAN);
  for (let k = 0; k < 20; k++) {
    const a = k / 20 * TAU + .1, h = 4 + r() * 6, rad = 40 + r() * 6;
    add('steel', at(box(5, h, 9, rad, CROWN + 2 + h / 2, 0), a));
    add('glow', at(box(.3, 1, 7, rad + 2.6, CROWN + 2 + h * .6, 0), a), WARM);
  }
  for (let k = 0; k < 8; k++) add('red', at(box(1.4, 1.4, 1.4, 54, CROWN + 3.5, 0), gapA(k)));

  // Tensioning machinery inside the dome: an anchor collar ringed by drums.

  add('steel', cyl(11, 13, 10, 24, 0, CROWN + 7, 0));
  add('glow', cyl(13.2, 13.2, .7, 48, 0, CROWN + 9, 0, true), CYAN);
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * TAU;
    add('steel', at(cyl(3.2, 3.2, 7, 16, 0, 0, 0).rotateX(Math.PI / 2).translate(17, CROWN + 6, 0), a));
    add('glow', at(cyl(3.3, 3.3, .6, 16, 0, 0, 0, true).rotateX(Math.PI / 2).translate(17, CROWN + 6, 0), a), CYAN);
  }
  const domeR = 26;
  const glass = new THREE.MeshStandardMaterial({ color: 0x3a6a90, emissive: 0x10283c, roughness: .1, metalness: .4,
    transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide });
  add('glass', new THREE.SphereGeometry(domeR, 36, 14, 0, TAU, 0, Math.PI / 2).translate(0, CROWN + 2, 0));
  for (let k = 0; k < 12; k++)
    add('glow', new THREE.TorusGeometry(domeR + .2, .22, 4, 24, Math.PI).rotateY(k / 12 * Math.PI).translate(0, CROWN + 2, 0), k % 3 ? DIM : CYAN);
  for (const f of [.35, .65, .88])
    add('glow', new THREE.TorusGeometry(domeR * Math.cos(f * Math.PI / 2) + .2, .2, 4, 64).rotateX(Math.PI / 2).translate(0, CROWN + 2 + domeR * Math.sin(f * Math.PI / 2), 0), DIM);

  // Climber dock above the dome apex: two collars, struts, and four gantry arms down to the plaza deck.

  const DOCK = CROWN + domeR + 8;
  for (const y of [DOCK, DOCK + 16]) {
    add('steel', new THREE.TorusGeometry(15, 1.3, 6, 32).rotateX(Math.PI / 2).translate(0, y, 0));
    add('glow', new THREE.TorusGeometry(15, .3, 4, 48).rotateX(Math.PI / 2).translate(0, y - 1.4, 0), SEA);
  }
  for (let k = 0; k < 8; k++) add('steel', at(box(1.4, 16, 1.4, 15, DOCK + 8, 0), k / 8 * TAU));
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * TAU + Math.PI / 4;
    add('steel', beam(polar(44, a, CROWN + 2), polar(16, a, DOCK + 8), 2.4, 2.4));
    add('steel', beam(polar(36, a, CROWN + 2), polar(16, a, DOCK), 1.6, 1.6));
    add('glow', box(1.2, 1.2, 1.2, 0, 0, 0).translate(...polar(30, a, CROWN + 2 + (DOCK + 8 - CROWN - 2) * .5).toArray()), SEA);
    add('red', box(1.6, 1.6, 1.6, 0, 0, 0).translate(...polar(15, a, DOCK + 17.5).toArray()));
  }

  // ---------- ground: terminal halls and freight bays between the fins ----------

  for (let k = 0; k < FINS; k++) {
    const a = gapA(k);
    if (FREIGHT.slice(0, 2).includes(k)) {
      // Freight bay: beanpods on cradles under a gantry, queued for the internal lift.

      add('steel', at(box(26, .8, 40, 106, .6, 0), a));
      add('glow', at(box(.4, 12, 18, bodyR(6) - 1.5, 7, 0), a), CYAN);
      for (const z of [-11, 0, 11]) {
        add('steel', at(cyl(2.5, 2.5, 20, 14, 0, 0, 0).rotateZ(Math.PI / 2).translate(104, 4.2, z), a));
        add('glow', at(box(16, .5, .3, 104, 5.2, z + 2.55), a), WARM);
        add('steel', at(box(3, 1.6, 6, 97, 1.6, z), a)); add('steel', at(box(3, 1.6, 6, 111, 1.6, z), a));
        add('glow', at(box(24, .15, .4, 106, 1.1, z), a), CYAN);
      }
      for (const x of [99, 112]) {
        add('steel', at(box(1.6, 18, 1.6, x, 9, -18), a)); add('steel', at(box(1.6, 18, 1.6, x, 9, 18), a));
        add('steel', at(box(2, 2, 38, x, 18, 0), a));
        add('glow', at(box(.8, .8, .8, x, 16.6, -9), a), SEA); add('glow', at(box(.8, .8, .8, x, 16.6, 9), a), SEA);
      }
      continue;
    }
    if (FREIGHT[2] === k || nearTerminal(a, .3)) continue;

    // Passenger hall: a low terminal block with a lit concourse and canopy.

    add('steel', at(box(22, 16, 40, 105, 8, 0), a));
    add('glow', at(box(.4, 7, 30, 116.2, 5.5, 0), a), WARM);
    add('glow', at(box(.4, .6, 36, 116.2, 12.5, 0), a), CYAN);
    add('steel', at(box(9, .9, 46, 120, 15.5, 0), a));
    add('glow', at(box(8, .2, 42, 120, 15, 0), a), DIM);
    for (let j = 0; j < 3; j++) add('glow', at(box(.3, 2, 9, 116.3, 21 + j * 6, (j - 1) * 4), a), r() > .5 ? WARM : CYAN);
  }

  // ---------- power and coolant: substations feeding superconducting conduits into the Root ----------

  const chaserRings = (curve, n, rad) => {
    for (let i = 1; i < n; i++) {
      const u = i / n, p = curve.getPointAt(u), tg = curve.getTangentAt(u);
      const g = new THREE.CylinderGeometry(rad, rad, .8, 10, 1, true);
      g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), tg)));
      add('chaser', g.translate(p.x, p.y, p.z));
    }
  };
  for (const k of FREIGHT) {
    const a = gapA(k);
    add('steel', at(box(9, 9, 22, 131, 4.5, 0), a));
    add('glow', at(box(.3, .6, 20, 135.6, 7.5, 0), a), CYAN);
    for (const z of [-7, 0, 7]) {
      add('steel', at(cyl(2.4, 2.4, 13, 14, 125, 6.5, z), a));
      for (const y of [4, 9]) add('glow', at(cyl(2.5, 2.5, .5, 14, 125, y, z, true), a), CYAN);
    }
    for (const z of [-2.5, 2.5]) {
      const pts = [V3(126, 13, z), V3(120, 26, z), V3(104, 38, z * .8), V3(bodyR(42) + 2, 42, z * .6)].map(p => p.applyAxisAngle(V3(0, 1, 0), -a));
      const curve = new THREE.CatmullRomCurve3(pts);
      add('steel', new THREE.TubeGeometry(curve, 32, 1.4, 8));
      chaserRings(curve, 16, 1.7);
    }
  }

  // ---------- security ring: SEA wall, towers, gate booths, sensor masts ----------

  const WALL = 141, NSEG = 72;
  for (let i = 0; i < NSEG; i++) {
    const a = (i + .5) / NSEG * TAU;
    if (nearTerminal(a, .17)) continue;
    const len = TAU * WALL / NSEG + .3;
    add('dark', at(box(1.8, 5, len, WALL, 2.5, 0), a));
    if (i % 2) add('glow', at(box(.3, .4, len * .6, WALL + .95, 4.2, 0), a), SEA);
    if (i % 6 === 0) {
      add('dark', at(box(4.5, 13, 4.5, WALL, 6.5, 0), a));
      add('glow', at(box(4.8, .7, 4.8, WALL, 12.2, 0), a), SEA);
      add('glow', at(box(1.4, .9, 1.4, WALL + 2.4, 10.5, 0), a), WHITE);
    }
    if (i % 18 === 9) {
      add('dark', at(box(1.2, 34, 1.2, WALL - 3, 17, 0), a));
      add('dark', at(cyl(3.5, 2.5, .8, 12, WALL - 3, 33, 0), a));
      add('red', at(box(1.4, 1.4, 1.4, WALL - 3, 35, 0), a));
    }
  }
  for (const t of terminals) for (const s of [-1, 1]) {
    const a = t.a + s * .19;
    add('dark', at(box(5, 5, 5, WALL, 2.5, 0), a));
    add('glow', at(box(5.3, .5, 5.3, WALL, 5.2, 0), a), SEA);
    add('glow', at(box(.3, 1.2, 3.5, WALL + 2.6, 3, 0), a), WARM);
    for (let j = 0; j < 4; j++) add('dark', at(box(.7, 1.2, .7, WALL + 6, .6, s * (3 + j * 3)), t.a));
  }

  // ---------- transport terminals at the plaza edge ----------

  for (const t of terminals) {
    const a = t.a, yd = Math.max(0, t.y);
    if (t.kind === 'maglev') {
      const y = Math.max(yd, 6);
      add('steel', at(box(44, 2, 28, 150, y - 1, 0), a));
      add('dark', at(box(44, 1, 7, 150, y + .5, 0), a));
      add('glow', at(box(44, .2, .5, 150, y + 1.1, 0), a), CYAN);
      for (const z of [-8.5, 8.5]) {
        add('steel', at(box(44, 1.2, 7, 150, y + .6, z), a));
        add('glow', at(box(44, .25, .4, 150, y + 1.3, z - Math.sign(z) * 3.4), a), WARM);
      }
      for (const x of [134, 150, 166]) for (const z of [-10, 10]) add('dark', at(box(2.6, y, 2.6, x, y / 2 - 1, z), a));
      add('glass', at(new THREE.CylinderGeometry(14, 14, 44, 16, 1, true, Math.PI, Math.PI).rotateZ(-Math.PI / 2).translate(150, y + 1, 0), a));
      for (let x = 130; x <= 170; x += 8)
        add('glow', at(new THREE.TorusGeometry(14.1, .3, 4, 16, Math.PI).rotateY(Math.PI / 2).translate(x, y + 1, 0), a), x % 16 === 2 ? CYAN : DIM);
      add('steel', at(box(12, y + 10, 32, 122, (y + 10) / 2, 0), a));
      add('glow', at(box(.3, 2, 28, 116, y + 4, 0), a), WARM);
      add('glow', at(box(.3, 1, 28, 128.1, y + 7, 0), a), WARM);
      add('steel', beam(polar(116, a, y + 5), polar(bodyR(y + 5) + 1, a, y + 5), 6, 5));
      add('glow', beam(polar(116, a, y + 3.2).add(polar(3.1, a + Math.PI / 2)), polar(bodyR(y + 3) + 2, a, y + 3.2).add(polar(3.1, a + Math.PI / 2)), .2, 1), WARM);
      add('dark', at(box(2, y + 26, 2, 131, (y + 26) / 2, 17), a));
      add('glow', at(box(.4, 8, 3.6, 131, y + 20, 17), a), CYAN);
      add('red', at(box(1.2, 1.2, 1.2, 131, y + 26.6, 17), a));
    } else {
      // Road terminal: drop-off deck, turnaround and a security toll gantry.

      const y = yd;
      add('dark', at(box(48, 1.5, 30, 148, y - .5, 0), a));
      add('dark', at(cyl(17, 17, 1.6, 32, 128, y - .4, 0), a));
      add('glow', at(new THREE.TorusGeometry(17, .25, 4, 48).rotateX(Math.PI / 2).translate(128, y + .5, 0), a), WARM);
      for (let x = 136; x < 172; x += 6) add('glow', at(box(3, .12, .35, x, y + .35, 0), a), WHITE);
      for (const z of [-14.6, 14.6]) add('glow', at(box(48, .3, .3, 148, y + .6, z), a), WARM);
      if (y > 3) {
        for (const x of [140, 155, 168]) add('dark', at(box(3, y, 6, x, y / 2 - 1, 0), a));
        add('dark', at(cyl(5, 6, y, 16, 128, y / 2 - 1, 0), a));
      }
      const above = terminals.find(o => o.kind === 'maglev' && angDist(o.a, a) < .25 && o.y > y);
      const gh = above ? Math.min(10, above.y - y - 4) : 10;
      for (const z of [-15.5, 15.5]) add('steel', at(box(1.6, gh, 1.6, 160, y + gh / 2, z), a));
      add('steel', at(box(2.5, 2.5, 33, 160, y + gh, 0), a));
      for (let j = -3; j <= 3; j++) add('glow', at(box(.4, 1.2, 1.6, 158.6, y + gh - 1.6, j * 4), a), j % 2 ? SEA : GREEN);
      add('steel', at(box(10, y + 12, 34, 116, (y + 12) / 2, 0), a));
      add('glow', at(box(.3, 1.6, 30, 121.1, y + 4, 0), a), WARM);
      if (!above) {
        add('steel', at(box(14, .8, 34, 125, y + 9.5, 0), a));
        add('glow', at(box(13, .2, 32, 125, y + 9, 0), a), DIM);
      }
    }
  }

  // ---------- materials and meshes ----------

  const winTex = H.canvasTexture(512, 1024, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 26) {
      for (let x = 0; x < w;) {
        const ww = 3 + r() * 14, lit = r();
        if (lit > .45) { g.fillStyle = lit > .96 ? 'rgba(120,200,255,.7)' : `rgba(255,${190 + r() * 40 | 0},${120 + r() * 60 | 0},${.25 + r() * .75})`; g.fillRect(x, y, ww, 9); }
        x += ww + 2 + r() * 10;
      }
    }
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(90,180,255,.45)'; g.fillRect(x, 0, 2, h); }
  });
  winTex.wrapS = THREE.RepeatWrapping; winTex.repeat.set(4, 1);
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x2a313e, metalness: .7, roughness: .42, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x171b22, metalness: .4, roughness: .7 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x232935, metalness: .65, roughness: .45, flatShading: true,
    emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 1.25 });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const redMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, .15, .1) });

  // Chaser lights pulse inward toward the Root, so they climb the fins and run along the feeds.

  const chaserMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uColor: { value: new THREE.Color(.4, 1.5, 2.4) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uColor; uniform vec2 uStalk; uniform float uTime; varying vec3 vW; ${H.FOG_GLSL}
      void main(){
        if (vW.y > uClipTop) discard;
        float p = fract(length(vW.xz - uStalk) / 36. + uTime * .9);
        gl_FragColor = vec4(fogged(uColor * (.3 + 2.4 * pow(p, 12.)), vW), 1.);
      }`,
  });

  group.add(new THREE.Mesh(body, bodyMat));

  // ---------- the tether: a buckyweave ribbon between two edge cables ----------

  const T0 = CROWN, T1 = 11500, TH = T1 - T0;
  const tetherParts = [
    [new THREE.BoxGeometry(15, TH, 2.6), 0],
    [new THREE.CylinderGeometry(1.9, 1.9, TH, 10, 1, true).translate(-8.4, 0, 0), 1],
    [new THREE.CylinderGeometry(1.9, 1.9, TH, 10, 1, true).translate(8.4, 0, 0), 1],
    [new THREE.BoxGeometry(1.2, TH, 3.4).translate(-3.5, 0, 0), .5],
    [new THREE.BoxGeometry(1.2, TH, 3.4).translate(3.5, 0, 0), .5],
  ].map(([g, e]) => {
    g = g.toNonIndexed(); g.deleteAttribute('uv');
    g.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(e), 1));
    return g.translate(0, T0 + TH / 2, 0);
  });
  const tetherMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `attribute float aEdge; varying vec3 vW, vN, vL; varying float vE;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vL = position; vN = normalize(mat3(modelMatrix) * normal); vE = aEdge;
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; varying vec3 vW, vN, vL; varying float vE; ${H.FOG_GLSL}
      void main(){
        if (vW.y > uClipTop) discard;
        float h = vW.y;
        vec3 n = normalize(vN);
        float lam = .55 + .45 * max(dot(n, normalize(vec3(.5, .3, .7))), 0.) + .25 * max(-n.x, 0.);
        float weave = .86 + .14 * step(.5, fract(vL.x * .8 + step(.5, fract(h * .25)) * .5));
        vec3 c = vec3(.085, .095, .11) * lam * mix(weave, 1.25, step(.75, vE));

        // Segment collars every 60 m, node rings every 480 m, pulses running up the edge cables.

        float s = fract(h / 60.), node = fract(h / 480.);
        vec3 e = vec3(.35, .75, 1.2) * (1. - smoothstep(.006, .016, s)) * .9;
        e += vec3(1.4, 1.1, .7) * (1. - smoothstep(.002, .006, node)) * 2.5;
        float p = fract((h - uTime * 260.) / 1100.), q = fract((h + uTime * 190.) / 1700.);
        e += step(.75, vE) * (vec3(.06, .14, .24) + vec3(.6, 1.3, 2.2) * (pow(p, 40.) + .6 * pow(q, 60.)));
        e += step(.25, vE) * (1. - step(.75, vE)) * vec3(.05, .09, .14);

        // Keep the line legible through the fog: the surface fades, the lights only dim.

        float d = distance(cameraPosition, vW);
        float f = clamp(smoothstep(uFogNear, uFogFar, d), 0., 1.);
        c = mix(c, uFog * 1.2, f * .78) + vec3(.02, .035, .055) * smoothstep(600., 5000., h);
        gl_FragColor = vec4(c + e * (1. - .55 * f), 1.);
      }`,
  });
  const tether = new THREE.Mesh(mergeGeometries(tetherParts), tetherMat);
  tether.frustumCulled = false;
  group.add(tether);

  // Soft halo: an additive shell that brightens where the view grazes the tether's axis.

  const haloMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vW, vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uClipTop; varying vec3 vW, vN;
      void main(){
        if (vW.y > uClipTop) discard;
        float k = pow(abs(dot(normalize(vN), normalize(cameraPosition - vW))), 3.);
        float fade = exp(-(vW.y - 160.) / 2600.) * smoothstep(150., 220., vW.y);
        gl_FragColor = vec4(vec3(.25, .55, .9) * k * fade * .055, 1.);
      }`,
  });
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 6000, 24, 1, true).translate(0, 160 + 3000, 0), haloMat));

  // Searchlights from the security ring, sweeping the sky around the tether.

  const beamParts = [];
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * TAU + .3;
    const g = new THREE.CylinderGeometry(34, 1.2, 1600, 16, 1, true).translate(0, 800, 0).rotateZ(-.32 - (k % 2) * .12).rotateY(-a).translate(...polar(WALL - 6, a, 13).toArray());
    beamParts.push(g.toNonIndexed());
    add('dark', at(cyl(1.6, 2.2, 13, 10, WALL - 6, 6.5, 0), a));
  }
  const beamMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: haloMat.vertexShader,
    fragmentShader: `uniform float uClipTop; varying vec3 vW, vN;
      void main(){
        if (vW.y > uClipTop) discard;
        float k = pow(abs(dot(normalize(vN), normalize(cameraPosition - vW))), 2.);
        gl_FragColor = vec4(vec3(.6, .8, 1.) * k * exp(-vW.y / 520.) * .05, 1.);
      }`,
  });
  const beams = new THREE.Mesh(mergeGeometries(beamParts), beamMat);
  beams.frustumCulled = false;
  group.add(beams);

  // ---------- climbers ----------
  // A climber clamps one face of the ribbon: drive frame, edge grips and three hanging beanpods.
  // Up climbers ride the +z face, down climbers the -z face.

  const cBody = [], cLit = [];
  const cb = g => cBody.push(g.toNonIndexed()), cl = (g, rgb) => cLit.push(add('_', g, rgb));
  cb(box(22, 6, 3, 0, 0, 3.2));
  for (const x of [-8.4, 8.4]) cb(box(5, 9, 6, x, 0, .8));
  cb(box(18, 3, 7, 0, 4.4, 5));
  for (const x of [-6, 0, 6]) {
    cb(cyl(2.5, 2.5, 18, 12, x, -11, 8));
    cb(cyl(1.2, 2.5, 2, 12, x, -21, 8));
    cl(box(1.1, 12, .3, x, -10, 10.55), WARM);
    cl(box(4, .4, 4, x, -22, 8), WHITE);
  }
  cl(box(17, .6, .4, 0, 6, 8.6), WHITE);
  cl(box(.8, .8, .8, -11.4, 0, 3), [3, .2, .1]);
  cl(box(.8, .8, .8, 11.4, 0, 3), GREEN);
  delete bins._;
  const mats = { steel: steelMat, dark: darkMat, glow: glowMat, red: redMat, chaser: chaserMat, glass };
  for (const [k, list] of Object.entries(bins)) group.add(new THREE.Mesh(mergeGeometries(list), mats[k]));
  const cBodyGeo = mergeGeometries(cBody.map(g => { g.deleteAttribute('uv'); return g; }));
  const cLitGeo = mergeGeometries(cLit);
  const MOVING = 14, DOCKED = 2, TOUR = MOVING + DOCKED, N = TOUR + 1;
  const climBody = new THREE.InstancedMesh(cBodyGeo, steelMat, N);
  const climLit = new THREE.InstancedMesh(cLitGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), N);
  for (const m of [climBody, climLit]) { m.frustumCulled = false; group.add(m); }
  const climbers = Array.from({ length: MOVING }, (_, k) => ({ up: k % 2 === 0, u0: (k >> 1) / (MOVING / 2) + (k % 2) * .037, T: 260 + (k % 3) * 40 }));
  const BASE = DOCK + 30, TOP = 9600, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = V3(0, 0, 0), SC = V3(1, 1, 1), Y = V3(0, 1, 0);
  const place = (i, y, up, s) => {
    Q.setFromAxisAngle(Y, up ? 0 : Math.PI); P.set(0, y, 0); SC.setScalar(s);
    M.compose(P, Q, SC); climBody.setMatrixAt(i, M); climLit.setMatrixAt(i, M);
  };

  // Docked climbers sit inside the collar, loading from the gantry arms.

  place(MOVING, DOCK + 12, true, 1); place(MOVING + 1, DOCK + 12, false, 1);

  // The audio tour drives one extra climber up the +z face. It stays hidden until the tour places it. While it
  // rides, the other up climbers leave the ribbon, and they return when the tour lets the pod go.

  place(TOUR, 0, true, 0);
  let solo = false;
  const grown = y => 1 + Math.max(0, y - 400) / 1400;

  // ---------- animation ----------

  return {
    top: DOCK + 18,
    dock: DOCK + 12,
    grown,
    pod(y) { solo = y != null; place(TOUR, y ?? 0, true, solo ? grown(y) : 0); },
    update(t) {
      climbers.forEach((c, i) => {
        const u = ((t / c.T + c.u0) % 1 + 1) % 1, e = c.up ? u : 1 - u;

        // Climbers creep near the Root and gain speed with height.

        const y = BASE + (TOP - BASE) * e ** 3;
        const grow = Math.min(1, (c.up ? u : 1 - u) * 60);
        place(i, y, c.up, solo && c.up ? 0 : grow * grown(y));
      });
      climBody.instanceMatrix.needsUpdate = climLit.instanceMatrix.needsUpdate = true;
      const blink = (Math.sin(t * 2.6) > .55) ? 1 : .06;
      redMat.color.setRGB(3 * blink, .15 * blink, .1 * blink);
      beams.rotation.y = t * .05;
    },
  };
}
