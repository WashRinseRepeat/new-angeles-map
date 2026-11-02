// Renderer, scene, camera, post-processing, fog, labels and the ground surfaces.

import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITY, DX, DZ, PLAZA_R, STALK } from './core.js';

// ---------- renderer ----------

// The scene renders into the composer's own target, so the canvas only receives the output pass and needs no MSAA.

export const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

export const labels = new CSS2DRenderer();
labels.setSize(innerWidth, innerHeight);
Object.assign(labels.domElement.style, { position: 'fixed', top: '0', pointerEvents: 'none' });
document.body.appendChild(labels.domElement);

export const scene = new THREE.Scene();
export const FOG = new THREE.Color(0x142036);
scene.background = FOG;
scene.fog = new THREE.Fog(FOG, 400, 3800);

// Fog distances are tuned for a close view and grow with the camera's distance from its target.

export const FOG_BASE = { near: 850, far: 3900 };
export const hemi = new THREE.HemisphereLight(0x7f9cc8, 0x1a1410, 1.5);
scene.add(hemi);
export const moon = new THREE.DirectionalLight(0x8899cc, 0.7);
moon.position.set(300, 800, 200);
scene.add(moon);

export const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 3, 12000);

// The start view looks north-east from over Rutherford, up through Base de Cayambe to the Beanstalk.

camera.position.set(-1450, 1350, 1330);
export const controls = new MapControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(-220, 0, -10);
controls.maxPolarAngle = Math.PI * 0.46;
controls.minDistance = 20;
controls.maxDistance = 4200;

// Direct manipulation, as in Google Maps. Nothing eases.
// - One finger or the left mouse button grabs the ground. The point under it stays under it.
// - Two fingers pan, pinch-zoom and twist about their midpoint.
// - Two fingers side by side that slide up or down together tilt the view.
// MapControls keeps the mouse's right-button rotate and wheel zoom.

controls.enablePan = false;
controls.touches = { ONE: -1, TWO: -1 };
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), grabRay = new THREE.Raycaster(), ndc = new THREE.Vector2();
const UP = new THREE.Vector3(0, 1, 0), orbit = new THREE.Spherical();
const groundAt = (x, y, out) => {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
  grabRay.setFromCamera(ndc, camera);
  const p = grabRay.ray.intersectPlane(GROUND, out);
  return p && p.distanceTo(camera.position) < 8000 ? p : null;
};
const grab = new THREE.Vector3(), now = new THREE.Vector3(), shift = new THREE.Vector3();
const pA = new THREE.Vector3(), pB = new THREE.Vector3(), cA = new THREE.Vector3(), cB = new THREE.Vector3();
const touches = new Map(), pivot = new THREE.Vector3();
let grabbing = false, mode = null, first = null, prev = null;

// An open card locks the orbit on its subject. Drags and one finger then turn the view, pinches and the wheel
// zoom toward the target, and nothing pans.

export const LOCK = { on: false };
export function lockCamera(on) {
  LOCK.on = on;
  controls.mouseButtons.LEFT = on ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
  controls.touches = on ? { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE } : { ONE: -1, TWO: -1 };
  grabbing = false; mode = null; touches.clear();
}

// Several moves can arrive in one frame, so the next ray needs the moved camera at once.

const settle = () => { camera.lookAt(controls.target); camera.updateMatrixWorld(); };
const panTo = (x, y, from) => {
  if (!groundAt(x, y, now)) return;
  shift.subVectors(from, now);
  camera.position.add(shift);
  controls.target.add(shift);
  settle();
};
const pair = () => {
  const [a, b] = touches.values();
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(b.x - a.x, b.y - a.y), a: Math.atan2(b.y - a.y, b.x - a.x), ax: a.x, ay: a.y, bx: b.x, by: b.y };
};

// A two-finger gesture picks its mode once the fingers have moved a little.

