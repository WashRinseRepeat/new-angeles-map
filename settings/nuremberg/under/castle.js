// Under the Kaiserburg and the Rathaus: the castle casemates with Eppelein's cell, the Tiefer Brunnen that falls
// through every level, the Lochgefängnisse with their torture chamber, and Frau Holle's sunlit meadow at the bottom.

import * as THREE from 'three';

const PI = Math.PI;
const rnd = (a, b) => a + Math.random() * (b - a);

// The frame turn that points local +x along (dx, dz).

const along = (dx, dz) => Math.atan2(-dz, dx);

export default function build(D, Z) {
  const G = (g, mat, x, y, z, o = {}) => D.geo(g, mat, { ...o, at: [x, y, z] });
  const cylX = (r, len, seg = 8) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(PI / 2);
  const cylZ = (r, len, seg = 8) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(PI / 2);

  // A wall round a circle, with openings. gaps: [[angle, half width in metres], ...]. The wall's thickness lies outside.

  function ring(cx, cz, y, R, h, gaps, mat = 'ashlar') {
    const open = gaps.map(([a, hw]) => [a, Math.asin(Math.min(1, hw / R))]);
    const n = 40, isOpen = a => open.some(([g, ha]) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < ha);
    let run = [];
    const flush = () => { if (run.length > 1) D.wall(run.reverse(), y, h, mat, { thick: 1.2 }); run = []; };
    let k0 = 0;
    while (k0 < n && !isOpen(k0 / n * PI * 2)) k0++;
    for (let k = 0; k <= n; k++) {
      const a = ((k0 + k) % n) / n * PI * 2;
      if (isOpen(a)) flush(); else run.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]);
    }
    flush();
    const poly = [];
    for (let k = 0; k < 24; k++) poly.push([cx + Math.cos(k / 24 * PI * 2) * (R + .3), cz + Math.sin(k / 24 * PI * 2) * (R + .3)]);
    D.floorPoly(poly, y, 'flag');
  }

  casemates(D, Z.burg, G, cylX, cylZ, ring);
  well(D, G, cylX);
  prisons(D, Z.rathaus, G, cylX, cylZ);
  holle(D, Z.holle, G, cylX, cylZ);
}

// ---------- the Kaiserburg casemates ----------

function casemates(D, zone, G, cylX, cylZ, ring) {
  const y = zone.floor, H = 4.6, W = 4.4;

  // Round bastion chambers at the bends of the gallery, which follows the north edge of the castle rock.

  const R = [[-170, -458], [-112, -492], [-22, -497], [38, -466]];
  const dirTo = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  R.forEach((c, i) => {
    const gaps = [];
    if (i > 0) gaps.push([dirTo(c, R[i - 1]), W / 2]);
    if (i < R.length - 1) gaps.push([dirTo(c, R[i + 1]), W / 2]);
    gaps.push([PI / 2, 1.6]);
    ring(c[0], c[1], y, 5.5, H, gaps);
    D.cyl(c[0], y, c[1], .55, 3.6, 'ashlar', { seg: 8 });
    for (let k = 0; k < 4; k++) D.frame(c[0], c[1], k * PI / 4, () => D.arch(0, y + 3.4, 0, 11, 1.4, { thick: .35, depth: .4 }));
    for (const a of [PI * .25, PI * .75, PI * 1.25, PI * 1.75]) D.torch(c[0] + Math.cos(a) * 5.3, y + 2.4, c[1] + Math.sin(a) * 5.3, -Math.cos(a), -Math.sin(a));
  });

  // Gallery runs between the chambers. Gun-port niches open on the north side, each with a moonlit slit and some a cannon.

  const southDoors = [];
  for (let i = 0; i < R.length - 1; i++) {
    const a = R[i], b = R[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) - 9, rot = along(dx, dz);
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, nn = Math.floor(len / 9), doors = [{ side: 'w', w: W, h: H }, { side: 'e', w: W, h: H }];
    const niche = [];
    for (let k = 0; k < nn; k++) { const u = -len / 2 + (k + .5) * len / nn; niche.push(u); doors.push({ side: 'n', at: u / (len / 2), w: 2.2, h: H }); }
    if (i === 1) doors.push({ side: 's', at: (-60 - mx) / (len / 2) * Math.sign(dx), w: 3, h: H });
    D.room(mx, mz, y, len, W, H, { rot, doors });
    D.frame(mx, mz, rot, () => {
      for (let u = -len / 2 + 2; u < len / 2; u += 4) D.arch(u, y + 3.5, 0, W + .8, 1.1, { rot: PI / 2, thick: .35, depth: .45 });
      niche.forEach((u, k) => {
        const z0 = -W / 2 - .8;
        D.floor(u, y, z0 - 1.4, 2.2, 2.8, 'flag');
        D.box(u - 1.5, y, z0 - 1.4, .8, H, 2.8, 'ashlar');
        D.box(u + 1.5, y, z0 - 1.4, .8, H, 2.8, 'ashlar');
        D.box(u, y, z0 - 3.2, 3.8, H, .9, 'ashlar');
        D.glow(u, y + 1.4, z0 - 2.78, .22, .9, .1, [.3, .4, .7]);
        D.light(u, y + 1.6, z0 - 2.3, [.22, .28, .5], 3.5, { flicker: 0 });
        if (k % 2 === 0) cannon(D, G, cylX, u, y, z0 - 1.3);
        else for (let s = 0; s < 3; s++) G(new THREE.SphereGeometry(.16, 6, 4), 'iron', u + .5 - s * .35, y + .16, z0 - .4);
      });
      for (let k = 0; k < nn; k++) { const u = -len / 2 + k * len / nn + .3; if (k) D.torch(u, y + 2.4, W / 2 - .1, 0, -1); }
    });
    southDoors.push({ mx, mz, rot });
  }

  // Entry from the south anchor, through the guard room, to the gallery.

  const [ax, , az] = zone.anchors.south;
  D.tunnel([[ax, y, az], [ax, y, -455]], { w: 3, h: H, torches: 9 });
  const gz = -465;
  D.room(ax, gz, y, 12, 9, H, { doors: [{ side: 's', w: 3, h: H }, { side: 'n', w: 3, h: H }], torches: 5 });
  D.tunnel([[ax, y, gz - 5.3], [ax, y, -493]], { w: 3, h: H });
  guardRoom(D, G, cylX, ax, y, gz);

  // The powder store south of the east chamber, behind an iron door, lit only by a shielded lantern.

  const [px, pz] = R[3];
  D.tunnel([[px, y, pz + 6], [px, y, pz + 10]], { w: 3.2, h: H });
  D.room(px, pz + 15.5, y, 9, 8, H, { doors: [{ side: 'n', w: 1.6, h: 2.6 }], thick: 1.4, wall: 'rubble' });
  D.box(px - 1.1, y, pz + 11.6, .1, 2.5, 1.2, 'iron', { rot: .9 });
  for (let k = 0; k < 14; k++) {
    const cx = px - 3.4 + (k % 7) * 1.1, cz = pz + 13 + Math.floor(k / 7) * 1.1 + (k > 6 ? 4 : 0);
    D.cyl(cx, y, cz, .45, .95, 'wood', { seg: 9, r1: .4 });
    D.cyl(cx, y + .2, cz, .47, .06, 'iron', { seg: 9 });
    D.cyl(cx, y + .75, cz, .43, .06, 'iron', { seg: 9 });
  }
  for (let k = 0; k < 5; k++) D.cyl(px + 3.4, y, pz + 13 + k * 1.2, .4, .9, 'wood', { seg: 9 });
  D.box(px + 3.6, y, pz + 18.5, .9, .7, 1.2, 'wood');
  D.glow(px - 3.9, y + 2.2, pz + 19.2, .3, .4, .3, [1.4, 1, .45]);
  D.light(px - 3.5, y + 2.2, pz + 18.6, [.9, .65, .3], 8, { flicker: 0 });
  D.torch(px, y + 2.4, pz + 6.4, 0, 1);
  D.label('Powder store', px, y + 5, pz + 16, 'district quarter under');

  eppelein(D, G, cylX, cylZ, R[0], y, H);

  D.label('Kaiserburg casemates', -60, y + 6, -494);
  D.label('Guard room', ax, y + 5, gz, 'district quarter under');
}

