// Instanced meshes, the building shader, placement helpers, tiles and shared kit helpers.

import * as THREE from 'three';
import { S, H } from './state.js';
import { AXIS_HI, AXIS_LO, lerp } from './core.js';
import { SETTING } from './setting.js';
import { FOCUS_GLSL, FOG_GLSL, SHADOWS, SHADOW_GLSL, U, scene, shadowUniforms } from './render.js';
import { RELIEF, groundAt } from './relief.js';

// ---------- buildings: five shapes, procedural windows and wall materials in the shader ----------

export const B_VS = `
  ${SHADOWS ? '#define SHADOWS' : ''}
  attribute vec3 aBase, aWin; attribute vec4 aP; attribute float aSkin;
  varying vec3 vW, vN, vWN, vL, vS, vBase, vWin; varying vec4 vP; varying float vSkin;
  #ifdef MERGED
    attribute float aU, aLen;
    varying float vU, vLen;
  #endif
  void main(){
    #ifdef MERGED
      vec4 w = modelMatrix * vec4(position, 1.);
      vWN = normal; vS = vec3(1.); vU = aU; vLen = aLen;
    #else
      vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.);
      vS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));

      // With shadows the normal takes the inverse scale, so a stretched roof slope faces the right way. Without
      // shadows it keeps the plain transform, as New Angeles has always drawn.

      #ifdef SHADOWS
        vWN = normalize(mat3(instanceMatrix) * (normal / (vS * vS)));
      #else
        vWN = normalize(mat3(instanceMatrix) * normal);
      #endif
    #endif
    vW = w.xyz; vL = position; vN = normal;
    vBase = aBase; vWin = aWin; vP = aP; vSkin = aSkin;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
export const B_FS = `
  uniform float uWin, uEdge; uniform vec3 uLightDir, uLightCol, uLightK;
  varying vec3 vW, vN, vWN, vL, vS, vBase, vWin; varying vec4 vP; varying float vSkin;
  #ifdef MERGED
    varying float vU, vLen;
  #endif
  ${FOG_GLSL}
  ${FOCUS_GLSL}
  ${SHADOW_GLSL}
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

  // Roof skins 15 slate and 16 tile: staggered rows with a shadow at each row's lower edge, mottled per piece and
  // in patches. Rows fade to their average where they get smaller than a pixel.

  vec3 roofTex(vec3 col, vec2 q, float slate, vec2 salt){
    vec2 t = q / (slate > .5 ? vec2(.34, .22) : vec2(.2, .28));
    t.x += .5 * mod(floor(t.y), 2.);
    vec2 tf = fract(t);
    float h = h21(floor(t) + salt);
    float k = slate > .5 ? (1. - .3 * step(tf.y, .12)) * (1. - .2 * step(tf.x, .05)) : .74 + .34 * smoothstep(0., .7, tf.y);
    k = mix(k * (.86 + .26 * h), .95, smoothstep(.3, .9, max(fwidth(t.x), fwidth(t.y))));
    vec3 tint = slate > .5 ? mix(vec3(1.), vec3(.92, .96, 1.08), h) : vec3(1.);
    return col * k * tint * (.88 + .24 * h21(floor(q / vec2(1.8, 1.3)) + salt * 1.3));
  }
  void main(){
    if (vW.y > uClipTop || focusCut(vW)) discard;
    if (!gl_FrontFacing) { gl_FragColor = vec4(fogged(vBase * 1.8 + vec3(.012, .014, .02), vW), 1.); return; }
    vec3 n = normalize(vWN);
    float sun = max(dot(n, normalize(uLightDir)), 0.);
    #ifdef SHADOWS
      sun *= shadowAt(vW, n);
    #endif
    vec3 diff = uLightCol * (uLightK.x + uLightK.y * max(n.y, 0.) + uLightK.z * sun);
    vec3 col = vBase * diff * (.6 + .4 * clamp(vW.y / 50., 0., 1.));

    // Material skins (plaster, timber, stone, and the roof skins tile and thatch) skip the tower look: floor bands,
    // glass and edge glow. Skins 17 and 18 are ashlar and rubble without windows, so they draw as 10 and 11 blind.

    bool blind = vSkin > 16.5;
    float sk = blind ? vSkin - 7. : vSkin;
    bool mat = sk > 4.5, roofS = (sk > 7.5 && sk < 9.5) || sk > 14.5;
    if (abs(vN.y) < .5) {
      #if defined(MERGED)
        float u = vU;
      #elif defined(CYL)
        float u = atan(vL.z, vL.x) * vS.x * .5;
      #else
        float u = abs(vN.x) > .5 ? vL.z * vS.z : vL.x * vS.x;
      #endif
      if (!mat) col *= .88 + .12 * step(.5, fract(vW.y / 14.));

      // Skins: 0 grid, 1 ribbon bands, 2 vertical fins, 3 glass curtain, 4 sparse. Materials: 5 plaster, 6 timber
      // frame, 7 stone, and on walls under a roof 8 tile and 9 thatch, which take no windows.

      vec2 cell = sk > 4.5 ? vec2(3.4, 3.2) : sk > 3.5 ? vec2(4.6, 3.6) : sk > 2.5 ? vec2(1.7, 3.6) : vec2(3.2, 3.6);
      vec2 g = vec2(u, vW.y) / cell;
      vec2 c = floor(g), f = fract(g);

      // Hash inputs must be exact per window: interpolated normals differ per pixel on some GPUs and turn into grain.

      vec2 salt = vec2(floor(vP.x) * 1.7, 0.) + floor(vN.xz + .5) * 3.1;
      float win, r, litP = vP.y;
      if (sk < .5) {
        win = step(.18, f.x) * step(f.x, .82) * step(.28, f.y) * step(f.y, .78);
        r = h21(c + salt);
      } else if (sk < 1.5) {
        win = step(.3, f.y) * step(f.y, .74);
        r = h21(vec2(floor(c.x / 5.), c.y) + salt);
      } else if (sk < 2.5) {
        win = step(.38, f.x) * step(f.x, .62) * step(.05, f.y);
        r = h21(vec2(c.x, floor(c.y / 7.)) + salt);
      } else if (sk < 3.5) {
        win = step(.06, f.x) * step(.08, f.y);
        r = h21(c + salt);
        litP *= .7;
        col = mix(col, vec3(.03, .06, .09) + vec3(.01, .03, .04) * fract(vW.y / 90.), .7 * win);
      } else if (sk < 4.5) {
        win = step(.35, f.x) * step(f.x, .65) * step(.35, f.y) * step(f.y, .7);
        r = h21(c + salt);
        litP *= .6;
      } else {

        // Small shuttered windows in a plain wall. Plaster takes a soft grain. Timber frame draws posts every 1.7 m,
        // a beam at each floor and braces. Stone draws courses 0.55 m high with staggered joints.

        win = roofS ? 0. : step(.38, f.x) * step(f.x, .62) * step(.38, f.y) * step(f.y, .72);
        r = h21(c + salt);
        litP *= .5;
        vec2 q = vec2(u, vW.y);
        float n = h21(floor(q * 1.3) + salt);
        if (sk < 6.5 && sk > 5.5) {
          vec2 t = q / vec2(1.7, 3.2), tf = fract(t);
          float frame = clamp(step(tf.x, .09) + step(.91, tf.x) + step(tf.y, .07) + step(.93, tf.y)
            + step(abs(tf.x - tf.y), .05) * step(.5, h21(floor(t) + salt)), 0., 1.) * (1. - win);
          col = mix(col * (.95 + .1 * n), vec3(.035, .022, .014), frame);
        } else if (sk < 7.5 && sk > 6.5) {
          vec2 t = q / vec2(.9, .55);
          t.x += .5 * mod(floor(t.y), 2.);
          vec2 tf = fract(t);
          col *= (.8 + .35 * h21(floor(t) + salt)) * (1. - .45 * clamp(step(tf.x, .04) + step(tf.y, .07), 0., 1.));
        } else if (sk > 14.5) {
          col = roofTex(col, q, step(sk, 15.5), salt);
        } else if (sk > 9.5) {

          // Skins 10 ashlar, 11 rubble, 12 braced timber frame, 13 red-painted timber frame and 14 plaster with
          // sandstone quoins. All but rubble take larger windows.

          if (sk < 10.5 || sk > 11.5) win = step(.35, f.x) * step(f.x, .65) * step(.33, f.y) * step(f.y, .75);
          if (sk < 10.5) {
            vec2 t = q / vec2(1.25, .62);
            t.x += .5 * mod(floor(t.y), 2.);
            vec2 tf = fract(t);
            col *= (.9 + .18 * h21(floor(t) + salt)) * (1. - .35 * clamp(step(tf.x, .025) + step(tf.y, .05), 0., 1.));
          } else if (sk < 11.5) {
            vec2 t = q / vec2(.55, .38);
            t.x += h21(vec2(floor(t.y), 3.) + salt);
            vec2 tf = fract(t);
            float s = h21(floor(t) + salt);
            col *= (.7 + .5 * s) * mix(vec3(1.), vec3(1.08, .95, .85), h21(floor(t) * 1.3 + salt)) * (1. - .5 * clamp(step(tf.x, .07) + step(tf.y, .1), 0., 1.));
          } else if (sk < 13.5) {
            float red = step(12.5, sk);
            vec2 t = q / (red > .5 ? vec2(1.7, 3.2) : vec2(1.15, 3.2)), tf = fract(t);
            float b = h21(floor(t) + salt);
            float brace = step(abs(tf.x - tf.y), .05) * step(b, .7) + step(abs(tf.x + tf.y - 1.), .05) * step(b, .4);
            float frame = clamp(step(tf.x, .1) + step(.9, tf.x) + step(tf.y, .07) + step(.93, tf.y) + step(abs(tf.y - .3), .03) * (1. - red)
              + brace, 0., 1.) * (1. - win);
            col = mix(col * (.95 + .1 * n), diff * (red > .5 ? vec3(.15, .04, .025) : vec3(.05, .032, .02)), frame);
          } else {
            #if defined(MERGED) || defined(CYL)
              float ed = 9.;
            #else
              float ed = (.5 - abs(abs(vN.x) > .5 ? vL.z : vL.x)) * (abs(vN.x) > .5 ? vS.z : vS.x);
            #endif
            float course = fract(vW.y / .42), qw = mod(floor(vW.y / .42), 2.) > .5 ? .85 : .5;
            float quoin = step(ed, qw) * step(.06, course);
            float sur = step(.31, f.x) * step(f.x, .69) * step(.29, f.y) * step(f.y, .8) * (1. - win);
            vec3 sand = diff * vec3(.24, .17, .12) * (.85 + .2 * h21(vec2(floor(vW.y / .42), ed > 1. ? 1. : 0.) + salt));
            col = mix(col * (.9 + .2 * n), sand, clamp(quoin + sur, 0., 1.));
          }
        } else {
          col *= .9 + .2 * n;
        }
      }
      if (blind) win = 0.;
      float lit = step(1. - litP, r) * win * step(1., c.y);
      float lvl = .25 + .55 * h21(c * 1.7 + floor(vP.x));

      // Windows smaller than a pixel fade into their average brightness instead of shimmering.

      float cover = sk < .5 ? .32 : sk < 1.5 ? .44 : sk < 2.5 ? .23 : sk < 3.5 ? .85 : sk < 4.5 ? .1 : roofS || blind ? 0. : sk > 9.5 ? .1 : .07;
      float sharp = 1. - smoothstep(.35, .9, max(fwidth(g.x), fwidth(g.y)));
      if (mat) col *= 1. - .7 * mix(cover, win, sharp);
      col += vWin * mix(litP * cover * .65, lit * lvl, sharp) * uWin;
      if (!mat) col += vec3(.015, .02, .03) * mix(cover, win, sharp);
      #if defined(MERGED)
        float edge = exp(-min(vU, vLen - vU) / .45);
      #elif defined(CYL)
        float edge = step(.93, fract(atan(vL.z, vL.x) * 1.2732));
      #else
        float fl = abs(vN.x) > .5 ? vL.z : vL.x, span = abs(vN.x) > .5 ? vS.z : vS.x;
        float edge = exp(-(.5 - abs(fl)) * span / .45);
      #endif
      if (!mat) col += vWin * vP.w * (edge * .85 + exp(-vW.y / 60.) * .25) * uEdge;
    } else {
      col *= .55;

      // Roof skins: tile rows every 0.32 m up the slope, thatch in coarse streaks.

      if (sk > 14.5) col = roofTex(col, vec2(vW.x + vW.z, vW.y), step(sk, 15.5), vec2(floor(vP.x), 0.));
      else if (sk > 8.5 && sk < 9.5) col *= .8 + .3 * h21(floor(vW.xz * vec2(2., .4)) + floor(vP.x));
      else if (sk > 7.5 && sk < 8.5) col *= .75 + .35 * step(.2, fract(vW.y / .32));
    }
    col *= 1. - vP.z * .3;
    gl_FragColor = vec4(fogged(col, vW), 1.);
  }`;
export function buildingMesh(geo, cap, defines = {}) {
  geo.setAttribute('aBase', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3));
  geo.setAttribute('aWin', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3));
  geo.setAttribute('aP', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4));
  geo.setAttribute('aSkin', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1));
  return new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({ uniforms: U, defines, vertexShader: B_VS, fragmentShader: B_FS, userData: { casts: true } }), cap);
}
export const SHAPES = {
  box: buildingMesh(new THREE.BoxGeometry(1, 1, 1), 200000),
  cyl: buildingMesh(new THREE.CylinderGeometry(.5, .5, 1, 16), 24000, { CYL: 1 }),
  oct: buildingMesh(new THREE.CylinderGeometry(.5, .5, 1, 8).rotateY(Math.PI / 8), 24000, { CYL: 1 }),
  pyr: buildingMesh(new THREE.CylinderGeometry(0, .5 * Math.SQRT2, 1, 4).rotateY(Math.PI / 4), 16000),

  // A pitched roof: a triangular prism with its ridge along local x, 1 m wide, deep and high.

  gable: buildingMesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-.5, -.5), new THREE.Vector2(.5, -.5),
    new THREE.Vector2(0, .5)]), { depth: 1, bevelEnabled: false }).translate(0, 0, -.5).rotateY(Math.PI / 2), 40000),
};

// ---------- props, signs, glows ----------

export const propMat = new THREE.MeshStandardMaterial({ roughness: .75, metalness: .35 });
export const PROPS = {
  box: new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), propMat, 300000),
  cyl: new THREE.InstancedMesh(new THREE.CylinderGeometry(.5, .5, 1, 8), propMat, 100000),
  cone: new THREE.InstancedMesh(new THREE.CylinderGeometry(0, .5, 1, 8), propMat, 16000),
  dish: new THREE.InstancedMesh(
    new THREE.LatheGeometry(Array.from({ length: 5 }, (_, k) => new THREE.Vector2(k / 8, (k / 8) ** 2 * .8)), 12),
    new THREE.MeshStandardMaterial({ roughness: .5, metalness: .5, side: THREE.DoubleSide }), 16000),
  lattice: new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .5, 1, 4, 12, true),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(.16, .14, .14), wireframe: true }), 3000),
};

export function helipadTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1b1e24'; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#d8c25a'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#e8e8e8'; g.font = 'bold 130px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 128, 136);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const helipads = new THREE.InstancedMesh(new THREE.CircleGeometry(.5, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ map: helipadTexture(), color: new THREE.Color(.35, .35, .35), transparent: true }), 800);

export const signs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 100000);
export const glows = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 300000);

// Animated holo billboards on towers at the high end of the style axis.

export const bbGeo = new THREE.PlaneGeometry(1, 1);
export const aSeed = new THREE.InstancedBufferAttribute(new Float32Array(800), 1);
bbGeo.setAttribute('aSeed', aSeed);
export const billboards = new THREE.InstancedMesh(bbGeo, new THREE.ShaderMaterial({
  uniforms: U, side: THREE.DoubleSide,
  vertexShader: `
    attribute float aSeed; varying vec2 vUv; varying float vSeed; varying vec3 vW;
    void main(){ vUv = uv; vSeed = aSeed; vec4 w = modelMatrix * instanceMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `
    uniform float uTime; varying vec2 vUv; varying float vSeed; varying vec3 vW;
    ${FOG_GLSL}
    ${FOCUS_GLSL}
    vec3 hue(float h){ return clamp(abs(mod(h*6. + vec3(0.,4.,2.), 6.) - 3.) - 1., 0., 1.); }
    void main(){
      if (vW.y > uClipTop || focusCut(vW)) discard;
      float t = uTime * .4 + vSeed;
      vec2 cell = floor(vUv * vec2(10., 5.) + vec2(0., floor(t * 2.)));
      float glyph = step(.5, fract(sin(dot(cell, vec2(12.9898, 78.233)) + vSeed) * 43758.5453));
      float sweep = .6 + .4 * sin(vUv.x * 6. - t * 4.);
      vec3 c = hue(fract(vSeed * .37 + t * .04));
      float frame = min(1., step(vUv.x,.03) + step(.97,vUv.x) + step(vUv.y,.05) + step(.95,vUv.y));
      vec3 col = c * (.2 + .9 * glyph * sweep) + vec3(.9) * frame;
      col *= .85 + .15 * sin(vUv.y * 160.);
      gl_FragColor = vec4(fogged(col, vW), 1.);
    }`,
}), 800);

