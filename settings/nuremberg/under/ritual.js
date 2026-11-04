// The Walpurgissaal and the Lair of the Lindworm, the deepest showpieces of the catacombs.
// The Walpurgissaal is a Gothic hall church hewn under St. Lorenz. Thirteen witches keep the sabbath round a sigil,
// and the Black Goat rises out of it. The Wurmgang winds down from the hall's east side to the cavern under the
// Lindwurmdom, where the lindworm slept before the masons drove the cathedral's piers through its roof.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const VIOLET = [1.1, .35, 1.6], GHOUL = [.45, 1.6, .55], EMBER = [1.7, .5, .15], TORCH = [1.7, .95, .45];
const uT = { value: 0 };

// ---------- geometry helpers ----------

// A tapered rod from a to b, radius r0 at a and r1 at b.

function bar(a, b, r0, r1 = r0, seg = 8) {
  const A = V(...a), dir = V(...b).sub(A), len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false).translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.normalize()));
  return g.translate(A.x, A.y, A.z);
}

// A tube along a smooth curve through pts. rad(u) sets the radius at u from 0 to 1, and squash flattens it.

function tube(pts, rad, tub = 24, seg = 10, squash = 1) {
  const path = new THREE.CatmullRomCurve3(pts.map(p => V(...p)));
  const g = new THREE.TubeGeometry(path, tub, 1, seg, false), pos = g.attributes.position;
  for (let i = 0; i <= tub; i++) {
    const c = path.getPointAt(i / tub), r = rad(i / tub);
    for (let j = 0; j <= seg; j++) {
      const k = i * (seg + 1) + j;
      pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * r, c.y + (pos.getY(k) - c.y) * r * squash, c.z + (pos.getZ(k) - c.z) * r);
    }
  }
  return g;
}
const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// A hooded witch, about 2.2 m tall, facing local +x with her arms raised.

function witchGeo() {
  return mergeGeometries([
    lathe([[.001, 0], [.62, 0], [.56, .35], [.44, .95], [.37, 1.32], [.44, 1.46], [.3, 1.6], [.001, 1.64]], 12),
    new THREE.SphereGeometry(.3, 10, 8).scale(1.05, 1.2, 1).translate(.02, 1.8, 0),
    bar([-.05, 1.98, 0], [-.34, 2.26, 0], .17, .01, 6),
    ...[-1, 1].map(s => bar([.02, 1.42, s * .33], [.42, 1.95, s * .45], .14, .1, 6)),
  ]);
}

// The Black Goat, about 20 m tall at scale 1, facing local -x: a shroud, a goat's skull, horns and clawed arms.

function goatGeo() {
  const parts = [
    lathe([[5.6, 0], [4.4, 1.4], [3.1, 3.8], [2.5, 6], [2.9, 8], [3.9, 9.8], [3.6, 10.9], [2, 11.9], [1.2, 12.7]], 28),
    new THREE.SphereGeometry(1, 18, 12).scale(1.5, 1.25, 1.15).translate(-.6, 13.7, 0),
    bar([-1.4, 13.5, 0], [-3.5, 12.3, 0], .95, .45, 12),
    bar([-2.9, 12.1, 0], [-2.2, 9.2, 0], .55, .02, 8),
  ];
  for (const s of [-1, 1]) {
    parts.push(bar([-.3, 14, s * .9], [.2, 13.6, s * 2.4], .3, .05, 6));
    parts.push(tube([[-.4, 14.5, s * .55], [.1, 16.4, s * 1.2], [1.1, 18.2, s * 2.3], [2.6, 19.3, s * 3.6], [4.2, 19.4, s * 4.6]], u => .62 * (1 - u) + .05, 30, 10));
    parts.push(tube([[.2, 10.6, s * 3.3], [-.6, 11.4, s * 5.8], [-1.8, 13, s * 8], [-3, 14.6, s * 9.2]], u => .95 - .6 * u, 20, 10));
    for (let f = -1.5; f <= 1.5; f++) parts.push(bar([-3, 14.6, s * 9.2], [-4.2 + .3 * f, 16.1 - .1 * Math.abs(f), s * (9.8 + .45 * f)], .2, .02, 5));
  }
  return mergeGeometries(parts);
}

// ---------- materials ----------

const GN = `
  float gh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float gn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }
`;
const VS = `
  varying vec3 vW, vN, vL; varying vec2 vUv;
  void main() {
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = modelMatrix * instanceMatrix;
    #endif
    vec4 w = m * vec4(position, 1.);
    vW = w.xyz; vN = normalize(mat3(m) * normal); vL = position; vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const END = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  }`;

// A shader material that hides above the dungeon's cut like D.mat. body is the fragment main's inside.

function shader(D, uniforms, decl, body, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uCut: D.cut, uT, ...uniforms },
    transparent: !o.opaque, depthWrite: !!o.opaque, side: THREE.DoubleSide,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: VS,
    fragmentShader: `uniform float uCut, uT; varying vec3 vW, vN, vL; varying vec2 vUv; ${decl}\n${GN}\nvoid main() {\nif (vW.y > uCut) discard;\n${body}\n${END}`,
  });
}

// Ghost light: a dim streaming body with a bright rim, fading in above uBase. uAmp scales it.

function spectral(D, color, rim, base = -1e5, fade = 1) {
  return shader(D, { uColor: { value: new THREE.Color(...color) }, uRim: { value: new THREE.Color(...rim) }, uAmp: { value: 1 }, uBase: { value: base }, uFade: { value: fade } },
    'uniform float uAmp, uBase, uFade; uniform vec3 uColor, uRim;', `
    vec3 v = normalize(cameraPosition - vW), n = normalize(vN);
    float rim = pow(1. - abs(dot(n, v)), 2.);
    float s = gn(vec2(vW.x * .4 + vW.z * .3, vW.y * .35 - uT * .9)) * gn(vec2(vW.z * .5 - uT * .2, vW.y * .8 - uT * 1.7));
    vec3 c = (uColor * (.1 + .9 * s) + uRim * rim * (.6 + .6 * s)) * smoothstep(uBase, uBase + uFade, vW.y) * uAmp;
    gl_FragColor = vec4(c, 1.);`, { additive: true });
}

// The sabbath sigil, drawn on a plane of size uSize metres with its centre at uC from the plane's middle, scaled by uK.
// Rings, a turning pentagram with a ring at each point, a band of runes that turns the other way, and a wash of
// light over the whole plane that swells with each surge.

