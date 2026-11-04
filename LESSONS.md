# Building a world kit: lessons learned

This guide is for an AI that builds or extends a setting pack for this engine: a city like New Angeles, a town like Emberford, or a real place like Nuremberg around 1500. It collects what the first four days of commits (2026-11-01 to 2026-11-04, about 160 commits) taught, mostly through mistakes that had to be fixed. Each lesson ends with the commits that show it, so `git show <sha>` gives the full story.

Read `MODULES.md` (files and tools) and `SETTINGS.md` (every pack field) alongside this. The design notes in `design/` hold the longer write-ups: `performance-2026-11-01.md`, `infill-2026-11-02.md`, `districts-plan.md` and the build briefs.

## 1. Work in a loop you can trust

**Prove the old setting is unchanged before you change the engine.** `gen/regress.mjs` captures nine fixed views of New Angeles from the working tree and from a git ref, and compares draw calls, pixels, labels, build stats, ride tours and console errors. It freezes the clock, seeds `Math.random`, gives three.js UUIDs their own random stream and pumps animation frames itself, so two captures of one tree match pixel for pixel. Run it before every merge that touches `engine/`. [71e1ccb]

- One or two differing pixels at the far horizon in the default or high view are a known depth tie between two surfaces 2.5 km away. Anything else is a real change.
- Pick the right baseline. Compare against the `main` you will merge into, not an older commit, or other people's work shows up as your regression. Re-check when `main` moves.
- A run takes about 25 minutes in SwiftShader. Don't edit the working tree while it runs, because the "work" side reads the files as they are.
- Don't stop helper servers with `pgrep -f <pattern>`: the pattern also matches the shell running your own background job and kills it.

**Make every new capability a pack switch that is off by default.** Then the old setting's shaders don't even carry the new code, and the regression check proves it. Every engine feature since the pack split follows this: shadows, the clock, the ground map, relief, people, boats, materials, decor switches. [1c6542f, 7c57bbe, 92e82a1, 09f9ae1, b1bc623]

**Build the smallest possible test pack first.** The sandbox, a 480 m town, had to fake a water body, a green, a crop field and a maglev station before it would even load. Each fake was a hidden assumption in the engine, and each became optional. [a4db466, 63690a7]

**Put alternatives behind URL flags and compare them before choosing a default.** `?streets=bend|stitch|blend|grid`, `?infill=0`, `?look=day|night`, `?time=`, `?cycle=`. Keep the old behaviour reachable after the switch. [e0f7b36, c46216d, 51ccdd1, 2431c99, de7675d]

**Measure performance at fixed views, and compare only within one session.** `?probe=gpu` times seven fixed views with GPU timer queries. `?probe=live` shows CPU per state, upload sizes and an animation toggle. CPU timing in the browser pane varies by about ±30% between runs. [bb76e22, ff09ab7, 02b37c3, 7f89645]

**Write a performance or design pass up as a document.** Include a before/after table, which commit gained what, the visual checks, the ideas you rejected and why, and the next options. Rejected ideas save the next agent from retrying them. [7f89645, design/performance-2026-11-01.md, design/infill-2026-11-02.md]

**Look at the result yourself, from several distances and times of day.** Most of the fixes below were found by rendering, not by reading code: from the start view, a street view, close to the ground, and at night. Renders here run in SwiftShader, so they say nothing about frame rate on a phone. Say so when you report.

- A render that comes back as plain sky or fog usually means the test camera is inside a hill. Raise it before suspecting the code.
- Wait for the city to settle before capturing. Props merge after the first frames.

**Other checks.**
- `gen/check-pages.mjs`: every setting's page is a copy of the page skeleton, and this lists any element the engine reads that a page lacks. [4b6c1d9]
- A full build after a refactor catches dropped exports. Splitting Emberford's house helpers into `parts()` silently dropped `footing()`. [266a3cc]
- A sweep of many camera poses for NaN pixels after changing a ray-marched shader. [15f637b: 1,200 poses]

## 2. Architecture

