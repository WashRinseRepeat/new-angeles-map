// The open sea off New Angeles. Fish pens with feed barges and kelp lines sit inshore. Freighters, helium-3
// tankers and drone barges run the coast lanes far out, ferries run the near lanes, and trawlers, yachts and
// Coast Guard cutters work the water between. Every ship type is one instanced hull and one instanced light set.

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const WARM = [1.4, .9, .45], WHITE = [1.6, 1.6, 1.5], RED = [1.8, .12, .08], GREEN = [.15, 1.6, .3], CYAN = [.3, 1.3, 1.6];
const SODIUM = [1.6, .8, .3], BLUE = [.25, .5, 1.8];
const BOX = [[.62, .16, .1], [.12, .26, .46], [.62, .48, .1], [.15, .36, .2], [.42, .42, .4], [.55, .27, .08], [.32, .12, .3]];

export function sea(H, land, SEA) {
  const { THREE } = H;
  const r = H.rng(H.hash(9157, 2203));
  const coast = H.CITY.coast?.[0] ?? [];
  const wet = (x, z, d = 0) => land.real(x, z) < -d && land.cityDist(x, z) > 0;

  // Places the sea keeps clear: the cruise ship's bay, Puerto Maritimo and the prison, Undertow, White Beach's
  // filter ring, and the Pisces ranch with Mama Qucha.

  const CLEAR = [[-1044, -630, 520], [-2050, 250, 520], [-1300, 1836, 350], [-1050, 2390, 420], [-850, 3650, 900]];
  const clear = (x, z, m = 0) => CLEAR.every(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) > cr + m);

  // Every ship's patch, farm and anchorage claims a disc of water. Nothing new may touch a claimed disc. Anchored
  // ships and farms keep their whole disc off the lanes, and circling boats keep their centre 150 m off.

  const taken = [], lanes = [];
  const laneGap = (x, z) => Math.min(Infinity, ...lanes.map(l => Math.abs((x - l.cx) * l.sx + (z - l.cz) * l.sz)));
  const room = (x, z, rad, lane = rad) => clear(x, z, rad) && laneGap(x, z) > lane + 150 && taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) > rad + tr)
    && [[0, 0], [rad, 0], [-rad, 0], [0, rad], [0, -rad]].every(([a, b]) => wet(x + a, z + b, 5));
  const claim = (x, z, rad) => { taken.push([x, z, rad]); return [x, z]; };

  // Spots off the coast are drawn by length along the shore, so densely traced stretches get no extra traffic.

  const runs = [0];
  for (let i = 1; i < coast.length; i++) runs.push(runs[i - 1] + Math.hypot(coast[i][0] - coast[i - 1][0], coast[i][1] - coast[i - 1][1]));
  const shoreAt = u => {
    const L = u * runs.at(-1);
    let i = 1;
    while (i < runs.length - 1 && runs[i] < L) i++;
    const t = (L - runs[i - 1]) / (runs[i] - runs[i - 1] || 1);
    return [coast[i - 1][0] + (coast[i][0] - coast[i - 1][0]) * t, coast[i - 1][1] + (coast[i][1] - coast[i - 1][1]) * t];
  };

  // ---------- parts: [shape, sx, sy, sz, x, y, z, rgb, lit], z toward the bow, y up from the waterline ----------

  const GEO = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(.5, .5, 1, 12), ball: new THREE.SphereGeometry(.5, 12, 8) };
  const part = ([shape, sx, sy, sz, x, y, z, rgb]) => {
    const g = GEO[shape].clone().scale(sx, sy, sz).translate(x, y, z).toNonIndexed();
    g.deleteAttribute('uv');
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(rgb).flat(), 3));
    return g;
  };
  const SOLID = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75, metalness: .2 });
  const LIT = new THREE.MeshBasicMaterial({ vertexColors: true });
  const fleet = (parts, n) => {
    const own = (list, mat) => {
      const m = new THREE.InstancedMesh(mergeGeometries(list.map(part)), mat, n);
      m.frustumCulled = false; m.count = 0; m.userData.noTile = true;
      return m;
    };
    return [own(parts.filter(p => !p[8]), SOLID), own(parts.filter(p => p[8]), LIT)];
  };

  // A row of lit windows along one side: n lights of size s, every gap metres from z0.

  const windows = (n, x, y, z0, gap, rgb, s = [.2, .9, 1.6]) => Array.from({ length: n }, (_, k) => ['box', s[0], s[1], s[2], x, y, z0 + k * gap, rgb, 1]);
  const nav = (beam, len, mast) => [['box', .6, .6, .6, -beam / 2 - .2, 2, len * .1, RED, 1], ['box', .6, .6, .6, beam / 2 + .2, 2, len * .1, GREEN, 1],
    ['box', .7, .7, .7, 0, mast, len * .3, WHITE, 1], ['box', .6, .6, .6, 0, 4, -len / 2, WHITE, 1]];

  // Freighter: a long dark hull, container bays in many colours, a bridge house aft with a lit band and a funnel.

  const freighter = k => {
    const rr = H.rng(4400 + k), L = 210, B = 30, P = [['box', B, 10, L, 0, 0, 0, [.08, .085, .1]], ['box', B * .7, 9, 22, 0, -.5, L / 2 + 8, [.08, .085, .1]],
      ['box', B + .4, .8, L + .4, 0, -1.6, 0, [.4, .07, .05]]];
    for (let z = -L / 2 + 52; z < L / 2 - 8; z += 13) {
      if (rr() < .12) continue;
      const h = 4 + Math.floor(rr() * 4) * 2.6;
      P.push(['box', B - 2, h, 12, 0, 5 + h / 2, z, BOX[Math.floor(rr() * BOX.length)]]);
    }
    P.push(['box', B, 20, 12, 0, 15, -L / 2 + 22, [.7, .7, .68]], ['box', B + 6, 2, 6, 0, 25, -L / 2 + 24, [.6, .6, .58]],
      ['box', 5, 12, 6, 0, 31, -L / 2 + 12, [.12, .12, .13]], ['box', B - 1, 1, 1.4, 0, 22, -L / 2 + 28.1, [.9, 1.1, 1.2], 1],
      ...windows(4, B / 2 + .1, 12, -L / 2 + 17, 3, WARM), ...windows(4, -B / 2 - .1, 12, -L / 2 + 17, 3, WARM),
      ...[-60, -10, 40].map(z => ['box', .6, .6, .6, 0, 20, z, SODIUM, 1]), ...nav(B, L, 36));
    return P;
  };

  // Helium-3 carrier: white domed tanks on a long hull, a blue waterline band, the NBN-blue bridge lights aft.

  const tanker = () => {
    const L = 230, B = 34, P = [['box', B, 10, L, 0, 0, 0, [.1, .11, .12]], ['box', B * .7, 9, 22, 0, -.5, L / 2 + 8, [.1, .11, .12]],
      ['box', B + .4, .7, L + .4, 0, -1.4, 0, [.1, .3, .6], 1]];
    for (const z of [-50, -10, 30, 70]) P.push(['ball', 28, 22, 34, 0, 9, z, [.55, .56, .58]], ['box', .5, .5, .5, 0, 20.5, z, WHITE, 1]);
    P.push(['box', B, 16, 14, 0, 13, -L / 2 + 22, [.6, .62, .64]], ['box', B - 1, 1, 1.2, 0, 18, -L / 2 + 29.1, BLUE, 1],
      ...windows(4, B / 2 + .1, 11, -L / 2 + 17, 3, WARM), ...windows(4, -B / 2 - .1, 11, -L / 2 + 17, 3, WARM), ...nav(B, L, 30));
    return P;
  };

  // Drone barge: an unmanned low hull under one container block, no bridge, only its running lights.

  const drone = () => {
    const L = 120, B = 22;
    return [['box', B, 6, L, 0, 0, 0, [.06, .065, .07]], ['box', B - 2, 7, L - 30, 0, 6.5, -5, [.2, .2, .22]],
      ['box', 1, .4, L - 32, B / 2 - 1, 10.2, -5, [1.4, .3, .1], 1], ...nav(B, L, 12)];
  };

  // Trawler: a short hull, the house forward, a gantry aft and flood lights over the deck.

  const trawler = () => {
    const L = 36, B = 9;
    return [['box', B, 4, L, 0, 0, 0, [.2, .08, .06]], ['box', B - 2, 5, 9, 0, 4.5, 8, [.75, .72, .66]], ['box', .5, 9, .5, 0, 9, 10, [.2, .2, .2]],
      ['box', B, .6, .6, 0, 9, -14, [.3, .3, .3]], ['box', .5, 8, .5, -B / 2 + .5, 5, -14, [.3, .3, .3]], ['box', .5, 8, .5, B / 2 - .5, 5, -14, [.3, .3, .3]],
      ['box', 1.4, .5, 1, -2, 8.6, -13.5, [1.8, 1.7, 1.4], 1], ['box', 1.4, .5, 1, 2, 8.6, -13.5, [1.8, 1.7, 1.4], 1],
      ...windows(3, B / 2 - .9, 5, 5.5, 2.4, WARM, [.2, .8, 1.4]), ...windows(3, -B / 2 + .9, 5, 5.5, 2.4, WARM, [.2, .8, 1.4]), ...nav(B, L, 13.5)];
  };

  // Yacht: a sleek white hull, three stepped decks with warm glass bands and a cyan glow at the waterline.

  const yacht = () => {
    const L = 52, B = 10, W = [.72, .72, .7];
    return [['box', B, 4, L, 0, 0, 0, W], ['box', B * .6, 3.6, 12, 0, -.2, L / 2 + 4, W], ['box', B - 1, 3, 30, 0, 3.5, -2, W],
      ['box', B - 2.5, 2.6, 20, 0, 6.3, -4, W], ['box', B - 4, 2, 10, 0, 8.6, -5, [.15, .16, .18]],
      ['box', B - .8, .9, 26, 0, 3.6, -2, [.75, .5, .28], 1], ['box', B - 2.3, .8, 17, 0, 6.3, -4, [.75, .5, .28], 1],
      ['box', B + .3, .3, L - 6, 0, -1.4, -2, CYAN, 1], ...nav(B, L, 11)];
  };

  // Hydrofoil ferry: a white cabin of windows on a narrow hull, run fast along the near lanes.

  const ferry = () => {
    const L = 34, B = 9, W = [.7, .7, .68];
    return [['box', B, 3, L, 0, 0, 0, W], ['box', B - 1, 3, 22, 0, 3, -2, W], ['box', B - 3, 1.8, 6, 0, 5.4, 4, [.15, .16, .18]],
      ...windows(7, B / 2 - .4, 3.2, -11, 3, WARM, [.2, 1.2, 2]), ...windows(7, -B / 2 + .4, 3.2, -11, 3, WARM, [.2, 1.2, 2]), ...nav(B, L, 8)];
  };

  // Coast Guard cutter: a grey hull with a white house and a blue and red light bar.

  const cutter = () => {
    const L = 60, B = 12;
    return [['box', B, 5, L, 0, 0, 0, [.38, .4, .42]], ['box', B - 2, 6, 16, 0, 5, 4, [.75, .76, .78]], ['box', .5, 8, .5, 0, 12, 4, [.3, .3, .3]],
      ['box', B - 2, .5, 1, 0, 8.3, 10.6, [.4, .4, .4]], ['box', 1.4, .6, .8, -1.4, 8.8, 10.6, BLUE, 1], ['box', 1.4, .6, .8, 1.4, 8.8, 10.6, RED, 1],
      ['box', B - 2.6, .9, .2, 0, 6, 12.1, [.9, 1.1, 1.2], 1], ['box', B + .2, .5, 1.2, 0, 1.5, 20, [.9, .3, .1]], ...nav(B, L, 16)];
  };

  // Squid jigger: a dark hull under two lines of bright green lamps that draw the squid up at night.

  const jigger = () => {
    const L = 46, B = 9, P = [['box', B, 4, L, 0, 0, 0, [.12, .13, .14]], ['box', B - 2, 5, 9, 0, 4.5, -14, [.6, .6, .58]],
      ['box', .3, 7, .3, 0, 5.5, 14, [.2, .2, .2]], ['box', .3, 7, .3, 0, 5.5, -6, [.2, .2, .2]], ['box', .15, .15, 20, 0, 8.8, 4, [.2, .2, .2]],
      ...windows(3, B / 2 - .9, 5, -16, 2.4, WARM, [.2, .8, 1.4]), ...nav(B, L, 10)];
    for (let k = 0; k < 10; k++) for (const sd of [-1.4, 1.4]) P.push(['box', .9, .7, .9, sd, 8, -6 + k * 2.2, [1, 1.9, 1.1], 1]);
    return P;
  };

  // Seabed-mining rig: a deck on four legs, a derrick, a crane, a helipad, a lit quarters block and a gas flare.

  const rig = () => {
    const D = 70, Y = 28, ST = [.3, .3, .32], P = [];
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.push(['cyl', 9, Y + 8, 9, a * 26, Y / 2 - 4, b * 26, [.35, .33, .3]], ['box', 1, 1, 1, a * 26, 1.5, b * 26, [1.8, .9, .1], 1]);
    P.push(['box', D, 5, D, 0, Y, 0, [.22, .22, .24]]);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) P.push(['box', a ? .4 : D, .4, b ? .4 : D, a * (D / 2 + .2), Y + 2.4, b * (D / 2 + .2), [1.2, .8, .3], 1]);
    for (let k = 0; k < 6; k++) { const h = 8 + k * 9, w = 14 - k * 2; for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) P.push(['box', a ? .6 : w, .6, b ? .6 : w, a * w / 2 + 10, Y + h, b * w / 2 - 10, ST]); }
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.push(['box', .8, 54, .8, 10 + a * 6, Y + 29, -10 + b * 6, ST]);
    P.push(['box', 1.2, 1.2, 1.2, 10, Y + 57, -10, RED, 1], ['box', 22, 16, 18, -18, Y + 10, 18, [.6, .58, .52]],
      ...windows(5, -6.9, Y + 6, 12, 3, WARM, [.2, 1, 1.8]), ...windows(5, -6.9, Y + 11, 12, 3, WARM, [.2, 1, 1.8]),
      ['cyl', 20, 1, 20, -18, Y + 18.5, 18, [.3, .32, .3]], ['box', 14, .2, 1, -18, Y + 19.1, 18, [1.4, 1.3, .4], 1],
      ['box', 2, 2, 40, 22, Y + 14, 20, [.75, .5, .1]], ['box', 1.6, 18, 1.6, 22, Y + 10, 6, [.75, .5, .1]],
      ['box', 1.2, 1.2, 38, 0, Y + 8, -D / 2 - 18, ST], ['ball', 5, 8, 5, 0, Y + 11, -D / 2 - 37, [2.4, 1, .2], 1], ['ball', 2.6, 5, 2.6, 0, Y + 11, -D / 2 - 37, [2.6, 2.2, 1.2], 1]);
    for (let k = 0; k < 8; k++) P.push(['box', .8, .6, .8, -30 + (k % 4) * 20, Y + 4, k < 4 ? -33 : 33, [1.7, 1.6, 1.4], 1]);
    return P;
  };

  // ---------- routes ----------

  // The coast lanes run along the coast's long axis, out on the sea side. A lane keeps only stretches that stay in
  // open water, and each ship loops round its stretch, fading out at its ends.

  const [ax, az] = coast[0] ?? [0, 0], [bx, bz] = coast.at(-1) ?? [0, 1];
  const AL = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / AL, uz = (bz - az) / AL, mx = (ax + bx) / 2, mz = (az + bz) / 2;
  const side = land.real(mx + uz * 3000, mz - ux * 3000) < 0 ? 1 : -1, sx = uz * side, sz = -ux * side;
  const reach = c => Math.max(...coast.map(([x, z]) => (x - ax) * sx + (z - az) * sz)) + c;
  const lane = (off, half) => {
    const o = reach(off) - ((mx - ax) * sx + (mz - az) * sz), cx = mx + sx * o, cz = mz + sz * o;
    let lo = 0, hi = 0;
    while (lo > -half && wet(cx + ux * (lo - 60), cz + uz * (lo - 60), 5)) lo -= 60;
    while (hi < half && wet(cx + ux * (hi + 60), cz + uz * (hi + 60), 5)) hi += 60;
    const ln = { cx, cz, lo, hi, sx, sz };
    lanes.push(ln);
    return ln;
  };

  const ships = [];
  const sail = (kind, L, off, half, speed, dir) => {
    const ln = lane(off, half);
    if (ln.hi - ln.lo < 2000) return;
    ships.push({ kind, ln, speed, dir, ph: r() * (ln.hi - ln.lo), L, sway: (r() - .5) * 120 });
  };
  for (let k = 0; k < 4; k++) sail('freighter' + (k % 3), 210, 1500 + k * 600, 9000, 6 + r() * 3, k % 2 ? 1 : -1);
  for (let k = 0; k < 2; k++) sail('tanker', 230, 2100 + k * 1200, 9000, 5 + r() * 2, k % 2 ? -1 : 1);
  for (let k = 0; k < 3; k++) sail('drone', 120, 1800 + k * 1200, 9000, 8 + r() * 3, k % 2 ? 1 : -1);
  for (let k = 0; k < 2; k++) sail('ferry', 34, 500 + k * 250, 5000, 16 + r() * 4, k % 2 ? 1 : -1);

  // Trawlers, cruising yachts and cutters circle slowly over their own patch of water.

  const pick = (lo, hi, rad, lane = rad) => {
    for (let t = 0; t < 400; t++) {
      const [px, pz] = shoreAt(r()), d = lo + r() * (hi - lo), x = px + sx * d, z = pz + sz * d;
      if (room(x, z, rad, lane)) return claim(x, z, rad);
    }
    return null;
  };
  const circle = (kind, L, lo, hi, rad, speed) => {
    const p = pick(lo, hi, rad + L, 0);
    if (p) ships.push({ kind, c: p, rad, speed: speed / rad * (r() < .5 ? 1 : -1), ph: r() * 6.3, L });
  };
  for (let k = 0; k < 6; k++) circle('trawler', 36, 500, 2600, 120 + r() * 200, 2 + r() * 2);
  for (let k = 0; k < 4; k++) circle('yacht', 52, 300, 1400, 150 + r() * 150, 3 + r() * 2);
  for (let k = 0; k < 3; k++) circle('cutter', 60, 600, 2000, 200 + r() * 150, 7 + r() * 2);

  // Anchored yachts ride in short rows off the beaches, 70 m apart, all swung the same way.

  const moored = [];
  for (let k = 0; k < 4; k++) {
    const n = 1 + Math.floor(r() * 3), p = pick(250, 800, 40 + n * 35);
    if (!p) continue;
    const a = Math.atan2(ux, uz) + (r() - .5) * .3;
    for (let j = 0; j < n; j++) { const o = (j - (n - 1) / 2) * 70; moored.push({ kind: 'yacht', x: p[0] + ux * o, z: p[1] + uz * o, a }); }
  }

  // Ships at anchor stand off from a centre point, each on its own disc. Freighters wait off Manta for a berth.

  const anchor = (kinds, cx, cz, spread, n, rad, a0) => {
    for (let k = 0, t = 0; k < n && t < 200; t++) {
      const x = cx + (r() - .5) * spread, z = cz + (r() - .5) * spread;
      if (!room(x, z, rad)) continue;
      claim(x, z, rad);
      moored.push({ kind: kinds[k % kinds.length], x, z, a: a0 + (r() - .5) * .5 });
      k++;
    }
  };
  const along = Math.atan2(ux, uz);
  anchor(['freighter0', 'freighter1', 'freighter2'], ...H.mapToWorld([250, 1080]), 1400, 3, 170, along);

  // The south: an anchorage off the Guayaquil gulf, a squid fleet under green lamps, and a Weyland seabed-mining rig.

  anchor(['freighter1', 'tanker', 'freighter2', 'freighter0'], 600, 5700, 1600, 5, 170, along + .3);
  anchor(['jigger'], -1100, 5300, 1100, 7, 60, along);
  anchor(['rig'], -1700, 4700, 600, 1, 140, .4);

  const KINDS = { freighter0: freighter(0), freighter1: freighter(1), freighter2: freighter(2), tanker: tanker(), drone: drone(), trawler: trawler(),
    yacht: yacht(), ferry: ferry(), cutter: cutter(), jigger: jigger(), rig: rig() };
  const count = {};
  for (const s of [...ships, ...moored]) count[s.kind] = (count[s.kind] ?? 0) + 1;
  const MESH = Object.fromEntries(Object.entries(count).map(([k, n]) => [k, fleet(KINDS[k], n)]));

  // Wakes: a pale fan behind each moving ship, narrow and bright at the stern, its length set by speed.

  const fan = H.canvasTexture(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(1, 'rgba(255,255,255,.9)'); gr.addColorStop(.7, 'rgba(255,255,255,.35)'); gr.addColorStop(0, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(w * .4, h); g.lineTo(w * .6, h); g.lineTo(w, 0); g.lineTo(0, 0); g.closePath(); g.fill();
  });
  const wakes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, -.5),
    new THREE.MeshBasicMaterial({ map: fan, color: new THREE.Color(.07, .085, .095), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), ships.length);
  wakes.frustumCulled = false; wakes.renderOrder = 2;

  // The squid lamps and the rig throw a pale pool of light on the water round them.

  const glowOn = moored.filter(s => s.kind === 'jigger' || s.kind === 'rig');
  const pools = new THREE.InstancedMesh(new THREE.CircleGeometry(.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
    map: H.canvasTexture(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }),
    vertexColors: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), Math.max(1, glowOn.length));
  pools.frustumCulled = false; pools.renderOrder = 2; pools.count = glowOn.length;
  glowOn.forEach((s, i) => {
    const big = s.kind === 'rig', m = new THREE.Matrix4().compose(new THREE.Vector3(s.x, SEA + .2, s.z), new THREE.Quaternion(), new THREE.Vector3().setScalar(big ? 260 : 110));
    pools.setMatrixAt(i, m); pools.setColorAt(i, new THREE.Color(...(big ? [.07, .045, .02] : [.05, .14, .07])));
  });

  const o = new THREE.Object3D(), used = {};
  const place = (kind, x, z, a, s = 1) => {
    const i = used[kind]++;
    o.position.set(x, SEA, z); o.rotation.set(0, a, 0); o.scale.setScalar(s); o.updateMatrix();
    for (const m of MESH[kind]) { m.setMatrixAt(i, o.matrix); m.count = Math.max(m.count, i + 1); }
  };
  const update = t => {
    for (const k in used) used[k] = 0;
    for (const k in count) used[k] = 0;
    let w = 0;
    for (const s of ships) {
      let x, z, a, f = 1, v;
      if (s.ln) {
        const span = s.ln.hi - s.ln.lo, u = (s.ph + t * s.speed) % span, p = s.dir > 0 ? s.ln.lo + u : s.ln.hi - u;
        x = s.ln.cx + ux * p + sx * s.sway; z = s.ln.cz + uz * p + sz * s.sway;
        a = Math.atan2(ux * s.dir, uz * s.dir); f = Math.min(1, u / 300, (span - u) / 300); v = s.speed;
      } else {
        const q = s.ph + t * s.speed;
        x = s.c[0] + Math.cos(q) * s.rad; z = s.c[1] + Math.sin(q) * s.rad;
        a = Math.atan2(-Math.sin(q) * Math.sign(s.speed), Math.cos(q) * Math.sign(s.speed)); v = Math.abs(s.speed * s.rad);
      }
      place(s.kind, x, z, a, f);
      o.position.set(x - Math.sin(a) * s.L * .45 * f, SEA + .15, z - Math.cos(a) * s.L * .45 * f);
      o.scale.set(s.L * .3 * f, 1, (s.L * .5 + v * 15) * f); o.updateMatrix();
      wakes.setMatrixAt(w++, o.matrix);
    }
    for (const s of moored) place(s.kind, s.x, s.z, s.a);
    for (const pair of Object.values(MESH)) for (const m of pair) m.instanceMatrix.needsUpdate = true;
    wakes.count = w; wakes.instanceMatrix.needsUpdate = true;
  };
  update(0);

  return { meshes: [...Object.values(MESH).flat(), wakes, pools, ...farms(H, wet, room, claim, shoreAt, sx, sz, ux, uz, r, SEA, part, mergeGeometries)], update };
}

