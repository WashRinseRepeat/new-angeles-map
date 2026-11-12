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
//   lod [[700, 2], [1600, 4]]   on a relief, [from metres, cells merged] levels: past each distance from the camera
//                      the grid merges that many cells a side, where a tile's cell count allows it
//   lodError .5        metres a merged cell may leave the full grid; tiles that leave it further keep every cell
//   edge 0             metres over which the town's ground fades into the country, with a wandering noisy edge;
//                      0 keeps the edge sharp
//   gardens []         ids of wards whose open ground and yards grow lawn and meadow instead of bare earth, for
//                      villa quarters and villages that sit in green land
//   wall               on a relief, the retaining walls' colour as [r, g, b]

import * as THREE from 'three';
import { CENTRE, CENTRE_R, CITY } from './core.js';
import { SETTING } from './setting.js';
import { WATER_MAT, camera, scene, surface } from './render.js';
import { RELIEF, moatWater, terrainAt, walls } from './relief.js';
import { POOL_SINK, pools } from './instances.js';
import { COUNTRY, COUNTRY_GLSL, COUNTRY_U } from './country.js';

const G = SETTING.look.groundMap && {
  px: .75, paved: { main: 7, major: 5 }, pavedSites: [], track: 3.5, cell: .38, mesh: 1.25, lod: [[700, 2], [1600, 4]], lodError: .5, wall: [.3, .28, .25], edge: 0, gardens: [],
  cobble: [.24, .22, .2], earth: [.2, .16, .11], yard: [.17, .14, .1], grass: [.1, .15, .06], ...SETTING.look.groundMap,
};

// Four masks, one per channel: R paved, G lots, B the trodden track, A the town at full and the country at 0.6:
// the gate roads, the lots past the wall (suburb wards, named suburb-…, and village wards) and, on a relief with a moat, a band round
// the wall. The country is grass but for its roads. Each is drawn white on
// black in its own canvas and blurred a little, so edges blend over a texel or two.

function plan(px = G.px) {
  const [ox, oz] = CITY.origin, [dx, dz] = CITY.dims, W = Math.ceil(dx / px), H = Math.ceil(dz / px);
  const mask = (draw, blur = 1) => {
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
    o.filter = `blur(${blur}px)`;
    o.drawImage(c, 0, 0);
    return o.getImageData(0, 0, W, H).data;
  };
  const poly = (g, P) => { g.beginPath(); P.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); g.closePath(); g.fill(); };
  const line = (g, L, w) => { g.lineWidth = w; g.beginPath(); L.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); g.stroke(); };
  const streets = Object.entries(CITY.streets);

  // The kinds map, at half the plan's detail: R main streets, G minor streets, B garden wards with a soft rim.
  // Other streets are major.

  if (px !== G.px) {
    const width = kind => (G.paved[kind] ?? G.track) + 1;
    const masks = ['main', 'minor'].map(kind => mask(g => { for (const L of CITY.streets[kind] ?? []) line(g, L, width(kind)); }));
    const gardens = mask(g => { for (const d of CITY.districts) if (G.gardens.includes(d.id)) poly(g, d.poly); }, Math.max(1, G.edge / px / 3));
    const data = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) { data[i * 4] = masks[0][i * 4]; data[i * 4 + 1] = masks[1][i * 4]; data[i * 4 + 2] = gardens[i * 4]; }
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
      if (G.edge) return;
      g.fillStyle = '#999';
      for (const P of CITY.blocks) poly(g, P);
    }, Math.max(1, G.edge / px / 3)),
  ];

  // A soft edge blurs only the town's extent. The lots stay sharp and keep at least their 0.6, so the blur never
  // spreads their lower value over the open ground between them.

  if (G.edge) {
    const lots = mask(g => { g.fillStyle = '#999'; for (const P of CITY.blocks) poly(g, P); });
    for (let i = 0; i < W * H; i++) masks[3][i * 4] = Math.max(masks[3][i * 4], lots[i * 4]);
  }
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

