// Mercado Baja: a glowing cutaway into the sunken bazaar, grand stair entrances, vent stacks and steam.
// The layout scales with the lot, so a larger footprint gets a larger pit, more stalls and more entrances.

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const meta = { title: 'Mercado Baja', district: 'Base de Cayambe', type: 'Market',
  summary: "The \"Low Market\": a kilometres-long underground bazaar at the commercial heart of Base de Cayambe. If you can't find it here, it's too legal.", color: [1.6, 1.2, .5] };

// Merged vertex-coloured meshes. Lit parts get fake face shading so flat basic materials still read as solids.

function batch(THREE) {
  const parts = [], up = new THREE.Vector3(0, 0, 1);
  function add(g, x, y, z, rgb, ry = 0, rx = 0, shade = true) {
    g.rotateX(rx); g.rotateY(ry); g.translate(x, y, z);
    const n = g.attributes.position.count, nm = g.attributes.normal, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const s = shade ? .5 + .5 * Math.max(0, nm.getY(i)) + .15 * nm.getX(i) : 1;
      c[i * 3] = rgb[0] * s; c[i * 3 + 1] = rgb[1] * s; c[i * 3 + 2] = rgb[2] * s;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    parts.push(g);
  }
  return {
    box: (x, y, z, sx, sy, sz, rgb, ry, rx, shade) => add(new THREE.BoxGeometry(sx, sy, sz), x, y, z, rgb, ry, rx, shade),
    cyl: (x, y, z, rad, h, rgb, seg = 8) => add(new THREE.CylinderGeometry(rad, rad, h, seg), x, y, z, rgb),
    seg: (a, b, t, rgb, shade) => {
      const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), g = new THREE.BoxGeometry(t, t, d.length());
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d.normalize()));
      add(g, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, rgb, 0, 0, shade);
    },
    mesh: () => new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ vertexColors: true })),
  };
}

// The pit draws first. The mask then writes depth over the hole, so the ground fails its depth test there and the pit shows through.

function cutaway(THREE, decor, x0, z0, x1, z1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    colorWrite: false,
    vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'void main(){}',
  }));
  m.position.set((x0 + x1) / 2, .34, (z0 + z1) / 2); m.renderOrder = -1;
  decor.add(m);
}

// The part of the lot free of places seated earlier, as [left, right, back, front] in local metres.
// Each overlapping neighbour is cut off on the side that loses the least area. Neighbours show up as sibling groups with a tagged mesh.

function freeRect(H, p, W, D) {
  const F = H.frame(), full = [-W / 2, W / 2, -D / 2, D / 2];
  if (!F) return full;
  const near = new Set();
  for (const g of H.decor.parent?.children ?? []) for (const m of g.children ?? []) {
    const q = m.userData.place;
    if (q && q !== p && q.frame) near.add(q.frame);
  }
  let [L, R, B, T] = full;
  for (const f of near) {
    const xs = [], zs = [];
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const lx = a * f.w / 2, lz = b * f.d / 2;
      const dx = f.cx + lx * f.c + lz * f.s - F.tx, dz = f.cz - lx * f.s + lz * f.c - F.tz;
      xs.push(dx * F.c - dz * F.s); zs.push(dx * F.s + dz * F.c);
    }
    const x0 = Math.min(...xs) - 2, x1 = Math.max(...xs) + 2, z0 = Math.min(...zs) - 2, z1 = Math.max(...zs) + 2;
    if (x1 < L || x0 > R || z1 < B || z0 > T) continue;
    const cuts = [[Math.max(L, x1), R, B, T], [L, Math.min(R, x0), B, T], [L, R, Math.max(B, z1), T], [L, R, B, Math.min(T, z0)]];
    [L, R, B, T] = cuts.reduce((m, c) => (c[1] - c[0]) * (c[3] - c[2]) > (m[1] - m[0]) * (m[3] - m[2]) ? c : m);
  }
  return R - L < 50 || T - B < 40 ? full : [L, R, B, T];
}