- **Pull every setting-specific value into a pack before starting a second setting, as a pure refactor that changes nothing on screen.** New Angeles' centre, scale, camera, fog, lights, bloom, styles, kits, transport, audio and cards moved to `settings/new-angeles/`, imported in one place, `engine/setting.js`. [fa1456e]
- **Move shared systems into the engine, with the first setting's values as defaults:** clouds, hills, the interface theme (`ui.css` variables, a `theme.css` per pack). [deb06c0]
- **When a new setting is a different kind of place, give it its own generator instead of bending the old one.** `gen/town.py` builds walled towns from `town.json`. Real-plan features (explicit wall, traced streets, river arms, cut wards, infill lanes) were added as opt-in options, so Emberford's city file regenerated unchanged. [03e0f68, 13cf60d]
- **One URL shows one map.** Each page names its pack in `<meta name="setting">`. Nothing switches settings at run time, so a pack can assume it owns the page.
- **Keep private and test material out of what you publish.** `deploy.sh` and `scripts/export-public-map.py` include packs explicitly. When stripping private content, check what the public features depend on: the audio guide filmed two campaign places, which had to stay. [7515f13, a159479, 93268c3]
- **Keep invented material apart from canon.** When a story needs a new place, give it its own name and site instead of moving a canon one. [311175a]

## 3. Performance

The budget is a phone at 30 fps or more. Geometry is rarely the bottleneck: buildings are 12-triangle boxes, so building LOD was pointless. Draw calls, full-screen passes, per-frame JavaScript and buffer uploads are. [7f89645]

### Draw calls
- **Instance everything repeated and merge everything static.** Static meshes merge in world space per material signature and 800 m chunk, with colours baked into vertex colours. Animated, nested, custom-shader, mirrored, transparent or `userData`-tagged meshes stay separate. Wide view went from 690 to 477 calls and 13.1 to 6.9 ms. [d232466, d1d3938, 27de8f9]
- **Atlas canvas textures so signs can merge too.** Use 2048 px pages with an 8 px border of stretched edge pixels, so far mip levels don't bleed. [98e98cb]
- **Give a special pass its own scene**, so it doesn't walk the whole scene graph. The cloud pass's CPU time went from 1.6 to 0.15 ms. [d1d3938]
- **Split instanced meshes into spatial tiles** so frustum culling works. Show the detail layer (props, kibble, small signs) only within about 1.5 km. [districts-plan.md §4.3]

### Fill rate
- **Ray-marched volumes are the first suspect.** March clouds at half resolution, stop each ray at the scene's depth, and upsample depth-aware in the existing output pass. Size steps by ray length, test the coarse octave first, and draw a masked deck only on cells where its mask can be above 0. Wide view −5 ms, Andes −3 to −8 ms. [15f637b]
- **Fold full-screen blends into one output pass.** Bloom's own blend is off, and the output pass adds it. [0b1b2a4]
- **A `discard` anywhere in a shader costs early-Z, even if it never runs.** Enable clip planes only while a cutaway is on. Swap to precompiled "twin" materials only while a fade effect is active. [d232466: 0.4–0.9 ms; 7f4eb6d]
- **Draw large, discard-heavy surfaces after the opaque scene**, so covered pixels fail the depth test first. The sea saved 1–3 ms. [d97f04f]
- **Exit early from screen-space effects beyond their reach.** AO faded to nothing past 500 m but still ran 16 samples and a blur on every pixel. [59484b7]
- **Compute procedural detail only where it shows and is bigger than a pixel:** cobbles only on paving, grass blades only up close. [a589a05]
- **Lay fine ground grids only near content.** [44885f8]

### CPU and uploads
- **Never sample the terrain per agent per frame.** `groundAt` costs about 36 µs. With 2,700 walkers calling it every frame, `movePeople` took most of the frame. Sample both ends of each 4 m step and blend. Follow exact ground only where it leaves that line by more than 30 cm, such as onto a bridge. [f38d8ea, ad280a2]
- **Update far or decorative things less often.** Highway cars past the fog move one frame in eight. Broken-neon flicker updates half its lights per frame. [d1d3938, 98e98cb]
- **Upload only the buffer ranges in use.** In WebGL2 a zero-length update range uploads the whole buffer, so an empty traffic mesh sent 367 KB a frame. [d97f04f, 02b37c3]
- **Avoid forced layouts from DOM labels.** Read label widths once, and redraw CSS labels only when the camera moves. [d97f04f]
- **No allocation in `update` functions.**

