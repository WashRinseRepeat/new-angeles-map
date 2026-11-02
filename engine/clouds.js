// Cloud layers, drawn by the engine's cloud pass (render.js) into CLOUD_SCENE.

import { CLOUD_SCENE, CLOUD_U, QUALITY } from './render.js';

// Cloud layers. Each pixel marches its view ray through a horizontal slab. A coarse weather map places
// separate cloud clusters with clear sky between them. Each cluster's cover sets a height profile, and 3D
// noise erodes that profile into billows, deepest at the edges. One extra sample above each step shades the
// cloud under it, so tops are lit and undersides dark. The step count follows the quality level.
//
// A pack lists its decks in look.clouds, and the engine lays them over the centre. A terrain module may build its
// own decks with cloudLayer, adding uniforms, GLSL, a geometry and mask code that sets mask or discards.

const CLOUD_STEPS = { high: 20, medium: 12, low: 6 };

// Tileable value noise: seeded random bytes on a wrapped 64³ grid, smoothed by trilinear filtering.
// The seed keeps the same sky on every visit.

let NOISE = null;
function cloudNoise(H) {
  const { THREE } = H;
  if (NOISE) return NOISE;
  const N = 64, bytes = new Uint8Array(N * N * N), r = H.rng(H.hash(64, 3));
  for (let i = 0; i < bytes.length; i++) bytes[i] = r() * 256;
  NOISE = new THREE.Data3DTexture(bytes, N, N, N);
  NOISE.format = THREE.RedFormat;
  NOISE.minFilter = NOISE.magFilter = THREE.LinearFilter;
  NOISE.wrapS = NOISE.wrapT = NOISE.wrapR = THREE.RepeatWrapping;
  NOISE.needsUpdate = true;
  return NOISE;
}

// Weather map: where clouds can form. Each cluster is a few soft round puffs strung along a random heading,
// and the puffs add up, so a cluster has several summits. A smooth warp bends the whole map, so no cluster
// reads as a circle. Between clusters the map is 0, which keeps clear sky. The 256² grid wraps.

let WEATHER = null;
function cloudWeather(H) {
  if (WEATHER) return WEATHER;
  const M = 256, w = new Float32Array(M * M), r = H.rng(H.hash(77, 9)), wrap = i => (i % M + M) % M;
  for (let c = 0; c < 26; c++) {
    const cx = r() * M, cy = r() * M, R = M * (.03 + r() * .035), a = r() * Math.PI * 2, n = 3 + (r() * 4 | 0);
    for (let k = 0; k < n; k++) {
      const along = (r() - .5) * R * 2.4, across = (r() - .5) * R * .8, s = R * (.4 + r() * .45), peak = .65 + r() * .5;
      const px = cx + Math.cos(a) * along - Math.sin(a) * across, py = cy + Math.sin(a) * along + Math.cos(a) * across, b = Math.ceil(s * 2.5);
      for (let j = -b; j <= b; j++) for (let i = -b; i <= b; i++) {
        const dx = Math.round(px) + i - px, dy = Math.round(py) + j - py;
        w[wrap(Math.round(py) + j) * M + wrap(Math.round(px) + i)] += peak * Math.exp(-(dx * dx + dy * dy) / (s * s));
      }
    }
  }

  // Two octaves of wrapped value noise make the clusters lumpy, so outlines bulge and tops rise in turrets.

  const lump = (L, i, j) => {
    const g = lat[L] ??= Array.from({ length: L * L }, r), x = i * L / M, y = j * L / M, x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = H.smooth(0, 1, x - x0), fy = H.smooth(0, 1, y - y0), at = (u, v) => g[(v % L) * L + u % L];
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  }, lat = {};
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) w[j * M + i] *= .45 + .75 * (lump(16, i, j) * .6 + lump(32, i, j) * .4);

  // The warp uses whole sine periods per tile, so the map still wraps.

  const bytes = new Uint8Array(M * M), T = Math.PI * 2 / M;
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const x = i + 9 * Math.sin(T * 2 * j + 1.3) + 4 * Math.sin(T * (5 * j + 3 * i)), y = j + 9 * Math.sin(T * 3 * i + .4) + 4 * Math.sin(T * (4 * i - 5 * j));
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, at = (u, v) => w[wrap(v) * M + wrap(u)];
    const v = (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
    bytes[j * M + i] = Math.min(255, v * 200);
  }
  WEATHER = new H.THREE.DataTexture(bytes, M, M, H.THREE.RedFormat);
  WEATHER.minFilter = WEATHER.magFilter = H.THREE.LinearFilter;
  WEATHER.wrapS = WEATHER.wrapT = H.THREE.RepeatWrapping;
  WEATHER.needsUpdate = true;
  return WEATHER;
}