function sigil(D, size, centre = [0, 0], k = 1) {
  return shader(D, { uSize: { value: new THREE.Vector2(...size) }, uC: { value: new THREE.Vector2(...centre) }, uK: { value: k }, uPulse: { value: 0 }, uSurge: { value: 0 }, uSpin: { value: 0 }, uWash: { value: 1 } },
    `uniform vec2 uSize, uC; uniform float uK, uPulse, uSurge, uSpin, uWash;
    float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }
    float ln(float d, float w) { return 1. - smoothstep(w, w + fwidth(d) * 1.5 + .03, d); }`, `
    vec2 p = ((vUv - .5) * uSize - uC) / uK;
    float r = length(p), a = atan(p.y, p.x), L = 0., G = 0.;
    L += ln(abs(r - 8.4), .1) + ln(abs(r - 9.1), .06) + ln(abs(r - 11.4), .1) + ln(abs(r - 11.95), .05);
    G += ln(abs(r - 2.6), .08) + ln(abs(r - 3.), .04);
    for (int k = 0; k < 5; k++) {
      float a0 = -uSpin * .4 + float(k) * 1.2566;
      vec2 A = 8.4 * vec2(cos(a0), sin(a0)), B = 8.4 * vec2(cos(a0 + 2.5133), sin(a0 + 2.5133));
      L += ln(seg(p, A, B), .09) + ln(abs(length(p - A) - .9), .05);
      G += ln(abs(length(p - A * .2) - .35), .03);
    }
    float N = 40., ar = mod(a + uSpin, 6.2832) / 6.2832 * N, cell = floor(ar);
    vec2 q = vec2(fract(ar), (r - 9.3) / 1.9);
    if (q.y > .05 && q.y < .95) {
      vec2 g = vec2(q.x, (q.y - .05) / .9);
      float R = ln(seg(g, vec2(.5, .1), vec2(.5, .9)), .045);
      vec4 S[6] = vec4[6](vec4(.5, .15, .8, .4), vec4(.5, .15, .2, .4), vec4(.5, .5, .8, .75), vec4(.5, .5, .2, .75), vec4(.25, .3, .75, .3), vec4(.25, .7, .75, .55));
      for (int k = 0; k < 6; k++) if (gh(vec2(cell, float(k) * 3.7)) > .55) R = max(R, ln(seg(g, S[k].xy, S[k].zw), .045));
      G += R * (.55 + .45 * sin(uT * 2.3 + cell * 1.7));
    }
    float wave = uSurge * ln(abs(r - mod(uT * 9., 40.)), .5) * exp(-r / 25.);
    vec3 vi = vec3(1.1, .3, 1.7), gr = vec3(.4, 1.6, .5);
    vec3 c = vi * min(L, 1.) * (.8 + .7 * uPulse + uSurge) + gr * min(G, 1.) * (1.2 + uSurge)
      + vi * exp(-r * r / 18.) * (.5 + .6 * uPulse + uSurge)
      + (vi * .6 + gr * .25) * exp(-r / 20.) * (.12 + uSurge * .9) * uWash
      + gr * gn(p * .12 + uT * vec2(.03, -.05)) * .06 * exp(-r / 30.) * uWash + vi * wave;
    gl_FragColor = vec4(c, 1.);`, { additive: true });
}

// Billboard motes animated on the GPU. list holds [px, py, pz, pw, qx, qy, qz, qw] per mote. body is GLSL that sets
// p (position), s (size), a (alpha) and c (colour) from aP, aQ and uT.

