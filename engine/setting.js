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
S.cards ??= {};

// A pack may offer lighting modes in look.modes, such as day or lantern-lit night. ?look=<mode> lays that mode over
// look. A nested object such as tune or lamps merges key by key, any other value replaces the pack's own.

const asked = new URLSearchParams(location.search).get('look');
export const LOOK_MODE = S.look.modes?.[asked] ? asked : null;
if (LOOK_MODE) for (const [k, v] of Object.entries(S.look.modes[LOOK_MODE])) {
  S.look[k] = v && typeof v === 'object' && !Array.isArray(v) && S.look[k] ? { ...S.look[k], ...v } : v;
}

// ?streets=<variant> loads city-<variant>.json, a street layout that gen.ts writes next to city.json.

const streets = new URLSearchParams(location.search).get('streets');
if (/^\w+$/.test(streets ?? '')) S.data.city = S.data.city.replace(/\.json$/, `-${streets}.json`);
export const inPack = path => new URL(path, PACK).href;
export const atRoot = path => new URL(path, ROOT).href;
