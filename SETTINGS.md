# Setting packs

Before building a pack, read `LESSONS.md`: the lessons and pitfalls from the packs so far. To plan a new setting with its author, start with `NEW-SETTING.md`: the questions to ask, the brief and the build order.

The engine in `engine/` draws a city. A setting pack says which city: its look, scale, styles, kits, transport, audio guide and card texts. New Angeles is the first pack, in `settings/new-angeles/`. `MODULES.md` covers the module API that kits and places use.

## How the engine finds a pack

- `index.html` carries `<meta name="setting" content="<id>">`. Without it the engine loads `new-angeles`.
- `engine/setting.js` imports `settings/<id>/setting.js` and exports its default object as `SETTING`. It is the only engine file that imports the pack.
- Paths under `data` resolve against the map root (`spikes/map/`). Every other path in the pack resolves against the pack folder.
- Pack modules may import engine modules (`../../engine/core.js`). `setting.js` itself must not, because the engine loads it first.

## The sandbox

`settings/sandbox/` is the smallest working pack: a 480 m town on a street grid with two districts and one kit family, at `spikes/map/sandbox.html`. `make-city.py` writes its `city.json`. Start a new pack from it rather than from New Angeles. `deploy.sh` leaves it off the live site, and the export script ships it in the public copy.

The sandbox leaves out every optional section and list, so it shows what the engine needs at least. Its city file has only `dims`, `origin`, `placeHalf`, `districts`, `streets`, `blocks` and `lots`. Its `setting.js` has no `centre`, `terrain`, `transport.highway`, `transport.hover`, `transport.maglev`, `audio` or `layers`.

## Emberford

`settings/emberford/` is a full second setting: a walled market town on a river at `spikes/map/emberford.html`, lit by a day clock: it opens at 17:00, `?time=HH:MM` picks the hour and `?cycle=<minutes>` runs a day, and `?look=day` or `?look=night` hold a fixed light. `gen/town.py` writes its `city.json` from `town.json`: the wall, gates, streets, plots, wards, sites for the landmarks, greens and the river. Its one kit family, `kits/town.js`, builds burgage houses that front their street, each with a fenced yard behind it whose fence and contents follow the ward (stone walls round trees and wells in the castle ward, plank fences round barrels, crates and sheds in the market ward, wattle round woodpiles, hay, vegetable beds and carts in the craft ward, and washing in market and craft yards), and the keep, church, market hall, square and town wall as free landmarks on the sites. It has a walking tour and card texts. Like the sandbox, it stays off the live site and ships in the public copy.

Regenerate the town after changing `town.json`:

```bash
python3 spikes/map/gen/town.py spikes/map/settings/emberford
```

## Nuremberg

`settings/nuremberg/` is Nuremberg around 1500 at true scale, at `spikes/map/nuremberg.html`. Its `town.json` traces the real plan with the Hauptmarkt at the origin, x east and z south in metres:

- the wall outline, eleven gates and the main streets as polylines
- the Pegnitz through the middle, with side arms round the Trödelmarkt and Schütt islands, and five bridges
- the landmarks as sites at their real places
- four quarters cut from the outline by the river and two lines: Burgviertel, Sebalder Altstadt, Lorenzer Altstadt and Lorenz Ost
- the castle rock and the Sebald slope as relief, and a river channel 3.5 m below the banks

The generator fills the blocks with infill lanes every 38 m or less and lays about 3,850 plots. Three quarters show other building traditions, to show how wards with their own architecture look and blend: Hanseatic brick Gothic in the Lorenzer Altstadt (`kits/hanse.js`), a Venetian merchant colony in Lorenz Ost (`kits/venice.js`) and Alpine timber in the Burgviertel (`kits/alpine.js`). The Sebalder Altstadt keeps the Franconian houses. Its own kits build burgher houses with a sandstone ground floor, stone, plaster or timber floors above, steep roofs with hoist dormers, Chörlein oriels and back houses across small courts. Emberford's houses and yards fill out the mix through `parts()` and `kits()` of `settings/emberford/kits/town.js`. Its landmarks are the Kaiserburg, St. Sebald, St. Lorenz, the Frauenkirche, the Schöner Brunnen, the Altes Rathaus, the Heilig-Geist-Spital on arches over the river, the Weinstadel, the Mauthalle, the Nassauer Haus, the Dürer-Haus, three smaller churches, two inner gate towers, the Schuldturm, two inns, and the double wall with its moat and the four great round towers. One fantasy landmark stands in Lorenz Ost: the Lindwurmdom (`kits/fantasy.js`), a Gothic cathedral with an animated dragon of custom meshes on its crossing tower. It shares Emberford's light and clock. North of the town rises the Rebenberg, a 300 m hill (a `relief.hills` entry) with the vintners' village of Rebenhain on its terraces (a `villages` ward in town.json), switchback and spiral roads, vineyards (`features.vineyards`, built by `kits/vineyard.js`) and Burg Himmelsfels on its summit (`kits/hillcastle.js`). Below the town lie the catacombs (`catacombs.js`), four layers of one dungeon: cellars, dungeons, deep and abyss. `under/plan.js` places the landmarks and their doorways, `under/network.js` builds the sewers, passages and side rooms between them, and `castle.js`, `cellars.js`, `tales.js` and `ritual.js` build the landmarks.

```bash
python3 spikes/map/gen/town.py spikes/map/settings/nuremberg
```

## Gareth

