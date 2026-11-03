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

`settings/emberford/` is a full second setting: a walled market town on a river, lantern-lit at night, at `spikes/map/emberford.html` (`?look=day` for daylight). `gen/town.py` writes its `city.json` from `town.json`: the wall, gates, streets, plots, wards, sites for the landmarks, greens and the river. Its one kit family, `kits/town.js`, builds burgage houses that front their street, and the keep, church, market hall, square and town wall as free landmarks on the sites. It has a walking tour and card texts. Like the sandbox, it stays off the live site and ships in the public copy.

Regenerate the town after changing `town.json`:

```bash
python3 spikes/map/gen/town.py spikes/map/settings/emberford
```

## Make a new pack

1. Copy `settings/sandbox/` to `settings/<id>/` and change the values. Add the optional fields below as the setting needs them. `settings/new-angeles/setting.js` shows every field in use.
2. Write a city file with the shape `gen/gen.ts` writes: `dims`, `origin`, `placeHalf`, `districts`, `streets` (`main`, `major`, `minor`), `lots` and `blocks`. Optional lists are `root` (the centre point), `highways`, `maglev` (a loop of three or more points), `spurs`, `lines`, `rings`, `water`, `parks`, `coast`, `quarters`, `subareas` and `places`. Name the file in `data.city`.
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
| `data` | `city`, `seats` (edit-mode seats, `places.json`), `summaries` (one-line district texts for the atlas), relative to the map root |
| `map` | `{ cx, cy, scale }`: a map pixel `[u, v]` lands at `((u - cx) * scale, (v - cy) * scale)` metres. `gen/gen.ts` imports New Angeles' `map.js`, so the city file agrees |
| `centre` | optional. The central landmark. `district` (its blocks take the ring zone), `radius` (plaza kept clear), `top` and `pinLift` (pin), `boost` (towers rise near it), `highwayReach`, `glow` (plaza ring colour), `module` (optional landmark module), `lore` (its key in the landmark cards), `fade` (box an audio-tour gaze thins out), `place` (its card) |
| `terrain` | optional module that replaces the flat ground, the slab and the sea. `'../../engine/hills.js'` gives rolling hills with woods, tuned in `look.land` |
| `camera` | `fov`, `near`, `far`, start `position` and `target`, `maxPolar` (share of pi), `minDistance`, `maxDistance`, `tourDistance`, `groundReach`, `edit` (first edit-mode view) |
| `scale` | `detail` (prop range per quality level), `tile`, `layerTop`, `labels` (fade ranges and heights), `fogZoom`, `traffic` (draw ranges), `city` (block, lot, seat, lamp and filler sizes in metres; see below) |
| `look` | `fog`, `fogStart`, `fogBase`, `mist`, `hemi`, `moon`, `bloom`, `flicker`, `searchlight`, `cardColor`, `ground` colours, `tune` (tuning panel defaults), `decor` (engine decoration switches), `lamps` (street-lamp heights and post), `land` (hills colours), `clouds` (cloud decks), `water` (water's base colour) |
| `styles` | `axis` (two end styles), `styles` (one per district id), `quarters`, `cores` (density cores), `blend`, `tierAlias`, `helpers` (extra names on `H`), `wallSkins` (default skins of `bld()`), `slots` (tower-grammar slots it replaces) |
| `kits` | `families`, `districts` (families that own a district's tiers), `finds` (landmark families with card files), `private`, `smallLots`, `landUse(helpers)`, `blockZones(helpers)`, `cityTune` (tuning panel rows, whose defaults the first build uses), `ownTiers` (district ids whose tiers a shared family replaces) |
| `transport` | `cars`, and optional `highway`, `hover` and `maglev` (heights, names, `centreStation`, `centreMusic`, `stops`, `stations(A, frame)`, `defaultStation`, `tours`). A traffic slider shows only for traffic the setting has. Only a route with a station runs a train |
| `audio` | optional. `episodes`, `moves(helpers)`, `labels`, `centreGaze`. Without episodes the Tours tab and the welcome card's tour button hide |
| `walks` | optional walking tours, each `{ title, summary, stops: [{ slug, h, text }] }`. A stop's slug names a place card, a landmark (its label, slugged) or a district id. They show under Tours and play in the stop-by-stop tour panel |
| `cards` | `districts` and `landmarks` card files. Each find family adds `content/<family>.json`. `site: true` says the places have pages and images on the archive site |
| `layers` | optional extra layers, each `{ module, clip, mistBase }`. The module exports `group`, `labels` and `build()` |

### Styles

A style holds `h0`, `h1`, `density`, `neon`, `lit`, `grime`, `w` and the colours `base`, `win`, `street`, plus `signs` (a palette), `tiers` (kit names from low to high density) and `zones` (block zones it allows). Optional: `yardKit`, `fillKit`, `noFill`, `blockCap`, `blockGap`, `blockMin`, `smallShare`. `w` places the style between the two axis ends. The engine's own buildings read the axis ends for window colours and sign palettes.

### Buildings and decoration

- **Skins.** `H.SKINS` holds five window skins for towers (`grid`, `bands`, `fins`, `curtain`, `sparse`) and five material skins: `plaster`, `timber`, `stone` for walls, `tile` and `thatch` for roofs. Material skins draw small shuttered windows that light sparsely and skip floor bands, glass and edge glow.
- **Roofs.** `bld(…, { shape: 'gable', skin: H.SKINS.tile, base: [r, g, b] })` builds a pitched roof with its ridge along local x. `base` gives the roof its own colour.
- **Defaults.** `styles.wallSkins` sets the skins `bld()` uses when a kit names none, and `styles.slots.skin` the skins the tower grammar and the engine's infill pick.
- **Decoration.** `look.decor` switches off engine decoration: `roof` (rooftop plant, tanks, masts, dishes), `kibble` (facade boxes), `neon`, `signs`, `holo`, `helipads`, `beacons` `markings` (road centre dashes), `harvesters` and `fieldExtras` (fish ponds and greenhouses on fields). Each defaults to on, and a switch also silences kit calls to that helper.
- **Frayed edge.** `look.edge` (metres) frays the city's outer edge, so it ends on a ragged line up to that far in. Ground, blocks, lots, lamps and streets stop at the line, and lots thin out near it. Borders between districts and the coast stay solid, and so does the ground round landmarks and places. `edgeAt(x, z)` in `engine/edge.js` tells a pack module where the line runs, for example to grow forest into it. Off by default.
- **Lamps.** `look.lamps` sets `main` and `minor` lamp heights, and `post` gives each lamp a post of that colour. `flicker` (a share such as `.75`) makes each lamp waver down to that share of its light, like a flame.

### Lighting

- `look.buildingLight` lights the building shader: `dir` (light direction), `colour` (light colour, above 1 for daylight), and `base`, `up` and `sun`, the shares of base light, light from straight up and light from `dir`. The defaults are the engine's night values.
- `look.sky` is a sky gradient, `[zenith, horizon, below]` as hex colours. Without it the sky is the fog colour.
- `look.modes` holds named lighting modes. `?look=<mode>` lays that mode over `look`: nested objects such as `tune`, `lamps` and `ground` merge key by key, and other values replace the pack's own. The sandbox has `?look=day`.
- Window light, edge glow, neon, street lights, light pools and bloom are `look.tune` values, so a mode can turn them down for day. `look.tune.cars` and `look.tune.speed` set the traffic sliders' defaults, such as a few slow carts.

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

### Towns

`gen/town.py` writes a walled town (see its header for every key). `walls: false` makes an open town: the outline still bounds the plots, but city.json has no wall and no gates, so no wall is built.

### Block zones

`kits.blockZones(Z)` returns the zones in the order they pick blocks. `Z` holds `districts`, `districtZone(d)`, `ringRank`, `allows(b, zone, blend)`, `vnoise`, `megaHousing`, `tune` (the city dials) and `inCentre(b)`. A zone is `{ zone, cap(), gap, minSide, test(b, blend), rank(b), builders }`. Kit files add builders to a zone through `blocks(H)`.

### Station kits

`transport.maglev.stations(A, { HALF, LEN, SIDES, along })` returns one kit per district id: `{ deck, edge, sign, board, build(r) }`. `A` draws in the station frame: `box`, `cyl`, `cone`, `glw`, `ball`, `beam`, `text`, `puff`, `blink`, `ring`.

### Audio guide moves

`audio.moves(E)` returns camera moves by cue verb. `E` holds `V`, `mix`, `ease`, `smooth`, `CENTRE`, `WIDE_T`, `camera`, `find(name)` and `landmark` (the centre module's api). A move is `c => ({ blend, pod, pose(e, C, T, P) })`, as in `settings/new-angeles/moves.js`. The engine keeps the generic moves `sky`, `orbit`, `pan`, `dolly` and `spiral`.

## What a pack cannot change yet

- `gen/gen.ts` only generates New Angeles, and `gen/town.py` walled towns. Another kind of city needs its own generator that writes the same city file.
- Each setting's page is a copy of the page markup, with its own title, loading logo, welcome and help texts. A change to the shared markup goes into every page, and `gen/check-pages.mjs` lists any element the engine reads that a page lacks.