function cannon(D, G, cylX, x, y, z) {
  D.box(x, y + .25, z, .9, .35, 1.8, 'wood');
  for (const s of [-1, 1]) for (const t of [-.6, .6]) G(cylX(.32, .14, 10), 'wood', x + s * .52, y + .32, z + t);
  G(new THREE.CylinderGeometry(.2, .28, 2.4, 10).rotateX(PI / 2), 'iron', x, y + .8, z - .2);
  G(new THREE.SphereGeometry(.3, 8, 6), 'iron', x, y + .8, z + 1);
}

function guardRoom(D, G, cylX, x, y, z) {
  D.box(x, y, z + .5, 4, .85, 1.3, 'wood');
  for (const s of [-1, 1]) D.box(x, y, z + .5 + s * 1.1, 3.8, .45, .35, 'wood');
  for (const [dx, dz] of [[-1.2, .3], [.4, .7], [1.3, .2]]) D.cyl(x + dx, y + .85, z + dz, .09, .2, 'iron', { seg: 6 });
  D.box(x - .3, y + .85, z + .4, .1, .1, .1, 'bone');
  D.box(x - .1, y + .85, z + .55, .1, .1, .1, 'bone');
  D.candle(x + .1, y + .85, z + .5);

  // Weapon racks along the west and east walls: halberds, pikes and crossbows.

  for (const s of [-1, 1]) {
    const wx = x + s * 5.6;
    D.box(wx, y + .1, z - 1, .3, .12, 6, 'wood');
    D.box(wx, y + 1.8, z - 1, .3, .12, 6, 'wood');
    for (let k = 0; k < 9; k++) {
      const zz = z - 3.6 + k * .65;
      D.box(wx, y + .1, zz, .07, 2.6, .07, 'wood');
      D.box(wx - s * .02, y + 2.5, zz, .05, .5, .22, 'iron');
    }
  }
  D.box(x - 3, y, z - 3.9, 2, 1.6, .5, 'wood');
  for (let k = 0; k < 3; k++) D.box(x - 3.6 + k * .6, y + 1.6, z - 3.9, .5, .12, .45, 'iron');
  D.box(x + 3.2, y, z - 3.8, 1.2, .9, .8, 'wood');
  G(new THREE.SphereGeometry(.28, 8, 6), 'iron', x + 3.2, y + 1.6, z - 3.9);
  D.box(x + 3.2, y + .9, z - 3.9, .5, .5, .3, 'iron');
}

// Eppelein's Verlies: the robber knight's cell, and the stall of the horse that leapt the moat.

