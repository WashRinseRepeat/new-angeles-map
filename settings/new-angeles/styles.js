// New Angeles district styles. Kits read these dials through the blended style st.

// Base de Cayambe (BDC) and Rutherford (RUT) are the two ends of the style axis. st.w places a style on it,
// 0 for Base de Cayambe and 1 for Rutherford, and kits read it for palettes and massing.

export const BDC = {
  h0: 8, h1: 34, density: .86, neon: .3, lit: .2, grime: .7,
  base: [.14, .1, .075], win: [1.0, .62, .22],
  signs: [[1.6, .7, .12], [1.5, .16, .1], [1.4, .35, .08]],
  tiers: [['tenement', 'warehouse', 'cargo', 'park'], ['block', 'tenement', 'stack', 'warehouse'], ['tower', 'block']],
  street: [1.0, .45, .1],
};
export const RUT = {
  h0: 14, h1: 80, density: .97, neon: .8, lit: .2, grime: .2,
  base: [.07, .09, .11], win: [.42, .88, .95],
  signs: [[1.8, .15, 1.2], [.18, 1.4, 1.8], [.2, 1.6, 1.3], [1.2, .2, 1.6]],
  tiers: [['stack', 'block', 'park'], ['stack', 'tower', 'block', 'stack'], ['tower', 'twin', 'stack'], ['mega', 'tower', 'tower', 'twin', 'stack']],
  street: [.55, .6, 1.0],
};

// Every district has a style. Dials come from design/districts/<id>.md. w places a style on the old
// Base de Cayambe (0) to Rutherford (1) axis, which kits read for palettes and massing. zones lists
// the block zones a district allows. Tiers use existing kits until a district gets its own family.

const STYLE = (o) => ({ zones: [], ...o });
export const STYLES = {
  chakana: BDC,
  'base-de-cayambe': BDC,
  rutherford: RUT,
  esmeraldas: STYLE({ w: .35, h0: 10, h1: 40, density: .72, neon: .45, lit: .32, grime: .45, base: [.13, .11, .1], win: [1, .76, .45],
    signs: [[.3, .8, 1.8], [1.6, .55, .15], [.4, 1.5, .5], [1.5, .3, .9]], street: [1, .58, .25], zones: ['industry'],
    tiers: [['block', 'tenement', 'park'], ['block', 'stack', 'tenement'], ['tower', 'block', 'stack']] }),
  nihongai: STYLE({ w: .85, h0: 12, h1: 55, density: .68, neon: .35, lit: .17, grime: .08, base: [.08, .085, .08], win: [1, .74, .44],
    signs: [[1.8, .18, .22], [1.6, .4, 1], [.3, 1.5, .8], [1.7, 1.2, .4]], street: [.95, .86, .72],
    tiers: [['park', 'stack', 'block'], ['stack', 'tower', 'block'], ['tower', 'twin', 'stack'], ['tower', 'twin']] }),
  manta: STYLE({ w: .7, h0: 6, h1: 45, density: .55, neon: .95, lit: .35, grime: .12, base: [.17, .18, .2], win: [.85, .95, 1],
    signs: [[1.8, .2, 1.3], [.2, 1.6, 1.5], [.4, .9, 1.8], [1.8, .6, .6]], street: [.9, .9, .85], zones: ['industry'],
    tiers: [['park', 'block', 'stack'], ['stack', 'tower', 'block'], ['tower', 'twin', 'stack'], ['tower', 'twin']] }),
  'laguna-velasco': STYLE({ w: .8, h0: 6, h1: 60, density: .8, neon: .15, lit: .3, grime: .1, base: [.17, .18, .2], win: [.78, .9, 1],
    signs: [[.3, 1.2, 1.4], [1.3, 1.1, .7], [1.2, .5, .9]], street: [1, .6, .32],
    tiers: [['park', 'park', 'block'], ['block', 'tower', 'park'], ['tower', 'twin', 'block'], ['tower', 'twin']], yardKit: 'lv_garden', fillKit: 'lv_fill',
    blockCap: 160, blockGap: 0, blockMin: 30, smallShare: 1 }),
  rabotgorod: STYLE({ w: .2, h0: 14, h1: 38, density: .92, neon: .12, lit: .12, grime: .85, base: [.09, .085, .08], win: [.82, .9, .78],
    signs: [[1.4, .12, .1], [.25, .55, 1.4], [1.3, .9, .2]], street: [.62, .78, .7], zones: ['industry'], yardKit: 'rab_yard', yardBlocks: true,
    tiers: [['block', 'tenement'], ['block', 'tenement', 'stack'], ['tenement', 'block', 'stack']] }),
  'la-costa': STYLE({ w: .3, h0: 4, h1: 16, density: .15, neon: .08, lit: .15, grime: .2, base: [.13, .11, .09], win: [1, .76, .46],
    signs: [[1.5, .3, 1.2], [.9, 1.2, 1.3], [.2, 1.3, 1.1]], street: [1, .7, .4],
    tiers: [['park', 'park', 'warehouse'], ['park', 'warehouse', 'block']], yardKit: 'lc_fields', fillKit: 'lc_fill' }),
  quinde: STYLE({ w: .25, h0: 7, h1: 30, density: .82, neon: .25, lit: .35, grime: .9, base: [.12, .1, .08], win: [1, .78, .45],
    signs: [[1.6, 1.1, .1], [1.5, .45, .08], [1.4, 1.4, 1.5], [.4, 1.4, .3]], street: [1, .55, .15], zones: ['industry'],
    tiers: [['warehouse', 'cargo', 'tenement'], ['warehouse', 'tenement', 'block'], ['block', 'tower', 'tenement']] }),
  guayaquil: STYLE({ w: .4, h0: 10, h1: 60, density: .95, neon: .35, lit: .18, grime: .8, base: [.09, .08, .07], win: [1, .62, .32],
    signs: [[1.6, .2, .3], [1.5, .8, .2], [1.2, .2, 1.4], [.2, 1.2, .5]], street: [.85, .45, .15],
    tiers: [['tenement', 'block', 'stack'], ['block', 'stack', 'tower'], ['tower', 'twin', 'mega']] }),
};
BDC.w = 0; BDC.zones = ['industry', 'housing'];
RUT.w = 1; RUT.zones = [];