export const GLOWS = {
  sphere: new THREE.InstancedMesh(new THREE.SphereGeometry(.5, 10, 7), glows.material, 5000),
  ring: new THREE.InstancedMesh(new THREE.TorusGeometry(.5, .018, 3, 28).rotateX(Math.PI / 2), glows.material, 5000),
};
// Light pools on the ground under street lights. They show the ground the city stands on.

export function poolTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff'); gr.addColorStop(.3, 'rgba(255,255,255,.5)'); gr.addColorStop(.65, 'rgba(255,255,255,.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
export const pools = new THREE.InstancedMesh(new THREE.CircleGeometry(.5, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
  map: poolTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
}), 80000);
// A ground that lights itself takes the pools in POOL_SINK.take(pools) after each build, and the discs stay hidden.

export const POOL_SINK = { take: null };
export const pool = (x, z, rad, rgb) => put(pools, x, .25, z, rad * 2, 1, rad * 2, 0, 0, rgb);
export const INSTANCED = [...Object.values(SHAPES), ...Object.values(PROPS), ...Object.values(GLOWS), helipads, signs, glows, billboards, pools];
for (const m of INSTANCED) { m.frustumCulled = false; m.count = 0; scene.add(m); }

// ---------- placement helpers ----------

export const _o = new THREE.Object3D();
_o.rotation.order = 'YXZ';
export const _c = new THREE.Color();
// Kits build in a lot's local frame. FRAME rotates their output onto the real lot.

