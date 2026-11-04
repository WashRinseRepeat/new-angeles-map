// Folk-tale landmarks under the western old town. The grotto of the Pegnitz Nix keeps his pots of drowned souls
// and a rat king, Rumpelstilzchen's chamber holds the straw, the gold and his hidden hearth, and deep below
// lies Alberich's hoard of the Nibelungs with its forges, mine carts, Tarnkappe and ring.

import * as THREE from 'three';

// A seeded random keeps the caves and heaps the same on every load.

let seed = 7;
const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
const rr = (a, b) => a + (b - a) * rnd();
const ang = (dx, dz) => Math.atan2(-dz, dx);
const sm = x => x * x * (3 - 2 * x);
const V2 = pts => pts.map(([r, y]) => new THREE.Vector2(r, y));

// A cave outline: corners [x, z] and [x, z, 1] where the edge from that corner to the next is a doorway.
// Plain edges are cut into short jagged pieces.

function jag(ring, amp, step = 3.5) {
  const pts = [], doors = new Set();
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    if (a[2]) { doors.add(pts.length); pts.push([a[0], a[1]]); return; }
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(l / step)), nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
    for (let j = 0; j < k; j++) { const u = j / k, o = j && (rnd() - .5) * 2 * amp; pts.push([a[0] + (b[0] - a[0]) * u + nx * o, a[1] + (b[1] - a[1]) * u + nz * o]); }
  });
  return { pts, doors };
}

// A rough cave with open doorways. Returns the jagged outline and its centre.

function cave(D, ring, y, h, o = {}) {
  const { pts, doors } = jag(ring, o.jag ?? 1.4), n = pts.length, mat = o.wall ?? 'rock';
  D.floorPoly(pts, y, o.floor ?? 'rock', { bump: o.bump ?? .12, rgb: o.floorRgb });
  const cw = pts.reduce((s, p, i) => { const q = pts[(i + 1) % n]; return s + (q[0] - p[0]) * (q[1] + p[1]); }, 0) > 0;
  const wo = { thick: o.thick ?? 1.6, rough: o.rough ?? .6, rgb: o.rgb }, s0 = [...doors][0] + 1;
  let run = [];
  for (let k = 0; k < n; k++) {
    const i = (s0 + k) % n;
    run.push(pts[i]);
    if (doors.has(i)) { if (run.length > 1) D.wall(cw ? run : [...run].reverse(), y, h, mat, wo); run = []; }
  }
  const c = pts.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n], [0, 0]);
  return { pts, c };
}

// Things placed round a cave's inner wall every `every` metres, set `inset` metres in and facing the centre.

function aroundWall({ pts, c }, every, inset, fn) {
  let acc = every / 2;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (acc < l) {
      const u = acc / l, x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u, dx = c[0] - x, dz = c[1] - z, dl = Math.hypot(dx, dz);
      fn(x + dx / dl * inset, z + dz / dl * inset, dx / dl, dz / dl);
      acc += every;
    }
    acc -= l;
  }
}

const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const blob = (cx, cz, rx, rz, n = 20, j = .14) => Array.from({ length: n }, (_, k) => {
  const a = k / n * Math.PI * 2, f = 1 + (rnd() - .5) * 2 * j;
  return [cx + Math.cos(a) * rx * f, cz + Math.sin(a) * rz * f];
});
const beam = (D, a, b, y, h, d, mat, o = {}) => D.box((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, Math.hypot(b[0] - a[0], b[1] - a[1]), h, d, mat, { ...o, rot: ang(b[0] - a[0], b[1] - a[1]) });
const rock = (D, x, y, z, s, mat = 'rock', o = {}) => D.geo(new THREE.DodecahedronGeometry(1, 0).scale(s, s * (o.flat ?? .65), s * rr(.75, 1.2)), mat, { at: [x, y, z], rot: rnd() * 6.3, rgb: o.rgb });
const spire = (D, x, y, z, r, h, mat = 'rock', o = {}) => D.geo(new THREE.ConeGeometry(r, h, 7).translate(0, h / 2, 0), mat, { at: [x, y, z], rot: rnd() * 6.3, rgb: o.rgb });
const coins = (D, x, y, z, r0, r1, n) => { for (let k = 0; k < n; k++) { const a = rnd() * 6.3, r = Math.sqrt(rr(r0 * r0, r1 * r1)); D.box(x + Math.cos(a) * r, y, z + Math.sin(a) * r, .16, .04, .16, 'gold', { rot: rnd() * 3 }); } };
const GOBLET = new THREE.LatheGeometry(V2([[0, 0], [.13, 0], [.04, .05], [.035, .2], [.11, .27], [.12, .4]]), 8);
const goblet = (D, x, y, z, s = 1) => D.geo(GOBLET, 'gold', { at: [x, y, z], scale: s });

function chest(D, x, y, z, rot, s = 1) {
  D.frame(x, z, rot, () => {
    D.box(0, y, 0, 1.1 * s, .6 * s, .7 * s, 'wood');
    for (const u of [-.4, .4]) D.box(u * s, y, 0, .07 * s, .62 * s, .74 * s, 'iron');
    D.box(0, y + .6 * s, 0, .95 * s, .12 * s, .55 * s, 'gold');
    D.slab(0, y + .85 * s, -.42 * s, 1.1 * s, .1 * s, .5 * s, 0, 'wood');
    D.frame(0, -.4 * s, Math.PI / 2, () => D.slab(0, y + .9 * s, 0, .55 * s, .08 * s, 1.1 * s, 1.2, 'wood'));
    coins(D, 0, y, .9 * s, 0, .8 * s, 8);
  });
}

// A fishing net hung between two posts from a to b.

function net(D, a, b, y, h, rgb = [.42, .4, .32]) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  D.frame(a[0], a[1], ang(b[0] - a[0], b[1] - a[1]), () => {
    for (let u = .2; u < l; u += .45) D.box(u, y + .25 + .4 * Math.sin(u / l * Math.PI), Math.sin(u * 1.7) * .06, .03, h - .4 * Math.sin(u / l * Math.PI), .03, 'cloth', { rgb });
    for (let v = .6; v < h; v += .42) D.box(l / 2, y + v, 0, l, .03, .03, 'cloth', { rgb });
    for (const u of [0, l]) D.cyl(u, y, 0, .09, h + .5, 'wood', { seg: 6 });
    for (let u = .7; u < l; u += 1.4) D.geo(new THREE.SphereGeometry(.13, 6, 4), 'moss', { at: [u, y + h - .1, .1], rgb: [.2, .4, .32] });
  });
}

// ---------- the grotto of the Pegnitz Nix ----------