export function build(H, p, cx, cz) {
  const { BDC, GLOWS, THREE, bld, canvasTexture, decor, glow, grey, hash, mixStyle, neonTexture, panel, prop, put, rng, stringLights } = H;
  const st = mixStyle(0), r = rng(hash(9100, 1174));
  const X = x => cx + x, Z = z => cz + z, pick = a => a[Math.floor(r() * a.length)];

  // Lot and pit sizes. A 68 m lot gives the original 40 × 24 m pit with one stair.

  const F = H.frame();
  const [L, R, B, T] = freeRect(H, p, F?.w ?? 68, F?.d ?? 68), LD = T - B, M = (L + R) / 2, hw = (R - L) / 2;
  const sm = Math.min(16, hw * .4), PX0 = L + sm, PX1 = R - sm;
  const DEP = 9, RZ = T - 8, HZ1 = RZ - 2 * DEP, HZ0 = B + Math.min(18, LD * .26), ZM = (HZ0 + HZ1) / 2;
  const n = Math.max(1, Math.round((R - L) / 70));
  const stairs = Array.from({ length: n }, (_, i) => ({ x: PX0 + (i + .5) * (PX1 - PX0) / n, rx: n === 1 || i === (n - 1) / 2 ? 6 : 4.5, main: n === 1 || i === Math.floor(n / 2) }));
  const nearStair = (x, pad) => stairs.some(s => Math.abs(x - s.x) < s.rx + pad);

  // Ground slab. Inside the holes the mask hides it.

  prop('box', X(M), .15, Z((B + T) / 2), R - L, .3, LD, [.04, .036, .033]);
  cutaway(THREE, decor, X(PX0), Z(HZ0), X(PX1), Z(HZ1));
  for (const s of stairs) cutaway(THREE, decor, X(s.x - s.rx), Z(HZ1 - .01), X(s.x + s.rx), Z(RZ));

  // The pit: section walls, two storeys of shopfronts, stall rows, crowds, light strings.

  const pit = batch(THREE), lit = batch(THREE);
  const rock = [.06, .045, .035], conc = [.17, .16, .15], fy = -DEP;
  pit.box(X(M), fy - .5, Z((HZ0 + RZ) / 2), PX1 - PX0 + 2, 1, RZ - HZ0 + 2, [.045, .04, .045]);
  const wall = (x, z, w, d) => {
    pit.box(X(x), fy / 2 - .8, Z(z), w, -fy - 1.6, d, rock);
    pit.box(X(x), -.5, Z(z), w + .02, 1.6, d + .02, conc);
  };
  wall(M, HZ0 - .5, PX1 - PX0 + 2, 1);
  for (const x of [PX0 - .5, PX1 + .5]) wall(x, ZM, 1, HZ1 - HZ0);
  const fronts = [];
  let x0 = PX0;
  for (const s of stairs) { fronts.push([x0, s.x - s.rx]); x0 = s.x + s.rx; }
  fronts.push([x0, PX1]);
  for (const [a, b] of fronts) wall((a + b) / 2, HZ1 + .5, b - a, 1);
  for (const s of stairs) for (const sx of [-1, 1]) wall(s.x + sx * (s.rx + .5), (HZ1 + RZ) / 2, 1, RZ - HZ1);

  const pal = [...BDC.signs, [.3, 1.2, 1.4], [1.4, .3, .9], [1.5, 1.1, .4]];
  const shop = (x, z, nx, nz, along) => {
    for (let k = -along / 2 + 2; k < along / 2 - 1; k += 3.4 + r() * 1.5) for (const [y, hh] of [[fy + 1.4, 2.6], [fy + 4.6, 2]]) {
      const c = pick(pal), s = .35 + r() * .5;
      const px = x + nz * k * -1 + nx * .1, pz = z + nx * k + nz * .1;
      lit.box(X(px), y, Z(pz), nx ? .1 : 2.6, hh, nx ? 2.6 : .1, c.map(v => v * s), 0, 0, false);
      if (r() < .5) lit.box(X(px + nx * .2), y + hh / 2 + .5, Z(pz + nz * .2), nx ? .1 : 1.8, .5, nx ? 1.8 : .1, pick(pal).map(v => v * .9), 0, 0, false);
      pit.box(X(px + nx * .9), y + hh / 2 + .2, Z(pz + nz * .9), nx ? 1.8 : 2.8, .12, nx ? 2.8 : 1.8, pick([[.05, .14, .16], [.2, .05, .04], [.08, .08, .1]]));
    }
    pit.box(X(x + nx * 1.4), fy + 3.6, Z(z + nz * 1.4), nx ? 2.6 : along, .25, nx ? along : 2.6, [.09, .08, .08]);
  };
  shop(M, HZ0, 0, 1, PX1 - PX0);
  shop(PX0, ZM, 1, 0, HZ1 - HZ0);
  shop(PX1, ZM, -1, 0, HZ1 - HZ0);
  for (const [a, b] of fronts) if (b - a > 6) shop((a + b) / 2, HZ1, 0, -1, b - a);

  // Stall grid. Aisles run in from each stair, and a main aisle runs the length of the pit.

  const awn = [[.05, .16, .18], [.22, .06, .05], [.1, .1, .12], [.18, .12, .05]];
  const mainAisle = z => Math.abs(z - ZM) < 3.2 && HZ1 - HZ0 > 30;
  for (let z = HZ0 + 5.5; z < HZ1 - 2; z += 6.5) for (let x = PX0 + 5; x < PX1 - 4; x += 5) {
    if (mainAisle(z) || nearStair(x, .5) && z > HZ1 - 8) continue;
    if (n > 1 && nearStair(x, -2.5)) continue;
    const sx = x + (r() - .5), lamp = r() < .6 ? [1.8, 1.3, .6] : pick(pal);
    pit.box(X(sx), fy + .5, Z(z), 2.6, 1, 1.6, [.08, .06, .05]);
    lit.box(X(sx), fy + 1.05, Z(z), 2.2, .12, 1.2, [1.6, .8, .25].map(v => v * (.6 + r() * .5)), 0, 0, false);
    for (const dx of [-1.2, 1.2]) pit.box(X(sx + dx), fy + 1.6, Z(z), .1, 3.2, .1, [.1, .1, .1]);
    pit.box(X(sx), fy + 3.2, Z(z), 3.2, .12, 2.6, pick(awn), 0, .18);
    lit.box(X(sx), fy + 2.9, Z(z + .4), .3, .3, .3, lamp, 0, 0, false);
    if (r() < .25) pit.box(X(sx), fy + 1.4, Z(z - .5), 2.2, .8, .6, pick([[.2, .14, .08], [.1, .14, .1], [.16, .1, .12]]));
  }
  const inAisle = (x, z) => mainAisle(z) || nearStair(x, 0) || (z - HZ0 - 5.5 + 3.25) % 6.5 < 1.6;
  for (let k = 0, area = (PX1 - PX0) * (HZ1 - HZ0); k < area / 9; k++) {
    const x = PX0 + 1.5 + r() * (PX1 - PX0 - 3), z = HZ0 + 2 + r() * (HZ1 - HZ0 - 3);
    if (!inAisle(x, z) && r() < .7) continue;
    pit.cyl(X(x), fy + .85, Z(z), .28, 1.7, grey(r, .1 + r() * .1).map((v, i) => v * [1.2, 1, .9][i]), 5);
  }

  // Stairs down from the street, with glowing handrails and people on the steps.

  const steps = 12, run = (RZ - HZ1) / steps, slope = Math.atan2(DEP + .3, RZ - HZ1);
  for (const s of stairs) {
    for (let k = 0; k < steps; k++) {
      const top = .3 - (k + 1) * (DEP + .3) / steps, z = RZ - (k + .5) * run;
      pit.box(X(s.x), (top + fy) / 2, Z(z), s.rx * 2, top - fy + .01, run, [.12, .11, .1]);
      lit.box(X(s.x), top + .03, Z(z + run / 2 - .1), s.rx * 2 - .4, .05, .12, [.9, .6, .2], 0, 0, false);
    }
    for (let k = 0; k < 4 * s.rx; k++) {
      const z = HZ1 + r() * (RZ - HZ1), y = .3 - Math.ceil((RZ - z) / run) * (DEP + .3) / steps;
      pit.cyl(X(s.x + (r() - .5) * (s.rx * 2 - 2)), y + .85, Z(z), .28, 1.7, grey(r, .14), 5);
    }
    for (const sx of [-1, 1]) lit.box(X(s.x + sx * (s.rx - .25)), -DEP / 2 + .5, Z((HZ1 + RZ) / 2), .12, .12, Math.hypot(DEP, RZ - HZ1), [2.2, 1.2, .3], 0, -slope, false);
  }

  // Overhead: bulb strings, cable bundles and hanging holo signs.

  const sag = (y, s, t) => y - s * 4 * t * (1 - t);
  for (let x = PX0 + 3; x < PX1 - 1; x += 7) for (let k = 0; k <= 14; k++) {
    const t = k / 14, z = HZ0 + t * (HZ1 - HZ0);
    lit.box(X(x + (r() - .5) * .3), sag(-1.6, 2.2, t), Z(z), .3, .3, .3, k % 3 ? [1.8, 1.1, .4] : [1.6, .3, .5], 0, 0, false);
  }
  const cable = (a, b, y, s, segs) => {
    for (const [oy, oz, t] of [[0, 0, .22], [-.25, .2, .14], [.12, -.22, .16]]) {
      let prev = null;
      for (let k = 0; k <= segs; k++) {
        const u = k / segs, pt = [X(a[0] + (b[0] - a[0]) * u), sag(y + oy, s, u), Z(a[1] + (b[1] - a[1]) * u + oz)];
        if (prev) pit.seg(prev, pt, t, [.04, .035, .035], false);
        prev = pt;
      }
    }
  };
  for (let z = HZ0 + 3; z < HZ1 - 1; z += Math.max(6, (HZ1 - HZ0) / 6)) cable([PX0, z], [PX1, z], -.9, 1.6 + r() * 1.2, Math.ceil((PX1 - PX0) / 6));
  for (const s of stairs) cable([s.x - s.rx + 1, HZ0], [s.x - s.rx + 1, HZ1], -1, 1.4, 10);

  const words = [['NOODLES 面', '#ff4060'], ['CHIPS · MODS', '#4ff0ff'], ['REPARACIÓN', '#60ff9a'], ['SEGUNDA MANO', '#ffc060'],
    ['¡REGATEA!', '#ff5a8a'], ['SÓLO EFECTIVO', '#9ff8ff'], ['FARMACIA +', '#60ff9a'], ['CARNE ¿?', '#ff7040']];
  const holoTex = words.map(([t, c]) => neonTexture([t], c, { w: 512, h: 160, font: 'bold 68px sans-serif' }));
  const hang = (x, y, z, w, ry) => {
    const m = panel(pick(holoTex), X(x), y, Z(z), w, w * .31, ry, 1.2);
    m.renderOrder = -2;
    pit.box(X(x), (y + w * .16 - .6) / 2, Z(z), .05, -.6 - y - w * .16, .05, [.06, .06, .06], 0, 0, false);
  };
  for (let x = PX0 + 8; x < PX1 - 6; x += 14 + r() * 8) hang(x, -3.4 - r() * 1.2, ZM, 4 + r() * 1.5, 0);
  for (const s of stairs) for (let z = HZ0 + 7; z < HZ1 - 6; z += 12) hang(s.x, -3 - r(), z, 3.6, Math.PI / 2);
  for (let k = 0; k < Math.ceil((PX1 - PX0) / 10); k++)
    lit.box(X(PX0 + 3 + r() * (PX1 - PX0 - 6)), -3.8 - r() * 1.5, Z(HZ0 + 6 + r() * (HZ1 - HZ0 - 12)), .3, 1.6 + r() * 1.4, .3, pick(pal), 0, 0, false);

  for (const m of [pit.mesh(), lit.mesh()]) { m.renderOrder = -2; m.userData.place = p; decor.add(m); }

  // Billboards on the back wall.

  const bill = (x, w, top, sub, col) => {
    const m = panel(canvasTexture(512, 256, (g, cw, ch) => {
      g.fillStyle = '#041015'; g.fillRect(0, 0, cw, ch);
      g.strokeStyle = col; g.lineWidth = 6; g.strokeRect(8, 8, cw - 16, ch - 16);
      g.shadowColor = col; g.shadowBlur = 16; g.fillStyle = '#e8fcff';
      g.font = 'bold 96px sans-serif'; g.textAlign = 'center'; g.fillText(top, cw / 2, 120);
      g.font = 'bold 40px sans-serif'; g.fillText(sub, cw / 2, 200);
    }), X(x), -4.2, Z(HZ0 + 1.2), w, w / 2, 0, .9);
    m.renderOrder = -2;
  };
  bill(M, 12, '低市场', 'CRÉDITOS · NO PREGUNTAS', '#4ff0ff');
  if (hw > 60) {
    bill(M - hw * .5, 10, 'TODO', 'SE VENDE · SE COMPRA', '#ff5a8a');
    bill(M + hw * .5, 10, '¥ $ €', 'CAMBIO · EFECTIVO', '#60ff9a');
  }

  // Footbridges over the pit between the stairs, plus a truss along the main aisle.

  const bridges = n > 1 ? stairs.slice(1).map((s, i) => (s.x + stairs[i].x) / 2) : [M - 10, M + 10];
  for (const x of bridges) {
    prop('box', X(x), .5, Z(ZM), 3, .3, HZ1 - HZ0, [.13, .12, .11]);
    for (const sx of [-1, 1]) glow(X(x + sx * 1.45), .75, Z(ZM), .06, .06, HZ1 - HZ0, [1.6, .9, .3]);
    for (let k = 0; k < (HZ1 - HZ0) / 6; k++) prop('cyl', X(x + (r() - .5) * 2), 1.5, Z(HZ0 + r() * (HZ1 - HZ0)), .55, 1.7, grey(r, .12));
  }
  prop('box', X(M), .55, Z(ZM), PX1 - PX0, .4, .4, [.12, .11, .1]);

  // Railings round the pit and the stair slots.

  const rail = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), m = Math.ceil(len / 3);
    prop('box', X((x0 + x1) / 2), 1.2, Z((z0 + z1) / 2), x1 - x0 || .12, .12, z1 - z0 || .12, [.25, .2, .12]);
    for (let k = 0; k <= m; k++) prop('box', X(x0 + (x1 - x0) * k / m), .7, Z(z0 + (z1 - z0) * k / m), .12, 1, .12, [.2, .18, .15]);
  };
  rail(PX0, HZ0, PX1, HZ0); rail(PX0, HZ0, PX0, HZ1); rail(PX1, HZ0, PX1, HZ1);
  for (const [a, b] of fronts) rail(a, HZ1, b, HZ1);
  for (const s of stairs) for (const sx of [-1, 1]) rail(s.x + sx * s.rx, HZ1, s.x + sx * s.rx, RZ);
  for (const [x, z] of [[PX0, HZ0], [PX1, HZ0], [PX0, HZ1], [PX1, HZ1]]) glow(X(x), 1.5, Z(z), .5, .5, .5, [1.8, 1, .3]);

  // Entrance gates over the stairs. The main gate carries the name.

  const gz = Z(RZ + 1);
  for (const s of stairs) {
    const k = s.main ? 1 : .7, px = s.rx + 1.6, top = 12.4 * k;
    for (const sx of [-1, 1]) {
      prop('box', X(s.x + sx * px), top / 2, gz, 1.6 * k, top, 1.6 * k, [.12, .1, .08]);
      glow(X(s.x + sx * px), top / 2, gz + .85 * k, .25, top - 1, .1, [2, 1.2, .35]);
    }
    prop('box', X(s.x), top, gz, px * 2 + 2.8, 3 * k, 1.8 * k, [.1, .085, .07]);
    const name = s.main ? 'MERCADO BAJA' : s.x < M ? 'MERCADO · OESTE' : 'MERCADO · ESTE';
    panel(neonTexture([name], '#ffc060', { w: 1024, h: 160, font: 'bold 96px "Avenir Next Condensed", "Arial Narrow", sans-serif' }), X(s.x), top, gz + .95 * k, px * 2 + 1.8, 2.7 * k, 0, 1.6).userData.place = p;
    panel(neonTexture(['▼ ENTRADA ▼'], '#ff5a8a', { w: 512, h: 96, font: 'bold 60px sans-serif', border: false }), X(s.x), top - 2.6 * k, gz + .95, 7 * k, 1.3 * k, 0, 1.3);
    stringLights([X(s.x - px), top - 2, gz], [X(s.x - px - 10), 5, Z(T - 3)], .6, 10, [1.6, .9, .3]);
    stringLights([X(s.x + px), top - 2, gz], [X(s.x + px + 10), 5, Z(T - 3)], .6, 10, [1.6, .4, .5]);
  }
  const ms = stairs.find(s => s.main);
  panel(neonTexture(['低', '市', '场'], '#4ff0ff', { w: 128, h: 384, font: 'bold 96px sans-serif' }), X(ms.x - ms.rx - 4.4), 9, gz + .2, 2.6, 7.8, Math.PI / 2, 1.5).userData.place = p;

  // Vendor carts and crowds on the street apron.

  const cart = (x, z, ry, k) => {
    prop('box', X(x), .9, Z(z), 3, 1.2, 1.8, [.1, .08, .06], ry);
    glow(X(x), 1.55, Z(z), ry ? 1.2 : 2.5, .1, ry ? 2.5 : 1.2, [1.6, .75, .2]);
    prop('box', X(x), 3.1, Z(z), ry ? 2.8 : 3.6, .12, ry ? 3.6 : 2.8, awn[k % awn.length].map(v => v * 1.6), ry, .2);
    for (const dx of [-1.4, 1.4]) prop('box', X(x + (ry ? 0 : dx)), 2, Z(z + (ry ? dx : 0)), .1, 2.3, .1, [.1, .1, .1]);
    glow(X(x), 2.7, Z(z), .3, .3, .3, [1.8, 1.3, .6]);
  };
  let ck = 0;
  for (let x = L + 6; x < R - 4; x += 9 + r() * 6) if (!nearStair(x, 5)) cart(x, T - 4 - r() * 3, 0, ck++);
  for (const z of [HZ1 + 4, (HZ1 + T) / 2 + 1]) for (let x = PX0 + 4 + r() * 4; x < PX1 - 4; x += 8 + r() * 6) if (!nearStair(x, 4)) cart(x, z, 0, ck++);
  for (let k = 0, area = (R - L) * (T - HZ1); k < area / 12; k++) {
    const x = L + 1 + r() * (R - L - 2), z = HZ1 + 1.5 + r() * (T - HZ1 - 2);
    if (nearStair(x, 1) && z < RZ) continue;
    prop('cyl', X(x), .85, Z(z), .55, 1.7, grey(r, .12));
  }

  // Market halls at the ends, tenements along the back.

  const hallH = [7, 9];
  [PX0 - sm / 2, PX1 + sm / 2].forEach((x, i) => {
    bld(X(x), Z(ZM), sm - 4, HZ1 - HZ0 + 2, hallH[i], st, r, { lit: .5, roof: false });
    prop('box', X(x), 4, Z(HZ1 + 1.6), sm - 4, .15, 2.4, [.2, .06, .04], 0, .25);
    glow(X(x), 2, Z(HZ1 + 1.1), sm - 6, 2, .1, [1.4, .7, .2]);
  });
  const backD = HZ0 - B - 4, signs = [['RAMEN 拉面', '#ff4060'], ['CAMBIO $ ¥ €', '#60ff9a'], ['HOTEL 旅馆', '#ffc060'], ['BAR · KARAOKE', '#ff5a8a'], ['CLÍNICA 24H', '#4ff0ff']];
  const towers = [];
  for (let x = L + 2, k = 0; x < R - 8; k++) {
    const w = Math.min(R - x - 1, 14 + r() * 12), h = 14 + r() * 18, d = backD * (.7 + r() * .3);
    bld(X(x + w / 2), Z(B + 1 + d / 2), w, d, h, st, r);
    if (r() < .6) { const [t, c] = signs[k % signs.length]; panel(neonTexture([t], c, { w: 512, h: 128 }), X(x + w / 2), 5 + r() * 6, Z(B + 1 + d + .1), Math.min(9, w - 2), 2.2, 0, 1.3); }
    towers.push([x + w + 2, h]);
    x += w + 4;
  }

  // Vent stacks with steam: on the halls, between the tenements and over the pit.

  const stacks = [];
  [PX0 - sm / 2, PX1 + sm / 2].forEach((x, i) => { for (let z = HZ0 + 6; z < HZ1 - 2; z += 16) stacks.push([x, z, 12 + r() * 8, hallH[i]]); });
  towers.slice(0, -1).forEach(([x], k) => { if (k % 2 === 0) stacks.push([x, HZ0 - 3, 11 + r() * 6, 0]); });
  const steamMat = H.soften(new THREE.MeshBasicMaterial({ color: 0x8fa6ad, transparent: true, opacity: .07, depthWrite: false }));
  const puff = new THREE.SphereGeometry(1, 12, 8);
  let tall = stacks[0];
  for (const st0 of stacks) {
    const [x, z, h, y0] = st0;
    if (y0 + h > tall[2] + tall[3]) tall = st0;
    prop('box', X(x), y0 + .6, Z(z), 3.4, 1.2, 3.4, [.1, .09, .08]);
    prop('cyl', X(x), y0 + h / 2, Z(z), 2, h, 2, [.16, .11, .07]);
    prop('cyl', X(x), y0 + h + .3, Z(z), 2.6, .6, 2.6, [.08, .07, .06]);
    put(GLOWS.ring, X(x), y0 + h * .35, Z(z), 2.2, 6, 2.2, 0, 0, [2, .8, .2]);
    for (let k = 0; k < 4; k++) {
      const s = 1.4 + k * 1.1, m = new THREE.Mesh(puff, steamMat);
      m.position.set(X(x + k * .7), y0 + h + 1.5 + k * 2.4, Z(z - k * .3)); m.scale.set(s, s * .8, s);
      decor.add(m);
    }
  }
  for (let x = PX0 + 10; x < PX1 - 6; x += 24 + r() * 10) for (let k = 0; k < 3; k++) {
    const m = new THREE.Mesh(puff, steamMat), s = 3 + k * 1.6;
    m.position.set(X(x + k * 2), 1 + k * 2.5, Z(ZM - 4 - k + (r() - .5) * 10)); m.scale.set(s, s * .6, s);
    decor.add(m);
  }
  H.beacon(X(tall[0]), tall[3] + tall[2] + .8, Z(tall[1]), r);
  return 30;
}