`settings/gareth/` is Gareth from Das Schwarze Auge in 1026 BF, at `spikes/map/gareth.html`: about 35,000 plots over 8.7 × 6.1 km. `BRIEF.md` in the pack holds the author's decisions and the work list. `trace/trace.py` reads the colour city map of the 2012 box (not in the repo) into `town.json`: the paved streets, squares and built-up ground from the map's colours, and the Ugdalfsmauern, gates, rivers and one seed per Viertel from `trace/hand.json`. Alt-Gareth's five Viertel are wards inside the wall; the nine outer Viertel are open `villages` with `town` and `infill` set. It raises `scale.capacity`, uses a 2 m ground texture and a 4 m ground grid, and builds its houses with Nuremberg's `houses(H).townhouse` and its own palettes. It stays off the live site and out of the public copy.

Its landmarks sit in one family file per area on shared parts in `kits/parts.js`. `BRIEF.md` holds the table that turns the book's labelled district maps into world points, so landmarks are placed by code label. `compare.html` overlays the built map on the book's city map; its comment says how to make the two images, which stay out of git. A re-run of `trace.py` gives a different street net, so fix `town.json` by hand. `LESSONS.md` sections 12 and 13 hold what this build taught about source maps and builder agents.

```bash
python3 spikes/map/settings/gareth/trace/trace.py <map.png>
python3 spikes/map/gen/town.py spikes/map/settings/gareth   # about 25 minutes
```

## Make a new pack

1. Copy `settings/sandbox/` to `settings/<id>/` and change the values. For a place traced from a book or plan, read `LESSONS.md` section 12 first. Add the optional fields below as the setting needs them. `settings/new-angeles/setting.js` shows every field in use.
2. Write a city file with the shape `gen/gen.ts` writes: `dims`, `origin`, `placeHalf`, `districts`, `streets` (`main`, `major`, `minor`), `lots` and `blocks`. Optional lists are `root` (the centre point), `highways`, `maglev` (a loop of three or more points), `loops` (closed routes `{ id, name, music, pts }` in world metres, laid after every other track; `gen/loops.py` writes them from `gen/loops.json`), `spurs`, `lines`, `rings`, `water`, `parks`, `coast`, `quarters`, `subareas`, `places` and `keep` (`[x, z, r]` circles that hold the frayed edge solid). Name the file in `data.city`.
3. Give every district id in the city file a style in `styles.styles`. Pick two of them as the style axis ends.
4. Add kit families under `kits/` and list them in `kits`. Every kit name the styles' tiers use must exist.
5. Add station kits for the maglev, or one default kit.
6. Make a page that names the pack: copy `index.html` and change its `<meta name="setting">`, title and texts.
7. Serve the repo root and open the page. `?showcase=<family>` checks one kit family.

An engine change for a new pack must leave New Angeles as it was. `node spikes/map/gen/regress.mjs` shows that against `main` (see `MODULES.md`).

## The pack contract

`setting.js` default-exports one object.