function motes(D, list, body, o = {}) {
  const base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry(), add = o.additive !== false;
  g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
  g.setAttribute('aP', new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap(e => e.slice(0, 4))), 4));
  g.setAttribute('aQ', new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap(e => e.slice(4, 8))), 4));
  g.instanceCount = list.length;
  const m = new THREE.ShaderMaterial({
    uniforms: { uCut: D.cut, uT, uAmp: { value: 1 } },
    transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `
      attribute vec4 aP, aQ; uniform float uT, uAmp; varying vec2 vUv; varying vec3 vC; varying float vA, vY;
      void main() {
        vec3 p = aP.xyz, c = vec3(1.); float s = 1., a = 1.;
        ${body}
        vUv = uv; vC = c; vA = a; vY = p.y;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        gl_Position = projectionMatrix * viewMatrix * vec4(p + (right * position.x + up * position.y) * s, 1.);
      }`,
    fragmentShader: `
      uniform float uCut; varying vec2 vUv; varying vec3 vC; varying float vA, vY;
      void main() {
        if (vY > uCut) discard;
        float f = pow(max(0., 1. - length(vUv - .5) * 2.), ${o.soft ?? '2.'}) * vA;
        if (f < .003) discard;
        gl_FragColor = ${add ? 'vec4(vC * f, 1.)' : 'vec4(vC, f)'};
      ${END}`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  D.add(mesh);
  return m;
}

// ---------- shared furniture ----------

function blackCandle(D, x, y, z, o = {}) {
  const h = o.h ?? rnd(.4, .9);
  D.cyl(x, y, z, o.r ?? .09, h, 'iron', { seg: 6, rgb: [.05, .04, .05], jit: .2 });
  D.flame(x, y + h + .05, z, .2, o.rgb ?? [.9, 1.6, .7]);
  if (o.light !== false) D.light(x, y + h + .3, z, o.rgb ?? [.5, 1.1, .5], o.lr ?? 3.5);
}

// Four parallel claw gouges on a wall at (x, z), along the wall's direction (tx, tz). Fresh scoring shows pale rock.

function claws(D, x, y, z, tx, tz, len = 4.2) {
  D.frame(x, z, Math.atan2(-tz, tx), () => {
    for (let k = 0; k < 4; k++) D.slab(k * .45 - .7, y + k * .12, 0, len, .16, .14, -.55 + rnd(-.06, .06), 'rock', [.5, .45, .39]);
  });
}

function skull(D, x, y, z, rot = 0, s = 1) {
  D.geo(new THREE.IcosahedronGeometry(.14 * s, 0).scale(1.15, .9, .95), 'bone', { at: [x, y + .12 * s, z], rot });
}

// A cow's skeleton lying on its side, in a frame at (x, z).

function carcass(D, x, y, z, rot) {
  D.frame(x, z, rot, () => {
    for (let k = 0; k < 9; k++) D.box(k * .32 - 1.3, y, 0, .2, .18, .18, 'bone', { jit: .1 });
    for (let k = 0; k < 6; k++) D.arch(k * .3 - .7, y, 0, 1.3 - k * .08, .9 - k * .06, { rot: Math.PI / 2, thick: .07, depth: .09, segs: 6, mat: 'bone' });
    D.geo(new THREE.BoxGeometry(.6, .3, .32), 'bone', { at: [1.9, y + .15, 0] });
    for (const s of [-1, 1]) D.geo(bar([1.75, y + .3, s * .16], [1.55, y + .45, s * .62], .07, .02, 5), 'bone');
    for (let k = 0; k < 4; k++) D.geo(bar([rnd(-1.5, 1.5), y + .05, rnd(.6, 1.4)], [rnd(-1.5, 1.5), y + .05, rnd(.8, 1.6)], .06, .05, 5), 'bone');
  });
}

// A fallen knight: helm, breastplate, shield, sword and broken lance, scattered round (x, z).

function knight(D, x, y, z, rot) {
  const heraldry = [[.5, .08, .06], [.1, .15, .45], [.55, .45, .1], [.12, .3, .1]][Math.floor(Math.random() * 4)];
  D.frame(x, z, rot, () => {
    D.geo(new THREE.SphereGeometry(.22, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 'iron', { at: [0, y + .18, 0], rgb: [.32, .32, .34] });
    D.geo(new THREE.CylinderGeometry(.23, .23, .18, 8), 'iron', { at: [0, y + .09, 0], rgb: [.3, .3, .32] });
    D.geo(new THREE.CylinderGeometry(.27, .23, .55, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), 'iron', { at: [.8, y + .01, .2], rgb: [.3, .3, .32] });
    D.geo(new THREE.CylinderGeometry(.5, .45, .05, 10).rotateZ(.12), 'cloth', { at: [-.6, y + .1, .7], rgb: heraldry });
    D.box(.4, y, -.6, 1.15, .04, .1, 'iron', { rot: rnd(0, 3), rgb: [.4, .4, .42] });
    D.geo(bar([-2, y + .08, -1], [1.4, y + .08, -1.8], .06, .04, 5), 'wood');
    for (let k = 0; k < 5; k++) D.geo(bar([rnd(-.8, 1.2), y + .04, rnd(-.6, 1)], [rnd(-.8, 1.2), y + .04, rnd(-.6, 1)], .05, .04, 4), 'bone');
    skull(D, rnd(-.3, .3), y, rnd(.2, .5), rnd(0, 6));
  });
}

// ---------- the Walpurgissaal ----------

function walpurgis(D, Z) {
  const F = Z.floor, X0 = 55, X1 = 165, Z0 = 410, Z1 = 490, H = 20, CX = 97, CZ = 450, rows = [425, 475], cols = [];
  for (let x = 67; x < 160; x += 12) cols.push(x);

  // The hall: a hall church of three aisles, with a door north, a door west and a breach east into the Wurmgang.

  D.room(110, 450, F, X1 - X0, Z1 - Z0, H, { thick: 1.6, rgb: [.36, .32, .3], floorRgb: [.24, .22, .21],
    doors: [{ side: 'n', at: 0, w: 5, h: 9 }, { side: 'w', at: 0, w: 3.6, h: 6 }, { side: 'e', at: .8, w: 7, h: 10 }] });
  D.box(110, F + H - .6, Z0 - .8, X1 - X0 + 3.2, .6, 1.8, 'ashlar', { rgb: [.3, .27, .25] });
  D.box(110, F + H - .6, Z1 + .8, X1 - X0 + 3.2, .6, 1.8, 'ashlar', { rgb: [.3, .27, .25] });

  // Clustered columns: a core with eight shafts, a moulded base and a capital.

  const column = (x, z) => {
    D.box(x, F, z, 3.2, .6, 3.2, 'ashlar');
    D.cyl(x, F + .6, z, 1.55, .5, 'ashlar', { seg: 8, r1: 1.35 });
    D.cyl(x, F, z, 1, 13, 'ashlar', { seg: 12 });
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? 1.02 : 1.1; D.cyl(x + Math.cos(a) * rr, F + .6, z + Math.sin(a) * rr, k % 2 ? .26 : .38, 12.4, 'ashlar', { seg: 6 }); }
    D.cyl(x, F + 13, z, 1.45, .9, 'ashlar', { seg: 12, r1: 1.85 });
    D.box(x, F + 13.9, z, 3.8, .4, 3.8, 'ashlar');
  };
  const SP = F + 14.3;
  for (const z of rows) for (const x of cols) column(x, z);

  // Ribs: arcades along each row, ribs across the aisles to wall shafts, transverse and diagonal ribs over the nave.
  // The three bays over the circle stay open so the Goat can rise.

  for (const z of rows) for (let i = 0; i < cols.length - 1; i++) D.arch(cols[i] + 6, SP, z, 9.6, 4.3, { thick: .7, depth: 1 });
  for (const x of cols) for (const [zw, zc, s] of [[Z0, 417.5, 1], [Z1, 482.5, -1]]) {
    D.box(x, F, zw + s * .45, 1.4, 14.3, .9, 'ashlar');
    D.box(x, F + 13.3, zw + s * .6, 2, 1, 1.2, 'ashlar');
    D.arch(x, SP, zc, 15, 4.6, { rot: Math.PI / 2, thick: .6, depth: .8 });
  }
  const open = x => x > 80 && x < 114;
  for (const x of cols) if (!open(x - 1) && !open(x + 1)) D.arch(x, SP, 450, 50, 5.2, { rot: Math.PI / 2, thick: .75, depth: .9, segs: 13 });
  for (let i = 0; i < cols.length - 1; i++) {
    const xm = cols[i] + 6;
    if (open(xm)) continue;
    for (const s of [-1, 1]) D.arch(xm, SP, 450, Math.hypot(12, 50), 5.2, { rot: -Math.atan2(50 * s, 12), thick: .45, depth: .6, segs: 13 });
  }

  // Galleries along the north and south walls, on corbels, with balustrades, banners and stairs up from the west.

  for (const [gz, s] of [[411.75, 1], [488.25, -1]]) {
    const rz = gz + s * 1.6, y = F + 7.5;
    D.box(116.5, y - .5, gz, 95, .5, 3.5, 'ashlar');
    D.box(116.5, y + .9, rz, 95, .18, .32, 'ashlar');
    for (let x = 69.5; x < 164; x += 2) D.box(x, y, rz, .2, .9, .2, 'ashlar', { jit: .04 });
    for (let x = 72; x < 164; x += 4) D.box(x, y - 2.1, gz - s * .9, .8, 1.6, 1.6, 'ashlar');
    D.stairs(58, gz, F, y, 2.6, { walls: false });
    for (const x of cols) {
      const bx = x + 6;
      if (bx > 160) continue;
      D.box(bx, y - 4.4, rz + s * .22, 1.7, 4.3, .08, 'cloth', { rgb: [.24, .04, .07] });
      D.glow(bx, y - 3, rz + s * .27, .55, .55, .04, [.35, 1.2, .45], { pulse: .3 });
      blackCandle(D, x, y + 1.08, rz, { light: false });
      D.geo(witchGeo(), 'cloth', { at: [bx + 2.5, y, gz - s * .5], rot: -s * Math.PI / 2, rgb: [.07, .055, .08] });
    }

    // Lancets of green spirit light high on the walls between the vault shafts.

    for (const x of cols.slice(0, -1)) {
      const wz = (s > 0 ? Z0 : Z1) + s * .08;
      D.glow(x + 6, F + 10.5, wz, 1.5, 4.6, .12, [.2, .75, .32], { pulse: .15 });
      D.glow(x + 6, F + 15.1, wz, 1.05, .6, .12, [.2, .75, .32], { pulse: .15 });
      D.glow(x + 6, F + 15.7, wz, .55, .5, .12, [.2, .75, .32], { pulse: .15 });
      D.box(x + 6, F + 12.7, wz + s * .05, 1.6, .12, .14, 'iron');
    }
  }

  // Torches on the walls. Every third burns green, and those flare taller.

  let n = 0;
  const torch = (x, y, z, nx, nz) => { const g = n++ % 3 === 1; D.torch(x, y, z, nx, nz, g ? { rgb: GHOUL, size: .75, r: 9.5 } : { r: 9 }); };
  for (let x = 62; x < 164; x += 10) { torch(x, F + 2.6, Z0 + .15, 0, 1); torch(x + 3, F + 2.6, Z1 - .15, 0, -1); }
  for (let x = 74; x < 164; x += 12) { torch(x, F + 10, Z0 + .15, 0, 1); torch(x, F + 10, Z1 - .15, 0, -1); }
  for (let z = 416; z < 488; z += 10) {
    if (Math.abs(z - 450) > 4) torch(X0 + .15, F + 2.6, z, 1, 0);
    if (z < 476 && Math.abs(z - 450) > 6) torch(X1 - .15, F + 2.6, z, -1, 0);
  }
  for (const z of rows) for (const x of cols) torch(x, F + 3.2, z + (z < CZ ? 1.25 : -1.25), 0, z < CZ ? 1 : -1);

  // The circle: thirteen black candles, six braziers of green spirit fire, steady violet light from the sigil.

  for (let k = 0; k < 13; k++) { const a = (k + .5) / 13 * Math.PI * 2; blackCandle(D, CX + Math.cos(a) * 12.4, F, CZ + Math.sin(a) * 12.4, { h: .9, r: .11 }); }
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + .3; D.brazier(CX + Math.cos(a) * 17, F, CZ + Math.sin(a) * 17, { rgb: GHOUL, r: 13, size: 1.3 }); }
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; D.light(CX + Math.cos(a) * 6, F + 1, CZ + Math.sin(a) * 6, VIOLET.map(c => c * .8), 15, { flicker: 0 }); }
  D.light(CX, F + 9, CZ, VIOLET.map(c => c * .5), 22, { flicker: 0 });
  D.floorPoly(Array.from({ length: 48 }, (_, i) => { const a = i / 48 * Math.PI * 2; return [CX + Math.cos(a) * 12.6, CZ + Math.sin(a) * 12.6]; }), F + .02, 'flag', { rgb: [.13, .11, .13] });

  // The dais in the east: steps, the black altar with its cloth, skull and candles, and a stele bearing the sigil.

  D.box(147, F, 450, 18, 1.5, 32, 'ashlar', { rgb: [.3, .27, .26] });
  D.stairs(135.8, 450, F, F + 1.5, 14, { walls: false });
  const top = F + 1.5;
  D.box(147, top, 450, 2.2, 1.1, 4.4, 'rock', { rgb: [.07, .065, .07] });
  D.box(147, top + 1.1, 450, 2.6, .06, 4.8, 'cloth', { rgb: [.3, .03, .06] });
  D.box(145.75, top + .3, 450, .05, .85, 3.6, 'cloth', { rgb: [.3, .03, .06] });
  skull(D, 147, top + 1.16, 450, 0, 2.2);
  for (const s of [-1, 1]) D.geo(bar([147.1, top + 1.5, 450 + s * .15], [147.4, top + 2, 450 + s * .55], .06, .01, 5), 'bone');
  D.cyl(147, top + 1.16, 448.4, .12, .35, 'gold', { seg: 8, r1: .2 });
  D.box(146.8, top + 1.16, 451.6, .7, .04, .08, 'iron', { rot: .4, rgb: [.5, .5, .52] });
  for (const dz of [-2, -1.3, 1.3, 2]) blackCandle(D, 147.6, top + 1.16, 450 + dz, { h: .5, light: dz === 2 || dz === -2, lr: 5 });
  D.box(153, top, 450, 1.2, 9, 7, 'rock', { rgb: [.08, .07, .08] });
  for (const [x, z] of [[140, 436], [140, 464], [154.5, 436], [154.5, 464]]) D.brazier(x, top, z, { rgb: [1.8, .45, .2], r: 12 });
  for (let k = 0; k < 14; k++) skull(D, 139 + rnd(-.6, .6), F, 436 + k * 2 + rnd(-.4, .4), rnd(0, 6), 1.2);
  const stele = new THREE.Mesh(new THREE.PlaneGeometry(6, 6).rotateY(-Math.PI / 2), sigil(D, [6, 6], [0, 0], .23));
  stele.position.set(152.37, top + 5, 450);
  D.add(stele);
  D.light(150, top + 5, 450, VIOLET.map(c => c * .6), 9, { flicker: 0 });

  // The cauldron in the west, green and bubbling over a fire, with bones heaped and brooms leaning on the wall.

  D.cyl(70, F + .6, 450, 1.65, 1.6, 'iron', { seg: 16, r1: 1.9, top: false, rgb: [.1, .1, .11] });
  D.cyl(70, F + .6, 450, 1.55, 1.5, 'iron', { seg: 16, r1: 1.8, inward: true, rgb: [.1, .1, .11] });
  for (let k = 0; k < 3; k++) { const a = k * 2.09; D.geo(bar([70 + Math.cos(a) * 1.3, F + .9, 450 + Math.sin(a) * 1.3], [70 + Math.cos(a) * 1.8, F, 450 + Math.sin(a) * 1.8], .12, .1, 5), 'iron'); }
  D.flame(70, F + .05, 450, 1, [1.9, .7, .25]);
  D.light(70, F + .6, 450, TORCH, 8);
  D.light(70, F + 3.5, 450, GHOUL.map(c => c * .7), 9, { flicker: 0 });
  const brew = D.add(new THREE.Mesh(new THREE.CircleGeometry(1.72, 24).rotateX(-Math.PI / 2), D.mat(0, { emissive: new THREE.Color(.25, 1.3, .35), additive: true, opacity: .9 })));
  brew.position.set(70, F + 2.0, 450);
  const bubbles = [];
  for (let k = 0; k < 40; k++) bubbles.push([70, F + 2, 450, rnd(0, 1.5), rnd(.3, .7), Math.random(), 0, 0]);
  motes(D, bubbles, `
    float l = fract(uT * aQ.x + aQ.y), an = aQ.y * 44.;
    p += vec3(cos(an) * aP.w, l * 2.4, sin(an) * aP.w);
    s = .25 + l * .5; a = (1. - l) * .8; c = vec3(.35, 1.4, .45);`);
  for (let k = 0; k < 9; k++) {
    const z = 418 + k * 1.1;
    D.geo(bar([X0 + .3, F, z], [X0 + 1.3, F + 2.8, z + .2], .04, .035, 5), 'wood');
    D.geo(new THREE.ConeGeometry(.25, .9, 6), 'dirt', { at: [X0 + .5, F + .45, z], rgb: [.5, .42, .22] });
  }
  for (const [x, z] of [[60, 484], [62, 416], [80, 487]]) for (let k = 0; k < 22; k++) {
    const a = rnd(0, 6.3), r = rnd(0, 2.2);
    if (k % 3) D.geo(bar([x + Math.cos(a) * r, F + rnd(0, .5), z + Math.sin(a) * r], [x + Math.cos(a + 1) * r, F + rnd(0, .4), z + Math.sin(a + 1) * r], .06, .05, 4), 'bone');
    else skull(D, x + Math.cos(a) * r * .8, F + rnd(0, .3), z + Math.sin(a) * r * .8, a);
  }

  // The north passage: an ossuary corridor of skull shelves under ribs. The west passage: a plain torchlit tunnel.

  D.tunnel([[110, F, 375], [110, F, 409.6]], { w: 5, h: 9, torches: 7, torchRgb: GHOUL, rgb: [.34, .3, .28] });
  for (let z = 379; z < 408; z += 5) D.arch(110, F + 6, z, 5.6, 2.6, { thick: .5, depth: .7 });
  for (const s of [-1, 1]) for (const y of [F + 1.2, F + 2.3]) {
    D.box(110 + s * 2.25, y - .12, 392, .5, .12, 33, 'ashlar');
    for (let z = 376.3; z < 408.5; z += .62) if (Math.random() < .6) skull(D, 110 + s * 2.2, y, z, s > 0 ? Math.PI : 0);
  }
  D.tunnel([[Z.anchors.west[0], F, 450], [X0 - .5, F, 450]], { w: 3.6, h: 6, torches: 8, rgb: [.34, .3, .28] });
  for (let x = 20; x < 54; x += 6) D.arch(x, F + 4, 450, 4.2, 1.8, { rot: Math.PI / 2, thick: .45, depth: .6 });

  // The breach east: broken ashlar and rubble round the hole the worm left.

  for (let k = 0; k < 26; k++) {
    const s = k % 2 ? 1 : -1, z = 482 + s * rnd(3.4, 6), x = rnd(160, 172);
    D.box(x, F, z, rnd(.6, 1.6), rnd(.4, 1.8), rnd(.6, 1.4), k % 3 ? 'ashlar' : 'rock', { rot: rnd(0, 3) });
  }

  D.torch(164.85, F + 3, 476.4, -1, 0, { rgb: GHOUL, size: .75 });
  D.torch(164.85, F + 3, 487.6, -1, 0, { rgb: GHOUL, size: .75 });

  // The sabbath sigil and the light that washes the hall.

  const floorSig = sigil(D, [X1 - X0, Z1 - Z0], [CX - 110, CZ - 450], 1);
  const sigMesh = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0).rotateX(-Math.PI / 2), floorSig);
  sigMesh.position.set(110, F + .05, 450);
  sigMesh.renderOrder = 2;
  D.add(sigMesh);

  // The thirteen witches round the circle, and their green eyes.

  const robe = D.mat(0x0b0610, { lift: .4, emissive: 0x050108 });
  const eyes = D.mat(0, { emissive: new THREE.Color(.8, 2.6, 1) });
  const witches = D.add(new THREE.InstancedMesh(witchGeo(), robe, 13));
  const eyeGeo = mergeGeometries([-1, 1].map(s => new THREE.SphereGeometry(.035, 6, 4).translate(.3, 1.8, s * .085)));
  const witchEyes = D.add(new THREE.InstancedMesh(eyeGeo, eyes, 13));
  witches.frustumCulled = witchEyes.frustumCulled = false;
  const dummy = new THREE.Object3D(), WR = 13.6;

  // The Black Goat: a shroud, a horned skull, clawed arms, burning eyes and a flame between the horns.

  const goatMat = spectral(D, [.2, .08, .38], [.3, .85, .5], F, 6);
  const goat = new THREE.Group();
  goat.add(new THREE.Mesh(goatGeo(), goatMat));
  const goatEyes = D.mat(0, { emissive: new THREE.Color(3, .5, .15), additive: true, opacity: 1 });
  goat.add(new THREE.Mesh(mergeGeometries([-1, 1].map(s => new THREE.SphereGeometry(.28, 8, 6).translate(-2.05, 13.95, s * .62))), goatEyes));
  const crown = D.mat(0, { emissive: new THREE.Color(.7, 1.8, .9), additive: true, opacity: .8 });
  goat.add(new THREE.Mesh(new THREE.ConeGeometry(.55, 2.6, 10).translate(.1, 16.4, 0), crown));
  goat.position.set(CX, F, CZ);
  goat.traverse(o => { o.frustumCulled = false; o.renderOrder = 3; });
  D.add(goat);

  // Wisps orbit the columns and drift over the hall, each a head with a trail of five fading motes.

  const wisps = [];
  const wisp = (cx, cz, r, sp) => { const ph = rnd(0, 6.3), sd = Math.random(); for (let k = 0; k < 6; k++) wisps.push([cx, F, cz, r, sp, ph, k, sd]); };
  for (const z of rows) for (const x of cols) wisp(x, z, rnd(2.4, 3.6), rnd(.5, .9) * (Math.random() < .5 ? -1 : 1));
  for (let k = 0; k < 10; k++) wisp(CX + rnd(-10, 30), CZ + rnd(-8, 8), rnd(14, 30), rnd(.08, .18) * (k % 2 ? 1 : -1));
  const wispMat = motes(D, wisps, `
    float ang = uT * aQ.x + aQ.y - aQ.z * .2 * sign(aQ.x);
    float rr = aP.w * (1. + .25 * sin(uT * .37 + aQ.w * 12.));
    float h = aP.y + 7. + 4.5 * sin(uT * .21 + aQ.w * 6.28) + 1.2 * sin(ang * 2. + aQ.w * 9.);
    p = vec3(aP.x + cos(ang) * rr, h, aP.z + sin(ang) * rr);
    float k = 1. - aQ.z / 6.;
    s = 1.7 * k * (.85 + .3 * sin(uT * 6. + aQ.w * 30.));
    a = k * k * (.55 + .45 * sin(uT * 2.3 + aQ.w * 40.)) * uAmp;
    c = mix(vec3(.35, 1.2, .7), vec3(.9, .45, 1.5), step(.6, aQ.w));`);

  // Spirit motes rise out of the circle.

  const rise = [];
  for (let k = 0; k < 140; k++) { const a = rnd(0, 6.3), r = Math.sqrt(Math.random()) * 9; rise.push([CX + Math.cos(a) * r, F, CZ + Math.sin(a) * r, 0, rnd(.06, .16), Math.random(), 0, 0]); }
  const riseMat = motes(D, rise, `
    float l = fract(uT * aQ.x + aQ.y), sw = l * 4. + aQ.y * 30.;
    p += vec3(cos(sw) * l * 1.6, l * 17., sin(sw) * l * 1.6);
    s = .3 + .3 * (1. - l); a = sin(l * 3.1416) * uAmp * .9;
    c = mix(vec3(.45, 1.5, .55), vec3(1.2, .4, 1.6), step(.5, fract(aQ.y * 7.)));`);

  D.label(Z.name, 110, F + 6, 450);
  D.label('Circle of the Black Goat', CX, F + 3, CZ + 15, 'district quarter under');
  D.label('Black Altar', 147, F + 3, 450, 'district quarter under');
  D.label('Witches’ Galleries', 120, F + 9, 412, 'district quarter under');

  // Each 46 s the Goat rises out of the circle, holds, and sinks back. Twice while it stands, the hall surges.

  D.tick(t => {
    const ph = t % 46, up = THREE.MathUtils.smoothstep(ph, 0, 9) * (1 - THREE.MathUtils.smoothstep(ph, 40, 46));
    const surge = [20, 31].reduce((m, s0) => Math.max(m, ph > s0 && ph < s0 + 4 ? Math.sin((ph - s0) / 4 * Math.PI) ** 2 : 0), 0);
    const pulse = .5 + .5 * Math.sin(t * 1.9), drop = Math.sin(Math.floor(t * 13) * 91.7) > .82 ? .35 : 1;
    goat.position.y = F - 15 * (1 - up) + .4 * Math.sin(t * .5);
    goat.scale.setScalar(.85 * (1 + .04 * Math.sin(t * .8) + .12 * surge));
    goat.rotation.y = Math.sin(t * .13) * .3;
    goatMat.uniforms.uAmp.value = ((.8 + .25 * Math.sin(t * 7.3) * Math.sin(t * 2.1)) * drop + surge * 1.1) * (.2 + .8 * up);
    goatEyes.uniforms.uOpacity.value = (.5 + .5 * up) * (.7 + .3 * Math.sin(t * 3)) + surge;
    crown.uniforms.uOpacity.value = up * (.5 + .3 * Math.sin(t * 17) * Math.sin(t * 5)) + surge * .6;
    floorSig.uniforms.uPulse.value = pulse * (.4 + .6 * up);
    floorSig.uniforms.uSurge.value = surge;
    floorSig.uniforms.uSpin.value = t * (.05 + .1 * up) + surge * .6;
    stele.material.uniforms.uPulse.value = pulse;
    stele.material.uniforms.uSurge.value = surge;
    stele.material.uniforms.uSpin.value = -t * .2;
    stele.material.uniforms.uWash.value = 0;
    wispMat.uniforms.uAmp.value = .8 + surge * 1.5;
    riseMat.uniforms.uAmp.value = .3 + .7 * up + surge;
    brew.material.uniforms.uOpacity.value = .65 + .25 * Math.sin(t * 2.7) * Math.sin(t * 1.3);
    for (let i = 0; i < 13; i++) {
      const a = i / 13 * Math.PI * 2, x = CX + Math.cos(a) * WR, z = CZ + Math.sin(a) * WR;
      const sway = .07 * Math.sin(t * 1.3 + i * .48) + surge * .14 * Math.sin(t * 5 + i);
      const bow = .08 + .1 * Math.sin(t * .9 + i * 1.3) * up + surge * .35;
      dummy.position.set(x, F, z);
      dummy.rotation.set(sway, Math.atan2(-(CZ - z), CX - x), -bow, 'YXZ');
      dummy.updateMatrix();
      witches.setMatrixAt(i, dummy.matrix);
      witchEyes.setMatrixAt(i, dummy.matrix);
    }
    witches.instanceMatrix.needsUpdate = witchEyes.instanceMatrix.needsUpdate = true;
  });
}