S.FRAME = null;
export function put(mesh, x, y, z, sx, sy, sz, ry = 0, rx = 0, rgb) {
  if (mesh.count >= mesh.instanceMatrix.count) return -1;
  if (S.FRAME) {
    const dx = x - S.FRAME.cx, dz = z - S.FRAME.cz, tx = S.FRAME.tx ?? S.FRAME.cx, tz = S.FRAME.tz ?? S.FRAME.cz;
    x = tx + dx * S.FRAME.c + dz * S.FRAME.s;
    z = tz - dx * S.FRAME.s + dz * S.FRAME.c;
    ry += S.FRAME.a;
    if (S.FRAME.sy) { y *= S.FRAME.sy; sy *= S.FRAME.sy; }
  }

  // On a relief every part stands on the ground at its own spot: a lot's platform or the slope.

  if (RELIEF) y += groundAt(x, z);
  const i = mesh.count++;
  _o.position.set(x, y, z); _o.rotation.set(rx, ry, 0); _o.scale.set(sx, sy, sz); _o.updateMatrix();
  mesh.setMatrixAt(i, _o.matrix);
  if (rgb) mesh.setColorAt(i, _c.setRGB(...rgb));
  return i;
}

// Writes a position, a uniform scale and a heading straight into an instance matrix. The heading is the
// direction (dx, dz) on the ground, so moving traffic needs no Euler, quaternion or trigonometry each frame.

