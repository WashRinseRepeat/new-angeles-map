# Plan a new setting

This guide is for an AI that helps a person make a new setting on this engine: another city, a town, a real place or an invented world. It tells you what to ask the author, in which order, and how to turn the answers into a build plan.

Three other files hold the technical detail. Read them before the interview, because you must know what the engine can do when you ask.

| File | Holds |
|---|---|
| `SETTINGS.md` | Every field of a setting pack, and the three example packs |
| `MODULES.md` | The kit and landmark API, the local server, edit mode and the checks |
| `LESSONS.md` | Mistakes from the first three settings, with their fixes |

The questions come from the record of how New Angeles, Emberford and Nuremberg were made. Each question stands for a topic that the author of those settings raised, often late and after a wrong build. Ask early and the wrong build does not happen.

## 1. Process

| Step | You do | The author does | Result |
|---|---|---|---|
| 1 | Read the three files. Open the four example pages | Nothing | You know the engine |
| 2 | Run the interview in section 3, one round per message | Answers, gives files | Raw answers |
| 3 | Write the setting brief (section 5). Mark each item with its work type (section 2) | Reads and corrects it | Approved brief |
| 4 | Build the grey town: plan, districts, one plain kit, camera, light | Looks at it in the browser | Approved layout and scale |
| 5 | Build in the order of section 6. Show each stage | Gives feedback (section 7) | The setting |
| 6 | Run the checks. Publish (section 8) | Says go | Live page |

Rules for the interview:

- Start with the round 1 question. Do not open with a description of the interview, the number of rounds or a list of the example pages.
- Ask one round per message, and at most six questions in it. Split a longer round.
- Write the questions as plain sentences in your own words. The tables below are your notes. Do not show the author the tables, the question numbers or the "Lands in" column.
- Use the author's words. The author does not know this repository. Do not say "pack", "kit", "generator" or "work type" before you have explained the word, and do not name an example setting as if the author knew it. Describe an example by what it shows, with its link.
- Skip a question that an earlier answer covers. Round 1 is one open question for that reason.
- Offer a default only where it helps the author. Do not print a default for each question.
- Ask for files in place of descriptions where a file exists.
- Do not talk about engine work, cost or limits in round 1. The author must first say what they want. Name the cost of a wish when the wish is clear, at the end of that round, and only for that wish. The full split comes in the brief.
- Do not build before the author approves the brief. Do not build detail before the author approves the grey town.

## 2. Work types

Each item in the brief gets one of these types. The author must see the split, because engine work costs more and can change the other settings.

| Type | Means | Where it lands | Cost | Check |
|---|---|---|---|---|
| Content | Values, text, positions, colours | `settings/<id>/setting.js`, `content/*.json`, `theme.css`, `town.json`, the page's texts | Low | Look at the page |
| Kit | Models written with the helper API | `settings/<id>/kits/*.js`, landmark and layer modules in the pack | Medium, grows with the number of models | `?showcase=<family>`, then the page |
| Generator | A script that writes `city.json` | `gen/` or the pack folder | Medium to high | The old packs' city files regenerate unchanged |
| Engine | A capability no pack field gives | `engine/` | High | `gen/regress.mjs` shows New Angeles unchanged. `gen/check-pages.mjs` passes |
| Outside | Audio, music, images made with other tools | Files the pack points to | Depends on the tool | Listen, look |

What each example gives without engine work:

| Need | Ready today | Example |
|---|---|---|
| Dense city on a street field, coast, mountains | Yes, but `gen/gen.ts` writes only New Angeles | New Angeles |
| Walled or open town, traced from a real plan | Yes, `gen/town.py` from `town.json` | Emberford, Nuremberg |
| Town on a street grid | Yes, a short script | Sandbox (`make-city.py`) |
| Night look with neon, bloom, clouds | Yes | New Angeles |
| Day clock, sun shadows, corner shade, sky | Yes | Emberford |
| Hills, relief, terraces, moat, river, bridges | Yes | Emberford, Nuremberg |
| Cobbled and earth ground by street rank | Yes | Emberford |
| People on foot, crowds, carts, boats | Yes | Emberford |
| Elevated rail with stations and rides | Yes | New Angeles |
| Road traffic, highways, hover traffic | Yes | New Angeles |
| Underground levels | Yes | Nuremberg |
| Landmark cards, atlas, search, walking tours | Yes | All |
| Narrated audio guide with camera moves | Yes, the audio files come from outside | New Angeles |
| Interface theme and loading logo | Yes | All |