### Rejected, with reasons [7f89645]
- **Bloom at quarter resolution:** thin neon lines shimmer in motion.
- **Lower DPR while the camera moves:** it reallocates about 15 render targets per switch, which shows as a hitch.
- **Freezing static matrices:** saves about 0.2 ms, but any missed mover freezes.

### Give users the switch
- Put a toggle next to each expensive effect: "Smooth edges" (1.5× supersampling plus SMAA) and "Corner shade" (AO). Remember the choice. [25a3961, 59484b7]
- Turn heavy effects off at low quality.

## 4. Graphic errors: symptom, cause, fix

| Symptom | Cause | Fix |
|---|---|---|
| Flicker between two surfaces at distance | Coplanar or nearly coplanar faces, even 4 cm apart | `polygonOffset` on the overlay. For roofs and caps, make the lesser piece 3–4% smaller or lower instead of matching planes [8deabb5, 812f9e1, 6f9153d] |
| A black box spreading from one spot | A NaN or Inf pixel blurred by bloom | Clamp NaN and Inf in the bright pass. Clean generated polygons of repeated vertices, which also make NaN heights [8deabb5, fcf384a] |
| Clouds drawn over nearby buildings during rides | A depth-reading pass decoded depth with the start-up near plane, but rides pull it to 0.4 m | Take near and far from the live camera every frame [00cf112] |
| Shadow edges crawl while panning | The shadow camera moves smoothly | Snap the ortho shadow camera to whole texels, and resize its square in 50 m steps [09f9ae1] |
| Speckled self-shadowing (acne) | Depth compared on the surface itself | Offset the lookup about 1.5 texels along the normal [09f9ae1] |
| Rings in soft shadows | A fixed sample pattern | Turn the tap disc by a per-pixel angle, so the pattern becomes fine grain [ce7e6e7] |
| Stretched roof slopes lit wrongly | Normals of non-uniformly scaled instances | Transform normals by the inverse scale [43aa855] |
| Some props cast no shadow | They merged after the shadow casters were picked | Re-pick casters every frame while the city settles [75b0336] |
| Only the custom shader receives shadows | The test lived in one shader | Inject the test into three.js's shared light chunks, so every lit material receives it [75b0336] |
| Stripes in contact shadows on flat ground | Half-resolution pixels sampled between depth texels | Sample at full-resolution texel centres. Take facing from the nearer neighbour. Blur depth-aware [9f0eb7b] |
| Laser beams vanish or flicker at distance | Fixed-width additive geometry thinner than a pixel | Widen beams with distance so they stay at least a pixel wide [6479101] |
| Dark bands across sloped streets at night | Flat light-pool discs sank into the slope | Paint lamp light into a light map on the ground. Draping the discs failed twice [587ee1e → 4ca3703] |
| Coarse hills showing through the town | The hills grid interpolates over the levelled ground | Sink it at least 2.5 m below the relief and 3.5 m below levelled platforms, and deepest along a moat [0dd0c68, 59e2f79] |
| An earth bank in front of retaining walls | The ground grid leans across a lot edge for one cell | Batter the walls: 0.5 m thick at the top, 1.8 m at the foot [0690b20] |
| Step stripes on moat banks | The steep-street step pattern ran on all steep ground | Restrict it to streets in the town [0dd0c68] |
| A wing of a building floating 7 m up | Every part took the height under the building's centre | Give each part its own ground height [7ba8a0c] |
| Writing instance matrices in `update` does nothing | Shared instanced meshes are copied into hidden tiles after the build | Anything that moves needs its own small `InstancedMesh` with `userData.noTile` and `frustumCulled = false` [design/FEEDBACK-BRIEF.md] |
| A visibly square soil patch | Hard-edged ground patches | Composite them into one blurred texture with a noisy rim [dc2a635] |

