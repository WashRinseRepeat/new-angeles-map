// The ground map, for a pack whose look.groundMap is set. The town plan is painted into a texture: paved streets
// and the square, the lots, the trodden middle of every street, and the town's extent. One lit surface reads it and
// draws each kind with procedural detail: cobbles with dark joints and a gutter along each edge on paving, wheel
// ruts on earth lanes, mud and puddles round the gates and the well, packed earth with a worn track and
// puddles on lanes, grassy verges along the lot edges and a few tufts, and yards of bare earth with patches of
// grass. It takes the
// sun, sky light and shadows like any lit surface. Outside the town it draws nothing, so the land beneath shows.
//
// look.groundMap keys, with their defaults:
//   px .75             metres per texel of the plan
//   paved { main: 7, major: 5 }   street kinds that are paved, and their width in metres; the square is paved too
//   track 3.5          width of the trodden middle of every street, in metres
//   cobble, earth, yard, grass   their colours as [r, g, b]; country (default grass) for the grass outside the town
//   mud []             extra mud spots as [x, z, radius]; the gates and the centre have mud already
//   cell .38           size of a cobble in metres
//   mesh 1.25          on a relief, the ground's grid in metres, over the town's wards
//   wall               on a relief, the retaining walls' colour as [r, g, b]

import * as THREE from 'three';
import { CENTRE, CENTRE_R, CITY } from './core.js';
import { SETTING } from './setting.js';
import { WATER_MAT, scene, surface } from './render.js';
import { RELIEF, moatWater, terrainAt, walls } from './relief.js';

const G = SETTING.look.groundMap && {
  px: .75, paved: { main: 7, major: 5 }, track: 3.5, cell: .38, mesh: 1.25, wall: [.3, .28, .25],
  cobble: [.24, .22, .2], earth: [.2, .16, .11], yard: [.17, .14, .1], grass: [.1, .15, .06], ...SETTING.look.groundMap,
};

// Four masks, one per channel: R paved, G lots, B the trodden track, A the town at full and the country at 0.6:
// the gate roads, the lots past the wall (suburb wards, named suburb-…) and, on a relief with a moat, a band round
// the wall. The country is grass but for its roads. Each is drawn white on
// black in its own canvas and blurred a little, so edges blend over a texel or two.

