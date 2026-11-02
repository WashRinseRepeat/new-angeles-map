// The big greens cut out of the street grid. Named parks grow forest with clearings and lamp-lit paths.
// Agricultural plots become a patchwork of crop fields, greenhouses and lit fish ponds, with orchard trees
// on the rim where no field fits and harvesters working the crop. fillGreens returns the harvesters' update.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITY, rng, sdPoly, vnoise } from './core.js';
import { WATER_MAT, flatGeo, smoothPoly, surface } from './render.js';
import { DECOR, PROPS, glow, glows, pools, prop } from './instances.js';
import { insidePoly } from './grammar.js';

export function fillGreens(H) {
  const paint = (g, rgb) => {
    g = g.index ? g.toNonIndexed() : g;
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => rgb).flat(), 3));
    g.deleteAttribute('uv');
    return g;
  };

  // One unit-height tree. The crown stays white so the instance colour tints it; the trunk reads brown under green.

  const crown = mergeGeometries([paint(new THREE.CylinderGeometry(.04, .06, .45, 5).translate(0, .22, 0), [1.7, .75, .55]),
    paint(new THREE.IcosahedronGeometry(.36, 0).scale(1, .85, 1).translate(0, .62, 0), [1, 1, 1])]);
  const forest = H.instanced(new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, flatShading: true }), 16000));
  forest.userData.massing = true;
  H.decor.add(forest);
  const ponds = [], crops = [];

  for (const area of CITY.parks ?? []) {
    const P = smoothPoly(area.poly), r = rng(area.name.length * 977 + Math.round(P[0][0]));
    const xs = P.map(p => p[0]), zs = P.map(p => p[1]), in_ = (x, z) => insidePoly(x, z, P);
    if (/park/i.test(area.name)) {
      for (let x = Math.min(...xs); x < Math.max(...xs); x += 8) for (let z = Math.min(...zs); z < Math.max(...zs); z += 8) {
        const tx = x + (r() - .5) * 6, tz = z + (r() - .5) * 6;
        if (!in_(tx, tz) || vnoise(tx / 90, tz / 90) < .24 || r() < .1) continue;
        const h = 9 + r() * 9;
        H.put(forest, tx, 0, tz, h * (.8 + r() * .4), h, h * (.8 + r() * .4), r() * 6.3, 0, [.03 + r() * .02, .07 + r() * .03, .03]);
      }

      // Scattered lamps mark the trails.

      for (let k = 0; k < 40; k++) {
        const x = Math.min(...xs) + r() * (Math.max(...xs) - Math.min(...xs)), z = Math.min(...zs) + r() * (Math.max(...zs) - Math.min(...zs));
        if (in_(x, z)) glow(x, 4, z, .4, .3, .4, [1, .8, .5]);
      }
      continue;
    }

    // Fields follow the plot's longest edge.

    let a = 0, best = 0;
    P.forEach((p, i) => { const q = P[(i + 1) % P.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L > best) { best = L; a = Math.atan2(q[1] - p[1], q[0] - p[0]); } });
    const c = Math.cos(a), s = Math.sin(a), cx = xs.reduce((u, v) => u + v) / xs.length, cz = zs.reduce((u, v) => u + v) / zs.length;
    const R = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
    const CROPS = [[.1, .2, .06], [.16, .19, .06], [.18, .14, .07], [.08, .16, .09], [.14, .1, .06]];
    const used = new Set();
    for (let u = -R / 2; u < R / 2; u += 48) for (let v = -R / 2; v < R / 2; v += 32) {
      const x = cx + u * c - v * s, z = cz + u * s + v * c, ry = -a;
      if (![[-23, -15], [23, -15], [-23, 15], [23, 15]].every(([du, dv]) => in_(x + du * c - dv * s, z + du * s + dv * c))) continue;
      used.add(`${u},${v}`);
      const kind = r();
      if (kind < .2 && DECOR.fieldExtras) {
        ponds.push([[-21, -13], [21, -13], [21, 13], [-21, 13]].map(([du, dv]) => [x + du * c - dv * s, z + du * s + dv * c]));
        prop('box', x, -.3, z, 46, 1.4, 30, [.05, .045, .035], ry);
        for (const dv of [-6, 6]) glow(x + 22 * c - dv * s, 2.5, z + 22 * s + dv * c, .3, .3, .3, [.4, 1, 1.2]);
      } else if (kind < .3 && DECOR.fieldExtras) {
        prop('box', x, 2.2, z, 40, 4.4, 24, [.1, .14, .12], ry);
        glow(x, 4.5, z, 40, .1, 24, [.025, .05, .02], ry);
      } else {
        const crop = CROPS[Math.floor(r() * CROPS.length)];

        // The field slab runs 1.4 m deep, so the tiler keeps it in view at range like the ground.

        prop('box', x, -.5, z, 46, 1.4, 30, crop.map(q => q * .8), ry);
        for (let k = -13.5; k <= 13.5; k += 3) prop('box', x - k * s, .3, z + k * c, 44, .25, 1.2, crop, ry);
        crops.push([x, z, c, s]);
      }
    }

    // Orchard trees fill the rim, where the oval leaves no room for a whole field, out to the plot's raw
    // outline, which the street grid keeps clear.

    for (let u = -R / 2 - 40; u < R / 2 + 40; u += 7) for (let v = -R / 2 - 40; v < R / 2 + 40; v += 7) {
      const x = cx + u * c - v * s, z = cz + u * s + v * c;
      const fu = Math.round((u + R / 2) / 48) * 48 - R / 2, fv = Math.round((v + R / 2) / 32) * 32 - R / 2;
      if (sdPoly(x, z, area.poly) < 4 || (used.has(`${fu},${fv}`) && Math.abs(u - fu) < 24 && Math.abs(v - fv) < 16)) continue;
      const h = 5 + r() * 5;
      H.put(forest, x + (r() - .5) * 3, 0, z + (r() - .5) * 3, h, h * .9, h, r() * 6.3, 0, [.03 + r() * .02, .06 + r() * .03, .025]);
    }
  }
  if (ponds.length) surface(new THREE.Mesh(flatGeo(ponds, .45), WATER_MAT));
  return harvesters(H, crops);
}

