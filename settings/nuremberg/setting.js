// The Nuremberg setting pack: the free imperial city around 1500, inside its double wall, at true scale. gen/town.py
// writes its city.json from town.json, which traces the real wall, the Pegnitz, the main streets and the landmarks;
// the generator fills the blocks with lanes and plots. It shares Emberford's light and clock. SETTINGS.md describes
// the fields.

import EMBER from '../emberford/setting.js';

// The wards. Every lot builds, no filler grows on bare ground, and the wards take no block kits. w picks the yards:
// stone-walled under the castle (0), plank-fenced round the markets (1), wattle in the craft quarters (.5).

const WARD = { zones: [], density: 1, noFill: true, blockCap: 0, smallShare: 1, neon: 0, grime: .3, h0: 8, h1: 16,
  signs: [[1.4, .8, .3]], street: [1.2, .7, .3], tiers: [[], [], []] };
const BURG = { ...WARD, w: 0, lit: .22, base: [.3, .22, .17], win: [1, .68, .34] };
const SEBALD = { ...WARD, w: 1, lit: .32, base: [.32, .23, .17], win: [1, .72, .4] };
const LORENZ = { ...WARD, w: .9, lit: .3, base: [.33, .24, .17], win: [1, .7, .38] };
const OST = { ...WARD, w: .5, lit: .26, base: [.3, .22, .15], win: [1, .66, .32] };
const SUBURB = { ...WARD, w: .5, lit: .18, base: [.28, .21, .14], win: [1, .66, .32], h0: 4, h1: 8 };

// gen/town.py names a suburb's ward suburb-<gate bearing>, so the ids follow town.json's gates.

export const SUBURBS = ['suburb-44', 'suburb-63', 'suburb-72', 'suburb-135', 'suburb-186', 'suburb-215', 'suburb-235', 'suburb-346'];

export default {
  id: 'nuremberg',
  name: 'Nuremberg',
  storage: 'nuremberg',
  data: { city: 'settings/nuremberg/city.json', seats: 'settings/nuremberg/places.json', summaries: 'settings/nuremberg/districts.json' },
  map: { cx: 0, cy: 0, scale: 1 },

  // The centre is the Hauptmarkt, with the Schöner Brunnen at its north-west corner and the Frauenkirche on its east side.

  centre: {
    district: 'sebald', radius: 44, top: 6, pinLift: 8, glow: [.1, .05, .02], lore: 'Hauptmarkt',
    fade: { y: 6, edge: 6, half: [44, 6, 44] },
    place: { slug: 'hauptmarkt', title: 'Hauptmarkt', district: 'Sebalder Altstadt', type: 'Square',
      summary: 'The main market, where the Sebald side meets the bridges to Lorenz.', color: [1.8, 1.1, .5] },
  },
  terrain: '../../engine/hills.js',
  camera: {
    fov: 45, near: 1, far: 9000, position: [-700, 620, 900], target: [0, 0, 80],
    maxPolar: .46, minDistance: 12, maxDistance: 2600, tourDistance: 3000, groundReach: 4000,
    edit: { position: [0, 1400, 1], target: [0, 0, 0] },
  },
  scale: {
    detail: { ultra: 800, high: 800, medium: 600, low: 400 }, tile: 400, layerTop: 200,
    labels: { place: 1600, landmark: 1600, quarter: 1600, districtY: 60, quarterY: 30, landmarkY: 30, pinLift: 8 },
    fogZoom: { from: 300, near: .9, far: 1.8 },
    traffic: { ground: 700, sky: 600, highwayNear: 300 },
    city: { lampStep: { main: 22, minor: 28 }, lampOffset: { main: 3.8, minor: 2.6 }, siteMin: 30, seatReach: 120,
      landmarkReach: 150, district: { cap: 0, gap: 100, minSide: 30 } },
  },

  // Emberford's light, clock and night. Every street and square is cobbled in a warm sandstone grey.

  look: {
    ...EMBER.look,
    fogStart: [600, 3200], fogBase: { near: 800, far: 3200 },
    groundMap: { ...EMBER.look.groundMap, paved: { main: 8, major: 6, minor: 4 }, cobble: [.29, .25, .21],
      pavedSites: ['square', 'fountain', 'frauenkirche', 'rathaus', 'sebald', 'lorenz', 'church', 'durer', 'towerhouse', 'gatetower', 'inn', 'mauthalle', 'fantasy'] },
    clouds: [{ ...EMBER.look.clouds[0], y0: 700, y1: 950, tile: 4400 }],
  },
  styles: {
    axis: [BURG, SEBALD],
    styles: { burg: BURG, sebald: SEBALD, lorenz: LORENZ, 'lorenz-ost': OST, ...Object.fromEntries(SUBURBS.map(id => [id, SUBURB])) },
    quarters: {}, cores: [], blend: 40,
    wallSkins: ['stone', 'timber'], slots: { skin: { stone: [3, .5], timber: [1, 3], plaster: [1, 1.5] } },
  },
  kits: {
    families: ['town', 'civic', 'churches', 'fortress', 'fantasy'], districts: [], finds: [], ownTiers: ['burg', 'sebald', 'lorenz', 'lorenz-ost', ...SUBURBS],
    blockZones: Z => Z.districts.map(Z.districtZone),
    cityTune: EMBER.kits.cityTune,
  },
  transport: EMBER.transport,

  // Townsfolk walk the streets and crowd the Hauptmarkt's stalls. Guards walk the wall. Boats work the Pegnitz.

  boats: { n: 3 },
  people: { walk: 7, crowds: [{ at: [-5, 0], ring: 30, n: 60 }, { at: [-5, 0], r: 22, n: 40 }, { at: [20, 300], r: 18, n: 20 }] },

  walks: [
    {
      title: 'A Walk Through Nuremberg', summary: 'From the Hauptmarkt up to the castle, down to the river and over to St. Lorenz, in ten stops.',
      stops: [
        { slug: 'hauptmarkt', h: 'The Hauptmarkt', text: 'The main market fills the ground where the Jewish quarter stood until 1349.' },
        { slug: 'schoner-brunnen', h: 'The Schöner Brunnen', text: 'A gilded Gothic spire nineteen metres high, with forty figures round its tiers.' },
        { slug: 'frauenkirche', h: 'The Frauenkirche', text: 'The emperor\'s church on the market. At noon the little electors file past Charles IV.' },
        { slug: 'altes-rathaus', h: 'The town hall', text: 'The council of patrician families rules the city from here.' },
        { slug: 'st-sebald', h: 'St. Sebald', text: 'The old parish church of the north side, where the city\'s saint lies in his bronze shrine.' },
        { slug: 'kaiserburg', h: 'The Kaiserburg', text: 'The imperial castle on its sandstone rock. Every emperor stays here.' },
        { slug: 'albrecht-durer-haus', h: 'Dürer\'s house', text: 'The painter lives and works under the castle, by the Tiergärtnertor.' },
        { slug: 'weinstadel', h: 'The Weinstadel', text: 'A long timber-framed hall on the river, with the hangman\'s bridge beside it.' },
        { slug: 'heilig-geist-spital', h: 'Heilig-Geist-Spital', text: 'The hospital stands on two arches over the Pegnitz.' },
        { slug: 'st-lorenz', h: 'St. Lorenz', text: 'The south side\'s great church, its hall choir finished in 1477.' },
      ],
    },
  ],
  cards: { districts: 'content/districts.json', landmarks: 'content/landmarks.json' },
};