// ---------- the Wurmgang and the Lair of the Lindworm ----------

function lair(D, Z, W) {
  const F = Z.floor, H = 30, C = [488, 328];
  const lr = a => 1 + .1 * Math.sin(3 * a + .7) + .07 * Math.sin(5 * a + 2.1) + .04 * Math.sin(11 * a + .3);
  const lpt = (a, k = 0) => [C[0] + (85 * lr(a) - k) * Math.cos(a), C[1] + (72 * lr(a) - k) * Math.sin(a)];
  const speed = a => { const [x0, z0] = lpt(a), [x1, z1] = lpt(a + .001); return Math.hypot(x1 - x0, z1 - z0) / .001; };
  const aw = Math.atan2(W.exit[2] - C[1], W.exit[0] - C[0]);

  // The cavern: a rough floor and a 30 m wall with two mouths, the Wurmgang's and the west anchor's.

  const ring = Array.from({ length: 200 }, (_, i) => lpt(-i / 200 * Math.PI * 2));
  D.floorPoly(ring, F, 'rock', { bump: .35, rgb: [.27, .22, .19] });
  const gaps = [[Math.PI, 2.3 / speed(Math.PI)], [aw, 3.6 / speed(aw)]].sort((p, q) => q[0] - p[0]);
  gaps.forEach((g, i) => {
    const h = gaps[(i + 1) % gaps.length], a0 = g[0] - g[1];
    let a1 = h[0] + h[1];
    if (a1 > a0) a1 -= Math.PI * 2;
    const n = Math.ceil((a0 - a1) * 40), path = [];
    for (let k = 0; k <= n; k++) path.push(lpt(a0 + (a1 - a0) * k / n));
    D.wall(path, F, H, 'rock', { thick: 3, rough: .8, rgb: [.29, .24, .21] });
  });
  const [wx] = lpt(Math.PI, 4);
  D.tunnel([[Z.anchors.west[0], F, 330], [wx, F, 330]], { w: 3.6, h: 6, wall: 'rock', floor: 'rock', rough: .5, torches: 12, rgb: [.3, .25, .22] });

  // The Wurmgang: the worm's own burrow, winding down from the Walpurgissaal's breach to the cavern's south-west mouth.

  const [bx, bz] = lpt(aw, -12), pts = [[W.exit[0] - 1, W.exit[1], W.exit[2]], [W.exit[0] + 10, W.exit[1], W.exit[2]]];
  const sx = W.exit[0] + 10, sz = W.exit[2], dx = bx - sx, dz = bz - sz, L = Math.hypot(dx, dz), px = -dz / L, pz = dx / L, N = 48;
  for (let k = 1; k <= N; k++) {
    const u = k / N, off = Math.sin(u * Math.PI * 2.5) * 26 * Math.sin(u * Math.PI);
    pts.push([sx + dx * u + px * off, W.exit[1] + (F - W.exit[1]) * (u * .6 + .4 * u * u * (3 - 2 * u)), sz + dz * u + pz * off]);
  }
  const [ex0, ez0] = lpt(aw, 4);
  pts.push([ex0, F, ez0]);
  D.tunnel(pts, { w: 6, h: 8, wall: 'rock', floor: 'rock', rough: .7, thick: 1.4, rgb: [.3, .25, .22], floorRgb: [.25, .21, .18] });
  for (let i = 2; i < pts.length - 2; i++) {
    const [x, y, z] = pts[i], [x1, , z1] = pts[i + 1], l = Math.hypot(x1 - x, z1 - z), tx = (x1 - x) / l, tz = (z1 - z) / l, s = i % 2 ? 1 : -1;
    const ex = x - tz * s * 2.7, ez = z + tx * s * 2.7;
    if (i % 4 === 0) claws(D, x + tz * s * 2.85, y + rnd(1.5, 3.5), z - tx * s * 2.85, tx, tz);
    if (i < 18 && i % 5 === 2) D.torch(ex - tz * s * .15, y + 2.4, ez + tx * s * .15, tz * s, -tx * s, { rgb: GHOUL, size: .7 });
    if (i >= 16 && i % 2 === 0) {
      D.glow(ex, y - .05, ez, rnd(2.5, 4), .12, rnd(.3, .6), [1.8, .5, .12], { rot: Math.atan2(-tz, tx) + rnd(-.4, .4), pulse: .3 });
      D.light(ex, y + 1.2, ez, EMBER, 13);
    }
    if (Math.random() < .5) D.box(x + rnd(-2, 2), y, z + rnd(-2, 2), .14, .03, .1, 'gold', { rot: rnd(0, 3) });
    if (i % 7 === 3) skull(D, x + rnd(-1.5, 1.5), y, z + rnd(-1.5, 1.5), rnd(0, 6));
  }
  knight(D, pts[30][0], pts[30][1], pts[30][2], 1.2);
  const mid = pts[Math.floor(pts.length / 2)];
  D.label('Wurmgang', mid[0], mid[1] + 6, mid[2], 'district quarter under');

  // The cathedral's foundation piers, driven down through the roof: banded red sandstone on stepped footings, with
  // relieving arches between them and torn rock round their tops. The pair at x 458 stops short, hanging in the dark.

  const red = [.5, .32, .26];
  for (const x of [440, 458, 476, 494, 512, 530]) for (const z of [306, 350]) {
    const big = x === 494, w = big ? 6.5 : 4.6, y0 = x === 458 ? F + 18 : F;
    if (y0 === F) { D.box(x, F, z, w + 3, 1.2, w + 3, 'ashlar', { rgb: red }); D.box(x, F + 1.2, z, w + 1.5, 1, w + 1.5, 'ashlar', { rgb: red }); }
    else for (let k = 0; k < 9; k++) D.box(x + rnd(-4, 4), F, z + rnd(-4, 4), rnd(.8, 2), rnd(.5, 1.6), rnd(.8, 2), 'ashlar', { rgb: red, rot: rnd(0, 3) });
    D.box(x, y0, z, w, -54 - y0, w, 'ashlar', { rgb: red, faces: y0 === F ? 'b' : '' });
    for (let y = y0 + 4; y < -56; y += 6) D.box(x, y, z, w + .2, .35, w + .2, 'iron', { rgb: [.2, .19, .19] });
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; D.box(x + Math.cos(a) * (w * .6 + 1.5), F + H - rnd(1, 4), z + Math.sin(a) * (w * .6 + 1.5), rnd(2, 4), rnd(2, 5), rnd(2, 4), 'rock', { rot: a, rgb: [.27, .22, .2] }); }
  }
  for (const z of [306, 350]) for (const x of [449, 467, 485, 503, 521]) D.arch(x, F + 17, z, 13.4, 6, { thick: 1.4, depth: 3.6, mat: 'ashlar', rgb: red });
  for (const x of [440, 476, 494, 512, 530]) for (const z of [306, 350]) { const s = z < 328 ? 1 : -1; D.torch(x, F + 3.2, z + s * (x === 494 ? 3.4 : 2.45), 0, s); }
  for (const [x, z] of [[440, 312], [512, 344]]) {
    D.geo(bar([x - 1, F, z], [x + 1.6, F + 6, z + .4], .08, .08, 4), 'wood');
    D.geo(bar([x + 1.8, F, z], [x + 1.6, F + 6, z + .4], .08, .08, 4), 'wood');
    for (let k = 1; k < 6; k++) D.box(x + .4 + k * .2, F + k, z + .1, 1.6, .08, .08, 'wood');
  }

  // The fissures: ember cracks across the floor with scorched rims, smoke and sparks rising from them.

  const cracks = [
    [[450, 262], [470, 275], [492, 270], [515, 284], [540, 278], [562, 292]],
    [[452, 328], [475, 324], [498, 331], [520, 326], [540, 330]],
    [[548, 350], [535, 368], [546, 386]],
    [[420, 292], [432, 312], [425, 345], [434, 360]],
  ];
  const smoke = [], sparks = [];
  for (const line of cracks) for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx2, bz2] = line[i + 1], sub = 3;
    for (let k = 0; k < sub; k++) {
      const u0 = k / sub, u1 = (k + 1) / sub, j = () => rnd(-1.5, 1.5);
      const x0 = ax + (bx2 - ax) * u0 + (k ? j() : 0), z0 = az + (bz2 - az) * u0 + (k ? j() : 0), x1 = ax + (bx2 - ax) * u1, z1 = az + (bz2 - az) * u1;
      const l = Math.hypot(x1 - x0, z1 - z0), rot = Math.atan2(-(z1 - z0), x1 - x0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, w = rnd(.35, 1.1);
      D.floor(mx, F + .03, mz, l + 1, w + 2.6, 'rock', { rot, rgb: [.11, .08, .07] });
      D.glow(mx, F - .1, mz, l + .3, .2, w, [1.9, .55, .14], { rot, pulse: rnd(.2, .4) });
      for (let m = 0; m < 3; m++) smoke.push([mx + rnd(-l / 2, l / 2) * Math.cos(rot), F, mz - rnd(-l / 2, l / 2) * Math.sin(rot), 0, rnd(.03, .06), Math.random(), 0, 0]);
      for (let m = 0; m < 3; m++) sparks.push([mx + rnd(-l / 2, l / 2) * Math.cos(rot), F, mz - rnd(-l / 2, l / 2) * Math.sin(rot), 0, rnd(.2, .45), Math.random(), 0, 0]);
    }
    D.light((ax + bx2) / 2, F + 1.4, (az + bz2) / 2, EMBER, 14);
  }
  motes(D, smoke, `
    float l = fract(uT * aQ.x + aQ.y);
    p += vec3(sin(aQ.y * 40. + l * 2.) * l * 4. + l * 3., l * 27., cos(aQ.y * 50. + l * 1.5) * l * 4.);
    s = 1.5 + l * 10.; a = sin(l * 3.1416) * .26 * (1. - l * .5);
    c = mix(vec3(.6, .22, .07), vec3(.1, .085, .08), smoothstep(0., .3, l));`, { additive: false, soft: '1.5' });
  motes(D, sparks, `
    float l = fract(uT * aQ.x + aQ.y);
    p += vec3(sin(aQ.y * 70.) * l * 2.5, l * 11. + sin(l * 9. + aQ.y * 20.) * .4, cos(aQ.y * 90.) * l * 2.5);
    s = .3 * (1. - l) + .06; a = (1. - l) * (.6 + .4 * sin(uT * 20. + aQ.y * 50.));
    c = vec3(2., .7, .2);`);

  // Warm fill so the floor reads, and deep shadow at the walls.

  for (const [x, z] of [[470, 290], [510, 300], [460, 370], [520, 375], [430, 330], [560, 330]]) D.light(x, F + 8, z, [1, .42, .16], 32);

  // Rock spurs, claw-scored walls, bones of cattle and the knights who came for the worm.

  for (let k = 0; k < 26; k++) {
    const a = rnd(0, 6.3), [x, z] = lpt(a, rnd(4, 12)), r = rnd(.8, 2.6);
    if (Math.abs(a - aw) < .12 || Math.abs(a - Math.PI) < .1) continue;
    D.cyl(x, F, z, r, r * rnd(2.5, 5), 'rock', { r1: r * .2, seg: 10, rgb: [.29, .24, .21] });
  }
  for (let k = 0; k < 34; k++) {
    const a = k / 34 * Math.PI * 2 + rnd(-.05, .05), [x0, z0] = lpt(a, .1), [x1, z1] = lpt(a - .01, .1), l = Math.hypot(x1 - x0, z1 - z0);
    claws(D, x0, F + rnd(2, 12), z0, (x1 - x0) / l, (z1 - z0) / l, rnd(4, 7));
  }
  for (let k = 0; k < 11; k++) { const a = rnd(0, 6.3), [x, z] = lpt(a, rnd(8, 24)); carcass(D, x, F, z, rnd(0, 6)); }
  for (let k = 0; k < 9; k++) knight(D, rnd(415, 445), F, rnd(340, 372), rnd(0, 6));
  for (let k = 0; k < 5; k++) knight(D, rnd(535, 570), F, rnd(300, 360), rnd(0, 6));
  for (let k = 0; k < 60; k++) {
    const a = rnd(0, 6.3), [x, z] = lpt(a, rnd(3, 50));
    if (k % 4) D.geo(bar([x, F + .05, z], [x + rnd(-1, 1), F + .05, z + rnd(-1, 1)], .06, .05, 4), 'bone');
    else D.box(x, F, z, .12, .03, .12, 'gold', { rot: rnd(0, 3) });
  }

  // The sleeping hollow, worn smooth, and the shed skin coiled across it: a pale tube with diamond scales, tattered
  // and see-through, its head end split open where the worm crawled out.

  const SC = [482, 368];
  D.floorPoly(Array.from({ length: 40 }, (_, i) => { const a = i / 40 * Math.PI * 2; return [SC[0] + Math.cos(a) * 15, SC[1] + Math.sin(a) * 11]; }), F + .04, 'rock', { rgb: [.36, .3, .25] });
  const coil = [];
  for (let k = 0; k <= 40; k++) { const th = k / 40 * Math.PI * 3, r = 3.5 + th / (Math.PI * 2) * 3.8; coil.push([SC[0] + Math.cos(th) * r * 1.1, 0, SC[1] + Math.sin(th) * r]); }
  coil.push([SC[0] - 16, 0, SC[1] + 5], [SC[0] - 25, 0, SC[1] + 2], [SC[0] - 33, 0, SC[1] + 5]);
  for (const p of coil) p[1] = F + 1;
  const skinLen = coil.reduce((s, p, i) => i ? s + Math.hypot(p[0] - coil[i - 1][0], p[2] - coil[i - 1][2]) : 0, 0);
  const skinGeo = tube(coil, u => (u < .08 ? 1.9 - u * 3 : 1.65 * (1 - u) + .25) * (1 + .12 * Math.sin(u * 140)), 180, 10, .5);
  const skin = D.add(new THREE.Mesh(skinGeo, shader(D, { uLen: { value: skinLen } }, 'uniform float uLen;', `
    vec2 q = vec2(vUv.x * uLen / .8, vUv.y * 14.);
    q.x += floor(q.y) * .5;
    vec2 f = fract(q) - .5;
    float edge = smoothstep(.36, .5, abs(f.x) + abs(f.y));
    if (gn(vUv * vec2(uLen * .12, 4.)) > .74 || (vUv.x < .03 && vUv.y > .4 && vUv.y < .7)) discard;
    vec3 v = normalize(cameraPosition - vW), n = normalize(vN);
    float rim = pow(1. - abs(dot(n, v)), 2.);
    vec3 base = mix(vec3(.62, .62, .5), vec3(.36, .44, .3), gn(q * .35));
    vec3 c = base * (.25 + .45 * (.5 + .5 * n.y)) * vec3(1.15, .9, .7) + vec3(.8, .4, .15) * rim * .4;
    gl_FragColor = vec4(c, .1 + .45 * rim + .3 * edge);`)));
  skin.frustumCulled = false;

  // The clutch: eight eggs in a nest of rubble and bones, and the ninth in the middle, cracking and about to hatch.

  const NC = [560, 328];
  D.floorPoly(Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2; return [NC[0] + Math.cos(a) * 7, NC[1] + Math.sin(a) * 7]; }), F + .05, 'dirt', { rgb: [.3, .24, .16], bump: .2 });
  for (let k = 0; k < 30; k++) { const a = k / 30 * Math.PI * 2; D.box(NC[0] + Math.cos(a) * 7, F, NC[1] + Math.sin(a) * 7, rnd(.8, 1.8), rnd(.5, 1.4), rnd(.8, 1.6), 'rock', { rot: a }); }
  for (let k = 0; k < 40; k++) { const a = rnd(0, 6.3), r = rnd(5.5, 7.5); D.geo(bar([NC[0] + Math.cos(a) * r, F + rnd(.5, 1.4), NC[1] + Math.sin(a) * r], [NC[0] + Math.cos(a + .3) * r, F + rnd(.3, 1.2), NC[1] + Math.sin(a + .3) * r], .07, .05, 4), 'bone'); }
  const eggGeo = lathe(Array.from({ length: 13 }, (_, i) => { const u = i / 12, e = 2 * u - 1; return [Math.max(.001, .92 * Math.sqrt(Math.max(0, 1 - e * e)) * (1 - .16 * e)), u * 2.4]; }), 18);
  const eggMat = (glow, phase, crack) => shader(D, { uPulse: { value: 0 }, uCrack: { value: crack }, uGlow: { value: new THREE.Color(...glow) }, uPh: { value: phase } },
    'uniform float uPulse, uCrack, uPh; uniform vec3 uGlow;', `
    vec3 v = normalize(cameraPosition - vW), n = normalize(vN);
    float f = abs(dot(n, v)) * .5 + .5, sc = gn(vL.xz * 9. + vL.y * 5.);
    float vein = pow(1. - abs(gn(vec2(atan(vL.z, vL.x) * 2.2 + uPh, vL.y * 2.6)) * 2. - 1.), 9.);
    float cr = pow(1. - abs(gn(vec2(atan(vL.z, vL.x) * 3.5, vL.y * 4.2 + uPh)) * 2. - 1.), 28.) * uCrack;
    vec3 shell = mix(vec3(.12, .1, .05), vec3(.3, .2, .08), sc) * (.4 + .4 * (.5 + .5 * n.y));
    vec3 c = shell + uGlow * (f * f * .55 * uPulse + vein * (.35 + .9 * uPulse)) + vec3(2.6, 1.4, .4) * cr * (.5 + uPulse);
    gl_FragColor = vec4(c, 1.);`, { opaque: true });
  const eggs = [];
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2 + rnd(-.2, .2), r = rnd(2.8, 4.4), m = eggMat([1.8, 1, .25], rnd(0, 6), 0);
    const e = D.add(new THREE.Mesh(eggGeo, m));
    e.position.set(NC[0] + Math.cos(a) * r, F, NC[1] + Math.sin(a) * r);
    e.rotation.set(rnd(-.25, .25), rnd(0, 6), rnd(-.25, .25));
    e.scale.setScalar(rnd(.85, 1.05));
    eggs.push([e, m, rnd(0, 6)]);
  }
  const hm = eggMat([2.4, .8, .2], 1.3, 1), hatch = D.add(new THREE.Mesh(eggGeo, hm));
  hatch.position.set(NC[0], F, NC[1]);
  hatch.scale.setScalar(1.25);
  const halo = motes(D, [[NC[0], F + 1.6, NC[1], 0, 0, 0, 0, 0]], 's = 11.; a = uAmp; c = vec3(1.4, .6, .15);');
  motes(D, eggs.map(([e]) => [e.position.x, F + 1.2, e.position.z, 0, Math.random() * 6, 0, 0, 0]), 's = 4.5; a = .22 + .12 * sin(uT * .9 + aQ.x); c = vec3(1.3, .8, .2);');
  D.light(NC[0], F + 2.5, NC[1], [1.5, .9, .3], 16, { flicker: 0 });
  D.light(NC[0] - 6, F + 1, NC[1] + 4, [1, .6, .2], 9, { flicker: 0 });

  D.label(Z.name, C[0], F + 6, C[1]);
  D.label('Shed Skin', SC[0], F + 3, SC[1] + 6, 'district quarter under');
  D.label('Clutch of the Lindworm', NC[0], F + 4, NC[1] - 8, 'district quarter under');
  D.label('Footings of the Lindwurmdom', 485, F + 20, 328, 'district quarter under');

  // The eggs throb slowly. The hatching egg beats faster, and every 7 s it rocks as something inside pushes.

  D.tick(t => {
    for (const [, m, ph] of eggs) m.uniforms.uPulse.value = .5 + .5 * Math.sin(t * .9 + ph);
    const beat = Math.pow(.5 + .5 * Math.sin(t * 3.2), 3), kick = t % 7 < 1.1 ? Math.sin((t % 7) / 1.1 * Math.PI) : 0;
    hm.uniforms.uPulse.value = .4 + .8 * beat + kick;
    hm.uniforms.uCrack.value = .7 + .6 * kick;
    hatch.rotation.set(Math.sin(t * 23) * .12 * kick, 0, Math.cos(t * 19) * .12 * kick);
    halo.uniforms.uAmp.value = .18 + .25 * beat + .4 * kick;
  });
}

export default function build(D, Z) {
  walpurgis(D, Z.walpurgis);
  lair(D, Z.lair, { exit: [165, Z.walpurgis.floor, 482] });
}
