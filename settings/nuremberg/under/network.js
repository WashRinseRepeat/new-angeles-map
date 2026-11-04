// The tunnel network that joins the landmarks: the Kloake sewers along the Pegnitz, the passages between the
// cellars, the dungeon ring at -18, the Totenweg on the deep level and the smugglers' tunnel to the moat.
// Side rooms along the way (cell blocks, crypts, store rooms, guard rooms) fill the gaps between landmarks.
//
// The network is a graph. A node is a hub (a round chamber with radius r) or an anchor (r 0, a landmark's doorway).
// An edge is a tunnel from one node to the next through optional via points. Each hub leaves a mouth in its ring wall
// for every edge that meets it.

import { CITY, rng } from '../../../engine/core.js';
import { groundAt } from '../../../engine/relief.js';

const SEWER = { w: 4.2, h: 3.4, wall: 'brick', floor: 'flag', water: 2, torches: 0, rgb: [.36, .25, .2] };
const PASSAGE = { w: 3, h: 3.6, wall: 'ashlar', floor: 'flag', torches: 9 };
const RING = { w: 3.4, h: 4.2, wall: 'rubble', floor: 'flag', torches: 10 };
const ROAD = { w: 4.4, h: 5, wall: 'ashlar', floor: 'flag', torches: 12, rgb: [.36, .34, .32] };
const SMUGGLE = { w: 2.4, h: 3, wall: 'rock', floor: 'dirt', torches: 14, rough: .35 };