function plan() {
  const [ox, oz] = CITY.origin, [dx, dz] = CITY.dims, W = Math.ceil(dx / G.px), H = Math.ceil(dz / G.px);
  const mask = draw => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.setTransform(1 / G.px, 0, 0, 1 / G.px, -ox / G.px, -oz / G.px);
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
  const masks = [
    mask(g => {
      for (const [kind, lines] of streets) if (G.paved[kind]) for (const L of lines) line(g, L, G.paved[kind]);
      if (CENTRE_R) { g.beginPath(); g.arc(CENTRE.x, CENTRE.y, CENTRE_R, 0, Math.PI * 2); g.fill(); }
    }),
    mask(g => { for (const P of CITY.blocks) poly(g, P); }),
    mask(g => { for (const [, lines] of streets) for (const L of lines) line(g, L, G.track); }),
    mask(g => {
      g.strokeStyle = '#999';
      if (CITY.relief?.moat && CITY.wall?.length) { const m = CITY.relief.moat; line(g, [...CITY.wall, CITY.wall[0]], 2 * ((m.offset ?? 9) + (m.width ?? 12) / 2 + 20)); }
      for (const [kind, lines] of streets) for (const L of lines) line(g, L, (G.paved[kind] ?? G.track) + 2);
      g.fillStyle = '#fff';
      for (const d of CITY.districts) if (!d.id.startsWith('suburb-')) poly(g, d.poly);
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
  uniform sampler2D uGroundMap; uniform vec4 uGroundBox; uniform vec3 uCobble, uEarth, uYard, uGrass, uCountry; uniform float uCell; uniform vec3 uMud[MUD_N];
  varying vec3 vGW;
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
    float country = smoothstep(.9, .7, m.a);
    float n1 = gNoise(w * .07), n2 = gNoise(w * .45), n3 = gNoise(w * 2.3);
    float paved = smoothstep(.4, .6, m.r + (n2 - .5) * .35), lot = smoothstep(.45, .55, m.g + (n3 - .5) * .15);
    float track = smoothstep(.25, .75, m.b + (n2 - .5) * .5);
    vec2 cb = cobble(w / uCell);
    float sharp = 1. - smoothstep(.25, .8, length(fwidth(w / uCell)));
    vec3 cob = mix(uCobble * .82, uCobble * (.7 + .55 * cb.x) * mix(.45, 1., smoothstep(.03, .12, cb.y)), sharp);
    cob *= .9 + .2 * n1;
    vec3 earth = uEarth * (.8 + .3 * n1 + .15 * n3) * mix(1., 1.12, track);
    earth = mix(earth, uEarth * .55, smoothstep(.3, .22, n1) * track);
    float nearLot = textureLod(uGroundMap, (w - uGroundBox.xy) * uGroundBox.zw, 2.5).g;
    float verge = (1. - track) * smoothstep(.12, .4, nearLot) * smoothstep(.35, .65, n2 + n1 * .3)
      + (1. - track) * smoothstep(.82, .9, n3 * .6 + n1 * .5) * .6;
    vec3 grass = uGrass * (.7 + .45 * n2 + .2 * n3);
    vec3 lane = mix(earth, grass, verge * .85);
    vec3 yard = mix(uYard * (.8 + .35 * n3 + .15 * n1), grass, smoothstep(.62, .8, n2 * .7 + n1 * .5) * .7);
    vec3 field = uCountry * (.85 + .25 * n2 + .1 * n3);
    vec3 col = mix(mix(mix(lane, field, country * (1. - track) * .9), cob, paved), yard, lot);

    // A gutter runs along each edge of the paving: a dark stone channel where the paved mask fades.

    float gutter = smoothstep(.22, .34, m.r) * smoothstep(.52, .4, m.r) * (1. - lot);
    col = mix(col, uCobble * .45, gutter * .8 * sharp);

    // Wheel ruts: two dark grooves where the trodden track meets the rest of an earth lane.

    float rut = smoothstep(.36, .46, m.b) * smoothstep(.62, .52, m.b) * (1. - paved) * (1. - lot);
    col *= 1. - .35 * rut * (1. - smoothstep(.4, 1.2, length(fwidth(w))));

    // Mud: churned dark earth and standing puddles round the gates and wells, where carts and feet gather.

    float mud = 0.;
    for (int i = 0; i < MUD_N; i++) mud = max(mud, 1. - smoothstep(uMud[i].z * .4, uMud[i].z, distance(w, uMud[i].xy)));
    mud *= (1. - lot) * smoothstep(.3, .6, n2 + n1 * .4);
    col = mix(col, uEarth * .45, mud);
    col = mix(col, vec3(.08, .1, .12), mud * smoothstep(.62, .7, n1 + n3 * .2) * .8);

    // A steep street in the town is a flight of steps: a dark riser and a pale nose every 20 cm of height, where the
    // grade passes about 1 in 5 and the steps are larger than a pixel.

    vec3 wn = normalize(cross(dFdx(p), dFdy(p)));
    float grade = length(wn.xz) / max(abs(wn.y), .05), e = fract(p.y / .2);
    float street = max(paved, smoothstep(.2, .5, m.b)) * (1. - country);
    float stairs = smoothstep(.16, .24, grade) * (1. - lot) * street * (1. - smoothstep(.3, .7, fwidth(p.y / .2)));
    return col * mix(1., mix(.55, 1.15, smoothstep(0., .15, e)), stairs);
  }
`;

// On a relief the ground is a grid over the bounds of the wards and the streets, each vertex at the ground's height there. Lot edges fall
// between vertices, so the grid leans across them for a cell; the retaining walls stand over that lean.

function draped() {
  const ps = [...CITY.districts.flatMap(d => d.poly), ...Object.values(CITY.streets).flat(2)], pad = 45;
  const x0 = Math.min(...ps.map(p => p[0])) - pad, x1 = Math.max(...ps.map(p => p[0])) + pad;
  const z0 = Math.min(...ps.map(p => p[1])) - pad, z1 = Math.max(...ps.map(p => p[1])) + pad;
  const nx = Math.ceil((x1 - x0) / G.mesh), nz = Math.ceil((z1 - z0) / G.mesh);
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainAt(pos.getX(i), pos.getZ(i)) + .03);
  geo.computeVertexNormals();
  return geo;
}

export const ground = G && (() => {
  const [ox, oz] = CITY.origin, [dx, dz] = CITY.dims;
  const mat = new THREE.MeshStandardMaterial({ roughness: .95, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
  const mesh = surface(new THREE.Mesh(RELIEF ? draped() : new THREE.PlaneGeometry(dx, dz).rotateX(-Math.PI / 2).translate(ox + dx / 2, .03, oz + dz / 2), mat));
  if (RELIEF) scene.add(walls(new THREE.MeshStandardMaterial({ color: new THREE.Color(...G.wall), roughness: .9 })));
  const moat = moatWater();
  if (moat) scene.add(new THREE.Mesh(moat, WATER_MAT));
  const U = { uGroundMap: { value: plan() }, uGroundBox: { value: new THREE.Vector4(ox, oz, 1 / dx, 1 / dz) },
    uCobble: { value: new THREE.Vector3(...G.cobble) }, uEarth: { value: new THREE.Vector3(...G.earth) },
    uYard: { value: new THREE.Vector3(...G.yard) }, uGrass: { value: new THREE.Vector3(...G.grass) }, uCountry: { value: new THREE.Vector3(...G.country) },
    uMud: { value: (MUD.length ? MUD : [[1e6, 1e6, 1]]).map(v => new THREE.Vector3(...v)) }, uCell: { value: G.cell } };

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
        if (inside < .3) discard;`);
  };
  mat.customProgramCacheKey = () => 'groundmap';
  return mesh;
})();
