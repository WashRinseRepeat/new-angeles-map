// Easter eggs on the sea, in the jungle and on the mountain. None has a label or a card.
// A bioroid fishes off an old pier at Manta, a Beanstalk car lies half sunk off Nihongai, a hopper has crashed in the
// jungle, jaguar eyes watch from the trees, a camp glows near Cayambe's snowline, and something lives in the Estero
// Salado. The city's own eggs are in kits/eggs.js.

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const WATER_Y = .12;

export function eggs(H, land, SEA) {
  const { THREE } = H;
  const r = H.rng(H.hash(6066, 1313)), out = [], anim = [];
  const solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, metalness: .25 });
  const lit = new THREE.MeshBasicMaterial({ vertexColors: true });
  const GEO = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(.5, .5, 1, 12), cone: new THREE.CylinderGeometry(0, .5, 1, 4),
    ball: new THREE.SphereGeometry(.5, 12, 8) };

  // A part is [shape, sx, sy, sz, x, y, z, rgb, lit, rx, ry, rz] in the egg's own frame.

  const part = ([shape, sx, sy, sz, x, y, z, rgb, , rx = 0, ry = 0, rz = 0]) => {
    const g = GEO[shape].clone().scale(sx, sy, sz).applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'))).translate(x, y, z).toNonIndexed();
    g.deleteAttribute('uv');
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(rgb).flat(), 3));
    return g;
  };
  const model = (parts, x, y, z, ry = 0) => {
    const grp = new THREE.Group();
    for (const [want, mat] of [[0, solid], [1, lit]]) {
      const list = parts.filter(p => !!p[8] === !!want);
      if (list.length) grp.add(new THREE.Mesh(mergeGeometries(list.map(part)), mat));
    }
    grp.position.set(x, y, z); grp.rotation.y = ry;
    out.push(grp);
    return grp;
  };

  // A soft additive disc of light on the water or the ground.

  const glowTex = H.canvasTexture(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  const lightPool = (x, y, z, rad, rgb) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(rad, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(...rgb), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(x, y, z); m.renderOrder = 2;
    out.push(m);
    return m;
  };
  const blinker = (x, y, z, s, rgb, on) => {
    const m = new THREE.Mesh(GEO.ball, new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb) }));
    m.position.set(x, y, z); m.scale.setScalar(s);
    out.push(m); anim.push(t => { m.visible = on(t); });
  };

  // Nearest point on the traced coast and the unit direction out to sea.

  const shore = (x, z) => {
    let best = null;
    for (const L of H.CITY.coast ?? []) for (let i = 1; i < L.length; i++) {
      const [ax, az] = L[i - 1], [bx, bz] = L[i], ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
      const px = ax + ex * t, pz = az + ez * t, d = Math.hypot(x - px, z - pz), l = Math.hypot(ex, ez);
      if (!best || d < best.d) best = { d, x: px, z: pz, nx: ez / l, nz: -ex / l };
    }
    if (land.real(best.x + best.nx * 120, best.z + best.nz * 120) > 0) { best.nx *= -1; best.nz *= -1; }
    return best;
  };

  // The nearest point to a target that passes a test, searched on rings out to a radius.

  const near = (tx, tz, max, ok) => {
    for (let rad = 0; rad <= max; rad += 25) for (let k = 0, n = Math.max(1, Math.round(rad / 8)); k < n; k++) {
      const a = k / n * 6.283, x = tx + Math.cos(a) * rad, z = tz + Math.sin(a) * rad;
      if (ok(x, z)) return [x, z];
    }
    return null;
  };
  const jungle = (lo, hi) => (x, z) => { const d = land.cityDist(x, z); return d > lo && d < hi && land.real(x, z) > 4; };
  const wx = (u, v) => H.mapToWorld([u, v]);

  // ---------- the fishing bioroid: an old pier off southern Manta, half its planks gone ----------

  {
    const s = shore(...wx(455, 1200)), ry = Math.atan2(s.nx, s.nz), L = 70, P = [];
    for (let k = 0; k < L; k += 3) if (k < 40 || r() > .2) P.push(['box', 3, .3, 2.7, 0, 1.2, k + 1.5, [.16, .12, .08], 0, 0, (r() - .5) * .04]);
    for (let k = 0; k <= L; k += 6) for (const s2 of [-1.3, 1.3]) P.push(['cyl', .35, 5, .35, s2, -1.3, k, [.1, .08, .06]]);
    P.push(['box', .5, .6, .4, 0, 1.7, L - .6, [.3, .32, .34]], ['box', .35, .38, .35, 0, 2.25, L - .5, [.5, .5, .52]],
      ['box', .45, .2, .9, 0, 1.25, L + .3, [.28, .3, .32]], ['box', .4, .9, .2, 0, .8, L + .75, [.28, .3, .32]],
      ['box', .05, .04, .02, -.08, 2.28, L - .32, [.4, 1.6, 1.8], 1], ['box', .05, .04, .02, .08, 2.28, L - .32, [.4, 1.6, 1.8], 1],
      ['box', .06, .06, 5.2, 0, 3.4, L + 1.9, [.1, .1, .1], 1, -.55], ['box', .02, 5.4, .02, 0, .9, L + 4.2, [.5, .5, .5]],
      ['box', .3, .3, .3, 0, -1.9, L + 4.2, [1.6, .25, .1], 1], ['box', .4, .5, .4, .9, 1.6, L - 1.4, [1.5, .9, .4], 1]);
    model(P, s.x - s.nx * 4, 0, s.z - s.nz * 4, ry);
    lightPool(s.x + s.nx * (L - 5), SEA + .2, s.z + s.nz * (L - 5), 9, [.12, .07, .03]);
  }

  // ---------- a Beanstalk car, half sunk in the bay off Nihongai, its beacon still blinking ----------

  {
    const p = near(...wx(235, 740), 600, (x, z) => land.real(x, z) < -20 && shore(x, z).d > 250);
    if (p) {
      // The car's axis tilts 55 degrees up toward its heading. at(t) is the point t metres along it from the middle.

      const [x, z] = p, ry = r() * 6.3, T = .95, at = t => [0, t * Math.cos(T), t * Math.sin(T)];
      const P = [['cyl', 10, 24, 10, 0, 0, 0, [.5, .52, .55], 0, T], ['cyl', 10.3, 1.4, 10.3, ...at(4), [.25, .55, .6], 1, T],
        ['cyl', 6, 1.5, 6, ...at(12.6), [.3, .3, .32], 0, T]];
      for (let k = 0; k < 5; k++) P.push(['box', 1 + r() * 2, .4, 1 + r() * 3, (r() - .5) * 30, -1.8 - (SEA - 1), (r() - .5) * 30, [.4, .4, .42], 0, 0, r() * 3]);
      model(P, x, SEA - 1, z, ry);
      const [, by, bz] = at(13.6);
      blinker(x + Math.sin(ry) * bz, SEA - 1 + by, z + Math.cos(ry) * bz, .9, [1.9, .1, .05], t => t % 1.6 < .3);
      lightPool(x, SEA + .2, z, 22, [.03, .07, .08]);
    }
  }

  // ---------- a crashed hopper on a jungle slope, smoking, its strobe still going ----------

  {
    const p = near(...wx(860, 960), 900, jungle(90, 260));
    if (p) {
      const [x, z] = p, y = land.height(x, z), P = [['box', 5, 2.2, 9, 0, 2.1, 0, [.22, .26, .32], 0, .12, 0, .24], ['box', 3.6, 1, 3, .2, 3.3, 2.6, [.3, .55, .7], 1, .12, 0, .24],
        ['cyl', 1.6, 3, 1.6, 3.4, 1.4, -2.5, [.15, .15, .17], 0, 1.4, 0, .5], ['cyl', 1.6, 3, 1.6, -4.5, .3, 3, [.15, .15, .17], 0, .3, .6, 1.3],
        ['cyl', 22, .1, 22, 0, .05, 0, [.02, .018, .015]], ['box', 2, .4, .6, -6, .3, -4, [.2, .2, .22], 0, 0, .8]];
      const g = model(P, x, y, z, r() * 6.3);
      blinker(x, y + 4.4, z, .35, [1.9, 1.9, 1.8], t => t % 1.1 < .08);
      const smoke = new THREE.InstancedMesh(GEO.ball, new THREE.MeshBasicMaterial({ color: new THREE.Color(.09, .09, .09), transparent: true, opacity: .22, depthWrite: false }), 6);
      const o = new THREE.Object3D();
      anim.push(t => {
        for (let k = 0; k < 6; k++) {
          const q = (t * .08 + k / 6) % 1;
          o.position.set(x + q * 14, y + 3 + q * 40, z + q * 6); o.scale.setScalar(3 + q * 10); o.updateMatrix();
          smoke.setMatrixAt(k, o.matrix);
        }
        smoke.instanceMatrix.needsUpdate = true;
      });
      smoke.frustumCulled = false;
      out.push(smoke);
      g.userData.egg = 'hopper';
    }
  }

  // ---------- jaguar eyes in the trees by the La Costa fields, blinking now and then ----------

  for (const [u, v, k] of [[700, 1240, 0], [720, 1180, 1]]) {
    const p = near(...wx(u, v), 900, jungle(14, 40));
    if (!p) continue;
    const [x, z] = p, y = land.height(x, z) + .7, a = r() * 6.3, ph = r() * 9;
    for (const s of [-.07, .07]) blinker(x + Math.cos(a) * s, y, z - Math.sin(a) * s, .07, [.9, 1.7, .35], t => (t + ph + k * 4) % 9 > .25);
  }

  // ---------- a camp near Cayambe's snowline: a tent, a fire and a telescope on the top of the Beanstalk ----------

  {
    const [cx, cz] = wx(1150, 110);
    let best = null;
    for (let i = -60; i <= 60; i++) for (let j = -60; j <= 60; j++) {
      const x = cx + i * 40, z = cz + j * 40, e = land.real(x, z);
      if (e < 4400 || e > 4600) continue;
      const slope = Math.abs(land.real(x + 30, z) - land.real(x - 30, z)) + Math.abs(land.real(x, z + 30) - land.real(x, z - 30));
      const score = slope + Math.hypot(x - H.CENTRE.x, z - H.CENTRE.y) * .02;
      if (!best || score < best.score) best = { x, z, score };
    }
    if (best) {
      const { x, z } = best, y = land.height(x, z), to = Math.atan2(H.CENTRE.x - x, H.CENTRE.y - z), P = [
        ['cone', 3.4, 2.2, 3.4, 0, 1.1, 0, [.55, .22, .06], 0, 0, .785], ['cone', 3, 1.8, 3, 0, 1, 0, [.5, .28, .1], 1, 0, .785],
        ['box', .7, .3, .7, 3.4, .15, 1, [1.9, .7, .15], 1], ['box', .4, .6, .4, 3.4, .5, 1, [2, 1, .3], 1],
        ['box', .08, 1.5, .08, -2.4, .75, 2.2, [.2, .2, .2]], ['box', .08, 1.5, .08, -2.8, .75, 1.8, [.2, .2, .2]],
        ['cyl', .3, 2, .3, -2.6, 1.9, 2.4, [.65, .65, .68], 0, -.9]];
      model(P, x, y, z, to);
      lightPool(x + Math.sin(to) * 1 + Math.cos(to) * 3.4, y + .2, z + Math.cos(to) * 1 - Math.sin(to) * 3.4, 12, [.2, .08, .02]);
    }
  }

  // ---------- the Estero Salado serpent: three humps glide on a slow circle, and once a minute a long neck rises ----------

  {
    const [X, Z] = [1430, 3960], RAD = 28, skin = new THREE.MeshStandardMaterial({ color: new THREE.Color(.03, .06, .04), roughness: .35, metalness: .15 });
    const beast = new THREE.Group(), neck = new THREE.Group();
    for (const [dx, R] of [[-6.5, 2.2], [-12.5, 2.5], [-18, 1.8]]) {
      const hump = new THREE.Mesh(new THREE.TorusGeometry(R, .72, 8, 18, Math.PI), skin);
      hump.position.x = dx; beast.add(hump);
    }
    const curve = new THREE.CatmullRomCurve3([[0, -2, 0], [.8, 2.5, 0], [1.6, 5.6, 0], [2.6, 7.4, 0]].map(p => new THREE.Vector3(...p)));
    neck.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, .75, 10), skin));
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skin);
    head.scale.set(1.9, .85, .95); head.position.set(3.9, 7.6, 0); neck.add(head);
    for (const s of [-.55, .55]) {
      const eye = new THREE.Mesh(GEO.ball, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.5, .35) }));
      eye.scale.setScalar(.22); eye.position.set(4.9, 8, s); neck.add(eye);
    }
    beast.add(neck);
    out.push(beast);
    const ring = lightPool(X, WATER_Y + .05, Z, 1, [.12, .16, .16]);
    anim.push(t => {
      const q = t % 60, up = H.smooth(30, 33.5, q) * (1 - H.smooth(41, 44.5, q)), a = t * .035;
      beast.position.set(X + Math.cos(a) * RAD, WATER_Y - 9 * (1 - up), Z + Math.sin(a) * RAD);
      beast.rotation.y = -a - Math.PI / 2;
      neck.rotation.z = Math.sin(t * .7) * .06;
      neck.rotation.y = Math.sin(t * .4) * .25;
      ring.position.set(beast.position.x, WATER_Y + .05, beast.position.z);
      ring.scale.setScalar(4 + 16 * H.smooth(30, 36, q) * (1 - H.smooth(44, 47, q)));
      ring.visible = q > 29 && q < 47;
    });
  }

  for (const m of out) m.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.userData.noTile = true; } });
  const update = t => { for (const f of anim) f(t); };
  update(0);
  return { meshes: out, update };
}
