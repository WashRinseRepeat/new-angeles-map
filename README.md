# New Angeles Map

An interactive 3D night map of New Angeles, the city of the Android universe. Fly over the districts, open the
landmark cards, ride the maglev lines and listen to the narrated audio guide.

## Run it

The map is plain ES modules with no build step. Serve the folder over HTTP and open it in a browser:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/. Three.js loads from the jsDelivr CDN.

## Layout

| Path | Content |
|---|---|
| `index.html` | Page, styles and the import map |
| `engine/` | Renderer, generator, controls, rides, audio tours |
| `kits/` | District and landmark builders |
| `landmarks/` | The Beanstalk and the terrain |
| `content/` | Landmark and district card texts |
| `city.json` | Streets, lots, districts and transit, made by `gen/` |
| `audio/` | Audio guide episodes, their camera cues and the ride music |
| `MODULES.md` | How a kit or landmark module is written |

## Fan work

New Angeles Map is an unofficial fan project. It is not affiliated with or endorsed by Fantasy Flight Games,
Asmodee or Null Signal Games. Android, Netrunner, New Angeles and all related names, places and characters
belong to their owners.

The map, its models and its code are original work. Some landmark names and descriptions draw on the Android
setting books and on Genesys Foundry fan supplements. No official artwork or book text is included. The
audio guide narration and the ride music are AI-generated.