const GROUND_GLSL = `${COUNTRY ? COUNTRY_GLSL : ''}
  #define MUD_N ${MUD_N}
  uniform sampler2D uGroundMap, uKinds, uPoolMap; uniform vec4 uGroundBox; uniform vec3 uPoolTint; uniform vec3 uCobble, uEarth, uYard, uGrass, uCountry; uniform float uCell, uEdge; uniform vec3 uMud[MUD_N];
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
    float n1 = gNoise(w * .07), n2 = gNoise(w * .45), n3 = gNoise(w * 2.3);

    // A soft edge wanders: slow noise shifts where the town gives way to the country.

    float a = m.a + uEdge * ((gNoise(w * .025) - .5) * .5 + (n1 - .5) * .25) * smoothstep(.15, .45, m.a) * smoothstep(1., .85, m.a);
    inside = m.a;
    float country = smoothstep(.9, .7, a), town = smoothstep(.8, .92, a);
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

    // A garden ward grows lawn and meadow on its open ground and in its yards, trodden only along the tracks.

    float garden = k.b * smoothstep(.15, .5, k.b + (n1 - .5) * .4);
    vec3 lawn = mix(grass * 1.1, uCountry * (.85 + .25 * n2), .35 + .3 * n1);
    lane = mix(lane, lawn, garden * (1. - track * .75) * .9);
    yard = mix(yard, lawn * (.92 + .16 * n3), garden * .8);
    vec3 field = uCountry * (.85 + .25 * n2 + .1 * n3);${COUNTRY ? `
    field = countryColour(w, field);` : ''}
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
//
// Far from the camera the grid gets coarser. Tiles group into chunks of 8 by 8, and the index buffer holds each
// chunk once per level of detail. A level merges cells by a stride that divides a tile's cells. A tile takes the
// coarser cells only where they stay within lodError of the full grid, so lot platforms, walls and moat banks keep
// every cell. A skirt hangs under each tile edge whose two sides can differ, so no crack opens between levels.
// Coarse cells keep the full grid's normals, so the light does not jump when a chunk changes level.

const TILE = 48, CHUNK = 8;
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
  const n = Math.round(TILE / G.mesh), step = TILE / n;
  const levels = [{ from: 0, s: 1 }];
  for (const [from, k] of G.lod) {
    let s = Math.min(n, Math.max(1, Math.round(k)));
    while (n % s) s--;
    if (s > levels.at(-1).s) levels.push({ from, s });
  }

  // Lattice vertices, shared across tiles. Cells split along the same diagonal as a PlaneGeometry.

  const ids = new Map(), xyz = [];
  const vid = (I, J) => {
    const k = I * 65536 + J;
    let v = ids.get(k);
    if (v === undefined) {
      ids.set(k, v = xyz.length / 3);
      xyz.push(I * step, terrainAt(I * step, J * step) + .03, J * step);
    }
    return v;
  };
  const H = (I, J) => xyz[vid(I, J) * 3 + 1];
  const cells = (out, i, j, s) => {
    for (let u = 0; u < n; u += s) for (let v = 0; v < n; v += s) {
      const I = i * n + u, J = j * n + v, a = vid(I, J), b = vid(I, J + s), c = vid(I + s, J + s), d = vid(I + s, J);
      out.push(a, b, d, b, c, d);
    }
  };
  const tiles = [...keep].map(k => { const [i, j] = k.split(',').map(Number); return { i, j }; });
  const fine = [];
  for (const t of tiles) cells(fine, t.i, t.j, 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(xyz, 3));
  geo.setIndex(fine);
  geo.computeVertexNormals();
  const nrm = [...geo.attributes.normal.array];

  // A tile's error at a stride is the furthest any full-grid vertex lies from the coarse cells' surface.

  const err = (i, j, s) => {
    let e = 0;
    for (let cu = 0; cu < n; cu += s) for (let cv = 0; cv < n; cv += s) {
      const I = i * n + cu, J = j * n + cv, ha = H(I, J), hb = H(I, J + s), hc = H(I + s, J + s), hd = H(I + s, J);
      for (let u = 0; u <= s; u++) for (let v = 0; v <= s; v++) {
        const fu = u / s, fv = v / s;
        const flat = fu + fv <= 1 ? ha + (hd - ha) * fu + (hb - ha) * fv : hc + (hb - hc) * (1 - fu) + (hd - hc) * (1 - fv);
        e = Math.max(e, Math.abs(H(I + u, J + v) - flat));
      }
    }
    return e;
  };
  const byKey = new Map(), chunks = new Map();
  for (const t of tiles) {
    t.s = [1];
    for (let l = 1; l < levels.length; l++) t.s[l] = err(t.i, t.j, levels[l].s) <= G.lodError ? levels[l].s : t.s[l - 1];
    const ck = key(Math.floor(t.i / CHUNK), Math.floor(t.j / CHUNK));
    t.chunk = ck;
    byKey.set(key(t.i, t.j), t);
    if (!chunks.has(ck)) chunks.set(ck, { tiles: [], box: new THREE.Box3(), range: [] });
    chunks.get(ck).tiles.push(t);
  }

  // Two sides of an edge differ by at most twice lodError, so a skirt that deep closes any gap. It faces out of its
  // tile and takes its top's normal.

  const D = 2 * G.lodError + .1, lows = new Map();
  const low = v => {
    let w = lows.get(v);
    if (w === undefined) {
      lows.set(v, w = xyz.length / 3);
      xyz.push(xyz[v * 3], xyz[v * 3 + 1] - D, xyz[v * 3 + 2]);
      nrm.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]);
    }
    return w;
  };
  const EDGES = [[-1, 0, 0, 0, 0, 1], [1, 0, 1, 0, 0, 1], [0, -1, 0, 0, 1, 0], [0, 1, 0, 1, 1, 0]];
  const skirts = (out, t, l) => {
    const s = t.s[l];
    for (const [ox, oz, eu, ev, du, dv] of EDGES) {
      const u = byKey.get(key(t.i + ox, t.j + oz));
      if (!u || (u.chunk === t.chunk && u.s[l] === s)) continue;
      const I0 = t.i * n + eu * n, J0 = t.j * n + ev * n, flip = -dv * ox + du * oz < 0;
      for (let k = 0; k < n; k += s) {
        let a = vid(I0 + du * k, J0 + dv * k), b = vid(I0 + du * (k + s), J0 + dv * (k + s));
        if (flip) [a, b] = [b, a];
        out.push(a, low(a), b, b, low(a), low(b));
      }
    }
  };
  const index = [], list = [...chunks.values()].sort((a, b) => a.tiles[0].j - b.tiles[0].j || a.tiles[0].i - b.tiles[0].i);
  for (let l = 0; l < levels.length; l++) for (const c of list) {
    const start = index.length;
    for (const t of c.tiles) { cells(index, t.i, t.j, t.s[l]); skirts(index, t, l); }
    c.range[l] = [start, index.length - start];
  }
  for (const c of list) {
    for (const t of c.tiles) c.box.union(new THREE.Box3().set({ x: t.i * TILE, y: Infinity, z: t.j * TILE }, { x: (t.i + 1) * TILE, y: -Infinity, z: (t.j + 1) * TILE }));
    for (let k = c.range[0][0]; k < c.range[0][0] + c.range[0][1]; k++) { const y = xyz[index[k] * 3 + 1]; c.box.min.y = Math.min(c.box.min.y, y); c.box.max.y = Math.max(c.box.max.y, y); }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(xyz, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return { geo, chunks: list, levels };
}
const inPoly = (P, x, z) => {
  let a = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) a = !a;
  }
  return a;
};

// Before each render through the main camera, every chunk in view picks its level by its distance from the camera,
// and the mesh draws one group per run of chunks. A material list makes three draw the groups. A list also keeps
// the ground out of the shadow casters and the card's thinning.

function lod(mesh, { geo, chunks, levels }) {
  mesh.material = [mesh.material];
  const frustum = new THREE.Frustum(), m = new THREE.Matrix4(), prev = scene.onBeforeRender;
  scene.onBeforeRender = (...a) => {
    prev.apply(scene, a);
    const cam = a[2];
    if (cam !== camera) return;
    frustum.setFromProjectionMatrix(m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const groups = [];
    for (const c of chunks) {
      if (!frustum.intersectsBox(c.box)) continue;
      const d = c.box.distanceToPoint(cam.position);
      let l = levels.length - 1;
      while (l && d < levels[l].from) l--;
      const [start, count] = c.range[l], last = groups.at(-1);
      if (last && last.start + last.count === start) last.count += count;
      else groups.push({ start, count, materialIndex: 0 });
    }
    geo.groups = groups;
  };
}

export const ground = G && (() => {
  const [ox, oz] = CITY.origin, [dx, dz] = CITY.dims;
  const mat = new THREE.MeshStandardMaterial({ roughness: .95, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
  const grid = RELIEF && draped();
  const mesh = surface(new THREE.Mesh(grid ? grid.geo : new THREE.PlaneGeometry(dx, dz).rotateX(-Math.PI / 2).translate(ox + dx / 2, .03, oz + dz / 2), mat));
  if (grid) lod(mesh, grid);
  if (RELIEF) scene.add(walls(new THREE.MeshStandardMaterial({ color: new THREE.Color(...G.wall), roughness: .9 })));
  const moat = moatWater();
  if (moat) scene.add(new THREE.Mesh(moat, WATER_MAT));
  const U = { uGroundMap: { value: plan() }, uKinds: { value: plan(G.px * 2) }, uGroundBox: { value: new THREE.Vector4(ox, oz, 1 / dx, 1 / dz) },
    uCobble: { value: new THREE.Vector3(...G.cobble) }, uEarth: { value: new THREE.Vector3(...G.earth) },
    uYard: { value: new THREE.Vector3(...G.yard) }, uGrass: { value: new THREE.Vector3(...G.grass) }, uCountry: { value: new THREE.Vector3(...G.country) },
    uMud: { value: (MUD.length ? MUD : [[1e6, 1e6, 1]]).map(v => new THREE.Vector3(...v)) }, uCell: { value: G.cell }, uEdge: { value: G.edge ? 1 : 0 },
    uPoolMap: { value: new THREE.DataTexture(new Uint8Array(4), 1, 1) }, uPoolTint: { value: pools.material.color }, ...COUNTRY ? COUNTRY_U : {} };

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
