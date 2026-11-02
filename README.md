# New Angeles Map

An interactive 3D night map of New Angeles, the city of the Android universe. Fly over eleven districts, open the
cards of over a hundred landmarks, ride the maglev lines and listen to a narrated audio guide. It runs in the
browser with no build step.

![The city at night, from Esmeraldas up to the Root](docs/city.jpg)

## Features

- **A whole city.** Eleven districts, from Chakana at the Root down to Guayaquil and the La Costa farmland. Each
  district has its own building styles, density and street life. The street grid follows the canon district map.
- **Landmarks with cards.** Over a hundred hand-built landmarks, each with a card of setting text. Filters sort
  them into civic, corporate, shops and food.
- **The Beanstalk.** The space elevator rises from the Root, with pods that climb the tether.
- **Maglev rides.** Four tours ride the elevated lines in first person, each with its own music. You can change
  speed, turn back, look around and hide the labels.
- **Narrated audio guide.** Two episodes with Carmen, an NBN-certified city guide. The camera flies along with the
  narration. It has subtitles, playback speed, seeking and resume.
- **A living night.** Ground cars, hover traffic and highway traffic, flickering neon, searchlights, harvesters
  in the fields, low clouds between the towers, fog and bloom.
- **Focus view.** An open card holds the camera on its landmark while you orbit it. Buildings in front of the
  landmark thin out in the shape of its outline.
- **Undercity layer.** A cut-away view shows the tunnels and caverns under the streets.
- **Search, atlas and minimap.** Search finds any landmark or district, the atlas lists them by district, and the
  minimap jumps anywhere.
- **Mouse, trackpad and touch.** Phones and tablets work, and quality adapts to the device.
- **Smooth edges.** A switch in the corner renders at 1.5 times the screen's pixel ratio and adds SMAA, for
  fast graphics cards.

| | |
|---|---|
| ![The Root and the foot of the Beanstalk](docs/beanstalk.jpg) | ![A landmark card in focus view](docs/landmark-card.jpg) |
| The Root and the foot of the Beanstalk | A landmark card in focus view |
| ![A maglev ride through Base de Cayambe](docs/maglev-ride.jpg) | ![The audio guide with subtitles](docs/audio-guide.jpg) |
| A maglev ride through Base de Cayambe | The audio guide with subtitles |

## Run it

Serve the folder over HTTP and open it in a browser:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/. The live version runs at
https://washrinserepeat.github.io/new-angeles-map/. Three.js r160 loads from the jsDelivr CDN. Every other file is in this
repository. Any static host works, GitHub Pages included.

## Controls

| Input | Action |
|---|---|
| Mouse | Drag to move, right-drag to turn, scroll to zoom |
| Trackpad | Two fingers to move, pinch to zoom, <kbd>⌥</kbd> and two fingers to turn and tilt |
| Touch | Drag to move, pinch to zoom, twist to turn, slide two fingers up or down to tilt |
| <kbd>/</kbd> | Jump to search |
| <kbd>?</kbd> or four taps on the ? button | Show the tuning panel |

## URL options

| Option | Effect |
|---|---|
| `?listen=e01-the-thread-to-the-sky` | Opens an audio guide episode, paused |
| `?layer=undercity` | Starts in the undercity layer |
| `?showcase=<family>` | Shows one kit family on an empty grid, at three style weights |
| `?probe=live` | Shows frame time, CPU time, draw calls and uploads, with buttons to switch parts off |
| `?probe` | Measures each part of the scene in turn |

## How it is built

| Path | Content |
|---|---|
| `index.html` | Page, styles and the import map |
| `engine/` | Renderer, city generator, controls, cards, rides, audio guide |
| `kits/` | Building and landmark builders, one file per family |
| `landmarks/` | The Beanstalk and the terrain |
| `places/` | Two named places that the audio guide films |
| `content/` | Card texts for landmarks and districts |
| `city.json` | Streets, lots, districts and transit lines, made by `gen/` |
| `audio/` | Audio guide episodes with their cue files, and the ride music |
| `MODULES.md` | Reference for kit and landmark modules and the helper API |

