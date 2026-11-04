// Renderer, scene, camera, post-processing, fog, labels and the ground surfaces.

import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CENTRE, CENTRE_R, CITY, DX, DZ, rng } from './core.js';
import { CLOCK, SETTING } from './setting.js';
import { RELIEF, groundAt as groundY } from './relief.js';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { EDGE_GLSL, EDGE_U } from './edge.js';

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

// The pack sets the look: fog and sky colour, the sky and ground light, and the moon. A pack's look.sky is a gradient,
// [zenith, horizon, below] as hex colours, wrapped round the scene. Without it the sky is the fog colour. Under a clock,
// daylight.js draws the sky instead.

function skyTexture([top, mid, low]) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 256), hex = v => `#${new THREE.Color(v).getHexString()}`;
  grad.addColorStop(0, hex(top)); grad.addColorStop(.48, hex(mid)); grad.addColorStop(.52, hex(mid)); grad.addColorStop(1, hex(low ?? mid));
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const LOOK = SETTING.look, CAM = SETTING.camera;
export const scene = new THREE.Scene();
export const FOG = new THREE.Color(LOOK.fog);
scene.background = LOOK.sky && !CLOCK ? skyTexture(LOOK.sky) : FOG;
scene.fog = new THREE.Fog(FOG, ...LOOK.fogStart);

// Fog distances are tuned for a close view and grow with the camera's distance from its target.

export const FOG_BASE = { ...LOOK.fogBase };
export const hemi = new THREE.HemisphereLight(...LOOK.hemi);
scene.add(hemi);
export const moon = new THREE.DirectionalLight(LOOK.moon[0], LOOK.moon[1]);
moon.position.set(...LOOK.moon[2]);
scene.add(moon);

// The pack sets the lens, the start view and the zoom and tilt limits.

export const camera = new THREE.PerspectiveCamera(CAM.fov, innerWidth / innerHeight, CAM.near, CAM.far);
camera.position.set(...CAM.position);
export const controls = new MapControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(...CAM.target);
controls.maxPolarAngle = Math.PI * CAM.maxPolar;
controls.minDistance = CAM.minDistance;
controls.maxDistance = CAM.maxDistance;

// Direct manipulation, as in Google Maps. Nothing eases.
// - One finger or the left or middle mouse button grabs the ground. The point under it stays under it.
// - Two fingers pan, pinch-zoom and twist about their midpoint.
// - Two fingers side by side that slide up or down together tilt the view.
// MapControls keeps the mouse's right-button rotate and wheel zoom.