function eppelein(D, G, cylX, cylZ, c, y, H) {
  const [cx, cz] = c, vz = cz + 13;
  D.tunnel([[cx, y, cz + 6], [cx, y, vz - 2.6]], { w: 2.4, h: H });
  D.room(cx, vz, y, 14, 4, H, { doors: [{ side: 'n', w: 2.4, h: H }, { side: 's', w: 14, h: H }], torches: 7 });

  // The cell: rubble walls, straw on the floor, chains and an iron door standing half open.

  const lx = cx - 3.15, lz = vz + 5.5;
  D.room(lx, lz, y, 5, 5, H, { doors: [{ side: 'n', w: 1.1, h: 2.2 }], wall: 'rubble', floor: 'dirt', floorRgb: [.32, .27, .15] });
  for (let k = 0; k < 90; k++) D.box(lx + rnd(-2.3, 2.3), y + .02, lz + rnd(-2.3, 2.3), rnd(.3, .6), .03, .04, 'wood', { rot: rnd(0, PI), rgb: [.6, .5, .22], jit: .15 });
  D.box(lx - .34, y, vz + 3.51, .1, 2.2, 1.1, 'iron', { rot: .4 });
  for (let k = 0; k < 6; k++) D.box(lx - .34, y + .3 + k * .35, vz + 3.51, .14, .06, 1.12, 'iron', { rot: .4 });
  D.box(lx + 1.8, y, lz + 1.2, 1.3, .45, 2.2, 'wood');
  for (const [wx, wz, nx] of [[lx - 2.45, lz - .5, 1], [lx - 2.45, lz + 1, 1]]) {
    for (let k = 0; k < 9; k++) G(new THREE.TorusGeometry(.07, .02, 4, 8).rotateY(k % 2 ? PI / 2 : 0), 'iron', wx + nx * .05, y + 1.9 - k * .13, wz);
    G(new THREE.TorusGeometry(.11, .035, 4, 10).rotateX(PI / 2), 'iron', wx + nx * .1, y + .7, wz);
  }
  D.cyl(lx + 1.5, y, lz - 1.6, .18, .35, 'rubble', { seg: 7, r1: .13 });
  D.glow(lx, y + 3.4, lz - 2.5, .5, .15, .1, [.25, .3, .55]);
  D.light(lx, y + 2.5, lz - 1.8, [.25, .3, .5], 5, { flicker: 0 });

  // The stall: manger, hay, saddle on its rack, bridle and spare shoes on the wall.

  const sx = cx + 3.15, sz = vz + 5.5;
  D.room(sx, sz, y, 5, 5, H, { doors: [{ side: 'n', w: 2.4, h: 2.8 }], wall: 'rubble', floor: 'dirt' });
  D.box(sx, y, sz + 2.2, 4.6, 1, .6, 'wood');
  for (let k = 0; k < 40; k++) D.box(sx + rnd(-2, 2), y + 1, sz + 2.2 + rnd(-.2, .2), rnd(.3, .5), .03, .04, 'wood', { rot: rnd(0, PI), rgb: [.62, .52, .24] });
  G(new THREE.SphereGeometry(1, 10, 6, 0, PI * 2, 0, PI / 2).scale(1.1, .55, .9), 'dirt', sx - 1.4, y, sz - .6, { rgb: [.6, .5, .22] });
  D.box(sx + 1.6, y, sz - 1.4, .3, 1.1, .3, 'wood');
  D.box(sx + 1.6, y + 1.1, sz - 1.4, 1.3, .12, .3, 'wood');
  G(new THREE.SphereGeometry(.55, 10, 6, 0, PI * 2, 0, PI / 2).scale(1, .55, .8), 'cloth', sx + 1.6, y + 1.2, sz - 1.4, { rgb: [.36, .2, .1] });
  D.box(sx + 1.6, y + .55, sz - 1.7, .06, .5, .02, 'iron');
  for (let k = 0; k < 3; k++) G(new THREE.TorusGeometry(.12, .025, 4, 10, PI * 1.5).rotateY(PI / 2), 'iron', sx + 2.45, y + 1.6, sz - .8 + k * .35);
  G(new THREE.TorusGeometry(.3, .03, 4, 14), 'cloth', sx + 2.45, y + 1.8, sz + .7, { rot: PI / 2, rgb: [.3, .18, .1] });
  D.torch(sx - 2.4, y + 2.3, sz + .5, 1, 0);
  D.torch(lx + 2.4, y + 2.3, lz + .8, -1, 0, { rgb: [1.3, .6, .3], r: 6 });

  // Hoof marks on the gallery floor, where the horse is led out for the last ride.

  for (let k = 0; k < 6; k++) G(new THREE.TorusGeometry(.12, .035, 3, 8, PI * 1.3).rotateX(PI / 2), 'iron', sx + (k % 2 ? .25 : -.25), y + .03, vz + 1.6 - k * 1.1);

  D.label('Eppelein’s Verlies', cx, y + 5, lz, 'district quarter under');
}

// ---------- the Tiefer Brunnen ----------

function well(D, G, cylX) {
  const x = -40, z = -455, top = 55, bot = -53, r = 1.6;
  D.shaft(x, z, bot, top, r, { wall: 'ashlar', torches: 8 });
  D.cyl(x, top - .8, z, r + 1, 1.7, 'ashlar', { seg: 16, top: false });
  D.cyl(x, top + .9, z, r + 1, .12, 'ashlar', { seg: 16 });

  // The winch: two posts, the drum with its rope and a crank.

  for (const s of [-1, 1]) D.box(x + s * 2.3, top - .8, z, .35, 3.7, .35, 'wood');
  D.box(x, top + 2.9, z, 5, .25, .4, 'wood');
  G(cylX(.35, 3.6, 12), 'wood', x, top + 2, z);
  G(cylX(.06, 4.8, 6), 'iron', x, top + 2, z);
  D.box(x + 2.55, top + 1.6, z, .08, .8, .08, 'iron');
  D.box(x + 2.65, top + 1.3, z, .3, .08, .08, 'wood');
  G(new THREE.CylinderGeometry(.04, .04, top + 2 - bot, 5, 72), 'wood', x + .1, (top + 2 + bot) / 2, z + .33, { rgb: [.5, .42, .28] });
  D.light(x, top + 1, z, [1.2, .8, .4], 6);
  D.label('Tiefer Brunnen', x, top - 1, z);
  D.label('Tiefer Brunnen', x, -32, z, 'district quarter under');
}

// ---------- the Lochgefängnisse ----------