// Fish pens: clusters of round net pens on floating rings, each with a feed barge. Kelp lines: rows of amber floats.

function farms(H, wet, room, claim, shoreAt, sx, sz, ux, uz, r, SEA, part, mergeGeometries) {
  const { THREE } = H;
  const rings = [], nets = [], feeders = [], barges = [], floats = [];
  const site = (lo, hi, rad) => {
    for (let t = 0; t < 300; t++) {
      const [px, pz] = shoreAt(r()), d = lo + r() * (hi - lo), x = px + sx * d, z = pz + sz * d;
      if (room(x, z, rad)) return claim(x, z, rad);
    }
    return null;
  };

  for (let k = 0; k < 6; k++) {
    const R = 12 + r() * 8, nu = 2 + Math.floor(r() * 2), nv = 2 + Math.floor(r() * 3), p = site(300, 1600, Math.hypot(nu, nv) * R * 1.3 + 40);
    if (!p) continue;
    const [x0, z0] = p, a = Math.atan2(ux, uz) + (r() - .5) * .4, c = Math.cos(a), s = Math.sin(a);
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const u = (i - (nu - 1) / 2) * R * 2.6, v = (j - (nv - 1) / 2) * R * 2.6, x = x0 + u * c + v * s, z = z0 - u * s + v * c;
      rings.push([x, z, R]); nets.push([x, z, R * .92]);
      if (r() < .7) feeders.push([x, z]);
    }
    barges.push([x0 + c * (nu * R * 1.3 + 22), z0 - s * (nu * R * 1.3 + 22), a]);
  }

  // Kelp lines run parallel, a float every 4 m.

  for (let k = 0; k < 4; k++) {
    const p = site(250, 1200, 110);
    if (!p) continue;
    const a = Math.atan2(ux, uz) + (r() < .5 ? 0 : Math.PI / 2), c = Math.cos(a), s = Math.sin(a), rows = 8 + Math.floor(r() * 8);
    for (let i = 0; i < rows; i++) for (let j = -15; j <= 15; j++) {
      const u = (i - rows / 2) * 9, v = j * 4, x = p[0] + u * c + v * s, z = p[1] - u * s + v * c;
      if (wet(x, z, 5)) floats.push([x, z]);
    }
  }

  const o = new THREE.Object3D(), out = [];
  const inst = (geo, mat, list, set) => {
    if (!list.length) return;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((q, i) => { set(q); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.computeBoundingSphere(); m.userData.noTile = true;
    out.push(m);
  };
  const ring = new THREE.TorusGeometry(1, .03, 4, 40).rotateX(Math.PI / 2);
  inst(ring, new THREE.MeshStandardMaterial({ color: new THREE.Color(.16, .16, .17), roughness: .8 }), rings, ([x, z, R]) => { o.position.set(x, SEA + .5, z); o.scale.set(R, R * 1.5, R); });
  inst(ring, new THREE.MeshBasicMaterial({ color: new THREE.Color(.06, .3, .3) }), nets, ([x, z, R]) => { o.position.set(x, SEA + .2, z); o.scale.set(R, R * .6, R); });
  inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, .95, .5) }), feeders, ([x, z]) => { o.position.set(x, SEA + 2.4, z); o.scale.set(.6, .6, .6); });
  inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(.9, .5, .12) }), floats, ([x, z]) => { o.position.set(x, SEA + .3, z); o.scale.set(.5, .4, .5); });

  // Feed barge: a squat hull with a silo house, warm windows and a deck flood.

  const BARGE = [['box', 14, 3, 30, 0, 0, 0, [.18, .2, .2]], ['box', 11, 6, 14, 0, 4.5, -4, [.55, .57, .56]], ['cyl', 6, 8, 6, 0, 5.5, 8, [.5, .5, .48]],
    ['box', 11.2, .8, 10, 0, 5, -4, [1.3, .85, .45], 1], ['box', 1.2, .5, 1.2, 0, 11, 8, [1.7, 1.6, 1.3], 1], ['box', .5, .5, .5, 0, 9, -11, [1.8, .12, .08], 1]];
  for (const [lit, mat] of [[0, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 })], [1, new THREE.MeshBasicMaterial({ vertexColors: true })]])
    inst(mergeGeometries(BARGE.filter(p => !!p[8] === !!lit).map(part)), mat, barges, ([x, z, a]) => { o.position.set(x, SEA, z); o.rotation.set(0, a, 0); o.scale.setScalar(1); });
  return out;
}