controls.enablePan = false;
controls.mouseButtons.MIDDLE = -1;
controls.touches = { ONE: -1, TWO: -1 };
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), grabRay = new THREE.Raycaster(), ndc = new THREE.Vector2();
const UP = new THREE.Vector3(0, 1, 0), orbit = new THREE.Spherical();
const groundAt = (x, y, out) => {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
  grabRay.setFromCamera(ndc, camera);
  if (RELIEF) GROUND.constant = -controls.target.y;
  const p = grabRay.ray.intersectPlane(GROUND, out);
  return p && p.distanceTo(camera.position) < CAM.groundReach ? p : null;
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
  controls.mouseButtons.MIDDLE = on ? THREE.MOUSE.DOLLY : -1;
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
  if (e.button === 1) e.preventDefault();
  if (e.pointerType !== 'touch') { grabbing = e.button < 2 && !!groundAt(e.clientX, e.clientY, grab); return; }
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
// ---------- contact shadows ----------

// A pack whose look.ao is set darkens creases: where walls meet the ground, narrow lanes and under eaves. The pass
// reads the scene's depth, so it draws nothing again. At half resolution each pixel rebuilds its position and
// facing from depth and tests 16 points in the half sphere above it; points behind the depth there count as
// covered. A 4 × 4 blur that skips pixels at other depths smooths the noise, and the result multiplies into the
// frame before the clouds and bloom. It fades out towards reach, skips pixels past it, and is off at low quality.
// look.ao keys, with their defaults: radius 2.5 (metres), strength .7, reach 500 (metres from the camera).

const AO = LOOK.ao && { radius: 2.5, strength: .7, reach: 500, ...LOOK.ao };
const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const VIEW_GLSL = `
  uniform sampler2D tDepth; uniform mat4 uInv;
  vec3 viewAt(vec2 uv) { vec4 v = uInv * vec4(vec3(uv, texture2D(tDepth, uv).r) * 2. - 1., 1.); return v.xyz / v.w; }`;

class AOPass extends Pass {
  constructor() {
    super();
    this.needsSwap = false;
    const r = rng(7), K = [];
    for (let i = 0; i < 16; i++) {
      const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r()).normalize(), t = (i + 1) / 16;
      K.push(v.multiplyScalar(.15 + .85 * t * t));
    }
    const target = () => new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    this.raw = target(); this.soft = target();
    this.u = { tDepth: { value: null }, uInv: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Matrix4() },
      uK: { value: K }, uTexel: { value: new THREE.Vector2() }, uLow: { value: new THREE.Vector2() },
      uAO: { value: new THREE.Vector3(AO.radius, AO.strength, AO.reach) }, tAO: { value: null } };
    const quad = (fragmentShader, extra = {}) => new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: QUAD_VS,
      fragmentShader, depthTest: false, depthWrite: false, ...extra }));

    // Each pixel reads depth at the centre of a full resolution texel, as a half resolution pixel falls between two.
    // Facing comes from the nearer of each pair of neighbours, so it holds at silhouettes. The depth margin grows
    // with distance, so flat ground does not cover itself.

    this.ao = quad(`
      ${VIEW_GLSL}
      uniform mat4 uProj; uniform vec3 uK[16], uAO; uniform vec2 uTexel; varying vec2 vUv;
      void main() {
        vec2 uv = (floor(vUv / uTexel) + .5) * uTexel;
        if (texture2D(tDepth, uv).r >= 1.) { gl_FragColor = vec4(1.); return; }
        vec3 p = viewAt(uv);
        if (-p.z >= uAO.z) { gl_FragColor = vec4(1.); return; }
        vec3 l = viewAt(uv - vec2(uTexel.x, 0.)), r = viewAt(uv + vec2(uTexel.x, 0.));
        vec3 d = viewAt(uv - vec2(0., uTexel.y)), u = viewAt(uv + vec2(0., uTexel.y));
        vec3 n = normalize(cross(abs(r.z - p.z) < abs(p.z - l.z) ? r - p : p - l, abs(u.z - p.z) < abs(p.z - d.z) ? u - p : p - d));
        if (dot(n, p) > 0.) n = -n;
        vec2 f = mod(gl_FragCoord.xy, 4.);
        float a = (f.x + f.y * 4.) * .3927;
        vec3 spin = normalize(vec3(cos(a), sin(a), .6));
        float hit = 0.;
        for (int i = 0; i < 16; i++) {
          vec3 s = reflect(uK[i], spin);
          if (dot(s, n) < 0.) s = -s;
          vec3 q = p + s * uAO.x;
          vec4 c = uProj * vec4(q, 1.);
          vec2 at = c.xy / c.w * .5 + .5;
          float z = viewAt(at).z;
          hit += step(q.z + .03 * uAO.x - .002 * p.z, z) * smoothstep(0., 1., uAO.x / abs(p.z - z));
        }
        float ao = mix(1. - hit / 16., 1., smoothstep(uAO.z * .6, uAO.z, -p.z));
        gl_FragColor = vec4(vec3(ao), 1.);
      }`);
    this.blur = quad(`
      ${VIEW_GLSL}
      uniform sampler2D tAO; uniform vec2 uLow; uniform vec3 uAO; varying vec2 vUv;
      void main() {
        float z = viewAt(vUv).z, sum = 0., w = 0.;
        if (-z >= uAO.z) { gl_FragColor = vec4(1.); return; }
        for (int i = -2; i < 2; i++) for (int j = -2; j < 2; j++) {
          vec2 at = vUv + (vec2(i, j) + .5) / uLow;
          float k = 1. / (1. + abs(viewAt(at).z - z) * 4.);
          sum += texture2D(tAO, at).r * k; w += k;
        }
        gl_FragColor = vec4(vec3(sum / w), 1.);
      }`);

    // The frame keeps its colour times the light left: zero times the source plus the source colour times the frame.

    this.mix = quad(`
      uniform sampler2D tAO; uniform vec3 uAO; varying vec2 vUv;
      void main() { gl_FragColor = vec4(vec3(mix(1., texture2D(tAO, vUv).r, uAO.y)), 1.); }`,
    { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor });
  }
  setSize(w, h) {
    this.raw.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    this.soft.setSize(this.raw.width, this.raw.height);
    this.u.uTexel.value.set(1 / w, 1 / h);
    this.u.uLow.value.set(this.raw.width, this.raw.height);
  }
  render(r, writeBuffer, readBuffer) {
    // The nearest thing in view is at least as far as the frame's lowest ray takes to fall to 150 m over the target.
    // When even that is past reach, the pass would only multiply the frame by one, so it skips.

    const rise = camera.position.y - controls.target.y, fall = Math.asin(Math.min(1, rise / camera.position.distanceTo(controls.target)));
    const nearest = (rise - 150) / Math.sin(Math.min(Math.PI / 2, fall + THREE.MathUtils.degToRad(camera.fov / 2)));
    if (QUALITY.level === 'low' || nearest > AO.reach) return;
    const U = this.u, clear = r.autoClear;
    U.tDepth.value = readBuffer.depthTexture;
    U.uProj.value.copy(camera.projectionMatrix);
    U.uInv.value.copy(camera.projectionMatrixInverse);
    r.setRenderTarget(this.raw); this.ao.render(r);
    U.tAO.value = this.raw.texture;
    r.setRenderTarget(this.soft); this.blur.render(r);
    U.tAO.value = this.soft.texture;
    r.autoClear = false;
    r.setRenderTarget(readBuffer); this.mix.render(r);
    r.autoClear = clear;
  }
}
export const aoPass = AO ? new AOPass() : null;
if (aoPass) composer.addPass(aoPass);
const clouds = new CloudPass();
composer.addPass(clouds);
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), ...LOOK.bloom);
composer.addPass(bloom);