## 5. Lighting and art direction

### General
- **Every landmark needs one signature that reads from 500 m:** a silhouette, a coloured light band, a sign, a beacon. Use real-world sizes. Keep the skyline's top for the few buildings that own it. [design/pdf-finds/BUILD-BRIEF.md]
- **Give each district its own building type and land use.** Density, height, neon, lit windows, grime, colours, sign kinds and street light colour are the dials. [districts-plan.md §5, 9b03b2c, b3fd258]
- **Add variety with many small kits, and rebalance the router so no kit dominates.** One villa kit had been taking most of a district's lots. Check that a new kit actually builds; two didn't, because the router never picked them. [e883e69, f047693]
- **Blend styles across district borders by weight, not with a hard seam.** Each lot draws its kit mix from one of the bordering wards, weighted by distance. [54e68a0]
- **Low land must read as land at night.** Near-black lowland looked like sea. Make it dark olive, with a pale sand and mud band at the shore. [fef0b44]

### Night city
- **Light carries the image.** Use dark massing, lit windows from the building shader, and emissive accents above 1 so they bloom. Thin neon shimmers at low resolution, so keep bloom at full resolution. [7f89645]
- **Shape clouds with a coarse weather map and let 3D noise only erode the edges.** That gives distinct clusters with clear sky between, not haze. A thin layer at tower-top height makes tall towers read as tall. Thin the layers when the camera is in or above them. [bc73c4b, b3fd258, 9b03b2c]
- **Show a living, growing city:** construction sites with cranes and welding sparks, harvesters with work lights, traffic in layers. [9b49fe2, 9b03b2c]

### Day and a medieval town
- **In a shadowed day scene, most light must come from the sun, not ambient,** or walls facing away look brighter than the cast shadows. [43aa855: sun 0.8, base 0.35]
- **The ground must never be darker than the streets,** or lots read as shadows pointing every way. [43aa855]
- **Every lit material receives shadows.** Trees then shade the grass and each other, and the town grounds itself. [75b0336]
- **Turn the modern decoration off:** rooftop clutter, neon, signs, helipads, beacons, road markings. Lanterns hang on 4 m posts and flicker to a dim share instead of going out. Windows are small and shuttered. [7c57bbe, 92e82a1]
- **Build time of day as keyframes blended by the hour:** sky, fog, sun colour and height, sky light, building light, street brightness, water, shadow darkness, windows, lanterns, bloom.
  - The sun and moon give the light its direction, so shadows turn through the day.
  - Light fades over the lowest 8° of the sun or moon, so the switch at dusk can't be seen.
  - Keep a visible time control that relights without a rebuild.
  [de7675d, 1743bb1, 714c7d4, 587ee1e]
- **In a low town the ground is the main surface,** so it needs a material hierarchy by street rank:
  - large flat setts on main streets, round cobbles on major streets, rough cobbles with gaps on lanes
  - worn, paler middles; gutters at the paving's edge; wheel ruts on earth
  - mud and puddles at gates and wells; weeds at the edges; grass where the town ends
  - paint it all as one lit surface from a plan texture, not as separate flat slabs
  [2d90330, 0dd0c68, ac2370f]
- **Buildings need to meet the ground:** stone plinths, door steps, fenced yards with contents by ward. Build each boundary between neighbours once, for example a yard fenced on its left side and back only. [83cb0e1, 0dd0c68]
- **Churches and walls want blind masonry skins,** because a windowed skin reads as plain wall. Cap roof heights. Turn wide houses' eaves to the street. [d61702c, e061d50]
- **Density is what makes a town read as medieval:** houses wall to wall, narrow streets, deep back plots, back houses across small courts. Spacing them apart looks like a suburb. [bf169cb, 02c05d9]

## 6. Terrain

**When a place gets relief, every system needs its own way of meeting the ground.** Plan for all of these at once. [b1bc623, 0690b20, 59e2f79, 0dd0c68]

