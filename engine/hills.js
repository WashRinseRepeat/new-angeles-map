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
//                    and hedged for their first 700 m

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { vnoise } from './core.js';
import { channel, ditchAt, moatSink, reliefAt, softAt } from './relief.js';
import { COUNTRY, buildCountry } from './country.js';
import { FALLS, nearRiver, shapeLand } from './rivers.js';

export function build(H, group) {
  const L = { size: 7000, height: 150, pad: 40, rise: 700, low: [.05, .07, .04], high: [.07, .09, .05], rock: [.1, .1, .09],
    trees: 6000, tree: [.04, .08, .04], ...H.SETTING.look.land };
  const [ox, oz] = H.CITY.origin, [dx, dz] = H.CITY.dims, cx = ox + dx / 2, cz = oz + dz / 2;

  // Height: 0 over the city's rectangle and its margin, then two octaves of smooth noise that grow with distance.

  const out = (x, z) => Math.hypot(Math.max(ox - x, 0, x - ox - dx), Math.max(oz - z, 0, z - oz - dz));
  const hill = (x, z) => .6 * vnoise(x / 900 + 3, z / 900 + 7) + .4 * vnoise(x / 300 + 11, z / 300 + 2);
  const hills = (x, z) => H.smooth(L.pad, L.pad + L.rise, out(x, z)) * L.height * (.25 + .75 * hill(x, z));

  // A city file's relief adds to the hills. Inside the town the land sinks at least 2.5 m below it, and at least
  // 3.5 m below the town's levelled ground (its square and sites, which flatten rises), so the coarse
  // grid never shows through the town's own ground; it sinks over the first 16 m inside the wards' edge, and along a
  // moat.

  // inside(x, z) is the depth into the deepest ward holding the point, capped at the 16 m the sink needs. A ward
  // whose box misses the point cannot hold it, and an edge whose box lies farther off than the
  // nearest edge so far cannot set it.

  const SINK = 16;
  const wards = (H.CITY.relief ? H.CITY.districts.map(d => d.poly) : []).map(P => {
    const xs = P.map(p => p[0]), zs = P.map(p => p[1]);
    return { P, box: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] };
  });
  const inside = (x, z) => {
    let best = 0;
    for (const { P, box } of wards) {
      if (x < box[0] || z < box[1] || x > box[2] || z > box[3]) continue;
      let a = false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const xi = P[i][0], zi = P[i][1], xj = P[j][0], zj = P[j][1];
        if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) a = !a;
      }
      if (!a) continue;
      let d = SINK;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const xi = P[i][0], zi = P[i][1], xj = P[j][0], zj = P[j][1];
        const r = d + 1e-6;
        if (Math.max(xi, xj) < x - r || Math.min(xi, xj) > x + r || Math.max(zi, zj) < z - r || Math.min(zi, zj) > z + r) continue;
        const ex = xj - xi, ez = zj - zi, t = Math.max(0, Math.min(1, ((x - xi) * ex + (z - zi) * ez) / (ex * ex + ez * ez)));
        d = Math.min(d, Math.hypot(x - xi - ex * t, z - zi - ez * t));
      }
      best = Math.max(best, d);
    }
    return best;
  };
  const land = (x, z) => {
    const h = hills(x, z) + reliefAt(x, z) - moatSink(x, z);
    if (!wards.length) return h;
    const k = H.smooth(0, SINK, inside(x, z));
    return k ? h + (Math.min(h - 2.5, softAt(x, z) + ditchAt(x, z) - 3.5) - h) * k : h;
  };
  // A pack's rivers cut their beds and the cliffs of their falls (engine/rivers.js).

  const height = (x, z) => shapeLand(x, z, channel(x, z, land(x, z)));

  const N = wards.length ? 440 : 220, geo = new THREE.PlaneGeometry(L.size, L.size, N, N).rotateX(-Math.PI / 2).translate(cx, 0, cz);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = height(x, z), k = hills(x, z) / L.height, n = vnoise(x / 60, z / 60);
    pos.setY(i, y);
    const c = k > .7 ? L.rock.map((v, j) => H.lerp(L.high[j], v, H.smooth(.7, .95, k))) : L.low.map((v, j) => H.lerp(v, L.high[j], H.smooth(.05, .5, k)));
    col.set(c.map(v => v * (.85 + .3 * n)), i * 3);
  }

  // With a fall, ground steeper than 1 in 1 shows bare rock.

  if (FALLS.length) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * (N + 1) + i, cell = L.size / N, k = H.smooth(.9, 1.6, Math.max(Math.abs(pos.getY(a + 1) - pos.getY(a)), Math.abs(pos.getY(a + N + 1) - pos.getY(a))) / cell);
    if (k) col.set(L.rock.map((v, c) => H.lerp(col[a * 3 + c], v * .85, k)), a * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true,
    polygonOffsetFactor: 4, polygonOffsetUnits: 4 }));
  group.add(ground);

  // look.country paints fields over the land and adds hedges, trees and farms (engine/country.js). They stand on
  // the ground as drawn, read from the grid's triangles.

  if (COUNTRY) {
    const cell = L.size / N, x0 = cx - L.size / 2, z0 = cz - L.size / 2;

    // The slope at each grid point is the steeper of its two edges along x and along z, so both points of a steep
    // cell count as steep. slope(x, z) reads it back bilinearly.

    const SL = new Float32Array((N + 1) * (N + 1)), Y = k => pos.getY(k);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const a = j * (N + 1) + i, e = (b, ok) => ok ? Math.abs(Y(b) - Y(a)) : 0;
      SL[a] = Math.hypot(Math.max(e(a - 1, i > 0), e(a + 1, i < N)), Math.max(e(a - N - 1, j > 0), e(a + N + 1, j < N))) / cell;
    }
    const grid = (x, z) => {
      const fx = Math.min(N - 1e-6, Math.max(0, (x - x0) / cell)), fz = Math.min(N - 1e-6, Math.max(0, (z - z0) / cell));
      const i = Math.floor(fx), j = Math.floor(fz);
      return [fx - i, fz - j, j * (N + 1) + i];
    };
    buildCountry(H, group, ground.material, (x, z) => {
      const [u, v, a] = grid(x, z);
      return u + v < 1 ? Y(a) + (Y(a + 1) - Y(a)) * u + (Y(a + N + 1) - Y(a)) * v
        : Y(a + N + 2) + (Y(a + N + 1) - Y(a + N + 2)) * (1 - u) + (Y(a + 1) - Y(a + N + 2)) * (1 - v);
    }, (x, z) => {
      const [u, v, a] = grid(x, z);
      return H.lerp(H.lerp(SL[a], SL[a + 1], u), H.lerp(SL[a + N + 1], SL[a + N + 2], u), v);
    });
  }

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

  // Hedges line the country roads for their first 700 m, 4 m out on each side, in 6 m lengths with gaps for gates.

  const hedges = [], hr = H.rng(H.hash(77, 5));
  for (const R of H.CITY.roads ?? []) {
    let run = 0;
    for (let i = 1; i < R.length; i++) {
      const [ax, az] = R[i - 1], [bx, bz] = R[i], L = Math.hypot(bx - ax, bz - az) || 1;
      run += L;
      if (run > 700) break;
      const tx = (bx - ax) / L, tz = (bz - az) / L;
      for (const side of [-1, 1]) {
        if (hr() < .15) continue;
        const x = (ax + bx) / 2 - tz * side * 4, z = (az + bz) / 2 + tx * side * 4;
        hedges.push([x, height(x, z), z, L * .95, Math.atan2(tx, tz)]);
      }
    }
  }
  if (hedges.length) {
    const hedge = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 1.6, 1), new THREE.MeshStandardMaterial({ color: new THREE.Color(...L.tree), roughness: .95 }), hedges.length);
    const o = new THREE.Object3D();
    hedges.forEach(([x, y, z, len, ry], i) => {
      o.position.set(x, y + .7, z); o.rotation.set(0, ry, 0); o.scale.set(1, .8 + hr() * .5, len); o.updateMatrix();
      hedge.setMatrixAt(i, o.matrix);
    });
    group.add(hedge);
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
    if (d < L.pad + 30 || vnoise(x / 400 + 5, z / 400 + 1) < .45 || onRoad(x, z) || (nearRiver(x, z)?.d ?? 1e9) < 30) continue;
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