const pickMode = cur => {
  const da = cur.ay - first.ay, db = cur.by - first.by;
  if (Math.abs(da) + Math.abs(db) + Math.abs(cur.d - first.d) < 16) return null;
  const sideBySide = Math.abs(Math.sin(first.a)) < .5;
  return sideBySide && Math.sign(da) === Math.sign(db) && Math.min(Math.abs(da), Math.abs(db)) > 6 && Math.abs(cur.d - first.d) < 24 ? 'tilt' : 'map';
};
const twoFingers = cur => {
  if (mode === 'tilt') {
    orbit.setFromVector3(shift.subVectors(camera.position, controls.target));
    orbit.phi = THREE.MathUtils.clamp(orbit.phi - (cur.y - prev.y) * .006, .05, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(shift.setFromSpherical(orbit));
    settle();
    return;
  }

  // The ground points under the fingers at the last move (pA, pB) and now (cA, cB) define one ground similarity.
  // Moving the camera by it puts both grabbed points back under the fingers, at any tilt.

  if (!groundAt(prev.ax, prev.ay, pA) || !groundAt(prev.bx, prev.by, pB) || !groundAt(cur.ax, cur.ay, cA) || !groundAt(cur.bx, cur.by, cB)) return;
  const span = cA.distanceTo(cB), dist = camera.position.distanceTo(controls.target);
  if (span < .01) return;
  const k = THREE.MathUtils.clamp(pA.distanceTo(pB) / span, controls.minDistance / dist, controls.maxDistance / dist);
  const turn = Math.atan2(cA.z - cB.z, cA.x - cB.x) - Math.atan2(pA.z - pB.z, pA.x - pB.x);
  for (const v of [camera.position, controls.target]) v.sub(cA).multiplyScalar(k).applyAxisAngle(UP, turn).add(pA);
  settle();
};

const el = renderer.domElement;
el.addEventListener('pointerdown', e => {
  if (!controls.enabled || LOCK.on) return;
  if (e.pointerType !== 'touch') { grabbing = e.button === 0 && !!groundAt(e.clientX, e.clientY, grab); return; }
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  grabbing = touches.size === 1 && !!groundAt(e.clientX, e.clientY, grab);
  if (touches.size === 2) { mode = null; first = prev = pair(); }
});
el.addEventListener('pointermove', e => {
  if (!controls.enabled || LOCK.on) return;
  if (e.pointerType !== 'touch') { if (grabbing) panTo(e.clientX, e.clientY, grab); return; }
  if (!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 1 && grabbing) return panTo(e.clientX, e.clientY, grab);
  if (touches.size !== 2) return;
  const cur = pair();
  if (!mode && (mode = pickMode(cur))) prev = cur;
  if (mode) { twoFingers(cur); prev = cur; }
});

// Lifting one of two fingers hands the pan to the finger that stays.

const release = e => {
  grabbing = false;
  if (!touches.delete(e.pointerId)) return;
  mode = null;
  if (touches.size === 1) { const [t] = touches.values(); grabbing = !!groundAt(t.x, t.y, grab); }
};
el.addEventListener('pointerup', release);
el.addEventListener('pointercancel', release);

// Trackpads, as on a MacBook: two fingers slide the map, a pinch zooms about the cursor, and ⌥ with two fingers
// turns and tilts. Browsers send the slide as a wheel event and the pinch as a wheel event with ctrlKey.
// Safari also sends pinch and twist as gesture events. A mouse wheel keeps MapControls' zoom.
// A mouse wheel sends notches: line steps, whole steps of 40 px or more, or in Chrome on macOS multiples of
// 4.000244140625 px. A trackpad slide starts with small pixel steps or a sideways part. Each burst of wheel
// events keeps the device it started with, so a slow trackpad tail never turns into a zoom.

const MAC_NOTCH = 4.000244140625;
const notch = e => e.deltaMode !== 0 || e.deltaY !== 0 && (e.deltaY % MAC_NOTCH === 0 || Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40);
const padLike = e => e.ctrlKey || e.deltaX !== 0 || !notch(e);
const zoomAbout = (p, k) => {
  const dist = camera.position.distanceTo(controls.target);
  k = THREE.MathUtils.clamp(k, controls.minDistance / dist, controls.maxDistance / dist);
  for (const v of [camera.position, controls.target]) v.sub(p).multiplyScalar(k).add(p);
  settle();
};
const turnAbout = (p, a) => {
  for (const v of [camera.position, controls.target]) v.sub(p).applyAxisAngle(UP, a).add(p);
  settle();
};
let pad = false, padUntil = 0, gesture = null;
addEventListener('wheel', e => {
  if (e.target !== el || !controls.enabled) return;
  const t = performance.now();
  if (t > padUntil) pad = padLike(e);
  padUntil = t + 250;
  controls.enableZoom = !pad;
  if (!pad) return;
  e.preventDefault();

  // While locked, a pinch zooms toward the target and a slide turns the view. turnAbout gets a copy of the
  // target, because it moves the target too.

  if (e.ctrlKey) {
    if (LOCK.on) zoomAbout(pivot.copy(controls.target), Math.exp(e.deltaY * .01));
    else if (!gesture && groundAt(e.clientX, e.clientY, grab)) zoomAbout(grab, Math.exp(e.deltaY * .01));
    return;
  }
  if (e.altKey || LOCK.on) {
    turnAbout(pivot.copy(controls.target), e.deltaX * .005);
    orbit.setFromVector3(shift.subVectors(camera.position, controls.target));
    orbit.phi = THREE.MathUtils.clamp(orbit.phi - e.deltaY * .004, .05, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(shift.setFromSpherical(orbit));
    settle();
    return;
  }
  if (groundAt(e.clientX, e.clientY, grab)) panTo(e.clientX - e.deltaX, e.clientY - e.deltaY, grab);
}, { capture: true, passive: false });
el.addEventListener('gesturestart', e => { e.preventDefault(); gesture = { s: 1, r: 0 }; });
el.addEventListener('gesturechange', e => {
  e.preventDefault();
  if (!gesture || !controls.enabled || !(LOCK.on ? pivot.copy(controls.target) : groundAt(e.clientX, e.clientY, grab))) return;
  const at = LOCK.on ? pivot : grab;
  zoomAbout(at, gesture.s / e.scale);
  turnAbout(at, (e.rotation - gesture.r) * Math.PI / 180);
  gesture = { s: e.scale, r: e.rotation };
});
el.addEventListener('gestureend', e => { e.preventDefault(); gesture = null; });

export const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// Cloud layers live in their own small scene, so the main pass skips them and the cloud pass walks only
// them. They march at half resolution into their own target and stop where the scene's depth says a building
// or a mountain is in the way. Both composer targets carry depth, because the buffers swap. Packed 24-bit
// depth with stencil stores faster than 32-bit.

export const CLOUD_SCENE = new THREE.Scene();
CLOUD_SCENE.matrixWorldAutoUpdate = false;
export const CLOUD_U = { uDepth: { value: null }, uLowRes: { value: new THREE.Vector2(1, 1) }, uNear: { value: camera.near }, uFar: { value: camera.far } };
for (const t of [composer.renderTarget1, composer.renderTarget2]) {
  t.depthTexture = new THREE.DepthTexture(t.width, t.height, THREE.UnsignedInt248Type);
  t.depthTexture.format = THREE.DepthStencilFormat;
}

class CloudPass extends Pass {
  constructor() {
    super();
    this.needsSwap = false;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  }
  setSize(w, h) {
    for (const t of [composer.renderTarget1, composer.renderTarget2]) Object.assign(t.depthTexture.image, { width: t.width, height: t.height });
    this.rt.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    CLOUD_U.uLowRes.value.set(this.rt.width, this.rt.height);
  }
  render(r, writeBuffer, readBuffer) {
    CLOUD_U.uDepth.value = readBuffer.depthTexture;

    // Rides pull the near plane in, so the depth decode follows the camera each frame.

    CLOUD_U.uNear.value = camera.near; CLOUD_U.uFar.value = camera.far;
    const clear = r.getClearAlpha(), color = r.getClearColor(new THREE.Color());
    r.setRenderTarget(this.rt);
    r.setClearColor(0, 0);
    r.clear(true, false, false);
    r.render(CLOUD_SCENE, camera);
    r.setClearColor(color, clear);
    r.setRenderTarget(readBuffer);
  }
}
const clouds = new CloudPass();
composer.addPass(clouds);
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.35, 1.0);
composer.addPass(bloom);

// The output pass adds the bloom and lays the clouds over the frame before tone mapping, so neither needs a
// full-screen pass of its own. Bloom's own additive blend is switched off, and the output adds the same
// rgb × alpha. Clouds stay under the bloom threshold, so bloom loses nothing by skipping them. Each of the
// four nearest cloud texels counts by its bilinear weight, cut down when the scene depth at its centre
// differs from the depth here, so cloud never bleeds across a near silhouette. Clear sky skips that.

bloom.blendMaterial.visible = false;
const output = new OutputPass();
Object.assign(output.uniforms, { tBloom: { value: bloom.renderTargetsHorizontal[0].texture }, uBloom: { value: 1 }, tCloud: { value: clouds.rt.texture }, tDepth: { value: null }, uLow: CLOUD_U.uLowRes, uNear: CLOUD_U.uNear, uFar: CLOUD_U.uFar });
output.material.fragmentShader = output.material.fragmentShader
  .replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse, tBloom, tCloud, tDepth; uniform vec2 uLow; uniform float uBloom, uNear, uFar;')
  .replace('varying vec2 vUv;', `varying vec2 vUv;
    float dist(vec2 uv) { return uNear * uFar / (uFar - (uFar - uNear) * texture2D(tDepth, uv).r); }
    vec4 clouds() {
      vec4 c = texture2D(tCloud, vUv);
      if (c.a < .002) return c;
      float z = dist(vUv);
      vec2 p = vUv * uLow - .5, i = floor(p), f = p - i;
      vec4 sum = vec4(0.); float wsum = 0.;
      for (int k = 0; k < 4; k++) {
        vec2 o = vec2(mod(float(k), 2.), floor(float(k) / 2.)), uv = (i + o + .5) / uLow;
        float w = mix(1. - f.x, f.x, o.x) * mix(1. - f.y, f.y, o.y) / (.002 + abs(dist(uv) - z) / z);
        sum += texture2D(tCloud, uv) * w; wsum += w;
      }
      return sum / max(wsum, 1e-6);
    }`)
  .replace('gl_FragColor = texture2D( tDiffuse, vUv );', `vec4 c = clouds(), b = texture2D(tBloom, vUv);
    gl_FragColor = texture2D( tDiffuse, vUv );
    gl_FragColor.rgb = (gl_FragColor.rgb + uBloom * b.rgb * b.a) * (1. - c.a) + c.rgb;`);
const outputRender = output.render.bind(output);
output.render = (r, writeBuffer, readBuffer, ...rest) => {
  output.uniforms.tDepth.value = readBuffer.depthTexture;
  output.uniforms.uBloom.value = bloom.enabled ? 1 : 0;
  outputRender(r, writeBuffer, readBuffer, ...rest);
};
composer.addPass(output);

// SMAA smooths jagged edges in the final image. Only the ultra level turns it on.

const smaa = new SMAAPass(innerWidth, innerHeight);
smaa.enabled = false;
composer.addPass(smaa);

// Quality levels trade sharpness, bloom, traffic and prop range for frame rate. Auto starts at medium on touch
// screens and steps down when frames drop. cars scales street and highway traffic; detail is the prop range in metres;
// fog scales the fog distances, and tiles past the fog stop drawing.
// Ultra is picked by hand. It renders at 1.5 times the screen's pixel ratio, up to 3, and adds SMAA.

export const QUALITY_LEVELS = {
  ultra: { dpr: 3, ss: 1.5, smaa: true, bloom: true, cars: 1, detail: 1400, fog: 1 },
  high: { dpr: 2, bloom: true, cars: 1, detail: 1400, fog: 1 },
  medium: { dpr: 1.5, bloom: true, cars: .55, detail: 1000, fog: .85 },
  low: { dpr: 1, bloom: false, cars: .3, detail: 650, fog: .6 },
};
export const QUALITY = { mode: 'auto', level: matchMedia('(pointer: coarse)').matches ? 'medium' : 'high', ...QUALITY_LEVELS.high };
export function applyQuality(level) {
  Object.assign(QUALITY, { ss: 1, smaa: false }, QUALITY_LEVELS[level], { level });
  const dpr = Math.min(devicePixelRatio * QUALITY.ss, QUALITY.dpr);
  renderer.setPixelRatio(dpr);
  composer.setPixelRatio(dpr);
  bloom.enabled = QUALITY.bloom;
  smaa.enabled = QUALITY.smaa;
}
applyQuality(QUALITY.level);

export const U = {
  uTime: { value: 0 }, uFog: { value: FOG }, uFogNear: { value: 400 }, uFogFar: { value: 3800 },
  uBlend: { value: 230 }, uStalk: { value: STALK }, uPlaza: { value: PLAZA_R },
  uMist: { value: .32 }, uWin: { value: 1 }, uEdge: { value: 1 }, uClipTop: { value: 1e5 }, uMistBase: { value: 0 },
  uFocus: { value: new THREE.Vector4(0, 0, 0, 1) }, uFocusB: { value: new THREE.Vector3(1, 1, 1) }, uFocusK: { value: new THREE.Vector3(1, 0, 0) },
};

// An open card thins out what stands between the camera and its subject. The subject is a box: centre
// uFocus.xyz, half sizes uFocusB, turned by the cosine and sine in uFocusK.xy. A pixel drops out when the ray
// from the camera through it hits the box farther on, so the thinned window takes the subject's outline.
// The box grows by uFocus.w for the window's edge, which thins half as much. An ordered 4 × 4 dither keeps
// about 30% of the pixels. Ground-level pixels, the subject itself and anything within 15 m of the camera, such
// as the train on a ride, stay solid. uFocusK.z eases the effect in and out; at 0 the test returns at once.

export const FOCUS_GLSL = `
  uniform vec4 uFocus; uniform vec3 uFocusB, uFocusK;
  float focusB2(vec2 a) { a = mod(floor(a), 2.); return fract(a.x * .5 + a.y * .75); }
  float focusHit(vec3 o, vec3 inv, vec3 b) {
    vec3 t0 = (-b - o) * inv, t1 = (b - o) * inv, lo = min(t0, t1), hi = max(t0, t1);
    float tn = max(max(lo.x, lo.y), lo.z), tf = min(min(hi.x, hi.y), hi.z);
    return tn > 1. && tf > tn ? 1. : 0.;
  }
  bool focusCut(vec3 w) {
    if (uFocusK.z <= 0. || w.y < 2. || distance(w, cameraPosition) < 15.) return false;
    vec2 cs = uFocusK.xy;
    vec3 o = cameraPosition - uFocus.xyz, q = w - uFocus.xyz;
    o = vec3(o.x * cs.x - o.z * cs.y, o.y, o.x * cs.y + o.z * cs.x);
    q = vec3(q.x * cs.x - q.z * cs.y, q.y, q.x * cs.y + q.z * cs.x);
    if (all(lessThan(abs(q), uFocusB + 2.))) return false;
    vec3 inv = 1. / (q - o + 1e-5);
    float fade = uFocusK.z * .5 * (focusHit(o, inv, uFocusB + uFocus.w * .4) + focusHit(o, inv, uFocusB + uFocus.w));
    return focusB2(gl_FragCoord.xy * .5) * .25 + focusB2(gl_FragCoord.xy) >= 1. - .7 * fade;
  }
`;

// A discard in a shader costs the GPU its early depth test, even when it never runs. So built-in materials keep
// no cut, and an open card swaps their meshes to twins that carry it. A twin shares its original's colours and
// runs the original's own onBeforeCompile first.

const BASE_KEY = THREE.Material.prototype.customProgramCacheKey, TWINS = new WeakMap();
export function fadeTwin(m) {
  if (TWINS.has(m)) return TWINS.get(m);
  const t = m.clone(), prev = m.onBeforeCompile, key = m.customProgramCacheKey === BASE_KEY ? () => prev.toString() : m.customProgramCacheKey.bind(m);
  for (const k of ['color', 'emissive']) if (m[k]) t[k] = m[k];
  t.onBeforeCompile = (s, r) => {
    prev.call(t, s, r);
    s.uniforms.uFocus = U.uFocus; s.uniforms.uFocusB = U.uFocusB; s.uniforms.uFocusK = U.uFocusK;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFocusW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 focusW = vec4(transformed, 1.);
        #ifdef USE_INSTANCING
          focusW = instanceMatrix * focusW;
        #endif
        vFocusW = (modelMatrix * focusW).xyz;`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vFocusW;\n${FOCUS_GLSL}`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (focusCut(vFocusW)) discard;');
  };
  t.customProgramCacheKey = () => `${key()}|fade`;
  TWINS.set(m, t);
  return t;
}
export const FOG_GLSL = `
  uniform vec3 uFog; uniform float uFogNear, uFogFar, uMist, uMistBase, uClipTop;
  vec3 fogged(vec3 c, vec3 w) {
    float dist = distance(cameraPosition, w);
    float mist = exp(-max(w.y - uMistBase, 0.) / 14.) * uMist * smoothstep(40., 600., dist);
    return mix(c, uFog * 1.2, clamp(smoothstep(uFogNear, uFogFar, dist) + mist, 0., 1.));
  }
`;

// Shared water look for lakes and the sea: swell and ripple normals, moon glint, sky reflection,
// sparse sparkles that read as reflected lights, and a foam line where shallow says the shore is.
// Sparkles smaller than a pixel fade out so they do not shimmer at a distance.

export const WATER_GLSL = `
  uniform vec3 uMoonDir;
  float wHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  vec3 waterColor(vec3 w, float shallow, float warm) {
    vec2 p = w.xz;
    float t = uTime;
    vec3 n = normalize(vec3(
      sin(p.x * .021 + t * .5) * .05 + sin((p.x + p.y) * .047 - t * .7) * .03 + sin(p.x * .19 + p.y * .07 + t * 1.9) * .012,
      1.,
      sin(p.y * .017 - t * .4) * .05 + sin((p.x - p.y) * .039 + t * .6) * .03 + sin(p.y * .23 - p.x * .05 - t * 2.3) * .012));
    vec3 v = normalize(cameraPosition - w);
    float spec = pow(max(dot(reflect(-uMoonDir, n), v), 0.), 60.);
    float fres = pow(1. - max(dot(n, v), 0.), 4.);
    vec3 col = vec3(.004, .009, .016) + uFog * fres * .45 + vec3(.16, .19, .24) * spec;
    vec2 cell = floor(p / 5.);
    float h = wHash(cell), tw = .5 + .5 * sin(t * (2. + h * 3.) + h * 40.);
    float sharp = 1. - smoothstep(.6, 2.5, max(fwidth(p.x), fwidth(p.y)));
    vec2 f = fract(p / 5.) - .5 + (vec2(wHash(cell + 7.), wHash(cell + 13.)) - .5) * .5;
    float glint = step(.97 - warm * .05, h) * tw * sharp * smoothstep(.16, 0., length(f * vec2(1., .3)));
    col += mix(vec3(.5, .6, .8), vec3(1., .62, .3), warm) * glint * .35;
    float foam = shallow * (.55 + .45 * sin(t * 1.3 + p.x * .05 + p.y * .03 + h * 2.));
    col += vec3(.1, .12, .14) * foam;
    return col;
  }
`;

// ---------- ground: foothill terrain, city asphalt, pavement blocks, Root plaza ----------

// A landmark that sinks below grade cuts a hole in the ground. Every ground surface discards fragments
// inside a hole rectangle: world centre, rotation (cos, sin) and half size, as two vec4 per hole.

const HOLE_MAX = 4, HOLES = { uHoles: { value: Array.from({ length: HOLE_MAX * 2 }, () => new THREE.Vector4()) }, uHoleN: { value: 0 } };
const HOLE_GLSL = `
  uniform vec4 uHoles[${HOLE_MAX * 2}]; uniform int uHoleN; varying vec2 vHole;
  bool inHole(vec2 p) {
    for (int i = 0; i < ${HOLE_MAX}; i++) {
      if (i >= uHoleN) break;
      vec4 a = uHoles[i * 2]; vec2 d = p - a.xy, h = uHoles[i * 2 + 1].xy;
      if (abs(d.x * a.z - d.y * a.w) < h.x && abs(d.x * a.w + d.y * a.z) < h.y) return true;
    }
    return false;
  }`;
export function addHole(x, z, a, w, d) {
  if (HOLES.uHoleN.value >= HOLE_MAX) return console.warn('ground hole limit reached');
  const i = HOLES.uHoleN.value++ * 2;
  HOLES.uHoles.value[i].set(x, z, Math.cos(a), Math.sin(a));
  HOLES.uHoles.value[i + 1].set(w / 2, d / 2, 0, 0);
}
const MAIN = /void main\s*\(\s*\)\s*\{/;
export function holed(mat) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, HOLES);
    sh.vertexShader = sh.vertexShader.replace(MAIN, m => `varying vec2 vHole;\n${m} vHole = (modelMatrix * vec4(position, 1.)).xz;`);
    sh.fragmentShader = sh.fragmentShader.replace(MAIN, m => `${HOLE_GLSL}\n${m} if (inHole(vHole)) discard;`);
  };
  return mat;
}

