// Rolling hills round the city, for a pack without terrain of its own. A pack names this module as its terrain
// ('../../engine/hills.js') and tunes it in look.land. It replaces the flat ground, the slab and the sea: the
// ground stays flat over the city's rectangle and a margin round it, then rises into hills grown with trees.
//
// look.land keys, with their defaults:
//   size 7000        side of the ground square in metres
//   height 150       tallest hills in metres
//   pad 40, rise 700 the flat margin round the city, then the distance over which the hills reach full height
//   low, high, rock  ground colours: valley grass, upland grass and bare tops, as [r, g, b]
//   trees 6000       trees on the hills, tree [r, g, b] their crown colour
//   road [r, g, b]   the colour of the country roads the city file lists under roads, laid 5 m wide over the hills

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { vnoise } from './core.js';
import { moatSink, reliefAt } from './relief.js';

export function build(H, group) {
  const L = { size: 7000, height: 150, pad: 40, rise: 700, low: [.05, .07, .04], high: [.07, .09, .05], rock: [.1, .1, .09],
    trees: 6000, tree: [.04, .08, .04], ...H.SETTING.look.land };
  const [ox, oz] = H.CITY.origin, [dx, dz] = H.CITY.dims, cx = ox + dx / 2, cz = oz + dz / 2;

  // Height: 0 over the city's rectangle and its margin, then two octaves of smooth noise that grow with distance.

  const out = (x, z) => Math.hypot(Math.max(ox - x, 0, x - ox - dx), Math.max(oz - z, 0, z - oz - dz));
  const hill = (x, z) => .6 * vnoise(x / 900 + 3, z / 900 + 7) + .4 * vnoise(x / 300 + 11, z / 300 + 2);
  const hills = (x, z) => H.smooth(L.pad, L.pad + L.rise, out(x, z)) * L.height * (.25 + .75 * hill(x, z));

  // A city file's relief adds to the hills. Inside the town the land sinks up to 2.5 m below it, so the coarse
  // grid never shows through the town's own ground; it sinks over the first 16 m inside the wards' edge, and along a
  // moat.

  const wards = H.CITY.relief ? H.CITY.districts.map(d => d.poly) : [];
  const inside = (x, z) => {
    let best = 0;
    for (const P of wards) {
      let a = false, d = Infinity;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const [xi, zi] = P[i], [xj, zj] = P[j];
        if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) a = !a;
        const ex = xj - xi, ez = zj - zi, t = Math.max(0, Math.min(1, ((x - xi) * ex + (z - zi) * ez) / (ex * ex + ez * ez)));
        d = Math.min(d, Math.hypot(x - xi - ex * t, z - zi - ez * t));
      }
      if (a) best = Math.max(best, d);
    }
    return best;
  };
  const height = (x, z) => hills(x, z) + reliefAt(x, z) - (wards.length ? 2.5 * H.smooth(0, 16, inside(x, z)) : 0) - moatSink(x, z);

  const N = wards.length ? 440 : 220, geo = new THREE.PlaneGeometry(L.size, L.size, N, N).rotateX(-Math.PI / 2).translate(cx, 0, cz);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = height(x, z), k = hills(x, z) / L.height, n = vnoise(x / 60, z / 60);
    pos.setY(i, y);
    const c = k > .7 ? L.rock.map((v, j) => H.lerp(L.high[j], v, H.smooth(.7, .95, k))) : L.low.map((v, j) => H.lerp(v, L.high[j], H.smooth(.05, .5, k)));
    col.set(c.map(v => v * (.85 + .3 * n)), i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true,
    polygonOffsetFactor: 4, polygonOffsetUnits: 4 })));

  // Country roads: a 5 m strip along each of the city file's roads, laid a little above the hills. Trees keep 7 m
  // off them, found through a 16 m grid of road points.

  const near = new Map(), key = (x, z) => `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
  for (const R of H.CITY.roads ?? []) {
    const v = [];
    R.forEach(([x, z], i) => {
      const a = R[Math.max(0, i - 1)], b = R[Math.min(R.length - 1, i + 1)], t = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / t * 2.5, nz = (b[0] - a[0]) / t * 2.5;
      v.push([x - nx, height(x - nx, z - nz) + .35, z - nz], [x + nx, height(x + nx, z + nz) + .35, z + nz]);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const k = `${Math.floor(x / 16) + di},${Math.floor(z / 16) + dj}`;
        if (!near.has(k)) near.set(k, []);
        near.get(k).push([x, z]);
      }
    });
    const pos = [];
    for (let i = 0; i + 1 < v.length / 2; i++) {
      const [a, b, c, d] = [v[i * 2], v[i * 2 + 1], v[i * 2 + 2], v[i * 2 + 3]];
      pos.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: new THREE.Color(...(L.road ?? [.2, .16, .11])), roughness: 1,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
  }
  const onRoad = (x, z) => near.get(key(x, z))?.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 49);

  // Trees stand where the ground has begun to rise and the noise says wood, in one instanced mesh.

  const paint = (g, rgb) => {
    g = g.index ? g.toNonIndexed() : g;
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => rgb).flat(), 3));
    return g;
  };
  const tree = mergeGeometries([paint(new THREE.CylinderGeometry(.06, .08, .35, 5).translate(0, .17, 0), [.5, .35, .25]),
    paint(new THREE.ConeGeometry(.4, .9, 6).translate(0, .75, 0), [1, 1, 1])]);
  const woods = new THREE.InstancedMesh(tree, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, flatShading: true }), L.trees);
  const r = H.rng(H.hash(41, 17)), o = new THREE.Object3D(), c = new THREE.Color();
  let n = 0;
  for (let tries = 0; n < L.trees && tries < L.trees * 12; tries++) {
    const x = cx + (r() - .5) * L.size * .9, z = cz + (r() - .5) * L.size * .9, d = out(x, z);
    if (d < L.pad + 30 || vnoise(x / 400 + 5, z / 400 + 1) < .45 || onRoad(x, z)) continue;
    const s = 8 + r() * 9;
    o.position.set(x, height(x, z) - .5, z); o.scale.set(s, s * (.9 + r() * .5), s); o.rotation.y = r() * 6.3; o.updateMatrix();
    woods.setMatrixAt(n, o.matrix);
    woods.setColorAt(n++, c.setRGB(...L.tree.map(v => v * (.7 + .6 * r()))));
  }
  woods.count = n;
  woods.frustumCulled = false;
  group.add(woods);
  return {};
}