// Quarters (CITY.quarters) are pockets inside a district with their own lot kits. Every lot in one builds,
// and block kits keep out.
//   fam    kit family the quarter's lots build from
//   style  dials laid over the district style. h0 and h1 scale with the lot's height factor.
//   tiers  kit names by density, like a district's tiers. Without them a lot picks from the whole family.
//   fill   filler buildings take the quarter style too

export const QUARTER_STYLES = {
  'mercado-baja': { fam: 'mercado', style: { h0: 6, h1: 24, neon: 1.4, lit: .34, density: 1 } },
  akeidito: {
    fam: 'akeidito', fill: true,
    style: { w: .75, h0: 10, h1: 40, density: 1, neon: 1.2, lit: .34, grime: .3, base: [.12, .065, .06], win: [1, .66, .32],
      signs: [[1.9, .2, 1], [.2, 1.4, 1.9], [1.8, .85, .15], [1.9, .25, .3]], street: [1.15, .5, .18] },
    tiers: [['ak_shop', 'ak_shop', 'ak_kwiky', 'ak_galleria', 'ak_hall'], ['ak_pagoda', 'ak_pagoda', 'ak_hall', 'ak_galleria', 'ak_shop'],
      ['ak_pagoda', 'ak_pagoda', 'ak_hall', 'ak_galleria', 'ak_shop'], ['ak_pagoda', 'ak_pagoda', 'ak_tower', 'ak_hall']],
  },
};

// Density cores give the skyline clusters.

export const CORES = [{ x: -600, z: 640, r: 220, s: .95 }, { x: -380, z: 900, r: 150, s: .6 }, { x: -420, z: 80, r: 160, s: .45 }, { x: 300, z: -300, r: 150, s: .3 }, { x: 560, z: -820, r: 260, s: .5 }];
