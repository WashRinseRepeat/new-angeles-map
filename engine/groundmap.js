// The ground map, for a pack whose look.groundMap is set. The town plan is painted into a texture: paved streets
// and the square, the lots, the trodden middle of every street, and the town's extent. One lit surface reads it and
// draws each kind with procedural detail. Main streets get large flat setts, major streets round cobbles and minor
// streets small rough cobbles with stones missing. Paving stops at the town's edge, so roads outside it are dirt with
// wheel ruts and a grass strip down the middle. The trodden middle of a street is worn smooth and pale, weeds grow in
// the joints towards its edges, and a gutter runs along each side. Open ground is bare and trodden near the streets
// and turns to patchy grass and weeds further off. Mud and puddles gather round the gates and the well, and puddles
// in the hollows of the tracks catch the light. It takes the sun, sky light and shadows like any lit surface.
// Outside the town it draws nothing, so the land beneath shows.
//
// look.groundMap keys, with their defaults:
//   px .75             metres per texel of the plan
//   paved { main: 7, major: 5 }   street kinds that are paved, and their width in metres; the square is paved too
//   pavedSites []      kinds of city.json site whose whole footprint, and 2 m round it, is paved
//   track 3.5          width of the trodden middle of every street, in metres
//   cobble, earth, yard, grass   their colours as [r, g, b]; country (default grass) for the grass outside the town
//   mud []             extra mud spots as [x, z, radius]; the gates and the centre have mud already
//   cell .38           size of a cobble in metres
//   mesh 1.25          on a relief, the ground's grid in metres, over the town's wards
//   wall               on a relief, the retaining walls' colour as [r, g, b]

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CENTRE, CENTRE_R, CITY } from './core.js';
import { SETTING } from './setting.js';
import { WATER_MAT, scene, surface } from './render.js';
import { RELIEF, moatWater, terrainAt, walls } from './relief.js';
import { POOL_SINK, pools } from './instances.js';

const G = SETTING.look.groundMap && {
  px: .75, paved: { main: 7, major: 5 }, pavedSites: [], track: 3.5, cell: .38, mesh: 1.25, wall: [.3, .28, .25],
  cobble: [.24, .22, .2], earth: [.2, .16, .11], yard: [.17, .14, .1], grass: [.1, .15, .06], ...SETTING.look.groundMap,
};

// Four masks, one per channel: R paved, G lots, B the trodden track, A the town at full and the country at 0.6:
// the gate roads, the lots past the wall (suburb wards, named suburb-…, and village wards) and, on a relief with a moat, a band round
// the wall. The country is grass but for its roads. Each is drawn white on
// black in its own canvas and blurred a little, so edges blend over a texel or two.