| Field | Holds |
|---|---|
| `id`, `name` | folder name and display name |
| `storage` | localStorage prefix for saved choices (tuning, quality, welcome card, audio positions, edit mode) |
| `data` | `city`, `streets` (optional default street layout, as `?streets=` takes it; `grid` is `city` itself), `seats` (edit-mode seats, `places.json`), `summaries` (one-line district texts for the atlas), relative to the map root |
| `editCity` | optional `(city) => void`. It runs once on the loaded city file, before anything reads it. New Angeles uses it to run a street on into a tunnel (`isle.js`) |
| `map` | `{ cx, cy, scale }`: a map pixel `[u, v]` lands at `((u - cx) * scale, (v - cy) * scale)` metres. `gen/gen.ts` imports New Angeles' `map.js`, so the city file agrees |
| `centre` | optional. The central landmark. `district` (its blocks take the ring zone), `radius` (plaza kept clear), `top` and `pinLift` (pin), `boost` (towers rise near it), `highwayReach`, `glow` (plaza ring colour), `module` (optional landmark module), `lore` (its key in the landmark cards), `fade` (box an audio-tour gaze thins out), `place` (its card) |
| `terrain` | optional module that replaces the flat ground, the slab and the sea. `'../../engine/hills.js'` gives rolling hills with woods, tuned in `look.land` |
| `camera` | `fov`, `near`, `far`, start `position` and `target`, `maxPolar` (share of pi), `minDistance`, `maxDistance`, `tourDistance`, `groundReach`, `edit` (first edit-mode view) |
| `scale` | `detail` (prop range per quality level), `tile`, `layerTop`, `labels` (fade ranges and heights), `fogZoom`, `traffic` (draw ranges), `city` (block, lot, seat, lamp and filler sizes in metres; see below), `capacity` (instance capacities for a large city: `shapes` box 200,000, pyr 16,000, gable 40,000 and `props` box 300,000, cyl 100,000, cone 16,000; a full mesh drops what comes after) |
| `look` | `fog`, `fogStart`, `fogBase`, `mist`, `hemi`, `moon`, `bloom`, `flicker`, `searchlight`, `cardColor`, `ground` colours, `tune` (tuning panel defaults), `decor` (engine decoration switches), `lamps` (street-lamp heights and post), `land` (hills colours), `rock` (optional colour of bare rock, for cliffs, falls and steep country; default `land.rock`), `clouds` (cloud decks), `water` (water's base colour) |
| `styles` | `axis` (two end styles), `styles` (one per district id), `quarters`, `cores` (density cores), `blend`, `tierAlias`, `helpers` (extra names on `H`), `wallSkins` (default skins of `bld()`), `slots` (tower-grammar slots it replaces) |
| `kits` | `families`, `districts` (families that own a district's tiers), `finds` (landmark families with card files), `private`, `smallLots`, `landUse(helpers)`, `blockZones(helpers)`, `cityTune` (tuning panel rows, whose defaults the first build uses), `tune` (starting values for the engine's city dials: cores, grain, skew, small, needles, needleTop, shapes), `ownTiers` (district ids whose tiers a shared family replaces; within `styles.blend` metres of a border, a lot in such a ward takes its kit mix from either ward by their weights, so styles interleave) |
| `transport` | `cars`, and optional `highway`, `hover` and `maglev` (heights, names, `centreStation`, `centreMusic`, `stops`, `stations(A, frame)`, `defaultStation`, `tours`). A traffic slider shows only for traffic the setting has. Only a route with a station runs a train |
| `audio` | optional. `episodes`, `moves(helpers)`, `labels`, `centreGaze`. Without episodes the Tours tab and the welcome card's tour button hide |
| `music` | optional list `{ file, name }` for the settings panel's music picker. `file` is the key of a loop in the ride audio folder |
| `people`, `boats` | optional townsfolk and river boats. See "People" and "Boats" below |
| `rivers` | optional rivers with a direction: sloped water that flows, falls and the land shaped round them. See "Rivers" below |
| `walks` | optional walking tours, each `{ title, summary, stops: [{ slug, h, text }] }`. A stop's slug names a place card, a landmark (its label, slugged) or a district id. They show under Tours and play in the stop-by-stop tour panel |
| `cards` | `districts` and `landmarks` card files. Each find family adds `content/<family>.json`. `site: true` says the places have pages and images on the archive site |
| `layers` | optional extra layers, each `{ module, clip, mistBase }` plus, for a dungeon level, `cut`, `floor`, `follow`, `background`, `underground`, `labels` and `cards`. The module exports `group`, `labels`, `build()` and optionally `update(t, dt, layer)`. Several layers may share one module. Buttons with `data-layer` switch them |

### Styles

A style holds `h0`, `h1`, `density`, `neon`, `lit`, `grime`, `w` and the colours `base`, `win`, `street`, plus `signs` (a palette), `tiers` (kit names from low to high density) and `zones` (block zones it allows). Optional: `yardKit`, `yardBlocks` (the yard kit also fills every block that holds no lots), `lotMax` (lots wider than this many metres build as a grid of smaller lots), `fillKit`, `noFill`, `blockCap`, `blockGap`, `blockMin`, `smallShare`, `portal`, `tunnel`. `w` places the style between the two axis ends. The engine's own buildings read the axis ends for window colours and sign palettes.

`portal` dresses each tunnel mouth in a building of that style: `{ depth, bar, shade, light, strip }`. A lintel and two jambs `bar` metres thick stand `depth` metres out of the facade, in the pierced box's colour times `shade`. `light` is an `[r, g, b]` or `'win'` for the building style's window colour. `strip: 'lintel'` lights the lintel only, and `'frame'` also the jambs and the lintel's top. The look follows the style the building was built in. Without `portal` a tunnel mouth gets the engine's lit frame. `tunnel: true` lets a maglev tunnel through a standing tower of that style at any height, where the portal fits the facade and the tower keeps 1 m clear of other buildings. New Angeles gives every district a look: its `STYLE()` helper sets a default that each district may replace.

### Buildings and decoration

- **Skins.** `H.SKINS` holds five window skins for towers (`grid`, `bands`, `fins`, `curtain`, `sparse`) and five material skins: `plaster`, `timber`, `stone` for walls, `tile` and `thatch` for roofs. Material skins draw small shuttered windows that light sparsely and skip floor bands, glass and edge glow. Seven more material skins serve old towns: `ashlar` (coursed sandstone), `rubble`, `braced` (timber frame with cross braces), `redframe` (red-painted timber frame), `quoins` (plaster with stone corners and window surrounds), and `slate` and `tiles` for roofs. `blindAshlar` and `blindRubble` draw ashlar and rubble without windows, for churches, walls and towers.
- **Roofs.** `bld(…, { shape: 'gable', skin: H.SKINS.tile, base: [r, g, b] })` builds a pitched roof with its ridge along local x. `base` gives the roof its own colour.
- **Defaults.** `styles.wallSkins` sets the skins `bld()` uses when a kit names none, and `styles.slots.skin` the skins the tower grammar and the engine's infill pick.
- **Decoration.** `look.decor` switches off engine decoration: `roof` (rooftop plant, tanks, masts, dishes), `kibble` (facade boxes), `neon`, `signs`, `holo`, `helipads`, `beacons` `markings` (road centre dashes), `harvesters` and `fieldExtras` (fish ponds and greenhouses on fields). Each defaults to on, and a switch also silences kit calls to that helper.
- **Frayed edge.** `look.edge` (metres) frays the city's outer edge, so it ends on a ragged line up to that far in. Ground, blocks, lots, lamps and streets stop at the line, and lots thin out near it. Borders between districts and the coast stay solid, and so does the ground round landmarks and places. `edgeAt(x, z)` in `engine/edge.js` tells a pack module where the line runs, for example to grow forest into it. Off by default.
- **Lamps.** `look.lamps` sets `main` and `minor` lamp heights, and `post` gives each lamp a post of that colour. `flicker` (a share such as `.75`) makes each lamp waver down to that share of its light, like a flame. `townOnly` keeps lamps inside the wards, so roads out across the country stay dark. A landmark with `claim` closes the streets inside its footprint: no lamp or car crosses it.
- **Bare lots.** A lot a ward's `density` leaves bare takes the style's `yardKit`. Without one it gets the engine's New Angeles yard: an asphalt pad with sheds and cars. Old-town packs set a yard kit, such as Gareth's `ga_garden`.
- **Flat overlays.** `H.layer(material, n)` pulls a flat overlay forward in depth. See the stacking rule in `LESSONS.md` section 4.
- **Landmark water.** `H.water(poly, y = .62, holes = [], n = 4)` lays water in the city lakes' shader (swell, glint, sky reflection, the clock's water colour) over a local outline of `[x, z]` points, `y` metres up, with optional hole outlines, pulled forward like `H.layer(m, n)`. People keep off it, except on a bridge's deck. All landmark water merges into one mesh per `n`. Call it from landmark and place builds only. Keep it 10 cm clear of other flat faces.

