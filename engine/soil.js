// Soft ground. Kits lay soil patches here instead of hard slabs. Every patch paints into one canvas, a blur
// feathers the edges and joins near neighbours, and one surface draws the result with a noisy rim.
// generate() resets the list to its base, calls buildSoil at the end, and mark and undo keep its length.

import * as THREE from 'three';
import { S } from './state.js';
import { CITY } from './core.js';
import { SURFACE, surface } from './render.js';

// PX is metres per texel and BLUR the feather in metres. The canvas holds colour divided by TOP, so the
// dark soil tones keep their precision in 8 bits.

const PX = 2, BLUR = 3, TOP = .12, Y = .14;
export const SOIL = [];

// A patch is a rectangle in the current lot frame, like a prop box. rgb is linear, like a prop colour.

export function soil(x, z, w, d, rgb, ry = 0) {
  const F = S.FRAME;
  if (F) {
    const dx = x - F.cx, dz = z - F.cz;
    x = (F.tx ?? F.cx) + dx * F.c + dz * F.s;
    z = (F.tz ?? F.cz) - dx * F.s + dz * F.c;
    ry += F.a;
  }
  SOIL.push([x, z, w, d, ry, rgb]);
}

let mesh = null;
export function buildSoil() {
  if (mesh) {
    mesh.material.map.dispose(); mesh.geometry.dispose(); mesh.removeFromParent();
    SURFACE.splice(SURFACE.indexOf(mesh), 1);
    mesh = null;
  }
  if (!SOIL.length) return;

  // The canvas covers only the patches' extent plus the feather, on the city's texel grid, so a pack with a few
  // patches in one corner does not pay for a city-wide texture.

  const [cx, cz] = CITY.origin, pad = BLUR * 3;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z, w, d] of SOIL) {
    const r = Math.hypot(w, d) / 2 + pad;
    x0 = Math.min(x0, x - r); z0 = Math.min(z0, z - r); x1 = Math.max(x1, x + r); z1 = Math.max(z1, z + r);
  }
  const ox = Math.max(cx, cx + Math.floor((x0 - cx) / PX) * PX), oz = Math.max(cz, cz + Math.floor((z0 - cz) / PX) * PX);
  const W = Math.ceil((Math.min(x1, cx + CITY.dims[0]) - ox) / PX), H = Math.ceil((Math.min(z1, cz + CITY.dims[1]) - oz) / PX);
  const dx = W * PX, dz = H * PX;
  if (W < 1 || H < 1) return;
  const paint = document.createElement('canvas');
  paint.width = W; paint.height = H;
  const g = paint.getContext('2d');
  g.setTransform(1 / PX, 0, 0, 1 / PX, -ox / PX, -oz / PX);
  const css = rgb => `rgb(${rgb.map(c => Math.min(255, Math.round(c / TOP * 255))).join(',')})`;
  for (const [x, z, w, d, ry, rgb] of SOIL) {
    g.save();
    g.translate(x, z); g.rotate(-ry);
    g.fillStyle = css(rgb);
    g.fillRect(-w / 2, -d / 2, w, d);
    g.restore();
  }

  // The blur runs on a second canvas. A browser without canvas filters keeps the hard paint, softened by
  // the texture's own filtering.

  const soft = document.createElement('canvas');
  soft.width = W; soft.height = H;
  const s = soft.getContext('2d');
  s.filter = `blur(${BLUR / PX}px)`;
  s.drawImage(paint, 0, 0);

  const map = new THREE.CanvasTexture(soft);
  map.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map, color: new THREE.Color(TOP, TOP, TOP), roughness: .75, metalness: .35,
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  mesh = new THREE.Mesh(new THREE.PlaneGeometry(dx, dz).rotateX(-Math.PI / 2).translate(ox + dx / 2, Y, oz + dz / 2), mat);
  surface(mesh);

  // The rim: alpha passes a noisy threshold, so a patch edge wanders like a field margin instead of a ruler line.

  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    prev(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        float soilNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
          float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5), b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5);
          float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5), d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5);
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float n = soilNoise(vHole / 9.) * .65 + soilNoise(vHole / 3.) * .35;
        diffuseColor.a = smoothstep(.3, .6, sampledDiffuseColor.a + (n - .5) * .5);
        if (diffuseColor.a < .01) discard;`);
  };
}