// Harvesters drive the crop rows of some fields: down a row, across to the next, back up, and so on to the
// last row and back. Bodies, lights and the lit ground ahead are one instanced mesh each, rewritten per frame.

function harvesters(H, crops) {
  const r = rng(4417), N = Math.min(14, crops.length), jobs = [];

  // Greens without a crop field have no harvesters, and nor does a pack whose look.decor turns them off.

  if (!N || !DECOR.harvesters) return {};
  for (let i = 0; i < N; i++) jobs.push({ f: crops.splice(Math.floor(r() * crops.length), 1)[0], ph: r() * 1000, v: 2.2 + r() * .8 });
  const mesh = (geo, mat, n) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.userData.noTile = true; m.frustumCulled = false;
    H.decor.add(m);
    return m;
  };
  const body = mesh(PROPS.box.geometry, PROPS.box.material, N * 3), lit = mesh(glows.geometry, glows.material, N * 3);
  const patch = mesh(pools.geometry, pools.material, N), o = new THREE.Object3D(), col = new THREE.Color();
  const parts = [

    // [mesh, along, up, sx, sy, sz, rgb], with z along the heading: hull, grain tank, header,
    // work light, tail lamp, amber beacon.

    [body, 0, 1.8, 3.4, 3, 6, [.36, .27, .06]], [body, -1.2, 3.8, 2.6, 1.2, 2.8, [.4, .31, .08]],
    [body, 3.6, .9, 7, .8, 1.4, [.24, .19, .05]], [lit, 2.8, 3.5, 1.6, .3, .3, [1.3, 1.25, 1]],
    [lit, -3, 2, 1.2, .3, .2, [1.4, .15, .08]], [lit, -.5, 4.6, .35, .35, .35, [1.6, .7, .1]],
  ];
  const ROWS = 10, LEN = 40, LEG = LEN + 3, LOOP = 2 * ROWS * LEG;
  const place = (m, i, x, y, z, ry, sx, sy, sz, rgb) => {
    o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.scale.set(sx, sy, sz); o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    if (rgb) m.setColorAt(i, col.setRGB(...rgb));
  };
  const update = (t, first) => {
    const nb = [0, 0];
    jobs.forEach(({ f: [fx, fz, c, s], ph, v }, i) => {

      // Distance along the loop gives the leg: one row, then a 3 m step to the next row. The last row of each
      // pass turns in place, and the way back runs every row the other way.

      const d = (t * v + ph) % LOOP, leg = Math.floor(d / LEG), p = d % LEG, back = leg >= ROWS;
      const row = back ? 2 * ROWS - 1 - leg : leg, dir = (row % 2 ? -1 : 1) * (back ? -1 : 1), step = back ? -1 : 1;
      const turn = leg % ROWS === ROWS - 1 ? 0 : step;
      let u, w, hu, hw;
      if (p < LEN) { u = dir * (p - LEN / 2); w = -13.5 + row * 3; hu = dir; hw = 0; }
      else { u = dir * LEN / 2; w = -13.5 + row * 3 + turn * (p - LEN); hu = 0; hw = step; }
      const x = fx + u * c - w * s, z = fz + u * s + w * c, ex = hu * c - hw * s, ez = hu * s + hw * c, ry = Math.atan2(ex, ez);
      const blink = (t * 1.5 + ph) % 1 < .5;
      parts.forEach(([m, al, up, sx, sy, sz, rgb], k) => {
        const j = m === body ? nb[0]++ : nb[1]++;
        place(m, j, x + ex * al, up, z + ez * al, ry, sx, k === 5 && !blink ? 0 : sy, sz, first && rgb);
      });
      place(patch, i, x + ex * 9, .3, z + ez * 9, 0, 16, 1, 16, first && [.12, .11, .09]);
    });
    for (const m of [body, lit, patch]) { m.instanceMatrix.needsUpdate = true; if (first) m.instanceColor.needsUpdate = true; }
  };
  update(0, true);
  return { update: t => update(t, false) };
}