These need engine or generator work today. Say so when the author asks for one.

- A city kind that is neither New Angeles nor a town: a new generator that writes the same city file.
- A region or country at small scale. The engine draws one city with its near country.
- Weather such as rain or snow, and seasons.
- Transport other than road, elevated rail, river boats and the central lift: trams at street level, cable cars, airships, ships with routes.
- Animals, flying creatures, and people who do more than walk and stand.
- Interiors.
- A change to the shared page markup. It must go into every setting's page.

Rules for engine work:

- Make the new capability a pack switch that is off by default.
- Give it the first setting's values as defaults.
- Prove with `gen/regress.mjs` that New Angeles did not change. Capture the baseline before the first engine change.
- Write the engine items as a numbered roadmap of small steps. Do one step, show it, and wait for the author's word before the next.
- Before a costly feature with more than one technique, show the author an example picture of each technique.
- When the author asks if a wish is engine work or kit work, answer with the work type and the reason.

## 3. The interview

Each table gives the question, the reason, and the place the answer lands. "Type" is the work type when the answer goes past the ready features.

### Round 1: the idea

Round 1 is one open question and no more. Ask it like this:

> Tell me about the place you want to build. A few sentences are enough. What is it, when and where is it, and what does it look like? If a film, a game, a picture or a real city is close to it, name it.

Take these points from the answer. Ask a short follow-up only for a point that is missing.

| Point | Why | Follow-up if missing |
|---|---|---|
| Real, from a published world, or invented | It decides how exact the plan must be | "Is this a real place, a place from a book or game, or your own?" |
| Era and technology | Sets the start pack and the decoration switches | "Which time is it: medieval, modern, far future?" |
| The look | A reference prevents a wrong first style | "Is there a film, game or picture that looks like it?" |
| Rough size | The engine holds one city with its near country | "Is it a village, a town or a big city? How long does a person walk from one end to the other?" |

Do not ask the author for metres, building counts or the nearest example. You work these out. A walk of ten minutes is about 800 m.

Then answer with three things, in plain words:

1. Two or three sentences that say back what you understood.
2. The example page that is nearest, with its link and one sentence on what it shows. Say what the author's place has in common with it and what will differ. Ask the author to open it, so that they see what the engine draws.
3. The next round's questions.

### Round 2: sources and rights

| # | Ask | Why | Lands in |
|---|---|---|---|
| 2.1 | Which books, notes, wikis or files are the truth for this setting? Give them to me | Models and texts must agree with them | Brief |
| 2.2 | When two sources disagree, or a source disagrees with the real map, which one wins? | This came up for coasts and for places that moved | Brief |
| 2.3 | Which parts may I invent, and which are fixed? | Invented places get their own names and sites | Brief |
| 2.4 | Is there a master list of places with a position for each? | A place in the wrong district is the most reported error | `town.json` sites, landmark `at` |
| 2.5 | Which content is private, secret from your audience, or under copyright? | A public copy must leave it out. Do not copy book text or official art | Publishing |
| 2.6 | Which language and spelling do the texts use? | One spelling in every label and card | Content |

### Round 3: land and water

| # | Ask | Why | Lands in | Type |
|---|---|---|---|---|
| 3.1 | Is there a map I can trace? A scan, a drawing or a link is enough | A traced plan is exact. A described plan is a guess | `town.json`, `map` | Content |
| 3.2 | Where is water: sea, river, lake, moat? What is each shore like: beach, quay wall, cliff, marsh? | Trees and cars on water were reported many times | City file `water`, `coast` | Content or Generator |
| 3.3 | Where are hills? What is the highest ground, and what stands on it? | Relief changes every system that touches the ground | `relief` | Content |
| 3.4 | What is the tallest thing in the world, and how tall is the land round it? | A tower looked small next to its mountains | `terrain`, landmark sizes | Content |
| 3.5 | What lies past each edge: fields, forest, desert, sea, more city? | The map must not end on a traced line or a void | `look.land`, `look.edge`, `far` roads | Content |
| 3.6 | How does the built area end: a wall, suburbs, a frayed edge into wilderness? | Hard edges read as artificial | `walls`, `suburbs`, `look.edge` | Content |
| 3.7 | Is there an underground? How many levels, and what is in them? | An empty level is worse than none. Hide it until it has content | `layers` | Kit |