// Bloom's blur spreads one NaN or Inf pixel into a black box, so its bright-pass turns any such pixel to 0.
// The test is written so a NaN fails it.

bloom.materialHighPassFilter.fragmentShader = bloom.materialHighPassFilter.fragmentShader.replace(
  'vec4 texel = texture2D( tDiffuse, vUv );',
  'vec4 texel = texture2D( tDiffuse, vUv ); if (!(abs(texel.r) + abs(texel.g) + abs(texel.b) + abs(texel.a) < 6e4)) texel = vec4(0.);');

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
// screens and steps down when frames drop. cars scales street and highway traffic; detail is the prop range in metres,
// which the pack sets per level; fog scales the fog distances, and tiles past the fog stop drawing.
// Ultra is picked by hand. It renders at 1.5 times the screen's pixel ratio, up to 3, and adds SMAA.

const DETAIL = SETTING.scale.detail;
export const QUALITY_LEVELS = {
  ultra: { dpr: 3, ss: 1.5, smaa: true, bloom: true, cars: 1, detail: DETAIL.ultra, fog: 1 },
  high: { dpr: 2, bloom: true, cars: 1, detail: DETAIL.high, fog: 1 },
  medium: { dpr: 1.5, bloom: true, cars: .55, detail: DETAIL.medium, fog: .85 },
  low: { dpr: 1, bloom: false, cars: .3, detail: DETAIL.low, fog: .6 },
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

const LIGHT = { dir: [.4, .8, .3], colour: [1, 1, 1], base: .45, up: .25, sun: .4, ...LOOK.buildingLight };
export const U = {
  uTime: { value: 0 }, uFog: { value: FOG }, uFogNear: { value: LOOK.fogStart[0] }, uFogFar: { value: LOOK.fogStart[1] },
  uBlend: { value: SETTING.styles.blend }, uCentre: { value: CENTRE }, uCentreR: { value: CENTRE_R },
  uMist: { value: LOOK.mist }, uWin: { value: 1 }, uEdge: { value: 1 }, uClipTop: { value: 1e5 }, uMistBase: { value: 0 },

  // The building shader's light: a base level, a share from straight up and a share from the light direction, in the
  // light colour. The pack's look.buildingLight sets them. The defaults are the engine's night values.

  uLightDir: { value: new THREE.Vector3(...LIGHT.dir) }, uLightCol: { value: new THREE.Vector3(...LIGHT.colour) },
  uLightK: { value: new THREE.Vector3(LIGHT.base, LIGHT.up, LIGHT.sun) },
  uFocus: { value: new THREE.Vector4(0, 0, 0, 1) }, uFocusB: { value: new THREE.Vector3(1, 1, 1) }, uFocusK: { value: new THREE.Vector3(1, 0, 0) },
};

// Under a clock, the clouds take the hour's light and the water's glint the sun's or moon's colour. Without one,
// their shaders keep their fixed colours.

if (CLOCK) Object.assign(U, { uCloudLit: { value: new THREE.Vector3(.28, .31, .4) }, uCloudGlow: { value: 1 },
  uCloudSun: { value: 0 }, uGlint: { value: new THREE.Vector3(.16, .19, .24) } });

// ---------- sun shadows ----------

// A pack whose look.shadows is set gets shadows from the building light's direction. Buildings, kit props, trees
// and the hills cast them into a depth map that follows the view. Buildings lose the sun share of their light in
// shadow, and the ground darkens by look.shadows.strength. Without look.shadows no shader carries the code.
// look.shadows keys, with their defaults: size 2048 (map side in pixels), reach 700 (largest half width in metres),
// strength .55, live false (true redraws every frame, so traffic casts too), soft 0 (penumbra in metres for each
// metre between caster and ground; 0 keeps edges hard) and blur 4 (the widest penumbra in metres).

export const SHADOWS = LOOK.shadows && { size: 2048, reach: 700, strength: .55, live: false, soft: 0, blur: 4, ...LOOK.shadows };
export const SHADOW_LAYER = 7;
const DEPTH = 4000;

// shadowAt gives 1 in light and 0 in full shadow. It offsets the point along its normal by about a texel against
// acne and fades to light at the map's edge. Hard shadows take nine hardware-filtered taps.
// Soft shadows harden where they touch their caster (PCSS). Sixteen taps in a disc of blur metres find the
// casters above the point and their mean depth. The gap between them and the point, times soft, sizes the
// penumbra, and 32 taps in a disc that size count the light. Each pixel turns its discs by its own angle, so the
// taps' pattern breaks into fine grain instead of rings.

const disc = n => Array.from({ length: n }, (_, i) => {
  const r = Math.sqrt((i + .5) / n), a = i * 2.39996;
  return `vec2(${(r * Math.cos(a)).toFixed(4)}, ${(r * Math.sin(a)).toFixed(4)})`;
}).join(', ');
const SHADOW_HEAD = `
  #define SHADOWS
  uniform mat4 uShadowMat; uniform vec4 uShadowK, uShadowS;
  vec4 shadowPos(vec3 w, vec3 n) { vec4 p = uShadowMat * vec4(w + n * uShadowK.y, 1.); p.xyz = p.xyz * .5 + .5; return p; }
  float shadowEdge(vec4 p) { return smoothstep(.42, .5, max(abs(p.x - .5), abs(p.y - .5))); }`;
export const SHADOW_GLSL = !SHADOWS ? '' : SHADOWS.soft ? `${SHADOW_HEAD}
  uniform highp sampler2D uShadowMap;
  const vec2 FIND[16] = vec2[16](${disc(16)});
  const vec2 TAPS[32] = vec2[32](${disc(32)});
  float shadowAt(vec3 w, vec3 n) {
    vec4 p = shadowPos(w, n);
    if (p.z >= 1.) return 1.;
    float z = p.z - uShadowK.w, a = fract(52.98 * fract(dot(gl_FragCoord.xy, vec2(.0671, .00584)))) * 6.283;
    mat2 turn = mat2(cos(a), sin(a), -sin(a), cos(a));
    float reach = uShadowS.w * uShadowS.y, sum = 0., found = 0.;
    for (int i = 0; i < 16; i++) {
      float d = texture(uShadowMap, p.xy + turn * FIND[i] * reach).r;
      if (d < z) { sum += d; found++; }
    }
    if (found < .5) return 1.;
    float pen = clamp((z - sum / found) * uShadowS.x * uShadowS.z * uShadowS.y, 1.5 * uShadowK.z, reach), lit = 0.;
    for (int i = 0; i < 32; i++) lit += step(z, texture(uShadowMap, p.xy + turn * TAPS[i] * pen).r);
    return mix(lit / 32., 1., shadowEdge(p));
  }` : `${SHADOW_HEAD}
  uniform highp sampler2DShadow uShadowMap;
  float shadowAt(vec3 w, vec3 n) {
    vec4 p = shadowPos(w, n);
    if (p.z >= 1.) return 1.;
    float s = 0.;
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++)
      s += texture(uShadowMap, vec3(p.xy + vec2(i, j) * uShadowK.z, p.z - uShadowK.w));
    return mix(s / 9., 1., shadowEdge(p));
  }`;

// Hard shadows compare depth in the texture unit with bilinear filtering. Soft ones read raw depth.

if (SHADOWS) {
  const N = SHADOWS.size, map = new THREE.DepthTexture(N, N);
  if (!SHADOWS.soft) map.compareFunction = THREE.LessEqualCompare;
  map.minFilter = map.magFilter = SHADOWS.soft ? THREE.NearestFilter : THREE.LinearFilter;
  const target = new THREE.WebGLRenderTarget(N, N, { depthTexture: map });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, DEPTH), dir = new THREE.Vector3(), turn = new THREE.Quaternion();
  const back = new THREE.Quaternion(), at = new THREE.Vector3();
  cam.layers.set(SHADOW_LAYER);

  // The camera turns to face along the light whenever the light moves, as under a clock. Its up is the world's up,
  // except for a light from near overhead.

  const aim = () => {
    dir.copy(U.uLightDir.value).normalize();
    cam.position.set(0, 0, 0);
    cam.up.set(0, Math.abs(dir.y) > .9 ? 0 : 1, Math.abs(dir.y) > .9 ? -1 : 0);
    cam.lookAt(-dir.x, -dir.y, -dir.z);
    turn.copy(cam.quaternion); back.copy(turn).invert();
  };
  const caster = new THREE.MeshBasicMaterial({ colorWrite: false });
  Object.assign(U, { uShadowMap: { value: map }, uShadowMat: { value: new THREE.Matrix4() },
    uShadowK: { value: new THREE.Vector4(SHADOWS.strength, 0, 1 / N, 0) },
    uShadowS: { value: new THREE.Vector4(DEPTH, 0, SHADOWS.soft, SHADOWS.blur) } });

  // Opaque lit meshes cast, except the flat ground. Unlit materials are lights and glows. What moves (userData.moves)
  // casts only on a live map, as a still one redraws seldom. A building material says so in userData.casts, as
  // most shader materials (water, beams, labels) must not.

  const casts = o => {
    const m = o.material;
    if (!o.isMesh || Array.isArray(m) || !m.visible || m.transparent || SURFACE.includes(o)) return false;
    if (o.userData.moves) return SHADOWS.live;
    return !m.isMeshBasicMaterial && (!m.isShaderMaterial || m.userData.casts);
  };

  // The map covers a square round the view's target, from 150 m up to reach as the camera pulls back. The square
  // moves in whole texels and its size in 50 m steps, so edges do not crawl as the view pans. A still map redraws
  // when the square moves and every 60 frames for what the city adds; a live one every frame. Casters are picked
  // every frame while the city settles after loading, then every 30 frames.

  let key = '', age = 0, picked = 0, frames = 0;
  const _aimed = new THREE.Vector3();
  const draw = () => {
    if (!dir.equals(_aimed.copy(U.uLightDir.value).normalize())) aim();
    const r = Math.ceil(Math.min(Math.max(camera.position.distanceTo(controls.target) * 1.1, 150), SHADOWS.reach) / 50) * 50;
    const texel = 2 * r / N;
    at.copy(controls.target).applyQuaternion(back);
    at.x = Math.round(at.x / texel) * texel; at.y = Math.round(at.y / texel) * texel;
    const k = `${at.x},${at.y},${r},${dir.x},${dir.y},${dir.z}`;
    if (!SHADOWS.live && k === key && ++age < 60) return;
    key = k; age = 0;
    at.applyQuaternion(turn);
    cam.position.copy(at).addScaledVector(dir, DEPTH / 2);
    Object.assign(cam, { left: -r, right: r, top: r, bottom: -r });
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    U.uShadowMat.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    U.uShadowK.value.y = texel * 1.5;
    U.uShadowK.value.w = .3 / DEPTH;
    U.uShadowS.value.y = 1 / (2 * r);
    if (picked-- <= 0) { picked = ++frames < 120 ? 0 : 30; scene.traverse(o => { if (casts(o)) o.layers.enable(SHADOW_LAYER); }); }
    const bg = scene.background;
    scene.background = null; scene.overrideMaterial = caster;
    renderer.setRenderTarget(target);
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    scene.background = bg; scene.overrideMaterial = null;
  };
  const render = composer.render.bind(composer);
  composer.render = (...a) => { draw(); render(...a); };
}