function nixGrotto(D, Z) {
  const F = Z.floor, WY = F + .3, TEAL = [.22, .7, .6];
  const cv = cave(D, [
    [-321.5, 25, 1], [-318.5, 25], [-305, 34], [-292, 50], [-287, 68], [-284, 83.5, 1], [-284, 86.5], [-286, 100], [-292, 116],
    [-298, 124, 1], [-300.1, 126.1], [-312, 136], [-335, 142], [-360, 138], [-378, 124], [-388, 104], [-390, 86.5, 1], [-390, 83.5],
    [-386, 66], [-375, 50], [-358, 38], [-340, 31], [-326, 27],
  ], F, 6, { wall: 'moss', floorRgb: [.25, .26, .24], rgb: [.3, .33, .28] });

  // Glowing moss on the walls and dim cold light so the cave reads from above.

  aroundWall(cv, 9, .9, (x, z) => D.glow(x, F + rr(.5, 3.5), z, rr(.3, .7), .12, rr(.3, .7), [.25, 1, .7], { pulse: rr(.1, .3) }));
  aroundWall(cv, 30, 3, (x, z) => D.light(x, F + 3.5, z, TEAL, 15, { flicker: 0 }));

  // The pool, its rim and the channel from the culvert.

  const PC = [-343, 100], pool = blob(...PC, 22, 15, 24);
  D.waterPoly(pool, WY, { rgb: [.015, .04, .05] });
  pool.forEach(([x, z], k) => { const dx = x - PC[0], dz = z - PC[1], l = Math.hypot(dx, dz); for (let j = 0; j < 2; j++) rock(D, x + dx / l * rr(.3, 1.4), F, z + dz / l * rr(.3, 1.4), rr(.5, 1.2), k % 3 ? 'rock' : 'moss'); });
  D.waterPoly([[-389, 83.8], [-378, 86], [-366, 96], [-364, 101], [-379, 89.6], [-389, 86.2]], WY);
  for (const [x, z, s] of [[-350, 96, 1.8], [-333, 106, 1.3], [-356, 108, 1]]) rock(D, x, F, z, s, 'moss', { flat: .9 });
  for (const [x, z, h] of [[-372, 72, 4], [-366, 66, 2.5], [-310, 86, 3.5], [-318, 72, 2.5], [-372, 120, 4.5], [-350, 128, 3], [-296, 92, 2.2], [-381, 96, 3]]) {
    spire(D, x, F, z, h * .3, h, 'moss');
    spire(D, x + rr(-1.2, 1.2), F, z + rr(-1.2, 1.2), h * .15, h * .45, 'rock');
  }

  // His hall: rows of upturned pots on stone benches round the driftwood throne, each pot holding a soul.

  const TH = [-332, 37];
  for (const R of [9, 12.5, 16, 19.5]) {
    const a0 = .28, a1 = Math.PI - .28, len = (a1 - a0) * R, nb = Math.ceil(len / 2.2), np = Math.floor(len / 1.75);
    for (let k = 0; k < nb; k++) {
      const a = a0 + (a1 - a0) * (k + .5) / nb;
      D.box(TH[0] + Math.cos(a) * R, F, TH[1] + Math.sin(a) * R, len / nb + .05, .4, 1, 'rubble', { rot: ang(-Math.sin(a), Math.cos(a)) });
    }
    for (let k = 0; k <= np; k++) {
      const a = a0 + (a1 - a0) * k / np, x = TH[0] + Math.cos(a) * R, z = TH[1] + Math.sin(a) * R, s = rr(.85, 1.15);
      D.geo(POT, 'plaster', { at: [x, F + .4, z], scale: s, rgb: [.5, .29, .17], jit: .15 });
      const ph = rnd(), p = rr(.15, .4), c = [.12 * rr(.8, 1.3), .75, .62];
      D.glow(x, F + .4, z, .82 * s, .05, .82 * s, c, { pulse: p, phase: ph, rot: rnd() });
      D.glow(x, F + .4, z, .82 * s, .05, .82 * s, c, { pulse: p, phase: ph, rot: rnd() + .78 });
    }
  }
  for (const R of [11, 18]) for (const a of [.6, 1.57, 2.55]) D.light(TH[0] + Math.cos(a) * R, F + 2.5, TH[1] + Math.sin(a) * R, [.2, .7, .6], 10, { flicker: 0 });
  throne(D, TH[0], F, TH[1]);
  D.brazier(TH[0] - 3.4, F, TH[1] + 1.6, { rgb: [.4, 1.3, 1.1], r: 12 });
  D.brazier(TH[0] + 3.4, F, TH[1] + 1.6, { rgb: [.4, 1.3, 1.1], r: 12 });
  coins(D, TH[0], F, TH[1] + 4, .5, 3.5, 40);
  for (let k = 0; k < 5; k++) goblet(D, TH[0] + rr(-2.5, 2.5), F, TH[1] + rr(2.8, 5), rr(1, 1.6));

  // Drowned treasures by the east wall: a capsized punt, chests, a church bell, an anchor, nets.

  D.geo(new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(4, 1, 1.3), 'wood', { at: [-306, F, 101], rot: .5, rgb: [.3, .24, .17] });
  D.box(-306, F + .95, 101, 8.4, .15, .2, 'wood', { rot: .5 });
  chest(D, -299, F, 111, .3, 1.3); chest(D, -296, F, 106, -.6); chest(D, -313, F, 114, 1.2);
  coins(D, -300, F, 109, .5, 4, 30);
  D.geo(new THREE.LatheGeometry(V2([[0, 1.5], [.3, 1.48], [.48, 1.3], [.55, .8], [.68, .25], [.85, .02], [.8, 0]]), 14).rotateZ(1.25), 'iron', { at: [-313, F + .5, 124], rot: .7, rgb: [.42, .33, .18] });
  D.box(-322, F, 126, .25, .2, 3.2, 'iron', { rot: .4 });
  D.geo(new THREE.TorusGeometry(1, .12, 5, 14, Math.PI).rotateX(-Math.PI / 2), 'iron', { at: [-322, F + .15, 127.4], rot: .4 });
  D.geo(new THREE.TorusGeometry(.35, .08, 5, 10).rotateX(-Math.PI / 2), 'iron', { at: [-322.6, F + .1, 124.4] });
  net(D, [-306, 55], [-298.5, 64], F, 2.8);
  net(D, [-300, 70], [-297, 78], F, 2.4);
  for (let u = 0; u < 5; u += .4) D.box(-312 + u, F + .02, 76, .03, .03, 4, 'cloth', { rgb: [.4, .38, .3] });
  for (let v = 0; v < 4; v += .4) D.box(-309.5, F + .02, 74 + v, 5, .03, .03, 'cloth', { rgb: [.4, .38, .3] });
  D.candle(-298, F + .6, 111); D.candle(-312, F + .6, 115);
  D.light(-303, F + 3, 108, [1.2, .85, .45], 11, { flicker: 0 });

  // The way in from the east and the passage to the rat king.

  D.tunnel([[-255, F, 85], [-270, F, 85.6], [-284, F, 85]], { w: 3, h: 4.5, wall: 'moss', floor: 'rock', rough: .4, torches: 8 });
  D.tunnel([[-299.05, F, 125.05], [-293, F, 131], [-288, F, 134], [-282, F, 134]], { w: 2.6, h: 4, wall: 'rock', floor: 'dirt', rough: .4, torches: 9 });

  // The culvert from the river: a brick drain that climbs north to an iron grate.

  const CU = [[-390, F, 85], [-396, F + .4, 85], [-396, F + 2, 70], [-396, F + 3.4, 55], [-396, F + 4, 42]];
  D.tunnel(CU, { w: 3, h: 3.2, wall: 'brick', floor: 'flag', water: 1.8, torches: 0 });
  for (let z = 44; z < 82; z += 3.2) D.arch(-396, F + 2.6 + (z < 70 ? 2 + (70 - z) / 15 * 1.4 : .4 + (85 - z) / 15 * 1.6), z, 3.2, 1, { mat: 'brick', thick: .35, depth: .5 });
  for (let x = -397.2; x < -394.6; x += .32) D.box(x, F + 4, 42.4, .07, 3, .07, 'iron');
  D.box(-396, F + 6.8, 42.4, 3.2, .15, .15, 'iron');
  D.torch(-394.6, F + 6.2, 50, -1, 0, { rgb: [1.2, 1.1, .8] });
  D.torch(-397.4, F + 4.5, 66, 1, 0, { rgb: [1.2, 1.1, .8] });

  nixFigure(D, -343, WY, 100);
  ratChamber(D, F);

  D.label(Z.name, -340, F + 5, 90);
  D.label('Hall of the Pots', TH[0], F + 5.5, TH[1] + 10, 'district quarter under');
  D.label('Rattenkönig', -270, F + 5.5, 135, 'district quarter under');
}