function plan(px = G.px) {
  const [ox, oz] = CITY.origin, [dx, dz] = CITY.dims, W = Math.ceil(dx / px), H = Math.ceil(dz / px);
  const mask = draw => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.setTransform(1 / px, 0, 0, 1 / px, -ox / px, -oz / px);
    g.fillStyle = g.strokeStyle = '#fff'; g.lineCap = g.lineJoin = 'round';
    draw(g);
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const o = out.getContext('2d');
    o.filter = 'blur(1px)';
    o.drawImage(c, 0, 0);
    return o.getImageData(0, 0, W, H).data;
  };
  const poly = (g, P) => { g.beginPath(); P.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); g.closePath(); g.fill(); };
  const line = (g, L, w) => { g.lineWidth = w; g.beginPath(); L.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); g.stroke(); };
  const streets = Object.entries(CITY.streets);

  // The kinds map, at half the plan's detail: R main streets, G minor streets. Others are major.

  if (px !== G.px) {
    const width = kind => (G.paved[kind] ?? G.track) + 1;
    const masks = ['main', 'minor'].map(kind => mask(g => { for (const L of CITY.streets[kind] ?? []) line(g, L, width(kind)); }));
    const data = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) { data[i * 4] = masks[0][i * 4]; data[i * 4 + 1] = masks[1][i * 4]; }
    const t = new THREE.DataTexture(data, W, H);
    t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
    return t;
  }
  const masks = [
    mask(g => {
      for (const [kind, lines] of streets) if (G.paved[kind]) for (const L of lines) line(g, L, G.paved[kind]);
      if (CENTRE_R) { g.beginPath(); g.arc(CENTRE.x, CENTRE.y, CENTRE_R, 0, Math.PI * 2); g.fill(); }
      for (const s of CITY.sites ?? []) if (G.pavedSites.includes(s.kind)) {
        const c = Math.cos(s.rot ?? 0), n = Math.sin(s.rot ?? 0), hw = s.w / 2 + 2, hd = s.d / 2 + 2;
        poly(g, [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [s.at[0] + u * c - v * n, s.at[1] + u * n + v * c]));
      }
    }),
    mask(g => { for (const P of CITY.blocks) poly(g, P); }),
    mask(g => { for (const [, lines] of streets) for (const L of lines) line(g, L, G.track); }),
    mask(g => {
      g.strokeStyle = '#999';
      if (CITY.relief?.moat && CITY.wall?.length) { const m = CITY.relief.moat; line(g, [...CITY.wall, CITY.wall[0]], 2 * ((m.offset ?? 9) + (m.width ?? 12) / 2 + 20)); }
      for (const [kind, lines] of streets) for (const L of lines) line(g, L, (G.paved[kind] ?? G.track) + 2);
      g.fillStyle = '#fff';
      for (const d of CITY.districts) if (!d.id.startsWith('suburb-') && d.kind !== 'village') poly(g, d.poly);
      g.fillStyle = '#999';
      for (const P of CITY.blocks) poly(g, P);
    }),
  ];
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 4; c++) data[i * 4 + c] = masks[c][i * 4];
  const t = new THREE.DataTexture(data, W, H);
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// Mud spots: the gates and the centre's well, as [x, z, radius]. A pack adds its own in look.groundMap.mud.

const MUD = !G ? [] : [...(CITY.gates ?? []).map(([x, z]) => [x, z, 16]), ...CENTRE_R ? [[CENTRE.x, CENTRE.y, 8]] : [], ...G.mud ?? []];
const MUD_N = Math.max(1, MUD.length);

// The procedural ground. Masks get noise added before their threshold, so edges wander instead of following the
// texels. Cobbles are cells of a jittered grid with dark joints; cells and joints smaller than a pixel fade into
// their average. On a relief, steep lanes are drawn as steps. Puddles lie in the hollows of a slow noise on the track. Verges grow where a blurred read of the
// lot mask says a lot is within a few metres.

