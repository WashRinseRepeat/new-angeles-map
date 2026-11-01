// Fireworks over the current view. A tour's Finish starts a short show above the last stop.
// Shells launch from the building top, rise and burst inside the visible frame, so the show fits any zoom.

import * as THREE from 'three';
import { camera, controls, scene } from './render.js';

const N = 4000, RISE = .9;
const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = new Float32Array(N * 3), base = new Float32Array(N * 3);
const life = new Float32Array(N), span = new Float32Array(N);
const PALETTE = [[0, .83, 1], [1, .72, 0], [1, .25, .75], [.6, 1, .5], [1, 1, 1]];
let next = 0, clock = 0, gravity = 0, shells = [];

const dot = document.createElement('canvas');
dot.width = dot.height = 32;
const g2 = dot.getContext('2d'), grad = g2.createRadialGradient(16, 16, 0, 16, 16, 16);
grad.addColorStop(0, '#fff'); grad.addColorStop(.2, '#fff'); grad.addColorStop(.45, 'rgba(255,255,255,.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
g2.fillStyle = grad; g2.fillRect(0, 0, 32, 32);

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
const mat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(dot), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
const points = new THREE.Points(geo, mat);
points.frustumCulled = false;
points.visible = false;
scene.add(points);

function spark(x, y, z, vx, vy, vz, [r, g, b], t) {
  const i = next, j = i * 3;
  next = (next + 1) % N;
  pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
  vel[j] = vx; vel[j + 1] = vy; vel[j + 2] = vz;
  base[j] = r; base[j + 1] = g; base[j + 2] = b;
  life[i] = span[i] = t;
}

function burst({ to, R, c, c2 }) {
  for (let k = 0; k < 220; k++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), v = R * 1.7 * (.85 + Math.random() * .15);
    spark(to.x, to.y, to.z, Math.cos(a) * s * v, u * v, Math.sin(a) * s * v, Math.random() < .3 ? c2 : c, 1.4 + Math.random() * .6);
  }
}

// The show sizes itself from the view. Bursts spread across the screen and sit above the building top
// where the view leaves room. A burst that would leave the screen tries another spot.

const onScreen = v => { const s = v.clone().project(camera); return Math.abs(s.x) < .8 && s.y > -.2 && s.y < .8 && s.z < 1; };

export function fireworks(top = 0) {
  const dist = camera.position.distanceTo(controls.target), h = 2 * dist * Math.tan(camera.fov * Math.PI / 360), w = h * camera.aspect;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const R = Math.min(w, h) * .2;
  mat.size = R * .12;
  gravity = R * .6;
  clock = 0;
  shells = Array.from({ length: 10 }, (_, k) => {
    let to = null;
    for (let tries = 0; tries < 24 && !to; tries++) {
      const v = controls.target.clone().addScaledVector(right, (Math.random() - .5) * w * .7).addScaledVector(up, h * (.08 + Math.random() * .3));
      const raised = v.clone().setY(Math.max(v.y, top + R * 1.2));
      to = onScreen(raised) ? raised : tries > 12 && onScreen(v) ? v : null;
    }
    if (!to) return null;
    const from = to.clone().setY(Math.min(to.y - R, Math.max(top, to.y - R * 3)));
    const pick = () => PALETTE[Math.floor(Math.random() * PALETTE.length)];
    return { at: k < 7 ? k * .45 + Math.random() * .2 : 3.4 + Math.random() * .3, from, to, p: from.clone(), R, c: pick(), c2: pick(), done: false };
  }).filter(Boolean);
  points.visible = true;
}

export function updateFireworks(dt) {
  if (!points.visible) return;
  clock += dt;
  let busy = false;
  for (const s of shells) {
    if (s.done) continue;
    busy = true;
    if (clock < s.at) continue;
    const u = Math.min(1, (clock - s.at) / RISE);
    s.p.lerpVectors(s.from, s.to, 1 - (1 - u) ** 2);
    spark(s.p.x, s.p.y, s.p.z, 0, -s.R * .2, 0, [1, .75, .45], .35);
    if (u === 1) { s.done = true; burst(s); }
  }

  // Sparks slow down, fall and fade. A dead spark turns black, which draws nothing under additive blending.

  const drag = Math.exp(-1.6 * dt);
  for (let i = 0; i < N; i++) {
    if (life[i] <= 0) continue;
    const j = i * 3;
    life[i] -= dt;
    if (life[i] <= 0) { col[j] = col[j + 1] = col[j + 2] = 0; continue; }
    busy = true;
    vel[j] *= drag; vel[j + 1] = vel[j + 1] * drag - gravity * dt; vel[j + 2] *= drag;
    pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;

    // A spark fades in over its first tenth of a second, so a fresh burst does not flash as one white blob.
    // Late sparks crackle.

    const f = life[i] / span[i], k = f ** 1.5 * 4 * Math.min(1, (span[i] - life[i]) * 8) * (f < .4 && Math.random() < .3 ? .2 : 1);
    col[j] = base[j] * k; col[j + 1] = base[j + 1] * k; col[j + 2] = base[j + 2] * k;
  }
  geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
  points.visible = busy;
}