function prisons(D, zone, G, cylX, cylZ) {
  const y = zone.floor, cz = -95, red = [1.55, .7, .32];

  // Twelve oak-lined holes in two rows on a narrow corridor.

  D.floor(-45, y, cz, 16, 7, 'flag');
  for (let k = 0; k < 12; k++) {
    const north = k < 6, x = -51 + (k % 6) * 2.4, z = cz + (north ? -1.9 : 1.9), s = north ? 1 : -1;
    D.room(x, z, y, 2, 2, 2.3, { wall: 'wood', floor: 'wood', thick: .2, doors: [{ side: north ? 's' : 'n', w: .7, h: 1.7 }], rgb: [.3, .2, .12] });
    const dz = z + s * 1.1, open = k === 3 || k === 8;
    D.box(open ? x + .55 : x, y, open ? dz + s * .3 : dz, .7, 1.7, .07, 'wood', { rot: open ? PI / 2 : 0, rgb: [.26, .17, .1] });
    for (const hy of [.35, 1.35]) if (!open) D.box(x, y + hy, dz + s * .05, .72, .07, .02, 'iron');
    if (!open) D.box(x + .12, y + 1.05, dz + s * .05, .22, .18, .03, 'iron');
    D.box(x, y, z - s * .7, 1.9, .45, .45, 'wood', { rgb: [.3, .2, .12] });
    if (k % 3 === 0) for (let j = 0; j < 14; j++) D.box(x + rnd(-.8, .8), y + .02, z + rnd(-.3, .6) * s, rnd(.2, .4), .03, .03, 'wood', { rot: rnd(0, PI), rgb: [.55, .46, .2] });
    if (k % 4 === 1) D.cyl(x + .7, y, z + .4 * s, .15, .3, 'wood', { seg: 7 });
    if (k % 5 === 2) for (let j = 0; j < 7; j++) G(new THREE.TorusGeometry(.06, .018, 4, 8).rotateY(j % 2 ? PI / 2 : 0), 'iron', x - .5, y + 1.8 - j * .11, z - s * .93);
    D.light(x, y + 2.1, z - s * .2, [.7, .32, .15], 3.2);
    if (k === 10) G(new THREE.SphereGeometry(.1, 6, 5), 'bone', x - .3, y + .5, z + .6 * s);
  }
  D.wall([[-37.8, cz - .7], [-37.8, cz - 3.1], [-52.4, cz - 3.1], [-52.4, cz - .7]], y, 2.4, 'rubble', { thick: 1 });
  D.wall([[-52.4, cz + .7], [-52.4, cz + 3.1], [-37.8, cz + 3.1], [-37.8, cz + .7]], y, 2.4, 'rubble', { thick: 1 });
  for (const x of [-49.8, -45, -40.2]) { D.box(x, y + 2.3, cz, .08, .08, 1.4, 'wood'); D.glow(x, y + 1.95, cz, .14, .25, .14, [1.6, .75, .3]); D.light(x, y + 1.9, cz, red, 5.5); }

  // The corridor from the west anchor, the crossing with the stair up to the Rathaus and the passage south.

  const [wx] = zone.anchors.west, [sx, , sz] = zone.anchors.south;
  D.tunnel([[wx, y, cz], [-52.4, y, cz]], { w: 3, h: 3.2, wall: 'rubble', torches: 6, torchRgb: red });
  D.tunnel([[-37.8, y, cz], [sx - 1.5, y, cz]], { w: 1.6, h: 3, wall: 'rubble', torches: 7, torchRgb: red });
  D.tunnel([[sx + 1.5, y, cz], [2, y, cz]], { w: 1.6, h: 3, wall: 'rubble' });
  D.tunnel([[sx, y, cz + .8], [sx, y, sz]], { w: 3, h: 3.2, wall: 'rubble', torches: 8, torchRgb: red });
  D.floor(sx, y, cz, 3, 1.6, 'flag');
  const run = D.stairs(sx, cz - .8, y, 17.2, 2.4, { rot: PI / 2, walls: false, mat: 'rubble' });
  for (const s of [-1, 1]) D.box(sx + s * 1.6, y, cz - .8 - run / 2 - .6, .8, 7.6, run + 1.2, 'rubble');
  D.box(sx, y, cz - .8 - run - 1.6, 4, 7.6, .8, 'rubble');
  D.floor(sx, 17.2, cz - .8 - run - .6, 2.4, 1.2, 'flag');
  D.box(sx, 17.22, cz - .8 - run - .6, 2, .1, 1, 'wood');
  D.box(sx, 17.32, cz - .8 - run - .6, 2.4, .05, .1, 'iron');
  D.torch(sx - 1.4, y + 2.3, cz - .5, 1, 0, { rgb: red });

  // Die Kapelle: rack, strappado, iron chair, brazier with irons, the executioner's table and the scribe's desk.

  const kx = 8.6, kw = 12, kd = 9;
  D.room(kx, cz, y, kw, kd, 3.6, { wall: 'rubble', doors: [{ side: 'w', w: 1.6, h: 2.4 }], torches: 4.5, torchRgb: red });
  for (let u = -4.5; u <= 4.5; u += 3) D.arch(kx + u, y + 2.6, cz, kd + .8, 1, { rot: PI / 2, thick: .3, depth: .4, mat: 'rubble' });
  D.arch(kx, y + 2.6, cz, kw + .8, 1, { thick: .3, depth: .4, mat: 'rubble' });

  // The rack.

  const rx = kx - 2.8, rz = cz - 2.4;
  for (const s of [-1, 1]) D.box(rx, y, rz + s * .45, 2.6, .85, .14, 'wood');
  for (let k = 0; k < 7; k++) D.box(rx - 1.1 + k * .37, y + .78, rz, .1, .06, .9, 'wood');
  for (const s of [-1, 1]) {
    G(cylZ(.12, 1.2, 8), 'wood', rx + s * 1.4, y + .9, rz);
    D.box(rx + s * 1.4, y + .82, rz + .62, .06, .5, .06, 'wood', { rot: s * .5 });
    D.box(rx + s * .9, y + .92, rz, .9, .03, .03, 'wood', { rgb: [.55, .46, .3] });
  }

  // The strappado: a gallows post, a pulley, the rope and stone weights.

  const qx = kx + 3.6, qz = cz - 2.6;
  D.box(qx + 1, y, qz, .3, 3.2, .3, 'wood');
  D.box(qx + .3, y + 3, qz, 1.8, .25, .25, 'wood');
  G(cylZ(.22, .12, 12), 'iron', qx - .45, y + 2.85, qz);
  G(new THREE.CylinderGeometry(.025, .025, 2, 4), 'wood', qx - .65, y + 1.85, qz, { rgb: [.55, .46, .3] });
  G(new THREE.CylinderGeometry(.025, .025, 2.5, 4).rotateZ(.4), 'wood', qx + .05, y + 1.8, qz, { rgb: [.55, .46, .3] });
  D.box(qx + .92, y + 1, qz + .2, .2, .12, .12, 'iron');
  for (const [dx, dz, s] of [[-.8, .6, .3], [-.3, .9, .25], [.2, .7, .35], [-.5, -.5, .22]]) {
    D.box(qx + dx, y, qz + dz, s * 1.4, s, s * 1.4, 'rubble');
    G(new THREE.TorusGeometry(.06, .02, 4, 8), 'iron', qx + dx, y + s + .05, qz + dz);
  }

  // The iron chair, its seat and back studded with spikes.

  const ix = kx - 3.6, iz = cz + 2.2;
  D.box(ix, y, iz, .7, .5, .7, 'iron');
  D.box(ix, y + .5, iz + .33, .7, 1, .07, 'iron');
  for (const s of [-1, 1]) D.box(ix + s * .36, y + .5, iz, .06, .35, .7, 'iron');
  const spikes = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    spikes.push(new THREE.ConeGeometry(.025, .09, 4).translate(ix - .28 + i * .14, y + .55, iz - .28 + j * .14));
    spikes.push(new THREE.ConeGeometry(.025, .09, 4).rotateX(-PI / 2).translate(ix - .28 + i * .14, y + .62 + j * .19, iz + .27));
  }
  for (const g of spikes) D.geo(g, 'iron');
  for (const s of [-1, 1]) G(new THREE.TorusGeometry(.07, .02, 4, 8).rotateX(PI / 2), 'iron', ix + s * .36, y + .9, iz);

  // The brazier with branding irons in the coals.

  const bx = kx + 1, bz = cz + .2;
  D.brazier(bx, y, bz, { rgb: [1.8, .6, .2] });
  D.glow(bx, y + 1.1, bz, .7, .08, .7, [1.8, .5, .12], { pulse: .7 });
  for (let k = 0; k < 4; k++) D.frame(bx, bz, k * 1.4 + .3, () => D.slab(.55, y + 1.3, 0, 1, .04, .04, .55, 'iron'));
  D.box(bx + 1.4, y, bz + .6, .5, .3, .5, 'wood', { rgb: [.15, .12, .1] });

  // The executioner's table with his tools, and the scribe's desk where the confession is written.

  const ex = kx + 3.6, ez = cz + 2.6;
  D.box(ex, y, ez, 2, .85, .9, 'wood');
  for (const [dx, dz, w, d, r] of [[-.7, -.2, .5, .05, .3], [-.2, .1, .4, .1, -.4], [.3, -.2, .3, .15, .1], [.7, .2, .55, .05, 1.2]]) D.box(ex + dx, y + .85, ez + dz, w, .04, d, 'iron', { rot: r });
  G(new THREE.TorusGeometry(.12, .03, 4, 10).rotateX(PI / 2), 'iron', ex + .1, y + .88, ez + .25);
  D.box(ex + 1.4, y, ez + .4, .5, 1.2, .5, 'wood', { rgb: [.2, .05, .04] });
  const dx = kx - 4.6, dz2 = cz - .2;
  D.box(dx, y, dz2, .8, .95, 1.3, 'wood', { rot: .1 });
  D.box(dx + .1, y + .95, dz2 - .1, .45, .04, .6, 'plaster', { rgb: [.75, .7, .55] });
  D.box(dx + .1, y + .95, dz2 + .4, .2, .1, .3, 'cloth');
  D.box(dx + .9, y, dz2, .45, .5, .45, 'wood');
  D.candle(dx - .2, y + .95, dz2 + .45);

  D.label('Lochgefängnisse', -30, y + 6, cz);
  D.label('die Kapelle', kx, y + 5, cz, 'district quarter under');
}

