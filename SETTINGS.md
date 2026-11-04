# Setting packs

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

The generator fills the blocks with infill lanes every 38 m or less and lays 3,736 plots. Its kits build burgher houses with a sandstone ground floor, stone, plaster or timber floors above, steep roofs with hoist dormers, Chörlein oriels and back houses across small courts. Emberford's houses and yards fill out the mix through `parts()` and `kits()` of `settings/emberford/kits/town.js`. Its landmarks are the Kaiserburg, St. Sebald, St. Lorenz, the Frauenkirche, the Schöner Brunnen, the Altes Rathaus, the Heilig-Geist-Spital on arches over the river, the Weinstadel, the Mauthalle, the Nassauer Haus, the Dürer-Haus, three smaller churches, two inner gate towers, the Schuldturm, two inns, and the double wall with its moat and the four great round towers. It shares Emberford's light and clock.

```bash
python3 spikes/map/gen/town.py spikes/map/settings/nuremberg
```

## Make a new pack

1. Copy `settings/sandbox/` to `settings/<id>/` and change the values. Add the optional fields below as the setting needs them. `settings/new-angeles/setting.js` shows every field in use.
2. Write a city file with the shape `gen/gen.ts` writes: `dims`, `origin`, `placeHalf`, `districts`, `streets` (`main`, `major`, `minor`), `lots` and `blocks`. Optional lists are `root` (the centre point), `highways`, `maglev` (a loop of three or more points), `spurs`, `lines`, `rings`, `water`, `parks`, `coast`, `quarters`, `subareas`, `places` and `keep` (`[x, z, r]` circles that hold the frayed edge solid). Name the file in `data.city`.
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
| `map` | `{ cx, cy, scale }`: a map pixel `[u, v]` lands at `((u - cx) * scale, (v - cy) * scale)` metres. `gen/gen.ts` imports New Angeles' `map.js`, so the city file agrees |
| `centre` | optional. The central landmark. `district` (its blocks take the ring zone), `radius` (plaza kept clear), `top` and `pinLift` (pin), `boost` (towers rise near it), `highwayReach`, `glow` (plaza ring colour), `module` (optional landmark module), `lore` (its key in the landmark cards), `fade` (box an audio-tour gaze thins out), `place` (its card) |
| `terrain` | optional module that replaces the flat ground, the slab and the sea. `'../../engine/hills.js'` gives rolling hills with woods, tuned in `look.land` |
| `camera` | `fov`, `near`, `far`, start `position` and `target`, `maxPolar` (share of pi), `minDistance`, `maxDistance`, `tourDistance`, `groundReach`, `edit` (first edit-mode view) |
| `scale` | `detail` (prop range per quality level), `tile`, `layerTop`, `labels` (fade ranges and heights), `fogZoom`, `traffic` (draw ranges), `city` (block, lot, seat, lamp and filler sizes in metres; see below) |
| `look` | `fog`, `fogStart`, `fogBase`, `mist`, `hemi`, `moon`, `bloom`, `flicker`, `searchlight`, `cardColor`, `ground` colours, `tune` (tuning panel defaults), `decor` (engine decoration switches), `lamps` (street-lamp heights and post), `land` (hills colours), `clouds` (cloud decks), `water` (water's base colour) |
| `styles` | `axis` (two end styles), `styles` (one per district id), `quarters`, `cores` (density cores), `blend`, `tierAlias`, `helpers` (extra names on `H`), `wallSkins` (default skins of `bld()`), `slots` (tower-grammar slots it replaces) |
| `kits` | `families`, `districts` (families that own a district's tiers), `finds` (landmark families with card files), `private`, `smallLots`, `landUse(helpers)`, `blockZones(helpers)`, `cityTune` (tuning panel rows, whose defaults the first build uses), `tune` (starting values for the engine's city dials: cores, grain, skew, small, needles, needleTop, shapes), `ownTiers` (district ids whose tiers a shared family replaces) |
| `transport` | `cars`, and optional `highway`, `hover` and `maglev` (heights, names, `centreStation`, `centreMusic`, `stops`, `stations(A, frame)`, `defaultStation`, `tours`). A traffic slider shows only for traffic the setting has. Only a route with a station runs a train |
| `audio` | optional. `episodes`, `moves(helpers)`, `labels`, `centreGaze`. Without episodes the Tours tab and the welcome card's tour button hide |
| `walks` | optional walking tours, each `{ title, summary, stops: [{ slug, h, text }] }`. A stop's slug names a place card, a landmark (its label, slugged) or a district id. They show under Tours and play in the stop-by-stop tour panel |
| `cards` | `districts` and `landmarks` card files. Each find family adds `content/<family>.json`. `site: true` says the places have pages and images on the archive site |
| `layers` | optional extra layers, each `{ module, clip, mistBase }`. The module exports `group`, `labels` and `build()` |

### Styles

A style holds `h0`, `h1`, `density`, `neon`, `lit`, `grime`, `w` and the colours `base`, `win`, `street`, plus `signs` (a palette), `tiers` (kit names from low to high density) and `zones` (block zones it allows). Optional: `yardKit`, `yardBlocks` (the yard kit also fills every block that holds no lots), `fillKit`, `noFill`, `blockCap`, `blockGap`, `blockMin`, `smallShare`. `w` places the style between the two axis ends. The engine's own buildings read the axis ends for window colours and sign palettes.

### Buildings and decoration

- **Skins.** `H.SKINS` holds five window skins for towers (`grid`, `bands`, `fins`, `curtain`, `sparse`) and five material skins: `plaster`, `timber`, `stone` for walls, `tile` and `thatch` for roofs. Material skins draw small shuttered windows that light sparsely and skip floor bands, glass and edge glow. Seven more material skins serve old towns: `ashlar` (coursed sandstone), `rubble`, `braced` (timber frame with cross braces), `redframe` (red-painted timber frame), `quoins` (plaster with stone corners and window surrounds), and `slate` and `tiles` for roofs. `blindAshlar` and `blindRubble` draw ashlar and rubble without windows, for churches, walls and towers.
- **Roofs.** `bld(…, { shape: 'gable', skin: H.SKINS.tile, base: [r, g, b] })` builds a pitched roof with its ridge along local x. `base` gives the roof its own colour.
- **Defaults.** `styles.wallSkins` sets the skins `bld()` uses when a kit names none, and `styles.slots.skin` the skins the tower grammar and the engine's infill pick.
- **Decoration.** `look.decor` switches off engine decoration: `roof` (rooftop plant, tanks, masts, dishes), `kibble` (facade boxes), `neon`, `signs`, `holo`, `helipads`, `beacons` `markings` (road centre dashes), `harvesters` and `fieldExtras` (fish ponds and greenhouses on fields). Each defaults to on, and a switch also silences kit calls to that helper.
- **Frayed edge.** `look.edge` (metres) frays the city's outer edge, so it ends on a ragged line up to that far in. Ground, blocks, lots, lamps and streets stop at the line, and lots thin out near it. Borders between districts and the coast stay solid, and so does the ground round landmarks and places. `edgeAt(x, z)` in `engine/edge.js` tells a pack module where the line runs, for example to grow forest into it. Off by default.
- **Lamps.** `look.lamps` sets `main` and `minor` lamp heights, and `post` gives each lamp a post of that colour. `flicker` (a share such as `.75`) makes each lamp waver down to that share of its light, like a flame.

### Lighting

- `look.buildingLight` lights the building shader: `dir` (light direction), `colour` (light colour, above 1 for daylight), and `base`, `up` and `sun`, the shares of base light, light from straight up and light from `dir`. The defaults are the engine's night values.
- `look.shadows` turns on sun shadows from `look.buildingLight.dir`: `size` (shadow map side in pixels, default 2048), `reach` (largest half width of the shadowed square round the view, default 700 m) and `strength` (how far shadow darkens the unlit street and plaza surface, default 0.55). Buildings, kit props, trees and the hills cast; unlit materials, the ground and moving trains do not. Every lit material (kit props, stalls, trees, grass, lots, the hills) loses its direct light in shadow and keeps its sky light, so things shade each other and themselves. Buildings lose the sun share of their light in shadow, so for walls turned away from the sun to look as dark as the ground's shadows, most of `buildingLight` should be `sun` rather than `base`. With shadows on, building normals also take the inverse of the building's scale, so stretched roof slopes are lit correctly. The map follows the view and redraws when it moves, so traffic casts no shadow unless `live` is true, which redraws it every frame at the cost of drawing the casters once more per frame. `soft` makes edges soften with distance from their caster, sharp at a wall's foot and blurred at the shadow's tip (PCSS): it is the penumbra in metres for each metre between caster and ground (0 keeps hard edges; Emberford uses 0.06), up to `blur` metres (default 4). Without `look.shadows` no shader carries the shadow code, as in New Angeles. Emberford's `?look=day` sets it.
- `look.ao` darkens creases from the scene's depth: wall feet, narrow lanes and eaves. `radius` (metres, default 2.5), `strength` (default 0.7) and `reach` (fades out by this distance, default 500 m). It is off at low quality. Emberford's `?look=day` sets it.
- `look.sky` is a sky gradient, `[zenith, horizon, below]` as hex colours. Without it the sky is the fog colour.
- `look.clock` lights the map by the hour (`engine/daylight.js`). Its `keys` are keyframes `{ at: hour, … }` that set the sky gradient, fog, sky light (`hemi`), sun or moon light (`light`), building light (`building`), street brightness (`ground`), water colour, shadow darkness (`shade`) and the window, lantern, bloom, exposure, fog and mist values in `tune`. A field a keyframe leaves out comes from `look`. The clock blends the two keyframes round the hour, eased, wrapping past midnight. `sun` sets sunrise and sunset (`rise`, `set`, in hours), the highest sun and moon (`peak`, `moon`, in degrees) and the sun's direction at midday (`noon`, `[x, z]`, by default the building light's). The sun or moon gives the light its direction, so shadows turn and lengthen through the day, and its light fades out near the horizon. `start` is the opening hour (`?time=HH:MM` overrides it) and `cycle` the minutes for a whole day, 0 to hold the hour (`?cycle=<minutes>` overrides it). The tuning panel's Time tab moves both. While the hour moves, it sets the Light sliders it covers. A pack with a clock also shows the hour in a slider above Smooth edges, kept in step with the Time tab, with a button that runs the day (four minutes a day unless `cycle` says otherwise) or stops it. The clock runs unless `?look=` picks a mode. Under a clock, `look` holds the daylight colours of the ground and land, and the night comes from the keyframes' low light. Under a clock the sky is a dome that blends the keyframe's `sky` colours by height, with haze round the sun, a glow on the horizon below a low sun, and stars that come out over the first hour and a half of night. The sun and moon also show in the sky as glows along the light, hidden by hills and passed over by clouds. The camera's tilt limit means the sun is in view only when low, near sunrise and sunset. Cloud tops take the hour's sun and sky light and brighten round the sun, their underside glow from the town follows the windows, and the glint on water takes the light's colour.
- `look.modes` holds named lighting modes. `?look=<mode>` lays that mode over `look`: nested objects such as `tune`, `lamps` and `ground` merge key by key, and other values replace the pack's own. The sandbox has `?look=day`.
- Window light, edge glow, neon, street lights, light pools and bloom are `look.tune` values, so a mode can turn them down for day. `look.tune.cars` and `look.tune.speed` set the traffic sliders' defaults, such as a few slow carts. `transport.cars.lit` lights the cars by the sun and the sky instead of drawing them flat, so they take shadows; a part whose colour passes 1 is a lamp and glows while the windows are lit.