const POT = new THREE.LatheGeometry(V2([[.3, 0], [.36, .12], [.38, .3], [.32, .5], [.2, .62], [.08, .67], [0, .68]]), 8);

// The Nix's throne of driftwood on a stone dais, facing south over his pots.

function throne(D, x, y, z) {
  D.box(x, y, z, 5.2, .4, 3.8, 'rubble');
  D.box(x, y + .4, z, 4, .3, 2.8, 'rubble');
  D.box(x, y + .7, z + .2, 1.9, .6, 1.2, 'wood', { rgb: [.44, .4, .34] });
  for (let k = 0; k < 7; k++) {
    const a = (k - 3) * .21 + rr(-.05, .05), l = rr(2.6, 3.8) - Math.abs(k - 3) * .3, b = [x + (k - 3) * .2, y + .9, z - .45];
    D.geo(new THREE.CylinderGeometry(.08, .16, l, 5).rotateZ(a).rotateX(-.18), 'wood', { at: [b[0] - Math.sin(a) * l / 2, b[1] + Math.cos(a) * l / 2, b[2] - .25], rgb: [.46, .41, .34] });
  }
  for (const s of [-1, 1]) {
    D.geo(new THREE.CylinderGeometry(.11, .14, 1.7, 5).rotateX(Math.PI / 2), 'wood', { at: [x + s * 1.05, y + 1.45, z + .2], rgb: [.44, .4, .33] });
    D.cyl(x + s * 1.05, y + .7, z + .75, .09, .75, 'wood', { seg: 5 });
  }
  D.geo(new THREE.ConeGeometry(.5, 1.2, 6).rotateX(Math.PI / 2), 'bone', { at: [x, y + 4.2, z - 1.1] });
}

// The Nix himself: a green, long-haired Wassermann who rises from the pool, looks round and sinks again.

function nixFigure(D, x, wy, z) {
  const skin = D.mat(0x4a8a6c, { emissive: 0x0c2e22 }), hairM = D.mat(0x1f4a2c, { emissive: 0x062010 }), eyeM = D.mat(0, { emissive: 0xc0ffe8 });
  const g = new THREE.Group(), hair = new THREE.Group();
  const put = (geo, m, px, py, pz, rx = 0, rz = 0, to = g) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.rotation.set(rx, 0, rz); to.add(o); return o; };
  put(new THREE.CapsuleGeometry(.42, 1.1, 4, 10), skin, 0, .95, 0);
  put(new THREE.SphereGeometry(.3, 12, 10), skin, 0, 2, .02);
  for (const s of [-1, 1]) {
    put(new THREE.CapsuleGeometry(.12, .9, 3, 6), skin, s * .94, 1.62, .15, 0, -s * 1.25);
    put(new THREE.SphereGeometry(.05, 6, 4), eyeM, s * .11, 2.04, .27);
  }
  put(new THREE.ConeGeometry(.2, .9, 6), hairM, 0, 1.55, .22, Math.PI);
  hair.position.set(0, 2.1, 0);
  g.add(hair);
  for (let k = 0; k < 18; k++) {
    const a = Math.PI * (.75 + 1.5 * k / 17), l = rr(1.2, 2.2), tilt = rr(.15, .3), x = Math.cos(a), z = Math.sin(a);
    put(new THREE.CylinderGeometry(.03, .12, l, 4), hairM, x * (.27 + tilt * l / 2), -l / 2 + .05, z * (.27 + tilt * l / 2), -tilt * z, tilt * x, hair);
  }
  for (let k = 0; k < 6; k++) put(new THREE.CylinderGeometry(.015, .03, .5, 3), D.mat(0x6a8a3a), Math.cos(k) * .2, .2, Math.sin(k) * .2 - .02, rr(-.3, .3), rr(-.3, .3), hair);
  g.position.set(x, wy - 5, z);
  g.scale.setScalar(2);
  D.add(g);

  // Ripples spread from where he breaks the water.

  const rings = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(.85, 1, 40).rotateX(-Math.PI / 2), D.mat(0, { additive: true, emissive: 0x70d8c8 }));
    m.position.set(x, wy + .03, z);
    return D.add(m);
  });
  D.light(x, wy + 1, z, [.25, .8, .7], 9, { flicker: 0 });
  D.tick(t => {
    const p = (t % 20) / 20, up = p < .22 ? sm(p / .22) : p < .6 ? 1 : p < .82 ? 1 - sm((p - .6) / .22) : 0, act = .25 + 3 * up * (1 - up);
    g.position.y = wy - 5 + 3.5 * up + Math.sin(t * 1.3) * .07 * up;
    g.rotation.y = Math.sin(t * .17) * .9;
    hair.rotation.x = Math.sin(t * .9) * .1;
    rings.forEach((m, k) => {
      const a = (t * .35 + k / 3) % 1;
      m.scale.setScalar(1 + a * 7);
      m.material.uniforms.uOpacity.value = (1 - a) ** 1.5 * Math.min(1, act) * (up > .02 ? 1 : .3);
    });
  });
}

// The rat king: rats knotted by their tails, twitching on a stone in a side chamber.

function ratChamber(D, F) {
  const cv = cave(D, [[-282, 132.5, 1], [-282, 135.5], [-278, 142], [-270, 145], [-262, 142], [-259, 135], [-262, 127], [-270, 124], [-278, 127]], F, 5, { jag: .8, floor: 'dirt' });
  aroundWall(cv, 14, .3, (x, z, nx, nz) => D.torch(x, F + 2.3, z, nx, nz));
  const X = -270, Z = 135, Y = F + .35;
  D.cyl(X, F, Z, 1.9, .35, 'rubble', { seg: 10 });
  for (let k = 0; k < 40; k++) { const a = rnd() * 6.3, r = rr(2.2, 7); D.box(X + Math.cos(a) * r, F, Z + Math.sin(a) * r, rr(.3, .7), .06, .06, 'bone', { rot: rnd() * 3 }); }
  for (let k = 0; k < 8; k++) { const a = rnd() * 6.3, r = rr(5, 8); D.geo(new THREE.SphereGeometry(rr(.6, 1.2), 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .35, 1), 'cloth', { at: [X + Math.cos(a) * r, F, Z + Math.sin(a) * r], rgb: [.5, .42, .2] }); }
  D.geo(new THREE.SphereGeometry(.2, 8, 6).scale(1, .9, 1.2), 'bone', { at: [X + 3, F + .15, Z - 2] });
  D.light(X, F + 2.5, Z, [1.3, .8, .4], 7, { flicker: 0 });

  const fur = D.mat(0x52483f), pink = D.mat(0x9e6c69), eyeM = D.mat(0, { emissive: 0xff3a20 });
  const body = new THREE.SphereGeometry(.16, 8, 6).scale(2, 1, 1.15), head = new THREE.ConeGeometry(.11, .28, 6).rotateZ(-Math.PI / 2), ear = new THREE.SphereGeometry(.05, 5, 3), eye = new THREE.SphereGeometry(.025, 4, 3);
  const root = new THREE.Group(), rats = [];
  root.position.set(X, Y, Z);
  root.scale.setScalar(1.7);
  root.add(at(new THREE.Mesh(new THREE.TorusKnotGeometry(.12, .045, 40, 5), pink), 0, .12, 0));
  for (let k = 0; k < 11; k++) {
    const a = k / 11 * Math.PI * 2, r = new THREE.Group(), hd = new THREE.Group();
    r.rotation.y = -a;
    r.add(at(new THREE.Mesh(body, fur), .72, .15, 0));
    hd.position.set(1.02, .16, 0);
    hd.add(new THREE.Mesh(head, fur));
    for (const s of [-1, 1]) {
      hd.add(at(new THREE.Mesh(ear, pink), -.06, .09, s * .07));
      hd.add(at(new THREE.Mesh(eye, eyeM), .04, .05, s * .06));
    }
    r.add(hd);
    const tail = new THREE.CatmullRomCurve3([new THREE.Vector3(.42, .12, 0), new THREE.Vector3(.25, .06, .08 * (k % 2 ? 1 : -1)), new THREE.Vector3(.1, .12, -.04), new THREE.Vector3(0, .12, 0)]);
    r.add(new THREE.Mesh(new THREE.TubeGeometry(tail, 8, .022, 3), pink));
    root.add(r);
    rats.push({ r, hd, a, f: rr(1.5, 3), ph: rr(0, 9) });
  }
  D.add(root);
  D.tick(t => {
    for (const q of rats) {
      const spike = Math.max(0, Math.sin(t * q.f + q.ph)) ** 12;
      q.r.rotation.y = -q.a + Math.sin(t * .7 + q.ph) * .06 + spike * Math.sin(t * 40) * .12;
      q.r.position.y = spike * .03;
      q.hd.rotation.y = Math.sin(t * 9 + q.ph) * .15 + spike * .4;
      q.hd.rotation.z = Math.sin(t * 6 + q.ph) * .1;
    }
  });
}

