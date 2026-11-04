// The active setting pack. index.html names it in <meta name="setting">, and New Angeles is the default.
// The engine reads every value that belongs to the setting from SETTING and loads the pack's own files from
// PACK. Data files that tools write (city.json, places.json) stay at the map root, and the pack names them.

const id = document.querySelector('meta[name=setting]')?.content || 'new-angeles';
export const PACK = new URL(`../settings/${id}/`, import.meta.url).href;
export const ROOT = new URL('../', import.meta.url).href;
export const SETTING = (await import(`${PACK}setting.js`)).default;

// Optional sections get their empty forms here, so the rest of the engine reads them without checks. A pack
// without a centre gets a zero radius and no centre card. The engine never changes a value a pack sets.

const S = SETTING, T = S.transport ??= {};
S.centre = { radius: 0, top: 0, pinLift: 0, boost: { k: 0, r: 1 }, highwayReach: 0, glow: [0, 0, 0],
  fade: { y: 0, edge: 0, half: [0, 0, 0] }, place: null, ...S.centre };
T.maglev ??= {};

// City scale. Defaults are New Angeles' metres. blockMax caps a block kit's frame and blockMin the smallest block a
// zone or the centre ring takes. siteMin is the smallest block a place or landmark seats on, within seatReach of
// its point, or landmarkReach for a landmark. A lot under smallLot takes a small kit or one infill building, which
// grows into a tower past tallInfill metres. Land-use zones need lots of zoneLot. district gives each district zone
// its cap, gap and smallest block side. Lamps stand lampStep metres apart, lampOffset from the street's centre.
// Filler buildings sit on a fillStep grid and measure fill to 1.5 fill.

S.scale.city = {
  blockMax: 140, blockMin: 30, siteMin: 46, seatReach: 260, landmarkReach: 400, smallLot: 16, zoneLot: 12, tallInfill: 38,
  district: { cap: 16, gap: 140, minSide: 40 }, lampStep: { main: 24, minor: 28 }, lampOffset: { main: 4.5, minor: 3.2 },
  fillStep: 10, fill: 5, ...S.scale.city,
};
T.maglev.tours ??= [];
T.maglev.stops ??= [];
S.audio ??= {};
S.audio.episodes ??= [];
S.layers ??= {};
S.kits.tune ??= {};
S.cards ??= {};

// A pack may offer lighting modes in look.modes, such as day or lantern-lit night. ?look=<mode> lays that mode over
// look. A nested object such as tune or lamps merges key by key, any other value replaces the pack's own.

const asked = new URLSearchParams(location.search).get('look');
export const LOOK_MODE = S.look.modes?.[asked] ? asked : null;
if (LOOK_MODE) for (const [k, v] of Object.entries(S.look.modes[LOOK_MODE])) {
  S.look[k] = v && typeof v === 'object' && !Array.isArray(v) && S.look[k] ? { ...S.look[k], ...v } : v;
}

// A pack's look.clock lights the map by the hour (daylight.js). It runs unless ?look= picks a fixed mode. ?time=HH:MM
// sets the starting hour and ?cycle=<minutes> the length of a day; a cycle of 0 holds the hour.

const Q = new URLSearchParams(location.search), at = /^(\d{1,2})(?::(\d\d))?$/.exec(Q.get('time') ?? '');
export const CLOCK = !LOOK_MODE && S.look.clock ? {
  start: 12, cycle: 0, ...S.look.clock,
  sun: { rise: 6, set: 20, peak: 60, moon: 40, noon: null, ...S.look.clock.sun },
  ...at && { start: (+at[1] + (+at[2] || 0) / 60) % 24 },
  ...Q.has('cycle') && { cycle: Math.max(0, +Q.get('cycle') || 0) },
} : null;

// ?streets=<variant> loads city-<variant>.json, a street layout that gen.ts writes next to city.json. The pack's
// data.streets names the default variant, and ?streets=grid loads city.json itself.

const streets = new URLSearchParams(location.search).get('streets') ?? S.data.streets;
if (/^\w+$/.test(streets ?? '') && streets !== 'grid') S.data.city = S.data.city.replace(/\.json$/, `-${streets}.json`);
export const inPack = path => new URL(path, PACK).href;
export const atRoot = path => new URL(path, ROOT).href;
