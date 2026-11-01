# Map spike modules

## Run and preview

- Server: `http://localhost:8766` serves the repo root. Start it with `node spikes/map/gen/serve.mjs` (no-cache, binds 127.0.0.1, takes edit-mode saves; optional port argument). `python3 -m http.server 8766` from the repo root also works, without saves.
- Whole city: `http://localhost:8766/spikes/map/`
- One location: `?focus=<slug>`
- One kit family on an empty grid, at style weights 0 / 0.5 / 1: `?showcase=<family>`
- GM edit mode: `?edit=1` on localhost or 127.0.0.1. See "Edit mode" below.
- One layer: `?layer=all|undercity`. Layers are a horizontal slice. Built-in materials clip through `renderer.clippingPlanes`, and custom shaders should discard above `uClipTop`.
- `window.spike` exposes `camera`, `controls`, `PLACES` and more for screenshots.

## Files

| Path | Owns |
|---|---|
| `index.html` | page, styles and the import map. It loads `engine/ui.js` |
| `engine/state.js` | `H` and the shared mutable state `S` (`FRAME`, `DECOR`, `flicker`, `BASE`, `trafficT`) |
| `engine/core.js` | city data, layout maths, district styles (`STYLES`, `styleAt`), named places |
| `engine/render.js` | renderer, scene, camera, bloom, fog, labels, ground surfaces |
| `engine/instances.js` | instanced meshes, building shader, placement helpers, tiles, beam / puff / textSign |
| `engine/grammar.js` | lot prisms, tower grammar, archetypes, core kits, named-location helpers |
| `engine/transport.js` | maglev, highways, street and sky traffic, default Beanstalk, ride routes and station sites |
| `engine/ride.js` | district station kits and the maglev ride: train, rider camera, HUD, and tours that join several lines into one route |
| `engine/generator.js` | lot frames, zones, block sites, filler, `generate()`, showcase |
| `engine/api.js` | fills `H`, loads kit families and landmarks, seats places, first build |
| `engine/ui.js` | layers, labels, card, tuning panel, frame loop (entry point) |
| `engine/undercity.js` | the Undercity layer for every district |
| `engine/nav.js` | search, atlas, session tours, minimap, filter chips |
| `engine/edit.js` | GM edit mode: place footprints, change requests (loaded only with `?edit=1` on localhost) |
| `places.json` | seat of each campaign place: `at`, `size`, `rot`, `snap` |
| `requests/` | GM change requests, one JSON and PNG each. `requests/README.md` says how to work them |
| `gen/serve.mjs` | local dev server with `POST /api/places` and `POST /api/requests` |
| `districts.json` | one-line canon summaries per district, for the atlas |
| `layouts/index.mapindex.json` (site) | `map-index.json`: locations and recaps with their location links in order, for tours and search |
| `places/<slug>.js` | one named location block |
| `kits/<family>.js` | one kit family |
| `gen/gen.ts` → `city.json` | streets, lots, district outlines, quarters (such as Mercado Baja), places (copied from `places.json`) |

## Place module

```js
export const meta = { title, district, type, summary, color: [r, g, b] };
export function build(H, p, cx, cz) { /* ... */ return pinHeight; }
```

- Footprint: `size` in `places.json`, else `meta.size = [w, d]`, else a 68 m square (`H.BLOCK`), centred on `cx, cz` (the origin). A larger place takes every lot and block site under its footprint, past its own block's edge. `H.frame()` gives `{ w, d }`. `+z` is the main front.
- Seat: `places.json` (read at runtime by `engine/api.js`, and copied into `city.json` by `gen.ts`). `at` is a world point in metres. With `snap: true` the engine seats the place on the nearest free large block within 260 m; `rot` (radians) overrides the block's rotation, `null` keeps it. With `snap: false` it builds exactly at `at`, rotated by `rot`. `H.decor` meshes parent to the seat.
- Tag at least one mesh with `mesh.userData.place = p` so clicks open the card.
- Lore: `content/locations/<slug>.md`. Reference image: `content/images/<slug>.png`.

## Kit module

```js
export function kits(H) { return { name(x, z, s, st, b, r) { /* ... */ } }; }
export const tiers = { bdc: { 0: ['name'] }, rut: { 2: ['name'] } };
```