export const SURFACE = [];
export const surface = m => { if (m.material) holed(m.material); SURFACE.push(m); scene.add(m); return m; };
export const toShape = poly => new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
export const flatGeo = (polys, y) => mergeGeometries(polys.map(p => new THREE.ShapeGeometry(toShape(p)))).rotateX(-Math.PI / 2).translate(0, y, 0);
export const outerGround = surface(new THREE.Mesh(new THREE.PlaneGeometry(DX + 40, DZ + 40).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x0c140f, roughness: 1, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 })));
surface(new THREE.Mesh(flatGeo(CITY.districts.map(d => d.poly), .03), new THREE.ShaderMaterial({
  uniforms: U, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `
    uniform float uTime, uPlaza; uniform vec2 uStalk; varying vec3 vW;
    ${FOG_GLSL}
    void main(){
      vec3 col = vec3(.048, .05, .058);
      float ds = distance(vW.xz, uStalk);
      if (ds < uPlaza) {
        col = vec3(.03, .035, .045);
        float ring = 1. - smoothstep(0., .8, abs(mod(ds - uTime * 6., 16.) - 8.));
        col += vec3(.2, .8, 1.2) * ring * .25 * (1. - ds / uPlaza);
      }
      gl_FragColor = vec4(fogged(col, vW), 1.);
    }`,
})));
surface(new THREE.Mesh(flatGeo(CITY.blocks, .08), new THREE.MeshStandardMaterial({ color: 0x24262d, emissive: 0x121317, roughness: .95, side: THREE.DoubleSide })));