The engine reads `city.json` and fills every lot with a kit picked by district, density and a seeded random, so
the city looks the same on every load. Landmarks claim a block near their position and build their own meshes.
Static meshes merge into chunks at load, so the city draws in a few hundred calls.

## Extending

`MODULES.md` documents the module API in full. These are the common cases.

### Add a landmark

Add an entry to the `landmarks(H)` export of a file in `kits/`:

```js
export function landmarks(H) {
  return {
    my_tower: {
      at: [640, 520],                 // position in canon map pixels
      label: 'My Tower',              // name on the map; also the card key
      minSide: 46, reach: 400,        // smallest block it fits, and how far it may move to find one
      build(x, z, w, d, st, r) {      // local block frame; r() is the seeded random
        H.bld(0, 0, 30, 30, 180, st, r);
      },
      update(t, dt) {},               // optional, runs every frame
    },
  };
}
```

A map pixel `(u, v)` lies at world `((u - 680) * 3.6, (v - 390) * 3.6)` metres. Add the card to the family's file
in `content/`, keyed by the label:

```json
"My Tower": { "kicker": "One line under the title", "category": "civic", "text": ["First paragraph.", "Second paragraph."] }
```

`category` is one of `civic`, `corp`, `shop` or `food`. A new family file also needs its name in `FIND_FAMILIES`
in `engine/api.js`. Use `?showcase=<family>` to look at its kits on an empty grid.

### Add building kits

A district file exports `kits(H)` for lots, `tiers` to place those kits by density, and `blocks(H)` for whole
blocks. Kit names share one namespace, so prefix them with the district.

### Add an audio guide episode

An episode is an MP3 plus a cue file in `audio/tour/`, named `<id>-en.mp3` and `<id>-en.cues.json`. Add it to
`EPISODES` in `engine/audiotour.js`. The cue file holds the subtitles and the camera moves, both timed in seconds:

```json
{
  "lines": [{ "t": 12.4, "d": 3.1, "who": "GUIDE", "text": "Welcome to New Angeles." }],
  "cams": [{ "t": 0, "cue": "sky \"The Root\" x=650 y=250 z=-990 az=200 turn=-25 el=.3 r=4200 t=17.5" }]
}
```

Camera verbs include `view`, `orbit`, `pan`, `dolly`, `spiral`, `gaze`, `sky`, `district` and `wide`. Most take
a quoted landmark name. `engine/audiotour.js` documents each one.

### Add ride music

Each maglev tour in `engine/ride.js` names a `music` key, which plays `audio/ride/<key>.mp3` as a loop.

## Contributing

Contributions are welcome: new landmarks, building kits, card texts, audio guide episodes, fixes and performance
work. Open an issue to discuss a larger idea first, or send a pull request.

- Keep it original. Write your own descriptions and build your own models. Do not copy official artwork or book
  text.
- Keep randomness seeded through `r()` or `H.rng(H.hash(a, b))`, never `Math.random`, so the city stays the same.
- Keep the city fast. Check your change with `?probe=live` and keep the draw calls and frame time where they were.
- Keep light dim. Emissive values stay mostly under 1, so only signs and accents bloom.
- Check the browser console for errors before you send the change.

This repository is published from a larger private project. Merged changes are carried back into it, so later
updates keep them.

## Fan work

New Angeles Map is an unofficial fan project. It is not affiliated with or endorsed by Fantasy Flight Games,
Asmodee or Null Signal Games. Android, Netrunner, New Angeles and all related names, places and characters
belong to their owners.

The map, its models and its code are original work. Some landmark names and descriptions draw on the Android
setting books and on Genesys Foundry fan supplements. No official artwork or book text is included. The
audio guide narration and the ride music are AI-generated.

## License

MIT, see `LICENSE`. The license covers the original work in this repository: the code, the models, the card
texts and the audio. It grants no rights to the Android names and setting, which belong to their owners.

The street generator core in `gen/mapgen/` is vendored from MapGenerator and keeps its own LGPL-3.0 license.
`gen/mapgen/UPSTREAM.txt` names the upstream commit.

Built with [Three.js](https://threejs.org/).