- **One height field.** `town.py` writes the relief into `city.json`, and `engine/relief.js` evaluates the same formula, so generator and engine agree exactly.
- **Two height queries.** `terrainAt` is the land itself. `groundAt` is where things stand, which is a bridge deck where there is one. People, carts and lamps use `groundAt`; the ground mesh uses `terrainAt`.
- **Level the lots.** Each lot is a flat platform. Round platform levels to terrace bands (1.5 m), so neighbours share levels and terraces follow the contours. Battered retaining walls hold them, and raised or sunk lots get steps through an opening in the wall.
- **Streets follow the land.** Steep street stretches are drawn as steps. Cross lanes bend along the contours.
- **Everything is placed on the ground:**
  - every instanced part
  - kit and landmark groups, and each part of a compound building separately
  - labels, cards, carts, people and light
  - the camera's orbit target, which rides on the ground; dragging grabs at the target's height
- **Coarse terrain sits clearly below fine levelled ground.**
- **Water lies flat.** A moat holds water only in its low stretches. A river through a hill town runs in a sunk channel behind quay walls. [59e2f79, 13cf60d, cd681ed]
- **Let the generator choose high ground for important sites:** keep and church on their rises. [c61454a]
- **Steep hills want their own street logic:** contour lanes joined by stair lanes, switchbacks, a road spiralling round the summit, and walls stepping down the slope. [44885f8]

## 7. Infrastructure

- **Junctions need a general rule, not patches.** Maglev joins took six commits in 80 minutes before one rule covered every case: fit tangent arcs of about 220 m radius at every line end, bring both decks to one level along the ramp, re-run until no earlier joint moves, and keep stops 30 m clear of merges. Lines that meet end to end run on with no arc. Remove stubs that end in mid-air. [adbffc0 … 588a435, 6bdd365, 6f08468]
- **Clean highways after generation:**
  - join pieces that meet head-on
  - drop doubles and short stubs
  - keep crossing decks at least 10 m apart
  - ease ends to the deck they join
  [51ccdd1]
- **Bent street fields need wider spacing to keep block sizes,** because bent streets meet sooner. Blend layouts per district with a fade, not a cut. [87e5742, c46216d, 51ccdd1]
- **Size station geometry around the ride camera's path.** [b574da6]
- **Tours chain several lines, clear other trains off the tracks, and together reach every station.** [f2bc046, 39c1faa]
- **Roads have to leave town.**
  - Gate roads run past the wall and on to the horizon as dirt with a grass strip.
  - Hedges line them near the town.
  - Suburbs string along them.
  - Paving stops at the town's edge.
  [83cb0e1, bf169cb, 0dd0c68, ac2370f]
- **Bridges come from the data.** Wherever a street crosses water, build a humped deck with parapets and piers. Every gate gets a deck across the moat. [59e2f79]
- **Feed widths and paths from the generator to the moving agents.** With street widths in the city file, walkers keep 0.6 m inside each street's edge instead of walking through house fronts. Guards walk the wall-walk path. [bf169cb]
- **Space waterside props so they never overlap.** Each ship patch or fish farm claims its own disc of water, picked by length along the shore. Ships keep 40 m off maglev lines. [bb23030, 6bdd365]

## 8. Making the place interesting

- **Story places deserve bespoke models, not a reused one.** Demote the old model to a generic building elsewhere. [f047693 → a7c53a7]
- **Model what the card says, and point the card's camera at the front.** Set `face` on landmarks whose logo or entrance isn't on the street side. [design/FEEDBACK-BRIEF.md]
- **Let landmarks stand free of blocks** when they are parks, open sites or showpieces off the grid. Seat them in their home district first. [0cc2dc8, 981235c]
- **Fill empty cells and bare edges on purpose.**
  - Fray the city's outer edge with a noisy mask so it doesn't end on a traced line.
  - Fade districts into the jungle with groves.
  - Place bespoke buildings in leftover cells, square to the local streets.
  [8d1e81d, 1ebaf9b, 02d7728]
