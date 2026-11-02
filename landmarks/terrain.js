// Land and sea around the city: real elevation of coastal Ecuador and the Andes, warped onto the canon map
// by gen/terrain.py. terrain.png covers world [CX ± EXT] x [CZ ± EXT]. R * 256 + G = elevation + 11000.
// The Pacific lies west of the traced coast. Cayambe rises east of the Root, the Andes run down the east side.

import { CLOUD_SCENE, CLOUD_U, QUALITY } from '../engine/render.js';

const CX = -158, CZ = 1476, EXT = 13000;
const V = .05;                  // world metres per real metre: 4x exaggeration at 82 real m per world m
const SEA = -2;                 // sea surface
const FLAT = 40, BLEND = 450;   // flat margin round the city, then the ramp up to real terrain
const FRAME = [-2448, -1404, 2131, 4356];
const px = (x, y) => [(x - 680) * 3.6, (y - 390) * 3.6];

export function build(H, group) {
  load(H, new URL('./terrain.png', import.meta.url)).then(hm => {
    const land = landField(H, hm);
    group.add(terrainMesh(H, land), seaMesh(H, hm), ...edgeLights(H, land), ...jungle(H, land));
    for (const m of cloudDecks(H, hm, land)) { CLOUD_SCENE.add(m); m.updateMatrixWorld(); }
  });
}

async function load(H, url) {
  const bmp = await createImageBitmap(await (await fetch(url)).blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const cv = new OffscreenCanvas(bmp.width, bmp.height);
  const g = cv.getContext('2d');
  g.drawImage(bmp, 0, 0);
  const px = g.getImageData(0, 0, bmp.width, bmp.height).data;
  const n = bmp.width, e = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) e[i] = px[i * 4] * 256 + px[i * 4 + 1] - 11000;
  const tex = new H.THREE.Texture(bmp);
  tex.minFilter = tex.magFilter = H.THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return { n, e, tex };
}

// GLSL: bilinear real elevation from the encoded texture.

const ELEV_GLSL = `
  uniform sampler2D uElev; uniform vec4 uBox; uniform float uN;
  float texel(vec2 ij) { vec4 c = texture2D(uElev, (clamp(ij, 0., uN - 1.) + .5) / uN); return floor(c.r * 255. + .5) * 256. + floor(c.g * 255. + .5) - 11000.; }
  float elevAt(vec2 xz) {
    vec2 p = (xz - uBox.xy) / uBox.zw * uN - .5, i = floor(p), f = p - i;
    return mix(mix(texel(i), texel(i + vec2(1, 0)), f.x), mix(texel(i + vec2(0, 1)), texel(i + 1.), f.x), f.y);
  }`;
const elevUniforms = (H, hm) => ({
  uElev: { value: hm.tex }, uN: { value: hm.n },
  uBox: { value: new H.THREE.Vector4(CX - EXT, CZ - EXT, 2 * EXT, 2 * EXT) },
});

// Height field: real elevation, flat over the districts and along the highways.

function landField(H, { n, e }) {
  const polys = H.CITY.districts.map(d => {
    const p = d.poly, xs = p.map(q => q[0]), zs = p.map(q => q[1]);
    return { p, box: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] };
  });
  const roads = H.CITY.highways.map(h => h.pts);
  const reach = FLAT + BLEND;
  const real = (x, z) => {
    const u = Math.min(n - 1.001, Math.max(0, (x - CX + EXT) / (2 * EXT) * n - .5));
    const v = Math.min(n - 1.001, Math.max(0, (z - CZ + EXT) / (2 * EXT) * n - .5));
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, k = j * n + i;
    return (e[k] * (1 - fu) + e[k + 1] * fu) * (1 - fv) + (e[k + n] * (1 - fu) + e[k + n + 1] * fu) * fv;
  };
  const cityDist = (x, z) => {
    let d = Infinity;
    for (const { p, box } of polys) {
      if (x < box[0] - reach || x > box[2] + reach || z < box[1] - reach || z > box[3] + reach) continue;
      if (inside(x, z, p)) return 0;
      for (let i = 0; i < p.length; i++) d = Math.min(d, segDist(x, z, p[i], p[(i + 1) % p.length]));
    }
    for (const l of roads) for (let i = 1; i < l.length; i++) d = Math.min(d, segDist(x, z, l[i - 1], l[i]) + FLAT * .5);
    return d;
  };

  // Sea floor stays down, so the shore meets the city edge without a strip of raised ground.
  const height = (x, z, d = cityDist(x, z)) => {
    const r = real(x, z);
    if (r < 0) return d === 0 ? -.5 : SEA - .5 + r * V * .3;
    const t = H.smooth(FLAT, reach, d);
    return d <= FLAT ? -.5 : r * V * t - .5 * (1 - t);
  };
  return { real, height, cityDist };
}

