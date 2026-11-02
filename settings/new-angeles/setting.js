// The New Angeles setting pack. It holds the city of Android: Netrunner at night, round the Beanstalk space elevator.
// The engine reads every value that belongs to the setting from this object. SETTINGS.md describes the fields.
// Paths under data are relative to the map root. Every other path is relative to this folder.

import { MAP } from './map.js';
import { BDC, CORES, QUARTER_STYLES, RUT, STYLES } from './styles.js';
import { stationKits } from './stations.js';
import { LABELS, moves } from './moves.js';

export default {
  id: 'new-angeles',
  name: 'New Angeles',

  // Saved choices (tuning, quality, the welcome card, audio positions) use this prefix in localStorage.

  storage: 'na',
  data: { city: 'city.json', seats: 'places.json', summaries: 'districts.json' },
  map: MAP,

  // ---------- the central landmark, the Beanstalk, rising from the Root in Chakana ----------
  // city.json's root gives its position. radius keeps the plaza clear of lots. top is the pin height until the
  // landmark module returns its own. boost lifts towers near it by 1 + k * exp(-d / r). Highway ends within
  // highwayReach stay up, because they meet the road terminals. fade is the box an audio-tour gaze thins out.

  centre: {
    district: 'chakana', radius: 150, top: 190, pinLift: 30, boost: { k: .4, r: 300 }, highwayReach: 260,
    glow: [.2, .8, 1.2], module: 'landmarks/beanstalk.js', lore: 'The Beanstalk',
    fade: { y: 200, edge: 30, half: [90, 200, 90] },
    place: { slug: 'new-angeles', title: 'The Beanstalk', district: 'Chakana', type: 'Landmark · space elevator',
      summary: 'The space elevator at the heart of New Angeles. It rises from the Root and the Plaza del Cielo in Chakana.', color: [.6, 1.8, 2.6] },
  },

  // The terrain module replaces the flat ground, the slab and the sea. Its cloud decks sit at 720–1080 m.

  terrain: 'landmarks/terrain.js',

  // ---------- scale ----------
  // The start view looks north-east from over Rutherford, up through Base de Cayambe to the Beanstalk.
  // maxPolar is a share of pi. tourDistance is the zoom limit while an audio-tour move plays. edit is the first
  // top-down view in GM edit mode, over the crew's haunts in Base de Cayambe.

  camera: {
    fov: 45, near: 3, far: 12000, position: [-1450, 1350, 1330], target: [-220, 0, -10],
    maxPolar: .46, minDistance: 20, maxDistance: 4200, tourDistance: 16000, groundReach: 8000,
    edit: { position: [-200, 1000, 40], target: [-200, 0, -60] },
  },

  // detail is the prop range in metres per quality level. tile is the culling tile side. labels gives the ranges
  // past which place, landmark and quarter labels fade, and the label heights. layerTop is where the all layer
  // clips, above the tallest tower. Fog grows by near and far metres per metre the camera pulls back past from.

  scale: {
    detail: { ultra: 1400, high: 1400, medium: 1000, low: 650 }, tile: 1600, layerTop: 600,
    labels: { place: 2200, landmark: 1600, quarter: 3000, districtY: 160, quarterY: 70, landmarkY: 80, pinLift: 14 },
    fogZoom: { from: 800, near: .9, far: 1.8 },
    traffic: { ground: 1300, sky: 1900, highwayNear: 700 },
  },

  // ---------- look ----------
  // fog is the fog and sky colour. fogStart is the fog before the first frame and fogBase the close-view fog the
  // tuning panel starts from. hemi is [sky, ground, intensity] and moon [colour, intensity, position]. bloom is
  // [strength, radius, threshold]. flicker sets the beacon beat (Hz), the share of each beat a beacon is on,
  // the dim level of an off light, and the threshold of the broken-neon stutter. searchlight is the default
  // searchlight colour. tune holds the tuning panel's defaults, which apply before the first frame.

  look: {
    fog: 0x142036, fogStart: [400, 3800], fogBase: { near: 850, far: 3900 }, mist: .32,
    hemi: [0x7f9cc8, 0x1a1410, 1.5], moon: [0x8899cc, .7, [300, 800, 200]], bloom: [.45, .35, 1.0],
    edge: 140, flicker: { beat: .8, on: .15, dim: .06, stutter: -1.2 }, searchlight: [1, .92, .72], cardColor: [.6, 1.8, 2.6],
    ground: { outer: 0x0c140f, streets: [.048, .05, .058], plaza: [.03, .035, .045], blocks: [0x24262d, 0x121317],
      parks: [0x18261a, 0x0a140b], slab: 0x0d1118, sea: 0x06101e },
    tune: { exposure: 1, sky: 1.6, moon: 1.1, windows: 1.25, edges: .6, neon: 1.25, glows: 1.5, pools: .8,
      bloomStrength: .65, bloomThreshold: .7, bloomRadius: .2, fogNear: 500, fogFar: 1600, mist: .7, mistBase: 16 },
  },

  // ---------- district styles ----------
  // axis holds the two ends of the style axis, Base de Cayambe (st.w 0) and Rutherford (st.w 1). tierAlias
  // maps the short tier keys kit files use to district ids. blend is the default border blend in metres.
  // helpers adds names to H for the pack's own kits.

  styles: {
    axis: [BDC, RUT], styles: STYLES, quarters: QUARTER_STYLES, cores: CORES, blend: 230,
    tierAlias: { bdc: 'base-de-cayambe', rut: 'rutherford' }, helpers: { BDC, RUT },
  },

  // ---------- kit families ----------
  // families load in order, then the districts, then the finds. A district family's tiers replace the
  // district's placeholder tiers. Each find family has a card file at content/<family>.json. private families
  // hold campaign places, so the public copy leaves them out. smallLots go to lots under 16 m in a style that
  // is the given object.

  kits: {
    families: ['industry', 'nature', 'heavy', 'chakana', 'favela', 'mercado', 'akeidito'],
    districts: ['esmeraldas', 'nihongai', 'manta', 'laguna-velasco', 'rabotgorod', 'la-costa', 'quinde', 'guayaquil'],
    finds: ['finds-broadcast', 'finds-downtown', 'finds-base', 'finds-spread', 'finds-east', 'finds-south', 'golden-spire', 'finds-story'],
    private: ['finds-story'],
    smallLots: { style: BDC, kits: ['shacks', 'shacks', 'shophouse'] },

    // Land-use zones group a kit family into patches of smooth noise instead of scattering it.

    landUse: ({ vnoise }) => [
      { fam: 'industry', test: (x, z, w) => w < .6 && vnoise(x / 420 + 11, z / 420 + 5) > .64 },
      { fam: 'nature', test: (x, z) => vnoise(x / 260 + 3, z / 260 + 9) > .74 },
    ],

    // Block zones, in the order they pick blocks. Each district zone takes up to 16 of its own blocks. Chakana
    // kits reach every corner of the district, and the ring rank fills the Root side first when the slider is
    // low. Industry spreads over Base de Cayambe and the border, and a 120 m gap keeps one patch from taking
    // every site. Mega-housing fills whole blocks in Base de Cayambe and Chakana.

    blockZones: Z => [
      ...Z.districts.filter(d => d.id !== 'chakana').map(Z.districtZone),
      { zone: 'chakana', cap: () => 160 * Z.tune.chakana, gap: 0, minSide: 30, test: Z.inCentre, rank: Z.ringRank },
      { zone: 'industry', cap: () => 28 * Z.tune.industry, gap: 120,
        test: (b, blend) => Z.allows(b, 'industry', blend) && Z.vnoise(b.cx / 420 + 11, b.cz / 420 + 5) > .45,
        rank: b => Z.vnoise(b.cx / 420 + 11, b.cz / 420 + 5) + .3 * Z.vnoise(b.cx / 90 + 3, b.cz / 90 + 8) },
      { zone: 'housing', cap: () => 10 * Z.tune.mega, gap: 240, builders: [Z.megaHousing],
        test: (b, blend) => Z.allows(b, 'housing', blend), rank: b => Z.vnoise(b.cx / 350 + 41, b.cz / 350 + 17) },
    ],

    // City dials. start is what the first build uses. The tuning panel's City rows start from their own defaults
    // and rebuild the city only when a saved value differs.

    cityStart: { height: 1.5, fill: 1.15, mega: 3, industry: 1, chakana: 1, lights: 1.1 },
    cityTune: [
      ['height', 'Building height', .4, 2, .05, 1.35],
      ['fill', 'Built lots', .3, 1.15, .01, 1.15],
      ['mega', 'Mega-housing blocks', 0, 3, .1, 3],
      ['industry', 'Industry blocks', 0, 3, .1, 1],
      ['chakana', 'Chakana Root blocks', 0, 3, .1, 1.4],
      ['lights', 'Street light density', .3, 3, .05, 0.9],
    ],
  },

  // ---------- transport ----------
  // Highways carry one car per every metres at speed plus up to spread m/s, in the colours of the two directions.
  // cars and hover give each vehicle's boxes as [w, h, l, x, y, z, rgb]. Hover cars take share of the main and
  // major street slots and fly in lanes at y metres, the second direction climb metres higher.

  transport: {
    highway: { every: 6, speed: 30, spread: 15, colours: [[1.6, .45, .08], [1.3, 1.1, .8]] },

    // Street cars are dim bodies with small head and tail lights.

    cars: {
      parts: [[1.8, .7, 4.2, 0, .55, 0, [.07, .07, .08]], [1.5, .5, 2.2, 0, 1.15, -.3, [.05, .05, .06]],
        [.38, .2, .08, -.6, .65, 2.12, [1.5, 1.4, 1.2]], [.38, .2, .08, .6, .65, 2.12, [1.5, 1.4, 1.2]],
        [.4, .16, .08, -.65, .7, -2.12, [1.3, .05, .03]], [.4, .16, .08, .65, .7, -2.12, [1.3, .05, .03]]],
    },

    // Hovercars: a flat wide body, a cyan underglow and red and green wingtip lights.

    hover: {
      share: .25, y: { main: 120, major: 80 }, climb: 20,
      parts: [[3, .6, 5, 0, 0, 0, [.06, .07, .09]], [1.6, .5, 2.2, 0, .5, -.4, [.04, .05, .07]],
        [2.4, .08, 4, 0, -.34, 0, [.3, 1.4, 1.8]], [.3, .2, .3, -1.6, 0, 0, [1.6, .1, .08]],
        [.3, .2, .3, 1.6, 0, 0, [.1, 1.6, .3]], [1.2, .15, .08, 0, .05, 2.5, [1.4, 1.4, 1.5]]],
    },

    // The maglev loop's deck runs from height[0] at style weight 0 to height[1] at 1. Spurs run from the plaza
    // edge at spur[0] down to spur[1]. Lines and rings run at 26 m. A spur is a Beanstalk line. It starts at the
    // centre station and plays centreMusic. stops are hand-placed stations in map px. A district without them
    // gets one station where a route runs deepest inside it, dressed by its kit in stations.js.

    maglev: {
      height: [16, 64], spur: [40, 22], line: 26, ring: 26, loopName: 'City Loop',
      spurNames: ['Beanstalk Southwest Line', 'Beanstalk West Line', 'Beanstalk South Line'],
      centreStation: { id: 'chakana', name: 'The Beanstalk' }, centreMusic: 'beanstalk-line', defaultStation: 'chakana',
      stations: stationKits,
      stops: [
        { id: 'guayaquil', name: 'Nuevo Guayaquil', at: [960, 1495] },
        { id: 'guayaquil', name: 'Florine Ojeda Bank', at: [1190, 1542] },
        { id: 'guayaquil', name: 'Beyond the Daule', at: [1218, 1400] },
        { id: 'guayaquil', name: 'Las Peñas', at: [1060, 1240] },
        { id: 'guayaquil', name: 'Antiguo Guayaquil', at: [930, 1415] },
        { id: 'esmeraldas', name: 'The Streets', at: [262, 500] },
        { id: 'esmeraldas', name: 'Historic Esmeraldas', at: [232, 442] },
        { id: 'esmeraldas', name: 'The Malecón', at: [207, 372] },
      ],

      // Ride tours name the stations they pass, each optionally on a given route. music is the track key.

      tours: [
        { name: 'Beanstalk Circle', music: 'beanstalk-line', via: [['The Beanstalk', 'Beanstalk South Line'], ['Rutherford', 'City Loop'],
          ['Base de Cayambe', 'City Loop'], ['The Beanstalk', 'Beanstalk West Line']] },
        { name: 'Beanstalk to the Malecón', music: 'esmeraldas-line', via: [['The Beanstalk', 'Beanstalk West Line'], ['The Malecón']] },
        { name: 'Beanstalk to Guayaquil', music: 'guayaquil-loop', via: [['The Beanstalk', 'Beanstalk Southwest Line'], ['Quinde'],
          ['Nuevo Guayaquil', 'Guayaquil Loop'], ['Las Peñas', 'Guayaquil Loop']] },
        { name: 'Beanstalk to the Coast', music: 'la-costa-line', via: [['The Beanstalk', 'Beanstalk West Line'], ['Manta'], ['Quinde'],
          ['Antiguo Guayaquil', 'Guayaquil Line']] },
      ],
    },
  },

  // ---------- audio guide ----------
  // Episodes are MP3s with cue files. Session podcasts live with their recap and show on the session's tour
  // card, not in the audio guide. moves and labels add the pack's camera moves. centreGaze lists the moves that
  // thin out what stands in front of the centre.

  audio: {
    episodes: [
      { id: 'e01-the-thread-to-the-sky', n: 1, title: 'The Thread to the Sky', route: 'The Root and Base de Cayambe', min: 8.7 },
      { id: 'e02-the-face-of-the-city', n: 2, title: 'The Face of the City', route: 'Rutherford and Akeidito', min: 8.5 },
    ],
    moves, labels: LABELS, centreGaze: ['gaze'],
  },

  // Card texts for districts and landmarks. Each find family adds content/<family>.json. site says the places have
  // pages and images on the archive site.

  cards: { districts: 'content/districts.json', landmarks: 'content/landmarks.json', site: true },

  // Optional layers below the city. The engine loads the module on first use and slides the clip plane to clip.

  layers: { undercity: { module: 'undercity.js', clip: -.5, mistBase: -30 } },
};