// ---------- Rumpelstilzchen's Kammer ----------

function rumpelKammer(D, Z) {
  const F = Z.floor, STRAW = [.66, .53, .24];

  // The miller's daughter's locked chamber: straw, the spinning wheel and spools of gold thread.

  D.tunnel([[-240, F, 245], [-240, F, 263.2]], { w: 3, h: 4.2, wall: 'ashlar', floor: 'flag', torches: 7 });
  D.room(-240, 272, F, 22, 16, 5, { wall: 'ashlar', floor: 'wood', doors: [{ side: 'n', at: 0, w: 3, h: 3.2 }, { side: 'e', at: .5, w: 2.6, h: 3 }, { side: 's', at: -.55, w: 1.6, h: 2.4 }] });
  for (const z of [266.5, 272, 277.5]) D.arch(-240, F + 4.5, z, 22, 1.3, { thick: .45, depth: .5 });
  D.frame(-238.7, 263.8, -.9, () => { D.box(.75, F, 0, 1.5, 3, .14, 'wood'); for (const y of [.5, 1.5, 2.5]) D.box(.75, F + y, .09, 1.5, .1, .04, 'iron'); });
  D.box(-241.6, F + 1.3, 263.2, .3, .4, .2, 'iron');
  D.torchRing(-240, 272, F, 22, 16, 10);
  for (let k = 0; k < 34; k++) {
    const x = rr(-250, -230), z = rr(265, 279);
    if (Math.hypot(x + 237.5, z - 273) < 3.6 || Math.abs(x + 240) < 1.8 && z < 268) continue;
    D.geo(new THREE.SphereGeometry(rr(.6, 1.5), 9, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, rr(.4, .7), rr(.6, 1)), 'cloth', { at: [x, F, z], rot: rnd() * 3, rgb: STRAW, jit: .12 });
  }
  for (let k = 0; k < 10; k++) D.geo(new THREE.CylinderGeometry(.3, .4, 1.1, 8), 'cloth', { at: [-249.5 + k * .75, F + .55, 279], rgb: STRAW, jit: .12 });
  for (let k = 0; k < 60; k++) D.box(rr(-250, -230), F + .03, rr(265, 279), rr(.4, .9), .03, .04, 'cloth', { rot: rnd() * 3, rgb: STRAW });
  wheel(D, -238, F, 273, .3, 1.6);
  D.box(-236, F, 274.5, .5, .45, .5, 'wood');

  // Gold: spools on a shelf, skeins on the floor and a basket full.

  D.box(-229.6, F + 1.2, 268, .6, .08, 4, 'wood'); D.box(-229.6, F + 2.1, 268, .6, .08, 4, 'wood');
  for (const y of [1.28, 2.18]) for (let z = 266.4; z < 270; z += .45) D.geo(new THREE.CylinderGeometry(.13, .13, .3, 10).translate(0, .15, 0), 'gold', { at: [-229.6, F + y, z] });
  for (let k = 0; k < 9; k++) D.geo(new THREE.TorusGeometry(.26, .07, 6, 14).rotateX(Math.PI / 2), 'gold', { at: [-235.5 + rr(-1.2, 1.2), F + .07, 271 + rr(-1.2, 1.4)] });
  D.cyl(-235, F, 276.6, .5, .5, 'wood', { seg: 10, top: false });
  for (let k = 0; k < 7; k++) D.geo(new THREE.CylinderGeometry(.12, .12, .28, 8).rotateZ(rr(-1, 1)), 'gold', { at: [-235 + rr(-.25, .25), F + .45 + k * .03, 276.6 + rr(-.25, .25)] });
  D.light(-237, F + 2.8, 273.5, [1.6, 1.15, .6], 10, { flicker: 0 });
  for (const x of [-246, -233]) D.light(x, F + 3.5, 272, [1.1, .8, .45], 11, { flicker: 0 });
  D.box(-247, F, 268, 1.4, .8, .8, 'wood');
  D.candle(-247.4, F + .8, 268); D.candle(-246.6, F + .8, 268.2);
  D.label('The spinning chamber', -240, F + 5.5, 272, 'district quarter under');

  // The east way out to the network.

  D.tunnel([[-228.2, F, 276], [-212, F, 276], [-196, F, 290], [-186, F, 300], [-175, F, 300]], { w: 3, h: 4.2, wall: 'ashlar', floor: 'flag', torches: 9 });

  // The secret way behind the straw, down to the little man's hearth.

  D.tunnel([[-246.05, F, 280.8], [-247, F, 288], [-256, F, 294], [-266, F, 298], [-268, F, 304], [-268, F, 311]], { w: 1.8, h: 3, wall: 'rock', floor: 'dirt', rough: .5 });
  for (const [x, z] of [[-247, 288], [-256.5, 293.2], [-266.5, 299], [-267.3, 306]]) D.candle(x, F, z, { r: 4 });

  const cv = cave(D, [[-269, 311, 1], [-267, 311], [-260, 313], [-255, 319], [-254, 327], [-257, 335], [-264, 341], [-274, 342], [-283, 338], [-288, 330], [-287, 321], [-282, 314], [-276, 311.5]], F, 6, { jag: 1, floor: 'dirt', rgb: [.33, .29, .25] });
  aroundWall(cv, 3.5, .6, (x, z, nx, nz) => {
    const l = rr(1.5, 4);
    D.geo(new THREE.CylinderGeometry(.04, .12, l, 4).rotateX(nz * rr(.3, .7)).rotateZ(-nx * rr(.3, .7)), 'wood', { at: [x, F + 6 - l / 2, z], rgb: [.3, .22, .14] });
  });
  aroundWall(cv, 4, 1.2, (x, z) => { if (rnd() < .6) D.geo(new THREE.ConeGeometry(rr(.15, .3), rr(.15, .3), 7).translate(0, .25, 0), 'cloth', { at: [x, F, z], rgb: rnd() < .5 ? [.7, .15, .1] : [.75, .66, .5] }); });
  aroundWall(cv, 16, .3, (x, z, nx, nz) => D.torch(x, F + 2.3, z, nx, nz));
  D.light(-271, F + 5, 327, [1.2, .8, .45], 22, { flicker: 0 });

  // His fire, with a ring of stones and logs.

  const FX = -272, FZ = 327;
  for (let k = 0; k < 12; k++) { const a = k / 12 * 6.28; rock(D, FX + Math.cos(a) * 1.6, F, FZ + Math.sin(a) * 1.6, .38); }
  for (let k = 0; k < 4; k++) D.geo(new THREE.CylinderGeometry(.14, .14, 2, 6).rotateZ(Math.PI / 2 - .3), 'wood', { at: [FX, F + .35, FZ], rot: k * .8, rgb: [.2, .13, .08] });
  D.glow(FX, F + .02, FZ, 2.1, .1, 2.1, [2, .55, .15], { pulse: .5 });
  D.flame(FX, F + .25, FZ, 2.3); D.flame(FX + .5, F + .2, FZ - .4, 1.4); D.flame(FX - .5, F + .2, FZ + .3, 1.2);
  D.light(FX, F + 2, FZ, [2.2, 1.05, .45], 20);

  // Today he bakes, tomorrow he brews, and then he fetches the queen's child.

  D.geo(new THREE.SphereGeometry(2, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .8, 1), 'brick', { at: [-284, F, 328] });
  D.glow(-282.1, F + .1, 328, .3, .8, 1.1, [2, .6, .15], { pulse: .3 });
  D.light(-281, F + 1, 328, [1.8, .8, .3], 8);
  D.box(-279, F, 335, 2.6, .9, 1, 'wood', { rot: .5 });
  for (let k = 0; k < 4; k++) D.geo(new THREE.SphereGeometry(.25, 8, 4).scale(1, .5, 1.3), 'dirt', { at: [-280 + k * .6, F + .9, 335.5 - k * .3], rgb: [.55, .35, .16] });
  D.geo(new THREE.SphereGeometry(.85, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 'iron', { at: [-279, F + 1.3, 317.5] });
  D.geo(new THREE.TorusGeometry(.85, .06, 4, 16).rotateX(Math.PI / 2), 'iron', { at: [-279, F + 1.3, 317.5] });
  for (let k = 0; k < 3; k++) { const a = k * 2.09; D.box(-279 + Math.cos(a) * .8, F, 317.5 + Math.sin(a) * .8, .08, 1.3, .08, 'iron'); }
  D.water(-279, F + 1.2, 317.5, 1, 1, { rgb: [.15, .3, .08] });
  D.glow(-279, F, 317.5, .8, .1, .8, [1.8, .5, .12], { pulse: .6 });
  D.flame(-279, F + .1, 317.5, .7);
  D.light(-279, F + 1, 317.5, [1.6, .8, .35], 8);
  D.frame(-270, 338, .1, () => {
    D.box(0, F + .25, 0, 1.4, .6, .8, 'wood');
    for (const s of [-1, 1]) D.geo(new THREE.TorusGeometry(.8, .05, 4, 10, Math.PI * .5).rotateZ(Math.PI * 1.25), 'wood', { at: [0, F + .82, s * .38] });
    D.box(0, F + .8, 0, 1.2, .1, .6, 'cloth', { rgb: [.75, .72, .62] });
  });
  for (let k = 0; k < 8; k++) D.box(-276 + rr(-1, 1), F + k * .22, 314 + rr(-.2, .2), 1.8, .22, .22, 'wood', { rot: rr(-.1, .1) });
  D.box(-266, F, 335, .5, .45, .5, 'wood');
  D.geo(new THREE.SphereGeometry(1.3, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.4, .3, 1), 'moss', { at: [-284, F, 320], rgb: [.3, .38, .2] });

  // The crack where he stamped his foot so deep that he tore himself in two. It glows from below.

  const CR = [[-261, 316], [-262.5, 319], [-261, 322.5], [-263, 326], [-262, 329.5], [-264, 333], [-262.5, 337]];
  for (let i = 0; i < CR.length - 1; i++) {
    const a = CR[i], b = CR[i + 1], w = .65 - .35 * Math.abs(i - 3) / 3;
    D.glow((a[0] + b[0]) / 2, F, (a[1] + b[1]) / 2, Math.hypot(b[0] - a[0], b[1] - a[1]) + .1, .08, w, [2, .5, .1], { pulse: .35, phase: i / 9, rot: ang(b[0] - a[0], b[1] - a[1]) });
    const nx = -(b[1] - a[1]), nz = b[0] - a[0], nl = Math.hypot(nx, nz);
    for (const s of [-1, 1]) beam(D, [a[0] + s * nx / nl * (w / 2 + .2), a[1] + s * nz / nl * (w / 2 + .2)], [b[0] + s * nx / nl * (w / 2 + .2), b[1] + s * nz / nl * (w / 2 + .2)], F, .2, .4, 'rock', { rgb: [.2, .17, .14] });
    if (i % 2) D.light((a[0] + b[0]) / 2, F + .8, (a[1] + b[1]) / 2, [1.9, .6, .2], 7, { flicker: 0 });
  }
  D.geo(new THREE.ConeGeometry(.22, .6, 8).rotateZ(1.4), 'cloth', { at: [-260.5, F + .2, 330], rgb: [.7, .12, .08] });

  rumpelFigure(D, FX, F, FZ, 3.3);
  D.label(Z.name, -255, F + 6, 300);
  D.label('The little man’s hearth', FX, F + 5.5, FZ + 6, 'district quarter under');
}

// A spinning wheel on its bench, facing +z after rot.

function wheel(D, x, y, z, rot, k = 1) {
  const box = (bx, by, bz, w, h, d, m) => D.box(bx * k, y + by * k, bz * k, w * k, h * k, d * k, m), geo = (g, m, gx, gy) => D.geo(g, m, { at: [gx * k, y + gy * k, 0], scale: k });
  D.frame(x, z, rot, () => {
    box(0, .45, 0, 1.7, .12, .45, 'wood');
    for (const [lx, lz] of [[-.75, -.17], [-.75, .17], [.75, 0]]) box(lx, 0, lz, .09, .5, .09, 'wood');
    for (const s of [-1, 1]) box(.4, .5, s * .13, .07, .9, .07, 'wood');
    geo(new THREE.TorusGeometry(.62, .05, 5, 22), 'wood', .4, 1.3);
    for (let j = 0; j < 6; j++) D.slab(.4 * k, y + 1.3 * k, 0, 1.22 * k, .035 * k, .035 * k, j * Math.PI / 6, 'wood');
    geo(new THREE.CylinderGeometry(.06, .06, .3, 8).rotateX(Math.PI / 2), 'iron', .4, 1.3);
    box(-.55, .57, 0, .12, .25, .3, 'wood');
    geo(new THREE.CylinderGeometry(.09, .09, .26, 10).rotateX(Math.PI / 2), 'gold', -.55, .9);
    box(-.75, .57, 0, .05, 1.1, .05, 'wood');
    D.geo(new THREE.ConeGeometry(.18, .5, 6), 'cloth', { at: [-.75 * k, y + 1.8 * k, 0], scale: k, rgb: [.66, .53, .24] });
    box(.1, .05, 0, .55, .04, .3, 'wood');
  });
}

// Rumpelstilzchen hops round his fire on one leg, arms flailing.

function rumpelFigure(D, cx, y, cz, R) {
  const coat = D.mat(0x7a4420, { emissive: 0x1a0800 }), cap = D.mat(0xc02a1e, { emissive: 0x300400 }), skin = D.mat(0xe0a880, { emissive: 0x201008 }), beardM = D.mat(0xe6e0d0, { emissive: 0x202020 }), legM = D.mat(0x3a2a1a);
  const g = new THREE.Group(), arms = [], put = (geo, m, px, py, pz, rx = 0, rz = 0, to = g) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.rotation.set(rx, 0, rz); to.add(o); return o; };
  put(new THREE.CapsuleGeometry(.07, .4, 3, 6), legM, 0, .27, 0);
  const kick = put(new THREE.CapsuleGeometry(.07, .35, 3, 6), legM, .1, .55, .18, -1.3);
  put(new THREE.CapsuleGeometry(.22, .35, 4, 8), coat, 0, .82, 0);
  put(new THREE.CylinderGeometry(.3, .2, .3, 8), coat, 0, .62, 0);
  put(new THREE.SphereGeometry(.17, 10, 8), skin, 0, 1.22, .02);
  put(new THREE.SphereGeometry(.05, 5, 4), skin, 0, 1.2, .19);
  put(new THREE.ConeGeometry(.17, .55, 8), cap, 0, 1.58, -.04, -.25);
  put(new THREE.ConeGeometry(.13, .5, 6), beardM, 0, .95, .14, Math.PI + .25);
  for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * .22, 1, 0); put(new THREE.CapsuleGeometry(.05, .35, 3, 5), coat, 0, .22, 0, 0, 0, p); g.add(p); arms.push([p, s]); }
  g.scale.setScalar(1.6);
  D.add(g);
  D.tick(t => {
    const th = t * .75, hop = Math.abs(Math.sin(t * 5));
    g.position.set(cx + Math.cos(th) * R, y + hop * .45, cz + Math.sin(th) * R);
    g.rotation.y = -th + Math.sin(t * 2.5) * .25;
    g.rotation.z = Math.sin(t * 5) * .08;
    kick.rotation.x = -1.3 + Math.sin(t * 5) * .3;
    for (const [p, s] of arms) p.rotation.z = -s * (1.9 + Math.sin(t * 5 + s) * .5);
  });
}