function inside(x, z, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
  return c;
}
function segDist(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}

// Grid lines 18 m apart over the map frame, widening by 8 % a step out to the edge.

function axis(lo, hi, min, max) {
  const a = [];
  for (let v = lo; v <= hi; v += 18) a.push(v);
  for (let s = 18, v = lo; v > min; ) a.unshift(v -= (s *= 1.08));
  for (let s = 18, v = a.at(-1); v < max; ) a.push(v += (s *= 1.08));
  return a;
}

function terrainMesh(H, land) {
  const { THREE } = H;
  const xs = axis(FRAME[0], FRAME[2], CX - EXT, CX + EXT), zs = axis(FRAME[1], FRAME[3], CZ - EXT, CZ + EXT);
  const W = xs.length, D = zs.length;
  const pos = new Float32Array(W * D * 3), elev = new Float32Array(W * D);
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, x = xs[i], z = zs[j];
    pos[k * 3] = x; pos[k * 3 + 1] = land.height(x, z); pos[k * 3 + 2] = z;
    elev[k] = land.real(x, z);
  }
  const idx = new Uint32Array((W - 1) * (D - 1) * 6);
  for (let j = 0, o = 0; j < D - 1; j++) for (let i = 0; i < W - 1; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    idx.set([a, c, b, b, c, d], o); o += 6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aElev', new THREE.BufferAttribute(elev, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    uniforms: { ...H.U, uMoon: { value: new THREE.Vector3(300, 800, 200).normalize() }, uCentre: { value: new THREE.Vector2(CX, CZ) } },
    polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4,
    vertexShader: `
      attribute float aElev; varying vec3 vW, vN; varying float vE;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.);
        vW = w.xyz; vN = normal; vE = aElev;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform vec3 uMoon; uniform vec2 uCentre; varying vec3 vW, vN; varying float vE;
      ${H.FOG_GLSL}
      void main(){
        if (vW.y > uClipTop) discard;
        vec3 n = normalize(vN);
        float slope = 1. - n.y;

        // Lowland scrub, cloud forest, paramo grass, bare rock on steep ground, glacier on the peaks.
        vec3 col = mix(vec3(.011, .012, .009), vec3(.008, .012, .011), smoothstep(300., 1500., vE));
        col = mix(col, vec3(.019, .02, .016), smoothstep(2700., 3900., vE));
        col = mix(col, vec3(.022, .021, .021), smoothstep(.3, .65, slope) + smoothstep(4300., 4700., vE) * .7);
        float snow = smoothstep(4650., 4950., vE + n.y * 120.) * (1. - smoothstep(.6, .85, slope));
        col = mix(col, vec3(.2, .24, .31), snow);
        col = mix(col, vec3(.012, .015, .014), smoothstep(-.5, -.2, -abs(vW.y + .5)));

        float moon = max(dot(n, uMoon), 0.);
        vec3 lit = col * (.55 + .5 * n.y) + col * moon * (1.1 + snow * 1.5);

        // Engine fog near the city. High ground keeps more of its silhouette. The rim fades into the sky.
        vec3 f = fogged(lit, vW);
        float dist = distance(cameraPosition, vW);
        vec3 thin = mix(lit, uFog * 1.2, smoothstep(uFogNear, uFogFar * 1.7, dist) * .9);
        f = mix(f, thin, smoothstep(60., 600., vW.y));
        f = mix(f, uFog, smoothstep(7000., 12500., length(vW.xz - uCentre)));
        gl_FragColor = vec4(f, 1.);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.tris = idx.length / 3;
  return mesh;
}

// The Pacific: a dark sheet with slow moonlit swell, paler over the shelf. Land texels discard it. It draws
// after the opaque scene, so pixels under land and city fail the depth test before its shader runs.

function seaMesh(H, hm) {
  const { THREE } = H;
  const geo = new THREE.PlaneGeometry(2 * EXT, 2 * EXT).rotateX(-Math.PI / 2).translate(CX, SEA, CZ);
  const sea = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: { ...H.U, ...elevUniforms(H, hm), uMoon: { value: new THREE.Vector3(300, 800, 200).normalize() }, uCentre: { value: new THREE.Vector2(CX, CZ) } },
    polygonOffset: true, polygonOffsetFactor: 6, polygonOffsetUnits: 6,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uMoon; uniform vec2 uCentre; varying vec3 vW;
      ${H.FOG_GLSL}
      ${H.WATER_GLSL}
      ${ELEV_GLSL}
      void main(){
        if (vW.y > uClipTop) discard;
        float e = elevAt(vW.xz);
        if (e > 0.) discard;

        // Shelf water is paler; a foam line follows the last few metres of depth.

        vec3 col = waterColor(vW, smoothstep(-14., -1., e), .25);
        col += vec3(.004, .009, .01) * smoothstep(-300., -10., e);
        vec3 f = fogged(col, vW);
        f = mix(f, uFog, smoothstep(7000., 12500., length(vW.xz - uCentre)));
        gl_FragColor = vec4(f, 1.);
      }`,
  }));
  sea.renderOrder = 1;
  return sea;
}