export function yawAt(mesh, i, x, y, z, dx, dz, s = 1) {
  const r = Math.sqrt(dx * dx + dz * dz), e = mesh.instanceMatrix.array, o = i * 16, c = r ? dz / r * s : s, n = r ? dx / r * s : 0;
  e[o] = c; e[o + 1] = 0; e[o + 2] = -n; e[o + 3] = 0;
  e[o + 4] = 0; e[o + 5] = s; e[o + 6] = 0; e[o + 7] = 0;
  e[o + 8] = n; e[o + 9] = 0; e[o + 10] = c; e[o + 11] = 0;
  e[o + 12] = x; e[o + 13] = y; e[o + 14] = z; e[o + 15] = 1;
}
export const prop = (kind, x, y, z, sx, sy, sz, rgb, ry = 0, rx = 0) => put(PROPS[kind], x, y, z, sx, sy, sz, ry, rx, rgb);
export const glow = (x, y, z, sx, sy, sz, rgb, ry = 0) => put(glows, x, y, z, sx, sy, sz, ry, 0, rgb);

// Flicker entries animate sign and beacon colors: [mesh, index, rgb, phase, blink].

S.flicker = [];
// Red aviation lights mark only tall structures. Below 60 m a beacon is skipped; its random draw still runs,
// so the rest of the block lays out the same.

// The pack's look.decor switches off engine decoration that does not fit its setting: rooftop clutter (roof),
// facade add-ons (kibble), neon signs (neon and signs), holo billboards (holo), helipads, aviation beacons and
// road markings, and harvesters, fish ponds and greenhouses on the fields (fieldExtras). Each switch defaults to on
// and covers kit calls too.