// ---------- Alberich's Hort ----------

function albHort(D, Z) {
  const F = Z.floor, COLD = [.25, .27, .31];
  const cv = cave(D, [
    [-120, -378], [-80, -382], [-40, -376], [-15, -360], [-8, -336], [-8, -321.5, 1], [-8, -318.5], [-12, -300], [-30, -282], [-50, -272],
    [-78.5, -268, 1], [-81.5, -268], [-110, -272], [-140, -284], [-158, -305], [-162, -330], [-155, -356], [-140, -372],
  ], F, 8, { jag: 2, rgb: COLD, floorRgb: [.23, .23, .25], rough: .8 });

  // Wall lamps, and cold blue crystal in the rock.

  aroundWall(cv, 26, .3, (x, z, nx, nz) => D.torch(x, F + 2.6, z, nx, nz));
  aroundWall(cv, 7, .9, (x, z) => { if (rnd() < .45) D.glow(x, F + rr(.8, 5), z, rr(.2, .5), rr(.3, .9), rr(.2, .5), [.35, .6, 1.3], { rot: rnd() * 3 }); });

  // Timbered adits from the anchors.

  for (const [a, b] of [[[-80, -255], [-80, -268]], [[10, -320], [-8, -320]]]) {
    D.tunnel([[a[0], F, a[1]], [b[0], F, b[1]]], { w: 3, h: 4, wall: 'rock', floor: 'dirt', rgb: COLD, rough: .4, torches: 8 });
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]), r = ang(b[0] - a[0], b[1] - a[1]);
    for (let u = 1.5; u < l; u += 3) D.frame(a[0] + (b[0] - a[0]) * u / l, a[1] + (b[1] - a[1]) * u / l, r, () => {
      for (const s of [-1, 1]) D.box(0, F, s * 1.3, .3, 3.3, .3, 'wood');
      D.box(0, F + 3.3, 0, .35, .35, 3.4, 'wood');
    });
  }

  // The dwarf forges along the north wall.

  for (const x of [-104, -89, -74, -59]) {
    forge(D, x, F, -375);
    for (let k = 0; k < 7; k++) rock(D, x + 4.2 + rr(-.6, .6), F, -374 + rr(-.6, .6), rr(.25, .5), 'rock', { rgb: [.08, .07, .07], flat: .5 });
    for (let k = 0; k < 2; k++) D.cyl(x + 5.2, F + k * 1.1, -376 + k * .2, .4, 1.05, 'wood', { seg: 10 });
  }
  D.box(-81.5, F, -366.5, 4, .9, 1.4, 'wood');
  for (let k = 0; k < 5; k++) D.box(-83 + k * .7, F + .9, -366.5 + rr(-.3, .3), .5, .08, .12, 'iron', { rot: rr(-.4, .4) });
  for (let k = 0; k < 14; k++) D.box(-71 + (k % 7) * .45, F + Math.floor(k / 7) * .14, -366, .38, .14, .9, 'gold', { jit: .05 });
  for (let k = 0; k < 6; k++) rock(D, rr(-115, -50), F, rr(-366, -360), rr(.4, .8), 'iron', { flat: .5 });
  D.label('Dwarf forges', -82, F + 6, -366, 'district quarter under');

  // Mine rails from the east adit to the ore chutes, with a cart that rolls to and fro.

  const RAIL = [[8, -320], [-8, -320], [-30, -330], [-60, -342], [-100, -345], [-146, -332]];
  for (let i = 0; i < RAIL.length - 1; i++) {
    const a = RAIL[i], b = RAIL[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), r = ang(b[0] - a[0], b[1] - a[1]);
    D.frame(a[0], a[1], r, () => {
      for (const s of [-.55, .55]) D.box(l / 2, F + .1, s, l + .3, .1, .08, 'iron');
      for (let u = .4; u < l; u += .9) D.box(u, F, 0, .25, .1, 1.6, 'wood', { jit: .15 });
    });
  }
  for (const [x, z, nx] of [[-35, -334, 1], [-75, -346.5, -1], [-118, -344, 1]]) {
    D.box(x, F, z, .2, 2.8, .2, 'wood');
    D.flame(x, F + 2.9, z, .45);
    D.light(x, F + 3, z, [1.8, 1, .5], 11);
  }
  cart(D, -138, F, -334.4, ang(8, -2.6), false);
  movingCart(D, RAIL.slice(1), F);

  // Ore chutes come down the west wall from the workings above.

  for (const z of [-340, -325, -312]) {
    D.slab(-154, F + 3.85, z, 11.3, .15, 1.3, -.49, 'wood');
    for (const s of [-1, 1]) D.slab(-154, F + 4.1, z + s * .65, 11.3, .5, .08, -.49, 'wood');
    for (const x of [-151, -156]) D.box(x, F, z, .2, 2.3 + (-151 - x) * .53, .2, 'wood');
    for (let k = 0; k < 9; k++) rock(D, -147 + rr(-1.5, 1.5), F, z + rr(-1.5, 1.5), rr(.35, .8), 'rock', { rgb: [.2, .19, .2] });
    coins(D, -147, F + .3, z, 0, 1.4, 6);
    D.flame(-158.5, F + 6.7, z, .4);
    D.light(-156, F + 6, z, [1.8, 1, .5], 9);
  }

  // A chasm splits the west of the cave, glowing far below. The rails cross it on a trestle.

  const CH = [[-118, -282], [-124, -296], [-121, -310], [-128, -324], [-124, -338], [-130, -352], [-127, -366]];
  for (let i = 0; i < CH.length - 1; i++) {
    const a = CH[i], b = CH[i + 1], w = 3.4 - Math.abs(i - 3) * .6, nx = -(b[1] - a[1]), nz = b[0] - a[0], nl = Math.hypot(nx, nz);
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, l = Math.hypot(b[0] - a[0], b[1] - a[1]) + .4, r = ang(b[0] - a[0], b[1] - a[1]);
    D.box(mx, F - .1, mz, l, .13, w, 'rock', { rot: r, rgb: [.03, .025, .03], jit: 0 });
    D.glow(mx, F - .05, mz, l, .1, w * .28, [.8, .14, .04], { pulse: .15, phase: i / 7, rot: r });
    for (const s of [-1, 1]) for (let j = 0; j < 3; j++) { const u = (j + .5) / 3; rock(D, a[0] + (b[0] - a[0]) * u + s * nx / nl * (w / 2 + .5), F - .3, a[1] + (b[1] - a[1]) * u + s * nz / nl * (w / 2 + .5), rr(.7, 1.3), 'rock', { rgb: [.17, .16, .17] }); }
    if (i % 2) D.light((a[0] + b[0]) / 2, F + .5, (a[1] + b[1]) / 2, [1.2, .3, .1], 8, { flicker: 0 });
  }
  D.frame(-124.6, -338.2, ang(-46, 13), () => {
    D.box(0, F + .2, 0, 6.5, .15, 2.4, 'wood');
    for (const u of [-2.5, 0, 2.5]) for (const s of [-1, 1]) D.box(u, F - .5, s * 1.1, .25, 1.6, .25, 'wood');
    for (const s of [-1, 1]) D.box(0, F + 1.2, s * 1.15, 6.5, .1, .1, 'wood');
  });

  // Cold, dim fill light for the rock; the warm light comes from the fires and the gold.

  for (const [x, z] of [[-140, -300], [-145, -352], [-110, -362], [-40, -362], [-28, -300], [-55, -284], [-110, -284], [-60, -330], [-22, -335]]) D.light(x, F + 6, z, [.16, .22, .34], 24, { flicker: 0 });

  // Stalagmites and pit props in the cold rock.

  for (const [x, z, h] of [[-100, -360, 7], [-45, -350, 6.5], [-140, -295, 7.5], [-22, -318, 6], [-145, -300, 4], [-140, -292, 2.5], [-132, -287, 3.5], [-25, -290, 4.5], [-18, -305, 3], [-35, -285, 2.5], [-130, -360, 3.5], [-120, -368, 2.2], [-20, -350, 3.5], [-40, -366, 2.6], [-60, -282, 3], [-112, -282, 3.8], [-28, -345, 2]]) {
    spire(D, x, F, z, h * .3, h, 'rock', { rgb: COLD });
    spire(D, x + rr(-1.2, 1.2), F, z + rr(-1.2, 1.2), h * .15, h * .5, 'rock', { rgb: COLD });
  }
  for (const [x, z, r] of [[-140, -345, .3], [-138, -318, .1], [-30, -315, 1.2], [-45, -300, .8]]) D.frame(x, z, r, () => {
    for (const s of [-1, 1]) D.box(0, F, s * 1.6, .3, 3.5, .3, 'wood');
    D.box(0, F + 3.5, 0, .35, .35, 3.8, 'wood');
  });
  for (let k = 0; k < 6; k++) D.box(-38 + k * .1, F + k * .3, -309, 3, .3, .3, 'wood', { rot: 1.2 });

  // The hoard: mountains of gold round a pedestal with the Tarnkappe and the ring.

  const HX = -85, HZ = -303;
  D.floorPoly(blob(HX, HZ, 19, 16, 26, .18), F + .06, 'gold');
  for (let k = 0; k < 15; k++) {
    const a = k * .42 + rr(-.2, .2), r = rr(10, 16), x = HX + Math.cos(a) * r, z = HZ + Math.sin(a) * r, s = rr(2.5, 5.5), h = s * rr(.45, .7);
    D.geo(new THREE.SphereGeometry(s, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / s, rr(.75, 1.1)), 'gold', { at: [x, F, z], rot: rnd() * 6.3 });
    D.geo(new THREE.ConeGeometry(s * .4, h * .7, 9), 'gold', { at: [x + rr(-.5, .5), F + h * 1.2, z + rr(-.5, .5)] });
  }
  coins(D, HX, F, HZ, 4, 22, 220);
  for (let k = 0; k < 7; k++) { const a = rnd() * 6.3, r = rr(5, 9); chest(D, HX + Math.cos(a) * r, F, HZ + Math.sin(a) * r, rnd() * 6, rr(1, 1.4)); }
  for (let k = 0; k < 12; k++) { const a = rnd() * 6.3, r = rr(4.5, 9); goblet(D, HX + Math.cos(a) * r, F, HZ + Math.sin(a) * r, rr(1, 1.8)); }
  for (let k = 0; k < 4; k++) {
    const a = rnd() * 6.3, r = rr(5, 9), x = HX + Math.cos(a) * r, z = HZ + Math.sin(a) * r;
    D.geo(new THREE.CylinderGeometry(.26, .23, .18, 12, 1, true), 'gold', { at: [x, F + .15, z], scale: 1.5 });
    for (let j = 0; j < 6; j++) D.geo(new THREE.ConeGeometry(.04, .14, 4), 'gold', { at: [x + Math.cos(j) * .38, F + .4, z + Math.sin(j) * .38], scale: 1.5 });
  }
  for (let k = 0; k < 7; k++) {
    const a = rnd() * 6.3, r = rr(5, 10), x = HX + Math.cos(a) * r, z = HZ + Math.sin(a) * r, t = Math.PI / 2 + rr(-.4, .4), rot = rnd() * 3;
    D.frame(x, z, rot, () => { D.slab(0, F + 1.3, 0, 1.6, .07, .14, t, 'iron', [.6, .6, .65]); D.slab(Math.cos(t) * .55, F + 1.3 + Math.sin(t) * .55, 0, .1, .1, .6, t, 'gold'); });
  }
  for (let k = 0; k < 6; k++) { const a = rnd() * 6.3, r = rr(5, 10); D.geo(new THREE.CylinderGeometry(.55, .55, .07, 12).rotateX(Math.PI / 2 - .5), k % 2 ? 'gold' : 'iron', { at: [HX + Math.cos(a) * r, F + .5, HZ + Math.sin(a) * r], rot: rnd() * 6.3 }); }

  D.cyl(HX, F, HZ, 3.4, .8, 'ashlar', { seg: 18 });
  D.cyl(HX, F + .8, HZ, 2.5, .8, 'ashlar', { seg: 16 });
  D.cyl(HX, F + 1.6, HZ, 1.5, 1, 'ashlar', { seg: 14 });
  for (let k = 0; k < 14; k++) { const a = k / 14 * 6.28; D.glow(HX + Math.cos(a) * 2.95, F + .8, HZ + Math.sin(a) * 2.95, .3, .03, .3, [1.9, 1.3, .35], { pulse: .25, phase: k / 14, rot: -a }); }
  for (let k = 0; k < 4; k++) { const a = k * 1.57 + .78; D.brazier(HX + Math.cos(a) * 4.3, F, HZ + Math.sin(a) * 4.3, { r: 12 }); }
  D.light(HX, F + 6, HZ, [1.4, 1.1, .6], 18, { flicker: 0 });
  for (const a of [0, 1.57, 3.14, 4.71]) D.light(HX + Math.cos(a) * 11, F + 3.5, HZ + Math.sin(a) * 11, [1.3, 1, .5], 14, { flicker: 0 });
  D.cyl(HX, F + 2.6, HZ + 1.1, .12, .9, 'gold', { seg: 8 });
  tarnkappe(D, HX, F + 2.6, HZ - .35);
  ringOf(D, HX, F + 3.85, HZ + 1.1);

  D.label(Z.name, HX, F + 6, HZ - 10);
  D.label('Tarnkappe and the ring', HX, F + 5, HZ + 6, 'district quarter under');
}