### Round 4: plan and districts

| # | Ask | Why | Lands in |
|---|---|---|---|
| 4.1 | List the districts. For each give a name, a one-line character, wealth, building height, density and one thing found only there | Every district needs its own building type and land use | `styles.styles`, kits |
| 4.2 | Are the streets a grid, grown, radial or mixed? Does it differ by district? | Straight and bent streets suit different districts | Generator options |
| 4.3 | How wide are main streets and lanes? Are houses wall to wall or apart? | Density makes a town read as old. Wide streets in low areas look empty | `widths`, `scale.city` |
| 4.4 | What is the ground made of in each area: asphalt, cobbles, earth, grass? | In a low town the ground is the main surface | `look.groundMap`, `look.ground` |
| 4.5 | Do districts change at a sharp line or blend? | Blending is ready and takes one value | `styles.blend`, `kits.ownTiers` |
| 4.6 | Which district is the showpiece, and which may stay plain? | Sets where the kit work goes | Brief |
| 4.7 | Where is the centre, and what stands there? | The centre takes the plaza, the pin and the start view | `centre` |
| 4.8 | Which areas could look empty, and what fills them: parks, fields, yards, industry? | Empty lots and bare edges were reported for many districts | `landUse`, `blockZones`, yard kits |

### Round 5: buildings

| # | Ask | Why | Lands in |
|---|---|---|---|
| 5.1 | What is the common building in each district? What is the rare showpiece? | Many small kits give variety. One kit must not take most lots | Kits, tiers |
| 5.2 | Which wall and roof materials? Which colours? | Skins for towers and for old towns are ready | `styles.wallSkins`, skins |
| 5.3 | Do cultures or factions have their own architecture? | A foreign roof on a standard tower was rejected | Kit families |
| 5.4 | What is on roofs and facades: signs, neon, antennas, chimneys, nothing? | Modern decoration must be off in an old town | `look.decor` |
| 5.4a | What is behind and between the houses: yards, fences, sheds, gardens, washing, goods? | In a low town the eye is on how buildings meet the ground. Bare lots read as unfinished | Yard kits, `yardKit` |
| 5.5 | What must not appear? Name shapes or motifs you dislike | Saves a round of removal | Brief |
| 5.6 | Do you want richer models or more speed, when the two conflict? | Sets the budget per kit | Brief |

### Round 6: landmarks and named places

Ask for a list first. Then ask the lower rows for each landmark.

| # | Ask | Why | Lands in |
|---|---|---|---|
| 6.1 | Which five to thirty places must be unmistakable? | Each needs a hand-built model | Kit landmarks |
| 6.2 | Where is each, and in which district? May it move to fit a block? | Seats search for a block within a reach | `at`, `reach`, `free` |
| 6.3 | Quote the lines that describe its shape | The model must show what the text says | Kit |
| 6.4 | What is its one sign from 500 m: a silhouette, a light, a banner? | A landmark without one is lost in the skyline | Kit |
| 6.5 | How large is it against its neighbours? Which landmarks must dominate, and which must be equal? | Size was corrected for many landmarks | Kit sizes |
| 6.6 | Which side is the front? Where is the sign or the entrance? | The card camera must face it | `face` |
| 6.7 | Does it move or glow? What is the motion? | Moving parts need their own meshes | Kit `update` |
| 6.8 | Are there kinds of place that repeat, such as inns, chapels, mills, shops? | One builder serves every site of a kind | Kit, sites |
| 6.9 | Which hidden jokes or legends do you want on the map? | Small cost, and authors ask for them | Kit |

### Round 7: light and sky

