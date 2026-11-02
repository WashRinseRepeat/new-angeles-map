// The Emberford setting pack. Emberford is a walled market town on the River Ember, lit by lanterns at night.
// gen/town.py writes its city.json from town.json. SETTINGS.md describes the fields.

// The three wards. Every lot builds (density 1), no filler grows on bare ground (noFill), and the wards take no
// block kits (blockCap 0). Narrow lots always take tier 0 (smallShare 1). w places a ward between the castle's
// stone (0) and the market's timber (1).

const WARD = { zones: [], density: 1, noFill: true, blockCap: 0, smallShare: 1, neon: 0, grime: .3, h0: 6, h1: 12, signs: [[1.4, .8, .3]],
  street: [1.2, .7, .3], tiers: [[], [], []] };
const CASTLE = { ...WARD, w: 0, lit: .22, base: [.2, .19, .17], win: [1, .68, .34] };
const MARKET = { ...WARD, w: 1, lit: .32, base: [.25, .21, .16], win: [1, .72, .4] };
const CRAFT = { ...WARD, w: .5, lit: .26, base: [.23, .19, .14], win: [1, .66, .32] };

export default {
  id: 'emberford',
  name: 'Emberford',
  storage: 'emberford',
  data: { city: 'settings/emberford/city.json', seats: 'settings/emberford/places.json', summaries: 'settings/emberford/districts.json' },
  map: { cx: 0, cy: 0, scale: 1 },

  // The centre is the market square. Its plaza keeps the square clear and glows faintly warm.

  centre: {
    district: 'market-ward', radius: 34, top: 6, pinLift: 8, glow: [.1, .05, .02], lore: 'Market Square',
    fade: { y: 6, edge: 6, half: [34, 6, 34] },
    place: { slug: 'market-square', title: 'Market Square', district: 'Market Ward', type: 'Square',
      summary: 'The heart of Emberford, where the four gate streets meet.', color: [1.8, 1.1, .5] },
  },
  // The engine's hills ring the town, and a deck of cumulus drifts over it with a faint glow from the lanterns below.

  terrain: '../../engine/hills.js',
  camera: {
    fov: 45, near: 1, far: 6000, position: [-380, 330, 470], target: [0, 0, 20],
    maxPolar: .46, minDistance: 12, maxDistance: 1400, tourDistance: 3000, groundReach: 3000,
    edit: { position: [0, 600, 1], target: [0, 0, 0] },
  },
  scale: {
    detail: { ultra: 800, high: 800, medium: 600, low: 400 }, tile: 400, layerTop: 200,
    labels: { place: 900, landmark: 900, quarter: 900, districtY: 45, quarterY: 30, landmarkY: 30, pinLift: 8 },
    fogZoom: { from: 300, near: .9, far: 1.8 },
    traffic: { ground: 600, sky: 600, highwayNear: 300 },
    city: { lampStep: { main: 20, minor: 24 }, lampOffset: { main: 3.4, minor: 2.4 }, siteMin: 30, seatReach: 120,
      landmarkReach: 150, district: { cap: 0, gap: 100, minSide: 30 } },
  },

  // Night: a dark blue sky, warm windows, lanterns on posts that waver, torches at the gates. No city clutter.

  look: {
    fog: 0x15182a, fogStart: [250, 1600], fogBase: { near: 350, far: 1600 }, mist: .25,
    hemi: [0x7080a8, 0x1c160e, 1.4], moon: [0x9aa8d8, .8, [300, 800, 200]], bloom: [.45, .35, 1.0],
    flicker: { beat: .8, on: .15, dim: .06, stutter: -1.2 }, searchlight: [1, .85, .6], cardColor: [1.8, 1.1, .5],
    ground: { outer: 0x10150c, streets: [.06, .05, .04], plaza: [.075, .065, .05], blocks: [0x1e1a14, 0x0a0806],
      parks: [0x16220f, 0x080d06], slab: 0x15120e, sea: 0x0b1008 },
    decor: { roof: false, kibble: false, neon: false, signs: false, holo: false, helipads: false, beacons: false, markings: false,
      harvesters: false, fieldExtras: false },
    lamps: { main: 3.6, minor: 3, post: [.05, .04, .03], flicker: .72 },
    land: { low: [.035, .045, .025], high: [.045, .055, .03], rock: [.07, .065, .06], tree: [.025, .05, .025] },
    clouds: [{ y0: 380, y1: 600, cell: 80, tile: 3600, cover: .72, glow: [.08, .04, .02], near: 120, reach: 5000, above: .35 }],
    tune: { exposure: 1, sky: 1.5, moon: 1.1, windows: 1.3, edges: 0, neon: 1, glows: 1.6, pools: 1, cars: .35, speed: .12,
      bloomStrength: .6, bloomThreshold: .7, bloomRadius: .25, fogNear: 350, fogFar: 1600, mist: .5, mistBase: 6 },

    // ?look=day: a clear afternoon. Windows, lanterns and bloom go dark.

    modes: {
      day: {
        fog: 0xb8c4d0, fogStart: [400, 2400], fogBase: { near: 600, far: 2400 }, mist: 0, sky: [0x9cc4f4, 0xd0dce6, 0x7a8068],
        hemi: [0xc8dcff, 0x6a5a40, 2.2], moon: [0xfff0d8, 2.2, [-500, 700, 300]], bloom: [.1, .2, 1.4],
        buildingLight: { dir: [-.5, .7, .3], colour: [4, 3.7, 3.3], base: .55, up: .2, sun: .45 },
        ground: { outer: 0x55603a, streets: [.2, .18, .14], plaza: [.24, .21, .17], blocks: [0x5a5040, 0x111111],
          parks: [0x4a6a34, 0x111a0c], slab: 0x3a3428, sea: 0x4a5a38 },
        lamps: { flicker: false },
        land: { low: [.2, .3, .12], high: [.26, .34, .14], rock: [.42, .4, .36], tree: [.1, .22, .08] }, water: [.07, .12, .15],
        tune: { sky: 2.2, moon: 2.2, windows: 0, glows: 0, pools: 0, bloomStrength: .1, bloomThreshold: 1.4, fogNear: 600,
          fogFar: 2400, mist: 0, mistBase: 0 },
      },
    },
  },
  styles: {
    axis: [CASTLE, MARKET], styles: { 'castle-ward': CASTLE, 'market-ward': MARKET, 'craft-ward': CRAFT }, quarters: {}, cores: [], blend: 40,
    wallSkins: ['stone', 'timber'], slots: { skin: { stone: [3, .5], timber: [1, 3], plaster: [1, 1.5] } },
  },
  kits: {
    families: ['town'], districts: [], finds: [], ownTiers: ['castle-ward', 'market-ward', 'craft-ward'],
    blockZones: Z => Z.districts.map(Z.districtZone),
    cityStart: { height: 1, fill: 1, lights: 1 },
    cityTune: [
      ['height', 'Building height', .4, 2, .05, 1],
      ['fill', 'Built lots', .3, 1.15, .01, 1],
      ['lights', 'Street light density', .3, 3, .05, 1],
    ],
  },

  // Carts: a wooden bed on two wheels, a horse in front and a lantern.

  transport: {
    cars: {
      parts: [[1.5, .5, 2.6, 0, .9, -.4, [.12, .08, .05]], [.25, 1.1, 1.1, -.85, .55, -.4, [.05, .04, .03]],
        [.25, 1.1, 1.1, .85, .55, -.4, [.05, .04, .03]], [.6, 1, 1.9, 0, 1.1, 1.9, [.09, .06, .04]],
        [.2, .2, .2, .7, 1.5, .9, [1.6, .9, .35]]],
    },
  },

  // A walking tour from the square past the hall and the church to the keep, the wards and the wall.

  walks: [
    {
      title: 'A Walk Round Emberford', summary: 'From the market square to the castle and the walls, in seven stops.',
      stops: [
        { slug: 'market-square', h: 'The square', text: 'Four gate streets meet here, round the well and the market cross.' },
        { slug: 'market-hall', h: 'Under the hall', text: 'Traders sell beneath the arcade, and the town council meets upstairs.' },
        { slug: 'saint-wenna-s-church', h: 'Saint Wenna\'s', text: 'The church faces east. Its spire is the first thing a traveller sees.' },
        { slug: 'market-ward', h: 'The Market Ward', text: 'Tall timber houses lean over the lanes behind the square.' },
        { slug: 'the-keep', h: 'The keep', text: 'The lord\'s keep stands in its own walls on the north side of town.' },
        { slug: 'craft-ward', h: 'The Craft Ward', text: 'Smiths and dyers work in the yards behind their houses.' },
        { slug: 'town-wall', h: 'The east gate', text: 'Torches burn at every gate until the curfew bell.' },
      ],
    },
  ],
  cards: { districts: 'content/districts.json', landmarks: 'content/landmarks.json' },
};