### Lighting

- `look.buildingLight` lights the building shader: `dir` (light direction), `colour` (light colour, above 1 for daylight), and `base`, `up` and `sun`, the shares of base light, light from straight up and light from `dir`. The defaults are the engine's night values.
- `look.shadows` turns on sun shadows from `look.buildingLight.dir`: `size` (shadow map side in pixels, default 2048), `reach` (largest half width of the shadowed square round the view, default 700 m) and `strength` (how far shadow darkens the unlit street and plaza surface, default 0.55). Buildings, kit props, trees and the hills cast; unlit materials, the ground and moving trains do not. Every lit material (kit props, stalls, trees, grass, lots, the hills) loses its direct light in shadow and keeps its sky light, so things shade each other and themselves. Buildings lose the sun share of their light in shadow, so for walls turned away from the sun to look as dark as the ground's shadows, most of `buildingLight` should be `sun` rather than `base`. With shadows on, building normals also take the inverse of the building's scale, so stretched roof slopes are lit correctly. The map follows the view and redraws when it moves, so traffic casts no shadow unless `live` is true, which redraws it every frame at the cost of drawing the casters once more per frame. `soft` makes edges soften with distance from their caster, sharp at a wall's foot and blurred at the shadow's tip (PCSS): it is the penumbra in metres for each metre between caster and ground (0 keeps hard edges; Emberford uses 0.06), up to `blur` metres (default 4). Without `look.shadows` no shader carries the shadow code, as in New Angeles. Emberford's `?look=day` sets it.
- `look.ao` darkens creases from the scene's depth: wall feet, narrow lanes and eaves. `radius` (metres, default 2.5), `strength` (default 0.7), `reach` (fades out by this distance, default 500 m) and `scale` (AO texels per CSS pixel along each side, default 0.5, at most half the device pixels). At the default the occlusion is drawn at a quarter of the CSS pixels and upsampled by depth, so shade stays on its side of an edge. `scale: 1` draws it twice as fine on each side, as before on a pixel-ratio-2 screen, and costs about 2.5 ms more in a close view. It is off at low quality. Emberford's `?look=day` sets it.
- `look.sky` is a sky gradient, `[zenith, horizon, below]` as hex colours. Without it the sky is the fog colour.
- `look.clock` lights the map by the hour (`engine/daylight.js`). Its `keys` are keyframes `{ at: hour, … }` that set the sky gradient, fog, sky light (`hemi`), sun or moon light (`light`), building light (`building`), street brightness (`ground`), water colour, shadow darkness (`shade`) and the window, lantern, bloom, exposure, fog and mist values in `tune`. A field a keyframe leaves out comes from `look`. The clock blends the two keyframes round the hour, eased, wrapping past midnight. `sun` sets sunrise and sunset (`rise`, `set`, in hours), the highest sun and moon (`peak`, `moon`, in degrees) and the sun's direction at midday (`noon`, `[x, z]`, by default the building light's). The sun or moon gives the light its direction, so shadows turn and lengthen through the day, and its light fades out near the horizon. `start` is the opening hour (`?time=HH:MM` overrides it) and `cycle` the minutes for a whole day, 0 to hold the hour (`?cycle=<minutes>` overrides it). The tuning panel's Time tab moves both. While the hour moves, it sets the Light sliders it covers. A pack with a clock also shows the hour in a slider above Smooth edges, kept in step with the Time tab, with a button that runs the day (four minutes a day unless `cycle` says otherwise) or stops it. The clock runs unless `?look=` picks a mode. Under a clock, `look` holds the daylight colours of the ground and land, and the night comes from the keyframes' low light. Under a clock the sky is a dome that blends the keyframe's `sky` colours by height, with haze round the sun, a glow on the horizon below a low sun, and stars that come out over the first hour and a half of night. The sun and moon also show in the sky as glows along the light, hidden by hills and passed over by clouds. The camera's tilt limit means the sun is in view only when low, near sunrise and sunset. Cloud tops take the hour's sun and sky light and brighten round the sun, their underside glow from the town follows the windows, and the glint on water takes the light's colour.
- `look.modes` holds named lighting modes. `?look=<mode>` lays that mode over `look`: nested objects such as `tune`, `lamps` and `ground` merge key by key, and other values replace the pack's own. The sandbox has `?look=day`.
- Window light, edge glow, neon, street lights, light pools and bloom are `look.tune` values, so a mode can turn them down for day. `look.tune.cars` and `look.tune.speed` set the traffic sliders' defaults, such as a few slow carts. `transport.cars.lit` lights the cars by the sun and the sky instead of drawing them flat, so they take shadows; a part whose colour passes 1 is a lamp and glows while the windows are lit.

### People