| # | Ask | Why | Lands in |
|---|---|---|---|
| 7.1 | Fixed night, fixed day, or a clock with a time slider? At which hour does the page open? | Decide the light model before any kit | `look`, `look.clock`, `look.modes` |
| 7.2 | Do shadows matter? Hard or soft edges? Do carts and people cast them? | Shadows and corner shade cost frame time, and each has a user switch. Authors expect things to shade each other, and walls away from the sun to be dark | `look.shadows` (`soft`, `live`), `look.ao`, `look.buildingLight` |
| 7.2a | For a clock, which colour has the sun at noon and at dusk? How long is a full day on screen? | The keyframes set it | `look.clock` |
| 7.3 | What lights the place at night: windows, lanterns, neon, torches, the moon? | Light carries a night image | `look.tune`, `look.lamps` |
| 7.4 | How much fog and haze? Which sky colours? | Fog sets the mood and hides the far edge | `look.fog`, `look.sky` |
| 7.5 | Which clouds: none, high decks, low cloud that touches towers? | Clouds must not hide the city | `look.clouds` |
| 7.6 | Which places have their own light effect: searchlights, beacons, fires? | These are kit work | Kit |
| 7.7 | Do you want rain, snow or seasons? | Engine work | Engine |

### Round 8: transport and life

| # | Ask | Why | Lands in | Type |
|---|---|---|---|---|
| 8.1 | Which transport exists: carts, cars, flying traffic, rail, boats? | Each is a section the pack may leave out | `transport`, `boats` | Content |
| 8.2 | For rail, which lines, loops and stations? Which route shows a visitor the place? | Routes without dead ends, and one tour that reaches every station | City file `maglev`, `loops`, `transport.maglev.tours` | Content |
| 8.3 | May a line pass through a building in a tunnel, or must buildings move? | Lines through buildings were the most frequent error | `tunnel`, `portal` | Content |
| 8.4 | What do stations look like in each district? | One kit per district or one default | `stations` | Kit |
| 8.5 | Can a visitor ride? What must the ride feel like? | The ride camera sets station sizes | `transport.maglev` | Content |
| 8.6 | Is there one hero structure with its own motion, such as a lift, a wheel, a harbour crane? | It takes a module of its own | `centre.module` | Kit |
| 8.7 | Where do main roads enter and leave? Where are the bridges? | Roads must leave town and not end in a field | `roads`, `far`, `highways` | Content |
| 8.8 | Are people in the streets? Where are the crowds? How many at night? | Walkers and crowds are ready | `people` | Content |
| 8.9 | What works in the fields, at the harbour and in the yards? | Life outside the centre keeps it from looking dead | Kits, `look.decor` | Kit |
| 8.10 | Where must nothing drive or stand? | Cars drove through a field and into the sea | Brief | Content |

### Round 9: texts, tours and sound

| # | Ask | Why | Lands in | Type |
|---|---|---|---|---|
| 9.1 | Does each landmark and district get a card? Who writes it: you, I from your sources, or I freely? | One or two paragraphs per card | `content/*.json` | Content |
| 9.2 | Which tone? What must a card never say? | Lines were removed for false or secret facts | Content | Content |
| 9.3 | Which categories sort the places in the atlas? | Each category is a filter button in the page and a `category` value on the cards | Card `category`, the page's `data-f` buttons | Content |
| 9.4 | Do you want walking tours? Give the stops in order, with a text for each | Ready, and needs no audio | `walks` | Content |
| 9.5 | Do you want a narrated audio guide? Who speaks, in which voice and language? | The engine plays an MP3 with a cue file. You make the audio elsewhere | `audio.episodes` | Outside |
| 9.6 | Give the right pronunciation of each unusual name | A host was renamed because the voice could not say the name | Script | Outside |
| 9.7 | Which shot goes with each part of the narration? | Vary the moves, open on the whole place, keep the named landmark in view | Cue file, `audio.moves` | Content |
| 9.8 | Do you want music? Which mood, with or without vocals, one track or one per route? | Loops play on rides and from the settings panel | `music`, a tour's or loop's `music` key | Outside |
| 9.9 | Do you have a budget and accounts for speech and music tools? | Do not plan audio the author cannot produce | Brief | Outside |

### Round 10: interface and first visit