// ---------- Frau Holles Grund ----------

function holle(D, zone, G, cylX, cylZ) {
  const y = zone.floor, top = -53, cx = -50, cz = -480, wellX = -40, wellZ = -455, t0 = performance.now() / 1000;

  // A great cave whose floor is a meadow, under steady golden daylight.

  const RX = 64, RZ = 50, inside = (f = .9) => { const a = Math.random() * PI * 2, r = Math.sqrt(Math.random()) * f; return [cx + Math.cos(a) * RX * r, cz + Math.sin(a) * RZ * r]; };
  const poly = [];
  for (let k = 0; k < 64; k++) {
    const a = k / 64 * PI * 2, w = 1 + .1 * Math.sin(a * 3 + 1) + .06 * Math.sin(a * 7) + .03 * Math.sin(a * 17);
    poly.push([cx + Math.cos(a) * RX * w, cz + Math.sin(a) * RZ * w]);
  }
  D.cavern(poly, y, top - y, { floor: 'moss', floorRgb: [.34, .52, .2], bump: 0, rough: 1.6, thick: 3 });
  for (let gx = cx - 60; gx <= cx + 60; gx += 16) for (let gz = cz - 48; gz <= cz + 48; gz += 16) {
    const ex = (gx - cx) / RX, ez = (gz - cz) / RZ;
    if (ex * ex + ez * ez < 1) D.light(gx, y + 12, gz, [.6, .53, .3], 26, { flicker: 0 });
  }
  for (let k = 0; k < 64; k += 5) { const [px, pz] = poly[k], dx = cx - px, dz = cz - pz, l = Math.hypot(dx, dz); D.light(px + dx / l * 7, y + 15, pz + dz / l * 7, [.55, .48, .28], 24, { flicker: 0 }); }

  // Flowers in patches, bushes and a brook with a plank bridge.

  const cols = [[1.2, 1.1, 1], [1.3, 1, .2], [1.2, .3, .25], [.6, .55, 1.2], [1.2, .6, .9], [1.1, .75, .2]];
  for (let p = 0; p < 60; p++) {
    const [px, pz] = inside(.85), c = cols[p % cols.length], r = rnd(1.5, 4);
    for (let k = 0; k < 26; k++) { const a = rnd(0, PI * 2), d = Math.sqrt(Math.random()) * r; D.box(px + Math.cos(a) * d, y + .05, pz + Math.sin(a) * d, .3, .2, .3, 'plaster', { rgb: c, jit: .15, rot: rnd(0, PI) }); }
  }
  for (let k = 0; k < 500; k++) { const [fx, fz] = inside(); D.box(fx, y + .05, fz, .25, .18, .25, 'plaster', { rgb: cols[k % cols.length], jit: .15, rot: rnd(0, PI) }); }
  for (let k = 0; k < 26; k++) {
    const [bx, bz] = inside(.82), r = rnd(.8, 1.6);
    G(new THREE.IcosahedronGeometry(r, 1).scale(1, .7, 1), 'moss', bx, y + r * .5, bz, { rgb: [.18, .38, .12] });
  }
  const brook = [[cx + 36, cz - 44], [cx + 28, cz - 25], [cx + 34, cz - 5], [cx + 27, cz + 20], [cx + 33, cz + 44]];
  for (let i = 0; i < brook.length - 1; i++) {
    const [ax, az] = brook[i], [bx, bz] = brook[i + 1], l = Math.hypot(bx - ax, bz - az);
    D.floor((ax + bx) / 2, y + .1 + (i % 2) * .01, (az + bz) / 2, l + 1.6, 1.6, 'water', { rot: along(bx - ax, bz - az), rgb: [.12, .3, .34], jit: 0 });
  }

  D.box(-17.2, y + .1, -489, 3.4, .14, 1.8, 'wood', { rot: along(18, 6) });
  for (const s of [-1, 1]) D.frame(-17.2, -489, along(18, 6), () => D.box(0, y + .1, s * .85, 3.4, .7, .08, 'wood'));

  // The path the girl walks: from the well to the oven, the tree, the house and the gate.

  const stops = { oven: [-86, -466], tree: [-84, -500], house: [-38, -512], gate: [-2, -474] };
  const route = [[wellX, wellZ], [-62, -452], stops.oven, [-94, -484], stops.tree, [-66, -515], stops.house, [-26, -492], [-8, -486], stops.gate, [8, -474]];
  for (let i = 0; i < route.length - 1; i++) {
    const [ax, az] = route[i], [bx, bz] = route[i + 1], l = Math.hypot(bx - ax, bz - az);
    D.floor((ax + bx) / 2, y + .04 + (i % 2) * .02, (az + bz) / 2, l + 2.4, 2.4, 'dirt', { rot: along(bx - ax, bz - az), rgb: [.42, .34, .22] });
  }

  // The rope comes down through the cave roof with the bucket, and the girl's spindle lies in the grass.

  G(new THREE.CylinderGeometry(2.6, 3.4, 1.4, 14, 1, true), 'rock', wellX, top - .7, wellZ);
  D.light(wellX, top - 3, wellZ, [.6, .55, .35], 7, { flicker: 0 });
  const rope = new THREE.Group();
  rope.position.set(wellX + .1, top - .5, wellZ + .33);
  const rl = top - .5 - (y + 2.4);
  rope.add(new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, rl, 5).translate(0, -rl / 2, 0), D.mat(0x8a7350, { emissive: 0x201a10 })));
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(.35, .28, .5, 10).translate(0, -rl - .25, 0), D.mat(0x6b4a2a, { emissive: 0x1a1008 }));
  rope.add(bucket, new THREE.Mesh(new THREE.TorusGeometry(.33, .03, 4, 12, PI).translate(0, -rl + .05, 0), D.mat(0x333333)));
  D.add(rope);
  G(new THREE.CylinderGeometry(.04, .04, .5, 6).rotateZ(PI / 2), 'wood', wellX + 2, y + .1, wellZ + 1.5, { rot: .7 });
  G(new THREE.SphereGeometry(.07, 6, 4).scale(1, 1, 1.6), 'wood', wellX + 2, y + .1, wellZ + 1.5, { rot: .7, rgb: [.8, .7, .5] });

  // The bread oven, its mouth glowing, loaves on the peel crying to be pulled out.

  const [ox, oz] = stops.oven;
  G(new THREE.SphereGeometry(2.6, 16, 8, 0, PI * 2, 0, PI / 2).scale(1, .9, 1.1), 'brick', ox, y, oz);
  D.box(ox + 2.4, y, oz, 1.2, 1.6, 1.8, 'brick');
  D.glow(ox + 3.02, y + .3, oz, .05, .8, 1.1, [2, .9, .3], { pulse: .4 });
  D.cyl(ox - .8, y + 2, oz - .6, .3, 1.6, 'brick', { seg: 8 });
  D.flame(ox + 2.9, y + .4, oz, .6, [1.9, .9, .3]);
  D.light(ox + 4, y + 1.2, oz, [1.4, .7, .3], 9);
  D.box(ox + 4.4, y + .9, oz + .2, 2.2, .05, .45, 'wood', { rot: .2 });
  for (let k = 0; k < 7; k++) G(new THREE.SphereGeometry(.28, 8, 5).scale(1.4, .7, 1), 'wood', ox + 3.6 + (k % 4) * .65, y + .15, oz + 1.6 + Math.floor(k / 4) * .6, { rgb: [.72, .45, .18] });
  for (let k = 0; k < 10; k++) G(cylX(.1, 1.2, 6), 'wood', ox - 1, y + .1 + Math.floor(k / 4) * .2, oz + 3 + (k % 4) * .22, { rot: .1 });
  D.label('The bread oven', ox, y + 5, oz, 'district quarter under');

  // The apple tree heavy with apples, which fall when it is shaken.

  const [tx, tz] = stops.tree;
  D.cyl(tx, y, tz, .55, 4.5, 'wood', { seg: 10, r1: .35 });
  for (const [a, l] of [[.3, 3], [2.2, 3.4], [4, 2.8], [5.2, 3]]) D.frame(tx, tz, a, () => D.slab(l / 2, y + 4.4 + l * .2, 0, l, .3, .3, .5, 'wood'));
  const crown = [[0, 7.5, 0, 4], [2.4, 6.8, 1, 3], [-2.2, 6.6, -1, 3.2], [.5, 6.2, -2.5, 2.8], [-.8, 6.4, 2.4, 2.7]];
  for (const [dx, dy, dz, r] of crown) G(new THREE.IcosahedronGeometry(r, 1), 'moss', tx + dx, y + dy, tz + dz, { rgb: [.2, .42, .13] });
  for (let k = 0; k < 70; k++) {
    const [dx, dy, dz, r] = crown[k % crown.length], u = new THREE.Vector3(rnd(-1, 1), rnd(-.6, 1), rnd(-1, 1)).normalize().multiplyScalar(r * .98);
    G(new THREE.SphereGeometry(.2, 6, 4), 'plaster', tx + dx + u.x, y + dy + u.y, tz + dz + u.z, { rgb: [1.1, .2, .12], jit: .2 });
  }
  for (let k = 0; k < 18; k++) G(new THREE.SphereGeometry(.2, 6, 4), 'plaster', tx + rnd(-4, 4), y + .15, tz + rnd(-4, 4), { rgb: [1, .22, .12] });
  D.box(tx + 4.5, y, tz + 1, 1.2, .5, .8, 'wood');
  const appleMat = D.mat(0xd8321c, { emissive: 0x3a0806 }), apples = [];
  for (let k = 0; k < 4; k++) { const m = D.add(new THREE.Mesh(new THREE.SphereGeometry(.2, 6, 4), appleMat)); m.userData = { x: tx + rnd(-3, 3), z: tz + rnd(-3, 3), h: rnd(5.5, 8), ph: k * .9 }; apples.push(m); }
  D.label('The apple tree', tx, y + 11, tz, 'district quarter under');

  // Frau Holle's house: plastered and timbered, two storeys, a steep roof and the featherbed shaken from the upper window.

  const [hx, hz] = stops.house, hw = 11, hd = 7, eave = 6.4;
  D.box(hx, y, hz, hw, eave, hd, 'plaster', { rgb: [.82, .76, .64] });
  for (let u = -hw / 2; u <= hw / 2 + .01; u += hw / 5) { D.box(hx + u, y, hz - hd / 2 - .02, .22, eave, .06, 'wood'); D.box(hx + u, y, hz + hd / 2 + .02, .22, eave, .06, 'wood'); }
  for (const hy of [.1, 3.1, eave - .2]) { D.box(hx, y + hy, hz - hd / 2 - .03, hw, .22, .06, 'wood'); D.box(hx, y + hy, hz + hd / 2 + .03, hw, .22, .06, 'wood'); }
  for (const s of [-1, 1]) {
    const roof = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -hd / 2 - .2, 0, 0, hd / 2 + .2, 0, 4.6, 0], 3));
    G(roof, 'plaster', hx + s * hw / 2, y + eave, hz, { rgb: [.82, .76, .64] });
    G(roof, 'plaster', hx + s * (hw / 2 + .04), y + eave, hz, { rgb: [.82, .76, .64] });
  }
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(hw + 1.2, .25, hd / 2 / Math.cos(.92) + .4).rotateX(s * .92);
    G(g, 'brick', hx, y + eave + 2.3, hz + s * hd / 4, { rgb: [.58, .24, .14] });
  }
  D.box(hx + 3, y + eave + 2, hz + 1, .8, 4, .8, 'brick');
  D.box(hx - 2.5, y, hz + hd / 2 + .05, 1.3, 2.2, .08, 'wood', { rgb: [.4, .25, .12] });
  for (const wx of [-4.2, 1.2, 3.6]) D.glow(hx + wx, y + 1.2, hz + hd / 2 + .06, .9, 1, .04, [1.4, 1.1, .6]);
  for (const wx of [-3.6, -1.1, 3.6]) D.glow(hx + wx, y + 4, hz + hd / 2 + .06, .9, 1, .04, [1.4, 1.1, .6]);
  D.box(hx + 1.3, y + 3.9, hz + hd / 2 + .06, 1.4, 1.3, .05, 'iron', { rgb: [.05, .04, .03] });
  for (const k of [0, 1, 3, 4, 5, 6, 7, 8]) D.box(hx - 5.4 + k * 1.35, y, hz + hd / 2 + 2.5, .1, .9, .1, 'wood');
  D.box(hx - 4.75, y + .6, hz + hd / 2 + 2.5, 1.35, .08, .06, 'wood');
  D.box(hx + 2.03, y + .6, hz + hd / 2 + 2.5, 6.75, .08, .06, 'wood');
  D.light(hx, y + 5, hz + hd / 2 + 4, [.9, .85, .6], 10, { flicker: 0 });

  const bedG = new THREE.PlaneGeometry(2, 1.6, 10, 8), bedP = bedG.attributes.position.array.slice();
  const bed = new THREE.Mesh(bedG, D.mat(0xf6f1e6, { emissive: 0x5a5650 }));
  bed.position.set(hx + 1.3, y + 4.4, hz + hd / 2 + .1);
  D.add(bed);
  D.label('Frau Holle’s house', hx, y + 14, hz, 'district quarter under');

  // The gate home: gold falls in the north arch for Goldmarie, pitch in the south arch for Pechmarie.

  const [gx, gz] = stops.gate, gs = gz - 3, ps = gz + 3;
  for (const dz of [-6.2, 0, 6.2]) { D.box(gx, y, gz + dz, 2, 7.4, 2, 'ashlar'); D.box(gx, y + 7.4, gz + dz, 2.4, .5, 2.4, 'ashlar'); }
  D.box(gx, y + 7.9, gz, 2.2, 1.6, 14.6, 'ashlar');
  for (const dz of [-3, 3]) D.arch(gx, y + 5.3, gz + dz, 4.2, 2.3, { rot: PI / 2, thick: .6, depth: 1.9 });
  D.box(gx, y + 9.5, gs, 2.3, .5, 4, 'gold');
  G(new THREE.ConeGeometry(.9, 1.6, 6), 'gold', gx, y + 10.8, gs);
  D.box(gx, y + 9.5, ps, 2.3, .5, 4, 'iron', { rgb: [.03, .025, .02] });
  for (let k = 0; k < 8; k++) D.box(gx + rnd(-.9, .9), y + 9.5 - k * .1, ps + rnd(-1.6, 1.6), .14, rnd(.6, 1.6), .14, 'iron', { rgb: [.02, .02, .02] });
  for (let k = 0; k < 160; k++) G(new THREE.CylinderGeometry(.09, .09, .02, 7), 'gold', gx + rnd(-2.2, 2.2), y + .02 + Math.random() * .1, gs + rnd(-1.8, 1.8), { jit: .1 });
  G(new THREE.SphereGeometry(1.4, 10, 5, 0, PI * 2, 0, PI / 2).scale(1, .4, 1.1), 'gold', gx, y, gs);
  D.floorPoly([[gx - 2.4, ps - 1.7], [gx + 2.6, ps - 1.5], [gx + 2.3, ps + 1.9], [gx - 1.9, ps + 1.7]], y + .26, 'iron', { rgb: [.02, .018, .015], jit: 0 });
  D.light(gx - 3, y + 5, gs, [1.3, 1, .35], 9, { flicker: 0 });
  D.label('The gate of gold and pitch', gx, y + 13, gz, 'district quarter under');

  // Falling things: snow over the whole meadow, feathers round the window, gold and pitch in the arches.

  const dummy = new THREE.Object3D();
  function rain(n, geo, mat, spawn, fall) {
    const m = D.add(new THREE.InstancedMesh(geo, mat, n));
    m.frustumCulled = false;
    const st = Array.from({ length: n }, () => spawn(true));
    return dt => {
      for (let i = 0; i < n; i++) {
        const s = st[i];
        fall(s, dt);
        if (s.y < y + .05) st[i] = spawn(false);
        dummy.position.set(s.x, s.y, s.z); dummy.rotation.set(s.a, s.a * 1.3, 0); dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    };
  }
  const flake = new THREE.PlaneGeometry(.22, .22);
  const snow = rain(1100, flake, D.mat(0xffffff, { emissive: 0x8a8c96 }), first => {
    const a = Math.random() * PI * 2, rr = Math.sqrt(Math.random()) * .92;
    return { x: cx + Math.cos(a) * RX * rr, y: first ? rnd(y, top) : top - rnd(0, 2), z: cz + Math.sin(a) * RZ * rr, a: rnd(0, 6), v: rnd(.9, 1.6), p: rnd(0, 6) };
  }, (s, dt) => { s.y -= s.v * dt; s.p += dt; s.x += Math.sin(s.p * .8) * dt * .6; s.z += Math.cos(s.p * .6) * dt * .4; s.a += dt; });
  const feathers = rain(140, flake, D.mat(0xffffff, { emissive: 0xa0a0a0 }), first => ({ x: hx + 1.3 + rnd(-1, 1), y: first ? rnd(y, y + 4.4) : y + 4.4, z: hz + hd / 2 + rnd(.4, 1.6), a: rnd(0, 6), v: rnd(.4, .9), p: rnd(0, 6) }),
    (s, dt) => { s.y -= s.v * dt; s.p += dt; s.x += Math.sin(s.p * 1.3) * dt * .9; s.z += dt * .5; s.a += dt * 2; });
  const gold = rain(320, new THREE.PlaneGeometry(.14, .14), D.mat(0xffc23a, { emissive: 0xc08a20 }), first => ({ x: gx + rnd(-1.6, 1.6), y: first ? rnd(y, y + 7.6) : y + 7.6, z: gs + rnd(-1.8, 1.8), a: rnd(0, 6), v: rnd(3, 4.5) }),
    (s, dt) => { s.y -= s.v * dt; s.a += dt * 6; });
  const pitch = rain(130, new THREE.OctahedronGeometry(.08).scale(1, 2.2, 1), D.mat(0x0a0806, { lift: .15 }), first => ({ x: gx + rnd(-1.5, 1.5), y: first ? rnd(y, y + 7.6) : y + 7.6, z: ps + rnd(-1.7, 1.7), a: 0, v: rnd(1.2, 2.4) }),
    (s, dt) => { s.v += dt * 2.5; s.y -= s.v * dt; });

  D.tick((t, dt) => {
    dt = Math.min(dt, .1);
    snow(dt); feathers(dt); gold(dt); pitch(dt);
    const T = performance.now() / 1000 - t0;
    rope.rotation.set(Math.sin(T * .4) * .012, 0, Math.sin(T * .31) * .015);
    const p = bedG.attributes.position.array, shake = Math.sin(T * 5) * Math.max(0, Math.sin(T * .7));
    for (let i = 0; i < p.length; i += 3) {
      const u = bedP[i] / 2 + .5, v = .5 - bedP[i + 1] / 1.6;
      p[i + 1] = bedP[i + 1] * Math.cos(v * .6) - .4 * v;
      p[i + 2] = v * 1.1 + shake * v * .6 * Math.sin(u * PI) + .25 * Math.sin(u * PI * 2 + T * 6) * v;
    }
    bedG.attributes.position.needsUpdate = true;
    for (const a of apples) {
      const { x, z, h, ph } = a.userData, c = (T * .35 + ph) % 3, fall = Math.max(0, c - 1.8);
      a.position.set(x, y + Math.max(.2, h - 4.9 * fall * fall * 4), z);
    }
  });

  D.label('Frau Holles Grund', cx, y + 18, cz + 20);
}