// Every lit built-in material (standard, lambert, phong) loses its direct light in shadow and keeps its sky light.
// The shadow code goes into three's own light chunks, and the base material's compile hook hands it the shadow
// uniforms, so kit props, trees, grass, stalls and the hills receive shadows, and shade themselves, with no change
// to their materials. A material with its own compile hook calls shadowUniforms itself.

export function shadowUniforms(s) {
  if (SHADOWS) Object.assign(s.uniforms, { uShadowMap: U.uShadowMap, uShadowMat: U.uShadowMat, uShadowK: U.uShadowK, uShadowS: U.uShadowS });
}
if (SHADOWS) {
  const C = THREE.ShaderChunk;
  C.shadowmap_pars_vertex += '\nvarying vec3 vShW;';
  C.shadowmap_vertex += `
    vec4 shW = vec4(transformed, 1.);
    #ifdef USE_INSTANCING
      shW = instanceMatrix * shW;
    #endif
    vShW = (modelMatrix * shW).xyz;`;
  C.lights_pars_begin += `\nvarying vec3 vShW;\n${SHADOW_GLSL}`;
  C.lights_fragment_end += `
    float shLit = shadowAt(vShW, inverseTransformDirection(normal, viewMatrix));
    reflectedLight.directDiffuse *= shLit;
    reflectedLight.directSpecular *= shLit;`;
  THREE.Material.prototype.onBeforeCompile = shadowUniforms;
}

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
  uniform vec3 uMoonDir, uWaterBase;${CLOCK ? ' uniform vec3 uGlint;' : ''}
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
    vec3 col = uWaterBase + uFog * fres * .45 + ${CLOCK ? 'uGlint' : 'vec3(.16, .19, .24)'} * spec;
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