### People

`people` puts townsfolk on foot (`engine/people.js`). `walk` sets walkers per 100 m of street (default 3). They stroll at `side` metres from the street's middle (`[minor, other]`, default `[2.6, 3.6]`) and turn back at a street's end. `crowds` lists groups: `{ at: [x, z], ring, n }` stand on a ring facing out, as at stalls round a square, and `{ at: [x, z], r, n }` stand and sway inside a circle. `clothes` and `skin` are lists of `[r, g, b]` to pick from. Under a clock all are out by day and the `night` share (default 0.15) at night. They are lit, and cast shadows when `look.shadows.live` is on. Emberford sets 8 walkers per 100 m, a ring of 45 at the stalls and 25 in the middle of the square.

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
- `look.groundMap` replaces the flat street and lot surfaces with one detailed, lit ground (`engine/groundmap.js`). The engine paints the town plan into a texture at `px` metres per texel (default 0.75): paved streets (`paved`, street kinds and their widths, default `{ main: 7, major: 5 }`), the square and the footprints of the site kinds in `pavedSites`, the lots, a trodden track down every street (`track` metres wide, default 3.5) and the town's extent with every street, so roads run on out of the gates. The shader draws cobbles with dark joints on paving (`cell` metres, default 0.38), packed earth with a lighter worn track and puddles on lanes, grassy verges along the lot edges with a few tufts, earth yards with patches of grass, a dark gutter along each edge of the paving, wheel ruts along the trodden track, and mud with puddles round the gates and the centre's well (`mud` adds more spots as `[x, z, radius]`), each in its colour (`cobble`, `earth`, `yard`, `grass`). Mask edges wander with noise, and detail smaller than a pixel fades to its average. It takes sun, sky light and shadows, and draws nothing outside the town. Emberford paves its gate streets and square, and its `?look=night` mode sets darker colours. Nuremberg paves every street, its squares and the ground round its landmarks.