// cell is the noise cell in metres, tile the weather map's span in metres, cover how much of a cluster
// becomes cloud (0 to 1), glow the underside light. dome gives cumulus: a flat base and a top that rises
// with the cover, so each cluster swells into a dome. Without it a cluster is a thin lens, and stretch
// draws it out along the wind into streaks. erode is how deep the noise bites into the edges.

export function cloudLayer(H, { y0, y1, cell, tile, cover, glow = [0, 0, 0], dome = true, stretch = 1, erode = 1, near = 0, reach = 12000, above = 1,
  centre = [0, 0], extent = 13000, geo, uniforms = {}, glsl = '', mask = '' }) {
  const { THREE } = H, f = n => n.toFixed(5), turn = y0 * .013;
  const uSteps = { value: CLOUD_STEPS.high };
  const [CX, CZ] = centre;
  geo ??= new THREE.PlaneGeometry(2 * extent, 2 * extent, 1, 1).rotateX(-Math.PI / 2).translate(CX, (y0 + y1) / 2, CZ);
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: { ...H.U, uOpen: { value: null }, ...uniforms, uCentre: { value: new THREE.Vector2(CX, CZ) }, uNoise: { value: cloudNoise(H) },
      uWeather: { value: cloudWeather(H) }, uSteps, ...CLOUD_U },
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      precision highp sampler3D;
      #include <packing>
      uniform sampler2D uDepth; uniform vec2 uLowRes; uniform float uNear, uFar;
      uniform float uTime, uSteps; uniform vec2 uCentre; uniform sampler3D uNoise; uniform sampler2D uWeather, uOpen; varying vec3 vW;
      ${H.FOG_GLSL}
      ${glsl}
      const float Y0 = ${y0.toFixed(1)}, Y1 = ${y1.toFixed(1)}, K = ${f(1 / (64 * cell))}, COVER = ${f(cover)}, E = ${f(erode)};
      const vec2 SPAN = vec2(${f(tile * stretch)}, ${f(tile)}), OFF = vec2(${f(Math.cos(turn * 7) * .5 + .5)}, ${f(Math.sin(turn * 5) * .5 + .5)});
      const mat2 ROT = mat2(${f(Math.cos(turn))}, ${f(Math.sin(turn))}, ${f(-Math.sin(turn))}, ${f(Math.cos(turn))});
      const vec3 GLOW = vec3(${glow.map(f).join(', ')});

      // The weather map and the noise drift with one wind, so a cloud moves as a whole. The noise also
      // rises slowly, so the billows build and dissolve as they go. c is the cover at a point: 0 in clear
      // sky, 1 in a cluster's core.

      vec3 wind(vec3 p) { return p * K + vec3(uTime * .0011, uTime * .0005, uTime * .0004); }
      float cover(vec2 xz) {
        vec2 u = ROT * ((xz + uTime * vec2(.0011, .0004) / K) / SPAN) + OFF;
        return clamp((texture(uWeather, u).r - 1. + COVER) * 1.8, 0., 1.);
      }

      // The height profile s is how much cloud a point can hold, before the noise erodes it.

      float prof(float h, float c) {
        ${dome ? 'float top = pow(c, .75); return smoothstep(0., .2, h) * (1. - smoothstep(top - .4, top, h));'
               : 'return c * .9 * smoothstep(0., .5, h) * (1. - smoothstep(.5, 1., h));'}
      }

      // The coarse octave alone shows whether a sample can hold any cloud, so the fine one is fetched only
      // then. The fine one is bent by the coarse one, which curls the edges. The shading sample reads only
      // the coarse octave, with the fine one at its mean.

      float dens(vec3 p, float c) {
        float s = prof(clamp((p.y - Y0) / (Y1 - Y0), 0., 1.), c);
        if (s <= 0.) return 0.;
        vec3 q = wind(p);
        float lo = texture(uNoise, q).r;
        if (smoothstep(.2, .8, lo * .7 + .3) <= (1. - s) * E) return 0.;
        float hi = texture(uNoise, q * 2.3 + vec3(lo * .5, -uTime * .001, lo * .3)).r;
        return clamp((smoothstep(.2, .8, lo * .7 + hi * .3) - (1. - s) * E) * 3., 0., 1.);
      }
      float densLo(vec3 p, float c) {
        float s = prof(clamp((p.y - Y0) / (Y1 - Y0), 0., 1.), c);
        if (s <= 0.) return 0.;
        return clamp((smoothstep(.2, .8, texture(uNoise, wind(p)).r * .7 + .15) - (1. - s) * E) * 3., 0., 1.);
      }
      void main(){
        if (vW.y > uClipTop) discard;
        float fade = 1. - smoothstep(${f(reach * .6)}, ${f(reach)}, length(vW.xz - uCentre));
        if (fade <= 0.) discard;
        float mask = 1.;
        ${mask}

        // The view ray's stretch inside the slab, capped at 700 m. Steps are at most STEP long, so a short
        // stretch takes fewer of them. A random offset on the first step hides banding between steps.

        vec3 ro = cameraPosition, rd = normalize(vW - ro);
        float ta = (Y0 - ro.y) / rd.y, tb = (Y1 - ro.y) / rd.y;
        float t0 = max(min(ta, tb), 0.), t1 = min(max(ta, tb), t0 + 700.);

        // The ray stops at the scene: the distance along it to the depth under this pixel.

        vec3 fwd = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
        float zd = texture2D(uDepth, gl_FragCoord.xy / uLowRes).r;
        if (zd < 1.) t1 = min(t1, -perspectiveDepthToViewZ(zd, uNear, uFar) / dot(rd, fwd));
        if (t1 <= t0) discard;
        const float STEP = ${f(Math.min(35, cell * .4))};
        float L = t1 - t0, n = clamp(ceil(L / STEP), 4., uSteps), dt = L / n, j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        vec3 lit = mix(uFog * 2.2, vec3(.28, .31, .4), .35), dark = uFog * .45, col = vec3(0.);
        float T = 1., up = (Y1 - Y0) * .3;
        for (int i = 0; i < 20; i++) {
          if (float(i) >= n || T < .03) break;
          float t = t0 + (float(i) + j) * dt;
          vec3 p = ro + rd * t;
          float k = ${near > 0 ? `smoothstep(${f(near)}, ${f(near * 3)}, t)` : '1.'}, c = cover(p.xz) * mask;
          if (k <= 0. || c <= 0.) continue;
          float d = dens(p, c) * k;
          if (d <= 0.) continue;
          float h = clamp((p.y - Y0) / (Y1 - Y0), 0., 1.), shade = exp(-densLo(p + vec3(0., up, 0.), c) * 3.);
          float a = 1. - exp(-d * dt * .04);
          col += T * a * (mix(dark, lit, shade * (.4 + .6 * h)) + GLOW * (1. - h) * (1. - h));
          T *= 1. - a;
        }

        // The colour divides by the opacity, so the fade must scale only the alpha. A 0 here would make NaN
        // pixels, and bloom spreads them into black boxes.

        float A = 1. - T;
        if (A < .005) discard;
        gl_FragColor = vec4(fogged(col / A, vW), A * fade * .92${above < 1 ? ` * mix(1., ${f(above)}, smoothstep(Y0 - 150., Y1, ro.y))` : ''});
      }`,
  }));
  m.onBeforeRender = () => { uSteps.value = CLOUD_STEPS[QUALITY.level] ?? CLOUD_STEPS.high; };
  return m;
}


// The pack's own decks, laid over the centre. Each entry takes cloudLayer's options.

export function packClouds(H, decks = []) {
  for (const d of decks) {
    const m = cloudLayer(H, { centre: [H.CENTRE.x, H.CENTRE.y], ...d });
    CLOUD_SCENE.add(m);
    m.updateMatrixWorld();
  }
}