// A forge backed against a wall, facing +z: hearth with glowing coals, hood and chimney, bellows, anvil, trough.

function forge(D, x, y, z) {
  D.box(x, y, z, 2.6, 1, 2, 'rubble');
  D.glow(x, y + 1, z + .1, 1.9, .12, 1.3, [2, .42, .1], { pulse: .3 });
  D.flame(x - .4, y + 1.05, z + .1, .55, [2, .6, .2]); D.flame(x + .45, y + 1.05, z, .4, [2, .6, .2]);
  for (const s of [-1, 1]) D.box(x + s * 1.3, y + 1, z + .85, .18, 1.6, .18, 'iron');
  D.box(x, y + 2.6, z - .1, 3, .5, 2.3, 'brick');
  D.box(x, y + 3.1, z - .5, 1.1, 4.3, 1.1, 'brick');
  D.frame(x - 2.1, z, 0, () => {
    D.slab(0, y + .95, 0, 1.4, .1, .9, .15, 'wood');
    D.slab(0, y + .5, 0, 1.4, .1, .9, -.1, 'wood');
    D.box(-.1, y + .48, 0, 1, .35, .8, 'cloth', { rgb: [.3, .2, .12] });
    D.box(.9, y + .6, 0, .6, .12, .12, 'iron');
    D.box(-.6, y, 0, .2, .55, .2, 'wood');
  });
  D.box(x + .2, y, z + 2.6, .6, .5, .55, 'wood');
  D.box(x + .2, y + .5, z + 2.6, 1, .3, .4, 'iron');
  D.geo(new THREE.ConeGeometry(.15, .45, 6).rotateZ(-Math.PI / 2), 'iron', { at: [x + .92, y + .65, z + 2.6] });
  D.box(x + 2.2, y, z + 1.8, .8, .6, 1.6, 'wood');
  D.water(x + 2.2, y + .56, z + 1.8, .6, 1.4);
  for (let k = 0; k < 5; k++) D.box(x - 1 + k * .45, y + 1.2, z - .9, .06, .9, .06, 'iron');
  D.light(x, y + 1.8, z + 1.6, [2.6, .75, .25], 16);
}

