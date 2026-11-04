// The clock lights a pack by the hour. look.clock lists keyframes, each a time and the light at that time, and
// the clock blends the two keyframes round the hour. The sun crosses the sky between sunrise and sunset and the
// moon at night, and whichever is up gives the light its direction, so shadows turn and lengthen as the day goes.
// Without look.clock, or with a fixed ?look= mode, nothing here runs.
//
// look.clock keys, with their defaults:
//   start 12        the hour the map opens at; ?time=HH:MM overrides it
//   cycle 0         minutes for a whole day; 0 holds the hour; ?cycle=<minutes> overrides it
//   sun             rise 6 and set 20 (hours), peak 60 and moon 40 (highest sun and moon in degrees), noon
//                   (the sun's compass direction at midday as [x, z], by default the building light's)
//   keys            the keyframes, below
//
// A keyframe is { at: hour, ... } with any of these fields. A field a keyframe leaves out comes from the pack's look.
//   sky             [zenith, horizon, below] as hex colours
//   fog             hex colour of fog and haze
//   hemi            [sky hex, ground hex, intensity], the soft light on every lit surface
//   light           [hex, intensity], the sun or moon on every lit surface
//   building        { colour: [r, g, b], base, up, sun }, the building shader's light (as look.buildingLight)
//   ground          brightness of the unlit street and plaza surface, 1 at full day colour
//   water           [r, g, b], the water's own colour
//   shade           how dark shadows fall, 0 to 1 of look.shadows.strength
//   tune            windows, glows, pools, exposure, bloomStrength, bloomThreshold, fogNear, fogFar and mist

import * as THREE from 'three';
import { CLOCK, SETTING } from './setting.js';
import { FOG, FOG_BASE, SHADOWS, U, bloom, camera, hemi, moon, renderer, scene } from './render.js';
import { glows, pools } from './instances.js';

const LOOK = SETTING.look, T = LOOK.tune ?? {}, BL = { dir: [.4, .8, .3], colour: [1, 1, 1], base: .45, up: .25, sun: .4, ...LOOK.buildingLight };
const TUNES = ['windows', 'glows', 'pools', 'exposure', 'bloomStrength', 'bloomThreshold', 'fogNear', 'fogFar', 'mist'];
const colour = v => new THREE.Color(v);

// Each keyframe is filled from the pack's look, so every field blends between two values.

const base = {
  sky: (LOOK.sky ?? [LOOK.fog, LOOK.fog, LOOK.fog]).map(colour), fog: colour(LOOK.fog),
  hemi: [colour(LOOK.hemi[0]), colour(LOOK.hemi[1]), LOOK.hemi[2]], light: [colour(LOOK.moon[0]), LOOK.moon[1]],
  colour: [...BL.colour], k: [BL.base, BL.up, BL.sun], ground: 1, water: [...LOOK.water ?? [.004, .009, .016]], shade: 1,
  tune: Object.fromEntries(TUNES.map(k => [k, T[k] ?? 1])),
};
const KEYS = CLOCK && (CLOCK.keys ?? []).map(k => ({
  at: k.at,
  sky: k.sky ? [...k.sky, k.sky.at(-1)].slice(0, 3).map(colour) : base.sky,
  fog: k.fog !== undefined ? colour(k.fog) : base.fog,
  hemi: k.hemi ? [colour(k.hemi[0]), colour(k.hemi[1]), k.hemi[2]] : base.hemi,
  light: k.light ? [colour(k.light[0]), k.light[1]] : base.light,
  colour: k.building?.colour ?? base.colour,
  k: k.building ? [k.building.base ?? base.k[0], k.building.up ?? base.k[1], k.building.sun ?? base.k[2]] : base.k,
  ground: k.ground ?? base.ground, water: k.water ?? base.water, shade: k.shade ?? base.shade,
  tune: { ...base.tune, ...k.tune },
})).sort((a, b) => a.at - b.at);

// The sun's path: up between rise and set, highest at midday, swinging from one side of its noon direction to the
// other. The moon takes the same path through the night. Either stays at least 4 degrees up, and its light fades
// over its first and last 8 degrees, so the swap at dawn and dusk is dark.