- Kits build in the lot's local frame. `put` rotates output onto the real lot.
- `s` is the usable square side. `H.frame()` gives the lot rectangle `{ w, d }` when the kit runs on a city lot. `H.frame().front` is the local unit vector `{ x, z }` toward the nearest street; put shop fronts there. It is null in the showcase.
- `st` is the blended district style (`st.w`: 0 Base de Cayambe, 1 Rutherford). `b` is a height boost. `r()` is the lot's seeded random.
- Tiers: `bdc` has 0..2, `rut` has 0..3, low to high density.

## Block kits

```js
export function blocks(H) { return { name: { zone: 'industry', build(x, z, w, d, st, r) { /* ... */ } } }; }
```

- A block kit fills a whole city block. `w` and `d` are the block rectangle, 42 to 136 m a side (26 m and up in the `chakana` zone). It builds in the block's local frame around `x, z`, like a lot kit.
- Zones choose the blocks:
  - `industry`: industrial patches in Base de Cayambe and the border, 120 m apart, up to 28 blocks.
  - `chakana`: blocks from 30 m a side in Chakana within 900 m of the Root, nearest first in each of eight sectors, up to 60.
  - `housing`: mega-housing in Base de Cayambe and Chakana, 240 m apart, up to 30.
- Lots under a block kit are not built. City sliders in the Tuning panel scale each zone's count.
- `?showcase=<family>` lays block kits out in a row of 110 × 80 m blocks behind the lot kits.

## District families

Each new district owns `kits/<district>.js` (esmeraldas, nihongai, manta, laguna-velasco, rabotgorod, la-costa, quinde, guayaquil). Design: `design/districts/<district>.md`.

```js
export function kits(H) { return { name(x, z, s, st, b, r) {} }; }           // lot kits
export const tiers = { '<district>': { 0: [...], 1: [...], 2: [...] } };      // replaces the district's placeholder tiers
export function blocks(H) { return { name: { zone: '<district>', build(x, z, w, d, st, r) {} } }; }  // up to 16 blocks, 140 m apart
export function landmarks(H) { return { name: { at: [px, py], label: 'Blue Sun Stadium', minSide: 46, reach: 400, build(x, z, w, d, st, r) {} } }; }
```