function cartMeshes(D) {
  const g = new THREE.Group(), iron = D.mat(0x3a3a3e), load = D.mat(0xd8a030, { emissive: 0x3a2400 }), wh = D.mat(0x202022);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, .75, 1.05), iron); body.position.y = .62; g.add(body);
  const heap = new THREE.Mesh(new THREE.SphereGeometry(.6, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.1, .55, .8), load); heap.position.y = .95; g.add(heap);
  for (const [x, z] of [[-.5, -.55], [.5, -.55], [-.5, .55], [.5, .55]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .1, 10).rotateX(Math.PI / 2), wh); w.position.set(x, .22, z); g.add(w); }
  return g;
}

function cart(D, x, y, z, rot) {
  D.box(x, y + .25, z, 1.5, .75, 1.05, 'iron', { rot });
  D.geo(new THREE.SphereGeometry(.6, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.1, .5, .8), 'gold', { at: [x, y + 1, z], rot });
}

function movingCart(D, path, y) {
  const seg = path.slice(1).map((b, i) => Math.hypot(b[0] - path[i][0], b[1] - path[i][1])), L = seg.reduce((a, b) => a + b, 0), g = D.add(cartMeshes(D));
  D.tick(t => {
    let s = L * (.08 + .6 * (1 - Math.cos(t * Math.PI * 2 / 45)) / 2), i = 0;
    while (i < seg.length - 1 && s > seg[i]) s -= seg[i++];
    const a = path[i], b = path[i + 1], u = Math.min(1, s / seg[i]);
    g.position.set(a[0] + (b[0] - a[0]) * u, y, a[1] + (b[1] - a[1]) * u);
    g.rotation.y = ang(b[0] - a[0], b[1] - a[1]);
  });
}