const SUN = CLOCK?.sun, NOON = new THREE.Vector2(...(SUN?.noon ?? [BL.dir[0], BL.dir[2]])).normalize();
const DEG = Math.PI / 180;
function sky(h) {
  const day = h >= SUN.rise && h < SUN.set, len = day ? SUN.set - SUN.rise : 24 - (SUN.set - SUN.rise);
  const f = (((h - (day ? SUN.rise : SUN.set)) % 24) + 24) % 24 / len, up = Math.sin(Math.PI * f) * (day ? SUN.peak : SUN.moon) * DEG;
  const swing = (f - .5) * Math.PI, c = Math.cos(swing), s = Math.sin(swing), e = Math.max(up, 4 * DEG);
  const x = NOON.x * c - NOON.y * s, z = NOON.x * s + NOON.y * c;
  const edge = Math.min(f, 1 - f) * len;
  return { day, up, dir: new THREE.Vector3(x * Math.cos(e), Math.sin(e), z * Math.cos(e)), fade: THREE.MathUtils.smoothstep(up, 0, 8 * DEG),
    stars: day ? 0 : THREE.MathUtils.smoothstep(edge, .3, 1.5) };
}

// The sky is a dome round the camera, inside the far plane and clear of fog. It blends the keyframe's zenith,
// horizon and below colours by height. Round the sun a wide haze and a tight glow brighten it, and while the sun is
// low the horizon on its side glows in the light's colour. Stars come out over the first hour and a half of night.
// The dome writes no depth, so the town, the clouds and the sun and moon all draw over it.

const SKY_U = { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uLow: { value: new THREE.Color() },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uSunUp: { value: 1 }, uStars: { value: 0 } };
const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({
  uniforms: SKY_U, side: THREE.BackSide, depthWrite: false,
  vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `
    uniform vec3 uTop, uMid, uLow, uSunDir, uSunCol; uniform float uSunUp, uStars; varying vec3 vD;
    float hash(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
    void main() {
      vec3 d = normalize(vD);
      float a = asin(clamp(d.y, -1., 1.)) / 1.5708;
      vec3 col = a > 0. ? mix(uMid, uTop, smoothstep(.04, 1., a)) : mix(uMid, uLow, smoothstep(.04, .6, -a));
      float mu = max(dot(d, normalize(uSunDir)), 0.);
      col += uSunCol * (pow(mu, 6.) * .25 + pow(mu, 48.) * .6);
      col += uSunCol * exp(-abs(d.y) * 9.) * pow(mu * .5 + .5, 3.) * .6 * (1. - smoothstep(.05, .5, uSunUp));
      if (uStars > 0. && d.y > 0.) {
        vec3 q = d * 220., c = floor(q), at = c + .5 + (vec3(hash(c + 7.), hash(c + 13.), hash(c + 29.)) - .5) * .6;
        float star = step(.982, hash(c)) * smoothstep(.3, 0., length(q - at)) * (.5 + 1.1 * hash(c + 41.));
        col += vec3(.9, .93, 1.) * star * uStars * smoothstep(0., .08, d.y);
      }
      gl_FragColor = vec4(col, 1.);
    }`,
}));
dome.frustumCulled = false; dome.renderOrder = -2;
if (CLOCK) scene.add(dome);

// The sun and the moon are glows in the sky along the light, far beyond the town and clear of fog. The sun is a
// bright disc in a wide halo that falls off steeply, which bloom spreads; the moon a pale disc in a small one. Hills
// hide them, and the clouds, drawn after, pass over them. They follow the camera, so they never come nearer.

function glowTexture(disc, halo) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d'), grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(disc, 'rgba(255,255,255,1)');
  for (let i = 0; i <= 8; i++) {
    const r = disc + .02 + (1 - disc - .02) * i / 8, k = (1 - i / 8) ** 3;
    grad.addColorStop(r, `rgba(255,255,255,${(halo * k).toFixed(4)})`);
  }
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
const orb = (disc, halo, size) => {
  const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(disc, halo), blending: THREE.AdditiveBlending, fog: false,
    depthWrite: false, transparent: true }));
  o.scale.setScalar(size); o.renderOrder = -1; o.visible = false;
  if (CLOCK) scene.add(o);
  return o;
};
const FAR = 4200, sunOrb = orb(.06, .35, 1700), moonOrb = orb(.22, .12, 420);

// The keyframes either side of the hour, wrapping past midnight, and how far the hour lies between them, eased.

function around(h) {
  let i = KEYS.findLastIndex(k => k.at <= h);
  if (i < 0) i = KEYS.length - 1;
  const a = KEYS[i], b = KEYS[(i + 1) % KEYS.length], span = ((b.at - a.at) % 24 + 24) % 24 || 24;
  const f = (((h - a.at) % 24) + 24) % 24 / span;
  return [a, b, f * f * (3 - 2 * f)];
}
const mix = (a, b, f) => a + (b - a) * f;
const mixAll = (a, b, f) => a.map((v, i) => mix(v, b[i], f));
const _c = new THREE.Color();