`people` puts townsfolk on foot (`engine/people.js`). `walk` sets walkers per 100 m of street (default 3). They stroll at `side` metres from the street's middle (`[minor, other]`, default `[2.6, 3.6]`) and turn back at a street's end. `crowds` lists groups: `{ at: [x, z], ring, n }` stand on a ring facing out, as at stalls round a square, and `{ at: [x, z], r, n }` stand and sway inside a circle. `clothes` and `skin` are lists of `[r, g, b]` to pick from. Under a clock all are out by day and the `night` share (default 0.15) at night. Only people within `range` metres of the camera (default 800) move and draw; the rest wait where they are, and over the last 15% of the range they shrink into the ground, so none pops in or out. They are lit, and cast shadows when `look.shadows.live` is on. Emberford sets 8 walkers per 100 m, a ring of 45 at the stalls and 25 in the middle of the square.

### Scale

`scale.city` holds the city's sizes in metres. Defaults are New Angeles'.

| Key | Default | Means |
|---|---|---|
| `blockMax` | 140 | largest block frame a block kit fills |
| `blockMin` | 30 | smallest block a zone or the centre ring takes |
| `siteMin` | 46 | smallest block a place or landmark seats on |
| `seatReach`, `landmarkReach` | 260, 400 | how far a place or landmark may move to find a block |
| `smallLot` | 16 | lots narrower than this take a small kit or one infill building |
| `tallInfill` | 38 | an infill building taller than this grows into a tower |
| `zoneLot` | 12 | smallest lot a land-use zone takes |
| `district` | cap 16, gap 140, minSide 40 | each district zone's block count, spacing and smallest side |
| `lampStep`, `lampOffset` | main 24 and 4.5, minor 28 and 3.2 | street-lamp spacing and distance from the street's centre |
| `fillStep`, `fill` | 10, 5 | filler grid step and filler building size |

### Interface theme

Each page links `ui.css`, the shared interface stylesheet, and then its pack's `theme.css`. `ui.css` draws every panel, button, card, label and the minimap from CSS variables (`--accent`, `--accent-rgb`, `--panel`, `--line`, `--text`, `--font` and about forty more, listed at its top), with New Angeles' values as the defaults. A pack's `theme.css` overrides the variables it needs and styles the loading logo, whose markup (`.logo`, `.orbit`, `.coin`, `.face`) is in the page. District outlines and tour routes take `--accent` too. Emberford's theme is a full example, the sandbox's a short one.

### Ground and clouds