// ---------- ground: city asphalt, pavement blocks, the centre plaza ----------

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
    shadowUniforms(sh);
    Object.assign(sh.uniforms, HOLES);
    sh.vertexShader = sh.vertexShader.replace(MAIN, m => `varying vec2 vHole;\n${m} vHole = (modelMatrix * vec4(position, 1.)).xz;`);
    sh.fragmentShader = sh.fragmentShader.replace(MAIN, m => `${HOLE_GLSL}\n${m} if (inHole(vHole)) discard;`);
  };
  return mat;
}

// The city ground and blocks stop at the frayed outer edge (engine/edge.js).

Object.assign(U, EDGE_U);
function frayed(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    prev(sh);
    Object.assign(sh.uniforms, EDGE_U);
    sh.fragmentShader = sh.fragmentShader.replace(MAIN, m => `${EDGE_GLSL}\n${m} if (frayed(vHole)) discard;`);
  };
}

export const SURFACE = [];
export const surface = m => { if (m.material) holed(m.material); SURFACE.push(m); scene.add(m); return m; };
export const toShape = poly => new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));

// On a relief a flat surface is cut into triangles of at most 6 m and laid on the ground.

export function drape(geo) {
  if (!RELIEF) return geo;
  geo = new TessellateModifier(6, 8).modify(geo.index ? geo.toNonIndexed() : geo);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + groundY(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  return geo;
}
export const flatGeo = (polys, y) => mergeGeometries(polys.map(p => new THREE.ShapeGeometry(toShape(p)))).rotateX(-Math.PI / 2).translate(0, y, 0);

// The pack sets the ground colours and the pulse of light rings on the plaza round the centre.

const GROUND_RGB = LOOK.ground, vec3 = c => `vec3(${c.join(', ')})`;

// The street and plaza surface has no lighting of its own, so under a clock it takes the hour's ground light.

if (CLOCK) U.uGroundLight = { value: 1 };
export const outerGround = surface(new THREE.Mesh(new THREE.PlaneGeometry(DX + 40, DZ + 40).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: GROUND_RGB.outer, roughness: 1, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 })));
// A pack with look.groundMap draws the street and lot ground as one detailed surface (groundmap.js) instead.

