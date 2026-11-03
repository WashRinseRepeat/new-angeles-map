// Land and sea around the city: real elevation of coastal Ecuador and the Andes, warped onto the canon map
// by gen/terrain.py. terrain.png covers world [CX ± EXT] x [CZ ± EXT]. R * 256 + G = elevation + 11000.
// The Pacific lies west of the traced coast. Cayambe rises east of the Root, the Andes run down the east side.

import { CLOUD_SCENE } from '../../../engine/render.js';
import { cloudLayer } from '../../../engine/clouds.js';
import { edgeAt } from '../../../engine/edge.js';
import { MAP } from '../map.js';

const CX = -158, CZ = 1476, EXT = 13000;
const V = .05;                  // world metres per real metre: 4x exaggeration at 82 real m per world m
const SEA = -2;                 // sea surface
const FLAT = 40, BLEND = 450;   // flat margin round the city, then the ramp up to real terrain
const FRAME = [-2448, -1404, 2131, 4356];
const px = (x, y) => [(x - MAP.cx) * MAP.scale, (y - MAP.cy) * MAP.scale];

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

// The Andes deck shows only where the ground under it is high, so valleys fill and the summits stand clear.
// The city layer holds cumulus: flat bases, domed tops, the neon glow on the underside, and a clear space
// round the camera. A thin layer of stretched wisps drifts at tower-top height, so the tallest towers pierce
// it. Seen from inside or above, both city layers thin out, so they never veil the districts.

const PEAK_MASK = `
        float ground = elevAt(vW.xz);
        mask = smoothstep(1800., 2600., ground) * (1. - smoothstep(${(2900 - 150).toFixed(1)}, ${(2900 + 250).toFixed(1)}, ground));
        mask *= texture(uOpen, (vW.xz - uBox.xy) / uBox.zw).r;
        if (mask <= 0.) discard;`;

// New Angeles' decks span its heightmap and read its elevation. The Andes deck adds the peak cells and the mask.

const naLayer = (H, hm, land, { peaks = false, ...o }) => cloudLayer(H, { ...o, centre: [CX, CZ], extent: EXT, glsl: ELEV_GLSL,
  uniforms: { ...elevUniforms(H, hm), ...peaks ? { uOpen: { value: openLand(H, land) } } : {} },
  ...peaks ? { geo: peakCells(H, land, (o.y0 + o.y1) / 2), mask: PEAK_MASK } : {} });

const cloudDecks = (H, hm, land) => [
  naLayer(H, hm, land, { y0: 2900 * V - 40, y1: 2900 * V + 90, cell: 100, tile: 9000, cover: .8, peaks: true }),
  naLayer(H, hm, land, { y0: 720, y1: 1080, cell: 100, tile: 6500, cover: .5, glow: [.16, .07, .1], near: 140, reach: 9000, above: .25 }),
  naLayer(H, hm, land, { y0: 230, y1: 320, cell: 90, tile: 5000, cover: .7, glow: [.22, .1, .14], dome: false, stretch: 3, erode: 1.2, near: 120, reach: 9000, above: .5 }),
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

  // Trees keep off the city, but grow up to its edge and into the ground where the edge frays. Outside the city
  // they also keep off the ground a landmark holds, such as the power plant's clearing.

  const tooClose = (x, z, d, gap) => OLD ? d < gap : d > 0 ? d < 3 || edgeAt(x, z) > .3 : edgeAt(x, z) > -.05;
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
    if (tooClose(x, z, d, 15) || r() > Math.exp(-d / 380) || land.real(x, z) < 2) continue;
    const y = land.height(x, z, d);

    // A clump of four to eight crowns.

    for (let k = 4 + Math.floor(r() * 5); k > 0 && nc < crowns.instanceMatrix.count; k--) {
      const tx = x + (r() - .5) * 26, tz = z + (r() - .5) * 26, s = 4 + r() * 5;
      if (tooClose(tx, tz, land.cityDist(tx, tz), 12) || land.real(tx, tz) < 2) continue;
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