- `engine/hills.js` keeps the city's rectangle flat and raises hills beyond it, with woods on them. `look.land` sets `size`, `height`, `pad`, `rise`, the colours `low`, `high` and `rock`, `trees` and `tree`.
- `look.clouds` lists cloud decks over the centre. Each takes `y0`, `y1` (the deck's floor and top), `cell` (noise size), `tile` (cluster spacing), `cover` (0 to 1), and optional `glow`, `dome`, `stretch`, `erode`, `near`, `reach` and `above`, as `engine/clouds.js` describes. A terrain module can build its own decks with `cloudLayer`, as New Angeles' does.
- `look.water` is the water's base colour under its reflections, for a lighter river by day.
- `look.groundMap` replaces the flat street and lot surfaces with one detailed, lit ground (`engine/groundmap.js`). The engine paints the town plan into a texture at `px` metres per texel (default 0.75): paved streets (`paved`, street kinds and their widths, default `{ main: 7, major: 5 }`), the square and the footprints of the site kinds in `pavedSites`, the lots, a trodden track down every street (`track` metres wide, default 3.5) and the town's extent with every street, so roads run on out of the gates. The shader draws cobbles with dark joints on paving (`cell` metres, default 0.38): large flat setts on main streets, round cobbles on major streets and small rough cobbles with missing stones on minor streets. Paving stops at the town's edge, so roads outside it are dirt with a grass strip down the middle. The trodden middle of a street is worn smooth and pale and shines a little, and weeds grow in the joints towards its edges. Lanes are packed earth with a lighter worn track and puddles that catch the light; open ground turns to patchy grass further from the streets. Grassy verges run along the lot edges with a few tufts, earth yards have patches of grass, and there is a dark gutter along each edge of the paving, wheel ruts along the trodden track, and mud with puddles round the gates and the centre's well (`mud` adds more spots as `[x, z, radius]`), each in its colour (`cobble`, `earth`, `yard`, `grass`). Mask edges wander with noise, and detail smaller than a pixel fades to its average. It takes sun, sky light and shadows, and draws nothing outside the town. `edge` (metres, default 0) fades the town's ground into the country over a noisy band instead of a sharp line. `gardens` lists ward ids whose open ground and yards grow lawn and meadow, for villa quarters and villages in green land. Emberford paves its gate streets and square, and its `?look=night` mode sets darker colours. Nuremberg paves every street, its squares and the ground round its landmarks.
- `look.country` grows country round the town from the pack's own terrain types. See Country below.

### Country

`look.country` grows country round the town (`engine/country.js`), for a pack whose terrain is `engine/hills.js`. The pack lists its terrain types as data. The engine cuts the land with their layouts, paints them into one ground texture (no draw call) and builds their 3D features into one merged mesh in three tiles. Everything comes from `seed`, and `?country=0` turns it off. A range `[a, d]` runs from `a` to `a + d`.

Top level:

| Key | Default | Meaning |
|---|---|---|
| `seed` | 1 | the country's seed |
| `px` | 4 | metres per texel of the ground texture |
| `pad` | 1000 | how far the country reaches past the city's rectangle, in metres |
| `fields` | `{ zone: 450, size: [70, 100] }` | the fields layout: field systems `zone` m across, field sides in `size`; `lane` and `verge` colours |
| `types` | none | the terrain types, in order. At least one must use the fields layout |
| `steep` | `{ slope: [.6, .45] }` | bare steep ground. From `slope[0]` rise per metre to full at `slope[0] + slope[1]` the ground turns to scree, then to rock in strata about 2.3 m thick. No field, wood, farm, hedge or item stands there. `rock` and `scree` colours default to `look.rock` (else `look.land.rock`) and that a little darker |

Layouts (`layout` in a type):

| Layout | Cuts | Keys |
|---|---|---|
| `fields` | field systems turned to the nearest road, rows, fields; lanes on the borders. A field takes the first fields type whose `where` holds at its middle, else the last | `tones`, `shade`, `marks`, `verge`, `edges`, `plots`, `clusters` |
| `blobs` | round blobs with noisy edges, painted over the fields | `from` (`fields` share at field corners, `wards` ids with `wardShare`, `spots` as `[x, z, r]`), `size`, `floor`, `mark`, `canopy`, `scatter` |
| `outline` | outlines (lists of `[x, z]`) with frayed edges, kept `keep` m off the town (default 40); fields, farms and lanes keep out | `outlines`, `floor`, `streams`, `water`, `bog`, `clearings` (`clearing`, `rim`, `knot`), `canopy`, `scatter` |

Placement (`where` in a type): bands `[low, high)` for `town` and `water` (distance in metres), `height` and `slope` (rise per metre). `jitter` scales the bands per field by up to that share. `share` keeps that share of the fields that pass.

Painters (`paint` in a mark; a field takes the first mark its `share` lets in):

| Painter | Keys |
|---|---|
| `rows` | `period` (number or range), `along` (else random), `world` (world x or z), `wave` `[metres, scale]`, `soft`, `dark` |
| `dots` | `step`, `r`, `colour`, `alpha`, `item` (an item on each dot, 3 m clear of the plot's edges) |
| `speckle` | `density`, `colour`, `alpha` |
| `patches` | `scale`, `cut`, `colour`, `alpha` |

Builders:

| Builder | Where | Keys |
|---|---|---|
| edge | `edges` in a fields type, chosen by `share` per field edge | `paint` (`colour`, `soft`, `dots` spacing, `alpha`); `ridge` (hedge or dry-stone wall: `colour`, `height`, `base`, `top`, `step`); `trees` (`item`, `step`, `keep`, `jitter`). Paint alone draws a channel |
| plots | `plots` in a fields type | `across`, `along` (plot counts), `tones`, `shade`, `marks`, `edge` (`colour`, `alpha`) |
| cluster | `clusters` in a fields type; the first whose `share` lets it in and that fits takes the field | `clump` (`r`, `colour`, `alpha`, `step`, `jitter`, `item`, with `clear`); `farm` (`walls`, `roofs`, `tree`, `yard`, `pitch`, `town`, `clear`); `module` (a pack builder) |
| canopy | `canopy` in a blobs or outline type | `grid`, `colour`, `dull`, `poke`, `dead` (`share`, `colour`) |
| scatter | `scatter` in a blobs or outline type | `step`, `share`, `inset`, `item` |
| item | inside the others | `size`, `colour`, `shape` (`tree`, `palm`, `bush`, `rock`, `cactus`), `trunk`, `lift`, `squash` |

A `module` cluster names a file in the pack, such as `kits/well.js`. Its default export builds one site into the merged mesh. It gets `{ x, z, a, y, t, on, height, tri, quad, limb, tint, item, rnd, spec }`: the site, its angle, a hash `t(k)`, `on(u, v)` for points in the site's frame, and the mesh builders.

Example, a garden type by the water:

```js
{ id: 'gardens', layout: 'fields', where: { water: [0, 240], jitter: .3 }, tones: [[.12, .26, .06, 3], [.2, .32, .08, 2]],
  edges: [{ share: .3, paint: { colour: [.05, .11, .11], soft: [.6, 1.6], alpha: .9 } }],
  plots: { across: [1, 2], along: [1, 1], tones: [[.12, .26, .06]], marks: [
    { paint: 'dots', share: .2, step: 10, r: [1.6, 3.2], colour: [.09, .17, .05], alpha: .9,
      item: { shape: 'palm', size: [3.2, 1], colour: [.09, .17, .05] } },
    { paint: 'rows', share: .6, period: 3, along: false, soft: [.3, .7], dark: .55 }] } }
```

Gareth uses it for gardens, crops, woods and the Dämonenbrache (`settings/gareth/setting.js`). `desert-test.html` (`settings/desert-test/`) is a test pack on Emberford's town with gardens, palm groves, scrub, rocks, farmsteads, wells, stony slopes and dunes.

### Towns

`gen/town.py` writes a walled town (see its header for every key). `walls: false` makes an open town: the outline still bounds the plots, but city.json has no wall and no gates, so no wall is built.

### Density, suburbs and country roads

`gen/town.py` packs a town: plots fill their frontage with 0.1 m between neighbours and run deep (28 to 46 m on main streets), and streets are narrow (`widths`, default main 7, major 5, minor 3.5). `city.json` lists the widths, so walkers keep 0.6 m inside each street's edge. `suburbs` (`length`, `clear`, `names`) lays plots along the gate roads past the wall, from `clear` metres out to `length`; each suburb is a ward `suburb-<gate bearing>`, so a pack styles and fills it like any ward, and the ground map draws only its lots, leaving the country round them. Plots keep off greens and 4 m off the river. `far` runs a country road on from each gate road's end out to that distance; `engine/hills.js` lays them over the hills (`look.land.road` colour) and keeps trees off them. A walled town writes its wall walk under `paths` with `guards` walkers (default 24) 8 m up, who walk it day and night.

`town.json` sites with `high: true` move to the highest ground within `search` metres of their bearing and distance, so Emberford's keep and church sit on their rises.

Emberford's landmarks beyond the keep, church, hall and square are generic builders in `kits/town.js`, one for every site of their kind: `chapel` (a nave with a bellcote in a walled churchyard with graves), `cross` (a market cross on steps and a pillory), `inn` (a big house round a lit courtyard with a hanging sign), `quay` (a quay wall, warehouses, a crane and goods), `windmill` (a post mill with turning sails) and `tannery` (a shed, vats and drying hides). A waterside site faces the water along its +v, so its `rot` is 90° less than its bearing. The keep's bailey holds a great hall, a stable, a chapel, a well and stores, and each gate has a barbican out at the moat.

Emberford has five lanes between each pair of gates, 519 plots, four suburbs (Eastgate, Bridge End, Westgate and Castlegate) of one-storey cottages, workshops and gardens out to 170 m past the wall, and country roads out to 3.2 km. Its house kits fill their frontage, so houses stand wall to wall.

### Boats

`boats` sails `n` boats (default 4) on each river in the city file's water (`engine/boats.js`), along its middle at `speed` metres per second (default 0.8 to 1.6), turning back at its ends. `parts` are their boxes as `[sx, sy, sz, x, y, z, [r, g, b]]`, by default a barge with a cabin, a mast and a sail. Emberford sets four.

### Rivers

`rivers` lists rivers that run downhill (`engine/rivers.js`). Each is a line from source to mouth with a water height and a width at each point. The engine draws it as a sloped ribbon in the lakes' water look whose ripples, glints and streaks run downstream, faster where the line is steeper. Where the line drops more than it runs, and more than 2 m, it draws a waterfall: a falling sheet with streaks, mist at its foot, foam on the pool below, and rock at the lip in broken strata with a talus apron and boulders, in `look.rock` (else `look.land.rock`). A pack without `rivers` keeps its flat water.

| Key | Default | Meaning |
|---|---|---|
| `water` | none | take the line from the city file's water of this name, a band of near bank then far bank back. The river replaces that flat outline; bridges and the street plan still use the outline |
| `reverse` | false | the band's first point is the mouth, not the source |
| `y` | 0.12 | the band's water height: a number, or keys `[[f, y], …]` by share `f` of the length |
| `head` | none | `[[x, z, y, w], …]` points upstream of the band's source, source first: position, water height and width in metres |
| `line` | none | `[[x, z, y, w], …]` a river of its own points instead of a band |
| `speed` | 0.5 | the current in metres a second on level water; it grows with the slope, up to 6 |
| `scarp` | 6 × width | half the length of the cliff a fall cuts across the land |
| `spring` | true for a `head` or `line` source | the source is a spring: the river starts as a stream a third as wide and a third as deep and widens over four widths. A source inside still water or an earlier river is fed and never a spring |

```js
rivers: [{ water: 'River Ember', speed: .6, head: [
  [900, 830, 30.5, 22], [745, 712, 28.4, 26], [712, 690, 28, 26],   // on the tableland, to the lip
  [702, 683, 1.2, 30], [680, 668, 1.1, 46],                         // the fall, then a wide pool
  [615, 600, .5, 32], [552, 525, .12, 28]] }],                       // down to the town's river
```

- City-file water that no river names and the moat stay flat still water. A river's stretch inside still water or inside an earlier river in the list is not drawn, so a lake or the main river shows there. List the main river first.
- With `engine/hills.js`, the land follows the river. Where the land stands above the water, the river cuts a bed 1.5 m deep and at least 20 m wide. Past either end of the line the bed rises 0.3 m a metre, so a cut ends as the head of a dry valley, not a bowl. Where the water stands 0.3 to 3 m above the land, low banks rise beside it. Land a little below the water keeps its height, so a river level with a town's flat ground changes nothing there. Upstream of each fall a tableland rises to the river's highest water, its front a cliff 18 m behind the lip. Without `look.country`, ground steeper than 1 in 1 shows the land's rock colour; with it, the country's `steep` rule paints the cliffs.
- Boats sail each reach between falls, carried by the current, and turn 15 m short of a lip. Country fields and trees keep off the rivers.
- All rivers draw in one draw call. Falls add one each for the sheets, the mist and the rock.

### Relief and terraces

`town.json`'s `relief` gives a town the lie of the land; `gen/town.py` copies it into `city.json`, and `engine/relief.js` reads it. It is a list of `hills`, each `{ at: [x, z], r, h }`, a smooth rise of `h` metres over radius `r` (negative `h` for a hollow). `shape: "mound"` gives a flat top over the inner share `top` (default 0.55) and steep sides, as a castle motte. On a relief:

- every lot is a level platform at its centre's height rounded to a band of `terrace` metres (default 1.5), so neighbouring lots on one band share a level and terraces run along the contours. Battered stone retaining walls, 0.5 m thick at the top and 1.8 m at the foot, hold each platform where it meets the slope (`look.groundMap.wall` sets their colour), and a flight of steps leads from each raised or sunk lot to its street through an opening in the wall
- the centre square and each site in `city.json` are platforms that blend into the slope over 14 m
- streets and open ground follow the relief. The ground map draws steep lanes, steeper than about 1 in 5, as steps every 20 cm of height
- `gen/town.py` bends the cross lanes between the radial lanes along the contours
- the ground map's surface is a grid of `look.groundMap.mesh` metres (default 1.25), laid on the ground in 48 m tiles near the wards and streets, so a relief needs a ground map. Far from the camera the grid merges cells: `look.groundMap.lod` lists `[from metres, cells merged]` levels (default `[[700, 2], [1600, 4]]`; a count that does not divide a tile's cells drops to one that does). A tile keeps every cell where merging would move the ground more than `lodError` metres (default 0.5), so lot platforms, retaining walls and banks stay exact. Skirts under the tile edges close the gaps between levels
- every instanced part, kit group, label, car and person stands on the ground at its own spot
- fields are draped over the slope, the hills module adds the relief to its own hills and sinks under the town, and the orbit's target rides on the ground

- `moat` (`offset` 9, `width` 12, `depth` 4, `water` 2) digs a flat-bottomed ditch round the outside of the town wall. Water lies in it up to `water` metres above its lowest point, so on a hill town only the low stretches hold water. A bridge spans it at every gate, level with its banks.
- where a street crosses the city file's water, a bridge spans it 3 m past each bank, humping `hump` metres (default 2.5) at its middle, with parapets and piers. On a bridge the ground height is the deck, so people, carts and lamps cross on it.
- `town.json`'s `roads` sets a road length per gate, by bearing, so a gate road can run on to a river.

Emberford's town hill rises about 25 m from the south wall to the square, then steeply to the keep on a 13 m motte. Its moat holds water along the low south side and runs dry up the hill. Its south road crosses the River Ember on a humped bridge, and Ember Mill stands on the bank with a turning water wheel. Its town wall goes up in sunk pieces of at most 6 m, so it steps with the ground. A city file without a relief is flat, as New Angeles.

### Block zones

`kits.blockZones(Z)` returns the zones in the order they pick blocks. `Z` holds `districts`, `districtZone(d)`, `ringRank`, `allows(b, zone, blend)`, `vnoise`, `megaHousing`, `tune` (the city dials) and `inCentre(b)`. A zone is `{ zone, cap(), gap, minSide, test(b, blend), rank(b), builders, tunnel }`. With `tunnel: true` a zone may take a block that only a maglev crosses. Its kit then tunnels, or one major block in the site's style replaces the boxes the line crosses. Failing both, the kit moves into the part of the block one straight cut keeps clear of the line, when that part is still `siteMin` wide. When none of these fits, the zone tries its next block. Kit files add builders to a zone through `blocks(H)`.

### Station kits

`transport.maglev.stations(A, { HALF, LEN, SIDES, along })` returns one kit per district id: `{ deck, edge, sign, board, build(r) }`. `A` draws in the station frame: `box`, `cyl`, `cone`, `glw`, `ball`, `beam`, `text`, `puff`, `blink`, `ring`.

### Audio guide moves

`audio.moves(E)` returns camera moves by cue verb. `E` holds `V`, `mix`, `ease`, `smooth`, `CENTRE`, `WIDE_T`, `camera`, `find(name)` and `landmark` (the centre module's api). A move is `c => ({ blend, pod, pose(e, C, T, P) })`, as in `settings/new-angeles/moves.js`. The engine keeps the generic moves `sky`, `orbit`, `pan`, `dolly` and `spiral`.

### Dungeons

`engine/under.js` builds dungeons below a city for a pack layer. `dungeon(opts)` returns a builder `D`; the layer module builds with it and calls `D.bake()` once, then passes `update` on to `D.update`. Nuremberg's `catacombs.js` is the example.

- Building: `room`, `tunnel`, `cavern`, `wall`, `box`, `cyl`, `floor`, `floorPoly`, `stairs`, `shaft`, `arch`, `slab`, `water`, `glow`
- Light: `torch`, `brazier`, `candle`, `flame`, `light` (`flicker: 0` for steady light)
- Own geometry: `geo(geometry, mat)` merges any three.js geometry into the lit stone; `mat(colour)` and `add(mesh)` for moving meshes; `tick(fn)` animates them
- `frame(x, z, rot, fn)` moves and turns everything built inside `fn`
- Materials: ashlar, rubble, brick, rock, flag, dirt, wood, iron, bone, gold, water, glow, plaster, moss, cloth
- Rooms and tunnels have no ceilings, so the map looks down into them
- `bake()` adds up the light of every torch at every vertex. The shader flickers it by the phase of each vertex's brightest torch

A dungeon layer hides the town with a deep `clip` (-1e4) and cuts the dungeon above its own `cut`. Built-in three.js materials keep to the town's clip and vanish, so a moving mesh uses `D.mat`. `floor` sets the orbit target's height, or its depth under the ground with `follow`. `labels: [lo, hi]` shows the names whose height lies between.

`cards` names a card file in the pack, keyed like `cards.landmarks`. A `D.label` whose card key has a card in it opens that card: the label is a link, the search box finds the card under Underground, and the card opens on the label's level, the layer of the same module whose `labels` band holds it. The card key is the label's text; `D.label(...).card = 'Key'` points a side label at another place's card. Layers that share a module need the same file. A layer without `cards` keeps plain labels. The card closes when the view changes level, and a surface card closes when the view goes underground.

## What a pack cannot change yet

- `gen/gen.ts` only generates New Angeles, and `gen/town.py` walled towns. Another kind of city needs its own generator that writes the same city file.
- Each setting's page is a copy of the page markup, with its own title, loading logo, welcome and help texts. A change to the shared markup goes into every page, and `gen/check-pages.mjs` lists any element the engine reads that a page lacks.
