// The sandbox setting pack. It is a small town on a street grid that tests the engine without New Angeles. It has
// two districts, one kit family and nothing else. It leaves out every optional section (centre, maglev, highways,
// hover traffic, terrain, audio guide, extra layers) to show the engine runs without them. make-city.py writes its
// city.json. SETTINGS.md describes the fields.

const OLD = {
  h0: 6, h1: 14, density: .9, neon: .05, lit: .25, grime: .5, w: 0, zones: [],
  base: [.16, .13, .1], win: [1, .7, .4], street: [1, .6, .3],
  signs: [[1.4, .8, .3], [1.2, .5, .2]],
  tiers: [['sb_house', 'sb_house', 'sb_yard'], ['sb_house', 'tenement'], ['tenement', 'block']],
};
const NEW = {
  h0: 10, h1: 30, density: .95, neon: .2, lit: .3, grime: .2, w: 1, zones: [],
  base: [.12, .13, .15], win: [.8, .9, 1], street: [.8, .8, 1],
  signs: [[.4, 1, 1.4], [1.2, .4, 1]],
  tiers: [['sb_house', 'block'], ['block', 'stack'], ['stack', 'tower']],
};

export default {
  id: 'sandbox',
  name: 'Sandbox',
  storage: 'sandbox',
  data: { city: 'settings/sandbox/city.json', seats: 'settings/sandbox/places.json', summaries: 'settings/sandbox/districts.json' },
  map: { cx: 0, cy: 0, scale: 1 },

  camera: {
    fov: 45, near: 1, far: 6000, position: [-420, 360, 420], target: [0, 0, 0],
    maxPolar: .46, minDistance: 15, maxDistance: 1500, tourDistance: 3000, groundReach: 3000,
    edit: { position: [0, 500, 1], target: [0, 0, 0] },
  },
  scale: {
    detail: { ultra: 700, high: 700, medium: 500, low: 350 }, tile: 400, layerTop: 200,
    labels: { place: 900, landmark: 700, quarter: 900, districtY: 50, quarterY: 30, landmarkY: 30, pinLift: 10 },
    fogZoom: { from: 300, near: .9, far: 1.8 },
    traffic: { ground: 700, sky: 700, highwayNear: 300 },

    // A small town: lanterns every 16 m on main streets and 20 m on minor ones, narrower filler on an 8 m grid, and
    // places and landmarks seated on blocks from 30 m within 120 m of their point.

    city: { lampStep: { main: 16, minor: 20 }, fillStep: 8, fill: 4, siteMin: 30, seatReach: 120, landmarkReach: 150,
      district: { cap: 8, gap: 100, minSide: 30 } },
  },
  look: {
    fog: 0x1a2030, fogStart: [200, 1400], fogBase: { near: 300, far: 1400 }, mist: .2,
    hemi: [0x8090b0, 0x201810, 1.5], moon: [0x8899cc, .7, [300, 800, 200]], bloom: [.45, .35, 1.0],
    flicker: { beat: .8, on: .15, dim: .06, stutter: -1.2 }, searchlight: [1, .92, .72], cardColor: [1.6, 1.2, .6],

    // No city clutter: no rooftop plant, facade boxes, neon, billboards, helipads, beacons or road markings.
    // Lanterns stand on dark posts at 4 m on main streets and 3.2 m on minor ones, and waver down to 75%.

    decor: { roof: false, kibble: false, neon: false, signs: false, holo: false, helipads: false, beacons: false, markings: false },
    lamps: { main: 4, minor: 3.2, post: [.05, .04, .03], flicker: .75 },

    // ?look=day lights the town by a warm afternoon sun under a blue sky. Windows, lanterns and bloom go dark.

    modes: {
      day: {
        fog: 0xb8c8d8, fogStart: [400, 2600], fogBase: { near: 600, far: 2600 }, mist: 0, sky: [0x9cc4f4, 0xd0dce6, 0x8a8f86],
        hemi: [0xc8dcff, 0x6a5a40, 2.2], moon: [0xfff0d8, 2.2, [-500, 700, 300]], bloom: [.1, .2, 1.4],
        buildingLight: { dir: [-.5, .7, .3], colour: [4.2, 3.9, 3.5], base: .55, up: .2, sun: .45 },
        ground: { outer: 0x55603a, streets: [.22, .2, .17], plaza: [.25, .23, .2], blocks: [0x6a655c, 0x111111],
          parks: [0x4a6a34, 0x111a0c], slab: 0x3a3a36, sea: 0x3a5a78 },
        lamps: { flicker: false },
        tune: { exposure: 1, sky: 2.2, moon: 2.2, windows: 0, edges: 0, neon: 0, glows: 0, pools: 0,
          bloomStrength: .1, bloomThreshold: 1.4, bloomRadius: .2, fogNear: 600, fogFar: 2600, mist: 0, mistBase: 0 },
      },
    },
    ground: { outer: 0x10140e, streets: [.05, .05, .055], plaza: [.06, .055, .05], blocks: [0x26262a, 0x121214],
      parks: [0x18261a, 0x0a140b], slab: 0x0d1118, sea: 0x06101e },
    tune: { exposure: 1, sky: 1.6, moon: 1.1, windows: 1.25, edges: .6, neon: 1.25, glows: 1.5, pools: .8,
      bloomStrength: .65, bloomThreshold: .7, bloomRadius: .2, fogNear: 300, fogFar: 1400, mist: .4, mistBase: 8 },
  },
  // Walls take plaster, timber frame or stone, and the tower grammar picks the same materials.

  styles: {
    axis: [OLD, NEW], styles: { 'old-town': OLD, 'new-town': NEW }, quarters: {}, cores: [], blend: 60,
    wallSkins: ['timber', 'plaster'], slots: { skin: { timber: [3, .5], plaster: [2, 1.5], stone: [.5, 2] } },
  },
  kits: {
    families: ['houses'], districts: [], finds: [], smallLots: { style: OLD, kits: ['sb_house'] },
    blockZones: Z => Z.districts.map(Z.districtZone),
    cityStart: { height: 1, fill: 1, lights: 1 },
    cityTune: [
      ['height', 'Building height', .4, 2, .05, 1],
      ['fill', 'Built lots', .3, 1.15, .01, 1],
      ['lights', 'Street light density', .3, 3, .05, 1],
    ],
  },

  // Street cars only. The sandbox has no maglev, highways or hover traffic.

  transport: {
    cars: {
      parts: [[1.8, .7, 4.2, 0, .55, 0, [.07, .07, .08]], [.38, .2, .08, -.6, .65, 2.12, [1.5, 1.4, 1.2]],
        [.38, .2, .08, .6, .65, 2.12, [1.5, 1.4, 1.2]], [.4, .16, .08, -.65, .7, -2.12, [1.3, .05, .03]],
        [.4, .16, .08, .65, .7, -2.12, [1.3, .05, .03]]],
    },
  },
  cards: { districts: 'content/districts.json', landmarks: 'content/landmarks.json' },
};