| # | Ask | Why | Lands in |
|---|---|---|---|
| 10.1 | What is the map called? Is there an in-world maker or brand for it? | Title, loading screen and welcome card | Page texts |
| 10.2 | Which colours and typeface suit the setting? | A neon interface over a medieval town looks wrong | `theme.css` |
| 10.3 | Which logo spins on the loading screen, and which lines does it show? | Each pack styles its own | Page markup, `theme.css` |
| 10.4 | What does a first-time visitor see: a tour offer, a hint overlay, nothing? | The welcome card and its steps | Page texts |
| 10.5 | What is the opening view? A screenshot of an example at the right angle helps | The first image sells the map | `camera` |
| 10.6 | Is the map part of a site? Which link leads back, and do pages link to places on the map? | `?focus=<slug>` opens one place | Page markup |
| 10.7 | Do you want to move places by hand after the build? | Edit mode does it on a local server | `places.json` |

### Round 11: devices and publishing

| # | Ask | Why | Lands in |
|---|---|---|---|
| 11.0 | Who will look at the map: you alone, a game group, the public? | Sets the devices and how much the texts must explain | Brief |
| 11.1 | Which devices must work: phones, old laptops, 4K screens? Which browsers? | The budget is a phone at 30 frames per second | `scale.detail`, quality levels |
| 11.2 | Is the first load time important? | Large city files and terrain images slow it | Generator |
| 11.3 | Where will it be hosted? | It is static files, so any web host works | Publishing |
| 11.4 | Is there a private and a public version? What differs? | Decide the split before content is written | Publishing |
| 11.5 | Who else edits this repository? | Two editors must not change the same files | Brief |
| 11.6 | Does the setting go live from the first stage, or stay off the public site until you approve it? | One page shows one setting, so an unfinished setting can stay unlinked or out of the deploy | Publishing |

### Round 12: how we work

| # | Ask | Why |
|---|---|---|
| 12.1 | How will you look at builds: a local server, a test site, screenshots from me? | The author must be sure which build is on screen |
| 12.2 | Do you want options before I decide, or decisions with a note? | Authors differ, and the wrong mode wastes rounds |
| 12.3 | Which stages do you want to approve? The default is the brief, the grey town, the first district, each landmark batch, the audio script | Sets the gates |
| 12.4 | May I push or deploy, or only on your word? | The default is only on the author's word |

## 4. Files to ask for

| File | Use | If missing |
|---|---|---|
| Map or plan, as an image or a link | Traced into `town.json` or the city file | Invent a plan and get it approved as a top-down render |
| Source texts | Card texts, landmark shapes | Write from the interview, marked as invented |
| List of places with districts | Sites and seats | Build it in the brief |
| Reference pictures of buildings and landmarks | Kit design | Use the look references from round 1 |
| Logo or emblem, favicon | Loading screen, page icon | Build a simple one in CSS |
| Pronunciation list | Audio script | Ask per name when the script is written |
| Audio and music files, or tool accounts | Tours and rides | Leave audio out. Walking tours need none |
| Screenshot of the wanted opening view | `camera` | Propose three views |
| Hosting access or a deploy method | Publishing | Hand over the folder of static files |

## 5. The setting brief

Write this document after the interview and have the author approve it. Keep it in the pack folder as `BRIEF.md`.

1. Idea: place, era, audience, references, nearest example, size.
2. Sources: list, order of trust, invented parts, private parts.
3. Land: plan source, water and shores, relief, edges, underground.
4. Districts: one table row each with character, height, density, ground, signature and style ends.
5. Buildings: kit families, materials, decoration switches, banned motifs.
6. Landmarks: one row each with position, district, described shape, signature, size rank, front, motion.
7. Light: model, opening hour, shadows, night lights, fog, sky, clouds.
8. Transport and life: sections in use, routes, stations, roads, people, work, no-go areas.
9. Texts and sound: cards, categories, walking tours, audio guide, music, tools.
10. Interface: name, theme, logo, welcome, opening view, links.
11. Devices and publishing: targets, host, public and private split.
12. Work list: every item above with its work type from section 2, sorted by build stage.
13. Open points: questions the author has not answered.

Item 12 is the part the author decides on. Show the engine and generator items first, each with its reason and a cheaper pack-only choice where one exists.

## 6. Build order

Each stage ends with a look by the author. Do not start a stage on an unapproved one.