export const DECOR = { roof: true, kibble: true, neon: true, signs: true, holo: true, helipads: true, beacons: true, markings: true,
  harvesters: true, fieldExtras: true, ...SETTING.look.decor };
export function beacon(x, y, z, r) {
  if (!DECOR.beacons) return;
  const phase = r() * 10;
  if (y < 60) return;
  const rgb = [2.2, .08, .04];
  S.flicker.push([glows, glow(x, y, z, .9, .9, .9, rgb), rgb, phase, true]);
}

export const grey = (r, v = .12) => { const g = v * (.7 + .6 * r()); return [g, g, g * 1.08]; };

// The pack's wallSkins name the default skins, [the one more likely at the low end of the style axis, the other].

const WALLS = SETTING.styles.wallSkins ?? ['sparse', 'grid'];
export function bld(x, z, w, d, h, st, r, { y0 = 0, lit = st.lit, shape = 'box', roof: withRoof = true, glow: gl = 0, ry = 0, skin, kibble: addOns = true, base } = {}) {
  const m = SHAPES[shape];
  const i = put(m, x, y0 + h / 2, z, w, h, d, ry);
  if (i < 0) return;
  m.geometry.attributes.aSkin.setX(i, skin ?? (r() < (1 - st.w) * .5 ? SKINS[WALLS[0]] : SKINS[WALLS[1]]));
  const v = .7 + .6 * r(), b = base ?? st.base;
  m.geometry.attributes.aBase.setXYZ(i, b[0] * v, b[1] * v, b[2] * v);
  m.geometry.attributes.aWin.setXYZ(i, ...(r() < .18 ? (st.w > .5 ? AXIS_LO.win : AXIS_HI.win) : st.win));
  m.geometry.attributes.aP.setXYZW(i, r() * 100, lit, st.grime, gl);
  if (withRoof && shape !== 'pyr' && shape !== 'gable') roof(x, z, w, d, y0 + h, st, r);
  if (addOns && shape === 'box' && h > 8 && !ry) kibble(x, z, w, d, y0, h, st, r);
}

// Boxes bolted onto facades: balconies, add-on rooms, AC units. Dense at the low end of the style axis.

export function kibble(x, z, w, d, y0, h, st, r) {
  if (!DECOR.kibble) return;
  for (let k = Math.floor((1.2 - st.w) * h / 5 * r()); k > 0; k--) {
    const n = FACES[Math.floor(r() * 4)], span = n[0] ? d : w;
    const kw = 2 + r() * 4, kh = 2 + r() * 3, kd = .8 + r() * 2;
    const along = (r() - .5) * Math.max(0, span - kw), y = y0 + 3 + r() * Math.max(0, h - kh - 3);
    const out = (n[0] ? w : d) / 2 + kd / 2;
    const v = .8 + .5 * r();
    prop('box', x + n[0] * out - n[1] * along, y + kh / 2, z + n[1] * out + n[0] * along,
      n[0] ? kd : kw, kh, n[0] ? kw : kd, st.base.map(c => c * v));
  }
}

// Rooftop clutter. The low end of the style axis gets tanks and lattice masts, the high end dishes and pads.

export function roof(x, z, w, d, y, st, r) {
  if (!DECOR.roof) return;
  const at = (m = 2) => [x + (r() - .5) * Math.max(0, w - m * 2), z + (r() - .5) * Math.max(0, d - m * 2)];
  for (let k = Math.floor(r() * (2 + w * d / 150)); k > 0; k--) {
    const [px, pz] = at(1.5);
    prop('box', px, y + .7, pz, 1.6 + r(), 1.4, 1.2 + r(), grey(r, .16));
  }
  if (r() < .45) { const [px, pz] = at(2); prop('box', px, y + 1.4, pz, 3, 2.8, 3.2, grey(r, .1)); }
  if (w > 7 && r() < lerp(.55, .12, st.w)) {
    const [px, pz] = at(3);
    const tc = [.12 + .08 * r(), .07, .05];
    prop('box', px, y + .4, pz, 3.6, .8, 3.6, grey(r, .08));
    prop('cyl', px, y + 2.6, pz, 4, 3.6, 4, tc);
    prop('cone', px, y + 4.9, pz, 4.1, 1, 4.1, tc);
  }
  if (r() < lerp(.12, .38, st.w)) {
    const [px, pz] = at(2.5), s = 2.5 + r() * 4;
    prop('cyl', px, y + s * .25, pz, .5, s * .5, .5, grey(r));
    prop('dish', px, y + s * .5, pz, s, s, s, grey(r, .3), r() * 6.3, -.6 - r() * .5);
  }
  if (r() < (y > 40 ? .28 : .07)) {
    const [px, pz] = at(1.5), h = 8 + r() * 20;
    prop('cyl', px, y + h / 2, pz, .35, h, .35, grey(r, .2));
    beacon(px, y + h + .4, pz, r);
  }
  if (st.w < .5 && w > 8 && r() < .05) {
    const [px, pz] = at(3), h = 30 + r() * 35;
    put(PROPS.lattice, px, y + h / 2, pz, 5, h, 5);
    beacon(px, y + h + .5, pz, r);
  }
}

export function helipad(x, z, s, y, r) {
  if (!DECOR.helipads) return;
  prop('cyl', x, y + .5, z, s, 1, s, grey(r, .07));
  put(helipads, x, y + 1.05, z, s * .92, 1, s * .92);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) glow(x + dx * s * .47, y + 1.2, z + dz * s * .47, .4, .3, .4, [.2, 1.3, .3]);
}

