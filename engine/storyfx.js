// Story effects for narrated tours: blasts, fire, gunfire, drones, plasma blades, flashbangs and gas.
// A cue starts one at a point, and the tour clock runs it, so a paused episode freezes the scene.

import * as THREE from 'three';
import { scene } from './render.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);

// Soft round sprites. SOFT has a hot core for light, PUFF fades evenly for smoke and gas. Light ignores depth,
// so a blast glows past the walls round it instead of showing their hard edges.

function radial(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [k, col] of stops) grad.addColorStop(k, col);
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const SOFT = radial([[0, '#fff'], [.2, 'rgba(255,255,255,.85)'], [.5, 'rgba(255,255,255,.25)'], [1, 'rgba(255,255,255,0)']]);
const PUFF = radial([[0, 'rgba(255,255,255,.7)'], [.6, 'rgba(255,255,255,.3)'], [1, 'rgba(255,255,255,0)']]);

const sprites = [];
function sprite(rgb, glow = true) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow ? SOFT : PUFF, color: new THREE.Color(...rgb), transparent: true,
    depthWrite: false, depthTest: !glow, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending, fog: !glow }));
  s.renderOrder = glow ? 3 : 2;
  scene.add(s);
  sprites.push(s);
  return s;
}
function drop(s) { scene.remove(s); s.material.dispose(); sprites.splice(sprites.indexOf(s), 1); }

// Sparks, embers and tracers share one point cloud. Dead points turn black, which adds nothing.