### Towns

`gen/town.py` writes a walled town (see its header for every key). `walls: false` makes an open town: the outline still bounds the plots, but city.json has no wall and no gates, so no wall is built.

### Density, suburbs and country roads

`gen/town.py` packs a town: plots fill their frontage with 0.1 m between neighbours and run deep (28 to 46 m on main streets), and streets are narrow (`widths`, default main 7, major 5, minor 3.5). `city.json` lists the widths, so walkers keep 0.6 m inside each street's edge. `suburbs` (`length`, `clear`, `names`) lays plots along the gate roads past the wall, from `clear` metres out to `length`; each suburb is a ward `suburb-<gate bearing>`, so a pack styles and fills it like any ward, and the ground map draws only its lots, leaving the country round them. Plots keep off greens and 4 m off the river. `far` runs a country road on from each gate road's end out to that distance; `engine/hills.js` lays them over the hills (`look.land.road` colour) and keeps trees off them. A walled town writes its wall walk under `paths` with `guards` walkers (default 24) 8 m up, who walk it day and night.

`town.json` sites with `high: true` move to the highest ground within `search` metres of their bearing and distance, so Emberford's keep and church sit on their rises.

Emberford's landmarks beyond the keep, church, hall and square are generic builders in `kits/town.js`, one for every site of their kind: `chapel` (a nave with a bellcote in a walled churchyard with graves), `cross` (a market cross on steps and a pillory), `inn` (a big house round a lit courtyard with a hanging sign), `quay` (a quay wall, warehouses, a crane and goods), `windmill` (a post mill with turning sails) and `tannery` (a shed, vats and drying hides). A waterside site faces the water along its +v, so its `rot` is 90° less than its bearing. The keep's bailey holds a great hall, a stable, a chapel, a well and stores, and each gate has a barbican out at the moat.