const GROUND_GLSL = `
  #define MUD_N ${MUD_N}
  uniform sampler2D uGroundMap, uKinds, uPoolMap; uniform vec4 uGroundBox; uniform vec3 uPoolTint; uniform vec3 uCobble, uEarth, uYard, uGrass, uCountry; uniform float uCell; uniform vec3 uMud[MUD_N];
  varying vec3 vGW;
  float gRough = .95;
  float gHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  float gNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
    return mix(mix(gHash(i), gHash(i + vec2(1, 0)), u.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), u.x), u.y);
  }
  vec2 cobble(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float d1 = 9., d2 = 9., id = 0.;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(x, y), c = o + .5 + (vec2(gHash(i + o), gHash(i + o + 17.)) - .5) * .7, r = c - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = gHash(i + o + 3.); } else if (d < d2) d2 = d;
    }
    return vec2(id, sqrt(d2) - sqrt(d1));
  }
  vec3 groundColour(vec3 p, out float inside) {
    vec2 w = p.xz;
    vec4 m = texture2D(uGroundMap, (w - uGroundBox.xy) * uGroundBox.zw);
    inside = m.a;
    float country = smoothstep(.9, .7, m.a), town = smoothstep(.8, .92, m.a);
    float n1 = gNoise(w * .07), n2 = gNoise(w * .45), n3 = gNoise(w * 2.3);
    float paved = smoothstep(.4, .6, m.r + (n2 - .5) * .35) * town, lot = smoothstep(.45, .55, m.g + (n3 - .5) * .15);
    float track = smoothstep(.25, .75, m.b + (n2 - .5) * .5), worn = smoothstep(.55, .9, m.b + (n2 - .5) * .3);
    vec4 k = texture2D(uKinds, (w - uGroundBox.xy) * uGroundBox.zw);
    float setts = smoothstep(.3, .7, k.r), rough = smoothstep(.3, .7, k.g) * (1. - setts);

    // Grass shows fine blades only near the camera, where they are larger than a pixel.

    float bladeFar = smoothstep(.3, 1., length(fwidth(w * 7.)));
    float blade = bladeFar < 1. ? mix(gNoise(w * 7.) * gNoise(w * 13.), .25, bladeFar) : .25;
    vec3 grass = uGrass * (.7 + .45 * n2 + .2 * n3) * (.75 + .8 * blade);
    vec3 earth = uEarth * (.8 + .3 * n1 + .15 * n3) * mix(1., 1.12, track) * mix(1., 1.1, worn);
    float wet = smoothstep(.3, .22, n1) * track;
    earth = mix(earth, uEarth * .55, wet);

    // One cobble pattern serves every street. Main streets lay large flat setts, minor streets small rough stones.
    // The cells are worked out only on paving, and only where they are larger than a pixel; elsewhere the stone
    // takes its average shade.

    float cell = uCell * mix(1., 1.4, setts) * mix(1., .8, rough);
    float sharp = 1. - smoothstep(.25, .8, length(fwidth(w / cell)));
    vec3 cob = uCobble * .82 * mix(1., .9, rough * .6) * (.9 + .2 * n1);
    if (paved > .002 && sharp > .01) {
      vec2 cb = cobble(w / cell);
      float joint = smoothstep(.03, .12, cb.y);
      vec3 stone = uCobble * (.7 + .55 * cb.x);
      stone = mix(stone, uCobble * vec3(1.14, 1.08, 1.) * (.88 + .22 * cb.x), setts * .75);
      stone = mix(stone, uCobble * (.8 + .3 * cb.x) * .9, rough * .6);
      stone = mix(stone, uCobble * (1.08 + .12 * cb.x), worn * .55);
      cob = mix(cob, stone * mix(mix(.45, .72, worn), 1., joint) * (.9 + .2 * n1), sharp);

      // Weeds grow in the joints away from the trodden middle, more on the minor streets. A minor street has lost
      // stones here and there, and the earth shows through.

      float weeds = (1. - joint) * (1. - worn) * smoothstep(.5, .75, n2 * .8 + n3 * .3 + rough * .25) * sharp;
      cob = mix(cob, grass * 1.1, weeds * .85);
      float gap = rough * smoothstep(.62, .8, n1 * .6 + n3 * .45 + cb.x * .25) * (1. - worn * .6);
      cob = mix(cob, earth * .92, gap);
    }

    // Open ground is bare and trodden near the streets and patchy grass and weeds further off. Verges grow along the
    // lots, and a few tufts anywhere.

    float nearLot = textureLod(uGroundMap, (w - uGroundBox.xy) * uGroundBox.zw, 2.5).g;
    float nearStreet = textureLod(uGroundMap, (w - uGroundBox.xy) * uGroundBox.zw, 4.5).b;
    float verge = (1. - track) * smoothstep(.12, .4, nearLot) * smoothstep(.35, .65, n2 + n1 * .3)
      + (1. - track) * smoothstep(.82, .9, n3 * .6 + n1 * .5) * .6;
    float meadow = (1. - track) * smoothstep(.22, .04, nearStreet) * smoothstep(.35, .6, n1 * .7 + n2 * .4);
    vec3 lane = mix(earth, grass, clamp(verge * .85 + meadow * .65, 0., 1.));
    vec3 yard = mix(uYard * (.8 + .35 * n3 + .15 * n1), grass, smoothstep(.62, .8, n2 * .7 + n1 * .5) * .7);
    vec3 field = uCountry * (.85 + .25 * n2 + .1 * n3);
    vec3 col = mix(mix(mix(lane, field, country * (1. - track) * .9), cob, paved), yard, lot);

    // A country road keeps a strip of grass down its middle, between the wheels.

    float median = country * (1. - paved) * (1. - lot) * smoothstep(.8, .95, m.b) * smoothstep(.3, .6, n2 + n3 * .2);
    col = mix(col, grass, median * .75);

    // Polished stone in the worn middle shines a little, and standing water more.

    gRough = mix(.95, .7, paved * worn * sharp);
    gRough = mix(gRough, .25, wet * (1. - paved) * (1. - lot) * smoothstep(.27, .2, n1));

    // A gutter runs along each edge of the paving: a dark stone channel where the paved mask fades.

    float gutter = smoothstep(.22, .34, m.r) * smoothstep(.52, .4, m.r) * (1. - lot) * town;
    col = mix(col, uCobble * .45, gutter * .8 * sharp);

    // Wheel ruts: two dark grooves where the trodden track meets the rest of an earth lane.

    float rut = smoothstep(.36, .46, m.b) * smoothstep(.62, .52, m.b) * (1. - paved) * (1. - lot);
    col *= 1. - .35 * rut * (1. - smoothstep(.4, 1.2, length(fwidth(w))));

    // Mud: churned dark earth and standing puddles round the gates and wells, where carts and feet gather.

    float mud = 0.;
    for (int i = 0; i < MUD_N; i++) mud = max(mud, 1. - smoothstep(uMud[i].z * .4, uMud[i].z, distance(w, uMud[i].xy)));
    mud *= (1. - lot) * smoothstep(.3, .6, n2 + n1 * .4);
    col = mix(col, uEarth * .45, mud);
    float puddle = mud * smoothstep(.62, .7, n1 + n3 * .2);
    col = mix(col, vec3(.08, .1, .12), puddle * .8);
    gRough = mix(gRough, .2, puddle);

    // A steep street in the town is a flight of steps: a dark riser and a pale nose every 20 cm of height, where the
    // grade passes about 1 in 5 and the steps are larger than a pixel.

    vec3 wn = normalize(cross(dFdx(p), dFdy(p)));
    float grade = length(wn.xz) / max(abs(wn.y), .05), e = fract(p.y / .2);
    float street = max(paved, smoothstep(.2, .5, m.b)) * (1. - country);
    float stairs = smoothstep(.16, .24, grade) * (1. - lot) * street * (1. - smoothstep(.3, .7, fwidth(p.y / .2)));
    return col * mix(1., mix(.55, 1.15, smoothstep(0., .15, e)), stairs);
  }
`;