- **But keep hand-made organic fill when a procedural pass makes it worse.** Packing open ground into rectangular lots turned four districts into grids of square boxes, and infill was made opt-in 18 minutes later. [2431c99 → b042aea]
- **Huge lots need subdividing or they read as empty yards.** [6c7e852, 6d41dd9]
- **Raise generic landmarks for every site of a kind,** then give each its own card. A medieval town wants:
  - chapels in walled churchyards, inns with signs
  - a market cross and pillory, a quay with a crane
  - a windmill, a tannery, a water mill
  - a castle bailey, barbicans
  [c61454a, 59e2f79]
- **Add life:** people by day and fewer at night, carts with lanterns, barges, guards on the wall walk, turning wheels and sails, easter eggs. [714c7d4, bf169cb, 54596b3, 51b0dbe]
- **Open a tour on the whole place and its key landmark before going into detail.** Cut between several shots rather than holding one view for 80 seconds. [13e9920]

## 9. Kits and landmarks

- A kit builds in its lot's local frame, with `+z` toward the street. A free landmark builds in its site's frame, turned by the site's `rot`. A waterside site faces the water along `+v`, so its `rot` is 90° less than its bearing.
- Shared instanced meshes (`PROPS`, `GLOWS`, `glows`) are copied into hidden tiles after the build. Animate only your own meshes.
- Keep kit files to their own prefix and their own content file. Agents working in parallel must not rewrite shared JSON. [design/FEEDBACK-BRIEF.md]
- Recursive splitting needs a depth cap. The lot splitter overflowed the stack on bent blocks; it now keeps a block whole after 1,000 failed cuts. [87e5742]
- A cut line must start outside the region it cuts, or both halves take everything. [cd1a8e8]

## 10. Motion, people and the interface

- **Tune motion quickly by eye, but give it a physical curve.** Climber acceleration went 6 → 12 → 24 → 48 → 96 m/s² before a cubic jerk curve gave the wanted "creep off the dock, then shoot up". Change the curve's shape, not just its scale. [e4b41a7 → 2b6557f]
- **Input heuristics need real logs from every browser.** Wheel and trackpad detection took three fixes in 40 minutes:
  - Chrome on macOS sends notches as multiples of 4.000244140625 px
  - a scroll reverser sends 120 px steps
  - Firefox sends 48 px steps
  [a6319b2, eec8915, bf01e2c]
- **When a card is open, hold the camera on its subject and dither away what stands in front.** Use the subject's box, not a cone. Keep 15 m round the camera solid. Don't fade during moving shots. [7f4eb6d, 9e4a26b, 064bebc, 41b8bbc]
- **On phones, frame the subject with a camera view offset, not by moving the target.** Pivot on the building's middle. Give buttons at least 46 px height. [ff09ab7, b3a3683, e542e88]
- **Give touch users a way into hidden tools:** four taps on "?" open the tuning panel. [4bd9176]
- **Slider defaults come from the pack.** Store only changed values. Make the panel searchable. [524b96e, d75863d]
- **A style for the interface belongs to the pack.** A neon interface over a medieval town looks wrong. [deb06c0]

## 11. Checklist for a new pack

1. Copy a page skeleton, set `<meta name="setting">`, and run `gen/check-pages.mjs`.
2. Start from the sandbox. Add sections one at a time and look after each.
3. Write or reuse a generator. Make new generator features opt-in, and confirm existing packs regenerate unchanged.
4. Decide the light model first: night city or day with a clock. Set sun share, ground tones and modes.
5. Ground: a ground map with a material per street rank, then plinths, yards and edges.
6. Relief, if any: platforms, walls, steps, water levels. Check every system stands on the ground.
7. Infrastructure: streets and their widths, transit, bridges, roads out of town.
8. Kits: many small ones, balanced router, real sizes, one signature per landmark, a card for each.
9. Life: people, traffic, boats, animation in own meshes.
10. Performance: `?probe=gpu` at fixed views, draw calls, CPU per agent, upload sizes; record the numbers.
11. Before merging: the regression check against current `main` for New Angeles, the page check, and renders of the new pack at several distances and hours.
12. Publishing: add the pack explicitly to the export or the deploy, and check what it depends on.