export default function build(D, Z) {
  const r = rng(1500), A = k => { const [z, a] = k.split('.'); return [...Z[z].anchors[a], 0]; };
  const nodes = {}, edges = [], rooms = [];

  // ---------- the river sewers ----------

  // Each bank's sewer runs along the Pegnitz 21 m from its middle, under the bank, and drops one metre a
  // furlong towards the outflow. Street grates above let in a cold steady light.

  const line = CITY.river?.line ?? [[1050, 90], [866, 101], [760, 118], [640, 105], [560, 90], [470, 78], [380, 82], [300, 80], [224, 72], [150, 64], [70, 60], [-18, 80], [-120, 100], [-221, 112], [-300, 118], [-400, 90], [-510, 40], [-600, 12], [-700, -5], [-900, -20]];
  const bank = side => {
    const out = [];
    for (let i = 0; i < line.length; i++) {
      const [x, z] = line[i];
      if (x > 610 || x < -540) continue;
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      const px = x - dz / l * 21 * side, pz = z + dx / l * 21 * side;
      out.push([px, Math.max(-5.5, Math.min(-.5, groundAt(px, pz) - 5) - (610 - x) / 600), pz]);
    }
    return out;
  };
  for (const side of [1, -1]) {
    const pts = bank(side), name = side > 0 ? 'kn' : 'ks';
    pts.forEach((p, i) => { nodes[`${name}${i}`] = [...p, 5.2]; });
    for (let i = 0; i < pts.length - 1; i++) edges.push([`${name}${i}`, `${name}${i + 1}`, [], SEWER]);
  }

  // Outfalls: short culverts from the sewer hubs to the river wall, each closed by a grate.

  for (const name of ['kn', 'ks']) for (let i = 1; ; i += 2) {
    const n = nodes[`${name}${i}`];
    if (!n) break;
    const k = line.reduce((best, p) => Math.hypot(p[0] - n[0], p[1] - n[2]) < Math.hypot(best[0] - n[0], best[1] - n[2]) ? p : best);
    const dx = k[0] - n[0], dz = k[1] - n[2], l = Math.hypot(dx, dz), ex = n[0] + dx / l * 12, ez = n[2] + dz / l * 12;
    nodes[`${name}o${i}`] = [ex, n[1] - .3, ez, 0];
    edges.push([`${name}${i}`, `${name}o${i}`, [], { ...SEWER, w: 2.4, h: 2.6, water: 1.6 }]);
    for (let g = -1; g <= 1; g += .5) D.box(ex + dz / l * g, n[1] - .3, ez - dx / l * g, .08, 2.6, .08, 'iron', { jit: 0 });
  }

  // ---------- the cellar passages ----------

  nodes.burg = A('burg.south');
  nodes.felsN = A('felsen.north');
  nodes.felsE = A('felsen.east');
  nodes.felsS = A('felsen.south');
  nodes.ossW = A('ossuary.west');
  nodes.ossE = A('ossuary.east');
  nodes.rathW = A('rathaus.west');
  nodes.rathS = A('rathaus.south');
  nodes.markt = [-5, 2, 18, 6];
  edges.push(
    ['burg', 'felsN', [[-60, 43, -385], [-110, 38, -372], [-165, 28, -352], [-200, 19, -340]], { ...PASSAGE, wall: 'rock', rough: .3, rgb: [.48, .3, .22] }],
    ['felsE', 'ossW', [[-138, 11, -252], [-150, 12, -205], [-158, 13, -170]], { ...PASSAGE, wall: 'rock', rough: .3, rgb: [.48, .3, .22] }],
    ['ossE', 'rathW', [[-14, 13, -152], [-14, 12, -134], [-74, 10, -130], [-74, 10, -95]], PASSAGE],
    ['rathS', 'markt', [[-10, 9, -52], [-6, 5, -20]], PASSAGE],
  );

  // The Hauptmarkt cellar drops to the north sewer and, by a spiral stair, to the dungeon ring.

  const kn = Object.keys(nodes).filter(k => /^kn\d+$/.test(k)).reduce((b, k) => Math.abs(nodes[k][0] + 5) < Math.abs(nodes[b][0] + 5) ? k : b);
  edges.push(['markt', kn, [], { ...PASSAGE, w: 2.6 }]);
  D.shaft(-5, 18, -18, 2, 3.2, { spiral: true, torches: 5 });
  D.label('Wendeltreppe', -5, -4, 18, 'district quarter under');

  // ---------- the dungeon ring at -18 ----------

  nodes.r0 = [-5, -18, 18, 6];
  nodes.r1 = [-200, -18, -165, 6];
  nodes.r2 = [-320, -18, -20, 5];
  nodes.nixN = A('nix.north');
  nodes.nixE = A('nix.east');
  nodes.r3 = [-238, -18, 160, 5];
  nodes.rumN = A('rumpel.north');
  nodes.rumE = A('rumpel.east');
  nodes.r4 = [-40, -18, 310, 6];
  nodes.r5 = [70, -18, 330, 6];
  nodes.r6 = [140, -18, -30, 5];
  nodes.r7 = [330, -18, -70, 5];
  nodes.moat = [492, -5, -82, 0];
  edges.push(
    ['r0', 'r1', [[-90, -18, -60]], RING],
    ['felsS', 'r1', [[-200, -16, -185]], { ...RING, wall: 'rock', rgb: [.48, .3, .22] }],
    ['r1', 'r2', [[-280, -18, -100]], RING],
    ['r2', 'nixN', [[-320, -14, 12]], RING],
    ['nixE', 'r3', [[-238, -14, 110]], RING],
    ['r3', 'rumN', [[-240, -18, 220]], RING],
    ['rumE', 'r4', [[-110, -18, 302]], RING],
    ['r4', 'r5', [], RING],
    ['r5', 'r0', [[40, -18, 180], [10, -18, 90]], RING],
    ['r0', 'r6', [[60, -18, -10]], RING],
    ['r6', 'r7', [[240, -18, -60]], RING],
    ['r7', 'moat', [[420, -14, -78], [470, -8, -80]], SMUGGLE],
  );
  D.label('Schmugglergang', 420, -8, -78);
  D.label('Ring of the Dungeons', -150, -12, -80);

  // From the ring a stair falls 30 m to the Walpurgissaal, and another 24 m to Alberich's Hort.

  nodes.wN = A('walpurgis.north');
  nodes.wTop = [110, -18, 330, 0];
  edges.push(['r5', 'wTop', [], RING]);
  stair(110, 330, -18, 110, 375, -48, 3.2);
  nodes.hS = A('hort.south');
  nodes.hTop = [-80, -18, -200, 0];
  edges.push(['r1', 'hTop', [[-120, -18, -190]], RING]);
  stair(-80, -200, -18, -80, -255, -42, 3);

  // ---------- the Totenweg on the deep level ----------

  nodes.hE = A('hort.east');
  nodes.wW = A('walpurgis.west');
  nodes.t0 = [60, -44, -150, 7];
  nodes.t1 = [70, -45, 60, 7];
  nodes.t2 = [30, -46, 250, 7];
  edges.push(
    ['hE', 't0', [[30, -42, -312]], ROAD],
    ['t0', 't1', [], ROAD],
    ['t1', 't2', [], ROAD],
    ['t2', 'wW', [[-12, -48, 400], [-12, -48, 450]], ROAD],
  );
  D.label('Totenweg', 66, -38, -40);
  D.label('Kloake', -120, 4, 70);

  // ---------- the town above, traced as faint lines a metre under the ground ----------

  const trace = (pts, rgb, closed) => {
    for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length], l = Math.hypot(bx - ax, bz - az);
      for (let u = 0; u < l; u += 6) {
        const x = ax + (bx - ax) * (u + 2) / l, z = az + (bz - az) * (u + 2) / l;
        D.glow(x, groundAt(x, z) - 1.2, z, Math.min(4, l - u), .05, .5, rgb, { rot: Math.atan2(-(bz - az), bx - ax), faces: 'b' });
      }
    }
  };
  trace(CITY.wall ?? [], [.25, .2, .14], true);
  for (const k of ['main', 'major']) for (const s of CITY.streets?.[k] ?? []) trace(s.filter((_, i) => i % 3 === 0), [.1, .1, .1]);
  for (const side of [1, -1]) trace(line.map(([x, z], i) => { const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return [x - dz / l * 13 * side, z + dx / l * 13 * side]; }), [.08, .16, .22]);

  // ---------- draw: hubs with their mouths, then the tunnels ----------

  const mouths = {};
  const pos = k => nodes[k];
  for (const [a, b, via, o] of edges) {
    const pa = pos(a), pb = pos(b), first = via[0] ?? pb, last = via.at(-1) ?? pa;
    const da = Math.atan2(first[2] - pa[2], first[0] - pa[0]), db = Math.atan2(last[2] - pb[2], last[0] - pb[0]);
    const s = [pa[0] + Math.cos(da) * pa[3], pa[1], pa[2] + Math.sin(da) * pa[3]];
    const e = [pb[0] + Math.cos(db) * pb[3], pb[1], pb[2] + Math.sin(db) * pb[3]];
    (mouths[a] ??= []).push([da, o.w]);
    (mouths[b] ??= []).push([db, o.w]);
    D.tunnel([s, ...via, e].flatMap((p, i, all) => i ? subdivide(all[i - 1], p, 12) : [p]), o);
  }
  for (const [k, n] of Object.entries(nodes)) if (n[3] > 0) hub(n, mouths[k] ?? []);

  // ---------- side rooms ----------

  const busy = Object.values(Z).map(z => [z.x0 - 8, z.x1 + 8, z.z0 - 8, z.z1 + 8]);
  const kinds = [cells, crypt, store, guard, cave];
  let made = 0;
  for (const [a, b, via, o] of edges) {
    if (o === SEWER || o.w < 2.6) continue;
    const pts = [pos(a), ...via, pos(b)];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], dx = q[0] - p[0], dz = q[2] - p[2], l = Math.hypot(dx, dz);
      if (l < 50 || Math.abs(q[1] - p[1]) > 2) continue;
      for (let u = 28; u < l - 28; u += 55) {
        const side = r() < .5 ? 1 : -1, nx = -dz / l * side, nz = dx / l * side, w = 14 + r() * 10, d = 10 + r() * 8;
        const cx = p[0] + dx / l * u + nx * (o.w / 2 + 3 + d / 2), cz = p[2] + dz / l * u + nz * (o.w / 2 + 3 + d / 2), y = p[1] + (q[1] - p[1]) * u / l;
        const box = [cx - w / 2, cx + w / 2, cz - w / 2, cz + w / 2];
        if ([...busy, ...rooms].some(bb => box[0] < bb[1] && box[1] > bb[0] && box[2] < bb[3] && box[3] > bb[2])) continue;
        if (Object.values(nodes).some(n => n[3] && Math.hypot(n[0] - cx, n[2] - cz) < w)) continue;
        rooms.push(box);
        const rot = Math.atan2(-nz, nx), kind = kinds[made++ % kinds.length];
        D.tunnel([[p[0] + dx / l * u + nx * o.w / 2, y, p[2] + dz / l * u + nz * o.w / 2], [cx - nx * d / 2, y, cz - nz * d / 2]], { ...PASSAGE, w: 2.2, torches: 0 });
        D.frame(cx, cz, rot, () => kind(y, d, w));
      }
    }
  }

  // ---------- helpers ----------

  function subdivide(a, b, step) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / step)), out = [];
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, a[2] + (b[2] - a[2]) * k / n]);
    return out;
  }

  // A round chamber whose ring wall breaks for each tunnel mouth. Sewer hubs get a drain, others a pillar.

  function hub([x, y, z, R], ms) {
    const sewer = ms.some(m => m[1] === SEWER.w), wm = sewer ? 'brick' : 'ashlar', h = sewer ? 3.6 : 4.4;
    D.floorPoly(Array.from({ length: 16 }, (_, k) => [x + Math.cos(k * Math.PI / 8) * (R + .8), z + Math.sin(k * Math.PI / 8) * (R + .8)]), y, 'flag');
    const gaps = ms.map(([a, w]) => [a, Math.asin(Math.min(.95, (w / 2 + .2) / R))]).sort((p, q) => p[0] - q[0]);
    const wrap = a => (a + Math.PI * 4) % (Math.PI * 2);
    for (let i = 0; i < gaps.length; i++) {
      const [a0, h0] = gaps[i], [a1, h1] = gaps[(i + 1) % gaps.length];
      const from = a0 + h0, span = wrap(a1 - h1 - from) || (gaps.length === 1 ? Math.PI * 2 - 2 * h0 : 0);
      if (span < .05) continue;
      const n = Math.max(2, Math.ceil(span * R / 1.5)), arc = [];
      for (let k = n; k >= 0; k--) { const a = from + span * k / n; arc.push([x + Math.cos(a) * R, z + Math.sin(a) * R]); }
      D.wall(arc, y, h, wm, { thick: .8, rgb: sewer ? SEWER.rgb : undefined });
      const am = from + span / 2;
      if (span * R > 3) D.torch(x + Math.cos(am) * (R - .15), y + 2.3, z + Math.sin(am) * (R - .15), -Math.cos(am), -Math.sin(am));
    }
    if (!gaps.length) D.wall(Array.from({ length: 17 }, (_, k) => [x + Math.cos(-k * Math.PI / 8) * R, z + Math.sin(-k * Math.PI / 8) * R]), y, h, wm);
    if (sewer) {
      D.cyl(x, y, z, 1.2, .25, 'iron', { seg: 10 });
      D.light(x, y + 3.4, z, [.25, .35, .5], 9, { flicker: 0 });
    } else D.cyl(x, y, z, .7, h + 1, 'ashlar', { seg: 10 });
  }

  // A stair between two points, with side walls and a torch at each end.

  function stair(x0, z0, y0, x1, z1, y1, w) {
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), rot = Math.atan2(-dz, dx);
    D.frame(x0, z0, rot, () => {
      const run = D.stairs(0, 0, y0, y1, w, { rise: Math.abs(y1 - y0) / Math.ceil(Math.abs(y1 - y0) / .22), tread: l / Math.ceil(Math.abs(y1 - y0) / .22) });
      D.torch(2, y0 + 2.3, w / 2 - .1, 0, -1);
      D.torch(run - 2, y1 + 2.3, -w / 2 + .1, 0, 1);
    });
  }

  // ---------- side room kinds, built in a frame whose -x side faces the tunnel ----------

  function room(y, d, w, o) {
    D.room(0, 0, y, d, w, o.h ?? 4, { doors: [{ side: 'w', at: 0, w: 2.2 }], wall: o.wall ?? 'ashlar', floor: o.floor ?? 'flag', torches: o.torches ?? 7, rgb: o.rgb });
  }
  function cells(y, d, w) {
    room(y, d, w, { wall: 'rubble' });
    const n = Math.max(2, Math.floor(w / 3.2)), cw = w / n;
    for (let k = 0; k < n; k++) {
      const z = -w / 2 + cw * (k + .5);
      if (k) D.box(d / 4, y, -w / 2 + cw * k, d / 2, 3.2, .4, 'rubble');
      for (let b = -cw / 2 + .3; b < cw / 2 - .2; b += .32) D.box(0, y, z + b, .07, 2.6, .07, 'iron', { jit: 0 });
      D.box(d / 2 - .5, y, z, .8, .45, cw * .6, 'wood');
      if (r() < .4) D.box(d / 2 - .9, y, z + cw * .3, .5, .02, .5, 'dirt', { rgb: [.5, .45, .2] });
    }
  }
  function crypt(y, d, w) {
    room(y, d, w, { wall: 'ashlar', torches: 0, rgb: [.42, .4, .38] });
    for (let i = -1; i <= 1; i += 2) for (let k = -w / 2 + 3; k < w / 2 - 2; k += 3.4) {
      D.box(i * d / 4, y, k, 2.2, .9, 1.1, 'ashlar', { rgb: [.5, .48, .44] });
      D.box(i * d / 4, y + .9, k, 2.3, .15, 1.2, 'ashlar', { rgb: [.55, .52, .47] });
      D.candle(i * d / 4 + 1.3, y, k + .5);
    }
    for (let k = -w / 2 + 2; k < w / 2; k += 4) D.arch(0, y + 3, k, d, 1.2, { depth: .4 });
  }
  function store(y, d, w) {
    room(y, d, w, { wall: 'brick', floor: 'wood' });
    for (let k = 0; k < 14; k++) {
      const s = .7 + r() * .6, x = (r() - .5) * (d - 2), z = (r() - .5) * (w - 2);
      if (r() < .5) D.box(x, y, z, s, s, s, 'wood', { rot: r() });
      else D.cyl(x, y, z, s * .5, s * 1.3, 'wood', { seg: 10, r1: s * .45 });
    }
  }
  function guard(y, d, w) {
    room(y, d, w, { wall: 'ashlar', torches: 9 });
    D.box(0, y, 0, 1.2, .85, 4, 'wood');
    for (const s of [-1, 1]) D.box(s * 1.1, y, 0, .4, .45, 4, 'wood');
    D.brazier(d / 2 - 1.5, y, w / 2 - 1.5);
    for (let k = -w / 2 + 1.5; k < w / 2 - 1; k += .6) D.box(d / 2 - .3, y + .5, k, .1, 2.2, .05, 'iron', { jit: 0 });
  }
  function cave(y, d, w) {
    const pts = Array.from({ length: 12 }, (_, k) => { const a = k / 12 * Math.PI * 2, rr = .5 + r() * .25; return [Math.cos(a) * d * rr, Math.sin(a) * w * rr]; });
    pts[6] = [-d / 2 - 1, 0];
    D.cavern(pts, y, 5, { wall: 'rock' });
    D.water(r() * 2, y + .1, r() * 2, d * .3, w * .3);
    D.brazier(d / 4, y, -w / 4);
  }
}