export const FACES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export function sign(x, z, w, d, h, st, r, rgb, opts = {}) {
  if (!DECOR.signs) return;
  const n = FACES[opts.face ?? Math.floor(r() * 4)];
  const span = n[0] ? d : w;
  const tall = h > 16;
  const blade = opts.blade ?? (tall && r() < .5);
  const sw = opts.sw ?? (blade ? 1.5 + r() * 2 : 2 + r() * Math.min(7, span * .6));
  const sh = opts.sh ?? (tall ? 4 + r() * Math.min(14, h * .5) : 1.4 + r() * 1.4);
  const y = opts.y ?? (tall ? 5 + r() * Math.max(0, h - sh - 6) + sh / 2 : 4.5);
  const along = opts.along ?? (r() - .5) * Math.max(0, span - sw);
  const out = (n[0] ? w : d) / 2 + (blade ? sw / 2 + .3 : .25);
  const px = x + n[0] * out - n[1] * along, pz = z + n[1] * out + n[0] * along;
  const ry = Math.atan2(n[0], n[1]) + (blade ? Math.PI / 2 : 0);
  const i = put(signs, px, y, pz, sw, sh, 1, ry, 0, rgb);
  if (r() < .06) S.flicker.push([signs, i, rgb, r() * 10, false]);
}
export function neon(x, z, w, d, h, st, r) {
  if (!DECOR.neon) return;
  for (let k = Math.floor(st.neon * r() * 3.5); k > 0; k--) {
    const pal = st.signs ?? (r() < st.w ? AXIS_HI.signs : AXIS_LO.signs);
    const s = .6 + .6 * r();
    sign(x, z, w, d, h, st, r, pal[Math.floor(r() * pal.length)].map(c => c * s));
  }
}
export function holo(x, z, w, d, y, r, face, size = 16) {
  if (!DECOR.holo || billboards.count >= 800) return;
  const f = FACES[face ?? Math.floor(r() * 4)];
  const bw = Math.min(size, (f[0] ? d : w) * .8), bh = bw * .6;
  const out = (f[0] ? w : d) / 2 + .4;
  aSeed.setX(put(billboards, x + f[0] * out, y, z + f[1] * out, bw, bh, 1, Math.atan2(f[0], f[1])), r() * 50);
}

// ---------- tiles: engine instances split into square tiles after each build ----------
// Tiles let frustum culling skip what is off screen. Detail tiles (props, smoke, text) are half a tile wide and
// hide beyond the quality level's prop range. The source meshes keep the data and stay hidden; tileOf maps a
// source instance to its tile copy. The pack sets the tile side.