// Cloud layers. Each pixel marches its view ray through a horizontal slab. A coarse weather map places
// separate cloud clusters with clear sky between them. Each cluster's cover sets a height profile, and 3D
// noise erodes that profile into billows, deepest at the edges. One extra sample above each step shades the
// cloud under it, so tops are lit and undersides dark. The step count follows the quality level.
//
// The Andes deck shows only where the ground under it is high, so valleys fill and the summits stand clear.
// The city layer holds cumulus: flat bases, domed tops, the neon glow on the underside, and a clear space
// round the camera. A thin layer of stretched wisps drifts at tower-top height, so the tallest towers pierce
// it. Seen from inside or above, both city layers thin out, so they never veil the districts.

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

// Open land: 0 over the districts and highways, 1 past the ramp up to real terrain, 50 m a texel.

function openLand(H, land) {
  const M = 512, open = new Uint8Array(M * M);
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const x = CX - EXT + (i + .5) / M * 2 * EXT, z = CZ - EXT + (j + .5) / M * 2 * EXT, r = FLAT + BLEND;
    const near = x > FRAME[0] - r && x < FRAME[2] + r && z > FRAME[1] - r && z < FRAME[3] + r;
    open[j * M + i] = near ? 255 * H.smooth(FLAT, r, land.cityDist(x, z)) : 255;
  }
  const tex = new H.THREE.DataTexture(open, M, M, H.THREE.RedFormat);
  tex.minFilter = tex.magFilter = H.THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// The Andes deck draws only on 250 m cells where its mask can be above 0, plus one cell of margin, so
// pixels over the city and the low coast never run its shader. The shader still masks each pixel.

function peakCells(H, land, y) {
  const C = 250, n = Math.ceil(2 * EXT / C), x0 = CX - EXT, z0 = CZ - EXT, r = FLAT + BLEND, hit = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1], [.5, .5]]) {
      const x = x0 + (i + u) * C, z = z0 + (j + v) * C, g = land.real(x, z);
      const near = x > FRAME[0] - r && x < FRAME[2] + r && z > FRAME[1] - r && z < FRAME[3] + r;
      if (g > 1800 && g < 3150 && (!near || land.cityDist(x, z) > FLAT)) { hit[j * n + i] = 1; break; }
    }
  }
  const pos = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let on = false;
    for (let dj = -1; dj <= 1 && !on; dj++) for (let di = -1; di <= 1 && !on; di++) on = !!hit[(j + dj) * n + i + di];
    if (!on) continue;
    const a = x0 + i * C, b = z0 + j * C;
    pos.push(a, y, b, a, y, b + C, a + C, y, b, a + C, y, b, a, y, b + C, a + C, y, b + C);
  }
  const g = new H.THREE.BufferGeometry();
  g.setAttribute('position', new H.THREE.Float32BufferAttribute(pos, 3));
  return g;
}