if (!LOOK.groundMap) surface(new THREE.Mesh(flatGeo(CITY.districts.map(d => d.poly), .03), new THREE.ShaderMaterial({
  uniforms: U, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `
    uniform float uTime, uCentreR; uniform vec2 uCentre; varying vec3 vW;
    ${FOG_GLSL}
    ${EDGE_GLSL}
    ${SHADOW_GLSL}
    ${CLOCK ? 'uniform float uGroundLight;' : ''}
    void main(){
      if (frayed(vW.xz)) discard;
      vec3 col = ${vec3(GROUND_RGB.streets)};
      float ds = distance(vW.xz, uCentre);
      if (ds < uCentreR) {
        col = ${vec3(GROUND_RGB.plaza)};
        float ring = 1. - smoothstep(0., .8, abs(mod(ds - uTime * 6., 16.) - 8.));
        col += ${vec3(SETTING.centre.glow)} * ring * .25 * (1. - ds / uCentreR);
      }
      #ifdef SHADOWS
        col *= mix(1., shadowAt(vW, vec3(0., 1., 0.)), uShadowK.x);
      #endif
      ${CLOCK ? 'col *= uGroundLight;' : ''}
      gl_FragColor = vec4(fogged(col, vW), 1.);
    }`,
})));
if (!LOOK.groundMap) frayed(surface(new THREE.Mesh(flatGeo(CITY.blocks, .08), new THREE.MeshStandardMaterial({ color: GROUND_RGB.blocks[0], emissive: GROUND_RGB.blocks[1], roughness: .95, side: THREE.DoubleSide }))).material);