// On a relief the ground is a grid in 48 m tiles, laid only where a ward or a street is near, each vertex at the
// ground's height there. Lot edges fall between vertices, so the grid leans across them for a cell; the retaining
// walls stand over that lean.

const TILE = 48;
function draped() {
  const keep = new Set(), key = (i, j) => `${i},${j}`, pad = 45;
  const near = (x, z, r) => {
    for (let i = Math.floor((x - r) / TILE); i <= Math.floor((x + r) / TILE); i++)
      for (let j = Math.floor((z - r) / TILE); j <= Math.floor((z + r) / TILE); j++) keep.add(key(i, j));
  };
  for (const L of Object.values(CITY.streets).flat()) for (const [x, z] of L) near(x, z, 12);
  for (const { poly } of CITY.districts) {
    const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
    for (let i = Math.floor((Math.min(...xs) - pad) / TILE); i <= Math.floor((Math.max(...xs) + pad) / TILE); i++)
      for (let j = Math.floor((Math.min(...zs) - pad) / TILE); j <= Math.floor((Math.max(...zs) + pad) / TILE); j++) {
        const cx = (i + .5) * TILE, cz = (j + .5) * TILE;
        if (inPoly(poly, cx, cz) || poly.some(([x, z]) => Math.abs(x - cx) < TILE / 2 + pad && Math.abs(z - cz) < TILE / 2 + pad)) keep.add(key(i, j));
      }
  }
  const n = Math.round(TILE / G.mesh), tiles = [...keep].map(k => {
    const [i, j] = k.split(',').map(Number);
    return new THREE.PlaneGeometry(TILE, TILE, n, n).rotateX(-Math.PI / 2).translate((i + .5) * TILE, 0, (j + .5) * TILE);
  });
  const geo = mergeVertices(mergeGeometries(tiles.map(g => { g.deleteAttribute('uv'); return g; })), .01);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainAt(pos.getX(i), pos.getZ(i)) + .03);
  geo.computeVertexNormals();
  return geo;
}
const inPoly = (P, x, z) => {
  let a = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) a = !a;
  }
  return a;
};