Emberford has five lanes between each pair of gates, 519 plots, four suburbs (Eastgate, Bridge End, Westgate and Castlegate) of one-storey cottages, workshops and gardens out to 170 m past the wall, and country roads out to 3.2 km. Its house kits fill their frontage, so houses stand wall to wall.

### Boats

`boats` sails `n` boats (default 4) on each river in the city file's water (`engine/boats.js`), along its middle at `speed` metres per second (default 0.8 to 1.6), turning back at its ends. `parts` are their boxes as `[sx, sy, sz, x, y, z, [r, g, b]]`, by default a barge with a cabin, a mast and a sail. Emberford sets four.

### Relief and terraces

`town.json`'s `relief` gives a town the lie of the land; `gen/town.py` copies it into `city.json`, and `engine/relief.js` reads it. It is a list of `hills`, each `{ at: [x, z], r, h }`, a smooth rise of `h` metres over radius `r` (negative `h` for a hollow). `shape: "mound"` gives a flat top over the inner share `top` (default 0.55) and steep sides, as a castle motte. On a relief:

- every lot is a level platform at its centre's height rounded to a band of `terrace` metres (default 1.5), so neighbouring lots on one band share a level and terraces run along the contours. Battered stone retaining walls, 0.5 m thick at the top and 1.8 m at the foot, hold each platform where it meets the slope (`look.groundMap.wall` sets their colour), and a flight of steps leads from each raised or sunk lot to its street through an opening in the wall
- the centre square and each site in `city.json` are platforms that blend into the slope over 14 m
- streets and open ground follow the relief. The ground map draws steep lanes, steeper than about 1 in 5, as steps every 20 cm of height
- `gen/town.py` bends the cross lanes between the radial lanes along the contours
- the ground map's surface is a grid of `look.groundMap.mesh` metres (default 1.25) over the wards, laid on the ground, so a relief needs a ground map
- every instanced part, kit group, label, car and person stands on the ground at its own spot
- fields are draped over the slope, the hills module adds the relief to its own hills and sinks under the town, and the orbit's target rides on the ground