export const TILE = SETTING.scale.tile;
export let TILES = [];
export function tileAll() {
  for (const t of TILES) { scene.remove(t.mesh); t.mesh.geometry.dispose(); }
  TILES = [];
  const detail = new Set([...Object.values(PROPS), puffs, texts, helipads]);
  const tiled = [...Object.values(SHAPES), ...Object.values(PROPS), ...Object.values(GLOWS), helipads, signs, glows, billboards, puffs, texts];
  if (POOL_SINK.take) { pools.visible = false; POOL_SINK.take(pools); } else tiled.push(pools);

  // Kit-owned instanced meshes tile too when they sit in world space and are not animated (userData.noTile).
  // userData.massing keeps one out of the detail range, for cover that must read from afar.

  const IDENTITY = new THREE.Matrix4();
  for (const m of INSTANCED) {
    if (tiled.includes(m) || m.userData.noTile || !m.count) continue;
    m.updateWorldMatrix(true, false);
    if (m.parent && m.matrixWorld.equals(IDENTITY)) { tiled.push(m); if (!m.userData.massing) detail.add(m); }
  }
  for (const src of tiled) {
    src.visible = false;
    const n = src.count, a = src.instanceMatrix.array, buckets = new Map();
    src.userData.tileOf = new Array(n);

    // Detail sources, and lights and signs under 1.2 m, go into finer detail tiles. Props of 20 m or more stay with the
    // massing, so fields and plazas read at range. Scale is read from the matrix columns.

    const smallOK = src === glows || src === signs;
    for (let i = 0; i < n; i++) {
      const o = i * 16, size = Math.max(Math.hypot(a[o], a[o + 1], a[o + 2]), Math.hypot(a[o + 4], a[o + 5], a[o + 6]), Math.hypot(a[o + 8], a[o + 9], a[o + 10]));
      const d = (detail.has(src) && size < 20) || (smallOK && size < 1.2), T = d ? TILE / 2 : TILE;
      const key = `${d ? 'd' : 'm'},${Math.floor(a[o + 12] / T)},${Math.floor(a[o + 14] / T)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(i);
    }
    for (const [key, idx] of buckets) {
      const g = new THREE.BufferGeometry();
      g.index = src.geometry.index;
      for (const [name, at] of Object.entries(src.geometry.attributes)) {
        if (!at.isInstancedBufferAttribute) { g.setAttribute(name, at); continue; }
        const k = at.itemSize, out = new at.array.constructor(idx.length * k);
        idx.forEach((i, j) => { for (let c = 0; c < k; c++) out[j * k + c] = at.array[i * k + c]; });
        g.setAttribute(name, new THREE.InstancedBufferAttribute(out, k));
      }
      const m = new THREE.InstancedMesh(g, src.material, idx.length);
      idx.forEach((i, j) => {
        for (let c = 0; c < 16; c++) m.instanceMatrix.array[j * 16 + c] = a[i * 16 + c];
        src.userData.tileOf[i] = [m, j];
      });
      if (src.instanceColor) {
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(idx.length * 3), 3);
        idx.forEach((i, j) => { for (let c = 0; c < 3; c++) m.instanceColor.array[j * 3 + c] = src.instanceColor.array[i * 3 + c]; });
      }
      m.renderOrder = src.renderOrder;
      m.matrixAutoUpdate = false;
      m.computeBoundingSphere();
      scene.add(m);
      const [kind, kx, kz] = key.split(','), T = kind === 'd' ? TILE / 2 : TILE;
      TILES.push({ mesh: m, detail: kind === 'd', x: (+kx + .5) * T, z: (+kz + .5) * T, half: T / 2 });
    }
  }
}

// ---------- shared kit helpers: beams, smoke puffs, text signs ----------

// A box from point a to point b, t thick. kind 'glow' makes it an unlit light strip.

export function beam(a, b, t, rgb, kind = 'box') {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  if (L < .01) return -1;
  return put(kind === 'glow' ? glows : PROPS.box, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, t, t, L,
    Math.atan2(dx, dz), -Math.asin(dy / L), rgb);
}

// ---------- lasers: thin additive beams with a hot core, a soft halo and a fade along their length ----------
// laser(a, b, w, rgb, o) fires from a toward b. The GPU sweeps each beam round its base direction, so nothing
// moves on the CPU. o.sweep is [yaw swing, pitch swing, speed, phase] in radians and rad/s. o.blink strobes it.
// A beam never draws thinner than about a pixel. It widens with distance and dims to keep the same light.

const LASER_GEO = new THREE.CylinderGeometry(1, 1, 1, 8, 6, true).rotateX(Math.PI / 2).translate(0, 0, .5);
const aSweep = new THREE.InstancedBufferAttribute(new Float32Array(4096 * 4), 4);
const aBeam = new THREE.InstancedBufferAttribute(new Float32Array(4096 * 4), 4);
LASER_GEO.setAttribute('aSweep', aSweep);
LASER_GEO.setAttribute('aBeam', aBeam);
const uPx = { value: .001 };
export const lasers = new THREE.InstancedMesh(LASER_GEO, new THREE.ShaderMaterial({
  uniforms: { ...U, uPx },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `
    uniform float uTime, uPx; attribute vec4 aSweep, aBeam;
    varying vec3 vW, vN, vC; varying float vS, vK;
    void main(){
      float yaw = aSweep.x * sin(uTime * aSweep.z + aSweep.w), pit = aSweep.y * sin(uTime * aSweep.z * .71 + aSweep.w * 1.9);
      mat3 rx = mat3(1., 0., 0., 0., cos(pit), sin(pit), 0., -sin(pit), cos(pit));
      mat3 ry = mat3(cos(yaw), 0., -sin(yaw), 0., 1., 0., sin(yaw), 0., cos(yaw));
      mat4 m = modelMatrix * instanceMatrix;
      vec3 o = (m * vec4(0., 0., 0., 1.)).xyz;
      float k = max(1., distance(cameraPosition, o + (m * vec4(0., 0., position.z * aBeam.y, 0.)).xyz) * uPx * 1.4 / aBeam.x);
      vec3 p = ry * rx * vec3(position.xy * aBeam.x * k, position.z * aBeam.y);
      vec4 w = m * vec4(p, 1.);
      vW = w.xyz; vN = normalize(mat3(m) * (ry * rx * vec3(position.xy, 0.)));
      vS = position.z; vK = 1. / k; vC = instanceColor * (1. - aBeam.z + aBeam.z * step(.5, fract(uTime * 7.3 + aSweep.w)));
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: `
    uniform float uTime; varying vec3 vW, vN, vC; varying float vS, vK;
    ${FOG_GLSL}
    void main(){
      if (vW.y > uClipTop) discard;
      vec3 v = normalize(cameraPosition - vW);
      float c = abs(dot(normalize(vN), v)), core = pow(c, 14.), halo = pow(c, 2.5);

      // Bright at the source, fading out toward the far end. Haze drifts along the beam.

      float along = smoothstep(0., .015, vS) * (1. - smoothstep(.55, 1., vS)) * mix(1., .45, vS);
      float haze = .93 + .07 * sin(vS * 25. - uTime * 2.);
      float f = clamp(smoothstep(uFogNear, uFogFar, distance(cameraPosition, vW)), 0., 1.);
      vec3 col = (vC * (halo * .45 + core * 1.3) + vec3(core * .7)) * along * haze * vK * (1. - .6 * f);
      gl_FragColor = vec4(col, 1.);
    }`,
}), 4096);
lasers.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(4096 * 3), 3);
lasers.userData.noTile = true; lasers.frustumCulled = false; lasers.count = 0; lasers.renderOrder = 3;
lasers.onBeforeRender = (r, s, cam) => { uPx.value = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) / r.getDrawingBufferSize(_v2).y; };
const _v2 = new THREE.Vector2(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
scene.add(lasers); INSTANCED.push(lasers);

export function laser(a, b, w, rgb, { sweep = [0, 0, 0, 0], blink = 0 } = {}) {
  if (lasers.count >= lasers.instanceMatrix.count) return -1;
  for (const [p, v] of [[_a, a], [_b, b]]) {
    let [x, y, z] = v;
    if (S.FRAME) {
      const dx = x - S.FRAME.cx, dz = z - S.FRAME.cz, tx = S.FRAME.tx ?? S.FRAME.cx, tz = S.FRAME.tz ?? S.FRAME.cz;
      x = tx + dx * S.FRAME.c + dz * S.FRAME.s; z = tz - dx * S.FRAME.s + dz * S.FRAME.c;
      if (S.FRAME.sy) y *= S.FRAME.sy;
    }
    p.set(x, y, z);
  }
  const L = _a.distanceTo(_b);
  if (L < .01) return -1;
  const i = lasers.count++;
  _o.position.copy(_a); _o.scale.set(1, 1, 1); _o.lookAt(_b); _o.updateMatrix();
  lasers.setMatrixAt(i, _o.matrix); lasers.setColorAt(i, _c.setRGB(...rgb));
  aSweep.setXYZW(i, ...sweep); aBeam.setXYZW(i, w, L, blink, 0);
  lasers.instanceMatrix.needsUpdate = lasers.instanceColor.needsUpdate = aSweep.needsUpdate = aBeam.needsUpdate = true;
  return i;
}

// Soft see-through volumes. Alpha fades to zero at the silhouette and near the camera, so smoke and steam
// show no hard rims where they cut through roofs or fill the view.

export function soften(m) {
  m.userData.soft = true;
  m.onBeforeCompile = s => {
    shadowUniforms(s);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying float vSoft;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec3 softN = normal;
        #ifdef USE_INSTANCING
          softN = mat3(instanceMatrix) * softN;
        #endif
        vSoft = abs(dot(normalize(normalMatrix * softN), normalize(-mvPosition.xyz))) * smoothstep(3., 25., -mvPosition.z);`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSoft;')
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= vSoft * vSoft;');
  };
  return m;
}

// See-through smoke or steam. Keep rgb dim and close to the fog colour.

export const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.5, 1),
  soften(new THREE.MeshBasicMaterial({ transparent: true, opacity: .3, depthWrite: false })), 20000);
export const puff = (x, y, z, rad, rgb = [.12, .12, .14]) => put(puffs, x, y, z, rad * 2, rad * 2, rad * 2, 0, 0, rgb);

// Text signs share one 2048 × 4096 atlas of 512 slots, each 256 × 64. Each new text takes a slot; tint above 1 blooms.

export const TEXT = { canvas: document.createElement('canvas'), slots: new Map() };
TEXT.canvas.width = 2048; TEXT.canvas.height = 4096;
TEXT.tex = new THREE.CanvasTexture(TEXT.canvas);
TEXT.tex.colorSpace = THREE.SRGBColorSpace;
TEXT.tex.anisotropy = 8;
export function textSlot(text) {
  if (TEXT.slots.has(text)) return TEXT.slots.get(text);
  const i = TEXT.slots.size % 512, g = TEXT.canvas.getContext('2d'), x = (i % 8) * 256, y = Math.floor(i / 8) * 64;
  g.clearRect(x, y, 256, 64);
  g.save();
  g.beginPath(); g.rect(x, y, 256, 64); g.clip();
  g.font = 'bold 44px "Avenir Next Condensed", "Arial Narrow", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const sc = Math.min(1, 236 / g.measureText(text).width);
  g.translate(x + 128, y + 33); g.scale(sc, 1);
  g.shadowColor = '#fff'; g.shadowBlur = 10; g.fillStyle = '#fff';
  g.fillText(text, 0, 0);
  g.restore();
  TEXT.tex.needsUpdate = true;
  TEXT.slots.set(text, i);
  return i;
}
export const textGeo = new THREE.PlaneGeometry(1, 1);
export const aSlot = new THREE.InstancedBufferAttribute(new Float32Array(20000), 1);
textGeo.setAttribute('aSlot', aSlot);
export const texts = new THREE.InstancedMesh(textGeo, new THREE.ShaderMaterial({
  uniforms: { ...U, uMap: { value: TEXT.tex } }, side: THREE.DoubleSide, transparent: true, depthWrite: false,
  vertexShader: `
    attribute float aSlot; varying vec2 vUv; varying vec3 vW, vTint;
    void main(){
      vec2 cell = vec2(mod(aSlot, 8.), floor(aSlot / 8.));
      vUv = vec2((cell.x + uv.x) / 8., 1. - (cell.y + 1. - uv.y) / 64.);
      vTint = instanceColor; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.); vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: `
    uniform sampler2D uMap; varying vec2 vUv; varying vec3 vW, vTint;
    ${FOG_GLSL}
    ${FOCUS_GLSL}
    void main(){
      if (vW.y > uClipTop || focusCut(vW)) discard;
      float a = texture2D(uMap, vUv).a;
      if (a < .02) discard;
      gl_FragColor = vec4(fogged(vTint * a, vW), a);
    }`,
}), 20000);
texts.setColorAt(0, _c.setRGB(1, 1, 1));

for (const m of [puffs, texts]) { m.frustumCulled = false; m.count = 0; scene.add(m); INSTANCED.push(m); }

// A text plane centred at (x, y, z), w × h, facing ry. rgb tints it.

export function textSign(text, x, y, z, w, h, ry, rgb) {
  const i = put(texts, x, y, z, w, h, 1, ry, 0, rgb);
  if (i >= 0) aSlot.setX(i, textSlot(text));
  return i;
}


export const SKINS = { grid: 0, bands: 1, fins: 2, curtain: 3, sparse: 4, plaster: 5, timber: 6, stone: 7, tile: 8, thatch: 9,
  ashlar: 10, rubble: 11, braced: 12, redframe: 13, quoins: 14, slate: 15, tiles: 16, blindAshlar: 17, blindRubble: 18 };