export const ground = G && (() => {
  const [ox, oz] = CITY.origin, [dx, dz] = CITY.dims;
  const mat = new THREE.MeshStandardMaterial({ roughness: .95, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
  const mesh = surface(new THREE.Mesh(RELIEF ? draped() : new THREE.PlaneGeometry(dx, dz).rotateX(-Math.PI / 2).translate(ox + dx / 2, .03, oz + dz / 2), mat));
  if (RELIEF) scene.add(walls(new THREE.MeshStandardMaterial({ color: new THREE.Color(...G.wall), roughness: .9 })));
  const moat = moatWater();
  if (moat) scene.add(new THREE.Mesh(moat, WATER_MAT));
  const U = { uGroundMap: { value: plan() }, uKinds: { value: plan(G.px * 2) }, uGroundBox: { value: new THREE.Vector4(ox, oz, 1 / dx, 1 / dz) },
    uCobble: { value: new THREE.Vector3(...G.cobble) }, uEarth: { value: new THREE.Vector3(...G.earth) },
    uYard: { value: new THREE.Vector3(...G.yard) }, uGrass: { value: new THREE.Vector3(...G.grass) }, uCountry: { value: new THREE.Vector3(...G.country) },
    uMud: { value: (MUD.length ? MUD : [[1e6, 1e6, 1]]).map(v => new THREE.Vector3(...v)) }, uCell: { value: G.cell },
    uPoolMap: { value: new THREE.DataTexture(new Uint8Array(4), 1, 1) }, uPoolTint: { value: pools.material.color } };

  // The surface keeps the hooks surface() gave it (holes), then swaps its flat colour for the ground's.

  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => {
    prev.call(mat, s, r);
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\n${GROUND_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float inside;
        diffuseColor.rgb = groundColour(vGW, inside);
        if (inside < .3) discard;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += texture2D(uPoolMap, (vGW.xz - uGroundBox.xy) * uGroundBox.zw).rgb * uPoolTint;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n        roughnessFactor = gRough;');
  };
  mat.customProgramCacheKey = () => 'groundmap';
  POOL_SINK.take = src => {
    U.uPoolMap.value.dispose();
    U.uPoolMap.value = poolMap(src);
  };
  return mesh;
})();

// Lamp light pools, painted into a light map at POOL_PX metres a texel, which the ground adds to its own light. On
// the ground itself a pool follows every slope, step and terrace, where a flat disc would sink into a slope or
// float over a step. The light falls off as the pools' disc texture does, and the clock dims it through their colour.

const POOL_PX = 2;
const fall = t => t < .3 ? 1 - t / .6 : t < .65 ? .5 - (t - .3) : .15 * (1 - t) / .35;
function poolMap(src) {
  const [ox, oz] = CITY.origin, [dx, dz] = CITY.dims, W = Math.ceil(dx / POOL_PX), H = Math.ceil(dz / POOL_PX);
  const sum = new Float32Array(W * H * 3), a = src.instanceMatrix.array, rgb = src.instanceColor?.array;
  for (let i = 0; i < src.count; i++) {
    const o = i * 16, R = Math.hypot(a[o], a[o + 1], a[o + 2]) / 2 / POOL_PX;
    const cx = (a[o + 12] - ox) / POOL_PX, cz = (a[o + 14] - oz) / POOL_PX;
    for (let y = Math.max(0, Math.floor(cz - R)); y <= Math.min(H - 1, Math.ceil(cz + R)); y++)
      for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(W - 1, Math.ceil(cx + R)); x++) {
        const t = Math.hypot(x + .5 - cx, y + .5 - cz) / R;
        if (t >= 1) continue;
        const g = fall(t), k = (y * W + x) * 3;
        for (let c = 0; c < 3; c++) sum[k + c] += (rgb ? rgb[i * 3 + c] : 1) * g;
      }
  }
  const data = new Uint16Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    for (let c = 0; c < 3; c++) data[i * 4 + c] = THREE.DataUtils.toHalfFloat(sum[i * 3 + c]);
    data[i * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}