// cell is the noise cell in metres, tile the weather map's span in metres, cover how much of a cluster
// becomes cloud (0 to 1), glow the underside light. dome gives cumulus: a flat base and a top that rises
// with the cover, so each cluster swells into a dome. Without it a cluster is a thin lens, and stretch
// draws it out along the wind into streaks. erode is how deep the noise bites into the edges.

function cloudLayer(H, hm, land, { y0, y1, cell, tile, cover, glow = [0, 0, 0], dome = true, stretch = 1, erode = 1, peaks = false, near = 0, reach = 12000, above = 1 }) {
  const { THREE } = H, f = n => n.toFixed(5), turn = y0 * .013;
  const uSteps = { value: CLOUD_STEPS.high };
  const geo = peaks ? peakCells(H, land, (y0 + y1) / 2) : new THREE.PlaneGeometry(2 * EXT, 2 * EXT, 1, 1).rotateX(-Math.PI / 2).translate(CX, (y0 + y1) / 2, CZ);
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: { ...H.U, ...elevUniforms(H, hm), uCentre: { value: new THREE.Vector2(CX, CZ) }, uNoise: { value: cloudNoise(H) },
      uWeather: { value: cloudWeather(H) }, uOpen: { value: peaks ? openLand(H, land) : null }, uSteps, ...CLOUD_U },
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      precision highp sampler3D;
      #include <packing>
      uniform sampler2D uDepth; uniform vec2 uLowRes; uniform float uNear, uFar;
      uniform float uTime, uSteps; uniform vec2 uCentre; uniform sampler3D uNoise; uniform sampler2D uWeather, uOpen; varying vec3 vW;
      ${H.FOG_GLSL}
      ${ELEV_GLSL}
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
        ${peaks ? `
        float ground = elevAt(vW.xz);
        mask = smoothstep(1800., 2600., ground) * (1. - smoothstep(${(2900 - 150).toFixed(1)}, ${(2900 + 250).toFixed(1)}, ground));
        mask *= texture(uOpen, (vW.xz - uBox.xy) / uBox.zw).r;
        if (mask <= 0.) discard;` : ''}

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

const cloudDecks = (H, hm, land) => [
  cloudLayer(H, hm, land, { y0: 2900 * V - 40, y1: 2900 * V + 90, cell: 100, tile: 9000, cover: .8, peaks: true }),
  cloudLayer(H, hm, land, { y0: 720, y1: 1080, cell: 100, tile: 6500, cover: .5, glow: [.16, .07, .1], near: 140, reach: 9000, above: .25 }),
  cloudLayer(H, hm, land, { y0: 230, y1: 320, cell: 90, tile: 5000, cover: .7, glow: [.22, .1, .14], dome: false, stretch: 3, erode: 1.2, near: 120, reach: 9000, above: .5 }),
];

// Edge lights: Andean villages and roads, Ecuadorian suburbs E and SE, violet agriplexes NW,
// field lights on the agricultural plots, buoy grids and barges offshore.

// Jungle round the city: canopies thin out over about 900 m from the city edge, with lit shacks
// among the trees near it, so the city bleeds into green instead of ending at a line.

function jungle(H, land) {
  const { THREE } = H;
  const r = H.rng(H.hash(5521, 803));
  const edges = H.CITY.districts.flatMap(d => d.poly.map((q, i) => [q, d.poly[(i + 1) % d.poly.length]]));

  // Clumps pick a border edge by length, so long straight borders get as much forest as jagged ones, and their
  // distance out skews toward the border, so the forest reaches the city instead of leaving a bare band.

  const sum = [];
  edges.reduce((t, [[ax, az], [bx, bz]]) => (sum.push(t + Math.hypot(bx - ax, bz - az)), sum.at(-1)), 0);
  const byLength = q => { let lo = 0, hi = sum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (sum[m] < q * sum.at(-1)) lo = m + 1; else hi = m; } return lo; };
  const OLD = new URLSearchParams(location.search).get('infill') === '0';
  const crowns = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), 45000);
  const huts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .9 }), 1500);
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 1500);
  const o = new THREE.Object3D(), c = new THREE.Color();
  let nc = 0, nh = 0;
  for (let tries = 0; tries < 120000 && nc < crowns.instanceMatrix.count; tries++) {
    const q = r(), [[ax, az], [bx, bz]] = edges[OLD ? Math.floor(q * edges.length) : byLength(q)], t = r();
    const dir = r() * Math.PI * 2, u = r(), out = 20 + (OLD ? u : u * u) * 900;
    const x = ax + (bx - ax) * t + Math.cos(dir) * out, z = az + (bz - az) * t + Math.sin(dir) * out;
    const d = land.cityDist(x, z);
    if (d < 15 || r() > Math.exp(-d / 380) || land.real(x, z) < 2) continue;
    const y = land.height(x, z, d);

    // A clump of four to eight crowns.

    for (let k = 4 + Math.floor(r() * 5); k > 0 && nc < crowns.instanceMatrix.count; k--) {
      const tx = x + (r() - .5) * 26, tz = z + (r() - .5) * 26, s = 4 + r() * 5;
      if (land.cityDist(tx, tz) < 12 || land.real(tx, tz) < 2) continue;
      o.position.set(tx, land.height(tx, tz) + s * .6, tz); o.rotation.set(0, r() * 6, 0);
      o.scale.set(s * (.8 + r() * .5), s * (.55 + r() * .4), s * (.8 + r() * .5));
      o.updateMatrix(); crowns.setMatrixAt(nc, o.matrix);
      crowns.setColorAt(nc++, c.setRGB(.022 + r() * .02, .045 + r() * .035, .025 + r() * .015));
    }
    if (d < 260 && nh < huts.instanceMatrix.count && r() < .12) {
      const w = 3 + r() * 4, h = 2.5 + r() * 2;
      o.position.set(x + 6, y + h / 2, z); o.rotation.set(0, r() * 6, 0); o.scale.set(w, h, w * (.6 + r() * .5)); o.updateMatrix();
      huts.setMatrixAt(nh, o.matrix); huts.setColorAt(nh, c.setRGB(.09, .075, .06));
      o.scale.set(.6, .5, .1); o.position.y = y + h * .55; o.translateZ(w * .35); o.updateMatrix();
      lamps.setMatrixAt(nh, o.matrix); lamps.setColorAt(nh++, c.setRGB(...(r() < .8 ? [1.1, .62, .25] : [.5, .8, 1])));
    }
  }
  crowns.count = nc; huts.count = lamps.count = nh;
  for (const m of [huts, lamps]) m.computeBoundingSphere();
  return [...chunked(H, crowns, 500), huts, lamps];
}