const N = 3000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = new Float32Array(N * 3), base = new Float32Array(N * 3);
const life = new Float32Array(N), span = new Float32Array(N), fall = new Float32Array(N);
let next = 0, wasAlive = false;
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
const points = new THREE.Points(geo, new THREE.PointsMaterial({ map: SOFT, size: 1.6, vertexColors: true, transparent: true,
  depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
points.frustumCulled = false;
points.renderOrder = 3;
scene.add(points);

function spark(p, v, rgb, t, g = 9.8) {
  const i = next, j = i * 3;
  next = (next + 1) % N;
  pos[j] = p.x; pos[j + 1] = p.y; pos[j + 2] = p.z;
  vel[j] = v.x; vel[j + 1] = v.y; vel[j + 2] = v.z;
  base[j] = rgb[0]; base[j + 1] = rgb[1]; base[j + 2] = rgb[2];
  life[i] = span[i] = t; fall[i] = g;
}
const burst = (p, n, speed, rgb, t, g) => {
  for (let k = 0; k < n; k++) {
    const u = rand(-.2, 1), a = rand(0, Math.PI * 2), s = Math.sqrt(1 - u * u), v = speed * rand(.4, 1);
    spark(p, V(Math.cos(a) * s * v, u * v, Math.sin(a) * s * v), rgb, t * rand(.6, 1), g);
  }
};

// A tracer is a few fast points strung along the shot.

function tracer(a, b, rgb = [2.4, 1.6, .6]) {
  const d = b.clone().sub(a), v = d.clone().normalize().multiplyScalar(260), t = d.length() / 260;
  for (let k = 0; k < 4; k++) spark(a.clone().addScaledVector(v, -k * .004), v, rgb, t, 0);
}

// Each running effect is a step(age, dt) that returns false when it is done.

const live = [];
const run = step => live.push({ age: 0, step });

const FIRE = [1.5, .55, .1], HOT = [2, 1.5, .8], SMOKE = [.2, .18, .17];

function smoke(p, size, rise, t, rgb = SMOKE, alpha = .55) {
  const s = sprite(rgb, false), v = V(rand(-1, 1), rise, rand(-1, 1));
  s.position.copy(p);
  run((age, dt) => {
    const k = age / t;
    s.position.addScaledVector(v, dt);
    s.scale.setScalar(size * (1 + k * 2.5));
    s.material.opacity = alpha * Math.min(1, age * 3) * (1 - k);
    if (k < 1) return true;
    drop(s); return false;
  });
}

function flash(p, size, t, rgb = HOT) {
  const s = sprite(rgb);
  s.position.copy(p);
  run(age => {
    const k = age / t;
    s.scale.setScalar(size * Math.min(1, age / .05));
    s.material.opacity = (1 - k) ** 2;
    if (k < 1) return true;
    drop(s); return false;
  });
}

const FX = {

  // An explosion: a white flash, a rolling fireball, sparks and a smoke column that lingers.

  blast(p, o) {
    const s = o.s ?? 1;
    flash(p, 70 * s, .5, [2, 1.8, 1.4]);
    for (let k = 0; k < 6; k++) {
      const b = sprite(FIRE), off = V(rand(-3, 3), rand(0, 4), rand(-3, 3)).multiplyScalar(s), t = rand(1, 1.8);
      run(age => {
        const e = age / t;
        b.position.copy(p).add(off).y += e * 8 * s;
        b.scale.setScalar(s * (6 + 18 * (1 - (1 - e) ** 3)));
        b.material.color.setRGB(1.8 - e * 1.2, .8 - e * .65, .2 - e * .18);
        b.material.opacity = 1 - e;
        if (e < 1) return true;
        drop(b); return false;
      });
    }
    burst(p, 160 * s, 45 * s, [2.8, 1.4, .4], 1.8);
    for (let k = 0; k < 8; k++) smoke(p.clone().add(V(rand(-4, 4), rand(2, 8), rand(-4, 4)).multiplyScalar(s)), 12 * s, rand(3, 6), rand(6, 10));
  },

  // A small blast for a trip mine.

  mine(p, o) { FX.blast(p, { ...o, s: (o.s ?? 1) * .45 }); },

  // A building on fire for t seconds: flickering flames, embers riding the heat, smoke pouring up.

  fire(p, o) {
    const s = o.s ?? 1, t = o.t ?? 20, flames = Array.from({ length: 4 }, () => sprite(FIRE));
    let puff = 0;
    run((age, dt) => {
      const fade = Math.min(1, age / 1.5, (t - age) / 2);
      flames.forEach((f, k) => {
        f.position.set(p.x + Math.sin(k * 2.1) * 4 * s, p.y + 3 * s + Math.sin(age * 9 + k) * s, p.z + Math.cos(k * 2.1) * 4 * s);
        f.scale.setScalar(s * rand(9, 14));
        f.material.opacity = fade * rand(.6, 1);
      });
      if (Math.random() < 40 * dt * fade) spark(p.clone().add(V(rand(-5, 5), 2, rand(-5, 5)).multiplyScalar(s)), V(rand(-2, 2), rand(8, 16), rand(-2, 2)), [2.6, 1.1, .3], rand(1, 2), -2);
      if ((puff -= dt) < 0) { puff = .35; smoke(p.clone().add(V(rand(-3, 3), 8 * s, rand(-3, 3))), 9 * s, rand(4, 7), rand(7, 11), SMOKE, .6 * fade); }
      if (age < t) return true;
      flames.forEach(drop); return false;
    });
  },

  // The morning after: smoke rising from a ruin for t seconds, no flames.

  smolder(p, o) {
    const s = o.s ?? 1, t = o.t ?? 20;
    let puff = 0;
    run((age, dt) => {
      if ((puff -= dt) < 0) { puff = .6; smoke(p.clone().add(V(rand(-4, 4), 4 * s, rand(-4, 4))), 7 * s, rand(3, 5), rand(8, 12), SMOKE, .45 * Math.min(1, (t - age) / 3)); }
      return age < t;
    });
  },

  // Shots across an area for t seconds: muzzle flashes and tracers between random points r metres apart.

  gunfire(p, o) {
    const r = o.r ?? 8, t = o.t ?? 3, rate = o.rate ?? 8;
    run((age, dt) => {
      if (Math.random() < rate * dt) {
        const a = p.clone().add(V(rand(-r, r), rand(1, 2.5), rand(-r, r))), b = p.clone().add(V(rand(-r, r), rand(.5, 3), rand(-r, r)));
        flash(a, 5, .08, [3, 2.2, 1]);
        tracer(a, b);
        if (Math.random() < .3) burst(b, 6, 8, [2.4, 1.6, .7], .3);
      }
      return age < t;
    });
  },

  // A flashbang: one white flash that fills the room, a scatter of hot sparks and a white poof of smoke.

  flashbang(p, o) {
    const s = o.s ?? 1;
    flash(p, 50 * s, .9, [3, 3, 3]);
    burst(p, 60 * s + 20, 24 * s + 6, [3, 3, 2.6], .6);
    for (let k = 0; k < 5; k++) smoke(p.clone().add(V(rand(-2, 2), rand(0, 2), rand(-2, 2)).multiplyScalar(s * 2)), 6 * s, rand(1, 2), rand(2.5, 3.5), [.75, .75, .78], .5);
  },

  // A drone flies in from dir degrees, hovers off the target, fires shots and climbs away. t is the whole flight.

  drone(p, o) {
    const t = o.t ?? 8, a = (o.dir ?? 0) * Math.PI / 180, out = V(Math.cos(a), 0, Math.sin(a));
    const hover = p.clone().addScaledVector(out, o.r ?? 18).setY(p.y + (o.h ?? 10)), far = hover.clone().addScaledVector(out, 90).setY(hover.y + 45);
    const body = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0x4a505a });
    body.add(new THREE.Mesh(new THREE.BoxGeometry(2.2, .6, 2.2), mat));
    for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, .08, 12), mat);
      rotor.position.set(x, .4, z);
      body.add(rotor);
    }
    body.scale.setScalar(o.size ?? 2.2);
    body.userData.storyFx = true;
    scene.add(body);
    const red = sprite([3, .2, .1]), white = sprite([2.5, 2.5, 3]);
    const shots = o.shots ?? 3, path = new THREE.Vector3();
    let fired = 0;
    run(age => {
      const e = age / t, k = e < .3 ? 1 - (1 - e / .3) ** 2 : e > .8 ? 1 - ((e - .8) / .2) ** 2 : 1;
      path.lerpVectors(far, hover, k);
      body.position.copy(path).y += Math.sin(age * 3) * .4;
      body.rotation.y = age * .4;
      red.position.copy(body.position).y -= 1;
      white.position.copy(body.position).y += 1.2;
      red.scale.setScalar(age % 1 < .15 ? 9 : 4);
      white.scale.setScalar(age % .7 < .08 ? 8 : 0);
      const shoot = Math.floor((e - .35) / .4 * shots);
      if (e > .35 && fired <= shoot && fired < shots) {
        fired++;
        flash(body.position.clone(), 6, .1, [3, 2.4, 1.2]);
        tracer(body.position.clone(), p);
        burst(p, 12, 10, [2.6, 2, 1.2], .4);
      }
      if (e < 1) return true;
      scene.remove(body); drop(red); drop(white); return false;
    });
  },

  // A plasma cutter held up like a blade by a lone dark figure, humming for t seconds. It ends in a cut: a flash
  // and burning sparks. s scales the blade, so a short cut through a door can stay small.

  plasma(p, o) {
    const t = o.t ?? 5, s = o.s ?? 1, core = sprite([2.2, 2.5, 3]), halo = sprite([.4, 1, 3]);
    const man = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.6, .9).translate(0, 1.8, 0), new THREE.MeshBasicMaterial({ color: 0x07080a }));
    man.position.copy(p);
    man.userData.storyFx = true;
    if (s >= 1) scene.add(man);
    for (const g of [core, halo]) { g.material.rotation = (o.tilt ?? 20) * Math.PI / 180; g.position.copy(p).add(V(1.2, 4.5, 0)); }
    run(age => {
      const hum = 1 + Math.sin(age * 40) * .06 + rand(-.04, .04), on = Math.min(1, age * 4);
      core.scale.set(.9 * hum * s, 8 * on * s, 1);
      halo.scale.set(4.5 * hum * s, 13 * on * s, 1);
      if (age < t) return true;
      flash(core.position.clone(), 30 * s, .4, [1.4, 2, 3]);
      burst(core.position.clone(), 60 * s, 18, [2.8, 1.5, .5], 1);
      scene.remove(man); drop(core); drop(halo); return false;
    });
  },

  // A gas grenade: a pale green-grey cloud that swells and thins over t seconds.

  gas(p, o) {
    const t = o.t ?? 8;
    for (let k = 0; k < 7; k++) smoke(p.clone().add(V(rand(-3, 3), rand(0, 2), rand(-3, 3))), 6, rand(.3, .8), t * rand(.7, 1), [.32, .38, .28], .5);
  },
};