const maxWindows = CLOCK ? Math.max(1e-3, ...(CLOCK.keys ?? []).map(k => k.tune?.windows ?? base.tune.windows)) : 1;
let sunDir = new THREE.Vector3(0, 1, 0);

export function lightAt(h) {
  const [a, b, f] = around(h), { day, up, dir, fade, stars } = sky(h);
  sunDir = dir;
  _c.lerpColors(a.fog, b.fog, f);
  FOG.copy(_c); scene.fog.color.copy(_c);
  SKY_U.uTop.value.lerpColors(a.sky[0], b.sky[0], f); SKY_U.uMid.value.lerpColors(a.sky[1], b.sky[1], f);
  SKY_U.uLow.value.lerpColors(a.sky[2], b.sky[2], f);
  SKY_U.uSunDir.value.copy(dir); SKY_U.uSunUp.value = Math.sin(up); SKY_U.uStars.value = stars;
  DAY.light = day ? fade : 0;
  hemi.color.lerpColors(a.hemi[0], b.hemi[0], f); hemi.groundColor.lerpColors(a.hemi[1], b.hemi[1], f);
  hemi.intensity = mix(a.hemi[2], b.hemi[2], f);
  moon.color.lerpColors(a.light[0], b.light[0], f);
  moon.intensity = mix(a.light[1], b.light[1], f) * fade;
  moon.position.copy(dir).multiplyScalar(1000);
  U.uLightDir.value.copy(dir); U.uMoonDir.value.copy(dir);
  U.uLightCol.value.set(...mixAll(a.colour, b.colour, f));
  const [kb, ku, ks] = mixAll(a.k, b.k, f);
  U.uLightK.value.set(kb, ku, ks * fade);
  U.uGroundLight.value = mix(a.ground, b.ground, f);
  U.uWaterBase.value.set(...mixAll(a.water, b.water, f));
  if (SHADOWS) U.uShadowK.value.x = SHADOWS.strength * mix(a.shade, b.shade, f) * fade;

  // Cloud tops take the sun or moon and a little sky light. The glint on the water is the light's colour.

  const lit = moon.color.clone().multiplyScalar(moon.intensity * .35).add(hemi.color.clone().multiplyScalar(hemi.intensity * .08));
  U.uCloudLit.value.set(lit.r, lit.g, lit.b);
  U.uCloudSun.value = fade * (day ? 1 : .3);
  U.uGlint.value.set(moon.color.r, moon.color.g, moon.color.b).multiplyScalar(moon.intensity * (day ? .5 : .3));
  sunOrb.visible = day && fade > 0; moonOrb.visible = !day && fade > 0;
  sunOrb.material.color.copy(moon.color).multiplyScalar(2.5 * fade);
  moonOrb.material.color.setRGB(.9, .95, 1.1).multiplyScalar(.9 * fade);
  SKY_U.uSunCol.value.copy(moon.color).multiplyScalar(fade * (day ? 1 : .15));
  const t = Object.fromEntries(TUNES.map(k => [k, mix(a.tune[k], b.tune[k], f)]));
  U.uWin.value = t.windows; U.uMist.value = t.mist; U.uCloudGlow.value = t.windows / maxWindows;
  glows.material.color.setScalar(t.glows); pools.material.color.setScalar(t.pools);
  renderer.toneMappingExposure = t.exposure;
  bloom.strength = t.bloomStrength; bloom.threshold = t.bloomThreshold;
  FOG_BASE.near = t.fogNear; FOG_BASE.far = t.fogFar;
}

// The clock's hour. tick moves it on by the frame's share of a day and relights the map when the hour has moved,
// so sliders that set the same values stay as set while the clock stands still.

export const DAY = CLOCK && { hour: CLOCK.start, cycle: CLOCK.cycle, lit: null, light: 1 };
export function tick(dt) {
  if (!DAY || !KEYS.length) return;
  if (DAY.cycle > 0) DAY.hour = (DAY.hour + dt * 24 / (DAY.cycle * 60)) % 24;
  if (DAY.hour !== DAY.lit) { DAY.lit = DAY.hour; lightAt(DAY.hour); }
  for (const o of [sunOrb, moonOrb]) o.position.copy(camera.position).addScaledVector(sunDir, FAR);
  dome.position.copy(camera.position); dome.scale.setScalar(camera.far * .8);
}