- `moat` (`offset` 9, `width` 12, `depth` 4, `water` 2) digs a flat-bottomed ditch round the outside of the town wall. Water lies in it up to `water` metres above its lowest point, so on a hill town only the low stretches hold water. A bridge spans it at every gate, level with its banks.
- where a street crosses the city file's water, a bridge spans it 3 m past each bank, humping `hump` metres (default 2.5) at its middle, with parapets and piers. On a bridge the ground height is the deck, so people, carts and lamps cross on it.
- `town.json`'s `roads` sets a road length per gate, by bearing, so a gate road can run on to a river.

Emberford's town hill rises about 25 m from the south wall to the square, then steeply to the keep on a 13 m motte. Its moat holds water along the low south side and runs dry up the hill. Its south road crosses the River Ember on a humped bridge, and Ember Mill stands on the bank with a turning water wheel. Its town wall goes up in sunk pieces of at most 6 m, so it steps with the ground. A city file without a relief is flat, as New Angeles.

### Block zones

`kits.blockZones(Z)` returns the zones in the order they pick blocks. `Z` holds `districts`, `districtZone(d)`, `ringRank`, `allows(b, zone, blend)`, `vnoise`, `megaHousing`, `tune` (the city dials) and `inCentre(b)`. A zone is `{ zone, cap(), gap, minSide, test(b, blend), rank(b), builders }`. Kit files add builders to a zone through `blocks(H)`.

### Station kits

`transport.maglev.stations(A, { HALF, LEN, SIDES, along })` returns one kit per district id: `{ deck, edge, sign, board, build(r) }`. `A` draws in the station frame: `box`, `cyl`, `cone`, `glw`, `ball`, `beam`, `text`, `puff`, `blink`, `ring`.

### Audio guide moves

`audio.moves(E)` returns camera moves by cue verb. `E` holds `V`, `mix`, `ease`, `smooth`, `CENTRE`, `WIDE_T`, `camera`, `find(name)` and `landmark` (the centre module's api). A move is `c => ({ blend, pod, pose(e, C, T, P) })`, as in `settings/new-angeles/moves.js`. The engine keeps the generic moves `sky`, `orbit`, `pan`, `dolly` and `spiral`.

## What a pack cannot change yet

- `gen/gen.ts` only generates New Angeles, and `gen/town.py` walled towns. Another kind of city needs its own generator that writes the same city file.
- Each setting's page is a copy of the page markup, with its own title, loading logo, welcome and help texts. A change to the shared markup goes into every page, and `gen/check-pages.mjs` lists any element the engine reads that a page lacks.