| Stage | Build | Show the author |
|---|---|---|
| 1 | Copy `settings/sandbox/` and its page. Set the name and `<meta name="setting">`. Run `gen/check-pages.mjs` | The page loads |
| 2 | Plan: generator input, districts, streets, water, relief | A top-down view and a low view of the grey town |
| 3 | Light model, ground, fog, sky, camera limits, opening view | The opening view at each hour or mode |
| 4 | One kit family for the showpiece district | That district from the street and from above |
| 5 | The other districts, blending, fill for empty areas | Each district, and each border |
| 6 | Landmarks in batches of about five, with cards | Each landmark through its card, so the front is checked |
| 7 | Transport, roads out of town, people, boats, work | A ride, a street at day and at night |
| 8 | Walking tours, audio guide, music | Each tour played to its end |
| 9 | Theme, loading screen, welcome card, help texts | A first visit with `?new=1` |
| 10 | Performance and checks (section 8) | Numbers at fixed views |

Relief, the ground map and the light model belong early, because every kit depends on them. A landmark built on flat ground must be seated again when relief arrives.

## 7. Review loop

How to take feedback:

- Ask for a screenshot and the camera pose for each visual problem. Copy values in the tuning panel (the `?` key, or four taps on the ? button) copies the pose and the dial values, and `?view=x,y,z,tx,ty,tz` opens the page at that pose.
- Make the approved dial values the pack's defaults in `look.tune`, `kits.tune` or `kits.cityTune`.
- Offer two versions behind a URL flag when the choice is a matter of taste. The author compares them and picks.
- Ask for map coordinates and examples before you fix a class of error, so the fix is a general rule.
- Save the pictures you show in a place the author can open, and give the path.
- State what you did not check. A headless render says nothing about frame rate on a phone.

Errors that came back more than once in the first settings. Check for each before you show a stage.

| Error | Check |
|---|---|
| The card camera shows the back or the side of a place | Open every card. Set `face` where the front is not on the street side |
| A model does not match its text | Read the card next to the model |
| A place sits in the wrong district, or moved after a regeneration | Compare seats with the place list after each generator run |
| Rail or road through buildings, pillars on landmarks or in mid-air, two lines crossing at one height | Ride every route. Look along every line from above |
| Trees, cars or lots on water | Top-down view of every shore |
| Black or grey holes in the ground, a visible map edge | Low view toward each edge |
| Flicker between two surfaces, flashing roof parts | Slow orbit close to the ground. See `LESSONS.md` section 4 |
| Black boxes that spread | A NaN pixel under bloom. See `LESSONS.md` section 4 |
| All buildings of a district look the same, or one kit takes most lots | Count kits per district. Look from the street |
| A fill pass turns organic ground into square boxes | Before and after pictures of the same view |
| A landmark is too small or too pale next to its peers | One view that holds the peers together |
| Too many copies of one ornament: gates, lasers, beacons, labels | Wide view |
| Tour shots are blocked or stale after buildings moved | Play every tour again after any layout change |
| The same camera move again and again in a tour | Read the cue list for repeats |
| Mispronounced names in narration | Listen to the whole file before the cue work |
| Phone differs from desktop: pivot, card size, touch feel | A phone, or the browser's phone mode, at each stage |
| The author sees an old build | Say which commit is live. Use a no-cache server |
| A dial with no visible effect | Remove it or widen its range |
| A hidden layer costs frame time | Build and draw a layer only when it shows |

## 8. Checks and publishing

Before the author calls it done:

- `node gen/check-pages.mjs` lists no missing element.
- After any engine change, `node gen/regress.mjs` shows New Angeles unchanged, and the other example pages still load.
- The example packs' city files regenerate unchanged after any generator change.
- `?probe=live` at the opening view, a street view and the busiest view. Record frame time and draw calls.
- Renders at several distances, and at several hours if the pack has a clock.
- The browser console shows no error on load, on a card, on a ride and on a tour.
- Every card opened, every tour played, every route ridden.

Publishing:

- The map is a folder of static files. Any web host serves it.
- A fork publishes every pack in it. Remove a pack's page and folder to leave it out.
- Keep private text out of the pack, or in fields that an export step removes. Decide this at question 2.5, before the content is written.
- Write your own texts and build your own models. Do not ship book text or official art.
- Push or deploy only on the author's word.
