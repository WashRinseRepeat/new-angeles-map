// The city's outer edge frays over look.edge metres, so it ends on a ragged line instead of the traced outline.
// edgeAt(x, z) is the distance in from the outer edge as a share of that width, less a noise threshold. The city
// ends where it falls below zero. Borders between districts and the coast stay solid. The ground, blocks, lots,
// streets and the pack's forest all cut at the same line.

import * as THREE from 'three';
import { CITY, smooth, vnoise } from './core.js';
import { SETTING } from './setting.js';

export const EDGE = SETTING.look.edge ?? 0;

// Distance to the nearest zero cell, in thirds of a raster cell (3-4 chamfer). Two passes, so it stays fast on
// the whole city raster.

export function chamfer(m, W, D) {
  const d = new Uint16Array(W * D);
  for (let i = 0; i < W * D; i++) d[i] = m[i] ? 65000 : 0;
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    if (!d[k]) continue;
    let v = d[k];
    if (i) v = Math.min(v, d[k - 1] + 3);
    if (j) {
      v = Math.min(v, d[k - W] + 3);
      if (i) v = Math.min(v, d[k - W - 1] + 4);
      if (i < W - 1) v = Math.min(v, d[k - W + 1] + 4);
    }
    d[k] = v;
  }
  for (let j = D - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) {
    const k = j * W + i;
    if (!d[k]) continue;
    let v = d[k];
    if (i < W - 1) v = Math.min(v, d[k + 1] + 3);
    if (j < D - 1) {
      v = Math.min(v, d[k + W] + 3);
      if (i < W - 1) v = Math.min(v, d[k + W + 1] + 4);
      if (i) v = Math.min(v, d[k + W - 1] + 4);
    }
    d[k] = v;
  }
  return d;
}

// The mask is a raster at S metres per cell, padded past the districts. A byte of 128 is the cut line.

const S = 3, P = EDGE + 12, OX = CITY.origin[0] - P, OZ = CITY.origin[1] - P;
const W = EDGE ? Math.ceil((CITY.dims[0] + 2 * P) / S) : 1, D = EDGE ? Math.ceil((CITY.dims[1] + 2 * P) / S) : 1;
const MASK = new Uint8Array(W * D).fill(255);

if (EDGE) {
  const g = new OffscreenCanvas(W, D).getContext('2d', { willReadFrequently: true });
  g.setTransform(1 / S, 0, 0, 1 / S, -OX / S, -OZ / S);
  const path = poly => { g.beginPath(); poly.forEach(([x, z], i) => i ? g.lineTo(x, z) : g.moveTo(x, z)); };
  g.fillStyle = g.strokeStyle = '#fff';
  for (const d of CITY.districts) { path(d.poly); g.fill(); }
  g.lineWidth = EDGE * 2.4; g.lineCap = g.lineJoin = 'round';
  for (const L of CITY.coast ?? []) { path(L); g.stroke(); }
  const px = g.getImageData(0, 0, W, D).data, inside = new Uint8Array(W * D);
  for (let i = 0; i < W * D; i++) inside[i] = px[i * 4] > 128;
  const dist = chamfer(inside, W, D);
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, x = OX + (i + .5) * S, z = OZ + (j + .5) * S;
    const n = .6 * vnoise(x / 110, z / 110) + .28 * vnoise(x / 34 + 5, z / 34 + 9) + .12 * vnoise(x / 11 + 3, z / 11 + 1);
    const v = dist[k] * S / 3 / EDGE - smooth(.3, .7, n) * .95;
    MASK[k] = Math.max(0, Math.min(255, Math.round(128 + v * 127)));
  }
}

export function edgeAt(x, z) {
  if (!EDGE) return 1;
  const i = Math.floor((x - OX) / S), j = Math.floor((z - OZ) / S);
  return i < 0 || j < 0 || i >= W || j >= D ? -1 : (MASK[j * W + i] - 128) / 127;
}

// Ground within r of a landmark or place stays solid, with a 30 m ramp back into the fray.

export function keep(x, z, r) {
  if (!EDGE) return;
  const R = r + 30;
  for (let j = Math.max(0, Math.floor((z - R - OZ) / S)); j <= Math.min(D - 1, Math.floor((z + R - OZ) / S)); j++)
    for (let i = Math.max(0, Math.floor((x - R - OX) / S)); i <= Math.min(W - 1, Math.floor((x + R - OX) / S)); i++) {
      const d = Math.hypot(OX + (i + .5) * S - x, OZ + (j + .5) * S - z), k = j * W + i;
      MASK[k] = Math.max(MASK[k], Math.round(128 + 127 * Math.min(1, Math.max(0, (R - d) / 30)) * .6));
    }
  tex.needsUpdate = true;
}

const tex = new THREE.DataTexture(MASK, W, D, THREE.RedFormat, THREE.UnsignedByteType);
tex.magFilter = tex.minFilter = THREE.LinearFilter;
tex.needsUpdate = true;

export const EDGE_U = { uFray: { value: tex }, uFrayBox: { value: new THREE.Vector4(OX, OZ, 1 / (W * S), 1 / (D * S)) } };
export const EDGE_GLSL = `
  uniform sampler2D uFray; uniform vec4 uFrayBox;
  bool frayed(vec2 p) { return texture2D(uFray, (p - uFrayBox.xy) * uFrayBox.zw).r < .5; }`;