export const storyFx = (verb, p, o = {}) => FX[verb]?.(p, o);

export function clearStoryFx() {
  live.length = 0;
  while (sprites.length) drop(sprites[0]);
  for (const c of scene.children.filter(c => c.userData.storyFx)) scene.remove(c);
  life.fill(0); col.fill(0);
  geo.attributes.color.needsUpdate = true;
}

// dt is audio time, so a paused tour freezes everything and playback speed speeds it up.

export function updateStoryFx(dt) {
  if (!dt) return;
  for (let i = live.length - 1; i >= 0; i--) {
    const f = live[i];
    f.age += dt;
    if (!f.step(f.age, dt)) live.splice(i, 1);
  }
  // The points upload only while a spark lives, and once more to blank the last one.

  const drag = Math.exp(-1.2 * dt);
  let alive = false;
  for (let i = 0; i < N; i++) {
    if (life[i] <= 0) continue;
    const j = i * 3;
    alive = true;
    life[i] -= dt;
    if (life[i] <= 0) { col[j] = col[j + 1] = col[j + 2] = 0; continue; }
    const g = fall[i];
    if (g) { vel[j] *= drag; vel[j + 1] = vel[j + 1] * drag - g * dt; vel[j + 2] *= drag; }
    pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
    const k = Math.min(1, life[i] / span[i] * 2);
    col[j] = base[j] * k; col[j + 1] = base[j + 1] * k; col[j + 2] = base[j + 2] * k;
  }
  if (alive || wasAlive) geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
  wasAlive = alive;
}