- `st.id` is the dominant district, `st.mix` lists `[id, weight]`, and `st.signs` is the district palette. `st.w` places the style on the old Base de Cayambe (0) to Rutherford (1) axis.
- `H.subareaAt(x, z, scale = 1)` names the sub-area under a world point, with circles grown by `scale` (for example `'New Akiba Quarter'`), so a kit can vary by sub-area. `H.styleAt(x, z)` gives the style anywhere.
- A landmark may add `update(t, dt)`, which the engine calls every frame.
- A landmark claims the free block nearest `at` (map px on the canon map, as in `design/map-trace.json`) within `reach` metres and builds there like a place: `H.decor` is a group at the block, `H.frame()` is the block rectangle.
- `H.worldOf(x, z)` turns a local point into world coordinates (for `H.subareaAt`), and `H.toLocal(x, z)` goes back, for parts placed off the lot or block. `glow` takes an optional `ry` after `rgb`.
- Lots under 16 m wide go to the district's tier 0 kits 80% of the time, so tier 0 kits must work on lots from about 6 m.
- A style may set `yardKit` (a lot kit for lots that fail the density roll, instead of the engine's yard) and `noFill: true` (no filler buildings on bare ground). La Costa and Laguna Velasco use both.
- Kit names share one namespace across all families. Prefix new names with the district (`esm_`, `nih_`, ...).

## Families

| File | Owns |
|---|---|
| `kits/industry.js`, `kits/nature.js` | lot-scale industry and green kits, placed by land-use zones |
| `kits/heavy.js` | block-scale industry (`industry` zone) |
| `kits/chakana.js` | Root-district blocks (`chakana` zone) |
| `kits/favela.js` | lot-scale Base de Cayambe housing, added through `tiers.bdc` |
| `kits/mercado.js` | lot kits for the Mercado Baja quarter. When it has kits, every quarter lot uses them |

Every family file exports `kits(H)`, even when it returns `{}`.

## Landmarks

```js
export function build(H, group) { /* ... */ return { top, update(t, dt) {} }; }
```

- `landmarks/beanstalk.js` gets a group at the Root and replaces the engine's simple stalk. `top` sets the pin height.
- `landmarks/terrain.js` gets a group at the origin and replaces the flat ground, the slab and the water. The undercity view hides it.
- Landmarks build their own meshes. The instanced helpers reset on every rebuild, so landmarks should not use them.

## Helper API `H`

| Helper | Use |
|---|---|
| `bld(x, z, w, d, h, st, r, { y0, lit, shape, roof, glow, ry, skin, kibble })` | windowed building volume. `kibble: false` skips facade add-ons. Shapes `box`, `cyl`, `oct`, `pyr`. Skins `H.SKINS` |
| `prop(kind, x, y, z, sx, sy, sz, rgb, ry, rx)` | lit solid. Kinds `box`, `cyl`, `cone`, `dish`, `lattice` |
| `glow(x, y, z, sx, sy, sz, rgb)` | unlit emissive box. Values above 1 bloom |
| `put(H.GLOWS.sphere \| H.GLOWS.ring, ...)` | emissive sphere or halo ring |
| `sign`, `neon`, `holo`, `helipad`, `roof`, `kibble`, `beacon`, `flickerGlow` | signage, rooftop clutter, lights |
| `crownOf(kind, top, H, st, r, accent)`, `grammarTowerBody(x, z, W, D, H, st, r, force)` | tower grammar pieces |
| `panel(tex, x, y, z, w, h, ry, gain)`, `neonTexture(lines, color, opts)`, `canvasTexture(w, h, draw)` | textured planes, drawn signs |
| `plate(cx, cz, rgb)`, `stringLights(a, b, sag, n, rgb)` | block ground, light strings |
| `pool(x, z, radius, rgb)` | soft additive light pool on the ground. Keep rgb around .05–.15 |
| `beam(a, b, t, rgb, kind)` | box from point `a` to point `b` (`[x, y, z]`), `t` thick. `kind: 'glow'` makes an unlit light strip |
| `puff(x, y, z, radius, rgb)` | see-through smoke or steam ball. Keep rgb dim, near the fog colour |
| `textSign(text, x, y, z, w, h, ry, rgb)` | neon text plane from a shared atlas (512 slots, about 4:1). Tint above 1 blooms. Prefer this to `panel()` in kits |
| `decor` | `THREE.Group` for custom meshes. Standard and basic materials get scene fog |
| `instanced(mesh)` | register a kit's own `InstancedMesh` so `generate()` resets and uploads it |
| `THREE`, `mixStyle`, `rng`, `hash`, `lerp`, `smooth`, `grey`, `BDC`, `RUT`, `FACES`, `PROPS` | basics |

## Rules

- Edit only your own files.
- Randomness only from `r()` or `H.rng(H.hash(a, b))`. Never `Math.random`.
- Prefer instanced helpers. Custom meshes: keep each place under about 300, and merge geometry where you can (`three/addons/utils/BufferGeometryUtils.js`).
- Light is dim by design. Keep emissive values mostly under 1 and let only signs and accents bloom.
- Comments: short, present tense, matching the existing code.

## Edit mode

`?edit=1` on localhost or 127.0.0.1 loads `engine/edit.js`. The live site never loads it.

- The camera goes top-down. The Top-down button toggles it.
- Move / size: click a footprint to select it. Drag it to move, drag a corner to resize about the centre, drag the amber knob to rotate (Shift snaps to 15°). The green dotted outline is the block the place snaps to. The side panel has number fields and the snap checkbox. Turning snap off keeps the place where it stands.
- Landmarks show violet footprints. Drag one onto another block to move it. It takes that block's size and turn, and its seat lands in `places.json` as `"lm:<name>": {"at": [x, z]}`.
- Changes list old → new per place, with revert and Undo. Buildings move only on Apply, because places build into shared instanced meshes.
- Apply · rebuild saves `places.json` and reloads the page with the same view.
- Change request: click 3 or more ground points, close on the first point or Enter, type the request, save. The file lands in `requests/<yyyy-mm-dd>-<slug>.json` with a PNG. Open requests draw as numbered amber outlines; click one in the list to fly to its camera.
- Without `gen/serve.mjs` the page cannot write: Copy patch puts the changed `places.json` entries on the clipboard, Download saves a full `places.json`, and requests download as JSON and PNG.
- After saving places, rebuild `city.json` with `cd spikes/map/gen && npx esbuild gen.ts --bundle --platform=node --format=esm --outfile=dist/gen.mjs && node dist/gen.mjs` so `gen.ts` output and `data/map_places.json` stay current.