// The canopy rings the whole city, so one mesh would never leave the view. Grid chunks let each one be culled.

function chunked(H, src, size) {
  const { THREE } = H, a = src.instanceMatrix.array, cells = new Map();
  for (let i = 0; i < src.count; i++) {
    const key = `${Math.floor(a[i * 16 + 12] / size)},${Math.floor(a[i * 16 + 14] / size)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(i);
  }
  return [...cells.values()].map(idx => {
    const m = new THREE.InstancedMesh(src.geometry, src.material, idx.length);
    idx.forEach((i, j) => {
      m.instanceMatrix.array.set(a.subarray(i * 16, i * 16 + 16), j * 16);
      m.instanceColor ??= new THREE.InstancedBufferAttribute(new Float32Array(idx.length * 3), 3);
      m.instanceColor.array.set(src.instanceColor.array.subarray(i * 3, i * 3 + 3), j * 3);
    });
    m.computeBoundingSphere();
    return m;
  });
}

function edgeLights(H, land) {
  const { THREE } = H;
  const r = H.rng(H.hash(1871, 4405));
  const small = { p: [], c: [] }, big = { p: [], c: [] };
  const SODIUM = [1, .55, .22], COOL = [.7, .8, 1], VIOLET = [.8, .25, 1], BUOY = [.4, .9, 1];
  const add = (set, x, z, c, k, lift = 3) => {
    const e = land.real(x, z);
    set.p.push(x, e < 0 ? SEA + .6 : land.height(x, z) + lift, z);
    set.c.push(c[0] * k, c[1] * k, c[2] * k);
  };
  const open = (x, z, d = 80) => land.cityDist(x, z) > d;
  const steep = (x, z) => Math.abs(land.real(x + 20, z) - land.real(x - 20, z)) + Math.abs(land.real(x, z + 20) - land.real(x, z - 20));
  const gauss = () => (r() + r() + r() - 1.5) * 1.15;

  // Andean villages on habitable slopes east of the coast plain.
  for (let tries = 0, towns = 0; tries < 6000 && towns < 90; tries++) {
    const x = CX + (r() - .5) * 15000, z = CZ + (r() - .5) * 15000, e = land.real(x, z);
    if (e < 900 || e > 3600 || steep(x, z) > 900 || !open(x, z, 150)) continue;
    towns++;
    const n = 4 + Math.floor(r() * r() * 40), s = 10 + Math.sqrt(n) * 6;
    for (let i = 0; i < n; i++) {
      const px = x + gauss() * s, pz = z + gauss() * s;
      if (open(px, pz) && land.real(px, pz) > 0) add(small, px, pz, r() < .8 ? SODIUM : COOL, .45 + r() * .5);
    }
  }

  // Suburb carpets: east of Rabotgorod and the slum ring beyond Guayaquil.
  for (const [cx, cz, sx, sz, n] of [[...px(945, 1072), 700, 900, 1500], [...px(1340, 1350), 900, 1100, 1300], [...px(1100, 860), 500, 600, 900]]) {
    for (let i = 0; i < n; i++) {
      const x = cx + gauss() * sx, z = cz + gauss() * sz;
      if (open(x, z) && land.real(x, z) > 0) add(small, x, z, r() < .85 ? SODIUM : COOL, .2 + r() * .35);
    }
  }

  // Agriplexes north-west: field grids of faint violet lamps round a few glowing towers.
  const [ax, az] = px(275, 175);
  for (let k = 0; k < 14; k++) {
    const x0 = ax + gauss() * 900, z0 = az + gauss() * 700, ry = r() * Math.PI;
    if (land.real(x0, z0) <= 0 || !open(x0, z0, 150)) continue;
    add(big, x0, z0, VIOLET, 1.1, 30 + r() * 40);
    const c = Math.cos(ry), s = Math.sin(ry);
    for (let i = -4; i <= 4; i++) for (let j = -3; j <= 3; j++) {
      const u = i * 22, w = j * 22, x = x0 + u * c - w * s, z = z0 + u * s + w * c;
      if (land.real(x, z) > 0 && open(x, z)) add(small, x, z, VIOLET, .2);
    }
  }

  // Agricultural plots inside the city ring: sparse security lights on a grid, where no district covers them.
  for (const [x0, z0] of [px(767, 1127), px(687, 1208)]) for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
    const x = x0 + i * 30, z = z0 + j * 30;
    if (r() < .5 && open(x, z, 60) && land.real(x, z) > 0) add(small, x, z, [.9, .85, .7], .25);
  }

  // Offshore aquaculture: buoy grids on the shelf, with a few lit barges and freighters.
  for (let tries = 0, farms = 0; tries < 3000 && farms < 40; tries++) {
    const x = FRAME[0] + r() * (FRAME[2] - FRAME[0]), z = FRAME[1] + r() * (FRAME[3] - FRAME[1]), e = land.real(x, z);
    if (e > -20 || e < -400) continue;
    farms++;
    const ry = r() * Math.PI, c = Math.cos(ry), s = Math.sin(ry), nx = 3 + Math.floor(r() * 6), nz = 3 + Math.floor(r() * 4);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const u = i * 14, w = j * 14, bx = x + u * c - w * s, bz = z + u * s + w * c;
      if (land.real(bx, bz) < -5) add(small, bx, bz, BUOY, .22);
    }
    if (r() < .4) add(big, x - 20 * s, z + 20 * c, SODIUM, .6);
  }
  for (let k = 0; k < 30; k++) {
    const x = CX + (r() - .5) * 16000, z = CZ + (r() - .5) * 16000;
    if (land.real(x, z) < -500) add(big, x, z, [1, .9, .8], .5);
  }

  const points = (set, size) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(set.p, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(set.c, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ size, sizeAttenuation: true, vertexColors: true, fog: true }));
  };
  return [points(small, 4), points(big, 9)];
}