// Inland water (the reservoir, the Waterways) and the big parks cut out of the street grid.
// Chaikin corner cutting rounds the traced outlines, so shores and park edges read as land, not polygons.

export function smoothPoly(P, n = 3) {
  for (let k = 0; k < n; k++) P = P.flatMap((a, i) => {
    const b = P[(i + 1) % P.length];
    return [[a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]];
  });
  return P;
}

U.uMoonDir = { value: new THREE.Vector3(300, 800, 200).normalize() };
export const WATER_MAT = new THREE.ShaderMaterial({
  uniforms: U, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, side: THREE.DoubleSide,
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `
    uniform float uTime; varying vec3 vW;
    ${FOG_GLSL}
    ${WATER_GLSL}
    void main(){
      if (vW.y > uClipTop) discard;
      gl_FragColor = vec4(fogged(waterColor(vW, 0., 1.) + vec3(.01, .008, .005), vW), 1.);
    }`,
});
surface(new THREE.Mesh(flatGeo((CITY.water ?? []).map(w => smoothPoly(w.poly)), .12), WATER_MAT));
surface(new THREE.Mesh(flatGeo((CITY.parks ?? []).map(w => smoothPoly(w.poly)), .1),
  new THREE.MeshStandardMaterial({ color: 0x18261a, emissive: 0x0a140b, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));

// ---------- diorama: the city sits on a slab above dark water ----------

export const slab = surface(new THREE.Mesh(new THREE.BoxGeometry(DX + 40, 80, DZ + 40).translate(0, -40.05, 0),
  new THREE.MeshStandardMaterial({ color: 0x0d1118, roughness: .9 })));
export const water = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x06101e, roughness: .15, metalness: .6 }));
water.position.y = -18;
surface(water);

// Labels sit in their own group, so the label renderer walks only them and not the whole scene.

export const labelRoot = new THREE.Group();
scene.add(labelRoot);
export function label(text, cls, pos, color) {
  const el = document.createElement('div');
  el.className = cls; el.textContent = text;
  if (color) {
    const rgb = `rgb(${color.map(c => Math.min(255, c * 95)).join(',')})`;
    el.style.setProperty('--c', rgb);
    if (!cls.includes('place')) el.style.color = rgb;
  }
  const o = new CSS2DObject(el); o.position.copy(pos); labelRoot.add(o);
  el.obj = o;
  return el;
}