// Inland water (the reservoir, the Waterways) and the big parks cut out of the street grid.
// Chaikin corner cutting rounds the traced outlines, so shores and park edges read as land, not polygons.

export function smoothPoly(P, n = 3) {
  for (let k = 0; k < n; k++) P = P.flatMap((a, i) => {
    const b = P[(i + 1) % P.length];
    return [[a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]];
  });
  return P;
}

U.uMoonDir = { value: new THREE.Vector3(...LOOK.moon[2]).normalize() };

// The water's own colour under its reflections. A pack's look.water lifts it, for a day mode.

U.uWaterBase = { value: new THREE.Vector3(...LOOK.water ?? [.004, .009, .016]) };
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

// A city may have no water or no greens. Each surface builds only when its list has an outline.

if (CITY.water?.length) surface(new THREE.Mesh(flatGeo(CITY.water.map(w => smoothPoly(w.poly)), .12), WATER_MAT));
if (CITY.parks?.length) surface(new THREE.Mesh(drape(flatGeo(CITY.parks.map(w => smoothPoly(w.poly)), .1)),
  new THREE.MeshStandardMaterial({ color: GROUND_RGB.parks[0], emissive: GROUND_RGB.parks[1], roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));

// ---------- diorama: the city sits on a slab above dark water ----------

export const slab = surface(new THREE.Mesh(new THREE.BoxGeometry(DX + 40, 80, DZ + 40).translate(0, -40.05, 0),
  new THREE.MeshStandardMaterial({ color: GROUND_RGB.slab, roughness: .9 })));
export const water = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: GROUND_RGB.sea, roughness: .15, metalness: .6 }));
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
  const o = new CSS2DObject(el); o.position.copy(pos); o.position.y += groundY(pos.x, pos.z); labelRoot.add(o);
  el.obj = o;
  return el;
}
