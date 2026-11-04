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

// The suburbs along the gate roads past the moat: one-storey cottages, workshops and gardens, lit dimly. gen/town.py
// names a suburb's ward suburb-<gate bearing>, so the ids follow town.json's gates.

const SUBURB = { ...WARD, w: .7, lit: .18, base: [.24, .2, .14], win: [1, .66, .32], h0: 4, h1: 8 };
const SUBURBS = ['suburb-15', 'suburb-100', 'suburb-190', 'suburb-340'];

// The clock's night: a dark blue sky, a faint moon, warm windows and lanterns. The ground keeps its daylight colours,
// so the night light is low.

const NIGHT = { sky: [0x05070e, 0x15182a, 0x0b0d14], fog: 0x15182a, hemi: [0x7080a8, 0x1c160e, .22], light: [0x9aa8d8, .3],
  building: { colour: [1, 1, 1], base: .45, up: .25, sun: .4 }, ground: .3, water: [.004, .009, .016], shade: .5,
  tune: { windows: 1.3, glows: 1.6, pools: 1, bloomStrength: .6, bloomThreshold: .7, fogNear: 350, fogFar: 1600, mist: .5 } };

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

  // The look holds the daylight colours of the ground and the land. The clock below lights them by the hour: a dark
  // blue night with warm windows and lanterns on posts that waver, a warm dawn, a clear day with sun shadows, a
  // golden evening and a blue dusk. ?look=day and ?look=night fix the light instead. No city clutter.

  look: {
    fog: 0xb8c4d0, fogStart: [400, 2400], fogBase: { near: 600, far: 2400 }, mist: 0, sky: [0x9cc4f4, 0xd0dce6, 0x7a8068],
    hemi: [0xc8dcff, 0x6a5a40, 2.2], moon: [0xfff0d8, 2.2, [-500, 700, 300]], bloom: [.1, .25, 1.4],
    buildingLight: { dir: [-.5, .7, .3], colour: [4, 3.7, 3.3], base: .35, up: .2, sun: .8 },
    shadows: { size: 2048, reach: 700, strength: .55, live: true, soft: .06, blur: 4 }, ao: { radius: 4, strength: .75, reach: 500 },
    flicker: { beat: .8, on: .15, dim: .06, stutter: -1.2 }, searchlight: [1, .85, .6], cardColor: [1.8, 1.1, .5],
    ground: { outer: 0x55603a, streets: [.2, .18, .14], plaza: [.24, .21, .17], blocks: [0x857a62, 0x111111],
      parks: [0x4a6a34, 0x111a0c], slab: 0x3a3428, sea: 0x4a5a38 },
    decor: { roof: false, kibble: false, neon: false, signs: false, holo: false, helipads: false, beacons: false, markings: false,
      harvesters: false, fieldExtras: false },
    lamps: { main: 3.6, minor: 3, post: [.05, .04, .03], flicker: .72 },
    land: { low: [.2, .3, .12], high: [.26, .34, .14], rock: [.42, .4, .36], tree: [.1, .22, .08] }, water: [.07, .12, .15],

    // The ground map: cobbled gate streets and square, earth lanes with a worn track and grassy verges, earth yards.

    groundMap: { paved: { main: 7 }, track: 3.2, cobble: [.27, .25, .22], earth: [.21, .17, .12], yard: [.23, .19, .13],
      grass: [.11, .16, .07], country: [.2, .3, .12] },
    clouds: [{ y0: 380, y1: 600, cell: 80, tile: 3600, cover: .72, glow: [.08, .04, .02], near: 120, reach: 5000, above: .35 }],
    tune: { exposure: 1, sky: 2.2, moon: 2.2, windows: 0, edges: 0, neon: 1, glows: 0, pools: 0, cars: .35, speed: .12,
      bloomStrength: .1, bloomThreshold: 1.4, bloomRadius: .25, fogNear: 600, fogFar: 2400, mist: 0, mistBase: 6 },

    // The day opens at 17:00 and stands still; ?time= and ?cycle= or the Time tab move it. Night holds from 21:30 to
    // 4:30. A keyframe leaves out what it shares with the look above.

    clock: {
      start: 17, cycle: 0, sun: { rise: 6, set: 20.5, peak: 58, moon: 35 },
      keys: [
        { at: 4.5, ...NIGHT },
        { at: 6.3, sky: [0x5a6a9a, 0xf0a070, 0x6a5a50], fog: 0x9a8a90, hemi: [0xa0a8d0, 0x4a3a30, 1], light: [0xffa060, 1.4],
          building: { colour: [3, 2.2, 1.5], base: .3, up: .2, sun: .8 }, ground: .65, water: [.05, .06, .08], shade: .8,
          tune: { windows: .4, glows: .5, pools: .3, bloomStrength: .3, bloomThreshold: 1, fogNear: 400, fogFar: 2000, mist: .4 } },
        { at: 8.5 },
        { at: 16.5 },
        { at: 19, sky: [0x6a88c0, 0xf5b070, 0x7a6a50], fog: 0xd8a888, hemi: [0xb0b8e0, 0x6a4a30, 1.6], light: [0xffb070, 2],
          building: { colour: [4.2, 3, 2], base: .32, up: .2, sun: .85 }, ground: .9, water: [.08, .09, .1],
          tune: { windows: .2, glows: .2, pools: .1, bloomStrength: .2, bloomThreshold: 1.2, fogNear: 500, fogFar: 2200, mist: .1 } },
        { at: 20.3, sky: [0x1a2448, 0x8a5a6a, 0x2a2430], fog: 0x3a3448, hemi: [0x6070a0, 0x2a2018, .5], light: [0xff8050, .3],
          building: { colour: [1.6, 1.3, 1.2], base: .4, up: .25, sun: .4 }, ground: .5, water: [.02, .03, .045], shade: .6,
          tune: { windows: 1.1, glows: 1.3, pools: .8, bloomStrength: .5, bloomThreshold: .8, fogNear: 380, fogFar: 1800, mist: .4 } },
        { at: 21.5, ...NIGHT },
      ],
    },

    // ?look=day holds a clear afternoon. ?look=night holds the lantern-lit night with its own dark ground colours.

    modes: {
      day: { lamps: { flicker: false } },
      night: {
        fog: 0x15182a, fogStart: [250, 1600], fogBase: { near: 350, far: 1600 }, mist: .25, sky: null,
        hemi: [0x7080a8, 0x1c160e, 1.4], moon: [0x9aa8d8, .8, [300, 800, 200]], bloom: [.45, .35, 1.0], buildingLight: null,
        shadows: null, ao: null,
        ground: { outer: 0x10150c, streets: [.06, .05, .04], plaza: [.075, .065, .05], blocks: [0x1e1a14, 0x0a0806],
          parks: [0x16220f, 0x080d06], slab: 0x15120e, sea: 0x0b1008 },
        land: { low: [.035, .045, .025], high: [.045, .055, .03], rock: [.07, .065, .06], tree: [.025, .05, .025] }, water: null,
        groundMap: { cobble: [.07, .065, .055], earth: [.055, .045, .03], yard: [.05, .042, .03], grass: [.025, .035, .016],
          country: [.035, .045, .025] },
        tune: { sky: 1.5, moon: 1.1, windows: 1.3, glows: 1.6, pools: 1, bloomStrength: .6, bloomThreshold: .7, fogNear: 350,
          fogFar: 1600, mist: .5 },
      },
    },
  },
  styles: {
    axis: [CASTLE, MARKET], styles: { 'castle-ward': CASTLE, 'market-ward': MARKET, 'craft-ward': CRAFT, ...Object.fromEntries(SUBURBS.map(id => [id, SUBURB])) }, quarters: {}, cores: [], blend: 40,
    wallSkins: ['stone', 'timber'], slots: { skin: { stone: [3, .5], timber: [1, 3], plaster: [1, 1.5] } },
  },
  kits: {
    families: ['town'], districts: [], finds: [], ownTiers: ['castle-ward', 'market-ward', 'craft-ward', ...SUBURBS],
    blockZones: Z => Z.districts.map(Z.districtZone),
    cityTune: [
      ['height', 'Building height', .4, 2, .05, 1, 'Scales every building height. It lifts the whole city evenly and adds no contrast.', 'Skyline'],
      ['fill', 'Built lots', .3, 1.15, .01, 1, 'Share of lots that get a building. The rest become yards.'],
      ['lights', 'Street light density', .3, 3, .05, 1, 'How close the street lamps stand. Higher puts them closer together.'],
    ],
  },

  // Carts: a wooden bed on two wheels, a horse in front and a lantern. They take the sun and shadows, and the
  // lantern glows while the windows are lit.

  transport: {
    cars: {
      lit: true,
      parts: [[1.5, .5, 2.6, 0, .9, -.4, [.12, .08, .05]], [.25, 1.1, 1.1, -.85, .55, -.4, [.05, .04, .03]],
        [.25, 1.1, 1.1, .85, .55, -.4, [.05, .04, .03]], [.6, 1, 1.9, 0, 1.1, 1.9, [.09, .06, .04]],
        [.2, .2, .2, .7, 1.5, .9, [1.6, .9, .35]]],
    },
  },

  // Townsfolk walk the streets, shop round the stalls on the square and mill at its middle. Most go home at night.
  // Guards walk the wall walk day and night. Barges sail the river.

  boats: { n: 4 },
  people: { walk: 8, crowds: [{ at: [0, 0], ring: 21, n: 45 }, { at: [0, 0], r: 15, n: 25 }] },

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