// The Tarnkappe: a hooded cloak that floats, turns and fades in and out.

function tarnkappe(D, x, y, z) {
  const lathe = new THREE.LatheGeometry(V2([[.95, 0], [.85, .5], [.6, 1.1], [.38, 1.55], [.44, 1.78], [.38, 2.05], [.22, 2.27], [0, 2.32]]), 28);
  const shell = new THREE.Mesh(lathe, D.mat(0xa8c4e0, { opacity: .35, emissive: 0x2a4060 })), halo = new THREE.Mesh(lathe, D.mat(0, { additive: true, emissive: 0x4a76c0 }));
  halo.scale.setScalar(1.07);
  const g = new THREE.Group(); g.add(shell, halo); g.position.set(x, y, z); g.scale.setScalar(1.4);
  D.add(g);
  D.light(x, y + 1.5, z, [.5, .7, 1.2], 7, { flicker: 0 });
  D.tick(t => {
    g.position.y = y + .2 + Math.sin(t * .8) * .14;
    g.rotation.y = t * .3;
    shell.material.uniforms.uOpacity.value = .18 + .2 * (.5 + .5 * Math.sin(t * 1.1));
    halo.material.uniforms.uOpacity.value = .25 + .35 * (.5 + .5 * Math.sin(t * 2.3 + Math.sin(t * .7) * 2));
    halo.scale.set(1.07 + Math.sin(t * 3.1) * .04, 1.07, 1.07 + Math.cos(t * 2.7) * .04);
  });
}

// The ring floats above a little golden column, spinning in its own glow.

function ringOf(D, x, y, z) {
  const ring = D.add(new THREE.Mesh(new THREE.TorusGeometry(.32, .08, 8, 24), D.mat(0xffc855, { emissive: 0xffa020 })));
  const halo = D.add(new THREE.Mesh(new THREE.RingGeometry(.2, .55, 24), D.mat(0, { additive: true, emissive: 0xffa040 })));
  ring.position.set(x, y, z); halo.position.set(x, y, z);
  D.light(x, y, z, [1.8, 1.2, .3], 6, { flicker: 0 });
  D.tick(t => {
    ring.rotation.set(.5, t * 1.4, 0);
    ring.position.y = halo.position.y = y + Math.sin(t * 1.6) * .06;
    halo.lookAt(halo.position.x, halo.position.y + 10, halo.position.z + 6);
    halo.material.uniforms.uOpacity.value = .4 + .35 * Math.sin(t * 2);
  });
}

export default function build(D, Z) {
  nixGrotto(D, Z.nix);
  rumpelKammer(D, Z.rumpel);
  albHort(D, Z.hort);
}
