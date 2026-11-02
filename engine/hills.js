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

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { vnoise } from './core.js';

export function build(H, group) {
  const L = { size: 7000, height: 150, pad: 40, rise: 700, low: [.05, .07, .04], high: [.07, .09, .05], rock: [.1, .1, .09],
    trees: 6000, tree: [.04, .08, .04], ...H.SETTING.look.land };
  const [ox, oz] = H.CITY.origin, [dx, dz] = H.CITY.dims, cx = ox + dx / 2, cz = oz + dz / 2;

  // Height: 0 over the city's rectangle and its margin, then two octaves of smooth noise that grow with distance.

  const out = (x, z) => Math.hypot(Math.max(ox - x, 0, x - ox - dx), Math.max(oz - z, 0, z - oz - dz));
  const hill = (x, z) => .6 * vnoise(x / 900 + 3, z / 900 + 7) + .4 * vnoise(x / 300 + 11, z / 300 + 2);
  const height = (x, z) => H.smooth(L.pad, L.pad + L.rise, out(x, z)) * L.height * (.25 + .75 * hill(x, z));

  const N = 220, geo = new THREE.PlaneGeometry(L.size, L.size, N, N).rotateX(-Math.PI / 2).translate(cx, 0, cz);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = height(x, z), k = y / L.height, n = vnoise(x / 60, z / 60);
    pos.setY(i, y);
    const c = k > .7 ? L.rock.map((v, j) => H.lerp(L.high[j], v, H.smooth(.7, .95, k))) : L.low.map((v, j) => H.lerp(v, L.high[j], H.smooth(.05, .5, k)));
    col.set(c.map(v => v * (.85 + .3 * n)), i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 })));

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
    if (d < L.pad + 30 || vnoise(x / 400 + 5, z / 400 + 1) < .45) continue;
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
